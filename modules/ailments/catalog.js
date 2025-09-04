// modules/ailments/catalog.js

/** Tipos/grupos estándar */
export const AILMENT_GROUP = {
  ALTERATION: "alteration",
  INFECTION:  "infection",
  CURSE:      "curse",
  ELEMENTAL:  "element"
};

/**
 * Duración:
 * - { type:"rounds", value:"1d4" | number }   → consume en tickPerRound
 * - { type:"untilTreated" }                   → no expira sola
 * - { type:"instant" }                        → mensaje y listo
 * - { type:"permanent" }                      → no expira sola
 */

export const CATALOG = {
  // =========================
  // ALTERACIONES (selección)
  // =========================
  ELECTRIZADO: {
    id: "ELECTRIZADO", group: AILMENT_GROUP.ALTERATION,
    label: "Electrizado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "-1 PA por ronda.",
      "Las T.E de movimiento aumentan su dificultad en +2."
    ]
  },
  ATRAPADO: {
    id: "ATRAPADO", group: AILMENT_GROUP.ALTERATION,
    label: "Atrapado",
    duration: { type: "untilTreated" },
    effectsText: [
      "Velocidad 0. -2 a T.A, T.I, T.D y T.E que impliquen movimiento.",
      "Puede gastar 2 PA para intentar liberarse (T.C Fuerza vs Resistencia del elemento que lo atrapa, o T.E Destreza vs dificultad de escape)."
    ]
  },
  CONGELADO: {
    id: "CONGELADO", group: AILMENT_GROUP.ALTERATION,
    label: "Congelado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "-2 a T.E de Destreza y T.C de Agilidad.",
      "Movimiento a la mitad."
    ]
  },
  DERRIBADO: {
    id: "DERRIBADO", group: AILMENT_GROUP.ALTERATION,
    label: "Derribado",
    duration: { type: "untilTreated" },
    effectsText: [
      "-2 a T.D. Los oponentes tienen un avance de dado contra ti.",
      "Tu primera acción de movimiento se usa para levantarte."
    ]
  },
  DESANGRADO: {
    id: "DESANGRADO", group: AILMENT_GROUP.ALTERATION,
    label: "Desangrado",
    duration: { type: "untilTreated" },
    severable: true, // admite severidad: leve|grave|critico
    effectsBySeverity: {
      leve:   ["-1 a T.C de Fuerza y Tenacidad."],
      grave:  ["-3 a T.C Fuerza y Tenacidad, -1 PA. Requiere vendaje rápido."],
      critico:["-3 a T.C Fuerza y Tenacidad, -2 PA. Además, Inmovilizado en zona afectada."]
    }
  },
  CONMOCIONADO: {
    id: "CONMOCIONADO", group: AILMENT_GROUP.ALTERATION,
    label: "Conmocionado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: ["+2 a la dificultad de T.E/T.C relacionadas con enfoque."]
  },
  ATERRORIZADO: {
    id: "ATERRORIZADO", group: AILMENT_GROUP.ALTERATION,
    label: "Aterrorizado",
    duration: { type: "untilTreated" },
    effectsText: [
      "Debe huir de la fuente del miedo o sufre -2 a T.A y T.D.",
      "Puede gastar 1 PA para T.R Alteraciones vs (dif. inicial +2)."
    ]
  },
  PARALIZADO: {
    id: "PARALIZADO", group: AILMENT_GROUP.ALTERATION,
    label: "Paralizado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "No puede realizar acciones ni moverse.",
      "Puede gastar 1 PA para T.R Alteraciones vs (dif. inicial +2)."
    ]
  },
  ENSORDECIDO: {
    id: "ENSORDECIDO", group: AILMENT_GROUP.ALTERATION,
    label: "Ensordecido",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "No puede realizar T.E/T.C que dependan de audición.",
      "No puede reaccionar a sonidos."
    ]
  },
  CEGADO: {
    id: "CEGADO", group: AILMENT_GROUP.ALTERATION,
    label: "Cegado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "-5 a T.A y T.D.",
      "No puede realizar T.E que requieran visión."
    ]
  },
  CONFUNDIDO: {
    id: "CONFUNDIDO", group: AILMENT_GROUP.ALTERATION,
    label: "Confundido",
    duration: { type: "rounds", value: "1d4" },
    effectsText: ["50% de actuar contra aliado o hacer una acción inútil."]
  },
  INMOVILIZADO: {
    id: "INMOVILIZADO", group: AILMENT_GROUP.ALTERATION,
    label: "Inmovilizado",
    duration: { type: "untilTreated" },
    effectsText: [
      "No puede moverse, atacar ni realizar maniobras defensivas.",
      "Puede gastar 2 PA para intentar liberarse (T.C Fuerza vs Resistencia / T.E Destreza vs dificultad de escape)."
    ]
  },
  DESEQUILIBRADO: {
    id: "DESEQUILIBRADO", group: AILMENT_GROUP.ALTERATION,
    label: "Desequilibrado",
    duration: { type: "untilTreated" },
    effectsText: ["-2 a T.D y T.E de Destreza/Acrobacias/Saltar/Trepar."]
  },
  ATURDIDO: {
    id: "ATURDIDO", group: AILMENT_GROUP.ALTERATION,
    label: "Aturdido",
    duration: { type: "rounds", value: 1 },
    effectsText: ["Pierde su próxima ronda. -2 a T.R, T.C y T.D."]
  },
  DESORIENTADO: {
    id: "DESORIENTADO", group: AILMENT_GROUP.ALTERATION,
    label: "Desorientado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "-2 a T.E ligadas a Intelecto/Sabiduría.",
      "-2 a Preparación (temporal)."
    ]
  },
  ASFIXIADO: {
    id: "ASFIXIADO", group: AILMENT_GROUP.ALTERATION,
    label: "Asfixiado",
    duration: { type: "untilTreated" },
    effectsText: [
      "-1 PA. Debe hacer T.C Tenacidad cada ronda para no perder la conciencia."
    ]
  },
  IMPEDIDO: {
    id: "IMPEDIDO", group: AILMENT_GROUP.ALTERATION,
    label: "Impedido",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "No puede ejecutar habilidades que requieran Enfoque.",
      "-2 a todas las tiradas."
    ]
  },
  SOBRECARGADO: {
    id: "SOBRECARGADO", group: AILMENT_GROUP.ALTERATION,
    label: "Sobrecargado",
    duration: { type: "rounds", value: "1d6" },
    effectsText: ["-2 a todas las T.R y T.D."]
  },
  DESARMADO: {
    id: "DESARMADO", group: AILMENT_GROUP.ALTERATION,
    label: "Desarmado",
    duration: { type: "untilTreated" },
    effectsText: ["No puede usar ataques/defensas que requieran esa arma/herramienta."]
  },
  DESPLAZADO: {
    id: "DESPLAZADO", group: AILMENT_GROUP.ALTERATION,
    label: "Desplazado",
    duration: { type: "instant" },
    effectsText: ["Movimiento forzado. Vulnerable a Reacciones Instintivas durante el desplazamiento."]
  },
  QUEMADO: {
    id: "QUEMADO", group: AILMENT_GROUP.ALTERATION,
    label: "Quemado",
    duration: { type: "untilTreated" },
    effectsText: [
      "Daño de fuego al inicio de turno (según fuente).",
      "-2 a T.E relacionadas con Agilidad hasta apagar el fuego."
    ]
  },
  DEBILITADO: {
    id: "DEBILITADO", group: AILMENT_GROUP.ALTERATION,
    label: "Debilitado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: ["-2 a T.C de Fuerza y Tenacidad y T.E de Vigor/Acrobacias."]
  },
  CORROIDO: {
    id: "CORROIDO", group: AILMENT_GROUP.ALTERATION,
    label: "Corroído",
    duration: { type: "untilTreated" },
    effectsText: [
      "Si potencia del ácido > durabilidad de la armadura → la inutiliza.",
      "Sin armadura: el ácido inflige el doble del daño indicado por la fuente."
    ]
  },
  FRACTURADO: {
    id: "FRACTURADO", group: AILMENT_GROUP.ALTERATION,
    label: "Fracturado",
    duration: { type: "untilTreated" },
    severable: true,
    effectsBySeverity: {
      leve:   ["-1 a T.E físicas."],
      grave:  ["-3 a T.E de Fuerza/Agilidad/Tenacidad, movimiento a la mitad."],
      critico:["Como Grave y además 'Conmocionado' por dolor; movimiento a la mitad."]
    }
  },
  DESHIDRATADO: {
    id: "DESHIDRATADO", group: AILMENT_GROUP.ALTERATION,
    label: "Deshidratado",
    duration: { type: "untilTreated" },
    effectsText: [
      "-2 a T.E de Fuerza/Agilidad/Intelecto/Sabiduría.",
      "-1 PA por turno hasta hidratarse."
    ]
  },
  ENTUMECIDO: {
    id: "ENTUMECIDO", group: AILMENT_GROUP.ALTERATION,
    label: "Entumecido",
    duration: { type: "untilTreated" },
    effectsText: [
      "-2 a T.A, T.D y T.E físicas.",
      "-2 m a velocidad de movimiento."
    ]
  },
  DESLUMBRADO: {
    id: "DESLUMBRADO", group: AILMENT_GROUP.ALTERATION,
    label: "Deslumbrado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: ["-2 a T.A y tiradas de Percepción."]
  },
  AGONIZANTE: {
    id: "AGONIZANTE", group: AILMENT_GROUP.ALTERATION,
    label: "Agonizante",
    duration: { type: "untilTreated" },
    effectsText: [
      "-2 a todas las tiradas.",
      "No puede ejecutar técnicas que requieran Enfoque. Requiere control del dolor."
    ]
  },

  // =========================
  // INFECCIONES (selección)
  // =========================
  PIEL_DE_ESCARCHA: {
    id: "PIEL_DE_ESCARCHA", group: AILMENT_GROUP.INFECTION,
    label: "Piel de Escarcha",
    contagio: "Moderado",
    incubacion: "1d2 días",
    duration: { type: "untilTreated" },
    effectsText: ["Pierde 1d4 PA y Vulnerabilidad (Menor) a Fuego."]
  },
  MIASMA_DEL_PANTANO: {
    id: "MIASMA_DEL_PANTANO", group: AILMENT_GROUP.INFECTION,
    label: "Miasma del Pantano",
    contagio: "Leve", incubacion: "1d3 días",
    duration: { type: "untilTreated" },
    effectsText: ["Tras cada descanso completo, comienzas con 5 niveles de Fatiga."]
  },
  CARNE_EN_DESCOMPOSICION: {
    id: "CARNE_EN_DESCOMPOSICION", group: AILMENT_GROUP.INFECTION,
    label: "Carne en Descomposición",
    contagio: "Moderado", incubacion: "1d3 días",
    duration: { type: "untilTreated" },
    effectsText: ["Cada día se pierde 1 punto de salud permanente."]
  },
  LAMENTO_DE_PIEDRA: {
    id: "LAMENTO_DE_PIEDRA", group: AILMENT_GROUP.INFECTION,
    label: "Lamento de Piedra",
    contagio: "Grave", incubacion: "1d2 días",
    duration: { type: "untilTreated" },
    effectsText: ["-1 a Fuerza/Agilidad/Tenacidad por semana (se recuperan 1/semana tras tratamiento)."]
  },
  ALIENTO_DE_LA_BRUMA: {
    id: "ALIENTO_DE_LA_BRUMA", group: AILMENT_GROUP.INFECTION,
    label: "Aliento de la Bruma",
    contagio: "Leve", incubacion: "1d4 días",
    duration: { type: "untilTreated" },
    effectsText: ["-3 a T.E de comunicación verbal."]
  },
  MARCHITAMIENTO_DE_LA_FLORA: {
    id: "MARCHITAMIENTO_DE_LA_FLORA", group: AILMENT_GROUP.INFECTION,
    label: "Marchitamiento de la Flora",
    contagio: "Grave", incubacion: "1d2 días",
    duration: { type: "untilTreated" },
    effectsText: ["-2 a T.E de Supervivencia; las plantas a 1 m se marchitan."]
  },
  DEBILIDAD_DE_LA_LUZ_SOLAR: {
    id: "DEBILIDAD_DE_LA_LUZ_SOLAR", group: AILMENT_GROUP.INFECTION,
    label: "Debilidad de la Luz Solar",
    contagio: "Leve", incubacion: "1d2 días",
    duration: { type: "untilTreated" },
    effectsText: ["-3 a todas las tiradas bajo luz solar directa."]
  },
  MAL_DEL_MAR_ERRANTE: {
    id: "MAL_DEL_MAR_ERRANTE", group: AILMENT_GROUP.INFECTION,
    label: "Mal del Mar Errante",
    contagio: "Moderado", incubacion: "1d2 días",
    duration: { type: "untilTreated" },
    effectsText: ["-3 a T.E de Equilibrio/Equitación/Operación de Equipos/Trepar."]
  },
  AGONIA_DE_CRISTAL: {
    id: "AGONIA_DE_CRISTAL", group: AILMENT_GROUP.INFECTION,
    label: "Agonía de Cristal",
    contagio: "Grave", incubacion: "1d2 días",
    duration: { type: "untilTreated" },
    effectsText: ["-1 PA y movimiento a la mitad."]
  },
  PULSO_DE_LA_TIERRA_VIVA: {
    id: "PULSO_DE_LA_TIERRA_VIVA", group: AILMENT_GROUP.INFECTION,
    label: "Pulso de la Tierra Viva",
    contagio: "Leve", incubacion: "1d4 días",
    duration: { type: "untilTreated" },
    effectsText: ["-3 a tiradas relacionadas con Enfoque."]
  },
  CONDENA_DE_LAS_LLAMAS_DANZANTES: {
    id: "CONDENA_DE_LAS_LLAMAS_DANZANTES", group: AILMENT_GROUP.INFECTION,
    label: "Condena de las Llamas Danzantes",
    contagio: "Moderado", incubacion: "1d2 días",
    duration: { type: "untilTreated" },
    effectsText: ["Vulnerabilidad (Mayor) a daño de Agua."]
  },
  CICATRICES_DE_LA_TORMENTA: {
    id: "CICATRICES_DE_LA_TORMENTA", group: AILMENT_GROUP.INFECTION,
    label: "Cicatrices de la Tormenta",
    contagio: "Grave", incubacion: "1d3 días",
    duration: { type: "untilTreated" },
    effectsText: ["Cada día, 1d6 decide un elemento; ese día no puedes usar técnicas/artefactos de ese elemento."]
  },
  MAL_DE_LA_TIERRA_AGRIETADA: {
    id: "MAL_DE_LA_TIERRA_AGRIETADA", group: AILMENT_GROUP.INFECTION,
    label: "Mal de la Tierra Agrietada",
    contagio: "Grave", incubacion: "1d3 días",
    duration: { type: "untilTreated" },
    effectsText: ["-3 a T.E de Acrobacias/Destreza/Desactivar Trampas/Arte de precisión."]
  },
  PLAGA_DE_LAS_ALMAS_ERRANTES: {
    id: "PLAGA_DE_LAS_ALMAS_ERRANTES", group: AILMENT_GROUP.INFECTION,
    label: "Plaga de las Almas Errantes",
    contagio: "Moderado", incubacion: "1d2 días",
    duration: { type: "untilTreated" },
    effectsText: ["Ceguera persistente hasta tratar la infección."]
  },
  PLAGA_DE_SANGRE_NOCTURNA: {
    id: "PLAGA_DE_SANGRE_NOCTURNA", group: AILMENT_GROUP.INFECTION,
    label: "Plaga de Sangre Nocturna",
    contagio: "Leve", incubacion: "1d3 días",
    duration: { type: "untilTreated" },
    effectsText: ["-3 a todas las tiradas bajo luz de luna."]
  },
  FIEBRE_CORROSIVA: {
    id: "FIEBRE_CORROSIVA", group: AILMENT_GROUP.INFECTION,
    label: "Fiebre Corrosiva",
    contagio: "Leve", incubacion: "1d2 días",
    duration: { type: "untilTreated" },
    effectsText: ["-2 a Fuerza y Tenacidad."]
  },
  PUS_DE_LA_ABOMINACION: {
    id: "PUS_DE_LA_ABOMINACION", group: AILMENT_GROUP.INFECTION,
    label: "Pus de la Abominación",
    contagio: "Grave", incubacion: "1d2 días",
    duration: { type: "untilTreated" },
    effectsText: ["Cada ronda de la criatura: 50% de quedar Confundido. Renovación cura la mitad."]
  },
  ENFERMEDAD_DEL_COLMILLO: {
    id: "ENFERMEDAD_DEL_COLMILLO", group: AILMENT_GROUP.INFECTION,
    label: "Enfermedad del Colmillo",
    contagio: "Moderado", incubacion: "1d4 días",
    duration: { type: "untilTreated" },
    effectsText: ["Movimiento a la mitad; -3 a T.C de Agilidad."]
  },

  // =========================
  // ELEMENTALES (resumen)
  // =========================
  QUEMADURA_TAUMATICA_FUEGO: {
    id: "QUEMADURA_TAUMATICA_FUEGO", group: AILMENT_GROUP.ELEMENTAL,
    label: "Quemadura Taumática (Fuego)",
    duration: { type: "untilTreated" },
    severable: true,
    effectsBySeverity: {
      leve:   ["-4 a T.E ligadas a Agilidad (precisión)."],
      grave:  ["Además, -4 a T.C de Compostura."],
      critico:["Como Grave + inmovilización de la zona afectada; riesgo de combustión adyacente por turno."]
    }
  },
  LACERACION_DE_PRESION_VIENTO: {
    id: "LACERACION_DE_PRESION_VIENTO", group: AILMENT_GROUP.ELEMENTAL,
    label: "Laceración de Presión (Viento)",
    duration: { type: "untilTreated" },
    severable: true,
    effectsBySeverity: {
      leve:   ["-4 a Percepción y Defensa."],
      grave:  ["Además, Desangrado Grave."],
      critico:["Sangrado Crítico; -4 a T.E de Fuerza; no puede usar acciones dependientes del sonido."]
    }
  },
  APLASTAMIENTO_TAUMATICO_TIERRA: {
    id: "APLASTAMIENTO_TAUMATICO_TIERRA", group: AILMENT_GROUP.ELEMENTAL,
    label: "Aplastamiento Taumático (Tierra)",
    duration: { type: "untilTreated" },
    severable: true,
    effectsBySeverity: {
      leve:   ["Fractura (Leve)."],
      grave:  ["Fractura (Grave) y -1 PA por gravedad anómala."],
      critico:["Fractura (Crítica) e Inmovilizado."]
    }
  },
  CONGELACION_TAUMATICA_AGUA: {
    id: "CONGELACION_TAUMATICA_AGUA", group: AILMENT_GROUP.ELEMENTAL,
    label: "Congelación/Saturación Taumática (Agua)",
    duration: { type: "untilTreated" },
    severable: true,
    effectsBySeverity: {
      leve:   ["-4 a T.E/T.C de Agilidad."],
      grave:  ["Además, movimiento a la mitad."],
      critico:["Además, Inmovilizado y Asfixiado."]
    }
  },
  SOBRECARGA_NERVIOSA_LUZ: {
    id: "SOBRECARGA_NERVIOSA_LUZ", group: AILMENT_GROUP.ELEMENTAL,
    label: "Deslumbramiento/Sobrecarga Nerviosa (Luz)",
    duration: { type: "untilTreated" },
    severable: true,
    effectsBySeverity: {
      leve:   ["-4 a T.A y T.E de Percepción."],
      grave:  ["Además, -4 a T.E de Enfoque."],
      critico:["Además, Sobrecargado."]
    }
  },
  DEVORACION_SENSORIAL_OSCURIDAD: {
    id: "DEVORACION_SENSORIAL_OSCURIDAD", group: AILMENT_GROUP.ELEMENTAL,
    label: "Devoración Sensorial (Oscuridad)",
    duration: { type: "untilTreated" },
    severable: true,
    effectsBySeverity: {
      leve:   ["Rango visual a la mitad."],
      grave:  ["Además, Aflicción: Paranoia."],
      critico:["Además, Aflicción: Fobia."]
    }
  }
};
