import React, { useEffect, useState } from "react";
import { C, withAlpha } from "@/lib/theme";
import type { ClassFeatureEntry, PlayerNote } from "@/views/CharacterSheetTypes";

export function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
  const [visible, setVisible] = useState(false);

  if (!text) return <>{children}</>;

  return (
    <span
      style={{ position: "relative", display: "inline-flex" }}
      onMouseEnter={() => setVisible(true)}
      onMouseLeave={() => setVisible(false)}
    >
      {children}
      {visible && (
        <span style={{
          position: "absolute", bottom: "calc(100% + 5px)", left: "50%",
          transform: "translateX(-50%)",
          background: "rgba(10,15,28,0.97)",
          border: "1px solid rgba(255,255,255,0.14)",
          borderRadius: 6, padding: "4px 8px",
          fontSize: 11, color: "rgba(160,180,220,0.85)",
          whiteSpace: "nowrap", zIndex: 200, pointerEvents: "none",
          boxShadow: "0 4px 12px rgba(0,0,0,0.4)",
        }}>
          {text}
        </span>
      )}
    </span>
  );
}

export function Wrap({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: wide ? "none" : 1060, margin: "0 auto", padding: wide ? "16px" : "28px 20px" }}>
        {children}
      </div>
    </div>
  );
}

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{
      background: "rgba(255,255,255,0.035)",
      border: "1px solid rgba(255,255,255,0.09)",
      borderRadius: 12, padding: "14px 16px",
    }}>
      {children}
    </div>
  );
}

export function PanelTitle({ children, color, actions, style }: { children: React.ReactNode; color: string; actions?: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      fontSize: 10, fontWeight: 700, textTransform: "uppercase",
      letterSpacing: "0.1em", color,
      marginBottom: 10,
      display: "flex", alignItems: "center", gap: 8,
      ...style,
    }}>
      <span style={{ display: "flex", alignItems: "center", gap: 6 }}>{children}</span>
      <div style={{ flex: 1, height: 1, background: `${color}30` }} />
      {actions ? <div style={{ flexShrink: 0 }}>{actions}</div> : null}
    </div>
  );
}

export function ProfDot({ filled, color }: { filled: boolean; color: string }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: filled ? color : "transparent",
      border: `1.5px solid ${filled ? color : "rgba(255,255,255,0.2)"}`,
    }} />
  );
}

export function HexBtn({ variant, active, title, disabled, onClick, children }: {
  variant: "damage" | "heal" | "conditions" | "inspiration";
  active?: boolean;
  title: string;
  disabled: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  const bg = variant === "damage" ? C.red : variant === "heal" ? C.green : variant === "inspiration" ? (active ? "#a855f7" : "#4b2d6b") : "#f59e0b";
  return (
    <button
      type="button"
      title={title}
      disabled={disabled}
      onClick={onClick}
      style={{
        width: 56, height: 52,
        display: "grid", placeItems: "center",
        cursor: disabled ? "not-allowed" : "pointer",
        border: "2px solid rgba(255,255,255,0.1)",
        background: bg, color: "#fff",
        clipPath: "polygon(25% 4%, 75% 4%, 98% 50%, 75% 96%, 25% 96%, 2% 50%)",
        boxShadow: disabled ? "none" : active ? "0 0 12px 4px rgba(168,85,247,0.6), 0 2px 0 0 rgba(0,0,0,0.3)" : "0 2px 0 0 rgba(0,0,0,0.3)",
        animation: disabled ? "none" : "playerHexPulse 2.2s ease-in-out infinite",
        opacity: disabled ? 0.4 : variant === "inspiration" && !active ? 0.55 : 1,
        transition: "transform 80ms ease, opacity 150ms ease",
        userSelect: "none",
      }}
      onMouseDown={(e) => { if (!disabled) (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)"; }}
      onMouseUp={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0)"; }}
    >
      {children}
    </button>
  );
}

export function MiniStat({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
  return (
    <div style={{
      textAlign: "center", padding: "8px 6px", borderRadius: 8,
      background: "rgba(255,255,255,0.04)",
      border: `1px solid ${accent ? accent + "33" : "rgba(255,255,255,0.09)"}`,
    }}>
      <div style={{
        fontSize: 9, fontWeight: 700, color: C.muted, textTransform: "uppercase",
        letterSpacing: "0.06em", marginBottom: 3,
        display: "flex", alignItems: "center", justifyContent: "center", gap: 3,
      }}>
        {icon}{label}
      </div>
      <div style={{ fontSize: 16, fontWeight: 800, color: accent ?? C.text }}>
        {value}
      </div>
    </div>
  );
}

export function inventoryEquipBtn(active: boolean, color: string): React.CSSProperties {
  return {
    minWidth: 30,
    height: 24,
    borderRadius: 999,
    border: `1px solid ${active ? color : C.panelBorder}`,
    background: active ? withAlpha(color, 0.14) : "transparent",
    color: active ? color : C.muted,
    fontSize: 11,
    fontWeight: 800,
    cursor: "pointer",
    flexShrink: 0,
  };
}

export function panelHeaderAddBtn(color: string): React.CSSProperties {
  return {
    minWidth: 32,
    height: 32,
    padding: "0 9px",
    borderRadius: 10,
    border: `1px solid ${withAlpha(color, 0.38)}`,
    background: withAlpha(color, 0.18),
    color,
    cursor: "pointer",
    fontSize: 20,
    lineHeight: 1,
    fontWeight: 800,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
    boxShadow: `0 6px 18px ${withAlpha(color, 0.12)}`,
  };
}

export function addBtnStyle(accent: string): React.CSSProperties {
  return {
    background: accent, color: "#000",
    border: "none", borderRadius: 7,
    padding: "6px 14px", fontSize: 13,
    fontWeight: 700, cursor: "pointer",
  };
}

export const cancelBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 7, padding: "6px 14px",
  fontSize: 13, color: C.muted, cursor: "pointer",
};

export const inventoryCheckboxLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: C.muted,
};

export const inventoryPickerColumnStyle: React.CSSProperties = {
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  padding: 12,
  gap: 10,
};

export const inventoryPickerListStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 220,
  overflowY: "auto",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 10,
};

export const inventoryPickerDetailStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 260,
  overflowY: "auto",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 10,
  padding: 12,
  whiteSpace: "pre-wrap",
  lineHeight: 1.5,
  fontSize: 13,
  color: C.text,
};

export function inventoryRarityColor(rarity: string | null): string {
  switch ((rarity ?? "").toLowerCase()) {
    case "common": return C.muted;
    case "uncommon": return "#1eff00";
    case "rare": return "#0070dd";
    case "very rare": return "#a335ee";
    case "legendary": return "#ff8000";
    case "artifact": return "#e6cc80";
    default: return C.muted;
  }
}

export function toggleFilterPill(active: boolean, accentColor: string): React.CSSProperties {
  return {
    padding: "4px 10px",
    borderRadius: 999,
    border: `1px solid ${active ? accentColor : C.panelBorder}`,
    background: active ? `${accentColor}18` : "rgba(255,255,255,0.04)",
    color: active ? accentColor : C.muted,
    cursor: "pointer",
    fontSize: 11,
    fontWeight: 700,
  };
}

export function miniPillBtn(enabled: boolean): React.CSSProperties {
  return {
    width: 28,
    height: 28,
    borderRadius: 999,
    border: `1px solid ${enabled ? "rgba(255,255,255,0.18)" : "rgba(255,255,255,0.08)"}`,
    background: enabled ? "rgba(255,255,255,0.06)" : "rgba(255,255,255,0.03)",
    color: enabled ? C.text : C.muted,
    cursor: enabled ? "pointer" : "default",
    fontSize: 16,
    fontWeight: 800,
    lineHeight: 1,
    display: "inline-flex",
    alignItems: "center",
    justifyContent: "center",
  };
}

export function restBtnStyle(color: string): React.CSSProperties {
  return {
    padding: "10px 14px",
    borderRadius: 10,
    border: `1px solid ${withAlpha(color, 0.45)}`,
    background: withAlpha(color, 0.12),
    color,
    cursor: "pointer",
    fontSize: 12,
    fontWeight: 800,
    minWidth: 102,
  };
}

export function NoteItem(props: {
  note: PlayerNote;
  expanded: boolean;
  accentColor: string;
  hideTitle?: boolean;
  onToggle: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
}) {
  const { note, expanded, accentColor, hideTitle } = props;
  const preview = (note.text ?? "").trim().split(/\r?\n/).find(Boolean) ?? "";
  const label = hideTitle ? (preview || note.title || "Untitled") : (note.title || "Untitled");
  return (
    <div style={{
      padding: "5px 6px", borderRadius: 7,
      background: expanded ? withAlpha(accentColor, 0.07) : "transparent",
      border: `1px solid ${expanded ? withAlpha(accentColor, 0.22) : "transparent"}`,
    }}>
      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
        <button
          onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onToggle(); }}
          style={{ all: "unset", cursor: "pointer", fontWeight: 700, color: C.text, flex: 1, fontSize: 13, lineHeight: 1.4 }}
        >
          {label}
        </button>
        {props.onEdit && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onEdit!(); }}
            style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 5, color: C.muted, cursor: "pointer", padding: "2px 7px", fontSize: 11 }}
          >
            Edit
          </button>
        )}
        {props.onDelete && (
          <button
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onDelete!(); }}
            style={{ background: "rgba(255,93,93,0.08)", border: "1px solid rgba(255,93,93,0.25)", borderRadius: 5, color: C.red, cursor: "pointer", padding: "2px 7px", fontSize: 11 }}
          >
            ×
          </button>
        )}
      </div>
      {expanded && note.text && (
        <div style={{ marginTop: 6, color: C.muted, fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {note.text}
        </div>
      )}
    </div>
  );
}

export function ClassFeatureItem(props: {
  feature: ClassFeatureEntry;
  expanded: boolean;
  accentColor: string;
  onToggle: () => void;
}) {
  const { feature, expanded, accentColor } = props;
  return (
    <div style={{
      padding: "5px 6px",
      borderRadius: 7,
      background: expanded ? withAlpha(accentColor, 0.07) : "transparent",
      border: `1px solid ${expanded ? withAlpha(accentColor, 0.22) : "transparent"}`,
    }}>
      <button
        onClick={(e) => { e.preventDefault(); e.stopPropagation(); props.onToggle(); }}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "block",
          width: "100%",
          fontWeight: 700,
          color: C.text,
          fontSize: 13,
          lineHeight: 1.4,
        }}
      >
        {feature.name}
      </button>
      {expanded && feature.text && (
        <div style={{ marginTop: 6, color: C.muted, fontSize: 12, whiteSpace: "pre-wrap", lineHeight: 1.5 }}>
          {feature.text}
        </div>
      )}
    </div>
  );
}

export function NoteEditDrawer(props: {
  scope: "player" | "shared";
  note: PlayerNote | null;
  accentColor: string;
  onSave: (title: string, text: string) => void;
  onDelete?: () => void;
  onClose: () => void;
}) {
  const color = props.scope === "shared" ? C.green : props.accentColor;
  const label = props.scope === "shared" ? "Shared Note" : "Player Note";
  const [title, setTitle] = useState(props.note?.title ?? "");
  const [text, setText] = useState(props.note?.text ?? "");

  useEffect(() => {
    setTitle(props.note?.title ?? "");
    setText(props.note?.text ?? "");
  }, [props.note]);

  return (
    <>
      <div onClick={props.onClose} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 901,
        width: "min(400px, 90vw)",
        background: "#0e1220",
        borderLeft: "1px solid rgba(255,255,255,0.12)",
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 30px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
        }}>
          <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color }}>
            {props.note ? `Edit ${label}` : `New ${label}`}
          </span>
          <button onClick={props.onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 6, color: C.muted, cursor: "pointer", padding: "4px 10px", fontSize: 12, fontWeight: 700 }}>
            Close
          </button>
        </div>
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title..."
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: C.text, fontSize: 13, padding: "8px 10px", fontFamily: "inherit" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Text</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write..."
              rows={12}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: C.text, fontSize: 13, padding: "8px 10px", fontFamily: "inherit", lineHeight: 1.5 }}
            />
          </div>
        </div>
        <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "space-between", gap: 8 }}>
          <div>
            {props.note && props.onDelete && (
              <button onClick={props.onDelete} style={{ background: "rgba(255,93,93,0.12)", border: "1px solid rgba(255,93,93,0.3)", borderRadius: 8, color: C.red, cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>
                Delete
              </button>
            )}
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={props.onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, color: C.muted, cursor: "pointer", padding: "8px 16px", fontSize: 13 }}>
              Cancel
            </button>
            <button onClick={() => props.onSave(title.trim() || "Note", text)} style={{ background: `${color}22`, border: `1px solid ${color}55`, borderRadius: 8, color, cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>
              Save
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
