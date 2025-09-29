// modules/rolls/inspector.js
// Inspector visual de modificadores para Chat — “¿de dónde sale mi +4?”
//
// EXPECTATIVA de datos (contrato flexible):
// - breakdown puede venir en 2 formas:
//
//   A) Forma granular (lista de candidatos):
//      {
//        base: number,             // valor base de la tirada antes de mods
//        total: number,            // total final después de mods
//        tags: string[],           // context tags efectivos en esa tirada
//        diceAdvances?: number,    // opcional: avances de dado
//        notes?: string[],         // opcional: notas del agregador
//        candidates: Array<{
//          id: string,             // estable, p.ej. "species:elfo" | "equip:shield" | "state:desequilibrado"
//          label: string,          // “Especie: Elfo”
//          amount: number,         // +2 / -3 (sumando al d20/td/base que uses)
//          bucket: string,         // bucket de stacking ("species"|"maneuver"|"object"|"specialization"|"equipment:shield"|"equipment:armor:head"|"state"|"environment"|"context")
//          reason?: string,        // breve explicación
//          tags?: string[],        // tags que activan el mod (si aplica)
//          appliedAt?: number,     // Date.now() si ayuda para desempates
//          sourceRef?: string      // id de item/efecto (opcional)
//        }]
//      }
//
//   B) Forma ya-apilada (lista de “applied” por bucket):
//      {
//        base: number,
//        total: number,
//        tags: string[],
//        diceAdvances?: number,
//        notes?: string[],
//        buckets: Array<{
//          bucket: string,
//          chosen: { id, label, amount, reason?, tags?, sourceRef? },
//          dropped?: Array<{ id, label, amount, reason?, tags?, sourceRef? }>
//        }>
//      }
//
// El inspector normaliza cualquiera de las dos.
//
// NOTA de stacking (regla del juego):
// - “Solo 1 bonificador por tipo de origen (bucket)”. Si hay múltiples candidatos
//   en el mismo bucket, se aplica el de mayor |amount|. En empate, preferimos el más reciente
//   (appliedAt más grande). Puedes cambiar esta política aquí si tu agregador ya filtra.

const BUCKET_LABELS = {
  species: "Especie",
  maneuver: "Maniobra",
  object: "Objeto",
  specialization: "Especialización",
  state: "Alteración/Agravio",
  environment: "Entorno",
  context: "Contexto",
  // equipos (por pieza)
  "equipment:shield": "Equipo: Escudo",
  "equipment:weapon": "Equipo: Arma",
  "equipment:armor:head": "Armadura: Cabeza",
  "equipment:armor:chest": "Armadura: Torso",
  "equipment:armor:bracers": "Armadura: Brazos",
  "equipment:armor:legs": "Armadura: Piernas",
  "equipment:armor:boots": "Armadura: Pies"
};

function labelForBucket(bucket) {
  return BUCKET_LABELS[bucket] || bucket;
}

function groupByBucket(candidates = []) {
  const map = new Map();
  for (const c of candidates) {
    const b = c.bucket || "context";
    if (!map.has(b)) map.set(b, []);
    map.get(b).push(c);
  }
  return map;
}

function chooseOnePerBucket(items) {
  // Política por defecto: mayor |amount|; en empate, más reciente (appliedAt)
  let best = null;
  for (const it of items) {
    if (!best) { best = it; continue; }
    const a = Math.abs(it.amount ?? 0);
    const b = Math.abs(best.amount ?? 0);
    if (a > b) best = it;
    else if (a === b) {
      const ta = Number(it.appliedAt || 0);
      const tb = Number(best.appliedAt || 0);
      if (ta > tb) best = it;
    }
  }
  const dropped = items.filter(x => x !== best);
  return { chosen: best, dropped };
}

function normalizeBreakdown(breakdown) {
  if (!breakdown) return null;

  // Si ya viene en forma “buckets”, simplemente asegúrate de que tenga campos base/total/tags:
  if (Array.isArray(breakdown.buckets)) {
    return {
      base: Number(breakdown.base ?? 0),
      total: Number(breakdown.total ?? 0),
      tags: Array.isArray(breakdown.tags) ? breakdown.tags : [],
      diceAdvances: Number(breakdown.diceAdvances || 0),
      notes: Array.isArray(breakdown.notes) ? breakdown.notes : [],
      buckets: breakdown.buckets
    };
  }

  // Si viene como “candidates”, agrupar y elegir por bucket
  if (Array.isArray(breakdown.candidates)) {
    const buckets = [];
    const grouped = groupByBucket(breakdown.candidates);
    for (const [bucket, items] of grouped.entries()) {
      const { chosen, dropped } = chooseOnePerBucket(items);
      buckets.push({ bucket, chosen, dropped });
    }
    return {
      base: Number(breakdown.base ?? 0),
      total: Number(breakdown.total ?? 0),
      tags: Array.isArray(breakdown.tags) ? breakdown.tags : [],
      diceAdvances: Number(breakdown.diceAdvances || 0),
      notes: Array.isArray(breakdown.notes) ? breakdown.notes : [],
      buckets
    };
  }

  // Forma mínima: nada útil
  return null;
}

export async function emitModInspector(actor, meta = {}, breakdown = null) {
  const norm = normalizeBreakdown(breakdown);
  const phase = meta.phase || "roll";
  const tag = meta.tag || "";
  const title =
    phase === "attack"     ? "T.A • Inspector de modificadores"
  : phase === "defense"    ? "T.D • Inspector de modificadores"
  : phase === "resistance" ? "T.R • Inspector de modificadores"
  : phase === "impact"     ? "Impacto • Inspector de modificadores"
  : "Tirada • Inspector de modificadores";

  let body = "";
  if (!norm) {
    body = `
      <div class="muted">No se recibió un desglose de modificadores desde el agregador.
      <br/>Para activarlo, haz que <code>makeRollTotal(...)</code> devuelva un objeto <code>breakdown</code> con
      <code>{ base, total, tags, candidates[] }</code> o <code>{ base, total, tags, buckets[] }</code>.</div>
    `;
  } else {
    const chips = (norm.tags || []).map(t => `<span class="chip">${t}</span>`).join(" ");
    const notes = (norm.notes || []).map(n => `<li>${n}</li>`).join("");
    const rows = (norm.buckets || []).map(b => {
      const bucketLabel = labelForBucket(b.bucket);
      const chosen = b.chosen
        ? `<div class="chosen">
             <div class="line"><b>${b.chosen.label || b.chosen.id}</b> <span class="amt">${fmtAmt(b.chosen.amount)}</span></div>
             ${b.chosen.reason ? `<div class="reason">${b.chosen.reason}</div>` : ""}
             ${renderTags(b.chosen.tags)}
           </div>`
        : `<div class="muted">— sin candidato aplicable —</div>`;

      const dropped = (b.dropped || []).map(d =>
        `<div class="dropped">
           <div class="line"><span class="label">${d.label || d.id}</span> <span class="amt">${fmtAmt(d.amount)}</span></div>
           ${d.reason ? `<div class="reason">${d.reason}</div>` : ""}
           ${renderTags(d.tags)}
         </div>`
      ).join("");

      return `
        <details class="bucket" open>
          <summary>${bucketLabel}</summary>
          ${chosen}
          ${dropped ? `<div class="sep"></div><div class="dropped-wrap">${dropped}</div>` : ""}
        </details>
      `;
    }).join("");

    body = `
      <div class="hdr">
        <div><span class="k">Base</span><span class="v">${Number(norm.base).toFixed(0)}</span></div>
        <div><span class="k">Total</span><span class="v">${Number(norm.total).toFixed(0)}</span></div>
        ${norm.diceAdvances ? `<div><span class="k">Avances de dado</span><span class="v">+${norm.diceAdvances}</span></div>` : ""}
      </div>
      ${chips ? `<div class="tags">${chips}</div>` : ""}
      <div class="buckets">${rows}</div>
      ${notes ? `<div class="notes"><ul>${notes}</ul></div>` : ""}
    `;
  }

  const html = `
    <style>
      .tsdc-modinspector { font-family: var(--font-primary, sans-serif); line-height:1.2; }
      .tsdc-modinspector .muted { opacity:.7; font-size:12px; }
      .tsdc-modinspector .hdr { display:flex; gap:12px; margin-bottom:6px; }
      .tsdc-modinspector .hdr .k { font-size:11px; text-transform:uppercase; opacity:.7; margin-right:4px; }
      .tsdc-modinspector .hdr .v { font-weight:700; }
      .tsdc-modinspector .tags { display:flex; flex-wrap:wrap; gap:4px; margin:4px 0 8px; }
      .tsdc-modinspector .chip { font-size:11px; padding:2px 6px; border-radius:10px; background:rgba(127,127,127,.15); }
      .tsdc-modinspector details.bucket { border:1px solid rgba(127,127,127,.25); border-radius:8px; padding:6px 8px; margin:6px 0; }
      .tsdc-modinspector details.bucket > summary { cursor:pointer; font-weight:600; }
      .tsdc-modinspector .line { display:flex; justify-content:space-between; gap:8px; }
      .tsdc-modinspector .chosen { padding:6px 8px; background:rgba(88,199,120,.12); border-left:3px solid #45a766; border-radius:4px; margin-top:6px; }
      .tsdc-modinspector .dropped-wrap { opacity:.8; }
      .tsdc-modinspector .dropped { padding:4px 8px; border-left:3px solid rgba(127,127,127,.3); margin:2px 0; border-radius:4px; }
      .tsdc-modinspector .reason { font-size:11px; opacity:.8; margin-top:2px; }
      .tsdc-modinspector .sep { height:6px; }
      .tsdc-modinspector .amt { font-variant-numeric: tabular-nums; }
      .tsdc-modinspector .notes { margin-top:8px; font-size:12px; }
    </style>
    <div class="tsdc-modinspector">
      <div style="margin-bottom:4px;"><strong>${title}</strong>${tag ? ` <span class="muted">(${tag})</span>` : ""}</div>
      ${body}
    </div>
  `;

  // Si es una criatura, solo mostrar al GM
  const isCreature = actor?.type === "creature";
  const messageData = {
    speaker: ChatMessage.getSpeaker({ actor }),
    content: html
  };

  if (isCreature) {
    messageData.whisper = ChatMessage.getWhisperRecipients("GM").map(u => u.id);
  }

  await ChatMessage.create(messageData);
}

function fmtAmt(n) {
  const v = Number(n || 0);
  return (v >= 0 ? `+${v}` : `${v}`);
}
function renderTags(tags) {
  if (!Array.isArray(tags) || !tags.length) return "";
  const chips = tags.map(t => `<span class="chip">${t}</span>`).join(" ");
  return `<div class="tags">${chips}</div>`;
}
