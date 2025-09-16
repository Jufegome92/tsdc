// modules/ui/vision-panel.js
// Panel del GM: Visión & Escena (4 tabs)
// Escribe/lee en scene.flags.tsdc.* (fallback a game.settings cuando no hay flags)
// Requiere: modules/perception/index.js

import {
  buildPerceptionPackage,
  describePackage
} from "../perception/index.js";
import { checkStealthForHidden } from "../stealth/detection.js"; 

// Ensure minimal CSS so the panel works even if styles/vision-panel.css fails to load
(function ensureVisionPanelStyle(){
  const ID = "tsdc-vision-panel-style-inline";
  if (document.getElementById(ID)) return;
  const s = document.createElement("style");
  s.id = ID;
  s.textContent = `
    #tsdc-vision-panel .window-content { display:flex; flex-direction:column; max-height:80vh; min-height:0; }
    #tsdc-vision-panel .tabs-content { flex:1 1 auto; min-height:0; overflow:auto; }
    #tsdc-vision-panel .tabs-content .tab { display:none; }
    #tsdc-vision-panel .tabs-content .tab.active { display:flex; }
  `;
  document.head.appendChild(s);
})();
const { ApplicationV2, HandlebarsApplicationMixin, TabsV2 } = foundry.applications.api;

const SCOPE = "tsdc";

const INTENSITY_CHOICES = {
  none: "—",
  light: "Ligera",
  intense: "Intensa",
  storm: "Tormenta",
  blizzard: "Tormenta de nieve",
  dense: "Densa",
  thick: "Espesa",
  moderate: "Moderado",
  choking: "Asfixiante"
};

const FACTOR_CHOICES = {
  none: "—",
  rain: "Lluvia",
  snow: "Nieve",
  fog:  "Niebla",
  smoke:"Humo",
  dust: "Polvo",
  sand: "Arena"
};

const DARKNESS_CHOICES = {
  none: "Ninguna",
  absolute: "Oscuridad absoluta",
  elemental: "Oscuridad elemental"
};

// Radios base de luz (si no hay overrides)
const LIGHT_BASE = {
  candle: 2,
  torch: 4,
  oil_lamp: 6
};

// Iconos de estado para la luz (puedes cambiarlos por tus propios assets)
const LIGHT_EFFECT_ICON = {
  candle: "icons/svg/candle.svg",
  torch: "icons/svg/light.svg",
  oil_lamp: "icons/svg/lamp.svg" // si no existe, usa light.svg también
};
const HIDDEN_EFFECT_ICON = "icons/svg/stealth.svg"; // icono de oculto

/** Lee flags de escena y hace fallback a settings globales */
function readSceneEnv(scene) {
  const sc = scene ?? canvas?.scene ?? null;
  const envFlag = sc?.getFlag?.(SCOPE, "env") ?? {};
  let settings = {};
  try {
    settings = {
      factor: game.settings.get(SCOPE, "env.factor") ?? "none",
      intensity: game.settings.get(SCOPE, "env.intensity") ?? "none",
      darkness: game.settings.get(SCOPE, "env.darkness") ?? "none",
      lightOverride: game.settings.get(SCOPE, "env.lightOverride") ?? null
    };
  } catch (_e) {}
  return Object.assign({ factor:"none", intensity:"none", darkness:"none" }, settings, envFlag);
}

function envCapFromFactor(factor, intensity) {
  const key = `${factor}:${intensity}`.toLowerCase();
  const table = {
    "rain:light": 24, "rain:intense": 15, "rain:storm": 8,
    "snow:light": 24, "snow:intense": 15, "snow:blizzard": 8,
    "fog:light": 20,  "fog:dense": 10,   "fog:thick": 5,
    "smoke:light": 20,"smoke:dense": 5,  "smoke:choking": 2,
    "dust:light": 25, "dust:moderate": 12, "sand:storm": 5
  };
  const v = table[key];
  return Number.isFinite(v) ? v : 60;
}

/** Radio de luz efectivo desde flags del token/actor/escena */
function getTokenLightRadiusMeters(token, env) {
  // Prioridad: token.flag > actor.flag > override de escena > base
  const tFlag = token.document?.getFlag?.(SCOPE, "light");
  const aFlag = token.actor?.getFlag?.(SCOPE, "light");
  const kind = tFlag?.kind ?? aFlag?.kind ?? null;
  const radiusOverride =
    Number.isFinite(tFlag?.radius) ? tFlag.radius :
    Number.isFinite(aFlag?.radius) ? aFlag.radius : null;

  if (!kind) return null;
  if (Number.isFinite(radiusOverride)) return radiusOverride;

  const sceneOv = env?.lightOverride || null;
  if (sceneOv && Number.isFinite(sceneOv[kind])) return sceneOv[kind];

  return LIGHT_BASE[kind] ?? null;
}

/** Aplica o elimina el icono de efecto visual en el token */
async function setLightEffectIcon(token, kindOrNull) {
  const icon = kindOrNull ? (LIGHT_EFFECT_ICON[kindOrNull] ?? "icons/svg/light.svg") : null;
  const doc = token.document ?? token;
  try {
    if (!icon) {
      for (const ic of Object.values(LIGHT_EFFECT_ICON)) {
        try { await doc.toggleEffect(ic, { active:false }); } catch {}
      }
      return;
    }
    await doc.toggleEffect(icon, { active: true });
  } catch (_e) {
    // como fallback, ignora errores de icono faltante
  }
}

/** Aplica ocultación visual (icono) */
async function setHiddenEffectIcon(token, active) {
  const doc = token.document ?? token;
  try {
    await doc.toggleEffect(HIDDEN_EFFECT_ICON, { active });
  } catch (_e) {}
}

/** Memoriza/recupera el tab activo sin depender del DOM tras awaits */
function __getActiveTabFrom(root, fallback = "env") {
  const domTab = root?.querySelector?.(".nav-tabs .item.active")?.dataset?.tab;
  return domTab ?? fallback ?? "env";
}

/** Devuelve IDs de plantillas R_detalle existentes para este usuario */
function __getRDetalleTemplateIds() {
  const coll = (canvas.scene?.templates ?? []);
  try {
    const myId = game.user?.id ?? game.userId;
    return coll
      .filter(t => t?.flags?.[SCOPE]?.rDetalle && (t.author?.id ?? t.user?.id ?? t._source?.user) === myId)
      .map(t => t.id)
      .filter(Boolean);
  } catch (_e) {
    // fallback genérico si cambia la API
    return (canvas.scene?.getEmbeddedCollection?.("MeasuredTemplate") ?? [])
      .filter(t => t?.flags?.[SCOPE]?.rDetalle)
      .map(t => t.id);
  }
}


/** Elimina todas las plantillas R_detalle del usuario actual */
async function __clearRDetalleTemplates() {
  const ids = __getRDetalleTemplateIds();
  if (ids?.length) {
    try { await canvas.scene.deleteEmbeddedDocuments("MeasuredTemplate", ids); }
    catch (e) { console.warn("[TSDC:VP] No se pudo limpiar R_detalle:", e); }
  }
}

export class TSDCVisionPanel extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tsdc-vision-panel",
    classes: ["tsdc","vision-panel"],
    title: "Visión & Escena",
    width: 520,
    height: "auto",
    position: { top: 120, left: 120 },
    resizable: true,
    popOut: true,
  };

  static PARTS = {
    content: { template: "systems/tsdc/templates/apps/vision-panel.hbs" }
  };

  /** Abre singleton (GM-only) */
  static open() {
    if (!game.user.isGM) {
      ui.notifications?.warn("Solo el GM puede usar este panel.");
      console.warn("[TSDC:VP] open() bloqueado: user no es GM");
      return null;
    }
    if (!this._instance) this._instance = new this();
    console.debug("[TSDC:VP] open() → render");
    this._instance.render(true, { focus: true });
    return this._instance;
  }

  // === Contexto (para HandlebarsApplicationMixin) ===
  async _buildContext() {
    const scene = canvas?.scene;
    const env = readSceneEnv(scene);

    const STD = 60;
    const key = `${env.factor}:${env.intensity}`.toLowerCase();
    console.debug("[TSDC:VP] env=", env, "key=", key);
    const envCap = envCapFromFactor(env.factor, env.intensity);
    const token = canvas?.tokens?.controlled?.[0] ?? null;
    const lightCap = token ? getTokenLightRadiusMeters(token, env) : null;
    const rDetalle = Math.min(STD, envCap, Number.isFinite(lightCap) ? lightCap : STD);

    const previewParts = [
      `STD 60m`,
      `Ambiente ${envCap}m`,
      `Luz ${Number.isFinite(lightCap) ? `${lightCap}m` : "—"}`
    ];
    const preview = `min(${previewParts.join(", ")}) = ${rDetalle}m`;

    const selectedList = (canvas?.tokens?.controlled ?? []).map(t => ({
      id: t.id,
      name: t.name,
      light: t.document?.getFlag?.(SCOPE,"light")?.kind
          ?? t.actor?.getFlag?.(SCOPE,"light")?.kind
          ?? "none"
    }));

    return {
      env,
      factorChoices: FACTOR_CHOICES,
      intensityChoices: INTENSITY_CHOICES,
      darknessChoices: DARKNESS_CHOICES,
      lightOverride: env?.lightOverride ?? LIGHT_BASE,
      rDetalle,
      preview,
      selectedTokens: selectedList
    };
  }

  // Compatibilidad (algunos builds llaman getData, el mixin usa _prepareContext)
  async getData() { return this._buildContext(); }
  async _prepareContext(_options) { return this._buildContext(); }

  attachPartListeners(html, partId) {
    if (partId === "content") this._wire(this.element ?? html);
  }

  attachListeners(html) {
    this._wire(this.element ?? (html instanceof HTMLElement ? html : html?.[0]));
  }

  _wire(root) {
    if (!root || root.dataset?.wired === "1") return;
    root.dataset.wired = "1";

    // Pestaña por defecto = la última usada
    const currentTab =
      this._activeTab
      ?? root.querySelector(".nav-tabs .item.active")?.dataset.tab
      ?? "env";

    // Tabs
    try {
      this._tabs?.unbind?.();
      this._tabs = new TabsV2({
        id: "primary",
        navSelector: ".nav-tabs[data-group='primary'], .nav-tabs",
        contentSelector: ".tabs-content[data-group='primary'], .tabs-content",
        initial: currentTab
      });
      this._tabs.bind(root);
      this._tabs.activate?.(currentTab);
      this._activeTab = currentTab;
    } catch (_e) {
      // Fallback manual
      const manualActivate = (id) => {
        root.querySelectorAll(".nav-tabs .item").forEach(a =>
          a.classList.toggle("active", a.dataset.tab === id));
        root.querySelectorAll(".tabs-content .tab").forEach(t =>
          t.classList.toggle("active", t.dataset.tab === id));
      };
      manualActivate(currentTab);
    }

    // SIEMPRE: clic en pestañas → activa y guarda _activeTab (funcione o no TabsV2)
    root.addEventListener("click", (ev) => {
      const a = ev.target?.closest?.(".nav-tabs .item[data-tab]");
      if (!a || a.closest(".window-header")) return;
      ev.preventDefault();
      const id = a.dataset.tab;
      this._activeTab = id;
      if (this._tabs?.activate) this._tabs.activate(id);
      else {
        // Fallback manual si TabsV2 no está disponible
        root.querySelectorAll(".nav-tabs .item").forEach(el =>
          el.classList.toggle("active", el.dataset.tab === id));
        root.querySelectorAll(".tabs-content .tab").forEach(el =>
          el.classList.toggle("active", el.dataset.tab === id));
      }
    });

    // Delegación de cambios
    root.addEventListener("change", (ev) => {
      const elx = ev.target?.closest?.("[data-change]");
      if (!elx) return;
      if (elx.closest(".window-header")) return;
      this._onChange({ currentTarget: elx, originalEvent: ev });
    });

    // Delegación de clicks
    root.addEventListener("click", (ev) => {
      const elx = ev.target?.closest?.("[data-action]");
      if (!elx) return;
      if (elx.closest(".window-header")) return;
      this._onAction({ currentTarget: elx, originalEvent: ev });
    });

    console.log("[TSDC:VP] listeners vinculados");
  }

  async render(force, options) {
    const out = await super.render(force, options);
    // ejecuta después de que el DOM exista
    setTimeout(() => {
      try { this._wire(this.element); } catch (e) { console.warn("[TSDC:VP] auto-wire falló", e); }
    }, 0);
    return out;
  }

  async _onChange(ev) {
    const el = ev.currentTarget;
    const action = el?.dataset?.change;
    // Memoriza el tab activo ANTES de awaits
    this._activeTab = __getActiveTabFrom(this.element, this._activeTab);
    console.debug("[TSDC:VP] _onChange", action, { value: el?.value, tab: this._activeTab });

    const scene = canvas?.scene;
    if (!scene) { console.warn("[TSDC:VP] _onChange sin scene"); return; }
    const env = readSceneEnv(scene);

    try {
      switch (action) {
        case "factor":
          await scene.setFlag(SCOPE, "env", { ...env, factor: el.value });
          break;
        case "intensity":
          await scene.setFlag(SCOPE, "env", { ...env, intensity: el.value });
          break;
        case "darkness":
          await scene.setFlag(SCOPE, "env", { ...env, darkness: el.value });
          break;

        case "light-base-candle":
        case "light-base-torch":
        case "light-base-lamp": {
          const key = action.endsWith("candle") ? "candle" : action.endsWith("torch") ? "torch" : "oil_lamp";
          const val = Number(el.value);
          const obj = foundry.utils.duplicate(game.settings.get(SCOPE, "env.lightOverride") || {});
          obj[key] = Number.isFinite(val) ? val : undefined;
          await game.settings.set(SCOPE, "env.lightOverride", obj);
          ui.notifications.info("Radios de luz actualizados (override global).");
          break;
        }

        case "light-kind": {
          const kind = el.value;
          const selected = canvas?.tokens?.controlled ?? [];
          for (const t of selected) {
            const doc = t.document ?? t;
            if (kind === "none") {
              // QUITAR luz: limpia token + actor y quita icono
              try { await doc.unsetFlag(SCOPE, "light"); } catch {}
              try { await t.actor?.unsetFlag(SCOPE, "light"); } catch {}
              await setLightEffectIcon(t, null);
            } else {
              await doc.setFlag(SCOPE, "light", { kind });
              await setLightEffectIcon(t, kind);
            }
          }
          ui.notifications.info(`Asignación de luz aplicada a ${selected.length} token(s).`);
          break;
        }

        case "concealment-kind": {
            const st = el.value; // "none" | "hidden"
            const selected = canvas?.tokens?.controlled ?? [];
            for (const t of selected) {
                const doc = t.document ?? t;
                try {
                if (st === "none") {
                    // Limpia en token y actor, y quita icono
                    await doc.unsetFlag(SCOPE, "concealment");
                    await t.actor?.unsetFlag(SCOPE, "concealment");
                    await setHiddenEffectIcon(t, false);
                } else if (st === "hidden") {
                    // Aplica en token y actor, y pone icono
                    await doc.setFlag(SCOPE, "concealment", "hidden");
                    await t.actor?.setFlag(SCOPE, "concealment", "hidden");
                    await setHiddenEffectIcon(t, true);
                }
                } catch (e) {
                console.warn("[TSDC:VP] concealment-kind error", e, t);
                }
            }
            ui.notifications.info(`Ocultación: ${st} aplicada a ${selected.length} token(s).`);
            break;
            }
        default:
          console.warn("[TSDC:VP] _onChange acción desconocida:", action);
      }
    } catch (err) {
      console.error("[TSDC:VP] _onChange error", action, err);
      ui.notifications?.error(`Error aplicando cambio: ${action}`);
    }

    // Re-render sin perder la pestaña activa
    this.render(false, { focus: false });
  }

  async _onAction(ev) {
    const action = ev?.currentTarget?.dataset?.action;
    // Memoriza el tab activo ANTES de awaits
    this._activeTab = __getActiveTabFrom(this.element, this._activeTab);
    console.debug("[TSDC:VP] _onAction", action, { tab: this._activeTab });

    const scene = canvas?.scene;
    if (!scene) { console.warn("[TSDC:VP] _onAction sin scene"); return; }
    const env = readSceneEnv(scene);

    try {
      switch (action) {
        case "save-preset": {
          const name = await Dialog.prompt({
            title: "Guardar preset de escena",
            content: `<p>Nombre del preset:</p><input type="text" name="n" value="Nuevo preset">`,
            label: "Guardar",
            callback: (html) => html[0].querySelector("input[name=n]")?.value?.trim()
          });
          if (!name) return;
          const presets = game.settings.get(SCOPE, "env.presets") || {};
          presets[name] = env;
          await game.settings.set(SCOPE, "env.presets", presets);
          ui.notifications.info(`Preset guardado: ${name}`);
          break;
        }

        case "load-preset": {
          const presets = game.settings.get(SCOPE, "env.presets") || {};
          const keys = Object.keys(presets);
          if (!keys.length) return ui.notifications.warn("No hay presets guardados.");
          const choice = await Dialog.prompt({
            title: "Cargar preset",
            content: `<p>Selecciona:</p>
              <select name="p">${keys.map(k=>`<option>${k}</option>`).join("")}</select>`,
            label: "Cargar",
            callback: (html) => html[0].querySelector("select[name=p]").value
          });
          if (!choice) return;
          await scene.setFlag(SCOPE, "env", presets[choice]);
          ui.notifications.info(`Preset cargado: ${choice}`);
          this.render(false, { focus:false });
          break;
        }

        case "clear-lights": {
          for (const t of canvas.tokens.placeables) {
            const doc = t.document ?? t;
            try { await doc.unsetFlag(SCOPE, "light"); } catch {}
            try { await t.actor?.unsetFlag(SCOPE, "light"); } catch {}
            await setLightEffectIcon(t, null);
          }
          ui.notifications.info("Luces eliminadas en toda la escena.");
          break;
        }

        case "give-torch": {
          const selected = canvas?.tokens?.controlled ?? [];
          for (const t of selected) {
            const doc = t.document ?? t;
            await doc.setFlag(SCOPE, "light", { kind: "torch" });
            await setLightEffectIcon(t, "torch");
          }
          ui.notifications.info(`Antorcha asignada a ${selected.length} token(s).`);
          break;
        }

        case "reveal-selected": {
          const selected = canvas?.tokens?.controlled ?? [];
          for (const t of selected) {
            try { await t.document?.unsetFlag(SCOPE, "concealment"); } catch {}
            try { await t.actor?.unsetFlag(SCOPE, "concealment"); } catch {}
            try { await t.document?.update({ hidden: false }); } catch {}
          }
          ui.notifications.info(`Revelado ${selected.length} token(s).`);
          break;
        }

        case "stealth-force-check": {
          const selected = canvas?.tokens?.controlled ?? [];
          if (!selected.length) {
            return ui.notifications.warn("Selecciona uno o más tokens para chequear.");
          }
          for (const t of selected) {
            const isHidden = t.document?.getFlag(SCOPE,"concealment")==="hidden" || t.document?.hidden === true;
            if (isHidden) {
              await checkStealthForHidden(t, "manual");
            }
          }
          ui.notifications.info("Chequeo de ocultación realizado.");
          break;
        }

        case "draw-rdet": {
            const token = canvas?.tokens?.controlled?.[0] ?? null;
            if (!token) return ui.notifications.warn("Selecciona un token.");

            // Limpia plantillas anteriores del usuario antes de dibujar
            await __clearRDetalleTemplates();

            // Calcula r_detalle = min(STD, Ambiente, Luz token)
            const env = readSceneEnv(canvas.scene);
            const STD = 60;
            const envCap = envCapFromFactor(env.factor, env.intensity);
            const lightCap = getTokenLightRadiusMeters(token, env);
            const r = Math.min(STD, envCap, Number.isFinite(lightCap) ? lightCap : STD);
            const units = (canvas.scene.grid.units || "m").replace(/meter/i, "m");

            await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
                t: "circle",
                x: token.center.x, y: token.center.y,
                distance: r,
                fillColor: "#00ff00",
                flags: { [SCOPE]: { rDetalle: r } }
            }]);

            ui.notifications.info(`R_detalle dibujado: ${r} ${units}`);
            break;
            }

        case "clear-rdet": {
          await __clearRDetalleTemplates();
          ui.notifications.info("R_detalle limpiado.");
          break;
        }

        case "probe-coverage": {
          const actorT = canvas.tokens.controlled[0];
          const targetT = Array.from(game.user.targets ?? [])[0];
          if (!actorT || !targetT) return ui.notifications.warn("Controla un token y selecciona un objetivo (target).");
          const pkg = buildPerceptionPackage({ actorToken: actorT, targetToken: targetT });
          const text = describePackage(pkg);
          await ChatMessage.create({
            content: `<div class="tsdc-perception">${text}</div>`,
            speaker: ChatMessage.getSpeaker({ token: actorT.document })
          });
          break;
        }

        case "roll-cardinal": {
            const r = await (new Roll("1d8")).evaluate(); 
            await r.toMessage({ flavor: "Dirección cardinal (1: NO, 2:N, 3:NE, 4:O, 5:E, 6:SO, 7:S, 8:SE)" });
            break;
            }

        default:
          console.warn("[TSDC:VP] _onAction acción desconocida:", action);
      }
    } catch (err) {
      console.error("[TSDC:VP] _onAction error", action, err);
      ui.notifications?.error(`Error ejecutando acción: ${action}`);
    }

    // Re-render sin perder la pestaña activa
    this.render(false, { focus: false });
  }
}

/** Botón en la barra de controles */
export function registerVisionPanelControl() {
  Hooks.on("getSceneControlButtons", (controlsArg) => {
    try {
      // Normalmente es un array; si no, intenta sacar el array real
      const list = Array.isArray(controlsArg)
        ? controlsArg
        : Array.isArray(controlsArg?.controls)
          ? controlsArg.controls
          : (ui.controls?.controls ?? []);
      if (!Array.isArray(list) || !list.length) return;

      const tokenCtl = list.find(c => c?.name === "token") ?? list[0];
      if (!tokenCtl) return;
      tokenCtl.tools ??= [];
      if (tokenCtl.tools.some(t => t?.name === "tsdc-vision-panel")) return; // evita duplicar
      tokenCtl.tools.push({
        name: "tsdc-vision-panel",
        title: "Visión & Escena",
        icon: "fas fa-eye",
        button: true,
        onClick: () => TSDCVisionPanel.open(),
        visible: game.user.isGM
      });
    } catch (e) {
      console.error("TSDC | registerVisionPanelControl failed", e, controlsArg);
    }
  });
}

/** Header button on actor sheets for quick access (GM only) */
Hooks.on("getActorSheetHeaderButtons", (sheet, buttons) => {
  try {
    if (!game.user.isGM) return;
    buttons.unshift({
      label: "Visión",
      class: "tsdc-vision-btn",
      icon: "fas fa-eye",
      onclick: () => TSDCVisionPanel.open()
    });
  } catch (e) {
    console.error("TSDC | getActorSheetHeaderButtons failed", e);
  }
});
