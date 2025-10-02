// modules/features/fabrication/equipment.js
// Sistema de fabricación de equipo (armas, armaduras, escudos)

import { getMaterialAccessibility } from "../materials/accessibility.js";

/**
 * Dificultades de fabricación según accesibilidad
 */
export const FABRICATION_DIFFICULTY = {
  general: "fundamentos",
  limitado: "riguroso",
  singular: "extremo"
};

/**
 * Tiempo de fabricación según accesibilidad (en semanas)
 */
export const FABRICATION_TIME = {
  general: 1,  // 1 semana = 30 horas (6h/día * 5 días)
  limitado: 2, // 2 semanas = 60 horas
  singular: 3  // 3 semanas = 90 horas
};

/**
 * Costos de diseños de armas
 */
export const WEAPON_DESIGNS = {
  arrojadizas_distancia: {
    label: "Armas Arrojadizas y a Distancia",
    cost: 50,
    availability: "común"
  },
  con_mango: {
    label: "Armas con Mango",
    cost: 80,
    availability: "común"
  },
  flexibles: {
    label: "Armas Flexibles",
    cost: 100,
    availability: "moderado"
  }
};

/**
 * Costos de diseños de armaduras
 */
export const ARMOR_DESIGNS = {
  ligera: {
    label: "Armadura Ligera",
    cost: 50,
    availability: "común"
  },
  intermedia: {
    label: "Armadura Intermedia",
    cost: 80,
    availability: "común"
  },
  pesada: {
    label: "Armadura Pesada",
    cost: 100,
    availability: "moderado"
  }
};

/**
 * Costos de diseños de escudos
 */
export const SHIELD_DESIGNS = {
  ligero: {
    label: "Escudo Ligero",
    cost: 50,
    availability: "común"
  },
  intermedio: {
    label: "Escudo Intermedio",
    cost: 80,
    availability: "común"
  },
  pesado: {
    label: "Escudo Pesado",
    cost: 100,
    availability: "moderado"
  }
};

/**
 * Costos de diseños de joyas
 */
export const JEWELRY_DESIGNS = {
  colgante: {
    label: "Colgante",
    cost: 50,
    availability: "especializado",
    description: "Objetos utilitarios convertidos en accesorios portátiles. Peso máximo: 1kg."
  },
  amuleto: {
    label: "Amuleto",
    cost: 80,
    availability: "especializado",
    description: "Pequeños objetos ornamentales imbuidos de significado y creencias."
  },
  insignia: {
    label: "Insignia",
    cost: 100,
    availability: "especializado",
    description: "Símbolos de estatus, logros o afiliación a un grupo."
  }
};

/**
 * Materiales requeridos por tipo de arma
 */
export const WEAPON_MATERIALS = {
  // Armas de Asta
  asta: {
    label: "Armas de Asta",
    materials: {
      asta: { type: "madera", kg: 5 },
      hoja: { type: "metal", kg: 2 }
    }
  },
  // Lanzas
  lanza_dos_manos: {
    label: "Lanza (Dos Manos)",
    materials: {
      asta: { type: "madera", kg: 4 },
      punta: { type: "metal", kg: 2 }
    }
  },
  lanza_una_mano: {
    label: "Lanza (Una Mano)",
    materials: {
      asta: { type: "madera", kg: 2 },
      punta: { type: "metal", kg: 1 }
    }
  },
  // Hachas
  hacha_dos_manos: {
    label: "Hacha (Dos Manos)",
    materials: {
      mango: { type: "madera", kg: 3 },
      hoja: { type: "metal", kg: 2 }
    }
  },
  hacha_una_mano: {
    label: "Hacha (Una Mano)",
    materials: {
      mango: { type: "madera", kg: 2 },
      hoja: { type: "metal", kg: 1 }
    }
  },
  // Mazas
  maza_dos_manos: {
    label: "Maza (Dos Manos)",
    materials: {
      mango: { type: "madera_metal", kg: 3 },
      cabeza: { type: "metal", kg: 3 }
    }
  },
  maza_una_mano: {
    label: "Maza (Una Mano)",
    materials: {
      mango: { type: "madera_metal", kg: 1 },
      cabeza: { type: "metal", kg: 1 }
    }
  },
  // Hojas
  hoja_larga_dos_manos: {
    label: "Hoja Larga (Dos Manos)",
    materials: {
      material: { type: "metal", kg: 3 }
    }
  },
  hoja_larga_una_mano: {
    label: "Hoja Larga (Una Mano)",
    materials: {
      material: { type: "metal", kg: 2 }
    }
  },
  hoja_corta: {
    label: "Hoja Corta",
    materials: {
      material: { type: "metal", kg: 1 }
    }
  },
  daga: {
    label: "Daga",
    materials: {
      material: { type: "metal", kg: 1 }
    }
  },
  // Arrojadizas
  kunai_shuriken: {
    label: "Kunai/Shuriken (x3)",
    materials: {
      material: { type: "metal", kg: 1 }
    }
  },
  pilum_francisca: {
    label: "Pilum/Francisca",
    materials: {
      mango: { type: "madera", kg: 1 },
      hoja: { type: "metal", kg: 2 }
    }
  },
  // A Distancia
  arco_cerbatana: {
    label: "Arco/Cerbatana",
    materials: {
      cuerpo: { type: "madera", kg: 1 }
    }
  },
  balearic: {
    label: "Balearic",
    materials: {
      cuerpo: { type: "fibra", kg: 1 }
    }
  },
  // Flexibles
  kusarigama_fundo: {
    label: "Kusarigama/Kusari Fundo",
    materials: {
      material: { type: "metal", kg: 2 }
    }
  },
  nekode: {
    label: "Nekode (x2)",
    materials: {
      material: { type: "metal", kg: 1 }
    }
  },
  scourge: {
    label: "Scourge",
    materials: {
      material: { type: "fibra", kg: 3 }
    }
  }
};

/**
 * Materiales requeridos por pieza de armadura
 */
export const ARMOR_MATERIALS = {
  casco: {
    label: "Casco",
    ligero: 1,
    intermedio: 2,
    pesado: 3
  },
  peto: {
    label: "Peto",
    ligero: 3,
    intermedio: 6,
    pesado: 9
  },
  pantalon: {
    label: "Pantalón",
    ligero: 2,
    intermedio: 4,
    pesado: 6
  },
  brazales: {
    label: "Brazales",
    ligero: 2,
    intermedio: 3,
    pesado: 4
  },
  botas: {
    label: "Botas",
    ligero: 1,
    intermedio: 2,
    pesado: 3
  }
};

/**
 * Materiales válidos para cada tipo de armadura
 */
export const ARMOR_VALID_MATERIALS = {
  ligero: ["cuero", "tela", "seda_arakhel", "titanio"],
  intermedio: ["bronce", "hierro", "cobre", "obsidiana", "peltre", "mithril", "escamado"],
  pesado: ["acero", "plomo", "plata", "oro", "adamantium", "oricalco", "platino", "acorazado"]
};

/**
 * Materiales requeridos para escudos
 */
export const SHIELD_MATERIALS = {
  liviano: 3,
  intermedio: 7,
  pesado: 11
};

/**
 * Materiales válidos para cada tipo de escudo
 */
export const SHIELD_VALID_MATERIALS = {
  liviano: ["cuero", "roble", "pino", "caoba", "arce", "titanio"],
  intermedio: ["bronce", "hierro", "cobre", "peltre", "mithril", "escamado"],
  pesado: ["acero", "plomo", "plata", "oro", "adamantium", "oricalco", "platino", "acorazado"]
};

/**
 * Calcula el costo total de fabricación de equipo
 */
export function calculateEquipmentCost(materialKey, quality, kgs) {
  const accessibility = getMaterialAccessibility(materialKey);

  // Costo de materiales (desde materials/index.js)
  const materialCost = kgs * quality * 10; // Simplificado, deberías usar materialCost() del módulo

  // Costo de mano de obra
  const laborCostPerKg = accessibility.laborCostPerKg(quality);
  const laborCost = laborCostPerKg * kgs;

  return {
    materialCost,
    laborCost,
    totalCost: materialCost + laborCost,
    kgs,
    quality
  };
}

/**
 * Calcula las horas de fabricación según accesibilidad
 */
export function calculateFabricationHours(materialKey) {
  const accessibility = getMaterialAccessibility(materialKey);
  const weeks = FABRICATION_TIME[accessibility.key];
  return weeks * 30; // 30 horas por semana (6h/día * 5 días)
}

/**
 * Obtiene la dificultad de fabricación
 */
export function getFabricationDifficulty(materialKey) {
  const accessibility = getMaterialAccessibility(materialKey);
  return FABRICATION_DIFFICULTY[accessibility.key];
}

/**
 * Valida si un material es válido para un tipo de armadura
 */
export function isValidArmorMaterial(materialKey, armorType) {
  return ARMOR_VALID_MATERIALS[armorType]?.includes(materialKey) || false;
}

/**
 * Valida si un material es válido para un tipo de escudo
 */
export function isValidShieldMaterial(materialKey, shieldType) {
  return SHIELD_VALID_MATERIALS[shieldType]?.includes(materialKey) || false;
}

/**
 * Calcula el peso total de materiales para un arma
 */
export function calculateWeaponMaterialWeight(weaponType) {
  const weapon = WEAPON_MATERIALS[weaponType];
  if (!weapon) return 0;

  return Object.values(weapon.materials).reduce((total, mat) => total + mat.kg, 0);
}

/**
 * Calcula el peso total de materiales para una pieza de armadura
 */
export function calculateArmorPieceMaterialWeight(piece, type) {
  const armorPiece = ARMOR_MATERIALS[piece];
  if (!armorPiece) return 0;

  return armorPiece[type] || 0;
}
