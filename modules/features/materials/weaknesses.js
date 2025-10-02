// modules/features/materials/weaknesses.js
// Debilidades de materiales - daño triplicado cuando se enfrentan a su debilidad

export const MATERIAL_WEAKNESSES = {
  // Metales débiles a la Corrosión (ácido)
  corrosion: {
    type: "acid",
    damageMultiplier: 3,
    materials: [
      "bronce", "hierro", "cobre", "estano", "plata", "platino", "acero",
      "escamas", "caparazon", "colmillos", "cuernos", "garras", "huesos"
    ]
  },

  // Materiales Frágiles (contundente)
  fragile: {
    type: "blunt",
    damageMultiplier: 3,
    materials: [
      "jade", "lapislazuli", "cuarzo", "ambar", "marfil", "coral",
      "rubi", "zafiro", "esmeralda", "cristales", "vidrio", "obsidiana"
    ]
  },

  // Materiales Orgánicos (fuego)
  organic: {
    type: "fire",
    damageMultiplier: 3,
    materials: [
      "pelaje", "plumaje", "seda_arakhel"
    ]
  }
};

/**
 * Obtiene la debilidad de un material
 * @param {string} materialKey - clave del material
 * @returns {object|null} - {type, damageMultiplier} o null
 */
export function getMaterialWeakness(materialKey) {
  const key = String(materialKey || "").toLowerCase();

  for (const [weaknessType, data] of Object.entries(MATERIAL_WEAKNESSES)) {
    if (data.materials.includes(key)) {
      return {
        type: data.type,
        multiplier: data.damageMultiplier,
        weaknessCategory: weaknessType
      };
    }
  }

  return null;
}

/**
 * Calcula el daño aplicando debilidad si corresponde
 * @param {string} materialKey - clave del material
 * @param {number} baseDamage - daño base
 * @param {string} damageType - tipo de daño (acid, blunt, fire, etc.)
 * @returns {number} - daño final
 */
export function calculateWeaknessDamage(materialKey, baseDamage, damageType) {
  const weakness = getMaterialWeakness(materialKey);

  if (weakness && weakness.type === damageType) {
    return baseDamage * weakness.multiplier;
  }

  return baseDamage;
}
