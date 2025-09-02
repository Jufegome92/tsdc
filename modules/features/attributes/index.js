// module/features/attributes/index.js
import { applyRounding } from "../../utils/math.js";

/** Claves canónicas (en inglés para evitar acentos en código) */
export const ATTRS = [
  "strength",   // Fuerza
  "agility",    // Agilidad
  "tenacity",   // Tenacidad
  "cunning",    // Astucia
  "wisdom",     // Sabiduría
  "intellect",  // Intelecto
  "aura",       // Aura
  "composure",  // Compostura
  "presence"    // Presencia
];

/** Mapeo de sinónimos ES → clave canónica */
const ES_TO_CANON = {
  fuerza: "strength",
  agilidad: "agility",
  tenacidad: "tenacity",
  astucia: "cunning",
  sabiduria: "wisdom",
  sabiduría: "wisdom",
  intelecto: "intellect",
  aura: "aura",
  compostura: "composure",
  presencia: "presence"
};

/** Normaliza un nombre de característica (ES/EN → clave canónica) */
export function toCanonAttr(key) {
  if (!key) return null;
  const k = String(key).toLowerCase().trim();
  if (ATTRS.includes(k)) return k;
  return ES_TO_CANON[k] ?? null;
}

/** Valida y normaliza un diccionario de características */
export function normalizeAttributes(raw = {}) {
  const out = Object.fromEntries(ATTRS.map(k => [k, 0]));
  for (const [k, v] of Object.entries(raw || {})) {
    const canon = toCanonAttr(k);
    if (!canon) continue;
    out[canon] = Number.isFinite(v) ? Number(v) : 0;
  }
  return out;
}

/**
 * Config de derivados (editable más adelante sin tocar el motor).
 * weights: ponderadores por atributo
 * divisor: para promediar o escalar
 * rounding: "up" (regla general) o "down" para casos especiales
 */
export const DERIVED_CONFIG = {
  preparation: {
    weights: {
      agility: 1, cunning: 1, composure: 1
    },
    divisor: 3,
    rounding: "up"
  },
  resilience: {
    weights: {
      tenacity: 1, composure: 1, wisdom: 1
    },
    divisor: 3,
    rounding: "up"
  }
};

/** Calcula un derivado a partir de una config de pesos */
export function computeDerived(attrsRaw, cfg = DERIVED_CONFIG) {
  const attrs = normalizeAttributes(attrsRaw);
  const result = {};
  for (const [name, def] of Object.entries(cfg)) {
    let sum = 0;
    for (const [attr, w] of Object.entries(def.weights || {})) {
      const k = toCanonAttr(attr);
      if (!k) continue;
      sum += (attrs[k] ?? 0) * (Number(w) || 0);
    }
    const divisor = Math.max(1, Number(def.divisor) || 1);
    const value = sum / divisor;
    result[name] = applyRounding(value, def.rounding || "up");
  }
  return result;
}

/**
 * Helper: obtiene un “base” para tirada según la característica que elijas.
 * Útil para el módulo de tiradas actorless.
 */
export function baseFrom(attrsRaw, attrKey) {
  const attrs = normalizeAttributes(attrsRaw);
  const k = toCanonAttr(attrKey);
  return k ? (attrs[k] ?? 0) : 0;
}
