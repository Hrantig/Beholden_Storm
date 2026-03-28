import React from "react";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { theme } from "@/theme/theme";
import { api } from "@/services/api";

type TreasureDrawerState = Exclude<Extract<DrawerState, { type: "viewTreasure" }>, null>;

// ---------------------------------------------------------------------------
// Weapon stat helpers
// ---------------------------------------------------------------------------

const PROPERTY_LABELS: Record<string, string> = {
  "2H": "Two-Handed", F: "Finesse", L: "Light", T: "Thrown",
  V: "Versatile", R: "Reach", H: "Heavy", A: "Ammunition",
  LD: "Loading", S: "Special",
};

const DMG_TYPE_LABELS: Record<string, string> = {
  S: "Slashing", P: "Piercing", B: "Bludgeoning",
  F: "Fire", C: "Cold", L: "Lightning", A: "Acid",
  N: "Necrotic", R: "Radiant", T: "Thunder",
  PS: "Psychic", PO: "Poison", FO: "Force",
};

function fmtDamage(dmg1: string | null, dmg2: string | null, dmgType: string | null): string | null {
  const dice = dmg2 || dmg1 || null;
  const typeLabel = DMG_TYPE_LABELS[dmgType ?? ""] ?? dmgType ?? null;
  if (!dice && !typeLabel) return null;
  if (!typeLabel) return dice;
  if (!dice) return typeLabel;
  return `${dice} ${typeLabel}`;
}

interface CompendiumItem {
  weight?: number | null;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  modifiers?: Array<{ category: string; text: string }>;
}

// ---------------------------------------------------------------------------
// Chip sub-component
// ---------------------------------------------------------------------------

function Chip({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: "var(--fs-small)", fontWeight: 700, padding: "2px 8px", borderRadius: 5,
      background: `${color}1a`, border: `1px solid ${color}44`, color,
    }}>
      {label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Drawer
// ---------------------------------------------------------------------------

export function TreasureDrawer(props: { drawer: TreasureDrawerState; close: () => void }): DrawerContent {
  const { state } = useStore();
  const [itemData, setItemData] = React.useState<CompendiumItem | null>(null);

  const entry = React.useMemo(() => {
    const all = [...state.campaignTreasure, ...state.adventureTreasure];
    return all.find((t) => t.id === props.drawer.treasureId) ?? null;
  }, [props.drawer.treasureId, state.adventureTreasure, state.campaignTreasure]);

  // Fetch compendium item data when we have an itemId
  React.useEffect(() => {
    if (!entry?.itemId) { setItemData(null); return; }
    let cancelled = false;
    api<CompendiumItem>(`/api/compendium/items/${encodeURIComponent(entry.itemId)}`)
      .then((d) => { if (!cancelled) setItemData(d ?? null); })
      .catch(() => { if (!cancelled) setItemData(null); });
    return () => { cancelled = true; };
  }, [entry?.itemId]);

  if (!entry) {
    return {
      body: <div style={{ color: theme.colors.muted }}>Item not found.</div>
    };
  }

  const dmgLabel = itemData
    ? fmtDamage(itemData.dmg1 ?? null, itemData.dmg2 ?? null, itemData.dmgType ?? null)
    : null;

  const propertyLabels = (itemData?.properties ?? [])
    .map((p) => PROPERTY_LABELS[p] ?? p);

  const meta = [entry.rarity, entry.type, entry.attunement ? "Requires attunement" : null]
    .filter(Boolean).join(" • ");

  return {
    body: (
      <div style={{ display: "grid", gap: 14 }}>

        {/* Name + magic badge */}
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <span style={{ fontSize: "var(--fs-large)", fontWeight: 900 }}>{entry.name}</span>
            {entry.magic ? (
              <span style={{
                fontSize: "var(--fs-small)", fontWeight: 700, color: "#6ea8fe",
                border: "1px solid #3d6db0", borderRadius: 6, padding: "1px 6px", lineHeight: 1.4,
              }}>
                ✦ Magic
              </span>
            ) : null}
          </div>
          {meta ? <div style={{ color: theme.colors.muted, marginTop: 4, fontSize: "var(--fs-subtitle)" }}>{meta}</div> : null}
        </div>

        {/* Weapon stat chips */}
        {(dmgLabel || propertyLabels.length > 0 || (itemData?.weight ?? null) !== null) && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {dmgLabel && <Chip label={dmgLabel} color={theme.colors.colorPinkRed} />}
            {propertyLabels.map((p) => (
              <Chip key={p} label={p} color="#94a3b8" />
            ))}
            {itemData?.weight != null && (
              <Chip label={`${itemData.weight} lb`} color="#64748b" />
            )}
          </div>
        )}

        {/* Modifier chips */}
        {(itemData?.modifiers ?? []).length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
            {(itemData!.modifiers!).map((m, i) => (
              <Chip key={i} label={m.text} color={theme.colors.colorMagic} />
            ))}
          </div>
        )}

        {/* Description */}
        {entry.text ? (
          <div
            className="bh-prewrap"
            style={{
              color: theme.colors.text,
              lineHeight: 1.5,
              background: theme.colors.inputBg,
              border: `1px solid ${theme.colors.panelBorder}`,
              borderRadius: 12,
              padding: 12,
              fontSize: "var(--fs-subtitle)",
            }}
          >
            {entry.text}
          </div>
        ) : null}

      </div>
    )
  };
}
