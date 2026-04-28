import * as React from "react";
import type { Combatant, Player } from "@/domain/types/domain";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { DURATION_TABLE, EFFECT_TABLE } from "@/views/CombatView/data/injuryTables";
import type { EffectRow } from "@/views/CombatView/data/injuryTables";

type Props = {
  isOpen: boolean;
  combatant: Combatant | null;
  player: Player | null;
  onClose: () => void;
  onApplyCondition: (conditionKey: string, detail?: string) => void;
  onIncrementInjuryCount?: () => void;
};

const TH_STYLE: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  fontSize: "var(--fs-small)",
  color: theme.colors.muted,
  borderBottom: `1px solid ${theme.colors.panelBorder}`,
  fontWeight: 700,
};

export function InjuryDialog({ isOpen, combatant, player, onClose, onApplyCondition, onIncrementInjuryCount }: Props) {
  const [selectedEffect, setSelectedEffect] = React.useState<EffectRow | null>(null);

  React.useEffect(() => {
    if (!isOpen) setSelectedEffect(null);
  }, [isOpen]);

  if (!isOpen) return null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: theme.colors.scrim,
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 24,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 800,
          background: theme.colors.modalBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 14,
          boxShadow: `0 24px 80px ${theme.colors.shadowColor}`,
          maxHeight: "90vh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "16px 20px",
            borderBottom: `1px solid ${theme.colors.panelBorder}`,
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: theme.colors.text }}>
            Injury Roll{combatant ? ` — ${combatant.name}` : ""}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: theme.colors.muted,
              fontSize: "var(--fs-large)",
              lineHeight: 1,
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Injury count notice */}
        {player != null && player.injuryCount > 0 && (
          <div
            style={{
              margin: "16px 20px 0",
              padding: "8px 14px",
              borderRadius: 8,
              background: "rgba(239,68,68,0.1)",
              border: `1px solid ${theme.colors.red}`,
              color: theme.colors.red,
              fontWeight: 700,
              fontSize: "var(--fs-small)",
            }}
          >
            ⚠ This character has {player.injuryCount} active{" "}
            {player.injuryCount === 1 ? "injury" : "injuries"} — apply a cumulative penalty to the injury roll.
          </div>
        )}

        {/* Body: two columns */}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
          }}
        >
          {/* Left: Duration table (reference only) */}
          <div
            style={{
              padding: "16px 20px",
              borderRight: `1px solid ${theme.colors.panelBorder}`,
            }}
          >
            <div
              style={{
                fontWeight: 900,
                fontSize: "var(--fs-medium)",
                color: theme.colors.text,
                marginBottom: 4,
              }}
            >
              Injury Duration
            </div>
            <div
              style={{
                fontSize: "var(--fs-small)",
                color: theme.colors.muted,
                marginBottom: 12,
              }}
            >
              Roll your injury die and find the matching duration
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>Roll</th>
                  <th style={TH_STYLE}>Result</th>
                  <th style={TH_STYLE}>Description</th>
                </tr>
              </thead>
              <tbody>
                {DURATION_TABLE.map((row) => (
                  <tr key={row.roll}>
                    <td
                      style={{
                        padding: "6px 8px",
                        fontSize: "var(--fs-small)",
                        color: theme.colors.muted,
                        whiteSpace: "nowrap",
                        verticalAlign: "top",
                      }}
                    >
                      {row.roll}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        fontSize: "var(--fs-small)",
                        color: theme.colors.text,
                        fontWeight: 700,
                        whiteSpace: "nowrap",
                        verticalAlign: "top",
                      }}
                    >
                      {row.result}
                    </td>
                    <td
                      style={{
                        padding: "6px 8px",
                        fontSize: "var(--fs-small)",
                        color: theme.colors.muted,
                        verticalAlign: "top",
                      }}
                    >
                      {row.description}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: Effects table (clickable) */}
          <div style={{ padding: "16px 20px" }}>
            <div
              style={{
                fontWeight: 900,
                fontSize: "var(--fs-medium)",
                color: theme.colors.text,
                marginBottom: 4,
              }}
            >
              Injury Effects (d8)
            </div>
            <div
              style={{
                fontSize: "var(--fs-small)",
                color: theme.colors.muted,
                marginBottom: 12,
              }}
            >
              Roll d8 and click the matching result
            </div>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <th style={TH_STYLE}>Roll</th>
                  <th style={TH_STYLE}>Effect</th>
                  <th style={TH_STYLE}>Narrative Suggestion</th>
                </tr>
              </thead>
              <tbody>
                {EFFECT_TABLE.map((row) => {
                  const isSelected = selectedEffect?.roll === row.roll;
                  return (
                    <tr
                      key={row.roll}
                      onClick={() => setSelectedEffect(isSelected ? null : row)}
                      style={{
                        cursor: "pointer",
                        background: isSelected
                          ? `${theme.colors.accentPrimary}18`
                          : "transparent",
                        outline: isSelected
                          ? `1px solid ${theme.colors.accentPrimary}44`
                          : "none",
                        transition: "background 100ms",
                      }}
                    >
                      <td
                        style={{
                          padding: "6px 8px",
                          fontSize: "var(--fs-small)",
                          color: theme.colors.muted,
                          whiteSpace: "nowrap",
                          verticalAlign: "top",
                        }}
                      >
                        {row.roll}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontSize: "var(--fs-small)",
                          color: isSelected ? theme.colors.accentPrimary : theme.colors.text,
                          fontWeight: 700,
                          whiteSpace: "nowrap",
                          verticalAlign: "top",
                        }}
                      >
                        {row.effect}
                      </td>
                      <td
                        style={{
                          padding: "6px 8px",
                          fontSize: "var(--fs-small)",
                          color: theme.colors.muted,
                          verticalAlign: "top",
                        }}
                      >
                        {row.narrativeSuggestion}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Selection action area */}
            {selectedEffect && (
              <div
                style={{
                  marginTop: 16,
                  padding: "12px 14px",
                  background: theme.colors.panelBg,
                  borderRadius: 8,
                  border: `1px solid ${theme.colors.panelBorder}`,
                }}
              >
                {selectedEffect.conditionKey ? (
                  <Button
                    variant="primary"
                    style={{ width: "100%" }}
                    onClick={() => {
                      onIncrementInjuryCount?.();
                      onApplyCondition(
                        selectedEffect.conditionKey!,
                        selectedEffect.conditionDetail
                      );
                    }}
                  >
                    Apply {selectedEffect.effect} condition
                  </Button>
                ) : (
                  <div
                    style={{
                      fontSize: "var(--fs-small)",
                      color: theme.colors.muted,
                      fontStyle: "italic",
                    }}
                  >
                    Narrative effect — track on character sheet
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
