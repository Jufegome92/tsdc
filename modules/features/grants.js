//modules/features/grants.js
import { MANEUVERS } from "./maneuvers/data.js";
import { getRelicPower } from "./relics/data.js";

function _nowISO(){ return new Date().toISOString(); }

async function _ensurePath(actor, path, seed) {
  const current = foundry.utils.getProperty(actor, path);
  if (current) return false;
  await actor.update({ [path]: seed });
  return true;
}

// Inicializa progresión de una maniobra si no existe
async function _ensureManeuverProgress(actor, key) {
  const path = `system.progression.maneuvers.${key}`;
  return _ensurePath(actor, path, { rank: 1, progress: 0, createdAt: _nowISO() });
}

// Inicializa progresión de un poder de reliquia si no existe
async function _ensureRelicProgress(actor, key) {
  const path = `system.progression.relics.${key}`;
  return _ensurePath(actor, path, { rank: 1, progress: 0, createdAt: _nowISO() });
}

export async function grantManeuver(actor, key, { source="loot", silent=false } = {}) {
  const def = MANEUVERS[key];
  if (!def) throw new Error(`Maniobra desconocida: ${key}`);

  const knownPath = `system.features.known.maneuvers.${key}`;
  await _ensurePath(actor, knownPath, { enabled: true, createdAt: _nowISO(), source });

  await _ensureManeuverProgress(actor, key);

  if (!silent) ui.notifications.info(`${actor.name} aprendió la maniobra: ${def.label}`);
  return true;
}

export async function revokeManeuver(actor, key, { keepProgress=false } = {}) {
  const updates = {};
  updates[`system.features.known.maneuvers.-=${key}`] = null;
  if (!keepProgress) updates[`system.progression.maneuvers.-=${key}`] = null;
  await actor.update(updates);
  ui.notifications.warn(`${actor.name} ya no conoce la maniobra: ${key}`);
}

export async function grantRelicPower(actor, key, { source="relic", silent=false } = {}) {
  const def = getRelicPower(key);
  if (!def) throw new Error(`Poder de reliquia desconocido: ${key}`);

  const knownPath = `system.features.known.relicPowers.${key}`;
  await _ensurePath(actor, knownPath, { enabled: true, createdAt: _nowISO(), source });

  await _ensureRelicProgress(actor, key);

  if (!silent) ui.notifications.info(`${actor.name} sintoniza el poder: ${def.label}`);
  return true;
}

export async function revokeRelicPower(actor, key) {
  await actor.update({ [`system.features.known.relicPowers.-=${key}`]: null });
  ui.notifications.warn(`${actor.name} pierde el poder de reliquia: ${key}`);
}

export async function grantNote(actor, { id, label, journalUUID }) {
  if (!journalUUID) throw new Error("journalUUID requerido para grantNote");
  const path = `system.features.known.notes.${id}`;
  await actor.update({ [path]: { label, journalUUID, createdAt: _nowISO() } });
  ui.notifications.info(`${actor.name} obtuvo: ${label}`);
}

export function listKnown(actor) {
  const k = actor.system?.features?.known || {};
  return {
    maneuvers: Object.keys(k.maneuvers || {}).filter(m => k.maneuvers[m]?.enabled),
    relicPowers: Object.keys(k.relicPowers || {}).filter(r => k.relicPowers[r]?.enabled),
    notes: k.notes || {}
  };
}
