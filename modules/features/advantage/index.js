// Ventaja Evolutiva (actorless) — Attack/Defense/Specialization usan evolución.
// Reglas:
// - execution: usa MAYOR; no aprendizaje.
// - learning:  usa MENOR; si MENOR >= DC y (MAYOR - MENOR) > rank => aprende.

const EVO_TYPES = new Set(["attack", "defense", "specialization"]);

/**
 * @param {object} p
 * @param {"attack"|"defense"|"specialization"|"attribute"|"resistance"|"impact"|"personality"} p.type
 * @param {"none"|"execution"|"learning"|"ask"} [p.mode="none"]
 * @param {string} p.formula
 * @param {number} [p.rank=0]
 * @param {string} [p.flavor]
 * @param {boolean} [p.toChat=true]
 * @param {object} [p.meta]   // { key?, isManeuver?, armorType? }  — se guardará en flags
 * @param {Actor}  [p.actor]  // para guardar actorId en flags
 * @returns {Promise<{resultRoll: Roll, otherRoll?: Roll, usedPolicy: string}>}
 */
export async function resolveEvolution(p = {}) {
  const {
    type, formula, rank = 0, flavor = "Test",
    toChat = true, meta = {}, actor
  } = p;

  let mode = p.mode ?? "none";
  if (!formula) throw new Error("resolveEvolution: formula requerida.");

  const usesEvo = EVO_TYPES.has(String(type || "").toLowerCase());
  if (!usesEvo) {
    // Tirada simple (1 dado)
    const r = await (new Roll(formula)).roll({ async: true });
    if (toChat) {
      await r.toMessage({
        flavor: `Transcendence • ${flavor}`,
        flags: {
          tsdc: {
            version: 1,
            actorId: actor?._id ?? actor?.id ?? null,
            type, policy: "none",
            rank,
            meta: { ...meta },
            totals: { low: r.total, high: r.total }
          }
        }
      });
    }
    return { resultRoll: r, usedPolicy: "none" };
  }

  if (mode === "ask") mode = await promptPolicy();

  // Dos tiradas idénticas (para execution/learning)
  const rA = await (new Roll(formula)).roll({ async: true });
  const rB = await (new Roll(formula)).roll({ async: true });

  const high = rA.total >= rB.total ? rA : rB;
  const low  = rA.total >= rB.total ? rB : rA;

  let resultRoll = low; // por defecto (learning)
  let usedPolicy = mode;

  if (mode === "execution") resultRoll = high;

  if (toChat) {
    const policyTag = (mode === "execution") ? "Execution" : (mode === "learning" ? "Learning" : "None");
    await resultRoll.toMessage({
      flavor: `Transcendence • ${flavor}${usesEvo ? ` (${policyTag})` : ""}`,
      flags: {
        tsdc: {
          version: 1,
          actorId: actor?._id ?? actor?.id ?? null,
          type, policy: usedPolicy,
          rank,
          meta: { ...meta },
          totals: { low: low.total, high: high.total }
        }
      }
    });
  }

  return {
    resultRoll,
    otherRoll: resultRoll === rA ? rB : rA,
    usedPolicy
  };
}

/** Diálogo para elegir política cuando mode === "ask" */
export async function promptPolicy() {
  return await Dialog.prompt({
    title: "Transcendence • Roll Choice",
    label: "Confirmar",
    callback: html => html.find('select[name="policy"]').val(),
    content: `
      <form>
        <div class="form-group">
          <label>Elige:</label>
          <select name="policy">
            <option value="execution">Ejecución (mantén el mayor)</option>
            <option value="learning">Aprender (usa el menor; evalúa aprendizaje)</option>
            <option value="none">Sin ventaja</option>
          </select>
        </div>
      </form>
    `
  });
}
