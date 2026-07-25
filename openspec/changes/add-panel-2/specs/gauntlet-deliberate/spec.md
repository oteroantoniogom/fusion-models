# Gauntlet Deliberate Specification

## Purpose

Ensure gauntlet (and chain) council deliberate mode uses the same combined `PANEL ∪ PANEL_2` panelist pool as `/council`, and that cast/stage role unions include `PANEL_2`. Debate deliberate remains unchanged.

## Requirements

### Requirement: Council Deliberate Uses Combined Panelist Pool

When gauntlet deliberate mode is council (the default), the system MUST build panelists with the same combined-pool rules as `/council`:

- Expand `PANEL` and `PANEL_2` independently
- Order: `PANEL` models first, then new `PANEL_2` models
- Dedupe by exact `provider/id` (first wins)
- `PANEL` falls back to `ARCHITECT` when empty/unset; `PANEL_2` empty contributes 0
- Require ≥ 2 total panelists after merge before a successful council deliberate stage
- `CHAIRMAN` unchanged (single-pick synthesis role)

The system SHOULD share one helper (or equivalent single code path) between `/council` and gauntlet/chain council deliberate so merge rules cannot diverge.

Debate deliberate (`DEBATER_A` / `DEBATER_B` / `JUDGE`) MUST remain unchanged by this capability.

#### Scenario: Gauntlet council deliberate merges PANEL_2

- GIVEN gauntlet runs with council deliberate (default) and both `PANEL` and `PANEL_2` have models
- WHEN the deliberate stage builds its panelist list
- THEN the list matches the `/council` combined deduped pool for the same cast
- AND ranking/chairman proceed over that combined set

#### Scenario: Empty PANEL_2 on gauntlet with sufficient PANEL

- GIVEN gauntlet council deliberate, `PANEL` has ≥ 2 models, `PANEL_2` empty
- WHEN deliberate runs
- THEN the stage uses the `PANEL` models only and does not fail solely due to empty `PANEL_2`

#### Scenario: Debate deliberate untouched

- GIVEN deliberate mode is debate (not council)
- WHEN gauntlet/chain deliberate runs
- THEN roles remain `DEBATER_*` / `JUDGE` paths
- AND `PANEL_2` is not required as a debate participant

### Requirement: Gauntlet and Chain Stage Roles Include PANEL_2

`COMMAND_CAST.gauntlet` MUST include `PANEL_2` (see command-cast domain).

For chain/gauntlet stage role unions, deliberate (council-capable) stages MUST include `PANEL_2` in addition to `PANEL` and `CHAIRMAN` (and existing debate roles already added for deliberate).

Cast sheet + preflight for gauntlet/chain MUST therefore cover `PANEL_2` whenever those stages are selected.

#### Scenario: stageRoles deliberate includes PANEL_2

- GIVEN stage set that includes `deliberate`
- WHEN `stageRoles` (or equivalent role union) is computed
- THEN the result includes `PANEL_2`
- AND still includes `PANEL` and `CHAIRMAN`

#### Scenario: Gauntlet cast gate covers PANEL_2

- GIVEN `/gauntlet` opens the cast sheet in TUI
- WHEN the operator reviews required roles
- THEN `PANEL_2` is present as a multi-pick row eligible for editing before run

### Requirement: Combined-Pool Tests Cover Gauntlet Path

Focused tests MUST cover combined-pool order, dedupe, and minimum-count rules in a way that applies to the shared helper (or both `/council` and gauntlet council deliberate call sites).

Suites that assert deliberate `stageRoles` membership MUST expect `PANEL_2`.

#### Scenario: Combined pool helper assertions

- GIVEN unit/source tests for the panelist pool builder
- WHEN fed `PANEL=["a/1","b/2"]` and `PANEL_2=["b/2","c/3"]`
- THEN the result is `["a/1","b/2","c/3"]`
- AND a case with fewer than two unique models after merge is rejected or flagged as insufficient
