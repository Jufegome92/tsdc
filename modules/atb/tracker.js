// systems/tsdc/modules/atb/tracker.js
import { listSimpleActions, makeSpecializationAction } from "./actions.js";
import { openPlanDialogForSelection } from "./ui.js";
import { ATB_API } from "./engine.js";
import { MANEUVERS } from "../features/maneuvers/data.js";
import { RELIC_POWERS } from "../features/relics/data.js";
import { APTITUDES } from "../features/aptitudes/data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = "tsdc";
const FLAG_KEY   = "atb";

/* ===========================
 * Helpers de estado y render
 * =========================== */

(function ensureAtbTrackerStyle(){
  const ID = "tsdc-atb-tracker-style-inline";
  if (document.getElementById(ID)) return;
  const s = document.createElement("style");
  s.id = ID;
  s.textContent = `
    .tsdc-atb-tracker .tt-head { display:grid; grid-template-columns:180px 1fr; align-items:center; gap:8px; margin-bottom:6px; }
    .tsdc-atb-tracker .tt-row  { display:grid; grid-template-columns:180px 1fr; align-items:center; gap:8px; margin:6px 0; }
    .tsdc-atb-tracker .tt-line { display:grid; grid-template-columns:repeat(var(--cols), 1fr); gap:3px; height:42px; position:relative; }
    .tsdc-atb-tracker .tt-seg  { border:1px solid #7a7a7a; border-radius:10px; display:grid; place-items:center; padding:0 8px; overflow:hidden; font-size:12px; }
    .tsdc-atb-tracker .tt-label { white-space:nowrap; text-overflow:ellipsis; overflow:hidden; }
    .tsdc-atb-tracker .phase-init { background:#c9d8ff; }
    .tsdc-atb-tracker .phase-exec { background:#ffd8b3; }
    .tsdc-atb-tracker .phase-rec  { background:#ececec; }
    .tsdc-atb-tracker .phase-free { background:#dff5df; }
  `;
  document.head.appendChild(s);
})();

function getState() {
  const c = game.combat;
  if (!c) return null;
  return c.getFlag(FLAG_SCOPE, FLAG_KEY) ?? null;
}

function resolveQueued(desc) {
  if (!desc) return null;
  if (desc.kind === "simple") { 
    const s = listSimpleActions().find(d => d.key === desc.key);
    return s ? { key: s.key, label: s.label, init_ticks: s.init_ticks, exec_ticks: s.exec_ticks, rec_ticks: s.rec_ticks } : null;
   }
  if (desc.kind === "maneuver") {
    const m = MANEUVERS?.[desc.key];
    if (!m) return null;
    return { key:`maneuver:${desc.key}`, label: m.label, init_ticks:m.ct?.init||0, exec_ticks:m.ct?.exec||1, rec_ticks:m.ct?.rec||0 };
  }
  if (desc.kind === "relic") {
    const p = RELIC_POWERS?.[desc.key];
    if (!p) return null;
    return { key:`relic:${desc.key}`, label: p.label, init_ticks:p.ct?.init||0, exec_ticks:p.ct?.exec||1, rec_ticks:p.ct?.rec||0 };
  }
  if (desc.kind === "aptitude") {
    const a = APTITUDES?.[desc.key];
    if (!a) return null;
    return { key:`aptitude:${desc.key}`, label: a.label, init_ticks:a.ct?.init||0, exec_ticks:a.ct?.exec||1, rec_ticks:a.ct?.rec||0 };
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

  if (key?.startsWith?.("maneuver:")) {
    const k = key.split(":")[1];
    return MANEUVERS[k]?.label ?? `Maniobra ${k}`;
  }
  if (key?.startsWith?.("relic:")) {
    const k = key.split(":")[1];
    return RELIC_POWERS[k]?.label ?? `Reliquia ${k}`;
  }
  if (key?.startsWith?.("aptitude:")) {
    const k = key.split(":")[1];
    return APTITUDES[k]?.label ?? `Aptitud ${k}`;
  }
  if (key?.startsWith?.("spec:")) {
    const parts = key.split(":");
    return `Esp. ${parts[1] ?? "?"} (CT ${parts[2] ?? "?"})`;
  }
  return key ?? "?";
}

function buildRow(c, state, combatantId, horizon) {
  const row = { name: c?.combatants?.get(combatantId)?.name ?? "—", segments: [] };
  const S = state?.actors?.[combatantId] ?? { queue: [], current: null };

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

/* ===========================
 * Application V2 + Handlebars
 * =========================== */

class ATBTrackerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tsdc-atb-tracker",
    title: "ATB Tracker",
    window: { icon: "fa-solid fa-table-columns" },
    position: { width: 900, height: "auto" },
    actions: {
      plan : ATBTrackerApp.onPlan,
      close: ATBTrackerApp.onClose,
      "tick-prev": ATBTrackerApp.onTickPrev,
      "tick-next": ATBTrackerApp.onTickNext,
      step : ATBTrackerApp.onStep,
      reset: ATBTrackerApp.onReset
    }
  };

  static PARTS = {
    body: { template: "systems/tsdc/templates/apps/atb-tracker.hbs" }
  };

  static onPlan() { openPlanDialogForSelection(); }
  static onClose() { ATBTrackerApp._instance?.close(); }

  static async onTickPrev() { await ATB_API.adjustPlanningTick(-1); }
  static async onTickNext() { await ATB_API.adjustPlanningTick(+1); }
  static async onStep()     { await ATB_API.atbStep(); }
  static async onReset()    { await ATB_API.atbReset(); }

  constructor(options = {}) {
    super(options);
    this._onUpdateCombat = (combat, changes) => {
      const flagsChanged = changes?.flags?.[FLAG_SCOPE]?.[FLAG_KEY] !== undefined;
      const turnOrRound  = ("turn" in (changes||{})) || ("round" in (changes||{}));
      if (flagsChanged || turnOrRound) this.render(false);
    };
    Hooks.on("updateCombat", this._onUpdateCombat);
  }

  async close(options) {
    Hooks.off("updateCombat", this._onUpdateCombat);
    return super.close(options);
  }

  async _prepareContext(_options) {
    const c = game.combat ?? null;
    const state = c ? (await c.getFlag(FLAG_SCOPE, FLAG_KEY)) ?? { actors:{} } : { actors:{} };
    const planningTick = Number(state.planningTick ?? 0);

    const horizon = 12;
    const cols = Array.from({ length: horizon }, (_, i) => i + 1);

    const rows = [];
    if (c && c.combatants) {
      const list = c.combatants.contents ?? Array.from(c.combatants);
      for (const comb of list) rows.push(buildRow(c, state, comb.id, horizon));
    }
    if (!rows.length) {
      rows.push({ name: "—", segments: [{ label: "Libre", phase: "free", gridColumn: `1 / span ${horizon}` }] });
    }

    return {
      horizon, cols, rows,
      planningTick,
      isGM: !!game.user?.isGM
    };
  }

  static open() {
    if (!this._instance) this._instance = new this();
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

export function registerAtbAutoOpen() {
  game.socket?.on("system.tsdc", (data) => {
    if (data?.action === "open-atb-tracker") ATBTrackerApp.open();
  });

  Hooks.on("createCombat", () => {
    if (!game.user?.isGM) return;
    ATBTrackerApp.open();
    game.socket?.emit("system.tsdc", { action: "open-atb-tracker" });
  });

  Hooks.on("updateCombat", (combat, changes) => {
    const justStarted = changes?.started === true ||
      (combat?.started && (changes?.round === 1 || changes?.turn === 0));
    const turnOrRound = ("turn" in (changes||{})) || ("round" in (changes||{}));
    if (justStarted || turnOrRound) {
      ATBTrackerApp.open();
      game.socket?.emit("system.tsdc", { action: "open-atb-tracker" });
    }
  });
}

try { window.tsdcatb = { ...(window.tsdcatb ?? {}), ATBTrackerApp }; } catch {}