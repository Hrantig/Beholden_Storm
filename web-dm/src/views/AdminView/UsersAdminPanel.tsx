// web-dm/src/views/AdminView/UsersAdminPanel.tsx
// Admin panel for managing users: list, create, edit, delete.

import React, { useEffect, useState, useCallback } from "react";
import { api, jsonInit } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { theme } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";

interface User {
  id: string;
  username: string;
  name: string;
  isAdmin: boolean;
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Modal for create / edit
// ---------------------------------------------------------------------------

interface UserFormData {
  username: string;
  name: string;
  password: string;
  isAdmin: boolean;
}

interface UserModalProps {
  title: string;
  initial: Partial<UserFormData>;
  passwordRequired: boolean;
  onSave: (data: UserFormData) => Promise<void>;
  onClose: () => void;
}

function UserModal({ title, initial, passwordRequired, onSave, onClose }: UserModalProps) {
  const [form, setForm] = useState<UserFormData>({
    username: initial.username ?? "",
    name: initial.name ?? "",
    password: "",
    isAdmin: initial.isAdmin ?? false,
  });
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  function set<K extends keyof UserFormData>(k: K, v: UserFormData[K]) {
    setForm((f) => ({ ...f, [k]: v }));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onSave(form);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
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

  const fieldStyle: React.CSSProperties = { marginBottom: 14 };

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        background: theme.colors.scrim,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        zIndex: 1000,
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: theme.colors.modalBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: theme.radius.panel,
          padding: "28px 28px 24px",
          width: "100%",
          maxWidth: 400,
          boxSizing: "border-box",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <h2 style={{ margin: "0 0 20px", fontSize: 18, fontWeight: 700 }}>{title}</h2>

        <form onSubmit={handleSave}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Display Name</label>
            <Input value={form.name} onChange={(e) => set("name", e.target.value)} autoFocus disabled={saving} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Username</label>
            <Input value={form.username} onChange={(e) => set("username", e.target.value)} disabled={saving} />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>
              Password {!passwordRequired && <span style={{ fontWeight: 400 }}>(leave blank to keep current)</span>}
            </label>
            <Input
              type="password"
              value={form.password}
              onChange={(e) => set("password", e.target.value)}
              placeholder={passwordRequired ? "" : "••••••••"}
              disabled={saving}
            />
          </div>
          <div style={{ ...fieldStyle, display: "flex", alignItems: "center", gap: 10 }}>
            <input
              type="checkbox"
              id="isAdmin"
              checked={form.isAdmin}
              onChange={(e) => set("isAdmin", e.target.checked)}
              disabled={saving}
              style={{ width: 16, height: 16, cursor: "pointer" }}
            />
            <label htmlFor="isAdmin" style={{ fontSize: 14, cursor: "pointer" }}>
              Admin (can access this panel and manage users)
            </label>
          </div>

          {error && (
            <div
              style={{
                marginBottom: 14,
                padding: "8px 12px",
                borderRadius: theme.radius.control,
                background: `${theme.colors.red}22`,
                border: `1px solid ${theme.colors.red}55`,
                color: theme.colors.red,
                fontSize: 13,
              }}
            >
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <Button type="button" variant="ghost" onClick={onClose} disabled={saving}>
              Cancel
            </Button>
            <Button
              type="submit"
              variant="primary"
              disabled={
                saving ||
                !form.name.trim() ||
                !form.username.trim() ||
                (passwordRequired && !form.password)
              }
            >
              {saving ? "Saving…" : "Save"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main panel
// ---------------------------------------------------------------------------

export function UsersAdminPanel() {
  const { user: currentUser } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<"create" | { type: "edit"; user: User } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const data = await api<User[]>("/api/admin/users");
      setUsers(data);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  async function handleCreate(form: { username: string; name: string; password: string; isAdmin: boolean }) {
    await api("/api/admin/users", jsonInit("POST", {
      username: form.username,
      name: form.name,
      password: form.password,
      isAdmin: form.isAdmin,
    }));
    setModal(null);
    refresh();
  }

  async function handleEdit(userId: string, form: { username: string; name: string; password: string; isAdmin: boolean }) {
    const body: Record<string, unknown> = {
      username: form.username,
      name: form.name,
      isAdmin: form.isAdmin,
    };
    if (form.password) body.password = form.password;
    await api(`/api/admin/users/${userId}`, jsonInit("PUT", body));
    setModal(null);
    refresh();
  }

  async function handleDelete(u: User) {
    if (!confirm(`Delete user "${u.name}" (@${u.username})? This cannot be undone.`)) return;
    await api(`/api/admin/users/${u.id}`, { method: "DELETE" });
    refresh();
  }

  const thStyle: React.CSSProperties = {
    padding: "10px 14px",
    textAlign: "left",
    fontSize: 11,
    fontWeight: 700,
    color: theme.colors.muted,
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    borderBottom: `1px solid ${theme.colors.panelBorder}`,
  };

  const tdStyle: React.CSSProperties = {
    padding: "12px 14px",
    fontSize: 14,
    borderBottom: `1px solid ${theme.colors.panelBorder}`,
    verticalAlign: "middle",
  };

  return (
    <div>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h2 style={{ margin: 0, fontSize: 20, fontWeight: 700 }}>Users</h2>
        <Button variant="primary" onClick={() => setModal("create")}>
          + New User
        </Button>
      </div>

      {loading ? (
        <div style={{ color: theme.colors.muted, padding: 20 }}>Loading…</div>
      ) : (
        <div
          style={{
            background: theme.colors.panelBg,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: theme.radius.panel,
            overflow: "hidden",
          }}
        >
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr>
                <th style={thStyle}>Name</th>
                <th style={thStyle}>Username</th>
                <th style={thStyle}>Role</th>
                <th style={{ ...thStyle, textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.length === 0 && (
                <tr>
                  <td colSpan={4} style={{ ...tdStyle, color: theme.colors.muted, textAlign: "center" }}>
                    No users found.
                  </td>
                </tr>
              )}
              {users.map((u) => (
                <tr key={u.id} style={{ opacity: u.id === currentUser?.id ? 1 : 1 }}>
                  <td style={tdStyle}>
                    <span style={{ fontWeight: 600 }}>{u.name}</span>
                    {u.id === currentUser?.id && (
                      <span
                        style={{
                          marginLeft: 8,
                          fontSize: 11,
                          color: theme.colors.accentHighlight,
                          fontWeight: 600,
                        }}
                      >
                        (you)
                      </span>
                    )}
                  </td>
                  <td style={{ ...tdStyle, color: theme.colors.muted }}>@{u.username}</td>
                  <td style={tdStyle}>
                    <span
                      style={{
                        display: "inline-block",
                        padding: "2px 8px",
                        borderRadius: 6,
                        fontSize: 12,
                        fontWeight: 700,
                        background: u.isAdmin ? `${theme.colors.accentPrimary}22` : `${theme.colors.panelBorder}`,
                        color: u.isAdmin ? theme.colors.accentPrimary : theme.colors.muted,
                        border: `1px solid ${u.isAdmin ? theme.colors.accentPrimary + "55" : theme.colors.panelBorder}`,
                      }}
                    >
                      {u.isAdmin ? "Admin" : "Player"}
                    </span>
                  </td>
                  <td style={{ ...tdStyle, textAlign: "right" }}>
                    <div style={{ display: "flex", gap: 6, justifyContent: "flex-end" }}>
                      <Button
                        variant="ghost"
                        style={{ fontSize: 13, padding: "5px 10px" }}
                        onClick={() => setModal({ type: "edit", user: u })}
                      >
                        Edit
                      </Button>
                      <Button
                        variant="danger"
                        style={{ fontSize: 13, padding: "5px 10px" }}
                        onClick={() => handleDelete(u)}
                        disabled={u.id === currentUser?.id}
                        title={u.id === currentUser?.id ? "Cannot delete your own account" : undefined}
                      >
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modal === "create" && (
        <UserModal
          title="Create User"
          initial={{}}
          passwordRequired
          onSave={handleCreate}
          onClose={() => setModal(null)}
        />
      )}

      {modal !== null && modal !== "create" && modal.type === "edit" && (
        <UserModal
          title={`Edit User — ${modal.user.name}`}
          initial={{ username: modal.user.username, name: modal.user.name, isAdmin: modal.user.isAdmin }}
          passwordRequired={false}
          onSave={(form) => handleEdit(modal.user.id, form)}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
