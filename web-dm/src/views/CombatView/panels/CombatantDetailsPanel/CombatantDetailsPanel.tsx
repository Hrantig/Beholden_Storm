import React from "react";
import type {Adversary, Combatant, Player } from "@/domain/types/domain";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { IconPencil, IconConditions } from "@/icons/index";
import { CombatantConditionsSection } from "@/views/CombatView/panels/CombatantDetailsPanel/components/CombatantConditionsSection";

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: theme.colors.muted, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: "var(--fs-medium)", fontWeight: 900, color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function StatBlock({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      display: "grid", gap: 6, borderRadius: 12,
      border: `1px solid ${theme.colors.panelBorder}`,
      background: theme.colors.panelBg,
      padding: "10px 14px",
    }}>
      {children}
    </div>
  );
}

function PlayerStatBlock({ player }: { player: Player }) {
  return (
    <StatBlock>
      <StatRow label="HP" value={`${player.hpCurrent} / ${player.hpMax}`} />
      <StatRow label="Focus" value={`${player.focusCurrent} / ${player.focusMax}`} />
      {(player.investitureMax ?? 0) > 0 && (
        <StatRow label="Investiture" value={`${player.investitureCurrent ?? 0} / ${player.investitureMax}`} />
      )}
      <StatRow label="Def Physical" value={player.defensePhysical} />
      <StatRow label="Def Cognitive" value={player.defenseCognitive} />
      <StatRow label="Def Spiritual" value={player.defenseSpiritual} />
      <StatRow label="Deflect" value={player.deflect} />
      <StatRow label="Movement" value={`${player.movement} ft`} />
      {player.injuryCount > 0 && (
        <StatRow label="Injuries" value={<span style={{ color: theme.colors.red }}>{player.injuryCount}</span>} />
      )}
    </StatBlock>
  );
}

function actionCostSymbol(cost: number, actionType?: string): string {
  if (actionType === "reaction") return "↺";
  switch (cost) {
    case 0: return "▷";
    case 1: return "▶";
    case 2: return "▶▶";
    case 3: return "▶▶▶";
    default: return `${cost}`;
  }
}

function AdversaryStatBlock({ adversary }: { adversary: Adversary }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
      {/* Subtitle */}
      <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>
        Tier {adversary.tier} · {adversary.adversaryType} · {adversary.size}
        {adversary.dualPhase && (
          <span style={{
            marginLeft: 8, padding: "1px 6px", borderRadius: 4, fontSize: 10,
            background: "rgba(245,158,11,0.15)", border: "1px solid #f59e0b", color: "#f59e0b",
          }}>
            Boss · Dual Phase
          </span>
        )}
      </div>

      {/* Core stats */}
      <StatBlock>
        <StatRow label="HP" value={`${adversary.hpRangeMin}–${adversary.hpRangeMax}`} />
        {adversary.focusMax > 0 && <StatRow label="Focus" value={adversary.focusMax} />}
        {(adversary.investitureMax ?? 0) > 0 && <StatRow label="Investiture" value={adversary.investitureMax} />}
        <StatRow label="Def Physical" value={adversary.defensePhysical} />
        <StatRow label="Def Cognitive" value={adversary.defenseCognitive} />
        <StatRow label="Def Spiritual" value={adversary.defenseSpiritual} />
        <StatRow label="Deflect" value={adversary.deflect} />
        <StatRow label="Movement" value={adversary.movement} />
      </StatBlock>

      {/* Features */}
      {adversary.features && adversary.features.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: "var(--fs-medium)", fontWeight: 900, color: theme.colors.muted, letterSpacing: "0.08em" }}>
            FEATURES
          </div>
          {adversary.features.map((f, i) => (
            <div key={i}>
              <span style={{fontSize: "var(--fs-medium)", fontWeight: 700, color: theme.colors.text }}>{f.name}. </span>
              <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
                {f.description.split('\n\n').map((para, j) => (
                  <p key={j} style={{ margin: "0 0 4px 0" }}>{para.trim()}</p>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}

      {/* Actions */}
      {adversary.actions && adversary.actions.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: "var(--fs-medium)", fontWeight: 900, color: theme.colors.muted, letterSpacing: "0.08em" }}>
            ACTIONS
          </div>
          {[...adversary.actions]
            // .sort((a, b) => {
            //   const order = (x: typeof a) =>
            //     x.actionType === "reaction" ? 0 : x.cost === 0 ? 1 : x.cost + 2;
            //   return order(a) - order(b);
            // })
            .map((action, i) => (
              <div key={i} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                  <span style={{ fontSize: "var(--fs-medium)", fontWeight: 900, color: theme.colors.accentPrimary }}>
                    {actionCostSymbol(action.cost, action.actionType)}
                  </span>
                  <span style={{fontSize: "var(--fs-medium)", fontWeight: 700, color: theme.colors.text }}>{action.name}</span>
                </div>
                <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", paddingLeft: 20 }}>
                  {action.description.split('\n\n').map((para, j) => (
                    <p key={j} style={{ margin: "0 0 4px 0" }}>{para.trim()}</p>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}

      {/* Additional features */}
      {adversary.additionalFeatures && adversary.additionalFeatures.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          <div style={{ fontSize: "var(--fs-medium)", fontWeight: 900, color: theme.colors.muted, letterSpacing: "0.08em" }}>
            SPECIAL
          </div>
          {adversary.additionalFeatures.map((f, i) => (
            <div key={i}>
              <span style={{ fontSize: "var(--fs-medium)", fontWeight: 700, color: theme.colors.text }}>{f.name}. </span>
              <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
                {f.description.split('\n\n').map((para, j) => (
                  <p key={j} style={{ margin: "0 0 4px 0" }}>{para.trim()}</p>
                ))}
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export type CombatantDetailsCtx = {
  isNarrow: boolean;
  selectedMonster: Adversary | null;
  playerName: string | null;
  player: Player | null;
  roster: Combatant[];
  activeForCaster: Combatant | null;
  currentRound: number;
  showHpActions: boolean;
  onUpdate: (patch: Record<string, unknown>) => void;
  onOpenOverrides: () => void;
  onOpenConditions: () => void;
};

type Props = {
  roleTitle: string;
  role: "active" | "target";
  combatant: Combatant | null;
  ctx: CombatantDetailsCtx;
};

export function CombatantDetailsPanel(props: Props) {
  const { roleTitle, role, combatant, ctx } = props;

  const selected = combatant ?? null;
  const isMonster = selected?.baseType === "monster" || selected?.baseType === "inpc";
  const isPlayer = selected?.baseType === "player";
  const titleMain = selected ? (selected.label || selected.name || "(Unnamed)") : "No selection";

  return (
    <Panel
      style={{ padding: "12px 14px" }}
      title={
        <div style={{ display: "flex", flexDirection: "column", gap: 2, width: "100%", minWidth: 0 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", width: "100%", gap: 6 }}>
            <span style={{ fontSize: "var(--fs-title)", fontWeight: 900 }}>
              {roleTitle ? <span style={{ color: theme.colors.accentPrimary }}>{roleTitle}: </span> : null}
              {titleMain}
            </span>
            {isPlayer && ctx.playerName && (
              <span style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", fontWeight: 900, flexShrink: 0 }}>
                ({ctx.playerName})
              </span>
            )}
          </div>
        </div>
      }
      actions={
        !selected ? null : (
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <IconButton title="Conditions" onClick={ctx.onOpenConditions}>
              <IconConditions size={18} title="Conditions" />
            </IconButton>
            <IconButton title="Overrides" onClick={ctx.onOpenOverrides}>
              <IconPencil size={18} title="Overrides" />
            </IconButton>
          </div>
        )
      }
    >
      {!selected ? (
        <div style={{ color: theme.colors.muted }}>Select a combatant.</div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {isPlayer && ctx.player && <PlayerStatBlock player={ctx.player} />}
          {isMonster && ctx.selectedMonster && <AdversaryStatBlock adversary={ctx.selectedMonster} />}

          <CombatantConditionsSection
            selected={selected}
            role={role}
            roster={ctx.roster ?? []}
            currentRound={ctx.currentRound}
            onCommit={(next) => ctx.onUpdate({ conditions: next })}
          />
        </div>
      )}
    </Panel>
  );
}