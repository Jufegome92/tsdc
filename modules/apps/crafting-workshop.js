// modules/apps/crafting-workshop.js
// El Taller - UI principal de fabricación (ApplicationV2)

import { FabricationProgress } from "../features/fabrication/index.js";
import * as Fabrication from "../features/fabrication/index.js";
import { addProgress } from "../progression.js";
import { getDifficultyDC } from "../utils/difficulties.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/* -------------------------------------------- */
/*  CraftingWorkshop Application V2             */
/* -------------------------------------------- */

export class CraftingWorkshop extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tsdc-crafting-workshop-{actorId}",
    classes: ["tsdc", "crafting-workshop"],
    window: {
      icon: "fa-solid fa-hammer",
      title: "El Taller",
      resizable: true
    },
    position: {
      width: 1000,
      height: 700
    },
    actions: {
      close: CraftingWorkshop.onClose,
      "switch-tab": CraftingWorkshop.onSwitchTab,
      "new-project": CraftingWorkshop.onNewProject,
      "wizard-next": CraftingWorkshop.onWizardNext,
      "wizard-back": CraftingWorkshop.onWizardBack,
      "wizard-cancel": CraftingWorkshop.onWizardCancel,
      "select-fabrication-type": CraftingWorkshop.onSelectFabricationType,
      "select-recipe": CraftingWorkshop.onSelectRecipe,
      "add-material": CraftingWorkshop.onAddMaterial,
      "remove-material": CraftingWorkshop.onRemoveMaterial,
      "change-reagent-quality": CraftingWorkshop.onChangeReagentQuality,
      "confirm-project": CraftingWorkshop.onConfirmProject,
      "work-on-project": CraftingWorkshop.onWorkOnProject,
      "pause-project": CraftingWorkshop.onPauseProject,
      "cancel-project": CraftingWorkshop.onCancelProject,
      "material-detail": CraftingWorkshop.onMaterialDetail,
      "tool-detail": CraftingWorkshop.onToolDetail
    }
  };

  static PARTS = {
    body: {
      template: "systems/tsdc/templates/apps/crafting-workshop.hbs"
    }
  };

  constructor(actorId, options = {}) {
    super(options);
    this.actorId = actorId ?? null;
    this.activeTab = "inventory";
    this.activeProject = null;
    this.wizardStep = 0;
    this.wizardData = {};
    this._searchQuery = "";

    // Hook para actualizar cuando cambie el actor
    this._onUpdate = (doc, diff, options, userId) => {
      if (doc.id === this.actor?.id) {
        this.render(false);
      }
    };
    Hooks.on("updateActor", this._onUpdate);
    Hooks.on("updateItem", this._onUpdate);
  }

  get actor() {
    return game.actors?.get?.(this.actorId) || null;
  }

  get title() {
    return `El Taller de ${this.actor?.name ?? "—"}`;
  }

  async close(opts) {
    Hooks.off("updateActor", this._onUpdate);
    Hooks.off("updateItem", this._onUpdate);
    return super.close(opts);
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
      activeTab: this.activeTab,

      // Inventario
      materials: this._getMaterialsInventory(),
      tools: this._getToolsInventory(),
      knowledge: this._getKnowledgeInventory(),

      // Proyectos
      activeProjects: this._getActiveProjects(),
      history: this._getCraftingHistory(),

      // Wizard
      wizardActive: this.wizardStep > 0,
      wizardStep: this.wizardStep,
      wizardData: this.wizardData,

      // Búsqueda
      searchQuery: this._searchQuery
    };
  }

  /* -------------------------------------------- */
  /*  Inventory Methods                           */
  /* -------------------------------------------- */

  _getMaterialsInventory() {
    if (!this.actor) return { minerales: [], plantas: [], partes: [], fibras: [], reagentes: [] };

    // Obtener todos los items de tipo "material" del actor
    const materials = this.actor.items.filter(i => i.type === "material");

    const organized = {
      minerales: [],
      plantas: [],
      partes: [],
      fibras: [],
      reagentes: []
    };

    for (const item of materials) {
      const category = item.system.category || "minerales";
      if (organized[category]) {
        organized[category].push({
          id: item.id,
          name: item.name,
          key: item.system.key,
          quality: item.system.quality || 1,
          quantity: item.system.quantity || 0,
          unit: item.system.unit || "kg",
          perishable: item.system.perishable || false,
          expiresAt: item.system.expiresAt || null,
          conservationKit: item.system.conservationKit || null
        });
      }
    }

    return organized;
  }

  _getToolsInventory() {
    if (!this.actor) return { herreria: [], sastreria: [], alquimia: [], joyeria: [], trampero: [], ingenieria: [] };

    // Obtener todos los items de tipo "tool" del actor
    const tools = this.actor.items.filter(i => i.type === "tool");

    const organized = {
      herreria: [],
      sastreria: [],
      alquimia: [],
      joyeria: [],
      trampero: [],
      ingenieria: []
    };

    for (const item of tools) {
      const art = item.system.art || "herreria";
      if (organized[art]) {
        organized[art].push({
          id: item.id,
          name: item.name,
          key: item.system.key,
          toolType: item.system.toolType, // "kit", "individual"
          grade: item.system.grade || "basico",
          uses: item.system.uses || null,
          maxUses: item.system.maxUses || null
        });
      }
    }

    return organized;
  }

  _getKnowledgeInventory() {
    if (!this.actor) return { formulas: [], diagrams: [], blueprints: [], designs: [] };

    const items = this.actor.items;

    return {
      formulas: items.filter(i => i.type === "formula").map(i => ({
        id: i.id,
        key: i.system.key,
        name: i.name,
        rarity: i.system.rarity,
        alchemicalIndex: i.system.alchemicalIndex
      })),
      diagrams: items.filter(i => i.type === "diagram").map(i => ({
        id: i.id,
        key: i.system.key,
        name: i.name,
        trapType: i.system.trapType,
        rarity: i.system.rarity
      })),
      blueprints: items.filter(i => i.type === "blueprint").map(i => ({
        id: i.id,
        key: i.system.key,
        name: i.name,
        complexity: i.system.complexity,
        art: i.system.art
      })),
      designs: items.filter(i => i.type === "design").map(i => ({
        id: i.id,
        key: i.system.key,
        name: i.name,
        designType: i.system.designType
      }))
    };
  }

  _getActiveProjects() {
    const projects = this.actor?.getFlag?.("tsdc", "activeProjects") || [];
    return projects.map(p => FabricationProgress.fromJSON(p));
  }

  _getCraftingHistory() {
    return this.actor?.getFlag?.("tsdc", "craftingHistory") || [];
  }

  /* -------------------------------------------- */
  /*  Action Handlers                             */
  /* -------------------------------------------- */

  static onClose() {
    this._instance?.close();
  }

  static onSwitchTab(event, btn) {
    this.activeTab = btn?.dataset?.tab || "inventory";
    this.render(false);
  }

  static onNewProject(event, btn) {
    this.wizardStep = 1;
    this.wizardData = {
      type: null,
      recipe: null,
      materials: {},
      quality: 1
    };
    this.render(false);
  }

  static onWizardNext(event, btn) {
    if (this._validateWizardStep()) {
      this.wizardStep++;
      this.render(false);
    } else {
      ui.notifications?.warn("Completa todos los campos requeridos antes de continuar.");
    }
  }

  static onWizardBack(event, btn) {
    if (this.wizardStep > 1) {
      this.wizardStep--;
      this.render(false);
    }
  }

  static onWizardCancel(event, btn) {
    this.wizardStep = 0;
    this.wizardData = {};
    this.render(false);
  }

  static onSelectFabricationType(event, btn) {
    const type = btn?.dataset?.type;
    if (type) {
      this.wizardData.type = type;
      this.render(false);
    }
  }

  static onSelectRecipe(event, btn) {
    const recipeKey = btn?.dataset?.recipeKey;
    if (recipeKey) {
      this.wizardData.recipeKey = recipeKey;
      // TODO: Load recipe details
      this.render(false);
    }
  }

  static onAddMaterial(event, btn) {
    // TODO: Abrir diálogo para seleccionar material del inventario
    console.log("Add material");
  }

  static onRemoveMaterial(event, btn) {
    const materialKey = btn?.dataset?.materialKey;
    if (materialKey && this.wizardData.materials) {
      delete this.wizardData.materials[materialKey];
      this.render(false);
    }
  }

  static onChangeReagentQuality(event, element) {
    const quality = parseInt(element.value);
    if (this.wizardData) {
      this.wizardData.quality = quality;
      this.render(false);
    }
  }

  static async onConfirmProject(event, btn) {
    try {
      await this._createProject();
      this.wizardStep = 0;
      this.wizardData = {};
      this.activeTab = "progress";
      this.render(false);
      ui.notifications?.info("Proyecto iniciado con éxito.");
    } catch (err) {
      console.error("Error al crear proyecto:", err);
      ui.notifications?.error("Error al iniciar el proyecto.");
    }
  }

  static onWorkOnProject(event, btn) {
    const projectId = btn?.dataset?.projectId;
    if (projectId) {
      new WorkSessionDialog(this.actor, projectId).render(true);
    }
  }

  static async onPauseProject(event, btn) {
    const projectId = btn?.dataset?.projectId;
    // TODO: Implement pause
    ui.notifications?.info("Proyecto pausado.");
  }

  static async onCancelProject(event, btn) {
    const projectId = btn?.dataset?.projectId;
    const confirmed = await foundry.applications.api.DialogV2.confirm({
      window: { title: "Cancelar Proyecto" },
      content: "<p>¿Estás seguro de que quieres cancelar este proyecto? Los materiales no serán recuperados.</p>",
      yes: { label: "Cancelar Proyecto" },
      no: { label: "Volver" }
    });

    if (confirmed) {
      const projects = this.actor.getFlag("tsdc", "activeProjects") || [];
      const filtered = projects.filter(p => p.id !== projectId);
      await this.actor.setFlag("tsdc", "activeProjects", filtered);
      this.render(false);
      ui.notifications?.info("Proyecto cancelado.");
    }
  }

  static onMaterialDetail(event, btn) {
    const materialId = btn?.dataset?.materialId;
    // TODO: Abrir diálogo con detalles del material
    console.log("Material detail:", materialId);
  }

  static onToolDetail(event, btn) {
    const toolId = btn?.dataset?.toolId;
    // TODO: Abrir diálogo con detalles de la herramienta
    console.log("Tool detail:", toolId);
  }

  /* -------------------------------------------- */
  /*  Validation & Project Creation               */
  /* -------------------------------------------- */

  _validateWizardStep() {
    switch (this.wizardStep) {
      case 1:
        return this.wizardData.type !== null;
      case 2:
        return this.wizardData.recipeKey !== null;
      case 3:
        return this._validateMaterials();
      default:
        return true;
    }
  }

  _validateMaterials() {
    // TODO: Validar materiales según el tipo de fabricación
    return true;
  }

  async _createProject() {
    const type = this.wizardData.type;
    const recipeKey = this.wizardData.recipeKey;

    // TODO: Implementar creación de proyecto
    const progress = Fabrication.startFabrication(type, recipeKey, 10, "alquimia", "fundamentos");

    const projects = this.actor.getFlag("tsdc", "activeProjects") || [];
    projects.push({
      ...progress.toJSON(),
      name: recipeKey,
      createdAt: new Date().toISOString()
    });

    await this.actor.setFlag("tsdc", "activeProjects", projects);
    return progress;
  }

  /* -------------------------------------------- */
  /*  Static Instance Management                  */
  /* -------------------------------------------- */

  static openForActor(actorId) {
    const actor = game.actors?.get?.(actorId);
    if (!actor) return ui.notifications?.warn("Actor no encontrado.");

    const canOpen = game.user.isGM ||
      actor.isOwner ||
      actor.testUserPermission?.(game.user, "OWNER") ||
      actor.testUserPermission?.(game.user, CONST.DOCUMENT_OWNERSHIP_LEVELS.OWNER);

    if (!canOpen) return ui.notifications?.warn("No tienes permiso para abrir el taller de este personaje.");

    if (!this._instances) this._instances = new Map();
    let app = this._instances.get(actorId);
    if (!app) {
      app = new this(actorId);
      this._instances.set(actorId, app);
    }
    app.render(true);
    return app;
  }

  static openForCurrentUser() {
    const tk = canvas.tokens?.controlled?.[0] ?? null;
    if (tk?.actor) return this.openForActor(tk.actor.id);
    const a = game.user?.character ?? null;
    if (a) return this.openForActor(a.id);
    ui.notifications?.warn("No hay token seleccionado ni personaje asignado al usuario.");
    return null;
  }
}

/* -------------------------------------------- */
/*  Work Session Dialog                         */
/* -------------------------------------------- */

class WorkSessionDialog extends foundry.applications.api.DialogV2 {
  constructor(actor, projectId, options = {}) {
    // Obtener info del proyecto
    const projects = actor.getFlag("tsdc", "activeProjects") || [];
    const project = projects.find(p => p.id === projectId);

    super({
      window: { title: "Sesión de Trabajo" },
      content: `
        <div class="work-session-dialog">
          <h3>${project?.name || "Proyecto"}</h3>
          <p><strong>Arte requerida:</strong> ${project?.artKey || "N/A"}</p>
          <p><strong>Dificultad:</strong> ${project?.difficulty || "fundamentos"}</p>
          <p><strong>Progreso:</strong> ${project?.hoursCompleted || 0}/${project?.totalHours || 0} horas</p>

          <div class="form-group">
            <label>Horas de trabajo:</label>
            <input type="range" name="hours" min="1" max="6" value="2" class="hours-slider">
            <span class="hours-display">2h</span>
          </div>

          <div class="roll-mode-selection">
            <h4>Modo de Tirada</h4>
            <div class="mode-options">
              <label class="mode-option">
                <input type="radio" name="roll-mode" value="normal" checked>
                <div class="mode-card">
                  <i class="fas fa-dice"></i>
                  <span class="mode-name">Normal</span>
                  <span class="mode-desc">1d10 estándar</span>
                </div>
              </label>
              <label class="mode-option">
                <input type="radio" name="roll-mode" value="ejecucion">
                <div class="mode-card">
                  <i class="fas fa-bullseye"></i>
                  <span class="mode-name">Ejecución</span>
                  <span class="mode-desc">2d10, tomar el mayor</span>
                </div>
              </label>
              <label class="mode-option">
                <input type="radio" name="roll-mode" value="aprender">
                <div class="mode-card">
                  <i class="fas fa-book-open"></i>
                  <span class="mode-name">Aprender</span>
                  <span class="mode-desc">2d10, tomar el menor</span>
                </div>
              </label>
            </div>
          </div>

          <p class="info">
            <i class="fas fa-info-circle"></i>
            Se realizará una tirada de Arte al inicio. Si eliges <strong>Aprender</strong> y pasas, ganarás progreso en la competencia.
          </p>

          <style>
            .work-session-dialog {
              padding: 1rem;
            }
            .work-session-dialog h3 {
              margin: 0 0 1rem 0;
              color: #d4af77;
            }
            .work-session-dialog p {
              margin: 0.5rem 0;
            }
            .form-group {
              margin: 1.5rem 0;
            }
            .form-group label {
              display: block;
              margin-bottom: 0.5rem;
              font-weight: bold;
            }
            .hours-slider {
              width: 100%;
            }
            .hours-display {
              display: inline-block;
              margin-left: 1rem;
              font-weight: bold;
              color: #d4af77;
            }
            .roll-mode-selection {
              background: rgba(139, 111, 71, 0.1);
              border: 1px solid #8b6f47;
              border-radius: 6px;
              padding: 1rem;
              margin: 1.5rem 0;
            }
            .roll-mode-selection h4 {
              margin: 0 0 1rem 0;
              color: #d4af77;
            }
            .mode-options {
              display: grid;
              grid-template-columns: repeat(3, 1fr);
              gap: 0.75rem;
            }
            .mode-option {
              cursor: pointer;
              display: block;
            }
            .mode-option input[type="radio"] {
              display: none;
            }
            .mode-card {
              background: rgba(0, 0, 0, 0.3);
              border: 2px solid #8b6f47;
              border-radius: 6px;
              padding: 1rem;
              text-align: center;
              transition: all 0.2s;
              display: flex;
              flex-direction: column;
              gap: 0.5rem;
            }
            .mode-option:hover .mode-card {
              border-color: #d4af77;
              background: rgba(139, 111, 71, 0.15);
            }
            .mode-option input:checked + .mode-card {
              border-color: #d4af77;
              background: rgba(139, 111, 71, 0.25);
              box-shadow: 0 0 8px rgba(212, 175, 119, 0.3);
            }
            .mode-card i {
              font-size: 1.5rem;
              color: #d4af77;
            }
            .mode-name {
              font-weight: bold;
              color: #f5e6d3;
            }
            .mode-desc {
              font-size: 0.8rem;
              color: #b8a58f;
            }
            .info {
              font-size: 0.9rem;
              color: #b8a58f;
              font-style: italic;
              margin-top: 1rem;
            }
          </style>
        </div>
      `,
      buttons: [
        {
          action: "work",
          icon: "fas fa-hammer",
          label: "Trabajar",
          callback: (event, btn, dialog) => this._onWork(dialog, actor, projectId)
        },
        {
          action: "cancel",
          icon: "fas fa-times",
          label: "Cancelar"
        }
      ],
      default: "work"
    }, options);

    this.actor = actor;
    this.projectId = projectId;
    this.project = project;
  }

  render(force, options) {
    super.render(force, options);

    // Agregar listener al slider después del render
    setTimeout(() => {
      const slider = this.element?.querySelector('.hours-slider');
      const display = this.element?.querySelector('.hours-display');
      if (slider && display) {
        slider.addEventListener('input', (e) => {
          display.textContent = `${e.target.value}h`;
        });
      }
    }, 100);
  }

  async _onWork(dialog, actor, projectId) {
    const hours = parseInt(dialog.element.querySelector('[name="hours"]')?.value || 2);
    const rollMode = dialog.element.querySelector('input[name="roll-mode"]:checked')?.value || 'normal';

    // Obtener proyecto actualizado
    const projects = actor.getFlag("tsdc", "activeProjects") || [];
    const projectIndex = projects.findIndex(p => p.id === projectId);
    if (projectIndex === -1) {
      ui.notifications?.error("Proyecto no encontrado.");
      return;
    }

    const project = projects[projectIndex];

    // Realizar tirada de Arte
    await this._performArtRoll(actor, project, hours, rollMode);
  }

  async _performArtRoll(actor, project, hours, rollMode) {
    const artKey = project.artKey; // herreria, sastreria, alquimia, trampero, ingenieria
    const difficulty = project.difficulty || "fundamentos";

    // Obtener skill del actor
    const skillData = actor.system?.progression?.skills?.[artKey];
    if (!skillData) {
      ui.notifications?.error(`No tienes la competencia ${artKey}.`);
      return;
    }

    // Obtener modificador del atributo (Artes y Oficios usa Astucia o Intelecto según el arte)
    const attrKey = this._getAttributeForArt(artKey);
    const attrMod = Number(actor.system?.attributes?.[attrKey] || 0);
    const skillLevel = Number(skillData.level || 0);
    const skillRank = Number(skillData.rank || 0);
    const totalMod = attrMod + skillLevel + skillRank;

    // Construir fórmula según modo
    let formula;
    let modeName;
    if (rollMode === 'ejecucion') {
      formula = `1d10 + ${totalMod}`;
      modeName = "Ejecución";
    } else if (rollMode === 'aprender') {
      formula = `1d10 + ${totalMod}`;
      modeName = "Aprender";
    } else {
      formula = `1d10 + ${totalMod}`;
      modeName = "Normal";
    }

    // Realizar tirada
    const roll = new Roll(formula);
    await roll.evaluate();

    // Obtener DC
    const dc = getDifficultyDC(difficulty);
    const success = roll.total >= dc;

    // Mensaje en chat
    await ChatMessage.create({
      user: game.user.id,
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `
        <div class="tsdc craft-roll ${success ? 'success' : 'failure'}">
          <h3>🔨 Tirada de Fabricación</h3>
          <p><strong>${actor.name}</strong> trabaja en <strong>${project.name}</strong></p>
          <div class="roll-details">
            <p>Arte: <strong>${artKey}</strong></p>
            <p>Modo: <strong>${modeName}</strong></p>
            <p>Dificultad: <strong>${difficulty}</strong> (DC ${dc})</p>
            <p>Tirada: ${roll.total} = ${formula}</p>
            <p class="result ${success ? 'success' : 'failure'}">
              ${success ? '✅ <strong>Éxito</strong>' : '❌ <strong>Fallo</strong>'}
            </p>
          </div>
        </div>
      `
    });

    // Aplicar progreso en modo aprendizaje
    if (rollMode === 'aprender' && success) {
      try {
        const result = await addProgress(actor, "skills", artKey, 1);
        if (result?.leveled) {
          ui.notifications?.info(`¡Has mejorado tu nivel de ${artKey}! Ahora estás en nivel ${result.level} (Rango ${result.rank}).`);

          await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `
              <div class="tsdc skill-progress">
                <h3>📚 Progreso de ${artKey}</h3>
                <p><strong>${actor.name}</strong> ha subido de nivel!</p>
                <p>Nivel: <strong>${result.level}</strong> (Rango ${result.rank})</p>
              </div>
            `
          });
        } else {
          const { trackThreshold } = await import("../progression.js");
          const threshold = trackThreshold(actor, "skills", artKey);
          ui.notifications?.info(`Has ganado progreso en ${artKey} (${result?.progress || 0}/${threshold}).`);
        }
      } catch (err) {
        console.error("TSDC | Error aplicando progreso de arte:", err);
      }
    }

    // Actualizar progreso del proyecto si tuvo éxito
    if (success) {
      const projects = actor.getFlag("tsdc", "activeProjects") || [];
      const projectIndex = projects.findIndex(p => p.id === project.id);

      if (projectIndex !== -1) {
        projects[projectIndex].hoursCompleted = (projects[projectIndex].hoursCompleted || 0) + hours;

        if (projects[projectIndex].hoursCompleted >= projects[projectIndex].totalHours) {
          // Proyecto completado
          projects[projectIndex].status = "completed";
          ui.notifications?.info(`¡Proyecto completado! ${project.name} está listo.`);

          await ChatMessage.create({
            user: game.user.id,
            speaker: ChatMessage.getSpeaker({ actor }),
            content: `
              <div class="tsdc project-completed">
                <h3>✨ Proyecto Completado</h3>
                <p><strong>${actor.name}</strong> ha completado <strong>${project.name}</strong>!</p>
                <p>Tiempo total: ${projects[projectIndex].hoursCompleted} horas</p>
              </div>
            `
          });
        } else {
          ui.notifications?.info(`Progreso: ${projects[projectIndex].hoursCompleted}/${projects[projectIndex].totalHours} horas completadas.`);
        }

        await actor.setFlag("tsdc", "activeProjects", projects);
      }
    } else {
      ui.notifications?.warn("La tirada falló. No se ha añadido progreso al proyecto.");
    }
  }

  _getAttributeForArt(artKey) {
    // Mapeo de artes a atributos
    const artAttributeMap = {
      herreria: "strength",      // Herrería usa Fuerza
      sastreria: "cunning",       // Sastrería usa Astucia
      alquimia: "intellect",      // Alquimia usa Intelecto
      trampero: "cunning",        // Trampero usa Astucia
      ingenieria: "intellect",    // Ingeniería usa Intelecto
      joyeria: "cunning",         // Joyería usa Astucia
      cocina: "wisdom"            // Cocina usa Sabiduría
    };

    return artAttributeMap[artKey] || "intellect";
  }
}

/* -------------------------------------------- */
/*  HUD & Scene Controls Integration            */
/* -------------------------------------------- */

function canOpenWorkshopForActor(actor) {
  if (!actor) return false;
  const OWNER = (CONST?.DOCUMENT_OWNERSHIP_LEVELS?.OWNER ?? 3);
  return game.user.isGM ||
    actor.isOwner ||
    actor.testUserPermission?.(game.user, "OWNER") ||
    actor.testUserPermission?.(game.user, OWNER);
}

function getLiveHudRoot() {
  return document.querySelector('#token-hud.placeable-hud');
}

function insertWorkshopBtn() {
  const root = getLiveHudRoot();
  if (!root) return false;

  const grimoireBtn = root.querySelector('.control-icon.tsdc-grimoire');
  const combatBtn =
    root.querySelector('.control-icon i[class*="sword"]')?.closest('.control-icon') ||
    root.querySelector('.control-icon[data-action*="combat"]') ||
    root.querySelector('.control-icon.combat') ||
    null;

  const refIcon = grimoireBtn || combatBtn || root.querySelector('.control-icon');
  if (!refIcon) return false;

  const container = refIcon.parentElement;
  if (!container) return false;

  const actor = ui?.tokens?.control?.object?.actor
    ?? canvas.tokens?.controlled?.[0]?.actor
    ?? game.user?.character
    ?? null;
  if (!canOpenWorkshopForActor(actor)) return true;

  if (container.querySelector('.control-icon.tsdc-workshop')) return true;

  const tag = (refIcon.tagName || 'BUTTON').toLowerCase();
  const btn = document.createElement(tag);
  btn.className = 'control-icon tsdc-workshop';
  btn.dataset.action = 'tsdc-workshop';
  btn.title = 'Abrir Taller de Fabricación';
  btn.setAttribute('data-tooltip', 'Abrir Taller de Fabricación');
  btn.innerHTML = '<i class="fa-solid fa-hammer"></i>';
  btn.addEventListener('click', () => {
    CraftingWorkshop.openForActor(actor.id);
  });

  const insertAfter = grimoireBtn || combatBtn;
  insertAfter?.nextSibling
    ? container.insertBefore(btn, insertAfter.nextSibling)
    : container.appendChild(btn);

  console.log('TSDC | HUD: botón Taller insertado');
  return true;
}

function scheduleHudInsert() {
  const delays = [0, 16, 50, 120, 250, 500, 1000];
  let done = false;
  delays.forEach(d => setTimeout(() => { if (!done) done = insertWorkshopBtn(); }, d));
}

export function registerWorkshopSceneControl(arg) {
  const controls = Array.isArray(arg) ? arg : (arg?.controls ?? []);
  const tokenCtl = controls?.find(c => c.name === 'token');
  if (!tokenCtl) return;
  tokenCtl.tools ??= [];
  if (tokenCtl.tools.some(t => t.name === 'tsdc-workshop')) return;

  tokenCtl.tools.push({
    name: 'tsdc-workshop',
    title: 'Abrir Taller de Fabricación',
    icon: 'fas fa-hammer',
    button: true,
    visible: true,
    onClick: () => {
      const tk = canvas.tokens?.controlled?.[0];
      const actor = tk?.actor ?? game.user?.character;
      if (!actor) return ui.notifications.warn('Selecciona tu token o asigna tu actor.');
      CraftingWorkshop.openForActor(actor.id);
    }
  });
}

export function registerWorkshopHUD() {
  Hooks.on('renderTokenHUD', scheduleHudInsert);
  Hooks.on('renderTokenHUDV2', scheduleHudInsert);
  Hooks.on('refreshTokenHUD', scheduleHudInsert);
  Hooks.on('controlToken', scheduleHudInsert);
  console.log('TSDC | Workshop HUD hooks registered');
}
