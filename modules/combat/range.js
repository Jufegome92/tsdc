// modules/combat/range.js
import { getWeapon as getWeaponDef } from "../features/weapons/index.js";

export const CELL_M = 1;

// Mapa de bono de alcance por tamaño (en CASILLAS)
const SIZE_REACH_CELLS = {
  tiny: 0, diminuto: 0,
  small: 0, pequeño: 0,
  medium: 0, mediano: 0,
  large: 1, grande: 1,
  huge: 2, enorme: 2,
  gargantuan: 3, gigantesco: 3,
};

function sizeBonusCells(actor) {
  const sz = String(actor?.system?.species?.size ?? "medium").toLowerCase();
  return SIZE_REACH_CELLS[sz] ?? 0;
}

/** Alcance efectivo (en METROS) para un arma equipada (por clave) */
export function weaponRangeM(actor, weaponKey) {
  const def = weaponKey ? getWeaponDef(weaponKey) : null;
  const bonusCells = sizeBonusCells(actor);
  if (!def) return (1 + bonusCells) * CELL_M; // fallback melee

  const family = String(def.family || "");
  const baseReach = Number(def.reach ?? 1);

  // Para melee: reach en CASILLAS → sumar bonus por tamaño y pasar a metros
  if (family && !["thrown", "ranged"].includes(family)) {
    return (baseReach + bonusCells) * CELL_M;
  }
  // Para thrown/ranged: reach ya está en METROS → sumar el bonus en metros
  return baseReach + (bonusCells * CELL_M);
}

/** Alcance efectivo (en METROS) para una maniobra (range en CASILLAS) */
export function maneuverRangeM(actor, maneuver) {
  const cells = Number(maneuver?.range ?? 1);
  return (cells + sizeBonusCells(actor)) * CELL_M;
}


export function tokensInArea(centerToken, areaCells, { sideFilter=null } = {}) {
  if (!centerToken || areaCells <= 0) return [];
  const rM = areaCells * CELL_M;
  return canvas.tokens.placeables.filter(t => {
    if (t.id === centerToken.id) return false;
    if (sideFilter && !sideFilter(t)) return false;
    const dx = t.center.x - centerToken.center.x;
    const dy = t.center.y - centerToken.center.y;
    const dist = Math.hypot(dx, dy) / canvas.scene.grid.size * CELL_M;
    return dist <= rM;
  });
}