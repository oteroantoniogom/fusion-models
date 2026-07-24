# council-command

## ADDED Requirements

### Requirement: `/council` command registration and usage

The harness SHALL register a `/council <prompt>` command. Invoked without a prompt it SHALL print usage and do nothing else.

#### Scenario: Usage without prompt
- **WHEN** the user runs `/council` with no prompt
- **THEN** a usage notice is shown and no agent is spawned

### Requirement: Panel casting

The PANEL SHALL be a cast row using the cast sheet's multi-pick (checkbox) row type, with a minimum of 2 checked panelists. The first two pre-checked defaults SHALL be the current architect-side and builder-side cast models. The CHAIRMAN SHALL be a separate cast row defaulting to the architect-side model.

#### Scenario: Multi-pick panel
- **WHEN** the council cast sheet renders
- **THEN** the user can check or uncheck panelists on the PANEL row and cannot confirm the sheet with fewer than 2 checked

#### Scenario: Defaults
- **WHEN** the user accepts all defaults
- **THEN** the panel is the current ARCHITECT and BUILDER models and the chairman is the ARCHITECT model

### Requirement: Independent answers

Stage 1 SHALL spawn every panelist in parallel with opinion-level tools, each in a fresh ephemeral session, each receiving only the user's prompt.

#### Scenario: Fresh brains
- **WHEN** stage 1 begins
- **THEN** no panelist's session contains any prior council's content or another panelist's history

### Requirement: Anonymized peer ranking

Stage 2 SHALL anonymize the panel answers as `Response A`, `Response B`, … (the letter→panelist mapping held by the harness, never shown to panelists), string-strip known panel model ids as best effort, and give every panelist the full anonymized set with a ranking contract: an ordered list of all letters, best first, with a one-line rationale each. Panel prompts SHALL forbid self-identification in answers.

#### Scenario: Anonymity
- **WHEN** a panelist receives the ranking prompt
- **THEN** no answer in it names its source model, and the panelist cannot tell which letter is its own from any harness-provided label

#### Scenario: Full ranking required
- **WHEN** a panelist returns a ranking that omits or duplicates letters
- **THEN** that panelist's ranking is excluded from aggregation and the exclusion is noted in the output

### Requirement: Aggregated rankings and chairman synthesis

The harness SHALL aggregate valid rankings with Borda count (no extra model call) and render the aggregate table. The CHAIRMAN SHALL then receive the original prompt, the anonymized answers, and the aggregate table on a fresh ephemeral session with read-only tools, and SHALL synthesize the final answer, explicitly noting where the panel was in consensus versus split.

#### Scenario: Deterministic aggregation
- **WHEN** all valid rankings are in
- **THEN** the aggregate table is computed by Borda count with no model involvement

#### Scenario: Chairman synthesis
- **WHEN** the chairman runs
- **THEN** its input contains the prompt, every anonymized answer, and the aggregate table, and its output names consensus and split points

### Requirement: Degraded operation

If a panelist fails in stage 1, the council SHALL continue with the survivors (minimum 2); if survivors drop below 2, the command SHALL fail loudly with whatever answers exist rendered.

#### Scenario: One panelist dies
- **WHEN** one of three panelists fails in stage 1
- **THEN** stages 2–3 proceed with the two survivors and the failure is named in the final output
