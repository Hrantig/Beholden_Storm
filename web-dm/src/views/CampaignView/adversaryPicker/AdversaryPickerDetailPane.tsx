import * as React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import type { Adversary } from "./types";

function StatPill({ label, value }: { label: string; value: number }) {
  return (
    <div style={{
      display: "flex",
      flexDirection: "column",
      alignItems: "center",
      gap: 2,
      padding: "6px 10px",
      borderRadius: theme.radius.control,
      border: `1px solid ${theme.colors.panelBorder}`,
      background: "rgba(255,255,255,0.04)",
      minWidth: 52,
    }}>
      <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, fontWeight: 600 }}>{label}</span>
      <span style={{ fontWeight: 800, fontSize: "var(--fs-medium)" }}>{value}</span>
    </div>
  );
}

export function AdversaryPickerDetailPane(props: {
  selectedAdversary: Adversary | null;

  hp: string;
  qty: number;
  label: string;
  friendly: boolean;

  onChangeHp: (v: string) => void;
  onChangeQty: (v: number) => void;
  onChangeLabel: (v: string) => void;
  onChangeFriendly: (v: boolean) => void;
  onAdd: () => void;
  onAddCustom?: () => void;
  
}) {
  const a = props.selectedAdversary;

  if (!a) {
    return (
      <div style={{ display: "flex", alignItems: "center", justifyContent: "center", height: "100%", color: theme.colors.muted }}>
        Select an adversary
      </div>
    );
  }

  const hpFixed = a.hpRangeMin === a.hpRangeMax;

  const [justAdded, setJustAdded] = React.useState(false);

  function handleAdd() {
    props.onAdd(/* existing args */);
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 600);
  }

  return (
    <div style={{ display: "grid", gridTemplateRows: "1fr auto", height: "100%", minHeight: 0, overflow: "hidden" }}>

      {/* ── Scrollable content ── */}
      <div style={{ overflowY: "auto", padding: "0 2px" }}>

        {/* Header */}
        <div style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 900, fontSize: "var(--fs-large)" }}>{a.name}</div>
          <div style={{ color: theme.colors.muted, fontSize: "var(--fs-small)", marginTop: 3 }}>
            Tier {a.tier} · {a.adversaryType} · {a.size}
          </div>
        </div>

        {/* Stats */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 16 }}>
          <StatPill label="Phys Def" value={a.defensePhysical} />
          <StatPill label="Cog Def" value={a.defenseCognitive} />
          <StatPill label="Spi Def" value={a.defenseSpiritual} />
          <StatPill label="Deflect" value={a.deflect} />
          <StatPill label="Move" value={a.movement} />
          <StatPill label="Focus" value={a.focusMax} />
          {a.investitureMax > 0 && <StatPill label="Invest." value={a.investitureMax} />}
        </div>

        {/* Dual phase notice */}
        {a.dualPhase && (
          <div style={{
            padding: "8px 12px",
            borderRadius: theme.radius.control,
            border: `1px solid ${withAlpha(theme.colors.accentPrimary, 0.4)}`,
            background: withAlpha(theme.colors.accentPrimary, 0.08),
            color: theme.colors.accentPrimary,
            fontSize: "var(--fs-small)",
            fontWeight: 600,
            marginBottom: 16,
          }}>
            This adversary acts in both Fast and Slow NPC phases.
          </div>
        )}

        {/* Quantity */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 4, fontSize: "var(--fs-small)", color: theme.colors.muted }}>
            Quantity
          </label>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Button
              variant="ghost"
              onClick={() => props.onChangeQty(Math.max(1, props.qty - 1))}
              disabled={props.qty <= 1}
              style={{ padding: "6px 14px", fontWeight: 800, fontSize: "var(--fs-medium)" }}
            >
              −
            </Button>
            <span style={{ fontWeight: 800, minWidth: 24, textAlign: "center" }}>{props.qty}</span>
            <Button
              variant="ghost"
              onClick={() => props.onChangeQty(Math.min(20, props.qty + 1))}
              disabled={props.qty >= 20}
              style={{ padding: "6px 14px", fontWeight: 800, fontSize: "var(--fs-medium)" }}
            >
              +
            </Button>
          </div>
        </div>

        {/* HP */}
        {props.qty  > 1 && a.hpRangeMin !== a.hpRangeMax ? (
          <div style={{ 
            color: theme.colors.muted, 
            fontSize: "var(--fs-medium)",
            padding: "8px 10px",
            borderRadius: 8,
            border: `1px solid ${theme.colors.panelBorder}`,
            lineHeight: 1.5
          }}>
            Each instance will receive a random HP value within the range ({a.hpRangeMin}–{a.hpRangeMax})
          </div>
        ) : (
          <div style={{ marginBottom: 12 }}>
            <label style={{ display: "block", fontWeight: 700, marginBottom: 4, fontSize: "var(--fs-small)", color: theme.colors.muted }}>
              HP [Range: {a.hpRangeMin}–{a.hpRangeMax}]
            </label>
            {hpFixed ? (
              <div style={{
                padding: "8px 10px",
                borderRadius: theme.radius.control,
                border: `1px solid ${theme.colors.panelBorder}`,
                background: "rgba(255,255,255,0.04)",
                fontWeight: 700,
              }}>
                {a.hpRangeMax}
              </div>
            ) : (
              <>
                <Input
                  type="number"
                  value={props.hp}
                  onChange={(e) => props.onChangeHp(e.target.value)}
                  min={a.hpRangeMin}
                  max={a.hpRangeMax}
                />
              </>
            )}
          {/* Quick-set HP buttons */}
          <label style={{ display: "block", fontWeight: 700, marginTop: 4, marginBottom: 4, fontSize: "var(--fs-small)", color: theme.colors.muted }}>
              Quick-set HP buttons
          </label>
          {a.hpRangeMin !== a.hpRangeMax && (
            <div style={{ display: "flex", gap: 6, marginBottom: 6 }}>
              <Button
                variant="ghost"
                style={{ padding: "4px 10px", fontSize: "var(--fs-small)" }}
                onClick={() => props.onChangeHp(String(a.hpRangeMin))}
              >
                Min
              </Button>
              <Button
                variant="ghost"
                style={{ padding: "4px 10px", fontSize: "var(--fs-small)" }}
                onClick={() => props.onChangeHp(String(Math.round((a.hpRangeMin + a.hpRangeMax) / 2)))}
              >
                Mean
              </Button>
              <Button
                variant="ghost"
                style={{ padding: "4px 10px", fontSize: "var(--fs-small)" }}
                onClick={() => props.onChangeHp(String(a.hpRangeMax))}
              >
                Max
              </Button>
              <Button
                variant="ghost"
                style={{ padding: "4px 10px", fontSize: "var(--fs-small)" }}
                onClick={() => props.onChangeHp(String(
                  Math.floor(Math.random() * (a.hpRangeMax - a.hpRangeMin + 1)) + a.hpRangeMin
                ))}
              >
                Random ⚄
              </Button>
            </div>
          )}
          </div>
        )}

        {/* Label */}
        <div style={{ marginBottom: 12 }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 4, fontSize: "var(--fs-small)", color: theme.colors.muted }}>
            Label <span style={{ fontWeight: 400 }}>(optional)</span>
          </label>
          <Input
            value={props.label}
            onChange={(e) => props.onChangeLabel(e.target.value)}
            placeholder="Custom label…"
          />
        </div>

        {/* Friendly toggle */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: "block", fontWeight: 700, marginBottom: 6, fontSize: "var(--fs-small)", color: theme.colors.muted }}>
            Allegiance
          </label>
          <div style={{ display: "flex", gap: 6 }}>
            <Button
              variant={!props.friendly ? "primary" : "ghost"}
              onClick={() => props.onChangeFriendly(false)}
              style={{ flex: 1 }}
            >
              Hostile
            </Button>
            <Button
              variant={props.friendly ? "health" : "ghost"}
              onClick={() => props.onChangeFriendly(true)}
              style={{ flex: 1 }}
            >
              Friendly
            </Button>
          </div>
        </div>
      </div>

      {/* ── Add button ── */}
      <div style={{ display: "flex", gap: 8 }}>
        <Button
          onClick={handleAdd}
          disabled={!a}
          style={{ 
            flex: 1,
            ...(justAdded ? { background: "#22c55e", borderColor: "#22c55e", color: "white" } : {})
          }}
        >
          {justAdded ? "✓ Added!" : "Add"}
        </Button>
        <Button
          variant="ghost"
          onClick={() => {
            console.log("Add Custom clicked, onAddCustom:", props.onAddCustom);
            props.onAddCustom?.();
          }}
          disabled={!a}
        >
          Add Custom
        </Button>
      </div>
    </div>
  );
}
