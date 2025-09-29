// modules/features/aptitudes/state.js
// Helper utilities to store transient aptitude effects and pending risk evaluations on actors.

const FLAG_SCOPE = "tsdc";
const FLAG_KEY = "aptitudeState";

function cloneState(actor) {
  const raw = actor?.getFlag?.(FLAG_SCOPE, FLAG_KEY) ?? {};
  try {
    return foundry.utils?.duplicate?.(raw) ?? structuredClone(raw);
  } catch (_) {
    return JSON.parse(JSON.stringify(raw));
  }
}

async function writeState(actor, next) {
  if (!actor) return;
  const clean = next && Object.keys(next).length ? next : null;

  console.log("🏗️ writeState called:", {
    actorId: actor.id,
    hasNext: !!next,
    nextKeys: next ? Object.keys(next) : [],
    willSetFlag: !!clean,
    flagScope: FLAG_SCOPE,
    flagKey: FLAG_KEY,
    cleanData: clean
  });

  if (clean) {
    console.log("🚀 Setting flag on actor...");
    await actor.setFlag(FLAG_SCOPE, FLAG_KEY, clean);
    console.log("✅ Flag set successfully");

    // Verificar inmediatamente si se guardó
    const verify = actor.getFlag(FLAG_SCOPE, FLAG_KEY);
    console.log("🔍 Verification read:", {
      saved: !!verify,
      verifyData: verify
    });

    // Verificar después de un pequeño delay para detectar limpiezas automáticas
    setTimeout(() => {
      const delayedVerify = actor.getFlag(FLAG_SCOPE, FLAG_KEY);
      console.log("⏰ Delayed verification (100ms):", {
        stillExists: !!delayedVerify,
        data: delayedVerify
      });
    }, 100);
  } else {
    console.log("🗑️ Unsetting flag...");
    await actor.unsetFlag(FLAG_SCOPE, FLAG_KEY);
    console.log("✅ Flag unset successfully");
  }
}

function ensureSection(state, section) {
  if (!state[section] || typeof state[section] !== "object") state[section] = {};
  return state[section];
}

export function getAptitudeEffect(actor, key) {
  if (!actor || !key) return null;
  const state = actor.getFlag?.(FLAG_SCOPE, FLAG_KEY);
  const effects = state?.effects;
  return effects?.[key] ?? null;
}

export function listAptitudeEffects(actor) {
  if (!actor) return {};
  const state = actor.getFlag?.(FLAG_SCOPE, FLAG_KEY);
  return state?.effects ?? {};
}

export async function setAptitudeEffect(actor, key, data) {
  if (!actor || !key) return;
  const state = cloneState(actor);
  const effects = ensureSection(state, "effects");
  effects[key] = data ?? {};
  await writeState(actor, state);
}

export async function consumeAptitudeEffect(actor, key) {
  if (!actor || !key) return null;
  const state = cloneState(actor);
  const effects = ensureSection(state, "effects");
  const data = effects[key] ?? null;
  if (key in effects) delete effects[key];
  const hasOther = Object.keys(effects).length > 0;
  if (!hasOther && (!state.pending || Object.keys(state.pending).length === 0)) {
    await writeState(actor, null);
  } else {
    await writeState(actor, state);
  }
  return data;
}

export function getPendingEvaluation(actor, messageId) {
  if (!actor || !messageId) return null;
  const state = actor.getFlag?.(FLAG_SCOPE, FLAG_KEY);
  const pending = state?.pending ?? {};

  console.log("🔍 getPendingEvaluation debug:", {
    actorId: actor.id,
    actorName: actor.name,
    actorType: actor.constructor.name,
    hasGetFlag: typeof actor.getFlag === 'function',
    messageId,
    flagScope: FLAG_SCOPE,
    flagKey: FLAG_KEY,
    hasState: !!state,
    state: state,
    pendingKeys: Object.keys(pending),
    requestedData: pending[messageId],
    allActorFlags: actor.flags || {}
  });

  return pending[messageId] ?? null;
}

export async function setPendingEvaluation(actor, messageId, data) {
  if (!actor || !messageId) return;
  console.log("💾 setPendingEvaluation called:", {
    actorId: actor.id,
    actorName: actor.name,
    actorType: actor.constructor.name,
    hasSetFlag: typeof actor.setFlag === 'function',
    messageId,
    data
  });

  const state = cloneState(actor);
  const pending = ensureSection(state, "pending");
  pending[messageId] = data ?? {};

  console.log("💾 About to write state:", {
    actorId: actor.id,
    messageId,
    pendingKeys: Object.keys(pending),
    stateToWrite: state
  });

  await writeState(actor, state);
  console.log("✅ setPendingEvaluation writeState completed");
}

export async function clearPendingEvaluation(actor, messageId) {
  if (!actor || !messageId) return;
  const state = cloneState(actor);
  const pending = ensureSection(state, "pending");
  if (messageId in pending) delete pending[messageId];
  const emptyPending = Object.keys(pending).length === 0;
  const emptyEffects = !state.effects || Object.keys(state.effects).length === 0;
  if (emptyPending && emptyEffects) {
    await writeState(actor, null);
  } else {
    await writeState(actor, state);
  }
}
