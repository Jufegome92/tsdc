// Categorías: physical | mental | social | arts | knowledge
export const BACKGROUND_STARTING = {
  martialArtist: { physical: 2, mental: 1, any: 0 },
  artisan:       { arts: 2, social: 0, knowledge: 1, any: 0 }, // "1 saber/social": lo resolvemos como knowledge por defecto; ajusta si prefieres “o”.
  wanderer:      { mental: 2, physical: 1, any: 0 },
  noble:         { social: 1, any: 2 }, // 2 de cualquier otro
};

export const ALWAYS_START = {
  skills: ["vigor"], // todos empiezan con vigor nivel 1
};
