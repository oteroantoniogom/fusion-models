# Design — five-coordination-commands

## Context

The extension ships three commands built from one machinery set: `runChild()` (clean-room `pi --mode json -p` spawns with per-role thinking, tools, sessions, resume/fork), buffered per-agent flow, a two-column live widget, full-height scrollback panels, `/tmp` artifacts dirs, and prompt files with `{{VAR}}` interpolation. `multi-provider-cast` (dependency) adds the cast map, per-command cast picker, and preflight; this change consumes those — every role below is an ordinary cast row.

The README's "Build your own patterns" section already promises `/debate`, `/parallel`, `/coordinate`. Research adds two patterns the shipped trio cannot express: LLM-Council-style anonymized peer ranking (blunts self-preference bias and sycophancy — impossible with a single fuser) and adversarial red-teaming (a static acceptance gate can't probe the space an adversarial mind can).

## Goals / Non-Goals

**Goals:** the five commands, each a thin orchestration over existing machinery; K-run rendering that degrades gracefully past two runs; per-command prompt files; rounds caps bounding every loop.

**Non-Goals:** no changes to the shipped three commands' behavior; no child-contract changes (clean-room flags, session pinning, host-fork rules unchanged); no K-way build-off (`/parallel` stays two-way — council covers K-way deliberation); no multi-pass coordinator fix-ups (exactly one pass, capped).

## Decisions

### D1 — `/debate`: pinned-brain rounds, fresh judge

Round 1: both debaters answer the prompt independently, in parallel, with `OPINION_TOOLS` (debate deliberates with evidence — read/bash — but does not build; building is `/parallel`'s job). Rounds 2..N: each debater **resumes its pinned role session** receiving the opponent's last answer (truncated to `HANDOFF_MAX`) plus a rebuttal instruction, so dialectic accrues in the same brain the harness philosophy already maintains. After each rebuttal round, a **convergence check** runs: the JUDGE model (cheap spawn, `READONLY_TOOLS`) reads both latest answers and must end with a strict `CONVERGED` or `DIVERGED` final line (the shared verdict-line parser); CONVERGED skips straight to the verdict, DIVERGED continues, and an unparseable line counts as DIVERGED (never silently truncates the debate). `--no-early-stop` disables the check. The JUDGE is a fresh ephemeral session (like FUSION) with `READONLY_TOOLS`, handed the full transcript **anonymized as Debater A / Debater B by default** (mapping in memory, known model-id strings stripped — the council technique), with a verdict contract (winner + strongest argument each side + what would change its mind); `--reveal` shows true identities instead. `--rounds N` counts total exchanges, default 2, clamp 1–5.

*Alternatives rejected:* judge-per-round full verdicts as the convergence signal (a one-word strict-line check is far cheaper than a verdict per round); identities-visible judging as default (the user chose bias-blind judging; `--reveal` keeps the old behavior one flag away); assigned pro/con positions (defend-your-own-answer already forces real dialectic; a devil's-advocate mode is prompt-file tuning, not code).

### D2 — `/parallel`: the fusion handler minus stage 2

ARCHITECT + BUILDER, `FULL_TOOLS` each, same prompt, side-by-side duo panel, done. No fuser spawn. This is deliberately small — its value is cadence (no merge wait) and its difference from `/fusion` with a "don't merge" fusion-prompt is discoverability (a named command, per the README's promise).

### D3 — `/coordinate`: manifest over the filesystem, levels over the workers

The COORDINATOR (architect-side model, castable) gets `VALIDATOR_TOOLS` (read-only + write) and a prompt dictating one absolute path — `<artifactsDir>/subtasks.json` — the exact `gate.py` transport precedent: nothing is parsed from prose. Manifest schema:

```json
{ "subtasks": [ { "id": "t1", "title": "…", "prompt": "…", "paths": ["src/a/**"], "dependsOn": [] } ] }
```

`paths` is the **write-domain partition** — the contract that makes concurrent writers safe in a shared cwd (the collision the codebase already warns about). The harness `JSON.parse`s the file (unparseable → loud error panel with the raw content; no coordinator-repair loop in v1), then schedules subtasks in dependency levels: levels run sequentially, subtasks within a level run in parallel (`Promise.all`), each a fresh ephemeral builder-side session with `FULL_TOOLS` and a prompt embedding its owned paths plus "never write outside them". Integration: the COORDINATOR resumes its session (it holds the plan), receives per-subtask status + output digests (`HANDOFF_MAX`-capped), verifies against the original request with `READONLY_TOOLS`, and renders the integration report. **When verification finds gaps, the coordinator gets exactly one fix-up pass**: it resumes with `FULL_TOOLS`, addresses the named gaps directly (workers are gone; their write domains are settled), then re-verifies with `READONLY_TOOLS` and renders the final report. `--no-fix-up` disables the pass (report-only, the original v1 shape). Larger failures still route to `/auto-validate` or a fresh `/coordinate` — one pass, never a loop.

*Alternatives rejected:* workers fork the host (K host-session copies for hired-hand subtasks is waste — forking stays the builder alter-ego's privilege in `/fusion` + `/auto-validate`); unbounded fix-up retries (a loop without a gate is how campaigns burn hours — the single-pass cap plus the gate-equipped `/auto-validate` escape hatch is the disciplined shape).

### D4 — `/council`: ephemeral panelists, anonymized ranking, aggregate-then-chair

PANEL is a cast row using the cast sheet's **multi-pick (checkbox) row type** — the overlay decision in `multi-provider-cast` makes panel multi-pick native; minimum 2 checked, first two pre-checked as the current ARCHITECT/BUILDER; CHAIRMAN is a separate cast row defaulting to the architect model. Stage 1: every panelist answers in parallel with `OPINION_TOOLS`, each in a **fresh ephemeral session** (council members carry no memory between councils — pinned side-brains don't fit K models and memory would bias ranking). Stage 2: the harness anonymizes answers as `Response A/B/C…` (mapping held in memory; known model-id strings are string-stripped as best-effort, and panel prompts forbid self-identification), then each panelist ranks the full anonymized set with a one-line rationale per rank. Stage 3: the harness aggregates ranks (Borda count — transparent, no extra model call), and the CHAIRMAN (fresh session, `READONLY_TOOLS`) synthesizes the final answer from prompt + anonymized answers + aggregate table, noting where panel consensus was strong vs. split.

*Alternatives rejected:* chairman-only synthesis without peer ranking (that's `/fusion` with more inputs — the anonymized ranking IS the council); persistent panelist brains (bias + no fit for K); pairwise single-elimination (more rounds, more cost, same bias protection).

### D5 — `/redteam`: strict verdict line, resume both sides

BUILDER builds with `FULL_TOOLS` via the host-fork spawn (same alter-ego rule as `/auto-validate`). The ATTACKER (architect-side model, castable) gets `OPINION_TOOLS` — it runs the project, pokes endpoints, executes tests via bash, but holds no write/edit tools. Each sortie MUST end with a strict final line `VERDICT: BREACH — <summary>` or `VERDICT: CONCEDE — <summary>`, parsed by line-regex. BREACH feeds the report verbatim into the builder's resumed session for a patch; both sides resume across sorties (attack knowledge and patch context accrue). CONCEDE ends green; `--rounds N` (default 3, clamp 1–8) caps the loop. A missing verdict line retries the attacker once; a second miss halts loudly with the raw sortie output.

*Alternatives rejected:* attacker with write tools (the attacker must never touch the artifact it attacks — same "grader never touches the code" rule as the gate); a model-graded "breach score" instead of a verdict line (unparseable prose is how loops silently break; the gate loop already proved strict-machine-parseable exits work).

### D6 — K-run rendering: stacked finals, compact live lines

Final output already renders full-height into scrollback, so K runs stack as K panels unchanged. The live widget is the only squeeze: K≤2 keeps the two-column mode; K>2 switches to a compact one-line-per-run mode (`glyph ROLE model · status · last tool/text · tokens`), preserving the same per-agent flow data. Footer stays two cells (architect-side / builder-side) regardless.

## Risks / Trade-offs

- **Pinned brains grow across debate/redteam rounds** (cost, drift) → rounds caps; `/fh-reset` already exists; stats panels show cumulative tokens/cost.
- **Council anonymity leaks** (a panelist names its model in prose) → prompt contract forbids it + best-effort string strip of known model ids; chairman is told rankings may be imperfect.
- **Path-partition violations by coordinate workers** → partition is in every worker prompt; integration report names violations; levels limit blast radius; docs recommend a clean git tree before `/coordinate`.
- **Verdict-line brittleness in `/redteam`** → one retry then loud halt; the pattern is proven by the gate loop's `exit 0` contract.
- **Aggregate-rank gaming** (a panelist ranks itself top by style recognition) → anonymization blunts but can't eliminate; documented as inherent to the pattern.
- **Five commands × prompt files = surface area** → each command's prompts are independent files; a bad contract is tuned by editing one file, not code.

## Migration Plan

Purely additive: new commands, new prompt files, widget mode switch. The shipped three commands are untouched. `multi-provider-cast` must be applied first (cast rows, picker, preflight are assumed by every handler here).

## Open Questions

- Should `/debate`'s judge see the debaters' identities or an anonymized transcript? (v1: identities visible — the judge is chosen precisely for being a trusted third party; anonymized judging is a prompt-file edit away.)
- Exact compact-widget line budget for very large K (council of 5+): cap visible lines, overflow into "+N more"? Resolve at implementation with real terminal widths.
