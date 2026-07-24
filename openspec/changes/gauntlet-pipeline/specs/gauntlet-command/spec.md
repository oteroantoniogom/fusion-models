# gauntlet-command

## ADDED Requirements

### Requirement: `/gauntlet` command registration and usage

The harness SHALL register a `/gauntlet <prompt> [--skip-council] [--skip-redteam] [--deliberate=council|debate] [--resume [dir]]` command. Invoked without a prompt it SHALL print usage and do nothing else.

#### Scenario: Usage without prompt
- **WHEN** the user runs `/gauntlet` with no prompt
- **THEN** a usage notice is shown and no agent is spawned

### Requirement: Fixed stage order

The campaign SHALL run stages in this fixed order: DELIBERATE (council → `plan.md`), GATE-FIRST (validator → `gate.py`, baseline must fail RED), DECOMPOSE (coordinator → `subtasks.json`), BUILD (worker dependency levels), VERIFY (gate correction loop until green or halt), HARDEN (redteam sorties until CONCEDE or cap), INTEGRATE (coordinator report against `plan.md`). No stage may be skipped except via the two declared flags.

#### Scenario: Full campaign order
- **WHEN** the user runs `/gauntlet <prompt>` with no flags
- **THEN** stages execute in the fixed order and each stage starts only after the previous stage's success criteria are met

#### Scenario: Skip council
- **WHEN** the user runs `/gauntlet --skip-council <prompt>`
- **THEN** the harness writes the prompt verbatim as `plan.md`, the council stage is omitted, and every downstream stage proceeds unchanged

#### Scenario: Skip redteam
- **WHEN** the user runs `/gauntlet --skip-redteam <prompt>`
- **THEN** the campaign jumps from VERIFY-green directly to INTEGRATE

### Requirement: Single campaign artifacts dir with file handoffs

All stage artifacts SHALL live in one `gauntlet-*` artifacts directory. Cross-stage contracts SHALL flow through files (`plan.md`, `gate.py`, `subtasks.json`); agent context SHALL additionally flow through capped digest injection into prompts. No stage SHALL parse another stage's agent prose (the strict redteam verdict line excepted).

#### Scenario: One dir
- **WHEN** a campaign runs
- **THEN** `plan.md`, `gate.py`, `subtasks.json`, round outputs, and verdicts all appear in the same artifacts directory

#### Scenario: Plan digest to validator and coordinator
- **WHEN** the validator or coordinator stage begins
- **THEN** its prompt contains a handoff-capped digest of `plan.md` in addition to the original prompt

### Requirement: Stage internals shared with standalone commands

Each campaign stage SHALL invoke the same extracted stage function as its standalone command counterpart (`/council`, `/auto-validate`, `/coordinate`, `/redteam`), with identical prompt contracts and tool ceilings.

#### Scenario: No drift
- **WHEN** the DELIBERATE stage runs
- **THEN** it executes the identical council stage functions (answers, anonymized ranking, chairman synthesis) that `/council` executes

### Requirement: Session discipline across stages

The validator and coordinator SHALL share the pinned architect-side role session; the VERIFY and HARDEN builder SHALL use the host-fork spawn; council panelists and build workers SHALL use fresh ephemeral sessions; the attacker SHALL resume its session across sorties within HARDEN.

#### Scenario: Architect brain accrues
- **WHEN** the campaign reaches INTEGRATE
- **THEN** the coordinator's session contains its own DECOMPOSE-stage planning context

### Requirement: Cast sheet as pre-run confirm gate

In interactive mode the cast sheet SHALL open before any spawn, showing every campaign role row (PANEL multi-pick, CHAIRMAN, VALIDATOR, COORDINATOR, WORKERS, ATTACKER) plus the ordered stage list reflecting the skip flags; RUN starts the campaign, Esc aborts with zero side effects.

#### Scenario: Full-cast confirmation
- **WHEN** the user invokes `/gauntlet` interactively
- **THEN** one sheet shows all role rows and the stage list, and nothing spawns before RUN

### Requirement: Alternate deliberation via `--deliberate`

When `--deliberate=debate` is passed, the DELIBERATE stage SHALL run a debate (rounds + anonymized judge verdict) and save the verdict text verbatim as `plan.md`. The default (no flag) SHALL be council. Validator and coordinator stages consume `plan.md` regardless of which deliberation produced it, so the downstream contract is unchanged.

#### Scenario: Debate as deliberation
- **WHEN** the user runs `/gauntlet --deliberate=debate <prompt>`
- **THEN** DELIBERATE runs a debate and the judge's verdict text becomes `plan.md` for the validator and coordinator stages

### Requirement: Cross-campaign resume via `--resume`

Each stage SHALL write its outcome to `state.json` in the campaign dir (stage name, status, artifact paths, timestamps, prompt, cast snapshot, accumulated stats). When `--resume` is passed (optionally with a campaign dir path; default = latest `gauntlet-*` dir in `/tmp`), the harness SHALL load `state.json`, pre-fill the cast sheet from the stored cast, and run the campaign starting at the first non-`done` stage, reusing every completed stage's artifacts. Escape, halt-on-failure, and the sheet's RUN/Esc semantics all apply the same on resume.

#### Scenario: Resume a halted campaign
- **WHEN** a previous `/gauntlet` halted at VERIFY and the user runs `/gauntlet --resume`
- **THEN** the campaign continues from VERIFY with `plan.md`, `gate.py`, and `subtasks.json` already in the dir, and the cast sheet pre-fills from the stored cast

#### Scenario: Unknown resume dir
- **WHEN** `--resume` is passed with a path that has no `state.json` or does not exist
- **THEN** the command fails loudly before any spawn with the path and the reason

### Requirement: Halt semantics

A stage failing its success criteria SHALL halt the campaign immediately with a loud panel naming the failed stage, the completed stages, and the artifacts dir. Escape SHALL abort the current stage and halt the campaign the same way. A halted campaign SHALL NOT auto-resume.

#### Scenario: Gate never goes green
- **WHEN** VERIFY exhausts its validation cap
- **THEN** the campaign halts with the last gate output, names BUILD..VERIFY as the failing region, and HARDEN never starts

#### Scenario: Escape during BUILD
- **WHEN** the user presses escape mid-BUILD
- **THEN** no further workers or stages spawn and the halt panel lists completed subtasks and stages
