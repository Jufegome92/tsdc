// modules/data/weapons-armor-catalog.js
// Catálogo completo de armas y armaduras del sistema TSDC

export const WEAPON_TYPES = {
  lanzas: "Lanzas",
  hachas: "Hachas",
  mazas: "Mazas",
  hojas_largas: "Hojas Largas",
  hojas_cortas: "Hojas Cortas",
  dagas: "Dagas",
  arrojadizas: "Arrojadizas",
  distancia: "Distancia",
  flexibles: "Flexibles"
};

export const ARMOR_TYPES = {
  peto: "Peto",
  pantalones: "Pantalones",
  botas: "Botas",
  brazales: "Brazales",
  casco: "Casco",
  escudos: "Escudos",
  joyas: "Joyas"
};

export const WEAPONS_CATALOG = {
  // ============ LANZAS ============
  lancea: {
    label: "Lancea",
    type: "lanzas",
    damageType: "perforante",
    hands: 2,
    damage: "d12",
    reach: "2mts",
    weight: "4kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+1 por rango a T.A contra enemigos sobre montura o gran tamaño"
  },
  partesana: {
    label: "Partesana",
    type: "lanzas",
    damageType: "perforante/cortante",
    hands: 2,
    damage: "d10",
    reach: "2mts",
    weight: "4.5kg",
    attribute: "tenacidad",
    slot: "principal",
    bonus: "+1 por rango a T.A en ataques a máximo alcance"
  },
  kontos: {
    label: "Kontos",
    type: "lanzas",
    damageType: "perforante",
    hands: 2,
    damage: "d12",
    reach: "2mts",
    weight: "5kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "+1 por rango al daño contra enemigos sin escudo"
  },
  yari: {
    label: "Yari",
    type: "lanzas",
    damageType: "perforante",
    hands: 2,
    damage: "d12",
    reach: "2mts",
    weight: "4.2kg",
    attribute: "astucia",
    slot: "principal",
    bonus: "Ignora 1 punto de reducción de daño por rango"
  },
  hasta: {
    label: "Hasta",
    type: "lanzas",
    damageType: "perforante",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "2.5kg",
    attribute: "astucia",
    slot: "principal",
    bonus: "+1 por rango a T.D si bloquea ataque a corta distancia"
  },
  dory: {
    label: "Dory",
    type: "lanzas",
    damageType: "perforante",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "2.3kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "Aumento de nivel de dado como arma arrojadiza"
  },
  ranseur: {
    label: "Ranseur",
    type: "lanzas",
    damageType: "perforante",
    hands: 2,
    damage: "d10",
    reach: "2mts",
    weight: "5.2kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+1 por rango a T.A durante carga"
  },

  // ============ HACHAS ============
  guja: {
    label: "Guja",
    type: "hachas",
    damageType: "cortante/perforante",
    hands: 2,
    damage: "d10",
    reach: "2mts",
    weight: "5kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "Ignora 1 punto de armadura por rango si enemigo no tiene armadura pesada"
  },
  alabarda: {
    label: "Alabarda",
    type: "hachas",
    damageType: "cortante/perforante",
    hands: 2,
    damage: "d10",
    reach: "2mts",
    weight: "4.5kg",
    attribute: "tenacidad",
    slot: "principal",
    bonus: "+1 por rango a T.I en ataques a máximo alcance"
  },
  naginata: {
    label: "Naginata",
    type: "hachas",
    damageType: "cortante",
    hands: 2,
    damage: "d12",
    reach: "2mts",
    weight: "4.5kg",
    attribute: "astucia",
    slot: "principal",
    bonus: "+1 por rango a T.I en reacciones"
  },
  voulge: {
    label: "Voulge",
    type: "hachas",
    damageType: "cortante",
    hands: 2,
    damage: "d12",
    reach: "2mts",
    weight: "5.5kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "+1 a T.I contra enemigos sin escudo"
  },
  bec_de_corbin: {
    label: "Bec de Corbin",
    type: "hachas",
    damageType: "contundente",
    hands: 2,
    damage: "d10",
    reach: "2mts",
    weight: "4.8kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+1 por rango a T.I contra armaduras pesadas"
  },
  pudao: {
    label: "Pudao",
    type: "hachas",
    damageType: "cortante",
    hands: 2,
    damage: "d12",
    reach: "2mts",
    weight: "5.3kg",
    attribute: "sabiduria",
    slot: "principal",
    bonus: "+1 por rango a T.A por cada enemigo adyacente"
  },
  sagaris: {
    label: "Sagaris",
    type: "hachas",
    damageType: "cortante",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "2kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+1 por rango a T.I contra armaduras ligeras"
  },
  skeggox: {
    label: "Skeggøx",
    type: "hachas",
    damageType: "cortante",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "2kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+1 por rango a T.A en combate con dos armas"
  },
  labrys: {
    label: "Labrys",
    type: "hachas",
    damageType: "cortante",
    hands: 2,
    damage: "d12",
    reach: "2mts",
    weight: "3.5kg",
    attribute: "tenacidad",
    slot: "principal",
    bonus: "Ignora 1 punto de armadura por rango con ambas manos"
  },
  dolabra: {
    label: "Dolabra",
    type: "hachas",
    damageType: "contundente",
    hands: 1,
    damage: "d6",
    reach: "1mt",
    weight: "2.5kg",
    attribute: "tenacidad",
    slot: "principal",
    bonus: "+3 por rango a T.I para romper objetos"
  },

  // ============ MAZAS ============
  morgenstern: {
    label: "Morgenstern",
    type: "mazas",
    damageType: "contundente",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "2kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+1 por rango a T.I contra armaduras medias"
  },
  nekhakha: {
    label: "Nekhakha",
    type: "mazas",
    damageType: "contundente",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "2kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "+1 por rango a T.A en reacciones o contraataques"
  },
  kanabo: {
    label: "Kanabo",
    type: "mazas",
    damageType: "contundente",
    hands: 2,
    damage: "d10",
    reach: "2mts",
    weight: "5kg",
    attribute: "tenacidad",
    slot: "principal",
    bonus: "Reduce en 1 el umbral para romper partes"
  },
  shillelagh: {
    label: "Shillelagh",
    type: "mazas",
    damageType: "contundente",
    hands: 1,
    damage: "d6",
    reach: "1mt",
    weight: "1.5kg",
    attribute: "sabiduria",
    slot: "principal",
    bonus: "+1 por rango a T.A en maniobras defensivas o desarme"
  },
  shishpar: {
    label: "Shishpar",
    type: "mazas",
    damageType: "contundente",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "2.5kg",
    attribute: "astucia",
    slot: "principal",
    bonus: "Ignora 2 puntos de reducción por rango contra enemigos desbalanceados"
  },

  // ============ HOJAS LARGAS ============
  katana: {
    label: "Katana",
    type: "hojas_largas",
    damageType: "cortante",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "1.2kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "+3 por rango a T.I con ambas manos"
  },
  spatha: {
    label: "Spatha",
    type: "hojas_largas",
    damageType: "cortante",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "1kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+1 por rango a T.I con escudo"
  },
  khopesh: {
    label: "Khopesh",
    type: "hojas_largas",
    damageType: "cortante",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "1.5kg",
    attribute: "tenacidad",
    slot: "principal",
    bonus: "Ignora 1 punto de armadura por rango contra escudos"
  },
  shamshir: {
    label: "Shamshir",
    type: "hojas_largas",
    damageType: "cortante",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "1kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "+1 por rango a T.A si se movió este turno"
  },
  claymore: {
    label: "Claymore",
    type: "hojas_largas",
    damageType: "cortante",
    hands: 2,
    damage: "d12",
    reach: "2mts",
    weight: "2.5kg",
    attribute: "tenacidad",
    slot: "principal",
    bonus: "+1 por rango a T.I contra múltiples enemigos"
  },
  mandoble: {
    label: "Mandoble",
    type: "hojas_largas",
    damageType: "cortante",
    hands: 2,
    damage: "d10",
    reach: "2mts",
    weight: "2kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+1 por rango a T.A en ataque de carga"
  },
  estoque: {
    label: "Estoque",
    type: "hojas_largas",
    damageType: "perforante",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "1.1kg",
    attribute: "astucia",
    slot: "principal",
    bonus: "Ignora 2 puntos de reducción por rango en puntos vitales"
  },
  schiavona: {
    label: "Schiavona",
    type: "hojas_largas",
    damageType: "cortante",
    hands: 1,
    damage: "d8",
    reach: "1mt",
    weight: "1.3kg",
    attribute: "sabiduria",
    slot: "principal",
    bonus: "+1 por rango a T.A en maniobras de Engaño y Acrobacias"
  },

  // ============ HOJAS CORTAS ============
  wakizashi: {
    label: "Wakizashi",
    type: "hojas_cortas",
    damageType: "cortante",
    hands: 1,
    damage: "d6",
    reach: "1mt",
    weight: "0.9kg",
    attribute: "agilidad",
    slot: "auxiliar",
    bonus: "+1 por rango a T.A en combate con dos armas"
  },
  tanto: {
    label: "Tanto",
    type: "hojas_cortas",
    damageType: "cortante",
    hands: 1,
    damage: "d4",
    reach: "1mt",
    weight: "0.6kg",
    attribute: "agilidad",
    slot: "auxiliar",
    bonus: "+1 por rango a T.I desde posición oculta"
  },
  kama: {
    label: "Kama",
    type: "hojas_cortas",
    damageType: "cortante",
    hands: 1,
    damage: "d6",
    reach: "1mt",
    weight: "0.7kg",
    attribute: "agilidad",
    slot: "auxiliar",
    bonus: "+2 por rango a T.I por cada ataque en la ronda"
  },
  claideamh: {
    label: "Claideamh",
    type: "hojas_cortas",
    damageType: "perforante",
    hands: 1,
    damage: "d6",
    reach: "1mt",
    weight: "0.8kg",
    attribute: "fuerza",
    slot: "auxiliar",
    bonus: "+1 por rango a T.A contra armaduras ligeras"
  },
  seax: {
    label: "Seax",
    type: "hojas_cortas",
    damageType: "cortante",
    hands: 1,
    damage: "d4",
    reach: "1mt",
    weight: "0.7kg",
    attribute: "fuerza",
    slot: "auxiliar",
    bonus: "+1 por rango a T.A en maniobras con un solo objetivo"
  },
  cimitarra: {
    label: "Cimitarra",
    type: "hojas_cortas",
    damageType: "cortante",
    hands: 1,
    damage: "d6",
    reach: "1mt",
    weight: "0.8kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "d2 por rango de daño cuando enemigo obtiene T.D exitosa"
  },
  akinakes: {
    label: "Akinakes",
    type: "hojas_cortas",
    damageType: "cortante",
    hands: 1,
    damage: "d4",
    reach: "1mt",
    weight: "0.7kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "Ataques adicionales en combate con dos armas"
  },
  xiphos: {
    label: "Xiphos",
    type: "hojas_cortas",
    damageType: "cortante",
    hands: 1,
    damage: "d4",
    reach: "1mt",
    weight: "0.8kg",
    attribute: "agilidad",
    slot: "auxiliar",
    bonus: "+1 por rango a T.E de Destreza en combate con dos armas"
  },

  // ============ DAGAS ============
  sai: {
    label: "Sai",
    type: "dagas",
    damageType: "perforante",
    hands: 1,
    damage: "d4",
    reach: "1mt",
    weight: "0.7kg",
    attribute: "agilidad",
    slot: "auxiliar",
    bonus: "+1 por rango a T.D para desviar/bloquear cuerpo a cuerpo"
  },
  jutte: {
    label: "Jutte",
    type: "dagas",
    damageType: "contundente",
    hands: 1,
    damage: "d4",
    reach: "1mt",
    weight: "0.6kg",
    attribute: "sabiduria",
    slot: "auxiliar",
    bonus: "+2 por rango a T.A para desarmar/inmovilizar"
  },
  scian: {
    label: "Scian",
    type: "dagas",
    damageType: "perforante",
    hands: 1,
    damage: "d4",
    reach: "1mt",
    weight: "0.5kg",
    attribute: "agilidad",
    slot: "auxiliar",
    bonus: "+2 por rango a T.I desde sigilo"
  },
  kris: {
    label: "Kris",
    type: "dagas",
    damageType: "cortante",
    hands: 1,
    damage: "d4",
    reach: "1mt",
    weight: "0.6kg",
    attribute: "astucia",
    slot: "auxiliar",
    bonus: "Ignora 2 puntos de reducción por rango contra enemigos heridos"
  },

  // ============ ARROJADIZAS ============
  kunai: {
    label: "Kunai",
    type: "arrojadizas",
    damageType: "perforante",
    hands: 1,
    damage: "d4",
    reach: "10mts",
    weight: "0.3kg",
    attribute: "agilidad",
    slot: "auxiliar",
    bonus: "+1 por rango a T.A a mitad de alcance"
  },
  shuriken: {
    label: "Shuriken",
    type: "arrojadizas",
    damageType: "perforante",
    hands: 1,
    damage: "d4",
    reach: "10mts",
    weight: "0.2kg",
    attribute: "agilidad",
    slot: "auxiliar",
    bonus: "+1 por rango a T.A en serie"
  },
  pilum: {
    label: "Pilum",
    type: "arrojadizas",
    damageType: "perforante",
    hands: 1,
    damage: "d6",
    reach: "10mts",
    weight: "1.5kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+2 por rango a T.I para atravesar escudos/defensas"
  },
  francisca: {
    label: "Francisca",
    type: "arrojadizas",
    damageType: "cortante",
    hands: 1,
    damage: "d6",
    reach: "10mts",
    weight: "1.4kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+1 por rango a T.I en cargas/embestidas"
  },
  chakram: {
    label: "Chakram",
    type: "arrojadizas",
    damageType: "cortante",
    hands: 1,
    damage: "d4",
    reach: "12mts",
    weight: "0.4kg",
    attribute: "astucia",
    slot: "auxiliar",
    bonus: "+1 por rango a T.A contra múltiples criaturas"
  },

  // ============ DISTANCIA ============
  yumi: {
    label: "Yumi",
    type: "distancia",
    damageType: "segun_proyectil",
    hands: 2,
    damage: "d8",
    reach: "30mts",
    weight: "1kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "+1 por rango a T.A a más de 15 metros"
  },
  gakgung: {
    label: "Gakgung",
    type: "distancia",
    damageType: "segun_proyectil",
    hands: 2,
    damage: "d6",
    reach: "20mts",
    weight: "1kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "+1 por rango a T.A desde sigilo"
  },
  fukiya: {
    label: "Fukiya",
    type: "distancia",
    damageType: "segun_proyectil",
    hands: 1,
    damage: "d4",
    reach: "20mts",
    weight: "0.5kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "+1 por rango a T.I en puntos vitales"
  },
  scythian: {
    label: "Scythian",
    type: "distancia",
    damageType: "segun_proyectil",
    hands: 2,
    damage: "d8",
    reach: "30mts",
    weight: "1kg",
    attribute: "fuerza",
    slot: "principal",
    bonus: "+1 por rango a T.A desde montura"
  },
  balearic: {
    label: "Balearic",
    type: "distancia",
    damageType: "segun_proyectil",
    hands: 1,
    damage: "d4",
    reach: "20mts",
    weight: "0.7kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "+1 por rango a T.A por ataque consecutivo"
  },
  sumpit: {
    label: "Sumpit",
    type: "distancia",
    damageType: "segun_proyectil",
    hands: 1,
    damage: "d4",
    reach: "20mts",
    weight: "0.5kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "+1 por rango a T.A para aplicar veneno/enfermedad"
  },

  // ============ FLEXIBLES ============
  kusarigama: {
    label: "Kusarigama",
    type: "flexibles",
    damageType: "hoz_cortante_cadena_contundente",
    hands: 2,
    damage: "hoz_d6_cadena_d4",
    reach: "hoz_1mt_cadena_3mts",
    weight: "1.5kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "Ataque doble con hoz y cadena"
  },
  scourge: {
    label: "Scourge",
    type: "flexibles",
    damageType: "contundente",
    hands: 1,
    damage: "d4",
    reach: "1-3mts",
    weight: "1kg",
    attribute: "fuerza",
    slot: "auxiliar",
    bonus: "Ataque múltiple con látigo"
  },
  nekode: {
    label: "Nekode",
    type: "flexibles",
    damageType: "cortante",
    hands: 1,
    damage: "d4",
    reach: "1mt",
    weight: "0.5kg",
    attribute: "agilidad",
    slot: "auxiliar",
    bonus: "Garras retráctiles"
  },
  kusari_fundo: {
    label: "Kusari Fundo",
    type: "flexibles",
    damageType: "contundente",
    hands: 2,
    damage: "d6",
    reach: "1-3mts",
    weight: "1.2kg",
    attribute: "astucia",
    slot: "principal",
    bonus: "Cadena con pesos"
  },
  guantes_arana: {
    label: "Guantes de Araña",
    type: "flexibles",
    damageType: "cortante",
    hands: 1,
    damage: "d4",
    reach: "1-3mts",
    weight: "0.4kg",
    attribute: "agilidad",
    slot: "auxiliar",
    bonus: "Garfios retráctiles con cable"
  },
  urumi: {
    label: "Urumi",
    type: "flexibles",
    damageType: "cortante",
    hands: 1,
    damage: "d6",
    reach: "1-4mts",
    weight: "1.6kg",
    attribute: "agilidad",
    slot: "principal",
    bonus: "Espada látigo flexible"
  }
};

export const ARMOR_CATALOG = {
  // ============ PETO ============
  peto_ligero: {
    label: "Peto Ligero",
    type: "peto",
    category: "ligero",
    armorBonus: "grado",
    cordureaBonus: "grado",
    penalties: "T.E físicas: -0",
    weight: "3kg"
  },
  peto_intermedio: {
    label: "Peto Intermedio",
    type: "peto",
    category: "intermedio",
    armorBonus: "grado * 2",
    corduraBonus: "grado * 2",
    penalties: "T.E físicas: -grado",
    weight: "6kg"
  },
  peto_pesado: {
    label: "Peto Pesado",
    type: "peto",
    category: "pesado",
    armorBonus: "grado * 3",
    corduraBonus: "grado * 3",
    penalties: "T.E físicas: -(grado + 1)",
    weight: "9kg"
  },

  // ============ PANTALONES ============
  pantalones_ligero: {
    label: "Pantalones Ligeros",
    type: "pantalones",
    category: "ligero",
    bonus: "+1 por grado a T.E de sigilo, velocidad normal en terreno difícil",
    penalties: "T.A de reacciones: -0",
    weight: "2kg"
  },
  pantalones_intermedio: {
    label: "Pantalones Intermedios",
    type: "pantalones",
    category: "intermedio",
    bonus: "+grado a T.E de Acrobacias, Vigor, Destreza (movimiento)",
    penalties: "T.A de reacciones: -grado",
    weight: "4kg"
  },
  pantalones_pesado: {
    label: "Pantalones Pesados",
    type: "pantalones",
    category: "pesado",
    bonus: "+grado a T.R contra inmovilización y restricción",
    penalties: "T.A de reacciones: -(grado + 1)",
    weight: "6kg"
  },

  // ============ BOTAS ============
  botas_ligeras: {
    label: "Botas Ligeras",
    type: "botas",
    category: "ligero",
    bonus: "+grado a Velocidad de movimiento",
    penalties: "T.C Agilidad: -0",
    weight: "1kg"
  },
  botas_intermedias: {
    label: "Botas Intermedias",
    type: "botas",
    category: "intermedio",
    bonus: "+grado a T.E de equilibrio y vigor (escalar)",
    penalties: "T.C Agilidad: -grado",
    weight: "2kg"
  },
  botas_pesadas: {
    label: "Botas Pesadas",
    type: "botas",
    category: "pesado",
    bonus: "+grado a T.R contra derribo, desplazamiento, desequilibrio",
    penalties: "T.C Agilidad: -(grado + 1)",
    weight: "3kg"
  },

  // ============ BRAZALES ============
  brazales_ligeros: {
    label: "Brazales Ligeros",
    type: "brazales",
    category: "ligero",
    bonus: "+grado a T.A durante reacciones",
    penalties: "T.E de Destreza y Arte: -0",
    weight: "2kg"
  },
  brazales_intermedios: {
    label: "Brazales Intermedios",
    type: "brazales",
    category: "intermedio",
    bonus: "+grado a T.A en maniobras de disciplina y armas",
    penalties: "T.E de Destreza y Arte: -grado",
    weight: "3kg"
  },
  brazales_pesados: {
    label: "Brazales Pesados",
    type: "brazales",
    category: "pesado",
    bonus: "+grado a T.A o T.D en maniobras de escudos",
    penalties: "T.E de Destreza y Arte: -(grado + 1)",
    weight: "4kg"
  },

  // ============ CASCO ============
  casco_ligero: {
    label: "Casco Ligero",
    type: "casco",
    category: "ligero",
    bonus: "+grado a Preparación",
    penalties: "T.E de Percepción: -0",
    weight: "1kg"
  },
  casco_intermedio: {
    label: "Casco Intermedio",
    type: "casco",
    category: "intermedio",
    bonus: "+grado a T.E de Enfoque",
    penalties: "T.E de Percepción: -grado",
    weight: "2kg"
  },
  casco_pesado: {
    label: "Casco Pesado",
    type: "casco",
    category: "pesado",
    bonus: "+grado a T.R contra conmoción, ceguera, aturdimiento",
    penalties: "T.E de Percepción: -(grado + 1)",
    weight: "3kg"
  },

  // ============ ESCUDOS ============
  escudo_ligero: {
    label: "Escudo Ligero",
    type: "escudos",
    category: "ligero",
    coverageBonus: "ninguna",
    armorBonus: "grado",
    penalties: "Velocidad: -0",
    weight: "2kg"
  },
  escudo_mediano: {
    label: "Escudo Mediano",
    type: "escudos",
    category: "mediano",
    coverageBonus: "cobertura_ligera",
    armorBonus: "grado + 1",
    penalties: "Velocidad: -(grado + 1)",
    weight: "5kg"
  },
  escudo_pesado: {
    label: "Escudo Pesado",
    type: "escudos",
    category: "pesado",
    coverageBonus: "cobertura_media",
    armorBonus: "grado * 2",
    penalties: "Velocidad: -(grado + 2)",
    weight: "10kg"
  },

  // ============ JOYAS ============
  colgante: {
    label: "Colgante",
    type: "joyas",
    bonus: "Usar objetos sin acción Interactuar",
    weight: "1kg"
  },
  amuleto: {
    label: "Amuleto",
    type: "joyas",
    bonus: "+grado a Aguante, Cordura o Preparación",
    weight: "0.1kg"
  },
  insignia: {
    label: "Insignia",
    type: "joyas",
    bonus: "+grado a T.E de Negociación y Liderazgo",
    weight: "0.1kg"
  }
};
