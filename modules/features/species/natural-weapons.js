// modules/features/species/natural-weapons.js

// Mapeo estandarizado de tipo de daño a ids del sistema (si necesitas)
const DMG = {
  contundente: "blunt",
  cortante: "slash",
  perforante: "pierce",
  veneno: "poison",
  corrosion: "corrosion"
};

const PART_LABELS = {
  head: "cabeza",
  chest: "torso",
  bracers: "brazos",
  legs: "piernas",
  boots: "pies"
};

function normalizePartKey(key) {
  if (!key) return null;
  const k = String(key).trim().toLowerCase();
  if (PART_LABELS[k]) return k;
  if (/(cabeza|head|cr\u00e1neo|craneo|skull|mand\u00edbula|jaw)/.test(k)) return "head";
  if (/(torso|chest|tronco|abdomen|cuerpo)/.test(k)) return "chest";
  if (/(brazo|arm|ala|wing|garra|claw|man|hand|pu\u00f1o|punch|fist)/.test(k)) return "bracers";
  if (/(pierna|leg|pata|hoof|cola|tail|muslo)/.test(k)) return "legs";
  if (/(pie|foot|paw|tal\u00f3n|talon|pezu\u00f1a|pezu\u00f1)/.test(k)) return "boots";
  return null;
}

function normalizeParts(parts) {
  if (!parts) return [];
  const arr = Array.isArray(parts) ? parts : [parts];
  return Array.from(new Set(arr.map(normalizePartKey).filter(Boolean)));
}

function inferPartsFromDef(def) {
  const explicit = normalizeParts(def.requiresParts || def.requiresPart || def.requiredParts);
  if (explicit.length) return explicit;

  const text = `${def.key ?? ""} ${def.label ?? ""}`.toLowerCase();
  const assign = String(def.assign ?? "").toLowerCase();

  if (/mord|bite|colm|fang|jaw|tromp|snout|pico|beak|aliento|breath|lengua|tongue/.test(text)) return ["head"];
  if (/garr|claw|manot|hand|punch|fist|hammer|golpe/.test(text)) return ["bracers"];
  if (/ala|wing/.test(text)) return ["bracers"];
  if (/cola|tail|espinazo/.test(text)) return ["chest"];
  if (/pata|kick|patada|hoof|leg|pezu\u00f1|talon/.test(text)) return ["legs"];
  if (/espin|spike|p\u00faa|aguij|sting/.test(text)) return [assign === "off" ? "bracers" : "chest"];

  if (assign === "off") return ["bracers"];
  if (assign === "main") return ["bracers"];
  return [];
}

function naturalQualityFromLevel(level = 1) {
  const lvl = Math.max(1, Number(level || 1));
  return Math.max(1, Math.ceil(lvl / 3));
}

export function buildNaturalWeaponRecord(def, { level = 1, rank = null } = {}) {
  if (!def) return null;
  const quality = naturalQualityFromLevel(level);
  const baseGrade = Number(def.grade ?? 1);
  const requiresParts = inferPartsFromDef(def);

  // Calculate rank if not provided (level 1 = rank 1 for natural weapons)
  const weaponRank = rank != null ? Math.max(1, Number(rank)) : 1;

  // Calculate actual durability and power from base values
  const baseDurability = def.durabilityPerRank ?? null;
  const basePower = def.powerPerRank ?? null;

  const record = {
    key: def.key,
    label: def.label,
    assign: def.assign ?? "main",
    allowsConcurrent: !!def.allowsConcurrent,
    occupiesSlot: def.allowsConcurrent ? false : true,
    type: "natural",
    damageDie: def.damageDie ?? "d6",
    attackAttr: def.attackAttr ?? "agility",
    impactAttr: def.impactAttr ?? def.attackAttr ?? "agility",
    reachMeters: def.reachMeters ?? null,
    reachSpecial: def.reachSpecial ?? null,
    tags: Array.isArray(def.tags) ? [...def.tags] : [],
    effectId: def.effectId ?? null,
    noAttack: !!def.noAttack,
    durabilityPerRank: baseDurability,
    powerPerRank: basePower,
    material: def.materialKey || def.material || null,
    quality,
    grade: Math.max(1, baseGrade),
    source: def.species ?? null,
    requiresParts
  };

  // Add calculated durability and power based on rank
  if (baseDurability != null) {
    const maxDurability = Math.max(1, baseDurability * weaponRank);
    record.durability = {
      current: maxDurability,
      max: maxDurability
    };
  }

  if (basePower != null) {
    record.power = Math.max(1, basePower * weaponRank);
  }

  return record;
}

export function buildSpeciesNaturalWeapons(speciesKey, { level = 1, rank = null, selectedChoices = [] } = {}) {
  const pack = SPECIES_NATURAL_WEAPONS[speciesKey];
  if (!pack) return [];

  // Default rank to 1 for new characters (level 1 = rank 1 for natural weapons)
  const weaponRank = rank != null ? rank : 1;

  // Add fixed weapons
  const keys = [...(pack.fixed ?? [])];

  // Add selected choices if any
  if (pack.choices && Array.isArray(pack.choices)) {
    pack.choices.forEach((choiceGroup, index) => {
      if (selectedChoices[index] && choiceGroup.includes(selectedChoices[index])) {
        keys.push(selectedChoices[index]);
      } else if (choiceGroup.length > 0) {
        // Default to first choice if none selected
        keys.push(choiceGroup[0]);
      }
    });
  }

  const result = [];
  for (const key of keys) {
    const def = NATURAL_WEAPON_DEFS[key];
    const record = buildNaturalWeaponRecord(def, { level, rank: weaponRank });
    if (record) result.push(record);
  }
  return result;
}

/** Get available weapon choices for a species */
export function getSpeciesWeaponChoices(speciesKey) {
  const pack = SPECIES_NATURAL_WEAPONS[speciesKey];
  if (!pack || !pack.choices) return [];

  return pack.choices.map((choiceGroup, index) => ({
    groupIndex: index,
    choices: choiceGroup.map(key => ({
      key,
      def: NATURAL_WEAPON_DEFS[key],
      label: NATURAL_WEAPON_DEFS[key]?.label || key
    }))
  }));
}

/** Check if a species has weapon variants to choose from */
export function hasWeaponVariants(speciesKey) {
  const pack = SPECIES_NATURAL_WEAPONS[speciesKey];
  return pack?.choices && pack.choices.length > 0;
}

/** Update natural weapon stats when weapon rank changes */
export async function updateNaturalWeaponStats(actor, weaponKey) {
  if (!actor || !weaponKey) return;

  // Get current natural weapons from flags
  const naturalWeapons = actor.getFlag("tsdc", "naturalWeapons") || [];
  const weaponIndex = naturalWeapons.findIndex(w => w.key === weaponKey);
  if (weaponIndex === -1) return;

  // Get current weapon rank from progression
  const weaponData = actor.system?.progression?.weapons?.[weaponKey];
  if (!weaponData) return;

  // Get the weapon definition to recalculate stats
  const weaponRecord = naturalWeapons[weaponIndex];
  const def = NATURAL_WEAPON_DEFS[weaponKey];
  if (!def) return;

  // Calculate new rank (use levelToRank function to ensure consistency)
  const { levelToRank } = await import("../../progression.js");
  const newRank = levelToRank(weaponData.level || 1);

  // Recalculate durability and power
  const baseDurability = def.durabilityPerRank ?? null;
  const basePower = def.powerPerRank ?? null;

  const updates = { ...weaponRecord };

  if (baseDurability != null) {
    const maxDurability = Math.max(1, baseDurability * Math.max(1, newRank));
    // Preserve current durability if it exists, but update max
    const currentDurability = weaponRecord.durability?.current ?? maxDurability;
    updates.durability = {
      current: Math.min(currentDurability, maxDurability), // Don't exceed new max
      max: maxDurability
    };
  }

  if (basePower != null) {
    updates.power = Math.max(1, basePower * Math.max(1, newRank));
  }

  // Update the natural weapons array
  const updatedWeapons = [...naturalWeapons];
  updatedWeapons[weaponIndex] = updates;

  // Save back to actor flags
  await actor.setFlag("tsdc", "naturalWeapons", updatedWeapons);

  console.log(`TSDC | Updated natural weapon ${weaponKey} stats for rank ${newRank}`);
}

export const NATURAL_WEAPON_DEFS = {
  // =======================
  // NAGHII
  // =======================
  "naghii-tail": {
    key: "naghii-tail",
    species: "naghii",
    label: "Cola (Naghii)",
    assign: "main",
    dmgType: DMG.contundente,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 2,
    damageDie: "d10",
    durabilityPerRank: 8,
    powerPerRank: 6,
    tags: ["Control de Campo","Impulso","Golpe Sordo","Intercepción"],
    effectId: "NAGHII_TAIL_TRIP",
    notes: "Si usas la cola como arma principal este turno, no puedes usar simultáneamente un arma de 2 manos."
  },
  "naghii-bite": {
    key: "naghii-bite",
    species: "naghii",
    label: "Mordisco (Naghii)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d8",
    durabilityPerRank: 5,
    powerPerRank: 7,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "NAGHII_BITE_TENACITY_POISON"
  },
  "naghii-venom-spit": {
    key: "naghii-venom-spit",
    species: "naghii",
    label: "Expulsión de Veneno (Naghii)",
    assign: "main",               // Principal weapon - prevents dual wield exploitation
    dmgType: DMG.veneno,
    noAttack: true,               // no hay tirada de ataque; el objetivo hace TR
    attackAttr: null,
    impactAttr: "tenacity",
    reachMeters: 10,
    damageDie: "d4",
    durabilityPerRank: 0,
    powerPerRank: 0,
    tags: ["Propulsión","Preciso","Aguijón","Erosivo"],
    effectId: "NAGHII_SPIT_BLIND"
  },

  // =======================
  // SAURI
  // =======================
  "sauri-claws": {
    key: "sauri-claws",
    species: "sauri",
    label: "Garras (Sauri)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "strength",
    impactAttr: "strength",
    reachMeters: 1,
    damageDie: "d6",
    durabilityPerRank: 8,
    powerPerRank: 7,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "SAURI_CLAWS_BLEED"
  },
  "sauri-bite": {
    key: "sauri-bite",
    species: "sauri",
    label: "Mordisco (Sauri)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d10",
    durabilityPerRank: 10,
    powerPerRank: 12,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "SAURI_BITE_BREAK_PARTS"
  },

  // =======================
  // ZARNAG
  // =======================
  "zarnag-claws": {
    key: "zarnag-claws",
    species: "zarnag",
    label: "Garras (Zarnag)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 1,
    damageDie: "d4",
    durabilityPerRank: 6,
    powerPerRank: 6,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "ZARNAG_CLAWS_COMBO_STRENGTH_BONUS"
  },
  "zarnag-bite": {
    key: "zarnag-bite",
    species: "zarnag",
    label: "Mordisco (Zarnag)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d8",
    durabilityPerRank: 5,
    powerPerRank: 9,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "ZARNAG_BITE_INFECTION_PARALYSIS"
  },

  // =======================
  // DRAK'KAI
  // =======================
  "drakkai-shell": {
    key: "drakkai-shell",
    species: "drak'kai",
    label: "Caparazón (Drak’kai)",
    assign: "main",
    dmgType: DMG.contundente,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: null,
    reachSpecial: "moveSpeed", // velocidad de movimiento
    damageDie: "d10",
    durabilityPerRank: 10,
    powerPerRank: 6,
    tags: ["Bastión","Fortificado","Defensivo","Intercepción"],
    effectId: "DRAKKAI_SHELL_CHARGE_PUSH",
    notes: "Debe utilizarse en conjunto con una Acción de Movimiento."
  },
  "drakkai-bite": {
    key: "drakkai-bite",
    species: "drak'kai",
    label: "Mordisco (Drak’kai)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d10",
    durabilityPerRank: 6,
    powerPerRank: 7,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "DRAKKAI_BITE_DIE_STEP"
  },

  // =======================
  // ROKHART
  // =======================
  "rokhart-claws": {
    key: "rokhart-claws",
    species: "rokhart",
    label: "Garras (Rokhart)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 1,
    damageDie: "d4",
    durabilityPerRank: 4,
    powerPerRank: 6,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "ROKHART_CLAWS_RETREAT"
  },
  "rokhart-beak": {
    key: "rokhart-beak",
    species: "rokhart",
    label: "Pico (Rokhart)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 1,
    damageDie: "d8",
    durabilityPerRank: 5,
    powerPerRank: 7,
    tags: ["Aguijón","Perforador","Letal","Ricochete"],
    effectId: "ROKHART_BEAK_CRIT_EASIER"
  },

  // =======================
  // LOXOD
  // =======================
  "loxod-tusks": {
    key: "loxod-tusks",
    species: "loxod",
    label: "Colmillos (Loxod)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 2,
    damageDie: "d10",
    durabilityPerRank: 8,
    powerPerRank: 8,
    tags: ["Carga","Perforador","Demoledor","Impulso"],
    effectId: "LOXOD_TUSKS_TRIP"
  },
  "loxod-trunk": {
    key: "loxod-trunk",
    species: "loxod",
    label: "Trompa (Loxod)",
    assign: "main",
    allowsConcurrent: true,
    dmgType: DMG.contundente,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 2,
    damageDie: "d8",
    durabilityPerRank: 6,
    powerPerRank: 6,
    tags: ["Control de Campo","Torsión","Fortificado","Interrupción"],
    effectId: "LOXOD_TRUNK_UNBALANCE"
  },

  // =======================
  // CERATOX
  // =======================
  "ceratox-horn": {
    key: "ceratox-horn",
    species: "ceratox",
    label: "Cuerno (Ceratox)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "strength",
    impactAttr: "strength",
    reachMeters: 1,
    damageDie: "d12",
    durabilityPerRank: 8,
    powerPerRank: 9,
    tags: ["Perforador","Carga","Demoledor","Imparable"],
    effectId: "CERATOX_HORN_ARMOR_REDUCE"
  },

  // =======================
  // FORMIX
  // =======================
  "formix-bite": {
    key: "formix-bite",
    species: "formix",
    label: "Mordisco (Formix)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d8",
    durabilityPerRank: 6,
    powerPerRank: 8,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "FORMIX_BITE_TRAP"
  },
  "formix-sting": {
    key: "formix-sting",
    species: "formix",
    label: "Aguijón (Formix)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 1,
    damageDie: "d6",
    durabilityPerRank: 5,
    powerPerRank: 7,
    tags: ["Aguijón","Erosivo","Letal","Sombrío"],
    effectId: "FORMIX_STING_STR_POISON"
  },
  "formix-corrosive-expulsion": {
    key: "formix-corrosive-expulsion",
    species: "formix",
    label: "Expulsión Corrosiva (Formix)",
    assign: "main",
    dmgType: DMG.corrosion,
    noAttack: true,
    attackAttr: null,
    impactAttr: "tenacity",
    reachMeters: 5,
    damageDie: "d6",
    durabilityPerRank: 0,
    powerPerRank: 7,
    tags: ["Propulsión","Preciso","Aguijón","Erosivo"],
    effectId: "FORMIX_CORROSION_APPLY"
  },

  // =======================
  // CHELICER
  // =======================
  "chelicer-claws": {
    key: "chelicer-claws",
    species: "chelicer",
    label: "Garras (Chelicer)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 1,
    damageDie: "d4",
    durabilityPerRank: 6,
    powerPerRank: 6,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "CHELICER_CLAWS_CRIT_ALTERATIONS"
  },
  "chelicer-sting": {
    key: "chelicer-sting",
    species: "chelicer",
    label: "Aguijón (Chelicer)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 2,
    damageDie: "d8",
    durabilityPerRank: 7,
    powerPerRank: 5,
    tags: ["Propulsión","Preciso","Aguijón","Erosivo"],
    effectId: "CHELICER_STING_PARALYSIS"
  },
  "chelicer-venom-expulsion": {
    key: "chelicer-venom-expulsion",
    species: "chelicer",
    label: "Expulsión de Veneno (Chelicer)",
    assign: "main",
    dmgType: DMG.veneno,
    noAttack: true,
    attackAttr: null,
    impactAttr: "tenacity",
    reachMeters: 5,
    damageDie: "d6",
    durabilityPerRank: 0,
    powerPerRank: 0,
    tags: ["Propulsión","Preciso","Aguijón","Erosivo"],
    effectId: "CHELICER_SPIT_AGI_POISON"
  },

  // =======================
  // PANIN
  // =======================
  "panin-bite": {
    key: "panin-bite",
    species: "panin",
    label: "Mordisco (Panin)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 1,
    damageDie: "d6",
    durabilityPerRank: 5,
    powerPerRank: 5,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "PANIN_BITE_BLEED_STACKS"
  },

  // =======================
  // LUPHRAN
  // =======================
  "luphran-claws": {
    key: "luphran-claws",
    species: "luphran",
    label: "Garras (Luphran)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "strength",
    impactAttr: "strength",
    reachMeters: 1,
    damageDie: "d4",
    durabilityPerRank: 5,
    powerPerRank: 6,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "LUPHRAN_CLAWS_CUNNING_BUFF"
  },
  "luphran-bite": {
    key: "luphran-bite",
    species: "luphran",
    label: "Mordisco (Luphran)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d8",
    durabilityPerRank: 6,
    powerPerRank: 7,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "LUPHRAN_BITE_FOCUS_PENALTY"
  },

  // =======================
  // URSARI
  // =======================
  "ursari-claws": {
    key: "ursari-claws",
    species: "ursari",
    label: "Garras (Ursari)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "strength",
    impactAttr: "strength",
    reachMeters: 1,
    damageDie: "d6",
    durabilityPerRank: 6,
    powerPerRank: 6,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "URSARI_CLAWS_IMPEDE"
  },
  "ursari-bite": {
    key: "ursari-bite",
    species: "ursari",
    label: "Mordisco (Ursari)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d10",
    durabilityPerRank: 7,
    powerPerRank: 8,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "URSARI_BITE_BREAK_PARTS"
  },

  // =======================
  // ARAKHEL
  // =======================
  "arakhel-bite": {
    key: "arakhel-bite",
    species: "arakhel",
    label: "Mordisco (Arakhel)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 1,
    damageDie: "d8",
    durabilityPerRank: 5,
    powerPerRank: 6,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "ARAKHEL_BITE_CONFUSION"
  },

  // =======================
  // BUFONI
  // =======================
  "bufoni-tongue": {
    key: "bufoni-tongue",
    species: "bufoni",
    label: "Lengua Prensil (Bufoni)",
    assign: "main",
    allowsConcurrent: true,
    dmgType: DMG.contundente,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 3,
    damageDie: "d6",
    durabilityPerRank: 3,
    powerPerRank: 3,
    tags: ["Torsión","Fluctuante","Disruptivo","Engañoso"],
    effectId: "BUFONI_TONGUE_PULL_OR_TRAP"
  },

  // =======================
  // VESPER
  // =======================
  "vesper-bite": {
    key: "vesper-bite",
    species: "vesper",
    label: "Mordisco (Vesper)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "agility",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d8",
    durabilityPerRank: 5,
    powerPerRank: 5,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "VESPER_BITE_BLOOD_EXTRACTION"
  },
  "vesper-claws": {
    key: "vesper-claws",
    species: "vesper",
    label: "Garras (Vesper)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 1,
    damageDie: "d4",
    durabilityPerRank: 4,
    powerPerRank: 4,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "VESPER_CLAWS_UNBALANCE"
  },

  // =======================
  // LAPINNI
  // =======================
  "lapinni-claws": {
    key: "lapinni-claws",
    species: "lapinni",
    label: "Garras (Lapinni)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 1,
    damageDie: "d6",
    durabilityPerRank: 4,
    powerPerRank: 5,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "LAPINNI_CLAWS_SLOW_AND_RELOCATE"
  },

  // =======================
  // ERIN
  // =======================
  "erin-spikes": {
    key: "erin-spikes",
    species: "erin",
    label: "Púas (Erin)",
    assign: "main",
    allowsConcurrent: true,
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 10,
    damageDie: "d6",
    durabilityPerRank: 2,
    powerPerRank: 5,
    tags: ["Desgarrador","Aguijón","Fortificado","Cortante"],
    effectId: "ERIN_SPIKES_REACTIONS"
  },
  "erin-claws": {
    key: "erin-claws",
    species: "erin",
    label: "Garras (Erin)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "strength",
    impactAttr: "strength",
    reachMeters: 1,
    damageDie: "d4",
    durabilityPerRank: 6,
    powerPerRank: 8,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "ERIN_CLAWS_WEAKEN_POISON_INFECTION"
  },

  // =======================
  // MANTO
  // =======================
  "manto-pincers": {
    key: "manto-pincers",
    species: "manto",
    label: "Tenazas (Manto)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 2,
    damageDie: "d4",
    durabilityPerRank: 7,
    powerPerRank: 6,
    tags: ["Letal","Fluctuante","Torsión","Disruptivo"],
    effectId: "MANTO_PINCERS_TRAP"
  },
  "manto-bite": {
    key: "manto-bite",
    species: "manto",
    label: "Mordisco (Manto)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d8",
    durabilityPerRank: 8,
    powerPerRank: 7,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "MANTO_BITE_WEAKEN"
  },

  // =======================
  // TALPI
  // =======================
  "talpi-claws": {
    key: "talpi-claws",
    species: "talpi",
    label: "Garras (Talpi)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "strength",
    impactAttr: "strength",
    reachMeters: 1,
    damageDie: "d4",
    durabilityPerRank: 6,
    powerPerRank: 5,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "TALPI_CLAWS_DOUBLE_HIT_WEAKEN"
  },
  "talpi-bite": {
    key: "talpi-bite",
    species: "talpi",
    label: "Mordisco (Talpi)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d8",
    durabilityPerRank: 7,
    powerPerRank: 6,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "TALPI_BITE_FRACTURE"
  },

  // =======================
  // MYO
  // =======================
  "myo-claws": {
    key: "myo-claws",
    species: "myo",
    label: "Garras (Myo)",
    assign: "either",             // Can use either hand for dual wield
    dmgType: DMG.cortante,
    attackAttr: "agility",
    impactAttr: "agility",
    reachMeters: 1,
    damageDie: "d4",
    durabilityPerRank: 5,
    powerPerRank: 4,
    tags: ["Cortante","Demoledor","Desgarrador","Veloz"],
    effectId: "MYO_CLAWS_DURABILITY_SHRED"
  },
  "myo-bite": {
    key: "myo-bite",
    species: "myo",
    label: "Mordisco (Myo)",
    assign: "main",
    dmgType: DMG.perforante,
    attackAttr: "tenacity",
    impactAttr: "tenacity",
    reachMeters: 1,
    damageDie: "d6",
    durabilityPerRank: 4,
    powerPerRank: 5,
    tags: ["Letal","Sombrío","Implacable","Perforador"],
    effectId: "MYO_BITE_NAUSEA_INFECTION"
  }
};

// =======================
// ASIGNACIÓN POR ESPECIE
// - fixed: competencias iniciales (nivel 1)
// - choices: grupos de opciones exclusivas (elige 1 de cada grupo)
// =======================
export const SPECIES_NATURAL_WEAPONS = {
  "naghii": {
    fixed: ["naghii-tail"],
    choices: [["naghii-bite","naghii-venom-spit"]]
  },
  "sauri": {
    fixed: ["sauri-claws","sauri-bite"],
    choices: []
  },
  "zarnag": {
    fixed: ["zarnag-claws","zarnag-bite"],
    choices: []
  },
  "drak'kai": {
    fixed: ["drakkai-shell","drakkai-bite"],
    choices: []
  },
  "rokhart": {
    fixed: ["rokhart-claws","rokhart-beak"],
    choices: []
  },
  "loxod": {
    fixed: ["loxod-tusks","loxod-trunk"],
    choices: []
  },
  "ceratox": {
    fixed: ["ceratox-horn"],
    choices: []
  },
  "formix": {
    fixed: ["formix-bite"],
    choices: [["formix-sting","formix-corrosive-expulsion"]]
  },
  "chelicer": {
    fixed: ["chelicer-claws"],
    choices: [["chelicer-sting","chelicer-venom-expulsion"]]
  },
  "panin": {
    fixed: ["panin-bite"],
    choices: []
  },
  "luphran": {
    fixed: ["luphran-claws","luphran-bite"],
    choices: []
  },
  "ursari": {
    fixed: ["ursari-claws","ursari-bite"],
    choices: []
  },
  "arakhel": {
    fixed: ["arakhel-bite"],
    choices: []
  },
  "bufoni": {
    fixed: ["bufoni-tongue"],
    choices: []
  },
  "vesper": {
    fixed: ["vesper-bite","vesper-claws"],
    choices: []
  },
  "lapinni": {
    fixed: ["lapinni-claws"],
    choices: []
  },
  "erin": {
    fixed: ["erin-spikes","erin-claws"],
    choices: []
  },
  "manto": {
    fixed: ["manto-pincers","manto-bite"],
    choices: []
  },
  "talpi": {
    fixed: ["talpi-claws","talpi-bite"],
    choices: []
  },
  "myo": {
    fixed: ["myo-claws","myo-bite"],
    choices: []
  }
};

// Helpers
export function getNaturalWeaponDef(key) {
  return NATURAL_WEAPON_DEFS[key] ?? null;
}

export function listNaturalWeaponsForSpecies(speciesKey, { includeChoices=false } = {}) {
  const pack = SPECIES_NATURAL_WEAPONS[speciesKey];
  if (!pack) return [];
  if (!includeChoices) return (pack.fixed ?? []).map(k => NATURAL_WEAPON_DEFS[k]).filter(Boolean);
  const all = [
    ...(pack.fixed ?? []),
    ...((pack.choices ?? []).flat())
  ];
  return all.map(k => NATURAL_WEAPON_DEFS[k]).filter(Boolean);
}
