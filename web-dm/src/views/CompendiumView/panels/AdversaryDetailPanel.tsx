import React from "react";
import { Panel } from "@/ui/Panel";
import { theme, withAlpha } from "@/theme/theme";
import { api } from "@/services/api";
import type { Adversary } from "@/domain/types/domain";

function StatCell({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center",
      padding: "8px 6px", gap: 2, textAlign: "center",
    }}>
      <span style={{ fontSize: "var(--fs-tiny)", fontWeight: 700, textTransform: "uppercase", letterSpacing: 0.5, color: theme.colors.muted }}>
        {label}
      </span>
      <span style={{ fontSize: "var(--fs-medium)", fontWeight: 900, color: theme.colors.text, fontVariantNumeric: "tabular-nums" }}>
        {value}
      </span>
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      fontSize: "var(--fs-small)", fontWeight: 900, textTransform: "uppercase", letterSpacing: 0.8,
      color: theme.colors.muted, borderBottom: `1px solid ${theme.colors.panelBorder}`, paddingBottom: 4, marginBottom: 6,
    }}>
      {children}
    </div>
  );
}

export function AdversaryDetailPanel(props: { adversaryId: string | null }) {
  const [adversary, setAdversary] = React.useState<Adversary | null>(null);
  const [loading, setLoading] = React.useState(false);

  React.useEffect(() => {
    if (!props.adversaryId) { setAdversary(null); return; }
    setLoading(true);
    setAdversary(null);
    api<Adversary>(`/api/compendium/adversaries/${props.adversaryId}`)
      .then(setAdversary)
      .catch(() => setAdversary(null))
      .finally(() => setLoading(false));
  }, [props.adversaryId]);

  if (!props.adversaryId) {
    return (
      <Panel
        title="Adversary"
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
        bodyStyle={{ flex: 1 }}
      >
        <div style={{ color: theme.colors.muted }}>Select an adversary to view its stat block.</div>
      </Panel>
    );
  }

  if (loading || !adversary) {
    return (
      <Panel
        title="Adversary"
        style={{ flex: 1, display: "flex", flexDirection: "column" }}
        bodyStyle={{ flex: 1 }}
      >
        <div style={{ color: theme.colors.muted }}>{loading ? "Loading…" : "Not found."}</div>
      </Panel>
    );
  }

  const a = adversary;
  const subtitle = [
    `Tier ${a.tier}`,
    a.adversaryType,
    a.size,
  ].filter(Boolean).join(" · ");

  return (
    <Panel
      title={a.name}
      style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}
      bodyStyle={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column", gap: 14 }}
    >
      {/* Subtitle */}
      <div style={{ fontSize: "var(--fs-small)", fontWeight: 600, color: theme.colors.muted, marginTop: -6 }}>
        {subtitle}
      </div>

      {/* Dual-phase badge */}
      {a.dualPhase && (
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 6,
          padding: "4px 10px", borderRadius: 999,
          background: withAlpha(theme.colors.accentWarning, 0.15),
          border: `1px solid ${withAlpha(theme.colors.accentWarning, 0.5)}`,
          color: theme.colors.accentWarning,
          fontSize: "var(--fs-small)", fontWeight: 900,
          alignSelf: "flex-start",
        }}>
          Boss — Dual Phase
        </div>
      )}

      {/* Stats grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(80px, 1fr))",
        borderRadius: 10,
        border: `1px solid ${theme.colors.panelBorder}`,
        background: theme.colors.panelBg,
        overflow: "hidden",
      }}>
        <StatCell label="HP" value={`${a.hpRangeMin}–${a.hpRangeMax}`} />
        <StatCell label="Focus" value={a.focusMax} />
        {a.investitureMax > 0 && <StatCell label="Investiture" value={a.investitureMax} />}
        <StatCell label="Def Phys" value={a.defensePhysical} />
        <StatCell label="Def Cog" value={a.defenseCognitive} />
        <StatCell label="Def Spi" value={a.defenseSpiritual} />
        <StatCell label="Deflect" value={a.deflect} />
        <StatCell label="Movement" value={`${a.movement} ft`} />
      </div>

      {/* Features */}
      {a.features && a.features.length > 0 && (
        <div>
          <SectionHeading>Features</SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {a.features.map((f, i) => (
              <div key={i}>
                <span style={{ fontWeight: 700, color: theme.colors.text, fontSize: "var(--fs-small)" }}>{f.name}. </span>
                <span style={{ color: theme.colors.text, fontSize: "var(--fs-small)", lineHeight: 1.5 }}>{f.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      {a.actions.length > 0 && (
        <div>
          <SectionHeading>Actions</SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {a.actions.map((act, i) => (
              <div key={i}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
                  <span style={{ fontWeight: 700, color: theme.colors.text, fontSize: "var(--fs-small)" }}>{act.name}</span>
                  <span style={{
                    fontSize: "var(--fs-tiny)", fontWeight: 900,
                    padding: "2px 7px", borderRadius: 999,
                    background: withAlpha(theme.colors.accentPrimary, 0.15),
                    border: `1px solid ${withAlpha(theme.colors.accentPrimary, 0.4)}`,
                    color: theme.colors.accentPrimary,
                  }}>
                    {act.cost} AP
                  </span>
                </div>
                <div style={{ color: theme.colors.text, fontSize: "var(--fs-small)", lineHeight: 1.5 }}>{act.description}</div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Additional features */}
      {a.additionalFeatures && a.additionalFeatures.length > 0 && (
        <div>
          <SectionHeading>Additional Features</SectionHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {a.additionalFeatures.map((f, i) => (
              <div key={i}>
                <span style={{ fontWeight: 700, color: theme.colors.text, fontSize: "var(--fs-small)" }}>{f.name}. </span>
                <span style={{ color: theme.colors.text, fontSize: "var(--fs-small)", lineHeight: 1.5 }}>{f.description}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </Panel>
  );
}
