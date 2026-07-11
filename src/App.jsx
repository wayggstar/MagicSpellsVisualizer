import * as YAML from "js-yaml";
import { useMemo, useState } from "react";
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
  addNewSpell,
  collectAreas,
  collectEquations,
  collectSounds,
  validateSpellConfig,
} from "./lib/spellModel";

export default function App() {
  const [yamlText, setYamlText] = useState(sampleYaml);
  const [playing, setPlaying] = useState(true);
  const [cameraMode, setCameraMode] = useState("third");
  const [selectedPath, setSelectedPath] = useState(null);

  const parseResult = useMemo(() => {
    try {
      return { data: YAML.load(yamlText), error: null };
    } catch (error) {
      return { data: null, error: error.message };
    }
  }, [yamlText]);

  const parsed = parseResult.data;
  const equations = useMemo(() => collectEquations(parsed), [parsed]);
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

  function handleAddNewSpell(type) {
    applyParsed(addNewSpell(parsed, type));
  }

  function handleAddCalledSpell(spellName, calledSpellName) {
    if (!parsed || !spellName || !calledSpellName) return;
    applyParsed(addCalledSpell(parsed, spellName, calledSpellName));
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
            onAddNewSpell={handleAddNewSpell}
            onAddCalledSpell={handleAddCalledSpell}
            diagnostics={diagnostics}
          />
        </Panel>

        <Separator className="resize-handle" />

        <Panel defaultSize={24} minSize={20}>
          <PreviewPanel areas={areas} equations={equations} playing={playing} cameraMode={cameraMode} />
        </Panel>
      </Group>
    </main>
  );
}
