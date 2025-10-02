// modules/features/materials/plants.js
// Catálogo de plantas con índice alquímico

export const PLANTS = {
  // ACCESIBILIDAD ALTA
  consuelda: {
    key: "consuelda", label: "Consuelda", accessibility: "alta",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 15 // minutos
  },
  verbena: {
    key: "verbena", label: "Verbena", accessibility: "alta",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 15
  },
  achillea: {
    key: "achillea", label: "Achillea", accessibility: "alta",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 15
  },
  matricaria: {
    key: "matricaria", label: "Matricaria", accessibility: "alta",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 15
  },
  hypericum: {
    key: "hypericum", label: "Hypericum", accessibility: "alta",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 15
  },
  echinacea: {
    key: "echinacea", label: "Echinacea", accessibility: "alta",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 15
  },
  ortiga: {
    key: "ortiga", label: "Ortiga", accessibility: "alta",
    alchemicalIndex: 3, use: "elixir",
    costPerUnit: 6, extractionTime: 15
  },
  lavanda: {
    key: "lavanda", label: "Lavanda", accessibility: "alta",
    alchemicalIndex: 2, use: "elixir",
    costPerUnit: 4, extractionTime: 15
  },
  oregano: {
    key: "oregano", label: "Orégano", accessibility: "alta",
    alchemicalIndex: 2, use: "elixir",
    costPerUnit: 4, extractionTime: 15
  },
  enebro: {
    key: "enebro", label: "Enebro", accessibility: "alta",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 15
  },
  melisa: {
    key: "melisa", label: "Melisa", accessibility: "alta",
    alchemicalIndex: 3, use: "elixir",
    costPerUnit: 6, extractionTime: 15
  },
  borraja: {
    key: "borraja", label: "Borraja", accessibility: "alta",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 15
  },
  equisetum: {
    key: "equisetum", label: "Equisetum", accessibility: "alta",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 15
  },

  // ACCESIBILIDAD MEDIA
  dedalera: {
    key: "dedalera", label: "Dedalera", accessibility: "media",
    alchemicalIndex: 7, use: "veneno",
    costPerUnit: 12, extractionTime: 30
  },
  ajenjo: {
    key: "ajenjo", label: "Ajenjo", accessibility: "media",
    alchemicalIndex: 5, use: "elixir",
    costPerUnit: 10, extractionTime: 30
  },
  divinorum: {
    key: "divinorum", label: "Divinorum", accessibility: "media",
    alchemicalIndex: 6, use: "ambos",
    costPerUnit: 12, extractionTime: 30
  },
  papaver: {
    key: "papaver", label: "Papaver", accessibility: "media",
    alchemicalIndex: 7, use: "elixir",
    costPerUnit: 14, extractionTime: 30
  },
  rhodiola: {
    key: "rhodiola", label: "Rhodiola", accessibility: "media",
    alchemicalIndex: 6, use: "elixir",
    costPerUnit: 12, extractionTime: 30
  },
  silybum: {
    key: "silybum", label: "Silybum", accessibility: "media",
    alchemicalIndex: 5, use: "elixir",
    costPerUnit: 10, extractionTime: 30
  },
  pasiflora: {
    key: "pasiflora", label: "Pasiflora", accessibility: "media",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 30
  },
  escutelaria: {
    key: "escutelaria", label: "Escutelaria", accessibility: "media",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 30
  },
  smilax: {
    key: "smilax", label: "Smilax", accessibility: "media",
    alchemicalIndex: 5, use: "elixir",
    costPerUnit: 10, extractionTime: 30
  },
  curcuma: {
    key: "curcuma", label: "Cúrcuma", accessibility: "media",
    alchemicalIndex: 5, use: "elixir",
    costPerUnit: 10, extractionTime: 30
  },

  // Hongos - Accesibilidad Media
  amanita_muscaria: {
    key: "amanita_muscaria", label: "Amanita Muscaria", accessibility: "media",
    alchemicalIndex: 7, use: "ambos",
    costPerUnit: 14, extractionTime: 30
  },
  psilocybe: {
    key: "psilocybe", label: "Psilocybe", accessibility: "media",
    alchemicalIndex: 7, use: "ambos",
    costPerUnit: 14, extractionTime: 30
  },
  dealbata: {
    key: "dealbata", label: "Dealbata", accessibility: "media",
    alchemicalIndex: 6, use: "veneno",
    costPerUnit: 12, extractionTime: 30
  },
  gyromitra: {
    key: "gyromitra", label: "Gyromitra", accessibility: "media",
    alchemicalIndex: 6, use: "veneno",
    costPerUnit: 12, extractionTime: 30
  },
  lactarius: {
    key: "lactarius", label: "Lactarius", accessibility: "media",
    alchemicalIndex: 5, use: "elixir",
    costPerUnit: 10, extractionTime: 30
  },
  pleurotus: {
    key: "pleurotus", label: "Pleurotus", accessibility: "media",
    alchemicalIndex: 4, use: "elixir",
    costPerUnit: 8, extractionTime: 30
  },
  tricholoma: {
    key: "tricholoma", label: "Tricholoma", accessibility: "media",
    alchemicalIndex: 5, use: "elixir",
    costPerUnit: 10, extractionTime: 30
  },
  chaga: {
    key: "chaga", label: "Chaga", accessibility: "media",
    alchemicalIndex: 6, use: "elixir",
    costPerUnit: 12, extractionTime: 30
  },

  // ACCESIBILIDAD BAJA
  boletus: {
    key: "boletus", label: "Boletus", accessibility: "baja",
    alchemicalIndex: 9, use: "veneno",
    costPerUnit: 18, extractionTime: 60
  },
  cordyceps: {
    key: "cordyceps", label: "Cordyceps", accessibility: "baja",
    alchemicalIndex: 8, use: "elixir",
    costPerUnit: 16, extractionTime: 60
  },
  aconito: {
    key: "aconito", label: "Acónito", accessibility: "baja",
    alchemicalIndex: 8, use: "veneno",
    costPerUnit: 15, extractionTime: 60
  },
  belladona: {
    key: "belladona", label: "Belladona", accessibility: "baja",
    alchemicalIndex: 9, use: "veneno",
    costPerUnit: 18, extractionTime: 60
  },
  estramonio: {
    key: "estramonio", label: "Estramonio", accessibility: "baja",
    alchemicalIndex: 8, use: "ambos",
    costPerUnit: 16, extractionTime: 60
  },
  ricino: {
    key: "ricino", label: "Ricino", accessibility: "baja",
    alchemicalIndex: 9, use: "veneno",
    costPerUnit: 18, extractionTime: 60
  },
  cicuta: {
    key: "cicuta", label: "Cicuta", accessibility: "baja",
    alchemicalIndex: 10, use: "veneno",
    costPerUnit: 20, extractionTime: 60
  },
  artemisa: {
    key: "artemisa", label: "Artemisa", accessibility: "baja",
    alchemicalIndex: 5, use: "elixir",
    costPerUnit: 10, extractionTime: 60
  },
  adelfa: {
    key: "adelfa", label: "Adelfa", accessibility: "baja",
    alchemicalIndex: 10, use: "veneno",
    costPerUnit: 20, extractionTime: 60
  },
  taxus: {
    key: "taxus", label: "Taxus", accessibility: "baja",
    alchemicalIndex: 10, use: "veneno",
    costPerUnit: 20, extractionTime: 60
  },
  mandragora: {
    key: "mandragora", label: "Mandrágora", accessibility: "baja",
    alchemicalIndex: 9, use: "ambos",
    costPerUnit: 18, extractionTime: 60
  }
};

/**
 * Obtiene datos de una planta
 * @param {string} plantKey
 * @returns {object|null}
 */
export function getPlant(plantKey) {
  return PLANTS[String(plantKey || "").toLowerCase()] ?? null;
}

/**
 * Lista plantas por accesibilidad
 * @param {string} accessibility - "alta", "media", "baja"
 * @returns {array}
 */
export function listPlantsByAccessibility(accessibility) {
  return Object.values(PLANTS).filter(p => p.accessibility === accessibility);
}

/**
 * Lista plantas por uso
 * @param {string} use - "elixir", "veneno", "ambos"
 * @returns {array}
 */
export function listPlantsByUse(use) {
  return Object.values(PLANTS).filter(p => p.use === use || p.use === "ambos");
}

/**
 * Obtiene dificultad de extracción según accesibilidad
 * @param {string} accessibility
 * @returns {string}
 */
export function getExtractionDifficulty(accessibility) {
  const difficulties = {
    alta: "fundamentos",
    media: "riguroso",
    baja: "extremo"
  };
  return difficulties[accessibility] || "fundamentos";
}
