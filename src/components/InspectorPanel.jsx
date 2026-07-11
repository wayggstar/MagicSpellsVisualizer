import { PARTICLES, SOUNDS, SPELL_CLASSES } from "../data/spellOptions";
import { getByPath, updateByPath } from "../lib/spellModel";
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

export function InspectorPanel({
  parsed,
  selectedPath,
  onChangeParsed,
  onAddEffect,
  onAddNewSpell,
  onAddCalledSpell,
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
          <ToolbarButton icon="M" onClick={() => onAddNewSpell("multi")}>MultiSpell</ToolbarButton>
          <ToolbarButton icon="A" onClick={() => onAddNewSpell("area")}>AreaEffect</ToolbarButton>
          <ToolbarButton icon="P" onClick={() => onAddNewSpell("projectile")}>Projectile</ToolbarButton>
        </ActionGroup>
        <ActionGroup title="Add Effect">
          <ToolbarButton icon="FX" onClick={() => onAddEffect(firstSpell, "equation")}>Equation</ToolbarButton>
          <ToolbarButton icon="S" onClick={() => onAddEffect(firstSpell, "sound")}>Sound</ToolbarButton>
        </ActionGroup>
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
            <ToolbarButton icon="M" onClick={() => onAddNewSpell("multi")}>Multi</ToolbarButton>
            <ToolbarButton icon="A" onClick={() => onAddNewSpell("area")}>Area</ToolbarButton>
            <ToolbarButton icon="P" onClick={() => onAddNewSpell("projectile")}>Projectile</ToolbarButton>
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
            <ToolbarButton icon="FX" onClick={() => onAddEffect(spellName, "equation")}>Equation</ToolbarButton>
            <ToolbarButton icon="S" onClick={() => onAddEffect(spellName, "sound")}>Sound</ToolbarButton>
          </ActionGroup>
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
          <ActionGroup title="Add">
            <ToolbarButton icon="FX" onClick={() => onAddEffect(selectedPath[0], "equation")}>Equation</ToolbarButton>
            <ToolbarButton icon="S" onClick={() => onAddEffect(selectedPath[0], "sound")}>Sound</ToolbarButton>
          </ActionGroup>

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
          <ActionGroup title="Add">
            <ToolbarButton icon="FX" onClick={() => onAddEffect(selectedPath[0], "equation")}>Equation</ToolbarButton>
            <ToolbarButton icon="S" onClick={() => onAddEffect(selectedPath[0], "sound")}>Sound</ToolbarButton>
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

  return (
    <section className="panel inspector-panel" aria-label="Inspector">
      <div className="panel-strip">
        <span>Raw Node</span>
      </div>
      <pre className="raw-node">{JSON.stringify(selected, null, 2)}</pre>
    </section>
  );
}

