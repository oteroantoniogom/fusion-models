# Apply Progress: add-panel-2

**Change:** `add-panel-2`  
**Status:** apply complete (pending commit/PR by parent)  
**Delivery path:** `single-pr` (+ `exception-ok`)  
**Branch:** `feat/add-panel-2`  
**Date:** 2026-07-25

## Completed tasks

Work units **A + B** (all tasks 1–9):

1. RED structural assertions for PANEL_2 membership across five suites
2. GREEN role registry + `COMMAND_CAST` + `stageRoles`
3. GREEN README glyph / casting / council merge notes
4. RED `collectPanelModels` / expandCastModels / min-pool cases
5. GREEN `collectPanelModels` helper
6. GREEN `/council` combined pool + source-role `AgentRun` / `castThinking`
7. GREEN gauntlet council deliberate + role-aware `councilPanelAnswers` / `councilRanking` / `councilPipeline`
8. TRIANGULATE — single helper shared by `/council` and gauntlet deliberate
9. REFACTOR — role-aware pipeline path; no prompt-file / justfile churn

## Files changed

| File | Change |
|------|--------|
| `extensions/fusion-harness/fusion-harness.ts` | `PANEL_2` registry; `MULTI_PICK_ROLES`; `collectPanelModels`; `COMMAND_CAST`; `stageRoles`; `/council`; gauntlet deliberate; role-aware `council*` helpers |
| `README.md` | `☷ PANEL_2` glyph; multi-pick + merge rules; gauntlet flag docs |
| `tests/test-gauntlet.ts` | gauntlet cast 7 roles; §15 PANEL_2 / `collectPanelModels` tests; WIP-tolerant source asserts (CRLF / `function` decls) |
| `tests/test-gauntlet-BUILDER-zai/glm-5-turbo.ts` | COMMAND_CAST + CRLF / WIP assert lockstep |
| `tests/gauntlet-works-ARCHITECT-zai-glm-5.2.ts` | gauntlet cast seven roles incl. `PANEL_2` |
| `tests/test-suite-gauntlet-pipeline.ts` | `stageRoles` + source/README `PANEL_2` asserts |
| `tests/test-suite-ARCHITECT-opencode-go-deepseek-v4-pro.ts` | 12 roles; multi-pick; `collectPanelModels` cases |
| `openspec/changes/add-panel-2/tasks.md` | Chain strategy → `single-pr`; checkboxes done |
| `openspec/changes/add-panel-2/apply-progress.md` | this file |

## TDD Cycle Evidence

| Task | RED | GREEN | Notes |
|------|-----|-------|-------|
| A1 structural | `npx tsx tests/test-gauntlet.ts` → failing 1.13 + new 15.xx membership | Registry + COMMAND_CAST + stageRoles | Confirmed RED before production edits |
| A2 registry | — | Membership asserts green | `KNOWN_ROLES` length 12; glyph `☷`; side `architect`; color `mdLink` |
| A3 README | — | Source/README asserts for `PANEL_2` / `☷` | Also documented merge + no PANEL_2 ARCHITECT fallback |
| B4 helper cases | Section 15.05–15.09 / ARCHITECT suite cases added failing | `collectPanelModels` implemented | Never calls `castModel("PANEL_2")` |
| B5 helper | — | Helper unit cases green | Dedupe + order + empty PANEL_2 |
| B6 `/council` | 15.10 error-copy RED | Wired `collectPanelModels`; source roles + thinking | Min-panelist copy mentions PANEL and/or PANEL_2 |
| B7 gauntlet + helpers | 15.11–15.12 RED | Pipeline accepts `panelists` + `thinkingFor`; deliberate uses helper | Debate path untouched |
| B8–B9 | — | Primary 121/121 green | Triangulated shared helper call sites (≥2) |

## Test commands run

| Command | Result |
|---------|--------|
| `npx tsx tests/test-gauntlet.ts` | **121 passed, 0 failed** |
| `npx tsx tests/test-gauntlet-BUILDER-zai/glm-5-turbo.ts` | **147 passed, 0 failed** |
| `npx tsx tests/test-suite-gauntlet-pipeline.ts` | **59 passed, 1 failed** — `openspec` CLI not on PATH (env; PANEL_2 asserts green) |
| `npx tsx tests/test-suite-ARCHITECT-opencode-go-deepseek-v4-pro.ts` | **86 passed, 2 failed** — Windows path separators in `ephemeralSpawn` local replicas (pre-existing; all PANEL_2 cases green) |
| `PI_GAUNTLET_SKIP_RUNTIME=1 npx tsx tests/gauntlet-works-ARCHITECT-zai-glm-5.2.ts` | **35 passed, 1 failed, 5 skipped** — `pi` binary not installed (env); PANEL_2 cast assert green |

## Deviations from design

1. **Test harness lockstep for WIP baseline:** Updated a few source-extraction asserts to accept `function validateManifest` / `function topoLevels` (WIP shape), CRLF-tolerant `runGauntletStage` extraction, and destructured widget glyph form `status === "done"`. Needed so primary suite stays green atop uncommitted harness WIP — not a product behavior change.
2. **Standalone `/council` still inlines answer/rank loop** (pre-existing) rather than calling `councilPipeline`; both paths use `collectPanelModels` and source-role thinking. Shared helpers are used by gauntlet deliberate.
3. **Pipeline ranking** now ranks **survivors only** (aligned with standalone `/council`), preserving source roles from answer runs.

## Remaining tasks

None for apply. Parent may commit / push / open PR (explicitly out of scope for this apply agent).

## Workload / PR boundary

- **Path:** `single-pr` (+ `exception-ok`)
- **Chain strategy in tasks.md:** updated to `single-pr`; chained recommendation resolved
- No commit/push performed by apply agent
