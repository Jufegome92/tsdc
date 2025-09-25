// modules/monsters/factory.js
import { getBlueprintByKey } from "./loader.js";
import { normalizeAttributes } from "../features/attributes/index.js";
import { levelToRank } from "../progression.js";
import { materialDurability, materialPotency } from "../features/materials/index.js";
import { getMonsterAbility } from "../features/abilities/data.js";

const RESISTANCE_KEYS = [
  "poison", "infection", "affliction", "curse", "alteration",
  "water", "fire", "earth", "air", "light", "dark"
];

const META_KEYS = new Set(["level", "rank", "progress", "fails", "category", "notes"]);

const { deepClone, slugify } = foundry.utils;

function defaultQualityFromLevel(level) {
  const lvl = Math.max(1, Number(level || 1));
  return Math.max(1, Math.ceil(lvl / 3));
}

function normalizeParts(parts) {
  if (!parts) return [];
  const arr = Array.isArray(parts) ? parts : [parts];
  return Array.from(new Set(arr.map(p => String(p || "").trim().toLowerCase()).filter(Boolean)));
}

function inferPartsFromAttack(atk) {
  const text = `${atk?.weaponKey ?? ""} ${atk?.label ?? ""}`.toLowerCase();
  if (/mord|bite|colm|fang|jaw|pico|beak|aliento|breath|tromp/.test(text)) return ["head"];
  if (/garr|claw|manot|hand|punch|fist/.test(text)) return ["bracers"];
  if (/ala|wing/.test(text)) return ["bracers"];
  if (/cola|tail/.test(text)) return ["chest"];
  if (/pata|kick|patada|hoof|leg|pezu\u00f1|talon/.test(text)) return ["legs"];
  if (/espin|spike|p\u00faa|aguij|sting/.test(text)) return ["chest"];
  return [];
}

function inferPartsFromAbility(ability) {
  const text = `${ability?.label ?? ability?.itemKey ?? ""}`.toLowerCase();
  if (/aliento|grito|rug|aull|canto|voz|mord|bite|colm/.test(text)) return ["head"];
  if (/golpe|pu\u00f1|garra|brazo|cola/.test(text)) return ["bracers"];
  if (/salto|patada|pata/.test(text)) return ["legs"];
  return [];
}

function safeMaterialDurability(materialKey, quality, fallback = 10) {
  try {
    const val = materialDurability(materialKey, quality);
    return Number.isFinite(val) && val > 0 ? Number(val) : fallback;
  } catch (err) {
    console.warn("TSDC | materialDurability fallback", materialKey, quality, err);
    return fallback;
  }
}

function safeMaterialPotency(materialKey, quality, fallback = 0) {
  try {
    const val = materialPotency(materialKey, quality);
    return Number.isFinite(val) ? Number(val) : fallback;
  } catch (err) {
    console.warn("TSDC | materialPotency fallback", materialKey, quality, err);
    return fallback;
  }
}

export function buildHealthPartsFromAnatomy(anatomy = {}, { level = 1 } = {}) {
  const result = {};
  const parts = Object.entries(anatomy);
  const qualityFallback = defaultQualityFromLevel(level);
  for (const [key, node] of parts) {
    const materialKey = node?.materialKey ?? node?.material ?? null;
    const quality = Number(node?.quality ?? qualityFallback);
    const durability = safeMaterialDurability(materialKey, quality, 12);
    const potency = safeMaterialPotency(materialKey, quality, 0);
    result[key] = {
      label: key,
      material: materialKey,
      category: node?.category ?? null,
      quality,
      max: durability,
      value: durability,
      potency
    };
  }
  return result;
}

function buildNaturalWeaponRecords(blueprint, actorPatchLevel) {
  const level = toNumber(blueprint?.level, actorPatchLevel ?? 1);
  const qualityFallback = defaultQualityFromLevel(level);

  return (blueprint?.attacks ?? []).map((atk, idx) => {
    const key = String(atk.weaponKey || atk.key || `attack_${idx}`).toLowerCase();
    const inferredParts = inferPartsFromAttack(atk);
    const record = {
      id: key,
      key,
      label: atk.label || key,
      type: atk.type || "natural",
      damageDie: atk.damageDie || null,
      grade: toNumber(atk.grade, 1),
      traits: Array.isArray(atk.traits) ? [...new Set(atk.traits)] : [],
      material: atk.materialKey || atk.material || (atk.weaponKey ?? null),
      quality: toNumber(atk.quality, qualityFallback),
      family: atk.family || atk.weaponFamily || null,
      requiresParts: normalizeParts(atk.requiresParts || atk.requiresPart || atk.requires) || []
    };

    if (!record.requiresParts.length && inferredParts.length) record.requiresParts = inferredParts;

    if (atk.powerPerRank != null) record.powerPerRank = Number(atk.powerPerRank);
    if (atk.durabilityPerRank != null) record.durabilityPerRank = Number(atk.durabilityPerRank);
    if (atk.notes) record.notes = atk.notes;
    if (atk.effectId) record.effectId = atk.effectId;
    if (atk.attackAttr) record.attackAttr = atk.attackAttr;
    if (atk.impactAttr) record.impactAttr = atk.impactAttr;

    return record;
  });
}

function toNumber(val, fallback = 0) {
  const n = Number(val);
  return Number.isFinite(n) ? n : fallback;
}

function createTrackNode(value) {
  if (typeof value === "number") {
    const level = toNumber(value);
    return { level, rank: levelToRank(level), progress: 0, fails: 0 };
  }
  if (value && typeof value === "object") {
    const level = toNumber(value.level);
    const node = {
      level,
      rank: levelToRank(level),
      progress: toNumber(value.progress),
      fails: toNumber(value.fails)
    };
    if (value.category != null) node.category = value.category;
    if (value.notes != null) node.notes = value.notes;
    return node;
  }
  return { level: 0, rank: 0, progress: 0, fails: 0 };
}

function isTrackNodeCandidate(data) {
  if (!data || typeof data !== "object") return false;
  const keys = Object.keys(data);
  if (!keys.length) return false;
  return keys.every(k => META_KEYS.has(k));
}

function applySimpleGroup(buffers, group, data, { defaultKey = null } = {}) {
  const assigned = new Set();
  if (!data) return assigned;

  const target = buffers[group] ||= {};

  if (isTrackNodeCandidate(data) && (defaultKey || !Object.keys(target).length)) {
    const key = defaultKey ?? group;
    target[key] = createTrackNode(data);
    assigned.add(key);
    return assigned;
  }

  for (const [key, value] of Object.entries(data)) {
    if (META_KEYS.has(key)) continue;
    if (value == null) continue;
    target[key] = createTrackNode(value);
    assigned.add(key);
  }
  return assigned;
}

function resolveWeaponKey(attack, idx) {
  if (!attack) return null;
  if (attack.weaponKey) return attack.weaponKey;
  if (attack.key) return attack.key;
  if (attack.label) return slugify(String(attack.label), { replacement: "_" });
  return `attack_${idx}`;
}

function buildProgressionPatch(blueprint) {
  const buffers = {};
  const progression = blueprint?.progression ?? {};

  applySimpleGroup(buffers, "skills", progression.skills);
  applySimpleGroup(buffers, "maneuvers", progression.maneuvers);
  applySimpleGroup(buffers, "aptitudes", progression.aptitudes);
  applySimpleGroup(buffers, "relics", progression.relics);
  applySimpleGroup(buffers, "armor", progression.armor);

  const defenseAssigned = applySimpleGroup(buffers, "defense", progression.defense, { defaultKey: "evasion" });
  if (!defenseAssigned.size && progression.defense?.level != null) {
    (buffers.defense ||= {}).evasion = createTrackNode(progression.defense.level);
  }

  const resData = progression.resistances ?? progression.resistance;
  if (resData) {
    const target = buffers.resistances ||= {};

    const explicit = new Set();

    if (Array.isArray(resData)) {
      for (const entry of resData) {
        if (!entry?.key) continue;
        target[entry.key] = createTrackNode(entry);
        explicit.add(entry.key);
      }
    } else {
      for (const [key, value] of Object.entries(resData)) {
        if (key === "byType" || META_KEYS.has(key)) continue;
        target[key] = createTrackNode(value);
        explicit.add(key);
      }

      if (resData.byType && typeof resData.byType === "object") {
        for (const [key, value] of Object.entries(resData.byType)) {
          target[key] = createTrackNode(value);
          explicit.add(key);
        }
      }
    }

    if (resData.level != null) {
      for (const key of RESISTANCE_KEYS) {
        if (explicit.has(key)) continue;
        target[key] = createTrackNode(resData.level);
      }
    }
  }

  const weaponsAssigned = applySimpleGroup(buffers, "weapons", progression.weapons);

  const attackData = progression.attack;
  if (attackData) {
    const target = buffers.weapons ||= {};
    const assigned = new Set([...weaponsAssigned, ...Object.keys(target)]);

    const byWeapon = attackData.byWeapon || attackData.weapons;
    if (byWeapon && typeof byWeapon === "object") {
      for (const [key, value] of Object.entries(byWeapon)) {
        if (!key) continue;
        target[key] = createTrackNode(value);
        assigned.add(key);
      }
    }

    if (attackData.level != null) {
      if (Array.isArray(blueprint.attacks) && blueprint.attacks.length) {
        blueprint.attacks.forEach((atk, idx) => {
          const key = resolveWeaponKey(atk, idx);
          if (!key || assigned.has(key)) return;
          target[key] = createTrackNode(attackData.level);
          assigned.add(key);
        });
      } else if (!assigned.size) {
        target.natural = createTrackNode(attackData.level);
      }
    }
  }

  const patch = {};
  for (const [group, data] of Object.entries(buffers)) {
    if (!data || !Object.keys(data).length) continue;
    patch[`system.progression.${group}`] = data;
  }
  return patch;
}

export async function applyMonsterBlueprint(actor, blueprintOrKey, options = {}) {
  if (!actor) throw new Error("applyMonsterBlueprint requiere un actor");

  let blueprint = blueprintOrKey;
  if (!blueprint || typeof blueprint === "string") {
    blueprint = await getBlueprintByKey(String(blueprintOrKey));
  }
  if (!blueprint) throw new Error("Blueprint de criatura inválido");

  const {
    traits = [],
    folderId = undefined,
    name = undefined
  } = options;

  const attr = normalizeAttributes(blueprint.attributes || {});
  const tags = Array.isArray(blueprint.tags) ? [...blueprint.tags] : [];
  const naturalWeapons = buildNaturalWeaponRecords(blueprint, toNumber(blueprint.level, actor.system?.level ?? 1));
  const anatomy = deepClone(blueprint.anatomy || {});
  const level = toNumber(blueprint.level, actor.system?.level ?? 1);
  const healthParts = buildHealthPartsFromAnatomy(anatomy, { level });

  const patch = {
    "system.level": level,
    "system.attributes": attr,
    "system.anatomy": anatomy,
    "system.loot": deepClone(blueprint.loot || {}),
    "system.creature": {
      key: blueprint.key,
      label: blueprint.label || blueprint.key,
      category: blueprint.category ?? "",
      size: blueprint.size ?? "",
      nature: blueprint.nature ?? "",
      version: blueprint.version ?? 1,
      tags,
      source: blueprint.source ?? null
    },
    "system.traits.monster": traits,
    "system.tags": tags,
    "system.species": {
      key: `monster:${blueprint.key}`,
      label: blueprint.label || blueprint.key,
      size: blueprint.size ?? "",
      speed: toNumber(blueprint.speed, actor.system?.species?.speed ?? 0),
      languages: Array.isArray(blueprint.languages) ? [...blueprint.languages] : []
    },
    "system.background.key": "monster",
    "system.background.label": "Criatura",
    "system.progression.affinityMajor": null,
    "flags.tsdc.monsterKey": blueprint.key,
    "flags.tsdc.monsterVer": blueprint.version ?? 1,
    "flags.tsdc.naturalWeapons": naturalWeapons,
    "flags.tsdc.built": true
  };

  if (folderId !== undefined) {
    patch.folder = folderId || null;
  }

  if (name) {
    patch.name = name;
  } else if (!actor.name || actor.name === actor.prototypeToken?.name || actor.name?.match(/^New Creature$/i)) {
    patch.name = blueprint.label || blueprint.key || actor.name;
  }

  if (Array.isArray(blueprint.abilities)) {
    const abilities = blueprint.abilities.map(entry => {
      const key = entry.itemKey || entry.key;
      const def = deepClone(getMonsterAbility(key) || {});
    const merged = {
      ...def,
      ...entry,
      key,
      itemKey: key,
      label: entry.label || def.label || key,
      enabled: entry.enabled !== false,
      requiresParts: normalizeParts(entry.requiresParts || def.requiresParts || inferPartsFromAbility(def || entry))
    };

    // Mantén coherencia con el flag manualDisabled cuando venga deshabilitada por blueprint/base
    const mergedFlags = foundry.utils.mergeObject?.(deepClone(def.flags ?? {}), deepClone(entry.flags ?? {}), { inplace: false })
      ?? { ...(def.flags ?? {}), ...(entry.flags ?? {}) };
    const manualDisabled = (entry.enabled === false) || (def.enabled === false);
    if (manualDisabled) {
      merged.enabled = false;
      merged.flags = {
        ...mergedFlags,
        tsdc: {
          ...(mergedFlags?.tsdc ?? {}),
          manualDisabled: true,
          manualDisabledReason: mergedFlags?.tsdc?.manualDisabledReason ?? entry.disabledReason ?? def.disabledReason ?? null
        }
      };
    } else if (Object.keys(mergedFlags).length) {
      // Limpia banderas heredadas si ya no aplica
      if (mergedFlags?.tsdc?.manualDisabled) {
        const clone = deepClone(mergedFlags);
        delete clone.tsdc.manualDisabled;
        if (Object.keys(clone.tsdc).length === 0) delete clone.tsdc;
        merged.flags = clone;
      } else {
        merged.flags = mergedFlags;
      }
    }
      return merged;
    });
    patch["system.abilities"] = abilities;
  }
  if (blueprint.ailments) {
    patch["system.ailments"] = deepClone(blueprint.ailments);
  }

  if (Object.keys(healthParts).length) {
    const existingParts = actor.system?.health?.parts ?? {};
    const merged = {};
    const keys = new Set([...Object.keys(healthParts), ...Object.keys(existingParts)]);
    for (const key of keys) {
      const base = healthParts[key] ?? {};
      const current = existingParts[key] ?? {};
      const max = Number(base.max ?? current.max ?? base.value ?? current.value ?? 0);
      const value = current.value != null ? Math.min(Number(current.value), max || Number(current.value)) : (base.value ?? max);
      merged[key] = {
        ...base,
        ...current,
        max,
        value: Number.isFinite(value) ? value : max
      };
    }
    patch["system.health.parts"] = merged;
  }

  Object.assign(patch, buildProgressionPatch(blueprint));

  await actor.update(patch);
  return actor;
}

export async function createCreatureFromKey(key, { folderId = null, name = null, traits = [] } = {}) {
  const blueprint = await getBlueprintByKey(key);
  const actor = await Actor.create({
    name: name ?? blueprint.label ?? "Creature",
    type: "creature"
  }, {
    folder: folderId || undefined,
    renderSheet: false
  });

  await applyMonsterBlueprint(actor, blueprint, { traits, folderId, name: name ?? blueprint.label });
  return actor;
}
