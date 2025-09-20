import { rollResistance } from "../rolls/dispatcher.js";
import * as Ail from "../ailments/index.js";

export async function applyManeuverEffects({ attacker, defender, maneuverDef, attackTotal, trigger="after_damage" }) {
  for (const fx of (maneuverDef.effects || [])) {
    if ((fx.trigger || "after_damage") !== trigger) continue;

    // 1) Tirada de Resistencia según grupo
    const res = await rollResistance(defender, {
      type: fx.save?.group || "alteration",
      bonus: Number(fx.save?.bonus || 0),
      flavor: `Resistencia contra efecto de ${maneuverDef.label}`,
      context: { phase: "save", tags: ["maneuver:effect"] }
    });

    const defTotal = Number(res?.total || 0);
    const dc = Math.max(10, Math.round(Number(attackTotal || 0))); // DC simple = total de ataque (ajústalo a tu gusto)

    const failed = defTotal < dc;

    // 2) Si falla, aplicar Ailment
    if (failed && fx.onFail?.ailmentId) {
      await Ail.addAilment(defender, fx.onFail.ailmentId, { source: maneuverDef.label });
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<b>${maneuverDef.label}</b>: ${defender.name} falla TR (${defTotal} < ${dc}) → sufre <b>${fx.onFail.ailmentId}</b>.`
      });
    } else {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor: attacker }),
        content: `<b>${maneuverDef.label}</b>: ${defender.name} ${failed ? "": "resiste"} (TR=${defTotal} vs DC=${dc}).`
      });
    }
  }
}
