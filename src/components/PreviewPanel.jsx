import { PreviewScene } from "./PreviewScene";

export function PreviewPanel({ areas, equations, imageEffects, effectLibShapes, playing, cameraMode }) {
  return (
    <section className="panel preview-panel" aria-label="3D particle preview">
      <div className="panel-strip">
        <span>3D Preview</span>
      </div>
      <PreviewScene
        areas={areas}
        equations={equations}
        imageEffects={imageEffects}
        effectLibShapes={effectLibShapes}
        playing={playing}
        cameraMode={cameraMode}
      />
    </section>
  );
}
