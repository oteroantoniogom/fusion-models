# five-coordination-commands

## Why

The harness ships three commands (`/opinion`, `/fusion`, `/auto-validate`) and its own README names the next three — `/debate`, `/parallel`, `/coordinate` — as the intended extension of the same spawn-and-render machinery. With `multi-provider-cast` making any pi-registered model assignable to any role, the roster can go further: a debate deserves a judge the prompter chooses, and a council only becomes meaningful when three or more providers can sit on it. This change cashes the README's check and adds the two research-backed patterns (LLM-Council-style anonymized peer review, adversarial red-teaming) that the three shipped commands cannot express.

## What Changes

- **`/debate <prompt> [--rounds N] [--reveal] [--no-early-stop]`** — ARCHITECT-side and BUILDER-side debaters answer independently, then each responds to the other's previous answer for N rounds (resuming their pinned sessions, so context accrues). After each rebuttal round, a strict `CONVERGED|DIVERGED` check can end the debate early. A castable JUDGE renders the verdict on a fresh session over an **anonymized transcript** (Debater A/B by default; `--reveal` shows identities).
- **`/parallel <prompt>`** — both models execute the same task with full tools and NO merge stage: a build-off, two independent results rendered side by side.
- **`/coordinate <prompt> [--no-fix-up]`** — a COORDINATOR decomposes the task into a `subtasks.json` manifest written to the artifacts dir via its own write tool (the `gate.py` filesystem-transport precedent — nothing parsed from prose); builder-side workers execute the subtasks with path-partitioned write domains; the COORDINATOR re-enters to integrate and verify, and gets **one fix-up pass with full tools** when verification finds gaps, followed by a read-only re-verify.
- **`/council <prompt>`** — a castable PANEL (K models, multi-picked) answers independently; answers are anonymized (`Response A/B/C…`) and every panelist ranks the full set; a castable CHAIRMAN synthesizes the final answer from answers + rankings.
- **`/redteam <prompt> [--rounds N]`** — BUILDER builds; an ATTACKER with probe tooling tries to break it and ends each sortie with a strict `VERDICT: BREACH|CONCEDE` line; BREACH sends the builder back to patch; CONCEDE or the round cap ends the loop.
- **K-run rendering**: final output stacks one full-height panel per run (scales to K), and the live widget gains a compact one-line-per-run mode when more than two runs are active (two-column mode preserved for K≤2).
- New `USER_PROMPT_*.md` contracts per command; per-command cast declarations wired to the `multi-provider-cast` picker (JUDGE / CHAIRMAN / PANEL are ordinary cast rows).

**Depends on:** `multi-provider-cast` (cast map, picker, preflight). No breaking changes to the shipped three commands.

## Capabilities

### New Capabilities

- `debate-command`: multi-round two-agent debate with accreting sessions and a castable judge verdict.
- `parallel-command`: same-task full-tool fan-out with no merge stage.
- `coordinate-command`: manifest-driven orchestrator→workers→integration flow with path-partitioned writes.
- `council-command`: anonymized peer-ranking council with a chairman synthesis.
- `redteam-command`: adversarial build/attack/patch loop with strict verdict parsing.
- `multi-run-rendering`: stacked K-run final panels and a compact live-widget mode for more than two concurrent runs.

### Modified Capabilities

<!-- None — no specs exist yet beyond the ones multi-provider-cast introduces; the shipped three commands' behavior is unchanged. -->

## Impact

- `extensions/fusion-harness/fusion-harness.ts`: five new `registerCommand` blocks, K-run rendering (stacked panels + compact widget), manifest + verdict parsing helpers — all composing existing `runChild` / panels / stoppable / session machinery.
- `extensions/fusion-harness/USER_PROMPT_*.md`: new prompt contracts (debate rounds, judge, coordinate manifest, council ranking, chairman, attacker, patch).
- `README.md`: the "Build your own patterns" section becomes shipped reality; per-command docs and recipes.
- Cost surface: `/debate`, `/council`, and `/redteam` are multi-round/multi-agent by design; rounds caps keep them bounded.
- Cast rows per command consume the `multi-provider-cast` picker/preflight — judge, chairman, and panel are where multi-provider pays off.
