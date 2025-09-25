// Macro: Conceder botín (maniobra / poder / mapa) - Version corregida
(async ()=>{
  const SYS_ID = game.system?.id || "tsdc";
  const base = foundry.utils.getRoute(`systems/${SYS_ID}/modules/features/grants.js`);
  const { grantManeuver, grantRelicPower, grantNote } = await import(base);

  const sel = canvas.tokens.controlled.map(t => t.actor).filter(Boolean);
  if (!sel.length) return ui.notifications.warn("Selecciona al menos un token.");

  // Usar Dialog V1 mientras se estabiliza V2
  const form = await new Promise(resolve => {
    new Dialog({
      title: "Conceder a seleccionados",
      content: `
        <div class="form-group">
          <label>Tipo:</label>
          <select id="kind">
            <option value="maneuver">Maniobra</option>
            <option value="relic">Poder de reliquia</option>
            <option value="note">Mapa/Nota (Journal)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Clave / UUID:</label>
          <input id="key" type="text" placeholder="p.ej. 'barrido' o 'estallido_estelar' o 'Journal.xxxxx'"/>
        </div>
      `,
      buttons: {
        ok: {
          label: "Conceder",
          callback: html => resolve({
            kind: html.find("#kind").val(),
            key: html.find("#key").val()?.trim()
          })
        },
        cancel: {
          label: "Cancelar",
          callback: () => resolve(null)
        }
      },
      default: "ok"
    }).render(true);
  });

  if (!form?.key) return;

  for (const actor of sel) {
    try {
      if (form.kind === "maneuver") {
        await grantManeuver(actor, form.key, { source: "gm" });
      } else if (form.kind === "relic") {
        await grantRelicPower(actor, form.key, { source: "gm" });
      } else if (form.kind === "note") {
        const id = foundry.utils.randomID();
        await grantNote(actor, {
          id,
          label: `Nota: ${form.key}`,
          journalUUID: form.key
        });
      }
    } catch (e) {
      console.error(e);
      ui.notifications.error(`Error con ${actor.name}: ${e.message}`);
    }
  }
})();