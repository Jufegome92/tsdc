// modules/wizard/mineral-vein-wizard.js
// Wizard para configurar una veta mineral recién creada

import {
  MATERIALS,
  MATERIAL_DESCRIPTIONS,
  getMaterialSummary,
  getMaterialQualityFromRoll,
  getMaterialQualityInfo,
  getMaterialTypeLabel,
  getVeinRichnessInfo,
  VEIN_RICHNESS_LEVELS,
  ACCESSIBILITY_LEVELS
} from "../features/materials/index.js";
import { TOOL_GRADES, MINERAL_EXTRACTION } from "../features/materials/extraction.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;
const DEFAULT_MATERIAL_TYPES = new Set(["metal", "piedra-preciosa", "roca", "madera", "fibra"]);

function sortByLabel(a, b) {
  return a.label.localeCompare(b.label, game.i18n.lang || "es", { sensitivity: "base" });
}

function getRollClass() {
  return foundry.dice?.Roll || CONFIG.Dice?.Roll || Roll;
}

function formatCost(value) {
  if (!Number.isFinite(value)) return "—";
  return Number(value).toLocaleString(game.i18n.lang || "es", { minimumFractionDigits: 0, maximumFractionDigits: 2 });
}

export async function openMineralVeinWizard(actor) {
  if (!actor) return;
  const wizard = new MineralVeinWizard(actor);
  await wizard.open();
  return wizard;
}

class MineralVeinWizard extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    window: { title: "Configurar Veta Mineral" },
    classes: ["tsdc", "dialog", "mineral-vein-wizard"],
    width: 720,
    height: "auto",
    top: "auto"
  };

  static PARTS = {
    body: {
      template: "systems/tsdc/templates/wizard/mineral-vein.hbs"
    }
  };

  constructor(actor, options = {}) {
    super(options);
    this.actor = actor;
    const defaultMaterialKey = this._resolveInitialMaterialKey();
    this._wizardState = {
      step: "material",
      search: "",
      selectedMaterialKey: defaultMaterialKey,
      richnessKey: actor.system?.veinRichness || "moderada",
      quality: null,
      qualityRoll: null,
      rollHTML: ""
    };
  }

  async open() {
    if (!this._wizardState.quality) {
      await this._rollQuality();
    }
    if (!this._wizardState.selectedMaterialKey) {
      this._wizardState.selectedMaterialKey = this._resolveInitialMaterialKey();
    }
    return this.render(true);
  }

  _resolveInitialMaterialKey() {
    const key = this.actor.system?.mineralKey;
    if (key && MATERIALS[key]) return key;
    const first = Object.values(MATERIALS)
      .filter(m => DEFAULT_MATERIAL_TYPES.has(m.type))
      .sort(sortByLabel)[0];
    return first?.key ?? "hierro";
  }

  async _rollQuality() {
    const RollCls = getRollClass();
    const roll = new RollCls("1d100");
    await roll.evaluate({});
    const info = getMaterialQualityFromRoll(roll.total);
    this._wizardState.quality = info;
    this._wizardState.qualityRoll = roll.total;
    this._wizardState.rollHTML = await roll.render();
  }

  _buildMaterialGroups(searchTerm, grade) {
    const query = String(searchTerm || "").trim().toLowerCase();
    const groups = new Map();

    for (const material of Object.values(MATERIALS)) {
      if (material?.type && !DEFAULT_MATERIAL_TYPES.has(material.type)) continue;
      const label = material.label || material.key;
      const description = MATERIAL_DESCRIPTIONS[material.key] || material.description || "";
      const haystack = `${material.key} ${label} ${description} ${material.type}`.toLowerCase();
      if (query && !haystack.includes(query)) continue;

      const summary = getMaterialSummary(material.key, grade);
      const typeKey = material.type || "material";
      const type = groups.get(typeKey) || {
        key: typeKey,
        typeLabel: getMaterialTypeLabel(typeKey),
        materials: []
      };

      type.materials.push({
        key: summary.key,
        label,
        description,
        typeLabel: type.typeLabel,
        durability: summary.durability,
        potency: summary.potency,
        cost: formatCost(summary.cost),
        unit: summary.unit,
        accessibilityKey: summary.accessibility?.key ?? "general",
        accessibilityLabel: summary.accessibility?.label ?? ACCESSIBILITY_LEVELS.general.label,
        isSelected: summary.key === this._wizardState.selectedMaterialKey
      });

      groups.set(typeKey, type);
    }

    const arr = Array.from(groups.values());
    arr.forEach(group => group.materials.sort(sortByLabel));
    arr.sort((a, b) => a.typeLabel.localeCompare(b.typeLabel, game.i18n.lang || "es", { sensitivity: "base" }));
    return arr;
  }

  async _prepareContext() {
    const grade = this._wizardState.quality?.grade ?? 1;
    const materialGroups = this._buildMaterialGroups(this._wizardState.search, grade);
    const hasMaterials = materialGroups.length > 0;
    const selectedMaterial = this._wizardState.selectedMaterialKey ? getMaterialSummary(this._wizardState.selectedMaterialKey, grade) : null;
    const richness = getVeinRichnessInfo(this._wizardState.richnessKey);
    const qualityInfo = this._wizardState.quality ?? getMaterialQualityInfo(grade);
    const accessibility = selectedMaterial?.accessibility ?? ACCESSIBILITY_LEVELS.general;
    const toolGradeKey = accessibility?.kitGrade ?? "basico";
    const toolInfo = TOOL_GRADES[toolGradeKey] ?? TOOL_GRADES.basico;
    const laborCost = typeof accessibility?.laborCostPerKg === "function"
      ? accessibility.laborCostPerKg(qualityInfo.grade)
      : null;

    const richnessOptions = Object.values(VEIN_RICHNESS_LEVELS).map(opt => ({
      ...opt,
      hours: Math.round(opt.durationMinutes / 60) || 1,
      isSelected: opt.key === richness.key
    }));

    const steps = [
      { key: "material", label: "Material" },
      { key: "setup", label: "Configuración" }
    ].map((step, index) => ({ ...step, index, display: index + 1 }));

    const canContinue = !!this._wizardState.selectedMaterialKey;

    return {
      actorName: this.actor.name,
      step: this._wizardState.step,
      steps,
      search: this._wizardState.search,
      materialGroups,
      hasMaterials,
      selectedMaterial,
      selectedMaterialCost: selectedMaterial ? formatCost(selectedMaterial.cost) : null,
      richness,
      richnessOptions,
      quality: {
        ...qualityInfo,
        roll: this._wizardState.qualityRoll,
        rollHTML: this._wizardState.rollHTML
      },
      accessibility,
      toolInfo,
      toolGradeKey,
      laborCost,
      canContinue,
      canFinish: canContinue && this._wizardState.step === "setup",
      dicePerRichness: richness?.dice ?? "1d10",
      extractionHours: Math.round((richness?.durationMinutes ?? 0) / 60) || 1,
      extractionMinutes: richness?.durationMinutes ?? 120
    };
  }

  _onRender(context, options) {
    super._onRender(context, options);
    const root = this.element;
    if (!root) return;

    const searchInput = root.querySelector('input[name="material-search"]');
    if (searchInput) {
      searchInput.addEventListener('input', (event) => {
        this._wizardState.search = event.target.value;
        this.render();
      });
    }

    root.querySelectorAll('[data-action="select-material"]').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const key = btn.dataset.key;
        if (!key || key === this._wizardState.selectedMaterialKey) return;
        this._wizardState.selectedMaterialKey = key;
        this.render();
      });
    });

    root.querySelectorAll('[data-action="select-richness"]').forEach(btn => {
      btn.addEventListener('click', (event) => {
        event.preventDefault();
        const key = btn.dataset.key;
        if (!key) return;
        this._wizardState.richnessKey = key;
        this.render();
      });
    });

    root.querySelectorAll('[data-action="goto-step"]').forEach(btn => {
      btn.addEventListener('click', async (event) => {
        event.preventDefault();
        const step = btn.dataset.step;
        if (!step || step === this._wizardState.step) return;
        if (step === "setup" && !this._wizardState.selectedMaterialKey) {
          ui.notifications?.warn("Selecciona un material antes de continuar.");
          return;
        }
        this._wizardState.step = step;
        this.render();
      });
    });

    const rerollBtn = root.querySelector('[data-action="reroll-quality"]');
    if (rerollBtn) {
      rerollBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        await this._rollQuality();
        this.render();
      });
    }

    const finishBtn = root.querySelector('[data-action="finish"]');
    if (finishBtn) {
      finishBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        await this._finalize();
      });
    }
  }

  async _finalize() {
    if (!this._wizardState.selectedMaterialKey) {
      ui.notifications?.warn("Selecciona un material para crear la veta.");
      return;
    }

    const qualityInfo = this._wizardState.quality ?? getMaterialQualityInfo(1);
    const summary = getMaterialSummary(this._wizardState.selectedMaterialKey, qualityInfo.grade);
    if (!summary) {
      ui.notifications?.error("No se pudo obtener la información del material seleccionado.");
      return;
    }

    const richness = getVeinRichnessInfo(this._wizardState.richnessKey);
    const accessibility = summary.accessibility ?? ACCESSIBILITY_LEVELS.general;
    const toolGradeKey = accessibility?.kitGrade ?? "basico";
    const toolInfo = TOOL_GRADES[toolGradeKey] ?? TOOL_GRADES.basico;

    const updates = {
      name: this.actor.name,
      system: {
        mineralKey: summary.key,
        mineralLabel: summary.label,
        materialType: summary.type,
        materialTypeLabel: summary.typeLabel,
        accessibility: accessibility.key,
        accessibilityLabel: accessibility.label,
        difficulty: accessibility.extractionDifficulty,
        quality: qualityInfo.grade,
        qualityKey: qualityInfo.key,
        qualityLabel: qualityInfo.label,
        qualityRoll: this._wizardState.qualityRoll,
        veinRichness: richness.key,
        veinRichnessLabel: richness.label,
        veinDuration: richness.durationMinutes,
        intervalDuration: 120,
        remainingTime: richness.durationMinutes,
        richnessDice: richness.dice,
        durability: summary.durability,
        potency: summary.potency,
        cost: summary.cost,
        unit: summary.unit,
        description: summary.description,
        toolRequirement: toolGradeKey,
        toolRequirementLabel: toolInfo.label,
        extractionNote: MINERAL_EXTRACTION.note
      }
    };

    try {
      await this.actor.update(updates);
      await this.actor.setFlag("tsdc", "mineralBuilt", true);
      ui.notifications?.info(`Veta configurada: ${summary.label} (${qualityInfo.label}).`);
    } catch (err) {
      console.error("TSDC | Error actualizando veta mineral", err);
      ui.notifications?.error("Ocurrió un error al actualizar la veta mineral.");
      return;
    }

    await this.close({ force: true });
    await this.actor.sheet?.render(true);
  }
}

export { MineralVeinWizard };
