// modules/atb/engine.js
// Bucle ATB con CT=I+E+R. Planeación por tick y avance manual por el GM.

import { listSimpleActions, makeSpecializationAction, makeAbilityAction } from "./actions.js";
import { rotateModsOnSpawn, pruneOldCurrentTickMods } from "./mods.js";
import { MANEUVERS } from "../features/maneuvers/data.js";
import { RELIC_POWERS } from "../features/relics/data.js";
import { APTITUDES } from "../features/aptitudes/data.js";
import { getMonsterAbility } from "../features/abilities/data.js";
import { arePartsFunctional, describePartsStatus } from "../features/inventory/index.js";
import { listActive as listActiveAilments, resolveAilmentMechanics } from "../ailments/index.js";
import { CATALOG as AILMENT_CATALOG } from "../ailments/catalog.js";
import { executeReaction, getAvailableReactions } from "./reactions.js";
import { promptReactionDialog } from "./rx-dialog.js";

const { deepClone } = foundry.utils;

const FLAG_SCOPE = "tsdc";
const FLAG_KEY   = "atb";

/* ===== Estado ===== */

function defaultState() {
  return {
    tick: 0,
    running: false,          // ya no se usa, se deja por compat
    tickMs: 1000,
    placementCounter: 0,
    planningTick: 0,         // tick que están usando para planear
    qOrderCounter: 0,        // orden estable de llegada a la cola
    actors: {},              // [combatantId]: { queue:[desc], current:Card|null, mods:{} }
    execHold: []
  };
}

function isDriver() { return !!game.user?.isGM; }

function getCombat() { return game.combat ?? null; }
async function readState() {
  const c = getCombat();
  return c ? (await c.getFlag(FLAG_SCOPE, FLAG_KEY)) ?? defaultState() : defaultState();
}
async function writeState(state) {
  const c = getCombat(); if (!c) return;
  await c.setFlag(FLAG_SCOPE, FLAG_KEY, state);
}
function ensureActorState(state, combatantId) {
  state.actors[combatantId] ||= { queue: [], current: null, mods: {} };
  return state.actors[combatantId];
}

/* ===== Planeación: leer/poner tick de planeación ===== */

export async function getPlanningTick() {
  const c = getCombat(); if (!c) return 0;
  const s = (await c.getFlag(FLAG_SCOPE, FLAG_KEY)) ?? defaultState();
  return Number(s.planningTick || 0);
}

export async function setPlanningTick(n) {
  if (!game.user?.isGM) return ui.notifications?.warn("Solo el GM puede cambiar el tick de planeación.");
  const c = getCombat(); if (!c) return;
  const s = (await readState());
  s.planningTick = Math.max(0, Number(n||0));
  await writeState(s);
}

export async function adjustPlanningTick(delta) {
  const s = await readState();
  return setPlanningTick(Number(s.planningTick || 0) + Number(delta||0));
}

// 🔎 localizar combatiente por actor
function findCombatantIdByActorId(actorId) {
  const c = getCombat(); if (!c) return null;
  const ct = c.combatants.find(x => x?.actor?.id === actorId);
  return ct?.id ?? null;
}

export async function enqueueSimpleForActor(actorId, key, targetTick = null, meta = {}) {
  const ctid = findCombatantIdByActorId(actorId);
  if (!ctid) return ui.notifications?.warn("Ese actor no está en combate.");
  return enqueueSimple(ctid, key, targetTick, meta);
}
export async function enqueueSpecForActor(actorId, { specKey, category, CT, targetTick=null }) {
  const ctid = findCombatantIdByActorId(actorId);
  if (!ctid) return ui.notifications?.warn("Ese actor no está en combate.");
  return enqueueSpecialization(ctid, { specKey, category, CT, targetTick });
}
export async function enqueueManeuver(combatantId, key, targetTick = null) {
  const c = getCombat(); if (!c) return ui.notifications?.warn("No hay combate.");
  const ct = c.combatants.get(combatantId);
  if (!canPlanForCombatant(ct)) return ui.notifications?.warn("No puedes planear para ese combatiente.");

  const state = await readState();
  const t = (targetTick == null) ? Number(state.planningTick || state.tick || 0) : Number(targetTick);
  ensureActorState(state, combatantId).queue.push({
    kind: "maneuver", key, targetTick: t, qorder: ++state.qOrderCounter
  });
  await writeState(state);
}

export async function enqueueRelicPower(combatantId, key, targetTick = null) {
  const c = getCombat(); if (!c) return ui.notifications?.warn("No hay combate.");
  const ct = c.combatants.get(combatantId);
  if (!canPlanForCombatant(ct)) return ui.notifications?.warn("No puedes planear para ese combatiente.");

  const state = await readState();
  const t = (targetTick == null) ? Number(state.planningTick || state.tick || 0) : Number(targetTick);
  ensureActorState(state, combatantId).queue.push({
    kind: "relic", key, targetTick: t, qorder: ++state.qOrderCounter
  });
  await writeState(state);
}

export async function enqueueMonsterAbility(combatantId, key, targetTick = null) {
  const c = getCombat(); if (!c) return ui.notifications?.warn("No hay combate.");
  const ct = c.combatants.get(combatantId);
  if (!canPlanForCombatant(ct)) return ui.notifications?.warn("No puedes planear para ese combatiente.");

  const actor = ct?.actor;
  const abilities = Array.isArray(actor?.system?.abilities) ? actor.system.abilities : [];
  const ability = abilities.find(ab => (ab.itemKey || ab.key) === key) || getMonsterAbility(key);
  if (!ability) {
    ui.notifications?.warn(`Habilidad desconocida: ${key}`);
    return;
  }
  const manualDisabled = (ability.enabled === false) && (ability.flags?.tsdc?.manualDisabled === true);
  if (manualDisabled) {
    ui.notifications?.warn(`La habilidad ${ability.label ?? key} está deshabilitada.`);
    return;
  }
  if (ability.requiresParts && !arePartsFunctional(actor, ability.requiresParts)) {
    const reason = describePartsStatus(actor, ability.requiresParts) || "Parte dañada";
    ui.notifications?.warn(`No puedes usar ${ability.label ?? key}: ${reason}.`);
    return;
  }

  const state = await readState();
  const t = (targetTick == null) ? Number(state.planningTick || state.tick || 0) : Number(targetTick);
  ensureActorState(state, combatantId).queue.push({
    kind: "monsterAbility",
    key,
    targetTick: t,
    qorder: ++state.qOrderCounter,
    ability: deepClone(ability)
  });
  await writeState(state);
}

export async function enqueueAptitude(combatantId, key, targetTick = null) {
  const c = getCombat(); if (!c) return ui.notifications?.warn("No hay combate.");
  const ct = c.combatants.get(combatantId);
  if (!canPlanForCombatant(ct)) return ui.notifications?.warn("No puedes planear para ese combatiente.");

  const actor = ct?.actor;
  const node = actor?.system?.progression?.aptitudes?.[key];
  const hasIt = !!node?.known || Number(node?.rank||0) > 0;
  if (!hasIt) return ui.notifications?.warn("No conoces esa Aptitud.");

  const state = await readState();
  const t = (targetTick == null) ? Number(state.planningTick || state.tick || 0) : Number(targetTick);
  ensureActorState(state, combatantId).queue.push({
    kind: "aptitude", key, targetTick: t, qorder: ++state.qOrderCounter
  });
  await writeState(state);
}

export async function enqueueManeuverForSelected(key, targetTick = null) {
  const c = getCombat(); if (!c) return;
  const sel = canvas.tokens?.controlled ?? [];
  if (!sel.length) {
    const a = game.user?.character ?? null;
    if (a) {
      const ct = c.combatants.find(x => x.actor?.id === a.id);
      if (ct) return enqueueManeuver(ct.id, key, targetTick);
    }
    return ui.notifications?.warn("No hay token seleccionado ni personaje asignado.");
  }
  for (const tk of sel) {
    const ct = c.combatants.find(x => x.tokenId === tk.id);
    if (ct) await enqueueManeuver(ct.id, key, targetTick);
  }
}

export async function enqueueRelicForSelected(key, targetTick = null) {
  const c = getCombat(); if (!c) return;
  const sel = canvas.tokens?.controlled ?? [];
  if (!sel.length) {
    const a = game.user?.character ?? null;
    if (a) {
      const ct = c.combatants.find(x => x.actor?.id === a.id);
      if (ct) return enqueueRelicPower(ct.id, key, targetTick);
    }
    return ui.notifications?.warn("No hay token seleccionado ni personaje asignado.");
  }
  for (const tk of sel) {
    const ct = c.combatants.find(x => x.tokenId === tk.id);
    if (ct) await enqueueRelicPower(ct.id, key, targetTick);
  }
}

export async function enqueueMonsterAbilityForSelected(key, targetTick = null) {
  const c = getCombat(); if (!c) return;
  const sel = canvas.tokens?.controlled ?? [];
  if (!sel.length) {
    const a = game.user?.character ?? null;
    if (a) {
      const ct = c.combatants.find(x => x.actor?.id === a.id);
      if (ct) return enqueueMonsterAbility(ct.id, key, targetTick);
    }
    return ui.notifications?.warn("No hay token seleccionado ni personaje asignado.");
  }
  for (const tk of sel) {
    const ct = c.combatants.find(x => x.tokenId === tk.id);
    if (ct) await enqueueMonsterAbility(ct.id, key, targetTick);
  }
}

export async function enqueueAptitudeForSelected(key, targetTick = null) {
  const c = getCombat(); if (!c) return;
  const sel = canvas.tokens?.controlled ?? [];
  if (!sel.length) {
    const a = game.user?.character ?? null;
    if (a) {
      const ct = c.combatants.find(x => x.actor?.id === a.id);
      if (ct) return enqueueAptitude(ct.id, key, targetTick);
    }
    return ui.notifications?.warn("No hay token seleccionado ni personaje asignado.");
  }
  for (const tk of sel) {
    const ct = c.combatants.find(x => x.tokenId === tk.id);
    if (ct) await enqueueAptitude(ct.id, key, targetTick);
  }
}

/* ===== Resolver descriptor → def ===== */

function normalizeCtOverride(ct = {}) {
  return {
    I: Number(ct.I ?? ct.init ?? 0),
    E: Number(ct.E ?? ct.exec ?? 0),
    R: Number(ct.R ?? ct.rec ?? 0)
  };
}

function resolveQueued(desc, { actor } = {}) {
  if (!desc) return null;
  if (desc.kind === "simple") { 
     const base = listSimpleActions().find(d => d.key === desc.key);
     if (!base) return null;
     const clone = { ...base };
     if (desc.key === "escape" && desc.meta?.ctOverride) {
       const { I, E, R } = normalizeCtOverride(desc.meta.ctOverride);
       clone.init_ticks = Math.max(0, I);
       clone.exec_ticks = Math.max(0, E);
       clone.rec_ticks  = Math.max(0, R);
     }
     return clone;
   }
  if (desc.kind === "maneuver") {
    const m = MANEUVERS?.[desc.key];
    return m ? makeAbilityAction(m, { key: desc.key, clazz: "maneuver" }) : null;
  }
  if (desc.kind === "relic") {
    const p = RELIC_POWERS?.[desc.key];
    return p ? makeAbilityAction(p, { key: desc.key, clazz: "relic" }) : null;
  }
  if (desc.kind === "aptitude") {
    const a = APTITUDES?.[desc.key];
    return a ? makeAbilityAction(a, { key: desc.key, clazz: "aptitude" }) : null;
  }
  if (desc.kind === "monsterAbility") {
    const ability = desc.ability || getMonsterAbility(desc.key);
    if (!ability) return null;
    return makeAbilityAction(ability, { key: ability.key ?? desc.key, clazz: ability.clazz ?? "monster" });
  }
  if (desc.kind === "spec") {
    return makeSpecializationAction({
      specKey: desc.specKey,
      category: desc.category,
      CT: Number(desc.CT || 2)
    });
  }
  return null;
}

function adjustActionCtForAilments(actor, def) {
  if (!actor || !def) return def;
  const active = listActiveAilments(actor);
  if (!Array.isArray(active) || !active.length) return def;

  let deltaInit = 0;
  let deltaExec = 0;
  let deltaRec  = 0;

  for (const state of active) {
    const catalogEntry = AILMENT_CATALOG[state.id];
    const mechanics = resolveAilmentMechanics(catalogEntry, state);
    const adjust = mechanics?.ctAdjust;
    if (!adjust) continue;
    deltaInit += Number(adjust.init ?? adjust.I ?? 0);
    deltaExec += Number(adjust.exec ?? adjust.E ?? 0);
    deltaRec  += Number(adjust.rec  ?? adjust.R ?? 0);
  }

  if (!deltaInit && !deltaExec && !deltaRec) return def;

  return {
    ...def,
    init_ticks: Math.max(0, Number(def.init_ticks ?? 0) + deltaInit),
    exec_ticks: Math.max(0, Number(def.exec_ticks ?? 0) + deltaExec),
    rec_ticks:  Math.max(0, Number(def.rec_ticks  ?? 0) + deltaRec)
  };
}
/* ===== Internals ===== */

function spawnCard(state, combatantId, def, meta = null) {
  state.placementCounter += 1;
  return {
    actor: combatantId,
    actionKey: def.key,
    I: def.init_ticks, E: def.exec_ticks, R: def.rec_ticks,
    placement_tick: state.tick,
    placement_order: state.placementCounter,
    exec_order: Number(meta?.execOrder ?? state.placementCounter),
    phase: (def.init_ticks > 0) ? "init" : (def.exec_ticks > 0 ? "exec" : "rec"),
    ticks_left: (def.init_ticks > 0) ? def.init_ticks : (def.exec_ticks > 0 ? def.exec_ticks : def.rec_ticks),
    started_this_tick: (def.init_ticks === 0 && def.exec_ticks > 0),
    meta: meta ?? null                  // ⟵ guarda meta en la carta actual
  };
}
function sortExec(list) {
  return list.sort((a,b) =>
    (a.placement_tick - b.placement_tick) ||
    (a.exec_order - b.exec_order) ||
    ((a.started_this_tick ? 0 : -1) - (b.started_this_tick ? 0 : -1))
  );
}

function sortExecDescriptors(list) {
  return list.sort((a,b) =>
    (Number(a.targetTick||0) - Number(b.targetTick||0)) ||
    (Number(a.execOrder||0) - Number(b.execOrder||0))
  );
}

async function performCardExec(state, combat, ci) {
  const ct = combat.combatants.get(ci.actor);
  const actor = ct?.actor;
  if (!actor) return;

  const actorState = ensureActorState(state, ci.actor);
  const meta = actorState?.current?.meta ?? {};
  const actionKey = actorState?.current?.actionKey ?? "";
  const cardType = actorState?.current?.type;

  // Manejar cartas de fases de reacción
  if (cardType === "reaction-phase") {
    await performReactionPhase(state, combat, ci, actorState.current);
    return;
  }

  let defReal = listSimpleActions().find(d => d.key === actionKey) ?? null;
  if (!defReal && actionKey.startsWith("maneuver:")) {
    const k = actionKey.split(":")[1];
    const m = MANEUVERS[k]; if (m) defReal = makeAbilityAction(m, { key: k, clazz: "maneuver" });
  }
  if (!defReal && actionKey.startsWith("relic:")) {
    const k = actionKey.split(":")[1];
    const p = RELIC_POWERS[k]; if (p) defReal = makeAbilityAction(p, { key: k, clazz: "relic" });
  }
  if (!defReal && actionKey.startsWith("aptitude:")) {
    const k = actionKey.split(":")[1];
    const a = APTITUDES[k]; if (a) defReal = makeAbilityAction(a, { key: k, clazz: "aptitude" });
  }
  if (!defReal && actionKey.startsWith("monster:")) {
    const k = actionKey.split(":")[1];
    const ability = ct.actor?.system?.abilities?.find?.(ab => (ab.itemKey || ab.key) === k) || getMonsterAbility(k);
    if (ability) defReal = makeAbilityAction(ability, { key: k, clazz: ability.clazz ?? "monster" });
  }
  if (!defReal && actionKey.startsWith("spec:")) {
    const parts = actionKey.split(":");
    const metaCat = meta?.category ?? "physical";
    const metaCt = Number(meta?.CT ?? parts[2] ?? 2);
    defReal = makeSpecializationAction({ specKey: parts[1], category: metaCat, CT: metaCt });
  }

  try {
    await defReal?.perform?.({
      actor,
      combat,
      combatant: ct,
      tick: state.tick,
      startedThisTick: true,
      meta
    });

    // Disparar triggers de reacciones después de la ejecución
    await triggerReactionsAfterAction(actionKey, ct, meta);

  } catch (e) {
    console.error("ATB perform error", e);
  }
}

async function finalizeTick(state, combat) {
  for (const ct of combat.combatants) {
    const S = ensureActorState(state, ct.id);
    const ci = S.current;
    if (!ci) continue;

    if (ci.phase === "init") {
      ci.ticks_left = Math.max(0, ci.ticks_left - 1);
      if (ci.ticks_left === 0) {
        if (ci.E > 0) {
          ci.phase = "exec";
          ci.started_this_tick = true;
          ci.ticks_left = Math.max(0, ci.E);
        } else if (ci.R > 0) {
          ci.phase = "rec";
          ci.ticks_left = ci.R;
        } else {
          S.current = null;
        }
      }
    } else if (ci.phase === "exec") {
      ci.ticks_left = Math.max(0, ci.ticks_left - 1);
      ci.started_this_tick = false;
      if (ci.ticks_left === 0) {
        if (ci.R > 0) {
          ci.phase = "rec";
          ci.ticks_left = ci.R;
        } else {
          S.current = null;
        }
      }
    } else if (ci.phase === "rec") {
      ci.ticks_left = Math.max(0, ci.ticks_left - 1);
      if (ci.ticks_left === 0) S.current = null;
    }
  }

  state.execHold = [];
  state.tick += 1;
  await writeState(state);
  Hooks.callAll("tsdcAtbTick", { combat, tick: state.tick, state });
}

/* ===== Un paso (= un tick) del bucle ===== */

async function stepOnceInternal() {
  const combat = getCombat(); if (!combat) return;
  const state  = await readState();
  state.execHold = Array.isArray(state.execHold) ? state.execHold : [];

  if (!state.execHold.length) {
    pruneOldCurrentTickMods(state);

    for (const ct of combat.combatants) {
      const S = ensureActorState(state, ct.id);
      if (S.current) continue;

      S.queue.sort((a,b) => (Number(a.targetTick||0) - Number(b.targetTick||0)) || (Number(a.qorder||0) - Number(b.qorder||0)));

      let idx = S.queue.findIndex(d => Number(d.targetTick||0) <= state.tick);
      while (!S.current && idx >= 0) {
        const desc = S.queue.splice(idx, 1)[0];
        const rawDef  = resolveQueued(desc, { actor: ct.actor });
        if (!rawDef) { idx = S.queue.findIndex(d => Number(d.targetTick||0) <= state.tick); continue; }

        const def = adjustActionCtForAilments(ct.actor, rawDef);
        const CTsum = (def.init_ticks + def.exec_ticks + def.rec_ticks);
        if (CTsum === 0) {
          try {
            await def.perform?.({
              actor: ct.actor,
              combat,
              combatant: ct,
              tick: state.tick,
              startedThisTick: true,
              meta: desc?.meta || {}
            });
          } catch (e) { console.error("ATB perform (instantáneo) error", e); }
          idx = S.queue.findIndex(d => Number(d.targetTick||0) <= state.tick);
          continue;
        }

        rotateModsOnSpawn(state, ct.id);
        const extraMeta = (desc?.kind === "spec")
          ? { specKey: desc.specKey, category: desc.category, CT: desc.CT }
          : {};
        const metaPayload = {
          ...(desc?.meta ?? {}),
          ...extraMeta,
          targetTick: Number(desc?.targetTick ?? state.tick),
          execOrder: Number(desc?.qorder ?? state.qOrderCounter)
        };
        S.current = spawnCard(state, ct.id, def, metaPayload);
      }
    }

    const execNow = [];
    const toPromote = [];
    for (const ct of combat.combatants) {
      const S  = ensureActorState(state, ct.id);
      const ci = S.current;
      if (!ci) continue;

      if (ci.phase === "init" && ci.ticks_left === 0) {
        ci.phase = "exec";
        ci.started_this_tick = true;
        ci.ticks_left = Math.max(0, ci.E);
        toPromote.push(ci);
        continue;
      }
      if (ci.phase === "exec" && ci.started_this_tick) {
        execNow.push(ci);
      }
    }

    const execOrdered = sortExec(execNow.concat(toPromote));
    const descriptors = execOrdered.map(ci => {
      const S = ensureActorState(state, ci.actor);
      const actionKey = S.current?.actionKey ?? "";
      const meta = S.current?.meta ?? {};
      return {
        actor: ci.actor,
        specKey: meta.specKey ?? (actionKey.startsWith("spec:") ? actionKey.split(":")[1] : null),
        category: meta.category ?? (actionKey.startsWith("spec:") ? "physical" : null),
        CT: Number(meta.CT ?? (actionKey.startsWith("spec:") ? actionKey.split(":")[2] : 2)),
        targetTick: Number(meta.targetTick ?? state.tick),
        execOrder: Number(meta.execOrder ?? S.current?.placement_order ?? 0)
      };
    });
    state.execHold = sortExecDescriptors(descriptors);

    if (!state.execHold.length) {
      await finalizeTick(state, combat);
      return;
    }
  }

  const nextInfo = state.execHold.shift();
  const actorState = nextInfo ? ensureActorState(state, nextInfo.actor) : null;
  const card = actorState?.current ?? null;

  if (card && card.phase === "exec" && card.started_this_tick) {
    // Verificar reacciones antes de la ejecución
    await checkForReactionsBeforeExecution(state, combat);

    // Solo ejecutar si la acción no fue sustituida por una reacción
    const updatedState = await readState();
    const updatedActorState = ensureActorState(updatedState, nextInfo.actor);
    if (updatedActorState.current && updatedActorState.current.phase === "exec") {
      await performCardExec(updatedState, combat, updatedActorState.current);
      updatedActorState.current.started_this_tick = false;
      await writeState(updatedState);
    }
  }

  if (state.execHold.length === 0) {
    await finalizeTick(state, combat);
  } else {
    await writeState(state);
  }
}

/* ===== Control (solo GM) ===== */

let _interval = null;

// Estos dos quedan "deshabilitados" (para que nadie ponga el bucle automático)
export async function atbStart() {
  return ui.notifications?.warn("El ATB funciona en modo manual. Usa “Avanzar 1 tick”. (Solo GM)");
}
export async function atbPause() { /* no-op */ }

export async function atbStep() {
  if (!isDriver()) return ui.notifications?.warn("Solo el GM puede avanzar el ATB.");
  await stepOnceInternal();
}
export async function atbReset() {
  if (!isDriver()) return ui.notifications?.warn("Solo el GM puede resetear el ATB.");
  const c = getCombat(); if (!c) return;
  await c.unsetFlag(FLAG_SCOPE, FLAG_KEY);
  await writeState(defaultState());
}

/* ===== API de encolado ===== */

function canPlanForCombatant(ct) {
  if (game.user?.isGM) return true;
  const actor = ct?.actor;
  if (!actor) return false;
  const level = actor.ownership?.[game.user.id] ?? 0;
  return level >= CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER || ct?.isOwner;
}

export async function enqueueSimple(combatantId, key, targetTick=null, meta = {}) {
  const c = getCombat(); if (!c) return ui.notifications?.warn("No hay combate.");
  const ct = c.combatants.get(combatantId);
  if (!canPlanForCombatant(ct)) return ui.notifications?.warn("No puedes planear para ese combatiente.");

  const state = await readState();
  const t = (targetTick == null) ? Number(state.planningTick || state.tick || 0) : Number(targetTick);

  ensureActorState(state, combatantId).queue.push({
    kind: "simple",
    key,
    meta: meta ?? {},
    targetTick: t,
    qorder: ++state.qOrderCounter
  });

  await writeState(state);
}

export async function enqueueSpecialization(combatantId, { specKey, category, CT, targetTick=null }) {
  const c = getCombat(); if (!c) return ui.notifications?.warn("No hay combate.");
  const ct = c.combatants.get(combatantId);
  if (!canPlanForCombatant(ct)) return ui.notifications?.warn("No puedes planear para ese combatiente.");

  const state = await readState();
  const t = (targetTick == null) ? Number(state.planningTick || state.tick || 0) : Number(targetTick);
  ensureActorState(state, combatantId).queue.push({
    kind:"spec", specKey, category, CT:Number(CT||2), targetTick: t, qorder: ++state.qOrderCounter
  });
  await writeState(state);
}

export async function enqueueSimpleForSelected(key, targetTick = null, meta = {}) {
  const c = getCombat(); if (!c) return;
  const sel = canvas.tokens?.controlled ?? [];
  if (!sel.length) {
    const a = game.user?.character ?? null;
    if (a) return enqueueSimpleForActor(a.id, key, targetTick, meta); // 👈 meta
    return ui.notifications?.warn("No hay token seleccionado ni personaje asignado.");
  }
  for (const tk of sel) {
    const ct = c.combatants.find(x => x.tokenId === tk.id);
    if (ct) await enqueueSimple(ct.id, key, targetTick, meta); // 👈 meta
  }
}



export async function enqueueSpecForSelected({ specKey, category, CT, targetTick = null }) {
  const c = getCombat(); if (!c) return;
  const sel = canvas.tokens?.controlled ?? [];
  if (!sel.length) {
    const a = game.user?.character ?? null;
    if (a) return enqueueSpecForActor(a.id, { specKey, category, CT, targetTick });
    return ui.notifications?.warn("No hay token seleccionado ni personaje asignado.");
  }
  for (const tk of sel) {
    const ct = c.combatants.find(x => x.tokenId === tk.id);
    if (ct) await enqueueSpecialization(ct.id, { specKey, category, CT, targetTick });
  }
}

/* ===== Integración de Reacciones con ATB ===== */

/**
 * Sustituye una acción programada con una reacción ejecutada inmediatamente
 */
export async function substituteActionWithReaction({
  combatantId,
  reactionChoice,
  targetToken,
  payload = {}
}) {
  const c = getCombat();
  if (!c) return { success: false, error: "No combat active" };

  const ct = c.combatants.get(combatantId);
  if (!ct) return { success: false, error: "Combatant not found" };

  const reactorToken = ct.token?.object ?? canvas.tokens.placeables.find(t => t.actor?.id === ct.actor?.id);
  if (!reactorToken) return { success: false, error: "Token not found" };

  // Obtener estado actual
  const state = await readState();
  const actorState = ensureActorState(state, combatantId);

  // Verificar si hay acción actual que se pueda sustituir
  if (!actorState.current) {
    return { success: false, error: "No current action to substitute" };
  }

  // Ejecutar la reacción inmediatamente
  const reactionResult = await executeReaction({
    reactorToken,
    targetToken,
    reactionChoice,
    payload
  });

  if (reactionResult.success) {
    // La reacción se ejecutó exitosamente, cancelar la acción programada
    actorState.current = null;

    // Mensaje informativo
    await ChatMessage.create({
      content: `<p><b>${reactorToken.name}</b> sustituye su acción programada con una reacción: <i>${reactionChoice.label}</i></p>`,
      speaker: ChatMessage.getSpeaker({ actor: ct.actor })
    });

    await writeState(state);
    return { success: true, substituted: true };
  } else {
    return { success: false, error: reactionResult.error };
  }
}

/**
 * Verifica si hay reacciones disponibles para un combatiente
 */
export function checkAvailableReactionsForCombatant(combatantId, reason = "any", timing = "any") {
  const c = getCombat();
  if (!c) return [];

  const ct = c.combatants.get(combatantId);
  if (!ct?.actor) return [];

  return getAvailableReactions(ct.actor, reason, timing);
}

/**
 * Permite al jugador elegir una reacción y sustituir su acción programada
 */
export async function promptAndSubstituteAction({
  combatantId,
  provokerToken,
  reason = "any",
  timing = "any",
  timeoutMs = 6500
}) {
  const c = getCombat();
  if (!c) return { success: false, error: "No combat active" };

  const ct = c.combatants.get(combatantId);
  if (!ct) return { success: false, error: "Combatant not found" };

  const reactorToken = ct.token?.object ?? canvas.tokens.placeables.find(t => t.actor?.id === ct.actor?.id);
  if (!reactorToken) return { success: false, error: "Token not found" };

  // Verificar si hay reacciones disponibles
  const availableReactions = getAvailableReactions(ct.actor, reason, timing);
  if (availableReactions.length === 0) {
    return { success: false, error: "No reactions available" };
  }

  // Mostrar diálogo de reacción
  const reactionChoice = await promptReactionDialog({
    reactorToken,
    provokerToken,
    reason,
    timing,
    timeoutMs,
    title: "Reacción disponible - Sustituir acción"
  });

  if (!reactionChoice) {
    return { success: false, cancelled: true };
  }

  // Sustituir acción con reacción
  return await substituteActionWithReaction({
    combatantId,
    reactionChoice,
    targetToken: provokerToken,
    payload: { reason, timing }
  });
}

/**
 * Dispara triggers de reacciones después de ejecutar una acción
 */
async function triggerReactionsAfterAction(actionKey, combatant, meta = {}) {
  const token = combatant.token?.object ?? canvas.tokens.placeables.find(t => t.actor?.id === combatant.actor?.id);
  if (!token) return;

  try {
    // Trigger para movimiento
    if (actionKey === "move") {
      // Para el movimiento, necesitaríamos las posiciones before/after
      // Por ahora, esto se maneja en la acción de movimiento directamente
      console.log(`TSDC | Movement completed by ${token.name}, movement reactions should be handled in move action`);
    }

    // Trigger para ataques - reacciones después del ataque
    if (actionKey === "attack") {
      const targetTokenId = meta?.targetTokenId;
      if (targetTokenId) {
        const targetToken = canvas.tokens.get(targetTokenId);
        if (targetToken) {
          // Obtener reacciones disponibles para el objetivo
          const availableReactions = getAvailableReactions(
            targetToken.actor,
            "incoming-attack",
            "after-attack"
          );

          if (availableReactions.length > 0) {
            // Mostrar diálogo de reacciones disponibles
            const reactionChoice = await promptReactionDialog({
              reactorToken: targetToken,
              provokerToken: token,
              reason: "incoming-attack",
              timing: "after-attack",
              timeoutMs: 6000,
              title: "Reacción después del ataque"
            });

            // Ejecutar la reacción seleccionada
            if (reactionChoice) {
              // Buscar el combatant del reactor para sustituir su acción en ATB
              const reactorCombatant = combat.combatants.find(ct => ct.token?.object?.id === targetToken.id);

              if (reactorCombatant) {
                // Sustituir la acción programada con la reacción
                const reactionResult = await substituteActionWithReaction({
                  combatantId: reactorCombatant.id,
                  reactionChoice,
                  targetToken: token,
                  payload: { reason: "incoming-attack", timing: "after-attack" }
                });

                if (reactionResult.success) {
                  console.log(`TSDC | ${targetToken.name} sustituye su acción con reacción: ${reactionChoice.label}`);
                }
              } else {
                // Fallback: ejecutar sin sustituir si no se encuentra el combatant
                const executionResult = await executeReaction({
                  reactorToken: targetToken,
                  targetToken: token,
                  reactionChoice,
                  payload: { attackType: "after-attack" }
                });

                if (executionResult.success) {
                  console.log(`TSDC | ${targetToken.name} ejecutó reacción: ${reactionChoice.label}`);
                }
              }
            }
          }
        }
      }
    }

    // Trigger para fumbles - esto normalmente se detectaría en el sistema de dados
    // Por ahora lo dejamos como placeholder para integración futura

  } catch (error) {
    console.error("TSDC | Error triggering reactions after action:", error);
  }
}

/**
 * Hook en el flujo de ejecución para verificar reacciones antes de ejecutar acciones
 */
async function checkForReactionsBeforeExecution(state, combat) {
  // Buscar combatientes que estén a punto de ejecutar acciones
  const aboutToExecute = [];

  for (const ct of combat.combatants) {
    const actorState = ensureActorState(state, ct.id);
    const ci = actorState.current;

    if (ci && ci.phase === "exec" && ci.started_this_tick) {
      aboutToExecute.push({
        combatant: ct,
        action: ci,
        token: ct.token?.object ?? canvas.tokens.placeables.find(t => t.actor?.id === ct.actor?.id)
      });
    }
  }

  // Para cada acción a punto de ejecutarse, verificar si hay reacciones antes del ataque
  for (const execution of aboutToExecute) {
    const { combatant, action, token } = execution;

    // Si es un ataque, verificar reacciones del objetivo antes del ataque
    if (action.actionKey === "attack" && token) {
      const actorState = ensureActorState(state, combatant.id);
      const targetTokenId = actorState.current?.meta?.targetTokenId;

      if (targetTokenId) {
        const targetToken = canvas.tokens.get(targetTokenId);
        if (targetToken?.actor) {
          const targetCombatant = combat.combatants.find(ct => ct.token?.object?.id === targetToken.id);

          if (targetCombatant) {
            const reactions = checkAvailableReactionsForCombatant(
              targetCombatant.id,
              "incoming-attack",
              "before-attack"
            );

            if (reactions.length > 0) {
              // El objetivo puede reaccionar antes del ataque
              const reactionChoice = await promptReactionDialog({
                reactorToken: targetToken,
                provokerToken: token,
                reason: "incoming-attack",
                timing: "before-attack",
                timeoutMs: 6000,
                title: "Reacción antes del ataque"
              });

              if (reactionChoice) {
                // Buscar el combatant del reactor para sustituir su acción en ATB
                const reactorCombatant = combat.combatants.find(ct => ct.token?.object?.id === targetToken.id);

                if (reactorCombatant) {
                  // Sustituir la acción programada con la reacción
                  const reactionResult = await substituteActionWithReaction({
                    combatantId: reactorCombatant.id,
                    reactionChoice,
                    targetToken: token,
                    payload: { reason: "incoming-attack", timing: "before-attack" }
                  });

                  if (reactionResult.success) {
                    console.log(`TSDC | ${targetToken.name} sustituye su acción con reacción: ${reactionChoice.label}`);
                  }
                } else {
                  // Fallback: ejecutar sin sustituir si no se encuentra el combatant
                  const reactionResult = await executeReaction({
                    reactorToken: targetToken,
                    targetToken: token,
                    reactionChoice,
                    payload: { reason: "incoming-attack", timing: "before-attack" }
                  });

                  if (reactionResult.success) {
                    console.log(`TSDC | ${targetToken.name} ejecutó reacción: ${reactionChoice.label}`);
                  }
                }
              }
            }
          }
        }
      }
    }
  }
}

/* ===== Ejecución de fases de reacción ===== */

/** Execute a reaction phase card */
async function performReactionPhase(state, combat, ci, phaseCard) {
  const ct = combat.combatants.get(ci.actor);
  const actor = ct?.actor;
  const token = ct?.token?.object;

  if (!actor || !token) {
    console.warn("TSDC | Invalid actor/token for reaction phase");
    return;
  }

  const { phase, aptitudeKey, aptitudeDef, targetTokenId, payload } = phaseCard;
  const targetToken = targetTokenId ? canvas.tokens.get(targetTokenId) : null;

  console.log(`TSDC | Executing ${aptitudeDef.label} phase: ${phase} for ${actor.name}`);

  try {
    switch (phase) {
      case "init":
        await performReactionInitPhase(actor, token, aptitudeDef, targetToken, payload);
        break;

      case "exec":
        await performReactionExecPhase(actor, token, aptitudeDef, targetToken, payload);
        break;

      case "recovery":
        await performReactionRecoveryPhase(actor, token, aptitudeDef, targetToken, payload);
        break;

      default:
        console.warn(`TSDC | Unknown reaction phase: ${phase}`);
    }
  } catch (error) {
    console.error(`TSDC | Error executing reaction phase ${phase}:`, error);
  }
}

/** Execute init phase of reaction */
async function performReactionInitPhase(actor, token, aptitudeDef, targetToken, payload) {
  const initPhase = aptitudeDef.phases?.init;
  if (!initPhase) return;

  if (initPhase.effect === "substitute_defense_roll") {
    // Marcar que esta reacción debe sustituir la tirada de defensa
    payload.defenseSubstitution = {
      aptitudeKey: initPhase.aptitudeKey,
      specKey: initPhase.specKey,
      active: true
    };

    await ChatMessage.create({
      content: `<p>🎭 <b>${actor.name}</b>: ${initPhase.description}</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  } else if (initPhase.effect === "defense_bonus") {
    // Aplicar bonificador de defensa
    payload.defenseBonus = initPhase.bonus;

    await ChatMessage.create({
      content: `<p>⚡ <b>${actor.name}</b>: ${initPhase.description} (+${initPhase.bonus})</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
  }
}

/** Execute exec phase of reaction */
async function performReactionExecPhase(actor, token, aptitudeDef, targetToken, payload) {
  const execPhase = aptitudeDef.phases?.exec;
  if (!execPhase || !execPhase.effects) return;

  // Verificar condición para ejecutar efectos
  const condition = execPhase.condition;
  if (condition && !checkReactionCondition(condition, payload)) {
    await ChatMessage.create({
      content: `<p>💭 <b>${actor.name}</b>: ${aptitudeDef.label} - Condición no cumplida</p>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
    return;
  }

  await ChatMessage.create({
    content: `<p>🎬 <b>${actor.name}</b>: ${execPhase.description}</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });

  for (const effect of execPhase.effects) {
    await applyReactionEffect(actor, token, targetToken, effect);
  }
}

/** Execute recovery phase of reaction */
async function performReactionRecoveryPhase(actor, token, aptitudeDef, targetToken, payload) {
  await ChatMessage.create({
    content: `<p>🔄 <b>${actor.name}</b>: ${aptitudeDef.label} - Recuperación</p>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
}

/** Check if reaction condition is met */
function checkReactionCondition(condition, payload) {
  switch (condition) {
    case "defense_success":
      return payload.defenseResult?.success === true;
    case "defense_complete_success":
      return payload.defenseResult?.success === true && payload.defenseResult?.margin >= 0;
    case "defense_success_by_3":
      return payload.defenseResult?.success === true && payload.defenseResult?.margin >= 3;
    default:
      return true;
  }
}

/** Apply a reaction effect */
async function applyReactionEffect(actor, token, targetToken, effect) {
  switch (effect.type) {
    case "free_movement":
      await ChatMessage.create({
        content: `<p>🏃 <b>${actor.name}</b> puede moverse libremente sin provocar reacciones.</p>`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
      break;

    case "bonus_attack":
      await ChatMessage.create({
        content: `<p>⚔️ <b>${actor.name}</b> puede realizar un contraataque con +${effect.bonus} de bonificación.</p>`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
      break;

    case "disarm_attacker":
      if (targetToken?.actor) {
        await ChatMessage.create({
          content: `<p>💥 <b>${actor.name}</b> desarma a <b>${targetToken.name}</b>! ${effect.note}</p>`,
          speaker: ChatMessage.getSpeaker({ actor })
        });
      }
      break;

    case "free_attack":
      await ChatMessage.create({
        content: `<p>⚡ <b>${actor.name}</b> ataca inmediatamente sin consumir acción!</p>`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
      break;

    case "debuff_attacker":
      if (targetToken?.actor) {
        await ChatMessage.create({
          content: `<p>😵 <b>${targetToken.name}</b> sufre -${effect.penalty} a su próximo ataque. ${effect.note}</p>`,
          speaker: ChatMessage.getSpeaker({ actor })
        });
      }
      break;

    default:
      console.warn(`TSDC | Unknown reaction effect type: ${effect.type}`);
  }
}

export const ATB_API = {
  // planeación
  getPlanningTick, setPlanningTick, adjustPlanningTick,
  // control
  atbStart, atbPause, atbStep, atbReset,
  // encolado
  enqueueSimple, enqueueSpecialization,
  enqueueSimpleForSelected, enqueueSpecForSelected,
  enqueueSimpleForActor, enqueueSpecForActor,
  enqueueManeuverForSelected, enqueueRelicForSelected, enqueueAptitudeForSelected, enqueueMonsterAbilityForSelected,
  enqueueManeuver, enqueueRelicPower, enqueueAptitude, enqueueMonsterAbility,
  // reacciones
  substituteActionWithReaction, checkAvailableReactionsForCombatant, promptAndSubstituteAction
};
