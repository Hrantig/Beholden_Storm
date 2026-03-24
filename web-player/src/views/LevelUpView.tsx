import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { C } from "@/lib/theme";
import { rollDiceExpr } from "@/lib/dice";

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
  characterData: { classId?: string; xp?: number; [k: string]: unknown } | null;
}

type AsiMode = "+2" | "+1+1" | "feat" | null;
type HpChoice = "roll" | "average" | null;

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_LABELS: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

function mod(score: number) { return Math.floor((score - 10) / 2); }
function fmtMod(n: number) { return n >= 0 ? `+${n}` : String(n); }

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

  // ASI
  const [asiMode, setAsiMode] = useState<AsiMode>(null);
  const [asiStats, setAsiStats] = useState<Record<string, number>>({});

  // Feature expand
  const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);

  // -------------------------------------------------------------------------
  // Load character + class
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    api<Character>(`/api/me/characters/${id}`)
      .then((c) => {
        setChar(c);
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

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;

  const nextLevel = char.level + 1;
  if (nextLevel > 20) {
    return (
      <Wrap>
        <p style={{ color: C.muted }}>Already at max level (20).</p>
        <BackBtn onClick={() => navigate(`/characters/${char.id}`)} />
      </Wrap>
    );
  }

  const hd = classDetail?.hd ?? 8;
  const conScore = char.conScore ?? 10;
  const conMod = mod(conScore);
  const hpAverage = Math.floor(hd / 2) + 1 + conMod;
  const hpRollMax = hd + conMod;

  const autoLevel = classDetail?.autolevels.find((al) => al.level === nextLevel);
  const newFeatures = autoLevel?.features.filter((f) => !f.optional) ?? [];
  const isAsiLevel = autoLevel?.scoreImprovement ?? false;
  const newSlots = autoLevel?.slots ?? null;

  // Determine HP gain for display
  const hpGain = hpChoice === "average"
    ? hpAverage
    : hpChoice === "roll"
      ? rolledHp ?? null
      : null;

  // Current scores + ASI deltas
  const baseScores: Record<string, number> = {
    str: char.strScore ?? 10, dex: char.dexScore ?? 10, con: char.conScore ?? 10,
    int: char.intScore ?? 10, wis: char.wisScore ?? 10, cha: char.chaScore ?? 10,
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

  const canConfirm = hpGain !== null && asiValid;

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

  async function confirm() {
    if (!char || !canConfirm) return;
    setSaving(true);
    try {
      const newHpMax = char.hpMax + (hpGain ?? 0);
      const payload: Record<string, unknown> = {
        level: nextLevel,
        hpMax: newHpMax,
        hpCurrent: char.hpCurrent + (hpGain ?? 0),
      };
      if (asiMode === "+2" || asiMode === "+1+1") {
        for (const [k, v] of Object.entries(asiStats)) {
          const scoreKey = `${k}Score`;
          payload[scoreKey] = Math.min(20, (baseScores[k] ?? 10) + v);
        }
      }
      // Store xp as-is (no change), bump characterData.level implicitly via top-level field
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
          Hit Die: d{hd} · CON modifier: {fmtMod(conMod)}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <ChoiceBtn
            active={hpChoice === "average"}
            onClick={() => { setHpChoice("average"); setRolledHp(null); }}
          >
            Take average — <strong>+{hpAverage}</strong>
          </ChoiceBtn>
          <ChoiceBtn
            active={hpChoice === "roll"}
            onClick={rollHp}
            accent={C.green}
          >
            {hpChoice === "roll" && rolledHp !== null
              ? <>🎲 Rolled — <strong>+{rolledHp}</strong> <span style={{ fontSize: 10, color: C.muted }}>(click to re-roll)</span></>
              : <>🎲 Roll 1d{hd}</>}
          </ChoiceBtn>
        </div>
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
                    <div style={{ fontSize: 10, color: C.muted }}>{fmtMod(mod(preview))}</div>
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
    <div style={{
      maxWidth: 540, margin: "0 auto", padding: "24px 16px 48px",
      fontFamily: "system-ui, Segoe UI, Arial", color: C.text,
    }}>
      {children}
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
