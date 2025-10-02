// modules/documents/item.js
import { getMaterialStats, getMaterial } from "../features/materials/index.js";

export class TSDCItem extends Item {

  prepareBaseData() {
    super.prepareBaseData();

    // Asegurar estructura mínima según tipo
    const sys = this.system ?? {};

    switch (this.type) {
      case "material":
        this._prepareMaterialData(sys);
        break;
      case "tool":
        this._prepareToolData(sys);
        break;
      case "consumable":
        this._prepareConsumableData(sys);
        break;
      case "generic":
        this._prepareGenericData(sys);
        break;
      case "tauma":
        this._prepareTaumaData(sys);
        break;
    }

    this.system = sys;
  }

  prepareDerivedData() {
    super.prepareDerivedData();

    // Calcular stats derivados según tipo
    switch (this.type) {
      case "material":
        this._computeMaterialStats();
        break;
      case "tauma":
        this._computeTaumaStats();
        break;
    }
  }

  /* -------------------------------------------- */
  /*  Material-specific Data Preparation          */
  /* -------------------------------------------- */

  _prepareMaterialData(sys) {
    sys.key ??= "";
    sys.category ??= "minerales";
    sys.materialType ??= "";
    sys.quality ??= 1;
    sys.quantity ??= 0;
    sys.unit ??= "kg";
    sys.weight ??= 0;
    sys.perishable ??= false;
    sys.notes ??= "";
  }

  _computeMaterialStats() {
    const sys = this.system;
    if (!sys.key) return;

    // Obtener stats del catálogo de materiales
    const materialData = getMaterial(sys.key);
    if (!materialData) return;

    const stats = getMaterialStats(sys.key, sys.quality || 1);

    // Actualizar stats derivados (no se guardan, se calculan)
    sys.durability = stats.durability;
    sys.potency = stats.potency;

    // Calcular costo si no está definido
    if (typeof materialData.costPerUnit === "function") {
      sys.costPerUnit = materialData.costPerUnit(sys.quality || 1, 1);
    }

    // Calcular peso total
    sys.weight = sys.quantity * (materialData.weightPerUnit || 1);
  }

  /* -------------------------------------------- */
  /*  Tool-specific Data Preparation              */
  /* -------------------------------------------- */

  _prepareToolData(sys) {
    sys.key ??= "";
    sys.art ??= "herreria";
    sys.toolType ??= "individual";
    sys.grade ??= "basico";
    sys.weight ??= 0;
    sys.uses ??= null;
    sys.maxUses ??= null;
    sys.notes ??= "";
  }

  /* -------------------------------------------- */
  /*  Consumable-specific Data Preparation        */
  /* -------------------------------------------- */

  _prepareConsumableData(sys) {
    sys.key ??= "";
    sys.consumableType ??= "elixir";
    sys.quality ??= 1;
    sys.quantity ??= 1;
    sys.weight ??= 0;
    sys.uses ??= 1;
    sys.notes ??= "";
  }

  /* -------------------------------------------- */
  /*  Generic Item Data Preparation               */
  /* -------------------------------------------- */

  _prepareGenericData(sys) {
    sys.itemType ??= "mundane";
    sys.quantity ??= 1;
    sys.weight ??= 0;
    sys.material ??= "";
    sys.materialQuality ??= null;
    sys.value ??= 0;
    sys.description ??= "";
    sys.notes ??= "";
  }

  /* -------------------------------------------- */
  /*  Tauma-specific Data Preparation             */
  /* -------------------------------------------- */

  _prepareTaumaData(sys) {
    sys.taumaType ??= "artifact";
    sys.rarity ??= "comun";
    sys.taumaLevel ??= 1;
    sys.element ??= "none";
    sys.quantity ??= 1;
    sys.weight ??= 0;
    sys.material ??= "";
    sys.resonance ??= 0;
    sys.awakened ??= false;

    sys.attunement ??= {};
    sys.attunement.required ??= false;
    sys.attunement.attunedTo ??= null;

    sys.evolution ??= {};
    sys.evolution.stage ??= 1;
    sys.evolution.xp ??= 0;
    sys.evolution.maxStage ??= 5;

    sys.powers ??= [];
    sys.passiveEffects ??= [];
    sys.notes ??= "";
  }

  _computeTaumaStats() {
    const sys = this.system;

    // Calcular stats según material base si existe
    if (sys.material && sys.materialQuality) {
      const stats = getMaterialStats(sys.material, sys.materialQuality);
      sys.baseDurability ??= stats.durability;
      sys.basePotency ??= stats.potency;
    }

    // Aplicar multiplicadores por nivel de tauma
    const levelMultiplier = 1 + (sys.taumaLevel - 1) * 0.2;
    sys.effectiveDurability = (sys.baseDurability || 0) * levelMultiplier;
    sys.effectivePotency = (sys.basePotency || 0) * levelMultiplier;

    // Calcular resonancia efectiva (aumenta con evolución)
    const stageBonus = (sys.evolution?.stage || 1) - 1;
    sys.effectiveResonance = sys.resonance + stageBonus * 2;
  }

  /* -------------------------------------------- */
  /*  Utility Methods                             */
  /* -------------------------------------------- */

  /**
   * Check if material is expired
   * @returns {boolean}
   */
  get isExpired() {
    if (this.type !== "material") return false;
    if (!this.system.perishable) return false;
    if (!this.system.expiresAt) return false;
    return Date.now() > new Date(this.system.expiresAt).getTime();
  }

  /**
   * Get remaining time until expiration
   * @returns {number} milliseconds, or null if not perishable
   */
  get timeUntilExpiration() {
    if (!this.system.perishable || !this.system.expiresAt) return null;
    const remaining = new Date(this.system.expiresAt).getTime() - Date.now();
    return Math.max(0, remaining);
  }

  /**
   * Apply conservation to extend expiration time
   * @param {string} kitType - "basico", "especializado", "botanico"
   * @returns {Promise<void>}
   */
  async applyConservation(kitType) {
    if (this.type !== "material" || !this.system.perishable) {
      ui.notifications?.warn("Este material no necesita conservación.");
      return;
    }

    const { getConservationInfo } = await import("../features/materials/extraction.js");
    const conservationInfo = getConservationInfo(this.system.key);

    if (!conservationInfo.requiresKit) {
      ui.notifications?.info("Este material no requiere kit de conservación.");
      return;
    }

    // Calcular nuevo tiempo de expiración
    let extensionTime = 0;
    const category = this.system.category;

    if (category === "plantas") {
      extensionTime = 30 * 24 * 60 * 60 * 1000; // 1 mes
    } else if (kitType === "especializado") {
      extensionTime = 3 * 24 * 60 * 60 * 1000; // 3 días
    } else {
      extensionTime = 7 * 24 * 60 * 60 * 1000; // 1 semana
    }

    const newExpiration = Date.now() + extensionTime;

    await this.update({
      "system.expiresAt": new Date(newExpiration).toISOString(),
      "system.conservationKit": kitType,
      "system.conservationAppliedAt": new Date().toISOString()
    });

    ui.notifications?.info(`Conservación aplicada. Expira en ${Math.ceil(extensionTime / (24 * 60 * 60 * 1000))} días.`);
  }

  /**
   * Use tool once (for kits with limited uses)
   * @returns {Promise<boolean>} true if successful, false if no uses left
   */
  async useTool() {
    if (this.type !== "tool") return false;
    if (this.system.uses === null) return true; // Unlimited uses

    if (this.system.uses <= 0) {
      ui.notifications?.warn("Esta herramienta no tiene más usos.");
      return false;
    }

    await this.update({
      "system.uses": this.system.uses - 1
    });

    if (this.system.uses - 1 <= 0) {
      ui.notifications?.warn(`${this.name} se ha agotado.`);
    }

    return true;
  }

  /**
   * Consume a consumable item
   * @returns {Promise<boolean>}
   */
  async consume() {
    if (this.type !== "consumable") return false;

    if (this.system.uses <= 0 || this.system.quantity <= 0) {
      ui.notifications?.warn("No quedan usos de este consumible.");
      return false;
    }

    const newUses = this.system.uses - 1;
    if (newUses <= 0) {
      // Si no quedan usos, reducir cantidad
      const newQuantity = this.system.quantity - 1;
      if (newQuantity <= 0) {
        // Eliminar item si no quedan
        await this.delete();
        ui.notifications?.info(`${this.name} consumido completamente.`);
      } else {
        await this.update({
          "system.quantity": newQuantity,
          "system.uses": 1 // Reset uses for next unit
        });
      }
    } else {
      await this.update({
        "system.uses": newUses
      });
    }

    return true;
  }

  /**
   * Check if tauma is attuned to a specific actor
   * @param {string} actorId
   * @returns {boolean}
   */
  isAttunedTo(actorId) {
    if (this.type !== "tauma") return false;
    return this.system.attunement?.attunedTo === actorId;
  }

  /**
   * Attune tauma to an actor
   * @param {string} actorId
   * @returns {Promise<void>}
   */
  async attuneTo(actorId) {
    if (this.type !== "tauma") return;

    await this.update({
      "system.attunement.attunedTo": actorId,
      "system.attunement.attunedAt": new Date().toISOString()
    });

    ui.notifications?.info(`${this.name} sintonizado con éxito.`);
  }

  /**
   * Award XP to tauma for evolution
   * @param {number} xp
   * @returns {Promise<void>}
   */
  async awardTaumaXP(xp) {
    if (this.type !== "tauma") return;

    const currentXP = this.system.evolution?.xp || 0;
    const currentStage = this.system.evolution?.stage || 1;
    const maxStage = this.system.evolution?.maxStage || 5;

    if (currentStage >= maxStage) {
      ui.notifications?.info(`${this.name} ya alcanzó su máxima evolución.`);
      return;
    }

    const newXP = currentXP + xp;
    const xpNeeded = currentStage * 100; // XP needed increases with stage

    if (newXP >= xpNeeded) {
      // Level up!
      await this.update({
        "system.evolution.stage": currentStage + 1,
        "system.evolution.xp": newXP - xpNeeded
      });
      ui.notifications?.info(`¡${this.name} ha evolucionado al nivel ${currentStage + 1}!`);
    } else {
      await this.update({
        "system.evolution.xp": newXP
      });
    }
  }
}
