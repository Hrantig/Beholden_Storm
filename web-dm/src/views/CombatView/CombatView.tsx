import * as React from "react";
import { useParams } from "react-router-dom";
import { useStore } from "@/store";
import type { Combatant } from "@/domain/types/domain";
import type { State } from "@/store/state";
import { api } from "@/services/api";

import { CombatantHeader } from "@/views/CombatView/components/CombatantHeader";
import { CombatDeltaControls } from "@/views/CombatView/components/CombatDeltaControls";
import { HudFighterCard } from "@/views/CombatView/components/HudFighterCard";
import { CombatantTypeIcon } from "@/views/CombatView/components/CombatantTypeIcon";
import { PhaseOrderPanel } from "@/views/CombatView/panels/PhaseOrderPanel";
import { CombatantDetailsPanel } from "@/views/CombatView/panels/CombatantDetailsPanel/CombatantDetailsPanel";
import { InjuryDialog } from "@/views/CombatView/components/InjuryDialog";

import { useIsNarrow } from "@/views/CombatView/hooks/useIsNarrow";
import { useServerCombatState } from "@/views/CombatView/hooks/useServerCombatState";
import { useMonsterDetailsCache } from "@/views/CombatView/hooks/useMonsterDetailsCache";
import { useCombatActions } from "@/views/CombatView/hooks/useCombatActions";
import { useCombatantDetailsCtx } from "@/views/CombatView/hooks/useCombatantDetailsCtx";
import { useEncounterCombatants } from "@/views/CombatView/hooks/useEncounterCombatants";
import { useCombatViewModel } from "@/views/CombatView/hooks/useCombatViewModel";
import { useBulkDamageMode } from "@/views/CombatView/hooks/useBulkDamageMode";
import { usePhaseDeclarations } from "@/views/CombatView/hooks/usePhaseDeclarations";



export function CombatView() {
  const { campaignId, encounterId } = useParams();
  const { state, dispatch } = useStore();

  const openAdventureNotes = React.useCallback(() => {
    dispatch({ type: "openDrawer", drawer: { type: "adventureNotes" } });
  }, [dispatch]);

  const [targetId, setTargetId] = React.useState<string | null>(null);

  const { encounter, combatants, phaseGroups, canNavigate, target, playersById, inpcsById } = useCombatViewModel({
    encounterId,
    state: state as State,
    targetId,
  });

  const { refresh } = useEncounterCombatants(encounterId, dispatch);

  const {
    loaded,
    round,
    setRound,
    activeId,
    setActiveId,
    started,
    persist: persistCombatState,
    currentPhase,
    declarationsLocked,
    advancePhase,
  } = useServerCombatState(encounterId);

  // Clicking a combatant row spotlights it as active and sets it as the damage target.
  const handleSelectTarget = React.useCallback(
    (id: string) => {
      setActiveId(id);
      setTargetId(id);
    },
    [setActiveId]
  );

  const [delta, setDelta] = React.useState<string>("");
  const isNarrow = useIsNarrow();
  const [injuryDialogOpen, setInjuryDialogOpen] = React.useState(false);

  const handleInjuryTriggered = React.useCallback(
    (combatantId: string) => {
      setTargetId(combatantId);
      setInjuryDialogOpen(true);
    },
    []
  );

  const {
    bulkMode,
    bulkSelectedIds,
    toggleBulkMode: handleToggleBulkMode,
    toggleBulkSelect: handleToggleBulkSelect,
    applyBulkDamage,
  } = useBulkDamageMode({ encounterId, delta, setDelta, orderedCombatants: combatants, refresh });

  // Keep target valid when combatants change.
  React.useEffect(() => {
    setTargetId((prev) => {
      if (prev && combatants.some((c) => c.id === prev)) return prev;
      return combatants[0]?.id ?? null;
    });
  }, [combatants]);


  const { monsterCrById, activeMonster, targetMonster } = useMonsterDetailsCache(
    combatants,
    (combatants.find((c) => c.id === activeId) as Combatant | null) ?? null,
    (target as Combatant | null) ?? null,
    inpcsById
  );

  const {
    applyHpDelta,
    updateCombatant,
    resetFight,
    endCombat,
    onOpenOverrides,
    onOpenConditions,
  } = useCombatActions({
    campaignId,
    encounterId,
    round,
    orderedCombatants: combatants,
    setActiveId,
    setTargetId,
    setRound,
    persistCombatState,
    delta,
    setDelta,
    target: (target as Combatant | null) ?? null,
    refresh,
    dispatch,
    onInjuryTriggered: handleInjuryTriggered,
  });

  const handleToggleReaction = React.useCallback(
    (id: string) => {
      const c = combatants.find((x) => x.id === id);
      if (!c) return;
      void updateCombatant(id, { usedReaction: !c.usedReaction });
    },
    [combatants, updateCombatant]
  );

  const updateResource = React.useCallback(
    async (combatantId: string, patch: { focusCurrent?: number; investitureCurrent?: number }) => {
      const c = combatants.find(x => x.id === combatantId);
      if (!c) return;
      
      if (c.baseType === "player") {
        // Update the player record directly
        await api(`/api/players/${c.baseId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patch),
        });
        await refresh();
      } else {
        // Update the combatant instance
        await updateCombatant(combatantId, patch);
      }
    },
    [combatants, updateCombatant, refresh]
  );

  const handleApplyInjuryCondition = React.useCallback(
    (conditionKey: string, detail?: string) => {
      if (!target?.id) return;
      const existing = target.conditions ?? [];
      const newCondition = { key: conditionKey, ...(detail ? { detail } : {}) };
      void updateCombatant(target.id, { conditions: [...existing, newCondition] });
      setInjuryDialogOpen(false);
    },
    [target, updateCombatant]
  );

  const handleIncrementInjuryCount = React.useCallback(async () => {
    if (!target || target.baseType !== "player") return;
    const player = playersById[target.baseId];
    if (!player) return;
    await api(`/api/players/${target.baseId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ injuryCount: (player.injuryCount ?? 0) + 1 }),
    });
    await refresh();
  }, [target, playersById, refresh]);

  // Reset reaction for the incoming active combatant each time it changes.
  const prevActiveIdRef = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!activeId || activeId === prevActiveIdRef.current) return;
    prevActiveIdRef.current = activeId;
    void updateCombatant(activeId, { usedReaction: false });
  }, [activeId, updateCombatant]);

  const renderCombatantIcon = React.useCallback(
    (c: Combatant | null) => <CombatantTypeIcon combatant={c ?? undefined} />,
    []
  );

  const onOpenConditionsFromDelta = React.useCallback(() => {
    if (!activeId || !target?.id) return;
    const role = target.id === activeId ? "active" : "target";
    onOpenConditions(target.id, role, activeId);
  }, [activeId, target?.id, onOpenConditions]);

  const activeCombatant = combatants.find((c) => c.id === activeId) ?? null;

  const activeCtx = useCombatantDetailsCtx({
    isNarrow,
    role: "active",
    combatant: activeCombatant,
    selectedMonster: (activeMonster ?? null) as any,
    playersById,
    roster: combatants,
    activeForCaster: activeCombatant,
    currentRound: round,
    updateCombatant,
    onOpenOverrides,
    onOpenConditions,
  });

  const targetCtx = useCombatantDetailsCtx({
    isNarrow,
    role: "target",
    combatant: (target as Combatant | null) ?? null,
    selectedMonster: (activeMonster ?? null) as any,
    playersById,
    roster: combatants,
    activeForCaster: activeCombatant,
    currentRound: round,
    updateCombatant,
    onOpenOverrides,
    onOpenConditions,
    casterIdForTarget: activeId ?? null,
  });

  const { togglePhase } = usePhaseDeclarations(encounterId, refresh);

  // Suppress unused-variable warnings for values kept for future use.
  void loaded;
  void started;
  void canNavigate;
  void monsterCrById;
  void targetMonster;

  return (
    <div style={{ padding: "var(--space-page)" }}>
      <CombatantHeader
        backTo={campaignId && encounterId ? `/campaign/${campaignId}/roster/${encounterId}` : (campaignId ? `/campaign/${campaignId}` : "/")}
        backTitle="Back to Roster"
        title={encounter?.name ?? "Combat"}
        onResetFight={resetFight}
        onOpenAdventureNotes={openAdventureNotes}
        onEndCombat={endCombat}
      />

      <div
        style={{
          marginTop: 14,
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "minmax(0, 6fr) minmax(0, 5fr) minmax(0, 6fr)",
          gap: 14,
          alignItems: "start",
        }}
      >
        {!isNarrow ? (
          <div
            style={{
              gridColumn: "1 / -1",
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr) auto minmax(0, 1fr)",
              gap: 18,
              alignItems: "center",
            }}
          >
            <HudFighterCard
              combatant={activeCombatant}
              role="active"
              playersById={playersById}
              renderCombatantIcon={renderCombatantIcon}
              activeId={activeId ?? null}
              targetId={target?.id ?? null}
              onOpenConditions={onOpenConditions}
              onUpdateCombatant={updateCombatant}
              onUpdateResource={updateResource}
              currentPhase={currentPhase}
              adversary={activeCombatant?.baseType === "monster" ? (activeMonster ?? null) : null}
            />

            <div> 
              <CombatDeltaControls
              value={delta}
              targetId={target?.id ?? null}
              disabled={bulkMode ? bulkSelectedIds.size === 0 : false}
              onChange={setDelta}
              onApplyDamage={bulkMode ? applyBulkDamage : () => applyHpDelta("damage")}
              onApplyHeal={() => applyHpDelta("heal")}
              onOpenConditions={onOpenConditionsFromDelta}
              bulkMode={bulkMode}
              bulkCount={bulkSelectedIds.size}
              onToggleBulkMode={handleToggleBulkMode}
            />
            </div>

            <HudFighterCard
              combatant={target}
              role="target"
              playersById={playersById}
              renderCombatantIcon={renderCombatantIcon}
              activeId={activeId ?? null}
              targetId={target?.id ?? null}
              onOpenConditions={onOpenConditions}
              onUpdateResource={updateResource}
              onOpenInjury={() => setInjuryDialogOpen(true)}
              currentPhase={currentPhase}
            />
          </div>
        ) : null}

        <div>
          <CombatantDetailsPanel roleTitle="Active" role="active" combatant={activeCombatant} ctx={activeCtx} />
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          {isNarrow ? (
            <CombatDeltaControls
            value={delta}
            targetId={target?.id ?? null}
            disabled={bulkMode ? bulkSelectedIds.size === 0 : false}
            onChange={setDelta}
            onApplyDamage={bulkMode ? applyBulkDamage : () => applyHpDelta("damage")}
            onApplyHeal={() => applyHpDelta("heal")}
            onOpenConditions={onOpenConditionsFromDelta}
            bulkMode={bulkMode}
            bulkCount={bulkSelectedIds.size}
            onToggleBulkMode={handleToggleBulkMode}
          />
          ) : null}

          <PhaseOrderPanel
            phaseGroups={phaseGroups}
            currentPhase={currentPhase}
            declarationsLocked={declarationsLocked}
            round={round}
            activeId={activeId}
            targetId={target?.id ?? null}
            onSelectSpotlight={handleSelectTarget}
            onSelectTarget={(id) => setTargetId(id)}
            onAdvancePhase={advancePhase}
            onTogglePhase={togglePhase}
            bulkMode={bulkMode}
            bulkSelectedIds={bulkSelectedIds}
            onToggleBulkSelect={handleToggleBulkSelect}
            onToggleReaction={handleToggleReaction} 
          />
        </div>

        <div>
          <CombatantDetailsPanel roleTitle="Target" role="target" combatant={target ?? null} ctx={targetCtx} />
        </div>
      </div>

      <InjuryDialog
        isOpen={injuryDialogOpen}
        combatant={(target as Combatant | null) ?? null}
        player={target?.baseType === "player" ? (playersById[target.baseId] ?? null) : null}
        onClose={() => setInjuryDialogOpen(false)}
        onApplyCondition={handleApplyInjuryCondition}
        onIncrementInjuryCount={handleIncrementInjuryCount}
      />
    </div>
  );
}
