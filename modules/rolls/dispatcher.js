// modules/rolls/dispatcher.js
import { resolveEvolution } from "../features/advantage/index.js";
import { buildAttackFormula, buildImpactFormula, buildDefenseFormula, buildResistanceFormula } from "./formulas.js";
import { getEquippedWeaponKey } from "../features/inventory/index.js";
import { detectImpactCrit, computeBreakPower } from "../features/combat/critical.js";

/** Util: crea una tarjetita para el GM con los datos necesarios para evaluar */
async function gmEvalCard({ actor, kind, payload }) {
  // Empaqueto datos en data-* (URI encoded JSON para seguridad)
  const blob = encodeURIComponent(JSON.stringify(payload));
  const title =
    kind === "attack"     ? "Evaluar Ataque"
  : kind === "defense"    ? "Evaluar Defensa"
  : kind === "resistance" ? "Evaluar Resistencia"
  : "Evaluar";

  const html = `
    <div class="tsdc-eval">
      <p><strong>${title}</strong> — Solo GM</p>
      <div class="t-row" style="gap:6px; flex-wrap:wrap;">
        <button class="t-btn tsdc-eval-btn" data-kind="${kind}" data-blob="${blob}">Abrir evaluación…</button>
      </div>
      <div class="muted">No revela DC. Abre un diálogo para ingresar TD/decisiones.</div>
    </div>
  `;
  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html
  });
}

/** ATAQUE: arma o maniobra (a ciegas) */
export async function rollAttack(actor, { key, isManeuver=false, attrKey, bonus=0, penalty=0, mode="ask", flavor } = {}) {
  if (!isManeuver && (!key || !key.trim())) {
    const k = getEquippedWeaponKey(actor, "main");
    if (k) key = k;
  }
  const { formula } = buildAttackFormula(actor, { isManeuver, key, attrKey, bonus, penalty });
  const path  = isManeuver ? `system.progression.maneuvers.${key}.rank` : `system.progression.weapons.${key}.rank`;
  const rank  = Number(foundry.utils.getProperty(actor, path) || 0);

  const { resultRoll, otherRoll, usedPolicy } = await resolveEvolution({
    type: "attack", mode, formula, rank,
    flavor: flavor ?? (isManeuver ? (key ? `Maniobra • ${key}` : `Maniobra`) : (key ? `Ataque • ${key}` : `Ataque`)),
    actor, meta: { key, isManeuver }
  });

  // Datos para que el GM evalúe luego (no mostrados al jugador)
  await gmEvalCard({
    actor, kind: "attack",
    payload: {
      actorId: actor.id ?? actor._id ?? null,
      key: key ?? null,
      isManeuver: !!isManeuver,
      rank,
      policy: usedPolicy,
      // guardo ambos totales por si el GM quiere ver el “alto/bajo”
      totalShown: resultRoll.total,
      // por si quieres usar ambos (se guardaron en flags, pero lo paso directo)
      otherTotal: otherRoll?.total ?? null
    }
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
  const r = new Roll(formula);
  r.evaluateSync();
  const tooltip = await r.getTooltip();
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

/** DEFENSA (evasión/armadura): a ciegas + tarjeta GM */
export async function rollDefense(actor, { armorType, armorBonus=0, bonus=0, penalty=0, mode="ask", flavor } = {}) {
  const { formula } = buildDefenseFormula(actor, { armorBonus, bonus, penalty });
  const rank = Number(foundry.utils.getProperty(actor, `system.progression.defense.evasion.rank`) || 0);

  const { resultRoll, otherRoll, usedPolicy } = await resolveEvolution({
    type: "defense", mode, formula, rank,
    flavor: flavor ?? `Defensa`, actor, meta: { armorType }
  });

  await gmEvalCard({
    actor, kind: "defense",
    payload: {
      actorId: actor.id ?? actor._id ?? null,
      armorType: armorType ?? "light",
      rank,
      policy: usedPolicy,
      totalShown: resultRoll.total,
      otherTotal: otherRoll?.total ?? null
    }
  });
}

/** RESISTENCIA: a ciegas + tarjeta GM */
export async function rollResistance(actor, { type, bonus=0, penalty=0, flavor } = {}) {
  const { formula } = buildResistanceFormula(actor, { type, bonus, penalty });
  const { resultRoll } = await resolveEvolution({
    type: "resistance", mode: "none", formula, rank: 0,
    flavor: flavor ?? `Resistencia • ${type}`, actor, meta: { key: type }
  });

  await gmEvalCard({
    actor, kind: "resistance",
    payload: {
      actorId: actor.id ?? actor._id ?? null,
      resType: type,
      totalShown: resultRoll.total
    }
  });
}