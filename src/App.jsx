import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { useMemo, useRef, useState } from "react";
import * as YAML from "js-yaml";
import { evaluate } from "mathjs";

const sampleYaml = `
하델링_좌클릭pp1:
  effects:
    0:
      position: caster
      effect: effectlib
      effectlib:
        class: EquationEffect
        particle: redstone
        color: 800020
        particles: 24
        duration: 240
        xEquation: "3.5sin(0.08t)"
        yEquation: "1.5cos(0.08t)+1.6"
        zEquation: "2.4cos(0.08t)"
`;

function normalize(expr) {
  return expr
    .replaceAll("sin", "sin")
    .replaceAll("cos", "cos")
    .replaceAll("tan", "tan")
    .replace(/(\d)(sin|cos|tan)/g, "$1*$2")
    .replace(/\)(\d)/g, ")*$1");
}

function findEquations(obj, result = []) {
  if (!obj || typeof obj !== "object") return result;

  if (obj.class === "EquationEffect" && obj.xEquation && obj.yEquation && obj.zEquation) {
    result.push({
      color: "#" + (obj.color ?? "ffffff"),
      particles: obj.particles ?? 24,
      duration: obj.duration ?? 120,
      x: normalize(obj.xEquation),
      y: normalize(obj.yEquation),
      z: normalize(obj.zEquation),
    });
  }

  for (const value of Object.values(obj)) {
    findEquations(value, result);
  }

  return result;
}

function ParticlePreview({ equations, playing }) {
  const group = useRef();
  const time = useRef(0);

  useFrame(() => {
    if (playing) time.current += 1;
    if (group.current) {
      group.current.userData.t = time.current;
    }
  });

  return (
    <group ref={group}>
      {equations.map((eq, i) => (
        <EquationDots key={i} eq={eq} timeRef={time} />
      ))}

      <mesh position={[0, 0.9, 0]}>
        <boxGeometry args={[0.6, 1.8, 0.35]} />
        <meshBasicMaterial color="#dddddd" wireframe />
      </mesh>
    </group>
  );
}

function EquationDots({ eq, timeRef }) {
  const dots = useMemo(() => {
    const arr = [];

    for (let i = 0; i < eq.particles; i++) {
      arr.push(i);
    }

    return arr;
  }, [eq.particles]);

  return (
    <>
      {dots.map((_, i) => {
        let t = (timeRef.current + i * 4) % eq.duration;

        let x = 0, y = 0, z = 0;
        try {
          x = evaluate(eq.x, { t });
          y = evaluate(eq.y, { t });
          z = evaluate(eq.z, { t });
        } catch {}

        return (
          <mesh key={i} position={[x, y, z]}>
            <sphereGeometry args={[0.06, 8, 8]} />
            <meshBasicMaterial color={eq.color} />
          </mesh>
        );
      })}
    </>
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

  const equations = useMemo(() => {
    try {
      const parsed = YAML.load(yamlText);
      return findEquations(parsed);
    } catch {
      return [];
    }
  }, [yamlText]);

  return (
    <div style={{ display: "flex", height: "100vh", background: "#111", color: "white" }}>
      <div style={{ width: "42%", padding: 12 }}>
        <h2>MagicSpells Equation Previewer</h2>

        <textarea
          value={yamlText}
          onChange={(e) => setYamlText(e.target.value)}
          style={{
            width: "100%",
            height: "75vh",
            background: "#1e1e1e",
            color: "#ddd",
            fontFamily: "monospace",
            fontSize: 13,
          }}
        />

        <div style={{ marginTop: 10 }}>
          <button onClick={() => setPlaying(!playing)}>
            {playing ? "Pause" : "Play"}
          </button>

          <button onClick={() => setMode("first")}>1인칭</button>
          <button onClick={() => setMode("third")}>3인칭</button>
          <button onClick={() => setMode("free")}>자유시점</button>
        </div>

        <p>EquationEffect 감지됨: {equations.length}개</p>
      </div>

      <div style={{ flex: 1 }}>
        <Canvas camera={{ position: [0, 3, -7], fov: 75 }}>
          <ambientLight />
          <gridHelper args={[20, 20]} />
          <axesHelper args={[5]} />
          <ParticlePreview equations={equations} playing={playing} />
          <CameraMode mode={mode} />
        </Canvas>
      </div>
    </div>
  );
}