// modules/ailments/index.js
import { CATALOG } from "./catalog.js";

/** ===== Helpers de dado y duración ===== */
function rollDice(expr) {
  if (typeof expr === "number") return expr;
  const m = String(expr || "").match(/^(\d+)d(\d+)$/i);
  if (!m) return Number(expr) || 0;
  const n = Number(m[1]); const d = Number(m[2]);
  let total = 0;
  for (let i=0;i<n;i++) total += (1 + Math.floor(Math.random()*d));
  return total;
}

function computeRemainingRounds(dur) {
  if (!dur || !dur.type) return null;
  if (dur.type === "rounds") return rollDice(dur.value ?? 0);
  // untilTreated | permanent | instant → sin countdown
  return null;
}

/** ===== Getters / shape ===== */
function getBag(actor) {
  return actor?.system?.ailments ?? {};
}
function getActive(actor) {
  return getBag(actor).active ?? {};
}
function setActive(actor, dict) {
  return actor.update({ "system.ailments.active": dict });
}
async function ensureBag(actor) {
  const bag = getBag(actor);
  if (!bag || bag.active == null) {
    await actor.update({ "system.ailments": { active: {}, loadPoints: 0 }});
  }
}

/** ===== API pública ===== */

/**
 * Aplica un agravio/alteración al actor.
 * opts:
 * - severity?: "leve"|"grave"|"critico"  (si el catálogo lo soporta)
 * - duration?: {type, value}  (si quieres forzar otra duración)
 * - notes?: string
 * - source?: string  (p.ej. "resistance:poison")
 * - kind?: string    (metadato opcional)
 */
export async function addAilment(actor, id, opts={}) {
  if (!actor || !id) return null;
  const def = CATALOG[id];
  if (!def) {
    ui.notifications?.warn(`Agravio desconocido: ${id}`);
    return null;
  }
  await ensureBag(actor);

  const active = { ...getActive(actor) };

  // Construye estado
  const sev = opts.severity && def.severable ? String(opts.severity).toLowerCase() : null;
  const dur = opts.duration || def.duration || { type: "untilTreated" };
  const remainingRounds = computeRemainingRounds(dur);

  const state = {
    id: def.id,
    label: def.label,
    group: def.group,
    severity: sev,                      // null o "leve|grave|critico"
    duration: dur,                      // se guarda la forma de duración
    remainingRounds,                    // si aplica
    appliedAt: Date.now(),
    notes: opts.notes || null,
    source: opts.source || null,
    kind: opts.kind || null
  };

  active[def.id] = state;
  await setActive(actor, active);

  // Mensaje al chat
  const extra =
    (sev ? ` <span class="muted">(Severidad: ${sev.toUpperCase()})</span>` : "") +
   (Array.isArray(def.effectsText) && def.effectsText.length
     ? `<div class="muted" style="margin-top:4px;">${def.effectsText.map(t => `• ${t}`).join("<br>")}</div>`
     : ""
   );
  const durationText =
    dur?.type === "rounds" ? ` (${remainingRounds} ronda${remainingRounds===1?"":"s"})`
    : dur?.type === "untilTreated" ? " (hasta ser tratado)"
    : dur?.type === "permanent" ? " (permanente)"
    : "";

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<b>${actor.name}</b> sufre <b>${def.label}</b>${extra}${durationText}.`
  });

  if (def.grantsBySeverity && state.severity) {
    const grantIds = def.grantsBySeverity[state.severity] || [];
    if (Array.isArray(grantIds) && grantIds.length) {
      for (const gid of grantIds) {
        if (gid === def.id) continue;
        const childDef = CATALOG[gid];
        const childOpts = {
          source: `${def.id}:${state.severity}`,
          kind: opts.kind || null
        };
        if (childDef?.severable) childOpts.severity = state.severity; // <-- hereda
        await addAilment(actor, gid, childOpts);
      }
      // Mensaje-resumen opcional
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<span class="muted">${def.label}: aplicadas alteraciones asociadas (${grantIds.join(", ")}).</span>`
      });
    }
  }

  return state;
}

export async function removeAilment(actor, id, { silent=false } = {}) {
  if (!actor || !id) return false;
  await ensureBag(actor);
  const active = { ...getActive(actor) };
  if (!active[id]) return false;
  delete active[id];
  await setActive(actor, active);
  if (!silent) {
    const def = CATALOG[id];
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<b>${actor.name}</b> ya no está afectado por <b>${def?.label || id}</b>.`
    });
  }
  return true;
}

export function isActive(actor, id) {
  return !!getActive(actor)[id];
}

export function listActive(actor) {
  const dict = getActive(actor);
  return Object.values(dict);
}

export async function clearAll(actor) {
  await ensureBag(actor);
  await actor.update({ "system.ailments.active": {} });
}

/** Carga acumulada (p. ej. por fallar TR) */
export async function incrementAilmentLoad(actor, amount=1, reason="") {
  await ensureBag(actor);
  const cur = Number(actor.system?.ailments?.loadPoints || 0);
  const next = Math.max(0, cur + Number(amount || 0));
  await actor.update({ "system.ailments.loadPoints": next });
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `Carga de agravios: <b>${cur}</b> → <b>${next}</b>${reason?` <span class="muted">(${reason})</span>`:""}.`
  });
  return next;
}

/**
 * Avanza 1 ronda: decrementa y expira lo que sea por rondas.
 * (La llamas en tu Hook de combate/turno, como ya hiciste.)
 */
export async function tickPerRound(actor) {
  const dict = { ...getActive(actor) };
  let changed = false;
  for (const id of Object.keys(dict)) {
    const st = dict[id];
    if (!st?.duration || st.duration.type !== "rounds") continue;
    if (typeof st.remainingRounds !== "number") continue;
    st.remainingRounds = Math.max(0, st.remainingRounds - 1);
    changed = true;

    // Aviso de countdown opcional
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<span class="muted">${st.label}: ${st.remainingRounds} ronda(s) restantes.</span>`
    });

    if (st.remainingRounds <= 0) {
      // expira
      await ChatMessage.create({
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `<b>${st.label}</b> se disipa en ${actor.name}.`
      });
      delete dict[id];
    } else {
      dict[id] = st;
    }
  }
  if (changed) {
    await setActive(actor, dict);
  }
}

/** Azúcar: cambiar severidad (si aplica) */
export async function setSeverity(actor, id, severity) {
  const active = { ...getActive(actor) };
  const st = active[id];
  const def = CATALOG[id];
  if (!st || !def?.severable) return false;
  st.severity = String(severity || "").toLowerCase();
  active[id] = st;
  await setActive(actor, active);
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `${def.label}: severidad ahora es <b>${st.severity.toUpperCase()}</b>.`
  });
  return true;
}

/** ===== Modificadores contextuales para tiradas ===== */
const AILMENT_MODIFIERS = {
  DERRIBADO: [
    { phases: ["defense"], value: -2, label: "Derribado" }
  ],
  DESEQUILIBRADO: [
    { phases: ["defense"], value: -2, label: "Desequilibrado" }
  ],
  ATERRORIZADO: [
    { phases: ["attack", "defense"], value: -2, label: "Aterrorizado" }
  ],
  IMPEDIDO: [
    { phases: ["attack", "defense", "save"], value: -2, label: "Impedido" }
  ],
  ATURDIDO: [
    { phases: ["defense", "save"], value: -2, label: "Aturdido" }
  ],
  SOBRECARGADO: [
    { phases: ["defense", "save"], value: -2, label: "Sobrecargado" }
  ],
  ASFIXIADO: [
    { phases: ["defense", "save"], value: -1, label: "Asfixiado" }
  ],
  CEGADO: [
    { phases: ["attack", "defense"], value: -5, label: "Cegado" }
  ]
};

if (globalThis?.Hooks && !globalThis.__tsdcAilmentModsHooked) {
  globalThis.__tsdcAilmentModsHooked = true;
  Hooks.on("tsdc:collectModifiers", (ctx, push) => {
    try {
      const actor = ctx?.actor;
      if (!actor || typeof push !== "function") return;

      const active = listActive(actor);
      if (!Array.isArray(active) || !active.length) return;

      for (const ailment of active) {
        const mods = AILMENT_MODIFIERS[ailment.id];
        if (!mods) continue;
        for (const mod of mods) {
          if (mod.phases && !mod.phases.includes(ctx.phase)) continue;
          push({
            id: `ailment:${ailment.id.toLowerCase()}`,
            label: mod.label,
            value: Number(mod.value || 0),
            amount: Number(mod.value || 0),
            sourceType: "state",
            when: { phases: mod.phases }
          });
        }
      }
    } catch (err) {
      console.warn("TSDC | error agregando modificadores de agravios", err);
    }
  });
}
