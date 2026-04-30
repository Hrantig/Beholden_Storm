import { Combatant, Player } from "@/domain/types/domain";
import {
  parseHP,
} from "@/views/CombatView/utils/combatantParsing";

// LEGACY — not currently imported. Retained as a reference; remove or replace during Phase 3.
export function useCombatantDerived(combatant: Combatant, _player?: Player | null) {
  const overrides = combatant.overrides ?? null;
  const tempHp = Math.max(0, Number(overrides?.tempHp ?? 0) || 0);

  function normalizeHpMaxBonus(v: unknown): number | null {
    if (v == null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  const hpParsed = parseHP(combatant.hpCurrent, combatant.hpMax);
  const hpCur = hpParsed.current;
  const hpMaxBase = hpParsed.max;
  const hpMod = normalizeHpMaxBonus(overrides?.hpMaxBonus) ?? 0;
  const hpMax = hpMaxBase != null ? Math.max(1, hpMaxBase + hpMod) : null;

  return {
    vitals: {
      hpCurrent: hpCur,
      hpMax: hpMax != null ? Number(hpMax) : null,
      hpDetails: hpParsed.details,
      tempHp,
    },
    spells: [],
    traits: [],
  };
}
