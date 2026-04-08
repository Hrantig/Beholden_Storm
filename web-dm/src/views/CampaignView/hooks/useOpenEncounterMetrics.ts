import * as React from "react";
import type { Action } from "@/store/actions";
import type { Player, INpc } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";

type EncounterLike = { id: string; name: string; status: string };

// Stub — D&D XP/difficulty calculations removed in Phase 2 cleanup.
// Returns encounters with their existing status unchanged.
export function useOpenEncounterMetrics(args: {
  encounters: EncounterLike[];
  players: Player[];
  inpcs: INpc[];
  monsterDetails: Record<string, MonsterDetail>;
  dispatch: (action: Action) => void;
}) {
  const encountersForPanel = React.useMemo(
    () => (args.encounters ?? []).map((e) => ({ id: e.id, name: e.name, status: e.status })),
    [args.encounters]
  );
  return { encountersForPanel };
}
