import * as YAML from "js-yaml";
import { normalizePackResourceName, resolveSpellPackMetadata } from "../data/spellPackMetadata.js";
import { rasterizeImageFile } from "./imagePreview.js";

const DATABASE_NAME = "magicspellsvisualizer";
const DATABASE_VERSION = 1;
const PACK_STORE = "spellPacks";
const SUPPORT_FILE_PATTERN = /\.(sk|txt|png|jpe?g|webp|gif)$/i;
const IMAGE_FILE_PATTERN = /\.(png|jpe?g|webp|gif)$/i;

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

function makePackTitle(file, rawYaml, metadata) {
  if (metadata?.title) return metadata.title;
  const relativePath = file.webkitRelativePath || file.name;
  const signature = `${relativePath}\n${rawYaml.slice(0, 12000)}`;

  if (/dandeluga|단데르가/i.test(signature)) return "대검 단데르가";
  if (/Vendetta|Ven_V|벤데타/i.test(signature)) return "벤데타";
  if (/Excalibur_M|ExC_SLM/.test(signature)) return "엑스칼리버 미카엘";
  if (/Ex_Judgment_LS_MagicSquare_AE/.test(signature)) return "엑스칼리버 소드 이펙트";
  if (/waterLancer|WLPain|WL_PainD|\blancer:/.test(signature)) return "물의 랜서";

  const rootFolder = relativePath.includes("/") ? relativePath.split("/")[0] : "";
  return rootFolder || file.name.replace(/\.ya?ml$/i, "");
}

function makePackId(file) {
  const relativePath = file.webkitRelativePath || file.name;
  return `${relativePath}-${file.size}-${file.lastModified}`;
}

function getFileRoot(file) {
  const relativePath = file.webkitRelativePath || "";
  return relativePath.includes("/") ? relativePath.split("/")[0] : "";
}

function collectImagePaths(value, result = new Set()) {
  if (!value || typeof value !== "object") return result;

  if (typeof value.fileName === "string") result.add(value.fileName.trim());
  for (const child of Object.values(value)) collectImagePaths(child, result);
  return result;
}

async function readTextResources(files) {
  return Promise.all(files.filter((file) => /\.(sk|txt)$/i.test(file.name)).map(async (file) => ({
    kind: "text",
    name: file.name,
    originalName: file.name,
    relativePath: file.webkitRelativePath || file.name,
    language: /\.sk$/i.test(file.name) ? "skript" : "text",
    content: await decodeFile(file),
  })));
}

async function buildSupportFiles(files, metadata, parsed, textResources) {
  const imagePaths = [...collectImagePaths(parsed)];
  const normalizedTextResources = textResources.map((resource) => ({
    ...resource,
    name: normalizePackResourceName(resource.name, metadata?.id),
  }));
  const imageResources = [];

  for (const file of files.filter((candidate) => IMAGE_FILE_PATTERN.test(candidate.name))) {
    const name = normalizePackResourceName(file.name, metadata?.id);
    const matchedPath = imagePaths.find((path) => path.split("/").at(-1) === name) ?? name;
    try {
      imageResources.push({
        kind: "image",
        name,
        originalName: file.name,
        relativePath: file.webkitRelativePath || file.name,
        effectPath: matchedPath,
        preview: await rasterizeImageFile(file),
      });
    } catch {
      imageResources.push({
        kind: "image",
        name,
        originalName: file.name,
        relativePath: file.webkitRelativePath || file.name,
        effectPath: matchedPath,
        preview: null,
        error: "Could not rasterize this image.",
      });
    }
  }

  return [...normalizedTextResources, ...imageResources];
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

function collectSupportCommandBridges(supportFiles, parsed, metadata) {
  const bridges = new Map();
  const commandPattern = /^command\s+\/([^:\s]+):\s*\n([\s\S]*?)(?=^(?:command|every|on)\b|(?![\s\S]))/gim;

  for (const resource of supportFiles.filter((item) => item.kind === "text" && item.language === "skript")) {
    for (const match of resource.content.matchAll(commandPattern)) {
      const references = new Set();
      const castPattern = /\/ms\s+cast(?:\s+as\s+\S+)?\s+([^\s"]+)/gi;

      for (const castMatch of match[2].matchAll(castPattern)) {
        const reference = normalizeReference(castMatch[1], parsed);
        if (reference) references.add(reference);
      }

      bridges.set(match[1].toLowerCase(), references);
    }
  }

  for (const [command, names] of Object.entries(metadata?.commandBridges ?? {})) {
    const references = bridges.get(command.toLowerCase()) ?? new Set();
    names.forEach((name) => {
      const reference = normalizeReference(name, parsed);
      if (reference) references.add(reference);
    });
    bridges.set(command.toLowerCase(), references);
  }

  return bridges;
}

function collectCommandReferences(spell, parsed, supportBridges) {
  const references = new Set();
  const commands = spell["command-to-execute"];

  for (const command of Array.isArray(commands) ? commands : commands ? [commands] : []) {
    const text = String(command).trim().replace(/^\//, "");
    const directCast = text.match(/^c\s+([^\s]+)/i);
    if (directCast) {
      const reference = normalizeReference(directCast[1], parsed);
      if (reference) references.add(reference);
    }

    const commandName = text.split(/\s+/)[0].toLowerCase();
    supportBridges.get(commandName)?.forEach((reference) => references.add(reference));
  }

  return references;
}

export async function listSpellPacks() {
  if (typeof window === "undefined" || !window.indexedDB) return [];
  const packs = await runStore("readonly", (store) => store.getAll());
  return packs.sort((a, b) => b.importedAt.localeCompare(a.importedAt));
}

export async function importSpellFiles(fileList) {
  const allFiles = Array.from(fileList);
  const files = allFiles.filter((file) => /\.ya?ml$/i.test(file.name));
  const imported = [];

  for (const file of files) {
    const root = getFileRoot(file);
    const supportFiles = allFiles.filter((candidate) => {
      if (!SUPPORT_FILE_PATTERN.test(candidate.name)) return false;
      return !root || getFileRoot(candidate) === root;
    });
    const pack = await createSpellPack(file, supportFiles);
    await runStore("readwrite", (store) => store.put(pack));
    imported.push(pack);
  }

  return imported;
}

export async function createSpellPack(file, supportSourceFiles = []) {
  const rawYaml = await decodeFile(file);
  const { parsed, parseError } = parsePack(rawYaml);
  const textResources = await readTextResources(supportSourceFiles);
  const supportText = textResources.map((resource) => resource.content).join("\n");
  const metadata = resolveSpellPackMetadata(rawYaml, supportText);
  const supportFiles = await buildSupportFiles(supportSourceFiles, metadata, parsed, textResources);
  const imagePreviewAssets = Object.fromEntries(supportFiles
    .filter((resource) => resource.kind === "image" && resource.preview)
    .map((resource) => [resource.effectPath, resource.preview]));

  return {
    id: makePackId(file),
    title: makePackTitle(file, rawYaml, metadata),
    fileName: file.name,
    relativePath: file.webkitRelativePath || file.name,
    importedAt: new Date().toISOString(),
    rawYaml,
    parseError,
    spells: indexSpells(parsed),
    metadata,
    supportFiles,
    imagePreviewAssets,
  };
}

export async function deleteSpellPack(packId) {
  await runStore("readwrite", (store) => store.delete(packId));
}

function buildSpellChainFromParsed(parsed, spellName, supportBridges = new Map()) {
  if (!parsed[spellName]) return { names: [], yaml: "" };

  const names = [];
  const visited = new Set();

  function visit(name) {
    if (visited.has(name) || !parsed[name] || names.length >= 80) return;
    visited.add(name);
    names.push(name);
    collectReferences(parsed[name], parsed).forEach(visit);
    collectCommandReferences(parsed[name], parsed, supportBridges).forEach(visit);
  }

  visit(spellName);
  const chain = Object.fromEntries(names.map((name) => [name, parsed[name]]));
  return { names, yaml: YAML.dump(chain, { lineWidth: -1, noRefs: true }) };
}

export function buildSpellChain(pack, spellName) {
  const { parsed } = parsePack(pack.rawYaml);
  const supportBridges = collectSupportCommandBridges(pack.supportFiles ?? [], parsed, pack.metadata);
  return buildSpellChainFromParsed(parsed, spellName, supportBridges);
}

export function packsToRagExamples(packs) {
  return packs.flatMap((pack) => {
    const { parsed } = parsePack(pack.rawYaml);
    return pack.spells.map((spell) => {
      const snippet = YAML.dump({ [spell.name]: parsed[spell.name] }, { lineWidth: -1, noRefs: true }).slice(0, 12000);
      return {
        id: `database-${pack.id}-${spell.name}`,
        title: `${pack.title} / ${spell.name}`,
        tags: [spell.className, spell.trigger, spell.item, ...(pack.metadata?.tags ?? []), "database"].filter(Boolean),
        intent: pack.metadata?.summary ?? `${spell.className} 기반 실제 MagicSpells 예제. 이펙트 ${spell.effectCount}개${spell.helper ? ", 헬퍼 스펠" : ""}.`,
        item: spell.item,
        trigger: spell.trigger,
        notes: [
          `Local database: ${pack.fileName}`,
          `Spell class: ${spell.spellClass}`,
          ...(pack.metadata?.skills ?? []).map((skill) => `${skill.trigger} ${skill.name}: ${skill.description}`),
          ...(pack.metadata?.reactions ?? []).map((reaction) => `${reaction.name}: ${reaction.description}`),
        ],
        yaml: snippet,
      };
    });
  });
}
