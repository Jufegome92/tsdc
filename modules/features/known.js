// systems/tsdc/modules/features/known.js
import { MANEUVERS } from "./maneuvers/data.js";
import { RELIC_POWERS } from "./relics/data.js";

export function actorKnownManeuvers(actor) {
  const k = actor?.system?.features?.known?.maneuvers ?? {};
  const p = actor?.system?.progression?.maneuvers ?? {};
  const keys = new Set([...Object.keys(k), ...Object.keys(p)]);
  return [...keys].filter(key => {
    const isKnownEnabled = (k[key]?.enabled ?? true);
    const hasProgressionRank = Number(p[key]?.rank || 0) > 0;
    const existsInData = !!MANEUVERS[key];

    // Una maniobra se considera conocida si:
    // 1. Está habilitada en known Y existe en el catálogo
    // 2. O tiene rango > 0 en progression Y existe en el catálogo
    return existsInData && (isKnownEnabled || hasProgressionRank);
  });
}

export function actorKnownRelicPowers(actor) {
  const k = actor?.system?.features?.known?.relicPowers ?? {};
  return Object.keys(k).filter(key => k[key]?.enabled && !!RELIC_POWERS[key]);
}

export function actorKnownNotes(actor) {
  return actor?.system?.features?.known?.notes ?? {};
}
