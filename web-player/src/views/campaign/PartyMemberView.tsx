import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import { api, jsonInit } from "@/services/api";
import { IconPlayer, IconHeart, IconMovement, IconShield } from "@/icons";
import { useWs } from "@/services/ws";
import { useAuth } from "@/contexts/AuthContext";
import type { PartyMember } from "./CampaignPartyView";
import { CONDITION_DEFS } from "@/domain/conditions";
import type { ConditionInstance } from "@/domain/conditions";
import InjuryDialog from "./InjuryDialog";
import { conditionIconByKey } from "@/icons/conditions";

// ---------------------------------------------------------------------------
// Notes types
// ---------------------------------------------------------------------------

interface SharedNote {
  id: string;
  title: string;
  text: string;
  source?: "dm" | "player";
}

function parseNotes(raw: string | undefined): SharedNote[] {
  if (!raw) return [];
  try { return JSON.parse(raw) as SharedNote[]; } catch { return []; }
}

function noteUid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

// ---------------------------------------------------------------------------
// Sub-components (shared with CampaignPartyView style)
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
    <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 900, textTransform: "uppercase", letterSpacing: "0.1em", color: "rgba(160,180,220,0.45)", marginBottom: 8 }}>
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
      {icon && <span style={{ opacity: 0.55, fontSize: "var(--fs-tiny)" }}>{icon}</span>}
      <span style={{ fontSize: "var(--fs-large)", fontWeight: 900, color: accent ?? C.text }}>{value}</span>
      <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, textAlign: "center", lineHeight: 1.2 }}>{label}</span>
    </div>
  );
}

function Chip({ children, color }: { children: React.ReactNode; color?: string }) {
  return (
    <span style={{
      fontSize: "var(--fs-small)", padding: "3px 9px", borderRadius: 20, fontWeight: 600,
      background: `${color ?? C.accentHl}18`, border: `1px solid ${color ?? C.accentHl}44`,
      color: color ?? C.accentHl,
    }}>
      {children}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Resource row with optional self-edit controls
// ---------------------------------------------------------------------------

function ResourceRow({
  label, current, max, color, icon, canEdit, onApply,
}: {
  label: string;
  current: number;
  max: number;
  color?: string;
  icon?: React.ReactNode;
  canEdit?: boolean;
  onApply?: (newVal: number) => void;
}) {
  const [input, setInput] = React.useState("");
  const pct = max > 0 ? Math.max(0, Math.min(100, Math.round((current / max) * 100))) : 0;
  const barColor = label === "HP"
  ? (pct <= 0 ? "#6b7280" : pct < 25 ? "#f87171" : pct < 50 ? "#fb923c" : pct < 75 ? "#fbbf24" : "#4ade80")
  : (color ?? C.accentHl);
  const amount = parseInt(input, 10);
  const isValid = !isNaN(amount) && amount > 0;

  return (
    <div style={{ marginBottom: 10 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 4 }}>
        <span style={{ fontSize: "var(--fs-small)", color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
          {icon}
          {label}
        </span>
        <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: barColor, fontVariantNumeric: "tabular-nums" }}>
          {current}/{max}
        </span>
      </div>
      <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
        <div style={{ height: "100%", borderRadius: 3, width: `${pct}%`, background: barColor, transition: "width 0.3s" }} />
      </div>
      {canEdit && onApply && (
        <div style={{ display: "flex", gap: 6, marginTop: 6, alignItems: "center" }}>
          <button type="button" disabled={!isValid}
            onClick={() => { if (isValid) { onApply(Math.max(0, current - amount)); setInput(""); } }}
            style={{ background: "rgba(239,68,68,0.15)", border: "1px solid rgba(239,68,68,0.4)", color: "#f87171", borderRadius: 6, padding: "3px 0", flex: 1, cursor: isValid ? "pointer" : "default", opacity: isValid ? 1 : 0.4, fontSize: "var(--fs-small)", fontWeight: 700 }}>
            {label === "HP" ? "DMG" : "−"}
          </button>
          <input type="number" min={1} value={input} onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && isValid && onApply) { onApply(Math.max(0, current - amount)); setInput(""); } }}
            placeholder="Amount"
            style={{ flex: 1, border: "1px solid rgba(255,255,255,0.12)", background: "transparent", color: C.text, borderRadius: 6, padding: "3px 8px", fontSize: "var(--fs-small)", outline: "none", textAlign: "center" }} />
          <button type="button" disabled={!isValid}
            onClick={() => { if (isValid) { onApply(Math.min(max, current + amount)); setInput(""); } }}
            style={{ background: "rgba(34,197,94,0.15)", border: "1px solid rgba(34,197,94,0.4)", color: "#4ade80", borderRadius: 6, padding: "3px 0", flex: 1, cursor: isValid ? "pointer" : "default", opacity: isValid ? 1 : 0.4, fontSize: "var(--fs-small)", fontWeight: 700 }}>
            {label === "HP" ? "HEAL" : "+"}
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function PartyMemberView() {
  const { id: campaignId, playerId } = useParams<{ id: string; playerId: string }>();
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [member, setMember] = React.useState<PartyMember | null>(null);
  const [editing, setEditing] = React.useState(false);
  const [editForm, setEditForm] = React.useState({
    characterName: "", ancestry: "", paths: "",
    level: "", movement: "",
    defensePhysical: "", defenseCognitive: "", defenseSpiritual: "",
    deflect: "", hpMax: "", focusMax: "", investitureMax: "",
  });
  const [saving, setSaving] = React.useState(false);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [noteExpanded, setNoteExpanded] = React.useState<string[]>([]);
  const [noteEditing, setNoteEditing] = React.useState<string | null>(null);
  const [noteTitle, setNoteTitle] = React.useState("");
  const [noteText, setNoteText] = React.useState("");
  const [noteSaving, setNoteSaving] = React.useState(false);
  const [injuryDialogOpen, setInjuryDialogOpen] = React.useState(false);
  const [prevHp, setPrevHp] = React.useState<number | null>(null);
  const [showConditions, setShowConditions] = React.useState(false);
  const [conditionSearch, setConditionSearch] = React.useState("");

  const [campaignNotes, setCampaignNotes] = React.useState<SharedNote[]>([]);
  const [encounterId, setEncounterId] = React.useState<string | null>(null);
  const [combatantId, setCombatantId] = React.useState<string | null>(null);
  const [declarationsLocked, setDeclarationsLocked] = React.useState(false);
  const [myPhase, setMyPhase] = React.useState<"fast" | "slow" | null>(null);
  const [currentPhase, setCurrentPhase] = React.useState<string | null>(null);
  const [round, setRound] = React.useState<number>(1);

  const [actionPointsUsed, setActionPointsUsed] = React.useState(0);
  
  const [encounterName, setEncounterName] = React.useState<string | null>(null);

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

  const fetchCombatState = React.useCallback(async () => {
    if (!campaignId) return;
    try {
      const combatant = await api<{
        id: string;
        encounterId: string;
        encounterName: string;
        phase: "fast" | "slow" | null;
        actionPointsUsed: number;
      } | null>(`/api/me/combatant?campaignId=${campaignId}`);

      if (combatant) {
        setCombatantId(combatant.id);
        setEncounterId(combatant.encounterId);
        setMyPhase(combatant.phase);
        setActionPointsUsed(combatant.actionPointsUsed ?? 0);

        const state = await api<{
          currentPhase: string;
          declarationsLocked: boolean;
          round: number;
        }>(`/api/encounters/${combatant.encounterId}/combatState`);

        setCurrentPhase(state.currentPhase);
        setDeclarationsLocked(state.declarationsLocked);
        setRound(state.round);
        setEncounterName(combatant.encounterName);
      } else {
        setCombatantId(null);
        setEncounterId(null);
        setMyPhase(null);
        setCurrentPhase(null);
        setDeclarationsLocked(false);
        setEncounterName(null);
      }
    } catch { /* best effort */ }
  }, [campaignId]);

  // Poll combat state every 5 seconds to catch encounter switches
  React.useEffect(() => {
    const interval = setInterval(() => {
      void fetchCombatState();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchCombatState]);

  React.useEffect(() => { fetchMember(); }, [fetchMember]);
  React.useEffect(() => { void fetchCombatState();}, [fetchCombatState]);

  React.useEffect(() => {
    if (!campaignId) return;
    api<{ id: string; name: string; sharedNotes?: string }[]>("/api/me/campaigns")
      .then((list) => {
        const c = list.find((c) => c.id === campaignId);
        if (c) setCampaignNotes(parseNotes(c.sharedNotes));
      })
      .catch(() => {});
  }, [campaignId]);

  // Poll combat state every 5 seconds to catch encounter switches
  React.useEffect(() => {
    const interval = setInterval(() => {
      void fetchCombatState();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchCombatState]);

  useWs(React.useCallback((msg) => {
    if (msg.type === "players:changed") {
      const cId = (msg.payload as any)?.campaignId as string | undefined;
      if (cId === campaignId) fetchMember();
    }
  }, [campaignId, fetchMember]));

  useWs(React.useCallback((msg) => {
  if (
    msg.type === "encounter:combatStateChanged" ||
    msg.type === "encounter:combatantsChanged" ||
    msg.type === "players:changed"
  ) {
    void fetchCombatState();
  }
}, [fetchCombatState]));

  React.useEffect(() => {
    if (!member) return;
    setEditForm({
      characterName: member.characterName,
      ancestry: member.ancestry,
      paths: (member.paths ?? []).join(", "),
      level: String(member.level),
      movement: String(member.movement),
      defensePhysical: String(member.defensePhysical),
      defenseCognitive: String(member.defenseCognitive),
      defenseSpiritual: String(member.defenseSpiritual),
      deflect: String(member.deflect),
      hpMax: String(member.hpMax),
      focusMax: String(member.focusMax),
      investitureMax: String(member.investitureMax ?? 0),
    });
  }, [member]);

  React.useEffect(() => {
    if (!member) return;
    const hp = member.hpCurrent;
    if (prevHp !== null && prevHp > 0 && hp <= 0) {
      setInjuryDialogOpen(true);
    }
    setPrevHp(hp);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [member?.hpCurrent]);

  if (loading) return (
    <div style={{ height: "100%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.muted }}>
      Loading…
    </div>
  );
  if (error || !member) return (
    <div style={{ height: "100%", background: C.bg, display: "flex", alignItems: "center", justifyContent: "center", color: C.colorPinkRed }}>
      {error ?? "Not found."}
    </div>
  );

  const m = member;
  const isOwn = m.userId !== null && m.userId === authUser?.id;
  const color = m.color ?? C.accentHl;
  const subtitle = [m.ancestry, ...(m.paths ?? [])].filter(Boolean).join(" · ");

  const patchSelf = async (patch: { hpCurrent?: number; focusCurrent?: number; investitureCurrent?: number | null }) => {
    try {
      await api(`/api/me/players/${m.id}`, jsonInit("PUT", patch));
      fetchMember();
    } catch { /* best-effort */ }
  };

  const applyCondition = async (conditionKey: string, detail?: string) => {
    const existing = m.conditions ?? [];
    const def = CONDITION_DEFS.find((d) => d.key === conditionKey);
    const newCondition: ConditionInstance = {
      key: conditionKey,
      ...(detail ? { casterId: detail } : {}),
    };
    const updated = def?.stackable ? [...existing, newCondition] : [...existing.filter((c) => c.key !== conditionKey), newCondition];
    await api(`/api/me/players/${m.id}`, jsonInit("PUT", { conditions: updated }));
    fetchMember();
  };

  const removeCondition = async (index: number) => {
    const updated = (m.conditions ?? []).filter((_, i) => i !== index);
    await api(`/api/me/players/${m.id}`, jsonInit("PUT", { conditions: updated }));
    fetchMember();
  };

  const incrementInjuryCount = async () => {
    await api(`/api/me/players/${m.id}`, jsonInit("PUT", { injuryCount: (m.injuryCount ?? 0) + 1 }));
    fetchMember();
  };

  const adjustInjuryCount = async (delta: number) => {
    const next = Math.max(0, (m.injuryCount ?? 0) + delta);
    await api(`/api/me/players/${m.id}`, jsonInit("PUT", { injuryCount: next }));
    fetchMember();
  };

  const dmNotes = campaignNotes;
  const playerNotes = parseNotes(m?.sharedNotes).filter((n) => n.source === "player");

  function openNewNote() {
    setNoteTitle("");
    setNoteText("");
    setNoteEditing("new");
  }

  function openEditNote(note: SharedNote) {
    setNoteTitle(note.title);
    setNoteText(note.text);
    setNoteEditing(note.id);
  }

  async function saveNote() {
    if (!m) return;
    setNoteSaving(true);
    try {
      const existing = parseNotes(m.sharedNotes);
      let updated: SharedNote[];
      if (noteEditing === "new") {
        updated = [...existing, { id: noteUid(), title: noteTitle || "Note", text: noteText, source: "player" }];
      } else {
        updated = existing.map((n) =>
          n.id === noteEditing ? { ...n, title: noteTitle || "Note", text: noteText } : n
        );
      }
      await api(`/api/me/players/${m.id}/sharedNotes`, jsonInit("PATCH", { sharedNotes: JSON.stringify(updated) }));
      await fetchMember();
      setNoteEditing(null);
    } finally { setNoteSaving(false); }
  }

  async function deleteNote(noteId: string) {
    if (!m) return;
    const updated = parseNotes(m.sharedNotes).filter((n) => n.id !== noteId);
    await api(`/api/me/players/${m.id}/sharedNotes`, jsonInit("PATCH", { sharedNotes: JSON.stringify(updated) }));
    await fetchMember();
  }

  const saveEdit = async () => {
    setSaving(true);
    try {
      await api(`/api/me/players/${m.id}`, jsonInit("PUT", {
        characterName: editForm.characterName.trim(),
        ancestry: editForm.ancestry.trim(),
        paths: editForm.paths.split(",").map((p) => p.trim()).filter(Boolean),
        level: Number(editForm.level) || 1,
        movement: Number(editForm.movement) || 0,
        defensePhysical: Number(editForm.defensePhysical) || 0,
        defenseCognitive: Number(editForm.defenseCognitive) || 0,
        defenseSpiritual: Number(editForm.defenseSpiritual) || 0,
        deflect: Number(editForm.deflect) || 0,
        hpMax: Number(editForm.hpMax) || 1,
        focusMax: Number(editForm.focusMax) || 0,
        investitureMax: Number(editForm.investitureMax) || null,
      }));
      await fetchMember();
      setEditing(false);
    } catch { /* best-effort */ }
    finally { setSaving(false); }
  };

  return (
    <>
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text, fontFamily: "system-ui, Segoe UI, Arial, sans-serif" }}>
      <div style={{ maxWidth: 500, margin: "0 auto", padding: "28px 20px" }}>

        <button type="button" onClick={() => navigate(`/campaigns/${campaignId}`)}
          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: "var(--fs-subtitle)", padding: 0, marginBottom: 18 }}>
          ← Party
        </button>

        {/* Header */}
        <Panel style={{ marginBottom: 12 }}>
          <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>
            <div style={{
              width: 72, height: 72, borderRadius: 12, flexShrink: 0,
              background: `${color}22`, border: `2px solid ${color}55`,
              overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
            }}>
              {m.imageUrl
                ? <img src={m.imageUrl} alt={m.characterName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                : <IconPlayer size={36} style={{ opacity: 0.35 }} />}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 8 }}>
                <h2 style={{ margin: "0 0 2px", fontSize: "var(--fs-title)", fontWeight: 900, letterSpacing: -0.5 }}>
                  {m.characterName || "Unnamed"}
                </h2>
                {isOwn && (
                  <button type="button" onClick={() => setEditing((v) => !v)}
                    style={{ background: "none", border: "none", color: C.accentHl, cursor: "pointer", fontSize: "var(--fs-small)", fontWeight: 700, padding: 0, flexShrink: 0, marginTop: 4 }}>
                    {editing ? "Cancel" : "Edit"}
                  </button>
                )}
              </div>
              {subtitle && (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 2 }}>{subtitle}</div>
              )}
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                <Chip color={color}>Level {m.level}</Chip>
                {isOwn && <Chip color="#4ade80">Your character</Chip>}
              </div>
              {m.playerName && (
                <div style={{ fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.4)", marginTop: 4 }}>Player: {m.playerName}</div>
              )}
            </div>
          </div>

          {/* Inline edit form */}
          {isOwn && editing && (
            <div style={{ marginTop: 14, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              {[
                { label: "Character Name", key: "characterName" },
                { label: "Ancestry", key: "ancestry" },
                { label: "Paths (comma separated)", key: "paths" },
              ].map(({ label, key }) => (
                <div key={key}>
                  <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 3 }}>{label}</div>
                  <input value={editForm[key as keyof typeof editForm]}
                    onChange={(e) => setEditForm((s) => ({ ...s, [key]: e.target.value }))}
                    style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 8px", color: C.text, fontSize: "var(--fs-small)" }} />
                </div>
              ))}
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {[
                  { label: "Level", key: "level" },
                  { label: "Movement", key: "movement" },
                  { label: "HP Max", key: "hpMax" },
                  { label: "Focus Max", key: "focusMax" },
                  { label: "Investiture Max", key: "investitureMax" },
                  { label: "Deflect", key: "deflect" },
                  { label: "Def Physical", key: "defensePhysical" },
                  { label: "Def Cognitive", key: "defenseCognitive" },
                  { label: "Def Spiritual", key: "defenseSpiritual" },
                ].map(({ label, key }) => (
                  <div key={key}>
                    <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 3 }}>{label}</div>
                    <input type="number" value={editForm[key as keyof typeof editForm]}
                      onChange={(e) => setEditForm((s) => ({ ...s, [key]: e.target.value }))}
                      style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 6px", color: C.text, fontSize: "var(--fs-small)" }} />
                  </div>
                ))}
              </div>
              <button type="button" onClick={saveEdit} disabled={saving}
                style={{ background: C.accentHl, color: C.textDark, border: "none", borderRadius: 8, padding: "8px 0", fontWeight: 700, fontSize: "var(--fs-body)", cursor: saving ? "default" : "pointer", opacity: saving ? 0.6 : 1 }}>
                {saving ? "Saving…" : "Save Changes"}
              </button>
            </div>
          )}
        </Panel>

        {/* Resources */}
        <Panel style={{ marginBottom: 12 }}>
          <SectionLabel>Resources</SectionLabel>
          <ResourceRow
            label="HP"
            current={m.hpCurrent}
            max={m.hpMax}
            icon={<IconHeart size={10} />}
            canEdit={isOwn}
            onApply={(v) => patchSelf({ hpCurrent: v })}
          />
          {/* Focus dots */}
          <div style={{ marginBottom: 10 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted, display: "flex", alignItems: "center", gap: 4 }}>
                Focus
              </span>
              <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: "#7dd3fc", fontVariantNumeric: "tabular-nums" }}>
                {m.focusCurrent}/{m.focusMax}
              </span>
            </div>
            <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
              {Array.from({ length: m.focusMax }).map((_, i) => (
                <span
                  key={i}
                  onClick={isOwn ? () => {
                    const cur = m.focusCurrent;
                    const next = i < cur ? i : i + 1;
                    patchSelf({ focusCurrent: Math.max(0, Math.min(next, m.focusMax)) });
                  } : undefined}
                  style={{
                    fontSize: "var(--fs-large)", cursor: isOwn ? "pointer" : "default",
                    color: i < m.focusCurrent ? "#7dd3fc" : "rgba(255,255,255,0.2)",
                  }}
                >
                  {i < m.focusCurrent ? "◉" : "○"}
                </span>
              ))}
            </div>
          </div>
          {m.investitureMax !== null && m.investitureMax > 0 && (
            <div style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>Investiture</span>
                <span style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: "#f59e0b", fontVariantNumeric: "tabular-nums" }}>
                  {m.investitureCurrent ?? 0}/{m.investitureMax}
                </span>
              </div>
              <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                {Array.from({ length: m.investitureMax }).map((_, i) => (
                  <span
                    key={i}
                    onClick={isOwn ? () => {
                      const cur = m.investitureCurrent ?? 0;
                      const next = i < cur ? i : i + 1;
                      patchSelf({ investitureCurrent: Math.max(0, Math.min(next, m.investitureMax!)) });
                    } : undefined}
                    style={{
                      fontSize: "var(--fs-large)", cursor: isOwn ? "pointer" : "default",
                      color: i < (m.investitureCurrent ?? 0) ? "#f59e0b" : "rgba(255,255,255,0.2)",
                    }}
                  >
                    {i < (m.investitureCurrent ?? 0) ? "✦" : "✧"}
                  </span>
                ))}
              </div>
            </div>
          )}
        </Panel>

        
        {isOwn && combatantId && (
          <Panel style={{ marginBottom: 12 }}>
            <SectionLabel>{encounterName ?? "Combat"} — Round {round}</SectionLabel>

            {/* Phase declaration */}
            <div style={{ marginBottom: 10 }}>
              <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 6 }}>
                Phase Declaration {declarationsLocked ? "(locked)" : ""}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                {(["fast", "slow"] as const).map((p) => (
                  <button key={p} type="button"
                    disabled={declarationsLocked}
                    onClick={async () => {
                      if (declarationsLocked || !combatantId || !encounterId) return;
                      try {
                        await api(`/api/encounters/${encounterId}/combatants/${combatantId}/phase`,
                          jsonInit("PATCH", { phase: p }));
                        setMyPhase(p);
                      } catch { /* best effort */ }
                    }}
                    style={{
                      flex: 1, padding: "8px 0", borderRadius: 8, fontWeight: 700,
                      fontSize: "var(--fs-body)", cursor: declarationsLocked ? "default" : "pointer",
                      border: myPhase === p ? `2px solid ${color}` : "1px solid rgba(255,255,255,0.15)",
                      background: myPhase === p ? `${color}22` : "transparent",
                      color: myPhase === p ? color : C.muted,
                      opacity: declarationsLocked && myPhase !== p ? 0.4 : 1,
                    }}>
                    {p === "fast" ? "⚡ Fast" : "🐢 Slow"}
                  </button>
                ))}
              </div>
            </div>

            {/* Action points */}
            <div>
              <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 6 }}>
                Action Points — {myPhase?.includes("fast") ? "Fast turn (2 AP)" : "Slow turn (3 AP)"}
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button"
                  onClick={async () => {
                    if (!combatantId || !encounterId) return;
                    const maxAp = myPhase?.includes("fast") ? 2 : 3;
                    const next = Math.min(actionPointsUsed + 1, maxAp);
                    setActionPointsUsed(next);
                    await api(`/api/encounters/${encounterId}/combatants/${combatantId}/phase`,
                      jsonInit("PATCH", { actionPointsUsed: next })).catch(() => {});
                  }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: C.muted, fontSize: "var(--fs-medium)", padding: "0 2px" }}>−</button>
                <div style={{ display: "flex", gap: 3 }}>
                  {Array.from({ length: myPhase?.includes("fast") ? 2 : 3 }).map((_, i) => {
                    const maxAp = myPhase?.includes("fast") ? 2 : 3;
                    const remaining = Math.max(0, maxAp - actionPointsUsed);
                    return (
                      <span key={i}
                        onClick={async () => {
                          if (!combatantId || !encounterId) return;
                          const next = i < remaining ? i : i + 1;
                          const nextUsed = maxAp - Math.max(0, Math.min(next, maxAp));
                          setActionPointsUsed(nextUsed);
                          await api(`/api/encounters/${encounterId}/combatants/${combatantId}/phase`,
                            jsonInit("PATCH", { actionPointsUsed: nextUsed })).catch(() => {});
                        }}
                        title={i < remaining ? "Click to spend" : "Click to restore"}
                        style={{
                          fontSize: 22, cursor: "pointer",
                          color: i < remaining ? color : C.muted,
                          opacity: i < remaining ? 1 : 0.4,
                        }}>▶</span>
                    );
                  })}
                </div>
                <button type="button"
                  onClick={async () => {
                    if (!combatantId || !encounterId) return;
                    const next = Math.max(actionPointsUsed - 1, 0);
                    setActionPointsUsed(next);
                    await api(`/api/encounters/${encounterId}/combatants/${combatantId}/phase`,
                      jsonInit("PATCH", { actionPointsUsed: next })).catch(() => {});
                  }}
                  style={{ background: "transparent", border: "none", cursor: "pointer", color: C.muted, fontSize: "var(--fs-medium)", padding: "0 2px" }}>+</button>
              </div>
            </div>
          </Panel>
        )}

        {/* Defenses + Movement */}
        <Panel style={{ marginBottom: 12 }}>
          <SectionLabel>Defenses & Movement</SectionLabel>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(5, 1fr)", gap: 6 }}>
            <MiniStat label="Physical" value={String(m.defensePhysical)} accent={color} 
              icon={<IconShield size={14} style={{ color: "#f87171" }} />} />
            <MiniStat label="Cognitive" value={String(m.defenseCognitive)} accent={color} 
              icon={<IconShield size={14} style={{ color: "#7dd3fc" }} />} />
            <MiniStat label="Spiritual" value={String(m.defenseSpiritual)} accent={color} 
              icon={<IconShield size={14} style={{ color: "#a78bfa" }} />} />
            <MiniStat label="Deflect" value={String(m.deflect)} 
              icon={<IconShield size={14} style={{ color: "#fbbf24" }} />} />
            <MiniStat label="Movement" value={`${m.movement}ft`} 
              icon={<IconMovement size={14} />} />
          </div>
        </Panel>

        {/* Status */}
        <Panel style={{ marginBottom: 12 }}>
          <SectionLabel>Status</SectionLabel>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 10 }}>
            <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>Injuries:</span>
            {isOwn ? (
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button type="button" onClick={() => adjustInjuryCount(-1)}
                  style={{ all: "unset", cursor: "pointer", width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 14 }}>−</button>
                <span style={{ fontWeight: 700, color: m.injuryCount > 0 ? "#f87171" : C.text, minWidth: 16, textAlign: "center" }}>{m.injuryCount}</span>
                <button type="button" onClick={() => adjustInjuryCount(1)}
                  style={{ all: "unset", cursor: "pointer", width: 20, height: 20, borderRadius: 4, border: "1px solid rgba(255,255,255,0.15)", display: "flex", alignItems: "center", justifyContent: "center", color: C.muted, fontSize: 14 }}>+</button>
                <button type="button" onClick={() => setInjuryDialogOpen(true)}
                  style={{ background: "rgba(239,68,68,0.12)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 6, color: "#f87171", cursor: "pointer", fontSize: "var(--fs-small)", fontWeight: 700, padding: "2px 8px", marginLeft: 4 }}>
                  Roll Injury
                </button>
              </div>
            ) : (
              <span style={{ fontWeight: 700, color: m.injuryCount > 0 ? "#f87171" : C.text }}>{m.injuryCount}</span>
            )}
          </div>

          {/* Conditions */}
          <div>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
              <span style={{ fontSize: "var(--fs-small)", color: C.muted }}>Conditions</span>
              {isOwn && (
                <button type="button" onClick={() => setShowConditions((v) => !v)}
                  style={{ background: "none", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 6, color: C.muted, cursor: "pointer", fontSize: "var(--fs-small)", padding: "1px 8px" }}>
                  {showConditions ? "Done" : "+ Add"}
                </button>
              )}
            </div>

            {m.conditions.length > 0 ? (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: showConditions ? 8 : 0 }}>
                {m.conditions.map((c, i) => {
                  const def = CONDITION_DEFS.find((d) => d.key === c.key);
                  const CondIcon = conditionIconByKey[c.key as keyof typeof conditionIconByKey];
                  return (
                    <span key={i}
                      title={def?.description ?? c.key}
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        fontSize: "var(--fs-small)", padding: "2px 7px", borderRadius: 20, fontWeight: 600,
                        background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)", color: "#fca5a5",
                      }}>
                      {CondIcon ? <CondIcon size={11} /> : null}
                      {c.key}{c.casterId ? ` ${c.casterId}` : ""}
                      {isOwn && (
                        <button type="button" onClick={() => removeCondition(i)}
                          style={{ all: "unset", cursor: "pointer", marginLeft: 2, opacity: 0.6, fontSize: 11 }}>✕</button>
                      )}
                    </span>
                  );
                })}
              </div>
            ) : (
              <span style={{ fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.3)" }}>No active conditions</span>
            )}

            {isOwn && showConditions && (
              <div style={{ marginTop: 8, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 8 }}>
                <input
                  value={conditionSearch}
                  onChange={(e) => setConditionSearch(e.target.value)}
                  placeholder="Search conditions…"
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "4px 8px", color: C.text, fontSize: "var(--fs-small)", marginBottom: 6 }}
                />
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                  {CONDITION_DEFS
                    .filter((d) => d.key.includes(conditionSearch.toLowerCase()) || d.name.toLowerCase().includes(conditionSearch.toLowerCase()))
                    .map((def) => (
                      <button key={def.key} type="button"
                        onClick={() => {
                          const detail = def.needsDetail
                            ? prompt(
                                def.key === "enhanced" ? "Enter detail (e.g. STR+2)"
                                : def.key === "exhausted" ? "Enter penalty (e.g. -1)"
                                : "Enter detail"
                              ) ?? undefined
                            : undefined;                          
                            applyCondition(def.key, detail);
                        }}
                        style={{
                          background: "rgba(255,255,255,0.05)", border: "1px solid rgba(255,255,255,0.12)",
                          borderRadius: 20, color: C.text, cursor: "pointer",
                          fontSize: "var(--fs-small)", fontWeight: 600, padding: "2px 9px",
                        }}>
                        {def.name}
                      </button>
                    ))
                  }
                </div>
              </div>
            )}
          </div>
        </Panel>

        {/* Notes */}
        <Panel>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <SectionLabel>Notes</SectionLabel>
            {isOwn && (
              <button type="button" onClick={openNewNote}
                style={{ background: "none", border: `1px solid ${color}44`, borderRadius: 6, color: color, cursor: "pointer", fontSize: "var(--fs-small)", fontWeight: 700, padding: "2px 10px" }}>
                + Add
              </button>
            )}
          </div>

          {/* DM notes — read only */}
          {dmNotes.length > 0 && (
            <div style={{ marginBottom: playerNotes.length > 0 || isOwn ? 10 : 0 }}>
              <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(160,180,220,0.35)", marginBottom: 4 }}>
                From DM
              </div>
              {dmNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  expanded={noteExpanded.includes(note.id)}
                  onToggle={() => setNoteExpanded((p) => p.includes(note.id) ? p.filter((x) => x !== note.id) : [...p, note.id])}
                  color={color}
                />
              ))}
            </div>
          )}

          {/* Player notes — editable if own */}
          {playerNotes.length > 0 && (
            <div>
              {isOwn && (
                <div style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.08em", color: "rgba(160,180,220,0.35)", marginBottom: 4 }}>
                  My Notes
                </div>
              )}
              {playerNotes.map((note) => (
                <NoteRow
                  key={note.id}
                  note={note}
                  expanded={noteExpanded.includes(note.id)}
                  onToggle={() => setNoteExpanded((p) => p.includes(note.id) ? p.filter((x) => x !== note.id) : [...p, note.id])}
                  color={color}
                  onEdit={isOwn ? () => openEditNote(note) : undefined}
                  onDelete={isOwn ? () => deleteNote(note.id) : undefined}
                />
              ))}
            </div>
          )}

          {dmNotes.length === 0 && playerNotes.length === 0 && (
            <span style={{ fontSize: "var(--fs-small)", color: "rgba(160,180,220,0.3)" }}>No notes yet.</span>
          )}

          {/* Inline note editor */}
          {noteEditing && (
            <div style={{ marginTop: 12, borderTop: "1px solid rgba(255,255,255,0.08)", paddingTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <div>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 3 }}>Title</div>
                <input value={noteTitle} onChange={(e) => setNoteTitle(e.target.value)}
                  placeholder="Note title"
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 8px", color: C.text, fontSize: "var(--fs-small)" }} />
              </div>
              <div>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 3 }}>Body</div>
                <textarea value={noteText} onChange={(e) => setNoteText(e.target.value)}
                  placeholder="Note body"
                  style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, padding: "5px 8px", color: C.text, fontSize: "var(--fs-small)", minHeight: 80, resize: "vertical", lineHeight: 1.5 }} />
              </div>
              <div style={{ display: "flex", gap: 6 }}>
                <button type="button" onClick={() => setNoteEditing(null)}
                  style={{ flex: 1, background: "transparent", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: C.muted, cursor: "pointer", padding: "6px 0", fontSize: "var(--fs-small)", fontWeight: 700 }}>
                  Cancel
                </button>
                <button type="button" onClick={saveNote} disabled={noteSaving}
                  style={{ flex: 2, background: color, border: "none", borderRadius: 6, color: "#000", cursor: noteSaving ? "default" : "pointer", padding: "6px 0", fontSize: "var(--fs-small)", fontWeight: 700, opacity: noteSaving ? 0.6 : 1 }}>
                  {noteSaving ? "Saving…" : "Save Note"}
                </button>
              </div>
            </div>
          )}
        </Panel>

      </div>
    </div>
    <InjuryDialog
      isOpen={injuryDialogOpen}
      characterName={m.characterName}
      injuryCount={m.injuryCount}
      onClose={() => setInjuryDialogOpen(false)}
      onApplyCondition={applyCondition}
      onIncrementInjuryCount={incrementInjuryCount}
    />
    </>
  );
}

function NoteRow({ note, expanded, onToggle, color, onEdit, onDelete }: {
  note: SharedNote;
  expanded: boolean;
  onToggle: () => void;
  color: string;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  return (
    <div style={{
      padding: "5px 6px", borderRadius: 7, marginBottom: 4,
      background: expanded ? `${color}10` : "transparent",
      border: `1px solid ${expanded ? color + "30" : "transparent"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button type="button" onClick={onToggle}
          style={{ all: "unset", cursor: "pointer", fontWeight: 700, color: C.text, flex: 1, fontSize: "var(--fs-small)" }}>
          {note.title || "Untitled"}
        </button>
        {onEdit && (
          <button type="button" onClick={onEdit}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: C.muted, cursor: "pointer", padding: "2px 7px", fontSize: "var(--fs-small)" }}>
            Edit
          </button>
        )}
        {onDelete && (
          <button type="button" onClick={onDelete}
            style={{ background: "rgba(248,113,113,0.08)", border: "1px solid rgba(248,113,113,0.25)", borderRadius: 5, color: "#f87171", cursor: "pointer", padding: "2px 7px", fontSize: "var(--fs-small)" }}>
            ×
          </button>
        )}
      </div>
      {expanded && note.text && (
        <div style={{ marginTop: 6, color: C.muted, fontSize: "var(--fs-small)", whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {note.text}
        </div>
      )}
    </div>
  );
}
