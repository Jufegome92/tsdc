// systems/tsdc/modules/features/known.js
import { MANEUVERS } from "./maneuvers/data.js";
import { RELIC_POWERS } from "./relics/data.js";

export function actorKnownManeuvers(actor) {
  const k = actor?.system?.features?.known?.maneuvers ?? {};
  const p = actor?.system?.progression?.maneuvers ?? {};
  const keys = new Set([...Object.keys(k), ...Object.keys(p)]);
  return [...keys].filter(key => (k[key]?.enabled ?? true) && !!MANEUVERS[key]);
}

export function actorKnownRelicPowers(actor) {
  const k = actor?.system?.features?.known?.relicPowers ?? {};
  return Object.keys(k).filter(key => k[key]?.enabled && !!RELIC_POWERS[key]);
}

export function actorKnownNotes(actor) {
  return actor?.system?.features?.known?.notes ?? {};
}
