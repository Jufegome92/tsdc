// modules/features/maneuvers/index.js
import { MANEUVERS } from "./data.js";

/** normaliza claves: minúsculas, sin acentos, sin separadores */
function norm(s) {
  return String(s ?? "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[\s_.-]+/g, "")
    .trim();
}

const _ALIAS = (() => {
  const m = new Map();
  for (const [k, def] of Object.entries(MANEUVERS)) {
    m.set(norm(k), k);
    if (def?.label) m.set(norm(def.label), k);
  }
  return m;
})();

export function toCanonManeuver(key) {
  if (!key) return null;
  return _ALIAS.get(norm(key)) ?? null;
}

export function hasManeuver(key) {
  return !!toCanonManeuver(key);
}

export function getManeuver(key) {
  const k = toCanonManeuver(key);
  return k ? MANEUVERS[k] : null;
}

export function listManeuvers() {
  return Object.entries(MANEUVERS).map(([key, def]) => ({ key, ...def }));
}

/** atributos útiles para construir tiradas */
export function getAttackAttrForManeuver(key) {
  return getManeuver(key)?.attackAttr ?? null;
}
export function getImpactAttrForManeuver(key) {
  return getManeuver(key)?.impactAttr ?? null;
}
