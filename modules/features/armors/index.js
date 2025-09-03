// modules/features/armors/index.js
// Categorías de armadura, escudos y cálculo de Bloqueo

import { materialDurability } from "../materials/index.js";

/** Categorías de armadura → BC (Base de categoría) */
export const ARMOR_CATS = {
  light:   { bc: 2, label: "Ligera" },
  medium:  { bc: 4, label: "Intermedia" },
  heavy:   { bc: 6, label: "Pesada" }
};

/** Escudos por categoría → bono a DEFENSA (no al Bloqueo) */
export const SHIELD_CATS = {
  light:  { label: "Liviano",  bonus: (grade=1) => Number(grade||0) },
  medium: { label: "Mediano",  bonus: (grade=1) => Number(grade||0) + 1 },
  heavy:  { label: "Pesado",   bonus: (grade=1) => Number(grade||0) * 2 }
};

// -------- helpers internos
function gp(obj, path, d=null) { return foundry.utils.getProperty(obj, path) ?? d; }
function clamp(n, a, b){ return Math.max(a, Math.min(b, n)); }

/** Obtiene el item equipado por slot desde system.inventory */
export function getEquippedItem(actor, slot) {
  const eqId = gp(actor, `system.inventory.equipped.${slot}`, null);
  if (!eqId) return null;
  const bag = gp(actor, "system.inventory.bag", []);
  return bag.find(it => it?.id === eqId) ?? null;
}

/** BM (Bono de material) = ⌊Durabilidad / 5⌋  */
export function materialBonusFromItem(item) {
  if (!item) return 0;
  const matKey  = String(item.material || "").toLowerCase();
  const quality = Number(item.quality || 1);
  const dur = materialDurability(matKey, quality);
  return Math.floor(Number(dur||0) / 5);
}

/** CO (Calidad de obra) — entero -3..+3 aprox. */
export function qualityBonus(item) {
  return clamp(Number(item?.qualityWork ?? item?.quality ?? 0), -3, 3);
}

/** CD (Competencia con categoría de armadura) = nivel en progression.armor[cat].level */
export function defenseCompetenceLevel(actor, catKey) {
  return Number(gp(actor, `system.progression.armor.${catKey}.level`, 0));
}

/**
 * Bloqueo por localización:
 * location ∈ {"head","chest","legs","bracers","boots"}
 * Formula: BC + BM + CD + CO
 */
export function computeBlockingAt(actor, location) {
  const piece = getEquippedItem(actor, location);
  if (!piece || piece.type !== "armor") {
    return { value: 0, reason: "Sin pieza equipada", breakdown: { BC:0, BM:0, CD:0, CO:0 } };
  }
  const catKey = String(piece.category ?? "").toLowerCase();
  const cat = ARMOR_CATS[catKey];
  if (!cat) {
    return { value: 0, reason: "Categoría inválida", breakdown: { BC:0, BM:0, CD:0, CO:0 } };
  }

  const BC = Number(cat.bc || 0);
  const BM = materialBonusFromItem(piece);
  const CD = defenseCompetenceLevel(actor, catKey);
  const CO = qualityBonus(piece);

  const value = BC + BM + CD + CO;
  return { value, breakdown: { BC, BM, CD, CO }, reason: null, piece };
}

/** Bono de escudo a la Defensa (NO al bloqueo) */
export function getShieldDefenseBonus(actor) {
  const sh = getEquippedItem(actor, "shield");
  if (!sh || sh.type !== "shield") return 0;
  const catKey = String(sh.category ?? "").toLowerCase(); // "light"|"medium"|"heavy"
  const cat = SHIELD_CATS[catKey];
  if (!cat) return 0;
  const grade = Number(sh.grade ?? 1);
  return Number(cat.bonus(grade) || 0);
}

/** Resumen de bloqueo por slots útiles */
export function getBlockingSummary(actor) {
  const locs = ["head","chest","bracers","legs","boots"];
  const out = {};
  for (const L of locs) out[L] = computeBlockingAt(actor, L);
  return out;
}
