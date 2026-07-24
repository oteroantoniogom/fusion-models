# Tasks — five-coordination-commands

Prerequisite: `multi-provider-cast` applied (cast map, per-command cast picker, preflight).

## 1. Shared foundations

- [x] 1.1 Extend the widget to a mode switch: ≤2 active runs → existing two columns; >2 → compact one-line-per-run (glyph, role, model, status, last activity, tokens), same refresh cadence
- [x] 1.2 Add a stacked-panels final renderer: one full-height panel per run with role/model/stats header, deterministic order
- [x] 1.3 Add ephemeral-session spawn helper (fresh session in the run's artifacts dir) alongside the existing pinned-session and host-fork paths
- [x] 1.4 Add a strict line-regex verdict parser helper (shared by redteam's `VERDICT:` line and debate's `CONVERGED|DIVERGED` convergence line; reusable for future loop commands)

## 2. `/parallel` (smallest — validates the shared pieces)

- [x] 2.1 Register `/parallel`: usage guard, banner, ARCHITECT + BUILDER with FULL_TOOLS in parallel, no merge stage
- [x] 2.2 Duo final panel with per-agent stats; independent failure rendering
- [x] 2.3 Wire cast rows (ARCHITECT, BUILDER) through picker + preflight

## 3. `/debate`

- [x] 3.1 Prompt files: opening answer, rebuttal (with `{{OPPONENT_ANSWER}}` handoff slot), judge verdict contract
- [x] 3.2 Round loop: round 1 parallel openings (OPINION_TOOLS); rounds 2..N resume pinned role sessions with opponent's last answer truncated to `HANDOFF_MAX`
- [x] 3.3 Inline flag parsing: `--rounds N` (default 2, clamp 1–5), `--reveal`, `--no-early-stop`
- [x] 3.4 Convergence check: after each rebuttal round (unless `--no-early-stop`), a cheap judge-side spawn (READONLY_TOOLS) returns a strict `CONVERGED|DIVERGED` final line via the shared parser; CONVERGED → verdict immediately; unparseable → DIVERGED
- [x] 3.5 JUDGE stage: fresh ephemeral session, READONLY_TOOLS, full transcript **anonymized as Debater A/B by default** (in-memory mapping + model-id string strip; `--reveal` bypasses), verdict contract (winner / strongest each side / what would change the verdict)
- [x] 3.6 Cast rows (DEBATER A→architect side, DEBATER B→builder side, JUDGE) through picker + preflight; stop/failure panels per spec

## 4. `/coordinate`

- [x] 4.1 Prompt files: coordinator decomposition contract (dictated absolute `subtasks.json` path, schema, partition rule), worker prompt (owned paths + no-outside-writes), integration contract
- [x] 4.2 Coordinator stage: VALIDATOR_TOOLS spawn, read manifest from disk, JSON-schema-validate (ids, prompt, non-empty paths, dependsOn), loud failure on missing/invalid
- [x] 4.3 Level scheduler: topological levels from `dependsOn`; sequential levels, `Promise.all` within a level; fresh ephemeral builder-side workers with FULL_TOOLS
- [x] 4.4 Integration stage: resume coordinator session with per-subtask status + capped digests; READONLY_TOOLS verification; on named gaps, exactly one fix-up pass (resume with FULL_TOOLS, then read-only re-verify + final report); `--no-fix-up` disables
- [x] 4.5 Cast rows (COORDINATOR, WORKERS→builder side) through picker + preflight; stop-between-levels panel

## 5. `/council`

- [x] 5.1 Prompt files: panelist answer contract (no self-identification), ranking contract (ordered letters + rationale), chairman synthesis contract
- [x] 5.2 PANEL as a multi-pick row in the cast sheet (min 2 checked, defaults ARCHITECT+BUILDER pre-checked); CHAIRMAN cast row; preflight across all picked models
- [x] 5.3 Stage 1: parallel panelists, OPINION_TOOLS, fresh ephemeral sessions; degrade to survivors (fail loud below 2)
- [x] 5.4 Stage 2: anonymize (letter mapping in memory, model-id string strip), per-panelist full ranking; exclude malformed rankings with a note
- [x] 5.5 Stage 3: Borda aggregation (no model call), aggregate table panel, chairman synthesis (READONLY_TOOLS, fresh session)
- [x] 5.6 Stacked panels for answers + rankings table + chairman final

## 6. `/redteam`

- [x] 6.1 Prompt files: attacker sortie contract (probe, then strict `VERDICT: BREACH|CONCEDE — summary` final line), builder patch contract
- [x] 6.2 Build stage: builder host-fork spawn with FULL_TOOLS
- [x] 6.3 Sortie loop: attacker (OPINION_TOOLS, no write/edit) resumes its session across sorties; verdict parse → BREACH feeds verbatim into resumed builder session; CONCEDE ends green; missing verdict retries once then halts loud
- [x] 6.4 Inline `--rounds N` (default 3, clamp 1–8); cap-hit halt renders last breach report loudly
- [x] 6.5 Cast rows (BUILDER, ATTACKER) through picker + preflight

## 7. Docs + validation

- [x] 7.1 README: replace the "Build your own patterns" teaser with shipped docs per command (usage, rounds flags, cast rows, costs); update command table and folder structure
- [x] 7.2 `openspec validate five-coordination-commands` passes
- [ ] 7.3 Manual matrix on the WORKHORSE tier: each command end-to-end, escape mid-run, one-agent-failure path, and a mixed-provider cast (e.g. zai judge over anthropic/openai debaters)
