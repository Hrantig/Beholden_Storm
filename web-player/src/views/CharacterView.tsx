import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { C, withAlpha } from "@/lib/theme";
import { titleCase } from "@/lib/format/titleCase";
import { IconPlayer, IconShield, IconSpeed, IconHeart, IconInitiative, IconConditions, IconAttack, IconHeal, IconInspiration, IconConditionByKey } from "@/icons";
import { rollDiceExpr, hasDiceTerm } from "@/lib/dice";
import { useWs } from "@/services/ws";
import { Select } from "@/ui/Select";
import { useVirtualList } from "@/lib/monsterPicker/useVirtualList";
import { useItemSearch } from "@/views/CompendiumView/hooks/useItemSearch";
import { DraggableList } from "@/ui/DraggableList";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface TaggedItem { name: string; source: string }
interface ProficiencyMap {
  skills: TaggedItem[];
  saves: TaggedItem[];
  armor: TaggedItem[];
  weapons: TaggedItem[];
  tools: TaggedItem[];
  languages: TaggedItem[];
  spells: TaggedItem[];
  invocations: TaggedItem[];
}

interface CharacterCampaign {
  id: string;
  campaignId: string;
  campaignName: string;
  playerId: string | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  equipped: boolean;
  equipState?: "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand" | "worn";
  notes?: string;
  source?: "compendium" | "custom";
  itemId?: string;
  rarity?: string | null;
  type?: string | null;
  attunement?: boolean;
  attuned?: boolean;
  magic?: boolean;
  silvered?: boolean;
  weight?: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  description?: string;
  chargesMax?: number | null;
  charges?: number | null;
}

interface InventoryPickerPayload {
  source: "compendium" | "custom";
  name: string;
  quantity: number;
  itemId?: string;
  rarity?: string | null;
  type?: string | null;
  attunement?: boolean;
  attuned?: boolean;
  magic?: boolean;
  silvered?: boolean;
  weight?: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
  description?: string;
}

interface CompendiumItemDetail {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  attunement: boolean;
  magic: boolean;
  weight: number | null;
  value: number | null;
  ac: number | null;
  stealthDisadvantage?: boolean;
  dmg1: string | null;
  dmg2: string | null;
  dmgType: string | null;
  properties: string[];
  modifiers?: Array<{ category?: string; text?: string }>;
  text: string | string[];
}

interface ItemSummaryRow {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  typeKey: string | null;
  attunement: boolean;
  magic: boolean;
}

interface CharacterData {
  classId?: string;
  raceId?: string;
  bgId?: string;
  subclass?: string | null;
  abilityMethod?: string;
  hd?: number | null;
  hitDiceCurrent?: number | null;
  xp?: number;
  chosenOptionals?: string[];
  chosenSkills?: string[];
  chosenCantrips?: string[];
  chosenSpells?: string[];
  chosenInvocations?: string[];
  classFeatures?: ClassFeatureEntry[];
  resources?: ResourceCounter[];
  proficiencies?: ProficiencyMap;
  inventory?: InventoryItem[];
  playerNotesList?: PlayerNote[];
  usedSpellSlots?: Record<string, number>;
  preparedSpells?: string[];
}

/** Total XP required to reach each level (index = level). Index 0 unused. */
const XP_TO_LEVEL = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 260000, 300000, 355000];

interface ConditionInstance {
  key: string;
  casterId?: string | null;
  casterName?: string | null;
  sourceName?: string | null;
  [k: string]: unknown;
}

const INVENTORY_PICKER_ROW_HEIGHT = 52;

const ITEM_DAMAGE_TYPE_LABELS: Record<string, string> = {
  B: "Bludgeoning",
  P: "Piercing",
  S: "Slashing",
  A: "Acid",
  C: "Cold",
  F: "Fire",
  FC: "Force",
  L: "Lightning",
  N: "Necrotic",
  PS: "Poison",
  PY: "Psychic",
  R: "Radiant",
  T: "Thunder",
};

const ITEM_PROPERTY_LABELS: Record<string, string> = {
  A: "Ammunition",
  AF: "Ammunition (Firearm)",
  BF: "Burst Fire",
  F: "Finesse",
  H: "Heavy",
  L: "Light",
  LD: "Loading",
  M: "Martial",
  R: "Reach",
  RC: "Reload",
  S: "Special",
  T: "Thrown",
  V: "Versatile",
  "2H": "Two-Handed",
};

interface Character {
  id: string;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  speed: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  color: string | null;
  imageUrl: string | null;
  characterData: CharacterData | null;
  campaigns: CharacterCampaign[];
  conditions?: ConditionInstance[];
  overrides?: { tempHp: number; acBonus: number; hpMaxBonus: number; inspiration?: boolean };
  deathSaves?: { success: number; fail: number };
  sharedNotes?: string;
  campaignSharedNotes?: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
type AbilKey = typeof ABILITY_KEYS[number];

interface PlayerNote {
  id: string;
  title: string;
  text: string;
}

interface ClassFeatureEntry {
  id: string;
  name: string;
  text: string;
}

interface ResourceCounter {
  key: string;
  name: string;
  current: number;
  max: number;
  reset: string;
}

interface ClassCounterDef {
  name: string;
  value: number;
  reset: string;
}

interface ClassRestDetail {
  id: string;
  name: string;
  hd: number | null;
  slotsReset?: string | null;
  autolevels: Array<{
    level: number;
    slots: number[] | null;
    counters: ClassCounterDef[];
  }>;
}

const ABILITY_LABELS: Record<AbilKey, string> = {
  str: "STR", dex: "DEX", con: "CON", int: "INT", wis: "WIS", cha: "CHA",
};
const ABILITY_FULL: Record<AbilKey, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

const ALL_SKILLS: { name: string; abil: AbilKey }[] = [
  { name: "Acrobatics",      abil: "dex" },
  { name: "Animal Handling", abil: "wis" },
  { name: "Arcana",          abil: "int" },
  { name: "Athletics",       abil: "str" },
  { name: "Deception",       abil: "cha" },
  { name: "History",         abil: "int" },
  { name: "Insight",         abil: "wis" },
  { name: "Intimidation",    abil: "cha" },
  { name: "Investigation",   abil: "int" },
  { name: "Medicine",        abil: "wis" },
  { name: "Nature",          abil: "int" },
  { name: "Perception",      abil: "wis" },
  { name: "Performance",     abil: "cha" },
  { name: "Persuasion",      abil: "cha" },
  { name: "Religion",        abil: "int" },
  { name: "Sleight of Hand", abil: "dex" },
  { name: "Stealth",         abil: "dex" },
  { name: "Survival",        abil: "wis" },
];

const CONDITIONS = [
  { key: "blinded",       name: "Blinded" },
  { key: "charmed",       name: "Charmed" },
  { key: "deafened",      name: "Deafened" },
  { key: "frightened",    name: "Frightened" },
  { key: "grappled",      name: "Grappled" },
  { key: "incapacitated", name: "Incapacitated" },
  { key: "invisible",     name: "Invisible" },
  { key: "paralyzed",     name: "Paralyzed" },
  { key: "petrified",     name: "Petrified" },
  { key: "poisoned",      name: "Poisoned" },
  { key: "prone",         name: "Prone" },
  { key: "restrained",    name: "Restrained" },
  { key: "stunned",       name: "Stunned" },
  { key: "unconscious",   name: "Unconscious" },
  { key: "concentration", name: "Concentration" },
  { key: "hexed",         name: "Hexed", needsCaster: true },
  { key: "marked",        name: "Marked", needsCaster: true },
];

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function mod(score: number | null): number {
  return Math.floor(((score ?? 10) - 10) / 2);
}
function fmtMod(n: number): string {
  return (n >= 0 ? "+" : "") + n;
}
function profBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}
function isProficientIn(list: TaggedItem[], name: string): boolean {
  return list.some((s) => s.name.toLowerCase() === name.toLowerCase());
}
function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function conditionDisplayLabel(cond: ConditionInstance): string {
  const def = CONDITIONS.find((c) => c.key === cond.key);
  const base = def?.name ?? titleCase(cond.key);
  if (!def?.needsCaster) return base;

  const source =
    (typeof cond.casterName === "string" && cond.casterName.trim()) ||
    (typeof cond.sourceName === "string" && cond.sourceName.trim());

  return source ? `${base} (${source})` : base;
}

function formatItemDamageType(code: string | null | undefined): string | null {
  const key = String(code ?? "").trim().toUpperCase();
  if (!key) return null;
  return ITEM_DAMAGE_TYPE_LABELS[key] ?? key;
}

function formatItemProperties(properties: string[] | null | undefined): string {
  return (properties ?? [])
    .map((code) => {
      const key = String(code ?? "").trim().toUpperCase();
      return ITEM_PROPERTY_LABELS[key] ?? key;
    })
    .filter(Boolean)
    .join(", ");
}

function isArmorItem(item: InventoryItem): boolean {
  return /\barmor\b/i.test(item.type ?? "") && !isShieldOrTorch(item);
}

function hasStealthDisadvantage(item: { stealthDisadvantage?: boolean; description?: string | null }): boolean {
  if (item.stealthDisadvantage) return true;
  return /disadvantage on stealth/i.test(String(item.description ?? ""));
}

function normalizeInventoryItemLookupName(name: string): string {
  return String(name ?? "")
    .replace(/\s+\[(?:2024|5\.5e|5e)\]\s*$/i, "")
    .replace(/\s+\((?:2024|5\.5e|5e)\)\s*$/i, "")
    .trim()
    .toLowerCase();
}

function hasClassFeatureNamed(charData: CharacterData | null | undefined, pattern: RegExp): boolean {
  return Boolean(charData?.classFeatures?.some((feature) => pattern.test(feature.name)));
}

function addsAbilityModToOffhandDamage(item: InventoryItem, charData: CharacterData | null | undefined): boolean {
  if (hasClassFeatureNamed(charData, /two-weapon fighting/i)) return true;
  if (isRangedWeapon(item) && hasClassFeatureNamed(charData, /crossbow expert/i)) return true;
  return false;
}

function isShieldItem(item: InventoryItem): boolean {
  const type = String(item.type ?? "").toLowerCase();
  const name = String(item.name ?? "").toLowerCase();
  return type.includes("shield") || (name.includes("shield") && !name.includes("torch"));
}

type EquipState = "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand" | "worn";

function getEquipState(item: InventoryItem): EquipState {
  if (item.equipState) return item.equipState;
  if (item.equipped) return isArmorItem(item) ? "worn" : "mainhand-1h";
  return "backpack";
}

function isWeaponItem(item: InventoryItem): boolean {
  return Boolean(item.dmg1) || /weapon/i.test(item.type ?? "") || /\bstaff\b/i.test(item.type ?? "");
}

interface ParsedItemSpell { name: string; cost: number }

function parseItemSpells(text: string): ParsedItemSpell[] {
  const results: ParsedItemSpell[] = [];
  const lines = text.split('\n');
  let inTable = false;
  for (const line of lines) {
    const t = line.trim();
    if (/spell\s*\|.*charge/i.test(t)) { inTable = true; continue; }
    if (inTable) {
      const m = t.match(/^(.+?)\s*\|\s*(\d+)/);
      if (m) results.push({ name: m[1].trim(), cost: parseInt(m[2], 10) });
      else if (t && !t.includes('|')) inTable = false;
    }
  }
  return results;
}

function parseChargesMax(text: string): number | null {
  const m = text.match(/has (\d+) charges?/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

function hasItemProperty(item: InventoryItem, code: string): boolean {
  return (item.properties ?? []).some((p) => String(p).trim().toUpperCase() === code.toUpperCase());
}

function isShieldOrTorch(item: InventoryItem): boolean {
  const type = String(item.type ?? "").toLowerCase();
  const name = String(item.name ?? "").toLowerCase();
  return type.includes("shield") || name.includes("shield") || name.includes("torch");
}

function hasDualWielder(charData: CharacterData | null): boolean {
  return (charData?.chosenOptionals ?? []).some((f) => /dual wield/i.test(f));
}

function canEquipOffhand(item: InventoryItem, charData: CharacterData | null): boolean {
  if (isShieldOrTorch(item)) return true;
  if (!isWeaponItem(item)) return false;
  if (hasItemProperty(item, "L")) return true;
  if (hasDualWielder(charData) && (hasItemProperty(item, "F") || hasItemProperty(item, "V"))) return true;
  return false;
}

function canUseTwoHands(item: InventoryItem): boolean {
  return isWeaponItem(item) && Boolean(item.dmg2);
}

function isMartialWeapon(item: InventoryItem): boolean {
  return hasItemProperty(item, "M");
}

function isRangedWeapon(item: InventoryItem): boolean {
  return /ranged/i.test(item.type ?? "");
}

function isStaffLikeWeapon(item: InventoryItem): boolean {
  const type = String(item.type ?? "").toLowerCase();
  const name = String(item.name ?? "").toLowerCase();
  return type.includes("staff") || name.includes("staff");
}

function defaultWeaponDamageDice(item: InventoryItem, state: "mainhand-1h" | "mainhand-2h" | "offhand"): string | null {
  if (isStaffLikeWeapon(item)) return state === "mainhand-2h" ? "1d8" : "1d6";
  return null;
}

function weaponAbilityMod(item: InventoryItem, char: Character): number {
  const strMod = mod(char.strScore);
  const dexMod = mod(char.dexScore);
  if (hasItemProperty(item, "F")) return Math.max(strMod, dexMod);
  if (isRangedWeapon(item)) return dexMod;
  return strMod;
}

function weaponDamageDice(item: InventoryItem, state: "mainhand-1h" | "mainhand-2h" | "offhand"): string | null {
  if (state === "mainhand-2h") return item.dmg2 ?? item.dmg1 ?? defaultWeaponDamageDice(item, state);
  return item.dmg1 ?? item.dmg2 ?? defaultWeaponDamageDice(item, state);
}

function totalInventoryWeight(items: InventoryItem[]): number {
  return items.reduce((sum, item) => {
    const weight = typeof item.weight === "number" && Number.isFinite(item.weight) ? item.weight : 0;
    const qty = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
    return sum + (weight * Math.max(1, qty));
  }, 0);
}

function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function normalizeClassFeatures(charData: CharacterData | null | undefined): ClassFeatureEntry[] {
  const saved = charData?.classFeatures ?? [];
  if (saved.length > 0) {
    return saved.map((feature) => ({
      id: feature.id || feature.name,
      name: feature.name,
      text: feature.text ?? "",
    }));
  }
  return (charData?.chosenOptionals ?? []).map((name) => ({
    id: name,
    name,
    text: "",
  }));
}

function normalizeResourceKey(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function collectClassResources(classDetail: ClassRestDetail | null, level: number): ResourceCounter[] {
  if (!classDetail) return [];
  const latest = new Map<string, ResourceCounter>();
  for (const autolevel of classDetail.autolevels) {
    if (autolevel.level > level) continue;
    for (const counter of autolevel.counters ?? []) {
      const max = Math.max(0, Math.floor(Number(counter.value) || 0));
      const name = String(counter.name ?? "").trim();
      if (!name || max <= 0) continue;
      const key = normalizeResourceKey(name);
      latest.set(key, {
        key,
        name,
        current: max,
        max,
        reset: String(counter.reset ?? "L").trim().toUpperCase() || "L",
      });
    }
  }
  return Array.from(latest.values());
}

function mergeResourceState(saved: ResourceCounter[] | undefined, derived: ResourceCounter[]): ResourceCounter[] {
  const savedList = Array.isArray(saved) ? saved : [];
  const savedByKey = new Map(savedList.map((resource) => [resource.key || normalizeResourceKey(resource.name), resource]));
  const merged = derived.map((resource) => {
    const existing = savedByKey.get(resource.key);
    return {
      ...resource,
      current: Math.max(0, Math.min(resource.max, Math.floor(Number(existing?.current ?? resource.current) || 0))),
    };
  });
  const derivedKeys = new Set(merged.map((resource) => resource.key));
  const extras = savedList.filter((resource) => !derivedKeys.has(resource.key || normalizeResourceKey(resource.name)));
  return [...merged, ...extras];
}

function shouldResetOnRest(resetCode: string | undefined, restType: "short" | "long"): boolean {
  const code = String(resetCode ?? "").trim().toUpperCase();
  if (restType === "short") return code === "S";
  return code === "S" || code === "L";
}

function hasWeaponProficiency(item: InventoryItem, prof: ProficiencyMap | undefined): boolean {
  const names = (prof?.weapons ?? []).map((w) => w.name.toLowerCase());
  const itemName = item.name.replace(/\s+\[2024\]\s*$/i, "").toLowerCase();
  if (names.some((n) => n === itemName || itemName.includes(n) || n.includes(itemName))) return true;
  if (isMartialWeapon(item) && names.some((n) => n.includes("martial weapon"))) return true;
  if (isWeaponItem(item) && names.some((n) => n.includes("simple weapon"))) return true;
  return false;
}

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function CharacterView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [char, setChar] = useState<Character | null>(null);
  const [classDetail, setClassDetail] = useState<ClassRestDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [hpAmount, setHpAmount] = useState("");
  const [hpSaving, setHpSaving] = useState(false);
  const [hpError, setHpError] = useState<string | null>(null);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const flashRef = useRef<number | null>(null);
  const hpInputRef = useRef<HTMLInputElement>(null);
  const [condPickerOpen, setCondPickerOpen] = useState(false);
  const [condSaving, setCondSaving] = useState(false);
  const [xpPopupOpen, setXpPopupOpen] = useState(false);
  const [xpInput, setXpInput] = useState("");
  const [dsSaving, setDsSaving] = useState(false);
  const [expandedNoteIds, setExpandedNoteIds] = useState<string[]>([]);
  const [expandedClassFeatureIds, setExpandedClassFeatureIds] = useState<string[]>([]);
  const [noteDrawer, setNoteDrawer] = useState<{ scope: "player" | "shared"; note: PlayerNote | null } | null>(null);

  const fetchChar = useCallback(() => {
    if (!id) return;
    api<Character>(`/api/me/characters/${id}`)
      .then(setChar)
      .catch((e) => setError(e?.message ?? "Failed to load character"))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => { fetchChar(); }, [fetchChar]);

  useEffect(() => {
    const classId = char?.characterData?.classId;
    if (!classId) {
      setClassDetail(null);
      return;
    }
    let alive = true;
    api<ClassRestDetail>(`/api/compendium/classes/${classId}`)
      .then((detail) => { if (alive) setClassDetail(detail); })
      .catch(() => { if (alive) setClassDetail(null); });
    return () => { alive = false; };
  }, [char?.characterData?.classId]);

  // Re-fetch whenever the DM changes something in any campaign this character is in
  useWs(useCallback((msg) => {
    if (msg.type !== "players:changed") return;
    const campaignId = (msg.payload as any)?.campaignId as string | undefined;
    if (!campaignId) return;
    // Only reload if this character is actually assigned to that campaign
    setChar((prev) => {
      if (prev?.campaigns.some((c) => c.campaignId === campaignId)) {
        fetchChar();
      }
      return prev; // state unchanged — fetchChar will update it
    });
  }, [fetchChar]));

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;

  const prof = char.characterData?.proficiencies;
  const pb = profBonus(char.level);
  const hd = char.characterData?.hd ?? null;
  const hitDieSize = hd ?? classDetail?.hd ?? null;
  const hitDiceMax = Math.max(0, char.level);
  const hitDiceCurrent = Math.max(0, Math.min(hitDiceMax, Math.floor(Number(char.characterData?.hitDiceCurrent ?? hitDiceMax) || 0)));
  const classResources = mergeResourceState(char.characterData?.resources, collectClassResources(classDetail, char.level));
  const classFeaturesList = normalizeClassFeatures(char.characterData);

  const scores: Record<AbilKey, number | null> = {
    str: char.strScore, dex: char.dexScore, con: char.conScore,
    int: char.intScore, wis: char.wisScore, cha: char.chaScore,
  };

  const accentColor = char.color ?? C.accentHl;
  const overrides = char.overrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
  const effectiveHpMax = Math.max(1, char.hpMax + (overrides.hpMaxBonus ?? 0));
  const xpEarned = char.characterData?.xp ?? 0;
  const xpNeeded = XP_TO_LEVEL[char.level + 1] ?? 0;
  const inventory = char.characterData?.inventory ?? [];
  const shieldBonus = inventory.some((it) => getEquipState(it) === "offhand" && isShieldItem(it)) ? 2 : 0;
  const wornArmor = inventory.find((it) => getEquipState(it) === "worn" && isArmorItem(it) && (it.ac ?? 0) > 0);
  const stealthDisadvantage = Boolean(wornArmor && hasStealthDisadvantage(wornArmor));
  const dexMod = mod(char.dexScore);
  const wornArmorAc = (() => {
    if (!wornArmor || !wornArmor.ac) return null;
    const t = String(wornArmor.type ?? "").toLowerCase();
    if (t.includes("heavy")) return wornArmor.ac;
    if (t.includes("medium")) return wornArmor.ac + Math.min(2, dexMod);
    return wornArmor.ac + dexMod; // light armor
  })();
  const effectiveAc = (wornArmorAc ?? char.ac) + (overrides.acBonus ?? 0) + shieldBonus;
  const tempHp = overrides.tempHp ?? 0;
  const hpPct = effectiveHpMax > 0 ? Math.max(0, Math.min(1, char.hpCurrent / effectiveHpMax)) : 0;
  const tempPct = effectiveHpMax > 0 ? Math.min(1 - hpPct, tempHp / effectiveHpMax) : 0;
  const passivePerc = 10 + mod(char.wisScore) + (prof && isProficientIn(prof.skills, "Perception") ? pb : 0);
  const passiveInv  = 10 + mod(char.intScore) + (prof && isProficientIn(prof.skills, "Investigation") ? pb : 0);

  function rollAndFlash(): number {
    const result = rollDiceExpr(hpAmount.trim());
    if (hasDiceTerm(hpAmount)) {
      setHpAmount(String(result));
      setLastRoll(result);
      if (flashRef.current) window.clearTimeout(flashRef.current);
      flashRef.current = window.setTimeout(() => setLastRoll(null), 1600);
      hpInputRef.current?.focus();
    }
    return result;
  }

  async function applyHp(kind: "damage" | "heal", resolvedAmt?: number) {
    const amt = resolvedAmt ?? rollDiceExpr(hpAmount.trim());
    if (amt <= 0) {
      setHpError("Enter a number > 0  (e.g. 8, 2d6+3, +5)");
      return;
    }
    if (!char) return;
    setHpError(null);
    const newHp = kind === "heal"
      ? Math.min(char.hpCurrent + amt, effectiveHpMax)
      : Math.max(0, char.hpCurrent - amt);
    setHpSaving(true);
    try {
      await api(`/api/me/characters/${char.id}`, jsonInit("PUT", { hpCurrent: newHp }));
      setChar((prev) => prev ? { ...prev, hpCurrent: newHp } : prev);
      setHpAmount("");
      setLastRoll(null);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setHpError(`Failed: ${msg}`);
      console.error("HP update failed:", e);
    } finally {
      setHpSaving(false);
    }
  }

  /** If the expression starts with '+', auto-treat as heal. */
  function resolveKind(explicit: "damage" | "heal"): "damage" | "heal" {
    if (hpAmount.trim().startsWith("+")) return "heal";
    return explicit;
  }

  async function saveXp(value: number) {
    if (!char) return;
    const updated: CharacterData = { ...(char.characterData ?? {}), xp: value };
    await saveCharacterData(updated);
    setXpPopupOpen(false);
  }

  async function saveHitDiceCurrent(nextValue: number) {
    const next = Math.max(0, Math.min(hitDiceMax, Math.floor(nextValue)));
    await saveCharacterData({ ...(char.characterData ?? {}), hitDiceCurrent: next });
  }

  async function saveResources(nextResources: ResourceCounter[]) {
    await saveCharacterData({ ...(char.characterData ?? {}), resources: nextResources });
  }

  async function saveUsedSpellSlots(next: Record<string, number>) {
    await saveCharacterData({ ...(char.characterData ?? {}), usedSpellSlots: next });
  }

  async function savePreparedSpells(next: string[]) {
    await saveCharacterData({ ...(char.characterData ?? {}), preparedSpells: next });
  }

  async function handleItemChargeChange(itemId: string, charges: number) {
    const nextInventory = inventory.map((it) => it.id === itemId ? { ...it, charges } : it);
    await saveCharacterData({ ...(char.characterData ?? {}), inventory: nextInventory });
  }

  async function changeResourceCurrent(key: string, delta: number) {
    const nextResources = classResources.map((resource) =>
      resource.key !== key
        ? resource
        : { ...resource, current: Math.max(0, Math.min(resource.max, resource.current + delta)) }
    );
    await saveResources(nextResources);
  }

  async function handleShortRest() {
    const nextResources = classResources.map((resource) =>
      shouldResetOnRest(resource.reset, "short")
        ? { ...resource, current: resource.max }
        : resource
    );
    // Warlocks reset spell slots on short rest
    const slotsReset = classDetail?.slotsReset ?? "L";
    if (/S/i.test(slotsReset)) {
      await saveCharacterData({ ...(char.characterData ?? {}), resources: nextResources, usedSpellSlots: {} });
    } else {
      await saveResources(nextResources);
    }
  }

  async function handleLongRest() {
    const nextResources = classResources.map((resource) =>
      shouldResetOnRest(resource.reset, "long")
        ? { ...resource, current: resource.max }
        : resource
    );
    const recoveredHitDice = hitDiceMax > 0 ? Math.max(1, Math.floor(hitDiceMax / 2)) : 0;
    const nextHitDice = Math.max(0, Math.min(hitDiceMax, hitDiceCurrent + recoveredHitDice));
    // Reset spell slots on long rest (unless Warlock which uses short rest — checked via slotsReset)
    const slotsReset = classDetail?.slotsReset ?? "L";
    const nextUsedSpellSlots = /S/i.test(slotsReset) ? (char.characterData?.usedSpellSlots ?? {}) : {};

    await api(`/api/me/characters/${char.id}`, jsonInit("PUT", {
      hpCurrent: effectiveHpMax,
      characterData: {
        ...(char.characterData ?? {}),
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
      },
    }));

    const nextDeathSaves = { success: 0, fail: 0 };
    await api(`/api/me/characters/${char.id}/deathSaves`, jsonInit("PATCH", nextDeathSaves));

    setChar((prev) => prev ? {
      ...prev,
      hpCurrent: effectiveHpMax,
      deathSaves: nextDeathSaves,
      characterData: {
        ...prev.characterData,
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
      },
    } : prev);
  }

  async function handleToggleInspiration() {
    if (!char) return;
    const next = !(overrides.inspiration ?? false);
    await api(`/api/me/characters/${char.id}/inspiration`, jsonInit("PATCH", { inspiration: next }));
    setChar((prev) => prev ? { ...prev, overrides: { ...prev.overrides!, inspiration: next } } : prev);
  }

  function handleApplyHp(explicit: "damage" | "heal") {
    const kind = resolveKind(explicit);
    if (hasDiceTerm(hpAmount)) {
      const rolled = rollAndFlash();
      // apply on next tick so the rolled value flashes first
      setTimeout(() => applyHp(kind, rolled), 0);
    } else {
      applyHp(kind);
    }
  }

  async function saveDeathSaves(next: { success: number; fail: number }) {
    if (!char) return;
    setDsSaving(true);
    try {
      await api(`/api/me/characters/${char.id}/deathSaves`, jsonInit("PATCH", next));
      setChar((prev) => prev ? { ...prev, deathSaves: next } : prev);
    } catch (e) {
      console.error("Death saves update failed:", e);
    } finally {
      setDsSaving(false);
    }
  }

  async function toggleCondition(key: string) {
    if (!char) return;
    const current = char.conditions ?? [];
    const has = current.some((c) => c.key === key);
    const next = has ? current.filter((c) => c.key !== key) : [...current, { key }];
    setCondSaving(true);
    try {
      await api(`/api/me/characters/${char.id}/conditions`, jsonInit("PATCH", { conditions: next }));
      setChar((prev) => prev ? { ...prev, conditions: next } : prev);
    } finally { setCondSaving(false); }
  }

  async function saveCharacterData(updatedData: CharacterData) {
    const updated = await api<Character>(`/api/me/characters/${char!.id}`, jsonInit("PUT", {
      name: char!.name,
      characterData: updatedData,
    }));
    setChar((prev) => prev ? { ...prev, characterData: { ...prev.characterData, ...updatedData } } : prev);
    return updated;
  }

  const playerNotesList: PlayerNote[] = char.characterData?.playerNotesList ?? [];
  // Player-owned shared notes (editable)
  const sharedNotesList: PlayerNote[] = (() => {
    if (!char.sharedNotes) return [];
    try { return JSON.parse(char.sharedNotes) as PlayerNote[]; } catch { return []; }
  })();
  // Campaign-level notes from DM — merged into the editable list, player version wins on ID clash
  const campaignNotesList: PlayerNote[] = (() => {
    if (!char.campaignSharedNotes) return [];
    try { return JSON.parse(char.campaignSharedNotes) as PlayerNote[]; } catch { return []; }
  })();
  const playerNoteIds = new Set(sharedNotesList.map((n) => n.id));
  const allSharedNotes: PlayerNote[] = [
    ...campaignNotesList.filter((n) => !playerNoteIds.has(n.id)),
    ...sharedNotesList,
  ];

  async function savePlayerNotesList(list: PlayerNote[]) {
    await saveCharacterData({ playerNotesList: list });
  }

  async function saveClassFeaturesList(list: ClassFeatureEntry[]) {
    await saveCharacterData({
      classFeatures: list,
      chosenOptionals: list.map((feature) => feature.name),
    });
  }

  function saveSharedNotesList(list: PlayerNote[]) {
    // list = the full allSharedNotes after an edit/delete.
    // Persist only player-owned notes; separate out any campaign notes that were edited.
    const val = JSON.stringify(list);
    void api(`/api/me/characters/${char!.id}/sharedNotes`, jsonInit("PATCH", { sharedNotes: val }));
    // Also wipe local campaignSharedNotes so newly-saved player copies win in dedup
    setChar((prev) => prev ? { ...prev, sharedNotes: val, campaignSharedNotes: "[]" } : prev);
  }

  function handleNoteSave(title: string, text: string) {
    if (!noteDrawer) return;
    const { scope, note } = noteDrawer;
    const list = scope === "player" ? playerNotesList : allSharedNotes;
    const updated = note
      ? list.map((n) => n.id === note.id ? { ...n, title, text } : n)
      : [...list, { id: uid(), title, text }];
    if (scope === "player") void savePlayerNotesList(updated);
    else saveSharedNotesList(updated);
    setNoteDrawer(null);
  }

  function handleNoteDelete(scope: "player" | "shared", id: string) {
    const list = scope === "player" ? playerNotesList : allSharedNotes;
    const updated = list.filter((n) => n.id !== id);
    if (scope === "player") void savePlayerNotesList(updated);
    else saveSharedNotesList(updated);
    setExpandedNoteIds((prev) => prev.filter((eid) => eid !== id));
  }

  function toggleNoteExpanded(id: string) {
    setExpandedNoteIds((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    );
  }

  function toggleClassFeatureExpanded(id: string) {
    setExpandedClassFeatureIds((prev) =>
      prev.includes(id) ? prev.filter((eid) => eid !== id) : [...prev, id]
    );
  }

  return (
    <Wrap wide>
      {/* ── 4-column layout ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "flex-start" }}>

        {/* ── COL 1: HUD + Abilities & Saves + Skills + Proficiencies ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        {/* ── Player HUD ─────────────────────────────────────────────── */}
        <Panel>
        {/* Top row: portrait + info + edit */}
        <div style={{ display: "flex", gap: 14, alignItems: "flex-start", marginBottom: 14 }}>
          <div style={{
            width: 72, height: 72, borderRadius: 12, flexShrink: 0,
            background: `${accentColor}22`, border: `2px solid ${accentColor}66`,
            overflow: "hidden", display: "flex", alignItems: "center", justifyContent: "center",
          }}>
            {char.imageUrl
              ? <img src={char.imageUrl} alt={char.name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
              : <IconPlayer size={36} style={{ opacity: 0.35 }} />}
          </div>
          <div style={{ flex: 1, minWidth: 0 }}>
            <h1 style={{ margin: "0 0 2px", fontSize: 22, fontWeight: 900, letterSpacing: -0.5, color: C.text }}>
              {char.name}
            </h1>
            <div style={{ fontSize: 13, color: C.muted, marginBottom: 3 }}>
              {[char.className, char.characterData?.subclass, char.species].filter(Boolean).join(" · ")}
              <span style={{ marginLeft: 10, color: accentColor, fontWeight: 700, fontSize: 12 }}>Level {char.level}</span>
            </div>
            {char.playerName && (
              <div style={{ fontSize: 11, color: "rgba(160,180,220,0.45)", marginBottom: 3 }}>Player: {char.playerName}</div>
            )}
            {char.campaigns.length > 0 && (
              <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                {char.campaigns.map((c) => (
                  <span key={c.id} style={{
                    fontSize: 11, padding: "2px 8px", borderRadius: 20, fontWeight: 600,
                    background: `${accentColor}18`, border: `1px solid ${accentColor}44`, color: accentColor,
                  }}>{c.campaignName}</span>
                ))}
                {xpNeeded > 0 && (
                  <div style={{ position: "relative", marginLeft: "auto" }}>
                    <button
                      onClick={() => { setXpInput(String(xpEarned)); setXpPopupOpen((o) => !o); }}
                      style={{
                        background: "none", border: "none", cursor: "pointer", padding: "2px 4px",
                        fontSize: 11, fontWeight: 700, color: "#fff", borderRadius: 6,
                        display: "flex", alignItems: "center", gap: 3,
                      }}
                    >
                      {xpEarned.toLocaleString()} / {xpNeeded.toLocaleString()} xp
                    </button>
                    {xpPopupOpen && (
                      <div style={{
                        position: "absolute", top: "calc(100% + 6px)", right: 0, zIndex: 100,
                        background: "#1e2030", border: "1px solid rgba(255,255,255,0.15)", borderRadius: 10,
                        padding: "12px 14px", minWidth: 200, boxShadow: "0 8px 24px rgba(0,0,0,0.5)",
                        display: "flex", flexDirection: "column", gap: 8,
                      }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, marginBottom: 2 }}>Edit XP</div>
                        <div style={{ display: "flex", gap: 6 }}>
                          <input
                            autoFocus
                            type="number"
                            min={0}
                            value={xpInput}
                            onChange={(e) => setXpInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { const v = parseInt(xpInput, 10); if (!isNaN(v) && v >= 0) saveXp(v); }
                              if (e.key === "Escape") setXpPopupOpen(false);
                            }}
                            style={{
                              flex: 1, padding: "6px 8px", borderRadius: 6, fontSize: 13, fontWeight: 700,
                              border: "1px solid rgba(255,255,255,0.15)", background: "rgba(255,255,255,0.07)",
                              color: C.text, outline: "none", textAlign: "center",
                            }}
                          />
                          <button
                            onClick={() => { const v = parseInt(xpInput, 10); if (!isNaN(v) && v >= 0) saveXp(v); }}
                            style={{
                              padding: "6px 12px", borderRadius: 6, cursor: "pointer", fontSize: 12, fontWeight: 700,
                              background: accentColor, border: "none", color: "#fff",
                            }}
                          >Save</button>
                        </div>
                        <div style={{ display: "flex", gap: 5 }}>
                          {[50, 100, 200, 300].map((amt) => (
                            <button key={amt} onClick={() => { const v = xpEarned + amt; setXpInput(String(v)); saveXp(v); }} style={{
                              flex: 1, padding: "4px 0", borderRadius: 5, cursor: "pointer", fontSize: 10, fontWeight: 700,
                              background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.1)", color: C.muted,
                            }}>+{amt}</button>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
            {xpEarned >= xpNeeded && xpNeeded > 0 && (
              <button onClick={() => navigate(`/characters/${char.id}/levelup`)} style={{
                padding: "7px 14px", borderRadius: 8, cursor: "pointer",
                background: `${accentColor}22`, border: `1px solid ${accentColor}88`,
                color: accentColor, fontWeight: 700, fontSize: 12,
              }}>⬆ Level Up</button>
            )}
            <button onClick={() => navigate(`/characters/${char.id}/edit`)} style={{
              padding: "7px 11px", borderRadius: 8, cursor: "pointer",
              background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.16)",
              color: C.muted, fontWeight: 600, fontSize: 15,
            }}>✎</button>
          </div>
        </div>

        {/* HP bar */}
        <div style={{ height: 32, borderRadius: 8, background: "rgba(255,255,255,0.07)", border: "1px solid rgba(255,255,255,0.12)", overflow: "hidden", position: "relative", marginBottom: 8 }}>
          <div style={{ position: "absolute", inset: 0, right: `${(1 - hpPct) * 100}%`, background: hpPct > 0.5 ? C.green : hpPct > 0.25 ? "#f59e0b" : C.red, borderRadius: 8, transition: "right 0.3s, background 0.3s" }} />
          {tempHp > 0 && tempPct > 0 && (
            <div style={{ position: "absolute", top: 0, bottom: 0, left: `${hpPct * 100}%`, width: `${tempPct * 100}%`, background: "#f59e0b", opacity: 0.7 }} />
          )}
          <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 15, fontWeight: 800, color: "#fff", textShadow: "0 1px 3px rgba(0,0,0,0.6)", gap: 4 }}>
            <IconHeart size={11} style={{ opacity: 0.8 }} />
            {char.hpCurrent} / {effectiveHpMax}
            {tempHp > 0 && <span style={{ fontSize: 11, color: "#fff", fontWeight: 700 }}>+{tempHp} temp</span>}
            {(overrides.hpMaxBonus ?? 0) !== 0 && <span style={{ fontSize: 10, color: "#f59e0b" }}>(max {(overrides.hpMaxBonus ?? 0) > 0 ? "+" : ""}{overrides.hpMaxBonus})</span>}
          </div>
        </div>

        {/* HP actions — Combat HUD */}
        <style>{`
          @keyframes playerHexPulse {
            0%   { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
            50%  { filter: drop-shadow(0 0 10px rgba(255,255,255,0.10)); }
            100% { filter: drop-shadow(0 0 0 rgba(0,0,0,0)); }
          }
          @keyframes playerRollFlash {
            0%   { color: #fbbf24; transform: scale(1.1); }
            60%  { color: #fbbf24; transform: scale(1.1); }
            100% { color: inherit; transform: scale(1); }
          }
        `}</style>
        <div style={{ display: "flex", flexDirection: "column", gap: 6, marginBottom: 14 }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 10, padding: "10px 8px", borderRadius: 14, border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.03)" }}>
            {/* Inspiration hex */}
            <HexBtn variant="inspiration" active={overrides.inspiration ?? false} title="Toggle Heroic Inspiration" disabled={false} onClick={handleToggleInspiration}>
              <IconInspiration size={22} />
            </HexBtn>

            {/* Damage hex */}
            <HexBtn variant="damage" title="Apply damage (Enter)" disabled={hpSaving} onClick={() => handleApplyHp("damage")}>
              <IconAttack size={22} />
            </HexBtn>

            {/* Amount input */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 2, flex: 1, minWidth: 0 }}>
              <input
                ref={hpInputRef}
                value={hpAmount}
                onChange={(e) => {
                  setHpError(null);
                  setLastRoll(null);
                  setHpAmount(e.target.value.replace(/[^0-9dD+\-]/g, ""));
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    handleApplyHp(e.shiftKey ? "heal" : "damage");
                  }
                  if (e.key === "Escape") { setHpAmount(""); setHpError(null); setLastRoll(null); }
                }}
                placeholder="1d6+2 / +10"
                inputMode="text"
                style={{
                  width: "100%", textAlign: "center",
                  padding: "10px 12px", borderRadius: 12,
                  border: `1px solid ${hpError ? C.red + "88" : "rgba(255,255,255,0.1)"}`,
                  background: "rgba(255,255,255,0.05)",
                  color: C.text, fontWeight: 900, fontSize: 17, outline: "none",
                  animation: lastRoll !== null ? "playerRollFlash 1.6s ease forwards" : "none",
                }}
              />
              <span style={{ fontSize: 10, color: C.muted, minHeight: 14 }}>
                {lastRoll !== null
                  ? `rolled ${lastRoll}`
                  : hd !== null
                    ? `HD: ${char.level}d${hd}`
                    : ""}
              </span>
            </div>

            {/* Heal hex */}
            <HexBtn variant="heal" title="Apply heal (Shift+Enter)" disabled={hpSaving} onClick={() => handleApplyHp("heal")}>
              <IconHeal size={22} />
            </HexBtn>

            {/* Conditions hex */}
            <HexBtn variant="conditions" title="Add / remove conditions" disabled={false} onClick={() => setCondPickerOpen((o) => !o)}>
              <IconConditions size={22} />
            </HexBtn>
          </div>

          {/* Error / saving feedback */}
          {(hpError || hpSaving) && (
            <div style={{ textAlign: "center", fontSize: 11, color: hpError ? C.red : C.muted }}>
              {hpError ?? "Saving…"}
            </div>
          )}
        </div>

        {/* Death Saving Throws — only when at 0 HP */}
        {char.hpCurrent === 0 && (
          <div style={{
            margin: "4px 0 10px",
            padding: "10px 14px",
            borderRadius: 10,
            background: "rgba(220,38,38,0.08)",
            border: "1px solid rgba(220,38,38,0.35)",
          }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
              <span style={{ fontSize: 10, fontWeight: 900, color: C.red, textTransform: "uppercase", letterSpacing: "0.1em" }}>
                Death Saving Throws
              </span>
              {dsSaving && <span style={{ fontSize: 9, color: C.muted }}>saving…</span>}
            </div>
            <div style={{ display: "flex", gap: 20, alignItems: "center" }}>
              {/* Successes */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: "#4ade80", textTransform: "uppercase", letterSpacing: "0.06em" }}>Success</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map((i) => {
                    const filled = i < (char.deathSaves?.success ?? 0);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={dsSaving}
                        onClick={() => {
                          const cur = char.deathSaves?.success ?? 0;
                          const next = cur > i ? i : i + 1;
                          saveDeathSaves({ success: Math.min(3, next), fail: char.deathSaves?.fail ?? 0 });
                        }}
                        style={{
                          width: 22, height: 22, borderRadius: "50%",
                          border: `2px solid ${filled ? "#4ade80" : "rgba(74,222,128,0.3)"}`,
                          background: filled ? "#4ade80" : "transparent",
                          cursor: dsSaving ? "default" : "pointer",
                          padding: 0,
                          transition: "all 120ms",
                        }}
                      />
                    );
                  })}
                </div>
              </div>

              {/* Skull divider */}
              <span style={{ fontSize: 18, opacity: 0.4 }}>💀</span>

              {/* Failures */}
              <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 5 }}>
                <span style={{ fontSize: 9, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.06em" }}>Failure</span>
                <div style={{ display: "flex", gap: 6 }}>
                  {[0, 1, 2].map((i) => {
                    const filled = i < (char.deathSaves?.fail ?? 0);
                    return (
                      <button
                        key={i}
                        type="button"
                        disabled={dsSaving}
                        onClick={() => {
                          const cur = char.deathSaves?.fail ?? 0;
                          const next = cur > i ? i : i + 1;
                          saveDeathSaves({ success: char.deathSaves?.success ?? 0, fail: Math.min(3, next) });
                        }}
                        style={{
                          width: 22, height: 22, borderRadius: "50%",
                          border: `2px solid ${filled ? C.red : "rgba(220,38,38,0.3)"}`,
                          background: filled ? C.red : "transparent",
                          cursor: dsSaving ? "default" : "pointer",
                          padding: 0,
                          transition: "all 120ms",
                        }}
                      />
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Status line */}
            {(char.deathSaves?.success ?? 0) >= 3 && (
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: "#4ade80", textAlign: "center" }}>
                ✦ Stable — character has stabilised
              </div>
            )}
            {(char.deathSaves?.fail ?? 0) >= 3 && (
              <div style={{ marginTop: 8, fontSize: 11, fontWeight: 700, color: C.red, textAlign: "center" }}>
                ✦ Dead
              </div>
            )}
          </div>
        )}

        {/* Active conditions — hidden when none */}
        {(char.conditions ?? []).length > 0 && (
          <div style={{ marginTop: 2 }}>
            <div style={{ fontSize: 10, fontWeight: 700, color: C.red, textTransform: "uppercase", letterSpacing: "0.08em", marginBottom: 6, display: "flex", alignItems: "center", gap: 5 }}>
              <IconConditions size={10} /> Conditions
              {condSaving && <span style={{ color: C.muted, fontWeight: 400, textTransform: "none", fontSize: 9 }}>saving…</span>}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {(char.conditions ?? []).map((cond, i) => (
                <span key={i} style={{
                  fontSize: 12, fontWeight: 700, padding: "4px 6px 4px 8px", borderRadius: 6,
                  background: `${C.red}18`, border: `1px solid ${C.red}44`, color: C.red,
                  textTransform: "capitalize", display: "inline-flex", alignItems: "center", gap: 5,
                }}>
                  <IconConditionByKey condKey={cond.key} size={12} style={{ opacity: 0.85, flexShrink: 0 }} />
                  {conditionDisplayLabel(cond)}
                  <button onClick={() => toggleCondition(cond.key)} style={{
                    border: "none", background: "transparent", color: C.red,
                    cursor: "pointer", fontSize: 15, lineHeight: 1, padding: 0,
                    display: "inline-flex", alignItems: "center",
                  }}>×</button>
                </span>
              ))}
            </div>
          </div>
        )}

        </Panel>

      {/* ── Condition picker drawer (fixed overlay) ───────────────────────── */}
      {condPickerOpen && (
        <>
          {/* Backdrop */}
          <div
            onClick={() => setCondPickerOpen(false)}
            style={{ position: "fixed", inset: 0, zIndex: 900, background: "rgba(0,0,0,0.45)" }}
          />
          {/* Drawer panel */}
          <div style={{
            position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 901,
            width: "min(340px, 90vw)",
            background: "#0e1220",
            borderLeft: "1px solid rgba(255,255,255,0.12)",
            display: "flex", flexDirection: "column",
            boxShadow: "-8px 0 30px rgba(0,0,0,0.5)",
          }}>
            {/* Drawer header */}
            <div style={{
              padding: "18px 20px 14px",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              display: "flex", alignItems: "center", justifyContent: "space-between",
            }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <IconConditions size={16} style={{ color: "#f59e0b" }} />
                <span style={{ fontWeight: 900, fontSize: 13, letterSpacing: "0.08em", textTransform: "uppercase", color: "#f59e0b" }}>
                  Conditions
                </span>
                {condSaving && <span style={{ fontSize: 10, color: C.muted }}>saving…</span>}
              </div>
              <button
                onClick={() => setCondPickerOpen(false)}
                style={{
                  background: "transparent", border: "1px solid rgba(255,255,255,0.16)",
                  borderRadius: 6, color: C.muted, cursor: "pointer",
                  padding: "4px 10px", fontSize: 12, fontWeight: 700,
                }}
              >
                Close
              </button>
            </div>

            {/* Condition grid */}
            <div style={{ flex: 1, overflowY: "auto", padding: "16px 14px" }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                {CONDITIONS.map((cd) => {
                  const active = (char.conditions ?? []).some((c) => c.key === cd.key);
                  return (
                    <button
                      key={cd.key}
                      onClick={() => toggleCondition(cd.key)}
                      disabled={condSaving}
                      style={{
                        display: "flex", flexDirection: "column", alignItems: "center", gap: 5,
                        padding: "10px 6px", borderRadius: 8,
                        background: active ? `${C.red}22` : "rgba(255,255,255,0.04)",
                        border: `1px solid ${active ? C.red + "77" : "rgba(255,255,255,0.10)"}`,
                        color: active ? C.red : C.muted,
                        cursor: condSaving ? "wait" : "pointer",
                        transition: "all 120ms",
                        outline: "none",
                      }}
                    >
                      <IconConditionByKey condKey={cd.key} size={22} style={{ opacity: active ? 1 : 0.5 }} />
                      <span style={{ fontSize: 10, fontWeight: 700, textAlign: "center", lineHeight: 1.2 }}>
                        {cd.name}
                      </span>
                      {active && (
                        <span style={{ fontSize: 9, color: C.red, fontWeight: 900, letterSpacing: "0.04em" }}>ACTIVE</span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </>
      )}

          {/* Ability Scores + Saving Throws (combined) */}
          <Panel>
            <PanelTitle color={accentColor}>Abilities &amp; Saves</PanelTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 18, rowGap: 8, width: "100%" }}>
            {(["str", "dex", "con"] as AbilKey[]).flatMap((leftKey, i) => {
              const rightKey = (["int", "wis", "cha"] as AbilKey[])[i];
              return ([leftKey, rightKey] as AbilKey[]).map((k) => {
                    const score = scores[k];
                    const m = mod(score);
                    const isProfSave = prof ? isProficientIn(prof.saves, ABILITY_FULL[k]) : false;
                    const save = m + (isProfSave ? pb : 0);
                    return (
                      <div key={k} style={{ minWidth: 0 }}>
                        <div style={{ display: "grid", gridTemplateColumns: "44px minmax(56px, 1fr) 40px 40px", columnGap: 10, alignItems: "center" }}>
                        <div style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.08em", textTransform: "uppercase", color: isProfSave ? accentColor : C.muted }}>
                          {ABILITY_LABELS[k]}
                        </div>
                        <div style={{ padding: "8px 2px", borderRadius: 7, background: "rgba(255,255,255,0.06)", border: `1px solid ${isProfSave ? accentColor + "55" : "rgba(255,255,255,0.10)"}`, textAlign: "center", fontSize: 14, fontWeight: 900, color: isProfSave ? accentColor : C.text }}>
                          {score ?? "—"}
                        </div>
                        <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center", color: C.text }}>{fmtMod(m)}</div>
                        <div style={{ fontSize: 13, fontWeight: 700, textAlign: "center", color: isProfSave ? accentColor : C.text, position: "relative" }}>
                          {fmtMod(save)}
                          {isProfSave && <span style={{ position: "absolute", top: -2, right: 0, width: 5, height: 5, borderRadius: "50%", background: accentColor }} />}
                        </div>
                        </div>
                      </div>
                    );
                  });
            })}
            </div>
          </Panel>

          {/* Skills */}
          <Panel>
            <PanelTitle color={accentColor}>Skills</PanelTitle>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", columnGap: 18, rowGap: 2 }}>
              {ALL_SKILLS.map(({ name, abil }) => {
                const isProfSkill = prof ? isProficientIn(prof.skills, name) : false;
                const bonus = mod(scores[abil]) + (isProfSkill ? pb : 0);
                const src = prof?.skills.find((s) => s.name.toLowerCase() === name.toLowerCase())?.source;
                const showStealthDisadvantage = name === "Stealth" && stealthDisadvantage;
                return (
                  <div key={name} style={{
                    display: "flex", alignItems: "center", gap: 6,
                    padding: "3px 4px", borderRadius: 4,
                    minWidth: 0,
                  }}>
                    <ProfDot filled={isProfSkill} color={C.green} />
                    <span style={{
                      fontSize: 9, fontWeight: 700, color: "rgba(160,180,220,0.45)",
                      letterSpacing: "0.04em", width: 24, textAlign: "center",
                    }}>
                      {ABILITY_LABELS[abil]}
                    </span>
                    <span style={{
                      fontSize: 12, color: isProfSkill ? C.text : C.muted,
                      flex: 1, fontWeight: isProfSkill ? 600 : 400,
                      display: "flex", alignItems: "center", gap: 6, minWidth: 0,
                    }}>
                      <span style={{ minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{name}</span>
                      {showStealthDisadvantage && (
                        <span
                          title="Disadvantage on Stealth checks from equipped armor"
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
                            flexShrink: 0,
                          }}
                        >
                          D
                        </span>
                      )}
                    </span>
                    <span style={{
                      fontSize: 13, fontWeight: 700, minWidth: 26, textAlign: "right",
                      color: showStealthDisadvantage ? "#f87171" : isProfSkill ? C.green : C.text,
                    }}>
                      {isProfSkill && src
                        ? <Tooltip text={src}>{fmtMod(bonus)}</Tooltip>
                        : fmtMod(bonus)
                      }
                    </span>
                  </div>
                );
              })}
            </div>
          </Panel>

          {/* Proficiencies & Languages */}
          {prof && (() => {
            const sections = [
              { label: "Armor",     items: prof.armor,     color: "#a78bfa" },
              { label: "Weapons",   items: prof.weapons,   color: "#f87171" },
              { label: "Tools",     items: prof.tools,     color: "#fb923c" },
              { label: "Languages", items: prof.languages, color: "#60a5fa" },
            ].filter((s) => s.items.length > 0);
            if (!sections.length) return null;
            return (
              <Panel>
                <PanelTitle color={accentColor}>Proficiencies &amp; Languages</PanelTitle>
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  {sections.map((s) => (
                    <div key={s.label}>
                      <div style={{ fontSize: 10, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 5 }}>
                        {s.label}
                      </div>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 4 }}>
                        {s.items.map((item, i) => (
                          <Tooltip key={i} text={item.source}>
                            <span style={{
                              fontSize: 12, padding: "3px 9px", borderRadius: 5, cursor: "default",
                              background: s.color + "18", border: `1px solid ${s.color}44`,
                              color: s.color, fontWeight: 600,
                            }}>
                              {item.name}
                            </span>
                          </Tooltip>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </Panel>
            );
          })()}

        </div>
        {/* end COL 1 */}

        {/* ── COL 2: Actions + Spells & Invocations ────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          {/* Combat Stats */}
          <Panel>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(6, 1fr)", gap: 6 }}>
              <MiniStat
                label="Armor Class"
                value={String(effectiveAc)}
                accent={accentColor} icon={<IconShield size={11} />}
              />
              <MiniStat label="Speed" value={`${char.speed} ft`} icon={<IconSpeed size={11} />} />
              <MiniStat label="Initiative" value={fmtMod(mod(char.dexScore))} accent={accentColor} icon={<IconInitiative size={11} />} />
              <MiniStat label="Prof. Bonus" value={`+${pb}`} accent={accentColor} />
              <MiniStat label="Passive Perc." value={String(passivePerc)} />
              <MiniStat label="Passive Inv." value={String(passiveInv)} />
            </div>
          </Panel>

          {/* Actions */}
          {(() => {
            const inventory: InventoryItem[] = ((char.characterData?.inventory ?? []) as InventoryItem[]).map((item) => ({
              ...item, equipState: getEquipState(item), properties: item.properties ?? [],
            }));
            const actionItems = inventory.filter((it) => getEquipState(it) !== "backpack" && isWeaponItem(it));
            const strMod = mod(char.strScore);
            const unarmedToHit = strMod + pb;
            const unarmedDmg = 1 + strMod;
            return (
              <Panel>
                <PanelTitle color={accentColor}>Actions</PanelTitle>
                <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", marginBottom: 6 }}>
                  {(["ATTACK", "RANGE", "HIT / DC", "DAMAGE / NOTES"] as const).map((h) => (
                    <div key={h} style={{ fontSize: 10, fontWeight: 900, letterSpacing: "0.07em", textTransform: "uppercase", color: C.muted, paddingBottom: 4, borderBottom: `1px solid rgba(255,255,255,0.08)` }}>{h}</div>
                  ))}
                </div>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  {actionItems.map((it) => {
                    const state = getEquipState(it);
                    const attackState = state === "mainhand-2h" ? "mainhand-2h" : state === "offhand" ? "offhand" : "mainhand-1h";
                    const dmg = weaponDamageDice(it, attackState);
                    const ability = weaponAbilityMod(it, char);
                    const proficient = hasWeaponProficiency(it, prof);
                    const toHit = ability + (proficient ? pb : 0);
                    const damageAbility = attackState === "offhand" && !addsAbilityModToOffhandDamage(it, char.characterData)
                      ? 0
                      : ability;
                    const damageType = formatItemDamageType(it.dmgType);
                    const props = formatItemProperties(it.properties);
                    const isReach = hasItemProperty(it, "R");
                    const rangeLabel = isRangedWeapon(it)
                      ? (it.properties?.find((p) => /^\d/.test(p)) ?? "Range")
                      : `${isReach ? "10" : "5"} ft.`;
                    const dmgText = dmg ? `${dmg}${damageAbility === 0 ? "" : `${damageAbility >= 0 ? "+" : ""}${damageAbility}`}${damageType ? ` ${damageType}` : ""}` : "—";
                    const modeLabel = attackState === "mainhand-2h" ? "2H" : attackState === "offhand" ? "Offhand" : null;
                    return (
                      <div key={`${it.id}:${attackState}`} style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", alignItems: "center", padding: "6px 0", borderBottom: `1px solid rgba(255,255,255,0.05)` }}>
                        <div style={{ minWidth: 0 }}>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 13, fontWeight: 800, color: C.text, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{it.name}</span>
                            {modeLabel && <span style={{ fontSize: 9, fontWeight: 800, color: accentColor, border: `1px solid ${accentColor}44`, background: `${accentColor}18`, borderRadius: 999, padding: "1px 5px" }}>{modeLabel}</span>}
                            {!proficient && <span style={{ fontSize: 10, color: C.red, fontWeight: 700 }}>No proficiency</span>}
                          </div>
                          <div style={{ fontSize: 10, color: C.muted }}>{isWeaponItem(it) ? "Melee Weapon" : it.type ?? ""}</div>
                        </div>
                        <div style={{ fontSize: 12, color: C.muted, textAlign: "center", whiteSpace: "nowrap" }}>{rangeLabel}</div>
                        <div style={{ fontSize: 18, fontWeight: 900, color: C.text, textAlign: "center", minWidth: 36,
                          border: `1px solid ${proficient ? accentColor + "55" : "rgba(255,255,255,0.15)"}`,
                          borderRadius: 8, padding: "3px 6px", background: "rgba(255,255,255,0.04)" }}>
                          {fmtMod(toHit)}
                        </div>
                        <div>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{dmgText}</div>
                          {props && <div style={{ fontSize: 11, color: C.muted }}>{props}</div>}
                        </div>
                      </div>
                    );
                  })}
                  {/* Unarmed Strike */}
                  <div style={{ display: "grid", gridTemplateColumns: "minmax(0,1fr) auto auto minmax(0,1fr)", gap: "0 8px", alignItems: "center", padding: "6px 0" }}>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 800, color: C.text }}>Unarmed Strike</div>
                      <div style={{ fontSize: 10, color: C.muted }}>Melee Attack</div>
                    </div>
                    <div style={{ fontSize: 12, color: C.muted, textAlign: "center", whiteSpace: "nowrap" }}>5 ft.</div>
                    <div style={{ fontSize: 18, fontWeight: 900, color: C.text, textAlign: "center", minWidth: 36,
                      border: "1px solid rgba(255,255,255,0.15)", borderRadius: 8, padding: "3px 6px", background: "rgba(255,255,255,0.04)" }}>
                      {fmtMod(unarmedToHit)}
                    </div>
                    <div>
                      <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{unarmedDmg}</div>
                      <div style={{ fontSize: 11, color: C.muted }}>Bludgeoning</div>
                    </div>
                  </div>
                </div>
              </Panel>
            );
          })()}

          {/* Item Spells */}
          <ItemSpellsPanel
            items={inventory}
            pb={pb}
            intScore={char.intScore}
            wisScore={char.wisScore}
            chaScore={char.chaScore}
            accentColor={accentColor}
            onChargeChange={handleItemChargeChange}
          />
          {/* Known / Prepared spells — rich table with inline slots */}
          {prof && prof.spells.length > 0 && (
            <RichSpellsPanel
              spells={prof.spells}
              pb={pb}
              intScore={char.intScore}
              wisScore={char.wisScore}
              chaScore={char.chaScore}
              accentColor={accentColor}
              classDetail={classDetail}
              charLevel={char.level}
              usedSpellSlots={char.characterData?.usedSpellSlots ?? {}}
              preparedSpells={char.characterData?.preparedSpells ?? []}
              onSlotsChange={saveUsedSpellSlots}
              onPreparedChange={savePreparedSpells}
            />
          )}

          {/* Invocations — keep as pills */}
          {prof && prof.invocations.length > 0 && (
            <Panel>
              <PanelTitle color="#a78bfa">Eldritch Invocations</PanelTitle>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                {prof.invocations.map((inv, i) => (
                  <Tooltip key={i} text={inv.source}>
                    <span style={{
                      fontSize: 12, fontWeight: 600, padding: "3px 9px", borderRadius: 6, cursor: "default",
                      background: "rgba(251,146,60,0.14)", border: "1px solid rgba(251,146,60,0.35)", color: "#fb923c",
                    }}>{inv.name}</span>
                  </Tooltip>
                ))}
              </div>
            </Panel>
          )}

        </div>
        {/* end COL 2 */}

        {/* ── COL 3: Inventory ─────────────────────────────────────────── */}
        <div>
          <InventoryPanel
            char={char}
            charData={char.characterData}
            accentColor={accentColor}
            onSave={saveCharacterData}
          />
        </div>
        {/* end COL 3 */}

        {/* ── COL 4: Everything Else ───────────────────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <Panel>
            <PanelTitle color={accentColor}>Recovery</PanelTitle>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{
                display: "grid",
                gridTemplateColumns: classResources.length > 0 ? "minmax(0,1fr) auto auto" : "minmax(0,1fr) auto",
                gap: 10,
                alignItems: "center",
              }}>
                <div style={{
                  padding: "10px 12px",
                  borderRadius: 10,
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.08)",
                }}>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 4 }}>
                    Hit Dice
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10, justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 19, fontWeight: 900, color: C.text }}>
                        {hitDiceCurrent} / {hitDiceMax}
                      </div>
                      {hitDieSize != null && (
                        <div style={{ fontSize: 11, color: C.muted }}>
                          d{hitDieSize} pool
                        </div>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => void saveHitDiceCurrent(hitDiceCurrent - 1)}
                        disabled={hitDiceCurrent <= 0}
                        style={miniPillBtn(hitDiceCurrent > 0)}
                      >
                        -
                      </button>
                      <button
                        type="button"
                        onClick={() => void saveHitDiceCurrent(hitDiceCurrent + 1)}
                        disabled={hitDiceCurrent >= hitDiceMax}
                        style={miniPillBtn(hitDiceCurrent < hitDiceMax)}
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => void handleShortRest()}
                  style={restBtnStyle("#60a5fa")}
                >
                  Short Rest
                </button>
                <button
                  type="button"
                  onClick={() => void handleLongRest()}
                  style={restBtnStyle("#34d399")}
                >
                  Long Rest
                </button>
              </div>

              {classResources.length > 0 && (
                <div>
                  <div style={{ fontSize: 10, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 6 }}>
                    Resources
                  </div>
                  <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                    {classResources.map((resource) => (
                      <div
                        key={resource.key}
                        style={{
                          display: "grid",
                          gridTemplateColumns: "minmax(0,1fr) auto auto auto",
                          gap: 8,
                          alignItems: "center",
                          padding: "8px 10px",
                          borderRadius: 8,
                          background: "rgba(255,255,255,0.03)",
                          border: "1px solid rgba(255,255,255,0.06)",
                        }}
                      >
                        <div style={{ minWidth: 0 }}>
                          <div style={{ fontSize: 13, fontWeight: 700, color: C.text }}>{resource.name}</div>
                          <div style={{ fontSize: 10, color: C.muted }}>
                            {resource.reset === "S" ? "Resets on Short Rest" : resource.reset === "L" ? "Resets on Long Rest" : `Reset ${resource.reset}`}
                          </div>
                        </div>
                        <button
                          type="button"
                          onClick={() => void changeResourceCurrent(resource.key, -1)}
                          disabled={resource.current <= 0}
                          style={miniPillBtn(resource.current > 0)}
                        >
                          -
                        </button>
                        <div style={{ fontSize: 14, fontWeight: 800, color: C.text, minWidth: 52, textAlign: "center" }}>
                          {resource.current} / {resource.max}
                        </div>
                        <button
                          type="button"
                          onClick={() => void changeResourceCurrent(resource.key, 1)}
                          disabled={resource.current >= resource.max}
                          style={miniPillBtn(resource.current < resource.max)}
                        >
                          +
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </Panel>

          {/* Player Notes */}
          <Panel>
            <PanelTitle color={accentColor} actions={
              <button
                type="button"
                onClick={() => setNoteDrawer({ scope: "player", note: null })}
                title="Add note"
                style={panelHeaderAddBtn(accentColor)}
              >
                +
              </button>
            }>Player Notes</PanelTitle>
            {playerNotesList.length ? (
              <DraggableList
                items={playerNotesList}
                expandedIds={expandedNoteIds}
                onSelect={(id) => toggleNoteExpanded(id)}
                onReorder={(ids) => {
                  const byId = Object.fromEntries(playerNotesList.map((n) => [n.id, n]));
                  void savePlayerNotesList(ids.map((id) => byId[id]).filter(Boolean));
                }}
                renderItem={(it) => {
                  const note = playerNotesList.find((n) => n.id === it.id)!;
                  return (
                    <NoteItem
                      note={note}
                      expanded={expandedNoteIds.includes(it.id)}
                      accentColor={accentColor}
                      onToggle={() => toggleNoteExpanded(it.id)}
                      onEdit={() => setNoteDrawer({ scope: "player", note })}
                      onDelete={() => handleNoteDelete("player", it.id)}
                    />
                  );
                }}
              />
            ) : (
              <div style={{ color: C.muted, fontSize: 12 }}>No notes yet.</div>
            )}
          </Panel>

          {/* Shared Notes */}
          <Panel>
            <PanelTitle color={accentColor} actions={
              <button
                type="button"
                onClick={() => setNoteDrawer({ scope: "shared", note: null })}
                title="Add shared note"
                style={panelHeaderAddBtn(accentColor)}
              >
                +
              </button>
            }>Shared Notes</PanelTitle>
            {allSharedNotes.length ? (
              <DraggableList
                items={allSharedNotes}
                expandedIds={expandedNoteIds}
                onSelect={(id) => toggleNoteExpanded(id)}
                onReorder={(ids) => {
                  const byId = Object.fromEntries(allSharedNotes.map((n) => [n.id, n]));
                  saveSharedNotesList(ids.map((id) => byId[id]).filter(Boolean));
                }}
                renderItem={(it) => {
                  const note = allSharedNotes.find((n) => n.id === it.id)!;
                  return (
                    <NoteItem
                      note={note}
                      expanded={expandedNoteIds.includes(it.id)}
                      accentColor={C.green}
                      onToggle={() => toggleNoteExpanded(it.id)}
                      onEdit={() => setNoteDrawer({ scope: "shared", note })}
                      onDelete={() => handleNoteDelete("shared", it.id)}
                    />
                  );
                }}
              />
            ) : (
              <div style={{ color: C.muted, fontSize: 12 }}>No notes yet.</div>
            )}
          </Panel>

          {/* Class Features */}
          {classFeaturesList.length > 0 && (
            <Panel>
              <PanelTitle color={accentColor}>Class Features</PanelTitle>
              <DraggableList
                items={classFeaturesList}
                expandedIds={expandedClassFeatureIds}
                onSelect={(id) => toggleClassFeatureExpanded(id)}
                onReorder={(ids) => {
                  const byId = Object.fromEntries(classFeaturesList.map((feature) => [feature.id, feature]));
                  void saveClassFeaturesList(ids.map((id) => byId[id]).filter(Boolean));
                }}
                renderItem={(it) => {
                  const feature = classFeaturesList.find((entry) => entry.id === it.id)!;
                  return (
                    <ClassFeatureItem
                      feature={feature}
                      expanded={expandedClassFeatureIds.includes(it.id)}
                      accentColor={accentColor}
                      onToggle={() => toggleClassFeatureExpanded(it.id)}
                    />
                  );
                }}
              />
            </Panel>
          )}

          <div style={{ display: "none" }}>
            <button
              style={{
                background: "transparent", border: "1px solid rgba(255,255,255,0.14)",
                borderRadius: 8, padding: "7px 16px", color: C.muted,
                cursor: "pointer", fontSize: 13,
              }}>
              ← Back
            </button>
          </div>

        </div>
        {/* end COL 4 */}

      </div>
      {/* end 4-column grid */}

      {/* Note edit drawer */}
      {noteDrawer && (
        <NoteEditDrawer
          scope={noteDrawer.scope}
          note={noteDrawer.note}
          accentColor={accentColor}
          onSave={handleNoteSave}
          onDelete={noteDrawer.note ? () => { handleNoteDelete(noteDrawer.scope, noteDrawer.note!.id); setNoteDrawer(null); } : undefined}
          onClose={() => setNoteDrawer(null)}
        />
      )}
    </Wrap>
  );
}

// ---------------------------------------------------------------------------
// Inventory Panel
// ---------------------------------------------------------------------------

function InventoryPanel({ char, charData, accentColor, onSave }: {
  char: Character;
  charData: CharacterData | null;
  accentColor: string;
  onSave: (data: CharacterData) => Promise<unknown>;
}) {
  const [items, setItems] = useState<InventoryItem[]>(() =>
    ((charData?.inventory ?? []) as InventoryItem[]).map((item) => ({
      ...item,
      equipState: getEquipState(item),
      properties: item.properties ?? [],
    }))
  );
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
  const nameRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let alive = true;
    api<ItemSummaryRow[]>("/api/compendium/items")
      .then((rows) => { if (alive) setItemIndex(rows ?? []); })
      .catch(() => { if (alive) setItemIndex([]); });
    return () => { alive = false; };
  }, []);

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
    const matchedSummary = inventoryItem.itemId
      ? itemIndex.find((row) => row.id === inventoryItem.itemId) ?? null
      : itemIndex.find((row) => normalizeInventoryItemLookupName(row.name) === normalizedName) ?? null;

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

  async function persist(updated: InventoryItem[]) {
    setSaving(true);
    try {
      await onSave({ inventory: updated });
      setItems(updated);
    } finally {
      setSaving(false);
    }
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
    await persist([...items, item]);
    setPickerOpen(false);
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

  const equipped = items.filter((it) => getEquipState(it) !== "backpack");
  const backpack = items.filter((it) => getEquipState(it) === "backpack");
  const actionItems = equipped.filter((it) => isWeaponItem(it));
  const prof = charData?.proficiencies;
  const carriedWeight = totalInventoryWeight(items);
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
        justifyContent: "flex-end",
        marginBottom: 10,
        padding: "0 2px",
      }}>
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

      {backpack.length > 0 && (
        <div style={{ marginBottom: 10 }}>
          <div style={subLabelStyle}>{equipped.length > 0 ? "Backpack" : "Items"}</div>
          {backpack.map((it) => (
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
  charData: CharacterData | null;
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
          </div>
          {meta && (
            <div style={{ fontSize: 10, color: C.muted, marginTop: 2 }}>{meta}</div>
          )}
          {stateLabel && (
            <div style={{ fontSize: 10, color: accentColor, marginTop: 2, fontWeight: 700 }}>
              {stateLabel}
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
  detail: CompendiumItemDetail | null;
  busy: boolean;
  accentColor: string;
  otherAttunedCount: number;
  editMode: boolean;
  onStartEdit: () => void;
  onCancelEdit: () => void;
  onClose: () => void;
  onSave: (patch: Partial<InventoryItem>) => Promise<void>;
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

// ---------------------------------------------------------------------------
// Tooltip
// ---------------------------------------------------------------------------

function Tooltip({ text, children }: { text: string; children: React.ReactNode }) {
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

// ---------------------------------------------------------------------------
// Shared sub-components
// ---------------------------------------------------------------------------

function Wrap({ children, wide }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: wide ? "none" : 1060, margin: "0 auto", padding: wide ? "16px" : "28px 20px" }}>
        {children}
      </div>
    </div>
  );
}

function Panel({ children }: { children: React.ReactNode }) {
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

function PanelTitle({ children, color, actions, style }: { children: React.ReactNode; color: string; actions?: React.ReactNode; style?: React.CSSProperties }) {
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

function ProfDot({ filled, color }: { filled: boolean; color: string }) {
  return (
    <div style={{
      width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
      background: filled ? color : "transparent",
      border: `1.5px solid ${filled ? color : "rgba(255,255,255,0.2)"}`,
    }} />
  );
}

function HexBtn({ variant, active, title, disabled, onClick, children }: {
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

function MiniStat({ label, value, accent, icon }: { label: string; value: string; accent?: string; icon?: React.ReactNode }) {
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

// ---------------------------------------------------------------------------
// SpellSlotsPanel
// ---------------------------------------------------------------------------

function SpellSlotsPanel({ classDetail, level, usedSpellSlots, onSave, accentColor }: {
  classDetail: ClassRestDetail | null;
  level: number;
  usedSpellSlots: Record<string, number>;
  onSave: (next: Record<string, number>) => Promise<void>;
  accentColor: string;
}) {
  const slots = classDetail?.autolevels.find((al) => al.level === level)?.slots ?? null;
  if (!slots) return null;

  // slots[0] = cantrips, slots[1] = L1, ... slots[9] = L9
  const spellLevels = slots
    .map((count, i) => ({ level: i, count }))
    .filter(({ level: l, count }) => l > 0 && count > 0);

  if (!spellLevels.length) return null;

  async function toggleSlot(spellLevel: number, slotIndex: number) {
    const key = String(spellLevel);
    const used = usedSpellSlots[key] ?? 0;
    const max = slots![spellLevel] ?? 0;
    // If clicking a "used" slot (i < used) → restore it; clicking "available" slot → expend it
    const next = slotIndex < used ? slotIndex : Math.min(max, slotIndex + 1);
    await onSave({ ...usedSpellSlots, [key]: next });
  }

  async function longRest() {
    await onSave({});
  }

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <PanelTitle color="#a78bfa" style={{ margin: 0 }}>Spell Slots</PanelTitle>
        <button onClick={longRest} style={{
          fontSize: 10, fontWeight: 700, padding: "3px 10px", borderRadius: 6, cursor: "pointer",
          background: "rgba(167,139,250,0.12)", border: "1px solid rgba(167,139,250,0.3)", color: "#a78bfa",
        }}>Long Rest</button>
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 7 }}>
        {spellLevels.map(({ level: sl, count }) => {
          const used = usedSpellSlots[String(sl)] ?? 0;
          const remaining = count - used;
          const ordinals = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
          return (
            <div key={sl} style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, minWidth: 30 }}>{ordinals[sl]}</div>
              <div style={{ display: "flex", gap: 5, flex: 1 }}>
                {Array.from({ length: count }).map((_, i) => {
                  const filled = i >= used; // filled = available, empty = expended
                  return (
                    <button
                      key={i}
                      title={filled ? "Expend slot" : "Restore slot"}
                      onClick={() => toggleSlot(sl, i)}
                      style={{
                        width: 22, height: 22, borderRadius: 4, padding: 0, cursor: "pointer",
                        border: `2px solid ${filled ? accentColor : "rgba(255,255,255,0.15)"}`,
                        background: filled ? `${accentColor}33` : "transparent",
                      }}
                    />
                  );
                })}
              </div>
              <div style={{ fontSize: 10, color: C.muted, minWidth: 36, textAlign: "right" }}>
                {remaining}/{count}
              </div>
            </div>
          );
        })}
      </div>
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// RichSpellsPanel
// ---------------------------------------------------------------------------

function RichSpellsPanel({ spells, pb, intScore, wisScore, chaScore, accentColor, classDetail, charLevel, usedSpellSlots, preparedSpells, onSlotsChange, onPreparedChange }: {
  spells: { name: string; source: string }[];
  pb: number;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  accentColor: string;
  classDetail: ClassRestDetail | null;
  charLevel: number;
  usedSpellSlots: Record<string, number>;
  preparedSpells: string[];
  onSlotsChange: (next: Record<string, number>) => Promise<void>;
  onPreparedChange: (next: string[]) => Promise<void>;
}) {
  const [details, setDetails] = React.useState<Record<string, FetchedSpellDetail>>({});
  const [selectedSpell, setSelectedSpell] = React.useState<FetchedSpellDetail | null>(null);

  const entries = React.useMemo(() => spells.map((sp) => ({
    rawName: sp.name,
    source: sp.source,
    searchName: sp.name.replace(/\s*\[.+\]$/, "").trim(),
    key: sp.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
  })), [spells]);

  const entryKeysStr = entries.map((e) => e.key).join(",");
  React.useEffect(() => {
    for (const e of entries) {
      if (details[e.key]) continue;
      api<{ id: string; name: string; level: number | null }[]>(
        `/api/spells/search?q=${encodeURIComponent(e.searchName)}&limit=5`
      ).then((results) => {
        const match =
          results.find((r) => r.name.replace(/\s*\[.+\]$/, "").toLowerCase() === e.searchName.toLowerCase())
          ?? results[0];
        if (!match) return;
        return api<FetchedSpellDetail>(`/api/spells/${match.id}`).then((detail) => {
          const textStr = Array.isArray(detail.text) ? detail.text.join("\n") : String(detail.text ?? "");
          setDetails((prev) => ({
            ...prev,
            [e.key]: { ...detail, damage: parseSpellDamage(textStr), save: parseSpellSave(textStr) },
          }));
        });
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [entryKeysStr]);

  const intMod = Math.floor(((intScore ?? 10) - 10) / 2);
  const wisMod = Math.floor(((wisScore ?? 10) - 10) / 2);
  const chaMod = Math.floor(((chaScore ?? 10) - 10) / 2);
  const spellMod = Math.max(intMod, wisMod, chaMod);
  const spellAbilLabel = spellMod === chaMod ? "CHA" : spellMod === wisMod ? "WIS" : "INT";
  const saveDc = 8 + pb + spellMod;
  const spellAtk = pb + spellMod;

  // Spell slots for current level
  const levelSlots = classDetail?.autolevels.find((al) => al.level === charLevel)?.slots ?? null;
  const maxSpellSlotLevel = highestAvailableSlotLevel(levelSlots);

  // Group by spell level
  const groups = new Map<number, typeof entries>();
  for (const e of entries) {
    const level = details[e.key]?.level ?? -1;
    if (!groups.has(level)) groups.set(level, []);
    groups.get(level)!.push(e);
  }

  function togglePrepared(key: string) {
    const next = preparedSpells.includes(key)
      ? preparedSpells.filter((k) => k !== key)
      : [...preparedSpells, key];
    void onPreparedChange(next);
  }

  function toggleSlot(spellLevel: number, slotIndex: number) {
    const key = String(spellLevel);
    const used = usedSpellSlots[key] ?? 0;
    // clicking below used line restores; clicking at/above expends
    const next = slotIndex < used ? slotIndex : slotIndex + 1;
    void onSlotsChange({ ...usedSpellSlots, [key]: next });
  }

  function spellUsesSave(d: FetchedSpellDetail | undefined): boolean {
    if (!d) return false;
    const txt = Array.isArray(d.text) ? d.text.join(" ") : String(d.text ?? "");
    return /saving throw/i.test(txt);
  }
  function spellUsesAttack(d: FetchedSpellDetail | undefined): boolean {
    if (!d) return false;
    const txt = Array.isArray(d.text) ? d.text.join(" ") : String(d.text ?? "");
    return /spell attack|ranged spell attack|melee spell attack/i.test(txt);
  }

  const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

  return (
    <Panel>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
        <PanelTitle color="#a78bfa" style={{ margin: 0 }}>Spells</PanelTitle>
        <div style={{ display: "flex", gap: 6 }}>
          {([
            { label: "ABILITY", value: spellAbilLabel, highlight: true },
            { label: "SAVE DC",  value: String(saveDc),     highlight: false },
            { label: "ATK BONUS", value: `+${spellAtk}`,   highlight: false },
          ] as const).map(({ label, value, highlight }) => (
            <div key={label} style={{
              display: "flex", flexDirection: "column", alignItems: "center",
              padding: "6px 12px", borderRadius: 8,
              background: "rgba(167,139,250,0.08)", border: "1px solid rgba(167,139,250,0.18)",
              minWidth: 56,
            }}>
              <span style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 2 }}>{label}</span>
              <span style={{ fontSize: 15, fontWeight: 900, color: highlight ? accentColor : C.text }}>{value}</span>
            </div>
          ))}
        </div>
      </div>

      {[...groups.entries()].sort(([a], [b]) => a - b).map(([level, groupEntries]) => {
        const maxSlots = (levelSlots && level > 0) ? (levelSlots[level] ?? 0) : 0;
        const usedCount = usedSpellSlots[String(level)] ?? 0;
        const remaining = maxSlots - usedCount;

        return (
          <div key={level} style={{ marginBottom: 18 }}>
            {/* Level header with inline slots */}
            <div style={{
              display: "flex", alignItems: "center", justifyContent: "space-between",
              paddingBottom: 5, borderBottom: "1px solid rgba(239,68,68,0.25)", marginBottom: 8,
            }}>
              <div style={{ fontSize: 11, fontWeight: 800, color: "#ef4444", textTransform: "uppercase", letterSpacing: 1 }}>
                {level === -1 ? "Loading…" : level === 0 ? "Cantrips" : (LEVEL_LABELS[level] ?? `Level ${level}`)}
              </div>
              {maxSlots > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10, color: C.muted, marginRight: 3 }}>slots {remaining}/{maxSlots}</span>
                  {Array.from({ length: maxSlots }).map((_, i) => {
                    const filled = i >= usedCount;
                    return (
                      <button
                        key={i}
                        title={filled ? "Expend slot" : "Regain slot"}
                        onClick={() => toggleSlot(level, i)}
                        style={{
                          width: 18, height: 18, borderRadius: "50%", padding: 0, cursor: "pointer",
                          border: `2px solid ${filled ? accentColor : "rgba(255,255,255,0.2)"}`,
                          background: filled ? accentColor : "transparent",
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {/* Column headers */}
            <div style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto auto", gap: "0 8px", marginBottom: 4 }}>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>PREP</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>NAME</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>TIME</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>HIT / DC</div>
              <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>EFFECT</div>
            </div>

            {groupEntries.map((e, i) => {
              const d = details[e.key];
              const scaledDamage = d ? getScaledSpellDamage(d, charLevel, maxSpellSlotLevel) : null;
              const dmgColor = scaledDamage ? (DMG_COLORS[scaledDamage.type] ?? C.text) : null;
              const conc = d ? Boolean(d.concentration) : false;
              const usesSave = spellUsesSave(d);
              const usesAtk = spellUsesAttack(d);
              const isCantrip = level === 0;
              const isPrepared = isCantrip || preparedSpells.includes(e.key);
              return (
                <div key={i} style={{
                  display: "grid",
                  gridTemplateColumns: "24px 1fr auto auto auto",
                  alignItems: "start", gap: "0 8px",
                  padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                  cursor: d ? "pointer" : "default",
                }}
                  onClick={(ev) => {
                    if ((ev.target as HTMLElement).closest("button")) return;
                    if (d) setSelectedSpell(d);
                  }}
                >
                  {/* Prepared radio */}
                  <button
                    onClick={() => !isCantrip && togglePrepared(e.key)}
                    title={isCantrip ? "Cantrip (always prepared)" : isPrepared ? "Mark unprepared" : "Mark prepared"}
                    style={{
                      width: 20, height: 20, borderRadius: "50%", padding: 0,
                      cursor: isCantrip ? "default" : "pointer", marginTop: 3,
                      border: `2px solid ${isPrepared ? accentColor : "rgba(255,255,255,0.25)"}`,
                      background: isPrepared ? accentColor : "transparent",
                      flexShrink: 0,
                    }}
                  />

                  {/* Name + meta */}
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 13, color: isPrepared ? C.text : C.muted }}>
                      {e.searchName}
                      {conc && <span title="Concentration" style={{ marginLeft: 5, fontSize: 10, color: "#60a5fa" }}>◆</span>}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>
                      {[d ? `${d.level === 0 ? "Cantrip" : ORDINALS[d.level ?? 0]} ${d.school ?? ""}`.trim() : null, d?.components].filter(Boolean).join("  (") + (d?.components ? ")" : "")}
                    </div>
                  </div>

                  {/* Time */}
                  <div style={{ fontSize: 11, color: C.muted, paddingTop: 3, textAlign: "center", minWidth: 28 }}>
                    {d ? abbrevTime(d.time ?? "—") : ""}
                  </div>

                  {/* HIT / SAVE */}
                  {d && (usesSave || usesAtk) ? (
                    <div style={{ textAlign: "center", paddingTop: 1 }}>
                      <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>
                        {usesSave ? (d.save ?? "SAVE") : "ATK"}
                      </div>
                      <div style={{ fontWeight: 900, fontSize: 15, color: accentColor, lineHeight: 1.2 }}>
                        {usesSave ? saveDc : `+${spellAtk}`}
                      </div>
                    </div>
                  ) : <div />}

                  {/* Effect */}
                  {scaledDamage ? (
                    <div style={{
                      padding: "4px 7px", borderRadius: 6, border: `1px solid ${dmgColor}55`,
                      background: `${dmgColor}15`, textAlign: "center", whiteSpace: "nowrap",
                    }}>
                      <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{scaledDamage.dice}</span>
                      <span style={{ fontSize: 12, marginLeft: 3 }}>{DMG_EMOJI[scaledDamage.type] ?? "◆"}</span>
                    </div>
                  ) : <div />}
                </div>
              );
            })}
          </div>
        );
      })}
      {selectedSpell && (
        <SpellDrawer spell={selectedSpell} accentColor={accentColor} onClose={() => setSelectedSpell(null)} charLevel={charLevel} maxSlotLevel={maxSpellSlotLevel} />
      )}
    </Panel>
  );
}

// ---------------------------------------------------------------------------
// ItemSpellsPanel
// ---------------------------------------------------------------------------

interface FetchedSpellDetail {
  id: string;
  name: string;
  level: number | null;
  school: string | null;
  time: string | null;
  range: string | null;
  components: string | null;
  duration: string | null;
  concentration: number | boolean;
  ritual: number | boolean;
  classes: string | null;
  text: string | string[];
  damage: { dice: string; type: string } | null;
  save: string | null;
}

// ---------------------------------------------------------------------------
// SpellDrawer
// ---------------------------------------------------------------------------

function SpellDrawer({ spell, accentColor, onClose, charLevel, maxSlotLevel }: {
  spell: FetchedSpellDetail;
  accentColor: string;
  onClose: () => void;
  charLevel?: number;
  maxSlotLevel?: number;
}) {
  const ORDINALS = ["Cantrip", "1st level", "2nd level", "3rd level", "4th level", "5th level", "6th level", "7th level", "8th level", "9th level"];
  const textArr = Array.isArray(spell.text) ? spell.text : [String(spell.text ?? "")];
  const isConc = Boolean(spell.concentration);
  const isRitual = Boolean(spell.ritual);
  const levelLabel = spell.level === 0 ? "Cantrip" : `${ORDINALS[spell.level ?? 0] ?? `Level ${spell.level}`} spell`;
  const scaledDamage = getScaledSpellDamage(spell, charLevel ?? 1, maxSlotLevel ?? Math.max(1, spell.level ?? 1));
  const dmgColor = scaledDamage ? (DMG_COLORS[scaledDamage.type] ?? C.text) : null;

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: "fixed", inset: 0, zIndex: 200,
          background: "rgba(0,0,0,0.45)",
        }}
      />
      {/* Drawer */}
      <div style={{
        position: "fixed", top: 0, right: 0, bottom: 0, zIndex: 201,
        width: "min(420px, 92vw)",
        background: "#111827",
        borderLeft: "1px solid rgba(255,255,255,0.1)",
        boxShadow: "-12px 0 40px rgba(0,0,0,0.5)",
        display: "flex", flexDirection: "column",
        overflowY: "auto",
      }}>
        {/* Header */}
        <div style={{
          padding: "20px 20px 16px",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
          position: "sticky", top: 0,
          background: "#111827", zIndex: 1,
        }}>
          <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <h2 style={{ margin: "0 0 4px", fontSize: 20, fontWeight: 900, color: C.text, lineHeight: 1.2 }}>
                {spell.name}
              </h2>
              <div style={{ fontSize: 12, color: C.muted, fontStyle: "italic" }}>
                {levelLabel}{spell.school ? ` · ${spell.school}` : ""}
                {isRitual && <span style={{ marginLeft: 6, color: "#60a5fa", fontStyle: "normal", fontWeight: 700 }}>ritual</span>}
                {isConc && <span style={{ marginLeft: 6, color: "#60a5fa", fontStyle: "normal", fontWeight: 700 }}>concentration</span>}
              </div>
            </div>
            <button onClick={onClose} style={{
              background: "none", border: "none", cursor: "pointer",
              color: C.muted, fontSize: 22, lineHeight: 1, padding: "2px 4px", flexShrink: 0,
            }}>×</button>
          </div>
        </div>

        {/* Stat bar */}
        <div style={{
          display: "grid", gridTemplateColumns: "repeat(3, 1fr)",
          gap: 1, background: "rgba(255,255,255,0.05)",
          borderBottom: "1px solid rgba(255,255,255,0.08)",
        }}>
          {[
            { label: "Casting Time", value: spell.time ?? "—" },
            { label: "Range",        value: (spell.range ?? "—").replace(/ feet?/i, " ft.") },
            { label: "Duration",     value: spell.duration ?? "—" },
          ].map(({ label, value }) => (
            <div key={label} style={{ padding: "10px 12px", background: "#111827", textAlign: "center" }}>
              <div style={{ fontSize: 9, fontWeight: 800, color: C.muted, textTransform: "uppercase", letterSpacing: "0.07em", marginBottom: 3 }}>{label}</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: C.text }}>{value}</div>
            </div>
          ))}
        </div>

        {/* Components + damage summary */}
        <div style={{ padding: "12px 20px", display: "flex", alignItems: "center", gap: 10, borderBottom: "1px solid rgba(255,255,255,0.06)", flexWrap: "wrap" }}>
          {spell.components && (
            <span style={{ fontSize: 12, color: C.muted }}>{spell.components}</span>
          )}
          {scaledDamage && (
            <div style={{
              marginLeft: "auto", padding: "4px 10px", borderRadius: 6,
              border: `1px solid ${dmgColor}55`, background: `${dmgColor}15`,
              display: "flex", alignItems: "center", gap: 5,
            }}>
              <span style={{ fontWeight: 800, fontSize: 14, color: C.text }}>{scaledDamage.dice}</span>
              <span style={{ fontSize: 13 }}>{DMG_EMOJI[scaledDamage.type] ?? "◆"}</span>
              <span style={{ fontSize: 11, color: dmgColor, fontWeight: 700, textTransform: "capitalize" }}>{scaledDamage.type}</span>
            </div>
          )}
        </div>

        {/* Description */}
        <div style={{ padding: "16px 20px 32px", display: "flex", flexDirection: "column", gap: 10 }}>
          {textArr.filter(Boolean).map((para, i) => (
            <p key={i} style={{ margin: 0, fontSize: 13, color: "rgba(200,210,230,0.85)", lineHeight: 1.65 }}>
              {para}
            </p>
          ))}
          {spell.classes && (
            <p style={{ margin: "8px 0 0", fontSize: 11, color: C.muted, fontStyle: "italic" }}>
              Classes: {spell.classes}
            </p>
          )}
        </div>
      </div>
    </>
  );
}

function parseSpellDamage(text: string): { dice: string; type: string } | null {
  const m = text.match(/(\d+d\d+(?:\s*\+\s*\d+)?)\s+(fire|cold|lightning|acid|poison|necrotic|radiant|thunder|psychic|force|bludgeoning|piercing|slashing)\s+damage/i);
  if (!m) return null;
  return { dice: m[1].replace(/\s+/g, ""), type: m[2].toLowerCase() };
}

function parseDiceExpression(expr: string): { count: number; sides: number; bonus: number } | null {
  const match = String(expr ?? "").trim().match(/^(\d+)d(\d+)(?:\s*\+\s*(\d+))?$/i);
  if (!match) return null;
  return {
    count: parseInt(match[1], 10),
    sides: parseInt(match[2], 10),
    bonus: parseInt(match[3] ?? "0", 10),
  };
}

function formatDiceExpression(parsed: { count: number; sides: number; bonus: number }): string {
  return `${parsed.count}d${parsed.sides}${parsed.bonus > 0 ? `+${parsed.bonus}` : ""}`;
}

function addScaledDice(baseExpr: string, incrementExpr: string, times: number): string {
  if (times <= 0) return baseExpr.replace(/\s+/g, "");
  const base = parseDiceExpression(baseExpr);
  const inc = parseDiceExpression(incrementExpr);
  if (!base || !inc || base.sides !== inc.sides) return baseExpr.replace(/\s+/g, "");
  return formatDiceExpression({
    count: base.count + (inc.count * times),
    sides: base.sides,
    bonus: base.bonus + (inc.bonus * times),
  });
}

function highestAvailableSlotLevel(levelSlots: number[] | null | undefined): number {
  if (!levelSlots) return 0;
  for (let i = levelSlots.length - 1; i >= 1; i -= 1) {
    if ((levelSlots[i] ?? 0) > 0) return i;
  }
  return 0;
}

function getScaledSpellDamage(detail: FetchedSpellDetail, charLevel: number, maxSlotLevel: number): { dice: string; type: string } | null {
  const text = Array.isArray(detail.text) ? detail.text.join("\n") : String(detail.text ?? "");
  const base = parseSpellDamage(text);
  if (!base) return null;

  if ((detail.level ?? 0) === 0) {
    const tierBoosts = (charLevel >= 5 ? 1 : 0) + (charLevel >= 11 ? 1 : 0) + (charLevel >= 17 ? 1 : 0);
    const cantripBoost = text.match(/damage increases by (\d+d\d+(?:\s*\+\s*\d+)?)/i);
    if (cantripBoost && tierBoosts > 0) {
      return { ...base, dice: addScaledDice(base.dice, cantripBoost[1], tierBoosts) };
    }
    return base;
  }

  const baseLevel = Math.max(1, detail.level ?? 1);
  const castLevel = Math.max(baseLevel, maxSlotLevel);

  if (/^magic missile$/i.test(detail.name.trim())) {
    const darts = 3 + Math.max(0, castLevel - 1);
    return { dice: `${darts}d4+${darts}`, type: "force" };
  }

  const higherLevelBoost = text.match(/damage increases by (\d+d\d+(?:\s*\+\s*\d+)?) for each slot level above (\d+)(?:st|nd|rd|th)/i);
  if (higherLevelBoost) {
    const threshold = parseInt(higherLevelBoost[2], 10);
    const times = Math.max(0, castLevel - threshold);
    if (times > 0) {
      return { ...base, dice: addScaledDice(base.dice, higherLevelBoost[1], times) };
    }
  }

  return base;
}

function parseSpellSave(text: string): string | null {
  const m = text.match(/(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma|STR|DEX|CON|INT|WIS|CHA)\s+saving\s+throw/i);
  if (!m) return null;
  const map: Record<string, string> = { strength: "STR", dexterity: "DEX", constitution: "CON", intelligence: "INT", wisdom: "WIS", charisma: "CHA" };
  return map[m[1].toLowerCase()] ?? m[1].toUpperCase().slice(0, 3);
}

function abbrevTime(t: string): string {
  return t
    .replace(/1 action/i, "1A").replace(/1 bonus action/i, "1BA")
    .replace(/1 reaction/i, "1R").replace(/1 minute/i, "1 min");
}

const DMG_COLORS: Record<string, string> = {
  fire: "#f97316", cold: "#60a5fa", lightning: "#facc15", acid: "#a3e635",
  poison: "#86efac", necrotic: "#818cf8", radiant: "#fde68a", thunder: "#7dd3fc",
  psychic: "#e879f9", force: "#a78bfa", bludgeoning: "#94a3b8", piercing: "#94a3b8", slashing: "#f87171",
};
const DMG_EMOJI: Record<string, string> = {
  fire: "🔥", cold: "❄️", lightning: "⚡", acid: "🧪", poison: "☠️",
  necrotic: "💀", radiant: "✨", thunder: "💥", psychic: "🔮", force: "◆",
};
const LEVEL_LABELS: Record<number, string> = {
  0: "Cantrip", 1: "1st Level", 2: "2nd Level", 3: "3rd Level", 4: "4th Level",
  5: "5th Level", 6: "6th Level", 7: "7th Level", 8: "8th Level", 9: "9th Level",
};

function ItemSpellsPanel({ items, pb, intScore, wisScore, chaScore, accentColor, onChargeChange }: {
  items: InventoryItem[];
  pb: number;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  accentColor: string;
  onChargeChange: (itemId: string, charges: number) => void;
}) {
  const [details, setDetails] = React.useState<Record<string, FetchedSpellDetail>>({});
  const [selectedSpell, setSelectedSpell] = React.useState<FetchedSpellDetail | null>(null);

  const itemsWithSpells = React.useMemo(() =>
    items
      .filter((it) => getEquipState(it) !== "backpack")
      .map((it) => ({ item: it, spells: parseItemSpells(it.description ?? "") }))
      .filter(({ spells }) => spells.length > 0),
  [items]);

  const allKeys = React.useMemo(() =>
    itemsWithSpells.flatMap(({ spells }) => spells.map((sp) => ({
      spellName: sp.name,
      key: sp.name.toLowerCase().replace(/[^a-z0-9]/g, ""),
    }))),
  [itemsWithSpells]);

  const keysStr = allKeys.map((e) => e.key).join(",");
  React.useEffect(() => {
    for (const e of allKeys) {
      if (details[e.key]) continue;
      api<{ id: string; name: string; level: number | null }[]>(
        `/api/spells/search?q=${encodeURIComponent(e.spellName)}&limit=5`
      ).then((results) => {
        const match = results.find((r) => r.name.replace(/\s*\[.+\]$/, "").toLowerCase() === e.spellName.toLowerCase()) ?? results[0];
        if (!match) return;
        return api<FetchedSpellDetail>(`/api/spells/${match.id}`).then((detail) => {
          const textStr = Array.isArray(detail.text) ? detail.text.join("\n") : String(detail.text ?? "");
          setDetails((prev) => ({ ...prev, [e.key]: { ...detail, damage: parseSpellDamage(textStr), save: parseSpellSave(textStr) } }));
        });
      }).catch(() => {});
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [keysStr]);

  if (!itemsWithSpells.length) return null;

  const spellMod = Math.max(
    Math.floor(((intScore ?? 10) - 10) / 2),
    Math.floor(((wisScore ?? 10) - 10) / 2),
    Math.floor(((chaScore ?? 10) - 10) / 2),
  );
  const saveDc = 8 + pb + spellMod;
  const spellAtk = pb + spellMod;
  const ORDINALS = ["", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];

  return (
    <>
      {itemsWithSpells.map(({ item, spells }) => {
        const chargesMax = item.chargesMax ?? 0;
        const charges = item.charges ?? chargesMax;

        // Group spells by level
        const groups = new Map<number, ParsedItemSpell[]>();
        for (const sp of spells) {
          const key = sp.name.toLowerCase().replace(/[^a-z0-9]/g, "");
          const level = details[key]?.level ?? -1;
          if (!groups.has(level)) groups.set(level, []);
          groups.get(level)!.push(sp);
        }

        return (
          <Panel key={item.id}>
            {/* Header: item name + charge circles */}
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
              <PanelTitle color="#a78bfa" style={{ margin: 0 }}>
                {item.name.replace(/\s*\[.+\]$/, "")}
              </PanelTitle>
              {chargesMax > 0 && (
                <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                  <span style={{ fontSize: 10, color: C.muted, marginRight: 3 }}>
                    charges {charges}/{chargesMax}
                  </span>
                  {Array.from({ length: chargesMax }).map((_, i) => {
                    const filled = i < charges;
                    return (
                      <button
                        key={i}
                        title={filled ? "Use charge" : "Recover charge"}
                        onClick={() => onChargeChange(item.id, i < charges ? i : i + 1)}
                        style={{
                          width: 16, height: 16, borderRadius: "50%", padding: 0, cursor: "pointer",
                          border: `2px solid ${filled ? "#ef4444" : "rgba(255,255,255,0.2)"}`,
                          background: filled ? "#ef4444" : "transparent",
                        }}
                      />
                    );
                  })}
                </div>
              )}
            </div>

            {[...groups.entries()].sort(([a], [b]) => a - b).map(([level, groupSpells]) => (
              <div key={level} style={{ marginBottom: 14 }}>
                {/* Level header */}
                <div style={{
                  fontSize: 11, fontWeight: 800, color: "#ef4444", textTransform: "uppercase",
                  letterSpacing: 1, paddingBottom: 5, borderBottom: "1px solid rgba(239,68,68,0.25)", marginBottom: 8,
                }}>
                  {level === -1 ? "Loading…" : level === 0 ? "Cantrips" : `${ORDINALS[level] ?? `Level ${level}`} Level`}
                </div>

                {/* Column headers */}
                <div style={{ display: "grid", gridTemplateColumns: "24px 1fr auto auto auto", gap: "0 8px", marginBottom: 4 }}>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>CST</div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em" }}>NAME</div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>TIME</div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>HIT / DC</div>
                  <div style={{ fontSize: 9, color: C.muted, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.07em", textAlign: "center" }}>EFFECT</div>
                </div>

                {groupSpells.map((sp, i) => {
                  const key = sp.name.toLowerCase().replace(/[^a-z0-9]/g, "");
                  const d = details[key];
                  const dmgColor = d?.damage ? (DMG_COLORS[d.damage.type] ?? C.text) : null;
                  const conc = d ? Boolean(d.concentration) : false;
                  const txt = d ? (Array.isArray(d.text) ? d.text.join(" ") : String(d.text ?? "")) : "";
                  const usesSave = /saving throw/i.test(txt);
                  const usesAtk = /spell attack/i.test(txt);
                  // Strip verbose material component descriptions: "V, S, M (a ball of guano)" → "V, S, M"
                  const compactComponents = d?.components ? d.components.replace(/\s*\([^)]*\)/g, "").trim() : null;
                  return (
                    <div key={i}
                      style={{
                        display: "grid", gridTemplateColumns: "24px 1fr auto auto auto",
                        alignItems: "start", gap: "0 8px",
                        padding: "7px 0", borderBottom: "1px solid rgba(255,255,255,0.04)",
                        cursor: d ? "pointer" : "default",
                      }}
                      onClick={() => { if (d) setSelectedSpell(d); }}
                    >
                      {/* Cost circle */}
                      <div title={`${sp.cost} charge${sp.cost !== 1 ? "s" : ""}`} style={{
                        width: 20, height: 20, borderRadius: "50%", marginTop: 3,
                        background: "#dc2626", display: "grid", placeItems: "center", flexShrink: 0,
                      }}>
                        <span style={{ color: "#fff", fontSize: 9, fontWeight: 900, lineHeight: 1 }}>{sp.cost}</span>
                      </div>

                      {/* Name + meta */}
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, fontSize: 13, color: C.text }}>
                          {sp.name}
                          {conc && <span title="Concentration" style={{ marginLeft: 5, fontSize: 10, color: "#60a5fa" }}>◆</span>}
                        </div>
                        <div style={{ fontSize: 10, color: C.muted }}>
                          {d ? `${d.level === 0 ? "Cantrip" : ORDINALS[d.level ?? 0] ?? ""} ${d.school ?? ""}`.trim() : ""}
                          {compactComponents ? ` (${compactComponents})` : ""}
                        </div>
                      </div>

                      {/* Time */}
                      <div style={{ fontSize: 11, color: C.muted, paddingTop: 3, textAlign: "center", minWidth: 28 }}>
                        {d ? abbrevTime(d.time ?? "—") : ""}
                      </div>

                      {/* HIT / DC */}
                      {d && (usesSave || usesAtk) ? (
                        <div style={{ textAlign: "center", paddingTop: 1 }}>
                          <div style={{ fontSize: 9, color: C.muted, fontWeight: 700 }}>{usesSave ? (d.save ?? "SAVE") : "ATK"}</div>
                          <div style={{ fontWeight: 900, fontSize: 15, color: accentColor, lineHeight: 1.2 }}>
                            {usesSave ? saveDc : `+${spellAtk}`}
                          </div>
                        </div>
                      ) : <div />}

                      {/* Effect */}
                      {d?.damage ? (
                        <div style={{
                          padding: "4px 7px", borderRadius: 6, border: `1px solid ${dmgColor}55`,
                          background: `${dmgColor}15`, textAlign: "center", whiteSpace: "nowrap",
                        }}>
                          <span style={{ fontWeight: 800, fontSize: 13, color: C.text }}>{d.damage.dice}</span>
                          <span style={{ fontSize: 12, marginLeft: 3 }}>{DMG_EMOJI[d.damage.type] ?? "◆"}</span>
                        </div>
                      ) : <div />}
                    </div>
                  );
                })}
              </div>
            ))}
          </Panel>
        );
      })}
      {selectedSpell && (
        <SpellDrawer spell={selectedSpell} accentColor={accentColor} onClose={() => setSelectedSpell(null)} />
      )}
    </>
  );
}

// ---------------------------------------------------------------------------
// Styles
// ---------------------------------------------------------------------------

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


function inventoryEquipBtn(active: boolean, color: string): React.CSSProperties {
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

function panelHeaderAddBtn(color: string): React.CSSProperties {
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

function addBtnStyle(accent: string): React.CSSProperties {
  return {
    background: accent, color: "#000",
    border: "none", borderRadius: 7,
    padding: "6px 14px", fontSize: 13,
    fontWeight: 700, cursor: "pointer",
  };
}

const cancelBtnStyle: React.CSSProperties = {
  background: "transparent",
  border: "1px solid rgba(255,255,255,0.14)",
  borderRadius: 7, padding: "6px 14px",
  fontSize: 13, color: C.muted, cursor: "pointer",
};

const inventoryCheckboxLabel: React.CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 8,
  fontSize: 12,
  color: C.muted,
};

const inventoryPickerColumnStyle: React.CSSProperties = {
  minHeight: 0,
  display: "flex",
  flexDirection: "column",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 12,
  background: "rgba(255,255,255,0.03)",
  padding: 12,
  gap: 10,
};

const inventoryPickerListStyle: React.CSSProperties = {
  flex: 1,
  minHeight: 220,
  overflowY: "auto",
  border: `1px solid ${C.panelBorder}`,
  borderRadius: 10,
};

const inventoryPickerDetailStyle: React.CSSProperties = {
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

function inventoryRarityColor(rarity: string | null): string {
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

function toggleFilterPill(active: boolean, accentColor: string): React.CSSProperties {
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

function miniPillBtn(enabled: boolean): React.CSSProperties {
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

function restBtnStyle(color: string): React.CSSProperties {
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

// ---------------------------------------------------------------------------
// Notes sub-components
// ---------------------------------------------------------------------------

function NoteItem(props: {
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

function ClassFeatureItem(props: {
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

function NoteEditDrawer(props: {
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
        {/* Header */}
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
        {/* Body */}
        <div style={{ flex: 1, overflowY: "auto", padding: "16px 20px", display: "flex", flexDirection: "column", gap: 12 }}>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Title</div>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Note title…"
              style={{ width: "100%", boxSizing: "border-box", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: C.text, fontSize: 13, padding: "8px 10px", fontFamily: "inherit" }}
            />
          </div>
          <div>
            <div style={{ fontSize: 11, fontWeight: 700, color: C.muted, textTransform: "uppercase", letterSpacing: "0.06em", marginBottom: 6 }}>Text</div>
            <textarea
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Write…"
              rows={12}
              style={{ width: "100%", boxSizing: "border-box", resize: "vertical", background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", borderRadius: 6, color: C.text, fontSize: 13, padding: "8px 10px", fontFamily: "inherit", lineHeight: 1.5 }}
            />
          </div>
        </div>
        {/* Footer */}
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
