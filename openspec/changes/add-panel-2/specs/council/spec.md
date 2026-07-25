# Council Specification

## Purpose

Define how `/council` builds its panelist pool from `PANEL` and `PANEL_2`, and how runtime display/thinking attribute each child to its cast source role—while keeping a single council pipeline and an unchanged `CHAIRMAN`.

## Requirements

### Requirement: Combined Deduped Panelist Pool

For `/council`, the system MUST build the panelist list as the deduped union of expanded `PANEL` and `PANEL_2` models.

The system MUST expand `PANEL` and `PANEL_2` independently via `expandCastModels`.

Ordering MUST be: all `PANEL` models in cast order, then `PANEL_2` models that are not already present.

Dedupe MUST use exact `provider/id` string equality; the first occurrence MUST win.

The system MUST require at least 2 total panelists after merge before spawning council children.

When the merged pool has fewer than 2 panelists, the system MUST fail closed with an operator-visible error that mentions setting `PANEL` and/or `PANEL_2` (e.g. via `/roles`).

**PANEL fallback:** when `PANEL` is empty/unset, the system MUST fall back to `castModel("ARCHITECT")` for the `PANEL` contribution (same as today).

**PANEL_2 empty contribution:** when `PANEL_2` is missing or empty, it MUST contribute zero models and MUST NOT fall back to `ARCHITECT`.

`CHAIRMAN` MUST remain a single-pick role and MUST NOT participate in the panelist pool merge.

Ranking, Borda aggregation, and chairman synthesis MUST operate on the combined survivor set as one council (not two sequential councils).

Shared council prompt files (`USER_PROMPT_COUNCIL_*`) MUST remain unchanged for this change.

#### Scenario: Merge PANEL then PANEL_2 with dedupe

- GIVEN `PANEL` cast models `["a/x", "b/y"]` and `PANEL_2` cast models `["b/y", "c/z"]`
- WHEN `/council` builds the panelist pool
- THEN the ordered pool is `["a/x", "b/y", "c/z"]`
- AND `b/y` appears only once (PANEL wins)

#### Scenario: Empty PANEL_2 does not break a valid PANEL

- GIVEN `PANEL` has at least two distinct models and `PANEL_2` is unset or empty
- WHEN `/council <prompt>` runs with a valid cast gate
- THEN the council proceeds using only the `PANEL` models
- AND no error is raised solely because `PANEL_2` is empty

#### Scenario: PANEL falls back to ARCHITECT; PANEL_2 does not

- GIVEN `PANEL` is unset/empty, `ARCHITECT` is `prov/arch`, and `PANEL_2` is unset/empty
- WHEN the panelist pool is built
- THEN the `PANEL` contribution is `[prov/arch]`
- AND the `PANEL_2` contribution is `[]`
- AND if the merged total is still `< 2`, council MUST refuse to start

#### Scenario: Minimum two panelists after merge

- GIVEN merged unique panelists number fewer than 2
- WHEN the operator invokes `/council <prompt>`
- THEN no panelist children are spawned for a full council run
- AND the operator sees an error referencing `PANEL` and/or `PANEL_2`

#### Scenario: Single combined council

- GIVEN a merged pool of three or more models from both roles
- WHEN council completes answer → rank → Borda → chairman
- THEN there is one anonymized ranking and one chairman synthesis over the combined survivors
- AND the system does not run a separate second council solely for `PANEL_2`

### Requirement: Runtime Role Reflects Cast Source

Each panelist `AgentRun` MUST set `role` to the cast source that contributed that model (`PANEL` or `PANEL_2`), so live widget/footer glyphs and colors match the source row.

When the same model would appear in both rows, only the first (PANEL) occurrence runs; its `AgentRun.role` MUST be `PANEL`.

Child thinking for panel answer and ranking stages MUST use `castThinking` for the source role (`PANEL` or `PANEL_2`) of that run.

`CHAIRMAN` thinking MUST continue to use `castThinking("CHAIRMAN")`.

#### Scenario: Widget shows PANEL_2 glyph for PANEL_2-sourced runs

- GIVEN a panelist contributed only from `PANEL_2`
- WHEN that child is live or listed in council UI chrome
- THEN `AgentRun.role` is `PANEL_2`
- AND displayed glyph/color match `PANEL_2` role metadata

#### Scenario: Per-source thinking

- GIVEN `PANEL` thinking override differs from `PANEL_2` thinking override
- WHEN panelist children spawn for models from each source
- THEN each child uses `castThinking` of its source role
