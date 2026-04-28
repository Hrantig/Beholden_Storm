import * as React from "react";
import { api } from "@/services/api";

export function usePhaseDeclarations(encounterId: string | undefined, refresh: () => Promise<void>) {
  const togglePhase = React.useCallback(
    async (combatantId: string, newPhase: "fast" | "slow") => {
      if (!encounterId) return;
      await api(`/api/encounters/${encounterId}/combatants/${combatantId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phase: newPhase }),
      });
      await refresh();
    },
    [encounterId, refresh]
  );

  return { togglePhase };
}
