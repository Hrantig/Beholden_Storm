import React from "react";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import { CollapsiblePanel, panelHeaderAddBtn } from "@/views/character/CharacterViewParts";
import type { GrantedSpellCast, ResourceCounter } from "@/views/character/CharacterSheetTypes";
import type { ClassRestDetail } from "@/views/character/SpellSlotsPanel";
import { AddSpellDrawer, SpellDrawer } from "@/views/character/CharacterSpellDrawers";
import {
  type FetchedSpellDetail,
  DMG_COLORS,
  DMG_EMOJI,
  LEVEL_LABELS,
  abbrevTime,
  getScaledSpellDamage,
  grantedSpellChargeBtn,
  highestAvailableSlotLevel,
  parseSpellDamage,
  parseSpellSave,
  spellSectionArrow,
  spellSectionHeaderBtn,
} from "@/views/character/CharacterSpellShared";

// ---------------------------------------------------------------------------
// RichSpellsPanel
// ---------------------------------------------------------------------------

export function RichSpellsPanel({ spells, grantedSpells = [], resources = [], pb, intScore, wisScore, chaScore, accentColor, classDetail, charLevel, preparedLimit = 0, usedSpellSlots, preparedSpells, onSlotsChange, onPreparedChange, onAddSpell, onRemoveSpell, addSpellSourceLabel, onResourceChange, spellcastingBlocked = false }: {
  spells: { name: string; source: string }[];
  grantedSpells?: GrantedSpellCast[];
  resources?: ResourceCounter[];
  pb: number;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  accentColor: string;
  classDetail: ClassRestDetail | null;
  charLevel: number;
  preparedLimit?: number;
  usedSpellSlots: Record<string, number>;
  preparedSpells: string[];
  onSlotsChange: (next: Record<string, number>) => Promise<void>;
  onPreparedChange: (next: string[]) => Promise<void>;
  onAddSpell?: (spellName: string) => Promise<void> | void;
  onRemoveSpell?: (spellName: string) => Promise<void> | void;
  addSpellSourceLabel?: string;
  onResourceChange?: (key: string, delta: number) => Promise<void> | void;
  spellcastingBlocked?: boolean;
}) {
  const [details, setDetails] = React.useState<Record<string, FetchedSpellDetail>>({});
  const [selectedSpell, setSelectedSpell] = React.useState<FetchedSpellDetail | null>(null);
  const [collapsedSections, setCollapsedSections] = React.useState<Record<string, boolean>>({});
  const [addSpellOpen, setAddSpellOpen] = React.useState(false);
  const [spellSearch, setSpellSearch] = React.useState("");
  const [spellSearchResults, setSpellSearchResults] = React.useState<FetchedSpellDetail[]>([]);
  const [spellSearchLoading, setSpellSearchLoading] = React.useState(false);

  const trackedEntries = React.useMemo(() => spells.map((sp) => ({
    rawName: sp.name,
    source: sp.source,
    searchName: sp.name.replace(/\s*\[.+\]$/, "").trim(),
    key: sp.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    removable: true,
    forcedPrepared: false,
  })), [spells]);
  const grantedEntries = React.useMemo(() => grantedSpells.map((sp) => ({
    ...sp,
    searchName: sp.spellName.replace(/\s*\[.+\]$/, "").trim(),
    key: sp.spellName.toLowerCase().replace(/[^a-z0-9]/g, ""),
    grantKey: sp.key,
  })), [grantedSpells]);
  const specialGrantedEntries = React.useMemo(
    () => grantedEntries.filter((entry) => entry.mode === "at_will" || entry.mode === "expanded_list" || entry.mode === "limited"),
    [grantedEntries]
  );
  const entries = React.useMemo(() => {
    const merged = new Map<string, {
      rawName: string;
      source: string;
      searchName: string;
      key: string;
      removable: boolean;
      forcedPrepared: boolean;
    }>();
    trackedEntries.forEach((entry) => merged.set(entry.key, entry));
    grantedEntries
      .filter((entry) => entry.mode === "known" || entry.mode === "always_prepared")
      .forEach((entry) => {
        const existing = merged.get(entry.key);
        if (existing) {
          existing.removable = false;
          if (entry.mode === "always_prepared") existing.forcedPrepared = true;
          return;
        }
        merged.set(entry.key, {
          rawName: entry.spellName,
          source: entry.sourceName,
          searchName: entry.searchName,
          key: entry.key,
          removable: false,
          forcedPrepared: entry.mode === "always_prepared",
        });
      });
    return Array.from(merged.values()).sort((a, b) => a.searchName.localeCompare(b.searchName));
  }, [grantedEntries, trackedEntries]);
  const forcedPreparedKeys = React.useMemo(
    () => new Set(entries.filter((entry) => entry.forcedPrepared).map((entry) => entry.key)),
    [entries]
  );
  const knownSpellKeys = React.useMemo(() => new Set(entries.map((entry) => entry.key)), [entries]);
  const grantedSpellKeys = React.useMemo(() => new Set(specialGrantedEntries.map((entry) => entry.key)), [specialGrantedEntries]);

  const entryKeysStr = [...entries.map((e) => e.key), ...specialGrantedEntries.map((e) => e.key)].join(",");
  React.useEffect(() => {
    for (const e of [...entries, ...specialGrantedEntries]) {
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

  const isPactMagic = classDetail?.slotsReset === "S";

  // Group by spell level; for Pact Magic, all leveled spells are always cast at the current slot level
  const groups = new Map<number, typeof entries>();
  for (const e of entries) {
    const baseLevel = details[e.key]?.level ?? -1;
    const level = (isPactMagic && baseLevel > 0 && maxSpellSlotLevel > 0) ? maxSpellSlotLevel : baseLevel;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level)!.push(e);
  }

  function togglePrepared(key: string) {
    if (forcedPreparedKeys.has(key)) return;
    const isPrepared = preparedSpells.includes(key);
    const userPreparedCount = preparedSpells.filter((entry) => !forcedPreparedKeys.has(entry)).length;
    if (!isPrepared && preparedLimit > 0 && userPreparedCount >= preparedLimit) return;
    const next = isPrepared
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

  function toggleSection(key: string) {
    setCollapsedSections((prev) => ({ ...prev, [key]: !prev[key] }));
  }

  React.useEffect(() => {
    const query = spellSearch.trim();
    if (!addSpellOpen || query.length < 2) {
      setSpellSearchResults([]);
      setSpellSearchLoading(false);
      return;
    }
    let alive = true;
    setSpellSearchLoading(true);
    api<Array<{ id: string; name: string; level: number | null }>>(`/api/spells/search?q=${encodeURIComponent(query)}&limit=20`)
      .then(async (results) => {
        if (!alive) return;
        const detailed = await Promise.all(
          results.map(async (result) => {
            try {
              return await api<FetchedSpellDetail>(`/api/spells/${result.id}`);
            } catch {
              return null;
            }
          })
        );
        if (alive) setSpellSearchResults(detailed.filter((entry): entry is FetchedSpellDetail => Boolean(entry)));
      })
      .catch(() => {
        if (alive) setSpellSearchResults([]);
      })
      .finally(() => {
        if (alive) setSpellSearchLoading(false);
      });
    return () => { alive = false; };
  }, [addSpellOpen, spellSearch]);

  return (<>
    <CollapsiblePanel title="Spells" color={accentColor} storageKey="spells" actions={
      onAddSpell ? <button type="button" onClick={() => setAddSpellOpen(true)} title="Add spell" style={panelHeaderAddBtn(accentColor)}>+</button> : undefined
    }>
      <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
        {([
          { label: "ABILITY", value: spellAbilLabel, highlight: true },
          { label: "SAVE DC",  value: String(saveDc),     highlight: false },
          { label: "ATK BONUS", value: `+${spellAtk}`,   highlight: false },
        ] as const).map(({ label, value, highlight }) => (
          <div key={label} style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            padding: "4px 10px", borderRadius: 8, flex: 1,
            background: "rgba(255,255,255,0.04)", border: `1px solid rgba(255,255,255,0.08)`,
          }}>
            <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{label}</span>
            <span style={{ fontSize: "var(--fs-medium)", fontWeight: 900, color: spellcastingBlocked && !highlight ? C.colorPinkRed : highlight ? accentColor : C.text }}>
              {value}{spellcastingBlocked && !highlight ? " X" : ""}
            </span>
          </div>
        ))}
      </div>
      {spellcastingBlocked && (
        <div style={{
          marginBottom: 10,
          padding: "8px 10px",
          borderRadius: 8,
          border: "1px solid rgba(248,113,113,0.35)",
          background: "rgba(248,113,113,0.10)",
          color: "#fca5a5",
          fontSize: "var(--fs-small)",
          fontWeight: 700,
        }}>
          You can't cast spells while wearing armor or a shield without proficiency.
        </div>
      )}
      {classDetail?.slotsReset === "S" && maxSpellSlotLevel > 0 && (
        <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, marginBottom: 12 }}>
          Pact Magic: cast Warlock spells using level {maxSpellSlotLevel} slots.
        </div>
      )}

      {specialGrantedEntries.length > 0 && (
        <div style={{ marginBottom: 18, opacity: spellcastingBlocked ? 0.65 : 1 }}>
          <button
            type="button"
            onClick={() => toggleSection("granted")}
            style={spellSectionHeaderBtn("rgba(96,165,250,0.25)")}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span aria-hidden="true" style={spellSectionArrow(Boolean(collapsedSections.granted), C.colorRitual)}>▼</span>
              <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: C.colorRitual, textTransform: "uppercase", letterSpacing: 1 }}>
                Granted Spells
              </div>
            </div>
          </button>
          {!collapsedSections.granted && specialGrantedEntries.map((entry) => {
            const detail = details[entry.key];
            const resource = entry.resourceKey ? resources.find((item) => item.key === entry.resourceKey) : null;
            return (
              <div
                key={entry.grantKey}
                style={{
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 10,
                  padding: "8px 0",
                  borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: detail ? "pointer" : "default",
                }}
                onClick={(ev) => {
                  if ((ev.target as HTMLElement).closest("button")) return;
                  if (detail) setSelectedSpell(detail);
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: C.text }}>{entry.searchName}</div>
                  <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 1 }}>{entry.sourceName}</div>
                  {entry.note ? (
                    <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginTop: 4, lineHeight: 1.45 }}>{entry.note}</div>
                  ) : null}
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  {entry.mode === "at_will" ? (
                    <div style={{
                      padding: "5px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(96,165,250,0.35)",
                      background: "rgba(96,165,250,0.12)",
                      color: "#93c5fd",
                      fontSize: "var(--fs-tiny)",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}>
                      At Will
                    </div>
                  ) : entry.mode === "expanded_list" ? (
                    <div style={{
                      padding: "5px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(251,191,36,0.35)",
                      background: "rgba(251,191,36,0.12)",
                      color: "#fcd34d",
                      fontSize: "var(--fs-tiny)",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}>
                      Expanded
                    </div>
                  ) : entry.mode === "always_prepared" ? (
                    <div style={{
                      padding: "5px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(196,181,253,0.35)",
                      background: "rgba(196,181,253,0.12)",
                      color: "#c4b5fd",
                      fontSize: "var(--fs-tiny)",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}>
                      Prepared
                    </div>
                  ) : entry.mode === "known" ? (
                    <div style={{
                      padding: "5px 8px",
                      borderRadius: 999,
                      border: "1px solid rgba(52,211,153,0.35)",
                      background: "rgba(52,211,153,0.12)",
                      color: "#6ee7b7",
                      fontSize: "var(--fs-tiny)",
                      fontWeight: 800,
                      textTransform: "uppercase",
                      letterSpacing: "0.07em",
                    }}>
                      Known
                    </div>
                  ) : resource ? (
                    <>
                      <button
                        type="button"
                        onClick={() => void onResourceChange?.(resource.key, -1)}
                        disabled={resource.current <= 0}
                        style={grantedSpellChargeBtn(resource.current > 0)}
                      >
                        -
                      </button>
                      <div style={{ textAlign: "center", minWidth: 58 }}>
                        <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text }}>{resource.current}/{resource.max}</div>
                        <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{formatResourceResetLabel(resource.reset)}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => void onResourceChange?.(resource.key, 1)}
                        disabled={resource.current >= resource.max}
                        style={grantedSpellChargeBtn(resource.current < resource.max)}
                      >
                        +
                      </button>
                    </>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ opacity: spellcastingBlocked ? 0.65 : 1 }}>
      {entries.length === 0 && specialGrantedEntries.length === 0 && (
        <div style={{
          padding: "10px 0 4px",
          fontSize: "var(--fs-small)",
          color: C.muted,
          lineHeight: 1.6,
        }}>
          No spells on this character yet. Use <strong style={{ color: C.text }}>Add Spell</strong> to track spells found, learned, or granted at the table.
        </div>
      )}
      {[...groups.entries()].sort(([a], [b]) => a - b).map(([level, groupEntries]) => {
        const sectionKey = `level:${level}`;
        const isCollapsed = Boolean(collapsedSections[sectionKey]);
        const maxSlots = (levelSlots && level > 0) ? (levelSlots[level] ?? 0) : 0;
        const usedCount = usedSpellSlots[String(level)] ?? 0;
        const remaining = maxSlots - usedCount;

        return (
          <div key={level} style={{ marginBottom: 18 }}>
            {/* Level header with inline slots */}
            <div
              role="button"
              tabIndex={0}
              onClick={() => toggleSection(sectionKey)}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") toggleSection(sectionKey); }}
              style={spellSectionHeaderBtn("rgba(239,68,68,0.25)", 8)}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span aria-hidden="true" style={spellSectionArrow(isCollapsed, "#ef4444")}>▼</span>
                <div style={{ fontSize: "var(--fs-small)", fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: 1 }}>
                {level === -1 ? "Loading…" : level === 0 ? "Cantrips" : (LEVEL_LABELS[level] ?? `Level ${level}`)}
              </div>
              {maxSlots > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginRight: 3 }}>slots {remaining}/{maxSlots}</span>
                  {Array.from({ length: maxSlots }).map((_, i) => {
                    const filled = i >= usedCount;
                    return (
                      <button
                        key={i}
                        title={filled ? "Expend slot" : "Regain slot"}
                        onClick={(event) => {
                          event.stopPropagation();
                          toggleSlot(level, i);
                        }}
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
            </div>

            {!isCollapsed && (
              <>
            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto auto", gap: "0 8px", marginBottom: 4 }}>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>PREP</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>NAME</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>TIME</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>HIT / DC</div>
              <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>EFFECT</div>
            </div>

            {groupEntries.map((e, i) => {
              const d = details[e.key];
              const scaledDamage = d ? getScaledSpellDamage(d, charLevel, maxSpellSlotLevel) : null;
              const dmgColor = scaledDamage ? (DMG_COLORS[scaledDamage.type] ?? C.text) : null;
              const conc = d ? Boolean(d.concentration) : false;
              const usesSave = spellUsesSave(d);
              const usesAtk = spellUsesAttack(d);
              const isCantrip = level === 0;
              const isAlwaysPrepared = e.forcedPrepared;
              const isPrepared = isCantrip || isAlwaysPrepared || preparedSpells.includes(e.key);
              const userPreparedCount = preparedSpells.filter((entry) => !forcedPreparedKeys.has(entry)).length;
              const preparedLocked = !isCantrip && !isAlwaysPrepared && !isPrepared && preparedLimit > 0 && userPreparedCount >= preparedLimit;
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
                    onClick={() => !isCantrip && !isAlwaysPrepared && !preparedLocked && togglePrepared(e.key)}
                    title={
                      isCantrip
                        ? "Cantrip (always prepared)"
                        : isAlwaysPrepared
                          ? "Always prepared"
                        : isPrepared
                          ? "Mark unprepared"
                          : preparedLocked
                            ? `Prepared limit reached (${preparedLimit})`
                            : "Mark prepared"
                    }
                    style={{
                      width: 20, height: 20, borderRadius: "50%", padding: 0,
                      cursor: isCantrip || isAlwaysPrepared || preparedLocked ? "default" : "pointer", marginTop: 3,
                      border: `2px solid ${isPrepared ? accentColor : "rgba(255,255,255,0.25)"}`,
                      background: isPrepared ? accentColor : preparedLocked ? "rgba(255,255,255,0.05)" : "transparent",
                      opacity: preparedLocked ? 0.65 : 1,
                      flexShrink: 0,
                    }}
                  />

                  {/* Name + meta */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: isPrepared ? C.text : C.muted }}>
                      {e.searchName}
                      {conc && <span title="Concentration" style={{ marginLeft: 5, fontSize: "var(--fs-tiny)", color: C.colorRitual }}>◆</span>}
                    </div>
                    <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>
                      {[d ? `${d.level === 0 ? "Cantrip" : ORDINALS[d.level ?? 0]} ${d.school ?? ""}`.trim() : null, d?.components].filter(Boolean).join("  (") + (d?.components ? ")" : "")}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: "var(--fs-small)", color: C.muted, paddingTop: 3, textAlign: "center", minWidth: 28 }}>
                    {d ? abbrevTime(d.time ?? "—") : ""}
                  </div>

                  {/* HIT / SAVE */}
                  {d && (usesSave || usesAtk) ? (
                    <div style={{ textAlign: "center", paddingTop: 1 }}>
                      <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, fontWeight: 700 }}>
                        {usesSave ? (d.save ?? "SAVE") : "ATK"}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: "var(--fs-body)", color: spellcastingBlocked ? C.colorPinkRed : accentColor, lineHeight: 1.2 }}>
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
                      <span style={{ fontWeight: 800, fontSize: "var(--fs-subtitle)", color: C.text }}>{scaledDamage.dice}</span>
                      <span style={{ fontSize: "var(--fs-small)", marginLeft: 3 }}>{DMG_EMOJI[scaledDamage.type] ?? "◆"}</span>
                    </div>
                  ) : <div />}
                </div>
              );
            })}
              </>
            )}
          </div>
        );
      })}
      </div>
      {selectedSpell && (
        <SpellDrawer spell={selectedSpell} accentColor={accentColor} onClose={() => setSelectedSpell(null)} charLevel={charLevel} maxSlotLevel={maxSpellSlotLevel} />
      )}
    </CollapsiblePanel>
    {addSpellOpen && (
      <AddSpellDrawer
        accentColor={accentColor}
        entries={entries}
        knownSpellKeys={knownSpellKeys}
        grantedSpellKeys={grantedSpellKeys}
        addSpellSourceLabel={addSpellSourceLabel}
        spellSearch={spellSearch}
        onSpellSearchChange={setSpellSearch}
        spellSearchLoading={spellSearchLoading}
        spellSearchResults={spellSearchResults}
        onAddSpell={onAddSpell}
        onRemoveSpell={onRemoveSpell}
        onClose={() => { setAddSpellOpen(false); setSpellSearch(""); }}
      />
    )}
  </>
  );
}
