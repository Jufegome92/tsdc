// modules/rolls/formulas.js
// Helpers para construir fórmulas a partir del actor + su progreso

import { levelToRank } from "../progression.js";

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
export function buildImpactFormula(actor, { key, die="d6", grade=1, attrKey, bonus=0 }) {
  const { rank } = getTrack(actor, `system.progression.weapons.${key}`);
  const A = Number(actor.system?.attributes?.[attrKey] ?? 0);
  const dieCount = Math.max(0, Number(rank||0));
  const dieTerm = dieCount > 0 ? `${dieCount}${die}` : "0";
  const flat = (A * Number(grade||1)) + Number(bonus||0);
  const formula = `${dieTerm} + ${flat}`;
  return { formula, rank, attr: A, flat };
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
