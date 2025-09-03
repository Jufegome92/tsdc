// modules/rolls/dispatcher.js
import { resolveEvolution } from "../features/advantage/index.js";
import { addProgress } from "../progression.js";
import { buildAttackFormula, buildImpactFormula, buildDefenseFormula, buildResistanceFormula } from "./formulas.js";

/** TIRADA: ataque con armas o maniobra */
export async function rollAttack(actor, { key, isManeuver=false, attrKey, dc=10, bonus=0, penalty=0, mode="ask", flavor } = {}) {
  const { formula } = buildAttackFormula(actor, { isManeuver, key, attrKey, bonus, penalty });
  const rank =  Number(foundry.utils.getProperty(actor, isManeuver ? `system.progression.maneuvers.${key}.rank` : `system.progression.weapons.${key}.rank`) || 0);

  const { success, learned, usedPolicy, resultRoll } = await resolveEvolution({
    type: "attack",
    mode, formula, rank, target: dc,
    flavor: flavor ?? (isManeuver ? `Maniobra • ${key}` : `Ataque • ${key}`)
  });

  if (success === true && learned === true) {
    const trackType = isManeuver ? "maneuvers" : "weapons";
    await addProgress(actor, trackType, key, 1);
  }
  return { success, learned, usedPolicy, resultRoll };
}

/** TIRADA: impacto cuerpo a cuerpo */
export async function rollImpact(actor, { key, die="d6", grade=1, attrKey, bonus=0, flavor } = {}) {
  const { formula } = buildImpactFormula(actor, { key, die, grade, attrKey, bonus });
  // No hay progreso por impacto
  const r = await (new Roll(formula)).roll({ async: true });
  await r.toMessage({ flavor: flavor ?? `Impacto • ${key}` });
  return { resultRoll: r };
}

/** TIRADA: defensa (evasión / armadura) */
export async function rollDefense(actor, { armorType, armorBonus=0, dc=10, bonus=0, penalty=0, mode="ask", flavor } = {}) {
  const { formula } = buildDefenseFormula(actor, { armorBonus, bonus, penalty });
  const rank = Number(foundry.utils.getProperty(actor, `system.progression.defense.evasion.rank`) || 0);

  const { success, learned, usedPolicy, resultRoll } = await resolveEvolution({
    type: "defense",
    mode, formula, rank, target: dc,
    flavor: flavor ?? `Defensa`
  });

  // éxito → evasion; fallo → armor[type]
  if (learned === true) {
    if (success === true) {
      await addProgress(actor, "defense", "evasion", 1);
    } else if (success === false && armorType) {
      await addProgress(actor, "armor", armorType, 1);
    }
  }
  return { success, learned, usedPolicy, resultRoll };
}

/** TIRADA: resistencia (un solo dado, no elige política) */
export async function rollResistance(actor, { type, dc=10, bonus=0, penalty=0, flavor } = {}) {
  const { formula } = buildResistanceFormula(actor, { type, bonus, penalty });
  const r = await (new Roll(formula)).roll({ async: true });
  const success = (r.total >= Number(dc||10));
  await r.toMessage({ flavor: flavor ?? `Resistencia • ${type}` });

  // fallo → progresa la resistencia específica
  if (success === false) {
    await addProgress(actor, "resistances", type, 1);
  }
  return { resultRoll: r, success };
}
