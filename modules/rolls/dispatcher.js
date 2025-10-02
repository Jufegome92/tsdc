// modules/rolls/dispatcher.js
import { resolveEvolution } from "../features/advantage/index.js";
import { buildAttackFormula, buildImpactFormula, buildDefenseFormula, buildResistanceFormula } from "./formulas.js";
import { getEquippedWeaponKey, resolveWeaponByKey, isNaturalWeaponDisabled, describeNaturalDisable } from "../features/inventory/index.js";
import { detectImpactCrit, computeBreakPower } from "../features/combat/critical.js";
import { makeRollTotal } from "./engine.js";
import { emitModInspector } from "./inspector.js";
import { triggerFumbleReactions } from "../atb/reactions.js";
const TSDC_ATB = { opposedContext: false };
// 🔗 Context tags
import { buildContextTags } from "./context-tags.js";
import { toCanonAttr } from "../features/attributes/index.js";

/** === Helpers locales === */
function primaryTokenOf(actor) {
  return actor?.getActiveTokens?.(true)?.[0]
      || canvas.tokens.placeables.find(t => t.actor?.id === actor?.id)
      || null;
}

/**
 * Calcula el bonus de armadura para una zona específica
 * Ligero: grado, Intermedio: grado * 2, Pesado: grado * 3
 */
function getArmorBonusForZone(actor, zone) {
  if (!actor || !zone) return 0;

  // Obtener la pieza equipada en la zona
  const inventory = actor.system?.inventory || {};
  const piece = inventory[zone];

  if (!piece || !piece.equipped) return 0;

  const grade = Number(piece.grade || 0);
  const category = String(piece.category || "").toLowerCase();

  // Calcular bonus según categoría
  if (category === "light" || category === "ligero") {
    return grade;
  } else if (category === "medium" || category === "intermedio" || category === "medio") {
    return grade * 2;
  } else if (category === "heavy" || category === "pesado") {
    return grade * 3;
  }

  return 0;
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
  context = {},
  opposed = false
} = {}) {
  if (!isManeuver && (!key || !key.trim())) {
    const k = getEquippedWeaponKey(actor, "main");
    if (k) key = k;
  }

  let naturalInfo = key ? resolveWeaponByKey(actor, key) : null;
  if ((!key || !naturalInfo) && actor.type === "creature") {
    const naturals = actor.getFlag("tsdc", "naturalWeapons") ?? [];
    for (const rec of naturals) {
      if (!isNaturalWeaponDisabled(actor, rec)) {
        key = rec.key;
        naturalInfo = resolveWeaponByKey(actor, key);
        break;
      }
    }
  }

  const { formula } = buildAttackFormula(actor, { isManeuver, key, attrKey, bonus, penalty });
  const path  = isManeuver ? `system.progression.maneuvers.${key}.rank` : `system.progression.weapons.${key}.rank`;
  const rank  = Number(foundry.utils.getProperty(actor, path) || 0);

  if (!naturalInfo && key) {
    naturalInfo = resolveWeaponByKey(actor, key);
  }
  if (naturalInfo?.source === "natural" && isNaturalWeaponDisabled(actor, naturalInfo.record)) {
    const reason = naturalInfo.disabledReason || describeNaturalDisable(actor, naturalInfo.record) || "parte dañada";
    ui.notifications?.warn(`No puedes usar ${naturalInfo.record?.label ?? "esa arma"}: ${reason}.`);
    return null;
  }

  if (opposed) _tsdcSetOpposedContext(true);
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
  if (evo) {
    evo.meta = evo.meta ?? { key, isManeuver };
    // Si es maniobra, guarda qué arma se usó para pegar
    if (isManeuver) {
      try {
        const wKey = getEquippedWeaponKey(actor, "main");
        if (wKey) evo.meta.weaponKey = wKey;
      } catch (_) {}
    }
    // Garantiza otherRoll cuando hubo dos tiradas (execution/learning)
    if (!evo.otherRoll && evo.resultRoll && (evo.usedPolicy === "execution" || evo.usedPolicy === "learning")) {
      const tmp = new Roll(formula); await tmp.evaluate();
      evo.otherRoll = (tmp.total === evo.resultRoll.total) ? tmp : tmp;
    }
  }
  const { resultRoll, otherRoll, usedPolicy } = evo || {};
  if (!resultRoll || typeof resultRoll.total !== "number") return null;

  // re-evaluar si la tirada terminó resolviendo un arma natural
  if (!naturalInfo && key) {
    naturalInfo = resolveWeaponByKey(actor, key);
  }
  if (naturalInfo?.source === "natural" && isNaturalWeaponDisabled(actor, naturalInfo.record)) {
    const reason = naturalInfo.disabledReason || describeNaturalDisable(actor, naturalInfo.record) || "parte dañada";
    ui.notifications?.warn(`No puedes usar ${naturalInfo.record?.label ?? "esa arma"}: ${reason}.`);
    return null;
  }

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
  if (!opposed) await gmEvalCard({
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
  die = null,
  grade = null,
  attrKey,
  bonus = 0,
  flavor,
  weaponItem = null,
  breakBonus = 0,
  targetDurability = null,
  whisperBreakToGM = true,
  context = {},
  targetActor = null,
  hitLocation = null
} = {}) {
  const naturalInfo = key ? resolveWeaponByKey(actor, key) : null;
  if (naturalInfo?.source === "natural" && isNaturalWeaponDisabled(actor, naturalInfo.record)) {
    const reason = naturalInfo.disabledReason || describeNaturalDisable(actor, naturalInfo.record) || "parte dañada";
    ui.notifications?.warn(`No puedes usar ${naturalInfo.record?.label ?? "esa arma"}: ${reason}.`);
    return null;
  }

  const { formula } = buildImpactFormula(actor, { key, die, grade, attrKey, bonus });
  const r = new Roll(formula);
  await r.evaluate();

  const tags = makeTagsFor({ ...context, phase: "impact" });

  // Si el objetivo es una criatura, susurrar la tirada al GM
  const isTargetCreature = targetActor?.type === "creature";
  const messageData = {
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
  };

  if (isTargetCreature) {
    messageData.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
  }

  await r.toMessage(messageData);

  const crit = detectImpactCrit(r);
  if (!crit.isCrit) return { resultRoll: r, isCrit: false };

  if (!weaponItem) {
    try {
      const k = key || getEquippedWeaponKey(actor, "main");
      weaponItem = actor?.items?.get?.(k)
                || actor?.items?.find?.(i => i.id === k || i.name === k) || null;
    } catch (_) {}
  }

  // Si hay un targetActor y es un monstruo, usar sus partes del cuerpo para rotura
  let breakPower = computeBreakPower(weaponItem, breakBonus);
  let targetBodyParts = null;

  if (targetActor && targetActor.type === "creature") {
    targetBodyParts = targetActor.system?.health?.parts || {};
    // Para monstruos, el poder de rotura debería ser contra las partes del cuerpo del objetivo
    // En lugar del arma del atacante
    console.log("TSDC | Target is creature, using body parts for breakage evaluation");
  }

  let msgHtml = `
    <div class="tsdc-crit">
      <p><strong>Impacto Crítico</strong> — Poder de Rotura: <b>${breakPower}</b></p>`;

  if (targetBodyParts && Object.keys(targetBodyParts).length > 0) {
    if (hitLocation && targetBodyParts[hitLocation]) {
      // Solo mostrar la parte que fue golpeada
      const partData = targetBodyParts[hitLocation];
      const durability = partData.quality || 0;
      const willBreak = breakPower >= durability;
      const statusIcon = willBreak ? "💥" : "🛡️";
      const statusText = willBreak ? "ROMPE" : "no rompe";

      msgHtml += `
        <div style="margin-top: 8px;"><strong>Evaluar rotura en ${partData.label || hitLocation}:</strong></div>
        <div style="margin: 4px 0; padding: 4px; border: 1px solid #ccc; border-radius: 4px;">
          <strong>${partData.label || hitLocation}</strong> (Durabilidad: ${durability}, Material: ${partData.material || 'N/A'})
          <br>
          <span style="color: ${willBreak ? '#d32f2f' : '#388e3c'};">
            ${statusIcon} Potencia ${breakPower} vs Durabilidad ${durability} → ${statusText}
          </span>
        </div>`;
    } else {
      // Fallback: mostrar todas las partes si no hay hitLocation específica
      msgHtml += `<div style="margin-top: 8px;"><strong>Evaluar rotura contra partes del cuerpo:</strong></div>`;

      for (const [partKey, partData] of Object.entries(targetBodyParts)) {
        const durability = partData.quality || 0;
        const willBreak = breakPower >= durability;
        const statusIcon = willBreak ? "💥" : "🛡️";
        const statusText = willBreak ? "ROMPE" : "no rompe";

        msgHtml += `
          <div style="margin: 4px 0; padding: 4px; border: 1px solid #ccc; border-radius: 4px;">
            <strong>${partData.label || partKey}</strong> (Durabilidad: ${durability}, Material: ${partData.material || 'N/A'})
            <br>
            <span style="color: ${willBreak ? '#d32f2f' : '#388e3c'};">
              ${statusIcon} Potencia ${breakPower} vs Durabilidad ${durability} → ${statusText}
            </span>
          </div>`;
      }
    }
  } else {
    msgHtml += `
      <button class="t-btn tsdc-break-eval"
              data-power="${breakPower}"
              data-actor="${actor?._id ?? actor?.id ?? ''}">
        Evaluar rotura…
      </button>`;
  }

  msgHtml += `
      <div class="muted" style="margin-top:4px;">Solo GM: compara contra la Durabilidad del objetivo.</div>
    </div>
  `;

  // Si el objetivo es una criatura, susurrar el mensaje de crítico al GM
  const critMessageData = {
    content: msgHtml,
    speaker: ChatMessage.getSpeaker({ actor })
  };

  if (isTargetCreature) {
    critMessageData.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
  }

  await ChatMessage.create(critMessageData);

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
  context = {},
  opposed = false
} = {}) {
  const rank = Number(foundry.utils.getProperty(actor, `system.progression.defense.evasion.rank`) || 0);

  // Primero determinar la zona golpeada
  const d100 = new Roll("1d100"); await d100.evaluate();
  const r = d100.total;
  let bodyPart = "chest";
  if (r <= 5) bodyPart = "head";
  else if (r <= 10) bodyPart = "boots";
  else if (r <= 45) bodyPart = "chest";
  else if (r <= 60) bodyPart = "bracers";
  else if (r <= 75) bodyPart = "bracers";
  else if (r <= 85) bodyPart = "legs";
  else if (r <= 95) bodyPart = "legs";
  else bodyPart = "chest";

  // Calcular armor bonus según la zona golpeada
  const zoneArmorBonus = getArmorBonusForZone(actor, bodyPart);
  const finalArmorBonus = armorBonus || zoneArmorBonus;

  const { formula } = buildDefenseFormula(actor, { armorBonus: finalArmorBonus, bonus, penalty });

  if (opposed) _tsdcSetOpposedContext(true);
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

  if (!opposed) await gmEvalCard({
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

  return { total: patched.total, bodyPart, hitLocation: bodyPart, tags, evo };
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

/** ─────────── CARACTERÍSTICA ─────────── */
export async function rollCharacteristic(actor, {
  characteristic,
  bonus = 0,
  penalty = 0,
  flavor,
  extraTags = [],
  context = {},
  toChat = true
} = {}) {
  if (!actor) return null;
  const attrKey = toCanonAttr(characteristic);
  if (!attrKey) {
    ui.notifications?.warn?.("Característica no reconocida para tirada.");
    return null;
  }

  const attrLabel = game.i18n?.localize?.(`TSDC.Attr.${attrKey}`) ?? attrKey;
  const baseAttr = Number(foundry.utils.getProperty(actor, `system.attributes.${attrKey}`) || 0);
  const levelRef = Number(context.levelRef ?? actor.system?.levelRef ?? actor.system?.level ?? 1);

  const fixedBonus = Number(bonus || 0);
  const fixedPenalty = Number(penalty || 0);

  const parts = ["1d10"];
  if (baseAttr !== 0) parts.push(String(baseAttr));
  if (levelRef !== 0) parts.push(String(levelRef));
  if (fixedBonus) parts.push(String(fixedBonus));
  if (fixedPenalty) parts.push(String(-Math.abs(fixedPenalty)));
  const formula = parts.join(" + ");

  const evo = await resolveEvolution({
    type: "attribute",
    mode: "none",
    formula,
    rank: 0,
    flavor: flavor ?? `Característica • ${attrLabel}`,
    actor,
    toChat,
    meta: {
      characteristic: attrKey,
      levelRef,
      bonus: fixedBonus,
      penalty: fixedPenalty
    }
  });

  const { resultRoll } = evo || {};
  if (!resultRoll || typeof resultRoll.total !== "number") return null;

  const normalizedExtra = Array.isArray(extraTags)
    ? extraTags.map(t => String(t || "").toLowerCase().trim()).filter(Boolean)
    : [];

  const tags = Array.from(new Set([
    "phase:skill",
    "roll:tc",
    `characteristic:${attrKey}`,
    ...normalizedExtra
  ]));

  const ctxExtras = { ...context };
  delete ctxExtras.tags;

  const patched = makeRollTotal(actor, resultRoll.total, {
    phase: "skill",
    tag: "TC",
    rollType: "TC",
    tags,
    characteristic: attrKey,
    levelRef,
    ...ctxExtras
  });

  await emitModInspector(actor, { phase: "skill", tag: "TC" }, patched.breakdown);

  await gmEvalCard({
    actor,
    kind: "attribute",
    payload: {
      actorId: actor.id ?? actor._id ?? null,
      characteristic: attrKey,
      totalShown: patched.total,
      tags,
      levelRef,
      bonus: fixedBonus,
      penalty: fixedPenalty
    }
  });

  return {
    total: patched.total,
    roll: resultRoll,
    tags,
    levelRef,
    attribute: attrKey,
    evo
  };
}

export function _tsdcSetOpposedContext(v=true) { TSDC_ATB.opposedContext = !!v; }
// Pre-hook: si viene una tirada con flags.tsdc y estamos en contexto ATB, márcala como opuesta
Hooks.on("preCreateChatMessage", (doc, data) => {
  try {
    const f = data?.flags?.tsdc;
    if (!f) return;
    const isAtkOrDef = (f.type === "attack" || f.type === "defense");
    if (isAtkOrDef && TSDC_ATB.opposedContext) {
      data.flags.tsdc.opposed = true;
      data.flags.tsdc.evalMode = "opposed";
    }
  } catch (_) {}
});

// Después de crear el mensaje, apaga el contexto (evita marcar mensajes no relacionados)
Hooks.on("createChatMessage", () => { TSDC_ATB.opposedContext = false; });
