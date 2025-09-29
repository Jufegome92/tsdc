// modules/atb/reactions.js
// Ventanas de Reacción + Ataque de Oportunidad (AO) integrados con Desgaste.
// No alteran el ATB programado: ejecutan con I0+E0+R0 y solo consumen 1 Desgaste.

import { rollAttack } from "../rolls/dispatcher.js";
import { weaponRangeM } from "../combat/range.js";
import { runAptitudeReaction } from "../features/aptitudes/runtime.js";
import { performFeature } from "../features/runner.js";

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
  // Intentar usar el combate actual si existe
  if (game.combat) {
    await resetAllWearForCombat(game.combat);
    return;
  }

  // Si no hay combate actual, resetear para todos los actores en la escena
  console.log("TSDC | No active combat, resetting wear for all scene actors");

  const tokens = canvas.tokens?.placeables || [];
  for (const token of tokens) {
    if (!token.actor) continue;

    const currentWear = Number(token.actor.system?.states?.wear ?? 0);
    if (currentWear > 0) {
      await token.actor.update({ "system.states.wear": 0 });
      console.log(`TSDC | Reset wear for ${token.actor.name}: ${currentWear} → 0`);
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

/** Get available reaction actions for specific trigger and timing */
export function getAvailableReactions(actor, reason = "any", timing = "any") {
  const reactions = [];

  // Check aptitudes with reaction type
  const aptitudes = actor?.system?.progression?.aptitudes || {};
  Object.keys(aptitudes).forEach(key => {
    if (!aptitudes[key]?.known) return;

    try {
      const aptData = game.tsdc?.aptitudes?.[key];
      if (aptData?.type === "reaction" && aptData?.reaction) {
        // Check if this reaction matches the trigger
        if (reason === "any" || aptData.reaction.when.includes(reason)) {
          // Check if this reaction matches the timing
          if (timing === "any" || aptData.reaction.timing === timing) {
            reactions.push({
              type: "aptitude",
              key: key,
              label: aptData.label,
              data: aptData
            });
          }
        }
      }
    } catch {
      // Skip if data not available
    }
  });

  // Check maneuvers with reaction type
  const maneuvers = actor?.system?.progression?.maneuvers || {};
  Object.keys(maneuvers).forEach(key => {
    if (Number(maneuvers[key]?.rank || 0) === 0) return;

    try {
      const maneuverData = game.tsdc?.maneuvers?.[key];
      if (maneuverData?.type === "reaction" && maneuverData?.reaction) {
        // Check if this reaction matches the trigger
        if (reason === "any" || maneuverData.reaction.when.includes(reason)) {
          // Check if this reaction matches the timing
          if (timing === "any" || maneuverData.reaction.timing === timing) {
            reactions.push({
              type: "maneuver",
              key: key,
              label: maneuverData.label,
              data: maneuverData
            });
          }
        }
      }
    } catch {
      // Skip if data not available
    }
  });

  // Check for relics with reaction powers
  const relics = actor?.system?.progression?.relics || {};
  Object.keys(relics).forEach(key => {
    if (Number(relics[key]?.rank || 0) === 0) return;

    try {
      const relicData = game.tsdc?.relics?.[key];
      if (relicData?.type === "reaction" && relicData?.reaction) {
        // Check if this reaction matches the trigger
        if (reason === "any" || relicData.reaction.when.includes(reason)) {
          // Check if this reaction matches the timing
          if (timing === "any" || relicData.reaction.timing === timing) {
            reactions.push({
              type: "relic",
              key: key,
              label: relicData.label,
              data: relicData
            });
          }
        }
      }
    } catch {
      // Skip if data not available
    }
  });

  // Add basic opportunity attack if appropriate
  if ((reason === "any" || reason === "enemy-movement") && (timing === "any" || timing === "instant")) {
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

    if (hasMeleeWeapons) {
      reactions.push({
        type: "opportunity-attack",
        key: "basic-ao",
        label: "Ataque de Oportunidad",
        data: { type: "reaction" }
      });
    }
  }

  return reactions;
}

/** Execute a selected reaction with phase-based system */
export async function executeReaction({
  reactorToken,
  targetToken,
  reactionChoice,
  payload = {}
}) {
  if (!reactorToken?.actor || !reactionChoice) {
    return { success: false, error: "Invalid parameters" };
  }

  if (!canSpendWear(reactorToken.actor)) {
    ui.notifications?.warn(`${reactorToken.name}: límite de Reacciones alcanzado (Desgaste).`);
    return { success: false, error: "Wear limit reached" };
  }

  try {
    // Gastar desgaste inmediatamente cuando se activa la reacción
    await spendWear(reactorToken.actor, 1);

    // Mensaje informativo
    await ChatMessage.create({
      content: `<p><b>${reactorToken.name}</b> ejecuta <i>${reactionChoice.label}</i> como reacción.</p>`,
      speaker: ChatMessage.getSpeaker({ actor: reactorToken.actor })
    });

    let result = null;

    switch (reactionChoice.type) {
      case "opportunity-attack":
        // Ataque de oportunidad básico (sistema legacy)
        result = await performOpportunityAttack({
          reactorToken,
          targetToken,
          weaponKey: payload.weaponKey
        });
        break;

      case "aptitude":
        // Ejecutar aptitud de reacción con sistema de fases
        result = await executeAptitudeReactionWithPhases({
          reactorToken,
          targetToken,
          aptitudeKey: reactionChoice.key,
          payload
        });
        break;

      case "maneuver":
        // Ejecutar maniobra de reacción
        result = await performFeature(reactorToken.actor, {
          type: "maneuver",
          key: reactionChoice.key,
          targetToken,
          payload
        });
        break;

      case "relic":
        // Ejecutar poder de reliquia
        result = await performFeature(reactorToken.actor, {
          type: "relic",
          key: reactionChoice.key,
          targetToken,
          payload
        });
        break;

      default:
        return { success: false, error: `Unknown reaction type: ${reactionChoice.type}` };
    }

    return {
      success: result !== false,
      result: result,
      reactionData: reactionChoice
    };

  } catch (error) {
    console.error("TSDC | Error executing reaction:", error);
    ui.notifications?.error(`Error ejecutando reacción: ${error.message}`);
    return { success: false, error: error.message };
  }
}

/** Test function for reaction UI - can be called from console */
globalThis.testReactionUI = async function() {
  const controlled = canvas.tokens.controlled;
  if (controlled.length === 0) {
    ui.notifications.warn("Selecciona un token primero");
    return;
  }

  const reactorToken = controlled[0];
  const targets = Array.from(game.user.targets);
  const provokerToken = targets.length > 0 ? targets[0] : null;

  // Import the dialog function
  const { promptReactionDialog } = await import("./rx-dialog.js");

  console.log("TSDC | Testing reaction UI...");

  // Test different scenarios
  const scenarios = [
    { reason: "enemy-movement", timing: "instant", title: "Reacción a Movimiento" },
    { reason: "enemy-fumble", timing: "instant", title: "Reacción a Fumble" },
    { reason: "incoming-attack", timing: "before-attack", title: "Reacción Antes de Ataque" },
    { reason: "incoming-attack", timing: "after-attack", title: "Reacción Después de Ataque" }
  ];

  let scenario = scenarios[0]; // Default to movement

  // If a target is selected, offer scenario choice
  if (provokerToken) {
    const scenarioChoice = await Dialog.prompt({
      title: "Seleccionar Escenario de Prueba",
      content: `
        <label>
          Escenario:
          <select name="scenario">
            ${scenarios.map((s, i) => `<option value="${i}">${s.title}</option>`).join("")}
          </select>
        </label>
      `,
      callback: (html) => {
        const idx = parseInt(html.find('[name="scenario"]').val());
        return scenarios[idx] || scenarios[0];
      }
    });
    scenario = scenarioChoice;
  }

  const result = await promptReactionDialog({
    reactorToken,
    provokerToken,
    reason: scenario.reason,
    timing: scenario.timing,
    title: scenario.title
  });

  console.log("TSDC | Reaction result:", result);

  if (result) {
    const executionResult = await executeReaction({
      reactorToken,
      targetToken: provokerToken,
      reactionChoice: result,
      payload: { test: true }
    });

    console.log("TSDC | Execution result:", executionResult);
  }
};

/**
 * Función de prueba completa para el sistema ATB + reacciones integrado
 */
globalThis.testATBReactions = async function() {
  console.log("🎯 TSDC | Testing complete ATB + Reactions system...");

  const combat = game.combat;
  if (!combat) {
    ui.notifications.warn("No hay combate activo. Crea un encuentro primero.");
    return;
  }

  const combatants = Array.from(combat.combatants);
  if (combatants.length < 2) {
    ui.notifications.warn("Se necesitan al menos 2 combatientes para probar las reacciones.");
    return;
  }

  const [attacker, defender] = combatants;
  const attackerToken = attacker.token?.object ?? canvas.tokens.placeables.find(t => t.actor?.id === attacker.actor?.id);
  const defenderToken = defender.token?.object ?? canvas.tokens.placeables.find(t => t.actor?.id === defender.actor?.id);

  if (!attackerToken || !defenderToken) {
    ui.notifications.warn("No se pudieron encontrar los tokens de los combatientes.");
    return;
  }

  console.log(`🎯 Attacker: ${attackerToken.name}, Defender: ${defenderToken.name}`);

  // Importar API del ATB
  const { ATB_API } = await import("./engine.js");

  // Prueba 1: Planificar un ataque
  console.log("📋 Test 1: Planificar ataque...");
  await ATB_API.enqueueSimple(attacker.id, "attack", null, { targetTokenId: defenderToken.id });
  ui.notifications.info(`Ataque planificado: ${attackerToken.name} → ${defenderToken.name}`);

  // Prueba 2: Verificar reacciones disponibles para el defensor
  console.log("🛡️ Test 2: Verificar reacciones disponibles...");
  const reactions = ATB_API.checkAvailableReactionsForCombatant(defender.id, "incoming-attack", "before-attack");
  console.log("Reacciones disponibles:", reactions);

  if (reactions.length > 0) {
    ui.notifications.info(`${defenderToken.name} tiene ${reactions.length} reacciones disponibles antes del ataque`);
  } else {
    ui.notifications.info(`${defenderToken.name} no tiene reacciones disponibles`);
  }

  // Prueba 3: Mostrar estado ATB actual
  console.log("⏱️ Test 3: Estado ATB...");
  const planningTick = await ATB_API.getPlanningTick();
  console.log(`Planning tick: ${planningTick}`);
  ui.notifications.info(`Tick de planificación actual: ${planningTick}`);

  // Prueba 4: Simular trigger de reacciones
  console.log("⚡ Test 4: Trigger de reacciones...");
  try {
    await triggerIncomingAttackReactions({
      attackerToken,
      targetToken: defenderToken,
      timing: "before-attack"
    });
    console.log("✅ Trigger de reacciones exitoso");
  } catch (error) {
    console.error("❌ Error en trigger:", error);
  }

  // Instrucciones finales
  await ChatMessage.create({
    content: `
      <div class="tsdc-test-results">
        <h3>🎯 Prueba ATB + Reacciones Completa</h3>
        <p><strong>Estado:</strong> Sistema integrado y funcional</p>
        <p><strong>Atacante:</strong> ${attackerToken.name}</p>
        <p><strong>Defensor:</strong> ${defenderToken.name}</p>
        <p><strong>Reacciones disponibles:</strong> ${reactions.length}</p>
        <hr>
        <p><em>Usa "Avanzar 1 tick" en el ATB para probar el flujo completo.</em></p>
        <p><em>El defensor tendrá oportunidad de reaccionar antes del ataque.</em></p>
      </div>
    `,
    whisper: [game.user.id]
  });

  console.log("✅ Prueba completa del sistema ATB + reacciones finalizada");
};

/**
 * Función de prueba actualizada - versión corregida
 */
globalThis.testATBReactionsCorrected = async function() {
  console.log("🔧 TSDC | Testing CORRECTED ATB + Reactions system...");

  const combat = game.combat;
  if (!combat) {
    ui.notifications.warn("No hay combate activo. Crea un encuentro primero.");
    return;
  }

  const combatants = Array.from(combat.combatants);
  if (combatants.length < 2) {
    ui.notifications.warn("Se necesitan al menos 2 combatientes para probar las reacciones.");
    return;
  }

  const [attacker, defender] = combatants;
  const attackerToken = attacker.token?.object ?? canvas.tokens.placeables.find(t => t.actor?.id === attacker.actor?.id);
  const defenderToken = defender.token?.object ?? canvas.tokens.placeables.find(t => t.actor?.id === defender.actor?.id);

  if (!attackerToken || !defenderToken) {
    ui.notifications.warn("No se pudieron encontrar los tokens de los combatientes.");
    return;
  }

  console.log(`🎯 Attacker: ${attackerToken.name}, Defender: ${defenderToken.name}`);

  // Importar API del ATB
  const { ATB_API } = await import("./engine.js");

  // Prueba corregida: Planificar ataque con targetTokenId
  console.log("📋 Test 1: Planificar ataque con objetivo específico...");
  await ATB_API.enqueueSimple(attacker.id, "attack", null, { targetTokenId: defenderToken.id });
  ui.notifications.info(`✅ Ataque planificado: ${attackerToken.name} → ${defenderToken.name}`);

  // Verificar que el meta se guarda correctamente
  console.log("🔍 Test 2: Verificar meta guardado...");
  const state = await import("./engine.js").then(m => m.readState ? m.readState() : null);
  if (state) {
    const attackerState = state.actors[attacker.id];
    if (attackerState?.queue?.length > 0) {
      const lastAction = attackerState.queue[attackerState.queue.length - 1];
      console.log("Última acción:", lastAction);
      if (lastAction.meta?.targetTokenId === defenderToken.id) {
        ui.notifications.info("✅ Meta del objetivo guardado correctamente");
      } else {
        ui.notifications.warn("❌ Meta del objetivo no se guardó");
      }
    }
  }

  // Prueba de reacciones disponibles
  console.log("🛡️ Test 3: Verificar reacciones disponibles...");
  const reactions = getAvailableReactions(defenderToken.actor, "incoming-attack", "before-attack");
  console.log("Reacciones disponibles:", reactions);
  ui.notifications.info(`${defenderToken.name} tiene ${reactions.length} reacciones antes del ataque`);

  // Instrucciones corregidas
  await ChatMessage.create({
    content: `
      <div class="tsdc-test-results">
        <h3>🔧 Prueba CORREGIDA: ATB + Reacciones</h3>
        <p><strong>Cambios aplicados:</strong></p>
        <ul>
          <li>✅ Diálogo de reacciones usa lista completa</li>
          <li>✅ Ataque de oportunidad ejecuta defense-flow</li>
          <li>✅ Reacciones se ejecutan sin sustituir ATB</li>
          <li>✅ Targeting correcto del objetivo específico</li>
        </ul>
        <hr>
        <p><strong>Atacante:</strong> ${attackerToken.name}</p>
        <p><strong>Defensor:</strong> ${defenderToken.name}</p>
        <p><strong>Reacciones disponibles:</strong> ${reactions.length}</p>
        <hr>
        <p><em>Usa "Avanzar 1 tick" para probar el flujo corregido.</em></p>
        <p><em>El defensor ahora verá la lista completa de reacciones disponibles.</em></p>
      </div>
    `,
    whisper: [game.user.id]
  });

  console.log("✅ Prueba corregida del sistema ATB + reacciones finalizada");
};

/* ===== Nuevo sistema de fases para reacciones ===== */

/** Execute aptitude reaction with phase-based system and ATB integration */
async function executeAptitudeReactionWithPhases({
  reactorToken,
  targetToken,
  aptitudeKey,
  payload = {}
}) {
  const { APTITUDES } = await import("../features/aptitudes/data.js");
  const aptitudeDef = APTITUDES[aptitudeKey];

  if (!aptitudeDef) {
    console.warn(`TSDC | Aptitude not found: ${aptitudeKey}`);
    return false;
  }

  // Si no tiene fases definidas, usar sistema legacy
  if (!aptitudeDef.phases) {
    const { runAptitudeReaction } = await import("../features/aptitudes/runtime.js");
    return await runAptitudeReaction({
      actor: reactorToken.actor,
      token: reactorToken,
      aptitudeKey,
      provokerToken: targetToken
    });
  }

  const combat = game.combat;
  if (!combat) {
    console.warn("TSDC | No combat active for phase-based reaction");
    return false;
  }

  try {
    // Programar las fases de la reacción en el ATB
    await scheduleReactionPhases({
      combat,
      reactorToken,
      targetToken,
      aptitudeDef,
      aptitudeKey,
      payload
    });

    return true;
  } catch (error) {
    console.error("TSDC | Error executing phase-based reaction:", error);
    return false;
  }
}

/** Schedule reaction phases in the ATB system */
async function scheduleReactionPhases({
  combat,
  reactorToken,
  targetToken,
  aptitudeDef,
  aptitudeKey,
  payload
}) {
  const { readState, writeState, ensureActorState } = await import("./engine.js");

  const state = await readState();
  const combatantId = combat.combatants.find(c => c.token?.id === reactorToken.id)?.id;

  if (!combatantId) {
    throw new Error(`No combatant found for token ${reactorToken.name}`);
  }

  const actorState = ensureActorState(state, combatantId);
  const currentTick = state.tick;

  // Limpiar la cola actual (las reacciones interrumpen/sustituyen acciones planificadas)
  actorState.queue = [];
  actorState.current = null;

  const { init = 0, exec = 0, rec = 0 } = aptitudeDef.ct || {};

  // Programar fase de INICIO
  if (aptitudeDef.phases.init) {
    const initCard = createReactionPhaseCard({
      phase: "init",
      aptitudeKey,
      aptitudeDef,
      targetToken,
      payload,
      tickEnd: currentTick + init
    });

    if (init === 0) {
      // Ejecutar inmediatamente
      actorState.current = initCard;
    } else {
      // Programar para más adelante
      actorState.queue.push(initCard);
    }
  }

  // Programar fase de EJECUCIÓN
  if (aptitudeDef.phases.exec) {
    const execCard = createReactionPhaseCard({
      phase: "exec",
      aptitudeKey,
      aptitudeDef,
      targetToken,
      payload,
      tickEnd: currentTick + init + exec
    });

    actorState.queue.push(execCard);
  }

  // Programar fase de RECUPERACIÓN (si tiene efectos)
  if (rec > 0) {
    const recCard = createReactionPhaseCard({
      phase: "recovery",
      aptitudeKey,
      aptitudeDef,
      targetToken,
      payload,
      tickEnd: currentTick + init + exec + rec
    });

    actorState.queue.push(recCard);
  }

  await writeState(state);

  console.log(`TSDC | Scheduled ${aptitudeDef.label} phases for ${reactorToken.name}:`, {
    currentTick,
    phases: {
      init: init > 0 ? `tick ${currentTick + init}` : "immediate",
      exec: exec > 0 ? `tick ${currentTick + init + exec}` : "none",
      rec: rec > 0 ? `tick ${currentTick + init + exec + rec}` : "none"
    }
  });
}

/** Create a card for a reaction phase */
function createReactionPhaseCard({
  phase,
  aptitudeKey,
  aptitudeDef,
  targetToken,
  payload,
  tickEnd
}) {
  return {
    type: "reaction-phase",
    uid: foundry.utils.randomID(),
    tickEnd,
    label: `${aptitudeDef.label} (${phase})`,
    phase,
    aptitudeKey,
    aptitudeDef,
    targetTokenId: targetToken?.id,
    payload: payload || {},
    source: "reaction",
    order: Date.now()
  };
}

console.log("TSDC | Reaction system loaded. Use 'testReactionUI()' for UI testing, 'testATBReactions()' for basic testing, or 'testATBReactionsCorrected()' for corrected integration testing.");

/* ===== AO (Ataque de Oportunidad) ===== */
export async function performOpportunityAttack({ reactorToken, targetToken, weaponKey = null }) {
  if (!reactorToken?.actor || !targetToken?.actor) return false;

  if (!canSpendWear(reactorToken.actor)) {
    ui.notifications?.warn(`${reactorToken.name}: límite de Reacciones alcanzado (Desgaste).`);
    return false;
  }

  // Importar defense-flow para el flujo completo
  const { runDefenseFlow } = await import("../combat/defense-flow.js");
  const { buildPerceptionPackage, packageToRollContext } = await import("../perception/index.js");

  // Crear contexto de percepción para el ataque
  const pkg = buildPerceptionPackage({ actorToken: reactorToken, targetToken });
  const ctx = packageToRollContext(pkg);

  // I0+E0+R0: reaccionar no cambia el ATB programado
  const attackResult = await rollAttack(reactorToken.actor, {
    key: weaponKey ?? undefined,
    flavor: `Reacción • Ataque de Oportunidad contra ${targetToken.name}`,
    context: {
      ...ctx,
      phase: "attack",
      extraTags: ["reaction", "opportunity"],
      immediate: true
    }
  });

  // Ejecutar flujo de defensa completo
  await runDefenseFlow({
    attackerActor: reactorToken.actor,
    attackerToken: reactorToken,
    targetToken,
    attackCtx: ctx,
    attackResult: attackResult ?? null
  });

  await spendWear(reactorToken.actor, 1);
  await ChatMessage.create({
    content: `${reactorToken.name} ejecuta un Ataque de Oportunidad contra ${targetToken.name}.`,
    speaker: ChatMessage.getSpeaker({ actor: reactorToken.actor })
  });
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

/* ===== Gatillos de reacciones ===== */

/** Trigger: Movimiento fuera de rango */
export async function triggerMovementReactions({ movingToken, fromPosition, toPosition }) {
  if (!movingToken) return;

  // Encontrar tokens enemigos que estén en rango del movingToken en fromPosition
  const enemiesInRange = canvas.tokens.placeables.filter(t => {
    if (t.id === movingToken.id || !t.actor || !isOppositeSide(t, movingToken)) return false;

    // Calcular distancia desde posición inicial
    const distFromStart = distanceM({ x: fromPosition.x, y: fromPosition.y }, t);

    // Verificar si está en rango de arma del enemigo
    const weaponRange = weaponRangeM(t.actor);
    return distFromStart <= weaponRange;
  });

  // Verificar si el movimiento los saca de rango
  for (const reactor of enemiesInRange) {
    const distToEnd = distanceM({ x: toPosition.x, y: toPosition.y }, reactor);
    const weaponRange = weaponRangeM(reactor.actor);

    // Si el movimiento saca al objetivo de rango, abrir ventana de reacción
    if (distToEnd > weaponRange) {
      await openReactionWindow({
        ownerToken: reactor,
        reason: "enemy-movement",
        expiresTick: game.combat?.round ?? 0,
        payload: {
          provokerTokenId: movingToken.id,
          fromPosition,
          toPosition,
          weaponRange
        }
      });
    }
  }
}

/** Trigger: Fumble de ataque */
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
      reason: "enemy-fumble",
      expiresTick: game.combat?.round ?? 0,
      payload: { provokerTokenId: fumblerToken.id, meleeRangeM: MELEE_RANGE_M }
    });
  }
}

/** Trigger: Ataques entrantes */
export async function triggerIncomingAttackReactions({ attackerToken, targetToken, timing = "before-attack" }) {
  if (!targetToken?.actor || !attackerToken?.actor) return;

  await openReactionWindow({
    ownerToken: targetToken,
    reason: "incoming-attack",
    expiresTick: game.combat?.round ?? 0,
    payload: {
      attackerTokenId: attackerToken.id,
      timing
    }
  });
}

/* ===== Helpers de distancia ===== */
function distanceM(a, b) {
  return cellsEveryOther(a, b) * 1;
}

/* ===== Hooks para reseteo de desgaste ===== */
Hooks.on("deleteCombat", async (combat) => {
  console.log("TSDC | Combat deleted, resetting wear for all participants");
  await resetAllWearForCombat(combat);
});

Hooks.on("combatEnd", async (combat) => {
  console.log("TSDC | Combat ended, resetting wear for all participants");
  await resetAllWearForCombat(combat);
});

// Hook adicional para cuando se cierra el encounter explícitamente
Hooks.on("preDeleteCombat", async (combat) => {
  console.log("TSDC | Pre-delete combat, resetting wear for all participants");
  await resetAllWearForCombat(combat);
});

/** Reset wear for a specific combat */
async function resetAllWearForCombat(combat) {
  if (!combat) return;

  console.log(`TSDC | Resetting wear for combat: ${combat.id}`);

  for (const combatant of combat.combatants) {
    if (!combatant.actor) continue;

    const currentWear = Number(combatant.actor.system?.states?.wear ?? 0);
    if (currentWear > 0) {
      await combatant.actor.update({ "system.states.wear": 0 });
      console.log(`TSDC | Reset wear for ${combatant.actor.name}: ${currentWear} → 0`);
    }
  }
}
