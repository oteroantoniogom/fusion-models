# model-preflight

**Purpose:** Validate that every cast member is resolvable and has configured credentials before any command side effect occurs, avoiding partial failures and wasted API calls.

## Requirements

### Requirement: Pre-spawn model resolution check

Before any casted command creates an artifacts directory or spawns a child, the harness SHALL resolve every model in the command's declared cast via `ctx.modelRegistry.find(provider, id)`. A model that does not resolve SHALL abort the command before any side effect.

#### Scenario: Unresolvable model aborts early
- **WHEN** a casted command is invoked with a cast model string that the registry cannot resolve (typo, unknown provider, catalog-lagged id)
- **THEN** the command stops before spawning any child or minting an artifacts directory, and renders a failure panel naming the role, the offending string, and the remediation

#### Scenario: Remediation for unresolved ids
- **WHEN** the failure panel for an unresolvable model renders
- **THEN** it SHALL include a copy-pasteable `~/.pi/agent/models.json` stanza skeleton for adding the model under its provider, and note that freshly released models may require it

### Requirement: Pre-spawn auth check

For every cast model that resolves, the harness SHALL verify configured credentials via the registry (`hasConfiguredAuth` / provider auth status) before spawning. A model without configured auth SHALL abort the command before any side effect.

#### Scenario: Missing key aborts early
- **WHEN** a casted command's cast includes a model whose provider has no configured credential (e.g. `zai/glm-5.2` with no `ZAI_API_KEY` and no `auth.json` entry)
- **THEN** the command stops before spawning any child, and the failure panel names the role, the model, the exact `/login <provider>` command, and the environment variable that would satisfy it

### Requirement: All-or-nothing across the cast

Preflight SHALL validate the command's ENTIRE declared cast before the first spawn; the command SHALL NOT begin partial work with one valid and one invalid cast member.

#### Scenario: One bad row blocks the run
- **WHEN** a two-role command has one resolvable, authenticated model and one that fails preflight
- **THEN** no child is spawned for either role and a single failure panel covers every failing cast member

### Requirement: Registry error surfacing

When the model registry reports a catalog/refresh error, preflight SHALL surface that error distinctly from a plain resolution failure, since the cast model may be valid but the catalog stale.

#### Scenario: Catalog refresh failure
- **WHEN** the registry carries a refresh error at preflight time
- **THEN** the failure (or warning) output SHALL state that the model catalog failed to refresh, separate from any per-model resolution verdict

### Requirement: Headless parity

In non-interactive contexts, preflight SHALL still run and SHALL still abort on failure; remediation SHALL be emitted as plain text instead of a TUI panel.

#### Scenario: Headless failure output
- **WHEN** preflight fails in a non-TUI context
- **THEN** the command exits without side effects and prints the same role/model/remediation content as plain text

### Requirement: Successful preflight is silent and free

When every cast member resolves and is authenticated, preflight SHALL produce no panel or warning of its own and SHALL NOT spawn any process (validation is registry-local, no network calls beyond what the registry already performs).

#### Scenario: Clean run
- **WHEN** all cast models pass preflight
- **THEN** the command proceeds directly to its normal banner/spawn flow with no additional output
