// modules/stealth/detection.js
// Sistema de Ocultación con tiradas bajo cuerda (Percepción vs Sigilo)
// Requiere: modules/perception/index.js (buildPerceptionPackage)
// Usa scene.flags.tsdc.detection para cachear resultados por par [observador→objetivo]

import { buildPerceptionPackage } from "../perception/index.js";
import { baseFromSpec } from "../features/specializations/index.js";

const SCOPE = "tsdc";

/** === Configuración rápida === */
const CHECK_COOLDOWN_MS = 600;           // anti-spam al mover
const USE_GLOBAL_REVEAL = true;          // si un observador detecta, des-oculta para todos
const WHISPER_GM_ALWAYS = true;          // siempre informa al GM del resultado
const ONLY_ACTIVE_PLAYERS = true;        // sólo jugadores conectados reciben whispers/pings

const SIDE_MODE = "byType"; 
// "byType" → PJ vs PNJ (actor.type: "character" vs "creature")
// "byDisposition" → por disposition del token (FRIENDLY/NEUTRAL/HOSTILE)
const INCLUDE_NEUTRAL_AS_BOTH = true; // si usas byDisposition y quieres que Neutral vea a todos

/** Cache de debounce {tokenId -> timeoutId} */
const _moveDebounce = new Map();


/** Helpers ================================================================ */

/** Saca owners-jugadores del token (quienes verían sus whispers/pings) */
function tokenOwners(token) {
  const users = game.users.filter(u => u.role >= CONST.USER_ROLES.PLAYER && (!ONLY_ACTIVE_PLAYERS || u.active));
  return users.filter(u => token.actor?.testUserPermission?.(u, "OWNER") || token.document?.testUserPermission?.(u, "OWNER"));
}

function gmIds() {
  return game.users.filter(u => u.isGM).map(u => u.id);
}

/** Lee/guarda estado detección por par obs→tgt en scene.flags.tsdc.detection */
function getDetectionState(observerId, targetId) {
  const root = canvas.scene?.getFlag(SCOPE, "detection") ?? {};
  return foundry.utils.getProperty(root, `${observerId}.${targetId}`) ?? null; // {state, ts}
}

async function setDetectionState(observerId, targetId, data) {
  const root = canvas.scene?.getFlag(SCOPE, "detection") ?? {};
  const clone = foundry.utils.duplicate(root);
  const cur   = getDetectionState(observerId, targetId) ?? {};
  foundry.utils.setProperty(clone, `${observerId}.${targetId}`, { ...cur, ...data, ts: Date.now() });
  await canvas.scene?.setFlag(SCOPE, "detection", clone);
}

function isPlayerSide(t) {
  if (!t?.actor) return false;
  if (SIDE_MODE === "byType") {
    return t.actor.type === "character";
  } else {
    const d = t.document?.disposition;
    if (INCLUDE_NEUTRAL_AS_BOTH && d === CONST.TOKEN_DISPOSITIONS.NEUTRAL) return true;
    return d === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  }
}
function isNpcSide(t) {
  if (!t?.actor) return false;
  if (SIDE_MODE === "byType") {
    return t.actor.type === "creature";
  } else {
    const d = t.document?.disposition;
    if (INCLUDE_NEUTRAL_AS_BOTH && d === CONST.TOKEN_DISPOSITIONS.NEUTRAL) return true;
    return d === CONST.TOKEN_DISPOSITIONS.HOSTILE;
  }
}
function isOppositeSide(a, b) {
  if (SIDE_MODE === "byType") {
    const aIsP = isPlayerSide(a), bIsP = isPlayerSide(b);
    return aIsP !== bIsP;
  } else {
    // FRIENDLY vs HOSTILE (y quizá NEUTRAL ve a ambos si INCLUDE_NEUTRAL_AS_BOTH)
    const aD = a.document?.disposition;
    const bD = b.document?.disposition;
    if (INCLUDE_NEUTRAL_AS_BOTH && (aD === CONST.TOKEN_DISPOSITIONS.NEUTRAL || bD === CONST.TOKEN_DISPOSITIONS.NEUTRAL)) {
      return true;
    }
    return aD !== bD;
  }
}

/** Resetea todos los pares donde targetId coincide (útil al “revelar” el oculto) */
async function clearDetectionForTarget(targetId) {
  const root = canvas.scene?.getFlag(SCOPE, "detection") ?? {};
  const clone = foundry.utils.duplicate(root);
  for (const obsId of Object.keys(clone)) {
    if (clone[obsId]?.[targetId]) delete clone[obsId][targetId];
    if (!Object.keys(clone[obsId] ?? {}).length) delete clone[obsId];
  }
  await canvas.scene?.setFlag(SCOPE, "detection", clone);
}

/** Roll silencioso de especialización; no manda mensajes al chat */
async function silentSpecRoll(actor, specKey) {
  const base = baseFromSpec(actor?.system?.attributes ?? {}, specKey) || 0;
  const roll = await (new Roll("1d10")).roll({async: true});
  return { total: base + (roll.total ?? 0), die: roll.total ?? 0, base };
}

/** ¿El observador podría ver al objetivo según el paquete de percepción? */
function canObserveByPackage(pkg) {
  const within = Number(pkg?.effective_detail_range_m ?? 0) >= Number(pkg?.distance_m ?? 0);
  const hasVis = !!pkg?.visibility?.hasLoS;
  return within && hasVis;
}

/** Core: corre chequeo para un token oculto contra todos los observadores válidos */
export async function checkStealthForHidden(hiddenToken, reason = "move") {
  try {
    if (!hiddenToken) return;
    const isHidden = hiddenToken.document?.getFlag(SCOPE,"concealment") === "hidden" || hiddenToken.document?.hidden === true;
    if (!isHidden) return;

    // --- NUEVO: observadores = lado opuesto, con actor y visibles ---
    const observers = canvas.tokens.placeables.filter(t =>
      t.id !== hiddenToken.id &&
      !t.document?.hidden &&
      t.actor &&
      isOppositeSide(t, hiddenToken) // <-- aquí está la separación PJ vs PNJ
    );

    let someoneSpotted = false;

    for (const obs of observers) {
      const pkg = await buildPerceptionPackage({ actorToken: obs, targetToken: hiddenToken });
      if (!canObserveByPackage(pkg)) {
        await setDetectionState(obs.id, hiddenToken.id, { state: "no-los" });
        continue;
      }

      const obsRoll = await silentSpecRoll(obs.actor, "percepción");
      const hidRoll = await silentSpecRoll(hiddenToken.actor, "sigilo");

      const spotted = obsRoll.total >= hidRoll.total;
      await setDetectionState(obs.id, hiddenToken.id, { state: spotted ? "spotted" : "missed", obs: obsRoll, hid: hidRoll });

      if (WHISPER_GM_ALWAYS) {
        const txt = `[Ocultación:${reason}] ${obs.name} (Percepción ${obsRoll.total} = ${obsRoll.base}+d${obsRoll.die}) vs ${hiddenToken.name} (Sigilo ${hidRoll.total} = ${hidRoll.base}+d${hidRoll.die}) → ${spotted ? "DETECTA" : "no detecta"}`;
        ChatMessage.create({ content: txt, whisper: gmIds() });
      }

      if (spotted) {
        someoneSpotted = true;
        // Dueños si hay; si no, GM (esto cubre PNJ)
        const ownerIds = tokenOwners(obs).map(u => u.id);
        const recipients = ownerIds.length ? ownerIds : gmIds();
        ChatMessage.create({ content: `${obs.name} ha detectado actividad oculta cerca de ${hiddenToken.name}.`, whisper: recipients });

        if (USE_GLOBAL_REVEAL) {
          await hiddenToken.document.update({ hidden: false });
          try { await hiddenToken.document.unsetFlag(SCOPE, "concealment"); } catch {}
          await clearDetectionForTarget(hiddenToken.id);
          break;
        }
      }
    }

    return someoneSpotted;
  } catch (e) {
    console.error("TSDC | checkStealthForHidden failed", e);
  }
}

/** Hook: cuando se mueve un token, si está oculto, gatilla chequeo con debounce */
async function onUpdateToken(doc, change) {
  try {
    if (!("x" in change || "y" in change)) return;
    const token = canvas.tokens?.get(doc.id);
    if (!token) return;
    const isHidden = token.document?.getFlag(SCOPE,"concealment") === "hidden" || token.document?.hidden === true;
    if (!isHidden) return;

    const pending = _moveDebounce.get(doc.id);
    if (pending) clearTimeout(pending);
    const t = setTimeout(() => checkStealthForHidden(token, "move"), CHECK_COOLDOWN_MS);
    _moveDebounce.set(doc.id, t);
  } catch (e) {
    console.error("TSDC | onUpdateToken (stealth) failed", e);
  }
}

/** API opcional para que tu ATB gatille al “actuar” */
export async function checkStealthOnAction(actorToken) {
  const isHidden = actorToken?.document?.getFlag?.(SCOPE,"concealment") === "hidden" || actorToken?.document?.hidden === true;
  if (!isHidden) return;
  await checkStealthForHidden(actorToken, "action");
}

/** Registro de hooks */
export function registerStealthDetection() {
  Hooks.on("updateToken", onUpdateToken);
  console.log("[TSDC:Stealth] detection hooks registrados");
}
