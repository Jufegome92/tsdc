// Catálogo de Maniobras (resumen mínimo; amplía libremente)
export const MANEUVERS = {
  // === Tus ejemplos existentes ===
  barrido: {
    label: "Barrido",
    type: "attack",
    category: "active",
    clazz: "maneuver",
    range: 1,          // en casillas
    area: 0,           // objetivo único
    // NUEVO: puedes ignorar areaShape cuando area=0
    areaShape: null,   // "cone" | "line" | "circle" | null
    areaWidth: null,   // ancho (solo para "line"), en casillas
    element: null,
    save: null,
    requires: null,
    descriptor: "corte",
    duration: null,
    attackAttr: "agility",
    impactAttr: "agility",
    effect: "Golpe amplio a 1 casilla, puede derribar en éxito alto.",
    levels: [
      "N1: se ejecuta como ataque normal (sin descriptor en combos).",
      "N2: efecto normal pero sin usar descriptor en combos.",
      "N3: uso completo, permite encadenar descriptor."
    ],
    compLevels: 3,
    ct: { init: 1, exec: 1, rec: 1 },
    effects: [
    {
      id: "KNOCKDOWN_ON_HIT",
      trigger: "on_hit",                 // cuándo evaluar (tras aplicar daño)
      save: { group: "alteration", bonus: 0 },// usa TR de “Alteración”
      onFail: { ailmentId: "DERRIBADO" }      // aplica este agravio si falla la TR
    }
  ]
  },

  finta: {
    label: "Finta",
    type: "buff",
    category: "free",
    clazz: "maneuver",
    range: 1,
    area: 0,
    areaShape: null,
    areaWidth: null,
    element: null,
    save: "composure",
    requires: null,
    descriptor: "engaño",
    duration: "hasta tu próximo turno",
    attackAttr: "cunning",
    impactAttr: "agility",
    effect: "Forzas al enemigo a sobre-reaccionar; ventaja situacional al siguiente ataque.",
    levels: [
      "N1: ataque normal.",
      "N2: aplica desventaja defensiva leve si fallan la salvación.",
      "N3: pleno, habilita combos con descriptor 'engaño'."
    ],
    compLevels: 3,
    ct: { init: 0, exec: 1, rec: 0 },
  },

  // === NUEVAS: rango/área de prueba ===

  /** Cono frontal desde el actor (área = longitud del cono, en casillas) */
  barrido_cono: {
    label: "Barrido en Cono",
    type: "attack",
    category: "active",
    clazz: "maneuver",
    range: 1,              // casillas para “enganchar”
    area: 3,               // longitud del cono en casillas
    areaShape: "cone",
    areaWidth: null,       // no aplica a cone
    element: null,
    save: null,
    requires: null,
    descriptor: "corte",
    duration: null,
    attackAttr: "agility",
    impactAttr: "agility",
    effect: "Ataque en cono corto frente al usuario.",
    levels: ["N1", "N2", "N3"],
    compLevels: 3,
    ct: { init: 0, exec: 1, rec: 1 },
  },

  /** Línea proyectada desde el actor (área=longitud; areaWidth=ancho), ambos en casillas */
  estocada_linea: {
    label: "Estocada en Línea",
    type: "attack",
    category: "active",
    clazz: "maneuver",
    range: 2,              // debes estar a <=2 casillas para iniciar
    area: 6,               // longitud de la línea
    areaShape: "line",
    areaWidth: 1,          // ancho en casillas
    element: null,
    save: null,
    requires: null,
    descriptor: "letal",
    duration: null,
    attackAttr: "agility",
    impactAttr: "agility",
    effect: "Empuje en línea que perfora objetivos alineados.",
    levels: ["N1", "N2", "N3"],
    compLevels: 3,
    ct: { init: 0, exec: 1, rec: 1 },
  },

  /** Círculo centrado en el actor (área=radio en casillas) */
  giro_circular: {
    label: "Giro Circular",
    type: "attack",
    category: "active",
    clazz: "maneuver",
    range: 0,              // autocentrado
    area: 2,               // radio en casillas
    areaShape: "circle",
    areaWidth: null,
    element: null,
    save: null,
    requires: null,
    descriptor: "fluctuante",
    duration: null,
    attackAttr: "agility",
    impactAttr: "agility",
    effect: "Corte circular que alcanza a los adyacentes ampliados.",
    levels: ["N1", "N2", "N3"],
    compLevels: 3,
    ct: { init: 1, exec: 1, rec: 1 },
  }
};
