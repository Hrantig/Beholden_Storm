import React from "react";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { theme } from "@/theme/theme";
import { IconINPC, IconPlus } from "@/icons";
import { PlayerRow } from "@/views/CampaignView/components/PlayerRow";
import { AdversaryPickerModal } from "@/views/CampaignView/adversaryPicker/AdversaryPickerModal";
import type { AdversaryPickerOptions } from "@/views/CampaignView/adversaryPicker/types";
import type { INpc } from "@/domain/types/domain";
import { titleCase } from "@/lib/format/titleCase";

type Props = {
  inpcs: INpc[];
  selectedCampaignId: string | null;
  selectedEncounterId: string | null;

  onAddINpcFromAdversary: (adversaryId: string, qty: number, opts: AdversaryPickerOptions) => void;
  onEditINpc: (inpcId: string) => void;
  onDeleteINpc: (inpcId: string) => void;
  onAddINpcToEncounter: (inpcId: string) => void;
};

export function INpcsPanel(props: Props) {
  const [isPickerOpen, setIsPickerOpen] = React.useState(false);

  const sorted = React.useMemo(
    () => [...props.inpcs].sort((a, b) => a.name.localeCompare(b.name)),
    [props.inpcs]
  );

  const getMonsterKeyLabel = React.useCallback((monsterId?: string | null) => {
    if (!monsterId) return "";
    const key = monsterId.startsWith("m_") ? monsterId.slice(2) : monsterId;
    return titleCase(key.replace(/[_-]+/g, " ").trim());
  }, []);

  const useTwoColumn = Boolean(props.selectedEncounterId) && sorted.length > 4;

  return (
    <Panel
      storageKey="campaign-inpcs"
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <IconINPC /> Important NPCs ({props.inpcs.length})
        </span>
      }
      actions={
        <IconButton title="Add iNPC" onClick={() => setIsPickerOpen(true)} disabled={!props.selectedCampaignId} variant="accent">
          <IconPlus />
        </IconButton>
      }
    >
      {sorted.length ? (
        <div
          style={{
            display: "grid",
            gap: 5,
            gridTemplateColumns: useTwoColumn ? "repeat(2, minmax(0, 1fr))" : "1fr"
          }}
        >
          {sorted.map((i) => {
            const monsterKeyLabel = getMonsterKeyLabel(i.monsterId);
            const subtitle = monsterKeyLabel
              ? <span style={{ opacity: 0.7 }}>{monsterKeyLabel}</span>
              : undefined;

            return (
              <PlayerRow
                key={i.id}
                p={{
                  id: i.id,
                  characterName: i.name,
                  ancestry: "",
                  paths: [],
                  level: 0,
                  hpMax: i.hpMax,
                  hpCurrent: i.hpCurrent,
                  focusCurrent: 0,
                  focusMax: 0,
                  movement: 0,
                }}
                icon={
                  i.friendly
                    ? <span style={{ color: theme.colors.green }}><IconINPC /></span>
                    : <span style={{ color: theme.colors.red }}><IconINPC /></span>
                }
                subtitle={subtitle}
                primaryAction={
                  props.selectedEncounterId ? (
                    <IconButton
                      title="Add to Encounter"
                      onClick={(e) => (e.stopPropagation(), props.onAddINpcToEncounter(i.id))}
                      variant="ghost"
                      size="sm"
                    >
                      <IconPlus />
                    </IconButton>
                  ) : null
                }
                menuItems={[
                  { label: "Edit iNPC", onClick: () => props.onEditINpc(i.id) },
                  { label: "Delete iNPC", danger: true, onClick: () => props.onDeleteINpc(i.id) },
                ]}
              />
            );
          })}
        </div>
      ) : (
        <div style={{ color: theme.colors.muted }}>No iNPCs yet.</div>
      )}

      <AdversaryPickerModal
        isOpen={isPickerOpen}
        onClose={() => setIsPickerOpen(false)}
        onAddAdversary={(adversaryId, qty, opts) => {
          props.onAddINpcFromAdversary(adversaryId, qty, opts);
          setIsPickerOpen(false);
        }}
      />
    </Panel>
  );
}
