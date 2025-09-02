// module/sheets/actor-sheet.js
export class TSDCActorSheet extends ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["transcendence", "sheet", "actor"],
      template: "systems/tsdc/templates/actor/character-sheet.hbs",
      width: 520,
      height: 560,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }]
    });
  }

  get template() {
    // Podrías tener diferentes plantillas por tipo si quieres:
    return "systems/tsdc/templates/actor/character-sheet.hbs";
  }

  async getData(options={}) {
    const data = await super.getData(options);
    data.labels = {
    strength: game.i18n.localize("TSDC.Attr.strength"),
    agility:  game.i18n.localize("TSDC.Attr.agility"),
    tenacity: game.i18n.localize("TSDC.Attr.tenacity"),
    cunning:  game.i18n.localize("TSDC.Attr.cunning"),
    wisdom:   game.i18n.localize("TSDC.Attr.wisdom"),
    intellect:game.i18n.localize("TSDC.Attr.intellect"),
    aura:     game.i18n.localize("TSDC.Attr.aura"),
    composure:game.i18n.localize("TSDC.Attr.composure"),
    presence: game.i18n.localize("TSDC.Attr.presence"),
    prep:     game.i18n.localize("TSDC.Derived.preparation"),
    resi:     game.i18n.localize("TSDC.Derived.resilience")
    };
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    if (!this.isEditable) return;

    // Botón de prueba de tirada con Ventaja Evolutiva
    html.find('[data-action="evo-roll"]').on("click", async (ev) => {
      ev.preventDefault();
      const mode = html.find('select[name="evoMode"]').val() ?? "ask";
      const base = Number(html.find('input[name="base"]').val() || 0);
      const bonus = Number(html.find('input[name="bonus"]').val() || 0);
      const diff = Number(html.find('input[name="diff"]').val() || 0);
      const dc = Number(html.find('input[name="dc"]').val() || 10);
      const rank = Number(html.find('input[name="rank"]').val() || 0);

      const formula = `1d10 + ${base} + ${bonus} - ${diff}`;
      const { resolveEvolution } = await import("../features/advantage/index.js");

      await resolveEvolution({
        type: "attack",     // demo: ataque; cambia a "defense"/"specialization" si quieres
        mode,
        formula,
        rank,
        target: dc,
        flavor: "Sheet Test"
      });
    });
  }
}
