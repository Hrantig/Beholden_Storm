import React from "react";
import { Panel } from "@/ui/Panel";
import { theme } from "@/theme/theme";
import { IconNotes } from "@/icons";
import type { Player } from "@/domain/types/domain";

export function SharedNotesPanel(props: { players: Player[] }) {
  const entries = props.players.filter((p) => p.sharedNotes?.trim());

  if (!entries.length) return null;

  return (
    <Panel
      title={
        <span style={{ display: "inline-flex", gap: 8, alignItems: "center" }}>
          <IconNotes /> Shared Notes
        </span>
      }
    >
      <div style={{ display: "grid", gap: 10 }}>
        {entries.map((p) => (
          <div key={p.id}>
            <div style={{ fontWeight: 900, fontSize: "var(--fs-small)", color: theme.colors.muted, marginBottom: 3 }}>
              {p.characterName}
              {p.playerName ? (
                <span style={{ fontWeight: 600, marginLeft: 5 }}>({p.playerName})</span>
              ) : null}
            </div>
            <div style={{ fontSize: "var(--fs-medium)", color: theme.colors.text, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
              {p.sharedNotes}
            </div>
          </div>
        ))}
      </div>
    </Panel>
  );
}
