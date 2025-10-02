// modules/utils/difficulties.js
// Sistema unificado de dificultades

/**
 * Niveles de dificultad con sus valores base
 */
export const DIFFICULTY_LEVELS = {
  fundamentos: {
    key: "fundamentos",
    label: "Fundamentos",
    base: 8,
    description: "Tareas básicas, conocimiento común"
  },
  desafiante: {
    key: "desafiante",
    label: "Desafiante",
    base: 10,
    description: "Requiere experiencia o habilidad"
  },
  riguroso: {
    key: "riguroso",
    label: "Riguroso",
    base: 12,
    description: "Tareas complejas, conocimiento especializado"
  },
  exigente: {
    key: "exigente",
    label: "Exigente",
    base: 15,
    description: "Extremadamente difícil, requiere maestría"
  },
  extremo: {
    key: "extremo",
    label: "Extremo",
    base: 17,
    description: "Casi imposible, límite de capacidad mortal"
  }
};

/**
 * Aliases para compatibilidad
 */
export const DIFFICULTY_ALIASES = {
  // TR (Tirada de Resistencia)
  "leve": "fundamentos",
  "moderado": "riguroso",
  "grave": "extremo",

  // Otros aliases comunes
  "easy": "fundamentos",
  "normal": "desafiante",
  "hard": "riguroso",
  "veryhard": "exigente",
  "extreme": "extremo"
};

/**
 * Get difficulty value from key
 * @param {string} difficultyKey - "fundamentos", "riguroso", etc.
 * @param {number} modifier - Optional modifier to add to base
 * @returns {number} DC value
 */
export function getDifficultyDC(difficultyKey, modifier = 0) {
  const key = String(difficultyKey || "fundamentos").toLowerCase();

  // Check aliases first
  const resolved = DIFFICULTY_ALIASES[key] || key;

  const difficulty = DIFFICULTY_LEVELS[resolved];
  if (!difficulty) {
    console.warn(`TSDC | Unknown difficulty: ${difficultyKey}, defaulting to fundamentos`);
    return DIFFICULTY_LEVELS.fundamentos.base + modifier;
  }

  return difficulty.base + modifier;
}

/**
 * Get difficulty object from key
 * @param {string} difficultyKey
 * @returns {Object} Difficulty object with key, label, base, description
 */
export function getDifficulty(difficultyKey) {
  const key = String(difficultyKey || "fundamentos").toLowerCase();
  const resolved = DIFFICULTY_ALIASES[key] || key;

  return DIFFICULTY_LEVELS[resolved] || DIFFICULTY_LEVELS.fundamentos;
}

/**
 * Get difficulty from DC value (reverse lookup)
 * @param {number} dc
 * @returns {Object} Closest difficulty level
 */
export function getDifficultyFromDC(dc) {
  const dcNum = Number(dc);

  if (dcNum < 9) return DIFFICULTY_LEVELS.fundamentos;
  if (dcNum < 11) return DIFFICULTY_LEVELS.desafiante;
  if (dcNum < 13.5) return DIFFICULTY_LEVELS.riguroso;
  if (dcNum < 16) return DIFFICULTY_LEVELS.exigente;
  return DIFFICULTY_LEVELS.extremo;
}

/**
 * Get difficulty DC with level modifier
 * For tasks that scale with character/creature level
 * @param {string} baseDifficulty
 * @param {number} level - Character or creature level
 * @returns {number} Final DC
 */
export function getDCWithLevel(baseDifficulty, level) {
  const base = getDifficultyDC(baseDifficulty);
  return base + Math.floor(level / 2);
}

/**
 * Check if a roll meets difficulty
 * @param {number} rollTotal
 * @param {string} difficultyKey
 * @param {number} modifier
 * @returns {boolean}
 */
export function checkDifficulty(rollTotal, difficultyKey, modifier = 0) {
  const dc = getDifficultyDC(difficultyKey, modifier);
  return rollTotal >= dc;
}

/**
 * Get degree of success (margin)
 * @param {number} rollTotal
 * @param {string} difficultyKey
 * @param {number} modifier
 * @returns {number} Margin (positive = success, negative = failure)
 */
export function getMargin(rollTotal, difficultyKey, modifier = 0) {
  const dc = getDifficultyDC(difficultyKey, modifier);
  return rollTotal - dc;
}

/**
 * Format difficulty for display
 * @param {string} difficultyKey
 * @param {boolean} showDC - Whether to show the DC value
 * @returns {string} Formatted string
 */
export function formatDifficulty(difficultyKey, showDC = false) {
  const diff = getDifficulty(difficultyKey);
  if (showDC) {
    return `${diff.label} (DC ${diff.base})`;
  }
  return diff.label;
}

/**
 * Get all difficulties as array (for UI dropdowns)
 * @returns {Array} Array of difficulty objects
 */
export function getAllDifficulties() {
  return Object.values(DIFFICULTY_LEVELS);
}
