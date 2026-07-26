# Example prompt → council-panel

## MCP tool call

```json
{
  "tool": "generate_diagram",
  "arguments": {
    "id": "council-panel",
    "outDir": "./examples"
  }
}
```

## CLI

```bash
npm run generate -- council-panel --out ./examples
```

## Intent

Show `PANEL ∪ PANEL_2` merge with dedupe, then
`answer → rank → Borda → CHAIRMAN → synth`.

## Result

See [`council-panel.result.svg`](./council-panel.result.svg).
