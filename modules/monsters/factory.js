// modules/monsters/factory.js
import { getBlueprintByKey } from "./loader.js";
import { normalizeAttributes } from "../features/attributes/index.js";
import { levelToRank } from "../progression.js";

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

function buildNaturalWeaponRecords(blueprint, actorPatchLevel) {
  const level = toNumber(blueprint?.level, actorPatchLevel ?? 1);
  const qualityFallback = defaultQualityFromLevel(level);

  return (blueprint?.attacks ?? []).map((atk, idx) => {
    const key = String(atk.weaponKey || atk.key || `attack_${idx}`).toLowerCase();
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
      family: atk.family || atk.weaponFamily || null
    };

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

  const patch = {
    "system.level": toNumber(blueprint.level, actor.system?.level ?? 1),
    "system.attributes": attr,
    "system.anatomy": deepClone(blueprint.anatomy || {}),
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

  if (blueprint.abilities) {
    patch["system.abilities"] = deepClone(blueprint.abilities);
  }
  if (blueprint.ailments) {
    patch["system.ailments"] = deepClone(blueprint.ailments);
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
