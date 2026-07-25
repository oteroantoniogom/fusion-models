# Tasks: Add PANEL_2 multi-pick role

**Change:** `add-panel-2`  
**Status:** tasks  
**Date:** 2026-07-25  
**Apply approval:** Human has **already approved apply** for this change. Do not re-block on apply approval; proceed to implement per these tasks (still respect chained-PR / budget guidance below).

```text
Decision needed before apply: No
Chained PRs recommended: No
Chain strategy: single-pr
400-line budget risk: Medium
```

## Review Workload Forecast

| Field | Value |
|-------|-------|
| Estimated changed lines | 300–450 |
| 400-line budget risk | Medium |
| Chained PRs recommended | No (resolved: single-pr + exception-ok) |
| Suggested split | n/a — maintainer chose one-shot single PR |
| Delivery strategy | single-pr |
| Chain strategy | single-pr |

### Why Medium / chain

- One large surface file (`extensions/fusion-harness/fusion-harness.ts`) plus **five** test suites with hard-coded role counts/lists, plus `README.md`.
- Behavior change spans registry, cast gates, pure helper, `/council`, and gauntlet deliberate helpers — cohesive but easy to exceed 400 lines once tests grow.
- **Resolved delivery:** human/parent approved `single-pr` (+ `exception-ok` if over ~400 lines). Chained recommendation closed.

### Suggested chain (if split)

| Unit | Scope | Verify | Rollback |
|------|--------|--------|----------|
| **PR 1** | Role registry, `MULTI_PICK_ROLES`, `COMMAND_CAST`, `stageRoles`, structural test lockstep, README glyph/cast notes | `npx tsx tests/test-gauntlet.ts` (+ updated suite asserts) | Revert PR 1; cast keys with `PANEL_2` become inert after registry rollback |
| **PR 2** | `collectPanelModels`, `/council` + gauntlet/chain council deliberate wiring, role-aware `council*` helpers, helper unit/source tests | Same primary command + targeted suite runs | Revert PR 2; `PANEL_2` may still exist as cast-only until PR 1 rolled back |

---

## Implementation tasks

Strict TDD (`openspec/config.yaml`: `strict_tdd: true`). Sequence **RED → GREEN → TRIANGULATE → REFACTOR**. Primary verify: `npx tsx tests/test-gauntlet.ts`. No E2E live providers as primary path. Do not implement until this task list is the apply guide (apply already approved).

### Work unit A — Registry, cast gates, structural locks (PR 1)

#### 1. RED — Structural assertions for PANEL_2 membership

- [x] Update / add failing assertions in:
  - `tests/test-gauntlet.ts` — `COMMAND_CAST.gauntlet` includes `PANEL_2`; role count **6 → 7**; still includes `PANEL`, `CHAIRMAN`, `VALIDATOR`, `COORDINATOR`, `BUILDER`, `ATTACKER`.
  - `tests/test-gauntlet-BUILDER-zai/glm-5-turbo.ts` — exact `COMMAND_CAST` gauntlet string / count (include `PANEL_2`).
  - `tests/gauntlet-works-ARCHITECT-zai-glm-5.2.ts` — regex-extracted gauntlet cast list includes `PANEL_2` (six → seven roles).
  - `tests/test-suite-gauntlet-pipeline.ts` — local/`stageRoles` deliberate + full-chain expected roles include `PANEL_2`; length +1 where hard-coded.
  - `tests/test-suite-ARCHITECT-opencode-go-deepseek-v4-pro.ts` — `KNOWN_ROLES.length` **11 → 12**; Role union / maps include `PANEL_2`; rename “multiPick includes PANEL only” → both `PANEL` and `PANEL_2` (`MULTI_PICK_ROLES` deep-equals `["PANEL", "PANEL_2"]`); assert `COMMAND_CAST.council === ["PANEL", "PANEL_2", "CHAIRMAN"]` if that suite sources/mirrors it.
- [x] Run `npx tsx tests/test-gauntlet.ts` (and the suites touched) and confirm **RED** on the new expectations.

#### 2. GREEN — Register PANEL_2 and cast gates

- [x] In `extensions/fusion-harness/fusion-harness.ts`:
  - Insert `"PANEL_2"` in `KNOWN_ROLES` immediately after `"PANEL"` (length 12).
  - Extend `Role` with `"PANEL_2"`.
  - Set `ROLE_SIDE["PANEL_2"] = "architect"`, `ROLE_COLOR["PANEL_2"] = "mdLink"`, `ROLE_GLYPH["PANEL_2"] = "☷"`.
  - Set `MULTI_PICK_ROLES = ["PANEL", "PANEL_2"]`.
  - Set `COMMAND_CAST.council = ["PANEL", "PANEL_2", "CHAIRMAN"]`.
  - Add `"PANEL_2"` to `COMMAND_CAST.gauntlet` (with panel/council roles; final list length 7).
  - In `stageRoles` deliberate branch, `roles.add("PANEL_2")` alongside existing `PANEL` / `CHAIRMAN` / debate roles.
- [x] Confirm cast sheet / `runCastGate` already expands to full `MULTI_PICK_ROLES` when any multi-pick role is present — no structural rewrite beyond membership.
- [x] Re-run structural suites → **GREEN** for membership/count asserts (council merge behavior may still fail later tasks).

#### 3. GREEN — README glyph / casting notes

- [x] In `README.md`, document `☷ PANEL_2`, multi-pick cast, `/council` merges `PANEL ∪ PANEL_2` (deduped), ≥2 total panelists, and that empty `PANEL_2` has **no** ARCHITECT fallback.
- [x] Keep other glyph drift cleanup out of scope unless needed for `PANEL_2` consistency.

---

### Work unit B — Combined pool + council wiring (PR 2)

#### 4. RED — `collectPanelModels` / expandCastModels / min-pool cases

- [x] Add failing unit/source tests (prefer `tests/test-gauntlet.ts` and/or `tests/test-suite-ARCHITECT-opencode-go-deepseek-v4-pro.ts` per design):
  - `expandCastModels("PANEL_2", "prov/a, prov/b,prov/c")` → `["prov/a", "prov/b", "prov/c"]`.
  - Merge/dedupe: `PANEL=[a/x,b/y]`, `PANEL_2=[b/y,c/z]` → `[{model:"a/x",role:"PANEL"},{model:"b/y",role:"PANEL"},{model:"c/z",role:"PANEL_2"}]`.
  - Empty `PANEL_2` with ≥2 PANEL models → PANEL-only list; helper does not throw.
  - Empty PANEL + empty PANEL_2 + ARCHITECT fallback → single ARCHITECT entry from PANEL path; caller treats length `< 2` as refuse.
  - Assert helper **never** uses `castModel("PANEL_2")` for empty contribution (empty string / missing → `[]`).
  - Assert insufficient merged pool (`length < 2`) is rejected at call sites (or flagged in helper tests as insufficient for spawn).
- [x] Confirm **RED** before implementing the helper.

#### 5. GREEN — Implement `collectPanelModels`

- [x] In `extensions/fusion-harness/fusion-harness.ts`, next to `expandCastModels`, add pure `collectPanelModels(cast, castModel)` returning `PanelistEntry[]` (`{ model, role: "PANEL" | "PANEL_2" }`) per design contract:
  - Expand roles independently; PANEL order then new PANEL_2; exact `provider/id` dedupe; first wins.
  - `PANEL` raw: `cast["PANEL"]?.model ?? castModel("ARCHITECT")`.
  - `PANEL_2` raw: `cast["PANEL_2"]?.model ?? ""` — **never** `castModel("PANEL_2")`.
- [x] Re-run helper-focused tests → **GREEN**.

#### 6. RED → GREEN — Wire `/council` to combined pool + source roles

- [x] RED (if not already covered): assert min-panelist error copy mentions `PANEL` and/or `PANEL_2` (source or string assert in harness tests).
- [x] Replace `/council` panelist build (`expandCastModels("PANEL", …)` only) with `collectPanelModels(cast, castModel)`.
- [x] Fail closed when `panelists.length < 2` with operator-visible copy mentioning both roles (e.g. via `/roles`).
- [x] Banner / `newRun` / answer / ranking: use `entry.role` (or answer-run source role for ranking survivors); `thinking: castThinking(sourceRole)`; `CHAIRMAN` unchanged.
- [x] Do **not** change `USER_PROMPT_COUNCIL_*` files.
- [x] Verify focused tests still pass; no live `/council` E2E required.

#### 7. RED → GREEN — Wire gauntlet/chain council deliberate + shared helpers

- [x] Update `councilPanelAnswers` / `councilRanking` / `councilPipeline` to accept `panelists: PanelistEntry[]` (or equivalent) instead of hard-coding `newRun("PANEL", m)` / thinking `"PANEL"` / `"medium"`.
- [x] Thread `castThinking` or `thinkingFor(role)` so pipeline and `/council` share source-role thinking.
- [x] Ranking survivors copy source role from the matching answer `AgentRun`.
- [x] In gauntlet/chain **council** deliberate branch, call the same `collectPanelModels`; enforce ≥2; pass panelists into `councilPipeline`. Leave debate deliberate (`DEBATER_*` / `JUDGE`) untouched.
- [x] Ensure `stageRoles` / cast gate coverage from unit A still green with deliberate including `PANEL_2`.

#### 8. TRIANGULATE

- [x] Confirm `/council` and gauntlet council deliberate cannot diverge (single `collectPanelModels`).
- [x] Confirm empty `PANEL_2` does not break ≥2-PANEL councils; unset PANEL still falls back to ARCHITECT only on the PANEL path.
- [x] Confirm cross-role overlap keeps `role: "PANEL"` and one run.
- [x] Confirm debate path and non-council `COMMAND_CAST` entries unchanged.
- [x] Confirm persistence: known-role load/save round-trips `PANEL_2` via existing `KNOWN_ROLES` filter (no migration); optional source assert if cheap.

#### 9. REFACTOR

- [x] Prefer one role-aware panelist path through shared `council*` helpers; remove any duplicated merge logic left in `/council` vs pipeline.
- [x] Keep changes minimal; no prompt-file churn; no justfile/package.json changes.
- [x] Re-run primary: `npx tsx tests/test-gauntlet.ts`.
- [x] Re-run narrowly updated suites:
  - `npx tsx tests/test-suite-gauntlet-pipeline.ts`
  - `npx tsx tests/test-suite-ARCHITECT-opencode-go-deepseek-v4-pro.ts`
  - `npx tsx tests/test-gauntlet-BUILDER-zai/glm-5-turbo.ts` (if touched)
  - `PI_GAUNTLET_SKIP_RUNTIME=1 npx tsx tests/gauntlet-works-ARCHITECT-zai-glm-5.2.ts` (if touched)

---

## Out of scope (do not task)

- Dual/sequential councils or optional dual-council flag.
- Expanding Borda alphabet beyond A–Z.
- New/changed council prompt markdown.
- Live provider E2E as primary verification.
- Unrelated README glyph cleanup for other roles.

## Done when

1. Specs’ success criteria in `proposal.md` / delta specs are met by code + tests.
2. Primary `npx tsx tests/test-gauntlet.ts` passes.
3. Review size stays within chosen delivery (single PR or PR1→PR2); if approaching 400 lines mid-apply, split per forecast above.
4. No implementation of dual-council / prompt / Borda expansions.
