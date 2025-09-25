// Script para corregir actores existentes con armas naturales
console.log("=== TSDC Fix Existing Actors ===");

// Function to fix anatomy and health parts for existing characters
async function fixActorAnatomy(actor) {
  const { buildHealthPartsFromAnatomy } = await import("/systems/tsdc/modules/monsters/factory.js");

  // Ensure anatomy exists for character actors
  const needsAnatomy = actor.type === "character" && (!actor.system?.anatomy || Object.keys(actor.system.anatomy).length === 0);
  const needsHealthParts = !actor.system?.health?.parts || Object.keys(actor.system.health.parts).length === 0;

  const updates = {};

  if (needsAnatomy) {
    // Standard humanoid anatomy for characters
    const standardAnatomy = {
      head: { materialKey: "bone", quality: 2 },
      chest: { materialKey: "bone", quality: 2 },
      bracers: { materialKey: "bone", quality: 2 },
      legs: { materialKey: "bone", quality: 2 },
      boots: { materialKey: "bone", quality: 2 }
    };
    updates["system.anatomy"] = standardAnatomy;
    console.log(`   📦 Setting standard anatomy for ${actor.name}`);
  }

  if (needsHealthParts) {
    // Use existing or newly set anatomy
    const anatomy = updates["system.anatomy"] || (actor.system?.anatomy ?? {});
    const healthParts = buildHealthPartsFromAnatomy(anatomy, { level: actor.system?.level ?? 1 });
    if (Object.keys(healthParts).length) {
      updates["system.health.parts"] = healthParts;
      console.log(`   💀 Setting health parts for ${actor.name}:`, Object.keys(healthParts));
    }
  }

  if (Object.keys(updates).length > 0) {
    await actor.update(updates);
    return true;
  }

  return false;
}

async function fixExistingActors(actorNames = ["Arctos"]) {
  console.log("🔧 Corrigiendo actores existentes...");

  const { levelToRank } = await import("/systems/tsdc/modules/progression.js");
  const { NATURAL_WEAPON_DEFS } = await import("/systems/tsdc/modules/features/species/natural-weapons.js");

  const results = [];

  for (const actorName of actorNames) {
    const actor = game.actors.find(a => a.name === actorName);
    if (!actor) {
      console.log(`❌ Actor "${actorName}" no encontrado`);
      results.push({ actor: actorName, success: false, reason: "Actor not found" });
      continue;
    }

    console.log(`\n🎭 Corrigiendo: ${actor.name}`);

    try {
      // First fix anatomy and health parts
      const anatomyFixed = await fixActorAnatomy(actor);
      if (anatomyFixed) {
        console.log("   ✅ Anatomía y partes del cuerpo corregidas");
      }

      // Obtener armas naturales actuales
      const currentWeapons = actor.getFlag("tsdc", "naturalWeapons") || [];
      console.log(`   Armas actuales: ${currentWeapons.length}`);

      if (currentWeapons.length === 0) {
        console.log("   ℹ️ No tiene armas naturales, saltando");
        results.push({ actor: actorName, success: true, reason: "No natural weapons" });
        continue;
      }

      const updatedWeapons = [];

      for (const weapon of currentWeapons) {
        const weaponKey = weapon.key;
        const def = NATURAL_WEAPON_DEFS[weaponKey];

        if (!def) {
          console.log(`   ⚠️ Definición no encontrada para ${weaponKey}, conservando actual`);
          updatedWeapons.push(weapon);
          continue;
        }

        console.log(`   🔄 Procesando ${weapon.label || weaponKey}:`);

        // Obtener progresión actual
        const progression = actor.system?.progression?.weapons?.[weaponKey];
        const level = progression?.level || 1;
        const rank = progression?.rank || levelToRank(level);

        console.log(`     Level: ${level}, Rank: ${rank}`);

        // Calcular durabilidad y potencia correctas
        const baseDurability = def.durabilityPerRank;
        const basePower = def.powerPerRank;

        const updatedWeapon = { ...weapon };

        if (baseDurability != null) {
          const maxDurability = Math.max(1, baseDurability * Math.max(1, rank));

          // Si ya tenía durabilidad, preservar la actual pero actualizar máximo
          if (weapon.durability && typeof weapon.durability === 'object') {
            const currentDurability = Math.min(weapon.durability.current || maxDurability, maxDurability);
            updatedWeapon.durability = {
              current: currentDurability,
              max: maxDurability
            };
          } else {
            // Nueva estructura de durabilidad
            updatedWeapon.durability = {
              current: maxDurability,
              max: maxDurability
            };
          }

          console.log(`     Durabilidad: ${JSON.stringify(updatedWeapon.durability)} (base: ${baseDurability})`);
        }

        if (basePower != null) {
          updatedWeapon.power = Math.max(1, basePower * Math.max(1, rank));
          console.log(`     Potencia: ${updatedWeapon.power} (base: ${basePower})`);
        }

        updatedWeapons.push(updatedWeapon);
      }

      // Actualizar flags del actor
      await actor.setFlag("tsdc", "naturalWeapons", updatedWeapons);
      console.log("   ✅ Armas naturales actualizadas");

      results.push({ actor: actorName, success: true, updatedWeapons: updatedWeapons.length });

    } catch (error) {
      console.error(`   ❌ Error procesando ${actor.name}:`, error);
      results.push({ actor: actorName, success: false, reason: error.message });
    }
  }

  console.log("\n🎉 RESUMEN:");
  results.forEach(result => {
    if (result.success) {
      console.log(`✅ ${result.actor}: ${result.updatedWeapons || 0} armas actualizadas`);
    } else {
      console.log(`❌ ${result.actor}: ${result.reason}`);
    }
  });

  return results;
}

// Función para corregir un solo actor
async function fixSingleActor(actorName = "Arctos") {
  return await fixExistingActors([actorName]);
}

// Función para corregir todos los actores con armas naturales
async function fixAllActorsWithNaturalWeapons() {
  console.log("🔍 Buscando todos los actores con armas naturales...");

  const actorsWithNaturalWeapons = [];

  for (const actor of game.actors) {
    const naturalWeapons = actor.getFlag("tsdc", "naturalWeapons") || [];
    if (naturalWeapons.length > 0) {
      actorsWithNaturalWeapons.push(actor.name);
    }
  }

  console.log(`📋 Encontrados ${actorsWithNaturalWeapons.length} actores con armas naturales:`);
  actorsWithNaturalWeapons.forEach(name => console.log(`   - ${name}`));

  if (actorsWithNaturalWeapons.length === 0) {
    console.log("ℹ️ No hay actores que corregir");
    return [];
  }

  return await fixExistingActors(actorsWithNaturalWeapons);
}

// Auto-run para el actor de prueba
setTimeout(async () => {
  await fixSingleActor("Arctos");
}, 1000);

// Export functions
window.fixExistingActors = fixExistingActors;
window.fixSingleActor = fixSingleActor;
window.fixAllActorsWithNaturalWeapons = fixAllActorsWithNaturalWeapons;

console.log("Functions available:");
console.log("- fixSingleActor('ActorName')");
console.log("- fixExistingActors(['Actor1', 'Actor2'])");
console.log("- fixAllActorsWithNaturalWeapons()");