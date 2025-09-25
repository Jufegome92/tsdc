// modules/sheets/actor-sheet.js
import { listSpecs, getAttributeForSpec, baseFromSpec, requiresEvolutionChoice, usesCalc } from "../features/specializations/index.js";
import { resolveEvolution } from "../features/advantage/index.js";
import { BACKGROUNDS, getBackground, setBackground, getThresholdForSpec } from "../features/affinities/index.js";
import * as Inv from "../features/inventory/index.js";
import { getWoundState } from "../health/wounds.js";
import { getWeapon as getWeaponDef } from "../features/weapons/index.js";
import { getNaturalWeaponDef } from "../features/species/natural-weapons.js";
import { computeArmorBonusFromEquipped } from "../features/defense/index.js";
import { trackThreshold } from "../progression.js";
import { WEAPONS } from "../features/weapons/data.js";

console.log("actor-sheet import base:", import.meta.url);

// 👇 Hereda ActorSheetV2 + mixin de Handlebars
const { HandlebarsApplicationMixin } = foundry.applications.api;

const WOUND_ZONE_ORDER = ["head", "chest", "bracers", "legs", "boots"];

export class TSDCActorSheet extends HandlebarsApplicationMixin(foundry.applications.sheets.ActorSheetV2) {
  #activeTab = "main";
  static DEFAULT_OPTIONS = {
    ...super.DEFAULT_OPTIONS,
    classes: ["tsdc", "sheet", "actor"],
    window: { title: "Hoja de personaje" },
    width: 820,
    height: 760,
    resizable: true
  };

  static PARTS = {
    content: {
      template: "systems/tsdc/templates/actor/character-sheet.hbs",
      scrollable: [".sheet-body"]
    }
  };

  get title() {
    return this.actor?.name || game.i18n.localize("TYPES.Actor.character");
  }

  /** Contexto para el HBS (tu antiguo getData) */
  async _prepareContext(context = {}, _options = {}) {
    console.log("TSDCActorSheet::_prepareContext IN");
    // Deja que el mixin inicialice lo suyo
    context = await super._prepareContext?.(context, _options) ?? {};

     // Fuerza solo lectura de identidad permanente
    context.identityLocked = !!this.actor.system?.identity?.locked;
    if (!context.identityLocked) {
      // Si no está bloqueado, no muestres editores; el wizard se encargará
      context.readonlyPermanent = false; // (la UI puede ocultar secciones)
    } else {
      context.readonlyPermanent = true;
    }

    context.actor  = this.actor;
    context.system = this.actor.system ?? {};

    const sp = context.system?.species ?? {};

    const SIZE_LBL = {
      tiny:"TSDC.Size.tiny", small:"TSDC.Size.small", medium:"TSDC.Size.medium",
      large:"TSDC.Size.large", huge:"TSDC.Size.huge"
    };
    const sizeKey = SIZE_LBL[String(sp.size) || ""] || "";
    const sizeLabel = sizeKey ? game.i18n.localize(sizeKey) : (sp.size ?? "");

    context.speciesView = {
      label: sp.label || "",
      sizeLabel,
      speed: sp.speed ?? 0,
      languages: Array.isArray(sp.languages) ? sp.languages.join(", ") : ""
    };

    function toHint(rangeArr, mapFn=(x)=>x) {
      if (!Array.isArray(rangeArr) || rangeArr.length !== 2) return "";
      const [a,b] = rangeArr;
      if (a==null || b==null) return "";
      return `(${mapFn(a)} – ${mapFn(b)})`;
    }

    // species ranges vienen en metros/kg/años:
    const ageHint    = toHint(sp.lifespan, (x)=> Math.round(x));
    const heightHint = toHint(sp.heightRangeM, (x)=> Math.round(Number(x)*100)); // m → cm
    const weightHint = toHint(sp.weightRangeKg, (x)=> Math.round(x));

    context.identityHints = {
      age: ageHint,
      heightCm: heightHint,
      weightKg: weightHint
    };
    
    // Labels
    context.labels = {
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

    // Background
    const bg = getBackground(this.actor);
    context.background = { current: bg.key, options: Object.values(BACKGROUNDS) };

    // ---- Especializaciones (vista) ----
    const specState = context.system.progression?.skills ?? {};
    const getState = (key) => {
      const s = specState[key] || {};
      return { level: s.level ?? 0, rank: s.rank ?? 0, progress: s.progress ?? 0, fav: !!s.fav };
    };

    const all = listSpecs().map(({ key, label, category }) => {
      const st = getState(key);
      const attrKey   = getAttributeForSpec(key);
      const i18nKey   = attrKey ? `TSDC.Attr.${attrKey}` : "";
      const attrLabel = i18nKey ? game.i18n.localize(i18nKey) : (context.labels[attrKey] ?? attrKey);
      const threshold = getThresholdForSpec(this.actor, category);
      return { key, label, category, attrKey, attrLabel, rank: st.rank, progress: st.progress, threshold, fav: st.fav, usesCalc: usesCalc(key) };
    });

    const favorites = all.filter(i => i.fav).sort((a,b) => a.label.localeCompare(b.label, "es"));
    const CATS = [
      { id: "physical",  title: "Físicas" },
      { id: "mental",    title: "Mentales" },
      { id: "social",    title: "Sociales" },
      { id: "arts",      title: "Artes y Oficios" },
      { id: "knowledge", title: "Saberes" }
    ];
    const groups = CATS.map(c => ({
      category: c.id,
      title: c.title,
      items: all.filter(i => i.category === c.id).sort((a,b) => a.label.localeCompare(b.label, "es"))
    }));
    context.specs = { favorites, groups };

    // ---- Competencias (tab) ----
    const prog  = context.system.progression ?? {};
    const asPct = (p,t) => {
      const pct = Math.max(0, Math.min(100, Math.round((Number(p||0)/Math.max(1,Number(t||0)))*100)));
      return isFinite(pct) ? pct : 0;
    };
    const row = (trackType, key, label, extraHint = "", categoryOverride = null) => {
      const p = foundry.utils.getProperty(this.actor, `system.progression.${trackType}.${key}`) ?? { level:0, rank:0, progress:0, fails:0 };
      let threshold = trackThreshold(this.actor, trackType, key);
      if (trackType === "skills" && categoryOverride) {
        threshold = getThresholdForSpec(this.actor, categoryOverride);
      }

      const asPct = (val, thr) => {
        const pct = Math.max(0, Math.min(100, Math.round((Number(val||0)/Math.max(1,Number(thr||0)))*100)));
        return isFinite(pct) ? pct : 0;
      };

      return {
        key, trackType, label,
        level: Number(p.level||0),
        rank:  Number(p.rank||0),
        progress: Number(p.progress||0),
        fails: Number(p.fails||0),
        threshold,
        pct: asPct(p.progress, threshold),
        bonusHint: extraHint
      };
    };

    const weaponKeys = Object.keys(prog.weapons ?? {});
    const weapons = weaponKeys
      .sort((a,b) => {
        const labelA = WEAPONS[a]?.label ?? getNaturalWeaponDef(a)?.label ?? a;
        const labelB = WEAPONS[b]?.label ?? getNaturalWeaponDef(b)?.label ?? b;
        return labelA.localeCompare(labelB, "es");
      })
      .map(k => row("weapons", k, WEAPONS[k]?.label ?? getNaturalWeaponDef(k)?.label ?? k, "+nivel al Ataque • +rango dados al Impacto"));

    const maneuverKeys = Object.keys(prog.maneuvers ?? {});
    const maneuvers = maneuverKeys.sort((a,b) => a.localeCompare(b, "es"))
                                  .map(k => row("maneuvers", k, k, "+nivel al Ataque (maniobra)"));

    const relicKeys = Object.keys(prog.relics ?? {});
    const relics = relicKeys.sort((a,b) => a.localeCompare(b, "es"))
                           .map(k => row("relics", k, k, "+nivel al poder de reliquia"));

    const defense = [row("defense", "evasion", "Evasión", "+nivel a Defensa")];

    const armor = ["light","medium","heavy"].map(k => row("armor", k,
      k==="light"?"Ligera":k==="medium"?"Intermedia":"Pesada",
      "Progresa en fallos de Defensa"
    ));

    const RES_LABEL = {
      poison:"Veneno", infection:"Infección", affliction:"Aflicción", curse:"Maldición",
      alteration:"Alteración", water:"Agua", fire:"Fuego", earth:"Tierra", air:"Viento",
      light:"Luz", dark:"Oscuridad"
    };
    const resists = Object.keys(RES_LABEL).map(k => row("resistances", k, RES_LABEL[k], "+nivel en Tiradas de Resistencia"));

    // Resumen de especializaciones existentes en progreso
    const allSpecItems = groups.flatMap(g => g.items);
    const skills = Object.entries(prog.skills ?? {}).map(([k,v]) => {
      const i = allSpecItems.find(s => s.key === k);
      const lbl = i?.label || k;
      const cat = i?.category || v?.category || "—";
      const r = row("skills", k, lbl, "+nivel a tiradas relacionadas", cat);
      r.categoryLabel =
        cat==="physical" ? "Física" :
        cat==="mental"   ? "Mental" :
        cat==="social"   ? "Social" :
        cat==="arts"     ? "Artes y Oficios" :
        cat==="knowledge"? "Saberes" : cat;
      return r;
    }).sort((a,b)=>a.label.localeCompare(b.label,"es"));

    context.comps = { weapons, maneuvers, relics, defense, armor, resists, skills };

    // Inventario (slots)
    const eq = Inv.getEquipped(this.actor);
    const optFor = (slot) => Inv.listForSlot(this.actor, slot).map(it => {
      const disabled = !!it.disabled;
      const reason = it.disabledReason || "";
      const label = `${Inv.itemLabel(it)}${disabled ? " [parte dañada]" : ""}`;
      return {
        id: it.id,
        label,
        selected: eq[slot] === it.id,
        disabled,
        disabledReason: reason
      };
    });
    context.inventory = {
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
      },
      naturalAux: Inv.getNaturalWeapons(this.actor)
        .map(rec => Inv.resolveWeaponByKey(this.actor, rec.key))
        .filter(sel => sel && sel.item && sel.item.occupiesSlot === false)
        .map(sel => ({
          id: `natural:${sel.key}`,
          label: `${Inv.itemLabel(sel.item)}${sel.disabled ? " [parte dañada]" : ""}`,
          key: sel.key,
          disabled: !!sel.disabled,
          disabledReason: sel.disabledReason || ""
        }))
    };

    const slotLabels = {
      mainHand: "Mano principal",
      offHand: "Mano secundaria",
      shield: "Escudo",
      head: "Casco",
      chest: "Peto",
      bracers: "Brazales",
      legs: "Pantalón",
      boots: "Botas"
    };

    const summarizeEquip = (item) => {
      if (!item) return { durability: "—", potency: "—" };
      const durabilitySource = item?.durability ?? item?.system?.durability ?? null;
      let durabilityText = "—";
      if (durabilitySource && typeof durabilitySource === "object") {
        const cur = Number(durabilitySource.value ?? durabilitySource.current ?? durabilitySource.remaining ?? NaN);
        const max = Number(durabilitySource.max ?? durabilitySource.value ?? NaN);
        if (Number.isFinite(cur) && Number.isFinite(max)) durabilityText = `${cur} / ${max}`;
        else if (Number.isFinite(cur)) durabilityText = String(cur);
      } else if (Number.isFinite(Number(durabilitySource))) {
        durabilityText = String(Number(durabilitySource));
      }
      const potencySource = item?.potency ?? item?.system?.potency ?? item?.power ?? null;
      let potencyText = "—";
      if (potencySource && typeof potencySource === "object") {
        const val = Number(potencySource.value ?? potencySource.current ?? NaN);
        if (Number.isFinite(val)) potencyText = String(val);
      } else if (Number.isFinite(Number(potencySource))) {
        potencyText = String(Number(potencySource));
      }
      return { durability: durabilityText, potency: potencyText };
    };

    context.inventory.equippedSummary = Object.entries(slotLabels).map(([slot, label]) => {
      const item = Inv.getEquippedItem(this.actor, slot);
      if (!item) return null;
      const { durability, potency } = summarizeEquip(item);
      return {
        slot,
        slotLabel: label,
        name: Inv.itemLabel(item),
        durability,
        potency
      };
    }).filter(Boolean);

    const monsterTraits = Array.isArray(this.actor.system?.traits?.monster)
      ? this.actor.system.traits.monster.map(t => ({
          key: t.key ?? t.label ?? "trait",
          label: t.label ?? t.key ?? "Rasgo",
          note: t.note ?? t.description ?? t.notes ?? "",
          category: t.cat ?? t.category ?? "general"
        }))
      : [];
    context.monsterTraits = monsterTraits;
    context.isGM = game.user?.isGM ?? false;

    // Defaults de tirada persistidos en el actor
    const rollDefaults = this.actor.system?.ui?.rollDefaults ?? {};
    context.rollDefaults = {
      attack: {
        bonus:   Number(rollDefaults?.attack?.bonus   ?? 0),
        penalty: Number(rollDefaults?.attack?.penalty ?? 0),
        attr:    String(rollDefaults?.attack?.attr ?? "")
      },
      defense: {
        bonus:     Number(rollDefaults?.defense?.bonus     ?? 0),
        penalty:   Number(rollDefaults?.defense?.penalty   ?? 0),
        armorType: String(rollDefaults?.defense?.armorType ?? "light")
      },
      resistance: {
        bonus:   Number(rollDefaults?.resistance?.bonus   ?? 0),
        penalty: Number(rollDefaults?.resistance?.penalty ?? 0),
        type:    String(rollDefaults?.resistance?.type ?? "poison")
      },
      spec: {
        bonus: Number(rollDefaults?.spec?.bonus ?? 0),
        diff:  Number(rollDefaults?.spec?.diff  ?? 0),
        mode:  String(rollDefaults?.spec?.mode  ?? "learning")
      }
    };

    // --- Estados básicos: Aguante, Fatiga y Desgaste (no persisten todos)
    const tenacity = Number(this.actor.system?.attributes?.tenacity ?? 0);
    const vigorLvl = Number(this.actor.system?.progression?.skills?.vigor?.level ?? 0);
    const stamina = Number(vigorLvl + tenacity); // Aguante


    const fatigue = Number(this.actor.system?.states?.fatigue ?? 0);
    const wear = Number(this.actor.system?.states?.wear ?? 0);
    const wearMax = Math.max(0, stamina - fatigue);


    context.states = { stamina, fatigue, wear, wearMax };

    const healthParts = this.actor.system?.health?.parts ?? {};
    context.healthParts = Object.entries(healthParts).map(([key, data]) => {
      const value = Number(data?.value ?? 0);
      const max = Number(data?.max ?? value);
      return {
        key,
        label: Inv.bodyPartLabel?.(key) ?? key,
        value,
        max,
        potency: Number(data?.potency ?? 0),
        material: data?.material ?? "—",
        category: data?.category ?? "",
        disabled: value <= 0
      };
    });

    const personalitySource = Array.isArray(this.actor.system?.personality?.traits)
      ? [...this.actor.system.personality.traits]
      : [];
    while (personalitySource.length < 5) personalitySource.push("");
    context.personalityTraits = personalitySource.slice(0, 5).map((value, idx) => ({
      index: idx + 1,
      value,
      name: `system.personality.traits.${idx}`
    }));

    const woundsState = getWoundState(this.actor);
    const woundZones = WOUND_ZONE_ORDER.map(key => {
      const data = woundsState.zones?.[key] ?? { used: 0, max: 3, slots: [false, false, false], status: "ok" };
      const slots = Array.isArray(data.slots) ? data.slots.slice(0, data.max ?? 3) : Array.from({ length: data.max ?? 3 }, (_, i) => i < data.used);
      return {
        key,
        label: Inv.bodyPartLabel?.(key) ?? key,
        used: Number(data.used ?? 0),
        max: Number(data.max ?? 3),
        slots,
        status: data.status || (data.used >= data.max ? "disabled" : "ok")
      };
    }).filter(z => z.max > 0);
    context.wounds = woundsState;
    context.woundZones = woundZones;
    const statusLabels = {
      ok: "Sin lesiones críticas",
      down: "Zona incapacitada",
      critical: "Crítico",
      dead: "Letal"
    };
    context.woundStatusLabel = statusLabels[woundsState.status] ?? woundsState.status ?? "";


    console.log("TSDCActorSheet::_prepareContext OUT", { hasActor: !!this.actor, hasInv: !!context.inventory });
    return context;
  }

  /** Se llama tras montar el HTML (aquí enganchamos listeners) */
  _onRender(_context, _options) {
    console.log("TSDCActorSheet::_onRender");
    const el = this.element;

    // --- Pestañas con API pública (v13) ---
    // Si ya había una instancia previa (por re-render), desasóciala
    this._tabs?.unbind?.();
    this._tabs = null;

    // Usa el componente oficial de Foundry para tabs
    const TabsV2 = foundry?.applications?.api?.TabsV2;
    if (TabsV2) {
      this._tabs = new TabsV2({
        navSelector: ".sheet-tabs",
        contentSelector: ".sheet-body",
        initial: this.#activeTab || "main",
        callback: (_ev, _tabs, active) => this.#activeTab = active || "main"
      });
    this._tabs.bind?.(el);
    } else {

      const nav = el.querySelector(".sheet-tabs");
      const content = el.querySelector(".sheet-body");
      const items = nav ? Array.from(nav.querySelectorAll(".item")) : [];
      const panes = content ? Array.from(content.querySelectorAll('.tab[data-group="primary"]')) : [];
      const activate = (name) => {
        items.forEach(a => a.classList.toggle("active", a.dataset.tab === name));
        panes.forEach(p => p.classList.toggle("active", p.dataset.tab === name));
        this.#activeTab = name;
      };
      nav?.addEventListener("click", (ev) => {
        const a = ev.target.closest(".item");
        if (!a) return;
        ev.preventDefault();
        activate(a.dataset.tab);
      });
      activate(this.#activeTab || "main");
    }

    if (!this.isEditable) return;

    if (this._rootClickHandler) {
      try { el.removeEventListener("click", this._rootClickHandler); } catch (_) {}
    }
    // Acciones
    this._rootClickHandler = async (ev) => {
      const btn = ev.target.closest("[data-action]");
      if (!btn) return;
      const action = btn.dataset.action;

      if (action === "evo-roll") return this.#onDemoEvoRoll(ev);
      if (action === "spec-fav")  return this.#onToggleFavorite(btn);
      if (action === "spec-roll") return this.#onSpecRoll(btn);
      if (action === "atk-roll")  return this.#onAtkRoll();
      if (action === "imp-roll")  return this.#onImpRoll();
      if (action === "def-roll")  return this.#onDefRoll();
      if (action === "res-roll")  return this.#onResRoll();
    };
    el.addEventListener("click", this._rootClickHandler);

    // Selects
    el.querySelector('select[name="background"]')?.addEventListener("change", async (ev) => {
      if (ev.currentTarget.disabled) return;
      const key = String(ev.currentTarget.value || "none");
      await setBackground(this.actor, key);
    });

    // Filtros
    el.querySelector('input[name="specSearch"]')?.addEventListener("input", (ev) => this.#onSpecSearch(ev));
    el.querySelector('select[name="specFilter"]')?.addEventListener("change", (ev) => this.#onSpecFilter(ev));

    // Equipar / Desequipar por slot
    el.querySelectorAll('select[name^="slot."]').forEach(sel => {
      sel.addEventListener("change", async (ev) => {
        const name = String(ev.currentTarget.name || "slot.?");
        const slot = name.split(".")[1];
        const val = String(ev.currentTarget.value || "");
        await Inv.equip(this.actor, slot, val || null);
      });
    });

    // Guarda un input/select en system.ui.rollDefaults.*
    const saveDefault = (selector, path, kind = "number") => {
      const input = this.element.querySelector(selector);
      if (!input) return;
      const read = () => kind === "number" ? Number(input.value || 0) : String(input.value || "");
      input.addEventListener("change", async () => {
        await this.actor.update({ [path]: read() });
      });
    };

    // Ataque
    saveDefault('input[name="atkBonus"]',   "system.ui.rollDefaults.attack.bonus");
    saveDefault('input[name="atkPenalty"]', "system.ui.rollDefaults.attack.penalty");
    saveDefault('select[name="atkAttr"]',   "system.ui.rollDefaults.attack.attr", "string");

    // Defensa
    saveDefault('input[name="defBonus"]',     "system.ui.rollDefaults.defense.bonus");
    saveDefault('input[name="defPenalty"]',   "system.ui.rollDefaults.defense.penalty");
    saveDefault('select[name="defArmorType"]',"system.ui.rollDefaults.defense.armorType", "string");

    // Resistencias
    saveDefault('input[name="resBonus"]',   "system.ui.rollDefaults.resistance.bonus");
    saveDefault('input[name="resPenalty"]', "system.ui.rollDefaults.resistance.penalty");
    saveDefault('select[name="resType"]',   "system.ui.rollDefaults.resistance.type", "string");
  }

  // ==== Handlers ====

  async #onDemoEvoRoll(ev) {
    ev.preventDefault();
    const el = this.element;
    const mode = el.querySelector('select[name="evoMode"]')?.value ?? "ask";
    const base = Number(el.querySelector('input[name="base"]')?.value || 0);
    const bonus= Number(el.querySelector('input[name="bonus"]')?.value || 0);
    const diff = Number(el.querySelector('input[name="diff"]')?.value || 0);
    const rank = Number(el.querySelector('input[name="rank"]')?.value || 0);
    const formula = `1d10 + ${base} + ${bonus} - ${diff}`;
    await resolveEvolution({ type: "attack", mode, formula, rank, flavor: "Sheet Test" });
  }

  #onSpecSearch(ev) {
    const q = String(ev.currentTarget.value || "").toLowerCase().trim();
    this.element.querySelectorAll(".spec-row").forEach(row => {
      const label = String(row.querySelector("strong")?.textContent || "").toLowerCase();
      row.style.display = label.includes(q) ? "" : "none";
    });
  }

  #onSpecFilter(ev) {
    const v = String(ev.currentTarget.value || "all");
    const el = this.element;
    const groups = el.querySelectorAll('[data-category]');

    // ⚠️ CSS :contains no existe → buscar por texto
    const favHeader = Array.from(el.querySelectorAll("h3"))
      .find(h => (h.textContent || "").trim().toLowerCase().includes("favoritas"));
    const favCard = favHeader ? favHeader.closest(".t-card") : null;

    groups.forEach(g => {
      const cat = g.getAttribute("data-category");
      g.style.display = (v === "all" || v === cat) ? "" : "none";
    });

    if (favCard) {
      if (v === "favorites") {
        favCard.style.display = "";
        groups.forEach(g => g.style.display = "none");
      } else {
        favCard.style.display = "";
      }
    }
  }

  async #onToggleFavorite(btn) {
    const row = btn.closest("[data-spec]");
    const key = row?.dataset.spec;
    if (!key) return;
    const path = `system.progression.skills.${key}.fav`;
    const current = foundry.utils.getProperty(this.actor, path) ?? false;
    await this.actor.update({ [path]: !current });
  }

  async #onSpecRoll(btn) {
    const row = btn.closest("[data-spec]");
    const key = row?.dataset.spec;
    if (!key) return;

    const attrs = this.actor.system?.attributes ?? {};
    const base  = baseFromSpec(attrs, key) || 0;
    const title = `Tirada • ${row.querySelector("strong")?.textContent ?? key}`;
    const needs = requiresEvolutionChoice(key);

    // Defaults guardados
    const d = this.actor.system?.ui?.rollDefaults?.spec ?? { bonus:0, diff:0, mode:"learning" };

    const res = await foundry.applications.api.DialogV2.prompt({
      window: { title },
      content: `
        <form class="t-col" style="gap:8px;">
          ${needs ? `
          <div class="t-field">
            <label>Modo</label>
            <select name="mode">
              <option value="execution" ${d.mode==="execution"?"selected":""}>Ejecución (mejor)</option>
              <option value="learning"  ${d.mode==="learning" ?"selected":""}>Aprender (peor)</option>
              <option value="none"      ${d.mode==="none"     ?"selected":""}>Sin ventaja</option>
            </select>
          </div>` : ``}
          <div class="t-row" style="gap:8px;">
            <div class="t-field"><label>Base</label><input type="number" value="${base}" disabled></div>
          </div>
          <div class="t-row" style="gap:8px;">
            <div class="t-field"><label>Bono</label><input type="number" name="bonus" value="${Number(d.bonus||0)}"></div>
            <div class="t-field"><label>Penal.</label><input type="number" name="diff" value="${Number(d.diff||0)}"></div>
          </div>
        </form>
      `,
      ok: {
        label: "Tirar",
        callback: (_event, button) => {
          const f = button.form;
          const out = {
            mode: needs ? (f.elements.mode?.value || d.mode || "learning") : "none",
            bonus: Number(f.elements.bonus?.value ?? d.bonus ?? 0),
            diff:  Number(f.elements.diff?.value  ?? d.diff  ?? 0)
          };
          return out;
        }
      }
    });
    if (!res) return;

    // Guarda lo que eligió para siguientes diálogos
    await this.actor.update({ "system.ui.rollDefaults.spec": { bonus: res.bonus, diff: res.diff, mode: res.mode } });

    const formula = `1d10 + ${base} + ${res.bonus} - ${res.diff}`;
    const rank = Number(foundry.utils.getProperty(this.actor, `system.progression.skills.${key}.rank`) || 0);

    const { resultRoll, otherRoll, usedPolicy } = await resolveEvolution({
      type: "specialization",
      mode: res.mode,
      formula,
      rank,
      flavor: `Especialización • ${row.querySelector("strong")?.textContent ?? key}`,
      actor: this.actor,
      meta: { key }
    });

    // (… resto igual: tarjeta GM con totals …)
    const blob = encodeURIComponent(JSON.stringify({
      actorId: this.actor.id ?? this.actor._id ?? null,
      key, rank,
      policy: usedPolicy,
      totalShown: resultRoll?.total ?? null,
      otherTotal: otherRoll?.total ?? null
    }));
    await ChatMessage.create({
      whisper: ChatMessage.getWhisperRecipients("GM").map(u => u.id),
      speaker: ChatMessage.getSpeaker({ actor: this.actor }),
      content: `
        <div class="tsdc-eval">
          <p><strong>Evaluar Especialización</strong> — Solo GM</p>
          <div class="t-row" style="gap:6px; flex-wrap:wrap;">
            <button class="t-btn tsdc-eval-btn" data-kind="specialization" data-blob="${blob}">Abrir evaluación…</button>
          </div>
          <div class="muted">No revela DC. Compara contra el TD/DF que elijas.</div>
        </div>
      `
    });
  }
  async #onAtkRoll() {
    const el = this.element;
    const selId = String(el.querySelector('select[name="atkWeapon"]')?.value || "");
    const selection = selId
      ? Inv.resolveWeaponSelection(this.actor, selId)
      : Inv.getEquippedWeaponChoice(this.actor, "main");
    const wKey = selection?.key ?? null;
    const isManeuver = !!el.querySelector('input[name="atkIsManeuver"]')?.checked;

    if (!selection) {
      ui.notifications?.warn("Selecciona un arma válida antes de atacar.");
      return;
    }
    if (selection.disabled) {
      ui.notifications?.warn(selection.disabledReason || "No puedes usar esa arma mientras la parte esté dañada.");
      return;
    }

    let attrKey = String(el.querySelector('select[name="atkAttr"]')?.value || "");
    if (!attrKey) {
      if (selection?.record) {
        attrKey = selection.record.attackAttr ?? "agility";
      } else {
        const def = wKey ? (getWeaponDef(wKey) || getNaturalWeaponDef(wKey)) : null;
        attrKey = def?.attackAttr || "agility";
      }
    }

    const bonus   = Number(el.querySelector('input[name="atkBonus"]')?.value || 0);
    const penalty = Number(el.querySelector('input[name="atkPenalty"]')?.value || 0);

    const { rollAttack } = await import("../rolls/dispatcher.js");
    await rollAttack(this.actor, { key: wKey, isManeuver, attrKey, bonus, penalty, mode: "ask" });
  }

  async #onImpRoll() {
    const el = this.element;
    const selId = String(el.querySelector('select[name="impWeapon"]')?.value || "");
    const selection = selId
      ? Inv.resolveWeaponSelection(this.actor, selId)
      : Inv.getEquippedWeaponChoice(this.actor, "main");
    const key = selection?.key ?? null;
    if (!selection) {
      ui.notifications?.warn("Selecciona un arma válida para calcular el impacto.");
      return;
    }
    if (selection.disabled) {
      ui.notifications?.warn(selection.disabledReason || "No puedes usar esa arma mientras la parte esté dañada.");
      return;
    }
    let die = "d6";
    let grade = 1;
    let attrKey = "agility";
    let weaponItem = selection?.item ?? null;

    if (selection?.record) {
      die = selection.record.damageDie ?? selection.item?.damageDie ?? "d6";
      grade = Number(selection.item?.grade ?? 1);
      attrKey = selection.record.impactAttr ?? selection.record.attackAttr ?? "agility";
    } else {
      const def = key ? getWeaponDef(key) : null;
      die   = def?.damageDie || die;
      grade = Number(selection?.item?.grade ?? def?.grade ?? grade);
      attrKey = def?.attackAttr || attrKey;
    }

    const bonus   = Number(el.querySelector('input[name="impBonus"]')?.value || 0);

    const { rollImpact } = await import("../rolls/dispatcher.js");
    await rollImpact(this.actor, { key, die, grade, attrKey, bonus, weaponItem: weaponItem ?? null });
  }

  async #onDefRoll() {
    const el = this.element;
    const armorType  = String(el.querySelector('select[name="defArmorType"]')?.value || "light");
    const armorBonus = computeArmorBonusFromEquipped(this.actor);
    const bonus   = Number(el.querySelector('input[name="defBonus"]')?.value || 0);
    const penalty = Number(el.querySelector('input[name="defPenalty"]')?.value || 0);
    const { rollDefense } = await import("../rolls/dispatcher.js");
    await rollDefense(this.actor, { armorType, armorBonus, bonus, penalty, mode: "ask" });
  }

  async #onResRoll() {
    const el = this.element;
    const type    = String(el.querySelector('select[name="resType"]')?.value || "poison");
    const bonus   = Number(el.querySelector('input[name="resBonus"]')?.value || 0);
    const penalty = Number(el.querySelector('input[name="resPenalty"]')?.value || 0);
    const { rollResistance } = await import("../rolls/dispatcher.js");
    await rollResistance(this.actor, { type, bonus, penalty });
  }
}
