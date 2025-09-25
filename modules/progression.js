// modules/progression.js
import { TSDC } from "./config.js";
import { getBackground, getThresholdForSpec } from "./features/affinities/index.js";

const CATEGORY_ATTR_INFO = {
  physical: {
    attrs: ["strength", "agility", "tenacity"],
    hint: "física"
  },
  mental: {
    attrs: ["cunning", "wisdom", "intellect"],
    hint: "mental"
  },
  social: {
    attrs: ["aura", "composure", "presence"],
    hint: "social"
  },
  arts: {
    attrs: ["cunning", "wisdom", "intellect"],
    hint: "mental (Artes)"
  },
  knowledge: {
    attrs: ["cunning", "wisdom", "intellect"],
    hint: "mental (Saberes)"
  }
};

function attrsForCategory(cat) {
  const info = CATEGORY_ATTR_INFO[cat];
  return info ? info.attrs ?? [] : [];
}

function hintForCategory(cat) {
  return CATEGORY_ATTR_INFO[cat]?.hint ?? cat ?? "";
}

async function promptAttributeIncreaseForSpec(actor, specKey, category, rankUps = 1) {
  if (!actor?.isOwner) return;
  if (actor.type !== "character") return;
  const attrs = attrsForCategory(category);
  if (!attrs.length || !Number.isFinite(rankUps) || rankUps <= 0) return;

  let specLabel = specKey;
  try {
    const mod = await import("./features/specializations/index.js");
    const spec = mod?.getSpec?.(specKey);
    if (spec?.label) specLabel = spec.label;
  } catch (err) {
    console.warn("TSDC | promptAttributeIncreaseForSpec: getSpec failed", err);
  }

  const hint = hintForCategory(category);

  for (let i = 0; i < rankUps; i++) {
    const options = attrs.map((key) => {
      const label = game.i18n?.localize?.(`TSDC.Attr.${key}`) ?? key;
      return `<option value="${key}">${label}</option>`;
    }).join("");

    const countLabel = rankUps > 1 ? ` (${i + 1}/${rankUps})` : "";
    const res = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Incremento de Característica${countLabel}` },
      content: `
        <form class="t-col" style="gap:8px;">
          <p>Has alcanzado un nuevo rango en <b>${specLabel}</b>.<br/>Elige qué característica ${hint} aumenta.</p>
          <div class="t-field">
            <label>Característica</label>
            <select name="attr">${options}</select>
          </div>
        </form>
      `,
      ok: {
        label: "Asignar",
        callback: (_ev, button) => String(button.form.elements.attr?.value || "") || null
      },
      cancel: { label: "Omitir" }
    });

    const attrKey = attrs.includes(res) ? res : null;
    if (!attrKey) {
      ui.notifications?.info?.("Puedes asignar la característica más tarde desde la hoja de personaje.");
      break;
    }

    const path = `system.attributes.${attrKey}`;
    const current = Number(foundry.utils.getProperty(actor, path) || 0);
    await actor.update({ [path]: current + 1 });
  }
}

/** ===== Nivel → Rango (triangular) =====
 * Nivel 0 → Rango 0
 * Nivel 1 → Rango 1
 * Nivel 3 → Rango 2
 * Nivel 6 → Rango 3
 * Nivel 10 → Rango 4
 * r = floor((sqrt(8*L + 1) - 1) / 2)
 */
export function levelToRank(level = 0) {
  const L = Math.max(0, Number(level || 0));
  return Math.floor((Math.sqrt(8 * L + 1) - 1) / 2);
}

/** ¿Cuántos “ticks” necesito para subir 1 nivel? */
export function trackThreshold(actor, trackType, key) {
  // Skills dependen de la categoría y del trasfondo (afinidad mayor)
  if (trackType === "skills") {
    const node = actor?.system?.progression?.skills?.[key] ?? {};
    const cat = node?.category ?? null;

    if (cat) {
      // Usa helper centralizado de afinidades
      return getThresholdForSpec(actor, cat);
    }

    // Si no tenemos categoría aún, usa la afinidad mayor como pista; si no, MINOR por defecto.
    const major = getBackground(actor)?.major ?? null;
    return major ? TSDC.MAJOR_THRESHOLD : TSDC.MINOR_THRESHOLD;
  }

  // Otras pistas: weapons, maneuvers, defense, armor, resistances...
  return TSDC.MINOR_THRESHOLD;
}

/** Asegura que exista system.progression.<trackType>.<key> con la forma esperada */
async function ensureTrackShape(actor, trackType, key) {
  if (!key) return false;
  const base = `system.progression.${trackType}`;
  const existing = foundry.utils.getProperty(actor, `${base}.${key}`);
  if (existing) return false;

  const patch = {};
  patch[`${base}.${key}`] = { level: 0, rank: 0, progress: 0, fails: 0 };
  await actor.update(patch);
  return true;
}

/** Fija el nivel de una pista (resetea progreso) y recalcula rango */
export async function setTrackLevel(actor, trackType, key, level = 1) {
  if (!key) return;
  await ensureTrackShape(actor, trackType, key);

  const path = `system.progression.${trackType}.${key}`;
  const cur  = foundry.utils.getProperty(actor, path) ?? { level: 0, rank: 0, progress: 0, fails: 0 };

  const L = Math.max(0, Number(level || 0));
  const next = {
    ...cur,
    level: L,
    rank: levelToRank(L),
    progress: 0
  };

  await actor.update({ [path]: next });
}

/** Suma fallos (misma semántica que ya tenías) */
export async function addFail(actor, trackType, key, amount = 1) {
  await ensureTrackShape(actor, trackType, key);
  const path = `system.progression.${trackType}.${key}`;
  const data = foundry.utils.getProperty(actor, path);
  if (!data) return 0;

  data.fails = Math.max(0, Number(data.fails || 0) + Number(amount || 0));
  await actor.update({ [path]: data });
  return data.fails;
}

/** Aplica progreso; si supera umbral sube nivel y recalcula rango */
export async function addProgress(actor, trackType, key, amount = 1) {
  await ensureTrackShape(actor, trackType, key);

  const path = `system.progression.${trackType}.${key}`;
  const data = foundry.utils.getProperty(actor, path);
  if (!data) return { leveled: false };

  const prevLevel = Number(data.level || 0);
  const prevRank = levelToRank(prevLevel);

  // Para skills: si falta la categoría, intenta inferirla y guardarla
  if (trackType === "skills" && !data.category) {
    try {
      const { getCategoryForSpec } = await import("./features/specializations/index.js");
      const cat = getCategoryForSpec?.(key);
      if (cat) data.category = cat;
    } catch (err) {
      console.warn("TSDC | addProgress: no se pudo inferir categoría de la skill", err);
    }
  }

  data.progress = Math.max(0, Number(data.progress || 0) + Number(amount || 0));
  let leveled = false;

  const threshold = trackThreshold(actor, trackType, key);
  while (data.progress >= threshold) {
    data.progress -= threshold;
    data.level = Math.max(0, Number(data.level || 0) + 1);
    leveled = true;
  }

  data.rank = levelToRank(data.level);

  await actor.update({ [path]: data });
  const rankUps = Math.max(0, data.rank - prevRank);
  if (trackType === "skills" && rankUps > 0) {
    await promptAttributeIncreaseForSpec(actor, key, data.category, rankUps);
  }

  return { leveled, level: data.level, rank: data.rank, progress: data.progress };
}

/** ===== Coherencia automática de rango cuando alguien toca .level directo ===== */
Hooks.on("preUpdateActor", (actor, update) => {
  try {
    const prog = update?.system?.progression;
    if (!prog || typeof prog !== "object") return;

    function visit(obj) {
      for (const [k, v] of Object.entries(obj)) {
        if (v && typeof v === "object" && !("level" in v)) {
          visit(v); // baja un nivel (trackType / key)
          continue;
        }
        if (v && typeof v === "object" && Object.prototype.hasOwnProperty.call(v, "level")) {
          const L = Number(v.level);
          if (Number.isFinite(L)) v.rank = levelToRank(L);
        }
      }
    }

    visit(prog);
  } catch (err) {
    console.warn("TSDC | preUpdateActor rank coherence failed:", err);
  }
});
