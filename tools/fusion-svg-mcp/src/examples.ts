#!/usr/bin/env node
/** Write example result SVGs next to their *.prompt.md files. */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { generateDiagram, type DiagramId } from './catalog.js';
import { C, G } from './theme.js';
import { card, closeSvg, footer, openSvg, text, titleBlock } from './primitives.js';

const EXAMPLES: DiagramId[] = ['gauntlet-pipeline', 'coordination-suite', 'council-panel'];
const outDir = resolve(import.meta.dirname, '../examples');
mkdirSync(outDir, { recursive: true });

for (const id of EXAMPLES) {
	const { svg } = generateDiagram(id);
	const dest = join(outDir, `${id}.result.svg`);
	writeFileSync(dest, svg, 'utf8');
	console.log(`wrote ${dest} (${Buffer.byteLength(svg, 'utf8')} bytes)`);
}

/** Small explainer: MCP prompt in → SVG result out (no secrets, local only). */
function promptResultExplainer(): string {
	const W = 760;
	const H = 280;
	return [
		openSvg({
			width: W,
			height: H,
			ariaLabel: 'Example flow: MCP generate_diagram prompt in, SVG result out — local, no API keys',
		}),
		titleBlock(W / 2, 'EXAMPLE FLOW', 'prompt in · SVG out · no API keys required'),
		card(40, 90, 300, 120, C.architect),
		text(190, 125, 'PROMPT', { fill: C.architect, size: 13, weight: 700, anchor: 'middle' }),
		text(190, 150, 'generate_diagram', { fill: C.text, size: 12, anchor: 'middle' }),
		text(190, 172, '{ id: "gauntlet-pipeline" }', { fill: C.muted, size: 11, anchor: 'middle' }),
		text(190, 194, 'local MCP / CLI', { fill: C.dim, size: 10, anchor: 'middle' }),
		text(380, 150, G.arrow, { fill: C.dim, size: 22, anchor: 'middle' }),
		card(420, 90, 300, 120, C.success),
		text(570, 125, 'RESULT', { fill: C.success, size: 13, weight: 700, anchor: 'middle' }),
		text(570, 150, '*.result.svg', { fill: C.text, size: 12, anchor: 'middle' }),
		text(570, 172, 'Disler-style markup', { fill: C.muted, size: 11, anchor: 'middle' }),
		text(570, 194, 'deterministic · offline', { fill: C.dim, size: 10, anchor: 'middle' }),
		footer(W / 2, H - 24, 'see examples/*.prompt.md + examples/*.result.svg'),
		closeSvg(),
	].join('\n');
}

const explainerPath = join(outDir, 'prompt-to-result.result.svg');
const explainer = promptResultExplainer();
writeFileSync(explainerPath, explainer, 'utf8');
console.log(`wrote ${explainerPath} (${Buffer.byteLength(explainer, 'utf8')} bytes)`);
