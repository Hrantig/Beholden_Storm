import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "@/services/api";

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
  campaigns: CharacterCampaign[];
}

export function PlayerHomeView() {
  const navigate = useNavigate();
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [characters, setCharacters] = useState<UserCharacter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api<Campaign[]>("/api/campaigns"),
      api<UserCharacter[]>("/api/me/characters"),
    ])
      .then(([camps, chars]) => {
        setCampaigns(camps);
        setCharacters(chars);
      })
      .catch((e) => setError(e instanceof Error ? e.message : "Failed to load"))
      .finally(() => setLoading(false));
  }, []);

  return (
    <div style={styles.page}>
      <div style={styles.main}>
        {/* ── My Characters ── */}
        <div style={styles.sectionHeader}>
          <h2 style={styles.heading}>My Characters</h2>
          <button style={styles.createBtn} onClick={() => navigate("/characters/new")}>
            + Create Character
          </button>
        </div>

        {loading && <p style={styles.muted}>Loading…</p>}
        {error && <p style={styles.errorText}>{error}</p>}

        {!loading && !error && characters.length === 0 && (
          <p style={styles.muted}>No characters yet. Create one to get started.</p>
        )}

        {!loading && characters.length > 0 && (
          <div style={styles.charList}>
            {characters.map((ch) => (
              <div key={ch.id} style={styles.charRow}>
                {ch.color && <div style={{ ...styles.colorDot, background: ch.color }} />}
                <div style={styles.charInfo}>
                  <span style={styles.charName}>{ch.name}</span>
                  <span style={styles.charMeta}>
                    {[ch.className, ch.species, `Level ${ch.level}`].filter(Boolean).join(" · ")}
                  </span>
                  {ch.campaigns.length > 0 && (
                    <span style={styles.charCampaigns}>
                      {ch.campaigns.map((c) => c.campaignName).join(", ")}
                    </span>
                  )}
                </div>
                <button
                  style={styles.editBtn}
                  onClick={() => navigate(`/characters/${ch.id}/edit`)}
                >
                  Edit
                </button>
              </div>
            ))}
          </div>
        )}

        {/* ── Campaigns ── */}
        <h2 style={{ ...styles.heading, marginTop: 40 }}>Your Campaigns</h2>

        {!loading && !error && campaigns.length === 0 && (
          <p style={styles.muted}>You haven't been added to any campaigns yet.</p>
        )}

        <div style={styles.grid}>
          {campaigns.map((c) => (
            <div key={c.id} style={styles.card}>
              {c.imageUrl && (
                <img src={c.imageUrl} alt={c.name} style={styles.cardImage} />
              )}
              <div style={styles.cardBody}>
                <div style={styles.cardName}>{c.name}</div>
                <div style={styles.cardMeta}>
                  {c.playerCount} player{c.playerCount !== 1 ? "s" : ""}
                </div>
                {/* Characters assigned to this campaign */}
                {characters.some((ch) => ch.campaigns.some((cc) => cc.campaignId === c.id)) && (
                  <div style={styles.assignedChars}>
                    {characters
                      .filter((ch) => ch.campaigns.some((cc) => cc.campaignId === c.id))
                      .map((ch) => (
                        <span key={ch.id} style={styles.assignedChip}>
                          {ch.name}
                        </span>
                      ))}
                  </div>
                )}
                <button
                  style={styles.assignBtn}
                  onClick={() => navigate(`/characters/new?campaign=${c.id}`)}
                >
                  + Assign Character
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  page: {
    height: "100%",
    background: "var(--bg)",
    color: "var(--text)",
    overflowY: "auto",
  },
  main: {
    maxWidth: 900,
    margin: "0 auto",
    padding: "32px 24px",
  },
  sectionHeader: {
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
  },
  heading: {
    margin: 0,
    fontSize: 20,
    fontWeight: 700,
  },
  createBtn: {
    background: "var(--accent)",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    padding: "7px 16px",
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
  muted: { color: "var(--muted)", fontSize: 14 },
  errorText: { color: "var(--red)", fontSize: 14 },
  charList: {
    display: "flex",
    flexDirection: "column",
    gap: 8,
  },
  charRow: {
    display: "flex",
    alignItems: "center",
    gap: 12,
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--radius-panel)",
    padding: "12px 16px",
  },
  colorDot: {
    width: 12,
    height: 12,
    borderRadius: "50%",
    flexShrink: 0,
  },
  charInfo: {
    display: "flex",
    flexDirection: "column",
    gap: 2,
    flex: 1,
    minWidth: 0,
  },
  charName: { fontSize: 15, fontWeight: 700 },
  charMeta: { fontSize: 12, color: "var(--muted)" },
  charCampaigns: { fontSize: 11, color: "var(--accent)", marginTop: 2 },
  editBtn: {
    background: "transparent",
    color: "var(--muted)",
    border: "1px solid var(--panel-border)",
    borderRadius: 5,
    padding: "4px 12px",
    fontSize: 12,
    cursor: "pointer",
    flexShrink: 0,
  },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
    gap: 16,
  },
  card: {
    background: "var(--panel-bg)",
    border: "1px solid var(--panel-border)",
    borderRadius: "var(--radius-panel)",
    overflow: "hidden",
  },
  cardImage: { width: "100%", height: 140, objectFit: "cover", display: "block" },
  cardBody: { padding: "14px 16px", display: "flex", flexDirection: "column", gap: 6 },
  cardName: { fontSize: 15, fontWeight: 700 },
  cardMeta: { fontSize: 12, color: "var(--muted)" },
  assignedChars: { display: "flex", flexWrap: "wrap", gap: 4 },
  assignedChip: {
    fontSize: 11,
    background: "rgba(96,165,250,0.12)",
    color: "var(--accent)",
    border: "1px solid rgba(96,165,250,0.25)",
    borderRadius: 4,
    padding: "1px 7px",
  },
  assignBtn: {
    background: "transparent",
    color: "var(--muted)",
    border: "1px solid var(--panel-border)",
    borderRadius: 5,
    padding: "4px 10px",
    fontSize: 11,
    cursor: "pointer",
    alignSelf: "flex-start",
    marginTop: 2,
  },
};
