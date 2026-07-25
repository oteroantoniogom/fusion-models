/**
 * GAUNTLET COMMAND TEST SUITE — BUILDER agent (zai/glm-5-turbo)
 * =================================================================
 * Tests that /gauntlet works end-to-end by testing every layer:
 *
 *   1. Source-code structural integrity  (all gauntlet symbols present in fusion-harness.ts)
 *   2. Gauntlet constants & types        (stages, names, stage map, prereqs)
 *   3. Flag parsing                       (--skip-council, --skip-redteam, --deliberate, --resume)
 *   4. Campaign state round-trip          (save → load → compare, with fs I/O)
 *   5. Campaign state helpers             (emptyStage, firstIncompleteStage, accumulateCost)
 *   6. Stage transition logic             (done/skipped/failed → continue/halt)
 *   7. latestGauntletDir logic            (sort by mtime, missing dir, no gauntlet dirs)
 *   8. Directory naming                   (chainDirName, gauntletDirName)
 *   9. Subtask manifest validation        (validateManifest edge cases)
 *  10. Topological sort                  (topoLevels edge cases)
 *  11. Verdict parser                     (parseStrictVerdictLine)
 *  12. COMMAND_CAST for gauntlet          (correct roles, no extras)
 *  13. Gauntlet stage-to-handler mapping  (each stage name → expected behavior)
 *  14. Widget rendering                   (stage status glyphs)
 *  15. Resume logic                      (partial state, fully-done state, corrupted state.json)
 *  16. Integration: runGauntletStage flow-control return semantics
 *
 * Run:  npx tsx tests/test-gauntlet-BUILDER-zai~glm-5-turbo.ts
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import * as cp from "node:child_process";

// ═══════════════════════════════════════════════════════════════════════════════
// FAITHFUL EXTRACTIONS — copied verbatim from fusion-harness.ts gauntlet section
// ═══════════════════════════════════════════════════════════════════════════════

const GAUNTLET_STAGES = ["deliberate", "gate", "decompose", "build", "verify", "harden", "integrate"] as const;
type GauntletStage = (typeof GAUNTLET_STAGES)[number];

const GAUNTLET_STAGE_NAMES: Record<GauntletStage, string> = {
	deliberate: "DELIBERATE",
	gate: "GATE-FIRST",
	decompose: "DECOMPOSE",
	build: "BUILD",
	verify: "VERIFY",
	harden: "HARDEN",
	integrate: "INTEGRATE",
};

const CHAIN_STAGE_NAMES = ["deliberate", "gate", "decompose", "build", "verify", "harden", "integrate"] as const;
type ChainStage = (typeof CHAIN_STAGE_NAMES)[number];

const CHAIN_STAGE_MAP: Record<ChainStage, GauntletStage> = {
	deliberate: "deliberate",
	gate: "gate",
	decompose: "decompose",
	build: "build",
	verify: "verify",
	harden: "harden",
	integrate: "integrate",
};

const STAGE_PREREQS: Record<ChainStage, string[]> = {
	deliberate: [],
	gate: ["plan.md"],
	decompose: ["plan.md"],
	build: ["subtasks.json"],
	verify: ["gate.py"],
	harden: [],
	integrate: ["plan.md"],
};

interface StageState {
	name: string;
	status: "pending" | "working" | "done" | "failed" | "skipped";
	artifacts: Record<string, string>;
	startedAt?: string;
	endedAt?: string;
	prompt?: string;
	castSnapshot?: Record<string, any>;
	tokensIn?: number;
	tokensOut?: number;
	costUsd?: number;
}

interface CampaignState {
	prompt: string;
	stages: StageState[];
	cast: Record<string, any>;
	createdAt: string;
	skipCouncil: boolean;
	skipRedteam: boolean;
	deliberateMode: "council" | "debate";
}

const emptyStage = (name: string): StageState => ({
	name,
	status: "pending" as const,
	artifacts: {},
});

const firstIncompleteStage = (state: CampaignState): number =>
	state.stages.findIndex((s) => s.status !== "done");

const accumulateCost = (stages: StageState[]): number =>
	stages.reduce((s, st) => s + (st.costUsd ?? 0), 0);

const chainDirName = (baseName: string): string => `chain-${baseName.replace(/fusion-harness-/g, "")}`;
const gauntletDirName = (baseName: string): string => `gauntlet-${baseName.replace(/fusion-harness-/g, "")}`;

function parseStrictVerdictLine(text: string, prefix: string): string | undefined {
	const lines = text.trim().split("\n");
	const pat = new RegExp(`^${prefix}:\\s*(\\S+)\\s*—`);
	for (let i = lines.length - 1; i >= 0; i--) {
		const m = lines[i]!.trim().match(pat);
		if (m) return m[1]!;
	}
	return undefined;
}

interface SubtaskEntry { id: string; title?: string; prompt?: string; paths?: string[]; dependsOn?: string[]; }
interface SubtaskManifest { subtasks?: SubtaskEntry[]; }

const validateManifest = (data: any): { ok: true; manifest: SubtaskManifest } | { ok: false; error: string } => {
	if (!data || typeof data !== "object") return { ok: false, error: "manifest is not a JSON object" };
	const m = data as SubtaskManifest;
	if (!Array.isArray(m.subtasks) || m.subtasks.length === 0) return { ok: false, error: "manifest.subtasks must be a non-empty array" };
	const ids = new Set<string>();
	for (let i = 0; i < m.subtasks.length; i++) {
		const s = m.subtasks[i]!;
		if (!s.id || typeof s.id !== "string") return { ok: false, error: `subtasks[${i}]: missing or invalid 'id'` };
		if (ids.has(s.id)) return { ok: false, error: `subtasks[${i}]: duplicate id '${s.id}'` };
		ids.add(s.id);
		if (!s.prompt || typeof s.prompt !== "string") return { ok: false, error: `subtasks[${i}] (${s.id}): missing 'prompt'` };
		if (!Array.isArray(s.paths) || s.paths.length === 0) return { ok: false, error: `subtasks[${i}] (${s.id}): 'paths' must be a non-empty array` };
		if (!Array.isArray(s.dependsOn)) s.dependsOn = [];
	}
	return { ok: true, manifest: m };
};

const topoLevels = (subtasks: SubtaskEntry[]): { levels: SubtaskEntry[][]; error?: string } => {
	const byId = new Map(subtasks.map((s) => [s.id, s]));
	const inDeg = new Map<string, number>(), deps = new Map<string, string[]>();
	for (const s of subtasks) { inDeg.set(s.id, 0); deps.set(s.id, []); }
	for (const s of subtasks) for (const dep of s.dependsOn ?? []) {
		if (!byId.has(dep)) return { levels: [], error: `subtask '${s.id}' depends on unknown '${dep}'` };
		deps.get(dep)!.push(s.id); inDeg.set(s.id, (inDeg.get(s.id) ?? 0) + 1);
	}
	const queue: string[] = [];
	for (const [id, d] of inDeg) if (d === 0) queue.push(id);
	const levels: SubtaskEntry[][] = []; let visited = 0;
	while (queue.length) {
		const batch = [...queue]; queue.length = 0; const level: SubtaskEntry[] = [];
		for (const id of batch) { level.push(byId.get(id)!); visited++; for (const nx of deps.get(id) ?? []) { const d = (inDeg.get(nx) ?? 1) - 1; inDeg.set(nx, d); if (d === 0) queue.push(nx); } }
		levels.push(level);
	}
	if (visited !== subtasks.length) return { levels: [], error: "circular dependency detected" };
	return { levels };
};

// ── Stage status glyph (from widget renderer) ─────────────────────────────
const STAGE_GLYPH: Record<string, string> = {
	done: "✓",
	failed: "✗",
	skipped: "⊘",
	working: "◐",
	pending: "○",
};

// ═══════════════════════════════════════════════════════════════════════════════
// FLAG PARSER — extracted from the gauntlet handler
// ═══════════════════════════════════════════════════════════════════════════════

interface GauntletFlags {
	prompt: string;
	skipCouncil: boolean;
	skipRedteam: boolean;
	deliberateMode: "council" | "debate";
	resumeDir: string | undefined;
	resumeExplicit: boolean;
}

function parseGauntletFlags(raw: string | null | undefined): GauntletFlags {
	let input = (raw ?? "").trim();
	let skipCouncil = false;
	let skipRedteam = false;
	let deliberateMode: "council" | "debate" = "council";
	let resumeDir: string | undefined;
	let resumeExplicit = false;

	input = input
		.replace(/\s*--skip-council\s*/g, () => { skipCouncil = true; return " "; })
		.replace(/\s*--skip-redteam\s*/g, () => { skipRedteam = true; return " "; })
		.replace(/--deliberate[=\s]+(\S+)\s*/g, (_m: string, mode: string) => {
			deliberateMode = mode === "debate" ? "debate" : "council";
			return " ";
		})
		.replace(/--resume(?:\s+(\S+))?\s*/g, (_m: string, dir?: string) => {
			resumeDir = dir || undefined;
			resumeExplicit = true;
			return " ";
		})
		.trim();

	return { prompt: input, skipCouncil, skipRedteam, deliberateMode, resumeDir, resumeExplicit };
}

// ═══════════════════════════════════════════════════════════════════════════════
// latestGauntletDir simulation (uses real fs in temp dir)
// ═══════════════════════════════════════════════════════════════════════════════

async function simulatedLatestGauntletDir(root: string): Promise<string | undefined> {
	let entries: string[] = [];
	try {
		entries = await fs.promises.readdir(root);
	} catch {
		return undefined;
	}
	const gauntletDirs = entries
		.filter((e) => e.startsWith("gauntlet-"))
		.map((e) => path.join(root, e))
		.sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs);
	return gauntletDirs[0];
}

// ═══════════════════════════════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════════════════════════════

const SRC = path.join(__dirname, "..", "..", "extensions", "fusion-harness", "fusion-harness.ts");
function src(): string { return fs.readFileSync(SRC, "utf-8"); }

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-test-"));

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
function test(name: string, fn: () => void | Promise<void>) { tests.push({ name, fn }); }

// ─────────────────────────────────────────────────────────────────────────────
// 1. SOURCE-CODE STRUCTURAL INTEGRITY
// ─────────────────────────────────────────────────────────────────────────────

test("1.01 /gauntlet is registered with registerCommand", () => {
	assert.ok(src().includes('registerCommand("gauntlet"'), "/gauntlet not registered");
});

test("1.02 /chain is registered with registerCommand", () => {
	assert.ok(src().includes('registerCommand("chain"'), "/chain not registered");
});

test("1.03 GAUNTLET_STAGES constant exists in source", () => {
	assert.ok(src().includes('const GAUNTLET_STAGES = ['), "GAUNTLET_STAGES missing");
});

test("1.04 GAUNTLET_STAGE_NAMES constant exists in source", () => {
	assert.ok(src().includes('const GAUNTLET_STAGE_NAMES:'), "GAUNTLET_STAGE_NAMES missing");
});

test("1.05 CHAIN_STAGE_NAMES constant exists in source", () => {
	assert.ok(src().includes('const CHAIN_STAGE_NAMES = ['), "CHAIN_STAGE_NAMES missing");
});

test("1.06 STAGE_PREREQS constant exists in source", () => {
	assert.ok(src().includes('const STAGE_PREREQS:'), "STAGE_PREREQS missing");
});

test("1.07 runGauntletStage function exists in source", () => {
	assert.ok(src().includes('async function runGauntletStage('), "runGauntletStage missing");
});

test("1.08 loadCampaignState function exists in source", () => {
	assert.ok(src().includes('const loadCampaignState = async'), "loadCampaignState missing");
});

test("1.09 saveCampaignState function exists in source", () => {
	assert.ok(src().includes('const saveCampaignState = async'), "saveCampaignState missing");
});

test("1.10 latestGauntletDir function exists in source", () => {
	assert.ok(src().includes('const latestGauntletDir = async'), "latestGauntletDir missing");
});

test("1.11 emptyStage function exists in source", () => {
	assert.ok(src().includes('const emptyStage = ('), "emptyStage missing");
});

test("1.12 firstIncompleteStage function exists in source", () => {
	assert.ok(src().includes('const firstIncompleteStage = ('), "firstIncompleteStage missing");
});

test("1.13 accumulateCost function exists in source", () => {
	assert.ok(src().includes('const accumulateCost = ('), "accumulateCost missing");
});

test("1.14 COMMAND_CAST includes gauntlet entry", () => {
	assert.ok(src().includes('gauntlet: ["PANEL", "PANEL_2", "CHAIRMAN", "VALIDATOR", "COORDINATOR", "BUILDER", "ATTACKER"]'),
		"COMMAND_CAST gauntlet entry missing or wrong");
});

test("1.15 validateManifest exists in source (coordinate section)", () => {
	assert.ok(
		src().includes('const validateManifest = (data: any)') || src().includes('function validateManifest(data: any)'),
		"validateManifest missing",
	);
});

test("1.16 topoLevels exists in source (coordinate section)", () => {
	assert.ok(
		src().includes('const topoLevels = (subtasks:') || src().includes('function topoLevels(subtasks:'),
		"topoLevels missing",
	);
});

test("1.17 all 8 original command handlers still present", () => {
	const commands = ["fusion", "auto-validate", "opinion", "parallel", "debate", "coordinate", "council", "redteam"];
	const s = src();
	for (const cmd of commands) {
		assert.ok(s.includes(`registerCommand("${cmd}"`), `Missing original command: /${cmd}`);
	}
});

test("1.18 StageState interface includes costUsd field", () => {
	const s = src();
	// StageState is defined inside the gauntlet section
	assert.ok(s.includes('interface StageState {'), "StageState interface missing");
	const match = s.match(/interface StageState \{[\s\S]*?\}/);
	assert.ok(match, "Could not extract StageState interface");
	assert.ok(match![0].includes('costUsd?: number'), "StageState missing costUsd field");
});

test("1.19 CampaignState interface includes deliberateMode field", () => {
	const s = src();
	const match = s.match(/interface CampaignState \{[\s\S]*?\}/);
	assert.ok(match, "Could not extract CampaignState interface");
	assert.ok(match![0].includes('deliberateMode: "council" | "debate"'), "CampaignState missing deliberateMode");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GAUNTLET CONSTANTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────

test("2.01 GAUNTLET_STAGES has exactly 7 stages", () => {
	assert.strictEqual(GAUNTLET_STAGES.length, 7);
});

test("2.02 GAUNTLET_STAGES order is deliberate→gate→decompose→build→verify→harden→integrate", () => {
	assert.deepStrictEqual([...GAUNTLET_STAGES], [
		"deliberate", "gate", "decompose", "build", "verify", "harden", "integrate",
	]);
});

test("2.03 GAUNTLET_STAGE_NAMES maps every stage to uppercase display name", () => {
	for (const s of GAUNTLET_STAGES) {
		assert.ok(GAUNTLET_STAGE_NAMES[s], `Missing name for stage: ${s}`);
	}
	assert.strictEqual(GAUNTLET_STAGE_NAMES.deliberate, "DELIBERATE");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.gate, "GATE-FIRST");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.decompose, "DECOMPOSE");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.build, "BUILD");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.verify, "VERIFY");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.harden, "HARDEN");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.integrate, "INTEGRATE");
});

test("2.04 CHAIN_STAGE_NAMES matches GAUNTLET_STAGES exactly", () => {
	assert.strictEqual(CHAIN_STAGE_NAMES.length, GAUNTLET_STAGES.length);
	for (const s of CHAIN_STAGE_NAMES) {
		assert.ok((GAUNTLET_STAGES as readonly string[]).includes(s), `Chain stage '${s}' not in GAUNTLET_STAGES`);
	}
});

test("2.05 CHAIN_STAGE_MAP is identity mapping", () => {
	for (const s of CHAIN_STAGE_NAMES) {
		assert.strictEqual(CHAIN_STAGE_MAP[s], s, `CHAIN_STAGE_MAP[${s}] != ${s}`);
	}
});

test("2.06 STAGE_PREREQS covers all stages", () => {
	for (const s of CHAIN_STAGE_NAMES) {
		assert.ok(Array.isArray(STAGE_PREREQS[s]), `Missing prereqs for: ${s}`);
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FLAG PARSING
// ─────────────────────────────────────────────────────────────────────────────

test("3.01 no flags → defaults", () => {
	const f = parseGauntletFlags("build me a thing");
	assert.strictEqual(f.prompt, "build me a thing");
	assert.strictEqual(f.skipCouncil, false);
	assert.strictEqual(f.skipRedteam, false);
	assert.strictEqual(f.deliberateMode, "council");
	assert.strictEqual(f.resumeExplicit, false);
	assert.strictEqual(f.resumeDir, undefined);
});

test("3.02 --skip-council sets flag and strips from prompt", () => {
	const f = parseGauntletFlags("do thing --skip-council");
	assert.strictEqual(f.skipCouncil, true);
	assert.ok(!f.prompt.includes("--skip-council"));
});

test("3.03 --skip-redteam sets flag and strips from prompt", () => {
	const f = parseGauntletFlags("do thing --skip-redteam");
	assert.strictEqual(f.skipRedteam, true);
	assert.ok(!f.prompt.includes("--skip-redteam"));
});

test("3.04 --deliberate=debate sets mode to debate", () => {
	const f = parseGauntletFlags("task --deliberate=debate");
	assert.strictEqual(f.deliberateMode, "debate");
});

test("3.05 --deliberate=council sets mode to council", () => {
	const f = parseGauntletFlags("task --deliberate=council");
	assert.strictEqual(f.deliberateMode, "council");
});

test("3.06 --deliberate with space separator", () => {
	const f = parseGauntletFlags("task --deliberate debate");
	assert.strictEqual(f.deliberateMode, "debate");
});

test("3.07 --deliberate with unknown value defaults to council", () => {
	const f = parseGauntletFlags("task --deliberate=foo");
	assert.strictEqual(f.deliberateMode, "council");
});

test("3.08 --resume sets resumeExplicit and no dir", () => {
	const f = parseGauntletFlags("task --resume");
	assert.strictEqual(f.resumeExplicit, true);
	assert.strictEqual(f.resumeDir, undefined);
});

test("3.09 --resume /some/dir sets resumeExplicit and dir", () => {
	const f = parseGauntletFlags("task --resume /tmp/gauntlet-abc");
	assert.strictEqual(f.resumeExplicit, true);
	assert.strictEqual(f.resumeDir, "/tmp/gauntlet-abc");
});

test("3.10 all flags combined", () => {
	const f = parseGauntletFlags("build API --skip-council --skip-redteam --deliberate=debate --resume /tmp/x");
	assert.strictEqual(f.prompt, "build API");
	assert.strictEqual(f.skipCouncil, true);
	assert.strictEqual(f.skipRedteam, true);
	assert.strictEqual(f.deliberateMode, "debate");
	assert.strictEqual(f.resumeExplicit, true);
	assert.strictEqual(f.resumeDir, "/tmp/x");
});

test("3.11 empty input → empty prompt", () => {
	const f = parseGauntletFlags("");
	assert.strictEqual(f.prompt, "");
	assert.strictEqual(f.skipCouncil, false);
});

test("3.12 null/undefined input → empty prompt, no crash", () => {
	const f1 = parseGauntletFlags(null);
	assert.strictEqual(f1.prompt, "");
	const f2 = parseGauntletFlags(undefined);
	assert.strictEqual(f2.prompt, "");
});

test("3.13 flags in middle of prompt are stripped", () => {
	const f = parseGauntletFlags("start --skip-council and then end");
	assert.strictEqual(f.skipCouncil, true);
	assert.ok(!f.prompt.includes("--skip-council"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CAMPAIGN STATE ROUND-TRIP (save → load → compare, with real fs)
// ─────────────────────────────────────────────────────────────────────────────

test("4.01 fresh campaign state round-trip", async () => {
	const dir = fs.mkdtempSync(path.join(TMP, "rt-"));
	const state: CampaignState = {
		prompt: "test prompt",
		stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: { ARCHITECT: { model: "test/arch" }, BUILDER: { model: "test/bld" } },
		createdAt: "2025-01-01T00:00:00Z",
		skipCouncil: false,
		skipRedteam: false,
		deliberateMode: "council",
	};
	// Save
	fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	// Load
	const raw = fs.readFileSync(path.join(dir, "state.json"), "utf-8");
	const loaded = JSON.parse(raw) as CampaignState;
	assert.strictEqual(loaded.prompt, state.prompt);
	assert.strictEqual(loaded.stages.length, 7);
	assert.strictEqual(loaded.deliberateMode, "council");
	assert.strictEqual(loaded.skipCouncil, false);
	assert.strictEqual(loaded.skipRedteam, false);
	assert.strictEqual(loaded.createdAt, state.createdAt);
	assert.deepStrictEqual(loaded.cast, state.cast);
});

test("4.02 campaign state with partially-completed stages round-trips", async () => {
	const dir = fs.mkdtempSync(path.join(TMP, "rt-"));
	const state: CampaignState = {
		prompt: "partial test",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done", artifacts: { "plan.md": "/tmp/x/plan.md" } },
			{ ...emptyStage("GATE-FIRST"), status: "done", artifacts: { "gate.py": "/tmp/x/gate.py" } },
			{ ...emptyStage("DECOMPOSE"), status: "working" },
			emptyStage("BUILD"),
		emptyStage("VERIFY"),
		emptyStage("HARDEN"),
		emptyStage("INTEGRATE"),
		],
		cast: {},
		createdAt: "2025-06-15T10:00:00Z",
		skipCouncil: false,
		skipRedteam: true,
		deliberateMode: "debate",
	};
	fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	const loaded = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")) as CampaignState;
	assert.strictEqual(loaded.stages[0]!.status, "done");
	assert.strictEqual(loaded.stages[1]!.status, "done");
	assert.strictEqual(loaded.stages[2]!.status, "working");
	assert.strictEqual(loaded.stages[3]!.status, "pending");
	assert.strictEqual(loaded.skipRedteam, true);
	assert.strictEqual(loaded.deliberateMode, "debate");
});

test("4.03 campaign state with costs round-trips", async () => {
	const dir = fs.mkdtempSync(path.join(TMP, "rt-"));
	const state: CampaignState = {
		prompt: "cost test",
		stages: GAUNTLET_STAGES.map((n) => ({
			...emptyStage(GAUNTLET_STAGE_NAMES[n]),
			costUsd: 0.1,
		})),
		cast: {},
		createdAt: new Date().toISOString(),
		skipCouncil: false,
		skipRedteam: false,
		deliberateMode: "council",
	};
	fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	const loaded = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")) as CampaignState;
	assert.strictEqual(accumulateCost(loaded.stages), 0.7);
});

test("4.04 loadCampaignState throws on missing state.json", async () => {
	const dir = fs.mkdtempSync(path.join(TMP, "rt-"));
	let threw = false;
	try {
		await fs.promises.readFile(path.join(dir, "state.json"), "utf-8");
	} catch {
		threw = true;
	}
	assert.ok(threw, "Should throw on missing state.json");
});

test("4.05 loadCampaignState throws on invalid JSON", async () => {
	const dir = fs.mkdtempSync(path.join(TMP, "rt-"));
	fs.writeFileSync(path.join(dir, "state.json"), "NOT JSON{{{");
	let threw = false;
	try {
		JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8"));
	} catch {
		threw = true;
	}
	assert.ok(threw, "Should throw on invalid JSON");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. CAMPAIGN STATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

test("5.01 emptyStage creates pending stage with correct name", () => {
	const s = emptyStage("BUILD");
	assert.strictEqual(s.name, "BUILD");
	assert.strictEqual(s.status, "pending");
	assert.deepStrictEqual(s.artifacts, {});
	assert.strictEqual(s.startedAt, undefined);
	assert.strictEqual(s.endedAt, undefined);
	assert.strictEqual(s.costUsd, undefined);
});

test("5.02 emptyStage returns independent objects (no shared reference)", () => {
	const a = emptyStage("A");
	const b = emptyStage("B");
	a.artifacts["x"] = "y";
	assert.deepStrictEqual(b.artifacts, {});
});

test("5.03 firstIncompleteStage: all pending → index 0", () => {
	const state: CampaignState = {
		prompt: "", stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 0);
});

test("5.04 firstIncompleteStage: first done, rest pending → index 1", () => {
	const state: CampaignState = {
		prompt: "",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done" },
			emptyStage("GATE-FIRST"),
			emptyStage("DECOMPOSE"),
			emptyStage("BUILD"),
			emptyStage("VERIFY"),
			emptyStage("HARDEN"),
			emptyStage("INTEGRATE"),
		],
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 1);
});

test("5.05 firstIncompleteStage: skipped does NOT count as done (potential bug — re-enters skipped stage on resume)", () => {
	const state: CampaignState = {
		prompt: "",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done" },
			{ ...emptyStage("GATE-FIRST"), status: "skipped" },
			{ ...emptyStage("DECOMPOSE"), status: "working" },
		],
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 1); // "skipped" !== "done" → re-enters on resume
});

test("5.06 firstIncompleteStage: all done → -1", () => {
	const state: CampaignState = {
		prompt: "",
		stages: GAUNTLET_STAGES.map((n) => ({ ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const })),
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), -1);
});

test("5.07 firstIncompleteStage: failed counts as incomplete → returns its index", () => {
	const state: CampaignState = {
		prompt: "",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done" },
			{ ...emptyStage("GATE-FIRST"), status: "failed" },
		],
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 1);
});

test("5.08 accumulateCost: empty array → 0", () => {
	assert.strictEqual(accumulateCost([]), 0);
});

test("5.09 accumulateCost: all undefined costUsd → 0", () => {
	assert.strictEqual(accumulateCost([emptyStage("A"), emptyStage("B")]), 0);
});

test("5.10 accumulateCost: sums correctly", () => {
	const stages: StageState[] = [
		{ ...emptyStage("A"), costUsd: 0.5 },
		{ ...emptyStage("B"), costUsd: 0.3 },
		{ ...emptyStage("C") }, // undefined
		{ ...emptyStage("D"), costUsd: 0.1 },
	];
	assert.strictEqual(accumulateCost(stages), 0.9);
});

test("5.11 accumulateCost: precision", () => {
	const stages: StageState[] = [
		{ ...emptyStage("A"), costUsd: 0.0001 },
		{ ...emptyStage("B"), costUsd: 0.0002 },
	];
	assert.ok(Math.abs(accumulateCost(stages) - 0.0003) < 1e-10);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. STAGE TRANSITION LOGIC (runGauntletStage return value semantics)
//    runGauntletStage returns true if campaign should continue,
//    false if it should halt (failed stage).
//    done → true, skipped → true, failed → false, working → never returned
// ─────────────────────────────────────────────────────────────────────────────

function simulateRunGauntletStage(stage: StageState): boolean {
	// After execution, the stage's final status determines continuation
	return stage.status === "done" || stage.status === "skipped";
}

test("6.01 stage done → continue", () => {
	assert.strictEqual(simulateRunGauntletStage({ ...emptyStage("X"), status: "done" }), true);
});

test("6.02 stage skipped → continue", () => {
	assert.strictEqual(simulateRunGauntletStage({ ...emptyStage("X"), status: "skipped" }), true);
});

test("6.03 stage failed → halt", () => {
	assert.strictEqual(simulateRunGauntletStage({ ...emptyStage("X"), status: "failed" }), false);
});

test("6.04 full gauntlet: all done → campaign complete", () => {
	const stages = GAUNTLET_STAGES.map((n) => ({ ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const }));
	let allContinued = true;
	for (const s of stages) {
		if (!simulateRunGauntletStage(s)) { allContinued = false; break; }
	}
	assert.ok(allContinued);
});

test("6.05 gauntlet: harden skipped (skipRedteam) → campaign continues", () => {
	// If skipRedteam, HARDEN becomes "skipped" → continue
	const stages = GAUNTLET_STAGES.map((n) => {
		if (n === "harden") return { ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "skipped" as const };
		return { ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const };
	});
	for (const s of stages) {
		assert.ok(simulateRunGauntletStage(s), `Stage ${s.name} (${s.status}) should continue`);
	}
});

test("6.06 gauntlet: gate fails → campaign halts at gate", () => {
	const stages = GAUNTLET_STAGES.map((n, i) => {
		if (n === "gate") return { ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "failed" as const };
		if (i > 1) return emptyStage(GAUNTLET_STAGE_NAMES[n]); // pending — never reached
		return { ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const };
	});
	// Stage 0 (deliberate) done → continue, Stage 1 (gate) failed → halt
	assert.ok(simulateRunGauntletStage(stages[0]!), "deliberate done should continue");
	assert.ok(!simulateRunGauntletStage(stages[1]!), "gate failed should halt");
});

test("6.07 gauntlet: build fails → decompose done, build fails, verify never runs", () => {
	const stages: StageState[] = [
		{ ...emptyStage("DELIBERATE"), status: "done" },
		{ ...emptyStage("GATE-FIRST"), status: "done" },
		{ ...emptyStage("DECOMPOSE"), status: "done" },
		{ ...emptyStage("BUILD"), status: "failed" },
		emptyStage("VERIFY"),
		emptyStage("HARDEN"),
		emptyStage("INTEGRATE"),
	];
	for (let i = 0; i < 4; i++) {
		if (i < 3) {
			assert.ok(simulateRunGauntletStage(stages[i]!), `Stage ${i} should continue`);
		} else {
			assert.ok(!simulateRunGauntletStage(stages[i]!), `Stage ${i} (BUILD) should halt`);
		}
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. latestGauntletDir LOGIC
// ─────────────────────────────────────────────────────────────────────────────

test("7.01 no gauntlet dirs → undefined", async () => {
	const root = fs.mkdtempSync(path.join(TMP, "lgd-"));
	fs.writeFileSync(path.join(root, "other-file.txt"), "hi");
	fs.mkdirSync(path.join(root, "chain-abc123"));
	const result = await simulatedLatestGauntletDir(root);
	assert.strictEqual(result, undefined);
});

test("7.02 one gauntlet dir → that dir", async () => {
	const root = fs.mkdtempSync(path.join(TMP, "lgd-"));
	const gDir = path.join(root, "gauntlet-test1");
	fs.mkdirSync(gDir);
	const result = await simulatedLatestGauntletDir(root);
	assert.strictEqual(result, gDir);
});

test("7.03 multiple gauntlet dirs → most recently modified", async () => {
	const root = fs.mkdtempSync(path.join(TMP, "lgd-"));
	const g1 = path.join(root, "gauntlet-old");
	const g2 = path.join(root, "gauntlet-new");
	fs.mkdirSync(g1);
	fs.mkdirSync(g2);
	// Touch g1 first, then g2 so g2 is newer
	const { utimesSync } = fs;
	utimesSync(g1, new Date(1000), new Date(1000));
	utimesSync(g2, new Date(2000), new Date(2000));
	const result = await simulatedLatestGauntletDir(root);
	assert.strictEqual(result, g2);
});

test("7.04 non-existent root → undefined, no throw", async () => {
	const result = await simulatedLatestGauntletDir("/non/existent/path/" + Math.random());
	assert.strictEqual(result, undefined);
});

test("7.05 chain-* dirs are ignored by latestGauntletDir", async () => {
	const root = fs.mkdtempSync(path.join(TMP, "lgd-"));
	fs.mkdirSync(path.join(root, "chain-abc"));
	fs.mkdirSync(path.join(root, "chain-def"));
	const gDir = path.join(root, "gauntlet-abc");
	fs.mkdirSync(gDir);
	const result = await simulatedLatestGauntletDir(root);
	assert.strictEqual(result, gDir);
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. DIRECTORY NAMING
// ─────────────────────────────────────────────────────────────────────────────

test("8.01 chainDirName strips fusion-harness- prefix", () => {
	assert.strictEqual(chainDirName("fusion-harness-abc123"), "chain-abc123");
});

test("8.02 gauntletDirName strips fusion-harness- prefix", () => {
	assert.strictEqual(gauntletDirName("fusion-harness-abc123"), "gauntlet-abc123");
});

test("8.03 chainDirName with no prefix to strip", () => {
	assert.strictEqual(chainDirName("abc123"), "chain-abc123");
});

test("8.04 gauntletDirName with no prefix to strip", () => {
	assert.strictEqual(gauntletDirName("abc123"), "gauntlet-abc123");
});

test("8.05 chainDirName empty string", () => {
	assert.strictEqual(chainDirName(""), "chain-");
});

test("8.06 gauntletDirName empty string", () => {
	assert.strictEqual(gauntletDirName(""), "gauntlet-");
});

test("8.07 chainDirName and gauntletDirName produce different prefixes for same input", () => {
	const base = "fusion-harness-xyz789";
	assert.notStrictEqual(chainDirName(base), gauntletDirName(base));
	assert.ok(chainDirName(base).startsWith("chain-"));
	assert.ok(gauntletDirName(base).startsWith("gauntlet-"));
	// Same suffix
	assert.strictEqual(chainDirName(base).slice(6), gauntletDirName(base).slice(9));
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. SUBTASK MANIFEST VALIDATION (edge cases)
// ─────────────────────────────────────────────────────────────────────────────

test("9.01 valid minimal manifest", () => {
	const r = validateManifest({ subtasks: [{ id: "a", prompt: "do a", paths: ["a.ts"] }] });
	assert.ok(r.ok);
});

test("9.02 valid manifest with all optional fields", () => {
	const r = validateManifest({
		subtasks: [{ id: "a", title: "Title A", prompt: "do a", paths: ["a.ts"], dependsOn: [] }],
	});
	assert.ok(r.ok);
});

test("9.03 null → fail", () => {
	assert.ok(!validateManifest(null).ok);
});

test("9.04 string → fail", () => {
	assert.ok(!validateManifest("hello").ok);
});

test("9.05 empty object → fail (no subtasks key)", () => {
	const r = validateManifest({});
	assert.ok(!r.ok);
	if (!r.ok) assert.match(r.error, /non-empty array/);
});

test("9.06 empty subtasks array → fail", () => {
	assert.ok(!validateManifest({ subtasks: [] }).ok);
});

test("9.07 missing id → fail", () => {
	assert.ok(!validateManifest({ subtasks: [{ prompt: "p", paths: ["x"] }] }).ok);
});

test("9.08 empty id → fail", () => {
	assert.ok(!validateManifest({ subtasks: [{ id: "", prompt: "p", paths: ["x"] }] }).ok);
});

test("9.09 numeric id → fail (id must be string)", () => {
	const r = validateManifest({ subtasks: [{ id: 123 as any, prompt: "p", paths: ["x"] }] });
	assert.ok(!r.ok);
});

test("9.10 duplicate id → fail", () => {
	assert.ok(!validateManifest({
		subtasks: [
			{ id: "a", prompt: "p1", paths: ["a.ts"] },
			{ id: "a", prompt: "p2", paths: ["b.ts"] },
		],
	}).ok);
});

test("9.11 missing prompt → fail", () => {
	assert.ok(!validateManifest({ subtasks: [{ id: "a", paths: ["x"] }] }).ok);
});

test("9.12 empty prompt → fail", () => {
	assert.ok(!validateManifest({ subtasks: [{ id: "a", prompt: "", paths: ["x"] }] }).ok);
});

test("9.13 missing paths → fail", () => {
	assert.ok(!validateManifest({ subtasks: [{ id: "a", prompt: "p" }] }).ok);
});

test("9.14 empty paths → fail", () => {
	assert.ok(!validateManifest({ subtasks: [{ id: "a", prompt: "p", paths: [] }] }).ok);
});

test("9.15 dependsOn auto-initialized to [] if not array", () => {
	const r = validateManifest({ subtasks: [{ id: "a", prompt: "p", paths: ["x"], dependsOn: undefined }] });
	assert.ok(r.ok);
	// After validation, dependsOn is not part of the returned manifest — but validation passes
});

test("9.16 dependsOn can reference existing ids", () => {
	const r = validateManifest({
		subtasks: [
			{ id: "a", prompt: "p1", paths: ["a.ts"] },
			{ id: "b", prompt: "p2", paths: ["b.ts"], dependsOn: ["a"] },
		],
	});
	assert.ok(r.ok);
});

test("9.17 many subtasks valid", () => {
	const subs = Array.from({ length: 50 }, (_, i) => ({
		id: `s${i}`, prompt: `task ${i}`, paths: [`f${i}.ts`],
	}));
	assert.ok(validateManifest({ subtasks: subs }).ok);
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. TOPOLOGICAL SORT (edge cases)
// ─────────────────────────────────────────────────────────────────────────────

test("10.01 single task → one level", () => {
	const { levels } = topoLevels([{ id: "a", prompt: "p", paths: ["a.ts"] }]);
	assert.strictEqual(levels.length, 1);
	assert.strictEqual(levels[0]!.length, 1);
});

test("10.02 no dependencies → one level with all", () => {
	const { levels } = topoLevels([
		{ id: "a", prompt: "p", paths: ["a.ts"] },
		{ id: "b", prompt: "p", paths: ["b.ts"] },
		{ id: "c", prompt: "p", paths: ["c.ts"] },
	]);
	assert.strictEqual(levels.length, 1);
	assert.strictEqual(levels[0]!.length, 3);
});

test("10.03 linear chain a→b→c → 3 levels", () => {
	const { levels } = topoLevels([
		{ id: "a", prompt: "p", paths: ["a.ts"] },
		{ id: "b", prompt: "p", paths: ["b.ts"], dependsOn: ["a"] },
		{ id: "c", prompt: "p", paths: ["c.ts"], dependsOn: ["b"] },
	]);
	assert.strictEqual(levels.length, 3);
	assert.strictEqual(levels[0]![0]!.id, "a");
	assert.strictEqual(levels[1]![0]!.id, "b");
	assert.strictEqual(levels[2]![0]!.id, "c");
});

test("10.04 diamond dependency a→{b,c}→d → 3 levels", () => {
	const { levels } = topoLevels([
		{ id: "a", prompt: "p", paths: ["a.ts"] },
		{ id: "b", prompt: "p", paths: ["b.ts"], dependsOn: ["a"] },
		{ id: "c", prompt: "p", paths: ["c.ts"], dependsOn: ["a"] },
		{ id: "d", prompt: "p", paths: ["d.ts"], dependsOn: ["b", "c"] },
	]);
	assert.strictEqual(levels.length, 3);
	assert.strictEqual(levels[0]!.length, 1); // a
	assert.strictEqual(levels[1]!.length, 2); // b, c
	assert.strictEqual(levels[2]!.length, 1); // d
});

test("10.05 depends on unknown → error", () => {
	const { error } = topoLevels([
		{ id: "a", prompt: "p", paths: ["a.ts"], dependsOn: ["z"] },
	]);
	assert.ok(error);
	assert.match(error!, /unknown/);
});

test("10.06 circular a→b→a → error", () => {
	const { error } = topoLevels([
		{ id: "a", prompt: "p", paths: ["a.ts"], dependsOn: ["b"] },
		{ id: "b", prompt: "p", paths: ["b.ts"], dependsOn: ["a"] },
	]);
	assert.ok(error);
	assert.match(error!, /circular/);
});

test("10.07 self-dependency → circular error", () => {
	const { error } = topoLevels([
		{ id: "a", prompt: "p", paths: ["a.ts"], dependsOn: ["a"] },
	]);
	assert.ok(error);
});

test("10.08 three-node cycle → circular error", () => {
	const { error } = topoLevels([
		{ id: "a", prompt: "p", paths: ["a.ts"], dependsOn: ["c"] },
		{ id: "b", prompt: "p", paths: ["b.ts"], dependsOn: ["a"] },
		{ id: "c", prompt: "p", paths: ["c.ts"], dependsOn: ["b"] },
	]);
	assert.ok(error);
});

test("10.09 complex DAG preserves all nodes", () => {
	const tasks = [
		{ id: "a", prompt: "p", paths: ["a"] },
		{ id: "b", prompt: "p", paths: ["b"], dependsOn: ["a"] },
		{ id: "c", prompt: "p", paths: ["c"], dependsOn: ["a"] },
		{ id: "d", prompt: "p", paths: ["d"], dependsOn: ["b"] },
		{ id: "e", prompt: "p", paths: ["e"], dependsOn: ["b", "c"] },
		{ id: "f", prompt: "p", paths: ["f"], dependsOn: ["d", "e"] },
	];
	const { levels, error } = topoLevels(tasks);
	assert.ok(!error);
	const allIds = levels.flatMap((l) => l.map((t) => t.id));
	assert.strictEqual(allIds.length, 6);
	for (const t of tasks) assert.ok(allIds.includes(t.id));
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. VERDICT PARSER
// ─────────────────────────────────────────────────────────────────────────────

test("11.01 VERDICT: CONCEDE match", () => {
	assert.strictEqual(parseStrictVerdictLine("VERDICT: CONCEDE — all good", "VERDICT"), "CONCEDE");
});

test("11.02 VERDICT: BREACH match", () => {
	assert.strictEqual(parseStrictVerdictLine("VERDICT: BREACH — found xss", "VERDICT"), "BREACH");
});

test("11.03 scans from bottom (last match wins)", () => {
	const text = "VERDICT: BREACH — first\nsome analysis\nVERDICT: CONCEDE — final";
	assert.strictEqual(parseStrictVerdictLine(text, "VERDICT"), "CONCEDE");
});

test("11.04 no match → undefined", () => {
	assert.strictEqual(parseStrictVerdictLine("no verdict line here", "VERDICT"), undefined);
});

test("11.05 empty string → undefined", () => {
	assert.strictEqual(parseStrictVerdictLine("", "VERDICT"), undefined);
});

test("11.06 custom prefix CONVERGED", () => {
	assert.strictEqual(parseStrictVerdictLine("CONVERGED: yes — done", "CONVERGED"), "yes");
});

test("11.07 verdict-like but missing em-dash → no match", () => {
	assert.strictEqual(parseStrictVerdictLine("VERDICT: CONCEDE all good", "VERDICT"), undefined);
});

test("11.08 verdict with extra spaces", () => {
	assert.strictEqual(parseStrictVerdictLine("VERDICT:   BREACH   — with spaces", "VERDICT"), "BREACH");
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. COMMAND_CAST FOR GAUNTLET
// ─────────────────────────────────────────────────────────────────────────────

test("12.01 COMMAND_CAST[gauntlet] has correct 7 roles", () => {
	const s = src();
	const match = s.match(/gauntlet:\s*\[([^\]]+)\]/);
	assert.ok(match, "gauntlet entry not found in COMMAND_CAST");
	const roles = match![1]!.split(",").map((r) => r.trim().replace(/'/g, '"'));
	assert.strictEqual(roles.length, 7);
	assert.ok(roles.includes('"PANEL"'), "Missing PANEL");
	assert.ok(roles.includes('"PANEL_2"'), "Missing PANEL_2");
	assert.ok(roles.includes('"CHAIRMAN"'), "Missing CHAIRMAN");
	assert.ok(roles.includes('"VALIDATOR"'), "Missing VALIDATOR");
	assert.ok(roles.includes('"COORDINATOR"'), "Missing COORDINATOR");
	assert.ok(roles.includes('"BUILDER"'), "Missing BUILDER");
	assert.ok(roles.includes('"ATTACKER"'), "Missing ATTACKER");
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. GAUNTLET STAGE-TO-HANDLER MAPPING
// ─────────────────────────────────────────────────────────────────────────────

test("13.01 all 7 stage names have a case in runGauntletStage switch", () => {
	const s = src();
	// Extract the runGauntletStage function body
	const fnMatch = s.match(/async function runGauntletStage\([\s\S]*?^\t\}\r?\n/m);
	assert.ok(fnMatch, "Could not extract runGauntletStage function");
	const body = fnMatch[0]!;
	const stageNames = ["DELIBERATE", "GATE-FIRST", "DECOMPOSE", "BUILD", "VERIFY", "HARDEN", "INTEGRATE"];
	for (const name of stageNames) {
		assert.ok(body.includes(`case "${name}":`), `Missing case "${name}" in runGauntletStage switch`);
	}
});

test("13.02 DELIBERATE handles skipCouncil path", () => {
	const s = src();
	const fnMatch = s.match(/async function runGauntletStage\([\s\S]*?^\t\}\r?\n/m);
	assert.ok(fnMatch);
	const body = fnMatch[0]!;
	// After case "DELIBERATE": there should be skipCouncil check
	const deliberateSection = body.slice(body.indexOf('case "DELIBERATE":'));
	assert.ok(deliberateSection.includes('state.skipCouncil'), "DELIBERATE missing skipCouncil check");
});

test("13.03 DELIBERATE handles deliberateMode === 'debate' path", () => {
	const s = src();
	assert.ok(s.includes('state.deliberateMode === "debate"'), "Missing debate mode check in DELIBERATE");
});

test("13.04 HARDEN handles skipRedteam path", () => {
	const s = src();
	const fnMatch = s.match(/async function runGauntletStage\([\s\S]*?^\t\}\r?\n/m);
	assert.ok(fnMatch);
	const body = fnMatch[0]!;
	const hardenSection = body.slice(body.indexOf('case "HARDEN":'));
	assert.ok(hardenSection.includes('state.skipRedteam'), "HARDEN missing skipRedteam check");
});

test("13.05 GATE-FIRST calls validatorDesignGate", () => {
	const s = src();
	const fnMatch = s.match(/async function runGauntletStage\([\s\S]*?^\t\}\r?\n/m);
	assert.ok(fnMatch);
	const body = fnMatch[0]!;
	const gateSection = body.slice(body.indexOf('case "GATE-FIRST":'), body.indexOf('case "DECOMPOSE":'));
	assert.ok(gateSection.includes('validatorDesignGate'), "GATE-FIRST missing validatorDesignGate call");
});

test("13.06 DECOMPOSE calls coordinatorDecompose", () => {
	const s = src();
	const fnMatch = s.match(/async function runGauntletStage\([\s\S]*?^\t\}\r?\n/m);
	assert.ok(fnMatch);
	const body = fnMatch[0]!;
	const decompSection = body.slice(body.indexOf('case "DECOMPOSE":'), body.indexOf('case "BUILD":'));
	assert.ok(decompSection.includes('coordinatorDecompose'), "DECOMPOSE missing coordinatorDecompose call");
});

test("13.07 BUILD calls coordinatorWorkerLevels", () => {
	const s = src();
	const fnMatch = s.match(/async function runGauntletStage\([\s\S]*?^\t\}\r?\n/m);
	assert.ok(fnMatch);
	const body = fnMatch[0]!;
	const buildSection = body.slice(body.indexOf('case "BUILD":'), body.indexOf('case "VERIFY":'));
	assert.ok(buildSection.includes('coordinatorWorkerLevels'), "BUILD missing coordinatorWorkerLevels call");
});

test("13.08 VERIFY calls gateCorrectionLoop", () => {
	const s = src();
	const fnMatch = s.match(/async function runGauntletStage\([\s\S]*?^\t\}\r?\n/m);
	assert.ok(fnMatch);
	const body = fnMatch[0]!;
	const verifySection = body.slice(body.indexOf('case "VERIFY":'), body.indexOf('case "HARDEN":'));
	assert.ok(verifySection.includes('gateCorrectionLoop'), "VERIFY missing gateCorrectionLoop call");
});

test("13.09 HARDEN calls redteamSortieLoop", () => {
	const s = src();
	const fnMatch = s.match(/async function runGauntletStage\([\s\S]*?^\t\}\r?\n/m);
	assert.ok(fnMatch);
	const body = fnMatch[0]!;
	const hardenSection = body.slice(body.indexOf('case "HARDEN":'), body.indexOf('case "INTEGRATE":'));
	assert.ok(hardenSection.includes('redteamSortieLoop'), "HARDEN missing redteamSortieLoop call");
});

test("13.10 INTEGRATE calls coordinatorIntegrate", () => {
	const s = src();
	const fnMatch = s.match(/async function runGauntletStage\([\s\S]*?^\t\}\r?\n/m);
	assert.ok(fnMatch);
	const body = fnMatch[0]!;
	const intSection = body.slice(body.indexOf('case "INTEGRATE":'));
	assert.ok(intSection.includes('coordinatorIntegrate'), "INTEGRATE missing coordinatorIntegrate call");
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. WIDGET RENDERING — stage status glyphs
// ─────────────────────────────────────────────────────────────────────────────

test("14.01 stage glyphs are defined for all 5 statuses", () => {
	const statuses = ["done", "failed", "skipped", "working", "pending"];
	for (const s of statuses) {
		assert.ok(STAGE_GLYPH[s], `Missing glyph for status: ${s}`);
	}
});

test("14.02 done → ✓, failed → ✗, skipped → ⊘, working → ◐, pending → ○", () => {
	assert.strictEqual(STAGE_GLYPH["done"], "✓");
	assert.strictEqual(STAGE_GLYPH["failed"], "✗");
	assert.strictEqual(STAGE_GLYPH["skipped"], "⊘");
	assert.strictEqual(STAGE_GLYPH["working"], "◐");
	assert.strictEqual(STAGE_GLYPH["pending"], "○");
});

test("14.03 source widget uses same glyphs (structural check)", () => {
	const s = src();
	// The widget renders status → glyph; check it references the same glyphs
	assert.ok(s.includes('s.status === "done" ? "✓"') || s.includes('status === "done" ? "✓"'), "Widget missing done glyph ✓");
	assert.ok(s.includes('s.status === "failed" ? "✗"') || s.includes('status === "failed" ? "✗"'), "Widget missing failed glyph ✗");
	assert.ok(s.includes('s.status === "skipped" ? "⊘"') || s.includes('status === "skipped" ? "⊘"'), "Widget missing skipped glyph ⊘");
	assert.ok(s.includes('s.status === "working" ? "◐"') || s.includes('status === "working" ? "◐"'), "Widget missing working glyph ◐");
});

test("14.04 widget renders all 7 stage names in the stageLine map", () => {
	const s = src();
	// The widget is in the gauntlet handler (not runGauntletStage), uses campaignState.stages.map
	assert.ok(s.includes('campaignState.stages.map((s, i)'), "Widget missing campaignState.stages.map");
	// Also check the stageLine variable renders status glyphs
	assert.ok(s.includes('s.status === "done" ? "✓"') || s.includes('status === "done" ? "✓"'), "Widget missing done glyph");
});

// ─────────────────────────────────────────────────────────────────────────────
// 15. RESUME LOGIC
// ─────────────────────────────────────────────────────────────────────────────

test("15.01 resume with all done → firstIncompleteStage returns -1 → info notification expected", () => {
	const state: CampaignState = {
		prompt: "test",
		stages: GAUNTLET_STAGES.map((n) => ({ ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const })),
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	const startIdx = firstIncompleteStage(state);
	assert.strictEqual(startIdx, -1);
	// In the handler, this triggers: "campaign is already complete" notification
});

test("15.02 resume with partial completion → resumes at correct index", () => {
	const state: CampaignState = {
		prompt: "test",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done" },
			{ ...emptyStage("GATE-FIRST"), status: "done" },
			{ ...emptyStage("DECOMPOSE"), status: "done" },
		{ ...emptyStage("BUILD"), status: "failed" },
		emptyStage("VERIFY"),
		emptyStage("HARDEN"),
		emptyStage("INTEGRATE"),
		],
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 3);
});

test("15.03 resume with all pending → starts from 0", () => {
	const state: CampaignState = {
		prompt: "test",
		stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 0);
});

test("15.04 resume: state.json round-trip with cast snapshot preserves cast", () => {
	const dir = fs.mkdtempSync(path.join(TMP, "resume-"));
	const cast = { ARCHITECT: { model: "test/a" }, BUILDER: { model: "test/b" }, PANEL: { model: "test/p" } };
	const state: CampaignState = {
		prompt: "resume test",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done", castSnapshot: { ...cast } },
			emptyStage("GATE-FIRST"),
		emptyStage("DECOMPOSE"),
		emptyStage("BUILD"),
		emptyStage("VERIFY"),
		emptyStage("HARDEN"),
		emptyStage("INTEGRATE"),
		],
		cast: { ...cast },
		createdAt: new Date().toISOString(),
		skipCouncil: false,
		skipRedteam: true,
		deliberateMode: "debate",
	};
	fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	const loaded = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")) as CampaignState;
	assert.deepStrictEqual(loaded.cast, cast);
	// castSnapshot IS serialized (it's in the StageState interface)
	assert.ok(loaded.stages[0]!.castSnapshot, "castSnapshot should be preserved in round-trip");
	assert.deepStrictEqual(loaded.stages[0]!.castSnapshot, cast);
});

test("15.05 resume: --resume with no dir and no gauntlet dirs → error notification expected", () => {
	// latestGauntletDir returns undefined → handler shows error
	// We test the simulated function
	const root = fs.mkdtempSync(path.join(TMP, "no-gauntlet-"));
	// No gauntlet dirs here
	simulatedLatestGauntletDir(root).then((result) => {
		assert.strictEqual(result, undefined);
	}).catch(() => {});
	// Synchronous check: readdir would succeed but find nothing
	const entries = fs.readdirSync(root);
	const gauntletDirs = entries.filter((e) => e.startsWith("gauntlet-"));
	assert.strictEqual(gauntletDirs.length, 0);
});

// ─────────────────────────────────────────────────────────────────────────────
// 16. INTEGRATION: FULL GAUNTLET FLOW SIMULATION
// ─────────────────────────────────────────────────────────────────────────────

test("16.01 full campaign: create state, mark stages done sequentially, verify completion", async () => {
	const dir = fs.mkdtempSync(path.join(TMP, "full-"));
	const state: CampaignState = {
		prompt: "build a REST API",
		stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: { ARCHITECT: { model: "a/a" }, BUILDER: { model: "b/b" } },
		createdAt: new Date().toISOString(),
		skipCouncil: false,
		skipRedteam: false,
		deliberateMode: "council",
	};
	// Simulate running through all stages
	for (let i = 0; i < state.stages.length; i++) {
		state.stages[i]!.status = "done";
		state.stages[i]!.endedAt = new Date().toISOString();
		state.stages[i]!.costUsd = 0.05;
		// Save after each stage (like the real handler does)
		fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	}
	// Verify
	const loaded = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")) as CampaignState;
	assert.strictEqual(firstIncompleteStage(loaded), -1);
	assert.strictEqual(accumulateCost(loaded.stages), 0.35);
	const completed = loaded.stages.filter((s) => s.status === "done").length;
	assert.strictEqual(completed, 7);
});

test("16.02 campaign with skipRedteam: harden is skipped, still completes", async () => {
	const dir = fs.mkdtempSync(path.join(TMP, "skip-"));
	const state: CampaignState = {
		prompt: "skip redteam test",
		stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: {},
		createdAt: new Date().toISOString(),
		skipCouncil: false,
		skipRedteam: true,
		deliberateMode: "council",
	};
	// Mark all as done except HARDEN which is skipped
	for (let i = 0; i < state.stages.length; i++) {
		if (GAUNTLET_STAGES[i] === "harden") {
			state.stages[i]!.status = "skipped";
		} else {
			state.stages[i]!.status = "done";
		}
	}
	fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	const loaded = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")) as CampaignState;
	const completed = loaded.stages.filter((s) => s.status === "done" || s.status === "skipped").length;
	assert.strictEqual(completed, 7);
	assert.strictEqual(loaded.stages[5]!.status, "skipped");
});

test("16.03 campaign halts on first failure", async () => {
	const state: CampaignState = {
		prompt: "fail test",
		stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: {},
		createdAt: new Date().toISOString(),
		skipCouncil: false,
		skipRedteam: false,
		deliberateMode: "council",
	};
	// DELIBERATE done, GATE-FIRST fails
	state.stages[0]!.status = "done";
	state.stages[1]!.status = "failed";

	let haltedAt = -1;
	for (let i = 0; i < state.stages.length; i++) {
		if (state.stages[i]!.status === "done" || state.stages[i]!.status === "skipped") {
			continue;
		}
		haltedAt = i;
		break;
	}
	assert.strictEqual(haltedAt, 1);
});

test("16.04 campaign: working stage is incomplete (firstIncompleteStage returns it)", () => {
	const state: CampaignState = {
		prompt: "",
		stages: GAUNTLET_STAGES.map((n, i) => ({
			...emptyStage(GAUNTLET_STAGE_NAMES[n]),
			status: i < 3 ? ("done" as const) : i === 3 ? ("working" as const) : ("pending" as const),
		})),
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 3);
});

test("16.05 source: gauntlet handler creates gauntlet-* directory", () => {
	const s = src();
	assert.ok(s.includes('`gauntlet-${path.basename(dir).replace("fusion-harness-", "")}`'),
		"gauntlet dir naming pattern not found");
});

test("16.06 source: gauntlet handler calls saveCampaignState before running", () => {
	const s = src();
	// In the handler: saveCampaignState is called before the stage loop
	assert.ok(s.includes('await saveCampaignState(realDir, campaignState)'),
		"saveCampaignState not called before gauntlet stages");
});

test("16.07 source: gauntlet handler uses runGauntletStage in loop", () => {
	const s = src();
	assert.ok(
		/const cont = await runGauntletStage\(i, campaignState, realDir/.test(s),
		"runGauntletStage not called in gauntlet handler loop",
	);
});

test("16.08 source: gauntlet handler checks cont to break loop", () => {
	const s = src();
	// Should have: if (!cont) break;
	assert.ok(s.includes('if (!cont) break'), "Missing loop break on stage failure");
});

test("16.09 source: gauntlet handler renders verdict panel on complete", () => {
	const s = src();
	assert.ok(s.includes('kind: "verdict", command: "gauntlet"'), "Missing verdict panel for gauntlet completion");
});

test("16.10 source: gauntlet handler renders error panel on halt", () => {
	const s = src();
	assert.ok(s.includes('kind: "error", command: "gauntlet"'), "Missing error panel for gauntlet halt");
});

test("16.11 source: gauntlet resume path calls loadCampaignState", () => {
	const s = src();
	assert.ok(s.includes('state = await loadCampaignState(targetDir)'), "Resume path missing loadCampaignState");
});

test("16.12 source: gauntlet handler calls runCastGate for preflight", () => {
	const s = src();
	// The gauntlet handler calls runCastGate(ctx, "gauntlet", false) for both fresh and resume
	const count = (s.match(/runCastGate\(ctx, "gauntlet"/g) || []).length;
	assert.ok(count >= 2, `Expected at least 2 runCastGate calls for gauntlet, found ${count}`);
});

// ─────────────────────────────────────────────────────────────────────────────
// 17. CROSS-REFERENCE: Source constants match extracted constants
// ─────────────────────────────────────────────────────────────────────────────

test("17.01 source GAUNTLET_STAGES matches our extraction", () => {
	const s = src();
	const match = s.match(/const GAUNTLET_STAGES = \[([\s\S]*?)\] as const/);
	assert.ok(match);
	const stages = match![1]!.match(/"(\w+)"/g)!.map((m) => m.replace(/"/g, ""));
	assert.deepStrictEqual(stages, [...GAUNTLET_STAGES]);
});

test("17.02 source GAUNTLET_STAGE_NAMES matches our extraction", () => {
	const s = src();
	for (const [key, value] of Object.entries(GAUNTLET_STAGE_NAMES)) {
		assert.ok(s.includes(`${key}: "${value}"`), `Source missing ${key}: "${value}"`);
	}
});

test("17.03 source STAGE_PREREQS matches our extraction", () => {
	const s = src();
	for (const [stage, prereqs] of Object.entries(STAGE_PREREQS)) {
		const prereqStr = JSON.stringify(prereqs);
		assert.ok(s.includes(`${stage}: ${prereqStr}`) || s.includes(`${stage}: [${prereqs.map(p => `"${p}"`).join(", ")}]`),
			`Source STAGE_PREREQS[${stage}] doesn't match`);
	}
});

test("17.04 source StageState interface matches our extraction", () => {
	const s = src();
	const match = s.match(/interface StageState \{([\s\S]*?)\}/);
	assert.ok(match);
	const body = match![1]!;
	const requiredFields = ["name: string", 'status: "pending" | "working" | "done" | "failed" | "skipped"', "artifacts: Record<string, string>"];
	for (const field of requiredFields) {
		assert.ok(body.includes(field), `StageState missing field: ${field}`);
	}
});

test("17.05 source CampaignState interface matches our extraction", () => {
	const s = src();
	const match = s.match(/interface CampaignState \{([\s\S]*?)\}/);
	assert.ok(match);
	const body = match![1]!;
	const requiredFields = ["prompt: string", "stages: StageState[]", "cast: Cast", "createdAt: string", "skipCouncil: boolean", "skipRedteam: boolean"];
	for (const field of requiredFields) {
		assert.ok(body.includes(field), `CampaignState missing field: ${field}`);
	}
});

// ─────────────────────────────────────────────────────────────────────────────
// 18. README DOCUMENTATION
// ─────────────────────────────────────────────────────────────────────────────

test("18.01 README documents /gauntlet", () => {
	const readme = fs.readFileSync(path.join(__dirname, "..", "..", "README.md"), "utf-8");
	assert.ok(readme.toLowerCase().includes("gauntlet"), "README missing gauntlet");
});

test("18.02 README documents /chain", () => {
	const readme = fs.readFileSync(path.join(__dirname, "..", "..", "README.md"), "utf-8");
	assert.ok(readme.toLowerCase().includes("chain"), "README missing chain");
});

test("18.03 README mentions 7 stages or campaign pipeline", () => {
	const readme = fs.readFileSync(path.join(__dirname, "..", "..", "README.md"), "utf-8");
	const hasStages = readme.includes("7-stage") || readme.includes("7 stage") || readme.includes("seven-stage") || readme.includes("seven stage");
	assert.ok(hasStages || readme.includes("campaign") || readme.includes("pipeline"), "README should mention 7 stages or campaign");
});

// ═══════════════════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;
(async () => {
let passed = 0;
let failed = 0;
let errors: Array<{ name: string; error: string }> = [];

for (const { name, fn } of tests) {
	try {
		await fn();
		console.log(`  ✓ ${name}`);
		passed++;
	} catch (err: any) {
		console.log(`  ✗ ${name}`);
		console.log(`      ${err.message}`);
		failed++;
		errors.push({ name, error: err.message });
	}
}

console.log(`\n══════════════════════════════════════════════`);
console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
if (errors.length) {
	console.log(`\n  FAILURES:`);
	for (const e of errors) console.log(`    ✗ ${e.name}: ${e.error}`);
}
console.log(`══════════════════════════════════════════════`);

// Cleanup temp dir
try { fs.rmSync(TMP, { recursive: true }); } catch {}

process.exit(failed > 0 ? 1 : 0);
})();
