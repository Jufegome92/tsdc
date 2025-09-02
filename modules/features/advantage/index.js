// Ventaja Evolutiva (actorless) — sólo para Attack, Defense, Specialization
// Regla de aprendizaje:
// 1) La acción usa el MENOR de los dos resultados.
// 2) Si la acción fue exitosa y (mayor - menor) > rank => aprende.

const EVO_TYPES = new Set(["attack", "defense", "specialization"]);

/**
 * @param {object} p
 * @param {"attack"|"defense"|"specialization"|"attribute"|"resistance"|"impact"|"personality"} p.type
 * @param {"none"|"execution"|"learning"|"ask"} [p.mode="none"]  // "execution" = ventaja en la ejecución; "learning" = ventaja en el aprendizaje
 * @param {string} p.formula         // p.ej. "1d10 + 3 + 1 - 2"
 * @param {number} [p.rank=0]        // rango de competencia de la habilidad/arma/etc. relevante
 * @param {number} [p.target]        // DC/umbral de éxito (opcional). Si se define, éxito = total >= target
 * @param {string} [p.flavor]        // etiqueta para el chat
 * @param {boolean} [p.toChat=true]  // postear al chat
 * @returns {Promise<{resultRoll: Roll, otherRoll?: Roll, success?: boolean, learned?: boolean, usedPolicy: string}>}
 */
export async function resolveEvolution(p = {}) {
  const {
    type,
    formula,
    rank = 0,
    flavor = "Test",
    toChat = true
  } = p;

  let mode = p.mode ?? "none";
  if (!formula) throw new Error("resolveEvolution: formula requerida.");

  // Si el tipo NO usa Ventaja Evolutiva, forzamos "none"
  if (!EVO_TYPES.has(String(type || "").toLowerCase())) {
    mode = "none";
  } else if (mode === "ask") {
    mode = await promptPolicy();
  }

  // Tirada simple (o tipos sin Ventaja Evolutiva)
  if (mode === "none") {
    const r = await (new Roll(formula)).roll({ async: true });
    const success = typeof p.target === "number" ? (r.total >= p.target) : undefined;
    if (toChat) await r.toMessage({ flavor: `Transcendence • ${flavor}` });
    return { resultRoll: r, success, learned: false, usedPolicy: "none" };
  }

  // Dos tiradas idénticas
  const rA = await (new Roll(formula)).roll({ async: true });
  const rB = await (new Roll(formula)).roll({ async: true });

  const high = rA.total >= rB.total ? rA : rB;
  const low  = rA.total >= rB.total ? rB : rA;

  let resultRoll = low;      // por defecto (para aprendizaje)
  let learned = false;
  let success = undefined;

  if (mode === "execution") {
    // Ventaja en la ejecución: usar MAYOR; no aprendizaje
    resultRoll = high;
    if (toChat) await resultRoll.toMessage({ flavor: `Transcendence • ${flavor} (Execution Advantage)` });
    return { resultRoll, otherRoll: (resultRoll === rA ? rB : rA), success: typeof p.target === "number" ? (resultRoll.total >= p.target) : undefined, learned: false, usedPolicy: "execution" };
  }

  if (mode === "learning") {
    // Ventaja en el aprendizaje: usar MENOR; chequear aprendizaje
    success = typeof p.target === "number" ? (low.total >= p.target) : undefined;
    if (success === true) {
      const diff = Math.abs(high.total - low.total);
      learned = (diff > Number(rank || 0));
    }
    if (toChat) {
      const msg = `Transcendence • ${flavor} (Learning) — ${success === true ? "Success" : (success === false ? "Fail" : "Result")} ${resultRoll.total}`
        + (success === true ? ` • ${learned ? "Learned ✓" : "No Learn"}` : "");
      await resultRoll.toMessage({ flavor: msg });
    }
    return { resultRoll, otherRoll: high, success, learned, usedPolicy: "learning" };
  }

  // Fallback defensivo
  const r = await (new Roll(formula)).roll({ async: true });
  if (toChat) await r.toMessage({ flavor: `Transcendence • ${flavor}` });
  return { resultRoll: r, success: typeof p.target === "number" ? (r.total >= p.target) : undefined, learned: false, usedPolicy: "none" };
}

/** Diálogo simple para elegir política en tipos que sí usan Ventaja Evolutiva */
export async function promptPolicy() {
  return await Dialog.prompt({
    title: "Transcendence • Roll Choice",
    label: "Confirm",
    callback: html => html.find('select[name="policy"]').val(),
    content: `
      <form>
        <div class="form-group">
          <label>Choose:</label>
          <select name="policy">
            <option value="execution">Use Advantage (keep highest)</option>
            <option value="learning">Learning (use lowest; check learn)</option>
            <option value="none">No Advantage</option>
          </select>
        </div>
      </form>
    `
  });
}
