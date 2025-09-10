// modules/atb/grimoire.js
console.log("TSDC | grimoire.js cargado");

(function ensureStyle() {
  const ID = "tsdc-grimoire-style";
  if (document.getElementById(ID)) return;
  const s = document.createElement("style");
  s.id = ID;
  s.textContent = `
    /* Fuerza scroll en el grimorio, independientemente del tema */
    .tsdc.grimoire,
    .tsdc.grimoire .window-content,
    #tsdc-grimoire,
    #tsdc-grimoire .window-content {
      overflow-y: auto !important;
      max-height: 80vh !important;
      height: auto !important;
    }
    /* Por si el tema usa contenedores internos */
    .tsdc.grimoire .sheet-body,
    .tsdc.grimoire .content,
    .tsdc.grimoire [data-scroll],
    #tsdc-grimoire .sheet-body,
    #tsdc-grimoire .content,
    #tsdc-grimoire [data-scroll] {
      overflow-y: auto !important;
      max-height: 80vh !important;
    }
  `;
  document.head.appendChild(s);
})();

import { ATB_API } from "./engine.js";
import { ACTIONS } from "../features/actions/catalog.js";
import { MANEUVERS } from "../features/maneuvers/data.js";

/* =========================
 * Utilidades
 * ========================= */
function _normalizeControlsArg(arg) {
  if (Array.isArray(arg)) return arg;                       // v10–v12
  if (Array.isArray(arg?.controls)) return arg.controls;    // v13+
  if (Array.isArray(ui?.controls?.controls)) return ui.controls.controls;
  return [];
}

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const SIMPLE_ID_TO_KEY = { mover:"move", ataque:"attack", interactuar:"interact", soltar:"drop" };
const BASIC_ORDER = ["mover", "ataque", "interactuar", "soltar", "especializacion"];

function hasTemplateRenderer() {
  return !!(foundry.applications?.handlebars?.renderTemplate || globalThis.renderTemplate);
}
function renderTpl(path, data) {
  const rt = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return rt(path, data);
}

/* =========================
 * Data helpers
 * ========================= */
function collectLearnedManeuvers(actor) {
  const out = [];
  const tree = actor?.system?.progression?.maneuvers || {};
  for (const [key, node] of Object.entries(tree)) {
    const rank = Number(node?.rank || 0);
    if (rank <= 0) continue;
    const m = MANEUVERS[key];
    if (!m?.ct) continue;
    out.push({
      id: key,
      name: m.label ?? key,
      description: m.description ?? "",
      ct: { I: m.ct.init ?? 0, E: m.ct.exec ?? 1, R: m.ct.rec ?? 0 },
      range: m.range ?? "—",
      area: m.area ?? "—",
      keywords: {
        type:"maneuver",
        clazz: m.type ?? "",
        category: m.category ?? "",
        descriptors: [].concat(m.descriptor||[]),
        elements: [].concat(m.element||[])
      },
      rolls: m.rolls ?? []
    });
  }
  return out;
}
function collectLearnedAptitudes(actor) {
  const apt = actor?.system?.progression?.aptitudes || {};
  const out = [];
  for (const [id, node] of Object.entries(apt)) {
    const known = !!node?.known || Number(node?.rank||0) > 0;
    if (!known) continue;
    const def = ACTIONS[id];
    if (def) { out.push(def); continue; }
    out.push({
      id, name: node?.label ?? id, description: node?.description ?? "",
      ct: node?.ct ?? { I:0, E:1, R:0 },
      range: node?.range ?? "—",
      area: node?.area ?? "—",
      keywords: { type:"aptitude", clazz:"", category:"", descriptors:[], elements:[] },
      rolls: node?.rolls ?? []
    });
  }
  return out;
}

/* =========================
 * App Grimorio
 * ========================= */
export class GrimoireApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS =  {
    id: "tsdc-grimoire",
    classes: ["tsdc", "grimoire"],
    window: { icon: "fa-solid fa-book fas fa-book", title: "Grimorio", resizable: true },
    position: { width: 760, height: 640 },
    actions: {
      close: GrimoireApp.onClose,
      "tick-prev": GrimoireApp.onTickPrev,
      "tick-next": GrimoireApp.onTickNext,
      "apply-filter": GrimoireApp.onApplyFilter,
      "plan-basic": GrimoireApp.onPlanBasic,
      "plan-catalog": GrimoireApp.onPlanCatalog,
      "plan-maneuver": GrimoireApp.onPlanManeuver,
      "plan-aptitude": GrimoireApp.onPlanAptitude
    }
  };
  static DEFAULT_SUBCLASS_OPTIONS = this.DEFAULT_OPTIONS;
  static PARTS = { body: { template: "systems/tsdc/templates/apps/grimoire.hbs" } };

  constructor(actorId, options={}) {
    super(options);
    this.actorId = actorId ?? null;
    this._query = "";
    this._onUpdate = () => this.render(false);
    Hooks.on("updateActor", this._onUpdate);
    Hooks.on("updateCombat", this._onUpdate);
  }
  async close(opts) {
    Hooks.off("updateActor", this._onUpdate);
    Hooks.off("updateCombat", this._onUpdate);
    return super.close(opts);
  }

  /** Fuerza scroll aunque el tema lo bloquee */
  activateListeners(html) {
    super.activateListeners?.(html);
    try {
      const el = this.element;
      const body = el?.querySelector?.(".window-content") || el;
      if (el) { el.style.overflowY = "auto"; el.style.maxHeight = "80vh"; el.style.minHeight = "360px"; }
      if (body) { body.style.overflowY = "auto"; body.style.maxHeight = "80vh"; }
    } catch (e) {
      console.warn("TSDC | No se pudo aplicar overflow al Grimorio:", e);
    }
  }

  // ==== Actions
  static onClose() { this.close(); }
  static async onTickPrev(){ await ATB_API.adjustPlanningTick(-1); }
  static async onTickNext(){ await ATB_API.adjustPlanningTick(+1); }
  static onApplyFilter(){
    const input = this.element?.querySelector?.('[data-ref="filter"]');
    this._query = (input?.value || "").trim().toLowerCase();
    this.render(false);
  }
  static async onPlanBasic(_ev, btn) {
    const app = this;
    const card = btn.closest?.("[data-card]"); if (!card) return;
    const id   = card.dataset.id;
    const tickStr = card.querySelector('input[name="targetTick"]')?.value ?? "";
    const targetTick = tickStr === "" ? null : Number(tickStr);
    const simpleKey = SIMPLE_ID_TO_KEY[id];
    if (id === "especializacion") return ui.notifications?.warn("Usa Catálogo → Especialización.");
    if (!simpleKey) return ui.notifications?.warn("Acción no planeable aún.");
    await ATB_API.enqueueSimpleForActor(app.actorId, simpleKey, targetTick);
    ui.notifications?.info(`Plan (${id}) ${targetTick!=null?`→ tick ${targetTick}`:"(tick de planeación)"}`);
  }
  static async onPlanCatalog(_ev, btn) {
    const app = this;
    const card = btn.closest?.("[data-card]"); if (!card) return;
    const id   = card.dataset.id;
    const tickStr = card.querySelector('input[name="targetTick"]')?.value ?? "";
    const targetTick = tickStr === "" ? null : Number(tickStr);
    if (id === "especializacion") {
      const specKey = card.querySelector('input[name="specKey"]')?.value?.trim() || "";
      const speccat = card.querySelector('select[name="specCat"]')?.value || "physical";
      const ct      = Number(card.querySelector('select[name="specCT"]')?.value || 2);
      if (!specKey) return ui.notifications?.warn("Ingresa la clave de la especialización.");
      await ATB_API.enqueueSpecForActor(app.actorId, { specKey, category: speccat, CT: ct, targetTick });
      return ui.notifications?.info(`Plan: Especialización ${specKey} (CT ${ct}) ${targetTick!=null?`→ tick ${targetTick}`:"(tick de planeación)"}`);
    }
    if (id in SIMPLE_ID_TO_KEY) {
      await ATB_API.enqueueSimpleForActor(app.actorId, SIMPLE_ID_TO_KEY[id], targetTick);
      return ui.notifications?.info(`Plan (${id}) ${targetTick!=null?`→ tick ${targetTick}`:"(tick de planeación)"}`);
    }
    ui.notifications?.warn("Esta acción del catálogo aún no es planeable desde el libro.");
  }
  static async onPlanManeuver(_ev, btn) {
    const app = this;
    const card = btn.closest?.("[data-card]"); if (!card) return;
    const id   = card.dataset.id;
    const tickStr = card.querySelector('input[name="targetTick"]')?.value ?? "";
    const targetTick = tickStr === "" ? null : Number(tickStr);
    await ATB_API.enqueueSimpleForActor(app.actorId, "attack", targetTick);
    ui.notifications?.info(`Plan: Maniobra ${id} ${targetTick!=null?`→ tick ${targetTick}`:"(tick de planeación)"}`);
  }
  static async onPlanAptitude(_ev, btn) {
    const app = this;
    const card = btn.closest?.("[data-card]"); if (!card) return;
    const id   = card.dataset.id;
    const tickStr = card.querySelector('input[name="targetTick"]')?.value ?? "";
    const targetTick = tickStr === "" ? null : Number(tickStr);
    ui.notifications?.warn("Falta mapear esta Aptitud a una acción ATB concreta.");
  }

  async _prepareContext() {
    const actor = game.actors?.get?.(this.actorId) || null;
    const planningTick = await ATB_API.getPlanningTick();
    const q = (this._query || "").trim().toLowerCase();
    const canPlan = !!(game.combat && actor && game.combat.combatants.find(c => c.actor?.id === actor.id));

    // Básicas
    const cardsBasic = [];
    for (const id of BASIC_ORDER) {
      const def = ACTIONS[id];
      if (def) {
        const chosenCT = def.ctOptions ? (def.ctOptions[2] ? 2 : Number(Object.keys(def.ctOptions)[0])) : null;
        const ct = def.ctOptions ? (def.ctOptions[chosenCT] || Object.values(def.ctOptions)[0]) : def.ct;
        const html = hasTemplateRenderer()
          ? await renderTpl("systems/tsdc/templates/cards/action-card.hbs", { ...def, ct })
          : `<div class="tsdc-card"><header class="c-head">${def.name}</header></div>`;
        cardsBasic.push({ id, html, isSpec:(id==="especializacion") });
      } else {
        cardsBasic.push({ id, html:`<div class="tsdc-card"><header class="c-head">${id}</header></div>`, isSpec:false });
      }
    }

    // Catálogo (mostrar al menos Especialización)
    const cardsCatalog = [];
    if (!q || "especializacion".includes(q)) {
      const def = ACTIONS["especializacion"];
      const chosenCT = def?.ctOptions ? (def.ctOptions[2] ? 2 : Number(Object.keys(def.ctOptions)[0])) : null;
      const ct = def?.ctOptions ? (def.ctOptions[chosenCT] || Object.values(def.ctOptions)[0]) : def?.ct;
      const html = hasTemplateRenderer() && def
        ? await renderTpl("systems/tsdc/templates/cards/action-card.hbs", { ...def, ct })
        : `<div class="tsdc-card"><header class="c-head">Especialización</header></div>`;
      cardsCatalog.push({ id:"especializacion", html, isSpec:true });
    }

    // Mis maniobras
    const maneuvers = collectLearnedManeuvers(actor);
    const cardsManeuvers = [];
    for (const def of maneuvers) {
      const hay = (s) => (String(s||"").toLowerCase().includes(q));
      if (q && !(hay(def.name)||hay(def.description))) continue;
      const html = hasTemplateRenderer()
        ? await renderTpl("systems/tsdc/templates/cards/action-card.hbs", { ...def })
        : `<div class="tsdc-card"><header class="c-head">${def.name}</header></div>`;
      cardsManeuvers.push({ id:def.id, html });
    }

    // Mis aptitudes
    const aptitudes = collectLearnedAptitudes(actor);
    const cardsAptitudes = [];
    for (const def of aptitudes) {
      const hay = (s) => (String(s||"").toLowerCase().includes(q));
      if (q && !(hay(def.name)||hay(def.description))) continue;
      const html = hasTemplateRenderer()
        ? await renderTpl("systems/tsdc/templates/cards/action-card.hbs", { ...def })
        : `<div class="tsdc-card"><header class="c-head">${def.name}</header></div>`;
      cardsAptitudes.push({ id:def.id, html });
    }

    return { actorName: actor?.name ?? "—", planningTick, canPlan, query:q,
      cardsBasic, cardsCatalog, cardsManeuvers, cardsAptitudes };
  }

  // API de apertura con permisos
  static openForActor(actorId) {
    const actor = game.actors?.get?.(actorId);
    if (!actor) return ui.notifications?.warn("Actor no encontrado.");
    const canOpen = game.user.isGM ||
                    actor.isOwner ||
                    actor.testUserPermission?.(game.user, "OWNER") ||
                    actor.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
    if (!canOpen) return ui.notifications?.warn("No puedes abrir el grimorio de otro personaje.");
    if (!this._instances) this._instances = new Map();
    let app = this._instances.get(actorId);
    if (!app) { app = new this(actorId); this._instances.set(actorId, app); }
    app.render(true);
    return app;
  }
  static openForCurrentUser() {
    const tk = canvas.tokens?.controlled?.[0] ?? null;
    if (tk?.actor) return this.openForActor(tk.actor.id);
    const a = game.user?.character ?? null;
    if (a) return this.openForActor(a.id);
    ui.notifications?.warn("No hay token seleccionado ni personaje asignado al usuario.");
    return null;
  }
}

/* =========================
 * Inyección de botones (robusta)
 * ========================= */

// HUD del token — pref. columna derecha
function __addHudButton(hud, html) {
  const $ = window.jQuery ?? window.$;
  if (!$) return;

  const $root = html && html.length ? html : $(hud.element);
  if (!$root.length) return;
  if ($root.find(".control-icon.tsdc-grimoire").length) return;

  let $host = $root.find(".col.right");        // muchos temas muestran la derecha
  if (!$host.length) $host = $root.find(".col.left");
  if (!$host.length) {
    $host = $(`<div class="col right" />`).css({ display: "flex", flexDirection: "column", gap: "6px" });
    $root.append($host);
  }

  const $btn = $(`
    <div class="control-icon tsdc-grimoire" data-tooltip="Abrir Grimorio">
      <i class="fas fa-book fa-solid fa-book"></i>
    </div>
  `);
  $btn.on("click", () => {
    const actor = (hud.object ?? hud.token)?.actor;
    if (!actor) return ui.notifications?.warn("No hay actor en este token.");
    if (!game.user.isGM && !actor.isOwner) return ui.notifications?.warn("No tienes permiso.");
    window.tsdcatb?.GrimoireApp?.openForActor(actor.id);
  });

  $host.append($btn);
}

// Hoja de actor (v1 y v2)
function __addActorHeaderButton(app, html) {
  const $ = window.jQuery ?? window.$;
  if (!$) return;
  const actor = app?.actor ?? app?.document;
  if (!actor || actor.documentName !== "Actor") return;

  const $win = html.closest(".window-app");
  if (!$win.length) return;
  if ($win.find('[data-action="tsdc-grimoire-header"]').length) return;

  const $header = $win.find(".window-header");
  if (!$header.length) return;

  let $actions = $header.find(".header-actions");
  if (!$actions.length) $actions = $(`<div class="header-actions" />`).appendTo($header);

  const $btn = $(`
    <a class="header-control" data-action="tsdc-grimoire-header" title="Abrir Grimorio">
      <i class="fas fa-book fa-solid fa-book"></i><span style="margin-left:.35rem;">Grimorio</span>
    </a>
  `);
  $btn.on("click", () => window.tsdcatb?.GrimoireApp?.openForActor(actor.id));
  $actions.prepend($btn);
}

// Scene Controls (pestaña Token)
function __registerSceneControl() {
  Hooks.on("getSceneControlButtons", (arg) => {
    const controls = _normalizeControlsArg(arg);
    const tokenCtl = controls.find(c => c.name === "token");
    if (!tokenCtl) return;
    if (tokenCtl.tools?.some?.(t => t.name === "tsdc-grimoire")) return;

    tokenCtl.tools.push({
      name: "tsdc-grimoire",
      title: "Abrir Grimorio",
      icon: "fas fa-book",
      button: true,
      visible: true,
      onClick: () => {
        const tk = canvas.tokens?.controlled?.[0];
        const actor = tk?.actor ?? game.user?.character;
        if (!actor) return ui.notifications.warn("Selecciona tu token o asigna tu actor.");
        window.tsdcatb?.GrimoireApp?.openForActor(actor.id);
      }
    });
  });
}

/* =========================
 * Registro automático
 * ========================= */
Hooks.once("ready", () => {
  console.log("TSDC | registrando botones del Grimorio…");
  __registerSceneControl();
  Hooks.on("renderTokenHUD", __addHudButton);
  Hooks.on("renderActorSheet", __addActorHeaderButton);
  Hooks.on("renderActorSheetV2", __addActorHeaderButton);
  console.log("TSDC | Grimorio: botones registrados");
});

/* Exponer para macros */
try { window.tsdcatb = { ...(window.tsdcatb ?? {}), GrimoireApp }; } catch {}
