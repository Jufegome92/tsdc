// modules/features/specializations/index.js
// Utilidades para trabajar con el catálogo de especializaciones

import { SPECIALIZATIONS } from "./data.js";
import { baseFrom as baseFromAttr, toCanonAttr } from "../attributes/index.js";

/** Normaliza un string: minúsculas, sin acentos, sin espacios/guiones. */
function normalizeKey(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")   // quita acentos
    .replace(/[\s_.-]+/g, "")         // quita separadores comunes
    .trim();
}

/** Construye un índice de alias -> clave canónica (por key y por label). */
const _ALIAS = (() => {
  const map = new Map();
  for (const [key, def] of Object.entries(SPECIALIZATIONS)) {
    map.set(normalizeKey(key), key);
    if (def?.label) map.set(normalizeKey(def.label), key);
  }
  return map;
})();

/** Devuelve la clave canónica de una especialización o null si no existe. */
export function toCanonSpec(key) {
  if (!key) return null;
  const n = normalizeKey(key);
  return _ALIAS.get(n) ?? null;
}

/** true si existe la especialización (admite nombre con/ sin acentos). */
export function hasSpec(key) {
  return !!toCanonSpec(key);
}

/** Obtiene el objeto de datos de la especialización (o null). */
export function getSpec(key) {
  const k = toCanonSpec(key);
  return k ? SPECIALIZATIONS[k] : null;
}

/** Lista especializaciones; puedes filtrar por categoría. */
export function listSpecs(filter = {}) {
  const { category } = filter;
  const out = [];
  for (const [key, def] of Object.entries(SPECIALIZATIONS)) {
    if (category && def.category !== category) continue;
    out.push({ key, ...def });
  }
  return out;
}

/** Devuelve la categoría de la especialización (o null). */
export function getCategoryForSpec(key) {
  const spec = getSpec(key);
  return spec?.category ?? null;
}

/** Devuelve el atributo asociado a la especialización (clave canónica). */
export function getAttributeForSpec(key) {
  const spec = getSpec(key);
  const a = spec?.attribute ?? null;
  return toCanonAttr(a) ?? null;
}

/**
 * Calcula el “base” numérico para una tirada de especialización
 * usando los atributos del actor y el atributo asociado a la especialización.
 * @param {object} attrsRaw - diccionario { strength, agility, ... }
 * @param {string} specKey  - clave o nombre de la especialización
 * @returns {number} base
 */
export function baseFromSpec(attrsRaw, specKey) {
  const attrKey = getAttributeForSpec(specKey);
  if (!attrKey) return 0;
  return baseFromAttr(attrsRaw, attrKey);
}

/** Devuelve la familia de DC asociada (texto libre para UI/ayudas). */
export function getDcFamilyForSpec(key) {
  const spec = getSpec(key);
  return spec?.dcFamily ?? null;
}

/** ¿Esta especialización usa cálculos propios (para ayuda contextual)? */
export function usesCalc(key) {
  const spec = getSpec(key);
  return !!spec?.usesCalc;
}

/** ¿Esta especialización otorga bonus de aprendizaje por fallos repetidos? */
export function hasFailureLearnBonus(key) {
  const spec = getSpec(key);
  return !!spec?.failureLearnBonus;
}

/**
 * Pequeña utilidad para sugerir si la tirada debe ofrecer “Ejecución / Aprender”.
 * En tu diseño, las especializaciones SÍ requieren la decisión (siempre).
 */
export function requiresEvolutionChoice(key) {
  return hasSpec(key); // todas las especializaciones del catálogo requieren la elección
}

/** Acceso de solo lectura al catálogo (por si lo necesitas en UI). */
export function allSpecsMap() {
  return SPECIALIZATIONS;
}
