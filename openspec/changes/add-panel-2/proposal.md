# Proposal: Add PANEL_2 multi-pick role

**Change:** `add-panel-2`  
**Status:** proposed  
**Date:** 2026-07-25  
**Surface:** `extensions/fusion-harness` (cast sheet, `/council`, `/gauntlet` deliberate, project cast, preflight)

## Problem

Operators can already multi-pick several models into a single `PANEL` cast row for `/council` (and gauntlet council deliberate). There is no second multi-pick panel slot for organizing a larger or alternate panelist set without stuffing everything into one comma-separated `PANEL` value. The user request is to add **`PANEL_2`** alongside `PANEL`.

## Intent

Introduce a first-class role `PANEL_2` that:

1. Is a known cast role (glyphs, colors, side, project-file persistence).
2. Is multi-pick like `PANEL` (comma-separated models in cast; cast-sheet toggle UX).
3. Participates in council-style pipelines as an **additional panelist source** merged with `PANEL`, not as a separate second council by default.
4. Is validated by preflight the same way as other multi-pick roles.

## Proposed product behavior

### Role registration

- Add `PANEL_2` to `KNOWN_ROLES`, `Role`, `ROLE_SIDE`, `ROLE_COLOR`, `ROLE_GLYPH`.
- Suggested presentation (refine in design if needed):
  - **Side:** `architect` (same as `PANEL` / `CHAIRMAN`).
  - **Color:** `mdLink` (same panel family as `PANEL`).
  - **Glyph:** distinct from `PANEL`'s `☰` — e.g. `☷` (document in README glyph list).
- Project cast `.fusion-harness.json` may store `PANEL_2: { model, thinking? }` via existing known-role filtering.

### Multi-pick

- `MULTI_PICK_ROLES` becomes `["PANEL", "PANEL_2"]`.
- `expandCastModels` already CSV-splits any role in `MULTI_PICK_ROLES`; both roles use that path.
- Cast sheet `/roles` and any command cast gate that includes `PANEL_2` shows a multi-pick row (toggle / Space / Enter drill behavior already shared for all `multiPick` roles).

### `/council` panelist pool (preferred default)

**Combine, do not bifurcate:**

1. Expand `PANEL` and `PANEL_2` independently via `expandCastModels`.
2. Build the panelist list as **`PANEL ∪ PANEL_2`**, ordered as: all `PANEL` models (in cast order), then `PANEL_2` models not already present.
3. **Dedupe** by exact `provider/id` string (first occurrence wins).
4. Require **≥ 2 total panelists** after merge (same gate as today). Error copy should mention both roles when relevant (e.g. set `PANEL` and/or `PANEL_2` via `/roles`).
5. **Fallback:** keep today's `PANEL` fallback to `castModel("ARCHITECT")` when `PANEL` is empty/unset. **`PANEL_2` has no ARCHITECT fallback** — missing/empty `PANEL_2` contributes zero models.
6. **CHAIRMAN** unchanged (single-pick).
7. Ranking, Borda, and chairman stages operate on the **combined** survivor set (one council, one anonymized ranking, one synthesis).
8. **Runtime display:** `AgentRun.role` should reflect the cast source (`PANEL` vs `PANEL_2`) so the live widget/footer shows the correct glyph/color; shared prompt files (`USER_PROMPT_COUNCIL_*`) stay unchanged.
9. **Thinking:** use `castThinking` for the source role (`PANEL` or `PANEL_2`) per child.

### `/gauntlet` (and chain deliberate)

- When deliberate mode is council (default), use the **same combined pool helper** as `/council`.
- `COMMAND_CAST.gauntlet` and deliberate `stageRoles` include `PANEL_2` so cast sheet + preflight cover it.
- Debate deliberate path unchanged (`DEBATER_*` / `JUDGE`).

### Cast gates / preflight

- `COMMAND_CAST.council`: `["PANEL", "PANEL_2", "CHAIRMAN"]`.
- `COMMAND_CAST.gauntlet`: add `PANEL_2` alongside existing roles.
- `runCastGate` already passes all `MULTI_PICK_ROLES` when any command role is multi-pick — both rows appear once either is in the command cast.
- `preflightCast` already loops `expandCastModels` per role — each model in `PANEL` and `PANEL_2` is resolved/auth-checked.

### Docs

- README: document `PANEL_2` glyph, multi-pick cast, and that `/council` merges `PANEL` + `PANEL_2` (deduped) with ≥2 total panelists.

## Scope

### In scope

- Role constants / types / cast sheet multi-pick wiring for `PANEL_2`.
- Combined panelist collection helper used by `/council` and gauntlet/chain council deliberate.
- `COMMAND_CAST` + `stageRoles` updates.
- Project cast persistence (via `KNOWN_ROLES`).
- Source/unit tests for `MULTI_PICK_ROLES`, `expandCastModels`, combined-pool rules, and `COMMAND_CAST` / role lists.
- README glyph / casting notes.

### Non-goals

- Implementing this change in this proposal phase (proposal only).
- Separate two-round or sequential councils (rejected as default; see alternatives).
- New prompt markdown files or chairman role changes.
- Changing single-pick roles or debate pipeline.
- Raising Borda letter alphabet beyond A–Z (26 panelists cap remains a known limit).
- E2E live provider runs as the primary verification path (prefer focused `npx tsx` source/unit tests).

## Affected areas

| Area | Likely touchpoints |
|------|--------------------|
| Role registry | `KNOWN_ROLES`, `Role`, `ROLE_SIDE`, `ROLE_COLOR`, `ROLE_GLYPH`, `MULTI_PICK_ROLES` |
| Cast UX | `CastSheet` / `openCastSheet` / `/roles` (via `multiPick`) |
| Cast gates | `COMMAND_CAST.council`, `COMMAND_CAST.gauntlet`, `stageRoles` deliberate |
| Preflight | `preflightCast` + `expandCastModels` (behavior already multi-model-aware) |
| Council runtime | `/council` handler; shared `councilPipeline` / panel answer+rank helpers; gauntlet deliberate council branch |
| Persistence | `.fusion-harness.json` known-role round-trip |
| Docs | `README.md` glyph list + casting / council sections |
| Tests | `tests/test-gauntlet.ts`, role suites that assert `KNOWN_ROLES` length / `COMMAND_CAST` / PANEL multi-pick |

## Alternatives considered

### A. Combined pool (preferred — this proposal)

`PANEL ∪ PANEL_2` → one council. Matches “añadamos panel 2” as a second cast slot without changing council semantics. Lowest UX surprise; reuses ranking/chairman once.

### B. Two-round / dual councils (rejected as default)

Run council on `PANEL`, then on `PANEL_2`, then somehow merge syntheses. More cost, ambiguous chairman product, and heavier design. May be revisited later as an optional flag; **out of scope** now.

### C. `PANEL_2` only as cast UI alias that appends into `PANEL` on commit (rejected)

Would avoid a new role but break clear project-cast editing and preflight attribution. Operators could not see or persist a second row.

## Risks

| Risk | Notes / mitigation |
|------|---------------------|
| **Larger panels → cost / latency** | Combined pool can grow quickly; document ≥2 min still applies; operators control picks. |
| **Windows spawn / cmdline length** | More panelists ⇒ more ranking children and larger anonymized answer blocks. Recent `@file` prompt offload reduces ENAMETOOLONG; still call out soft limit if system prompts + paths grow. |
| **Dedupe surprises** | Same model in both rows runs once (first wins). Document in README / cast help. |
| **Borda letter cap (A–Z)** | Existing 26-panelist limit; combined pool makes it easier to hit — keep as documented constraint; do not expand alphabet in this change. |
| **Test drift** | Suites hard-code `KNOWN_ROLES.length === 11`, gauntlet cast role lists, and “multiPick includes PANEL only” — update in lockstep. |
| **Glyph / README mismatch** | README glyphs already drift slightly from code; update both consistently when adding `PANEL_2`. |
| **Uncommitted harness WIP** | Recent multi-pick / cast-sheet / `@file` fixes may be uncommitted; implement `PANEL_2` atop that baseline to avoid regressing cast UX. |

## Rollback

1. Revert the change branch / commits that introduce `PANEL_2`.
2. Project casts with a `PANEL_2` key become inert once the role is removed from `KNOWN_ROLES` (unknown keys already dropped on load/save) — no migration required.
3. Operators who only used `PANEL` see no behavior change after rollback.

## Success criteria

1. `PANEL_2` appears in `/roles` and in council/gauntlet cast sheets as a **multi-pick** row.
2. `.fusion-harness.json` round-trips `PANEL_2`.
3. Preflight fails clearly if any model listed under `PANEL` or `PANEL_2` is unresolved or unauthenticated.
4. `/council` (and gauntlet council deliberate) runs panelists from the **deduped union**, still requiring ≥2 total; CHAIRMAN unchanged.
5. Empty `PANEL_2` does not break councils that already have ≥2 `PANEL` models.
6. Focused tests cover: `MULTI_PICK_ROLES` membership, `expandCastModels("PANEL_2", …)`, combined-pool order/dedupe/min-count, and updated `COMMAND_CAST` / known-role assertions.
7. Primary verification command remains `npx tsx tests/test-gauntlet.ts` (plus any narrowly updated role/cast suite assertions).

## Open questions (resolve in design if needed)

- Exact glyph/`ROLE_COLOR` for `PANEL_2` (proposal suggests `☷` + `mdLink`).
- Whether live widget labels should show `PANEL_2` or a shortened label when many runs are compact-rendered (prefer full role name for consistency).

## Next phase

Proceed to **sdd-spec** (delta requirements/scenarios for cast sheet, preflight, `/council` merge rules, gauntlet deliberate) then **sdd-design** / **sdd-tasks** before apply.
