import { OrbitControls } from "@react-three/drei";
import { Canvas, useFrame } from "@react-three/fiber";
import { evaluate } from "mathjs";
import { useMemo, useRef } from "react";

function AreaPreview({ areas }) {
  return (
    <>
      {areas.map((area, index) => (
        <mesh key={`${area.horizontal}-${area.vertical}-${index}`} position={[0, area.vertical / 2, 0]}>
          <boxGeometry args={[area.horizontal * 2, area.vertical * 2, area.horizontal * 2]} />
          <meshBasicMaterial color="#33d9ff" wireframe transparent opacity={0.3} />
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
        <meshBasicMaterial color="#f3f7fb" wireframe />
      </mesh>
      <mesh position={[0, 1.6, 0.45]}>
        <coneGeometry args={[0.18, 0.45, 16]} />
        <meshBasicMaterial color="#ffdf4d" />
      </mesh>
    </group>
  );
}

function SpecialMarker() {
  return (
    <mesh position={[0, 1.6, 4]}>
      <sphereGeometry args={[0.16, 16, 16]} />
      <meshBasicMaterial color="#ff5ebc" wireframe />
    </mesh>
  );
}

function EquationDots({ eq, timeRef }) {
  const dots = useMemo(() => Array.from({ length: Math.max(0, eq.particles) }), [eq.particles]);

  return (
    <>
      {dots.map((_, index) => {
        const currentTime = timeRef.current;
        if (currentTime < eq.delay) return null;

        const t = (currentTime - eq.delay + index * 4) % Math.max(1, eq.duration);

        try {
          const x = evaluate(eq.x, { t });
          const y = evaluate(eq.y, { t });
          const z = evaluate(eq.z, { t });
          const base = eq.position === "special" ? [0, 1.6, 4] : [0, 0, 0];

          return (
            <mesh key={index} position={[x + base[0], y + base[1], z + base[2]]}>
              <sphereGeometry args={[0.065, 10, 10]} />
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
      {equations.map((eq, index) => (
        <EquationDots key={`${eq.particle}-${index}`} eq={eq} timeRef={time} />
      ))}
      <PlayerPreview />
    </group>
  );
}

function CameraMode({ mode }) {
  const controlsRef = useRef();

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

  return mode === "free" ? <OrbitControls ref={controlsRef} makeDefault /> : null;
}

export function PreviewScene({ areas, equations, playing, cameraMode }) {
  return (
    <Canvas camera={{ position: [0, 3, -7], fov: 75 }} className="preview-canvas">
      <color attach="background" args={["#101217"]} />
      <ambientLight intensity={0.9} />
      <gridHelper args={[24, 24, "#4b5563", "#242a33"]} />
      <axesHelper args={[5]} />
      <AreaPreview areas={areas} />
      <SpecialMarker />
      <ParticlePreview equations={equations} playing={playing} />
      <CameraMode mode={cameraMode} />
    </Canvas>
  );
}

