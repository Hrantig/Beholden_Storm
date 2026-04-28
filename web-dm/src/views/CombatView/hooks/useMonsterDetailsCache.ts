import * as React from "react";
import { api } from "@/services/api";
import { useStore } from "@/store";
import type { Adversary, Combatant, INpc } from "@/domain/types/domain";

// Cache shape — keyed by adversary/compendium id
type AdversaryCache = Record<string, Adversary>;

export function useMonsterDetailsCache(
  combatants: Combatant[],
  active: Combatant | null,
  target: Combatant | null,
  inpcsById?: Record<string, INpc | undefined>
) {
  const { state, dispatch } = useStore();

  // Use existing monsterDetails store slot but typed as AdversaryCache
  const adversaryCache = state.monsterDetails as unknown as AdversaryCache;

  const setMonsterCache = React.useCallback(
    (next: AdversaryCache) => {
      dispatch({ type: "mergeMonsterDetails", patch: next as any });
    },
    [dispatch]
  );

  const resolveAdversaryId = React.useCallback(
    (c: Combatant | null): string | null => {
      if (!c) return null;
      if (c.baseType === "monster" && typeof c.baseId === "string") return c.baseId;
      if (c.baseType === "inpc") {
        const mid = inpcsById?.[String(c.baseId)]?.monsterId;
        return typeof mid === "string" && mid.trim() ? mid : null;
      }
      return null;
    },
    [inpcsById]
  );

  const activeAdversaryId = resolveAdversaryId(active);
  const targetAdversaryId = resolveAdversaryId(target);

  const activeMonster = activeAdversaryId ? adversaryCache[activeAdversaryId] ?? null : null;
  const targetMonster = targetAdversaryId ? adversaryCache[targetAdversaryId] ?? null : null;

  // Kept for backward compat — CR doesn't exist in Stormlight but slot is used elsewhere
  const monsterCrById = React.useMemo(() => {
    const m: Record<string, number | null | undefined> = {};
    for (const id of Object.keys(adversaryCache)) m[id] = null;
    return m;
  }, [adversaryCache]);

  const ensureAdversary = React.useCallback(
    async (baseId: string) => {
      if (!baseId || adversaryCache[baseId]) return;
      try {
        const d = await api<Adversary>(`/api/compendium/adversaries/${baseId}`);
        dispatch({ type: "mergeMonsterDetails", patch: { [baseId]: d as any } });
      } catch {
        // ignore — panel will show without compendium data
      }
    },
    [adversaryCache, dispatch]
  );

  // Ensure active combatant's adversary data
  React.useEffect(() => {
    const aid = resolveAdversaryId(active);
    if (aid) void ensureAdversary(aid);
  }, [active?.id, active?.baseType, active?.baseId, ensureAdversary, resolveAdversaryId]);

  // Ensure target combatant's adversary data
  React.useEffect(() => {
    const aid = resolveAdversaryId(target);
    if (aid) void ensureAdversary(aid);
  }, [target?.id, target?.baseType, target?.baseId, ensureAdversary, resolveAdversaryId]);

  // Preload all roster adversaries in parallel
  React.useEffect(() => {
    let alive = true;

    const missing = Array.from(
      new Set(
        combatants
          .map((c) => resolveAdversaryId(c))
          .filter((id): id is string => typeof id === "string" && Boolean(id))
      )
    ).filter((id) => !adversaryCache[id]);

    if (!missing.length) return;

    Promise.allSettled(
      missing.map((id) =>
        api<Adversary>(`/api/compendium/adversaries/${id}`).then((d) => ({ id, d }))
      )
    ).then((results) => {
      if (!alive) return;
      const patch: Record<string, any> = {};
      for (const r of results) {
        if (r.status === "fulfilled") patch[r.value.id] = r.value.d;
      }
      if (Object.keys(patch).length) {
        dispatch({ type: "mergeMonsterDetails", patch });
      }
    });

    return () => { alive = false; };
  }, [combatants, adversaryCache, dispatch, resolveAdversaryId]);

  return {
    monsterCache: adversaryCache,
    setMonsterCache,
    monsterCrById,
    activeMonster,
    targetMonster,
    activeMonsterKey: activeAdversaryId,
    targetMonsterKey: targetAdversaryId,
  };
}