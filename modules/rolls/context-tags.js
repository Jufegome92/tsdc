/**
 * modules/rolls/context-tags.js
 * ------------------------------------------------------------
 * Vocabulario CANÓNICO de tags de contexto + normalizador y builder
 * para adjuntarlos en cualquier tirada (ataque, defensa, skill, salvación, impacto).
 *
 * Objetivo: que engine/effects puedan consultar un set estable de etiquetas,
 * sin acoplarse a UI ni a textos en español.
 *
 * - Mantén TODO en minúsculas y con ":" como separador jerárquico.
 * - Evita espacios; usa aliases ES si necesitas inputs en español.
 * - No hay números ni mecánicas aquí: sólo contexto declarativo.
 */

/** Catálogo canónico de tags (strings finales) */
export const TAGS = {
  /** Fase/tipo de tirada */
  phase: {
    attack: "phase:attack",
    defense: "phase:defense",
    skill: "phase:skill",
    save: "phase:save",          // salvaciones / resistencias
    impact: "phase:impact"       // tirada de impacto/daño
  },

  /** Subtipo de ataque */
  attack: {
    melee: "attack:melee",
    ranged: "attack:ranged",
    naturalRanged: "attack:natural-ranged" // armas naturales a distancia (para reglas de Desgaste)
  },

  /** Movimiento / postura / terreno */
  movement: "movement",                  // hubo movimiento relevante en el turno/acción
  movementRun: "movement:run",
  postureCrawl: "posture:crawl",         // arrastrarse
  terrainDifficult: "terrain:difficult", // terreno difícil

  /** Visión / percepción visual */
  vision: {
    normal: "vision:normal",
    limited: "vision:limited", // niebla/humo/lluvia/etc. que limitan
    none: "vision:none"        // oscuridad absoluta/ceguera efectiva
    // Nota: si quieres granularidad adicional, puedes añadir vision:range:<n> dinámico via builder
  },

  /** Dependencias sensoriales / componentes */
  soundDependent: "sound:dependent", // p.ej. acciones que requieren oír (eco, sonar, etc.)
  verbal: "verbal",                  // acciones/maniobras con componente verbal

  /** Elementos (básicos y compuestos de tu libro) */
  element: {
    fire: "element:fire",
    air: "element:air",
    earth: "element:earth",
    water: "element:water",
    light: "element:light",
    dark: "element:dark",

    // Compuestos / avanzados (opcionales)
    lightning: "element:lightning",   // Fuego + Viento
    steam: "element:steam",           // Fuego + Agua
    lava: "element:lava",             // Fuego + Tierra
    mud: "element:mud",               // Tierra + Agua
    crystal: "element:crystal",       // Tierra + Fuego
    mist: "element:mist",             // Agua + Viento
    void: "element:void",             // Luz + Oscuridad
    plasma: "element:plasma",         // Fuego + Luz
    aurora: "element:aurora",         // Viento + Luz
    petrify: "element:petrify",       // Tierra + Oscuridad
    corrosion: "element:corrosion"    // Oscuridad + Agua
  },

  /** Cobertura del objetivo */
  cover: {
    none: "target:in-cover:none",
    partial: "target:in-cover:partial", // “ligera”
    heavy: "target:in-cover:heavy",     // “media”
    total: "target:in-cover:total"
  },

  /** Condiciones del entorno (escala global) */
  envCond: {
    light: "env:cond:light",           // Leves
    normal: "env:cond:normal",         // Normales
    moderate: "env:cond:moderate",     // Moderadas
    severe: "env:cond:severe",         // Severas
    disastrous: "env:cond:disastrous"  // Desastrosas
  },

  /** Dificultad fallback (cuando el narrador no especifica DC) */
  envDC: {
    fundamentos: "env:dc:fundamentos",
    desafiante: "env:dc:desafiante",
    riguroso: "env:dc:riguroso",
    exigente: "env:dc:exigente",
    extremo: "env:dc:extremo"
  }
};

/**
 * Alias en español → tag canónico
 * Acepta sinónimos y variantes de escritura que aparecen en tu libro.
 */
export const ALIASES_ES = {
  // Subtipos de ataque
  "melee": TAGS.attack.melee,
  "cuerpo a cuerpo": TAGS.attack.melee,
  "a distancia": TAGS.attack.ranged,
  "ranged": TAGS.attack.ranged,
  "arma natural a distancia": TAGS.attack.naturalRanged,
  "natural ranged": TAGS.attack.naturalRanged,

  // Cobertura
  "cobertura:ninguna": TAGS.cover.none,
  "sin cobertura": TAGS.cover.none,
  "expuesto": TAGS.cover.none,
  "cobertura:ligera": TAGS.cover.partial,
  "cobertura:parcial": TAGS.cover.partial,
  "cobertura:media": TAGS.cover.heavy,
  "cobertura:pesada": TAGS.cover.heavy,
  "cobertura:total": TAGS.cover.total,

  // Visión
  "vision:normal": TAGS.vision.normal,
  "visión:normal": TAGS.vision.normal,
  "vision:limitada": TAGS.vision.limited,
  "visión:limitada": TAGS.vision.limited,
  "vision:nula": TAGS.vision.none,
  "visión:nula": TAGS.vision.none,
  "oscuridad absoluta": TAGS.vision.none,

  // Movimiento / terreno
  "movimiento": TAGS.movement,
  "correr": TAGS.movementRun,
  "run": TAGS.movementRun,
  "arrastrarse": TAGS.postureCrawl,
  "postura:arrastre": TAGS.postureCrawl,
  "terreno:dificil": TAGS.terrainDifficult,
  "terreno:difícil": TAGS.terrainDifficult,

  // Dependencias
  "sonido:dependiente": TAGS.soundDependent,
  "dependiente del sonido": TAGS.soundDependent,
  "verbal": TAGS.verbal,

  // Elementos básicos
  "fuego": TAGS.element.fire,
  "viento": TAGS.element.air,
  "aire": TAGS.element.air,
  "tierra": TAGS.element.earth,
  "agua": TAGS.element.water,
  "luz": TAGS.element.light,
  "oscuridad": TAGS.element.dark,

  // Elementos compuestos (alias frecuentes)
  "relampago": TAGS.element.lightning,
  "relámpago": TAGS.element.lightning,
  "electrico": TAGS.element.lightning,
  "eléctrico": TAGS.element.lightning,
  "vapor": TAGS.element.steam,
  "lava": TAGS.element.lava,
  "lodo": TAGS.element.mud,
  "cristal": TAGS.element.crystal,
  "niebla": TAGS.element.mist,
  "vacío": TAGS.element.void,
  "vacio": TAGS.element.void,
  "plasma": TAGS.element.plasma,
  "aurora": TAGS.element.aurora,
  "petrificación": TAGS.element.petrify,
  "petrificacion": TAGS.element.petrify,
  "corrosión": TAGS.element.corrosion,
  "corrosion": TAGS.element.corrosion,

  // Entorno (condiciones)
  "entorno:leve": TAGS.envCond.light,
  "condiciones leves": TAGS.envCond.light,
  "entorno:normal": TAGS.envCond.normal,
  "condiciones normales": TAGS.envCond.normal,
  "entorno:moderado": TAGS.envCond.moderate,
  "condiciones moderadas": TAGS.envCond.moderate,
  "entorno:severo": TAGS.envCond.severe,
  "condiciones severas": TAGS.envCond.severe,
  "entorno:desastroso": TAGS.envCond.disastrous,
  "condiciones desastrosas": TAGS.envCond.disastrous,
  "condiciones desastrozas": TAGS.envCond.disastrous, // variante con z de tu texto

  // Entorno (fallback DC)
  "fundamentos": TAGS.envDC.fundamentos,
  "desafiante": TAGS.envDC.desafiante,
  "riguroso": TAGS.envDC.riguroso,
  "exigente": TAGS.envDC.exigente,
  "extremo": TAGS.envDC.extremo
};

/** Enums aceptados por el builder (validación suave) */
export const ENUMS = {
  phase: ["attack", "defense", "skill", "save", "impact"],
  attackKind: ["melee", "ranged", "naturalRanged"],
  element: [
    "fire", "air", "earth", "water", "light", "dark",
    "lightning", "steam", "lava", "mud", "crystal", "mist", "void", "plasma", "aurora", "petrify", "corrosion"
  ],
  cover: ["none", "partial", "heavy", "total"],
  vision: ["normal", "limited", "none"],
  movement: [false, true, "run", "crawl"],
  terrain: [null, "difficult"],
  envCondition: ["light", "normal", "moderate", "severe", "disastrous"],
  envFallbackDC: ["fundamentos", "desafiante", "riguroso", "exigente", "extremo"]
};

/** Util: asegura array plano de strings */
function ensureArray(x) {
  if (x == null) return [];
  if (Array.isArray(x)) return x.flat().filter(Boolean);
  return [x];
}

/**
 * Normaliza un input (string|array) de etiquetas/alias a sus tags canónicos.
 * - Mantiene cualquier tag ya-canónico (no listado en alias).
 * - Ignora vacíos/undefined.
 * @param {string|string[]} input
 * @param {object} [opts]
 * @param {boolean} [opts.asSet=false] Si true, devuelve Set; si no, array sin duplicados
 */
export function normalizeTags(input, opts = {}) {
  const asSet = !!opts.asSet;
  const out = new Set();
  const push = (s) => {
    if (!s || typeof s !== "string") return;
    const key = s.trim().toLowerCase();
    out.add(ALIASES_ES[key] ?? key);
  };
  ensureArray(input).forEach(push);
  return asSet ? out : Array.from(out);
}

/**
 * Builder principal: crea el set de tags para una tirada concreta.
 *
 * @param {object} opts
 *  - phase: "attack"|"defense"|"skill"|"save"|"impact"
 *  - attackKind: "melee"|"ranged"|"naturalRanged"
 *  - element: uno de ENUMS.element
 *  - cover: "none"|"partial"|"heavy"|"total"  (cobertura del objetivo)
 *  - vision: "normal"|"limited"|"none"
 *  - movement: boolean|"run"|"crawl"
 *  - terrain: "difficult"|null
 *  - soundDependent: boolean
 *  - verbal: boolean
 *  - envCondition: "light"|"normal"|"moderate"|"severe"|"disastrous"
 *  - envFallbackDC: "fundamentos"|"desafiante"|"riguroso"|"exigente"|"extremo"
 *  - visionRangeMeters?: number   (opcional, para adjuntar tag vision:range:<n>)
 *  - extra?: string|string[]      (tags o alias adicionales a inyectar tal cual)
 *
 * @returns {string[]} array de tags canónicos (sin duplicados)
 */
export function buildContextTags(opts = {}) {
  const t = new Set();

  // Fase
  if (opts.phase && ENUMS.phase.includes(opts.phase)) {
    t.add(TAGS.phase[opts.phase]);
  }

  // Subtipo de ataque
  if (opts.attackKind && ENUMS.attackKind.includes(opts.attackKind)) {
    const map = {
      melee: TAGS.attack.melee,
      ranged: TAGS.attack.ranged,
      naturalRanged: TAGS.attack.naturalRanged
    };
    t.add(map[opts.attackKind]);
  }

  // Elemento
  if (opts.element && ENUMS.element.includes(opts.element)) {
    t.add(TAGS.element[opts.element]);
  }

  // Cobertura del objetivo
  if (opts.cover && ENUMS.cover.includes(opts.cover)) {
    t.add(TAGS.cover[opts.cover]);
  }

  // Visión
  if (opts.vision && ENUMS.vision.includes(opts.vision)) {
    t.add(TAGS.vision[opts.vision]);
  }

  // Visión cuantitativa (opcional): adjunta tag específico
  if (typeof opts.visionRangeMeters === "number" && isFinite(opts.visionRangeMeters) && opts.visionRangeMeters >= 0) {
    t.add(`vision:range:${Math.round(opts.visionRangeMeters)}`);
  }

  // Movimiento / terreno
  if (opts.movement) {
    t.add(TAGS.movement);
    if (opts.movement === "run") t.add(TAGS.movementRun);
    if (opts.movement === "crawl") t.add(TAGS.postureCrawl);
  }
  if (opts.terrain === "difficult") {
    t.add(TAGS.terrainDifficult);
  }

  // Dependencias
  if (opts.soundDependent) t.add(TAGS.soundDependent);
  if (opts.verbal) t.add(TAGS.verbal);

  // Entorno (condición global) + fallback DC
  if (opts.envCondition && ENUMS.envCondition.includes(opts.envCondition)) {
    const key = opts.envCondition;
    t.add(TAGS.envCond[key]);
  }
  if (opts.envFallbackDC && ENUMS.envFallbackDC.includes(opts.envFallbackDC)) {
    const key = opts.envFallbackDC;
    t.add(TAGS.envDC[key]);
  }

  // Extra (tags o alias arbitrarios)
  normalizeTags(opts.extra).forEach(x => t.add(x));

  return Array.from(t);
}

/**
 * Helper de consulta simple (por si lo quieres usar donde no tengas tus otros helpers):
 * - Coincidencia exacta o por prefijo con '*', ej: hasTag(tags, "attack:*")
 * @param {Iterable<string>} tags
 * @param {string} pattern  e.g. "attack:ranged" | "attack:*" | "env:cond:severe"
 */
export function hasTag(tags, pattern) {
  if (!tags || !pattern) return false;
  const list = Array.isArray(tags) ? tags : Array.from(tags);
  const p = String(pattern).toLowerCase().trim();
  const isWild = p.endsWith("*");
  if (!isWild) return list.includes(p);
  const pref = p.slice(0, -1);
  return list.some(t => t.startsWith(pref));
}

/**
 * Combina múltiples listas/sets de tags (normaliza, quita duplicados).
 * @param  {...any} many
 * @returns {string[]}
 */
export function mergeTags(...many) {
  const out = new Set();
  for (const chunk of many) {
    normalizeTags(chunk).forEach(t => out.add(t));
  }
  return Array.from(out);
}
