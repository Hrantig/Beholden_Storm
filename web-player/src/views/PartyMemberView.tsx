import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { IconPlayer, IconShield, IconSpeed, IconInitiative, IconHeart, IconConditionByKey } from "@/icons";
import { useWs } from "@/services/ws";
import type { PartyMember } from "./CampaignPartyView";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type AbilKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

const ABILITY_LABELS: Record<AbilKey, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};

const ALL_SKILLS: { name: string; abil: AbilKey }[] = [
  { name: "Acrobatics",      abil: "dex" }, { name: "Animal Handling", abil: "wis" },
  { name: "Arcana",          abil: "int" }, { name: "Athletics",       abil: "str" },
  { name: "Deception",       abil: "cha" }, { name: "History",         abil: "int" },
  { name: "Insight",         abil: "wis" }, { name: "Intimidation",    abil: "cha" },
  { name: "Investigation",   abil: "int" }, { name: "Medicine",        abil: "wis" },
  { name: "Nature",          abil: "int" }, { name: "Perception",      abil: "wis" },
  { name: "Performance",     abil: "cha" }, { name: "Persuasion",      abil: "cha" },
  { name: "Religion",        abil: "int" }, { name: "Sleight of Hand", abil: "dex" },
  { name: "Stealth",         abil: "dex" }, { name: "Survival",        abil: "wis" },
];

function mod(score: number | null): number { return Math.floor(((score ?? 10) - 10) / 2); }
function fmtMod(n: number): string { return (n >= 0 ? "+" : "") + n; }
function profBonus(level: number): number { return Math.ceil(level / 4) + 1; }
function isProfIn(list: { name: string }[], name: string): boolean {
  return list.some((s) => s.name.toLowerCase() === name.toLowerCase());
}
function hpColor(pct: number): string {
  if (pct <= 0) return "#6b7280";
  if (pct < 25) return "#f87171";
  if (pct < 50) return "#fb923c";
  if (pct < 75) return "#fbbf24";
  return "#4ade80";
}

// ---------------------------------------------------------------------------
// Mini sub-components
// ---------------------------------------------------------------------------

function Panel({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.035)", border: "1px solid rgba(255,255,255,0.08)",
      borderRadius: 14, padding: 14, ...style,
    }}>
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontSize: 10, fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(160,180,220,0.45)", marginBottom: 8 }}>
      {children}
    </div>
  );
}

function MiniStat({ label, value, icon, accent }: { label: string; value: string; icon?: React.ReactNode; accent?: string }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
      background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 4px",
    }}>
      {icon && <span style={{ opacity: 0.55, fontSize: 10 }}>{icon}</span>}
      <span style={{ fontSize: 17, fontWeight: 900, color: accent ?? C.text }}>{value}</span>
      <span style={{ fontSize: 9, color: C.muted, textAlign: "center", lineHeight: 1.2 }}>{label}</span>
    </div>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontSize: 12, padding: "3px 9px", borderRadius: 20, fontWeight: 600,
      background: `${color ?? C.accentHl}18`, border: `1px solid ${color ?? C.accentHl}44`,
      color: color ?? C.accentHl,
    }}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function PartyMemberView() {
  const { id: campaignId, playerId } = useParams<{ id: string; playerId: string }>();
  const navigate = useNavigate();
  const [member, setMember] = React.useState<PartyMember | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchMember = React.useCallback(() => {
    if (!campaignId) return;
    api<PartyMember[]>(`/api/campaigns/${campaignId}/party`)
      .then((list) => {
        const found = list.find((m) => m.id === playerId);
        if (found) setMember(found);
        else setError("Member not found.");
      })
      .catch((e) => setError(e?.message ?? "Failed to load."))
      .finally(() => setLoading(false));
  }, [campaignId, playerId]);

  React.useEffect(() => { fetchMember(); }, [fetchMember]);

  useWs(React.useCallback((msg) => {
    if (msg.type === "players:changed") {
      const cId = (msg.payload as any)?.campaignId as string | undefined;
      if (cId === campaignId) fetchMember();
    }
  }, [campaignId, fetchMember]));

  if (loading) return (
    <div style={{ height: "100%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
      Loading…
    </div>
  );
  if (error || !member) return (
    <div style={{ height: "100%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: "#f87171" }}>
      {error ?? "Not found."}
    </div>
  );

  const m = member;
  const cd = m.characterData as any;
  const prof = cd?.proficiencies as { skills?: { name: string }[]; saves?: { name: string }[]; armor?: { name: string }[]; weapons?: { name: string }[]; tools?: { name: string }[]; languages?: { name: string }[] } | undefined;
  const pb = profBonus(m.level);
  const color = m.color ?? C.accentHl;
  const hpC = hpColor(m.hpPercent);

  const scores: Record<AbilKey, number | null> = {
    str: m.strScore, dex: m.dexScore, con: m.conScore,
    int: m.intScore, wis: m.wisScore, cha: m.chaScore,
  };

  const passivePerc = 10 + mod(m.wisScore) + (prof && isProfIn(prof.skills ?? [], "Perception") ? pb : 0);
  const spells: string[] = cd?.chosenSpells ?? [];
  const cantrips: string[] = cd?.chosenCantrips ?? [];
  const invocations: string[] = cd?.chosenInvocations ?? [];
  const inventory: any[] = cd?.inventory ?? [];
  const classFeatures: { name: string; text?: string }[] = cd?.classFeatures ?? (cd?.chosenOptionals ?? []).map((n: string) => ({ name: n }));
  const playerNotes: { id: string; title: string; text: string }[] = cd?.playerNotesList ?? [];
  const sharedNotes: { id: string; title: string; text: string }[] = (() => {
    try { return cd?.sharedNotes ? JSON.parse(cd.sharedNotes) : []; } catch { return []; }
  })();

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text, fontFamily: "system-ui, Segoe UI, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "28px 20px" }}>

        {/* Back */}
        <button type="button" onClick={() => navigate(`/campaigns/${campaignId}`)}
          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 18 }}>
          ← Party
        </button>

        <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 14, alignItems: "start" }}>

          {/* ── COL 1: HUD + Abilities + Skills ─────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            <Panel>
              {/* Portrait + info */}
              <div style={{ display: "flex", gap: 12, alignItems: "flex-start", marginBottom: 12 }}>
                <div style={{
                  width: 64, height: 64, borderRadius: 10, flexShrink: 0,
                  background: `${color}22`, border: `2px solid ${color}55`,
                  overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
                }}>
                  {m.imageUrl
                    ? <img src={m.imageUrl} alt={m.characterName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                    : <IconPlayer size={32} style={{ opacity: 0.35 }} />}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <h2 style={{ margin: "0 0 2px", fontSize: 18, fontWeight: 900, letterSpacing: -0.5 }}>{m.characterName || "Unnamed"}</h2>
                  <div style={{ fontSize: 12, color: C.muted }}>
                    {[m.className, cd?.subclass, m.species].filter(Boolean).join(" · ")}
                    <span style={{ marginLeft: 8, color, fontWeight: 700, fontSize: 11 }}>Lv {m.level}</span>
                  </div>
                  {m.playerName && <div style={{ fontSize: 11, color: "rgba(160,180,220,0.4)", marginTop: 2 }}>Player: {m.playerName}</div>}
                </div>
              </div>

              {/* HP bar (obfuscated) */}
              <div style={{ marginBottom: 10 }}>
                <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                  <span style={{ fontSize: 11, display: "flex", alignItems: "center", gap: 4, color: hpC, fontWeight: 700 }}>
                    <IconHeart size={10} /> HP
                  </span>
                  <span style={{ fontSize: 11, color: C.muted }}>{m.hpPercent}%</span>
                </div>
                <div style={{ height: 10, borderRadius: 5, background: "rgba(255,255,255,0.07)", overflow: "hidden" }}>
                  <div style={{ height: "100%", borderRadius: 5, width: `${m.hpPercent}%`, background: hpC, transition: "width 0.4s" }} />
                </div>
              </div>

              {/* Mini stats */}
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 5, marginBottom: 10 }}>
                <MiniStat label="AC" value={String(m.ac)} accent={color} icon={<IconShield size={10} />} />
                <MiniStat label="Speed" value={m.speed ? `${m.speed}ft` : "—"} icon={<IconSpeed size={10} />} />
                <MiniStat label="Init" value={fmtMod(mod(m.dexScore))} accent={color} icon={<IconInitiative size={10} />} />
                <MiniStat label="Prof" value={`+${pb}`} accent={color} />
                <MiniStat label="Pass.Perc" value={String(passivePerc)} />
                <MiniStat label="HD" value={cd?.hd ? `d${cd.hd}` : "—"} />
              </div>

              {/* Conditions */}
              {m.conditions.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {m.conditions.map((c, i) => (
                    <span key={i} style={{
                      display: "inline-flex", alignItems: "center", gap: 3, fontSize: 11,
                      padding: "2px 7px", borderRadius: 20, fontWeight: 600,
                      background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5",
                    }}>
                      <IconConditionByKey condKey={(c as any).key} size={10} />
                      {(c as any).key}
                    </span>
                  ))}
                </div>
              )}
            </Panel>

            {/* Ability scores */}
            <Panel>
              <SectionLabel>Ability Scores</SectionLabel>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 6 }}>
                {(Object.keys(ABILITY_LABELS) as AbilKey[]).map((k) => {
                  const score = scores[k];
                  const m_ = mod(score);
                  const saveProf = isProfIn(prof?.saves ?? [], ABILITY_LABELS[k]);
                  return (
                    <div key={k} style={{
                      display: "flex", flexDirection: "column", alignItems: "center",
                      background: "rgba(255,255,255,0.04)", borderRadius: 8, padding: "6px 4px",
                    }}>
                      <span style={{ fontSize: 9, fontWeight: 800, color: "rgba(160,180,220,0.5)", textTransform: "uppercase", letterSpacing: "0.08em" }}>{ABILITY_LABELS[k]}</span>
                      <span style={{ fontSize: 20, fontWeight: 900, color: C.text, lineHeight: 1.1 }}>{score ?? "—"}</span>
                      <span style={{ fontSize: 13, fontWeight: 700, color }}>
                        {fmtMod(saveProf ? m_ + pb : m_)}
                        {saveProf && <span style={{ fontSize: 8, color, marginLeft: 2 }}>★</span>}
                      </span>
                    </div>
                  );
                })}
              </div>
            </Panel>

            {/* Skills */}
            {prof?.skills && prof.skills.length > 0 && (
              <Panel>
                <SectionLabel>Skills</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {ALL_SKILLS.map(({ name, abil }) => {
                    const proficient = isProfIn(prof.skills ?? [], name);
                    const score_ = scores[abil];
                    const bonus = mod(score_) + (proficient ? pb : 0);
                    return (
                      <div key={name} style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, opacity: proficient ? 1 : 0.45 }}>
                        <span style={{ width: 8, height: 8, borderRadius: "50%", flexShrink: 0, background: proficient ? color : "rgba(255,255,255,0.12)", border: `1px solid ${proficient ? color : "rgba(255,255,255,0.2)"}` }} />
                        <span style={{ flex: 1, color: C.text }}>{name}</span>
                        <span style={{ fontWeight: 700, color: proficient ? color : C.muted, minWidth: 24, textAlign: "right" }}>{fmtMod(bonus)}</span>
                        <span style={{ fontSize: 10, color: "rgba(160,180,220,0.35)", width: 22 }}>{ABILITY_LABELS[abil]}</span>
                      </div>
                    );
                  })}
                </div>
              </Panel>
            )}
          </div>

          {/* ── COL 2: Proficiencies + Features ─────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>

            {/* Armor / Weapons / Tools / Languages */}
            {(prof?.armor?.length || prof?.weapons?.length || prof?.tools?.length || prof?.languages?.length) ? (
              <Panel>
                <SectionLabel>Proficiencies</SectionLabel>
                {[
                  { label: "Armor", items: prof?.armor },
                  { label: "Weapons", items: prof?.weapons },
                  { label: "Tools", items: prof?.tools },
                  { label: "Languages", items: prof?.languages },
                ].map(({ label, items }) =>
                  items && items.length > 0 ? (
                    <div key={label} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(160,180,220,0.45)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>{label}</div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {items.map((item) => <Chip key={item.name} color={color}>{item.name}</Chip>)}
                      </div>
                    </div>
                  ) : null
                )}
              </Panel>
            ) : null}

            {/* Class features */}
            {classFeatures.length > 0 && (
              <Panel>
                <SectionLabel>Class Features</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                  {classFeatures.map((f, i) => (
                    <details key={i} style={{ fontSize: 12 }}>
                      <summary style={{ cursor: "pointer", fontWeight: 700, color: C.text, userSelect: "none", listStyle: "none" }}>
                        ▸ {f.name}
                      </summary>
                      {f.text && (
                        <div style={{ marginTop: 5, color: C.muted, lineHeight: 1.5, fontSize: 11, whiteSpace: "pre-wrap", paddingLeft: 10 }}>
                          {f.text}
                        </div>
                      )}
                    </details>
                  ))}
                </div>
              </Panel>
            )}

            {/* Notes */}
            {(playerNotes.length > 0 || sharedNotes.length > 0) && (
              <Panel>
                <SectionLabel>Notes</SectionLabel>
                {[...sharedNotes, ...playerNotes].map((note) => (
                  <details key={note.id} style={{ fontSize: 12, marginBottom: 5 }}>
                    <summary style={{ cursor: "pointer", fontWeight: 700, color: C.text, userSelect: "none", listStyle: "none" }}>
                      ▸ {note.title || "Untitled"}
                    </summary>
                    {note.text && (
                      <div style={{ marginTop: 4, color: C.muted, lineHeight: 1.5, fontSize: 11, whiteSpace: "pre-wrap", paddingLeft: 10 }}>
                        {note.text}
                      </div>
                    )}
                  </details>
                ))}
              </Panel>
            )}
          </div>

          {/* ── COL 3: Spells ───────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {(cantrips.length > 0 || spells.length > 0 || invocations.length > 0) && (
              <Panel>
                <SectionLabel>Spells & Invocations</SectionLabel>
                {cantrips.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(160,180,220,0.45)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Cantrips</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {cantrips.map((s, i) => <SpellRow key={i} name={s} color={color} />)}
                    </div>
                  </div>
                )}
                {spells.length > 0 && (
                  <div style={{ marginBottom: 10 }}>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(160,180,220,0.45)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Spells</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {spells.map((s, i) => <SpellRow key={i} name={s} color={color} />)}
                    </div>
                  </div>
                )}
                {invocations.length > 0 && (
                  <div>
                    <div style={{ fontSize: 10, fontWeight: 700, color: "rgba(160,180,220,0.45)", textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>Invocations</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                      {invocations.map((s, i) => <SpellRow key={i} name={s} color={color} />)}
                    </div>
                  </div>
                )}
              </Panel>
            )}
          </div>

          {/* ── COL 4: Inventory ────────────────────────────────────── */}
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {inventory.length > 0 && (
              <Panel>
                <SectionLabel>Inventory</SectionLabel>
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  {inventory.map((item: any, i: number) => (
                    <div key={i} style={{
                      display: "flex", alignItems: "center", gap: 8, fontSize: 12,
                      padding: "5px 8px", borderRadius: 6,
                      background: item.equipped ? `${color}10` : "transparent",
                      border: `1px solid ${item.equipped ? color + "30" : "rgba(255,255,255,0.05)"}`,
                    }}>
                      {item.quantity > 1 && (
                        <span style={{ fontSize: 11, color: C.muted, fontWeight: 700, minWidth: 20 }}>×{item.quantity}</span>
                      )}
                      <span style={{ flex: 1, color: item.equipped ? C.text : C.muted, fontWeight: item.equipped ? 600 : 400 }}>
                        {item.name}
                      </span>
                      {item.equipped && <span style={{ fontSize: 10, color, fontWeight: 700 }}>Equip</span>}
                      {item.dmg1 && <span style={{ fontSize: 10, color: "#fb923c" }}>{item.dmg1}</span>}
                    </div>
                  ))}
                </div>
              </Panel>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}

function SpellRow({ name, color }: { name: string; color: string }) {
  return (
    <div style={{ fontSize: 12, color: C.muted, padding: "2px 0", borderBottom: "1px solid rgba(255,255,255,0.04)", display: "flex", alignItems: "center", gap: 6 }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: color, flexShrink: 0, opacity: 0.7 }} />
      {name}
    </div>
  );
}
