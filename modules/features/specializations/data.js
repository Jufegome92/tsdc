// modules/features/specializations/data.js
// Catálogo declarativo de especializaciones para TSDC

// category: "physical" | "mental" | "social" | "arts" | "knowledge"
// attribute: "strength" | "agility" | "tenacity" | "cunning" | "wisdom" | "intellect" | "aura" | "composure" | "presence"

export const SPECIALIZATIONS = {
  // ===============================
  // FÍSICAS
  // ===============================
  saltar: {
    label: "Saltar",
    category: "physical",
    attribute: "strength",
    dcFamily: "environment/defense",
    reactions: false,
    retries: false,
    actionType: "action",
    aptitudes: [
      "impulso_sobrehumano",
      "salto_rebote",
      "salto_sigiloso",
      "impulso_supervivencia",
      "salto_evasivo"
    ],
    usesCalc: true,
    failureLearnBonus: true
  },
  acrobacias: {
    label: "Acrobacias",
    category: "physical",
    attribute: "agility",
    dcFamily: "environment/defense",
    reactions: false,
    retries: false,
    actionType: "action",
    aptitudes: [
      "maniobra_evasiva",
      "caer_con_estilo",
      "golpe_acrobatico",
      "reposicionamiento",
      "rodamiento_defensivo"
    ],
    usesCalc: true,
    failureLearnBonus: true
  },
  destreza: {
    label: "Destreza",
    category: "physical",
    attribute: "agility",
    dcFamily: "object/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [
      "desarme",
      "redirigir_proyectiles",
      "segunda_oportunidad",
      "oportunista"
    ],
    usesCalc: true,
    failureLearnBonus: true
  },
  trepar: {
    label: "Trepar",
    category: "physical",
    attribute: "strength",
    dcFamily: "environment/defense",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [
      "ascenso_acelerado",
      "escalada_precision",
      "ascenso_carga_pesada",
      "recursividad",
      "descenso_controlado"
    ],
    usesCalc: true,
    failureLearnBonus: true
  },
  equilibrio: {
    label: "Equilibrio",
    category: "physical",
    attribute: "composure",
    dcFamily: "environment/defense",
    reactions: false,
    retries: false,
    actionType: "reaction",
    aptitudes: [
      "paso_firme",
      "inamovible",
      "punto_apoyo",
      "movimiento_seguro"
    ],
    usesCalc: true,
    failureLearnBonus: true
  },
  equitacion: {
    label: "Equitación",
    category: "physical",
    attribute: "agility",
    dcFamily: "environment/defense",
    reactions: false,
    retries: "conditional",
    actionType: "reaction",
    aptitudes: [
      "carga_sobre_montura",
      "maniobra_defensiva_montura",
      "cuidador_montura",
      "adiestramiento_montura",
      "esquivar_en_movimiento"
    ],
    usesCalc: true,
    failureLearnBonus: true
  },
  vigor: {
    label: "Vigor",
    category: "physical",
    attribute: "tenacity",
    dcFamily: "environment/defense",
    reactions: false,
    retries: "conditional",
    actionType: "action",
    aptitudes: [
      "carga_vigor",
      "fortaleza_inquebrantable",
      "resistencia_hierro",
      "golpe_de_furia"
    ],
    usesCalc: true,
    failureLearnBonus: true
  },

  // ===============================
  // MENTALES
  // ===============================
  identificacion: {
    label: "Identificación",
    category: "mental",
    attribute: "intellect",
    dcFamily: "object/creature/environment",
    reactions: false,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  interpretacion: {
    label: "Interpretación",
    category: "mental",
    attribute: "intellect",
    dcFamily: "environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  linguistica: {
    label: "Lingüística",
    category: "mental",
    attribute: "intellect",
    dcFamily: "environment",
    reactions: true,
    retries: false,
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  percepcion: {
    label: "Percepción",
    category: "mental",
    attribute: "wisdom",
    dcFamily: "object/creature/environment",
    reactions: false,
    retries: false,
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  orientacion: {
    label: "Orientación",
    category: "mental",
    attribute: "cunning",
    dcFamily: "environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  rastreo: {
    label: "Rastreo",
    category: "mental",
    attribute: "cunning",
    dcFamily: "environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  supervivencia: {
    label: "Supervivencia",
    category: "mental",
    attribute: "wisdom",
    dcFamily: "environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  intuicion: {
    label: "Intuición",
    category: "mental",
    attribute: "cunning",
    dcFamily: "object/creature/environment",
    reactions: false,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  enfoque: {
    label: "Enfoque",
    category: "mental",
    attribute: "composure",
    dcFamily: "object/creature/environment",
    reactions: false,
    retries: false,
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },

  // ===============================
  // SOCIALES
  // ===============================
  robo: {
    label: "Robo",
    category: "social",
    attribute: "presence",
    dcFamily: "environment",
    reactions: true,
    retries: false,
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  engano: {
    label: "Engaño",
    category: "social",
    attribute: "cunning",
    dcFamily: "object/creature/environment",
    reactions: false,
    retries: false,
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  domesticacion: {
    label: "Domesticación",
    category: "social",
    attribute: "aura",
    dcFamily: "composure/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  liderazgo: {
    label: "Liderazgo",
    category: "social",
    attribute: "presence",
    dcFamily: "composure/environment",
    reactions: false,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  negociacion: {
    label: "Negociación",
    category: "social",
    attribute: "presence",
    dcFamily: "composure/environment",
    reactions: false,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  imitacion: {
    label: "Imitación",
    category: "social",
    attribute: "presence",
    dcFamily: "perception/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  empatia: {
    label: "Empatía",
    category: "social",
    attribute: "presence",
    dcFamily: "environment",
    reactions: false,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  intimidacion: {
    label: "Intimidación",
    category: "social",
    attribute: "presence",
    dcFamily: "composure/environment",
    reactions: false,
    retries: false,
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  sigilo: {
    label: "Sigilo",
    category: "social",
    attribute: "presence",
    dcFamily: "perception/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },

  // ===============================
  // ARTES Y OFICIOS
  // ===============================
  herreria: {
    label: "Herrería",
    category: "arts",
    attribute: "wisdom",
    dcFamily: "object/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  sastreria: {
    label: "Sastrería",
    category: "arts",
    attribute: "wisdom",
    dcFamily: "object/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  joyeria: {
    label: "Joyería",
    category: "arts",
    attribute: "wisdom",
    dcFamily: "object/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  alquimia: {
    label: "Alquimia",
    category: "arts",
    attribute: "wisdom",
    dcFamily: "object/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  ingenieria: {
    label: "Ingeniería",
    category: "arts",
    attribute: "wisdom",
    dcFamily: "object/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  trampas: {
    label: "Trampas",
    category: "arts",
    attribute: "wisdom",
    dcFamily: "object/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  mineria: {
    label: "Minería",
    category: "arts",
    attribute: "wisdom",
    dcFamily: "object/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  herboristeria: {
    label: "Herboristería",
    category: "arts",
    attribute: "wisdom",
    dcFamily: "object/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  medicina: {
    label: "Medicina",
    category: "arts",
    attribute: "wisdom",
    dcFamily: "object/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },

  // ===============================
  // SABERES
  // ===============================
  taumaturgia: {
    label: "Taumaturgia",
    category: "knowledge",
    attribute: "intellect",
    dcFamily: "knowledge/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  geografia: {
    label: "Geografía",
    category: "knowledge",
    attribute: "intellect",
    dcFamily: "knowledge/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  astronomia: {
    label: "Astronomía",
    category: "knowledge",
    attribute: "intellect",
    dcFamily: "knowledge/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  teologia: {
    label: "Teología",
    category: "knowledge",
    attribute: "intellect",
    dcFamily: "knowledge/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  historia: {
    label: "Historia",
    category: "knowledge",
    attribute: "intellect",
    dcFamily: "knowledge/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  criptologia: {
    label: "Criptología",
    category: "knowledge",
    attribute: "intellect",
    dcFamily: "knowledge/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  arqueologia: {
    label: "Arqueología",
    category: "knowledge",
    attribute: "intellect",
    dcFamily: "knowledge/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  arquitectura: {
    label: "Arquitectura",
    category: "knowledge",
    attribute: "intellect",
    dcFamily: "knowledge/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  },
  belicologia: {
    label: "Belicología",
    category: "knowledge",
    attribute: "intellect",
    dcFamily: "knowledge/environment",
    reactions: true,
    retries: "conditional",
    actionType: "action",
    aptitudes: [],
    usesCalc: true,
    failureLearnBonus: true
  }
};
