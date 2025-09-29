// modules/features/aptitudes/handlers.js
// Aptitude-specific logic (actions, reactions, passives).

import { setAptitudeEffect, consumeAptitudeEffect, setPendingEvaluation } from "./state.js";
import { addAilment } from "../../ailments/index.js";
import { pushPenaltyForCurrentTick } from "../../atb/mods.js";
import { resolveEvolution } from "../advantage/index.js";
import { baseFromSpec, requiresEvolutionChoice, getSpec, toCanonSpec } from "../specializations/index.js";
import { makeRollTotal } from "../../rolls/engine.js";
import { emitModInspector } from "../../rolls/inspector.js";

const actionHandlers = new Map();
const reactionHandlers = new Map();
let passiveRegistered = false;

function notifyInfo(message) {
  ui.notifications?.info?.(message);
}

function notifyWarn(message) {
  ui.notifications?.warn?.(message);
}

// Helper function to schedule bonus for next action
async function scheduleBonusForNextAction(actor, bonusConfig) {
  // This would integrate with the ATB system to apply bonuses
  // For now, we'll store it as an aptitude effect
  await setAptitudeEffect(actor, `${bonusConfig.type}_bonus`, {
    kind: "action-bonus",
    type: bonusConfig.type,
    value: bonusConfig.value,
    label: bonusConfig.label,
    status: "ready"
  });
}

async function rollSpecializationForAptitude(actor, {
  aptitudeKey = null,
  specKey,
  label,
  category = "physical",
  mode: forcedMode = null,
  ctMod = 0,
  flavorPrefix = "Aptitud"
}) {
  if (!actor || !specKey) return null;

  const canonKey = toCanonSpec(specKey) ?? specKey;
  const specDef = getSpec(canonKey) || {};
  const specLabel = label || specDef.label || canonKey;
  const attrs = actor.system?.attributes ?? {};
  const baseValue = baseFromSpec(attrs, canonKey) || 0;
  const defaults = actor.system?.ui?.rollDefaults?.spec ?? { bonus: 0, diff: 0, mode: "learning" };
  const needsPolicy = requiresEvolutionChoice(canonKey);
  let mode = forcedMode ?? (needsPolicy ? (defaults.mode || "learning") : "none");
  if (!needsPolicy && mode === "ask") mode = "none";

  const modifier = baseValue + Number(defaults.bonus ?? 0) - Number(defaults.diff ?? 0) + Number(ctMod || 0);
  const formula = `1d10 + ${modifier}`;

  const rankPath = `system.progression.skills.${canonKey}.rank`;
  const rank = Number(foundry.utils.getProperty(actor, rankPath) || 0);

  const evo = await resolveEvolution({
    type: "specialization",
    mode,
    formula,
    rank,
    flavor: `${flavorPrefix} • ${specLabel}`,
    actor,
    toChat: false,
    meta: {
      key: canonKey,
      category,
      aptitudeKey: aptitudeKey ?? null
    }
  });

  if (!evo?.resultRoll) return null;

  const ctx = {
    phase: "skill",
    tag: "TE",
    tags: ["aptitude", `spec:${canonKey}`],
    rollType: "TE",
    category,
    aptitudeKey
  };

  const patchedPrimary = makeRollTotal(actor, Number(evo.resultRoll.total ?? 0), ctx);
  const patchedOther = evo.otherRoll ? makeRollTotal(actor, Number(evo.otherRoll.total ?? 0), ctx) : null;

  await emitModInspector(actor, { phase: "skill", tag: "TE" }, patchedPrimary.breakdown);

  const chatFlags = {
    tsdc: {
      version: 1,
      actorId: actor.id ?? actor._id ?? null,
      type: "specialization",
      policy: evo.usedPolicy ?? mode,
      rank,
      meta: {
        key: canonKey,
        category,
        aptitudeKey: aptitudeKey ?? null
      },
      totals: {
        low: patchedOther ? Math.min(patchedPrimary.total, patchedOther.total) : patchedPrimary.total,
        high: patchedOther ? Math.max(patchedPrimary.total, patchedOther.total) : patchedPrimary.total
      }
    }
  };

  const message = await evo.resultRoll.toMessage({
    flavor: `${flavorPrefix} • ${specLabel}`,
    flags: chatFlags
  });

  return {
    canonKey,
    specLabel,
    rank,
    usedPolicy: evo.usedPolicy ?? mode,
    patchedPrimary,
    patchedOther,
    message
  };
}

function registerActionHandlers() {
  // Impulso Sobrehumano — salto con +50% distancia, requiere impulso previo de 5 casillas
  actionHandlers.set("impulso_sobrehumano", async ({ actor, token, aptitudeKey, meta }) => {
    // Verificar impulso previo de 5 casillas (esto debería ser verificado por el motor de movimiento)
    const lastMovement = meta?.lastMovement || 0;
    if (lastMovement < 5) {
      notifyWarn(`${actor.name}: Impulso Sobrehumano requiere impulso previo de 5 casillas.`);
      return false;
    }

    // Marcar efecto para mejorar la distancia del salto
    await setAptitudeEffect(actor, aptitudeKey, {
      kind: "jump-enhancement",
      distanceMultiplier: 1.5,
      status: "ready"
    });

    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "saltar",
      label: "Impulso Sobrehumano",
      category: "physical",
      mode: "ask",
      flavorPrefix: "Aptitud"
    });

    if (!roll) return false;

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 4,
        onFailure: {
          addAilment: { id: "DESEQUILIBRADO", options: { severity: "riguroso" } }
        }
      });
    }

    return true;
  });

  // Salto de Rebote — segundo salto tras tocar superficie vertical con -3 a la tirada
  actionHandlers.set("salto_rebote", async ({ actor, token, aptitudeKey, meta }) => {
    // Verificar superficie vertical cercana (esto requiere integración con el motor de movimiento)
    const nearSurfaces = meta?.nearSurfaces || [];
    const hasVertical = nearSurfaces.some(s => s.type === "vertical");

    if (!hasVertical) {
      notifyWarn(`${actor.name}: Salto de Rebote requiere una superficie vertical cercana.`);
      return false;
    }

    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "saltar",
      label: "Salto de Rebote",
      category: "physical",
      ctMod: -3, // Penalizador -3 a la tirada
      mode: "ask",
      flavorPrefix: "Aptitud"
    });

    if (!roll) return false;

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 4,
        onFailure: {
          addAilment: { id: "DESEQUILIBRADO", options: { severity: "riguroso" } }
        }
      });
    }

    return true;
  });

  // Salto Sigiloso — prepara un salto que no provoca reacciones
  actionHandlers.set("salto_sigiloso", async ({ actor, aptitudeKey }) => {
    const stealthRank = Number(actor.system?.progression?.skills?.sigilo?.rank || 0);

    // Verificar requisito de Rango 2 en Sigilo
    if (stealthRank < 2) {
      notifyWarn(`${actor.name}: Salto Sigiloso requiere Rango 2 en Sigilo.`);
      return false;
    }

    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "saltar",
      label: "Salto Sigiloso",
      category: "physical",
      ctMod: stealthRank, // +1 por rango de Sigilo
      mode: "ask",
      flavorPrefix: "Aptitud"
    });
    if (!roll) return false;

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 4,
        onFailure: {
          addAilment: { id: "DESEQUILIBRADO", options: { severity: "riguroso" } }
        },
        onSuccess: {
          finalizeEffect: true
        }
      });
    }

    await setAptitudeEffect(actor, aptitudeKey, {
      kind: "jump",
      status: "pending",
      preventReactions: true,
      silent: true
    });

    notifyInfo(`${actor.name} prepara un salto sigiloso.`);
    return true;
  });

  // Golpe Acrobático — ataque cuerpo a cuerpo seguido de movimiento de 2 casillas
  actionHandlers.set("golpe_acrobatico", async ({ actor, token, aptitudeKey, meta }) => {
    // Verificar que tiene arma cuerpo a cuerpo
    const weaponKey = meta?.weaponKey;
    if (!weaponKey) {
      notifyWarn(`${actor.name}: Golpe Acrobático requiere un arma cuerpo a cuerpo equipada.`);
      return false;
    }

    // Marcar efecto para permitir movimiento posterior sin reacciones
    await setAptitudeEffect(actor, aptitudeKey, {
      kind: "post-attack-movement",
      cells: 2,
      status: "ready"
    });

    // La tirada se maneja durante el ataque, aquí preparamos el riesgo
    const messageId = `${actor.id}-${aptitudeKey}-${Date.now()}`;
    await setPendingEvaluation(actor, messageId, {
      aptitudeKey,
      check: "margin",
      threshold: 3,
      onFailure: {
        addAilment: { id: "DESEQUILIBRADO", options: { severity: "riguroso" } }
      }
    });

    return true;
  });

  // Reposicionamiento — movimiento hasta 3 casillas sin reacciones y ataque inmediato
  actionHandlers.set("reposicionamiento", async ({ actor, token, aptitudeKey, meta }) => {
    const meleeRank = Number(actor.system?.progression?.skills?.melee?.rank || 0);

    // Verificar Rango 3 con arma cuerpo a cuerpo
    if (meleeRank < 3) {
      notifyWarn(`${actor.name}: Reposicionamiento requiere Rango 3 con arma cuerpo a cuerpo.`);
      return false;
    }

    // Marcar efecto para movimiento sin reacciones
    await setAptitudeEffect(actor, aptitudeKey, {
      kind: "pre-attack-movement",
      cells: 3,
      status: "ready"
    });

    const messageId = `${actor.id}-${aptitudeKey}-${Date.now()}`;
    await setPendingEvaluation(actor, messageId, {
      aptitudeKey,
      check: "margin",
      threshold: 5,
      onFailure: {
        addAilment: { id: "DESEQUILIBRADO", options: { severity: "riguroso" } },
        cancelAttack: true
      }
    });

    return true;
  });

  // === DESTREZA APTITUDES ===

  // Desarme — superar TC de Agilidad para que suelte un objeto
  actionHandlers.set("desarme", async ({ actor, token, aptitudeKey, meta }) => {
    const targetToken = meta?.targetToken;
    if (!targetToken) {
      notifyWarn(`${actor.name}: Desarme requiere un objetivo válido.`);
      return false;
    }

    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "destreza",
      label: "Desarme",
      category: "physical",
      mode: "ask",
      flavorPrefix: "Aptitud"
    });

    if (!roll) return false;

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 3,
        onFailure: {
          effect: "allowReaction",
          targetToken: targetToken,
          message: "El desarme falla y permite una reacción inmediata del objetivo."
        }
      });
    }

    notifyInfo(`${actor.name} intenta desarmar a ${targetToken.name}.`);
    return true;
  });

  // === TREPAR APTITUDES ===

  // Ascenso Acelerado — escalar a velocidad mitad con -2 a la tirada
  actionHandlers.set("ascenso_acelerado", async ({ actor, token, aptitudeKey, meta }) => {
    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "trepar",
      label: "Ascenso Acelerado",
      category: "physical",
      ctMod: -2, // Penalizador -2 a la tirada
      mode: "ask",
      flavorPrefix: "Aptitud"
    });

    if (!roll) return false;

    // Marcar que puede escalar a velocidad mitad
    await setAptitudeEffect(actor, aptitudeKey, {
      kind: "movement-enhancement",
      climbSpeed: "half", // En lugar de un tercio
      status: "ready"
    });

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 4,
        onFailure: {
          effect: "fallDamage",
          message: "El ascenso acelerado falla, causando caída y daño."
        }
      });
    }

    return true;
  });

  // Descenso Controlado — descender rápidamente sin reducir velocidad
  actionHandlers.set("descenso_controlado", async ({ actor, token, aptitudeKey, meta }) => {
    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "trepar",
      label: "Descenso Controlado",
      category: "physical",
      mode: "ask",
      flavorPrefix: "Aptitud"
    });

    if (!roll) return false;

    // Marcar que puede descender sin penalizar velocidad
    await setAptitudeEffect(actor, aptitudeKey, {
      kind: "movement-enhancement",
      descendSpeed: "normal",
      status: "ready"
    });

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 3,
        onFailure: {
          effect: "fallDamage",
          multiplier: 1.0, // Daño completo por caída
          message: "El descenso controlado falla, causando caída con daño completo."
        }
      });
    }

    return true;
  });

  // === EQUITACIÓN APTITUDES ===

  // Carga sobre Montura — carga montada con +2 al ataque tras 5 casillas
  actionHandlers.set("carga_sobre_montura", async ({ actor, token, aptitudeKey, meta }) => {
    // Verificar que tiene montura (esto requiere integración con el sistema de monturas)
    const hasMount = meta?.hasMount ?? true; // Por ahora asumimos que tiene montura

    if (!hasMount) {
      notifyWarn(`${actor.name}: Carga sobre Montura requiere una montura.`);
      return false;
    }

    // Verificar movimiento previo de 5 casillas
    const lastMovement = meta?.lastMovement || 0;
    if (lastMovement < 5) {
      notifyWarn(`${actor.name}: Carga sobre Montura requiere movimiento previo de 5 casillas.`);
      return false;
    }

    // Aplicar bonificador +2 al próximo ataque
    await scheduleBonusForNextAction(actor, {
      type: "attack",
      value: 2,
      label: "Carga sobre Montura (+2)"
    });

    const messageId = `${actor.id}-${aptitudeKey}-${Date.now()}`;
    await setPendingEvaluation(actor, messageId, {
      aptitudeKey,
      check: "margin",
      threshold: 5,
      onFailure: {
        effect: "mountAndRiderDisoriented",
        message: "La carga falla por 5+, dejando Desorientados a jinete y montura."
      }
    });

    notifyInfo(`${actor.name} realiza una carga montada con bonificador +2 al ataque.`);
    return true;
  });

  // === VIGOR APTITUDES ===

  // Carga — carga en línea recta con bonificador por rango de Vigor
  actionHandlers.set("carga_vigor", async ({ actor, token, aptitudeKey, meta }) => {
    const vigorRank = getSpecializationRank(actor, "vigor");

    // Verificar movimiento en línea recta de 4 casillas
    const straightMovement = meta?.straightMovement || 0;
    if (straightMovement < 4) {
      notifyWarn(`${actor.name}: Carga requiere movimiento en línea recta de al menos 4 casillas.`);
      return false;
    }

    // Aplicar bonificador +1 por rango de Vigor al ataque
    await scheduleBonusForNextAction(actor, {
      type: "attack",
      value: vigorRank,
      label: `Carga (+${vigorRank} por Vigor)`
    });

    const messageId = `${actor.id}-${aptitudeKey}-${Date.now()}`;
    await setPendingEvaluation(actor, messageId, {
      aptitudeKey,
      check: "margin",
      threshold: 3,
      onFailure: {
        addAilment: { id: "DESORIENTADO", options: { severity: "riguroso" } }
      }
    });

    notifyInfo(`${actor.name} realiza una carga con bonificador +${vigorRank} al ataque.`);
    return true;
  });

  // Golpe de Furia — golpe para romper partes de equipo o criatura
  actionHandlers.set("golpe_de_furia", async ({ actor, token, aptitudeKey, meta }) => {
    const vigorRank = getSpecializationRank(actor, "vigor");
    const weaponKey = meta?.weaponKey;

    if (!weaponKey) {
      notifyWarn(`${actor.name}: Golpe de Furia requiere un arma cuerpo a cuerpo equipada.`);
      return false;
    }

    // Marcar que este ataque es para romper/destruir en lugar de hacer daño
    await setAptitudeEffect(actor, aptitudeKey, {
      kind: "attack-modifier",
      purpose: "sunder", // Para romper equipo/partes
      bonus: vigorRank,
      status: "ready"
    });

    const messageId = `${actor.id}-${aptitudeKey}-${Date.now()}`;
    await setPendingEvaluation(actor, messageId, {
      aptitudeKey,
      check: "margin",
      threshold: 4,
      onFailure: {
        addAilment: { id: "DESEQUILIBRADO", options: { severity: "riguroso" } },
        penaltyNextDefense: -2
      }
    });

    notifyInfo(`${actor.name} prepara un Golpe de Furia para romper/destruir.`);
    return true;
  });
}

function registerReactionHandlers() {
  // Impulso de Supervivencia — salto instintivo para evitar peligro con +2 vs trampas
  reactionHandlers.set("impulso_supervivencia", async ({ actor, token, aptitudeKey, provokerToken }) => {
    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "saltar",
      label: "Impulso de Supervivencia",
      category: "survival",
      ctMod: 2, // +2 vs trampas
      mode: "ask",
      flavorPrefix: "Reacción"
    });

    if (!roll) return false;

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 4,
        onFailure: {
          effect: "doubleDamage",
          message: "El salto instintivo falla y el personaje recibe el doble de daño del peligro."
        }
      });
    }

    notifyInfo(`${actor.name} realiza un salto instintivo para evitar el peligro.`);
    return true;
  });

  // Salto Evasivo — evasión aérea con movimiento posterior
  reactionHandlers.set("salto_evasivo", async ({ actor, token, aptitudeKey, provokerToken }) => {
    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "saltar",
      label: "Salto Evasivo",
      category: "defense",
      mode: "ask",
      flavorPrefix: "Reacción"
    });

    if (!roll) return false;

    // Marcar efecto para permitir movimiento de 1 casilla sin reacciones tras la evasión
    await setAptitudeEffect(actor, aptitudeKey, {
      kind: "post-defense-movement",
      cells: 1,
      status: "ready"
    });

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 3,
        onFailure: {
          effect: "additionalDamageLevel",
          message: "El salto evasivo falla y el ataque inflige un nivel de daño adicional."
        }
      });
    }

    notifyInfo(`${actor.name} intenta una evasión aérea.`);
    return true;
  });

  // Maniobra Evasiva — sustituye la próxima defensa por TE de Acrobacias
  reactionHandlers.set("maniobra_evasiva", async ({ actor, token, aptitudeKey, provokerToken, rank = 0 }) => {
    // Marcar al actor para usar maniobra evasiva en la próxima defensa
    await actor.setFlag("tsdc", "maniobraEvasiva", {
      active: true,
      aptitudeKey,
      provokerTokenId: provokerToken?.id,
      rank
    });

    notifyInfo(`${actor.name} se prepara para ejecutar una maniobra evasiva contra el próximo ataque.`);
    return true;
  });

  // Rodamiento Defensivo — reduce severidad al fallar defensa
  reactionHandlers.set("rodamiento_defensivo", async ({ actor, token, aptitudeKey }) => {
    await setAptitudeEffect(actor, aptitudeKey, {
      kind: "defense-post",
      reduceSeverity: 1,
      repositionCells: 1,
      status: "ready"
    });

    // Preparar evaluación de riesgo para después de aplicar la reducción
    const messageId = `${actor.id}-${aptitudeKey}-${Date.now()}`;
    await setPendingEvaluation(actor, messageId, {
      aptitudeKey,
      check: "margin",
      threshold: 4,
      onFailure: {
        addAilment: { id: "DERRIBADO", options: { severity: "riguroso" } }
      }
    });

    notifyInfo(`${actor.name} se prepara para rodar tras el impacto, reduciendo su severidad.`);
    return true;
  });

  // === DESTREZA REACCIONES ===

  // Redirigir Proyectiles — devolver proyectil a su origen al superar defensa por 3+
  reactionHandlers.set("redirigir_proyectiles", async ({ actor, token, aptitudeKey, provokerToken, rank }) => {
    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "destreza",
      label: "Redirigir Proyectiles",
      category: "defense",
      mode: "ask",
      flavorPrefix: "Reacción"
    });

    if (!roll) return false;

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "success",
        onSuccess: {
          effect: "redirectProjectile",
          targetToken: provokerToken,
          requiredMargin: 3
        },
        onFailure: {
          effect: "additionalDiceAdvancement",
          message: "Falla por 3+ y añade un avance de dado al impacto recibido."
        }
      });
    }

    notifyInfo(`${actor.name} intenta redirigir el proyectil hacia ${provokerToken?.name || "su origen"}.`);
    return true;
  });

  // Segunda Oportunidad — repetir tirada de TE física fallida con -3
  reactionHandlers.set("segunda_oportunidad", async ({ actor, token, aptitudeKey, provokerToken, rank }) => {
    // Esta reacción se activa tras fallar una TE física
    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "destreza", // Usa destreza para la segunda oportunidad
      label: "Segunda Oportunidad",
      category: "physical",
      ctMod: -3, // Penalizador -3
      mode: "ask",
      flavorPrefix: "Reacción"
    });

    if (!roll) return false;

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 3,
        onFailure: {
          addAilment: { id: "DESORIENTADO", options: { severity: "riguroso" } }
        }
      });
    }

    notifyInfo(`${actor.name} obtiene una segunda oportunidad con -3 a la tirada.`);
    return true;
  });

  // === EQUILIBRIO REACCIONES ===

  // Inamovible — resistencia contra derribo/desplazamiento con +1 por rango de Equilibrio
  reactionHandlers.set("inamovible", async ({ actor, token, aptitudeKey, provokerToken, rank }) => {
    const equilibriumRank = getSpecializationRank(actor, "equilibrio");

    // Aplicar bonificador +1 por rango de Equilibrio a la resistencia
    const bonus = equilibriumRank;

    await scheduleBonusForNextAction(actor, {
      type: "resistance",
      value: bonus,
      label: `Inamovible (+${bonus})`
    });

    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "equilibrio",
      label: "Inamovible",
      category: "defense",
      ctMod: bonus,
      mode: "ask",
      flavorPrefix: "Reacción"
    });

    if (!roll) return false;

    notifyInfo(`${actor.name} se vuelve inamovible con bonificador +${bonus} contra derribo/desplazamiento.`);
    return true;
  });

  // === EQUITACIÓN REACCIONES ===

  // Maniobra Defensiva (Montura) — sustituir TD por TE de Equitación
  reactionHandlers.set("maniobra_defensiva_montura", async ({ actor, token, aptitudeKey, provokerToken, rank }) => {
    // Verificar que tiene montura
    const hasMount = token.document.actorData?.hasMount ?? true; // Placeholder

    if (!hasMount) {
      notifyWarn(`${actor.name}: Maniobra Defensiva requiere una montura.`);
      return false;
    }

    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "equitacion",
      label: "Maniobra Defensiva (Montura)",
      category: "defense",
      mode: "ask",
      flavorPrefix: "Reacción"
    });

    if (!roll) return false;

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 3,
        onFailure: {
          effect: "fallFromMount",
          message: "La maniobra defensiva falla por 3+ y caes de la montura."
        }
      });
    }

    notifyInfo(`${actor.name} ejecuta una maniobra defensiva montada.`);
    return true;
  });

  // Esquivar en Movimiento — sustituir defensa contra proyectil por Equitación y mover montura
  reactionHandlers.set("esquivar_en_movimiento", async ({ actor, token, aptitudeKey, provokerToken, rank }) => {
    const hasMount = token.document.actorData?.hasMount ?? true;

    if (!hasMount) {
      notifyWarn(`${actor.name}: Esquivar en Movimiento requiere una montura.`);
      return false;
    }

    const roll = await rollSpecializationForAptitude(actor, {
      aptitudeKey,
      specKey: "equitacion",
      label: "Esquivar en Movimiento",
      category: "defense",
      mode: "ask",
      flavorPrefix: "Reacción"
    });

    if (!roll) return false;

    // Marcar movimiento de media velocidad para la montura
    await setAptitudeEffect(actor, aptitudeKey, {
      kind: "mount-movement",
      speed: "half",
      status: "ready"
    });

    const messageId = roll.message?.id ?? roll.message?._id ?? null;
    if (messageId) {
      await setPendingEvaluation(actor, messageId, {
        aptitudeKey,
        check: "margin",
        threshold: 3,
        onFailure: {
          effect: "mountUnbalanced",
          message: "El esquive en movimiento falla por 3+ y la montura queda Desequilibrada."
        }
      });
    }

    notifyInfo(`${actor.name} esquiva en movimiento contra el ataque a distancia.`);
    return true;
  });
}

registerActionHandlers();
registerReactionHandlers();

export function getActionHandler(key) {
  return actionHandlers.get(key) ?? null;
}

export function getReactionHandler(key) {
  return reactionHandlers.get(key) ?? null;
}

export function ensurePassiveHandlers() {
  if (passiveRegistered) return;
  passiveRegistered = true;

  // Hook para Caer con Estilo - reduce daño por caída en una categoría
  Hooks.on("tsdc.calculateFallDamage", (actor, damage, meta) => {
    const aptitudeKey = "caer_con_estilo";
    const hasAptitude = actor?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const acrobaticsRank = getSpecializationRank(actor, "acrobacias");

    if (!hasAptitude || acrobaticsRank < 2) return;

    // Reducir daño en una categoría
    const reducedDamage = Math.max(0, damage - 1);
    meta.originalDamage = damage;
    meta.reduction = damage - reducedDamage;
    meta.source = "Caer con Estilo";

    // Si hay tirada asociada, evaluar riesgo
    if (meta.rollResult) {
      const margin = (meta.difficulty || 10) - meta.rollResult.total;
      if (margin >= 3) {
        // Calcular daño usando categoría superior
        const increasedDamage = Math.min(damage + 1, meta.maxDamage || 10);
        meta.riskApplied = true;
        meta.increasedDamage = increasedDamage;
        return increasedDamage;
      }
    }

    return reducedDamage;
  });

  // Hook para Paso Firme - bonificador +1 por rango de Equilibrio
  Hooks.on("tsdc.modifyRoll", (actor, rollData) => {
    const aptitudeKey = "paso_firme";
    const hasAptitude = actor?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const equilibriumRank = getSpecializationRank(actor, "equilibrio");

    if (!hasAptitude || equilibriumRank < 1) return;

    const applicableSpecs = ["acrobacias", "saltar", "trepar"];
    if (applicableSpecs.includes(rollData.specKey)) {
      rollData.ctMod = (rollData.ctMod || 0) + equilibriumRank;
      rollData.modifiers = rollData.modifiers || [];
      rollData.modifiers.push({
        source: "Paso Firme",
        value: equilibriumRank,
        type: "aptitude"
      });
    }
  });

  // Hook para Oportunista - los enemigos no pueden evitar reacciones de arma
  Hooks.on("tsdc.checkOpportunityEvasion", (actor, attacker, context) => {
    const aptitudeKey = "oportunista";
    const hasAptitude = attacker?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const destrezaRank = getSpecializationRank(attacker, "destreza");

    if (hasAptitude && destrezaRank >= 4) {
      context.canEvade = false;
      context.reason = "Oportunista impide la evasión";
    }
  });

  // Hook para Escalada con Precisión - ignorar penalizadores por superficies
  Hooks.on("tsdc.modifyClimbRoll", (actor, rollData, surface) => {
    const aptitudeKey = "escalada_precision";
    const hasAptitude = actor?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const treparRank = getSpecializationRank(actor, "trepar");

    if (hasAptitude && treparRank >= 4) {
      if (surface.slippery || surface.fragile) {
        rollData.surfacePenalty = 0;
        rollData.modifiers = rollData.modifiers || [];
        rollData.modifiers.push({
          source: "Escalada con Precisión",
          value: 0,
          type: "aptitude",
          description: "Ignora penalizadores por superficies"
        });
      }
    }
  });

  // Hook para Ascenso de Carga Pesada - trepar con carga pesada
  Hooks.on("tsdc.checkClimbingCapacity", (actor, currentLoad, context) => {
    const aptitudeKey = "ascenso_carga_pesada";
    const hasAptitude = actor?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const treparRank = getSpecializationRank(actor, "trepar");

    if (hasAptitude && treparRank >= 4) {
      // Reducir la capacidad de carga en una categoría para permitir trepar
      context.climbingCapacity = Math.max(0, context.carryingCapacity - 1);
      context.modifier = "Ascenso de Carga Pesada";
    }
  });

  // Hook para Recursividad - +2 a Trepar sin equipo
  Hooks.on("tsdc.modifyClimbRoll", (actor, rollData, equipment) => {
    const aptitudeKey = "recursividad";
    const hasAptitude = actor?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const treparRank = getSpecializationRank(actor, "trepar");

    if (hasAptitude && treparRank >= 2 && !equipment.climbingGear) {
      rollData.ctMod = (rollData.ctMod || 0) + 2;
      rollData.modifiers = rollData.modifiers || [];
      rollData.modifiers.push({
        source: "Recursividad",
        value: 2,
        type: "aptitude",
        description: "Improvisa puntos de apoyo"
      });
    }
  });

  // Hook para Punto de Apoyo - +2 a aliados en terreno inestable
  Hooks.on("tsdc.modifyRoll", (actor, rollData, allies) => {
    const aptitudeKey = "punto_apoyo";

    // Buscar aliados cercanos con la aptitud
    if (allies && rollData.specKey === "equilibrio") {
      for (const ally of allies) {
        const hasAptitude = ally?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
        const equilibriumRank = getSpecializationRank(ally, "equilibrio");
        const distance = rollData.distanceToAlly || 0;

        if (hasAptitude && equilibriumRank >= 3 && distance <= 2) {
          rollData.ctMod = (rollData.ctMod || 0) + 2;
          rollData.modifiers = rollData.modifiers || [];
          rollData.modifiers.push({
            source: `Punto de Apoyo (${ally.name})`,
            value: 2,
            type: "aptitude",
            description: "Aliado cercano proporciona apoyo"
          });
          break; // Solo un aliado puede dar el bonus
        }
      }
    }
  });

  // Hook para Movimiento Seguro - sin penalizadores en superficies difíciles
  Hooks.on("tsdc.modifyMovementRoll", (actor, rollData, terrain) => {
    const aptitudeKey = "movimiento_seguro";
    const hasAptitude = actor?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const equilibriumRank = getSpecializationRank(actor, "equilibrio");

    if (hasAptitude && equilibriumRank >= 4) {
      if (terrain.narrow || terrain.slippery) {
        rollData.terrainPenalty = 0;
        rollData.modifiers = rollData.modifiers || [];
        rollData.modifiers.push({
          source: "Movimiento Seguro",
          value: 0,
          type: "aptitude",
          description: "Sin penalizadores por terreno difícil"
        });
      }
    }
  });

  // Hook para Cuidador (Montura) - reduce tiempo y recursos de mantenimiento
  Hooks.on("tsdc.calculateMountMaintenance", (actor, mount, maintenanceData) => {
    const aptitudeKey = "cuidador_montura";
    const hasAptitude = actor?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const equitacionRank = getSpecializationRank(actor, "equitacion");

    if (hasAptitude && equitacionRank >= 2) {
      maintenanceData.timeMultiplier *= 0.5;
      maintenanceData.costMultiplier *= 0.5;
      maintenanceData.source = "Cuidador";
    }
  });

  // Hook para Adiestramiento (Montura) - otorga habilidades especiales a la montura
  Hooks.on("tsdc.configureMountAbilities", (actor, mount, abilities) => {
    const aptitudeKey = "adiestramiento_montura";
    const hasAptitude = actor?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const equitacionRank = getSpecializationRank(actor, "equitacion");

    if (hasAptitude && equitacionRank >= 2) {
      abilities.specialCommunication = true;
      abilities.trackingSkill = true;
      abilities.modifiers = abilities.modifiers || [];
      abilities.modifiers.push({
        source: "Adiestramiento",
        abilities: ["Comunicación especial", "Rastrear"],
        type: "aptitude"
      });
    }
  });

  // Hook para Fortaleza Inquebrantable - ignorar el primer nivel de Fatiga
  Hooks.on("tsdc.calculateFatigue", (actor, fatigueData) => {
    const aptitudeKey = "fortaleza_inquebrantable";
    const hasAptitude = actor?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const vigorRank = getSpecializationRank(actor, "vigor");

    if (hasAptitude && vigorRank >= 2) {
      fatigueData.ignoredLevels = Math.max(fatigueData.ignoredLevels || 0, 1);
      fatigueData.modifiers = fatigueData.modifiers || [];
      fatigueData.modifiers.push({
        source: "Fortaleza Inquebrantable",
        effect: "Ignora primer nivel de Fatiga",
        type: "aptitude"
      });
    }
  });

  // Hook para Resistencia de Hierro - incrementa umbral de colapso
  Hooks.on("tsdc.calculateCollapseThreshold", (actor, thresholdData) => {
    const aptitudeKey = "resistencia_hierro";
    const hasAptitude = actor?.system?.progression?.aptitudes?.[aptitudeKey]?.known;
    const vigorRank = getSpecializationRank(actor, "vigor");

    if (hasAptitude && vigorRank >= 3) {
      // Incrementar umbral (la cantidad exacta debería ser determinada por el GM)
      thresholdData.bonus = (thresholdData.bonus || 0) + Math.floor(vigorRank / 2);
      thresholdData.modifiers = thresholdData.modifiers || [];
      thresholdData.modifiers.push({
        source: "Resistencia de Hierro",
        value: Math.floor(vigorRank / 2),
        type: "aptitude"
      });
    }
  });

  console.log("TSDC | Passive aptitude handlers registered");
}

export async function applyAptitudeRiskFailure(actor, config) {
  if (!actor || !config?.onFailure) return;
  const failure = config.onFailure;

  // Aplicar agravios
  if (failure.addAilment) {
    const { id, options } = failure.addAilment;
    if (id) await addAilment(actor, id, options ?? {});
  }

  // Penalizadores temporales
  if (failure.penaltyCurrentTick) {
    const { value, types, note } = failure.penaltyCurrentTick;
    const combat = game.combat;
    const combatantId = combat?.combatants?.find(c => c.actor?.id === actor.id)?.id;
    if (combat && combatantId) {
      await pushPenaltyForCurrentTick(combat, combatantId, {
        value: Number(value || 0),
        types: Array.isArray(types) ? types : ["TD"],
        note: note ?? "Aptitud"
      });
    }
  }

  // Efectos especiales de las aptitudes
  if (failure.effect) {
    switch (failure.effect) {
      case "doubleDamage":
        // Marcar para el sistema de daño que debe aplicar el doble
        await setAptitudeEffect(actor, config.aptitudeKey || "unknown", {
          kind: "damage-modifier",
          multiplier: 2.0,
          status: "ready"
        });
        break;

      case "additionalDamageLevel":
        // Añadir un nivel de daño adicional
        await setAptitudeEffect(actor, config.aptitudeKey || "unknown", {
          kind: "damage-modifier",
          additionalLevels: 1,
          status: "ready"
        });
        break;

      case "additionalDamageByRank":
        // Daño adicional igual al rango del atacante
        const attackerRank = failure.attackerToken?.actor ?
          getSpecializationRank(failure.attackerToken.actor, "melee") : 1;
        await setAptitudeEffect(actor, config.aptitudeKey || "unknown", {
          kind: "damage-modifier",
          additionalFlat: attackerRank,
          status: "ready"
        });
        break;
    }
  }

  // Cancelar ataque si es necesario
  if (failure.cancelAttack) {
    await setAptitudeEffect(actor, config.aptitudeKey || "unknown", {
      kind: "cancel-action",
      actionType: "attack",
      status: "ready"
    });
  }

  // Mostrar mensaje personalizado
  if (failure.message) {
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><b>${actor.name}</b>: ${failure.message}</p>`
    });
  }
}

function getSpecializationRank(actor, specKey) {
  return Number(actor?.system?.progression?.skills?.[specKey]?.rank || 0);
}

export async function finalizeAptitudeEffect(actor, aptitudeKey) {
  if (!actor || !aptitudeKey) return;
  const current = await consumeAptitudeEffect(actor, aptitudeKey);
  if (!current) return;
  if (current.kind === "jump") {
    await setAptitudeEffect(actor, aptitudeKey, { ...current, status: "active" });
  } else {
    await setAptitudeEffect(actor, aptitudeKey, current);
  }
}

export { rollSpecializationForAptitude };
