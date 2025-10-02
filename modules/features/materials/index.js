// modules/features/materials/index.js
// Catálogo unificado de materiales y utilidades para calcular
// Durabilidad, Potencia y Costos en función del "Grado de calidad".

/**
 * Convenciones:
 * - quality: "Grado de calidad" (entero >=1 normalmente).
 *   Grado 1 = Común, Grado 2 = Raro, Grado 3 = Excepcional
 * - Para costos: por defecto "kg" (kilogramo). Algunos usan "unidad" o "litro".
 * - durability / potency: pueden ser número fijo o función (q) => número.
 * - costPerUnit: función (q, qty=1) => número total (en Shekels).
 * - unit: "kg" | "unidad" | "litro"
 */

// Importar módulos complementarios
import { getMaterialWeakness, calculateWeaknessDamage } from "./weaknesses.js";
import { getMaterialAccessibility, calculateLaborCost, ACCESSIBILITY_LEVELS } from "./accessibility.js";
import { getPlant, listPlantsByAccessibility, listPlantsByUse, getExtractionDifficulty } from "./plants.js";
import {
  TOOL_GRADES,
  CREATURE_EXTRACTION,
  MINERAL_EXTRACTION,
  PLANT_EXTRACTION,
  CONSERVATION_TIME,
  getMaxExtractableGrade,
  calculateExtractionTime,
  isSensitivePart,
  getCreatureExtractionInfo,
  getMineralExtractionInfo,
  getPlantExtractionInfo,
  getConservationInfo,
  canExtractGrade
} from "./extraction.js";

export const MATERIAL_DESCRIPTIONS = {
  bronce: "Aleación resistente de cobre y estaño, apreciada por su durabilidad y facilidad de trabajo.",
  hierro: "Metal ferroso, duro y magnético. Utilizado en construcción y fabricación de herramientas.",
  acero: "Metal reforzado a partir del hierro, ideal para armas y armaduras por su dureza y maleabilidad.",
  jade: "Piedra preciosa de color verde intenso, valorada por su belleza y dureza.",
  carbon: "Combustible fósil negro y poroso, esencial en la forja y fundición de metales.",
  lapislazuli: "Roca metamórfica azul y vibrante, usada en joyería y pigmentos raros.",
  vidrio: "Material vítreo translúcido, útil para ornamentos, lentes y recipientes.",
  peltre: "Aleación gris plateada, maleable y económica, común en utensilios y adornos.",
  oro: "Metal precioso amarillo, maleable y resistente a la oxidación, símbolo de riqueza.",
  estano: "Metal blando y dúctil, imprescindible en aleaciones como el bronce.",
  cobre: "Metal rojizo, excelente conductor, usado en cables, tuberías y aleaciones.",
  cristales: "Sólidos transparentes de estructura ordenada, variados en color y composición.",
  piedra: "Material natural sólido, usado en construcción y escultura por su resistencia.",
  roca: "Bloques minerales crudos empleados como base en múltiples aplicaciones.",
  obsidiana: "Vidrio volcánico negro y afilado, ideal para filos y artefactos ceremoniales.",
  mithril: "Metal legendario, ligero y tan resistente como el acero más puro.",
  adamantium: "Metal casi indestructible, extremadamente raro y codiciado.",
  titanio: "Metal ligero con enorme resistencia a la corrosión, preferido en equipos durables.",
  plata: "Metal precioso blanco brillante, utilizado en joyería y artefactos rituales.",
  platino: "Metal precioso grisáceo, estable y resistente al desgaste extremo.",
  cuarzo: "Cristal duro y común, empleado en joyería y mecanismos de precisión.",
  ambar: "Resina fósil translúcida, famosa por encapsular restos orgánicos.",
  marfil: "Material blanco denso proveniente de colmillos, utilizado en tallas finas.",
  coral: "Estructuras calcáreas marinas, apreciadas por sus colores para joyería.",
  ebano: "Madera oscura y muy densa, símbolo de lujo y longevidad.",
  roble: "Madera robusta y resistente, ideal para construcciones perdurables.",
  caoba: "Madera rojiza de acabado fino, popular en muebles y artesanías de lujo.",
  pino: "Madera ligera y versátil, útil en carpintería cotidiana.",
  arce: "Madera dura de grano atractivo, perfecta para instrumentos y detalles decorativos.",
  secoya: "Madera resistente y monumental, reservada para proyectos de gran escala.",
  rubi: "Gema roja intensa, una de las piedras más duras y codiciadas.",
  esmeralda: "Gema verde vibrante, apreciada por su claridad y simbolismo.",
  zafiro: "Gema de azul profundo, segunda en dureza tras el diamante.",
  diamante: "La gema más dura, de brillo incomparable usada en lujo y corte industrial.",
  topacio: "Gema que presenta múltiples colores y un brillo cálido distintivo.",
  cromo: "Metal gris acerado, brillante y resistente a la corrosión extrema.",
  plomo: "Metal pesado maleable, útil para protecciones especiales y contrapesos.",
  oricalco: "Metal mítico rojizo con propiedades elementales excepcionales.",
  seda_arakhel: "Fibra sobrenatural resistente y elástica, ideal para armaduras ligeras.",
  lana: "Fibra cálida y aislante obtenida de animales lanudos.",
  algodon: "Fibra suave vegetal, omnipresente en textiles de uso diario.",
  seda: "Fibra lujosa y resistente con brillo natural característico.",
  lino: "Fibra fresca y resistente proveniente del tallo de lino.",
  yute: "Fibra vegetal robusta, usada en cuerdas y textiles rústicos.",
  nailon: "Fibra sintética elástica y duradera con innumerables aplicaciones.",
  poliester: "Fibra sintética versátil, apreciada por su resistencia y bajo mantenimiento."
};

export const MATERIAL_TYPE_LABELS = {
  metal: "Metal",
  "piedra-preciosa": "Piedra Preciosa",
  roca: "Roca",
  madera: "Madera",
  fibra: "Fibra",
  cuero: "Cuero",
  "parte-criatura": "Parte de criatura",
  "cuero": "Cuero"
};

export const MATERIAL_QUALITY_LEVELS = {
  1: { grade: 1, key: "comun", label: "Común", min: 1, max: 50 },
  2: { grade: 2, key: "raro", label: "Raro", min: 51, max: 80 },
  3: { grade: 3, key: "excepcional", label: "Excepcional", min: 81, max: 100 }
};

export const MATERIAL_QUALITY_BY_KEY = {
  comun: MATERIAL_QUALITY_LEVELS[1],
  raro: MATERIAL_QUALITY_LEVELS[2],
  excepcional: MATERIAL_QUALITY_LEVELS[3]
};

export const VEIN_RICHNESS_LEVELS = {
  pobre: {
    key: "pobre",
    label: "Pobre",
    dice: "1d10",
    description: "Depósitos pequeños y dispersos. Ideal para recolecciones rápidas.",
    durationMinutes: 120
  },
  moderada: {
    key: "moderada",
    label: "Moderada",
    dice: "2d10",
    description: "Veta estable con recursos suficientes para un grupo de mineros.",
    durationMinutes: 240
  },
  rica: {
    key: "rica",
    label: "Rica",
    dice: "3d10",
    description: "Abundante suministro con gran rentabilidad.",
    durationMinutes: 360
  },
  muy_rica: {
    key: "muy_rica",
    label: "Muy Rica",
    dice: "4d10",
    description: "Descubrimiento excepcional, requiere logística y protección.",
    durationMinutes: 480
  }
};

export function normalizeMaterialQuality(value) {
  if (value == null) return 1;
  if (typeof value === "string") {
    const lower = value.toLowerCase();
    const byKey = MATERIAL_QUALITY_BY_KEY[lower];
    if (byKey) return byKey.grade;
    const num = Number(lower);
    if (Number.isFinite(num)) return Math.min(3, Math.max(1, num));
    return 1;
  }
  const num = Number(value);
  return Number.isFinite(num) ? Math.min(3, Math.max(1, Math.round(num))) : 1;
}

export function getMaterialQualityInfo(value) {
  const grade = normalizeMaterialQuality(value);
  return MATERIAL_QUALITY_LEVELS[grade];
}

export function getMaterialTypeLabel(value) {
  const raw = typeof value === "string" ? value : value?.type;
  const key = String(raw ?? "").toLowerCase().replace(/_/g, "-");
  return MATERIAL_TYPE_LABELS[key] ?? "Material";
}

export function getVeinRichnessInfo(value) {
  if (!value) return VEIN_RICHNESS_LEVELS.moderada;
  const key = String(value).toLowerCase();
  return VEIN_RICHNESS_LEVELS[key] ?? VEIN_RICHNESS_LEVELS.moderada;
}

export function getMaterialQualityFromRoll(rollValue) {
  const total = Number(rollValue) || 0;
  if (total <= 50) return { ...MATERIAL_QUALITY_LEVELS[1], roll: total };
  if (total <= 80) return { ...MATERIAL_QUALITY_LEVELS[2], roll: total };
  return { ...MATERIAL_QUALITY_LEVELS[3], roll: total };
}

function numOrFn(v, q) { return (typeof v === "function") ? v(Number(q||1)) : Number(v||0); }

// Re-exportar funciones de módulos complementarios
export {
  // Weaknesses
  getMaterialWeakness,
  calculateWeaknessDamage,
  // Accessibility
  getMaterialAccessibility,
  calculateLaborCost,
  ACCESSIBILITY_LEVELS,
  // Plants
  getPlant,
  listPlantsByAccessibility,
  listPlantsByUse,
  getExtractionDifficulty,
  // Extraction
  TOOL_GRADES,
  CREATURE_EXTRACTION,
  MINERAL_EXTRACTION,
  PLANT_EXTRACTION,
  CONSERVATION_TIME,
  getMaxExtractableGrade,
  calculateExtractionTime,
  isSensitivePart,
  getCreatureExtractionInfo,
  getMineralExtractionInfo,
  getPlantExtractionInfo,
  getConservationInfo,
  canExtractGrade
};

export const MATERIALS = {
  // -------------------------
  // PARTES DE CRIATURA
  // -------------------------
  pelaje: {
    key: "pelaje", label: "Pelaje", type: "parte-criatura", unit: "kg",
    durability: q => 6*q, potency: q => 4*q,
    costPerUnit: (q, qty=1) => 10*q*qty
  },
  escamas: {
    key: "escamas", label: "Escamas", type: "parte-criatura", unit: "kg",
    durability: q => 8*q, potency: q => 5*q,
    costPerUnit: (q, qty=1) => 20*q*qty
  },
  caparazon: {
    key: "caparazon", label: "Caparazón", type: "parte-criatura", unit: "kg",
    durability: q => 10*q, potency: q => 6*q,
    costPerUnit: (q, qty=1) => 30*q*qty
  },
  plumaje: {
    key: "plumaje", label: "Plumaje", type: "parte-criatura", unit: "kg",
    durability: q => 4*q, potency: q => 3*q,
    costPerUnit: (q, qty=1) => 10*q*qty
  },
  huesos: {
    key: "huesos", label: "Huesos", type: "parte-criatura", unit: "kg",
    durability: q => 3*q, potency: q => 5*q,
    costPerUnit: (q, qty=1) => 16*q*qty
  },
  cuernos: {
    key: "cuernos", label: "Cuernos", type: "parte-criatura", unit: "kg",
    durability: q => 4*q, potency: q => 6*q,
    costPerUnit: (q, qty=1) => 16*q*qty
  },
  garras: {
    key: "garras", label: "Garras", type: "parte-criatura", unit: "kg",
    durability: q => 4*q, potency: q => 6*q,
    costPerUnit: (q, qty=1) => 16*q*qty
  },
  colmillos: {
    key: "colmillos", label: "Colmillos", type: "parte-criatura", unit: "kg",
    durability: q => 5*q, potency: q => 7*q,
    costPerUnit: (q, qty=1) => 16*q*qty
  },
  glandulas: {
    key: "glandulas", label: "Glándulas", type: "parte-criatura", unit: "unidad",
    durability: 0, potency: 0,
    costPerUnit: (q, qty=1) => 30*q*qty
  },
  organos: {
    key: "organos", label: "Órganos", type: "parte-criatura", unit: "unidad",
    durability: 0, potency: 0,
    costPerUnit: (q, qty=1) => 40*q*qty
  },
  fluidos: {
    key: "fluidos", label: "Fluidos", type: "parte-criatura", unit: "litro",
    durability: 0, potency: 0,
    costPerUnit: (q, qty=1) => 20*q*qty
  },
  sistema_nervioso: {
    key: "sistema_nervioso", label: "Sistema Nervioso", type: "parte-criatura", unit: "unidad",
    durability: 0, potency: 0,
    costPerUnit: (q, qty=1) => 150*q*qty
  },

  // -------------------------
  // MINERALES / METALES / ROCAS / PIEDRAS PRECIOSAS / MADERAS / FIBRAS
  // (Aquí los que traen valores fijos, no dependientes de quality)
  // -------------------------
  bronce: {
    key: "bronce", label: "Bronce", type: "metal", unit: "kg",
    durability: 12, potency: 22,
    costPerUnit: (q, qty=1) => 15*q*qty
  },
  hierro: {
    key: "hierro", label: "Hierro", type: "metal", unit: "kg",
    durability: 15, potency: 25,
    costPerUnit: (q, qty=1) => 10*q*qty
  },
  acero: {
    key: "acero", label: "Acero", type: "metal", unit: "kg",
    durability: 18, potency: 30,
    costPerUnit: (q, qty=1) => 30*q*qty
  },
  jade: {
    key: "jade", label: "Jade", type: "piedra-preciosa", unit: "kg",
    durability: 10, potency: 15,
    costPerUnit: (q, qty=1) => 50*q*qty
  },
  carbon: {
    key: "carbon", label: "Carbón", type: "roca", unit: "kg",
    durability: 5, potency: 10,
    costPerUnit: (q, qty=1) => 5*q*qty
  },
  lapislazuli: {
    key: "lapislazuli", label: "Lapislázuli", type: "piedra-preciosa", unit: "kg",
    durability: 8, potency: 14,
    costPerUnit: (q, qty=1) => 30*q*qty
  },
  vidrio: {
    key: "vidrio", label: "Vidrio", type: "roca", unit: "kg",
    durability: 3, potency: 6,
    costPerUnit: (q, qty=1) => 15*q*qty
  },
  peltre: {
    key: "peltre", label: "Peltre", type: "metal", unit: "kg",
    durability: 8, potency: 15,
    costPerUnit: (q, qty=1) => 18*q*qty
  },
  oro: {
    key: "oro", label: "Oro", type: "metal", unit: "kg",
    durability: 10, potency: 20,
    costPerUnit: (q, qty=1) => 100*q*qty
  },
  estano: {
    key: "estano", label: "Estaño", type: "metal", unit: "kg",
    durability: 9, potency: 18,
    costPerUnit: (q, qty=1) => 20*q*qty
  },
  cobre: {
    key: "cobre", label: "Cobre", type: "metal", unit: "kg",
    durability: 10, potency: 20,
    costPerUnit: (q, qty=1) => 10*q*qty
  },
  cristales: {
    key: "cristales", label: "Cristales", type: "piedra-preciosa", unit: "kg",
    durability: 7, potency: 12,
    costPerUnit: (q, qty=1) => 30*q*qty
  },
  piedra: {
    key: "piedra", label: "Piedra", type: "roca", unit: "kg",
    durability: 8, potency: 16,
    costPerUnit: (q, qty=1) => 5*q*qty
  },
  roca: {
    key: "roca", label: "Roca", type: "roca", unit: "kg",
    durability: 9, potency: 18,
    costPerUnit: (q, qty=1) => 5*q*qty
  },
  obsidiana: {
    key: "obsidiana", label: "Obsidiana", type: "roca", unit: "kg",
    durability: 12, potency: 12,
    costPerUnit: (q, qty=1) => 30*q*qty
  },
  mithril: {
    key: "mithril", label: "Mithril", type: "metal", unit: "kg",
    durability: 28, potency: 45,
    costPerUnit: (q, qty=1) => 500*q*qty
  },
  adamantium: {
    key: "adamantium", label: "Adamantium", type: "metal", unit: "kg",
    durability: 30, potency: 50,
    costPerUnit: (q, qty=1) => 1000*q*qty
  },
  titanio: {
    key: "titanio", label: "Titanio", type: "metal", unit: "kg",
    durability: 22, potency: 35,
    costPerUnit: (q, qty=1) => 80*q*qty
  },
  plata: {
    key: "plata", label: "Plata", type: "metal", unit: "kg",
    durability: 16, potency: 28,
    costPerUnit: (q, qty=1) => 40*q*qty
  },
  platino: {
    key: "platino", label: "Platino", type: "metal", unit: "kg",
    durability: 17, potency: 29,
    costPerUnit: (q, qty=1) => 50*q*qty
  },
  cuarzo: {
    key: "cuarzo", label: "Cuarzo", type: "piedra-preciosa", unit: "kg",
    durability: 6, potency: 11,
    costPerUnit: (q, qty=1) => 20*q*qty
  },
  ambar: {
    key: "ambar", label: "Ámbar", type: "roca", unit: "kg",
    durability: 4, potency: 8,
    costPerUnit: (q, qty=1) => 20*q*qty
  },
  marfil: {
    key: "marfil", label: "Marfil", type: "piedra-preciosa", unit: "kg",
    durability: 7, potency: 13,
    costPerUnit: (q, qty=1) => 40*q*qty
  },
  coral: {
    key: "coral", label: "Coral", type: "roca", unit: "kg",
    durability: 6, potency: 10,
    costPerUnit: (q, qty=1) => 20*q*qty
  },
  ebano: {
    key: "ebano", label: "Ébano", type: "madera", unit: "kg",
    durability: 25, potency: 11,
    costPerUnit: (q, qty=1) => 20*q*qty
  },
  roble: {
    key: "roble", label: "Roble", type: "madera", unit: "kg",
    durability: 20, potency: 10,
    costPerUnit: (q, qty=1) => 10*q*qty
  },
  caoba: {
    key: "caoba", label: "Caoba", type: "madera", unit: "kg",
    durability: 22, potency: 12,
    costPerUnit: (q, qty=1) => 15*q*qty
  },
  pino: {
    key: "pino", label: "Pino", type: "madera", unit: "kg",
    durability: 15, potency: 7,
    costPerUnit: (q, qty=1) => 5*q*qty
  },
  arce: {
    key: "arce", label: "Arce", type: "madera", unit: "kg",
    durability: 18, potency: 8,
    costPerUnit: (q, qty=1) => 12*q*qty
  },
  secoya: {
    key: "secoya", label: "Secoya", type: "madera", unit: "kg",
    durability: 30, potency: 15,
    costPerUnit: (q, qty=1) => 25*q*qty
  },

  // Piedras preciosas extra (con valores fijos)
  rubi: {
    key: "rubi", label: "Rubí", type: "piedra-preciosa", unit: "kg",
    durability: 16, potency: 9,
    costPerUnit: (q, qty=1) => 120*q*qty
  },
  esmeralda: {
    key: "esmeralda", label: "Esmeralda", type: "piedra-preciosa", unit: "kg",
    durability: 15, potency: 9,
    costPerUnit: (q, qty=1) => 140*q*qty
  },
  zafiro: {
    key: "zafiro", label: "Zafiro", type: "piedra-preciosa", unit: "kg",
    durability: 16, potency: 9,
    costPerUnit: (q, qty=1) => 110*q*qty
  },
  diamante: {
    key: "diamante", label: "Diamante", type: "piedra-preciosa", unit: "kg",
    durability: 18, potency: 10,
    costPerUnit: (q, qty=1) => 200*q*qty
  },
  topacio: {
    key: "topacio", label: "Topacio", type: "piedra-preciosa", unit: "kg",
    durability: 14, potency: 8,
    costPerUnit: (q, qty=1) => 90*q*qty
  },

  // Metales especiales
  cromo: {
    key: "cromo", label: "Cromo", type: "metal", unit: "kg",
    durability: 20, potency: 27,
    costPerUnit: (q, qty=1) => 60*q*qty
  },
  plomo: {
    key: "plomo", label: "Plomo", type: "metal", unit: "kg",
    durability: 12, potency: 18,
    costPerUnit: (q, qty=1) => 15*q*qty
  },
  oricalco: {
    key: "oricalco", label: "Oricalco", type: "metal", unit: "kg",
    durability: 25, potency: 40,
    costPerUnit: (q, qty=1) => 800*q*qty
  },

  // Fibras
  seda_arakhel: {
    key: "seda_arakhel", label: "Seda de Arakhel", type: "fibra", unit: "kg",
    durability: 18, potency: 18,
    costPerUnit: (q, qty=1) => 50*q*qty
  },
  lana: {
    key: "lana", label: "Lana", type: "fibra", unit: "kg",
    durability: q => 2*q, potency: q => 3*q,
    costPerUnit: (q, qty=1) => 12*q*qty
  },
  algodon: {
    key: "algodon", label: "Algodón", type: "fibra", unit: "kg",
    durability: q => 1*q, potency: q => 2*q,
    costPerUnit: (q, qty=1) => 8*q*qty
  },
  seda: {
    key: "seda", label: "Seda", type: "fibra", unit: "kg",
    durability: q => 3*q, potency: q => 4*q,
    costPerUnit: (q, qty=1) => 20*q*qty
  },
  lino: {
    key: "lino", label: "Lino", type: "fibra", unit: "kg",
    durability: q => 2*q, potency: q => 3*q,
    costPerUnit: (q, qty=1) => 10*q*qty
  },
  yute: {
    key: "yute", label: "Yute", type: "fibra", unit: "kg",
    durability: q => 2*q, potency: q => 4*q,
    costPerUnit: (q, qty=1) => 6*q*qty
  },
  nailon: {
    key: "nailon", label: "Nailon", type: "fibra", unit: "kg",
    durability: q => 3*q, potency: q => 5*q,
    costPerUnit: (q, qty=1) => 14*q*qty
  },
  poliester: {
    key: "poliester", label: "Poliéster", type: "fibra", unit: "kg",
    durability: q => 2*q, potency: q => 3*q,
    costPerUnit: (q, qty=1) => 9*q*qty
  },

  // Cuero y Pieles procesadas
  cuero: {
    key: "cuero", label: "Cuero", type: "cuero", unit: "kg",
    durability: q => 5*q, potency: q => 6*q,
    costPerUnit: (q, qty=1) => 18*q*qty
  },
  escamado: {
    key: "escamado", label: "Cuero Escamado", type: "cuero", unit: "kg",
    durability: q => 7*q, potency: q => 8*q,
    costPerUnit: (q, qty=1) => 25*q*qty
  },
  acorazado: {
    key: "acorazado", label: "Cuero Acorazado", type: "cuero", unit: "kg",
    durability: q => 9*q, potency: q => 10*q,
    costPerUnit: (q, qty=1) => 35*q*qty
  },
  tela: {
    key: "tela", label: "Tela", type: "fibra", unit: "kg",
    durability: q => 1*q, potency: q => 2*q,
    costPerUnit: (q, qty=1) => 5*q*qty
  }
};

for (const [key, description] of Object.entries(MATERIAL_DESCRIPTIONS)) {
  if (MATERIALS[key]) {
    MATERIALS[key].description = description;
  }
}

// -------------------------
// Helpers de acceso
// -------------------------
export function getMaterial(key) {
  return MATERIALS[String(key||"").toLowerCase()] ?? null;
}

export function getMaterialSummary(materialKey, grade = 1) {
  const material = getMaterial(materialKey);
  if (!material) return null;

  const normalizedGrade = normalizeMaterialQuality(grade);
  const resolveValue = (value) =>
    typeof value === "function" ? Number(value(normalizedGrade) || 0) : Number(value || 0);

  const durability = resolveValue(material.durability);
  const potency = resolveValue(material.potency);
  const unit = material.unit || "kg";
  const cost = typeof material.costPerUnit === "function"
    ? Number(material.costPerUnit(normalizedGrade, 1) || 0)
    : resolveValue(material.costPerUnit);

  const accessibility = getMaterialAccessibility(material.key ?? materialKey);
  const qualityInfo = getMaterialQualityInfo(normalizedGrade);

  return {
    key: material.key ?? materialKey,
    label: material.label ?? materialKey,
    type: material.type ?? "material",
    typeLabel: getMaterialTypeLabel(material.type ?? "material"),
    unit,
    description: material.description ?? MATERIAL_DESCRIPTIONS[material.key ?? materialKey] ?? "",
    grade: normalizedGrade,
    quality: qualityInfo,
    durability,
    potency,
    cost,
    accessibility
  };
}

export function listMaterialsByType(type) {
  const t = String(type||"").toLowerCase();
  return Object.values(MATERIALS).filter(m => m.type === t);
}

/** Devuelve {durability, potency} a partir del material y quality */
export function getMaterialStats(key, quality=1) {
  const m = getMaterial(key);
  if (!m) return { durability: 0, potency: 0, unit: "kg" };
  const durability = numOrFn(m.durability, quality);
  const potency    = numOrFn(m.potency, quality);
  return { durability, potency, unit: m.unit || "kg" };
}

/** Durabilidad “cruda” del material dado un quality (atajo) */
export function materialDurability(key, quality=1) {
  return getMaterialStats(key, quality).durability;
}

/** Potencia “cruda” del material (atajo) */
export function materialPotency(key, quality=1) {
  return getMaterialStats(key, quality).potency;
}

/** Costo total (Shekels) para una cantidad (qty) en su unidad nativa */
export function materialCost(key, quality=1, qty=1) {
  const m = getMaterial(key);
  if (!m) return 0;
  return Number(m.costPerUnit(Number(quality||1), Number(qty||1)) || 0);
}

/**
 * Obtiene información completa del material incluyendo debilidades y accesibilidad
 * @param {string} key - clave del material
 * @param {number} quality - grado de calidad (1-3)
 * @returns {object} - información completa del material
 */
export function getMaterialFullInfo(key, quality=1) {
  const material = getMaterial(key);
  if (!material) return null;

  const stats = getMaterialStats(key, quality);
  const weakness = getMaterialWeakness(key);
  const accessibility = getMaterialAccessibility(key);

  return {
    ...material,
    quality,
    qualityLabel: quality === 1 ? "Común" : quality === 2 ? "Raro" : "Excepcional",
    durability: stats.durability,
    potency: stats.potency,
    weakness: weakness,
    accessibility: accessibility,
    laborCostPerKg: accessibility.laborCostPerKg(quality),
    fabricationTime: accessibility.fabricationTime
  };
}

/**
 * Calcula el costo total de fabricación (material + mano de obra)
 * @param {string} key - clave del material
 * @param {number} quality - grado de calidad
 * @param {number} kgs - kilogramos necesarios
 * @returns {object} - {materialCost, laborCost, totalCost}
 */
export function calculateTotalFabricationCost(key, quality=1, kgs=1) {
  const matCost = materialCost(key, quality, kgs);
  const laborCost = calculateLaborCost(key, quality, kgs);

  return {
    materialCost: matCost,
    laborCost: laborCost,
    totalCost: matCost + laborCost,
    kgs,
    quality,
    qualityLabel: quality === 1 ? "Común" : quality === 2 ? "Raro" : "Excepcional"
  };
}
