// modules/documents/actor.js
import { computeDerived, normalizeAttributes } from "../features/attribute/index.js";

export class TSDCActor extends Actor {
  prepareBaseData() {
    super.prepareBaseData();
    // Asegura estructura mínima
    const sys = this.system ?? {};
    sys.attributes ??= {};
    sys.derived ??= {};
    this.system = sys;
  }

  prepareDerivedData() {
    super.prepareDerivedData();
    const attrs = normalizeAttributes(this.system.attributes || {});
    const derived = computeDerived(attrs);
    this.system.derived = { ...this.system.derived, ...derived };
  }
}
