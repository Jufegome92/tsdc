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
    type: "reaction",           // para tu ventana de reacciones
    category: "reaction",
    clazz: "aptitude",
    range: 0,
    area: 0,
    areaShape: null,
    element: null,
    save: null,
    requires: "Rango 2 de Saltar",
    descriptor: "movimiento",
    duration: "instantánea",
    attackAttr: null,
    impactAttr: null,
    effect: "Reacción: salto instintivo para evitar un peligro. Sustituye la tirada y otorga +2 vs trampas. Riesgo: si falla por 4+, recibe el doble de daño.",
    compLevels: 3,
    ct: { init: 0, exec: 0, rec: 0 },
    reaction: {
      when: ["trap","hazard"],
      timing: "instant"  // instant, before-attack, after-attack
    },
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
    effect: "Evasión aérea ante un ataque. Tras resolverla puedes moverte 1 casilla sin provocar reacciones.",
    risk: "Fallar por 3+ aplica el ataque con un nivel de daño adicional.",
    reaction: {
      when: ["incoming-attack", "enemy-attack"],
      timing: "before-attack"
    },
    ct: { init: 0, exec: 0, rec: 0 },
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
    effect: "INICIO: Sustituye tu T.D por una T.E de Acrobacias. EJECUCIÓN: Si tienes éxito, puedes moverte hasta tu velocidad sin provocar reacciones y realizar un contraataque cuerpo a cuerpo con +2 de bonificación.",
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
            type: "free_movement",
            distance: "speed",
            note: "No provoca reacciones"
          },
          {
            type: "bonus_attack",
            requirement: "melee_range",
            bonus: 2,
            note: "Contraataque fluido"
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
    effect: "Al fallar la defensa reduces la severidad en 1 y puedes reposicionarte a una casilla adyacente.",
    risk: "Fallar por 4+ deja al personaje Derribado.",
    ct: { init: 0, exec: 0, rec: 0 },
    reaction: {
      when: ["incoming-attack"],
      timing: "after-attack"
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
    effect: "Reacción al movimiento enemigo: ataque con +2 al impacto.",
    risk: "Fallar por 4+ te deja expuesto hasta tu próximo turno.",
    ct: { init: 0, exec: 0, rec: 1 },
    reaction: {
      when: ["enemy-movement"],
      timing: "instant"
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
    effect: "Reacción a fumble enemigo: ataque inmediato con ventaja.",
    risk: "Solo puedes usar una vez por combate.",
    ct: { init: 0, exec: 0, rec: 0 },
    reaction: {
      when: ["enemy-fumble"],
      timing: "instant"
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
    effect: "Al superar la defensa contra un proyectil por 3+ puedes devolverlo a su origen.",
    risk: "Fallar por 3+ añade un avance de dado al impacto recibido.",
    ct: { init: 0, exec: 0, rec: 0 },
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
    effect: "Tras fallar una T.E física repite la tirada con penalizador -3.",
    risk: "Fallar por 3+ te deja Desorientado (riguroso).",
    ct: { init: 0, exec: 0, rec: 0 },
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
    effect: "Reacción contra derribo/desplazamiento: +1 por rango de Equilibrio a la resistencia.",
    ct: { init: 0, exec: 0, rec: 0 },
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
    effect: "Sustituye tu T.D por una T.E de Equitación contra el próximo ataque cuerpo a cuerpo recibido.",
    risk: "Fallar por 3+ te hace caer de la montura.",
    ct: { init: 0, exec: 0, rec: 0 },
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
    effect: "Sustituye la defensa contra un ataque a distancia por Equitación y mueve la montura media velocidad.",
    risk: "Fallar por 3+ deja a la montura Desequilibrada.",
    ct: { init: 0, exec: 0, rec: 0 },
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
  }
};
