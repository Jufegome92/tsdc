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
  }

  async _onDemoEvoRoll(ev) {
    ev.preventDefault();
    const root = this.element;
    const mode = root.find('select[name="evoMode"]').val() ?? "ask";
    const base = Number(root.find('input[name="base"]').val() || 0);
    const bonus = Number(root.find('input[name="bonus"]').val() || 0);
    const diff = Number(root.find('input[name="diff"]').val() || 0);
    const dc   = Number(root.find('input[name="dc"]').val() || 10);
    const rank = Number(root.find('input[name="rank"]').val() || 0);

    const formula = `1d10 + ${base} + ${bonus} - ${diff}`;
    await resolveEvolution({ type: "attack", mode, formula, rank, target: dc, flavor: "Sheet Test" });
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

    // Parámetros rápidos (puedes luego usar un HBS propio)
    const requiresChoice = requiresEvolutionChoice(key);
    const params = await Dialog.prompt({
      title: `Tirada • ${row.find("strong").text()}`,
      label: "Tirar",
      callback: (dlg) => {
        const mode = requiresChoice ? (dlg.find('select[name="mode"]').val() || "learning") : "none";
        const dc   = Number(dlg.find('input[name="dc"]').val() || 10);
        const bonus= Number(dlg.find('input[name="bonus"]').val() || 0);
        const diff = Number(dlg.find('input[name="diff"]').val() || 0);
        return { mode, dc, bonus, diff };
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
            <div class="t-field"><label>DC</label><input type="number" name="dc" value="10"/></div>
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

    const { learned, usedPolicy } = await resolveEvolution({
      type: "specialization",
      mode: params.mode,
      formula,
      rank,
      target: params.dc,
      flavor: `Especialización • ${row.find("strong").text()}`
    });

    // Progreso si aprendió en modo "learning"
    if (usedPolicy === "learning" && learned) {
      const cat = row.closest('[data-category]').attr('data-category');
      const threshold = getThresholdForSpec(this.actor, cat); // 5 si afín, 10 si no
      const pathBase = `system.progression.skills.${key}`;
      const current = foundry.utils.getProperty(this.actor, pathBase) || {};
      const nextProgress = Number(current.progress || 0) + 1;

      // Subidas de nivel/rango simples (nivel++ cuando llega al umbral; rango = ⌊nivel/3⌋)
      let level = Number(current.level || 0);
      let rankNow = Number(current.rank || 0);
      let progress = nextProgress;

      if (nextProgress >= threshold) {
        level += 1;
        progress = 0; // resetea progreso tras alcanzar umbral
        rankNow = Math.floor(level / 3);
        ui.notifications?.info(`¡Progresas en ${row.find("strong").text()}! Nivel ${level} (Rango ${rankNow})`);
      }

      await this.actor.update({
        [`${pathBase}.progress`]: progress,
        [`${pathBase}.level`]: level,
        [`${pathBase}.rank`]: rankNow
      });
    }
  }
}
