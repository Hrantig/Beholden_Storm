import React from "react";
import type { Combatant } from "@/domain/types/domain";
import { theme } from "@/theme/theme";
import { conditionIconByKey } from "@/icons/conditions";
import {
  CONDITION_DEFS,
  buildRosterById,
  conditionLabel,
  displayName,
  type ConditionInstance
} from "@/domain/conditions";

export function CombatantConditionsSection(props: {
  selected: Combatant;
  role: "active" | "target";
  roster: Combatant[];
  currentRound?: number;
  onCommit: (next: ConditionInstance[]) => void;
}) {
  const selectedConditions = React.useMemo(() => {
    const raw = props.selected.conditions ?? [];
    return raw.map((c) => ({
      key: String(c.key),
      casterId: c?.casterId != null ? String(c.casterId) : null,
      expiresAtRound: c?.expiresAtRound != null ? Number(c.expiresAtRound) : null,
    }));
  }, [props.selected.id, props.selected.conditions]);

  const rosterById = React.useMemo(() => buildRosterById(props.roster ?? []), [props.roster]);

  const pillStyle: React.CSSProperties = {
    padding: "6px 10px",
    borderRadius: 999,
    border: `1px solid ${theme.colors.panelBorder}`,
    background: theme.colors.panelBg,
    fontSize: "var(--fs-pill)",
    fontWeight: 900,
    color: theme.colors.text,
    display: "inline-flex",
    alignItems: "center",
    gap: 8
  };

  function removeConditionAt(index: number) {
    const next = [...selectedConditions];
    next.splice(index, 1);
    props.onCommit(next);
  }

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 10 }}>
        <span style={{ color: theme.colors.accentPrimary, fontSize: "var(--fs-title)", fontWeight: 900, whiteSpace: "nowrap" }}>
          CONDITIONS
        </span>
        <div style={{ flex: 1, height: 1, background: theme.colors.panelBorder }} />
      </div>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {selectedConditions.length ? (
          selectedConditions.map((c, idx) => {
            const needsCaster = c.key === "hexed" || c.key === "marked";
            const caster = c.casterId ? rosterById[c.casterId] : null;
            const casterLabel = caster ? displayName(caster) : "";

            const cr = props.currentRound ?? 0;
            const hasTimer = c.expiresAtRound != null;
            const isExpired = hasTimer && c.expiresAtRound! <= cr;
            const remaining = hasTimer ? c.expiresAtRound! - cr : null;

            const chipBorder = isExpired
              ? `1px solid ${theme.colors.accentWarning}`
              : pillStyle.border;
            const chipBg = isExpired
              ? "rgba(255, 140, 66, 0.08)"
              : pillStyle.background;

            const def = CONDITION_DEFS.find(d => d.key === c.key);
            
            return (
              <span
                key={`${c.key}:${c.casterId ?? ""}:${idx}`}
                style={{ 
                  ...pillStyle, 
                  border: chipBorder, 
                  background: chipBg,
                  borderRadius: 12,
                  display: "flex",
                  flexDirection: "row",
                  alignItems: "flex-start",
                  gap: 8,
                  padding: "8px 10px",
                }}
              >
                {/* Left: icon + content */}
                <div style={{ display: "flex", flexDirection: "column", gap: 3, flex: 1, minWidth: 0 }}>
                  {/* Top row: icon + name + timer */}
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {(() => {
                      const CondIcon = conditionIconByKey[c.key as keyof typeof conditionIconByKey];
                      return CondIcon ? (
                        <CondIcon size={14} title={conditionLabel(c.key)} style={{ opacity: 0.9, flexShrink: 0 }} />
                      ) : null;
                    })()}
                    <span style={{ fontSize: "var(--fs-medium)", fontWeight: 900 }}>{conditionLabel(c.key)}</span>
                    {needsCaster && casterLabel ? (
                      <span style={{ color: theme.colors.muted, fontWeight: 900 }}>({casterLabel})</span>
                    ) : null}
                    {hasTimer && (
                      <span
                        title={isExpired ? "Expired" : `Expires in ${remaining} round${remaining === 1 ? "" : "s"}`}
                        style={{
                          fontSize: "var(--fs-tiny)", fontWeight: 900, padding: "1px 5px",
                          borderRadius: 999,
                          background: isExpired ? theme.colors.accentWarning : "rgba(255,255,255,0.08)",
                          color: isExpired ? "#000" : theme.colors.accentWarning,
                          border: isExpired ? "none" : `1px solid ${theme.colors.accentWarning}`,
                          lineHeight: 1.4, flexShrink: 0,
                        }}
                      >
                        {isExpired ? "exp" : `${remaining}R`}
                      </span>
                    )}
                  </div>

                  {/* Description */}
                  {def?.description && (
                    <div style={{
                      fontSize: "var(--fs-small)", color: theme.colors.muted,
                      fontStyle: "italic", lineHeight: 1.4,
                    }}>
                      {def.description}
                    </div>
                  )}
                </div>

                {/* Right: X button */}
                <button
                  type="button"
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeConditionAt(idx); }}
                  title="Remove"
                  style={{
                    border: `1px solid ${theme.colors.panelBorder}`, background: "transparent",
                    color: theme.colors.text, fontWeight: 900, borderRadius: 999,
                    width: 20, height: 20, display: "inline-flex", alignItems: "center",
                    justifyContent: "center", cursor: "pointer", flexShrink: 0,
                  }}
                >×</button>
              </span>
            );
          })
        ) : (
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)" }}>No conditions.</div>
        )}
      </div>
    </div>
  );
}
