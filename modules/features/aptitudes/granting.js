// modules/features/aptitudes/granting.js
// Sistema de otorgamiento automático de aptitudes basado en requisitos

import { APTITUDES } from "./data.js";

const SPECIALIZATION_MAPPINGS = {
  "saltar": "saltar",
  "acrobacias": "acrobacias",
  "destreza": "destreza",
  "trepar": "trepar",
  "equilibrio": "equilibrio",
  "equitación": "equitacion",
  "equitacion": "equitacion",
  "vigor": "vigor",
  "sigilo": "sigilo",
  // Añadir más mapeos según sea necesario
};

/**
 * Parsea un string de requisitos y devuelve un objeto estructurado
 * @param {string} requiresText - El texto de requisitos (ej: "Rango 2 de Saltar, Rango 2 en Sigilo")
 * @returns {Object} Objeto con los requisitos parseados
 */
function parseRequirements(requiresText) {
  if (!requiresText) return { specializations: [], equipment: [], conditions: [] };

  const requirements = {
    specializations: [],
    equipment: [],
    conditions: []
  };

  // Dividir por comas
  const parts = requiresText.split(',').map(p => p.trim());

  for (const part of parts) {
    // Patrón: "Rango X de/en Y"
    const rankMatch = part.match(/^Rango\s+(\d+)\s+(?:de|en)\s+(.+)$/i);
    if (rankMatch) {
      const rank = parseInt(rankMatch[1]);
      const specName = rankMatch[2].toLowerCase();
      const specKey = SPECIALIZATION_MAPPINGS[specName] || specName.replace(/\s+/g, '_');

      requirements.specializations.push({
        key: specKey,
        rank: rank,
        displayName: rankMatch[2]
      });
      continue;
    }

    // Patrón: "Arma cuerpo a cuerpo"
    if (part.toLowerCase().includes("arma cuerpo a cuerpo")) {
      requirements.equipment.push({
        type: "melee_weapon",
        description: part
      });
      continue;
    }

    // Patrón: "Montura"
    if (part.toLowerCase().includes("montura")) {
      requirements.conditions.push({
        type: "mount",
        description: part
      });
      continue;
    }

    // Si no coincide con ningún patrón, añadir como condición general
    requirements.conditions.push({
      type: "general",
      description: part
    });
  }

  return requirements;
}

/**
 * Verifica si un actor cumple con los requisitos de una aptitud
 * @param {Actor} actor - El actor a verificar
 * @param {Object} requirements - Los requisitos parseados
 * @returns {boolean} True si cumple todos los requisitos
 */
function meetsRequirements(actor, requirements) {
  if (!actor) return false;

  // Verificar requisitos de especialización
  for (const req of requirements.specializations) {
    const currentRank = getSpecializationRank(actor, req.key);
    if (currentRank < req.rank) {
      return false;
    }
  }

  // Verificar requisitos de equipo
  for (const req of requirements.equipment) {
    if (req.type === "melee_weapon") {
      if (!hasMeleeWeaponEquipped(actor)) {
        return false;
      }
    }
  }

  // Verificar condiciones especiales
  for (const req of requirements.conditions) {
    if (req.type === "mount") {
      // Por ahora asumimos que siempre tiene acceso a montura
      // En el futuro se puede implementar verificación real
      continue;
    }
  }

  return true;
}

/**
 * Obtiene el rango actual de una especialización
 * @param {Actor} actor
 * @param {string} specKey
 * @returns {number}
 */
function getSpecializationRank(actor, specKey) {
  const specs = actor?.system?.progression?.skills || {};
  return Number(specs[specKey]?.rank || 0);
}

/**
 * Verifica si el actor tiene un arma cuerpo a cuerpo equipada
 * @param {Actor} actor
 * @returns {boolean}
 */
function hasMeleeWeaponEquipped(actor) {
  // Por ahora retornamos true, se puede implementar verificación real después
  // Esta función requeriría acceso al sistema de inventario
  return true;
}

/**
 * Otorga una aptitud a un actor
 * @param {Actor} actor
 * @param {string} aptitudeKey
 * @returns {boolean} True si se otorgó con éxito
 */
async function grantAptitude(actor, aptitudeKey) {
  if (!actor || !aptitudeKey) return false;

  const currentAptitudes = actor.system?.progression?.aptitudes || {};

  // Si ya tiene la aptitud, no hacer nada
  if (currentAptitudes[aptitudeKey]?.known) {
    return false;
  }

  // Otorgar la aptitud
  const updatedAptitudes = {
    ...currentAptitudes,
    [aptitudeKey]: {
      known: true,
      rank: 1 // Empezar en rango 1
    }
  };

  await actor.update({ "system.progression.aptitudes": updatedAptitudes });

  // Notificar al jugador
  const aptitudeDef = APTITUDES[aptitudeKey];
  const label = aptitudeDef?.label || aptitudeKey;

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><b>${actor.name}</b> ha adquirido la aptitud <strong>${label}</strong>!</p>`,
    whisper: [game.user.id] // Solo al GM por defecto
  });

  console.log(`TSDC | Aptitud otorgada: ${label} a ${actor.name}`);
  return true;
}

/**
 * Evalúa y otorga todas las aptitudes disponibles para un actor
 * @param {Actor} actor
 * @returns {Array} Array de aptitudes otorgadas
 */
export async function evaluateAndGrantAptitudes(actor) {
  if (!actor) return [];

  const grantedAptitudes = [];

  for (const [aptitudeKey, aptitudeDef] of Object.entries(APTITUDES)) {
    // Verificar si ya tiene la aptitud
    const currentAptitudes = actor.system?.progression?.aptitudes || {};
    if (currentAptitudes[aptitudeKey]?.known) {
      continue;
    }

    // Parsear requisitos
    const requirements = parseRequirements(aptitudeDef.requires);

    // Verificar si cumple los requisitos
    if (meetsRequirements(actor, requirements)) {
      const granted = await grantAptitude(actor, aptitudeKey);
      if (granted) {
        grantedAptitudes.push(aptitudeKey);
      }
    }
  }

  return grantedAptitudes;
}

/**
 * Evalúa aptitudes cuando cambia el rango de una especialización específica
 * @param {Actor} actor
 * @param {string} specKey - La especialización que cambió
 * @returns {Array} Array de aptitudes otorgadas
 */
export async function evaluateAptitudesForSpecialization(actor, specKey) {
  if (!actor || !specKey) return [];

  const grantedAptitudes = [];

  // Solo evaluar aptitudes que podrían ser afectadas por esta especialización
  for (const [aptitudeKey, aptitudeDef] of Object.entries(APTITUDES)) {
    // Si ya tiene la aptitud, saltar
    const currentAptitudes = actor.system?.progression?.aptitudes || {};
    if (currentAptitudes[aptitudeKey]?.known) {
      continue;
    }

    // Si los requisitos no incluyen esta especialización, saltar
    if (!aptitudeDef.requires?.toLowerCase().includes(specKey.toLowerCase())) {
      continue;
    }

    // Parsear requisitos y verificar
    const requirements = parseRequirements(aptitudeDef.requires);
    if (meetsRequirements(actor, requirements)) {
      const granted = await grantAptitude(actor, aptitudeKey);
      if (granted) {
        grantedAptitudes.push(aptitudeKey);
      }
    }
  }

  return grantedAptitudes;
}

/**
 * Hook que se ejecuta cuando se actualiza un actor
 * Verifica cambios en especializaciones y otorga aptitudes si es necesario
 */
Hooks.on("updateActor", async (actor, changes, options, userId) => {
  // Solo procesar si es el GM o el propietario del actor
  if (!game.user.isGM && !actor.isOwner) return;

  // Solo procesar actores de tipo character
  if (actor.type !== "character") return;

  // Verificar si hubo cambios en las especializaciones
  const skillChanges = changes.system?.progression?.skills;
  if (!skillChanges) return;

  // Evaluar aptitudes para cada especialización que cambió
  for (const [specKey, specData] of Object.entries(skillChanges)) {
    if (specData.rank !== undefined) {
      console.log(`TSDC | Evaluando aptitudes para ${actor.name} tras cambio en ${specKey}`);
      const granted = await evaluateAptitudesForSpecialization(actor, specKey);
      if (granted.length > 0) {
        console.log(`TSDC | Aptitudes otorgadas: ${granted.join(', ')}`);
      }
    }
  }
});

/**
 * Evalúa aptitudes durante la creación del personaje
 */
Hooks.on("createActor", async (actor, data, options, userId) => {
  // Solo procesar si es el GM
  if (!game.user.isGM) return;

  // Solo procesar actores de tipo character
  if (actor.type !== "character") return;

  // Esperar un poco para que el actor esté completamente inicializado
  setTimeout(async () => {
    console.log(`TSDC | Evaluando aptitudes iniciales para ${actor.name}`);
    const granted = await evaluateAndGrantAptitudes(actor);
    if (granted.length > 0) {
      console.log(`TSDC | Aptitudes iniciales otorgadas: ${granted.join(', ')}`);
    }
  }, 1000);
});

/**
 * Debug: Función para evaluar manualmente las aptitudes de un actor
 * Usar en consola: game.tsdc.evaluateAptitudes(actor)
 */
export async function debugEvaluateAptitudes(actor) {
  if (!actor) {
    console.log("TSDC | No actor provided");
    return;
  }

  console.log(`TSDC | Evaluando aptitudes para ${actor.name}`);
  console.log("Especializaciones actuales:", actor.system?.progression?.skills);
  console.log("Aptitudes actuales:", actor.system?.progression?.aptitudes);

  const granted = await evaluateAndGrantAptitudes(actor);
  console.log(`Aptitudes otorgadas: ${granted.length ? granted.join(', ') : 'ninguna'}`);
  return granted;
}

// Registrar función debug en el API global
Hooks.once("ready", () => {
  game.tsdc = game.tsdc || {};
  game.tsdc.evaluateAptitudes = debugEvaluateAptitudes;
  console.log("TSDC | Sistema de otorgamiento de aptitudes inicializado");
});