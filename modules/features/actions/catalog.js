// modules/features/actions/catalog.js
export const ACTIONS = {
  mover: {
    id: "mover",
    name: "Moverse",
    range: 0,
    area: 0,
    rolls: [], // no TA/TI/TR
    ct: { I:0, E:1, R:1 },            // CT=2 (I0+E1+R1)
    requirements: [],
    keywords: { type:"acción", clazz:"accion", category:"activa", descriptors:[], elements:[] },
    description: "Te desplazas una cantidad de casillas según tus reglas de movimiento."
  },
  ataque: {
    id: "ataque",
    name: "Ataque",
    range: 1,
    area: 0,
    rolls: [{ kind:"TA" }, { kind:"TI" }], // si aplica
    ct: { I:1, E:1, R:1 },                 // CT=3
    requirements: [],
    keywords: { type:"ataque", clazz:"ataque", category:"activa", descriptors:["corte"], elements:[] },
    description: "Ataque básico con tu arma/natural."
  },
  especializacion: {
    id: "especializacion",
    name: "Especialización",
    range: 0,
    area: 0,
    rolls: [{ kind:"TE" }],               // tirada de especialización si aplica
    ctOptions: {                          // CT variable por decisión del jugador
      1: { I:0, E:1, R:0 },               // penaliza/bonifica según tu regla
      2: { I:1, E:1, R:0 },
      3: { I:1, E:1, R:1 }
    },
    requirements: [],
    keywords: { type:"mejora", clazz:"accion", category:"activa", descriptors:[], elements:[] },
    description: "Usa una especialización con CT elegido (1/2/3)."
  },
  escape: {
    id: "escape",
    name: "Escapar",
    range: 0,
    area: 0,
    rolls: [],
    ct: { I:1, E:1, R:0 },
    requirements: [],
    keywords: { type:"accion", clazz:"accion", category:"activa", descriptors:[], elements:[] },
    description: "Acción para intentar liberarte de efectos como Atrapado o similares."
  },
  "dual-wield": {
    id: "dual-wield",
    name: "Ataque Múltiple",
    range: "Variable", // Depende de las armas equipadas
    area: 0,
    rolls: [{ kind:"TE", stat:"dexterity" }], // T.E Destreza evaluada por GM
    ct: { I:1, E:1, R:1 },                    // CT=3
    requirements: ["Armas en ambas manos", "Armas auxiliares solamente"],
    keywords: { type:"ataque", clazz:"ataque_multiple", category:"activa", descriptors:["dual","multiple"], elements:[] },
    description: "Encola una secuencia de combate con dos armas. Requiere T.E de Destreza (evaluada por GM, sin ventaja). Si tienes éxito, realizas múltiples ataques consecutivos: 1 base + floor(Agilidad/2) adicionales, alternando entre ambas armas. Solo funciona con armas auxiliares."
  }
  // …y tus Maniobras (barrido, finta, etc.) con su ct fijo o dependiente del nivel.
};
