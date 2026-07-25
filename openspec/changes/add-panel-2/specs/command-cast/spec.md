# Command Cast Specification

## Purpose

Ensure command cast gates and preflight cover `PANEL_2` wherever council-style panelists are selected, so cast sheet and auth/resolution checks treat both multi-pick panel rows.

## Requirements

### Requirement: COMMAND_CAST Includes PANEL_2 for Council and Gauntlet

`COMMAND_CAST.council` MUST be `["PANEL", "PANEL_2", "CHAIRMAN"]` (PANEL before PANEL_2 before CHAIRMAN).

`COMMAND_CAST.gauntlet` MUST include `PANEL_2` alongside the existing gauntlet roles; `PANEL_2` MUST appear with the other panel/council roles (at minimum: present in the list with `PANEL` and `CHAIRMAN`).

Debate and other non-council command casts MUST remain unchanged by this capability.

When a command cast includes any multi-pick role, `runCastGate` MUST pass the full `MULTI_PICK_ROLES` set (`PANEL` and `PANEL_2`) into the cast sheet so both multi-pick rows appear.

#### Scenario: Council command cast list

- GIVEN the harness `COMMAND_CAST` table
- WHEN `COMMAND_CAST.council` is inspected
- THEN it equals `["PANEL", "PANEL_2", "CHAIRMAN"]`

#### Scenario: Gauntlet command cast includes PANEL_2

- GIVEN the harness `COMMAND_CAST` table
- WHEN `COMMAND_CAST.gauntlet` is inspected
- THEN the list includes `PANEL_2`
- AND it still includes `PANEL`, `CHAIRMAN`, `VALIDATOR`, `COORDINATOR`, `BUILDER`, and `ATTACKER`

#### Scenario: Cast gate shows both multi-pick rows

- GIVEN TUI mode and a `/council` (or gauntlet) invocation that opens the cast sheet
- WHEN the sheet opens because the command cast includes a multi-pick role
- THEN both `PANEL` and `PANEL_2` are multi-pick-capable rows in the sheet

### Requirement: Preflight Validates Every Model in PANEL and PANEL_2

`preflightCast` MUST expand each role with `expandCastModels` and resolve/auth-check every returned model.

For both `PANEL` and `PANEL_2`, every listed model MUST be validated; a failure on any model MUST fail preflight before spawn.

Empty contribution from `PANEL_2` (no models after expand) MUST NOT by itself invent an ARCHITECT fallback during preflight of `PANEL_2`.

Preflight failure messaging MUST remain clear enough for operators to identify which role/model failed (existing failure shape is acceptable if it includes role and model).

#### Scenario: Unresolved model in PANEL_2 fails preflight

- GIVEN `PANEL_2` lists a model that cannot be resolved or is unauthenticated
- WHEN preflight runs for roles including `PANEL_2`
- THEN preflight reports a failure for that role/model
- AND no council/gauntlet children are spawned

#### Scenario: Each CSV entry checked

- GIVEN `PANEL` is `"ok/a, bad/b"` and `PANEL_2` is `"ok/c"`
- WHEN preflight expands and checks both roles
- THEN `ok/a`, `bad/b`, and `ok/c` are each subject to resolution/auth checks
- AND any failing entry causes preflight to fail

### Requirement: Source Tests Cover Cast Membership and COMMAND_CAST

Focused source/unit tests (primary: `npx tsx tests/test-gauntlet.ts` and narrowly updated related suites) MUST assert:

- `MULTI_PICK_ROLES` membership includes both `PANEL` and `PANEL_2`
- `expandCastModels` CSV behavior for `PANEL_2`
- Updated `COMMAND_CAST.council` / `COMMAND_CAST.gauntlet` (and known-role list expectations where suites hard-code role counts)

E2E live provider runs MUST NOT be required as the primary verification path for this change.

#### Scenario: Structural tests lock COMMAND_CAST

- GIVEN the focused gauntlet/cast test suites
- WHEN they run without live providers
- THEN assertions fail if `COMMAND_CAST.council` omits `PANEL_2` or `COMMAND_CAST.gauntlet` omits `PANEL_2`
- AND assertions fail if `MULTI_PICK_ROLES` is only `["PANEL"]`
