// modules/wizard/character-wizard.js
import { listSpecies, getSpeciesByKey, rangesFromSpecies, applySpecies } from "../features/species/index.js";
import { BACKGROUNDS, setBackground, applyBackgroundStartingCompetences } from "../features/affinities/index.js";
import { listSpecs, getCategoryForSpec } from "../features/specializations/index.js";
import { recomputeSynapseBudget, ATTRS_BY_CATEGORY, applySynapseAllocations } from "../features/synapse/index.js";
import { BACKGROUND_STARTING } from "../features/affinities/starting.js";

export async function openCharacterWizard(actor) {
  if (!actor) return;
  const locked = !!actor.system?.identity?.locked;
  if (locked) return;

  // ===== Paso 1: Identidad + Especie + Trasfondo (ya existente) =====
  const species = listSpecies();
  const curKey  = actor.system?.species?.key ?? species[0]?.key ?? "";
  const sp      = getSpeciesByKey(curKey);
  const ranges  = rangesFromSpecies(sp);

  const bgs = Object.values(BACKGROUNDS).filter(b => b.key !== "none");

  const dflt = {
    playerName:    actor.system?.identity?.playerName ?? "",
    characterName: actor.name ?? "",
    gender:        actor.system?.identity?.gender ?? "",
    speciesKey:    curKey,
    age:           actor.system?.identity?.age ?? "",
    heightCm:      actor.system?.identity?.heightCm ?? "",
    weightKg:      actor.system?.identity?.weightKg ?? "",
    backgroundKey: actor.system?.background?.key && actor.system.background.key !== "none"
                  ? actor.system.background.key
                  : (bgs[0]?.key ?? "wanderer"),
    story:         actor.system?.identity?.story ?? ""
  };

  const hint = (r) => !r ? "" : (r.min!=null && r.max!=null ? `(${r.min} – ${r.max})` : "");
  const hAge = hint(ranges?.age);
  const hHcm = hint(ranges?.heightCm);
  const hWkg = hint(ranges?.weightKg);

  const renderStep1 = (state) => `
    <form class="t-col" style="gap:12px;">
      <div class="grid grid-2" style="gap:12px;">
        <label class="t-col">
          <span class="muted">Nombre de Jugador</span>
          <input name="playerName" type="text" value="${state.playerName}" required>
        </label>
        <label class="t-col">
          <span class="muted">Nombre de Personaje</span>
          <input name="characterName" type="text" value="${state.characterName}" required>
        </label>
      </div>

      <div class="grid grid-2" style="gap:12px;">
        <label class="t-col">
          <span class="muted">Género</span>
          <input name="gender" type="text" value="${state.gender}">
        </label>
        <label class="t-col">
          <span class="muted">Especie</span>
          <select name="speciesKey">
            ${species.map(s => `<option value="${s.key}" ${s.key===state.speciesKey ? "selected" : ""}>${s.label}</option>`).join("")}
          </select>
          <small class="muted" data-species-label>
            ${(getSpeciesByKey(state.speciesKey)?.label) ?? ""}
          </small>
        </label>
      </div>

      <div class="grid grid-3" style="gap:12px;">
        <label class="t-col">
          <span class="muted">Edad <small data-hint="age">${hAge}</small></span>
          <input name="age" type="number" min="0" value="${state.age}">
        </label>
        <label class="t-col">
          <span class="muted">Estatura (cm) <small data-hint="height">${hHcm}</small></span>
          <input name="heightCm" type="number" min="0" value="${state.heightCm}">
        </label>
        <label class="t-col">
          <span class="muted">Peso (kg) <small data-hint="weight">${hWkg}</small></span>
          <input name="weightKg" type="number" min="0" value="${state.weightKg}">
        </label>
      </div>

      <label class="t-col">
        <span class="muted">Trasfondo</span>
        <select name="backgroundKey">
          ${bgs.map(b => `<option value="${b.key}" ${b.key===state.backgroundKey?"selected":""}>${b.label}</option>`).join("")}
        </select>
      </label>

      <label class="t-col">
        <span class="muted">Historia</span>
        <textarea name="story" rows="3">${state.story ?? ""}</textarea>
      </label>
    </form>
  `;
  let step1Data = null;
  const res1 = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Creación de Personaje — Paso 1" },
    content: renderStep1(dflt),
    ok: {
      label: "Continuar",
      callback: (_event, button) => {
        const f  = button.form;
        const fd = new FormData(f);
        const o  = Object.fromEntries(fd.entries());
        o.age      = Number(o.age)      || 0;
        o.heightCm = Number(o.heightCm) || 0;
        o.weightKg = Number(o.weightKg) || 0;
        o.backgroundKey = String(o.backgroundKey || "");
        o.speciesKey    = String(o.speciesKey || "");
        step1Data = o;
        return o;
      }
    },
    cancel: { label: "Cancelar" },
    form: {
      // (opcional) para que ENTER envíe el form
      submitOnChange: false
    },
    render: ({ element }) => {
      const root = element?.[0] ?? element;
      if (!root || !root.querySelector) return;

      const sel     = root.querySelector('select[name="speciesKey"]');
      const ageN    = root.querySelector('[data-hint="age"]');
      const heightN = root.querySelector('[data-hint="height"]');
      const weightN = root.querySelector('[data-hint="weight"]');
      const spLbl   = root.querySelector('[data-species-label]');

      const ageI = root.querySelector('input[name="age"]');
      const hI   = root.querySelector('input[name="heightCm"]');
      const wI   = root.querySelector('input[name="weightKg"]');

      const getDef = (k) =>
        species.find(s => s.key === k) || getSpeciesByKey(k) || null;

      const setHint = (I, N, R) => {
        if (!I || !N) return;
        const has = R && R.min != null && R.max != null;
        N.textContent = has ? `(${R.min} – ${R.max})` : "";
        if (has) {
          I.min = String(R.min); I.max = String(R.max);
          const v = Number(I.value || 0);
          if (v < R.min) I.value = String(R.min);
          if (v > R.max) I.value = String(R.max);
        } else {
          I.removeAttribute("min"); I.removeAttribute("max");
        }
      };

      const applyRanges = (spKey) => {
        const def = getDef(spKey);
        const r   = rangesFromSpecies(def);
        setHint(ageI, ageN, r?.age);
        setHint(hI,   heightN, r?.heightCm);
        setHint(wI,   weightN, r?.weightKg);
        if (spLbl) spLbl.textContent = def?.label ?? (sel?.options[sel.selectedIndex]?.textContent ?? "");
      };

      if (sel) {
        const update = () => applyRanges(sel.value);
        sel.addEventListener("change", update);
        sel.addEventListener("input",  update);
        sel.addEventListener("blur",   update); // por si el skin sólo dispara al perder foco
        // Inicial
        update();
      }
    }
  });

  console.log("[Wizard/Paso1] action =", res1, "data =", step1Data);
  if (!res1) return; 
  const res1Data = res1;

  // Aplica especie + trasfondo + identidad LOCK
  const safeName = String(res1Data.characterName ?? actor.name ?? "Personaje");
  await applySpecies(actor, res1Data.speciesKey);
  await setBackground(actor, res1Data.backgroundKey);
  await actor.update({
    "system.progression.skills.vigor.level": 1,
    "system.progression.skills.vigor.category": "physical"
  });
  await actor.update({
    name: safeName,
    "system.identity.playerName": res1Data.playerName,
    "system.identity.gender":     res1Data.gender,
    "system.identity.age":        Number.isFinite(res1Data.age)      ? res1Data.age      : null,
    "system.identity.heightCm":   Number.isFinite(res1Data.heightCm) ? res1Data.heightCm : null,
    "system.identity.weightKg":   Number.isFinite(res1Data.weightKg) ? res1Data.weightKg : null,
    "system.identity.story":      res1Data.story,
    "system.identity.locked":     true
  });

  // ===== Paso 2: Competencias iniciales por Trasfondo =====
  const bg = BACKGROUNDS[res1Data.backgroundKey] ?? BACKGROUNDS.none;
  const allSpecs = listSpecs(); // [{ key, label, category, ... }]

  console.log("BG key raw:", res1Data.backgroundKey);
  console.log("BACKGROUNDS keys:", Object.keys(BACKGROUNDS));

  const norm = (k) => String(k||"")
    .toLowerCase()
    .replace(/\s+/g, "")     // quita espacios
    .replace(/[^a-z]/g, ""); // quita guiones, guiones bajos, etc.

  const STARTING_BY_NORM = Object.fromEntries(
    Object.entries(BACKGROUND_STARTING)
      .map(([k,v]) => [norm(k), v])
  );

  const k = String(res1Data.backgroundKey || "").toLowerCase();

  const starting =
    /martial|marcial/.test(k)    ? BACKGROUND_STARTING.martial  :
    /artisan|artesano|oficio/.test(k) ? BACKGROUND_STARTING.artisan  :
    /wander|vagab|errant|n[oó]mad/.test(k) ? BACKGROUND_STARTING.wanderer :
    /warden|guard|vig|custodi/.test(k) ? BACKGROUND_STARTING.warden   :
    /noble|aristo/.test(k)      ? BACKGROUND_STARTING.noble    :
    STARTING_BY_NORM[norm(k)]   ?? null;

  // Construimos un "plan" homogéneo a lo que antes llamábamos picks:
  function planFromStarting(st) {
    if (!st) return [];
    const plan = [];
    const pushIf = (cat, count) => { if (Number(count||0) > 0) plan.push({ category: cat, count: Number(count) }); };

    pushIf("physical",  st.physical);
    pushIf("mental",    st.mental);
    pushIf("social",    st.social);
    pushIf("arts",      st.arts);
    pushIf("knowledge", st.knowledge);

    // "any" permite elegir en cualquier categoría
    if (Number(st.any||0) > 0) {
      plan.push({ category: "flex:physical|mental|social|arts|knowledge", count: Number(st.any) });
    }
    return plan;
  }

  const picksPlan = planFromStarting(starting);

  // Helper para resolver bloques flexibles “flex:a|b|c”
  function categoriesFromToken(token) {
    if (!token?.startsWith("flex:")) return [token];
    const rest = token.slice(5);
    return rest.split("|").map(s => s.trim()).filter(Boolean);
  }

  // Construye UI de picks
  function renderStep2(selections) {
    if (!picksPlan.length) {
      return `<form class="t-col" style="gap:12px;">
        <div class="muted">Este trasfondo no concede competencias iniciales.</div>
      </form>`;
    }

    const rows = picksPlan.map((p, idx) => {
      const cats = categoriesFromToken(p.category);
      const options = cats.map(cat => {
        const specs = allSpecs.filter(s => s.category === cat);
        return `
          <div class="t-col">
            <div class="muted" style="font-size:12px;margin-bottom:4px;">${cat.toUpperCase()}</div>
            ${Array.from({length: p.count}).map((_,i) => {
              const name = `pick_${idx}_${cat}_${i}`;
              const chosen = selections[name] || "";
              return `
                <select name="${name}">
                  <option value="">— Elegir —</option>
                  ${specs.map(s => `<option value="${s.key}" ${s.key===chosen?"selected":""}>${s.label}</option>`).join("")}
                </select>
              `;
            }).join("")}
          </div>
        `;
      }).join("");

      const labelTxt = (p.category.startsWith("flex:"))
        ? `Elegir ${p.count} en (${categoriesFromToken(p.category).join(" / ")})`
        : `Elegir ${p.count} en ${p.category.toUpperCase()}`;

      return `
        <div class="t-card" style="padding:12px;">
          <div class="muted" style="margin-bottom:6px;">${labelTxt}</div>
          <div class="grid grid-${Math.min(cats.length,4)}" style="gap:12px;">${options}</div>
        </div>
      `;
    }).join("");

    return `
      <form class="t-col" style="gap:12px;">
        ${rows || `<div class="muted">Este trasfondo no concede competencias iniciales.</div>`}
      </form>
    `;
  }

  console.log("[Wizard/Paso2] starting =", starting, "plan =", picksPlan);
  
  let step2Data = null;
  const res2 = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Creación de Personaje — Paso 2 (Competencias iniciales)" },
    content: renderStep2({}),
    ok: {
      label: "Continuar",
      callback: (_event, button) => {
        const fd = new FormData(button.form);
        step2Data = Object.fromEntries(fd.entries());
        return step2Data;
      }
    },
    cancel: { label: "Atrás" }
  });
  if (!res2) return;
  const picks = res2;

  // Normaliza las selecciones hacia { byCategory: {cat: [specKey,...]} }
  const byCat = {};
  for (const [idx, p] of picksPlan.entries()) {
    const cats = categoriesFromToken(p.category);
    // Tomamos lo elegido en cualquiera de las columnas de ese bloque
    for (const cat of cats) {
      const chosen = [];
      for (let i = 0; i < p.count; i++) {
        const name = `pick_${idx}_${cat}_${i}`;
        const val = picks[name];
        if (val) chosen.push(val);
      }
      if (chosen.length) {
        if (p.category.startsWith("flex:")) {
          for (const key of chosen) {
            const realCat = getCategoryForSpec(key);
            if (realCat) (byCat[realCat] ??= []).push(key);
          }
        } else {
          byCat[cat] = (byCat[cat] ?? []).concat(chosen);
        }
      }
    }
  }

  await applyBackgroundStartingCompetences(actor, res1Data.backgroundKey, { byCategory: byCat });

  // ===== Paso 3: Sinapsis (gasto de puntos por categoría en atributos) =====
  const budget = recomputeSynapseBudget(actor); // { physical:n, mental:n, social:n, arts:n, knowledge:n }

  function renderStep3(currAlloc = {}) {
    function renderCat(cat, pts) {
      if (!pts) return "";
      const attrs = ATTRS_BY_CATEGORY[cat] ?? [];
      return `
        <div class="t-card t-col" style="gap:8px;padding:12px;">
          <div><b>${cat.toUpperCase()}</b> — Puntos: ${pts}</div>
          <div class="grid grid-3" style="gap:8px;">
            ${attrs.map(a => {
              const name = `alloc_${a}`;
              const val = Number(currAlloc[name] ?? 0);
              return `
                <label class="t-col">
                  <span class="muted">${a}</span>
                  <input name="${name}" type="number" min="0" step="1" value="${val}">
                </label>
              `;
            }).join("")}
          </div>
          <small class="muted">Distribuye exactamente ${pts} punto(s) entre estos atributos (solo enteros ≥ 0).</small>
        </div>
      `;
    }

    return `
      <form class="t-col" style="gap:12px;">
        ${renderCat("physical",  budget.physical)}
        ${renderCat("mental",    budget.mental + budget.arts + budget.knowledge)} <!-- artes+saberes suman a mental -->
        ${renderCat("social",    budget.social)}
      </form>
    `;
  }
  console.log("[Wizard/Paso3] budget =", budget);
  let step3Data = null;
  const res3 = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Creación de Personaje — Paso 3 (Sinapsis)" },
    content: renderStep3({}),
    ok: {
      label: "Finalizar",
      callback: (_event, button) => {
        const fd = new FormData(button.form);
        step3Data = Object.fromEntries(fd.entries());
        return step3Data;
      }
    },
    cancel: { label: "Atrás" }
  });
  if (!res3) return;
  const res3Vals = res3;

  // Validación sencilla: respeta los cupos
  function sum(keys) { return keys.reduce((a,k)=>a+Number(res3Vals[`alloc_${k}`]||0), 0); }
  const physSum    = sum(ATTRS_BY_CATEGORY.physical);
  const mentSum    = sum(ATTRS_BY_CATEGORY.mental);
  const socSum     = sum(ATTRS_BY_CATEGORY.social);
  const mentBudget = budget.mental + budget.arts + budget.knowledge;

  const physOK = physSum === budget.physical;
  const mentOK = mentSum === mentBudget;
  const socOK  = socSum  === budget.social;


  console.log("[Sinapsis] budget=", budget, "sums=", { physOK, mentOK, socOK }, "mentBudget=", mentBudget);

  if (!physOK || !mentOK || !socOK) {
    ui.notifications?.warn("La distribución de Sinapsis no coincide con los puntos disponibles por categoría.");
  } else {
    // Convierte a {attr: inc}
    const allocations = {};
    for (const a of [...ATTRS_BY_CATEGORY.physical, ...ATTRS_BY_CATEGORY.mental, ...ATTRS_BY_CATEGORY.social]) {
      const v = Number(res3Vals[`alloc_${a}`]||0);
      if (v>0) allocations[a] = v;
    }
    await applySynapseAllocations(actor, allocations);
  }

  // Reabre hoja
  await actor.sheet?.render(true);
}
