/**
 * Style grammar extracted from Disler fusion-harness SVGs
 * (svg-01, svg-03, svg-04, svg-05, svg-06).
 */
export const FONT =
	'ui-monospace,SFMono-Regular,Menlo,Consolas,monospace';

export const C = {
	bg: '#0d1117',
	card: '#161b22',
	deep: '#0d1117',
	terminal: '#010409',
	border: '#30363d',
	borderSubtle: '#21262d',
	text: '#e6edf3',
	muted: '#8b949e',
	dim: '#484f58',
	architect: '#a78bfa',
	builder: '#f0b429',
	fusion: '#22d3ee',
	fusionFill: '#0f1a1e',
	fusionBar: '#173b44',
	success: '#3fb950',
	successFill: '#0f1a14',
	error: '#f85149',
	panel: '#58a6ff',
	trafficRed: '#f85149',
	trafficYellow: '#f0b429',
	trafficGreen: '#3fb950',
} as const;

/** HTML entities matching Disler originals (keep in SVG source as entities). */
export const G = {
	architect: '&#9670;', // ◆
	builder: '&#9650;', // ▲
	fusion: '&#10697;', // ⧉
	check: '&#10003;', // ✓
	debaterA: '&#9672;', // ◈
	debaterB: '&#9671;', // ◇
	judge: '&#9878;', // ⚖
	coordinator: '&#9678;', // ◎
	panel: '&#9776;', // ☰
	panel2: '&#9783;', // ☷
	chairman: '&#9733;', // ★
	attacker: '&#10005;', // ✕
	bullet: '&#8226;', // •
	middot: ' &#183; ',
	arrow: '&#8594;', // →
	union: '&#8746;', // ∪
} as const;

export const ANIM = {
	/** Shared by svg-01 and svg-05 — dashed flow march + reduced-motion gate. */
	flowMarch: `<style>
    .flow { fill: none; stroke-width: 2; stroke-dasharray: 6 10; stroke-linecap: round; animation: march 1.1s linear infinite; }
    .flow-tight { fill: none; stroke-width: 2; stroke-dasharray: 5 8; stroke-linecap: round; animation: march 1.1s linear infinite; }
    .flow-b { animation-delay: -0.55s; }
    .lag1 { animation-delay: -0.3s; } .lag2 { animation-delay: -0.6s; } .lag3 { animation-delay: -0.9s; }
    @keyframes march { to { stroke-dashoffset: -16; } }
    .glow { animation: pulse 2.8s ease-in-out infinite; }
    @keyframes pulse { 0%,100% { opacity: 0.15; } 50% { opacity: 0.55; } }
    .glow-green { animation: glowg 2.4s ease-in-out infinite; }
    @keyframes glowg { 0%,100% { opacity: 0.15; } 50% { opacity: 0.6; } }
    .breathe { animation: breathe 2.8s ease-in-out infinite; transform-box: fill-box; transform-origin: center; }
    @keyframes breathe { 0%,100% { transform: scale(1); } 50% { transform: scale(1.035); } }
    .blink-red { animation: blinkr 1.6s ease-in-out infinite; }
    @keyframes blinkr { 0%,100% { fill: #f85149; opacity: 1; } 50% { opacity: 0.25; } }
    @media (prefers-reduced-motion: reduce) {
      .flow, .flow-tight, .flow-b, .lag1, .lag2, .lag3, .glow, .glow-green, .breathe, .blink-red { animation: none; }
    }
  </style>`,
} as const;

export type StyleTokens = {
	colors: typeof C;
	glyphs: typeof G;
	font: typeof FONT;
	rules: string[];
};

export function styleTokens(): StyleTokens {
	return {
		colors: C,
		glyphs: G,
		font: FONT,
		rules: [
			'Outer canvas: rx=14 fill bg, inset stroke border at 0.75 with rx=13.5 stroke-width 1.5',
			'Cards: rx=10 fill card, stroke accent 1.5 (or border for neutral)',
			'Inner chips: rx=7–8 fill deep/terminal, stroke border 1.25',
			'Title: 16px weight 700 letter-spacing 2 centered ~y=40–44',
			'Subtitle: 12px muted centered ~y=62–68',
			'Footer: 11px dim centered near bottom',
			'Font stack: ui-monospace,SFMono-Regular,Menlo,Consolas,monospace',
			'role=img + aria-label on root <svg>',
			'Animations only via CSS classes; always include prefers-reduced-motion: reduce',
			'Use HTML entities for glyphs (&#9670; etc.), not raw unicode in source when matching Disler',
			'Arrowheads: small filled triangles as <path>, optional <marker> for curved flows',
			'Traffic lights (terminal chrome): r=5 circles at red/yellow/green',
		],
	};
}
