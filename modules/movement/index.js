// modules/movement/index.js

import { cellsEveryOtherBetweenPoints } from "../combat/targeting.js";
import { hasMovementBlock, getMovementImpact } from "../ailments/index.js";

const OVERLAY_KEY = Symbol("tsdcMovementOverlay");
const TOKEN_PATCH_KEY = Symbol("tsdcMovementPatched");

function overlayLayer() {
  const root = canvas?.foreground ?? canvas?.tokens;
  if (!root) return null;
  if (!root[OVERLAY_KEY]) {
    const container = new PIXI.Container();
    container.sortableChildren = true;
    container.zIndex = 2500;
    root.addChild(container);
    root[OVERLAY_KEY] = container;
  }
  return root[OVERLAY_KEY];
}

function actorBaseSpeed(actor) {
  const sys = actor?.system ?? {};
  const candidates = [
    sys.species?.speed,
    sys.attributes?.speed,
    sys.derived?.speed,
    sys.attributes?.agility?.speed
  ];
  for (const value of candidates) {
    const n = Number(value);
    if (Number.isFinite(n) && n > 0) return n;
  }
  return 6; // fallback general
}

export function movementAllowance(actor) {
  if (!actor) return { blocked: false, meters: Infinity };
  if (hasMovementBlock(actor)) return { blocked: true, meters: 0 };
  const base = actorBaseSpeed(actor);
  const impact = getMovementImpact(actor);
  if (impact.movementBlocked) return { blocked: true, meters: 0 };
  const multiplier = Number.isFinite(impact.movementMultiplier) ? impact.movementMultiplier : 1;
  const flat = Number(impact.movementFlat || 0);
  const meters = Math.max(0, (base * multiplier) + flat);
  return { blocked: false, meters };
}

function distanceMeters(doc, changes) {
  const scene = doc.parent;
  if (!scene) return 0;
  const fromX = doc.x + doc.width * scene.grid.size / 2;
  const fromY = doc.y + doc.height * scene.grid.size / 2;
  const toX = (changes.x ?? doc.x) + doc.width * scene.grid.size / 2;
  const toY = (changes.y ?? doc.y) + doc.height * scene.grid.size / 2;
  const cells = cellsEveryOtherBetweenPoints(fromX, fromY, toX, toY);
  return cells * (scene.grid.distance || 1);
}

function shouldEnforceMovement(doc, userId) {
  if (!doc?.actor) return false;
  if (userId !== game.user?.id) return false;
  return true;
}

Hooks.on("preUpdateToken", (doc, changes, options, userId) => {
  if (!shouldEnforceMovement(doc, userId)) return;
  if (!('x' in changes || 'y' in changes)) return;

  const actor = doc.actor;
  const allowance = movementAllowance(actor);
  if (allowance.blocked) {
    ui.notifications?.warn(`${actor.name} no puede moverse mientras persistan sus agravios.`);
    return false;
  }

  const meters = allowance.meters;
  if (!Number.isFinite(meters) || meters <= 0) return;

  const travel = distanceMeters(doc, changes);
  if (travel <= meters + 0.01) return;

  ui.notifications?.warn(`${actor.name} no puede desplazarse ${travel.toFixed(1)} m (límite ${meters.toFixed(1)} m). Usa la acción de Escape o elimina penalizadores.`);
  return false;
});

function removeOverlay(token) {
  const overlay = token?._tsdcMovementOverlay;
  if (!overlay) return;
  try { overlay.container?.parent?.removeChild(overlay.container); } catch (_) {}
  try { overlay.container?.destroy({ children: true }); } catch (_) {}
  delete token._tsdcMovementOverlay;
}

function drawOverlay(token) {
  removeOverlay(token);
  if (!token) return;
  const actor = token.actor;
  if (!actor) return;
  const allowance = movementAllowance(actor);
  if (allowance.blocked) return;
  if (!Number.isFinite(allowance.meters) || allowance.meters <= 0) return;
  const scene = canvas.scene;
  if (!scene) return;
  const layer = overlayLayer();
  if (!layer) return;

  const unitMeters = scene.grid?.distance || 1;
  const cellSize = scene.grid?.size || 100;
  const radiusPx = (allowance.meters / unitMeters) * cellSize;
  if (!Number.isFinite(radiusPx) || radiusPx <= 0) return;

  const origin = token.center;
  const container = new PIXI.Container();
  container.position.set(origin.x, origin.y);
  container.zIndex = 4000;

  const circle = new PIXI.Graphics();
  circle.lineStyle(3, 0x00c7ff, 0.72);
  circle.beginFill(0x00c7ff, 0.1);
  circle.drawCircle(0, 0, radiusPx);
  circle.endFill();
  container.addChild(circle);

  const style = new PIXI.TextStyle({
    fontFamily: "Signika",
    fontSize: 24,
    fill: 0x00c7ff,
    stroke: 0x001f2b,
    strokeThickness: 4
  });
  const label = new PIXI.Text(`${allowance.meters.toFixed(1)} m`, style);
  label.anchor.set(0.5, 1.2);
  container.addChild(label);

  layer.addChild(container);

  token._tsdcMovementOverlay = {
    container,
    circle,
    label,
    origin,
    limitMeters: allowance.meters
  };
}

function onTokenDragStart(token) {
  if (!token) return;
  const controlled = token.layer?.controlled ?? [];
  if (controlled.length > 1 && controlled.includes(token)) return;
  try {
    drawOverlay(token);
  } catch (err) {
    console.error("TSDC | onTokenDragStart failed", err);
  }
}

function onTokenDragEnd(token) {
  if (!token) return;
  removeOverlay(token);
}

function patchTokenDragHandlers() {
  const TokenCls = foundry?.canvas?.placeables?.tokens?.Token
    ?? foundry?.canvas?.placeables?.Token
    ?? foundry?.canvas?.tokens?.Token
    ?? globalThis.Token;
  if (!TokenCls) {
    console.warn("TSDC | Token class not found, cannot patch movement overlay");
    return;
  }
  const proto = TokenCls.prototype;
  if (!proto || proto[TOKEN_PATCH_KEY]) return;

  const originalStart = proto._onDragLeftStart;
  const originalDrop = proto._onDragLeftDrop;
  const originalCancel = proto._onDragLeftCancel;

  proto._onDragLeftStart = function (event) {
    onTokenDragStart(this, event);
    return originalStart?.call(this, event);
  };

  proto._onDragLeftDrop = function (event) {
    onTokenDragEnd(this, event);
    return originalDrop?.call(this, event);
  };

  proto._onDragLeftCancel = function (event) {
    onTokenDragEnd(this, event);
    return originalCancel?.call(this, event);
  };

  proto[TOKEN_PATCH_KEY] = true;
}

Hooks.on("controlToken", (token, controlled) => {
  if (!token) return;
  if (!controlled) removeOverlay(token);
});

Hooks.on("deleteToken", (doc) => {
  const token = doc?.object;
  if (token) removeOverlay(token);
});

Hooks.once("ready", () => {
  patchTokenDragHandlers();
});

export function registerMovementLimits() {
  // El simple import ejecuta el hook; esta función queda por compatibilidad.
}
