import * as React from "react";
import type { AttackOverride, Adversary, Combatant, Player } from "@/domain/types/domain";

type Role = "active" | "target";

type Args = {
  isNarrow: boolean;
  role: Role;
  combatant: Combatant | null;
  selectedMonster: Adversary | null;  // ← changed
  playersById: Record<string, Player>;
  roster: Combatant[];
  activeForCaster: Combatant | null;
  currentRound: number;
  updateCombatant: (id: string, patch: Record<string, unknown>) => void;
  onOpenOverrides: (combatantId: string | null) => void;
  onOpenConditions: (combatantId: string | null, role: Role, casterId: string | null) => void;
  casterIdForTarget?: string | null;
};

/**
 * Builds the ctx object consumed by CombatantDetailsPanel.
 * This is a pure memoized adapter to keep CombatView slim.
 */
export function useCombatantDetailsCtx(args: Args) {
  return React.useMemo(
    () => ({
      isNarrow: args.isNarrow,
      selectedMonster: args.selectedMonster,
      playerName:
        args.combatant?.baseType === "player"
          ? (args.playersById[args.combatant.baseId]?.playerName ?? null)
          : null,
      player:
        args.combatant?.baseType === "player" ? (args.playersById[args.combatant.baseId] ?? null) : null,

      roster: args.roster,
      activeForCaster: args.activeForCaster,
      currentRound: args.currentRound,
      showHpActions: false,

      onUpdate: (patch: Record<string, unknown>) => (args.combatant?.id ? args.updateCombatant(args.combatant.id, patch) : void 0),

      onOpenOverrides: () => args.onOpenOverrides(args.combatant?.id ?? null),
      onOpenConditions: () =>
        args.onOpenConditions(
          args.combatant?.id ?? null,
          args.role,
          args.role === "active" ? (args.combatant?.id ?? null) : (args.casterIdForTarget ?? null)
        )
    }),
    [
      args.isNarrow,
      args.selectedMonster,
      args.combatant?.baseType,
      args.combatant?.baseId,
      args.playersById,
      args.roster,
      args.activeForCaster,
      args.currentRound,
      args.combatant?.id,
      args.updateCombatant,
      args.onOpenOverrides,
      args.onOpenConditions,
      args.combatant?.attackOverrides,
      args.role,
      args.casterIdForTarget
    ]
  );
}
