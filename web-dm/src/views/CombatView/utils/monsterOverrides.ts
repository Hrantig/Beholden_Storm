import type { Adversary } from "@/domain/types/domain";
import type { Combatant } from "@/domain/types/domain";

export function applyMonsterAttackOverrides(
  adversary: Adversary | null,
  _combatant: Combatant | null
): Adversary | null {
  return adversary;
}
