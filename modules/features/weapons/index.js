// modules/features/weapons/index.js
import { WEAPONS } from "./data.js";

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
  for (const [k, def] of Object.entries(WEAPONS)) {
    m.set(norm(k), k);
    if (def?.label) m.set(norm(def.label), k);
  }
  return m;
})();

export function toCanonWeapon(key) {
  if (!key) return null;
  return _ALIAS.get(norm(key)) ?? null;
}
export function hasWeapon(key) { return !!toCanonWeapon(key); }
export function getWeapon(key) {
  const k = toCanonWeapon(key);
  return k ? WEAPONS[k] : null;
}
export function listWeapons() {
  return Object.entries(WEAPONS).map(([key, def]) => ({ key, ...def }));
}

export function getAttackAttrForWeapon(key) {
  return getWeapon(key)?.attackAttr ?? null;
}

export function getImpactParamsForWeapon(key) {
  const w = getWeapon(key);
  if (!w) return null;
  return {
    die: w.damageDie ?? "d6",
    grade: Number(w.grade ?? 1),
    attrKey: w.attackAttr ?? "strength"
  };
}
