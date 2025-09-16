// modules/rolls/dispatcher.js
import { resolveEvolution } from "../features/advantage/index.js";
import { buildAttackFormula, buildImpactFormula, buildDefenseFormula, buildResistanceFormula } from "./formulas.js";
import { getEquippedWeaponKey } from "../features/inventory/index.js";
import { detectImpactCrit, computeBreakPower } from "../features/combat/critical.js";
import { makeRollTotal } from "./engine.js";
import { emitModInspector } from "./inspector.js";
import { triggerFumbleReactions } from "../atb/reactions.js";

// 🔗 Context tags
import { buildContextTags, normalizeTags } from "./context-tags.js";
const _atkGuard = new Set();

/** === Helpers locales === */
function primaryTokenOf(actor) { // <<< obtiene un token del actor de forma segura
  return actor?.getActiveTokens?.(true)?.[0]
      || canvas.tokens.placeables.find(t => t.actor?.id === actor?.id)
      || null;
}

/** Util: crea una tarjetita para el GM con los datos necesarios para evaluar */
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
  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html
  });
}

/** ==== Helpers de contexto (opcionales/defensivos) ==== */

/** Intenta inferir el subtipo de ataque si no lo pasó la UI */
function inferAttackKind(actor, { isManeuver=false, weaponKey=null } = {}) {
  try {
    // Si tu item de arma guarda un flag/propiedad para “ranged”
    const k = weaponKey || getEquippedWeaponKey(actor, "main");
    const item = k ? actor?.items?.get?.(k) || actor?.items?.find?.(i => i.name === k) : null;
    const ranged = item?.system?.isRanged ?? item?.flags?.tsdc?.ranged ?? null;
    if (ranged === true) return "ranged";
    if (ranged === false) return "melee";
  } catch (_) {}
  return null; // deja que el builder lo omita si no hay dato
}

/** Construye tags comunes de entorno desde un objeto “context” suelto */
function makeTagsFor(opts = {}) {
  // opts es lo que pase la UI/macro: { phase, attackKind, element, cover, vision, visionRangeMeters,
  // movement, terrain, soundDependent, verbal, envCondition, envFallbackDC, extra }
  return buildContextTags({
    phase: opts.phase,                        // "attack" | "defense" | "skill" | "save" | "impact"
    attackKind: opts.attackKind ?? null,      // "melee" | "ranged" | "naturalRanged"
    element: opts.element ?? null,            // "fire" | ...
    cover: opts.cover ?? null,                // "none" | "partial" | "heavy" | "total"
    vision: opts.vision ?? null,              // "normal" | "limited" | "none"
    visionRangeMeters: opts.visionRange ?? null,
    movement: opts.movement ?? false,         // true | "run" | "crawl"
    terrain: opts.terrain ?? null,            // "difficult"
    soundDependent: !!opts.soundDependent,
    verbal: !!opts.verbal,
    envCondition: opts.envCondition ?? null,  // "light" | "normal" | "moderate" | "severe" | "disastrous"
    envFallbackDC: opts.envFallbackDC ?? null,// "fundamentos" | ... | "extremo"
    extra: opts.extraTags ?? null             // strings o alias
  });
}
/** Heurística de fumble (ajústala a tu engine si ya marcas flags) */
function isFumbleAttack(evo) { // <<< dispara SOLO si detectas fumble real
  const rr = evo?.resultRoll;
  const f  = rr?.flags?.tsdc;
  if (f?.isFumble === true || f?.crit === "fumble") return true;
  // fallback muy básico: si el policy se llamó "fumble"
  if (evo?.usedPolicy && /fumble/i.test(String(evo.usedPolicy))) return true;
  return false;
}
/** ATAQUE */
export async function rollAttack(actor, {
  key,
  isManeuver = false,
  attrKey,
  bonus = 0,
  penalty = 0,
  mode = "ask",
  flavor,
  /** NUEVO: contexto opcional para tags (UI/macros pueden rellenarlo) */
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
    // Si el diálogo se cerró/canceló, simplemente no hacemos nada
    console.debug("rollAttack cancelado o cerrado:", err);
    return null;
  }

  const { resultRoll, otherRoll, usedPolicy } = evo || {};
  if (!resultRoll || typeof resultRoll.total !== "number") {
    // Cancelado o sin resultado → no continuar
    console.debug("rollAttack: sin resultado (cancelado).");
    return null;
  }

  // ===== TAGS de contexto =====
  const attackKind = context.attackKind ?? inferAttackKind(actor, { isManeuver, weaponKey: key });
  const tags = makeTagsFor({
    ...context,
    phase: "attack",
    attackKind
  });

  const patched = makeRollTotal(actor, resultRoll.total, {
    phase: "attack",            // mantiene la fase esperada por el engine
    tag: "TA",
    weaponKey: getEquippedWeaponKey(actor),
    tags                              // <<<<<<  Nuevo: array de context tags
  });

  await emitModInspector(actor, { phase: "attack", tag: "TA" }, patched.breakdown);

  const shownTotal = patched.total;
  // Si en tu UI quieres notas/avances, ya los tienes en patched + resultRoll:
  // const shownNotes = [...(resultRoll.notes || []), ...patched.notes];
  // const shownDiceAdvances = (resultRoll.diceAdvances || 0) + (patched.diceAdvances || 0);

  // === (NUEVO) FUMBLE → abrir ventanas de reacción solo si aplica ===
  const attackerToken = primaryTokenOf(actor); // <<<
  if (attackerToken && isFumbleAttack(evo)) { // <<<
    await triggerFumbleReactions({ fumblerToken: attackerToken });
  }

  await gmEvalCard({
    actor, kind: "attack",
    payload: {
      actorId: actor.id ?? actor._id ?? null,
      key: key ?? null,
      isManeuver: !!isManeuver,
      rank,
      policy: usedPolicy,
      totalShown: shownTotal,
      otherTotal: otherRoll?.total ?? null,
      // Debug opcional para el evaluador (si lo quieres usar)
      tags
    }
  });
}

/** IMPACTO — sin progreso; con crítico/rotura opcional */
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
  /** Opcional: context tags si quieres “elemento” o condiciones en el mensaje */
  context = {}
} = {}) {
  const { formula } = buildImpactFormula(actor, { key, die, grade, attrKey, bonus });

  const r = new Roll(formula);
  await r.evaluate();

  // (Opcional) adjuntamos tags en flags para debug, aunque impacto no pasa por engine
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
        tags      // ← útil para inspección en el chat log / depurar efectos post-impacto
      }
    }
  });

  const crit = detectImpactCrit(r);
  if (!crit.isCrit) return { resultRoll: r, isCrit: false };

  if (!weaponItem) {
    try {
      const k = key || getEquippedWeaponKey(actor, "main");
      weaponItem = actor?.items?.get?.(k) ||
                  actor?.items?.find?.(i => i.id === k || i.name === k) || null;
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
        whisper: ChatMessage.getWhisperRecipients("GM"),
        content: `<p><strong>Evaluación de Rotura</strong> — Potencia ${breakPower} vs Durabilidad ${targetDurability} → ${ok ? "💥 ROMPE" : "no rompe"}</p>`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
    }
    return { resultRoll: r, isCrit: true, breakPower, broke: ok };
  }

  return { resultRoll: r, isCrit: true, breakPower };
}

/** DEFENSA */
export async function rollDefense(actor, {
  armorType,
  armorBonus = 0,
  bonus = 0,
  penalty = 0,
  mode = "ask",
  flavor,
  /** NUEVO: contexto opcional (visión/entorno/cobertura del defensor, etc.) */
  context = {}
} = {}) {
  const { formula } = buildDefenseFormula(actor, { armorBonus, bonus, penalty });
  const rank = Number(foundry.utils.getProperty(actor, `system.progression.defense.evasion.rank`) || 0);

  // ─── Localización de impacto “tentativa” para el evaluador (puede no aplicar si defiende) ───
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

  const { resultRoll, otherRoll, usedPolicy } = await resolveEvolution({
    type: "defense", mode, formula, rank,
    flavor: flavor ?? `Defensa`, actor, meta: { armorType }
  });

  // ===== TAGS de contexto =====
  const tags = makeTagsFor({
    ...context,
    phase: "defense"
    // (tip: aquí suele interesar vision/cobertura del DEFENSOR, terreno difícil, “movement” si se movió antes de defender, etc.)
  });

  const patched = makeRollTotal(actor, resultRoll.total, {
    phase: "defense",
    tag: "TD",
    tags
  });

  await emitModInspector(actor, { phase: "defense", tag: "TD" }, patched.breakdown);

  const shownTotal = patched.total;

  await gmEvalCard({
    actor, kind: "defense",
    payload: {
      actorId: actor.id ?? actor._id ?? null,
      armorType: armorType ?? "light",
      rank,
      policy: usedPolicy,
      totalShown: shownTotal,
      otherTotal: otherRoll?.total ?? null,
      bodyPart,      // "head"|"chest"|"bracers"|"legs"
      d100: r,
      tags
    }
  });
}

/** RESISTENCIA (salvaciones) */
export async function rollResistance(actor, {
  type,
  bonus = 0,
  penalty = 0,
  flavor,
  /** NUEVO: contexto opcional (elemento, entorno, etc.) */
  context = {}
} = {}) {
  const { formula } = buildResistanceFormula(actor, { type, bonus, penalty });
  const { resultRoll } = await resolveEvolution({
    type: "resistance", mode: "none", formula, rank: 0,
    flavor: flavor ?? `Resistencia • ${type}`, actor, meta: { key: type }
  });

  // En tags usamos fase "save" (vocabulario canónico de tags) pero conservamos phase:"resistance" para el engine.
  const tags = makeTagsFor({
    ...context,
    phase: "save"
    // tip: aquí puedes pasar element si resiste un elemento ("element:fire", etc.)
  });

  const patched = makeRollTotal(actor, resultRoll.total, {
    phase: "resistance", // ← mantenemos compatibilidad con tu engine actual
    tag: "TR",
    resType: type,
    tags
  });

  await emitModInspector(actor, { phase: "resistance", tag: "TR" }, patched.breakdown);

  const shownTotal = patched.total;
  // const shownNotes = [...(resultRoll.notes || []), ...patched.notes];
  // const shownDiceAdvances = (resultRoll.diceAdvances || 0) + (patched.diceAdvances || 0);

  await gmEvalCard({
    actor, kind: "resistance",
    payload: {
      actorId: actor.id ?? actor._id ?? null,
      resType: type,
      totalShown: shownTotal,
      tags
    }
  });
}
