import React from "react";
import { Panel } from "@/ui/Panel";
import { theme, withAlpha } from "@/theme/theme";
import { api } from "@/services/api";
import type { Adversary } from "@/domain/types/domain";

function unique(values: string[]): string[] {
  return Array.from(new Set(values)).sort();
}

function uniqueNumbers(values: number[]): number[] {
  return Array.from(new Set(values)).sort((a, b) => a - b);
}

export function AdversaryBrowserPanel(props: {
  selectedAdversaryId: string | null;
  onSelect: (id: string) => void;
}) {
  const [adversaries, setAdversaries] = React.useState<Adversary[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [search, setSearch] = React.useState("");
  const [filterTier, setFilterTier] = React.useState("");
  const [filterType, setFilterType] = React.useState("");
  const [filterSize, setFilterSize] = React.useState("");

  React.useEffect(() => {
    setLoading(true);
    api<Adversary[]>("/api/compendium/adversaries")
      .then(setAdversaries)
      .catch(() => setAdversaries([]))
      .finally(() => setLoading(false));
  }, []);

  const tiers = React.useMemo(() => uniqueNumbers(adversaries.map((a) => a.tier)), [adversaries]);
  const types = React.useMemo(() => unique(adversaries.map((a) => a.adversaryType)), [adversaries]);
  const sizes = React.useMemo(() => unique(adversaries.map((a) => a.size)), [adversaries]);

  const filtered = React.useMemo(() => {
    const q = search.trim().toLowerCase();
    return adversaries.filter((a) => {
      if (q && !a.name.toLowerCase().includes(q)) return false;
      if (filterTier && String(a.tier) !== filterTier) return false;
      if (filterType && a.adversaryType !== filterType) return false;
      if (filterSize && a.size !== filterSize) return false;
      return true;
    });
  }, [adversaries, search, filterTier, filterType, filterSize]);

  const selectStyle: React.CSSProperties = {
    background: theme.colors.inputBg,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: 8,
    padding: "5px 8px",
    fontSize: "var(--fs-small)",
    minWidth: 0,
    flex: "1 1 100px",
  };

  const inputStyle: React.CSSProperties = {
    background: theme.colors.inputBg,
    color: theme.colors.text,
    border: `1px solid ${theme.colors.panelBorder}`,
    borderRadius: 8,
    padding: "5px 8px",
    fontSize: "var(--fs-small)",
    flex: "1 1 160px",
    minWidth: 0,
    outline: "none",
  };

  return (
    <Panel
      storageKey="adversary-browser"
      title="Adversaries"
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      bodyStyle={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0, gap: 10 }}
    >
      {/* Filters */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
        <input
          type="text"
          placeholder="Search by name…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={inputStyle}
        />
        <select value={filterTier} onChange={(e) => setFilterTier(e.target.value)} style={selectStyle}>
          <option value="">All Tiers</option>
          {tiers.map((t) => <option key={t} value={String(t)}>Tier {t}</option>)}
        </select>
        <select value={filterType} onChange={(e) => setFilterType(e.target.value)} style={selectStyle}>
          <option value="">All Types</option>
          {types.map((t) => <option key={t} value={t}>{t}</option>)}
        </select>
        <select value={filterSize} onChange={(e) => setFilterSize(e.target.value)} style={selectStyle}>
          <option value="">All Sizes</option>
          {sizes.map((s) => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {/* List */}
      <div style={{ flex: 1, overflowY: "auto", minHeight: 0, display: "flex", flexDirection: "column", gap: 2 }}>
        {loading ? (
          <div style={{ color: theme.colors.muted, padding: "12px 0" }}>Loading…</div>
        ) : filtered.length === 0 ? (
          <div style={{ color: theme.colors.muted, padding: "12px 0" }}>No adversaries found.</div>
        ) : (
          filtered.map((a) => {
            const active = a.id === props.selectedAdversaryId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => props.onSelect(a.id)}
                style={{
                  all: "unset",
                  cursor: "pointer",
                  display: "grid",
                  gridTemplateColumns: "1fr auto",
                  alignItems: "center",
                  gap: 8,
                  padding: "8px 10px",
                  borderRadius: 8,
                  background: active
                    ? withAlpha(theme.colors.accentPrimary, 0.15)
                    : "transparent",
                  border: `1px solid ${active ? theme.colors.accentPrimary : "transparent"}`,
                  transition: "background 100ms ease, border-color 100ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = withAlpha(theme.colors.shadowColor, 0.25);
                }}
                onMouseLeave={(e) => {
                  if (!active) (e.currentTarget as HTMLElement).style.background = "transparent";
                }}
              >
                {/* Left: name + type/size */}
                <div style={{ minWidth: 0 }}>
                  <div style={{
                    fontWeight: 700,
                    fontSize: "var(--fs-medium)",
                    color: active ? theme.colors.accentPrimary : theme.colors.text,
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                  }}>
                    {a.name}
                  </div>
                  <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginTop: 1 }}>
                    {[a.adversaryType, a.size].filter(Boolean).join(" · ")}
                  </div>
                </div>
                {/* Right: tier + HP */}
                <div style={{ flexShrink: 0, textAlign: "right" }}>
                  <div style={{ fontSize: "var(--fs-small)", fontWeight: 700, color: theme.colors.text }}>
                    Tier {a.tier}
                  </div>
                  <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted }}>
                    {a.hpRangeMin}–{a.hpRangeMax} HP
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </Panel>
  );
}
