import React from "react";
import { C } from "@/lib/theme";
import { DURATION_TABLE, EFFECT_TABLE } from "@/data/injuryTables";
import type { EffectRow } from "@/data/injuryTables";

interface InjuryDialogProps {
  isOpen: boolean;
  characterName: string;
  injuryCount: number;
  onClose: () => void;
  onApplyCondition: (conditionKey: string, detail?: string) => void;
  onIncrementInjuryCount: () => void;
}

const TH_STYLE: React.CSSProperties = {
  textAlign: "left",
  padding: "4px 8px",
  fontSize: "var(--fs-small)",
  color: C.muted,
  borderBottom: "1px solid rgba(255,255,255,0.08)",
  fontWeight: 700,
};

export default function InjuryDialog({
  isOpen, characterName, injuryCount, onClose, onApplyCondition, onIncrementInjuryCount,
}: InjuryDialogProps) {
  const [selectedEffect, setSelectedEffect] = React.useState<EffectRow | null>(null);
  const [isNarrow] = React.useState(() => window.innerWidth < 560);

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
        background: "rgba(0,0,0,0.7)",
        zIndex: 1000,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 16,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: "100%",
          maxWidth: 680,
          background: C.bg,
          border: "1px solid rgba(255,255,255,0.1)",
          borderRadius: 14,
          boxShadow: "0 24px 80px rgba(0,0,0,0.6)",
          maxHeight: "90vh",
          overflow: "auto",
          display: "flex",
          flexDirection: "column",
        }}
      >
        {/* Header */}
        <div style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          padding: "16px 20px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          flexShrink: 0,
        }}>
          <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: C.text }}>
            Injury Roll — {characterName}
          </span>
          <button
            onClick={onClose}
            style={{
              background: "transparent",
              border: "none",
              cursor: "pointer",
              color: C.muted,
              fontSize: "var(--fs-large)",
              lineHeight: 1,
              padding: "4px 8px",
            }}
          >
            ✕
          </button>
        </div>

        {/* Injury count notice */}
        {injuryCount > 0 && (
          <div style={{
            margin: "16px 20px 0",
            padding: "8px 14px",
            borderRadius: 8,
            background: "rgba(239,68,68,0.1)",
            border: `1px solid ${C.red}`,
            color: C.red,
            fontWeight: 700,
            fontSize: "var(--fs-small)",
          }}>
            ⚠ This character has {injuryCount} active {injuryCount === 1 ? "injury" : "injuries"} — apply a cumulative penalty to the injury roll.
          </div>
        )}

        {/* Body: two columns */}
        <div style={{
          display: "grid",
          gridTemplateColumns: isNarrow ? "1fr" : "1fr 1fr",
        }}>
          {/* Left: Duration table (reference only) */}
          <div style={{
            padding: "16px 20px",
            borderRight: isNarrow ? "none" : "1px solid rgba(255,255,255,0.08)",
            borderBottom: isNarrow ? "1px solid rgba(255,255,255,0.08)" : "none",
          }}>
            <div style={{ fontWeight: 900, fontSize: "var(--fs-medium)", color: C.text, marginBottom: 4 }}>
              Injury Duration
            </div>
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 12 }}>
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
                    <td style={{ padding: "6px 8px", fontSize: "var(--fs-small)", color: C.muted, whiteSpace: "nowrap", verticalAlign: "top" }}>{row.roll}</td>
                    <td style={{ padding: "6px 8px", fontSize: "var(--fs-small)", color: C.text, fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "top" }}>{row.result}</td>
                    <td style={{ padding: "6px 8px", fontSize: "var(--fs-small)", color: C.muted, verticalAlign: "top" }}>{row.description}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Right: Effects table (clickable) */}
          <div style={{ padding: "16px 20px" }}>
            <div style={{ fontWeight: 900, fontSize: "var(--fs-medium)", color: C.text, marginBottom: 4 }}>
              Injury Effects (d8)
            </div>
            <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 12 }}>
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
                        background: isSelected ? "rgba(56,182,255,0.1)" : "transparent",
                        outline: isSelected ? "1px solid rgba(56,182,255,0.3)" : "none",
                        transition: "background 100ms",
                      }}
                    >
                      <td style={{ padding: "6px 8px", fontSize: "var(--fs-small)", color: C.muted, whiteSpace: "nowrap", verticalAlign: "top" }}>{row.roll}</td>
                      <td style={{ padding: "6px 8px", fontSize: "var(--fs-small)", color: isSelected ? C.accentHl : C.text, fontWeight: 700, whiteSpace: "nowrap", verticalAlign: "top" }}>{row.effect}</td>
                      <td style={{ padding: "6px 8px", fontSize: "var(--fs-small)", color: C.muted, verticalAlign: "top" }}>{row.narrativeSuggestion}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>

            {/* Selection action area */}
            {selectedEffect && (
              <div style={{
                marginTop: 16,
                padding: "12px 14px",
                background: "rgba(255,255,255,0.035)",
                borderRadius: 8,
                border: "1px solid rgba(255,255,255,0.08)",
              }}>
                {selectedEffect.conditionKey ? (
                  <button
                    type="button"
                    style={{
                      width: "100%",
                      background: C.accentHl,
                      border: "none",
                      borderRadius: 8,
                      color: C.textDark,
                      cursor: "pointer",
                      fontWeight: 700,
                      fontSize: "var(--fs-body)",
                      padding: "8px 0",
                    }}
                    onClick={() => {
                      onIncrementInjuryCount();
                      onApplyCondition(selectedEffect.conditionKey!, selectedEffect.conditionDetail);
                      onClose();
                    }}
                  >
                    Apply {selectedEffect.effect} condition
                  </button>
                ) : (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8, marginTop: 10 }}>
                    <div style={{ color: C.muted, fontSize: "var(--fs-small)", fontStyle: "italic" }}>
                      Narrative effect — track on character sheet
                    </div>
                    <button
                      type="button"
                      onClick={() => {
                        onIncrementInjuryCount();
                        onClose();
                      }}
                      style={{
                        padding: "6px 14px", borderRadius: 8, cursor: "pointer",
                        background: "transparent",
                        border: `1px solid ${C.red}`,
                        color: C.red, fontWeight: 700,
                        fontSize: "var(--fs-small)",
                      }}
                    >
                      Record Injury (increment count)
                    </button>
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
