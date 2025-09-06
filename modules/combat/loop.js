// tsdc/modules/combat/loop.js
import {
  getPreparation,
  ensureInitialHandForActor,
  ensureInitialHandForMonster,
  playCardFromActor,
  playCardFromMonster,
  discardFromActor,
  discardFromMonster,
  refillActorToPreparation,
  refillMonsterToPreparation,
  cardToInitiativeNumber,
  suitIcon
} from "./initiative.js";
import { askCard } from "./ui/card-dialog.js";

/** Mensajito útil */
function liLine(name, card, init) {
  return `<li>${name}: <b>${card.rank}</b> ${suitIcon(card.suit)} (${init})</li>`;
}

Hooks.on("createCombat", async (combat) => {
  // Preparar manos iniciales
  for (const c of combat.combatants) {
    if (!c.actor) continue;
    if (c.actor.type === "character") await ensureInitialHandForActor(c.actor);
    else await ensureInitialHandForMonster(combat, c);
  }
  await ChatMessage.create({ content: `<p><b>Conflicto iniciado.</b> Seleccionen carta de iniciativa.</p>` });

  await prepareRoundInitiatives(combat);
  Hooks.callAll("tsdc:onStartRound", combat, combat.round ?? 1);
});

Hooks.on("updateCombat", async (combat, changed) => {
  // Cambio de ronda
  if (changed.round != null) {
    const prev = (combat.previous?.round ?? (combat.round - 1)) || 0;
    if (prev > 0) Hooks.callAll("tsdc:onEndRound", combat, prev);
    await prepareRoundInitiatives(combat);
    Hooks.callAll("tsdc:onStartRound", combat, combat.round);
  }

  // Cambio de turno
  if (changed.turn != null) {
    const prevIdx = combat.previous?.turn;
    if (Number.isInteger(prevIdx) && prevIdx >= 0) {
      const prevC = combat.combatants.at(prevIdx);
      if (prevC?.actor) Hooks.callAll("tsdc:onEndTurn", combat, prevC.actor);
    }
    const curr = combat.combatant;
    if (curr?.actor) Hooks.callAll("tsdc:onStartTurn", combat, curr.actor);
  }
});

Hooks.on("deleteCombat", async (combat) => {
  // Nada que resetear aquí: los mazos persisten por “día”.
});

/** ===== Ronda: pedir carta + fijar iniciativas, luego pedir descartes y reponer ===== */
async function prepareRoundInitiatives(combat) {
  const plays = [];

  // 1) PJ: UI a cada dueño (o a GM si no hay dueño)
  for (const c of combat.combatants) {
    if (!c.actor) continue;

    if (c.actor.type === "character") {
      const deck = await ensureInitialHandForActor(c.actor);
      const title = `Iniciativa de ${c.name}`;
      const subtitle = `Elige 1 carta (mano: ${deck.hand.length})`;

      const payload = await askCard({ mode:"play", cards: deck.hand, title, subtitle });
      let chosenId = payload?.play;
      if (!chosenId) {
        // Fallback: si cancelan, elegimos la mejor
        const [best] = deck.hand.slice().sort((a,b)=>cardToInitiativeNumber(b)-cardToInitiativeNumber(a));
        chosenId = best?.id;
      }
      const card = await playCardFromActor(c.actor, chosenId);
      if (!card) continue;

      const init = cardToInitiativeNumber(card);
      plays.push({ c, card, init });
    }
  }

  // 2) Monstruos: UI para GM por cada combatiente enemigo
  for (const c of combat.combatants) {
    if (!c.actor || c.actor.type === "character") continue;
    const entry = await ensureInitialHandForMonster(combat, c);
    const title = `Iniciativa de ${c.name} (Monstruo)`;
    const subtitle = `Elige 1 carta (mano: ${entry.hand.length})`;

    const payload = await askCard({ mode:"play", cards: entry.hand, title, subtitle });
    let chosenId = payload?.play;
    if (!chosenId) {
      const [best] = entry.hand.slice().sort((a,b)=>cardToInitiativeNumber(b)-cardToInitiativeNumber(a));
      chosenId = best?.id;
    }
    const card = await playCardFromMonster(combat, c, chosenId);
    if (!card) continue;

    const init = cardToInitiativeNumber(card);
    plays.push({ c, card, init });
  }

  // 3) Fijar iniciativas
  for (const p of plays) {
    try { await combat.setInitiative(p.c.id, p.init); }
    catch (err) { console.warn("[tsdc] setInitiative failed for", p.c.id, err); }
  }

  // 4) Mensaje de orden
  const lines = plays.sort((a,b)=>b.init-a.init).map(p => liLine(p.c.name, p.card, p.init)).join("");
  if (lines) {
    await ChatMessage.create({ content: `<p><b>Iniciativa (Ronda ${combat.round ?? 1}):</b></p><ol>${lines}</ol>` });
  }

  // 5) Al FINAL de la ronda: descartar voluntariamente y reponer
  queueEndOfRoundDiscardsAndRefill(combat.id);
}

function queueEndOfRoundDiscardsAndRefill(combatId) {
  Hooks.once("tsdc:onEndRound", async (combat) => {
    if (!combat || combat.id !== combatId) return;

    // PJs: pedir descartes (opcional) y reponer
    for (const c of combat.combatants) {
      if (!c.actor) continue;
      if (c.actor.type === "character") {
        const deck = await ensureInitialHandForActor(c.actor);
        // Si no hay nada en mano, salta
        if (!deck.hand?.length) continue;

        const title = `Descartar (opcional) — ${c.name}`;
        const subtitle = `Selecciona cartas a descartar y pulsa “Reponer”`;
        const payload = await askCard({ mode:"discard", cards: deck.hand, title, subtitle });

        if (payload?.discard?.length) {
          await discardFromActor(c.actor, payload.discard);
        }
        // reponer hasta Preparación
        await refillActorToPreparation(c.actor, { cause:"end-of-round" });
      }
    }

    // Monstruos: GM descarta (opcional) y reponemos
    for (const c of combat.combatants) {
      if (!c.actor || c.actor.type === "character") continue;
      const entry = await ensureInitialHandForMonster(combat, c);
      if (!entry.hand?.length) continue;

      const title = `Descartar (opcional) — ${c.name} (Monstruo)`;
      const subtitle = `Selecciona cartas a descartar y pulsa “Reponer”`;
      const payload = await askCard({ mode:"discard", cards: entry.hand, title, subtitle });

      if (payload?.discard?.length) {
        await discardFromMonster(combat, c, payload.discard);
      }
      await refillMonsterToPreparation(combat, c, { cause:"end-of-round" });
    }

    await ChatMessage.create({ content: `<p><i>Fin de ronda:</i> descartes aplicados y manos repuestas hasta Preparación.</p>` });
  });
}
