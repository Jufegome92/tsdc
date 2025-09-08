// modules/atb/ui.js
// UI simple en el Combat Tracker: Start/Pause/Step/Reset y "Planear" (incluye Especialización con CT)

import { listSimpleActions } from "./actions.js";
import { ATB_API } from "./engine.js";

export function registerAtbUI() {
  Hooks.on("getCombatTrackerHeaderButtons", (_tracker, buttons) => {
    buttons.unshift({ class:"tsdc-atb-reset", label:"Reset", icon:"fa-solid fa-rotate-left", onclick: () => ATB_API.atbReset() });
    buttons.unshift({ class:"tsdc-atb-step",  label:"Step",  icon:"fa-solid fa-forward-step", onclick: () => ATB_API.atbStep() });
    buttons.unshift({ class:"tsdc-atb-pause", label:"⏸",    icon:"fa-solid fa-pause", onclick: () => ATB_API.atbPause() });
    buttons.unshift({ class:"tsdc-atb-start", label:"ATB ▶",icon:"fa-solid fa-play",  onclick: () => ATB_API.atbStart() });
    buttons.unshift({ class:"tsdc-atb-plan",  label:"Planear", icon:"fa-solid fa-list-check", onclick: openPlanDialogForSelection });
  });

  game.transcendence = game.transcendence || {};
  game.transcendence.atb = ATB_API;
}

async function openPlanDialogForSelection() {
  const simple = listSimpleActions();
  const simpleOpts = simple.map(a => `<option value="${a.key}">${a.label} — CT ${a.init_ticks + a.exec_ticks + a.rec_ticks}</option>`).join("");

  const html = `
    <form class="t-col" style="gap:10px;min-width:420px;">
      <fieldset class="t-col" style="gap:6px;">
        <legend>Acción Simple</legend>
        <div class="t-row" style="gap:8px; align-items:center;">
          <label style="min-width:88px;">Acción</label>
          <select name="simpleKey">${simpleOpts}</select>
          <label>×</label>
          <input type="number" name="simpleTimes" value="1" min="1" style="width:80px;">
          <button type="button" class="t-btn" data-act="enqueue-simple">Encolar</button>
        </div>
      </fieldset>

      <fieldset class="t-col" style="gap:6px;">
        <legend>Especialización</legend>
        <div class="t-row" style="gap:8px; align-items:center;">
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
          <button type="button" class="t-btn" data-act="enqueue-spec">Encolar</button>
        </div>
      </fieldset>

      <div class="muted">Se encola a todos los <b>tokens seleccionados</b>. Para maniobras las integraremos en otro diálogo.</div>
    </form>
  `;

  const dlg = await foundry.applications.api.DialogV2.wait({
    window: { title: "ATB • Planear (seleccionados)" },
    content: html,
    buttons: []
  });

  // Listeners manuales sobre el DOM del diálogo
  const root = dlg.element[0];
  root.querySelector('[data-act="enqueue-simple"]')?.addEventListener("click", async () => {
    const f = root.querySelector("form");
    const key   = String(f.elements.simpleKey?.value || "");
    const times = Math.max(1, Number(f.elements.simpleTimes?.value || 1));
    for (let i=0;i<times;i++) await ATB_API.enqueueSimpleForSelected(key);
    ui.notifications?.info(`Encolado ${key} × ${times}`);
  });
  root.querySelector('[data-act="enqueue-spec"]')?.addEventListener("click", async () => {
    const f = root.querySelector("form");
    const specKey = String(f.elements.specKey?.value || "").trim();
    if (!specKey) return ui.notifications?.warn("Ingresa la clave de especialización.");
    const category = String(f.elements.specCat?.value || "physical");
    const CT = Number(f.elements.specCT?.value || 2);
    await ATB_API.enqueueSpecForSelected({ specKey, category, CT });
    ui.notifications?.info(`Encolada Especialización ${specKey} (cat=${category}, CT=${CT}).`);
  });
}
