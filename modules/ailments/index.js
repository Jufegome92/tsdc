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
 * - magnitude?: number  (rango/nivel del atacante para escalar penalizadores)
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

  const severityOrder = { leve: 0, grave: 1, critico: 2 };
  const existing = active[def.id];

  const desiredSeverity = (sev && def.severable) ? sev : null;
  const finalSeverity = (() => {
    if (!def.severable) return null;
    if (!existing?.severity) return desiredSeverity;
    if (!desiredSeverity) return existing.severity;
    return (severityOrder[desiredSeverity] ?? -1) >= (severityOrder[existing.severity] ?? -1)
      ? desiredSeverity
      : existing.severity;
  })();

  const durationNode = opts.duration || def.duration || existing?.duration || { type: "untilTreated" };
  const remainingRounds = computeRemainingRounds(durationNode);

  if (existing) {
    const updated = {
      ...existing,
      label: def.label,
      group: def.group,
      severity: finalSeverity,
      duration: durationNode,
      remainingRounds: durationNode?.type === "rounds" ? remainingRounds : existing.remainingRounds ?? null,
      appliedAt: Date.now(),
      notes: opts.notes ?? existing.notes ?? null,
      source: opts.source ?? existing.source ?? null,
      kind: opts.kind ?? existing.kind ?? null,
      magnitude: opts.magnitude != null ? Number(opts.magnitude) : existing.magnitude ?? null
    };

    active[def.id] = updated;
    await setActive(actor, active);

    const msgSeverity = updated.severity ? ` <span class="muted">(Sev. ${updated.severity.toUpperCase()})</span>` : "";
    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<b>${actor.name}</b> sigue afectado por <b>${def.label}</b>${msgSeverity}. La duración se renueva.`
    });

    if (def.grantsBySeverity && updated.severity) {
      const grantIds = def.grantsBySeverity[updated.severity] || [];
      for (const gid of grantIds) {
        if (gid === def.id) continue;
        const childDef = CATALOG[gid];
        const childOpts = {
          source: `${def.id}:${updated.severity}`,
          kind: opts.kind || null
        };
        if (childDef?.severable) childOpts.severity = updated.severity;
        await addAilment(actor, gid, childOpts);
      }
    }

    return updated;
  }

  const state = {
    id: def.id,
    label: def.label,
    group: def.group,
    severity: finalSeverity,
    duration: durationNode,
    remainingRounds,
    appliedAt: Date.now(),
    notes: opts.notes || null,
    source: opts.source || null,
    kind: opts.kind || null,
    magnitude: opts.magnitude != null ? Number(opts.magnitude) : null
  };

  active[def.id] = state;
  await setActive(actor, active);

  // Mensaje al chat
  const extra =
    (state.severity ? ` <span class="muted">(Severidad: ${state.severity.toUpperCase()})</span>` : "") +
    (Array.isArray(def.effectsText) && def.effectsText.length
      ? `<div class="muted" style="margin-top:4px;">${def.effectsText.map(t => `• ${t}`).join("<br>")}</div>`
      : "");
  const durationText =
    durationNode?.type === "rounds" ? ` (${remainingRounds} ronda${remainingRounds===1?"":"s"})`
    : durationNode?.type === "untilTreated" ? " (hasta ser tratado)"
    : durationNode?.type === "permanent" ? " (permanente)"
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
const STATIC_AILMENT_MODIFIERS = {};

function mergeCtAdjust(a = {}, b = {}) {
  const out = {
    init: Number(a.init ?? a.I ?? 0),
    exec: Number(a.exec ?? a.E ?? 0),
    rec: Number(a.rec ?? a.R ?? 0)
  };
  out.init += Number(b.init ?? b.I ?? 0);
  out.exec += Number(b.exec ?? b.E ?? 0);
  out.rec += Number(b.rec ?? b.R ?? 0);
  return out;
}

function accumulateMechanics(base, chunk) {
  if (!chunk) return base;
  const out = { ...base };
  if (Array.isArray(chunk.rollModifiers)) {
    out.rollModifiers = [
      ...(out.rollModifiers ?? []),
      ...chunk.rollModifiers.map(mod => ({ ...mod }))
    ];
  }
  if (chunk.ctAdjust) {
    out.ctAdjust = mergeCtAdjust(out.ctAdjust, chunk.ctAdjust);
  }
  if (chunk.movementBlocked) {
    out.movementBlocked = true;
  }
  if (typeof chunk.movementMultiplier === "number") {
    const mult = Number(chunk.movementMultiplier) || 0;
    out.movementMultiplier = (out.movementMultiplier ?? 1) * mult;
  }
  if (typeof chunk.movementFlat === "number") {
    out.movementFlat = (out.movementFlat ?? 0) + Number(chunk.movementFlat || 0);
  }
  if (chunk.escape) {
    out.escape = { ...(out.escape ?? {}), ...chunk.escape };
  }
  return out;
}

export function resolveAilmentMechanics(def, state) {
  if (!def?.mechanics) return null;
  const mechanics = def.mechanics;
  let combined = {};
  const auxKeys = new Set(["common", "severity"]);

  const simple = Object.fromEntries(Object.entries(mechanics).filter(([k]) => !auxKeys.has(k)));
  combined = accumulateMechanics(combined, simple);
  if (mechanics.common) combined = accumulateMechanics(combined, mechanics.common);
  if (mechanics.severity && state?.severity) {
    const sevChunk = mechanics.severity[state.severity];
    if (sevChunk) combined = accumulateMechanics(combined, sevChunk);
  }
  return Object.keys(combined).length ? combined : null;
}

export function hasMovementBlock(actor) {
  return listActive(actor).some(st => {
    const def = CATALOG[st.id];
    const mech = resolveAilmentMechanics(def, st);
    return !!mech?.movementBlocked;
  });
}

export function getMovementImpact(actor) {
  const base = { movementBlocked: false, movementMultiplier: 1, movementFlat: 0 };
  if (!actor) return base;
  for (const st of listActive(actor)) {
    const def = CATALOG[st.id];
    const mech = resolveAilmentMechanics(def, st);
    if (!mech) continue;
    if (mech.movementBlocked) base.movementBlocked = true;
    if (typeof mech.movementMultiplier === "number") {
      base.movementMultiplier *= mech.movementMultiplier;
    }
    if (typeof mech.movementFlat === "number") {
      base.movementFlat += mech.movementFlat;
    }
  }
  return base;
}

function modMatchesContext(mod, ctx, loweredTags) {
  if (mod.phases && !mod.phases.includes(ctx.phase)) return false;
  if (mod.tag && mod.tag !== ctx.tag) return false;
  if (mod.resTypes && !mod.resTypes.includes(ctx.resType)) return false;
  if (Array.isArray(mod.tagsAll) && mod.tagsAll.some(t => !loweredTags.includes(t.toLowerCase()))) return false;
  if (Array.isArray(mod.tagsAny) && !mod.tagsAny.some(t => loweredTags.includes(t.toLowerCase()))) return false;
  return true;
}

if (globalThis?.Hooks && !globalThis.__tsdcAilmentModsHooked) {
  globalThis.__tsdcAilmentModsHooked = true;
  Hooks.on("tsdc:collectModifiers", (ctx, push) => {
    try {
      const actor = ctx?.actor;
      if (!actor || typeof push !== "function") return;

      const active = listActive(actor);
      if (!Array.isArray(active) || !active.length) return;
      const loweredTags = Array.isArray(ctx?.tags)
        ? ctx.tags.map(t => String(t).toLowerCase())
        : [];

      for (const ailment of active) {
        const mods = STATIC_AILMENT_MODIFIERS[ailment.id];
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

        const def = CATALOG[ailment.id];
        const mech = resolveAilmentMechanics(def, ailment);
        if (mech?.rollModifiers) {
          for (const mod of mech.rollModifiers) {
            if (!modMatchesContext(mod, ctx, loweredTags)) continue;

            // Calcular el valor del modificador
            let value = Number(mod.value || 0);

            // Si el modificador es dinámico (usa magnitude) y el agravio tiene magnitud
            if (mod.useMagnitude && ailment.magnitude != null) {
              // Rango de competencia = penalizador directo
              // Rango 1 → -1, Rango 2 → -2, Rango 3 → -3, etc.
              const rank = Number(ailment.magnitude);
              value = -Math.abs(rank);
            }

            if (!Number.isFinite(value) || value === 0) continue;
            push({
              id: `ailment:${ailment.id.toLowerCase()}`,
              label: mod.label ?? def?.label ?? ailment.id,
              value,
              amount: value,
              sourceType: "state",
              when: { phases: mod.phases }
            });
          }
        }
      }
    } catch (err) {
      console.warn("TSDC | error agregando modificadores de agravios", err);
    }
  });
}
