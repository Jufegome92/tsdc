// modules/rolls/validators.js
// Validadores para acciones comunes: ataques y movimiento.

import { buildPerceptionPackage } from "../perception/index.js";

/** Ataque: exige visión válida y opcionalmente rango del arma (m) */
export async function validateAttackRangeAndVision({ attackerToken, targetToken, weaponRangeM = null }) {
  if (!attackerToken || !targetToken) return { ok:false, reason:"Faltan tokens." };
  const pkg = await buildPerceptionPackage({ actorToken: attackerToken, targetToken });

  // "visibility_level": "details_ok" | "presence_only" | "none"
  // "cover_level": "none" | "light" | "medium" | "total"
  if (pkg.visibility_level === "none") return { ok:false, reason:"Sin visión del objetivo." };
  if (pkg.cover_level === "total" || pkg.attack_mod_from_cover === "unreachable") return { ok:false, reason:"Cobertura total: inalcanzable." };

  if (Number.isFinite(weaponRangeM) && (pkg.distance_m ?? Infinity) > weaponRangeM) {
    return { ok:false, reason:`Fuera del rango del arma (${weaponRangeM} m).` };
  }
  return { ok:true, pkg };
}

/** Movimiento: comprueba colisiones/obstáculos y (opcional) distancia máxima */
export async function validateMovePath({ token, dest, maxMeters = null }) {
  if (!token || !dest) return { ok:false, reason:"Destino inválido." };

  const ray = new Ray(token.center, dest);
  const collision = canvas.walls.checkCollision(ray, { type: "move", mode: "any" });
  if (collision) return { ok:false, reason:"Colisión con muro/obstáculo." };

  if (Number.isFinite(maxMeters)) {
    const cells = canvas.grid.measureDistances([{ ray }], { gridSpaces: true })?.[0];
    const gridSize = canvas?.scene?.grid?.size || 100;
    const fallback = ray.distance / gridSize;
    const meters = (Number.isFinite(cells) ? cells : fallback) * 1; // 1 casilla = 1 m
    if (meters > maxMeters) return { ok:false, reason:`Excede la distancia (${maxMeters} m).` };
  }

  return { ok:true };
}
