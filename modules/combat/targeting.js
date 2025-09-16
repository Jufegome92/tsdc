//modules/combat/targeting.js
// // Métrica “cada otro diagonal” (1–2–1–2…)
export function cellsEveryOtherBetweenPoints(ax, ay, bx, by) {
  const gs = canvas?.scene?.grid?.size || 100;
  const dx = Math.abs(Math.round((bx - ax) / gs));
  const dy = Math.abs(Math.round((by - ay) / gs));
  const diag = Math.min(dx, dy);
  const straight = Math.max(dx, dy) - diag;
  return straight + diag + Math.floor(diag / 2);
}

export function metersBetweenTokenAndToken(a, b) {
  const c = cellsEveryOtherBetweenPoints(a.center.x, a.center.y, b.center.x, b.center.y);
  return c * 1; // 1 casilla = 1 m
}

export function metersBetweenPointAndToken(point, token) {
  const c = cellsEveryOtherBetweenPoints(point.x, point.y, token.center.x, token.center.y);
  return c * 1;
}

// Un clic en el canvas → centro de celda
export async function pickCanvasPoint({ snap=true, hint="Haz click para elegir el centro…" }={}) {
  return new Promise((resolve) => {
    const handler = (ev) => {
      const pos = ev.data.getLocalPosition(canvas.stage);
      let x = pos.x, y = pos.y;
      if (snap) {
        const s = canvas.grid.getSnappedPosition(x, y, 1);
        const c = canvas.grid.getCenter(s.x, s.y);
        x = c[0]; y = c[1];
      }
      canvas.stage.off("pointerdown", handler);
      resolve({ x, y });
    };
    ui.notifications?.info(hint);
    canvas.stage.once("pointerdown", handler);
  });
}

export function tokensInRadius(center, radiusM, { excludeIds = [], hostileTo = null } = {}) {
  const all = canvas.tokens.placeables.filter(t => t.actor && !t.document.hidden && !excludeIds.includes(t.id));
  const list = hostileTo ? all.filter(t => t.document.disposition !== hostileTo.document.disposition) : all;
  return list.filter(t => metersBetweenPointAndToken(center, t) <= radiusM);
}
