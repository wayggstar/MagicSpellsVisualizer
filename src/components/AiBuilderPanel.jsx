import { useMemo, useState } from "react";
import { BASE_RAG_EXAMPLES, INPUT_SLOTS } from "../data/ragExamples";
import { buildMapleSpellProject, loadRagExamples, saveRagExample, searchExamples } from "../lib/mapleBuilder";
import { ToolbarButton } from "./ToolbarButton";

const EMPTY_SLOTS = Object.fromEntries(INPUT_SLOTS.map((slot) => [slot.id, ""]));

function ExampleCard({ example }) {
  return (
    <article className="builder-example-card">
      <div>
        <strong>{example.title}</strong>
        <span>{example.trigger} · {example.item}</span>
      </div>
      <p>{example.intent}</p>
      <div className="builder-tag-row">
        {(example.tags ?? []).slice(0, 5).map((tag) => <span key={tag}>{tag}</span>)}
      </div>
    </article>
  );
}

export function AiBuilderPanel({ onOpenVisualizer, onLoadYaml }) {
  const [form, setForm] = useState({
    name: "shadow_blade",
    displayName: "Shadow Blade",
    item: "netherite_sword",
    concept: "검을 든 암흑 기사 느낌. 빠른 진입, 근접 폭딜, 쉬우는 생존 버프.",
    slots: {
      ...EMPTY_SLOTS,
      rightClick: "전방으로 어둠 검기를 발사하고 맞은 대상에게 피해",
      leftClick: "가까운 범위에 빠른 베기 폭발",
      shiftRight: "짧은 시간 보호막과 영혼 파티클 버프",
    },
  });
  const [examples, setExamples] = useState(() => loadRagExamples());
  const [customExample, setCustomExample] = useState({
    title: "",
    tags: "",
    intent: "",
    yaml: "",
  });
  const [result, setResult] = useState(() => buildMapleSpellProject(form, loadRagExamples()));

  const liveMatches = useMemo(() => {
    const query = [
      form.item,
      form.concept,
      INPUT_SLOTS.map((slot) => form.slots[slot.id]).join(" "),
    ].join(" ");
    return searchExamples(query, examples, 4);
  }, [examples, form]);

  function updateSlot(slotId, value) {
    setForm((current) => ({
      ...current,
      slots: {
        ...current.slots,
        [slotId]: value,
      },
    }));
  }

  function generate() {
    setResult(buildMapleSpellProject(form, examples));
  }

  function addExample() {
    if (!customExample.title.trim() || !customExample.intent.trim()) return;

    const nextStored = saveRagExample({
      title: customExample.title.trim(),
      tags: customExample.tags.split(",").map((tag) => tag.trim()).filter(Boolean),
      intent: customExample.intent.trim(),
      item: form.item,
      trigger: "custom",
      notes: ["User-added local RAG example."],
      yaml: customExample.yaml.trim(),
    });

    setExamples([...nextStored, ...BASE_RAG_EXAMPLES]);
    setCustomExample({ title: "", tags: "", intent: "", yaml: "" });
  }

  function loadIntoVisualizer() {
    onLoadYaml(result.yaml);
    onOpenVisualizer();
  }

  return (
    <main className="builder-shell">
      <header className="builder-topbar">
        <div>
          <p className="eyebrow">Experimental AI MagicSpells</p>
          <h1>매펠 AI 설계실</h1>
        </div>
        <div className="builder-nav-actions">
          <ToolbarButton icon="3D" onClick={onOpenVisualizer}>Visualizer</ToolbarButton>
          <ToolbarButton icon="AI" isActive>AI Builder</ToolbarButton>
        </div>
      </header>

      <section className="builder-layout">
        <div className="builder-column builder-column--form">
          <section className="builder-panel">
            <div className="builder-panel__header">
              <h3>입력 설계</h3>
              <span>item + trigger slots</span>
            </div>
            <label className="builder-field">
              <span>프로젝트 ID</span>
              <input value={form.name} onChange={(event) => setForm({ ...form, name: event.target.value })} />
            </label>
            <label className="builder-field">
              <span>아이템</span>
              <input value={form.item} onChange={(event) => setForm({ ...form, item: event.target.value })} />
            </label>
            <label className="builder-field">
              <span>표시 이름</span>
              <input value={form.displayName} onChange={(event) => setForm({ ...form, displayName: event.target.value })} />
            </label>
            <label className="builder-field">
              <span>전체 구상도</span>
              <textarea value={form.concept} onChange={(event) => setForm({ ...form, concept: event.target.value })} />
            </label>
            <div className="builder-slot-grid">
              {INPUT_SLOTS.map((slot) => (
                <label key={slot.id} className="builder-field">
                  <span>{slot.label}</span>
                  <textarea
                    value={form.slots[slot.id]}
                    placeholder={slot.placeholder}
                    onChange={(event) => updateSlot(slot.id, event.target.value)}
                  />
                </label>
              ))}
            </div>
            <ToolbarButton icon="GO" onClick={generate}>구조와 YAML 생성</ToolbarButton>
          </section>

          <section className="builder-panel">
            <div className="builder-panel__header">
              <h3>RAG 예제 추가</h3>
              <span>{examples.length} examples</span>
            </div>
            <label className="builder-field">
              <span>제목</span>
              <input value={customExample.title} onChange={(event) => setCustomExample({ ...customExample, title: event.target.value })} />
            </label>
            <label className="builder-field">
              <span>태그</span>
              <input value={customExample.tags} placeholder="fire, area, sword" onChange={(event) => setCustomExample({ ...customExample, tags: event.target.value })} />
            </label>
            <label className="builder-field">
              <span>의도 설명</span>
              <textarea value={customExample.intent} onChange={(event) => setCustomExample({ ...customExample, intent: event.target.value })} />
            </label>
            <label className="builder-field">
              <span>예시 YAML</span>
              <textarea value={customExample.yaml} onChange={(event) => setCustomExample({ ...customExample, yaml: event.target.value })} />
            </label>
            <ToolbarButton icon="RAG" onClick={addExample}>로컬 예제 저장</ToolbarButton>
          </section>
        </div>

        <div className="builder-column">
          <section className="builder-panel">
            <div className="builder-panel__header">
              <h3>검색된 예제</h3>
              <span>local RAG</span>
            </div>
            <div className="builder-example-list">
              {liveMatches.length === 0 ? <p className="muted-text">아직 매칭된 예제가 없음.</p> : liveMatches.map((example) => (
                <ExampleCard key={example.id} example={example} />
              ))}
            </div>
          </section>

          <section className="builder-panel">
            <div className="builder-panel__header">
              <h3>생성 구조</h3>
              <span>{result.plans.length} triggers</span>
            </div>
            <div className="builder-plan-list">
              {result.plans.map((plan) => (
                <article key={plan.trigger} className="builder-plan-card">
                  <strong>{plan.label} · {plan.pattern}</strong>
                  <p>{plan.description}</p>
                  <code>{plan.spellName}</code>
                  <span>helpers: {plan.helpers.join(", ") || "none"}</span>
                </article>
              ))}
            </div>
          </section>

          <section className="builder-panel">
            <div className="builder-panel__header">
              <h3>내부 프롬프트</h3>
              <span>LLM handoff ready</span>
            </div>
            <pre className="builder-code builder-code--prompt">{result.prompt}</pre>
          </section>
        </div>

        <div className="builder-column builder-column--output">
          <section className="builder-panel">
            <div className="builder-panel__header">
              <h3>MagicSpells YAML</h3>
              <ToolbarButton icon="3D" onClick={loadIntoVisualizer}>Visualizer로 열기</ToolbarButton>
            </div>
            <pre className="builder-code">{result.yaml}</pre>
          </section>
          <section className="builder-panel">
            <div className="builder-panel__header">
              <h3>아이템 바인딩 초안</h3>
              <span>experimental</span>
            </div>
            <pre className="builder-code">{result.itemYaml}</pre>
          </section>
        </div>
      </section>
    </main>
  );
}
