// modules/health/wounds.js

const ZONE_KEYS = ["head", "chest", "bracers", "legs", "boots"];

function cloneState(state) {
  return JSON.parse(JSON.stringify(state));
}

function defaultZoneState() {
  return { used: 0, max: 3, slots: [false, false, false], status: "ok" };
}

function defaultWoundState() {
  const zones = {};
  for (const key of ZONE_KEYS) zones[key] = defaultZoneState();
  return {
    zones,
    totalUsed: 0,
    totalMax: ZONE_KEYS.length * 3,
    zonesWithMaxed: 0,
    status: "ok",
    lastUpdate: Date.now()
  };
}

function ensureWoundState(actor) {
  const existing = cloneState(actor?.system?.health?.wounds ?? null);
  const state = existing || defaultWoundState();
  for (const key of ZONE_KEYS) {
    state.zones[key] ??= defaultZoneState();
    state.zones[key].slots = Array.isArray(state.zones[key].slots) ? [...state.zones[key].slots] : [false, false, false];
    state.zones[key].used = Number(state.zones[key].used ?? 0);
    state.zones[key].max = Number(state.zones[key].max ?? 3);
    state.zones[key].status = state.zones[key].status || "ok";
  }
  return state;
}

function sumZones(state) {
  let totalUsed = 0;
  let zonesWithMaxed = 0;
  for (const key of ZONE_KEYS) {
    const zone = state.zones[key];
    totalUsed += zone.used;
    if (zone.used >= zone.max) zonesWithMaxed += 1;
  }
  state.totalUsed = totalUsed;
  state.zonesWithMaxed = zonesWithMaxed;
  const deadly = zonesWithMaxed >= 3 || totalUsed >= state.totalMax;
  const critical = zonesWithMaxed >= 2;
  const down = zonesWithMaxed >= 1;
  state.status = deadly ? "dead" : critical ? "critical" : down ? "down" : "ok";
  state.lastUpdate = Date.now();
}

function zoneLabel(zone) {
  const map = {
    head: "Cabeza",
    chest: "Torso",
    bracers: "Brazos",
    legs: "Piernas",
    boots: "Pies"
  };
  return map[zone] || zone;
}

function severityToSlots(severity) {
  const map = { leve: 1, grave: 2, critico: 3 };
  return map[String(severity || "").toLowerCase()] ?? 1;
}

export async function addWoundSlots(actor, zoneKey, { severity = "leve", source = null } = {}) {
  if (!actor || !zoneKey) return;
  const key = String(zoneKey).toLowerCase();
  if (!ZONE_KEYS.includes(key)) return;

  const state = ensureWoundState(actor);
  const zone = state.zones[key];
  const before = zone.used;
  const slots = severityToSlots(severity);
  zone.used = Math.min(zone.max, zone.used + slots);
  for (let i = 0; i < zone.max; i += 1) zone.slots[i] = i < zone.used;
  zone.status = zone.used >= zone.max ? "disabled" : zone.status;

  sumZones(state);

  await actor.update({ "system.health.wounds": state });

  const label = zoneLabel(key);
  const amount = zone.used - before;
  if (amount <= 0) return;

  const messages = [];
  messages.push(`<b>${actor.name}</b> acumula ${amount} punto${amount===1?"":"s"} de herida en <i>${label}</i> (total ${zone.used}/${zone.max}).`);
  if (zone.used >= zone.max && before < zone.max) {
    messages.push(`<span class="muted">${label} queda gravemente dañado; la zona queda inutilizada.</span>`);
  }
  if (state.status === "critical" && before < zone.max) {
    messages.push(`<span class="muted">${actor.name} está al borde del colapso (dos zonas destruidas).</span>`);
  }
  if (state.status === "dead") {
    messages.push(`<span class="muted">${actor.name} no resiste la severidad de las heridas.</span>`);
  }

  await ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: messages.join("<br>")
  });
}

export function getWoundState(actor) {
  return ensureWoundState(actor);
}

export function currentWoundStatus(actor) {
  const state = ensureWoundState(actor);
  sumZones(state);
  return state.status;
}

