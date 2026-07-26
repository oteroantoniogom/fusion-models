import { C, FONT } from './theme.js';

export function esc(s: string): string {
	return s
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
}

/** Prefer for labels that already contain HTML entities (glyphs). */
export function escKeepEntities(s: string): string {
	// Escape < > " but leave &...; entities alone by protecting them.
	const placeholders: string[] = [];
	const protected_ = s.replace(/&#?\w+;/g, (m) => {
		placeholders.push(m);
		return `\u0000${placeholders.length - 1}\u0000`;
	});
	const escaped = protected_
		.replace(/&/g, '&amp;')
		.replace(/</g, '&lt;')
		.replace(/>/g, '&gt;')
		.replace(/"/g, '&quot;');
	return escaped.replace(/\u0000(\d+)\u0000/g, (_, i) => placeholders[Number(i)]!);
}

export function openSvg(opts: {
	width: number;
	height: number;
	ariaLabel: string;
	style?: string;
	defs?: string;
}): string {
	const { width, height, ariaLabel, style = '', defs = '' } = opts;
	return [
		`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" font-family="${FONT}" role="img" aria-label="${esc(ariaLabel)}">`,
		style,
		defs ? `  <defs>\n${defs}\n  </defs>` : '',
		`  <rect x="0" y="0" width="${width}" height="${height}" rx="14" fill="${C.bg}"/>`,
		`  <rect x="0.75" y="0.75" width="${width - 1.5}" height="${height - 1.5}" rx="13.5" fill="none" stroke="${C.border}" stroke-width="1.5"/>`,
	]
		.filter(Boolean)
		.join('\n');
}

export function closeSvg(): string {
	return `</svg>\n`;
}

export function titleBlock(
	cx: number,
	title: string,
	subtitle?: string,
	opts?: { titleY?: number; subtitleY?: number; titleSize?: number },
): string {
	const titleY = opts?.titleY ?? 40;
	const subtitleY = opts?.subtitleY ?? 62;
	const titleSize = opts?.titleSize ?? 16;
	const lines = [
		`  <text x="${cx}" y="${titleY}" text-anchor="middle" fill="${C.text}" font-size="${titleSize}" font-weight="700" letter-spacing="2">${escKeepEntities(title)}</text>`,
	];
	if (subtitle) {
		lines.push(
			`  <text x="${cx}" y="${subtitleY}" text-anchor="middle" fill="${C.muted}" font-size="12">${escKeepEntities(subtitle)}</text>`,
		);
	}
	return lines.join('\n');
}

export function footer(cx: number, y: number, text: string, fill = C.dim, size = 11): string {
	return `  <text x="${cx}" y="${y}" text-anchor="middle" fill="${fill}" font-size="${size}">${escKeepEntities(text)}</text>`;
}

export function card(
	x: number,
	y: number,
	w: number,
	h: number,
	stroke: string,
	opts?: { rx?: number; fill?: string; strokeWidth?: number },
): string {
	const rx = opts?.rx ?? 10;
	const fill = opts?.fill ?? C.card;
	const sw = opts?.strokeWidth ?? 1.5;
	return `  <rect x="${x}" y="${y}" width="${w}" height="${h}" rx="${rx}" fill="${fill}" stroke="${stroke}" stroke-width="${sw}"/>`;
}

export function chip(
	x: number,
	y: number,
	w: number,
	h: number,
	stroke: string,
	opts?: { rx?: number; fill?: string },
): string {
	return card(x, y, w, h, stroke, {
		rx: opts?.rx ?? 8,
		fill: opts?.fill ?? C.deep,
		strokeWidth: 1.25,
	});
}

export function text(
	x: number,
	y: number,
	content: string,
	opts: {
		fill?: string;
		size?: number;
		weight?: number | string;
		anchor?: 'start' | 'middle' | 'end';
	} = {},
): string {
	const fill = opts.fill ?? C.text;
	const size = opts.size ?? 12;
	const weight = opts.weight != null ? ` font-weight="${opts.weight}"` : '';
	const anchor = opts.anchor ? ` text-anchor="${opts.anchor}"` : '';
	return `  <text x="${x}" y="${y}"${anchor} fill="${fill}" font-size="${size}"${weight}>${escKeepEntities(content)}</text>`;
}

export function arrowHead(x: number, y: number, fill: string, dir: 'right' | 'down' | 'left' | 'up' = 'right'): string {
	if (dir === 'right') return `  <path d="M${x},${y} l-7,-4.5 v9 z" fill="${fill}"/>`;
	if (dir === 'down') return `  <path d="M${x},${y} l-4.5,-7 h9 z" fill="${fill}"/>`;
	if (dir === 'left') return `  <path d="M${x},${y} l7,-4.5 v9 z" fill="${fill}"/>`;
	return `  <path d="M${x},${y} l-4.5,7 h9 z" fill="${fill}"/>`;
}

export function flowLine(
	d: string,
	stroke: string,
	opts?: { className?: string; width?: number },
): string {
	const cls = opts?.className ?? 'flow';
	const sw = opts?.width ?? 2;
	return `  <path class="${cls}" d="${d}" fill="none" stroke="${stroke}" stroke-width="${sw}"/>`;
}

export function terminalChrome(
	x: number,
	y: number,
	w: number,
	h: number,
	title: string,
): string {
	return [
		card(x, y, w, h, C.border, { fill: C.terminal, rx: 10 }),
		`  <circle cx="${x + 22}" cy="${y + 20}" r="5" fill="${C.trafficRed}"/>`,
		`  <circle cx="${x + 40}" cy="${y + 20}" r="5" fill="${C.trafficYellow}"/>`,
		`  <circle cx="${x + 58}" cy="${y + 20}" r="5" fill="${C.trafficGreen}"/>`,
		text(x + w / 2, y + 24, title, { fill: C.dim, size: 11, anchor: 'middle' }),
	].join('\n');
}

export function markerDefs(): string {
	return `    <marker id="arr-a" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${C.architect}"/>
    </marker>
    <marker id="arr-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${C.builder}"/>
    </marker>
    <marker id="arr-n" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M0,0 L10,5 L0,10 z" fill="${C.muted}"/>
    </marker>`;
}
