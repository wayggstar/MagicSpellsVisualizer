import CodeMirror from "@uiw/react-codemirror";
import { yaml } from "@codemirror/lang-yaml";
import { oneDark } from "@codemirror/theme-one-dark";
import { ToolbarButton } from "./ToolbarButton";

export function EditorPanel({
  yamlText,
  onYamlTextChange,
  parseError,
  counts,
  playing,
  cameraMode,
  onTogglePlaying,
  onSetCameraMode,
}) {
  return (
    <section className="panel editor-panel" aria-label="YAML editor">
      <div className="panel-header">
        <div>
          <p className="eyebrow">MagicSpells Studio</p>
          <h1>Spell YAML Workspace</h1>
        </div>
        <span className={parseError ? "status-pill status-pill--error" : "status-pill"}>{parseError ? "YAML error" : "Ready"}</span>
      </div>

      <CodeMirror
        value={yamlText}
        height="54vh"
        theme={oneDark}
        extensions={[yaml()]}
        onChange={onYamlTextChange}
        basicSetup={{
          lineNumbers: true,
          foldGutter: true,
          highlightActiveLine: true,
          autocompletion: true,
          bracketMatching: true,
        }}
      />

      {parseError && <div className="error-box">YAML Error: {parseError}</div>}

      <div className="tool-row" aria-label="Preview controls">
        <ToolbarButton icon={playing ? "II" : ">" } onClick={onTogglePlaying}>
          {playing ? "Pause" : "Play"}
        </ToolbarButton>
        <ToolbarButton icon="1P" isActive={cameraMode === "first"} onClick={() => onSetCameraMode("first")}>
          1인칭
        </ToolbarButton>
        <ToolbarButton icon="3P" isActive={cameraMode === "third"} onClick={() => onSetCameraMode("third")}>
          3인칭
        </ToolbarButton>
        <ToolbarButton icon="360" isActive={cameraMode === "free"} onClick={() => onSetCameraMode("free")}>
          자유시점
        </ToolbarButton>
      </div>

      <div className="stat-grid">
        <div>
          <strong>{counts.equations}</strong>
          <span>EquationEffect</span>
        </div>
        <div>
          <strong>{counts.areas}</strong>
          <span>AreaEffectSpell</span>
        </div>
        <div>
          <strong>{counts.sounds}</strong>
          <span>Sound</span>
        </div>
      </div>
    </section>
  );
}

