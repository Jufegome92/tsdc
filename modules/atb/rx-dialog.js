// modules/atb/rx-dialog.js
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

/** Prompt de Reacción (AO) con timeout. Devuelve true/false. */
export async function promptOpportunityDialog({ reactorToken, provokerToken, timeoutMs = 6500 }) {
  const actor = reactorToken?.actor;
  if (!actor) return false;

  // Si este cliente no decide, no mostramos nada (los demás clientes harán su prompt)
  if (!shouldPromptHere(reactorToken)) return false;

  const { wear, wearMax } = readWearState(actor);
  const atLimit = wear >= wearMax;

  return new Promise((resolve) => {
    let settled = false;
    const dlg = new Dialog({
      title: "Reacción: Ataque de Oportunidad",
      content: `
        <div class="t-col" style="gap:6px;">
          <p><b>${reactorToken.name}</b> puede reaccionar contra <b>${provokerToken.name}</b> (salida de melee).</p>
          <p>Desgaste: <b>${wear}</b> / <b>${wearMax}</b>${atLimit ? " — <span style='color:#c00'><b>límite alcanzado</b></span>" : ""}</p>
          <p class="muted">La reacción no altera tu ATB (I0/E0/R0). Coste: 1 Desgaste.</p>
        </div>
      `,
      buttons: {
        ok: {
          label: atLimit ? "No puedes (límite)" : "Reaccionar",
          icon: atLimit ? "fa-solid fa-ban" : "fa-solid fa-bolt",
          callback: () => { settled = true; resolve(!atLimit); }
        },
        cancel: {
          label: "Omitir",
          icon: "fa-regular fa-circle",
          callback: () => { settled = true; resolve(false); }
        }
      },
      default: atLimit ? "cancel" : "ok",
      close: () => { if (!settled) resolve(false); }
    });
    dlg.render(true);

    if (timeoutMs > 0) {
      setTimeout(() => {
        if (!settled) { try { dlg.close(); } catch {} resolve(false); }
      }, timeoutMs);
    }
  });
}
