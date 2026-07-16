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

function ImageEffectPreview({ imageEffects }) {
  return (
    <group>
      {imageEffects.map((image, imageIndex) => {
        const rows = image.invert ? image.pixels.map((row) => row.replace(/[01]/g, (char) => (char === "1" ? "0" : "1"))) : image.pixels;
        const maxWidth = Math.max(...rows.map((row) => row.length));
        const spacing = Math.max(0.16, image.stepX * image.size * 0.45);
        const ySpacing = Math.max(0.16, image.stepY * image.size * 0.45);
        const base = image.position === "special" ? [0, 2.1, 4] : [0, 2.6 + imageIndex * 1.4, 0];

        return rows.flatMap((row, rowIndex) =>
          [...row].map((pixel, colIndex) => {
            if (pixel !== "1") return null;

            const x = base[0] + (colIndex - (maxWidth - 1) / 2) * spacing;
            const y = base[1] + ((rows.length - 1) / 2 - rowIndex) * ySpacing;
            const z = base[2] + imageIndex * 0.12;
            const pixelColor = ["ColoredImage", "ColoredImageEffect"].includes(image.className)
              ? image.pixelColors?.[rowIndex]?.[colIndex] ?? image.color
              : image.color;

            return (
              <mesh key={`${image.fileName}-${imageIndex}-${rowIndex}-${colIndex}`} position={[x, y, z]}>
                <sphereGeometry args={[Math.max(0.035, image.size * 0.75), 8, 8]} />
                <meshBasicMaterial color={pixelColor} transparent opacity={0.95} />
              </mesh>
            );
          }),
        );
      })}
    </group>
  );
}

function shapeBase(shape, index) {
  if (shape.position === "special" || shape.position === "projectile") return [0, shape.yOffset, 4];
  if (shape.position === "target") return [2.6, shape.yOffset, 2.4];
  return [0, shape.yOffset + index * 0.25, 0];
}

function pointForShape(shape, index, total) {
  const ratio = total <= 1 ? 0 : index / (total - 1);
  const angle = ratio * Math.PI * 2;
  const className = shape.className;

  if (["Circle", "Heart", "Love", "Donut", "Star"].includes(className)) {
    return [Math.cos(angle) * shape.radius, 0, Math.sin(angle) * shape.radius];
  }

  if (["Sphere", "Shield", "Atom"].includes(className)) {
    const phi = Math.acos(1 - 2 * ratio);
    const theta = Math.PI * (1 + 5 ** 0.5) * index;
    const y = Math.cos(phi) * shape.radius;
    const ring = Math.sin(phi) * shape.radius;
    if (!shape.sphere && y < 0) return null;
    return [Math.cos(theta) * ring, shape.reverse ? -y : y, Math.sin(theta) * ring];
  }

  if (["Helix", "Tornado", "Vortex", "Warp"].includes(className)) {
    const y = ratio * shape.height;
    const radius = className === "Tornado" ? shape.radius * (1 - ratio * 0.75) : shape.radius;
    return [Math.cos(angle * 4) * radius, y, Math.sin(angle * 4) * radius];
  }

  if (className === "Cone") {
    const y = ratio * shape.length;
    const radius = shape.radius * ratio;
    return [Math.cos(angle * 5) * radius, y, Math.sin(angle * 5) * radius];
  }

  if (["Cube", "Cuboid", "Grid"].includes(className)) {
    const edge = shape.edgeLength / 2;
    const side = Math.floor(index / Math.max(1, total / 12));
    const sideRatio = (index % Math.max(1, Math.floor(total / 12))) / Math.max(1, Math.floor(total / 12));
    const line = -edge + sideRatio * shape.edgeLength;
    const corners = [
      [line, -edge, -edge], [line, -edge, edge], [line, edge, -edge], [line, edge, edge],
      [-edge, line, -edge], [-edge, line, edge], [edge, line, -edge], [edge, line, edge],
      [-edge, -edge, line], [-edge, edge, line], [edge, -edge, line], [edge, edge, line],
    ];
    return corners[side % corners.length];
  }

  if (className === "Cylinder") {
    const y = ratio * shape.height;
    return [Math.cos(angle * 3) * shape.radius, y, Math.sin(angle * 3) * shape.radius];
  }

  if (["Line", "Trace", "Arc"].includes(className)) {
    return [0, 1.4, ratio * shape.length];
  }

  if (className === "Text") {
    const chars = [...shape.text].slice(0, 8);
    const charIndex = index % Math.max(1, chars.length);
    const row = Math.floor(index / Math.max(1, chars.length));
    return [(charIndex - chars.length / 2) * shape.size * 5, row * shape.size, 0];
  }

  return [Math.cos(angle) * shape.radius, ratio * Math.max(1, shape.height), Math.sin(angle) * shape.radius];
}

function EffectLibShapePreview({ shapes }) {
  return (
    <group>
      {shapes.map((shape, shapeIndex) => {
        const count = Math.min(220, Math.max(8, shape.particles));
        const base = shapeBase(shape, shapeIndex);

        return Array.from({ length: count }).map((_, index) => {
          const point = pointForShape(shape, index, count);
          if (!point) return null;

          return (
            <mesh
              key={`${shape.className}-${shapeIndex}-${index}`}
              position={[base[0] + point[0], base[1] + point[1], base[2] + point[2]]}
            >
              <sphereGeometry args={[Math.max(0.035, shape.size * 0.55), 8, 8]} />
              <meshBasicMaterial color={shape.color} transparent opacity={0.92} />
            </mesh>
          );
        });
      })}
    </group>
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

export function PreviewScene({ areas, equations, imageEffects, effectLibShapes, playing, cameraMode }) {
  return (
    <Canvas camera={{ position: [0, 3, -7], fov: 75 }} className="preview-canvas">
      <color attach="background" args={["#101217"]} />
      <ambientLight intensity={0.9} />
      <gridHelper args={[24, 24, "#4b5563", "#242a33"]} />
      <axesHelper args={[5]} />
      <AreaPreview areas={areas} />
      <SpecialMarker />
      <EffectLibShapePreview shapes={effectLibShapes} />
      <ImageEffectPreview imageEffects={imageEffects} />
      <ParticlePreview equations={equations} playing={playing} />
      <CameraMode mode={cameraMode} />
    </Canvas>
  );
}
