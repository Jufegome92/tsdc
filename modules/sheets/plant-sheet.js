// modules/sheets/plant-sheet.js
// Hoja simplificada para actores tipo "plant"

import { openPlantWizard } from "../wizard/plant-wizard.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;

export class PlantSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ["tsdc", "sheet", "plant"],
    window: { title: "Planta" },
    width: 500,
    height: 600,
    resizable: true
  };

  static PARTS = {
    content: {
      template: "systems/tsdc/templates/actor/plant-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  get title() {
    return this.actor?.name || "Planta";
  }

  async _prepareContext(context = {}, _options = {}) {
    context = await super._prepareContext?.(context, _options) ?? {};
    context.actor = this.actor;
    context.system = this.actor.system ?? {};

    // Preparar opciones para selects
    context.accessibilityOptions = [
      { value: "alta", label: "Alta" },
      { value: "media", label: "Media" },
      { value: "baja", label: "Baja" }
    ];

    context.difficultyOptions = [
      { value: "fundamentos", label: "Fundamentos" },
      { value: "riguroso", label: "Riguroso" },
      { value: "extremo", label: "Extremo" }
    ];

    context.useOptions = [
      { value: "elixir", label: "Elixir" },
      { value: "veneno", label: "Veneno" },
      { value: "ambos", label: "Ambos" }
    ];

    // Calcular tiempo de extracción basado en accesibilidad
    const accessibility = context.system.accessibility || "alta";
    const timeMap = {
      alta: 15,
      media: 30,
      baja: 45
    };
    context.calculatedExtractionTime = timeMap[accessibility] || 15;

    // Calcular intervalos
    const intervalMap = {
      alta: 1,
      media: 2,
      baja: 3
    };
    context.calculatedIntervals = intervalMap[accessibility] || 1;

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Añadir listeners para campos editables
    const html = this.element;

    html.querySelectorAll("input, select, textarea").forEach(input => {
      input.addEventListener("change", (ev) => this._onFieldChange(ev));
    });

    // Wizard button
    html.querySelectorAll('[data-action="open-wizard"]').forEach(btn => {
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        await openPlantWizard(this.actor);
      });
    });
  }

  async _onFieldChange(event) {
    const input = event.target;
    const field = input.name;
    if (!field) return;

    let value = input.value;

    // Convertir números
    if (input.type === "number") {
      value = Number(value);
    }

    await this.actor.update({ [field]: value });
  }
}
