import * as YAML from "js-yaml";
import { BASE_RAG_EXAMPLES, INPUT_SLOTS } from "../data/ragExamples";

const STORAGE_KEY = "magicspellsvisualizer.ragExamples.v1";

const KEYWORD_GROUPS = [
  { tags: ["heal", "healing", "회복", "치유"], value: "heal" },
  { tags: ["buff", "버프", "보호막", "shield", "barrier"], value: "buff" },
  { tags: ["dash", "돌진", "이동", "기동", "leap"], value: "dash" },
  { tags: ["area", "범위", "장판", "광역", "aoe"], value: "area" },
  { tags: ["ice", "얼음", "빙결", "slow", "슬로우"], value: "ice" },
  { tags: ["fire", "불", "화염", "meteor", "폭발"], value: "fire" },
  { tags: ["dark", "어둠", "shadow", "암흑"], value: "dark" },
  { tags: ["wind", "바람", "밀치", "knock", "push"], value: "wind" },
  { tags: ["stun", "기절", "속박", "root"], value: "control" },
  { tags: ["projectile", "투사체", "발사", "검기", "beam"], value: "projectile" },
];

function normalizeText(text) {
  return String(text ?? "").toLowerCase();
}

function extractKeywords(text) {
  const normalized = normalizeText(text);
  return KEYWORD_GROUPS
    .filter((group) => group.tags.some((tag) => normalized.includes(tag)))
    .map((group) => group.value);
}

function slugify(text, fallback = "spell") {
  const slug = normalizeText(text)
    .replace(/[^a-z0-9가-힣]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 28);

  return slug || fallback;
}

function readStoredExamples() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    const examples = raw ? JSON.parse(raw) : [];
    return Array.isArray(examples) ? examples : [];
  } catch {
    return [];
  }
}

export function loadRagExamples() {
  return [...readStoredExamples(), ...BASE_RAG_EXAMPLES];
}

export function saveRagExample(example) {
  const stored = readStoredExamples();
  const next = [{ ...example, id: `custom-${Date.now()}` }, ...stored].slice(0, 80);
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  return next;
}

export function searchExamples(query, examples, limit = 4) {
  const queryKeywords = extractKeywords(query);
  const terms = normalizeText(query).split(/\s+/).filter(Boolean);

  return examples
    .map((example) => {
      const haystack = normalizeText([
        example.title,
        example.intent,
        example.item,
        example.trigger,
        ...(example.tags ?? []),
        ...(example.notes ?? []),
      ].join(" "));
      const keywordScore = queryKeywords.filter((keyword) => haystack.includes(keyword)).length * 4;
      const termScore = terms.filter((term) => haystack.includes(term)).length;
      const triggerScore = INPUT_SLOTS.some((slot) => haystack.includes(slot.trigger) && query.includes(slot.label)) ? 2 : 0;

      return { ...example, score: keywordScore + termScore + triggerScore };
    })
    .filter((example) => example.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}

function pickParticle(keywords) {
  if (keywords.includes("ice")) return "snowflake";
  if (keywords.includes("fire")) return "flame";
  if (keywords.includes("dark")) return "soul";
  if (keywords.includes("wind")) return "cloud";
  if (keywords.includes("heal") || keywords.includes("buff")) return "end_rod";
  return "redstone";
}

function pickSound(keywords) {
  if (keywords.includes("fire")) return "entity.generic.explode";
  if (keywords.includes("dark")) return "entity.wither.shoot";
  if (keywords.includes("heal") || keywords.includes("buff")) return "item.totem.use";
  if (keywords.includes("ice")) return "block.glass.break";
  return "entity.evoker.cast_spell";
}

function makeHelperSpell(baseName, description, keywords) {
  if (keywords.includes("heal")) {
    return {
      [`${baseName}_heal`]: {
        "spell-class": ".targeted.HealSpell",
        "helper-spell": true,
        amount: 8,
      },
    };
  }

  if (keywords.includes("buff")) {
    return {
      [`${baseName}_buff`]: {
        "spell-class": ".buff.DummySpell",
        "helper-spell": true,
        duration: 6,
        effects: {
          active: {
            position: "buffeffectlib",
            effect: "effectlib",
            effectlib: {
              class: "Shield",
              particle: pickParticle(keywords),
              radius: 2.2,
              particles: 80,
              period: 1,
              iterations: 120,
            },
          },
        },
      },
    };
  }

  if (keywords.includes("control") || keywords.includes("ice")) {
    return {
      [`${baseName}_control`]: {
        "spell-class": ".targeted.PotionEffectSpell",
        "helper-spell": true,
        type: keywords.includes("ice") ? "slowness" : "slowness",
        strength: 3,
        duration: 80,
      },
    };
  }

  return {
    [`${baseName}_damage`]: {
      "spell-class": ".targeted.PainSpell",
      "helper-spell": true,
      damage: keywords.includes("fire") ? 12 : 8,
    },
  };
}

function makeTriggerSpell(projectName, slot, description) {
  const keywords = extractKeywords(description);
  const baseName = `${projectName}_${slot.trigger.replace(/-/g, "_")}`;
  const helperSpells = makeHelperSpell(baseName, description, keywords);
  const helperName = Object.keys(helperSpells)[0];
  const particle = pickParticle(keywords);
  const sound = pickSound(keywords);
  const useArea = keywords.includes("area") || keywords.includes("fire") || keywords.includes("control") || keywords.includes("ice");
  const useProjectile = keywords.includes("projectile") || keywords.includes("dash") || slot.trigger.includes("left");
  const publicSpell = useArea
    ? {
        "spell-class": ".targeted.AreaEffectSpell",
        "horizontal-radius": keywords.includes("fire") ? 5 : 4,
        "vertical-radius": 3,
        "point-blank": true,
        "target-caster": false,
        "target-players": true,
        "target-non-players": true,
        "fail-if-no-targets": false,
        spells: [helperName],
        effects: {
          cast: {
            position: "caster",
            effect: "effectlib",
            effectlib: {
              class: keywords.includes("buff") ? "Shield" : "Circle",
              particle,
              radius: keywords.includes("fire") ? 3 : 2.4,
              particles: 72,
              period: 2,
              iterations: 80,
            },
          },
          sound: {
            position: "caster",
            effect: "sound",
            sound,
            volume: 1,
            pitch: 1,
          },
        },
      }
    : {
        "spell-class": ".MultiSpell",
        spells: useProjectile ? [`${baseName}_projectile`, helperName] : [helperName],
        effects: {
          sound: {
            position: "caster",
            effect: "sound",
            sound,
            volume: 1,
            pitch: keywords.includes("dark") ? 0.75 : 1,
          },
        },
      };

  const projectileSpell = useProjectile
    ? {
        [`${baseName}_projectile`]: {
          "spell-class": ".instant.ParticleProjectileSpell",
          "helper-spell": true,
          "projectile-velocity": keywords.includes("dash") ? 28 : 20,
          "tick-interval": 1,
          "max-distance": keywords.includes("dash") ? 16 : 20,
          effects: {
            trail: {
              position: "special",
              effect: "effectlib",
              effectlib: {
                class: keywords.includes("wind") ? "Wave" : "Helix",
                particle,
                radius: 0.8,
                particles: 36,
                period: 1,
                iterations: 80,
              },
            },
          },
        },
      }
    : {};

  return {
    spellName: baseName,
    yaml: {
      [baseName]: publicSpell,
      ...projectileSpell,
      ...helperSpells,
    },
    plan: {
      trigger: slot.trigger,
      label: slot.label,
      description,
      spellName: baseName,
      helpers: Object.keys({ ...projectileSpell, ...helperSpells }),
      keywords,
      pattern: useArea ? "AreaEffectSpell chain" : useProjectile ? "MultiSpell projectile chain" : "MultiSpell helper chain",
    },
  };
}

export function buildMapleSpellProject(form, examples = loadRagExamples()) {
  const projectName = slugify(form.name || form.item || "maple_spell", "maple_spell");
  const activeSlots = INPUT_SLOTS
    .map((slot) => ({ ...slot, description: form.slots?.[slot.id]?.trim() ?? "" }))
    .filter((slot) => slot.description && !/^없음|none|no$/i.test(slot.description));
  const query = [
    form.item,
    form.concept,
    activeSlots.map((slot) => `${slot.label} ${slot.description}`).join(" "),
  ].join(" ");
  const retrieved = searchExamples(query, examples, 5);
  const spellSections = {};
  const plans = [];

  for (const slot of activeSlots) {
    const built = makeTriggerSpell(projectName, slot, slot.description);
    Object.assign(spellSections, built.yaml);
    plans.push(built.plan);
  }

  const itemId = form.item?.trim() || "netherite_sword";
  const triggerMap = Object.fromEntries(plans.map((plan) => [plan.trigger, plan.spellName]));
  const itemConfig = {
    [`${projectName}_item`]: {
      item: itemId,
      name: form.displayName || `${projectName} item`,
      lore: [
        form.concept || "Generated MagicSpells item",
        ...plans.map((plan) => `${plan.label}: ${plan.description}`),
      ],
      spells: triggerMap,
    },
  };
  const yaml = YAML.dump(spellSections, { lineWidth: -1, noRefs: true });
  const itemYaml = YAML.dump(itemConfig, { lineWidth: -1, noRefs: true });
  const prompt = [
    "You are a MagicSpells YAML architect.",
    "Use retrieved examples as style references, not as exact copies.",
    `Item: ${itemId}`,
    `Concept: ${form.concept || "No extra concept"}`,
    "Triggers:",
    ...plans.map((plan) => `- ${plan.label} (${plan.trigger}): ${plan.description}`),
    "Required output: spell structure, helper spells, effects, and final YAML.",
    "Retrieved examples:",
    ...retrieved.map((example) => `- ${example.title}: ${example.intent}`),
  ].join("\n");

  return {
    itemConfig,
    itemYaml,
    plans,
    prompt,
    retrieved,
    spellSections,
    yaml,
  };
}
