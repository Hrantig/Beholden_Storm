import React, { useState } from "react";
import { api, jsonInit } from "@/services/api";
import { C } from "@/lib/theme";
import { useAuth } from "@/contexts/AuthContext";

interface PlayerSelfCreateFormProps {
  campaignId: string;
  campaignName: string;
  onSuccess: () => void;
  onCancel: () => void;
}

const inputStyle: React.CSSProperties = {
  width: "100%",
  boxSizing: "border-box",
  background: "rgba(255,255,255,0.06)",
  border: "1px solid rgba(255,255,255,0.12)",
  borderRadius: 6,
  padding: "6px 8px",
  color: C.text,
  fontSize: "var(--fs-small)",
  outline: "none",
};

const labelStyle: React.CSSProperties = {
  display: "block",
  fontSize: "var(--fs-small)",
  color: C.muted,
  marginBottom: 4,
  fontWeight: 600,
};

export function PlayerSelfCreateForm({ campaignId, campaignName, onSuccess, onCancel }: PlayerSelfCreateFormProps) {
  const { user: authUser } = useAuth();

  const [playerName, setPlayerName] = useState(authUser?.name ?? "");
  const [characterName, setCharacterName] = useState("");
  const [ancestry, setAncestry] = useState("");
  const [pathsRaw, setPathsRaw] = useState("");
  const [level, setLevel] = useState(1);
  const [hpMax, setHpMax] = useState(10);
  const [focusMax, setFocusMax] = useState(0);
  const [investitureMax, setInvestitureMax] = useState(0);
  const [movement, setMovement] = useState(0);
  const [defensePhysical, setDefensePhysical] = useState(0);
  const [defenseCognitive, setDefenseCognitive] = useState(0);
  const [defenseSpiritual, setDefenseSpiritual] = useState(0);
  const [deflect, setDeflect] = useState(0);

  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setSubmitError(null);
    const paths = pathsRaw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
    try {
      await api(`/api/campaigns/${campaignId}/players/self`, jsonInit("POST", {
        playerName,
        characterName,
        ancestry,
        paths,
        level,
        hpMax,
        hpCurrent: hpMax,
        focusMax,
        focusCurrent: focusMax,
        investitureMax: investitureMax || null,
        investitureCurrent: investitureMax || null,
        movement,
        defensePhysical,
        defenseCognitive,
        defenseSpiritual,
        deflect,
      }));
      onSuccess();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Failed to create character");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={{
      background: C.panelBg,
      border: `1px solid ${C.panelBorder}`,
      borderRadius: 12,
      padding: 24,
    }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
        <h3 style={{ margin: 0, fontSize: "var(--fs-title)", fontWeight: 800, color: C.text }}>
          Create Character in {campaignName}
        </h3>
        <button
          onClick={onCancel}
          style={{ background: "transparent", border: "none", color: C.muted, fontSize: "var(--fs-body)", cursor: "pointer", padding: "4px 8px" }}
        >
          ✕
        </button>
      </div>

      <form onSubmit={handleSubmit}>
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <div>
            <label style={labelStyle}>Player Name</label>
            <input style={inputStyle} value={playerName} onChange={(e) => setPlayerName(e.target.value)} placeholder="Your name" />
          </div>

          <div>
            <label style={labelStyle}>Character Name</label>
            <input style={inputStyle} value={characterName} onChange={(e) => setCharacterName(e.target.value)} placeholder="Character name" />
          </div>

          <div>
            <label style={labelStyle}>Ancestry</label>
            <input style={inputStyle} value={ancestry} onChange={(e) => setAncestry(e.target.value)} placeholder="e.g. Alethi, Horneater" />
          </div>

          <div>
            <label style={labelStyle}>Paths</label>
            <input style={inputStyle} value={pathsRaw} onChange={(e) => setPathsRaw(e.target.value)} placeholder="e.g. Soldier, Scholar" />
            <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 4, display: "block" }}>
              Separate multiple paths with commas
            </span>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14 }}>
            <div>
              <label style={labelStyle}>Level</label>
              <input style={inputStyle} type="number" min={1} value={level} onChange={(e) => setLevel(parseInt(e.target.value) || 1)} />
            </div>
            <div>
              <label style={labelStyle}>HP Max</label>
              <input style={inputStyle} type="number" min={0} value={hpMax} onChange={(e) => setHpMax(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label style={labelStyle}>Focus Max</label>
              <input style={inputStyle} type="number" min={0} value={focusMax} onChange={(e) => setFocusMax(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label style={labelStyle}>Investiture Max</label>
              <input style={inputStyle} type="number" min={0} value={investitureMax} onChange={(e) => setInvestitureMax(parseInt(e.target.value) || 0)} />
              <span style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginTop: 4, display: "block" }}>
                Leave at 0 if your character has no Investiture
              </span>
            </div>
            <div>
              <label style={labelStyle}>Movement</label>
              <input style={inputStyle} type="number" min={0} value={movement} onChange={(e) => setMovement(parseInt(e.target.value) || 0)} />
            </div>
            <div>
              <label style={labelStyle}>Deflect</label>
              <input style={inputStyle} type="number" min={0} value={deflect} onChange={(e) => setDeflect(parseInt(e.target.value) || 0)} />
            </div>
          </div>

          <div>
            <label style={labelStyle}>Defense</label>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 10 }}>
              <div>
                <label style={{ ...labelStyle, fontWeight: 400 }}>Physical</label>
                <input style={inputStyle} type="number" min={0} value={defensePhysical} onChange={(e) => setDefensePhysical(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontWeight: 400 }}>Cognitive</label>
                <input style={inputStyle} type="number" min={0} value={defenseCognitive} onChange={(e) => setDefenseCognitive(parseInt(e.target.value) || 0)} />
              </div>
              <div>
                <label style={{ ...labelStyle, fontWeight: 400 }}>Spiritual</label>
                <input style={inputStyle} type="number" min={0} value={defenseSpiritual} onChange={(e) => setDefenseSpiritual(parseInt(e.target.value) || 0)} />
              </div>
            </div>
          </div>

          {submitError && (
            <p style={{ margin: 0, color: C.red, fontSize: "var(--fs-small)" }}>{submitError}</p>
          )}

          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              type="button"
              onClick={onCancel}
              style={{ background: "transparent", color: C.muted, border: "1px solid rgba(255,255,255,0.14)", borderRadius: 7, padding: "6px 14px", fontSize: "var(--fs-small)", cursor: "pointer" }}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting}
              style={{ background: C.accentHl, color: C.textDark, border: "none", borderRadius: 8, padding: "8px 18px", fontSize: "var(--fs-subtitle)", fontWeight: 700, cursor: submitting ? "not-allowed" : "pointer", opacity: submitting ? 0.7 : 1 }}
            >
              {submitting ? "Creating…" : "Create Character"}
            </button>
          </div>

        </div>
      </form>
    </div>
  );
}
