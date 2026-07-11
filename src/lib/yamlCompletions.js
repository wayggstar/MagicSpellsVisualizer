import { autocompletion, startCompletion } from "@codemirror/autocomplete";
import { EditorView } from "@codemirror/view";
import {
  EFFECT_POSITIONS,
  EFFECT_TYPES,
  PARTICLES,
  SOUNDS,
  SPELL_CLASSES,
  YAML_OPTION_KEYS,
} from "../data/spellOptions";

function quoted(value) {
  return `"${value}"`;
}

const keyCompletions = YAML_OPTION_KEYS.map((key) => ({
  label: key,
  type: "property",
  apply: `${key}: `,
  detail: "MagicSpells option",
}));

const valueCompletions = [
  ...SPELL_CLASSES.map((value) => ({ label: value, type: "class", apply: quoted(value), detail: "spell-class" })),
  ...PARTICLES.map((value) => ({ label: value, type: "constant", detail: "particle" })),
  ...EFFECT_TYPES.map((value) => ({ label: value, type: "keyword", detail: "effect" })),
  ...EFFECT_POSITIONS.map((value) => ({ label: value, type: "keyword", detail: "position" })),
  ...SOUNDS.map((value) => ({ label: value, type: "constant", detail: "sound" })),
  { label: "true", type: "keyword" },
  { label: "false", type: "keyword" },
];

function linePrefix(context) {
  const line = context.state.doc.lineAt(context.pos);
  return line.text.slice(0, context.pos - line.from);
}

function completionResult(context, options) {
  const word = context.matchBefore(/["']?[\w.-]*/);
  if (!word || (word.from === word.to && !context.explicit)) return null;

  return {
    from: word.text.startsWith("\"") || word.text.startsWith("'") ? word.from + 1 : word.from,
    options,
    validFor: /^[\w.-]*$/,
  };
}

function magicSpellsCompletion(context) {
  const prefix = linePrefix(context);
  const trimmed = prefix.trimStart();

  if (trimmed.startsWith("- ")) return completionResult(context, valueCompletions);
  if (/:\s*["']?[\w.-]*$/.test(prefix)) return completionResult(context, valueCompletions);
  return completionResult(context, keyCompletions);
}

export function magicSpellsYamlCompletions() {
  return [
    autocompletion({
      override: [magicSpellsCompletion],
      activateOnTyping: true,
      closeOnBlur: false,
    }),
    EditorView.updateListener.of((update) => {
      if (!update.docChanged) return;
      const cursor = update.state.selection.main;
      if (!cursor.empty) return;
      const charBefore = update.state.sliceDoc(Math.max(0, cursor.head - 1), cursor.head);
      if (!/[\w.-]/.test(charBefore)) return;
      startCompletion(update.view);
    }),
  ];
}
