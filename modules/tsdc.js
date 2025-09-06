// modules/tsdc.js
import * as MathUtil from "./utils/math.js";
import * as Attr from "./features/attributes/index.js";
import * as Evo from "./features/advantage/index.js";
import { TSDCActor } from "./documents/actor.js";
import { TSDCActorSheet } from "./sheets/actor-sheet.js";
// import "./rolls/post-eval.js";
import { registerChatListeners } from "./chat/listeners.js";
import { setTrackLevel } from "./progression.js";
import { SPECIES_NATURAL_WEAPONS } from "./features/species/natural-weapons.js";
import * as Ail from "./ailments/index.js";
import { openCharacterWizard } from "./wizard/character-wizard.js";
import { applyBackgroundStartingCompetences } from "./features/affinities/index.js";

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
  registerChatListeners();
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

/** Ticks de combate por turno/round */
Hooks.on("updateCombat", async (combat, change) => {
  if (!("turn" in change || "round" in change)) return;
  const actor = combat?.combatant?.actor;
  if (!actor) return;
  await Ail.tickPerRound(actor);
});
