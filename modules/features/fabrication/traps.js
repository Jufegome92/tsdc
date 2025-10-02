// modules/features/fabrication/traps.js
// Sistema de fabricación de trampas

/**
 * Tipos de trampas
 */
export const TRAP_TYPES = {
  mecanismos: { key: "mecanismos", label: "Mecanismos", costBase: 50 },
  ilusorias: { key: "ilusorias", label: "Ilusorias", costBase: 100 },
  entorno: { key: "entorno", label: "Entorno", costBase: 100 },
  psiquicas: { key: "psiquicas", label: "Psíquicas", costBase: 200 },
  vivas: { key: "vivas", label: "Vivas", costBase: 150 }
};

/**
 * Rareza de diagramas
 */
export const TRAP_RARITY = {
  comun: {
    key: "comun",
    label: "Común",
    hours: 4,
    difficulty: "fundamentos",
    detectDifficulty: "desafiante",
    disarmDifficulty: "desafiante",
    rankRequired: 1,
    costBase: 50,
    laborCost: 200,
    materialsCost: 216
  },
  raro: {
    key: "raro",
    label: "Raro",
    hours: 10,
    difficulty: "riguroso",
    detectDifficulty: "riguroso",
    disarmDifficulty: "riguroso",
    rankRequired: 2,
    costBase: 200,
    laborCost: 500,
    materialsCost: 432
  },
  excepcional: {
    key: "excepcional",
    label: "Excepcional",
    hours: 24,
    difficulty: "extremo",
    detectDifficulty: "exigente",
    disarmDifficulty: "exigente",
    rankRequired: 3,
    costBase: 600,
    laborCost: 1200,
    materialsCost: 648
  }
};

/**
 * Catálogo de diagramas de trampas
 */
export const TRAP_DIAGRAMS = {
  trampa_cables: {
    key: "trampa_cables",
    label: "Trampa de Cables",
    type: "mecanismos",
    rarity: "comun",
    area: "2 metros cuadrados",
    salvation: "T.C de Agilidad (Condiciones del entorno)",
    effect: "El Objetivo debe superar una T.R de Alteraciones (Leve) o quedar Inmovilizado (Desafiante).",
    availability: "común"
  },

  trampa_ilusiones: {
    key: "trampa_ilusiones",
    label: "Trampa de Ilusiones",
    type: "ilusorias",
    rarity: "raro",
    reagent: "glandulas",
    area: "3 metros cuadrados",
    duration: "30 minutos",
    salvation: "T.R de Alteraciones (Dificultad con base en la calidad de la Glándula)",
    effect: "El Objetivo debe superar una T.R de Alteraciones (Moderado) o quedar Confuso y Desorientado (Riguroso).",
    availability: "moderado"
  },

  trampa_arena_movediza: {
    key: "trampa_arena_movediza",
    label: "Trampa de Arena Movediza",
    type: "entorno",
    rarity: "comun",
    area: "4 metros cuadrados",
    salvation: "T.C de Agilidad (Condición del entorno + 1)",
    effect: "El Objetivo debe superar una T.R de Alteraciones (Moderado) o quedar Atrapado (Desafiante).",
    availability: "común"
  },

  trampa_choque_mental: {
    key: "trampa_choque_mental",
    label: "Trampa de Choque Mental",
    type: "psiquicas",
    rarity: "excepcional",
    reagent: "sistema_nervioso",
    area: "3 metros cuadrados",
    duration: "5 minutos",
    salvation: "T.C de Sabiduría (Dificultad con base en la calidad del Sistema Nervioso)",
    effect: "El Objetivo debe superar una T.R de Alteraciones (Grave) o quedar Aturdido durante 5 minutos.",
    availability: "raro"
  },

  trampa_esporas_fungicas: {
    key: "trampa_esporas_fungicas",
    label: "Trampa de Esporas Fúngicas",
    type: "vivas",
    rarity: "raro",
    reagent: "glandulas",
    area: "3 metros cuadrados",
    duration: "1 hora",
    salvation: "T.R de Infecciones (Dificultad con base en la calidad de la Glándula)",
    effect: "El Objetivo debe superar una T.R de Alteraciones (Grave) o quedar Paralizado durante 10 minutos.",
    availability: "especializado"
  },

  trampa_afilada: {
    key: "trampa_afilada",
    label: "Trampa Afilada",
    type: "mecanismos",
    rarity: "comun",
    area: "1 Casilla",
    salvation: "T.C de Agilidad (Condición del entorno)",
    effect: "Una serie de hojas cortas impactan la criatura, causando 2d6 de daño, el objetivo debe superar una T.R de Alteraciones (Moderada) o quedar Sangrando (Desafiante) 1d4.",
    availability: "moderado"
  },

  trampa_flechas_explosivas: {
    key: "trampa_flechas_explosivas",
    label: "Trampa de Flechas Explosivas",
    type: "mecanismos",
    rarity: "excepcional",
    range: "Hasta 30 metros",
    area: "Una casilla a 30 metros del origen",
    salvation: "T.E de Percepción (Condición del entorno + 1)",
    uses: "10",
    effect: "Flechas que explotan al impactar, causando 6d8 de daño en un área de 2 metros.",
    availability: "excepcional"
  },

  espejismo_abismo: {
    key: "espejismo_abismo",
    label: "Espejismo de Abismo",
    type: "ilusorias",
    rarity: "raro",
    reagent: "glandulas",
    area: "20 metros cuadrados",
    duration: "3 horas",
    salvation: "T.C de Intelecto (Dificultad con base en la calidad de la Glándula)",
    effect: "Esta trampa no se desencadena, permanece activa por su duración. Crea la ilusión de un abismo profundo.",
    availability: "raro"
  },

  laberinto_ilusorio: {
    key: "laberinto_ilusorio",
    label: "Laberinto Ilusorio",
    type: "ilusorias",
    rarity: "excepcional",
    reagent: "sistema_nervioso",
    area: "40 metros cuadrados",
    duration: "Hasta que se desactive",
    salvation: "T.C de Sabiduría (Dificultad con base en la calidad del Sistema Nervioso)",
    effect: "Crea un laberinto ilusorio complejo. Las criaturas pueden realizar T.C de Astucia (Exigente) por cada 15 casillas.",
    availability: "excepcional"
  },

  trampa_resbaladiza: {
    key: "trampa_resbaladiza",
    label: "Trampa Resbaladiza",
    type: "entorno",
    rarity: "raro",
    area: "3 metros cuadrados",
    salvation: "T.C de Agilidad (Condición del entorno)",
    effect: "Para realizar una acción de movimiento, se debe realizar una T.E de Equilibrio (Riguroso).",
    availability: "moderado"
  },

  pozo_oculto: {
    key: "pozo_oculto",
    label: "Pozo Oculto",
    type: "entorno",
    rarity: "comun",
    area: "2 metros cuadrados",
    salvation: "T.E de Acrobacias (Condición del entorno)",
    effect: "La criatura recibe daño por Caída Ligera.",
    availability: "común"
  },

  trampa_panico: {
    key: "trampa_panico",
    label: "Trampa de Pánico",
    type: "psiquicas",
    rarity: "raro",
    reagent: "fluidos",
    area: "3 metros cuadrados",
    salvation: "T.C de Compostura (Dificultad con base en la calidad de los Fluidos)",
    effect: "El Objetivo debe superar una T.R de Alteraciones (Moderado) o quedar Aterrorizado.",
    availability: "moderado"
  },

  bloqueo_mental: {
    key: "bloqueo_mental",
    label: "Bloqueo Mental",
    type: "psiquicas",
    rarity: "excepcional",
    reagent: "sistema_nervioso",
    area: "4 metros cuadrados",
    salvation: "T.C de Compostura (Dificultad con base en la calidad del Sistema Nervioso)",
    effect: "El Objetivo debe superar una T.R de Alteraciones (Grave) o quedar Desorientado (Exigente), Impedido (Exigente) y Confundido.",
    availability: "raro"
  },

  trampa_lianas_estranguladoras: {
    key: "trampa_lianas_estranguladoras",
    label: "Trampa de Lianas Estranguladoras",
    type: "vivas",
    rarity: "raro",
    reagent: "glandulas",
    area: "3 metros cuadrados",
    salvation: "T.C de Fuerza (Dificultad con base en la calidad de la Glándula)",
    effect: "El Objetivo debe superar una T.R de Alteraciones (Moderado) o quedar Asfixiado (Riguroso).",
    availability: "raro"
  },

  enjambre_insectos: {
    key: "enjambre_insectos",
    label: "Enjambre de Insectos",
    type: "vivas",
    rarity: "excepcional",
    reagent: "organos",
    area: "5 metros cuadrados",
    salvation: "T.E Entendimiento Alquimia (Dificultad con base en la calidad del Órgano)",
    effect: "El Objetivo debe superar una T.R de Alteraciones (Moderado) o contagiarse de la Pus de la Abominación.",
    availability: "raro"
  },

  alerta: {
    key: "alerta",
    label: "Alerta",
    type: "mecanismos",
    rarity: "comun",
    area: "5 metros cuadrados alrededor del área de descanso",
    salvation: "T.E de Percepción (Dificultad del Entorno)",
    effect: "Al activarse, luces y mecanismos móviles intentan desorientar. El Objetivo debe superar una T.R de Alteraciones (Leve) o quedar Desorientado (Desafiante).",
    availability: "moderado"
  },

  espejo_realidades_alteradas: {
    key: "espejo_realidades_alteradas",
    label: "Espejo de Realidades Alteradas",
    type: "ilusorias",
    rarity: "raro",
    reagent: "glandulas",
    area: "30 metros cuadrados",
    salvation: "T.C. de Sabiduría (Dificultad con base en la calidad de la Glándula)",
    effect: "Las criaturas afectadas deben hacer una T.C. de Astucia (Exigente) cada turno para discernir la ubicación real.",
    availability: "especializado"
  },

  campo_gravitatorio: {
    key: "campo_gravitatorio",
    label: "Campo Gravitatorio",
    type: "entorno",
    rarity: "excepcional",
    area: "4 metros cuadrados",
    salvation: "T.C de Fuerza (Condición del entorno)",
    effect: "Las criaturas se mueven a un tercio de velocidad y cuesta una acción de ronda. Penalizador de -3 a todas las tiradas.",
    availability: "excepcional"
  },

  susurros_olvido: {
    key: "susurros_olvido",
    label: "Susurros del Olvido",
    type: "psiquicas",
    rarity: "raro",
    reagent: "sistema_nervioso",
    area: "3 metros cuadrados",
    salvation: "T.C. de Sabiduría (Dificultad con base en la calidad del Sistema Nervioso)",
    effect: "Al ejecutar una maniobra o técnica, tienen un 50% de perder su uso.",
    availability: "raro"
  },

  trampa_virus_control: {
    key: "trampa_virus_control",
    label: "Trampa de Virus de Control",
    type: "vivas",
    rarity: "excepcional",
    reagent: "sistema_nervioso",
    area: "3 metros cuadrados",
    salvation: "T.C. de Tenacidad (Dificultad con base en la calidad del Sistema Nervioso)",
    duration: "1d6 Horas",
    effect: "El Objetivo debe superar una T.R de Infecciones (Grave) o quedar bajo los efectos de Esquizofrenia (Grave).",
    availability: "raro"
  }
};

/**
 * Calcula el costo de un diagrama de trampa
 */
export function calculateTrapDiagramCost(trapKey) {
  const trap = TRAP_DIAGRAMS[trapKey];
  if (!trap) return 0;

  const rarityData = TRAP_RARITY[trap.rarity];
  const typeData = TRAP_TYPES[trap.type];

  const availabilityBase = trap.availability === "común" ? 0 :
                          trap.availability === "moderado" ? 100 :
                          trap.availability === "especializado" ? 200 :
                          trap.availability === "raro" ? 300 : 400;

  return rarityData.costBase + typeData.costBase + availabilityBase;
}

/**
 * Calcula el costo total de fabricación de una trampa
 */
export function calculateTrapFabricationCost(trapKey) {
  const trap = TRAP_DIAGRAMS[trapKey];
  if (!trap) return null;

  const rarityData = TRAP_RARITY[trap.rarity];

  return {
    laborCost: rarityData.laborCost,
    materialsCost: rarityData.materialsCost,
    totalCost: rarityData.laborCost + rarityData.materialsCost,
    hours: rarityData.hours,
    difficulty: rarityData.difficulty
  };
}

/**
 * Obtiene información completa de una trampa
 */
export function getTrapDiagram(trapKey) {
  return TRAP_DIAGRAMS[trapKey] || null;
}

/**
 * Lista trampas por tipo
 */
export function listTrapsByType(type) {
  return Object.values(TRAP_DIAGRAMS).filter(t => t.type === type);
}

/**
 * Lista trampas por rareza
 */
export function listTrapsByRarity(rarity) {
  return Object.values(TRAP_DIAGRAMS).filter(t => t.rarity === rarity);
}
