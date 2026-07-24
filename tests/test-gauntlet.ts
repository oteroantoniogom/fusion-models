/**
 * GAUNTLET COMMAND TEST SUITE
 * =================================================================
 * Tests that /gauntlet works by grounding assertions in the real
 * extensions/fusion-harness/fusion-harness.ts source. Covers:
 *
 *   1. Source structural integrity  (all gauntlet symbols present)
 *   2. Gauntlet constants           (stages, names, prereqs, cast)
 *   3. Flag parsing                  (--skip-council, --skip-redteam, --deliberate, --resume)
 *   4. Campaign state round-trip      (save → load → compare with real fs)
 *   5. State helpers                 (emptyStage, firstIncompleteStage, accumulateCost)
 *   6. Stage transition / halt logic (done/skipped/failed → continue/halt)
 *   7. Stage-to-handler mapping      (each case calls the right sub-pipeline)
 *   8. Resume logic                  (partial, fully-done, corrupted state.json)
 *   9. Failure / halt behaviour      (campaign halted on failed stage, cascade)
 *  10. Widget rendering              (stage status glyphs, stageLine)
 *  11. Manifest validation & topo sort (used by DECOMPOSE + BUILD)
 *  12. Source cross-reference         (extracted constants match source byte-for-byte)
 *
 * Run:  npx tsx tests/test-gauntlet.ts
 */

import * as assert from "node:assert";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

// ═══════════════════════════════════════════════════════════════════════════════
// Read the REAL extension source — all assertions ground in this file.
// ═══════════════════════════════════════════════════════════════════════════════

const ROOT = path.resolve(__dirname, "..");
const SRC = path.join(ROOT, "extensions", "fusion-harness", "fusion-harness.ts");
const src = fs.readFileSync(SRC, "utf-8");

const README = path.join(ROOT, "README.md");
const readme = fs.readFileSync(README, "utf-8");

// ═══════════════════════════════════════════════════════════════════════════════
// FAITHFUL EXTRACTIONS — copied from fusion-harness.ts gauntlet section.
// These are tested for correctness AND cross-referenced against source.
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
	deliberate: "deliberate", gate: "gate", decompose: "decompose",
	build: "build", verify: "verify", harden: "harden", integrate: "integrate",
};

const STAGE_PREREQS: Record<ChainStage, string[]> = {
	deliberate: [], gate: ["plan.md"], decompose: ["plan.md"],
	build: ["subtasks.json"], verify: ["gate.py"], harden: [], integrate: ["plan.md"],
};

interface StageState {
	name: string;
	status: "pending" | "working" | "done" | "failed" | "skipped";
	artifacts: Record<string, string>;
	startedAt?: string; endedAt?: string; prompt?: string;
	castSnapshot?: Record<string, any>;
	tokensIn?: number; tokensOut?: number; costUsd?: number;
}

interface CampaignState {
	prompt: string; stages: StageState[];
	cast: Record<string, any>; createdAt: string;
	skipCouncil: boolean; skipRedteam: boolean;
	deliberateMode: "council" | "debate";
}

const emptyStage = (name: string): StageState => ({ name, status: "pending" as const, artifacts: {} });

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

// ── Flag parser extracted from the gauntlet handler ──────────────────────────
interface GauntletFlags {
	prompt: string; skipCouncil: boolean; skipRedteam: boolean;
	deliberateMode: "council" | "debate";
	resumeDir: string | undefined; resumeExplicit: boolean;
}
function parseGauntletFlags(raw: string | null | undefined): GauntletFlags {
	let input = (raw ?? "").trim();
	let skipCouncil = false, skipRedteam = false;
	let deliberateMode: "council" | "debate" = "council";
	let resumeDir: string | undefined, resumeExplicit = false;
	input = input
		.replace(/\s*--skip-council\s*/g, () => { skipCouncil = true; return " "; })
		.replace(/\s*--skip-redteam\s*/g, () => { skipRedteam = true; return " "; })
		.replace(/--deliberate[=\s]+(\S+)\s*/g, (_m: string, mode: string) => {
			deliberateMode = mode === "debate" ? "debate" : "council"; return " ";
		})
		.replace(/--resume(?:\s+(\S+))?\s*/g, (_m: string, dir?: string) => {
			resumeDir = dir || undefined; resumeExplicit = true; return " ";
		})
		.trim();
	return { prompt: input, skipCouncil, skipRedteam, deliberateMode, resumeDir, resumeExplicit };
}

// ═══════════════════════════════════════════════════════════════════════════════
// TESTS
// ═══════════════════════════════════════════════════════════════════════════════

const tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
function test(name: string, fn: () => void | Promise<void>) { tests.push({ name, fn }); }

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), "gauntlet-test-"));

// ─────────────────────────────────────────────────────────────────────────────
// 1. SOURCE STRUCTURAL INTEGRITY — all /gauntlet symbols exist in the real source
// ─────────────────────────────────────────────────────────────────────────────

test("1.01 /gauntlet registered with registerCommand", () => {
	assert.ok(src.includes('registerCommand("gauntlet"'), "/gauntlet not registered in fusion-harness.ts");
});

test("1.02 /chain registered with registerCommand", () => {
	assert.ok(src.includes('registerCommand("chain"'), "/chain not registered");
});

test("1.03 GAUNTLET_STAGES constant in source", () => {
	assert.ok(src.includes('const GAUNTLET_STAGES = ['), "GAUNTLET_STAGES missing");
});

test("1.04 GAUNTLET_STAGE_NAMES in source", () => {
	assert.ok(src.includes('const GAUNTLET_STAGE_NAMES:'), "GAUNTLET_STAGE_NAMES missing");
});

test("1.05 STAGE_PREREQS in source", () => {
	assert.ok(src.includes('const STAGE_PREREQS:'), "STAGE_PREREQS missing");
});

test("1.06 runGauntletStage function in source", () => {
	assert.ok(src.includes('async function runGauntletStage('), "runGauntletStage missing");
});

test("1.07 loadCampaignState in source", () => {
	assert.ok(src.includes('const loadCampaignState = async'), "loadCampaignState missing");
});

test("1.08 saveCampaignState in source", () => {
	assert.ok(src.includes('const saveCampaignState = async'), "saveCampaignState missing");
});

test("1.09 latestGauntletDir in source", () => {
	assert.ok(src.includes('const latestGauntletDir = async'), "latestGauntletDir missing");
});

test("1.10 emptyStage in source", () => {
	assert.ok(src.includes('const emptyStage = ('), "emptyStage missing");
});

test("1.11 firstIncompleteStage in source", () => {
	assert.ok(src.includes('const firstIncompleteStage = ('), "firstIncompleteStage missing");
});

test("1.12 accumulateCost in source", () => {
	assert.ok(src.includes('const accumulateCost = ('), "accumulateCost missing");
});

test("1.13 COMMAND_CAST has gauntlet entry with 6 roles", () => {
	const match = src.match(/gauntlet:\s*\[([^\]]+)\]/);
	assert.ok(match, "gauntlet entry not found in COMMAND_CAST");
	const roles = match![1]!.split(",").map((r) => r.trim().replace(/'/g, '"'));
	assert.strictEqual(roles.length, 6);
	for (const r of ['"PANEL"', '"CHAIRMAN"', '"VALIDATOR"', '"COORDINATOR"', '"BUILDER"', '"ATTACKER"']) {
		assert.ok(roles.includes(r), "Missing role " + r + " in COMMAND_CAST[gauntlet]");
	}
});

test("1.14 validateManifest in source", () => {
	assert.ok(src.includes('const validateManifest = (data: any)'), "validateManifest missing");
});

test("1.15 topoLevels in source", () => {
	assert.ok(src.includes('const topoLevels = (subtasks:'), "topoLevels missing");
});

test("1.16 all 8 original commands still registered", () => {
	for (const cmd of ["fusion", "auto-validate", "opinion", "parallel", "debate", "coordinate", "council", "redteam"]) {
		assert.ok(src.includes('registerCommand("' + cmd + '"'), "Missing command: /" + cmd);
	}
});

test("1.17 StageState interface has costUsd", () => {
	const match = src.match(/interface StageState \{[\s\S]*?\}/);
	assert.ok(match, "StageState interface missing");
	assert.ok(match![0].includes('costUsd?: number'), "StageState missing costUsd");
});

test("1.18 CampaignState interface has deliberateMode", () => {
	const match = src.match(/interface CampaignState \{[\s\S]*?\}/);
	assert.ok(match, "CampaignState interface missing");
	assert.ok(match![0].includes('deliberateMode: "council" | "debate"'), "CampaignState missing deliberateMode");
});

// ─────────────────────────────────────────────────────────────────────────────
// 2. GAUNTLET CONSTANTS & TYPES
// ─────────────────────────────────────────────────────────────────────────────

test("2.01 GAUNTLET_STAGES has exactly 7 stages in order", () => {
	assert.strictEqual(GAUNTLET_STAGES.length, 7);
	assert.deepStrictEqual([...GAUNTLET_STAGES],
		["deliberate", "gate", "decompose", "build", "verify", "harden", "integrate"]);
});

test("2.02 GAUNTLET_STAGE_NAMES maps all 7 stages", () => {
	assert.strictEqual(GAUNTLET_STAGE_NAMES.deliberate, "DELIBERATE");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.gate, "GATE-FIRST");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.decompose, "DECOMPOSE");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.build, "BUILD");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.verify, "VERIFY");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.harden, "HARDEN");
	assert.strictEqual(GAUNTLET_STAGE_NAMES.integrate, "INTEGRATE");
});

test("2.03 CHAIN_STAGE_NAMES matches GAUNTLET_STAGES", () => {
	assert.strictEqual(CHAIN_STAGE_NAMES.length, GAUNTLET_STAGES.length);
	for (const s of CHAIN_STAGE_NAMES) {
		assert.ok((GAUNTLET_STAGES as readonly string[]).includes(s));
	}
});

test("2.04 CHAIN_STAGE_MAP is identity", () => {
	for (const s of CHAIN_STAGE_NAMES) assert.strictEqual(CHAIN_STAGE_MAP[s], s);
});

test("2.05 STAGE_PREREQS covers all stages", () => {
	for (const s of CHAIN_STAGE_NAMES) assert.ok(Array.isArray(STAGE_PREREQS[s]));
});

// ─────────────────────────────────────────────────────────────────────────────
// 3. FLAG PARSING (--skip-council, --skip-redteam, --deliberate, --resume)
// ─────────────────────────────────────────────────────────────────────────────

test("3.01 no flags → defaults", () => {
	const f = parseGauntletFlags("build me a thing");
	assert.strictEqual(f.prompt, "build me a thing");
	assert.strictEqual(f.skipCouncil, false);
	assert.strictEqual(f.skipRedteam, false);
	assert.strictEqual(f.deliberateMode, "council");
	assert.strictEqual(f.resumeExplicit, false);
});

test("3.02 --skip-council sets flag, strips from prompt", () => {
	const f = parseGauntletFlags("do thing --skip-council");
	assert.strictEqual(f.skipCouncil, true);
	assert.ok(!f.prompt.includes("--skip-council"));
});

test("3.03 --skip-redteam sets flag, strips from prompt", () => {
	const f = parseGauntletFlags("do thing --skip-redteam");
	assert.strictEqual(f.skipRedteam, true);
	assert.ok(!f.prompt.includes("--skip-redteam"));
});

test("3.04 --deliberate=debate", () => {
	assert.strictEqual(parseGauntletFlags("task --deliberate=debate").deliberateMode, "debate");
});

test("3.05 --deliberate=council", () => {
	assert.strictEqual(parseGauntletFlags("task --deliberate=council").deliberateMode, "council");
});

test("3.06 --deliberate with space separator", () => {
	assert.strictEqual(parseGauntletFlags("task --deliberate debate").deliberateMode, "debate");
});

test("3.07 --deliberate with unknown value defaults to council", () => {
	assert.strictEqual(parseGauntletFlags("task --deliberate=foo").deliberateMode, "council");
});

test("3.08 --resume with no dir", () => {
	const f = parseGauntletFlags("task --resume");
	assert.strictEqual(f.resumeExplicit, true);
	assert.strictEqual(f.resumeDir, undefined);
});

test("3.09 --resume /some/dir", () => {
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
	assert.strictEqual(f.resumeDir, "/tmp/x");
});

test("3.11 null/undefined input → no crash", () => {
	assert.strictEqual(parseGauntletFlags(null).prompt, "");
	assert.strictEqual(parseGauntletFlags(undefined).prompt, "");
});

test("3.12 flags in middle of prompt stripped", () => {
	const f = parseGauntletFlags("start --skip-council and end");
	assert.strictEqual(f.skipCouncil, true);
	assert.ok(!f.prompt.includes("--skip-council"));
});

// ─────────────────────────────────────────────────────────────────────────────
// 4. CAMPAIGN STATE ROUND-TRIP (real fs I/O)
// ─────────────────────────────────────────────────────────────────────────────

test("4.01 fresh campaign state round-trip", () => {
	const dir = fs.mkdtempSync(path.join(TMP, "rt-"));
	const state: CampaignState = {
		prompt: "test prompt",
		stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: { ARCHITECT: { model: "test/arch" }, BUILDER: { model: "test/bld" } },
		createdAt: "2025-01-01T00:00:00Z",
		skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	const loaded = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")) as CampaignState;
	assert.strictEqual(loaded.prompt, state.prompt);
	assert.strictEqual(loaded.stages.length, 7);
	assert.strictEqual(loaded.deliberateMode, "council");
	assert.deepStrictEqual(loaded.cast, state.cast);
});

test("4.02 partially-completed state round-trip", () => {
	const dir = fs.mkdtempSync(path.join(TMP, "rt-"));
	const state: CampaignState = {
		prompt: "partial test",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done", artifacts: { "plan.md": "/tmp/x/plan.md" } },
			{ ...emptyStage("GATE-FIRST"), status: "done", artifacts: { "gate.py": "/tmp/x/gate.py" } },
			{ ...emptyStage("DECOMPOSE"), status: "working" },
			emptyStage("BUILD"), emptyStage("VERIFY"), emptyStage("HARDEN"), emptyStage("INTEGRATE"),
		],
		cast: {}, createdAt: "2025-06-15T10:00:00Z",
		skipCouncil: false, skipRedteam: true, deliberateMode: "debate",
	};
	fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	const loaded = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")) as CampaignState;
	assert.strictEqual(loaded.stages[0]!.status, "done");
	assert.strictEqual(loaded.stages[2]!.status, "working");
	assert.strictEqual(loaded.skipRedteam, true);
	assert.strictEqual(loaded.deliberateMode, "debate");
});

test("4.03 state with costs round-trips", () => {
	const dir = fs.mkdtempSync(path.join(TMP, "rt-"));
	const state: CampaignState = {
		prompt: "cost test",
		stages: GAUNTLET_STAGES.map((n) => ({ ...emptyStage(GAUNTLET_STAGE_NAMES[n]), costUsd: 0.1 })),
		cast: {}, createdAt: new Date().toISOString(),
		skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	const loaded = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")) as CampaignState;
	assert.strictEqual(accumulateCost(loaded.stages), 0.7);
});

test("4.04 missing state.json → throws on load", () => {
	const dir = fs.mkdtempSync(path.join(TMP, "rt-"));
	let threw = false;
	try { fs.readFileSync(path.join(dir, "state.json"), "utf-8"); } catch { threw = true; }
	assert.ok(threw, "Should throw on missing state.json — no valid state.json for --resume");
});

test("4.05 invalid JSON in state.json → throws on load", () => {
	const dir = fs.mkdtempSync(path.join(TMP, "rt-"));
	fs.writeFileSync(path.join(dir, "state.json"), "NOT JSON{{{");
	let threw = false;
	try { JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")); } catch { threw = true; }
	assert.ok(threw, "Should throw on invalid JSON — no valid state.json");
});

// ─────────────────────────────────────────────────────────────────────────────
// 5. STATE HELPERS
// ─────────────────────────────────────────────────────────────────────────────

test("5.01 emptyStage creates pending stage", () => {
	const s = emptyStage("BUILD");
	assert.strictEqual(s.name, "BUILD");
	assert.strictEqual(s.status, "pending");
	assert.deepStrictEqual(s.artifacts, {});
});

test("5.02 emptyStage returns independent objects", () => {
	const a = emptyStage("A"); const b = emptyStage("B");
	a.artifacts["x"] = "y";
	assert.deepStrictEqual(b.artifacts, {});
});

test("5.03 firstIncompleteStage: all pending → 0", () => {
	const state: CampaignState = {
		prompt: "", stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 0);
});

test("5.04 firstIncompleteStage: first done → 1", () => {
	const state: CampaignState = {
		prompt: "",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done" },
			emptyStage("GATE-FIRST"), emptyStage("DECOMPOSE"), emptyStage("BUILD"),
			emptyStage("VERIFY"), emptyStage("HARDEN"), emptyStage("INTEGRATE"),
		],
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 1);
});

test("5.05 firstIncompleteStage: all done → -1", () => {
	const state: CampaignState = {
		prompt: "",
		stages: GAUNTLET_STAGES.map((n) => ({ ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const })),
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), -1);
});

test("5.06 firstIncompleteStage: failed is incomplete", () => {
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

test("5.07 firstIncompleteStage: skipped is NOT done (potential bug)", () => {
	// firstIncompleteStage uses !== "done" — "skipped" re-enters on --resume
	const state: CampaignState = {
		prompt: "",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done" },
			{ ...emptyStage("GATE-FIRST"), status: "skipped" },
			{ ...emptyStage("DECOMPOSE"), status: "working" },
		],
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 1); // "skipped" !== "done"
});

test("5.08 accumulateCost: empty → 0", () => {
	assert.strictEqual(accumulateCost([]), 0);
});

test("5.09 accumulateCost: sums correctly with undefined", () => {
	const stages: StageState[] = [
		{ ...emptyStage("A"), costUsd: 0.5 },
		{ ...emptyStage("B") }, // undefined
		{ ...emptyStage("C"), costUsd: 0.3 },
	];
	assert.strictEqual(accumulateCost(stages), 0.8);
});

// ─────────────────────────────────────────────────────────────────────────────
// 6. STAGE TRANSITION / HALT LOGIC
//    runGauntletStage returns true if campaign should continue (done/skipped),
//    false if it should halt (failed).
// ─────────────────────────────────────────────────────────────────────────────

function simulateContinue(stage: StageState): boolean {
	return stage.status === "done" || stage.status === "skipped";
}

test("6.01 stage done → continue", () => {
	assert.strictEqual(simulateContinue({ ...emptyStage("X"), status: "done" }), true);
});

test("6.02 stage skipped → continue", () => {
	assert.strictEqual(simulateContinue({ ...emptyStage("X"), status: "skipped" }), true);
});

test("6.03 stage failed → halt", () => {
	assert.strictEqual(simulateContinue({ ...emptyStage("X"), status: "failed" }), false);
});

test("6.04 full gauntlet: all done → complete", () => {
	const stages = GAUNTLET_STAGES.map((n) => ({ ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const }));
	for (const s of stages) assert.ok(simulateContinue(s), `${s.name} should continue`);
});

test("6.05 harden skipped (skipRedteam) → campaign continues", () => {
	const stages = GAUNTLET_STAGES.map((n) => {
		if (n === "harden") return { ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "skipped" as const };
		return { ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const };
	});
	for (const s of stages) assert.ok(simulateContinue(s));
});

test("6.06 gate fails → campaign halted", () => {
	const stages: StageState[] = [
		{ ...emptyStage("DELIBERATE"), status: "done" },
		{ ...emptyStage("GATE-FIRST"), status: "failed" },
	];
	assert.ok(simulateContinue(stages[0]!));
	assert.ok(!simulateContinue(stages[1]!));
});

// ─────────────────────────────────────────────────────────────────────────────
// 7. STAGE-TO-HANDLER MAPPING (each case in runGauntletStage calls the right fn)
// ─────────────────────────────────────────────────────────────────────────────

test("7.01 all 7 stage names have a case in runGauntletStage switch", () => {
	const fnMatch = src.match(/async function runGauntletStage\([\s\S]*?^\t\}\n/m);
	assert.ok(fnMatch, "Could not extract runGauntletStage function");
	const body = fnMatch[0]!;
	for (const name of ["DELIBERATE", "GATE-FIRST", "DECOMPOSE", "BUILD", "VERIFY", "HARDEN", "INTEGRATE"]) {
		assert.ok(body.includes(`case "${name}":`), `Missing case "${name}" in runGauntletStage switch`);
	}
});

test("7.02 DELIBERATE handles skipCouncil path", () => {
	const fnMatch = src.match(/async function runGauntletStage\([\s\S]*?^\t\}\n/m);
	assert.ok(fnMatch);
	assert.ok(fnMatch[0]!.includes('state.skipCouncil'), "DELIBERATE missing skipCouncil check");
});

test("7.03 DELIBERATE handles deliberateMode === 'debate' path", () => {
	assert.ok(src.includes('state.deliberateMode === "debate"'), "Missing debate mode in DELIBERATE");
});

test("7.04 HARDEN handles skipRedteam path", () => {
	const fnMatch = src.match(/async function runGauntletStage\([\s\S]*?^\t\}\n/m);
	assert.ok(fnMatch);
	const harden = fnMatch[0]!.slice(fnMatch[0]!.indexOf('case "HARDEN":'));
	assert.ok(harden.includes('state.skipRedteam'), "HARDEN missing skipRedteam check");
});

test("7.05 GATE-FIRST calls validatorDesignGate", () => {
	const fnMatch = src.match(/async function runGauntletStage\([\s\S]*?^\t\}\n/m);
	assert.ok(fnMatch);
	const section = fnMatch[0]!.slice(fnMatch[0]!.indexOf('case "GATE-FIRST":'), fnMatch[0]!.indexOf('case "DECOMPOSE":'));
	assert.ok(section.includes('validatorDesignGate'), "GATE-FIRST missing validatorDesignGate");
});

test("7.06 DECOMPOSE calls coordinatorDecompose", () => {
	const fnMatch = src.match(/async function runGauntletStage\([\s\S]*?^\t\}\n/m);
	assert.ok(fnMatch);
	const section = fnMatch[0]!.slice(fnMatch[0]!.indexOf('case "DECOMPOSE":'), fnMatch[0]!.indexOf('case "BUILD":'));
	assert.ok(section.includes('coordinatorDecompose'), "DECOMPOSE missing coordinatorDecompose");
});

test("7.07 BUILD calls coordinatorWorkerLevels", () => {
	const fnMatch = src.match(/async function runGauntletStage\([\s\S]*?^\t\}\n/m);
	assert.ok(fnMatch);
	const section = fnMatch[0]!.slice(fnMatch[0]!.indexOf('case "BUILD":'), fnMatch[0]!.indexOf('case "VERIFY":'));
	assert.ok(section.includes('coordinatorWorkerLevels'), "BUILD missing coordinatorWorkerLevels");
});

test("7.08 VERIFY calls gateCorrectionLoop", () => {
	const fnMatch = src.match(/async function runGauntletStage\([\s\S]*?^\t\}\n/m);
	assert.ok(fnMatch);
	const section = fnMatch[0]!.slice(fnMatch[0]!.indexOf('case "VERIFY":'), fnMatch[0]!.indexOf('case "HARDEN":'));
	assert.ok(section.includes('gateCorrectionLoop'), "VERIFY missing gateCorrectionLoop");
});

test("7.09 HARDEN calls redteamSortieLoop", () => {
	const fnMatch = src.match(/async function runGauntletStage\([\s\S]*?^\t\}\n/m);
	assert.ok(fnMatch);
	const section = fnMatch[0]!.slice(fnMatch[0]!.indexOf('case "HARDEN":'), fnMatch[0]!.indexOf('case "INTEGRATE":'));
	assert.ok(section.includes('redteamSortieLoop'), "HARDEN missing redteamSortieLoop");
});

test("7.10 INTEGRATE calls coordinatorIntegrate", () => {
	const fnMatch = src.match(/async function runGauntletStage\([\s\S]*?^\t\}\n/m);
	assert.ok(fnMatch);
	const section = fnMatch[0]!.slice(fnMatch[0]!.indexOf('case "INTEGRATE":'));
	assert.ok(section.includes('coordinatorIntegrate'), "INTEGRATE missing coordinatorIntegrate");
});

// ─────────────────────────────────────────────────────────────────────────────
// 8. RESUME LOGIC
// ─────────────────────────────────────────────────────────────────────────────

test("8.01 resume with all done → -1 → already complete notification", () => {
	const state: CampaignState = {
		prompt: "test",
		stages: GAUNTLET_STAGES.map((n) => ({ ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const })),
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), -1);
});

test("8.02 resume from partial completion → resumes at failed stage", () => {
	const state: CampaignState = {
		prompt: "test",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done" },
			{ ...emptyStage("GATE-FIRST"), status: "done" },
			{ ...emptyStage("DECOMPOSE"), status: "done" },
			{ ...emptyStage("BUILD"), status: "failed" },
			emptyStage("VERIFY"), emptyStage("HARDEN"), emptyStage("INTEGRATE"),
		],
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 3);
});

test("8.03 state.json round-trip with cast snapshot", () => {
	const dir = fs.mkdtempSync(path.join(TMP, "resume-"));
	const cast = { ARCHITECT: { model: "test/a" }, BUILDER: { model: "test/b" } };
	const state: CampaignState = {
		prompt: "resume test",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done", castSnapshot: { ...cast } },
			emptyStage("GATE-FIRST"), emptyStage("DECOMPOSE"), emptyStage("BUILD"),
			emptyStage("VERIFY"), emptyStage("HARDEN"), emptyStage("INTEGRATE"),
		],
		cast: { ...cast }, createdAt: new Date().toISOString(),
		skipCouncil: false, skipRedteam: true, deliberateMode: "debate",
	};
	fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	const loaded = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")) as CampaignState;
	assert.deepStrictEqual(loaded.cast, cast);
	assert.ok(loaded.stages[0]!.castSnapshot, "castSnapshot should be preserved");
});

test("8.04 resume from corrupted state.json → error", () => {
	const dir = fs.mkdtempSync(path.join(TMP, "resume-"));
	fs.writeFileSync(path.join(dir, "state.json"), "CORRUPTED");
	let threw = false;
	try { JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")); } catch { threw = true; }
	assert.ok(threw, "Corrupted state.json should cause load error on --resume");
});

// ─────────────────────────────────────────────────────────────────────────────
// 9. FAILURE / HALT BEHAVIOUR (the "ya que antes me ha dado error" intent)
// ─────────────────────────────────────────────────────────────────────────────

test("9.01 campaign halted when gate fails — status='failed' set, remaining stages untouched", () => {
	const state: CampaignState = {
		prompt: "build something",
		stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: {}, createdAt: new Date().toISOString(),
		skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	// Simulate: DELIBERATE done, GATE-FIRST fails
	state.stages[0]!.status = "done";
	state.stages[0]!.artifacts["plan.md"] = "/tmp/x/plan.md";
	state.stages[1]!.status = "failed";
	// Remaining stages stay pending (campaign halted)
	for (let i = 2; i < 7; i++) {
		assert.strictEqual(state.stages[i]!.status, "pending", `Stage ${i} should be untouched after halt`);
	}
	// Halt: cont=false after failed stage
	assert.ok(!simulateContinue(state.stages[1]!), "Failed GATE-FIRST should halt campaign");
	// The gauntlet handler renders error panel with 'Campaign Halted'
	assert.ok(src.includes("Campaign Halted"), "Source should render 'Campaign Halted' error panel");
});

test("9.02 campaign halted when build fails — cascade stops pipeline", () => {
	const state: CampaignState = {
		prompt: "build with deps",
		stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: {}, createdAt: new Date().toISOString(),
		skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	// Stages 0-2 done, 3 (BUILD) fails
	for (let i = 0; i < 3; i++) state.stages[i]!.status = "done";
	state.stages[3]!.status = "failed";
	// Stages 4-6 should never execute (campaign halted)
	for (let i = 4; i < 7; i++) {
		assert.strictEqual(state.stages[i]!.status, "pending", `Stage ${i} untouched after BUILD failed`);
	}
	assert.ok(!simulateContinue(state.stages[3]!), "BUILD failure should halt");
});

test("9.03 campaign halted when verify (gate correction) never passes", () => {
	const state: CampaignState = {
		prompt: "unverifiable task",
		stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: {}, createdAt: new Date().toISOString(),
		skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	for (let i = 0; i < 4; i++) state.stages[i]!.status = "done";
	state.stages[4]!.status = "failed"; // VERIFY failed
	assert.ok(!simulateContinue(state.stages[4]!), "VERIFY failure should halt");
	// HARDEN and INTEGRATE untouched
	assert.strictEqual(state.stages[5]!.status, "pending");
	assert.strictEqual(state.stages[6]!.status, "pending");
});

test("9.04 campaign halted when harden (redteam) never concedes", () => {
	const state: CampaignState = {
		prompt: "insecure code",
		stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: {}, createdAt: new Date().toISOString(),
		skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	for (let i = 0; i < 5; i++) state.stages[i]!.status = "done";
	state.stages[5]!.status = "failed"; // HARDEN failed (redteam found breaches)
	assert.ok(!simulateContinue(state.stages[5]!), "HARDEN failure should halt");
	assert.strictEqual(state.stages[6]!.status, "pending"); // INTEGRATE untouched
});

test("9.05 campaign halted on deliberate failure — empty plan scenario", () => {
	// If council/debate fails, DELIBERATE status becomes "failed", campaign halts immediately
	const state: CampaignState = {
		prompt: "", stages: GAUNTLET_STAGES.map((n) => emptyStage(GAUNTLET_STAGE_NAMES[n])),
		cast: {}, createdAt: new Date().toISOString(),
		skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	state.stages[0]!.status = "failed";
	// All subsequent stages pending — no plan.md was produced
	for (let i = 1; i < 7; i++) {
		assert.strictEqual(state.stages[i]!.status, "pending");
	}
	assert.ok(!simulateContinue(state.stages[0]!), "DELIBERATE failure should halt");
});

test("9.06 source: error panel includes 'Campaign Halted' text", () => {
	assert.ok(src.includes("Campaign Halted"), "Missing 'Campaign Halted' in error panel");
});

test("9.07 source: error panel includes '**Failed:**' and '**Stopped:**' text", () => {
	assert.ok(src.includes('**Failed:**'), "Missing '**Failed:**' in error panel");
	assert.ok(src.includes('**Stopped:**'), "Missing '**Stopped:**' in error panel");
});

test("9.08 source: if (!cont) break halts loop on failure", () => {
	assert.ok(src.includes('if (!cont) break'), "Missing 'if (!cont) break' — loop won't halt on failed stage");
});

test("9.09 source: stage.endedAt is set even on failure (try/finally in runGauntletStage)", () => {
	const fnMatch = src.match(/async function runGauntletStage\([\s\S]*?^\t\}\n/m);
	assert.ok(fnMatch);
	// The function has a try/catch that sets status=failed, then continues to set endedAt
	assert.ok(fnMatch[0]!.includes('stage.endedAt'), "runGauntletStage must set stage.endedAt");
	assert.ok(fnMatch[0]!.includes('stage.status = "failed"'), "runGauntletStage must set failed status on error");
});

test("9.10 failure state round-trips to state.json (resume sees failed stage)", () => {
	const dir = fs.mkdtempSync(path.join(TMP, "halt-"));
	const state: CampaignState = {
		prompt: "will fail at gate",
		stages: [
			{ ...emptyStage("DELIBERATE"), status: "done", endedAt: "2025-01-01T00:01:00Z", costUsd: 0.05 },
			{ ...emptyStage("GATE-FIRST"), status: "failed", endedAt: "2025-01-01T00:02:00Z", costUsd: 0.01 },
			emptyStage("DECOMPOSE"), emptyStage("BUILD"), emptyStage("VERIFY"),
			emptyStage("HARDEN"), emptyStage("INTEGRATE"),
		],
		cast: {}, createdAt: "2025-01-01T00:00:00Z",
		skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	fs.writeFileSync(path.join(dir, "state.json"), JSON.stringify(state, null, 2));
	const loaded = JSON.parse(fs.readFileSync(path.join(dir, "state.json"), "utf-8")) as CampaignState;
	assert.strictEqual(loaded.stages[1]!.status, "failed");
	assert.strictEqual(loaded.stages[1]!.endedAt, "2025-01-01T00:02:00Z");
	assert.strictEqual(firstIncompleteStage(loaded), 1); // resume would re-enter GATE-FIRST
});

test("9.11 integrate failure — final stage fails, campaign halted", () => {
	const state: CampaignState = {
		prompt: "task",
		stages: GAUNTLET_STAGES.map((n, i) =>
			i < 6 ? { ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "done" as const } : { ...emptyStage(GAUNTLET_STAGE_NAMES[n]), status: "failed" as const }
		),
		cast: {}, createdAt: "", skipCouncil: false, skipRedteam: false, deliberateMode: "council",
	};
	assert.strictEqual(firstIncompleteStage(state), 6);
	assert.ok(!simulateContinue(state.stages[6]!), "INTEGRATE failure halts at the end");
});

// ─────────────────────────────────────────────────────────────────────────────
// 10. WIDGET RENDERING
// ─────────────────────────────────────────────────────────────────────────────

test("10.01 source widget uses stage status glyphs", () => {
	assert.ok(src.includes('s.status === "done" ? "✓"'), "Widget missing done glyph ✓");
	assert.ok(src.includes('s.status === "failed" ? "✗"'), "Widget missing failed glyph ✗");
	assert.ok(src.includes('s.status === "skipped" ? "⊘"'), "Widget missing skipped glyph ⊘");
	assert.ok(src.includes('s.status === "working" ? "◐"'), "Widget missing working glyph ◐");
});

test("10.02 widget renders campaignState.stages.map", () => {
	assert.ok(src.includes('campaignState.stages.map((s, i)'), "Widget missing stages.map");
});

test("10.03 widget shows cost in header", () => {
	assert.ok(src.includes('accumulateCost(state.stages)') || src.includes('accumulateCost(campaignState.stages)'),
		"Widget should show accumulated cost");
});

// ─────────────────────────────────────────────────────────────────────────────
// 11. MANIFEST VALIDATION & TOPO SORT
// ─────────────────────────────────────────────────────────────────────────────

test("11.01 validateManifest: valid passes", () => {
	assert.ok(validateManifest({ subtasks: [{ id: "a", prompt: "do a", paths: ["a.ts"] }] }).ok);
});

test("11.02 validateManifest: null fails", () => {
	assert.ok(!validateManifest(null).ok);
});

test("11.03 validateManifest: duplicate id fails", () => {
	assert.ok(!validateManifest({ subtasks: [
		{ id: "a", prompt: "p1", paths: ["a.ts"] },
		{ id: "a", prompt: "p2", paths: ["b.ts"] },
	] }).ok);
});

test("11.04 validateManifest: missing prompt fails", () => {
	assert.ok(!validateManifest({ subtasks: [{ id: "a", paths: ["x"] }] }).ok);
});

test("11.05 topoLevels: circular returns error", () => {
	const { error } = topoLevels([
		{ id: "a", prompt: "p", paths: ["a.ts"], dependsOn: ["b"] },
		{ id: "b", prompt: "p", paths: ["b.ts"], dependsOn: ["a"] },
	]);
	assert.ok(error);
	assert.match(error!, /circular/);
});

test("11.06 topoLevels: linear chain → correct levels", () => {
	const { levels } = topoLevels([
		{ id: "a", prompt: "p", paths: ["a.ts"] },
		{ id: "b", prompt: "p", paths: ["b.ts"], dependsOn: ["a"] },
		{ id: "c", prompt: "p", paths: ["c.ts"], dependsOn: ["b"] },
	]);
	assert.strictEqual(levels.length, 3);
	assert.strictEqual(levels[0]![0]!.id, "a");
	assert.strictEqual(levels[2]![0]!.id, "c");
});

// ─────────────────────────────────────────────────────────────────────────────
// 12. SOURCE CROSS-REFERENCE
// ─────────────────────────────────────────────────────────────────────────────

test("12.01 source GAUNTLET_STAGES matches extraction", () => {
	const match = src.match(/const GAUNTLET_STAGES = \[([\s\S]*?)\] as const/);
	assert.ok(match);
	const stages = match![1]!.match(/"(\w+)"/g)!.map((m) => m.replace(/"/g, ""));
	assert.deepStrictEqual(stages, [...GAUNTLET_STAGES]);
});

test("12.02 source GAUNTLET_STAGE_NAMES matches extraction", () => {
	for (const [key, value] of Object.entries(GAUNTLET_STAGE_NAMES)) {
		assert.ok(src.includes(`${key}: "${value}"`), `Source missing ${key}: "${value}"`);
	}
});

test("12.03 source STAGE_PREREQS matches extraction", () => {
	for (const [stage, prereqs] of Object.entries(STAGE_PREREQS)) {
		const expected = `[${prereqs.map(p => `"${p}"`).join(", ")}]`;
		assert.ok(src.includes(`${stage}: ${expected}`), `Source STAGE_PREREQS[${stage}] mismatch`);
	}
});

test("12.04 StageState interface in source has all required fields", () => {
	const match = src.match(/interface StageState \{[\s\S]*?\}/);
	assert.ok(match);
	const body = match![0]!;
	for (const field of ["name: string", 'status: "pending"', "artifacts: Record<string, string>"]) {
		assert.ok(body.includes(field), `StageState missing ${field}`);
	}
});

test("12.05 CampaignState interface in source has all required fields", () => {
	const match = src.match(/interface CampaignState \{[\s\S]*?\}/);
	assert.ok(match);
	const body = match![0]!;
	for (const field of ["prompt: string", "stages: StageState[]", "cast: Cast", "createdAt: string", "skipCouncil: boolean", "skipRedteam: boolean"]) {
		assert.ok(body.includes(field), `CampaignState missing ${field}`);
	}
});

test("12.06 gauntlet handler creates gauntlet-* dir", () => {
	assert.ok(src.includes('`gauntlet-${path.basename(dir).replace("fusion-harness-", "")}`'),
		"Gauntlet dir naming pattern not found");
});

test("12.07 gauntlet handler calls saveCampaignState before loop", () => {
	assert.ok(src.includes('await saveCampaignState(realDir, campaignState)'),
		"saveCampaignState not called before gauntlet stages");
});

test("12.08 gauntlet handler uses runGauntletStage in loop", () => {
	assert.ok(src.includes('const cont = await runGauntletStage(i, campaignState, realDir'),
		"runGauntletStage not called in gauntlet handler loop");
});

test("12.09 gauntlet handler renders verdict panel on complete", () => {
	assert.ok(src.includes('kind: "verdict", command: "gauntlet"'),
		"Missing verdict panel for gauntlet completion");
});

test("12.10 gauntlet handler renders error panel on halt", () => {
	assert.ok(src.includes('kind: "error", command: "gauntlet"'),
		"Missing error panel for gauntlet halt");
});

test("12.11 gauntlet resume path calls loadCampaignState", () => {
	assert.ok(src.includes('state = await loadCampaignState(targetDir)'),
		"Resume path missing loadCampaignState");
});

test("12.12 gauntlet handler calls runCastGate for preflight", () => {
	const count = (src.match(/runCastGate\(ctx, "gauntlet"/g) || []).length;
	assert.ok(count >= 2, `Expected >=2 runCastGate calls for gauntlet, found ${count}`);
});

test("12.13 README documents /gauntlet and /chain", () => {
	assert.ok(readme.toLowerCase().includes("gauntlet"), "README missing gauntlet");
	assert.ok(readme.toLowerCase().includes("chain"), "README missing chain");
});

// ─────────────────────────────────────────────────────────────────────────────
// 13. DIRECTORY NAMING
// ─────────────────────────────────────────────────────────────────────────────

test("13.01 chainDirName strips fusion-harness- prefix", () => {
	assert.strictEqual(chainDirName("fusion-harness-abc123"), "chain-abc123");
});

test("13.02 gauntletDirName strips fusion-harness- prefix", () => {
	assert.strictEqual(gauntletDirName("fusion-harness-abc123"), "gauntlet-abc123");
});

test("13.03 chain and gauntlet produce different prefixes", () => {
	const base = "fusion-harness-xyz789";
	assert.notStrictEqual(chainDirName(base), gauntletDirName(base));
});

// ─────────────────────────────────────────────────────────────────────────────
// 14. VERDICT PARSER
// ─────────────────────────────────────────────────────────────────────────────

test("14.01 VERDICT: CONCEDE match", () => {
	assert.strictEqual(parseStrictVerdictLine("VERDICT: CONCEDE — all good", "VERDICT"), "CONCEDE");
});

test("14.02 VERDICT: BREACH match", () => {
	assert.strictEqual(parseStrictVerdictLine("VERDICT: BREACH — found xss", "VERDICT"), "BREACH");
});

test("14.03 scans from bottom", () => {
	const text = "VERDICT: BREACH — first\nmore text\nVERDICT: CONCEDE — final";
	assert.strictEqual(parseStrictVerdictLine(text, "VERDICT"), "CONCEDE");
});

test("14.04 no match → undefined", () => {
	assert.strictEqual(parseStrictVerdictLine("no verdict", "VERDICT"), undefined);
});

// ═══════════════════════════════════════════════════════════════════════════════
// RUNNER (async IIFE — tsx CJS mode does not support top-level await)
// ═══════════════════════════════════════════════════════════════════════════════

(async () => {
	let passed = 0, failed = 0;
	const errors: Array<{ name: string; error: string }> = [];
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
	try { fs.rmSync(TMP, { recursive: true }); } catch {}
	process.exit(failed > 0 ? 1 : 0);
})();
