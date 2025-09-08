// systems/tsdc/modules/atb/tracker.js
import { listSimpleActions, makeSpecializationAction } from "./actions.js";
import { openPlanDialogForSelection } from "./ui.js"; 

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

export class ATBTrackerApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tsdc-atb-tracker",
    classes: ["tsdc", "atb", "app"],
    window: { title: "ATB — Tracker", resizable: true, minimizable: true },
    position: { width: 860, height: "auto" }
  };

  static PARTS = {
    body: { template: "systems/tsdc/templates/apps/atb-tracker.hbs" }
  };

  constructor(options = {}) {
    super(options);
    // Re-render cuando cambie el combate o nuestros flags
    this._onUpdateCombat = (combat, changes) => {
      const flagsChanged = changes?.flags?.[FLAG_SCOPE]?.[FLAG_KEY] !== undefined;
      const turnOrRound  = ("turn" in (changes || {})) || ("round" in (changes || {}));
      if (flagsChanged || turnOrRound) this.render(false);
    };
    Hooks.on("updateCombat", this._onUpdateCombat);
  }

  async close(options) {
    Hooks.off("updateCombat", this._onUpdateCombat);
    return super.close(options);
  }

  async _prepareContext(_options) {
    const c = game.combat;
    const horizon = 12;
    const cols = Array.from({ length: horizon }, (_v, i) => i);  // <- lo que usa tu HBS
    const rows = [];

    if (c) {
      const state = getState() ?? { actors: {} };
      const list  = c.turns?.length ? c.turns : (c.combatants?.contents ?? []);
      const ids   = list.map(t => t.id).filter(Boolean);
      for (const id of ids) rows.push(buildRow(c, state, id, horizon));
    }

    return { horizon, cols, rows };
  }

  activateListeners(html) {
    super.activateListeners(html);
    const root = html[0];
    root.querySelector('[data-act="plan"]')
      ?.addEventListener("click", () => openPlanDialogForSelection());
    root.querySelector('[data-act="close"]')
      ?.addEventListener("click", () => this.close());
  }

  // Singleton + open
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
  // Abrir en todos los clientes vía socket cuando el GM lo pida
  game.socket?.on("module.tsdc", (data) => {
    if (data?.action === "open-atb-tracker") ATBTrackerApp.open();
  });

  // Al crear combate, abrir automáticamente y avisar a todos
  Hooks.on("createCombat", () => {
    if (game.user?.isGM) {
      ATBTrackerApp.open();
      game.socket?.emit("module.tsdc", { action: "open-atb-tracker" });
    }
  });

  // Al avanzar ronda, re-abrir si alguien lo cerró
  Hooks.on("updateCombat", (combat, changes) => {
    const started = (combat?.started === true);
    const roundChanged = Object.prototype.hasOwnProperty.call(changes || {}, "round");
    if (game.user?.isGM && started && roundChanged) {
      ATBTrackerApp.open();
      game.socket?.emit("module.tsdc", { action: "open-atb-tracker" });
    }
  });
}
