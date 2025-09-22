// modules/monsters/loader.js
import { migrateBlueprintIfNeeded } from "./migrations.js";
import { validateBlueprint } from "./schema.js";

let _cacheIndex = null;
let _cacheSummaries = null;

const BASE = "systems/tsdc/data";

export async function loadMonsterIndex() {
  if (_cacheIndex) return _cacheIndex;
  const res = await fetch(`${BASE}/monsters/index.json`);
  if (!res.ok) throw new Error(`No se pudo cargar index.json de monstruos (${res.status})`);
  const idx = await res.json(); // { key: "monsters/<file>.json" }
  _cacheIndex = idx;
  return idx;
}

export async function getBlueprintByKey(key) {
  const idx = await loadMonsterIndex();
  const path = idx[key];
  if (!path) throw new Error(`Monster key not found: ${key}`);
  const res = await fetch(`${BASE}/${path}`);
  if (!res.ok) throw new Error(`No se pudo cargar blueprint "${key}" (${res.status})`);
  const raw = await res.json();
  const bp = migrateBlueprintIfNeeded({ ...raw });
  validateBlueprint(bp);
  return bp;
}

/** Carga metadata ligera de todos (label, tags, level, category) para el selector */
export async function listMonsterSummaries() {
  if (_cacheSummaries) return _cacheSummaries;
  const idx = await loadMonsterIndex();
  const keys = Object.keys(idx);
  const out = [];
  for (const k of keys) {
    try {
      const bp = await getBlueprintByKey(k);
      out.push({
        key: bp.key || k,
        label: bp.label || k,
        tags: bp.tags || [],
        level: bp.level ?? 1,
        category: bp.category || "common",
      });
    } catch (e) {
      console.warn("TSDC | fallo al leer blueprint:", k, e);
    }
  }
  _cacheSummaries = out.sort((a,b) => a.label.localeCompare(b.label));
  return _cacheSummaries;
}
