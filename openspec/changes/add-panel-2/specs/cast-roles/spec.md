# Cast Roles Specification

## Purpose

Define `PANEL_2` as a first-class multi-pick cast role alongside `PANEL`: known-role registration, cast-sheet UX, CSV model expansion, and project-cast persistence.

## Requirements

### Requirement: PANEL_2 Is a Known Cast Role

The system MUST register `PANEL_2` as a known role with side, color, and glyph mappings consistent with the architect-side panel family.

The system MUST include `PANEL_2` in `KNOWN_ROLES` and in the `Role` type (or equivalent role union used by the harness).

The system MUST assign `PANEL_2` to the `architect` side.

The system MUST assign `PANEL_2` a color in the same panel family as `PANEL` (`mdLink` unless design documents a deliberate alternate).

The system MUST assign `PANEL_2` a glyph that is distinct from `PANEL`'s glyph (proposal default: `☷` vs `☰`).

The README glyph / casting documentation MUST list `PANEL_2` with its glyph.

#### Scenario: Role appears in full cast sheet

- GIVEN the harness is running in TUI mode
- WHEN the operator opens `/roles`
- THEN `PANEL_2` appears as a cast row among known roles
- AND the row uses the registered glyph/color family for panel roles

#### Scenario: Presentation defaults

- GIVEN `PANEL_2` is registered
- WHEN role metadata is inspected
- THEN `ROLE_SIDE["PANEL_2"]` is `architect`
- AND `ROLE_COLOR["PANEL_2"]` is `mdLink` (or the design-approved panel-family color)
- AND `ROLE_GLYPH["PANEL_2"]` is not equal to `ROLE_GLYPH["PANEL"]`

### Requirement: PANEL_2 Is Multi-Pick Like PANEL

The system MUST treat both `PANEL` and `PANEL_2` as multi-pick roles.

`MULTI_PICK_ROLES` MUST equal `["PANEL", "PANEL_2"]` (order: `PANEL` then `PANEL_2`).

`expandCastModels` MUST CSV-split the cast model string for every role in `MULTI_PICK_ROLES`, returning trimmed non-empty `provider/id` parts in cast order.

For non-multi-pick roles, `expandCastModels` MUST continue to return at most one model string (existing single-pick behavior).

Cast sheet rows for roles in `MULTI_PICK_ROLES` MUST use multi-pick UX (toggle / Space / Enter drill), including when opened via `/roles` or a command cast gate that includes either role.

#### Scenario: MULTI_PICK_ROLES membership

- GIVEN the harness role constants
- WHEN `MULTI_PICK_ROLES` is inspected
- THEN it contains exactly `PANEL` and `PANEL_2`
- AND `PANEL` appears before `PANEL_2`

#### Scenario: expandCastModels for PANEL_2

- GIVEN cast model string `"prov/a, prov/b,prov/c"` for role `PANEL_2`
- WHEN `expandCastModels("PANEL_2", that string)` runs
- THEN the result is `["prov/a", "prov/b", "prov/c"]`

#### Scenario: Cast sheet multi-pick row

- GIVEN a command cast gate or `/roles` sheet that includes `PANEL_2`
- WHEN the sheet renders
- THEN `PANEL_2` is presented as a multi-pick row (same interaction model as `PANEL`)

### Requirement: Project Cast Persists PANEL_2

The system MUST allow `.fusion-harness.json` to store `PANEL_2: { model, thinking? }` through existing known-role load/save filtering.

Unknown roles MUST continue to be ignored on load/save.

After rollback that removes `PANEL_2` from `KNOWN_ROLES`, a leftover `PANEL_2` key MUST become inert (dropped on load/save) with no migration required.

#### Scenario: Round-trip PANEL_2 in project cast

- GIVEN a project cast file that includes a valid `PANEL_2` entry with model and optional thinking
- WHEN the harness loads the project cast and later saves the cast
- THEN the saved file still contains `PANEL_2` with the same model (and thinking if set)

#### Scenario: Unknown key remains filtered

- GIVEN a project cast file that contains both `PANEL_2` (known) and an unknown role key
- WHEN the cast is loaded
- THEN `PANEL_2` is applied
- AND the unknown key is ignored
