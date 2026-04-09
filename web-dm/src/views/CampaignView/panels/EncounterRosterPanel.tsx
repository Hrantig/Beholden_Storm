import React from "react";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Panel } from "@/ui/Panel";
import { AdversaryPickerModal } from "@/views/CampaignView/adversaryPicker/AdversaryPickerModal";
import type { AdversaryPickerOptions } from "@/views/CampaignView/adversaryPicker/types";
import type { Combatant } from "@/domain/types/domain";
import { EncounterRosterHeaderActions } from "@/views/CampaignView/panels/EncounterRosterPanel/EncounterRosterHeaderActions";
import { EncounterRosterList } from "@/views/CampaignView/panels/EncounterRosterPanel/EncounterRosterList";
import type { CombatantVM } from "@/views/CampaignView/panels/EncounterRosterPanel/utils";
import { mapCombatantsToVM } from "@/views/CampaignView/panels/EncounterRosterPanel/utils";

export function EncounterRosterPanel(props: {
  selectedEncounter: { id: string; name: string } | null;

  // NOTE: store/API combatants come in here (not the VM)
  combatants: Combatant[];
  playersById?: Record<string, { imageUrl?: string | null }>;

  // Optional per-combatant XP (for monster/inpc rows).
  // Keyed by combatant id.
  xpByCombatantId?: Record<string, number>;

  onAddAdversary: (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => void;

  onAddAllPlayers: () => void;
  onOpenCombat: () => void;
  onEditCombatant: (combatantId: string) => void;
  onRemoveCombatant: (combatantId: string) => void;
}) {
  const [pickerOpen, setPickerOpen] = React.useState(false);

  // Map raw combatants -> VM used by this panel (keeps CampaignView simple)
  const combatantsVM: CombatantVM[] = React.useMemo(
    () => mapCombatantsToVM(props.combatants ?? [], props.xpByCombatantId, props.playersById),
    [props.combatants, props.xpByCombatantId, props.playersById]
  );

  const encounter = props.selectedEncounter;

  return (
    <Panel
      storageKey="campaign-roster"
      title="Combat Roster"
      actions={
        encounter ? (
          <EncounterRosterHeaderActions
            onAddAllPlayers={props.onAddAllPlayers}
            onOpenCombat={props.onOpenCombat}
          />
        ) : null
      }
    >
      {!encounter ? (
        <div style={{ color: theme.colors.muted }}>Select an encounter to build the roster.</div>
      ) : (
        <div style={{ display: "grid", gap: 8 }}>
          <EncounterRosterList
            combatants={combatantsVM}
            onEditCombatant={props.onEditCombatant}
            onRemoveCombatant={props.onRemoveCombatant}
          />

          {/* Add adversaries */}
          <div style={{ display: "grid", gap: 6, paddingTop: 8, borderTop: `1px solid ${theme.colors.panelBorder}` }}>
            <Button onClick={() => setPickerOpen(true)}>
              + Adversary
            </Button>
          </div>

          <AdversaryPickerModal
            isOpen={pickerOpen}
            onClose={() => setPickerOpen(false)}
            onAddAdversary={(id, qty, opts) => props.onAddAdversary(id, qty, opts)}
          />
        </div>
      )}
    </Panel>
  );
}
