import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { IconPlayer, IconHeart, IconFocus, IconMovement, IconConditions } from "@/icons";
import { PlayerConditions } from "./PlayerConditions";
import { PlayerInjuries } from "./PlayerInjuries";
import ResourcePopover from "./ResourcePopover";
import type { RowMenuItem } from "@/ui/RowMenu";
import { RowMenu } from "@/ui/RowMenu";
import { IconButton } from "@/ui/IconButton";
import { useStore } from "@/store";

export type PlayerVM = {
  id: string;
  playerId?: string;
  encounterId?: string;
  playerName?: string;
  characterName: string;
  ancestry: string;
  paths: string[];
  level: number;
  hpMax: number;
  hpCurrent: number;
  tempHp?: number;
  focusCurrent: number;
  focusMax: number;
  investitureCurrent?: number | null;
  investitureMax?: number | null;
  movement: number;
  injuryCount?: number;
  conditions?: { key: string; casterId?: string | null }[];
  imageUrl?: string | null;
};

export function PlayerRow(props: {
  p: PlayerVM;
  // Primary inline action(s) — keep to 1-2 max
  // null = suppress action area entirely (combat list: clicking the row IS the action)
  primaryAction?: React.ReactNode | null;
  // Items for the … overflow menu. Hidden if empty/undefined.
  menuItems?: RowMenuItem[];
  subtitle?: React.ReactNode;
  icon?: React.ReactNode;
  // Legacy compat — renders directly instead of menu
  actions?: React.ReactNode | null;
  onEdit?: () => void;
  variant?: "campaign" | "combatList";
  onPatchFocus?: (newValue: number) => void;
  onPatchInvestiture?: (newValue: number) => void;
}) {
  const { dispatch } = useStore();
  const p = props.p;
  const variant = props.variant ?? "campaign";
  const isCombatList = variant === "combatList";

  const max = Math.max(1, Number(p.hpMax) || 1);
  const cur = Math.max(0, Number(p.hpCurrent) || 0);
  const pct = cur / max;
  const isDead = cur <= 0;

  const tempHp = Math.max(0, Number((p as any).tempHp ?? 0) || 0);

  const barColor = isDead
    ? theme.colors.red
    : pct <= 0.25
      ? theme.colors.red
      : pct <= 0.5
        ? theme.colors.bloody
        : theme.colors.green;

  const iconColor = isDead ? theme.colors.muted : theme.colors.blue;

  const rowStyle = isCombatList
    ? { background: "transparent", border: "none", borderRadius: 0, padding: "8px 10px" }
    : { background: withAlpha(theme.colors.shadowColor, 0.18), border: `1px solid ${theme.colors.panelBorder}`, borderRadius: 12, padding: "10px 12px" };

  const hasLegacyActions = props.actions !== undefined;
  const showMenu = !hasLegacyActions && Boolean(props.menuItems?.length);

  const metaLine = props.subtitle ?? (
    p.level || p.ancestry || p.paths?.length
      ? <>{p.level ? `Lvl ${p.level} · ` : ""}{p.ancestry}{p.paths?.length ? ` · ${p.paths.join(", ")}` : ""}</>
      : null
  );

  return (
    <div style={{ ...rowStyle, display: "flex", flexDirection: "column", gap: 6 }}>

      {/* Top row: avatar · name/meta · stats · actions */}
      <div style={{ display: "flex", alignItems: "center", gap: 10, minWidth: 0, flexWrap: "wrap" }}>

        {/* Avatar */}
        <div style={{
          flex: "0 0 auto", width: 36, height: 36, borderRadius: 8,
          background: withAlpha(iconColor, 0.15),
          border: `1px solid ${withAlpha(iconColor, 0.35)}`,
          display: "flex", alignItems: "center", justifyContent: "center",
          color: iconColor, overflow: "hidden",
        }}>
          {p.imageUrl
            ? <img src={p.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : (props.icon ?? <IconPlayer size={20} />)
          }
        </div>

        {/* Name + meta */}
        <div style={{ flex: "1 1 auto", minWidth: 0 }}>
          <div style={{
            fontWeight: 900, fontSize: "var(--fs-large)",
            color: isDead ? theme.colors.muted : theme.colors.text,
            whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
            lineHeight: 1.25,
            textDecoration: isDead ? "line-through" : "none",
          }}>
            {p.characterName}
            {p.playerName ? (
              <span style={{ fontWeight: 600, fontSize: "var(--fs-small)", color: theme.colors.muted, marginLeft: 6 }}>
                ({p.playerName})
              </span>
            ) : null}
          </div>
          {metaLine ? (
            <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginTop: 1, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
              {metaLine}
            </div>
          ) : null}
        </div>

        {/* Movement · Focus · HP */}
        <div style={{ flex: "0 1 auto", display: "flex", alignItems: "center", gap: 12, flexWrap: "wrap", marginLeft: "auto" }}>
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconMovement size={18} style={{ opacity: 0.55, color: theme.colors.muted }} />
            <span style={{ fontWeight: 900, fontSize: "var(--fs-medium)", color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>
              {p.movement}ft
            </span>
          </span>
          {props.onPatchFocus ? (
            <ResourcePopover
              label="Focus"
              current={p.focusCurrent}
              max={p.focusMax}
              icon={<IconFocus size={20} style={{ color: "#7dd3fc" }}/>}
              onChange={props.onPatchFocus}
            />
          ) : (
            <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
              <IconFocus size={20} style={{ opacity: 0.55, color: theme.colors.muted }} />
              <span style={{ fontWeight: 900, fontSize: "var(--fs-medium)", color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>
                {p.focusCurrent}/{p.focusMax}
              </span>
            </span>
          )}
          {p.investitureCurrent != null && props.onPatchInvestiture ? (
            <ResourcePopover
              label="Investiture"
              current={p.investitureCurrent}
              max={p.investitureMax ?? 0}
              icon={<span style={{ color: "#f59e0b", fontSize: 20, lineHeight: 1 }}>✦</span>}
              onChange={props.onPatchInvestiture}
            />
          ) : null}
          <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
            <IconHeart size={14} style={{ color: "#f87171" }} />
            <span style={{ fontWeight: 900, fontSize: "var(--fs-medium)", color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>
              {cur}/{max}
              {tempHp ? <span style={{ color: theme.colors.accentHighlight, marginLeft: 3, fontSize: "var(--fs-small)" }}>+{tempHp}</span> : null}
            </span>
          </span>
        </div>

        {/* Action area */}
        {props.actions !== null && (
          <div style={{ flex: "0 0 auto", display: "flex", alignItems: "center", gap: 4, marginLeft: "auto" }} onClick={(e) => e.stopPropagation()}>
            {hasLegacyActions ? props.actions : null}
            {!hasLegacyActions && props.primaryAction != null ? props.primaryAction : null}
            <div style={{ position: "relative", display: "inline-flex" }}>
              <IconButton
                title="Conditions"
                variant="ghost"
                size="sm"
                onClick={() => dispatch({ type: "openDrawer", drawer: { type: "playerConditions", playerId: p.id } })}
              >
                <IconConditions />
              </IconButton>
              {(p.conditions?.length ?? 0) > 0 && (
                <span style={{
                  position: "absolute", top: -4, right: -4,
                  minWidth: 14, height: 14, borderRadius: 999,
                  background: theme.colors.accentPrimary,
                  color: "#fff",
                  fontSize: 9, fontWeight: 900, lineHeight: "14px",
                  textAlign: "center", padding: "0 3px",
                  pointerEvents: "none",
                }}>
                  {p.conditions!.length}
                </span>
              )}
            </div>
            {showMenu ? <RowMenu items={props.menuItems!} /> : null}
          </div>
        )}
      </div>

      {/* HP bar — full width, indented to align with name */}
      <div style={{ paddingLeft: 46 }}>
        <div style={{ position: "relative", height: 6, borderRadius: 999, background: withAlpha(theme.colors.shadowColor, 0.4), overflow: "hidden" }}>
          <div style={{
            position: "absolute", inset: 0,
            width: `${Math.max(0, Math.min(1, pct)) * 100}%`,
            background: barColor, borderRadius: 999,
            transition: "width 150ms ease",
          }} />
          {tempHp > 0 && (
            <div style={{
              position: "absolute", top: 0, bottom: 0,
              left: `${Math.min(1, pct) * 100}%`,
              width: `${Math.min(1 - pct, tempHp / max) * 100}%`,
              background: theme.colors.accentHighlight,
              opacity: 0.8, borderRadius: 999,
            }} />
          )}
        </div>
      </div>

      {/* Injuries */}
      <div style={{ paddingLeft: 46 }}>
        <PlayerInjuries playerId={p.id} injuryCount={p.injuryCount ?? 0} />
      </div>

      {/* Conditions */}
      <PlayerConditions conditions={p.conditions ?? []} />
    </div>
  );
}
