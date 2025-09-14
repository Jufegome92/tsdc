// modules/atb/actions.js
// Acciones ATB según tu CT = I + E + R.
// MANIOBRAS irán en otro módulo (no van aquí).

import { rollAttack } from "../rolls/dispatcher.js";
import { pushPenaltyForCurrentTick, scheduleBonusForNextAction } from "./mods.js";
import { MANEUVERS } from "../features/maneuvers/data.js";
import { buildPerceptionPackage, packageToRollContext, describePackage } from "../perception/index.js";

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
  perform: async ({ actor }) => {
    // Token del actor y primer objetivo seleccionado por el usuario
    const actorToken  = actor?.getActiveTokens?.()?.[0]
      ?? canvas?.tokens?.placeables?.find?.(t => t?.actor?.id === actor.id)
      ?? null;
    const targetToken = Array.from(game.user?.targets ?? [])[0] ?? null;

    let context = {};
    if (actorToken && targetToken) {
      const pkg = buildPerceptionPackage({ actorToken, targetToken });
      context = packageToRollContext(pkg);
      // Mensaje claro para el grupo (previo a la tirada)
      await ChatMessage.create({
        content: `<div class="tsdc-perception">${describePackage(pkg)}</div>`,
        speaker: ChatMessage.getSpeaker({ actor })
      });
      if (pkg.attack_mod_from_cover === "unreachable") {
        ui.notifications?.warn("Cobertura total: el objetivo es inalcanzable desde aquí.");
        return;
      }
    }
    await rollAttack(actor, { flavor: "ATB • Ataque", mode: "ask", context });
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
  const m = MANEUVERS[key];
  if (!m?.ct) return null;
  return {
    kind: "maneuver",
    key,
    label: m.label,
    init: m.ct.init ?? 0,
    exec: m.ct.exec ?? 1,
    rec:  m.ct.rec  ?? 0,
    tags: ["maneuver", m.type, m.category, m.descriptor].filter(Boolean)
  };
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
    const choice = await Dialog.prompt({
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
      success = await Dialog.confirm({
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