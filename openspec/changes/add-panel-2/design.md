# Design: Add PANEL_2 multi-pick role

**Change:** `add-panel-2`  
**Status:** design  
**Date:** 2026-07-25  
**Baseline:** Implement atop current uncommitted harness WIP in `extensions/fusion-harness/fusion-harness.ts` (multi-pick cast sheet, `@file` prompt offload, ASCII cast-sheet layout). Do not regress those behaviors.

## Goals

1. Register `PANEL_2` as a first-class multi-pick cast role (glyphs, colors, side, persistence).
2. Merge `PANEL ∪ PANEL_2` into one council panelist pool (order + dedupe) for `/council` and gauntlet/chain council deliberate.
3. Attribute each panelist `AgentRun` (and thinking) to its cast **source** role.
4. Update cast gates, stage roles, README, and hard-coded test assertions in lockstep.

## Locked decisions

| Decision | Choice |
|----------|--------|
| Glyph | `☷` (distinct from `PANEL`'s `☰`) |
| Color | `mdLink` (same panel family as `PANEL`) |
| Side | `architect` |
| Live widget label | Full role name `PANEL_2` (no shortened alias) |
| Council semantics | Single combined council (rejected: dual/sequential councils) |
| Shared pool builder | Module-level `collectPanelModels` used by `/council` **and** gauntlet council deliberate |
| `PANEL` empty | Fallback to `castModel("ARCHITECT")` (unchanged) |
| `PANEL_2` empty | Contribute `[]` — **never** call `castModel("PANEL_2")` for pool building |
| Dedupe key | Exact `provider/id` string; first occurrence wins |
| Min panelists | ≥ 2 after merge; fail closed before spawn |
| Prompts | No new / changed `USER_PROMPT_COUNCIL_*` files |
| Borda alphabet | Keep A–Z (26) cap; document only |

## Architecture

```
Cast (.fusion-harness.json / cast sheet)
  PANEL   (CSV multi-pick) ──┐
  PANEL_2 (CSV multi-pick) ──┼──► collectPanelModels(cast, castModel)
  ARCHITECT (PANEL fallback)─┘         │
                                       ▼
                    [{ model, role: "PANEL"|"PANEL_2" }, ...]
                                       │
              ┌────────────────────────┼────────────────────────┐
              ▼                        ▼                        ▼
         /council              gauntlet deliberate         preflight /
                               (council mode)              expandCastModels
              │                        │
              └──────────┬─────────────┘
                         ▼
              answer → rank → Borda → CHAIRMAN
              AgentRun.role = source role
              castThinking(source role)
```

## Helper contract: `collectPanelModels`

Place next to `expandCastModels` (module scope, pure):

```ts
type PanelSourceRole = "PANEL" | "PANEL_2";
type PanelistEntry = { model: string; role: PanelSourceRole };

function collectPanelModels(
  cast: Cast,
  castModel: (role: Role) => string,
): PanelistEntry[] {
  const panelRaw = cast["PANEL"]?.model ?? castModel("ARCHITECT");
  const panel2Raw = cast["PANEL_2"]?.model ?? ""; // empty → zero contribution
  const fromPanel = expandCastModels("PANEL", panelRaw);
  const fromPanel2 = expandCastModels("PANEL_2", panel2Raw);
  const seen = new Set<string>();
  const out: PanelistEntry[] = [];
  for (const model of fromPanel) {
    if (seen.has(model)) continue;
    seen.add(model);
    out.push({ model, role: "PANEL" });
  }
  for (const model of fromPanel2) {
    if (seen.has(model)) continue;
    seen.add(model);
    out.push({ model, role: "PANEL_2" });
  }
  return out;
}
```

### Rules (normative)

1. Expand each role independently via `expandCastModels`.
2. Order: all unique `PANEL` models (cast CSV order), then `PANEL_2` models not already present.
3. Intra-role CSV duplicates: first occurrence wins (same `seen` set).
4. Cross-role overlap: `PANEL` wins; surviving entry keeps `role: "PANEL"`.
5. **Critical:** do not use `castModel("PANEL_2")` when unset — that would inherit ARCHITECT via `ROLE_SIDE` and violate the empty-contribution rule.
6. Caller checks `out.length < 2` and fails with copy mentioning `PANEL` and/or `PANEL_2` (e.g. via `/roles`).

## Data flow changes

### Role registry

In `fusion-harness.ts`:

- `KNOWN_ROLES`: insert `"PANEL_2"` immediately after `"PANEL"` (length **12**).
- `Role` union: add `"PANEL_2"`.
- `ROLE_SIDE["PANEL_2"] = "architect"`.
- `ROLE_COLOR["PANEL_2"] = "mdLink"`.
- `ROLE_GLYPH["PANEL_2"] = "☷"`.
- `MULTI_PICK_ROLES = ["PANEL", "PANEL_2"]` (PANEL first).

Persistence already filters by `KNOWN_ROLES` on load/save — no schema migration. Rollback drops unknown `PANEL_2` keys automatically.

### Cast gates / stage roles

```ts
COMMAND_CAST.council = ["PANEL", "PANEL_2", "CHAIRMAN"];
COMMAND_CAST.gauntlet = [
  "PANEL", "PANEL_2", "CHAIRMAN",
  "VALIDATOR", "COORDINATOR", "BUILDER", "ATTACKER",
]; // 7 roles
```

`stageRoles` deliberate case: also `roles.add("PANEL_2")` alongside existing PANEL / CHAIRMAN / debate roles.

`runCastGate` already expands `multiPick` to full `MULTI_PICK_ROLES` when any command role is multi-pick — both rows appear once either is in the command cast. No structural change beyond membership.

`preflightCast` already loops `expandCastModels` per role — covering `PANEL_2` once it is in the role list. Empty `PANEL_2` expands to `[]` and does not invent an ARCHITECT check.

### `/council` handler

Replace:

```ts
expandCastModels("PANEL", cast["PANEL"]?.model ?? castModel("ARCHITECT"))
```

with:

```ts
const panelists = collectPanelModels(cast, castModel);
if (panelists.length < 2) {
  ctx.ui.notify(
    "Council requires at least 2 panelists. Use /roles to set PANEL and/or PANEL_2 (multi-pick).",
    "error",
  );
  return;
}
```

Then:

- Banner / sources: map `panelists` → `{ role, model }` (source role, not hard-coded `"PANEL"`).
- Answer runs: `newRun(entry.role, entry.model)` + `thinking: castThinking(entry.role)`.
- Rank runs (survivors): preserve source role from the matching answer run (`panelRuns[idx].role`), then `castThinking(thatRole)`.
- `CHAIRMAN` unchanged: `castThinking("CHAIRMAN")`.
- Shared prompt markdown files unchanged.

### Gauntlet / chain council deliberate

In the council branch (not debate):

```ts
const panelists = collectPanelModels(cast, castModel);
if (panelists.length < 2) { /* fail stage closed — same min rule */ }
await councilPipeline({ ..., panelists, chairmanModel: castModel("CHAIRMAN"), ... });
```

### Shared stage helpers (`councilPanelAnswers`, `councilRanking`, `councilPipeline`)

Today these take `panelModels: string[]` and hard-code `newRun("PANEL", m)` / thinking `"medium"` (pipeline) or caller-side `castThinking("PANEL")` (standalone).

**Change:** accept `panelists: PanelistEntry[]` (or keep `panelModels` derived as `panelists.map(p => p.model)` only where model-only lists are needed).

- `councilPanelAnswers` / `councilRanking`: `newRun(entry.role, entry.model)`.
- Prefer passing `castThinking` (or a `thinkingFor(role)` callback) so pipeline and `/council` share source-role thinking. If the pipeline path cannot close over `castThinking` easily, thread `thinking: Thinking | ((role: PanelSourceRole) => Thinking)` into the helpers — **do not** leave hard-coded `"PANEL"` thinking once `PANEL_2` exists.
- Ranking for survivors must copy the **source role** from the corresponding answer `AgentRun`, not re-default to `PANEL`.

Debate deliberate path (`DEBATER_*` / `JUDGE`) is untouched.

## File change list

| File | Change |
|------|--------|
| `extensions/fusion-harness/fusion-harness.ts` | Role registry; `MULTI_PICK_ROLES`; `collectPanelModels`; `COMMAND_CAST`; `stageRoles`; `/council`; gauntlet deliberate; `councilPanelAnswers` / `councilRanking` / `councilPipeline` role-aware |
| `README.md` | Glyph list + note that `/council` merges `PANEL` + `PANEL_2` (deduped), ≥2 total; `PANEL_2` has no ARCHITECT fallback |
| `tests/test-gauntlet.ts` | `COMMAND_CAST.gauntlet` length/membership (6 → 7; include `PANEL_2`); add/adjust source assertions for `MULTI_PICK_ROLES` / `collectPanelModels` if present as source checks |
| `tests/gauntlet-works-ARCHITECT-zai-glm-5.2.ts` | Gauntlet cast role list expectation |
| `tests/test-gauntlet-BUILDER-zai/glm-5-turbo.ts` | Exact `COMMAND_CAST` gauntlet string / count assertions |
| `tests/test-suite-gauntlet-pipeline.ts` | `stageRoles` deliberate + full-chain expected roles include `PANEL_2`; length bumps |
| `tests/test-suite-ARCHITECT-opencode-go-deepseek-v4-pro.ts` | `KNOWN_ROLES.length` 11 → 12; Role union / maps; rename/update “multiPick includes PANEL only” → both `PANEL` and `PANEL_2`; expandCastModels / combined-pool cases as needed |

No new prompt files. No package.json / justfile changes.

## Contracts

### Cast sheet UX

- `PANEL_2` row uses existing `multiPick` toggle / Space / Enter drill (same as `PANEL`).
- ASCII cast sheet remains the layout baseline (no new ambiguous-width glyph reliance in sheet chrome beyond registering `☷` for role chrome elsewhere).

### Error / gate copy

- Min-panelist failure mentions both roles.
- Preflight failures continue to identify role + model (existing shape).

### Spawn / prompt boundaries

- Children remain clean-room: `--no-skills --no-extensions --no-context-files`.
- Prompts stay `@file` / path-offloaded under session/artifacts dirs (WIP) — larger panels increase child count and anonymized answer size, not typically argv length.
- Soft risk: more ranking children + larger `ANSWERS` blocks → latency/cost and possible temp-file size; operators control picks; A–Z Borda cap remains.

### Runtime display

- Footer / live widget use `ROLE_GLYPH` / `ROLE_COLOR` for `AgentRun.role`.
- Deduped cross-row model shows as `PANEL` (first wins).

## Test plan (strict TDD)

Primary command: `npx tsx tests/test-gauntlet.ts`.

### RED first (examples)

1. Assert `MULTI_PICK_ROLES` deep-equals `["PANEL", "PANEL_2"]`.
2. Assert `KNOWN_ROLES` includes `PANEL_2` and length is 12 (where suites hard-code length).
3. Assert `COMMAND_CAST.council === ["PANEL","PANEL_2","CHAIRMAN"]`.
4. Assert `COMMAND_CAST.gauntlet` includes `PANEL_2` and expected full list (7 roles).
5. Unit/source cases for `collectPanelModels`:
   - `PANEL=[a/x,b/y]`, `PANEL_2=[b/y,c/z]` → `[{a/x,PANEL},{b/y,PANEL},{c/z,PANEL_2}]`
   - Empty `PANEL_2` with ≥2 PANEL → PANEL-only list, no throw from helper
   - Empty PANEL + empty PANEL_2 + ARCHITECT fallback → single ARCHITECT entry from PANEL path; length `< 2` is caller's reject
   - `expandCastModels("PANEL_2", "prov/a, prov/b,prov/c")` → three parts
6. `stageRoles(["deliberate"])` includes `PANEL_2`; full-chain expected list length +1.

### GREEN

Implement registry + helper + wire call sites + README.

### TRIANGULATE / REFACTOR

- Ensure `/council` and gauntlet deliberate cannot diverge (single helper).
- Prefer threading role-aware panelists into shared `council*` helpers rather than duplicating merge logic in the standalone `/council` body.

E2E live providers are **not** the primary verification path.

## Rejected alternatives

1. **Dual / sequential councils** (PANEL then PANEL_2, then merge syntheses) — higher cost, ambiguous chairman product; out of scope (may revisit as optional flag later).
2. **`PANEL_2` as cast-UI alias that appends into `PANEL` on commit** — loses persistent second row and preflight attribution.
3. **`castModel("PANEL_2")` when unset** — would incorrectly inherit ARCHITECT; rejected explicitly.
4. **Expand Borda beyond A–Z** — out of scope; document 26-panelist soft cap.

## Rollout / rollback

1. Land on the WIP harness baseline; no cast-file migration.
2. Rollback: revert commits; leftover `PANEL_2` keys in `.fusion-harness.json` become inert once removed from `KNOWN_ROLES`.
3. Operators using only `PANEL` see no behavior change when `PANEL_2` is empty.

## Risks

| Risk | Mitigation |
|------|------------|
| Test drift on hard-coded counts / lists | Update all suites listed above in the same change |
| Accidental ARCHITECT fallback via `castModel("PANEL_2")` | Helper contract forbids it; tests cover empty PANEL_2 |
| Larger panels → cost / ENAMETOOLONG-ish pressure | `@file` offload already in WIP; document pick discipline + 26 cap |
| Glyph README drift | Update README `☷ PANEL_2` alongside code (README already drifts vs code for other glyphs — fix PANEL_2 consistently; optional cleanup of other glyphs is non-goal) |
| Dual council code paths (`/council` vs `councilPipeline`) | Both call `collectPanelModels`; role-aware helpers prevent display/thinking bugs |

## Open questions — resolved

| Question | Resolution |
|----------|------------|
| Exact glyph / color | `☷` + `mdLink` + `architect` |
| Compact widget label | Full `PANEL_2` |

## Next phase

**sdd-tasks** — break into RED → GREEN → TRIANGULATE tasks with review-workload forecast, then human approval before apply.
