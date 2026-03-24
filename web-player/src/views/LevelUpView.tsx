import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { C } from "@/lib/theme";
import { rollDiceExpr } from "@/lib/dice";
import { abilityMod, extractPrerequisite, formatModifier, invocationPrerequisitesMet, spellLooksLikeDamageSpell, stripPrerequisiteLine } from "@/views/CharacterSheetUtils";
import {
  getCantripCount,
  getClassFeatureTable,
  getMaxSlotLevel,
  getPreparedSpellCount,
  getSubclassLevel,
  getSubclassList,
  isSpellcaster,
  tableValueAtLevel,
} from "@/views/CharacterCreatorUtils";

// ---------------------------------------------------------------------------
// Types (minimal, matching CharacterView / CharacterCreatorView shapes)
// ---------------------------------------------------------------------------

interface AutoLevel {
  level: number;
  scoreImprovement: boolean;
  slots: number[] | null;
  features: { name: string; text: string; optional: boolean }[];
  counters: { name: string; value: number; reset: string }[];
}

interface ClassDetail {
  id: string;
  name: string;
  hd: number | null;
  autolevels: AutoLevel[];
}

interface SpellSummary {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
}

interface Character {
  id: string;
  name: string;
  className: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  characterData: {
    classId?: string;
    xp?: number;
    subclass?: string | null;
    chosenCantrips?: string[];
    chosenSpells?: string[];
    chosenInvocations?: string[];
    proficiencies?: {
      spells?: Array<{ name: string; source: string }>;
      invocations?: Array<{ name: string; source: string }>;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  } | null;
}

type AsiMode = "+2" | "+1+1" | "feat" | null;
type HpChoice = "roll" | "average" | "manual" | null;

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_LABELS: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

// Spell slot columns: index 1–9 map to spell levels
const SLOT_LABELS = ["Cantrips", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function LevelUpView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [char, setChar] = useState<Character | null>(null);
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // HP
  const [hpChoice, setHpChoice] = useState<HpChoice>(null);
  const [rolledHp, setRolledHp] = useState<number | null>(null);
  const [manualHp, setManualHp] = useState<string>("");

  // ASI
  const [asiMode, setAsiMode] = useState<AsiMode>(null);
  const [asiStats, setAsiStats] = useState<Record<string, number>>({});

  // Feature expand
  const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);
  const [subclass, setSubclass] = useState<string>("");
  const [chosenCantrips, setChosenCantrips] = useState<string[]>([]);
  const [chosenSpells, setChosenSpells] = useState<string[]>([]);
  const [chosenInvocations, setChosenInvocations] = useState<string[]>([]);
  const [classCantrips, setClassCantrips] = useState<SpellSummary[]>([]);
  const [classSpells, setClassSpells] = useState<SpellSummary[]>([]);
  const [classInvocations, setClassInvocations] = useState<SpellSummary[]>([]);

  // -------------------------------------------------------------------------
  // Load character + class
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    api<Character>(`/api/me/characters/${id}`)
      .then((c) => {
        setChar(c);
        setSubclass(String(c.characterData?.subclass ?? ""));
        setChosenCantrips(c.characterData?.chosenCantrips ?? []);
        setChosenSpells(c.characterData?.chosenSpells ?? []);
        setChosenInvocations(c.characterData?.chosenInvocations ?? []);
        const classId = c.characterData?.classId;
        if (classId) {
          return api<ClassDetail>(`/api/compendium/classes/${classId}`);
        }
        return null;
      })
      .then((cd) => { if (cd) setClassDetail(cd); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!classDetail) {
      setClassCantrips([]);
      setClassSpells([]);
      setClassInvocations([]);
      return;
    }
    const name = encodeURIComponent(classDetail.name);
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&level=0&limit=200`).then(setClassCantrips).catch(() => setClassCantrips([]));
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&minLevel=1&maxLevel=9&limit=300`).then(setClassSpells).catch(() => setClassSpells([]));
    if (/warlock/i.test(classDetail.name)) {
      api<SpellSummary[]>("/api/spells/search?classes=Eldritch+Invocations&limit=200").then(setClassInvocations).catch(() => setClassInvocations([]));
    } else {
      setClassInvocations([]);
    }
  }, [classDetail]);

  const nextLevel = (char?.level ?? 0) + 1;

  const hd = classDetail?.hd ?? 8;
  const conScore = char?.conScore ?? 10;
  const conMod = abilityMod(conScore);
  const hpAverage = Math.floor(hd / 2) + 1 + conMod;
  const hpRollMax = hd + conMod;

  const autoLevel = classDetail?.autolevels.find((al) => al.level === nextLevel);
  const newFeatures = autoLevel?.features.filter((f) => !f.optional) ?? [];
  const isAsiLevel = autoLevel?.scoreImprovement ?? false;
  const newSlots = autoLevel?.slots ?? null;
  const subclassLevel = classDetail ? getSubclassLevel(classDetail) : null;
  const subclassOptions = classDetail ? getSubclassList(classDetail) : [];
  const needsSubclassChoice = Boolean(subclassLevel && nextLevel >= subclassLevel && subclassOptions.length > 0);
  const cantripCount = classDetail ? getCantripCount(classDetail, nextLevel) : 0;
  const invocTable = classDetail ? getClassFeatureTable(classDetail, "Invocation", nextLevel) : [];
  const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, nextLevel) : 0;
  const prepCount = classDetail ? getPreparedSpellCount(classDetail, nextLevel) : 0;
  const maxSpellLevel = classDetail ? getMaxSlotLevel(classDetail, nextLevel) : 0;
  const spellcaster = classDetail ? isSpellcaster(classDetail) : false;
  const allowedInvocationIds = React.useMemo(
    () => {
      const chosenCantripNames = classCantrips
        .filter((spell) => chosenCantrips.includes(spell.id))
        .map((spell) => spell.name);
      const chosenDamageCantripNames = classCantrips
        .filter((spell) => chosenCantrips.includes(spell.id) && spellLooksLikeDamageSpell(spell))
        .map((spell) => spell.name);
      const chosenInvocationNames = classInvocations
        .filter((invocation) => chosenInvocations.includes(invocation.id))
        .map((invocation) => invocation.name);

      return new Set(
        classInvocations
          .filter((invocation) =>
            invocationPrerequisitesMet(invocation.text ?? "", {
              level: nextLevel,
              chosenCantripNames,
              chosenDamageCantripNames,
              chosenInvocationNames,
            })
          )
          .map((invocation) => invocation.id)
      );
    },
    [chosenCantrips, chosenInvocations, classCantrips, classDetail?.name, classInvocations, nextLevel]
  );

  useEffect(() => {
    setChosenCantrips((prev) => {
      const next = prev.filter((id) => classCantrips.some((spell) => spell.id === id)).slice(0, cantripCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classCantrips, cantripCount]);

  useEffect(() => {
    if (maxSpellLevel === 0) return;
    setChosenSpells((prev) => {
      const next = prev
        .filter((id) => {
          const spell = classSpells.find((entry) => entry.id === id);
          const spellLevel = Number(spell?.level ?? 0);
          return Boolean(spell) && spellLevel > 0 && spellLevel <= maxSpellLevel;
        })
        .slice(0, prepCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classSpells, maxSpellLevel, prepCount]);

  useEffect(() => {
    setChosenInvocations((prev) => {
      const next = prev.filter((id) => allowedInvocationIds.has(id)).slice(0, invocCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [allowedInvocationIds, invocCount]);

  // Determine HP gain for display
  const hpGain = hpChoice === "average"
    ? hpAverage
    : hpChoice === "roll"
      ? rolledHp ?? null
      : hpChoice === "manual"
        ? (() => {
            const value = parseInt(manualHp, 10);
            return Number.isFinite(value) && value > 0 ? value : null;
          })()
      : null;

  // Current scores + ASI deltas
  const baseScores: Record<string, number> = {
    str: char?.strScore ?? 10, dex: char?.dexScore ?? 10, con: char?.conScore ?? 10,
    int: char?.intScore ?? 10, wis: char?.wisScore ?? 10, cha: char?.chaScore ?? 10,
  };
  const previewScores: Record<string, number> = { ...baseScores };
  for (const [k, v] of Object.entries(asiStats)) {
    previewScores[k] = Math.min(20, (previewScores[k] ?? 10) + v);
  }

  const asiTotal = Object.values(asiStats).reduce((a, b) => a + b, 0);
  const asiValid =
    !isAsiLevel ||
    asiMode === "feat" ||
    (asiMode === "+2" && asiTotal === 2) ||
    (asiMode === "+1+1" && asiTotal === 2 && Object.values(asiStats).every((v) => v <= 1));
  const subclassValid = !needsSubclassChoice || Boolean(subclass.trim());
  const cantripsValid = cantripCount === 0 || chosenCantrips.length === cantripCount;
  const spellsValid = !spellcaster || prepCount === 0 || chosenSpells.length === prepCount;
  const invocationsValid = invocCount === 0 || chosenInvocations.length === invocCount;

  const canConfirm = hpGain !== null && asiValid && subclassValid && cantripsValid && spellsValid && invocationsValid;

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;
  if (nextLevel > 20) {
    return (
      <Wrap>
        <p style={{ color: C.muted }}>Already at max level (20).</p>
        <BackBtn onClick={() => navigate(`/characters/${char.id}`)} />
      </Wrap>
    );
  }

  function rollHp() {
    const rolled = rollDiceExpr(`1d${hd}`);
    const total = Math.max(1, rolled + conMod);
    setRolledHp(total);
    setHpChoice("roll");
  }

  function toggleAsiPoint(key: string) {
    if (!asiMode || asiMode === "feat") return;
    const cap = asiMode === "+2" ? 2 : 1;
    const current = asiStats[key] ?? 0;
    setAsiStats((prev) => {
      const next = { ...prev };
      if (current >= cap) {
        delete next[key];
      } else if (asiTotal < 2) {
        next[key] = current + 1;
      }
      return next;
    });
  }

  function clearAsi() {
    setAsiStats({});
    setAsiMode(null);
  }

  function toggleSelection(id: string, chosen: string[], setChosen: React.Dispatch<React.SetStateAction<string[]>>, max: number) {
    setChosen((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((entry) => entry !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  }

  async function confirm() {
    if (!char || !canConfirm) return;
    setSaving(true);
    try {
      const newHpMax = char.hpMax + (hpGain ?? 0);
      const proficiencies = { ...(char.characterData?.proficiencies ?? {}) } as NonNullable<Character["characterData"]>["proficiencies"];
      const selectedCantripEntries = classCantrips
        .filter((spell) => chosenCantrips.includes(spell.id))
        .map((spell) => ({ name: spell.name, source: classDetail?.name ?? char.className }));
      const selectedSpellEntries = classSpells
        .filter((spell) => chosenSpells.includes(spell.id))
        .map((spell) => ({ name: spell.name, source: classDetail?.name ?? char.className }));
      const selectedInvocationEntries = classInvocations
        .filter((spell) => chosenInvocations.includes(spell.id))
        .map((spell) => ({ name: spell.name, source: classDetail?.name ?? char.className }));
      const existingSpells = Array.isArray(proficiencies?.spells) ? proficiencies.spells : [];
      const existingInvocations = Array.isArray(proficiencies?.invocations) ? proficiencies.invocations : [];
      const classSource = classDetail?.name ?? char.className;
      const nextCharacterData = {
        ...(char.characterData ?? {}),
        subclass: subclass || null,
        chosenCantrips,
        chosenSpells,
        chosenInvocations,
        proficiencies: {
          ...(proficiencies ?? {}),
          spells: [
            ...existingSpells.filter((entry) => entry.source !== classSource),
            ...selectedCantripEntries,
            ...selectedSpellEntries,
          ],
          invocations: [
            ...existingInvocations.filter((entry) => entry.source !== classSource),
            ...selectedInvocationEntries,
          ],
        },
      };
      const payload: Record<string, unknown> = {
        level: nextLevel,
        hpMax: newHpMax,
        hpCurrent: char.hpCurrent + (hpGain ?? 0),
        characterData: nextCharacterData,
      };
      if (asiMode === "+2" || asiMode === "+1+1") {
        for (const [k, v] of Object.entries(asiStats)) {
          const scoreKey = `${k}Score`;
          payload[scoreKey] = Math.min(20, (baseScores[k] ?? 10) + v);
        }
      }
      await api(`/api/me/characters/${char.id}`, jsonInit("PUT", payload));
      navigate(`/characters/${char.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const accentColor = "#38b6ff";

  return (
    <Wrap>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(`/characters/${char.id}`)}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20, padding: 0 }}
        >←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text }}>{char.name}</h1>
          <div style={{ fontSize: 13, color: accentColor, fontWeight: 700, marginTop: 2 }}>
            Level {char.level} → <span style={{ color: "#fff" }}>{nextLevel}</span>
            {classDetail && <span style={{ color: C.muted, fontWeight: 400 }}> · {classDetail.name}</span>}
          </div>
        </div>
      </div>

      {/* ── HP gain ── */}
      <Section title={`HP at Level ${nextLevel}`} accent={accentColor}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
          Hit Die: d{hd} · CON modifier: {formatModifier(conMod)}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <ChoiceBtn
            active={hpChoice === "average"}
            onClick={() => { setHpChoice("average"); setRolledHp(null); setManualHp(""); }}
          >
            Take average — <strong>+{hpAverage}</strong>
          </ChoiceBtn>
          <ChoiceBtn
            active={hpChoice === "roll"}
            onClick={() => { setManualHp(""); rollHp(); }}
            accent={C.green}
          >
            {hpChoice === "roll" && rolledHp !== null
              ? <>🎲 Rolled — <strong>+{rolledHp}</strong> <span style={{ fontSize: 10, color: C.muted }}>(click to re-roll)</span></>
              : <>🎲 Roll 1d{hd}</>}
          </ChoiceBtn>
          <ChoiceBtn
            active={hpChoice === "manual"}
            onClick={() => { setHpChoice("manual"); setRolledHp(null); }}
            accent="#f59e0b"
          >
            Manual HP
          </ChoiceBtn>
        </div>
        {hpChoice === "manual" && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={manualHp}
              onChange={(e) => setManualHp(e.target.value)}
              placeholder={`Enter total gained (e.g. ${Math.max(1, 1 + conMod)}-${Math.max(1, hd + conMod)})`}
              style={{
                flex: "0 1 280px",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                color: C.text,
                fontSize: 14,
                fontWeight: 700,
                outline: "none",
              }}
            />
            <div style={{ fontSize: 12, color: C.muted }}>
              Enter the final HP gained after applying Constitution.
            </div>
          </div>
        )}
        {hpGain !== null && (
          <div style={{ marginTop: 10, fontSize: 13, color: C.muted }}>
            New HP max: <span style={{ color: "#fff", fontWeight: 700 }}>{char.hpMax} + {hpGain} = {char.hpMax + hpGain}</span>
          </div>
        )}
      </Section>

      {/* ── ASI ── */}
      {isAsiLevel && (
        <Section title="Ability Score Improvement" accent={accentColor}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            +2 to one ability score, +1 to two different scores, or take a feat.
          </div>

          {/* Mode selection */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {(["+2", "+1+1", "feat"] as const).map((m) => (
              <ChoiceBtn
                key={m}
                active={asiMode === m}
                onClick={() => { clearAsi(); setAsiMode(m); }}
              >
                {m === "+2" ? "+2 to one" : m === "+1+1" ? "+1 / +1" : "Take a Feat"}
              </ChoiceBtn>
            ))}
          </div>

          {asiMode && asiMode !== "feat" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {ABILITY_KEYS.map((k) => {
                const base = baseScores[k] ?? 10;
                const delta = asiStats[k] ?? 0;
                const preview = Math.min(20, base + delta);
                const maxed = base >= 20;
                const selected = delta > 0;
                return (
                  <button
                    key={k}
                    onClick={() => !maxed && toggleAsiPoint(k)}
                    style={{
                      padding: "10px 6px", borderRadius: 8, cursor: maxed ? "default" : "pointer",
                      border: `2px solid ${selected ? accentColor : "rgba(255,255,255,0.1)"}`,
                      background: selected ? `${accentColor}18` : "rgba(255,255,255,0.03)",
                      color: maxed ? C.muted : C.text,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{ABILITY_LABELS[k]}</div>
                    <div style={{ fontSize: 17, fontWeight: 900 }}>
                      {preview}
                      {selected && <span style={{ fontSize: 11, color: accentColor }}> +{delta}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>{formatModifier(abilityMod(preview))}</div>
                    {maxed && <div style={{ fontSize: 9, color: C.muted }}>MAX</div>}
                  </button>
                );
              })}
            </div>
          )}

          {asiMode === "feat" && (
            <div style={{
              padding: "12px 14px", borderRadius: 8, border: "1px solid rgba(255,255,255,0.1)",
              background: "rgba(255,255,255,0.03)", fontSize: 12, color: C.muted,
            }}>
              Feat selection is managed in the full character editor.{" "}
              <span
                style={{ color: accentColor, cursor: "pointer", textDecoration: "underline" }}
                onClick={() => navigate(`/characters/${char.id}/edit`)}
              >Open editor →</span>
            </div>
          )}
        </Section>
      )}

      {needsSubclassChoice && (
        <Section title={`Subclass at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            Choose your subclass.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {subclassOptions.map((option) => (
              <ChoiceBtn key={option} active={subclass === option} onClick={() => setSubclass(option)}>
                {option}
              </ChoiceBtn>
            ))}
          </div>
        </Section>
      )}

      {(cantripCount > 0 || prepCount > 0 || invocCount > 0) && (
        <Section title={`Spell Choices at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {cantripCount > 0 && (
              <SpellChoiceList
                title="Cantrips"
                caption={`Choose ${cantripCount}`}
                spells={classCantrips}
                chosen={chosenCantrips}
                max={cantripCount}
                onToggle={(id) => toggleSelection(id, chosenCantrips, setChosenCantrips, cantripCount)}
              />
            )}
            {spellcaster && prepCount > 0 && (
              <SpellChoiceList
                title="Prepared Spells"
                caption={`Choose ${prepCount} (up to level ${maxSpellLevel})`}
                spells={classSpells.filter((spell) => Number(spell.level ?? 0) > 0 && Number(spell.level ?? 0) <= maxSpellLevel)}
                chosen={chosenSpells}
                max={prepCount}
                onToggle={(id) => toggleSelection(id, chosenSpells, setChosenSpells, prepCount)}
              />
            )}
            {invocCount > 0 && classInvocations.length > 0 && (
              <SpellChoiceList
                title="Eldritch Invocations"
                caption={`Choose ${invocCount}`}
                spells={classInvocations.filter((invocation) => allowedInvocationIds.has(invocation.id))}
                chosen={chosenInvocations}
                max={invocCount}
                onToggle={(id) => toggleSelection(id, chosenInvocations, setChosenInvocations, invocCount)}
                isAllowed={(invocation) => allowedInvocationIds.has(invocation.id)}
              />
            )}
          </div>
        </Section>
      )}

      {/* ── New features ── */}
      {newFeatures.length > 0 && (
        <Section title={`New Features at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {newFeatures.map((f) => {
              const key = f.name;
              const expanded = expandedFeatures.includes(key);
              return (
                <div
                  key={key}
                  style={{
                    borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)", overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setExpandedFeatures((p) =>
                      p.includes(key) ? p.filter((x) => x !== key) : [...p, key]
                    )}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", background: "none", border: "none", cursor: "pointer",
                      color: C.text, fontWeight: 700, fontSize: 13, textAlign: "left",
                    }}
                  >
                    <span>{f.name}</span>
                    <span style={{ color: C.muted, fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
                  </button>
                  {expanded && (
                    <div style={{
                      padding: "0 12px 12px", fontSize: 12, color: C.muted, lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}>
                      {f.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Spell slots ── */}
      {newSlots && newSlots.some((s, i) => i > 0 && s > 0) && (
        <Section title={`Spell Slots at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {newSlots.map((count, i) => {
              if (count === 0) return null;
              return (
                <div key={i} style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: 10, color: C.muted }}>{SLOT_LABELS[i] ?? `L${i}`}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: accentColor }}>{count}</div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Confirm ── */}
      <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
        <button
          onClick={() => navigate(`/characters/${char.id}`)}
          style={{
            padding: "12px 20px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: C.muted,
          }}
        >Cancel</button>
        <button
          onClick={confirm}
          disabled={!canConfirm || saving}
          style={{
            flex: 1, padding: "12px 20px", borderRadius: 10, cursor: canConfirm && !saving ? "pointer" : "not-allowed",
            fontSize: 14, fontWeight: 800, border: "none",
            background: canConfirm ? accentColor : "rgba(255,255,255,0.08)",
            color: canConfirm ? "#fff" : C.muted,
            opacity: saving ? 0.6 : 1,
            transition: "background 0.2s",
          }}
        >
          {saving ? "Saving…" : `⬆ Level Up to ${nextLevel}`}
        </button>
      </div>
    </Wrap>
  );
}

// ---------------------------------------------------------------------------
// Local sub-components
// ---------------------------------------------------------------------------

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{
        maxWidth: 540, margin: "0 auto", padding: "24px 16px 140px",
        fontFamily: "system-ui, Segoe UI, Arial", color: C.text,
      }}>
        {children}
      </div>
    </div>
  );
}

function BackBtn({ onClick }: { onClick: () => void }) {
  return (
    <button onClick={onClick} style={{
      background: "none", border: "none", cursor: "pointer", color: C.muted,
      fontSize: 13, padding: "6px 0",
    }}>← Back</button>
  );
}

function Section({ title, accent, children }: { title: string; accent: string; children: React.ReactNode }) {
  return (
    <div style={{
      marginBottom: 20, padding: "16px", borderRadius: 12,
      border: "1px solid rgba(255,255,255,0.08)", background: "rgba(255,255,255,0.02)",
    }}>
      <div style={{ fontSize: 11, fontWeight: 800, color: accent, textTransform: "uppercase", letterSpacing: 1, marginBottom: 12 }}>
        {title}
      </div>
      {children}
    </div>
  );
}

function SpellChoiceList({ title, caption, spells, chosen, max, onToggle, isAllowed }: {
  title: string;
  caption: string;
  spells: SpellSummary[];
  chosen: string[];
  max: number;
  onToggle: (id: string) => void;
  isAllowed?: (spell: SpellSummary) => boolean;
}) {
  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, marginBottom: 8 }}>
        <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>{title}</div>
        <div style={{ fontSize: 11, color: C.muted }}>
          {chosen.length} / {max} · {caption}
        </div>
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 8 }}>
        {spells.map((spell) => {
          const active = chosen.includes(spell.id);
          const allowed = isAllowed ? isAllowed(spell) : true;
          const blocked = !active && (chosen.length >= max || !allowed);
          const prerequisite = extractPrerequisite(spell.text);
          const preview = stripPrerequisiteLine(spell.text).replace(/Source:.*$/ms, "").trim();
          return (
            <button
              key={spell.id}
              type="button"
              onClick={() => !blocked && onToggle(spell.id)}
              style={{
                padding: "10px 12px",
                borderRadius: 8,
                cursor: blocked ? "not-allowed" : "pointer",
                border: `2px solid ${active ? "#38b6ff" : "rgba(255,255,255,0.1)"}`,
                background: active ? "rgba(56,182,255,0.14)" : "rgba(255,255,255,0.03)",
                color: blocked ? C.muted : C.text,
                textAlign: "left",
                opacity: blocked ? 0.6 : 1,
                minHeight: 92,
              }}
            >
              <div style={{ fontSize: 13, fontWeight: 700 }}>{spell.name}</div>
              {spell.level != null && spell.level > 0 && (
                <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>
                  Level {spell.level}
                </div>
              )}
              {prerequisite && (
                <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.35 }}>
                  <span style={{ color: allowed ? "#fbbf24" : "#f87171", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                    Prerequisite
                  </span>
                  <span style={{ color: allowed ? "rgba(251,191,36,0.92)" : "#fca5a5" }}> {prerequisite}</span>
                </div>
              )}
              {!allowed && prerequisite && (
                <div style={{ marginTop: 4, fontSize: 10, color: "#f87171", fontWeight: 700 }}>
                  Prerequisite not met
                </div>
              )}
              {preview && (
                <div style={{ marginTop: 6, fontSize: 10, lineHeight: 1.35, color: "rgba(160,180,220,0.72)" }}>
                  {preview.slice(0, 150)}{preview.length > 150 ? "…" : ""}
                </div>
              )}
            </button>
          );
        })}
      </div>
      {spells.length === 0 && (
        <div style={{ fontSize: 12, color: C.muted }}>No eligible options found in compendium.</div>
      )}
    </div>
  );
}

function ChoiceBtn({ active, onClick, accent, children }: {
  active: boolean;
  onClick: () => void;
  accent?: string;
  children: React.ReactNode;
}) {
  const color = accent ?? "#38b6ff";
  return (
    <button
      onClick={onClick}
      style={{
        flex: 1, padding: "10px 14px", borderRadius: 8, cursor: "pointer",
        border: `2px solid ${active ? color : "rgba(255,255,255,0.1)"}`,
        background: active ? `${color}18` : "rgba(255,255,255,0.03)",
        color: active ? "#fff" : C.muted,
        fontSize: 13, fontWeight: active ? 700 : 500,
        transition: "border-color 0.15s, background 0.15s",
      }}
    >
      {children}
    </button>
  );
}
