import { resolveEvolution } from "../features/advantage/index.js";
import { addProgress } from "../progression.js";

/**
 * Decide política y a qué “track” se aplica el progreso según el tipo de tirada.
 * @param {Actor} actor
 * @param {object} p  { type, key, mode?, formula, rank, target, flavor?, armorType? }
 */
export async function rollWithProgress(actor, p) {
  const type = (p.type||"").toLowerCase();

  // 1) Forzar política según reglas
  // - specialization / attack / defense: requieren "execution" o "learning" (o "ask" → UI)
  // - resistance: NO requiere decisión (un dado, "none")
  // - attribute / impact / personality: nunca progreso (podemos dejar "none")
  let mode = p.mode;
  if (["resistance","attribute","impact","personality"].includes(type)) mode = "none";
  if (!mode && ["attack","defense","specialization"].includes(type)) mode = "ask";

  // 2) Resolver tirada (devuelve success & learned si aplica)
  const { resultRoll, success, learned, usedPolicy } = await resolveEvolution({
    ...p,
    mode
  });

  // 3) Aplicar progreso según resultado y tipo
  let progressInfo = null;

  if (type === "attack") {
    // éxito → progreso en weapon o maneuver según key
    // *Regla*: “ataque con arma” → track weapons[key]; “maniobra” → track maneuvers[key]
    if (success === true && learned === true) {
      const trackType = p.isManeuver ? "maneuvers" : "weapons";
      progressInfo = await addProgress(actor, trackType, p.key, 1);
    }
  }

  else if (type === "defense") {
    // éxito → evasion; fallo → armor[type]
    if (success === true && learned === true) {
      progressInfo = await addProgress(actor, "defense", "evasion", 1);
    } else if (success === false && learned === true && p.armorType) {
      progressInfo = await addProgress(actor, "armor", p.armorType, 1); // "light"|"medium"|"heavy"
    }
  }

  else if (type === "specialization") {
    // éxito → skill[key]
    if (success === true && learned === true) {
      progressInfo = await addProgress(actor, "skills", p.key, 1);
    }
  }

  else if (type === "resistance") {
    // un dado; fallo → resistance[key]
    if (success === false) {
      progressInfo = await addProgress(actor, "resistances", p.key, 1);
    }
  }

  // attribute / impact / personality → nunca progreso

  return { resultRoll, success, learned, usedPolicy, progressInfo };
}
