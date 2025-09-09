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
  }
  // …y tus Maniobras (barrido, finta, etc.) con su ct fijo o dependiente del nivel.
};
