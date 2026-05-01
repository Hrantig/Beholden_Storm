import React from "react";
import { theme, withAlpha } from "@/theme/theme";
import { IconHeart } from "@/icons";

interface HpPopoverProps {
  current: number;
  max: number;
  tempHp?: number;
  onChange: (newHpCurrent: number) => void;
}

export default function HpPopover({ current, max, tempHp, onChange }: HpPopoverProps) {
  const [open, setOpen] = React.useState(false);
  const [input, setInput] = React.useState("");
  const wrapperRef = React.useRef<HTMLDivElement>(null);
  const inputRef = React.useRef<HTMLInputElement>(null);

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

  React.useEffect(() => {
    if (open) inputRef.current?.focus();
  }, [open]);

  const amount = parseInt(input, 10);
  const isValid = !isNaN(amount) && amount > 0;

  const applyDmg = () => {
    if (!isValid) return;
    onChange(Math.max(0, current - amount));
    setInput("");
  };

  const applyHeal = () => {
    if (!isValid) return;
    onChange(Math.min(max, current + amount));
    setInput("");
  };

  return (
    <div
      ref={wrapperRef}
      onClick={(e) => e.stopPropagation()}
      style={{ position: "relative", display: "inline-flex" }}
    >
      <button
        type="button"
        aria-label="HP"
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
        <IconHeart size={14} style={{ color: "#f87171" }} />
        <span style={{ fontWeight: 900, fontSize: "var(--fs-medium)", fontVariantNumeric: "tabular-nums" }}>
          {current}/{max}
          {tempHp && tempHp > 0 ? (
            <span style={{ color: theme.colors.accentHighlight, fontSize: "var(--fs-small)", marginLeft: 3 }}>
              +{tempHp}
            </span>
          ) : null}
        </span>
      </button>

      {open && (
        <div style={{
          position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200,
          background: theme.colors.drawerBg,
          border: `1px solid ${theme.colors.panelBorder}`,
          borderRadius: 8,
          padding: "6px 8px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.5)",
          display: "flex", flexDirection: "row", alignItems: "center", gap: 6,
          minWidth: "auto",
        }}>
          <button
              type="button"
              disabled={!isValid}
              onClick={applyDmg}
              style={{
                background: "rgba(239,68,68,0.15)",
                border: "1px solid rgba(239,68,68,0.4)",
                color: "#f87171",
                borderRadius: 6,
                padding: "3px 0",
                flex: 1,
                cursor: isValid ? "pointer" : "default",
                fontSize: "var(--fs-small)",
                fontWeight: 700,
                opacity: isValid ? 1 : 0.4,
              }}
            >
              DMG
            </button>
          <input
            ref={inputRef}
            type="number"
            min={1}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") applyDmg(); }}
            placeholder="Amount"
            inputMode="numeric"
            style={{
              width: 72,
              border: `1px solid ${theme.colors.panelBorder}`,
              background: "transparent",
              color: theme.colors.text,
              borderRadius: 6,
              padding: "3px 6px",
              fontSize: "var(--fs-small)",
              outline: "none",
            }}
          />
            <button
              type="button"
              disabled={!isValid}
              onClick={applyHeal}
              style={{
                background: "rgba(34,197,94,0.15)",
                border: "1px solid rgba(34,197,94,0.4)",
                color: "#4ade80",
                borderRadius: 6,
                padding: "3px 0",
                flex: 1,
                cursor: isValid ? "pointer" : "default",
                fontSize: "var(--fs-small)",
                fontWeight: 700,
                opacity: isValid ? 1 : 0.4,
              }}
            >
              Heal
            </button>
          </div>
      )}
    </div>
  );
}
