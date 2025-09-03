// modules/sheets/actor-sheet.js
import { listSpecs, getAttributeForSpec, baseFromSpec, requiresEvolutionChoice, usesCalc } from "../features/specializations/index.js";
import { resolveEvolution } from "../features/advantage/index.js";
import { BACKGROUNDS, getBackground, setBackground, getThresholdForSpec } from "../features/affinities/index.js";

export class TSDCActorSheet extends ActorSheet {
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
    return data;
  }

  activateListeners(html) {
    super.activateListeners(html);
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
      const key = String(r.find('input[name="atkKey"]').val() || "").trim();
      const isManeuver = r.find('input[name="atkIsManeuver"]').is(':checked');
      const attrKey = String(r.find('select[name="atkAttr"]').val() || "agility");
      const bonus = Number(r.find('input[name="atkBonus"]').val() || 0);
      const penalty = Number(r.find('input[name="atkPenalty"]').val() || 0);

      const { rollAttack } = await import("../rolls/dispatcher.js");
      await rollAttack(this.actor, { key, isManeuver, attrKey, bonus, penalty, mode:"ask" });
    });

    // IMPACTO
    html.find('[data-action="imp-roll"]').on("click", async (ev) => {
      ev.preventDefault();
      const r = this.element;
      const key   = String(r.find('input[name="impKey"]').val() || "").trim();
      const die   = String(r.find('select[name="impDie"]').val() || "d6");
      const grade = Number(r.find('input[name="impGrade"]').val() || 1);
      const attrKey = String(r.find('select[name="impAttr"]').val() || "agility");
      const bonus = Number(r.find('input[name="impBonus"]').val() || 0);

      const { rollImpact } = await import("../rolls/dispatcher.js");
      await rollImpact(this.actor, { key, die, grade, attrKey, bonus });
    });

    // DEFENSA
    html.find('[data-action="def-roll"]').on("click", async (ev) => {
      ev.preventDefault();
      const r = this.element;
      const armorType  = String(r.find('select[name="defArmorType"]').val() || "light"); // para progreso en fallo
      const armorBonus = Number(r.find('input[name="defArmorBonus"]').val() || 0);
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
