// modules/chat/listeners.js
import { addProgress, addFail } from "../progression.js";
import { applyNaturalWeaponEffect } from "../features/effects/index.js";
import * as Ail from "../ailments/index.js";

export function registerChatListeners() {
  Hooks.on("renderChatMessage", (message, html, data) => {
    html.on("click", ".tsdc-eval-btn", async (ev) => {
      ev.preventDefault();
      if (!game.user.isGM) return ui.notifications?.warn("Solo el GM puede evaluar.");
      try {
        const kind   = String(ev.currentTarget.dataset.kind || "");
        const blob   = decodeURIComponent(String(ev.currentTarget.dataset.blob || "%7B%7D"));
        const input  = JSON.parse(blob);

        if (kind === "attack")     await evalAttack(input);
        else if (kind === "defense")    await evalDefense(input);
        else if (kind === "resistance") await evalResistance(input);
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

  // 1) Diálogo GM: pedir TD del objetivo y (opcional) nombre/actor de destino
  const form = await Dialog.prompt({
    title: "Evaluar Ataque",
    label: "Resolver",
    callback: (dlg) => {
      const td     = Number(dlg.find('input[name="td"]').val() || 0);
      const tName  = String(dlg.find('input[name="tName"]').val() || "").trim() || null;
      // si usas el alto/bajo para tener referencia, lo puedes mostrar aquí también
      return { td, targetName: tName };
    },
    content: `
      <form class="t-col" style="gap:8px;">
        <div class="t-field">
          <label>TD (Defensa) del objetivo</label>
          <input type="number" name="td" value="12"/>
        </div>
        <div class="t-field">
          <label>Nombre objetivo (opcional)</label>
          <input type="text" name="tName" placeholder="Orco, Gólem, etc."/>
        </div>
        <div class="muted">Tirada del jugador (mostrada): <b>${p.totalShown}</b>${p.otherTotal!=null?` • Otra: <b>${p.otherTotal}</b>`:""}</div>
        <div class="muted">Política usada: <b>${p.policy}</b></div>
      </form>
    `
  });
  if (!form) return;

  const success = (Number(p.totalShown) >= Number(form.td));
  const margin  = Number(p.totalShown) - Number(form.td);
  const targetName = form.targetName;

  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<p><b>Ataque</b> ${success ? "ACIERTO ✅" : "FALLO ❌"} — margen <b>${margin}</b>${targetName?` vs <b>${targetName}</b>`:""}.</p>`
  });

  // 2) Aprendizaje (solo si el jugador eligió "aprender" en la tirada)
  if (success && p.policy === "learning") {
    const trackType = p.isManeuver ? "maneuvers" : "weapons";
    await addProgress(actor, trackType, p.key, 1);
  }

  // 3) Si acierta → puedes lanzar Impacto a mano (lo mantiene el jugador),
  //    y además disparamos el efecto del arma natural (si corresponde)
  if (success && p.key && !p.isManeuver) {
    await applyNaturalWeaponEffect({
      attacker: actor,
      defender: null,         // si tienes el actor del objetivo, pásalo aquí
      weaponKey: p.key,
      margin,
      rank: Number(p.rank||0),
      targetName
    });
  }
}

/* ============ DEFENSA ============ */
async function evalDefense(p) {
  const actor = game.actors?.get(p.actorId);
  if (!actor) return;

  // 1) GM evalúa si evita el ataque (no hay TD fijo porque el GM puede tener total del atacante)
  const form = await Dialog.prompt({
    title: "Evaluar Defensa",
    label: "Resolver",
    callback: (dlg) => {
      return {
        defended: dlg.find('select[name="result"]').val() === "success",
        attackerTotal: Number(dlg.find('input[name="atk"]').val() || 0),
        bodyPart: dlg.find('select[name="body"]').val()
      };
    },
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
          <label>Total del atacante (opcional, para referencia)</label>
          <input type="number" name="atk" placeholder="p.ej. 17" />
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
        <div class="muted">Tirada mostrada de defensa: <b>${p.totalShown}</b>${p.otherTotal!=null?` • Otra: <b>${p.otherTotal}</b>`:""} • Política: <b>${p.policy}</b></div>
      </form>
    `
  });
  if (!form) return;

  if (form.defended) {
    await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM"), content: `<p><b>Defensa</b> exitosa: sin daño.</p>` });
    if (p.policy === "learning") {
      await addProgress(actor, "defense", "evasion", 1);
    }
    return;
  }

  // 2) Defensa fallida → flujo de daño
  //    Aquí encadenas tu pipeline de localización → bloqueo (armadura/escudo) → herida → progreso.
  //    Te dejo los “hooks” listos y mensajes; conecta tus funciones reales donde corresponda.

  // (a) Progreso por fallo en la armadura usada (ligera/intermedia/pesada)
  if (p.armorType) {
    await addFail(actor, "armor", p.armorType, 1);
  }

  // (b) TODO: obtener pieza equipada en la zona, calcular bloqueo, severidad de herida, etc.
  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<p><b>Impacto</b> en <b>${form.bodyPart}</b>. Aplica bloqueo y calcula herida según tu regla.</p>`
  });

  // (c) TODO: Subir competencia del equipo concreto que bloqueó / absorbió (si procede).
  // (d) (Opcional) Aplicar alteraciones/estados por la herida (fractura, sangrado, etc.) con tu módulo de agravios/alteraciones.
}

/* ============ RESISTENCIA ============ */
async function evalResistance(p) {
  const actor = game.actors?.get(p.actorId);
  if (!actor) return;

  const form = await Dialog.prompt({
    title: `Evaluar Resistencia (${p.resType})`,
    label: "Resolver",
    callback: (dlg) => {
      const ok = dlg.find('select[name="result"]').val() === "success";
      const kind = dlg.find('select[name="kind"]').val(); // infection | poison | affliction | curse | alteration | element
      const key  = String(dlg.find('input[name="key"]').val() || "").trim(); // ID del agravio específico (si lo conoces)
      return { ok, kind, key };
    },
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
          <input type="text" name="key" placeholder="p.ej. PIEL_DE_ESCARCHA, PLAGA_ALMAS_ERRANTES..."/>
        </div>
        <div class="muted">Tirada mostrada: <b>${p.totalShown}</b></div>
      </form>
    `
  });
  if (!form) return;

  if (form.ok) {
    await ChatMessage.create({ whisper: ChatMessage.getWhisperRecipients("GM"), content: `<p><b>Resistencia</b> exitosa: no se aplica efecto.</p>` });
    return;
  }

  // Falló → aplicar agravio/condición según el GM
  if (form.key) {
    await Ail.addAilment(actor, form.key, { source: p.resType, kind: form.kind });
  } else {
    // sin ID específico: puedes setear una genérica por tipo
    await Ail.incrementAilmentLoad(actor, 1, `Fallo TR ${p.resType}`);
  }

  // Progreso de resistencia del tipo tirado
  await addProgress(actor, "resistances", p.resType, 1);

  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    content: `<p><b>Resistencia</b> fallida: aplicado <b>${form.key || form.kind}</b>.</p>`
  });
}
