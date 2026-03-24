import React from "react";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import { Panel, PanelTitle } from "@/views/CharacterViewParts";
import { type InventoryItem, getEquipState, parseItemSpells } from "@/views/CharacterInventory";

interface ClassCounterDef {
  name: string;
  value: number;
  reset: string;
}

interface ClassRestDetail {
  id: string;
  name: string;
  hd: number | null;
  slotsReset?: string | null;
  autolevels: Array<{
    level: number;
    slots: number[] | null;
    counters: ClassCounterDef[];
  }>;
}

interface FetchedSpellDetail {
  id: string;
  name: string;
  level: number | null;
  school?: string | null;
  time?: string | null;
  range?: string | null;
  duration?: string | null;
  ritual?: boolean;
  concentration?: boolean;
  components?: string | null;
  text?: string | string[];
  classes?: string | null;
  damage?: { dice: string; type: string } | null;
  save?: string | null;
}

export function SpellSlotsPanel({ classDetail, level, usedSpellSlots, onSave, accentColor }: {
  classDetail: ClassRestDetail | null;
  level: number;
  usedSpellSlots: Record<string, number>;
  onSave: (next: Record<string, number>) => Promise<void>;
  accentColor: string;
}) {
  const slots = classDetail?.autolevels.find((al) => al.level === level)?.slots ?? null;
  if (!slots) return null;

  // slots[0] = cantrips, slots[1] = L1, ... slots[9] = L9
  const spellLevels = slots
    .map((count, i) => ({ level: i, count }))
    .filter(({ level: l, count }) => l > 0 && count > 0);

  if (!spellLevels.length) return null;

  async function toggleSlot(spellLevel: number, slotIndex: number) {
    const key = String(spellLevel);
    const used = usedSpellSlots[key] ?? 0;
    const max = slots![spellLevel] ?? 0;
    // If clicking a "used" slot (i < used) → restore it; clicking "available" slot → expend it
    const next = slotIndex < used ? slotIndex : Math.min(max, slotIndex + 1);
    await onSave({ ...usedSpellSlots, [key]: next });
  }

  async function longRest() {
    await onSave({});
  }

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <PanelTitle color="#a78bfa" style={{ margin: 0 }}>Spell Slots</PanelTitle>
        <button onClick={longRest} style={{
          fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
          background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa",
        }}>Long Rest</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {spellLevels.map(({ level: sl, count }) => {
          const used = usedSpellSlots[String(sl)] ?? 0;
          const remaining = count - used;
          const ordinals = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
          return (
            <div key={sl} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, minWidth: 30 }}>{ordinals[sl]}</div>
              <div style={{ display: "flex", gap: 5, flex: 1 }}>
                {Array.from({ length: count }).map((_, i) => {
                  const filled = i >= used; // filled = available, empty = expended
                  return (
                    <button
                      key={i}
                      title={filled ? "Expend slot" : "Restore slot"}
                      onClick={() => toggleSlot(sl, i)}
                      style={{
                        width: 22, height: 22, borderRadius: 4, padding: 0, cursor: "pointer",
                        border: `2px solid ${filled ? accentColor : "rgba(255,255,255,0.15)"}`,
                        background: filled ? `${accentColor}33` : "transparent",
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: C.muted, minWidth: 36, textAlign: "right" }}>
                {remaining}/{count}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// RichSpellsPanel
// ---------------------------------------------------------------------------

export function RichSpellsPanel({ spells, pb, intScore, wisScore, chaScore, accentColor, classDetail, charLevel, usedSpellSlots, preparedSpells, onSlotsChange, onPreparedChange, spellcastingBlocked = false }: {
  spells: { name: string; source: string }[];
  pb: number;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  accentColor: string;
  classDetail: ClassRestDetail | null;
  charLevel: number;
  usedSpellSlots: Record<string, number>;
  preparedSpells: string[];
  onSlotsChange: (next: Record<string, number>) => Promise<void>;
  onPreparedChange: (next: string[]) => Promise<void>;
  spellcastingBlocked?: boolean;
}) {
  const [details, setDetails] = React.useState<Record<string, FetchedSpellDetail>>({});
  const [selectedSpell, setSelectedSpell] = React.useState<FetchedSpellDetail | null>(null);

  const entries = React.useMemo(() => spells.map((sp) => ({
    rawName: sp.name,
    source: sp.source,
    searchName: sp.name.replace(/\s*\[.+\]$/, "").trim(),
    key: sp.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
  })), [spells]);

  const entryKeysStr = entries.map((e) => e.key).join(",");
  React.useEffect(() => {
    for (const e of entries) {
      if (details[e.key]) continue;
      api<{ id: string; name: string; level: number | null }[]>(
        `/api/spells/search?q=${encodeURIComponent(e.searchName)}&limit=5`
      ).then((results) => {
        const match =
          results.find((r) => r.name.replace(/\s*\[.+\]$/, "").toLowerCase() === e.searchName.toLowerCase())
          ?? results[0];
        if (!match) return;
        return api<FetchedSpellDetail>(`/api/spells/${match.id}`).then((detail) => {
          const textStr = Array.isArray(detail.text) ? detail.text.join("\n") : String(detail.text ?? "");
          setDetails((prev) => ({
            ...prev,
            [e.key]: { ...detail, damage: parseSpellDamage(textStr), save: parseSpellSave(textStr) },
          }));
        });
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryKeysStr]);

  const intMod = Math.floor(((intScore ?? 10) - 10) / 2);
  const wisMod = Math.floor(((wisScore ?? 10) - 10) / 2);
  const chaMod = Math.floor(((chaScore ?? 10) - 10) / 2);
  const spellMod = Math.max(intMod, wisMod, chaMod);
  const spellAbilLabel = spellMod === chaMod ? "CHA" : spellMod === wisMod ? "WIS" : "INT";
  const saveDc = 8 + pb + spellMod;
  const spellAtk = pb + spellMod;

  // Spell slots for current level
  const levelSlots = classDetail?.autolevels.find((al) => al.level === charLevel)?.slots ?? null;
  const maxSpellSlotLevel = highestAvailableSlotLevel(levelSlots);

  // Group by spell level
  const groups = new Map<number, typeof entries>();
  for (const e of entries) {
    const level = details[e.key]?.level ?? -1;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level)!.push(e);
  }

  function togglePrepared(key: string) {
    const next = preparedSpells.includes(key)
      ? preparedSpells.filter((k) => k !== key)
      : [...preparedSpells, key];
    void onPreparedChange(next);
  }

  function toggleSlot(spellLevel: number, slotIndex: number) {
    const key = String(spellLevel);
    const used = usedSpellSlots[key] ?? 0;
    // clicking below used line restores; clicking at/above expends
    const next = slotIndex < used ? slotIndex : slotIndex + 1;
    void onSlotsChange({ ...usedSpellSlots, [key]: next });
  }

  function spellUsesSave(d: FetchedSpellDetail | undefined): boolean {
    if (!d) return false;
    const txt = Array.isArray(d.text) ? d.text.join(" ") : String(d.text ?? "");
    return /saving throw/i.test(txt);
  }
  function spellUsesAttack(d: FetchedSpellDetail | undefined): boolean {
    if (!d) return false;
    const txt = Array.isArray(d.text) ? d.text.join(" ") : String(d.text ?? "");
    return /spell attack|ranged spell attack|melee spell attack/i.test(txt);
  }

  const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

  return (
    <Panel>
      {spellcastingBlocked && (
        <div style={{
          marginBottom: 10,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid rgba(248,113,113,0.35)",
          background: "rgba(248,113,113,0.10)",
          color: "#fca5a5",
          fontSize: 11,
          fontWeight: 700,
        }}>
          You can't cast spells while wearing armor or a shield without proficiency.
        </div>
      )}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <PanelTitle color="#a78bfa" style={{ margin: 0 }}>Spells</PanelTitle>
          {classDetail?.slotsReset === "S" && maxSpellSlotLevel > 0 && (
            <div style={{ fontSize: 10, color: C.muted, fontWeight: 700 }}>
              Pact Magic: cast Warlock spells using level {maxSpellSlotLevel} slots.
            </div>
          )}
        </div>
        <div style={{ display: "flex", gap: 6 }}>
          {([
            { label: "ABILITY", value: spellAbilLabel, highlight: true },
            { label: "SAVE DC",  value: String(saveDc),     highlight: false },
            { label: "ATK BONUS", value: `+${spellAtk}`,   highlight: false },
          ] as const).map(({ label, value, highlight }) => (
            <div key={label} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "6px 12px", borderRadius: 8,
              background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.18)",
              minWidth: 56,
            }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{label}</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: spellcastingBlocked && !highlight ? "#f87171" : highlight ? accentColor : C.text }}>
                {value}{spellcastingBlocked && !highlight ? " X" : ""}
              </span>
            </div>
          ))}
        </div>
      </div>

      <div style={{ opacity: spellcastingBlocked ? 0.65 : 1 }}>
      {[...groups.entries()].sort(([a], [b]) => a - b).map(([level, groupEntries]) => {
        const maxSlots = (levelSlots && level > 0) ? (levelSlots[level] ?? 0) : 0;
        const usedCount = usedSpellSlots[String(level)] ?? 0;
        const remaining = maxSlots - usedCount;

        return (
          <div key={level} style={{ marginBottom: 18 }}>
            {/* Level header with inline slots */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              paddingBottom: 5, borderBottom: "1px solid rgba(239,68,68,0.25)", marginBottom: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: 1 }}>
                {level === -1 ? "Loading…" : level === 0 ? "Cantrips" : (LEVEL_LABELS[level] ?? `Level ${level}`)}
              </div>
              {maxSlots > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10, color: C.muted, marginRight: 3 }}>slots {remaining}/{maxSlots}</span>
                  {Array.from({ length: maxSlots }).map((_, i) => {
                    const filled = i >= usedCount;
                    return (
                      <button
                        key={i}
                        title={filled ? "Expend slot" : "Regain slot"}
                        onClick={() => toggleSlot(level, i)}
                        style={{
                          width: 18, height: 18, borderRadius: "50%", padding: 0, cursor: "pointer",
                          border: `2px solid ${filled ? accentColor : "rgba(255,255,255,0.2)"}`,
                          background: filled ? accentColor : "transparent",
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto auto", gap: "0 8px", marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>PREP</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>NAME</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>TIME</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>HIT / DC</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>EFFECT</div>
            </div>

            {groupEntries.map((e, i) => {
              const d = details[e.key];
              const scaledDamage = d ? getScaledSpellDamage(d, charLevel, maxSpellSlotLevel) : null;
              const dmgColor = scaledDamage ? (DMG_COLORS[scaledDamage.type] ?? C.text) : null;
              const conc = d ? Boolean(d.concentration) : false;
              const usesSave = spellUsesSave(d);
              const usesAtk = spellUsesAttack(d);
              const isCantrip = level === 0;
              const isPrepared = isCantrip || preparedSpells.includes(e.key);
              return (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr auto auto auto",
                  alignItems: "start", gap: "0 8px",
                  padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: d ? "pointer" : "default",
                }}
                  onClick={(ev) => {
                    if ((ev.target as HTMLElement).closest("button")) return;
                    if (d) setSelectedSpell(d);
                  }}
                >
                  {/* Prepared radio */}
                  <button
                    onClick={() => !isCantrip && togglePrepared(e.key)}
                    title={isCantrip ? "Cantrip (always prepared)" : isPrepared ? "Mark unprepared" : "Mark prepared"}
                    style={{
                      width: 20, height: 20, borderRadius: "50%", padding: 0,
                      cursor: isCantrip ? "default" : "pointer", marginTop: 3,
                      border: `2px solid ${isPrepared ? accentColor : "rgba(255,255,255,0.25)"}`,
                      background: isPrepared ? accentColor : "transparent",
                      flexShrink: 0,
                    }}
                  />

                  {/* Name + meta */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: isPrepared ? C.text : C.muted }}>
                      {e.searchName}
                      {conc && <span title="Concentration" style={{ marginLeft: 5, fontSize: 10, color: "#60a5fa" }}>◆</span>}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>
                      {[d ? `${d.level === 0 ? "Cantrip" : ORDINALS[d.level ?? 0]} ${d.school ?? ""}`.trim() : null, d?.components].filter(Boolean).join("  (") + (d?.components ? ")" : "")}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: 11, color: C.muted, paddingTop: 3, textAlign: "center", minWidth: 28 }}>
                    {d ? abbrevTime(d.time ?? "—") : ""}
                  </div>

                  {/* HIT / SAVE */}
                  {d && (usesSave || usesAtk) ? (
                    <div style={{ textAlign: "center", paddingTop: 1 }}>
                      <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>
                        {usesSave ? (d.save ?? "SAVE") : "ATK"}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 15, color: spellcastingBlocked ? "#f87171" : accentColor, lineHeight: 1.2 }}>
                        {usesSave ? `${saveDc}${spellcastingBlocked ? " X" : ""}` : `+${spellAtk}${spellcastingBlocked ? " X" : ""}`}
                      </div>
                    </div>
                  ) : <div />}

                  {/* Effect */}
                  {scaledDamage ? (
                    <div style={{
                      padding: "4px 7px", borderRadius: 6, border: `1px solid ${dmgColor}55`,
                      background: `${dmgColor}15`, textAlign: "center", whiteSpace: "nowrap",
                    }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{scaledDamage.dice}</span>
                      <span style={{ fontSize: 12, marginLeft: 3 }}>{DMG_EMOJI[scaledDamage.type] ?? "◆"}</span>
                    </div>
                  ) : <div />}
                </div>
              );
            })}
          </div>
        );
      })}
      </div>
      {selectedSpell && (
        <SpellDrawer spell={selectedSpell} accentColor={accentColor} onClose={() => setSelectedSpell(null)} charLevel={charLevel} maxSlotLevel={maxSpellSlotLevel} />
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// ItemSpellsPanel
// ---------------------------------------------------------------------------

interface FetchedSpellDetail {
  id: string;
  name: string;
  level: number | null;
  school: string | null;
  time: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  concentration: number | boolean;
  ritual: number | boolean;
  classes: string | null;
  text: string | string[];
  damage: { dice: string; type: string } | null;
  save: string | null;
}

// ---------------------------------------------------------------------------
// SpellDrawer
// ---------------------------------------------------------------------------

function SpellDrawer({ spell, accentColor, onClose, charLevel, maxSlotLevel }: {
  spell: FetchedSpellDetail;
  accentColor: string;
  onClose: () => void;
  charLevel?: number;
  maxSlotLevel?: number;
}) {
  const ORDINALS = ["Cantrip", "1st level", "2nd level", "3rd level", "4th level", "5th level", "6th level", "7th level", "8th level", "9th level"];
  const textArr = Array.isArray(spell.text) ? spell.text : [String(spell.text ?? "")];
  const isConc = Boolean(spell.concentration);
  const isRitual = Boolean(spell.ritual);
  const levelLabel = spell.level === 0 ? "Cantrip" : `${ORDINALS[spell.level ?? 0] ?? `Level ${spell.level}`} spell`;
  const scaledDamage = getScaledSpellDamage(spell, charLevel ?? 1, maxSlotLevel ?? Math.max(1, spell.level ?? 1));
  const dmgColor = scaledDamage ? (DMG_COLORS[scaledDamage.type] ?? C.text) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.45)",
        }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
        width: "min(420px, 92vw)",
        background: "#111827",
        borderLeft: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky", top: 0,
          background: "#111827", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: C.text, lineHeight: 1.2 }}>
                {spell.name}
              </h2>
              <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                {levelLabel}{spell.school ? ` · ${spell.school}` : ""}
                {isRitual && <span style={{ marginLeft: 6, color: "#60a5fa", fontStyle: "normal", fontWeight: 700 }}>ritual</span>}
                {isConc && <span style={{ marginLeft: 6, color: "#60a5fa", fontStyle: "normal", fontWeight: 700 }}>concentration</span>}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", cursor: "pointer",
              color: C.muted, fontSize: 22, lineHeight: 1, padding: "2px 4px", flexShrink: 0,
            }}>×</button>
          </div>
        </div>

        {/* Stat bar */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1, background: "rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          {[
            { label: "Casting Time", value: spell.time ?? "—" },
            { label: "Range",        value: (spell.range ?? "—").replace(/ feet?/i, " ft.") },
            { label: "Duration",     value: spell.duration ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: "10px 12px", background: "#111827", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Components + damage summary */}
        <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
          {spell.components && (
            <span style={{ fontSize: 12, color: C.muted }}>{spell.components}</span>
          )}
          {scaledDamage && (
            <div style={{
              marginLeft: "auto", padding: "4px 10px", borderRadius: 6,
              border: `1px solid ${dmgColor}55`, background: `${dmgColor}15`,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{scaledDamage.dice}</span>
              <span style={{ fontSize: 13 }}>{DMG_EMOJI[scaledDamage.type] ?? "◆"}</span>
              <span style={{ fontSize: 11, color: dmgColor, fontWeight: 700, textTransform: "capitalize" }}>{scaledDamage.type}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
          {textArr.filter(Boolean).map((para, i) => (
            <p key={i} style={{ margin: 0, fontSize: 13, color: "rgba(200,210,230,0.85)", lineHeight: 1.65 }}>
              {para}
            </p>
          ))}
          {spell.classes && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: C.muted, fontStyle: "italic" }}>
              Classes: {spell.classes}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function parseSpellDamage(text: string): { dice: string; type: string } | null {
  const m = text.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s+(fire|cold|lightning|acid|poison|necrotic|radiant|thunder|psychic|force|bludgeoning|piercing|slashing)\s+damage/i);
  if (!m) return null;
  return { dice: m[1].replace(/\s+/g, ""), type: m[2].toLowerCase() };
}

function parseDiceExpression(expr: string): { count: number; sides: number; bonus: number } | null {
  const match = String(expr ?? "").trim().match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/i);
  if (!match) return null;
  return {
    count: parseInt(match[1], 10),
    sides: parseInt(match[2], 10),
    bonus: parseInt(match[3] ?? "0", 10),
  };
}

function formatDiceExpression(parsed: { count: number; sides: number; bonus: number }): string {
  return `${parsed.count}d${parsed.sides}${parsed.bonus > 0 ? `+${parsed.bonus}` : ""}`;
}

function addScaledDice(baseExpr: string, incrementExpr: string, times: number): string {
  if (times <= 0) return baseExpr.replace(/\s+/g, "");
  const base = parseDiceExpression(baseExpr);
  const inc = parseDiceExpression(incrementExpr);
  if (!base || !inc || base.sides !== inc.sides) return baseExpr.replace(/\s+/g, "");
  return formatDiceExpression({
    count: base.count + (inc.count * times),
    sides: base.sides,
    bonus: base.bonus + (inc.bonus * times),
  });
}

function highestAvailableSlotLevel(levelSlots: number[] | null | undefined): number {
  if (!levelSlots) return 0;
  for (let i = levelSlots.length - 1; i >= 1; i -= 1) {
    if ((levelSlots[i] ?? 0) > 0) return i;
  }
  return 0;
}

function getScaledSpellDamage(detail: FetchedSpellDetail, charLevel: number, maxSlotLevel: number): { dice: string; type: string } | null {
  const text = Array.isArray(detail.text) ? detail.text.join("\n") : String(detail.text ?? "");
  const base = parseSpellDamage(text);
  if (!base) return null;

  if ((detail.level ?? 0) === 0) {
    const tierBoosts = (charLevel >= 5 ? 1 : 0) + (charLevel >= 11 ? 1 : 0) + (charLevel >= 17 ? 1 : 0);
    const cantripBoost = text.match(/damage increases by (\d+d\d+(?:\s*\+\s*\d+)?)/i);
    if (cantripBoost && tierBoosts > 0) {
      return { ...base, dice: addScaledDice(base.dice, cantripBoost[1], tierBoosts) };
    }
    return base;
  }

  const baseLevel = Math.max(1, detail.level ?? 1);
  const castLevel = Math.max(baseLevel, maxSlotLevel);

  if (/^magic missile$/i.test(detail.name.trim())) {
    const darts = 3 + Math.max(0, castLevel - 1);
    return { dice: `${darts}d4+${darts}`, type: "force" };
  }

  const higherLevelBoost = text.match(/damage increases by (\d+d\d+(?:\s*\+\s*\d+)?) for each slot level above (\d+)(?:st|nd|rd|th)/i);
  if (higherLevelBoost) {
    const threshold = parseInt(higherLevelBoost[2], 10);
    const times = Math.max(0, castLevel - threshold);
    if (times > 0) {
      return { ...base, dice: addScaledDice(base.dice, higherLevelBoost[1], times) };
    }
  }

  return base;
}

function parseSpellSave(text: string): string | null {
  const m = text.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA)\s+saving\s+throw/i);
  if (!m) return null;
  const map: Record<string, string> = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };
  return map[m[1].toLowerCase()] ?? m[1].toUpperCase().slice(0, 3);
}

function abbrevTime(t: string): string {
  return t
    .replace(/1 action/i, "1A").replace(/1 bonus action/i, "1BA")
    .replace(/1 reaction/i, "1R").replace(/1 minute/i, "1 min");
}

const DMG_COLORS: Record<string, string> = {
  fire: "#f97316", cold: "#60a5fa", lightning: "#facc15", acid: "#a3e635",
  poison: "#86efac", necrotic: "#818cf8", radiant: "#fde68a", thunder: "#7dd3fc",
  psychic: "#e879f9", force: "#a78bfa", bludgeoning: "#94a3b8", piercing: "#94a3b8", slashing: "#f87171",
};
const DMG_EMOJI: Record<string, string> = {
  fire: "🔥", cold: "❄️", lightning: "⚡", acid: "🧪", poison: "☠️",
  necrotic: "💀", radiant: "✨", thunder: "💥", psychic: "🔮", force: "◆",
};
const LEVEL_LABELS: Record<number, string> = {
  0: "Cantrip", 1: "1st Level", 2: "2nd Level", 3: "3rd Level", 4: "4th Level",
  5: "5th Level", 6: "6th Level", 7: "7th Level", 8: "8th Level", 9: "9th Level",
};

export function ItemSpellsPanel({ items, pb, intScore, wisScore, chaScore, accentColor, onChargeChange, spellcastingBlocked = false }: {
  items: InventoryItem[];
  pb: number;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  accentColor: string;
  onChargeChange: (itemId: string, charges: number) => void;
  spellcastingBlocked?: boolean;
}) {
  const [details, setDetails] = React.useState<Record<string, FetchedSpellDetail>>({});
  const [selectedSpell, setSelectedSpell] = React.useState<FetchedSpellDetail | null>(null);

  const itemsWithSpells = React.useMemo(() =>
    items
      .filter((it) => getEquipState(it) !== "backpack")
      .filter((it) => !it.attunement || it.attuned)
      .map((it) => ({ item: it, spells: parseItemSpells(it.description ?? "") }))
      .filter(({ spells }) => spells.length > 0),
  [items]);

  const allKeys = React.useMemo(() =>
    itemsWithSpells.flatMap(({ spells }) => spells.map((sp) => ({
      spellName: sp.name,
      key: sp.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    }))),
  [itemsWithSpells]);

  const keysStr = allKeys.map((e) => e.key).join(",");
  React.useEffect(() => {
    for (const e of allKeys) {
      if (details[e.key]) continue;
      api<{ id: string; name: string; level: number | null }[]>(
        `/api/spells/search?q=${encodeURIComponent(e.spellName)}&limit=5`
      ).then((results) => {
        const match = results.find((r) => r.name.replace(/\s*\[.+\]$/, "").toLowerCase() === e.spellName.toLowerCase()) ?? results[0];
        if (!match) return;
        return api<FetchedSpellDetail>(`/api/spells/${match.id}`).then((detail) => {
          const textStr = Array.isArray(detail.text) ? detail.text.join("\n") : String(detail.text ?? "");
          setDetails((prev) => ({ ...prev, [e.key]: { ...detail, damage: parseSpellDamage(textStr), save: parseSpellSave(textStr) } }));
        });
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysStr]);

  if (!itemsWithSpells.length) return null;

  const spellMod = Math.max(
    Math.floor(((intScore ?? 10) - 10) / 2),
    Math.floor(((wisScore ?? 10) - 10) / 2),
    Math.floor(((chaScore ?? 10) - 10) / 2),
  );
  const saveDc = 8 + pb + spellMod;
  const spellAtk = pb + spellMod;
  const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

  return (
    <>
      {itemsWithSpells.map(({ item, spells }) => {
        const chargesMax = item.chargesMax ?? 0;
        const charges = item.charges ?? chargesMax;

        // Group spells by level
        const groups = new Map<number, ParsedItemSpell[]>();
        for (const sp of spells) {
          const key = sp.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          const level = details[key]?.level ?? -1;
          if (!groups.has(level)) groups.set(level, []);
          groups.get(level)!.push(sp);
        }

        return (
          <Panel key={item.id}>
            {spellcastingBlocked && (
              <div style={{
                marginBottom: 10,
                padding: "8px 10px",
                borderRadius: 8,
                border: "1px solid rgba(248,113,113,0.35)",
                background: "rgba(248,113,113,0.10)",
                color: "#fca5a5",
                fontSize: 11,
                fontWeight: 700,
              }}>
                You can't cast spells while wearing armor or a shield without proficiency.
              </div>
            )}
            {/* Header: item name + charge circles */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <PanelTitle color="#a78bfa" style={{ margin: 0 }}>
                {item.name.replace(/\s*\[.+\]$/, "")}
              </PanelTitle>
              {chargesMax > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10, color: C.muted, marginRight: 3 }}>
                    charges {charges}/{chargesMax}
                  </span>
                  {Array.from({ length: chargesMax }).map((_, i) => {
                    const filled = i < charges;
                    return (
                      <button
                        key={i}
                        title={filled ? "Use charge" : "Recover charge"}
                        onClick={() => onChargeChange(item.id, i < charges ? i : i + 1)}
                        style={{
                          width: 16, height: 16, borderRadius: "50%", padding: 0, cursor: "pointer",
                          border: `2px solid ${filled ? "#ef4444" : "rgba(255,255,255,0.2)"}`,
                          background: filled ? "#ef4444" : "transparent",
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            <div style={{ opacity: spellcastingBlocked ? 0.65 : 1 }}>
            {[...groups.entries()].sort(([a], [b]) => a - b).map(([level, groupSpells]) => (
              <div key={level} style={{ marginBottom: 14 }}>
                {/* Level header */}
                <div style={{
                  fontSize: 11, fontWeight: 800, color: "#ef4444", textTransform: "uppercase",
                  letterSpacing: 1, paddingBottom: 5, borderBottom: "1px solid rgba(239,68,68,0.25)", marginBottom: 8,
                }}>
                  {level === -1 ? "Loading…" : level === 0 ? "Cantrips" : `${ORDINALS[level] ?? `Level ${level}`} Level`}
                </div>

                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto auto", gap: "0 8px", marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>CST</div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>NAME</div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>TIME</div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>HIT / DC</div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>EFFECT</div>
                </div>

                {groupSpells.map((sp, i) => {
                  const key = sp.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                  const d = details[key];
                  const dmgColor = d?.damage ? (DMG_COLORS[d.damage.type] ?? C.text) : null;
                  const conc = d ? Boolean(d.concentration) : false;
                  const txt = d ? (Array.isArray(d.text) ? d.text.join(" ") : String(d.text ?? "")) : "";
                  const usesSave = /saving throw/i.test(txt);
                  const usesAtk = /spell attack/i.test(txt);
                  // Strip verbose material component descriptions: "V, S, M (a ball of guano)" → "V, S, M"
                  const compactComponents = d?.components ? d.components.replace(/\s*\([^)]*\)/g, "").trim() : null;
                  return (
                    <div key={i}
                      style={{
                        display: "grid", gridTemplateColumns: "24px 1fr auto auto auto",
                        alignItems: "start", gap: "0 8px",
                        padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                        cursor: d ? "pointer" : "default",
                      }}
                      onClick={() => { if (d) setSelectedSpell(d); }}
                    >
                      {/* Cost circle */}
                      <div title={`${sp.cost} charge${sp.cost !== 1 ? "s" : ""}`} style={{
                        width: 20, height: 20, borderRadius: "50%", marginTop: 3,
                        background: "#dc2626", display: "grid", placeItems: "center", flexShrink: 0,
                      }}>
                        <span style={{ color: "#fff", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>{sp.cost}</span>
                      </div>

                      {/* Name + meta */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                          {sp.name}
                          {conc && <span title="Concentration" style={{ marginLeft: 5, fontSize: 10, color: "#60a5fa" }}>◆</span>}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>
                          {d ? `${d.level === 0 ? "Cantrip" : ORDINALS[d.level ?? 0] ?? ""} ${d.school ?? ""}`.trim() : ""}
                          {compactComponents ? ` (${compactComponents})` : ""}
                        </div>
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: 11, color: C.muted, paddingTop: 3, textAlign: "center", minWidth: 28 }}>
                        {d ? abbrevTime(d.time ?? "—") : ""}
                      </div>

                      {/* HIT / DC */}
                      {d && (usesSave || usesAtk) ? (
                        <div style={{ textAlign: "center", paddingTop: 1 }}>
                          <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>{usesSave ? (d.save ?? "SAVE") : "ATK"}</div>
                          <div style={{ fontWeight: 900, fontSize: 15, color: spellcastingBlocked ? "#f87171" : accentColor, lineHeight: 1.2 }}>
                            {usesSave ? `${saveDc}${spellcastingBlocked ? " X" : ""}` : `+${spellAtk}${spellcastingBlocked ? " X" : ""}`}
                          </div>
                        </div>
                      ) : <div />}

                      {/* Effect */}
                      {d?.damage ? (
                        <div style={{
                          padding: "4px 7px", borderRadius: 6, border: `1px solid ${dmgColor}55`,
                          background: `${dmgColor}15`, textAlign: "center", whiteSpace: "nowrap",
                        }}>
                          <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{d.damage.dice}</span>
                          <span style={{ fontSize: 12, marginLeft: 3 }}>{DMG_EMOJI[d.damage.type] ?? "◆"}</span>
                        </div>
                      ) : <div />}
                    </div>
                  );
                })}
              </div>
            ))}
            </div>
          </Panel>
        );
      })}
      {selectedSpell && (
        <SpellDrawer spell={selectedSpell} accentColor={accentColor} onClose={() => setSelectedSpell(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

