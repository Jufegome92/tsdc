// modules/tsdc.js
import * as MathUtil from "./utils/math.js";
import * as Attr from "./features/attributes/index.js";
import * as Evo from "./features/advantage/index.js";
import { TSDCActor } from "./documents/actor.js";
import { TSDCActorSheet } from "./sheets/actor-sheet.js";
import "./rolls/post-eval.js";
import { registerChatListeners } from "./chat/listeners.js";
import { setTrackLevel } from "./progression.js";
import { SPECIES_NATURAL_WEAPONS } from "./features/species/natural-weapons.js";
import * as Ail from "./ailments/index.js";
import { openCharacterWizard } from "./wizard/character-wizard.js";
import { applyBackgroundStartingCompetences } from "./features/affinities/index.js";
//import "./combat/loop.js";
//import { beginNewInitiativeDay } from "./combat/initiative.js";
import { registerAtbTrackerButton, registerAtbAutoOpen } from "./atb/tracker.js";
import { registerAtbUI } from "./atb/ui.js";
import { ATB_API } from "./atb/engine.js";
import "./atb/grimoire.js";
import { TSDCVisionPanel, registerVisionPanelControl } from "./ui/vision-panel.js";
import { registerStealthDetection, checkStealthOnAction } from "./stealth/detection.js";
import { actionMove } from "./atb/actions.js";
import * as Reactions from "./atb/reactions.js";

const _guardWizardOpen = new Set();

/** Intenta abrir el wizard cuando se abre una hoja de actor */
async function maybeOpenWizardForSheet(sheet) {
  const actor = sheet?.actor;
  if (!actor || actor.type !== "character") return;

  // Si ya está bloqueada la identidad, no abras wizard
  if (actor.system?.identity?.locked) return;

  // Evita reentradas
  if (_guardWizardOpen.has(actor.id)) return;
  _guardWizardOpen.add(actor.id);

  try {
    // Cierra la hoja que Foundry intentó abrir
    await sheet.close({ force: true });
    // Abre el wizard (al finalizar, el propio wizard reabre la hoja)
    await openCharacterWizard(actor);
  } catch (err) {
    console.error("TSDC | maybeOpenWizardForSheet failed", err);
  } finally {
    _guardWizardOpen.delete(actor.id);
  }
}

Hooks.once("init", () => {
  console.log("Transcendence | init");
  foundry.applications.handlebars.loadTemplates([
    "systems/tsdc/templates/cards/action-card.hbs",
    "systems/tsdc/templates/apps/atb-tracker.hbs",
    "systems/tsdc/templates/apps/grimoire.hbs",
    "systems/tsdc/templates/apps/vision-panel.hbs"
  ]);

  Handlebars.registerHelper("loc", (k) => game.i18n.localize(String(k ?? "")));
  // Pequeño concat útil: {{loc (concat "TSDC.Attr." key)}}
  Handlebars.registerHelper("concat", function () {
    const args = Array.from(arguments).slice(0, -1);
    return args.join("");
  });

  registerVisionPanelControl();

   // Settings para iniciativa por “día”
  game.settings.register("tsdc", "initiative.dayId", { scope:"world", config:false, type:String, default:"" });
  game.settings.register("tsdc", "initiative.monstersDeck", { scope:"world", config:false, type:Object, default:null });

  // settings (init):
  game.settings.register("tsdc", "env.presets", { scope:"world", config:false, type:Object, default:{} });
  game.settings.register("tsdc", "env.factor", { scope:"world", config:true, type:String, default:"none",
    choices: { none:"—", rain:"Lluvia", snow:"Nieve", fog:"Niebla", smoke:"Humo", dust:"Polvo", sand:"Arena" },
    name:"Entorno: factor"
  });
  game.settings.register("tsdc", "env.intensity", { scope:"world", config:true, type:String, default:"none",
    choices: { none:"—", light:"Ligera", intense:"Intensa", storm:"Tormenta", blizzard:"Tormenta de nieve", dense:"Densa", thick:"Espesa", moderate:"Moderado" },
    name:"Entorno: intensidad"
  });
  game.settings.register("tsdc", "env.darkness", { scope:"world", config:true, type:String, default:"none",
    choices: { none:"Ninguna", absolute:"Oscuridad absoluta", elemental:"Oscuridad elemental" },
    name:"Oscuridad"
  });
  game.settings.register("tsdc", "env.lightOverride", { scope:"world", config:false, type:Object, default:null });


  // Helpers de Handlebars
  const H = globalThis.Handlebars ?? window.Handlebars;
  if (H) {
    if (!H.helpers?.join) {
      H.registerHelper("join", (value, sep) => {
        const arr = Array.isArray(value) ? value : Object.values(value ?? {});
        return arr.join(typeof sep === "string" ? sep : ", ");
      });
    }
    if (!H.helpers?.eq) H.registerHelper("eq", (a, b) => a === b);
  }

  // Documento Actor propio
  CONFIG.Actor.documentClass = TSDCActor;

  // Registrar hoja por defecto
  foundry.documents.collections.Actors.registerSheet("tsdc", TSDCActorSheet, {
    types: ["character", "creature"],
    makeDefault: true
  });
  console.log("TSDC | sheet registered");

  // Exponer utilidades en el namespace del juego
  game.transcendence = {
    utils: { ...MathUtil },
    features: {
      attributes: Attr,
      evo: Evo
    },
    ailments: Ail
  };

  console.log("TSDC | init done");
});

Hooks.once("ready", () => {
  console.log(
    `Transcendence | ready (system=${game.system.id} v${game.system.version ?? game.system.data?.version})`
  );
  const regs = [
    registerChatListeners,
    registerAtbUI,
    registerAtbTrackerButton,
    registerAtbAutoOpen
  ]; 
  for (const fn of regs) {
    try { fn?.(); }
    catch (e) { console.error(`TSDC | ready: ${fn?.name || "fn"} failed`, e); }
  }
  try {
    ui.controls?.render?.({
      controls: ui.controls?.controls ?? [],
      tool: ui.controls?.tool?.name ?? ui.controls?.activeTool
    });
  } catch {}
  registerStealthDetection();
  game.transcendence = game.transcendence || {};
  game.transcendence.actions   = { move: actionMove };
  game.transcendence.reactions = {
    openWindow: Reactions.openReactionWindow,
    tryAO: Reactions.tryReactOpportunity,
    ao: Reactions.performOpportunityAttack,
    triggerFumble: Reactions.triggerFumbleReactions,
    clearWindows: Reactions.clearAllReactionWindows
  };
  game.transcendence.atb = ATB_API;
  game.transcendence.checkStealthOnAction = checkStealthOnAction;
  game.transcendence.openVisionPanel = () => TSDCVisionPanel.open();
  game.transcendence.openGrimoire = () => window.tsdcatb?.GrimoireApp?.openForCurrentUser();
});

/** Al crear un actor character → abrir wizard inmediatamente */
//Hooks.on("createActor", async (actor, _data, _options, _userId) => {
//  try {
//    if (!actor || actor.type !== "character") return;
//    if (actor.system?.identity?.locked) return;
//    if (_guardWizardOpen.has(actor.id)) return;
//    _guardWizardOpen.add(actor.id);

//    await openCharacterWizard(actor);
//  } catch (err) {
//    console.error("TSDC | openCharacterWizard on createActor failed", err);
//  } finally {
//    _guardWizardOpen.delete(actor?.id);
//  }
//});

/** Cuando se renderiza una hoja (compat V1/V2) → abrir wizard si procede */
Hooks.on("renderActorSheet", maybeOpenWizardForSheet);
Hooks.on("renderActorSheetV2", maybeOpenWizardForSheet);

/** Ticks por turno/ronda: usa los hooks que emite el loop para timing exacto */
Hooks.on("tsdc:onStartTurn", async (_combat, actor) => {
  // Aquí gatillas efectos “por turno” del actor activo (fatiga por enfoque, venenos, etc.)
  await Ail.tickPerRound(actor);
});

// (Opcional) si quieres algo “por ronda” global:
Hooks.on("tsdc:onStartRound", async (combat, round) => {
  // ejemplo: timers globales, clima que escala, etc.
  // no-op por ahora
});

// (Opcional) fin de ronda
Hooks.on("tsdc:onEndRound", async (combat, round) => {
  // ejemplo: expirar efectos que duran exactamente 1 ronda completa
  // no-op por ahora
});