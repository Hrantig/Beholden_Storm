import type { Combatant } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

import { useCombatHpActions } from "@/views/CombatView/hooks/actions/useCombatHpActions";
import { useCombatantPatchActions } from "@/views/CombatView/hooks/actions/useCombatantPatchActions";
import { useCombatFightActions } from "@/views/CombatView/hooks/actions/useCombatFightActions";
import { useCombatDrawerActions } from "@/views/CombatView/hooks/actions/useCombatDrawerActions";
import type { StoreDispatch } from "@/views/CombatView/hooks/actions/types";

type Args = {
  campaignId?: string;
  encounterId: string | undefined;
  round: number;
  orderedCombatants: Combatant[];
  setActiveId: (id: string | null) => void;
  setTargetId: (id: string | null) => void;
  setRound: (n: number | ((prev: number) => number)) => void;
  persistCombatState: (next: { round: number; activeId: string | null }) => Promise<void>;
  delta: string;
  setDelta: (v: string) => void;
  target: Combatant | null;
  refresh: () => Promise<void>;
  dispatch: StoreDispatch;
  onInjuryTriggered?: (combatantId: string) => void;
};

// Convenience aggregator for combat actions.
// NOTE: This is intentionally kept as a thin wrapper over smaller hooks.
export function useCombatActions({
  campaignId,
  encounterId,
  round,
  orderedCombatants,
  setActiveId,
  setTargetId,
  setRound,
  persistCombatState,
  delta,
  setDelta,
  target,
  refresh,
  dispatch,
  onInjuryTriggered,
}: Args) {
  const { applyHpDelta } = useCombatHpActions({ encounterId, delta, setDelta, target, refresh, onInjuryTriggered });
  const { updateCombatant } = useCombatantPatchActions({ encounterId, refresh });
  const { resetFight, endCombat } = useCombatFightActions({
    campaignId,
    encounterId,
    orderedCombatants,
    refresh,
    setRound,
    setActiveId,
    setTargetId,
    persistCombatState,
  });
  const { onOpenOverrides, onOpenConditions } = useCombatDrawerActions({ encounterId, round, dispatch });

  return {
    applyHpDelta,
    updateCombatant,
    resetFight,
    endCombat,
    onOpenOverrides,
    onOpenConditions,
  };
}
