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
import { getEquippedWeaponKey } from "../features/inventory/index.js";
import { weaponRangeM } from "../combat/range.js";
import { validateAttackRangeAndVision } from "../rolls/validators.js";
import { shouldPromptHere } from "./rx-dialog.js";
import { performFeature } from "../features/runner.js";
import { MANEUVERS } from "../features/maneuvers/data.js";
// import { APTITUDES } from "../features/aptitudes/data.js";
// import { RELIC_POWERS } from "../features/relics/data.js";

const MELEE_RANGE_M = 1.0;

/* ===== Helpers ===== */
function distanceM(a, b) {
  return cellsEveryOther(a, b) * 1;
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
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? "OWNER";
  return game.users.filter(u =>
    actor?.testUserPermission?.(u, OWNER) || u.isGM
  );
}

function attackerChoiceHere(actorToken) {
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? "OWNER";
  return actorToken?.actor?.testUserPermission?.(game.user, OWNER) || game.user.isGM;
}

async function pickAttackTarget({ actorToken, storedId = null }) {
  if (!actorToken?.actor) return null;

  // targets activos de los dueños del atacante (y GM)
  const owners = ownerUsersOfActor(actorToken.actor);
  const ownerTargets = [...new Set(
    owners.flatMap(u => Array.from(u.targets ?? []))
  )].filter(t =>
    t?.actor && !t.document.hidden && t.id !== actorToken.id
  );

  if (ownerTargets.length === 1) return ownerTargets[0];

  if (ownerTargets.length > 1) {
    // Si este cliente es quien decide, abrimos selector; si no, usamos el primero (ya lo eligió “alguien”)
    if (!attackerChoiceHere(actorToken)) return ownerTargets[0];

    const opts = ownerTargets.map(t => `<option value="${t.id}">${t.name}</option>`).join("");
    const { DialogV2 } = foundry.applications.api;
    const chosenId = await DialogV2.prompt({
      window:{ title:"Elige objetivo del Ataque" },
      content:`<form class="t-col" style="gap:8px;"><label>Objetivo <select name="t">${opts}</select></label></form>`,
      ok:{ label:"Atacar", callback: (_ev, btn) => btn.form.elements.t.value }
    });
    return canvas.tokens.get(chosenId) ?? null;
  }

  // Sin targets activos → usa el guardado al planear (si lo hay)
  if (storedId) return canvas.tokens.get(storedId) ?? null;

  // Nada
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

    await rollAttack(actor, { flavor: "ATB • Ataque", mode: "ask", context: ctx });
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

async function askPreAttackReaction(targetToken, attackerToken) {
  // deja registro en estado de escena
  openReactionWindow({
    ownerToken: targetToken,
    reason: "before-attack",
    payload: { attackerId: attackerToken.id }
  });

  // solo decide el dueño del objetivo (o el GM)
  const OWNER = CONST.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? "OWNER";
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
    perform: async ({ actor, meta }) => performFeature({ actor, feature, meta })
  };
}

// selector genérico: token o celda (cuando area>0)
async function pickTargetOrCell({ actorToken, ability }) {
  if ((ability.area ?? 0) > 0) {
    // Centro de área: pedir una celda rápida (sin colocar template todavía)
    const p = await canvas.app?.mouse?.interaction?.waitForTarget?.()  // si no existe en tu build, usa DialogV2 para pedir x,y
              ?? { x: actorToken.center.x, y: actorToken.center.y };
    return { kind: "cell", point: p };
  } else {
    // reutiliza tu selector de objetivo
    const t = await pickAttackTarget({ actorToken });
    return t ? { kind: "token", token: t } : null;
  }
}

export function makeAbilityAction(ability, { key, clazz }) {
  const I = ability.ct?.init ?? 0, E = ability.ct?.exec ?? 1, R = ability.ct?.rec ?? 0;
  return {
    key: `${clazz}:${key}`,
    label: ability.label,
    init_ticks: I, exec_ticks: E, rec_ticks: R,
    async perform({ actor, meta }) {
      const actorToken = actor?.getActiveTokens?.(true)?.[0] ?? canvas.tokens.placeables.find(t=>t.actor?.id===actor.id);
      if (!actorToken) return ui.notifications.warn("Sin token activo.");
      const pick = await pickTargetOrCell({ actorToken, ability });
      if (!pick) return ui.notifications.warn("Selecciona un objetivo o una celda.");

      // Rango
      const rangeM = Number(ability.range ?? 1);
      const inRange = pick.kind==="cell"
        ? (metersDistance121(actorToken, pick.point) <= rangeM)
        : (await validateAttackRangeAndVision({ attackerToken: actorToken, targetToken: pick.token, weaponRangeM: rangeM })).ok;
      if (!inRange) return ui.notifications.info("Fuera de rango.");

      // Aquí solo dejamos un registro genérico.
      const where = pick.kind==="cell" ? `celda (${Math.round(pick.point.x)},${Math.round(pick.point.y)})` : `a ${pick.token.name}`;
      await ChatMessage.create({ content: `<b>${ability.label}</b> (${clazz}) → ${where} • Área=${ability.area??0}` });
      // TODO: aplicar efecto/plantilla/daño según ability.effect / element / save
    }
  };
}