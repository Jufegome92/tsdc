// tsdc/modules/combat/ui/card-dialog.js
import { suitIcon, cardToLabel } from "../initiative.js";

const TPL = `
<section class="tsdc-card-dialog">
  <header class="t-row" style="justify-content:space-between; align-items:center;">
    <h3 style="margin:0;">{{title}}</h3>
    <div class="muted">{{subtitle}}</div>
  </header>
  <div class="grid" style="grid-template-columns: repeat(auto-fill,minmax(80px,1fr)); gap:8px; margin-top:8px;">
    {{#each cards}}
      <button class="t-btn card-btn" data-id="{{id}}">
        <div class="rank">{{rank}}</div>
        <div class="suit">{{suitIcon suit}}</div>
      </button>
    {{/each}}
  </div>

  {{#if allowDiscard}}
    <hr />
    <p class="muted">Descarta una o más y luego “Reponer”.</p>
    <div class="grid" style="grid-template-columns: repeat(auto-fill,minmax(80px,1fr)); gap:8px;">
      {{#each cards}}
        <label class="t-check card-check">
          <input type="checkbox" data-id="{{id}}"/>
          <span class="rank">{{rank}}</span><span class="suit">{{suitIcon suit}}</span>
        </label>
      {{/each}}
    </div>
  {{/if}}
</section>
`;

function renderSimple(template, data) {
  // micro-render sin deps
  return template
    .replaceAll("{{title}}", data.title)
    .replaceAll("{{subtitle}}", data.subtitle ?? "")
    .replaceAll("{{#if allowDiscard}}", data.allowDiscard ? "" : "<!--")
    .replaceAll("{{/if}}", data.allowDiscard ? "" : "-->")
    .replaceAll("{{#each cards}}", "")
    .replaceAll("{{/each}}", "")
    .replaceAll("{{suitIcon suit}}", "§suit§")
    .replaceAll("{{rank}}", "§rank§")
    .replaceAll("{{id}}", "§id§")
    .replaceAll("{{suit}}", "§s§")
    .split("§").reduce((acc, cur, i, arr) => {
      // No-op; ya mapeamos abajo
      return acc;
    }, "");
}

// Nota: para mantenerlo auto-contenido, hacemos un render manual de la lista
function renderCardsInto(html, cards, allowDiscard) {
  // Rellenar botones
  html = html.replaceAll(`<button class="t-btn card-btn" data-id="{{id}}">
        <div class="rank">{{rank}}</div>
        <div class="suit">{{suitIcon suit}}</div>
      </button>`, cards.map(c => `
      <button class="t-btn card-btn" data-id="${c.id}">
        <div class="rank">${c.rank}</div>
        <div class="suit">${suitIcon(c.suit)}</div>
      </button>`).join(""));

  if (allowDiscard) {
    html = html.replace(
      `<label class="t-check card-check">
          <input type="checkbox" data-id="{{id}}"/>
          <span class="rank">{{rank}}</span><span class="suit">{{suitIcon suit}}</span>
        </label>`,
      cards.map(c => `
        <label class="t-check card-check">
          <input type="checkbox" data-id="${c.id}"/>
          <span class="rank">${c.rank}</span><span class="suit">${suitIcon(c.suit)}</span>
        </label>`).join("")
    );
  }
  // suitIcon helper
  html = html.replaceAll("§suit§", ""); // ya resuelto
  html = html.replaceAll("§rank§", ""); // ya resuelto
  html = html.replaceAll("§id§", "");   // ya resuelto
  html = html.replaceAll("§s§", "");    // ya resuelto
  return html;
}

export class CardPickerDialog extends Application {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["tsdc", "tsdc-card-picker"],
      width: 520,
      height: "auto",
      resizable: false,
      template: null,
      title: "Iniciativa",
    });
  }

  /** mode: "play" | "discard" | "play-and-discard"
   *  opts: { cards, title, subtitle }
   */
  constructor({ mode="play", cards=[], title="Elige carta", subtitle="" } = {}, resolveFn=null) {
    super();
    this.mode = mode;
    this.cards = cards;
    this.headerTitle = title;
    this.subtitle = subtitle;
    this._resolver = resolveFn;
    this._selectedToDiscard = new Set();
  }

  getData() {
    return {
      title: this.headerTitle,
      subtitle: this.subtitle,
      cards: this.cards,
      allowDiscard: this.mode !== "play" // en discard o mixto mostramos checkboxes
    };
  }

  async _renderInner(...args) {
    // Render manual de plantilla simple
    const htmlRaw = `
      ${TPL}
      <footer class="t-row" style="gap:6px; margin-top:8px;">
        ${this.mode !== "discard" ? `<button data-action="confirm-play" class="t-btn">Jugar seleccionada</button>` : ""}
        ${this.mode !== "play" ? `<button data-action="do-discard" class="t-btn">Descartar seleccionadas</button>` : ""}
        ${this.mode !== "play" ? `<button data-action="refill" class="t-btn">Reponer</button>` : ""}
        <button data-action="cancel" class="t-btn muted">Cancelar</button>
      </footer>
    `;

    let html = document.createElement("div");
    const rendered = renderCardsInto(
      htmlRaw
        .replaceAll("{{title}}", this.headerTitle)
        .replaceAll("{{subtitle}}", this.subtitle),
      this.cards,
      this.mode !== "play"
    );
    html.innerHTML = rendered;
    return html;
  }

  activateListeners(html) {
    super.activateListeners(html);

    // Elegir carta a jugar (click en botón)
    html.on("click", ".card-btn", ev => {
      html.find(".card-btn").removeClass("is-selected");
      ev.currentTarget.classList.add("is-selected");
      this._selectedCardId = ev.currentTarget.dataset.id;
    });

    // Selección de descartes
    html.on("change", ".card-check input[type=checkbox]", ev => {
      const id = ev.currentTarget.dataset.id;
      if (ev.currentTarget.checked) this._selectedToDiscard.add(id);
      else this._selectedToDiscard.delete(id);
    });

    // Acciones de footer
    html.on("click", "[data-action=confirm-play]", async ev => {
      if (!this._selectedCardId) return ui.notifications?.warn("Selecciona una carta para jugar.");
      this._closeWith({ play: this._selectedCardId, discard: [] });
    });
    html.on("click", "[data-action=do-discard]", async ev => {
      if (!this._selectedToDiscard.size) return ui.notifications?.warn("Selecciona cartas para descartar.");
      this._closeWith({ play: null, discard: [...this._selectedToDiscard] });
    });
    html.on("click", "[data-action=refill]", async ev => {
      this._closeWith({ play: null, discard: [...this._selectedToDiscard], refill: true });
    });
    html.on("click", "[data-action=cancel]", () => this._closeWith(null));
  }

  _closeWith(payload) {
    if (this._resolver) this._resolver(payload);
    this.close();
  }
}

/** Promise helper */
export function askCard({ mode="play", cards=[], title, subtitle } = {}) {
  return new Promise((resolve) => {
    const dlg = new CardPickerDialog({ mode, cards, title, subtitle }, resolve);
    dlg.render(true);
  });
}
