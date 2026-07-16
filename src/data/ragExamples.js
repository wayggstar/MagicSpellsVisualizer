export const BASE_RAG_EXAMPLES = [
  {
    id: "dark-sword-combo",
    title: "Dark Sword Combo",
    tags: ["sword", "dash", "dark", "left", "right", "combo"],
    intent: "A netherite sword with a right-click dash slash and left-click close range burst.",
    item: "netherite_sword",
    trigger: "right-click",
    notes: [
      "Use MultiSpell as the public trigger.",
      "Use ParticleProjectileSpell for a moving slash trail.",
      "Use PainSpell as the damage helper.",
      "Use sound and EffectLib Circle/Helix for feedback.",
    ],
    yaml: `dark_sword_right:
  spell-class: ".MultiSpell"
  spells:
    - dark_sword_dash
    - dark_sword_damage
  effects:
    cast:
      position: caster
      effect: sound
      sound: entity.wither.shoot
      volume: 1
      pitch: 0.8
dark_sword_dash:
  spell-class: ".instant.ParticleProjectileSpell"
  helper-spell: true
  projectile-velocity: 24
  tick-interval: 1
  max-distance: 14
  effects:
    trail:
      position: special
      effect: effectlib
      effectlib:
        class: Helix
        particle: soul
        radius: 0.8
        particles: 36
dark_sword_damage:
  spell-class: ".targeted.PainSpell"
  helper-spell: true
  damage: 8`,
  },
  {
    id: "ice-root-control",
    title: "Ice Root Control",
    tags: ["ice", "root", "slow", "stun", "control", "shift"],
    intent: "A shift cast that locks enemies in place and shows a cold ring.",
    item: "diamond_hoe",
    trigger: "shift-right",
    notes: [
      "Use AreaEffectSpell to gather targets.",
      "Chain PotionEffectSpell or StunSpell for crowd control.",
      "Use Circle/Sphere EffectLib to show an area.",
    ],
    yaml: `ice_root_shift_right:
  spell-class: ".targeted.AreaEffectSpell"
  horizontal-radius: 6
  vertical-radius: 3
  point-blank: true
  target-players: true
  target-non-players: true
  spells:
    - ice_root_slow
  effects:
    ring:
      position: caster
      effect: effectlib
      effectlib:
        class: Circle
        particle: snowflake
        radius: 3
        particles: 64
ice_root_slow:
  spell-class: ".targeted.PotionEffectSpell"
  helper-spell: true
  type: slowness
  strength: 3
  duration: 80`,
  },
  {
    id: "holy-heal-buff",
    title: "Holy Heal Buff",
    tags: ["heal", "buff", "shield", "holy", "support", "right"],
    intent: "A right-click support spell that heals and applies a short protective buff.",
    item: "golden_sword",
    trigger: "right-click",
    notes: [
      "Use HealSpell for instant recovery.",
      "Use buff DummySpell for active repeating visuals.",
      "Use Shield EffectLib on buffeffectlib position.",
    ],
    yaml: `holy_right:
  spell-class: ".MultiSpell"
  spells:
    - holy_heal
    - holy_barrier
holy_heal:
  spell-class: ".targeted.HealSpell"
  helper-spell: true
  amount: 8
holy_barrier:
  spell-class: ".buff.DummySpell"
  helper-spell: true
  duration: 6
  effects:
    active:
      position: buffeffectlib
      effect: effectlib
      effectlib:
        class: Shield
        particle: end_rod
        radius: 2.4
        particles: 80`,
  },
  {
    id: "meteor-shift-left",
    title: "Meteor Shift Left",
    tags: ["meteor", "fire", "area", "burst", "shift-left", "explosion"],
    intent: "A shift-left cast that calls down a fire area burst.",
    item: "blaze_rod",
    trigger: "shift-left",
    notes: [
      "Use AreaEffectSpell for impact area.",
      "Use DamageSpell/PainSpell for damage.",
      "Use Explode/Sphere EffectLib for impact visuals.",
    ],
    yaml: `meteor_shift_left:
  spell-class: ".targeted.AreaEffectSpell"
  horizontal-radius: 5
  vertical-radius: 4
  target-players: true
  target-non-players: true
  spells:
    - meteor_damage
  effects:
    impact:
      position: target
      effect: effectlib
      effectlib:
        class: Sphere
        particle: flame
        radius: 2.5
        particles: 100
meteor_damage:
  spell-class: ".targeted.PainSpell"
  helper-spell: true
  damage: 12`,
  },
  {
    id: "wind-double-shift",
    title: "Wind Double Shift",
    tags: ["wind", "mobility", "double-shift", "dash", "buff"],
    intent: "A double shift mobility spell with a temporary speed buff.",
    item: "feather",
    trigger: "double-shift",
    notes: [
      "Use LeapSpell or VelocitySpell for movement.",
      "Use PotionEffectSpell for speed.",
      "Use Wave/Line EffectLib for wind trails.",
    ],
    yaml: `wind_double_shift:
  spell-class: ".MultiSpell"
  spells:
    - wind_leap
    - wind_speed
wind_leap:
  spell-class: ".instant.LeapSpell"
  helper-spell: true
  forward-velocity: 14
  upward-velocity: 5
wind_speed:
  spell-class: ".targeted.PotionEffectSpell"
  helper-spell: true
  type: speed
  strength: 2
  duration: 100`,
  },
];

export const INPUT_SLOTS = [
  { id: "rightClick", label: "우클릭", trigger: "right-click", placeholder: "예: 전방으로 검기 발사 후 폭발" },
  { id: "leftClick", label: "좌클릭", trigger: "left-click", placeholder: "예: 가까운 대상에게 연속 베기" },
  { id: "shiftLeft", label: "쉬좌", trigger: "shift-left", placeholder: "예: 바닥에 범위 장판 생성" },
  { id: "shiftRight", label: "쉬우", trigger: "shift-right", placeholder: "예: 자신에게 보호막/버프" },
  { id: "doubleShift", label: "쉬쉬", trigger: "double-shift", placeholder: "예: 기동기, 순간 이동, 버프" },
];
