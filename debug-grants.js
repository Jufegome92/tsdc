// Debug script para verificar el funcionamiento del sistema de grants
console.log("=== TSDC Grants Debug ===");

function debugGrants(actorName = "Arctos") {
  const actor = game.actors.find(a => a.name === actorName);
  if (!actor) {
    console.log(`❌ Actor "${actorName}" no encontrado`);
    return;
  }

  console.log(`🎯 Debugeando grants para: ${actor.name}`);

  // Test manual grant
  import("/systems/tsdc/modules/features/grants.js").then(async module => {
    const { grantManeuver, grantRelicPower } = module;

    console.log("📋 Estado actual del actor:");
    console.log("progression.maneuvers:", actor.system?.progression?.maneuvers);
    console.log("progression.relics:", actor.system?.progression?.relics);
    console.log("features.known.maneuvers:", actor.system?.features?.known?.maneuvers);
    console.log("features.known.relicPowers:", actor.system?.features?.known?.relicPowers);

    console.log("\n🧪 Probando grantManeuver con 'barrido'...");
    try {
      await grantManeuver(actor, "barrido", { source: "debug", silent: true });
      console.log("✅ grantManeuver completado");

      // Verificar cambios
      console.log("\n📊 Estado después de grantManeuver:");
      console.log("progression.maneuvers:", actor.system?.progression?.maneuvers);
      console.log("features.known.maneuvers:", actor.system?.features?.known?.maneuvers);

    } catch (error) {
      console.error("❌ Error en grantManeuver:", error);
    }

    console.log("\n🧪 Probando grantRelicPower con 'bendicion'...");
    try {
      await grantRelicPower(actor, "onda_choque", { source: "debug", silent: true });
      console.log("✅ grantRelicPower completado");

      // Verificar cambios
      console.log("\n📊 Estado después de grantRelicPower:");
      console.log("progression.relics:", actor.system?.progression?.relics);
      console.log("features.known.relicPowers:", actor.system?.features?.known?.relicPowers);

    } catch (error) {
      console.error("❌ Error en grantRelicPower:", error);
    }

    // Verificar funciones known
    console.log("\n🔍 Verificando funciones known...");
    import("/systems/tsdc/modules/features/known.js").then(knownModule => {
      const knownManeuvers = knownModule.actorKnownManeuvers(actor);
      const knownRelicPowers = knownModule.actorKnownRelicPowers(actor);

      console.log("actorKnownManeuvers():", knownManeuvers);
      console.log("actorKnownRelicPowers():", knownRelicPowers);
    });

  }).catch(err => {
    console.error("❌ Error importando grants.js:", err);
  });
}

// Función para verificar catálogos de datos
function debugCatalogs() {
  console.log("\n📚 Verificando catálogos de datos...");

  import("/systems/tsdc/modules/features/maneuvers/data.js").then(maneuversModule => {
    const MANEUVERS = maneuversModule.MANEUVERS;
    console.log("MANEUVERS catalog loaded:", !!MANEUVERS);
    console.log("Sample maneuvers:", Object.keys(MANEUVERS).slice(0, 5));
    console.log("'barrido' exists:", !!MANEUVERS.barrido);
  });

  import("/systems/tsdc/modules/features/relics/data.js").then(relicsModule => {
    console.log("Relics module loaded:", !!relicsModule);
    if (relicsModule.getRelicPower) {
      const testPower = relicsModule.getRelicPower("bendicion");
      console.log("getRelicPower('bendicion'):", !!testPower);
    }
  }).catch(err => {
    console.error("❌ Error importando relics/data.js:", err);
  });
}

// Ejecutar automáticamente
setTimeout(() => {
  debugGrants();
  debugCatalogs();
}, 1000);

// Exponer funciones
window.debugGrants = debugGrants;
window.debugCatalogs = debugCatalogs;

console.log("Funciones disponibles:");
console.log("- debugGrants('NombreDelActor')");
console.log("- debugCatalogs()");