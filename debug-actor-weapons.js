// Debug script para inspeccionar armas naturales del actor
console.log("=== TSDC Actor Weapons Debug ===");

function debugActorWeapons(actorName = "Arctos") {
  const actor = game.actors.find(a => a.name === actorName);
  if (!actor) {
    console.log(`❌ Actor "${actorName}" no encontrado`);
    return;
  }

  console.log(`🎭 Debugeando armas para: ${actor.name}`);
  console.log("Especie:", actor.system?.species?.key);

  // 1. Armas naturales en flags
  console.log("\n🏴 Armas naturales (flags):");
  const naturalWeapons = actor.getFlag("tsdc", "naturalWeapons") || [];
  console.log("Cantidad:", naturalWeapons.length);
  naturalWeapons.forEach((weapon, i) => {
    console.log(`  ${i+1}. ${weapon.label || weapon.key}:`);
    console.log(`     durability: ${JSON.stringify(weapon.durability)}`);
    console.log(`     power: ${weapon.power}`);
    console.log(`     durabilityPerRank: ${weapon.durabilityPerRank}`);
    console.log(`     powerPerRank: ${weapon.powerPerRank}`);
  });

  // 2. Progresión de armas
  console.log("\n📈 Progresión de armas:");
  const weaponProgression = actor.system?.progression?.weapons || {};
  Object.keys(weaponProgression).forEach(key => {
    const data = weaponProgression[key];
    console.log(`  ${key}: level=${data.level}, rank=${data.rank}, category=${data.category}`);
  });

  // 3. Equipo equipado
  console.log("\n🎒 Equipo equipado:");
  const equipped = actor.system?.inventory?.equipped || {};
  console.log("mainHand:", equipped.mainHand);
  console.log("offHand:", equipped.offHand);

  // 4. Partes del cuerpo y salud
  console.log("\n💀 Estado de salud:");
  const healthParts = actor.system?.health?.parts || {};
  Object.keys(healthParts).forEach(partKey => {
    const part = healthParts[partKey];
    console.log(`  ${partKey}: ${part.current}/${part.max} (lesiones: ${part.wounds || 0})`);
  });

  // 5. Inspeccionar anatomy
  console.log("\n🦴 Anatomía:");
  const anatomy = actor.system?.anatomy || {};
  console.log("Anatomía:", JSON.stringify(anatomy, null, 2));

  return {
    naturalWeapons,
    weaponProgression,
    equipped,
    healthParts,
    anatomy
  };
}

// Función para actualizar armas naturales existentes
async function fixActorNaturalWeapons(actorName = "Arctos") {
  const actor = game.actors.find(a => a.name === actorName);
  if (!actor) {
    console.log(`❌ Actor "${actorName}" no encontrado`);
    return;
  }

  console.log(`🔧 Corrigiendo armas naturales para: ${actor.name}`);

  // Obtener especies y armas actuales
  const speciesKey = actor.system?.species?.key;
  if (!speciesKey) {
    console.log("❌ Actor no tiene especie definida");
    return;
  }

  console.log("Especie:", speciesKey);

  // Importar funciones necesarias
  const { buildSpeciesNaturalWeapons, NATURAL_WEAPON_DEFS } = await import("/systems/tsdc/modules/features/species/natural-weapons.js");
  const { levelToRank } = await import("/systems/tsdc/modules/progression.js");

  // Obtener armas actuales
  const currentWeapons = actor.getFlag("tsdc", "naturalWeapons") || [];
  console.log("Armas actuales:", currentWeapons.length);

  // Reconstruir armas con durabilidad correcta
  const updatedWeapons = [];

  for (const weapon of currentWeapons) {
    const weaponKey = weapon.key;
    const def = NATURAL_WEAPON_DEFS[weaponKey];

    if (!def) {
      console.log(`⚠️ Definición no encontrada para ${weaponKey}`);
      updatedWeapons.push(weapon);
      continue;
    }

    // Obtener progresión actual
    const progression = actor.system?.progression?.weapons?.[weaponKey];
    const level = progression?.level || 1;
    const rank = progression?.rank || levelToRank(level);

    console.log(`  Actualizando ${weapon.label}: level=${level}, rank=${rank}`);

    // Recalcular durabilidad y potencia
    const baseDurability = def.durabilityPerRank;
    const basePower = def.powerPerRank;

    const updatedWeapon = { ...weapon };

    if (baseDurability != null) {
      const maxDurability = Math.max(1, baseDurability * Math.max(1, rank));
      // Preservar durabilidad actual si existe, pero actualizar máximo
      const currentDurability = weapon.durability?.current ?? maxDurability;
      updatedWeapon.durability = {
        current: Math.min(currentDurability, maxDurability),
        max: maxDurability
      };
      console.log(`    Durabilidad: ${JSON.stringify(updatedWeapon.durability)}`);
    }

    if (basePower != null) {
      updatedWeapon.power = Math.max(1, basePower * Math.max(1, rank));
      console.log(`    Potencia: ${updatedWeapon.power}`);
    }

    updatedWeapons.push(updatedWeapon);
  }

  // Actualizar flags del actor
  await actor.setFlag("tsdc", "naturalWeapons", updatedWeapons);
  console.log("✅ Armas naturales actualizadas en flags");

  return updatedWeapons;
}

// Auto-run
setTimeout(() => {
  debugActorWeapons("Arctos");
}, 1000);

// Export functions
window.debugActorWeapons = debugActorWeapons;
window.fixActorNaturalWeapons = fixActorNaturalWeapons;

console.log("Functions available:");
console.log("- debugActorWeapons('ActorName')");
console.log("- fixActorNaturalWeapons('ActorName')");