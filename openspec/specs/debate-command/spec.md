# debate-command

**Purpose:** Provide structured multi-round debate between two sides with a judge verdict, supporting early-stop convergence and anonymized transcripts.

## Requirements

### Requirement: `/debate` command registration and usage

The harness SHALL register a `/debate <prompt> [--rounds N] [--reveal] [--no-early-stop]` command. Invoked without a prompt it SHALL print usage and do nothing else. `--rounds N` SHALL be parsed inline (default 2, clamped to 1–5) and SHALL count total exchanges: round 1 is opening answers, rounds 2+ are rebuttals.

#### Scenario: Usage without prompt
- **WHEN** the user runs `/debate` with no prompt
- **THEN** a usage notice is shown and no agent is spawned

#### Scenario: Rounds parsing
- **WHEN** the user runs `/debate --rounds 3 <prompt>`
- **THEN** the debate runs exactly 3 exchanges before the verdict, and the banner shows the round count

### Requirement: Opening round

Round 1 SHALL spawn the two debaters (architect-side and builder-side cast models) in parallel, each with opinion-level tools (read, grep, find, ls, bash), each answering the prompt independently.

#### Scenario: Independent openings
- **WHEN** round 1 begins
- **THEN** both debaters receive only the user's prompt (no sight of each other), run concurrently, and their answers render in the two-column layout

### Requirement: Rebuttal rounds resume pinned sessions

Each rebuttal round SHALL resume each debater's pinned role session, injecting the opponent's previous answer (truncated to the harness handoff cap) with a rebuttal instruction, so each debater's context accrues across rounds.

#### Scenario: Context accrual
- **WHEN** round 2 begins
- **THEN** each debater's spawn resumes the session that produced its round-1 answer and contains the opponent's round-1 answer

#### Scenario: Handoff truncation
- **WHEN** an opponent answer exceeds the handoff cap
- **THEN** the injected copy is truncated to the cap before being added to the prompt

### Requirement: Early-stop convergence check

After each rebuttal round, the harness SHALL run a convergence check unless `--no-early-stop` was passed: a cheap spawn of the judge-side model with read-only tools reads both debaters' latest answers and MUST end with a strict final line of `CONVERGED` or `DIVERGED`. CONVERGED SHALL skip all remaining rounds and proceed directly to the verdict. DIVERGED SHALL continue the debate. An unparseable or missing line SHALL count as DIVERGED (the debate is never silently truncated).

#### Scenario: Converged early
- **WHEN** the convergence check after round 2 of 4 returns `CONVERGED`
- **THEN** rounds 3–4 are skipped and the judge verdict runs immediately

#### Scenario: Parse failure is safe
- **WHEN** a convergence check ends without a parseable final line
- **THEN** the debate continues to the next round as if DIVERGED were returned

#### Scenario: Opt-out
- **WHEN** the user runs `/debate --no-early-stop <prompt>`
- **THEN** no convergence checks spawn and all rounds run

### Requirement: Judge verdict

After the final round, a JUDGE role (a cast row, defaulting to the architect-side model) SHALL receive the original prompt and the full debate transcript on a fresh ephemeral session with read-only tools, and SHALL render a verdict containing: the winner, the strongest argument on each side, and what evidence would change the verdict. The transcript SHALL be anonymized as `Debater A` / `Debater B` by default (mapping held by the harness, known model-id strings stripped); `--reveal` SHALL present true identities instead.

#### Scenario: Fresh judge brain
- **WHEN** the verdict stage begins
- **THEN** the judge spawns in a new ephemeral session that contains neither debater's history

#### Scenario: Anonymized by default
- **WHEN** the judge receives the transcript without `--reveal`
- **THEN** debaters appear only as Debater A and Debater B, with no model or provider names visible

#### Scenario: Reveal mode
- **WHEN** the user runs `/debate --reveal <prompt>`
- **THEN** the judge's transcript names the actual roles and models

#### Scenario: Castable judge
- **WHEN** the user assigns a different provider's model to the JUDGE row in the cast sheet
- **THEN** the verdict stage spawns exactly that model

### Requirement: Failure and stop handling

Killing the run (escape) SHALL stop spawning further rounds and render a stopped panel naming what completed. A debater failure SHALL still render the partial transcript and the failure, and SHALL NOT spawn the judge unless at least one full exchange completed successfully.

#### Scenario: Escape mid-round
- **WHEN** the user presses escape during round 2 of 3
- **THEN** no further rounds or judge are spawned and the stopped panel names the completed rounds

#### Scenario: One debater dies in round 1
- **WHEN** exactly one debater fails in the opening round
- **THEN** the panel renders the surviving answer plus the failure, and no judge verdict is attempted
