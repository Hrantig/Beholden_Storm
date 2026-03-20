import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";
import { C } from "@/lib/theme";
import { IconPlayer } from "@/icons";

interface Campaign {
  id: string;
  name: string;
  updatedAt: number;
  playerCount: number;
  imageUrl: string | null;
}

interface CharacterCampaign {
  id: string;
  campaignId: string;
  campaignName: string;
  playerId: string | null;
}

interface UserCharacter {
  id: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  color: string | null;
  imageUrl: string | null;
  campaigns: CharacterCampaign[];
}

export function PlayerHomeView() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<UserCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  function reload() {
    return Promise.all([
      api<Campaign[]>("/api/campaigns"),
      api<UserCharacter[]>("/api/me/characters"),
    ]).then(([camps, chars]) => {
      setCampaigns(camps);
      setCharacters(chars);
    });
  }

  useEffect(() => {
    reload()
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div style={{ height: "100%", background: C.bg, color: C.text, overflowY: "auto" }}>
      <div style={{ maxWidth: 960, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── My Characters ── */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 16 }}>
          <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>My Characters</h2>
          <button style={accentBtn} onClick={() => navigate("/characters/new")}>
            + Create Character
          </button>
        </div>

        {loading && <p style={{ color: C.muted }}>Loading…</p>}
        {error && <p style={{ color: C.red }}>{error}</p>}

        {!loading && !error && characters.length === 0 && (
          <p style={{ color: C.muted, fontSize: 14 }}>No characters yet. Create one to get started.</p>
        )}

        {!loading && characters.length > 0 && (
          <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 40 }}>
            {characters.map((ch) => (
              <CharacterRow key={ch.id} ch={ch} navigate={navigate} onRefresh={reload} />
            ))}
          </div>
        )}

        {/* ── Your Campaigns ── */}
        {!loading && campaigns.length > 0 && (
          <>
            <h2 style={{ margin: "0 0 20px", fontSize: 22, fontWeight: 800 }}>Your Campaigns</h2>
            <div style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: 18,
            }}>
              {campaigns.map((c) => (
                <CampaignCard
                  key={c.id}
                  campaign={c}
                  characters={characters}
                  navigate={navigate}
                />
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

// ── Character row ────────────────────────────────────────────────────────────

function CharacterRow({ ch, navigate, onRefresh }: {
  ch: UserCharacter;
  navigate: ReturnType<typeof useNavigate>;
  onRefresh: () => Promise<void>;
}) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      await api(`/api/me/characters/${ch.id}/image`, { method: "POST", body: fd });
      await onRefresh();
    } catch (err) { console.error(err); }
    finally { setUploading(false); }
  }

  async function handleDelete() {
    setDeleting(true);
    try {
      await api(`/api/me/characters/${ch.id}`, { method: "DELETE" });
      await onRefresh();
    } catch (err) { console.error(err); }
    finally { setDeleting(false); setConfirmDelete(false); }
  }

  return (
    <div style={{
      display: "flex", alignItems: "center", gap: 12,
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${confirmDelete ? "rgba(248,113,113,0.35)" : "rgba(255,255,255,0.09)"}`,
      borderRadius: 10, padding: "10px 14px",
      transition: "border-color 0.15s",
    }}>
      <input ref={fileRef} type="file" accept="image/*" onChange={handleImageSelected} style={{ display: "none" }} />

      {/* Portrait / color dot */}
      <div
        onClick={() => fileRef.current?.click()}
        title="Click to set portrait"
        style={{
          width: 40, height: 40, borderRadius: 8, flexShrink: 0, cursor: "pointer",
          overflow: "hidden", position: "relative",
          background: ch.color ?? "rgba(56,182,255,0.2)",
          border: `2px solid ${ch.color ?? "rgba(56,182,255,0.3)"}`,
          display: "flex", alignItems: "center", justifyContent: "center",
        }}>
        {ch.imageUrl
          ? <img src={ch.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
          : <IconPlayer size={22} style={{ opacity: 0.4 }} />
        }
        {uploading && (
          <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.55)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, color: "#fff" }}>…</div>
        )}
      </div>

      <div
        style={{ flex: 1, minWidth: 0, cursor: "pointer" }}
        onClick={() => navigate(`/characters/${ch.id}`)}
      >
        <div style={{ fontSize: 15, fontWeight: 700, color: C.text }}>{ch.name}</div>
        <div style={{ fontSize: 12, color: C.muted }}>
          {[ch.className, ch.species, `Level ${ch.level}`].filter(Boolean).join(" · ")}
        </div>
        {ch.campaigns.length > 0 && (
          <div style={{ fontSize: 11, color: C.accentHl, marginTop: 2 }}>
            {ch.campaigns.map((c) => c.campaignName).join(", ")}
          </div>
        )}
      </div>

      {confirmDelete ? (
        <div style={{ display: "flex", gap: 6, alignItems: "center", flexShrink: 0 }}>
          <span style={{ fontSize: 12, color: C.red, whiteSpace: "nowrap" }}>Delete?</span>
          <button
            disabled={deleting}
            onClick={handleDelete}
            style={{ ...ghostBtn, color: C.red, borderColor: "rgba(248,113,113,0.45)", fontSize: 12 }}
          >
            {deleting ? "…" : "Yes"}
          </button>
          <button
            onClick={() => setConfirmDelete(false)}
            style={ghostBtn}
          >
            No
          </button>
        </div>
      ) : (
        <div style={{ display: "flex", gap: 6, flexShrink: 0 }}>
          <button style={ghostBtn} onClick={() => navigate(`/characters/${ch.id}/edit`)}>
            Edit
          </button>
          <button
            style={{ ...ghostBtn, color: "rgba(248,113,113,0.7)", borderColor: "rgba(248,113,113,0.25)" }}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        </div>
      )}
    </div>
  );
}

// ── Campaign card ────────────────────────────────────────────────────────────

function CampaignCard({ campaign: c, characters, navigate }: {
  campaign: Campaign;
  characters: UserCharacter[];
  navigate: ReturnType<typeof useNavigate>;
}) {
  const [imgHovered, setImgHovered] = useState(false);

  const assignedChars = characters.filter((ch) =>
    ch.campaigns.some((cc) => cc.campaignId === c.id)
  );

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
        <div style={{ fontSize: 18, fontWeight: 800, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {c.name}
        </div>
        <div style={{ fontSize: 13, color: C.muted }}>
          {c.playerCount} player{c.playerCount !== 1 ? "s" : ""}
        </div>

        {/* Assigned characters */}
        {assignedChars.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 2 }}>
            {assignedChars.map((ch) => (
              <span key={ch.id} style={{
                fontSize: 11, padding: "2px 8px", borderRadius: 20,
                background: `${ch.color ?? C.accentHl}22`,
                border: `1px solid ${ch.color ?? C.accentHl}55`,
                color: ch.color ?? C.accentHl, fontWeight: 600,
              }}>
                {ch.name}
              </span>
            ))}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ padding: "0 12px 14px", display: "flex", gap: 8 }}>
        <button
          style={{ ...accentBtn, flex: 1 }}
          onClick={() => navigate(`/campaigns/${c.id}`)}
        >
          Open
        </button>
        <button
          style={{ ...ghostBtn, fontSize: 12 }}
          onClick={() => navigate(`/characters/new?campaign=${c.id}`)}
        >
          + Assign
        </button>
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
  fontSize: 13,
  fontWeight: 700,
  cursor: "pointer",
};

const ghostBtn: React.CSSProperties = {
  background: "transparent",
  color: C.muted,
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 7,
  padding: "6px 14px",
  fontSize: 12,
  cursor: "pointer",
  flexShrink: 0,
};
