// modules/apps/extraction-dialog.js
// Sistema de extracción de materiales

import {
  getCreatureExtractionInfo,
  getMineralExtractionInfo,
  getPlantExtractionInfo,
  CONSERVATION_TIME,
  TOOL_GRADES
} from "../features/materials/extraction.js";
import { getMaterialAccessibility } from "../features/materials/accessibility.js";
import { getPlant } from "../features/materials/plants.js";
import { getMaterial } from "../features/materials/index.js";
import { getDifficultyDC } from "../utils/difficulties.js";
import { isCreatureDead } from "../health/death.js";
import { addProgress } from "../progression.js";
import { resolveEvolution } from "../features/advantage/index.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

const TOOL_GRADE_ORDER = ["basico", "avanzado", "especializado"];

function normalizeToolGrade(value) {
  if (value == null) return null;
  if (typeof value === "string") {
    const key = value.toLowerCase();
    if (TOOL_GRADES[key]) return key;
  }
  const num = Number(value);
  if (Number.isFinite(num)) {
    if (num >= 3) return "especializado";
    if (num >= 2) return "avanzado";
    if (num >= 1) return "basico";
  }
  return null;
}

function toolGradeRank(grade) {
  const key = normalizeToolGrade(grade);
  if (!key) return 0;
  const idx = TOOL_GRADE_ORDER.indexOf(key);
  return idx >= 0 ? idx + 1 : 0;
}

function toolGradeLabel(grade) {
  const key = normalizeToolGrade(grade);
  return key ? (TOOL_GRADES[key]?.label ?? key) : "Sin herramienta";
}

/**
 * Extrae el grado de un nombre de kit de conservación
 * @param {string} kitName - "Kit de Conservación Básico", "Kit de Conservación Avanzado", etc.
 * @returns {string|null} - "basico", "avanzado", "especializado", "botanico", etc.
 */
function getConservationKitGrade(kitName) {
  if (!kitName || typeof kitName !== "string") return null;
  const lower = kitName.toLowerCase();
  if (lower.includes("especializado")) return "especializado";
  if (lower.includes("avanzado")) return "avanzado";
  if (lower.includes("b[áa]sico")) return "basico";
  if (lower.match(/b[áa]sico/)) return "basico";
  if (lower.includes("botanico") || lower.includes("botánico")) return "botanico";
  return null;
}

/**
 * Verifica si un kit disponible puede satisfacer un kit requerido
 * Especializado cubre todo, Avanzado cubre Básico, Básico solo cubre Básico
 * @param {string} availableKitName - nombre del kit disponible
 * @param {string} requiredKitName - nombre del kit requerido
 * @returns {boolean}
 */
function canKitSatisfyRequirement(availableKitName, requiredKitName) {
  // Si es el mismo kit, obviamente funciona
  if (availableKitName === requiredKitName) return true;

  const availableGrade = getConservationKitGrade(availableKitName);
  const requiredGrade = getConservationKitGrade(requiredKitName);

  // Kits especiales (botánico) solo funcionan para su tipo específico
  if (requiredGrade === "botanico") {
    return availableGrade === "botanico";
  }
  if (availableGrade === "botanico") {
    return requiredGrade === "botanico";
  }

  // Jerarquía: especializado > avanzado > basico
  const gradeRank = {
    "basico": 1,
    "avanzado": 2,
    "especializado": 3
  };

  const availableRank = gradeRank[availableGrade] || 0;
  const requiredRank = gradeRank[requiredGrade] || 0;

  return availableRank >= requiredRank;
}

/* -------------------------------------------- */
/*  Extraction Dialog Application V2            */
/* -------------------------------------------- */

/* -------------------------------------------- */
/*  HUD Integration for Creatures               */
/* -------------------------------------------- */

function insertExtractionButton() {
  const root = document.querySelector('#token-hud.placeable-hud');
  if (!root) return false;

  // Obtener el token del HUD
  const token = ui.tokens?.control?.object ?? canvas.tokens?.controlled?.[0];
  if (!token?.actor) return false;

  const actor = token.actor;

  // Solo mostrar en criaturas muertas
  if (actor.type !== "creature") return true;

  // Verificar muerte usando el sistema de death
  const isDead = actor.getFlag("tsdc", "isDead") || isCreatureDead(actor);

  if (!isDead) return true;

  // Buscar contenedor
  const container = root.querySelector('.col.right') ||
                   root.querySelector('[data-group="right"]') ||
                   root.querySelector('.control-icon')?.parentElement;

  if (!container) return false;

  // No duplicar
  if (container.querySelector('.control-icon.tsdc-extract')) return true;

  // Crear botón
  const btn = document.createElement('button');
  btn.className = 'control-icon tsdc-extract';
  btn.dataset.action = 'tsdc-extract';
  btn.title = 'Extraer Materiales';
  btn.setAttribute('data-tooltip', 'Extraer Materiales');
  btn.innerHTML = '<i class="fa-solid fa-hand-sparkles"></i>';
  btn.addEventListener('click', (e) => {
    e.preventDefault();
    e.stopPropagation();
    ExtractionDialog.openFromCreature(token);
  });

  container.appendChild(btn);
  console.log('TSDC | HUD: botón Extracción insertado en criatura');
  return true;
}

function scheduleExtractionHudInsert() {
  const delays = [0, 16, 50, 120, 250, 500, 1000];
  let done = false;
  delays.forEach(d => setTimeout(() => { if (!done) done = insertExtractionButton(); }, d));
}

export function registerExtractionHUD() {
  Hooks.on('renderTokenHUD', scheduleExtractionHudInsert);
  Hooks.on('renderTokenHUDV2', scheduleExtractionHudInsert);
  Hooks.on('refreshTokenHUD', scheduleExtractionHudInsert);
  Hooks.on('controlToken', scheduleExtractionHudInsert);
  console.log('TSDC | Extraction HUD hooks registered');
}

/* -------------------------------------------- */
/*  Extraction Dialog Application V2            */
/* -------------------------------------------- */

export class ExtractionDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tsdc-extraction-dialog",
    classes: ["tsdc", "extraction-dialog"],
    window: {
      icon: "fa-solid fa-hand-sparkles",
      title: "Extracción de Materiales",
      resizable: true
    },
    position: {
      width: 600,
      height: 700
    },
    actions: {
      close: ExtractionDialog.onClose,
      "roll-medicine": ExtractionDialog.onRollMedicine,
      "begin-extraction": ExtractionDialog.onBeginExtraction,
      "select-extraction-type": ExtractionDialog.onSelectType,
      "select-creature": ExtractionDialog.onSelectCreature,
      "select-material": ExtractionDialog.onSelectMaterial,
      "select-tool": ExtractionDialog.onSelectTool,
      "perform-extraction": ExtractionDialog.onPerformExtraction,
      "back": ExtractionDialog.onBack
    }
  };

  static PARTS = {
    body: {
      template: "systems/tsdc/templates/apps/extraction-dialog.hbs"
    }
  };

  constructor(actor, targetCreature = null, options = {}) {
    super(options);
    this.actor = actor; // El personaje que extrae
    this.targetCreature = targetCreature; // La criatura de donde extraer
    this.medicinePassed = false; // Si pasó la tirada de medicina
    this.medicineRollResult = null; // Resultado de la tirada

    // Si hay criatura objetivo, empezar con tirada de medicina
    // Si no, empezar con selección de tipo
    this.step = targetCreature ? "medicine" : 1;

    this.extractionData = {
      type: targetCreature ? "creature" : null,
      target: targetCreature?.id || null,
      targetPart: null,
      tool: null,
      toolGrade: null,
      toolName: null,
      requiredGrade: null,
      partInfo: null,
      quality: 1
    };
  }

  get title() {
    return `Extracción de Materiales - ${this.actor?.name ?? ""}`;
  }

  /* -------------------------------------------- */
  /*  Data Preparation                            */
  /* -------------------------------------------- */

  async _prepareContext(options) {
    const actor = this.actor;
    if (!actor) return { error: "Actor no encontrado" };

    return {
      actor,
      actorName: actor.name,
      step: this.step,
      extractionData: this.extractionData,
      isGM: game.user.isGM,

      // Medicine check (for creatures)
      isMedicineStep: this.step === "medicine",
      medicineCheckData: this.step === "medicine" && this.targetCreature
        ? this._getMedicineCheckData()
        : null,
      medicinePassed: this.medicinePassed,
      medicineRollResult: this.medicineRollResult,

      // Step 1: Type selection
      extractionTypes: [
        { key: "creature", label: "Criatura", icon: "fa-paw", description: "Extraer partes de una criatura muerta" },
        { key: "plant", label: "Planta", icon: "fa-leaf", description: "Recolectar plantas medicinales" },
        { key: "mineral", label: "Mineral", icon: "fa-gem", description: "Extraer minerales de una veta" }
      ],

      // Step 2: Targets
      availableCreatures: this.step === 2 && this.extractionData.type === "creature" && !this.targetCreature
        ? this._getAvailableCreatures()
        : (this.targetCreature ? [this._getCreatureData(this.targetCreature)] : []),
      availablePlants: this.step === 2 && this.extractionData.type === "plant"
        ? this._getAvailablePlants()
        : [],
      availableMinerals: this.step === 2 && this.extractionData.type === "mineral"
        ? this._getAvailableMinerals()
        : [],

      // Step 3: Tools
      availableTools: this.step === 3 ? this._getAvailableTools() : [],
      toolRequirement: this.step === 3 ? this._getToolRequirement() : null,
      canSkipTool: this.step === 3 ? this._canSkipTool() : false,
      selectedPart: this.extractionData.partInfo,

      // Step 4: Summary
      extractionInfo: this.step === 4 ? this._getExtractionInfo() : null,
      selectedToolName: this.step === 4 ? this.extractionData.toolName : null,

      // Extraction Summary (después de medicina)
      isExtractionSummary: this.step === "extraction-summary",
      extractionSummary: this.step === "extraction-summary" && this.targetCreature
        ? this._getExtractionSummary()
        : null
    };
  }

  /* -------------------------------------------- */
  /*  Data Helpers                                */
  /* -------------------------------------------- */

  _getExtractionSummary() {
    if (!this.targetCreature) return null;

    const creature = this.targetCreature;
    const parts = this._getCreatureParts(creature);
    const size = creature.system?.size || "mediano";
    const category = creature.system?.category || "common";
    const quality = category === "common" ? 1 : category === "uncommon" ? 2 : 3;

    // Obtener kit de extracción disponible
    const bag = this.actor.system?.inventory?.bag || [];
    const availableKits = bag.filter(item =>
      item.type === "tool" &&
      item.key?.includes("extraccion") &&
      item.uses > 0
    );

    let selectedKit = null;
    let maxKitRank = 0;
    for (const kit of availableKits) {
      const gradeKey = normalizeToolGrade(kit.grade ?? kit.gradeKey ?? kit.system?.grade ?? null);
      const rank = toolGradeRank(gradeKey);
      if (rank > maxKitRank) {
        maxKitRank = rank;
        selectedKit = kit;
      }
    }

    const toolGrade = selectedKit ? (normalizeToolGrade(selectedKit.grade ?? selectedKit.gradeKey) || "basico") : "basico";

    // Calcular información de extracción para cada parte
    const partDetails = [];
    const conservationKitsNeeded = new Set();

    // Importar función necesaria (ya está importada al inicio del archivo)
    for (const part of parts) {
      const info = getCreatureExtractionInfo(part.key, toolGrade, size);

      partDetails.push({
        key: part.key,
        label: part.label,
        sensitive: part.sensitive,
        quantity: info.quantity,
        unit: info.unit,
        difficulty: info.difficulty,
        conservationInfo: info.conservationInfo
      });

      // Agregar kit de conservación necesario
      if (info.conservationInfo?.requiresKit) {
        conservationKitsNeeded.add(info.conservationInfo.requiresKit);
      }
    }

    // Tiempo total es UNO SOLO basado en el tamaño de la criatura
    // No se suma por parte, todas las partes se extraen en el mismo tiempo
    const sizeTimeMap = {
      "diminuto": 60,
      "pequeño": 60,
      "pequeña": 60,
      "mediano": 120,
      "mediana": 120,
      "grande": 240,
      "enorme": 360,
      "gigantesco": 480,
      "gigantesca": 480,
      "colosal": 480
    };
    const totalTimeMinutes = sizeTimeMap[size.toLowerCase()] || 120;

    // Convertir tiempo total a horas y minutos
    const totalHours = Math.floor(totalTimeMinutes / 60);
    const remainingMinutes = totalTimeMinutes % 60;
    let timeDisplay = "";
    if (totalHours > 0) {
      timeDisplay = `${totalHours}h`;
      if (remainingMinutes > 0) {
        timeDisplay += ` ${remainingMinutes}min`;
      }
    } else {
      timeDisplay = `${remainingMinutes}min`;
    }

    // Verificar si el jugador tiene los kits de conservación necesarios
    // Aplicar jerarquía: Kit Especializado puede satisfacer cualquier requisito, Avanzado cubre Básico, etc.
    const conservationKitsAvailable = {};
    const availableConservationKits = bag.filter(item =>
      item.type === "tool" &&
      item.key?.includes("conservacion") &&
      item.uses > 0
    );

    for (const requiredKitName of conservationKitsNeeded) {
      // Buscar si algún kit disponible puede satisfacer este requisito
      const hasKit = availableConservationKits.some(kit =>
        canKitSatisfyRequirement(kit.name || kit.key, requiredKitName)
      );
      conservationKitsAvailable[requiredKitName] = hasKit;
    }

    return {
      creatureName: creature.name, // Solo para uso interno, no se muestra al jugador
      size,
      quality,
      parts: partDetails,
      totalParts: partDetails.length,
      totalTimeMinutes,
      timeDisplay,
      selectedKit: selectedKit ? {
        id: selectedKit.id,
        name: selectedKit.name,
        grade: toolGrade
      } : null,
      conservationKitsNeeded: Array.from(conservationKitsNeeded),
      conservationKitsAvailable,
      hasAllConservationKits: Array.from(conservationKitsNeeded).every(k => conservationKitsAvailable[k])
    };
  }

  _getMedicineCheckData() {
    if (!this.targetCreature) return null;

    const creature = this.targetCreature;
    const level = creature.system?.level || 1;
    const category = creature.system?.category || "common";

    // Verificar que el actor tenga la aptitud "extraccion_criaturas"
    const hasAptitude = this.actor.system?.progression?.aptitudes?.extraccion_criaturas?.known || false;

    // Verificar que tenga Rango 1+ de Medicina
    const medicineRank = this.actor.system?.progression?.skills?.medicina?.rank || 0;

    if (!hasAptitude || medicineRank < 1) {
      return {
        error: true,
        message: medicineRank < 1
          ? "Necesitas Rango 1 de Medicina para extraer materiales de criaturas."
          : "Necesitas la aptitud 'Extracción de Criaturas' (se obtiene con Rango 1 de Medicina)."
      };
    }

    // Determinar dificultad base según categoría
    let baseDifficulty = "fundamentos"; // común = 8
    if (category === "champion" || category === "campeon") {
      baseDifficulty = "riguroso"; // campeón = 12
    } else if (category === "elite") {
      baseDifficulty = "extremo"; // elite = 17
    }

    const baseDC = getDifficultyDC(baseDifficulty);
    const finalDC = baseDC + level;

    // Obtener modificador de medicina del actor
    const medicineSkill = this.actor.system?.progression?.skills?.medicina || {};
    const medicineLevel = Number(medicineSkill.level || 0);
    const attributeMod = this._getAttributeModifier("wisdom"); // Medicina usa Wisdom (Sabiduría)

    // Calcular modificador total: atributo + nivel + rango
    const totalModifier = attributeMod + medicineLevel + medicineRank;

    const categoryLabels = {
      common: "Común",
      campeon: "Campeón",
      champion: "Campeón",
      elite: "Élite"
    };

    const sizeLabels = {
      diminuto: "Diminuto",
      pequeño: "Pequeño",
      mediano: "Mediano",
      grande: "Grande",
      enorme: "Enorme",
      colosal: "Colosal"
    };

    const natureLabels = {
      mortal: "Mortal",
      bestia: "Bestia",
      aberracion: "Aberración",
      elemental: "Elemental",
      no_muerto: "No-muerto",
      demonio: "Demonio",
      celestial: "Celestial",
      dragon: "Dragón",
      fae: "Fae",
      construct: "Constructo"
    };

    // Obtener información adicional de la criatura
    const size = creature.system?.size || "mediano";
    const nature = creature.system?.nature || "mortal";
    const anatomy = creature.system?.anatomy || {};

    // Crear descripción de anatomía
    const anatomyParts = Object.entries(anatomy).map(([slot, part]) => part.label || slot).join(", ");
    const anatomyDescription = anatomyParts || "Anatomía estándar";

    return {
      creatureName: creature.name,
      category: category,
      categoryLabel: categoryLabels[category] || category,
      size: size,
      sizeLabel: sizeLabels[size] || size,
      nature: nature,
      natureLabel: natureLabels[nature] || nature,
      level: level,
      baseDifficulty: baseDifficulty,
      baseDC: baseDC,
      finalDC: finalDC,
      medicineLevel: medicineLevel,
      medicineRank: medicineRank,
      attributeMod: attributeMod,
      totalModifier: totalModifier,
      formula: `1d10 + ${totalModifier}`,
      hasAptitude: hasAptitude,
      anatomy: anatomyDescription,
      weaknesses: null // TODO: implementar sistema de debilidades
    };
  }

  _getAttributeModifier(attrKey) {
    const attrValue = this.actor.system?.attributes?.[attrKey] || 0;
    return Number(attrValue);
  }

  _getAvailableCreatures() {
    // Buscar tokens de criaturas muertas en la escena
    const deadCreatures = [];

    if (canvas.tokens) {
      for (const token of canvas.tokens.placeables) {
        const actor = token.actor;
        if (!actor || actor.type !== "creature") continue;

        // Verificar si está muerto usando el sistema de death
        const isDead = actor.getFlag("tsdc", "isDead") || isCreatureDead(actor);

        if (isDead) {
          deadCreatures.push(this._getCreatureData(actor));
        }
      }
    }

    return deadCreatures;
  }

  _getCreatureData(creature) {
    return {
      id: creature.id,
      name: creature.name,
      img: creature.img,
      parts: this._getCreatureParts(creature)
    };
  }

  _getCreatureParts(creature) {
    // Obtener partes del JSON del monstruo
    const monsterKey = creature.getFlag("tsdc", "monsterKey");
    const parts = [];

    // Obtener calidad base según categoría del monstruo
    const category = creature.system?.category || "common";
    const baseQuality = category === "common" ? 1 : category === "uncommon" ? 2 : 3;

    // Obtener tamaño para calcular cantidad
    const size = creature.system?.size || "mediano";
    const sizeMultiplier = this._getSizeMultiplier(size);

    // Obtener kit de extracción disponible del jugador
    const bag = this.actor.system?.inventory?.bag || [];
    const availableKits = bag.filter(item =>
      item.type === "tool" &&
      item.key?.includes("extraccion") &&
      item.uses > 0
    );

    // Determinar el grado máximo de kit disponible
    let maxKitRank = 0; // Sin kit
    let maxKitGrade = null;
    for (const kit of availableKits) {
      const gradeKey = normalizeToolGrade(kit.grade ?? kit.gradeKey ?? kit.system?.grade ?? null);
      const rank = toolGradeRank(gradeKey);
      if (rank > maxKitRank) {
        maxKitRank = rank;
        maxKitGrade = gradeKey;
      }
    }

    // Leer anatomy del monstruo
    const anatomy = creature.system?.anatomy || {};
    const extractedMaterials = new Set();

    for (const [slot, part] of Object.entries(anatomy)) {
      const materialKey = part.materialKey;
      if (!materialKey || extractedMaterials.has(materialKey)) continue;

      extractedMaterials.add(materialKey);

      const material = getMaterial(materialKey);
      if (!material) continue;

      // Determinar si es sensible
      const sensitive = ["glandulas", "organos", "fluidos", "sistema_nervioso"].includes(materialKey);

      const accessibility = getMaterialAccessibility(materialKey);
      const requiredGrade = accessibility?.kitGrade ?? "basico";
      const requiredRank = toolGradeRank(requiredGrade);

      // Solo incluir si el jugador tiene el kit adecuado
      if (maxKitRank >= requiredRank) {
        parts.push({
          key: materialKey,
          label: material.label,
          sensitive: sensitive,
          quality: baseQuality,
          quantity: this._calculateMaterialQuantity(materialKey, sizeMultiplier),
          requiredGrade,
          requiredGradeLabel: toolGradeLabel(requiredGrade)
        });
      }
    }

    // Agregar loot adicional si existe
    const loot = creature.system?.loot?.drops || [];
    for (const drop of loot) {
      if (extractedMaterials.has(drop.materialKey)) continue;

      const material = getMaterial(drop.materialKey);
      if (!material) continue;

      extractedMaterials.add(drop.materialKey);

      const sensitive = ["glandulas", "organos", "fluidos", "sistema_nervioso"].includes(drop.materialKey);

      const accessibility = getMaterialAccessibility(drop.materialKey);
      const requiredGrade = accessibility?.kitGrade ?? "basico";
      const requiredRank = toolGradeRank(requiredGrade);

      // Solo incluir si el jugador tiene el kit adecuado
      if (maxKitRank >= requiredRank) {
        parts.push({
          key: drop.materialKey,
          label: material.label,
          sensitive: sensitive,
          quality: drop.q || baseQuality,
          quantity: this._calculateMaterialQuantity(drop.materialKey, sizeMultiplier),
          requiredGrade,
          requiredGradeLabel: toolGradeLabel(requiredGrade)
        });
      }
    }

    // Si no hay partes, usar genéricas
    if (parts.length === 0) {
      return [
        {
          key: "huesos",
          label: "Huesos",
          sensitive: false,
          quality: 1,
          quantity: 2,
          requiredGrade: "avanzado",
          requiredGradeLabel: toolGradeLabel("avanzado")
        },
        {
          key: "pelaje",
          label: "Pelaje",
          sensitive: false,
          quality: 1,
          quantity: 3,
          requiredGrade: "basico",
          requiredGradeLabel: toolGradeLabel("basico")
        }
      ];
    }

    return parts;
  }

  _getSizeMultiplier(size) {
    const multipliers = {
      "diminuto": 0.1,
      "pequeño": 0.5,
      "mediano": 1,
      "grande": 2,
      "enorme": 4,
      "colosal": 8
    };
    return multipliers[size] || 1;
  }

  _calculateMaterialQuantity(materialKey, sizeMultiplier) {
    // Cantidad base según tipo de material
    const baseQuantities = {
      "pelaje": 5,
      "escamas": 5,
      "caparazon": 3,
      "plumaje": 4,
      "huesos": 3,
      "cuernos": 2,
      "garras": 2,
      "colmillos": 2,
      "glandulas": 1,
      "organos": 1,
      "fluidos": 2,
      "sistema_nervioso": 1
    };

    const base = baseQuantities[materialKey] || 2;
    return Math.ceil(base * sizeMultiplier);
  }

  _getAvailablePlants() {
    // Buscar tokens de plantas en la escena
    const plants = [];

    if (canvas.tokens) {
      for (const token of canvas.tokens.placeables) {
        const actor = token.actor;
        if (!actor || actor.type !== "plant") continue;

        // Verificar si no está agotada
        const depleted = actor.system?.depleted || false;
        if (depleted) continue;

        const plantKey = actor.system?.plantKey || actor.getFlag("tsdc", "plantKey");
        const { getPlant } = require("../features/materials/plants.js");
        const plantData = plantKey ? getPlant(plantKey) : null;

        plants.push({
          id: actor.id,
          tokenId: token.id,
          name: actor.name,
          key: plantKey || "unknown",
          label: plantData?.label || actor.name,
          accessibility: actor.system?.accessibility || plantData?.accessibility || "general",
          alchemicalIndex: actor.system?.alchemicalIndex || plantData?.alchemicalIndex || 0,
          use: actor.system?.use || plantData?.use || "",
          extractionTime: actor.system?.extractionTime || plantData?.extractionTime || 30,
          difficulty: actor.system?.difficulty || "fundamentos",
          remainingExtractions: actor.system?.remainingExtractions ?? 1,
          maxExtractions: actor.system?.maxExtractions ?? 1,
          img: actor.img || token.document.texture.src
        });
      }
    }

    return plants;
  }

  _getAvailableMinerals() {
    // Buscar tokens de vetas minerales en la escena
    const veins = [];

    if (canvas.tokens) {
      for (const token of canvas.tokens.placeables) {
        const actor = token.actor;
        if (!actor || actor.type !== "mineral-vein") continue;

        // Verificar si no está agotada
        const depleted = actor.system?.depleted || false;
        if (depleted) continue;

        const mineralKey = actor.system?.mineralKey || actor.getFlag("tsdc", "mineralKey");
        const { getMaterial } = require("../features/materials/index.js");
        const mineralData = mineralKey ? getMaterial(mineralKey) : null;

        // Determinar duración de intervalos según accesibilidad
        const accessibility = actor.system?.accessibility || "general";
        const intervalMap = {
          general: 120,    // 2 horas
          limitado: 240,   // 4 horas
          singular: 360    // 6 horas
        };
        const intervalDuration = actor.system?.intervalDuration || intervalMap[accessibility] || 120;

        const veinDuration = actor.system?.veinDuration || intervalDuration * 4;
        const remainingTime = actor.system?.remainingTime ?? veinDuration;

        veins.push({
          id: actor.id,
          tokenId: token.id,
          name: actor.name,
          key: mineralKey || "unknown",
          label: mineralData?.label || actor.name,
          mineralType: actor.system?.mineralType || "metal",
          accessibility,
          quality: actor.system?.quality || 1,
          difficulty: actor.system?.difficulty || "fundamentos",
          veinDuration,
          intervalDuration,
          remainingTime,
          intervalsRemaining: Math.ceil(remainingTime / intervalDuration),
          img: actor.img || token.document.texture.src
        });
      }
    }

    return veins;
  }

  _getAvailableTools() {
    if (!this.actor) return [];

    const type = this.extractionData.type;
    let requiredArt = "";

    if (type === "creature") requiredArt = "herbolario";
    if (type === "plant") requiredArt = "herboristeria";
    if (type === "mineral") requiredArt = "mineria";

    const requirement = this._getToolRequirement();
    const minRank = requirement?.rank ?? 0;

    // Obtener herramientas del actor (del inventory.bag)
    const bag = this.actor.system?.inventory?.bag || [];
    return bag
      .filter(item =>
        item.type === "tool" &&
        (item.craft === requiredArt || item.key?.includes("extraccion"))
      )
      .map(item => {
        const gradeKey = normalizeToolGrade(item.grade ?? item.gradeKey ?? item.system?.grade ?? null);
        const rank = toolGradeRank(gradeKey);
        return {
          id: item.id,
          name: item.name,
          gradeKey,
          grade: gradeKey,
          gradeLabel: toolGradeLabel(gradeKey),
          rank,
          uses: item.uses || 0,
          maxUses: item.maxUses || 0,
          bonus: item.extractionBonus || 0
        };
      })
      .filter(tool => (minRank === 0 || tool.rank >= minRank));
  }

  _getToolRequirement() {
    const { type, targetPart, target, requiredGrade } = this.extractionData;
    let gradeKey = normalizeToolGrade(requiredGrade);

    if (!gradeKey) {
      if (type === "creature" && targetPart) {
        gradeKey = getMaterialAccessibility(targetPart)?.kitGrade;
      } else if (type === "mineral" && target) {
        gradeKey = getMaterialAccessibility(target)?.kitGrade;
      } else if (type === "plant" && target) {
        const plant = getPlant(target);
        if (plant?.accessibility) {
          const accessGradeMap = { general: "basico", limitado: "avanzado", singular: "especializado" };
          gradeKey = accessGradeMap[plant.accessibility] || "basico";
        }
      }
    }

    const normalized = normalizeToolGrade(gradeKey) || "basico";
    this.extractionData.requiredGrade = normalized;
    return {
      requiredGrade: normalized,
      requiredLabel: toolGradeLabel(normalized),
      rank: toolGradeRank(normalized)
    };
  }

  _canSkipTool() {
    const requirement = this._getToolRequirement();
    // Por ahora, todas las extracciones requieren al menos un kit
    if (!requirement) return false;
    return false;
  }

  _getExtractionInfo() {
    const { type, target, targetPart, toolGrade, quality, partInfo } = this.extractionData;
    const normalizedToolGrade = normalizeToolGrade(toolGrade);
    const toolRank = toolGradeRank(normalizedToolGrade);

    if (type === "creature" && targetPart) {
      // Obtener tamaño de la criatura
      const creatureSize = this.targetCreature?.system?.size || "mediano";
      const info = getCreatureExtractionInfo(targetPart, normalizedToolGrade, creatureSize);
      if (partInfo) {
        info.label = partInfo.label ?? info.label;
        info.quantity = partInfo.quantity ?? info.quantity ?? 1;
        info.quality = partInfo.quality ?? info.quality ?? quality;
        info.requiredGrade = normalizeToolGrade(partInfo.requiredGrade) || info.requiredGrade;
        info.requiredLabel = partInfo.requiredGradeLabel || toolGradeLabel(info.requiredGrade);
      } else {
        info.quality = info.quality ?? quality;
      }
      info.toolGrade = normalizedToolGrade;
      info.toolGradeLabel = toolGradeLabel(normalizedToolGrade);
      info.hasRequiredTool = toolRank >= toolGradeRank(info.requiredGrade);
      return info;
    }

    if (type === "plant" && target) {
      const info = getPlantExtractionInfo(target, normalizedToolGrade);
      info.toolGrade = normalizedToolGrade;
      info.toolGradeLabel = toolGradeLabel(normalizedToolGrade);
      info.requiredGrade = normalizeToolGrade(info.requiredGrade) || "basico";
      info.requiredLabel = toolGradeLabel(info.requiredGrade);
      info.hasRequiredTool = toolRank >= toolGradeRank(info.requiredGrade);
      return info;
    }

    if (type === "mineral" && target) {
      const info = getMineralExtractionInfo(target, normalizedToolGrade);
      info.toolGrade = normalizedToolGrade;
      info.toolGradeLabel = toolGradeLabel(normalizedToolGrade);
      info.requiredGrade = normalizeToolGrade(info.requiredGrade) || "basico";
      info.requiredLabel = toolGradeLabel(info.requiredGrade);
      info.hasRequiredTool = toolRank >= toolGradeRank(info.requiredGrade);
      return info;
    }

    return null;
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  static onClose() {
    this.close();
  }

  static async onBeginExtraction(event, btn) {
    const type = this.extractionData.type;

    // Para criaturas
    if (type === "creature") {
      const summary = this._getExtractionSummary();
      if (!summary || !summary.parts || summary.parts.length === 0) {
        ui.notifications?.error("No hay partes para extraer.");
        return;
      }

      if (!summary.selectedKit) {
        ui.notifications?.error("No tienes un kit de extracción disponible.");
        return;
      }

      ui.notifications?.info("Iniciando proceso de extracción...");
      this.close();
      await ExtractionDialog._performMultiPartExtraction.call(this, summary);
      return;
    }

    // Para plantas
    if (type === "plant") {
      const plantId = this.extractionData.target;
      if (!plantId) {
        ui.notifications?.error("No has seleccionado una planta.");
        return;
      }

      const plant = game.actors.get(plantId);
      if (!plant) {
        ui.notifications?.error("Planta no encontrada.");
        return;
      }

      ui.notifications?.info("Iniciando recolección de planta...");
      this.close();
      await ExtractionDialog._performPlantExtraction.call(this, plant);
      return;
    }

    // Para minerales
    if (type === "mineral") {
      const veinId = this.extractionData.target;
      if (!veinId) {
        ui.notifications?.error("No has seleccionado una veta.");
        return;
      }

      const vein = game.actors.get(veinId);
      if (!vein) {
        ui.notifications?.error("Veta no encontrada.");
        return;
      }

      ui.notifications?.info("Iniciando extracción de mineral...");
      this.close();
      await ExtractionDialog._performMineralExtraction.call(this, vein);
      return;
    }

    ui.notifications?.error("Tipo de extracción desconocido.");
  }

  static async _performPlantExtraction(plant) {
    const actor = this.actor;
    const plantKey = plant.system?.plantKey || plant.getFlag("tsdc", "plantKey");
    const extractionTime = plant.system?.extractionTime || 30;
    const difficulty = plant.system?.difficulty || "fundamentos";
    const accessibility = plant.system?.accessibility || "general";

    // Calcular intervalos según accesibilidad
    // general: 15min x1 = 15min total
    // limitado: 15min x2 = 30min total
    // singular: 15min x3 = 45min total
    const intervalDuration = 15; // minutos
    const intervalMap = {
      general: 1,
      limitado: 2,
      singular: 3
    };
    const numIntervals = intervalMap[accessibility] || 1;

    // Obtener kit de herboristería disponible
    const bag = actor.system?.inventory?.bag || [];
    const herbKit = bag.find(item =>
      item.type === "tool" &&
      item.key?.includes("herboristeria") &&
      item.uses > 0
    );

    if (!herbKit) {
      ui.notifications?.error("No tienes un kit de herboristería disponible.");
      return;
    }

    const toolGrade = normalizeToolGrade(herbKit.grade ?? herbKit.gradeKey) || "basico";
    const toolGradeInfo = TOOL_GRADES[toolGrade] || TOOL_GRADES.basico;

    // Obtener skill de herboristería
    const herbSkill = actor.system?.progression?.skills?.herboristeria || {};
    const herbLevel = Number(herbSkill.level || 0);
    const hasHerbAptitude = actor.system?.progression?.aptitudes?.some(a => a.key === "herboristeria");
    const herbRank = hasHerbAptitude ? herbSkill.rank || 0 : 0;
    const attributeMod = this._getAttributeModifier("wisdom");
    const totalModifier = attributeMod + herbLevel + herbRank + (toolGradeInfo.bonus || 0);

    // DC = dificultad base + nivel de la planta
    const plantLevel = plant.system?.level || 1;
    const baseDC = getDifficultyDC(difficulty);
    const dc = baseDC + plantLevel;

    // Mensaje inicial
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tsdc extraction-start">
          <h3>🌿 Iniciando Recolección de Planta</h3>
          <p><strong>${actor.name}</strong> comienza a recolectar <strong>${plant.name}</strong></p>
          <p>Intervalos: <strong>${numIntervals}</strong> (${intervalDuration}min cada uno)</p>
          <p>Tiempo total: <strong>${extractionTime}min</strong></p>
          <p>Kit: <strong>${herbKit.name}</strong> (${toolGradeInfo.label})</p>
        </div>
      `
    });

    // Procesar cada intervalo con su propia tirada
    let successCount = 0;
    let totalMaterialObtained = 0;

    for (let i = 0; i < numIntervals; i++) {
      const intervalNum = i + 1;

      // Realizar tirada con modo de ejecución (preguntar al jugador)
      const rollFormula = `1d10 + ${totalModifier}`;
      const { resultRoll, usedPolicy } = await resolveEvolution({
        type: "specialization",
        mode: "ask",
        formula: rollFormula,
        rank: herbRank,
        flavor: `Recolección Intervalo ${intervalNum}/${numIntervals}: ${plant.name}`,
        toChat: false,
        actor: actor
      });

      const success = resultRoll.total >= dc;
      if (success) successCount++;

      // Si tuvo éxito, obtener material (1 unidad por intervalo exitoso)
      if (success) {
        totalMaterialObtained += 1;
      }

      // Mensaje de resultado del intervalo
      const policyLabel = usedPolicy === "execution" ? "Ejecución" : usedPolicy === "learning" ? "Aprendizaje" : "Sin ventaja";
      await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `
          <div class="tsdc extraction-result ${success ? 'success' : 'failure'}">
            <h4>Intervalo ${intervalNum}/${numIntervals}: ${plant.name}</h4>
            <div class="roll-details">
              <p>Tirada: ${resultRoll.total} (${policyLabel})</p>
              <p class="result ${success ? 'success' : 'failure'}">
                ${success ?
                  `✅ <strong>Éxito</strong> - Recolectado: 1 unidad` :
                  `❌ <strong>Fallo</strong> - Material perdido o dañado`
                }
              </p>
              <p><i class="fas fa-clock"></i> Tiempo: ${intervalDuration} minutos</p>
            </div>
          </div>
        `
      });

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Si obtuvo al menos 1 material exitoso, agregarlo al inventario
    if (totalMaterialObtained > 0) {
      const { getPlant } = require("../features/materials/plants.js");
      const plantData = getPlant(plantKey);

      const materialItem = {
        id: foundry.utils.randomID(),
        name: plant.name,
        key: plantKey,
        type: "material",
        subtype: "plant",
        quantity: totalMaterialObtained,
        unit: "unidad",
        quality: 1,
        perishable: true,
        expiresAt: null,
        source: `Recolectado de ${plant.name}`,
        img: plant.img || "icons/svg/herb.svg"
      };

      // Manejar conservación - buscar kit usando jerarquía
      const requiredKitName = "Kit de Conservación Botánico";
      const conservationKit = bag.find(item =>
        item.type === "tool" &&
        item.key?.includes("conservacion") &&
        item.uses > 0 &&
        canKitSatisfyRequirement(item.name || item.key, requiredKitName)
      );

      if (conservationKit) {
        conservationKit.uses -= 1;
        await actor.update({ "system.inventory.bag": bag });

        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30); // 1 mes
        materialItem.expiresAt = expiresAt.toISOString();

        if (conservationKit.uses <= 0) {
          ui.notifications?.warn(`${conservationKit.name} se ha agotado.`);
        }
      } else {
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 7); // 1 semana sin kit
        materialItem.expiresAt = expiresAt.toISOString();
      }

      // Agregar al inventario
      bag.push(materialItem);
      await actor.update({ "system.inventory.bag": bag });
    }

    // Consumir uso del kit de herboristería
    const bagFinal = actor.system?.inventory?.bag || [];
    const toolItem = bagFinal.find(item => item.id === herbKit.id);
    if (toolItem && toolItem.uses > 0) {
      toolItem.uses -= 1;
      await actor.update({ "system.inventory.bag": bagFinal });
      if (toolItem.uses <= 0) {
        ui.notifications?.warn(`${toolItem.name} se ha agotado.`);
      }
    }

    // Reducir extracciones restantes de la planta
    const remainingExtractions = (plant.system?.remainingExtractions ?? 1) - 1;
    if (remainingExtractions <= 0) {
      await plant.update({ "system.depleted": true, "system.remainingExtractions": 0 });
      ui.notifications?.info(`${plant.name} se ha agotado.`);
    } else {
      await plant.update({ "system.remainingExtractions": remainingExtractions });
    }

    // Resumen final
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tsdc extraction-complete">
          <h3>✅ Recolección Completada</h3>
          <p><strong>${actor.name}</strong> ha terminado de recolectar</p>
          <div class="summary">
            <p>Intervalos exitosos: <strong>${successCount}/${numIntervals}</strong></p>
            <p>Material obtenido: <strong>${totalMaterialObtained} unidades</strong></p>
            <p>Tiempo total: <strong>${extractionTime}min</strong></p>
          </div>
        </div>
      `
    });

    ui.notifications?.info(`Recolección completada: ${totalMaterialObtained} unidades obtenidas.`);
  }

  static async _performMineralExtraction(vein) {
    const actor = this.actor;
    const mineralKey = vein.system?.mineralKey || vein.getFlag("tsdc", "mineralKey");
    const veinDuration = vein.system?.veinDuration || 240;
    const intervalDuration = vein.system?.intervalDuration || 120;
    const difficulty = vein.system?.difficulty || "fundamentos";
    const accessibility = vein.system?.accessibility || "general";
    const quality = vein.system?.quality || 1;

    // Calcular cuántos intervalos quedan
    const remainingTime = vein.system?.remainingTime ?? veinDuration;
    let numIntervals = Math.ceil(remainingTime / intervalDuration);

    // Obtener kit de minería disponible
    const bag = actor.system?.inventory?.bag || [];
    const miningKit = bag.find(item =>
      item.type === "tool" &&
      item.key?.includes("mineria") &&
      item.uses > 0
    );

    if (!miningKit) {
      ui.notifications?.error("No tienes un kit de minería disponible.");
      return;
    }

    const toolGrade = normalizeToolGrade(miningKit.grade ?? miningKit.gradeKey) || "basico";
    const toolGradeInfo = TOOL_GRADES[toolGrade] || TOOL_GRADES.basico;

    // Obtener skill de minería
    const miningSkill = actor.system?.progression?.skills?.mineria || {};
    const miningLevel = Number(miningSkill.level || 0);
    const hasMiningAptitude = actor.system?.progression?.aptitudes?.some(a => a.key === "mineria");
    const miningRank = hasMiningAptitude ? miningSkill.rank || 0 : 0;
    const attributeMod = this._getAttributeModifier("strength"); // Minería usa Fuerza
    const totalModifier = attributeMod + miningLevel + miningRank + (toolGradeInfo.bonus || 0);

    // DC = dificultad base + nivel de la veta mineral
    const veinLevel = vein.system?.level || 1;
    const baseDC = getDifficultyDC(difficulty);
    const dc = baseDC + veinLevel;

    // Mensaje inicial
    const totalHours = Math.floor(remainingTime / 60);
    const totalMinutes = remainingTime % 60;
    let timeDisplay = totalHours > 0 ? `${totalHours}h` : "";
    if (totalMinutes > 0) timeDisplay += ` ${totalMinutes}min`;

    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tsdc extraction-start">
          <h3>⛏️ Iniciando Extracción de Mineral</h3>
          <p><strong>${actor.name}</strong> comienza a extraer de <strong>${vein.name}</strong></p>
          <p>Intervalos estimados: <strong>${numIntervals}</strong> (${intervalDuration}min cada uno)</p>
          <p>Tiempo restante en veta: <strong>${timeDisplay.trim()}</strong></p>
          <p>Kit: <strong>${miningKit.name}</strong> (${toolGradeInfo.label})</p>
        </div>
      `
    });

    // Procesar intervalos
    let successCount = 0;
    let totalMaterialObtained = 0;
    let intervalsProcessed = 0;
    let timeSpent = 0;

    // Obtener fórmula de rendimiento y duración basada en la riqueza de la veta
    const veinRichness = vein.system?.veinRichness || "moderada";
    const veinDataMap = {
      "pobre": { yield: "1d10", duration: 120, interval: 120 },      // 2 horas total, 2 horas por intervalo
      "moderada": { yield: "2d10", duration: 240, interval: 120 },   // 4 horas total, 2 horas por intervalo
      "rica": { yield: "3d10", duration: 360, interval: 120 },       // 6 horas total, 2 horas por intervalo
      "muy_rica": { yield: "4d10", duration: 480, interval: 120 }    // 8 horas total, 2 horas por intervalo
    };
    const veinData = veinDataMap[veinRichness] || veinDataMap.moderada;
    const yieldFormula = veinData.yield;

    while (intervalsProcessed < numIntervals && remainingTime - timeSpent > 0) {
      intervalsProcessed++;
      const intervalNum = intervalsProcessed;

      // Realizar tirada con modo de ejecución (preguntar al jugador)
      const rollFormula = `1d10 + ${totalModifier}`;
      const { resultRoll, usedPolicy } = await resolveEvolution({
        type: "specialization",
        mode: "ask",
        formula: rollFormula,
        rank: miningRank,
        flavor: `Minería Intervalo ${intervalNum}: ${vein.name}`,
        toChat: false,
        actor: actor
      });

      const success = resultRoll.total >= dc;
      const policyLabel = usedPolicy === "execution" ? "Ejecución" : usedPolicy === "learning" ? "Aprendizaje" : "Sin ventaja";

      // DIFERENCIA CLAVE: En minería, el fallo NO pierde material, solo tiempo
      if (success) {
        successCount++;

        // Tirar dados para cantidad de material extraído
        const yieldRoll = new Roll(yieldFormula);
        await yieldRoll.evaluate();
        const amountExtracted = yieldRoll.total;
        totalMaterialObtained += amountExtracted;

        // Mensaje de éxito
        await ChatMessage.create({
          user: game.user.id,
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `
            <div class="tsdc extraction-result success">
              <h4>Intervalo ${intervalNum}: ${vein.name}</h4>
              <div class="roll-details">
                <p>Tirada: ${resultRoll.total} (${policyLabel})</p>
                  <p class="result success">
                  ✅ <strong>Éxito</strong> - Extraído: ${amountExtracted} kg (${yieldFormula})
                </p>
                <p><i class="fas fa-clock"></i> Tiempo: ${intervalDuration} minutos</p>
              </div>
            </div>
          `
        });

        timeSpent += intervalDuration;
      } else {
        // Fallo: tiempo perdido, pero veta intacta
        await ChatMessage.create({
          user: game.user.id,
          speaker: ChatMessage.getSpeaker({ actor }),
          content: `
            <div class="tsdc extraction-result failure">
              <h4>Intervalo ${intervalNum}: ${vein.name}</h4>
              <div class="roll-details">
                <p>Tirada: ${resultRoll.total} (${policyLabel})</p>
                  <p class="result failure">
                  ❌ <strong>Fallo</strong> - Tiempo perdido, extracción ineficiente
                </p>
                <p><i class="fas fa-clock"></i> Tiempo perdido: ${intervalDuration} minutos</p>
                <p><em>La veta permanece intacta, puedes volver a intentarlo.</em></p>
              </div>
            </div>
          `
        });

        timeSpent += intervalDuration;
        // NO reducimos material, pero el tiempo avanza igual
      }

      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Si obtuvo material, agregarlo al inventario
    if (totalMaterialObtained > 0) {
      const { getMaterial } = require("../features/materials/index.js");
      const mineralData = getMaterial(mineralKey);

      const materialItem = {
        id: foundry.utils.randomID(),
        name: vein.name,
        key: mineralKey,
        type: "material",
        subtype: "mineral",
        quantity: totalMaterialObtained,
        unit: "kg",
        quality: quality,
        perishable: false,
        expiresAt: null,
        source: `Extraído de ${vein.name}`,
        img: vein.img || "icons/svg/ore.svg"
      };

      // Agregar al inventario
      bag.push(materialItem);
      await actor.update({ "system.inventory.bag": bag });
    }

    // Consumir uso del kit de minería
    const bagFinal = actor.system?.inventory?.bag || [];
    const toolItem = bagFinal.find(item => item.id === miningKit.id);
    if (toolItem && toolItem.uses > 0) {
      toolItem.uses -= 1;
      await actor.update({ "system.inventory.bag": bagFinal });
      if (toolItem.uses <= 0) {
        ui.notifications?.warn(`${toolItem.name} se ha agotado.`);
      }
    }

    // Actualizar tiempo restante en la veta
    const newRemainingTime = Math.max(0, remainingTime - timeSpent);
    if (newRemainingTime <= 0) {
      await vein.update({ "system.depleted": true, "system.remainingTime": 0 });
      ui.notifications?.info(`${vein.name} se ha agotado completamente.`);
    } else {
      await vein.update({ "system.remainingTime": newRemainingTime });
    }

    // Resumen final
    const finalHours = Math.floor(timeSpent / 60);
    const finalMinutes = timeSpent % 60;
    let finalTimeDisplay = finalHours > 0 ? `${finalHours}h` : "";
    if (finalMinutes > 0) finalTimeDisplay += ` ${finalMinutes}min`;

    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tsdc extraction-complete">
          <h3>✅ Extracción de Mineral Completada</h3>
          <p><strong>${actor.name}</strong> ha terminado de extraer</p>
          <div class="summary">
            <p>Intervalos exitosos: <strong>${successCount}/${intervalsProcessed}</strong></p>
            <p>Material obtenido: <strong>${totalMaterialObtained} kg</strong></p>
            <p>Tiempo total: <strong>${finalTimeDisplay.trim()}</strong></p>
            ${newRemainingTime > 0 ? `<p>Tiempo restante en veta: <strong>${Math.floor(newRemainingTime / 60)}h ${newRemainingTime % 60}min</strong></p>` : ""}
          </div>
        </div>
      `
    });

    ui.notifications?.info(`Extracción completada: ${totalMaterialObtained} kg obtenidos.`);
  }

  static async _performMultiPartExtraction(summary) {
    const actor = this.actor;
    const creature = this.targetCreature;
    const parts = summary.parts;
    const selectedKit = summary.selectedKit;

    // Resultados de extracción
    const results = [];
    let totalTimeTaken = 0;

    // Mensaje inicial en chat (sin revelar nombre de la criatura)
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tsdc extraction-start">
          <h3>Iniciando Extracción</h3>
          <p><strong>${actor.name}</strong> comienza a extraer materiales de una criatura</p>
          <p>Partes a extraer: <strong>${parts.length}</strong></p>
          <p>Tiempo total de extracción: <strong>${summary.timeDisplay}</strong></p>
          <p>Kit utilizado: <strong>${selectedKit.name}</strong></p>
        </div>
      `
    });

    // Obtener aptitud de medicina
    const medicineSkill = actor.system?.progression?.skills?.medicina || {};
    const medicineLevel = Number(medicineSkill.level || 0);

    // Verificar si tiene aptitud de medicina (aptitudes es un objeto, no array)
    const aptitudes = actor.system?.progression?.aptitudes || {};
    let hasMedicineAptitude = false;
    if (Array.isArray(aptitudes)) {
      hasMedicineAptitude = aptitudes.some(a => a.key === "medicina");
    } else if (typeof aptitudes === "object") {
      hasMedicineAptitude = Object.keys(aptitudes).some(key => key === "medicina" || aptitudes[key]?.key === "medicina");
    }

    const medicineRank = hasMedicineAptitude ? medicineSkill.rank || 0 : 0;
    const attributeMod = this._getAttributeModifier("wisdom");
    const totalModifier = attributeMod + medicineLevel + medicineRank;

    // Procesar cada parte con su propia tirada
    for (let i = 0; i < parts.length; i++) {
      const part = parts[i];
      const partNum = i + 1;

      // Obtener DC según dificultad + nivel de criatura
      const creatureLevel = creature.system?.level || 1;
      const baseDC = getDifficultyDC(part.difficulty);
      const dc = baseDC + creatureLevel;

      // Realizar tirada de extracción con modo de ejecución (preguntar al jugador)
      const rollFormula = `1d10 + ${totalModifier}`;
      const { resultRoll, usedPolicy } = await resolveEvolution({
        type: "specialization",
        mode: "ask",
        formula: rollFormula,
        rank: medicineRank,
        flavor: `Extracción ${partNum}/${parts.length}: ${part.label}`,
        toChat: false,
        actor: actor
      });

      const success = resultRoll.total >= dc;

      // Registrar resultado
      const result = {
        partKey: part.key,
        partLabel: part.label,
        quantity: part.quantity,
        unit: part.unit,
        difficulty: part.difficulty,
        dc: dc,
        roll: resultRoll,
        total: resultRoll.total,
        success: success,
        materialObtained: null
      };

      // Si tuvo éxito, agregar material al inventario
      if (success) {
        const materialItem = {
          id: foundry.utils.randomID(),
          name: part.label,
          key: part.key,
          type: "material",
          subtype: part.sensitive ? "sensitive" : "structural",
          quantity: part.quantity,
          unit: part.unit,
          quality: summary.quality,
          perishable: part.conservationInfo?.requiresKit ? true : false,
          expiresAt: null,
          source: creature.name,
          img: "icons/svg/item-bag.svg"
        };

        // Si es perecedero, calcular expiración
        if (materialItem.perishable && part.conservationInfo) {
          const bag = actor.system?.inventory?.bag || [];
          const requiredConservationKit = part.conservationInfo.requiresKit;

          // Buscar kit usando jerarquía: Especializado puede cubrir cualquier requisito
          const conservationKit = bag.find(item =>
            item.type === "tool" &&
            item.key?.includes("conservacion") &&
            item.uses > 0 &&
            canKitSatisfyRequirement(item.name || item.key, requiredConservationKit)
          );

          if (conservationKit) {
            // Consumir kit y establecer expiración extendida
            conservationKit.uses -= 1;
            await actor.update({ "system.inventory.bag": bag });

            // Parsear tiempo de conservación (ej: "1 semana" -> 7 días)
            const extendedTime = part.conservationInfo.extendedTime || "1 día";
            const daysMatch = extendedTime.match(/(\d+)\s*(día|días|semana|semanas|mes|meses)/i);
            let daysToAdd = 1;
            if (daysMatch) {
              const num = parseInt(daysMatch[1]);
              const unit = daysMatch[2].toLowerCase();
              if (unit.includes("semana")) daysToAdd = num * 7;
              else if (unit.includes("mes")) daysToAdd = num * 30;
              else daysToAdd = num;
            }

            const expiresAt = new Date();
            expiresAt.setDate(expiresAt.getDate() + daysToAdd);
            materialItem.expiresAt = expiresAt.toISOString();

            if (conservationKit.uses <= 0) {
              ui.notifications?.warn(`${conservationKit.name} se ha agotado.`);
            }
          } else {
            // Sin kit, se establece como caducado rápidamente
            const expiresAt = new Date();
            expiresAt.setHours(expiresAt.getHours() + 1); // 1 hora sin kit
            materialItem.expiresAt = expiresAt.toISOString();
          }
        }

        // Agregar al inventario
        const bag = actor.system?.inventory?.bag || [];
        bag.push(materialItem);
        await actor.update({ "system.inventory.bag": bag });

        result.materialObtained = materialItem;
      }

      results.push(result);

      // Mensaje de resultado individual en chat
      const policyLabel = usedPolicy === "execution" ? "Ejecución" : usedPolicy === "learning" ? "Aprendizaje" : "Sin ventaja";
      await ChatMessage.create({
        user: game.user.id,
        speaker: ChatMessage.getSpeaker({ actor }),
        content: `
          <div class="tsdc extraction-result ${success ? 'success' : 'failure'}">
            <h4>Extracción ${partNum}/${parts.length}: ${part.label}</h4>
            <div class="roll-details">
              <p>Tirada: ${resultRoll.total} (${policyLabel})</p>
              <p class="result ${success ? 'success' : 'failure'}">
                ${success ?
                  `✅ <strong>Éxito</strong> - Obtenido: ${part.quantity} ${part.unit}` :
                  `❌ <strong>Fallo</strong> - Material perdido o dañado`
                }
              </p>
            </div>
          </div>
        `
      });

      // Pequeña pausa entre mensajes para que se vean ordenados
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    // Consumir uso del kit de extracción
    const bag = actor.system?.inventory?.bag || [];
    const toolItem = bag.find(item => item.id === selectedKit.id);
    if (toolItem && toolItem.uses > 0) {
      toolItem.uses -= 1;
      await actor.update({ "system.inventory.bag": bag });
      if (toolItem.uses <= 0) {
        ui.notifications?.warn(`${toolItem.name} se ha agotado.`);
      }
    }

    // Resumen final
    const successCount = results.filter(r => r.success).length;
    const failCount = results.length - successCount;

    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tsdc extraction-complete">
          <h3>✅ Extracción Completada</h3>
          <p><strong>${actor.name}</strong> ha terminado de extraer materiales</p>
          <div class="summary">
            <p>Éxitos: <strong>${successCount}</strong></p>
            <p>Fallos: <strong>${failCount}</strong></p>
            <p>Tiempo total: <strong>${summary.timeDisplay}</strong></p>
          </div>
        </div>
      `
    });

    ui.notifications?.info(`Extracción completada: ${successCount}/${results.length} exitosas.`);
  }

  static async onRollMedicine(event, btn) {
    const medicineData = this._getMedicineCheckData();
    if (!medicineData) {
      ui.notifications?.error("No hay datos de medicina disponibles.");
      return;
    }

    // Obtener modo de tirada seleccionado
    const selectedMode = this.element.querySelector('input[name="roll-mode"]:checked')?.value || 'normal';

    let roll;
    let rollFormula;
    let rollMode = "Normal";

    // Ejecutar tirada según el modo
    if (selectedMode === 'ejecucion') {
      // Modo Ejecución: 2d10kh + modificador (tomar el mayor)
      rollFormula = `1d10 + ${medicineData.totalModifier}`;
      roll = new Roll(rollFormula);
      rollMode = "Ejecución (2d10, tomar mayor)";
    } else if (selectedMode === 'aprender') {
      // Modo Aprender: 2d10kl + modificador (tomar el menor)
      rollFormula = `1d10 + ${medicineData.totalModifier}`;
      roll = new Roll(rollFormula);
      rollMode = "Aprender (2d10, tomar menor)";
    } else {
      // Modo Normal: 1d10 + modificador
      rollFormula = medicineData.formula;
      roll = new Roll(rollFormula);
      rollMode = "Normal";
    }

    await roll.evaluate();

    const success = roll.total >= medicineData.finalDC;
    const margin = roll.total - medicineData.finalDC;

    // Guardar resultado
    this.medicineRollResult = {
      roll: roll,
      total: roll.total,
      dc: medicineData.finalDC,
      success: success,
      margin: margin,
      mode: rollMode
    };

    this.medicinePassed = success;

    // Obtener información revelada si pasa
    let revealedInfo = '';
    if (success) {
      revealedInfo = `
        <div class="revealed-info">
          <h4>📖 Información Revelada</h4>
          <p><strong>Categoría:</strong> ${medicineData.categoryLabel}</p>
          <p><strong>Tamaño:</strong> ${medicineData.sizeLabel}</p>
          <p><strong>Naturaleza:</strong> ${medicineData.natureLabel}</p>
          <p><strong>Anatomía:</strong> ${medicineData.anatomy}</p>
          <p><em>Has identificado las características de esta criatura.</em></p>
        </div>
      `;
    }

    // Mensaje en chat
    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="tsdc medicine-check ${success ? 'success' : 'failure'}">
          <h3>Tirada de Medicina</h3>
          <p><strong>${this.actor.name}</strong> examina a una criatura desconocida</p>
          <div class="roll-details">
            <p>Modo: <strong>${rollMode}</strong></p>
            <p>Tirada: ${roll.total} = ${rollFormula}</p>
            <p class="result ${success ? 'success' : 'failure'}">
              ${success ?
                `✅ <strong>Éxito</strong>` :
                `❌ <strong>Fallo</strong>`
              }
            </p>
          </div>
          ${revealedInfo}
          ${!success ?
            '<p><em>No puedes determinar qué partes son útiles o cómo extraerlas.</em></p>' : ''
          }
        </div>
      `
    };

    await ChatMessage.create(chatData);

    // Si está en modo aprendizaje y pasó la tirada, agregar progreso a medicina
    if (selectedMode === 'aprender' && success) {
      try {
        const result = await addProgress(this.actor, "skills", "medicina", 1);
        if (result?.leveled) {
          ui.notifications?.info(`¡Has mejorado tu nivel de Medicina! Ahora estás en nivel ${result.level} (Rango ${result.rank}).`);

          // Mensaje en chat sobre el progreso
          await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor: this.actor }),
            content: `
              <div class="tsdc skill-progress">
                <h3>📚 Progreso de Medicina</h3>
                <p><strong>${this.actor.name}</strong> ha subido de nivel en Medicina!</p>
                <p>Nivel: <strong>${result.level}</strong> (Rango ${result.rank})</p>
                <p>Progreso: ${result.progress} puntos acumulados</p>
              </div>
            `
          });
        } else {
          // Obtener el threshold actual para mostrar progreso
          const { trackThreshold } = await import("../progression.js");
          const threshold = trackThreshold(this.actor, "skills", "medicina");
          ui.notifications?.info(`Has ganado progreso en Medicina (${result?.progress || 0}/${threshold}).`);
        }
      } catch (err) {
        console.error("TSDC | Error aplicando progreso de medicina:", err);
      }
    }

    // Si pasó, avanzar a resumen de extracción
    if (success) {
      this.step = "extraction-summary";
      ui.notifications?.info("Tirada de Medicina exitosa. Revisando partes extraíbles...");
    } else {
      ui.notifications?.warn("Tirada de Medicina fallida. No puedes extraer materiales de esta criatura.");
    }

    this.render(false);
  }

  static onSelectType(event, btn) {
    const type = btn.dataset.type;
    this.extractionData.type = type;
    this.step = 2;
    this.render(false);
  }

  static onSelectCreature(event, btn) {
    const creatureId = btn.dataset.creatureId;
    const partKey = btn.dataset.partKey;
    const partLabel = btn.dataset.partLabel || partKey;
    const requiredGrade = btn.dataset.requiredGrade || null;
    const requiredGradeLabel = btn.dataset.requiredGradeLabel || toolGradeLabel(requiredGrade);
    const quantity = Number(btn.dataset.partQuantity || 1);
    const quality = Number(btn.dataset.partQuality || 1);

    this.extractionData.target = creatureId;
    this.extractionData.targetPart = partKey;
    this.extractionData.requiredGrade = normalizeToolGrade(requiredGrade);
    this.extractionData.partInfo = {
      key: partKey,
      label: partLabel,
      quantity,
      quality,
      requiredGrade: normalizeToolGrade(requiredGrade),
      requiredGradeLabel
    };
    this.extractionData.quality = quality;
    this.extractionData.tool = null;
    this.extractionData.toolGrade = null;
    this.extractionData.toolName = null;
    this.step = 3;
    this.render(false);
  }

  static onSelectMaterial(event, btn) {
    const materialKey = btn.dataset.materialKey;
    const quality = parseInt(btn.dataset.quality || "1");

    this.extractionData.target = materialKey;
    this.extractionData.quality = quality;
    this.extractionData.requiredGrade = null;
    this.extractionData.partInfo = null;
    this.extractionData.tool = null;
    this.extractionData.toolGrade = null;
    this.extractionData.toolName = null;
    this.step = 3;
    this.render(false);
  }

  static onSelectTool(event, btn) {
    const toolId = btn.dataset.toolId;
    const bag = this.actor.system?.inventory?.bag || [];
    const tool = bag.find(item => item.id === toolId);

    if (tool) {
      const gradeKey = normalizeToolGrade(tool.grade ?? tool.gradeKey ?? tool.system?.grade ?? null) || "basico";
      this.extractionData.tool = toolId;
      this.extractionData.toolGrade = gradeKey;
      this.extractionData.toolName = tool.name;
      this.step = 4;
      this.render(false);
    }
  }

  static async onPerformExtraction(event, btn) {
    try {
      await this._performExtraction();
      this.close();
    } catch (err) {
      console.error("Error en extracción:", err);
      ui.notifications?.error("Error al realizar la extracción.");
    }
  }

  static onBack(event, btn) {
    if (this.step > 1) {
      this.step--;
      this.render(false);
    }
  }

  /* -------------------------------------------- */
  /*  Extraction Logic                            */
  /* -------------------------------------------- */

  async _performExtraction() {
    const { type, target, targetPart, tool, toolGrade, quality } = this.extractionData;
    const extractionInfo = this._getExtractionInfo();

    if (!extractionInfo) {
      ui.notifications?.error("No se pudo obtener información de extracción.");
      return;
    }

    if (!extractionInfo.hasRequiredTool) {
      ui.notifications?.error(`Necesitas un kit ${extractionInfo.requiredLabel ?? "adecuado"} para extraer este material.`);
      return;
    }

    const toolGradeKey = normalizeToolGrade(toolGrade);

    // 1. Realizar tirada de aptitud
    const aptitudeKey = extractionInfo.aptitudeKey;
    const difficulty = extractionInfo.difficulty || "fundamentos";
    const bonus = extractionInfo.bonus || 0;

    // TODO: Implementar sistema de tiradas
    // Por ahora, asumimos éxito automático para testing
    const success = true;
    const rollResult = 10 + bonus;

    if (!success) {
      ui.notifications?.warn("La extracción falló. No se obtuvo material.");
      return;
    }

    // 2. Determinar cantidad extraída
    let quantity = 1;
    if (type === "creature" && extractionInfo.quantity) {
      quantity = extractionInfo.quantity;
    }
    if (type === "mineral" && extractionInfo.yieldFormula) {
      const roll = new Roll(extractionInfo.yieldFormula);
      await roll.evaluate();
      quantity = roll.total;
    }

    // 3. Crear Item de material
    const materialKey = type === "creature" ? targetPart : target;
    const materialData = getMaterial(materialKey);

    if (!materialData) {
      ui.notifications?.error("Material no encontrado en el catálogo.");
      return;
    }

    // Verificar conservación y calcular calidad final
    let expiresAt = null;
    let perishable = false;
    let finalQuality = quality;
    let conservationStatus = "normal";
    let hasConservationKit = false;

    // Determinar qué tipo de conservación necesita
    let requiredConservationKit = null;
    let conservationInfo = null;

    if (type === "creature") {
      // Mapeo completo de partes a requisitos de conservación
      const partConservationMap = {
        // Sistema Nervioso - Kit Especializado, 3 días
        sistema_nervioso: {
          kit: "kit_conservacion_especializado",
          time: "3 días",
          perishable: true
        },
        // Glándulas y Órganos - Kit Especializado, 1 semana
        glandulas: {
          kit: "kit_conservacion_especializado",
          time: "1 semana",
          perishable: true
        },
        organos: {
          kit: "kit_conservacion_especializado",
          time: "1 semana",
          perishable: true
        },
        // Fluidos - Kit Básico, variable
        fluidos: {
          kit: "kit_conservacion",
          time: "2 semanas",
          perishable: true
        },
        sangre: {
          kit: "kit_conservacion",
          time: "2 semanas",
          perishable: true
        },
        veneno: {
          kit: "kit_conservacion",
          time: "1 mes",
          perishable: true
        },
        // Pelaje y Plumaje - Kit Básico, 1 mes
        pelaje: {
          kit: "kit_conservacion",
          time: "1 mes",
          perishable: true
        },
        plumaje: {
          kit: "kit_conservacion",
          time: "1 mes",
          perishable: true
        },
        // Colmillos y Garras - Kit Básico, 6 semanas
        colmillos: {
          kit: "kit_conservacion",
          time: "6 semanas",
          perishable: true
        },
        garras: {
          kit: "kit_conservacion",
          time: "6 semanas",
          perishable: true
        },
        // Escamas y Caparazón - Kit Avanzado, 2 meses
        escamas: {
          kit: "kit_conservacion_avanzado",
          time: "2 meses",
          perishable: true
        },
        caparazon: {
          kit: "kit_conservacion_avanzado",
          time: "2 meses",
          perishable: true
        },
        // Huesos y Cuernos - Kit Avanzado, 2 meses
        huesos: {
          kit: "kit_conservacion_avanzado",
          time: "2 meses",
          perishable: true
        },
        cuernos: {
          kit: "kit_conservacion_avanzado",
          time: "2 meses",
          perishable: true
        }
      };

      const partInfo = partConservationMap[targetPart];
      if (partInfo) {
        requiredConservationKit = partInfo.kit;
        conservationInfo = {
          requiresKit: partInfo.kit,
          time: partInfo.time,
          extendedTime: partInfo.time
        };
        perishable = partInfo.perishable;
      } else {
        // Partes no mapeadas no requieren conservación
        perishable = false;
      }
    } else if (type === "plant") {
      conservationInfo = CONSERVATION_TIME.plants;
      requiredConservationKit = "kit_conservacion_botanico";
      perishable = true;
    } else if (type === "mineral") {
      conservationInfo = CONSERVATION_TIME.minerals;
      perishable = false; // Minerales no perecen
    }

    // Si la parte es perecedera, verificar si tiene el kit apropiado
    if (perishable && requiredConservationKit) {
      const bag = this.actor.system?.inventory?.bag || [];

      // Buscar kit usando jerarquía: Especializado puede cubrir cualquier requisito
      const conservationKit = bag.find(item =>
        item.type === "tool" &&
        item.key?.includes("conservacion") &&
        item.uses > 0 &&
        canKitSatisfyRequirement(item.name || item.key, requiredConservationKit)
      );

      if (conservationKit) {
        hasConservationKit = true;
        // Con kit: tiempo extendido y calidad normal
        const extendedTime = conservationInfo.extendedTime || "1 semana";
        const timeMs = this._parseTimeToMs(extendedTime);
        expiresAt = new Date(Date.now() + timeMs).toISOString();
        conservationStatus = "conservado";

        // Consumir 1 uso del kit
        conservationKit.uses -= 1;
        await this.actor.update({ "system.inventory.bag": bag });

        if (conservationKit.uses <= 0) {
          ui.notifications?.warn(`${conservationKit.name} se ha agotado.`);
        }
      } else {
        // Sin kit: tiempo reducido y calidad degradada (0)
        const shortTime = conservationInfo.time || "24 horas";
        const timeMs = this._parseTimeToMs(shortTime);
        expiresAt = new Date(Date.now() + timeMs).toISOString();
        finalQuality = 0; // Calidad dañada por falta de conservación
        conservationStatus = "dañado";
        ui.notifications?.warn(`No tienes ${conservationInfo.requiresKit || "kit de conservación apropiado"}. El material se ha dañado (calidad 0).`);
      }
    }

    // Crear el material en el bag del inventario (no como Item document)
    const materialName = conservationStatus === "dañado"
      ? `${materialData.label} (Dañado)`
      : materialData.label;

    // Calcular tiempo restante legible
    let timeRemaining = null;
    if (expiresAt && perishable) {
      const now = Date.now();
      const expires = new Date(expiresAt).getTime();
      const diffMs = expires - now;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (diffDays > 0) {
        timeRemaining = `${diffDays} días`;
      } else if (diffHours > 0) {
        timeRemaining = `${diffHours} horas`;
      } else {
        timeRemaining = "Próximo a expirar";
      }
    }

    const materialItem = {
      id: foundry.utils.randomID(),
      name: materialName,
      type: "material",
      key: materialKey,
      category: this._getCategoryFromType(type),
      materialType: materialData.type,
      quality: finalQuality,
      quantity: quantity,
      unit: materialData.unit || "kg",
      weight: quantity * (materialData.weightPerUnit || 1),
      extractedFrom: type === "creature" ? game.actors.get(target)?.name : "",
      extractedAt: new Date().toISOString(),
      extractionMethod: toolGradeKey ?? "sin-herramienta",
      perishable: perishable,
      expiresAt: expiresAt,
      timeRemaining: timeRemaining,
      conservationStatus: conservationStatus,
      conservationKit: conservationStatus === "conservado" ? requiredConservationKit : null,
      source: "extracted",
      notes: ""
    };

    // Agregar al bag del inventario
    const bag = this.actor.system?.inventory?.bag || [];
    bag.push(materialItem);
    await this.actor.update({ "system.inventory.bag": bag });

    // 4. Usar herramienta (reducir usos si es kit del bag)
    if (tool) {
      const bag = this.actor.system?.inventory?.bag || [];
      const toolItem = bag.find(item => item.id === tool);
      if (toolItem && toolItem.uses > 0) {
        toolItem.uses -= 1;
        await this.actor.update({ "system.inventory.bag": bag });
        if (toolItem.uses <= 0) {
          ui.notifications?.warn(`${toolItem.name} se ha agotado.`);
        }
      }
    }

    // 5. Notificación
    ui.notifications?.info(`Extracción exitosa: ${quantity} ${materialData.unit} de ${materialName} (Grado ${finalQuality})`);

    // 6. Mensaje en chat
    const conservationMsg = conservationStatus === "dañado"
      ? `<li>⚠️ Estado: Dañado (sin kit de conservación apropiado)</li>`
      : conservationStatus === "conservado"
      ? `<li>✅ Estado: Conservado correctamente</li>`
      : '';

    const chatData = {
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="tsdc extraction-result">
          <h3>Extracción de Material</h3>
          <p><strong>${this.actor.name}</strong> extrajo:</p>
          <ul>
            <li><strong>${materialName}</strong></li>
            <li>Cantidad: ${quantity} ${materialData.unit}</li>
            <li>Calidad: Grado ${finalQuality}</li>
            <li>Método: ${toolGradeLabel(toolGrade)}</li>
            ${conservationMsg}
            ${perishable ? `<li>⏰ Expira: ${new Date(expiresAt).toLocaleDateString()}</li>` : ''}
          </ul>
        </div>
      `
    };

    ChatMessage.create(chatData);
  }

  _parseTimeToMs(timeString) {
    // Convierte strings como "24 horas", "1 semana", "3 días" a milisegundos
    const timeLower = (timeString || "").toLowerCase();

    if (timeLower.includes("hora")) {
      const match = timeLower.match(/(\d+)\s*hora/);
      const hours = match ? parseInt(match[1]) : 24;
      return hours * 60 * 60 * 1000;
    }

    if (timeLower.includes("día") || timeLower.includes("dia")) {
      const match = timeLower.match(/(\d+)\s*d[íi]a/);
      const days = match ? parseInt(match[1]) : 1;
      return days * 24 * 60 * 60 * 1000;
    }

    if (timeLower.includes("semana")) {
      const match = timeLower.match(/(\d+)\s*semana/);
      const weeks = match ? parseInt(match[1]) : 1;
      return weeks * 7 * 24 * 60 * 60 * 1000;
    }

    if (timeLower.includes("mes")) {
      const match = timeLower.match(/(\d+)\s*mes/);
      const months = match ? parseInt(match[1]) : 1;
      return months * 30 * 24 * 60 * 60 * 1000; // Aproximado
    }

    // Por defecto: 24 horas
    return 24 * 60 * 60 * 1000;
  }

  _getCategoryFromType(type) {
    if (type === "creature") return "partes";
    if (type === "plant") return "plantas";
    if (type === "mineral") return "minerales";
    return "minerales";
  }

  /* -------------------------------------------- */
  /*  Static Helpers                              */
  /* -------------------------------------------- */

  /**
   * Open extraction dialog for a character
   * @param {Actor} actor - The character doing the extraction
   * @param {Actor} targetCreature - Optional creature to extract from
   */
  static open(actor, targetCreature = null) {
    if (!actor) {
      const controlled = canvas.tokens?.controlled?.[0];
      actor = controlled?.actor ?? game.user?.character;
    }

    if (!actor) {
      ui.notifications?.warn("Selecciona un personaje primero.");
      return null;
    }

    const dialog = new this(actor, targetCreature);
    dialog.render(true);
    return dialog;
  }

  /**
   * Open extraction dialog from creature token (from HUD)
   * @param {Token} creatureToken - The dead creature token
   */
  static openFromCreature(creatureToken) {
    if (!creatureToken || !creatureToken.actor) {
      ui.notifications?.warn("Token no válido.");
      return null;
    }

    const creature = creatureToken.actor;
    if (creature.type !== "creature") {
      ui.notifications?.warn("Esto no es una criatura.");
      return null;
    }

    // Verificar si está muerta usando el sistema de death
    const isDead = creature.getFlag("tsdc", "isDead") || isCreatureDead(creature);

    if (!isDead) {
      ui.notifications?.warn("La criatura aún está viva.");
      return null;
    }

    // Obtener personaje del usuario
    // Buscar entre los tokens controlados un personaje (no la criatura)
    let actor = null;
    const controlled = canvas.tokens?.controlled ?? [];

    for (const token of controlled) {
      if (token.actor?.type === "character") {
        actor = token.actor;
        break;
      }
    }

    // Si no hay personaje en los controlados, usar el personaje asignado al usuario
    if (!actor) {
      actor = game.user?.character;
    }

    if (!actor || actor.type !== "character") {
      ui.notifications?.warn("Debes seleccionar o tener asignado un personaje para extraer materiales.");
      return null;
    }

    const dialog = new this(actor, creature);
    dialog.render(true);
    return dialog;
  }
}
