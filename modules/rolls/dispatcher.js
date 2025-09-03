// modules/rolls/dispatcher.js
import { resolveEvolution } from "../features/advantage/index.js";
import { buildAttackFormula, buildImpactFormula, buildDefenseFormula, buildResistanceFormula } from "./formulas.js";
import { getEquippedWeaponKey } from "../features/inventory/index.js";
import { detectImpactCrit, computeBreakPower } from "../features/combat/critical.js";

/** TIRADA: ataque con armas o maniobra */
export async function rollAttack(actor, { key, isManeuver=false, attrKey, bonus=0, penalty=0, mode="ask", flavor } = {}) {
  // Si no se especifica clave de arma y NO es maniobra, toma el arma equipada en mano principal
  if (!isManeuver && (!key || !key.trim())) {
    const k = getEquippedWeaponKey(actor, "main");
    if (k) key = k;
  }

  const { formula } = buildAttackFormula(actor, { isManeuver, key, attrKey, bonus, penalty });
  const path = isManeuver ? `system.progression.maneuvers.${key}.rank` : `system.progression.weapons.${key}.rank`;
  const rank = Number(foundry.utils.getProperty(actor, path) || 0);

  await resolveEvolution({
    type: "attack",
    mode, formula, rank, 
    flavor: flavor ?? (isManeuver ? (key ? `Maniobra • ${key}` : `Maniobra`) : (key ? `Ataque • ${key}` : `Ataque`)),
    actor,
    meta: { key, isManeuver }
  });
}

/** TIRADA: impacto cuerpo a cuerpo — sin progreso */
export async function rollImpact(actor, {
  key,
  die = "d6",
  grade = 1,
  attrKey,
  bonus = 0,
  flavor,
  // Crítico / Romper Partes
  weaponItem = null,          // ítem equipado (mano principal/secundaria)
  breakBonus = 0,             // bonos situacionales para romper partes
  targetDurability = null,    // si se pasa, auto-evalúa rotura (si hay crítico)
  whisperBreakToGM = true     // susurrar evaluación de rotura al GM
} = {}) {
  const { formula } = buildImpactFormula(actor, { key, die, grade, attrKey, bonus });

  // Tirada de IMPACTO normal
  const r = await (new Roll(formula)).roll({ async: true });
  await r.toMessage({
    flavor: flavor ?? (key ? `Impacto • ${key}` : `Impacto`),
    flags: {
      tsdc: {
        version: 1,
        actorId: actor?._id ?? actor?.id ?? null,
        type: "impact",
        policy: "none",
        rank: 0,
        meta: { key },
        totals: { low: r.total, high: r.total }
      }
    }
  });

  // === Crítico en IMPACTO ===
  const crit = detectImpactCrit(r);
  if (!crit.isCrit) return { resultRoll: r, isCrit: false };

  const breakPower = computeBreakPower(weaponItem, breakBonus);

  // Mensaje con botón "Evaluar rotura…" (embed power en data-*)
  const msgHtml = `
    <div class="tsdc-crit">
      <p><strong>Impacto Crítico</strong> — Poder de Rotura: <b>${breakPower}</b></p>
      <button class="t-btn tsdc-break-eval" 
              data-power="${breakPower}"
              data-actor="${actor?._id ?? actor?.id ?? ''}">
        Evaluar rotura…
      </button>
      <div class="muted" style="margin-top:4px;">Solo GM: compara contra la Durabilidad del objetivo.</div>
    </div>
  `;
  await ChatMessage.create({
    content: msgHtml,
    speaker: ChatMessage.getSpeaker({ actor })
  });

  // Auto-evaluar (opcional) si vino targetDurability
  if (targetDurability != null) {
    const ok = (breakPower >= Number(targetDurability));
    if (whisperBreakToGM) {
      await ChatMessage.create({
        whisper: ChatMessage.getWhisperRecipients("GM"),
        content: `<p><strong>Evaluación de Rotura</strong> — Potencia ${breakPower} vs Durabilidad ${targetDurability} → ${ok ? "💥 ROMPE" : "no rompe"}</p>`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    }
    return { resultRoll: r, isCrit: true, breakPower, broke: ok };
  }

  return { resultRoll: r, isCrit: true, breakPower };
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
