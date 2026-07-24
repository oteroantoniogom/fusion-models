# chain-composer

## ADDED Requirements

### Requirement: `/chain` command registration and usage

The harness SHALL register a `/chain <stages> <prompt>` command, where `<stages>` is a comma-separated ordered list of named stages from the set `{ deliberate, gate, decompose, build, verify, harden, integrate }`. The command SHALL refuse unknown stage names. Invoked without a prompt it SHALL print usage and do nothing else.

#### Scenario: Valid chain
- **WHEN** the user runs `/chain gate,build,verify <prompt>`
- **THEN** GATE-FIRST, BUILD, and VERIFY execute in that order over one shared artifacts dir

#### Scenario: Unknown stage
- **WHEN** the user runs `/chain gate,frobnicate,build <prompt>`
- **THEN** the command fails loudly with the unknown name and the accepted set, and no spawn occurs

### Requirement: Prerequisite validation

Each named stage SHALL declare required input files in the artifacts dir (e.g. `build` requires `subtasks.json`; `verify` requires `gate.py`; `integrate` requires `plan.md`). Before any spawn, the chain SHALL verify that every required file is either produced by an earlier stage in the same chain OR already present in the dir (a chain run with leftover files from a prior campaign is permitted). On missing prerequisites, the command SHALL fail loudly with a list of every missing file mapped to its requiring stage, and SHALL NOT spawn.

#### Scenario: Missing prerequisite
- **WHEN** the user runs `/chain build,verify <prompt>` on an empty artifacts dir
- **THEN** the command fails with `subtasks.json` and `gate.py` listed as missing and no spawn occurs

#### Scenario: Prerequisite satisfied by a prior stage
- **WHEN** the user runs `/chain deliberate,gate,decompose,build,verify,harden,integrate <prompt>`
- **THEN** every required file is produced in order and the chain runs to completion

#### Scenario: Prerequisite satisfied by leftover artifacts
- **WHEN** the user runs `/chain verify,integrate <prompt>` in a dir that already contains `plan.md`, `gate.py`, and `subtasks.json` from a prior run
- **THEN** validation passes and the chain runs

### Requirement: Shared conductor, cast sheet, and board

`/chain` SHALL run the same extracted stage functions, open the same cast sheet (rows = the union of roles required by stages in the chain), and render the same campaign board (now listing only the chosen stages). Halting, escape, `--cast-defaults`, and the sheet's SAVE behavior SHALL match `/gauntlet`.

#### Scenario: Cast sheet union
- **WHEN** the user runs `/chain deliberate,verify <prompt>`
- **THEN** the cast sheet shows the union of roles required (e.g. PANEL + CHAIRMAN + VALIDATOR)

#### Scenario: Halt on stage failure
- **WHEN** a stage in the chain fails its success criteria
- **THEN** the chain halts with the same panel as a halted `/gauntlet`

### Requirement: `/gauntlet` is the canonical preset

The command `/gauntlet <prompt>` (with no stage list) SHALL be equivalent to running `/chain deliberate,gate,decompose,build,verify,harden,integrate <prompt>` over a fresh campaign dir. Gauntlet-specific flags (`--skip-council`, `--skip-redteam`, `--deliberate`, `--resume`) SHALL be expressible as chain arguments or restricted to `/gauntlet` only; the shared behavior SHALL not diverge.

#### Scenario: Equivalence
- **WHEN** a user runs `/gauntlet <prompt>` and another user runs `/chain deliberate,gate,decompose,build,verify,harden,integrate <prompt>` on the same prompt
- **THEN** both runs traverse the same stages in the same order with the same halt semantics
