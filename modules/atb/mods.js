// modules/atb/mods.js
// Helpers para aplicar bonos/penalizaciones ATB a las tiradas (TA, TD, TR, TE, TC).

const FLAG_SCOPE = "tsdc";
const FLAG_KEY   = "atb";

/** Devuelve { state, actorState, combat, combatantId, tick } o null */
function readForActor(actor) {
  const combat = game.combat;
  if (!combat || !actor) return null;
  const ct = combat.combatants.find(c => c.actor?.id === actor.id);
  if (!ct) return null;
  const state = combat.getFlag(FLAG_SCOPE, FLAG_KEY) ?? null;
  if (!state) return null;
  const actorState = state.actors?.[ct.id] ?? null;
  if (!actorState) return null;
  return { combat, state, actorState, combatantId: ct.id, tick: Number(state.tick || 0) };
}

/** ¿Este modificador aplica a la tirada actual? */
function affects(mod, ctx) {
  const types = mod?.types || [];
  if (types.includes("all")) return true;

  const phase = String(ctx?.phase || "");
  const tag   = String(ctx?.tag   || "");   // "TA"|"TD"|"TR"|...
  const resT  = String(ctx?.resType || ""); // para TC

  // Map corto por etiqueta
  if (types.includes("TA") && phase === "attack") return true;
  if (types.includes("TD") && phase === "defense") return true;
  if (types.includes("TR") && phase === "resistance") return true;
  // TE = tirada de especialización (si usas rollSpecialization, marca ctx.phase="skill" o tag="TE")
  if (types.includes("TE") && (phase === "skill" || tag === "TE")) return true;
  // TC = Composure → lo modelamos como resistencia tipo "composure"
  if (types.includes("TC") && phase === "resistance" && resT === "composure") return true;

  return false;
}

/** Aplica mods ATB al objeto roll de makeRollTotal (suma al total y añade breakdown) */
export function applyAtbModsToRoll(actor, roll, ctx = {}) {
  const data = readForActor(actor);
  if (!data) return;

  const { actorState, tick } = data;
  const modsNow = [
    ...(actorState.mods?.currentTick ?? []).filter(m => (m.tick === tick)),
    ...(actorState.mods?.activeThisTick ?? [])
  ];

  let sum = 0;
  const labels = [];
  for (const m of modsNow) {
    if (!affects(m, ctx)) continue;
    const v = Number(m.value || 0);
    if (!Number.isFinite(v) || v === 0) continue;
    sum += v;
    labels.push(`${m.note ?? "ATB"} ${v > 0 ? `+${v}` : v}`);
  }

  if (sum !== 0) {
    roll.total += sum;
    roll.notes = roll.notes || [];
    roll.notes.push(`ATB: ${labels.join(" • ")}`);
    roll.breakdown = roll.breakdown || { parts: [], tags: [], source: [] };
    roll.breakdown.parts.push({ label: "ATB", value: sum, note: labels.join(", ") });
    roll.breakdown.source.push({ kind: "atb", value: sum, notes: labels });
  }
}

/* ======= Gestión desde el motor ATB ======= */

/** Pone una penalización SOLO para el tick actual. */
export async function pushPenaltyForCurrentTick(combat, combatantId, { value, types, note }) {
  const state = combat.getFlag(FLAG_SCOPE, FLAG_KEY) ?? {};
  const tick  = Number(state.tick || 0);
  state.actors = state.actors || {};
  state.actors[combatantId] = state.actors[combatantId] || { queue: [], current: null, mods: {} };
  const mods = state.actors[combatantId].mods;
  mods.currentTick = mods.currentTick || [];
  mods.currentTick.push({ tick, value: Number(value||0), types: types || ["all"], note: note || "ATB" });
  await combat.setFlag(FLAG_SCOPE, FLAG_KEY, state);
}

/** Programa un bono para la próxima acción habilitada del actor. */
export async function scheduleBonusForNextAction(combat, combatantId, { value, types, note }) {
  const state = combat.getFlag(FLAG_SCOPE, FLAG_KEY) ?? {};
  state.actors = state.actors || {};
  state.actors[combatantId] = state.actors[combatantId] || { queue: [], current: null, mods: {} };
  const mods = state.actors[combatantId].mods;
  mods.nextActionBonus = { value: Number(value||0), types: types || ["all"], note: note || "ATB" };
  await combat.setFlag(FLAG_SCOPE, FLAG_KEY, state);
}

/** Limpia mods vencidos y mueve nextActionBonus→activeThisTick cuando arranca acción nueva. */
export function rotateModsOnSpawn(state, combatantId) {
  const S = state.actors[combatantId];
  if (!S) return;
  S.mods = S.mods || {};
  // limpiar activeThisTick del tick anterior
  S.mods.activeThisTick = [];
  // mover bonus programado a activos de este tick (si existe)
  if (S.mods.nextActionBonus) {
    S.mods.activeThisTick = [ { ...S.mods.nextActionBonus } ];
    delete S.mods.nextActionBonus;
  }
}

/** Prune de penalizaciones que no sean del tick actual. */
export function pruneOldCurrentTickMods(state) {
  const tick = Number(state.tick || 0);
  for (const [id, S] of Object.entries(state.actors || {})) {
    const mods = (S.mods = S.mods || {});
    mods.currentTick = (mods.currentTick || []).filter(m => m.tick === tick);
    // activeThisTick se limpia en rotateModsOnSpawn
  }
}
