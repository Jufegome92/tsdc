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

function cellsEveryOther(a, b) {
  const gs = canvas?.scene?.grid?.size || 100;
  const ax = a.center?.x ?? a.x, ay = a.center?.y ?? a.y;
  const bx = b.center?.x ?? b.x, by = b.center?.y ?? b.y;

  // Diferencias en casillas (redondeadas al centro de celda)
  const dx = Math.abs(Math.round((bx - ax) / gs));
  const dy = Math.abs(Math.round((by - ay) / gs));

  const diag = Math.min(dx, dy);               // pasos diagonales
  const straight = Math.max(dx, dy) - diag;    // pasos rectos
  // 1–2–1–2…  ≡ diag + floor(diag/2) extra por los pares
  return straight + diag + Math.floor(diag / 2);
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
export function canSpendWear(actor) {
  const { wear, wearMax } = readWearState(actor);
  return wear < wearMax;
}
export async function spendWear(actor, n = 1) {
  const cur = Number(actor.system?.states?.wear ?? 0);
  await actor.update({ "system.states.wear": cur + Math.max(1, n) });
}

/* ===== Ventanas de reacción ===== */
export function openReactionWindow({ ownerToken, reason, expiresTick, payload }) {
  // Check if the actor can actually react
  if (!canActorReact(ownerToken.actor)) {
    console.log(`TSDC | ${ownerToken.name} cannot react (no wear capacity or reaction actions available)`);
    return;
  }

  const st = _getSceneState();
  const rx = _rxFor(ownerToken.actor?.id ?? ownerToken.id);

  // limpia expiradas (mismo tick por defecto)
  const nowTick = game.combat?.round ?? 0;
  rx.windows = rx.windows.filter(w => (w.expiresTick ?? nowTick) >= nowTick);

  rx.windows.push({
    id: foundry.utils.randomID(),
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

/** Reset wear for all actors when combat ends */
export async function resetAllWear() {
  if (!game.combat) return;

  for (const combatant of game.combat.combatants) {
    if (!combatant.actor) continue;

    const currentWear = Number(combatant.actor.system?.states?.wear ?? 0);
    if (currentWear > 0) {
      await combatant.actor.update({ "system.states.wear": 0 });
      console.log(`TSDC | Reset wear for ${combatant.actor.name}: ${currentWear} → 0`);
    }
  }
}

/** Check if an actor can react (has wear capacity and available reaction actions) */
export function canActorReact(actor) {
  if (!canSpendWear(actor)) return false;

  // Check if actor has any available reaction actions
  return hasAvailableReactionActions(actor);
}

/** Check if an actor has any reaction-type actions available */
function hasAvailableReactionActions(actor) {
  // Check aptitudes with reaction type
  const aptitudes = actor?.system?.progression?.aptitudes || {};
  const hasReactionAptitudes = Object.keys(aptitudes).some(key => {
    if (!aptitudes[key]?.known) return false;

    // Import aptitude data to check type
    try {
      // This is synchronous access - we should cache this data
      return game.tsdc?.aptitudes?.[key]?.type === "reaction";
    } catch {
      return false;
    }
  });

  if (hasReactionAptitudes) return true;

  // Check maneuvers with reaction type
  const maneuvers = actor?.system?.progression?.maneuvers || {};
  const hasReactionManeuvers = Object.keys(maneuvers).some(key => {
    if (Number(maneuvers[key]?.rank || 0) === 0) return false;

    try {
      return game.tsdc?.maneuvers?.[key]?.type === "reaction";
    } catch {
      return false;
    }
  });

  if (hasReactionManeuvers) return true;

  // Check relic powers with reaction type
  const relics = actor?.system?.progression?.relics || {};
  const hasReactionRelics = Object.keys(relics).some(key => {
    if (Number(relics[key]?.rank || 0) === 0) return false;

    try {
      return game.tsdc?.relics?.[key]?.type === "reaction";
    } catch {
      return false;
    }
  });

  if (hasReactionRelics) return true;

  // Check base reactions (like opportunity attacks)
  // All actors can potentially make opportunity attacks if they have melee weapons
  const weapons = actor?.system?.progression?.weapons || {};
  const hasMeleeWeapons = Object.keys(weapons).some(key => {
    if (Number(weapons[key]?.rank || 0) === 0) return false;

    try {
      const weaponDef = game.tsdc?.weapons?.[key];
      return weaponDef && weaponDef.range <= MELEE_RANGE_M;
    } catch {
      return false;
    }
  });

  return hasMeleeWeapons;
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
      extraTags: ["reaction", "opportunity"],
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
  return cellsEveryOther(a, b) * 1;
}

/* ===== Hooks para reseteo de desgaste ===== */
Hooks.on("deleteCombat", async (combat) => {
  console.log("TSDC | Combat deleted, resetting wear for all participants");
  await resetAllWear();
});

Hooks.on("combatEnd", async (combat) => {
  console.log("TSDC | Combat ended, resetting wear for all participants");
  await resetAllWear();
});
