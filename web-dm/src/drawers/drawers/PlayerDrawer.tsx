import React from "react";
import { Button } from "@/ui/Button";
import { api, jsonInit } from "@/services/api";
import { useStore, type DrawerState } from "@/store";
import type { DrawerContent } from "@/drawers/types";
import { PlayerForm, type PlayerFormHandlers, type PlayerFormState } from "@/drawers/drawers/player/PlayerForm";
import { useConfirm } from "@/confirm/ConfirmContext";

type PlayerDrawerState = Exclude<Extract<DrawerState, { type: "createPlayer"; campaignId: string } | { type: "editPlayer"; playerId: string }>, null>;

const DEFAULT_PLAYER_FORM: PlayerFormState = {
  playerName: "", userId: "", characterName: "", ancestry: "", paths: "",
  lvl: "1", movement: "0",
  defensePhysical: "0", defenseCognitive: "0", defenseSpiritual: "0", deflect: "0",
  hpMax: "10", hpCur: "10",
  focusMax: "0", focusCur: "0",
  investitureMax: "0", investitureCur: "0",
  injuryCount: "0",
};

export function PlayerDrawer(props: {
  drawer: PlayerDrawerState;
  close: () => void;
  refreshCampaign: (cid: string) => Promise<void>;
}): DrawerContent {
  const { state } = useStore();
  const confirm = useConfirm();

  const [form, setForm] = React.useState<PlayerFormState>(DEFAULT_PLAYER_FORM);
  const [campaignMembers, setCampaignMembers] = React.useState<{ id: string; username: string; name: string }[]>([]);

  React.useEffect(() => {
    const { drawer } = props;
    let campaignId: string | undefined;
    if (drawer.type === "createPlayer") {
      campaignId = drawer.campaignId;
    } else if (drawer.type === "editPlayer") {
      campaignId = state.players.find((p) => p.id === drawer.playerId)?.campaignId;
    }
    if (!campaignId) return;
    api<{ id: string; username: string; name: string }[]>(
      `/api/campaigns/${campaignId}/members`
    ).then(setCampaignMembers).catch(() => {});
  }, [props.drawer, state.players]);

  const [pendingImage, setPendingImage] = React.useState<{ file: File; previewUrl: string } | null>(null);
  const imageInputRef = React.useRef<HTMLInputElement>(null);

  React.useEffect(() => {
    setPendingImage((prev) => {
      if (prev) URL.revokeObjectURL(prev.previewUrl);
      return null;
    });

    const d = props.drawer;
    setForm(DEFAULT_PLAYER_FORM);

    if (d.type !== "editPlayer") return;
    const p = state.players.find((x) => x.id === d.playerId);
    
    if (!p) return;
    setForm({
      playerName: p.playerName ?? "",
      userId: p.userId ?? "",
      characterName: p.characterName ?? "",
      ancestry: p.ancestry ?? "",
      paths: (p.paths ?? []).join(", "),
      lvl: String(p.level),
      movement: String(p.movement ?? 0),
      defensePhysical: String(p.defensePhysical ?? 0),
      defenseCognitive: String(p.defenseCognitive ?? 0),
      defenseSpiritual: String(p.defenseSpiritual ?? 0),
      deflect: String(p.deflect ?? 0),
      hpMax: String(p.hpMax),
      hpCur: String(p.hpCurrent),
      focusMax: String(p.focusMax ?? 0),
      focusCur: String(p.focusCurrent ?? 0),
      investitureMax: String(p.investitureMax ?? 0),
      investitureCur: String(p.investitureCurrent ?? 0),
      injuryCount: String(p.injuryCount ?? 0),
    });
  }, [props.drawer, state.players]);
  
  const { drawer } = props;
  const editPlayer = drawer.type === "editPlayer"
    ? state.players.find((p) => p.id === drawer.playerId)
    : null;
  const displayImageUrl = pendingImage?.previewUrl ?? editPlayer?.imageUrl ?? null;

  async function handleImageSelected(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (!file) return;
    if (props.drawer.type === "editPlayer") {
      const fd = new FormData();
      fd.append("image", file);
      await api<unknown>(`/api/players/${props.drawer.playerId}/image`, { method: "POST", body: fd });
      await props.refreshCampaign(state.selectedCampaignId);
    } else {
      setPendingImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return { file, previewUrl: URL.createObjectURL(file) };
      });
    }
  }

  async function handleImageRemove() {
    if (props.drawer.type === "editPlayer") {
      await api<unknown>(`/api/players/${props.drawer.playerId}/image`, { method: "DELETE" });
      await props.refreshCampaign(state.selectedCampaignId);
    } else {
      setPendingImage((prev) => {
        if (prev) URL.revokeObjectURL(prev.previewUrl);
        return null;
      });
    }
  }

  const submit = React.useCallback(async () => {
    const d = props.drawer;

    // Convert paths string to array — split on commas, trim whitespace, remove empty
    const pathsArray = form.paths
      .split(",")
      .map((p) => p.trim())
      .filter(Boolean);

    const payload = {
      playerName: form.playerName.trim() || "Player",
      userId: form.userId || null,
      characterName: form.characterName.trim() || "Character",
      ancestry: form.ancestry.trim() || "Unknown",
      paths: pathsArray,
      level: Number(form.lvl) || 1,
      movement: Number(form.movement) || 0,
      defensePhysical: Number(form.defensePhysical) || 0,
      defenseCognitive: Number(form.defenseCognitive) || 0,
      defenseSpiritual: Number(form.defenseSpiritual) || 0,
      deflect: Number(form.deflect) || 0,
      hpMax: Number(form.hpMax) || 1,
      hpCurrent: Number(form.hpCur) || 0,
      focusMax: Number(form.focusMax) || 0,
      focusCurrent: Number(form.focusCur) || 0,
      investitureMax: Number(form.investitureMax) || null,
      investitureCurrent: Number(form.investitureCur) || null,
      injuryCount: Number(form.injuryCount) || 0,
    };

    if (d.type === "createPlayer") {
      const newPlayer = await api<{ id: string }>(
        `/api/campaigns/${d.campaignId}/players`,
        jsonInit("POST", { ...payload, hpCurrent: payload.hpMax })
      );
      if (pendingImage) {
        const fd = new FormData();
        fd.append("image", pendingImage.file);
        await api<unknown>(`/api/players/${newPlayer.id}/image`, { method: "POST", body: fd });
        URL.revokeObjectURL(pendingImage.previewUrl);
      }
      await props.refreshCampaign(d.campaignId);
      props.close();
      return;
    }

    await api(
      `/api/players/${d.playerId}`,
      jsonInit("PUT", payload)
    );
    await props.refreshCampaign(state.selectedCampaignId);
    props.close();
  }, [form, pendingImage, props, state.selectedCampaignId]);

  const deletePlayer = React.useCallback(async () => {
    const d = props.drawer;
    if (d.type !== "editPlayer") return;
    if (
      !(await confirm({
        title: "Delete player",
        message: "Delete this player? This cannot be undone.",
        intent: "danger"
      }))
    )
      return;
    await api(`/api/players/${d.playerId}`, { method: "DELETE" });
    await props.refreshCampaign(state.selectedCampaignId);
    props.close();
  }, [confirm, props, state.selectedCampaignId]);

  const handlers: PlayerFormHandlers = React.useMemo(
    () => ({
      setPlayerName: (v) => setForm((s) => ({ ...s, playerName: v })),
      setUserId: (v) => setForm((s) => ({ ...s, userId: v })),
      setCharacterName: (v) => setForm((s) => ({ ...s, characterName: v })),
      setAncestry: (v) => setForm((s) => ({ ...s, ancestry: v })),
      setPaths: (v) => setForm((s) => ({ ...s, paths: v })),
      setLvl: (v) => setForm((s) => ({ ...s, lvl: v })),
      setMovement: (v) => setForm((s) => ({ ...s, movement: v })),
      setDefensePhysical: (v) => setForm((s) => ({ ...s, defensePhysical: v })),
      setDefenseCognitive: (v) => setForm((s) => ({ ...s, defenseCognitive: v })),
      setDefenseSpiritual: (v) => setForm((s) => ({ ...s, defenseSpiritual: v })),
      setDeflect: (v) => setForm((s) => ({ ...s, deflect: v })),
      setHpMax: (v) => setForm((s) => ({ ...s, hpMax: v })),
      setHpCur: (v) => setForm((s) => ({ ...s, hpCur: v })),
      setFocusMax: (v) => setForm((s) => ({ ...s, focusMax: v })),
      setFocusCur: (v) => setForm((s) => ({ ...s, focusCur: v })),
      setInvestitureMax: (v) => setForm((s) => ({ ...s, investitureMax: v })),
      setInvestitureCur: (v) => setForm((s) => ({ ...s, investitureCur: v })),
      setInjuryCount: (v) => setForm((s) => ({ ...s, injuryCount: v })),
    }),
    []
  );

  return {
    body: (
      <>
        <input
          ref={imageInputRef}
          type="file"
          accept="image/png,image/jpeg,image/gif,image/webp"
          style={{ display: "none" }}
          onChange={handleImageSelected}
        />
        <PlayerForm
          mode={props.drawer.type === "createPlayer" ? "create" : "edit"}
          state={form}
          handlers={handlers}
          imageUrl={displayImageUrl}
          onImageClick={() => imageInputRef.current?.click()}
          onImageRemove={handleImageRemove}
          campaignMembers={campaignMembers}
        />
      </>
    ),
    footer: (
      <div style={{ display: "flex", gap: 10, justifyContent: "space-between", alignItems: "center" }}>
        <div>
          {props.drawer.type === "editPlayer" ? (
            <Button variant="danger" onClick={deletePlayer}>
              Delete
            </Button>
          ) : null}
        </div>
        <div style={{ display: "flex", gap: 10, justifyContent: "flex-end" }}>
          <Button variant="ghost" onClick={props.close}>
            Cancel
          </Button>
          <Button onClick={submit}>Save</Button>
        </div>
      </div>
    )
  };
}