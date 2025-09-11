// modules/features/synapse/index.js
import { getCategoryForSpec } from "../specializations/index.js";

// Mapa de categorías → atributos disponibles para gastar sinapsis
export const ATTRS_BY_CATEGORY = {
  physical:  ["strength", "agility", "tenacity"],
  mental:    ["intellect", "wisdom", "cunning"],
  social:    ["presence", "composure", "aura"],
  arts:      ["intellect", "wisdom", "cunning"],
  knowledge: ["intellect", "wisdom", "cunning"],
};

export function recomputeSynapseBudget(actor) {
  const prog = actor.system?.progression?.skills ?? {};
  const sumByCat = { physical:0, mental:0, social:0, arts:0, knowledge:0 };

  for (const [key, node] of Object.entries(prog)) {
    const has = Number(node?.level ?? 0) > 0 || Number(node?.rank ?? 0) > 0;
    if (!has) continue;

    // toma categoría real del catálogo; si no, lo que ya esté guardado
    const cat = getCategoryForSpec(key) || node?.category;
    if (cat && (cat in sumByCat)) sumByCat[cat] += 1;
  }

  return sumByCat; 
}

/**
 * Aplica la sinapsis (asignaciones de +1 a atributos) y las persiste.
 * allocations: { strength:1, agility:2, ... }  (solo +1 por “punto”)
 */
export async function applySynapseAllocations(actor, allocations) {
  if (!actor || !allocations) return;

  const patch = {};
  const base = actor.system?.attributes ?? {};
  const applied = {};

  for (const [attr, incRaw] of Object.entries(allocations)) {
    const inc = Math.max(0, (Number(incRaw) || 0) | 0);
    if (!inc) continue;
    const cur = Number(base[attr] ?? 0);
    patch[`system.attributes.${attr}`] = cur + inc;
    applied[attr] = inc;
  }

  patch["system.synapse.allocations"] = {
    ...(actor.system?.synapse?.allocations ?? {}),
    ...applied
  };

  await actor.update(patch);
}
