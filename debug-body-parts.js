// Debug script para verificar estructura de partes del cuerpo
console.log("=== TSDC Body Parts Debug ===");

function debugBodyParts(actorName = "Arctos") {
  const actor = game.actors.find(a => a.name === actorName);
  if (!actor) {
    console.log(`❌ Actor "${actorName}" no encontrado`);
    return;
  }

  console.log(`🎭 Debugeando partes del cuerpo para: ${actor.name}`);

  // 1. Inspeccionar estructura de salud
  console.log("\n💀 Estructura de salud:");
  const healthParts = actor.system?.health?.parts || {};

  Object.keys(healthParts).forEach(partKey => {
    const part = healthParts[partKey];
    console.log(`  ${partKey}:`, JSON.stringify(part, null, 2));
  });

  // 2. Inspeccionar armas naturales y sus requiresParts
  console.log("\n🗡️ Armas naturales y partes requeridas:");
  const naturalWeapons = actor.getFlag("tsdc", "naturalWeapons") || [];

  naturalWeapons.forEach((weapon, i) => {
    console.log(`  ${i+1}. ${weapon.label || weapon.key}:`);
    console.log(`     requiresParts: [${(weapon.requiresParts || []).join(", ")}]`);

    // Test cada parte requerida
    (weapon.requiresParts || []).forEach(partKey => {
      const partData = healthParts[partKey];
      if (partData) {
        console.log(`       ${partKey}: ${JSON.stringify(partData)}`);

        // Test función isBodyPartBroken
        const valueProperty = partData.value;
        const currentProperty = partData.current;
        const isBrokenByValue = valueProperty !== undefined && valueProperty <= 0;
        const isBrokenByCurrent = currentProperty !== undefined && currentProperty <= 0;

        console.log(`         isBrokenByValue (${valueProperty} <= 0): ${isBrokenByValue}`);
        console.log(`         isBrokenByCurrent (${currentProperty} <= 0): ${isBrokenByCurrent}`);
      } else {
        console.log(`       ${partKey}: ❌ PARTE NO EXISTE`);
      }
    });
  });

  // 3. Test función isBodyPartBroken original
  console.log("\n🔍 Testing isBodyPartBroken function:");
  import("/systems/tsdc/modules/features/inventory/index.js").then(module => {
    const { arePartsFunctional, describePartsStatus } = module;

    naturalWeapons.forEach((weapon, i) => {
      console.log(`  Weapon ${i+1} (${weapon.label}):`);
      const functional = arePartsFunctional(actor, weapon.requiresParts);
      const description = describePartsStatus(actor, weapon.requiresParts);
      console.log(`    arePartsFunctional: ${functional}`);
      console.log(`    describePartsStatus: "${description}"`);
    });
  });

  return { healthParts, naturalWeapons };
}

// Auto-run
setTimeout(() => {
  debugBodyParts("Arctos");
}, 1000);

// Export function
window.debugBodyParts = debugBodyParts;

console.log("Functions available:");
console.log("- debugBodyParts('ActorName')");