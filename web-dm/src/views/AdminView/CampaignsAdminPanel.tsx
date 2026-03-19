// web-dm/src/views/AdminView/CampaignsAdminPanel.tsx
// Admin panel for managing campaign memberships (who is DM / player per campaign).

import React, { useEffect, useState, useCallback } from "react";
import { api, jsonInit } from "@/services/api";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";

interface Campaign {
  id: string;
  name: string;
  playerCount: number;
  updatedAt: number;
}

interface Member {
  id: string;
  role: "dm" | "player";
  user: { id: string; username: string; name: string; isAdmin: boolean };
}

interface User {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
}

// ---------------------------------------------------------------------------
// Add member modal
// ---------------------------------------------------------------------------

interface AddMemberModalProps {
  campaignName: string;
  existingUserIds: Set<string>;
  onAdd: (userId: string, role: "dm" | "player") => Promise<void>;
  onClose: () => void;
}

function AddMemberModal({ campaignName, existingUserIds, onAdd, onClose }: AddMemberModalProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [userId, setUserId] = useState("");
  const [role, setRole] = useState<"dm" | "player">("player");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    api<User[]>("/api/admin/users").then((data) => {
      setUsers(data.filter((u) => !u.isAdmin && !existingUserIds.has(u.id)));
    });
  }, [existingUserIds]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault();
    if (!userId) return;
    setError(null);
    setSaving(true);
    try {
      await onAdd(userId, role);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to add member");
    } finally {
      setSaving(false);
    }
  }

  const labelStyle: React.CSSProperties = {
    display: "block",
    marginBottom: 5,
    fontSize: 12,
    fontWeight: 600,
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, background: theme.colors.scrim,
        display: "flex", alignItems: "center", justifyContent: "center", zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.colors.modalBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: theme.radius.panel,
          padding: "28px 28px 24px",
          width: "100%", maxWidth: 380,
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 4px", fontSize: 18, fontWeight: 700 }}>Add Member</h2>
        <p style={{ margin: "0 0 20px", fontSize: 13, color: theme.colors.muted }}>{campaignName}</p>

        <form onSubmit={handleAdd}>
          <div style={{ marginBottom: 14 }}>
            <label style={labelStyle}>User</label>
            <select
              value={userId}
              onChange={(e) => setUserId(e.target.value)}
              disabled={saving}
              style={{
                width: "100%", padding: "10px 12px",
                borderRadius: theme.radius.control,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: theme.colors.inputBg,
                color: theme.colors.text,
                outline: "none",
              }}
            >
              <option value="">Select a user…</option>
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.name} (@{u.username})
                </option>
              ))}
            </select>
          </div>

          <div style={{ marginBottom: 20 }}>
            <label style={labelStyle}>Role</label>
            <div style={{ display: "flex", gap: 8 }}>
              {(["dm", "player"] as const).map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setRole(r)}
                  style={{
                    flex: 1, padding: "10px 0",
                    borderRadius: theme.radius.control,
                    border: `1px solid ${role === r ? theme.colors.accentPrimary : theme.colors.panelBorder}`,
                    background: role === r ? `${theme.colors.accentPrimary}22` : "transparent",
                    color: role === r ? theme.colors.accentPrimary : theme.colors.muted,
                    cursor: "pointer", fontWeight: 700, fontSize: 13,
                    textTransform: "uppercase", letterSpacing: "0.05em",
                  }}
                >
                  {r === "dm" ? "Dungeon Master" : "Player"}
                </button>
              ))}
            </div>
          </div>

          {error && (
            <div style={{
              marginBottom: 14, padding: "8px 12px",
              borderRadius: theme.radius.control,
              background: `${theme.colors.red}22`,
              border: `1px solid ${theme.colors.red}55`,
              color: theme.colors.red, fontSize: 13,
            }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
            <Button type="submit" variant="primary" disabled={saving || !userId}>
              {saving ? "Adding…" : "Add"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Campaign membership row
// ---------------------------------------------------------------------------

const ROLE_LABELS: Record<string, string> = { dm: "Dungeon Master", player: "Player" };
const ROLE_COLORS: Record<string, string> = { dm: theme.colors.accentPrimary, player: theme.colors.accentHighlight };

interface MemberRowProps {
  member: Member;
  onChangeRole: (id: string, role: "dm" | "player") => void;
  onRemove: (id: string, name: string) => void;
}

function MemberRow({ member, onChangeRole, onRemove }: MemberRowProps) {
  const tdStyle: React.CSSProperties = {
    padding: "10px 14px", fontSize: 14,
    borderBottom: `1px solid ${theme.colors.panelBorder}`,
    verticalAlign: "middle",
  };

  return (
    <tr>
      <td style={tdStyle}>
        <span style={{ fontWeight: 600 }}>{member.user.name}</span>
        <span style={{ marginLeft: 6, color: theme.colors.muted, fontSize: 12 }}>
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
            fontWeight: 700, fontSize: 12,
            cursor: "pointer", outline: "none",
          }}
        >
          <option value="dm">Dungeon Master</option>
          <option value="player">Player</option>
        </select>
      </td>
      <td style={{ ...tdStyle, textAlign: "right" }}>
        <Button
          variant="danger"
          style={{ fontSize: 12, padding: "4px 10px" }}
          onClick={() => onRemove(member.id, member.user.name)}
        >
          Remove
        </Button>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// Campaign card
// ---------------------------------------------------------------------------

function CampaignCard({ campaign }: { campaign: Campaign }) {
  const [members, setMembers] = useState<Member[]>([]);
  const [expanded, setExpanded] = useState(false);
  const [addModal, setAddModal] = useState(false);
  const [loading, setLoading] = useState(false);

  const fetchMembers = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<Member[]>(`/api/admin/campaigns/${campaign.id}/members`);
      setMembers(data);
    } finally {
      setLoading(false);
    }
  }, [campaign.id]);

  useEffect(() => {
    if (expanded) fetchMembers();
  }, [expanded, fetchMembers]);

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
      {/* Header */}
      <div
        style={{
          padding: "14px 18px", display: "flex", alignItems: "center",
          justifyContent: "space-between", cursor: "pointer",
          userSelect: "none",
        }}
        onClick={() => setExpanded((x) => !x)}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <span style={{ fontWeight: 700, fontSize: 15 }}>{campaign.name}</span>
          <span style={{ fontSize: 12, color: theme.colors.muted }}>
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
              style={{ fontSize: 12, padding: "5px 10px" }}
              onClick={(e) => { e.stopPropagation(); setAddModal(true); }}
            >
              + Add Member
            </Button>
          )}
          <span style={{ color: theme.colors.muted, fontSize: 18 }}>{expanded ? "▲" : "▼"}</span>
        </div>
      </div>

      {/* Members table */}
      {expanded && (
        <div style={{ borderTop: `1px solid ${theme.colors.panelBorder}` }}>
          {loading ? (
            <div style={{ padding: "16px 18px", color: theme.colors.muted, fontSize: 13 }}>Loading…</div>
          ) : members.length === 0 ? (
            <div style={{ padding: "16px 18px", color: theme.colors.muted, fontSize: 13 }}>
              No members assigned. Click "+ Add Member" to add someone.
            </div>
          ) : (
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  {["Member", "Role", ""].map((h, i) => (
                    <th key={i} style={{
                      padding: "8px 14px", textAlign: i === 2 ? "right" : "left",
                      fontSize: 11, fontWeight: 700, color: theme.colors.muted,
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
                    onChangeRole={handleChangeRole}
                    onRemove={handleRemove}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {addModal && (
        <AddMemberModal
          campaignName={campaign.name}
          existingUserIds={existingUserIds}
          onAdd={handleAdd}
          onClose={() => setAddModal(false)}
        />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function CampaignsAdminPanel() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api<Campaign[]>("/api/campaigns")
      .then(setCampaigns)
      .finally(() => setLoading(false));
  }, []);

  return (
    <div>
      <div style={{ marginBottom: 20 }}>
        <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 700 }}>Campaign Memberships</h2>
        <p style={{ margin: 0, fontSize: 13, color: theme.colors.muted }}>
          Assign users to campaigns as Dungeon Master or Player.
        </p>
      </div>

      {loading ? (
        <div style={{ color: theme.colors.muted, padding: 20 }}>Loading…</div>
      ) : campaigns.length === 0 ? (
        <div style={{
          padding: "32px 20px", textAlign: "center",
          color: theme.colors.muted, fontSize: 14,
          background: theme.colors.panelBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: theme.radius.panel,
        }}>
          No campaigns yet. Create a campaign in the main app first.
        </div>
      ) : (
        campaigns.map((c) => <CampaignCard key={c.id} campaign={c} />)
      )}
    </div>
  );
}
