import { rollAttack } from "../rolls/dispatcher.js";
import { buildPerceptionPackage, packageToRollContext, describePackage, estimateCoverFromPoint } from "../perception/index.js";
import { getEquippedWeaponKey } from "../features/inventory/index.js";
import { weaponRangeM } from "../combat/range.js";
import { metersBetweenTokenAndToken, metersBetweenPointAndToken, pickCanvasPoint, tokensInRadius } from "../combat/targeting.js";
import { validateAttackRangeAndVision } from "../rolls/validators.js"; // ya te valida mono-objetivo

function coverToCtx(cover) {
  return cover === "light" ? "partial" : cover === "medium" ? "heavy" : cover === "total" ? "total" : "none";
}

function emitResistancePrompt({ actor, victimToken, feature }) {
  const blob = encodeURIComponent(JSON.stringify({
    actorId: victimToken.actor?.id,
    resType: feature.element || feature.descriptor || "area",
    dc: Number(feature?.save?.dc ?? NaN)   // si no hay DC, el dialogo lo pedirá
  }));
  const btn = `<button class="tsdc-eval-btn" data-kind="resistance" data-blob="${blob}">TR de ${victimToken.name}</button>`;
  ChatMessage.create({
    speaker: ChatMessage.getSpeaker({ actor }),
    content: `<p><b>${feature.label}</b> afecta a <b>${victimToken.name}</b> — ${btn}</p>`
  });
}

export async function performFeature({ actor, feature, meta = {} }) {
  const actorToken = actor?.getActiveTokens?.(true)?.[0]
    ?? canvas?.tokens?.placeables?.find?.(t => t?.actor?.id === actor.id);
  if (!actorToken) return;

  const wKey   = meta.weaponKey ?? getEquippedWeaponKey(actor, "main");
  const rangeM = Number.isFinite(feature?.range) ? Number(feature.range) : weaponRangeM(actor, wKey);
  const areaM  = Math.max(0, Number(feature?.area || 0));

  /* == A) Área > 0: objetivo es un punto == */
  if (areaM > 0) {
    const center = meta.center || await pickCanvasPoint({ hint:`${feature.label}: elige el centro del área…` });

    // Rango al centro
    if (Number.isFinite(rangeM)) {
      const distM = metersBetweenPointAndToken(center, actorToken);
      if (distM > rangeM) {
        return ui.notifications?.info(`No alcanzas el punto (${Math.round(distM)} m > ${rangeM} m).`);
      }
    }

    const victims = tokensInRadius(center, areaM, { excludeIds:[actorToken.id], hostileTo: actorToken });

    await ChatMessage.create({
      speaker: ChatMessage.getSpeaker({ actor }),
      content: `<p><b>${feature.label}</b> (área r=${areaM} m). Objetivos: ${victims.map(v=>`<b>${v.name}</b>`).join(", ") || "—"}.</p>`
    });
    if (!victims.length) return;

    for (const t of victims) {
      // Cobertura desde el centro del área
      const cover = estimateCoverFromPoint(center, t);
      if (cover === "total") {
        await ChatMessage.create({ content:`<p>${t.name} queda a <b>cobertura total</b> respecto al centro del área.</p>` });
        continue;
      }

      // Si la feature pide TR → no hay tirada de ataque
      if (feature.save) {
        emitResistancePrompt({ actor, victimToken: t, feature });
        continue;
      }

      // Ataque “de área” (misma tirada que tus armas/manio.); hints por si el dispatcher los usa.
      const ctx = {
        vision: "normal",
        cover: coverToCtx(cover),
        extraTags: ["feature", feature.clazz, feature.descriptor, feature.element].filter(Boolean),
        hints: { attackAttr: feature.attackAttr, impactAttr: feature.impactAttr }
      };
      await rollAttack(actor, {
        key: wKey ?? undefined,
        flavor: `${feature.clazz?.toUpperCase?.() || "ACC"} • ${feature.label} (área r=${areaM} m) contra ${t.name}`,
        mode: "ask",
        context: ctx
      });
    }
    return;
  }

  /* == B) Mono-objetivo (area = 0): usa tu validador estándar == */
  const targetToken = meta.targetToken
    ?? Array.from(game.user?.targets ?? [])[0]
    ?? null;

  if (!targetToken?.actor) {
    return ui.notifications?.warn("Selecciona (target) un objetivo válido.");
  }

  // Si es “TR en mono-objetivo”:
  if (feature.save) {
    const dist = metersBetweenTokenAndToken(actorToken, targetToken);
    if (Number.isFinite(rangeM) && dist > rangeM) {
      return ui.notifications?.info(`Fuera de rango (${Math.round(dist)} m > ${rangeM} m).`);
    }
    emitResistancePrompt({ actor, victimToken: targetToken, feature });
    return;
  }

  // Ataque tradicional: reusa tu pipeline de percepción/visión/cobertura
  const v = await validateAttackRangeAndVision({ attackerToken: actorToken, targetToken, weaponRangeM: rangeM });
  if (!v.ok) return ui.notifications?.warn(`Acción inválida: ${v.reason}`);

  const pkg = v.pkg;
  const ctx = Object.assign(packageToRollContext(pkg), {
    extraTags: ["feature", feature.clazz, feature.descriptor, feature.element].filter(Boolean),
    hints: { attackAttr: feature.attackAttr, impactAttr: feature.impactAttr }
  });

  await ChatMessage.create({
    content: `<div class="tsdc-perception">${describePackage(pkg)}</div>`,
    speaker: ChatMessage.getSpeaker({ actor })
  });
  if (pkg.attack_mod_from_cover === "unreachable") {
    return ui.notifications?.warn("Cobertura total: inalcanzable desde aquí.");
  }

  await rollAttack(actor, {
    key: wKey ?? undefined,
    flavor: `${feature.clazz?.toUpperCase?.() || "ACC"} • ${feature.label}`,
    mode: "ask",
    context: ctx
  });
}
