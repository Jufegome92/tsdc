/**
 * Utilidades matemáticas para Transcendence
 * Regla general: siempre redondear hacia arriba,
 * salvo cuando una regla/efecto especifique lo contrario.
 */

/**
 * Redondeo hacia arriba (regla general del sistema).
 * @param {number} n - número a redondear
 * @returns {number}
 */
export function roundUp(n) {
  return Math.ceil(Number(n || 0));
}

/**
 * Redondeo hacia abajo (usado solo en reglas específicas).
 * @param {number} n - número a redondear
 * @returns {number}
 */
export function roundDown(n) {
  return Math.floor(Number(n || 0));
}

/**
 * Redondeo configurable.
 * @param {number} value - número a redondear
 * @param {string} mode - "up" (default) o "down"
 * @returns {number}
 */
export function applyRounding(value, mode = "up") {
  value = Number(value || 0);
  if (mode === "down") return roundDown(value);
  return roundUp(value);
}
