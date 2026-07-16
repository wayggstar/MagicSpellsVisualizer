import * as YAML from "js-yaml";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Group, Panel, Separator } from "react-resizable-panels";
import "./App.css";
import { AiBuilderPanel } from "./components/AiBuilderPanel";
import { EditorPanel } from "./components/EditorPanel";
import { FlowPanel } from "./components/FlowPanel";
import { InspectorPanel } from "./components/InspectorPanel";
import { PreviewPanel } from "./components/PreviewPanel";
import { SpellDatabasePanel } from "./components/SpellDatabasePanel";
import { ToolbarButton } from "./components/ToolbarButton";
import { sampleYaml } from "./data/sampleYaml";
import { buildSpellFlow } from "./lib/flowModel";
import { listSpellPacks, packsToRagExamples } from "./lib/spellDatabase";
import {
  addCalledSpell,
  addEffect,
  addEffectPreset,
  addNewSpell,
  collectAreas,
  collectEffectLibShapes,
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

function HomeScreen({ onOpenBuilder, onOpenDatabase, onOpenVisualizer }) {
  return (
    <main className="home-shell">
      <section className="home-hero">
        <div className="home-hero__copy">
          <p className="eyebrow">MagicSpells Studio</p>
          <h1>매펠을 설계하고, 구조를 보고, YAML까지 뽑는 작업실</h1>
          <p>
            Visualizer는 직접 YAML을 만지는 공간이고, AI Builder는 아이템/클릭 구상도를 입력하면 RAG 예제 기반으로 구조와 코드 초안을 만들어주는 실험실이야.
          </p>
        </div>
        <div className="home-actions">
          <button type="button" className="home-choice" onClick={onOpenDatabase}>
            <strong>Spell Database</strong>
            <span>배포팩/YAML을 이 기기에 저장하고 실제 스펠 구조를 검색</span>
          </button>
          <button type="button" className="home-choice" onClick={onOpenBuilder}>
            <strong>AI Builder</strong>
            <span>아이템, 우클릭, 좌클릭, 쉬좌, 쉬우, 쉬쉬 입력으로 매펠 초안 생성</span>
          </button>
          <button type="button" className="home-choice" onClick={onOpenVisualizer}>
            <strong>Visualizer</strong>
            <span>YAML 편집, 그래프 구조 확인, EffectLib/이미지 파티클 미리보기</span>
          </button>
        </div>
      </section>
      <section className="home-strip home-strip--four">
        <div><strong>Local DB</strong><span>원본 YAML은 서버가 아닌 브라우저에만 저장</span></div>
        <div><strong>RAG</strong><span>예제를 추가할수록 로컬 검색 자료가 축적됨</span></div>
        <div><strong>Structure</strong><span>공개 스펠과 helper-spell 체인을 먼저 구성</span></div>
        <div><strong>YAML</strong><span>생성 결과를 바로 Visualizer에서 검증</span></div>
      </section>
    </main>
  );
}

function VisualizerWorkspace({ yamlText, setYamlText, imagePreviewAssets, setImagePreviewAssets, onOpenBuilder, onOpenDatabase, onOpenHome }) {
  const [playing, setPlaying] = useState(true);
  const [cameraMode, setCameraMode] = useState("third");
  const [selectedPath, setSelectedPath] = useState(null);
  const [userEffectPresets, setUserEffectPresets] = useState(() => {
    const presets = loadLocalStorageValue(USER_EFFECT_PRESETS_KEY, []);
    return Array.isArray(presets) ? presets : [];
  });

  useEffect(() => {
    try {
      window.localStorage.setItem(USER_EFFECT_PRESETS_KEY, JSON.stringify(userEffectPresets));
    } catch {
      // Presets are optional convenience data; YAML editing still works if browser storage is unavailable.
    }
  }, [userEffectPresets]);

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
  const effectLibShapes = useMemo(() => collectEffectLibShapes(parsed), [parsed]);
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
      <div className="mode-bar">
        <div>
          <strong>Visualizer</strong>
          <span>MagicSpells YAML Workspace</span>
        </div>
        <div className="mode-bar__actions">
          <ToolbarButton icon="DB" onClick={onOpenDatabase}>Spell DB</ToolbarButton>
          <ToolbarButton icon="AI" onClick={onOpenBuilder}>AI Builder</ToolbarButton>
          <ToolbarButton icon="H" onClick={onOpenHome}>Home</ToolbarButton>
        </div>
      </div>
      <Group orientation="horizontal" className="workspace">
        <Panel defaultSize={32} minSize={24}>
          <EditorPanel
            yamlText={yamlText}
            onYamlTextChange={setYamlText}
            parseError={parseResult.error}
            counts={{
              equations: equations.length,
              effectLib: effectLibShapes.length,
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
            effectLibShapes={effectLibShapes}
            playing={playing}
            cameraMode={cameraMode}
          />
        </Panel>
      </Group>
    </main>
  );
}

export default function App() {
  const [mode, setMode] = useState("home");
  const [yamlText, setYamlText] = useState(sampleYaml);
  const [spellPacks, setSpellPacks] = useState([]);
  const [imagePreviewAssets, setImagePreviewAssets] = useState(() => {
    const assets = loadLocalStorageValue(IMAGE_PREVIEW_ASSETS_KEY, {});
    return isRecord(assets) ? assets : {};
  });

  const refreshSpellPacks = useCallback(async () => {
    try {
      setSpellPacks(await listSpellPacks());
    } catch {
      setSpellPacks([]);
    }
  }, []);

  useEffect(() => {
    refreshSpellPacks();
  }, [refreshSpellPacks]);

  useEffect(() => {
    try {
      window.localStorage.setItem(IMAGE_PREVIEW_ASSETS_KEY, JSON.stringify(imagePreviewAssets));
    } catch {
      // Image previews are optional; local database and YAML editing still work without storage.
    }
  }, [imagePreviewAssets]);

  const databaseExamples = useMemo(() => packsToRagExamples(spellPacks), [spellPacks]);

  if (mode === "home") {
    return <HomeScreen onOpenBuilder={() => setMode("builder")} onOpenDatabase={() => setMode("database")} onOpenVisualizer={() => setMode("visualizer")} />;
  }

  if (mode === "builder") {
    return (
      <AiBuilderPanel
        databaseExamples={databaseExamples}
        onOpenDatabase={() => setMode("database")}
        onOpenVisualizer={() => setMode("visualizer")}
        onLoadYaml={setYamlText}
      />
    );
  }

  if (mode === "database") {
    return (
      <SpellDatabasePanel
        packs={spellPacks}
        onPacksChange={refreshSpellPacks}
        onLoadYaml={setYamlText}
        onLoadImageAssets={(assets) => setImagePreviewAssets((current) => ({ ...current, ...assets }))}
        onOpenVisualizer={() => setMode("visualizer")}
        onOpenBuilder={() => setMode("builder")}
        onOpenHome={() => setMode("home")}
      />
    );
  }

  return (
    <VisualizerWorkspace
      yamlText={yamlText}
      setYamlText={setYamlText}
      imagePreviewAssets={imagePreviewAssets}
      setImagePreviewAssets={setImagePreviewAssets}
      onOpenBuilder={() => setMode("builder")}
      onOpenDatabase={() => setMode("database")}
      onOpenHome={() => setMode("home")}
    />
  );
}
