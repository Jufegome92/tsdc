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
function __addActorHeaderButton(app, html) {
  const $ = window.jQuery ?? window.$;
  const actor = app?.actor ?? app?.document;
  console.log("TSDC | renderActorSheet hook fired", { has$: !!$, actorId: actor?.id, v2: !!app?.elementV2 });
  if (!$) return;
  if (!actor || actor.documentName !== "Actor") return;

  // html puede ser jQuery, ArrayLike o HTMLElement; si viene vacío, usa el root del app
  const $container = $(html?.[0] ?? html ?? app?.element ?? app?.elementV2);
  if (!$container.length) return;

  const $win = $container.closest(".window-app");
  if (!$win.length) return;
  if ($win.find('[data-action="tsdc-grimoire-header"]').length) return;

  const $header = $win.find(".window-header");
  if (!$header.length) return;

  let $actions = $header.find(".header-actions");
  if (!$actions.length) $actions = $(`<div class="header-actions" />`).appendTo($header);

  const $btn = $(`
    <a class="header-control" data-action="tsdc-grimoire-header" title="Abrir Grimorio">
      <i class="fa-solid fa-book"></i><span style="margin-left:.35rem;">Grimorio</span>
    </a>
  `);
  $btn.on("click", () => window.tsdcatb?.GrimoireApp?.openForActor(actor.id));
  $actions.prepend($btn);

  console.log("TSDC | Sheet: botón del grimorio insertado");
}

/* =========================
 * HUD del token (robusto, DOM + Observer)
 * ========================= */
function __injectHudBtn($root, hud) {
  const $ = window.jQuery ?? window.$;
  if (!$) return;
  if (!$root || !$root.length) return;

  // 1) Encuentra la columna derecha (sin filtros)
  const $right = $root.find('.col.right, [data-group="right"]').first();
  if (!$right.length) return; // si aún no existe, el caller volverá a intentar

  // 2) Evita duplicados
  if ($right.find('.control-icon.tsdc-grimoire').length) return;

  // 3) Copia el tag que ya usa el HUD (button o div)
  const tag = ($right.find('.control-icon').first().prop('tagName') || 'BUTTON').toLowerCase();
  const $btn = $(
    `<${tag} class="control-icon tsdc-grimoire" data-action="tsdc-grimoire"
       title="Abrir Grimorio" data-tooltip="Abrir Grimorio">
       <i class="fa-solid fa-book"></i>
     </${tag}>`
  );

  $btn.on('click', () => {
    const actor = (hud?.object ?? hud?.token)?.actor;
    if (!actor) return ui.notifications?.warn("Selecciona tu token (o asigna tu actor).");
    window.tsdcatb?.GrimoireApp?.openForActor(actor.id);
  });

  $right.append($btn);
  console.log("TSDC | TokenHUD: botón Grimorio insertado");
}


function __asEl(maybeHtml, maybeHud) {
  if (!maybeHtml) return (maybeHud?.element ?? null) || null;
  if (maybeHtml instanceof Element) return maybeHtml;
  // jQuery-like
  if (typeof maybeHtml === "object" && "0" in maybeHtml) return maybeHtml[0] ?? null;
  return null;
}

function __logEl(prefix, el) {
  try {
    const tag = el?.tagName || "null";
    const cls = el?.className || "";
    console.log(`TSDC | ${prefix}:`, {tag, cls});
  } catch {}
}

function __findRightColumn(rootEl) {
  if (!rootEl) return null;
  // Intenta selectores típicos de core y temas
  const selectors = [
    ".col.right",
    "[data-group='right']",
    ".right",
    ".right-col",
    ".rightcol",
    ".tokenhud .right",      // por si el tema anida más
    ".tokenhud [data-group='right']"
  ];
  for (const sel of selectors) {
    const node = rootEl.querySelector(sel);
    if (node) return node;
  }
  return null;
}

function __firstControlIcon(rootEl) {
  if (!rootEl) return null;
  return rootEl.querySelector(".control-icon");
}

function __injectHudBtn_Native(rootEl, hud) {
  if (!rootEl) return;

  // 1) Encuentra columna derecha
  const right = __findRightColumn(rootEl);
  __logEl("HUD right-col", right);
  if (!right) return; // no está lista aún, el caller reintenta

  // 2) Evita duplicados
  if (right.querySelector(".control-icon.tsdc-grimoire")) {
    console.log("TSDC | HUD: botón ya existe, no se duplica");
    return;
  }

  // 3) Copia el tag del primer icono existente (<button> o <div>)
  const proto = __firstControlIcon(rootEl);
  __logEl("HUD first control-icon", proto);
  const tag = (proto?.tagName || "BUTTON").toLowerCase();

  const btn = document.createElement(tag);
  btn.className = "control-icon tsdc-grimoire";
  btn.setAttribute("data-action", "tsdc-grimoire");
  btn.setAttribute("title", "Abrir Grimorio");
  btn.setAttribute("data-tooltip", "Abrir Grimorio");

  const i = document.createElement("i");
  i.className = "fa-solid fa-book";
  btn.appendChild(i);

  btn.addEventListener("click", () => {
    const actor = (hud?.object ?? hud?.token)?.actor;
    if (!actor) return ui.notifications?.warn("Selecciona tu token (o asigna tu actor).");
    window.tsdcatb?.GrimoireApp?.openForActor(actor.id);
  });

  right.appendChild(btn);
  console.log("TSDC | HUD: botón Grimorio insertado OK");
}

function __addHudButton_Robusto(hud, html) {
  const rootEl = __asEl(html, hud);
  __logEl("renderTokenHUD root", rootEl);

  // Si por cualquier razón no hay root, sal con log
  if (!rootEl) {
    console.warn("TSDC | renderTokenHUD: no rootEl");
    return;
  }

  // Espera 1 frame para que el HUD termine de montar sus columnas
  requestAnimationFrame(() => {
    try {
      __injectHudBtn_Native(rootEl, hud);
    } catch (e) {
      console.error("TSDC | HUD inject error:", e);
    }

    // Reinyecta si el tema re-renderiza internamente
    const mo = new MutationObserver((_muts) => {
      try { __injectHudBtn_Native(rootEl, hud); } catch {}
    });
    mo.observe(rootEl, { childList: true, subtree: true });
    console.log("TSDC | HUD: observer activo");
  });
}


/* =========================
 * Scene Controls (fallback DOM)
 * ========================= */
function __addSceneControlButton_DOM(_app, html /*, data */) {
  // Pestaña "token"
  const $ = window.jQuery ?? window.$; if (!$) return;
  const $html = $(html?.[0] ?? html);
  if (!$html.length) return;

  // Contenedor de herramientas de la pestaña activa
  const $tools = $html.find('.scene-control[data-control="token"] ~ ol.control-tools');
  // Si no lo encontramos (tema distinto), buscamos cualquier grupo de tools con data-control="token"
  const $tokenCtl = $html.find('.scene-control[data-control="token"]');
  const $list = $tools.length ? $tools : $tokenCtl.parent().find('ol.control-tools').first();
  if (!$list.length) return;

  if ($list.find('li[data-tool="tsdc-grimoire"]').length) return;

  const $li = $(`
    <li class="control-tool" data-tool="tsdc-grimoire" title="Abrir Grimorio">
      <i class="fas fa-book fa-solid fa-book"></i>
    </li>
  `);
  $li.on('click', () => {
    const tk = canvas.tokens?.controlled?.[0];
    const actor = tk?.actor ?? game.user?.character;
    if (!actor) return ui.notifications.warn("Selecciona tu token o asigna tu actor.");
    window.tsdcatb?.GrimoireApp?.openForActor(actor.id);
  });

  $list.append($li);
}

/* =========================
 * Registro
 * ========================= */
Hooks.once("init", () => {
  // mantenemos tu getSceneControlButtons (si alguna vez trae datos, perfecto)
  Hooks.on("getSceneControlButtons", (arg) => {
    const controls = Array.isArray(arg) ? arg : arg?.controls ?? [];
    console.log("TSDC | getSceneControlButtons hook fired", { count: controls?.length ?? 0 });
    const tokenCtl = controls?.find?.(c => c.name === "token");
    if (!tokenCtl) return;
    tokenCtl.tools ??= [];
    if (tokenCtl.tools.some(t => t.name === "tsdc-grimoire")) return;
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
});

Hooks.once("ready", () => {
  console.log("TSDC | registrando botones del Grimorio…");
  // HUD del token (DOM + observer)
  console.log("TSDC | hook renderTokenHUD registrado");
  Hooks.on("renderTokenHUD", __addHudButton_Robusto);

  // Fallback DOM en la barra de controles
  Hooks.on("renderSceneControls", __addSceneControlButton_DOM);
  Hooks.on("canvasReady", () => {
    // una pasada extra cuando todo está listo
    ui.controls?.render?.({
      controls: ui.controls?.controls ?? [],
      tool: ui.controls?.tool?.name ?? ui.controls?.activeTool
    });
  });

  // botones en cabecera (se mantienen igual)
  Hooks.on("renderActorSheet", __addActorHeaderButton);
  Hooks.on("renderActorSheetV2", __addActorHeaderButton);
  console.log("TSDC | Grimorio: botones registrados");
});


/* Exponer para macros */
try { window.tsdcatb = { ...(window.tsdcatb ?? {}), GrimoireApp }; } catch {}
