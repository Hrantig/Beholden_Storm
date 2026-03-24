import React from "react";
import { C } from "@/lib/theme";
import { inputStyle, labelStyle } from "@/views/CharacterCreatorStyles";
import { extractPrerequisite, stripPrerequisiteLine } from "@/views/CharacterSheetUtils";

function btnStyle(primary: boolean, disabled: boolean): React.CSSProperties {
  return {
    padding: "9px 22px",
    borderRadius: 8,
    fontWeight: 700,
    cursor: disabled ? "not-allowed" : "pointer",
    border: primary ? "none" : "1px solid rgba(255,255,255,0.18)",
    background: disabled
      ? "rgba(255,255,255,0.06)"
      : primary
        ? C.accentHl
        : "rgba(255,255,255,0.08)",
    color: disabled ? "rgba(160,180,220,0.40)" : primary ? C.textDark : C.text,
    fontSize: 14,
    transition: "opacity 0.15s",
  };
}

export function StepHeader({ current, onStepClick }: { current: number; onStepClick: (s: number) => void }) {
  const steps = ["Class", "Species", "Background", "Level", "Skills", "Spells", "Ability Scores", "Stats", "Identity", "Assign"];
  return (
    <div style={{ display: "flex", gap: 4, flexWrap: "wrap", marginBottom: 28 }}>
      {steps.map((label, i) => {
        const n = i + 1;
        const active = n === current;
        const done = n < current;
        return (
          <button
            key={n}
            type="button"
            onClick={() => onStepClick(n)}
            style={{
              padding: "5px 13px",
              borderRadius: 20,
              background: active ? C.accentHl : done ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.06)",
              color: active ? C.textDark : done ? C.accentHl : "rgba(160,180,220,0.50)",
              fontWeight: active ? 700 : done ? 600 : 500,
              fontSize: 12,
              border: `1px solid ${active ? C.accentHl : done ? "rgba(56,182,255,0.35)" : "rgba(255,255,255,0.10)"}`,
              cursor: active ? "default" : "pointer",
              transition: "opacity 0.12s, background 0.12s",
            }}
          >
            {done ? "✓ " : `${n}. `}
            {label}
          </button>
        );
      })}
    </div>
  );
}

export function NavButtons({
  step,
  onBack,
  onNext,
  nextLabel = "Next →",
  nextDisabled = false,
}: {
  step: number;
  onBack: () => void;
  onNext: () => void;
  nextLabel?: string;
  nextDisabled?: boolean;
}) {
  return (
    <div style={{ display: "flex", gap: 10, marginTop: 24, justifyContent: "space-between" }}>
      <button type="button" onClick={onBack} disabled={step === 1} style={btnStyle(false, step === 1)}>
        ← Back
      </button>
      <button type="button" onClick={onNext} disabled={nextDisabled} style={btnStyle(true, nextDisabled)}>
        {nextLabel}
      </button>
    </div>
  );
}

export function CardGrid({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))", gap: 10 }}>
      {children}
    </div>
  );
}

export function SelectableCard({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{
        padding: "13px 15px",
        borderRadius: 10,
        textAlign: "left",
        border: `2px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
        background: selected ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
        color: C.text,
        cursor: "pointer",
        boxShadow: selected ? `0 0 0 1px ${C.accentHl}22` : "none",
        transition: "border-color 0.12s, background 0.12s",
      }}
    >
      <div style={{ fontWeight: 700, fontSize: 14, color: selected ? C.accentHl : C.text }}>{title}</div>
      {subtitle && (
        <div style={{ color: selected ? "rgba(56,182,255,0.75)" : "rgba(160,180,220,0.6)", fontSize: 12, marginTop: 3 }}>
          {subtitle}
        </div>
      )}
    </button>
  );
}

export function SpellPicker<T extends { id: string; name: string; level: number | null; text?: string | null }>({
  title,
  spells,
  chosen,
  max,
  emptyMsg,
  onToggle,
  isAllowed,
}: {
  title: string;
  spells: T[];
  chosen: string[];
  max: number;
  emptyMsg: string;
  onToggle: (id: string) => void;
  isAllowed?: (spell: T) => boolean;
}) {
  const [q, setQ] = React.useState("");
  const filtered = q ? spells.filter((spell) => spell.name.toLowerCase().includes(q.toLowerCase())) : spells;
  return (
    <div style={{ marginBottom: 24 }}>
      <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
        <div style={{ ...labelStyle, margin: 0 }}>{title}</div>
        <span style={{ fontSize: 12, color: chosen.length >= max ? C.accentHl : C.muted }}>
          {chosen.length} / {max}
        </span>
      </div>
      {spells.length === 0 ? (
        <p style={{ color: C.muted, fontSize: 12 }}>{emptyMsg}</p>
      ) : (
        <>
          <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search…" style={{ ...inputStyle, width: "100%", marginBottom: 8 }} />
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 200, overflowY: "auto", padding: "2px 0" }}>
            {filtered.map((spell) => {
              const sel = chosen.includes(spell.id);
              const prerequisite = extractPrerequisite(spell.text);
              const preview = stripPrerequisiteLine(spell.text).replace(/Source:.*$/ms, "").trim();
              const allowed = isAllowed ? isAllowed(spell) : true;
              const locked = !sel && (chosen.length >= max || !allowed);
              return (
                <button
                  key={spell.id}
                  type="button"
                  disabled={locked}
                  onClick={() => onToggle(spell.id)}
                  style={{
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    cursor: locked ? "default" : "pointer",
                    border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                    background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                    color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                    fontWeight: sel ? 700 : 400,
                    textAlign: "left",
                    minWidth: 180,
                    maxWidth: 280,
                  }}
                >
                  <div style={{ fontWeight: 700 }}>
                    {spell.name}
                    {spell.level != null && spell.level > 0 ? (
                      <span style={{ color: "rgba(160,180,220,0.5)", marginLeft: 4 }}>(L{spell.level})</span>
                    ) : null}
                  </div>
                  {prerequisite && (
                    <div style={{ marginTop: 5, fontSize: 10, lineHeight: 1.35 }}>
                      <span style={{ color: allowed ? "#fbbf24" : "#f87171", fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.5 }}>
                        Prerequisite
                      </span>
                      <span style={{ color: allowed ? "rgba(251,191,36,0.92)" : "#fca5a5" }}> {prerequisite}</span>
                    </div>
                  )}
                  {!allowed && prerequisite && (
                    <div style={{ marginTop: 3, fontSize: 10, color: "#f87171", fontWeight: 700 }}>
                      Prerequisite not met
                    </div>
                  )}
                  {preview && (
                    <div style={{ marginTop: 5, fontSize: 10, lineHeight: 1.35, color: sel ? "rgba(191,227,255,0.82)" : "rgba(160,180,220,0.7)", whiteSpace: "normal" }}>
                      {preview.slice(0, 150)}{preview.length > 150 ? "…" : ""}
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}
