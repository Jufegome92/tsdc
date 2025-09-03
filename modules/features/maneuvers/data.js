// modules/features/maneuvers/data.js
// Catálogo de Maniobras (resumen mínimo; amplía libremente)

export const MANEUVERS = {
  // Clave canónica sin acentos y en minúsculas (igual que armas/especializaciones).
  // === EJEMPLOS ===

  barrido: {
    label: "Barrido",
    type: "attack",                  // "attack" | "buff" (mejora/soporte)
    category: "active",              // "active" | "free" | "reaction"
    clazz: "maneuver",               // "maneuver" | "attack" | "item" | etc.
    range: 1,                        // alcance en casillas
    area: 0,                         // tamaño del área (0 = objetivo único)
    element: null,                   // "water"|"fire"|"earth"|"air"|"light"|"dark"|combos|null
    save: null,                      // p.ej. "evasion"|"composure"|null
    requires: null,                  // texto de requisitos (arma, estado, etc.)
    descriptor: "corte",             // taxonomía propia (para combos)
    duration: null,                  // texto/turnos
    attackAttr: "agility",           // atributo a usar en la T.A si aplica
    impactAttr: "agility",           // atributo a usar en la T.I si aplica
    effect: "Golpe amplio a 1 casilla, puede derribar en éxito alto.",
    levels: [
      "N1: se ejecuta como ataque normal (sin descriptor en combos).",
      "N2: efecto normal pero sin usar descriptor en combos.",
      "N3: uso completo, permite encadenar descriptor."
    ],
    compLevels: 3                    // maniobras solo tienen 3 niveles de competencia
  },

  finta: {
    label: "Finta",
    type: "buff",
    category: "free",
    clazz: "maneuver",
    range: 1,
    area: 0,
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
    compLevels: 3
  }

  // Agrega aquí tus maniobras…
};
