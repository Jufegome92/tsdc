// modules/features/fabrication/index.js
// Sistema completo de fabricación

// Importar todos los módulos de fabricación
import * as Tools from "./tools.js";
import * as Equipment from "./equipment.js";
import * as Alchemy from "./alchemy.js";
import * as Traps from "./traps.js";
import * as Refinement from "./refinement.js";
import * as Blueprints from "./blueprints.js";

// Re-exportar herramientas
export {
  Tools
};

// Re-exportar equipamiento
export {
  Equipment
};

// Re-exportar alquimia
export {
  Alchemy
};

// Re-exportar trampas
export {
  Traps
};

// Re-exportar refinamiento
export {
  Refinement
};

// Re-exportar planos
export {
  Blueprints
};

/**
 * Sistema de progreso de fabricación
 * Permite trackear el progreso de fabricación de objetos
 */
export class FabricationProgress {
  constructor(itemType, itemKey, totalHours, artKey, difficulty) {
    this.itemType = itemType; // "equipment", "alchemy", "trap", "tool"
    this.itemKey = itemKey;
    this.totalHours = totalHours;
    this.hoursCompleted = 0;
    this.artKey = artKey; // "herreria", "sastreria", "alquimia", "trampero", "ingenieria"
    this.difficulty = difficulty; // "fundamentos", "riguroso", "extremo"
    this.startDate = new Date();
    this.lastWorkDate = null;
    this.status = "in_progress"; // "in_progress", "completed", "failed"
  }

  /**
   * Registra trabajo en la fabricación
   * @param {number} hours - horas trabajadas
   * @param {boolean} success - si la tirada de enfoque fue exitosa
   */
  addWork(hours, success = true) {
    if (this.status !== "in_progress") return false;

    if (success) {
      this.hoursCompleted += hours;
      this.lastWorkDate = new Date();

      if (this.hoursCompleted >= this.totalHours) {
        this.status = "completed";
        return { completed: true, progress: 100 };
      }

      const progress = (this.hoursCompleted / this.totalHours) * 100;
      return { completed: false, progress };
    }

    // Si falla, no se pierde progreso pero tampoco avanza
    return { completed: false, progress: (this.hoursCompleted / this.totalHours) * 100 };
  }

  /**
   * Obtiene el progreso actual
   */
  getProgress() {
    return {
      hoursCompleted: this.hoursCompleted,
      totalHours: this.totalHours,
      percentage: (this.hoursCompleted / this.totalHours) * 100,
      hoursRemaining: this.totalHours - this.hoursCompleted,
      status: this.status
    };
  }

  /**
   * Cancela la fabricación
   */
  cancel() {
    this.status = "failed";
  }

  /**
   * Serializa para guardar
   */
  toJSON() {
    return {
      itemType: this.itemType,
      itemKey: this.itemKey,
      totalHours: this.totalHours,
      hoursCompleted: this.hoursCompleted,
      artKey: this.artKey,
      difficulty: this.difficulty,
      startDate: this.startDate.toISOString(),
      lastWorkDate: this.lastWorkDate?.toISOString(),
      status: this.status
    };
  }

  /**
   * Deserializa desde JSON
   */
  static fromJSON(data) {
    const progress = new FabricationProgress(
      data.itemType,
      data.itemKey,
      data.totalHours,
      data.artKey,
      data.difficulty
    );
    progress.hoursCompleted = data.hoursCompleted;
    progress.startDate = new Date(data.startDate);
    progress.lastWorkDate = data.lastWorkDate ? new Date(data.lastWorkDate) : null;
    progress.status = data.status;
    return progress;
  }
}

/**
 * Materiales procesados
 * Estos materiales requieren refinamiento de materias primas
 */
export const PROCESSED_MATERIALS = {
  cuero: {
    key: "cuero",
    label: "Cuero",
    type: "fibra",
    art: "sastreria",
    baseFrom: "pelaje", // Se fabrica desde pelaje
    durability: q => 7 * q,
    potency: q => 5 * q,
    costPerUnit: (q, qty = 1) => 15 * q * qty
  },
  escamado: {
    key: "escamado",
    label: "Escamado",
    type: "metal",
    art: "herreria",
    baseFrom: "escamas",
    durability: q => 9 * q,
    potency: q => 6 * q,
    costPerUnit: (q, qty = 1) => 25 * q * qty
  },
  acorazado: {
    key: "acorazado",
    label: "Acorazado",
    type: "metal",
    art: "herreria",
    baseFrom: "caparazon",
    durability: q => 11 * q,
    potency: q => 7 * q,
    costPerUnit: (q, qty = 1) => 35 * q * qty
  },
  tela: {
    key: "tela",
    label: "Tela",
    type: "fibra",
    art: "sastreria",
    baseFrom: "fibra_origen", // Puede ser de varias fibras (algodón, lana, seda, etc.)
    durability: (materialOrigin, q) => materialOrigin.durability + q,
    potency: (materialOrigin, q) => materialOrigin.potency + q,
    costPerUnit: (materialOrigin, q, qty = 1) => materialOrigin.cost * 0.2 * q * qty
  },
  bronce: {
    key: "bronce",
    label: "Bronce",
    type: "metal",
    art: "herreria",
    baseFrom: ["cobre", "estano"], // Aleación
    durability: 12,
    potency: 20,
    costPerUnit: (q, qty = 1) => 20 * q * qty
  },
  acero: {
    key: "acero",
    label: "Acero",
    type: "metal",
    art: "herreria",
    baseFrom: ["hierro", "carbon"], // Aleación
    durability: 18,
    potency: 30,
    costPerUnit: (q, qty = 1) => 30 * q * qty
  },
  peltre: {
    key: "peltre",
    label: "Peltre",
    type: "metal",
    art: "herreria",
    baseFrom: "estano", // Con pequeñas cantidades de otros metales
    durability: 8,
    potency: 15,
    costPerUnit: (q, qty = 1) => 15 * q * qty
  },
  vidrio: {
    key: "vidrio",
    label: "Vidrio",
    type: "roca",
    art: "herreria",
    baseFrom: "arena", // Arena silícea fundida
    durability: 5,
    potency: 10,
    costPerUnit: (q, qty = 1) => 8 * q * qty
  }
};

/**
 * Helpers generales de fabricación
 */

/**
 * Calcula el costo total de fabricación según tipo
 */
export function calculateTotalFabricationCost(fabricationType, itemKey, quality = 1, quantity = 1) {
  switch (fabricationType) {
    case "equipment":
      // Requiere más información (tipo de arma/armadura, materiales específicos)
      return null;
    case "alchemy":
      const formula = Alchemy.getFormula(itemKey);
      if (!formula) return null;
      // Calcular costo de reagentes + plantas + mano de obra
      return {
        type: "alchemy",
        formula: formula.label,
        // Los costos específicos necesitan implementarse según la fórmula
      };
    case "trap":
      return Traps.calculateTrapFabricationCost(itemKey);
    case "tool":
      return Blueprints.getBlueprintInfo(itemKey);
    default:
      return null;
  }
}

/**
 * Crea un nuevo progreso de fabricación
 */
export function startFabrication(fabricationType, itemKey, totalHours, artKey, difficulty) {
  return new FabricationProgress(fabricationType, itemKey, totalHours, artKey, difficulty);
}

/**
 * Sistema de enfoque
 * Referencia a la mecánica de enfoque mencionada en el libro
 */
export const FOCUS_SYSTEM = {
  description: "Cada hora de trabajo requiere una prueba de Enfoque. El jugador debe mantener la concentración para que el tiempo cuente hacia la finalización del objeto.",
  note: "Ver página 10 del manual para detalles completos del sistema de Enfoque."
};

/**
 * Días y horas de trabajo
 */
export const WORK_SCHEDULE = {
  hoursPerDay: 6,
  daysPerWeek: 5,
  hoursPerWeek: 30,
  note: "Un día de trabajo efectivo representa 6 horas. Una semana de trabajo consta de 5 días."
};

/**
 * Calcula las semanas necesarias para un número de horas
 */
export function calculateWeeksFromHours(hours) {
  return Math.ceil(hours / WORK_SCHEDULE.hoursPerWeek);
}

/**
 * Calcula los días necesarios para un número de horas
 */
export function calculateDaysFromHours(hours) {
  return Math.ceil(hours / WORK_SCHEDULE.hoursPerDay);
}
