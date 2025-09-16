// modules/rolls/dispatcher.js
import { resolveEvolution } from "../features/advantage/index.js";
import { buildAttackFormula, buildImpactFormula, buildDefenseFormula, buildResistanceFormula } from "./formulas.js";
import { getEquippedWeaponKey } from "../features/inventory/index.js";
import { detectImpactCrit, computeBreakPower } from "../features/combat/critical.js";
import { makeRollTotal } from "./engine.js";
import { emitModInspector } from "./inspector.js";
import { triggerFumbleReactions } from "../atb/reactions.js";

// 🔗 Context tags
import { buildContextTags } from "./context-tags.js";

/** === Helpers locales === */
function primaryTokenOf(actor) {
  return actor?.getActiveTokens?.(true)?.[0]
      || canvas.tokens.placeables.find(t => t.actor?.id === actor?.id)
      || null;
}

/** Tarjeta “Solo GM” para evaluar (restaurada) */
async function gmEvalCard({ actor, kind, payload }) {
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
  const whisperIds = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
  await ChatMessage.create({
    whisper: whisperIds,
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html
  });
}

/** Intenta inferir melee/ranged si no lo pasa la UI */
function inferAttackKind(actor, { isManeuver=false, weaponKey=null } = {}) {
  try {
    const k = weaponKey || getEquippedWeaponKey(actor, "main");
    const item = k ? actor?.items?.get?.(k) || actor?.items?.find?.(i => i.name === k) : null;
    const ranged = item?.system?.isRanged ?? item?.flags?.tsdc?.ranged ?? null;
    if (ranged === true) return "ranged";
    if (ranged === false) return "melee";
  } catch (_) {}
  return null;
}

/** Construye tags comunes de entorno desde “context” */
function makeTagsFor(opts = {}) {
  return buildContextTags({
    phase: opts.phase,                        // "attack" | "defense" | "save" | "impact"
    attackKind: opts.attackKind ?? null,      // "melee" | "ranged" | "naturalRanged"
    element: opts.element ?? null,
    cover: opts.cover ?? null,                // "none" | "partial" | "heavy" | "total"
    vision: opts.vision ?? null,              // "normal" | "limited" | "none"
    visionRangeMeters: opts.visionRange ?? null,
    movement: opts.movement ?? false,
    terrain: opts.terrain ?? null,
    soundDependent: !!opts.soundDependent,
    verbal: !!opts.verbal,
    envCondition: opts.envCondition ?? null,  // "light" | "normal" | "moderate" | "severe" | "disastrous"
    envFallbackDC: opts.envFallbackDC ?? null,
    extra: opts.extraTags ?? null
  });
}

/** Heurística de fumble */
function isFumbleAttack(evo) {
  const rr = evo?.resultRoll;
  const f  = rr?.flags?.tsdc;
  if (f?.isFumble === true || f?.crit === "fumble") return true;
  if (evo?.usedPolicy && /fumble/i.test(String(evo.usedPolicy))) return true;
  return false;
}

/** ─────────── ATAQUE ─────────── */
export async function rollAttack(actor, {
  key,
  isManeuver = false,
  attrKey,
  bonus = 0,
  penalty = 0,
  mode = "ask",
  flavor,
  context = {}
} = {}) {
  if (!isManeuver && (!key || !key.trim())) {
    const k = getEquippedWeaponKey(actor, "main");
    if (k) key = k;
  }

  const { formula } = buildAttackFormula(actor, { isManeuver, key, attrKey, bonus, penalty });
  const path  = isManeuver ? `system.progression.maneuvers.${key}.rank` : `system.progression.weapons.${key}.rank`;
  const rank  = Number(foundry.utils.getProperty(actor, path) || 0);

  let evo;
  try {
    evo = await resolveEvolution({
      type: "attack", mode, formula, rank,
      flavor: flavor ?? (isManeuver ? (key ? `Maniobra • ${key}` : `Maniobra`) : (key ? `Ataque • ${key}` : `Ataque`)),
      actor, meta: { key, isManeuver }
    });
  } catch (err) {
    console.debug("rollAttack cancelado o cerrado:", err);
    return null;
  }

  const { resultRoll, otherRoll, usedPolicy } = evo || {};
  if (!resultRoll || typeof resultRoll.total !== "number") return null;

  const attackKind = context.attackKind ?? inferAttackKind(actor, { isManeuver, weaponKey: key });
  const tags = makeTagsFor({ ...context, phase: "attack", attackKind });

  const patched = makeRollTotal(actor, resultRoll.total, {
    phase: "attack",
    tag: "TA",
    weaponKey: getEquippedWeaponKey(actor),
    tags
  });

  await emitModInspector(actor, { phase: "attack", tag: "TA" }, patched.breakdown);

  // FUMBLE → abrir ventanas de reacción solo si aplica
  const attackerToken = primaryTokenOf(actor);
  if (attackerToken && isFumbleAttack(evo)) {
    await triggerFumbleReactions({ fumblerToken: attackerToken });
  }

  // Tarjeta GM para evaluar
  await gmEvalCard({
    actor, kind: "attack",
    payload: {
      actorId: actor.id ?? actor._id ?? null,
      key: key ?? null,
      isManeuver: !!isManeuver,
      rank,
      policy: usedPolicy,
      totalShown: patched.total,
      otherTotal: otherRoll?.total ?? null,
      tags
    }
  });

  return { total: patched.total, tags, evo };
}

/** ─────────── IMPACTO ─────────── */
export async function rollImpact(actor, {
  key,
  die = "d6",
  grade = 1,
  attrKey,
  bonus = 0,
  flavor,
  weaponItem = null,
  breakBonus = 0,
  targetDurability = null,
  whisperBreakToGM = true,
  context = {}
} = {}) {
  const { formula } = buildImpactFormula(actor, { key, die, grade, attrKey, bonus });
  const r = new Roll(formula);
  await r.evaluate();

  const tags = makeTagsFor({ ...context, phase: "impact" });

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
        totals: { low: r.total, high: r.total },
        tags
      }
    }
  });

  const crit = detectImpactCrit(r);
  if (!crit.isCrit) return { resultRoll: r, isCrit: false };

  if (!weaponItem) {
    try {
      const k = key || getEquippedWeaponKey(actor, "main");
      weaponItem = actor?.items?.get?.(k)
                || actor?.items?.find?.(i => i.id === k || i.name === k) || null;
    } catch (_) {}
  }
  const breakPower = computeBreakPower(weaponItem, breakBonus);

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

  if (targetDurability != null) {
    const ok = (breakPower >= Number(targetDurability));
    if (whisperBreakToGM) {
      await ChatMessage.create({
        whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
        content: `<p><strong>Evaluación de Rotura</strong> — Potencia ${breakPower} vs Durabilidad ${targetDurability} → ${ok ? "💥 ROMPE" : "no rompe"}</p>`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    }
    return { resultRoll: r, isCrit: true, breakPower, broke: ok };
  }

  return { resultRoll: r, isCrit: true, breakPower };
}

/** ─────────── DEFENSA ─────────── */
export async function rollDefense(actor, {
  armorType,
  armorBonus = 0,
  bonus = 0,
  penalty = 0,
  mode = "ask",
  flavor,
  context = {}
} = {}) {
  const { formula } = buildDefenseFormula(actor, { armorBonus, bonus, penalty });
  const rank = Number(foundry.utils.getProperty(actor, `system.progression.defense.evasion.rank`) || 0);

  const d100 = new Roll("1d100"); await d100.evaluate();
  const r = d100.total;
  let bodyPart = "chest";
  if (r <= 10) bodyPart = "head";
  else if (r <= 45) bodyPart = "chest";
  else if (r <= 60) bodyPart = "bracers";
  else if (r <= 75) bodyPart = "bracers";
  else if (r <= 85) bodyPart = "legs";
  else if (r <= 95) bodyPart = "legs";
  else bodyPart = "chest";

  const evo = await resolveEvolution({
    type: "defense", mode, formula, rank,
    flavor: flavor ?? `Defensa`, actor, meta: { armorType }
  });
  const { resultRoll, otherRoll, usedPolicy } = evo || {};
  if (!resultRoll || typeof resultRoll.total !== "number") return null;

  const tags = makeTagsFor({ ...context, phase: "defense" });

  const patched = makeRollTotal(actor, resultRoll.total, {
    phase: "defense",
    tag: "TD",
    tags
  });

  await emitModInspector(actor, { phase: "defense", tag: "TD" }, patched.breakdown);

  await gmEvalCard({
    actor, kind: "defense",
    payload: {
      actorId: actor.id ?? actor._id ?? null,
      armorType: armorType ?? "light",
      rank,
      policy: usedPolicy,
      totalShown: patched.total,
      otherTotal: otherRoll?.total ?? null,
      bodyPart,
      d100: r,
      tags
    }
  });

  return { total: patched.total, bodyPart, tags, evo };
}

/** ─────────── RESISTENCIA ─────────── */
export async function rollResistance(actor, {
  type,
  bonus = 0,
  penalty = 0,
  flavor,
  context = {}
} = {}) {
  const { formula } = buildResistanceFormula(actor, { type, bonus, penalty });
  const evo = await resolveEvolution({
    type: "resistance", mode: "none", formula, rank: 0,
    flavor: flavor ?? `Resistencia • ${type}`, actor, meta: { key: type }
  });
  const { resultRoll } = evo || {};
  if (!resultRoll || typeof resultRoll.total !== "number") return null;

  // tags “save”, pero mantenemos phase:"resistance" en makeRollTotal
  const tags = makeTagsFor({ ...context, phase: "save" });

  const patched = makeRollTotal(actor, resultRoll.total, {
    phase: "resistance",
    tag: "TR",
    resType: type,
    tags
  });

  await emitModInspector(actor, { phase: "resistance", tag: "TR" }, patched.breakdown);

  await gmEvalCard({
    actor, kind: "resistance",
    payload: {
      actorId: actor.id ?? actor._id ?? null,
      resType: type,
      totalShown: patched.total,
      tags
    }
  });

  return { total: patched.total, tags, evo };
}
