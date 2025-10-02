// modules/apps/gm-grant-dialog.js
// Diálogo para que el GM otorgue items, maniobras, etc. a los jugadores

import { WEAPONS_CATALOG, ARMOR_CATALOG, WEAPON_TYPES, ARMOR_TYPES } from "../data/weapons-armor-catalog.js";
import { addItem } from "../features/inventory/index.js";
import { getMaterialStats } from "../features/materials/index.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/**
 * Diálogo para otorgar contenido a jugadores
 */
export class GMGrantDialog extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS = {
    id: "tsdc-gm-grant-dialog",
    classes: ["tsdc", "gm-grant-dialog"],
    window: {
      icon: "fa-solid fa-gift",
      title: "Otorgar Items y Contenido",
      resizable: true
    },
    position: {
      width: 800,
      height: 700
    },
    actions: {
      close: GMGrantDialog.onClose,
      "select-category": GMGrantDialog.onSelectCategory,
      "select-subcategory": GMGrantDialog.onSelectSubcategory,
      "grant-item": GMGrantDialog.onGrantItem,
      "create-custom": GMGrantDialog.onCreateCustom
    }
  };

  static PARTS = {
    body: {
      template: "systems/tsdc/templates/apps/gm-grant-dialog.hbs"
    }
  };

  constructor(options = {}) {
    super(options);
    this.selectedCategory = "weapons";
    this.selectedSubcategory = null; // Para categorías con subcategorías
    this.selectedPlayers = new Set();
    this.searchQuery = ""; // Para búsqueda de items
  }

  get title() {
    return "Otorgar Items y Contenido";
  }

  async _prepareContext(options) {
    let items = await this._getItemsForCategory(this.selectedCategory, this.selectedSubcategory);

    // Filtrar por búsqueda si hay query
    if (this.searchQuery && this.searchQuery.trim()) {
      const query = this.searchQuery.toLowerCase().trim();
      items = items.filter(item =>
        item.label.toLowerCase().includes(query) ||
        (item.info && item.info.toLowerCase().includes(query))
      );
    }

    const context = {
      category: this.selectedCategory,
      subcategory: this.selectedSubcategory,
      players: this._getPlayers(),
      items: items,
      subcategories: this._getSubcategories(this.selectedCategory),
      searchQuery: this.searchQuery
    };

    return context;
  }

  _getSubcategories(category) {
    if (category === "weapons") {
      // Tipos de armas
      return Object.entries(WEAPON_TYPES).map(([key, label]) => ({
        key, label, selected: this.selectedSubcategory === key
      }));
    } else if (category === "armor") {
      // Tipos de armaduras
      return Object.entries(ARMOR_TYPES).map(([key, label]) => ({
        key, label, selected: this.selectedSubcategory === key
      }));
    } else if (category === "designs") {
      // Diseños: Armas, Armaduras y Joyas
      return [
        { key: "weapons", label: "Armas", selected: this.selectedSubcategory === "weapons" },
        { key: "armor", label: "Armaduras", selected: this.selectedSubcategory === "armor" },
        { key: "jewelry", label: "Joyas", selected: this.selectedSubcategory === "jewelry" }
      ];
    }
    return [];
  }

  _getPlayers() {
    const players = [];
    const addedCharacters = new Set();

    // Añadir personajes de usuarios conectados
    for (const user of game.users) {
      if (!user.isGM && user.character) {
        players.push({
          id: user.id,
          name: user.name,
          characterName: user.character.name,
          characterId: user.character.id,
          selected: this.selectedPlayers.has(user.character.id)
        });
        addedCharacters.add(user.character.id);
      }
    }

    // Añadir todos los personajes tipo "character" que no son de GM
    for (const actor of game.actors) {
      if (actor.type === "character" && !addedCharacters.has(actor.id)) {
        const owner = game.users.find(u => !u.isGM && actor.testUserPermission(u, "OWNER"));
        players.push({
          id: owner?.id || "none",
          name: owner?.name || "Sin jugador",
          characterName: actor.name,
          characterId: actor.id,
          selected: this.selectedPlayers.has(actor.id)
        });
        addedCharacters.add(actor.id);
      }
    }

    return players;
  }

  async _getItemsForCategory(category, subcategory = null) {
    const items = [];

    switch (category) {
      case "weapons":
        // Armas ya creadas (con selección de material)
        for (const [key, data] of Object.entries(WEAPONS_CATALOG)) {
          if (subcategory && data.type !== subcategory) continue;
          items.push({
            key,
            label: data.label,
            type: "weapon",
            subtype: data.type,
            info: `${data.hands}H, ${data.damage}, ${data.reach}`,
            needsMaterial: true  // Indica que necesita selección de material
          });
        }
        break;

      case "armor":
        // Armaduras ya creadas (con selección de material)
        for (const [key, data] of Object.entries(ARMOR_CATALOG)) {
          if (subcategory && data.type !== subcategory) continue;
          items.push({
            key,
            label: data.label,
            type: "armor",
            subtype: data.type,
            info: `${data.category}, ${data.weight}`,
            needsMaterial: true  // Indica que necesita selección de material
          });
        }
        break;

      case "jewelry":
        // Joyas ya creadas (con selección de material)
        items.push(
          { key: "insignia", label: "Insignia", type: "jewelry", info: "+1/grado a Negociación/Liderazgo", needsMaterial: true },
          { key: "amulet", label: "Amuleto", type: "jewelry", info: "+1/grado a Aguante/Cordura/Preparación", needsMaterial: true },
          { key: "pendant", label: "Colgante", type: "jewelry", info: "Usar objetos sin Interactuar", needsMaterial: true }
        );
        break;

      case "designs":
        // Diseños de Armas, Armaduras y Joyas (Herrería/Sastrería/Joyería)
        if (!subcategory || subcategory === "weapons") {
          // Diseños de armas desde el catálogo
          for (const [key, data] of Object.entries(WEAPONS_CATALOG)) {
            items.push({
              key: `design_${key}`,
              label: `Diseño: ${data.label}`,
              type: "design",
              designType: "weapon",
              art: "herreria",
              info: `${data.hands}H, ${data.damage}, ${data.reach}`
            });
          }
        }
        if (!subcategory || subcategory === "armor") {
          // Diseños de armaduras desde el catálogo
          for (const [key, data] of Object.entries(ARMOR_CATALOG)) {
            items.push({
              key: `design_${key}`,
              label: `Diseño: ${data.label}`,
              type: "design",
              designType: "armor",
              art: data.type === "peto" || data.type === "pantalones" || data.type === "botas" || data.type === "brazales" || data.type === "casco" ? "sastreria" : "herreria",
              info: `${data.category}, ${data.weight}`
            });
          }
        }
        if (!subcategory || subcategory === "jewelry") {
          // Diseños de joyas
          items.push(
            { key: "design_insignia", label: "Diseño: Insignia", type: "design", designType: "jewelry", art: "joyeria" },
            { key: "design_amulet", label: "Diseño: Amuleto", type: "design", designType: "jewelry", art: "joyeria" },
            { key: "design_pendant", label: "Diseño: Colgante", type: "design", designType: "jewelry", art: "joyeria" }
          );
        }
        break;

      case "materials":
        items.push(
          { key: "piel_de_lobo", label: "Piel de Lobo", type: "material", category: "piel" },
          { key: "colmillo_afilado", label: "Colmillo Afilado", type: "material", category: "hueso" },
          { key: "hierro_crudo", label: "Hierro Crudo", type: "material", category: "mineral" },
          { key: "madera_noble", label: "Madera Noble", type: "material", category: "madera" }
        );
        break;

      case "formulas":
        // Fórmulas de Alquimia (Elixires y Venenos)
        items.push(
          // === ELIXIRES CURATIVOS ===
          { key: "elixir_curacion_menor", label: "Elixir de Curación Menor", type: "formula", formulaType: "elixir", rarity: "comun",
            info: "Restaura 2d6 HP, Fundamentos" },
          { key: "elixir_curacion", label: "Elixir de Curación", type: "formula", formulaType: "elixir", rarity: "comun",
            info: "Restaura 4d6 HP, Riguroso" },
          { key: "elixir_curacion_mayor", label: "Elixir de Curación Mayor", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "Restaura 6d6 HP, Exigente" },
          { key: "elixir_curacion_superior", label: "Elixir de Curación Superior", type: "formula", formulaType: "elixir", rarity: "excepcional",
            info: "Restaura 8d6 HP, Extremo" },

          // === ANTÍDOTOS ===
          { key: "antidoto_basico", label: "Antídoto Básico", type: "formula", formulaType: "elixir", rarity: "comun",
            info: "Neutraliza venenos comunes, Fundamentos" },
          { key: "antidoto_potente", label: "Antídoto Potente", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "Neutraliza venenos raros, Riguroso" },
          { key: "antidoto_universal", label: "Antídoto Universal", type: "formula", formulaType: "elixir", rarity: "excepcional",
            info: "Neutraliza cualquier veneno, Extremo" },

          // === ELIXIRES DE ATRIBUTOS ===
          { key: "elixir_fuerza", label: "Elixir de Fuerza", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "+2 Fuerza por 1 hora, Riguroso" },
          { key: "elixir_agilidad", label: "Elixir de Agilidad", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "+2 Agilidad por 1 hora, Riguroso" },
          { key: "elixir_tenacidad", label: "Elixir de Tenacidad", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "+2 Tenacidad por 1 hora, Riguroso" },
          { key: "elixir_astucia", label: "Elixir de Astucia", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "+2 Astucia por 1 hora, Riguroso" },
          { key: "elixir_sabiduria", label: "Elixir de Sabiduría", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "+2 Sabiduría por 1 hora, Riguroso" },
          { key: "elixir_intelecto", label: "Elixir de Intelecto", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "+2 Intelecto por 1 hora, Riguroso" },

          // === ELIXIRES DE RESISTENCIA ===
          { key: "elixir_resistencia_fuego", label: "Elixir de Resistencia al Fuego", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "Resistencia +3 vs Fuego por 1 hora, Riguroso" },
          { key: "elixir_resistencia_hielo", label: "Elixir de Resistencia al Hielo", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "Resistencia +3 vs Agua por 1 hora, Riguroso" },
          { key: "elixir_resistencia_veneno", label: "Elixir de Resistencia al Veneno", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "Resistencia +3 vs Veneno por 1 hora, Riguroso" },
          { key: "elixir_resistencia_oscuridad", label: "Elixir de Resistencia a la Oscuridad", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "Resistencia +3 vs Oscuridad por 1 hora, Riguroso" },

          // === ELIXIRES ESPECIALES ===
          { key: "elixir_vision_nocturna", label: "Elixir de Visión Nocturna", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "Visión en oscuridad por 4 horas, Riguroso" },
          { key: "elixir_respiracion_acuatica", label: "Elixir de Respiración Acuática", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "Respirar bajo agua por 2 horas, Riguroso" },
          { key: "elixir_invisibilidad", label: "Elixir de Invisibilidad", type: "formula", formulaType: "elixir", rarity: "excepcional",
            info: "Invisibilidad por 10 minutos, Extremo" },
          { key: "elixir_velocidad", label: "Elixir de Velocidad", type: "formula", formulaType: "elixir", rarity: "raro",
            info: "+2 metros de movimiento por 1 hora, Riguroso" },
          { key: "elixir_levitacion", label: "Elixir de Levitación", type: "formula", formulaType: "elixir", rarity: "excepcional",
            info: "Levitar por 30 minutos, Extremo" },

          // === VENENOS - DAÑO ===
          { key: "veneno_debilitante", label: "Veneno Debilitante", type: "formula", formulaType: "veneno", rarity: "comun",
            info: "2d6 daño veneno, Fundamentos" },
          { key: "veneno_mortal", label: "Veneno Mortal", type: "formula", formulaType: "veneno", rarity: "raro",
            info: "4d6 daño veneno, Riguroso" },
          { key: "veneno_letal", label: "Veneno Letal", type: "formula", formulaType: "veneno", rarity: "excepcional",
            info: "6d6 daño veneno, Exigente" },

          // === VENENOS - EFECTOS ===
          { key: "veneno_paralizante", label: "Veneno Paralizante", type: "formula", formulaType: "veneno", rarity: "raro",
            info: "Paraliza por 1d4 turnos, Riguroso" },
          { key: "veneno_ceguera", label: "Veneno Cegador", type: "formula", formulaType: "veneno", rarity: "raro",
            info: "Ceguera por 1d6 turnos, Riguroso" },
          { key: "veneno_confusion", label: "Veneno de Confusión", type: "formula", formulaType: "veneno", rarity: "raro",
            info: "Confusión por 1d4 turnos, Riguroso" },
          { key: "veneno_sueno", label: "Veneno del Sueño", type: "formula", formulaType: "veneno", rarity: "raro",
            info: "Sueño profundo por 2d4 horas, Riguroso" },
          { key: "veneno_amnesia", label: "Veneno de Amnesia", type: "formula", formulaType: "veneno", rarity: "excepcional",
            info: "Olvida últimas 1d6 horas, Extremo" },

          // === VENENOS - REDUCCIÓN DE ATRIBUTOS ===
          { key: "veneno_debilidad", label: "Veneno de Debilidad", type: "formula", formulaType: "veneno", rarity: "comun",
            info: "-2 Fuerza por 1 hora, Fundamentos" },
          { key: "veneno_torpeza", label: "Veneno de Torpeza", type: "formula", formulaType: "veneno", rarity: "comun",
            info: "-2 Agilidad por 1 hora, Fundamentos" },
          { key: "veneno_fragilidad", label: "Veneno de Fragilidad", type: "formula", formulaType: "veneno", rarity: "comun",
            info: "-2 Tenacidad por 1 hora, Fundamentos" },
          { key: "veneno_estupidez", label: "Veneno de Estupidez", type: "formula", formulaType: "veneno", rarity: "comun",
            info: "-2 Intelecto por 1 hora, Fundamentos" }
        );
        break;

      case "diagrams":
        // Diagramas de Trampas (Trampero)
        items.push(
          // === TRAMPAS MECÁNICAS - INMOVILIZACIÓN ===
          { key: "diagrama_trampa_cepo", label: "Diagrama: Trampa de Cepo", type: "diagram", trapType: "mecanica", rarity: "comun",
            info: "Inmoviliza extremidad, 2d6 daño, Fundamentos" },
          { key: "diagrama_trampa_red", label: "Diagrama: Trampa de Red", type: "diagram", trapType: "mecanica", rarity: "comun",
            info: "Atrapa en red, enreda, Fundamentos" },
          { key: "diagrama_trampa_foso", label: "Diagrama: Trampa de Foso", type: "diagram", trapType: "mecanica", rarity: "comun",
            info: "Foso oculto, caída 3d6 daño, Fundamentos" },
          { key: "diagrama_trampa_lazos", label: "Diagrama: Trampa de Lazos", type: "diagram", trapType: "mecanica", rarity: "comun",
            info: "Lazo que levanta del suelo, Riguroso" },
          { key: "diagrama_trampa_jaula", label: "Diagrama: Trampa de Jaula", type: "diagram", trapType: "mecanica", rarity: "raro",
            info: "Jaula que atrapa, muy resistente, Riguroso" },

          // === TRAMPAS MECÁNICAS - DAÑO ===
          { key: "diagrama_trampa_pinchos", label: "Diagrama: Trampa de Pinchos", type: "diagram", trapType: "mecanica", rarity: "comun",
            info: "Pinchos ocultos, 3d6 daño perforante, Fundamentos" },
          { key: "diagrama_trampa_cuchillas", label: "Diagrama: Trampa de Cuchillas", type: "diagram", trapType: "mecanica", rarity: "raro",
            info: "Cuchillas giratorias, 4d6 daño cortante, Riguroso" },
          { key: "diagrama_trampa_prensa", label: "Diagrama: Trampa de Prensa", type: "diagram", trapType: "mecanica", rarity: "raro",
            info: "Muros que aplastan, 5d6 daño contundente, Riguroso" },
          { key: "diagrama_trampa_guillotina", label: "Diagrama: Trampa Guillotina", type: "diagram", trapType: "mecanica", rarity: "excepcional",
            info: "Hoja descendente, 6d6 daño cortante, Avanzado" },
          { key: "diagrama_trampa_ballestas", label: "Diagrama: Trampa de Ballestas", type: "diagram", trapType: "mecanica", rarity: "raro",
            info: "Múltiples disparos, 3d8 daño perforante, Riguroso" },

          // === TRAMPAS VENENOSAS ===
          { key: "diagrama_trampa_dardo_veneno", label: "Diagrama: Trampa de Dardo Venenoso", type: "diagram", trapType: "veneno", rarity: "comun",
            info: "Dardo con veneno debilitante, Fundamentos" },
          { key: "diagrama_trampa_gas_veneno", label: "Diagrama: Trampa de Gas Venenoso", type: "diagram", trapType: "veneno", rarity: "raro",
            info: "Libera gas tóxico en área, Riguroso" },
          { key: "diagrama_trampa_agujas", label: "Diagrama: Trampa de Agujas Venenosas", type: "diagram", trapType: "veneno", rarity: "raro",
            info: "Múltiples agujas envenenadas, Riguroso" },
          { key: "diagrama_trampa_niebla_paralizante", label: "Diagrama: Trampa de Niebla Paralizante", type: "diagram", trapType: "veneno", rarity: "excepcional",
            info: "Niebla que paraliza, área grande, Avanzado" },

          // === TRAMPAS EXPLOSIVAS ===
          { key: "diagrama_trampa_explosiva_menor", label: "Diagrama: Trampa Explosiva Menor", type: "diagram", trapType: "explosivo", rarity: "raro",
            info: "Explosión pequeña, 3d6 daño fuego, Riguroso" },
          { key: "diagrama_trampa_explosion", label: "Diagrama: Trampa Explosiva", type: "diagram", trapType: "explosivo", rarity: "excepcional",
            info: "Explosión potente, 5d6 daño fuego, Avanzado" },
          { key: "diagrama_trampa_fragmentacion", label: "Diagrama: Trampa de Fragmentación", type: "diagram", trapType: "explosivo", rarity: "excepcional",
            info: "Explosión con metralla, 4d6 fuego + 2d6 perforante, Avanzado" },
          { key: "diagrama_trampa_mina", label: "Diagrama: Trampa Mina Explosiva", type: "diagram", trapType: "explosivo", rarity: "excepcional",
            info: "Mina enterrada, 6d6 daño fuego, Avanzado" },

          // === TRAMPAS ELEMENTALES ===
          { key: "diagrama_trampa_fuego", label: "Diagrama: Trampa de Fuego", type: "diagram", trapType: "elemental", rarity: "raro",
            info: "Llamarada de fuego, 4d6 daño fuego, Riguroso" },
          { key: "diagrama_trampa_hielo", label: "Diagrama: Trampa de Hielo", type: "diagram", trapType: "elemental", rarity: "raro",
            info: "Ráfaga helada, 3d6 daño hielo + ralentiza, Riguroso" },
          { key: "diagrama_trampa_rayo", label: "Diagrama: Trampa de Rayo", type: "diagram", trapType: "elemental", rarity: "excepcional",
            info: "Descarga eléctrica, 5d6 daño rayo, Avanzado" },
          { key: "diagrama_trampa_acido", label: "Diagrama: Trampa de Ácido", type: "diagram", trapType: "elemental", rarity: "raro",
            info: "Rocío ácido, 3d8 daño ácido continuo, Riguroso" },

          // === TRAMPAS MÁGICAS ===
          { key: "diagrama_trampa_ilusion", label: "Diagrama: Trampa de Ilusión", type: "diagram", trapType: "magica", rarity: "raro",
            info: "Crea ilusión confusa, Riguroso" },
          { key: "diagrama_trampa_teletransporte", label: "Diagrama: Trampa de Teletransporte", type: "diagram", trapType: "magica", rarity: "excepcional",
            info: "Teletransporta a ubicación aleatoria, Avanzado" },
          { key: "diagrama_trampa_sueño", label: "Diagrama: Trampa de Sueño", type: "diagram", trapType: "magica", rarity: "raro",
            info: "Induce sueño mágico, Riguroso" },
          { key: "diagrama_trampa_confusion", label: "Diagrama: Trampa de Confusión", type: "diagram", trapType: "magica", rarity: "excepcional",
            info: "Confunde y desorienta, Avanzado" },
          { key: "diagrama_trampa_miedo", label: "Diagrama: Trampa de Miedo", type: "diagram", trapType: "magica", rarity: "raro",
            info: "Causa miedo sobrenatural, Riguroso" },

          // === TRAMPAS DE ALERTA ===
          { key: "diagrama_trampa_alarma", label: "Diagrama: Trampa de Alarma", type: "diagram", trapType: "alerta", rarity: "comun",
            info: "Alarma sonora al activarse, Fundamentos" },
          { key: "diagrama_trampa_señal", label: "Diagrama: Trampa de Señal", type: "diagram", trapType: "alerta", rarity: "comun",
            info: "Señal luminosa visible a distancia, Fundamentos" },
          { key: "diagrama_trampa_marca", label: "Diagrama: Trampa de Marca", type: "diagram", trapType: "alerta", rarity: "raro",
            info: "Marca mágica al intruso, Riguroso" },

          // === TRAMPAS COMPLEJAS ===
          { key: "diagrama_trampa_cascada", label: "Diagrama: Trampa en Cascada", type: "diagram", trapType: "compleja", rarity: "excepcional",
            info: "Activa múltiples trampas en secuencia, Maestro" },
          { key: "diagrama_trampa_laberinto", label: "Diagrama: Trampa Laberinto", type: "diagram", trapType: "compleja", rarity: "excepcional",
            info: "Crea laberinto cambiante, Maestro" },
          { key: "diagrama_trampa_rompecabezas", label: "Diagrama: Trampa Rompecabezas", type: "diagram", trapType: "compleja", rarity: "raro",
            info: "Requiere resolver acertijo, Avanzado" }
        );
        break;

      case "blueprints":
        // Planos de Herramientas y Kits (Ingeniería)
        // Kits de herramientas - todos con 3 grados
        const kits = [
          { key: "kit_costura", label: "Kit de Costura", craft: "sastreria", usos: 10 },
          { key: "kit_tintes", label: "Kit de Tintes y Brochas", craft: "sastreria", usos: 8 },
          { key: "kit_calderos", label: "Kit de Calderos", craft: "alquimia", usos: 6 },
          { key: "kit_orfebreria", label: "Kit de Orfebrería", craft: "joyeria", usos: 16 },
          { key: "kit_pulido", label: "Kit de Pulido", craft: "joyeria", usos: 10 },
          { key: "kit_trampas", label: "Kit de Trampas", craft: "trampero", usos: 10 },
          { key: "kit_placas_base", label: "Kit de Placas Base y Estructuras", craft: "trampero", usos: 8 },
          { key: "kit_sensores", label: "Kit de Sensores y Disparadores", craft: "trampero", usos: 9 },
          { key: "kit_camuflaje", label: "Kit Material de Camuflaje", craft: "trampero", usos: 7 },
          { key: "kit_herboristeria", label: "Kit de Herboristería", craft: "botanica", usos: 15 },
          { key: "kit_talla", label: "Kit de Talla", craft: "escultismo", usos: 15 },
          { key: "kit_cartografia", label: "Kit de Cartografía", craft: "geografia", usos: 10 },
          { key: "kit_reparacion", label: "Kit de Reparación", craft: "herreria", usos: 8 },
          { key: "kit_artillero", label: "Kit de Artillero", craft: "ingenieria", usos: 12 },
          { key: "kit_extraccion", label: "Kit de Extracción", craft: "sanacion", usos: 10 },
          { key: "kit_mineria", label: "Kit de Minería", craft: "mineria", usos: 10 },
          { key: "kit_conservacion", label: "Kit de Conservación", craft: "anatomia", usos: 5 },
          { key: "kit_refinamiento_minerales", label: "Kit de Refinamiento de Minerales", craft: "anatomia", usos: 8 },
          { key: "kit_refinamiento_fibras", label: "Kit de Refinamiento de Fibras", craft: "anatomia", usos: 12 },
          { key: "kit_medico", label: "Kit Médico", craft: "anatomia", usos: 15 },
          { key: "kit_veneno", label: "Kit de Veneno", craft: "anatomia", usos: 8 }
        ];

        for (const kit of kits) {
          items.push(
            { key: `blueprint_${kit.key}_basico`, label: `Plano: ${kit.label} (Básico)`, type: "blueprint", blueprintType: "kit", art: "ingenieria", craft: kit.craft, grade: 1, usos: kit.usos },
            { key: `blueprint_${kit.key}_avanzado`, label: `Plano: ${kit.label} (Avanzado)`, type: "blueprint", blueprintType: "kit", art: "ingenieria", craft: kit.craft, grade: 2, usos: kit.usos * 2 },
            { key: `blueprint_${kit.key}_especializado`, label: `Plano: ${kit.label} (Especializado)`, type: "blueprint", blueprintType: "kit", art: "ingenieria", craft: kit.craft, grade: 3, usos: kit.usos * 3 }
          );
        }
        break;

      case "consumables":
        items.push(
          { key: "pocion_curacion", label: "Poción de Curación", type: "consumable" },
          { key: "antidoto", label: "Antídoto", type: "consumable" },
          { key: "racion_comida", label: "Ración de Comida", type: "consumable" },
          { key: "antorcha", label: "Antorcha", type: "consumable" }
        );
        break;

      case "kits":
        // Kits ya creados (herramientas reales, no planos)
        const kitsList = [
          { key: "kit_herreria", label: "Kit de Herrería", craft: "herreria", usos: 20 },
          { key: "kit_costura", label: "Kit de Costura", craft: "sastreria", usos: 10 },
          { key: "kit_tintes", label: "Kit de Tintes y Brochas", craft: "sastreria", usos: 8 },
          { key: "kit_calderos", label: "Kit de Calderos", craft: "alquimia", usos: 6 },
          { key: "kit_orfebreria", label: "Kit de Orfebrería", craft: "joyeria", usos: 16 },
          { key: "kit_pulido", label: "Kit de Pulido", craft: "joyeria", usos: 10 },
          { key: "kit_trampas", label: "Kit de Trampas", craft: "trampero", usos: 10 },
          { key: "kit_placas_base", label: "Kit de Placas Base", craft: "trampero", usos: 8 },
          { key: "kit_sensores", label: "Kit de Sensores", craft: "trampero", usos: 9 },
          { key: "kit_camuflaje", label: "Kit de Camuflaje", craft: "trampero", usos: 7 },
          { key: "kit_herboristeria", label: "Kit de Herboristería", craft: "botanica", usos: 15 },
          { key: "kit_talla", label: "Kit de Talla", craft: "escultismo", usos: 15 },
          { key: "kit_cartografia", label: "Kit de Cartografía", craft: "geografia", usos: 10 },
          { key: "kit_reparacion", label: "Kit de Reparación", craft: "herreria", usos: 8 },
          { key: "kit_artillero", label: "Kit de Artillero", craft: "ingenieria", usos: 12 },
          { key: "kit_extraccion", label: "Kit de Extracción", craft: "sanacion", usos: 10 },
          { key: "kit_mineria", label: "Kit de Minería", craft: "mineria", usos: 10 },
          { key: "kit_conservacion", label: "Kit de Conservación", craft: "anatomia", usos: 5 },
          { key: "kit_refinamiento_minerales", label: "Kit de Refinamiento Minerales", craft: "anatomia", usos: 8 },
          { key: "kit_refinamiento_fibras", label: "Kit de Refinamiento Fibras", craft: "anatomia", usos: 12 },
          { key: "kit_medico", label: "Kit Médico", craft: "anatomia", usos: 15 },
          { key: "kit_veneno", label: "Kit de Veneno", craft: "anatomia", usos: 8 }
        ];

        for (const kit of kitsList) {
          // Cada kit en 3 grados
          items.push(
            { key: kit.key, label: `${kit.label} (Básico)`, type: "tool", craft: kit.craft, grade: 1, usos: kit.usos, info: `${kit.usos} usos` },
            { key: kit.key, label: `${kit.label} (Avanzado)`, type: "tool", craft: kit.craft, grade: 2, usos: kit.usos * 2, info: `${kit.usos * 2} usos` },
            { key: kit.key, label: `${kit.label} (Especializado)`, type: "tool", craft: kit.craft, grade: 3, usos: kit.usos * 3, info: `${kit.usos * 3} usos` }
          );
        }
        break;

      case "relics":
        // Reliquias Taumáticas (Tauma)
        items.push(
          { key: "espada_de_llamas", label: "Espada de Llamas", type: "tauma", taumaType: "weapon", rarity: "raro", element: "fire", level: 1, info: "Reliquia de fuego nivel 1" },
          { key: "escudo_de_hielo", label: "Escudo de Hielo", type: "tauma", taumaType: "armor", rarity: "raro", element: "water", level: 1, info: "Reliquia de hielo nivel 1" },
          { key: "anillo_sombrio", label: "Anillo Sombrío", type: "tauma", taumaType: "artifact", rarity: "excepcional", element: "dark", level: 2, info: "Reliquia de oscuridad nivel 2" },
          { key: "amuleto_luz", label: "Amuleto de Luz", type: "tauma", taumaType: "artifact", rarity: "raro", element: "light", level: 1, info: "Reliquia de luz nivel 1" },
          { key: "baston_tierra", label: "Bastón de la Tierra", type: "tauma", taumaType: "weapon", rarity: "excepcional", element: "earth", level: 2, info: "Reliquia de tierra nivel 2" }
        );
        break;

      case "thauma":
        items.push(
          { key: "cristal_de_tauma", label: "Cristal de Tauma", type: "generic" },
          { key: "gema_resonante", label: "Gema Resonante", type: "generic" },
          { key: "reliquia_taumatica", label: "Reliquia Taumática", type: "generic" }
        );
        break;

      case "maneuvers":
        items.push(
          { key: "estocada_rapida", label: "Estocada Rápida", type: "maneuver" },
          { key: "golpe_poderoso", label: "Golpe Poderoso", type: "maneuver" },
          { key: "finta", label: "Finta", type: "maneuver" },
          { key: "carga", label: "Carga", type: "maneuver" }
        );
        break;
    }

    return items;
  }

  static async onClose(event, target) {
    this.close();
  }

  static async onSelectCategory(event, target) {
    const category = target.dataset.category;
    if (!category) return;

    this.selectedCategory = category;
    this.selectedSubcategory = null; // Reset subcategory
    await this.render();
  }

  static async onSelectSubcategory(event, target) {
    const subcategory = target.dataset.subcategory;
    if (!subcategory) return;

    this.selectedSubcategory = subcategory;
    await this.render();
  }

  _onRender(context, options) {
    super._onRender?.(context, options);

    // Attach search input listener with debounce
    const searchInput = this.element.querySelector('input[name="search-query"]');
    if (searchInput) {
      let debounceTimer;
      searchInput.addEventListener('input', (event) => {
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
          this.searchQuery = event.target.value || "";
          this.render();
        }, 300); // 300ms debounce
      });
    }
  }

  static async onGrantItem(event, target) {
    const itemKey = target.dataset.itemKey;
    const itemLabel = target.dataset.itemLabel;
    const itemType = target.dataset.itemType;
    const needsMaterial = target.dataset.needsMaterial === "true";

    if (!itemKey) return;

    // Obtener jugadores seleccionados
    const selectedCharacters = [];
    const checkboxes = this.element.querySelectorAll('input[name="player-select"]:checked');

    for (const checkbox of checkboxes) {
      const characterId = checkbox.value;
      const actor = game.actors.get(characterId);
      if (actor) selectedCharacters.push(actor);
    }

    if (selectedCharacters.length === 0) {
      ui.notifications.warn("Selecciona al menos un jugador para otorgar el item.");
      return;
    }

    // Cantidad
    const quantityInput = this.element.querySelector(`input[data-item="${itemKey}"]`);
    const quantity = Number(quantityInput?.value || 1);

    // Si necesita material, pedir selección
    let materialData = null;
    if (needsMaterial) {
      materialData = await GMGrantDialog._selectMaterialDialog(itemType);
      if (!materialData) return; // Cancelado
    }

    // Otorgar item a cada personaje seleccionado
    for (const actor of selectedCharacters) {
      await GMGrantDialog._grantItemToActor(actor, {
        key: itemKey,
        label: itemLabel,
        type: itemType,
        quantity,
        material: materialData?.material,
        grade: materialData?.grade
      });
    }

    ui.notifications.info(
      `${itemLabel} (x${quantity}) otorgado a ${selectedCharacters.map(a => a.name).join(", ")}`
    );
  }

  static async _selectMaterialDialog(itemType) {
    // Lista de materiales según el tipo de item
    const materials = {
      weapon: ["acero", "hierro", "bronce", "mithril", "adamantium", "titanio", "oricalco"],
      armor: ["cuero", "tela", "acero", "hierro", "bronce", "mithril", "adamantium", "titanio", "oricalco"],
      jewelry: ["oro", "plata", "platino", "jade", "rubi", "esmeralda", "zafiro", "diamante"]
    };

    const materialList = materials[itemType] || materials.weapon;

    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Seleccionar Material y Grado" },
      content: `
        <form class="t-col" style="gap:12px;">
          <div class="t-field">
            <label>Material</label>
            <select name="material" required>
              ${materialList.map(m => `<option value="${m}">${m.charAt(0).toUpperCase() + m.slice(1)}</option>`).join('')}
            </select>
          </div>
          <div class="t-field">
            <label>Grado (Calidad)</label>
            <select name="grade" required>
              <option value="1">Grado 1</option>
              <option value="2">Grado 2</option>
              <option value="3">Grado 3</option>
            </select>
          </div>
        </form>
      `,
      ok: {
        label: "Seleccionar",
        callback: (event, button) => {
          const form = button.form;
          return {
            material: form.elements.material.value,
            grade: Number(form.elements.grade.value)
          };
        }
      }
    });

    return result;
  }

  static async _grantItemToActor(actor, itemData) {
    // Items físicos (weapons/armor/jewelry/tools/consumables/materials) van al inventory.bag
    if (itemData.type === "weapon" || itemData.type === "armor" || itemData.type === "jewelry" ||
        itemData.type === "tool" || itemData.type === "consumable" || itemData.type === "material") {

      let bagItem = {
        type: itemData.type,
        key: itemData.key,
        name: itemData.label,
        qty: itemData.quantity || 1
      };

      // Armas/Armaduras/Joyas necesitan material
      if (itemData.type === "weapon" || itemData.type === "armor" || itemData.type === "jewelry") {
        const material = itemData.material || "acero";
        const grade = itemData.grade || 1;
        const stats = getMaterialStats(material, grade);

        bagItem.name = `${itemData.label} de ${material.charAt(0).toUpperCase() + material.slice(1)}`;
        bagItem.material = material;
        bagItem.grade = grade;
        bagItem.durability = stats.durability;
        bagItem.power = stats.potency;

        // Datos específicos de armas
        if (itemData.type === "weapon") {
          const weaponData = WEAPONS_CATALOG[itemData.key];
          if (weaponData) {
            bagItem.hands = weaponData.hands;
            bagItem.damage = weaponData.damage;
            bagItem.reach = weaponData.reach;
          }
        }
        // Datos específicos de armaduras
        else if (itemData.type === "armor") {
          const armorData = ARMOR_CATALOG[itemData.key];
          if (armorData) {
            bagItem.slot = armorData.slot;
            bagItem.category = armorData.category;
            bagItem.weight = armorData.weight;
          }
        }
        // Datos específicos de joyas
        else if (itemData.type === "jewelry") {
          bagItem.type = "jewel"; // El sistema usa "jewel" para joyería
          bagItem.subtype = itemData.key; // insignia, amulet, pendant
        }

        await addItem(actor, bagItem);
        await GMGrantDialog._sendChatMessage(actor, itemData, material, grade);
        return;
      }

      // Kits/Herramientas
      if (itemData.type === "tool") {
        bagItem.craft = itemData.craft || "herreria";
        bagItem.grade = itemData.grade || 1;
        bagItem.uses = itemData.usos || 10;
        bagItem.maxUses = itemData.usos || 10;
        await addItem(actor, bagItem);
        await GMGrantDialog._sendChatMessage(actor, itemData);
        return;
      }

      // Consumibles
      if (itemData.type === "consumable") {
        bagItem.consumableType = itemData.consumableType || "misc";
        bagItem.uses = itemData.uses || 1;
        await addItem(actor, bagItem);
        await GMGrantDialog._sendChatMessage(actor, itemData);
        return;
      }

      // Materiales
      if (itemData.type === "material") {
        bagItem.category = itemData.category || "misc";
        bagItem.quality = itemData.quality || 1;
        bagItem.quantity = itemData.quantity || 1;
        await addItem(actor, bagItem);
        await GMGrantDialog._sendChatMessage(actor, itemData);
        return;
      }
    }

    // Diseños/Fórmulas/Planos/Diagramas/Reliquias son Item documents
    let itemType = "generic";
    let systemData = {
      itemType: itemData.type || "mundane",
      quantity: itemData.quantity || 1,
      description: `Item otorgado por el GM: ${itemData.label}`,
      notes: ""
    };

    if (itemData.type === "formula") {
      itemType = "formula";
      systemData = {
        key: itemData.key,
        formulaType: itemData.formulaType || "elixir",
        rarity: itemData.rarity || "comun",
        learned: true,
        learnedAt: Date.now()
      };
    } else if (itemData.type === "diagram") {
      itemType = "diagram";
      systemData = {
        key: itemData.key,
        trapType: itemData.trapType || "mecanica",
        rarity: itemData.rarity || "comun",
        learned: true,
        learnedAt: Date.now()
      };
    } else if (itemData.type === "blueprint") {
      itemType = "blueprint";
      systemData = {
        key: itemData.key,
        art: itemData.art || "ingenieria",
        blueprintType: itemData.blueprintType || "mecanismo",
        complexity: itemData.complexity || 1,
        learned: true,
        learnedAt: Date.now()
      };
    } else if (itemData.type === "design") {
      itemType = "design";
      systemData = {
        key: itemData.key,
        designType: itemData.designType || "weapon",
        art: itemData.art || "herreria",
        complexity: itemData.complexity || 1,
        learned: true,
        learnedAt: Date.now()
      };
    } else if (itemData.type === "tauma") {
      itemType = "tauma";
      systemData = {
        key: itemData.key,
        taumaType: itemData.taumaType || "artifact",
        rarity: itemData.rarity || "comun",
        taumaLevel: itemData.level || 1,
        element: itemData.element || "none",
        quantity: itemData.quantity || 1,
        weight: 0,
        material: "",
        resonance: 0,
        awakened: false,
        attunement: {
          required: false,
          attunedTo: null
        },
        evolution: {
          stage: 1,
          xp: 0,
          maxStage: 5
        },
        powers: [],
        passiveEffects: [],
        origin: "GM Grant",
        description: itemData.info || "",
        notes: ""
      };
    }

    const itemDataFull = {
      name: itemData.label,
      type: itemType,
      system: systemData,
      flags: {
        tsdc: {
          itemKey: itemData.key,
          itemType: itemData.type,
          grantedByGM: true,
          grantedAt: Date.now()
        }
      }
    };

    await actor.createEmbeddedDocuments("Item", [itemDataFull]);

    // Mensaje de chat
    await GMGrantDialog._sendChatMessage(actor, itemData);
  }

  static async _sendChatMessage(actor, itemData, material = null, grade = null) {
    let description = `<strong>${itemData.label}</strong>`;
    if (material && grade) {
      description += ` de ${material.charAt(0).toUpperCase() + material.slice(1)} (Grado ${grade})`;
    }
    description += ` (x${itemData.quantity || 1})`;

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<div class="tsdc gm-grant-message">
        <h3>🎁 Item Otorgado</h3>
        <p><strong>${actor.name}</strong> ha recibido:</p>
        <p>${description}</p>
      </div>`,
      whisper: [game.user.id, ...game.users.filter(u => u.character?.id === actor.id).map(u => u.id)]
    });
  }

  static async onCreateCustom(event, target) {
    const result = await foundry.applications.api.DialogV2.prompt({
      window: { title: "Crear Item Personalizado" },
      content: `
        <form class="t-col" style="gap:8px;">
          <div class="t-field">
            <label>Nombre del Item</label>
            <input type="text" name="itemName" required>
          </div>
          <div class="t-field">
            <label>Tipo</label>
            <select name="itemType">
              <option value="weapon">Arma</option>
              <option value="armor">Armadura</option>
              <option value="material">Material</option>
              <option value="consumable">Consumible</option>
              <option value="relic">Reliquia</option>
              <option value="diagram">Diagrama</option>
              <option value="formula">Fórmula</option>
              <option value="other">Otro</option>
            </select>
          </div>
          <div class="t-field">
            <label>Descripción</label>
            <textarea name="description" rows="4"></textarea>
          </div>
          <div class="t-field">
            <label>Cantidad</label>
            <input type="number" name="quantity" value="1" min="1">
          </div>
        </form>
      `,
      ok: {
        label: "Crear",
        callback: (event, button) => {
          const form = button.form;
          return {
            name: form.elements.itemName.value,
            type: form.elements.itemType.value,
            description: form.elements.description.value,
            quantity: Number(form.elements.quantity.value)
          };
        }
      }
    });

    if (!result) return;

    // Obtener jugadores seleccionados
    const selectedCharacters = [];
    const checkboxes = this.element.querySelectorAll('input[name="player-select"]:checked');

    for (const checkbox of checkboxes) {
      const characterId = checkbox.value;
      const actor = game.actors.get(characterId);
      if (actor) selectedCharacters.push(actor);
    }

    if (selectedCharacters.length === 0) {
      ui.notifications.warn("Selecciona al menos un jugador.");
      return;
    }

    // Otorgar item personalizado
    for (const actor of selectedCharacters) {
      await GMGrantDialog._grantItemToActor(actor, {
        key: `custom_${Date.now()}`,
        label: result.name,
        type: result.type,
        quantity: result.quantity
      });
    }

    ui.notifications.info(
      `${result.name} otorgado a ${selectedCharacters.map(a => a.name).join(", ")}`
    );
  }
}

// Registrar la aplicación globalmente
Hooks.once("ready", () => {
  game.tsdc = game.tsdc || {};
  game.tsdc.GMGrantDialog = GMGrantDialog;

  console.log("TSDC | GM Grant Dialog registered");
});

// Macro helper para abrir el diálogo
export function openGrantDialog() {
  if (!game.user.isGM) {
    ui.notifications.warn("Solo el GM puede usar esta herramienta.");
    return;
  }

  const dialog = new GMGrantDialog();
  dialog.render(true);
}
