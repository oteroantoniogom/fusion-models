import { ANIM, C, G } from '../theme.js';
import {
	arrowHead,
	card,
	chip,
	closeSvg,
	flowLine,
	footer,
	openSvg,
	text,
	titleBlock,
} from '../primitives.js';

/** svg-08 — five coordination modes, same grammar as svg-03 three-command cards. */
export function coordinationSuite(): string {
	const W = 900;
	const H = 400;
	const panels = [
		{
			title: '/parallel',
			stroke: C.builder,
			body: (cx: number, x: number, y: number) =>
				[
					chip(x + 18, y + 48, 54, 54, C.architect),
					text(x + 45, y + 80, G.architect, { fill: C.architect, size: 16, weight: 700, anchor: 'middle' }),
					chip(x + 88, y + 48, 54, 54, C.builder),
					text(x + 115, y + 80, G.builder, { fill: C.builder, size: 16, weight: 700, anchor: 'middle' }),
					text(cx, y + 128, 'same task' + G.middot + 'full tools', {
						fill: C.muted,
						size: 11,
						anchor: 'middle',
					}),
					text(cx, y + 148, 'no merge', { fill: C.muted, size: 11, anchor: 'middle' }),
					text(cx, y + 188, 'build-off', { fill: C.builder, size: 12, weight: 700, anchor: 'middle' }),
					text(cx, y + 208, '2 agents', { fill: C.dim, size: 10, anchor: 'middle' }),
				].join('\n'),
		},
		{
			title: '/debate',
			stroke: C.architect,
			body: (cx: number, x: number, y: number) =>
				[
					chip(x + 18, y + 48, 54, 40, C.architect),
					text(x + 45, y + 73, `${G.debaterA} A`, {
						fill: C.architect,
						size: 12,
						weight: 700,
						anchor: 'middle',
					}),
					chip(x + 88, y + 48, 54, 40, C.builder),
					text(x + 115, y + 73, `${G.debaterB} B`, {
						fill: C.builder,
						size: 12,
						weight: 700,
						anchor: 'middle',
					}),
					flowLine(`M${x + 45},${y + 92} C${x + 45},${y + 112} ${x + 115},${y + 112} ${x + 115},${y + 92}`, C.muted, {
						className: 'flow-tight',
						width: 1.5,
					}),
					chip(x + 32, y + 118, 96, 36, C.text, { fill: C.deep }),
					text(cx, y + 140, `${G.judge} JUDGE`, {
						fill: C.text,
						size: 12,
						weight: 700,
						anchor: 'middle',
					}),
					text(cx, y + 172, 'N rounds' + G.middot + 'anonymized', {
						fill: C.muted,
						size: 11,
						anchor: 'middle',
					}),
					text(cx, y + 198, 'dialectic', { fill: C.architect, size: 12, weight: 700, anchor: 'middle' }),
					text(cx, y + 218, 'early-stop ready', { fill: C.dim, size: 10, anchor: 'middle' }),
				].join('\n'),
		},
		{
			title: '/coordinate',
			stroke: C.fusion,
			body: (cx: number, x: number, y: number) =>
				[
					chip(x + 24, y + 48, 112, 36, C.fusion),
					text(cx, y + 71, `${G.coordinator} COORD`, {
						fill: C.fusion,
						size: 12,
						weight: 700,
						anchor: 'middle',
					}),
					text(cx, y + 100, 'decompose', { fill: C.muted, size: 10, anchor: 'middle' }),
					`  <line x1="${cx}" y1="${y + 108}" x2="${cx}" y2="${y + 120}" stroke="${C.border}" stroke-width="1.5"/>`,
					chip(x + 22, y + 124, 48, 28, C.builder, { rx: 6 }),
					text(x + 46, y + 142, 'W1', { fill: C.builder, size: 10, weight: 700, anchor: 'middle' }),
					chip(x + 90, y + 124, 48, 28, C.builder, { rx: 6 }),
					text(x + 114, y + 142, 'W2', { fill: C.builder, size: 10, weight: 700, anchor: 'middle' }),
					text(cx, y + 172, 'by deps' + G.middot + 'fix-up', {
						fill: C.muted,
						size: 11,
						anchor: 'middle',
					}),
					text(cx, y + 198, 'orchestrate', { fill: C.fusion, size: 12, weight: 700, anchor: 'middle' }),
					text(cx, y + 218, 'manifest-driven', { fill: C.dim, size: 10, anchor: 'middle' }),
				].join('\n'),
		},
		{
			title: '/council',
			stroke: C.panel,
			body: (cx: number, x: number, y: number) =>
				[
					chip(x + 16, y + 48, 40, 28, C.panel, { rx: 5 }),
					text(x + 36, y + 66, G.panel, { fill: C.panel, size: 12, anchor: 'middle' }),
					chip(x + 62, y + 48, 40, 28, C.panel, { rx: 5 }),
					text(x + 82, y + 66, G.panel, { fill: C.panel, size: 12, anchor: 'middle' }),
					chip(x + 108, y + 48, 36, 28, C.panel, { rx: 5 }),
					text(x + 126, y + 66, G.panel2, { fill: C.panel, size: 11, anchor: 'middle' }),
					text(cx, y + 100, `PANEL ${G.union} PANEL_2`, {
						fill: C.muted,
						size: 10,
						anchor: 'middle',
					}),
					text(cx, y + 118, 'Borda rank', { fill: C.text, size: 11, anchor: 'middle' }),
					chip(x + 36, y + 130, 88, 32, C.builder),
					text(cx, y + 150, `${G.chairman} CHAIR`, {
						fill: C.builder,
						size: 12,
						weight: 700,
						anchor: 'middle',
					}),
					text(cx, y + 182, 'synthesize', { fill: C.text, size: 11, anchor: 'middle' }),
					text(cx, y + 202, 'multi-model', { fill: C.panel, size: 12, weight: 700, anchor: 'middle' }),
					text(cx, y + 222, 'K+1 agents', { fill: C.dim, size: 10, anchor: 'middle' }),
				].join('\n'),
		},
		{
			title: '/redteam',
			stroke: C.error,
			body: (cx: number, x: number, y: number) =>
				[
					chip(x + 20, y + 48, 120, 34, C.builder),
					text(cx, y + 70, `${G.builder} BUILD`, {
						fill: C.builder,
						size: 12,
						weight: 700,
						anchor: 'middle',
					}),
					flowLine(`M${cx},${y + 86} L${cx},${y + 102}`, C.error, { className: 'flow-tight', width: 1.5 }),
					arrowHead(cx, y + 108, C.error, 'down'),
					chip(x + 20, y + 112, 120, 34, C.error),
					text(cx, y + 134, `${G.attacker} ATTACK`, {
						fill: C.error,
						size: 12,
						weight: 700,
						anchor: 'middle',
					}),
					flowLine(
						`M${x + 40},${y + 150} C${x + 20},${y + 178} ${x + 140},${y + 178} ${x + 120},${y + 150}`,
						C.error,
						{ className: 'flow-tight lag1', width: 1.5 },
					),
					text(cx, y + 188, `BREACH ${G.arrow} patch`, {
						fill: C.text,
						size: 11,
						anchor: 'middle',
					}),
					text(cx, y + 206, 'or CONCEDE', { fill: C.muted, size: 11, anchor: 'middle' }),
					text(cx, y + 228, 'adversarial', { fill: C.error, size: 12, weight: 700, anchor: 'middle' }),
				].join('\n'),
		},
	];

	const gap = 14;
	const panelW = 160;
	const startX = 24;
	const panelY = 84;
	const panelH = 260;

	const body = panels
		.map((p, i) => {
			const x = startX + i * (panelW + gap);
			const cx = x + panelW / 2;
			return [
				card(x, panelY, panelW, panelH, p.stroke),
				text(cx, panelY + 30, p.title, { fill: C.text, size: 14, weight: 700, anchor: 'middle' }),
				p.body(cx, x, panelY),
			].join('\n');
		})
		.join('\n');

	return [
		openSvg({
			width: W,
			height: H,
			ariaLabel:
				'Five coordination commands: /parallel build-off, /debate dialectic, /coordinate orchestrate, /council multi-model panel, /redteam adversarial loop',
			style: ANIM.flowMarch,
		}),
		titleBlock(W / 2, 'FIVE COORDINATION MODES', 'Disler hinted these as DIY — this fork ships them'),
		body,
		footer(
			W / 2,
			H - 18,
			'clean-room children' +
				G.middot +
				'cast any provider/id per role' +
				G.middot +
				'artifacts in /tmp/fusion-harness-*',
		),
		closeSvg(),
	].join('\n');
}
