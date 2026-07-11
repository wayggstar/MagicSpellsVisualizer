# MagicSpells Visualizer

MagicSpells Visualizer is a React workspace for editing Minecraft MagicSpells YAML and previewing spell structure visually.

## What It Does

- Edit MagicSpells YAML with CodeMirror.
- Parse spells, called spell chains, `EquationEffect`, area spells, and sounds.
- Inspect spell relationships as a React Flow graph.
- Edit common spell/effect fields from an inspector panel.
- Preview `EquationEffect` particle paths and area radius boxes in a Three.js scene.
- Use MagicSpells wiki-based class lists, presets, reference links, and structure checks.
- Create and preview EffectLib `Image` and `ColoredImage` effects with Minecraft server image paths.
- Save custom spell effect presets in the browser and reapply them to selected spells or effects.
- Use YAML autocomplete for spell classes, particles, effect positions, sounds, and common options.

## Wiki Coverage

The app includes a curated subset of the MagicSpells wiki:

- Spell classes from the Spell List grouped by General, Instant, Targeted, and Buff spells.
- Common spell, cooldown, targeting, and effect structure checks.
- Effect position/type validation for `effects` sections.
- Chaining hints, including the wiki recommendation to mark sub-spells as `helper-spell: true`.

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
