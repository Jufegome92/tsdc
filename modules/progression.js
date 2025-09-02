import { TSDC } from "../config.js";

/** Nivel → Rango (cada 3 niv) */
export function levelToRank(level=0) {
  return Math.floor(Number(level||0) / 3);
}

/** ¿cuántos “ticks” necesito para subir 1 nivel de esta pista? */
export function trackThreshold(actor, trackType, key) {
  // skills dependen de category y del background
  if (trackType === "skills") {
    const bg = actor.system.background;
    const major = TSDC.BACKGROUNDS[bg]?.major ?? actor.system.progression?.affinityMajor;
    const cat = actor.system.progression?.skills?.[key]?.category;
    return (cat && major && cat === major) ? TSDC.MAJOR_THRESHOLD : TSDC.MINOR_THRESHOLD;
  }
  // otros (weapons, maneuvers, defense, armor, resistances) → siempre 10
  return TSDC.MINOR_THRESHOLD;
}

/** Aplica 1 punto de progreso; si supera umbral sube nivel y recalcula rango */
export async function addProgress(actor, trackType, key, amount=1) {
  const path = `system.progression.${trackType}.${key}`;
  const data = foundry.utils.getProperty(actor, path);
  if (!data) return { leveled:false };

  data.progress = Number(data.progress||0) + amount;

  const threshold = trackThreshold(actor, trackType, key);
  let leveled = false;

  if (data.progress >= threshold) {
    data.progress -= threshold;
    data.level = Number(data.level||0) + 1;
    data.rank  = levelToRank(data.level);
    leveled = true;
  }

  await actor.update({ [path]: data });
  return { leveled, level: data.level, rank: data.rank, progress: data.progress };
}
