// modules/helpers/handlebars-helpers.js
// Handlebars helpers personalizados para TSDC

export function registerHandlebarsHelpers() {

  /**
   * Compara dos valores para igualdad
   */
  Handlebars.registerHelper('eq', function(a, b) {
    return a === b;
  });

  /**
   * Compara si a es mayor que b
   */
  Handlebars.registerHelper('gt', function(a, b) {
    return a > b;
  });

  /**
   * Compara si a es menor que b
   */
  Handlebars.registerHelper('lt', function(a, b) {
    return a < b;
  });

  /**
   * Compara si a es mayor o igual que b
   */
  Handlebars.registerHelper('gte', function(a, b) {
    return a >= b;
  });

  /**
   * Compara si a es menor o igual que b
   */
  Handlebars.registerHelper('lte', function(a, b) {
    return a <= b;
  });

  /**
   * Operaciones matemáticas
   */
  Handlebars.registerHelper('math', function(lvalue, operator, rvalue, options) {
    lvalue = parseFloat(lvalue);
    rvalue = parseFloat(rvalue);

    const result = {
      "+": lvalue + rvalue,
      "-": lvalue - rvalue,
      "*": lvalue * rvalue,
      "/": lvalue / rvalue,
      "%": lvalue % rvalue
    }[operator];

    // Si se especifica "round" en las opciones, redondear
    if (options && options.hash && options.hash.round !== undefined) {
      const decimals = parseInt(options.hash.round);
      return result.toFixed(decimals);
    }

    return result;
  });

  /**
   * Formatea una fecha
   */
  Handlebars.registerHelper('formatDate', function(date) {
    if (!date) return '-';

    const d = new Date(date);
    const now = new Date();
    const diff = now - d;

    // Si es menos de 1 día
    if (diff < 86400000) {
      const hours = Math.floor(diff / 3600000);
      if (hours < 1) {
        const minutes = Math.floor(diff / 60000);
        return `Hace ${minutes} minuto${minutes !== 1 ? 's' : ''}`;
      }
      return `Hace ${hours} hora${hours !== 1 ? 's' : ''}`;
    }

    // Si es menos de 7 días
    if (diff < 604800000) {
      const days = Math.floor(diff / 86400000);
      return `Hace ${days} día${days !== 1 ? 's' : ''}`;
    }

    // Formato completo
    return d.toLocaleDateString('es-ES', {
      year: 'numeric',
      month: 'short',
      day: 'numeric'
    });
  });

  /**
   * Concatena strings
   */
  Handlebars.registerHelper('concat', function(...args) {
    args.pop(); // Remove options object
    return args.join('');
  });

  /**
   * Condicional AND
   */
  Handlebars.registerHelper('and', function() {
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.every(Boolean);
  });

  /**
   * Condicional OR
   */
  Handlebars.registerHelper('or', function() {
    const args = Array.prototype.slice.call(arguments, 0, -1);
    return args.some(Boolean);
  });

  /**
   * NOT lógico
   */
  Handlebars.registerHelper('not', function(value) {
    return !value;
  });

  /**
   * Multiplica un valor por un factor
   */
  Handlebars.registerHelper('multiply', function(a, b) {
    return a * b;
  });

  /**
   * Divide un valor
   */
  Handlebars.registerHelper('divide', function(a, b) {
    return a / b;
  });

  /**
   * Uppercase
   */
  Handlebars.registerHelper('uppercase', function(str) {
    if (str == null) return '';
    return String(str).toUpperCase();
  });

  /**
   * Lowercase
   */
  Handlebars.registerHelper('lowercase', function(str) {
    if (str == null) return '';
    return String(str).toLowerCase();
  });

  /**
   * Capitaliza primera letra
   */
  Handlebars.registerHelper('capitalize', function(str) {
    if (str == null) return '';
    const txt = String(str);
    if (!txt.length) return '';
    return txt.charAt(0).toUpperCase() + txt.slice(1);
  });

  /**
   * Trunca texto
   */
  Handlebars.registerHelper('truncate', function(str, length) {
    if (str == null) return '';
    const txt = String(str);
    if (txt.length <= length) return txt;
    return txt.substring(0, length) + '...';
  });

  /**
   * Convierte número a porcentaje
   */
  Handlebars.registerHelper('percent', function(value, total) {
    if (!total || total === 0) return '0%';
    return Math.round((value / total) * 100) + '%';
  });

  /**
   * Formatea número con separadores de miles
   */
  Handlebars.registerHelper('numberFormat', function(number) {
    if (typeof number !== 'number') return number;
    return number.toLocaleString('es-ES');
  });

  /**
   * Obtiene un elemento de un array por índice
   */
  Handlebars.registerHelper('getArrayItem', function(array, index) {
    return array[index];
  });

  /**
   * Devuelve la longitud de un array
   */
  Handlebars.registerHelper('length', function(array) {
    return Array.isArray(array) ? array.length : 0;
  });

  /**
   * Verifica si un array contiene un elemento
   */
  Handlebars.registerHelper('includes', function(array, item) {
    return Array.isArray(array) && array.includes(item);
  });

  /**
   * JSON stringify para debugging
   */
  Handlebars.registerHelper('json', function(context) {
    return JSON.stringify(context, null, 2);
  });

  /**
   * Log para debugging
   */
  Handlebars.registerHelper('log', function(context) {
    console.log(context);
    return '';
  });

  /**
   * Times - itera N veces
   */
  Handlebars.registerHelper('times', function(n, block) {
    let accum = '';
    for (let i = 0; i < n; ++i) {
      accum += block.fn(i);
    }
    return accum;
  });

  /**
   * Formatea Shekels
   */
  Handlebars.registerHelper('shekels', function(amount) {
    return `${amount.toLocaleString('es-ES')} Sh`;
  });

  /**
   * Icono según tipo de material
   */
  Handlebars.registerHelper('materialIcon', function(type) {
    const icons = {
      minerales: '🪨',
      plantas: '🌿',
      partes: '🦴',
      fibras: '🧵',
      reagentes: '⚗️',
      metal: '⚙️',
      madera: '🪵',
      piedra: '🗿'
    };
    return icons[type] || '📦';
  });

  /**
   * Icono según arte
   */
  Handlebars.registerHelper('artIcon', function(art) {
    const icons = {
      herreria: '🔨',
      sastreria: '✂️',
      alquimia: '⚗️',
      joyeria: '💎',
      trampero: '🪤',
      ingenieria: '⚙️'
    };
    return icons[art] || '🛠️';
  });

  /**
   * Color según rareza
   */
  Handlebars.registerHelper('rarityColor', function(rarity) {
    const colors = {
      comun: '#4a5568',
      raro: '#4299e1',
      excepcional: '#9f7aea'
    };
    return colors[rarity] || '#4a5568';
  });

  /**
   * Traduce dificultad
   */
  Handlebars.registerHelper('translateDifficulty', function(difficulty) {
    const translations = {
      fundamentos: 'Fundamentos',
      desafiante: 'Desafiante',
      riguroso: 'Riguroso',
      exigente: 'Exigente',
      extremo: 'Extremo'
    };
    return translations[difficulty] || difficulty;
  });

  /**
   * Traduce accesibilidad
   */
  Handlebars.registerHelper('translateAccessibility', function(accessibility) {
    const translations = {
      general: 'General (Alta)',
      limitado: 'Limitado (Media)',
      singular: 'Singular (Baja)'
    };
    return translations[accessibility] || accessibility;
  });

  /**
   * Default value - devuelve el valor por defecto si el primero es falsy
   */
  Handlebars.registerHelper('default', function(value, defaultValue) {
    return value || defaultValue;
  });

  /**
   * Obtiene items del bag por tipo (para inventory.bag)
   */
  Handlebars.registerHelper('getBagItemsByType', function(actor, type) {
    if (!actor?.system?.inventory?.bag) return [];
    return actor.system.inventory.bag.filter(item => item.type === type);
  });

  /**
   * Obtiene Item documents por tipo (para actor.items)
   */
  Handlebars.registerHelper('getItemsByType', function(actor, type) {
    if (!actor?.items) return [];
    return actor.items.filter(item => item.type === type);
  });

  console.log("TSDC | Handlebars helpers registered");
}
