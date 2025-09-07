// modules/progression.js
import { TSDC } from "./config.js";
import { getBackground, getThresholdForSpec } from "./features/affinities/index.js";

/** ===== Nivel → Rango (triangular) =====
 * Nivel 0 → Rango 0
 * Nivel 1 → Rango 1
 * Nivel 3 → Rango 2
 * Nivel 6 → Rango 3
 * Nivel 10 → Rango 4
 * r = floor((sqrt(8*L + 1) - 1) / 2)
 */
export function levelToRank(level = 0) {
  const L = Math.max(0, Number(level || 0));
  return Math.floor((Math.sqrt(8 * L + 1) - 1) / 2);
}

/** ¿Cuántos “ticks” necesito para subir 1 nivel? */
export function trackThreshold(actor, trackType, key) {
  // Skills dependen de la categoría y del trasfondo (afinidad mayor)
  if (trackType === "skills") {
    const node = actor?.system?.progression?.skills?.[key] ?? {};
    const cat = node?.category ?? null;

    if (cat) {
      // Usa helper centralizado de afinidades
      return getThresholdForSpec(actor, cat);
    }

    // Si no tenemos categoría aún, usa la afinidad mayor como pista; si no, MINOR por defecto.
    const major = getBackground(actor)?.major ?? null;
    return major ? TSDC.MAJOR_THRESHOLD : TSDC.MINOR_THRESHOLD;
  }

  // Otras pistas: weapons, maneuvers, defense, armor, resistances...
  return TSDC.MINOR_THRESHOLD;
}

/** Asegura que exista system.progression.<trackType>.<key> con la forma esperada */
async function ensureTrackShape(actor, trackType, key) {
  if (!key) return false;
  const base = `system.progression.${trackType}`;
  const existing = foundry.utils.getProperty(actor, `${base}.${key}`);
  if (existing) return false;

  const patch = {};
  patch[`${base}.${key}`] = { level: 0, rank: 0, progress: 0, fails: 0 };
  await actor.update(patch);
  return true;
}

/** Fija el nivel de una pista (resetea progreso) y recalcula rango */
export async function setTrackLevel(actor, trackType, key, level = 1) {
  if (!key) return;
  await ensureTrackShape(actor, trackType, key);

  const path = `system.progression.${trackType}.${key}`;
  const cur  = foundry.utils.getProperty(actor, path) ?? { level: 0, rank: 0, progress: 0, fails: 0 };

  const L = Math.max(0, Number(level || 0));
  const next = {
    ...cur,
    level: L,
    rank: levelToRank(L),
    progress: 0
  };

  await actor.update({ [path]: next });
}

/** Suma fallos (misma semántica que ya tenías) */
export async function addFail(actor, trackType, key, amount = 1) {
  await ensureTrackShape(actor, trackType, key);
  const path = `system.progression.${trackType}.${key}`;
  const data = foundry.utils.getProperty(actor, path);
  if (!data) return 0;

  data.fails = Math.max(0, Number(data.fails || 0) + Number(amount || 0));
  await actor.update({ [path]: data });
  return data.fails;
}

/** Aplica progreso; si supera umbral sube nivel y recalcula rango */
export async function addProgress(actor, trackType, key, amount = 1) {
  await ensureTrackShape(actor, trackType, key);

  const path = `system.progression.${trackType}.${key}`;
  const data = foundry.utils.getProperty(actor, path);
  if (!data) return { leveled: false };

  // Para skills: si falta la categoría, intenta inferirla y guardarla
  if (trackType === "skills" && !data.category) {
    try {
      const { getCategoryForSpec } = await import("./features/specializations/index.js");
      const cat = getCategoryForSpec?.(key);
      if (cat) data.category = cat;
    } catch (err) {
      console.warn("TSDC | addProgress: no se pudo inferir categoría de la skill", err);
    }
  }

  data.progress = Math.max(0, Number(data.progress || 0) + Number(amount || 0));
  let leveled = false;

  const threshold = trackThreshold(actor, trackType, key);
  while (data.progress >= threshold) {
    data.progress -= threshold;
    data.level = Math.max(0, Number(data.level || 0) + 1);
    leveled = true;
  }

  data.rank = levelToRank(data.level);

  await actor.update({ [path]: data });
  return { leveled, level: data.level, rank: data.rank, progress: data.progress };
}

/** ===== Coherencia automática de rango cuando alguien toca .level directo ===== */
Hooks.on("preUpdateActor", (actor, update) => {
  try {
    const prog = update?.system?.progression;
    if (!prog || typeof prog !== "object") return;

    function visit(obj) {
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === "object" && !("level" in v)) {
          visit(v); // baja un nivel (trackType / key)
          continue;
        }
        if (v && typeof v === "object" && Object.prototype.hasOwnProperty.call(v, "level")) {
          const L = Number(v.level);
          if (Number.isFinite(L)) v.rank = levelToRank(L);
        }
      }
    }

    visit(prog);
  } catch (err) {
    console.warn("TSDC | preUpdateActor rank coherence failed:", err);
  }
});
