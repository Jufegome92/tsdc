// modules/sheets/actor-sheet.js
import { listSpecs, getAttributeForSpec, baseFromSpec, requiresEvolutionChoice, usesCalc } from "../features/specializations/index.js";
import { resolveEvolution } from "../features/advantage/index.js";
import { BACKGROUNDS, getBackground, setBackground, getThresholdForSpec } from "../features/affinities/index.js";
import * as Inv from "../features/inventory/index.js";
import { getWeapon as getWeaponDef } from "../features/weapons/index.js";
import { computeArmorBonusFromEquipped } from "../features/defense/index.js";
import { trackThreshold } from "../progression.js";
import { WEAPONS } from "../features/weapons/data.js"; 

console.log("actor-sheet import base:", import.meta.url);

export class TSDCActorSheet extends foundry.appv1.sheets.ActorSheet {
  static get defaultOptions() {
    return foundry.utils.mergeObject(super.defaultOptions, {
      classes: ["tsdc", "sheet", "actor"],
      template: "systems/tsdc/templates/actor/character-sheet.hbs",
      width: 720,
      height: 680,
      tabs: [{ navSelector: ".sheet-tabs", contentSelector: ".sheet-body", initial: "main" }]
    });
  }

  get template() {
    return "systems/tsdc/templates/actor/character-sheet.hbs";
  }

  async getData(options = {}) {
    const data = await super.getData(options);

    // Labels
    data.labels = {
      strength:  game.i18n.localize("TSDC.Attr.strength"),
      agility:   game.i18n.localize("TSDC.Attr.agility"),
      tenacity:  game.i18n.localize("TSDC.Attr.tenacity"),
      cunning:   game.i18n.localize("TSDC.Attr.cunning"),
      wisdom:    game.i18n.localize("TSDC.Attr.wisdom"),
      intellect: game.i18n.localize("TSDC.Attr.intellect"),
      aura:      game.i18n.localize("TSDC.Attr.aura"),
      composure: game.i18n.localize("TSDC.Attr.composure"),
      presence:  game.i18n.localize("TSDC.Attr.presence"),
      prep:      game.i18n.localize("TSDC.Derived.preparation"),
      resi:      game.i18n.localize("TSDC.Derived.resilience")
    };

    // --- Background (afinidades) para UI ---
    const bg = getBackground(this.actor);
    data.background = {
      current: bg.key,
      options: Object.values(BACKGROUNDS)  // [{key,label,major}]
    };

    // --- Especializaciones (vista) ---
    const sys = this.actor.system ?? {};
    const specState = sys.progression?.skills ?? {};
    const attrs = sys.attributes ?? {};

    const getState = (key) => {
      const s = specState[key] || {};
      return {
        level: s.level ?? 0,
        rank: s.rank ?? 0,
        progress: s.progress ?? 0,
        fav: !!s.fav
      };
    };

    const all = listSpecs().map(({ key, label, category }) => {
      const st = getState(key);
      const attrKey = getAttributeForSpec(key);
      const attrLabel = data.labels[attrKey] ?? attrKey;
      const threshold = getThresholdForSpec(this.actor, category);
      return {
        key, label, category, attrKey, attrLabel,
        rank: st.rank, progress: st.progress, threshold,
        fav: st.fav, usesCalc: usesCalc(key)
      };
    });

    const favorites = all.filter(i => i.fav).sort((a,b) => a.label.localeCompare(b.label, "es"));
    const CATS = [
      { id: "physical",   title: "Físicas" },
      { id: "mental",     title: "Mentales" },
      { id: "social",     title: "Sociales" },
      { id: "arts",       title: "Artes y Oficios" },
      { id: "knowledge",  title: "Saberes" }
    ];
    const groups = CATS.map(c => ({
      category: c.id,
      title: c.title,
      items: all.filter(i => i.category === c.id).sort((a,b) => a.label.localeCompare(b.label, "es"))
    }));

    data.specs = { favorites, groups };

    // ===== COMPETENCIAS (para el tab nuevo) =====
    const prog = this.actor.system?.progression ?? {};
    const asPct = (p,t) => {
      const pct = Math.max(0, Math.min(100, Math.round((Number(p||0) / Math.max(1, Number(t||0))) * 100)));
      return isFinite(pct) ? pct : 0;
    };
    const row = (trackType, key, label, extraHint="") => {
      const p = foundry.utils.getProperty(this.actor, `system.progression.${trackType}.${key}`) ?? { level:0, rank:0, progress:0, fails:0 };
      const threshold = trackThreshold(this.actor, trackType, key);
      return {
        key, trackType,
        label,
        level: Number(p.level||0),
        rank: Number(p.rank||0),
        progress: Number(p.progress||0),
        fails: Number(p.fails||0),
        threshold,
        pct: asPct(p.progress, threshold),
        bonusHint: extraHint
      };
    };

    // Armas: usa claves existentes en progression.weapons (las que realmente usó el PJ)
    const weaponKeys = Object.keys(prog.weapons ?? {});
    const weapons = weaponKeys
      .sort((a,b) => (WEAPONS[a]?.label ?? a).localeCompare(WEAPONS[b]?.label ?? b, "es"))
      .map(k => row("weapons", k, WEAPONS[k]?.label ?? k, "+nivel al Ataque • +rango dados al Impacto"));

    // Maniobras (cuando las uses, ya aparecerán aquí al progresar)
    const maneuverKeys = Object.keys(prog.maneuvers ?? {});
    const maneuvers = maneuverKeys
      .sort((a,b) => a.localeCompare(b, "es"))
      .map(k => row("maneuvers", k, k, "+nivel al Ataque (maniobra)"));

    // Defensa (evasión)
    const defense = [row("defense", "evasion", "Evasión", "+nivel a Defensa")];

    // Armaduras (tipos fijos)
    const armor = ["light","medium","heavy"].map(k => row("armor", k,
      k==="light"?"Ligera":k==="medium"?"Intermedia":"Pesada",
      "Progresa en fallos de Defensa"));

    // Resistencias (tipos fijos)
    const RES_LABEL = {
      poison:"Veneno", infection:"Infección", affliction:"Aflicción", curse:"Maldición",
      alteration:"Alteración", water:"Agua", fire:"Fuego", earth:"Tierra", air:"Viento",
      light:"Luz", dark:"Oscuridad"
    };
    const resKeys = Object.keys(RES_LABEL);
    const resists = resKeys.map(k => row("resistances", k, RES_LABEL[k], "+nivel en Tiradas de Resistencia"));

    // Especializaciones (usa tus labels ya calculados en la vista de specs)
    const skills = Object.entries(prog.skills ?? {}).map(([k,v]) => {
      const lbl = (data.specs?.groups?.flatMap(g => g.items).find(i => i.key===k)?.label) || k;
      const cat = data.specs?.groups?.flatMap(g => g.items).find(i => i.key===k)?.category || v?.category || "—";
      const r = row("skills", k, lbl, "+nivel a tiradas relacionadas");
      r.categoryLabel = (
        cat==="physical"?"Física":
        cat==="mental"?"Mental":
        cat==="social"?"Social":
        cat==="arts"?"Artes y Oficios":
        cat==="knowledge"?"Saberes": cat
      );
      return r;
    }).sort((a,b)=>a.label.localeCompare(b.label,"es"));

    data.comps = { weapons, maneuvers, defense, armor, resists, skills };

    // --- Inventario (para UI de slots) ---
    const eq = Inv.getEquipped(this.actor);
    const optFor = (slot) => {
      const list = Inv.listForSlot(this.actor, slot);
      return list.map(it => ({
        id: it.id,
        label: Inv.itemLabel(it),
        selected: eq[slot] === it.id
      }));
    };

    data.inventory = {
      options: {
        mainHand: optFor("mainHand"),
        offHand:  optFor("offHand"),
        shield:   optFor("shield"),
        head:     optFor("head"),
        chest:    optFor("chest"),
        legs:     optFor("legs"),
        bracers:  optFor("bracers"),
        boots:    optFor("boots"),
        insignia: optFor("insignia"),
        amulet:   optFor("amulet"),
        pendant1: optFor("pendant1"),
        pendant2: optFor("pendant2")
      }
    };

    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
    // Fallback de tabs (por si Tabs V1 no se inicializa en tu hoja)
    const $navItems = html.find('.sheet-tabs .item');
    const $allTabs  = html.find('.tab[data-group="primary"]');
    function showTab(tab) {
      $navItems.removeClass('active').filter(`[data-tab="${tab}"]`).addClass('active');
      $allTabs.hide().filter(`[data-tab="${tab}"]`).show();
    }
    // click handler
    $navItems.on('click', ev => {
      ev.preventDefault();
      const tab = String($(ev.currentTarget).data('tab') || 'main');
      showTab(tab);
    });
    // estado inicial
    showTab('main');
    if (!this.isEditable) return;

    // Demo evo-roll
    html.find('[data-action="evo-roll"]').on("click", (ev) => this._onDemoEvoRoll(ev));

    // Background (afinidades)
    html.find('select[name="background"]').on("change", async (ev) => {
      const key = String(ev.currentTarget.value || "none");
      await setBackground(this.actor, key);
    });

    // Filtro de especializaciones
    html.find('input[name="specSearch"]').on("input", (ev) => this._onSpecSearch(ev, html));
    html.find('select[name="specFilter"]').on("change", (ev) => this._onSpecFilter(ev, html));

    // Favoritos y tiradas
    html.find('[data-action="spec-fav"]').on("click", (ev) => this._onToggleFavorite(ev));
    html.find('[data-action="spec-roll"]').on("click", (ev) => this._onSpecRoll(ev));

    // ATAQUE
    html.find('[data-action="atk-roll"]').on("click", async (ev) => {
      ev.preventDefault();
      const r = this.element;
      const selId = String(r.find('select[name="atkWeapon"]').val() || "");
      const selItem = selId ? Inv.getItemById?.(this.actor, selId) : Inv.getEquippedItem(this.actor, "mainHand");
      const wKey = selItem?.key || null;
      const isManeuver = r.find('input[name="atkIsManeuver"]').is(':checked');
      let attrKey = String(r.find('select[name="atkAttr"]').val() || "");
      if (!attrKey) {
        // si no lo forzó el usuario, toma el atributo por defecto del arma
        const def = wKey ? getWeaponDef(wKey) : null;
        attrKey = def?.attackAttr || "agility";
      }
      const bonus = Number(r.find('input[name="atkBonus"]').val() || 0);
      const penalty = Number(r.find('input[name="atkPenalty"]').val() || 0);

      const { rollAttack } = await import("../rolls/dispatcher.js");
      await rollAttack(this.actor, { key: wKey, isManeuver, attrKey, bonus, penalty, mode:"ask" });
    });

    console.log("voy a cargar dispatcher.js desde", new URL("../rolls/dispatcher.js", import.meta.url).href);
    // IMPACTO
    html.find('[data-action="imp-roll"]').on("click", async (ev) => {
      ev.preventDefault();
      const r = this.element;

      // Lo que viene de la UI
      const selId = String(r.find('select[name="impWeapon"]').val() || "");
      const mainItem = selId ? Inv.getItemById?.(this.actor, selId) : Inv.getEquippedItem(this.actor, "mainHand");
      const key = mainItem?.key || null;
      const def = key ? getWeaponDef(key) : null;
      const die   = def?.damageDie || "d6";
      const grade = Number(mainItem?.grade ?? def?.grade ?? 1);
      const attrKey = def?.attackAttr || "agility";
      const bonus   = Number(r.find('input[name="impBonus"]').val() || 0);


      const { rollImpact } = await import("../rolls/dispatcher.js");
      await rollImpact(this.actor, {
        key, die, grade, attrKey, bonus,
        weaponItem: mainItem ?? null // ← necesario para críticos / romper partes
        // Puedes añadir aquí breakBonus / targetDurability si quieres pedirlos por diálogo
      });
    });

    // DEFENSA
    html.find('[data-action="def-roll"]').on("click", async (ev) => {
      ev.preventDefault();
      const r = this.element;
      const armorType  = String(r.find('select[name="defArmorType"]').val() || "light"); // para progreso en fallo
      const armorBonus = computeArmorBonusFromEquipped(this.actor);
      const bonus = Number(r.find('input[name="defBonus"]').val() || 0);
      const penalty = Number(r.find('input[name="defPenalty"]').val() || 0);

      const { rollDefense } = await import("../rolls/dispatcher.js");
      await rollDefense(this.actor, { armorType, armorBonus, bonus, penalty, mode:"ask" });
    });

    // RESISTENCIA
    html.find('[data-action="res-roll"]').on("click", async (ev) => {
      ev.preventDefault();
      const r = this.element;
      const type = String(r.find('select[name="resType"]').val() || "poison");
      const bonus = Number(r.find('input[name="resBonus"]').val() || 0);
      const penalty = Number(r.find('input[name="resPenalty"]').val() || 0);

      const { rollResistance } = await import("../rolls/dispatcher.js");
      await rollResistance(this.actor, { type, bonus, penalty });
    });

    // Equipar / Desequipar por slot
    html.find('select[name^="slot."]').on("change", async (ev) => {
      const name = String(ev.currentTarget.name || "slot.?");
      const slot = name.split(".")[1];
      const val = String(ev.currentTarget.value || "");
      const id = val || null;
      await Inv.equip(this.actor, slot, id);
    });

  }

  async _onDemoEvoRoll(ev) {
    ev.preventDefault();
    const root = this.element;
    const mode = root.find('select[name="evoMode"]').val() ?? "ask";
    const base = Number(root.find('input[name="base"]').val() || 0);
    const bonus = Number(root.find('input[name="bonus"]').val() || 0);
    const diff = Number(root.find('input[name="diff"]').val() || 0);
    const rank = Number(root.find('input[name="rank"]').val() || 0);

    const formula = `1d10 + ${base} + ${bonus} - ${diff}`;
    await resolveEvolution({ type: "attack", mode, formula, rank, flavor: "Sheet Test" });
  }

  _onSpecSearch(ev, html) {
    const q = String(ev.currentTarget.value || "").toLowerCase().trim();
    const rows = html.find(".spec-row");
    rows.each((i, el) => {
      const $el = $(el);
      const label = String($el.find("strong").text() || "").toLowerCase();
      $el.toggle(label.includes(q));
    });
  }

  _onSpecFilter(ev, html) {
    const v = String(ev.currentTarget.value || "all");
    html.find('[data-category]').each((i, el) => {
      const $g = $(el);
      const cat = $g.attr("data-category");
      const show = (v === "all") || (v === cat);
      $g.toggle(show);
    });
    const favCard = html.find("h3:contains('Favoritas')").closest(".t-card");
    if (v === "favorites") {
      favCard.show();
      html.find('[data-category]').hide();
    } else {
      favCard.toggle(!!favCard.length);
    }
  }

  async _onToggleFavorite(ev) {
    ev.preventDefault();
    const row = $(ev.currentTarget).closest("[data-spec]");
    const key = row.attr("data-spec");
    if (!key) return;
    const path = `system.progression.skills.${key}.fav`;
    const current = foundry.utils.getProperty(this.actor, path) ?? false;
    await this.actor.update({ [path]: !current });
  }

  async _onSpecRoll(ev) {
    ev.preventDefault();
    const row = $(ev.currentTarget).closest("[data-spec]");
    const key = row.attr("data-spec");
    if (!key) return;

    const attrs = this.actor.system?.attributes ?? {};
    const base  = baseFromSpec(attrs, key) || 0;

    const requiresChoice = requiresEvolutionChoice(key);
    const params = await Dialog.prompt({
      title: `Tirada • ${row.find("strong").text()}`,
      label: "Tirar",
      callback: (dlg) => {
        const mode  = requiresChoice ? (dlg.find('select[name="mode"]').val() || "learning") : "none";
        const bonus = Number(dlg.find('input[name="bonus"]').val() || 0);
        const diff  = Number(dlg.find('input[name="diff"]').val() || 0);
        return { mode, bonus, diff };
      },
      content: `
        <form class="t-col" style="gap:8px;">
          ${requiresChoice ? `
          <div class="t-field">
            <label>Modo</label>
            <select name="mode">
              <option value="execution">Ejecución (mejor)</option>
              <option value="learning" selected>Aprender (peor)</option>
            </select>
          </div>` : ``}
          <div class="t-row" style="gap:8px;">
            <div class="t-field"><label>Base</label><input type="number" value="${base}" disabled /></div>
          </div>
          <div class="t-row" style="gap:8px;">
            <div class="t-field"><label>Bono</label><input type="number" name="bonus" value="0"/></div>
            <div class="t-field"><label>Penal.</label><input type="number" name="diff" value="0"/></div>
          </div>
        </form>
      `
    });
    if (!params) return;

    const formula = `1d10 + ${base} + ${params.bonus} - ${params.diff}`;
    const rank = Number(foundry.utils.getProperty(this.actor, `system.progression.skills.${key}.rank`) || 0);

    await resolveEvolution({
      type: "specialization",
      mode: params.mode,
      formula,
      rank,
      flavor: `Especialización • ${row.find("strong").text()}`,
      actor: this.actor,
      meta: { key }
    });
  }
}
