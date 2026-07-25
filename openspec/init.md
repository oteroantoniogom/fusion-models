# SDD Init — fusion-models / fusion-harness

**Date:** 2026-07-25  
**Status:** complete

## Stack

| Area | Detail |
|------|--------|
| Product | Pi coding-agent extension (`extensions/fusion-harness/fusion-harness.ts`) |
| Language | TypeScript (Node), file-backed markdown prompts |
| Launch | `just fh` (+ tier recipes in `justfile`) |
| Tests | `tests/*.ts` via `npx tsx` + `node:assert` |
| Package root | No `package.json`; no Jest/Vitest/pytest harness |
| Gates | `/auto-validate` uses Astral `uv` PEP 723 scripts at runtime |

## Testing capabilities

- **Primary runner:** `npx tsx tests/test-gauntlet.ts`
- **Integration:** `npx tsx tests/test-suite-gauntlet-pipeline.ts`
- **Fast gauntlet layers:** `PI_GAUNTLET_SKIP_RUNTIME=1 npx tsx tests/gauntlet-works-ARCHITECT-zai-glm-5.2.ts`
- **E2E (needs provider keys):** `PI_GAUNTLET_E2E=1 npx tsx tests/gauntlet-works-ARCHITECT-zai-glm-5.2.ts`
- **Strict TDD:** enabled in `openspec/config.yaml`

## Scaffolding created

- `openspec/config.yaml` — schema, context, rules, testing, quality
- `openspec/specs/` — canonical specs (empty)
- `openspec/changes/` — active changes (empty)
- `.gitignore` — stopped ignoring entire `openspec/` tree so SDD can be versioned

## Missing / deferred

- **AGENTS.md** — not present; harness bootstrap not part of this init
- **`.atl/skill-registry.md`** — missing (no skill-registry data / Serena unavailable)
- **Lint/typecheck/format** — no repo-root scripts detected

## Next

Proceed to `sdd-explore` or `sdd-proposal` for the next change idea.
