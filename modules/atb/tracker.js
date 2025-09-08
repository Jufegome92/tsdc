// systems/tsdc/modules/atb/tracker.js
import { listSimpleActions, makeSpecializationAction } from "./actions.js";

const FLAG_SCOPE = "tsdc";
const FLAG_KEY   = "atb";

function getState() {
  const c = game.combat;
  if (!c) return null;
  return c.getFlag(FLAG_SCOPE, FLAG_KEY) ?? null;
}

function resolveQueued(desc) {
  if (!desc) return null;
  if (desc.kind === "simple") {
    return listSimpleActions().find(d => d.key === desc.key) ?? null;
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

function labelFromKey(key) {
  const simple = listSimpleActions().find(d => d.key === key);
  if (simple) return simple.label ?? simple.key;
  if (key?.startsWith?.("spec:")) {
    // spec:key:CT
    const parts = key.split(":");
    return `Esp. ${parts[1] ?? "?"} (CT ${parts[2] ?? "?"})`;
  }
  return key ?? "?";
}

function buildRow(c, state, combatantId, horizon) {
  const row = { name: c?.combatants?.get(combatantId)?.name ?? "—", segments: [] };
  const S = state.actors?.[combatantId] ?? { queue: [], current: null };

  let pos = 0;

  // 1) Fase actual + fases remanentes de la acción en curso
  if (S.current) {
    const cur = foundry.utils.duplicate(S.current);
    const label = labelFromKey(cur.actionKey);

    // Fase actual
    if (cur.ticks_left > 0) {
      const span = Math.min(cur.ticks_left, horizon - pos);
      if (span > 0) {
        row.segments.push({ label, phase: cur.phase, gridColumn: `${pos + 1} / span ${span}` });
        pos += span;
      }
    }

    // Fases que quedan de la MISMA acción
    const tail = [];
    if (cur.phase === "init") {
      if (cur.E > 0) tail.push({ phase: "exec", ticks: cur.E });
      if (cur.R > 0) tail.push({ phase: "rec",  ticks: cur.R });
    } else if (cur.phase === "exec") {
      if (cur.R > 0) tail.push({ phase: "rec",  ticks: cur.R });
    }

    for (const p of tail) {
      if (pos >= horizon) break;
      const span = Math.min(p.ticks, horizon - pos);
      if (span > 0) {
        row.segments.push({ label, phase: p.phase, gridColumn: `${pos + 1} / span ${span}` });
        pos += span;
      }
    }
  }

  // 2) Cola futura del actor
  for (const desc of (S.queue ?? [])) {
    const def = resolveQueued(desc);
    if (!def) continue;
    const label = def.label ?? def.key;
    const phases = [
      { phase: "init", ticks: def.init_ticks },
      { phase: "exec", ticks: def.exec_ticks },
      { phase: "rec",  ticks: def.rec_ticks }
    ].filter(p => (p.ticks || 0) > 0);

    for (const p of phases) {
      if (pos >= horizon) break;
      const span = Math.min(p.ticks, horizon - pos);
      if (span > 0) {
        row.segments.push({ label, phase: p.phase, gridColumn: `${pos + 1} / span ${span}` });
        pos += span;
      }
    }
    if (pos >= horizon) break;
  }

  // 3) Si no hay nada, muestra "Libre"
  if (row.segments.length === 0) {
    row.segments.push({ label: "Libre", phase: "free", gridColumn: `1 / span ${horizon}` });
  }
  return row;
}

export class ATBTrackerApp extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      id: "tsdc-atb-tracker",
      title: "ATB — Tracker",
      template: "systems/tsdc/templates/apps/atb-tracker.hbs",
      width: 980,
      height: "auto",
      resizable: true
    });
  }

  async getData() {
    const c = game.combat;
    const state = getState() ?? { tick: 0, actors: {} };
    const horizon = 12; // columnas a mostrar
    const cols = Array.from({ length: horizon }, (_ , i) => state.tick + i);
    const rows = [];
    for (const ct of (c?.combatants ?? [])) {
      rows.push(buildRow(c, state, ct.id, horizon));
    }
    return { tick: state.tick, horizon, cols, rows };
  }

  activateListeners(html) {
    super.activateListeners(html);
    // re-render cuando cambian flags del combat (ATB avanza)
    this._refreshHook = (_combat, changes) => {
      if (changes?.flags?.[FLAG_SCOPE]?.[FLAG_KEY] !== undefined) this.render(false);
    };
    Hooks.on("updateCombat", this._refreshHook);
    html[0]?.querySelector('[data-act="close"]')?.addEventListener("click", () => this.close());
  }

  async close(options) {
    Hooks.off("updateCombat", this._refreshHook);
    return super.close(options);
  }

  static open() {
    this._instance ??= new this();
    this._instance.render(true);
    return this._instance;
  }
}

export function registerAtbTrackerButton() {
  Hooks.on("getCombatTrackerHeaderButtons", (_tracker, buttons) => {
    buttons.unshift({
      class: "tsdc-atb-tracker",
      label: "Tracker",
      icon: "fa-solid fa-table-columns",
      onclick: () => ATBTrackerApp.open()
    });
  });
  game.transcendence = game.transcendence || {};
  game.transcendence.openAtbTracker = () => ATBTrackerApp.open();
}
