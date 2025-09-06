// tsdc/modules/combat/initiative.js

const PKG = "tsdc";
const SETTING_DAY = "initiative.dayId";

/* ===========================
   Cartas, rankings y helpers
   =========================== */
export const SUITS = /** @type {const} */ (["spade","diamond","club","heart"]); // ♠ > ♦ > ♣ > ♥
export const RANKS = /** @type {const} */ (["2","3","4","5","6","7","8","9","10","J","Q","K","A"]);
const SUIT_PRIORITY = { spade: 3, diamond: 2, club: 1, heart: 0 };
const RANK_VALUE    = { "2":2,"3":3,"4":4,"5":5,"6":6,"7":7,"8":8,"9":9,"10":10, J:11, Q:12, K:13, A:14 };

export function suitIcon(s) { return s==="spade"?"♠":s==="diamond"?"♦":s==="club"?"♣":"♥"; }
export function scoreCard(c) { return RANK_VALUE[c.rank] + (SUIT_PRIORITY[c.suit]/10); }
export function sortBestFirst(cards){ return [...cards].sort((a,b)=>scoreCard(b)-scoreCard(a)); }

function buildStandardDeck() {
  const mkid = () => (crypto?.randomUUID?.() ?? randomID(16));
  const deck = [];
  for (const s of SUITS) for (const r of RANKS) deck.push({ id: mkid(), suit: s, rank: r });
  return deck;
}
function shuffle(arr) {
  const a = [...arr];
  for (let i=a.length-1;i>0;i--) { const j = Math.floor(Math.random()*(i+1)); [a[i],a[j]]=[a[j],a[i]]; }
  return a;
}
function drawFrom(stock, n) {
  const out = [];
  while (n-- > 0 && stock.draw.length) out.push(stock.draw.pop());
  return out;
}

/* ===========================
   “Día” de iniciativa (persistencia)
   =========================== */
export async function getCurrentDayId() {
  let id = game.settings.get(PKG, SETTING_DAY);
  if (!id) {
    id = crypto?.randomUUID?.() ?? randomID(16);
    await game.settings.set(PKG, SETTING_DAY, id);
  }
  return id;
}
/** Reinicia el “día”: resetea todos los mazos. Llama esto al terminar un descanso largo. */
export async function beginNewInitiativeDay({ announce=true } = {}) {
  const id = crypto?.randomUUID?.() ?? randomID(16);
  await game.settings.set(PKG, SETTING_DAY, id);

  // Limpia mazos PJ
  const actors = game.actors?.contents ?? [];
  for (const a of actors) {
    await a.unsetFlag(PKG, "initiative.deck");
    await a.unsetFlag(PKG, "initiative.dayId");
  }

  // Limpia mazo global de monstruos
  await game.settings.set(PKG, "initiative.monstersDeck", null);

  if (announce) ui.notifications?.info("Nuevo día de iniciativa: se reiniciaron mazos de PJ y monstruos.");
}

/* ===========================
   Preparación (característica)
   =========================== */
export function getPreparation(actor) {
  const val =
    foundry.utils.getProperty(actor, "system.core.preparacion") ??
    foundry.utils.getProperty(actor, "system.attributes.preparacion") ?? 1;
  return Math.max(1, Number(val||1));
}

/* ===========================
   Mazos de PJ (por actor, por día)
   =========================== */
async function getActorDeck(actor) {
  const dayId = await getCurrentDayId();
  const aDay = await actor.getFlag(PKG, "initiative.dayId");
  let deck = await actor.getFlag(PKG, "initiative.deck");

  // Si cambia el día → reset
  if (!deck || aDay !== dayId) {
    deck = { draw: shuffle(buildStandardDeck()), discard: [], hand: [], reshuffles: 0 };
    await actor.setFlag(PKG, "initiative.deck", deck);
    await actor.setFlag(PKG, "initiative.dayId", dayId);
  }
  return deck;
}
async function setActorDeck(actor, deck) {
  await actor.setFlag(PKG, "initiative.deck", deck);
}

async function reshuffleWithFatigue(actor, deck, reason="initiative-reshuffle") {
  const pool = [...deck.hand, ...deck.discard, ...deck.draw];
  deck.hand = []; deck.discard = []; deck.draw = shuffle(pool);
  deck.reshuffles = (deck.reshuffles||0)+1;

  // Fatiga +2
  try { Hooks.callAll("tsdc:gainFatigue", actor, 2, { reason }); } catch (_) {}
  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><b>Agotamiento de Iniciativa:</b> ${actor.name} rebaraja su mazo y gana <b>+2 Fatiga</b>.</p>`
  });
}

export async function ensureInitialHandForActor(actor) {
  const prep = getPreparation(actor);
  const deck = await getActorDeck(actor);
  if (deck.hand.length >= prep) return deck;

  let need = prep - deck.hand.length;
  let taken = drawFrom(deck, need);
  if (taken.length < need) {
    await reshuffleWithFatigue(actor, deck, "initiative-refill");
    need = prep; taken = drawFrom(deck, need);
  }
  deck.hand.push(...taken);
  await setActorDeck(actor, deck);
  return deck;
}

export async function playCardFromActor(actor, cardId) {
  const deck = await getActorDeck(actor);
  const idx = deck.hand.findIndex(c => c.id === cardId);
  if (idx < 0) return null;
  const [card] = deck.hand.splice(idx,1);
  deck.discard.push(card);
  await setActorDeck(actor, deck);
  return card;
}

export async function discardFromActor(actor, cardIds=[]) {
  if (!cardIds.length) return;
  const deck = await getActorDeck(actor);
  const toDiscard = [];
  deck.hand = deck.hand.filter(c => {
    if (cardIds.includes(c.id)) { toDiscard.push(c); return false; }
    return true;
  });
  deck.discard.push(...toDiscard);
  await setActorDeck(actor, deck);
}

export async function refillActorToPreparation(actor, { cause="end-of-round" } = {}) {
  const prep = getPreparation(actor);
  const deck = await getActorDeck(actor);
  const need = Math.max(0, prep - deck.hand.length);
  if (!need) return deck;

  let taken = drawFrom(deck, need);
  if (taken.length < need) {
    await reshuffleWithFatigue(actor, deck, `initiative-refill-${cause}`);
    deck.hand.push(...drawFrom(deck, prep));
  } else {
    deck.hand.push(...taken);
  }
  await setActorDeck(actor, deck);
  return deck;
}

/* ===========================
   Mazo global de Monstruos (por día)
   =========================== */

async function getMonstersDeck() {
  const dayId = await getCurrentDayId();
  let bundle = game.settings.get(PKG, "initiative.monstersDeck");
  if (!bundle || bundle.dayId !== dayId) {
    bundle = {
      dayId,
      draw: shuffle(buildStandardDeck()),
      discard: []
    };
    await game.settings.set(PKG, "initiative.monstersDeck", bundle);
  }
  return bundle;
}
async function setMonstersDeck(bundle) {
  await game.settings.set(PKG, "initiative.monstersDeck", bundle);
}

export async function ensureInitialHandForMonster(combat, combatant) {
  // La mano de cada monstruo se guarda en flags del COMBAT (aislada por combate)
  let hands = await combat.getFlag(PKG, "initiative.monsterHands");
  if (!hands) hands = {};
  const entry = (hands[combatant.id] ??= { hand: [] });

  const actor = combatant.actor;
  const prep = getPreparation(actor);
  if (entry.hand.length >= prep) { await combat.setFlag(PKG, "initiative.monsterHands", hands); return entry; }

  let deck = await getMonstersDeck();
  let need = prep - entry.hand.length;
  let taken = drawFrom(deck, need);

  if (taken.length < need) {
    // rebaraja global (sin fatiga en PNJ)
    const pool = [...entry.hand, ...deck.discard, ...deck.draw];
    entry.hand = []; deck.discard = []; deck.draw = shuffle(pool);
    // y roba a PREP
    entry.hand.push(...drawFrom(deck, prep));
  } else {
    entry.hand.push(...taken);
  }

  await setMonstersDeck(deck);
  hands[combatant.id] = entry;
  await combat.setFlag(PKG, "initiative.monsterHands", hands);
  return entry;
}

export async function playCardFromMonster(combat, combatant, cardId) {
  let hands = await combat.getFlag(PKG, "initiative.monsterHands");
  if (!hands) hands = {};
  const entry = (hands[combatant.id] ??= { hand: [] });
  const idx = entry.hand.findIndex(c => c.id === cardId);
  if (idx < 0) return null;
  const [card] = entry.hand.splice(idx,1);

  const deck = await getMonstersDeck();
  deck.discard.push(card);
  await setMonstersDeck(deck);

  hands[combatant.id] = entry;
  await combat.setFlag(PKG, "initiative.monsterHands", hands);
  return card;
}

export async function discardFromMonster(combat, combatant, cardIds=[]) {
  if (!cardIds.length) return;
  let hands = await combat.getFlag(PKG, "initiative.monsterHands");
  if (!hands) hands = {};
  const entry = (hands[combatant.id] ??= { hand: [] });

  const toDiscard = [];
  entry.hand = entry.hand.filter(c => {
    if (cardIds.includes(c.id)) { toDiscard.push(c); return false; }
    return true;
  });

  const deck = await getMonstersDeck();
  deck.discard.push(...toDiscard);
  await setMonstersDeck(deck);

  hands[combatant.id] = entry;
  await combat.setFlag(PKG, "initiative.monsterHands", hands);
}

export async function refillMonsterToPreparation(combat, combatant, { cause="end-of-round" } = {}) {
  const entry = await ensureInitialHandForMonster(combat, combatant);
  const actor = combatant.actor;
  const prep = getPreparation(actor);
  if (entry.hand.length >= prep) return entry;

  let deck = await getMonstersDeck();
  let need = Math.max(0, prep - entry.hand.length);
  let taken = drawFrom(deck, need);

  if (taken.length < need) {
    // rebaraja global (sin fatiga)
    const pool = [...entry.hand, ...deck.discard, ...deck.draw];
    entry.hand = []; deck.discard = []; deck.draw = shuffle(pool);
    entry.hand.push(...drawFrom(deck, prep));
  } else {
    entry.hand.push(...taken);
  }

  await setMonstersDeck(deck);
  let hands = await combat.getFlag(PKG, "initiative.monsterHands");
  if (!hands) hands = {};
  hands[combatant.id] = entry;
  await combat.setFlag(PKG, "initiative.monsterHands", hands);
  return entry;
}

/* Util visual */
export function cardToLabel(c) { return `${c.rank}${suitIcon(c.suit)}`; }
export function cardToInitiativeNumber(c) { return Number(scoreCard(c).toFixed(3)); }
