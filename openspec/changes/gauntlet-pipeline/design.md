# Design — gauntlet-pipeline

## Context

The harness's command roster covers the full lifecycle of hard work as standalone verbs: council (deliberate), validator gate (acceptance contract), coordinator (decompose), workers (execute), gate correction loop (verify), redteam (harden). Each verb mints its own artifacts dir and its stage logic lives inside its command handler. Composition is therefore possible only by hand, and loses the two things the harness already standardized: **filesystem handoffs** (gate.py, subtasks.json) and **session discipline** (pinned brains where context accrues, ephemeral where bias must not).

`/gauntlet` sequences the verbs into one campaign. The stage order is not a preference — it follows from the harness's own rules: direction before code (a perfectly built wrong plan is waste), gate before build (the core auto-validate philosophy), hardening only after green (probing garbage is waste), integration last (the planner verifies its own plan).

## Goals / Non-Goals

**Goals:** one command runs the campaign; one artifacts dir carries the handoffs; a live board makes a long run legible; the cast sheet is the pre-spend confirm gate; stage logic is shared with the standalone commands by extraction, not duplication.

**Non-Goals:** no changes to standalone command behavior; no arbitrary DAG composer (the chain composer is linear — parallel-branch graphs remain out).

## Decisions

### D1 — Fixed pipeline, two skip flags + alternate deliberation

Stage order is fixed: DELIBERATE (council → `plan.md`) → GATE-FIRST (validator → `gate.py`, baseline RED) → DECOMPOSE (coordinator → `subtasks.json`) → BUILD (worker levels) → VERIFY (gate correction loop) → HARDEN (redteam sorties) → INTEGRATE (coordinator report). `--skip-council` replaces stage 0 with the harness writing the user's prompt verbatim as `plan.md` (downstream stages are unchanged because they read the file, not the stage). `--skip-redteam` omits HARDEN. `--deliberate=debate` replaces the council stage with a debate (rounds → anonymized judge verdict); the verdict text is saved verbatim as `plan.md` so the same downstream validator and coordinator contract holds. The deliberation stage is the only one with a choice of *how* to deliberate; everything else always runs.

*Alternatives rejected:* arbitrary stage selection (`--stages a,b,c`) — combinatorial semantics for marginal value; debate as an extra stage bolted onto council — `--deliberate=debate` is the clean replacement, not an addition.

### D6 — Cross-campaign resume via per-stage `state.json`

Every stage writes its outcome to `state.json` in the campaign dir (stage name, status, key artifact paths, started/ended timestamps, prompt, cast snapshot, accumulated tokens/cost). `/gauntlet --resume [dir]` (no arg = latest `gauntlet-*` dir in `/tmp`) loads `state.json` and re-enters at the first stage whose status is not `done`. Completed stages' artifacts are reused verbatim; the cast sheet pre-fills from the stored cast (the user can re-cast before RUN); ephemeral sessions (council panelists, build workers) are not restored — stages re-spawn as needed and read their inputs from the artifacts dir, the same way a fresh campaign would. Pinned brains (architect-side validator + coordinator, host-fork builder) survive naturally because their session files persist. Halt-on-failure semantics still apply on resume: a failed stage on resume halts the campaign at that stage.

*Alternatives rejected:* session-graph restoration (ephemeral stages are cheap to re-spawn; restoring them is a tarball of complexity with no real saving); mandatory stored cast on resume (the cast sheet still opens, so a one-time cast change is one RUN).

### D7 — `/chain` linear composer over the same conductor

`/chain <stages> <prompt>` accepts a comma-separated ordered list of stage names (`deliberate`, `gate`, `decompose`, `build`, `verify`, `harden`, `integrate`) and runs exactly that ordered subset over one artifacts dir, using the same extracted stage functions, the same cast sheet (rows = the union of involved stages), and the same board. Each stage declares its **required input files** (e.g. `build` requires `subtasks.json`; `verify` requires `gate.py`; `integrate` requires `plan.md`); before any spawn the chain validates that every stage's required files are either produced by an earlier stage in this chain OR already present in the dir from a prior campaign (chains are themselves resumable), and fails loudly listing every missing prerequisite. `/gauntlet` is the canonical full-preset call.

*Alternatives rejected:* arbitrary DAG (parallel branches, fan-in/fan-out) — linear is the expressiveness needed; graphs are v3; enforcing the canonical order only (rejected `build` after `verify`) — the chain's prerequisite check IS the constraint, and out-of-order is sometimes correct (e.g. a chain that does `gate,build,verify` skips deliberation and decomposition for a known-good plan).

### D2 — Extraction, not reimplementation

Each stage is a function extracted from its command handler in `five-coordination-commands` (council stage trio, validator-gate design + baseline, coordinator decompose/integrate, worker levels, gate correction loop, redteam sortie loop). The standalone commands and the pipeline call the same functions with the same contracts; the refactor is mechanical and behavior-identical, guarded by the standalone commands' existing manual test matrix. This kills implementation drift between `/council` and gauntlet's DELIBERATE at the root.

### D3 — One artifacts dir, file handoffs, digest injection

A single `gauntlet-*` dir holds every stage artifact. Cross-stage context flows two ways: **files** for contracts (`plan.md`, `gate.py`, `subtasks.json`) and **capped digest injection** into prompts (the plan digest sent to the validator and coordinator is `HANDOFF_MAX`-truncated). Nothing is parsed from agent prose except the already-strict verdict line. The chairman's synthesis is saved verbatim as `plan.md`.

### D4 — Session discipline mirrors the standalone commands

VALIDATOR and COORDINATOR share the pinned architect-side brain (auto-validate precedent — planning context accrues across stages); the BUILDER of the VERIFY/HARDEN loops is the host-fork alter-ego (it owns un-partitioned fixes; stage-3 workers were hired hands); council panelists and workers stay ephemeral per run; the ATTACKER resumes across sorties within HARDEN. No new session kinds are invented.

### D5 — The board is a widget mode, the cast sheet is the gate

The campaign board renders as a live widget variant: current stage (k/6), elapsed time, cumulative cost, and the subtask checklist (⬜/◐/✓/✗, mirroring worker run states) once `subtasks.json` exists; before that, stage progress alone renders. A final board panel summarizes every stage with its artifact paths. Before anything spawns, the cast sheet opens with all six role rows plus the stage list — RUN is both cast confirmation and spend acknowledgment.

## Risks / Trade-offs

- **Cost**: 10+ spawns at full thinking → skip flags, inherited rounds caps, the cast-sheet confirm, and the board's live cost counter make spend visible and bounded.
- **Blast radius of a bad plan**: a weak `plan.md` poisons every downstream stage → council's peer ranking is the strongest deliberation the roster has; the gate-first stage still forces the plan into a machine-checkable contract before code; INTEGRATE reports plan-vs-result divergence explicitly.
- **Extraction regressions in standalone commands** → extraction is mechanical; the standalone commands' manual matrix re-runs unchanged after extraction, before `/gauntlet` is wired.
- **Long-run legibility on narrow terminals** → the board degrades to stage-line-only below the two-column minimum width.
- **Halt mid-campaign loses momentum** → every artifact to that point is in the campaign dir and the failure panel names the completed stages; manual continuation via the standalone commands is always possible (that's the advantage of shared stage logic).

## Migration Plan

Apply order: `multi-provider-cast` → `five-coordination-commands` → `gauntlet-pipeline`. Within this change: extract stage functions first (standalone matrix green), then the pipeline conductor, then the board. No user-facing migration.

## Open Questions

- Should INTEGRATE feed a failing campaign back into VERIFY once (a single meta-retry) instead of just reporting? Leaning no — loud report beats silent loops — but noted.
- Board line budget on short terminals: collapse completed stages to one line each? Resolve at implementation with real heights.
