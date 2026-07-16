import { useEffect, useMemo, useRef, useState } from "react";
import { buildSpellChain, deleteSpellPack, importSpellFiles } from "../lib/spellDatabase";
import { ToolbarButton } from "./ToolbarButton";

function SpellRow({ pack, spell, selected, onSelect }) {
  return (
    <button
      type="button"
      className={`database-spell-row${selected ? " is-selected" : ""}`}
      onClick={() => onSelect(pack, spell)}
    >
      <span className="database-spell-row__main">
        <strong>{spell.name}</strong>
        <small>{pack.title}</small>
      </span>
      <span className="database-spell-row__meta">
        <span>{spell.className}</span>
        {spell.helper && <span>helper</span>}
        {spell.effectCount > 0 && <span>{spell.effectCount} FX</span>}
      </span>
    </button>
  );
}

function ResourceImagePreview({ resource }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const preview = resource.preview;
    if (!canvas || !preview) return;

    canvas.width = preview.width;
    canvas.height = preview.height;
    const context = canvas.getContext("2d");
    const imageData = context.createImageData(preview.width, preview.height);

    for (let y = 0; y < preview.height; y += 1) {
      for (let x = 0; x < preview.width; x += 1) {
        const offset = (y * preview.width + x) * 4;
        const color = preview.colors?.[y]?.[x] ?? "#ffffff";
        imageData.data[offset] = Number.parseInt(color.slice(1, 3), 16);
        imageData.data[offset + 1] = Number.parseInt(color.slice(3, 5), 16);
        imageData.data[offset + 2] = Number.parseInt(color.slice(5, 7), 16);
        imageData.data[offset + 3] = preview.pixels?.[y]?.[x] === "1" ? 255 : 0;
      }
    }

    context.putImageData(imageData, 0, 0);
  }, [resource]);

  if (!resource.preview) {
    return <div className="database-empty"><strong>{resource.name}</strong><p>{resource.error ?? "이미지를 읽을 수 없습니다."}</p></div>;
  }

  return (
    <div className="database-image-preview">
      <canvas ref={canvasRef} aria-label={`${resource.name} 픽셀 미리보기`} />
      <div>
        <strong>{resource.name}</strong>
        <span>{resource.preview.width} × {resource.preview.height} sampled pixels</span>
        <code>{resource.effectPath}</code>
      </div>
    </div>
  );
}

function getPackSearchText(pack) {
  return [
    pack.title,
    pack.fileName,
    pack.metadata?.summary,
    ...(pack.metadata?.tags ?? []),
    ...(pack.metadata?.skills ?? []).flatMap((skill) => [skill.trigger, skill.name, skill.description]),
    ...(pack.metadata?.reactions ?? []).flatMap((reaction) => [reaction.name, reaction.description]),
  ].filter(Boolean).join(" ").toLowerCase();
}

export function SpellDatabasePanel({ packs, onPacksChange, onLoadYaml, onLoadImageAssets, onOpenVisualizer, onOpenBuilder, onOpenHome }) {
  const fileInputRef = useRef(null);
  const folderInputRef = useRef(null);
  const [query, setQuery] = useState("");
  const [packFilter, setPackFilter] = useState("all");
  const [classFilter, setClassFilter] = useState("all");
  const [selected, setSelected] = useState(null);
  const [detailView, setDetailView] = useState("yaml");
  const [notice, setNotice] = useState("");
  const [importing, setImporting] = useState(false);

  const allSpells = useMemo(() => packs.flatMap((pack) => pack.spells.map((spell) => ({ pack, spell }))), [packs]);
  const classes = useMemo(() => [...new Set(allSpells.map(({ spell }) => spell.className))].sort(), [allSpells]);
  const filteredSpells = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase();
    return allSpells.filter(({ pack, spell }) => {
      if (packFilter !== "all" && pack.id !== packFilter) return false;
      if (classFilter !== "all" && spell.className !== classFilter) return false;
      return !normalizedQuery || `${getPackSearchText(pack)} ${spell.searchText}`.includes(normalizedQuery);
    });
  }, [allSpells, classFilter, packFilter, query]);
  const selectedChain = useMemo(() => selected ? buildSpellChain(selected.pack, selected.spell.name) : null, [selected]);
  const selectedResource = selected?.pack.supportFiles?.find((resource) => resource.relativePath === detailView) ?? null;

  async function handleImport(event) {
    const files = event.target.files;
    if (!files?.length) return;

    setImporting(true);
    setNotice("");
    try {
      const imported = await importSpellFiles(files);
      await onPacksChange();
      const spellCount = imported.reduce((count, pack) => count + pack.spells.length, 0);
      const errorCount = imported.filter((pack) => pack.parseError).length;
      setNotice(`${imported.length}개 YAML에서 ${spellCount}개 스펠을 추가했습니다.${errorCount ? ` 파싱 실패 ${errorCount}개.` : ""}`);
    } catch (error) {
      setNotice(`가져오기 실패: ${error.message}`);
    } finally {
      setImporting(false);
      event.target.value = "";
    }
  }

  async function handleDeletePack(packId) {
    await deleteSpellPack(packId);
    if (selected?.pack.id === packId) setSelected(null);
    await onPacksChange();
  }

  function openInVisualizer() {
    if (!selectedChain?.yaml) return;
    onLoadYaml(selectedChain.yaml);
    onLoadImageAssets(selected.pack.imagePreviewAssets ?? {});
    onOpenVisualizer();
  }

  return (
    <main className="database-shell">
      <header className="builder-topbar">
        <div>
          <p className="eyebrow">Local MagicSpells Library</p>
          <h1>매직스펠 DB</h1>
        </div>
        <nav className="builder-nav-actions" aria-label="작업실 이동">
          <ToolbarButton icon="AI" onClick={onOpenBuilder}>AI Builder</ToolbarButton>
          <ToolbarButton icon="3D" onClick={onOpenVisualizer}>Visualizer</ToolbarButton>
          <ToolbarButton icon="H" onClick={onOpenHome}>Home</ToolbarButton>
        </nav>
      </header>

      <section className="database-toolbar">
        <div className="database-toolbar__summary">
          <strong>{allSpells.length}</strong>
          <span>spells</span>
          <strong>{packs.length}</strong>
          <span>YAML packs</span>
        </div>
        <div className="database-toolbar__actions">
          <input ref={fileInputRef} className="visually-hidden" type="file" accept=".yml,.yaml,.sk,.txt,.png,.jpg,.jpeg,.webp,.gif" multiple onChange={handleImport} />
          <input ref={folderInputRef} className="visually-hidden" type="file" accept=".yml,.yaml,.sk,.txt,.png,.jpg,.jpeg,.webp,.gif" multiple webkitdirectory="" onChange={handleImport} />
          <ToolbarButton icon="+" onClick={() => fileInputRef.current?.click()}>YAML 추가</ToolbarButton>
          <ToolbarButton icon="DIR" onClick={() => folderInputRef.current?.click()}>폴더 추가</ToolbarButton>
        </div>
      </section>

      <section className="database-layout">
        <aside className="database-sidebar">
          <div className="database-panel-header">
            <div>
              <h3>소스 팩</h3>
              <span>이 기기에만 저장됨</span>
            </div>
          </div>
          <button type="button" className={`database-pack${packFilter === "all" ? " is-selected" : ""}`} onClick={() => setPackFilter("all")}>
            <span>전체 스펠</span><strong>{allSpells.length}</strong>
          </button>
          <div className="database-pack-list">
            {packs.map((pack) => (
              <div key={pack.id} className={`database-pack${packFilter === pack.id ? " is-selected" : ""}`}>
                <button type="button" onClick={() => setPackFilter(pack.id)}>
                  <strong>{pack.title}</strong>
                  <span>{pack.fileName}</span>
                  <small>{pack.spells.length} spells · {pack.supportFiles?.length ?? 0} resources{pack.parseError ? " · parse error" : ""}</small>
                </button>
                <button type="button" className="database-delete" title="이 팩 삭제" aria-label={`${pack.title} 삭제`} onClick={() => handleDeletePack(pack.id)}>×</button>
              </div>
            ))}
          </div>
          {packs.length === 0 && (
            <div className="database-empty">
              <strong>아직 로컬 DB가 비어 있어요.</strong>
              <p>YAML 파일이나 배포팩 폴더를 추가하면 스펠을 자동 분류합니다.</p>
            </div>
          )}
        </aside>

        <section className="database-results">
          <div className="database-filters">
            <label>
              <span>검색</span>
              <input value={query} placeholder="스펠명, 클래스, 아이템, 파티클..." onChange={(event) => setQuery(event.target.value)} />
            </label>
            <label>
              <span>클래스</span>
              <select value={classFilter} onChange={(event) => setClassFilter(event.target.value)}>
                <option value="all">전체 클래스</option>
                {classes.map((className) => <option key={className} value={className}>{className}</option>)}
              </select>
            </label>
          </div>
          <div className="database-results__header">
            <span>{filteredSpells.length}개 검색됨</span>
            {filteredSpells.length > 300 && <small>성능을 위해 앞 300개를 표시합니다.</small>}
          </div>
          <div className="database-spell-list">
            {filteredSpells.slice(0, 300).map(({ pack, spell }) => (
              <SpellRow
                key={`${pack.id}-${spell.id}`}
                pack={pack}
                spell={spell}
                selected={selected?.pack.id === pack.id && selected?.spell.id === spell.id}
                onSelect={(nextPack, nextSpell) => {
                  setSelected({ pack: nextPack, spell: nextSpell });
                  setDetailView("yaml");
                }}
              />
            ))}
          </div>
        </section>

        <aside className="database-detail">
          {selected && selectedChain ? (
            <>
              <div className="database-detail__header">
                <div>
                  <span>{selected.pack.title}</span>
                  <h2>{selected.spell.name}</h2>
                  <p>{selected.spell.spellClass}</p>
                </div>
                <ToolbarButton icon="3D" onClick={openInVisualizer}>Visualizer로 열기</ToolbarButton>
              </div>
              <dl className="database-detail-grid">
                <div><dt>트리거</dt><dd>{selected.spell.trigger}</dd></div>
                <div><dt>아이템</dt><dd>{selected.spell.item || "없음"}</dd></div>
                <div><dt>연결 스펠</dt><dd>{selectedChain.names.length}</dd></div>
                <div><dt>이펙트</dt><dd>{selected.spell.effectCount}</dd></div>
              </dl>
              {selected.pack.metadata && (
                <section className="database-pack-metadata">
                  <p>{selected.pack.metadata.summary}</p>
                  <div className="database-requirements">
                    {selected.pack.metadata.requirements.map((requirement) => <span key={requirement}>{requirement}</span>)}
                  </div>
                  <div className="database-skill-list">
                    {selected.pack.metadata.skills.map((skill) => (
                      <div key={skill.trigger}>
                        <strong>{skill.trigger} · {skill.name}</strong>
                        <span>{skill.description}</span>
                      </div>
                    ))}
                  </div>
                  <div className="database-reaction-list">
                    {selected.pack.metadata.reactions.map((reaction) => (
                      <div key={reaction.name}>
                        <strong>{reaction.name}</strong>
                        <span>{reaction.description}</span>
                      </div>
                    ))}
                  </div>
                </section>
              )}
              <div className="database-chain-tags">
                {selectedChain.names.map((name) => <span key={name}>{name}</span>)}
              </div>
              <div className="database-resource-tabs" role="tablist" aria-label="팩 소스 보기">
                <button type="button" className={detailView === "yaml" ? "is-selected" : ""} onClick={() => setDetailView("yaml")}>YAML 체인</button>
                {(selected.pack.supportFiles ?? []).map((resource) => (
                  <button
                    key={resource.relativePath}
                    type="button"
                    className={detailView === resource.relativePath ? "is-selected" : ""}
                    onClick={() => setDetailView(resource.relativePath)}
                  >
                    {resource.kind === "image" ? "IMG" : resource.language === "skript" ? "SK" : "TXT"} · {resource.name}
                  </button>
                ))}
              </div>
              {detailView === "yaml" && <pre className="database-code">{selectedChain.yaml}</pre>}
              {selectedResource?.kind === "text" && <pre className="database-code">{selectedResource.content}</pre>}
              {selectedResource?.kind === "image" && <ResourceImagePreview resource={selectedResource} />}
            </>
          ) : (
            <div className="database-empty database-empty--detail">
              <strong>스펠을 선택해 주세요.</strong>
              <p>연결된 헬퍼 스펠과 실제 YAML을 함께 확인할 수 있습니다.</p>
            </div>
          )}
        </aside>
      </section>

      {(notice || importing) && <div className="database-notice" role="status">{importing ? "YAML을 분석하고 있습니다..." : notice}</div>}
    </main>
  );
}
