// modules/wizard/character-wizard.js
import { listSpecies, getSpeciesByKey, rangesFromSpecies, applySpecies } from "../features/species/index.js";
import { BACKGROUNDS, setBackground } from "../features/affinities/index.js";

/** Abre el diálogo de creación si el actor no está bloqueado */
export async function openCharacterWizard(actor) {
  if (!actor) return;
  const locked = !!actor.system?.identity?.locked;
  if (locked) return;

  // Datos base
  const species = listSpecies();
  const curKey  = actor.system?.species?.key ?? species[0]?.key ?? "";
  const sp      = getSpeciesByKey(curKey);
  const ranges  = rangesFromSpecies(sp);
  const bgs     = Object.values(BACKGROUNDS).filter(b => b.key !== "none");

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

  // Render de contenido
  const renderForm = (state) => `
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

      <div class="grid grid-3" style="gap:12px;">
        <label class="t-col">
          <span class="muted">Género</span>
          <input name="gender" type="text" value="${state.gender}">
        </label>

        <label class="t-col">
          <span class="muted">Especie</span>
          <select name="speciesKey">
            ${species.map(s => `<option value="${s.key}" ${s.key===state.speciesKey?"selected":""}>${s.label}</option>`).join("")}
          </select>
          <small class="muted">${(getSpeciesByKey(state.speciesKey)?.label) ?? ""}</small>
        </label>

        <label class="t-col">
          <span class="muted">Trasfondo</span>
          <select name="backgroundKey">
            ${bgs.map(b => `<option value="${b.key}" ${b.key===state.backgroundKey?"selected":""}>${b.label}</option>`).join("")}
          </select>
        </label>
      </div>

      <div class="grid grid-3" style="gap:12px;">
        <label class="t-col">
          <span class="muted">Edad <small>${hAge}</small></span>
          <input name="age" type="number" min="0" value="${state.age}">
        </label>
        <label class="t-col">
          <span class="muted">Estatura (cm) <small>${hHcm}</small></span>
          <input name="heightCm" type="number" min="0" value="${state.heightCm}">
        </label>
        <label class="t-col">
          <span class="muted">Peso (kg) <small>${hWkg}</small></span>
          <input name="weightKg" type="number" min="0" value="${state.weightKg}">
        </label>
      </div>

      <label class="t-col">
        <span class="muted">Historia (opcional)</span>
        <textarea name="story" rows="5" placeholder="Origen, motivaciones, relaciones…">${state.story ?? ""}</textarea>
      </label>
    </form>
  `;

  // Abrimos un prompt con OK/Cancelar
  const res = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Creación de Personaje" },
    content: renderForm(dflt),
    ok: {
      label: "Continuar",
      callback: (_event, button) => {
        const f = button.form;
        const get = (n) => f.elements[n]?.value ?? "";
        const out = {
          playerName:    String(get("playerName")).trim(),
          characterName: String(get("characterName")).trim(),
          gender:        String(get("gender")).trim(),
          speciesKey:    String(get("speciesKey")).trim(),
          backgroundKey: String(get("backgroundKey")).trim(),
          age:           Number(get("age") || ""),
          heightCm:      Number(get("heightCm") || ""),
          weightKg:      Number(get("weightKg") || ""),
          story:         String(get("story") ?? "")
        };
        if (!out.playerName || !out.characterName || !out.speciesKey || !out.backgroundKey) {
          ui.notifications?.error?.("Completa los campos requeridos.");
          return false; // evita cerrar
        }
        return out;
      }
    },
    rejectClose: false,
    default: "ok"
  });

  // Si cancela, res === null
  if (!res) return;

  // 1) Aplica especie
  await applySpecies(actor, res.speciesKey);

  // 2) Fija trasfondo + afinidad mayor
  await setBackground(actor, res.backgroundKey);

  // 3) Identidad permanente (LOCK)
  const patch = {
    name: res.characterName,
    "system.identity.playerName": res.playerName,
    "system.identity.gender":     res.gender,
    "system.identity.age":        Number.isFinite(res.age)      ? res.age      : null,
    "system.identity.heightCm":   Number.isFinite(res.heightCm) ? res.heightCm : null,
    "system.identity.weightKg":   Number.isFinite(res.weightKg) ? res.weightKg : null,
    "system.identity.story":      res.story,
    "system.identity.locked":     true
  };
  await actor.update(patch);

  // 4) Reabre la hoja
  await actor.sheet?.render(true);
}
