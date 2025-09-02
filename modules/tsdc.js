import * as MathUtil from "./utils/math.js";
import * as Attr from "./features/attributes/index.js";
import * as Evo from "./features/advantage/index.js";
import { TSDCActor } from "./documents/actor.js";
import { TSDCActorSheet } from "./sheets/actor-sheet.js";

Hooks.once("init", () => {
  console.log("Transcendence | init");

  // Documento Actor propio
  CONFIG.Actor.documentClass = TSDCActor;

  // Registrar hoja por defecto
  Actors.unregisterSheet("core", ActorSheet);
  Actors.registerSheet("tsdc", TSDCActorSheet, { types: ["character", "creature"], makeDefault: true });
  console.log("TSDC | sheet registered");

  game.transcendence = {
    utils: { ...MathUtil },
    features: {
      attributes: Attr,
      evo: Evo
    }
  };
  console.log("TSDC | init done");
});

Hooks.once("ready", () => {
  console.log(`Transcendence | ready (system=${game.system.id} v${game.system.version ?? game.system.data?.version})`);
});
