// modules/features/inventory/index.js
// Utilidades de inventario y slots (actor.system.inventory)

import { getWeapon } from "../weapons/index.js";

const NAT_PREFIX = "natural:";

/** Acceso seguro a rutas */
function gp(o, path, d=null) { return foundry.utils.getProperty(o, path) ?? d; }

function getNaturalRecords(actor) {
  const arr = actor?.getFlag?.("tsdc", "naturalWeapons");
  return Array.isArray(arr) ? arr : [];
}

function naturalId(key) {
  return `${NAT_PREFIX}${String(key ?? "")}`;
}

function isNaturalId(id) {
  return typeof id === "string" && id.startsWith(NAT_PREFIX);
}

function parseNaturalId(id) {
  return isNaturalId(id) ? id.slice(NAT_PREFIX.length) : null;
}

function naturalRecordByKey(actor, key) {
  if (!key) return null;
  const low = String(key).toLowerCase();
  return getNaturalRecords(actor).find(rec => String(rec.key ?? "").toLowerCase() === low) ?? null;
}

function makeNaturalItem(actor, record) {
  if (!record) return null;
  const key = record.key;
  const id = naturalId(key);
  const rankPath = `system.progression.weapons.${key}.rank`;
  const levelPath = `system.progression.weapons.${key}.level`;
  const rank = Number(gp(actor, rankPath, 1));
  const level = Number(gp(actor, levelPath, 1));
  return {
    id,
    type: "natural",
    key,
    label: record.label ?? key,
    assign: record.assign ?? "main",
    allowsConcurrent: !!record.allowsConcurrent,
    occupiesSlot: record.occupiesSlot !== false,
    damageDie: record.damageDie ?? "d6",
    attackAttr: record.attackAttr ?? "agility",
    impactAttr: record.impactAttr ?? record.attackAttr ?? "agility",
    reachMeters: record.reachMeters ?? null,
    reachSpecial: record.reachSpecial ?? null,
    tags: Array.isArray(record.tags) ? [...record.tags] : [],
    effectId: record.effectId ?? null,
    noAttack: !!record.noAttack,
    powerPerRank: record.powerPerRank ?? null,
    durabilityPerRank: record.durabilityPerRank ?? null,
    // Include calculated values from the record
    durability: record.durability ?? null,
    power: record.power ?? null,
    material: record.material ?? null,
    quality: Number(record.quality ?? 1),
    grade: Number(record.grade ?? Math.max(1, rank || 1)),
    rank: Number.isFinite(rank) ? rank : 1,
    level: Number.isFinite(level) ? level : 1,
    requiresParts: Array.isArray(record.requiresParts) ? [...record.requiresParts] : []
  };
}

function assignMatchesSlot(assign, slot) {
  const normalized = String(assign || "main").toLowerCase();
  if (normalized === "either") return slot === "mainHand" || slot === "offHand";
  if (normalized === "off") return slot === "offHand";
  if (normalized === "main") return slot === "mainHand";
  return slot === "mainHand";
}

const PART_LABELS = {
  head: "cabeza",
  chest: "torso",
  bracers: "brazos",
  legs: "piernas",
  boots: "pies"
};

export function bodyPartLabel(part) {
  return PART_LABELS[part] || part;
}

function isBodyPartBroken(actor, partKey) {
  if (!partKey) return false;
  // Try both .current and .value for compatibility
  const current = Number(gp(actor, `system.health.parts.${partKey}.current`, null));
  const value = Number(gp(actor, `system.health.parts.${partKey}.value`, null));

  // Use whichever property exists
  const healthValue = Number.isFinite(current) ? current : value;
  if (!Number.isFinite(healthValue)) return false;
  return healthValue <= 0;
}

export function arePartsFunctional(actor, parts) {
  if (!parts) return true;
  const list = Array.isArray(parts) ? parts : [parts];
  if (!list.length) return true;
  return !list.some(part => isBodyPartBroken(actor, part));
}

export function describePartsStatus(actor, parts) {
  if (!parts) return "";
  const list = Array.isArray(parts) ? parts : [parts];
  const impaired = list.filter(part => isBodyPartBroken(actor, part)).map(bodyPartLabel);
  if (!impaired.length) return "";
  return `Partes lesionadas: ${impaired.join(", ")}`;
}

function isNaturalWeaponDisabled(actor, record) {
  if (!record || !Array.isArray(record.requiresParts) || !record.requiresParts.length) return false;
  return !arePartsFunctional(actor, record.requiresParts);
}

function describeNaturalDisable(actor, record) {
  if (!record || !Array.isArray(record.requiresParts)) return "";
  return describePartsStatus(actor, record.requiresParts);
}

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
      if (item.type === "natural") {
        if (item.occupiesSlot === false) return false;
        return assignMatchesSlot(item.assign, slot);
      }
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
  const eq = getEquipped(actor);

  if (itemId === null) {
    eq[slot] = null;
    await actor.update({ "system.inventory.equipped": eq });
    return { slot, id: null };
  }

  if (isNaturalId(itemId)) {
    const key = parseNaturalId(itemId);
    const record = naturalRecordByKey(actor, key);
    if (!record) {
      ui.notifications?.warn("No se reconoce el arma natural seleccionada.");
      return null;
    }
    const natItem = makeNaturalItem(actor, record);
    if (!isCompatibleForSlot(natItem, slot)) {
      ui.notifications?.warn("Esa arma natural no es compatible con la mano seleccionada.");
      return null;
    }
    if (isNaturalWeaponDisabled(actor, record)) {
      ui.notifications?.warn("Esa arma natural no puede usarse porque la parte está inutilizada.");
      return null;
    }
    eq[slot] = itemId;
    await actor.update({ "system.inventory.equipped": eq });
    return { slot, id: itemId };
  }

  const idx = bagIndex(actor);
  const item = idx.get(itemId) ?? null;

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
  if (isNaturalId(id)) {
    const record = naturalRecordByKey(actor, parseNaturalId(id));
    return makeNaturalItem(actor, record);
  }
  return bagIndex(actor).get(id) ?? null;
}

/** Devuelve la clave de arma equipada por mano ("main"|"off"). */
export function getEquippedWeaponKey(actor, which="main") {
  const slot = which === "off" ? "offHand" : "mainHand";
  const it = getEquippedItem(actor, slot);
  if (!it) return null;
  if (it.type === "natural" || it.type === "weapon") return it.key ?? null;
  return null;
}

/** Helpers de listado para la UI */
export function listForSlot(actor, slot) {
  const out = [];
  for (const it of getBag(actor)) {
    if (isCompatibleForSlot(it, slot)) {
      out.push({ ...it, disabled: false, disabledReason: "" });
    }
  }
  if (slot === "mainHand" || slot === "offHand") {
    for (const rec of getNaturalRecords(actor)) {
      const natItem = makeNaturalItem(actor, rec);
      if (!natItem || !isCompatibleForSlot(natItem, slot)) continue;
      const disabled = isNaturalWeaponDisabled(actor, rec);
      natItem.disabled = disabled;
      natItem.disabledReason = disabled ? describeNaturalDisable(actor, rec) : "";
      out.push(natItem);
    }
  }
  return out;
}

export function listWeaponsInBag(actor) {
  return getBag(actor).filter(it => it.type === "weapon");
}

/** Nombre legible fallback */
export function itemLabel(it) {
  if (!it) return "";
  if (it.name) return it.name;
  if (it.type === "natural") return `${it.label ?? it.key ?? "Arma natural"} (Natural)`;
  if (it.type === "weapon" && it.key) {
    return getWeapon(it.key)?.label ?? it.key;
  }
  return it.type ?? "item";
}

export function getItemById(actor, id) {
  const bag = actor.system?.inventory?.bag ?? [];
  return bag.find(it => it.id === id) ?? null;
}

export function getNaturalWeapons(actor) {
  return getNaturalRecords(actor);
}

export function getNaturalWeaponRecord(actor, key) {
  return naturalRecordByKey(actor, key);
}

export function getNaturalWeaponItem(actor, key) {
  return makeNaturalItem(actor, naturalRecordByKey(actor, key));
}

export { isNaturalWeaponDisabled, describeNaturalDisable };

export function resolveWeaponSelection(actor, id, slot = null) {
  if (!id) return null;
  if (isNaturalId(id)) {
    const key = parseNaturalId(id);
    const record = naturalRecordByKey(actor, key);
    if (!record) return null;
    const item = makeNaturalItem(actor, record);
    if (!item) return null;
    const effectiveSlot = slot ?? (item.occupiesSlot === false ? "aux" : "mainHand");
    if (effectiveSlot !== "aux" && !isCompatibleForSlot(item, effectiveSlot)) return null;
    const disabled = isNaturalWeaponDisabled(actor, record);
    const disabledReason = disabled ? describeNaturalDisable(actor, record) : "";
    return { source: "natural", key: item.key, item, record, slot: effectiveSlot, disabled, disabledReason };
  }
  const bagItem = getItemById(actor, id);
  if (!bagItem) return null;
  if (slot && (slot === "mainHand" || slot === "offHand") && !isCompatibleForSlot(bagItem, slot)) return null;
  return { source: "inventory", key: bagItem.key ?? null, item: bagItem, record: null, slot: slot ?? null, disabled: false, disabledReason: "" };
}

export function resolveWeaponByKey(actor, key) {
  if (!key) return null;
  const record = naturalRecordByKey(actor, key);
  if (record) {
    const item = makeNaturalItem(actor, record);
    const disabled = isNaturalWeaponDisabled(actor, record);
    const disabledReason = disabled ? describeNaturalDisable(actor, record) : "";
    return { source: "natural", key: item.key, item, record, disabled, disabledReason };
  }
  const bagItem = getBag(actor).find(it => String(it.key ?? "").toLowerCase() === String(key).toLowerCase());
  if (bagItem) return { source: "inventory", key: bagItem.key ?? key, item: bagItem, record: null, disabled: false, disabledReason: "" };
  return null;
}

export function getEquippedWeaponChoice(actor, which = "main") {
  const slot = which === "off" ? "offHand" : "mainHand";
  const eq = getEquipped(actor);
  const id = eq[slot] ?? null;
  if (!id) return null;
  return resolveWeaponSelection(actor, id, slot);
}

export function isNaturalSelection(id) {
  return isNaturalId(id);
}
