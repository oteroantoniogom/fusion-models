import { ANIM, C, G } from '../theme.js';
import {
	arrowHead,
	card,
	closeSvg,
	flowLine,
	footer,
	openSvg,
	text,
	titleBlock,
} from '../primitives.js';

/** svg-10 — PANEL ∪ PANEL_2 merge + Borda → CHAIRMAN pipeline. */
export function councilPanel(): string {
	const W = 840;
	const H = 360;

	return [
		openSvg({
			width: W,
			height: H,
			ariaLabel:
				'Council panelist pool: PANEL union PANEL_2, deduped, then anonymized Borda ranking and CHAIRMAN synthesis',
			style: ANIM.flowMarch,
		}),
		titleBlock(
			W / 2,
			`COUNCIL POOL = PANEL ${G.union} PANEL_2`,
			`Multi-pick rows · dedupe by provider/id · first wins · need &#8805;2 panelists`,
		),

		// PANEL
		card(40, 90, 240, 140, C.panel),
		text(160, 118, `${G.panel} PANEL`, { fill: C.panel, size: 14, weight: 700, anchor: 'middle' }),
		text(60, 148, 'a/x', { fill: C.text, size: 12 }),
		text(60, 170, 'b/y', { fill: C.text, size: 12 }),
		text(60, 192, `fallback ${G.arrow} ARCHITECT`, { fill: C.muted, size: 11 }),
		text(60, 214, 'if unset', { fill: C.dim, size: 10 }),

		// PANEL_2
		card(300, 90, 240, 140, C.panel),
		text(420, 118, `${G.panel2} PANEL_2`, { fill: C.panel, size: 14, weight: 700, anchor: 'middle' }),
		text(320, 148, 'b/y', { fill: C.text, size: 12 }),
		text(320, 170, 'c/z', { fill: C.text, size: 12 }),
		text(320, 192, `empty ${G.arrow} contributes 0`, { fill: C.muted, size: 11 }),
		text(320, 214, 'no ARCHITECT fallback', { fill: C.dim, size: 10 }),

		flowLine('M540,160 L572,160', C.muted, { className: 'flow-tight', width: 2 }),
		arrowHead(580, 160, C.muted, 'right'),

		// MERGED
		card(590, 90, 210, 140, C.success),
		text(695, 118, 'MERGED', { fill: C.success, size: 13, weight: 700, anchor: 'middle' }),
		text(610, 148, '1. a/x  (PANEL)', { fill: C.text, size: 12 }),
		text(610, 170, '2. b/y  (PANEL)', { fill: C.text, size: 12 }),
		text(610, 192, '3. c/z  (PANEL_2)', { fill: C.text, size: 12 }),
		text(610, 214, 'b/y deduped · PANEL wins', { fill: C.dim, size: 10 }),

		// pipeline bar
		card(40, 250, 760, 70, C.border, { fill: C.terminal }),
		text(100, 290, 'answer', { fill: C.text, size: 12, anchor: 'middle' }),
		text(170, 290, G.arrow, { fill: C.dim, size: 14 }),
		text(240, 290, 'rank', { fill: C.text, size: 12, anchor: 'middle' }),
		text(310, 290, G.arrow, { fill: C.dim, size: 14 }),
		text(390, 290, 'Borda', { fill: C.text, size: 12, anchor: 'middle' }),
		text(470, 290, G.arrow, { fill: C.dim, size: 14 }),
		text(570, 290, `${G.chairman} CHAIRMAN`, {
			fill: C.builder,
			size: 12,
			weight: 700,
			anchor: 'middle',
		}),
		text(690, 290, G.arrow, { fill: C.dim, size: 14 }),
		text(750, 290, 'synth', { fill: C.success, size: 12, weight: 700, anchor: 'middle' }),

		footer(W / 2, H - 12, 'one council, not two · used by /council and gauntlet deliberate'),
		closeSvg(),
	].join('\n');
}
