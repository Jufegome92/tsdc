// modules/atb/ui.js
// UI en Combat Tracker: botones y diálogo "Planear" con dropdowns.

import { ATB_API } from "./engine.js";
import { ACTIONS } from "../features/actions/catalog.js";
import { MANEUVERS } from "../features/maneuvers/data.js";
import { RELIC_POWERS } from "../features/relics/data.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* ========= Listas para el diálogo ========= */
function listBasicOptions() {
  const ids = ["mover","ataque","interactuar","soltar","hide"]; // la Especialización tiene su bloque propio
  return ids.map(id => ({ id, name: ACTIONS[id]?.name ?? (id==="hide" ? "Ocultación" : id) }));
}
function listManeuverOptions(actor) {
  const learned = actor?.system?.progression?.maneuvers ?? {};
  const keys = Object.entries(learned).filter(([,n]) => Number(n?.rank||0) > 0).map(([k]) => k);
  const source = keys.length ? keys : Object.keys(MANEUVERS);
  return source.map(k => ({ key:k, name: MANEUVERS[k]?.label ?? k }));
}
function listRelicOptions() {
  return Object.entries(RELIC_POWERS).map(([k,p]) => ({ key:k, name:p?.label ?? k }));
}

/* ========= Diálogo Planer ========= */
class AtbPlanDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tsdc-atb-plan",
    window: { title: "Planear acciones", icon: "fa-solid fa-list-check" },
    position: { width: 640, height: "auto" },
    actions: {
      close: AtbPlanDialog.onClose,
      "plan-basic": AtbPlanDialog.onPlanBasic,
      "plan-maneuver": AtbPlanDialog.onPlanManeuver,
      "plan-relic": AtbPlanDialog.onPlanRelic,
      "plan-spec": AtbPlanDialog.onPlanSpec
    }
  };
  static PARTS = { body: { template: "systems/tsdc/templates/apps/atb-plan.hbs" } };
  static onClose(){ this._instance?.close(); }

  _readTick() {
    const v = Number(this.element?.querySelector?.('input[name="targetTick"]')?.value ?? NaN);
    return Number.isFinite(v) ? v : null;
  }

  static async onPlanBasic() {
    const app = this;
    const sel = app.element.querySelector('select[name="basicKey"]')?.value || "";
    if (!sel) return ui.notifications.warn("Elige una acción básica.");
    const tick = app._readTick();
    const map = { mover:"move", ataque:"attack", interactuar:"interact", soltar:"drop", hide:"hide" };
    const simple = map[sel];
    if (!simple) return ui.notifications.warn("Acción básica desconocida.");
    await ATB_API.enqueueSimpleForSelected(simple, tick);
    ui.notifications.info(`Plan: ${sel} ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
  }
  static async onPlanManeuver() {
    const app = this;
    const key = app.element.querySelector('select[name="maneuverKey"]')?.value || "";
    if (!key) return ui.notifications.warn("Elige una maniobra.");
    const tick = app._readTick();
    await ATB_API.enqueueManeuverForSelected?.(key, tick);
    ui.notifications.info(`Plan: Maniobra ${key} ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
  }
  static async onPlanRelic() {
    const app = this;
    const key = app.element.querySelector('select[name="relicKey"]')?.value || "";
    if (!key) return ui.notifications.warn("Elige un poder de reliquia.");
    const tick = app._readTick();
    await ATB_API.enqueueRelicForSelected?.(key, tick);
    ui.notifications.info(`Plan: Reliquia ${key} ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
  }
  static async onPlanSpec() {
    const app = this;
    const specKey = app.element.querySelector('input[name="specKey"]')?.value?.trim() || "";
    if (!specKey) return ui.notifications.warn("Ingresa la clave de la especialización.");
    const category = app.element.querySelector('select[name="specCat"]')?.value || "physical";
    const CT = Number(app.element.querySelector('select[name="specCT"]')?.value || 2);
    const tick = app._readTick();
    await ATB_API.enqueueSpecForSelected({ specKey, category, CT, targetTick: tick });
    ui.notifications.info(`Plan: Esp. ${specKey} (CT ${CT}) ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
  }

  async _prepareContext() {
    const planningTick = await ATB_API.getPlanningTick();
    const a = canvas.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
    return {
      planningTick,
      basicOptions: listBasicOptions(),
      maneuverOptions: listManeuverOptions(a),
      relicOptions: listRelicOptions()
    };
  }
  static open() { if (!this._instance) this._instance = new this(); this._instance.render(true); return this._instance; }
}

export function openPlanDialogForSelection(){ return AtbPlanDialog.open(); }

/* ========= Botones en el Combat Tracker ========= */
export function registerAtbUI() {
  // Fallback robusto para V13
  Hooks.on("getApplicationHeaderButtons", (app, buttons) => {
    try {
      const isCombatTracker =
        (app instanceof ui.combat.constructor) ||
        (app?.constructor?.name?.includes?.("CombatTracker"));
      if (!isCombatTracker) return;

      buttons.unshift({
        class: "atb-plan",
        label: "Planear",
        icon: "fa-solid fa-layer-group",
        onclick: () => openPlanDialogForSelection()
      });
      buttons.unshift({
        class: "atb-tracker",
        label: "ATB",
        icon: "fa-solid fa-gauge-high",
        onclick: () => {
          const { ATBTrackerApp } = window.tsdcatb ?? {};
          if (ATBTrackerApp?.open) ATBTrackerApp.open();
          else game?.socket?.emit?.("system.tsdc", { action: "open-atb-tracker" });
        }
      });
    } catch (e) { console.error("TSDC ATB | header buttons fallback error", e); }
  });

  Hooks.on("getCombatTrackerHeaderButtons", (_tracker, buttons) => {
    const add = (b) => buttons.unshift(b);
    add({ class: "tsdc-atb-reset", label: "Reset",  icon: "fa-solid fa-rotate-left",   onclick: () => ATB_API.atbReset() });
    add({ class: "tsdc-atb-step",  label: "Step",   icon: "fa-solid fa-forward-step", onclick: () => ATB_API.atbStep() });
    add({ class: "tsdc-atb-pause", label: "⏸",      icon: "fa-solid fa-pause",        onclick: () => ATB_API.atbPause() });
    add({ class: "tsdc-atb-start", label: "ATB ▶",  icon: "fa-solid fa-play",         onclick: () => ATB_API.atbStart() });
    add({ class: "tsdc-atb-plan",  label: "Planear",icon: "fa-solid fa-list-check",   onclick: openPlanDialogForSelection });
  });

  // macro helper
  game.transcendence = game.transcendence || {};
  game.transcendence.openPlanDialog = openPlanDialogForSelection;
}
