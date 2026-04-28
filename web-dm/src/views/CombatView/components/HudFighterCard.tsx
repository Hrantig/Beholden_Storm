import * as React from "react";

import { theme } from "@/theme/theme";
import { HudConditionsStrip } from "@/views/CombatView/components/HudConditionsStrip";
import { clamp01, getHudHp, getHudHpFill, getHudNames } from "@/views/CombatView/utils/hud";
import type { Adversary, Combatant, Player, CombatPhase } from "@/domain/types/domain";

import "@/views/CombatView/combatView.css";

type Role = "active" | "target";

type Props = {
  combatant: Combatant | null;
  role: Role;
  playersById: Record<string, Player>;
  renderCombatantIcon: (c: Combatant | null) => React.ReactNode;
  activeId: string | null;
  targetId: string | null;
  onOpenConditions: (combatantId: string, role: Role, casterId: string | null) => void;
  onUpdateCombatant?: (id: string, patch: Record<string, unknown>) => void;
  onUpdateResource?: (id: string, patch: { focusCurrent?: number; investitureCurrent?: number }) => void;
  currentPhase?: CombatPhase;
  adversary?: Adversary | null;
};

/**
 * Combat HUD fighter card ("fighting game" style) shown above the 3-column layout.
 * View orchestrates state; this component only renders.
 */
export function HudFighterCard(props: Props) {
  const c = props.combatant;
  const names = React.useMemo(() => getHudNames(c, props.playersById), [c, props.playersById]);
  const { hpCurrent, hpMax, tempHp } = React.useMemo(() => getHudHp(c), [c]);

  const rawConditions = c?.conditions ?? [];

  const hpPct = clamp01(hpCurrent / hpMax);
  const tempPct = clamp01(tempHp / hpMax);
  const hpFill = getHudHpFill(hpPct);

  const isSelfTarget =
    props.role === "target" &&
    props.targetId != null &&
    props.activeId != null &&
    String(props.targetId) === String(props.activeId);

  const roleAccent = props.role === "active" ? theme.colors.accentHighlight : theme.colors.blue;
  const roleLabel = isSelfTarget ? "SELF" : props.role === "active" ? "ACTIVE" : "TARGET";

  // Accent used for the HUD portrait hex backing (match PlayerRow / combat icon coloring).
  const isDead = (c?.hpCurrent ?? 1) <= 0;
  const portraitAccent = !c
    ? theme.colors.muted
    : isDead
      ? theme.colors.muted
      : c.baseType === "player"
        ? theme.colors.blue
        : c.color || (c.friendly ? theme.colors.green : theme.colors.red);

  // Fighting-game style: HP + optional temp overlay segment.
  const tempLeft = clamp01(hpPct);
  const tempWidth = clamp01(Math.min(tempPct, 1 - tempLeft));

  const openHudConditions = React.useCallback(() => {
    const id = c?.id ?? null;
    if (!id) return;
    const casterId = props.role === "active" ? id : (props.activeId ? String(props.activeId) : null);
    props.onOpenConditions(id, props.role, casterId);
  }, [c, props.role, props.activeId, props.onOpenConditions]);

  const maxAp = React.useMemo(() => {
    if (!c) return 2;
    if (c.dualPhase) {
      // In fast-npc phase or PC phases before fast-npc → show 2
      // In slow-npc phase or PC phases before slow-npc → show 3
      return (props.currentPhase === "fast-npc" || props.currentPhase === "fast-pc") ? 2 : 3;
    }
    return c.phase === "fast" ? 2 : 3;
  }, [c, props.currentPhase]);
  const remaining = Math.max(0, maxAp - (c?.actionPointsUsed ?? 0));

  const focusCur = c?.focusCurrent ?? (props.adversary?.focusMax ?? null);
  const focusMax = c?.focusMax ?? (props.adversary?.focusMax ?? null);
  const investitureCur = c?.investitureCurrent ?? (props.adversary?.investitureMax ?? null);
  const investitureMax = c?.investitureMax ?? (props.adversary?.investitureMax ?? null);

  return (
    <div
      className="cvHudCard"
      style={
        {
          "--cv-roleAccent": roleAccent,
          "--cv-panelBg": theme.colors.panelBg,
          "--cv-panelBorder": theme.colors.panelBorder,
          "--cv-bg": theme.colors.bg,
          "--cv-text": theme.colors.text,
          "--cv-muted": theme.colors.muted,
          "--cv-accent": theme.colors.accentHighlight,
          "--cv-portraitAccent": portraitAccent,
          "--cv-portraitAccentGlow": `${portraitAccent}22`,
          "--cv-hpFill": hpFill,
          "--cv-hpPct": `${Math.round(hpPct * 100)}%`,
          "--cv-tempLeft": `${Math.round(tempLeft * 100)}%`,
          "--cv-tempWidth": `${Math.round(tempWidth * 100)}%`
        } as React.CSSProperties
      }
    >
      <div className="cvHudTopRow">
        {/* Icon + hex backing for extra oomph */}
        <div className="cvHudPortraitWrap">
          <svg
            width={48}
            height={48}
            viewBox="0 0 100 100"
            className="cvHudPortraitHex"
            aria-hidden
          >
            <polygon
              points="50 4, 91 27, 91 73, 50 96, 9 73, 9 27"
              fill={`${portraitAccent}22`}
              stroke={`${portraitAccent}CC`}
              strokeWidth="5"
              strokeLinejoin="round"
            />
          </svg>
          <div className="cvHudPortraitIcon">
            {props.renderCombatantIcon(c)}
          </div>
        </div>

        <div className="cvHudNames">
          <div className="cvHudBadgeRow">
            <span
              className="cvHudBadge"
              title={props.role === "active" ? "Active" : isSelfTarget ? "Self target" : "Target"}
            >
              {roleLabel}
            </span>
          </div>
          <div
            title={names.primary}
            className="cvHudPrimaryName"
          >
            {names.primary} &nbsp;
            {names.secondary ? (
              <span
                title={names.secondary}
                className="cvHudSecondaryName"
              >
                {names.secondary}
              </span>
            ) : null}
          </div>
        </div>

        {/* Resource panel — top right */}
        {c && (
          <div style={{
            display: "flex", flexDirection: "column", gap: 4,
            marginLeft: "auto", flexShrink: 0, alignItems: "flex-end",
          }}>
            {props.role === "active" && c && (
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          // marginTop: 6, paddingTop: 6,
          //borderTop: `1px solid ${theme.colors.panelBorder}`,
           paddingBottom: 6,
        }}>
          {/* Action points */}
          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
            Actions :
            <button
              onClick={() => {
                const used = Math.min((c.actionPointsUsed ?? 0) + 1, maxAp);
                props.onUpdateCombatant?.(c.id, { actionPointsUsed: used });
              }}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: theme.colors.muted, fontSize: "var(--fs-medium)", padding: "0 2px" }}
            >−</button>
            <div style={{ display: "flex", gap: 3 }}>
              {Array.from({ length: maxAp }).map((_, i) => (
                <span
                  key={i}
                  onClick={() => {
                    const next = i < remaining ? i : i + 1;
                    props.onUpdateCombatant?.(c.id, { actionPointsUsed: maxAp - Math.max(0, Math.min(next, maxAp)) });
                  }}
                  title={i < remaining ? "Click to spend" : "Click to restore"}
                  style={{
                    fontSize: "var(--fs-large)", cursor: "pointer",
                    color: i < remaining ? theme.colors.accentPrimary : theme.colors.muted,
                    opacity: i < remaining ? 1 : 0.5,
                  }}
                >▶</span>
              ))}
            </div>
            <button
              onClick={() => {
                const used = Math.max((c.actionPointsUsed ?? 0) - 1, 0);
                props.onUpdateCombatant?.(c.id, { actionPointsUsed: used });
              }}
              style={{ background: "transparent", border: "none", cursor: "pointer", color: theme.colors.muted, fontSize: "var(--fs-medium)", padding: "0 2px" }}
            >+</button>
          </div>

          {/* Reaction */}
          <button
            onClick={() => props.onUpdateCombatant?.(c.id, { usedReaction: !c.usedReaction })}
            title={c.usedReaction ? "Reaction spent" : "Reaction available"}
            style={{
              background: "transparent", border: "none", cursor: "pointer",
              fontSize: "var(--fs-large)", padding: "0 4px",
              color: c.usedReaction ? theme.colors.muted : theme.colors.accentPrimary,
              opacity: c.usedReaction ? 0.5 : 1,
            }}
          >↺</button>
        </div>
      )}
            {/* Focus */}
            {focusMax != null && focusMax > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Focus :
              <button
                onClick={() => props.onUpdateResource?.(c.id, { focusCurrent: Math.max(0, (focusCur ?? 0) - 1) })}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: theme.colors.muted, fontSize: "var(--fs-medium)", padding: "0 2px" }}
              >−</button>
              <div style={{ display: "flex", gap: 2 }}>
                {Array.from({ length: focusMax }).map((_, i) => (
                  <span
                    key={i}
                    onClick={() => {
                      const cur = focusCur ?? 0;
                      const next = i < cur ? i : i + 1;
                      props.onUpdateResource?.(c.id, { focusCurrent: Math.max(0, Math.min(next, focusMax)) });
                    }}
                    title={i < (focusCur ?? 0) ? `Set focus to ${i}` : `Set focus to ${i + 1}`}
                    style={{
                      fontSize: "var(--fs-large)", cursor: "pointer",
                      color: i < (focusCur ?? 0) ? theme.colors.accentPrimary : theme.colors.panelBorder,
                      opacity: i < (focusCur ?? 0) ? 1 : 0.3,
                    }}
                  >
                    {i < (focusCur ?? 0) ? "◉" : "○"}
                  </span>
                ))}
              </div>
              <button
                onClick={() => props.onUpdateResource?.(c.id, { focusCurrent: Math.min((focusCur ?? 0) + 1, focusMax) })}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: theme.colors.muted, fontSize: "var(--fs-medium)", padding: "0 2px" }}
              >+</button>
            </div>
          )}

            {/* Investiture */}
            {investitureMax != null && investitureMax > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
              Investiture :
              <button
                onClick={() => props.onUpdateResource?.(c.id, { investitureCurrent: Math.max(0, (investitureCur ?? 0) - 1) })}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: theme.colors.muted, fontSize: "var(--fs-medium)", padding: "0 2px" }}
              >−</button>
              <div style={{ display: "flex", gap: 2 }}>
                {Array.from({ length: investitureMax }).map((_, i) => (
                  <span
                    key={i}
                    onClick={() => {
                      const cur = investitureCur ?? 0;
                      const next = i < cur ? i : i + 1;
                      props.onUpdateResource?.(c.id, { investitureCurrent: Math.max(0, Math.min(next, investitureMax)) });
                    }}
                    title={i < (investitureCur ?? 0) ? `Set investiture to ${i}` : `Set investiture to ${i + 1}`}
                    style={{
                      fontSize: "var(--fs-large)", cursor: "pointer",
                      color: i < (investitureCur ?? 0) ? "#f59e0b" : theme.colors.panelBorder,
                      opacity: i < (investitureCur ?? 0) ? 1 : 0.3,
                    }}
                  >
                    {i < (investitureCur ?? 0) ? "✦" : "✧"}
                  </span>
                ))}
              </div>
              <button
                onClick={() => props.onUpdateResource?.(c.id, { investitureCurrent: Math.min((investitureCur ?? 0) + 1, investitureMax) })}
                style={{ background: "transparent", border: "none", cursor: "pointer", color: theme.colors.muted, fontSize: "var(--fs-medium)", padding: "0 2px" }}
              >+</button>
            </div>
          )}
          </div>
        )}
      </div>

      <div className="cvHudHpRow">
        <div className="cvHudHpTrack" aria-label="HP">
          <div className="cvHudHpFill" />

          {tempWidth > 0 ? (
            <div className="cvHudTempFill" aria-label="Temp HP" />
          ) : null}
        </div>

       <div className="cvHudHpText" style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {/* HP */}
          <span style={{ fontVariantNumeric: "tabular-nums" }}>
            {Math.max(0, Math.floor(hpCurrent))} / {Math.max(1, Math.floor(hpMax))}
            {tempHp > 0 ? (
              <span className="cvHudTempText">+{Math.floor(tempHp)}</span>
            ) : null}
          </span>
        </div>
      </div>

      <HudConditionsStrip
        conditions={rawConditions}
        onClick={openHudConditions}
        maxShown={6}
        iconColor={theme.colors.text}
      />
    </div>
  );
}
