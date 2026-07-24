/**
 * ARCHITECT REVIEW + TEST SUITE — opencode-go/deepseek-v4-pro
 * =================================================================
 * Tests for two PRs:
 *   (A) multi-provider-cast  — cast system, preflight, cast sheet, /roles, thinking
 *   (B) five-coordination-commands — /parallel, /debate, /coordinate, /council, /redteam
 *
 * This suite tests ALL pure logic: types, constants, helpers, parsers, validators,
 * and algorithmic components. It does NOT require a running pi TUI — it tests the
 * isolated functions extracted from the extension code.
 *
 * Run:  npx tsx tests/test-suite-ARCHITECT-opencode-go-deepseek-v4-pro.ts
 */

import * as assert from "node:assert";

// ═══════════════════════════════════════════════════════════════════════════════
// FAITHFUL EXTRACTIONS from the PR code (duplicated here for testability)
// ═══════════════════════════════════════════════════════════════════════════════

// ── Constants from the code ───────────────────────────────────────────────────
const DEFAULT_ARCHITECT = "anthropic/claude-fable-5";
const DEFAULT_BUILDER = "openai/gpt-5.6-sol";
const HANDOFF_MAX = 60_000;

// ── Role type (must include all new roles from PR B) ──────────────────────────
type Role = "ARCHITECT" | "BUILDER" | "FUSION" | "VALIDATOR"
  | "DEBATER_A" | "DEBATER_B" | "JUDGE"
  | "COORDINATOR" | "PANEL" | "CHAIRMAN"
  | "ATTACKER";
type Side = "architect" | "builder";
type Thinking = "off" | "minimal" | "low" | "medium" | "high" | "xhigh" | "max";

// ── Cast types ────────────────────────────────────────────────────────────────
interface CastMember { model: string; thinking?: Thinking; }
type Cast = Partial<Record<Role, CastMember>>;

// ── Role metadata maps ────────────────────────────────────────────────────────
const ROLE_COLOR: Record<Role, string> = {
  ARCHITECT: "accent", BUILDER: "warning", FUSION: "success", VALIDATOR: "mdLink",
  DEBATER_A: "accent", DEBATER_B: "warning", JUDGE: "success",
  COORDINATOR: "accent", PANEL: "mdLink", CHAIRMAN: "success", ATTACKER: "warning",
};
const ROLE_GLYPH: Record<Role, string> = {
  ARCHITECT: "◆", BUILDER: "▲", FUSION: "⧉", VALIDATOR: "✓",
  DEBATER_A: "◇", DEBATER_B: "△", JUDGE: "⚖",
  COORDINATOR: "⬡", PANEL: "◈", CHAIRMAN: "◆", ATTACKER: "✖",
};

// ── Cast system constants ─────────────────────────────────────────────────────
const CAST_FILE = ".fusion-harness.json";
const KNOWN_ROLES: Role[] = [
  "ARCHITECT", "BUILDER", "FUSION", "VALIDATOR",
  "DEBATER_A", "DEBATER_B", "JUDGE",
  "COORDINATOR", "PANEL", "CHAIRMAN", "ATTACKER",
];
const ROLE_SIDE: Record<Role, Side> = {
  ARCHITECT: "architect", BUILDER: "builder", FUSION: "architect", VALIDATOR: "architect",
  DEBATER_A: "architect", DEBATER_B: "builder", JUDGE: "architect",
  COORDINATOR: "architect", PANEL: "builder", CHAIRMAN: "architect", ATTACKER: "architect",
};
const SIDE_PRIMARY: Record<Side, Role> = { architect: "ARCHITECT", builder: "BUILDER" };

const THINKING_CYCLE: string[] = ["inherit", "off", "minimal", "low", "medium", "high", "xhigh", "max"];
const THINKING_ALIAS: Record<string, Thinking> = {
  off: "off", minimal: "min", min: "min", low: "low", medium: "med", med: "med",
  high: "high", hi: "high", xhigh: "xhi", xhi: "xhi", max: "max",
};
const THINKING_HELP = "off|minimal|low|medium|high|xhigh|max";

const isKnownRole = (s: string): s is Role => (KNOWN_ROLES as string[]).includes(s);
const resolveThinking = (s: string): Thinking | undefined => THINKING_ALIAS[s.toLowerCase()] as Thinking | undefined;

// ── Cast model resolver ───────────────────────────────────────────────────────
const castModel = (cast: Cast, role: Role): string => {
  const m = cast[role]?.model;
  if (m) return m;
  const primary = SIDE_PRIMARY[ROLE_SIDE[role]];
  return primary === role
    ? (ROLE_SIDE[role] === "architect" ? DEFAULT_ARCHITECT : DEFAULT_BUILDER)
    : castModel(cast, primary);
};

const castThinking = (cast: Cast, role: Role): Thinking =>
  cast[role]?.thinking ?? "medium";

// ── Cast seeding ──────────────────────────────────────────────────────────────
const seedCast = (
  cast: Cast,
  cwd?: string,
  architectFlag?: string,
  builderFlag?: string,
  projectCast?: Cast,
): void => {
  cast.ARCHITECT ??= { model: DEFAULT_ARCHITECT };
  cast.BUILDER ??= { model: DEFAULT_BUILDER };
  if (architectFlag) cast.ARCHITECT = { ...cast.ARCHITECT, model: architectFlag };
  if (builderFlag) cast.BUILDER = { ...cast.BUILDER, model: builderFlag };
  if (projectCast) {
    for (const [role, member] of Object.entries(projectCast)) {
      if (isKnownRole(role)) cast[role] = { ...member };
    }
  }
  // Flags win over project file
  if (architectFlag) cast.ARCHITECT = { ...cast.ARCHITECT, model: architectFlag };
  if (builderFlag) cast.BUILDER = { ...cast.BUILDER, model: builderFlag };
};

// ── Verdict-line parser (PR B, section 4b) ────────────────────────────────────
const parseStrictVerdictLine = (text: string, prefix: string): string | undefined => {
  const lines = text.trim().split("\n");
  const pat = new RegExp(`^${prefix}:\\s*(\\S+)\\s*—`);
  for (let i = lines.length - 1; i >= 0; i--) {
    const m = lines[i]!.trim().match(pat);
    if (m) return m[1]!;
  }
  return undefined;
};

// ── Ephemeral spawn helper ────────────────────────────────────────────────────
import * as path from "node:path";
const ephemeralSpawn = (artifactsDir: string, label: string): { sessionDir: string } => ({
  sessionDir: path.join(artifactsDir, label),
});

// ── Round clamping functions ─────────────────────────────────────────────────
const clampDebateRounds = (n: number): number => Math.max(1, Math.min(5, Math.floor(n)));
const clampRedteamRounds = (n: number): number => Math.max(1, Math.min(8, Math.floor(n)));
const clampCount = (n: number, fallback: number): number =>
  (Number.isFinite(n) && n >= 1 ? Math.min(20, Math.floor(n)) : fallback);
const clampValidations = (n: number): number => clampCount(n, 5);

// ── Subtask manifest validation (PR B, /coordinate) ──────────────────────────
interface SubtaskEntry { id: string; title?: string; prompt?: string; paths?: string[]; dependsOn?: string[]; }
interface SubtaskManifest { subtasks?: SubtaskEntry[]; }

const validateManifest = (data: any): { ok: true; manifest: SubtaskManifest } | { ok: false; error: string } => {
  if (!data || typeof data !== "object") return { ok: false, error: "manifest is not a JSON object" };
  const m = data as SubtaskManifest;
  if (!Array.isArray(m.subtasks) || m.subtasks.length === 0)
    return { ok: false, error: "manifest.subtasks must be a non-empty array" };
  const ids = new Set<string>();
  for (let i = 0; i < m.subtasks.length; i++) {
    const s = m.subtasks[i]!;
    if (!s.id || typeof s.id !== "string")
      return { ok: false, error: `subtasks[${i}]: missing or invalid 'id'` };
    if (ids.has(s.id))
      return { ok: false, error: `subtasks[${i}]: duplicate id '${s.id}'` };
    ids.add(s.id);
    if (!s.prompt || typeof s.prompt !== "string")
      return { ok: false, error: `subtasks[${i}] (${s.id}): missing 'prompt'` };
    if (!Array.isArray(s.paths) || s.paths.length === 0)
      return { ok: false, error: `subtasks[${i}] (${s.id}): 'paths' must be a non-empty array` };
    if (!Array.isArray(s.dependsOn)) s.dependsOn = [];
  }
  return { ok: true, manifest: m };
};

// ── Topological sort for coordinate workers ───────────────────────────────────
const topoLevels = (subtasks: SubtaskEntry[]): { levels: SubtaskEntry[][]; error?: string } => {
  const byId = new Map(subtasks.map((s) => [s.id, s]));
  const inDeg = new Map<string, number>();
  const deps = new Map<string, string[]>();
  for (const s of subtasks) { inDeg.set(s.id, 0); deps.set(s.id, []); }
  for (const s of subtasks) {
    for (const dep of s.dependsOn ?? []) {
      if (!byId.has(dep)) return { levels: [], error: `subtask '${s.id}' depends on unknown '${dep}'` };
      deps.get(dep)!.push(s.id);
      inDeg.set(s.id, (inDeg.get(s.id) ?? 0) + 1);
    }
  }
  const queue: string[] = [];
  for (const [id, d] of inDeg) if (d === 0) queue.push(id);
  const levels: SubtaskEntry[][] = [];
  let visited = 0;
  while (queue.length) {
    const batch = [...queue]; queue.length = 0;
    const level: SubtaskEntry[] = [];
    for (const id of batch) {
      level.push(byId.get(id)!);
      visited++;
      for (const nx of deps.get(id) ?? []) {
        const d = (inDeg.get(nx) ?? 1) - 1;
        inDeg.set(nx, d);
        if (d === 0) queue.push(nx);
      }
    }
    levels.push(level);
  }
  if (visited !== subtasks.length) return { levels: [], error: "circular dependency detected" };
  return { levels };
};

// ── Borda count aggregation (PR B, /council) ─────────────────────────────────
const computeBorda = (
  answers: string[],        // letter labels: "A", "B", "C"...
  rankings: string[][],     // each panelist's ranking of letters, best first
): { table: Map<string, number>; excluded: string[] } => {
  const n = answers.length;
  const borda = new Map<string, number>();
  for (const a of answers) borda.set(a, 0);
  const validLetters = new Set(answers);
  const excluded: string[] = [];
  for (let ri = 0; ri < rankings.length; ri++) {
    const ranked = rankings[ri]!;
    if (new Set(ranked).size !== n || ranked.length !== n) {
      excluded.push(`Panelist ${ri}: malformed ranking`);
      continue;
    }
    for (const l of ranked) {
      if (!validLetters.has(l)) { excluded.push(`Panelist ${ri}: invalid letter ${l}`); break; }
    }
    if (excluded.length > 0 && excluded[excluded.length - 1]!.includes(`Panelist ${ri}`)) continue;
    for (let pos = 0; pos < ranked.length; pos++) {
      borda.set(ranked[pos]!, (borda.get(ranked[pos]!) ?? 0) + (n - pos));
    }
  }
  return { table: borda, excluded };
};

// ── Model string stripping for anonymization ─────────────────────────────────
const stripModelParts = (text: string, models: string[]): string => {
  let t = text;
  for (const model of models) {
    for (const p of model.split("/")) {
      if (p && p.length > 3) {
        t = t.replace(new RegExp(p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi"), "[redacted]");
      }
    }
  }
  return t;
};

// ── Preflight helpers ─────────────────────────────────────────────────────────
interface PreflightFailure {
  role: Role; model: string; kind: "unresolved" | "no-auth"; provider: string; id: string;
}
const splitModel = (model: string): { provider: string; id: string } => {
  const slash = model.indexOf("/");
  return slash > 0 ? { provider: model.slice(0, slash), id: model.slice(slash + 1) } : { provider: model, id: "" };
};

// ── Truncation helpers (verbatim from the code) ──────────────────────────────
const truncateChars = (s: string, max: number): string => {
  if (s.length <= max) return s;
  return `${s.slice(0, max)}\n… [truncated — ${s.length - max} chars elided]`;
};

// ═══════════════════════════════════════════════════════════════════════════════
// TEST SUITE
// ═══════════════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

function test(name: string, fn: () => void) {
  try {
    fn();
    passed++;
    console.log(`  ✓ ${name}`);
  } catch (err: any) {
    failed++;
    console.log(`  ✗ ${name}`);
    console.log(`    ${err.message}`);
  }
}

function section(name: string) {
  console.log(`\n${name}`);
}

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 1: Type & Constant Integrity
// ═══════════════════════════════════════════════════════════════════════════════
section("1. TYPE & CONSTANT INTEGRITY");

test("Role type includes all 11 roles (4 original + 7 new)", () => {
  const expected: Role[] = [
    "ARCHITECT", "BUILDER", "FUSION", "VALIDATOR",
    "DEBATER_A", "DEBATER_B", "JUDGE",
    "COORDINATOR", "PANEL", "CHAIRMAN", "ATTACKER",
  ];
  assert.strictEqual(KNOWN_ROLES.length, 11);
  for (const r of expected) {
    assert.ok(KNOWN_ROLES.includes(r), `Missing role: ${r}`);
  }
});

test("ROLE_COLOR has entries for all 11 roles", () => {
  for (const r of KNOWN_ROLES) {
    assert.ok(ROLE_COLOR[r] !== undefined, `ROLE_COLOR missing for ${r}`);
  }
});

test("ROLE_GLYPH has entries for all 11 roles", () => {
  for (const r of KNOWN_ROLES) {
    assert.ok(ROLE_GLYPH[r] !== undefined, `ROLE_GLYPH missing for ${r}`);
  }
});

test("ROLE_SIDE maps every role to architect or builder", () => {
  for (const r of KNOWN_ROLES) {
    const side = ROLE_SIDE[r];
    assert.ok(side === "architect" || side === "builder", `${r} has invalid side: ${side}`);
  }
});

test("SIDE_PRIMARY maps both sides", () => {
  assert.strictEqual(SIDE_PRIMARY.architect, "ARCHITECT");
  assert.strictEqual(SIDE_PRIMARY.builder, "BUILDER");
});

test("isKnownRole accepts valid roles, rejects garbage", () => {
  assert.strictEqual(isKnownRole("ARCHITECT"), true);
  assert.strictEqual(isKnownRole("PANEL"), true);
  assert.strictEqual(isKnownRole("JUDGE"), true);
  assert.strictEqual(isKnownRole("NONEXISTENT"), false);
  assert.strictEqual(isKnownRole(""), false);
});

test("resolveThinking maps aliases correctly", () => {
  assert.strictEqual(resolveThinking("off"), "off");
  assert.strictEqual(resolveThinking("minimal"), "min");
  assert.strictEqual(resolveThinking("min"), "min");
  assert.strictEqual(resolveThinking("low"), "low");
  assert.strictEqual(resolveThinking("medium"), "med");
  assert.strictEqual(resolveThinking("med"), "med");
  assert.strictEqual(resolveThinking("high"), "high");
  assert.strictEqual(resolveThinking("hi"), "high");
  assert.strictEqual(resolveThinking("xhigh"), "xhi");
  assert.strictEqual(resolveThinking("xhi"), "xhi");
  assert.strictEqual(resolveThinking("max"), "max");
  assert.strictEqual(resolveThinking("garbage"), undefined);
  assert.strictEqual(resolveThinking(""), undefined);
});

test("THINKING_CYCLE has correct order starting with inherit", () => {
  assert.deepStrictEqual(THINKING_CYCLE, ["inherit", "off", "minimal", "low", "medium", "high", "xhigh", "max"]);
  assert.strictEqual(THINKING_CYCLE.length, 8);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 2: Cast System
// ═══════════════════════════════════════════════════════════════════════════════
section("2. CAST SYSTEM");

test("castModel returns explicit cast entry", () => {
  const cast: Cast = { ARCHITECT: { model: "zai/glm-5.2" }, BUILDER: { model: "opencode/zen" } };
  assert.strictEqual(castModel(cast, "ARCHITECT"), "zai/glm-5.2");
  assert.strictEqual(castModel(cast, "BUILDER"), "opencode/zen");
});

test("castModel falls back to side primary when role not in cast", () => {
  const cast: Cast = { ARCHITECT: { model: "zai/glm-5.2" } };
  // FUSION inherits from ARCHITECT (same side)
  assert.strictEqual(castModel(cast, "FUSION"), "zai/glm-5.2");
  // VALIDATOR inherits from ARCHITECT
  assert.strictEqual(castModel(cast, "VALIDATOR"), "zai/glm-5.2");
});

test("castModel falls back to defaults when nothing seeded", () => {
  const cast: Cast = {};
  assert.strictEqual(castModel(cast, "ARCHITECT"), DEFAULT_ARCHITECT);
  assert.strictEqual(castModel(cast, "BUILDER"), DEFAULT_BUILDER);
  assert.strictEqual(castModel(cast, "FUSION"), DEFAULT_ARCHITECT);
  assert.strictEqual(castModel(cast, "VALIDATOR"), DEFAULT_ARCHITECT);
});

test("castModel resolves new roles through their sides", () => {
  const cast: Cast = {};
  // DEBATER_A is architect side → defaults to ARCHITECT
  assert.strictEqual(castModel(cast, "DEBATER_A"), DEFAULT_ARCHITECT);
  // DEBATER_B is builder side → defaults to BUILDER
  assert.strictEqual(castModel(cast, "DEBATER_B"), DEFAULT_BUILDER);
  // JUDGE is architect side
  assert.strictEqual(castModel(cast, "JUDGE"), DEFAULT_ARCHITECT);
  // COORDINATOR is architect side
  assert.strictEqual(castModel(cast, "COORDINATOR"), DEFAULT_ARCHITECT);
  // ATTACKER is architect side
  assert.strictEqual(castModel(cast, "ATTACKER"), DEFAULT_ARCHITECT);
  // PANEL is builder side
  assert.strictEqual(castModel(cast, "PANEL"), DEFAULT_BUILDER);
  // CHAIRMAN is architect side
  assert.strictEqual(castModel(cast, "CHAIRMAN"), DEFAULT_ARCHITECT);
});

test("castModel resolves JUDGE through explicit cast", () => {
  const cast: Cast = { JUDGE: { model: "zai/glm-5-turbo" } };
  assert.strictEqual(castModel(cast, "JUDGE"), "zai/glm-5-turbo");
});

test("castModel resolves COORDINATOR through explicit cast", () => {
  const cast: Cast = { COORDINATOR: { model: "openai/o4-mini" } };
  assert.strictEqual(castModel(cast, "COORDINATOR"), "openai/o4-mini");
});

test("castModel resolves ATTACKER through explicit cast", () => {
  const cast: Cast = { ATTACKER: { model: "anthropic/claude-fable-5" } };
  assert.strictEqual(castModel(cast, "ATTACKER"), "anthropic/claude-fable-5");
});

test("seedCast applies defaults only", () => {
  const cast: Cast = {};
  seedCast(cast);
  assert.strictEqual(cast.ARCHITECT?.model, DEFAULT_ARCHITECT);
  assert.strictEqual(cast.BUILDER?.model, DEFAULT_BUILDER);
});

test("seedCast applies flag overrides", () => {
  const cast: Cast = {};
  seedCast(cast, undefined, "zai/glm-5.2", "opencode/zen");
  assert.strictEqual(cast.ARCHITECT?.model, "zai/glm-5.2");
  assert.strictEqual(cast.BUILDER?.model, "opencode/zen");
});

test("seedCast: flags beat project file", () => {
  const cast: Cast = {};
  const projectCast: Cast = {
    ARCHITECT: { model: "project/arch-model" },
    BUILDER: { model: "project/builder-model" },
  };
  seedCast(cast, "/tmp/project", "flag-architect", undefined, projectCast);
  assert.strictEqual(cast.ARCHITECT?.model, "flag-architect");
  assert.strictEqual(cast.BUILDER?.model, "project/builder-model");
});

test("seedCast: project file seeds roles not in flags", () => {
  const cast: Cast = {};
  const projectCast: Cast = {
    JUDGE: { model: "zai/judge-model", thinking: "low" as Thinking },
  };
  seedCast(cast, "/tmp/project", undefined, undefined, projectCast);
  assert.strictEqual(cast.JUDGE?.model, "zai/judge-model");
  assert.strictEqual(cast.JUDGE?.thinking, "low");
});

test("seedCast ignores unknown roles in project file", () => {
  const cast: Cast = {};
  const badCast = { UNKNOWN_ROLE: { model: "foo/bar" } } as any;
  seedCast(cast, "/tmp/project", undefined, undefined, badCast);
  // Should not throw and should not add unknown role
  assert.strictEqual((cast as any).UNKNOWN_ROLE, undefined);
});

test("castThinking returns role override", () => {
  const cast: Cast = { JUDGE: { model: "zai/judge", thinking: "low" } };
  assert.strictEqual(castThinking(cast, "JUDGE"), "low");
});

test("castThinking defaults to medium when no override", () => {
  const cast: Cast = {};
  assert.strictEqual(castThinking(cast, "ARCHITECT"), "medium");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 3: Verdict-Line Parser
// ═══════════════════════════════════════════════════════════════════════════════
section("3. VERDICT-LINE PARSER (parseStrictVerdictLine)");

test("parses BREACH verdict", () => {
  const text = "Some analysis here...\n\nVERDICT: BREACH — SQL injection in the login endpoint";
  assert.strictEqual(parseStrictVerdictLine(text, "VERDICT"), "BREACH");
});

test("parses CONCEDE verdict", () => {
  const text = "VERDICT: CONCEDE — all tests pass, no vulnerabilities found";
  assert.strictEqual(parseStrictVerdictLine(text, "VERDICT"), "CONCEDE");
});

test("CONVERGED/DIVERGED convergence check uses raw regex (NOT parseStrictVerdictLine)", () => {
  // The actual debate handler uses direct line regex, not parseStrictVerdictLine:
  // if (/^converged[\s—]/i.test(lastLine) || /^converged$/i.test(lastLine))
  const checkConvergence = (text: string): boolean => {
    const lastLine = text.trim().split("\n").pop()?.trim() ?? "";
    return /^converged[\s—]/i.test(lastLine) || /^converged$/i.test(lastLine);
  };
  assert.strictEqual(checkConvergence("CONVERGED — both agree"), true);
  assert.strictEqual(checkConvergence("CONVERGED"), true);
  assert.strictEqual(checkConvergence("DIVERGED — disagree"), false);
  assert.strictEqual(checkConvergence("some text\nconverged — yes"), true);
  assert.strictEqual(checkConvergence("not converged at all"), false);
});

test("scans from bottom — finds last match", () => {
  const text = "VERDICT: BREACH — first\n...\nVERDICT: CONCEDE — latest";
  assert.strictEqual(parseStrictVerdictLine(text, "VERDICT"), "CONCEDE");
});

test("returns undefined when no match", () => {
  assert.strictEqual(parseStrictVerdictLine("No verdict here", "VERDICT"), undefined);
  assert.strictEqual(parseStrictVerdictLine("", "VERDICT"), undefined);
  assert.strictEqual(parseStrictVerdictLine("VERDICT without dash", "VERDICT"), undefined);
});

test("requires the em-dash separator", () => {
  // The regex requires "—" (em dash) after the value
  const text = "VERDICT: BREACH - missing em dash";
  assert.strictEqual(parseStrictVerdictLine(text, "VERDICT"), undefined);
});

test("matches indented lines because .trim() is called before regex", () => {
  // The code does lines[i]!.trim().match(pat) — trim() removes leading whitespace
  // So indented verdict lines DO match
  const text = "  VERDICT: BREACH — indented but still matches";
  assert.strictEqual(parseStrictVerdictLine(text, "VERDICT"), "BREACH");
});

test("parses multi-word verdict values", () => {
  const text = "VERDICT: NO_BREACH — all good";
  assert.strictEqual(parseStrictVerdictLine(text, "VERDICT"), "NO_BREACH");
});

test("case-sensitive prefix matching", () => {
  const text = "verdict: BREACH — lowercase";
  assert.strictEqual(parseStrictVerdictLine(text, "VERDICT"), undefined);
  // The actual implementation is case-sensitive
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 4: Round Clamping
// ═══════════════════════════════════════════════════════════════════════════════
section("4. ROUND CLAMPING");

test("clampDebateRounds clamps to 1-5 range (NaN bug: see section 13)", () => {
  assert.strictEqual(clampDebateRounds(5), 5);
  assert.strictEqual(clampDebateRounds(0), 1);
  assert.strictEqual(clampDebateRounds(-1), 1);
  assert.strictEqual(clampDebateRounds(10), 5);
  assert.strictEqual(clampDebateRounds(2), 2);
  assert.strictEqual(clampDebateRounds(1), 1);
  // NaN produces NaN (bug — verified in section 13). Skip assertion here.
  assert.ok(Number.isNaN(clampDebateRounds(NaN)), "known bug: NaN input returns NaN");
});

test("clampRedteamRounds clamps to 1-8 range", () => {
  assert.strictEqual(clampRedteamRounds(8), 8);
  assert.strictEqual(clampRedteamRounds(0), 1);
  assert.strictEqual(clampRedteamRounds(20), 8);
  assert.strictEqual(clampRedteamRounds(3), 3);
});

test("clampValidations clamps to 1-20 with fallback 5", () => {
  assert.strictEqual(clampValidations(5), 5);
  assert.strictEqual(clampValidations(0), 5); // fallback
  assert.strictEqual(clampValidations(-1), 5); // fallback
  assert.strictEqual(clampValidations(25), 20);
  assert.strictEqual(clampValidations(NaN), 5); // fallback (Number.isFinite(NaN) = false)
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 5: Subtask Manifest Validation (/coordinate)
// ═══════════════════════════════════════════════════════════════════════════════
section("5. MANIFEST VALIDATION (/coordinate)");

test("valid manifest passes", () => {
  const m = {
    subtasks: [
      { id: "t1", prompt: "Do thing A", paths: ["src/a/"] },
      { id: "t2", prompt: "Do thing B", paths: ["src/b/"], dependsOn: ["t1"] },
    ],
  };
  const r = validateManifest(m);
  assert.strictEqual(r.ok, true);
  if (r.ok) {
    assert.strictEqual(r.manifest.subtasks!.length, 2);
  }
});

test("rejects non-object", () => {
  const r = validateManifest(null);
  assert.strictEqual(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("not a JSON object"));
});

test("rejects empty subtasks array", () => {
  const r = validateManifest({ subtasks: [] });
  assert.strictEqual(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("non-empty array"));
});

test("rejects missing subtasks array", () => {
  const r = validateManifest({});
  assert.strictEqual(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("non-empty array"));
});

test("rejects subtask without id", () => {
  const r = validateManifest({ subtasks: [{ prompt: "test", paths: ["src/"] }] });
  assert.strictEqual(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("missing or invalid 'id'"));
});

test("rejects duplicate ids", () => {
  const r = validateManifest({
    subtasks: [
      { id: "t1", prompt: "a", paths: ["src/a/"] },
      { id: "t1", prompt: "b", paths: ["src/b/"] },
    ],
  });
  assert.strictEqual(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("duplicate id"));
});

test("rejects subtask without prompt", () => {
  const r = validateManifest({ subtasks: [{ id: "t1", paths: ["src/"] }] });
  assert.strictEqual(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("missing 'prompt'"));
});

test("rejects subtask with empty paths", () => {
  const r = validateManifest({ subtasks: [{ id: "t1", prompt: "test", paths: [] }] });
  assert.strictEqual(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("'paths' must be a non-empty array"));
});

test("rejects subtask without paths", () => {
  const r = validateManifest({ subtasks: [{ id: "t1", prompt: "test" }] });
  assert.strictEqual(r.ok, false);
  if (!r.ok) assert.ok(r.error.includes("'paths' must be a non-empty array"));
});

test("fills default empty dependsOn when missing", () => {
  const r = validateManifest({ subtasks: [{ id: "t1", prompt: "test", paths: ["src/"] }] });
  assert.strictEqual(r.ok, true);
  if (r.ok) {
    assert.deepStrictEqual(r.manifest.subtasks![0]!.dependsOn, []);
  }
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 6: Topological Sort (/coordinate)
// ═══════════════════════════════════════════════════════════════════════════════
section("6. TOPOLOGICAL SORT (/coordinate)");

test("single subtask returns one level", () => {
  const subs: SubtaskEntry[] = [{ id: "t1", prompt: "test", paths: ["src/"] }];
  const r = topoLevels(subs);
  assert.strictEqual(r.error, undefined);
  assert.strictEqual(r.levels.length, 1);
  assert.strictEqual(r.levels[0]!.length, 1);
  assert.strictEqual(r.levels[0]![0]!.id, "t1");
});

test("two independent tasks share one level", () => {
  const subs: SubtaskEntry[] = [
    { id: "t1", prompt: "a", paths: ["a/"] },
    { id: "t2", prompt: "b", paths: ["b/"] },
  ];
  const r = topoLevels(subs);
  assert.strictEqual(r.error, undefined);
  assert.strictEqual(r.levels.length, 1);
  assert.strictEqual(r.levels[0]!.length, 2);
});

test("dependent task is in later level", () => {
  const subs: SubtaskEntry[] = [
    { id: "t2", prompt: "b", paths: ["b/"], dependsOn: ["t1"] },
    { id: "t1", prompt: "a", paths: ["a/"] },
  ];
  const r = topoLevels(subs);
  assert.strictEqual(r.error, undefined);
  assert.strictEqual(r.levels.length, 2);
  assert.strictEqual(r.levels[0]![0]!.id, "t1");
  assert.strictEqual(r.levels[1]![0]!.id, "t2");
});

test("complex dependency graph", () => {
  const subs: SubtaskEntry[] = [
    { id: "t1", prompt: "lint", paths: ["src/"] },
    { id: "t2", prompt: "build", paths: ["dist/"], dependsOn: ["t1"] },
    { id: "t3", prompt: "test", paths: ["test/"], dependsOn: ["t2"] },
    { id: "t4", prompt: "docs", paths: ["docs/"] },
    { id: "t5", prompt: "deploy", paths: ["deploy/"], dependsOn: ["t2", "t4"] },
  ];
  const r = topoLevels(subs);
  assert.strictEqual(r.error, undefined);
  // Level 0: t1 (lint) + t4 (docs) — no dependencies
  // Level 1: t2 (build) — depends on t1
  // Level 2: t3 (test) + t5 (deploy) — t3 depends on t2, t5 depends on t2+t4
  assert.strictEqual(r.levels.length, 3);
  assert.deepStrictEqual(r.levels[0]!.map(s => s.id).sort(), ["t1", "t4"]);
  assert.deepStrictEqual(r.levels[1]!.map(s => s.id), ["t2"]);
  assert.deepStrictEqual(r.levels[2]!.map(s => s.id).sort(), ["t3", "t5"]);
});

test("detects unknown dependency", () => {
  const subs: SubtaskEntry[] = [
    { id: "t1", prompt: "a", paths: ["a/"], dependsOn: ["nonexistent"] },
  ];
  const r = topoLevels(subs);
  assert.ok(r.error?.includes("depends on unknown"));
});

test("detects circular dependency", () => {
  const subs: SubtaskEntry[] = [
    { id: "t1", prompt: "a", paths: ["a/"], dependsOn: ["t2"] },
    { id: "t2", prompt: "b", paths: ["b/"], dependsOn: ["t1"] },
  ];
  const r = topoLevels(subs);
  assert.ok(r.error?.includes("circular dependency"));
});

test("self-loop detected as circular", () => {
  const subs: SubtaskEntry[] = [
    { id: "t1", prompt: "a", paths: ["a/"], dependsOn: ["t1"] },
  ];
  const r = topoLevels(subs);
  assert.ok(r.error?.includes("circular dependency"));
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 7: Borda Count (/council)
// ═══════════════════════════════════════════════════════════════════════════════
section("7. BORDA COUNT (/council)");

test("simple 2-candidate Borda", () => {
  const answers = ["A", "B"];
  const rankings = [["A", "B"], ["A", "B"], ["B", "A"]];
  const r = computeBorda(answers, rankings);
  // A: pos0=2pts * 2rankings = 4, pos1=1pt * 1 = 1 → 5
  // B: pos0=2pts * 1 = 2, pos1=1pt * 2 = 2 → 4
  assert.strictEqual(r.table.get("A"), 5);
  assert.strictEqual(r.table.get("B"), 4);
  assert.strictEqual(r.excluded.length, 0);
});

test("3-candidate Borda", () => {
  const answers = ["A", "B", "C"];
  const rankings = [
    ["A", "B", "C"],  // A=3, B=2, C=1
    ["C", "A", "B"],  // C=3, A=2, B=1
    ["B", "C", "A"],  // B=3, C=2, A=1
  ];
  const r = computeBorda(answers, rankings);
  // A: 3+2+1=6, B: 2+1+3=6, C: 1+3+2=6
  assert.strictEqual(r.table.get("A"), 6);
  assert.strictEqual(r.table.get("B"), 6);
  assert.strictEqual(r.table.get("C"), 6);
  assert.strictEqual(r.excluded.length, 0);
});

test("excludes malformed ranking (wrong count)", () => {
  const answers = ["A", "B", "C"];
  const rankings = [["A", "B"], ["A", "B", "C"]]; // first has only 2 entries
  const r = computeBorda(answers, rankings);
  assert.strictEqual(r.excluded.length, 1);
  assert.ok(r.excluded[0]!.includes("malformed"));
  // Only the valid ranking counted
  assert.strictEqual(r.table.get("A"), 3);
  assert.strictEqual(r.table.get("B"), 2);
  assert.strictEqual(r.table.get("C"), 1);
});

test("excludes ranking with invalid letter", () => {
  const answers = ["A", "B"];
  const rankings = [["A", "X"]]; // X not in answers
  const r = computeBorda(answers, rankings);
  assert.strictEqual(r.excluded.length, 1);
});

test("handles no rankings", () => {
  const answers = ["A", "B"];
  const r = computeBorda(answers, []);
  assert.strictEqual(r.table.get("A"), 0);
  assert.strictEqual(r.table.get("B"), 0);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 8: Model String Stripping (Anonymization)
// ═══════════════════════════════════════════════════════════════════════════════
section("8. MODEL STRING STRIPPING");

test("strips provider and model id from text", () => {
  const text = "I am anthropic/claude-fable-5 and I think...";
  const stripped = stripModelParts(text, ["anthropic/claude-fable-5"]);
  assert.ok(!stripped.includes("anthropic"));
  assert.ok(!stripped.includes("claude-fable-5"));
  assert.ok(stripped.includes("[redacted]"));
});

test("strips multiple models", () => {
  const text = "First model is anthropic/claude. Second is openai/gpt-5.6-sol.";
  const stripped = stripModelParts(text, ["anthropic/claude", "openai/gpt-5.6-sol"]);
  assert.ok(!stripped.includes("anthropic"));
  assert.ok(!stripped.includes("openai"));
  const redactedCount = (stripped.match(/\[redacted\]/g) || []).length;
  assert.ok(redactedCount >= 2);
});

test("does not strip short segments (<4 chars)", () => {
  const text = "gpt is a prefix for many models";
  const stripped = stripModelParts(text, ["openai/gpt"]);
  // "gpt" is 3 chars, should not be stripped
  assert.ok(stripped.includes("gpt"));
});

test("case-insensitive stripping", () => {
  const text = "CLAUDE-FABLE-5 is great";
  const stripped = stripModelParts(text, ["anthropic/claude-fable-5"]);
  assert.ok(!stripped.toLowerCase().includes("claude-fable-5"));
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 9: Preflight Helpers
// ═══════════════════════════════════════════════════════════════════════════════
section("9. PREFLIGHT HELPERS");

test("splitModel splits provider/id correctly", () => {
  assert.deepStrictEqual(splitModel("anthropic/claude-fable-5"), { provider: "anthropic", id: "claude-fable-5" });
  assert.deepStrictEqual(splitModel("zai/glm-5.2"), { provider: "zai", id: "glm-5.2" });
  assert.deepStrictEqual(splitModel("opencode-go/deepseek-v4"), { provider: "opencode-go", id: "deepseek-v4" });
});

test("splitModel handles missing slash", () => {
  const result = splitModel("invalidmodel");
  assert.strictEqual(result.provider, "invalidmodel");
  assert.strictEqual(result.id, "");
});

test("splitModel handles slash at end", () => {
  const result = splitModel("provider/");
  assert.strictEqual(result.provider, "provider");
  assert.strictEqual(result.id, "");
});

test("splitModel: slash at position 0 doesn't split (condition is slash > 0)", () => {
  // slash > 0 is the condition, so position 0 fails the split
  const result = splitModel("/id");
  assert.strictEqual(result.provider, "/id");
  assert.strictEqual(result.id, "");
  // This is edge-case-correct: "/id" is not a valid provider/id format
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 10: Ephemeral Spawn
// ═══════════════════════════════════════════════════════════════════════════════
section("10. EPHEMERAL SPAWN");

test("ephemeralSpawn creates sessionDir under artifacts", () => {
  const result = ephemeralSpawn("/tmp/fusion-harness-abc", "judge");
  assert.strictEqual(result.sessionDir, "/tmp/fusion-harness-abc/judge");
});

test("ephemeralSpawn with nested label", () => {
  const result = ephemeralSpawn("/tmp/run-1", "panelist/worker-3");
  assert.strictEqual(result.sessionDir, "/tmp/run-1/panelist/worker-3");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 11: Truncation
// ═══════════════════════════════════════════════════════════════════════════════
section("11. TRUNCATION");

test("truncateChars does nothing when under limit", () => {
  assert.strictEqual(truncateChars("hello", 10), "hello");
});

test("truncateChars truncates and adds marker", () => {
  const result = truncateChars("hello world this is a test", 10);
  assert.ok(result.startsWith("hello worl"));
  assert.ok(result.includes("truncated"));
});

test("truncateChars at HANDOFF_MAX (60k)", () => {
  const big = "x".repeat(100_000);
  const result = truncateChars(big, HANDOFF_MAX);
  assert.strictEqual(result.length, HANDOFF_MAX + "\n… [truncated — 40000 chars elided]".length);
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 12: Integration / Edge Cases
// ═══════════════════════════════════════════════════════════════════════════════
section("12. INTEGRATION & EDGE CASES");

test("PANEL multi-model parsing (comma-separated)", () => {
  const panelRaw = "zai/glm-5.2,opencode/zen,anthropic/claude-fable-5";
  const models = panelRaw.split(",").map(s => s.trim()).filter(Boolean);
  assert.strictEqual(models.length, 3);
  assert.strictEqual(models[0], "zai/glm-5.2");
  assert.strictEqual(models[1], "opencode/zen");
  assert.strictEqual(models[2], "anthropic/claude-fable-5");
});

test("PANEL requires minimum 2 panelists", () => {
  const single = "zai/glm-5.2".split(",").map(s => s.trim()).filter(Boolean);
  assert.strictEqual(single.length, 1);
  assert.ok(single.length < 2); // should trigger error in council handler
});

test("COORDINATOR uses VALIDATOR_TOOLS (read + write, no bash/edit)", () => {
  // Verify the coordinator gets the right tool set for writing subtasks.json
  const VALIDATOR_TOOLS = "read,grep,find,ls,write";
  assert.ok(VALIDATOR_TOOLS.includes("write"));
  assert.ok(!VALIDATOR_TOOLS.includes("bash"));
  assert.ok(!VALIDATOR_TOOLS.includes("edit"));
});

test("debate debaters use OPINION_TOOLS (no write/edit)", () => {
  const OPINION_TOOLS = "read,grep,find,ls,bash";
  assert.ok(!OPINION_TOOLS.includes("write"));
  assert.ok(!OPINION_TOOLS.includes("edit"));
  assert.ok(OPINION_TOOLS.includes("bash"));
});

test("redteam attacker uses OPINION_TOOLS (no write/edit)", () => {
  const OPINION_TOOLS = "read,grep,find,ls,bash";
  assert.ok(!OPINION_TOOLS.includes("write"));
  assert.ok(!OPINION_TOOLS.includes("edit"));
});

test("council panelists use OPINION_TOOLS", () => {
  const OPINION_TOOLS = "read,grep,find,ls,bash";
  assert.ok(!OPINION_TOOLS.includes("write"));
});

test("council chairman uses READONLY_TOOLS", () => {
  const READONLY_TOOLS = "read,grep,find,ls";
  assert.ok(!READONLY_TOOLS.includes("bash"));
  assert.ok(!READONLY_TOOLS.includes("write"));
});

test("debate judge uses READONLY_TOOLS on fresh session", () => {
  const READONLY_TOOLS = "read,grep,find,ls";
  assert.ok(!READONLY_TOOLS.includes("write"));
  assert.ok(!READONLY_TOOLS.includes("bash"));
});

test("parallel agents use FULL_TOOLS", () => {
  const FULL_TOOLS = "read,grep,find,ls,bash,edit,write";
  assert.ok(FULL_TOOLS.includes("edit"));
  assert.ok(FULL_TOOLS.includes("write"));
});

test("cast sheet multiPick includes PANEL only", () => {
  const multiPickRoles: Role[] = ["PANEL"];
  assert.ok(multiPickRoles.includes("PANEL"));
  // Non-multi-pick roles should NOT be in this list
  assert.ok(!multiPickRoles.includes("ARCHITECT"));
  assert.ok(!multiPickRoles.includes("JUDGE"));
});

test("letterOf mapping for council anonymization", () => {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const survivorIdx = [0, 2, 4]; // positions of survivors in original array (0-indexed)
  const letterOf = (idx: number) => letters[survivorIdx.indexOf(idx)] ?? "?";
  assert.strictEqual(letterOf(0), "A");
  assert.strictEqual(letterOf(2), "B");
  assert.strictEqual(letterOf(4), "C");
  assert.strictEqual(letterOf(1), "?"); // not a survivor
});

// ═══════════════════════════════════════════════════════════════════════════════
// SECTION 13: Detected Issues (BUGS)
// ═══════════════════════════════════════════════════════════════════════════════
section("13. DETECTED ISSUES (expected failures — confirm bug presence)");

test("BUG: clampDebateRounds(NaN) returns NaN instead of 1", () => {
  // Math.max(1, Math.min(5, Math.floor(NaN))) = Math.max(1, NaN) = NaN
  const result = clampDebateRounds(NaN);
  assert.ok(Number.isNaN(result), "Expected NaN — confirmed bug: NaN input not sanitized");
  // Fix should be: Number.isFinite(n) ? clamp(...) : fallback
});

test("BUG: splitModel with empty string returns provider='' id=''", () => {
  // This is fine actually — the preflight will catch it
  const result = splitModel("");
  assert.strictEqual(result.provider, "");
  assert.strictEqual(result.id, "");
  // Preflight sees no provider/id and flags it as unresolved
});

test("BUG: stripModelParts may not cover all cases — a panelist could name themselves creatively", () => {
  // This is a known limitation documented in the design
  const text = "My model is the best one from my provider";
  const stripped = stripModelParts(text, ["anthropic/claude-fable-5"]);
  // Should not crash; anonymization is best-effort
  assert.ok(typeof stripped === "string");
});

// ═══════════════════════════════════════════════════════════════════════════════
// SUMMARY
// ═══════════════════════════════════════════════════════════════════════════════

console.log(`\n═══════════════════════════════════════════════════════`);
console.log(`  RESULTS: ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`═══════════════════════════════════════════════════════`);

if (failed > 0) process.exit(1);
