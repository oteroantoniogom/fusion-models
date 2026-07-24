# parallel-command

## ADDED Requirements

### Requirement: `/parallel` command registration and usage

The harness SHALL register a `/parallel <prompt>` command. Invoked without a prompt it SHALL print usage and do nothing else.

#### Scenario: Usage without prompt
- **WHEN** the user runs `/parallel` with no prompt
- **THEN** a usage notice is shown and no agent is spawned

### Requirement: Two-way full-tool fan-out with no merge

`/parallel` SHALL spawn the architect-side and builder-side cast models in parallel, both with full tools (read, grep, find, ls, bash, edit, write), both receiving only the user's prompt, and SHALL render both complete results side by side. It SHALL NOT spawn any merge, fusion, or judge stage.

#### Scenario: Build-off
- **WHEN** the user runs `/parallel <prompt>`
- **THEN** both agents work concurrently with full tools and the final panel shows both results with per-agent stats (model, latency, tokens, cost) and no merged output exists

#### Scenario: Sessions match the shipped defaults
- **WHEN** `/parallel` runs with the default cast
- **THEN** the architect-side child uses its pinned role session and the builder-side child uses the same host-fork spawn rules as `/fusion`'s builder

### Requirement: Independent failure rendering

Each agent's result SHALL render independently: one agent's failure SHALL NOT suppress the other's output.

#### Scenario: One side fails
- **WHEN** exactly one agent fails
- **THEN** the panel renders the survivor's full result plus the failure naming role, model, and error
