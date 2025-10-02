// modules/features/affinities/index.js
import { setTrackLevel, recomputeReferenceLevel } from "../../progression.js";

/**
 * Catálogo de trasfondos
 * - affinityMajor: categoría con umbral 5 (las demás 10)
 * - picks: array de { category, count } para el número de especializaciones iniciales a elegir
 * - notes: texto opcional
 * - flags: reglas especiales (ej. sustituciones)
 */
export const BACKGROUNDS = {
  martial: {
    key: "martial",
    label: "Artista Marcial",
    affinityMajor: "physical",
    picks: [
      { category: "physical", count: 2 },
      { category: "mental",  count: 1 },
      { category: "knowledge",  count: 1 },
    ],
    flags: { martialCanSwapNaturalWeaponsForFabricated: true },
    notes:
      "Competencias iniciales: 2 Físicas + 1 Mental + 1 Saber. Puede sustituir competencias iniciales en armas naturales de su especie por armas fabricadas.",
  },

  artisan: {
    key: "artisan",
    label: "Artesano",
    affinityMajor: "arts",
    picks: [
      { category: "arts", count: 2 },
      // “+ 1 de Saberes o 1 Social”: lo modelamos como un cupo flexible (ver wizard)
      { category: "flex:knowledge|social", count: 1 },
      { category: "mental",  count: 1 },
    ],
    notes: "Competencias iniciales: 2 de Artes/Oficios + 1 de Saberes o 1 Social + 1 Mental.",
  },

  wanderer: {
    key: "wanderer",
    label: "Errante",
    affinityMajor: "mental",
    picks: [
      { category: "mental",  count: 2 },
      { category: "physical", count: 1 },
      { category: "arts", count: 1 },
    ],
    notes: "Competencias iniciales: 2 Mentales + 1 Física + 1 Arte y Oficio.",
  },

  warden: {
    key: "warden",
    label: "Custodio",
    affinityMajor: "knowledge",
    // “2 Saberes + 1 Social + 1 Mental” 
    picks: [
      { category: "knowledge", count: 2 },
      { category: "mental", count: 1 },
      { category: "social", count: 1 },
    ],
    notes: "Competencias iniciales: 2 Saberes + 1 Social + 1 Mental.",
  },

  noble: {
    key: "noble",
    label: "Noble",
    affinityMajor: "social",
    // “1 Social + 3 de cualquier otra categoría (a elección)”
    picks: [
      { category: "social", count: 1 },
      { category: "any",    count: 3 },
    ],
    notes: "Competencias iniciales: 1 Social + 3 de cualquier categoría.",
  },

  none: {
    key: "none",
    label: "Ninguno",
    affinityMajor: null,
    picks: [],
  },
};

/** Obtiene info de trasfondo del actor o por clave.
 *  Devuelve { key, label, major } donde major es la affinity mayor.
 */
export function getBackground(actorOrKey) {
  // Caso 1: te pasan el actor
  if (actorOrKey?.system) {
    const key = actorOrKey.system?.background?.key ?? "none";
    const base = BACKGROUNDS[String(key).toLowerCase()] ?? BACKGROUNDS.none;
    // Preferimos lo persistido en progression (lo pones en setBackground)
    const major = actorOrKey.system?.progression?.affinityMajor ?? base.affinityMajor ?? null;
    return { key: base.key, label: base.label, major };
  }

  // Caso 2: te pasan la clave
  const key = String(actorOrKey || "none").toLowerCase();
  const base = BACKGROUNDS[key] ?? BACKGROUNDS.none;
  return { key: base.key, label: base.label, major: base.affinityMajor ?? null };
}

/**
 * Aplica trasfondo en el actor.
 * Guarda la affinityMajor y el key del trasfondo.
 */
export async function setBackground(actor, backgroundKey) {
  const bg = BACKGROUNDS[String(backgroundKey || "none").toLowerCase()] ?? BACKGROUNDS.none;
  const patch = {
    "system.background.key": bg.key,
    "system.background.label": bg.label,
    "system.progression.affinityMajor": bg.affinityMajor ?? null,
  };
  await actor.update(patch);
  return bg;
}

/**
 * Aplica las competencias iniciales elegidas en el wizard.
 * @param {Actor} actor
 * @param {string} backgroundKey
 * @param {{byCategory: Record<string,string[]>}} selections  p.ej. { byCategory: { physical: ['acrobacias','atletismo'], mental:['intuicion'] } }
 */
export async function applyBackgroundStartingCompetences(actor, backgroundKey, selections) {
  const bg = BACKGROUNDS[String(backgroundKey || "none").toLowerCase()] ?? BACKGROUNDS.none;
  const byCat = selections?.byCategory ?? {};

  // Normaliza “flex:*” y “any” aquí mismo: ya nos llega resuelto desde el wizard,
  // pero validamos por seguridad.
  const totalToApply = [];
  for (const k of Object.keys(byCat)) {
    for (const specKey of (byCat[k] || [])) {
      totalToApply.push({ category: k, specKey });
    }
  }

  // Asigna RANGO 1 en cada especialización elegida
  for (const pick of totalToApply) {
    await setTrackLevel(actor, "skills", pick.specKey, 1);
  }

  const startingKeys = Array.from(new Set(totalToApply.map(p => p.specKey).filter(Boolean)));
  if (startingKeys.length) {
    await actor.update({ "system.background.startingSkills": startingKeys });
    await recomputeReferenceLevel(actor);
  }

  // Regla especial (solo deja nota; la sustitución de armas naturales requiere
  // conocer el set de armas naturales de la especie y tu UI de equipo):
  if (bg.flags?.martialCanSwapNaturalWeaponsForFabricated) {
    // Puedes guardar un flag para que el GM lo resuelva luego en la pestaña Competencias/Equipo
    await actor.update({ "system.flags.martialSwapAllowed": true });
  }
}

export function getThresholdForSpec(actor, specCategory) {
  const major = getBackground(actor)?.major ?? null;
  return major && specCategory === major ? 5 : 10;
}
