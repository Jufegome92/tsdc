// modules/atb/ui.js
// UI en Combat Tracker: Start/Pause/Step/Reset y "Planear"

import { listSimpleActions } from "./actions.js";
import { ATB_API } from "./engine.js";
import { ACTIONS } from "../features/actions/catalog.js";

const { DialogV2 } = foundry.applications.api;

export function registerAtbUI() {
  // Robust header hook for V13: some environments don't fire getCombatTrackerHeaderButtons reliably.
  Hooks.on("getApplicationHeaderButtons", (app, buttons) => {
    try {
      // Target the Combat Tracker specifically
      const isCombatTracker = app instanceof ui.combat.constructor || app.constructor?.name?.includes("CombatTracker");
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
    } catch(e) {
      console.error("TSDC ATB | header buttons fallback error", e);
    }
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

export async function openPlanDialogForSelection() {
  console.log('ATB UI: openPlanDialogForSelection invoked');

  const simple = listSimpleActions();
  const simpleOpts = simple
    .map(a => `<option value="${a.key}">${a.label} (CT ${a.init_ticks + a.exec_ticks + a.rec_ticks})</option>`)
    .join("");

  const content = `
    <form class="t-col" style="gap:10px;min-width:460px;">
      <fieldset class="t-col" style="gap:6px;">
        <legend>Acción simple</legend>
        <div class="t-row" style="gap:8px;align-items:center;">
          <label style="min-width:88px;">Acción</label>
          <select name="simpleKey">${simpleOpts}</select>
          <label>Veces</label>
          <input type="number" name="simpleTimes" value="1" min="1" style="width:80px;">
        </div>
      </fieldset>

      <fieldset class="t-col" style="gap:6px;">
        <legend>Especialización</legend>
        <div class="t-row" style="gap:8px;align-items:center;">
          <label style="min-width:88px;">Clave</label>
          <input name="specKey" placeholder="p.ej. acrobacias" style="width:180px;">
          <label>Categoría</label>
          <select name="specCat">
            <option value="physical">Física</option>
            <option value="mental">Mental</option>
            <option value="knowledge">Saberes</option>
            <option value="social">Social</option>
          </select>
          <label>CT</label>
          <select name="specCT"><option>1</option><option selected>2</option><option>3</option></select>
        </div>
      </fieldset>
    </form>

    <div data-card-preview style="margin-top:12px;"></div>
  `;

  const dlg = new DialogV2({
    window: { title: "Planear acciones (selección actual)" },
    position: { width: 560 },
    content,
    buttons: [
      {
        label: "Encolar acción simple",
        action: "enqueue-simple",
        callback: async (_ev, _btn, dialog) => {
          const root = (dialog?.element instanceof HTMLElement)
            ? dialog.element
            : (dialog?.element?.[0] || dialog?.element?.el || null);
          if (!root) { console.warn("ATB UI: dialog has no root element"); return; }
          const form = root.querySelector("form");
          const key   = String(form.elements.simpleKey?.value || "");
          if (!key) return ui.notifications?.warn("Elige una acción simple.");
          const times = Math.max(1, Number(form.elements.simpleTimes?.value || 1));
          for (let i = 0; i < times; i++) await ATB_API.enqueueSimpleForSelected(key);
          ui.notifications?.info(`Encolado ${key} × ${times}`);
        }
      },
      {
        label: "Encolar especialización",
        action: "enqueue-spec",
        callback: async (_ev, _btn, dialog) => {
          const root = (dialog?.element instanceof HTMLElement)
            ? dialog.element
            : (dialog?.element?.[0] || dialog?.element?.el || null);
          if (!root) { console.warn("ATB UI: dialog has no root element"); return; }
          const form = root.querySelector("form");
          const specKey  = String(form.elements.specKey?.value || "").trim();
          if (!specKey) return ui.notifications?.warn("Ingresa la clave de la especialización.");
          const category = String(form.elements.specCat?.value || "physical");
          const CT       = Number(form.elements.specCT?.value || 2);
          await ATB_API.enqueueSpecForSelected({ specKey, category, CT });
          ui.notifications?.info(`Encolada Especialización ${specKey} (cat=${category}, CT=${CT}).`);
        }
      },
      { label: "Cerrar", action: "close" }
    ]
  });

  dlg.render(true);

  Hooks.once("renderDialogV2", (app, html) => {
    if (app !== dlg) return;
    const root = html instanceof HTMLElement ? html : (html?.[0] || html?.el || null);
    if (!root) return;

    const sel = root.querySelector('select[name="simpleKey"]');
    const ct  = root.querySelector('select[name="specCT"]');
    const refresh = () => renderActionPreview(root, sel?.value, Number(ct?.value || 2));

    sel?.addEventListener("change", refresh);
    ct?.addEventListener("change", refresh);
    refresh(); // primera vez
  });
}

async function renderActionPreview(root, actionId, chosenCT = 2) {
  const slot = root.querySelector("[data-card-preview]");
  if (!slot) return;
  const SIMPLE_TO_ACTIONS = {
   move: "mover",
   attack: "ataque",
   interact: "interactuar",
   defend: "defender",
   specialization: "especializacion"
 };
  const mapped = SIMPLE_TO_ACTIONS[actionId] ?? actionId;
  const def = ACTIONS[mapped];
  if (!def) { slot.innerHTML = ""; return; }

  const ct = def.ctOptions ? (def.ctOptions[chosenCT] || def.ctOptions[2]) : def.ct;
  const rt =
    foundry.applications?.handlebars?.renderTemplate
    ?? globalThis.renderTemplate; // fallback

  if (!rt) {
    console.error("No hay función renderTemplate disponible.");
    slot.innerHTML = "";
    return;
  }

  const html = await rt(
    "systems/tsdc/templates/cards/action-card.hbs",
    { ...def, ct }
  );
  slot.innerHTML = html;
}