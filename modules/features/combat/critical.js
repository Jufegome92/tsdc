// modules/features/combat/critical.js
// Detecta críticos en tiradas de IMPACTO y calcula "poder de rotura"

import { computeCritPowerFromItem } from "../weapons/index.js";

/** Devuelve info de crítico a partir de un Roll de IMPACTO.
 * Considera crítico si ALGÚN dado de impacto obtiene su cara máxima.
 * Soporta múltiples términos de dados (p. ej., 2d6 + 1d4).
 *
 * @param {Roll} roll
 * @returns {{ isCrit: boolean, maxFacesHit: number[], facesByTerm: number[], resultsByTerm: number[][] }}
 */
export function detectImpactCrit(roll) {
  const facesByTerm = [];
  const resultsByTerm = [];
  const maxFacesHit = [];
  let isCrit = false;

  for (const t of roll.terms ?? []) {
    // Foundry: términos tipo "Die"
    if (t?.faces && Array.isArray(t?.results)) {
      const faces = Number(t.faces);
      const termResults = t.results
        .map(r => Number(r?.result ?? r?.value ?? 0))
        .filter(n => Number.isFinite(n));
      facesByTerm.push(faces);
      resultsByTerm.push(termResults);
      if (termResults.some(v => v === faces)) {
        isCrit = true;
        maxFacesHit.push(faces);
      }
    }
  }
  return { isCrit, maxFacesHit, facesByTerm, resultsByTerm };
}

/** Calcula el "poder de rotura" llevado al crítico.
 * Usa: Potencia(material, calidad) × Multiplicador(familia) × max(1, grado) + bonus
 * @param {object} weaponItem  Item equipado (de tu inventario) con {material, quality, grade, key/family}
 * @param {number} bonus       Bonos situacionales para romper partes (habilidades, objetos, etc.)
 * @returns {number}           Poder de rotura ya redondeado (int)
 */
export function computeBreakPower(weaponItem, bonus = 0) {
  let base = computeCritPowerFromItem(weaponItem);
  if ((!base || Number.isNaN(base)) && weaponItem?.powerPerRank != null) {
    const grade = Math.max(1, Number(weaponItem.grade ?? 1));
    base = Number(weaponItem.powerPerRank) * grade;
  }
  return Math.max(0, Math.floor(base + Number(bonus || 0)));
}
