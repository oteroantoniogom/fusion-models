# multi-provider-cast

## Why

The harness already forwards `--model provider/id` verbatim to spawned children, and pi natively resolves any registered provider — including ZAI (`zai`, `zai-coding-cn` via `ZAI_API_KEY`) and OpenCode Zen (`opencode`, `opencode-go` via `OPENCODE_API_KEY`). Multi-provider runs therefore work *in principle* today — but in practice the cast is frozen in two boot flags (`--architect` / `--builder`), a typo or missing API key is only discovered after a child spawns and dies, and nothing can be inspected or changed without restarting pi. Upcoming coordination commands (a debate judge, a council panel) need more than two assignable models, cast by the prompter at run time.

## What Changes

- **Generalize the two hardcoded model slots** (`architectModel()` / `builderModel()`) into a role→model **cast map**: boot flags seed the defaults; any named role can hold any registered model.
- **Cast picker UI**: every command declares the cast it needs; on invocation a single-screen **cast sheet overlay** (a custom `ctx.ui.custom()` component) opens pre-filled with the session cast — one row per role, keyboard-driven, auth status per row — so the prompter confirms or edits rows, judge included, *before* anything spawns. Selections persist in memory for the session (same precedent as `/thinking` overrides).
- **`/roles` command**: open the same picker standalone to review or set session defaults outside any run.
- **Preflight validation**: before any child spawns, every cast model is checked via `ctx.modelRegistry.find()` + `hasConfiguredAuth()`; failures render a loud panel with the exact remediation (`/login` command, env var, or a `~/.pi/agent/models.json` stanza for catalog-lagging model ids) and **nothing spawns**.
- **Launch recipes + docs**: a generic justfile recipe (`fh ARCH=… BUILDER=…`) plus documented ZAI/OpenCode presets (`fh-glm`, `fh-zen`); README gains a provider table (auth env vars, `/login` commands, catalog-refresh notes).
- **Per-role thinking levels**: the cast map carries an optional thinking override per role (flags seed side-level defaults); the cast sheet shows a thinking column (`t` cycles levels on a row), and `/thinking` extends to address roles as well as sides.
- **Disk-persisted casts**: a SAVE action in the sheet writes the session cast (models + thinking) to a project file (`<cwd>/.fusion-harness.json`); boot seeding order becomes built-in defaults → project file → flags → session mutations.
- **Fuzzy search in the sheet**: type-to-filter inside provider→model drill-down lists.
- **Quick-skip**: an inline `--cast-defaults` argument on any casted command skips the sheet entirely for that invocation (flag-seeded/session cast as-is).

No breaking changes: `--architect` / `--builder` keep working as seed defaults, and the default cast remains the current two models. Children still receive a plain `--model provider/id` — provider plumbing stays pi's job; this change makes any pi-registered provider **castable, visible, and safe**.

## Capabilities

### New Capabilities

- `role-casting`: the role→model cast map — seeded by boot flags, mutable via an interactive picker at command invocation or through `/roles`, scoped to the session.
- `model-preflight`: pre-spawn validation that every cast model resolves in pi's model registry and has configured auth, with actionable fix guidance on failure and no side effects.

### Modified Capabilities

<!-- None — openspec/specs/ is empty; no existing requirements change. -->

## Impact

- `extensions/fusion-harness/fusion-harness.ts`: model resolution (slot functions → cast map), command handlers (preflight + cast sheet overlay before spawning), one new command (`/roles`), one new self-contained overlay component (the cast sheet).
- `justfile`: generic recipe + two documented presets.
- `README.md`: provider table, picker, and `/roles` documentation.
- User-side auth setup (`ZAI_API_KEY` / `OPENCODE_API_KEY` or `/login zai` / `/login opencode`) — documented, not coded.
- **Downstream**: `five-coordination-commands` builds directly on this change — judge / chairman / panel casting is the cast map plus picker rows defined here.
