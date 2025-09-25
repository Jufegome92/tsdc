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
import { openCreatureWizard } from "./wizard/creature-wizard.js";
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
import * as Grants from "./features/grants.js";
import * as Known from "./features/known.js";
import * as Monsters from "./monsters/factory.js";
import "./movement/index.js";
import { registerAptitudeHooks } from "./features/aptitudes/runtime.js";
import "./features/aptitudes/granting.js";

const _guardWizardOpen = new Set();

/** Intenta abrir el wizard cuando se abre una hoja de actor */
async function maybeOpenWizardForSheet(sheet) {
  const actor = sheet?.actor;
  if (!actor) return;

  // Evita reentradas
  if (_guardWizardOpen.has(actor.id)) return;
  if (actor.getFlag("tsdc", "wizardOpen")) return;
  _guardWizardOpen.add(actor.id);

  try {
    const createdAt = actor._source?._stats?.createdTime || 0;
    // Sólo al crear el actor (ventana de 60s)
    if (Date.now() - createdAt > 60_000) return;

    // CHARACTER (igual que antes)
    if (actor.type === "character") {
      if (actor.system?.identity?.locked) return;
      await sheet.close({ force: true });              // 👈 cerrar primero
      setTimeout(() => openCharacterWizard(actor), 0); // 👈 abrir wizard
      return;
    }

    // CREATURE
    if (actor.type === "creature") {
      if (actor.flags?.tsdc?.built) return;
      await actor.setFlag("tsdc", "wizardOpen", true);
      await sheet.close({ force: true });
      try {
        // Ejecuta el wizard en este mismo turno de event loop
        await openCreatureWizard(actor);
      } finally {
        if (actor?.id && game.actors?.get(actor.id)) {
          try {
            await actor.unsetFlag("tsdc", "wizardOpen");
          } catch (err) {
            console.warn("TSDC | no se pudo limpiar wizardOpen en criatura", err);
          }
        }
      }
      return;
    }
  } catch (err) {
    console.error("TSDC | maybeOpenWizardForSheet failed", err);
  } finally {
    _guardWizardOpen.delete(actor?.id);
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
  game.settings.register("tsdc","askTargetEveryExec",{
    name: "Pedir objetivo en cada ejecución",
    hint: "Al comenzar EXEC de ataques/abilities, abrir selector/confirmación de objetivo.",
    scope: "world", config: true, type: Boolean, default: true
  });

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

Hooks.once("ready", async () => {
  console.log(
    `Transcendence | ready (system=${game.system.id} v${game.system.version ?? game.system.data?.version})`
  );

  // Initialize global data cache for reaction system
  await initializeReactionDataCache();

  const regs = [
    registerChatListeners,
    registerAtbUI,
    registerAtbTrackerButton,
    registerAtbAutoOpen,
    registerAptitudeHooks
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
  game.transcendence.monsters = Monsters;
  game.transcendence.grants = Grants; 
  game.transcendence.known = Known;
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

/** Auto-update natural weapon stats when weapon progression changes */
Hooks.on("updateActor", async (actor, data, _options, _userId) => {
  // Only process if weapons progression was updated
  if (!data.system?.progression?.weapons) return;

  // Get natural weapons from flags
  const naturalWeapons = actor.getFlag("tsdc", "naturalWeapons") || [];
  if (!naturalWeapons.length) return;

  // Check each updated weapon to see if it's a natural weapon
  const { updateNaturalWeaponStats } = await import("./features/species/natural-weapons.js");

  for (const [weaponKey, weaponData] of Object.entries(data.system.progression.weapons)) {
    // Check if this is a natural weapon and if level changed
    const isNaturalWeapon = naturalWeapons.some(w => w.key === weaponKey);
    if (isNaturalWeapon && weaponData.level !== undefined) {
      await updateNaturalWeaponStats(actor, weaponKey);
    }
  }
});

/** Initialize global data cache for reaction system performance */
async function initializeReactionDataCache() {
  try {
    // Initialize global cache
    game.tsdc = game.tsdc || {};

    // Cache aptitudes data
    const { APTITUDES } = await import("./features/aptitudes/data.js");
    game.tsdc.aptitudes = APTITUDES;

    // Cache maneuvers data
    const { MANEUVERS } = await import("./features/maneuvers/data.js");
    game.tsdc.maneuvers = MANEUVERS;

    // Cache relic powers data
    await import("./features/relics/data.js");
    game.tsdc.relics = {};

    // Cache weapons data
    const { WEAPONS } = await import("./features/weapons/data.js");
    game.tsdc.weapons = WEAPONS;

    console.log("TSDC | Reaction data cache initialized");
  } catch (error) {
    console.error("TSDC | Failed to initialize reaction data cache:", error);
  }
}
