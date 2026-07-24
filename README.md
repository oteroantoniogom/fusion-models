# fusion-harness

> **Fuse frontier models instead of racing them. AND, not OR.**
> A standalone [Pi coding agent](https://github.com/badlogic/pi-mono) extension harness for two-model agentic engineering.

📺 Watch this video to get the full breakdown of this codebase: **[GPT-5.6 Sol vs Fable 5 Is the Wrong Question (Fusion) on YouTube](https://youtu.be/AQl5Q-0l7FQ)**

<p align="center">
  <img src="images/hero.png" alt="MODEL FUSION — two model energy streams fusing into one over an engineer's keyboard" width="850">
</p>

<p align="center">
  <img src="images/svg-01-fusion-hero-animated.svg" alt="ARCHITECT (claude-fable-5) and BUILDER (gpt-5.6-sol) streams fusing into one result — AND, not OR" width="850">
</p>

"Which model is best" is a benchmark question, not an engineering question. One model plans, another builds, and the results fuse: you combine compute instead of selecting it. Aider called the pattern [architect/editor](https://aider.chat/2024/09/26/architect.html) (the original fusion); [Devin calls it fusion](https://cognition.com/blog/devin-fusion); [OpenRouter calls it model fusion](https://openrouter.ai/blog/announcements/fusion-beats-frontier/). This repo makes the pattern a first-class, on-camera-clear workflow: two hard-labeled agents, a gate-first validation loop, and attributed fusion. **You don't have to pick a winner when you can hire both.**

---

## Install

### Agentic Install

```bash
claude "/install"   # runs the /install slash command in Claude Code (or Pi, or your favorite agentic coding tool)
```

The `/install` command lives at `.claude/commands/install.md` and handles toolchain checks, key checks, and project-specific setup.

### Manual Install

**Prereqs:** [`pi`](https://github.com/badlogic/pi-mono), [`just`](https://github.com/casey/just), [`jq`](https://jqlang.github.io/jq/), [`uv`](https://docs.astral.sh/uv/).

```bash
npm install -g @earendil-works/pi-coding-agent    # the Pi coding agent
brew install just jq uv                           # task runner, json inspection, gate runner
printf 'ANTHROPIC_API_KEY=sk-ant-...\nOPENAI_API_KEY=sk-...\n' >> .env   # architect + builder keys
just fh-workhorse                                 # launch on the cheap test pair
```

---

## Why this exists

<p align="center">
  <img src="images/video-frames/and-not-or.png" alt="Compute routed to Model A OR Model B (select) versus Compute routed to A + B (AND: combine compute)" width="780">
</p>

Every frontier release restarts the same argument: `GPT-5.6 Sol` or `Fable 5`? Benchmarks crown a winner, teams switch, and next quarter the crown moves. Meanwhile the two models are genuinely different animals: one plans and critiques with more depth, the other ships working diffs faster. Picking one means losing the other's edge on every single task.

<p align="center">
  <img src="images/video-frames/team-vs-lone-wolf.png" alt="Unchecked lone wolf drifting below the quality line versus an architect-builder team with validation checks" width="780">
</p>

The deeper problem is review, the second constraint of agentic engineering. A single unchecked agent drifts below the quality line and nobody catches it until you read the diff. A tight two-agent team validates its own work as it goes: the architect checks the builder, the gate checks them both.

The harness inverts the question. The ARCHITECT model plans, fuses, and validates; the BUILDER model builds; a fusion step merges their independent answers with explicit attribution, and an acceptance gate proves the result. **The wrong question is "which model." The right question is "which role."**

<table align="center">
  <tr>
    <td><img src="images/video-frames/fusion-core.png" alt="Fable 5 and GPT-5.6 Sol linked through a glowing fused-output core" width="390"></td>
    <td><img src="images/video-frames/combined-context-window.png" alt="Fable 5 and GPT-5.6 Sol context windows stacked into one fused context" width="390"></td>
  </tr>
</table>

Used properly, fusion combines the intelligence AND the context windows of your models: two independent thought chains, one merged result.

---

## The five commands

<p align="center">
  <img src="images/svg-03-three-commands.svg" alt="/opinion — side by side, /fusion — merged via a fusion agent, /auto-validate — validator gate + builder loop" width="780">
</p>

One extension file registers five slash commands plus two coordination patterns. Every agent is a spawned `pi --mode json -p` subprocess with a fully qualified `provider/id` model, per-role thinking level, and artifacts under `/tmp/fusion-harness-*` (never inside this repo).

Children are deliberately **clean-room**: every spawn gets `--no-skills --no-extensions --no-context-files`. `--no-extensions` keeps a child from recursively loading this harness; `--no-skills` / `--no-context-files` keep spawns lean and deterministic — each worker's entire contract comes from the harness's prompt files, identical on any machine regardless of what skills are installed. Only the HOST (raw chat) loads your skills and context files; children never do, even the builder children that fork the host session (a fork copies conversation history, but each child rebuilds its own system prompt from its own flags).

| Command | Agents | What happens |
|---|---|---|
| `/opinion <prompt>` | 2 | Both models answer independently (every tool except write/edit). One panel compares them side by side — model, latency, tokens, cost — above both full answers. A pure A/B read. |
| `/parallel <prompt>` | 2 | ARCHITECT and BUILDER execute the **same task with full tools** in parallel, no merge stage — a build-off with side-by-side results. Each agent's output renders independently. |
| `/fusion "<prompt>" "<fusion-prompt>"` | 3 | ARCHITECT and BUILDER answer in parallel, both with full tools — either can build/render what you asked for. A third FUSION agent (architect model, fresh session, full tools) merges the two per your fusion instruction — default is a critical merge with `[ARCHITECT]`/`[BUILDER]` attribution and a **Consensus & Divergence** close. |
| `/auto-validate <prompt>` | 2 + gate | The auto-validation loop: VALIDATOR designs an acceptance gate BEFORE any work happens, BUILDER builds, the gate runs, failures feed back verbatim until green or halt. Full breakdown below. |
| `/debate <prompt> [--rounds N] [--reveal] [--no-early-stop]` | 2-3 | Multi-round debate: ARCHITECT-side and BUILDER-side debaters argue independently (round 1), then rebut each other's positions (rounds 2+ resume pinned sessions). An **early-stop convergence check** can end the debate when positions converge. A castable **JUDGE** renders the verdict on an **anonymized transcript** (Debater A/B; `--reveal` shows identities). —rounds N (default 2, clamp 1-5). |
| `/coordinate <prompt> [--no-fix-up]` | 1+ | Manifest-driven orchestration: a COORDINATOR decomposes the task into a `subtasks.json` manifest (written to disk), the harness validates and schedules subtasks in dependency levels, and builder-side workers execute with path-partitioned write domains. The COORDINATOR re-enters to verify and gets **one fix-up pass** when gaps are found. |
| `/council <prompt>` | K+1+ | Multi-model council: a PANEL of K models (multi-picked from the cast sheet) answers independently (fresh ephemeral sessions, OPINION_TOOLS). The harness **anonymizes** answers as Response A/B/C…, every panelist ranks the full set, ranks are aggregated with **Borda count**, and a CHAIRMAN synthesizes the final answer. Degrades gracefully if a panelist fails. |
| `/redteam <prompt> [--rounds N]` | 2 | Adversarial build/attack loop: BUILDER builds with full tools, then an ATTACKER probes with OPINION_TOOLS (no write/edit). Each sortie ends with a strict `VERDICT: BREACH\|CONCEDE — <summary>` line. BREACH feeds back into the builder for a patch; CONCEDE ends green. Both sides resume their sessions across sorties. --rounds N (default 3, clamp 1-8). |

### Same team, eight outputs

<p align="center">
  <img src="images/video-frames/fusion-value-ladder-switchboard.png" alt="Value ladder: /opinion gives 2 answers, /fusion gives 1 merged plan, /auto-validate gives a verified build" width="780">
</p>

The three commands are a value ladder on the same two agents. `/opinion` is the scout: two takes, no merge, you choose. `/fusion` is the planning step: the architect merges both takes into one plan. `/auto-validate` is build and test in one: a gate proves the work. Chain them (opinion, then fusion, then auto-validate) and you are running a micro software-development lifecycle inside a single harness.

### /opinion — two perspectives, side by side

<p align="center">
  <img src="images/video-frames/opinion-flow.png" alt="/opinion fanning out to Fable 5 and GPT-5.6 Sol answer panels in parallel — 2 agents total" width="780">
</p>

Both models take your prompt in parallel and the panel lines them up: latency, tokens in/out, cost, and the full answers. You get two unique perspectives no single-model tool gives you, and a free side effect: a running head-to-head of how your models actually perform on your work. **Relativity is the best benchmark.**

### /fusion — merge with attribution

<p align="center">
  <img src="images/video-frames/fusion-command-flow.png" alt="/fusion flow: Fable 5 and GPT-5.6 Sol in parallel into a fresh-session Fusion Architect producing the fused answer — 3 agents total" width="780">
</p>

Both workers execute with full tools, then a third agent (the architect model on a fresh session) reads both raw answers from the run's artifacts dir and merges them per your fusion instruction.

<p align="center">
  <img src="images/video-frames/fusion-provenance-resolver.png" alt="Fable plan and GPT plan resolving into a fused plan with per-line provenance: MERGED, KEPT, KEPT, NEW — 0 dropped" width="780">
</p>

The fused result carries provenance: what both models agreed on (consensus), what only one saw (divergence, kept and attributed), and what got discarded. The divergences are the value: you hired two different engineers precisely so they would not say the same thing.

`/fh-reset` wipes the persistent per-project role sessions when you want fresh agent memories. Pi's built-in `/new` does this automatically on top of its normal fresh-session flow — a new conversation means new role brains too (plain restarts, `/resume`, and forks keep them).

**Press `escape` to stop any running command.** Pi's own escape only aborts *its* agent loop; every agent here is a spawned subprocess, so the harness taps the key itself and kills the whole run — children first, gate included. The panel says you stopped it rather than blaming the models.

`/thinking <architect> [builder]` retunes thinking mid-session — no restart. Omit the builder level to leave it unchanged; run it bare to print the current pair. Canonical or short forms both work (`high` or `hi`, `medium` or `med`, `off` or `none`), so you can type back exactly what the footer shows.

`/system-prompt` shows the system prompt each role runs with — ARCHITECT | BUILDER side by side, zero cost (nothing spawns). Each column is just the prompt text: the `--*-system-prompt` override (inline flag text, or the contents of the file it points to), or pi's actual default prompt when unset — rebuilt exactly as a spawned child gets it. No skills or project-context sections appear in either column because children are clean-room (see above); the host's own prompt, which does carry your skills, is not what this panel shows.

---

## Raw chat IS the builder

<p align="center">
  <img src="images/svg-04-host-as-builder.svg" alt="Host session on the builder model forks builder children; the architect session stays a separate brain" width="750">
</p>

The launch recipes set the Pi host itself to the BUILDER model. Type a plain message and you get the untouched native Pi experience, on the builder's session. Run a slash command and the builder child **forks the host session**, inheriting your raw chats and every prior panel. Chat and commands are the same agent; nothing about vanilla Pi changes.

The ARCHITECT deliberately stays a separate persistent brain (pinned per project **and per model** in `/tmp/fusion-harness-sessions/`). Two independent perspectives is the point of fusion: an architect that inherited the builder's every assumption would just be an echo. Swapping `--architect` or `--builder` mints a separate brain for the new model — a transcript built under one model is never replayed as another model's own history (replaying sonnet-built turns into fable-5 trips Anthropic's usage-policy classifier; see below).

---

## The auto-validation loop

<p align="center">
  <img src="images/svg-05-gate-first-loop-animated.svg" alt="Validator designs gate.py, baseline runs red, builder builds, gate runs — PASS exits, FAIL loops back, halt at cap" width="780">
</p>

Red to green, with the gate designed before the build:

1. **VALIDATOR designs the gate first.** It inspects the project read-only and writes a single Astral `uv` Python script (PEP 723) that exits 0 iff *what you asked for is what got built*. Every explicit requirement maps to a concrete check.
2. **Baseline run must fail RED.** A passing baseline means the gate is weak or the work is already done; either way you hear about it loudly.
3. **BUILDER builds** with full tools. The gate is visible but immutable.
4. **The gate runs.** FAIL lines (`expected X, found Y, at PATH`) feed back verbatim into the builder's session as correction instructions. PASS ends the loop.
5. **Escalation.** From the `--escalate-to-validator-count`-th failure (default 3), the VALIDATOR re-enters as a triage diagnostician; its brief travels with the next correction.
6. **Gate repair.** If triage diagnoses a `GATE DEFECT` — the gate itself is unsatisfiable or checks something never asked for — the VALIDATOR rewrites its own gate (once per run, via the same single-path `write` it authored it with). The old gate is preserved as `gate.py.r<N>`, the repair renders as its own loud panel, and the repaired gate re-runs **immediately without consuming a builder round** — if the build was right all along, the loop ends green right there. The repair contract forbids weakening any legitimate check.
7. **Halt.** After `--max-validations` failures (default 5), development stops with the last gate output rendered loudly. No silent infinite loops.

The builder never grades its own homework, and the grader never touches the code — even the gate repair only ever writes the one path the harness dictates.

---

## Two columns, everywhere

<p align="center">
  <img src="images/svg-06-two-column-dx.svg" alt="Architect column and builder column streaming side by side, full-width fusion row, aligned two-cell footer" width="750">
</p>

Output clarity is the product. The harness mirrors the vanilla Pi experience (tool lines, streaming text, footer) but splits it into two columns it completely controls: ARCHITECT-family left, BUILDER right, aligned across the live widget, the final panels, and the footer.

- Hard role + model labels with one consistent color per role: ARCHITECT ◆, BUILDER ▲, FUSION ⧉, VALIDATOR ✓, DEBATER_A ◈, DEBATER_B ◇, JUDGE ⚖, COORDINATOR ◎, PANEL ⊞, CHAIRMAN ♛, ATTACKER ⚡.
- While children run, a live widget streams each agent's tool calls and text in its own column; the fusion stage renders as a full-width row.
- Final panels render full-height into scrollback, so results scroll like normal messages: no hidden lines behind a toggle.
- The footer is replaced with one aligned cell per model: `◆ ARCHITECT | model (med) | [██--------] 12%` (thinking level + context-window bar).
- Child output is buffered per agent, never interleaved, and failures name the exact role, model, and error.

Every default prompt lives next to the extension as `SYSTEM_PROMPT_*.md` / `USER_PROMPT_*.md` with `{{VARIABLE}}` interpolation. Tune the harness by editing files, not code.

---

## The coordination commands

Five coordination commands are now shipped alongside the original three, all built on the same spawn-and-render machinery. Each makes the cast sheet and preflight system available for multi-provider casting.

### `/parallel` — two-way build-off, no merge

Agents: ARCHITECT + BUILDER (castable, both FULL_TOOLS)

Both models execute the same task concurrently with full write/edit tools — a build-off. No merge, no fusion stage. Each agent's result renders in its own column; one agent's failure never suppresses the other's output.

**Flags:** (none)

**Cast rows:** ARCHITECT, BUILDER

**Use case:** When you want two independent implementations to compare, or when the task is too simple to need a merge.

### `/debate` — multi-round dialectic with a castable judge

Agents: DEBATER A (architect side) + DEBATER B (builder side) + JUDGE (castable, fresh session)

Round 1: both debaters answer in parallel with OPINION_TOOLS (read/bash — debate with evidence, no builds). Rounds 2+: each debater **resumes its pinned role session**, receives the opponent's last answer (truncated to the handoff cap), and produces a rebuttal — context accrues across rounds. After each rebuttal, an **early-stop convergence check** can end the debate early. The JUDGE renders the final verdict on a fresh ephemeral session with READONLY_TOOLS.

**Flags:**
- `--rounds N` — total exchanges (default 2, clamp 1-5)
- `--reveal` — judge sees true model identities instead of anonymized "Debater A/B"
- `--no-early-stop` — disable the convergence check, always run all rounds

**Cast rows:** DEBATER A, DEBATER B, JUDGE

**Transcript anonymization:** By default, the judge receives the full transcript with debaters labeled as "Debater A" and "Debater B" only. Model identity strings are best-effort stripped from the text. `--reveal` bypasses anonymization.

**Cost:** bounded by rounds cap (max 5 total exchanges). Each round spawns two opinion-level agents + optional convergence check.

### `/coordinate` — manifest-driven orchestration

Agents: COORDINATOR (architect side, castable) + N WORKERS (builder-side ephemeral)

**Stage 1 — Decomposition:** The COORDINATOR (VALIDATOR_TOOLS: read + write) analyzes the request and writes a `subtasks.json` manifest to a harness-dictated absolute path. The manifest follows a JSON schema with `id`, `title`, `prompt`, `paths` (write-domain globs), and `dependsOn` for each subtask.

**Stage 2 — Level scheduling:** The harness JSON-validates the manifest (loud failure on missing/malformed), then schedules subtasks in dependency levels. Levels run sequentially; subtasks within a level run in **parallel** (`Promise.all`). Each worker is a fresh ephemeral builder-side session with FULL_TOOLS, receiving its owned paths and a strict prohibition on writing outside them.

**Stage 3 — Integration:** The COORDINATOR resumes its session, receives per-subtask status + capped digests, and verifies with READONLY_TOOLS. When gaps are found, it gets **exactly one fix-up pass** (resume with FULL_TOOLS, address named gaps, re-verify). `--no-fix-up` disables the pass (report-only).

**Flags:**
- `--no-fix-up` — report-only integration; do not attempt fix-up on gaps

**Cast rows:** COORDINATOR (WORKERS inherit the builder-side model)

**Cost:** one COORDINATOR spawn + N worker spawns. Only one fix-up pass allowed per run.

### `/council` — anonymized peer-ranking council

Agents: PANEL (K models, multi-picked) + CHAIRMAN (castable, fresh ephemeral)

**Stage 1 — Panel answers:** Every panelist answers the prompt in parallel with OPINION_TOOLS, each in a **fresh ephemeral session** (council members carry no memory). If a panelist fails, the council continues with survivors; below 2 survivors, it halts loudly.

**Stage 2 — Anonymized ranking:** The harness anonymizes answers as Response A/B/C… (letter mapping held in memory; model-id strings are best-effort stripped). Each panelist then ranks the full anonymized set with one-line rationales. Malformed rankings (duplicate/missing letters) are excluded with a note.

**Stage 3 — Aggregation + chairman synthesis:** Valid rankings are aggregated with **Borda count** (no extra model call — transparent arithmetic). The CHAIRMAN (fresh session, READONLY_TOOLS) receives the prompt, answers, and aggregate table, and synthesizes the final answer, noting consensus vs. split points.

**Cast rows:** PANEL (multi-pick checkbox row, min 2 checked, defaults ARCHITECT+BUILDER pre-checked), CHAIRMAN (defaults to architect model)

**Cost:** K panelist spawns + K ranking spawns + 1 chairman spawn. All ephemeral (no memory between councils).

### `/redteam` — adversarial build/attack loop

Agents: BUILDER (builder side) + ATTACKER (architect side, castable, OPINION_TOOLS)

**Build stage:** BUILDER builds the request with FULL_TOOLS via the host-fork spawn (same alter-ego rules as `/auto-validate`'s builder).

**Sortie loop:** The ATTACKER probes the result with OPINION_TOOLS (read, bash — no write/edit tools). Each sortie MUST end with a strict final line: `VERDICT: BREACH — <summary>` or `VERDICT: CONCEDE — <summary>`, parsed by line regex.
- BREACH → the report feeds **verbatim** into the builder's resumed session for a patch
- CONCEDE → the loop ends green
- Missing verdict → retried once, then halt loudly with raw output

Both sides **resume their sessions** across sorties (attack knowledge and patch context accrue). Reaching the round cap with a BREACH renders the last breach report loudly.

**Flags:**
- `--rounds N` — attack/patch cycles (default 3, clamp 1-8)

**Cast rows:** BUILDER, ATTACKER

**Cost:** 1 builder spawn + N attacker spawns + up to N builder patch spawns. Rounds cap bounded.

### K-run rendering

All coordination commands leverage the same K-run rendering system:
- **Live widget:** ≤2 active runs → existing two-column streaming layout; >2 runs → compact one-line-per-run mode (glyph · role · model · status · last activity · tokens)
- **Final panels:** Each run renders as one full-height panel in scrollback with role/model/stats header, in deterministic order
- **Footer:** Stays two cells (architect-side, builder-side) regardless of run count
- **Failure clarity:** Every run's terminal state (done, failed, timeout, aborted) is visible in both the compact widget and its final panel

### Cost table

| Command | Base spawns | Cost driver | Bounded by |
|---|---|---|---|
| `/parallel` | 2 (ARCHITECT + BUILDER) | Two full-tool agents | Single round |
| `/debate` | 2 + JUDGE + convergence per round | Debate rounds + convergence checks | `--rounds` (1-5) |
| `/coordinate` | 1 + N workers + optional fix-up | Subtask count + fix-up pass | Manifest size, one fix-up |
| `/council` | K + K + 1 (CHAIRMAN) | Panelist count (double-spawn: answer + rank) + chairman | K panelists, single pass |
| `/redteam` | 1 + up to 2N | Build + N attack/patch cycles | `--rounds` (1-8) |
| `/gauntlet` | 10+ (whole pipeline) | All stages: council/gate/decompose/build/verify/harden/integrate | `--skip-council` · `--skip-redteam` · cast sheet confirm |
| `/chain` | Varies by stage count | Selected stages only | Stage count, prerequisite validation |

All costs are additive on top of the existing three commands. Rounds/clamp caps keep them bounded.

### Build your own patterns

The README's original "Build your own patterns" teaser promised these commands; they are now shipped. The same spawn-and-render machinery you've seen across all eight commands can express any coordination pattern you can prompt.

This is harness engineering: a harness you own is a harness you can extend the same afternoon you think of the idea.

---

## One node in your software factory

<p align="center">
  <img src="images/video-frames/harness-to-factory-zoom.png" alt="Zoom out: the fusion harness is one shipped node of an AI Developer Workflow inside a larger software factory" width="780">
</p>

Zoom out and the whole harness (two agents, three commands, gate loop and all) is a single agent node inside an AI Developer Workflow. Engineers, code, and agents are the three units of value creation; the fusion harness is how one agent slot in that pipeline stops being a lone model and becomes a validated team. Scale your compute to scale your impact.

---

## Folder structure

The extension directory holds ONLY what the harness loads at runtime — the code and the
prompts it reads. Docs live outside it.

```
fusion-harness/
├── README.md                        # this file — the whole harness, docs included
├── LICENSE                          # MIT
├── justfile                         # task runner — just <recipe>
├── .env                             # API keys (never commit this)
│
├── extensions/
│   └── fusion-harness/              # runtime only
│       ├── fusion-harness.ts        # the whole harness — 8 commands, widget, footer, renderer
│       ├── SYSTEM_PROMPT_*.md       # validator + triage contracts
│       └── USER_PROMPT_*.md         # every default prompt, {{VAR}} interpolated
│
├── live_final_generation/           # artifacts from the on-camera SOTA run (fused bench, gate rounds, manifest)
│
├── images/                          # README visuals
│   ├── svg-*.svg                    # hand-built diagrams (2 animated, 4 still)
│   └── video-frames/                # stills + clean remakes of the video's motion graphics
└── .claude/
    └── commands/
        └── prime.md                 # /prime — orient an agent in this repo
```

---

## Recipes

<p align="center">
  <img src="images/video-frames/model-slot-rack.png" alt="Fusion harness slot rack: Fable 5 in the ARCHITECT slot, GPT-5.6 Sol in the BUILDER slot, Gemini 3.5 Pro day-one in the OPEN slot — role ≠ model" width="780">
</p>

Role ≠ model. Models change quarterly; the harness compounds. Two model tiers are wired in the justfile: **WORKHORSE** (`WORKHORSE_ARCHITECT`/`WORKHORSE_BUILDER`, use for all testing) and **STATE-OF-THE-ART** (`SOTA_ARCHITECT`/`SOTA_BUILDER`, the on-camera pair). The day a new frontier model drops, it slots into either role with one flag.

| Tier | Architect | Builder | Recipe |
|---|---|---|---|
| **WORKHORSE** | `anthropic/claude-sonnet-5` | `openai/gpt-5.6-terra` | `just fh-workhorse` |
| **STATE-OF-THE-ART** | `anthropic/claude-fable-5` | `openai/gpt-5.6-sol` | `just fh-sota` |

Two ways to run it — everything else is a flag.

```
just fh-workhorse       # WORKHORSE tier (use this for testing)
just fh-sota            # STATE-OF-THE-ART tier (fable plans · sol builds + hosts)
```

All flags append to either recipe, e.g. `just fh-workhorse --architect-thinking high --builder-system-prompt ./persona.md`, or `just fh-sota --architect-thinking max --builder-thinking max` to push both roles to max thinking.

<p align="center">
  <img src="images/video-frames/sota-max-artifact-pipeline.png" alt="A full SOTA-tier run: spec → /opinion perspectives → /fusion fused plan → /auto-validate guard iterations → shipped, 6/6 artifacts" width="780">
</p>

That is what a full SOTA run produces end to end: spec in, two perspectives, one fused plan, gated iterations, shipped MVP with evidence. The artifacts from the on-camera run (the fused SQLite benchmark, every gate round, the manifest) live in [`live_final_generation/`](live_final_generation/).

---

## Flags

| Flag | Default | Meaning |
|---|---|---|
| `--architect <provider/id>` | `anthropic/claude-fable-5` | plans / fuses / validates |
| `--builder <provider/id>` | `openai/gpt-5.6-sol` | builds |
| `--architect-thinking <level>` | `medium` | thinking for EVERY architect-family execution (worker/fusion/validator/triage) — `off\|minimal\|low\|medium\|high\|xhigh\|max` |
| `--builder-thinking <level>` | `medium` | thinking for EVERY builder execution — same levels |
| `--architect-system-prompt <text\|path>` | pi default | system prompt for architect worker/fusion agents (VALIDATOR/TRIAGE keep their `SYSTEM_PROMPT_*.md` contracts) |
| `--builder-system-prompt <text\|path>` | pi default | system prompt for all builder agents |
| `--max-validations <n>` | `5` | `/auto-validate`: gate validations before halting (also inline per command) |
| `--escalate-to-validator-count <n>` | `3` | `/auto-validate`: on the Nth failure, VALIDATOR triages the builder's work (also inline) |
| `--child-timeout <seconds>` | `28800` (8h) | timeout for EVERY spawned child (the auto-validate builder never drops below the 8h floor; clamp 10–86400) |

`/fusion` takes its two arguments quoted — `/fusion "prompt" "fusion instruction"` — or separated: `/fusion prompt :: fusion instruction`. With no fusion instruction, the built-in critical merge is used.

---

## Prompts live in files

Every default prompt sits next to the extension with `{{VARIABLE}}` interpolation — tune the harness by editing files, not code.

| File | Used by |
|---|---|
| `SYSTEM_PROMPT_VALIDATOR.md` | gate design (auto-validate step 1) |
| `SYSTEM_PROMPT_TRIAGE.md` | escalation diagnosis |
| `USER_PROMPT_FUSION_WORKER.md` | /fusion ARCHITECT + BUILDER workers |
| `USER_PROMPT_FUSION_MERGE.md` | /fusion FUSION agent (the envelope: both answers + output contract) |
| `USER_PROMPT_FUSION_DEFAULT_INSTRUCTION.md` | fills the merge envelope's `{{FUSION_INSTRUCTION}}` when you don't pass one |
| `USER_PROMPT_OPINION.md` | /opinion both agents |
| `USER_PROMPT_BUILDER.md` · `USER_PROMPT_CORRECTION.md` | auto-validate build + correction rounds |
| `USER_PROMPT_VALIDATOR.md` · `USER_PROMPT_TRIAGE.md` | gate design + triage requests |
| `USER_PROMPT_DEBATE_OPENING.md` | /debate round 1 opening answers |
| `USER_PROMPT_DEBATE_REBUTTAL.md` | /debate rounds 2+ rebuttals ({{OPPONENT_ANSWER}} slot) |
| `USER_PROMPT_DEBATE_JUDGE.md` | /debate judge verdict contract |
| `USER_PROMPT_DEBATE_CONVERGENCE.md` | /debate early-stop convergence check |
| `USER_PROMPT_COORDINATOR.md` | /coordinate decomposition (subtasks.json manifest) |
| `USER_PROMPT_COORDINATOR_WORKER.md` | /coordinate per-subtask worker prompt |
| `USER_PROMPT_COORDINATOR_INTEGRATION.md` | /coordinate integration + verification |
| `USER_PROMPT_COUNCIL_PANELIST.md` | /council stage 1 answer (no self-identification) |
| `USER_PROMPT_COUNCIL_RANKING.md` | /council stage 2 ranking contract |
| `USER_PROMPT_COUNCIL_CHAIRMAN.md` | /council stage 3 chairman synthesis |
| `USER_PROMPT_REDTEAM_BUILDER.md` | /redteam builder build + patch |
| `USER_PROMPT_REDTEAM_ATTACKER.md` | /redteam attacker sortie (VERDICT line contract) |

## Artifacts

Every run makes `/tmp/fusion-harness-XXXXXX/` with `prompt.md`, one `<role>.md` per agent, `fused.md` / `gate.py` + `gate-output.txt` as applicable, `summary.json`, and each child's throwaway session dir. Nothing is ever written into the repo.

Downstream agents are grounded in this dir instead of hunting the filesystem: the FUSION agent's prompt names the run dir and both raw answer files (`architect.md` / `builder.md` — complete even when the inline handoff was truncated), and the VALIDATOR/TRIAGE prompts name the run dir with its per-round builder reports and gate outputs.

---

## Where it can still fail

<p align="center">
  <img src="images/video-frames/blind-spot-coverage-matrix.png" alt="Blind-spot coverage matrix: Fable 5 covers 4/6 concerns, GPT-5.6 Sol 3/6, the fusion harness 5/6 — more coverage ≠ perfect" width="780">
</p>

Two models cover more blind spots than one, and the matrix is honest about the rest: fusion raises coverage, it does not reach perfection, and a shared unknown stays unknown. The concrete failure modes:

- **`uv` missing or a gate timeout**: gate execution errors halt `/auto-validate` immediately with an attributed error; they never burn correction rounds. Install `uv` before relying on gates.
- **A weak gate**: if the baseline run passes before any work happens, the harness warns loudly and proceeds with suspicion. Treat a first-round pass as a gate defect until proven otherwise.
- **`.env` vs exported shell vars**: `just`'s dotenv-load does NOT override variables already exported in your shell. A stale exported key silently wins over the repo `.env`.
- **Parallel writers share one cwd**: `/fusion`'s two workers run concurrently with full tools, so their prompt requires an identity-in-filename (`-ARCHITECT-<model>`) on everything they create. Two agents told to write the same bare path would race and clobber each other — if you ask for one exactly-named file, let the FUSION merge produce it. (`/opinion` children stay read-only/bash-only: it's an A/B read, not a build.)
- **Stale role memories**: the ARCHITECT session persists per project + model across restarts. If it starts reasoning from an old context, `/fh-reset` gives both roles a clean brain.
- **Anthropic usage-policy blocks on fable-5**: Fable ships stricter safety classifiers, and a long accumulated agent transcript can false-positive — observed when a sonnet-built session (turns saying "you are claude-sonnet-5" + script execution) was replayed into fable-5: every request blocked at the API, even `/opinion hello`, while the same prompt on a fresh session passed. The per-model session keying prevents the cross-model case; if a block ever recurs on a long same-model session, `/fh-reset` (or `/new`) clears it.
- **Headless hosts can't fork**: with `--no-session` (headless runs), builder children fall back to a manifest-pinned persistent session instead of forking the host.

---

## Multi-provider casting (v1.1+)

Fusion Harness now supports **multi-provider casting**: instead of two hardcoded model slots (`--architect`/`--builder`), every role (ARCHITECT, BUILDER, FUSION, VALIDATOR — and future JUDGE, PANEL) can hold any model from any registered provider. The cast is the single source of truth for which model plays which role, seeded at boot and mutable at runtime.

### Provider table

| Provider key       | Auth env var            | `/login` command    | Notes                                                                 |
|--------------------|-------------------------|---------------------|-----------------------------------------------------------------------|
| `anthropic`        | `ANTHROPIC_API_KEY`     | `/login anthropic` | Built-in, always available.                                           |
| `openai`           | `OPENAI_API_KEY`        | `/login openai`     | Built-in, always available.                                           |
| `zai` / `zai-coding-cn` | `ZAI_API_KEY`      | `/login zai`        | Zhipu GLM models via `zai/glm-5.2`, `zai/glm-5-turbo` (requires key).|
| `opencode` / `opencode-go` | `OPENCODE_API_KEY` | `/login opencode`   | OpenCode Zen models, dynamic catalog. Requires key.                   |
| `gemini` / `google` | `GEMINI_API_KEY`       | `/login gemini`     | Google Gemini models.                                                 |
| `xai` / `grok`     | `XAI_API_KEY`           | `/login xai`        | xAI Grok models.                                                      |
| `deepseek`         | `DEEPSEEK_API_KEY`      | `/login deepseek`   | DeepSeek models.                                                      |
| `kimi` / `moonshot` | `MOONSHOT_API_KEY`     | `/login kimi`       | Moonshot Kimi models.                                                 |
| `mistral`          | `MISTRAL_API_KEY`       | `/login mistral`    | Mistral models.                                                       |
| *(any)*            | `{PROVIDER}_API_KEY`    | `/login {provider}` | Fallback — known providers have dedicated entries; unknown ones use the generic `_API_KEY` pattern. |

For brand-new model ids not yet in pi's catalog (catalog lag), add a `models.json` stanza:
```json
{ "providers": { "your-provider": { "models": [{ "id": "your-model-id", "name": "your-model-id", "reasoning": true, "input": ["text"], "cost": {}, "contextWindow": 200000, "maxTokens": 8192 }] } } }
```
To `~/.pi/agent/models.json`, then retry. Preflight catches unresolved ids before any spawn and prints an exact stanza skeleton.

### The cast sheet (interactive picker)

Every casted command (`/fusion`, `/auto-validate`, `/opinion`) opens a **cast sheet overlay** on invocation in TUI mode — one row per declared role, pre-filled from the current session cast:

| Role       | Model                                | Thinking | Auth |
|------------|--------------------------------------|----------|------|
| ◆ ARCHITECT | anthropic/claude-fable-5             | med      | ✓    |
| ▲ BUILDER   | openai/gpt-5.6-sol                   | med      | ✓    |
| ⧉ FUSION    | _inherits ARCHITECT_                 | med      | ✓    |

**Navigation**: `↑↓` move between rows, `⏎` or `e` drills into a provider→model list. Inside the drill-down, **type to filter** fuzzy-search narrows hundreds of models; authenticated models sort first. `m` opens a manual `provider/id` entry for catalog-lagged model ids. `t` cycles a row's thinking level (`inherit` → `off` → `minimal` → … → `max` → `inherit`).

Two actions at the bottom:
- **`[S] SAVE`** — writes the current cast to `<cwd>/.fusion-harness.json` AND updates the session cast.
- **`[⏎] RUN`** — commits the cast to the session (models + thinking) and runs the command.
- **`Esc`** — cancels the command with **zero side effects** (no artifacts dir, no spawn).

**`--cast-defaults`** — any casted command accepts an inline `--cast-defaults` argument to skip the sheet for that invocation, using the current session cast as-is:
```
/opinion --cast-defaults Should we use Redis or Postgres?
```

### `/gauntlet <prompt> [--skip-council] [--skip-redteam] [--deliberate=council|debate] [--resume [dir]]` — full campaign pipeline

The gauntlet is the composite command: seven stages running the harness's complete lifecycle in fixed order over one shared artifacts dir (`/tmp/gauntlet-*`).

**Fixed stage order:**

1. **DELIBERATE** — council investigates the request (panel answers, Borda ranking, chairman synthesis) → saves `plan.md`. `--skip-council` writes the prompt verbatim as `plan.md`. `--deliberate=debate` runs a debate (openings + anonymized judge verdict) instead.
2. **GATE-FIRST** — VALIDATOR designs `gate.py` from the prompt + plan digest; baseline must fail RED.
3. **DECOMPOSE** — COORDINATOR reads the prompt, writes `subtasks.json` with path-partitioned write domains.
4. **BUILD** — workers execute dependency levels from the manifest.
5. **VERIFY** — gate correction loop (builder + gate → escalation → gate repair → re-run) until green or halt.
6. **HARDEN** — attacker sortie loop until CONCEDE or cap. `--skip-redteam` jumps straight to INTEGRATE.
7. **INTEGRATE** — COORDINATOR resumes, writes final report against the original prompt.

**Flags:**

| Flag | Effect |
|---|---|
| `--skip-council` | Write prompt verbatim as `plan.md` — skips the council panel entirely |
| `--skip-redteam` | Skip HARDEN — campaign goes from VERIFY-green to INTEGRATE |
| `--deliberate=debate` | Replace council with a debate (rounds + judge verdict as `plan.md`) |
| `--resume [dir]` | Resume a halted campaign from `state.json`; default dir = latest `gauntlet-*` in `/tmp` |

**Cost**: this is the most expensive command (10+ spawns). Use `--skip-council` / `--skip-redteam` to bound it. The cast sheet doubles as the pre-spend confirmation gate.

**Board**: a live widget shows stage progress (k/N · name · elapsed · cumulative cost), per-stage status glyphs, and the subtask checklist from `subtasks.json` once the DECOMPOSE stage completes. A final board panel summarizes the whole run.

**Resume**: every stage writes its outcome to `state.json`. `/gauntlet --resume` (optionally with a dir path) re-enters at the first incomplete stage with the stored prompt and cast — completed stages' artifacts are reused.

### `/chain <stages> <prompt>` — run ordered stage subsets

`/chain` composes any ordered subset of named stages:

```
/chain gate,build,verify <prompt>                                # gate-first → build → verify over one dir
/chain deliberate,gate,decompose,build <prompt>                   # up to BUILD, no verify/integrate
/chain verify,integrate <prompt>                                  # continue from existing artifacts
```

**Stage names:** `deliberate`, `gate`, `decompose`, `build`, `verify`, `harden`, `integrate`.

**Prerequisite validation:** each stage declares its required input files (e.g. `build` needs `subtasks.json`; `verify` needs `gate.py`; `integrate` needs `plan.md`). The chain validates that every required file is either produced by an earlier stage in the chain OR already present in the artifacts dir. On missing prerequisites, the command fails loudly before any spawn.

**Shared conductor:** `/chain` uses the same extracted stage functions, the same cast sheet (rows = union of involved roles), and the same board widget and halt semantics as `/gauntlet`. `/gauntlet <prompt>` is equivalent to `/chain deliberate,gate,decompose,build,verify,harden,integrate <prompt>`.

### `/roles` command

`/roles` opens the same cast sheet over **all known roles** (ARCHITECT, BUILDER, FUSION, VALIDATOR) outside any command. After closing the sheet, it prints the resulting session cast and the project cast file status. Use it to review or set session defaults.

### Project cast file (`<cwd>/.fusion-harness.json`)

SAVE in the sheet writes the current cast (roles → `{ model, thinking? }`) to `<cwd>/.fusion-harness.json` (pretty JSON). Boot seeding order:

**built-in defaults → project file → `--architect`/`--builder` flags → session mutations**

The file is forgiving: unknown roles are ignored, bad model ids are caught by preflight at first use (never at boot). Add `.fusion-harness.json` to your `.gitignore` unless you want to share a cast across the team.

### Per-role thinking levels

Each role carries an optional thinking override. The cast sheet shows it in a `thinking` column; `t` cycles through the levels (plus `inherit`). `--architect-thinking`/`--builder-thinking` flags seed side-level defaults. `/thinking` now accepts role names:
```
/thinking JUDGE low       # set the JUDGE role's thinking to low (fine for future use)
/thinking architect high   # set the architect SIDE default to high
/thinking ARCHITECT high   # role override (same effect for ARCHITECT, but explicit in the cast)
/thinking                  # show side defaults + any role overrides
```

**Caveat**: thinking-level semantics vary across providers. A proxied provider may map levels differently or ignore them — the sheet shows what was requested; the child's actual behavior depends on `--thinking`. Check the provider's docs.

### justfile presets

Two multi-provider launch recipes are now included:

```
just fh-glm   # zai/glm-5.2 · zai/glm-5-turbo  (ZAI_API_KEY required)
just fh-zen   # OpenCode Zen pair  (OPENCODE_API_KEY required, ids dynamic)
```

Plus a generic parameterized recipe:
```
just fh ARCH=zai/glm-5.2 BUILDER=opencode/zen-chat-plus
```

## License

MIT — see [`LICENSE`](LICENSE).

---

## Master Agentic Coding

Prepare for the future of software engineering.

Learn tactical agentic coding patterns with [Tactical Agentic Coding](https://agenticengineer.com/tactical-agentic-coding?y=fuhar).

Follow the [IndyDevDan YouTube channel](https://www.youtube.com/@indydevdan) to improve your agentic coding advantage.

---

Stay Focused and Keep Building

- IndyDevDan
