import * as React from "react";
import type { Combatant, CombatPhase } from "@/domain/types/domain";
import type { PhaseGroups } from "@/views/CombatView/hooks/useCombatViewModel";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { Button } from "@/ui/Button";

type Props = {
  phaseGroups: PhaseGroups;
  currentPhase: CombatPhase;
  declarationsLocked: boolean;
  round: number;
  activeId: string | null;
  targetId: string | null;
  onSelectSpotlight: (id: string) => void;
  onSelectTarget: (id: string) => void;
  onAdvancePhase: () => void;
  onTogglePhase: (combatantId: string, phase: "fast" | "slow") => void;
  bulkMode: boolean;
  bulkSelectedIds: Set<string>;
  onToggleBulkSelect: (id: string) => void;
  onToggleReaction: (id: string) => void;
};

const NEXT_PHASE_LABEL: Record<CombatPhase, string> = {
  "fast-pc": "Fast NPCs",
  "fast-npc": "Slow PCs",
  "slow-pc": "Slow NPCs",
  "slow-npc": "New Round",
};

const PHASE_SECTION_KEY: Record<CombatPhase, keyof PhaseGroups> = {
  "fast-pc": "fastPcs",
  "fast-npc": "fastNpcs",
  "slow-pc": "slowPcs",
  "slow-npc": "slowNpcs",
};

function isUnconscious(c: Combatant): boolean {
  return c.conditions?.some((cond) => cond.key === "unconscious") ?? false;
}

function PhaseToggleButton({
  combatant,
  declarationsLocked,
  onTogglePhase,
}: {
  combatant: Combatant;
  declarationsLocked: boolean;
  onTogglePhase: (id: string, phase: "fast" | "slow") => void;
}) {
  if (combatant.dualPhase) {
    return (
      <span style={{
        fontSize: "var(--fs-small)", color: "#f59e0b", fontWeight: 700,
        padding: "2px 6px", borderRadius: 4, border: "1px solid #f59e0b",
        whiteSpace: "nowrap",
      }}>
        F+S
      </span>
    );
  }

  const unconscious = isUnconscious(combatant);
  const currentPhase = unconscious ? "slow" : (combatant.phase ?? "slow");
  const label = currentPhase === "fast" ? "F" : "S";
  const disabled = declarationsLocked || unconscious;
  const nextPhase: "fast" | "slow" = currentPhase === "fast" ? "slow" : "fast";

  return (
    <button
      onClick={(e) => { e.stopPropagation(); if (!disabled) onTogglePhase(combatant.id, nextPhase); }}
      disabled={disabled}
      title={unconscious ? "Forced slow (unconscious)" : declarationsLocked ? "Declarations locked" : `Switch to ${nextPhase}`}
      style={{
        width: 28, height: 28, borderRadius: 6,
        border: `1px solid ${disabled ? theme.colors.panelBorder : currentPhase === "fast" ? "#f59e0b" : theme.colors.panelBorder}`,
        background: currentPhase === "fast" ? "rgba(245,158,11,0.15)" : "transparent",
        color: disabled ? theme.colors.muted : currentPhase === "fast" ? "#f59e0b" : theme.colors.muted,
        fontWeight: 700, fontSize: "var(--fs-small)",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.5 : 1,
        display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0,
      }}
    >
      {label}
    </button>
  );
}

function ConditionChips({ combatant }: { combatant: Combatant }) {
  const conditions = combatant.conditions ?? [];
  if (!conditions.length) return null;
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 3 }}>
      {conditions.map((cond, i) => (
        <span key={`${cond.key}-${i}`} style={{
          fontSize: 10, padding: "1px 5px", borderRadius: 4,
          background: cond.key === "unconscious" ? "rgba(239,68,68,0.2)" : "rgba(255,255,255,0.08)",
          border: `1px solid ${cond.key === "unconscious" ? theme.colors.red : theme.colors.panelBorder}`,
          color: cond.key === "unconscious" ? theme.colors.red : theme.colors.muted,
          whiteSpace: "nowrap",
        }}>
          {cond.key}
        </span>
      ))}
    </div>
  );
}

function CombatantRow({
  combatant,
  isTarget,
  isSpotlight,
  declarationsLocked,
  onSelectSpotlight,
  onSelectTarget,
  onTogglePhase,
  bulkMode,
  bulkSelectedIds,
  onToggleBulkSelect,
  onToggleReaction,
  sectionKey
}: {
  combatant: Combatant;
  isTarget: boolean;
  isSpotlight: boolean;
  declarationsLocked: boolean;
  onSelectSpotlight: (id: string) => void;
  onSelectTarget: (id: string) => void;
  onTogglePhase: (id: string, phase: "fast" | "slow") => void;
  bulkMode: boolean;
  bulkSelectedIds: Set<string>;
  onToggleBulkSelect: (id: string) => void;
  onToggleReaction: (id: string) => void;
  sectionKey: keyof PhaseGroups;
}) {
  const displayName = combatant.label
    ? `${combatant.name} (${combatant.label})`
    : combatant.name;

  return (
    <div
      onClick={() => bulkMode ? onToggleBulkSelect(combatant.id) : onSelectSpotlight(combatant.id)}
      style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "6px 10px", borderRadius: 8, cursor: "pointer",
        background: bulkMode 
          ? bulkSelectedIds.has(combatant.id) ? "rgba(239,68,68,0.15)" : "transparent"
          : isSpotlight ? theme.colors.accentHighlightBg : "transparent",
        border: `1px solid ${
          bulkMode
            ? bulkSelectedIds.has(combatant.id) ? theme.colors.red : "transparent"
            : isSpotlight ? theme.colors.accentHighlightBorder : "transparent"
        }`,
        transition: "background 100ms",
      }}
    >
      {/* Name + conditions */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{
          fontWeight: isSpotlight ? 700 : 600,
          color: isSpotlight ? theme.colors.accentPrimary : theme.colors.text,
          fontSize: "var(--fs-medium)",
          overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap",
        }}>
          {displayName}
        </div>
        <ConditionChips combatant={combatant} />
      </div>

      {/* AP indicators */}
      {(() => {
        const maxAp = combatant.dualPhase
        ? (sectionKey === "fastNpcs" ? 2 : 3)
        : (combatant.phase === "fast" ? 2 : 3);
        const remaining = Math.max(0, maxAp - (combatant.actionPointsUsed ?? 0));
        const used = combatant.actionPointsUsed ?? 0;
        return (
          <div style={{ display: "flex", gap: 2, flexShrink: 0 }}>
            {Array.from({ length: maxAp }).map((_, i) => (
              <span key={i} style={{
                fontSize: "var(--fs-small)",
                color: i < remaining ? theme.colors.accentPrimary : theme.colors.panelBorder,
                opacity: i < remaining ? 1 : 0.3,
              }}>
                ▶
              </span>
            ))}
          </div>
        );
      })()}

      {/* Reaction indicator */}
      <button
        onClick={(e) => { e.stopPropagation(); onToggleReaction(combatant.id); }}
        title={combatant.usedReaction ? "Reaction spent" : "Reaction available"}
        style={{
          background: "transparent",
          border: "none",
          cursor: "pointer",
          fontSize: "var(--fs-small)",
          color: combatant.usedReaction ? theme.colors.panelBorder : theme.colors.accentPrimary,
          opacity: combatant.usedReaction ? 0.3 : 1,
          flexShrink: 0,
          padding: 0,
        }}
      >
        ↺
      </button>

      {/* HP */}
      <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, whiteSpace: "nowrap", flexShrink: 0 }}>
        {combatant.hpCurrent ?? "?"}/{combatant.hpMax ?? "?"}
      </div>

      {/* Phase toggle */}
      <PhaseToggleButton
        combatant={combatant}
        declarationsLocked={declarationsLocked}
        onTogglePhase={onTogglePhase}
      />

      {/* Target button */}
      <button
        onClick={(e) => { e.stopPropagation(); onSelectTarget(combatant.id); }}
        title="Set as target"
        style={{
          background: isTarget ? theme.colors.accentPrimary : "transparent",
          border: `1px solid ${isTarget ? theme.colors.accentPrimary : theme.colors.panelBorder}`,
          borderRadius: 4, width: 22, height: 22, cursor: "pointer",
          color: isTarget ? "white" : theme.colors.muted,
          fontSize: "var(--fs-large)", display: "flex", alignItems: "center",
          justifyContent: "center", flexShrink: 0,
        }}
      >
        ◎
      </button>

    </div>
  );
}

function PhaseSection({
  title,
  isFast,
  isActive,
  combatants,
  activeId,
  targetId,
  declarationsLocked,
  onSelectSpotlight,
  onSelectTarget,
  onTogglePhase,
  bulkMode,
  bulkSelectedIds,
  onToggleBulkSelect,
  onToggleReaction,
  sectionKey
}: {
  title: string;
  isFast: boolean;
  isActive: boolean;
  combatants: Combatant[];
  activeId: string | null;
  targetId: string | null;
  declarationsLocked: boolean;
  onSelectSpotlight: (id: string) => void;
  onSelectTarget: (id: string) => void;
  onTogglePhase: (id: string, phase: "fast" | "slow") => void;
  bulkMode: boolean;
  bulkSelectedIds: Set<string>;
  onToggleBulkSelect: (id: string) => void;
  onToggleReaction: (id: string) => void;
  sectionKey: keyof PhaseGroups
}) {
  return (
    <div>
      <div style={{
        fontSize: "var(--fs-small)", fontWeight: 900, letterSpacing: "0.08em",
        padding: "4px 10px 4px",
        color: isActive ? theme.colors.accentPrimary : theme.colors.muted,
        borderBottom: `1px solid ${isActive ? theme.colors.accentPrimary : theme.colors.panelBorder}`,
        marginBottom: 4,
      }}>
        {isFast ? "⚡ " : ""}{title}
        {isActive && (
          <span style={{
            marginLeft: 8, fontSize: 10, padding: "1px 6px", borderRadius: 4,
            background: `${theme.colors.accentPrimary}22`,
            border: `1px solid ${theme.colors.accentPrimary}`,
            color: theme.colors.accentPrimary,
          }}>
            ACTIVE
          </span>
        )}
      </div>

      {combatants.length === 0 ? (
        <div style={{ padding: "4px 10px 8px", color: theme.colors.muted, fontSize: "var(--fs-small)", fontStyle: "italic" }}>
          —
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {combatants.map((c) => (
            <CombatantRow
            key={c.id}
            combatant={c}
            isSpotlight={c.id === activeId}
            isTarget={c.id === targetId}
            declarationsLocked={declarationsLocked}
            onSelectSpotlight={onSelectSpotlight}
            onSelectTarget={onSelectTarget}
            onTogglePhase={onTogglePhase}
            bulkMode={bulkMode}
            bulkSelectedIds={bulkSelectedIds}
            onToggleBulkSelect={onToggleBulkSelect}
            onToggleReaction={onToggleReaction}
            sectionKey={sectionKey}
          />
          ))}
        </div>
      )}
    </div>
  );
}

export function PhaseOrderPanel({
  phaseGroups,
  declarationsLocked,
  round,
  activeId,
  targetId,
  onSelectSpotlight,
  onSelectTarget,
  onAdvancePhase,
  onTogglePhase,
  bulkMode,
  bulkSelectedIds,
  onToggleBulkSelect,
  onToggleReaction,
  currentPhase
}: Props) {
  const activeSectionKey = PHASE_SECTION_KEY[currentPhase];

  return (
    <Panel
      storageKey="phase-order"
      title={
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%" }}>
          <span style={{ fontSize: "var(--fs-title)", fontWeight: 900, color: theme.colors.text }}>
            Round {round}
          </span>
          <Button
            variant="primary"
            onClick={(e) => { e.stopPropagation(); onAdvancePhase(); }}
            style={{ fontSize: "var(--fs-small)", padding: "6px 12px" }}
          >
            {NEXT_PHASE_LABEL[currentPhase]} →
          </Button>
        </div>
      }
    >
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {(["fastPcs", "fastNpcs", "slowPcs", "slowNpcs"] as const).map((key) => {
          const phaseKey = Object.entries(PHASE_SECTION_KEY).find(([, v]) => v === key)?.[0] as CombatPhase;
          const isFast = key.startsWith("fast");
          const titles: Record<string, string> = {
            fastPcs: "Fast PCs", fastNpcs: "Fast NPCs",
            slowPcs: "Slow PCs", slowNpcs: "Slow NPCs",
          };
          return (
            <PhaseSection
              key={key}
              title={titles[key]}
              isFast={isFast}
              isActive={activeSectionKey === key}
              combatants={phaseGroups[key]}
              activeId={activeId}
              targetId={targetId}
              declarationsLocked={declarationsLocked}
              onSelectSpotlight={onSelectSpotlight}
              onSelectTarget={onSelectTarget}
              onTogglePhase={onTogglePhase}
              bulkMode={bulkMode}
              bulkSelectedIds={bulkSelectedIds}
              onToggleBulkSelect={onToggleBulkSelect}
              onToggleReaction={onToggleReaction}
              sectionKey={key}
            />
          );
        })}
      </div>
    </Panel>
  );
}