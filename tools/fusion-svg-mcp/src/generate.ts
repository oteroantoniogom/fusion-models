#!/usr/bin/env node
import { writeAllDiagrams, writeDiagram, type DiagramId, DIAGRAMS } from './catalog.js';

const args = process.argv.slice(2);
const outIdx = args.indexOf('--out');
const outDir = outIdx >= 0 ? args[outIdx + 1] : undefined;
const ids = args.filter((a, i) => a !== '--out' && i !== outIdx + 1 && !a.startsWith('-'));

if (ids.length === 0 || ids.includes('all')) {
	const written = writeAllDiagrams(outDir);
	for (const w of written) console.log(`wrote ${w.path} (${w.bytes} bytes)`);
} else {
	for (const id of ids) {
		if (!(id in DIAGRAMS)) {
			console.error(`Unknown diagram: ${id}`);
			console.error(`Known: ${Object.keys(DIAGRAMS).join(', ')}`);
			process.exit(1);
		}
		const w = writeDiagram(id as DiagramId, outDir);
		console.log(`wrote ${w.path} (${w.bytes} bytes)`);
	}
}
