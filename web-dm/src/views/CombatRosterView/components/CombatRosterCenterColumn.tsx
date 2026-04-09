import type { Combatant } from "@/domain/types/domain";
import type { AdversaryPickerOptions } from "@/views/CampaignView/adversaryPicker/types";
import { EncounterRosterPanel } from "@/views/CampaignView/panels/EncounterRosterPanel";

type Props = {
  selectedEncounter: { id: string; name: string } | null;
  combatants: Combatant[];
  xpByCombatantId: Record<string, number>;
  playersById?: Record<string, { imageUrl?: string | null }>;
  onAddAdversary: (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => Promise<void>;
  onAddAllPlayers: () => Promise<void>;
  onOpenCombat: () => void;
  onEditCombatant: (combatantId: string) => void;
  onRemoveCombatant: (combatantId: string) => Promise<void>;
};

export function CombatRosterCenterColumn(props: Props) {
  return (
    <div className="campaignCol" style={{ display: "grid", gap: 10, alignContent: "start" }}>
      <EncounterRosterPanel
        selectedEncounter={props.selectedEncounter}
        combatants={props.combatants}
        xpByCombatantId={props.xpByCombatantId}
        playersById={props.playersById}
        onAddAdversary={props.onAddAdversary}
        onAddAllPlayers={props.onAddAllPlayers}
        onOpenCombat={props.onOpenCombat}
        onEditCombatant={props.onEditCombatant}
        onRemoveCombatant={props.onRemoveCombatant}
      />
    </div>
  );
}
