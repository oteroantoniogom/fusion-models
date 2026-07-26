#!/usr/bin/env node
import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import {
	DIAGRAMS,
	generateDiagram,
	listDiagrams,
	styleTokens,
	writeAllDiagrams,
	writeDiagram,
	type DiagramId,
} from './catalog.js';

const diagramIdSchema = z.enum([
	'gauntlet-campaign',
	'coordination-suite',
	'multi-provider-cast',
	'council-panel',
	'value-ladder',
	'gauntlet-pipeline',
]);

const server = new McpServer({
	name: 'fusion-svg',
	version: '1.0.0',
});

server.registerTool(
	'list_style_tokens',
	{
		title: 'List Disler SVG style tokens',
		description:
			'Return the color palette, glyphs, font stack, and structural rules extracted from the original Disler fusion-harness SVGs.',
		inputSchema: {},
	},
	async () => {
		const tokens = styleTokens();
		return {
			content: [{ type: 'text', text: JSON.stringify(tokens, null, 2) }],
		};
	},
);

server.registerTool(
	'list_diagrams',
	{
		title: 'List fork README diagrams',
		description:
			'List diagram ids the generator can produce (svg-07..svg-12), with reference originals and descriptions.',
		inputSchema: {},
	},
	async () => ({
		content: [{ type: 'text', text: JSON.stringify(listDiagrams(), null, 2) }],
	}),
);

server.registerTool(
	'preview_diagram',
	{
		title: 'Preview diagram SVG',
		description: 'Generate a diagram in memory and return the SVG markup (does not write to disk).',
		inputSchema: {
			id: diagramIdSchema.describe('Diagram id to generate'),
		},
	},
	async ({ id }) => {
		const { filename, svg, meta } = generateDiagram(id as DiagramId);
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify({ filename, meta, svg }, null, 2),
				},
			],
		};
	},
);

server.registerTool(
	'generate_diagram',
	{
		title: 'Write one diagram SVG',
		description:
			'Generate one Disler-style diagram and write it under the images/ directory (or --outDir).',
		inputSchema: {
			id: diagramIdSchema,
			outDir: z
				.string()
				.optional()
				.describe('Absolute output directory. Defaults to <repo>/images'),
		},
	},
	async ({ id, outDir }) => {
		const written = writeDiagram(id as DiagramId, outDir);
		const meta = DIAGRAMS[id as DiagramId];
		return {
			content: [
				{
					type: 'text',
					text: JSON.stringify(
						{
							id,
							path: written.path,
							bytes: written.bytes,
							filename: meta.filename,
							referenceOriginals: meta.referenceOriginals,
						},
						null,
						2,
					),
				},
			],
		};
	},
);

server.registerTool(
	'generate_all_fork_diagrams',
	{
		title: 'Write all fork diagrams',
		description: 'Generate svg-07 through svg-12 into images/ (or outDir).',
		inputSchema: {
			outDir: z.string().optional().describe('Absolute output directory. Defaults to <repo>/images'),
		},
	},
	async ({ outDir }) => {
		const written = writeAllDiagrams(outDir);
		return {
			content: [{ type: 'text', text: JSON.stringify({ written }, null, 2) }],
		};
	},
);

async function main() {
	const transport = new StdioServerTransport();
	await server.connect(transport);
}

main().catch((err) => {
	console.error(err);
	process.exit(1);
});
