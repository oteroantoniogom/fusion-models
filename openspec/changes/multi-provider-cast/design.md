# Design — multi-provider-cast

## Context

`fusion-harness.ts` resolves models through two functions, `architectModel()` and `builderModel()`, which read the `--architect` / `--builder` boot flags (defaults `anthropic/claude-fable-5` / `openai/gpt-5.6-sol`). Every command handler calls them and passes the result to `runChild()`, which spawns `pi --mode json -p --model <provider/id>`. The child pi resolves the provider through the user's own model registry — so **any provider pi supports already works** (ZAI and OpenCode Zen are built-in, keyed by `ZAI_API_KEY` / `OPENCODE_API_KEY`).

What does not exist today:

1. No way to change the cast without restarting pi with different flags (the `/thinking` command is the precedent for in-session mutation).
2. No validation that a model string resolves or is authenticated — the failure surfaces as a dead child in a duo panel *after* banner, widget, and spawn.
3. No role beyond ARCHITECT/BUILDER can hold a distinct model (FUSION reuses the architect model; VALIDATOR reuses the architect model). Future commands (debate JUDGE, council CHAIRMAN/panel) break that two-slot assumption.

Relevant API surface (verified against the installed pi package): `ctx.modelRegistry` exposes `getAll()`, `getAvailable()`, `find(provider, id)`, `hasConfiguredAuth(model)`, `getProviderAuthStatus(provider)`, `getProviderDisplayName(provider)`, `getError()`. Interactive selection is available via `ctx.ui.select(title, options)` / `ctx.ui.input(...)`; full custom overlays exist via `ctx.ui.custom()` but are not needed for v1. The extension already reads `ctx.modelRegistry.find(...)` in its footer renderer, confirming handler-side availability of the registry.

## Goals / Non-Goals

**Goals:**

- A single **cast map** (`role name → provider/id`) is the source of truth for which model plays which role; boot flags seed it; it is mutable at runtime.
- Every command declares its cast; invoking a command opens a **picker** pre-filled from the session cast — confirm or edit rows, then run. The prompter chooses the judge.
- **`/roles`** opens the same picker standalone (review/set session defaults).
- **Preflight**: no child spawns until every cast model resolves in the registry and has configured auth; failures get a loud, actionable panel.
- Picker offers every registry model grouped by provider with auth status visible, plus a "type it yourself" escape for catalog lag.
- Generic justfile recipe + documented `fh-glm` / `fh-zen` presets; README provider table.
- **Per-role thinking levels**: rows carry an optional thinking override; the sheet shows and cycles it; `/thinking` addresses roles.
- **Disk-persisted casts**: SAVE writes `<cwd>/.fusion-harness.json`; boot seeds defaults → file → flags → session.
- **Fuzzy search**: type-to-filter in drill-down lists.
- **Quick-skip**: `--cast-defaults` inline arg bypasses the sheet for one invocation.

**Non-Goals:**

- **No provider plumbing.** No custom provider extensions, no OAuth flows, no API clients. Provider support is pi's layer; this change consumes it.
- **No per-row cost/latency forecasting in the sheet** — auth and context-window display only.
- **No changes to spawned-child flags** (`--no-skills --no-extensions --no-context-files`, sessions, forks) — the child contract is untouched.

## Decisions

### D1 — Cast map, not slot functions

Replace `architectModel()` / `builderModel()` with a `cast: Map<string, string>` keyed by role name (`ARCHITECT`, `BUILDER`, `FUSION`, `VALIDATOR`, and future roles like `JUDGE`). Seeding order at boot: explicit `--architect` / `--builder` flags → built-in defaults. Existing call sites migrate to `castModel("ARCHITECT")`-style lookups.

*Alternatives considered:* (a) keep the two slot functions and add more flags per new role — rejected: flag-per-role explodes with every new command and can't be mutated in-session cleanly; (b) persist cast to a project config file — deferred (see Non-Goals); the in-memory map keeps v1 small and matches the `/thinking` precedent.

### D2 — A single-screen cast sheet via `ctx.ui.custom()` overlay

The picker is ONE custom overlay component — the cast sheet — rendered via `ctx.ui.custom(..., { overlay: true })`: one row per declared role showing role name, current model, and auth marker; keyboard navigation (up/down between rows, Enter/`e` edits a row, drilling into a provider→model list inside the same overlay with **type-to-filter fuzzy search**, `m` opens a manual `provider/id` input row implementing `Focusable` for IME/cursor correctness, `t` cycles the row's thinking level, Enter on the RUN row confirms, Esc cancels the command). Each row shows role name, current model, **thinking level**, and auth marker. A SAVE action persists the sheet to the project cast file (D8). Options come from `modelRegistry.getAll()` grouped by provider display name, authenticated models first (`hasConfiguredAuth`). The component natively supports **multi-pick rows** (checkboxes), which the council PANEL row in `five-coordination-commands` needs — a select-dialog chain could never express that. The component is self-contained (built from `@earendil-works/pi-tui` primitives: `Container`, `Text`, focus propagation; `examples/extensions/overlay-qa-tests.ts` in the pi package is the reference for overlay lifecycle, anchoring, and disposal).

*Alternatives considered:* (a) a chain of `ctx.ui.select()` dialogs, one per row — rejected: no whole-cast view, no multi-pick for panel rows, and N modal round-trips per invocation; the user chose the overlay directly; (b) no picker, flags only — rejected by the user: the prompter must be able to choose who judges.

### D3 — Picker opens per invocation, pre-filled, one-keystroke confirm

Every casted command opens the cast sheet on invocation with each row pre-filled from the session cast (first run: the flag-seeded defaults). Accepting the whole sheet is a single Enter on the RUN row. Picks mutate the session cast, so the next command pre-fills from them. Esc abandons the command before any side effect. `/roles` exposes the same sheet outside a run, covering all known roles. **An inline `--cast-defaults` argument on any casted command skips the sheet for that invocation**, running immediately with the current session cast (the headless path uses it implicitly).

*Alternatives considered:* (a) sheet only when a role is unassigned — rejected: hides the cast from the prompter exactly when judge choice matters; (b) a "don't ask again" toggle — rejected in favor of `--cast-defaults`: explicit per-invocation, no hidden state.

### D4 — Preflight blocks; the fix is always one documented step away

Before any spawn, each cast model is checked: `find(provider, id)` must resolve **and** `hasConfiguredAuth(model)` must hold. On failure: render an error panel naming the role, the offending string, and the remediation — `/login <provider>` or the env var for missing auth; a copy-pasteable `~/.pi/agent/models.json` stanza skeleton for unresolved ids (catalog lag). Nothing spawns; no artifacts dir is minted. If `modelRegistry.getError()` reports a catalog refresh failure, the panel says so distinctly (the model may still be fine — check before assuming a typo).

*Alternatives considered:* (a) warn-and-proceed — rejected: the child fails anyway, after burning banner/widget/spawn; blocking is strictly cheaper and louder; (b) a `--force` bypass flag — rejected: the legitimate bypass *is* `models.json`, which makes `find()` succeed and fixes the footer context-window lookup too.

### D5 — Sessions, footer, and forks stay side-keyed

Role sessions remain pinned per project **and per model** under `/tmp/fusion-harness-sessions/` exactly as today: swapping a role's model mints a fresh brain for that model (never replaying one model's transcript as another's). The footer keeps its two cells (architect-side / builder-side) reading from the cast. The host-fork privilege stays with the builder side. The cast map changes *which model string a role holds*, not how children are spawned.

*Alternatives considered:* rebinding sessions per-role-name instead of per-model — rejected: it would replay transcripts across models, the exact failure the README's classifier warning describes.

### D6 — Recipes and docs are part of the change

justfile gains a parameterized recipe (`just fh ARCH=zai/glm-5.2 BUILDER=opencode/<model>`) plus two documented presets (`fh-glm`: `zai/glm-5.2` plans · `zai/glm-5-turbo` builds; `fh-zen`: an OpenCode Zen pair, exact ids confirmed against the live Zen catalog at implementation time). README gains a provider table: provider key, auth env var, `/login` path, catalog notes.

### D7 — Per-role thinking levels

The cast map value becomes `{ model, thinking? }`: flags (`--architect-thinking` / `--builder-thinking`) seed side-level defaults; a role with no override inherits its side's level. The sheet's `t` key cycles a row's override through the canonical levels (plus an "inherit" state). `/thinking` extends its argument grammar to address roles (`/thinking JUDGE high`) as well as sides (`/thinking architect high`); bare `/thinking` prints both the side defaults and any role overrides. Child spawns pass the resolved level via the existing `--thinking` flag — no child-contract change.

*Alternatives considered:* (a) thinking stays per-side — rejected by the user: a judge at `low` over debaters at `max` is a real, legitimate cast; (b) per-role flags at boot — rejected: flag-per-role explodes exactly like model-per-role did.

### D8 — Disk-persisted casts (opt-in, project-scoped)

A SAVE action in the sheet writes the current cast (roles → `{ model, thinking? }`) to `<cwd>/.fusion-harness.json` (pretty JSON, gitignore-able, per-project). Boot seeding order: built-in defaults → project file (if present) → flags (win over file) → session mutations. `/roles` completion output notes whether a project file exists and when it was last written. Loading is forgiving: unknown roles are ignored, unresolvable models are caught by preflight at first use — never at boot.

*Alternatives considered:* (a) global user file (`~/.pi/agent/…`) — rejected: casts are project-shaped (a kernel repo and a landing page want different brains); (b) auto-save on every mutation — rejected: explicit SAVE keeps the file intentional, session experimentation free.

## Risks / Trade-offs

- **Catalog lag blocks a brand-new model at preflight** → the panel prints a ready `models.json` stanza skeleton, and the picker's `Other…` row accepts literal ids; once added to `models.json`, `find()` resolves and preflight passes.
- **Picker fatigue on repeated runs** → every row pre-fills from the session cast; accepting the sheet is one Enter. `/roles` sets defaults once per session. Esc cancels before any side effect.
- **Overlay component complexity** (keyboard handling, focus for the manual-entry input, disposal) → the sheet is one self-contained component; pi-tui's `Focusable` contract handles the embedded input; `overlay-qa-tests.ts` is the worked reference; headless mode never renders it.
- **`getAll()` can be a long list** → options are grouped by provider with auth markers; providers without auth are still shown (marked) so the picker doubles as discovery, but authenticated ones sort first.
- **Non-TUI / headless runs can't show dialogs** → when `ctx.hasUI` is false (or mode isn't TUI), the picker is skipped entirely and the cast is purely flag-seeded; preflight failures print the same remediation as plain text. Slash commands in headless mode must never block on a dialog.
- **Stale project cast files** (a saved model is renamed/removed upstream) → preflight catches it at first use with the usual remediation; boot never validates the file.
- **Fuzzy-filter performance on huge registries** → filter is substring/subsequence over an in-memory list, trivially fast; no index needed.
- **Thinking-level semantics vary across providers** (Zen proxies heterogeneous upstreams) → per-role overrides make this MORE visible, not less: the row shows exactly what each role asked for; `/thinking` remains the session override. Documented as a README caveat.
- **Cost reporting may be absent for some providers** → panels show `$0.00`; cosmetic, documented.

## Migration Plan

No migration: flags, defaults, session layout, and artifacts layout are unchanged. Existing recipes (`fh-workhorse`, `fh-sota`) behave identically; the only visible difference is the picker opening on command invocation and preflight panels on misconfiguration.

## Open Questions

- Exact OpenCode Zen model ids for `fh-zen` (confirm against the live catalog at implementation time; Zen's catalog is dynamic).
- Should accepting the picker's default rows be skippable with a single inline command arg (e.g. `/fusion --cast-defaults …`)? Leaning no for v1 — Enter is cheap — but noted.
