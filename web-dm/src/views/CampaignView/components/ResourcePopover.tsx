import React from "react";
import { theme, withAlpha } from "@/theme/theme";

interface ResourcePopoverProps {
  label: string;
  current: number;
  max: number;
  icon?: React.ReactNode;
  onChange: (newValue: number) => void;
}

export default function ResourcePopover({ label, current, max, icon, onChange }: ResourcePopoverProps) {
  const [open, setOpen] = React.useState(false);
  const wrapperRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const decrement = () => onChange(Math.max(0, current - 1));
  const increment = () => onChange(Math.min(max, current + 1));

  const btnStyle: React.CSSProperties = {
    width: 24, height: 24,
    display: "inline-flex", alignItems: "center", justifyContent: "center",
    borderRadius: 6,
    border: `1px solid ${theme.colors.panelBorder}`,
    background: "transparent",
    color: theme.colors.text,
    cursor: "pointer",
    fontSize: "var(--fs-body)",
    fontWeight: 900,
    padding: 0,
  };

  return (
    <div
      ref={wrapperRef}
      onClick={(e) => e.stopPropagation()}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <button
        type="button"
        aria-label={label}
        onClick={() => setOpen((v) => !v)}
        style={{
          all: "unset",
          cursor: "pointer",
          display: "inline-flex", alignItems: "center", gap: 4,
          padding: "2px 7px",
          borderRadius: 999,
          border: `1px solid ${withAlpha(theme.colors.panelBorder, 0.1)}`,
          background: withAlpha(theme.colors.panelBg, 0.15),
          color: theme.colors.text,
        }}
      >
        {icon ? <span style={{ opacity: 0.55, color: theme.colors.muted, display: "inline-flex" }}>{icon}</span> : null}
        <span style={{ fontWeight: 900, fontSize: "var(--fs-medium)", fontVariantNumeric: "tabular-nums" }}>
          {current}/{max}
        </span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
          background: theme.colors.drawerBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 8,
          padding: "6px 10px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          display: "flex", alignItems: "center", gap: 8,
        }}>
          <button type="button" style={btnStyle} onClick={decrement}>−</button>
          <span style={{
            fontWeight: 900, fontVariantNumeric: "tabular-nums",
            minWidth: 24, textAlign: "center",
            fontSize: "var(--fs-body)", color: theme.colors.text,
          }}>
            {current}
          </span>
          <button type="button" style={btnStyle} onClick={increment}>+</button>
        </div>
      )}
    </div>
  );
}
