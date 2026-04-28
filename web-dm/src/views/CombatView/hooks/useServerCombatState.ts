import * as React from "react";
import { api } from "@/services/api";
import { useWs } from "@/services/ws";
import type { CombatPhase } from "@/domain/types/domain";

type CombatState = { 
  round: number; 
  activeCombatantId: string | null;
  currentPhase: CombatPhase;
  declarationsLocked: boolean;
};

export function useServerCombatState(encounterId: string | undefined) {
  const [loaded, setLoaded] = React.useState(false);
  const [round, setRound] = React.useState(1);
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [started, setStarted] = React.useState(false);
  const [currentPhase, setCurrentPhase] = React.useState<CombatPhase>("fast-pc");
  const [declarationsLocked, setDeclarationsLocked] = React.useState(false);

  const refresh = React.useCallback(async () => {
    if (!encounterId) return;
    const s = await api<CombatState>(`/api/encounters/${encounterId}/combatState`);
    setRound(Number(s.round ?? 1) || 1);
    setActiveId(s.activeCombatantId ?? null);
    setStarted(Boolean(s.activeCombatantId) || Number(s.round ?? 1) > 1);
    setCurrentPhase(s.currentPhase ?? "fast-pc");
    setDeclarationsLocked(Boolean(s.declarationsLocked));
    setLoaded(true);
  }, [encounterId]);

  React.useEffect(() => {
    refresh();
  }, [refresh]);

  useWs((msg) => {
    if (msg.type !== "encounter:combatStateChanged") return;
    const p = msg.payload;
    if (!p || typeof p !== "object") return;
    const encId = (p as { encounterId?: unknown }).encounterId;
    if (typeof encId === "string" && encId === encounterId) refresh();
  });

  const persist = React.useCallback(
    async (next: { 
      round: number; 
      activeId: string | null;
      currentPhase?: CombatPhase;
      declarationsLocked?: boolean;
    }) => {
      if (!encounterId) return;
      await api(`/api/encounters/${encounterId}/combatState`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ 
          round: next.round, 
          activeCombatantId: next.activeId,
          currentPhase: next.currentPhase,
          declarationsLocked: next.declarationsLocked,
        })
      });
      setRound(next.round);
      setActiveId(next.activeId);
      setStarted(Boolean(next.activeId) || next.round > 1);
      if (next.currentPhase !== undefined) setCurrentPhase(next.currentPhase);
      if (next.declarationsLocked !== undefined) setDeclarationsLocked(next.declarationsLocked);
    },
    [encounterId]
  );

  // Advance to next phase — server handles round increment and lock logic
  const advancePhase = React.useCallback(async () => {
    if (!encounterId) return;
    const PHASE_ORDER: CombatPhase[] = ["fast-pc", "fast-npc", "slow-pc", "slow-npc"];
    const currentIdx = PHASE_ORDER.indexOf(currentPhase);
    const nextPhase = PHASE_ORDER[(currentIdx + 1) % PHASE_ORDER.length];
    // Declarations lock after fast-pc ends and unlock when a new round begins.
    const nextLocked = nextPhase !== "fast-pc";
    try {
      await persist({
        round,
        activeId,
        currentPhase: nextPhase,
        declarationsLocked: nextLocked,
      });
    } catch (err) {
      console.error("[advancePhase] failed to persist phase transition:", err);
    }
  }, [encounterId, currentPhase, round, activeId, persist]);

  return {
    loaded,
    round,
    setRound,
    activeId,
    setActiveId,
    started,
    refresh,
    persist,
    currentPhase,
    declarationsLocked,
    advancePhase,
  };
}