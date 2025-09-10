// modules/atb/grimoire.js
import { ATB_API } from "./engine.js";
import { ACTIONS } from "../features/actions/catalog.js";
import { MANEUVERS } from "../features/maneuvers/data.js";

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

/** Heurística para maniobras aprendidas (rank>0) → defs estilo action-card */
function collectLearnedManeuvers(actor) {
  const out = [];
  const tree = actor?.system?.progression?.maneuvers || {};
  for (const [key, node] of Object.entries(tree)) {
    const rank = Number(node?.rank || 0);
    if (rank <= 0) continue;
    const m = MANEUVERS[key];
    if (!m?.ct) continue;
    const def = {
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
    };
    out.push(def);
  }
  return out;
}

/** Placeholder de “aptitudes” (si tuvieras estructura propia, conéctala aquí) */
function collectLearnedAptitudes(actor) {
  const apt = actor?.system?.progression?.aptitudes || {}; // ajusta a tu esquema real
  const out = [];
  for (const [id, node] of Object.entries(apt)) {
    const known = !!node?.known || Number(node?.rank||0) > 0;
    if (!known) continue;
    // Si tus aptitudes también viven en ACTIONS, intenta mapear
    const def = ACTIONS[id];
    if (def) {
      out.push(def);
      continue;
    }
    // Sintético mínimo
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

class GrimoireApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = foundry.utils.mergeObject(super.DEFAULT_OPTIONS, {
    id: "tsdc-grimoire",
    classes: ["tsdc", "grimoire"],
    window: { icon: "fas fa-book" , title: "Grimorio", resizable: true},
    position: { width: 920, height: 640 },
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
  });

  static PARTS = {
    body: { template: "systems/tsdc/templates/apps/grimoire.hbs" }
  };

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

  // ==== Actions
  static onClose() { this.close(); }
  static async onTickPrev(){ await ATB_API.adjustPlanningTick(-1); }
  static async onTickNext(){ await ATB_API.adjustPlanningTick(+1); }
  static onApplyFilter(_ev, _btn){
    const root = this.element;
    const input = root?.querySelector?.('[data-ref="filter"]');
    this._query = (input?.value || "").trim().toLowerCase();
    this.render(false);
  }

  static async onPlanBasic(ev, btn) {
    const app = this;
    const card = btn.closest?.("[data-card]"); if (!card) return;
    const id   = card.dataset.id;
    const tickStr = card.querySelector('input[name="targetTick"]')?.value ?? "";
    const targetTick = tickStr === "" ? null : Number(tickStr);
    const simpleKey = SIMPLE_ID_TO_KEY[id];
    if (id === "especializacion") {
      // desde “básicas” no hay campos; abre aviso:
      return ui.notifications?.warn("Usa la sección de Catálogo → Especialización para ingresar clave/categoría/CT.");
    }
    if (!simpleKey) return ui.notifications?.warn("Acción no planeable aún.");
    await ATB_API.enqueueSimpleForActor(app.actorId, simpleKey, targetTick);
    ui.notifications?.info(`Plan (${id}) ${targetTick!=null?`→ tick ${targetTick}`:"(tick de planeación)"}`);
  }

  static async onPlanCatalog(ev, btn) {
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

  static async onPlanManeuver(ev, btn) {
    const app = this;
    const card = btn.closest?.("[data-card]"); if (!card) return;
    const id   = card.dataset.id;
    const tickStr = card.querySelector('input[name="targetTick"]')?.value ?? "";
    const targetTick = tickStr === "" ? null : Number(tickStr);
    // Por ahora encolamos como “attack” genérico (o crea un bridge si quieres maniobra real)
    // Si tus maniobras son ataques especiales, podrías encolar una acción propia.
    await ATB_API.enqueueSimpleForActor(app.actorId, "attack", targetTick);
    ui.notifications?.info(`Plan: Maniobra ${id} ${targetTick!=null?`→ tick ${targetTick}`:"(tick de planeación)"}`);
  }

  static async onPlanAptitude(ev, btn) {
    const app = this;
    const card = btn.closest?.("[data-card]"); if (!card) return;
    const id   = card.dataset.id;
    const tickStr = card.querySelector('input[name="targetTick"]')?.value ?? "";
    const targetTick = tickStr === "" ? null : Number(tickStr);
    // Si las aptitudes mapean a acciones específicas, aquí deberías traducir id → acción ATB concreta
    ui.notifications?.warn("Falta mapear esta Aptitud a una acción ATB concreta.");
  }

  async _prepareContext() {
    const actor = game.actors?.get?.(this.actorId) || null;
    const planningTick = await ATB_API.getPlanningTick();
    const q = (this._query || "").trim().toLowerCase();

    const canPlan = !!(game.combat && actor && game.combat.combatants.find(c => c.actor?.id === actor.id));

    // ==== Sección Básicas (si están en ACTIONS, mejor render)
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

    // ==== Catálogo filtrado (opcional; por defecto muestra especialización para inputs)
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

    // ==== Mis maniobras (por actor)
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

    // ==== Mis aptitudes (si las tienes modeladas)
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

    return {
      actorName: actor?.name ?? "—",
      planningTick, canPlan, query:q,
      cardsBasic, cardsCatalog,
      cardsManeuvers, cardsAptitudes
    };
  }

  static openForActor(actorId) {
    const actor = game.actors?.get?.(actorId);
    if (!actor) return ui.notifications?.warn("Actor no encontrado.");

    // 👇 Regla de permisos:
    const canOpen = game.user.isGM ||
                    actor.isOwner ||
                    actor.testUserPermission?.(game.user, "OWNER") ||
                    actor.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);

    if (!canOpen) {
      return ui.notifications?.warn("No puedes abrir el grimorio de otro personaje.");
    }

    if (!this._instances) this._instances = new Map();
    let app = this._instances.get(actorId);
    if (!app) {
      app = new this(actorId);
      this._instances.set(actorId, app);
    }
    app.render(true);
    return app;
  }

  static openForCurrentUser() {
    // 1) token controlado por el usuario
    const tk = canvas.tokens?.controlled?.[0] ?? null;
    if (tk?.actor) return this.openForActor(tk.actor.id);
    // 2) user.character
    const a = game.user?.character ?? null;
    if (a) return this.openForActor(a.id);
    ui.notifications?.warn("No hay token seleccionado ni personaje asignado al usuario.");
    return null;
  }
}

/* ==== Accesos globales ==== */

// Botón en controles de Escena (pestaña "token")
export function registerGrimoireGlobalControl() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenCtl = controls.find(c => c.name === "token");
    if (!tokenCtl) return;
    if (tokenCtl.tools.some(t => t.name === "tsdc-grimoire")) return;
    tokenCtl.tools.unshift({
      name: "tsdc-grimoire",
      title: "Abrir Grimorio",
      icon: "fas fa-book", 
      visible: true,
      onClick: () => GrimoireApp.openForCurrentUser()
    });
  });
}

// Botón en el HUD del token
export function registerGrimoireTokenHUD() {
  // HUD clásico
  Hooks.on("renderTokenHUD", (hud, html) => {
    if (html.find('[data-action="tsdc-grimoire"]').length) return;
    const btn = $(`<div class="control-icon" data-action="tsdc-grimoire" title="Grimorio">
      <i class="fas fa-book"></i>
    </div>`);
    btn.on("click", () => GrimoireApp.openForToken(hud.object));
    html.find(".col.right").append(btn);
  });

  // HUD V2 (algunas builds de V12+)
  Hooks.on("renderTokenHUDV2", (hud, element) => {
    if (element.querySelector('[data-action="tsdc-grimoire"]')) return;
    const btn = document.createElement("div");
    btn.className = "control-icon";
    btn.dataset.action = "tsdc-grimoire";
    btn.title = "Grimorio";
    btn.innerHTML = `<i class="fas fa-book"></i>`;
    btn.addEventListener("click", () => GrimoireApp.openForToken(hud.object));
    element.querySelector(".col.right")?.appendChild(btn);
  });
}


export function registerGrimoireButton() {
  Hooks.on("getSceneControlButtons", (controls) => {
    const tokenCtl = controls.find(c => c.name === "token");
    if (!tokenCtl) return;

    // Evitar duplicados
    if (tokenCtl.tools?.some?.(t => t.name === "tsdc-grimoire")) return;

    tokenCtl.tools.push({
      name: "tsdc-grimoire",
      title: "Abrir Grimorio",
      icon: "fas fa-book",
      visible: true,
      onClick: () => GrimoireApp.openForCurrentUser(),
      button: true
    });
  });
}

export function registerGrimoireOnActorSheetHeader() {
  // ApplicationV2 (tu hoja es V2)
  Hooks.on("renderActorSheetV2", (app) => {
    // evita duplicar
    if (app.element?.querySelector?.(".header-button.tsdc-grimoire")) return;
    app.addHeaderButton({
      class: "tsdc-grimoire",
      label: "Grimorio",
      icon: "fas fa-book",
      onclick: () => GrimoireApp.openForActor(app.actor)
    });
  });

  // Fallback V1 por si abres otra hoja no V2
  Hooks.on("renderActorSheet", (app, html) => {
    if (html.closest(".app").find(".header-button.tsdc-grimoire").length) return;
    const a = $(`<a class="header-button tsdc-grimoire"><i class="fas fa-book"></i> Libro</a>`);
    a.on("click", () => GrimoireApp.openForActor(app.actor));
    html.closest(".app").find(".window-header .window-title").after(a);
  });
}

export function registerGrimoireLinkInActorSheet() {
  Hooks.on("renderActorSheet", (app, html) => {
    try {
      const actor = app?.actor;
      if (!actor) return;

      const canSee = game.user.isGM ||
                     actor.isOwner ||
                     actor.testUserPermission?.(game.user, "OWNER") ||
                     actor.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
      if (!canSee) return;

      // Evita duplicados en cualquier sitio
      const rootEl = (html?.[0] || html);
      const winEl  = (app.element?.closest?.(".window-app")) || rootEl?.closest?.(".window-app");
      if (winEl?.querySelector?.('[data-action="tsdc-grimoire-header"]') ||
          rootEl?.querySelector?.('[data-action="tsdc-grimoire-inline"]')) return;

      const openMine = (ev) => {
        ev?.preventDefault?.();
        GrimoireApp.openForActor(actor.id);
      };

      // 1) Intenta header (window header siempre existe)
      const header = winEl?.querySelector?.(".window-header");
      if (header) {
        // si hay grupo de acciones, úsalo; si no, crea uno
        let actions = header.querySelector(".header-actions");
        if (!actions) {
          actions = document.createElement("div");
          actions.className = "header-actions";
          header.appendChild(actions);
        }
        const btn = document.createElement("a");
        btn.className = "header-control";
        btn.dataset.action = "tsdc-grimoire-header";
        btn.title = "Abrir Necronomicón";
        btn.innerHTML = `<i class="fas fa-book"></i><span style="margin-left:.35rem;">Libro</span>`;
        btn.addEventListener("click", openMine);
        actions.prepend(btn); // visible
        return;
      }

      // 2) Fallback: enlace dentro del sheet
      const container = (rootEl instanceof HTMLElement) ? rootEl : null;
      if (!container) return;
      const link = document.createElement("a");
      link.setAttribute("data-action", "tsdc-grimoire-inline");
      link.setAttribute("role", "button");
      link.title = "Abrir tu Grimorio";
      link.className = "tsdc-grimoire-inline";
      link.innerHTML = `<i class="fas fa-book"></i> Necronomicón`;
      link.addEventListener("click", openMine);
      container.prepend(link);
    } catch (e) {
      console.error("TSDC | Error insertando botón de Grimorio", e);
    }
  });
}

try { window.tsdcatb = { ...(window.tsdcatb ?? {}), GrimoireApp }; } catch {}

export { GrimoireApp };
