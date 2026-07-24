# campaign-task-board

## ADDED Requirements

### Requirement: Live campaign board

While a `/gauntlet` campaign runs, the harness SHALL render a live board showing: the current stage (as k of 6, named), elapsed time, cumulative cost across all stages, and per-stage status (pending / working / done / failed).

#### Scenario: Stage progress visible
- **WHEN** any stage is active
- **THEN** the board names the stage, its index of 6, elapsed time, and cumulative cost so far, updating on the widget refresh cadence

### Requirement: Subtask checklist

Once `subtasks.json` exists, the board SHALL render one line per subtask with a state glyph (pending ⬜ / working ◐ / done ✓ / failed ✗) mirroring its worker run state, and SHALL update live as workers settle.

#### Scenario: Checklist tracks workers
- **WHEN** the BUILD stage is running
- **THEN** each subtask line reflects its worker's live state, transitioning working → done/failed as workers settle

#### Scenario: Checklist persists into later stages
- **WHEN** the campaign is in VERIFY, HARDEN, or INTEGRATE
- **THEN** the settled subtask checklist remains visible in its final state

### Requirement: Pre-manifest degradation

Before `subtasks.json` exists (DELIBERATE, GATE-FIRST), the board SHALL render stage progress only, without an empty or placeholder checklist.

#### Scenario: Early stages
- **WHEN** the campaign is in DELIBERATE
- **THEN** the board shows stage progress, elapsed, and cost with no subtask section

### Requirement: Final board panel

At campaign end (success or halt), the harness SHALL render a full-height final board panel into scrollback summarizing every stage: outcome, key stats, and artifact paths within the campaign dir.

#### Scenario: Campaign summary
- **WHEN** the campaign ends
- **THEN** one scrollback panel lists all six stages with their outcomes and artifact paths, including cumulative tokens and cost

### Requirement: Narrow-terminal degradation

Below the two-column minimum width, the board SHALL collapse to stage-line-only rendering (current stage, elapsed, cost) rather than overflowing.

#### Scenario: Narrow terminal
- **WHEN** the terminal is narrower than the two-column minimum
- **THEN** the board renders a single compact status line
