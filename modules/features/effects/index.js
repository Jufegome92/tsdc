// modules/features/effects/index.js
import { getNaturalWeaponDef } from "../species/natural-weapons.js";
import * as Tags from "./tags.js";
import * as Ail from "../../ailments/index.js"; // si no existe, los helpers abajo lo hacen seguro

/* =========================================
 * Helpers seguros
 * =======================================*/
function speakerOf(actor) {
  return ChatMessage.getSpeaker({ actor });
}
async function say(actor, html) {
  await ChatMessage.create({ speaker: speakerOf(actor), content: html });
}
function has(fn) {
  return typeof fn === "function";
}
async function addAilmentSafe(actor, key, opts = {}) {
  if (Ail && has(Ail.addAilment)) return Ail.addAilment(actor, key, opts);
  // fallback: solo avisar al chat
  await say(actor, `<em>(Debug)</em> Falta Ail.addAilment — no se pudo aplicar <b>${key}</b>.`);
}
async function addTempConditionSafe(actor, key, rounds = 1, extras = {}) {
  return addAilmentSafe(actor, key, { duration: { type: "rounds", value: rounds }, ...extras });
}
async function incLoadSafe(actor, points = 1, reason = "") {
  if (Ail && has(Ail.incrementAilmentLoad)) return Ail.incrementAilmentLoad(actor, points, reason);
}

/* =========================================
 * Router principal
 * =======================================*/

/**
 * Aplica el “effectId” declarado en la definición de arma natural.
 * Asúmese que la llamada viene DESPUÉS de confirmar éxito en el ataque.
 *
 * p = {
 *   attacker, defender?, weaponKey, margin=0, rank=0, targetName?, notes?
 * }
 */
export async function applyNaturalWeaponEffect(p = {}) {
  const { attacker, defender = null, weaponKey, margin = 0, rank = 0, targetName = null, notes = "" } = p;
  const def = getNaturalWeaponDef(weaponKey);
  if (!def?.effectId) return;

  // Recordatorio de tags del arma al chat
  Tags.applyWeaponTagsReminder(attacker, def);

  const eid = String(def.effectId || "").toUpperCase();
  const fn = EFFECTS[eid];

  if (!fn) {
    console.warn("[effects] effectId no mapeado:", eid);
    return;
  }
  try {
    await fn({ attacker, defender, def, margin, rank, targetName, notes });
  } catch (err) {
    console.error("[effects] error en", eid, err);
  }
}

/* =========================================
 * Implementaciones de efectos
 * (elige las que uses; el resto quedan como plantillas)
 * =======================================*/

const EFFECTS = {
  // ===== NAGHII =====
  "NAGHII_TAIL_TRIP": async ({ attacker, defender, def, margin, targetName }) => {
    if (!defender) return;
    const ok = margin >= 3;
    await say(attacker, `<b>${targetName ?? defender.name}</b> ${ok ? "queda <b>derribado</b>" : "resiste el derribo"} por ${def.label}.`);
    if (ok) await addTempConditionSafe(defender, "PRONO", 1);
  },
  "NAGHII_BITE_TENACITY_POISON": async ({ attacker, defender, def, rank, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> sufre <b>veneno (Tenacidad)</b>.`);
    // ejemplo: veneno que afecta Tenacidad (ajusta al ID real de tu catálogo)
    await addAilmentSafe(defender, "VENENO_TENACIDAD", { potency: 1 + Math.floor(rank / 2) });
    await incLoadSafe(defender, 1, "veneno (tenacidad)");
  },
  "NAGHII_SPIT_BLIND": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> queda <b>CEGADO</b> (2 rondas).`);
    await addTempConditionSafe(defender, "CEGADO", 2);
  },

  // ===== SAURI =====
  "SAURI_CLAWS_BLEED": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> sufre <b>SANGRADO</b>.`);
    await addAilmentSafe(defender, "SANGRADO", { severity: "leve" });
  },
  "SAURI_BITE_BREAK_PARTS": async ({ attacker, defender, def, rank, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: potencia adicional para <b>romper partes</b> (rango ${rank}).`);
    // si tienes una mecánica concreta, puedes marcar un flag temporal en el objetivo

  },

  // ===== ZARNAG =====
  "ZARNAG_CLAWS_COMBO_STRENGTH_BONUS": async ({ attacker, def }) => {
    await say(attacker, `${def.label}: ganas <b>+1 Fuerza</b> para el próximo ataque combinado este turno.`);
    // marca buff temporal al atacante si llevas sistema de buffs
  },
  "ZARNAG_BITE_INFECTION_PARALYSIS": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> contrae <b>infección</b> que causa parálisis intermitente.`);
    await addAilmentSafe(defender, "INFECCION_PARALISIS", { contagio: "Moderado" });
    await incLoadSafe(defender, 2, "infección (parálisis)");
  },

  // ===== DRAK'KAI =====
  "DRAKKAI_SHELL_CHARGE_PUSH": async ({ attacker, defender, def, targetName, rank }) => {
    if (!defender) return;
    const meters = 1 + Math.floor(rank / 2);
    await say(attacker, `${def.label}: empujas a <b>${targetName ?? defender.name}</b> <b>${meters}m</b> y puedes <em>Intercepción</em>.`);
  },
  "DRAKKAI_BITE_DIE_STEP": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: el próximo <b>Impacto</b> mejora un paso de dado contra <b>${targetName ?? defender.name}</b>.`);
  },

  // ===== ROKHART =====
  "ROKHART_CLAWS_RETREAT": async ({ attacker, def }) => {
    await say(attacker, `${def.label}: puedes <b>Retirarte</b> 3m sin provocar reacción.`);
  },
  "ROKHART_BEAK_CRIT_EASIER": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> queda <b>Expuesto</b> (más fácil criticarlo, 1 ronda).`);
    await addTempConditionSafe(defender, "EXPUESTO", 1);
  },

  // ===== LOXOD =====
  "LOXOD_TUSKS_TRIP": async ({ attacker, defender, def, targetName, margin }) => {
    if (!defender) return;
    const ok = margin >= 3;
    await say(attacker, `${def.label}: ${ok ? `<b>${targetName ?? defender.name}</b> cae <b>PRONO</b>` : "no logras tumbarlo"}.`);
    if (ok) await addTempConditionSafe(defender, "PRONO", 1);
  },
  "LOXOD_TRUNK_UNBALANCE": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> queda <b>DESEQUILIBRADO</b> (1 ronda).`);
    await addTempConditionSafe(defender, "DESEQUILIBRADO", 1);
  },

  // ===== CERATOX =====
  "CERATOX_HORN_ARMOR_REDUCE": async ({ attacker, defender, def, targetName, rank }) => {
    if (!defender) return;
    const reduce = 1 + Math.floor(rank / 2);
    await say(attacker, `${def.label}: reduces <b>${reduce}</b> punto(s) de <b>Armadura</b> de <b>${targetName ?? defender.name}</b> (1 ronda).`);
    await addTempConditionSafe(defender, "ARMADURA_REDUCIDA", 1, { value: reduce });
  },

  // ===== FORMIX =====
  "FORMIX_BITE_TRAP": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> queda <b>Atrapado</b> (agarre).`);
    await addTempConditionSafe(defender, "ATRAPADO", 1);
  },
  "FORMIX_STING_STR_POISON": async ({ attacker, defender, def, targetName, rank }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>Veneno</b> que merma <b>Fuerza</b> aplicado a <b>${targetName ?? defender.name}</b>.`);
    await addAilmentSafe(defender, "VENENO_FUERZA", { potency: 1 + Math.floor(rank / 2) });
    await incLoadSafe(defender, 1, "veneno (fuerza)");
  },
  "FORMIX_CORROSION_APPLY": async ({ attacker, defender, def, targetName, rank }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>Corrosión</b> daña equipo/carne de <b>${targetName ?? defender.name}</b>.`);
    await addAilmentSafe(defender, "CORROSION", { potency: Math.max(1, Math.floor(rank / 2)) });
  },

  // ===== CHELICER =====
  "CHELICER_CLAWS_CRIT_ALTERATIONS": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: contra objetivos con <b>alteraciones</b>, tus críticos son más probables (1 ronda).`);
    await addTempConditionSafe(attacker, "CRIT_MEJORA_VS_ALTERADOS", 1);
  },
  "CHELICER_STING_PARALYSIS": async ({ attacker, defender, def, targetName, rank }) => {
    if (!defender) return;
    const rounds = 1 + Math.floor(rank / 3);
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> queda <b>PARALIZADO</b> (${rounds} ronda${rounds>1?"s":""}).`);
    await addTempConditionSafe(defender, "PARALIZADO", rounds);
  },
  "CHELICER_SPIT_AGI_POISON": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>Veneno</b> que merma <b>Agilidad</b> aplicado a <b>${targetName ?? defender.name}</b>.`);
    await addAilmentSafe(defender, "VENENO_AGILIDAD", { potency: 1 });
  },

  // ===== PANIN =====
  "PANIN_BITE_BLEED_STACKS": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> acumula <b>cargas de SANGRADO</b>.`);
    await addAilmentSafe(defender, "SANGRADO_ACUMULATIVO", { stacks: 1 });
  },

  // ===== LUPHRAN =====
  "LUPHRAN_CLAWS_CUNNING_BUFF": async ({ attacker, def }) => {
    await say(attacker, `${def.label}: obtienes <b>+1 Astucia</b> este turno (acciones de movimiento/engaño).`);
    await addTempConditionSafe(attacker, "ASTUCIA_BUFF", 1, { value: 1 });
  },
  "LUPHRAN_BITE_FOCUS_PENALTY": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: penalizas <b>Enfoque</b> de <b>${targetName ?? defender.name}</b> (1 ronda).`);
    await addTempConditionSafe(defender, "FOCUS_PENALTY", 1, { value: 3 });
  },

  // ===== URSARI =====
  "URSARI_CLAWS_IMPEDE": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> queda <b>IMPEDIDO</b> (movimiento reducido).`);
    await addTempConditionSafe(defender, "IMPEDIDO", 1);
  },
  "URSARI_BITE_BREAK_PARTS": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: mejor capacidad de <b>romper partes</b> contra <b>${targetName ?? defender.name}</b> (1 ronda).`);
  },

  // ===== ARAKHEL =====
  "ARAKHEL_BITE_CONFUSION": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> sufre <b>CONFUSIÓN</b> (1 ronda).`);
    await addTempConditionSafe(defender, "CONFUNDIDO", 1);
  },

  // ===== BUFONI =====
  "BUFONI_TONGUE_PULL_OR_TRAP": async ({ attacker, defender, def, targetName, margin }) => {
    if (!defender) return;
    const pull = margin >= 3;
    await say(attacker, `${def.label}: ${pull ? `arrastras a <b>${targetName ?? defender.name}</b> 2m` : `lo <b>atrapas</b> si falla TR`}.`);
    if (!pull) await addTempConditionSafe(defender, "ATRAPADO", 1);
  },

  // ===== VESPER =====
  "VESPER_BITE_BLOOD_EXTRACTION": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: extraes <b>sangre</b> de <b>${targetName ?? defender.name}</b> (ganas recurso/curación menor).`);
    // Podrías curar al atacante o dar recurso temporal
  },
  "VESPER_CLAWS_UNBALANCE": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> queda <b>DESEQUILIBRADO</b> (1 ronda).`);
    await addTempConditionSafe(defender, "DESEQUILIBRADO", 1);
  },

  // ===== LAPINNI =====
  "LAPINNI_CLAWS_SLOW_AND_RELOCATE": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> queda <b>LENTO</b> (1 ronda) y puedes recolocarlo 1m.`);
    await addTempConditionSafe(defender, "LENTO", 1);
  },

  // ===== ERIN =====
  "ERIN_SPIKES_REACTIONS": async ({ attacker, def }) => {
    await say(attacker, `${def.label}: ganas <b>reacciones</b> extra para <em>interceptar</em> este turno (limitadas).`);
  },
  "ERIN_CLAWS_WEAKEN_POISON_INFECTION": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> queda <b>DEBILITADO</b> y vulnerable a <b>venenos/infecciones</b> (1 ronda).`);
    await addTempConditionSafe(defender, "DEBILITADO", 1);
  },

  // ===== MANTO =====
  "MANTO_PINCERS_TRAP": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: sujetas a <b>${targetName ?? defender.name}</b> (<b>ATRAPADO</b>).`);
    await addTempConditionSafe(defender, "ATRAPADO", 1);
  },
  "MANTO_BITE_WEAKEN": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> sufre <b>DEBILITADO</b> (1 ronda).`);
    await addTempConditionSafe(defender, "DEBILITADO", 1);
  },

  // ===== TALPI =====
  "TALPI_CLAWS_DOUBLE_HIT_WEAKEN": async ({ attacker, defender, def, targetName, margin }) => {
    if (!defender) return;
    const dbl = margin >= 5;
    await say(attacker, `${def.label}: ${dbl ? "golpe <b>doble</b> y" : ""} aplicas <b>DEBILITADO</b> a <b>${targetName ?? defender.name}</b> (1 ronda).`);
    await addTempConditionSafe(defender, "DEBILITADO", 1);
  },
  "TALPI_BITE_FRACTURE": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: provocas <b>FRACTURA</b> en <b>${targetName ?? defender.name}</b>.`);
    await addAilmentSafe(defender, "FRACTURA", { severity: "leve" });
  },

  // ===== MYO =====
  "MYO_CLAWS_DURABILITY_SHRED": async ({ attacker, defender, def, targetName, rank }) => {
    if (!defender) return;
    const shred = 1 + Math.floor(rank / 3);
    await say(attacker, `${def.label}: reduces <b>Durabilidad</b> del equipo de <b>${targetName ?? defender.name}</b> en <b>${shred}</b> (1 ronda).`);
  },
  "MYO_BITE_NAUSEA_INFECTION": async ({ attacker, defender, def, targetName }) => {
    if (!defender) return;
    await say(attacker, `${def.label}: <b>${targetName ?? defender.name}</b> contrae infección con <b>NÁUSEA</b>.`);
    await addAilmentSafe(defender, "INFECCION_NAUSEA", { contagio: "Leve" });
    await incLoadSafe(defender, 1, "infección (náusea)");
  }
};
