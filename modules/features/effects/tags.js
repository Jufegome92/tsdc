// modules/features/effects/tags.js
export function applyWeaponTagsReminder(actor, weaponDef) {
  if (!weaponDef?.tags?.length) return;
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<div class="tsdc-tags"><b>Rasgos del arma:</b> ${weaponDef.tags.join(", ")}</div>`
  });
}
