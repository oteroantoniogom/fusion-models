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

/**
 * svg-07 — gauntlet campaign board (PASS rows), matching the live dashboard language.
 * Restores the deleted campaign summary asset and is regenerated from the MCP.
 */
export function gauntletCampaign(): string {
	const W = 760;
	const H = 492;
	const stages = [
		{ n: '1. DELIBERATE', meta: 'PASS · 18.4s · $0.0123' },
		{ n: '2. GATE-FIRST', meta: 'PASS · 9.1s · $0.0044' },
		{ n: '3. DECOMPOSE', meta: 'PASS · 7.7s · $0.0050' },
		{ n: '4. BUILD', meta: 'PASS · 142.9s · $0.0881' },
		{ n: '5. VERIFY', meta: 'PASS · 31.2s · $0.0198' },
		{ n: '6. HARDEN', meta: 'PASS · 64.5s · $0.0412' },
		{ n: '7. INTEGRATE', meta: 'PASS · 12.3s · $0.0071' },
	];

	const rows = stages
		.map((s, i) => {
			const y = 98 + i * 30;
			return [
				card(28, y, 704, 24, C.success, { rx: 7, fill: '#161b22', strokeWidth: 1.25 }),
				text(42, y + 16, G.check, { fill: C.success, size: 15, weight: 700 }),
				text(68, y + 16, s.n, { fill: C.text, size: 14, weight: 600 }),
				text(720, y + 16, s.meta, { fill: C.success, size: 12, anchor: 'end' }),
			].join('\n');
		})
		.join('\n');

	const subs = [
		'scaffold CLI entry + arg parsing',
		'implement core command dispatcher',
		'add config layer + persistence',
		'write integration tests',
	];

	return [
		openSvg({
			width: W,
			height: H,
			ariaLabel:
				'Gauntlet campaign summary — DELIBERATE through INTEGRATE all PASS with timings and cost',
		}),
		text(380, 46, 'GAUNTLET CAMPAIGN', {
			fill: C.text,
			size: 20,
			weight: 700,
			anchor: 'middle',
		}),
		text(380, 72, 'Build a CLI task runner with subcommands and config · 286.1s · ~$0.1779', {
			fill: C.muted,
			size: 12,
			anchor: 'middle',
		}),
		rows,
		text(28, 334, 'SUBTASKS', { fill: C.muted, size: 12, weight: 600 }),
		subs
			.map((s, i) =>
				text(36, 354 + i * 22, `${G.check} ${s}`, { fill: C.success, size: 13 }),
			)
			.join('\n'),
		footer(380, 480, 'fusion-harness · gauntlet campaign'),
		closeSvg(),
	].join('\n');
}

/**
 * svg-12 — gauntlet pipeline anatomy: seven stages + /chain composer.
 * Same card grammar as svg-03 / svg-05 (flow arrows, stage chips).
 */
export function gauntletPipeline(): string {
	const W = 900;
	const H = 420;

	const stages: Array<{ label: string; sub: string; stroke: string }> = [
		{ label: 'DELIBERATE', sub: 'council / debate', stroke: C.panel },
		{ label: 'GATE', sub: 'gate-first', stroke: C.success },
		{ label: 'DECOMPOSE', sub: 'coordinate', stroke: C.fusion },
		{ label: 'BUILD', sub: 'workers', stroke: C.builder },
		{ label: 'VERIFY', sub: 'gate run', stroke: C.success },
		{ label: 'HARDEN', sub: 'redteam', stroke: C.error },
		{ label: 'INTEGRATE', sub: 'ship', stroke: C.architect },
	];

	const chipW = 108;
	const gap = 14;
	const total = stages.length * chipW + (stages.length - 1) * gap;
	const startX = (W - total) / 2;
	const y = 110;

	const stageSvg = stages
		.map((s, i) => {
			const x = startX + i * (chipW + gap);
			const cx = x + chipW / 2;
			const parts = [
				chip(x, y, chipW, 72, s.stroke, { fill: C.card }),
				text(cx, y + 32, s.label, { fill: s.stroke, size: 11, weight: 700, anchor: 'middle' }),
				text(cx, y + 52, s.sub, { fill: C.muted, size: 10, anchor: 'middle' }),
			];
			if (i < stages.length - 1) {
				const ax = x + chipW + 2;
				parts.push(flowLine(`M${ax},${y + 36} L${ax + gap - 6},${y + 36}`, C.muted, { className: 'flow-tight', width: 1.75 }));
				parts.push(arrowHead(ax + gap - 2, y + 36, C.muted, 'right'));
			}
			return parts.join('\n');
		})
		.join('\n');

	return [
		openSvg({
			width: W,
			height: H,
			ariaLabel:
				'Gauntlet pipeline: deliberate, gate, decompose, build, verify, harden, integrate — composable with /chain',
			style: ANIM.flowMarch,
		}),
		titleBlock(
			W / 2,
			'/GAUNTLET · FULL CAMPAIGN',
			'seven stages · one artifacts dir · resume-safe',
			{ titleSize: 16 },
		),
		stageSvg,

		// /gauntlet vs /chain cards
		card(40, 220, 400, 140, C.success),
		text(240, 252, '/gauntlet <prompt>', {
			fill: C.success,
			size: 14,
			weight: 700,
			anchor: 'middle',
		}),
		text(240, 280, 'runs the full preset end to end', { fill: C.text, size: 12, anchor: 'middle' }),
		text(240, 302, '--skip-council · --skip-redteam', { fill: C.muted, size: 11, anchor: 'middle' }),
		text(240, 324, '--deliberate=council|debate · --resume', {
			fill: C.muted,
			size: 11,
			anchor: 'middle',
		}),

		card(460, 220, 400, 140, C.fusion),
		text(660, 252, '/chain <stages> <prompt>', {
			fill: C.fusion,
			size: 14,
			weight: 700,
			anchor: 'middle',
		}),
		text(660, 280, 'compose any ordered subset', { fill: C.text, size: 12, anchor: 'middle' }),
		text(660, 302, 'e.g. gate,build,verify', { fill: C.muted, size: 11, anchor: 'middle' }),
		text(660, 324, 'prereqs validated before any spawn', {
			fill: C.muted,
			size: 11,
			anchor: 'middle',
		}),

		footer(
			W / 2,
			H - 24,
			'factory node' +
				G.middot +
				'coordination modes as stages' +
				G.middot +
				'clean-room children throughout',
		),
		closeSvg(),
	].join('\n');
}
