// modules/features/weapons/data.js
// Catálogo de armas. Campos mínimos para fórmulas + textos de bonificadores.

export const WEAPONS = {
  // === LANZAS ===
  lancea: {
    label: "Lancea",
    family: "spear",           // familia/tipo amplio
    hands: 2,
    damageDie: "d12",          // dado base para IMPACTO
    grade: 1,                  // grado (multiplica atributo en IMPACTO)
    reach: 2,                  // metros (informativo)
    weight: 4.0,               // kg (informativo)
    attackAttr: "strength",    // atributo de ATAQUE para esta arma
    assign: "main",            // "main"|"off"
    bonusText: "+1 por rango de competencia a T.A contra montados o grandes."
  },

  partesana: {
    label: "Partesana",
    family: "spear",
    hands: 2,
    damageDie: "d10",
    grade: 1,
    reach: 2,
    weight: 4.5,
    attackAttr: "tenacity",
    assign: "main",
    bonusText: "+1 por rango a T.A cuando atacas a máximo alcance."
  },

  kontos: {
    label: "Kontos",
    family: "spear",
    hands: 2,
    damageDie: "d12",
    grade: 1,
    reach: 2,
    weight: 5.0,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+1 por rango al daño contra enemigos sin escudo."
  },

  // === HACHA (algunos ejemplos) ===
  alabarda: {
    label: "Alabarda",
    family: "axe",
    hands: 2,
    damageDie: "d10",
    grade: 1,
    reach: 2,
    weight: 4.5,
    attackAttr: "tenacity",
    assign: "main",
    bonusText: "+1 por rango a T.I a máximo alcance."
  },

  naginata: {
    label: "Naginata",
    family: "axe",
    hands: 2,
    damageDie: "d12",
    grade: 1,
    reach: 2,
    weight: 4.5,
    attackAttr: "cunning",
    assign: "main",
    bonusText: "+1 por rango a T.I al usarla en reacciones."
  },

  // === HOJAS LARGAS (ejemplo) ===
  katana: {
    label: "Katana",
    family: "longblade",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 1.2,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+3 por rango a T.I si se usa a dos manos."
  },

  // === DAGAS (ejemplo) ===
  sai: {
    label: "Sai",
    family: "dagger",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 1,
    weight: 0.7,
    attackAttr: "agility",
    assign: "off",
    bonusText: "+1 por rango a T.D para desviar/bloquear cuerpo a cuerpo."
  },

  // Agrega el resto de tu lista siguiendo este mismo esquema…
};
