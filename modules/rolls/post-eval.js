// modules/rolls/post-eval.js
import { addProgress, addFail } from "../progression.js";

/** Aplica progreso según tus reglas (INCLUYE fallos) */
async function applyProgressFor(actor, flags, success, learned) {
  const { type, policy, meta } = flags ?? {};
  if (!actor || !type) return null;

  if (type === "specialization") {
    if (policy === "learning" && meta?.key) {
      if (success && learned) return await addProgress(actor, "skills", meta.key, 1);
      if (!success) await addFail(actor, "skills", meta.key, 1);
    }
    return null;
  }

  if (type === "attack") {
    if (policy === "learning" && meta?.key) {
      const trackType = meta.isManeuver ? "maneuvers" : "weapons";
      if (success && learned) return await addProgress(actor, trackType, meta.key, 1);
      if (!success) await addFail(actor, trackType, meta.key, 1);
    }
    return null;
  }

  if (type === "defense") {
    if (policy === "learning") {
      if (success) {
        return await addProgress(actor, "defense", "evasion", 1);
      } else if (meta?.armorType) {
        await addProgress(actor, "armor", meta.armorType, 1);
        await addFail(actor, "defense", "evasion", 1);
      }
    }
    return null;
  }

  if (type === "resistance") {
    if (!success && meta?.key) {
      await addProgress(actor, "resistances", meta.key, 1);
      await addFail(actor, "resistances", meta.key, 1);
    }
    return null;
  }

  return null;
}

function evaluateWithDC(flags, dc) {
  const { policy, totals, rank } = flags ?? {};
  const low   = Number(totals?.low ?? 0);
  const high  = Number(totals?.high ?? low);
  const target= Number(dc ?? 10);

  let success;
  if (policy === "learning") success = (low >= target);
  else if (policy === "execution") success = (high >= target);
  else success = (low >= target);

  let learned = false;
  if (policy === "learning" && success) {
    learned = (Math.abs(high - low) > Number(rank || 0));
  }
  return { success, learned, usedPolicy: policy };
}

/** Botón "Evaluar" en cada mensaje de tirada (solo GM) */
Hooks.on("renderChatMessageHTML", (message, html) => {
  const f = message?.flags?.tsdc;
  if (!f || !game.user?.isGM) return;

  const btn = document.createElement("a");
  btn.className = "button t-btn secondary";
  btn.style.marginTop = "6px";
  btn.textContent = "Evaluar";

  btn.addEventListener("click", async () => {
    const res = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Evaluar Tirada (DC oculto)" },
      content: `
        <form class="t-col" style="gap:8px;">
          <div class="t-field">
            <label>DC</label>
            <input type="number" name="dc" value="10">
          </div>
          <div class="muted">Solo tú ves este DC. El jugador no lo verá.</div>
        </form>
      `,
      ok: {
        label: "Aplicar",
        callback: (_ev, button) => Number(button.form.elements.dc?.value || 10)
      }
    });
    if (res == null) return;

    const actorId = f.actorId ?? message.speaker?.actor;
    const actor = game.actors?.get(actorId);
    if (!actor) return ui.notifications?.warn("No se encontró el actor para aplicar progreso.");

    const { success, learned, usedPolicy } = evaluateWithDC(f, res);
    await applyProgressFor(actor, f, success, learned);

    const summary = [
      `Tipo: ${f.type}`,
      `Política: ${usedPolicy}`,
      `Total usado: ${usedPolicy === "execution" ? f.totals.high : f.totals.low}`,
      `DC: ${res}`,
      `Éxito: ${success ? "Sí" : "No"}`,
      (usedPolicy === "learning" ? `Aprendizaje: ${learned ? "Sí" : "No"}` : null)
    ].filter(Boolean).join(" • ");

    ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM"),
      content: `<p><strong>Evaluación</strong> — ${summary}</p>`,
      speaker: message.speaker
    });
  }, { once: true });

  (html.querySelector(".message-content, .dice-result") ?? html).appendChild(btn);
});
