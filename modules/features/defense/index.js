// modules/features/defense/index.js
import * as Inv from "../inventory/index.js";

/** Calcula el bono total de armadura desde piezas equipadas + escudo.
 * Piezas (head/chest/legs/bracers/boots):
 *   light = grade
 *   medium = grade * 2
 *   heavy = grade * 3
 * Escudo:
 *   light = grade
 *   medium = grade + 1
 *   heavy = grade * 2
 * Si no hay 'weight' en el item, asume 'light'.
 */
export function computeArmorBonusFromEquipped(actor) {
  const get = (slot) => Inv.getEquippedItem(actor, slot);

  const pieceVal = (it) => {
    if (!it) return 0;
    const w = String(it.weight || it.weightClass || it.category || "light").toLowerCase();
    const g = Math.max(0, Number(it.grade || 0));
    if (w === "heavy") return g * 3;
    if (w === "medium") return g * 2;
    return g; // light
  };

  let total = 0;
  for (const slot of ["head","chest","legs","bracers","boots"]) {
    total += pieceVal(get(slot));
  }

  // Escudo con reglas propias
  const sh = get("shield");
  if (sh) {
    const w = String(sh.weight || sh.weightClass || sh.category || "light").toLowerCase();
    const g = Math.max(0, Number(sh.grade || 0));
    if (w === "heavy") total += g * 2;
    else if (w === "medium") total += (g + 1);
    else total += g; // light
  }

  return total;
}
