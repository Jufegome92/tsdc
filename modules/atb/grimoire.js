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
  static DEFAULT_OPTIONS = {
    id: "tsdc-grimoire",
    window: { icon: "fa-solid fa-book-skull" },
    position: { width: 920, height: "auto" },
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
    if (!actorId) return ui.notifications?.warn("Selecciona un token o abre una hoja de actor.");
    if (!this._instances) this._instances = new Map();
    let app = this._instances.get(actorId);
    if (!app) {
      app = new this(actorId);
      this._instances.set(actorId, app);
      app.render(true);
    } else app.render(true);
    return app;
  }

  static openForCurrentUser() {
    // 1) token controlado
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
    tokenCtl.tools.unshift({
      name: "tsdc-grimoire",
      title: "Abrir Necronomicón",
      icon: "fa-solid fa-book-skull",
      visible: true,
      onClick: () => GrimoireApp.openForCurrentUser(),
      button: true
    });
  });
}

// Botón en el HUD del token
export function registerGrimoireTokenHUD() {
  Hooks.on("renderTokenHUD", (_hud, html, data) => {
    try {
      const actorId = data?.actorId ?? data?.actor?._id ?? null;
      if (!actorId) return;
      const btn = $(`<div class="control-icon" title="Necronomicón"><i class="fa-solid fa-book-skull"></i></div>`);
      btn.on("click", () => GrimoireApp.openForActor(actorId));
      html.find(".col.right").append(btn);
    } catch (e) {
      console.error("TSDC | Grimoire token HUD error", e);
    }
  });
}

// Macro helper
try {
  game.transcendence = game.transcendence || {};
  game.transcendence.openGrimoire = (actorId=null) => {
    if (actorId) return GrimoireApp.openForActor(actorId);
    return GrimoireApp.openForCurrentUser();
  };
} catch { }

try { window.tsdcatb = { ...(window.tsdcatb ?? {}), GrimoireApp }; } catch {}

export { GrimoireApp };
