# redteam-command

**Purpose:** Provide adversarial build/attack loops where a builder creates and an attacker probes, with session-accrued sorties and strict verdict parsing.

## Requirements

### Requirement: `/redteam` command registration and usage

The harness SHALL register a `/redteam <prompt> [--rounds N]` command. Invoked without a prompt it SHALL print usage and do nothing else. `--rounds N` (default 3, clamped 1–8) SHALL cap attack/patch cycles.

#### Scenario: Usage without prompt
- **WHEN** the user runs `/redteam` with no prompt
- **THEN** a usage notice is shown and no agent is spawned

### Requirement: Build then attack

The BUILDER (builder-side cast model) SHALL first build the request with full tools via the host-fork spawn (same alter-ego rules as `/auto-validate`). The ATTACKER (architect-side cast model, castable) SHALL then probe the built result with opinion-level tools (read, grep, find, ls, bash) and SHALL hold no write or edit tools.

#### Scenario: Builder first
- **WHEN** the user runs `/redteam <prompt>`
- **THEN** the builder completes before any attacker spawns, using the same host-fork spawn rules as `/auto-validate`'s builder

#### Scenario: Attacker tool ceiling
- **WHEN** the attacker spawns
- **THEN** its tool set contains no write/edit tools

### Requirement: Strict verdict line

Every attacker sortie SHALL end with a final line of exactly `VERDICT: BREACH — <summary>` or `VERDICT: CONCEDE — <summary>`, parsed by the harness with a line regex. A missing verdict SHALL retry the attacker once; a second consecutive miss SHALL halt the loop loudly with the raw sortie output rendered.

#### Scenario: Breach loops back
- **WHEN** a sortie ends with `VERDICT: BREACH — …`
- **THEN** the breach report feeds verbatim into the builder's resumed session for a patch, consuming one round

#### Scenario: Concede ends green
- **WHEN** a sortie ends with `VERDICT: CONCEDE — …`
- **THEN** the loop ends with a success panel regardless of remaining rounds

#### Scenario: Missing verdict
- **WHEN** a sortie ends without a parseable verdict line twice in a row
- **THEN** the loop halts with the raw sortie output rendered loudly

### Requirement: Sessions accrue across sorties

Both builder and attacker SHALL resume their respective sessions across rounds, so patch context and attack history accumulate within the run.

#### Scenario: Attacker memory
- **WHEN** sortie 2 begins
- **THEN** the attacker's session contains its sortie-1 probes and the builder's patch summary

### Requirement: Cap and stop handling

Reaching the round cap with the last verdict still BREACH SHALL halt with the last breach report rendered loudly (no silent infinite loop). Killing the run SHALL stop spawning further sorties and render a stopped panel naming the round reached.

#### Scenario: Cap hit
- **WHEN** the final round's verdict is still BREACH
- **THEN** the command halts with the last breach report and the round count in the failure panel
