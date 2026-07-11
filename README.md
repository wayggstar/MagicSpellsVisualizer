# MagicSpells Visualizer

MagicSpells Visualizer is a React workspace for editing Minecraft MagicSpells YAML and previewing spell structure visually.

## What It Does

- Edit MagicSpells YAML with CodeMirror.
- Parse spells, called spell chains, `EquationEffect`, area spells, and sounds.
- Inspect spell relationships as a React Flow graph.
- Edit common spell/effect fields from an inspector panel.
- Preview `EquationEffect` particle paths and area radius boxes in a Three.js scene.

## Tech Stack

- Vite + React
- CodeMirror YAML editor
- React Flow
- Three.js through `@react-three/fiber` and `@react-three/drei`
- `js-yaml` for parsing and dumping YAML
- `mathjs` for evaluating particle equations

## Development

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
```

