import React from "react";
import type { Combatant } from "@/domain/types/domain";
import type { MonsterDetail } from "@/domain/types/compendium";
import type { CharacterSheetStats } from "@/components/CharacterSheet";
import {
  toFinite,
  parseSpeedVal,
  parseSpeedDisplay,
  parseSaves,
  buildMonsterInfoLines,
} from "@/utils/compendiumFormat";

export function useCharacterSheetStats(args: {
  combatant: Combatant | null;
  selectedMonster: MonsterDetail | null;
}) {
  const { combatant, selectedMonster } = args;

  return React.useMemo((): CharacterSheetStats | null => {
    if (!combatant) return null;

    // Return null for players — player stats are displayed separately in CombatantDetailsPanel.
    const isMonster = combatant.baseType === "monster" || combatant.baseType === "inpc";
    if (!isMonster) return null;

    const overrides = combatant.overrides;
    const hpMod = (() => {
      const n = Number(overrides.hpMaxBonus);
      return Number.isFinite(n) ? n : 0;
    })();

    const hpMax = toFinite(Math.max(1, Number(combatant.hpMax ?? 1) + hpMod), 0);
    const hpCur = toFinite(combatant.hpCurrent ?? 0, 0);
    const tempHp = Math.max(0, Number(overrides.tempHp ?? 0) || 0);

    // Fall back to selectedMonster itself if raw_json is absent —
    // mirrors MonsterStatblock's `m.raw_json ?? m` pattern.
    const detail = (selectedMonster?.raw_json ?? selectedMonster ?? {}) as Record<string, unknown>;
    const rawSpeed = detail["speed"] ?? selectedMonster?.speed;

    const movement = parseSpeedVal(rawSpeed);
    const speedDisplay = parseSpeedDisplay(rawSpeed);

    const abilities = {
      str: Number(selectedMonster?.str ?? detail["str"] ?? 10),
      dex: Number(selectedMonster?.dex ?? detail["dex"] ?? 10),
      con: Number(selectedMonster?.con ?? detail["con"] ?? 10),
      int: Number(selectedMonster?.int ?? detail["int"] ?? 10),
      wis: Number(selectedMonster?.wis ?? detail["wis"] ?? 10),
      cha: Number(selectedMonster?.cha ?? detail["cha"] ?? 10),
    } as const;

    const saves = parseSaves(detail["save"] ?? detail["saves"]);
    const infoLines = buildMonsterInfoLines(detail);

    const acRaw = Math.max(0, toFinite(combatant.ac ?? 10, 10));

    return { ac: acRaw, hpCur, hpMax, tempHp, speed: movement, speedDisplay, abilities, saves, infoLines };
  }, [
    combatant?.id,
    combatant?.hpCurrent,
    combatant?.hpMax,
    combatant?.ac,
    combatant?.overrides,
    selectedMonster?.id,
  ]);
}
