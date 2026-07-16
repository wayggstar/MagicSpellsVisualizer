import * as YAML from "js-yaml";

const DATABASE_NAME = "magicspellsvisualizer";
const DATABASE_VERSION = 1;
const PACK_STORE = "spellPacks";

const REFERENCE_KEYS = new Set([
  "spell",
  "spells",
  "spell-on-cast",
  "spell-on-end",
  "spell-on-hit",
  "spell-on-tick",
  "spell-to-cast",
  "spells-to-cast",
  "start-spell",
  "stop-spell",
]);

function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);

    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(PACK_STORE)) {
        database.createObjectStore(PACK_STORE, { keyPath: "id" });
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function runStore(mode, operation) {
  const database = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = database.transaction(PACK_STORE, mode);
    const store = transaction.objectStore(PACK_STORE);
    const request = operation(store);

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => reject(transaction.error);
  });
}

function getClassName(spellClass) {
  return String(spellClass ?? "UnknownClass").split(".").filter(Boolean).at(-1) ?? "UnknownClass";
}

function countEffects(value) {
  if (!value || typeof value !== "object") return 0;
  let count = value.effect ? 1 : 0;
  for (const child of Object.values(value)) count += countEffects(child);
  return count;
}

function collectText(value, result = []) {
  if (typeof value === "string" || typeof value === "number") result.push(String(value));
  if (Array.isArray(value)) value.forEach((child) => collectText(child, result));
  if (isRecord(value)) Object.values(value).forEach((child) => collectText(child, result));
  return result;
}

function getTrigger(spell) {
  if (spell["right-click-cast-item"]) return "right-click";
  if (spell["left-click-cast-item"]) return "left-click";

  const modifierText = collectText(spell.modifiers).join(" ").toLowerCase();
  if (modifierText.includes("sneaking")) return "shift";
  return spell["cast-item"] ? "item-cast" : "internal";
}

function getItem(spell) {
  return spell["right-click-cast-item"] ?? spell["left-click-cast-item"] ?? spell["cast-item"] ?? "";
}

function getSearchText(name, spell, className) {
  return [name, className, getTrigger(spell), getItem(spell), ...collectText(spell)]
    .join(" ")
    .toLowerCase();
}

function parsePack(rawYaml) {
  try {
    // Legacy MagicSpells packs often contain repeated effect keys. Keep the final
    // value so the pack remains searchable, then emit normalized YAML on export.
    const parsed = YAML.load(rawYaml, { json: true });
    if (!isRecord(parsed)) return { parsed: {}, parseError: "YAML root is not a map." };
    return { parsed, parseError: null };
  } catch (error) {
    return { parsed: {}, parseError: error.message };
  }
}

function indexSpells(parsed) {
  return Object.entries(parsed)
    .filter(([, value]) => isRecord(value) && value["spell-class"])
    .map(([name, spell]) => {
      const className = getClassName(spell["spell-class"]);
      return {
        id: name,
        name,
        className,
        spellClass: spell["spell-class"],
        helper: Boolean(spell["helper-spell"]),
        trigger: getTrigger(spell),
        item: getItem(spell),
        effectCount: countEffects(spell.effects),
        searchText: getSearchText(name, spell, className),
      };
    });
}

async function decodeFile(file) {
  const buffer = await file.arrayBuffer();

  try {
    return new TextDecoder("utf-8", { fatal: true }).decode(buffer);
  } catch {
    return new TextDecoder("euc-kr").decode(buffer);
  }
}

function makePackTitle(file, rawYaml) {
  const relativePath = file.webkitRelativePath || file.name;
  const signature = `${relativePath}\n${rawYaml.slice(0, 12000)}`;

  if (/dandeluga|단데르가/i.test(signature)) return "대검 단데르가";
  if (/Vendetta|Ven_V|벤데타/i.test(signature)) return "벤데타";
  if (/Ex_Judgment_LS_MagicSquare_AE/.test(signature)) return "엑스칼리버 소드 이펙트";
  if (/Excalibur_M|ExC_SLM/.test(signature)) return "엑스칼리버 미카엘";
  if (/waterLancer|WLPain|WL_PainD|\blancer:/.test(signature)) return "물의 랜서";

  const rootFolder = relativePath.includes("/") ? relativePath.split("/")[0] : "";
  return rootFolder || file.name.replace(/\.ya?ml$/i, "");
}

function makePackId(file) {
  const relativePath = file.webkitRelativePath || file.name;
  return `${relativePath}-${file.size}-${file.lastModified}`;
}

function normalizeReference(value, parsed) {
  if (typeof value !== "string") return null;
  const direct = value.trim();
  if (parsed[direct]) return direct;

  const firstToken = direct.split(/[\s,:]+/)[0];
  return parsed[firstToken] ? firstToken : null;
}

function collectReferences(value, parsed, parentKey = "", result = new Set()) {
  if (REFERENCE_KEYS.has(parentKey)) {
    const values = Array.isArray(value) ? value : [value];
    values.forEach((item) => {
      const reference = normalizeReference(item, parsed);
      if (reference) result.add(reference);
    });
  }

  if (Array.isArray(value)) {
    value.forEach((child) => collectReferences(child, parsed, parentKey, result));
  } else if (isRecord(value)) {
    Object.entries(value).forEach(([key, child]) => collectReferences(child, parsed, key, result));
  }

  return result;
}

export async function listSpellPacks() {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  const packs = await runStore("readonly", (store) => store.getAll());
  return packs.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function importSpellFiles(fileList) {
  const files = Array.from(fileList).filter((file) => /\.ya?ml$/i.test(file.name));
  const imported = [];

  for (const file of files) {
    const pack = await createSpellPack(file);
    await runStore("readwrite", (store) => store.put(pack));
    imported.push(pack);
  }

  return imported;
}

export async function createSpellPack(file) {
  const rawYaml = await decodeFile(file);
  const { parsed, parseError } = parsePack(rawYaml);
  return {
    id: makePackId(file),
    title: makePackTitle(file, rawYaml),
    fileName: file.name,
    relativePath: file.webkitRelativePath || file.name,
    importedAt: new Date().toISOString(),
    rawYaml,
    parseError,
    spells: indexSpells(parsed),
  };
}

export async function deleteSpellPack(packId) {
  await runStore("readwrite", (store) => store.delete(packId));
}

function buildSpellChainFromParsed(parsed, spellName) {
  if (!parsed[spellName]) return { names: [], yaml: "" };

  const names = [];
  const visited = new Set();

  function visit(name) {
    if (visited.has(name) || !parsed[name] || names.length >= 80) return;
    visited.add(name);
    names.push(name);
    collectReferences(parsed[name], parsed).forEach(visit);
  }

  visit(spellName);
  const chain = Object.fromEntries(names.map((name) => [name, parsed[name]]));
  return { names, yaml: YAML.dump(chain, { lineWidth: -1, noRefs: true }) };
}

export function buildSpellChain(pack, spellName) {
  const { parsed } = parsePack(pack.rawYaml);
  return buildSpellChainFromParsed(parsed, spellName);
}

export function packsToRagExamples(packs) {
  return packs.flatMap((pack) => {
    const { parsed } = parsePack(pack.rawYaml);
    return pack.spells.map((spell) => {
      const snippet = YAML.dump({ [spell.name]: parsed[spell.name] }, { lineWidth: -1, noRefs: true }).slice(0, 12000);
      return {
        id: `database-${pack.id}-${spell.name}`,
        title: `${pack.title} / ${spell.name}`,
        tags: [spell.className, spell.trigger, spell.item, "database"].filter(Boolean),
        intent: `${spell.className} 기반 실제 MagicSpells 예제. 이펙트 ${spell.effectCount}개${spell.helper ? ", 헬퍼 스펠" : ""}.`,
        item: spell.item,
        trigger: spell.trigger,
        notes: [`Local database: ${pack.fileName}`, `Spell class: ${spell.spellClass}`],
        yaml: snippet,
      };
    });
  });
}
