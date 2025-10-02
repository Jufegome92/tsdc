// modules/sheets/mineral-vein-sheet.js
// Hoja enriquecida para actores tipo "mineral-vein"

import {
  getMaterialSummary,
  getMaterialTypeLabel,
  getMaterialQualityInfo,
  normalizeMaterialQuality,
  getVeinRichnessInfo,
  VEIN_RICHNESS_LEVELS,
  MATERIAL_QUALITY_LEVELS
} from "../features/materials/index.js";
import { ACCESSIBILITY_LEVELS } from "../features/materials/accessibility.js";
import { TOOL_GRADES, MINERAL_EXTRACTION } from "../features/materials/extraction.js";
import { openMineralVeinWizard } from "../wizard/mineral-vein-wizard.js";

const { HandlebarsApplicationMixin } = foundry.applications.api;

function formatNumber(value) {
  if (!Number.isFinite(Number(value))) return "—";
  return Number(value).toLocaleString(game.i18n.lang || "es", {
    maximumFractionDigits: 2,
    minimumFractionDigits: 0
  });
}

export class MineralVeinSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ["tsdc", "sheet", "mineral-vein"],
    window: { title: "Veta Mineral" },
    width: 500,
    height: 650,
    resizable: true
  };

  static PARTS = {
    content: {
      template: "systems/tsdc/templates/actor/mineral-vein-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  get title() {
    return this.actor?.name || "Veta Mineral";
  }

  async _prepareContext(context = {}, _options = {}) {
    context = await super._prepareContext?.(context, _options) ?? {};
    const actor = this.actor;
    const system = actor.system ?? {};

    const grade = normalizeMaterialQuality(system.quality);
    const materialSummary = system.mineralKey ? getMaterialSummary(system.mineralKey, grade) : null;
    const qualityInfo = getMaterialQualityInfo(grade);
    const richness = getVeinRichnessInfo(system.veinRichness ?? materialSummary?.veinRichness ?? "moderada");
    const accessibility = ACCESSIBILITY_LEVELS[system.accessibility] ?? materialSummary?.accessibility ?? ACCESSIBILITY_LEVELS.general;
    const toolKey = system.toolRequirement ?? accessibility.kitGrade ?? "basico";
    const toolInfo = TOOL_GRADES[toolKey] ?? TOOL_GRADES.basico;

    const veinDuration = system.veinDuration ?? richness?.durationMinutes ?? 240;
    const intervalDuration = system.intervalDuration ?? 120;
    const intervals = Math.max(1, Math.ceil(veinDuration / intervalDuration));
    const remainingTime = system.remainingTime ?? veinDuration;
    const remainingHours = Math.floor(remainingTime / 60);
    const remainingMinutes = remainingTime % 60;

    const laborCost = typeof accessibility?.laborCostPerKg === "function"
      ? accessibility.laborCostPerKg(grade)
      : null;

    context.actor = actor;
    context.system = system;

    context.materialInfo = {
      key: system.mineralKey ?? materialSummary?.key ?? "",
      label: system.mineralLabel ?? materialSummary?.label ?? (system.mineralKey || ""),
      description: system.description ?? materialSummary?.description ?? "",
      typeLabel: system.materialTypeLabel ?? materialSummary?.typeLabel ?? getMaterialTypeLabel(system.materialType ?? materialSummary?.type ?? "material"),
      quality: qualityInfo,
      qualityRoll: system.qualityRoll ?? null,
      durability: system.durability ?? materialSummary?.durability ?? 0,
      potency: system.potency ?? materialSummary?.potency ?? 0,
      cost: formatNumber(system.cost ?? materialSummary?.cost ?? 0),
      unit: system.unit ?? materialSummary?.unit ?? "kg",
      costRaw: system.cost ?? materialSummary?.cost ?? 0
    };

    context.accessibilityInfo = accessibility;
    context.toolInfo = toolInfo;
    context.laborCost = laborCost != null ? formatNumber(laborCost) : null;

    context.richnessInfo = {
      key: richness.key,
      label: richness.label,
      dice: richness.dice,
      description: richness.description,
      durationMinutes: veinDuration,
      durationHours: Math.round(veinDuration / 60),
      remainingDisplay: `${remainingHours}h ${remainingMinutes}min`
    };

    context.extraction = {
      difficulty: system.difficulty ?? accessibility.extractionDifficulty,
      veinDuration,
      intervalDuration,
      intervals,
      remainingTime,
      remainingHours,
      remainingMinutes,
      note: system.extractionNote ?? MINERAL_EXTRACTION.note
    };

    context.qualityOptions = Object.values(MATERIAL_QUALITY_LEVELS).map(info => ({
      value: info.grade,
      label: `${info.label} (Grado ${info.grade})`
    }));

    context.richnessOptions = Object.values(VEIN_RICHNESS_LEVELS).map(info => ({
      value: info.key,
      label: `${info.label} (${info.dice} kg)`
    }));

    context.canReopenWizard = true;

    return context;
  }

  _onRender(context, options) {
    super._onRender(context, options);

    // Añadir listeners para campos editables
    const root = this.element;
    if (!root) return;

    root.querySelectorAll("input, select, textarea").forEach(input => {
      input.addEventListener("change", (ev) => this._onFieldChange(ev));
    });

    const wizardBtn = root.querySelector('[data-action="reopen-wizard"]');
    if (wizardBtn) {
      wizardBtn.addEventListener("click", async (event) => {
        event.preventDefault();
        await openMineralVeinWizard(this.actor);
      });
    }
  }

  async _onFieldChange(event) {
    const input = event.target;
    const field = input.name;
    if (!field) return;

    if (input.dataset?.locked === "true" || input.readOnly) return;

    let value = input.value;
    if (input.type === "number") value = Number(value);
    if (input.type === "checkbox") value = input.checked;

    const update = { [field]: value };
    let rerender = false;

    if (field === "system.quality") {
      const grade = normalizeMaterialQuality(value);
      const qualityInfo = getMaterialQualityInfo(grade);
      const summary = this.actor.system?.mineralKey ? getMaterialSummary(this.actor.system.mineralKey, grade) : null;
      update["system.quality"] = grade;
      update["system.qualityKey"] = qualityInfo.key;
      update["system.qualityLabel"] = qualityInfo.label;
      if (summary) {
        update["system.durability"] = summary.durability;
        update["system.potency"] = summary.potency;
        update["system.cost"] = summary.cost;
        update["system.unit"] = summary.unit;
        update["system.description"] = summary.description;
      }
      rerender = true;
    }

    if (field === "system.veinRichness") {
      const richness = getVeinRichnessInfo(value);
      update["system.veinRichness"] = richness.key;
      update["system.veinRichnessLabel"] = richness.label;
      update["system.richnessDice"] = richness.dice;
      update["system.veinDuration"] = richness.durationMinutes;
      update["system.remainingTime"] = richness.durationMinutes;
      rerender = true;
    }

    if (field === "system.accessibility") {
      const accessibility = ACCESSIBILITY_LEVELS[value] ?? ACCESSIBILITY_LEVELS.general;
      update["system.accessibilityLabel"] = accessibility.label;
      update["system.difficulty"] = accessibility.extractionDifficulty;
      update["system.toolRequirement"] = accessibility.kitGrade;
      update["system.toolRequirementLabel"] = (TOOL_GRADES[accessibility.kitGrade] ?? TOOL_GRADES.basico).label;
      rerender = true;
    }

    if (field === "system.veinDuration" || field === "system.remainingTime") {
      rerender = true;
    }

    await this.actor.update(update);
    if (rerender) await this.render();
  }
}
