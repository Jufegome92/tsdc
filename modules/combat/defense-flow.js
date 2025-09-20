// modules/combat/defense-flow.js
// Orquesta: ataque → defensa → premio de competencia → impacto vs bloqueo → heridas/daño

import { openReactionWindow } from "../atb/reactions.js";
import { packageToRollContext } from "../perception/index.js";
import { weaponRangeM } from "../combat/range.js";
import { validateAttackRangeAndVision } from "../rolls/validators.js";

import { rollAttack, rollDefense, rollImpact } from "../rolls/dispatcher.js";
import { addProgress } from "../progression.js";
import { computeBlockingAt } from "../features/armors/index.js";
import { buildImpactFormula } from "../rolls/formulas.js";
import { applyManeuverEffects } from "./effects.js"

const CHAT = (html, actor=null) => ChatMessage.create({
  content: html,
  speaker: actor ? ChatMessage.getSpeaker({ actor }) : undefined
});

/* ======================================================
 * Utilidades
 * ====================================================== */

function randomHitLocation() {
  // Torso y piernas un poco más probables, pero incluye cabeza/brazos/pies.
  const table = [
    "head","chest","chest","chest",
    "bracers","bracers",
    "legs","legs","legs",
    "boots"
  ];
  const i = Math.floor(Math.random() * table.length);
  return table[i];
}

// Evalúa si el atacante "aprendió" con tu regla de dos dados vs rango
function computeAttackerLearned({ attackerActor, attackResult, success }) {
  const rr = attackResult?.evo?.resultRoll?.total ?? null;
  const or = attackResult?.evo?.otherRoll?.total ?? null;
  if (rr == null || or == null) return false; // si por política no hubo 2 dados, no aprende

  const dHi = Math.max(rr, or);
  const dLo = Math.min(rr, or);

  const isManeuver = !!attackResult?.evo?.meta?.isManeuver;
  const key = attackResult?.evo?.meta?.key || "";
  const path = isManeuver ? `system.progression.maneuvers.${key}.rank`
                          : `system.progression.weapons.${key}.rank`;
  const rank = Number(foundry.utils.getProperty(attackerActor, path) || 0);

  return !!(success && (dHi - dLo) >= rank);
}

function getAttackTrack(attackMeta) {
  const key = attackMeta?.key || "";
  const isManeuver = !!attackMeta?.isManeuver || attackMeta?.kind === "maneuver";
  const isRelic    = !!attackMeta?.isRelic    || attackMeta?.kind === "relic";
  if (isManeuver) return { tree: "maneuvers", key };
  if (isRelic)    return { tree: "relics", key };
  return { tree: "weapons", key };
}

function labelFromArmorType(t) {
  if (!t) return "?";
  const s = String(t).toLowerCase();
  if (s.includes("light")   || s.includes("ligera"))   return "Ligera";
  if (s.includes("medium")  || s.includes("media") )   return "Media";
  if (s.includes("heavy")   || s.includes("pesada"))   return "Pesada";
  return t;
}

function inferArmorTypeAt(defender, hitLoc) {
  const lower = String(hitLoc||"").toLowerCase();
  const part = defender?.system?.armors?.parts?.[lower];
  const t    = (part?.type || defender?.system?.armors?.type || "light");
  return t; // "light" | "medium" | "heavy"
}

/* ======================================================
 * Premios de competencia — Matriz Aprendizaje/Ejecución
 * ====================================================== */
async function awardCompetencyMatrix({
  atkTotal, defTotal, attacker, defender,
  atkPolicy, defPolicy, attackMeta, hitLoc,
  attackerLearned=false
}) {
  const attackerWin = (atkTotal >= defTotal);
  const atkTrack = getAttackTrack(attackMeta);
  const armorType = inferArmorTypeAt(defender, hitLoc);
  const evasionTrack = { tree: "defense", key: "evasion" };

  async function attackerLearn() {
    if (!atkTrack.key) return;
    await addProgress(attacker, atkTrack.tree, atkTrack.key, 1);
    await CHAT(`🏅 <b>${attacker.name}</b> gana progreso en <b>${atkTrack.tree}</b> (<i>${atkTrack.key}</i>).`, attacker);
  }

  // 1) Ejecución vs Ejecución
  if (atkPolicy === "execution" && defPolicy === "execution") {
    return { proceedToDamage: attackerWin };
  }

  // 2) Aprender vs Aprender
  if (atkPolicy === "learning" && defPolicy === "learning") {
    if (attackerWin) {
      if (attackerLearned) await attackerLearn();        // atacante solo si aprende
      if (armorType) {
        await addProgress(defender, "armor", armorType, 1); // defensor por armadura
        await CHAT(`🏅 <b>${defender.name}</b> gana progreso en <b>Defensa (${labelFromArmorType(armorType)})</b>.`, defender);
        }
      return { proceedToDamage: true };
    } else {
      await addProgress(defender, evasionTrack.tree, evasionTrack.key, 1); // defensor aprende evasión
      await CHAT(`🏅 <b>${defender.name}</b> gana progreso en <b>Evasión</b>.`, defender);
      return { proceedToDamage: false };
    }
  }

  // 3) Aprender (Atacante) vs Ejecución (Defensor)
  if (atkPolicy === "learning" && defPolicy === "execution") {
    if (attackerWin && attackerLearned) await attackerLearn();
    return { proceedToDamage: attackerWin };
  }

  // 4) Ejecución (Atacante) vs Aprender (Defensor)
  if (atkPolicy === "execution" && defPolicy === "learning") {
    if (attackerWin) {
      if (armorType) {
        await addProgress(defender, "armor", armorType, 1);
        await CHAT(`🏅 <b>${defender.name}</b> gana progreso en <b>Defensa (${labelFromArmorType(armorType)})</b>.`, defender);
      }
      return { proceedToDamage: true };
    } else {
      await addProgress(defender, evasionTrack.tree, evasionTrack.key, 1);
      await CHAT(`🏅 <b>${defender.name}</b> gana progreso en <b>Evasión</b>.`, defender);
      return { proceedToDamage: false };
    }
  }

  // Default conservador
  return { proceedToDamage: attackerWin };
}

/* ======================================================
 * Entrada principal del flujo
 * - attackerActor/attackerToken: quién ataca
 * - targetToken: quién defiende
 * - attackCtx: contexto de percepción/rango (si lo usas)
 * - attackResult: resultado devuelto por rollAttack (si lo tienes)
 * ====================================================== */
export async function runDefenseFlow({
  attackerActor, attackerToken, targetToken, attackCtx=null, attackResult=null
}) {
  if (!attackerActor || !attackerToken || !targetToken?.actor) return;

  // 1) Aviso visual de reacción/defensa
  openReactionWindow({
    ownerToken: targetToken,
    reason: "defense-required",
    payload: { attackerId: attackerToken.id }
  });

  // 2) Pedir defensa
  const defense = await requestDefenseRoll({
    defender: targetToken.actor, defenderToken: targetToken,
    attackerActor, attackCtx, attackResult
  });
  if (!defense) {
    ui.notifications?.warn(`${targetToken.name}: no se resolvió la defensa (cancelado).`);
    return;
  }

  // 3) Resolver matriz de aprendizaje/ejecución
  const atkTotal  = Number(attackResult?.total ?? attackResult?.attack ?? 0);
  const defTotal  = Number(defense?.total ?? 0);
  const atkPolicy = String(attackResult?.evo?.usedPolicy || "execution");
  const defPolicy = String(defense?.policy || "execution");
  const success   = atkTotal >= defTotal;
  const attackerLearned = computeAttackerLearned({ attackerActor, attackResult, success });
  if (game?.user?.isGM) {
    console.debug("TSDC | learn check", {
      atkPolicy, defPolicy, success,
      rr: attackResult?.evo?.resultRoll?.total ?? null,
      or: attackResult?.evo?.otherRoll?.total ?? null
    });
  }

  // Localización: usa la de defensa si vino; si no, sorteamos
  const hitLocation = defense.hitLocation || defense.location || attackResult?.hitLocation || randomHitLocation();

  const matrix = await awardCompetencyMatrix({
    atkTotal, defTotal,
    attacker: attackerActor,
    defender: targetToken.actor,
    atkPolicy, defPolicy,
    attackMeta: {
      key:  attackResult?.evo?.meta?.key,
      isManeuver: !!attackResult?.evo?.meta?.isManeuver,
      isRelic: !!attackResult?.evo?.meta?.isRelic || (attackResult?.evo?.type === "relic")
    },
    hitLoc: hitLocation,
    attackerLearned
  });

  // 4) Si no procede a daño, fin
  if (!matrix.proceedToDamage) {
    await CHAT(`<p><b>${attackerActor.name}</b> no consigue dañar a <b>${targetToken.name}</b>.</p>`, attackerActor);
    return;
  }

  // 4.1) Efectos sobre "golpe" (no dependen de daño neto)
  if (attackResult?.evo?.meta?.isManeuver && attackCtx?.maneuverDef?.effects) {
    await applyManeuverEffects({
      attacker: attackerActor,
      defender: targetToken.actor,
      maneuverDef: attackCtx.maneuverDef,
      attackTotal: atkTotal,
      trigger: "on_hit"
    });
  }

  // 5) Impacto vs Bloqueo
  const { impact, block } = await resolveImpactVsBlock({
    attackerActor, attackerToken, targetToken,
    attackCtx, attackResult, hitLocation
  });

  const net = Math.max(0, Number(impact||0) - Number(block||0));
  const locNice = ({
    head: "cabeza", chest: "torso", bracers: "brazos",
    legs: "piernas", boots: "pies"
  })[hitLocation] || hitLocation;

  if (net <= 0) {
    await CHAT(`⚔️ ${attackerActor.name} impacta a ${targetToken.name} en ${locNice}: <b>Impacto ${impact}</b> vs <b>Bloqueo ${block}</b> → <b>Sin daño</b>.`, attackerActor);
    return;
  }

  await CHAT(`⚔️ ${attackerActor.name} impacta a ${targetToken.name} en ${locNice}: <b>Impacto ${impact}</b> vs <b>Bloqueo ${block}</b> → <b>Daño Neto = ${net}</b>.`, attackerActor);

  // 6) Aplicar daño (por zona si tienes, o general)
  await applyDamageOrWound({ defenderToken: targetToken, amount: net, hitLocation: hitLocation });

  // 7) NUEVO: efectos de maniobra (derribado, empujar, etc.)
 if (attackResult?.evo?.meta?.isManeuver && attackCtx?.maneuverDef?.effects) {
   await applyManeuverEffects({
     attacker: attackerActor,
     defender: targetToken.actor,
     maneuverDef: attackCtx.maneuverDef,
     attackTotal: atkTotal
   });
 }
}

/* ======================================================
 * Tirada de defensa
 * ====================================================== */
async function requestDefenseRoll({ defender, defenderToken, attackerActor, attackCtx, attackResult }) {
  try {
    if (typeof rollDefense === "function") {
      const res = await rollDefense(defender, {
        flavor: "Defensa",
        mode: "ask",
        context: makeDefenseContext({ defender, defenderToken, attackerActor, attackCtx, attackResult }),
        opposed: true
      });
      return {
        success: !!res?.success,
        total: Number(res?.total ?? 0),
        evo: res?.evo ?? null,
        policy: res?.evo?.usedPolicy ?? "execution",
        hitLocation: res?.hitLocation || res?.location || res?.bodyPart || null
      };
    }
  } catch (e) { console.warn("TSDC | rollDefense no disponible/usable:", e); }

  // Motores alternos
  try {
    const engine = game?.transcendence?.rolls;
    if (engine?.defenseCheck) {
      const res = await engine.defenseCheck(defender, { flavor: "Defensa" });
      return {
        success: !!res?.success,
        total: Number(res?.total ?? 0),
        evo: res?.evo ?? null,
        policy: res?.evo?.usedPolicy ?? "execution",
        hitLocation: res?.hitLocation || res?.location || res?.bodyPart || null
      };
    }
    if (engine?.skillCheck) {
      const dc = deriveDefenseDC(attackCtx, attackResult) ?? 14;
      const res = await engine.skillCheck(defender, { skill: "evasion", dc, flavor: "Defensa (fallback)" });
      return {
        success: !!res?.success,
        total: Number(res?.total ?? 0),
        evo: res?.evo ?? null,
        policy: res?.evo?.usedPolicy ?? "execution",
        hitLocation: null
      };
    }
  } catch (e) { console.warn("TSDC | defense fallback error:", e); }

  // Último recurso manual
  const { DialogV2 } = foundry.applications.api;
  const ok = await DialogV2.confirm({
    window: { title: `Defensa de ${defender?.name ?? "—"}` },
    content: `<p>¿La defensa tuvo <b>éxito</b>?</p>`
  });
  return { success: !!ok, total: 0, evo: null, policy: "execution", hitLocation: null };
}

function makeDefenseContext({ defender, defenderToken, attackerActor, attackCtx, attackResult }) {
  return {
    ...attackCtx,
    attackerId: attackerActor?.id,
    defenderId: defender?.id,
    defenderTokenId: defenderToken?.id,
    attackTotal: Number(attackResult?.total ?? attackResult?.attack ?? 0),
    attackTags: attackResult?.tags ?? [],
    hitLocation: attackResult?.hitLocation ?? null
  };
}

function deriveDefenseDC(attackCtx, attackResult) {
  if (Number.isFinite(attackResult?.total)) return Math.max(10, Math.round(attackResult.total));
  return null;
}

/* ======================================================
 * Impacto vs Bloqueo (real → fallback)
 * ====================================================== */
async function resolveImpactVsBlock({ attackerActor, attackerToken, targetToken, attackCtx, attackResult, hitLocation }) {
  // 1) Impacto
  let impact = null;

  // Si el ataque ya dejó un valor de impacto listo
  if (Number.isFinite(attackResult?.impact)) {
    impact = Number(attackResult.impact);
  }

  // Intentar fórmula “real” a partir de meta
  if (impact == null) {
    // Deja que buildImpactFormula resuelva dado/grade/atributo según el arma
    const meta = attackResult?.evo?.meta || {};
    const isManeuver = !!meta.isManeuver;
    // Si es maniobra, el "key" es la maniobra — necesitamos la KEY del arma
    let atkKey = isManeuver ? (meta.weaponKey || null) : (meta.key || null);

    try {
      // Si por alguna razón no vino key, intenta arma equipada
      if (!atkKey) {
        const { getEquippedWeaponKey } = await import("../features/inventory/index.js");
        atkKey = getEquippedWeaponKey(attackerActor, "main");
      }
      const hintedAttr =
        attackCtx?.hints?.impactAttr ||
        attackCtx?.hints?.attackAttr || // en maniobras/abilities a veces viene aquí
        null;

      const impactDef = buildImpactFormula(attackerActor, { key: atkKey, die: meta.impactDie ?? null, grade: meta.impactGrade ?? null, attrKey: hintedAttr });
      const impactMsg = await rollImpact(attackerActor, impactDef);
      const impactRaw =
        impactMsg?.resultRoll?.total ??
        impactMsg?.total ??
        impactMsg?.roll?.total ??
        null;
      if (impactRaw != null) impact = Number(impactRaw);
    } catch (e) {
      console.warn("TSDC | build/roll impact error, using estimateImpact fallback:", e);
    }
  }

  // Fallback último si aún no hay impacto
  if (impact == null) {
    impact = await estimateImpact({ attackerActor, attackerToken, targetToken, attackCtx, attackResult, hitLocation });
  }

  // 2) Bloqueo por localización (real → fallback)
  let block = Number(await computeBlockingAt(targetToken.actor, hitLocation)) || null;

  if (block == null) {
    block = await estimateBlock({ defender: targetToken.actor, defenderToken: targetToken, hitLocation, attackResult });
  }

  return { impact, block };
}

async function estimateImpact({ attackerActor, attackerToken, targetToken, attackCtx, attackResult, hitLocation }) {
  try {
    if (game?.transcendence?.damage?.estimateImpact) {
      return await game.transcendence.damage.estimateImpact({
        attacker: attackerActor, target: targetToken.actor, hitLocation, context: attackCtx, attackResult
      });
    }
  } catch (e) { console.warn("TSDC | estimateImpact engine error:", e); }

  // Fallback simple: media de un d6 (3.5) redondeada + mod plano si lo tienes
  const flat = Number(attackerActor?.system?.mods?.impactFlat ?? 0);
  return Math.round(3.5 + flat);
}

async function estimateBlock({ defender, defenderToken, hitLocation, attackResult }) {
  // Si tu sheet ya guarda bloqueo por zona
  const zoneBlock = defender?.system?.mitigation?.armor?.[hitLocation]?.block
                 ?? defender?.system?.mitigation?.[hitLocation]?.block;
  if (Number.isFinite(zoneBlock)) return Number(zoneBlock);

  try {
    if (game?.transcendence?.damage?.estimateBlock) {
      return await game.transcendence.damage.estimateBlock({ defender, hitLocation, attackResult });
    }
  } catch (e) { console.warn("TSDC | estimateBlock engine error:", e); }

  // Fallback por tipo de armadura
  const t = inferArmorTypeAt(defender, hitLocation);
  if (String(t).includes("light"))  return 1;
  if (String(t).includes("medium")) return 2;
  if (String(t).includes("heavy"))  return 3;
  return 0;
}

/* ======================================================
 * Aplicar daño/herida
 * ====================================================== */
async function applyDamageOrWound({ defenderToken, amount, hitLocation }) {
  const actor = defenderToken?.actor; if (!actor) return;

  // Si tienes sistema de heridas por zona:
  try {
    if (game?.transcendence?.wounds?.applyWound) {
      await game.transcendence.wounds.applyWound(actor, { location: hitLocation, amount });
      await CHAT(`💥 <b>${actor.name}</b> sufre una <b>Herida</b> en <i>${hitLocation}</i> (${amount}).`, actor);
      return;
    }
  } catch (e) { console.warn("TSDC | applyWound hook error:", e); }

  // Por zona si existe, o general
  const pathByZone = zoneHealthPath(actor, hitLocation);
  if (pathByZone) {
    const current = Number(getDeep(actor.system, pathByZone) || 0);
    const next = Math.max(0, current - amount);
    await actor.update({ [`system.${pathByZone}`]: next });
    await CHAT(`🩸 <b>${actor.name}</b> pierde ${amount} PV en <i>${hitLocation}</i> (queda ${next}).`, actor);
  } else if (actor.system?.hp?.value != null) {
    const cur = Number(actor.system.hp.value || 0);
    const next = Math.max(0, cur - amount);
    await actor.update({ "system.hp.value": next });
    await CHAT(`🩸 <b>${actor.name}</b> pierde ${amount} PV (queda ${next}).`, actor);
  } else {
    await CHAT(`🩸 <b>${actor.name}</b> sufre ${amount} de daño en <i>${hitLocation}</i>.`, actor);
  }
}

function zoneHealthPath(actor, hitLocation) {
  const s = String(hitLocation||"").toLowerCase();
  if (actor?.system?.health?.parts) {
    if (s.includes("head") || s.includes("cabeza"))   return "health.parts.head.value";
    if (s.includes("arm")  || s.includes("brazo")
      || s.includes("bracer") || s.includes("bracers")) return "health.parts.arms.value";
    if (s.includes("leg")  || s.includes("pierna")
      || s.includes("boot") || s.includes("boots")
      || s.includes("pie")  || s.includes("pies"))      return "health.parts.legs.value";
    if (s.includes("chest") || s.includes("torso"))    return "health.parts.torso.value";
    return "health.parts.torso.value";
  }
  return null;
}

function getDeep(obj, path) {
  return path.split(".").reduce((a,k)=>a?.[k], obj);
}
