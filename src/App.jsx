import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as YAML from "js-yaml";
import { evaluate } from "mathjs";
import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import { ReactFlow, Background, Controls } from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { Panel, PanelGroup, PanelResizeHandle } from "react-resizable-panels";

const SPELL_CLASSES = [
  ".MultiSpell",
  ".targeted.AreaEffectSpell",
  ".instant.ParticleProjectileSpell",
  ".targeted.PainSpell",
  ".targeted.DummySpell",
  ".buff.DummySpell",
  ".targeted.HealSpell",
  ".targeted.PotionEffectSpell",
];

const PARTICLES = [
  "redstone", "smoke", "flame", "cloud", "crit", "magicCrit", "spell", "instantSpell",
  "witchMagic", "portal", "enchantmenttable", "explosion", "largeexplode", "fireworksSpark",
  "lava", "waterdrop", "snowballpoof", "heart", "angryVillager", "happyVillager",
  "ash", "block_crack", "block_dust", "bubble", "campfire_cosy_smoke", "campfire_signal_smoke",
  "damage_indicator", "dragon_breath", "drip_lava", "drip_water", "dust", "end_rod",
  "falling_dust", "flash", "glow", "large_smoke", "note", "poof", "reverse_portal",
  "small_flame", "snowflake", "sonic_boom", "soul", "soul_fire_flame", "sweep_attack",
  "totem_of_undying", "white_ash",
];

const SOUNDS = [
  "entity.wither.shoot", "entity.blaze.hurt", "entity.blaze.shoot",
  "entity.ender_dragon.growl", "entity.generic.explode",
  "entity.player.attack.sweep", "entity.player.attack.crit",
  "entity.evoker.cast_spell", "entity.illusioner.cast_spell",
  "entity.witch.throw", "entity.warden.sonic_boom",
  "entity.enderman.teleport", "entity.lightning_bolt.thunder",
  "block.beacon.activate", "block.anvil.land",
  "block.enchantment_table.use", "block.portal.travel",
  "item.trident.thunder", "item.firecharge.use", "item.totem.use",
];

const sampleYaml = `
하델링_좌클릭pp1:
    spell-class: ".targeted.AreaEffectSpell"
    horizontal-radius: 8
    vertical-radius: 8
    point-blank: true
    target-caster: false
    target-players: true
    target-non-players: true
    fail-if-no-targets: false
    spells:
      - 하델링_1차데미지
    effects:
      0_1:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: redstone
            color: 000000
            particles: 24
            duration: 240
            orientPitch: false
            xEquation: "3.5sin(0.08t)+1"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      1s:
        position: caster
        effect: sound
        sound: entity.wither.shoot
        volume: 1
        pitch: 0.6
        delay: 2

하델링_1차데미지:
    spell-class: ".targeted.PainSpell"
    damage: 10
`;

function normalize(expr) {
  return String(expr)
    .replace(/(\d)(sin|cos|tan)/g, "$1*$2")
    .replace(/(\d)t/g, "$1*t")
    .replace(/\)(\d)/g, ")*$1")
    .replace(/t(\d)/g, "t*$1");
}

function parseColor(color, particle) {
  if (["smoke", "large_smoke", "campfire_cosy_smoke"].includes(particle)) return "#555555";
  if (["flame", "small_flame", "soul_fire_flame"].includes(particle)) return "#ff6600";
  if (particle === "cloud") return "#eeeeee";
  if (!color) return "#ffffff";

  const text = String(color).replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(text) ? `#${text}` : "#ffffff";
}

function getByPath(obj, path) {
  return path.reduce((acc, key) => acc?.[key], obj);
}

function updateByPath(obj, path, updater) {
  const clone = structuredClone(obj);
  let target = clone;

  for (let i = 0; i < path.length - 1; i++) {
    target = target[path[i]];
  }

  const last = path[path.length - 1];
  target[last] = updater(target[last]);

  return clone;
}

function getSpellClassName(spellClass) {
  if (!spellClass) return "UnknownClass";
  return String(spellClass).split(".").filter(Boolean).at(-1);
}

function findEquations(obj, result = []) {
  if (!obj || typeof obj !== "object") return result;

  if (
    obj.effect === "effectlib" &&
    obj.effectlib?.class === "EquationEffect" &&
    obj.effectlib.xEquation &&
    obj.effectlib.yEquation &&
    obj.effectlib.zEquation
  ) {
    const e = obj.effectlib;

    result.push({
      color: parseColor(e.color, e.particle),
      particle: e.particle ?? "unknown",
      position: obj.position ?? "caster",
      particles: Number(e.particles ?? 24),
      duration: Number(e.duration ?? 120),
      delay: Number(obj.delay ?? e.delay ?? 0),
      x: normalize(e.xEquation),
      y: normalize(e.yEquation),
      z: normalize(e.zEquation),
    });
  }

  for (const value of Object.values(obj)) findEquations(value, result);
  return result;
}

function findAreas(obj, result = []) {
  if (!obj || typeof obj !== "object") return result;

  if (
    String(obj["spell-class"] ?? "").includes("AreaEffectSpell") &&
    obj["horizontal-radius"] &&
    obj["vertical-radius"]
  ) {
    result.push({
      horizontal: Number(obj["horizontal-radius"]),
      vertical: Number(obj["vertical-radius"]),
    });
  }

  for (const value of Object.values(obj)) findAreas(value, result);
  return result;
}

function findSounds(obj, result = []) {
  if (!obj || typeof obj !== "object") return result;
  if (obj.effect === "sound" && obj.sound) result.push(obj);
  for (const value of Object.values(obj)) findSounds(value, result);
  return result;
}

function addEffect(parsed, spellName, type) {
  const next = structuredClone(parsed);
  const spell = next[spellName];

  if (!spell.effects) spell.effects = {};

  const key = `${type}_${Date.now().toString().slice(-5)}`;

  if (type === "equation") {
    spell.effects[key] = {
      position: "caster",
      effect: "effectlib",
      effectlib: {
        class: "EquationEffect",
        particle: "redstone",
        color: "800020",
        particles: 24,
        duration: 120,
        orientPitch: false,
        xEquation: "3sin(0.1t)",
        yEquation: "1.2cos(0.1t)+1.6",
        zEquation: "0.05t",
      },
    };
  }

  if (type === "sound") {
    spell.effects[key] = {
      position: "caster",
      effect: "sound",
      sound: "entity.wither.shoot",
      volume: 1,
      pitch: 1,
      delay: 0,
    };
  }

  return next;
}

function addNewSpell(parsed, type) {
  const next = structuredClone(parsed ?? {});
  const suffix = Date.now().toString().slice(-5);

  if (type === "multi") {
    next[`new_multi_${suffix}`] = {
      "spell-class": ".MultiSpell",
      spells: [],
    };
  }

  if (type === "area") {
    next[`new_area_${suffix}`] = {
      "spell-class": ".targeted.AreaEffectSpell",
      "horizontal-radius": 5,
      "vertical-radius": 3,
      "point-blank": true,
      "target-caster": false,
      "target-players": true,
      "target-non-players": true,
      "fail-if-no-targets": false,
      spells: [],
      effects: {},
    };
  }

  if (type === "projectile") {
    next[`new_projectile_${suffix}`] = {
      "spell-class": ".instant.ParticleProjectileSpell",
      "projectile-velocity": 20,
      "tick-interval": 1,
      "max-distance": 20,
      effects: {
        trail:
          {
            position: "special",
            effect: "effectlib",
            effectlib: {
              class: "EquationEffect",
              particle: "crit",
              particles: 12,
              duration: 80,
              orientPitch: false,
              xEquation: "0",
              yEquation: "1.6",
              zEquation: "0.12t",
            },
          },
      },
    };
  }

  return next;
}

function addCalledSpell(parsed, spellName, calledSpellName) {
  const next = structuredClone(parsed);
  const spell = next[spellName];

  if (!spell.spells) spell.spells = [];
  if (!spell.spells.includes(calledSpellName)) {
    spell.spells.push(calledSpellName);
  }

  return next;
}

function buildFlow(parsed) {
  if (!parsed) return { nodes: [], edges: [] };

  const nodes = [];
  const edges = [];
  let spellY = 0;

  for (const [spellName, spell] of Object.entries(parsed)) {
    const spellId = `spell-${spellName}`;
    const classId = `${spellId}-class`;
    const spellClass = spell["spell-class"] ?? "unknown";

    nodes.push({
      id: spellId,
      type: "input",
      position: { x: 0, y: spellY },
      data: {
        label: `Spell: ${spellName}`,
        path: [spellName],
        kind: "spell",
      },
    });

    nodes.push({
      id: classId,
      position: { x: 260, y: spellY },
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

    const calledSpells = spell.spells ?? [];
    let callY = spellY + 90;

    for (const called of calledSpells) {
      const callId = `${spellId}-call-${called}`;

      nodes.push({
        id: callId,
        position: { x: 520, y: callY },
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
          target: `spell-${called}`,
          animated: true,
        });
      }

      callY += 80;
    }

    const effects = spell.effects ?? {};
    let effectY = callY + 40;

    for (const [key, effect] of Object.entries(effects)) {
      const effectId = `${spellId}-effect-${key}`;

      let label = `${key}: ${effect.effect ?? "unknown"}`;
      if (effect.effect === "effectlib") label = `${key}: ${effect.effectlib?.class ?? "effectlib"}`;
      if (effect.effect === "sound") label = `${key}: sound`;

      nodes.push({
        id: effectId,
        position: { x: 260, y: effectY },
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

      effectY += 90;
    }

    spellY += Math.max(260, effectY - spellY + 80);
  }

  return { nodes, edges };
}

function AreaPreview({ areas }) {
  return (
    <>
      {areas.map((area, i) => (
        <mesh key={i} position={[0, area.vertical / 2, 0]}>
          <boxGeometry args={[area.horizontal * 2, area.vertical * 2, area.horizontal * 2]} />
          <meshBasicMaterial color="#00ffff" wireframe transparent opacity={0.25} />
        </mesh>
      ))}
    </>
  );
}

function PlayerPreview() {
  return (
    <group>
      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.6, 1.8, 0.35]} />
        <meshBasicMaterial color="#dddddd" wireframe />
      </mesh>

      <mesh position={[0, 1.6, 0.45]}>
        <coneGeometry args={[0.18, 0.45, 16]} />
        <meshBasicMaterial color="#ffff00" />
      </mesh>
    </group>
  );
}

function EquationDots({ eq, timeRef }) {
  const dots = useMemo(() => Array.from({ length: eq.particles }, (_, i) => i), [eq.particles]);

  return (
    <>
      {dots.map((_, i) => {
        const currentTime = timeRef.current;
        if (currentTime < eq.delay) return null;

        const t = (currentTime - eq.delay + i * 4) % eq.duration;

        try {
          const x = evaluate(eq.x, { t });
          const y = evaluate(eq.y, { t });
          const z = evaluate(eq.z, { t });
          const base = eq.position === "special" ? [0, 1.6, 4] : [0, 0, 0];

          return (
            <mesh key={i} position={[x + base[0], y + base[1], z + base[2]]}>
              <sphereGeometry args={[0.06, 8, 8]} />
              <meshBasicMaterial color={eq.color} transparent opacity={0.95} />
            </mesh>
          );
        } catch {
          return null;
        }
      })}
    </>
  );
}

function ParticlePreview({ equations, playing }) {
  const time = useRef(0);

  useFrame(() => {
    if (playing) time.current += 1;
  });

  return (
    <group>
      {equations.map((eq, i) => (
        <EquationDots key={i} eq={eq} timeRef={time} />
      ))}
      <PlayerPreview />
    </group>
  );
}

function SpecialMarker() {
  return (
    <mesh position={[0, 1.6, 4]}>
      <sphereGeometry args={[0.16, 16, 16]} />
      <meshBasicMaterial color="#ff00ff" wireframe />
    </mesh>
  );
}

function CameraMode({ mode }) {
  const ref = useRef();

  useFrame(({ camera }) => {
    if (mode === "first") {
      camera.position.set(0, 1.6, -0.1);
      camera.lookAt(0, 1.6, 5);
    }

    if (mode === "third") {
      camera.position.set(0, 3, -7);
      camera.lookAt(0, 1.4, 2);
    }
  });

  return mode === "free" ? <OrbitControls ref={ref} /> : null;
}

function Inspector({
  parsed,
  selectedPath,
  onChangeParsed,
  onAddNode,
  onAddNewSpell,
  onAddCalledSpell,
}) {
  if (!parsed) return <div style={{ padding: 10 }}>YAML을 먼저 입력하세요.</div>;

  const spellNames = Object.keys(parsed);
  const firstSpell = spellNames[0];

  function updateSelected(mutator) {
    const next = updateByPath(parsed, selectedPath, (old) => {
      const copy = structuredClone(old);
      mutator(copy);
      return copy;
    });

    onChangeParsed(next);
  }

  if (!selectedPath) {
    return (
      <div style={{ padding: 10 }}>
        <h3>Add Spell</h3>
        <button onClick={() => onAddNewSpell("multi")}>+ New MultiSpell</button>
        <button onClick={() => onAddNewSpell("area")}>+ New AreaEffectSpell</button>
        <button onClick={() => onAddNewSpell("projectile")}>+ New ParticleProjectileSpell</button>

        <h3>Add Effect</h3>
        <button onClick={() => onAddNode(firstSpell, "equation")}>+ EquationEffect</button>
        <button onClick={() => onAddNode(firstSpell, "sound")}>+ Sound</button>
      </div>
    );
  }

  const selected = getByPath(parsed, selectedPath);

  if (!selected) {
    return <div style={{ padding: 10 }}>선택된 데이터를 찾을 수 없음.</div>;
  }

  if (selectedPath.length === 1) {
    const spellName = selectedPath[0];
    const spell = selected;
    const spellClass = spell["spell-class"] ?? "";

    return (
      <div style={{ padding: 10, fontSize: 13 }}>
        <h3>Spell: {spellName}</h3>

        <button onClick={() => onAddNewSpell("multi")}>+ New MultiSpell</button>
        <button onClick={() => onAddNewSpell("area")}>+ New AreaEffectSpell</button>
        <button onClick={() => onAddNewSpell("projectile")}>+ New ParticleProjectileSpell</button>

        <h3>Class</h3>
        <label>spell-class</label>
        <select
          value={spellClass}
          onChange={(ev) => updateSelected((s) => (s["spell-class"] = ev.target.value))}
        >
          {SPELL_CLASSES.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>

        <h3>Called Spells</h3>
        <select
          defaultValue=""
          onChange={(ev) => {
            if (!ev.target.value) return;
            onAddCalledSpell(spellName, ev.target.value);
            ev.target.value = "";
          }}
        >
          <option value="">+ Add Called Spell</option>
          {Object.keys(parsed)
            .filter((name) => name !== spellName)
            .map((name) => (
              <option key={name} value={name}>
                {name}
              </option>
            ))}
        </select>

        <div style={{ marginTop: 8 }}>
          {(spell.spells ?? []).map((called, i) => (
            <div key={i} style={{ color: "#ccc" }}>
              {i + 1}. {called}
            </div>
          ))}
        </div>

        <h3>Effects</h3>
        <button onClick={() => onAddNode(spellName, "equation")}>+ EquationEffect</button>
        <button onClick={() => onAddNode(spellName, "sound")}>+ Sound</button>
      </div>
    );
  }

  if (selected.effect === "effectlib" && selected.effectlib?.class === "EquationEffect") {
    const e = selected.effectlib;

    return (
      <div style={{ padding: 10, fontSize: 13 }}>
        <h3>EquationEffect</h3>

        <button onClick={() => onAddNode(selectedPath[0], "equation")}>+ EquationEffect</button>
        <button onClick={() => onAddNode(selectedPath[0], "sound")}>+ Sound</button>

        <label>position</label>
        <select value={selected.position ?? "caster"} onChange={(ev) => updateSelected((s) => (s.position = ev.target.value))}>
          <option value="caster">caster</option>
          <option value="special">special</option>
          <option value="target">target</option>
        </select>

        <label>particle</label>
        <select value={e.particle ?? "redstone"} onChange={(ev) => updateSelected((s) => (s.effectlib.particle = ev.target.value))}>
          {PARTICLES.map((p) => <option key={p} value={p}>{p}</option>)}
        </select>

        <label>color</label>
        <input value={e.color ?? "ffffff"} onChange={(ev) => updateSelected((s) => (s.effectlib.color = ev.target.value.replace("#", "")))} />

        <label>particles</label>
        <input type="number" value={e.particles ?? 24} onChange={(ev) => updateSelected((s) => (s.effectlib.particles = Number(ev.target.value)))} />

        <label>duration</label>
        <input type="number" value={e.duration ?? 120} onChange={(ev) => updateSelected((s) => (s.effectlib.duration = Number(ev.target.value)))} />

        <label>xEquation</label>
        <input value={e.xEquation ?? ""} onChange={(ev) => updateSelected((s) => (s.effectlib.xEquation = ev.target.value))} />

        <label>yEquation</label>
        <input value={e.yEquation ?? ""} onChange={(ev) => updateSelected((s) => (s.effectlib.yEquation = ev.target.value))} />

        <label>zEquation</label>
        <input value={e.zEquation ?? ""} onChange={(ev) => updateSelected((s) => (s.effectlib.zEquation = ev.target.value))} />
      </div>
    );
  }

  if (selected.effect === "sound") {
    return (
      <div style={{ padding: 10, fontSize: 13 }}>
        <h3>Sound</h3>

        <button onClick={() => onAddNode(selectedPath[0], "equation")}>+ EquationEffect</button>
        <button onClick={() => onAddNode(selectedPath[0], "sound")}>+ Sound</button>

        <label>position</label>
        <select value={selected.position ?? "caster"} onChange={(ev) => updateSelected((s) => (s.position = ev.target.value))}>
          <option value="caster">caster</option>
          <option value="special">special</option>
          <option value="target">target</option>
        </select>

        <label>sound</label>
        <select value={selected.sound ?? SOUNDS[0]} onChange={(ev) => updateSelected((s) => (s.sound = ev.target.value))}>
          {SOUNDS.map((sound) => <option key={sound} value={sound}>{sound}</option>)}
        </select>

        <label>volume</label>
        <input type="number" step="0.1" value={selected.volume ?? 1} onChange={(ev) => updateSelected((s) => (s.volume = Number(ev.target.value)))} />

        <label>pitch</label>
        <input type="number" step="0.1" value={selected.pitch ?? 1} onChange={(ev) => updateSelected((s) => (s.pitch = Number(ev.target.value)))} />

        <label>delay</label>
        <input type="number" value={selected.delay ?? 0} onChange={(ev) => updateSelected((s) => (s.delay = Number(ev.target.value)))} />
      </div>
    );
  }

  return (
    <div style={{ padding: 10 }}>
      <h3>Raw Node</h3>
      <pre>{JSON.stringify(selected, null, 2)}</pre>
    </div>
  );
}

export default function App() {
  const [yamlText, setYamlText] = useState(sampleYaml);
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState("third");
  const [selectedPath, setSelectedPath] = useState(null);

  const parseResult = useMemo(() => {
    try {
      return { data: YAML.load(yamlText), error: null };
    } catch (e) {
      return { data: null, error: e.message };
    }
  }, [yamlText]);

  const parsed = parseResult.data;
  const equations = useMemo(() => findEquations(parsed), [parsed]);
  const areas = useMemo(() => findAreas(parsed), [parsed]);
  const sounds = useMemo(() => findSounds(parsed), [parsed]);
  const flow = useMemo(() => buildFlow(parsed), [parsed]);

  function applyParsed(nextParsed) {
    setYamlText(YAML.dump(nextParsed, { lineWidth: -1, noRefs: true }));
  }

  function handleAddNode(spellName, type) {
    if (!parsed || !spellName) return;
    applyParsed(addEffect(parsed, spellName, type));
  }

  function handleAddNewSpell(type) {
    applyParsed(addNewSpell(parsed, type));
  }

  function handleAddCalledSpell(spellName, calledSpellName) {
    if (!parsed || !spellName || !calledSpellName) return;
    applyParsed(addCalledSpell(parsed, spellName, calledSpellName));
  }

  return (
    <PanelGroup direction="horizontal" style={{ height: "100vh", background: "#111", color: "white" }}>
      <style>{`
        button, select, input {
          background: #222;
          color: white;
          border: 1px solid #555;
          padding: 6px;
          margin: 4px 0;
        }
        label {
          display: block;
          margin-top: 10px;
          color: #aaa;
        }
        input, select {
          width: 100%;
          box-sizing: border-box;
        }
        .react-flow__node {
          background: #222;
          color: white;
          border: 1px solid #555;
          border-radius: 8px;
          padding: 8px;
        }
        .react-flow__node.selected {
          border: 2px solid #00ffff;
        }
        .resize-handle {
          width: 6px;
          background: #333;
          cursor: col-resize;
        }
        .resize-handle:hover {
          background: #00ffff;
        }
      `}</style>

      <Panel defaultSize={32} minSize={20}>
        <div style={{ height: "100%", padding: 12, overflow: "auto" }}>
          <h2>MagicSpells Studio</h2>

          <CodeMirror
            value={yamlText}
            height="58vh"
            theme={oneDark}
            extensions={[yaml()]}
            onChange={(value) => setYamlText(value)}
            basicSetup={{
              lineNumbers: true,
              foldGutter: true,
              highlightActiveLine: true,
              autocompletion: true,
              bracketMatching: true,
            }}
          />

          {parseResult.error && (
            <div style={{ color: "#ff7777", marginTop: 8 }}>
              YAML Error: {parseResult.error}
            </div>
          )}

          <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
            <button onClick={() => setMode("first")}>1인칭</button>
            <button onClick={() => setMode("third")}>3인칭</button>
            <button onClick={() => setMode("free")}>자유시점</button>
          </div>

          <p>EquationEffect: {equations.length}개</p>
          <p>AreaEffectSpell: {areas.length}개</p>
          <p>Sound: {sounds.length}개</p>
        </div>
      </Panel>

      <PanelResizeHandle className="resize-handle" />

      <Panel defaultSize={24} minSize={15}>
        <div style={{ height: "100%", background: "#181818" }}>
          <ReactFlow
            nodes={flow.nodes}
            edges={flow.edges}
            fitView
            onNodeClick={(_, node) => {
              if (node.data.kind === "call" && parsed?.[node.data.targetSpell]) {
                setSelectedPath([node.data.targetSpell]);
                return;
              }

              setSelectedPath(node.data.path);
            }}
          >
            <Background />
            <Controls />
          </ReactFlow>
        </div>
      </Panel>

      <PanelResizeHandle className="resize-handle" />

      <Panel defaultSize={20} minSize={15}>
        <div style={{ height: "100%", background: "#151515", overflow: "auto" }}>
          <Inspector
            parsed={parsed}
            selectedPath={selectedPath}
            onChangeParsed={applyParsed}
            onAddNode={handleAddNode}
            onAddNewSpell={handleAddNewSpell}
            onAddCalledSpell={handleAddCalledSpell}
          />
        </div>
      </Panel>

      <PanelResizeHandle className="resize-handle" />

      <Panel defaultSize={24} minSize={20}>
        <div style={{ height: "100%" }}>
          <Canvas camera={{ position: [0, 3, -7], fov: 75 }}>
            <ambientLight />
            <gridHelper args={[24, 24]} />
            <axesHelper args={[5]} />
            <AreaPreview areas={areas} />
            <SpecialMarker />
            <ParticlePreview equations={equations} playing={playing} />
            <CameraMode mode={mode} />
          </Canvas>
        </div>
      </Panel>
    </PanelGroup>
  );
}