# ARCHITECT REVIEW — opencode-go/deepseek-v4-pro

## Two PRs under review

| PR | Branch | Commits | +lines | Core change |
|----|--------|---------|--------|-------------|
| **A** | `multi-provider-cast` | 1 commit (`d463398`) | +722 in fusion-harness.ts | Cast system, preflight, cast sheet, /roles, /thinking rewrite |
| **B** | `five-coordination-commands` | 2 commits (`d463398` + `eebbdb5`) | +1222 in fusion-harness.ts | /parallel, /debate, /coordinate, /council, /redteam |

PR B depends on PR A (includes its commit). The review analyzes both independently and combined.

---

## REVIEW BY AREA

### 1. MISSING DECLARATIONS (imports, types, constants) — CRITICAL

**Both PR branches reference symbols that are NEVER imported or declared.** This means the code as committed CANNOT compile.

#### 1.1 Missing pi-tui imports

The code uses these symbols but never imports them from `@earendil-works/pi-tui`:

| Symbol | Used by | File:line (five-coordination-commands branch) |
|--------|---------|-----------------------------------------------|
| `Input` | `new Input()` in CastSheet constructor | :1034 |
| `matchesKey` | CastSheet.handleInput, handleRows, handleDrill, handleManual | :1166,1182,1184,1187,1206,1212,1223,1227,1232,1258 |
| `fuzzyFilter` | CastSheet.filteredItems | :1108 |
| `Component` | `class CastSheet implements Component` | :1014 |
| `Focusable` | Implicit through `focused` property | :1014-1015 |
| `TUI` | CastSheetInit interface, CastSheet class | :990,1016 |
| `ExtensionUIContext` | openCastSheet function | :2369 |

The import line at :70 is:
```typescript
import { Box, Container, Markdown, Text, truncateToWidth, visibleWidth, wrapTextWithAnsi } from "@earendil-works/pi-tui";
```

**Fix**: Add the missing symbols:
```typescript
import {
  Box, Component, Container, Focusable, Input, Markdown, Text,
  truncateToWidth, visibleWidth, wrapTextWithAnsi,
  matchesKey, fuzzyFilter,
  type TUI, type ExtensionUIContext,
} from "@earendil-works/pi-tui";
```

#### 1.2 Missing type definitions

| Symbol | Used at | File:line |
|--------|---------|-----------|
| `Cast` | `const cast: Cast = {}` | :1450 |
| `CastMember` | `const member: CastMember = ...` | :1465 |
| `Side` | `type Side` used in `thinkingOverride` | :1566 |
| `Thinking` | `thinkingOverride` type annotation | :1566 |

**Fix**: Add definitions (BOTH branches need these):
```typescript
type Side = "architect" | "builder";
type Thinking = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";
interface CastMember { model: string; thinking?: Thinking; }
type Cast = Partial<Record<string, CastMember>>;
```

#### 1.3 Missing constants

| Constant | Used at | File:line |
|----------|---------|-----------|
| `CAST_FILE` | `readProjectCast`, `saveProjectCastUsing`, cast sheet, /roles | :1458,2361,2492,2495 |
| `KNOWN_ROLES` | `openCastSheet`, `runCastGate`, castSummary, /thinking | :2360,2366,2399,2432 |
| `ROLE_SIDE` | CastSheet.inheritedModel, castModel fallback, castThinking, /thinking | :1057,1508,1573 |
| `SIDE_PRIMARY` | CastSheet.inheritedModel, castModel fallback | :1057,1508 |
| `THINKING_CYCLE` | CastSheet.cycleThinking | :1132,1133 |
| `THINKING_ALIAS` | `readProjectCast` | :1468 |
| `THINKING_HELP` | /thinking command descriptions | :2428,2441,2454,2477 |

**These must appear BEFORE the CastSheet class definition** (which references them).

#### 1.4 Missing functions

| Function | Used at | File:line |
|----------|---------|-----------|
| `isKnownRole` | `readProjectCast` | :1462 |
| `resolveThinking` | `roleThinking`, /thinking command | :1570,2445,2453,2460,2465,2471 |

### 2. MISSING Role TYPE EXPANSION — CRITICAL

The `Role` type at :105 is:
```typescript
type Role = "ARCHITECT" | "BUILDER" | "FUSION" | "VALIDATOR";
```

But the five-coordination-commands branch uses these roles extensively:
- `DEBATER_A` — :3251,3293,3296 etc.
- `DEBATER_B` — :3252,3297 etc.
- `JUDGE` — :2392,3265,3303 etc.
- `COORDINATOR` — :2394
- `PANEL` — :2395,3393,3402 etc.
- `CHAIRMAN` — :2395,3404 etc.
- `ATTACKER` — :2396,3480 etc.

**Fix** (both branches need this):
```typescript
type Role = "ARCHITECT" | "BUILDER" | "FUSION" | "VALIDATOR"
  | "DEBATER_A" | "DEBATER_B" | "JUDGE"
  | "COORDINATOR" | "PANEL" | "CHAIRMAN" | "ATTACKER";
```

And correspondingly, `ROLE_COLOR` and `ROLE_GLYPH` must be extended for all new roles.

### 3. `/opinion` HANDLER NOT INTEGRATED WITH CAST SYSTEM — HIGH

The `/opinion` handler in the five-coordination-commands branch (section 8.19, ~line 3498) still uses:
```typescript
const aModel = architectModel();  // old slot function
const bModel = builderModel();    // old slot function
// ...
thinking: roleThinking("architect"),  // old per-side thinking
```

It does NOT:
- Call `runCastGate(ctx, "opinion", skip)` (no preflight, no cast sheet)
- Use `castModel("ARCHITECT")` / `castModel("BUILDER")` 
- Use `castThinking()` for role-specific thinking overrides
- Honor `--cast-defaults`

This means `/opinion` bypasses the entire cast system. The four original commands (`/fusion`, `/auto-validate`, `/opinion`, `/system-prompt`) were supposed to be migrated. `/fusion` and `/auto-validate` were migrated on the multi-provider-cast branch but `/opinion` was apparently missed in the five-coordination-commands merge.

### 4. `parseStrictVerdictLine` NOT USED FOR DEBATE CONVERGENCE — MEDIUM

The function `parseStrictVerdictLine` was added for "shared by redteam, debate, future loop commands" (section 4b comment). But the debate handler's convergence check (:3303) uses raw regex:
```typescript
if (/^converged[\s—]/i.test(lastLine) || /^converged$/i.test(lastLine))
```

This works but is inconsistent — two different parsing approaches for the same contract pattern. The raw regex is more permissive (case-insensitive, no colon required) than `parseStrictVerdictLine`.

**Recommendation**: Either (a) use `parseStrictVerdictLine(conv.text, "CONVERGED")` consistently, or (b) document that convergence check intentionally uses a different contract.

### 5. `clampDebateRounds(NaN)` BUG — LOW

```typescript
const clampDebateRounds = (n: number): number => Math.max(1, Math.min(5, Math.floor(n)));
```

`Math.floor(NaN)` → `NaN`, then `Math.max(1, NaN)` → `NaN`. The same pattern exists in `clampRedteamRounds`. `clampValidations` handles this correctly via `Number.isFinite(n)` guard.

**Fix**: Add `Number.isFinite(n)` guards:
```typescript
const clampDebateRounds = (n: number): number => 
  Number.isFinite(n) ? Math.max(1, Math.min(5, Math.floor(n))) : 2; // default 2
```

### 6. Other observations

#### 6.1 `splitModel("/id")` edge case — LOW
`splitModel` uses `slash > 0` (not `>= 0`), so a leading slash produces `{ provider: "/id", id: "" }`. Preflight catches this as "unresolved" — low risk.

#### 6.2 Anonymization is best-effort — DOCUMENTED
`stripModelParts` strips segments >3 chars from model strings. A panelist could still self-identify through creative phrasing. This is acknowledged in the design doc (D4 risks: "anonymization blunts but can't eliminate").

#### 6.3 Test suite coverage
The test suite at `tests/test-suite-ARCHITECT-opencode-go-deepseek-v4-pro.ts` covers:
- All 11 role types, their colors, glyphs, sides, and side primaries
- Cast model resolution (explicit, inherited, default fallbacks) for every new role
- Cast seeding precedence (defaults → project file → flags)
- Cast thinking overrides
- `parseStrictVerdictLine` with all variants (BREACH, CONCEDE, multi-word values, anchored matches, case sensitivity, bottom-up scanning)
- Convergence check regex (raw pattern actually used in debate handler)
- Round clamping (debate 1-5, redteam 1-8, validations 1-20)
- Manifest validation (all error paths: missing id, duplicate id, missing prompt, empty paths, non-object, empty array)
- Topological sort (independent, dependent, complex graph, unknown dep, circular, self-loop)
- Borda count (2-candidate, 3-candidate tie, malformed ranking exclusion, invalid letter exclusion, empty input)
- Model string stripping (provider stripping, multiple models, short-segment protection, case insensitivity)
- Preflight helpers (splitModel all variants)
- Ephemeral spawn path construction
- Truncation (under limit, over limit, HANDOFF_MAX)
- Tool-allowlist contracts for every role in every command
- Multi-pick PANEL parsing
- Letter mapping for council anonymization
- Known bugs (NaN clamp, empty string splitModel)

**83 tests, all passing.**

### 7. SUMMARY OF REQUIRED FIXES

| # | Severity | What | Where |
|---|----------|------|-------|
| 1 | **CRITICAL** | Add 8 missing pi-tui imports (`Input`, `matchesKey`, `fuzzyFilter`, `Component`, `Focusable`, `TUI`, `ExtensionUIContext`) | import line at :70 |
| 2 | **CRITICAL** | Add missing type definitions: `Side`, `Thinking`, `Cast`, `CastMember` | After imports, before section 1 |
| 3 | **CRITICAL** | Add missing constants: `CAST_FILE`, `KNOWN_ROLES`, `ROLE_SIDE`, `SIDE_PRIMARY`, `THINKING_CYCLE`, `THINKING_ALIAS`, `THINKING_HELP` | After types, before section 4b/CastSheet |
| 4 | **CRITICAL** | Add missing functions: `isKnownRole`, `resolveThinking` | Before their first use |
| 5 | **CRITICAL** | Expand `Role` type to include 7 new roles | :105 |
| 6 | **CRITICAL** | Extend `ROLE_COLOR` and `ROLE_GLYPH` for all 11 roles | :108-123 |
| 7 | **HIGH** | Migrate `/opinion` handler to use cast system (`castModel`, `castThinking`, `runCastGate`) | section 8.19 |
| 8 | **LOW** | Add `Number.isFinite()` guard to `clampDebateRounds` and `clampRedteamRounds` | :2688, :3445 |
| 9 | **LOW** | Consider using `parseStrictVerdictLine` in debate convergence check for consistency | :3303 |
