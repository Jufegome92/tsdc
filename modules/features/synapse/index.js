// modules/features/synapse/index.js
import { listSpecs, getCategoryForSpec } from "../specializations/index.js";

export function recomputeSynapseBudget(actor) {
  const prog = actor.system?.progression?.skills ?? {};
  const sumByCat = { physical:0, mental:0, social:0, arts:0, knowledge:0 };

  for (const [key, s] of Object.entries(prog)) {
    const cat = getCategoryForSpec(key) || s?.category;
    if (!cat || !(cat in sumByCat)) continue;
    sumByCat[cat] += Number(s?.rank || 0);
  }

  // +1 por Vigor base (categoría Física)
  sumByCat.physical += 1;

  return sumByCat;
}
