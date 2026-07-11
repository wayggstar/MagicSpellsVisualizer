export const sampleYaml = `
하델링_좌클릭pp1:
    spell-class: ".targeted.AreaEffectSpell"
    horizontal-radius: 8
    vertical-radius: 8
    point-blank: true
    target-caster: false
    target-players: true
    target-non-players: true
    fail-if-no-targets: false
    spells:
      - 하델링_1차데미지
    effects:
      0_1:
        position: caster
        effect: effectlib
        effectlib:
            class: EquationEffect
            particle: redstone
            color: 000000
            particles: 24
            duration: 240
            orientPitch: false
            xEquation: "3.5sin(0.08t)+1"
            yEquation: "1.5cos(0.08t)+1.6"
            zEquation: "2.4cos(0.08t)"
      1s:
        position: caster
        effect: sound
        sound: entity.wither.shoot
        volume: 1
        pitch: 0.6
        delay: 2

하델링_1차데미지:
    spell-class: ".targeted.PainSpell"
    damage: 10
`;

