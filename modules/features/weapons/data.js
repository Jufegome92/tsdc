// modules/features/weapons/data.js
// Catálogo de armas. Campos mínimos para fórmulas + textos de bonificadores.

export const DAMAGE_TYPES = {
  Ct: "slashing",     // Cortante
  Pf: "piercing",     // Perforante
  Cd: "bludgeoning"   // Contundente
};

export const WEAPONS = {
  // =================
  // === LANZAS ===
  // =================
  lancea: {
    label: "Lancea",
    damageType: ["piercing"],
    family: "spear",
    hands: 2,
    damageDie: "d12",
    grade: 1,
    reach: 2,
    weight: 4.0,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A cuando se usa contra enemigos sobre montura o de gran tamaño."
  },
  partesana: {
    label: "Partesana",
    damageType: ["piercing","slashing"],
    family: "spear",
    hands: 2,
    damageDie: "d10",
    grade: 1,
    reach: 2,
    weight: 4.5,
    attackAttr: "tenacity",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A cuando se realiza un ataque a su máximo alcance."
  },
  kontos: {
    label: "Kontos",
    damageType: ["piercing"],
    family: "spear",
    hands: 2,
    damageDie: "d12",
    grade: 1,
    reach: 2,
    weight: 5.0,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+1 por rango de competencia al daño contra enemigos que no llevan escudo."
  },
  yari: {
    label: "Yari",
    damageType: ["piercing"],
    family: "spear",
    hands: 2,
    damageDie: "d12",
    grade: 1,
    reach: 2,
    weight: 4.2,
    attackAttr: "cunning",
    assign: "main",
    bonusText: "Ignora 1 punto de reducción de daño por rango de competencia."
  },
  hasta: {
    label: "Hasta",
    damageType: ["piercing"],
    family: "spear",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 2.5,
    attackAttr: "cunning",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.D si se usa para bloquear un ataque a corta distancia."
  },
  dory: {
    label: "Dory",
    damageType: ["piercing"],
    family: "spear",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 2.3,
    attackAttr: "agility",
    assign: "main",
    bonusText: "Aumenta 1 nivel de dado cuando se usa como arma arrojadiza."
  },
  ranseur: {
    label: "Ranseur",
    damageType: ["piercing"],
    family: "spear",
    hands: 2,
    damageDie: "d10",
    grade: 1,
    reach: 2,
    weight: 5.2,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A cuando se usa durante una carga."
  },

  // =================
  // === HACHAS ===
  // =================
  guja: {
    label: "Guja",
    damageType: ["slashing","piercing"],
    family: "axe",
    hands: 2,
    damageDie: "d10",
    grade: 1,
    reach: 2,
    weight: 5.0,
    attackAttr: "strength",
    assign: "main",
    bonusText: "Ignora 1 punto de armadura por cada rango de competencia si el enemigo no lleva armadura pesada."
  },
  alabarda: {
    label: "Alabarda",
    damageType: ["slashing","piercing"],
    family: "axe",
    hands: 2,
    damageDie: "d10",
    grade: 1,
    reach: 2,
    weight: 4.5,
    attackAttr: "tenacity",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.I cuando se realiza un ataque a su máximo alcance."
  },
  naginata: {
    label: "Naginata",
    damageType: ["slashing"],
    family: "axe",
    hands: 2,
    damageDie: "d12",
    grade: 1,
    reach: 2,
    weight: 4.5,
    attackAttr: "cunning",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.I si se usa para realizar reacciones."
  },
  voulge: {
    label: "Voulge",
    damageType: ["slashing"],
    family: "axe",
    hands: 2,
    damageDie: "d12",
    grade: 1,
    reach: 2,
    weight: 5.5,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+1 a T.I cuando se enfrenta a enemigos sin escudo."
  },
  becdecorbin: {
    label: "Bec de Corbin",
    damageType: ["bludgeoning"],
    family: "axe",
    hands: 2,
    damageDie: "d10",
    grade: 1,
    reach: 2,
    weight: 4.8,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+1 por rango de competencia a la T.I contra enemigos con armaduras pesadas."
  },
  pudao: {
    label: "Pudao",
    damageType: ["slashing"],
    family: "axe",
    hands: 2,
    damageDie: "d12",
    grade: 1,
    reach: 2,
    weight: 5.3,
    attackAttr: "wisdom",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A por cada enemigo adyacente."
  },
  sagaris: {
    label: "Sagaris",
    damageType: ["slashing"],
    family: "axe",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 2.0,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.I cuando se enfrenta a enemigos con armaduras ligeras."
  },
  skeggox: {
    label: "Skeggøx",
    damageType: ["slashing"],
    family: "axe",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 2.0,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A cuando se usa en combate con dos armas."
  },
  labrys: {
    label: "Labrys",
    damageType: ["slashing"],
    family: "axe",
    hands: 2,
    damageDie: "d12",
    grade: 1,
    reach: 2,
    weight: 3.5,
    attackAttr: "tenacity",
    assign: "main",
    bonusText: "Ignora 1 punto de armadura por rango de competencia si se usa con ambas manos en ataque."
  },
  dolabra: {
    label: "Dolabra",
    damageType: ["bludgeoning"],
    family: "axe",
    hands: 1,
    damageDie: "d6",
    grade: 1,
    reach: 1,
    weight: 2.5,
    attackAttr: "tenacity",
    assign: "main",
    bonusText: "+3 por rango de competencia a T.I si se usa para romper objetos."
  },

  // =================
  // === MAZAS ===
  // =================
  morgenstern: {
    label: "Morgenstern",
    damageType: ["bludgeoning"],
    family: "mace",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 2.0,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.I contra armaduras medias."
  },
  nekhakha: {
    label: "Nekhakha",
    damageType: ["bludgeoning"],
    family: "mace",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 2.0,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A si se utiliza en reacción o contraataque."
  },
  kanabo: {
    label: "Kanabo",
    damageType: ["bludgeoning"],
    family: "mace",
    hands: 2,
    damageDie: "d10",
    grade: 1,
    reach: 2,
    weight: 5.0,
    attackAttr: "tenacity",
    assign: "main",
    bonusText: "Reduce en 1 el umbral para romper partes (no crítico)."
  },
  shillelagh: {
    label: "Shillelagh",
    damageType: ["bludgeoning"],
    family: "mace",
    hands: 1,
    damageDie: "d6",
    grade: 1,
    reach: 1,
    weight: 1.5,
    attackAttr: "wisdom",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A en maniobras defensivas o para desarmar."
  },
  shishpar: {
    label: "Shishpar",
    damageType: ["bludgeoning"],
    family: "mace",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 2.5,
    attackAttr: "cunning",
    assign: "main",
    bonusText: "Ignora 2 puntos de reducción de daño por rango de competencia contra enemigos desbalanceados/desequilibrados/derribados."
  },

  // =========================
  // === HOJAS LARGAS ===
  // =========================
  katana: {
    label: "Katana",
    damageType: ["slashing"],
    family: "longblade",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 1.2,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+3 por rango de competencia a T.I si se usa con ambas manos."
  },
  spatha: {
    label: "Spatha",
    damageType: ["slashing"],
    family: "longblade",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 1.0,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.I si se usa junto a escudo."
  },
  khopesh: {
    label: "Khopesh",
    damageType: ["slashing"],
    family: "longblade",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 1.5,
    attackAttr: "tenacity",
    assign: "main",
    bonusText: "Ignora 1 punto de armadura por rango de competencia contra escudos."
  },
  shamshir: {
    label: "Shamshir",
    damageType: ["slashing"],
    family: "longblade",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 1.0,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A si te has movido este turno."
  },
  claymore: {
    label: "Claymore",
    damageType: ["slashing"],
    family: "longblade",
    hands: 2,
    damageDie: "d12",
    grade: 1,
    reach: 2,
    weight: 2.5,
    attackAttr: "tenacity",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.I cuando enfrentas múltiples enemigos."
  },
  mandoble: {
    label: "Mandoble",
    damageType: ["slashing"],
    family: "longblade",
    hands: 2,
    damageDie: "d10",
    grade: 1,
    reach: 2,
    weight: 2.0,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A cuando se usa en un ataque de carga."
  },
  estoque: {
    label: "Estoque",
    damageType: ["piercing"],
    family: "longblade",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 1.1,
    attackAttr: "cunning",
    assign: "main",
    bonusText: "Ignora 2 puntos de reducción de daño por rango de competencia al atacar puntos vitales."
  },
  schiavona: {
    label: "Schiavona",
    damageType: ["slashing"],
    family: "longblade",
    hands: 1,
    damageDie: "d8",
    grade: 1,
    reach: 1,
    weight: 1.3,
    attackAttr: "wisdom",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A durante maniobras de Engaño y Acrobacias."
  },

  // ===============
  // === DAGAS ===
  // ===============
  sai: {
    label: "Sai",
    damageType: ["piercing"],
    family: "dagger",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 1,
    weight: 0.7,
    attackAttr: "agility",
    assign: "off",
    bonusText: "+1 por rango de competencia a T.D cuando desvías o bloqueas cuerpo a cuerpo."
  },
  jutte: {
    label: "Jutte",
    damageType: ["bludgeoning"],
    family: "dagger",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 1,
    weight: 0.6,
    attackAttr: "wisdom",
    assign: "off",
    bonusText: "+2 por rango de competencia a T.A al desarmar o inmovilizar."
  },
  scian: {
    label: "Scian",
    damageType: ["piercing"],
    family: "dagger",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 1,
    weight: 0.5,
    attackAttr: "agility",
    assign: "off",
    bonusText: "+2 por rango de competencia a T.I al atacar desde oculto o en sigilo."
  },
  kris: {
    label: "Kris",
    damageType: ["slashing"],
    family: "dagger",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 1,
    weight: 0.6,
    attackAttr: "cunning",
    assign: "off",
    bonusText: "Ignora 2 puntos de reducción de daño por rango de competencia contra enemigos heridos."
  },

  // ====================
  // === HOJAS CORTAS ===
  // ====================
  wakizashi: {
    label: "Wakizashi",
    damageType: ["slashing"],
    family: "shortblade",
    hands: 1,
    damageDie: "d6",
    grade: 1,
    reach: 1,
    weight: 0.9,
    attackAttr: "agility",
    assign: "off",
    bonusText: "+1 por rango de competencia a T.A cuando se usa con otra arma (dos armas)."
  },
  tanto: {
    label: "Tanto",
    damageType: ["slashing"],
    family: "shortblade",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 1,
    weight: 0.6,
    attackAttr: "agility",
    assign: "off",
    bonusText: "+1 por rango de competencia a T.I al atacar desde oculto o en sigilo."
  },
  kama: {
    label: "Kama",
    damageType: ["slashing"],
    family: "shortblade",
    hands: 1,
    damageDie: "d6",
    grade: 1,
    reach: 1,
    weight: 0.7,
    attackAttr: "agility",
    assign: "off",
    bonusText: "+2 por rango de competencia a T.I por cada ataque realizado durante la ronda."
  },
  claideamh: {
    label: "Claideamh",
    damageType: ["piercing"],
    family: "shortblade",
    hands: 1,
    damageDie: "d6",
    grade: 1,
    reach: 1,
    weight: 0.8,
    attackAttr: "strength",
    assign: "off",
    bonusText: "+1 por rango de competencia a T.A contra enemigos con armaduras ligeras."
  },
  seax: {
    label: "Seax",
    damageType: ["slashing"],
    family: "shortblade",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 1,
    weight: 0.7,
    attackAttr: "strength",
    assign: "off",
    bonusText: "+1 por rango de competencia a T.A en maniobras de un solo objetivo."
  },
  cimitarra: {
    label: "Cimitarra",
    damageType: ["slashing"],
    family: "shortblade",
    hands: 1,
    damageDie: "d6",
    grade: 1,
    reach: 1,
    weight: 0.8,
    attackAttr: "agility",
    assign: "main",
    bonusText: "Añade d2 de daño por rango de competencia cuando el enemigo obtiene una T.D exitosa."
  },
  akinakes: {
    label: "Akinakes",
    damageType: ["slashing"],
    family: "shortblade",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 1,
    weight: 0.7,
    attackAttr: "agility",
    assign: "main",
    bonusText: "Puedes generar ataques adicionales durante el combate con dos armas."
  },
  xiphos: {
    label: "Xiphos",
    damageType: ["slashing"],
    family: "shortblade",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 1,
    weight: 0.8,
    attackAttr: "agility",
    assign: "off",
    bonusText: "+1 por rango de competencia a las T.E de Destreza durante el combate con dos armas."
  },

  // ===================
  // === ARROJADIZA ===
  // ===================
  kunai: {
    label: "Kunai",
    damageType: ["piercing"],
    family: "thrown",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 10, // metros
    weight: 0.3,
    attackAttr: "agility",
    assign: "off",
    bonusText: "+1 por rango de competencia a T.A si se usa a la mitad de su alcance máximo."
  },
  shuriken: {
    label: "Shuriken",
    damageType: ["piercing"],
    family: "thrown",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 10,
    weight: 0.2,
    attackAttr: "agility",
    assign: "off",
    bonusText: "+1 por rango de competencia a T.A cuando se usan en serie."
  },
  pilum: {
    label: "Pilum",
    damageType: ["piercing"],
    family: "thrown",
    hands: 1,
    damageDie: "d6",
    grade: 1,
    reach: 10,
    weight: 1.5,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+2 por rango de competencia a T.I si atraviesa escudos o defensas al ser arrojada."
  },
  francisca: {
    label: "Francisca",
    damageType: ["slashing"],
    family: "thrown",
    hands: 1,
    damageDie: "d6",
    grade: 1,
    reach: 10,
    weight: 1.4,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.I al realizar ataques de carga o embestidas."
  },
  chakram: {
    label: "Chakram",
    damageType: ["slashing"],
    family: "thrown",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 12,
    weight: 0.4,
    attackAttr: "cunning",
    assign: "off",
    bonusText: "+1 por rango de competencia a T.A cuando ataca a más de una criatura."
  },

  // =================
  // === DISTANCIA ===
  // =================
  yumi: {
    label: "Yumi",
    damageType: ["by-ammo"], // Según proyectil, pero usamos dado de arma de la tabla
    family: "ranged",
    hands: 2,
    damageDie: "d8",
    grade: 1,
    reach: 30,
    weight: 1.0,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A si atacas objetivos a más de 15 metros."
  },
  gakgung: {
    label: "Gakgung",
    damageType: ["by-ammo"],
    family: "ranged",
    hands: 2,
    damageDie: "d6",
    grade: 1,
    reach: 20,
    weight: 1.0,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A si disparas desde oculto o sigilo."
  },
  fukiya: {
    label: "Fukiya",
    damageType: ["by-ammo"],
    family: "ranged",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 20,
    weight: 0.5,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.I en ataques de precisión a puntos vitales."
  },
  scythian: {
    label: "Scythian",
    damageType: ["by-ammo"],
    family: "ranged",
    hands: 2,
    damageDie: "d8",
    grade: 1,
    reach: 30,
    weight: 1.0,
    attackAttr: "strength",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A cuando disparas desde una montura."
  },
  balearic: {
    label: "Balearic",
    damageType: ["by-ammo"],
    family: "ranged",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 20,
    weight: 0.7,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A por cada ataque consecutivo en el mismo turno."
  },
  sumpit: {
    label: "Sumpit",
    damageType: ["by-ammo"],
    family: "ranged",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 20,
    weight: 0.5,
    attackAttr: "agility",
    assign: "main",
    bonusText: "+1 por rango de competencia a T.A al aplicar venenos o enfermedades."
  },

  // ===================
  // === FLEXIBLES ===
  // ===================
  kusarigama: {
    label: "Kusarigama",
    damageType: ["slashing","bludgeoning"], // hoz/cadena
    family: "flexible",
    hands: 2,
    damageDie: "d6", // hoz d6; cadena d4 (ver nota)
    grade: 1,
    reach: 1, // hoz a 1 m; cadena 3 m
    weight: 1.5,
    attackAttr: "agility",
    assign: "main",
    bonusText: "Hoz (d6, 1 m) y Cadena (d4, hasta 3 m). Selecciona modo al usarla."
  },
  scourge: {
    label: "Scourge",
    damageType: ["bludgeoning"],
    family: "flexible",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 3, // 1-3 m
    weight: 1.0,
    attackAttr: "strength",
    assign: "off",
    bonusText: "Alcance 1–3 m."
  },
  nekode: {
    label: "Nekode",
    damageType: ["slashing"],
    family: "flexible",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 1,
    weight: 0.5,
    attackAttr: "agility",
    assign: "off",
    bonusText: "Guantes con garras."
  },
  kusarifundo: {
    label: "Kusari Fundo",
    damageType: ["bludgeoning"],
    family: "flexible",
    hands: 2,
    damageDie: "d6",
    grade: 1,
    reach: 3,
    weight: 1.2,
    attackAttr: "cunning",
    assign: "main",
    bonusText: "Cadena con pesos; alcance 1–3 m."
  },
  guantesdearana: {
    label: "Guantes de Araña",
    damageType: ["slashing"],
    family: "flexible",
    hands: 1,
    damageDie: "d4",
    grade: 1,
    reach: 3,
    weight: 0.4,
    attackAttr: "agility",
    assign: "off",
    bonusText: "Garras retráctiles; alcance 1–3 m."
  },
  urumi: {
    label: "Urumi",
    damageType: ["slashing"],
    family: "flexible",
    hands: 1,
    damageDie: "d6",
    grade: 1,
    reach: 4,
    weight: 1.6,
    attackAttr: "agility",
    assign: "main",
    bonusText: "Espada látigo; alcance 1–4 m."
  }
};
