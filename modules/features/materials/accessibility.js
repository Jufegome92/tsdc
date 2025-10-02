// modules/features/materials/accessibility.js
// Sistema de accesibilidad de materiales

export const ACCESSIBILITY_LEVELS = {
  general: {
    key: "general",
    label: "General (Alta)",
    extractionDifficulty: "fundamentos",
    extractionDCBase: 8, // DC = 8 + nivel de criatura
    fabricationDifficulty: "fundamentos",
    identificationDifficulty: "fundamentos",
    laborCostPerKg: (grade) => 15 * grade,
    fabricationTime: "1 semana", // armas, escudos, armaduras
    kitGrade: "basico" // Básico puede extraer accesibilidad alta
  },

  limitado: {
    key: "limitado",
    label: "Limitado (Media)",
    extractionDifficulty: "riguroso",
    extractionDCBase: 15, // DC = 15 + nivel de criatura
    fabricationDifficulty: "riguroso",
    identificationDifficulty: "riguroso",
    laborCostPerKg: (grade) => 45 * grade,
    fabricationTime: "2 semanas",
    kitGrade: "avanzado" // Avanzado puede extraer alta y media
  },

  singular: {
    key: "singular",
    label: "Singular (Baja)",
    extractionDifficulty: "extremo",
    extractionDCBase: 17, // DC = 17 + nivel de criatura
    fabricationDifficulty: "extremo",
    identificationDifficulty: "extremo",
    laborCostPerKg: (grade) => 150 * grade,
    fabricationTime: "3 semanas",
    kitGrade: "especializado" // Especializado puede extraer alta, media y baja
  }
};

// Mapeo de materiales a su accesibilidad
export const MATERIAL_ACCESSIBILITY = {
  // GENERAL (Accesibilidad Alta)
  general: [
    "bronce", "hierro", "cobre", "estano", "vidrio", "ambar", "pino", "plomo",
    "roble", "caoba", "arce", "piedra", "roca", "carbon", "coral", "peltre",
    "pelaje", "plumaje", "cuernos", "garras", "fluidos", "tela",
    // Fibras naturales
    "seda", "lana", "algodon", "lino", "yute"
  ],

  // LIMITADO (Accesibilidad Media)
  limitado: [
    "cromo", "acero", "plata", "platino", "cristales", "ebano", "marfil",
    "lapislazuli", "oro", "cuarzo", "escamas", "caparazon", "huesos",
    "colmillos", "glandulas", "organos", "cuero", "escamado", "acorazado",
    // Fibras sintéticas
    "nailon", "poliester"
  ],

  // SINGULAR (Accesibilidad Baja)
  singular: [
    "secoya", "mithril", "adamantium", "titanio", "oricalco", "obsidiana",
    "seda_arakhel", "jade", "rubi", "esmeralda", "zafiro", "diamante",
    "topacio", "nervios", "sistema_nervioso"
  ]
};

/**
 * Obtiene la accesibilidad de un material
 * @param {string} materialKey
 * @returns {object} - datos de accesibilidad
 */
export function getMaterialAccessibility(materialKey) {
  const key = String(materialKey || "").toLowerCase();

  for (const [level, materials] of Object.entries(MATERIAL_ACCESSIBILITY)) {
    if (materials.includes(key)) {
      return ACCESSIBILITY_LEVELS[level];
    }
  }

  // Por defecto, general
  return ACCESSIBILITY_LEVELS.general;
}

/**
 * Calcula el costo de mano de obra
 * @param {string} materialKey
 * @param {number} grade - grado de calidad
 * @param {number} kgs - kilogramos
 * @returns {number} - costo en Shekels
 */
export function calculateLaborCost(materialKey, grade, kgs) {
  const accessibility = getMaterialAccessibility(materialKey);
  return accessibility.laborCostPerKg(grade) * kgs;
}

/**
 * Calcula la DC de extracción según accesibilidad y nivel de criatura
 * @param {string} materialKey - clave del material
 * @param {number} creatureLevel - nivel de la criatura
 * @returns {number} - DC final
 */
export function calculateExtractionDC(materialKey, creatureLevel = 0) {
  const accessibility = getMaterialAccessibility(materialKey);
  return accessibility.extractionDCBase + Number(creatureLevel);
}
