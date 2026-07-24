# multi-run-rendering

## ADDED Requirements

### Requirement: Stacked final panels for K runs

When a command produces K agent results, the final output SHALL render one full-height panel per run into scrollback (no hidden lines behind toggles), each carrying its role, model, stats (latency, tokens, cost), and full answer, in a deterministic order.

#### Scenario: Council of three
- **WHEN** a three-panelist council completes stage 1
- **THEN** three stacked answer panels render in scrollback in panel order, each with its own stats line

### Requirement: Compact live-widget mode for more than two runs

The live widget SHALL keep the existing two-column mode while at most two runs are active, and SHALL switch to a compact one-line-per-run mode when more than two runs are active. Each compact line SHALL carry the run's role glyph, role, model, status, most recent tool/text activity, and token count.

#### Scenario: Two runs
- **WHEN** at most two runs are active
- **THEN** the widget renders the existing two-column streaming layout

#### Scenario: Three or more runs
- **WHEN** a third run becomes active (e.g. council stage 1)
- **THEN** the widget switches to one compact line per run, updating on the same refresh cadence as the two-column mode

### Requirement: Failure clarity at any K

Every run's terminal state (done, failed, timeout, aborted) SHALL be visible in both the compact widget and its final panel, naming role, model, and error where applicable.

#### Scenario: One failure among many
- **WHEN** one of four runs fails
- **THEN** its compact line and its final panel both name the role, model, and error, and the other runs' output is unaffected

### Requirement: Footer stability

The footer SHALL remain two cells (architect-side, builder-side) regardless of how many runs a command spawns.

#### Scenario: Council footer
- **WHEN** a five-model council runs
- **THEN** the footer still shows exactly the architect-side and builder-side cells
