// modules/rolls/formulas.js
// Helpers para construir fórmulas a partir del actor + su progreso

import { levelToRank } from "../progression.js";
import { getWeaponDef } from "../features/weapons/index.js";

/** lectura segura */
function gp(obj, path, d=0) {
  return Number(foundry.utils.getProperty(obj, path) ?? d);
}

/** Devuelve nivel y rango de un track genérico (weapons/maneuvers/defense/armor/resistances/skills) */
export function getTrack(actor, pathBase) {
  const level = gp(actor, `${pathBase}.level`, 0);
  const rank  = gp(actor, `${pathBase}.rank`, levelToRank(level));
  const progress = gp(actor, `${pathBase}.progress`, 0);
  return { level, rank, progress };
}

/** Ataque con armas o maniobras (misma tirada de ataque) */
export function buildAttackFormula(actor, { isManeuver=false, key, attrKey, bonus=0, penalty=0 }) {
  // nivel de competencia con el arma o maniobra
  const trackBase = isManeuver ? `system.progression.maneuvers.${key}` : `system.progression.weapons.${key}`;
  const { level } = getTrack(actor, trackBase);

  // atributo del arma/maniobra
  const A = Number(actor.system?.attributes?.[attrKey] ?? 0);

  // 1d10 + nivel competencia + atributo + bono - penal
  const parts = [`1d10`, `${level}`, `${A}`, `${Number(bonus||0)}`];
  if (penalty) parts.push(`-${Number(penalty)}`);
  const formula = parts.join(" + ").replace("+ -", "- ");
  return { formula, level, attr: A };
}

/**
 * Impacto cuerpo a cuerpo
 * (rango de competencia con el arma x dado del arma) + (atributo * grado del arma + bonificador)
 * p.ej. rango=2; arma d6 grado 2; agilidad 3 => 2d6 + (3*2) + bonus = 2d6 + 6 + bonus
 */
export async function buildImpactFormula(actor, { key, die=null, grade=null, attrKey=null, bonus=0 } = {}) {
  // 1) Definición de arma desde catálogo (clave en minúsculas)
  let def = key ? getWeaponDef(String(key).toLowerCase()) : null;
  // Si no es arma conocida, intenta “katana” equipada cuando te llegue en el future
  if (!def) {
    try {
      const { getEquippedWeaponKey } = await import("../features/inventory/index.js");
      const ek = getEquippedWeaponKey(actor, "main");
      def = ek ? getWeaponDef(String(ek).toLowerCase()) : null;
    } catch(_) {}
  }

  // 2) Atributo a usar: parámetro → arma.attackAttr → "agility"
  const usedAttrKey = String(attrKey || def?.attackAttr || "agility");
  const A = Number(actor.system?.attributes?.[usedAttrKey] ?? 0);

  // 3) Dado base y grado: parámetro → arma → fallback sensato
  const usedDie   = String(die   || def?.damageDie || "d6");
  const usedGrade = Math.max(1, Number(grade ?? def?.grade ?? 1));

  // 4) # de dados = RANGO de competencia con el arma (mínimo 1)
  const { rank } = getTrack(actor, `system.progression.weapons.${key}`);
  const diceCount = Math.max(1, Number(rank || 1));

  // 5) Plano = (Atributo * Grado) + bonus
  const flat = (A * usedGrade) + Number(bonus || 0);

  // 6) Fórmula final
  const formula = `${diceCount}${usedDie} + ${flat}`;
  return { formula, die: usedDie, grade: usedGrade, attrKey: usedAttrKey, rank: diceCount, flat };
}

/** Defensa (evasión): 1d10 + nivel de competencia evasiva + agilidad + armadura + bonificador */
export function buildDefenseFormula(actor, { armorBonus=0, bonus=0, penalty=0 }) {
  const { level } = getTrack(actor, `system.progression.defense.evasion`);
  const AGI = Number(actor.system?.attributes?.agility ?? 0);
  const parts = [`1d10`, `${level}`, `${AGI}`, `${Number(armorBonus||0)}`, `${Number(bonus||0)}`];
  if (penalty) parts.push(`-${Number(penalty)}`);
  const formula = parts.join(" + ").replace("+ -", "- ");
  return { formula, level, agi: AGI };
}

/** Resistencias — selecciona qué atributo usar según el tipo */
function attrForResistance(actor, type) {
  const sys = actor.system ?? {};
  const ten = Number(sys.attributes?.tenacity ?? 0);
  const com = Number(sys.attributes?.composure ?? 0);
  const res = Number(sys.derived?.resilience ?? 0);

  // veneno/infección → Tenacidad
  if (["poison","infection"].includes(type)) return ten;
  // aflicción/maldición → Compostura
  if (["affliction","curse"].includes(type)) return com;
  // alteración/elementos → Resiliencia (derivado)
  if (["alteration","water","fire","earth","air","light","dark"].includes(type)) return res;

  // fallback (tenacidad)
  return ten;
}

/** Tirada de resistencia: 1d10 + atributo segun tipo + nivel de competencia en ese tipo + bonificador */
export function buildResistanceFormula(actor, { type, bonus=0, penalty=0 }) {
  const { level } = getTrack(actor, `system.progression.resistances.${type}`);
  const A = attrForResistance(actor, type);
  const parts = [`1d10`, `${A}`, `${level}`, `${Number(bonus||0)}`];
  if (penalty) parts.push(`-${Number(penalty)}`);
  const formula = parts.join(" + ").replace("+ -", "- ");
  return { formula, level, attr: A };
}
