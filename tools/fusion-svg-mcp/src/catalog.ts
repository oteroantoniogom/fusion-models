import { existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { coordinationSuite } from './diagrams/coordination-suite.js';
import { councilPanel } from './diagrams/council-panel.js';
import { gauntletCampaign, gauntletPipeline } from './diagrams/gauntlet.js';
import { multiProviderCast } from './diagrams/multi-provider-cast.js';
import { valueLadder } from './diagrams/value-ladder.js';
import { styleTokens } from './theme.js';

export type DiagramId =
	| 'gauntlet-campaign'
	| 'coordination-suite'
	| 'multi-provider-cast'
	| 'council-panel'
	| 'value-ladder'
	| 'gauntlet-pipeline';

export type DiagramMeta = {
	id: DiagramId;
	filename: string;
	title: string;
	referenceOriginals: string[];
	description: string;
	animated: boolean;
	generate: () => string;
};

export const DIAGRAMS: Record<DiagramId, DiagramMeta> = {
	'gauntlet-campaign': {
		id: 'gauntlet-campaign',
		filename: 'svg-07-gauntlet-campaign.svg',
		title: 'Gauntlet campaign board',
		referenceOriginals: ['images/svg-05-gate-first-loop-animated.svg'],
		description:
			'Seven PASS rows with timings/cost and subtasks — the campaign dashboard summary.',
		animated: false,
		generate: gauntletCampaign,
	},
	'coordination-suite': {
		id: 'coordination-suite',
		filename: 'svg-08-coordination-suite.svg',
		title: 'Five coordination modes',
		referenceOriginals: ['images/svg-03-three-commands.svg'],
		description:
			'Five vertical command cards (/parallel, /debate, /coordinate, /council, /redteam) matching svg-03 card grammar.',
		animated: true,
		generate: coordinationSuite,
	},
	'multi-provider-cast': {
		id: 'multi-provider-cast',
		filename: 'svg-09-multi-provider-cast.svg',
		title: 'Multi-provider cast',
		referenceOriginals: ['images/svg-06-two-column-dx.svg', 'images/svg-03-three-commands.svg'],
		description:
			'Cast sheet terminal chrome with role rows + providers column; role ≠ model.',
		animated: false,
		generate: multiProviderCast,
	},
	'council-panel': {
		id: 'council-panel',
		filename: 'svg-10-council-panel.svg',
		title: 'Council PANEL ∪ PANEL_2',
		referenceOriginals: ['images/svg-03-three-commands.svg', 'images/svg-05-gate-first-loop-animated.svg'],
		description:
			'Merge PANEL and PANEL_2 into one deduped pool, then answer → rank → Borda → CHAIRMAN.',
		animated: true,
		generate: councilPanel,
	},
	'value-ladder': {
		id: 'value-ladder',
		filename: 'svg-11-value-ladder.svg',
		title: 'Value ladder',
		referenceOriginals: ['images/svg-03-three-commands.svg'],
		description:
			'Three rungs: foundation trio → coordination suite → gauntlet/chain factory.',
		animated: false,
		generate: valueLadder,
	},
	'gauntlet-pipeline': {
		id: 'gauntlet-pipeline',
		filename: 'svg-12-gauntlet-pipeline.svg',
		title: 'Gauntlet pipeline',
		referenceOriginals: ['images/svg-03-three-commands.svg', 'images/svg-05-gate-first-loop-animated.svg'],
		description:
			'Seven-stage campaign anatomy plus /gauntlet vs /chain composer cards.',
		animated: true,
		generate: gauntletPipeline,
	},
};

export function listDiagrams() {
	return Object.values(DIAGRAMS).map(({ generate: _, ...meta }) => meta);
}

export function generateDiagram(id: DiagramId): {
	filename: string;
	svg: string;
	meta: Omit<DiagramMeta, 'generate'>;
} {
	const d = DIAGRAMS[id];
	if (!d) throw new Error(`Unknown diagram: ${id}`);
	const { generate, ...meta } = d;
	return { filename: d.filename, svg: generate(), meta };
}

export function defaultImagesDir(repoRoot?: string): string {
	if (repoRoot) return join(repoRoot, 'images');
	const pkgRoot = resolve(import.meta.dirname, '..');
	const monorepoImages = resolve(pkgRoot, '../../images');
	if (existsSync(monorepoImages)) return monorepoImages;
	return join(pkgRoot, 'images');
}

export function writeDiagram(id: DiagramId, outDir?: string): { path: string; bytes: number } {
	const { filename, svg } = generateDiagram(id);
	const dir = outDir ?? defaultImagesDir();
	mkdirSync(dir, { recursive: true });
	const path = join(dir, filename);
	writeFileSync(path, svg, 'utf8');
	return { path, bytes: Buffer.byteLength(svg, 'utf8') };
}

export function writeAllDiagrams(outDir?: string) {
	return (Object.keys(DIAGRAMS) as DiagramId[]).map((id) => ({
		id,
		...writeDiagram(id, outDir),
	}));
}

export { styleTokens };
