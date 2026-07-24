# coordinate-command

## ADDED Requirements

### Requirement: `/coordinate` command registration and usage

The harness SHALL register a `/coordinate <prompt> [--no-fix-up]` command. Invoked without a prompt it SHALL print usage and do nothing else.

#### Scenario: Usage without prompt
- **WHEN** the user runs `/coordinate` with no prompt
- **THEN** a usage notice is shown and no agent is spawned

### Requirement: Manifest-driven decomposition

A COORDINATOR role (architect-side cast model, castable) SHALL first inspect the request with read-only-plus-write tools and decompose it into a `subtasks.json` manifest written by the coordinator itself to an absolute path inside the run's artifacts directory dictated by the harness. The manifest SHALL contain a `subtasks` array where each entry has `id`, `title`, `prompt`, `paths` (owned write-domain globs), and `dependsOn` (array of ids). The harness SHALL parse the manifest from the file, never from the coordinator's prose.

#### Scenario: Manifest via filesystem
- **WHEN** the coordinator stage completes
- **THEN** the harness reads `<artifactsDir>/subtasks.json` from disk and proceeds from its contents

#### Scenario: Missing or unparseable manifest
- **WHEN** the coordinator did not write the file or the file is not valid JSON matching the schema
- **THEN** the command fails loudly with the raw file content (or its absence) rendered, and no worker is spawned

#### Scenario: Every subtask declares a write domain
- **WHEN** the manifest is parsed
- **THEN** any subtask lacking a non-empty `paths` array causes the same loud failure as an invalid manifest

### Requirement: Level-scheduled workers

The harness SHALL execute subtasks in dependency levels derived from `dependsOn`: levels run sequentially; subtasks within one level run in parallel. Each worker SHALL be a fresh ephemeral builder-side session with full tools, receiving its subtask prompt plus its owned paths and an explicit prohibition on writing outside them.

#### Scenario: Dependency ordering
- **WHEN** subtask t2 lists `dependsOn: ["t1"]`
- **THEN** t2's worker starts only after t1's worker has completed

#### Scenario: Parallel within a level
- **WHEN** two subtasks share no dependency relationship
- **THEN** their workers run concurrently

#### Scenario: Write-domain contract in prompt
- **WHEN** a worker spawns
- **THEN** its prompt contains its owned paths verbatim and an instruction never to write outside them

### Requirement: Coordinator integration, verification, and one fix-up pass

After all workers settle, the COORDINATOR SHALL resume its planning session, receive per-subtask status and output digests (each truncated to the harness handoff cap), and verify the integrated result against the original request with read-only tools. When verification finds gaps, the coordinator SHALL get exactly one fix-up pass: it resumes with full tools to address the named gaps, then re-verifies with read-only tools and renders the final report. `--no-fix-up` SHALL disable the pass (report-only). There SHALL never be more than one fix-up pass per run.

#### Scenario: Integration report
- **WHEN** all workers are done
- **THEN** the coordinator re-enters its own session and its report covers each subtask's outcome and whether the original request is satisfied

#### Scenario: Fix-up pass on gaps
- **WHEN** verification names concrete gaps
- **THEN** the coordinator resumes once with full tools, addresses them, re-verifies read-only, and the final report states what the pass changed

#### Scenario: Clean verification skips fix-up
- **WHEN** verification finds no gaps
- **THEN** no full-tools pass spawns and the report renders immediately

#### Scenario: Fix-up disabled
- **WHEN** the user runs `/coordinate --no-fix-up <prompt>` and gaps exist
- **THEN** the gaps are reported with no attempt to fix them

#### Scenario: Worker failure surfaces, loop continues
- **WHEN** one worker fails while others succeed
- **THEN** surviving workers' results are kept, the integration report names the failed subtask and its error, and no automatic retry occurs

### Requirement: Stop handling

Killing the run SHALL stop scheduling further levels and render a stopped panel naming completed and pending subtasks.

#### Scenario: Escape between levels
- **WHEN** the user presses escape after level 1 of 3 completes
- **THEN** no level-2 worker spawns and the stopped panel lists which subtasks completed and which never ran
