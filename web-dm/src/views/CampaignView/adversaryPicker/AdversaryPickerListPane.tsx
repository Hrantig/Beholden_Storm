import * as React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { Input } from "@/ui/Input";
import { Button } from "@/ui/Button";
import { Select } from "@/ui/Select";
import type { Adversary } from "./types";

function hpRangeLabel(a: Adversary): string {
  if (a.hpRangeMin === a.hpRangeMax) return String(a.hpRangeMax);
  return `${a.hpRangeMin}–${a.hpRangeMax}`;
}

export function AdversaryPickerListPane(props: {
  loading: boolean;
  filteredAdversaries: Adversary[];
  selectedAdversaryId: string | null;
  onSelectAdversary: (id: string) => void;

  searchQ: string;
  onChangeSearchQ: (v: string) => void;
  tierFilter: string;
  onChangeTierFilter: (v: string) => void;
  typeFilter: string;
  onChangeTypeFilter: (v: string) => void;
  sizeFilter: string;
  onChangeSizeFilter: (v: string) => void;
  tierOptions: string[];
  typeOptions: string[];
  sizeOptions: string[];
  onClearFilters: () => void;
}) {
  return (
    <div style={{ display: "grid", gridTemplateRows: "auto 1fr", height: "100%", minHeight: 0, gap: 8 }}>

      {/* ── Controls ── */}
      <div style={{ display: "grid", gap: 6 }}>
        <Input
          value={props.searchQ}
          onChange={(e) => props.onChangeSearchQ(e.target.value)}
          placeholder="Search adversaries…"
        />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 6 }}>
          <Select value={props.tierFilter} onChange={(e) => props.onChangeTierFilter(e.target.value)}>
            <option value="all">All Tiers</option>
            {props.tierOptions.map((t) => (
              <option key={t} value={t}>Tier {t}</option>
            ))}
          </Select>
          <Select value={props.typeFilter} onChange={(e) => props.onChangeTypeFilter(e.target.value)}>
            <option value="all">All Types</option>
            {props.typeOptions.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </Select>
          <Select value={props.sizeFilter} onChange={(e) => props.onChangeSizeFilter(e.target.value)}>
            <option value="all">All Sizes</option>
            {props.sizeOptions.map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </Select>
        </div>
        <Button variant="ghost" onClick={props.onClearFilters} style={{ fontSize: "var(--fs-small)" }}>
          Clear filters
        </Button>
      </div>

      {/* ── List ── */}
      <div style={{ overflowY: "auto", display: "grid", alignContent: "start", gap: 2 }}>
        {props.loading ? (
          <div style={{ color: theme.colors.muted, padding: "12px 0" }}>Loading…</div>
        ) : props.filteredAdversaries.length === 0 ? (
          <div style={{ color: theme.colors.muted, padding: "12px 0" }}>No adversaries found.</div>
        ) : (
          props.filteredAdversaries.map((a) => {
            const selected = a.id === props.selectedAdversaryId;
            return (
              <button
                key={a.id}
                type="button"
                onClick={() => props.onSelectAdversary(a.id)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  padding: "8px 10px",
                  borderRadius: theme.radius.control,
                  border: `1px solid ${selected ? theme.colors.accentHighlightBorder : "transparent"}`,
                  background: selected ? theme.colors.accentHighlightBg : "transparent",
                  color: theme.colors.text,
                  cursor: "pointer",
                  transition: "background 80ms ease",
                }}
                onMouseEnter={(e) => {
                  if (!selected) (e.currentTarget as HTMLButtonElement).style.background = withAlpha(theme.colors.accentHighlight, 0.05);
                }}
                onMouseLeave={(e) => {
                  if (!selected) (e.currentTarget as HTMLButtonElement).style.background = "transparent";
                }}
              >
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                  <span style={{ fontWeight: 700 }}>{a.name}</span>
                  {a.dualPhase && (
                    <span style={{
                      fontSize: "var(--fs-small)",
                      fontWeight: 700,
                      padding: "1px 6px",
                      borderRadius: 6,
                      background: withAlpha(theme.colors.accentPrimary, 0.2),
                      color: theme.colors.accentPrimary,
                      whiteSpace: "nowrap",
                    }}>
                      Dual Phase
                    </span>
                  )}
                </div>
                <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginTop: 2 }}>
                  Tier {a.tier} · {a.adversaryType} · {a.size}
                </div>
                <div style={{ fontSize: "var(--fs-small)", color: theme.colors.muted }}>
                  HP {hpRangeLabel(a)}
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
