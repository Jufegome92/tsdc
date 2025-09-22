// tsdc/modules/rolls/engine.js
import { applySpeciesToRoll } from "../features/species/effects.js";
import { applyAtbModsToRoll } from "../atb/mods.js";
import * as Ail from "../ailments/index.js";

/* =========================
   Normalización de tags
   ========================= */
function normalizeTags(tags) {
  if (!Array.isArray(tags)) return [];
  const out = Array.from(new Set(tags.map(t => String(t).trim()).filter(Boolean)));
  out.sort((a, b) => a.localeCompare(b));
  return out;
}

/* =========================
   Buckets / Orígenes
   ========================= */
const ORIGINS = /** @type {const} */ ([
  "species",         // especie
  "maneuver",        // maniobra
  "object",          // objeto/artefacto/consumible
  "specialization",  // especialización / habilidad de especialización
  "equipment",       // pieza de equipo (armas/armaduras)
  "shield",          // excepción: escudo suma aparte del equipment
  "state"
]);

function bucketFor(mod) {
  let bucket = mod.sourceType;
  if (bucket === "equipment" && mod.meta?.equipmentSlot === "shield") {
    bucket = "shield";
  }
  if (!ORIGINS.includes(bucket)) bucket = "object";
  return bucket;
}

function appliesToContext(mod, ctx) {
  const w = mod.when || {};
  if (w.phases?.length && !w.phases.includes(ctx.phase)) return false;

  const tags = ctx.tags;
  if (w.anyTags?.length) {
    if (!w.anyTags.some(t => tags.includes(t))) return false;
  }
  if (w.allTags?.length) {
    if (!w.allTags.every(t => tags.includes(t))) return false;
  }
  if (w.notTags?.length) {
    if (!w.notTags.every(t => !tags.includes(t))) return false;
  }
  if (w.attackKind && ctx.attackKind && w.attackKind !== ctx.attackKind) return false;
  if (w.resType && ctx.resType && w.resType !== ctx.resType) return false;

  return true;
}

function pickWinnerByMagnitude(mods) {
  if (!mods.length) return null;
  const sorted = [...mods].sort((a, b) => {
    const ma = Math.abs(a.value), mb = Math.abs(b.value);
    if (mb !== ma) return mb - ma;
    return b.value - a.value; // a igualdad de magnitud, prefiere el mayor positivo
  });
  return sorted[0];
}

/* =========================
   Colector/Agrupador de modificadores
   ========================= */
function aggregateModifiers(ctx, extraCandidates = []) {
  const candidates = [];

  // 1) Candidatos “extra” (ej. especie simulada, ver makeRollTotal)
  for (const c of extraCandidates) {
    const m = { label: "Mod", sourceType: "object", ...c };
    if (appliesToContext(m, ctx)) candidates.push(m);
  }

  // 2) Hook público para que ítems/estados/auras empujen mods
  try {
    if (globalThis.Hooks?.callAll) {
      globalThis.Hooks.callAll("tsdc:collectModifiers", ctx, (mod) => {
        if (!mod || typeof mod.value !== "number") return;
        const m = { label: "Mod", sourceType: "object", ...mod };
        if (appliesToContext(m, ctx)) candidates.push(m);
      });
    }
  } catch (err) {
    console.warn("[tsdc] collectModifiers hook error:", err);
  }

  // 3) Agrupar por origen/bucket y elegir 1 por grupo
  const byBucket = new Map();
  for (const c of candidates) {
    const b = bucketFor(c);
    if (!byBucket.has(b)) byBucket.set(b, []);
    byBucket.get(b).push(c);
  }

  const buckets = [];
  let modsTotal = 0;

  for (const bucket of ORIGINS) {
    const list = byBucket.get(bucket) ?? [];
    const chosen = pickWinnerByMagnitude(list);
    const dropped = list.filter(x => x !== chosen);

    const val = chosen ? Number(chosen.value ?? chosen.amount ?? 0) : 0;
    modsTotal += val;

    buckets.push({
      bucket,
      chosen: chosen
        ? {
            id: chosen.id ?? null,
            label: chosen.label ?? bucket,
            value: val,
            amount: val,
            itemId: chosen.itemId ?? null,
            reason: chosen.reason ?? null,
            tags: chosen.tags ?? null
          }
        : null,
      dropped: dropped.map(d => ({
        id: d.id ?? null,
        label: d.label ?? bucket,
        value: Number(d.value ?? d.amount ?? 0),
        amount: Number(d.value ?? d.amount ?? 0),
        itemId: d.itemId ?? null,
        reason: d.reason ?? null,
        tags: d.tags ?? null
      }))
    });
  }

  return { buckets, modsTotal, candidatesCount: candidates.length };
}

/* =========================
   makeRollTotal (actualizado)
   ========================= */
/**
 * makeRollTotal: punto de entrada para "post-procesar" cualquier total.
 * - actor: Actor que tira
 * - baseTotal: número crudo (p.ej. devuelto por resolveEvolution)
 * - ctx: { phase, tag, tags, weaponKey, resType, ... }
 *
 * Devuelve { total, diceAdvances, notes, breakdown }
 * breakdown incluye: { phase, tag, base, tags, buckets, modsTotal, candidatesCount, total }
 */
export function makeRollTotal(actor, baseTotal, ctx = {}) {
  const phase = ctx?.phase ?? "generic";
  const tag   = ctx?.tag ?? "GEN";

  // 1) Tags base normalizados (Array) y Set para compat con species
  const inputTags = normalizeTags(ctx?.tags ?? []);
  const tagSetForSpecies = new Set(inputTags);

  // 2) Simular especie como “candidato”
  //    — No sumamos directo; calculamos delta y lo metemos como bucket species,
  //      así respeta la regla “1 por origen” junto a otros aportes species (si los hay).
  const base = Math.round(Number(baseTotal || 0));
  const speciesProbe = { total: base, diceAdvances: 0, notes: [], tags: tagSetForSpecies };

  try {
    applySpeciesToRoll(actor, speciesProbe, { ...ctx, tags: Array.from(tagSetForSpecies) });
  } catch (err) {
    console.warn("[tsdc] applySpeciesToRoll error:", err);
  }

  try { applyAtbModsToRoll(actor, speciesProbe, ctx); } catch (_) {}
  
  const speciesDelta = Math.round(Number(speciesProbe.total || base) - base);
  const speciesDiceAdv = Number(speciesProbe.diceAdvances || 0);
  // Tags finales después de especie (por si la especie añade/quita condiciones contextuales)
  const tags = normalizeTags(Array.from(speciesProbe.tags ?? tagSetForSpecies));

  // Derivar attackKind a partir de tags conocidos (útil para reglas contextuales)
  const attackKind =
    tags.includes("attack:melee") ? "melee" :
    tags.includes("attack:ranged") ? "ranged" :
    tags.includes("attack:naturalRanged") ? "naturalRanged" : null;

  // 3) Armar contexto para colectores
  const aggCtx = {
    actor,
    phase,
    tag,
    tags,
    weaponKey: ctx?.weaponKey ?? null,
    resType: ctx?.resType ?? null,
    attackKind
  };

  // 4) Preparar candidatos extras (especie ya simulada)
  const extraCandidates = [{
    id: "species:auto",
    label: speciesDelta >= 0 ? "Especie" : "Especie (penalizador)",
    value: speciesDelta,
    sourceType: "species",
    when: { phases: [phase] }
  }];

  // 5) Agregar y seleccionar por buckets
  const { buckets, modsTotal, candidatesCount } = aggregateModifiers(aggCtx, extraCandidates);

  // 6) Total final: base + suma de elegidos
  const finalTotal = base + modsTotal;

  // 7) Notas combinadas (las de especie + detalle de elegidos)
  const notes = [];
  for (const n of (speciesProbe.notes || [])) notes.push(n);
  for (const b of buckets) {
    if (b.chosen) {
      const sign = b.chosen.value >= 0 ? "+" : "";
      notes.push(`${sign}${b.chosen.value} (${b.bucket}: ${b.chosen.label})`);
    }
  }

  const breakdown = {
    phase,
    tag,
    base,
    tags,
    buckets,
    modsTotal,
    candidatesCount,
    total: finalTotal
  };

  // ← construye el “out”, aplica Ailments, y luego devuelve
  const out = {
    total: finalTotal,
    diceAdvances: speciesDiceAdv,
    notes,
    breakdown
  };
  // IMPORTANTE: pasa tags ya normalizados (no los de entrada)
  applyAilmentsToRoll(actor, out, { phase, tag, tags });
  return out;
}

/* =========================
   SISTEMA DE HERIDAS (NPC→PJ)
   ========================= */

// Tabla humanoide d100. Puedes cambiar por especie/anatomía con ctx.table si hace falta
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
  const CO = Number(armor?.quality || 0); // +1..+3
  return Math.max(0, BC + BM + CD + CO);
}

/**
 * resolveWoundSystem
 * Entrada mínima:
 *  - impact: número (resultado T.I. del atacante)
 *  - block: número (computeBlock de la localización)
 *  - multipliers: { x1, x2, x3 } (por defecto 1/2/3)
 *  - damageType: "slash|pierce|blunt|element:fire|element:wind|..." (para agravio base)
 *  - hitLoc: string ("head","torso"...)
 */
export function resolveWoundSystem({ impact, block, multipliers, damageType, hitLoc }) {
  const x1 = multipliers?.x1 ?? 1.0;
  const x2 = multipliers?.x2 ?? 2.0;
  const x3 = multipliers?.x3 ?? 3.0;

  const ratio = (block > 0) ? (impact / block) : Infinity;

  let severity = "none";
  if (ratio >= x3) severity = "critical";
  else if (ratio >= x2) severity = "grave";
  else if (ratio > 1.0) severity = "light";

  const ailments = [];
  if (severity !== "none") {
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

/* =========================
   SISTEMA DE PS (Jugador→NPC)
   ========================= */
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

function applyAilmentsToRoll(actor, roll, ctx) {
  try {
    const active = (Ail && typeof Ail.getActive === "function") ? Ail.getActive(actor) : {};
    if (!active) return;

    // DERRIBADO: -2 a T.D. y (nota) rivales con avance de dado
    if (active["DERRIBADO"]) {
      if (ctx?.phase === "defense") {
        roll.total = Number(roll.total || 0) - 2;
        roll.breakdown = roll.breakdown || { parts: [], tags: [], source: [] };
        roll.breakdown.parts.push({ label: "Derribado", value: -2, note: "-2 T.D." });
        roll.breakdown.source.push({ kind: "ailment", value: -2, notes: ["DERRIBADO"] });
      }
      // Si quieres también encender una “señal” para ventaja de rivales,
      // puedes añadir una nota/tag aquí y leerla en tu lógica de ventaja.
      // p.ej.: roll.notes = [...(roll.notes||[]), "oponentes: avance de dado contra ti"];
    }

    // Aquí podrías mapear otros Ailments → penalizadores o tags
  } catch(e) { console.error("Ailment roll mod failed", e); }
}
