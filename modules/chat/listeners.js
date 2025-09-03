// modules/chat/listeners.js
export function registerChatListeners() {
  Hooks.on('renderChatMessageHTML', (message, html /*HTMLElement*/) => {
    const btn = html.querySelector('.tsdc-break-eval');
    if (!btn) return;

    btn.addEventListener('click', async (ev) => {
      ev.preventDefault();
      if (!game.user.isGM) {
        ui.notifications?.warn("Solo el GM puede evaluar rotura.");
        return;
      }

      const power = Number(btn.dataset.power || 0);

      const form = `
        <form class="t-col" style="gap:8px;">
          <div class="t-field">
            <label>Durabilidad del objetivo</label>
            <input type="number" name="dur" value="10" />
          </div>
          <div class="t-field">
            <label>Bonos situacionales (±)</label>
            <input type="number" name="bonus" value="0" />
          </div>
          <span class="muted">Se compara (Poder ${power} + bono) vs Durabilidad.</span>
        </form>
      `;

      const res = await Dialog.prompt({
        title: "Evaluar Rotura",
        label: "Evaluar",
        content: form,
        callback: (dlg) => {
          const dur   = Number(dlg.find('input[name="dur"]').val() || 0);
          const bonus = Number(dlg.find('input[name="bonus"]').val() || 0);
          return { dur, bonus };
        }
      });
      if (!res) return;

      const total = power + res.bonus;
      const ok = total >= res.dur;

      await ChatMessage.create({
        whisper: ChatMessage.getWhisperRecipients("GM"),
        content: `
          <p><strong>Rotura</strong> → Pot ${power}${res.bonus ? ` (${res.bonus>=0?'+':''}${res.bonus})` : ''} = <b>${total}</b> 
          vs Dur ${res.dur} → ${ok ? "💥 <b>ROMPE</b>" : "no rompe"}</p>
        `,
        speaker: message.speaker
      });
    }, { once: false });
  });
}
