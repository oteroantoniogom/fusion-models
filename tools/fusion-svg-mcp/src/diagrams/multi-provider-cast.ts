import { C, G } from '../theme.js';
import {
	card,
	closeSvg,
	footer,
	openSvg,
	terminalChrome,
	text,
	titleBlock,
} from '../primitives.js';

/** svg-09 — cast sheet + providers, terminal chrome from svg-06. */
export function multiProviderCast(): string {
	const W = 840;
	const H = 380;

	const rows: Array<{ glyph: string; role: string; model: string; tag: string; color: string }> = [
		{
			glyph: G.architect,
			role: 'ARCHITECT',
			model: 'opencode-go/deepseek-v4-pro',
			tag: 'max',
			color: C.architect,
		},
		{
			glyph: G.builder,
			role: 'BUILDER',
			model: 'opencode-go/deepseek-v4-flash',
			tag: 'max',
			color: C.builder,
		},
		{
			glyph: G.panel,
			role: 'PANEL',
			model: 'zai/glm-5.2, anthropic/…',
			tag: 'multi',
			color: C.panel,
		},
		{
			glyph: G.panel2,
			role: 'PANEL_2',
			model: 'openai/gpt-5.6-sol, …',
			tag: 'multi',
			color: C.panel,
		},
		{
			glyph: G.chairman,
			role: 'CHAIRMAN',
			model: 'anthropic/claude-fable-5',
			tag: 'high',
			color: C.builder,
		},
		{
			glyph: G.attacker,
			role: 'ATTACKER',
			model: 'xai/grok-…',
			tag: 'med',
			color: C.error,
		},
	];

	const sheetX = 40;
	const sheetY = 84;
	const sheetW = 520;
	const sheetH = 250;

	const rowLines = rows
		.map((r, i) => {
			const y = sheetY + 56 + i * 28;
			return [
				text(sheetX + 20, y, `${r.glyph} ${r.role}`, {
					fill: r.color,
					size: 12,
					weight: 700,
				}),
				text(sheetX + 160, y, r.model, { fill: C.muted, size: 12 }),
				text(sheetX + sheetW - 40, y, r.tag, { fill: C.dim, size: 11, anchor: 'end' }),
			].join('\n');
		})
		.join('\n');

	const providers = ['anthropic', 'openai', 'opencode-go', 'zai · gemini', 'xai · deepseek', 'kimi · mistral'];

	return [
		openSvg({
			width: W,
			height: H,
			ariaLabel: 'Multi-provider cast sheet: every role can hold any model from any registered provider',
		}),
		titleBlock(W / 2, 'MULTI-PROVIDER CAST', 'Role &#8800; model. Cast any provider/id into any slot.'),
		terminalChrome(sheetX, sheetY, sheetW, sheetH, 'cast sheet · type to filter · t = thinking'),
		rowLines,
		text(sheetX + 20, sheetY + sheetH - 18, '/roles · .fusion-harness.json · preflight before spawn', {
			fill: C.dim,
			size: 11,
		}),
		card(580, sheetY, 220, sheetH, C.border),
		text(690, sheetY + 30, 'PROVIDERS', { fill: C.text, size: 12, weight: 700, anchor: 'middle' }),
		providers
			.map((p, i) => text(600, sheetY + 60 + i * 22, p, { fill: C.muted, size: 11 }))
			.join('\n'),
		text(600, sheetY + 202, '+ any {PROVIDER}_API_KEY', { fill: C.success, size: 11, weight: 700 }),
		text(690, sheetY + 228, '/login {provider}', { fill: C.dim, size: 10, anchor: 'middle' }),
		footer(W / 2, H - 20, `boot order: defaults ${G.arrow} project file ${G.arrow} flags ${G.arrow} session mutations`),
		closeSvg(),
	].join('\n');
}
