// modules/features/abilities/data.js
// Catálogo básico de habilidades de criaturas

export const MONSTER_ABILITIES = {
  aliento_gelido: {
    key: "aliento_gelido",
    label: "Aliento Gélido",
    clazz: "monster",
    type: "attack",
    range: 3,
    area: 3,
    areaShape: "cone",
    element: "ice",
    descriptor: "frío",
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    requiresParts: ["head"],
    ct: { init: 1, exec: 1, rec: 2 },
    notes: "Cono de helada que hiela a los enemigos cercanos."
  },
  aullar_para_aliados: {
    key: "aullar_para_aliados",
    label: "Aullar para aliados",
    clazz: "monster",
    type: "support",
    range: 8,
    area: 8,
    areaShape: "circle",
    element: null,
    descriptor: "ánimo",
    requiresParts: ["head"],
    ct: { init: 1, exec: 0, rec: 2 },
    notes: "Aullido que inspira a los aliados cercanos."
  }
};

export function getMonsterAbility(key) {
  if (!key) return null;
  const normalized = String(key).toLowerCase();
  return MONSTER_ABILITIES[normalized] ?? null;
}

export function listMonsterAbilities() {
  return Object.values(MONSTER_ABILITIES);
}
