import * as React from "react";
import type { Combatant } from "@/domain/types/domain";
import { allHaveInitiative } from "@/views/CombatView/engine/CombatEngine";
import { useRosterMaps } from "@/views/CombatView/hooks/useRosterMaps";
import type { State } from "@/store/state";

export type PhaseGroups = {
  fastPcs: Combatant[];
  fastNpcs: Combatant[];
  slowPcs: Combatant[];
  slowNpcs: Combatant[];
};

type Args = {
  encounterId: string | undefined;
  state: State;
  targetId: string | null;
};

function isUnconscious(c: Combatant): boolean {
  return c.conditions?.some((cond) => cond.key === "unconscious") ?? false;
}

function buildPhaseGroups(combatants: Combatant[]): PhaseGroups {
  const fastPcs: Combatant[] = [];
  const fastNpcs: Combatant[] = [];
  const slowPcs: Combatant[] = [];
  const slowNpcs: Combatant[] = [];

  for (const c of combatants) {
    if (c.baseType === "player") {
      // Unconscious PCs are always slow.
      if (isUnconscious(c) || c.phase !== "fast") {
        slowPcs.push(c);
      } else {
        fastPcs.push(c);
      }
    } else {
      // monster / inpc
      if (isUnconscious(c)) {
        // Unconscious NPCs always in slow group only.
        slowNpcs.push(c);
      } else if (c.dualPhase) {
        // Dual-phase adversaries appear in both NPC phases.
        fastNpcs.push(c);
        slowNpcs.push(c);
      } else if (c.phase === "fast") {
        fastNpcs.push(c);
      } else {
        slowNpcs.push(c);
      }
    }
  }

  return { fastPcs, fastNpcs, slowPcs, slowNpcs };
}

export function useCombatViewModel({ encounterId, state, targetId }: Args) {
  const encounter = React.useMemo(() => {
    if (!encounterId) return null;
    return state.encounters.find((e) => e.id === encounterId) ?? null;
  }, [encounterId, state.encounters]);

  // Store is the single source of truth.
  const combatants = React.useMemo(() => state.combatants, [state.combatants]);

  // orderedCombatants kept as alias for backward compat during transition.
  // Remove once CombatView.tsx no longer references it.
  const orderedCombatants = combatants;

  const canNavigate = React.useMemo(() => allHaveInitiative(combatants), [combatants]);

  const phaseGroups = React.useMemo(() => buildPhaseGroups(combatants), [combatants]);

  const target = React.useMemo(
    () => combatants.find((c) => c.id === targetId) ?? null,
    [combatants, targetId]
  );

  const { playersById, inpcsById } = useRosterMaps(state.players, state.inpcs);

  return {
    encounter,
    combatants,
    orderedCombatants,
    canNavigate,
    phaseGroups,
    target,
    playersById,
    inpcsById,
  };
}
