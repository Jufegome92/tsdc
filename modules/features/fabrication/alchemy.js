// modules/features/fabrication/alchemy.js
// Sistema de fabricación alquímica (elixires y venenos)

/**
 * Rareza de fórmulas y tiempo de fabricación
 */
export const FORMULA_RARITY = {
  comun: {
    key: "comun",
    label: "Común",
    hours: 12,
    doses: "1d4",
    difficulty: "fundamentos"
  },
  raro: {
    key: "raro",
    label: "Raro",
    hours: 24,
    doses: "1d3",
    difficulty: "riguroso"
  },
  excepcional: {
    key: "excepcional",
    label: "Excepcional",
    hours: 36,
    doses: "1d2",
    difficulty: "extremo"
  }
};

/**
 * Vías de administración
 */
export const ADMINISTRATION_ROUTE = {
  ingestion: "Ingestión",
  inhalacion: "Inhalación",
  contacto: "Contacto",
  inoculacion: "Inoculación"
};

/**
 * Catálogo de fórmulas alquímicas
 */
export const FORMULAS = {
  // ============================================
  // ELIXIRES CURATIVOS (modificados para sistema de hits)
  // ============================================
  elixir_curativo: {
    key: "elixir_curativo",
    label: "Elixir Curativo",
    type: "elixir",
    rarity: "comun",
    alchemicalIndex: 6,
    reagent: { type: "glandulas", amount: 1 },
    plants: 1,
    route: "ingestion",
    effect: {
      menor: "Consume 1 energía vital para remover 1 hit de UNA zona corporal como parte de esta acción.",
      mayor: "Consume 2 energía vital para remover 1 hit de DOS zonas corporales como parte de esta acción.",
      superior: "Consume 1 energía vital para remover 1 hit de TRES zonas corporales como parte de esta acción."
    },
    availability: "común",
    description: "Un elixir diseñado para estimular la energía vital del consumidor, permitiendo una recuperación acelerada de heridas en zonas corporales específicas."
  },

  // ============================================
  // VENENOS
  // ============================================
  veneno_paralizante: {
    key: "veneno_paralizante",
    label: "Veneno Paralizante",
    type: "veneno",
    rarity: "raro",
    alchemicalIndex: 18,
    reagent: { type: "fluidos", amount: 1 },
    plants: 3,
    route: "inoculacion",
    resistance: "moderada",
    neutralization: "riguroso",
    effect: {
      menor: "Reduce la velocidad de movimiento en 25%.",
      mayor: "Reduce la velocidad de movimiento a la mitad.",
      superior: "El objetivo debe utilizar 2 PA para realizar una acción de movimiento."
    },
    availability: "moderado"
  },

  elixir_clarividencia: {
    key: "elixir_clarividencia",
    label: "Elixir de Clarividencia",
    type: "elixir",
    rarity: "comun",
    alchemicalIndex: 16,
    reagent: { type: "fluidos", amount: 1 },
    plants: 4,
    route: "inhalacion",
    duration: "1 Hora",
    effect: {
      menor: "Aumenta el rango de visión en 20 metros.",
      mayor: "Aumenta el rango de visión y otorga visión en la oscuridad producida por entornos naturales.",
      superior: "Aumenta el rango de visión y otorga visión en oscuridad producida por energía elemental."
    },
    availability: "especializado"
  },

  veneno_confusion: {
    key: "veneno_confusion",
    label: "Veneno de Confusión",
    type: "veneno",
    rarity: "comun",
    alchemicalIndex: 5,
    reagent: { type: "glandulas", amount: 1 },
    plants: 2,
    route: "inoculacion",
    resistance: "leve",
    neutralization: "riguroso",
    effect: {
      menor: "Objetivo permanece Desorientado(Riguroso).",
      mayor: "Objetivo permanece Conmocionado.",
      superior: "Objetivo permanece Confundido."
    },
    availability: "moderado"
  },

  elixir_tigre: {
    key: "elixir_tigre",
    label: "Elixir de Tigre",
    type: "elixir",
    rarity: "raro",
    alchemicalIndex: 21,
    reagent: { type: "organos", amount: 1 },
    plants: 3,
    route: "ingestion",
    duration: "1 Hora",
    effect: {
      menor: "+1 de Fuerza.",
      mayor: "+1 a Fuerza y +1 de Agilidad.",
      superior: "+1 a Fuerza, +1 de Agilidad y +1 de Tenacidad."
    },
    availability: "raro"
  },

  elixir_dragon: {
    key: "elixir_dragon",
    label: "Elixir de Dragón",
    type: "elixir",
    rarity: "raro",
    alchemicalIndex: 21,
    reagent: { type: "organos", amount: 1 },
    plants: 3,
    route: "ingestion",
    duration: "1 Hora",
    effect: {
      menor: "+1 de Intelecto.",
      mayor: "+1 a Intelecto y +1 de Astucia.",
      superior: "+1 a Intelecto, +1 de Astucia y +1 de Sabiduría."
    },
    availability: "raro"
  },

  veneno_letargo: {
    key: "veneno_letargo",
    label: "Veneno de Letargo",
    type: "veneno",
    rarity: "raro",
    alchemicalIndex: 15,
    reagent: { type: "fluidos", amount: 1 },
    plants: 2,
    route: "ingestion",
    resistance: "moderado",
    neutralization: "exigente",
    effect: {
      menor: "-1 a las T.C de Agilidad.",
      mayor: "-2 a las T.C de agilidad y T.E de Destreza.",
      superior: "-2 a las T.C de Agilidad, T.E de Destreza y Obtiene desgaste igual a su Tenacidad (no puede realizar Reacciones Instintivas)."
    },
    availability: "especializado"
  },

  elixir_aguante: {
    key: "elixir_aguante",
    label: "Elixir de Aguante",
    type: "elixir",
    rarity: "comun",
    alchemicalIndex: 10,
    reagent: { type: "organos", amount: 1 },
    plants: 2,
    route: "contacto",
    duration: "3 Horas",
    effect: {
      menor: "+1 de Aguante.",
      mayor: "+2 de Aguante.",
      superior: "+3 de Aguante."
    },
    availability: "moderado"
  },

  elixir_sosiego: {
    key: "elixir_sosiego",
    label: "Elixir de Sosiego",
    type: "elixir",
    rarity: "comun",
    alchemicalIndex: 9,
    reagent: { type: "fluidos", amount: 1 },
    plants: 3,
    route: "inhalacion",
    duration: "2 Horas",
    effect: {
      menor: "+1 a las T.E de Enfoque.",
      mayor: "+2 a las T.E de Enfoque.",
      superior: "+3 a las T.E de Enfoque."
    },
    availability: "moderado"
  },

  elixir_agudeza_sensorial: {
    key: "elixir_agudeza_sensorial",
    label: "Elixir de Agudeza Sensorial",
    type: "elixir",
    rarity: "comun",
    alchemicalIndex: 13,
    reagent: { type: "fluidos", amount: 1 },
    plants: 3,
    route: "inhalacion",
    duration: "2 Horas",
    effect: {
      menor: "+1 a las T.E de Percepción.",
      mayor: "+2 a las T.E de Percepción.",
      superior: "+3 a las T.E de Percepción."
    },
    availability: "moderado"
  },

  elixir_ligereza: {
    key: "elixir_ligereza",
    label: "Elixir de Ligereza",
    type: "elixir",
    rarity: "comun",
    alchemicalIndex: 11,
    reagent: { type: "fluidos", amount: 1 },
    plants: 2,
    route: "contacto",
    duration: "2 Horas",
    effect: {
      menor: "+1 a las T.E de Equilibrio.",
      mayor: "+2 a las T.E de Equilibrio.",
      superior: "+2 a las T.E de Equilibrio, Nadar y Salto."
    },
    availability: "moderado"
  },

  elixir_memoria: {
    key: "elixir_memoria",
    label: "Elixir de Memoria",
    type: "elixir",
    rarity: "comun",
    alchemicalIndex: 14,
    reagent: { type: "organos", amount: 1 },
    plants: 3,
    route: "inhalacion",
    duration: "2 Horas",
    effect: {
      menor: "+1 a las T.E de Entendimiento.",
      mayor: "+2 a las T.E de Entendimiento.",
      superior: "+3 a las T.E de Entendimiento."
    },
    availability: "moderado"
  },

  veneno_inercia: {
    key: "veneno_inercia",
    label: "Veneno de Inercia",
    type: "veneno",
    rarity: "excepcional",
    alchemicalIndex: 19,
    reagent: { type: "sistema_nervioso", amount: 1 },
    plants: 2,
    route: "inoculacion",
    resistance: "grave",
    neutralization: "exigente",
    effect: {
      menor: "Criatura debe repetir la primera acción de su ronda o perder 1 PA.",
      mayor: "Criatura debe repetir la primera acción de su ronda o perder 2 PA.",
      superior: "Criatura debe repetir la primera acción de su ronda o perder 3 PA."
    },
    availability: "especializado"
  },

  veneno_susurro: {
    key: "veneno_susurro",
    label: "Veneno de Susurro",
    type: "veneno",
    rarity: "raro",
    alchemicalIndex: 16,
    reagent: { type: "organos", amount: 1 },
    plants: 2,
    route: "inhalacion",
    resistance: "moderado",
    neutralization: "riguroso",
    effect: {
      menor: "Cada ronda debe utilizar 1 PA para realizar una T.E de Percepción.",
      mayor: "Cada ronda debe utilizar 2 PA para realizar una T.E de Percepción.",
      superior: "Cada ronda debe utilizar 2 PA para realizar una T.E de Percepción y no recibe ningún tipo de bonificador por talento, habilidad de talento o don."
    },
    availability: "especializado"
  },

  elixir_paso_fantasmal: {
    key: "elixir_paso_fantasmal",
    label: "Elixir de Paso Fantasmal",
    type: "elixir",
    rarity: "raro",
    alchemicalIndex: 20,
    reagent: { type: "glandulas", amount: 1 },
    plants: 3,
    route: "contacto",
    duration: "30 Minutos",
    effect: {
      menor: "+1 a las T.E de Sigilo.",
      mayor: "Elimina la penalización a las pruebas de Sigilo por el uso de armadura intermedia.",
      superior: "Elimina la penalización a las pruebas de Sigilo por el uso de armadura pesada."
    },
    availability: "especializado"
  },

  veneno_frenesi: {
    key: "veneno_frenesi",
    label: "Veneno de Frenesí",
    type: "veneno",
    rarity: "excepcional",
    alchemicalIndex: 22,
    reagent: { type: "sistema_nervioso", amount: 1 },
    plants: 3,
    route: "inoculacion",
    resistance: "grave",
    neutralization: "extrema",
    effect: {
      menor: "+1 a la T.A, -1 a la T.D.",
      mayor: "+2 a la T.A, -2 a la T.D.",
      superior: "+2 a la T.A, -2 a la T.D y el objetivo queda Confundido."
    },
    availability: "raro"
  },

  elixir_piel_piedra: {
    key: "elixir_piel_piedra",
    label: "Elixir de Piel de Piedra",
    type: "elixir",
    rarity: "raro",
    alchemicalIndex: 17,
    reagent: { type: "organos", amount: 1 },
    plants: 3,
    route: "contacto",
    duration: "10 Minutos",
    effect: {
      menor: "Otorga una reducción de daño físico de 1 por cada cuatro niveles de jugador.",
      mayor: "Otorga una reducción de daño físico de 2 por cada cuatro niveles de jugador.",
      superior: "Otorga una reducción de daño físico de 3 por cada cuatro niveles de jugador."
    },
    availability: "raro"
  },

  elixir_serenidad: {
    key: "elixir_serenidad",
    label: "Elixir de Serenidad",
    type: "elixir",
    rarity: "raro",
    alchemicalIndex: 20,
    reagent: { type: "glandulas", amount: 1 },
    plants: 3,
    route: "inhalacion",
    duration: "4 Horas",
    effect: {
      menor: "Aumenta la cordura en 1.",
      mayor: "Aumenta la cordura en 2.",
      superior: "Aumenta la cordura en 2, recuperas el doble de cordura al descansar."
    },
    availability: "especializado"
  },

  elixir_destreza: {
    key: "elixir_destreza",
    label: "Elixir de Destreza",
    type: "elixir",
    rarity: "comun",
    alchemicalIndex: 12,
    reagent: { type: "fluidos", amount: 1 },
    plants: 3,
    route: "ingestion",
    duration: "2 Horas",
    effect: {
      menor: "+1 Preparación.",
      mayor: "+2 Preparación.",
      superior: "+2 de Preparación y te permite tomar 1 carta del descarte por combate."
    },
    availability: "especializado"
  },

  elixir_oso: {
    key: "elixir_oso",
    label: "Elixir de Oso",
    type: "elixir",
    rarity: "raro",
    alchemicalIndex: 16,
    reagent: { type: "organos", amount: 1 },
    plants: 3,
    route: "ingestion",
    duration: "2 Horas",
    effect: {
      menor: "+1 Resiliencia.",
      mayor: "+2 Resiliencia.",
      superior: "+2 de Resiliencia y te permite relanzar una T.R por combate."
    },
    availability: "común"
  },

  elixir_vitalidad: {
    key: "elixir_vitalidad",
    label: "Elixir de Vitalidad",
    type: "elixir",
    rarity: "excepcional",
    alchemicalIndex: 24,
    reagent: { type: "organos", amount: 1 },
    plants: 4,
    route: "ingestion",
    duration: "Hasta recibir daño que supere los puntos temporales.",
    effect: {
      menor: "Agrega +1 hit temporal a TODAS las zonas corporales.",
      mayor: "Agrega +2 hits temporales a TODAS las zonas corporales.",
      superior: "Agrega +2 hits temporales a TODAS las zonas corporales y +2 Energía Vital."
    },
    availability: "especializado",
    description: "Aumenta temporalmente la resistencia corporal del consumidor agregando hits temporales que no se recuperan con descanso ni curación."
  },

  elixir_toro: {
    key: "elixir_toro",
    label: "Elixir de Toro",
    type: "elixir",
    rarity: "comun",
    alchemicalIndex: 10,
    reagent: { type: "fluidos", amount: 1 },
    plants: 2,
    route: "contacto",
    duration: "4 Horas",
    effect: {
      menor: "Aumenta en 1 tu Fuerza durante el cálculo de capacidad de carga.",
      mayor: "Aumenta en 2 tu Fuerza durante el cálculo de capacidad de carga.",
      superior: "Aumenta en 3 tu Fuerza durante el cálculo de capacidad de carga y omites los efectos de Extenuación."
    },
    availability: "común"
  },

  veneno_ceguera: {
    key: "veneno_ceguera",
    label: "Veneno de Ceguera",
    type: "veneno",
    rarity: "raro",
    alchemicalIndex: 14,
    reagent: { type: "glandulas", amount: 1 },
    plants: 2,
    route: "contacto",
    resistance: "moderado",
    neutralization: "riguroso",
    effect: {
      menor: "Reduce el rango de visión en 10 metros.",
      mayor: "Reduce el rango de visión a la mitad.",
      superior: "Elimina completamente el rango de visión."
    },
    availability: "especializado"
  },

  veneno_debilidad: {
    key: "veneno_debilidad",
    label: "Veneno de Debilidad",
    type: "veneno",
    rarity: "comun",
    alchemicalIndex: 10,
    reagent: { type: "fluidos", amount: 1 },
    plants: 2,
    route: "inoculacion",
    resistance: "leve",
    neutralization: "desafiante",
    effect: {
      menor: "-1 a las T.R de Alteraciones.",
      mayor: "-1 a las T.R de Alteraciones y Veneno.",
      superior: "-2 a todas las T.R."
    },
    availability: "moderado"
  },

  veneno_paranoia: {
    key: "veneno_paranoia",
    label: "Veneno de Paranoia",
    type: "veneno",
    rarity: "comun",
    alchemicalIndex: 10,
    reagent: { type: "fluidos", amount: 1 },
    plants: 2,
    route: "inhalacion",
    resistance: "leve",
    neutralization: "rigurosa",
    effect: {
      menor: "Criatura obtiene la aflicción Paranoia (Leve).",
      mayor: "Criatura obtiene la aflicción Paranoia (Moderada).",
      superior: "Criatura obtiene la aflicción Paranoia (Grave)."
    },
    availability: "raro"
  },

  veneno_torpeza: {
    key: "veneno_torpeza",
    label: "Veneno de Torpeza",
    type: "veneno",
    rarity: "comun",
    alchemicalIndex: 12,
    reagent: { type: "fluidos", amount: 1 },
    plants: 3,
    route: "inoculacion",
    resistance: "leve",
    neutralization: "desafiante",
    effect: {
      menor: "-1 a las T.E de Equilibrio.",
      mayor: "-1 a las T.E de Equilibrio y Acrobacias.",
      superior: "-2 a todas las T.E y T.C relacionadas con Agilidad."
    },
    availability: "moderado"
  },

  veneno_sopor: {
    key: "veneno_sopor",
    label: "Veneno de Sopor",
    type: "veneno",
    rarity: "excepcional",
    alchemicalIndex: 28,
    reagent: { type: "sistema_nervioso", amount: 1 },
    plants: 3,
    route: "ingestion",
    resistance: "moderada",
    neutralization: "extrema",
    effect: {
      menor: "El objetivo duerme 1d4 rondas.",
      mayor: "El objetivo duerme 1d4 días.",
      superior: "El objetivo queda inconsciente."
    },
    availability: "raro"
  },

  veneno_enmudecimiento: {
    key: "veneno_enmudecimiento",
    label: "Veneno de Enmudecimiento",
    type: "veneno",
    rarity: "raro",
    alchemicalIndex: 18,
    reagent: { type: "glandulas", amount: 1 },
    plants: 3,
    route: "contacto",
    resistance: "moderada",
    neutralization: "rigurosa",
    effect: {
      menor: "Criatura se comunica únicamente en susurros.",
      mayor: "Criatura pierde la capacidad de comunicarse con su voz por 1d4 rondas.",
      superior: "Criatura pierde la capacidad de comunicarse con su voz por 1d4 días."
    },
    availability: "especializado"
  },

  veneno_corrosivo: {
    key: "veneno_corrosivo",
    label: "Veneno Corrosivo",
    type: "veneno",
    rarity: "raro",
    alchemicalIndex: 20,
    reagent: { type: "fluidos", amount: 1 },
    plants: 3,
    route: "inoculacion",
    resistance: "moderada",
    neutralization: "rigurosa",
    effect: {
      menor: "El objetivo recibe 3 PS de daño al final de cada ronda. Si realizó una acción de movimiento o especialización física, recibe 2 PS adicionales.",
      mayor: "El objetivo recibe 6 PS de daño al final de cada ronda. Si realizó una acción de movimiento o especialización física, recibe 4 PS adicionales.",
      superior: "El objetivo recibe 9 PS de daño al final de cada ronda. Si realizó una acción de movimiento o especialización física, recibe 6 PS adicionales. Además su sangre y fluidos están contaminados."
    },
    availability: "moderado"
  },

  veneno_necrosante: {
    key: "veneno_necrosante",
    label: "Veneno Necrosante",
    type: "veneno",
    rarity: "raro",
    alchemicalIndex: 19,
    reagent: { type: "glandulas", amount: 1 },
    plants: 3,
    route: "inoculacion",
    resistance: "grave",
    neutralization: "extrema",
    effect: {
      menor: "Pierde 6 PS por ronda.",
      mayor: "Pierde 9 PS por ronda y obtiene la condición 'Degeneración'.",
      superior: "Pierde 12 PS por ronda, obtiene 'Degeneración' y no puede recuperarse con efectos de curación estándar mientras esté activo."
    },
    note: "Degeneración: Reduce toda curación recibida en 50% hasta eliminar la toxina.",
    availability: "especializado"
  },

  veneno_disolucion: {
    key: "veneno_disolucion",
    label: "Veneno de Disolución",
    type: "veneno",
    rarity: "excepcional",
    alchemicalIndex: 25,
    reagent: { type: "organos", amount: 1 },
    plants: 3,
    route: "ingestion",
    resistance: "grave",
    neutralization: "extrema",
    effect: {
      menor: "Pierde 5% de su salud máxima cada ronda.",
      mayor: "Pierde 10% de su salud máxima cada ronda.",
      superior: "Pierde 15% de su salud máxima cada ronda y todos los efectos de sangrado se duplican."
    },
    availability: "raro"
  }
};

/**
 * Calcula el costo de una fórmula
 */
export function calculateFormulaCost(formula) {
  const rarityBase = formula.rarity === "comun" ? 50 :
                     formula.rarity === "raro" ? 200 : 600;

  const availabilityBase = formula.availability === "común" ? 0 :
                          formula.availability === "moderado" ? 100 :
                          formula.availability === "especializado" ? 200 :
                          formula.availability === "raro" ? 300 : 400;

  const typeBase = formula.type === "elixir" ? 50 : 100;

  return rarityBase + availabilityBase + typeBase;
}

/**
 * Obtiene información de una fórmula
 */
export function getFormula(formulaKey) {
  return FORMULAS[formulaKey] || null;
}

/**
 * Lista fórmulas por tipo
 */
export function listFormulasByType(type) {
  return Object.values(FORMULAS).filter(f => f.type === type);
}

/**
 * Lista fórmulas por rareza
 */
export function listFormulasByRarity(rarity) {
  return Object.values(FORMULAS).filter(f => f.rarity === rarity);
}
