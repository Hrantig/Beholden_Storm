import React from "react";
import { useParams, useNavigate } from "react-router-dom";
import { C } from "@/lib/theme";
import { api } from "@/services/api";
import { IconPlayer, IconConditionByKey } from "@/icons";
import { useWs } from "@/services/ws";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ConditionInstance { key: string; [k: string]: unknown }

export interface PartyMember {
  id: string;
  userId: string | null;
  playerName: string;
  characterName: string;
  className: string;
  species: string;
  level: number;
  hpPercent: number;
  ac: number;
  speed: number | null;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  color: string | null;
  imageUrl: string | null;
  conditions: ConditionInstance[];
  characterData: Record<string, unknown> | null;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function hpColor(pct: number): string {
  if (pct <= 0)  return "#6b7280";
  if (pct < 25)  return "#f87171";
  if (pct < 50)  return "#fb923c";
  if (pct < 75)  return "#fbbf24";
  return "#4ade80";
}

function hpLabel(pct: number): string {
  if (pct <= 0)  return "Down";
  if (pct < 25)  return "Critical";
  if (pct < 50)  return "Bloodied";
  if (pct < 75)  return "Bloody";
  return "Healthy";
}

// ---------------------------------------------------------------------------
// Party member card
// ---------------------------------------------------------------------------

function MemberCard({ m, campaignId }: { m: PartyMember; campaignId: string }) {
  const navigate = useNavigate();
  const color = m.color ?? C.accentHl;
  const hpC = hpColor(m.hpPercent);

  return (
    <div
      onClick={() => navigate(`/campaigns/${campaignId}/members/${m.id}`)}
      style={{
        background: "rgba(255,255,255,0.04)",
        border: `1px solid ${color}33`,
        borderRadius: 14,
        padding: 16,
        cursor: "pointer",
        display: "flex",
        flexDirection: "column",
        gap: 10,
        transition: "border-color 0.15s, background 0.15s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.07)";
        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}66`;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLDivElement).style.background = "rgba(255,255,255,0.04)";
        (e.currentTarget as HTMLDivElement).style.borderColor = `${color}33`;
      }}
    >
      {/* Portrait + info */}
      <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
        <div style={{
          width: 54, height: 54, borderRadius: 10, flexShrink: 0,
          background: `${color}22`, border: `2px solid ${color}55`,
          overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
        }}>
          {m.imageUrl
            ? <img src={m.imageUrl} alt={m.characterName} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <IconPlayer size={28} style={{ opacity: 0.4 }} />}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 800, fontSize: 15, color: C.text, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
            {m.characterName || "Unnamed"}
          </div>
          <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>
            {[m.className, m.species].filter(Boolean).join(" · ")}
          </div>
          <div style={{ fontSize: 11, color: color, fontWeight: 700, marginTop: 1 }}>Level {m.level}</div>
          {m.playerName && (
            <div style={{ fontSize: 11, color: "rgba(160,180,220,0.4)", marginTop: 1 }}>
              {m.playerName}
            </div>
          )}
        </div>
        {/* AC badge */}
        <div style={{
          display: "flex", flexDirection: "column", alignItems: "center", gap: 2,
          background: "rgba(255,255,255,0.06)", borderRadius: 8, padding: "4px 8px", flexShrink: 0,
        }}>
          <span style={{ fontSize: 16, fontWeight: 900, color: C.text }}>{m.ac}</span>
          <span style={{ fontSize: 10, color: C.muted, fontWeight: 600 }}>AC</span>
        </div>
      </div>

      {/* HP bar */}
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
          <span style={{ fontSize: 11, color: hpC, fontWeight: 700 }}>{hpLabel(m.hpPercent)}</span>
          <span style={{ fontSize: 11, color: C.muted }}>{m.hpPercent}%</span>
        </div>
        <div style={{ height: 6, borderRadius: 3, background: "rgba(255,255,255,0.08)", overflow: "hidden" }}>
          <div style={{
            height: "100%", borderRadius: 3,
            width: `${m.hpPercent}%`,
            background: hpC,
            transition: "width 0.4s ease",
          }} />
        </div>
      </div>

      {/* Conditions */}
      {m.conditions.length > 0 && (
        <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
          {m.conditions.map((c, i) => (
            <span key={i} style={{
              display: "inline-flex", alignItems: "center", gap: 3,
              fontSize: 11, padding: "2px 7px", borderRadius: 20, fontWeight: 600,
              background: "rgba(248,113,113,0.12)", border: "1px solid rgba(248,113,113,0.3)",
              color: "#fca5a5",
            }}>
              <IconConditionByKey condKey={c.key} size={10} />
              {String(c.key)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function CampaignPartyView() {
  const { id: campaignId } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [party, setParty] = React.useState<PartyMember[]>([]);
  const [campaignName, setCampaignName] = React.useState<string>("");
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const fetchParty = React.useCallback(() => {
    if (!campaignId) return;
    api<PartyMember[]>(`/api/campaigns/${campaignId}/party`)
      .then(setParty)
      .catch((e) => setError(e?.message ?? "Failed to load party"))
      .finally(() => setLoading(false));
  }, [campaignId]);

  React.useEffect(() => {
    fetchParty();
    // Fetch campaign name from campaigns list
    api<{ id: string; name: string }[]>("/api/campaigns")
      .then((list) => {
        const c = list.find((c) => c.id === campaignId);
        if (c) setCampaignName(c.name);
      })
      .catch(() => {});
  }, [campaignId, fetchParty]);

  // Re-fetch when DM changes player stats
  useWs(React.useCallback((msg) => {
    if (msg.type === "players:changed") {
      const cId = (msg.payload as any)?.campaignId as string | undefined;
      if (cId === campaignId) fetchParty();
    }
  }, [campaignId, fetchParty]));

  const inner = (() => {
    if (loading) return <p style={{ color: C.muted }}>Loading…</p>;
    if (error) return <p style={{ color: "#f87171" }}>{error}</p>;
    if (party.length === 0) return <p style={{ color: C.muted }}>No players in this campaign yet.</p>;
    return (
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 16,
      }}>
        {party.map((m) => (
          <MemberCard key={m.id} m={m} campaignId={campaignId!} />
        ))}
      </div>
    );
  })();

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text, fontFamily: "system-ui, Segoe UI, Arial, sans-serif" }}>
      <div style={{ maxWidth: 1100, margin: "0 auto", padding: "36px 24px" }}>
        <button type="button" onClick={() => navigate("/")}
          style={{ background: "none", border: "none", color: C.muted, cursor: "pointer", fontSize: 13, padding: 0, marginBottom: 20 }}>
          ← Back
        </button>
        <div style={{ display: "flex", alignItems: "baseline", gap: 12, marginBottom: 28 }}>
          <h1 style={{ margin: 0, fontSize: 26, fontWeight: 900 }}>{campaignName || "Campaign"}</h1>
          <span style={{ fontSize: 14, color: C.muted }}>— Party</span>
        </div>
        {inner}
      </div>
    </div>
  );
}
