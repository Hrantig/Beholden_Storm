import React from "react";
import { C } from "@/lib/theme";
import { Panel, PanelTitle, ProfDot, Tooltip } from "@/views/CharacterViewParts";
import type { AbilKey, ProficiencyMap, TaggedItem } from "@/views/CharacterSheetTypes";
import { ABILITY_FULL, ABILITY_LABELS, ALL_SKILLS } from "@/views/CharacterSheetConstants";
import { hasNamedProficiency } from "@/views/CharacterSheetUtils";
import { formatWeaponProficiencyName } from "@/views/CharacterInventory";

export interface CharacterAbilitiesPanelsProps {
  scores: Record<AbilKey, number | null>;
  pb: number;
  prof?: ProficiencyMap | null;
  accentColor: string;
  stealthDisadvantage: boolean;
  nonProficientArmorPenalty: boolean;
  mod: (score: number | null) => number;
  fmtMod: (value: number) => string;
}

export function CharacterAbilitiesPanels({
  scores,
  pb,
  prof,
  accentColor,
  stealthDisadvantage,
  nonProficientArmorPenalty,
  mod,
  fmtMod,
}: CharacterAbilitiesPanelsProps) {
  return (
    <>
      <Panel>
        <PanelTitle color={accentColor}>Abilities &amp; Saves</PanelTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 18, rowGap: 8, width: "100%" }}>
          {(["str", "dex", "con"] as AbilKey[]).flatMap((leftKey, i) => {
            const rightKey = (["int", "wis", "cha"] as AbilKey[])[i];
            return ([leftKey, rightKey] as AbilKey[]).map((k) => {
              const score = scores[k];
              const m = mod(score);
              const isProfSave = prof ? hasNamedProficiency(prof.saves, ABILITY_FULL[k]) : false;
              const save = m + (isProfSave ? pb : 0);
              const showSaveDisadvantage = nonProficientArmorPenalty && (k === "str" || k === "dex");
              return (
                <div key={k} style={{ minWidth: 0 }}>
                  <div style={{ display: "grid", gridTemplateColumns: "44px minmax(56px, 1fr) 40px 40px", columnGap: 10, alignItems: "center" }}>
                    <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: isProfSave ? accentColor : C.muted }}>
                      {ABILITY_LABELS[k]}
                    </div>
                    <div style={{ padding: "8px 2px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: `1px solid ${isProfSave ? accentColor + "55" : "rgba(255,255,255,0.10)"}`, textAlign: "center", fontSize: 14, fontWeight: 900, color: isProfSave ? accentColor : C.text }}>
                      {score ?? "-"}
                    </div>
                    <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center", color: C.text }}>{fmtMod(m)}</div>
                    <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center", color: showSaveDisadvantage ? "#f87171" : isProfSave ? accentColor : C.text, position: "relative" }}>
                      <span title={showSaveDisadvantage ? "Disadvantage while wearing armor or a shield without proficiency" : undefined}>
                        {fmtMod(save)}{showSaveDisadvantage ? " D" : ""}
                      </span>
                      {isProfSave && <span style={{ position: "absolute", top: -2, right: 0, width: 5, height: 5, borderRadius: "50%", background: accentColor }} />}
                    </div>
                  </div>
                </div>
              );
            });
          })}
        </div>
      </Panel>

      <Panel>
        <PanelTitle color={accentColor}>Skills</PanelTitle>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 18, rowGap: 2 }}>
          {ALL_SKILLS.map(({ name, abil }) => {
            const isProfSkill = prof ? hasNamedProficiency(prof.skills, name) : false;
            const bonus = mod(scores[abil]) + (isProfSkill ? pb : 0);
            const src = prof?.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())?.source;
            const showArmorPenalty = nonProficientArmorPenalty && (abil === "str" || abil === "dex");
            const showStealthDisadvantage = name === "Stealth" && stealthDisadvantage;
            const showDisadvantage = showArmorPenalty || showStealthDisadvantage;
            return (
              <div
                key={name}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  padding: "3px 4px",
                  borderRadius: 4,
                  minWidth: 0,
                }}
              >
                <ProfDot filled={isProfSkill} color={C.green} />
                <span
                  style={{
                    fontSize: 9,
                    fontWeight: 700,
                    color: "rgba(160,180,220,0.45)",
                    letterSpacing: "0.04em",
                    width: 24,
                    textAlign: "center",
                  }}
                >
                  {ABILITY_LABELS[abil]}
                </span>
                <span
                  style={{
                    fontSize: 12,
                    color: isProfSkill ? C.text : C.muted,
                    flex: 1,
                    fontWeight: isProfSkill ? 600 : 400,
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    minWidth: 0,
                  }}
                >
                  <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                  {showDisadvantage && (
                    <span
                      title={showArmorPenalty ? "Disadvantage while wearing armor or a shield without proficiency" : "Disadvantage on Stealth checks from equipped armor"}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        justifyContent: "center",
                        minWidth: 18,
                        height: 18,
                        borderRadius: 999,
                        border: "1px solid rgba(248,113,113,0.55)",
                        background: "rgba(248,113,113,0.14)",
                        color: "#f87171",
                        fontSize: 11,
                        fontWeight: 800,
                        lineHeight: 1,
                        flexShrink: 0,
                      }}
                    >
                      D
                    </span>
                  )}
                </span>
                <span
                  style={{
                    fontSize: 13,
                    fontWeight: 700,
                    minWidth: 26,
                    textAlign: "right",
                    color: showDisadvantage ? "#f87171" : isProfSkill ? C.green : C.text,
                  }}
                >
                  {isProfSkill && src ? <Tooltip text={src}>{fmtMod(bonus)}{showDisadvantage ? " D" : ""}</Tooltip> : `${fmtMod(bonus)}${showDisadvantage ? " D" : ""}`}
                </span>
              </div>
            );
          })}
        </div>
      </Panel>

      {prof && (() => {
        const sections = [
          { label: "Armor", items: prof.armor, color: "#a78bfa" },
          { label: "Weapons", items: prof.weapons, color: "#f87171" },
          { label: "Tools", items: prof.tools, color: "#fb923c" },
          { label: "Languages", items: prof.languages, color: "#60a5fa" },
        ].filter((s) => s.items.length > 0);
        if (!sections.length) return null;
        return (
          <Panel>
            <PanelTitle color={accentColor}>Proficiencies &amp; Languages</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {sections.map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                    {s.label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                    {s.items.map((item, i) => (
                      <Tooltip key={i} text={item.source}>
                        <span
                          style={{
                            fontSize: 12,
                            padding: "3px 9px",
                            borderRadius: 5,
                            cursor: "default",
                            background: s.color + "18",
                            border: `1px solid ${s.color}44`,
                            color: s.color,
                            fontWeight: 600,
                          }}
                        >
                          {s.label === "Weapons" ? formatWeaponProficiencyName(item.name) : item.name}
                        </span>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Panel>
        );
      })()}
    </>
  );
}
