import {
  EFFECT_POSITIONS,
  EFFECT_TYPES,
  IMAGE_EFFECT_PRESETS,
  PARTICLES,
  SOUNDS,
  SPELL_CLASSES,
  SPELL_PRESETS,
  WIKI_BASE_URL,
} from "../data/spellOptions";

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

export function isRecord(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
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

export function getSpellWikiUrl(spellClass) {
  const className = getSpellClassName(spellClass);
  return `${WIKI_BASE_URL}/${encodeURIComponent(className)}`;
}

export function isTargetedSpell(spellClass) {
  return String(spellClass ?? "").includes(".targeted.");
}

export function isKnownSpellClass(spellClass) {
  return SPELL_CLASSES.includes(spellClass);
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

export function collectImageEffects(obj, result = []) {
  if (!obj || typeof obj !== "object") return result;

  if (
    obj.effect === "effectlib" &&
    ["Image", "ColoredImage"].includes(obj.effectlib?.class)
  ) {
    const effect = obj.effectlib;
    const preset = IMAGE_EFFECT_PRESETS.find((item) => item.fileName === effect.fileName) ?? IMAGE_EFFECT_PRESETS[0];

    result.push({
      className: effect.class,
      color: parseParticleColor(effect.color ?? preset.color, effect.particle),
      fileName: effect.fileName ?? preset.fileName,
      particle: effect.particle ?? PARTICLES[0],
      position: obj.position ?? "caster",
      pixels: preset.pixels,
      size: Number(effect.size ?? 0.08),
      stepX: Number(effect.stepX ?? 5),
      stepY: Number(effect.stepY ?? 5),
      invert: Boolean(effect.invert),
    });
  }

  for (const value of Object.values(obj)) collectImageEffects(value, result);
  return result;
}

function visitEffects(spell, visitor) {
  const effects = spell.effects;
  if (!effects || typeof effects !== "object") return;

  if (Array.isArray(effects)) {
    effects.forEach((effect, index) => visitor(effect, String(index)));
    return;
  }

  Object.entries(effects).forEach(([key, effect]) => visitor(effect, key));
}

function makeDiagnostic(severity, spellName, message, path = [spellName]) {
  return { id: `${severity}-${path.join("-")}-${message}`, severity, spellName, message, path };
}

export function validateSpellConfig(parsed) {
  if (!isRecord(parsed)) return [];

  const diagnostics = [];
  const calledSpellNames = new Set();

  for (const [spellName, spell] of Object.entries(parsed)) {
    if (!spell || typeof spell !== "object") {
      diagnostics.push(makeDiagnostic("error", spellName, "Spell entry must be a configuration section."));
      continue;
    }

    const spellClass = spell["spell-class"];

    if (!spellClass) {
      diagnostics.push(makeDiagnostic("error", spellName, "Missing required spell-class."));
    } else if (!isKnownSpellClass(spellClass)) {
      diagnostics.push(makeDiagnostic("warning", spellName, `Unknown or unlisted spell class: ${spellClass}`));
    }

    const called = spell.spells ?? [];
    if (called && !Array.isArray(called)) {
      diagnostics.push(makeDiagnostic("error", spellName, "spells must be a list of sub-spell names."));
    }

    if (Array.isArray(called)) {
      called.forEach((calledName, index) => {
        const normalizedName = String(calledName).split("(")[0];
        calledSpellNames.add(normalizedName);
        if (!parsed[normalizedName]) {
          diagnostics.push(
            makeDiagnostic("error", spellName, `Sub-spell "${normalizedName}" is not defined.`, [
              spellName,
              "spells",
              String(index),
            ]),
          );
        }
      });
    }

    if (String(spellClass ?? "").includes("AreaEffectSpell")) {
      if (!spell["horizontal-radius"]) {
        diagnostics.push(makeDiagnostic("warning", spellName, "AreaEffectSpell should define horizontal-radius."));
      }
      if (!spell["vertical-radius"]) {
        diagnostics.push(makeDiagnostic("warning", spellName, "AreaEffectSpell should define vertical-radius."));
      }
      if (!Array.isArray(spell.spells) || spell.spells.length === 0) {
        diagnostics.push(makeDiagnostic("info", spellName, "AreaEffectSpell usually casts one or more sub-spells."));
      }
    }

    if (isTargetedSpell(spellClass) && spell["target-players"] === undefined && spell["can-target"] === undefined) {
      diagnostics.push(makeDiagnostic("info", spellName, "Targeted spells can use can-target or target-players options."));
    }

    visitEffects(spell, (effect, effectKey) => {
      if (!effect || typeof effect !== "object") {
        diagnostics.push(
          makeDiagnostic("error", spellName, `Effect "${effectKey}" must be a configuration section.`, [
            spellName,
            "effects",
            effectKey,
          ]),
        );
        return;
      }

      if (!effect.position) {
        diagnostics.push(
          makeDiagnostic("error", spellName, `Effect "${effectKey}" is missing position.`, [
            spellName,
            "effects",
            effectKey,
          ]),
        );
      } else if (!EFFECT_POSITIONS.includes(effect.position)) {
        diagnostics.push(
          makeDiagnostic("warning", spellName, `Effect "${effectKey}" uses unlisted position "${effect.position}".`, [
            spellName,
            "effects",
            effectKey,
          ]),
        );
      }

      if (!effect.effect) {
        diagnostics.push(
          makeDiagnostic("error", spellName, `Effect "${effectKey}" is missing effect type.`, [
            spellName,
            "effects",
            effectKey,
          ]),
        );
      } else if (!EFFECT_TYPES.includes(effect.effect)) {
        diagnostics.push(
          makeDiagnostic("warning", spellName, `Effect "${effectKey}" uses unlisted effect type "${effect.effect}".`, [
            spellName,
            "effects",
            effectKey,
          ]),
        );
      }

      if (effect.effect === "effectlib" && effect.effectlib?.class === "EquationEffect") {
        for (const key of ["xEquation", "yEquation", "zEquation"]) {
          if (!effect.effectlib[key]) {
            diagnostics.push(
              makeDiagnostic("error", spellName, `EquationEffect "${effectKey}" is missing ${key}.`, [
                spellName,
                "effects",
                effectKey,
                "effectlib",
                key,
              ]),
            );
          }
        }
      }

      if (effect.effect === "effectlib" && ["Image", "ColoredImage"].includes(effect.effectlib?.class)) {
        if (!effect.effectlib.fileName) {
          diagnostics.push(
            makeDiagnostic("warning", spellName, `Image effect "${effectKey}" should define fileName.`, [
              spellName,
              "effects",
              effectKey,
              "effectlib",
              "fileName",
            ]),
          );
        }
      }
    });
  }

  for (const calledName of calledSpellNames) {
    if (parsed[calledName] && parsed[calledName]["helper-spell"] !== true) {
      diagnostics.push(
        makeDiagnostic("info", calledName, "Wiki recommends helper-spell: true for sub-spells in chains.", [
          calledName,
          "helper-spell",
        ]),
      );
    }
  }

  return diagnostics;
}

export function addEffect(parsed, spellName, type) {
  const next = structuredClone(parsed);
  if (!isRecord(next[spellName])) next[spellName] = { "spell-class": ".instant.DummySpell" };
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

  if (type === "image" || type === "coloredImage") {
    const preset = type === "coloredImage" ? IMAGE_EFFECT_PRESETS[1] : IMAGE_EFFECT_PRESETS[0];

    spell.effects[key] = {
      position: "caster",
      effect: "effectlib",
      effectlib: {
        class: type === "coloredImage" ? "ColoredImage" : "Image",
        particle: "redstone",
        fileName: preset.fileName,
        isGif: false,
        enableRotation: true,
        stepY: 5,
        stepX: 5,
        size: 0.08,
        iterations: 1,
        color: preset.color,
        period: 9,
        invert: false,
      },
    };
  }

  return next;
}

export function addNewSpell(parsed, type) {
  const next = isRecord(parsed) ? structuredClone(parsed) : {};
  const suffix = Date.now().toString().slice(-5);
  const preset = SPELL_PRESETS[type];

  if (!preset) return next;

  next[`new_${type}_${suffix}`] = structuredClone(preset.spell);

  return next;
}

export function addCalledSpell(parsed, spellName, calledSpellName) {
  const next = structuredClone(parsed);
  if (!isRecord(next[spellName])) next[spellName] = { "spell-class": ".MultiSpell" };
  const spell = next[spellName];

  if (!spell.spells) spell.spells = [];
  if (!spell.spells.includes(calledSpellName)) spell.spells.push(calledSpellName);

  return next;
}
