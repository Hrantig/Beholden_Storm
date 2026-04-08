import type { Combatant, INpc, Player } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

type Props = {
  combatants: Combatant[];
  inpcs: INpc[];
  monsterDetails: Record<string, MonsterDetail>;
  players: Player[];
};

// Stub — D&D XP/CR/DPR calculations removed in Phase 2 cleanup.
// CombatRosterView is pending Phase 2/3 redesign for Stormlight.
export function useRosterMetrics(_props: Props) {
  return { xpByCombatantId: {} as Record<string, number>, totalXp: 0, difficulty: null };
}
