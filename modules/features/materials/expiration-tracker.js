// modules/features/materials/expiration-tracker.js
// Sistema de tracking y notificaciones de expiración de materiales

/**
 * Check all actors for expired materials and notify
 */
export async function checkExpiredMaterials() {
  const actors = game.actors.filter(a => a.type === "character");

  for (const actor of actors) {
    await checkActorMaterials(actor);
  }
}

/**
 * Check a specific actor for expired or expiring materials
 * @param {Actor} actor
 */
export async function checkActorMaterials(actor) {
  if (!actor) return;

  const materials = actor.items.filter(i => i.type === "material" && i.system.perishable);
  if (!materials.length) return;

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;

  const expired = [];
  const expiringSoon = [];
  const expiringToday = [];

  for (const material of materials) {
    if (!material.system.expiresAt) continue;

    const expiresAt = new Date(material.system.expiresAt).getTime();
    const timeUntilExpiration = expiresAt - now;

    if (timeUntilExpiration <= 0) {
      // Expirado
      expired.push(material);
    } else if (timeUntilExpiration <= oneDayMs) {
      // Expira hoy
      expiringToday.push(material);
    } else if (timeUntilExpiration <= threeDaysMs) {
      // Expira pronto (en 3 días)
      expiringSoon.push(material);
    }
  }

  // Procesar expirados
  if (expired.length > 0) {
    await handleExpiredMaterials(actor, expired);
  }

  // Notificar sobre los que expiran pronto
  if (expiringToday.length > 0) {
    notifyExpiringMaterials(actor, expiringToday, "hoy");
  }

  if (expiringSoon.length > 0 && game.user.isGM) {
    // Solo notificar al GM sobre los que expiran en 3 días
    notifyExpiringMaterials(actor, expiringSoon, "pronto");
  }
}

/**
 * Handle expired materials (degrade quality or destroy)
 * @param {Actor} actor
 * @param {Item[]} expiredMaterials
 */
async function handleExpiredMaterials(actor, expiredMaterials) {
  for (const material of expiredMaterials) {
    const materialName = material.name;
    const isSensitive = material.system.category === "partes" &&
                       ["glandulas", "organos", "fluidos", "sistema_nervioso"].includes(material.system.key);

    if (isSensitive) {
      // Materiales sensibles se destruyen completamente
      await material.delete();

      const message = `⚠️ <strong>${materialName}</strong> de <strong>${actor.name}</strong> se ha descompuesto completamente.`;

      if (game.user.isGM) {
        ui.notifications?.warn(message);
      }

      ChatMessage.create({
        content: `<div class="tsdc material-expired">${message}</div>`,
        whisper: [game.user.id]
      });

    } else {
      // Materiales normales pierden calidad
      const currentQuality = material.system.quality || 1;

      if (currentQuality > 1) {
        // Degradar calidad
        await material.update({
          "system.quality": currentQuality - 1,
          "system.expiresAt": null, // Ya no sigue expirando
          "system.perishable": false
        });

        const message = `⚠️ <strong>${materialName}</strong> de <strong>${actor.name}</strong> ha perdido calidad (ahora Grado ${currentQuality - 1}).`;

        if (game.user.isGM) {
          ui.notifications?.warn(message);
        }

        ChatMessage.create({
          content: `<div class="tsdc material-degraded">${message}</div>`,
          whisper: [game.user.id]
        });

      } else {
        // Calidad 1 se destruye
        await material.delete();

        const message = `⚠️ <strong>${materialName}</strong> de <strong>${actor.name}</strong> se ha descompuesto completamente.`;

        if (game.user.isGM) {
          ui.notifications?.warn(message);
        }

        ChatMessage.create({
          content: `<div class="tsdc material-expired">${message}</div>`,
          whisper: [game.user.id]
        });
      }
    }
  }
}

/**
 * Notify about materials that are expiring soon
 * @param {Actor} actor
 * @param {Item[]} materials
 * @param {string} timeframe - "hoy" or "pronto"
 */
function notifyExpiringMaterials(actor, materials, timeframe) {
  const materialsList = materials.map(m => {
    const expiresAt = new Date(m.system.expiresAt);
    const hoursLeft = Math.floor((expiresAt - Date.now()) / (60 * 60 * 1000));
    return `<li><strong>${m.name}</strong> (${hoursLeft}h restantes)</li>`;
  }).join("");

  const message = `
    <div class="tsdc materials-expiring">
      <h3>⏰ Materiales expirando ${timeframe}</h3>
      <p><strong>${actor.name}</strong> tiene materiales que expiran:</p>
      <ul>${materialsList}</ul>
      <p><em>Considera aplicar kits de conservación.</em></p>
    </div>
  `;

  ChatMessage.create({
    content: message,
    whisper: [game.user.id]
  });
}

/**
 * Get summary of material expiration status for an actor
 * @param {Actor} actor
 * @returns {Object} Summary with counts and lists
 */
export function getMaterialExpirationSummary(actor) {
  if (!actor) return null;

  const materials = actor.items.filter(i => i.type === "material" && i.system.perishable);
  if (!materials.length) return null;

  const now = Date.now();
  const oneDayMs = 24 * 60 * 60 * 1000;
  const threeDaysMs = 3 * 24 * 60 * 60 * 1000;
  const oneWeekMs = 7 * 24 * 60 * 60 * 1000;

  const summary = {
    total: materials.length,
    expired: [],
    critical: [], // < 1 day
    warning: [],  // < 3 days
    caution: [],  // < 1 week
    stable: []    // > 1 week
  };

  for (const material of materials) {
    if (!material.system.expiresAt) continue;

    const expiresAt = new Date(material.system.expiresAt).getTime();
    const timeUntilExpiration = expiresAt - now;

    const info = {
      id: material.id,
      name: material.name,
      quantity: material.system.quantity,
      unit: material.system.unit,
      expiresAt: material.system.expiresAt,
      hoursLeft: Math.floor(timeUntilExpiration / (60 * 60 * 1000)),
      daysLeft: Math.floor(timeUntilExpiration / (24 * 60 * 60 * 1000))
    };

    if (timeUntilExpiration <= 0) {
      summary.expired.push(info);
    } else if (timeUntilExpiration <= oneDayMs) {
      summary.critical.push(info);
    } else if (timeUntilExpiration <= threeDaysMs) {
      summary.warning.push(info);
    } else if (timeUntilExpiration <= oneWeekMs) {
      summary.caution.push(info);
    } else {
      summary.stable.push(info);
    }
  }

  return summary;
}

/**
 * Register expiration check hooks
 */
export function registerExpirationHooks() {
  // Check on ready
  Hooks.once("ready", async () => {
    console.log("TSDC | Material expiration tracker initialized");

    // Initial check
    await checkExpiredMaterials();

    // Set up periodic checks every hour
    setInterval(async () => {
      await checkExpiredMaterials();
    }, 60 * 60 * 1000); // 1 hour
  });

  // Check when a material is created
  Hooks.on("createItem", async (item, options, userId) => {
    if (item.type === "material" && item.system.perishable && item.parent) {
      // Schedule a reminder
      const actor = item.parent;
      if (actor.type === "character") {
        await checkActorMaterials(actor);
      }
    }
  });

  // Check when opening crafting workshop
  Hooks.on("renderCraftingWorkshop", async (app, html, data) => {
    if (app.actor) {
      const summary = getMaterialExpirationSummary(app.actor);
      if (summary && (summary.expired.length > 0 || summary.critical.length > 0)) {
        // Show warning in the workshop UI
        const warningDiv = html.find(".crafting-workshop-container");
        if (warningDiv.length > 0) {
          const warning = `
            <div class="material-expiration-warning">
              <i class="fas fa-exclamation-triangle"></i>
              <span>
                ${summary.expired.length > 0 ? `${summary.expired.length} materiales expirados. ` : ''}
                ${summary.critical.length > 0 ? `${summary.critical.length} materiales expiran hoy.` : ''}
              </span>
            </div>
          `;
          warningDiv.prepend(warning);
        }
      }
    }
  });

  console.log("TSDC | Material expiration hooks registered");
}
