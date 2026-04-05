import React, { useState } from "react";
import { theme, withAlpha } from "@/theme/theme";
import { api, jsonInit } from "@/services/api";

const MAX_INJURIES = 5;

export function PlayerInjuries(props: { playerId: string; injuryCount: number }) {
  const [count, setCount] = useState(props.injuryCount);

  async function handleClick(index: number) {
    // index is 0-based. Clicking a filled bubble (index < count) clears to that index.
    // Clicking the next empty bubble (index === count) adds one.
    const next = index < count ? index : index + 1;
    const clamped = Math.max(0, Math.min(MAX_INJURIES, next));
    if (clamped === count) return;
    setCount(clamped);
    try {
      await api(`/api/players/${props.playerId}`, jsonInit("PUT", { injuryCount: clamped }));
    } catch {
      setCount(count); // roll back on failure
    }
  }

  return (
    <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
      <span style={{ fontSize: "var(--fs-small)", color: theme.colors.muted, marginRight: 2 }}>
        Injuries
      </span>
      {Array.from({ length: MAX_INJURIES }, (_, i) => {
        const filled = i < count;
        const clickable = i <= count && count < MAX_INJURIES || filled;
        return (
          <div
            key={i}
            onClick={() => handleClick(i)}
            style={{
              width: 12,
              height: 12,
              borderRadius: "50%",
              background: filled ? theme.colors.red : "transparent",
              border: `1.5px solid ${filled ? theme.colors.red : withAlpha(theme.colors.muted, 0.4)}`,
              cursor: clickable ? "pointer" : "default",
              transition: "background 120ms ease, border-color 120ms ease",
              flexShrink: 0,
            }}
          />
        );
      })}
    </div>
  );
}
