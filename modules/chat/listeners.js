// modules/chat/listeners.js
import { addProgress, addFail } from "../progression.js";
import { applyNaturalWeaponEffect } from "../features/effects/index.js";
import * as Ail from "../ailments/index.js";

export function registerChatListeners() {
  Hooks.on("renderChatMessageHTML", (_message, html /*HTMLElement*/) => {
    html.addEventListener("click", async (ev) => {
      const btn = ev.target.closest(".tsdc-eval-btn");
      if (!btn) return;
      ev.preventDefault();
      if (!game.user.isGM) return ui.notifications?.warn("Solo el GM puede evaluar.");

      try {
        const kind  = String(btn.dataset.kind || "");
        const blob  = decodeURIComponent(String(btn.dataset.blob || "%7B%7D"));
        const input = JSON.parse(blob);

        if (kind === "attack")      await evalAttack(input);
        else if (kind === "defense")    await evalDefense(input);
        else if (kind === "resistance") await evalResistance(input);
        else if (kind === "specialization") await evalSpecialization(input);
      } catch (err) {
        console.error("Eval error", err);
      }
    });
  });
}

/* ============ ATAQUE ============ */
async function evalAttack(p) {
  const actor = game.actors?.get(p.actorId);
  if (!actor) return;

  const res = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Evaluar Ataque" },
    content: `
      <form class="t-col" style="gap:8px;">
        <div class="t-field">
          <label>TD (Defensa) del objetivo</label>
          <input type="number" name="td" value="12">
        </div>
        <div class="t-field">
          <label>Nombre objetivo (opcional)</label>
          <input type="text" name="tName" placeholder="Orco, Gólem, etc.">
        </div>
        <div class="muted">Tirada del jugador: <b>${p.totalShown}</b>${p.otherTotal!=null?` • Otra: <b>${p.otherTotal}</b>`:""}</div>
        <div class="muted">Política usada: <b>${p.policy}</b></div>
      </form>
    `,
    ok: {
      label: "Resolver",
      callback: (_ev, button) => {
        const f = button.form;
        return {
          td: Number(f.elements.td?.value || 0),
          targetName: String(f.elements.tName?.value || "").trim() || null
        };
      }
    }
  });
  if (!res) return;

  const success = (Number(p.totalShown) >= Number(res.td));
  const margin  = Number(p.totalShown) - Number(res.td);
  const canLearn = (p.policy === "learning" && success && p.otherTotal != null);
  const diff     = canLearn ? Math.abs(Number(p.totalShown) - Number(p.otherTotal)) : 0;
  const learned  = canLearn ? (diff >= Number(p.rank || 0)) : false;
  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<p><b>Ataque</b> ${success ? "ACIERTO ✅" : "FALLO ❌"} — margen <b>${margin}</b>${res.targetName?` vs <b>${res.targetName}</b>`:""}${p.policy==="learning" ? ` • Aprendizaje: <b>${learned ? "Sí" : "No"}</b>` : ""}.</p>`
  });

  if (success && p.policy === "learning" && learned) {
    const trackType = p.isManeuver ? "maneuvers" : "weapons";
    await addProgress(actor, trackType, p.key, 1);
  }

  if (success && p.key && !p.isManeuver) {
    await applyNaturalWeaponEffect({
      attacker: actor,
      defender: null,
      weaponKey: p.key,
      margin,
      rank: Number(p.rank||0),
      targetName: res.targetName
    });
  }
}

/* ============ DEFENSA ============ */
async function evalDefense(p) {
  const actor = game.actors?.get(p.actorId);
  if (!actor) return;

  const res = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Evaluar Defensa" },
    content: `
      <form class="t-col" style="gap:10px;">
        <div class="t-field">
          <label>Resultado</label>
          <select name="result">
            <option value="success">Defensa exitosa (evita daño)</option>
            <option value="fail">Defensa fallida (hay impacto)</option>
          </select>
        </div>
        <div class="t-field">
          <label>Total del atacante (opcional)</label>
          <input type="number" name="atk" placeholder="p.ej. 17">
        </div>
        <div class="t-field">
          <label>Zona impactada (si falló)</label>
          <select name="body">
            <option value="head">Cabeza</option>
            <option value="torso">Torso</option>
            <option value="arm">Brazo</option>
            <option value="leg">Pierna</option>
          </select>
        </div>
        <div class="muted">Defensa tirada: <b>${p.totalShown}</b>${p.otherTotal!=null?` • Otra: <b>${p.otherTotal}</b>`:""} • Política: <b>${p.policy}</b></div>
      </form>
    `,
    ok: {
      label: "Resolver",
      callback: (_ev, button) => {
        const f = button.form;
        return {
          defended: (f.elements.result?.value === "success"),
          attackerTotal: Number(f.elements.atk?.value || 0),
          bodyPart: String(f.elements.body?.value || "torso")
        };
      }
    }
  });
  if (!res) return;

  if (res.defended) {
    const canLearn = (p.policy === "learning" && p.otherTotal != null);
    const diff     = canLearn ? Math.abs(Number(p.totalShown) - Number(p.otherTotal)) : 0;
    const learned  = canLearn ? (diff >= Number(p.rank || 0)) : false;
    await ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM"),
      content: `<p><b>Defensa</b> exitosa — Aprendizaje: <b>${learned ? "Sí" : "No"}</b>.</p>`
    });
    if (learned) await addProgress(actor, "defense", "evasion", 1);
    return;
  }

  if (p.armorType) await addFail(actor, "armor", p.armorType, 1);

  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<p><b>Impacto</b> en <b>${res.bodyPart}</b>. Aplica bloqueo y calcula herida según regla.</p>`
  });

  // Aquí enlazas tu pipeline real de daño/heridas/alteraciones.
}

/* ============ ESPECIALIZACIÓN ============ */
async function evalSpecialization(p) {
  const actor = game.actors?.get(p.actorId);
  if (!actor) return;

  // Recupera la última tirada (alto/bajo) desde el mensaje anterior (flags.tsdc) si vienen null.
  // Si prefieres, puedes pasar totalShown/otherTotal en el blob desde la hoja.
  // Aquí asumimos que ya están en p; si no, los dejamos en 0 para no romper.
  const shown = Number(p.totalShown ?? 0);
  const other = (p.otherTotal != null) ? Number(p.otherTotal) : null;

  const res = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Evaluar Especialización" },
    content: `
      <form class="t-col" style="gap:8px;">
        <div class="t-field">
          <label>TD / DC objetivo</label>
          <input type="number" name="td" value="10">
        </div>
        <div class="muted">Tirada mostrada: <b>${shown || "?"}</b>${other!=null?` • Otra: <b>${other}</b>`:""} • Política: <b>${p.policy}</b></div>
      </form>
    `,
    ok: {
      label: "Resolver",
      callback: (_ev, button) => Number(button.form.elements.td?.value || 10)
    }
  });
  if (res == null) return;

  const success = (shown >= Number(res));
  const canLearn = (p.policy === "learning" && success && other != null);
  const diff     = canLearn ? Math.abs(shown - other) : 0;
  const learned  = canLearn ? (diff >= Number(p.rank || 0)) : false;

  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<p><b>Especialización</b> ${success ? "ÉXITO ✅" : "FALLO ❌"} • TD ${res} • Aprendizaje: <b>${learned ? "Sí" : "No"}</b>.</p>`
  });

  if (success && p.policy === "learning" && learned && p.key) {
    await addProgress(actor, "skills", p.key, 1);
  }
}

/* ============ RESISTENCIA ============ */
async function evalResistance(p) {
  const actor = game.actors?.get(p.actorId);
  if (!actor) return;

  const res = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Evaluar Resistencia (${p.resType})` },
    content: `
      <form class="t-col" style="gap:8px;">
        <div class="t-field">
          <label>Resultado</label>
          <select name="result">
            <option value="success">Exitosa (no pasa nada)</option>
            <option value="fail">Fallida (aplica agravio/efecto)</option>
          </select>
        </div>
        <div class="t-field">
          <label>Tipo de efecto (si falló)</label>
          <select name="kind">
            <option value="infection">Infección</option>
            <option value="poison">Veneno</option>
            <option value="affliction">Aflicción</option>
            <option value="curse">Maldición</option>
            <option value="alteration">Alteración</option>
            <option value="element">Elemento</option>
          </select>
        </div>
        <div class="t-field">
          <label>ID (catálogo) opcional</label>
          <input type="text" name="key" placeholder="p.ej. PIEL_DE_ESCARCHA, PLAGA_ALMAS_ERRANTES…">
        </div>
        <div class="muted">Tirada mostrada: <b>${p.totalShown}</b></div>
      </form>
    `,
    ok: {
      label: "Resolver",
      callback: (_ev, button) => {
        const f = button.form;
        return {
          ok: (f.elements.result?.value === "success"),
          kind: String(f.elements.kind?.value || "alteration"),
          key: String(f.elements.key?.value || "").trim()
        };
      }
    }
  });
  if (!res) return;

  if (res.ok) {
    await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM"), content: `<p><b>Resistencia</b> exitosa: no se aplica efecto.</p>` });
    return;
  }

  if (res.key) {
    await Ail.addAilment(actor, res.key, { source: p.resType, kind: res.kind });
  } else {
    await Ail.incrementAilmentLoad(actor, 1, `Fallo TR ${p.resType}`);
  }

  await addProgress(actor, "resistances", p.resType, 1);

  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<p><b>Resistencia</b> fallida: aplicado <b>${res.key || res.kind}</b>.</p>`
  });
}
