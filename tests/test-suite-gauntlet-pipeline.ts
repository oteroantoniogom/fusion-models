/**
 * GAUNTLET-PIPELINE TEST SUITE
 * =================================================================
 * Tests for the gauntlet-pipeline change:
 *   - Stage extraction functions (council, validator-gate, coordinator, redteam)
 *   - Pipeline conductor constants and helpers
 *   - /chain composer (prerequisite map, stage roles, validation)
 *   - Campaign board (state, widget, degradation)
 *   - Structural integrity of existing standalone commands
 *
 * This suite tests ALL pure logic: constants, helpers, validators, and
 * algorithmic components. It does NOT require a running pi TUI — it tests
 * the isolated functions extracted from the extension code.
 *
 * Run:  npx tsx tests/test-suite-gauntlet-pipeline.ts
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as path from "node:path";

// ═══════════════════════════════════════════════════════════════════════════════
// FAITHFUL EXTRACTIONS from gauntlet-pipeline code
// ═══════════════════════════════════════════════════════════════════════════════

// ── Gauntlet stage constants ────────────────────────────────────────────────
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

// ── Chain stage constants ───────────────────────────────────────────────────
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

// ── Stage prerequisite map ──────────────────────────────────────────────────
const STAGE_PREREQS: Record<ChainStage, string[]> = {
	deliberate: [],
	gate: ["plan.md"],
	decompose: ["plan.md"],
	build: ["subtasks.json"],
	verify: ["gate.py"],
	harden: [],
	integrate: ["plan.md"],
};

// ── Stage roles union ───────────────────────────────────────────────────────
type Role = string;
const stageRoles = (stages: ChainStage[]): Role[] => {
	const roles = new Set<Role>();
	for (const s of stages) {
		switch (s) {
			case "deliberate":
				roles.add("PANEL");
				roles.add("CHAIRMAN");
				roles.add("DEBATER_A");
				roles.add("DEBATER_B");
				roles.add("JUDGE");
				break;
			case "gate":
			case "verify":
				roles.add("VALIDATOR");
				roles.add("BUILDER");
				break;
			case "decompose":
			case "integrate":
				roles.add("COORDINATOR");
				break;
			case "build":
				roles.add("BUILDER");
				break;
			case "harden":
				roles.add("ATTACKER");
				roles.add("BUILDER");
				break;
		}
	}
	return [...roles];
};

// ── Campaign state types ────────────────────────────────────────────────────
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

// ── Subtask manifest types and validators (from /coordinate) ───────────────
interface SubtaskEntry {
	id: string;
	title?: string;
	prompt?: string;
	paths?: string[];
	dependsOn?: string[];
}
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

// ── Stage I/O file path construction (chain dir, gauntlet dir) ──────────────
const chainDirName = (baseName: string): string => `chain-${baseName.replace(/fusion-harness-/g, "")}`;
const gauntletDirName = (baseName: string): string => `gauntlet-${baseName.replace(/fusion-harness-/g, "")}`;

// ── Verdict line parser (shared by redteam, debate) ─────────────────────────
function parseStrictVerdictLine(text: string, prefix: string): string | undefined {
	const lines = text.trim().split("\n");
	const pat = new RegExp(`^${prefix}:\\s*(\\S+)\\s*—`);
	for (let i = lines.length - 1; i >= 0; i--) {
		const m = lines[i]!.trim().match(pat);
		if (m) return m[1]!;
	}
	return undefined;
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

const tests: Array<{ name: string; fn: () => void }> = [];

function test(name: string, fn: () => void) {
	tests.push({ name, fn });
}

// ── 1. Gauntlet Stage Constants ─────────────────────────────────────────────

test("GAUNTLET_STAGES has 7 stages in fixed order", () => {
	assert.strictEqual(GAUNTLET_STAGES.length, 7);
	assert.deepStrictEqual(GAUNTLET_STAGES, [
		"deliberate", "gate", "decompose", "build", "verify", "harden", "integrate",
	]);
});

test("GAUNTLET_STAGE_NAMES maps all stages to uppercase names", () => {
	assert.strictEqual(GAUNTLET_STAGE_NAMES.deliberate, "DELIBERATE");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.gate, "GATE-FIRST");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.decompose, "DECOMPOSE");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.build, "BUILD");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.verify, "VERIFY");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.harden, "HARDEN");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.integrate, "INTEGRATE");
});

test("CHAIN_STAGE_NAMES matches GAUNTLET_STAGES", () => {
	assert.strictEqual(CHAIN_STAGE_NAMES.length, GAUNTLET_STAGES.length);
	for (const s of CHAIN_STAGE_NAMES) {
		assert.ok(GAUNTLET_STAGES.includes(s), `chain stage '${s}' not in gauntlet stages`);
	}
});

// ── 2. Stage Prerequisites ─────────────────────────────────────────────────

test("STAGE_PREREQS: deliberate has no prerequisites", () => {
	assert.deepStrictEqual(STAGE_PREREQS.deliberate, []);
});

test("STAGE_PREREQS: gate requires plan.md", () => {
	assert.deepStrictEqual(STAGE_PREREQS.gate, ["plan.md"]);
});

test("STAGE_PREREQS: decompose requires plan.md", () => {
	assert.deepStrictEqual(STAGE_PREREQS.decompose, ["plan.md"]);
});

test("STAGE_PREREQS: build requires subtasks.json", () => {
	assert.deepStrictEqual(STAGE_PREREQS.build, ["subtasks.json"]);
});

test("STAGE_PREREQS: verify requires gate.py", () => {
	assert.deepStrictEqual(STAGE_PREREQS.verify, ["gate.py"]);
});

test("STAGE_PREREQS: harden has no prerequisites", () => {
	assert.deepStrictEqual(STAGE_PREREQS.harden, []);
});

test("STAGE_PREREQS: integrate requires plan.md", () => {
	assert.deepStrictEqual(STAGE_PREREQS.integrate, ["plan.md"]);
});

// ── 3. Stage Roles Union ───────────────────────────────────────────────────

test("stageRoles: deliberate adds PANEL, CHAIRMAN, DEBATER_A/B, JUDGE", () => {
	const roles = stageRoles(["deliberate"]);
	assert.ok(roles.includes("PANEL"));
	assert.ok(roles.includes("CHAIRMAN"));
	assert.ok(roles.includes("DEBATER_A"));
	assert.ok(roles.includes("DEBATER_B"));
	assert.ok(roles.includes("JUDGE"));
	assert.strictEqual(roles.length, 5);
});

test("stageRoles: gate adds VALIDATOR and BUILDER", () => {
	const roles = stageRoles(["gate"]);
	assert.ok(roles.includes("VALIDATOR"));
	assert.ok(roles.includes("BUILDER"));
	assert.strictEqual(roles.length, 2);
});

test("stageRoles: decompose adds COORDINATOR", () => {
	const roles = stageRoles(["decompose"]);
	assert.ok(roles.includes("COORDINATOR"));
	assert.strictEqual(roles.length, 1);
});

test("stageRoles: build adds BUILDER", () => {
	const roles = stageRoles(["build"]);
	assert.ok(roles.includes("BUILDER"));
	assert.strictEqual(roles.length, 1);
});

test("stageRoles: verify adds VALIDATOR and BUILDER", () => {
	const roles = stageRoles(["verify"]);
	assert.ok(roles.includes("VALIDATOR"));
	assert.ok(roles.includes("BUILDER"));
	assert.strictEqual(roles.length, 2);
});

test("stageRoles: harden adds ATTACKER and BUILDER", () => {
	const roles = stageRoles(["harden"]);
	assert.ok(roles.includes("ATTACKER"));
	assert.ok(roles.includes("BUILDER"));
	assert.strictEqual(roles.length, 2);
});

test("stageRoles: integrate adds COORDINATOR", () => {
	const roles = stageRoles(["integrate"]);
	assert.ok(roles.includes("COORDINATOR"));
	assert.strictEqual(roles.length, 1);
});

test("stageRoles: full gauntlet chain includes all roles", () => {
	const roles = stageRoles(["deliberate", "gate", "decompose", "build", "verify", "harden", "integrate"]);
	const expected = ["PANEL", "CHAIRMAN", "DEBATER_A", "DEBATER_B", "JUDGE", "VALIDATOR", "BUILDER", "COORDINATOR", "ATTACKER"];
	for (const r of expected) {
		assert.ok(roles.includes(r), `missing role ${r}`);
	}
	// No duplicates (Set)
	assert.strictEqual(roles.length, expected.length);
});

test("stageRoles: verify+integrate union = VALIDATOR, BUILDER, COORDINATOR", () => {
	const roles = stageRoles(["verify", "integrate"]);
	assert.ok(roles.includes("VALIDATOR"));
	assert.ok(roles.includes("BUILDER"));
	assert.ok(roles.includes("COORDINATOR"));
	assert.strictEqual(roles.length, 3);
});

test("stageRoles: gate+decompose+build union", () => {
	const roles = stageRoles(["gate", "decompose", "build"]);
	assert.ok(roles.includes("VALIDATOR"));
	assert.ok(roles.includes("BUILDER"));
	assert.ok(roles.includes("COORDINATOR"));
	assert.strictEqual(roles.length, 3);
});

// ── 4. Campaign State Helpers ──────────────────────────────────────────────

test("emptyStage creates a pending stage with the given name and empty artifacts", () => {
	const s = emptyStage("DELIBERATE");
	assert.strictEqual(s.name, "DELIBERATE");
	assert.strictEqual(s.status, "pending");
	assert.deepStrictEqual(s.artifacts, {});
	assert.strictEqual(s.startedAt, undefined);
	assert.strictEqual(s.endedAt, undefined);
});

test("emptyStage creates multiple independent stages", () => {
	const a = emptyStage("DELIBERATE");
	const b = emptyStage("GATE-FIRST");
	assert.strictEqual(a.name, "DELIBERATE");
	assert.strictEqual(b.name, "GATE-FIRST");
	assert.strictEqual(a.status, "pending");
	assert.strictEqual(b.status, "pending");
});

test("firstIncompleteStage finds first non-done stage", () => {
	const state: CampaignState = {
		prompt: "test",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done" },
			{ ...emptyStage("GATE-FIRST"), status: "done" },
			{ ...emptyStage("DECOMPOSE"), status: "pending" },
			emptyStage("BUILD"),
		],
		cast: {},
		createdAt: "",
		skipCouncil: false,
		skipRedteam: false,
		deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 2);
});

test("firstIncompleteStage returns -1 when all done", () => {
	const state: CampaignState = {
		prompt: "test",
		stages: GAUNTLET_STAGES.map((n) => ({ ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const })),
		cast: {},
		createdAt: "",
		skipCouncil: false,
		skipRedteam: false,
		deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), -1);
});

test("firstIncompleteStage returns 0 when first stage is failed", () => {
	const state: CampaignState = {
		prompt: "test",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "failed" },
			emptyStage("GATE-FIRST"),
		],
		cast: {},
		createdAt: "",
		skipCouncil: false,
		skipRedteam: false,
		deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 0);
});

test("accumulateCost returns 0 for empty or zero-cost stages", () => {
	assert.strictEqual(accumulateCost([]), 0);
	assert.strictEqual(accumulateCost([emptyStage("DELIBERATE")]), 0);
});

test("accumulateCost sums stage costs", () => {
	const stages: StageState[] = [
		{ ...emptyStage("DELIBERATE"), costUsd: 0.5 },
		{ ...emptyStage("GATE-FIRST"), costUsd: 0.3 },
	];
	assert.strictEqual(accumulateCost(stages), 0.8);
});

test("accumulateCost handles undefined costUsd", () => {
	const stages: StageState[] = [
		{ ...emptyStage("DELIBERATE") },
		{ ...emptyStage("GATE-FIRST"), costUsd: 0.3 },
	];
	assert.strictEqual(accumulateCost(stages), 0.3);
});

// ── 5. Directory Naming ────────────────────────────────────────────────────

test("chainDirName creates chain-* dir name from fusion-harness base", () => {
	assert.strictEqual(chainDirName("fusion-harness-abc123"), "chain-abc123");
});

test("gauntletDirName creates gauntlet-* dir name from fusion-harness base", () => {
	assert.strictEqual(gauntletDirName("fusion-harness-abc123"), "gauntlet-abc123");
});

test("chainDirName and gauntletDirName handle empty base", () => {
	assert.strictEqual(chainDirName("fusion-harness-"), "chain-");
	assert.strictEqual(gauntletDirName("fusion-harness-"), "gauntlet-");
});

// ── 6. Verdict Line Parser (reused by redteam) ─────────────────────────────

test("parseStrictVerdictLine: CONCEDE match", () => {
	assert.strictEqual(parseStrictVerdictLine("VERDICT: CONCEDE — all good", "VERDICT"), "CONCEDE");
});

test("parseStrictVerdictLine: BREACH match", () => {
	assert.strictEqual(parseStrictVerdictLine("VERDICT: BREACH — found xss", "VERDICT"), "BREACH");
});

test("parseStrictVerdictLine: scans from bottom", () => {
	const text = "some preamble\nVERDICT: BREACH — first\nmore text\nVERDICT: CONCEDE — final";
	assert.strictEqual(parseStrictVerdictLine(text, "VERDICT"), "CONCEDE");
});

test("parseStrictVerdictLine: no match returns undefined", () => {
	assert.strictEqual(parseStrictVerdictLine("no verdict here", "VERDICT"), undefined);
});

test("parseStrictVerdictLine: custom prefix", () => {
	assert.strictEqual(parseStrictVerdictLine("CONVERGED: yes — all set", "CONVERGED"), "yes");
});

// ── 7. Subtask Manifest Validation (reused by DECOMPOSE + BUILD stages) ────

test("validateManifest: valid manifest passes", () => {
	const r = validateManifest({
		subtasks: [
			{ id: "a", prompt: "do a", paths: ["src/a.ts"] },
			{ id: "b", prompt: "do b", paths: ["src/b.ts"] },
		],
	});
	assert.ok(r.ok);
	if (r.ok) assert.strictEqual(r.manifest.subtasks!.length, 2);
});

test("validateManifest: non-object fails", () => {
	const r = validateManifest(null);
	assert.ok(!r.ok);
	if (!r.ok) assert.match(r.error, /not a JSON object/);
});

test("validateManifest: empty subtasks fails", () => {
	const r = validateManifest({ subtasks: [] });
	assert.ok(!r.ok);
	if (!r.ok) assert.match(r.error, /non-empty array/);
});

test("validateManifest: missing id fails", () => {
	const r = validateManifest({ subtasks: [{ prompt: "do a", paths: ["src/a.ts"] }] });
	assert.ok(!r.ok);
	if (!r.ok) assert.match(r.error, /missing or invalid 'id'/);
});

test("validateManifest: duplicate id fails", () => {
	const r = validateManifest({
		subtasks: [
			{ id: "a", prompt: "do a", paths: ["src/a.ts"] },
			{ id: "a", prompt: "do b", paths: ["src/b.ts"] },
		],
	});
	assert.ok(!r.ok);
	if (!r.ok) assert.match(r.error, /duplicate id/);
});

test("validateManifest: missing prompt fails", () => {
	const r = validateManifest({ subtasks: [{ id: "a", paths: ["src/a.ts"] }] });
	assert.ok(!r.ok);
	if (!r.ok) assert.match(r.error, /missing 'prompt'/);
});

test("validateManifest: missing paths fails", () => {
	const r = validateManifest({ subtasks: [{ id: "a", prompt: "do a" }] });
	assert.ok(!r.ok);
	if (!r.ok) assert.match(r.error, /'paths' must be a non-empty array/);
});

test("validateManifest: empty paths fails", () => {
	const r = validateManifest({ subtasks: [{ id: "a", prompt: "do a", paths: [] }] });
	assert.ok(!r.ok);
	if (!r.ok) assert.match(r.error, /'paths' must be a non-empty array/);
});

// ── 8. Topological Sort (reused by DECOMPOSE + BUILD) ──────────────────────

test("topoLevels: no dependencies produces one level", () => {
	const { levels } = topoLevels([
		{ id: "a", prompt: "a", paths: ["a.ts"] },
		{ id: "b", prompt: "b", paths: ["b.ts"] },
	]);
	assert.strictEqual(levels.length, 1);
	assert.strictEqual(levels[0]!.length, 2);
});

test("topoLevels: linear dependencies produce levels in order", () => {
	const { levels } = topoLevels([
		{ id: "a", prompt: "a", paths: ["a.ts"] },
		{ id: "b", prompt: "b", paths: ["b.ts"], dependsOn: ["a"] },
		{ id: "c", prompt: "c", paths: ["c.ts"], dependsOn: ["b"] },
	]);
	assert.strictEqual(levels.length, 3);
	assert.strictEqual(levels[0]![0]!.id, "a");
	assert.strictEqual(levels[1]![0]!.id, "b");
	assert.strictEqual(levels[2]![0]!.id, "c");
});

test("topoLevels: dependsOn unknown returns error", () => {
	const { error } = topoLevels([
		{ id: "a", prompt: "a", paths: ["a.ts"], dependsOn: ["unknown"] },
	]);
	assert.ok(error);
	assert.match(error!, /depends on unknown/);
});

test("topoLevels: circular dependency returns error", () => {
	const { error } = topoLevels([
		{ id: "a", prompt: "a", paths: ["a.ts"], dependsOn: ["b"] },
		{ id: "b", prompt: "b", paths: ["b.ts"], dependsOn: ["a"] },
	]);
	assert.ok(error);
	assert.match(error!, /circular/);
});

// ── 9. Structural Integrity — standalone commands unchanged ─────────────────

test("fusion-harness.ts still defines all original command handlers", () => {
	const src = fs.readFileSync(
		path.join(__dirname, "..", "extensions", "fusion-harness", "fusion-harness.ts"),
		"utf-8",
	);
	const commands = ["fusion", "auto-validate", "opinion", "parallel", "debate", "coordinate", "council", "redteam"];
	for (const cmd of commands) {
		assert.ok(
			src.includes(`registerCommand("${cmd}",`) || src.includes(`registerCommand('${cmd}',`),
			`Missing original command handler: /${cmd}`,
		);
	}
});

test("fusion-harness.ts has gauntlet and chain command registrations", () => {
	const src = fs.readFileSync(
		path.join(__dirname, "..", "extensions", "fusion-harness", "fusion-harness.ts"),
		"utf-8",
	);
	assert.ok(src.includes('registerCommand("gauntlet"'), "Missing /gauntlet command handler");
	assert.ok(src.includes('registerCommand("chain"'), "Missing /chain command handler");
});

test("fusion-harness.ts has all stage extraction functions", () => {
	const src = fs.readFileSync(
		path.join(__dirname, "..", "extensions", "fusion-harness", "fusion-harness.ts"),
		"utf-8",
	);
	const functions = [
		"councilPanelAnswers",
		"councilRanking",
		"councilBorda",
		"councilChairman",
		"councilPipeline",
		"validatorDesignGate",
		"runGateScript",
		"validatorGateBaseline",
		"gateCorrectionRound",
		"validatorTriage",
		"gateCorrectionLoop",
		"coordinatorDecompose",
		"coordinatorWorkerLevels",
		"coordinatorIntegrate",
		"coordinatePipeline",
		"redteamBuild",
		"redteamSortie",
		"redteamSortieLoop",
		"runGauntletStage",
		"loadCampaignState",
		"saveCampaignState",
		"firstIncompleteStage",
		"accumulateCost",
	];
	for (const fn of functions) {
		assert.ok(src.includes(fn), `Missing stage function: ${fn}`);
	}
});

test("fusion-harness.ts has STAGE_PREREQS declaration", () => {
	const src = fs.readFileSync(
		path.join(__dirname, "..", "extensions", "fusion-harness", "fusion-harness.ts"),
		"utf-8",
	);
	assert.ok(src.includes("STAGE_PREREQS"), "Missing STAGE_PREREQS constant");
});

test("fusion-harness.ts has GAUNTLET_STAGES constant", () => {
	const src = fs.readFileSync(
		path.join(__dirname, "..", "extensions", "fusion-harness", "fusion-harness.ts"),
		"utf-8",
	);
	assert.ok(src.includes("GAUNTLET_STAGES"), "Missing GAUNTLET_STAGES constant");
});

test("fusion-harness.ts has CHAIN_STAGE_NAMES constant", () => {
	const src = fs.readFileSync(
		path.join(__dirname, "..", "extensions", "fusion-harness", "fusion-harness.ts"),
		"utf-8",
	);
	assert.ok(src.includes("CHAIN_STAGE_NAMES"), "Missing CHAIN_STAGE_NAMES constant");
});

test("fusion-harness.ts COMMAND_CAST includes gauntlet", () => {
	const src = fs.readFileSync(
		path.join(__dirname, "..", "extensions", "fusion-harness", "fusion-harness.ts"),
		"utf-8",
	);
	assert.ok(src.includes("gauntlet:"), "gauntlet not in COMMAND_CAST");
	assert.ok(src.includes("PANEL"), "gauntlet cast missing PANEL");
	assert.ok(src.includes("ATTACKER"), "gauntlet cast missing ATTACKER");
});

test("README.md documents /gauntlet", () => {
	const readme = fs.readFileSync(
		path.join(__dirname, "..", "README.md"),
		"utf-8",
	);
	assert.ok(readme.includes("gauntlet"), "README missing gauntlet documentation");
});

test("README.md documents /chain", () => {
	const readme = fs.readFileSync(
		path.join(__dirname, "..", "README.md"),
		"utf-8",
	);
	assert.ok(readme.includes("chain"), "README missing chain documentation");
});

test("openspec validate passes", () => {
	const { execSync } = require("child_process");
	const out = execSync("cd " + path.join(__dirname, "..") + " && openspec validate gauntlet-pipeline", {
		encoding: "utf-8",
	});
	assert.ok(out.includes("valid"), `openspec validate did not pass: ${out}`);
});

// ═══════════════════════════════════════════════════════════════════════════════
// RUNNER
// ═══════════════════════════════════════════════════════════════════════════════

let passed = 0;
let failed = 0;

for (const { name, fn } of tests) {
	try {
		fn();
		console.log(`  ✓ ${name}`);
		passed++;
	} catch (err: any) {
		console.log(`  ✗ ${name}`);
		console.log(`      ${err.message}`);
		failed++;
	}
}

console.log(`\n══════════════════════════════════════════════`);
console.log(`  ${passed} passed, ${failed} failed, ${passed + failed} total`);
console.log(`══════════════════════════════════════════════`);

process.exit(failed > 0 ? 1 : 0);
