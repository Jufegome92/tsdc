// modules/features/affinities/index.js
import { BACKGROUND_STARTING, ALWAYS_START } from "./starting.js";
import { setTrackLevel } from "../../progression.js";
import { listSpecs } from "../specializations/index.js";

export async function applyBackgroundStartingCompetences(actor, bgKey) {
  try {
    // 1) Siempre "vigor" a nivel 1
    for (const sk of (ALWAYS_START.skills ?? [])) {
      await setTrackLevel(actor, "skills", sk, 1);
      // guarda categoría si no existía
      const cat = listSpecs().find(s => s.key === sk)?.category;
      if (cat) await actor.update({ [`system.progression.skills.${sk}.category`]: cat });
    }

    const rule = BACKGROUND_STARTING[bgKey];
    if (!rule) return;

    // Preparamos un pool de especializaciones por categoría
    const byCat = new Map();
    for (const s of listSpecs()) {
      const cat = s.category;
      if (!byCat.has(cat)) byCat.set(cat, []);
      byCat.get(cat).push(s.key);
    }
    // Función para “asignar” N de una categoría (simple y determinista)
    async function assign(cat, n) {
      const list = (byCat.get(cat) ?? []).slice().sort();
      for (let i = 0; i < Math.min(n, list.length); i++) {
        const key = list[i];
        await setTrackLevel(actor, "skills", key, 1);
        await actor.update({ [`system.progression.skills.${key}.category`]: cat });
      }
    }

    // Aplica por categorías
    const { physical=0, mental=0, social=0, arts=0, knowledge=0, any=0 } = rule;
    await assign("physical",  physical);
    await assign("mental",    mental);
    await assign("social",    social);
    await assign("arts",      arts);
    await assign("knowledge", knowledge);

    // “any” → rellena de cualquier categoría restante
    const all = listSpecs().map(s => s.key);
    const already = Object.keys(actor.system?.progression?.skills ?? {});
    const remaining = all.filter(k => !already.includes(k)).sort();
    for (let i=0; i<Math.min(any, remaining.length); i++) {
      const key = remaining[i];
      const cat = listSpecs().find(s=>s.key===key)?.category;
      await setTrackLevel(actor, "skills", key, 1);
      if (cat) await actor.update({ [`system.progression.skills.${key}.category`]: cat });
    }
  } catch (err) {
    console.error("applyBackgroundStartingCompetences error", err);
  }
}

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
  const major = BACKGROUNDS[bg]?.major ?? null;
  await actor.update({
    "system.background": bg,
    "system.progression.affinityMajor": major
  });
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
