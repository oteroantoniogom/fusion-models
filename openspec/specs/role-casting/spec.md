# role-casting

**Purpose:** Define how roles are mapped to models, how the cast is surfaced to the user for modification, and how it persists across commands and sessions.

## Requirements

### Requirement: Role→model cast map

The harness SHALL maintain a single cast map assigning a fully qualified `provider/id` model string to each named role (e.g. `ARCHITECT`, `BUILDER`, `FUSION`, `VALIDATOR`). The cast map SHALL be the only source of truth consulted by command handlers when spawning children. The map SHALL be seeded at startup from the `--architect` and `--builder` flags, falling back to the built-in defaults (`anthropic/claude-fable-5`, `openai/gpt-5.6-sol`).

#### Scenario: Default seeding
- **WHEN** pi starts with no `--architect` or `--builder` flags
- **THEN** the cast maps `ARCHITECT` to `anthropic/claude-fable-5` and `BUILDER` to `openai/gpt-5.6-sol`, and all derived roles (FUSION, VALIDATOR) resolve through the map as before

#### Scenario: Flag seeding
- **WHEN** pi starts with `--architect zai/glm-5.2 --builder opencode/some-model`
- **THEN** the cast maps `ARCHITECT` to `zai/glm-5.2` and `BUILDER` to `opencode/some-model`, and every spawned child receives those exact strings via `--model`

### Requirement: Cast sheet overlay on command invocation

Every casted command SHALL declare the roles it needs. On invocation in interactive (TUI) mode, the harness SHALL open a single-screen cast sheet overlay (a custom TUI component) listing one row per declared role — role name, current model, auth marker — pre-filled with the session cast, BEFORE any child is spawned or artifacts directory is created. The sheet SHALL support: keyboard navigation between rows, editing a row by drilling into a provider→model list (authenticated models first) with **type-to-filter fuzzy search**, manual `provider/id` entry, a thinking-level indicator per row cycleable with a keypress, a multi-pick row type for roles that accept several models, a SAVE action persisting the cast to the project file, a RUN action that confirms the whole sheet, and Esc cancellation. Confirming RUN SHALL update the session cast with any edited rows.

#### Scenario: Confirm defaults
- **WHEN** the user invokes a casted command and activates RUN without editing any row
- **THEN** the command runs with the session cast unchanged, and confirming took a single keystroke

#### Scenario: Override one row
- **WHEN** the user edits one row (e.g. assigns a different provider's model to the judge) and activates RUN
- **THEN** the command runs with that role on the newly selected model, and the session cast retains the selection for subsequent invocations

#### Scenario: Cancel before side effects
- **WHEN** the user presses Esc in the cast sheet
- **THEN** the command aborts before any child spawns and before any artifacts directory is created

#### Scenario: Rows carry auth status
- **WHEN** the cast sheet or a row's model list renders
- **THEN** each model SHALL display its provider and id plus an auth marker derived from the registry (authenticated vs. key missing), with authenticated models sorted before unauthenticated ones

#### Scenario: Manual entry for catalog-lagged models
- **WHEN** the user chooses manual entry on a row and types a literal `provider/id`
- **THEN** that string SHALL be used for the role (subject to model-preflight validation)

#### Scenario: Fuzzy filter in drill-down
- **WHEN** the user types inside a row's model list
- **THEN** the list filters to models whose provider/id matches the typed query, narrowing as they type

#### Scenario: Thinking level per row
- **WHEN** the user presses the thinking-cycle key on a row
- **THEN** the row's thinking level advances through the canonical levels (and an inherit-from-side state), and child spawns for that role use the displayed level

#### Scenario: SAVE persists the cast
- **WHEN** the user activates SAVE in the sheet
- **THEN** the current cast (roles, models, thinking overrides) is written to `<cwd>/.fusion-harness.json`

### Requirement: Quick-skip via `--cast-defaults`

Any casted command SHALL accept an inline `--cast-defaults` argument that skips the cast sheet for that invocation, running immediately with the current session cast.

#### Scenario: Skip the sheet once
- **WHEN** the user runs a casted command with `--cast-defaults`
- **THEN** no sheet opens, the command runs with the session cast, and the session cast is unchanged afterward

#### Scenario: Sheet still opens without the flag
- **WHEN** the same user later runs the command without `--cast-defaults`
- **THEN** the sheet opens pre-filled from the session cast as usual

### Requirement: Cast persistence (session + opt-in disk)

Cast mutations made through the sheet or `/roles` SHALL persist in memory for the remainder of the pi session. The cast SHALL be written to disk ONLY via the explicit SAVE action, to `<cwd>/.fusion-harness.json`. Boot seeding order SHALL be: built-in defaults → project file (if present) → boot flags (override file) → session mutations. Loading SHALL be forgiving: unknown roles ignored, unresolvable models left for preflight to catch at first use (never at boot).

#### Scenario: Picks survive across commands
- **WHEN** the user sets a role's model via one command's sheet and later invokes a different casted command sharing that role
- **THEN** the second command's sheet pre-fills that role with the earlier selection

#### Scenario: Project file seeds the next boot
- **WHEN** pi restarts in a project with a saved `.fusion-harness.json` and no model flags
- **THEN** the cast seeds from the file

#### Scenario: Flags beat the file
- **WHEN** pi starts with `--architect zai/glm-5.2` and the project file names a different architect model
- **THEN** the flag wins for that role

#### Scenario: Forgiving load
- **WHEN** the project file contains an unknown role or an unresolvable model
- **THEN** boot succeeds (unknown roles ignored), and the unresolvable model is reported by preflight at first casted command, not at startup

### Requirement: `/roles` command

The harness SHALL register a `/roles` command that opens the same cast sheet outside any run, covering the full set of known roles, and prints the resulting session cast when done, including whether a project cast file exists and when it was last written.

#### Scenario: Review and set defaults
- **WHEN** the user runs `/roles` and changes one role's model
- **THEN** subsequent casted commands pre-fill from the updated cast, and `/roles` completion output lists every role with its current model and thinking level, plus the project-file state

### Requirement: Non-interactive fallback

When no interactive UI is available (headless/`--mode json`/print mode), the harness SHALL NOT open any dialog; the cast SHALL be exactly the flag-seeded map, and commands SHALL run without blocking.

#### Scenario: Headless invocation
- **WHEN** a casted command runs in a non-TUI context
- **THEN** no selection dialog appears and the command proceeds with the flag-seeded cast

### Requirement: Per-role thinking levels

Each role SHALL carry an optional thinking-level override. Boot flags (`--architect-thinking` / `--builder-thinking`) seed side-level defaults; a role without an override SHALL inherit its side's level. `/thinking` SHALL accept role names in addition to sides, and bare `/thinking` SHALL print side defaults plus any role overrides. Child spawns SHALL receive the role's resolved level via the existing `--thinking` child flag.

#### Scenario: Role override beats side default
- **WHEN** the JUDGE role has a `low` override and the architect side default is `max`
- **THEN** judge spawns run at `low` while architect-side spawns run at `max`

#### Scenario: Inherit when no override
- **WHEN** a role has no thinking override
- **THEN** its spawns use its side's current level, including mid-session `/thinking` side changes

#### Scenario: `/thinking` addresses roles
- **WHEN** the user runs `/thinking JUDGE low`
- **THEN** the JUDGE role carries a `low` override for the rest of the session, and bare `/thinking` lists it

### Requirement: Side-keyed behavior unchanged

The cast map SHALL NOT alter session pinning, footer layout, or host-fork behavior: role sessions remain pinned per project and per model, the footer keeps its architect-side / builder-side cells (reading their models from the cast), and the builder side retains the host-fork privilege.

#### Scenario: Model swap mints a fresh brain
- **WHEN** a role's model is changed mid-session via picker or `/roles`
- **THEN** the next spawn for that role uses the session directory pinned to the NEW model, and no transcript built under the previous model is replayed

#### Scenario: Existing recipes unaffected
- **WHEN** pi launches via `just fh-workhorse` or `just fh-sota` with no picker interaction
- **THEN** architect-side and builder-side children spawn with the recipe's models, sessions, and forks exactly as before this change
