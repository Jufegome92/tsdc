// modules/atb/ui.js
// UI en Combat Tracker: botones y diálogo "Planear" con dropdowns.

import { ATB_API } from "./engine.js";
import { ACTIONS } from "../features/actions/catalog.js";
import { MANEUVERS } from "../features/maneuvers/data.js";
import { RELIC_POWERS } from "../features/relics/data.js";
import { APTITUDES } from "../features/aptitudes/data.js";
import { actorKnownManeuvers, actorKnownRelicPowers } from "../features/known.js";
import { MONSTER_ABILITIES } from "../features/abilities/data.js";
import { listSpecs } from "../features/specializations/index.js";
import { arePartsFunctional, describePartsStatus } from "../features/inventory/index.js";
import { listActive as listActiveAilments, resolveAilmentMechanics } from "../ailments/index.js";
import { CATALOG as AILMENT_CATALOG } from "../ailments/catalog.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const SPEC_CATEGORY_LABELS = {
  physical: "Física",
  mental: "Mental",
  arts: "Arte y oficios",
  knowledge: "Saberes",
  social: "Social"
};

function buildSpecOptionsByCategory() {
  const byCat = {};
  for (const key of Object.keys(SPEC_CATEGORY_LABELS)) byCat[key] = [];
  for (const spec of listSpecs()) {
    const cat = spec.category || "physical";
    const entry = { key: spec.key, label: spec.label || spec.key };
    (byCat[cat] ??= []).push(entry);
  }
  for (const arr of Object.values(byCat)) {
    arr.sort((a, b) => a.label.localeCompare(b.label, game.i18n?.lang || "es"));
  }
  return byCat;
}

function listSpecCategories() {
  return Object.entries(SPEC_CATEGORY_LABELS).map(([key, label]) => ({ key, label }));
}

function populatePlannerSelects(html, actor) {
  // Maniobras
  const mSel = html.find('select[name="maneuverKey"]');
  if (mSel.length) {
    mSel.empty().append(`<option value="">— Elegir —</option>`);
    for (const key of actorKnownManeuvers(actor)) {
      const label = MANEUVERS[key]?.label ?? key;
      mSel.append(`<option value="${key}">${label}</option>`);
    }
  }

  // Reliquias
  const rSel = html.find('select[name="relicKey"]');
  if (rSel.length) {
    rSel.empty().append(`<option value="">— Elegir —</option>`);
    for (const key of actorKnownRelicPowers(actor)) {
      const label = RELIC_POWERS[key]?.label ?? key;
      rSel.append(`<option value="${key}">${label}</option>`);
    }
  }
}


/* ========= Listas para el diálogo ========= */
function listBasicOptions() {
  const ids = ["mover","ataque","dual-wield","interactuar","escape","soltar","hide"]; // la Especialización tiene su bloque propio
  return ids.map(id => ({ id, name: ACTIONS[id]?.name ?? (id==="hide" ? "Ocultación" : id) }));
}
function listManeuverOptions(actor) {
  const rankMap = actor?.system?.progression?.maneuvers ?? {};
  return actorKnownManeuvers(actor).map(key => {
    const rank = Number(rankMap[key]?.rank || 0);
    const name = MANEUVERS[key]?.label ?? key;
    return { key, name: rank ? `${name} (N${rank})` : name };
  });
}

function listRelicOptions(actor) {
  const rankMap = actor?.system?.progression?.relics ?? {};
  return actorKnownRelicPowers(actor).map(key => {
    const rank = Number(rankMap[key]?.rank || 0);
    const name = RELIC_POWERS[key]?.label ?? key;
    return { key, name: rank ? `${name} (N${rank})` : name };
  });
}

function normalizeCtOverride(ct = {}) {
  return {
    I: Number(ct.I ?? ct.init ?? 0),
    E: Number(ct.E ?? ct.exec ?? 0),
    R: Number(ct.R ?? ct.rec ?? 0)
  };
}

function collectEscapeCandidates(actor) {
  if (!actor) return [];
  return listActiveAilments(actor)
    .map(state => {
      const def = AILMENT_CATALOG[state.id];
      const mechanics = resolveAilmentMechanics(def, state);
      if (!mechanics?.escape) return null;
      return { state, mechanics, def };
    })
    .filter(Boolean);
}

function listMonsterAbilityOptions(actor) {
  const abilities = Array.isArray(actor?.system?.abilities) ? actor.system.abilities : [];
  return abilities
    .map(ab => {
      const key = ab.itemKey ?? ab.key;
      if (!key) return null;
      const normKey = String(key).toLowerCase();
      const base = MONSTER_ABILITIES[normKey] ?? MONSTER_ABILITIES[key] ?? {};
      const name = ab.label ?? base.label ?? key;
      const requiresParts = ab.requiresParts || base.requiresParts || [];
      const partsOk = arePartsFunctional(actor, requiresParts);
      const manualDisabled = (ab.enabled === false) && (ab.flags?.tsdc?.manualDisabled === true);
      const disabled = manualDisabled || !partsOk;
      const manualReason = ab.flags?.tsdc?.manualDisabledReason || "Habilidad deshabilitada";
      const reason = !partsOk
        ? (describePartsStatus(actor, requiresParts) || "Parte dañada")
        : (manualDisabled ? manualReason : "");
      return { key, name, disabled, reason };
    })
    .filter(Boolean);
}

function listAptitudesOptions(actor) {
  const tree = actor?.system?.progression?.aptitudes ?? {};
  return Object.entries(tree)
    .filter(([,n]) => !!n?.known || Number(n?.rank || 0) > 0)
    .filter(([key]) => (APTITUDES[key]?.category || "active") !== "passive")
    .map(([key, n]) => ({ key, name: `${APTITUDES[key]?.label ?? key} ${n?.rank?`(N${n.rank})`:""}` }));
}

/* ========= Diálogo Planer ========= */
function bindSpecSelectors(app, root) {
  try {
    const $root = root?.jquery ? root : $(root ?? app.element);
    if (!$root?.length) {
      console.warn("TSDC | ATB Plan | bindSpecSelectors: no root", root);
      return;
    }

    const specSelect = $root.find('select[name="specSelect"]')[0] ?? null;
    const specInput = $root.find('input[name="specKey"]')[0] ?? null;
    const catSelect = $root.find('select[name="specCat"]')[0] ?? null;
    if (!specSelect || !catSelect) {
      console.warn("TSDC | ATB Plan | bindSpecSelectors: missing selects");
      return;
    }

    const ensureSpecMap = () => {
      if (!app._specOptionsByCategory) {
        app._specOptionsByCategory = buildSpecOptionsByCategory();
      }
      return app._specOptionsByCategory;
    };

    const updateSpecOptions = (catKey, preserveValue = false) => {
      const map = ensureSpecMap();
      const options = map?.[catKey] ?? [];
      const previous = preserveValue ? specSelect.value : "";
    specSelect.replaceChildren();
      const placeholder = document.createElement("option");
      placeholder.value = "";
      placeholder.textContent = "— Elegir —";
      specSelect.appendChild(placeholder);
      for (const opt of options) {
        const el = document.createElement("option");
        el.value = opt.key;
        el.textContent = opt.label;
        specSelect.appendChild(el);
      }
      if (preserveValue && options.some(o => o.key === previous)) {
        specSelect.value = previous;
      } else {
        specSelect.value = "";
      }
    };

    const initial = catSelect.value || app._specDefaultCat || "physical";
    updateSpecOptions(initial, false);

    catSelect.removeEventListener('change', catSelect._tsdcListener);
    catSelect._tsdcListener = (ev) => {
      const value = ev.currentTarget?.value || "";
      updateSpecOptions(value, false);
      if (specInput) specInput.value = "";
    };
    catSelect.addEventListener('change', catSelect._tsdcListener);

    if (specInput) {
      specSelect.removeEventListener('change', specSelect._tsdcListener);
      specSelect._tsdcListener = (ev) => {
        const value = ev.currentTarget.value;
        if (value) specInput.value = value;
      };
      specSelect.addEventListener('change', specSelect._tsdcListener);
    }
  } catch (err) {
    console.error("TSDC | ATB Plan | bindSpecSelectors failed", err);
  }
}

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
      "plan-monster": AtbPlanDialog.onPlanMonsterAbility,
      "plan-spec": AtbPlanDialog.onPlanSpec,
      "plan-aptitude": AtbPlanDialog.onPlanAptitude,
    }
  };
  static PARTS = { body: { template: "systems/tsdc/templates/apps/atb-plan.hbs" } };
  static onClose(){ this._instance?.close(); }

  _readTick() {
    const v = Number(this.element?.querySelector?.('input[name="targetTick"]')?.value ?? NaN);
    return Number.isFinite(v) ? v : null;
  }

  activateListeners(html) {
    super.activateListeners?.(html);
    bindSpecSelectors(this, $(html ?? this.element));
  }

  static async onPlanBasic() {
    const app = this;
    const sel = app.element.querySelector('select[name="basicKey"]')?.value || "";
    if (!sel) return ui.notifications.warn("Elige una acción básica.");
    const tick = app._readTick();

    const map = { mover:"move", ataque:"attack", "dual-wield":"dual-wield", interactuar:"interact", escape:"escape", soltar:"drop", hide:"hide" };
    const simple = map[sel];
    if (!simple) return ui.notifications.warn("Acción básica desconocida.");

    if (simple === "escape") {
      const controlled = canvas.tokens?.controlled ?? [];
      if (controlled.length > 1) {
        ui.notifications.warn("Selecciona solo un token para planear Escapar.");
        return;
      }
      const actor = controlled[0]?.actor ?? game.user?.character ?? null;
      if (!actor) {
        ui.notifications.warn("No hay actor seleccionado para planear Escapar.");
        return;
      }
      const candidates = collectEscapeCandidates(actor);
      if (!candidates.length) {
        ui.notifications.warn("Ese actor no tiene agravios que permitan una acción de escape.");
        return;
      }
      let choice = null;
      if (candidates.length === 1) {
        choice = candidates[0];
      } else {
        const { DialogV2 } = foundry.applications.api;
        const options = candidates.map(c => {
          const label = c.state.label || c.def?.label || c.state.id;
          const sev = c.state.severity ? ` (Sev. ${c.state.severity.toUpperCase()})` : "";
          return `<option value="${c.state.id}">${label}${sev}</option>`;
        }).join("\n");
        const picked = await DialogV2?.prompt({
          window: { title: "Elegir agravio" },
          content: `<form><label>Agravio <select name="aid">${options}</select></label></form>`,
          ok: {
            label: "Confirmar",
            callback: (_ev, button) => button.form.elements.aid?.value || ""
          }
        });
        if (!picked) {
          ui.notifications.info("Plan de escape cancelado.");
          return;
        }
        choice = candidates.find(c => c.state.id === picked) ?? null;
        if (!choice) {
          ui.notifications.warn("No se encontró el agravio seleccionado.");
          return;
        }
      }

      const meta = { ailmentId: choice.state.id };
      if (choice.mechanics.escape?.ct) {
        meta.ctOverride = normalizeCtOverride(choice.mechanics.escape.ct);
      }
      const options = choice.mechanics.escape?.options ?? [];
      if (options.length === 1) meta.escapeOption = options[0];

      await ATB_API.enqueueSimpleForActor(actor.id, "escape", tick, meta);
      window?.tsdcatb?.ATBTrackerApp?._instance?.render(false);
      ui.notifications.info(`Plan: Escapar ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
      return;
    }

    // 👇 nuevo: si es ataque y hay un único target, guardamos su id
    const meta = {};
    if (simple === "attack") {
      const targets = Array.from(game.user?.targets ?? []);
      if (targets.length === 1) meta.targetTokenId = targets[0].id;
    }

    await ATB_API.enqueueSimpleForSelected(simple, tick, meta);  // 👈 ahora pasa meta
    window?.tsdcatb?.ATBTrackerApp?._instance?.render(false);
    ui.notifications.info(`Plan: ${sel} ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
  }
  static async onPlanManeuver() {
    const app = this;
    const key = app.element.querySelector('select[name="maneuverKey"]')?.value || "";
    if (!key) return ui.notifications.warn("Elige una maniobra.");
    const tick = app._readTick();
    await ATB_API.enqueueManeuverForSelected?.(key, tick);
    window?.tsdcatb?.ATBTrackerApp?._instance?.render(false);
    ui.notifications.info(`Plan: Maniobra ${key} ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
  }
  static async onPlanRelic() {
    const app = this;
    const key = app.element.querySelector('select[name="relicKey"]')?.value || "";
    if (!key) return ui.notifications.warn("Elige un poder de reliquia.");
    const tick = app._readTick();
    await ATB_API.enqueueRelicForSelected?.(key, tick);
    window?.tsdcatb?.ATBTrackerApp?._instance?.render(false);
    ui.notifications.info(`Plan: Reliquia ${key} ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
  }
  static async onPlanMonsterAbility() {
    const app = this;
    const key = app.element.querySelector('select[name="monsterAbilityKey"]')?.value || "";
    if (!key) return ui.notifications.warn("Elige una habilidad.");
    const tick = app._readTick();
    await ATB_API.enqueueMonsterAbilityForSelected?.(key, tick);
    window?.tsdcatb?.ATBTrackerApp?._instance?.render(false);
    ui.notifications.info(`Plan: Habilidad ${key} ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
  }
  static async onPlanAptitude() {
    const app = this;
    const key = app.element.querySelector('select[name="aptitudeKey"]')?.value || "";
    if (!key) return ui.notifications.warn("Elige una Aptitud.");
    const tick = app._readTick();
    await ATB_API.enqueueAptitudeForSelected?.(key, tick);
    window?.tsdcatb?.ATBTrackerApp?._instance?.render(false);
    ui.notifications.info(`Plan: Aptitud ${key} ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
  }

  static async onPlanSpec() {
    const app = this;
    let specKey = app.element.querySelector('input[name="specKey"]')?.value?.trim() || "";
    if (!specKey) {
      specKey = app.element.querySelector('select[name="specSelect"]')?.value?.trim() || "";
    }
    if (!specKey) return ui.notifications.warn("Elige o ingresa una especialización.");
    const category = app.element.querySelector('select[name="specCat"]')?.value || "physical";
    const CT = Number(app.element.querySelector('select[name="specCT"]')?.value || 2);
    const tick = app._readTick();
    await ATB_API.enqueueSpecForSelected({ specKey, category, CT, targetTick: tick });
    window?.tsdcatb?.ATBTrackerApp?._instance?.render(false);
    ui.notifications.info(`Plan: Esp. ${specKey} (CT ${CT}) ${tick!=null?`→ tick ${tick}`:"(plan)"}`);
  }

  async _prepareContext() {
    const planningTick = await ATB_API.getPlanningTick();
    const a = canvas.tokens?.controlled?.[0]?.actor ?? game.user?.character ?? null;
    const specOptionsByCategory = buildSpecOptionsByCategory();
    const specCategoriesRaw = listSpecCategories();
    const defaultCat = specCategoriesRaw.find(cat => (specOptionsByCategory[cat.key]?.length ?? 0) > 0)?.key
      || specCategoriesRaw[0]?.key
      || "physical";
    const specCategories = specCategoriesRaw.map(cat => ({ ...cat, isDefault: cat.key === defaultCat }));
    const specOptionsInitial = specOptionsByCategory[defaultCat] ?? [];
    this._specOptionsByCategory = specOptionsByCategory;
    this._specDefaultCat = defaultCat;
    return {
      planningTick,
      actorName: a?.name ?? "—",
      basicOptions: listBasicOptions(),
      maneuverOptions: listManeuverOptions(a),
      relicOptions: listRelicOptions(a),
      monsterAbilityOptions: listMonsterAbilityOptions(a),
      aptitudesOptions: listAptitudesOptions(a),
      specCategories,
      specOptionsInitial,
      specDefaultCat: defaultCat
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

  Hooks.on("renderAtbPlanDialog", (app, html) => {
    bindSpecSelectors(app, html);
  });
}
