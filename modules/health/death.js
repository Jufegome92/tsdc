// modules/health/death.js
// Sistema de muerte de criaturas

/**
 * Check if a creature is dead based on HP in body parts
 * @param {Actor} actor
 * @returns {boolean}
 */
export function isCreatureDead(actor) {
  if (!actor || actor.type !== "creature") return false;

  const parts = actor.system?.health?.parts;
  if (!parts) return false;

  // Contar partes críticas (head, chest/torso) que están en 0 HP
  let criticalPartsDestroyed = 0;
  let totalPartsDestroyed = 0;

  for (const [key, part] of Object.entries(parts)) {
    const hp = Number(part?.value || 0);
    if (hp <= 0) {
      totalPartsDestroyed++;
      // Head y chest/torso son partes críticas
      if (key === "head" || key === "chest" || key === "torso") {
        criticalPartsDestroyed++;
      }
    }
  }

  // Muere si: 1 parte crítica destruida O 3+ partes totales destruidas
  return criticalPartsDestroyed >= 1 || totalPartsDestroyed >= 3;
}

/**
 * Mark a creature as dead (set flag)
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function markCreatureDead(actor) {
  if (!actor || actor.type !== "creature") return;

  // Set death flag
  await actor.setFlag("tsdc", "isDead", true);
  await actor.setFlag("tsdc", "deathTime", Date.now());

  // Optional: Update token appearance
  const tokens = actor.getActiveTokens();
  for (const token of tokens) {
    // Add dead overlay or tint
    await token.document.update({
      "alpha": 0.7,
      "overlayEffect": "icons/svg/skull.svg"
    });
  }

  // Notification
  ui.notifications?.info(`${actor.name} ha muerto.`);

  // Chat message
  ChatMessage.create({
    content: `<div class="tsdc creature-death">
      <h3>💀 Criatura Derrotada</h3>
      <p><strong>${actor.name}</strong> ha sido derrotado.</p>
      <p><em>Los materiales pueden ser extraídos.</em></p>
    </div>`,
    speaker: { alias: "Sistema" }
  });
}

/**
 * Check creature death after wounds update
 * Hook into wound system
 */
export function registerDeathChecks() {
  // Check on actor update
  Hooks.on("updateActor", async (actor, changes, options, userId) => {
    if (actor.type !== "creature") return;

    // Check if health.parts were updated (HP changes)
    if (!changes.system?.health?.parts) return;

    // Check if just died
    const wasDead = actor.getFlag("tsdc", "isDead");
    const isNowDead = isCreatureDead(actor);

    if (isNowDead && !wasDead) {
      await markCreatureDead(actor);
    }
  });

  console.log("TSDC | Death check hooks registered");
}

/**
 * Revive a creature (for testing or GM tools)
 * @param {Actor} actor
 * @returns {Promise<void>}
 */
export async function reviveCreature(actor) {
  if (!actor || actor.type !== "creature") return;

  await actor.unsetFlag("tsdc", "isDead");
  await actor.unsetFlag("tsdc", "deathTime");

  // Reset HP en todas las partes
  const parts = actor.system?.health?.parts;
  if (parts) {
    const updates = {};
    for (const [key, part] of Object.entries(parts)) {
      const maxHP = part.max || 0;
      updates[`system.health.parts.${key}.value`] = maxHP;
    }
    await actor.update(updates);
  }

  // Reset token appearance
  const tokens = actor.getActiveTokens();
  for (const token of tokens) {
    await token.document.update({
      "alpha": 1.0,
      "overlayEffect": ""
    });
  }

  ui.notifications?.info(`${actor.name} ha sido revivido.`);
}

/**
 * Get time since death (for decay/loot timers)
 * @param {Actor} actor
 * @returns {number|null} Milliseconds since death, or null if not dead
 */
export function getTimeSinceDeath(actor) {
  if (!actor || !actor.getFlag("tsdc", "isDead")) return null;

  const deathTime = actor.getFlag("tsdc", "deathTime");
  if (!deathTime) return null;

  return Date.now() - deathTime;
}

/**
 * Check if creature has decayed (materials no longer available)
 * @param {Actor} actor
 * @param {number} decayTimeMs - Time in ms before decay (default 24 hours)
 * @returns {boolean}
 */
export function hasCreatureDecayed(actor, decayTimeMs = 24 * 60 * 60 * 1000) {
  const timeSinceDeath = getTimeSinceDeath(actor);
  if (timeSinceDeath === null) return false;

  return timeSinceDeath >= decayTimeMs;
}
