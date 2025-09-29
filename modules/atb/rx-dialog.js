// modules/atb/rx-dialog.js
import { APTITUDES } from "../features/aptitudes/data.js";
import { getAvailableReactions } from "./reactions.js";
const SCOPE = "tsdc";

function readWearState(actor) {
  const tenacity = Number(actor.system?.attributes?.tenacity ?? 0);
  const vigorLvl = Number(actor.system?.progression?.skills?.vigor?.level ?? 0);
  const stamina  = vigorLvl + tenacity;
  const fatigue  = Number(actor.system?.states?.fatigue ?? 0);
  const wear     = Number(actor.system?.states?.wear ?? 0);
  const wearMax  = Math.max(0, stamina - fatigue);
  return { stamina, fatigue, wear, wearMax };
}

function ownerIdsOf(token) {
  const users = game.users.filter(u => u.role >= CONST.USER_ROLES.PLAYER && u.active);
  return users
    .filter(u => token.actor?.testUserPermission?.(u, "OWNER") || token.document?.testUserPermission?.(u, "OWNER"))
    .map(u => u.id);
}

/** Devuelve true si este cliente (usuario actual) es quien debe decidir */
export function shouldPromptHere(reactorToken) {
  const owners = ownerIdsOf(reactorToken);
  if (owners.length) return owners.includes(game.user.id); // PJ propietario
  return game.user.isGM; // PNJ → GM decide
}

/** Prompt de Reacción (AO/aptitud) con timeout. Devuelve descriptor o null. */
export async function promptOpportunityDialog({ reactorToken, provokerToken, timeoutMs = 6500 }) {
  const actor = reactorToken?.actor;
  if (!actor) return null;

  if (!shouldPromptHere(reactorToken)) return null;

  const { wear, wearMax } = readWearState(actor);
  const atLimit = wear >= wearMax;

  const tree = actor.system?.progression?.aptitudes ?? {};
  const reactionAptitudes = Object.entries(tree)
    .filter(([, node]) => !!node?.known || Number(node?.rank || 0) > 0)
    .map(([key, node]) => ({ key, node, def: APTITUDES[key] }))
    .filter(item => item.def && item.def.category === "reaction")
    .map(item => ({
      key: item.key,
      label: item.def.label ?? item.key,
      rank: Number(item.node?.rank || 0)
    }))
    .sort((a, b) => a.label.localeCompare(b.label));

  return new Promise((resolve) => {
    let settled = false;
    const dlg = new Dialog({
      title: "Reacción disponible",
      content: `
        <div class="t-col" style="gap:6px;">
          <p><b>${reactorToken.name}</b> puede reaccionar contra <b>${provokerToken.name}</b>.</p>
          <p>Desgaste: <b>${wear}</b> / <b>${wearMax}</b>${atLimit ? " — <span style='color:#c00'><b>límite alcanzado</b></span>" : ""}</p>
          <p class="muted">I0/E0/R0. Coste estándar: 1 punto de Desgaste.</p>
          <label style="display:flex; flex-direction:column; gap:4px;">
            <span>Respuesta</span>
            <select name="rx-choice" ${atLimit ? "disabled" : ""}>
              <option value="ao">Ataque de Oportunidad</option>
              ${reactionAptitudes.map(opt => `<option value="apt:${opt.key}">${opt.label}${opt.rank ? ` (N${opt.rank})` : ""}</option>`).join("")}
            </select>
          </label>
        </div>
      `,
      buttons: {
        ok: {
          label: atLimit ? "No puedes (límite)" : "Reaccionar",
          icon: atLimit ? "fa-solid fa-ban" : "fa-solid fa-bolt",
          callback: () => {
            settled = true;
            if (atLimit) { resolve(null); return; }
            const val = dlg.element?.find?.('select[name="rx-choice"]')?.val?.() ?? "ao";
            if (val?.startsWith?.("apt:")) {
              resolve({ type: "aptitude", key: val.slice(4) });
            } else if (val === "ao") {
              resolve({ type: "ao" });
            } else {
              resolve(null);
            }
          }
        },
        cancel: {
          label: "Omitir",
          icon: "fa-regular fa-circle",
          callback: () => { settled = true; resolve(null); }
        }
      },
      default: atLimit ? "cancel" : "ok",
      close: () => { if (!settled) resolve(null); }
    });
    dlg.render(true);

    if (timeoutMs > 0) {
      setTimeout(() => {
        if (!settled) { try { dlg.close(); } catch {} resolve(null); }
      }, timeoutMs);
    }
  });
}

/**
 * Diálogo mejorado de reacciones con soporte para múltiples triggers y timing
 */
export async function promptReactionDialog({
  reactorToken,
  provokerToken,
  reason = "any",
  timing = "any",
  timeoutMs = 6500,
  title = "Reacción disponible"
}) {
  const actor = reactorToken?.actor;
  if (!actor) return null;

  if (!shouldPromptHere(reactorToken)) return null;

  const { wear, wearMax } = readWearState(actor);
  const atLimit = wear >= wearMax;

  // Obtener reacciones disponibles para este trigger y timing
  const availableReactions = getAvailableReactions(actor, reason, timing);

  if (availableReactions.length === 0) {
    return null; // No hay reacciones disponibles
  }

  // Construir contexto descriptivo según el trigger
  let contextText = `${reactorToken.name} puede reaccionar`;
  if (provokerToken) {
    switch (reason) {
      case "enemy-movement":
        contextText += ` al movimiento de ${provokerToken.name}`;
        break;
      case "enemy-fumble":
        contextText += ` al fallo crítico de ${provokerToken.name}`;
        break;
      case "incoming-attack":
        contextText += timing === "before-attack"
          ? ` antes del ataque de ${provokerToken.name}`
          : ` después del ataque de ${provokerToken.name}`;
        break;
      default:
        contextText += ` contra ${provokerToken.name}`;
    }
  }
  contextText += ".";

  // Construir opciones del dropdown
  const reactionOptions = availableReactions.map(reaction => {
    let label = reaction.label;

    // Agregar información adicional según el tipo
    if (reaction.type === "aptitude" && actor.system?.progression?.aptitudes?.[reaction.key]?.rank) {
      const rank = actor.system.progression.aptitudes[reaction.key].rank;
      label += ` (N${rank})`;
    }

    // Agregar timing si es relevante
    if (reaction.data?.reaction?.timing && timing === "any") {
      const timingLabel = {
        "instant": "Instantáneo",
        "before-attack": "Antes del ataque",
        "after-attack": "Después del ataque"
      }[reaction.data.reaction.timing] || reaction.data.reaction.timing;
      label += ` [${timingLabel}]`;
    }

    return {
      value: `${reaction.type}:${reaction.key}`,
      label: label,
      description: reaction.data?.effect || ""
    };
  });

  const { DialogV2 } = foundry.applications.api;

  return new Promise((resolve) => {
    let settled = false;

    const content = `
      <div class="t-col" style="gap:8px; max-width: 400px;">
        <p><b>${contextText}</b></p>

        <div style="background: rgba(255,255,255,0.05); padding: 8px; border-radius: 4px;">
          <p style="margin: 0; font-size: 0.9em;"><strong>Desgaste:</strong> ${wear} / ${wearMax}${atLimit ? " — <span style='color:#c00'><b>límite alcanzado</b></span>" : ""}</p>
          <p style="margin: 0; font-size: 0.85em; opacity: 0.7;">I0/E0/R0. Coste estándar: 1 punto de Desgaste.</p>
        </div>

        <label style="display:flex; flex-direction:column; gap:4px;">
          <span><strong>Seleccionar Reacción:</strong></span>
          <select name="reaction-choice" ${atLimit ? "disabled" : ""} style="width: 100%;">
            <option value="">-- Ninguna reacción --</option>
            ${reactionOptions.map(opt =>
              `<option value="${opt.value}" title="${opt.description}">${opt.label}</option>`
            ).join("")}
          </select>
        </label>

        <div id="reaction-description" style="font-size: 0.85em; font-style: italic; color: #888; min-height: 20px; display: none;">
          <!-- Descripción de la reacción seleccionada -->
        </div>
      </div>
    `;

    const config = {
      window: {
        title: title,
        resizable: false
      },
      content: content,
      buttons: [
        {
          action: "execute",
          label: atLimit ? "No puedes (límite)" : "Ejecutar Reacción",
          icon: atLimit ? "fa-solid fa-ban" : "fa-solid fa-bolt",
          default: !atLimit,
          disabled: atLimit,
          callback: (_event, _button, dialog) => {
            settled = true;
            if (atLimit) {
              resolve(null);
              return;
            }

            const formData = new FormData(dialog.element.querySelector("form"));
            const val = formData.get("reaction-choice") || "";

            if (!val) {
              resolve(null); // No reaction selected
              return;
            }

            const [type, key] = val.split(":");
            const selectedReaction = availableReactions.find(r => r.type === type && r.key === key);

            resolve({
              type: type,
              key: key,
              data: selectedReaction?.data,
              label: selectedReaction?.label
            });
          }
        },
        {
          action: "cancel",
          label: "Omitir",
          icon: "fa-regular fa-circle",
          callback: () => {
            settled = true;
            resolve(null);
          }
        }
      ],
      render: (_event, dialog) => {
        // Agregar funcionalidad para mostrar descripción de la reacción
        const select = dialog.element.querySelector('select[name="reaction-choice"]');
        const descDiv = dialog.element.querySelector('#reaction-description');

        if (select && descDiv) {
          select.addEventListener('change', function() {
            const selectedValue = this.value;
            if (selectedValue) {
              const [type, key] = selectedValue.split(":");
              const reaction = availableReactions.find(r => r.type === type && r.key === key);
              if (reaction?.data?.effect) {
                descDiv.textContent = reaction.data.effect;
                descDiv.style.display = 'block';
              } else {
                descDiv.style.display = 'none';
              }
            } else {
              descDiv.style.display = 'none';
            }
          });
        }
      },
      close: () => {
        if (!settled) resolve(null);
      }
    };

    const dlg = new DialogV2(config);
    dlg.render(true);

    if (timeoutMs > 0) {
      setTimeout(() => {
        if (!settled) {
          try { dlg.close(); } catch {}
          resolve(null);
        }
      }, timeoutMs);
    }
  });
}
