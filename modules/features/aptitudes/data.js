export const APTITUDES = {
  impulso_sobrehumano: {
    label: "Impulso Sobrehumano",
    type: "utility",            // no es ataque
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 0,
    areaShape: null,
    element: null,
    save: null,
    requires: "Rango 2 de Saltar",
    descriptor: "movimiento",
    duration: null,
    attackAttr: null,
    impactAttr: null,
    effect: "Salto horizontal o vertical con +50% de distancia. Requiere impulso previo de 5 casillas.",
    compLevels: 3,
    ct: { init: 0, exec: 1, rec: 0 },
    usage: { inCombat: true, outCombat: true }
  },

  impulso_supervivencia: {
    label: "Impulso de Supervivencia",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Saltar",
    descriptor: "instinto",
    effect: "INICIO: Tu instinto de supervivencia se activa. Sustituye tu tirada de defensa/evasión por T.E de Saltar con +3 contra trampas y peligros. EJECUCIÓN: Si tienes éxito, saltas hasta 4 metros ignorando terreno difícil y obstáculos. Además, puedes agarrar un aliado adyacente y llevarlo contigo en el salto.",
    risk: "Fallar por 4+ duplica el daño recibido por el pánico.",
    reaction: {
      when: ["trap", "hazard", "environmental-danger"],
      timing: "before-damage"
    },
    ct: { init: 1, exec: 1, rec: 0 },
    phases: {
      init: {
        description: "Reacción instintiva de supervivencia",
        effect: "substitute_defense_roll",
        aptitudeKey: "impulso_supervivencia",
        specKey: "saltar",
        bonus: 3,
        condition: "vs_traps_or_hazards"
      },
      exec: {
        description: "Salto salvador",
        condition: "defense_success",
        effects: [
          {
            type: "free_movement",
            distance: 4,
            ignoresTerrain: true,
            ignoresObstacles: true,
            note: "Salto desesperado escapando del peligro"
          },
          {
            type: "rescue_ally",
            range: "adjacent",
            moveTogether: true,
            note: "Puedes agarrar un aliado adyacente y salvarlo contigo"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  salto_rebote: {
    label: "Salto de Rebote",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Saltar",
    descriptor: "movimiento",
    effect: "Tras tocar una superficie vertical puedes realizar un segundo salto con penalizador -3 a la tirada.",
    risk: "Fallar por 4+ te desequilibra al aterrizar.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  salto_sigiloso: {
    label: "Salto Sigiloso",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Saltar, Rango 2 en Sigilo",
    descriptor: "movimiento",
    effect: "Realiza un salto silencioso. No genera reacciones y suma +1 por rango de Sigilo a la tirada.",
    risk: "Fallar por 4+ te deja Desequilibrado.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  salto_evasivo: {
    label: "Salto Evasivo",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Saltar",
    descriptor: "movimiento",
    effect: "INICIO: Saltas explosivamente para esquivar. Sustituye tu T.D por T.E de Saltar. EJECUCIÓN: Si tienes éxito, te mueves hasta 2 casillas sin provocar reacciones. Si esquivas por margen 3+, aterrizas en posición ventajosa: +2 a tu próximo ataque contra ese enemigo.",
    risk: "Fallar por 3+ aplica el ataque con un nivel de daño adicional por la mala posición.",
    reaction: {
      when: ["incoming-attack", "enemy-attack"],
      timing: "before-attack"
    },
    ct: { init: 1, exec: 1, rec: 0 },
    phases: {
      init: {
        description: "Salto explosivo evasivo",
        effect: "substitute_defense_roll",
        aptitudeKey: "salto_evasivo",
        specKey: "saltar"
      },
      exec: {
        description: "Reposicionamiento aéreo táctico",
        condition: "defense_success",
        effects: [
          {
            type: "free_movement",
            distance: 2,
            noReactions: true,
            note: "Salto acrobático evadiendo el ataque"
          },
          {
            type: "conditional_buff",
            condition: "defense_margin_3plus",
            target: "self",
            effect: "next_attack_vs_target",
            bonus: 2,
            note: "Aterrizas en posición ventajosa para contraatacar"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  maniobra_evasiva: {
    label: "Maniobra Evasiva",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Acrobacias",
    descriptor: "defensa",
    effect: "INICIO: Sustituye tu T.D por una T.E de Acrobacias. EJECUCIÓN: Si tienes éxito, puedes moverte hasta la mitad de tu velocidad sin provocar reacciones y realizar un contraataque cuerpo a cuerpo con +2 de bonificación.",
    risk: "Fallar por 3+ inflige daño adicional igual al rango del atacante.",
    reaction: {
      when: ["incoming-attack", "enemy-attack"],
      timing: "before-attack"
    },
    ct: { init: 1, exec: 1, rec: 0 },
    phases: {
      init: {
        description: "Activa la esquiva acrobática",
        effect: "substitute_defense_roll",
        aptitudeKey: "maniobra_evasiva",
        specKey: "acrobacias"
      },
      exec: {
        description: "Contraataque y reposicionamiento",
        condition: "defense_success",
        effects: [
          {
            type: "bonus_attack",
            requirement: "melee_range",
            bonus: 2,
            note: "Contraataque fluido"
          },
          {
            type: "free_movement",
            distance: "half-speed",
            multiplier: 0.5,
            note: "No provoca reacciones"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  parada_perfecta: {
    label: "Parada Perfecta",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Combate Cuerpo a Cuerpo",
    descriptor: "defensa",
    effect: "INICIO: Sustituye tu T.D por una T.E de Combate C.C. EJECUCIÓN: Si tienes éxito por 3+, desarmas al atacante y puedes atacar inmediatamente sin consumir acción.",
    risk: "Fallar inflinge el daño completo sin posibilidad de bloqueo.",
    reaction: {
      when: ["incoming-attack", "enemy-attack"],
      timing: "before-attack"
    },
    ct: { init: 1, exec: 1, rec: 1 },
    phases: {
      init: {
        description: "Intercepta el ataque con precisión",
        effect: "substitute_defense_roll",
        aptitudeKey: "parada_perfecta",
        specKey: "combate_cuerpo_cuerpo"
      },
      exec: {
        description: "Desarme y contraataque",
        condition: "defense_success_by_3",
        effects: [
          {
            type: "disarm_attacker",
            note: "El arma cae al suelo"
          },
          {
            type: "free_attack",
            note: "Ataque inmediato sin costo de acción"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  reflejo_sobrehumano: {
    label: "Reflejo Sobrehumano",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Reflejos",
    descriptor: "defensa",
    effect: "INICIO: +4 a cualquier tirada de defensa. EJECUCIÓN: Si esquivas completamente, el próximo ataque del enemigo tiene -3 de penalización.",
    risk: "Fallar por 2+ te deja aturdido hasta tu próximo turno.",
    reaction: {
      when: ["incoming-attack", "incoming-hazard"],
      timing: "before-attack"
    },
    ct: { init: 1, exec: 0, rec: 2 },
    phases: {
      init: {
        description: "Reflejos sobrehumanos activos",
        effect: "defense_bonus",
        bonus: 4
      },
      exec: {
        description: "Desorientación del atacante",
        condition: "defense_complete_success",
        effects: [
          {
            type: "debuff_attacker",
            duration: "next_attack",
            penalty: 3,
            note: "Confundido por tu velocidad"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  caer_con_estilo: {
    label: "Caer con Estilo",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 2 de Acrobacias",
    effect: "Reduces el daño por caída en una categoría.",
    risk: "Si fallas la tirada modificada por 3+, calcula el daño usando una categoría superior.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  golpe_acrobatico: {
    label: "Golpe Acrobático",
    type: "attack",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 1,
    requires: "Rango 2 de Acrobacias, Arma cuerpo a cuerpo",
    descriptor: "acrobacia",
    effect: "Ataque cuerpo a cuerpo seguido de un movimiento de 2 casillas sin provocar reacciones.",
    risk: "Fallar por 3+ te deja Desequilibrado.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  reposicionamiento: {
    label: "Reposicionamiento",
    type: "attack",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 1,
    requires: "Rango 4 de Acrobacias, Rango 3 con arma cuerpo a cuerpo",
    descriptor: "acrobacia",
    effect: "Muévete hasta 3 casillas sin provocar reacciones y realiza un ataque inmediato.",
    risk: "Fallar por 5+ te deja Desequilibrado y sin ataque.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  rodamiento_defensivo: {
    label: "Rodamiento Defensivo",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 4 de Acrobacias",
    descriptor: "defensa",
    effect: "INICIO: Rodar con el impacto. Tira T.E de Acrobacias. EJECUCIÓN: Si tienes éxito, reduces la severidad en 1 nivel y te mueves hasta 2 casillas sin reacciones. Si reduces a 0 daño, tu próximo ataque contra ese enemigo tiene +3 de bonificación.",
    risk: "Fallar por 4+ te deja Derribado por el mal rodamiento.",
    ct: { init: 1, exec: 1, rec: 0 },
    reaction: {
      when: ["incoming-attack"],
      timing: "after-attack"
    },
    phases: {
      init: {
        description: "Rodamiento absorbiendo impacto",
        effect: "roll_check",
        aptitudeKey: "rodamiento_defensivo",
        specKey: "acrobacias",
        note: "Dispersas la fuerza con acrobacias"
      },
      exec: {
        description: "Recuperación explosiva",
        condition: "check_success",
        effects: [
          {
            type: "reduce_severity",
            amount: 1,
            note: "El rodamiento absorbe el golpe"
          },
          {
            type: "free_movement",
            distance: 2,
            noReactions: true,
            note: "Ruedas y te levantas dinámicamente"
          },
          {
            type: "conditional_buff",
            condition: "damage_reduced_to_zero",
            target: "self",
            effect: "next_attack_vs_target",
            bonus: 3,
            note: "El impulso del rodamiento te da ventaja para contraatacar"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  desarme: {
    label: "Desarme",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 1,
    area: 1,
    requires: "Rango 1 de Destreza",
    descriptor: "destreza",
    effect: "Supera la T.C de Agilidad del objetivo para que suelte un objeto al suelo.",
    risk: "Fallar por 3+ permite una reacción inmediata del objetivo.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  // Nuevas aptitudes de reacción para diferentes triggers
  ataque_de_oportunidad_mejorado: {
    label: "Ataque de Oportunidad Mejorado",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 con arma cuerpo a cuerpo",
    descriptor: "ataque",
    effect: "INICIO: Detectas la apertura. Preparas golpe preciso. EJECUCIÓN: Ataque de oportunidad con +3 de bonificación. Si impactas, el enemigo queda Desbalanceado (-2 a su próxima acción) por el corte/golpe en movimiento.",
    risk: "Fallar por 4+ te deja expuesto hasta tu próximo turno por la extensión excesiva.",
    ct: { init: 1, exec: 1, rec: 1 },
    reaction: {
      when: ["enemy-movement"],
      timing: "instant"
    },
    phases: {
      init: {
        description: "Lectura del movimiento",
        effect: "prepare_opportunity",
        note: "Anticipas la trayectoria del enemigo"
      },
      exec: {
        description: "Castigo brutal",
        effects: [
          {
            type: "opportunity_attack",
            bonus: 3,
            target: "moving_enemy",
            note: "Golpe devastador en momento vulnerable"
          },
          {
            type: "apply_condition",
            condition: "unbalanced",
            penalty: 2,
            duration: "next_action",
            onHit: true,
            note: "El golpe interrumpe su balance en movimiento"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  contragolpe: {
    label: "Contragolpe",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Combate",
    descriptor: "ataque",
    effect: "INICIO: Aprovechas el fumble enemigo. Preparas contraataque letal. EJECUCIÓN: Realizas un ataque con +4 de bonificación. Si impactas, el enemigo queda Aturdido hasta su próxima acción. Es un golpe brutal que aprovecha su completa exposición.",
    risk: "Solo puedes usar una vez por combate - la oportunidad debe ser perfecta.",
    ct: { init: 1, exec: 1, rec: 0 },
    reaction: {
      when: ["enemy-fumble"],
      timing: "instant"
    },
    phases: {
      init: {
        description: "Ventana de oportunidad crítica",
        effect: "prepare_counter",
        note: "El enemigo está completamente expuesto"
      },
      exec: {
        description: "Golpe letal devastador",
        effects: [
          {
            type: "counter_attack",
            bonus: 4,
            target: "fumbling_enemy",
            note: "Contraataque brutal en momento perfecto"
          },
          {
            type: "apply_condition",
            condition: "stunned",
            duration: "until_next_action",
            onHit: true,
            note: "El impacto deja al enemigo aturdido por la fuerza"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  parada_perfecta: {
    label: "Parada Perfecta",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 4 de Defensa",
    descriptor: "defensa",
    effect: "Reacción antes de ataque enemigo: anula completamente un ataque si superas TD 15.",
    risk: "Fallar deja vulnerable (-3 defensa hasta próximo turno).",
    ct: { init: 0, exec: 0, rec: 0 },
    reaction: {
      when: ["incoming-attack"],
      timing: "before-attack"
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  redirigir_proyectiles: {
    label: "Redirigir Proyectiles",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Destreza",
    descriptor: "destreza",
    effect: "INICIO: Sustituye tu T.D por T.E de Destreza para interceptar el proyectil. EJECUCIÓN: Si esquivas por margen 2+, capturas y rediriges el proyectil a cualquier objetivo visible con +2 de bonificación al impacto. Por margen 4+, añade +1 de avance de dado.",
    risk: "Fallar por 3+ añade un avance de dado al impacto recibido por el mal agarre.",
    ct: { init: 1, exec: 1, rec: 0 },
    reaction: {
      when: ["incoming-projectile"],
      timing: "before-attack"
    },
    phases: {
      init: {
        description: "Interceptación del proyectil",
        effect: "substitute_defense_roll",
        aptitudeKey: "redirigir_proyectiles",
        specKey: "destreza",
        note: "Reflejos sobrehumanos para capturar proyectiles en vuelo"
      },
      exec: {
        description: "Redirección letal",
        condition: "defense_margin_2plus",
        effects: [
          {
            type: "redirect_projectile",
            target: "any_visible",
            bonus: 2,
            note: "Lanzas el proyectil capturado hacia tu objetivo"
          },
          {
            type: "conditional_buff",
            condition: "defense_margin_4plus",
            effect: "add_die_step",
            amount: 1,
            note: "Rediriges con tal fuerza que incrementas el daño"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  segunda_oportunidad: {
    label: "Segunda Oportunidad",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Destreza",
    descriptor: "destreza",
    effect: "INICIO: Reaccionas al instante tras fallar una T.E física. EJECUCIÓN: Repites la tirada fallida con -2 de penalización. Si lo logras con margen 3+, además ganas +1 a tu próxima acción por la confianza recuperada.",
    risk: "Fallar nuevamente por 3+ te deja Desorientado (riguroso) por el exceso de esfuerzo.",
    ct: { init: 1, exec: 1, rec: 0 },
    reaction: {
      when: ["failed-physical-check"],
      timing: "after-roll"
    },
    phases: {
      init: {
        description: "Corrección por instinto",
        effect: "prepare_retry",
        note: "Tu destreza compensa el error instantáneamente"
      },
      exec: {
        description: "Segundo intento mejorado",
        effects: [
          {
            type: "retry_check",
            penalty: 2,
            checkType: "physical",
            note: "Corriges el movimiento con destreza superior"
          },
          {
            type: "conditional_buff",
            condition: "success_margin_3plus",
            target: "self",
            effect: "next_action",
            bonus: 1,
            note: "La corrección exitosa aumenta tu confianza"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  oportunista: {
    label: "Oportunista",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 4 de Destreza",
    effect: "Los enemigos no pueden evitar tus reacciones de arma al salir de tu alcance.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  ascenso_acelerado: {
    label: "Ascenso Acelerado",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Trepar",
    descriptor: "trepar",
    effect: "Escalas a velocidad mitad en lugar de un tercio con penalizador -2 a la tirada.",
    risk: "Fallar por 4+ provoca caída y daño.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  escalada_precision: {
    label: "Escalada con Precisión",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 4 de Trepar",
    effect: "Ignoras penalizadores por superficies resbaladizas o frágiles al trepar.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  ascenso_carga_pesada: {
    label: "Ascenso de Carga Pesada",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 4 de Trepar",
    effect: "Puedes trepar con carga pesada reduciendo tu capacidad de carga en una categoría.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  recursividad: {
    label: "Recursividad",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 2 de Trepar",
    effect: "Improvisa puntos de apoyo y obtiene +2 a Trepar sin equipo.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  descenso_controlado: {
    label: "Descenso Controlado",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 4 de Trepar",
    descriptor: "trepar",
    effect: "Desciende rápidamente sin reducir velocidad de movimiento.",
    risk: "Fallar por 3+ causa caída con daño completo.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  paso_firme: {
    label: "Paso Firme",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 1 de Equilibrio",
    effect: "Bonificador +1 por rango de Equilibrio a tiradas de Acrobacias, Saltar y Trepar.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  inamovible: {
    label: "Inamovible",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Equilibrio",
    descriptor: "defensa",
    effect: "INICIO: Te afirmas como roca. Tira T.E de Equilibrio con +2 por rango para resistir derribo/desplazamiento. EJECUCIÓN: Si resistes, puedes hacer un ataque de oportunidad inmediato contra quien intentó derribarte/empujarte con +2 de bonificación.",
    risk: "Fallar por 4+ te deja Desequilibrado por el esfuerzo excesivo.",
    ct: { init: 1, exec: 1, rec: 0 },
    reaction: {
      when: ["knockdown", "forced-movement"],
      timing: "before-effect"
    },
    phases: {
      init: {
        description: "Anclaje absoluto",
        effect: "roll_check",
        aptitudeKey: "inamovible",
        specKey: "equilibrio",
        bonusPerRank: 2,
        note: "Te conviertes en masa inamovible"
      },
      exec: {
        description: "Contraataque por inercia",
        condition: "check_success",
        effects: [
          {
            type: "resist_effect",
            note: "Permaneces firme ante la fuerza"
          },
          {
            type: "opportunity_attack",
            bonus: 2,
            target: "attacker",
            note: "Su fuerza rebota y aprovechas para contraatacar"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  punto_apoyo: {
    label: "Punto de Apoyo",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 3 de Equilibrio",
    effect: "Concedes +2 a las tiradas de Equilibrio de aliados en terreno inestable mientras te mantengas cercano.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  movimiento_seguro: {
    label: "Movimiento Seguro",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 4 de Equilibrio",
    effect: "Te desplazas sobre superficies estrechas o resbaladizas sin penalizadores de movimiento.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  carga_sobre_montura: {
    label: "Carga sobre Montura",
    type: "attack",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 1,
    requires: "Rango 1 de Equitación, Montura",
    descriptor: "montura",
    effect: "Carga montada con +2 a la tirada de ataque tras moverte 5 casillas.",
    risk: "Fallar por 5+ deja Desorientados a jinete y montura.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  maniobra_defensiva_montura: {
    label: "Maniobra Defensiva",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Equitación, Montura",
    descriptor: "montura",
    effect: "INICIO: Diriges maniobra evasiva. Sustituye tu T.D por T.E de Equitación. EJECUCIÓN: Si esquivas, te mueves hasta 2 casillas sin reacciones. Si esquivas por margen 3+, puedes hacer un ataque montado inmediato con +2 de bonificación.",
    risk: "Fallar por 3+ te hace perder el equilibrio y caes de la montura.",
    ct: { init: 1, exec: 1, rec: 0 },
    reaction: {
      when: ["incoming-melee-attack"],
      timing: "before-attack"
    },
    phases: {
      init: {
        description: "Sincronización jinete-montura",
        effect: "substitute_defense_roll",
        aptitudeKey: "maniobra_defensiva_montura",
        specKey: "equitacion",
        condition: "mounted"
      },
      exec: {
        description: "Contraataque montado fluido",
        condition: "defense_success",
        effects: [
          {
            type: "free_movement",
            distance: 2,
            noReactions: true,
            mounted: true,
            note: "Montura y jinete se mueven como uno"
          },
          {
            type: "conditional_attack",
            condition: "defense_margin_3plus",
            bonus: 2,
            note: "El impulso de la evasión se convierte en ataque devastador"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  cuidador_montura: {
    label: "Cuidador",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 2 de Equitación, Montura",
    effect: "Reducen a la mitad tiempo y recursos de mantenimiento de la montura.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  adiestramiento_montura: {
    label: "Adiestramiento",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 2 de Equitación, Montura",
    effect: "Tu montura aprende Comunicación especial y Uso de habilidades especiales (Rastrear).",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  esquivar_en_movimiento: {
    label: "Esquivar en Movimiento",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Equitación, Montura",
    descriptor: "montura",
    effect: "INICIO: Evasión dinámica montada. Sustituye tu T.D por T.E de Equitación contra ataque a distancia. EJECUCIÓN: Si esquivas, tu montura avanza media velocidad sin reacciones. Tú y aliados adyacentes ganan +2 defensa vs ataques a distancia hasta tu próximo turno por cobertura móvil.",
    risk: "Fallar por 3+ deja a la montura Desequilibrada por el movimiento brusco.",
    ct: { init: 1, exec: 1, rec: 0 },
    reaction: {
      when: ["incoming-ranged-attack"],
      timing: "before-attack"
    },
    phases: {
      init: {
        description: "Galope evasivo coordinado",
        effect: "substitute_defense_roll",
        aptitudeKey: "esquivar_en_movimiento",
        specKey: "equitacion",
        condition: "mounted"
      },
      exec: {
        description: "Avance táctico protector",
        condition: "defense_success",
        effects: [
          {
            type: "mount_movement",
            distance: "half_speed",
            noReactions: true,
            note: "La montura serpentea esquivando proyectiles"
          },
          {
            type: "area_buff",
            range: "adjacent",
            targets: "allies_and_self",
            bonus: 2,
            defenseType: "ranged",
            duration: "until_your_next_turn",
            note: "Tu montura en movimiento crea cobertura móvil"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  carga_vigor: {
    label: "Carga",
    type: "attack",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 1,
    requires: "Rango 1 de Vigor",
    descriptor: "vigor",
    effect: "Carga en línea recta de al menos 4 casillas con bonificador +1 por rango de Vigor al ataque.",
    risk: "Fallar por 3+ te deja Desorientado.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  fortaleza_inquebrantable: {
    label: "Fortaleza Inquebrantable",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 2 de Vigor",
    effect: "Ignoras el primer nivel de Fatiga acumulado cada día.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  resistencia_hierro: {
    label: "Resistencia de Hierro",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    requires: "Rango 3 de Vigor",
    effect: "Necesitas más heridas para colapsar (incrementa el umbral a criterio del GM).",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  golpe_de_furia: {
    label: "Golpe de Furia",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 1,
    requires: "Rango 3 de Vigor, Arma cuerpo a cuerpo",
    descriptor: "vigor",
    effect: "Golpe para romper partes de equipo o criatura en vez de infligir daño.",
    risk: "Fallar por 4+ te deja desequilibrado y con -2 a la defensa en el próximo turno.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  // ========== APTITUDES DE ESPECIALIZACIÓN ==========

  // Interpretación
  leer_intenciones: {
    label: "Leer Intenciones",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 10,
    area: 0,
    requires: "Rango 1 de Interpretación",
    descriptor: "interpretacion",
    effect: "INICIO: Analizas las intenciones del enemigo. Tira T.C de Compostura del enemigo. EJECUCIÓN: Si tienes éxito, ganas +1 por rango de Interpretación a tu tirada de defensa contra ese enemigo específico.",
    risk: "Fallar por 3+ te hace malinterpretar sus intenciones: -1 a la defensa contra ese enemigo.",
    ct: { init: 1, exec: 0, rec: 0 },
    reaction: {
      when: ["incoming-attack"],
      timing: "before-attack"
    },
    phases: {
      init: {
        description: "Lectura de intenciones",
        effect: "roll_check",
        aptitudeKey: "leer_intenciones",
        specKey: "interpretacion",
        difficulty: "target_composure",
        note: "Analizas el lenguaje corporal y micro-expresiones"
      },
      exec: {
        description: "Anticipación perfecta",
        condition: "check_success",
        effects: [
          {
            type: "defense_bonus",
            bonusPerRank: 1,
            specKey: "interpretacion",
            target: "specific_enemy",
            duration: "1_turn_or_first_attack",
            note: "Predices perfectamente su movimiento"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  analisis_de_condicion: {
    label: "Análisis de Condición",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 10,
    area: 0,
    requires: "Rango 3 de Interpretación, Tirada exitosa de Anatomía contra la criatura",
    descriptor: "interpretacion",
    effect: "Evalúa el estado actual de una criatura previamente analizada. Obtienes información sobre su salud, puntos de acción, y estados alterados actuales.",
    risk: "Fallar por 3+ te da información incorrecta: -2 a todas las tiradas de especialización para tácticas contra esa criatura.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  // Percepción
  verificacion: {
    label: "Verificación",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Percepción",
    descriptor: "percepcion",
    effect: "Puedes usar T.E de Percepción (Sabiduría) en lugar de Interpretación (Intelecto) cuando seas víctima de un engaño. Notas detalles sutiles que delatan mentiras.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  sentidos_agudizados: {
    label: "Sentidos Agudizados",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 4,
    area: 0,
    requires: "Rango 3 de Percepción",
    descriptor: "percepcion",
    effect: "Detectas criaturas en total oscuridad a menos de 4 casillas. La ubicación no es precisa, se usa mecánica de puntos cardinales.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  consciencia_del_tauma: {
    label: "Consciencia del Tauma",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Nivel de Resonancia 3, Rango 2 de Percepción",
    descriptor: "percepcion",
    effect: "Detectas el Tauma en el ambiente de forma visible. Puedes concentrarte para analizar su origen o dirección.",
    risk: "Fallar por 3+ te deja sobrecargado.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  // Supervivencia
  instinto_de_supervivencia_spec: {
    label: "Instinto de Supervivencia",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Supervivencia",
    descriptor: "supervivencia",
    effect: "INICIO: Reaccionas ante amenaza natural inmediata (deslizamiento, avalancha, depredador). Tira característica Agilidad. EJECUCIÓN: Si tienes éxito, te mueves hasta 2 casillas hacia dirección segura, evitando el peligro completamente.",
    risk: "Fallar por 3+ te deja en posición vulnerable: el peligro te impacta con severidad aumentada en 1 nivel.",
    ct: { init: 1, exec: 1, rec: 0 },
    reaction: {
      when: ["natural-hazard", "environmental-danger"],
      timing: "before-damage"
    },
    phases: {
      init: {
        description: "Instinto primitivo activado",
        effect: "roll_attribute",
        attribute: "agilidad",
        note: "Tu cuerpo reacciona antes que tu mente"
      },
      exec: {
        description: "Evasión instintiva",
        condition: "check_success",
        effects: [
          {
            type: "free_movement",
            distance: 2,
            direction: "safe",
            note: "Escapas del peligro por puro instinto"
          },
          {
            type: "avoid_danger",
            note: "Evitas completamente la amenaza natural"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  sentido_de_peligro: {
    label: "Sentido de Peligro",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Supervivencia",
    descriptor: "supervivencia",
    effect: "Puedes usar tiradas de Supervivencia en lugar de Identificación para detectar trampas de tipo Entorno, Vivas o Elementales.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  // ========== APTITUDES SOCIALES ==========

  // Engaño
  finta: {
    label: "Finta",
    type: "attack",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 1,
    requires: "Rango 1 de Engaño",
    descriptor: "engano",
    effect: "INICIO: Finta engañosa. Sustituye tu T.A por T.E de Engaño. EJECUCIÓN: Ataque cuerpo a cuerpo normal. Si impactas, enemigo debe resistir alteración (Leve + 1 categoría por rango) o queda Desequilibrado.",
    risk: "Fallar por 3+ permite al oponente ejecutar una reacción instintiva contra ti.",
    ct: { init: 1, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  distraccion: {
    label: "Distracción",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 5,
    area: 0,
    requires: "Rango 2 de Engaño",
    descriptor: "engano",
    effect: "INICIO: Distraes al enemigo cuando te ataca. Tira T.E de Engaño. EJECUCIÓN: Si tienes éxito, el enemigo recibe -1 por rango de Engaño a su T.A contra ti.",
    risk: "Fallar por 3+ da al enemigo +1 a T.D y T.A durante su próximo turno.",
    ct: { init: 1, exec: 0, rec: 0 },
    reaction: {
      when: ["incoming-attack", "targeted-by-ability"],
      timing: "before-attack"
    },
    phases: {
      init: {
        description: "Distracción engañosa",
        effect: "roll_check",
        aptitudeKey: "distraccion",
        specKey: "engano",
        note: "Desvías su atención con un movimiento falso"
      },
      exec: {
        description: "Enemigo desconcentrado",
        condition: "check_success",
        effects: [
          {
            type: "attack_penalty",
            penaltyPerRank: 1,
            specKey: "engano",
            target: "attacker",
            duration: "this_attack",
            note: "El engaño desvía su golpe"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  // Liderazgo
  orden: {
    label: "Orden",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 5,
    area: 0,
    requires: "Rango 2 de Liderazgo",
    descriptor: "liderazgo",
    effect: "Da una orden simple de una palabra a una criatura que pueda entenderla ('¡Detente!', '¡Suelta!', '¡Ven!'). La criatura debe realizar la acción si falla T.C Compostura.",
    risk: "Fallar por 3+ vuelve la criatura resistente: -2 a futuras interacciones.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  imposicion: {
    label: "Imposición",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 5,
    area: 0,
    requires: "Rango 4 de Liderazgo",
    descriptor: "liderazgo",
    effect: "Impones tu voluntad con orden compleja ('¡Ataca a ese enemigo!', '¡Defiende esta posición!'). La criatura debe realizar la acción si falla T.C Compostura.",
    risk: "Fallar por 3+ vuelve la criatura resistente: -2 a futuras interacciones.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  // Intimidación
  desmoralizacion: {
    label: "Desmoralización",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 10,
    area: 0,
    requires: "Rango 1 de Intimidación",
    descriptor: "intimidacion",
    effect: "Disminuye la preparación de una criatura en 2. Le otorga -1 por rango de Intimidación a tiradas de resistencia. Duración: Presencia rondas.",
    risk: "Fallar por 3+ vuelve la criatura resistente a tu presencia.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  aterrorizar: {
    label: "Aterrorizar",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 10,
    area: 0,
    requires: "Rango 2 de Intimidación",
    descriptor: "intimidacion",
    effect: "La criatura debe resistir alteración (Leve + 1 categoría por rango) o queda Aterrorizada (Desafiante). Duración: Presencia rondas.",
    risk: "Fallar por 3+ vuelve la criatura resistente a tu presencia.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  paralizar_intimidacion: {
    label: "Paralizar",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 10,
    area: 0,
    requires: "Rango 3 de Intimidación",
    descriptor: "intimidacion",
    effect: "La criatura debe resistir alteración (Moderado + 1 categoría por rango) o queda Paralizada (Riguroso). Duración: Presencia rondas.",
    risk: "Fallar por 3+ vuelve la criatura resistente a tu presencia.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  asfixiar: {
    label: "Asfixiar",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 10,
    area: 0,
    requires: "Rango 4 de Intimidación",
    descriptor: "intimidacion",
    effect: "La criatura debe resistir alteración (Grave + 1 categoría por rango) o queda Paralizada (Exigente). Duración: Presencia rondas.",
    risk: "Fallar por 3+ vuelve la criatura resistente a tu presencia.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  // Sigilo
  reduccion_de_presencia: {
    label: "Reducción de Presencia",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Sigilo",
    descriptor: "sigilo",
    effect: "Obtienes 10% por rango de reducción de presencia al moverte sigilosamente. Esto se traduce en 10% por rango de fallo absoluto en T.E de Percepción enemiga para detectarte.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  sombra: {
    label: "Sombra",
    type: "reaction",
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Sigilo",
    descriptor: "sigilo",
    effect: "INICIO: Cuando tu posición va a ser revelada con 'Ocultación', tira T.E de Engaño. EJECUCIÓN: Si tienes éxito, los enemigos fallan en detectarte. Usan mecánica de puntos cardinales para ubicación aproximada.",
    risk: "Fallar por 3+ da a los enemigos +2 a Percepción contra ti.",
    ct: { init: 1, exec: 0, rec: 0 },
    reaction: {
      when: ["position-about-to-be-revealed"],
      timing: "before-reveal"
    },
    phases: {
      init: {
        description: "Engaño de sombras",
        effect: "roll_check",
        aptitudeKey: "sombra",
        specKey: "engano",
        note: "Creas una ilusión de tu posición"
      },
      exec: {
        description: "Ocultación mantenida",
        condition: "check_success",
        effects: [
          {
            type: "avoid_detection",
            useCardinalPoints: true,
            note: "Permaneces oculto, solo revelan tu dirección aproximada"
          }
        ]
      }
    },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  ocultacion_superior: {
    label: "Ocultación Superior",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Sigilo",
    descriptor: "sigilo",
    effect: "Obtienes ocultación con cobertura ligera (normal requiere media/total). Tamaño Grande: cobertura media es suficiente.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  fantasma: {
    label: "Fantasma",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Sigilo",
    descriptor: "sigilo",
    effect: "Te mueves sin perder ocultación. Realizas acción de movimiento pero debes hacer pruebas de Sigilo al terminar para evitar detección.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  // ========== ARTES Y OFICIOS ==========

  // Herrería
  reparar_equipo_herreria: {
    label: "Reparar Equipo",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Kit de Reparación",
    descriptor: "herreria",
    effect: "Recupera durabilidad según reglas de Descanso Completo o dedicando 1 hora al día para recuperar 3 puntos de durabilidad.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  estudio_disenos_herreria: {
    label: "Estudio de Diseños",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Manual de diseño para metales",
    descriptor: "herreria",
    effect: "Estudia diseños para aumentar competencia en Herrería. Tiempo: 60 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  fabricacion_herreria: {
    label: "Fabricación de Armas y Armaduras",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Herrería",
    descriptor: "herreria",
    effect: "Fabrica armas (Arrojadizas/Hoja: Desafiante, Flexibles: Exigente), armaduras (Intermedias: Desafiante, Pesadas: Riguroso) y objetos metálicos según reglas de Fabricación.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  refinamiento_herreria: {
    label: "Refinamiento de Equipo",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Herrería, Kit de Refinamiento de Minerales",
    descriptor: "herreria",
    effect: "Refina objetos según reglas de Fabricación.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  identificar_maniobras: {
    label: "Identificar Maniobras",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 5,
    area: 0,
    requires: "Rango 1 de Herrería",
    descriptor: "herreria",
    effect: "Identifica maniobras de equipo cuyo rango sea igual a tu rango de competencia. Dificultad: R1 Desafiante, R2 Riguroso, R3 Exigente, R4 Extremo.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: false }
  },

  // Sastrería
  reparar_equipo_sastreria: {
    label: "Reparar Equipo",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Kit de Reparación",
    descriptor: "sastreria",
    effect: "Recupera durabilidad según reglas de Descanso Completo o dedicando 1 hora al día para recuperar 3 puntos de durabilidad.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  estudio_disenos_sastreria: {
    label: "Estudio de Diseños",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Manual de diseño para fibras",
    descriptor: "sastreria",
    effect: "Estudia diseños para aumentar competencia en Sastrería. Tiempo: 60 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  fabricacion_sastreria: {
    label: "Fabricación de Armas y Armaduras",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Sastrería",
    descriptor: "sastreria",
    effect: "Fabrica armas (Distancia: Riguroso, Flexibles: Exigente), armaduras ligeras (Desafiante) y objetos de fibras/cuero según reglas de Fabricación.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  refinamiento_sastreria: {
    label: "Refinamiento de Equipo",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Sastrería, Kit de Refinamiento de Fibras",
    descriptor: "sastreria",
    effect: "Refina objetos según reglas de Fabricación.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  // Joyería
  estudio_disenos_joyeria: {
    label: "Estudio de Diseños",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Manual de diseño para joyas",
    descriptor: "joyeria",
    effect: "Estudia diseños para aumentar competencia en Joyería. Tiempo: 60 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  fabricacion_joyeria: {
    label: "Fabricación de Joyas y Accesorios",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Joyería",
    descriptor: "joyeria",
    effect: "Fabrica colgantes (Desafiante), amuletos (Riguroso) e insignias (Exigente) según reglas de Fabricación.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  refinamiento_joyeria: {
    label: "Refinamiento de Equipo",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Joyería, Kit de Refinamiento de Minerales",
    descriptor: "joyeria",
    effect: "Refina objetos según reglas de Fabricación.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  // Alquimia
  estudio_formulas: {
    label: "Estudio de Fórmulas",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Manual de fórmulas",
    descriptor: "alquimia",
    effect: "Estudia fórmulas para aumentar competencia en Alquimia según rareza (Simple: Desafiante, Raro: Riguroso, Excepcional: Exigente). Tiempo: 1 hora.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  fabricacion_alquimia: {
    label: "Fabricación de Elixires y Veneno",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Alquimia",
    descriptor: "alquimia",
    effect: "Fabrica elixires y venenos según reglas de Fabricación.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  // Ingeniería
  estudio_planos: {
    label: "Estudio de Planos",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Manual de planos",
    descriptor: "ingenieria",
    effect: "Estudia planos para aumentar competencia en Ingeniería según rareza (Simple: Desafiante, Complejo: Riguroso, Avanzado: Exigente). Tiempo: 60 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  fabricacion_ingenieria: {
    label: "Fabricación de Herramientas y Artículos",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Ingeniería",
    descriptor: "ingenieria",
    effect: "Fabrica herramientas y artículos según reglas de Fabricación.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  reconocimiento_diseno: {
    label: "Reconocimiento de Diseño",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Ingeniería",
    descriptor: "ingenieria",
    effect: "Entiende y analiza planos/diagramas a partir del funcionamiento de un objeto. No necesitas adquirir el diseño. Tiempo: 30 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  // Trampas
  estudio_diagramas: {
    label: "Estudio de Diagramas",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Manual de diagramas",
    descriptor: "trampas",
    effect: "Estudia diagramas para aumentar competencia en creación de trampas según complejidad (Simple: Desafiante, Raro: Riguroso, Excepcional: Exigente). Tiempo: 60 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  fabricacion_trampas: {
    label: "Fabricación de Trampas",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Trampas",
    descriptor: "trampas",
    effect: "Fabrica trampas según reglas de Fabricación.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  // Minería
  estudio_manuales_mineria: {
    label: "Estudio de Manuales",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 0 de Minería, Manual de minería",
    descriptor: "mineria",
    effect: "Estudia manuales de minería para aumentar competencia. Tiempo: 60 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  extraccion_minerales: {
    label: "Extracción de Minerales",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Minería, Herramientas de Minería",
    descriptor: "mineria",
    effect: "Extrae minerales según reglas de Extracción de Minería. Tiempo: según depósito.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  // Herboristería
  estudio_manuales_herboristeria: {
    label: "Estudio de Manuales",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 0 de Herboristería, Manual de Herboristería",
    descriptor: "herboristeria",
    effect: "Estudia manuales de herboristería para aumentar competencia. Tiempo: 60 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  extraccion_plantas: {
    label: "Extracción de Plantas",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Herboristería, Herramientas de Herboristería",
    descriptor: "herboristeria",
    effect: "Extrae plantas según reglas de Extracción. Tiempo: según accesibilidad.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  // Medicina
  estudio_manuales_medicina: {
    label: "Estudio de Manuales",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 0 de Medicina, Manual de medicina",
    descriptor: "medicina",
    effect: "Estudia manuales de medicina para aumentar competencia. Tiempo: 60 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  extraccion_criaturas: {
    label: "Extracción de Criaturas",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Medicina",
    descriptor: "medicina",
    effect: "Extrae materiales de criaturas según reglas de Extracción.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  anatomia: {
    label: "Anatomía",
    type: "utility",
    category: "active",
    clazz: "aptitude",
    range: 5,
    area: 0,
    requires: "Rango 1 de Medicina",
    descriptor: "medicina",
    effect: "Analiza criatura para obtener info según rango. Dificultad: Mortales (Desafiante), Anómalas (Riguroso), Primordiales (Exigente). Info: R1 Cualidades, R2 +Resistencias, R3 +Debilidades, R4 +Habilidades.",
    ct: { init: 0, exec: 1, rec: 0 },
    requiresPick: false,
    usage: { inCombat: true, outCombat: true }
  },

  tratar_veneno_leve: {
    label: "Tratar Veneno Leve",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Medicina, Kit Médico Básico",
    descriptor: "medicina",
    effect: "Trata venenos leves. Tiempo: 10 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  retrasar_infeccion: {
    label: "Retrasar Infección",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 1 de Medicina, Kit Médico Básico",
    descriptor: "medicina",
    effect: "Evita propagación de infección. Tiempo: 10 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  tratar_veneno_moderado: {
    label: "Tratar Veneno Moderado",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Medicina, Kit Médico Avanzado",
    descriptor: "medicina",
    effect: "Trata venenos leves y moderados. Tiempo: 10 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  tratar_infeccion_leve: {
    label: "Tratar Infección Leve",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 2 de Medicina, Kit Médico Básico",
    descriptor: "medicina",
    effect: "Identifica y trata infecciones leves. Tiempo: 10 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  tratar_veneno_grave: {
    label: "Tratar Veneno Grave",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Medicina, Kit Médico Especializado",
    descriptor: "medicina",
    effect: "Trata todo tipo de venenos. Tiempo: 10 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  tratar_infeccion_moderada: {
    label: "Tratar Infección Moderada",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 3 de Medicina, Kit Médico Avanzado",
    descriptor: "medicina",
    effect: "Trata infecciones leves y moderadas. Tiempo: 10 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  },

  tratar_infeccion_grave: {
    label: "Tratar Infección Grave",
    type: "passive",
    category: "passive",
    clazz: "aptitude",
    range: 0,
    area: 0,
    requires: "Rango 4 de Medicina, Kit Médico Especializado",
    descriptor: "medicina",
    effect: "Trata todo tipo de infecciones. Tiempo: 10 min.",
    ct: { init: 0, exec: 0, rec: 0 },
    requiresPick: false,
    usage: { inCombat: false, outCombat: true }
  }
};
