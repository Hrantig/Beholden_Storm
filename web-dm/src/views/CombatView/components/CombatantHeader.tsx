import * as React from "react";
import { useNavigate } from "react-router-dom";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";
import { IconNotes } from "@/icons";
import { useIsNarrow } from "@/views/CombatView/hooks/useIsNarrow";

type Props = {
  backTo: string;
  backTitle?: string;
  title: string;
  onResetFight?: () => void;
  onEndCombat: () => void;
  onOpenAdventureNotes: () => void;
};

/**
 * Top-of-screen combat header.
 */
export function CombatantHeader(props: Props) {
  const { title } = props;
  const navigate = useNavigate();
  const isPhone = useIsNarrow("(max-width: 640px)");

  return (
    <Panel
      title={
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <Button
            onClick={() => navigate(props.backTo)}
            title={props.backTitle ?? "Back"}
          >
            Back
          </Button>
          <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: theme.colors.text }}>{title}</span>
        </div>
      }
      actions={
        <div style={{ display: "flex", gap: isPhone ? 4 : 8, alignItems: "center" }}>
          {props.onResetFight && !isPhone && (
            <Button variant="ghost" onClick={props.onResetFight} title="Reset monsters HP and conditions to full">
              Reset Fight
            </Button>
          )}

          <Button variant="ghost" onClick={props.onOpenAdventureNotes} title="Adventure Notes">
            <span style={{ display: "inline-flex", alignItems: "center", gap: 8 }}>
              <IconNotes size={18} title="Adventure Notes" />
              {!isPhone && "Notes"}
            </span>
          </Button>

          <Button variant="danger" onClick={props.onEndCombat}>
            End
          </Button>
        </div>
      }
    >
      {/* no body */}
      <div />
    </Panel>
  );
}
