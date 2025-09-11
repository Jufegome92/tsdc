// Categorías: physical | mental | social | arts | knowledge
export const BACKGROUND_STARTING = {
  martial:  { physical: 2, mental: 1 },
  artisan:  { arts: 2, knowledge: 1 },      // si prefieres “saber o social”, manéjalo como flex en BACKGROUNDS
  wanderer: { mental: 2, physical: 1 },
  warden:   { knowledge: 2, social: 1 },
  noble:    { social: 1, any: 2 },
};

export const ALWAYS_START = {
  skills: ["vigor"], // todos empiezan con vigor nivel 1 (ya lo estás usando)
};