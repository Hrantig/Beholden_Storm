import type { Combatant, Player, INpc } from "@/domain/types/domain";
import type { AdversaryPickerOptions } from "@/views/CampaignView/adversaryPicker/types";
import { PlayersPanel } from "@/views/CampaignView/panels/PlayersPanel";
import { INpcsPanel } from "@/views/CampaignView/panels/INpcsPanel";

type Props = {
  players: Player[];
  combatants: Combatant[];
  inpcs: INpc[];
  selectedCampaignId: string;
  selectedEncounterId: string | null;
  onFullRest: () => Promise<void>;
  onCreatePlayer: () => void;
  onEditPlayer: (playerId: string) => void;
  onDeletePlayer: (playerId: string) => void;
  onAddPlayerToEncounter: (playerId: string) => Promise<void>;
  onAddINpcFromAdversary: (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => Promise<void>;
  onAddINpcFromAdversaryCustom: (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => void;
  onEditINpc: (inpcId: string) => void;
  onDeleteINpc: (inpcId: string) => void;
  onAddINpcToEncounter: (inpcId: string) => Promise<void>;
};

export function CombatRosterLeftColumn(props: Props) {
  return (
    <div className="campaignCol">
      <PlayersPanel
        players={props.players}
        combatants={props.combatants}
        selectedEncounterId={props.selectedEncounterId}
        onFullRest={props.onFullRest}
        onCreatePlayer={props.onCreatePlayer}
        onEditPlayer={props.onEditPlayer}
        onDeletePlayer={props.onDeletePlayer}
        onAddPlayerToEncounter={props.onAddPlayerToEncounter}
      />

      <INpcsPanel
        inpcs={props.inpcs}
        selectedCampaignId={props.selectedCampaignId}
        selectedEncounterId={props.selectedEncounterId}
        onAddINpcFromAdversary={props.onAddINpcFromAdversary}
        onAddINpcFromAdversaryCustom={props.onAddINpcFromAdversaryCustom}
        onEditINpc={props.onEditINpc}
        onDeleteINpc={props.onDeleteINpc}
        onAddINpcToEncounter={props.onAddINpcToEncounter}
      />
    </div>
  );
}
