export const APTITUDES = {
  impulso_sobrehumano: {
    label: "Impulso Sobrehumano",
    type: "utility",            // no es ataque
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 0,
    areaShape: null,
    element: null,
    save: null,
    requires: "Rango 2 de Saltar",
    descriptor: "movimiento",
    duration: null,
    attackAttr: null,
    impactAttr: null,
    effect: "Salto horizontal o vertical con +50% de distancia. Requiere impulso previo de 5 casillas.",
    levels: [
      "N1: se ejecuta como acción especial de salto (sin bonus).",
      "N2: +50% a la distancia del salto.",
      "N3: +50% y permite encadenar con maniobras de descriptor 'movimiento'."
    ],
    compLevels: 3,
    ct: { init: 0, exec: 1, rec: 0 },
    usage: { inCombat: true, outCombat: true }
  },

  impulso_supervivencia: {
    label: "Impulso de Supervivencia",
    type: "reaction",           // para tu ventana de reacciones
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    areaShape: null,
    element: null,
    save: null,
    requires: "Rango 2 de Saltar",
    descriptor: "movimiento",
    duration: "instantánea",
    attackAttr: null,
    impactAttr: null,
    effect: "Reacción: salto instintivo para evitar un peligro. Sustituye la tirada y otorga +2 vs trampas. Riesgo: si falla por 4+, recibe el doble de daño.",
    levels: [
      "N1: sustitución sin bonificador.",
      "N2: +2 contra trampas.",
      "N3: +2 y puede desplazar 1 casilla extra si evita daño de área."
    ],
    compLevels: 3,
    ct: { init: 0, exec: 0, rec: 0 },
    reaction: { when: ["trap","hazard"] }, // tu sistema de reacciones puede engancharse a esto
    usage: { inCombat: false, outCombat: true }
  }
};
