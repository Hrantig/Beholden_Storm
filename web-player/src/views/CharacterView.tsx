import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api } from "@/services/api";
import { C } from "@/lib/theme";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaggedItem { name: string; source: string }
interface ProficiencyMap {
  skills: TaggedItem[];
  saves: TaggedItem[];
  armor: TaggedItem[];
  weapons: TaggedItem[];
  tools: TaggedItem[];
  languages: TaggedItem[];
  spells: TaggedItem[];
  invocations: TaggedItem[];
}

interface CharacterCampaign {
  id: string;
  campaignId: string;
  campaignName: string;
  playerId: string | null;
}

interface CharacterData {
  classId?: string;
  raceId?: string;
  bgId?: string;
  subclass?: string | null;
  abilityMethod?: string;
  chosenOptionals?: string[];
  chosenSkills?: string[];
  chosenCantrips?: string[];
  chosenSpells?: string[];
  chosenInvocations?: string[];
  proficiencies?: ProficiencyMap;
}

interface Character {
  id: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  speed: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  color: string | null;
  imageUrl: string | null;
  characterData: CharacterData | null;
  campaigns: CharacterCampaign[];
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_LABELS: Record<string, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};
const ABILITY_FULL: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

function mod(score: number | null): number {
  return Math.floor(((score ?? 10) - 10) / 2);
}

function fmtMod(score: number | null): string {
  const m = mod(score);
  return (m >= 0 ? "+" : "") + m;
}

function profBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function CharacterView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [char, setChar] = useState<Character | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;
    api<Character>(`/api/me/characters/${id}`)
      .then(setChar)
      .catch((e) => setError(e?.message ?? "Failed to load character"))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <Page><p style={{ color: C.muted }}>Loading…</p></Page>;
  if (error || !char) return <Page><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Page>;

  const prof = char.characterData?.proficiencies;
  const pb = profBonus(char.level);
  const scores: Record<string, number | null> = {
    str: char.strScore, dex: char.dexScore, con: char.conScore,
    int: char.intScore, wis: char.wisScore, cha: char.chaScore,
  };

  const initiative = mod(char.dexScore);
  const passivePerception = 10 + mod(char.wisScore) + (prof?.skills.some(s => /perception/i.test(s.name)) ? pb : 0);

  const accentColor = char.color ?? C.accentHl;

  return (
    <Page>
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 20, alignItems: "flex-start",
        marginBottom: 28, flexWrap: "wrap",
      }}>
        {/* Portrait */}
        <div style={{
          width: 84, height: 84, borderRadius: 12, flexShrink: 0,
          background: `${accentColor}22`,
          border: `2px solid ${accentColor}66`,
          overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {char.imageUrl
            ? <img src={char.imageUrl} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <span style={{ fontSize: 36, opacity: 0.5 }}>🧙</span>
          }
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <h1 style={{ margin: "0 0 4px", fontSize: 26, fontWeight: 900, letterSpacing: -0.5, color: C.text }}>
            {char.name}
          </h1>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 6 }}>
            {[char.className, char.characterData?.subclass, char.species]
              .filter(Boolean).join(" · ")}
            <span style={{ marginLeft: 8, color: accentColor, fontWeight: 700 }}>Level {char.level}</span>
          </div>
          {char.playerName && (
            <div style={{ fontSize: 12, color: "rgba(160,180,220,0.45)" }}>Player: {char.playerName}</div>
          )}
          {char.campaigns.length > 0 && (
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 6 }}>
              {char.campaigns.map((c) => (
                <span key={c.id} style={{
                  fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                  background: `${accentColor}18`, border: `1px solid ${accentColor}44`, color: accentColor,
                }}>
                  {c.campaignName}
                </span>
              ))}
            </div>
          )}
        </div>

        {/* Edit button */}
        <button
          onClick={() => navigate(`/characters/${char.id}/edit`)}
          style={{
            padding: "7px 18px", borderRadius: 8, cursor: "pointer",
            background: "rgba(255,255,255,0.07)",
            border: "1px solid rgba(255,255,255,0.18)",
            color: C.muted, fontWeight: 600, fontSize: 13,
            flexShrink: 0,
          }}>
          ✎ Edit
        </button>
      </div>

      {/* ── Vital stats row ─────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", marginBottom: 24 }}>
        <StatBox label="HP" value={`${char.hpCurrent} / ${char.hpMax}`} accent={C.green} wide />
        <StatBox label="AC" value={String(char.ac)} />
        <StatBox label="Speed" value={`${char.speed} ft`} />
        <StatBox label="Initiative" value={fmtMod(char.dexScore)} />
        <StatBox label="Prof Bonus" value={`+${pb}`} accent={accentColor} />
        <StatBox label="Passive Perc." value={String(passivePerception)} />
      </div>

      {/* ── Ability scores ──────────────────────────────────────────── */}
      <Section title="Ability Scores">
        <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 8 }}>
          {ABILITY_KEYS.map((k) => {
            const score = scores[k];
            const m = mod(score);
            const isProfSave = prof?.saves.some((s) => new RegExp(ABILITY_FULL[k], "i").test(s.name));
            return (
              <div key={k} style={{
                textAlign: "center", padding: "10px 6px", borderRadius: 10,
                background: "rgba(255,255,255,0.05)",
                border: `1px solid ${isProfSave ? accentColor + "55" : "rgba(255,255,255,0.10)"}`,
                position: "relative",
              }}>
                {isProfSave && (
                  <div style={{
                    position: "absolute", top: 4, right: 6,
                    fontSize: 8, color: accentColor, fontWeight: 700, opacity: 0.8,
                  }}>SAVE</div>
                )}
                <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, letterSpacing: "0.06em", marginBottom: 4 }}>
                  {ABILITY_LABELS[k]}
                </div>
                <div style={{ fontSize: 22, fontWeight: 900, lineHeight: 1, color: C.text }}>
                  {m >= 0 ? "+" : ""}{m}
                </div>
                <div style={{ fontSize: 11, color: C.muted, marginTop: 3 }}>
                  {score ?? "—"}
                </div>
              </div>
            );
          })}
        </div>
      </Section>

      {/* ── Proficiencies ───────────────────────────────────────────── */}
      {prof && (() => {
        const sections: { label: string; items: TaggedItem[]; color?: string }[] = [
          { label: "Saving Throws", items: prof.saves,     color: accentColor },
          { label: "Skills",        items: prof.skills,    color: C.green },
          { label: "Armor",         items: prof.armor,     color: "#a78bfa" },
          { label: "Weapons",       items: prof.weapons,   color: "#f87171" },
          { label: "Tools",         items: prof.tools,     color: "#fb923c" },
          { label: "Languages",     items: prof.languages, color: "#60a5fa" },
        ].filter((s) => s.items.length > 0);

        if (sections.length === 0) return null;

        return (
          <Section title="Proficiencies">
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              {sections.map((s) => (
                <div key={s.label}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                    {s.label}
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {s.items.map((item, i) => (
                      <span key={i} style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
                          background: (s.color ?? C.accentHl) + "18",
                          border: `1px solid ${(s.color ?? C.accentHl)}44`,
                          color: s.color ?? C.accentHl,
                        }}>
                          {item.name}
                        </span>
                        <span style={{
                          fontSize: 10, padding: "2px 6px", borderRadius: 4,
                          background: "rgba(56,182,255,0.08)", border: "1px solid rgba(56,182,255,0.2)",
                          color: "rgba(56,182,255,0.6)",
                        }}>
                          {item.source}
                        </span>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Section>
        );
      })()}

      {/* ── Spells ──────────────────────────────────────────────────── */}
      {prof && (prof.spells.length > 0 || prof.invocations.length > 0) && (
        <Section title="Spells &amp; Invocations">
          {prof.spells.length > 0 && (
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Known / Prepared
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {prof.spells.map((sp, i) => (
                  <span key={i} style={{
                    fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
                    background: "rgba(167,139,250,0.15)", border: "1px solid rgba(167,139,250,0.35)",
                    color: "#a78bfa",
                  }}>
                    {sp.name}
                  </span>
                ))}
              </div>
            </div>
          )}
          {prof.invocations.length > 0 && (
            <div>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>
                Invocations
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {prof.invocations.map((inv, i) => (
                  <span key={i} style={{
                    fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
                    background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.35)",
                    color: "#fb923c",
                  }}>
                    {inv.name}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Section>
      )}

      {/* ── Optional features chosen ────────────────────────────────── */}
      {char.characterData?.chosenOptionals && char.characterData.chosenOptionals.length > 0 && (
        <Section title="Class Features">
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {char.characterData.chosenOptionals.map((f) => (
              <span key={f} style={{
                fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6,
                background: "rgba(94,203,107,0.12)", border: "1px solid rgba(94,203,107,0.3)",
                color: C.green,
              }}>
                {f}
              </span>
            ))}
          </div>
        </Section>
      )}

      {/* ── Back ────────────────────────────────────────────────────── */}
      <div style={{ marginTop: 32 }}>
        <button
          onClick={() => navigate("/")}
          style={{
            background: "transparent", border: "1px solid rgba(255,255,255,0.14)",
            borderRadius: 8, padding: "7px 16px", color: C.muted,
            cursor: "pointer", fontSize: 13,
          }}>
          ← Back
        </button>
      </div>
    </Page>
  );
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function Page({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 760, margin: "0 auto", padding: "32px 24px" }}>
        {children}
      </div>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{
        fontSize: 11, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em",
        color: "rgba(160,180,220,0.45)", marginBottom: 10,
        display: "flex", alignItems: "center", gap: 10,
      }}>
        <span>{title}</span>
        <div style={{ flex: 1, height: 1, background: "rgba(255,255,255,0.07)" }} />
      </div>
      {children}
    </div>
  );
}

function StatBox({ label, value, accent, wide }: {
  label: string; value: string; accent?: string; wide?: boolean;
}) {
  return (
    <div style={{
      padding: "10px 16px", borderRadius: 10, textAlign: "center",
      background: "rgba(255,255,255,0.05)",
      border: `1px solid ${accent ? accent + "44" : "rgba(255,255,255,0.10)"}`,
      minWidth: wide ? 120 : 72,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontSize: 18, fontWeight: 800, color: accent ?? C.text }}>
        {value}
      </div>
    </div>
  );
}
