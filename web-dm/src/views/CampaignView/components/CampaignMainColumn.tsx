import type { AdversaryPickerOptions } from "@/views/CampaignView/adversaryPicker/types";
import { PlayersPanel } from "@/views/CampaignView/panels/PlayersPanel";
import { INpcsPanel } from "@/views/CampaignView/panels/INpcsPanel";
import type { Combatant, Player, INpc } from "@/domain/types/domain";


export function CampaignMainColumn(props: {
  players: Player[];
  combatants: Combatant[];
  inpcs: INpc[];
  selectedEncounterId: string | null;
  onFullRest: () => void;
  onCreatePlayer: () => void;
  onEditPlayer: (playerId: string) => void;
  onDeletePlayer: (playerId: string) => void;
  onAddPlayerToEncounter: (playerId: string) => void;
  selectedCampaignId: string | null;
  onAddINpcFromAdversary: (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => void;
  onEditINpc: (inpcId: string) => void;
  onDeleteINpc: (inpcId: string) => void;
  onAddINpcToEncounter: (inpcId: string) => void;
  onAddINpcFromAdversaryCustom: (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => void;
  onPatchPlayer: (playerId: string, patch: { focusCurrent?: number; investitureCurrent?: number | null }) => void;
  onPatchINpc: (inpcId: string, patch: { focusCurrent?: number; investitureCurrent?: number | null }) => void;
}) {
  return (
    <div className="campaignCol campaignColMain">
      <PlayersPanel
        players={props.players}
        combatants={props.combatants}
        selectedEncounterId={props.selectedEncounterId}
        onFullRest={props.onFullRest}
        onCreatePlayer={props.onCreatePlayer}
        onEditPlayer={props.onEditPlayer}
        onDeletePlayer={props.onDeletePlayer}
        onAddPlayerToEncounter={props.onAddPlayerToEncounter}
        onPatchPlayer={props.onPatchPlayer}
      />

      <INpcsPanel
        inpcs={props.inpcs}
        selectedCampaignId={props.selectedCampaignId}
        selectedEncounterId={props.selectedEncounterId}
        onAddINpcFromAdversary={props.onAddINpcFromAdversary}
        onEditINpc={props.onEditINpc}
        onDeleteINpc={props.onDeleteINpc}
        onAddINpcToEncounter={props.onAddINpcToEncounter}
        onAddINpcFromAdversaryCustom={props.onAddINpcFromAdversaryCustom}
        onPatchINpc={props.onPatchINpc}
      />
    </div>
  );
}
