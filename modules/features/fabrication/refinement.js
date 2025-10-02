// modules/features/fabrication/refinement.js
// Sistema de refinamiento de equipo con partes de criaturas

/**
 * Tiempo de refinamiento (fijo para todas las piezas)
 */
export const REFINEMENT_TIME_HOURS = 30;

/**
 * Costo de mano de obra de refinamiento (fijo para todos los materiales)
 * 60 Shekels por grado por kilogramo
 */
export const REFINEMENT_LABOR_COST_PER_KG = 60;

/**
 * Dificultad de refinamiento según grado
 */
export const REFINEMENT_DIFFICULTY = {
  1: "fundamentos",
  2: "riguroso",
  3: "extremo"
};

/**
 * Especialización requerida según tipo de equipo base
 */
export const REFINEMENT_SPECIALIZATION = {
  minerales: {
    label: "Refinamiento de Minerales",
    aptitudeKey: "herreria",
    requiresKit: "kit_refinamiento_minerales",
    validFor: ["metal", "piedra-preciosa", "roca"]
  },
  fibras: {
    label: "Refinamiento de Fibras",
    aptitudeKey: "sastreria",
    requiresKit: "kit_refinamiento_fibras",
    validFor: ["fibra", "cuero", "tela"]
  }
};

/**
 * Beneficios de refinamiento para armas
 */
export const WEAPON_REFINEMENTS = {
  // Huesos
  huesos: {
    key: "huesos",
    label: "Huesos",
    accessibility: "limitado",
    validFor: "armas",
    effects: {
      comun: {
        label: "Aumenta la durabilidad del arma en 10",
        bonus: { durability: 10 }
      },
      raro: {
        label: "Cada impacto exitoso obliga al enemigo a T.R de Alteraciones(Leve) o Desestabilizado(Desafiante)",
        bonus: { special: "desestabilizar" }
      },
      excepcional: {
        label: "Avanza un nivel de dado de un arma contundente",
        bonus: { diceStep: 1 }
      }
    }
  },

  // Cuernos
  cuernos: {
    key: "cuernos",
    label: "Cuernos",
    accessibility: "general",
    validFor: "armas",
    effects: {
      comun: {
        label: "Si usas maniobra/ataque después de movimiento, añades Tenacidad a la T.I",
        bonus: { special: "carga_tenacidad" }
      },
      raro: {
        label: "Tu T.A ignora hasta 2 puntos de la T.D del objetivo",
        bonus: { penetration: 2 }
      },
      excepcional: {
        label: "Incrementa rango de daño crítico para armas de dos manos",
        bonus: { criticalRange: 1 }
      }
    }
  },

  // Garras
  garras: {
    key: "garras",
    label: "Garras",
    accessibility: "general",
    validFor: "armas",
    effects: {
      comun: {
        label: "Aumenta la T.A en 2",
        bonus: { attackBonus: 2 }
      },
      raro: {
        label: "La T.I puede generar daño cortante además del tipo especificado. Añades Agilidad a T.I con cortante",
        bonus: { special: "cortante_agilidad" }
      },
      excepcional: {
        label: "Incrementa rango de daño crítico para armas de una mano",
        bonus: { criticalRange: 1 }
      }
    }
  },

  // Colmillos
  colmillos: {
    key: "colmillos",
    label: "Colmillos",
    accessibility: "limitado",
    validFor: "armas",
    effects: {
      comun: {
        label: "Puedes agregar tu Agilidad a las T.I de ataques perforantes",
        bonus: { special: "perforante_agilidad" }
      },
      raro: {
        label: "Cuando impregnas veneno, su duración se duplica",
        bonus: { special: "veneno_duplicado" }
      },
      excepcional: {
        label: "Cada impacto obliga a T.R Alteraciones(Leve) o Sangrando(Desafiante) igual a tu Agilidad",
        bonus: { special: "sangrado_agilidad" }
      }
    }
  }
};

/**
 * Beneficios de refinamiento para armaduras y escudos
 */
export const ARMOR_SHIELD_REFINEMENTS = {
  // Pelaje
  pelaje: {
    key: "pelaje",
    label: "Pelaje",
    accessibility: "general",
    validFor: ["armadura", "escudo"],
    effects: {
      comun: {
        label: "Aumenta el aguante en 1",
        bonus: { stamina: 1 }
      },
      raro: {
        label: "Reducción al daño contundente de 2",
        bonus: { damageReduction: { blunt: 2 } }
      },
      excepcional: {
        label: "Bonificador de +1 a las T.R de Infecciones",
        bonus: { resistanceBonus: { infections: 1 } }
      }
    }
  },

  // Caparazón
  caparazon: {
    key: "caparazon",
    label: "Caparazón",
    accessibility: "limitado",
    validFor: ["armadura", "escudo"],
    effects: {
      comun: {
        label: "Reducción al cortante y perforante de 2",
        bonus: { damageReduction: { cutting: 2, piercing: 2 } }
      },
      raro: {
        label: "Bonificador de +1 a T.R de Alteraciones contra derribos, desequilibrio y desplazamiento",
        bonus: { resistanceBonus: { alterations_movement: 1 } }
      },
      excepcional: {
        label: "Bonificador de +1 a las T.R de Venenos",
        bonus: { resistanceBonus: { poisons: 1 } }
      }
    }
  },

  // Escamas
  escamas: {
    key: "escamas",
    label: "Escamas",
    accessibility: "limitado",
    validFor: ["armadura", "escudo"],
    effects: {
      comun: {
        label: "Aumenta la durabilidad del equipo en 10",
        bonus: { durability: 10 }
      },
      raro: {
        label: "Bonificador de +1 a T.R contra elementos básicos (Fuego, Tierra, Agua, Viento)",
        bonus: { resistanceBonus: { elemental_basic: 1 } }
      },
      excepcional: {
        label: "Otorga un bonificador de +1 a la armadura",
        bonus: { armorBonus: 1 }
      }
    }
  },

  // Plumaje
  plumaje: {
    key: "plumaje",
    label: "Plumaje",
    accessibility: "general",
    validFor: ["armadura", "escudo"],
    effects: {
      comun: {
        label: "Reduce en 1 la penalización de velocidad de movimiento",
        bonus: { speedPenalty: -1 }
      },
      raro: {
        label: "Reduce el peso del equipamiento a la mitad",
        bonus: { weightReduction: 0.5 }
      },
      excepcional: {
        label: "Disminuye en 1 las penalizaciones en pruebas que requieran movilidad o destreza",
        bonus: { mobilityPenalty: -1 }
      }
    }
  }
};

/**
 * Calcula la cantidad de material necesaria para refinar
 */
export function calculateRefinementMaterial(equipmentType, weight) {
  switch (equipmentType) {
    case "arma":
      return weight; // Peso de la hoja
    case "armadura":
      return weight / 2; // La mitad del peso total
    case "escudo":
      return weight; // Peso completo
    default:
      return 0;
  }
}

/**
 * Calcula el costo total de refinamiento
 */
export function calculateRefinementCost(materialKey, grade, kgs, materialCostPerKg) {
  const laborCost = REFINEMENT_LABOR_COST_PER_KG * grade * kgs;
  const materialCost = materialCostPerKg * grade * kgs;

  return {
    laborCost,
    materialCost,
    totalCost: laborCost + materialCost,
    kgs,
    grade,
    hours: REFINEMENT_TIME_HOURS
  };
}

/**
 * Obtiene la dificultad de refinamiento según grado
 */
export function getRefinementDifficulty(grade) {
  return REFINEMENT_DIFFICULTY[grade] || "fundamentos";
}

/**
 * Valida si un material puede ser usado para refinar un tipo de equipo
 */
export function canRefineMaterial(materialKey, equipmentBaseType) {
  // equipmentBaseType: "minerales" o "fibras"
  const spec = REFINEMENT_SPECIALIZATION[equipmentBaseType];
  if (!spec) return false;

  // Buscar el material en refinamientos
  const allRefinements = { ...WEAPON_REFINEMENTS, ...ARMOR_SHIELD_REFINEMENTS };
  return allRefinements[materialKey] !== undefined;
}

/**
 * Obtiene los efectos de refinamiento para un material y calidad
 */
export function getRefinementEffects(materialKey, quality, equipmentType) {
  // equipmentType: "armas" o "armadura"/"escudo"
  const refinements = equipmentType === "armas" ?
                      WEAPON_REFINEMENTS :
                      ARMOR_SHIELD_REFINEMENTS;

  const material = refinements[materialKey];
  if (!material) return null;

  const qualityKey = quality === 1 ? "comun" :
                     quality === 2 ? "raro" : "excepcional";

  return material.effects[qualityKey];
}

/**
 * Obtiene información completa del refinamiento
 */
export function getRefinementInfo(materialKey, quality, equipmentType, kgs, materialCostPerKg) {
  const effects = getRefinementEffects(materialKey, quality, equipmentType);
  const cost = calculateRefinementCost(materialKey, quality, kgs, materialCostPerKg);
  const difficulty = getRefinementDifficulty(quality);

  return {
    materialKey,
    quality,
    qualityLabel: quality === 1 ? "Común" : quality === 2 ? "Raro" : "Excepcional",
    equipmentType,
    effects,
    cost,
    difficulty,
    hours: REFINEMENT_TIME_HOURS
  };
}
