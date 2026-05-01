import React from "react";
import { Button } from "@/ui/Button";
import { Input } from "@/ui/Input";
import { Select } from "@/ui/Select";
import { api, jsonInit } from "@/services/api";
import { theme } from "@/theme/theme";
import { useStore, type DrawerState } from "@/store";
import { useConfirm } from "@/confirm/ConfirmContext";
import type { DrawerContent } from "@/drawers/types";

type INpcDrawerState = Exclude<Extract<DrawerState, { type: "editINpc"; inpcId: string }>, null>;

export function INpcDrawer(props: {
  drawer: INpcDrawerState;
  close: () => void;
  refreshCampaign: (cid: string) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const confirm = useConfirm();
  const inpc = React.useMemo(
    () => state.inpcs.find((i) => i.id === props.drawer.inpcId) ?? null,
    [state.inpcs, props.drawer.inpcId]
  );

  const [name, setName] = React.useState("");
  const [friendly, setFriendly] = React.useState<"true" | "false">("true");
  const [hpMax, setHpMax] = React.useState("10");
  const [hpCurrent, setHpCurrent] = React.useState("10");
  const [defensePhysical, setDefensePhysical] = React.useState("0");
  const [defenseCognitive, setDefenseCognitive] = React.useState("0");
  const [defenseSpiritual, setDefenseSpiritual] = React.useState("0");
  const [deflect, setDeflect] = React.useState("0");
  const [movement, setMovement] = React.useState("0");
  const [focusMax, setFocusMax] = React.useState("0");
  const [focusCurrent, setFocusCurrent] = React.useState("0");
  const [investitureMax, setInvestitureMax] = React.useState("0");
  const [investitureCurrent, setInvestitureCurrent] = React.useState("0");

  React.useEffect(() => {
    if (!inpc) return;
    setName(inpc.name ?? "");
    setFriendly(inpc.friendly ? "true" : "false");
    setHpMax(String(inpc.hpMax ?? 10));
    setHpCurrent(String(inpc.hpCurrent ?? inpc.hpMax ?? 10));
    setDefensePhysical(String(inpc.defensePhysical ?? 0));
    setDefenseCognitive(String(inpc.defenseCognitive ?? 0));
    setDefenseSpiritual(String(inpc.defenseSpiritual ?? 0));
    setDeflect(String(inpc.deflect ?? 0));
    setMovement(String(inpc.movement ?? 0));
    setFocusMax(String(inpc.focusMax ?? 0));
    setFocusCurrent(String(inpc.focusCurrent ?? 0));
    setInvestitureMax(String(inpc.investitureMax ?? 0));
    setInvestitureCurrent(String(inpc.investitureCurrent ?? 0));
  }, [inpc]);

  const submit = React.useCallback(async () => {
    if (!inpc) return;
    await api(
      `/api/inpcs/${inpc.id}`,
      jsonInit("PUT", {
        name: name.trim() || inpc.name,
        friendly: friendly === "true",
        hpMax: Number(hpMax) || 1,
        hpCurrent: Math.max(0, Number(hpCurrent) || 0),
        defensePhysical: Number(defensePhysical) || 0,
        defenseCognitive: Number(defenseCognitive) || 0,
        defenseSpiritual: Number(defenseSpiritual) || 0,
        deflect: Number(deflect) || 0,
        movement: Number(movement) || 0,
        focusMax: Number(focusMax) || 0,
        focusCurrent: Math.max(0, Number(focusCurrent) || 0),
        investitureMax: Number(investitureMax) || null,
        investitureCurrent: Number(investitureMax) > 0 ? Math.max(0, Number(investitureCurrent) || 0) : null,
      })
    );
    await props.refreshCampaign(state.selectedCampaignId);
    props.close();
  }, [inpc, name, friendly, hpMax, hpCurrent, defensePhysical, defenseCognitive,
      defenseSpiritual, deflect, movement, focusMax, focusCurrent, investitureMax, investitureCurrent,
      props, state.selectedCampaignId]);

  const deleteINpc = React.useCallback(async () => {
    if (!inpc) return;
    if (!(await confirm({
      title: "Delete iNPC",
      message: "Delete this iNPC? This cannot be undone.",
      intent: "danger"
    }))) return;
    await api(`/api/inpcs/${inpc.id}`, { method: "DELETE" });
    await props.refreshCampaign(state.selectedCampaignId);
    props.close();
  }, [confirm, inpc, props, state.selectedCampaignId]);

  return {
    body: !inpc ? (
      <div style={{ color: "var(--muted)" }}>iNPC not found.</div>
    ) : (
      <div style={{ display: "grid", gap: 10 }}>

        {/* Identity */}
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>Name</div>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="iNPC name" />
        </div>

        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>Friendly</div>
          <Select value={friendly} onChange={(e) => setFriendly(e.target.value as any)}>
            <option value="true">Friendly</option>
            <option value="false">Hostile</option>
          </Select>
        </div>

        {/* HP */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 800 }}>HP Max</div>
            <Input value={hpMax} onChange={(e) => setHpMax(e.target.value)} inputMode="numeric" />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ fontWeight: 800 }}>HP Current</div>
            <Input value={hpCurrent} onChange={(e) => setHpCurrent(e.target.value)} inputMode="numeric" />
          </div>
        </div>

        {/* Defenses */}
        <div style={{ color: theme.colors.muted, marginBottom: 2, fontWeight: 800 }}>Defenses</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: theme.colors.muted }}>Physical</div>
            <Input value={defensePhysical} onChange={(e) => setDefensePhysical(e.target.value)} inputMode="numeric" />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: theme.colors.muted }}>Cognitive</div>
            <Input value={defenseCognitive} onChange={(e) => setDefenseCognitive(e.target.value)} inputMode="numeric" />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: theme.colors.muted }}>Spiritual</div>
            <Input value={defenseSpiritual} onChange={(e) => setDefenseSpiritual(e.target.value)} inputMode="numeric" />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: theme.colors.muted }}>Deflect</div>
            <Input value={deflect} onChange={(e) => setDeflect(e.target.value)} inputMode="numeric" />
          </div>
        </div>

        {/* Movement */}
        <div style={{ display: "grid", gap: 6 }}>
          <div style={{ fontWeight: 800 }}>Movement</div>
          <Input value={movement} onChange={(e) => setMovement(e.target.value)} inputMode="numeric" />
        </div>

        {/* Resources */}
        <div style={{ color: theme.colors.muted, marginBottom: 2, fontWeight: 800 }}>Resources</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: theme.colors.muted }}>Focus Max</div>
            <Input value={focusMax} onChange={(e) => setFocusMax(e.target.value)} inputMode="numeric" />
          </div>
          <div style={{ display: "grid", gap: 6 }}>
            <div style={{ color: theme.colors.muted }}>Focus Current</div>
            <Input value={focusCurrent} onChange={(e) => setFocusCurrent(e.target.value)} inputMode="numeric" />
          </div>
          {Number(investitureMax) > 0 && (
            <>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ color: theme.colors.muted }}>Investiture Max</div>
                <Input value={investitureMax} onChange={(e) => setInvestitureMax(e.target.value)} inputMode="numeric" placeholder="0" />
              </div>
              <div style={{ display: "grid", gap: 6 }}>
                <div style={{ color: theme.colors.muted }}>Investiture Current</div>
                <Input value={investitureCurrent} onChange={(e) => setInvestitureCurrent(e.target.value)} inputMode="numeric" placeholder="0" />
              </div>
            </>
          )}
          {Number(investitureMax) === 0 && (
            <div style={{ display: "grid", gap: 6 }}>
              <div style={{ color: theme.colors.muted }}>Investiture Max</div>
              <Input value={investitureMax} onChange={(e) => setInvestitureMax(e.target.value)} inputMode="numeric" placeholder="0" />
            </div>
          )}
        </div>

      </div>
    ),
    footer: (
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <Button variant="danger" onClick={deleteINpc} disabled={!inpc}>
            Delete
          </Button>
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={props.close}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={!inpc}>
            Save
          </Button>
        </div>
      </div>
    )
  };
}