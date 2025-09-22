// modules/monsters/schema.js
export function validateBlueprint(bp) {
  const required = ["key","label","level","attributes","progression","anatomy"];
  for (const k of required) {
    if (bp[k] == null) throw new Error(`Blueprint inválido: falta "${k}" (${bp?.key||"sin-key"})`);
  }
  return true;
}
