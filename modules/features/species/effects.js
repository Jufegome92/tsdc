// tsdc/modules/features/species/effects.js
// Motor de Herencias y Legados por especie.
// Integra con el sistema de tiradas enviando un "contexto" (ctx) con metadatos.
//
// API principal:
// - getRollModifiersForActor(actor, ctx) → { flat: number, diceAdvances: number, notes: string[] }
// - processEventForActor(actor, evt) → { changes: Array<...>, notes: string[] }  (gatillos no de tirada)
// - getPassiveForActor(actor) → info estática (visión, ajustes DR, etc.)
// - applySpeciesToRoll(actor, roll, ctx) → muta {total,diceAdvances,notes[]} sumando lo de especie.
//
// Requisitos de datos en el actor:
// - actor.system.species?.key  (o actor.system.species) con la especie en lowercase
// - actor.system.levelRef (o system.level) para escalar efectos por nivel de referencia
//
// Convenciones de contexto (ctx):
// - rollType: 'TE' | 'TR' | 'TC' | 'TA' | 'TD'  (si es tirada)
// - skill: string | null         (p.ej. "Negociación", "Sigilo", "Taumaturgia", etc.)
// - characteristic: string|null  (para TC: "Fuerza", "Agilidad", "Tenacidad", "Sabiduría", "Intelecto", "Compostura", "Aura", "Presencia"...)
// - tags: string[]               (p.ej. ['fuego','encantamiento','desdeSigilo','psiquico','dolor','sangrado','vista','tacticas','orientacion',...])
// - targetInSight: boolean
// - levelRef: number             (si no viene, se lee del actor)
// - alliesNearby: number         (para efectos por aliado cercano)
// - distanceToAllies: number     (metros; para penalizadores por aislamiento)
// - flags (cualquiera útil para condicionar reglas temporales)
//
// Para eventos (evt):
// - type: 'onWound' | 'onKill' | 'onStartOfDay' | 'onStartOfWeek' | 'onTRFail' | 'activateDuel' | ...
// - payload: datos del evento (ej. { severity:'grave'|'critica'|'leve', isCritical, canSpendWear, targetId, ... })

/* =========================
 * Helpers base
 * ========================= */
const toLower = (s) => String(s || "").toLowerCase();
const inSet = (x, arr) => arr.map(toLower).includes(toLower(x));
const hasTag = (ctxOrEvt, tag) => (ctxOrEvt?.tags || []).map(toLower).includes(toLower(tag));
const isRollType = (ctx, ...types) => types.includes(ctx?.rollType);

function matchesSkill(ctx, names = []) {
  const sk = toLower(ctx?.skill || "");
  return names.map(toLower).some((n) => sk === n);
}
function matchesAnySkillPrefix(ctx, prefixes = []) {
  const sk = toLower(ctx?.skill || "");
  return prefixes.map(toLower).some((p) => sk.startsWith(p));
}
function bonusPer4(levelRef = 1) {
  return Math.floor((levelRef || 0) / 4);
}
function penaltyStepPer7(levelRef = 1) {
  // reduce un penalizador base en 1 cada 7 niveles → devuelve "reducción"
  return Math.floor((levelRef || 0) / 7);
}
function ensureLevelRef(actor, ctx) {
  let lv = ctx?.levelRef;
  if (lv == null) lv = actor?.system?.levelRef ?? actor?.system?.level ?? 1;
  return lv || 1;
}
function evtFlag(ctx, flag) {
  return !!ctx?.[flag];
}
function has(obj = {}, key) { return !!obj?.[key]; }

/* ==================================================
 * Motor: reglas por especie (Herencia y Legados)
 * Cada regla devuelve {flat, diceAdvances, notes} al evaluar una tirada.
 * Para eventos, devuelve {changes, notes}.
 * ================================================== */

const S = {}; // registro por especie

/* ============ NAGHII ============ */
S.naghii = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Vulnerabilidad al Encantamiento → TR contra encantamiento/manipulación mental: -3
    if (isRollType(ctx, "TR") && (hasTag(ctx, "encantamiento") || hasTag(ctx, "mental") || hasTag(ctx, "manipulacion"))) {
      flat -= 3;
      notes.push("Naghii - Vulnerabilidad al Encantamiento: -3 TR (encantamiento/mental).");
    }

    // Legado: Maestría en la Coerción → TE Domest./Negoc./Engaño/Liderazgo con objetivo a la vista: +floor(lv/4)
    if (isRollType(ctx, "TE") && ctx.targetInSight && matchesSkill(ctx, ["Domesticación","Negociación","Engaño","Liderazgo"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Naghii - Maestría en la Coerción: +${b} TE.`);
    }

    // Legado: Camuflaje → TE Sigilo: +per4
    if (isRollType(ctx, "TE") && matchesSkill(ctx, ["Sigilo"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Naghii - Camuflaje: +${b} Sigilo.`);
    }

    // Legado: Lengua Bifurcada → TE Rastreo/Percepción en búsqueda o sin visión: +per4
    if (isRollType(ctx, "TE") && matchesSkill(ctx, ["Rastreo","Percepción"]) && (hasTag(ctx, "busqueda") || !ctx.targetInSight)) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Naghii - Lengua Bifurcada: +${b} Rastreo/Percepción.`);
    }

    return { flat, diceAdvances: 0, notes };
  },
};

/* ============ SAURI ============ */
S.sauri = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Susceptibilidad Elemental → TE Enfoque: +1 dificultad (se modela como -1)
    if (isRollType(ctx, "TE") && (matchesSkill(ctx, ["Enfoque"]) || hasTag(ctx, "enfoque"))) {
      flat -= 1;
      notes.push("Sauri - Susceptibilidad Elemental: +1 dificultad a Enfoque (aplicado como -1 TE).");
      if (ctx?.secondTechnique) { flat -= 2; notes.push("Sauri - Segunda técnica: dificultad total +3 (aplicado como -3 TE)."); }
    }

    // Legado: Dominio Elemental → +per4 TE Taumaturgia
    if (isRollType(ctx, "TE") && matchesSkill(ctx, ["Taumaturgia"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Sauri - Dominio Elemental: +${b} Taumaturgia.`);
    }
    return { flat, diceAdvances: 0, notes };
  },
  event(evt, actor) {
    const notes = []; const changes = [];
    if (evt?.type === "onWound") {
      const { isCritical, canSpendWear } = evt.payload || {};
      if (!isCritical && canSpendWear) {
        changes.push({
          kind: "offerReaction",
          id: "sauri-piel-refractaria",
          cost: { wear: 1 },
          effect: { reduceWoundSeverityBy: 1 },
          limit: "oncePerRound",
          label: "Piel Refractaria",
        });
        notes.push("Sauri - Piel Refractaria: puedes gastar 1 desgaste para reducir en 1 la severidad (1/rd).");
      }
    }
    if (evt?.type === "computeAguante") {
      const rank = actor?.system?.vigor?.rank ?? 0;
      changes.push({ kind: "resourceBonus", resource: "aguante", flat: rank });
      notes.push(`Sauri - Resistencia al Agotamiento: +${rank} a Aguante (= rango Vigor).`);
    }
    return { changes, notes };
  },
};

/* ============ ZARNAG ============ */
S.zarnag = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Competencia Feroz → -3 a TE de Tácticas bajo mando ajeno (excepto Liderazgo), -1/7
    if (isRollType(ctx, "TE") && hasTag(ctx, "tacticas") && hasTag(ctx, "bajoMandoAjeno") && !matchesSkill(ctx, ["Liderazgo"])) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Zarnag - Competencia Feroz: ${pen} TE en Tácticas bajo mando ajeno (excepto Liderazgo).`);
    }

    // Legado: Resiliencia Carroñera → +per4 TR contra infecciones
    if (isRollType(ctx, "TR") && (hasTag(ctx, "infeccion") || hasTag(ctx, "contagio"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Zarnag - Resiliencia Carroñera: +${b} TR (infecciones).`);
    }

    // Legado: Asalto Furtivo → +per4 TA desde sigilo/sorpresa
    if (isRollType(ctx, "TA") && (hasTag(ctx, "desdeSigilo") || hasTag(ctx, "sorpresa"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Zarnag - Asalto Furtivo: +${b} TA (sigilo/sorpresa).`);
    }

    // Legado: Risa Retorcida → +per4 Intimidación
    if (matchesSkill(ctx, ["Intimidación"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Zarnag - Risa Retorcida: +${b} Intimidación.`);
    }

    return { flat, diceAdvances: 0, notes };
  },
};

/* ============ DRAK'KAI ============ */
S.drakkai = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Hermitaño → -3 a Negociación, -1/7
    if (matchesSkill(ctx, ["Negociación"])) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Drak'kai - Hermitaño: ${pen} Negociación.`);
    }

    // Legado: Sentido Magnético → +per4 TE Supervivencia/Intuición/Percepción para orientarse/rutas
    if (isRollType(ctx, "TE") && matchesSkill(ctx, ["Supervivencia","Intuición","Percepción"]) && (hasTag(ctx, "orientacion") || hasTag(ctx, "rutas"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Drak'kai - Sentido Magnético: +${b} (orientación/rutas).`);
    }

    // Legado: Custodio de Reliquias → +per4 Percepción/Identificación (tesoros/ocultos)
    if (isRollType(ctx, "TE") && matchesSkill(ctx, ["Percepción","Identificación"]) && (hasTag(ctx, "tesoro") || hasTag(ctx, "oculto") || hasTag(ctx, "objetoValioso"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Drak'kai - Custodio de Reliquias: +${b} objetos/tesoros ocultos.`);
    }

    return { flat, diceAdvances: 0, notes };
  },
  passive() {
    return {
      armorRankBonus: 1,
      notes: ["Drak'kai - Defensa Natural: +1 rango efectivo para cálculo de reducción de daño físico."],
    };
  },
};

/* ============ ROKHART ============ */
S.rokhart = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Fragilidad Ósea → el atacante obtiene +1 avance de dado con daño contundente (nota informativa)
    if (hasTag(ctx, "recibeDañoContundente") && (isRollType(ctx, "TD") || isRollType(ctx, "TR"))) {
      notes.push("Rokhart - Fragilidad Ósea: el atacante obtiene +1 avance de dado (contundente).");
    }

    // Legados:
    if (isRollType(ctx, "TE") && (hasTag(ctx, "miedo") || matchesSkill(ctx, ["Intimidación","Engaño"]))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Rokhart - Imperturbable: +${b} contra miedo/intimidación/engaño.`);
    }
    if (matchesSkill(ctx, ["Percepción"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Rokhart - Visión de Águila: +${b} Percepción.`);
    }
    if (matchesSkill(ctx, ["Negociación"]) && hasTag(ctx, "recoleccionInfo")) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Rokhart - Ojo de la República: +${b} Negociación (recolección de info).`);
    }

    return { flat, diceAdvances: 0, notes };
  },
  passive() {
    return { visionRangeMeters: 70, notes: ["Rokhart - Visión de Águila: rango de visión 70m."] };
  },
};

/* ============ LOXOD ============ */
S.loxod = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Ansias de Conocimiento → efecto al fallar (evento), dejamos nota contextual si investiga secretos/artefactos/antiguo
    if (isRollType(ctx, "TE") && matchesSkill(ctx, ["Saberes","Interpretación"]) && hasTag(ctx, "secretos/artefactos/antiguo")) {
      notes.push("Loxod - Ansias de Conocimiento: si fallas, gana 1 punto de obsesión (aflicción).");
    }

    // Legado: Rosetta Ancestral → +per4 Interpretación
    if (matchesSkill(ctx, ["Interpretación"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Loxod - Rosetta Ancestral: +${b} Interpretación.`);
    }

    return { flat, diceAdvances: 0, notes };
  },
  event(evt, actor) {
    const notes = []; const changes = [];
    if (evt?.type === "onCheckFail" && evt?.payload && inSet(evt.payload.skill, ["Saberes","Interpretación"]) && hasTag(evt, "secretos/artefactos/antiguo")) {
      changes.push({ kind: "applyAfflictionStack", id: "obsesion", amount: 1 });
      notes.push("Loxod - Ansias de Conocimiento: +1 intensidad de obsesión (al fallar).");
    }
    return { changes, notes };
  },
  passive(actor) {
    const lv = ensureLevelRef(actor, {});
    return {
      learningAdvantage: { skills: ["Saberes"], rankReduction: bonusPer4(lv) },
      notes: [
        `Loxod - Memoria Críptica: -${bonusPer4(lv)} al rango efectivo para Ventaja de Aprendizaje en Saberes (más fácil).`,
        "Loxod - Memoria Críptica: puede asumir 1 obsesión para relanzar (elección del jugador).",
        "Loxod - Trompa Versátil: Carga = Fuerza x10kg; +per4 a TE de Vigor (empujar/levantar/escalar) sin precisión fina.",
      ],
    };
  },
};

/* ============ CERATOX ============ */
S.ceratox = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0, diceAdvances = 0; const notes = [];

    // Herencia: Supremacía Incuestionable → -3 Empatía/Compostura al confiar en no-Ceratox, -1/7
    if ((matchesSkill(ctx, ["Empatía"]) || matchesSkill(ctx, ["Compostura"])) && hasTag(ctx, "confiarEnOtros")) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Ceratox - Supremacía Incuestionable: ${pen} (confianza en no-Ceratox).`);
    }

    // Legados
    if ((isRollType(ctx, "TC") && toLower(ctx?.characteristic) === "fuerza") ||
        (isRollType(ctx, "TE") && matchesSkill(ctx, ["Vigor"]))) {
      if (hasTag(ctx, "fuerzaPura") || hasTag(ctx, "empujar") || hasTag(ctx, "levantar") || hasTag(ctx, "romper")) {
        const b = bonusPer4(lv); flat += b; if (b) notes.push(`Ceratox - Fuerza Imparable: +${b} (fuerza pura).`);
      }
    }
    if (matchesSkill(ctx, ["Liderazgo"]) && hasTag(ctx, "tacticas")) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Ceratox - Maestros de la Guerra: +${b} Liderazgo (Tácticas).`);
    }
    if (isRollType(ctx, "TA") && hasTag(ctx, "dueloActivoVsObjetivo")) {
      const b = bonusPer4(lv); flat += b; diceAdvances += 1;
      notes.push(`Ceratox - Desafío: +${b} TA y +1 avance de dado (duelo).`);
    }

    return { flat, diceAdvances, notes };
  },
  event(evt) {
    const notes = []; const changes = [];
    if (evt?.type === "activateDuel") {
      changes.push({ kind: "applyTagToRelation", tag: "dueloActivoVsObjetivo", target: evt?.payload?.targetId });
      notes.push("Ceratox - Desafío activado: objetivo acepta el duelo mientras ambos puedan combatir.");
    }
    return { changes, notes };
  },
};

/* ============ FORMIX ============ */
S.formix = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Desconexión Psíquica → -3 TR contra psíquico/aflicciones, -1/7
    if (isRollType(ctx, "TR") && (hasTag(ctx, "psiquico") || hasTag(ctx, "afliccion"))) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Formix - Desconexión Psíquica: ${pen} TR vs psíquico/aflicciones.`);
    }

    // Legados
    if (matchesSkill(ctx, ["Percepción","Saberes","Intuición","Supervivencia"]) &&
        (hasTag(ctx, "quimico") || hasTag(ctx, "olor") || hasTag(ctx, "toxina") || hasTag(ctx, "vidaCercana"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Formix - Sensibilidad Química: +${b} detección (≤10m).`);
    }
    if (hasTag(ctx, "usoManosMultiples")) {
      notes.push("Formix - Destreza Manual: 2 manos principales + 2 auxiliares (ver acciones/armas).");
    }

    return { flat, diceAdvances: 0, notes };
  },
  passive() {
    return { vigorAsLarge: true, notes: ["Formix - Exoesqueleto: tratar como tamaño Grande para Aguante/Carga/Talento (Vigor)."] };
  },
};

/* ============ CHELICER ============ */
S.chelicer = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Devoción Ciega → -3 Encanto, -1/7
    if (matchesSkill(ctx, ["Encanto"])) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Chelicer - Devoción Ciega: ${pen} Encanto.`);
    }

    // Legados
    if (matchesSkill(ctx, ["Compostura"]) && (hasTag(ctx, "modificarConducta") || hasTag(ctx, "mental"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Chelicer - Fe Inquebrantable: +${b} Compostura (resistir influencias).`);
    }
    if (hasTag(ctx, "usarVeneno")) {
      notes.push("Chelicer - Veneno Consagrado: usa venenos sin kit e inmune a autocontaminación (categoría escala cada 4 niveles).");
    }
    if (evtFlag(ctx, "dolorTriggerApplied")) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Chelicer - Transmutación del Dolor: +${b} Compostura/Tenacidad (temporal).`);
    }

    return { flat, diceAdvances: 0, notes };
  },
  event(evt, actor) {
    const notes = []; const changes = [];
    if (evt?.type === "onWound" || evt?.type === "onAlteration") {
      const { severity, alterations = [] } = evt.payload || {};
      const isGrave = severity === "grave" || severity === "critica";
      const hasPainOrBleed = (alterations || []).map(toLower).some((a) => ["dolor","sangrado"].includes(a));
      if (isGrave || hasPainOrBleed) {
        changes.push({ kind: "applyBuff", stats: { composure: +1, tenacity: +1 }, scalePer4: true, durationRounds: 1 });
        notes.push("Chelicer - Transmutación del Dolor: +1 (per4) a Compostura/Tenacidad hasta fin de la siguiente ronda.");
      }
    }
    return { changes, notes };
  },
};

/* ============ PANIN ============ */
S.panin = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Instinto Caótico → -3 Compostura (excepto Enfoque), -1/7
    if (matchesSkill(ctx, ["Compostura"]) && !matchesSkill(ctx, ["Enfoque"])) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Panin - Instinto Caótico: ${pen} Compostura (excepto Enfoque).`);
    }

    // Legados
    if (hasTag(ctx, "computeAguante")) {
      notes.push("Panin - Agilidad Superior: Aguante usa Agilidad (ajusta el cómputo de recursos).");
    }
    if (matchesSkill(ctx, ["Identificación","Interpretación"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Panin - Curiosidad: +${b} Identificación/Interpretación.`);
    }

    return { flat, diceAdvances: 0, notes };
  },
  passive() {
    return { notes: ["Panin - Adaptabilidad Innata: puede intercambiar 2 competencias iniciales (aprobación del narrador)."] };
  },
};

/* ============ LUPHRAN ============ */
S.luphran = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Caza Instintiva → si está en furia, -3 Enfoque durante 1d4 rondas, -1/7
    if (hasTag(ctx, "enFuriaFeral") && matchesSkill(ctx, ["Enfoque"])) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Luphran - Furia Feral: ${pen} Enfoque (temporal).`);
    }

    // Legados
    if (isRollType(ctx, "TC") && inSet(ctx?.characteristic, ["Sabiduría","Astucia"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Luphran - Lobo Solitario: +${b} TC (Sabiduría/Astucia).`);
    }
    if (matchesSkill(ctx, ["Supervivencia","Rastreo","Identificación","Percepción"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Luphran - Cazador: +${b} (rastreo/supervivencia/identificación/percepción).`);
      if (ctx?.allowAltCharacteristic) notes.push("Luphran - Cazador: puede usar Astucia como característica base.");
    }
    if (hasTag(ctx, "transformacionFeralActiva")) {
      const turns = Math.max(1, Number(ctx?.feralTurns || 1));
      // +turns a TC Fuerza/Agilidad; -turns a TC Sabiduría/Intelecto
      if (isRollType(ctx, "TC") && inSet(ctx?.characteristic, ["Fuerza","Agilidad"]))  { flat += turns; notes.push(`Luphran - Transformación Feral: +${turns} TC (Fuerza/Agilidad).`); }
      if (isRollType(ctx, "TC") && inSet(ctx?.characteristic, ["Sabiduría","Intelecto"])) { flat -= turns; notes.push(`Luphran - Transformación Feral: -${turns} TC (Sabiduría/Intelecto).`); }
    }

    return { flat, diceAdvances: 0, notes };
  },
  event(evt, actor) {
    const notes = []; const changes = [];
    if (evt?.type === "onWound") {
      const { severity } = evt.payload || {};
      if (severity === "grave" || severity === "critica") {
        changes.push({ kind: "forceCheck", rollType: "TR", skill: "Compostura", onFailApplyTag: "enFuriaFeral", durationRounds: "1d4" });
        notes.push("Luphran - Caza Instintiva: TR Compostura o entra en Furia Feral (penaliza Enfoque).");
      }
    }
    if (evt?.type === "toggleFeral") {
      notes.push("Luphran - Transformación Feral: activar/desactivar según reglas (prueba de Enfoque para salir).");
    }
    return { changes, notes };
  },
};

/* ============ URSARI ============ */
S.ursari = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Forja de Sangre → -3 Compostura en diplomacia/negociación/pacificar, -1/7
    if (matchesSkill(ctx, ["Compostura"]) && (hasTag(ctx, "diplomacia") || hasTag(ctx, "negociacion") || hasTag(ctx, "pacificar"))) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Ursari - Forja de Sangre: ${pen} Compostura (diplomacia/negociación/paz).`);
    }

    // Legados:
    if (evtFlag(ctx, "fervorActivo")) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Ursari - Fervor: +${b} a tiradas de resistencia/ataque según casos; terreno difícil a la mitad.`);
    }
    if (matchesAnySkillPrefix(ctx, ["Fabricación","Mantenimiento","Refinamiento"]) && (hasTag(ctx, "armas") || hasTag(ctx, "armaduras") || hasTag(ctx, "escudos"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Ursari - Artista Bélico: +${b} armas/armaduras/escudos.`);
    }
    if (isRollType(ctx, "TA") && evtFlag(ctx, "sedDeBatallaActiva")) {
      flat += 2; notes.push("Ursari - Sed de Batalla: +2 TA (temporal tras derribar a un enemigo).");
    }

    return { flat, diceAdvances: 0, notes };
  },
  event(evt, actor) {
    const notes = []; const changes = [];
    if (evt?.type === "onWound") {
      const { severity } = evt.payload || {};
      if (severity === "grave" || severity === "critica") {
        const tena = actor?.system?.attributes?.tenacity ?? 1;
        changes.push({ kind: "applyTag", tag: "fervorActivo", durationRounds: tena });
        notes.push(`Ursari - Fervor: activado (${tena} rondas).`);
      }
    }
    if (evt?.type === "onKill") {
      const tena = actor?.system?.attributes?.tenacity ?? 1;
      changes.push({ kind: "applyTag", tag: "sedDeBatallaActiva", durationRounds: tena });
      notes.push(`Ursari - Sed de Batalla: +2 TA durante ${tena} rondas.`);
    }
    return { changes, notes };
  },
};

/* ============ ARAKHEL ============ */
S.arakhel = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Temor al Fuego → TR vs fuego: -3, -1/7
    if (isRollType(ctx, "TR") && hasTag(ctx, "fuego")) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Arakhel - Temor al Fuego: ${pen} TR vs fuego.`);
    }

    // Legados
    if (matchesSkill(ctx, ["Sastrería"]) && hasTag(ctx, "seda")) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Arakhel - Seda: +${b} sastrería con seda Arakhel.`);
    }
    if (matchesSkill(ctx, ["Acrobacias","Destreza"]) || (isRollType(ctx, "TC") && toLower(ctx.characteristic) === "agilidad")) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Arakhel - Arácnido: +${b} acrobacias/destreza/TC-Agilidad.`);
    }
    if (matchesSkill(ctx, ["Intuición","Engaño"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Arakhel - Tejedores de Intrigas: +${b} Intuición/Engaño.`);
    }

    return { flat, diceAdvances: 0, notes };
  },
  event(evt) {
    const notes = []; const changes = [];
    if (evt?.type === "onStartOfWeek") {
      changes.push({ kind: "grantMaterial", material: "Seda Arakhel", amountKg: 2, gradeByLevel: true });
      notes.push("Arakhel - Seda: produces 2kg/semana (calidad por nivel).");
    }
    if (evt?.type === "onItemFireContact" && has(evt.payload, "sedaArakhel")) {
      changes.push({ kind: "doubleDurabilityDamage" });
      notes.push("Arakhel - Seda: daño de fuego a durabilidad se duplica.");
    }
    return { changes, notes };
  },
};

/* ============ BUFONI ============ */
S.bufoni = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Piel Permeable → -3 TR venenos de contacto, -1/7
    if (isRollType(ctx, "TR") && hasTag(ctx, "venenoContacto")) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Bufoni - Piel Permeable: ${pen} TR vs veneno de contacto.`);
    }

    // Legados
    if (hasTag(ctx, "usarLenguaPrensil")) notes.push("Bufoni - Lengua Prensil: manipulación/soporte sin triadas de Destreza finas.");
    if ((matchesSkill(ctx, ["Vigor","Acrobacias"]) && ctx?.allowAltCharacteristic)) {
      notes.push("Bufoni - Anfibio: puede usar Sabiduría como base (nado sin penalización si se cumplen condiciones).");
    }
    if (matchesSkill(ctx, ["Sigilo","Supervivencia"])) {
      const b = bonusPer4(lv) || 1; flat += b; notes.push(`Bufoni - Sombras del Pantano: +${b} Sigilo/Supervivencia.`);
    }

    return { flat, diceAdvances: 0, notes };
  },
};

/* ============ VESPER ============ */
S.vesper = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Debilidad Heredada → -3 Vigor, -1/7
    if (matchesSkill(ctx, ["Vigor"])) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Vesper - Debilidad Heredada: ${pen} Vigor.`);
    }

    // Legados
    if (isRollType(ctx, "TR") && (hasTag(ctx, "veneno") || hasTag(ctx, "infeccion"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Vesper - Sangre Alquímica: +${b} TR vs veneno/infecciones.`);
    }
    if (matchesSkill(ctx, ["Fabricación"]) && (hasTag(ctx, "alquimia") || hasTag(ctx, "anatomia"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Vesper - Síntesis: +${b} Fabricación (Alquimia/Anatomía).`);
    }
    if (matchesSkill(ctx, ["Anatomía","Medicina","Historia","Investigación","Negociación","Intimidación","Engaño"]) && hasTag(ctx, "muestraSangre")) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Vesper - Lectura Hematológica: +${b} (${ctx.skill}) con muestra de sangre.`);
    }

    return { flat, diceAdvances: 0, notes };
  },
  passive() {
    return { notes: ["Vesper - Salud base: 10 + Tenacidad (aplica en tu cálculo de PV)."] };
  },
};

/* ============ LAPINNI ============ */
S.lapinni = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Esencia Drenada → -3 TR maldiciones/tauma negativo, -1/7
    if (isRollType(ctx, "TR") && (hasTag(ctx, "maldicion") || hasTag(ctx, "taumaNegativo"))) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Lapinni - Esencia Drenada: ${pen} TR vs maldiciones/tauma adverso.`);
    }

    // Legados
    if (matchesSkill(ctx, ["Botánica","Alquimia"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Lapinni - Herbolarios: +${b} Botánica/Alquimia.`);
    }
    if (hasTag(ctx, "salto")) notes.push("Lapinni - Salto: doble distancia (sin impulso).");

    return { flat, diceAdvances: 0, notes };
  },
  event(evt, actor) {
    const notes = []; const changes = [];
    if (evt?.type === "onStartOfDay" && evt?.payload?.performResurrectionRitual) {
      const roll = evt?.payload?.ritualRoll || 1; // 1..4
      const b = bonusPer4(ensureLevelRef(actor, {}));
      switch (roll) {
        case 1: notes.push(`Lapinni - Memorias de Vidas Pasadas: +${b} TE de Saberes.`); break;
        case 2: notes.push(`Lapinni - Resonancia del Más Allá: +${b} Identificación/Interpretación/Percepción.`); break;
        case 3: notes.push(`Lapinni - Guardia de los Espíritus: +${b} Defensa y Resistencia vs Alteraciones.`); break;
        case 4: notes.push(`Lapinni - Presencia de las Sombras: +${b} Influencia y Sigilo todo el día.`); break;
      }
      changes.push({ kind: "applyDailyBuff", ritual: "LapinniResurrection", roll, scalePer4: true });
    }
    return { changes, notes };
  },
};

/* ============ ERIN ============ */
S.erin = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    if (hasTag(ctx, "computeAguante")) {
      notes.push("Erin - Metabolismo Acelerado: Aguante = (Vigor/3 + Tenacidad).");
    }
    if (matchesSkill(ctx, ["Supervivencia","Percepción","Geografía"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Erin - Superviviente: +${b} Supervivencia/Percepción/Geografía.`);
    }
    if (matchesSkill(ctx, ["Anatomía","Botánica","Sanación"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Erin - Maestría en la Naturaleza: +${b} Anatomía/Botánica/Sanación (puede usar Astucia).`);
    }

    return { flat, diceAdvances: 0, notes };
  },
  event(evt) {
    const notes = []; const changes = [];
    if (evt?.type === "consumeForFatigue") {
      if (evt?.payload?.kg >= 1 && !evt?.payload?.isMineral) {
        changes.push({ kind: "fatigueRecover", amount: 1, timeMinutes: 10 });
        notes.push("Erin - Devorador Insaciable: recuperas 1 nivel de fatiga tras consumir 1kg (10 min).");
      }
    }
    return { changes, notes };
  },
};

/* ============ MANTO ============ */
S.manto = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Degeneración Celular (se activa por evento onTRFail)
    if (evtFlag(ctx, "degeneracionActiva") && (isRollType(ctx, "TC") || isRollType(ctx, "TE")) && (hasTag(ctx, "fisica") || matchesSkill(ctx, ["Vigor","Acrobacias","Destreza"]))) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Manto - Degeneración Celular: ${pen} a T.C/T.E físicas (temporal).`);
    }

    // Legados
    if (hasTag(ctx, "transformacionElegida")) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Manto - Maestría en Transformación: +${b} a tarea elegida por 24h.`);
    }
    if (matchesSkill(ctx, ["Acrobacias","Destreza","Vigor"])) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Manto - Perfección Corporal: +${b} Acrobacias/Destreza/Vigor.`);
    }

    return { flat, diceAdvances: 0, notes };
  },
  event(evt, actor) {
    const notes = []; const changes = [];
    if (evt?.type === "onStartOfDay" && evt?.payload?.chooseTransformation) {
      const choice = evt?.payload?.choice || 1;
      changes.push({ kind: "applyDailyBuff", tag: "transformacionElegida", choice, scalePer4: true, durationHours: 24 });
      notes.push("Manto - Maestría en Transformación: beneficio aplicado por 24h.");
    }
    if (evt?.type === "consumeAdaptive") {
      const tena = actor?.system?.attributes?.tenacity ?? 1;
      changes.push({ kind: "amplifyBuff", tag: "transformacionElegida", factor: 2, durationRounds: tena });
      notes.push(`Manto - Consumo Adaptativo: duplicas el bono de transformación por ${tena} rondas.`);
    }
    if (evt?.type === "onTRFail") {
      changes.push({ kind: "forceCheck", rollType: "TE", skill: "Vigor", onFailApplyTag: "degeneracionActiva", durationTurns: 1 });
      notes.push("Manto - Degeneración Celular: chequeo de Vigor tras fallar TR (si falla, penalizador temporal).");
    }
    return { changes, notes };
  },
};

/* ============ TALPI ============ */
S.talpi = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    if (hasTag(ctx, "visionCheck")) notes.push("Talpi - Visión Limitada: rango 40m; sin penalización en baja luz.");

    if (matchesSkill(ctx, ["Supervivencia","Geología"]) && hasTag(ctx, "subterraneo")) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Talpi - Maestros Excavadores: +${b} en terrenos subterráneos.`);
    }
    if (matchesSkill(ctx, ["Percepción","Supervivencia"]) && (hasTag(ctx, "oscuridad") || hasTag(ctx, "rastreoOlfato"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Talpi - Olfato Prodigioso: +${b} (olfato/rastreo, incluso en oscuridad).`);
    }
    if (matchesSkill(ctx, ["Minería","Taumaturgia","Investigación"]) && (hasTag(ctx, "minerales") || hasTag(ctx, "gemas") || hasTag(ctx, "metales"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Talpi - Afinidad con los Minerales: +${b} búsqueda/examen de recursos.`);
    }

    return { flat, diceAdvances: 0, notes };
  },
  passive() {
    return { visionRangeMeters: 40, lowLightNoPenalty: true, notes: ["Talpi - Visión Limitada: 40m; sin penalización en baja luz."] };
  },
};

/* ============ MYO ============ */
S.myo = {
  roll(ctx, actor) {
    const lv = ensureLevelRef(actor, ctx);
    let flat = 0; const notes = [];

    // Herencia: Dependencia del Colectivo → si >10m de aliados, -3 a Compostura y Defensa, -1/7
    if ((matchesSkill(ctx, ["Compostura"]) || isRollType(ctx, "TD")) && (ctx?.distanceToAllies ?? 999) > 10) {
      const pen = -3 + penaltyStepPer7(lv); flat += pen;
      notes.push(`Myo - Dependencia del Colectivo: ${pen} (lejos de aliados >10m).`);
    }

    // Legados
    if (isRollType(ctx, "TR") && (hasTag(ctx, "veneno") || hasTag(ctx, "infeccion"))) {
      const b = bonusPer4(lv); flat += b; if (b) notes.push(`Myo - Resistencia a la Descomposición: +${b} TR.`);
    }
    if ((isRollType(ctx, "TA") || isRollType(ctx, "TD")) && (ctx?.alliesNearby ?? 0) > 0) {
      const b = Math.min(3, ctx.alliesNearby); flat += b; notes.push(`Myo - Instinto de Horda: +${b} ${ctx.rollType} (aliados ≤2m).`);
    }
    if (hasTag(ctx, "armaNaturalVsOrganico")) {
      notes.push("Myo - Aura de Decrepitud: Potencia x2 contra materiales orgánicos.");
    }

    return { flat, diceAdvances: 0, notes };
  },
  event(evt) {
    const notes = []; const changes = [];
    if (evt?.type === "dailyDecayCheck" && has(evt.payload, "organicoEnPosesion")) {
      changes.push({ kind: "durabilityLoss", amount: 1, scope: "allOrganicOwned" });
      notes.push("Myo - Aura de Decrepitud: -1 durabilidad diaria a materiales orgánicos en posesión.");
    }
    return { changes, notes };
  },
};

/* ===============================
 * API pública
 * =============================== */

/**
 * Devuelve los modificadores que aplican a una tirada para el actor según su especie y contexto.
 * @param {Actor} actor
 * @param {object} ctx - ver cabecera
 * @returns {{flat:number, diceAdvances:number, notes:string[]}}
 */
export function getRollModifiersForActor(actor, ctx = {}) {
  const speciesKey = toLower(actor?.system?.species?.key || actor?.system?.species || "");
  const entry = S[speciesKey];
  if (!entry || typeof entry.roll !== "function") return { flat: 0, diceAdvances: 0, notes: [] };
  return entry.roll(ctx, actor) || { flat: 0, diceAdvances: 0, notes: [] };
}

/**
 * Procesa un evento/gatillo no directamente de tirada (herida, matar, inicio de día/semana, etc.)
 * @param {Actor} actor
 * @param {{type:string, payload?:any, tags?:string[]}} evt
 * @returns {{changes:any[], notes:string[]}}
 */
export function processEventForActor(actor, evt = {}) {
  const speciesKey = toLower(actor?.system?.species?.key || actor?.system?.species || "");
  const entry = S[speciesKey];
  if (!entry || typeof entry.event !== "function") return { changes: [], notes: [] };
  return entry.event(evt, actor) || { changes: [], notes: [] };
}

/**
 * Información pasiva/estática (rango de visión, ajustes de armadura, learning advantage, etc.)
 * @param {Actor} actor
 * @returns {{[key:string]:any, notes:string[]}}
 */
export function getPassiveForActor(actor) {
  const speciesKey = toLower(actor?.system?.species?.key || actor?.system?.species || "");
  const entry = S[speciesKey];
  if (!entry || typeof entry.passive !== "function") return { notes: [] };
  return entry.passive(actor) || { notes: [] };
}

/**
 * Suma los modificadores de especie a un objeto de tirada ya construido.
 * @param {Actor} actor
 * @param {{total:number, diceAdvances?:number, notes?:string[]}} roll
 * @param {object} ctx
 */
export function applySpeciesToRoll(actor, roll, ctx = {}) {
  const { flat, diceAdvances, notes } = getRollModifiersForActor(actor, ctx);
  if (typeof roll.total === "number") roll.total += flat;
  roll.diceAdvances = (roll.diceAdvances || 0) + (diceAdvances || 0);
  if (!Array.isArray(roll.notes)) roll.notes = [];
  if (notes?.length) roll.notes.push(...notes);
}
