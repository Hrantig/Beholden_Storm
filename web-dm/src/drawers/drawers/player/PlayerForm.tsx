import React from "react";
import { Input } from "@/ui/Input";
import { theme } from "@/theme/theme";
import { IconCamera } from "@/icons";

export type PlayerFormState = {
  playerName: string;
  userId: string;
  characterName: string;
  ancestry: string;
  paths: string;
  lvl: string;
  movement: string;
  defensePhysical: string;
  defenseCognitive: string;
  defenseSpiritual: string;
  deflect: string;
  hpMax: string;
  hpCur: string;
  focusMax: string;
  focusCur: string;
  investitureMax: string;
  investitureCur: string;
  injuryCount: string;
};

export type PlayerFormHandlers = {
  setPlayerName: (v: string) => void;
  setUserId: (v: string) => void;
  setCharacterName: (v: string) => void;
  setAncestry: (v: string) => void;
  setPaths: (v: string) => void;
  setLvl: (v: string) => void;
  setMovement: (v: string) => void;
  setDefensePhysical: (v: string) => void;
  setDefenseCognitive: (v: string) => void;
  setDefenseSpiritual: (v: string) => void;
  setDeflect: (v: string) => void;
  setHpMax: (v: string) => void;
  setHpCur: (v: string) => void;
  setFocusMax: (v: string) => void;
  setFocusCur: (v: string) => void;
  setInvestitureMax: (v: string) => void;
  setInvestitureCur: (v: string) => void;
  setInjuryCount: (v: string) => void;
};

function digitsOnly(v: string) {
  return v.replace(/[^0-9]/g, "");
}

function ResourceRow(props: {
  label: string;
  maxValue: string;
  curValue: string;
  onMaxChange: (v: string) => void;
  onCurChange: (v: string) => void;
  mode: "create" | "edit";
}) {
  return (
    <div>
      <div style={{ color: theme.colors.muted, marginBottom: 6 }}>{props.label}</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted, marginBottom: 4 }}>Max</div>
          <Input
            value={props.maxValue}
            onChange={(e) => {
              const v = digitsOnly(e.target.value);
              props.onMaxChange(v);
              if (props.mode === "create") props.onCurChange(v);
            }}
            inputMode="numeric"
          />
        </div>
        {props.mode === "edit" && (
          <div>
            <div style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted, marginBottom: 4 }}>Current</div>
            <Input
              value={props.curValue}
              onChange={(e) => props.onCurChange(digitsOnly(e.target.value))}
              inputMode="numeric"
            />
          </div>
        )}
      </div>
    </div>
  );
}

export function PlayerForm(props: {
  mode: "create" | "edit";
  state: PlayerFormState;
  handlers: PlayerFormHandlers;
  imageUrl?: string | null;
  onImageClick?: () => void;
  onImageRemove?: () => void;
  campaignMembers?: { id: string; username: string; name: string }[];
}) {
  const s = props.state;
  const h = props.handlers;

  return (
    <div style={{ display: "grid", gap: 10 }}>

      {/* Photo */}
      <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
        <div
          onClick={props.onImageClick}
          title={props.imageUrl ? "Change photo" : "Add photo"}
          style={{
            width: 72, height: 72, borderRadius: 8, flexShrink: 0,
            background: props.imageUrl ? "transparent" : theme.colors.inputBg,
            border: `1px solid ${theme.colors.panelBorder}`,
            overflow: "hidden", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center",
          }}
        >
          {props.imageUrl
            ? <img src={props.imageUrl} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
            : <IconCamera size={22} style={{ opacity: 0.35 }} />}
        </div>
        <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <button
            type="button" onClick={props.onImageClick}
            style={{ background: "none", border: "none", cursor: "pointer", color: theme.colors.text, fontSize: "var(--fs-medium)", textAlign: "left", padding: 0 }}
          >
            {props.imageUrl ? "Change photo" : "Add photo"}
          </button>
          {props.imageUrl && (
            <button
              type="button" onClick={props.onImageRemove}
              style={{ background: "none", border: "none", cursor: "pointer", color: theme.colors.muted, fontSize: "var(--fs-medium)", textAlign: "left", padding: 0 }}
            >
              Remove
            </button>
          )}
        </div>
      </div>

      {/* Identity */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Player name</div>
          <Input 
            value={props.state.playerName} 
            onChange={() => {}} 
            readOnly
            style={{ opacity: 0.6, cursor: "default" }}
          />
        </div>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Character name</div>
          <Input value={s.characterName} onChange={(e) => h.setCharacterName(e.target.value)} />
        </div>
      </div>

      <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Linked User Account</div>
        <select
          value={props.state.userId}
          onChange={(e) => {
            props.handlers.setUserId(e.target.value)}}
          style={{
            width: "100%",
            background: theme.colors.inputBg,
            color: theme.colors.text,
            border: `1px solid ${theme.colors.panelBorder}`,
            borderRadius: 6,
            padding: "6px 8px",
            fontSize: "var(--fs-body)",
          }}
        >
          <option value="">— No user linked —</option>
          {(props.campaignMembers ?? []).map((u) => (
            <option key={u.id} value={u.id}>
              {u.name || u.username} (@{u.username})
            </option>
          ))}
        </select>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Ancestry</div>
          <Input value={s.ancestry} onChange={(e) => h.setAncestry(e.target.value)} />
        </div>
        <div>
          <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Level</div>
          <Input value={s.lvl} onChange={(e) => h.setLvl(digitsOnly(e.target.value))} inputMode="numeric" />
        </div>
      </div>

      <div>
        <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Paths <span style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted }}>(comma-separated)</span></div>
        <Input value={s.paths} onChange={(e) => h.setPaths(e.target.value)} placeholder="e.g. Windrunner, Scholar" />
      </div>

      {/* Movement */}
      <div>
        <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Movement</div>
        <Input value={s.movement} onChange={(e) => h.setMovement(digitsOnly(e.target.value))} inputMode="numeric" />
      </div>

      {/* Defenses */}
      <div>
        <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Defenses</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div>
            <div style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted, marginBottom: 4 }}>Physical</div>
            <Input value={s.defensePhysical} onChange={(e) => h.setDefensePhysical(digitsOnly(e.target.value))} inputMode="numeric" />
          </div>
          <div>
            <div style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted, marginBottom: 4 }}>Cognitive</div>
            <Input value={s.defenseCognitive} onChange={(e) => h.setDefenseCognitive(digitsOnly(e.target.value))} inputMode="numeric" />
          </div>
          <div>
            <div style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted, marginBottom: 4 }}>Spiritual</div>
            <Input value={s.defenseSpiritual} onChange={(e) => h.setDefenseSpiritual(digitsOnly(e.target.value))} inputMode="numeric" />
          </div>
          <div>
            <div style={{ fontSize: "var(--fs-medium)", color: theme.colors.muted, marginBottom: 4 }}>Deflect</div>
            <Input value={s.deflect} onChange={(e) => h.setDeflect(digitsOnly(e.target.value))} inputMode="numeric" />
          </div>
        </div>
      </div>

      {/* Resources */}
      <ResourceRow
        label="HP"
        maxValue={s.hpMax}
        curValue={s.hpCur}
        onMaxChange={h.setHpMax}
        onCurChange={h.setHpCur}
        mode={props.mode}
      />
      <ResourceRow
        label="Focus"
        maxValue={s.focusMax}
        curValue={s.focusCur}
        onMaxChange={h.setFocusMax}
        onCurChange={h.setFocusCur}
        mode={props.mode}
      />
      <ResourceRow
        label="Investiture"
        maxValue={s.investitureMax}
        curValue={s.investitureCur}
        onMaxChange={h.setInvestitureMax}
        onCurChange={h.setInvestitureCur}
        mode={props.mode}
      />

      {/* Injury tracking */}
      <div>
        <div style={{ color: theme.colors.muted, marginBottom: 6 }}>Active injuries</div>
        <Input value={s.injuryCount} onChange={(e) => h.setInjuryCount(digitsOnly(e.target.value))} inputMode="numeric" />
      </div>

    </div>
  );
}