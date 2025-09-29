// modules/atb/grimoire.js
import { ATB_API } from "./engine.js";
import { ACTIONS } from "../features/actions/catalog.js";
import { MANEUVERS } from "../features/maneuvers/data.js";
import { RELIC_POWERS } from "../features/relics/data.js";
import { APTITUDES } from "../features/aptitudes/data.js";
import { actorKnownManeuvers, actorKnownRelicPowers, actorKnownNotes } from "../features/known.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

(function ensureStyle() {
  const ID = "tsdc-grimoire-style";
  if (document.getElementById(ID)) return;
  const s = document.createElement("style");
  s.id = ID;
  s.textContent = `
    .tsdc.grimoire, .tsdc.grimoire .window-content { overflow-y:auto !important; max-height:80vh !important; }
    .tsdc.grimoire .g-tabs .active { background: var(--color-underline-header); }
  `;
  document.head.appendChild(s);
})();

function hasTemplateRenderer() {
  return !!(foundry.applications?.handlebars?.renderTemplate || globalThis.renderTemplate);
}
function renderTpl(path, data) {
  const rt = foundry.applications?.handlebars?.renderTemplate ?? globalThis.renderTemplate;
  return rt(path, data);
}

/* ===== Helpers para colecciones ===== */
function collectBasics() {
  const ids = ["mover","ataque","dual-wield","interactuar","soltar","especializacion","hide"];
  return ids.map(id => {
    const def = ACTIONS[id];
    const title = def?.name ?? (id==="hide"?"Ocultación":id);
    const ct = def?.ct ?? def?.ctOptions?.[2] ?? null;
    return { id, title, subtitle: ct ? `CT ${ct.I||0}/${ct.E||0}/${ct.R||0}` : "", def };
  });
}
function collectLearnedManeuvers(actor) {
  const out = [];
  const tree = actor?.system?.progression?.maneuvers || {};
  for (const [key, node] of Object.entries(tree)) {
    const rank = Number(node?.rank || 0);
    if (rank <= 0) continue;
    const m = MANEUVERS[key]; if (!m) continue;
    out.push({
      id: key,
      title: m.label ?? key,
      subtitle: `N${rank} · CT ${m.ct?.init||0}/${m.ct?.exec||1}/${m.ct?.rec||0}`,
      level: rank,
      def: m
    });
  }
  return out;
}

function collectLearnedAptitudes(actor) {
  const tree = actor?.system?.progression?.aptitudes || {};
  const out = [];
  for (const [key, node] of Object.entries(tree)) {
    const rank = Number(node?.rank || 0);
    const known = !!node?.known || rank > 0;
    if (!known) continue;
    const a = APTITUDES[key]; if (!a) continue;

    // Transformar la aptitud al formato de tarjeta
    const transformedDef = transformAptitudeToCardFormat(a, key, rank);

    out.push({
      id: key,
      title: a.label ?? key,
      subtitle: `N${rank} · CT ${a.ct?.init||0}/${a.ct?.exec||1}/${a.ct?.rec||0}`,
      level: rank,
      def: transformedDef
    });
  }
  return out;
}

// Función para transformar aptitudes al formato de tarjeta
function transformAptitudeToCardFormat(aptitudeDef, key, rank) {
  // Formatear área
  let areaText = "—";
  if (typeof aptitudeDef.area === 'number') {
    if (aptitudeDef.area === 0) {
      areaText = "Personal";
    } else {
      areaText = `${aptitudeDef.area} casilla${aptitudeDef.area !== 1 ? 's' : ''}`;
    }
  }

  // Formatear rango
  let rangeText = "—";
  if (typeof aptitudeDef.range === 'number') {
    if (aptitudeDef.range === 0) {
      rangeText = "Personal";
    } else {
      rangeText = `${aptitudeDef.range}m`;
    }
  }

  // Formatear descripción incluyendo riesgo
  let fullDescription = aptitudeDef.effect || "Sin descripción disponible";
  if (aptitudeDef.risk) {
    fullDescription += `\n\n<strong>Riesgo:</strong> ${aptitudeDef.risk}`;
  }

  return {
    name: aptitudeDef.label || key,
    range: rangeText,
    area: areaText,
    ct: {
      I: aptitudeDef.ct?.init || 0,
      E: aptitudeDef.ct?.exec || 1,
      R: aptitudeDef.ct?.rec || 0
    },
    requirements: aptitudeDef.requires ? [aptitudeDef.requires] : ["Ninguno"],
    keywords: {
      type: aptitudeDef.type || "utility",
      clazz: aptitudeDef.clazz || "aptitude",
      category: aptitudeDef.category || "active",
      descriptors: aptitudeDef.descriptor ? [aptitudeDef.descriptor] : [],
      elements: aptitudeDef.element ? [aptitudeDef.element] : []
    },
    description: fullDescription,
    rolls: [] // Las aptitudes normalmente no tienen tiradas específicas definidas aquí
  };
}

// Función para transformar maniobras al formato de tarjeta
function transformManeuverToCardFormat(maneuverDef, key, rank) {
  // Formatear área
  let areaText = "—";
  if (typeof maneuverDef.area === 'number') {
    if (maneuverDef.area === 0) {
      areaText = "Personal";
    } else {
      areaText = `${maneuverDef.area} casilla${maneuverDef.area !== 1 ? 's' : ''}`;
      if (maneuverDef.areaShape) {
        areaText += ` (${maneuverDef.areaShape})`;
      }
    }
  }

  // Formatear rango
  let rangeText = "—";
  if (typeof maneuverDef.range === 'number') {
    if (maneuverDef.range === 0) {
      rangeText = "Personal";
    } else {
      rangeText = `${maneuverDef.range}m`;
    }
  }

  // Formatear descripción con niveles
  let fullDescription = maneuverDef.effect || "Sin descripción disponible";
  if (maneuverDef.levels && maneuverDef.levels.length > 0) {
    fullDescription += "\n\n<strong>Niveles:</strong>\n";
    maneuverDef.levels.forEach(level => {
      fullDescription += `• ${level}\n`;
    });
  }

  return {
    name: maneuverDef.label || key,
    range: rangeText,
    area: areaText,
    ct: {
      I: maneuverDef.ct?.init || 0,
      E: maneuverDef.ct?.exec || 1,
      R: maneuverDef.ct?.rec || 0
    },
    requirements: maneuverDef.requires ? [maneuverDef.requires] : ["Ninguno"],
    keywords: {
      type: maneuverDef.type || "attack",
      clazz: maneuverDef.clazz || "maneuver",
      category: maneuverDef.category || "active",
      descriptors: maneuverDef.descriptor ? [maneuverDef.descriptor] : [],
      elements: maneuverDef.element ? [maneuverDef.element] : []
    },
    description: fullDescription,
    rolls: [] // Las maniobras usan el sistema de TA/TI
  };
}

// Función para transformar poderes de reliquia al formato de tarjeta
function transformRelicPowerToCardFormat(relicDef, key, rank) {
  // Formatear área
  let areaText = "—";
  if (typeof relicDef.area === 'number') {
    if (relicDef.area === 0) {
      areaText = "Personal";
    } else {
      areaText = `${relicDef.area} casilla${relicDef.area !== 1 ? 's' : ''}`;
      if (relicDef.areaShape) {
        areaText += ` (${relicDef.areaShape})`;
      }
    }
  }

  // Formatear rango
  let rangeText = "—";
  if (typeof relicDef.range === 'number') {
    if (relicDef.range === 0) {
      rangeText = "Personal";
    } else {
      rangeText = `${relicDef.range}m`;
    }
  }

  // Formatear descripción con niveles
  let fullDescription = relicDef.effect || "Sin descripción disponible";
  if (relicDef.levels && relicDef.levels.length > 0) {
    fullDescription += "\n\n<strong>Niveles:</strong>\n";
    relicDef.levels.forEach(level => {
      fullDescription += `• ${level}\n`;
    });
  }

  return {
    name: relicDef.label || key,
    range: rangeText,
    area: areaText,
    ct: {
      I: relicDef.ct?.init || 0,
      E: relicDef.ct?.exec || 1,
      R: relicDef.ct?.rec || 0
    },
    requirements: relicDef.requires ? [relicDef.requires] : ["Ninguno"],
    keywords: {
      type: relicDef.type || "utility",
      clazz: relicDef.clazz || "relic_power",
      category: relicDef.category || "active",
      descriptors: relicDef.descriptor ? [relicDef.descriptor] : [],
      elements: relicDef.element ? [relicDef.element] : []
    },
    description: fullDescription,
    rolls: [] // Los poderes de reliquia usan el sistema de TA/TI
  };
}


function collectLearnedRelics(actor) {
  const out = [];
  const tree = actor?.system?.progression?.relics || {};
  for (const [key, node] of Object.entries(tree)) {
    const rank = Number(node?.rank || 0);
    if (rank <= 0) continue;
    const p = RELIC_POWERS[key]; if (!p) continue;
    out.push({
      id: key,
      title: p.label ?? key,
      subtitle: `N${rank} · CT ${p.ct?.init||0}/${p.ct?.exec||1}/${p.ct?.rec||0}`,
      level: rank,
      def: p
    });
  }
  return out;
}

function collectAptitudes(actor) {
  const apt = actor?.system?.progression?.aptitudes || {};
  const out = [];
  for (const [id, node] of Object.entries(apt)) {
    const known = !!node?.known || Number(node?.rank||0) > 0;
    if (!known) continue;
    const def = ACTIONS[id] ?? { id, name: node?.label ?? id, description: node?.description ?? "", ct: node?.ct ?? { I:0,E:1,R:0 } };
    out.push({
      id, title: def.name ?? id,
      subtitle: def.ct ? `CT ${def.ct.I||0}/${def.ct.E||1}/${def.ct.R||0}` : "",
      def
    });
  }
  return out;
}

function collectNaturalWeapons(actor) {
  const out = [];
  const naturalWeapons = actor?.getFlag?.("tsdc", "naturalWeapons") || [];
  const progressions = actor?.system?.progression?.weapons || {};

  for (const weapon of naturalWeapons) {
    const key = weapon.key;
    const progression = progressions[key];
    const rank = Number(progression?.rank || 0);
    const level = Number(progression?.level || 1);

    if (level <= 0) continue;

    // Create attack action definition for natural weapon
    const attackDef = {
      id: `natural-${key}`,
      name: `${weapon.label} (Ataque)`,
      description: `Ataque con arma natural: ${weapon.label}`,
      tags: weapon.tags || [],
      ct: { I: 1, E: 1, R: 1 }, // Standard attack timing
      isNaturalWeapon: true,
      weaponKey: key,
      weapon
    };

    // Add weapon stats to description
    let statsText = "";
    if (weapon.durability && typeof weapon.durability === 'object') {
      statsText += `Durabilidad: ${weapon.durability.current}/${weapon.durability.max}`;
    }
    if (weapon.power) {
      if (statsText) statsText += " • ";
      statsText += `Potencia: ${weapon.power}`;
    }
    if (weapon.damageDie) {
      if (statsText) statsText += " • ";
      statsText += `Daño: ${weapon.damageDie}`;
    }
    if (weapon.tags && weapon.tags.length > 0) {
      if (statsText) statsText += " • ";
      statsText += `Etiquetas: ${weapon.tags.join(", ")}`;
    }

    if (statsText) {
      attackDef.description += `\n\n${statsText}`;
    }

    out.push({
      id: attackDef.id,
      title: attackDef.name,
      subtitle: `N${rank} • CT ${attackDef.ct.I}/${attackDef.ct.E}/${attackDef.ct.R}`,
      def: attackDef
    });
  }

  return out;
}

/* ===== App ===== */
export class GrimoireApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tsdc-grimoire",
    classes: ["tsdc","grimoire"],
    window: { icon: "fa-solid fa-book", title: "Grimorio", resizable: true },
    position: { width: 780, height: 640 },
    actions: {
      close: GrimoireApp.onClose,
      "apply-filter": GrimoireApp.onApplyFilter,
      "switch-tab": GrimoireApp.onTab,
      "open-plan": GrimoireApp.onOpenPlan
    }
  };
  static PARTS = { body: { template: "systems/tsdc/templates/apps/grimoire.hbs" } };

  constructor(actorId, options={}) {
    super(options);
    this.actorId = actorId ?? null;
    this._query = "";
    this._tab = "basic";
    this._onUpdate = (doc, diff, options, userId) => {
      if (doc.id === this.actor?.id)
     this.render(false);
    };
    Hooks.on("updateActor", this._onUpdate);
    Hooks.on("updateCombat", this._onUpdate);
  }
  async close(opts){ Hooks.off("updateActor",this._onUpdate); Hooks.off("updateCombat",this._onUpdate); return super.close(opts); }

  static onClose(){ this._instance?.close(); }
  static onTab(ev, btn){ this._tab = btn?.dataset?.tab || "basic"; this.render(false); }
  static onApplyFilter(){ const input = this.element?.querySelector?.('[data-ref="filter"]'); this._query = (input?.value||"").trim().toLowerCase(); this.render(false); }
  static onOpenPlan(){ game.transcendence?.openAtbTracker?.(); /* o bien openPlanDialogForSelection() si prefieres abrir el diálogo */ }

  async _prepareContext() {
    const actor = game.actors?.get?.(this.actorId) || null;
    const knownM = actorKnownManeuvers(actor);
    const knownR = actorKnownRelicPowers(actor);
    const notes  = actorKnownNotes(actor);

    const planningTick = await ATB_API.getPlanningTick();
    const q = (this._query||"").trim().toLowerCase();

    const toHtml = async (def) => hasTemplateRenderer()
      ? await renderTpl("systems/tsdc/templates/cards/action-card.hbs", { ...def })
      : `<div class="tsdc-card"><header class="c-head">${def?.name ?? def?.label ?? "—"}</header></div>`;

    // Básicas
    const basics = collectBasics()
      .filter(x => !q || String(x.title).toLowerCase().includes(q))
      .map(async x => ({ ...x, html: await toHtml(ACTIONS[x.id] ?? x.def) }));
    const cardsBasic = await Promise.all(basics);

    // Maniobras / Reliquias / Aptitudes
    const ms = actorKnownManeuvers(actor).map(key => {
      const m = MANEUVERS[key];
      const rank = Number(actor?.system?.progression?.maneuvers?.[key]?.rank || 0);
      return {
        id: key,
        title: m?.label ?? key,
        subtitle: `N${rank} · CT ${m?.ct?.init||0}/${m?.ct?.exec||1}/${m?.ct?.rec||0}`,
        level: rank,
        def: transformManeuverToCardFormat(m, key, rank)
      };
    }).filter(x => !q || String(x.title).toLowerCase().includes(q));
    const rs = actorKnownRelicPowers(actor).map(key => {
      const p = RELIC_POWERS[key];
      const rank = Number(actor?.system?.progression?.relics?.[key]?.rank || 0);
      return {
        id: key,
        title: p?.label ?? key,
        subtitle: `N${rank} · CT ${p?.ct?.init||0}/${p?.ct?.exec||1}/${p?.ct?.rec||0}`,
        level: rank,
        def: transformRelicPowerToCardFormat(p, key, rank)
      };
    }).filter(x => !q || String(x.title).toLowerCase().includes(q));
    const as = collectLearnedAptitudes(actor).filter(x => !q || String(x.title).toLowerCase().includes(q));

    const cardsManeuvers = await Promise.all(ms.map(async x => ({ ...x, html: await toHtml(x.def) })));
    const cardsRelics    = await Promise.all(rs.map(async x => ({ ...x, html: await toHtml(x.def) })));
    const cardsAptitudes = await Promise.all(as.map(async x => ({ ...x, html: await toHtml(x.def) })));

    // Armas Naturales
    const naturalWeapons = collectNaturalWeapons(actor)
      .filter(x => !q || String(x.title).toLowerCase().includes(q))
      .map(async x => ({ ...x, html: await toHtml(x.def) }));
    const cardsNaturalWeapons = await Promise.all(naturalWeapons);

    return {
      actorName: actor?.name ?? "—",
      planningTick,
      query: q,
      activeTab: this._tab,
      cardsBasic, cardsManeuvers, cardsRelics, cardsAptitudes, cardsNaturalWeapons
    };
  }

  // Aperturas
  static openForActor(actorId) {
    const actor = game.actors?.get?.(actorId); if (!actor) return ui.notifications?.warn("Actor no encontrado.");
    const canOpen = game.user.isGM || actor.isOwner || actor.testUserPermission?.(game.user, "OWNER") || actor.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);
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

// =========================
// HUD/SceneControls/Sheet buttons (V13-safe)
// =========================
// ===== helpers de permisos (igual que ya tienes) =====

// ===== NUEVO: búsqueda robusta del contenedor "derecha" =====
function findRightContainer(root) {
  if (!root) return null;

  // 1) Selectores conocidos (core + temas + v13)
  let right =
    root.querySelector('[data-group="right"]') ||
    root.querySelector('[data-group="Right"]') ||
    root.querySelector('.col.right') ||
    root.querySelector('.right') ||
    root.querySelector('.tokenhud__right') ||
    root.querySelector('.token-hud__right') ||
    root.querySelector('.tokenhud-col-right');

  if (right) return right;

  // 2) Heurístico: columna que contiene el botón de "Toggle Combat" (espadas)
  const swords = root.querySelector(
    '.control-icon i[class*="sword"], .control-icon[data-action*="combat"], .control-icon.combat'
  );
  if (swords) return swords.closest('.col, [data-group], .right, .tokenhud__right, .token-hud__right') || swords.parentElement;

  // 3) Heurístico: padre del primer control-icon disponible (último recurso)
  const firstIcon = root.querySelector('.control-icon');
  if (firstIcon?.parentElement) return firstIcon.parentElement;

  return null;
}

// ===== NUEVO: inyección con espera/observación =====
// --- Helpers ---
function canOpenGrimoireForActor(actor) {
  if (!actor) return false;
  const OWNER = (CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3);
  return game.user.isGM ||
         actor.isOwner ||
         actor.testUserPermission?.(game.user, "OWNER") ||
         actor.testUserPermission?.(game.user, OWNER);
}

// Siempre obtener el HUD "vivo" del DOM
function getLiveHudRoot() {
  return document.querySelector('#token-hud.placeable-hud');
}

function insertGrimoireBtn() {
  const root = getLiveHudRoot();
  if (!root) return false;

  // Ancla: botón de combate si existe; si no, cualquier control-icon
  const combatBtn =
    root.querySelector('.control-icon i[class*="sword"]')?.closest('.control-icon') ||
    root.querySelector('.control-icon[data-action*="combat"]') ||
    root.querySelector('.control-icon.combat') ||
    null;

  const refIcon = combatBtn || root.querySelector('.control-icon');
  if (!refIcon) return false;

  const container = refIcon.parentElement;
  if (!container) return false;

  // Permisos con actor del HUD activo o token seleccionado
  const actor = ui?.tokens?.control?.object?.actor
             ?? canvas.tokens?.controlled?.[0]?.actor
             ?? game.user?.character
             ?? null;
  if (!canOpenGrimoireForActor(actor)) return true;

  if (container.querySelector('.control-icon.tsdc-grimoire')) return true;

  const tag = (refIcon.tagName || 'BUTTON').toLowerCase();
  const btn = document.createElement(tag);
  btn.className = 'control-icon tsdc-grimoire';
  btn.dataset.action = 'tsdc-grimoire';
  btn.title = 'Abrir Grimorio';
  btn.setAttribute('data-tooltip', 'Abrir Grimorio');
  btn.innerHTML = '<i class="fa-solid fa-book"></i>';
  btn.addEventListener('click', () => {
    GrimoireApp.openForActor(actor.id);
  });

  combatBtn?.nextSibling
    ? container.insertBefore(btn, combatBtn.nextSibling)
    : container.appendChild(btn);

  console.log('TSDC | HUD: botón Grimorio insertado');
  return true;
}

function scheduleHudInsert() {
  // Reintentos para temas que montan tarde
  const delays = [0, 16, 50, 120, 250, 500, 1000];
  let done = false;
  delays.forEach(d => setTimeout(() => { if (!done) done = insertGrimoireBtn(); }, d));
}

function addSceneControlButtonDOM(_app, html) {
  const root = (html?.[0] ?? html ?? null);
  if (!root) return;

  // pestaña de herramientas del token
  const tokenTab = root.querySelector('.scene-control[data-control="token"]');
  const list = tokenTab?.parentElement?.querySelector('ol.control-tools') ||
               root.querySelector('ol.control-tools'); // temas distintos

  if (!list || list.querySelector('li[data-tool="tsdc-grimoire"]')) return;

  const li = document.createElement('li');
  li.className = 'control-tool';
  li.dataset.tool = 'tsdc-grimoire';
  li.title = 'Abrir Grimorio';
  li.innerHTML = '<i class="fa-solid fa-book"></i>';
  li.addEventListener('click', () => {
    const tk = canvas.tokens?.controlled?.[0] ?? null;
    const actor = tk?.actor ?? game.user?.character ?? null;
    if (!actor) return ui.notifications?.warn('Selecciona tu token o asigna tu actor.');
    GrimoireApp.openForActor(actor.id);
  });

  list.appendChild(li);
}

// ===== Barra izquierda: forma oficial (se llama múltiples veces) =====
function registerSceneControlTool(arg) {
  const controls = Array.isArray(arg) ? arg : (arg?.controls ?? []);
  console.log('TSDC | getSceneControlButtons', { count: controls?.length ?? 0 });
  const tokenCtl = controls?.find(c => c.name === 'token');
  if (!tokenCtl) return;
  tokenCtl.tools ??= [];
  if (tokenCtl.tools.some(t => t.name === 'tsdc-grimoire')) return;

  tokenCtl.tools.push({
    name: 'tsdc-grimoire',
    title: 'Abrir Grimorio',
    icon: 'fas fa-book',
    button: true,
    visible: true,
    onClick: () => {
      const tk = canvas.tokens?.controlled?.[0];
      const actor = tk?.actor ?? game.user?.character;
      if (!actor) return ui.notifications.warn('Selecciona tu token o asigna tu actor.');
      GrimoireApp.openForActor(actor.id);
    }
  });
}

// ===== NUEVO: función que faltaba (evita el ReferenceError) =====
function addActorHeaderButton(app, html) {
  const el = (html?.[0] ?? html ?? app?.element ?? null);
  if (!el) return;
  const win = el.closest?.('.window-app'); if (!win) return;
  const header = win.querySelector('.window-header'); if (!header) return;

  let actions = header.querySelector('.header-actions');
  if (!actions) {
    actions = document.createElement('div');
    actions.className = 'header-actions';
    header.appendChild(actions);
  }
  if (actions.querySelector('[data-action="tsdc-grimoire-header"]')) return;

  const a = document.createElement('a');
  a.className = 'header-control';
  a.dataset.action = 'tsdc-grimoire-header';
  a.title = 'Abrir Grimorio';
  a.innerHTML = '<i class="fa-solid fa-book"></i><span style="margin-left:.35rem;">Grimorio</span>';
  a.addEventListener('click', () => {
    const actor = app?.actor ?? app?.document ?? null;
    if (!actor) return;
    GrimoireApp.openForActor(actor.id);
  });
  actions.prepend(a);
}

// ===== Hooks =====
Hooks.once('init', () => {
  Hooks.on('getSceneControlButtons', registerSceneControlTool);
});

Hooks.once('ready', () => {
  console.log('TSDC | ready: registrando HUD y cabeceras…');

  Hooks.on('renderTokenHUD',      scheduleHudInsert);
  Hooks.on('renderTokenHUDV2',    scheduleHudInsert);
  Hooks.on('refreshTokenHUD',     scheduleHudInsert);
  Hooks.on('controlToken',        scheduleHudInsert);
  // Fuerza un render de la barra tras cargar
  ui.controls?.render?.({
    controls: ui.controls?.controls ?? [],
    tool: ui.controls?.tool?.name ?? ui.controls?.activeTool
  });
});
try { window.tsdcatb = { ...(window.tsdcatb ?? {}), GrimoireApp }; } catch {}