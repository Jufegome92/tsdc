// modules/progression.js
import { TSDC } from "./config.js";

export async function setTrackLevel(actor, trackType, key, level=1) {
  if (!key) return;
  const path = `system.progression.${trackType}.${key}`;
  const cur  = foundry.utils.getProperty(actor, path) ?? { level: 0, rank: 0, progress: 0, fails: 0 };
  cur.level = Number(level)||0;
  cur.rank  = levelToRank(cur.level);
  cur.progress = 0;
  await actor.update({ [path]: cur });
}

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

/** Asegura que exista system.progression.<trackType>.<key> con {level,rank,progress} */
async function ensureTrackShape(actor, trackType, key) {
  if (!key) return false;
  const base = `system.progression.${trackType}`;
  const existing = foundry.utils.getProperty(actor, `${base}.${key}`);
  if (existing) return false;
  const patch = {};
  patch[`${base}.${key}`] = { level: 0, rank: 0, progress: 0 };
  await actor.update(patch);
  return true;
}

export async function addFail(actor, trackType, key, amount=1) {
  await ensureTrackShape(actor, trackType, key);
  const path = `system.progression.${trackType}.${key}`;
  const data = foundry.utils.getProperty(actor, path);
  if (!data) return 0;
  data.fails = Number(data.fails||0) + Number(amount||0);
  await actor.update({ [path]: data });
  return data.fails;
}

/** Aplica progreso; si supera umbral sube nivel y recalcula rango */
export async function addProgress(actor, trackType, key, amount=1) {
  // crea el nodo si no existía (primera vez que se progresa esa pista)
  await ensureTrackShape(actor, trackType, key);

  const path = `system.progression.${trackType}.${key}`;
  const data = foundry.utils.getProperty(actor, path);
  if (!data) return { leveled:false };

  data.progress = Number(data.progress||0) + Number(amount||0);

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
