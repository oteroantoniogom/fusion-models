# Tasks — gauntlet-pipeline

Prerequisite: `five-coordination-commands` applied (which itself requires `multi-provider-cast`).

## 1. Stage extraction (behavior-identical refactor)

- [ ] 1.1 Extract council stage functions (panel answers, anonymized ranking, Borda aggregation, chairman synthesis) from the `/council` handler into shared stage functions; `/council` re-wired to call them
- [ ] 1.2 Extract validator-gate design + baseline, and the gate correction loop (builder resume, escalation → triage → gate repair) from `/auto-validate`
- [ ] 1.3 Extract coordinator decompose + level scheduler + integrate from `/coordinate`
- [ ] 1.4 Extract the redteam sortie loop from `/redteam`
- [ ] 1.5 Re-run the standalone commands' manual matrix after extraction — behavior must be identical before any pipeline work continues

## 2. Pipeline conductor (`/gauntlet`)

- [ ] 2.1 Register `/gauntlet` with usage guard and inline `--skip-council` / `--skip-redteam` parsing
- [ ] 2.2 Campaign runner: fixed stage order, one `gauntlet-*` artifacts dir, stage success gates, halt-on-failure with the completed-stages panel, per-stage `state.json` write (name, status, artifact paths, timestamps, prompt, cast snapshot, accumulated stats)
- [ ] 2.3 DELIBERATE: council stages → save chairman synthesis verbatim as `plan.md`; `--skip-council` writes the prompt verbatim instead; `--deliberate=debate` runs a debate (rounds + anonymized judge verdict) and saves the verdict text as `plan.md`
- [ ] 2.4 GATE-FIRST: validator designs `gate.py` from prompt + `HANDOFF_MAX`-capped plan digest; baseline must run RED (reuse extracted functions)
- [ ] 2.5 DECOMPOSE + BUILD: coordinator manifest from plan digest, then worker levels (extracted scheduler)
- [ ] 2.6 VERIFY: extracted gate correction loop (host-fork builder, escalation, gate repair) until green or halt
- [ ] 2.7 HARDEN: extracted sortie loop until CONCEDE or cap (skipped by flag)
- [ ] 2.8 INTEGRATE: resume coordinator session, final report against `plan.md`, saved to the campaign dir
- [ ] 2.9 Cast sheet integration: six role rows (PANEL multi-pick, CHAIRMAN, VALIDATOR, COORDINATOR, WORKERS, ATTACKER) + stage list reflecting skip/deliberate flags; RUN confirms, Esc aborts with zero side effects; headless mode uses flag-seeded defaults throughout
- [ ] 2.10 Resume: `/gauntlet --resume [dir]` (default latest `gauntlet-*` dir in `/tmp`) loads `state.json`, re-enters at the first non-`done` stage, pre-fills cast sheet from stored cast; loud failure on unknown dir

## 2b. `/chain` composer

- [ ] 2b.1 Define each stage's required input files (e.g. `build` ← `subtasks.json`; `verify` ← `gate.py`; `integrate` ← `plan.md`) as a single declarative map
- [ ] 2b.2 Register `/chain <stages> <prompt>`: parse comma-separated stage names, validate against the set, validate prerequisites from the artifacts dir (earlier-stage outputs OR existing files), fail loud on missing
- [ ] 2b.3 Reuse the same conductor, cast sheet (union of involved roles), board, and halt semantics; `/gauntlet` becomes the canonical full-preset call

## 3. Campaign board

- [ ] 3.1 Live board widget: stage k/6 + name, elapsed, cumulative cost, per-stage status glyphs
- [ ] 3.2 Subtask checklist: ⬜/◐/✓/✗ lines mirroring worker run states, appearing once `subtasks.json` exists and persisting settled through later stages
- [ ] 3.3 Pre-manifest degradation (stage progress only) and narrow-terminal collapse (single status line)
- [ ] 3.4 Final board panel: per-stage outcome, stats, artifact paths, cumulative tokens/cost, rendered full-height at end or halt

## 4. Docs + validation

- [ ] 4.1 README: `/gauntlet` section (stage diagram, all flags including `--deliberate` and `--resume`, cost guidance, board explanation); `/chain` section (stage names, prerequisite semantics, presets); command table update
- [ ] 4.2 `openspec validate gauntlet-pipeline` passes
- [ ] 4.3 Manual matrix on the WORKHORSE tier: full `/gauntlet` on a small real task; `--skip-council`; `--skip-redteam`; `--deliberate=debate`; halt at gate-cap; escape mid-BUILD; `--resume` from a halted campaign; narrow-terminal board; a mixed-provider cast (e.g. zai chairman + attackers over anthropic/openai workers); `/chain gate,build,verify` and `/chain verify,integrate` against leftover artifacts from a prior run
