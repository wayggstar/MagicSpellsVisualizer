import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as YAML from "js-yaml";
import { evaluate } from "mathjs";

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
      0:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: redstone
            color: 000000
            particles: 24
            duration: 240
            orientPitch: false
            xEquation: "3.5sin(0.08t)+0.8"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      1:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: redstone
            color: 800020
            particles: 24
            duration: 240
            orientPitch: false
            xEquation: "3.5sin(0.08t)+0.6"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      2:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: redstone
            color: 800020
            particles: 24
            duration: 240
            orientPitch: false
            xEquation: "3.5sin(0.08t)+0.4"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      3:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: redstone
            color: 4C4C4C
            particles: 24
            duration: 240
            orientPitch: false
            xEquation: "3.5sin(0.08t)+0.2"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      4:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: redstone
            color: 4C4C4C
            particles: 24
            duration: 240
            orientPitch: false
            xEquation: "3.5sin(0.08t)"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      4_2:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: redstone
            speed: 0.2
            color: 000000
            particles: 24
            duration: 240
            orientPitch: false
            xEquation: "3.5sin(0.08t)"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      5:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: redstone
            color: 4C4C4C
            particles: 24
            duration: 240
            orientPitch: false
            xEquation: "3.5sin(0.08t)-0.2"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      6:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: redstone
            color: 4C4C4C
            particles: 24
            duration: 240
            orientPitch: false
            xEquation: "3.5sin(0.08t)-0.4"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      7:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: smoke
            color: 000000
            particles: 24
            duration: 100
            orientPitch: false
            xEquation: "3.5sin(0.08t)-0.4"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      1s:
        position: caster
        effect: sound
        sound: entity.wither.shoot
        volume: 1
        pitch: 0.6
        delay: 2
      2s:
        position: caster
        effect: sound
        sound: entity.blaze.hurt
        volume: 1
        pitch: 0.4
      3s:
        position: caster
        effect: sound
        sound: entity.blaze.shoot
        volume: 1
        pitch: 1.2
`;

function normalize(expr) {
  return String(expr)
    .replace(/(\d)(sin|cos|tan)/g, "$1*$2")
    .replace(/(\d)t/g, "$1*t")
    .replace(/\)(\d)/g, ")*$1")
    .replace(/t(\d)/g, "t*$1");
}

function parseColor(color, particle) {
  if (particle === "smoke") return "#555555";
  if (particle === "flame") return "#ff6600";
  if (particle === "cloud") return "#eeeeee";

  if (!color) return "#ffffff";

  const text = String(color).replace("#", "").trim();

  if (/^[0-9a-fA-F]{6}$/.test(text)) {
    return `#${text}`;
  }

  return "#ffffff";
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

  for (const value of Object.values(obj)) {
    findEquations(value, result);
  }

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
      pointBlank: Boolean(obj["point-blank"]),
    });
  }

  for (const value of Object.values(obj)) {
    findAreas(value, result);
  }

  return result;
}

function findSounds(obj, result = []) {
  if (!obj || typeof obj !== "object") return result;

  if (obj.effect === "sound" && obj.sound) {
    result.push({
      sound: obj.sound,
      delay: Number(obj.delay ?? 0),
      volume: Number(obj.volume ?? 1),
      pitch: Number(obj.pitch ?? 1),
      position: obj.position ?? "caster",
    });
  }

  for (const value of Object.values(obj)) {
    findSounds(value, result);
  }

  return result;
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

function EquationDots({ eq, timeRef }) {
  const dots = useMemo(() => {
    return Array.from({ length: eq.particles }, (_, i) => i);
  }, [eq.particles]);

  return (
    <>
      {dots.map((_, i) => {
        const currentTime = timeRef.current;

        if (currentTime < eq.delay) return null;

        const t = (currentTime - eq.delay + i * 4) % eq.duration;

        let x = 0;
        let y = 0;
        let z = 0;

        try {
          x = evaluate(eq.x, { t });
          y = evaluate(eq.y, { t });
          z = evaluate(eq.z, { t });
        } catch {
          return null;
        }

        const base = eq.position === "special" ? [0, 1.6, 4] : [0, 0, 0];

        return (
          <mesh key={i} position={[x + base[0], y + base[1], z + base[2]]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color={eq.color} transparent opacity={0.95} />
          </mesh>
        );
      })}
    </>
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

export default function App() {
  const [yamlText, setYamlText] = useState(sampleYaml);
  const [playing, setPlaying] = useState(true);
  const [mode, setMode] = useState("third");

  const parsed = useMemo(() => {
    try {
      return YAML.load(yamlText);
    } catch {
      return null;
    }
  }, [yamlText]);

  const equations = useMemo(() => findEquations(parsed), [parsed]);
  const areas = useMemo(() => findAreas(parsed), [parsed]);
  const sounds = useMemo(() => findSounds(parsed), [parsed]);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#111", color: "white" }}>
      <div style={{ width: "42%", padding: 12, overflow: "auto" }}>
        <h2>MagicSpells Visualizer</h2>

        <textarea
          value={yamlText}
          onChange={(e) => setYamlText(e.target.value)}
          style={{
            width: "100%",
            height: "68vh",
            background: "#1e1e1e",
            color: "#ddd",
            fontFamily: "monospace",
            fontSize: 13,
          }}
        />

        <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button onClick={() => setPlaying(!playing)}>{playing ? "Pause" : "Play"}</button>
          <button onClick={() => setMode("first")}>1인칭</button>
          <button onClick={() => setMode("third")}>3인칭</button>
          <button onClick={() => setMode("free")}>자유시점</button>
        </div>

        <p>EquationEffect: {equations.length}개</p>
        <p>AreaEffectSpell: {areas.length}개</p>
        <p>Sound: {sounds.length}개</p>

        <div>
          {equations.map((eq, i) => (
            <div key={i} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 14,
                  height: 14,
                  background: eq.color,
                  display: "inline-block",
                  border: "1px solid white",
                }}
              />
              <span>
                {i + 1}. {eq.particle} / {eq.position} / {eq.color}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ flex: 1 }}>
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
    </div>
  );
}