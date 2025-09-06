// tsdc/modules/rolls/engine.js
import { applySpeciesToRoll } from "../features/species/effects.js";

/**
 * makeRollTotal: punto de entrada para "post-procesar" cualquier total.
 * - actor: el Actor que tira
 * - baseTotal: el total crudo que devuelve resolveEvolution()
 * - ctx: contexto mínimo para que species/effects pueda decidir (tipo de tirada, skill, tags, etc.)
 *
 * Devuelve un objeto { total, diceAdvances, notes } que sustituye/acompaña al resultRoll original.
 */
export function makeRollTotal(actor, baseTotal, ctx = {}) {
  const roll = {
    total: Number(baseTotal || 0),
    diceAdvances: 0,      // si alguna especie concede avances de dado
    notes: [],            // mensajes informativos a la carta/log
    tags: new Set(ctx?.tags || []),
  };

  // 1) Aplicar Especie (herencia/legados y bonificadores lineales/situacionales)
  applySpeciesToRoll(actor, roll, ctx);

  // 2) (Futuro) Otros módulos que quieras encadenar: estados, equipo, auras, etc.

  // Normalizar y devolver
  roll.total = Math.round(roll.total); // por si acaso
  return roll;
}

/* =========================
   SISTEMA DE HERIDAS (NPC→PJ)
   ========================= */

/** Tabla humanoide d100. Puedes cambiar por especie/anatomía con ctx.table si hace falta */
const HUMANOID_HIT_TABLE = [
  { min: 1,  max: 10,  loc: "head" },
  { min: 11, max: 45,  loc: "torso" },
  { min: 46, max: 60,  loc: "arm-main" },
  { min: 61, max: 75,  loc: "arm-off" },
  { min: 76, max: 85,  loc: "leg-main" },
  { min: 86, max: 95,  loc: "leg-off" },
  { min: 96, max: 100, loc: "special" }
];

/** d100 → localización (puedes inyectar otra tabla por ctx.table) */
export function rollHitLocation(d100, ctx = {}) {
  const table = ctx?.table ?? HUMANOID_HIT_TABLE;
  const v = Number(d100 ?? (Math.floor(Math.random() * 100) + 1));
  const row = table.find(r => v >= r.min && v <= r.max) ?? table[0];
  return { value: v, location: row.loc };
}

/**
 * computeBlock: BC+BM+CD+CO
 * - armor: { category: "light|medium|heavy", durability, quality, compLevel }
 * - category base: light=2, medium=4, heavy=6
 * - BM = Math.floor(durability/5)
 */
export function computeBlock(armor = {}) {
  const cat = String(armor?.category || "light");
  const BC = (cat === "heavy") ? 6 : (cat === "medium") ? 4 : 2;
  const BM = Math.floor(Number(armor?.durability || 0) / 5);
  const CD = Number(armor?.compLevel || 0);
  const CO = Number(armor?.quality || 0); // +1..+3 (si usas esa escala)
  return Math.max(0, BC + BM + CD + CO);
}

/**
 * resolveWoundSystem
 * Entrada mínima:
 *  - impact: número (resultado T.I. del atacante, tras aplicar lo que toque)
 *  - block: número (computeBlock de la localización)
 *  - multipliers: { x1, x2, x3 } umbrales relativos para severidad (puedes usar defaults)
 *  - damageType: "slash|pierce|blunt|element:fire|element:wind|..." para mapear agravios
 *  - hitLoc: string ("head","torso"...)
 *
 * Devuelve: { severity: "none|light|grave|critical", ailments: [ids], notes: [] }
 */
export function resolveWoundSystem({ impact, block, multipliers, damageType, hitLoc }) {
  const x1 = multipliers?.x1 ?? 1.0;
  const x2 = multipliers?.x2 ?? 2.0;
  const x3 = multipliers?.x3 ?? 3.0;

  const ratio = (block > 0) ? (impact / block) : Infinity;

  let severity = "none";
  if (ratio >= x3) severity = "critical";
  else if (ratio >= x2) severity = "grave";
  else if (ratio > 1.0 /* >= x1 y < x2 */) severity = "light";

  const ailments = [];
  if (severity !== "none") {
    // Mapea tipo de daño → agravio base
    if (damageType === "slash") ailments.push("bleeding");
    else if (damageType === "pierce") ailments.push("traumatic-infection");
    else if (damageType === "blunt") ailments.push("fracture");
    else if ((damageType || "").startsWith("element:")) {
      const el = damageType.split(":")[1];
      if (el === "fire") ailments.push("tauma-burn");
      else if (el === "wind") ailments.push("pressure-laceration");
      else if (el === "earth") ailments.push("tauma-crush");
      else if (el === "water") ailments.push("tauma-freeze-or-saturation");
      else if (el === "light") ailments.push("nervous-overload");
      else if (el === "dark") ailments.push("sensory-devour");
    }
  }

  const notes = [`Impact=${impact} vs Bloqueo=${block} ⇒ severidad=${severity} @${hitLoc}`];
  return { severity, ailments, notes };
}

/* ======================================
   SISTEMA DE PS PARA CRIATURAS (Jugador→NPC)
   ====================================== */

/**
 * resolveHPSystem (stub)
 * - damage: número (T.I. - mitigación)
 * - part: la parte del monstruo (ej. "head", "right-arm") con sus PS y RD
 * - Devuelve nuevo estado de esa parte.
 */
export function resolveHPSystem({ damage, part }) {
  const rd = Number(part?.reduction || 0);
  const net = Math.max(0, Number(damage || 0) - rd);
  const hp = Math.max(0, Number(part?.hp || 0) - net);
  const destroyed = (hp <= 0);
  return {
    ...part,
    hp,
    lastDamage: net,
    destroyed,
    notes: [`Daño=${damage} (RD=${rd}) → ${net} aplicado; HP ${part?.hp} → ${hp}`]
  };
}
