import { useState } from "react";
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

function toImagePath(fileName) {
  const safeName = fileName.replace(/[^a-z0-9._-]+/gi, "_");
  return `plugins/MagicSpells/images/${safeName}`;
}

function toHexColor(red, green, blue) {
  return [red, green, blue].map((value) => value.toString(16).padStart(2, "0")).join("");
}

function loadImageElement(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = reject;
    image.src = url;
  });
}

async function rasterizeImageFile(file, maxPixels = 32) {
  const url = URL.createObjectURL(file);

  try {
    const image = await loadImageElement(url);
    const scale = Math.min(1, maxPixels / Math.max(image.naturalWidth, image.naturalHeight));
    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = document.createElement("canvas");
    const context = canvas.getContext("2d", { willReadFrequently: true });

    canvas.width = width;
    canvas.height = height;
    context.drawImage(image, 0, 0, width, height);

    const { data } = context.getImageData(0, 0, width, height);
    const pixels = [];
    const colors = [];

    for (let y = 0; y < height; y += 1) {
      let row = "";
      const colorRow = [];

      for (let x = 0; x < width; x += 1) {
        const offset = (y * width + x) * 4;
        const red = data[offset];
        const green = data[offset + 1];
        const blue = data[offset + 2];
        const alpha = data[offset + 3];
        const brightness = (red + green + blue) / 3;
        const isVisible = alpha > 32 && brightness > 18;

        row += isVisible ? "1" : "0";
        colorRow.push(`#${toHexColor(red, green, blue)}`);
      }

      pixels.push(row);
      colors.push(colorRow);
    }

    return { colors, height, pixels, sourceName: file.name, width };
  } finally {
    URL.revokeObjectURL(url);
  }
}

function ImageUploadBuilder({ effect, previewAsset, onApplyImage }) {
  const [isConverting, setIsConverting] = useState(false);
  const [error, setError] = useState("");

  async function handleFileChange(event) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setError("");
    setIsConverting(true);

    try {
      const preview = await rasterizeImageFile(file);
      onApplyImage(toImagePath(file.name), preview);
    } catch {
      setError("Could not read this image.");
    } finally {
      setIsConverting(false);
    }
  }

  return (
    <div className="reference-box">
      <div className="reference-box__header">
        <h3>Image To Particles</h3>
        <span>{previewAsset ? `${previewAsset.width}x${previewAsset.height}` : "Upload"}</span>
      </div>
      <label className="image-upload-dropzone">
        <input type="file" accept="image/png,image/jpeg,image/webp,image/gif" onChange={handleFileChange} />
        <strong>{isConverting ? "Converting..." : "Choose image"}</strong>
        <span>{previewAsset?.sourceName ?? effect.fileName ?? "PNG, JPG, WebP, GIF first frame"}</span>
      </label>
      {error && <p className="upload-error">{error}</p>}
      <p className="equation-help">
        The app samples real pixels for preview. Put the same file under <code>plugins/MagicSpells/images/</code> on the server.
      </p>
    </div>
  );
}

function getEffectPresetMeta(effect) {
  if (effect?.effect === "effectlib") return effect.effectlib?.class ?? "EffectLib";
  if (effect?.effect === "sound") return `Sound: ${effect.sound ?? "unknown"}`;
  return effect?.effect ?? "Effect";
}

function SavedEffectPresets({
  presets = [],
  selectedEffect,
  onSaveCurrent,
  onApplyPreset,
  onDeletePreset,
  applyLabel = "Apply",
}) {
  const [presetName, setPresetName] = useState("");

  return (
    <div className="reference-box">
      <div className="reference-box__header">
        <h3>Saved Effect Presets</h3>
        <span>{presets.length}</span>
      </div>

      {selectedEffect && (
        <div className="preset-save-row">
          <input
            value={presetName}
            placeholder={`${getEffectPresetMeta(selectedEffect)} preset`}
            onChange={(event) => setPresetName(event.target.value)}
          />
          <ToolbarButton
            icon="S"
            onClick={() => {
              onSaveCurrent(presetName, selectedEffect);
              setPresetName("");
            }}
          >
            Save
          </ToolbarButton>
        </div>
      )}

      {presets.length === 0 ? (
        <p className="muted-text">No saved presets yet.</p>
      ) : (
        <div className="saved-preset-list">
          {presets.map((preset) => (
            <div key={preset.id} className="saved-preset-item">
              <button type="button" className="preset-button" onClick={() => onApplyPreset(preset)}>
                <strong>{preset.name}</strong>
                <span>{preset.type ?? getEffectPresetMeta(preset.effect)}</span>
              </button>
              <button type="button" className="small-danger-button" onClick={() => onDeletePreset(preset.id)}>
                Delete
              </button>
            </div>
          ))}
        </div>
      )}

      <p className="equation-help">{applyLabel} uses the saved effect settings.</p>
    </div>
  );
}

export function InspectorPanel({
  parsed,
  selectedPath,
  onChangeParsed,
  onAddEffect,
  onAddEffectPreset,
  onAddNewSpell,
  onAddCalledSpell,
  onSaveEffectPreset,
  onDeleteEffectPreset,
  onSaveImagePreview,
  imagePreviewAssets,
  userEffectPresets,
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

  function replaceSelected(nextValue) {
    onChangeParsed(updateByPath(parsed, selectedPath, () => structuredClone(nextValue)));
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
        {firstSpell && (
          <SavedEffectPresets
            presets={userEffectPresets}
            onApplyPreset={(preset) => onAddEffectPreset(firstSpell, preset)}
            onDeletePreset={onDeleteEffectPreset}
            applyLabel={`Apply to ${firstSpell}`}
          />
        )}
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

          <SavedEffectPresets
            presets={userEffectPresets}
            onApplyPreset={(preset) => onAddEffectPreset(spellName, preset)}
            onDeletePreset={onDeleteEffectPreset}
            applyLabel={`Apply to ${spellName}`}
          />

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

          <SavedEffectPresets
            presets={userEffectPresets}
            selectedEffect={selected}
            onSaveCurrent={onSaveEffectPreset}
            onApplyPreset={(preset) => replaceSelected(preset.effect)}
            onDeletePreset={onDeleteEffectPreset}
            applyLabel="Apply to selected effect"
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

          <SavedEffectPresets
            presets={userEffectPresets}
            selectedEffect={selected}
            onSaveCurrent={onSaveEffectPreset}
            onApplyPreset={(preset) => replaceSelected(preset.effect)}
            onDeletePreset={onDeleteEffectPreset}
            applyLabel="Apply to selected effect"
          />

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
    const previewAsset = imagePreviewAssets?.[effect.fileName];

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

          <SavedEffectPresets
            presets={userEffectPresets}
            selectedEffect={selected}
            onSaveCurrent={onSaveEffectPreset}
            onApplyPreset={(preset) => replaceSelected(preset.effect)}
            onDeletePreset={onDeleteEffectPreset}
            applyLabel="Apply to selected effect"
          />

          <ImageUploadBuilder
            effect={effect}
            previewAsset={previewAsset}
            onApplyImage={(fileName, preview) => {
              onSaveImagePreview(fileName, preview);
              updateSelected((draft) => {
                draft.effectlib.fileName = fileName;
                if (draft.effectlib.class === "ColoredImage" && preview.colors?.[0]?.[0]) {
                  draft.effectlib.color = preview.colors[0][0].replace("#", "");
                }
              });
            }}
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
