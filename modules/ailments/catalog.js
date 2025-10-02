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
      "Penalizador a T.E de movimiento según rango del atacante.",
      "+1 tick al Inicio de tus acciones mientras dure."
    ],
    mechanics: {
      ctAdjust: { init: 1 },
      rollModifiers: [
        { phases: ["skill"], tagsAny: ["spec:physical"], value: -2, useMagnitude: true, label: "Electrizado" }
      ]
    }
  },
  ATRAPADO: {
    id: "ATRAPADO", group: AILMENT_GROUP.ALTERATION,
    label: "Atrapado",
    duration: { type: "untilTreated" },
    effectsText: [
      "Velocidad 0. Penalizador a T.A, T.I, T.D y T.E físicas según rango.",
      "Acción de escape: CT 2 (I1/E1/R0) para intentar liberarse (T.R Alteración o T.E Destreza, según la situación)."
    ],
    mechanics: {
      movementBlocked: true,
      rollModifiers: [
        { phases: ["attack", "defense", "impact"], value: -2, useMagnitude: true, label: "Atrapado" },
        { phases: ["skill"], tagsAny: ["spec:physical"], value: -2, useMagnitude: true, label: "Atrapado" }
      ],
      escape: {
        ct: { init: 1, exec: 1, rec: 0 },
        options: ["resistance:alteration", "skill:destreza"]
      }
    }
  },
  CONGELADO: {
    id: "CONGELADO", group: AILMENT_GROUP.ALTERATION,
    label: "Congelado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "Penalizador a T.E de Destreza y T.C de Agilidad según rango.",
      "Movimiento a la mitad."
    ],
    mechanics: {
      ctAdjust: { init: 1 },
      rollModifiers: [
        { phases: ["skill"], tagsAny: ["spec:physical"], value: -2, useMagnitude: true, label: "Congelado" },
        { phases: ["resistance"], resTypes: ["composure"], value: -2, useMagnitude: true, label: "Congelado" }
      ]
    }
  },
  DERRIBADO: {
    id: "DERRIBADO", group: AILMENT_GROUP.ALTERATION,
    label: "Derribado",
    duration: { type: "untilTreated" },
    effectsText: [
      "Penalizador a T.D según rango del atacante. Los oponentes tienen un avance de dado contra ti.",
      "Tu primera acción de movimiento se usa para levantarte."
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Derribado" }
      ]
    }
  },
  DESANGRADO: {
    id: "DESANGRADO", group: AILMENT_GROUP.ALTERATION,
    label: "Desangrado",
    duration: { type: "untilTreated" },
    effectsText: [
      "Cada vez que ejecutas una acción, la herida se agrava.",
      "Añade 1 casilla de daño a la zona afectada por acción ejecutada.",
      "Requiere tratamiento para detener el sangrado."
    ],
    mechanics: {
      onActionExecuted: {
        type: "addWoundSlot",
        targetZone: "source",  // la zona donde se aplicó originalmente
        amount: 1
      }
    }
  },
  HERIDA_PERFORANTE: {
    id: "HERIDA_PERFORANTE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida Perforante",
    duration: { type: "untilTreated" },
    effectsText: [
      "La herida perforante reduce el bloqueo de la zona afectada.",
      "Penalización al bloqueo igual al rango de competencia del ataque."
    ],
    mechanics: {
      blockingPenalty: {
        usesMagnitude: true,
        targetZone: "source"  // solo en la zona donde se aplicó
      }
    }
  },
  HERIDA_CONTUNDENTE: {
    id: "HERIDA_CONTUNDENTE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida Contundente",
    duration: { type: "untilTreated" },
    effectsText: [
      "El impacto contundente dificulta las acciones físicas.",
      "+1 tick de Recuperación en acciones físicas (ataque, maniobras, aptitudes físicas, poderes de reliquia)."
    ],
    mechanics: {
      ctAdjust: {
        rec: 1,
        actionTypes: ["attack", "maneuver", "physical_aptitude", "relic_power"]
      }
    }
  },
  CONMOCIONADO: {
    id: "CONMOCIONADO", group: AILMENT_GROUP.ALTERATION,
    label: "Conmocionado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: ["Penalizador a T.E/T.C relacionadas con enfoque según rango."],
    mechanics: {
      rollModifiers: [
        { phases: ["skill"], tagsAny: ["spec:mental", "spec:knowledge"], value: -2, useMagnitude: true, label: "Conmocionado" },
        { phases: ["resistance"], resTypes: ["composure"], value: -2, useMagnitude: true, label: "Conmocionado" }
      ]
    }
  },
  ATERRORIZADO: {
    id: "ATERRORIZADO", group: AILMENT_GROUP.ALTERATION,
    label: "Aterrorizado",
    duration: { type: "untilTreated" },
    effectsText: [
      "Debe huir de la fuente del miedo o sufre penalizador a T.A y T.D según rango.",
      "Puede gastar 1 PA para T.R Alteraciones vs (dif. inicial +2)."
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["attack"], value: -2, useMagnitude: true, label: "Aterrorizado" },
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Aterrorizado" }
      ]
    }
  },
  PARALIZADO: {
    id: "PARALIZADO", group: AILMENT_GROUP.ALTERATION,
    label: "Paralizado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "No puede realizar acciones ni moverse.",
      "Puede gastar 1 PA para T.R Alteraciones vs (dif. inicial +2)."
    ],
    mechanics: {
      movementBlocked: true,
      rollModifiers: [
        { phases: ["attack"], value: -99, useMagnitude: true, label: "Paralizado" },
        { phases: ["defense"], value: -5, useMagnitude: true, label: "Paralizado" }
      ]
    }
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
      "Penalizador a T.A y T.D según rango.",
      "No puede realizar T.E que requieran visión."
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["attack"], value: -5, useMagnitude: true, label: "Cegado" },
        { phases: ["defense"], value: -5, useMagnitude: true, label: "Cegado" }
      ]
    }
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
    ],
    mechanics: {
      movementBlocked: true,
      rollModifiers: [
        { phases: ["attack"], value: -5, useMagnitude: true, label: "Inmovilizado" },
        { phases: ["defense"], value: -5, useMagnitude: true, label: "Inmovilizado" }
      ],
      escape: {
        ct: { init: 1, exec: 1, rec: 0 },
        options: ["resistance:alteration", "skill:destreza"]
      }
    }
  },
  DESEQUILIBRADO: {
    id: "DESEQUILIBRADO", group: AILMENT_GROUP.ALTERATION,
    label: "Desequilibrado",
    duration: { type: "untilTreated" },
    effectsText: ["Penalizador a T.D y T.E de Destreza/Acrobacias/Saltar/Trepar según rango."],
    mechanics: {
      rollModifiers: [
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Desequilibrado" },
        { phases: ["skill"], tagsAny: ["spec:physical"], value: -2, useMagnitude: true, label: "Desequilibrado" }
      ]
    }
  },
  ATURDIDO: {
    id: "ATURDIDO", group: AILMENT_GROUP.ALTERATION,
    label: "Aturdido",
    duration: { type: "rounds", value: 1 },
    effectsText: ["Pierde su próxima ronda. Penalizador a T.R, T.C y T.D según rango."],
    mechanics: {
      ctAdjust: { init: 1 },
      rollModifiers: [
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Aturdido" },
        { phases: ["resistance"], value: -2, useMagnitude: true, label: "Aturdido" }
      ]
    }
  },
  DESORIENTADO: {
    id: "DESORIENTADO", group: AILMENT_GROUP.ALTERATION,
    label: "Desorientado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "Penalizador a T.E ligadas a Intelecto/Sabiduría según rango.",
      "Penalizador a Preparación (temporal)."
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["skill"], tagsAny: ["spec:mental", "spec:knowledge"], value: -2, useMagnitude: true, label: "Desorientado" }
      ]
    }
  },
  ASFIXIADO: {
    id: "ASFIXIADO", group: AILMENT_GROUP.ALTERATION,
    label: "Asfixiado",
    duration: { type: "untilTreated" },
    effectsText: [
      "-1 PA. Debe hacer T.C Tenacidad cada ronda para no perder la conciencia."
    ],
    mechanics: {
      ctAdjust: { rec: 1 },
      rollModifiers: [
        { phases: ["resistance"], resTypes: ["alteration", "poison", "air"], value: -1, useMagnitude: true, label: "Asfixiado" }
      ]
    }
  },
  IMPEDIDO: {
    id: "IMPEDIDO", group: AILMENT_GROUP.ALTERATION,
    label: "Impedido",
    duration: { type: "rounds", value: "1d4" },
    effectsText: [
      "No puede ejecutar habilidades que requieran Enfoque.",
      "Penalizador a todas las tiradas según rango del atacante."
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["attack"], value: -2, useMagnitude: true, label: "Impedido" },
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Impedido" },
        { phases: ["skill"], value: -2, useMagnitude: true, label: "Impedido" },
        { phases: ["resistance"], value: -2, useMagnitude: true, label: "Impedido" }
      ]
    }
  },
  SOBRECARGADO: {
    id: "SOBRECARGADO", group: AILMENT_GROUP.ALTERATION,
    label: "Sobrecargado",
    duration: { type: "rounds", value: "1d6" },
    effectsText: ["Penalizador a todas las T.R y T.D según rango."],
    mechanics: {
      rollModifiers: [
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Sobrecargado" },
        { phases: ["resistance"], value: -2, useMagnitude: true, label: "Sobrecargado" }
      ]
    }
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

  // =========================
  // EFECTOS ELEMENTALES
  // =========================
  HERIDA_AGUA: {
    id: "HERIDA_AGUA", group: AILMENT_GROUP.ELEMENTAL,
    label: "Congelación Elemental (Agua)",
    duration: { type: "untilTreated" },
    effectsText: [
      "El frío elemental ralentiza el movimiento.",
      "Reduce la velocidad de movimiento según rango de competencia del ataque."
    ],
    mechanics: {
      movementPenalty: {
        usesMagnitude: true  // resta X metros de velocidad donde X = rango
      }
    }
  },
  HERIDA_LUZ: {
    id: "HERIDA_LUZ", group: AILMENT_GROUP.ELEMENTAL,
    label: "Sobrecarga de Luz",
    duration: { type: "untilTreated" },
    effectsText: [
      "La luz sobrecarga tus sentidos.",
      "No puedes llevar a cabo reacciones.",
      "Penalizador a todas las tiradas según rango."
    ],
    mechanics: {
      reactionsBlocked: true,
      rollModifiers: [
        { phases: ["attack"], value: -2, useMagnitude: true, label: "Sobrecarga de Luz" },
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Sobrecarga de Luz" },
        { phases: ["skill"], value: -2, useMagnitude: true, label: "Sobrecarga de Luz" },
        { phases: ["resistance"], value: -2, useMagnitude: true, label: "Sobrecarga de Luz" }
      ]
    }
  },
  HERIDA_OSCURIDAD: {
    id: "HERIDA_OSCURIDAD", group: AILMENT_GROUP.ELEMENTAL,
    label: "Ceguera de Oscuridad",
    duration: { type: "untilTreated" },
    effectsText: [
      "La oscuridad elemental reduce tu visión.",
      "El rango de visión efectivo se reduce a la mitad (después de todos los cálculos)."
    ],
    mechanics: {
      visionMultiplier: 0.5
    }
  },
  HERIDA_VIENTO: {
    id: "HERIDA_VIENTO", group: AILMENT_GROUP.ELEMENTAL,
    label: "Laceración de Viento",
    duration: { type: "untilTreated" },
    effectsText: [
      "El viento te desplaza y desestabiliza.",
      "Desplazado X metros según rango de competencia.",
      "Penalizador a defensa según rango de competencia."
    ],
    mechanics: {
      forcedMovement: {
        usesMagnitude: true  // desplaza X metros donde X = rango
      },
      rollModifiers: [
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Laceración de Viento" }
      ]
    }
  },
  HERIDA_TIERRA: {
    id: "HERIDA_TIERRA", group: AILMENT_GROUP.ELEMENTAL,
    label: "Aplastamiento de Tierra",
    duration: { type: "untilTreated" },
    effectsText: [
      "El impacto de tierra daña la estructura de la parte afectada.",
      "Reduce la durabilidad de la zona en 2× el rango de competencia del ataque."
    ],
    mechanics: {
      durabilityDamage: {
        usesMagnitude: true,
        multiplier: 2,  // 2 × rango
        targetZone: "source"
      }
    }
  },
  HERIDA_FUEGO: {
    id: "HERIDA_FUEGO", group: AILMENT_GROUP.ELEMENTAL,
    label: "Quemadura Elemental",
    duration: { type: "untilTreated" },
    effectsText: [
      "Las quemaduras causan dolor, hinchazón y dificultan el movimiento.",
      "Penalizador a T.R de Infección según rango de competencia.",
      "+1 tick al Inicio en TODAS las acciones debido al dolor."
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["resistance"], resTypes: ["infection"], value: -2, useMagnitude: true, label: "Quemadura" }
      ],
      ctAdjust: {
        init: 1  // aplica a TODAS las acciones
      }
    }
  },
  QUEMADO: {
    id: "QUEMADO", group: AILMENT_GROUP.ALTERATION,
    label: "Quemado",
    duration: { type: "untilTreated" },
    effectsText: [
      "Daño de fuego al inicio de turno (según fuente).",
      "-2 a T.E relacionadas con Agilidad hasta apagar el fuego."
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["skill"], tagsAny: ["spec:physical"], value: -2, label: "Quemado" }
      ]
    }
  },
  DEBILITADO: {
    id: "DEBILITADO", group: AILMENT_GROUP.ALTERATION,
    label: "Debilitado",
    duration: { type: "rounds", value: "1d4" },
    effectsText: ["-2 a T.C de Fuerza y Tenacidad y T.E de Vigor/Acrobacias."],
    mechanics: {
      rollModifiers: [
        { phases: ["resistance"], resTypes: ["poison", "infection"], value: -2, label: "Debilitado" },
        { phases: ["skill"], tagsAny: ["spec:physical"], value: -2, label: "Debilitado" }
      ]
    }
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

  INFECCION_TRAUMATICA: {
    id: "INFECCION_TRAUMATICA",
    group: AILMENT_GROUP.INFECTION,
    label: "Infección Traumática",
    contagio: "Grave",
    incubacion: "1 hora",
    duration: { type: "untilTreated" },
    severable: true,
    /**
     * grantsBySeverity: qué otras alteraciones se aplican automáticamente
     * cuando se activa esta afección, según severidad.
     */
    grantsBySeverity: {
      leve:   ["DESANGRADO"],
      grave:  ["DESANGRADO", "DESEQUILIBRADO", "DESORIENTADO"],
      critico:["DESANGRADO", "DESEQUILIBRADO", "DESORIENTADO", "DEBILITADO"]
    },
    effectsText: [
      "Herida profunda contaminada que desencadena fiebre e inflamación.",
      "Aplica alteraciones adicionales según severidad (ver ficha)."
    ]
  },

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
    effectsText: ["Movimiento a la mitad; -3 a T.C de Agilidad."],
    mechanics: {
      movementMultiplier: 0.5,
      rollModifiers: [
        { phases: ["resistance"], value: -3, label: "Enfermedad del Colmillo" }
      ]
    }
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
    },
    mechanics: {
      severity: {
        leve: {
          rollModifiers: [
            { phases: ["skill"], tagsAny: ["spec:physical"], value: -4, label: "Quemadura (Leve)" }
          ]
        },
        grave: {
          rollModifiers: [
            { phases: ["skill"], tagsAny: ["spec:physical"], value: -4, label: "Quemadura (Grave)" },
            { phases: ["resistance"], resTypes: ["composure"], value: -4, label: "Quemadura (Grave)" }
          ]
        },
        critico: {
          movementMultiplier: 0.5,
          rollModifiers: [
            { phases: ["skill"], tagsAny: ["spec:physical"], value: -4, label: "Quemadura (Crítica)" },
            { phases: ["resistance"], resTypes: ["composure"], value: -4, label: "Quemadura (Crítica)" }
          ]
        }
      }
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
    },
    grantsBySeverity: {
      grave: ["DESANGRADO"],
      critico: ["DESANGRADO"]
    },
    mechanics: {
      severity: {
        leve: {
          rollModifiers: [
            { phases: ["defense"], value: -4, label: "Laceración (Leve)" },
            { phases: ["skill"], tagsAny: ["spec:mental"], value: -4, label: "Laceración (Leve)" }
          ]
        },
        grave: {
          rollModifiers: [
            { phases: ["defense"], value: -4, label: "Laceración (Grave)" },
            { phases: ["skill"], tagsAny: ["spec:mental"], value: -4, label: "Laceración (Grave)" }
          ]
        },
        critico: {
          rollModifiers: [
            { phases: ["defense"], value: -4, label: "Laceración (Crítica)" },
            { phases: ["skill"], tagsAny: ["spec:physical"], value: -4, label: "Laceración (Crítica)" }
          ],
          movementMultiplier: 0.75
        }
      }
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
    },
    grantsBySeverity: {
      leve: ["FRACTURADO"],
      grave: ["FRACTURADO"],
      critico: ["FRACTURADO", "INMOVILIZADO"]
    },
    mechanics: {
      severity: {
        leve: {
          movementMultiplier: 0.75,
        },
        grave: {
          movementMultiplier: 0.5,
          ctAdjust: { rec: 1 },
          rollModifiers: [
            { phases: ["resistance"], value: -1, label: "Aplastamiento (Grave)" }
          ]
        },
        critico: {
          movementBlocked: true,
          rollModifiers: [
            { phases: ["defense"], value: -4, label: "Aplastamiento (Crítico)" }
          ]
        }
      }
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
    },
    grantsBySeverity: {
      critico: ["ASFIXIADO"]
    },
    mechanics: {
      severity: {
        leve: {
          rollModifiers: [
            { phases: ["skill"], tagsAny: ["spec:physical"], value: -4, label: "Congelación (Leve)" },
            { phases: ["resistance"], value: -4, label: "Congelación (Leve)" }
          ]
        },
        grave: {
          movementMultiplier: 0.5,
          rollModifiers: [
            { phases: ["skill"], tagsAny: ["spec:physical"], value: -4, label: "Congelación (Grave)" },
            { phases: ["resistance"], value: -4, label: "Congelación (Grave)" }
          ]
        },
        critico: {
          movementBlocked: true,
          rollModifiers: [
            { phases: ["skill"], tagsAny: ["spec:physical"], value: -4, label: "Congelación (Crítica)" },
            { phases: ["resistance"], value: -4, label: "Congelación (Crítica)" }
          ]
        }
      }
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
    },
    grantsBySeverity: {
      critico: ["SOBRECARGADO"]
    },
    mechanics: {
      severity: {
        leve: {
          rollModifiers: [
            { phases: ["attack"], value: -4, label: "Sobrecarga (Leve)" },
            { phases: ["skill"], tagsAny: ["spec:mental"], value: -4, label: "Sobrecarga (Leve)" }
          ]
        },
        grave: {
          rollModifiers: [
            { phases: ["attack"], value: -4, label: "Sobrecarga (Grave)" },
            { phases: ["skill"], tagsAny: ["spec:mental"], value: -4, label: "Sobrecarga (Grave)" }
          ]
        },
        critico: {
          rollModifiers: [
            { phases: ["attack"], value: -4, label: "Sobrecarga (Crítica)" },
            { phases: ["skill"], tagsAny: ["spec:mental"], value: -4, label: "Sobrecarga (Crítica)" }
          ]
        }
      }
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
    },
    mechanics: {
      severity: {
        leve: {
          rollModifiers: [
            { phases: ["skill"], tagsAny: ["spec:mental"], value: -2, label: "Oscuridad (Leve)" }
          ]
        },
        grave: {
          rollModifiers: [
            { phases: ["skill"], tagsAny: ["spec:mental"], value: -3, label: "Oscuridad (Grave)" }
          ]
        },
        critico: {
          rollModifiers: [
            { phases: ["skill"], tagsAny: ["spec:mental"], value: -4, label: "Oscuridad (Crítica)" }
          ]
        }
      }
    }
  },

  // ==========================================
  // HERIDAS POR ZONA (con severidad dinámica)
  // ==========================================

  // === CABEZA ===
  HERIDA_CABEZA_LEVE: {
    id: "HERIDA_CABEZA_LEVE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Cabeza (Leve)",
    duration: { type: "untilTreated" },
    effectsText: ["Desequilibrado: penalizador a T.D y T.E de equilibrio/acrobacias."],
    mechanics: {
      rollModifiers: [
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Desequilibrado" },
        { phases: ["skill"], tagsAny: ["spec:acrobacias", "spec:equilibrio"], value: -2, useMagnitude: true, label: "Desequilibrado" }
      ]
    }
  },
  HERIDA_CABEZA_GRAVE: {
    id: "HERIDA_CABEZA_GRAVE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Cabeza (Grave)",
    duration: { type: "untilTreated" },
    effectsText: [
      "Desequilibrado + Conmocionado",
      "Penalizador a T.D y T.E de equilibrio/acrobacias",
      "Penalizador a T.E/T.C relacionadas con enfoque"
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Desequilibrado" },
        { phases: ["skill"], tagsAny: ["spec:acrobacias", "spec:equilibrio"], value: -2, useMagnitude: true, label: "Desequilibrado" },
        { phases: ["skill"], tagsAny: ["spec:mental", "spec:knowledge"], value: -2, useMagnitude: true, label: "Conmocionado" },
        { phases: ["resistance"], resTypes: ["composure"], value: -2, useMagnitude: true, label: "Conmocionado" }
      ]
    }
  },
  HERIDA_CABEZA_CRITICA: {
    id: "HERIDA_CABEZA_CRITICA", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Cabeza (Crítica)",
    duration: { type: "untilTreated" },
    effectsText: [
      "Desequilibrado + Conmocionado + Riesgo de inconsciencia",
      "Requiere T.C de Tenacidad o Compostura para evitar colapso",
      "Si falla: Inconsciente hasta ser tratado"
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Desequilibrado" },
        { phases: ["skill"], tagsAny: ["spec:acrobacias", "spec:equilibrio"], value: -2, useMagnitude: true, label: "Desequilibrado" },
        { phases: ["skill"], tagsAny: ["spec:mental", "spec:knowledge"], value: -2, useMagnitude: true, label: "Conmocionado" },
        { phases: ["resistance"], resTypes: ["composure"], value: -2, useMagnitude: true, label: "Conmocionado" }
      ],
      deathSave: { characteristic: ["tenacity", "composure"], dc: 12 }
    }
  },

  // === TORSO ===
  HERIDA_TORSO_LEVE: {
    id: "HERIDA_TORSO_LEVE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Torso (Leve)",
    duration: { type: "untilTreated" },
    effectsText: ["-1 al Aguante Máximo hasta ser tratado"],
    mechanics: {
      staminaPenalty: 1
    }
  },
  HERIDA_TORSO_GRAVE: {
    id: "HERIDA_TORSO_GRAVE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Torso (Grave)",
    duration: { type: "untilTreated" },
    effectsText: [
      "-1 al Aguante Máximo",
      "Impedido: penalizador a todas las tiradas"
    ],
    mechanics: {
      staminaPenalty: 1,
      rollModifiers: [
        { phases: ["attack"], value: -2, useMagnitude: true, label: "Impedido" },
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Impedido" },
        { phases: ["skill"], value: -2, useMagnitude: true, label: "Impedido" },
        { phases: ["resistance"], value: -2, useMagnitude: true, label: "Impedido" }
      ]
    }
  },
  HERIDA_TORSO_CRITICA: {
    id: "HERIDA_TORSO_CRITICA", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Torso (Crítica)",
    duration: { type: "untilTreated" },
    effectsText: [
      "-1 al Aguante Máximo + Impedido",
      "Antes de cada acción: T.C de Tenacidad (DC 12) o la acción no se ejecuta"
    ],
    mechanics: {
      staminaPenalty: 1,
      rollModifiers: [
        { phases: ["attack"], value: -2, useMagnitude: true, label: "Impedido" },
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Impedido" },
        { phases: ["skill"], value: -2, useMagnitude: true, label: "Impedido" },
        { phases: ["resistance"], value: -2, useMagnitude: true, label: "Impedido" }
      ],
      actionCheck: { characteristic: "tenacity", dc: 12 }
    }
  },

  // === BRAZOS ===
  HERIDA_BRAZOS_LEVE: {
    id: "HERIDA_BRAZOS_LEVE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Brazos (Leve)",
    duration: { type: "untilTreated" },
    effectsText: ["Penalizador a T.A y T.I con armas"],
    mechanics: {
      rollModifiers: [
        { phases: ["attack"], value: -2, useMagnitude: true, label: "Herida en Brazos" },
        { phases: ["impact"], value: -2, useMagnitude: true, label: "Herida en Brazos" }
      ]
    }
  },
  HERIDA_BRAZOS_GRAVE: {
    id: "HERIDA_BRAZOS_GRAVE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Brazos (Grave)",
    duration: { type: "untilTreated" },
    effectsText: [
      "Penalizador a T.A y T.I",
      "No puede usar armas flexibles ni armas de dos manos"
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["attack"], value: -2, useMagnitude: true, label: "Herida en Brazos" },
        { phases: ["impact"], value: -2, useMagnitude: true, label: "Herida en Brazos" }
      ],
      weaponRestriction: ["flexible", "twoHanded"]
    }
  },
  HERIDA_BRAZOS_CRITICA: {
    id: "HERIDA_BRAZOS_CRITICA", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Brazos (Crítica)",
    duration: { type: "untilTreated" },
    effectsText: [
      "No puede usar armas, ni siquiera naturales",
      "No puede sostener objetos con esa extremidad"
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["attack"], value: -99, useMagnitude: true, label: "Brazos inutilizados" },
        { phases: ["impact"], value: -99, useMagnitude: true, label: "Brazos inutilizados" }
      ],
      weaponRestriction: ["all"]
    }
  },

  // === PIERNAS ===
  HERIDA_PIERNAS_LEVE: {
    id: "HERIDA_PIERNAS_LEVE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Piernas (Leve)",
    duration: { type: "untilTreated" },
    effectsText: ["Velocidad de movimiento reducida a la mitad"],
    mechanics: {
      movementMultiplier: 0.5
    }
  },
  HERIDA_PIERNAS_GRAVE: {
    id: "HERIDA_PIERNAS_GRAVE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Piernas (Grave)",
    duration: { type: "untilTreated" },
    effectsText: [
      "Velocidad reducida a la mitad",
      "T.R de Alteración cada vez que se mueve o queda Derribado"
    ],
    mechanics: {
      movementMultiplier: 0.5,
      movementCheck: { type: "resistance", subtype: "alteration", dc: 10 }
    }
  },
  HERIDA_PIERNAS_CRITICA: {
    id: "HERIDA_PIERNAS_CRITICA", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Piernas (Crítica)",
    duration: { type: "untilTreated" },
    effectsText: [
      "No puede moverse normalmente",
      "Solo puede arrastrarse (movimiento muy limitado)"
    ],
    mechanics: {
      movementBlocked: true,
      crawlOnly: true
    }
  },

  // === PIES ===
  HERIDA_PIES_LEVE: {
    id: "HERIDA_PIES_LEVE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Pies (Leve)",
    duration: { type: "untilTreated" },
    effectsText: [
      "Penalización en T.C de Agilidad y T.E de Equilibrio/Acrobacias",
      "Penalizador a tiradas relacionadas con equilibrio"
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["skill"], tagsAny: ["characteristic:agility", "spec:equilibrio", "spec:acrobacias"], value: -2, useMagnitude: true, label: "Herida en Pies" }
      ]
    }
  },
  HERIDA_PIES_GRAVE: {
    id: "HERIDA_PIES_GRAVE", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Pies (Grave)",
    duration: { type: "untilTreated" },
    effectsText: [
      "Penalizador a T.C de Agilidad y T.E de equilibrio",
      "+1 tick al Inicio de acciones de movimiento (saltar, acrobacias, correr, etc.)"
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["skill"], tagsAny: ["characteristic:agility", "spec:equilibrio", "spec:acrobacias"], value: -2, useMagnitude: true, label: "Herida en Pies" }
      ],
      ctAdjust: { init: 1, onlyForMovement: true }
    }
  },
  HERIDA_PIES_CRITICA: {
    id: "HERIDA_PIES_CRITICA", group: AILMENT_GROUP.ALTERATION,
    label: "Herida en Pies (Crítica)",
    duration: { type: "untilTreated" },
    effectsText: [
      "Permanentemente Derribado",
      "Movimiento arrastrándose: máximo 2 casillas por acción",
      "Penalizador a T.D constantemente"
    ],
    mechanics: {
      rollModifiers: [
        { phases: ["defense"], value: -2, useMagnitude: true, label: "Derribado (Pies)" },
        { phases: ["skill"], tagsAny: ["characteristic:agility", "spec:equilibrio", "spec:acrobacias"], value: -2, useMagnitude: true, label: "Herida en Pies" }
      ],
      movementBlocked: true,
      crawlOnly: true,
      maxCrawlDistance: 2
    }
  }
};
