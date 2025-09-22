// modules/features/species/index.js
import { getSpecies, listSpecies as _listSpecies } from "./data.js";
import { buildSpeciesNaturalWeapons } from "./natural-weapons.js";
import { buildHealthPartsFromAnatomy } from "../../monsters/factory.js";
import { setTrackLevel } from "../../progression.js";

/** Lista todas las especies (re-export de data.js) */
export function listSpecies() { return _listSpecies(); }

/** Alias por claridad en el wizard */
export function getSpeciesByKey(key) { return getSpecies(key); }

/** Convierte rangos del catálogo a hints en cm/kg/años para el wizard */
export function rangesFromSpecies(sp) {
  if (!sp) return null;
  const asInt = (x) => Number.isFinite(x) ? Math.round(x) : null;
  const toRange = (arr, mapFn) => Array.isArray(arr) && arr.length === 2
    ? { min: mapFn(arr[0]), max: mapFn(arr[1]) }
    : null;
  return {
    age:      toRange(sp.lifespan, (n) => asInt(n)),
    heightCm: toRange(sp.heightM,  (m) => asInt(m * 100)),
    weightKg: toRange(sp.weightKg, (n) => asInt(n)),
  };
}


/**
 * Aplica rasgos base de especie al actor (atributos, idiomas, tamaño, velocidad, vigor).
 * No pisa valores existentes que el usuario ya tocó salvo que se indique.
 */
export async function applySpecies(actor, speciesKey) {
  const def = getSpecies(speciesKey);
  if (!actor || !def) return;

  const patch = {};

  // Marca especie
  patch["system.species.key"] = def.key;
  patch["system.species.label"] = def.label;
  patch["system.species.size"] = def.size;
  patch["system.species.speed"] = def.speed;
  patch["system.species.languages"] = def.languages;

  // Sugerencias de rangos (no obligatorias; útiles para UI)
  patch["system.species.heightRangeM"] = def.heightM;
  patch["system.species.weightRangeKg"] = def.weightKg;
  patch["system.species.lifespan"] = def.lifespan;

  // Bonos a atributos (+1)
  for (const [attr, inc] of Object.entries(def.attrBonuses ?? {})) {
    const cur = Number(actor.system?.attributes?.[attr] ?? 0);
    patch[`system.attributes.${attr}`] = cur + Number(inc||0);
  }

  // Vigor inicial (nivel/rango)
  if (def.vigorStart) {
    await setTrackLevel(actor, "skills", "vigor", Number(def.vigorStart.level||1));
    await actor.update({ "system.progression.skills.vigor.rank": Number(def.vigorStart.rank||0) });
    // Guarda categoría si no existe (en tu catálogo Vigor es física)
    await actor.update({ "system.progression.skills.vigor.category": "physical" });
  }

  const naturals = buildSpeciesNaturalWeapons(def.key, { level: actor.system?.level ?? 1 });
  if (naturals.length) {
    await actor.setFlag("tsdc", "naturalWeapons", naturals);
    for (const rec of naturals) {
      await setTrackLevel(actor, "weapons", rec.key, 1);
      await actor.update({ [`system.progression.weapons.${rec.key}.category`]: "natural" });
    }
    const primary = naturals.find(rec => rec.occupiesSlot !== false && (rec.assign ?? "main") !== "off");
    const offhand = naturals.find(rec => rec.occupiesSlot !== false && (rec.assign ?? "main") === "off");
    const equipPatch = {};
    if (primary) equipPatch["system.inventory.equipped.mainHand"] = `natural:${primary.key}`;
    if (offhand) equipPatch["system.inventory.equipped.offHand"] = `natural:${offhand.key}`;
    if (Object.keys(equipPatch).length) await actor.update(equipPatch);
  } else {
    await actor.unsetFlag("tsdc", "naturalWeapons");
  }

  if (!actor.system?.health?.parts || !Object.keys(actor.system.health.parts).length) {
    const anatomy = actor.system?.anatomy ?? {};
    const healthParts = buildHealthPartsFromAnatomy(anatomy, { level: actor.system?.level ?? 1 });
    if (Object.keys(healthParts).length) {
      patch["system.health.parts"] = healthParts;
    }
  }

  await actor.update(patch);
}
