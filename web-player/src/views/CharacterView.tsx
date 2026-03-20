import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { C } from "@/lib/theme";
import { IconPlayer, IconShield, IconSpeed, IconHeart, IconInitiative, IconConditions } from "@/icons";
import { useWs } from "@/services/ws";

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

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  equipped: boolean;
  notes?: string;
}

interface CharacterData {
  classId?: string;
  raceId?: string;
  bgId?: string;
  subclass?: string | null;
  abilityMethod?: string;
  hd?: number | null;
  chosenOptionals?: string[];
  chosenSkills?: string[];
  chosenCantrips?: string[];
  chosenSpells?: string[];
  chosenInvocations?: string[];
  proficiencies?: ProficiencyMap;
  inventory?: InventoryItem[];
}

interface ConditionInstance {
  key: string;
  [k: string]: unknown;
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
  conditions?: ConditionInstance[];
  overrides?: { tempHp: number; acBonus: number; hpMaxOverride: number | null };
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
type AbilKey = typeof ABILITY_KEYS[number];

const ABILITY_LABELS: Record<AbilKey, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};
const ABILITY_FULL: Record<AbilKey, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

const ALL_SKILLS: { name: string; abil: AbilKey }[] = [
  { name: "Acrobatics",      abil: "dex" },
  { name: "Animal Handling", abil: "wis" },
  { name: "Arcana",          abil: "int" },
  { name: "Athletics",       abil: "str" },
  { name: "Deception",       abil: "cha" },
  { name: "History",         abil: "int" },
  { name: "Insight",         abil: "wis" },
  { name: "Intimidation",    abil: "cha" },
  { name: "Investigation",   abil: "int" },
  { name: "Medicine",        abil: "wis" },
  { name: "Nature",          abil: "int" },
  { name: "Perception",      abil: "wis" },
  { name: "Performance",     abil: "cha" },
  { name: "Persuasion",      abil: "cha" },
  { name: "Religion",        abil: "int" },
  { name: "Sleight of Hand", abil: "dex" },
  { name: "Stealth",         abil: "dex" },
  { name: "Survival",        abil: "wis" },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mod(score: number | null): number {
  return Math.floor(((score ?? 10) - 10) / 2);
}
function fmtMod(n: number): string {
  return (n >= 0 ? "+" : "") + n;
}
function profBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}
function isProficientIn(list: TaggedItem[], name: string): boolean {
  return list.some((s) => s.name.toLowerCase() === name.toLowerCase());
}
function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
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

  const fetchChar = useCallback(() => {
    if (!id) return;
    api<Character>(`/api/me/characters/${id}`)
      .then(setChar)
      .catch((e) => setError(e?.message ?? "Failed to load character"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchChar(); }, [fetchChar]);

  // Re-fetch whenever the DM changes something in any campaign this character is in
  useWs(useCallback((msg) => {
    if (msg.type !== "players:changed") return;
    const campaignId = (msg.payload as any)?.campaignId as string | undefined;
    if (!campaignId) return;
    // Only reload if this character is actually assigned to that campaign
    setChar((prev) => {
      if (prev?.campaigns.some((c) => c.campaignId === campaignId)) {
        fetchChar();
      }
      return prev; // state unchanged — fetchChar will update it
    });
  }, [fetchChar]));

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;

  const prof = char.characterData?.proficiencies;
  const pb = profBonus(char.level);
  const hd = char.characterData?.hd ?? null;

  const scores: Record<AbilKey, number | null> = {
    str: char.strScore, dex: char.dexScore, con: char.conScore,
    int: char.intScore, wis: char.wisScore, cha: char.chaScore,
  };

  const accentColor = char.color ?? C.accentHl;
  const overrides = char.overrides ?? { tempHp: 0, acBonus: 0, hpMaxOverride: null };
  const effectiveHpMax = overrides.hpMaxOverride !== null ? overrides.hpMaxOverride : char.hpMax;
  const effectiveAc = char.ac + (overrides.acBonus ?? 0);
  const tempHp = overrides.tempHp ?? 0;
  const hpPct = effectiveHpMax > 0 ? Math.max(0, Math.min(1, char.hpCurrent / effectiveHpMax)) : 0;
  const tempPct = effectiveHpMax > 0 ? Math.min(1 - hpPct, tempHp / effectiveHpMax) : 0;
  const passivePerc = 10 + mod(char.wisScore) + (prof && isProficientIn(prof.skills, "Perception") ? pb : 0);
  const passiveInv  = 10 + mod(char.intScore) + (prof && isProficientIn(prof.skills, "Investigation") ? pb : 0);

  async function saveCharacterData(updatedData: CharacterData) {
    const updated = await api<Character>(`/api/me/characters/${char!.id}`, jsonInit("PUT", {
      name: char!.name,
      characterData: { ...char!.characterData, ...updatedData },
    }));
    setChar((prev) => prev ? { ...prev, characterData: { ...prev.characterData, ...updatedData } } : prev);
    return updated;
  }

  return (
    <Wrap>
      {/* ── Character header ─────────────────────────────────────────── */}
      <div style={{
        display: "flex", gap: 16, alignItems: "flex-start",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderRadius: 14, padding: "18px 20px", marginBottom: 20,
        flexWrap: "wrap",
      }}>
        {/* Portrait */}
        <div style={{
          width: 80, height: 80, borderRadius: 12, flexShrink: 0,
          background: `${accentColor}22`,
          border: `2px solid ${accentColor}66`,
          overflow: "hidden",
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {char.imageUrl
            ? <img src={char.imageUrl} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <IconPlayer size={40} style={{ opacity: 0.35 }} />
          }
        </div>

        {/* Name + meta */}
        <div style={{ flex: 1, minWidth: 180 }}>
          <h1 style={{ margin: "0 0 2px", fontSize: 24, fontWeight: 900, letterSpacing: -0.5, color: C.text }}>
            {char.name}
          </h1>
          <div style={{ fontSize: 14, color: C.muted, marginBottom: 4 }}>
            {[char.className, char.characterData?.subclass, char.species]
              .filter(Boolean).join(" · ")}
            <span style={{ marginLeft: 10, color: accentColor, fontWeight: 700, fontSize: 13 }}>
              Level {char.level}
            </span>
          </div>
          {char.playerName && (
            <div style={{ fontSize: 12, color: "rgba(160,180,220,0.45)" }}>Player: {char.playerName}</div>
          )}
          {char.campaigns.length > 0 && (
            <div style={{ display: "flex", gap: 5, flexWrap: "wrap", marginTop: 6 }}>
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

        {/* Edit */}
        <button
          onClick={() => navigate(`/characters/${char.id}/edit`)}
          style={{
            padding: "7px 16px", borderRadius: 8, cursor: "pointer",
            background: "rgba(255,255,255,0.06)",
            border: "1px solid rgba(255,255,255,0.16)",
            color: C.muted, fontWeight: 600, fontSize: 13, flexShrink: 0,
          }}>
          ✎ Edit
        </button>
      </div>

      {/* ── Two-column body ──────────────────────────────────────────── */}
      <div style={{ display: "flex", gap: 18, alignItems: "flex-start", flexWrap: "wrap" }}>

        {/* ── LEFT: Abilities + Saves + Skills ─────────────────────── */}
        <div style={{ flex: "0 0 270px", minWidth: 230, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Ability Scores */}
          <Panel>
            <PanelTitle color={accentColor}>Ability Scores</PanelTitle>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 7 }}>
              {ABILITY_KEYS.map((k) => {
                const score = scores[k];
                const m = mod(score);
                const isSave = prof ? isProficientIn(prof.saves, ABILITY_FULL[k]) : false;
                return (
                  <div key={k} style={{
                    textAlign: "center", padding: "8px 4px", borderRadius: 9,
                    background: "rgba(255,255,255,0.05)",
                    border: `1px solid ${isSave ? accentColor + "55" : "rgba(255,255,255,0.10)"}`,
                    position: "relative",
                  }}>
                    <div style={{ fontSize: 9, fontWeight: 700, color: C.muted, letterSpacing: "0.08em", marginBottom: 2 }}>
                      {ABILITY_LABELS[k]}
                    </div>
                    <div style={{ fontSize: 20, fontWeight: 900, lineHeight: 1, color: isSave ? accentColor : C.text }}>
                      {m >= 0 ? "+" : ""}{m}
                    </div>
                    <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>{score ?? "—"}</div>
                    {isSave && (
                      <div style={{
                        position: "absolute", top: 3, right: 4,
                        width: 5, height: 5, borderRadius: "50%",
                        background: accentColor,
                      }} title="Save proficiency" />
                    )}
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Saving Throws */}
          <Panel>
            <PanelTitle color={accentColor}>Saving Throws</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
              {ABILITY_KEYS.map((k) => {
                const isProfSave = prof ? isProficientIn(prof.saves, ABILITY_FULL[k]) : false;
                const bonus = mod(scores[k]) + (isProfSave ? pb : 0);
                const src = prof?.saves.find((s) => s.name.toLowerCase() === ABILITY_FULL[k].toLowerCase())?.source;
                return (
                  <div key={k} style={{
                    display: "flex", alignItems: "center", gap: 7,
                    padding: "3px 4px", borderRadius: 5,
                    background: isProfSave ? `${accentColor}0d` : "transparent",
                  }}>
                    <ProfDot filled={isProfSave} color={accentColor} />
                    <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, width: 28 }}>
                      {ABILITY_LABELS[k]}
                    </span>
                    <span style={{ fontSize: 11, color: C.muted, flex: 1 }}>{ABILITY_FULL[k]}</span>
                    <span style={{
                      fontSize: 13, fontWeight: 700, minWidth: 28, textAlign: "right",
                      color: isProfSave ? accentColor : C.text,
                    }}>
                      {isProfSave && src
                        ? <Tooltip text={src}>{fmtMod(bonus)}</Tooltip>
                        : fmtMod(bonus)
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Skills */}
          <Panel>
            <PanelTitle color={C.green}>Skills</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
              {ALL_SKILLS.map(({ name, abil }) => {
                const isProfSkill = prof ? isProficientIn(prof.skills, name) : false;
                const bonus = mod(scores[abil]) + (isProfSkill ? pb : 0);
                const src = prof?.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())?.source;
                return (
                  <div key={name} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "3px 4px", borderRadius: 4,
                    background: isProfSkill ? `${C.green}0d` : "transparent",
                  }}>
                    <ProfDot filled={isProfSkill} color={C.green} />
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: "rgba(160,180,220,0.45)",
                      letterSpacing: "0.04em", width: 24, textAlign: "center",
                    }}>
                      {ABILITY_LABELS[abil]}
                    </span>
                    <span style={{
                      fontSize: 12, color: isProfSkill ? C.text : C.muted,
                      flex: 1, fontWeight: isProfSkill ? 600 : 400,
                    }}>
                      {name}
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 700, minWidth: 26, textAlign: "right",
                      color: isProfSkill ? C.green : C.text,
                    }}>
                      {isProfSkill && src
                        ? <Tooltip text={src}>{fmtMod(bonus)}</Tooltip>
                        : fmtMod(bonus)
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

        </div>

        {/* ── RIGHT: Combat + Proficiencies + Spells + Features + Inventory ── */}
        <div style={{ flex: "1 1 360px", minWidth: 280, display: "flex", flexDirection: "column", gap: 14 }}>

          {/* HP bar + Combat Stats */}
          <Panel>
            <PanelTitle color={C.green}><IconHeart size={11} /> Hit Points</PanelTitle>
            <div style={{ marginBottom: 10 }}>
              <div style={{
                height: 28, borderRadius: 7,
                background: "rgba(255,255,255,0.07)",
                border: "1px solid rgba(255,255,255,0.12)",
                overflow: "hidden", position: "relative",
              }}>
                {/* HP fill */}
                <div style={{
                  position: "absolute", inset: 0, right: `${(1 - hpPct) * 100}%`,
                  background: hpPct > 0.5 ? C.green : hpPct > 0.25 ? "#f59e0b" : C.red,
                  borderRadius: 7, transition: "right 0.3s, background 0.3s",
                }} />
                {/* Temp HP fill (yellow, stacked after current HP) */}
                {tempHp > 0 && tempPct > 0 && (
                  <div style={{
                    position: "absolute", top: 0, bottom: 0,
                    left: `${hpPct * 100}%`,
                    width: `${tempPct * 100}%`,
                    background: "#f59e0b",
                    opacity: 0.7,
                  }} />
                )}
                <div style={{
                  position: "absolute", inset: 0,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  fontSize: 14, fontWeight: 800, color: "#fff",
                  textShadow: "0 1px 3px rgba(0,0,0,0.6)",
                }}>
                  {char.hpCurrent} / {effectiveHpMax}
                  {tempHp > 0 && (
                    <span style={{ fontSize: 11, marginLeft: 6, color: "#f59e0b", fontWeight: 700 }}>
                      +{tempHp} temp
                    </span>
                  )}
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                {hd !== null && (
                  <div style={{ fontSize: 11, color: C.muted }}>
                    Hit Dice: {char.level}d{hd}
                  </div>
                )}
                {overrides.hpMaxOverride !== null && (
                  <div style={{ fontSize: 11, color: "#f59e0b" }}>
                    HP max overridden
                  </div>
                )}
              </div>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              <MiniStat
                label="Armor Class"
                value={effectiveAc !== char.ac ? `${effectiveAc} (${fmtMod(overrides.acBonus)})` : String(effectiveAc)}
                accent={accentColor}
                icon={<IconShield size={11} />}
              />
              <MiniStat label="Speed" value={`${char.speed} ft`} icon={<IconSpeed size={11} />} />
              <MiniStat label="Initiative" value={fmtMod(mod(char.dexScore))} accent={accentColor} icon={<IconInitiative size={11} />} />
              <MiniStat label="Prof. Bonus" value={`+${pb}`} accent={accentColor} />
              <MiniStat label="Passive Perc." value={String(passivePerc)} />
              <MiniStat label="Passive Inv." value={String(passiveInv)} />
            </div>
          </Panel>

          {/* Conditions — always show so the player knows this panel is tracked */}
          <Panel>
            <PanelTitle color={C.red}><IconConditions size={11} /> Conditions</PanelTitle>
            {(char.conditions ?? []).length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(char.conditions!).map((c, i) => (
                  <span key={i} style={{
                    fontSize: 12, fontWeight: 700, padding: "4px 10px", borderRadius: 6,
                    background: `${C.red}18`, border: `1px solid ${C.red}44`,
                    color: C.red, textTransform: "capitalize",
                  }}>
                    {c.key.replace(/-/g, " ")}
                  </span>
                ))}
              </div>
            ) : (
              <div style={{ fontSize: 12, color: "rgba(160,180,220,0.3)", fontStyle: "italic" }}>
                No active conditions
              </div>
            )}
          </Panel>

          {/* Proficiencies */}
          {prof && (() => {
            const sections = [
              { label: "Armor",     items: prof.armor,     color: "#a78bfa" },
              { label: "Weapons",   items: prof.weapons,   color: "#f87171" },
              { label: "Tools",     items: prof.tools,     color: "#fb923c" },
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
                            <span style={{
                              fontSize: 12, padding: "3px 9px", borderRadius: 5, cursor: "default",
                              background: s.color + "18", border: `1px solid ${s.color}44`,
                              color: s.color, fontWeight: 600,
                            }}>
                              {item.name}
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

          {/* Spells & Invocations */}
          {prof && (prof.spells.length > 0 || prof.invocations.length > 0) && (
            <Panel>
              <PanelTitle color="#a78bfa">Spells &amp; Invocations</PanelTitle>
              {prof.spells.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    Known / Prepared
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {prof.spells.map((sp, i) => (
                      <Tooltip key={i} text={sp.source}>
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6, cursor: "default",
                          background: "rgba(167,139,250,0.14)", border: "1px solid rgba(167,139,250,0.35)",
                          color: "#a78bfa",
                        }}>
                          {sp.name}
                        </span>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}
              {prof.invocations.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    Eldritch Invocations
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {prof.invocations.map((inv, i) => (
                      <Tooltip key={i} text={inv.source}>
                        <span style={{
                          fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6, cursor: "default",
                          background: "rgba(251,146,60,0.14)", border: "1px solid rgba(251,146,60,0.35)",
                          color: "#fb923c",
                        }}>
                          {inv.name}
                        </span>
                      </Tooltip>
                    ))}
                  </div>
                </div>
              )}
            </Panel>
          )}

          {/* Class Features */}
          {char.characterData?.chosenOptionals && char.characterData.chosenOptionals.length > 0 && (
            <Panel>
              <PanelTitle color={C.green}>Class Features</PanelTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {char.characterData.chosenOptionals.map((f) => (
                  <span key={f} style={{
                    fontSize: 12, fontWeight: 600, padding: "3px 10px", borderRadius: 6,
                    background: "rgba(94,203,107,0.11)", border: "1px solid rgba(94,203,107,0.28)",
                    color: C.green,
                  }}>
                    {f}
                  </span>
                ))}
              </div>
            </Panel>
          )}

          {/* Inventory */}
          <InventoryPanel
            charId={char.id}
            charName={char.name}
            charData={char.characterData}
            accentColor={accentColor}
            onSave={saveCharacterData}
          />

          {/* Back button */}
          <div style={{ paddingTop: 4 }}>
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

        </div>
      </div>
    </Wrap>
  );
}

// ---------------------------------------------------------------------------
// Inventory Panel
// ---------------------------------------------------------------------------

function InventoryPanel({ charId, charName, charData, accentColor, onSave }: {
  charId: string;
  charName: string;
  charData: CharacterData | null;
  accentColor: string;
  onSave: (data: CharacterData) => Promise<unknown>;
}) {
  const [items, setItems] = useState<InventoryItem[]>(() =>
    (charData?.inventory ?? []) as InventoryItem[]
  );
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const nameRef = useRef<HTMLInputElement>(null);

  async function persist(updated: InventoryItem[]) {
    setSaving(true);
    try {
      await onSave({ inventory: updated });
      setItems(updated);
    } finally {
      setSaving(false);
    }
  }

  async function addItem() {
    const name = newName.trim();
    if (!name) return;
    const item: InventoryItem = {
      id: uid(),
      name,
      quantity: Math.max(1, newQty),
      equipped: false,
      notes: newNotes.trim() || undefined,
    };
    await persist([...items, item]);
    setNewName(""); setNewQty(1); setNewNotes(""); setAdding(false);
  }

  async function toggleEquipped(id: string) {
    await persist(items.map((it) => it.id === id ? { ...it, equipped: !it.equipped } : it));
  }

  async function removeItem(id: string) {
    await persist(items.filter((it) => it.id !== id));
  }

  async function changeQty(id: string, delta: number) {
    const updated = items.map((it) => {
      if (it.id !== id) return it;
      const q = Math.max(1, it.quantity + delta);
      return { ...it, quantity: q };
    });
    await persist(updated);
  }

  const equipped = items.filter((it) => it.equipped);
  const backpack = items.filter((it) => !it.equipped);

  return (
    <Panel>
      <PanelTitle color="#fbbf24">
        Inventory
        {saving && <span style={{ fontSize: 9, color: C.muted, marginLeft: 6, fontWeight: 400, textTransform: "none" }}>saving…</span>}
      </PanelTitle>

      {/* Equipped */}
      {equipped.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={subLabelStyle}>Equipped</div>
          {equipped.map((it) => (
            <ItemRow key={it.id} item={it} accentColor={accentColor}
              onToggle={toggleEquipped} onRemove={removeItem} onQty={changeQty} />
          ))}
        </div>
      )}

      {/* Backpack */}
      {backpack.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={subLabelStyle}>{equipped.length > 0 ? "Backpack" : "Items"}</div>
          {backpack.map((it) => (
            <ItemRow key={it.id} item={it} accentColor={accentColor}
              onToggle={toggleEquipped} onRemove={removeItem} onQty={changeQty} />
          ))}
        </div>
      )}

      {/* Add form */}
      {adding ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: items.length > 0 ? 10 : 0 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={nameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
              placeholder="Item name…"
              autoFocus
              style={inputStyle}
            />
            <input
              type="number"
              value={newQty}
              min={1}
              onChange={(e) => setNewQty(Number(e.target.value))}
              style={{ ...inputStyle, width: 56, textAlign: "center" }}
            />
          </div>
          <input
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)…"
            style={{ ...inputStyle, fontSize: 11, color: C.muted }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={addItem} disabled={!newName.trim()} style={addBtnStyle(accentColor)}>
              Add
            </button>
            <button onClick={() => { setAdding(false); setNewName(""); setNewQty(1); setNewNotes(""); }} style={cancelBtnStyle}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <button
          onClick={() => { setAdding(true); }}
          style={{
            marginTop: items.length > 0 ? 8 : 0,
            background: "transparent",
            border: "1px dashed rgba(255,255,255,0.18)",
            borderRadius: 7, padding: "5px 12px",
            color: C.muted, fontSize: 12, cursor: "pointer",
            width: "100%",
          }}>
          + Add item
        </button>
      )}
    </Panel>
  );
}

function ItemRow({ item, accentColor, onToggle, onRemove, onQty }: {
  item: InventoryItem;
  accentColor: string;
  onToggle: (id: string) => void;
  onRemove: (id: string) => void;
  onQty: (id: string, delta: number) => void;
}) {
  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 8,
      padding: "4px 2px",
      borderBottom: "1px solid rgba(255,255,255,0.05)",
    }}>
      {/* Equip toggle */}
      <button
        onClick={() => onToggle(item.id)}
        title={item.equipped ? "Unequip" : "Equip"}
        style={{
          width: 14, height: 14, borderRadius: "50%", flexShrink: 0, padding: 0,
          border: `1.5px solid ${item.equipped ? accentColor : "rgba(255,255,255,0.3)"}`,
          background: item.equipped ? accentColor : "transparent",
          cursor: "pointer",
        }}
      />

      {/* Name + notes */}
      <div style={{ flex: 1, minWidth: 0 }}>
        <span style={{ fontSize: 13, color: C.text, fontWeight: item.equipped ? 600 : 400 }}>
          {item.name}
        </span>
        {item.notes && (
          <span style={{ fontSize: 11, color: C.muted, marginLeft: 6 }}>{item.notes}</span>
        )}
      </div>

      {/* Quantity stepper */}
      <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
        {item.quantity > 1 && (
          <button onClick={() => onQty(item.id, -1)} style={stepperBtn}>−</button>
        )}
        {item.quantity > 1 && (
          <span style={{ fontSize: 12, color: C.muted, minWidth: 20, textAlign: "center" }}>
            ×{item.quantity}
          </span>
        )}
        <button onClick={() => onQty(item.id, +1)} style={stepperBtn}>+</button>
      </div>

      {/* Remove */}
      <button
        onClick={() => onRemove(item.id)}
        title="Remove"
        style={{
          background: "transparent", border: "none",
          color: "rgba(255,255,255,0.22)", cursor: "pointer",
          fontSize: 15, padding: "0 2px", lineHeight: 1, flexShrink: 0,
        }}>
        ×
      </button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  if (!text) return <>{children}</>;

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 5px)", left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(10,15,28,0.97)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 6, padding: "4px 8px",
          fontSize: 11, color: "rgba(160,180,220,0.85)",
          whiteSpace: "nowrap", zIndex: 200, pointerEvents: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function Wrap({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 1060, margin: "0 auto", padding: "28px 20px" }}>
        {children}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.035)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 12, padding: "14px 16px",
    }}>
      {children}
    </div>
  );
}

function PanelTitle({ children, color }: { children: React.ReactNode; color: string }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.1em", color,
      marginBottom: 10,
      display: "flex", alignItems: "center", gap: 8,
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: `${color}30` }} />
    </div>
  );
}

function ProfDot({ filled, color }: { filled: boolean; color: string }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: filled ? color : "transparent",
      border: `1.5px solid ${filled ? color : "rgba(255,255,255,0.2)"}`,
    }} />
  );
}

function MiniStat({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      textAlign: "center", padding: "8px 6px", borderRadius: 8,
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${accent ? accent + "33" : "rgba(255,255,255,0.09)"}`,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: 3,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
      }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: accent ?? C.text }}>
        {value}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

const subLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C.muted,
  textTransform: "uppercase", letterSpacing: "0.07em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  flex: 1, background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 7, padding: "6px 10px",
  color: C.text, fontSize: 13, outline: "none",
};

const stepperBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 4, width: 20, height: 20,
  color: C.muted, cursor: "pointer", fontSize: 13,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, lineHeight: 1,
};

function addBtnStyle(accent: string): React.CSSProperties {
  return {
    background: accent, color: "#000",
    border: "none", borderRadius: 7,
    padding: "6px 14px", fontSize: 13,
    fontWeight: 700, cursor: "pointer",
  };
}

const cancelBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 7, padding: "6px 14px",
  fontSize: 13, color: C.muted, cursor: "pointer",
};
