// modules/features/materials/index.js
// Catálogo unificado de materiales y utilidades para calcular
// Durabilidad, Potencia y Costos en función del “Grado de calidad”.

/**
 * Convenciones:
 * - quality: “Grado de calidad” (entero >=1 normalmente).
 * - Para costos: por defecto “kg” (kilogramo). Algunos usan “unidad” o “litro”.
 * - durability / potency: pueden ser número fijo o función (q) => número.
 * - costPerUnit: función (q, qty=1) => número total (en Shekels).
 * - unit: "kg" | "unidad" | "litro"
 */

function numOrFn(v, q) { return (typeof v === "function") ? v(Number(q||1)) : Number(v||0); }

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
  hierro: {
    key: "hierro", label: "Hierro", type: "metal", unit: "kg",
    durability: 15, potency: 25,
    costPerUnit: (q, qty=1) => 10*q*qty
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
  }
};

// -------------------------
// Helpers de acceso
// -------------------------
export function getMaterial(key) {
  return MATERIALS[String(key||"").toLowerCase()] ?? null;
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
