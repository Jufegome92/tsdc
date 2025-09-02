// modules/features/affinities/index.js

// Categorías que ya usas en SPECIALIZATIONS: "physical" | "mental" | "social" | "arts" | "knowledge"
export const BACKGROUNDS = {
  none:      { key: "none",      label: "— Sin trasfondo",       major: null },
  martial:   { key: "martial",   label: "Artista Marcial",       major: "physical"  },
  artisan:   { key: "artisan",   label: "Artesano",              major: "arts"      },
  wanderer:  { key: "wanderer",  label: "Errante",               major: "mental"    },
  custodian: { key: "custodian", label: "Custodio",              major: "knowledge" },
  noble:     { key: "noble",     label: "Noble",                 major: "social"    }
};

/** Devuelve el objeto background actual del actor */
export function getBackground(actor) {
  const k = actor?.system?.background ?? "none";
  return BACKGROUNDS[k] ?? BACKGROUNDS.none;
}

/** Cambia el background del actor (clave del BACKGROUNDS) */
export async function setBackground(actor, key) {
  if (!actor) return;
  const bg = BACKGROUNDS[key] ? key : "none";
  await actor.update({ "system.background": bg });
}

/**
 * Umbral de progreso para una especialización dada.
 * - Si la categoría de la especialización coincide con la mayor del trasfondo → 5
 * - En caso contrario → 10
 * (Aquí puedes inyectar reglas extra más adelante.)
 */
export function getThresholdForSpec(actor, specCategory) {
  const bg = getBackground(actor);
  if (bg.major && specCategory === bg.major) return 5;
  return 10;
}
