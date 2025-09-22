// modules/wizard/creature-wizard.js
import { listMonsterSummaries, getBlueprintByKey } from "../monsters/loader.js";
import { applyMonsterBlueprint } from "../monsters/factory.js";

// Catálogo de Rasgos (clave → label + categoría)
export const MONSTER_TRAITS = {
  behavior: [
    { id: "behavior.hunter",       label: "Cazador",       note: "Ventaja en Ataque si el oponente ya fue dañado este turno" },
    { id: "behavior.defender",     label: "Defensor",      note: "Ventaja en Defensa y Resistencia cerca de su nido (≤10m)" },
    { id: "behavior.opportunist",  label: "Oportunista",   note: "Ventaja en Ataque si el oponente falló la Defensa previa" },
    { id: "behavior.predator",     label: "Predador",      note: "Si pasa 1 turno sin actuar, Ventaja en Ataque el siguiente" },
    { id: "behavior.resilient",    label: "Resiliente",    note: "Ventaja en Ataque si el oponente tiene estados" },
    { id: "behavior.fast_adapt",   label: "Adaptación Rápida", note: "Ventaja en Resistencia y Defensa desde el 2º efecto por clase" },
    { id: "behavior.instinct_res", label: "Resistencia Instintiva", note: "Ventaja en Resistencia <25% PS" },
    { id: "behavior.dependent",    label: "Dependiente",   note: "Ventaja en Resistencia y Defensa si tiene ≥1 aliado cerca" },
  ],
  environment: [
    { id: "env.elemental_rage", label: "Furia Elemental", note: "Ventaja en Ataque y Especialización en su elemento nativo" },
    { id: "env.like_fish",      label: "Como pez en el agua", note: "Ventaja en Ejecución de Especialización en hábitat" },
    { id: "env.master_terrain", label: "Maestro del Terreno", note: "Ventaja en Ataque y Defensa en hábitat" },
    { id: "env.night_pred",     label: "Depredador Nocturno", note: "Ventaja en Ataque y Especialización con baja visibilidad" },
  ],
  emotion: [
    { id: "emo.enraged",        label: "Enfurecido",  note: "PS<50%: Ventaja Ataque, Desventaja Defensa" },
    { id: "emo.determined",     label: "Determinado", note: "Si es el último en pie: Ventaja en todas las tiradas" },
    { id: "emo.bloodthirst",    label: "Sed de Sangre", note: "Si el rival sufre agravios: Ventaja en Ataque y Especialización" },
    { id: "emo.resentful",      label: "Resentimiento", note: "+1 acumulativo a Impacto tras cada vez que recibe daño" },
    { id: "emo.spirit_agitate", label: "Agitación Espiritual", note: "Elemento opuesto: Desventaja en Defensa y Resistencia hasta fin" },
    { id: "emo.vindesper",      label: "Desesperación Vengativa", note: "Aliados derrotados: Ventaja en todas las tiradas" },
    { id: "emo.frenzy",         label: "Frenético", note: "Si los jugadores son de mayor nivel: +1 PA" },
    { id: "emo.pride",          label: "Orgullo", note: "Daño de elemento opuesto: Ventaja en Ataque y Especialización" },
  ],
  role: [
    { id: "role.protector",  label: "Protector Inquebrantable", note: "Defendiendo a un aliado: Ventaja en Defensa y Resistencia" },
    { id: "role.aggressor",  label: "Agresor", note: "+1 PA al acertar crítico" },
    { id: "role.strategist", label: "Estratega", note: "Ventaja en Especialización al dar soporte táctico" },
    { id: "role.sentinel",   label: "Centinela", note: "Ventaja en Defensa vs. enemigos que entran/salen de su rango" },
    { id: "role.assassin",   label: "Asesino", note: "Ventaja en Ataque por sorpresa / desde sombras" },
  ],
  nature: [
    { id: "nat.mortal_persist", label: "Persistente (Mortal)", note: "Ventaja en Resistencia ante daño consecutivo del mismo enemigo" },
    { id: "nat.anom_fluid",     label: "Energía Fluctuante (Anomalía)", note: "Tras ataque elemental, Ventaja en Resistencia a ese elemento este turno" },
    { id: "nat.prim_intang",    label: "Forma Intangible (Primordial)", note: "−50% daño físico y Ventaja en Resistencia vs no elementales" },
  ],
  general: [
    { id: "gen.battle_echo",  label: "Eco de Batalla", note: "Aliado derrotado: Ventaja en Ataque" },
    { id: "gen.intimidate",   label: "Amedrentadora", note: "Ventaja en Ataque y Especialización vs criaturas con Agravios" },
    { id: "gen.evo_adapt",    label: "Adaptación Evolutiva", note: "Al recibir crítico o romper parte: Ventaja en Defensa" },
    { id: "gen.elem_mirror",  label: "Espejo Elemental", note: "Al recibir daño elemental: Ventaja en Resistencia a ese elemento (no acumulativo)" },
    { id: "gen.alpha_call",   label: "Llamada del Alfa", note: "Al recibir crítico o romper parte: aliados ganan Ventaja en Ataque" },
  ],
};

const CATS_ORDER = [
  ["comportamiento","Rasgos de Comportamiento"],
  ["entorno","Rasgos de Entorno"],
  ["estado_emocional","Rasgos de Estado Emocional"],
  ["rol","Rasgos de Rol de Batalla"],
  ["naturaleza","Rasgos por Naturaleza"],
  ["general","Rasgos Generales"]
];

const { DialogV2 } = foundry.applications.api;
const esc = (value) => foundry.utils?.escapeHTML?.(String(value ?? "")) ?? String(value ?? "");

export async function openCreatureWizard(actor) {
  if (!actor || actor.type !== "creature") return;

  try {
    // --- PASO 1: Selector de monstruo ---
    const list = await listMonsterSummaries();
    if (!Array.isArray(list) || !list.length) {
      ui.notifications?.warn("No hay criaturas registradas en el catálogo de monstruos.");
      return;
    }
    const defaultKey = actor.getFlag("tsdc", "monsterKey") ?? list?.[0]?.key ?? "";
    const step1Content = `
      <form class="tsdc wizard" style="gap:12px;">
        <p class="hint">Selecciona el monstruo base del catálogo y define los datos iniciales del actor.</p>
        <label class="t-col">
          <span class="muted">Monstruo</span>
          <select name="monsterKey">
            ${list.map(m => {
              const selected = m.key === defaultKey ? " selected" : "";
              return `<option value="${esc(m.key)}"${selected}>${esc(m.label)} (Nv ${esc(m.level)}, ${esc(m.category)})</option>`;
            }).join("")}
          </select>
        </label>
        <label class="t-col">
          <span class="muted">Nombre del actor</span>
          <input type="text" name="name" value="${esc(actor.name ?? "")}" placeholder="(opcional)">
        </label>
        <label class="t-col">
          <span class="muted">Carpeta</span>
          <input type="text" name="folderId" value="${esc(actor.folder?.id ?? "")}" placeholder="(opcional: id de carpeta)">
        </label>
      </form>
    `;

    const step1 = await DialogV2.prompt({
      window: { title: "Crear Criatura — Monstruo" },
      content: step1Content,
      ok: {
        label: "Siguiente",
        callback: (_event, button) => {
          const fd = new FormData(button.form);
          const monsterKey = String(fd.get("monsterKey") ?? "").trim() || (list?.[0]?.key ?? "");
          if (!monsterKey) return false;
          const rawFolder = String(fd.get("folderId") ?? "").trim();
          const nameValue = String(fd.get("name") ?? "").trim();
          const folderId = rawFolder === "" ? undefined : rawFolder;
          return { monsterKey, folderId, name: nameValue || undefined };
        }
      },
      cancel: { label: "Cancelar" },
      rejectClose: true
    });

    if (!step1) return; // cancelado
    const { monsterKey, folderId, name } = step1;

    // --- PASO 2: Rasgos ---
    const groups = groupTraits(); // usa el mapeo por id ya definido más abajo
    const step2Content = `
      <form class="tsdc wizard">
        <p class="hint">Marca los rasgos que aplican a esta criatura.</p>
        ${groups.map(g => renderGroup(g)).join("")}
      </form>
    `;

    const step2 = await DialogV2.prompt({
      window: { title: "Crear Criatura — Rasgos del Monstruo" },
      content: step2Content,
      ok: {
        label: "Crear",
        callback: (_event, button) => {
          const traitKeys = Array.from(button.form?.querySelectorAll('input[name="traitKey"]:checked') || [])
            .map(i => i.value);
          return { traitKeys };
        }
      },
      cancel: { label: "Cancelar" },
      rejectClose: true
    });

    if (!step2) return; // cancelado
    const { traitKeys } = step2;

    const blueprint = await getBlueprintByKey(monsterKey);
    const traits = traitKeys.map(k => {
      const def = getTraitDefById(k);
      return { key: k, label: def?.label || k, cat: def?.cat || "general" };
    });

    await applyMonsterBlueprint(actor, blueprint, { traits, folderId, name });

    await actor.sheet?.render(true);

  } catch (err) {
    console.error("TSDC | Creature Wizard error:", err);
    ui.notifications?.error("No se pudo crear la criatura. Revisa la consola (F12).");
  }
}

function buildTraitMap() {
  const map = new Map();
  for (const [cat, arr] of Object.entries(MONSTER_TRAITS)) {
    for (const t of arr) {
      map.set(t.id, { ...t, cat });
    }
  }
  return map;
}

// Devuelve [{ key: "behavior", title:"Comportamiento", items:[{key,id,label,cat}, ...] }, ...]
function groupTraits() {
  const TRAIT_MAP = buildTraitMap();
  const byCat = {};
  for (const trait of TRAIT_MAP.values()) {
    const cat = trait.cat || "general";
    (byCat[cat] ||= []).push({ key: trait.id, label: trait.label, cat });
  }
  for (const arr of Object.values(byCat)) arr.sort((a,b)=>a.label.localeCompare(b.label));

  const CATS_ORDER = [
    ["behavior",   "Rasgos de Comportamiento"],
    ["environment","Rasgos de Entorno"],
    ["emotion",    "Rasgos de Estado Emocional"],
    ["role",       "Rasgos de Rol de Batalla"],
    ["nature",     "Rasgos por Naturaleza"],
    ["general",    "Rasgos Generales"]
  ];
  return CATS_ORDER
    .map(([key, title]) => ({ key, title, items: byCat[key] || [] }))
    .filter(g => g.items.length);
}

// Helper para recuperar el label al guardar
function getTraitDefById(id) {
  const TRAIT_MAP = buildTraitMap();
  return TRAIT_MAP.get(id);
}

function renderGroup(g) {
  return `
  <fieldset class="t-fieldset">
    <legend>${esc(g.title)}</legend>
    <div class="t-grid t-cols-2">
      ${g.items.map(it => `
        <label class="t-row">
          <input type="checkbox" name="traitKey" value="${esc(it.key)}">
          <span>${esc(it.label)}</span>
        </label>
      `).join("")}
    </div>
  </fieldset>`;
}
