// modules/atb/ui.js
// UI en Combat Tracker: Start/Pause/Step/Reset y "Planear"

import { listSimpleActions } from "./actions.js";
import { ATB_API } from "./engine.js";

const { DialogV2 } = foundry.applications.api;

export function registerAtbUI() {
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

export function openPlanDialogForSelection() {
  const selected = canvas.tokens?.controlled ?? [];
  if (!selected.length) {
    ui.notifications?.warn("Selecciona al menos un token para planear acciones.");
    // Permitimos abrir igual, por si el GM quiere ver el formulario:
    // return; // <- descomenta si prefieres bloquear el diálogo
  }

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

      <p class="notes">Se encola a los <b>tokens seleccionados</b>. Para maniobras haremos un diálogo aparte.</p>
    </form>
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
          const form = dialog.element[0].querySelector("form");
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
          const form = dialog.element[0].querySelector("form");
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
}
