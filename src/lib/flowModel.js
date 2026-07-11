import { getSpellClassName, isRecord } from "./spellModel";

function makeNodeId(...parts) {
  return parts.map((part) => encodeURIComponent(String(part))).join("-");
}

export function buildSpellFlow(parsed) {
  if (!isRecord(parsed)) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];
  let spellY = 0;

  for (const [spellName, spell] of Object.entries(parsed)) {
    const spellId = makeNodeId("spell", spellName);
    const classId = makeNodeId("spell", spellName, "class");
    const spellConfig = isRecord(spell) ? spell : {};
    const spellClass = spellConfig["spell-class"] ?? "unknown";

    nodes.push({
      id: spellId,
      position: { x: 0, y: spellY },
      data: {
        label: `Spell: ${spellName}`,
        path: [spellName],
        kind: "spell",
      },
    });

    nodes.push({
      id: classId,
      position: { x: 280, y: spellY },
      data: {
        label: `Class: ${getSpellClassName(spellClass)}`,
        path: [spellName],
        kind: "class",
      },
    });

    edges.push({
      id: `${spellId}-${classId}`,
      source: spellId,
      target: classId,
    });

    const calledSpells = Array.isArray(spellConfig.spells) ? spellConfig.spells : [];
    let callY = spellY + 88;

    for (const called of calledSpells) {
      const callId = makeNodeId("spell", spellName, "call", called);

      nodes.push({
        id: callId,
        position: { x: 560, y: callY },
        data: {
          label: `calls: ${called}`,
          path: [called],
          kind: "call",
          targetSpell: called,
        },
      });

      edges.push({
        id: `${spellId}-calls-${called}`,
        source: classId,
        target: callId,
        animated: getSpellClassName(spellClass) === "MultiSpell",
      });

      if (parsed[called]) {
        edges.push({
          id: `${callId}-to-spell-${called}`,
          source: callId,
          target: makeNodeId("spell", called),
          animated: true,
        });
      }

      callY += 82;
    }

    const effects = isRecord(spellConfig.effects) || Array.isArray(spellConfig.effects) ? spellConfig.effects : {};
    let effectY = callY + 38;

    for (const [key, effect] of Object.entries(effects)) {
      const effectId = makeNodeId("spell", spellName, "effect", key);
      let label = `${key}: ${effect.effect ?? "unknown"}`;

      if (effect.effect === "effectlib") label = `${key}: ${effect.effectlib?.class ?? "effectlib"}`;
      if (effect.effect === "sound") label = `${key}: sound`;

      nodes.push({
        id: effectId,
        position: { x: 280, y: effectY },
        data: {
          label,
          path: [spellName, "effects", key],
          kind: "effect",
        },
      });

      edges.push({
        id: `${spellId}-${effectId}`,
        source: spellId,
        target: effectId,
      });

      effectY += 92;
    }

    spellY += Math.max(280, effectY - spellY + 82);
  }

  return { nodes, edges };
}
