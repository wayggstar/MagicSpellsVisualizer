import { PARTICLES, SOUNDS } from "../data/spellOptions";

export function normalizeEquation(expr) {
  return String(expr)
    .replace(/(\d)(sin|cos|tan)/g, "$1*$2")
    .replace(/(\d)t/g, "$1*t")
    .replace(/\)(\d)/g, ")*$1")
    .replace(/t(\d)/g, "t*$1");
}

export function parseParticleColor(color, particle) {
  if (["smoke", "large_smoke", "campfire_cosy_smoke"].includes(particle)) return "#555555";
  if (["flame", "small_flame", "soul_fire_flame"].includes(particle)) return "#ff6600";
  if (particle === "cloud") return "#eeeeee";
  if (!color) return "#ffffff";

  const text = String(color).replace("#", "").trim();
  return /^[0-9a-fA-F]{6}$/.test(text) ? `#${text}` : "#ffffff";
}

export function getByPath(obj, path) {
  if (!path) return undefined;
  return path.reduce((acc, key) => acc?.[key], obj);
}

export function updateByPath(obj, path, updater) {
  const clone = structuredClone(obj);
  let target = clone;

  for (let i = 0; i < path.length - 1; i += 1) {
    target = target[path[i]];
  }

  const last = path[path.length - 1];
  target[last] = updater(target[last]);
  return clone;
}

export function getSpellClassName(spellClass) {
  if (!spellClass) return "UnknownClass";
  return String(spellClass).split(".").filter(Boolean).at(-1);
}

export function collectEquations(obj, result = []) {
  if (!obj || typeof obj !== "object") return result;

  if (
    obj.effect === "effectlib" &&
    obj.effectlib?.class === "EquationEffect" &&
    obj.effectlib.xEquation &&
    obj.effectlib.yEquation &&
    obj.effectlib.zEquation
  ) {
    const effect = obj.effectlib;

    result.push({
      color: parseParticleColor(effect.color, effect.particle),
      particle: effect.particle ?? PARTICLES[0],
      position: obj.position ?? "caster",
      particles: Number(effect.particles ?? 24),
      duration: Number(effect.duration ?? 120),
      delay: Number(obj.delay ?? effect.delay ?? 0),
      x: normalizeEquation(effect.xEquation),
      y: normalizeEquation(effect.yEquation),
      z: normalizeEquation(effect.zEquation),
    });
  }

  for (const value of Object.values(obj)) collectEquations(value, result);
  return result;
}

export function collectAreas(obj, result = []) {
  if (!obj || typeof obj !== "object") return result;

  if (
    String(obj["spell-class"] ?? "").includes("AreaEffectSpell") &&
    obj["horizontal-radius"] &&
    obj["vertical-radius"]
  ) {
    result.push({
      horizontal: Number(obj["horizontal-radius"]),
      vertical: Number(obj["vertical-radius"]),
    });
  }

  for (const value of Object.values(obj)) collectAreas(value, result);
  return result;
}

export function collectSounds(obj, result = []) {
  if (!obj || typeof obj !== "object") return result;
  if (obj.effect === "sound" && obj.sound) result.push(obj);
  for (const value of Object.values(obj)) collectSounds(value, result);
  return result;
}

export function addEffect(parsed, spellName, type) {
  const next = structuredClone(parsed);
  const spell = next[spellName];
  if (!spell.effects) spell.effects = {};

  const key = `${type}_${Date.now().toString().slice(-5)}`;

  if (type === "equation") {
    spell.effects[key] = {
      position: "caster",
      effect: "effectlib",
      effectlib: {
        class: "EquationEffect",
        particle: PARTICLES[0],
        color: "800020",
        particles: 24,
        duration: 120,
        orientPitch: false,
        xEquation: "3sin(0.1t)",
        yEquation: "1.2cos(0.1t)+1.6",
        zEquation: "0.05t",
      },
    };
  }

  if (type === "sound") {
    spell.effects[key] = {
      position: "caster",
      effect: "sound",
      sound: SOUNDS[0],
      volume: 1,
      pitch: 1,
      delay: 0,
    };
  }

  return next;
}

export function addNewSpell(parsed, type) {
  const next = structuredClone(parsed ?? {});
  const suffix = Date.now().toString().slice(-5);

  if (type === "multi") {
    next[`new_multi_${suffix}`] = {
      "spell-class": ".MultiSpell",
      spells: [],
    };
  }

  if (type === "area") {
    next[`new_area_${suffix}`] = {
      "spell-class": ".targeted.AreaEffectSpell",
      "horizontal-radius": 5,
      "vertical-radius": 3,
      "point-blank": true,
      "target-caster": false,
      "target-players": true,
      "target-non-players": true,
      "fail-if-no-targets": false,
      spells: [],
      effects: {},
    };
  }

  if (type === "projectile") {
    next[`new_projectile_${suffix}`] = {
      "spell-class": ".instant.ParticleProjectileSpell",
      "projectile-velocity": 20,
      "tick-interval": 1,
      "max-distance": 20,
      effects: {
        trail: {
          position: "special",
          effect: "effectlib",
          effectlib: {
            class: "EquationEffect",
            particle: "crit",
            particles: 12,
            duration: 80,
            orientPitch: false,
            xEquation: "0",
            yEquation: "1.6",
            zEquation: "0.12t",
          },
        },
      },
    };
  }

  return next;
}

export function addCalledSpell(parsed, spellName, calledSpellName) {
  const next = structuredClone(parsed);
  const spell = next[spellName];

  if (!spell.spells) spell.spells = [];
  if (!spell.spells.includes(calledSpellName)) spell.spells.push(calledSpellName);

  return next;
}

