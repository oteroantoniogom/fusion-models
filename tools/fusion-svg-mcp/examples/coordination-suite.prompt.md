# Example prompt → coordination-suite

## MCP tool call

```json
{
  "tool": "generate_diagram",
  "arguments": {
    "id": "coordination-suite",
    "outDir": "./examples"
  }
}
```

## CLI

```bash
npm run generate -- coordination-suite --out ./examples
```

## Intent

Five vertical command cards in the same grammar as Disler’s `svg-03`
(`/parallel`, `/debate`, `/coordinate`, `/council`, `/redteam`).

## Result

See [`coordination-suite.result.svg`](./coordination-suite.result.svg).
