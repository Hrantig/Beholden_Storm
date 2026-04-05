import React from "react";
import type { AttackOverride, Combatant } from "@/domain/types/domain";
import { theme } from "@/theme/theme";
import { Panel } from "@/ui/Panel";
import { IconButton } from "@/ui/IconButton";
import { IconPencil, IconConditions } from "@/icons/index";
import { CharacterSheetPanel, type CharacterSheetStats } from "@/components/CharacterSheet";
import type { MonsterDetail } from "@/domain/types/compendium";
import { MonsterActions } from "@/views/CombatView/components/MonsterActions";
import { MonsterTraits } from "@/views/CombatView/components/MonsterTraits";
import type { Player } from "@/domain/types/domain";

import { CombatantConditionsSection } from "@/views/CombatView/panels/CombatantDetailsPanel/components/CombatantConditionsSection";
import { useCharacterSheetStats } from "@/views/CombatView/panels/CombatantDetailsPanel/hooks/useCharacterSheetStats";

function StatRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: 8 }}>
      <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: theme.colors.muted, whiteSpace: "nowrap" }}>{label}</span>
      <span style={{ fontSize: "var(--fs-medium)", fontWeight: 900, color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>{value}</span>
    </div>
  );
}

function PlayerStatBlock({ player }: { player: Player }) {
  return (
    <div style={{
      display: "grid", gap: 6,
      borderRadius: 12,
      border: `1px solid ${theme.colors.panelBorder}`,
      background: theme.colors.panelBg,
      padding: "10px 14px",
    }}>
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
    </div>
  );
}

export type CombatantDetailsCtx = {
  isNarrow: boolean;
  selectedMonster: MonsterDetail | null;
  playerName: string | null;
  player: Player | null;
  roster: Combatant[];
  activeForCaster: Combatant | null;
  currentRound: number;
  showHpActions: boolean;
  onChangeAttack: (actionName: string, patch: AttackOverride) => void;
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

function buildCreatureTypeLine(monster: MonsterDetail | null): string | null {
  if (!monster) return null;
  const raw = (monster.raw_json ?? monster) as Record<string, unknown>;

  const sizeMap: Record<string, string> = {
    T: "Tiny", S: "Small", M: "Medium", L: "Large", H: "Huge", G: "Gargantuan",
  };
  const sizeRaw = String(raw.size ?? "").trim();
  const size = sizeMap[sizeRaw] ?? sizeRaw;

  const type = (() => {
    const t = raw.typeFull ?? raw.type ?? raw.typeKey;
    if (!t) return "";
    if (typeof t === "string") return t;
    if (typeof t === "object" && t !== null) {
      const o = t as Record<string, unknown>;
      const base = typeof o.type === "string" ? o.type : "";
      const tags = Array.isArray(o.tags) ? (o.tags as unknown[]).map(String).join(", ") : "";
      return tags ? `${base} (${tags})` : base;
    }
    return "";
  })();

  const align = (() => {
    const alignMap: Record<string, string> = {
      L: "lawful", N: "neutral", C: "chaotic", G: "good", E: "evil", U: "unaligned", A: "any",
    };
    const a = raw.alignment;
    if (!a) return "";
    if (typeof a === "string") return a;
    if (Array.isArray(a)) return a.map((x: unknown) => alignMap[String(x)] ?? String(x).toLowerCase()).join(" ");
    return "";
  })();

  const creature = [size, type].filter(Boolean).join(" ");
  return [creature, align].filter(Boolean).join(", ") || null;
}

export function CombatantDetailsPanel(props: Props) {
  const { roleTitle, role, combatant, ctx } = props;

  const selected = combatant ?? null;
  const isMonster = selected?.baseType === "monster" || (selected?.baseType === "inpc" && !!ctx.selectedMonster);
  const isPlayer = selected?.baseType === "player";
  const titleMain = selected ? (selected.label || selected.name || "(Unnamed)") : "No selection";
  const monsterBaseName = isMonster ? selected!.name.trim() : "";
  const showMonsterBaseName = isMonster && monsterBaseName &&
    monsterBaseName.toLowerCase() !== titleMain.toLowerCase();

  const creatureTypeLine = isMonster ? buildCreatureTypeLine(ctx.selectedMonster) : null;

  const sheetStats: CharacterSheetStats | null = useCharacterSheetStats({
    combatant: selected,
    selectedMonster: ctx.selectedMonster,
  });

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
            {selected ? (
              isMonster ? (
                showMonsterBaseName ? (
                  <span style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", fontWeight: 900, flexShrink: 0 }}>({monsterBaseName})</span>
                ) : null
              ) : isPlayer ? (
                <span style={{ color: theme.colors.muted, fontSize: "var(--fs-medium)", fontWeight: 900, flexShrink: 0 }}>
                  ({ctx.playerName || "Player"})
                </span>
              ) : null
            ) : null}
          </div>
          {creatureTypeLine ? (
            <span style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", fontWeight: 600, letterSpacing: 0.2 }}>
              {creatureTypeLine}
            </span>
          ) : null}
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
          {sheetStats ? <CharacterSheetPanel stats={sheetStats} /> : null}
          {isPlayer && ctx.player ? <PlayerStatBlock player={ctx.player} /> : null}

          <CombatantConditionsSection
            selected={selected}
            role={role}
            roster={ctx.roster ?? []}
            currentRound={ctx.currentRound}
            onCommit={(next) => ctx.onUpdate({ conditions: next })}
          />

          {ctx.selectedMonster ? (
            <MonsterActions
              monster={ctx.selectedMonster}
              attackOverrides={combatant?.attackOverrides as Record<string, AttackOverride> | null | undefined}
              onChangeAttack={ctx.onChangeAttack}
            />
          ) : null}

          {ctx.selectedMonster ? (
            <MonsterTraits
              monster={ctx.selectedMonster}
            />
          ) : null}
        </div>
      )}
    </Panel>
  );
}
