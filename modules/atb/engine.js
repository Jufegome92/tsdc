// modules/atb/engine.js
// Bucle ATB con CT=I+E+R. Maneja mods (penalizaciones/bonos) y acciones instantáneas.

import { listSimpleActions, makeSpecializationAction } from "./actions.js";
import { rotateModsOnSpawn, pruneOldCurrentTickMods } from "./mods.js";

const FLAG_SCOPE = "tsdc";
const FLAG_KEY   = "atb";

function defaultState() {
  return {
    tick: 0,
    running: false,
    tickMs: 1000,
    placementCounter: 0,
    actors: {} // [combatantId]: { queue: Array<{k:string,p:any}>, current: Card|null, mods:{} }
  };
}

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

/* ===== Resolución de acción ===== */

function resolveQueued(defOrDescriptor) {
  // defOrDescriptor: { kind:"simple", key } | { kind:"spec", specKey, category, CT }
  if (!defOrDescriptor) return null;
  if (defOrDescriptor.kind === "simple") {
    const def = listSimpleActions().find(d => d.key === defOrDescriptor.key);
    return def ?? null;
  }
  if (defOrDescriptor.kind === "spec") {
    return makeSpecializationAction({
      specKey: defOrDescriptor.specKey,
      category: defOrDescriptor.category,
      CT: Number(defOrDescriptor.CT || 2)
    });
  }
  return null;
}

/* ===== API pública de encolado ===== */

export async function enqueueSimple(combatantId, key) {
  const c = getCombat(); if (!c) return ui.notifications?.warn("No hay combate.");
  const state = await readState();
  ensureActorState(state, combatantId).queue.push({ kind:"simple", key });
  await writeState(state);
}
export async function enqueueSpecialization(combatantId, { specKey, category, CT }) {
  const c = getCombat(); if (!c) return ui.notifications?.warn("No hay combate.");
  const state = await readState();
  ensureActorState(state, combatantId).queue.push({ kind:"spec", specKey, category, CT:Number(CT||2) });
  await writeState(state);
}

/* ===== Internals ===== */

function spawnCard(state, combatantId, def) {
  state.placementCounter += 1;
  return {
    actor: combatantId,
    actionKey: def.key,
    I: def.init_ticks, E: def.exec_ticks, R: def.rec_ticks,
    placement_tick: state.tick,
    placement_order: state.placementCounter,
    phase: (def.init_ticks > 0) ? "init" : (def.exec_ticks > 0 ? "exec" : "rec"),
    ticks_left: (def.init_ticks > 0) ? def.init_ticks : (def.exec_ticks > 0 ? def.exec_ticks : def.rec_ticks),
    started_this_tick: (def.init_ticks === 0 && def.exec_ticks > 0)
  };
}
function sortExec(list) {
  return list.sort((a,b) =>
    (a.placement_tick - b.placement_tick) ||
    (a.placement_order - b.placement_order) ||
    ((a.started_this_tick ? 0 : -1) - (b.started_this_tick ? 0 : -1))
  );
}

async function stepOnceInternal() {
  const combat = getCombat(); if (!combat) return;
  const state  = await readState();

  // Limpia penalizaciones de ticks previos
  pruneOldCurrentTickMods(state);

  // 1) Arrancar acciones (y mover nextActionBonus -> activeThisTick)
  for (const ct of combat.combatants) {
    const S = ensureActorState(state, ct.id);
    if (S.current) continue;
    if (!S.queue.length) continue;

    // Mover bonos programados para que apliquen "en este tick de nueva acción"
    rotateModsOnSpawn(state, ct.id);

    const desc = S.queue.shift();
    const def  = resolveQueued(desc);
    if (!def) continue;

    // Acciones instantáneas (CT=0) → perform y NO crean carta
    const CTsum = (def.init_ticks + def.exec_ticks + def.rec_ticks);
    if (CTsum === 0) {
      const actor = ct.actor;
      await def.perform?.({ actor, combat, combatant: ct, tick: state.tick, startedThisTick: true });
      continue;
    }

    S.current = spawnCard(state, ct.id, def);
  }

  // 2) Ejecutan este tick (EXEC + los INIT que acaban de terminar)
  const execNow = [];
  const toPromote = [];
  for (const ct of combat.combatants) {
    const S  = ensureActorState(state, ct.id);
    const ci = S.current;
    if (!ci) continue;
    if (ci.phase === "exec") execNow.push(ci);
    if (ci.phase === "init" && ci.ticks_left === 0) toPromote.push(ci);
  }
  for (const ci of toPromote) {
    ci.phase = "exec";
    ci.started_this_tick = true;
    ci.ticks_left = Math.max(0, ci.E);
  }
  const execOrdered = sortExec(execNow.concat(toPromote));

  // 3) Perform EXEC
  for (const ci of execOrdered) {
    const ct = combat.combatants.get(ci.actor);
    const def = resolveQueued(ensureActorState(state, ci.actor).current
      ? { kind:"simple", key: ensureActorState(state, ci.actor).current.actionKey } // key real no importa para perform
      : null);
    const actor = ct?.actor;
    if (!actor) continue;

    // Hallar def real por key (puede ser simple o especialización)
    let defReal = null;
    // Primero busca entre simples
    defReal = listSimpleActions().find(d => d.key === ensureActorState(state, ci.actor).current?.actionKey) ?? null;
    // Si no está, puede ser "spec:..."
    if (!defReal && ensureActorState(state, ci.actor).current?.actionKey?.startsWith?.("spec:")) {
      const parts = ensureActorState(state, ci.actor).current.actionKey.split(":"); // spec:key:CT
      defReal = makeSpecializationAction({ specKey: parts[1], category: "physical", CT: Number(parts[2]||2) }); // category solo para formar ticks; perform real se definió al encolar
    }

    // Pero el perform que queremos es el del objeto encolado original → lo re-resolvemos:
    const queued = resolveQueued(ensureActorState(state, ci.actor).lastQueuedDescriptor ?? null); // puede ser null
    const perform = queued?.perform ?? defReal?.perform;

    await perform?.({
      actor,
      combat,
      combatant: ct,
      tick: state.tick,
      startedThisTick: !!ci.started_this_tick
    });
  }

  // 4) Reducir contadores y transicionar
  for (const ct of combat.combatants) {
    const S = ensureActorState(state, ct.id);
    const ci = S.current;
    if (!ci) continue;

    if (ci.phase === "init") {
      ci.ticks_left = Math.max(0, ci.ticks_left - 1);
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
      if (ci.ticks_left === 0) {
        // Si la acción fue una Especialización CT3 con bono programado, ya quedó agendado
        S.current = null;
      }
    }
  }

  // 5) Avanza tick
  state.tick += 1;
  await writeState(state);
  Hooks.callAll("tsdcAtbTick", { combat, tick: state.tick, state });
}

/* ===== Control ===== */

let _interval = null;

export async function atbStart() {
  const c = getCombat(); if (!c) return ui.notifications?.warn("No hay combate activo.");
  const state = await readState();
  if (state.running) return;
  state.running = true;
  await writeState(state);
  _interval = setInterval(() => stepOnceInternal(), Math.max(250, Number(state.tickMs || 1000)));
}
export async function atbPause() {
  const state = await readState();
  state.running = false;
  await writeState(state);
  if (_interval) { clearInterval(_interval); _interval = null; }
}
export async function atbStep() { await stepOnceInternal(); }
export async function atbReset() {
  await atbPause();
  const c = getCombat(); if (!c) return;
  await c.unsetFlag(FLAG_SCOPE, FLAG_KEY);
  await writeState(defaultState());
}

/** Encolar helpers para selección actual */
export async function enqueueSimpleForSelected(key) {
  const c = getCombat(); if (!c) return;
  for (const tk of canvas.tokens?.controlled ?? []) {
    const ct = c.combatants.find(x => x.tokenId === tk.id);
    if (ct) await enqueueSimple(ct.id, key);
  }
}
export async function enqueueSpecForSelected({ specKey, category, CT }) {
  const c = getCombat(); if (!c) return;
  for (const tk of canvas.tokens?.controlled ?? []) {
    const ct = c.combatants.find(x => x.tokenId === tk.id);
    if (ct) await enqueueSpecialization(ct.id, { specKey, category, CT });
  }
}

export const ATB_API = {
  atbStart, atbPause, atbStep, atbReset,
  enqueueSimple, enqueueSpecialization,
  enqueueSimpleForSelected, enqueueSpecForSelected
};
