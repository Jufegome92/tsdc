// modules/features/species/index.js
import { getSpecies, listSpecies as _listSpecies } from "./data.js";
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

  await actor.update(patch);
}
