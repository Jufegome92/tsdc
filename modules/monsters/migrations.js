//modules/monsters/migrations.js 
 
export function migrateBlueprintIfNeeded(bp) {
  let v = bp.version ?? 1;
  if (v < 2) {
    // ejemplo: renombrar "boots" -> "patas" en anatomy
    if (bp.anatomy?.boots && !bp.anatomy.patas) {
      bp.anatomy.patas = bp.anatomy.boots; delete bp.anatomy.boots;
    }
    v = 2;
  }
  return { ...bp, version: v };
}
