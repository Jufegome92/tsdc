// modules/atb/actions-bridge.js
import { ACTIONS } from "../features/actions/catalog.js";
import { pushPenaltyForCurrentTick, scheduleBonusForNextAction } from "./mods.js";

export function actionToCard(def, chosenCT = null) {
  const triple = def.ctOptions ? def.ctOptions[chosenCT] : def.ct;
  const { I=0, E=0, R=0 } = triple || {};
  return {
    key: def.id,
    label: def.name,
    init_ticks: I, exec_ticks: E, rec_ticks: R,
    async perform({ actor, combat, combatant, tick, startedThisTick }) {
      // Aquí ejecutas la lógica real de la acción:
      // 1) disparar tiradas (TA/TI/TE) si existen
      // 2) aplicar mods CT1/CT3 en Especializaciones, etc.

      if (def.id === "especializacion") {
        const rank =  Math.max(1, Number(actor.system?.skills?.currentRank ?? 1));
        if (chosenCT === 1) {
          await pushPenaltyForCurrentTick(combat, combatant.id, {
            value: -Math.max(1, Math.ceil(rank/2)),
            types: ["TD","TC","TR"], note: "CT1 Especialización (penalización)"
          });
        }
        if (chosenCT === 3) {
          await scheduleBonusForNextAction(combat, combatant.id, {
            value: rank,
            types: ["TD","TC","TR"], note: "CT3 Especialización (bono próximo tick)"
          });
        }
      }

      // TODO: disparar tiradas según def.rolls
    }
  };
}
