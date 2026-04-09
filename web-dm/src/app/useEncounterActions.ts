import React from "react";
import { api, jsonInit } from "@/services/api";
import type { AdversaryPickerOptions } from "@/views/CampaignView/adversaryPicker/types";

function apiErr(e: unknown) {
  alert(e instanceof Error ? e.message : "Something went wrong. Please try again.");
}

export function useEncounterActions(
  encounterId: string | undefined,
  refresh: () => Promise<void>
) {
  const addAllPlayers = React.useCallback(async () => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}/combatants/addPlayers`, { method: "POST" });
      await refresh();
    } catch (e) { apiErr(e); }
  }, [encounterId, refresh]);

  const addPlayerToEncounter = React.useCallback(async (playerId: string) => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}/combatants/addPlayer`, jsonInit("POST", { playerId }));
      await refresh();
    } catch (e) { apiErr(e); }
  }, [encounterId, refresh]);

  const addAdversary = React.useCallback(async (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => {
    if (!encounterId) return;
    const labelBase = opts.label.trim() || undefined;
    try {
      await api(`/api/encounters/${encounterId}/combatants/addMonster`, jsonInit("POST", {
        monsterId: adversaryId,
        qty,
        friendly: Boolean(opts.friendly),
        labelBase,
        hpMax: opts.hp,
        hpRangeMin: opts.hpRangeMin,
        hpRangeMax: opts.hpRangeMax,
        dualPhase: Boolean(opts.dualPhase),
      }));
      await refresh();
    } catch (e) { apiErr(e); }
  }, [encounterId, refresh]);

  const removeCombatant = React.useCallback(async (combatantId: string) => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}/combatants/${combatantId}`, { method: "DELETE" });
      await refresh();
    } catch (e) { apiErr(e); }
  }, [encounterId, refresh]);

  const addINpcToEncounter = React.useCallback(async (inpcId: string) => {
    if (!encounterId) return;
    try {
      await api(`/api/encounters/${encounterId}/combatants/addInpc`, jsonInit("POST", { inpcId }));
      await refresh();
    } catch (e) { apiErr(e); }
  }, [encounterId, refresh]);

  return { addAllPlayers, addPlayerToEncounter, addAdversary, removeCombatant, addINpcToEncounter };
}
