// Catálogo simple de poderes de reliquia (mismo formato base que MANEUVERS)
export const RELIC_POWERS = {
  onda_choque: {
    label: "Onda de Choque",
    type: "attack",
    category: "active",
    clazz: "relic_power",
    range: 0,            // autocentrado
    area: 4,             // radio en casillas
    areaShape: "circle",
    areaWidth: null,
    element: "earth",
    save: "resistance",
    requires: "Sintonización con reliquia",
    descriptor: "impacto",
    duration: null,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    effect: "Emite una onda expansiva que empuja y daña a los cercanos.",
    levels: ["N1","N2","N3"],
    compLevels: 3,
    ct: { init: 1, exec: 1, rec: 1 },
  },

  estallido_estelar: {
    label: "Estallido Estelar",
    type: "attack",
    category: "active",
    clazz: "relic_power",
    range: 6,            // casillas
    area: 2,             // radio en casillas (explosión en el punto)
    areaShape: "circle",
    areaWidth: null,
    element: "light",
    save: "evasion",
    requires: "Cargas de reliquia > 0",
    descriptor: "radiancia",
    duration: null,
    attackAttr: "intellect",
    impactAttr: "intellect",
    effect: "Proyectil que detona en un punto, cegando y dañando.",
    levels: ["N1","N2","N3"],
    compLevels: 3,
    ct: { init: 1, exec: 1, rec: 1 },
  }
};

export function getRelicPower(key) {
  return RELIC_POWERS[key] || null;
}

export function listRelicPowers(/* actor */) {
  // Futuro: filtra por sintonización, cargas, etc.
  return Object.entries(RELIC_POWERS).map(([key, v]) => ({ key, ...v }));
}
