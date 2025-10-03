// modules/wizard/plant-wizard.js
// Wizard para configurar una planta recién creada

import { PLANTS } from "../features/materials/plants.js";
import { ACCESSIBILITY_LEVELS } from "../features/materials/index.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

function sortByLabel(a, b) {
  return a.label.localeCompare(b.label, game.i18n.lang || "es", { sensitivity: "base" });
}

function formatCost(value) {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toLocaleString(game.i18n.lang || "es", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

// Mapeo de accesibilidad a dificultad y herramienta
const PLANT_ACCESSIBILITY_INFO = {
  alta: {
    key: "alta",
    label: "Alta",
    difficulty: "Fundamentos",
    difficultyDC: 10,
    toolRequired: "Kit de Herboristería (Básico)",
    laborCost: 8,
    extractionTime: 15 // minutos base
  },
  media: {
    key: "media",
    label: "Media",
    difficulty: "Riguroso",
    difficultyDC: 15,
    toolRequired: "Kit de Herboristería (Avanzado)",
    laborCost: 20,
    extractionTime: 30
  },
  baja: {
    key: "baja",
    label: "Baja",
    difficulty: "Extremo",
    difficultyDC: 20,
    toolRequired: "Kit de Herboristería (Especializado)",
    laborCost: 40,
    extractionTime: 45
  }
};

export async function openPlantWizard(actor) {
  if (!actor) return;
  const wizard = new PlantWizard(actor);
  await wizard.open();
  return wizard;
}

export class PlantWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: { title: "Configurar Planta" },
    classes: ["tsdc", "dialog", "plant-wizard"],
    width: 720,
    height: "auto",
    top: "auto"
  };

  static PARTS = {
    body: {
      template: "systems/tsdc/templates/wizard/plant.hbs"
    }
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    const defaultPlantKey = this._resolveInitialPlantKey();
    this._wizardState = {
      step: "plant",
      search: "",
      selectedPlantKey: defaultPlantKey,
      level: actor.system?.level || 1
    };
  }

  async open() {
    if (!this._wizardState.selectedPlantKey) {
      this._wizardState.selectedPlantKey = this._resolveInitialPlantKey();
    }
    return this.render(true);
  }

  _resolveInitialPlantKey() {
    const key = this.actor.system?.plantKey;
    if (key && PLANTS[key]) return key;
    const first = Object.values(PLANTS).sort(sortByLabel)[0];
    return first?.key ?? "lavanda";
  }

  _buildPlantGroups(searchTerm) {
    const query = String(searchTerm || "").trim().toLowerCase();
    const groups = new Map();

    for (const plant of Object.values(PLANTS)) {
      const label = plant.label || plant.key;
      const haystack = `${plant.key} ${label} ${plant.use}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;

      const accessibilityKey = plant.accessibility || "alta";
      const accessInfo = PLANT_ACCESSIBILITY_INFO[accessibilityKey] || PLANT_ACCESSIBILITY_INFO.alta;

      const typeKey = plant.use || "elixir";
      const type = groups.get(typeKey) || {
        key: typeKey,
        typeLabel: typeKey === "elixir" ? "Elixir" : typeKey === "veneno" ? "Veneno" : "Ambos",
        plants: []
      };

      type.plants.push({
        key: plant.key,
        label,
        alchemicalIndex: plant.alchemicalIndex,
        use: plant.use,
        cost: formatCost(plant.costPerUnit),
        accessibilityKey,
        accessibilityLabel: accessInfo.label,
        extractionTime: plant.extractionTime,
        isSelected: plant.key === this._wizardState.selectedPlantKey
      });

      groups.set(typeKey, type);
    }

    const arr = Array.from(groups.values());
    arr.forEach(group => group.plants.sort(sortByLabel));
    arr.sort((a, b) => a.typeLabel.localeCompare(b.typeLabel, game.i18n.lang || "es", { sensitivity: "base" }));
    return arr;
  }

  async _prepareContext() {
    const plantGroups = this._buildPlantGroups(this._wizardState.search);
    const hasPlants = plantGroups.length > 0;
    const selectedPlant = this._wizardState.selectedPlantKey ? PLANTS[this._wizardState.selectedPlantKey] : null;

    let accessibility = null;
    let selectedPlantCost = "—";

    if (selectedPlant) {
      const accessKey = selectedPlant.accessibility || "alta";
      accessibility = PLANT_ACCESSIBILITY_INFO[accessKey] || PLANT_ACCESSIBILITY_INFO.alta;
      selectedPlantCost = formatCost(selectedPlant.costPerUnit);
    }

    return {
      step: this._wizardState.step,
      search: this._wizardState.search,
      plantGroups,
      hasPlants,
      selectedPlant: selectedPlant ? {
        key: selectedPlant.key,
        label: selectedPlant.label,
        alchemicalIndex: selectedPlant.alchemicalIndex,
        use: selectedPlant.use,
        useLabel: selectedPlant.use === "elixir" ? "Elixir" : selectedPlant.use === "veneno" ? "Veneno" : "Ambos",
        costPerUnit: selectedPlantCost,
        extractionTime: selectedPlant.extractionTime
      } : null,
      accessibility,
      level: this._wizardState.level,
      toolInfo: accessibility ? {
        label: accessibility.toolRequired,
        laborCost: accessibility.laborCost
      } : null
    };
  }

  _onRender(context, options) {
    const root = this.element;

    // Search
    const searchInput = root.querySelector('input[name="search"]');
    if (searchInput) {
      searchInput.addEventListener("input", (event) => {
        this._wizardState.search = event.target.value;
        this.render();
      });
    }

    // Select plant
    root.querySelectorAll('[data-action="select-plant"]').forEach(btn => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        const key = btn.dataset.key;
        if (key && PLANTS[key]) {
          this._wizardState.selectedPlantKey = key;
          this._wizardState.step = "setup";
          this.render();
        }
      });
    });

    // Level adjustment
    root.querySelectorAll('[data-action="adjust-level"]').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const delta = parseInt(btn.dataset.delta, 10);
        if (!delta) return;
        const newLevel = Math.max(1, Math.min(20, this._wizardState.level + delta));
        if (newLevel !== this._wizardState.level) {
          this._wizardState.level = newLevel;
          this.render();
        }
      });
    });

    const levelInput = root.querySelector('input[name="plant-level"]');
    if (levelInput) {
      levelInput.addEventListener('change', (event) => {
        const value = parseInt(event.target.value, 10);
        if (!isNaN(value) && value >= 1 && value <= 20) {
          this._wizardState.level = value;
          this.render();
        }
      });
    }

    // Navigation
    root.querySelectorAll('[data-action="back"]').forEach(btn => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        this._wizardState.step = "plant";
        this.render();
      });
    });

    root.querySelectorAll('[data-action="cancel"]').forEach(btn => {
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        this.close();
      });
    });

    root.querySelectorAll('[data-action="finalize"]').forEach(btn => {
      btn.addEventListener("click", async (event) => {
        event.preventDefault();
        await this._finalize();
      });
    });
  }

  async _finalize() {
    const plant = PLANTS[this._wizardState.selectedPlantKey];
    if (!plant) {
      ui.notifications.warn("No se ha seleccionado ninguna planta.");
      return;
    }

    const accessKey = plant.accessibility || "alta";
    const accessInfo = PLANT_ACCESSIBILITY_INFO[accessKey] || PLANT_ACCESSIBILITY_INFO.alta;

    const updates = {
      name: this.actor.name || plant.label,
      system: {
        plantKey: plant.key,
        level: this._wizardState.level,
        alchemicalIndex: plant.alchemicalIndex,
        use: plant.use,
        cost: plant.costPerUnit,
        accessibility: accessKey,
        difficulty: accessInfo.difficulty,
        extractionTime: plant.extractionTime,
        remainingExtractions: 10, // Default value
        maxExtractions: 10,
        depleted: false
      }
    };

    await this.actor.update(updates);
    await this.actor.setFlag("tsdc", "plantBuilt", true);
    ui.notifications.info(`Planta configurada: ${plant.label}`);
    this.close();

    // Render the sheet after wizard closes
    setTimeout(() => {
      this.actor.sheet?.render(true);
    }, 100);
  }
}
