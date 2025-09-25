// modules/atb/rx-dialog.js
import { APTITUDES } from "../features/aptitudes/data.js";
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
