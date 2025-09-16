// modules/perception/index.js
// Fase 1 — Capa de Percepción & Selección
// Construye un paquete determinista para [actor → objetivo] que viaja con la carta ATB.
// NO tira dados aquí.

const FLAG_SCOPE = "tsdc";

/** ======= Configuraciones base (de tu libro) ======= */

// 1 casilla = 1 metro
const CELL_M = 1;

// Rango estándar de detalles
const STD_DETAIL_RANGE_M = 60;

// Tabla de factores ambientales → rango de detalle (en metros)
const ENV_TABLE = {
  // lluvia
  "rain:light": 24,
  "rain:intense": 15,
  "rain:storm": 8,
  // nieve
  "snow:light": 24,
  "snow:intense": 15,
  "snow:blizzard": 8,
  // niebla
  "fog:light": 20,
  "fog:dense": 10,
  "fog:thick": 5,
  // humo
  "smoke:light": 20,
  "smoke:dense": 5,
  "smoke:choking": 2,
  // polvo/arena
  "dust:light": 25,
  "dust:moderate": 12,
  "sand:storm": 5
};

// Fuentes de luz portátiles (radio efectivo base en metros)
const LIGHT_BASE = {
  candle: 2,
  torch: 4,
  oil_lamp: 6
};

function cellsEveryOther(a, b) {
  const gs = canvas?.scene?.grid?.size || 100;
  const ax = a.center?.x ?? a.x, ay = a.center?.y ?? a.y;
  const bx = b.center?.x ?? b.x, by = b.center?.y ?? b.y;

  // Diferencias en casillas (redondeadas al centro de celda)
  const dx = Math.abs(Math.round((bx - ax) / gs));
  const dy = Math.abs(Math.round((by - ay) / gs));

  const diag = Math.min(dx, dy);               // pasos diagonales
  const straight = Math.max(dx, dy) - diag;    // pasos rectos
  // 1–2–1–2…  ≡ diag + floor(diag/2) extra por los pares
  return straight + diag + Math.floor(diag / 2);
}

// Reducciones específicas por entorno severo (si aplica)
const LIGHT_OVERRIDES = {
  // en niebla densa: antorcha ~2 m, vela ~1 m
  "fog:dense": { torch: 2, candle: 1 },
  // en humo denso o tormenta de arena: lámpara ~3 m
  "smoke:dense": { oil_lamp: 3 },
  "sand:storm":  { oil_lamp: 3 }
};

/** Lee flags de escena para ambiente y oscuridad */
function readSceneEnv(scene) {
  const sc = scene ?? canvas?.scene ?? null;
  const envFlag = sc?.getFlag?.(FLAG_SCOPE, "env") ?? {};
  let settings = {};
  try {
    settings = {
      factor: game.settings.get(FLAG_SCOPE, "env.factor") ?? "none",
      intensity: game.settings.get(FLAG_SCOPE, "env.intensity") ?? "none",
      darkness: game.settings.get(FLAG_SCOPE, "env.darkness") ?? "none",
      lightOverride: game.settings.get(FLAG_SCOPE, "env.lightOverride") ?? null
    };
  } catch (_e) {}
  const env = Object.assign({ factor:"none", intensity:"none", darkness:"none" }, settings, envFlag);
  return env;
}

/** Devuelve el cap por ambiente (metros) o null si no aplica */
function getEnvCapMeters({ factor, intensity } = {}) {
  if (!factor || !intensity) return null;
  const key = `${factor}:${intensity}`.toLowerCase();
  const v = ENV_TABLE[key];
  return Number.isFinite(v) ? v : null;
}

/** === NUEVO: lee luz desde flags del token/actor (igual que el panel) === */
function getFlagLightFromTokenOrActor(token) {
  try {
    const tFlag = token?.document?.getFlag?.(FLAG_SCOPE, "light");
    const aFlag = token?.actor?.getFlag?.(FLAG_SCOPE, "light");
    // Prioridad: token > actor
    const src = tFlag ?? aFlag ?? null;
    if (!src) return { kind: null, radius: null };
    const kind = src.kind ?? null;
    const radius = Number.isFinite(src.radius) ? Number(src.radius) : null;
    return { kind, radius };
  } catch (_e) {
    return { kind: null, radius: null };
  }
}

/** Busca luz por tags de inventario como fallback */
function getInventoryLightKind(actor) {
  if (!actor) return null;
  const searchItems = [];
  try {
    const eq = actor?.system?.inventory?.equipped ?? {};
    for (const slot of Object.keys(eq)) {
      const id = eq[slot];
      const it = id ? actor?.items?.get?.(id) : null;
      if (it) searchItems.push(it);
    }
    const bag = actor?.system?.inventory?.bag ?? [];
    for (const b of bag) if (b?.equipped) {
      const it = actor?.items?.get?.(b.id);
      if (it) searchItems.push(it);
    }
  } catch (_e) {}

  for (const it of searchItems) {
    const tags = (it?.system?.tags || it?.flags?.tsdc?.tags || []);
    const t = (Array.isArray(tags) ? tags : String(tags||"").split(","))
      .map(s => String(s).trim().toLowerCase());
    const k = t.find(x => x.startsWith("light:"));
    if (k) return k.split(":")[1];
  }
  return null;
}

/** Radio efectivo de luz (metros) — prioriza flags token/actor; fallback a inventario */
function getEffectiveLightRadiusMeters(actorTokenOrActor, env) {
  const token = actorTokenOrActor?.document ? actorTokenOrActor : (actorTokenOrActor?.token ?? null);
  const actor = actorTokenOrActor?.actor ?? actorTokenOrActor ?? null;

  // 1) Flags (token > actor)
  const { kind: flagKind, radius: flagRadius } = getFlagLightFromTokenOrActor(token);
  let kind = flagKind ?? null;

  // 2) Base por prioridad: radius explícito > override de escena > base de sistema > inventario
  if (Number.isFinite(flagRadius)) return flagRadius;

  // Si no hay kind por flags, intenta inventario
  if (!kind) kind = getInventoryLightKind(actor);

  // 3) Determina base
  let base = null;
  const ov = env?.lightOverride || null;
  if (ov && kind && Number.isFinite(ov[kind])) base = Number(ov[kind]);
  else if (kind && Number.isFinite(LIGHT_BASE[kind])) base = Number(LIGHT_BASE[kind]);

  if (!Number.isFinite(base)) return null; // sin luz

  // 4) Ajustes contextuales por entorno
  const envKey = `${env?.factor}:${env?.intensity}`.toLowerCase();
  const spec = LIGHT_OVERRIDES[envKey];
  if (spec && Number.isFinite(spec[kind])) return Number(spec[kind]);

  return base;
}

/** Calcula distancia en metros entre tokens (centros) */
function distanceMetersBetween(tokenA, tokenB) {
  return cellsEveryOther(tokenA, tokenB) * CELL_M;
}

/** Estima Cobertura con rayos al contorno del objetivo (actualizado a v12+) */
function estimateCoverLevel(fromToken, toToken) {
  // 5 puntos: centro + 4 bordes
  const bounds = toToken?.bounds ?? toToken?.hitArea?.getBounds?.() ?? null;
  const pts = [];
  if (bounds) {
    const cx = bounds.x + bounds.width/2;
    const cy = bounds.y + bounds.height/2;
    pts.push({x:cx, y:cy});
    pts.push({x:bounds.x, y:cy});
    pts.push({x:bounds.x + bounds.width, y:cy});
    pts.push({x:cx, y:bounds.y});
    pts.push({x:cx, y:bounds.y + bounds.height});
  } else {
    const cx = toToken.center?.x ?? toToken.x;
    const cy = toToken.center?.y ?? toToken.y;
    pts.push({x:cx, y:cy});
  }

  const origin = { x: fromToken.center?.x ?? fromToken.x, y: fromToken.center?.y ?? fromToken.y };
  let blocked = 0, total = pts.length;

  const RayCls =
    (foundry?.canvas?.geometry?.Ray)  // v12+
    ?? (globalThis.Ray)               // compat viejo
    ?? null;

  for (const p of pts) {
    try {
      const ray = RayCls ? new RayCls(origin, p) : { A:origin, B:p };
      let hit = false;

      // Prioridad a API moderna
      if (canvas?.walls?.checkCollision) {
        hit = !!canvas.walls.checkCollision(ray, { type: "sight", mode: "any" });
      }
      // Fallbacks *muy* defensivos
      else if (CONFIG?.Canvas?.polygons?.sight?.testCollision) {
        hit = !!canvas.visibility.testCollision(ray);
      }
      else if (canvas?.visibility?.testCollision) {
        // v12+ Canvas#visibility
        hit = !!canvas.visibility.testCollision(ray);
      }

      if (hit) blocked++;
    } catch (_e) { /* ignore */ }
  }

  const frac = total > 0 ? (blocked / total) : 0;
  if (frac >= 0.99) return "total";
  if (frac >= 0.5)  return "medium";
  if (frac >= 0.25) return "light";
  return "none";
}

/** Determina estado de ocultación desde flags del objetivo (por ahora) */
function readConcealment(targetToken) {
  try {
    const st = targetToken.document?.getFlag?.(FLAG_SCOPE, "concealment")
           ?? targetToken.actor?.getFlag?.(FLAG_SCOPE, "concealment");
    if (st === "hidden") return "hidden";
  } catch (_e) {}
  return "none";
}

/** Builder principal */
export function buildPerceptionPackage({ actorToken, targetToken, scene=null } = {}) {
  const env = readSceneEnv(scene);
  const darkness = String(env.darkness || "none");

  // 1) Bloqueos absolutos
  if (darkness === "elemental" || darkness === "absolute") {
    const distAbs = distanceMetersBetween(actorToken, targetToken);
    return {
      distance_m: distAbs,
      cells: Math.round(distAbs / CELL_M),
      visibility_level: "none",
      effective_detail_range_m: 0,
      cover_level: "total", // tratar como inalcanzable directo
      concealment_state: readConcealment(targetToken),
      perception_dc_adjust: null,
      attack_mod_from_cover: "unreachable",
      notes: { darkness }
    };
  }

  // 2) Rango de detalles efectivo — AHORA usa flags del token/actor igual que el panel
  const envCap = getEnvCapMeters(env) ?? STD_DETAIL_RANGE_M;
  const lightCap = getEffectiveLightRadiusMeters(actorToken, env);
  const rDetalle = Math.min(
    STD_DETAIL_RANGE_M,
    envCap,
    Number.isFinite(lightCap) ? lightCap : STD_DETAIL_RANGE_M
  );

  // 3) Visibilidad
  const dist = distanceMetersBetween(actorToken, targetToken);
  const vis = (dist <= rDetalle) ? "details_ok" : "presence_only";
  const perceptionAdj = (dist > rDetalle)
    ? Math.max(0, Math.ceil((dist - rDetalle) / 2)) // +1 por cada 2 m sobre R_detalle
    : 0;

  // 4) Cobertura geométrica (aprox)
  const cover = estimateCoverLevel(actorToken, targetToken);
  const coverAtkMod =
    cover === "none"   ?  0 :
    cover === "light"  ? -1 :
    cover === "medium" ? -3 : "unreachable";

  // 5) Ocultación
  const conceal = readConcealment(targetToken);

  return {
    distance_m: dist,
    cells: Math.round(dist / CELL_M),
    visibility_level: vis,
    effective_detail_range_m: rDetalle,
    cover_level: cover,
    concealment_state: conceal,
    perception_dc_adjust: perceptionAdj,
    attack_mod_from_cover: coverAtkMod,
    notes: { darkness }
  };
}

/** Traductor a “context” para tus tiradas */
export function packageToRollContext(pkg) {
  const vision =
    pkg.visibility_level === "details_ok" ? "normal" :
    pkg.visibility_level === "presence_only" ? "limited" : "none";
  return {
    vision,
    visionRange: pkg.effective_detail_range_m,
    cover: pkg.cover_level === "light" ? "partial"
        : pkg.cover_level === "medium" ? "heavy"
        : pkg.cover_level === "total" ? "total"
        : "none"
  };
}

/** Helper de UI: texto corto para tooltip */
export function describePackage(pkg) {
  const parts = [];
  parts.push(`Dist: ${Math.round(pkg.distance_m)} m`);
  parts.push(`R_det: ${pkg.effective_detail_range_m} m`);
  if (pkg.visibility_level === "presence_only") parts.push(`Percepción +${pkg.perception_dc_adjust}`);
  parts.push(`Cobertura: ${pkg.cover_level}`);
  if (pkg.concealment_state === "hidden") parts.push(`Oculto`);
  if (pkg.notes?.darkness && pkg.notes.darkness !== "none") parts.push(`Oscuridad: ${pkg.notes.darkness}`);
  return parts.join(" • ");
}

/** Cobertura desde un punto (área) hacia un token */
export function estimateCoverFromPoint(origin, toToken) {
  const bounds = toToken?.bounds ?? toToken?.hitArea?.getBounds?.() ?? null;
  const pts = [];
  if (bounds) {
    const cx = bounds.x + bounds.width/2, cy = bounds.y + bounds.height/2;
    pts.push({x:cx, y:cy},{x:bounds.x, y:cy},{x:bounds.x+bounds.width, y:cy},{x:cx, y:bounds.y},{x:cx, y:bounds.y+bounds.height});
  } else {
    pts.push({x: toToken.center?.x ?? toToken.x, y: toToken.center?.y ?? toToken.y});
  }
  const RayCls = (foundry?.canvas?.geometry?.Ray) ?? globalThis.Ray ?? null;
  let blocked = 0, total = pts.length;
  for (const p of pts) {
    const ray = RayCls ? new RayCls(origin, p) : { A:origin, B:p };
    let hit = false;
    if (canvas?.walls?.checkCollision) hit = !!canvas.walls.checkCollision(ray, { type:"sight", mode:"any" });
    else if (canvas?.visibility?.testCollision) hit = !!canvas.visibility.testCollision(ray);
    else if (CONFIG?.Canvas?.polygons?.sight?.testCollision) hit = !!CONFIG.Canvas.polygons.sight.testCollision(ray);
    if (hit) blocked++;
  }
  const frac = total ? blocked/total : 0;
  if (frac >= 0.99) return "total";
  if (frac >= 0.5)  return "medium";
  if (frac >= 0.25) return "light";
  return "none";
}