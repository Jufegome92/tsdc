// modules/rolls/dispatcher.js
import { resolveEvolution } from "../features/advantage/index.js";
import { buildAttackFormula, buildImpactFormula, buildDefenseFormula, buildResistanceFormula } from "./formulas.js";

/** TIRADA: ataque con armas o maniobra */
export async function rollAttack(actor, { key, isManeuver=false, attrKey, bonus=0, penalty=0, mode="ask", flavor } = {}) {
  const { formula } = buildAttackFormula(actor, { isManeuver, key, attrKey, bonus, penalty });
  const rank = Number(foundry.utils.getProperty(actor, isManeuver ? `system.progression.maneuvers.${key}.rank` : `system.progression.weapons.${key}.rank`) || 0);

  await resolveEvolution({
    type: "attack",
    mode, formula, rank,
    flavor: flavor ?? (isManeuver ? `Maniobra • ${key}` : `Ataque • ${key}`),
    actor,
    meta: { key, isManeuver }
  });
}

/** TIRADA: impacto cuerpo a cuerpo — sin progreso */
export async function rollImpact(actor, { key, die="d6", grade=1, attrKey, bonus=0, flavor } = {}) {
  const { formula } = buildImpactFormula(actor, { key, die, grade, attrKey, bonus });
  const r = await (new Roll(formula)).roll({ async: true });
  await r.toMessage({ flavor: flavor ?? `Impacto • ${key}` });
}

/** TIRADA: defensa (evasión / armadura) */
export async function rollDefense(actor, { armorType, armorBonus=0, bonus=0, penalty=0, mode="ask", flavor } = {}) {
  const { formula } = buildDefenseFormula(actor, { armorBonus, bonus, penalty });
  const rank = Number(foundry.utils.getProperty(actor, `system.progression.defense.evasion.rank`) || 0);

  await resolveEvolution({
    type: "defense",
    mode, formula, rank,
    flavor: flavor ?? `Defensa`,
    actor,
    meta: { armorType }
  });
}

/** TIRADA: resistencia (un solo dado, sin política) */
export async function rollResistance(actor, { type, bonus=0, penalty=0, flavor } = {}) {
  const { formula } = buildResistanceFormula(actor, { type, bonus, penalty });
  await resolveEvolution({
    type: "resistance",
    mode: "none",
    formula,
    rank: 0,
    flavor: flavor ?? `Resistencia • ${type}`,
    actor,
    meta: { key: type }
  });
}
