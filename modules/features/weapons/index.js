// modules/features/weapons/index.js
import { materialPotency } from "../materials/index.js";
import { WEAPONS } from "./data.js";

export const POWER_MULTIPLIERS = {
  spear: 0.80, axe: 1.20, mace: 1.50, longblade: 1.00,
  dagger: 0.50, shortblade: 0.75, thrown: 0.40, ranged: 0.60, flexible: 0.30
};

export function getWeaponDef(key) {
  return WEAPONS[String(key || "").toLowerCase()] ?? null;
}

// Alias para compatibilidad con inventory/hoja:
export const getWeapon = getWeaponDef;

export function getFamilyPowerMultiplier(family) {
  const f = String(family || "").toLowerCase();
  return Number(POWER_MULTIPLIERS[f] ?? 1.0);
}

export function getPowerMultiplierByWeaponKey(weaponKey) {
  const def = getWeaponDef(weaponKey);
  return def ? getFamilyPowerMultiplier(def.family) : 1.0;
}

export function computeCritPowerFromItem(weaponItem) {
  if (!weaponItem) return 0;
  const catDef = weaponItem.key ? getWeaponDef(weaponItem.key) : null;
  const family = (weaponItem.family ?? catDef?.family) || "longblade";
  const pot = materialPotency(String(weaponItem.material || ""), Number(weaponItem.quality || 1));
  const mult = getFamilyPowerMultiplier(family);
  const grade = Math.max(1, Number(weaponItem.grade || 1));
  const critPower = Math.floor(pot * mult * grade);
  return Number.isFinite(critPower) ? critPower : 0;
}

export function computeCritPower({ weaponKey, material, quality = 1, grade = 1 } = {}) {
  const mult = getPowerMultiplierByWeaponKey(weaponKey);
  const pot  = materialPotency(String(material || ""), Number(quality || 1));
  return Math.floor(pot * mult * Math.max(1, Number(grade || 1)));
}

export function describeCritPower(itemOrParams) {
  let family, mult, pot, grade, material, quality;

  if (itemOrParams && itemOrParams.material === undefined && itemOrParams.family === undefined) {
    const catDef = itemOrParams.key ? getWeaponDef(itemOrParams.key) : null;
    family   = (itemOrParams.family ?? catDef?.family) || "longblade";
    mult     = getFamilyPowerMultiplier(family);
    material = String(itemOrParams.material || "");
    quality  = Number(itemOrParams.quality || 1);
    pot      = materialPotency(material, quality);
    grade    = Math.max(1, Number(itemOrParams.grade || 1));
  } else {
    const def = itemOrParams.weaponKey ? getWeaponDef(itemOrParams.weaponKey) : null;
    family   = (itemOrParams.family ?? def?.family) || "longblade";
    mult     = getFamilyPowerMultiplier(family);
    material = String(itemOrParams.material || "");
    quality  = Number(itemOrParams.quality || 1);
    pot      = materialPotency(material, quality);
    grade    = Math.max(1, Number(itemOrParams.grade || 1));
  }

  const bonus = Math.floor(pot * mult * grade);
  const pct   = Math.round(mult * 100);
  return `Potencia(${material}, q=${quality})=${pot} × Mult(${family})=${pct}% × Grado=${grade} → +${bonus} en crítico`;
}
