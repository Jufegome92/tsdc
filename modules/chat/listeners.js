// modules/chat/listeners.js
import { addProgress, addFail } from "../progression.js";
import { applyNaturalWeaponEffect } from "../features/effects/index.js";
import * as Ail from "../ailments/index.js";
import { computeBlockingAt } from "../features/armors/index.js";

/* ===== Helpers locales ===== */

// Etiqueta bonita para la localización
function locLabel(part) {
  switch (String(part || "")) {
    case "head":    return "Cabeza";
    case "chest":   return "Torso";
    case "bracers": return "Brazos";
    case "legs":    return "Piernas";
    case "boots":   return "Pies";
    default:        return String(part || "—");
  }
}

// Severidad en función de Impacto vs Bloqueo (x1 / x2 / x3)
function severityFromImpactBlock(impact, block) {
  const I = Number(impact || 0);
  const B = Math.max(0, Number(block || 0));
  if (I <= B) return null;                 // sin herida
  if (I <  2 * B) return "leve";
  if (I <  3 * B) return "grave";
  return "critico";
}

// Mapeo rápido de tipo de daño → ID del catálogo según severidad
function mapDamageToAilmentId(dtype, _severity) {
  const t = String(dtype || "").toLowerCase();
  switch (t) {
    case "cut":    return "DESANGRADO";
    case "blunt":  return "FRACTURADO";
    case "pierce": return "INFECCION_TRAUMATICA";
    case "fire":   return "QUEMADURA_TAUMATICA_FUEGO";
    case "air":    return "LACERACION_DE_PRESION_VIENTO";
    case "earth":  return "APLASTAMIENTO_TAUMATICO_TIERRA";
    case "water":  return "CONGELACION_TAUMATICA_AGUA";
    case "light":  return "SOBRECARGA_NERVIOSA_LUZ";
    case "dark":   return "DEVORACION_SENSORIAL_OSCURIDAD";
    default:       return null;
  }
}

// Sugerir Durabilidad desde el primer token objetivo (si existe)
function suggestDurabilityFromTarget() {
  try {
    const tgt = Array.from(game.user?.targets ?? [])[0];
    if (!tgt?.actor) return 0;
    const sys = tgt.actor.system ?? {};
    // Prueba varios lugares comunes
    return Number(
      sys?.defense?.durability ??
      sys?.durability ??
      sys?.resilience?.durability ??
      0
    ) || 0;
  } catch (_) {
    return 0;
  }
}

export function registerChatListeners() {
  Hooks.on("renderChatMessageHTML", (message, html /*HTMLElement*/) => {
    html.addEventListener("click", async (ev) => {
      // Detecta botones de evaluación general y de rotura
      const evalBtn  = ev.target.closest(".tsdc-eval-btn");
      const breakBtn = ev.target.closest(".tsdc-break-eval");
      if (!evalBtn && !breakBtn) return;

      ev.preventDefault();

      // ─────────────────────────────────────────
      // Evaluar Rotura (impacto crítico)
      // ─────────────────────────────────────────
      if (breakBtn) {
        if (!game.user.isGM) {
          return ui.notifications?.warn("Solo el GM puede evaluar roturas.");
        }
        try {
          const power   = Number(breakBtn.dataset.power || 0);
          const actorId = breakBtn.dataset.actor || null;

          const result = await foundry.applications.api.DialogV2.prompt({
            window: { title: "Evaluar Rotura" },
            content: `
              <form class="t-col" style="gap:10px;">
                <div class="muted">Poder de Rotura: <b>${power}</b></div>
                <div class="t-field">
                  <label>Durabilidad del objetivo</label>
                  <input type="number" name="durability" value="${suggestDurabilityFromTarget()}" min="0" step="1" style="width:120px;">
                </div>
                <div class="muted">Tip: selecciona un token objetivo para autocompletar.</div>
              </form>
            `,
            ok: {
              label: "Evaluar",
              callback: (_ev, btn) => Number(btn.form.elements.durability?.value || 0)
            }
          });
          if (result == null) return;

          const durability = Number(result || 0);
          const broke = power >= durability;

          const whisper = ChatMessage.getWhisperRecipients("GM");
          const actor = actorId ? game.actors.get(actorId) : null;

          await ChatMessage.create({
            whisper,
            speaker: actor ? ChatMessage.getSpeaker({ actor }) : null,
            content:
              `<p><strong>Evaluación de Rotura</strong> — Potencia ${power} vs Durabilidad ${durability} ` +
              `→ ${broke ? "💥 <b>ROMPE</b>" : "no rompe"}</p>`
          });

          Hooks.callAll("tsdcBreakEvaluated", {
            actorId, power, durability, broke, messageId: message?.id
          });
        } catch (err) {
          console.error("TSDC | break-eval failed:", err);
        }
        return; // no continuar con eval general
      }

      // ─────────────────────────────────────────
      // Evaluaciones generales (ataque/defensa/etc.)
      // ─────────────────────────────────────────
      if (!game.user.isGM) {
        return ui.notifications?.warn("Solo el GM puede evaluar.");
      }

      try {
        const kind  = String(evalBtn.dataset.kind || "");
        const blob  = decodeURIComponent(String(evalBtn.dataset.blob || "%7B%7D"));
        const input = JSON.parse(blob);

        if (kind === "attack")              await evalAttack(input);
        else if (kind === "defense")        await evalDefense(input);
        else if (kind === "resistance")     await evalResistance(input);
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

  const defShown = Number(p.totalShown ?? 0);
  const bodyPart = p.bodyPart || "chest";
  const d100roll = Number(p.d100 ?? NaN);

  const res1 = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Evaluar Defensa" },
    content: `
      <form class="t-col" style="gap:10px;">
        <div class="t-field">
          <label>Total del atacante</label>
          <input type="number" name="atk" placeholder="p.ej. 17" />
        </div>
        <div class="t-field">
          <label>Tipo de daño (para heridas si falla)</label>
          <select name="dtype">
            <option value="cut">Cortante</option>
            <option value="pierce">Perforante</option>
            <option value="blunt">Contundente</option>
            <option value="fire">Fuego</option>
            <option value="air">Viento</option>
            <option value="earth">Tierra</option>
            <option value="water">Agua</option>
            <option value="light">Luz</option>
            <option value="dark">Oscuridad</option>
          </select>
        </div>
        <div class="muted">Localización preasignada: <b>${locLabel(bodyPart)}</b>${isNaN(d100roll) ? "" : ` • d100=${d100roll}`}</div>
        <div class="muted">Defensa tirada: <b>${isNaN(defShown) ? "?" : defShown}</b> • Otra: <b>${p.otherTotal ?? "—"}</b> • Política: <b>${p.policy ?? "-"}</b></div>
      </form>
    `,
    ok: {
      label: "Continuar",
      callback: (_ev, button) => ({
        atkTotal: Number(button.form.elements.atk?.value || 0),
        dtype: String(button.form.elements.dtype?.value || "cut")
      })
    }
  });
  if (!res1) return;

  const atkTotal = Number(res1.atkTotal || 0);
  const damageType = res1.dtype;
  const success = (defShown >= atkTotal);

  const other = (p.otherTotal != null) ? Number(p.otherTotal) : null;
  const canLearn = (p.policy === "learning" && success && other != null);
  const diff     = canLearn ? Math.abs(defShown - other) : 0;
  const learned  = canLearn ? (diff >= Number(p.rank || 0)) : false;

  if (success) {
    await ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM"),
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><b>Defensa</b> ÉXITO ✅ — margen ${defShown - atkTotal} • Localización: <b>${locLabel(bodyPart)}</b> • Aprendizaje: <b>${learned ? "Sí" : "No"}</b>.</p>`
    });
    if (learned) await addProgress(actor, "defense", "evasion", 1);
    return;
  }

  // Fallo → bloqueo y herida
  const blocking = computeBlockingAt(actor, bodyPart);
  const bVal = Number(blocking?.value || 0);

  const res2 = await foundry.applications.api.DialogV2.prompt({
    window: { title: `Impacto vs Bloqueo (${locLabel(bodyPart)})` },
    content: `
      <form class="t-col" style="gap:8px;">
        <div class="t-field">
          <label>Total de Impacto del atacante</label>
          <input type="number" name="imp" placeholder="p.ej. 9" />
        </div>
        <div class="muted">
          Bloqueo (${locLabel(bodyPart)}): <b>${bVal}</b>
          <span class="muted">(BC ${blocking?.breakdown?.BC ?? 0} • BM ${blocking?.breakdown?.BM ?? 0} • CD ${blocking?.breakdown?.CD ?? 0} • CO ${blocking?.breakdown?.CO ?? 0})</span>
        </div>
        <div class="muted">Regla: ≤×1 sin herida • ×1–<×2 leve • ×2–<×3 grave • ≥×3 crítico</div>
      </form>
    `,
    ok: {
      label: "Resolver Herida",
      callback: (_ev, button) => Number(button.form.elements.imp?.value || 0)
    }
  });
  if (res2 == null) return;

  const impactTotal = Number(res2 || 0);
  const sev = severityFromImpactBlock(impactTotal, bVal);

  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `
      <div>
        <p><b>Defensa</b> FALLÓ ❌ — margen ${atkTotal - defShown} • Localización: <b>${locLabel(bodyPart)}</b>${isNaN(d100roll) ? "" : ` • d100=${d100roll}`}</p>
        <p><b>Impacto</b>: ${impactTotal} vs <b>Bloqueo</b>: ${bVal} → ${sev ? `<b>Herida ${sev.toUpperCase()}</b>` : "sin herida"}</p>
        <p><b>Tipo de daño</b>: ${damageType}</p>
      </div>
    `
  });

  if (sev) {
    const aid = mapDamageToAilmentId(damageType, sev);
    if (aid) {
      await Ail.addAilment(actor, aid, {
        severity: sev,
        source: `defense:${damageType}`,
        kind: bodyPart
      });
    } else {
      await Ail.incrementAilmentLoad(actor, 1, `Fallo TD (${damageType}) → ${sev}`);
      ui.notifications?.info(`No encontré en el catálogo un agravio para "${damageType}".`);
    }
    const catKey = String(blocking?.piece?.category ?? "").toLowerCase();
    if (catKey) {
      await addFail(actor, "armor", catKey, 1);
    }
  }
}

/* ============ ESPECIALIZACIÓN ============ */
async function evalSpecialization(p) {
  const actor = game.actors?.get(p.actorId);
  if (!actor) return;

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
        <div class="muted">Tirada mostrada: <b>${isNaN(shown) ? "?" : shown}</b>${other!=null?` • Otra: <b>${other}</b>`:""} • Política: <b>${p.policy}</b></div>
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

  if (success && learned && p.key) {
    await addProgress(actor, "skills", p.key, 1);
  }
}

/* ============ RESISTENCIA ============ */
async function evalResistance(p) {
  const actor = game.actors?.get(p.actorId);
  if (!actor) return;

  const shown = Number(p.totalShown ?? 0);

  let DC = (p.dc != null) ? Number(p.dc) : null;
  let kind = "alteration";
  let key  = "";

  if (DC == null) {
    const res = await foundry.applications.api.DialogV2.prompt({
      window: { title: `Evaluar Resistencia (${p.resType ?? "-"})` },
      content: `
        <form class="t-col" style="gap:10px;">
          <div class="t-field">
            <label>DC</label>
            <input type="number" name="dc" placeholder="p.ej. 12" />
          </div>
          <div class="t-field">
            <label>Tipo de efecto (si falla)</label>
            <select name="kind">
              <option value="infection">Infección</option>
              <option value="poison">Veneno</option>
              <option value="affliction">Aflicción</option>
              <option value="curse">Maldición</option>
              <option value="alteration" selected>Alteración</option>
              <option value="element">Elemento</option>
            </select>
          </div>
          <div class="t-field">
            <label>ID (catálogo) opcional</label>
            <input type="text" name="key" placeholder="p.ej. PIEL_DE_ESCARCHA" />
          </div>
          <div class="muted">Tirada mostrada: <b>${isNaN(shown) ? "?" : shown}</b> • Tipo: <b>${p.resType ?? "-"}</b></div>
        </form>
      `,
      ok: {
        label: "Resolver",
        callback: (_ev, button) => {
          const f = button.form;
          return {
            dc: Number(f.elements.dc?.value || 0),
            kind: String(f.elements.kind?.value || "alteration"),
            key: String(f.elements.key?.value || "").trim()
          };
        }
      }
    });
    if (!res) return;
    DC   = res.dc;
    kind = res.kind;
    key  = res.key;
  } else {
    kind = p.kind ?? "alteration";
    key  = p.key  ?? "";
  }

  const success = (shown >= DC);
  const margin  = success ? (shown - DC) : (DC - shown);

  if (success) {
    await ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM"),
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><b>Resistencia</b> ÉXITO ✅ — margen ${margin} • Tipo: <b>${p.resType ?? "-"}</b>.</p>`
    });
    return;
  }

  // Fallo → aplicar efecto y progreso
  if (key) {
    await Ail.addAilment(actor, key, { source: p.resType, kind });
  } else {
    await Ail.incrementAilmentLoad(actor, 1, `Fallo TR ${p.resType}`);
  }
  await addProgress(actor, "resistances", p.resType, 1);

  await ChatMessage.create({
    whisper: ChatMessage.getWhisperRecipients("GM"),
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><b>Resistencia</b> FALLO ❌ — margen ${margin} • Aplicado <b>${key || kind}</b>.</p>`
  });
}
