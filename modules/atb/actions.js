// modules/atb/actions.js
// Acciones ATB según tu CT = I + E + R.
// MANIOBRAS irán en otro módulo (no van aquí).

import { rollAttack } from "../rolls/dispatcher.js";
import { pushPenaltyForCurrentTick, scheduleBonusForNextAction } from "./mods.js";
import { MANEUVERS } from "../features/maneuvers/data.js";

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
    await rollAttack(actor, { flavor: "ATB • Ataque", mode: "ask" });
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
    DropAction
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
