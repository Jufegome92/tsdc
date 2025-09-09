// systems/tsdc/modules/atb/tracker.js
import { listSimpleActions, makeSpecializationAction } from "./actions.js";
import { openPlanDialogForSelection } from "./ui.js"; 
import { ATB_API } from "./engine.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const FLAG_SCOPE = "tsdc";
const FLAG_KEY   = "atb";

/* ===========================
 * Helpers de estado y render
 * =========================== */

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
    position: { width: 860, height: "auto" },
    actions: {
      plan : ATBTrackerApp.onPlan,
      close: ATBTrackerApp.onClose,
      start: ATBTrackerApp.onStart,
      pause: ATBTrackerApp.onPause,
      step : ATBTrackerApp.onStep,
      reset: ATBTrackerApp.onReset
    }
  };

  static PARTS = {
    body: { template: "systems/tsdc/templates/apps/atb-tracker.hbs" }
  };

  // acciones (deben ser estáticas; `this` apunta a la instancia)
  static onPlan(_ev, _target) {
    openPlanDialogForSelection();
  }
  static onClose(_ev, _target) {
    this.close();
  }

  static onStart(_ev, _target) {
    ATB_API.atbStart();
  }

  static onPause(_ev, _target) {
    ATB_API.atbPause();
  }

  static onStep(_ev, _target)  {
    ATB_API.atbStep();
  }
  
  static onReset(_ev, _target) {
    ATB_API.atbReset();
  }

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
    // 1) Lee el combate y el estado persistido en flags
    const c = game.combat ?? null;
    const state = getState() ?? { actors: {} };

    // 2) Horizonte de ticks a mostrar (ajústalo a gusto)
    const horizon = 12;

    // 3) Columnas para la cabecera 1..horizon
    const cols = Array.from({ length: horizon }, (_ , i) => i + 1);

    // 4) Construye las filas a partir de los combatientes actuales
    const rows = [];
    if (c && c.combatants) {
      const list = c.combatants.contents ?? Array.from(c.combatants); // compatible
      for (const comb of list) {
        rows.push(buildRow(c, state, comb.id, horizon));
      }
    }

    // 5) Si no hay combate o no hay filas, muestra un placeholder
    if (!rows.length) {
      rows.push({
        name: "—",
        segments: [{ label: "Libre", phase: "free", gridColumn: `1 / span ${horizon}` }]
      });
    }

    return { horizon, cols, rows };
  }

  static open() {
    if (!this._instance) this._instance = new this();
    this._instance.render(true);
    return this._instance;
  }
}

/* ===========================
 * Botón y auto-open
 * =========================== */

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
  // 🔧 Unifico canal y payload
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

// (si exportabas la clase para debug, lo puedes dejar igual)
try { window.tsdcatb = { ...(window.tsdcatb ?? {}), ATBTrackerApp }; } catch {}