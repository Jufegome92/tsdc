// modules/atb/reactions.js
// Ventanas de Reacción + Ataque de Oportunidad (AO) integrados con Desgaste.
// No alteran el ATB programado: ejecutan con I0+E0+R0 y solo consumen 1 Desgaste.

import { rollAttack } from "../rolls/dispatcher.js";

const SCOPE = "tsdc";
const MELEE_RANGE_M = 1.0;

/** === Config bandos ===
 *  "byType"        → PJ (character) vs PNJ (creature)
 *  "byDisposition" → FRIENDLY/NEUTRAL/HOSTILE
 *  "everyone"      → todos pueden reaccionar ante todos (incluye PvP)
 */
const SIDE_MODE = "byType";
const INCLUDE_NEUTRAL_AS_BOTH = true;

/* ===== Utilidades de estado (flags de escena) ===== */
function _getSceneState() {
  return canvas.scene?.getFlag(SCOPE, "combatState") ?? { rx: {} };
}
async function _setSceneState(next) {
  await canvas.scene?.setFlag(SCOPE, "combatState", next);
}
function _rxFor(actorId) {
  const st = _getSceneState();
  st.rx ??= {};
  st.rx[actorId] ??= { windows: [] };
  return st.rx[actorId];
}

/* ===== Bando / lado ===== */
function isPlayerSide(t) {
  if (!t?.actor) return false;
  if (SIDE_MODE === "byType")  return t.actor.type === "character";
  if (SIDE_MODE === "byDisposition") {
    const d = t.document?.disposition;
    if (INCLUDE_NEUTRAL_AS_BOTH && d === CONST.TOKEN_DISPOSITIONS.NEUTRAL) return true;
    return d === CONST.TOKEN_DISPOSITIONS.FRIENDLY;
  }
  return true; // "everyone"
}
function isOppositeSide(a, b) {
  if (SIDE_MODE === "everyone") return true;
  if (SIDE_MODE === "byType")  return isPlayerSide(a) !== isPlayerSide(b);
  // byDisposition
  const ad = a.document?.disposition, bd = b.document?.disposition;
  if (INCLUDE_NEUTRAL_AS_BOTH && (ad === CONST.TOKEN_DISPOSITIONS.NEUTRAL || bd === CONST.TOKEN_DISPOSITIONS.NEUTRAL)) return true;
  return ad !== bd;
}

/* ===== Desgaste ===== */
function readWearState(actor) {
  const tenacity = Number(actor.system?.attributes?.tenacity ?? 0);
  const vigorLvl = Number(actor.system?.progression?.skills?.vigor?.level ?? 0);
  const stamina  = vigorLvl + tenacity;                 // Aguante
  const fatigue  = Number(actor.system?.states?.fatigue ?? 0);
  const wear     = Number(actor.system?.states?.wear ?? 0);
  const wearMax  = Math.max(0, stamina - fatigue);      // Límite = Aguante – Fatiga
  return { stamina, fatigue, wear, wearMax };
}
function canSpendWear(actor) {
  const { wear, wearMax } = readWearState(actor);
  return wear < wearMax;
}
async function spendWear(actor, n = 1) {
  const cur = Number(actor.system?.states?.wear ?? 0);
  await actor.update({ "system.states.wear": cur + Math.max(1, n) });
}

/* ===== Ventanas de reacción ===== */
export function openReactionWindow({ ownerToken, reason, expiresTick, payload }) {
  const st = _getSceneState();
  const rx = _rxFor(ownerToken.actor?.id ?? ownerToken.id);

  // limpia expiradas (mismo tick por defecto)
  const nowTick = game.combat?.round ?? 0;
  rx.windows = rx.windows.filter(w => (w.expiresTick ?? nowTick) >= nowTick);

  rx.windows.push({
    id: randomID(),
    reason,                                   // "leave-melee" | "fumble" | ...
    expiresTick: expiresTick ?? nowTick,      // por defecto, expira este tick
    payload                                   // ej: { provokerTokenId, meleeRangeM }
  });

  st.rx[ownerToken.actor?.id ?? ownerToken.id] = rx;
  return _setSceneState(st);
}

export async function clearAllReactionWindows() {
  const st = _getSceneState();
  st.rx = {};
  await _setSceneState(st);
}

/* ===== AO (Ataque de Oportunidad) ===== */
export async function performOpportunityAttack({ reactorToken, targetToken, weaponKey = null }) {
  if (!reactorToken?.actor || !targetToken?.actor) return false;

  if (!canSpendWear(reactorToken.actor)) {
    ui.notifications?.warn(`${reactorToken.name}: límite de Reacciones alcanzado (Desgaste).`);
    return false;
  }

  // I0+E0+R0: reaccionar no cambia el ATB programado
  await rollAttack(reactorToken.actor, {
    key: weaponKey ?? undefined,
    flavor: `Reacción • Ataque de Oportunidad contra ${targetToken.name}`,
    context: {
      phase: "attack",
      tags: ["reaction", "opportunity"],
      immediate: true
    }
  });

  await spendWear(reactorToken.actor, 1);
  ChatMessage.create({ content: `${reactorToken.name} ejecuta un Ataque de Oportunidad contra ${targetToken.name}.` });
  return true;
}

/** Consume una ventana leave-melee contra el provoker y ejecuta AO */
export async function tryReactOpportunity({ reactorToken, provokerToken }) {
  const actorId = reactorToken.actor?.id ?? reactorToken.id;
  const st = _getSceneState();
  const rx = st.rx?.[actorId];
  if (!rx || !rx.windows?.length) return false;

  const nowTick = game.combat?.round ?? 0;
  const idx = rx.windows.findIndex(w =>
    w.reason === "leave-melee" &&
    (w.expiresTick ?? nowTick) >= nowTick &&
    w.payload?.provokerTokenId === provokerToken.id
  );
  if (idx === -1) return false;

  await performOpportunityAttack({ reactorToken, targetToken: provokerToken });
  rx.windows.splice(idx, 1);
  await _setSceneState(st);
  return true;
}

/* ===== Gatillo opcional: fumble de ataque =====
 * Llama a esto cuando detectes fallo crítico del atacante.
 * Abre ventana de reacción para enemigos adyacentes al "fumbler".
 */
export async function triggerFumbleReactions({ fumblerToken }) {
  if (!fumblerToken) return;
  const adj = canvas.tokens.placeables.filter(t =>
    t.id !== fumblerToken.id &&
    t.actor &&
    isOppositeSide(t, fumblerToken) &&
    distanceM(t, fumblerToken) <= MELEE_RANGE_M
  );
  for (const reactor of adj) {
    await openReactionWindow({
      ownerToken: reactor,
      reason: "fumble",
      expiresTick: game.combat?.round ?? 0,
      payload: { provokerTokenId: fumblerToken.id, meleeRangeM: MELEE_RANGE_M }
    });
    // Si quieres que la IA PNJ reaccione sola, puedes intentar aquí:
    // await performOpportunityAttack({ reactorToken: reactor, targetToken: fumblerToken });
  }
}

/* ===== Helpers de distancia ===== */
function distanceM(a, b) {
  const ray = new Ray(a.center, b.center);
  const cells = canvas.grid.measureDistances([{ ray }], { gridSpaces: true })?.[0];
  const gridSize = canvas?.scene?.grid?.size || 100;
  const fallback = ray.distance / gridSize;
  const cellMeters = 1; // tu sistema: 1 casilla = 1 m
  return (Number.isFinite(cells) ? cells : fallback) * cellMeters;
}
