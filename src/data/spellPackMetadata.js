const COLOMBINA_METADATA = {
  id: "colombina-hyposeleina",
  title: "콜롬비나 - 하이포셀레니아",
  summary: "물의 칼날과 달의 영역을 사용하는 복합 배포팩. MagicSpells가 공격과 이펙트를 담당하고 Skript가 6초간 피해 유형을 누적해 달 반응을 판정한다.",
  tags: ["water", "moon", "reaction", "lightning", "nature", "melee", "area", "skript", "image-effect"],
  requirements: ["MagicSpells 4.0 Beta 17", "Skript 2.12.2", "EffectLib 9.0"],
  commandBridges: {
    colskill1: ["콜롬비나_범위2", "콜롬비나_dummy"],
    colskill2: ["콜롬비나_dummy2"],
  },
  skills: [
    { trigger: "좌클릭", name: "달 이슬비", description: "물의 칼날을 적에게 날리는 기본 공격." },
    { trigger: "쉬좌", name: "달 이슬비 강공격", description: "달 형상의 충격파를 일으키는 강공격." },
    { trigger: "우클릭", name: "아득한 조석", description: "지속적으로 자신 주변에 물 충격파를 일으키고, 명중한 적에게 6초간 피해 유형을 누적한다." },
    { trigger: "쉬우", name: "향수에 잠긴 달", description: "달 영역을 전개한다. 영역 안에서 발생한 달 반응 피해 계수가 50% 증가한다." },
  ],
  reactions: [
    { name: "달 감전", description: "번개 피해 누적량이 가장 높으면 누적량의 100% 피해. 번개 피해는 원래 피해의 2배로 누적된다." },
    { name: "달 개화", description: "낙하, 용암, 불, 가루눈, 폭발 등 자연 피해 누적량이 가장 높으면 누적량의 50% 피해를 3회 준다." },
    { name: "달 결정", description: "기본 근접 공격 누적량이 가장 높으면 누적량의 75%만큼 대상을 중심으로 범위 피해를 준다." },
  ],
};

export function resolveSpellPackMetadata(rawYaml, supportText = "") {
  const signature = `${rawYaml}\n${supportText}`;
  if (/콜롬비나|colskill1|달감전|달개화|달결정/.test(signature)) return COLOMBINA_METADATA;
  return null;
}

export function normalizePackResourceName(fileName, metadataId) {
  if (metadataId !== COLOMBINA_METADATA.id) return fileName;

  if (fileName.endsWith("E.png")) return "콜롬비나E.png";
  if (fileName.includes("_∆Ú≈∏")) return "콜롬비나_평타.png";
  if (fileName.includes("_≥Ø∞≥")) return "콜롬비나_날개.png";
  if (fileName.includes("_∞≠∞¯")) return "콜롬비나_강공.png";
  if (/\.sk$/i.test(fileName)) return "콜롬비나.sk";
  if (/\.txt$/i.test(fileName)) return "적용법.txt";
  return fileName;
}
