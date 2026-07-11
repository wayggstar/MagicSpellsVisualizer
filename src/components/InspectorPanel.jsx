import {
  COMMON_OPTIONS,
  EQUATION_PRESETS,
  IMAGE_EFFECT_PRESETS,
  PARTICLES,
  SOUNDS,
  SPELL_CLASSES,
  SPELL_PRESETS,
  TARGETING_OPTIONS,
} from "../data/spellOptions";
import { getByPath, getSpellClassName, getSpellWikiUrl, isTargetedSpell, updateByPath } from "../lib/spellModel";
import { ToolbarButton } from "./ToolbarButton";

function Field({ label, children }) {
  return (
    <label className="field">
      <span>{label}</span>
      {children}
    </label>
  );
}

function ActionGroup({ children, title }) {
  return (
    <div className="action-group">
      <h3>{title}</h3>
      <div className="action-grid">{children}</div>
    </div>
  );
}

function PresetButtons({ onAddNewSpell }) {
  return (
    <>
      {Object.entries(SPELL_PRESETS).map(([key, preset]) => (
        <ToolbarButton key={key} icon={preset.label.slice(0, 1)} onClick={() => onAddNewSpell(key)}>
          {preset.label}
        </ToolbarButton>
      ))}
    </>
  );
}

function OptionReference({ spellClass }) {
  const options = isTargetedSpell(spellClass) ? [...COMMON_OPTIONS, ...TARGETING_OPTIONS] : COMMON_OPTIONS;

  return (
    <div className="reference-box">
      <div className="reference-box__header">
        <h3>Wiki Reference</h3>
        {spellClass && (
          <a href={getSpellWikiUrl(spellClass)} target="_blank" rel="noreferrer">
            {getSpellClassName(spellClass)}
          </a>
        )}
      </div>
      <div className="option-table">
        {options.slice(0, 10).map((option) => (
          <div key={option.key}>
            <code>{option.key}</code>
            <span>{option.type}</span>
            <p>{option.note}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function DiagnosticsForSelection({ diagnostics, selectedPath }) {
  const selectedSpell = selectedPath?.[0];
  const scoped = selectedSpell ? diagnostics.filter((item) => item.spellName === selectedSpell) : diagnostics;

  return (
    <div className="reference-box">
      <div className="reference-box__header">
        <h3>Checks</h3>
        <span>{scoped.length}</span>
      </div>
      {scoped.length === 0 ? (
        <p className="muted-text">No issues for this selection.</p>
      ) : (
        <ul className="diagnostics-list">
          {scoped.map((item) => (
            <li key={item.id} className={`diagnostic diagnostic--${item.severity}`}>
              <strong>{item.severity}</strong>
              <span>{item.message}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function EquationPresetBuilder({ onApplyPreset }) {
  return (
    <div className="reference-box">
      <div className="reference-box__header">
        <h3>Equation Builder</h3>
        <span>t = tick</span>
      </div>
      <div className="preset-grid">
        {EQUATION_PRESETS.map((preset) => (
          <button key={preset.id} type="button" className="preset-button" onClick={() => onApplyPreset(preset)}>
            <strong>{preset.label}</strong>
            <span>{preset.description}</span>
          </button>
        ))}
      </div>
      <p className="equation-help">
        Use numbers with sin/cos/tan, for example <code>3cos(0.1t)</code>. The preview normalizes missing multiplication signs.
      </p>
    </div>
  );
}

function ImagePresetBuilder({ onApplyPreset }) {
  return (
    <div className="reference-box">
      <div className="reference-box__header">
        <h3>Image Presets</h3>
        <span>EffectLib</span>
      </div>
      <div className="preset-grid">
        {IMAGE_EFFECT_PRESETS.map((preset) => (
          <button key={preset.id} type="button" className="preset-button" onClick={() => onApplyPreset(preset)}>
            <strong>{preset.label}</strong>
            <span>{preset.fileName}</span>
          </button>
        ))}
      </div>
      <p className="equation-help">
        Put the real image under <code>plugins/MagicSpells/images/</code>, then match <code>fileName</code> here.
      </p>
    </div>
  );
}

function EffectAddButtons({ spellName, onAddEffect }) {
  return (
    <>
      <ToolbarButton icon="FX" onClick={() => onAddEffect(spellName, "equation")}>Equation</ToolbarButton>
      <ToolbarButton icon="S" onClick={() => onAddEffect(spellName, "sound")}>Sound</ToolbarButton>
      <ToolbarButton icon="I" onClick={() => onAddEffect(spellName, "image")}>Image</ToolbarButton>
      <ToolbarButton icon="CI" onClick={() => onAddEffect(spellName, "coloredImage")}>Colored</ToolbarButton>
    </>
  );
}

export function InspectorPanel({
  parsed,
  selectedPath,
  onChangeParsed,
  onAddEffect,
  onAddNewSpell,
  onAddCalledSpell,
  diagnostics,
}) {
  const spellNames = parsed ? Object.keys(parsed) : [];
  const firstSpell = spellNames[0];

  function updateSelected(mutator) {
    const next = updateByPath(parsed, selectedPath, (oldValue) => {
      const copy = structuredClone(oldValue);
      mutator(copy);
      return copy;
    });

    onChangeParsed(next);
  }

  if (!parsed) {
    return (
      <section className="panel inspector-panel" aria-label="Inspector">
        <div className="empty-state">YAML을 먼저 입력하세요.</div>
      </section>
    );
  }

  if (!selectedPath) {
    return (
      <section className="panel inspector-panel" aria-label="Inspector">
        <div className="panel-strip">
          <span>Inspector</span>
        </div>
        <ActionGroup title="Add Spell">
          <PresetButtons onAddNewSpell={onAddNewSpell} />
        </ActionGroup>
        <ActionGroup title="Add Effect">
          <EffectAddButtons spellName={firstSpell} onAddEffect={onAddEffect} />
        </ActionGroup>
        <DiagnosticsForSelection diagnostics={diagnostics} selectedPath={selectedPath} />
      </section>
    );
  }

  const selected = getByPath(parsed, selectedPath);

  if (!selected) {
    return (
      <section className="panel inspector-panel" aria-label="Inspector">
        <div className="empty-state">선택된 데이터를 찾을 수 없음.</div>
      </section>
    );
  }

  if (selectedPath.length === 1) {
    const spellName = selectedPath[0];
    const spell = selected;
    const spellClass = spell["spell-class"] ?? "";

    return (
      <section className="panel inspector-panel" aria-label="Inspector">
        <div className="panel-strip">
          <span>Spell Inspector</span>
        </div>
        <div className="inspector-content">
          <p className="selected-name">{spellName}</p>

          <ActionGroup title="Create">
            <PresetButtons onAddNewSpell={onAddNewSpell} />
          </ActionGroup>

          <Field label="spell-class">
            <select value={spellClass} onChange={(event) => updateSelected((draft) => { draft["spell-class"] = event.target.value; })}>
              {SPELL_CLASSES.map((className) => (
                <option key={className} value={className}>{className}</option>
              ))}
            </select>
          </Field>

          <Field label="Called spells">
            <select
              defaultValue=""
              onChange={(event) => {
                if (!event.target.value) return;
                onAddCalledSpell(spellName, event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">+ Add Called Spell</option>
              {spellNames
                .filter((name) => name !== spellName)
                .map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
            </select>
          </Field>

          <div className="called-list">
            {(spell.spells ?? []).map((called, index) => (
              <span key={`${called}-${index}`}>{index + 1}. {called}</span>
            ))}
          </div>

          <ActionGroup title="Effects">
            <EffectAddButtons spellName={spellName} onAddEffect={onAddEffect} />
          </ActionGroup>

          <OptionReference spellClass={spellClass} />
          <DiagnosticsForSelection diagnostics={diagnostics} selectedPath={selectedPath} />
        </div>
      </section>
    );
  }

  if (selected.effect === "effectlib" && selected.effectlib?.class === "EquationEffect") {
    const effect = selected.effectlib;

    return (
      <section className="panel inspector-panel" aria-label="Inspector">
        <div className="panel-strip">
          <span>EquationEffect</span>
        </div>
        <div className="inspector-content">
          <DiagnosticsForSelection diagnostics={diagnostics} selectedPath={selectedPath} />

          <ActionGroup title="Add">
            <EffectAddButtons spellName={selectedPath[0]} onAddEffect={onAddEffect} />
          </ActionGroup>

          <EquationPresetBuilder
            onApplyPreset={(preset) => updateSelected((draft) => {
              draft.effectlib.particle = preset.particle;
              draft.effectlib.particles = preset.particles;
              draft.effectlib.duration = preset.duration;
              draft.effectlib.xEquation = preset.xEquation;
              draft.effectlib.yEquation = preset.yEquation;
              draft.effectlib.zEquation = preset.zEquation;
            })}
          />

          <Field label="position">
            <select value={selected.position ?? "caster"} onChange={(event) => updateSelected((draft) => { draft.position = event.target.value; })}>
              <option value="caster">caster</option>
              <option value="special">special</option>
              <option value="target">target</option>
            </select>
          </Field>
          <Field label="particle">
            <select value={effect.particle ?? "redstone"} onChange={(event) => updateSelected((draft) => { draft.effectlib.particle = event.target.value; })}>
              {PARTICLES.map((particle) => (
                <option key={particle} value={particle}>{particle}</option>
              ))}
            </select>
          </Field>
          <Field label="color">
            <input value={effect.color ?? "ffffff"} onChange={(event) => updateSelected((draft) => { draft.effectlib.color = event.target.value.replace("#", ""); })} />
          </Field>
          <Field label="particles">
            <input type="number" value={effect.particles ?? 24} onChange={(event) => updateSelected((draft) => { draft.effectlib.particles = Number(event.target.value); })} />
          </Field>
          <Field label="duration">
            <input type="number" value={effect.duration ?? 120} onChange={(event) => updateSelected((draft) => { draft.effectlib.duration = Number(event.target.value); })} />
          </Field>
          <Field label="xEquation">
            <input value={effect.xEquation ?? ""} onChange={(event) => updateSelected((draft) => { draft.effectlib.xEquation = event.target.value; })} />
          </Field>
          <Field label="yEquation">
            <input value={effect.yEquation ?? ""} onChange={(event) => updateSelected((draft) => { draft.effectlib.yEquation = event.target.value; })} />
          </Field>
          <Field label="zEquation">
            <input value={effect.zEquation ?? ""} onChange={(event) => updateSelected((draft) => { draft.effectlib.zEquation = event.target.value; })} />
          </Field>
        </div>
      </section>
    );
  }

  if (selected.effect === "sound") {
    return (
      <section className="panel inspector-panel" aria-label="Inspector">
        <div className="panel-strip">
          <span>Sound Effect</span>
        </div>
        <div className="inspector-content">
          <DiagnosticsForSelection diagnostics={diagnostics} selectedPath={selectedPath} />

          <ActionGroup title="Add">
            <EffectAddButtons spellName={selectedPath[0]} onAddEffect={onAddEffect} />
          </ActionGroup>

          <Field label="position">
            <select value={selected.position ?? "caster"} onChange={(event) => updateSelected((draft) => { draft.position = event.target.value; })}>
              <option value="caster">caster</option>
              <option value="special">special</option>
              <option value="target">target</option>
            </select>
          </Field>
          <Field label="sound">
            <select value={selected.sound ?? SOUNDS[0]} onChange={(event) => updateSelected((draft) => { draft.sound = event.target.value; })}>
              {SOUNDS.map((sound) => (
                <option key={sound} value={sound}>{sound}</option>
              ))}
            </select>
          </Field>
          <Field label="volume">
            <input type="number" step="0.1" value={selected.volume ?? 1} onChange={(event) => updateSelected((draft) => { draft.volume = Number(event.target.value); })} />
          </Field>
          <Field label="pitch">
            <input type="number" step="0.1" value={selected.pitch ?? 1} onChange={(event) => updateSelected((draft) => { draft.pitch = Number(event.target.value); })} />
          </Field>
          <Field label="delay">
            <input type="number" value={selected.delay ?? 0} onChange={(event) => updateSelected((draft) => { draft.delay = Number(event.target.value); })} />
          </Field>
        </div>
      </section>
    );
  }

  if (selected.effect === "effectlib" && ["Image", "ColoredImage"].includes(selected.effectlib?.class)) {
    const effect = selected.effectlib;

    return (
      <section className="panel inspector-panel" aria-label="Inspector">
        <div className="panel-strip">
          <span>{effect.class} Effect</span>
        </div>
        <div className="inspector-content">
          <DiagnosticsForSelection diagnostics={diagnostics} selectedPath={selectedPath} />

          <ActionGroup title="Add">
            <EffectAddButtons spellName={selectedPath[0]} onAddEffect={onAddEffect} />
          </ActionGroup>

          <ImagePresetBuilder
            onApplyPreset={(preset) => updateSelected((draft) => {
              draft.effectlib.fileName = preset.fileName;
              draft.effectlib.color = preset.color;
            })}
          />

          <Field label="class">
            <select value={effect.class ?? "Image"} onChange={(event) => updateSelected((draft) => { draft.effectlib.class = event.target.value; })}>
              <option value="Image">Image</option>
              <option value="ColoredImage">ColoredImage</option>
            </select>
          </Field>
          <Field label="position">
            <select value={selected.position ?? "caster"} onChange={(event) => updateSelected((draft) => { draft.position = event.target.value; })}>
              <option value="caster">caster</option>
              <option value="special">special</option>
              <option value="target">target</option>
            </select>
          </Field>
          <Field label="fileName">
            <input value={effect.fileName ?? ""} onChange={(event) => updateSelected((draft) => { draft.effectlib.fileName = event.target.value; })} />
          </Field>
          <Field label="particle">
            <select value={effect.particle ?? "redstone"} onChange={(event) => updateSelected((draft) => { draft.effectlib.particle = event.target.value; })}>
              {PARTICLES.map((particle) => (
                <option key={particle} value={particle}>{particle}</option>
              ))}
            </select>
          </Field>
          <Field label="color">
            <input value={effect.color ?? "ffffff"} onChange={(event) => updateSelected((draft) => { draft.effectlib.color = event.target.value.replace("#", ""); })} />
          </Field>
          <Field label="stepX">
            <input type="number" value={effect.stepX ?? 5} onChange={(event) => updateSelected((draft) => { draft.effectlib.stepX = Number(event.target.value); })} />
          </Field>
          <Field label="stepY">
            <input type="number" value={effect.stepY ?? 5} onChange={(event) => updateSelected((draft) => { draft.effectlib.stepY = Number(event.target.value); })} />
          </Field>
          <Field label="size">
            <input type="number" step="0.01" value={effect.size ?? 0.08} onChange={(event) => updateSelected((draft) => { draft.effectlib.size = Number(event.target.value); })} />
          </Field>
          <Field label="period">
            <input type="number" value={effect.period ?? 9} onChange={(event) => updateSelected((draft) => { draft.effectlib.period = Number(event.target.value); })} />
          </Field>
          <Field label="iterations">
            <input type="number" value={effect.iterations ?? 1} onChange={(event) => updateSelected((draft) => { draft.effectlib.iterations = Number(event.target.value); })} />
          </Field>
          <Field label="isGif">
            <select value={String(effect.isGif ?? false)} onChange={(event) => updateSelected((draft) => { draft.effectlib.isGif = event.target.value === "true"; })}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </Field>
          <Field label="enableRotation">
            <select value={String(effect.enableRotation ?? true)} onChange={(event) => updateSelected((draft) => { draft.effectlib.enableRotation = event.target.value === "true"; })}>
              <option value="true">true</option>
              <option value="false">false</option>
            </select>
          </Field>
          <Field label="invert">
            <select value={String(effect.invert ?? false)} onChange={(event) => updateSelected((draft) => { draft.effectlib.invert = event.target.value === "true"; })}>
              <option value="false">false</option>
              <option value="true">true</option>
            </select>
          </Field>
        </div>
      </section>
    );
  }

  return (
    <section className="panel inspector-panel" aria-label="Inspector">
      <div className="panel-strip">
        <span>Raw Node</span>
      </div>
      <pre className="raw-node">{JSON.stringify(selected, null, 2)}</pre>
    </section>
  );
}
