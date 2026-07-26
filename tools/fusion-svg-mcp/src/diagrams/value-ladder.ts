import { C, G } from '../theme.js';
import { card, closeSvg, footer, openSvg, text, titleBlock } from '../primitives.js';

/** svg-11 — three-rung value ladder mirroring svg-03 card grammar. */
export function valueLadder(): string {
	const W = 860;
	const H = 300;

	const rungs = [
		{
			x: 30,
			w: 250,
			stroke: C.architect,
			label: '1 · FOUNDATION',
			labelColor: C.architect,
			lines: [
				{ t: '/opinion', c: C.text, s: 13 },
				{ t: '/fusion', c: C.text, s: 13 },
				{ t: '/auto-validate', c: C.text, s: 13 },
				{ t: 'upstream core', c: C.muted, s: 11 },
			] as Array<{ t: string; c: string; s: number; weight?: number }>,
		},
		{
			x: 320,
			w: 250,
			stroke: C.fusion,
			label: '2 · COORDINATION',
			labelColor: C.fusion,
			lines: [
				{ t: '/parallel · /debate', c: C.text, s: 12 },
				{ t: '/coordinate · /council', c: C.text, s: 12 },
				{ t: '/redteam', c: C.text, s: 12 },
				{ t: '+ multi-provider cast', c: C.muted, s: 11 },
			] as Array<{ t: string; c: string; s: number; weight?: number }>,
		},
		{
			x: 610,
			w: 220,
			stroke: C.success,
			label: '3 · FACTORY',
			labelColor: C.success,
			lines: [
				{ t: '/gauntlet', c: C.text, s: 14, weight: 700 },
				{ t: '7-stage campaign', c: C.muted, s: 11 },
				{ t: '/chain', c: C.text, s: 13 },
				{ t: 'compose any subset', c: C.muted, s: 11 },
			] as Array<{ t: string; c: string; s: number; weight?: number }>,
		},
	];

	const rungSvg = rungs
		.map((r) => {
			const cx = r.x + r.w / 2;
			const lines = r.lines
				.map((line, i) =>
					text(cx, 152 + i * 22, line.t, {
						fill: line.c,
						size: line.s,
						weight: line.weight,
						anchor: 'middle',
					}),
				)
				.join('\n');
			return [
				card(r.x, 90, r.w, 150, r.stroke),
				text(cx, 122, r.label, { fill: r.labelColor, size: 12, weight: 700, anchor: 'middle' }),
				lines,
			].join('\n');
		})
		.join('\n');

	return [
		openSvg({
			width: W,
			height: H,
			ariaLabel:
				'Value ladder: original three commands, five coordination modes, then gauntlet composite pipeline and /chain composer',
		}),
		titleBlock(
			W / 2,
			'VALUE LADDER',
			`from three commands ${G.arrow} a coordination suite ${G.arrow} a factory pipeline`,
		),
		rungSvg,
		text(295, 165, G.arrow, { fill: C.dim, size: 20 }),
		text(585, 165, G.arrow, { fill: C.dim, size: 20 }),
		footer(
			W / 2,
			H - 22,
			'same spawn machinery' + G.middot + 'same two-column DX' + G.middot + 'same clean-room children',
		),
		closeSvg(),
	].join('\n');
}
