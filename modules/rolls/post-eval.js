// modules/rolls/post-eval.js
import { addProgress } from "../progression.js";

/** Aplica progreso según tus reglas */
async function applyProgressFor(actor, flags, success, learned) {
  const { type, policy, rank, meta } = flags ?? {};
  if (!actor || !type) return null;

  // SPECIALIZATION: éxito & learning -> skill[key] +1
  if (type === "specialization") {
    if (policy === "learning" && success === true && learned === true && meta?.key) {
      return await addProgress(actor, "skills", meta.key, 1);
    }
    return null;
  }

  // ATTACK: éxito & learning -> weapons[key] o maneuvers[key] +1
  if (type === "attack") {
    if (policy === "learning" && success === true && learned === true && meta?.key) {
      const trackType = meta.isManeuver ? "maneuvers" : "weapons";
      return await addProgress(actor, trackType, meta.key, 1);
    }
    return null;
  }

  // DEFENSE: éxito & learning -> defense.evasion +1; fallo & learning -> armor[armorType] +1
  if (type === "defense") {
    if (policy === "learning" && learned === true) {
      if (success === true) {
        return await addProgress(actor, "defense", "evasion", 1);
      } else if (success === false && meta?.armorType) {
        return await addProgress(actor, "armor", meta.armorType, 1);
      }
    }
    return null;
  }

  // RESISTANCE: un solo dado (policy "none"). FALLA => +1 en resistances[typeKey]
  if (type === "resistance") {
    if (success === false && meta?.key) {
      return await addProgress(actor, "resistances", meta.key, 1);
    }
    return null;
  }

  // attribute / impact / personality => nunca progreso
  return null;
}

/** Evalúa éxito y aprendizaje a partir de flags + DC */
function evaluateWithDC(flags, dc) {
  const { type, policy, rank, totals } = flags ?? {};
  const low = Number(totals?.low ?? 0);
  const high= Number(totals?.high ?? low);
  const target = Number(dc ?? 10);

  // éxito depende de la política:
  // - learning  -> compara LOW con DC
  // - execution -> compara HIGH con DC
  // - none      -> compara LOW (==HIGH) con DC
  let success;
  if (policy === "learning") success = (low >= target);
  else if (policy === "execution") success = (high >= target);
  else success = (low >= target);

  // aprendizaje solo aplica en "learning" y si hubo éxito y (high - low) > rank
  let learned = false;
  if (policy === "learning" && success === true) {
    learned = (Math.abs(high - low) > Number(rank || 0));
  }
  return { success, learned, usedPolicy: policy };
}

Hooks.on("renderChatMessageHTML", (message, html /*HTMLElement*/) => {
  const f = message?.flags?.tsdc;
  if (!f) return;

  // Solo GM ve el botón
  if (!game.user?.isGM) return;

  // Botón
  const btn = document.createElement('a');
  btn.className = "button t-btn secondary";
  btn.style.marginTop = "6px";
  btn.textContent = "Evaluar";
  btn.addEventListener("click", async () => {
    const dc = await Dialog.prompt({
      title: "Evaluar Tirada (DC oculto)",
      label: "Aplicar",
      callback: dlg => Number(dlg.find('input[name="dc"]').val() || 10),
      content: `
        <form class="t-col" style="gap:8px;">
          <div class="t-field">
            <label>DC</label>
            <input type="number" name="dc" value="10"/>
          </div>
          <div class="muted">Solo tú ves este DC. El jugador no lo verá.</div>
        </form>
      `
    });
    if (dc == null) return;

    // Buscar actor
    const actorId = f.actorId ?? message.speaker?.actor;
    const actor = game.actors?.get(actorId);
    if (!actor) {
      ui.notifications?.warn("No se encontró el actor para aplicar progreso.");
      return;
    }

    // Evalúa con DC y aplica progreso
    const { success, learned, usedPolicy } = evaluateWithDC(f, dc);
    await applyProgressFor(actor, f, success, learned);

    // Feedback para el GM (whisper):
    const summary = [
      `Tipo: ${f.type}`,
      `Política: ${usedPolicy}`,
      `Total usado: ${usedPolicy === "execution" ? f.totals.high : f.totals.low}`,
      `DC: ${dc}`,
      `Éxito: ${success ? "Sí" : "No"}`,
      (usedPolicy === "learning" ? `Aprendizaje: ${learned ? "Sí" : "No"}` : null)
    ].filter(Boolean).join(" • ");

    ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM"),
      content: `<p><strong>Evaluación</strong> — ${summary}</p>`,
      speaker: message.speaker
    });
  }, { once: true });

  // Inserta el botón al final de la carta
  const footer = html.querySelector(".message-content, .dice-result") ?? html;
  footer.appendChild(btn);
});
