// modules/features/advantage/index.js
const EVO_TYPES = new Set(["attack", "defense", "specialization"]);

/**
 * @param {object} p
 * @param {"attack"|"defense"|"specialization"|"attribute"|"resistance"|"impact"|"personality"} p.type
 * @param {"none"|"execution"|"learning"|"ask"} [p.mode="none"]
 * @param {string} p.formula
 * @param {number} [p.rank=0]
 * @param {string} [p.flavor]
 * @param {boolean} [p.toChat=true]
 * @param {object} [p.meta]
 * @param {Actor}  [p.actor]
 */
export async function resolveEvolution(p = {}) {
  const {
    type, formula, rank = 0, flavor = "Test",
    toChat = true, meta = {}, actor
  } = p;

  let mode = p.mode ?? "none";
  if (!formula) throw new Error("resolveEvolution: formula requerida.");

  const usesEvo = EVO_TYPES.has(String(type || "").toLowerCase());

  // Tirada simple (sin evolución)
  if (!usesEvo) {
    const r = new Roll(formula);
    await r.evaluate(); // async
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

  // Dos tiradas (alto/bajo)
  const rA = new Roll(formula);
  await rA.evaluate();
  const rB = new Roll(formula);
  await rB.evaluate();

  const high = rA.total >= rB.total ? rA : rB;
  const low  = rA.total >= rB.total ? rB : rA;

  let resultRoll = (mode === "execution") ? high : low;
  const usedPolicy = mode;

  if (toChat) {
    const policyTag = (mode === "execution") ? "Execution" : (mode === "learning" ? "Learning" : "None");
    await resultRoll.toMessage({
      flavor: `Transcendence • ${flavor}${policyTag ? ` (${policyTag})` : ""}`,
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
  const v = await foundry.applications.api.DialogV2.prompt({
    window: { title: "Transcendence • Roll Choice" },
    content: `
      <form class="t-col" style="gap:8px;">
        <div class="t-field">
          <label>Elige</label>
          <select name="policy">
            <option value="execution">Ejecución (mantén el mayor)</option>
            <option value="learning">Aprender (usa el menor; evalúa aprendizaje)</option>
            <option value="none">Sin ventaja</option>
          </select>
        </div>
      </form>
    `,
    ok: {
      label: "Confirmar",
      callback: (_ev, button) => String(button.form.elements.policy?.value || "none")
    }
  });
  return v ?? "none";
}
