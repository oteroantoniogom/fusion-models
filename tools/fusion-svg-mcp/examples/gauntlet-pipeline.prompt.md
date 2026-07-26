# Example prompt → gauntlet-pipeline

## MCP tool call

```json
{
  "tool": "generate_diagram",
  "arguments": {
    "id": "gauntlet-pipeline",
    "outDir": "./examples"
  }
}
```

## CLI

```bash
npm run generate -- gauntlet-pipeline --out ./examples
```

## Intent

Produce a Disler-style diagram of the `/gauntlet` seven-stage campaign
(`DELIBERATE → GATE → DECOMPOSE → BUILD → VERIFY → HARDEN → INTEGRATE`)
plus side-by-side cards for `/gauntlet` vs `/chain`.

## Style constraints (must match upstream)

- Canvas `#0d1117`, cards `#161b22`, monospace font stack
- Role accents: panel / success / fusion / builder / error / architect
- Animated `.flow` arrows with `prefers-reduced-motion: reduce`
- Reference originals: `svg-03-three-commands.svg`, `svg-05-gate-first-loop-animated.svg`

## Result

See [`gauntlet-pipeline.result.svg`](./gauntlet-pipeline.result.svg).
