import * as YAML from "js-yaml";
import { useEffect, useMemo, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import "./App.css";
import { EditorPanel } from "./components/EditorPanel";
import { FlowPanel } from "./components/FlowPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { sampleYaml } from "./data/sampleYaml";
import { buildSpellFlow } from "./lib/flowModel";
import {
  addCalledSpell,
  addEffect,
  addEffectPreset,
  addNewSpell,
  collectAreas,
  collectEquations,
  collectImageEffects,
  collectSounds,
  isRecord,
  validateSpellConfig,
} from "./lib/spellModel";

const USER_EFFECT_PRESETS_KEY = "magicspellsvisualizer.effectPresets.v1";
const IMAGE_PREVIEW_ASSETS_KEY = "magicspellsvisualizer.imagePreviewAssets.v1";

function loadLocalStorageValue(key, fallback) {
  try {
    if (typeof window === "undefined") return fallback;
    const raw = window.localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export default function App() {
  const [yamlText, setYamlText] = useState(sampleYaml);
  const [playing, setPlaying] = useState(true);
  const [cameraMode, setCameraMode] = useState("third");
  const [selectedPath, setSelectedPath] = useState(null);
  const [userEffectPresets, setUserEffectPresets] = useState(() => {
    const presets = loadLocalStorageValue(USER_EFFECT_PRESETS_KEY, []);
    return Array.isArray(presets) ? presets : [];
  });
  const [imagePreviewAssets, setImagePreviewAssets] = useState(() => {
    const assets = loadLocalStorageValue(IMAGE_PREVIEW_ASSETS_KEY, {});
    return isRecord(assets) ? assets : {};
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(USER_EFFECT_PRESETS_KEY, JSON.stringify(userEffectPresets));
    } catch {
      // Presets are optional convenience data; YAML editing still works if browser storage is unavailable.
    }
  }, [userEffectPresets]);

  useEffect(() => {
    try {
      window.localStorage.setItem(IMAGE_PREVIEW_ASSETS_KEY, JSON.stringify(imagePreviewAssets));
    } catch {
      // Image previews are convenience data; YAML remains valid without them.
    }
  }, [imagePreviewAssets]);

  const parseResult = useMemo(() => {
    try {
      const data = YAML.load(yamlText);

      if (data === null || data === undefined) return { data: null, error: null };
      if (!isRecord(data)) return { data: null, error: "Root YAML must be a spell map." };

      return { data, error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }, [yamlText]);

  const parsed = parseResult.data;
  const equations = useMemo(() => collectEquations(parsed), [parsed]);
  const imageEffects = useMemo(() => collectImageEffects(parsed, imagePreviewAssets), [parsed, imagePreviewAssets]);
  const areas = useMemo(() => collectAreas(parsed), [parsed]);
  const sounds = useMemo(() => collectSounds(parsed), [parsed]);
  const flow = useMemo(() => buildSpellFlow(parsed), [parsed]);
  const diagnostics = useMemo(() => validateSpellConfig(parsed), [parsed]);

  function applyParsed(nextParsed) {
    setYamlText(YAML.dump(nextParsed, { lineWidth: -1, noRefs: true }));
  }

  function handleAddEffect(spellName, type) {
    if (!parsed || !spellName) return;
    applyParsed(addEffect(parsed, spellName, type));
  }

  function handleAddEffectPreset(spellName, preset) {
    if (!parsed || !spellName || !preset?.effect) return;
    applyParsed(addEffectPreset(parsed, spellName, preset));
  }

  function handleAddNewSpell(type) {
    applyParsed(addNewSpell(parsed, type));
  }

  function handleAddCalledSpell(spellName, calledSpellName) {
    if (!parsed || !spellName || !calledSpellName) return;
    applyParsed(addCalledSpell(parsed, spellName, calledSpellName));
  }

  function handleSaveEffectPreset(name, effect) {
    const trimmedName = name.trim() || "Untitled Effect";
    const className = effect.effect === "effectlib" ? effect.effectlib?.class : effect.effect;

    setUserEffectPresets((presets) => [
      {
        id: `effect-${Date.now()}`,
        name: trimmedName,
        type: className ?? "effect",
        createdAt: new Date().toISOString(),
        effect: structuredClone(effect),
      },
      ...presets,
    ]);
  }

  function handleDeleteEffectPreset(id) {
    setUserEffectPresets((presets) => presets.filter((preset) => preset.id !== id));
  }

  function handleSaveImagePreview(fileName, previewAsset) {
    if (!fileName || !previewAsset?.pixels) return;
    setImagePreviewAssets((assets) => ({
      ...assets,
      [fileName]: previewAsset,
    }));
  }

  return (
    <main className="app-shell">
      <Group orientation="horizontal" className="workspace">
        <Panel defaultSize={32} minSize={24}>
          <EditorPanel
            yamlText={yamlText}
            onYamlTextChange={setYamlText}
            parseError={parseResult.error}
            counts={{
              equations: equations.length,
              images: imageEffects.length,
              areas: areas.length,
              sounds: sounds.length,
            }}
            diagnostics={diagnostics}
            playing={playing}
            cameraMode={cameraMode}
            onTogglePlaying={() => setPlaying((value) => !value)}
            onSetCameraMode={setCameraMode}
          />
        </Panel>

        <Separator className="resize-handle" />

        <Panel defaultSize={25} minSize={16}>
          <FlowPanel flow={flow} parsed={parsed} onSelectPath={setSelectedPath} />
        </Panel>

        <Separator className="resize-handle" />

        <Panel defaultSize={19} minSize={16}>
          <InspectorPanel
            parsed={parsed}
            selectedPath={selectedPath}
            onChangeParsed={applyParsed}
            onAddEffect={handleAddEffect}
            onAddEffectPreset={handleAddEffectPreset}
            onAddNewSpell={handleAddNewSpell}
            onAddCalledSpell={handleAddCalledSpell}
            onSaveEffectPreset={handleSaveEffectPreset}
            onDeleteEffectPreset={handleDeleteEffectPreset}
            onSaveImagePreview={handleSaveImagePreview}
            imagePreviewAssets={imagePreviewAssets}
            userEffectPresets={userEffectPresets}
            diagnostics={diagnostics}
          />
        </Panel>

        <Separator className="resize-handle" />

        <Panel defaultSize={24} minSize={20}>
          <PreviewPanel
            areas={areas}
            equations={equations}
            imageEffects={imageEffects}
            playing={playing}
            cameraMode={cameraMode}
          />
        </Panel>
      </Group>
    </main>
  );
}
