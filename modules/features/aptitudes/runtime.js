// modules/features/aptitudes/runtime.js
// Bridge between generic ATB logic and aptitude-specific handlers/state.

import { APTITUDES } from "./data.js";
import {
  getActionHandler,
  getReactionHandler,
  ensurePassiveHandlers,
  applyAptitudeRiskFailure,
  finalizeAptitudeEffect
} from "./handlers.js";
import {
  listAptitudeEffects,
  getAptitudeEffect,
  setAptitudeEffect,
  consumeAptitudeEffect,
  getPendingEvaluation,
  clearPendingEvaluation
} from "./state.js";

export async function runAptitudeAction({
  actor,
  token,
  aptitudeKey,
  ability,
  rank,
  pick,
  meta,
  performDefault
}) {
  const handler = getActionHandler(aptitudeKey);
  if (!handler) {
    if (typeof performDefault === "function") {
      await performDefault({ actor, token, pick, meta });
    }
    return true;
  }

  const context = {
    actor,
    token,
    aptitudeKey,
    ability,
    rank,
    pick,
    meta,
    performDefault
  };
  const result = await handler(context);
  if (result === false) return false;
  return result ?? true;
}

export async function runAptitudeReaction({ actor, token, aptitudeKey, provokerToken }) {
  const handler = getReactionHandler(aptitudeKey);
  if (!handler) return true;

  const abilityNode = actor?.system?.progression?.aptitudes?.[aptitudeKey] ?? {};
  const rank = Number(abilityNode.rank || 0);
  const context = { actor, token, aptitudeKey, provokerToken, rank };
  const result = await handler(context);
  return result ?? true;
}

export function registerAptitudeHooks() {
  ensurePassiveHandlers();
}

export function getActorAptitudeEffects(actor) {
  return listAptitudeEffects(actor);
}

export function consumeActorAptitudeEffect(actor, key) {
  return consumeAptitudeEffect(actor, key);
}

export function peekActorAptitudeEffect(actor, key) {
  return getAptitudeEffect(actor, key);
}

export async function handleAptitudeEvaluation({ actor, messageId, success, dc, totalUsed }) {
  console.log("🔍 handleAptitudeEvaluation iniciado:", {
    actorName: actor?.name,
    messageId,
    success,
    dc,
    totalUsed
  });

  if (!actor || !messageId) {
    console.warn("❌ Faltan datos: actor o messageId");
    return;
  }

  // Debug: verificar flags antes de getPendingEvaluation
  console.log("🔍 Pre-getPendingEvaluation check:", {
    actorId: actor.id,
    messageId,
    directFlagAccess: actor.getFlag("tsdc", "aptitudeState"),
    allFlags: actor.flags?.tsdc || {}
  });

  const pending = getPendingEvaluation(actor, messageId);
  console.log("📋 Evaluación pendiente encontrada:", pending);

  if (!pending) {
    console.warn("❌ No se encontró evaluación pendiente para messageId:", messageId);
    // NO retornar aquí - continuar para emitir el hook aunque no haya datos pendientes
  }

  try {
    // Solo ejecutar lógica de aptitudes si hay datos pendientes
    if (pending) {
      const aptitudeKey = pending.aptitudeKey;
      if (!success) {
        if (pending.check === "margin" && Number.isFinite(pending.threshold)) {
          const margin = Number(dc || 0) - Number(totalUsed || 0);
          if (margin >= Number(pending.threshold)) {
            await applyAptitudeRiskFailure(actor, pending);
          }
        } else if (pending.onFailureImmediate) {
          await applyAptitudeRiskFailure(actor, pending);
        }
        if (pending.clearEffectOnFailure && aptitudeKey) {
          await consumeAptitudeEffect(actor, aptitudeKey);
        }
      } else if (pending.onSuccess) {
        if (pending.onSuccess.finalizeEffect && aptitudeKey) {
          await finalizeAptitudeEffect(actor, aptitudeKey);
        }
        if (pending.onSuccess.setEffect && aptitudeKey) {
          await setAptitudeEffect(actor, aptitudeKey, pending.onSuccess.setEffect);
        }
      }
    }
  } finally {
    // SIEMPRE emitir hook para evaluaciones de especialización personalizadas
    // Esto permite que sistemas como dual wield funcionen independientemente del sistema de aptitudes
    console.log("🔥 EMITIENDO HOOK aptitude-evaluation-completed (siempre):", {
      messageId,
      actorName: actor?.name,
      success,
      totalUsed,
      dc,
      pending: pending?.meta || pending
    });

    if (typeof Hooks !== "undefined") {
      Hooks.call("aptitude-evaluation-completed", {
        messageId,
        actor,
        success,
        totalUsed,
        dc,
        pending
      });
    }

    await clearPendingEvaluation(actor, messageId);
  }
}

export async function markAptitudeEffect(actor, key, data) {
  await setAptitudeEffect(actor, key, data);
}
