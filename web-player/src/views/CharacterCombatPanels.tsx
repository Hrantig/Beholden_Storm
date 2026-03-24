import React from "react";
import { C } from "@/lib/theme";
import { IconInitiative, IconShield, IconSpeed } from "@/icons";
import { MiniStat, Panel, PanelTitle } from "@/views/CharacterViewParts";
import { abilityMod, formatModifier } from "@/views/CharacterSheetUtils";
import {
  type CharacterDataLike,
  type InventoryItem,
  type ProficiencyMapLike,
  addsAbilityModToOffhandDamage,
  formatItemDamageType,
  formatItemProperties,
  getEquipState,
  hasItemProperty,
  hasWeaponProficiency,
  isRangedWeapon,
  isWeaponItem,
  weaponAbilityMod,
  weaponDamageDice,
} from "@/views/CharacterInventory";

export interface CharacterCombatPanelsProps {
  effectiveAc: number;
  speed: number;
  dexScore: number | null;
  strScore: number | null;
  pb: number;
  passivePerc: number;
  passiveInv: number;
  accentColor: string;
  inventory: InventoryItem[];
  prof?: ProficiencyMapLike | null;
  characterData?: CharacterDataLike | null;
}

export function CharacterCombatPanels({
  effectiveAc,
  speed,
  dexScore,
  strScore,
  pb,
  passivePerc,
  passiveInv,
  accentColor,
  inventory,
  prof,
  characterData,
}: CharacterCombatPanelsProps) {
  const actionItems = inventory.filter((it) => getEquipState(it) !== "backpack" && isWeaponItem(it));
  const strMod = abilityMod(strScore);
  const unarmedToHit = strMod + pb;
  const unarmedDmg = 1 + strMod;

  return (
    <>
      <Panel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
          <MiniStat label="Armor Class" value={String(effectiveAc)} accent={accentColor} icon={<IconShield size={11} />} />
          <MiniStat label="Speed" value={`${speed} ft`} icon={<IconSpeed size={11} />} />
          <MiniStat label="Initiative" value={formatModifier(abilityMod(dexScore))} accent={accentColor} icon={<IconInitiative size={11} />} />
          <MiniStat label="Prof. Bonus" value={`+${pb}`} accent={accentColor} />
          <MiniStat label="Passive Perc." value={String(passivePerc)} />
          <MiniStat label="Passive Inv." value={String(passiveInv)} />
        </div>
      </Panel>

      <Panel>
        <PanelTitle color={accentColor}>Actions</PanelTitle>
        <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", marginBottom: 6 }}>
          {(["ATTACK", "RANGE", "HIT / DC", "DAMAGE / NOTES"] as const).map((h) => (
            <div key={h} style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, paddingBottom: 4, borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
              {h}
            </div>
          ))}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
          {actionItems.map((it) => {
            const state = getEquipState(it);
            const attackState = state === "mainhand-2h" ? "mainhand-2h" : state === "offhand" ? "offhand" : "mainhand-1h";
            const dmg = weaponDamageDice(it, attackState);
            const ability = weaponAbilityMod(it, { strScore, dexScore });
            const proficient = hasWeaponProficiency(it, prof ?? undefined);
            const toHit = ability + (proficient ? pb : 0);
            const damageAbility = attackState === "offhand" && !addsAbilityModToOffhandDamage(it, characterData) ? 0 : ability;
            const damageType = formatItemDamageType(it.dmgType);
            const props = formatItemProperties(it.properties);
            const isReach = hasItemProperty(it, "R");
            const rangeLabel = isRangedWeapon(it) ? (it.properties?.find((p) => /^\d/.test(p)) ?? "Range") : `${isReach ? "10" : "5"} ft.`;
            const dmgText = dmg ? `${dmg}${damageAbility === 0 ? "" : `${damageAbility >= 0 ? "+" : ""}${damageAbility}`}${damageType ? ` ${damageType}` : ""}` : "-";
            const modeLabel = attackState === "mainhand-2h" ? "2H" : attackState === "offhand" ? "Offhand" : null;

            return (
              <div key={`${it.id}:${attackState}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", alignItems: "center", padding: "6px 0", borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
                <div style={{ minWidth: 0 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span style={{ fontSize: 13, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                    {modeLabel && <span style={{ fontSize: 9, fontWeight: 800, color: accentColor, border: `1px solid ${accentColor}44`, background: `${accentColor}18`, borderRadius: 999, padding: "1px 5px" }}>{modeLabel}</span>}
                    {!proficient && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>No proficiency</span>}
                  </div>
                  <div style={{ fontSize: 10, color: C.muted }}>{isWeaponItem(it) ? "Melee Weapon" : it.type ?? ""}</div>
                </div>
                <div style={{ fontSize: 12, color: C.muted, textAlign: "center", whiteSpace: "nowrap" }}>{rangeLabel}</div>
                <div
                  style={{
                    fontSize: 18,
                    fontWeight: 900,
                    color: C.text,
                    textAlign: "center",
                    minWidth: 36,
                    border: `1px solid ${proficient ? accentColor + "55" : "rgba(255,255,255,0.15)"}`,
                    borderRadius: 8,
                    padding: "3px 6px",
                    background: "rgba(255,255,255,0.04)",
                  }}
                >
                  {formatModifier(toHit)}
                </div>
                <div>
                  <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{dmgText}</div>
                  {props && <div style={{ fontSize: 11, color: C.muted }}>{props}</div>}
                </div>
              </div>
            );
          })}

          <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", alignItems: "center", padding: "6px 0" }}>
            <div>
              <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Unarmed Strike</div>
              <div style={{ fontSize: 10, color: C.muted }}>Melee Attack</div>
            </div>
            <div style={{ fontSize: 12, color: C.muted, textAlign: "center", whiteSpace: "nowrap" }}>5 ft.</div>
            <div style={{ fontSize: 18, fontWeight: 900, color: C.text, textAlign: "center", minWidth: 36, border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "3px 6px", background: "rgba(255,255,255,0.04)" }}>
              {formatModifier(unarmedToHit)}
            </div>
            <div>
              <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{unarmedDmg}</div>
              <div style={{ fontSize: 11, color: C.muted }}>Bludgeoning</div>
            </div>
          </div>
        </div>
      </Panel>
    </>
  );
}
