// modules/atb/actions.js
// Acciones ATB según tu CT = I + E + R.
// MANIOBRAS irán en otro módulo (no van aquí).

import { rollAttack } from "../rolls/dispatcher.js";
import { pushPenaltyForCurrentTick, scheduleBonusForNextAction } from "./mods.js";
import { buildPerceptionPackage, packageToRollContext, describePackage } from "../perception/index.js";
import { validateMovePath } from "../rolls/validators.js";
import { tryReactOpportunity, openReactionWindow,performOpportunityAttack } from "./reactions.js";
import { promptOpportunityDialog } from "./rx-dialog.js";
import { triggerFumbleReactions } from "../atb/reactions.js";
import { getEquippedWeaponKey, resolveWeaponByKey, isNaturalWeaponDisabled, describeNaturalDisable } from "../features/inventory/index.js";
import { weaponRangeM } from "../combat/range.js";
import { validateAttackRangeAndVision } from "../rolls/validators.js";
import { shouldPromptHere } from "./rx-dialog.js";
import { performFeature } from "../features/runner.js";
import { MANEUVERS } from "../features/maneuvers/data.js";
import { APTITUDES } from "../features/aptitudes/data.js";
import { RELIC_POWERS } from "../features/relics/data.js";
import { runDefenseFlow } from "../combat/defense-flow.js";

const MELEE_RANGE_M = 1.0;

/* ===== Helpers ===== */
function distanceM(a, b) {
  return cellsEveryOther(a, b) * 1;
}

function metersDistance121ToPoint(token, point) {
  // Distancia token→punto (patrón 1–2–1–2…) en METROS
  const cells = cellsEveryOtherToPoint(token, point);
  return cells * 1;
}

function sceneUnitsPerCell() {
  const d = canvas?.dimensions;
  // Foundry: "distance" = unidades por celda (p.ej. 1 = 1m); "size" = px por celda
  return Number(d?.distance ?? 1);
}

function getAbilityRank(actor, clazz, key) {
  const tree = (clazz==="maneuver") ? "maneuvers"
            : (clazz==="relic"||clazz==="relic_power") ? "relics"
            : "aptitudes";
  const node = actor?.system?.progression?.[tree]?.[key] ?? {};
  const known = !!node.known;
  const rank  = Number(node.rank || 0);
  return known && rank===0 ? 1 : rank; // “conocida” sin rank ⇒ trátala como N1
}

function cellsToUnits(cells) {
  return Number(cells ?? 0) * sceneUnitsPerCell();
}

// Distancia 1-2-1-2… entre token y un punto (en casillas)
function cellsEveryOtherToPoint(token, point) {
  const gs = canvas?.scene?.grid?.size || 100;
  const ax = token.center?.x ?? token.x, ay = token.center?.y ?? token.y;
  const bx = point?.x ?? point?.center?.x ?? 0;
  const by = point?.y ?? point?.center?.y ?? 0;
  const dx = Math.abs(Math.round((bx - ax) / gs));
  const dy = Math.abs(Math.round((by - ay) / gs));
  const diag = Math.min(dx, dy);
  const straight = Math.max(dx, dy) - diag;
  return straight + diag + Math.floor(diag / 2);
}

// Crea un MeasuredTemplate acorde al feature.areaShape
async function drawAreaTemplateForFeature({ feature, actorToken, targetOrPoint }) {
  if (!feature || !actorToken) return null;
  const shape = feature.areaShape || null;
  const areaCells = Number(feature.area ?? 0);
  if (!shape || areaCells <= 0) return null;

  const units = cellsToUnits(areaCells);
  const widthUnits = cellsToUnits(feature.areaWidth ?? 1);

  // origen
  const origin = (() => {
    if (shape === "circle" && feature.range === 0) return actorToken.center;        // autocentrado
    if (targetOrPoint?.kind === "cell") return targetOrPoint.point;                 // punto elegido
    if (targetOrPoint?.kind === "token") return targetOrPoint.token.center;         // centro del token objetivo
    return actorToken.center;
  })();

  /** @type {MeasuredTemplateSource} */
  let data;
  switch (shape) {
    case "cone":
      data = {
        t: "cone",
        x: origin.x, y: origin.y,
        distance: units,      // en unidades de escena
        angle: 60,
        direction: actorToken.rotation ?? 0
      };
      break;
    case "line":
      data = {
        t: "ray",
        x: origin.x, y: origin.y,
        distance: units,
        width: Math.max(widthUnits, sceneUnitsPerCell()) // ancho mínimo = 1 celda
      };
      break;
    case "circle":
      data = {
        t: "circle",
        x: origin.x, y: origin.y,
        distance: units
      };
      break;
    default:
      return null;
  }

  const [tmpl] = await canvas.scene.createEmbeddedDocuments("MeasuredTemplate", [{
    ...data,
    flags: { tsdc: { spawnedBy: "tsdc", featureKey: feature?.label || "feature" } }
  }]);
  return tmpl ?? null;
}


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

function ownerUsersOfActor(actor) {
  const OWNER = Number(CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3);
  return game.users.filter(u =>
    actor?.testUserPermission?.(u, OWNER) || u.isGM
  );
}

function attackerChoiceHere(actorToken) {
  const OWNER = Number(CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3);
  return actorToken?.actor?.testUserPermission?.(game.user, OWNER) || game.user.isGM;
}

async function pickAttackTarget({ actorToken, storedId = null }) {
  if (!actorToken?.actor) return null;
  const owners = ownerUsersOfActor(actorToken.actor);
  const ownerTargets = [...new Set(owners.flatMap(u => Array.from(u.targets ?? [])))]
    .filter(t => t?.actor && !t.document.hidden && t.id !== actorToken.id);

  const askAlways = game.settings.get("tsdc","askTargetEveryExec");
  const { DialogV2 } = foundry.applications.api;

  // Si hay varios, ofrece selector
  if (ownerTargets.length > 1 || (askAlways && attackerChoiceHere(actorToken) && (ownerTargets.length > 0 || storedId))) {
    const opts = ownerTargets.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    // fallback al storedId si no hay targets activos
    const stored = storedId ? canvas.tokens.get(storedId) : null;
    const extra = (!ownerTargets.length && stored) ? `<option value="${stored.id}">${stored.name}</option>` : "";
    const chosenId = await DialogV2.prompt({
      window:{ title:"Elige objetivo" },
      content:`<form><label>Objetivo <select name="t">${opts}${extra}</select></label></form>`,
      ok:{ label:"Confirmar", callback: (_ev, btn) => btn.form.elements.t.value }
    });
    return canvas.tokens.get(chosenId) ?? null;
  }

  // 1 objetivo activo → úsalo
  if (ownerTargets.length === 1) return ownerTargets[0];

  // sin targets → intenta el guardado al planear
  if (storedId) return canvas.tokens.get(storedId) ?? null;

  return null;
}

function hostileAdjacents(t) {
  // Si prefieres “por tipo” o “por disposición”, puedes sincronizar esto con SIDE_MODE de reactions.js
  return canvas.tokens.placeables.filter(o =>
    o.id !== t.id &&
    o.actor &&
    !o.document.hidden &&
    (o.document.disposition !== t.document.disposition) &&
    distanceM(o, t) <= MELEE_RANGE_M
  );
}

/* ===== Acción: Movimiento =====
 * - Valida camino.
 * - Calcula adyacencias antes/después.
 * - Abre ventanas de reacción "leave-melee" para hostiles que pierden adyacencia.
 * - Mueve y da oportunidad inmediata de reaccionar (AI PNJ simple).
 */
export async function actionMove({ actorToken, dest, maxMeters = null }) {
  if (!actorToken || !dest) return false;

  // 1) Adyacentes hostiles ANTES
  const beforeAdj = hostileAdjacents(actorToken).map(t => t.id);

  // 2) Validar camino
  const isValid = await validateMovePath({ token: actorToken, dest, maxMeters });
  if (!isValid.ok) {
    ui.notifications.warn(`Movimiento inválido: ${isValid.reason}`);
    return false;
  }

  // 3) Precalcular adyacentes DESPUÉS (posición virtual)
  const fake = { center: dest };
  const afterAdj = canvas.tokens.placeables
    .filter(o => o.id !== actorToken.id && o.actor && !o.document.hidden && (o.document.disposition !== actorToken.document.disposition))
    .filter(o => distanceM(o, fake) <= MELEE_RANGE_M)
    .map(o => o.id);

  const leavingIds = beforeAdj.filter(id => !afterAdj.includes(id));

  // 4) Abrir ventanas de reacción para cada hostil que pierde melee
  for (const id of leavingIds) {
    const reactor = canvas.tokens.get(id);
    if (!reactor) continue;
    await openReactionWindow({
      ownerToken: reactor,
      reason: "leave-melee",
      expiresTick: (game.combat?.round ?? 0),
      payload: { provokerTokenId: actorToken.id, meleeRangeM: MELEE_RANGE_M }
    });
  }

  // 5) Mover (ajuste de x,y desde centro)
  const nx = dest.x - (actorToken.w / 2);
  const ny = dest.y - (actorToken.h / 2);
  await actorToken.document.update({ x: nx, y: ny });

  // 6) Ofrecer reacción inmediata (PJ/GM decide con diálogo)
  for (const id of leavingIds) {
    const reactor = canvas.tokens.get(id);
    if (!reactor) continue;
    const consent = await promptOpportunityDialog({ reactorToken: reactor, provokerToken: actorToken, timeoutMs: 6500 });
    if (consent) {
      await tryReactOpportunity({ reactorToken: reactor, provokerToken: actorToken });
    }
  }

  return true;
}

/* ===== Utiles ===== */

function makeDef({ key, label, I, E, R, perform }) {
  return { key, label, init_ticks: I, exec_ticks: E, rec_ticks: R, perform };
}
function ctTriple(CT) {
  if (CT === 1) return { I: 0, E: 1, R: 0 };
  if (CT === 2) return { I: 1, E: 1, R: 0 };
  // CT 3
  return { I: 1, E: 1, R: 1 };
}
function getSpecRank(actor, specKey) {
  const node = actor?.system?.progression?.skills?.[specKey] ?? null;
  return Number(node?.rank || 0);
}
function ceilHalf(n) {
  const v = Math.ceil(Math.max(0, Number(n||0)) / 2);
  return Math.max(1, v);
}

/* ===== Acciones base ===== */

/** Moverse — CT=2 → I0+E1+R1 */
export const MoveAction = makeDef({
  key: "move", label: "Moverse", I: 0, E: 1, R: 1,
  perform: async ({ actor }) => {
    await ChatMessage.create({ content: `<i>${actor.name}</i> se mueve. (CT 2)` });
  }
});

/** Interactuar — CT=2 → I1+E1+R0 */
export const InteractAction = makeDef({
  key: "interact", label: "Interactuar", I: 1, E: 1, R: 0,
  perform: async ({ actor }) => {
    await ChatMessage.create({ content: `<i>${actor.name}</i> interactúa con el entorno. (CT 2)` });
  }
});

/** Ataque — CT=3 → I1+E1+R1 */
export const AttackAction = makeDef({
  key: "attack", label: "Ataque", I: 1, E: 1, R: 1,
  perform: async ({ actor, meta }) => {
    const actorToken = actor?.getActiveTokens?.(true)?.[0]
      ?? canvas?.tokens?.placeables?.find?.(t => t?.actor?.id === actor.id)
      ?? null;

    // 1) objetivo elegido por el jugador (targets de sus dueños) o el que guardamos al planear
    const storedId = meta?.targetTokenId ?? null;
    const targetToken = await pickAttackTarget({ actorToken, storedId });

    if (!actorToken || !targetToken) {
      ui.notifications?.warn("Selecciona (target) un objetivo válido para atacar.");
      return;
    }

    // 2) reacción previa (si la quieren usar)
    await askPreAttackReaction(targetToken, actorToken);

    // 3) resto igual que ya tenías…
    const wKey   = getEquippedWeaponKey(actor, "main");
    const rangeM = weaponRangeM(actor, wKey);

    const v = await validateAttackRangeAndVision({ attackerToken: actorToken, targetToken, weaponRangeM: rangeM });
    if (!v.ok) {
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<p>No alcanzas a <b>${targetToken.name}</b>: ${v.reason}.</p>`
      });
      return;
    }

    const pkg = v.pkg;
    const ctx = packageToRollContext(pkg);
    await ChatMessage.create({
      content: `<div class="tsdc-perception">${describePackage(pkg)}</div>`,
      speaker: ChatMessage.getSpeaker({ actor })
    });
    if (pkg.attack_mod_from_cover === "unreachable") {
      return ui.notifications?.warn("Cobertura total: el objetivo es inalcanzable desde aquí.");
    }

    const weaponInfo = wKey ? resolveWeaponByKey(actor, wKey) : null;
    if (weaponInfo?.source === "natural" && isNaturalWeaponDisabled(actor, weaponInfo.record)) {
      const reason = weaponInfo.disabledReason || describeNaturalDisable(actor, weaponInfo.record) || "Parte dañada";
      ui.notifications?.warn(`No puedes usar ${weaponInfo.record?.label ?? "esa arma"}: ${reason}.`);
      return;
    }

    const atkRes = await rollAttack(actor, { key: wKey ?? undefined, flavor: "ATB • Ataque", mode: "ask", context: ctx, opposed: true });

    await runDefenseFlow({
      attackerActor: actor,
      attackerToken: actorToken,
      targetToken,
      attackCtx: ctx,
      attackResult: atkRes ?? null
    });
  }
});

/** Soltar — CT=0 → instantáneo */
export const DropAction = makeDef({
  key: "drop", label: "Soltar", I: 0, E: 0, R: 0,
  perform: async ({ actor }) => {
    await ChatMessage.create({ content: `<i>${actor.name}</i> suelta un objeto. (CT 0)` });
  }
});

/**
 * Especialización — CT variable (1/2/3) y efectos por categoría:
 *  Físicas:
 *    CT1: penaliza TD, TC, TR = ceil(rank/2) (mín 1) por el tick actual
 *    CT2: sin modificadores
 *    CT3: bono a TODAS las tiradas del "siguiente tick habilitado" = rank
 *  Sociales:
 *    CT1: penaliza TC y TE = ceil(rank/2)
 *    CT3: BONO a TC y TE (siguiente tick) = rank
 *  Mentales / Saberes:
 *    no dan bono numérico (el Narrador otorga más información con CT mayor)
 */
export function makeSpecializationAction({ specKey, category, CT }) {
  const { I, E, R } = ctTriple(CT);
  return makeDef({
    key: `spec:${specKey}:${CT}`,
    label: `Especialización (${specKey}) • CT ${CT}`,
    I, E, R,
    perform: async ({ actor, combat, combatant, tick, startedThisTick }) => {
      const rank = getSpecRank(actor, specKey);

      // Mensaje básico
      await ChatMessage.create({
        content: `<b>${actor.name}</b> usa <i>${specKey}</i> [${String(category)}] con CT ${CT} (${I}+${E}+${R}).`
      });

      const cid = combatant?.id;
      if (!cid) return;

      const pen = ceilHalf(rank);
      const bono = rank;

      if (category === "physical") {
        if (CT === 1) {
          await pushPenaltyForCurrentTick(combat, cid, {
            value: -pen,
            types: ["TD", "TC", "TR"],
            note: `CT1 ${specKey} (Física)`
          });
        } else if (CT === 3) {
          await scheduleBonusForNextAction(combat, cid, {
            value: +bono,
            types: ["all"],
            note: `CT3 ${specKey} (Física)`
          });
        }
      } else if (category === "social") {
        if (CT === 1) {
          await pushPenaltyForCurrentTick(combat, cid, {
            value: -pen,
            types: ["TC", "TE"],
            note: `CT1 ${specKey} (Social)`
          });
        } else if (CT === 3) {
          await scheduleBonusForNextAction(combat, cid, {
            value: +bono,
            types: ["TC", "TE"],
            note: `CT3 ${specKey} (Social)`
          });
        }
      } else if (category === "mental" || category === "knowledge") {
        // Sin modificadores numéricos: el Narrador ajusta la cantidad/calidad de info según CT.
        await ChatMessage.create({ content: `ℹ️ ${actor.name} obtiene información proporcional a CT ${CT}.` });
      }
    }
  });
}

/** Catálogo plano para UI de acciones simples */
export function listSimpleActions() {
  return [
    MoveAction,
    AttackAction,
    InteractAction,
    DropAction,
    HideAction
  ];
}

export function makeManeuverAction(key) {
  const m = MANEUVERS[key]; if (!m) return null;
  return makeFeatureActionFromData(`maneuver:${key}`, { ...m, clazz:"maneuver" });
}

export function makeRelicPowerAction(key) {
  const p = RELIC_POWERS[key]; if (!p) return null;
  return makeFeatureActionFromData(`relic:${key}`, { ...p, clazz:"relic_power" });
}

export function makeAptitudeAction(key) {
  const a = APTITUDES[key]; if (!a) return null;
  return makeFeatureActionFromData(`aptitude:${key}`, { ...a, clazz:"aptitude" });
}

async function askPreAttackReaction(targetToken, attackerToken) {
  // deja registro en estado de escena
  openReactionWindow({
    ownerToken: targetToken,
    reason: "before-attack",
    payload: { attackerId: attackerToken.id }
  });

  // solo decide el dueño del objetivo (o el GM)
  const OWNER = Number(CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? CONST.DOCUMENT_PERMISSION_LEVELS?.OWNER ?? 3);
  const canDecide = targetToken?.actor?.testUserPermission?.(game.user, OWNER) || game.user.isGM;
  if (!canDecide) return false;

  const { DialogV2 } = foundry.applications.api;
  const ok = await DialogV2.confirm({
    window: { title: "Reacción (antes del ataque)" },
    content: `<p><b>${targetToken.name}</b>: ¿usar una reacción <i>antes</i> del ataque?</p>`
  });
  if (!ok) return false;

  // implementación simple: si están en melee, ejecuta un AO inmediato
  const dist = distanceM(targetToken, attackerToken);
  if (dist <= MELEE_RANGE_M) {
    await performOpportunityAttack({ reactorToken: targetToken, targetToken: attackerToken });
  } else {
    ui.notifications.info(`${targetToken.name}: fuera de alcance de reacción (melee).`);
  }
  return true;
}

/** Ocultación — CT=2 → I1+E0+R1 (rápida, te “ancla” un instante) */
export const HideAction = makeDef({
  key: "hide", label: "Ocultación", I: 1, E: 0, R: 1,
  perform: async ({ actor }) => {
    const actorToken = actor?.getActiveTokens?.()[0]
      ?? canvas.tokens.placeables.find(t=>t.actor?.id===actor.id);
    if (!actorToken) return ui.notifications.warn("Sin token activo.");

    // VALIDACIÓN mínima (diseño: requiere cobertura >= media y no observado)
    const enemies = canvas.tokens.placeables.filter(t => t !== actorToken /* + tu lógica de hostilidad */);
    const hasMediumCover = enemies.some(t => {
      const pkg = buildPerceptionPackage({ actorToken: t, targetToken: actorToken });
      return pkg.cover_level === "medium" || pkg.cover_level === "total";
    });
    if (!hasMediumCover) {
      ui.notifications.warn("Requiere cobertura media o total.");
      return;
    }
    const observedBy = enemies.filter(t => {
      const pkg = buildPerceptionPackage({ actorToken: t, targetToken: actorToken });
      return pkg.visibility_level === "details_ok" && pkg.cover_level !== "total";
    });
    if (observedBy.length > 0) {
      ui.notifications.warn(`Observado por ${observedBy.length} enemigo(s).`);
      return;
    }

    // UI: elegir Competencia y DC
    const { DialogV2 } = foundry.applications.api;
    const choice = await DialogV2.prompt({
      title: "Ocultación",
      label: "Confirmar",
      content: `
        <form class="tsdc t-col" style="gap:8px;">
          <div class="grid" style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <label>Competencia
              <select name="skill">
                <option value="stealth">Sigilo</option>
                <option value="survival">Supervivencia</option>
              </select>
            </label>
            <label>DC
              <select name="dcMode">
                <option value="auto">Automática (entorno)</option>
                <option value="manual">Manual (Narrador)</option>
              </select>
            </label>
          </div>
          <div class="t-row" style="gap:8px;">
            <label>DC Manual <input name="dcManual" type="number" placeholder="14"></label>
          </div>
        </form>
      `,
      callback: (html) => {
        const skill = html[0].querySelector("[name=skill]").value;
        const dcMode = html[0].querySelector("[name=dcMode]").value;
        const dcManual = Number(html[0].querySelector("[name=dcManual]").value) || 14;
        return { skill, dcMode, dcManual };
      }
    });
    if (!choice) return;

    // DC automática sugerida según entorno (puedes refinarla)
    const env = canvas.scene.getFlag("tsdc","env") ?? {
      factor: game.settings.get("tsdc","env.factor"),
      intensity: game.settings.get("tsdc","env.intensity"),
      darkness: game.settings.get("tsdc","env.darkness")
    };
    const key = `${env.factor}:${env.intensity}`;
    const leve = new Set(["rain:light","snow:light","fog:light","smoke:light","dust:light"]);
    const moder= new Set(["rain:intense","snow:intense","fog:dense","dust:moderate"]);
    const sever= new Set(["rain:storm","snow:blizzard","smoke:dense","sand:storm"]);
    let DC = 12;
    if (env.darkness === "elemental") DC = Infinity;
    else if (moder.has(key)) DC = 14;
    else if (sever.has(key)) DC = 16;
    if (choice.dcMode === "manual") DC = choice.dcManual || 14;
    if (!isFinite(DC)) return ui.notifications.error("Oscuridad elemental: imposible sin luz apta.");

    // TIRADA: usa tu dispatcher si existe; si no, fallback a confirm
    let success = null;
    if (game.transcendence?.rolls?.skillCheck) {
      const res = await game.transcendence.rolls.skillCheck(actor, { skill: choice.skill, dc: DC, flavor: "Ocultación" });
      success = !!res?.success;
    } else {
      const { DialogV2 } = foundry.applications.api;
      success = await DialogV2.confirm({
        title: "Resultado de Ocultación (fallback)",
        content: `<p>¿La tirada (${choice.skill}) superó DC ${DC}?</p>`
      });
    }

    if (success) {
      await actorToken.document.setFlag("tsdc","concealment","hidden");
      try { await actorToken.document.toggleEffect("icons/svg/stealth.svg", { active:true }); } catch(_e){}
      await ChatMessage.create({ content: `<b>Ocultación</b>: <span style="color:var(--color-text-success)">Éxito</span> (DC ${DC})`,
        speaker: ChatMessage.getSpeaker({ actor }) });
    } else {
      await actorToken.document.unsetFlag("tsdc","concealment");
      try { await actorToken.document.toggleEffect("icons/svg/stealth.svg", { active:false }); } catch(_e){}
      await ChatMessage.create({ content: `<b>Ocultación</b>: <span style="color:var(--color-level-error)">Fallo</span> (DC ${DC})`,
        speaker: ChatMessage.getSpeaker({ actor }) });
    }
  }
});

export function makeFeatureActionFromData(key, feature) {
  const { init=0, exec=1, rec=0 } = feature?.ct || {};
  return {
    key: `feat:${key}`,
    label: feature?.label || key,
    init_ticks: init, exec_ticks: exec, rec_ticks: rec,
    perform: async ({ actor, meta }) => {
      // 0) Ejecuta tu runner como antes
      await performFeature({ actor, feature, meta });

      try {
        // 1) Si tiene área, permite seleccionar punto/objetivo y dibujar
        if (Number(feature?.area ?? 0) > 0 && feature?.areaShape) {
          const actorToken = actor?.getActiveTokens?.(true)?.[0]
            ?? canvas.tokens.placeables.find(t=>t.actor?.id===actor.id);
          if (!actorToken) return;

          const pick = await pickTargetOrCellForFeature({ actorToken, feature });
          if (!pick) return;

          // 2) Rango (en casillas) antes de dibujar
          if (!inRangeForFeature({ actorToken, feature, pick })) {
            ui.notifications.info("Fuera de rango.");
            return;
          }
          await drawAreaTemplateForFeature({ feature, actorToken, targetOrPoint: pick });
        }
      } catch (e) {
        console.warn("TSDC: draw template error", e);
      }
    }
  };
}


// selector genérico para "abilities" (no features)
async function pickTargetOrCell({ actorToken, ability }) {
  const area = Number(ability?.area ?? 0);
  if (area > 0) {
    // AoE: si range=0, autocentro; si no, usa el target del usuario como punto
    if ((ability.range ?? 0) === 0) {
      return { kind: "cell", point: actorToken.center };
    }
    const tgt = Array.from(game.user.targets ?? [])[0] ?? null;
    if (tgt) return { kind: "cell", point: tgt.center };
    // fallback: frente/centro del actor
    return { kind: "cell", point: actorToken.center };
  } else {
    // objetivo único
    const t = await pickAttackTarget({ actorToken });
    return t ? { kind: "token", token: t } : null;
  }
}

// selector genérico: token o celda (cuando area>0)
async function pickTargetOrCellForFeature({ actorToken, feature }) {
  const area = Number(feature?.area ?? 0);
  if (area > 0 && feature?.areaShape) {
    // Elegir celda si es explosión a distancia, o usar autocentro si range=0
    if (feature.range === 0 && feature.areaShape === "circle") {
      return { kind: "cell", point: actorToken.center };
    }
    // a dedo: si no tienes un picker custom, puedes usar el target del usuario como "punto"
    const tgt = Array.from(game.user.targets)[0];
    if (tgt) return { kind: "cell", point: tgt.center };
    // fallback: origen en frente del actor
    return { kind: "cell", point: actorToken.center };
  } else {
    // objetivo único
    const t = await pickAttackTarget({ actorToken });
    return t ? { kind: "token", token: t } : null;
  }
}

function inRangeForFeature({ actorToken, feature, pick }) {
  const rCells = Number(feature?.range ?? 0);
  if (pick.kind === "token") {
    // Reusa tu validador completo (visión + cobertura) con “arma a distancia = rango en unidades”
    const rangeM = rCells * sceneUnitsPerCell();
    // OJO: si no quieres validar visión aquí, quítalo y solo chequea distancia
    return validateAttackRangeAndVision({
      attackerToken: actorToken,
      targetToken: pick.token,
      weaponRangeM: rangeM
    }).ok;
  } else {
    const cells = cellsEveryOtherToPoint(actorToken, pick.point);
    return cells <= rCells;
  }
}

export function makeAbilityAction(ability, { key, clazz }) {
  const I = ability.ct?.init ?? 0, E = ability.ct?.exec ?? 1, R = ability.ct?.rec ?? 0;
  return {
    key: `${clazz}:${key}`,
    label: ability.label,
    init_ticks: I, exec_ticks: E, rec_ticks: R,
    async perform({ actor, meta }) {
      const actorToken = actor?.getActiveTokens?.(true)?.[0]
        ?? canvas.tokens.placeables.find(t=>t.actor?.id===actor.id);
      if (!actorToken) return ui.notifications.warn("Sin token activo.");

      const rank = getAbilityRank(actor, clazz, key);
      const gating = {
        mode: rank<=1 ? "N1" : (rank===2 ? "N2" : "N3"),
        suppressEffect: rank <= 1,
        suppressDescriptorInCombos: rank <= 2
      };

      const pick = await pickTargetOrCell({ actorToken, ability });
      if (!pick) return ui.notifications.warn("Selecciona un objetivo o una celda.");

      // Rango
      const rangeM = Number(ability.range ?? 1);
      const rCells = Number(ability.range ?? 0);
      const inRange = pick.kind==="cell"
        ? (cellsEveryOtherToPoint(actorToken, pick.point) <= rCells)
        : (await validateAttackRangeAndVision({
            attackerToken: actorToken,
            targetToken: pick.token,
            weaponRangeM: rCells * sceneUnitsPerCell()
          })).ok;
      if (!inRange) return ui.notifications.info("Fuera de rango.");
      
      await performFeature({ actor, feature: ability, meta: { ...(meta||{}), gating, pick, featureKey: key, clazz } });

      // Aquí solo dejamos un registro genérico.
      const where = pick.kind==="cell" ? "celda seleccionada" : `a ${pick.token.name}`;
      await ChatMessage.create({ content: `<b>${ability.label}</b> (${clazz}) [${gating.mode}] → ${where}` });
      // TODO: aplicar efecto/plantilla/daño según ability.effect / element / save
    }
  };
}
