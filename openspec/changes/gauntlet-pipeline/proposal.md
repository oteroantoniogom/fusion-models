# gauntlet-pipeline

## Why

With five coordination commands shipping alongside the original three, the harness owns a complete vocabulary for hard work: deliberation (council/debate), acceptance contracts (validator gate), decomposition (coordinator), execution (workers/builder), verification (gate loop), and hardening (redteam). Hard tasks don't need one of these — they need all of them, in an order the harness's own philosophies force: direction before code, gate before build, hardening after green. Today chaining them is manual, lossy (each run mints its own artifacts dir, sessions, and context), and faith-based (no progress view across a long run). `/gauntlet` is the conductor: one command that runs the full campaign — research → plan → gate → decompose → build → verify → harden → integrate — over one shared artifacts dir, with a live task board from `subtasks.json`.

## What Changes

- **`/gauntlet <prompt> [--skip-council] [--skip-redteam] [--deliberate=council|debate] [--resume [dir]]`** — a six-stage campaign composing the stage internals of the shipped commands (no reimplementation: stage functions are mechanically extracted and shared):
  1. **DELIBERATE** — council investigates the request (research/explore stage); CHAIRMAN synthesis becomes `plan.md`.
  2. **GATE-FIRST** — VALIDATOR reads `plan.md` + prompt, writes `gate.py`; baseline must run RED.
  3. **DECOMPOSE** — COORDINATOR reads `plan.md`, writes `subtasks.json` with path-partitioned write domains.
  4. **BUILD** — workers execute dependency levels.
  5. **VERIFY** — the gate correction loop (builder host-fork, escalation → triage → gate repair) until green or halt.
  6. **HARDEN** — attacker sorties → patch loop until CONCEDE or cap (skippable). Then **INTEGRATE**: COORDINATOR resumes, final report against `plan.md`.
- **One campaign artifacts dir** — `plan.md`, `gate.py`, `subtasks.json`, round outputs, and verdicts all live in a single `gauntlet-*` dir; stages hand off through files (the established filesystem-transport pattern), never through prose parsing.
- **Campaign task board** — a live widget rendering stage progress plus the `subtasks.json` checklist (pending / working / done / failed per subtask), and a final board panel summarizing the whole run.
- **Cast sheet as pre-run confirm gate** — PANEL (multi-pick), CHAIRMAN, VALIDATOR, COORDINATOR, WORKERS, ATTACKER rows on one screen with the stage list; RUN starts the campaign.
- **Alternate deliberation** — `--deliberate=debate` replaces stage 0 with a debate (rounds + anonymized judge verdict); the verdict text becomes `plan.md`.
- **Cross-campaign resume** — every stage writes its outcome to `state.json` in the campaign dir; `/gauntlet --resume [dir]` (default: latest `gauntlet-*` dir) re-enters at the first incomplete stage with the stored prompt and cast, reusing every completed stage's artifacts.
- **`/chain <stages> <prompt>` composer** — run any ordered subset of named stages (`deliberate,gate,decompose,build,verify,harden,integrate`) over one artifacts dir; each stage declares its required input files and the chain validates prerequisites before spending anything. `/gauntlet` is the canonical full preset of the same conductor.
- **Refactor (behavior-identical)**: stage internals extracted from the `/council`, `/auto-validate`, `/coordinate`, and `/redteam` handlers into shared stage functions invoked by both the standalone commands and the pipeline.

**Depends on:** `five-coordination-commands` (the stages) and transitively `multi-provider-cast`. The standalone commands remain fully usable on their own.

## Capabilities

### New Capabilities

- `gauntlet-command`: the staged campaign — fixed order, stage toggles, shared artifacts, halt semantics, cast sheet confirm gate, alternate deliberation, cross-campaign resume.
- `campaign-task-board`: live stage + subtask checklist rendering during the run and a final board panel.
- `chain-composer`: user-defined ordered stage chains with prerequisite validation over the same conductor and board.

### Modified Capabilities

<!-- None — stage extraction is behavior-identical; standalone command specs are untouched. -->

## Impact

- `extensions/fusion-harness/fusion-harness.ts`: new `/gauntlet` handler + stage-function extraction + campaign board widget/panels.
- `extensions/fusion-harness/USER_PROMPT_*.md`: campaign-level prompts (plan-digest injection for validator/coordinator) — stage prompts are reused.
- `README.md`: campaign docs, board visuals, cost guidance.
- Cost: this is the most expensive command by design (10+ spawns); `--skip-council` / `--skip-redteam` and inherited rounds caps bound it. The cast sheet doubles as the pre-spend confirmation.
