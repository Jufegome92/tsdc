// modules/features/inventory/index.js
// Utilidades de inventario y slots (actor.system.inventory)

import { getWeapon } from "../weapons/index.js";

/** Acceso seguro a rutas */
function gp(o, path, d=null) { return foundry.utils.getProperty(o, path) ?? d; }

/** Genera un id simple para items del bag */
function genId() {
  return "itm_" + Math.random().toString(36).slice(2, 10);
}

/** Devuelve array del bag (clonado superficial para seguridad) */
export function getBag(actor) {
  const arr = gp(actor, "system.inventory.bag", []);
  return Array.isArray(arr) ? [...arr] : [];
}

/** Mapa id->item para búsquedas rápidas */
export function bagIndex(actor) {
  const idx = new Map();
  for (const it of getBag(actor)) idx.set(it.id, it);
  return idx;
}

/** Devuelve equipped (objeto con ids por slot) */
export function getEquipped(actor) {
  return { ...(gp(actor, "system.inventory.equipped", {})) };
}

/** Añadir item al bag; retorna el item con id asignado */
export async function addItem(actor, item) {
  const bag = getBag(actor);
  const withId = { id: item.id ?? genId(), qty: 1, ...item };
  bag.push(withId);
  await actor.update({ "system.inventory.bag": bag });
  return withId;
}

/** Elimina item por id del bag (y des-equipa si estaba equipado en algún slot) */
export async function removeItem(actor, itemId) {
  const bag = getBag(actor);
  const filtered = bag.filter(i => i.id !== itemId);
  const eq = getEquipped(actor);
  for (const k of Object.keys(eq)) if (eq[k] === itemId) eq[k] = null;
  await actor.update({ "system.inventory.bag": filtered, "system.inventory.equipped": eq });
}

/** Equipo compatible por slot */
function isCompatibleForSlot(item, slot) {
  if (!item) return false;
  switch (slot) {
    case "mainHand":
    case "offHand":
      return item.type === "weapon";
    case "shield":
      return item.type === "shield";
    case "head":
    case "chest":
    case "legs":
    case "bracers":
    case "boots":
      return item.type === "armor" && item.slot === slot;
    case "insignia":
      return item.type === "jewel" && item.subtype === "insignia";
    case "amulet":
      return item.type === "jewel" && item.subtype === "amulet";
    case "pendant1":
    case "pendant2":
      return item.type === "jewel" && item.subtype === "pendant";
    default:
      return false;
  }
}

/** Equipa itemId en slot; valida compatibilidad */
export async function equip(actor, slot, itemId) {
  const idx = bagIndex(actor);
  const item = idx.get(itemId) ?? null;
  const eq = getEquipped(actor);

  if (itemId === null) {
    eq[slot] = null;
    await actor.update({ "system.inventory.equipped": eq });
    return { slot, id: null };
  }

  if (!item) {
    ui.notifications?.warn("No existe el item en la mochila.");
    return null;
  }
  if (!isCompatibleForSlot(item, slot)) {
    ui.notifications?.warn("Ese objeto no es compatible con el slot.");
    return null;
  }
  // Si ocupa manos y se equipa en mainHand, limpia conflictos mínimos
  if (slot === "mainHand" && item.type === "weapon") {
    // si fuera de 2 manos, opcionalmente podríamos limpiar offHand/escudo
    // (lo implementamos más adelante si hace falta)
  }
  eq[slot] = item.id;
  await actor.update({ "system.inventory.equipped": eq });
  return { slot, id: item.id };
}

export async function unequip(actor, slot) {
  const eq = getEquipped(actor);
  eq[slot] = null;
  await actor.update({ "system.inventory.equipped": eq });
}

/** Devuelve el item equipado (objeto del bag) para un slot dado */
export function getEquippedItem(actor, slot) {
  const eq = getEquipped(actor);
  const id = eq[slot] ?? null;
  if (!id) return null;
  return bagIndex(actor).get(id) ?? null;
}

/** Devuelve la clave de arma equipada por mano ("main"|"off"). */
export function getEquippedWeaponKey(actor, which="main") {
  const slot = which === "off" ? "offHand" : "mainHand";
  const it = getEquippedItem(actor, slot);
  if (!it || it.type !== "weapon") return null;
  return it.key ?? null;
}

/** Helpers de listado para la UI */
export function listForSlot(actor, slot) {
  const bag = getBag(actor);
  return bag.filter(it => isCompatibleForSlot(it, slot));
}

export function listWeaponsInBag(actor) {
  return getBag(actor).filter(it => it.type === "weapon");
}

/** Nombre legible fallback */
export function itemLabel(it) {
  if (!it) return "";
  if (it.name) return it.name;
  if (it.type === "weapon" && it.key) {
    return getWeapon(it.key)?.label ?? it.key;
  }
  return it.type ?? "item";
}

export function getItemById(actor, id) {
  const bag = actor.system?.inventory?.bag ?? [];
  return bag.find(it => it.id === id) ?? null;
}