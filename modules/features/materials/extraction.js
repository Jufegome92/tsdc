// modules/features/materials/extraction.js
// Sistema de extracción de materiales de criaturas, minerales y plantas

import { getMaterialAccessibility } from "./accessibility.js";
import { getMaterial } from "./index.js";
import { getPlant, getExtractionDifficulty } from "./plants.js";

/**
 * Tipos de herramientas y sus efectos
 */
export const TOOL_GRADES = {
  basico: {
    key: "basico",
    label: "Básico",
    canExtractGrade: 1, // Solo Común
    timeReduction: 0,
    bonus: 0
  },
  avanzado: {
    key: "avanzado",
    label: "Avanzado",
    canExtractGrade: 2, // Hasta Raro
    timeReduction: 0.25, // 25% reducción
    bonus: 1
  },
  especializado: {
    key: "especializado",
    label: "Especializado",
    canExtractGrade: 3, // Hasta Excepcional
    timeReduction: 0.5, // 50% reducción
    bonus: 2
  }
};

/**
 * Extracción de partes de criatura
 * Según el tamaño de la criatura:
 * - Partes sensibles (órganos, glándulas, fluidos, sistema nervioso)
 * - Partes no sensibles (pelaje, escamas, huesos, garras, etc.)
 */
export const CREATURE_EXTRACTION = {
  // Partes sensibles (requieren cuidado extremo)
  sensitive: {
    parts: ["glandulas", "organos", "fluidos", "sistema_nervioso"],
    requiresTool: true,
    // Tiempos base en minutos según tamaño de criatura
    timeBySize: {
      pequeña: 120,    // 2 horas
      mediana: 240,    // 4 horas
      grande: 360,     // 6 horas
      enorme: 480,     // 8 horas
      gigantesca: 600  // 10 horas
    },
    // Cantidad base en unidades según tamaño
    quantityBySize: {
      pequeña: 1,
      mediana: 2,
      grande: 3,
      enorme: 4,
      gigantesca: 5
    },
    aptitudeKey: "medicina",  // Usa la skill de Sanación
    note: "Requiere Kit de Extracción + precisión quirúrgica"
  },

  // Partes no sensibles (estructurales, externas)
  nonSensitive: {
    parts: ["pelaje", "escamas", "caparazon", "plumaje", "huesos", "cuernos", "garras", "colmillos"],
    requiresTool: true,
    // Tiempos base en minutos según tamaño de criatura
    timeBySize: {
      pequeña: 60,     // 1 hora
      mediana: 120,    // 2 horas
      grande: 240,     // 4 horas
      enorme: 360,     // 6 horas
      gigantesca: 480  // 8 horas
    },
    // Cantidad base en kg según tamaño
    quantityBySize: {
      pequeña: 2,
      mediana: 4,
      grande: 8,
      enorme: 15,
      gigantesca: 25
    },
    aptitudeKey: "medicina",  // Usa la skill de Sanación
    note: "Requiere Kit de Extracción + herramientas de corte"
  }
};

/**
 * Extracción de minerales (Minería)
 */
export const MINERAL_EXTRACTION = {
  baseTime: 60, // minutos por veta
  aptitudeKey: "mineria",
  requiresTool: true,
  note: "Requiere herramienta de minería. Cada veta proporciona cantidad variable según dificultad de extracción.",

  // Cantidad extraída según accesibilidad y grado de herramienta
  yieldTable: {
    general: { basico: "2d6 kg", avanzado: "3d6 kg", especializado: "4d6 kg" },
    limitado: { basico: "1d6 kg", avanzado: "2d6 kg", especializado: "3d6 kg" },
    singular: { basico: "1d4 kg", avanzado: "1d6 kg", especializado: "2d6 kg" }
  }
};

/**
 * Extracción de plantas (Herboristería)
 */
export const PLANT_EXTRACTION = {
  aptitudeKey: "herboristeria",
  requiresTool: true, // Kit de herboristería
  note: "El tiempo de extracción y dificultad dependen de cada planta específica"
};

/**
 * Tiempo de conservación de materiales
 */
export const CONSERVATION_TIME = {
  // Sistema nervioso (más delicado)
  nervous: {
    parts: ["sistema_nervioso"],
    time: "Sin kit no dura",
    requiresKit: "Kit de Conservación Especializado",
    extendedTime: "3 días",
    note: "Requiere kit especializado: 3 días."
  },

  // Glándulas y Órganos
  organs: {
    parts: ["glandulas", "organos"],
    time: "Sin kit no dura",
    requiresKit: "Kit de Conservación Especializado",
    extendedTime: "1 semana",
    note: "Requiere kit especializado: 1 semana."
  },

  // Fluidos - Sangre
  fluidsSangre: {
    parts: ["sangre"],
    time: "Sin kit no dura",
    requiresKit: "Kit de Conservación Básico",
    extendedTime: "2 semanas",
    note: "Requiere kit básico: 2 semanas."
  },

  // Fluidos - Veneno
  fluidsVeneno: {
    parts: ["veneno", "fluidos"],
    time: "Sin kit no dura",
    requiresKit: "Kit de Conservación Básico",
    extendedTime: "1 mes",
    note: "Requiere kit básico: 1 mes."
  },

  // Pelaje y Plumaje
  fur: {
    parts: ["pelaje", "plumaje"],
    time: "Sin kit no dura",
    requiresKit: "Kit de Conservación Básico",
    extendedTime: "1 mes",
    note: "Requiere kit básico: 1 mes."
  },

  // Escamas y Caparazón
  scales: {
    parts: ["escamas", "caparazon"],
    time: "Sin kit no dura",
    requiresKit: "Kit de Conservación Avanzado",
    extendedTime: "2 meses",
    note: "Requiere kit avanzado: 2 meses."
  },

  // Colmillos y Garras
  claws: {
    parts: ["colmillos", "garras"],
    time: "Sin kit no dura",
    requiresKit: "Kit de Conservación Básico",
    extendedTime: "6 semanas",
    note: "Requiere kit básico: 6 semanas."
  },

  // Huesos y Cuernos
  bones: {
    parts: ["huesos", "cuernos"],
    time: "Sin kit no dura",
    requiresKit: "Kit de Conservación Avanzado",
    extendedTime: "2 meses",
    note: "Requiere kit avanzado: 2 meses."
  },

  // Plantas
  plants: {
    parts: ["plant"],
    time: "1 semana",
    requiresKit: "Kit de Conservación Botánico",
    extendedTime: "1 mes",
    note: "Sin kit: 1 semana. Con kit botánico: 1 mes."
  },

  // Minerales (no perecen)
  minerals: {
    parts: ["mineral"],
    time: "indefinido",
    requiresKit: null,
    note: "Los minerales no perecen"
  }
};

/**
 * Obtiene el grado de calidad extraíble según herramienta
 * @param {string} toolGrade - "basico", "avanzado", "especializado"
 * @returns {number} - grado máximo extraíble (1-3)
 */
export function getMaxExtractableGrade(toolGrade) {
  const grade = TOOL_GRADES[String(toolGrade || "basico").toLowerCase()];
  return grade ? grade.canExtractGrade : 1;
}

export function calculateExtractionTime(baseTime, toolGrade = "basico") {
  const grade = TOOL_GRADES[String(toolGrade || "basico").toLowerCase()];
  if (!grade) return baseTime;

  return Math.ceil(baseTime * (1 - grade.timeReduction));
}

function normalizeToolGradeKey(grade) {
  if (grade == null) return null;
  if (typeof grade === "string") {
    const key = grade.toLowerCase();
    if (TOOL_GRADES[key]) return key;
  }
  const num = Number(grade);
  if (Number.isFinite(num)) {
    if (num >= 3) return "especializado";
    if (num >= 2) return "avanzado";
    if (num >= 1) return "basico";
  }
  return null;
}

/**
 * Determina si una parte de criatura es sensible
 * @param {string} partKey - clave de la parte
 * @returns {boolean}
 */
export function isSensitivePart(partKey) {
  const key = String(partKey || "").toLowerCase();
  return CREATURE_EXTRACTION.sensitive.parts.includes(key);
}

/**
 * Obtiene información de extracción para una parte de criatura
 * @param {string} partKey - clave de la parte
 * @param {string} toolGrade - grado de herramienta
 * @param {string} creatureSize - tamaño de la criatura (pequeña, mediana, grande, enorme, gigantesca)
 * @returns {object} - información de extracción
 */
export function getCreatureExtractionInfo(partKey, toolGrade = "basico", creatureSize = "mediana") {
  const key = String(partKey || "").toLowerCase();
  const sensitive = isSensitivePart(key);
  const config = sensitive ? CREATURE_EXTRACTION.sensitive : CREATURE_EXTRACTION.nonSensitive;
  const material = getMaterial(key);
  const accessibility = getMaterialAccessibility(key);
  const requiredGrade = normalizeToolGradeKey(accessibility?.kitGrade) || "basico";
  const normalizedToolGrade = normalizeToolGradeKey(toolGrade);
  const tool = normalizedToolGrade ? (TOOL_GRADES[normalizedToolGrade] || TOOL_GRADES.basico) : TOOL_GRADES.basico;

  // Normalizar tamaño de criatura para buscar en los mapas
  const sizeMap = {
    "diminuto": "pequeña",
    "pequeño": "pequeña",
    "pequeña": "pequeña",
    "mediano": "mediana",
    "mediana": "mediana",
    "grande": "grande",
    "enorme": "enorme",
    "gigantesco": "gigantesca",
    "gigantesca": "gigantesca",
    "colosal": "gigantesca"
  };
  const normalizedSize = sizeMap[String(creatureSize || "mediana").toLowerCase()] || "mediana";

  // Obtener tiempo base según tamaño
  const baseTime = config.timeBySize[normalizedSize] || config.timeBySize.mediana || 60;

  // Obtener cantidad según tamaño
  const quantity = config.quantityBySize[normalizedSize] || config.quantityBySize.mediana || 1;

  // Determinar unidad según si es sensible o no
  const unit = sensitive ? (material?.unit ?? "unidad") : "kg";

  return {
    partKey: key,
    sensitive,
    label: material?.label ?? key,
    requiresTool: true,
    baseTime,
    extractionTime: calculateExtractionTime(baseTime, normalizedToolGrade || requiredGrade),
    requiredGrade,
    requiredLabel: TOOL_GRADES[requiredGrade]?.label ?? requiredGrade,
    quantity,
    unit,
    difficulty: accessibility?.extractionDifficulty ?? "fundamentos",
    bonus: tool.bonus,
    aptitudeKey: config.aptitudeKey,
    conservationInfo: getConservationInfo(key),
    note: config.note
  };
}

/**
 * Obtiene información de extracción para un mineral
 * @param {string} materialKey - clave del mineral
 * @param {string} toolGrade - grado de herramienta
 * @returns {object} - información de extracción
 */
export function getMineralExtractionInfo(materialKey, toolGrade = "basico") {
  const accessibility = getMaterialAccessibility(materialKey);
  const tool = TOOL_GRADES[toolGrade] || TOOL_GRADES.basico;
  const accessKey = accessibility.key;
  const material = getMaterial(materialKey);

  const yieldFormula = MINERAL_EXTRACTION.yieldTable[accessKey]?.[toolGrade] || "1d4 kg";

  return {
    materialKey,
    label: material?.label ?? materialKey,
    requiresTool: true,
    baseTime: MINERAL_EXTRACTION.baseTime,
    extractionTime: calculateExtractionTime(MINERAL_EXTRACTION.baseTime, toolGrade),
    difficulty: accessibility.extractionDifficulty,
    requiredGrade: accessibility.kitGrade,
    requiredLabel: TOOL_GRADES[accessibility.kitGrade]?.label ?? accessibility.kitGrade,
    maxGrade: tool.canExtractGrade,
    bonus: tool.bonus,
    yieldFormula,
    aptitudeKey: MINERAL_EXTRACTION.aptitudeKey,
    conservationInfo: getConservationInfo(materialKey),
    note: MINERAL_EXTRACTION.note
  };
}

/**
 * Obtiene información de extracción para una planta
 * @param {string} plantKey - clave de la planta
 * @param {string} toolGrade - grado de herramienta (kit de herboristería)
 * @returns {object} - información de extracción
 */
export function getPlantExtractionInfo(plantKey, toolGrade = "basico") {
  const plant = getPlant(plantKey);
  if (!plant) return null;

  const tool = TOOL_GRADES[toolGrade] || TOOL_GRADES.basico;
  const difficulty = getExtractionDifficulty(plant.accessibility);
  const accessGradeMap = { general: "basico", limitado: "avanzado", singular: "especializado" };
  const requiredGrade = accessGradeMap[plant.accessibility] || "basico";
  const baseTime = plant.extractionTime ?? 30;

  return {
    plantKey,
    label: plant.label,
    alchemicalIndex: plant.alchemicalIndex,
    use: plant.use,
    accessibility: plant.accessibility,
    difficulty,
    requiresTool: true,
    baseTime,
    extractionTime: calculateExtractionTime(baseTime, toolGrade),
    requiredGrade,
    requiredLabel: TOOL_GRADES[requiredGrade]?.label ?? requiredGrade,
    maxGrade: tool.canExtractGrade,
    bonus: tool.bonus,
    costPerUnit: plant.costPerUnit,
    aptitudeKey: PLANT_EXTRACTION.aptitudeKey,
    conservationInfo: getConservationInfo("plant"),
    note: PLANT_EXTRACTION.note
  };
}

/**
 * Obtiene información de conservación para un material o parte
 * @param {string} key - clave del material o "plant" para plantas
 * @returns {object} - información de conservación
 */
export function getConservationInfo(key) {
  const keyLower = String(key || "").toLowerCase();

  // Buscar en todas las categorías de conservación
  for (const category of Object.values(CONSERVATION_TIME)) {
    if (category.parts && category.parts.includes(keyLower)) {
      return category;
    }
  }

  // Default: minerales (no perecen)
  return CONSERVATION_TIME.minerals;
}

/**
 * Valida si se puede extraer un grado específico con la herramienta dada
 * @param {number} desiredGrade - grado deseado (1-3)
 * @param {string} toolGrade - grado de herramienta
 * @returns {boolean}
 */
export function canExtractGrade(desiredGrade, toolGrade = "basico") {
  const maxGrade = getMaxExtractableGrade(toolGrade);
  return desiredGrade <= maxGrade;
}
