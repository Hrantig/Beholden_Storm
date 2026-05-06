import React, { useEffect, useState, useCallback } from "react";
import { api, jsonInit } from "@/services/api";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import type { Campaign, Member } from "./adminTypes";
import { AddMemberModal } from "./AddMemberModal";

const ROLE_LABELS: Record<string, string> = { dm: "Dungeon Master", player: "Player" };
const ROLE_COLORS: Record<string, string> = { dm: theme.colors.accentPrimary, player: theme.colors.accentHighlight };

function MemberRow({ member, players, onChangeRole, onRemove, onAssignCharacter }: {
  member: Member;
  players: { id: string; characterName: string; userId: string | null }[];
  onChangeRole: (id: string, role: "dm" | "player") => void;
  onRemove: (id: string, name: string) => void;
  onAssignCharacter: (userId: string, playerId: string | null) => void;
}) {
  const tdStyle: React.CSSProperties = {
    padding: "10px 14px", fontSize: "var(--fs-medium)",
    borderBottom: `1px solid ${theme.colors.panelBorder}`,
    verticalAlign: "middle",
  };

  return (
    <tr>
      <td style={tdStyle}>
        <span style={{ fontWeight: 600 }}>{member.user.name}</span>
        <span style={{ marginLeft: 6, color: theme.colors.muted, fontSize: "var(--fs-small)" }}>
          @{member.user.username}
        </span>
      </td>
      <td style={tdStyle}>
        <select
          value={member.role}
          onChange={(e) => onChangeRole(member.id, e.target.value as "dm" | "player")}
          style={{
            padding: "4px 8px",
            borderRadius: theme.radius.control,
            border: `1px solid ${ROLE_COLORS[member.role]}55`,
            background: `${ROLE_COLORS[member.role]}18`,
            color: ROLE_COLORS[member.role],
            fontWeight: 700, fontSize: "var(--fs-small)",
            cursor: "pointer", outline: "none",
          }}
        >
          <option value="dm">Dungeon Master</option>
          <option value="player">Player</option>
        </select>
      </td>
      <td style={tdStyle}>
        <select
          value={players.find((p) => p.userId === member.user.id)?.id ?? ""}
          onChange={(e) => onAssignCharacter(member.user.id, e.target.value || null)}
          style={{
            padding: "4px 8px",
            borderRadius: theme.radius.control,
            border: `1px solid ${theme.colors.panelBorder}`,
            background: theme.colors.inputBg,
            color: theme.colors.text,
            fontSize: "var(--fs-small)",
            cursor: "pointer", outline: "none",
            maxWidth: 160,
          }}
        >
          <option value="">— Unlinked —</option>
          {players
            .filter((p) => p.userId === null || p.userId === member.user.id)
            .map((p) => (
              <option key={p.id} value={p.id}>{p.characterName}</option>
            ))}
        </select>
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        <Button
          variant="danger"
          style={{ fontSize: "var(--fs-small)", padding: "4px 10px" }}
          onClick={() => onRemove(member.id, member.user.name)}
        >
          Remove
        </Button>
      </td>
    </tr>
  );
}

export function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const [players, setPlayers] = useState<{ id: string; characterName: string; userId: string | null }[]>([]);

  const fetchPlayers = useCallback(async () => {
    const data = await api<{ id: string; characterName: string; userId: string | null }[]>(
      `/api/campaigns/${campaign.id}/players`
    );
    setPlayers(data);
  }, [campaign.id]);

  useEffect(() => { fetchPlayers(); }, [fetchPlayers]);
  useEffect(() => { if (expanded) fetchPlayers(); }, [expanded, fetchPlayers]);

  async function handleAssignCharacter(userId: string, playerId: string | null) {
  if (playerId) {
    const member = members.find((m) => m.user.id === userId);
    const playerName = member ? (member.user.name || member.user.username) : undefined;
    await api(`/api/players/${playerId}`, jsonInit("PUT", { 
      userId,
      ...(playerName ? { playerName } : {}),
    }));
  } else {
    const current = players.find((p) => p.userId === userId);
    if (current) {
      await api(`/api/players/${current.id}`, jsonInit("PUT", { userId: null, playerName: "Unclaimed" }));
    }
  }
  fetchPlayers();
}

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Member[]>(`/api/admin/campaigns/${campaign.id}/members`);
      setMembers(data);
    } finally {
      setLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => { fetchMembers(); }, [fetchMembers]);
  useEffect(() => { if (expanded) fetchMembers(); }, [expanded, fetchMembers]);

  async function handleChangeRole(membershipId: string, role: "dm" | "player") {
    await api(`/api/admin/campaigns/${campaign.id}/members/${membershipId}`, jsonInit("PUT", { role }));
    fetchMembers();
  }

  async function handleRemove(membershipId: string, name: string) {
    if (!confirm(`Remove ${name} from "${campaign.name}"?`)) return;
    await api(`/api/admin/campaigns/${campaign.id}/members/${membershipId}`, { method: "DELETE" });
    fetchMembers();
  }

  async function handleAdd(userId: string, role: "dm" | "player") {
    await api(`/api/admin/campaigns/${campaign.id}/members`, jsonInit("POST", { userId, role }));
    setAddModal(false);
    fetchMembers();
  }

  const existingUserIds = new Set(members.map((m) => m.user.id));
  const dmCount = members.filter((m) => m.role === "dm").length;
  const playerCount = members.filter((m) => m.role === "player").length;

  return (
    <div style={{
      background: theme.colors.panelBg,
      border: `1px solid ${theme.colors.panelBorder}`,
      borderRadius: theme.radius.panel,
      overflow: "hidden",
      marginBottom: 12,
    }}>
      <div
        style={{
          padding: "14px 18px", display: "flex", alignItems: "center",
          justifyContent: "space-between", cursor: "pointer", userSelect: "none",
        }}
        onClick={() => setExpanded((x) => !x)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontWeight: 700, fontSize: "var(--fs-body)" }}>{campaign.name}</span>
          <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted }}>
            {dmCount > 0 && `${dmCount} DM${dmCount > 1 ? "s" : ""}`}
            {dmCount > 0 && playerCount > 0 && "  ·  "}
            {playerCount > 0 && `${playerCount} player${playerCount > 1 ? "s" : ""}`}
            {dmCount === 0 && playerCount === 0 && "No members yet"}
          </span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          {expanded && (
            <Button
              variant="primary"
              style={{ fontSize: "var(--fs-small)", padding: "5px 10px" }}
              onClick={(e) => { e.stopPropagation(); setAddModal(true); }}
            >
              + Add Member
            </Button>
          )}
          <span style={{ color: theme.colors.muted, fontSize: "var(--fs-title)" }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {expanded && (
        <div style={{ borderTop: `1px solid ${theme.colors.panelBorder}` }}>
          {loading ? (
            <div style={{ padding: "16px 18px", color: theme.colors.muted, fontSize: "var(--fs-subtitle)" }}>Loading…</div>
          ) : members.length === 0 ? (
            <div style={{ padding: "16px 18px", color: theme.colors.muted, fontSize: "var(--fs-subtitle)" }}>
              No members assigned. Click "+ Add Member" to add someone.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Member", "Role", "Character", ""].map((h, i) => (
                    <th key={i} style={{
                      padding: "8px 14px", textAlign: i === 3 ? "right" : "left",
                      fontSize: "var(--fs-small)", fontWeight: 700, color: theme.colors.muted,
                      textTransform: "uppercase", letterSpacing: "0.06em",
                      borderBottom: `1px solid ${theme.colors.panelBorder}`,
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {members.map((m) => (
                  <MemberRow
                    key={m.id}
                    member={m}
                    players={players}
                    onChangeRole={handleChangeRole}
                    onRemove={handleRemove}
                    onAssignCharacter={handleAssignCharacter}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {addModal && (
        <AddMemberModal
          campaignId={campaign.id}
          campaignName={campaign.name}
          existingUserIds={existingUserIds}
          onAdd={handleAdd}
          onClose={() => setAddModal(false)}
        />
      )}
    </div>
  );
}
