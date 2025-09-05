import * as MathUtil from "./utils/math.js";
import * as Attr from "./features/attributes/index.js";
import * as Evo from "./features/advantage/index.js";
import { TSDCActor } from "./documents/actor.js";
import { TSDCActorSheet } from "./sheets/actor-sheet.js";
//import "./rolls/post-eval.js";
import { registerChatListeners } from "./chat/listeners.js";
import { setTrackLevel } from "./progression.js";
import { SPECIES_NATURAL_WEAPONS } from "./features/species/natural-weapons.js";
import * as Ail from "./ailments/index.js";

Hooks.once("init", () => {
  console.log("Transcendence | init");

  // Documento Actor propio
  CONFIG.Actor.documentClass = TSDCActor;

  // Registrar hoja por defecto
  foundry.documents.collections.Actors.registerSheet("tsdc", TSDCActorSheet, { types: ["character","creature"], makeDefault: true });
  console.log("TSDC | sheet registered");

  game.transcendence = {
    utils: { ...MathUtil },
    features: {
      attributes: Attr,
      evo: Evo
    }
  };
  game.transcendence.ailments = Ail;
  console.log("TSDC | init done");
});

Hooks.once("ready", () => {
  console.log(`Transcendence | ready (system=${game.system.id} v${game.system.version ?? game.system.data?.version})`);
  registerChatListeners();
  // MIGRACIÓN SUAVE: si falta affinityMajor, cópialo del background
  for (const actor of game.actors ?? []) {
    const sys = actor.system ?? {};
    const cur = sys.progression?.affinityMajor ?? null;
    if (!cur) {
      const bgKey = sys.background ?? "none";
      const major = (game?.transcendence ? game.transcendence : null) // por si quieres evitar imports aquí
        ? null : null; // (no lo necesitamos, usamos el mismo mapa BACKGROUNDS que ya está en el archivo de afinidades)
    }
  }
});

Hooks.on("createActor", async (actor, opts, userId) => {
  try {
    const species = actor.system?.species ?? null;
    if (!species) return;

    const pack = SPECIES_NATURAL_WEAPONS[species];
    if (!pack) return;

    // Competencia nivel 1 para armas fijas
    for (const k of (pack.fixed ?? [])) {
      await setTrackLevel(actor, "weapons", k, 1);
    }
    // Si hay elecciones: marca “pendiente”
    if ((pack.choices ?? []).length) {
      await actor.update({ "system.pendingChoices.naturalWeapons": pack.choices });
      ui.notifications?.info(`${actor.name}: elige tus armas naturales en la hoja (pestaña Competencias/Elegibles).`);
    }
  } catch (e) {
    console.error("createActor natural weapons init error", e);
  }
});

Hooks.on("updateCombat", async (combat, change) => {
  if (!("turn" in change || "round" in change)) return;
  const actor = combat?.combatant?.actor;
  if (!actor) return;
  await Ail.tickPerRound(actor);
});