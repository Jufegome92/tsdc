// modules/features/fabrication/tools.js
// Catálogo de herramientas para artesanos

/**
 * Tipos de herramientas según su calibre
 */
export const TOOL_TYPES = {
  kit: "Kit",
  gran_calibre: "Gran Calibre",
  bajo_calibre: "Bajo Calibre",
  artefacto: "Artefacto"
};

/**
 * Herramientas de Herrería
 */
export const HERRERIA_TOOLS = {
  forja_tradicional: {
    key: "forja_tradicional",
    label: "Forja Tradicional",
    type: "gran_calibre",
    cost: 6000,
    dimensions: "1.5m x 1m x 1m",
    weight: 500,
    consumable: false,
    description: "Estructura robusta hecha de piedra y ladrillo, con un diseño que permite una ventilación adecuada y un espacio para el carbón o leña."
  },
  yunke: {
    key: "yunke",
    label: "Yunke",
    type: "gran_calibre",
    cost: 5100,
    dimensions: "80cm x 40cm x 30cm",
    weight: 150,
    consumable: false,
    description: "Bloque pesado de acero o hierro, con una superficie plana y dura en la parte superior."
  },
  martillo_forja: {
    key: "martillo_forja",
    label: "Martillo de Forja",
    type: "bajo_calibre",
    cost: 350,
    dimensions: "80cm",
    weight: 2.5,
    consumable: false,
    description: "Herramienta pesada con un mango largo, utilizada para golpear y moldear metal en el yunque."
  },
  tenazas: {
    key: "tenazas",
    label: "Tenazas",
    type: "bajo_calibre",
    cost: 400,
    dimensions: "70cm",
    weight: 3.5,
    consumable: false,
    description: "Herramienta con dos brazos largos que se utilizan para sostener y manipular piezas calientes de metal."
  },
  molde_fundicion: {
    key: "molde_fundicion",
    label: "Molde de Fundición",
    type: "gran_calibre",
    cost: 500,
    dimensions: "40cm x 30cm x 25cm",
    weight: 20,
    consumable: false,
    description: "Recipiente hecho de material refractario que soporta altas temperaturas."
  },
  herreria_elemental: {
    key: "herreria_elemental",
    label: "Herrería Elemental",
    type: "artefacto",
    cost: 20000,
    consumable: false,
    resonanciaElemental: true,
    effect: "Reduce el tiempo de fabricación de objetos metálicos a un tercio.",
    description: "Artefacto compacto y portátil que contiene todo lo necesario para una forja, incluyendo un yunque en miniatura y una fuente de calor elemental."
  }
};

/**
 * Herramientas de Sastrería
 */
export const SASTRERIA_TOOLS = {
  mesa_corte: {
    key: "mesa_corte",
    label: "Mesa de Corte",
    type: "gran_calibre",
    cost: 800,
    dimensions: "2m x 1m x 0.75m",
    weight: 15,
    consumable: false,
    description: "Superficie amplia y plana, esencial para cortar y medir telas y pieles con precisión."
  },
  kit_costura: {
    key: "kit_costura",
    label: "Kit de Costura",
    type: "kit",
    costPerGrade: 100,
    dimensions: "30cm x 20cm x 10cm",
    weight: 2,
    usesPerGrade: 10,
    consumable: true,
    description: "Conjunto básico que incluye agujas de varios tamaños, hilos de diversos colores, tijeras afiladas y otros utensilios."
  },
  prensa_cuero: {
    key: "prensa_cuero",
    label: "Prensa de Cuero",
    type: "gran_calibre",
    cost: 1000,
    dimensions: "1.5m x 1m x 1m",
    weight: 25,
    consumable: false,
    description: "Herramienta para suavizar, estirar y dar forma al cuero."
  },
  kit_tintes: {
    key: "kit_tintes",
    label: "Kit de Tintes y Brochas",
    type: "kit",
    costPerGrade: 200,
    dimensions: "25cm x 15cm x 10cm",
    weight: 1.5,
    usesPerGrade: 8,
    consumable: true,
    description: "Variedad de tintes en diferentes colores y brochas de varios tamaños."
  },
  sastreria_elemental: {
    key: "sastreria_elemental",
    label: "Sastrería Elemental",
    type: "artefacto",
    cost: 20000,
    consumable: false,
    resonanciaElemental: true,
    effect: "Reduce el tiempo de fabricación de objetos hechos con tela o cuero a un tercio.",
    description: "Conjunto compacto y portátil con una superficie plana que se puede plegar y una prensa de cuero que utiliza energía elemental."
  }
};

/**
 * Herramientas de Alquimia
 */
export const ALQUIMIA_TOOLS = {
  alambique: {
    key: "alambique",
    label: "Alambique Alquímico",
    type: "gran_calibre",
    cost: 1000,
    dimensions: "50cm x 50cm x 75cm",
    weight: 10,
    consumable: false,
    description: "Instrumento clave para destilación, purificación y extracción de esencias de ingredientes."
  },
  mortero_maja: {
    key: "mortero_maja",
    label: "Mortero y Maja",
    type: "bajo_calibre",
    cost: 320,
    dimensions: "20cm x 20cm x 10cm",
    weight: 3,
    consumable: false,
    description: "Pareja de herramientas para triturar y mezclar ingredientes sólidos."
  },
  kit_calderos: {
    key: "kit_calderos",
    label: "Kit de Calderos",
    type: "kit",
    costPerGrade: 400,
    dimensions: "40cm x 30cm x 20cm",
    weight: 5,
    usesPerGrade: 6,
    consumable: true,
    description: "Variedad de calderos para mezclar y frascos de distintos tamaños."
  },
  balanza_precision: {
    key: "balanza_precision",
    label: "Balanza de Precisión",
    type: "bajo_calibre",
    cost: 450,
    dimensions: "30cm x 20cm x 15cm",
    weight: 2,
    consumable: false,
    description: "Instrumento esencial para medir con exactitud las cantidades de ingredientes."
  },
  laboratorio_elemental: {
    key: "laboratorio_elemental",
    label: "Laboratorio de Alquimia Elemental",
    type: "artefacto",
    cost: 15000,
    consumable: false,
    resonanciaElemental: true,
    effect: "Reduce el tiempo de fabricación de elixires y venenos a un tercio.",
    description: "Laboratorio compacto con quemadores elementales, matraces, morteros y otros utensilios."
  }
};

/**
 * Herramientas de Joyería
 */
export const JOYERIA_TOOLS = {
  kit_orfebreria: {
    key: "kit_orfebreria",
    label: "Kit de Orfebrería",
    type: "kit",
    costPerGrade: 400,
    dimensions: "40cm x 30cm x 20cm",
    weight: 4,
    usesPerGrade: 16,
    consumable: true,
    description: "Conjunto de herramientas especializadas que incluye pinzas, limas, sierras y alicates."
  },
  horno_joyeria: {
    key: "horno_joyeria",
    label: "Horno de Joyería",
    type: "gran_calibre",
    cost: 2700,
    dimensions: "60cm x 60cm x 80cm",
    weight: 30,
    consumable: false,
    description: "Pequeño horno diseñado para fundir y moldear metales."
  },
  lupa_tornillo: {
    key: "lupa_tornillo",
    label: "Lupa y Tornillo de Banco",
    type: "bajo_calibre",
    cost: 600,
    dimensions: "20cm x 15cm x 10cm",
    weight: 2,
    consumable: false,
    description: "Herramientas para trabajos de precisión y detalle."
  },
  kit_pulido: {
    key: "kit_pulido",
    label: "Kit de Pulido",
    type: "kit",
    costPerGrade: 300,
    dimensions: "30cm x 20cm x 10cm",
    weight: 3,
    usesPerGrade: 10,
    consumable: true,
    description: "Conjunto con materiales y herramientas para dar brillo y acabado a las joyas."
  },
  joyeria_elemental: {
    key: "joyeria_elemental",
    label: "Joyería Elemental",
    type: "artefacto",
    cost: 24000,
    consumable: false,
    resonanciaElemental: true,
    effect: "Reduce el tiempo de fabricación de joyas a un tercio.",
    description: "Conjunto que incluye herramientas para corte y moldeado de gemas junto con una lente de aumento elemental."
  }
};

/**
 * Herramientas de Trampero
 */
export const TRAMPERO_TOOLS = {
  kit_trampas: {
    key: "kit_trampas",
    label: "Kit de Trampas",
    type: "kit",
    costPerGrade: 700,
    dimensions: "40cm x 30cm x 20cm",
    weight: 6,
    usesPerGrade: 10,
    consumable: true,
    description: "Incluye herramientas mecánicas, engranajes, resortes y mecanismos de disparo."
  },
  kit_placas: {
    key: "kit_placas",
    label: "Kit de Placas Base y Estructuras",
    type: "kit",
    costPerGrade: 400,
    dimensions: "50cm x 40cm x 30cm",
    weight: 10,
    usesPerGrade: 8,
    consumable: true,
    description: "Componentes para la base y estructura de las trampas."
  },
  kit_sensores: {
    key: "kit_sensores",
    label: "Kit de Sensores y Disparadores",
    type: "kit",
    costPerGrade: 600,
    dimensions: "30cm x 20cm x 10cm",
    weight: 4,
    usesPerGrade: 9,
    consumable: true,
    description: "Variedad de sensores y dispositivos de disparo."
  },
  kit_camuflaje: {
    key: "kit_camuflaje",
    label: "Kit Material de Camuflaje",
    type: "kit",
    costPerGrade: 200,
    dimensions: "40cm x 30cm x 20cm",
    weight: 5,
    usesPerGrade: 7,
    consumable: true,
    description: "Diversos materiales para ocultar las trampas."
  },
  trampas_elementales: {
    key: "trampas_elementales",
    label: "Trampas Elementales",
    type: "artefacto",
    cost: 48000,
    consumable: false,
    resonanciaElemental: true,
    effect: "Reduce el tiempo de fabricación de trampas a un tercio.",
    description: "Colección de herramientas para el diseño de trampas con componentes mecánicos, sensores y núcleos elementales."
  }
};

/**
 * Herramientas de Ingeniería
 */
export const INGENIERIA_TOOLS = {
  herramientas_mecanicas: {
    key: "herramientas_mecanicas",
    label: "Herramientas Mecánicas y Electrónicas",
    type: "gran_calibre",
    cost: 2000,
    dimensions: "60cm x 40cm x 30cm",
    weight: 12,
    consumable: false,
    description: "Incluyen llaves, destornilladores, alicates, cortadores de alambre, soldadores, multímetros y otros instrumentos."
  },
  equipamiento_microelectronica: {
    key: "equipamiento_microelectronica",
    label: "Equipamiento de Microelectrónica",
    type: "gran_calibre",
    cost: 1600,
    dimensions: "45cm x 30cm x 25cm",
    weight: 8,
    consumable: false,
    description: "Instrumentos especializados para construcción y reparación de dispositivos electrónicos y mecánicos."
  },
  herramientas_precision: {
    key: "herramientas_precision",
    label: "Herramientas de Precisión",
    type: "bajo_calibre",
    cost: 1200,
    dimensions: "40cm x 25cm x 20cm",
    weight: 5,
    consumable: true,
    description: "Incluye pinzas, limas, sierras, alicates y otros utensilios para trabajos de detalle."
  },
  ingenieria_elemental: {
    key: "ingenieria_elemental",
    label: "Ingeniería Elemental",
    type: "artefacto",
    cost: 110000,
    consumable: false,
    resonanciaElemental: true,
    effect: "Permite la creación y manipulación avanzada de artefactos y dispositivos utilizando energías elementales.",
    description: "Contiene herramientas refinadas y energizadas elementalmente con punta de adamantio e interfaces de manipulación elemental."
  }
};

/**
 * Otras Herramientas
 */
export const OTRAS_TOOLS = {
  herramientas_criptografia: {
    key: "herramientas_criptografia",
    label: "Herramientas de Criptografía",
    type: "bajo_calibre",
    cost: 600,
    dimensions: "30cm x 20cm x 15cm",
    weight: 3,
    consumable: false,
    description: "Contiene libros de códigos, tablas de cifrado, herramientas de escritura especializadas."
  },
  kit_herboristeria: {
    key: "kit_herboristeria",
    label: "Kit de Herboristería",
    type: "kit",
    costPerGrade: 300,
    dimensions: "35cm x 25cm x 20cm",
    weight: 4,
    usesPerGrade: 15,
    consumable: true,
    description: "Navajas de recolección, morteros y pilones, recipientes para almacenamiento de hierbas."
  },
  kit_talla: {
    key: "kit_talla",
    label: "Kit de Talla",
    type: "kit",
    costPerGrade: 200,
    dimensions: "30cm x 20cm x 15cm",
    weight: 3,
    usesPerGrade: 15,
    consumable: true,
    description: "Gubias, cuchillos de talla, lijas, herramientas de medición."
  },
  herramientas_tasador: {
    key: "herramientas_tasador",
    label: "Herramientas de Tasador",
    type: "bajo_calibre",
    cost: 900,
    dimensions: "40cm x 30cm x 20cm",
    weight: 5,
    consumable: false,
    description: "Lupa, balanza, equipo de prueba de materiales, catálogos de referencia."
  },
  kit_cartografia: {
    key: "kit_cartografia",
    label: "Kit de Cartografía",
    type: "kit",
    costPerGrade: 400,
    dimensions: "45cm x 35cm x 25cm",
    weight: 6,
    usesPerGrade: 10,
    consumable: true,
    description: "Compases, calipers, papel de calidad, tintas variadas, reglas, pluma estilográfica, lentes de aumento."
  },
  kit_reparacion: {
    key: "kit_reparacion",
    label: "Kit de Reparación",
    type: "kit",
    costPerGrade: 400,
    dimensions: "50cm x 40cm x 30cm",
    weight: 7,
    usesPerGrade: 8,
    consumable: true,
    description: "Martillos, alicates, limas, adhesivos, parches de cuero, agujas e hilo, aceite para armaduras y armas."
  },
  kit_artillero: {
    key: "kit_artillero",
    label: "Kit de Artillero",
    type: "kit",
    costPerGrade: 450,
    dimensions: "40cm x 30cm x 20cm",
    weight: 5,
    usesPerGrade: 12,
    consumable: true,
    description: "Herramientas para mantenimiento y reparación de proyectiles."
  },
  kit_extraccion: {
    key: "kit_extraccion",
    label: "Kit de Extracción",
    type: "kit",
    costPerGrade: 350,
    dimensions: "40cm x 30cm x 25cm",
    weight: 6,
    usesPerGrade: 10,
    consumable: true,
    description: "Jeringas, bisturíes, recipientes sellados y herramientas para extracción de materiales biológicos."
  },
  kit_mineria: {
    key: "kit_mineria",
    label: "Kit de Minería",
    type: "kit",
    costPerGrade: 350,
    dimensions: "60cm x 40cm x 30cm",
    weight: 10,
    usesPerGrade: 10,
    consumable: true,
    description: "Picos, martillos, cinceles, linternas resistentes, guantes reforzados y gafas protectoras."
  },
  kit_conservacion: {
    key: "kit_conservacion",
    label: "Kit de Conservación",
    type: "kit",
    costPerGrade: 500,
    dimensions: "50cm x 40cm x 35cm",
    weight: 8,
    usesPerGrade: 5,
    consumable: true,
    description: "Soluciones conservantes, recipientes herméticos y equipos de refrigeración portátiles."
  },
  kit_refinamiento_minerales: {
    key: "kit_refinamiento_minerales",
    label: "Kit de Refinamiento de Minerales",
    type: "kit",
    costPerGrade: 450,
    dimensions: "45cm x 35cm x 30cm",
    weight: 7,
    usesPerGrade: 8,
    consumable: true,
    description: "Crisoles, herramientas de fundición, moldes y equipos para probar pureza."
  },
  kit_refinamiento_fibras: {
    key: "kit_refinamiento_fibras",
    label: "Kit de Refinamiento de Fibras",
    type: "kit",
    costPerGrade: 400,
    dimensions: "45cm x 30cm x 25cm",
    weight: 6,
    usesPerGrade: 12,
    consumable: true,
    description: "Cardas, husos, telares portátiles y tintes naturales."
  },
  kit_medico: {
    key: "kit_medico",
    label: "Kit Médico",
    type: "kit",
    costPerGrade: 300,
    dimensions: "45cm x 30cm x 20cm",
    weight: 5,
    usesPerGrade: 15,
    consumable: true,
    description: "Vendajes, antisépticos, suturas, pinzas, tijeras, jeringas, antídotos básicos y compuestos estabilizadores."
  },
  kit_veneno: {
    key: "kit_veneno",
    label: "Kit de Veneno",
    type: "kit",
    costPerGrade: 350,
    dimensions: "35cm x 25cm x 20cm",
    weight: 4,
    usesPerGrade: 8,
    consumable: true,
    description: "Herramientas para medir, mezclar y aplicar venenos de forma segura."
  }
};

/**
 * Calcula el costo de un kit según su grado
 */
export function calculateKitCost(kitKey, grade = 1) {
  // Buscar en todas las categorías
  const allTools = {
    ...HERRERIA_TOOLS,
    ...SASTRERIA_TOOLS,
    ...ALQUIMIA_TOOLS,
    ...JOYERIA_TOOLS,
    ...TRAMPERO_TOOLS,
    ...INGENIERIA_TOOLS,
    ...OTRAS_TOOLS
  };

  const tool = allTools[kitKey];
  if (!tool || tool.type !== "kit") return 0;

  return tool.costPerGrade * grade;
}

/**
 * Calcula los usos de un kit según su grado
 */
export function calculateKitUses(kitKey, grade = 1) {
  const allTools = {
    ...HERRERIA_TOOLS,
    ...SASTRERIA_TOOLS,
    ...ALQUIMIA_TOOLS,
    ...JOYERIA_TOOLS,
    ...TRAMPERO_TOOLS,
    ...INGENIERIA_TOOLS,
    ...OTRAS_TOOLS
  };

  const tool = allTools[kitKey];
  if (!tool || tool.type !== "kit") return 0;

  return tool.usesPerGrade * grade;
}

/**
 * Obtiene información completa de una herramienta
 */
export function getToolInfo(toolKey, grade = 1) {
  const allTools = {
    ...HERRERIA_TOOLS,
    ...SASTRERIA_TOOLS,
    ...ALQUIMIA_TOOLS,
    ...JOYERIA_TOOLS,
    ...TRAMPERO_TOOLS,
    ...INGENIERIA_TOOLS,
    ...OTRAS_TOOLS
  };

  const tool = allTools[toolKey];
  if (!tool) return null;

  if (tool.type === "kit") {
    return {
      ...tool,
      grade,
      cost: calculateKitCost(toolKey, grade),
      uses: calculateKitUses(toolKey, grade)
    };
  }

  return tool;
}
