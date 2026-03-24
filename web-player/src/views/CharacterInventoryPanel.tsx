import React, { useEffect, useRef, useState } from "react";
import { api } from "@/services/api";
import { C, withAlpha } from "@/lib/theme";
import { titleCase } from "@/lib/format/titleCase";
import { Select } from "@/ui/Select";
import { useVirtualList } from "@/lib/monsterPicker/useVirtualList";
import { useItemSearch } from "@/views/CompendiumView/hooks/useItemSearch";
import {
  Panel,
  PanelTitle,
  addBtnStyle,
  cancelBtnStyle,
  inventoryCheckboxLabel,
  inventoryEquipBtn,
  inventoryPickerColumnStyle,
  inventoryPickerDetailStyle,
  inventoryPickerListStyle,
  inventoryRarityColor,
  panelHeaderAddBtn,
  toggleFilterPill,
} from "@/views/CharacterViewParts";
import {
  type CharacterDataLike,
  type CompendiumItemDetail,
  type InventoryContainer,
  type InventoryItem,
  type InventoryPickerPayload,
  type ItemSummaryRow,
  canEquipOffhand,
  canUseTwoHands,
  formatItemDamageType,
  formatItemProperties,
  formatWeight,
  getEquipState,
  hasArmorProficiency,
  hasStealthDisadvantage,
  isArmorItem,
  isCurrencyItem,
  isRangedWeapon,
  isShieldItem,
  isWeaponItem,
  normalizeInventoryItemLookupName,
  parseChargesMax,
  parseItemSpells,
  totalInventoryWeight,
} from "@/views/CharacterInventory";

interface InventoryPanelCharacter {
  strScore: number | null;
}

interface InventoryPanelCharacterData extends CharacterDataLike {
  inventory?: InventoryItem[];
  inventoryContainers?: InventoryContainer[];
  proficiencies?: unknown;
}

type PersistPayload = {
  inventory: InventoryItem[];
  inventoryContainers: InventoryContainer[];
};

const INVENTORY_PICKER_ROW_HEIGHT = 52;
const DEFAULT_CONTAINER_ID = "backpack-default";

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function singularizeInventoryLookupName(name: string): string {
  const trimmed = String(name ?? "").trim();
  const lowered = trimmed.toLowerCase();
  if (lowered === "daggers") return "Dagger";
  if (/ies$/i.test(trimmed)) return `${trimmed.slice(0, -3)}y`;
  if (/es$/i.test(trimmed) && /(ches|shes|sses|xes|zes)$/i.test(trimmed)) return trimmed.slice(0, -2);
  if (/s$/i.test(trimmed) && !/ss$/i.test(trimmed)) return trimmed.slice(0, -1);
  return trimmed;
}

function matchInventorySummary(item: InventoryItem, itemIndex: ItemSummaryRow[]): ItemSummaryRow | null {
  if (item.itemId) return itemIndex.find((row) => row.id === item.itemId) ?? null;
  const normalized = normalizeInventoryItemLookupName(item.name);
  const singularNormalized = normalizeInventoryItemLookupName(singularizeInventoryLookupName(item.name));
  return itemIndex.find((row) => normalizeInventoryItemLookupName(row.name) === normalized)
    ?? itemIndex.find((row) => normalizeInventoryItemLookupName(row.name) === singularNormalized)
    ?? null;
}

function defaultContainer(): InventoryContainer {
  return { id: DEFAULT_CONTAINER_ID, name: "Backpack", ignoreWeight: false };
}

function normalizeContainers(containers: InventoryContainer[] | null | undefined): InventoryContainer[] {
  const list = Array.isArray(containers) ? containers.filter(Boolean) : [];
  const hasDefault = list.some((container) => container.id === DEFAULT_CONTAINER_ID);
  const next = hasDefault ? list : [defaultContainer(), ...list];
  return next.map((container) => ({
    id: container.id,
    name: String(container.name ?? "").trim() || (container.id === DEFAULT_CONTAINER_ID ? "Backpack" : "Container"),
    ignoreWeight: Boolean(container.ignoreWeight),
  }));
}

export function InventoryPanel({ char, charData, accentColor, onSave }: {
  char: InventoryPanelCharacter;
  charData: InventoryPanelCharacterData | null;
  accentColor: string;
  onSave: (data: PersistPayload) => Promise<unknown>;
}) {
  const [items, setItems] = useState<InventoryItem[]>(() =>
    ((charData?.inventory ?? []) as InventoryItem[]).map((item) => ({
      ...item,
      equipState: getEquipState(item),
      properties: item.properties ?? [],
    }))
  );
  const [containers, setContainers] = useState<InventoryContainer[]>(() => normalizeContainers(charData?.inventoryContainers));
  const [pickerOpen, setPickerOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newQty, setNewQty] = useState(1);
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [itemIndex, setItemIndex] = useState<ItemSummaryRow[]>([]);
  const [expandedItemId, setExpandedItemId] = useState<string | null>(null);
  const [expandedDetail, setExpandedDetail] = useState<CompendiumItemDetail | null>(null);
  const [expandedBusy, setExpandedBusy] = useState(false);
  const [itemEditMode, setItemEditMode] = useState(false);
  const [currencyPopupCode, setCurrencyPopupCode] = useState<"PP" | "GP" | "SP" | "CP" | null>(null);
  const [currencyInput, setCurrencyInput] = useState("");
  const nameRef = useRef<HTMLInputElement>(null);
  const currencyPopupRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    setContainers(normalizeContainers(charData?.inventoryContainers));
  }, [charData?.inventoryContainers]);

  useEffect(() => {
    let alive = true;
    api<ItemSummaryRow[]>("/api/compendium/items")
      .then((rows) => { if (alive) setItemIndex(rows ?? []); })
      .catch(() => { if (alive) setItemIndex([]); });
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    if (!currencyPopupCode) return;
    function handlePointerDown(event: MouseEvent) {
      if (!currencyPopupRef.current) return;
      const target = event.target;
      if (target instanceof Node && !currencyPopupRef.current.contains(target)) {
        setCurrencyPopupCode(null);
      }
    }
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [currencyPopupCode]);

  useEffect(() => {
    if (itemIndex.length === 0) return;
    setItems((prev) => {
      let changed = false;
      const next = prev.map((item) => {
        const summary = matchInventorySummary(item, itemIndex);
        if (!summary) return item;
        const canonicalName = summary.name.replace(/\s+\[(?:2024|5\.5e|5e)\]\s*$/i, "").trim();
        const patched: InventoryItem = {
          ...item,
          name: item.source === "custom" && !item.itemId ? item.name : canonicalName,
          source: item.source === "custom" && !item.itemId ? item.source : "compendium",
          itemId: item.itemId ?? summary.id,
          type: item.type ?? summary.type,
          rarity: item.rarity ?? summary.rarity,
          magic: item.magic ?? summary.magic,
          attunement: item.attunement ?? summary.attunement,
          weight: item.weight ?? summary.weight ?? null,
          value: item.value ?? summary.value ?? null,
          ac: item.ac ?? summary.ac ?? null,
          stealthDisadvantage: item.stealthDisadvantage ?? summary.stealthDisadvantage ?? false,
          dmg1: item.dmg1 ?? summary.dmg1 ?? null,
          dmg2: item.dmg2 ?? summary.dmg2 ?? null,
          dmgType: item.dmgType ?? summary.dmgType ?? null,
          properties: item.properties?.length ? item.properties : (summary.properties ?? []),
        };
        if (
          patched.name !== item.name
          || patched.source !== item.source
          || patched.itemId !== item.itemId
          || patched.type !== item.type
          || patched.rarity !== item.rarity
          || patched.magic !== item.magic
          || patched.attunement !== item.attunement
          || patched.weight !== item.weight
          || patched.value !== item.value
          || patched.ac !== item.ac
          || patched.stealthDisadvantage !== item.stealthDisadvantage
          || patched.dmg1 !== item.dmg1
          || patched.dmg2 !== item.dmg2
          || patched.dmgType !== item.dmgType
          || JSON.stringify(patched.properties ?? []) !== JSON.stringify(item.properties ?? [])
        ) {
          changed = true;
          return patched;
        }
        return item;
      });
      return changed ? next : prev;
    });
  }, [itemIndex]);

  useEffect(() => {
    if (!expandedItemId) {
      setExpandedDetail(null);
      setExpandedBusy(false);
      setItemEditMode(false);
      return;
    }
    const inventoryItem = items.find((it) => it.id === expandedItemId);
    if (!inventoryItem) {
      setExpandedDetail(null);
      setExpandedBusy(false);
      return;
    }
    const normalizedName = normalizeInventoryItemLookupName(inventoryItem.name);
    const singularNormalizedName = normalizeInventoryItemLookupName(singularizeInventoryLookupName(inventoryItem.name));
    const matchedSummary = inventoryItem.itemId
      ? itemIndex.find((row) => row.id === inventoryItem.itemId) ?? null
      : itemIndex.find((row) => normalizeInventoryItemLookupName(row.name) === normalizedName)
        ?? itemIndex.find((row) => normalizeInventoryItemLookupName(row.name) === singularNormalizedName)
        ?? null;

    if (!matchedSummary) {
      setExpandedDetail(null);
      setExpandedBusy(false);
      return;
    }

    let alive = true;
    setExpandedBusy(true);
    api<CompendiumItemDetail>(`/api/compendium/items/${matchedSummary.id}`)
      .then((detail) => { if (alive) setExpandedDetail(detail); })
      .catch(() => { if (alive) setExpandedDetail(null); })
      .finally(() => { if (alive) setExpandedBusy(false); });
    return () => { alive = false; };
  }, [expandedItemId, itemIndex, items]);

  async function persist(updatedItems: InventoryItem[], updatedContainers: InventoryContainer[] = containers) {
    setSaving(true);
    try {
      const normalized = normalizeContainers(updatedContainers);
      await onSave({ inventory: updatedItems, inventoryContainers: normalized });
      setItems(updatedItems);
      setContainers(normalized);
    } finally {
      setSaving(false);
    }
  }

  function createContainer(baseName = "Backpack", ignoreWeight = false): InventoryContainer {
    return {
      id: uid(),
      name: baseName,
      ignoreWeight,
    };
  }

  async function addItem(payload?: InventoryPickerPayload) {
    const next = payload;
    if (!next?.name) return;
    const item: InventoryItem = {
      id: uid(),
      name: next.name,
      quantity: Math.max(1, next.quantity),
      equipped: false,
      equipState: "backpack",
      source: next.source,
      itemId: next.itemId,
      rarity: next.rarity ?? null,
      type: next.type ?? null,
      attunement: next.attunement ?? false,
      attuned: next.attuned ?? false,
      magic: next.magic ?? false,
      silvered: next.silvered ?? false,
      weight: next.weight ?? null,
      value: next.value ?? null,
      ac: next.ac ?? null,
      stealthDisadvantage: next.stealthDisadvantage ?? false,
      dmg1: next.dmg1 ?? null,
      dmg2: next.dmg2 ?? null,
      dmgType: next.dmgType ?? null,
      properties: next.properties ?? [],
      description: next.description?.trim() || undefined,
      chargesMax: (() => {
        const desc = next.description?.trim() ?? "";
        return desc ? (parseChargesMax(desc) ?? null) : null;
      })(),
      charges: (() => {
        const desc = next.description?.trim() ?? "";
        return desc ? (parseChargesMax(desc) ?? null) : null;
      })(),
    };
    let nextContainers = containers;
    if (/^bag of holding\b/i.test(next.name)) {
      const bagContainer = createContainer("Bag of Holding", true);
      nextContainers = [...containers, bagContainer];
    }
    await persist([...items, item], nextContainers);
    setPickerOpen(false);
  }

  async function addContainer(afterId?: string | null, baseName = "Backpack", ignoreWeight = false) {
    const container = createContainer(baseName, ignoreWeight);
    const insertAt = afterId ? containers.findIndex((entry) => entry.id === afterId) : containers.length - 1;
    const nextContainers = [...containers];
    nextContainers.splice(insertAt + 1, 0, container);
    await persist(items, nextContainers);
  }

  async function renameContainer(id: string, name: string) {
    const nextContainers = containers.map((container) =>
      container.id === id
        ? { ...container, name: name.trim() || (id === DEFAULT_CONTAINER_ID ? "Backpack" : "Container") }
        : container
    );
    await persist(items, nextContainers);
  }

  async function toggleContainerIgnoreWeight(id: string) {
    const nextContainers = containers.map((container) =>
      container.id === id ? { ...container, ignoreWeight: !container.ignoreWeight } : container
    );
    await persist(items, nextContainers);
  }

  async function removeContainer(id: string) {
    if (id === DEFAULT_CONTAINER_ID) return;
    const nextItems = items.map((item) =>
      item.containerId === id ? { ...item, containerId: DEFAULT_CONTAINER_ID } : item
    );
    const nextContainers = containers.filter((container) => container.id !== id);
    await persist(nextItems, nextContainers);
  }

  async function moveItemToContainer(id: string, containerId: string | null) {
    const nextContainerId = containerId && containers.some((container) => container.id === containerId)
      ? containerId
      : DEFAULT_CONTAINER_ID;
    const nextItems = items.map((item) => item.id === id ? { ...item, containerId: nextContainerId } : item);
    await persist(nextItems);
  }

  async function setEquipStateFor(id: string, state: EquipState) {
    const updated = items.map((it) => {
      if (it.id === id) return { ...it, equipped: state !== "backpack", equipState: state };
      const currentState = getEquipState(it);
      if (state === "offhand" && currentState === "mainhand-2h") {
        return canUseTwoHands(it)
          ? { ...it, equipped: true, equipState: "mainhand-1h" as const }
          : { ...it, equipped: false, equipState: "backpack" as const };
      }
      if (state === "mainhand-2h" && currentState === "offhand") {
        return { ...it, equipped: false, equipState: "backpack" as const };
      }
      if (state.startsWith("mainhand") && currentState.startsWith("mainhand")) {
        return { ...it, equipped: false, equipState: "backpack" as const };
      }
      if (state === "offhand" && currentState === "offhand") {
        return { ...it, equipped: false, equipState: "backpack" as const };
      }
      if (state === "worn" && currentState === "worn") {
        return { ...it, equipped: false, equipState: "backpack" as const };
      }
      return { ...it, equipped: currentState !== "backpack", equipState: currentState };
    });
    await persist(updated);
  }

  async function cycleMainHand(id: string) {
    const item = items.find((it) => it.id === id);
    if (!item || !isWeaponItem(item)) return;
    const state = getEquipState(item);
    if (state === "backpack" || state === "offhand") {
      await setEquipStateFor(id, "mainhand-1h");
      return;
    }
    if (state === "mainhand-1h" && canUseTwoHands(item)) {
      await setEquipStateFor(id, "mainhand-2h");
      return;
    }
    await setEquipStateFor(id, "backpack");
  }

  async function toggleOffhand(id: string) {
    const item = items.find((it) => it.id === id);
    if (!item || !canEquipOffhand(item, charData)) return;
    const state = getEquipState(item);
    await setEquipStateFor(id, state === "offhand" ? "backpack" : "offhand");
  }

  async function toggleWorn(id: string) {
    const item = items.find((it) => it.id === id);
    if (!item) return;
    const state = getEquipState(item);
    await setEquipStateFor(id, state === "worn" ? "backpack" : "worn");
  }

  async function removeItem(id: string) {
    await persist(items.filter((it) => it.id !== id));
  }

  async function changeQty(id: string, delta: number) {
    const updated = items.map((it) => {
      if (it.id !== id) return it;
      const q = Math.max(1, it.quantity + delta);
      return { ...it, quantity: q };
    });
    await persist(updated);
  }

  function toggleExpandedItem(id: string) {
    setExpandedItemId((current) => current === id ? null : id);
    setItemEditMode(false);
  }

  async function saveItemEdits(id: string, patch: Partial<InventoryItem>) {
    const updated = items.map((it) => it.id === id ? { ...it, ...patch } : it);
    await persist(updated);
  }

  async function saveCurrencyAmount(code: "PP" | "GP" | "SP" | "CP", nextValue: number) {
    const value = Math.max(0, Math.floor(Number(nextValue) || 0));
    const existing = items.find((it) => String(it.name ?? "").trim().toUpperCase() === code);
    let updated: InventoryItem[];
    if (existing) {
      updated = value > 0
        ? items.map((it) => it.id === existing.id ? { ...it, quantity: value } : it)
        : items.filter((it) => it.id !== existing.id);
    } else if (value > 0) {
      updated = [
        ...items,
        {
          id: uid(),
          name: code,
          quantity: value,
          equipped: false,
          equipState: "backpack",
          source: "custom",
        },
      ];
    } else {
      updated = items;
    }
    await persist(updated);
  }

  const equipped = items.filter((it) => getEquipState(it) !== "backpack");
  const currencyTotals = items.reduce<Record<"PP" | "GP" | "EP" | "SP" | "CP", number>>((acc, item) => {
    const name = String(item.name ?? "").trim().toUpperCase();
    if (name === "PP" || name === "GP" || name === "EP" || name === "SP" || name === "CP") {
      acc[name] += Math.max(0, item.quantity || 0);
    }
    return acc;
  }, { PP: 0, GP: 0, EP: 0, SP: 0, CP: 0 });
  const containerBackpackItems = items.filter((it) => {
    if (getEquipState(it) !== "backpack") return false;
    if (isCurrencyItem(it)) return false;
    return true;
  });
  const itemsByContainer = new Map<string, InventoryItem[]>();
  for (const item of containerBackpackItems) {
    const containerId = item.containerId && containers.some((container) => container.id === item.containerId)
      ? item.containerId
      : DEFAULT_CONTAINER_ID;
    const list = itemsByContainer.get(containerId) ?? [];
    list.push(item.containerId === containerId ? item : { ...item, containerId });
    itemsByContainer.set(containerId, list);
  }
  const actionItems = equipped.filter((it) => isWeaponItem(it));
  const prof = charData?.proficiencies;
  const carriedWeight = totalInventoryWeight(items, containers);
  const strScore = Math.max(0, char.strScore ?? 0);
  const carryCapacity = strScore * 15;
  const overCapacity = carryCapacity > 0 && carriedWeight > carryCapacity;
  const selectedItem = expandedItemId ? items.find((it) => it.id === expandedItemId) ?? null : null;
  const otherAttunedCount = selectedItem
    ? items.filter((it) => it.id !== selectedItem.id && it.attuned).length
    : items.filter((it) => it.attuned).length;

  return (
    <Panel>
      <PanelTitle color={accentColor} actions={
        <button
          type="button"
          onClick={() => setPickerOpen(true)}
          title="Add item"
          style={panelHeaderAddBtn(accentColor)}
        >
          +
        </button>
      }>
        Inventory
        {saving && <span style={{ fontSize: 9, color: C.muted, marginLeft: 6, fontWeight: 400, textTransform: "none" }}>saving…</span>}
      </PanelTitle>

      <div style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        marginBottom: 10,
        padding: "0 2px",
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
          <div style={{ fontSize: 11, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em" }}>
            Currency
          </div>
          {(["PP", "GP", "SP", "CP"] as const).map((code) => (
            <div
              key={code}
              ref={currencyPopupCode === code ? currencyPopupRef : undefined}
              style={{ position: "relative" }}
            >
              <button
                type="button"
                onClick={() => {
                  setCurrencyInput(String(currencyTotals[code]));
                  setCurrencyPopupCode((current) => current === code ? null : code);
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                  fontSize: 11,
                  color: C.text,
                  padding: "2px 10px",
                  borderRadius: 999,
                  border: "1px solid rgba(255,255,255,0.08)",
                  background: "rgba(255,255,255,0.04)",
                  cursor: "pointer",
                }}
              >
                <span style={{ color: C.muted, fontWeight: 700 }}>{code}</span>
                <span style={{ fontWeight: 800, minWidth: 20, textAlign: "right" }}>{currencyTotals[code].toLocaleString()}</span>
              </button>
              {currencyPopupCode === code && (
                <div
                  style={{
                    position: "absolute",
                    top: "calc(100% + 6px)",
                    left: 0,
                    zIndex: 20,
                    background: "#1e2030",
                    border: "1px solid rgba(255,255,255,0.15)",
                    borderRadius: 10,
                    padding: "12px 14px",
                    minWidth: 210,
                    boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 2 }}>Edit {code}</div>
                  <div style={{ display: "flex", gap: 6 }}>
                    <input
                      autoFocus
                      type="number"
                      min={0}
                      value={currencyInput}
                      onChange={(e) => setCurrencyInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          void saveCurrencyAmount(code, Number(currencyInput));
                          setCurrencyPopupCode(null);
                        }
                        if (e.key === "Escape") setCurrencyPopupCode(null);
                      }}
                      style={{
                        flex: 1,
                        padding: "6px 8px",
                        borderRadius: 6,
                        fontSize: 13,
                        fontWeight: 700,
                        border: "1px solid rgba(255,255,255,0.15)",
                        background: "rgba(255,255,255,0.07)",
                        color: C.text,
                        outline: "none",
                        textAlign: "center",
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        void saveCurrencyAmount(code, Number(currencyInput));
                        setCurrencyPopupCode(null);
                      }}
                      style={addBtnStyle(accentColor)}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
        <div style={{ fontSize: 11, fontWeight: 700, color: overCapacity ? C.red : C.muted }}>
          {formatWeight(carriedWeight)} / {formatWeight(carryCapacity)} lb
        </div>
      </div>

      {equipped.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={subLabelStyle}>Equipped</div>
          {equipped.map((it) => (
            <ItemRow key={it.id} item={it} accentColor={accentColor}
              charData={charData}
              expanded={expandedItemId === it.id}
              onToggleExpanded={toggleExpandedItem}
              onCycleMain={cycleMainHand}
              onToggleOffhand={toggleOffhand}
              onToggleWorn={toggleWorn}
              onRemove={removeItem} onQty={changeQty} />
          ))}
        </div>
      )}

      {containers.map((container) => {
        const containerItems = itemsByContainer.get(container.id) ?? [];
        const isDefault = container.id === DEFAULT_CONTAINER_ID;
        return (
          <div key={container.id} style={{ marginBottom: 12 }}>
            <div style={{ ...subLabelStyle, display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", minWidth: 0 }}>
                <input
                  value={container.name}
                  onChange={(e) => {
                    setContainers((prev) => prev.map((entry) => entry.id === container.id ? { ...entry, name: e.target.value } : entry));
                  }}
                  onBlur={(e) => { void renameContainer(container.id, e.target.value); }}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.currentTarget.blur();
                    }
                    if (e.key === "Escape") {
                      setContainers(normalizeContainers(charData?.inventoryContainers ?? containers));
                    }
                  }}
                  style={{
                    background: "transparent",
                    border: "none",
                    borderBottom: "1px dashed rgba(255,255,255,0.12)",
                    color: C.muted,
                    fontSize: 10,
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.07em",
                    minWidth: 110,
                    outline: "none",
                    padding: "0 0 2px",
                  }}
                />
                <button
                  type="button"
                  onClick={() => { void toggleContainerIgnoreWeight(container.id); }}
                  style={toggleFilterPill(Boolean(container.ignoreWeight), accentColor)}
                >
                  Ignore Weight
                </button>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button
                  type="button"
                  onClick={() => { void addContainer(container.id); }}
                  title="Add container"
                  style={{ ...stepperBtn, width: 24, height: 24, fontSize: 16 }}
                >
                  +
                </button>
                {!isDefault && (
                  <button
                    type="button"
                    onClick={() => { void removeContainer(container.id); }}
                    title="Remove container"
                    style={{ ...stepperBtn, width: 24, height: 24, fontSize: 16 }}
                  >
                    −
                  </button>
                )}
              </div>
            </div>
            {containerItems.length > 0 ? containerItems.map((it) => (
              <ItemRow key={it.id} item={it} accentColor={accentColor}
                charData={charData}
                expanded={expandedItemId === it.id}
                onToggleExpanded={toggleExpandedItem}
                onCycleMain={cycleMainHand}
                onToggleOffhand={toggleOffhand}
                onToggleWorn={toggleWorn}
                onRemove={removeItem} onQty={changeQty} />
            )) : (
              <div style={{
                padding: "8px 10px",
                border: "1px dashed rgba(255,255,255,0.08)",
                borderRadius: 10,
                color: C.muted,
                fontSize: 11,
                background: "rgba(255,255,255,0.02)",
              }}>
                Empty.
              </div>
            )}
          </div>
        );
      })}

      {/* Inventory add controls */}
      {false ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginTop: items.length > 0 ? 10 : 0 }}>
          <div style={{ display: "flex", gap: 6 }}>
            <input
              ref={nameRef}
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") addItem(); if (e.key === "Escape") { setAdding(false); setNewName(""); } }}
              placeholder="Item name…"
              autoFocus
              style={inputStyle}
            />
            <input
              type="number"
              value={newQty}
              min={1}
              onChange={(e) => setNewQty(Number(e.target.value))}
              style={{ ...inputStyle, width: 56, textAlign: "center" }}
            />
          </div>
          <input
            value={newNotes}
            onChange={(e) => setNewNotes(e.target.value)}
            placeholder="Notes (optional)…"
            style={{ ...inputStyle, fontSize: 11, color: C.muted }}
          />
          <div style={{ display: "flex", gap: 6 }}>
            <button onClick={() => { void addItem(); }} disabled={!newName.trim()} style={addBtnStyle(accentColor)}>
              Add
            </button>
            <button onClick={() => { setAdding(false); setNewName(""); setNewQty(1); setNewNotes(""); }} style={cancelBtnStyle}>
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <InventoryItemPickerModal
        isOpen={pickerOpen}
        accentColor={accentColor}
        onClose={() => setPickerOpen(false)}
        onAdd={addItem}
      />
      {selectedItem ? (
        <InventoryItemDrawer
          item={selectedItem}
          containers={containers}
          detail={expandedDetail}
          busy={expandedBusy}
          accentColor={accentColor}
          otherAttunedCount={otherAttunedCount}
          editMode={itemEditMode}
          onStartEdit={() => setItemEditMode(true)}
          onCancelEdit={() => setItemEditMode(false)}
          onClose={() => setExpandedItemId(null)}
          onSave={async (patch) => {
            await saveItemEdits(selectedItem.id, patch);
            setItemEditMode(false);
          }}
          onMoveToContainer={async (containerId) => {
            await moveItemToContainer(selectedItem.id, containerId);
          }}
          onChargesChange={async (charges) => {
            await saveItemEdits(selectedItem.id, { charges });
          }}
        />
      ) : null}
    </Panel>
  );
}

function ItemRow({ item, accentColor, charData, expanded, onToggleExpanded, onCycleMain, onToggleOffhand, onToggleWorn, onRemove, onQty }: {
  item: InventoryItem;
  accentColor: string;
  charData: InventoryPanelCharacterData | null;
  expanded: boolean;
  onToggleExpanded: (id: string) => void;
  onCycleMain: (id: string) => void;
  onToggleOffhand: (id: string) => void;
  onToggleWorn: (id: string) => void;
  onRemove: (id: string) => void;
  onQty: (id: string, delta: number) => void;
}) {
  const state = getEquipState(item);
  const isWeapon = isWeaponItem(item);
  const isArmor = isArmorItem(item);
  const offhandAllowed = canEquipOffhand(item, charData);
  const mainActive = state === "mainhand-1h" || state === "mainhand-2h";
  const mainLabel = state === "mainhand-2h" ? "2H" : "1H";
  const equipped = state !== "backpack";
  const lacksArmorProficiency = equipped && (isArmor || isShieldItem(item)) && !hasArmorProficiency(item, charData?.proficiencies as any);
  const stateLabel =
    state === "mainhand-2h" ? "Main Hand (2H)"
      : state === "mainhand-1h" ? "Main Hand (1H)"
      : state === "offhand" ? "Offhand"
      : state === "worn" ? "Equipped"
      : null;
  const meta = [
    item.rarity ? titleCase(item.rarity) : null,
    item.type ?? null,
    item.attunement ? "Attunement" : null,
    item.magic ? "Magic" : null,
  ].filter(Boolean).join(" • ");

  return (
    <div style={{ borderBottom: "1px solid rgba(255,255,255,0.05)" }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 8,
        padding: "4px 2px",
      }}>
        {isWeapon ? (
          <button
            onClick={() => onCycleMain(item.id)}
            title="Cycle main hand"
            style={inventoryEquipBtn(mainActive, accentColor)}
          >
            {mainLabel}
          </button>
        ) : isArmor ? (
          <button
            onClick={() => onToggleWorn(item.id)}
            title={state === "worn" ? "Unequip armor" : "Equip armor"}
            style={inventoryEquipBtn(state === "worn", accentColor)}
          >
            EQ
          </button>
        ) : offhandAllowed ? (
          <button
            onClick={() => onToggleOffhand(item.id)}
            title={state === "offhand" ? "Unequip offhand" : "Equip to offhand"}
            style={inventoryEquipBtn(state === "offhand", "#94a3b8")}
          >
            OH
          </button>
        ) : (
          <div style={{ width: 30, flexShrink: 0 }} />
        )}

        {isWeapon && offhandAllowed ? (
          <button
            onClick={() => onToggleOffhand(item.id)}
            title={state === "offhand" ? "Unequip offhand" : "Equip to offhand"}
            style={inventoryEquipBtn(state === "offhand", "#94a3b8")}
          >
            OH
          </button>
        ) : null}

        <button
          type="button"
          onClick={() => onToggleExpanded(item.id)}
          style={{
            flex: 1,
            minWidth: 0,
            background: expanded ? "rgba(255,255,255,0.05)" : "transparent",
            border: expanded ? `1px solid ${accentColor}33` : "1px solid transparent",
            borderRadius: 8,
            padding: "6px 8px",
            textAlign: "left",
            cursor: "pointer",
          }}
        >
          <div style={{ fontSize: 13, color: C.text, fontWeight: equipped ? 600 : 400, display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
            {item.name}
            {item.attuned && (
              <span
                title="Currently attuned"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  border: "1px solid rgba(56,189,248,0.55)",
                  background: "rgba(56,189,248,0.14)",
                  color: "#38bdf8",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                A
              </span>
            )}
            {hasStealthDisadvantage(item) && (
              <span
                title="Disadvantage on Stealth checks"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  border: "1px solid rgba(248,113,113,0.55)",
                  background: "rgba(248,113,113,0.14)",
                  color: "#f87171",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: 1,
                }}
              >
                D
              </span>
            )}
            {lacksArmorProficiency && (
              <span
                title="You are not proficient with this armor or shield"
                style={{
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  minWidth: 18,
                  height: 18,
                  borderRadius: 999,
                  border: "1px solid rgba(248,113,113,0.55)",
                  background: "rgba(248,113,113,0.14)",
                  color: "#f87171",
                  fontSize: 11,
                  fontWeight: 800,
                  lineHeight: 1,
                  padding: "0 6px",
                }}
              >
                NP
              </span>
            )}
          </div>
          {meta && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{meta}</div>
          )}
          {stateLabel && (
            <div style={{ fontSize: 10, color: accentColor, marginTop: 2, fontWeight: 700 }}>
              {stateLabel}
            </div>
          )}
          {lacksArmorProficiency && (
            <div style={{ fontSize: 10, color: "#f87171", marginTop: 2, fontWeight: 700 }}>
              Not proficient: AC applies, but STR/DEX rolls have disadvantage and spellcasting is blocked.
            </div>
          )}
          {item.notes && (
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>{item.notes}</div>
          )}
        </button>

        <div style={{ display: "flex", alignItems: "center", gap: 4, flexShrink: 0 }}>
          {item.quantity > 1 && (
            <button onClick={() => onQty(item.id, -1)} style={stepperBtn}>−</button>
          )}
          {item.quantity > 1 && (
            <span style={{ fontSize: 12, color: C.muted, minWidth: 20, textAlign: "center" }}>
              ×{item.quantity}
            </span>
          )}
          <button onClick={() => onQty(item.id, +1)} style={stepperBtn}>+</button>
        </div>

        <button
          onClick={() => onRemove(item.id)}
          title="Remove"
          style={{
            background: "transparent", border: "none",
            color: "rgba(255,255,255,0.22)", cursor: "pointer",
            fontSize: 15, padding: "0 2px", lineHeight: 1, flexShrink: 0,
        }}>
          ×
        </button>
      </div>
    </div>
  );
}

function InventoryItemDrawer(props: {
  item: InventoryItem;
  containers: InventoryContainer[];
  detail: CompendiumItemDetail | null;
  busy: boolean;
  accentColor: string;
  otherAttunedCount: number;
  editMode: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onClose: () => void;
  onSave: (patch: Partial<InventoryItem>) => Promise<void>;
  onMoveToContainer: (containerId: string | null) => Promise<void>;
  onChargesChange: (charges: number) => void | Promise<void>;
}) {
  const merged = {
    name: props.item.name,
    rarity: props.item.rarity ?? props.detail?.rarity ?? "",
    type: props.item.type ?? props.detail?.type ?? "",
    attunement: props.item.attunement ?? props.detail?.attunement ?? false,
    attuned: props.item.attuned ?? false,
    magic: props.item.magic ?? props.detail?.magic ?? false,
    silvered: props.item.silvered ?? false,
    weight: props.item.weight ?? props.detail?.weight ?? null,
    value: props.item.value ?? props.detail?.value ?? null,
    ac: props.item.ac ?? props.detail?.ac ?? null,
    stealthDisadvantage: props.item.stealthDisadvantage ?? props.detail?.stealthDisadvantage ?? false,
    dmg1: props.item.dmg1 ?? props.detail?.dmg1 ?? "",
    dmg2: props.item.dmg2 ?? props.detail?.dmg2 ?? "",
    dmgType: props.item.dmgType ?? props.detail?.dmgType ?? "",
    properties: props.item.properties?.length ? props.item.properties : (props.detail?.properties ?? []),
    description: props.item.description ?? (props.detail ? (Array.isArray(props.detail.text) ? props.detail.text.join("\n\n") : props.detail.text ?? "") : ""),
  };
  const kindItem: InventoryItem = {
    ...props.item,
    type: merged.type || null,
    dmg1: merged.dmg1 || null,
    dmg2: merged.dmg2 || null,
    ac: merged.ac,
    properties: merged.properties,
  };
  const isWeaponLike = isWeaponItem(kindItem);
  const isRangedWeaponLike = isWeaponLike && isRangedWeapon(kindItem);
  const isMeleeWeaponLike = isWeaponLike && !isRangedWeaponLike;
  const isArmorLike = isArmorItem(kindItem) || isShieldItem(kindItem);
  const [draft, setDraft] = useState(merged);

  useEffect(() => {
    setDraft(merged);
  }, [
    props.item.id,
    merged.name,
    merged.rarity,
    merged.type,
    merged.attunement,
    merged.attuned,
    merged.magic,
    merged.silvered,
    merged.weight,
    merged.value,
    merged.ac,
    merged.stealthDisadvantage,
    merged.dmg1,
    merged.dmg2,
    merged.dmgType,
    merged.description,
    merged.properties.join("|"),
  ]);

  const hasAnyDetails = Boolean(
    draft.rarity ||
    draft.type ||
    draft.description ||
    draft.weight != null ||
    draft.value != null ||
    (isArmorLike && draft.ac != null) ||
    (isWeaponLike && draft.dmg1) ||
    (isWeaponLike && draft.dmg2) ||
    (isWeaponLike && draft.dmgType) ||
    (isWeaponLike && draft.properties.length > 0) ||
    draft.stealthDisadvantage ||
    draft.attunement ||
    draft.attuned ||
    draft.magic ||
    (isMeleeWeaponLike && draft.silvered) ||
    (props.item.chargesMax ?? 0) > 0
  );
  const canEnableAttuned = draft.attuned || props.otherAttunedCount < 3;
  const currentContainerId = props.item.containerId ?? DEFAULT_CONTAINER_ID;

  async function handleSave() {
    await props.onSave({
      name: draft.name.trim() || props.item.name,
      rarity: draft.rarity.trim() || null,
      type: props.item.type ?? props.detail?.type ?? null,
      attunement: Boolean(draft.attunement),
      attuned: draft.attunement && canEnableAttuned ? Boolean(draft.attuned) : false,
      magic: Boolean(draft.magic),
      silvered: isMeleeWeaponLike ? Boolean(draft.silvered) : false,
      weight: draft.weight == null || Number.isNaN(draft.weight) ? null : draft.weight,
      value: draft.value == null || Number.isNaN(draft.value) ? null : draft.value,
      ac: isArmorLike && draft.ac != null && !Number.isNaN(draft.ac) ? draft.ac : null,
      stealthDisadvantage: isArmorLike ? Boolean(draft.stealthDisadvantage) : false,
      dmg1: isWeaponLike ? (draft.dmg1.trim() || null) : null,
      dmg2: isWeaponLike ? (draft.dmg2.trim() || null) : null,
      dmgType: isWeaponLike ? (draft.dmgType.trim() || null) : null,
      properties: isWeaponLike ? draft.properties.map((p) => p.trim()).filter(Boolean) : [],
      description: draft.description.trim() || undefined,
      source: "custom",
    });
  }

  return (
    <>
      <div onClick={props.onClose} style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)" }} />
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 901,
        width: "min(520px, 92vw)",
        background: "#0e1220",
        borderLeft: "1px solid rgba(255,255,255,0.12)",
        display: "flex", flexDirection: "column",
        boxShadow: "-8px 0 30px rgba(0,0,0,0.5)",
      }}>
        <div style={{
          padding: "18px 20px 14px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          display: "flex", alignItems: "center", justifyContent: "space-between",
          gap: 8,
        }}>
          <div style={{ minWidth: 0 }}>
            <div style={{ fontWeight: 900, fontSize: 20, color: C.text }}>{props.item.name}</div>
            <div style={{ fontSize: 11, color: C.muted, marginTop: 4 }}>
              Player-owned copy. Edits here affect only this character.
            </div>
          </div>
          <button type="button" onClick={props.onClose} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, color: C.muted, cursor: "pointer", padding: "8px 14px", fontSize: 13, fontWeight: 700 }}>
            Close
          </button>
        </div>

        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          {getEquipState(props.item) === "backpack" && (
            <div style={{
              display: "grid",
              gridTemplateColumns: "minmax(0, 1fr)",
              gap: 8,
              padding: "10px 12px",
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 12,
              background: "rgba(255,255,255,0.03)",
            }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em" }}>
                Container
              </div>
              <Select
                value={currentContainerId}
                onChange={(e) => { void props.onMoveToContainer(e.target.value); }}
                style={{ width: "100%" }}
              >
                {props.containers.map((container) => (
                  <option key={container.id} value={container.id}>
                    {container.name}{container.ignoreWeight ? " (Ignore Weight)" : ""}
                  </option>
                ))}
              </Select>
            </div>
          )}
          {props.editMode ? (
            <>
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Title</div>
                <input
                  value={draft.name}
                  onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                  placeholder="Item name"
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}
                />
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Rarity</div>
                  <Select value={draft.rarity} onChange={(e) => setDraft((d) => ({ ...d, rarity: e.target.value }))} style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }}>
                    <option value="">None</option>
                    <option value="common">Common</option>
                    <option value="uncommon">Uncommon</option>
                    <option value="rare">Rare</option>
                    <option value="very rare">Very Rare</option>
                    <option value="legendary">Legendary</option>
                    <option value="artifact">Artifact</option>
                  </Select>
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Weight</div>
                  <input type="number" value={draft.weight ?? ""} onChange={(e) => setDraft((d) => ({ ...d, weight: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="Weight" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Value</div>
                  <input type="number" value={draft.value ?? ""} onChange={(e) => setDraft((d) => ({ ...d, value: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="Value" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
                {isWeaponLike && (
                  <>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Damage 1</div>
                      <input value={draft.dmg1} onChange={(e) => setDraft((d) => ({ ...d, dmg1: e.target.value }))} placeholder="Damage 1" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Damage 2</div>
                      <input value={draft.dmg2} onChange={(e) => setDraft((d) => ({ ...d, dmg2: e.target.value }))} placeholder="Damage 2" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Damage Type</div>
                      <input value={draft.dmgType} onChange={(e) => setDraft((d) => ({ ...d, dmgType: e.target.value }))} placeholder="Damage Type" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                    </div>
                    <div>
                      <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Properties</div>
                      <input value={draft.properties.join(", ")} onChange={(e) => setDraft((d) => ({ ...d, properties: e.target.value.split(",").map((p) => p.trim()).filter(Boolean) }))} placeholder="Properties" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                    </div>
                  </>
                )}
                {isArmorLike && (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Armor Class</div>
                    <input type="number" value={draft.ac ?? ""} onChange={(e) => setDraft((d) => ({ ...d, ac: e.target.value === "" ? null : Number(e.target.value) }))} placeholder="AC" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                  </div>
                )}
                <div>
                  <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 6 }}>Max Charges</div>
                  <input type="number" min={0} value={props.item.chargesMax ?? ""} onChange={async (e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    await props.onSave({ chargesMax: v, charges: v ?? null });
                  }} placeholder="0" style={{ ...inputStyle, width: "100%", boxSizing: "border-box" }} />
                </div>
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <label style={inventoryCheckboxLabel}>
                  <input type="checkbox" checked={draft.magic} onChange={(e) => setDraft((d) => ({ ...d, magic: e.target.checked }))} />
                  Magic
                </label>
                {draft.attunement && (
                  <label style={inventoryCheckboxLabel}>
                    <input
                      type="checkbox"
                      checked={draft.attuned}
                      disabled={!draft.attuned && !canEnableAttuned}
                      onChange={(e) => setDraft((d) => ({ ...d, attuned: e.target.checked }))}
                    />
                    Attuned
                  </label>
                )}
                {isMeleeWeaponLike && (
                  <label style={inventoryCheckboxLabel}>
                    <input type="checkbox" checked={draft.silvered} onChange={(e) => setDraft((d) => ({ ...d, silvered: e.target.checked }))} />
                    Silvered
                  </label>
                )}
                {isArmorLike && (
                  <label style={inventoryCheckboxLabel}>
                    <input type="checkbox" checked={draft.stealthDisadvantage} onChange={(e) => setDraft((d) => ({ ...d, stealthDisadvantage: e.target.checked }))} />
                    Stealth D
                  </label>
                )}
              </div>
              {draft.attunement && !canEnableAttuned && (
                <div style={{ fontSize: 11, color: C.red }}>
                  You can have no more than 3 attuned items at a time.
                </div>
              )}
              <div>
                <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Text</div>
                <textarea
                  value={draft.description}
                  onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                  placeholder="Description"
                  rows={12}
                  style={{ ...inputStyle, width: "100%", boxSizing: "border-box", resize: "vertical", minHeight: 240, fontFamily: "inherit", lineHeight: 1.5 }}
                />
              </div>
            </>
          ) : props.busy ? (
            <div style={{ color: C.muted, padding: "8px 2px" }}>Loading...</div>
          ) : hasAnyDetails ? (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {draft.magic && <InventoryTag label="Magic" color="#a78bfa" />}
                {draft.attunement && !draft.attuned && <InventoryTag label="Requires Attunement" color={props.accentColor} />}
                {draft.attuned && <InventoryTag label="Attuned" color={props.accentColor} />}
                {isMeleeWeaponLike && draft.silvered && <InventoryTag label="Silvered" color="#cbd5e1" />}
                {draft.rarity && <InventoryTag label={titleCase(draft.rarity)} color={inventoryRarityColor(draft.rarity)} />}
                {draft.type && <InventoryTag label={draft.type} color={C.muted} />}
                {isArmorLike && draft.stealthDisadvantage && <InventoryTag label="D" color="#f87171" />}
              </div>
              {((isWeaponLike && (draft.dmg1 || draft.dmg2 || draft.dmgType || draft.properties.length > 0)) || draft.weight != null || draft.value != null || (isArmorLike && (draft.ac != null || draft.stealthDisadvantage))) && (
                <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))", gap: 8 }}>
                  {isArmorLike && draft.ac != null && <InventoryStat label="Armor Class" value={String(draft.ac)} />}
                  {isWeaponLike && draft.dmg1 && <InventoryStat label="One-Handed Damage" value={draft.dmg1} />}
                  {isWeaponLike && draft.dmg2 && <InventoryStat label="Two-Handed Damage" value={draft.dmg2} />}
                  {isWeaponLike && draft.dmgType && <InventoryStat label="Damage Type" value={formatItemDamageType(draft.dmgType) ?? draft.dmgType} />}
                  {draft.weight != null && <InventoryStat label="Weight" value={`${draft.weight} lb`} />}
                  {draft.value != null && <InventoryStat label="Value" value={`${draft.value} gp`} />}
                  {isWeaponLike && draft.properties.length > 0 && <InventoryStat label="Properties" value={formatItemProperties(draft.properties)} />}
                  {isArmorLike && draft.stealthDisadvantage && <InventoryStat label="Stealth" value="D" />}
                </div>
              )}
              {/* Charge boxes */}
              {(props.item.chargesMax ?? 0) > 0 && !props.editMode && (() => {
                const max = props.item.chargesMax!;
                const cur = props.item.charges ?? max;
                return (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Charges</div>
                    <div style={{ display: "flex", gap: 5, flexWrap: "wrap", alignItems: "center" }}>
                      {Array.from({ length: max }).map((_, i) => {
                        const filled = i < cur;
                        return (
                          <button
                            key={i}
                            title={filled ? "Expend charge" : "Regain charge"}
                            onClick={() => props.onChargesChange(filled ? cur - 1 : i + 1)}
                            style={{
                              width: 24, height: 24, borderRadius: 4,
                              border: `2px solid ${filled ? props.accentColor : "rgba(255,255,255,0.2)"}`,
                              background: filled ? `${props.accentColor}33` : "transparent",
                              cursor: "pointer", padding: 0,
                            }}
                          />
                        );
                      })}
                      <span style={{ fontSize: 11, color: C.muted, marginLeft: 4 }}>{cur} / {max}</span>
                    </div>
                  </div>
                );
              })()}
              {/* Item spells */}
              {(() => {
                const spells = parseItemSpells(draft.description ?? "");
                if (!spells.length) return null;
                return (
                  <div>
                    <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>Spells</div>
                    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                      {spells.map((sp) => (
                        <div key={sp.name} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "6px 10px", borderRadius: 6, background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.2)" }}>
                          <span style={{ fontSize: 13, color: "#c4b5fd", fontWeight: 600 }}>{sp.name}</span>
                          <span style={{ fontSize: 11, color: C.muted, fontWeight: 600 }}>{sp.cost} {sp.cost === 1 ? "Charge" : "Charges"}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })()}
              <div style={{ ...inventoryPickerDetailStyle, minHeight: 180 }}>
                {draft.description || <span style={{ color: C.muted }}>No description.</span>}
              </div>
            </>
          ) : (
            <div style={{
              border: `1px solid ${C.panelBorder}`,
              borderRadius: 12,
              padding: 14,
              color: C.muted,
              minHeight: 96,
              display: "flex",
              alignItems: "center",
            }}>
              No details yet. Use Edit to add player-specific notes or item data.
            </div>
          )}
        </div>

        <div style={{ padding: "12px 20px", borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: 8 }}>
          {props.editMode ? (
            <>
              <button type="button" onClick={props.onCancelEdit} style={{ background: "transparent", border: "1px solid rgba(255,255,255,0.16)", borderRadius: 8, color: C.muted, cursor: "pointer", padding: "8px 16px", fontSize: 13 }}>
                Cancel
              </button>
              <button type="button" onClick={() => { void handleSave(); }} style={{ background: `${props.accentColor}22`, border: `1px solid ${props.accentColor}55`, borderRadius: 8, color: props.accentColor, cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>
                Save
              </button>
            </>
          ) : (
            <button type="button" onClick={props.onStartEdit} style={{ background: `${props.accentColor}22`, border: `1px solid ${props.accentColor}55`, borderRadius: 8, color: props.accentColor, cursor: "pointer", padding: "8px 16px", fontSize: 13, fontWeight: 700 }}>
              Edit
            </button>
          )}
        </div>
      </div>
    </>
  );
}

function InventoryItemPickerModal(props: {
  isOpen: boolean;
  accentColor: string;
  onClose: () => void;
  onAdd: (payload?: InventoryPickerPayload) => void;
}) {
  const {
    q, setQ,
    rarityFilter, setRarityFilter, rarityOptions,
    typeFilter, setTypeFilter, typeOptions,
    filterAttunement, setFilterAttunement,
    filterMagic, setFilterMagic,
    hasActiveFilters, clearFilters,
    rows, busy, error, totalCount, refresh,
  } = useItemSearch();
  const vl = useVirtualList({ isEnabled: true, rowHeight: INVENTORY_PICKER_ROW_HEIGHT, overscan: 8 });
  const { start, end, padTop, padBottom } = vl.getRange(rows.length);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<CompendiumItemDetail | null>(null);
  const [qty, setQty] = useState(1);
  const [createMode, setCreateMode] = useState(false);
  const [customName, setCustomName] = useState("");
  const [customRarity, setCustomRarity] = useState("");
  const [customType, setCustomType] = useState("");
  const [customAttunement, setCustomAttunement] = useState(false);
  const [customMagic, setCustomMagic] = useState(false);
  const [customDescription, setCustomDescription] = useState("");

  useEffect(() => {
    if (props.isOpen) refresh();
  }, [props.isOpen, refresh]);

  useEffect(() => {
    const el = vl.scrollRef.current;
    if (el) el.scrollTop = 0;
  }, [q, rarityFilter, typeFilter, filterAttunement, filterMagic, createMode, props.isOpen]);

  useEffect(() => {
    if (!props.isOpen) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") props.onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [props]);

  useEffect(() => {
    if (!props.isOpen) {
      setSelectedId(null);
      setDetail(null);
      setQty(1);
      setCreateMode(false);
      setCustomName("");
      setCustomRarity("");
      setCustomType("");
      setCustomAttunement(false);
      setCustomMagic(false);
      setCustomDescription("");
    }
  }, [props.isOpen]);

  useEffect(() => {
    if (!props.isOpen || createMode || !selectedId) {
      setDetail(null);
      return;
    }
    let alive = true;
    api<CompendiumItemDetail>(`/api/compendium/items/${selectedId}`)
      .then((data) => { if (alive) setDetail(data); })
      .catch(() => { if (alive) setDetail(null); });
    return () => { alive = false; };
  }, [props.isOpen, createMode, selectedId]);

  if (!props.isOpen) return null;

  const detailText = detail
    ? (Array.isArray(detail.text) ? detail.text.join("\n\n") : detail.text ?? "")
    : "";

  return (
    <div
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) props.onClose();
      }}
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 1000,
        background: "rgba(4, 8, 18, 0.72)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <div
        style={{
          width: "min(980px, 100%)",
          height: "min(680px, calc(100vh - 40px))",
          background: C.bg,
          border: `1px solid ${C.panelBorder}`,
          borderRadius: 16,
          boxShadow: "0 30px 80px rgba(0,0,0,0.45)",
          display: "grid",
          gridTemplateColumns: "minmax(320px, 380px) minmax(0, 1fr)",
          gap: 12,
          padding: 12,
          overflow: "hidden",
        }}
      >
        <div style={inventoryPickerColumnStyle}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
            <div style={{ fontSize: 12, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", color: "#fbbf24" }}>
              Browse Items
            </div>
            <button
              type="button"
              onClick={() => {
                setCreateMode((v) => !v);
                setSelectedId(null);
              }}
              style={{
                border: `1px solid ${createMode ? props.accentColor : C.panelBorder}`,
                background: createMode ? `${props.accentColor}22` : "transparent",
                color: createMode ? props.accentColor : C.muted,
                borderRadius: 8,
                padding: "6px 10px",
                fontSize: 12,
                fontWeight: 700,
                cursor: "pointer",
              }}
            >
              {createMode ? "Browse" : "Create New"}
            </button>
          </div>

          <input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search items..."
            style={{ ...inputStyle, flex: "0 0 auto", width: "100%" }}
          />

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
            <Select value={rarityFilter} onChange={(e) => setRarityFilter(e.target.value)} style={{ width: "100%" }}>
              {rarityOptions.map((r) => (
                <option key={r} value={r}>{r === "all" ? "All Rarities" : titleCase(r)}</option>
              ))}
            </Select>
            <Select value={typeFilter} onChange={(e) => setTypeFilter(e.target.value)} style={{ width: "100%" }}>
              {typeOptions.map((t) => (
                <option key={t} value={t}>{t === "all" ? "All Types" : t}</option>
              ))}
            </Select>
          </div>

          <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
            <button type="button" onClick={() => setFilterAttunement(!filterAttunement)} style={toggleFilterPill(filterAttunement, props.accentColor)}>
              Attunement
            </button>
            <button type="button" onClick={() => setFilterMagic(!filterMagic)} style={toggleFilterPill(filterMagic, props.accentColor)}>
              Magic
            </button>
            {hasActiveFilters && (
              <button type="button" onClick={clearFilters} style={toggleFilterPill(false, props.accentColor)}>
                Clear
              </button>
            )}
          </div>

          <div style={{ fontSize: 12, color: C.muted }}>
            {busy ? "Loading..." : error ? error : totalCount === rows.length ? `${rows.length} items` : `${rows.length} of ${totalCount}`}
          </div>

          <div ref={vl.scrollRef} onScroll={vl.onScroll} style={inventoryPickerListStyle}>
            <div style={{ height: padTop }} />
            {!busy && error && (
              <div style={{ padding: 12, color: C.red }}>{error}</div>
            )}
            {!busy && rows.length === 0 && (
              <div style={{ padding: 12, color: C.muted }}>No items found.</div>
            )}
            {rows.slice(start, end).map((item) => {
              const active = item.id === selectedId;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => {
                    setSelectedId(item.id);
                    setCreateMode(false);
                  }}
                  style={{
                    width: "100%",
                    border: "none",
                    borderBottom: `1px solid ${C.panelBorder}`,
                    background: active ? withAlpha(C.accentHl, 0.15) : "transparent",
                    color: C.text,
                    textAlign: "left",
                    padding: "0 16px",
                    cursor: "pointer",
                    minHeight: INVENTORY_PICKER_ROW_HEIGHT,
                    display: "flex",
                    flexDirection: "column",
                    justifyContent: "center",
                  }}
                >
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    {item.rarity && <span style={{ width: 9, height: 9, borderRadius: "50%", background: inventoryRarityColor(item.rarity), flexShrink: 0 }} />}
                    <span style={{ fontWeight: 800, fontSize: 13, flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                      {item.name}
                    </span>
                    {item.magic && (
                      <span style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 3,
                        fontSize: 11,
                        fontWeight: 700,
                        color: "#a78bfa",
                        border: "1px solid #6d28d966",
                        borderRadius: 6,
                        padding: "1px 6px",
                        lineHeight: 1.4,
                        whiteSpace: "nowrap",
                      }}>Magic</span>
                    )}
                  </div>
                  <div style={{ fontSize: 11, color: C.muted, marginTop: 2 }}>
                    {[item.rarity ? titleCase(item.rarity) : null, item.type, item.attunement ? "Attunement" : null].filter(Boolean).join(" • ")}
                  </div>
                </button>
              );
            })}
            <div style={{ height: padBottom }} />
          </div>
        </div>

        <div style={inventoryPickerColumnStyle}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: C.text }}>
              {createMode ? "Create Item" : detail?.name ?? "Select an item"}
            </div>
            <div style={{ flex: 1 }} />
            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
              <button type="button" onClick={() => setQty((v) => Math.max(1, v - 1))} style={stepperBtn}>−</button>
              <input
                type="number"
                min={1}
                value={qty}
                onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
                style={{ ...inputStyle, width: 64, textAlign: "center", flex: "0 0 auto" }}
              />
              <button type="button" onClick={() => setQty((v) => v + 1)} style={stepperBtn}>+</button>
            </div>
            <button
              type="button"
              onClick={() => {
                if (createMode) {
                  const name = customName.trim();
                  if (!name) return;
                  props.onAdd({
                    source: "custom",
                    name,
                    quantity: qty,
                    rarity: customRarity.trim() || null,
                    type: customType.trim() || null,
                    attunement: customAttunement,
                    magic: customMagic,
                    description: customDescription.trim() || undefined,
                  });
                  return;
                }
                if (!detail) return;
                props.onAdd({
                  source: "compendium",
          name: detail.name,
                  quantity: qty,
                  itemId: detail.id,
                  rarity: detail.rarity,
                  type: detail.type,
                  attunement: detail.attunement,
                  magic: detail.magic,
                  weight: detail.weight,
                  value: detail.value,
                  ac: detail.ac,
                  stealthDisadvantage: detail.stealthDisadvantage,
                  dmg1: detail.dmg1,
                  dmg2: detail.dmg2,
                  dmgType: detail.dmgType,
                  properties: detail.properties,
                  description: detailText,
                });
              }}
              disabled={createMode ? !customName.trim() : !detail}
              style={addBtnStyle(props.accentColor)}
            >
              Add
            </button>
            <button type="button" onClick={props.onClose} style={cancelBtnStyle}>
              Close
            </button>
          </div>

          {createMode ? (
            <>
              <input
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                placeholder="Item name"
                style={{ ...inputStyle, flex: "0 0 auto", width: "100%" }}
              />
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                <input
                  value={customRarity}
                  onChange={(e) => setCustomRarity(e.target.value)}
                  placeholder="Rarity"
                  style={{ ...inputStyle, flex: "0 0 auto", width: "100%" }}
                />
                <input
                  value={customType}
                  onChange={(e) => setCustomType(e.target.value)}
                  placeholder="Type"
                  style={{ ...inputStyle, flex: "0 0 auto", width: "100%" }}
                />
              </div>
              <div style={{ display: "flex", gap: 18, flexWrap: "wrap" }}>
                <label style={inventoryCheckboxLabel}>
                  <input type="checkbox" checked={customAttunement} onChange={(e) => setCustomAttunement(e.target.checked)} />
                  Requires Attunement
                </label>
                <label style={inventoryCheckboxLabel}>
                  <input type="checkbox" checked={customMagic} onChange={(e) => setCustomMagic(e.target.checked)} />
                  Magic Item
                </label>
              </div>
              <textarea
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                placeholder="Description or notes..."
                rows={12}
                style={{ ...inputStyle, flex: "0 0 auto", width: "100%", resize: "vertical", minHeight: 220, fontFamily: "inherit", lineHeight: 1.5 }}
              />
            </>
          ) : detail ? (
            <>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {detail.magic && <InventoryTag label="Magic" color="#a78bfa" />}
                {detail.attunement && <InventoryTag label="Attunement" color={props.accentColor} />}
                {detail.rarity && <InventoryTag label={titleCase(detail.rarity)} color={inventoryRarityColor(detail.rarity)} />}
                {detail.type && <InventoryTag label={detail.type} color={C.muted} />}
                {hasStealthDisadvantage(detail) && <InventoryTag label="D" color="#f87171" />}
              </div>
              {(detail.dmg1 || detail.dmg2 || detail.dmgType || detail.weight != null || detail.value != null || detail.properties.length > 0) && (
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
                  gap: 8,
                }}>
                  {detail.dmg1 && <InventoryStat label="One-Handed Damage" value={detail.dmg1} />}
                  {detail.dmg2 && <InventoryStat label="Two-Handed Damage" value={detail.dmg2} />}
                  {detail.dmgType && <InventoryStat label="Damage Type" value={formatItemDamageType(detail.dmgType) ?? detail.dmgType} />}
                  {detail.weight != null && <InventoryStat label="Weight" value={`${detail.weight} lb`} />}
                  {detail.value != null && <InventoryStat label="Value" value={`${detail.value} gp`} />}
                  {hasStealthDisadvantage(detail) && <InventoryStat label="Stealth" value="D" />}
                  {detail.properties.length > 0 && <InventoryStat label="Properties" value={formatItemProperties(detail.properties)} />}
                </div>
              )}
              <div style={inventoryPickerDetailStyle}>
                {detailText || <span style={{ color: C.muted }}>No description.</span>}
              </div>
            </>
          ) : (
            <div style={{ color: C.muted, lineHeight: 1.5 }}>
              Pick a compendium item on the left, or switch to <strong>Create New</strong> to add a custom entry.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function InventoryTag({ label, color }: { label: string; color: string }) {
  return (
    <span style={{
      fontSize: 11,
      fontWeight: 700,
      padding: "2px 8px",
      borderRadius: 999,
      color,
      border: `1px solid ${color}44`,
      background: `${color}18`,
    }}>
      {label}
    </span>
  );
}

function InventoryStat({ label, value }: { label: string; value: string }) {
  return (
    <div style={{
      border: `1px solid ${C.panelBorder}`,
      borderRadius: 10,
      background: "rgba(255,255,255,0.035)",
      padding: "8px 10px",
      minWidth: 0,
    }}>
      <div style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.muted, marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 13, fontWeight: 700, color: C.text, overflow: "hidden", textOverflow: "ellipsis" }}>
        {value}
      </div>
    </div>
  );
}

const subLabelStyle: React.CSSProperties = {
  fontSize: 10, fontWeight: 700, color: C.muted,
  textTransform: "uppercase", letterSpacing: "0.07em",
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  flex: 1, background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.16)",
  borderRadius: 7, padding: "6px 10px",
  color: C.text, fontSize: 13, outline: "none",
};

const stepperBtn: React.CSSProperties = {
  background: "rgba(255,255,255,0.07)",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 4, width: 20, height: 20,
  color: C.muted, cursor: "pointer", fontSize: 13,
  display: "flex", alignItems: "center", justifyContent: "center",
  padding: 0, lineHeight: 1,
};
