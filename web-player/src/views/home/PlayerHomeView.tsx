import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";
import { PlayerSelfCreateForm } from "./PlayerSelfCreateForm";

const LS_KEY = "beholden:lastOpened";

function readLastOpened(): Record<string, number> {
  try { return JSON.parse(localStorage.getItem(LS_KEY) ?? "{}"); } catch { return {}; }
}
function touchLastOpened(id: string) {
  const map = readLastOpened();
  map[id] = Date.now();
  localStorage.setItem(LS_KEY, JSON.stringify(map));
}

interface Campaign {
  id: string;
  name: string;
  updatedAt: number;
  playerCount: number;
  imageUrl: string | null;
}

export function PlayerHomeView() {
  const navigate = useNavigate();
  const { user: authUser } = useAuth();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [hasCharacter, setHasCharacter] = useState<Record<string, boolean>>({});
  const [creatingInCampaign, setCreatingInCampaign] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastOpened, setLastOpened] = useState<Record<string, number>>(readLastOpened);

  function reload() {
    return api<Campaign[]>("/api/me/campaigns").then((camps) => {
      setCampaigns(camps);
      Promise.all(
        camps.map((c) =>
          api<{ userId: string | null }[]>(`/api/campaigns/${c.id}/party`)
            .then((party) => ({
              campaignId: c.id,
              hasChar: party.some((p) => p.userId === authUser?.id),
            }))
            .catch(() => ({ campaignId: c.id, hasChar: false }))
        )
      ).then((results) => {
        const map: Record<string, boolean> = {};
        results.forEach(({ campaignId, hasChar }) => { map[campaignId] = hasChar; });
        setHasCharacter(map);
      });
    });
  }

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  function openCampaign(id: string) {
    touchLastOpened(id);
    setLastOpened(readLastOpened());
    navigate(`/campaigns/${id}`);
  }

  const sortedCampaigns = useMemo(() =>
    [...campaigns].sort((a, b) => (lastOpened[b.id] ?? 0) - (lastOpened[a.id] ?? 0)),
  [campaigns, lastOpened]);

  return (
    <div style={{ height: "100%", background: C.bg, color: C.text, overflowY: "auto" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {loading && <p style={{ color: C.muted }}>Loading…</p>}
        {error && <p style={{ color: C.red }}>{error}</p>}

        {creatingInCampaign && (
          <div style={{ marginBottom: 24 }}>
            <PlayerSelfCreateForm
              campaignId={creatingInCampaign}
              campaignName={campaigns.find((c) => c.id === creatingInCampaign)?.name ?? "Campaign"}
              onSuccess={() => {
                setCreatingInCampaign(null);
                reload();
              }}
              onCancel={() => setCreatingInCampaign(null)}
            />
          </div>
        )}

        {!loading && campaigns.length > 0 && (
          <>
            <h2 style={{ margin: "0 0 20px", fontSize: "var(--fs-hero)", fontWeight: 800 }}>Your Campaigns</h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 18,
            }}>
              {sortedCampaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  hasCharacter={hasCharacter[c.id] ?? false}
                  onOpen={openCampaign}
                  onCreateCharacter={() => setCreatingInCampaign(c.id)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Campaign card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign: c, hasCharacter, onOpen, onCreateCharacter }: {
  campaign: Campaign;
  hasCharacter: boolean;
  onOpen: (id: string) => void;
  onCreateCharacter: () => void;
}) {
  const [imgHovered, setImgHovered] = useState(false);

  const initials = c.name
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w[0] ?? "")
    .join("")
    .toUpperCase();

  return (
    <div style={{
      background: "rgba(255,255,255,0.04)",
      border: "1px solid rgba(255,255,255,0.1)",
      borderRadius: 12,
      overflow: "hidden",
      display: "grid",
      gridTemplateRows: "160px 1fr auto",
      boxShadow: "0 4px 24px rgba(0,0,0,0.35)",
    }}>
      {/* Banner */}
      <div
        style={{
          position: "relative", height: 160, overflow: "hidden",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          background: c.imageUrl ? "#000" : "linear-gradient(135deg,rgba(56,182,255,0.18) 0%,rgba(56,182,255,0.04) 100%)",
          cursor: "default",
        }}
        onMouseEnter={() => setImgHovered(true)}
        onMouseLeave={() => setImgHovered(false)}
      >
        {c.imageUrl
          ? <img src={`${c.imageUrl}?v=${c.updatedAt}`} alt="" style={{
              position: "absolute", top: 0, left: 0,
              width: "100%", height: "100%", objectFit: "cover", display: "block",
              opacity: imgHovered ? 0.85 : 1, transition: "opacity 0.15s",
            }} />
          : <span style={{
              position: "absolute", inset: 0,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 52, fontWeight: 900,
              color: "rgba(56,182,255,0.18)", letterSpacing: 4, userSelect: "none",
            }}>{initials}</span>
        }
      </div>

      {/* Body */}
      <div style={{ padding: "14px 16px 8px", display: "flex", flexDirection: "column", gap: 6 }}>
        <div style={{ fontSize: "var(--fs-title)", fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.name}
        </div>
        <div style={{ fontSize: "var(--fs-subtitle)", color: C.muted }}>
          {c.playerCount} player{c.playerCount !== 1 ? "s" : ""}
        </div>
      </div>

      {/* Footer */}
      <div style={{ padding: "0 12px 14px", display: "flex", gap: 8, alignItems: "center" }}>
        <button
          style={{ ...accentBtn, flex: 1 }}
          onClick={() => onOpen(c.id)}
        >
          Open
        </button>
        {!hasCharacter && (
          <button
            style={{ ...ghostBtn, fontSize: "var(--fs-small)" }}
            onClick={onCreateCharacter}
          >
            + Create Character
          </button>
        )}
        {hasCharacter && (
          <span style={{ fontSize: "var(--fs-small)", color: "#4ade80", padding: "6px 8px", fontWeight: 600 }}>
            ✓ Character linked
          </span>
        )}
      </div>
    </div>
  );
}

// ── Shared button styles ─────────────────────────────────────────────────────

const accentBtn: React.CSSProperties = {
  background: C.accentHl,
  color: C.textDark,
  border: "none",
  borderRadius: 8,
  padding: "8px 18px",
  fontSize: "var(--fs-subtitle)",
  fontWeight: 700,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: C.muted,
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 7,
  padding: "6px 14px",
  fontSize: "var(--fs-small)",
  cursor: "pointer",
  flexShrink: 0,
};
