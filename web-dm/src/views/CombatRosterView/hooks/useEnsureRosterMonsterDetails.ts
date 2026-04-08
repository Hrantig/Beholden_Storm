import type { Combatant, INpc } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import type { Action } from "@/store/actions";

type Props = {
  combatants: Combatant[];
  inpcs: INpc[];
  monsterDetails: Record<string, MonsterDetail>;
  dispatch: (action: Action) => void;
};

// Stub — D&D monster detail fetching removed in Phase 2 cleanup.
// CombatRosterView is pending Phase 2/3 redesign for Stormlight.
export function useEnsureRosterMonsterDetails(_props: Props) {
  // no-op
}
