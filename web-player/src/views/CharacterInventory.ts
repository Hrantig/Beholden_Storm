import { titleCase } from "@/lib/format/titleCase";
import type { ClassFeatureEntry, CharacterData, ProficiencyMap, TaggedItem } from "@/views/CharacterSheetTypes";
import { abilityMod } from "@/views/CharacterSheetUtils";

export type TaggedItemLike = TaggedItem;
export type ProficiencyMapLike = Pick<ProficiencyMap, "weapons">;
export type ClassFeatureEntryLike = ClassFeatureEntry;
export type CharacterDataLike = Pick<CharacterData, "chosenOptionals" | "classFeatures" | "proficiencies" | "inventoryContainers">;

export interface CharacterLike {
  strScore: number | null;
  dexScore: number | null;
}

export interface InventoryItem {
  id: string;
  name: string;
  quantity: number;
  equipped: boolean;
  equipState?: "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand" | "worn";
  containerId?: string | null;
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

export interface InventoryContainer {
  id: string;
  name: string;
  ignoreWeight?: boolean;
}

export interface InventoryPickerPayload {
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

export interface CompendiumItemDetail {
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

export interface ItemSummaryRow {
  id: string;
  name: string;
  rarity: string | null;
  type: string | null;
  typeKey: string | null;
  attunement: boolean;
  magic: boolean;
  weight?: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
}

export type EquipState = "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand" | "worn";

export interface ParsedItemSpell {
  name: string;
  cost: number;
}

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

export function formatItemDamageType(code: string | null | undefined): string | null {
  const key = String(code ?? "").trim().toUpperCase();
  if (!key) return null;
  return ITEM_DAMAGE_TYPE_LABELS[key] ?? key;
}

export function formatItemProperties(properties: string[] | null | undefined): string {
  return (properties ?? [])
    .map((code) => {
      const key = String(code ?? "").trim().toUpperCase();
      return ITEM_PROPERTY_LABELS[key] ?? key;
    })
    .filter(Boolean)
    .join(", ");
}

export function isShieldOrTorch(item: InventoryItem): boolean {
  const type = String(item.type ?? "").toLowerCase();
  const name = String(item.name ?? "").toLowerCase();
  return type.includes("shield") || name.includes("shield") || name.includes("torch");
}

export function isArmorItem(item: InventoryItem): boolean {
  return /\barmor\b/i.test(item.type ?? "") && !isShieldOrTorch(item);
}

export function hasStealthDisadvantage(item: { stealthDisadvantage?: boolean; description?: string | null }): boolean {
  if (item.stealthDisadvantage) return true;
  return /disadvantage on stealth/i.test(String(item.description ?? ""));
}

export function normalizeInventoryItemLookupName(name: string): string {
  return String(name ?? "")
    .replace(/\s+\[(?:2024|5\.5e|5e)\]\s*$/i, "")
    .replace(/\s+\((?:2024|5\.5e|5e)\)\s*$/i, "")
    .trim()
    .toLowerCase();
}

export function currencyCodeForItem(item: Pick<InventoryItem, "name"> | null | undefined): "PP" | "GP" | "EP" | "SP" | "CP" | null {
  const normalized = String(item?.name ?? "").trim().toUpperCase();
  if (normalized === "PP" || normalized === "GP" || normalized === "EP" || normalized === "SP" || normalized === "CP") return normalized;
  return null;
}

export function isCurrencyItem(item: Pick<InventoryItem, "name"> | null | undefined): boolean {
  return currencyCodeForItem(item) != null;
}

function hasClassFeatureNamed(charData: CharacterDataLike | null | undefined, pattern: RegExp): boolean {
  return Boolean(charData?.classFeatures?.some((feature) => pattern.test(feature.name)));
}

export function addsAbilityModToOffhandDamage(item: InventoryItem, charData: CharacterDataLike | null | undefined): boolean {
  if (hasClassFeatureNamed(charData, /two-weapon fighting/i)) return true;
  if (isRangedWeapon(item) && hasClassFeatureNamed(charData, /crossbow expert/i)) return true;
  return false;
}

export function isShieldItem(item: InventoryItem): boolean {
  const type = String(item.type ?? "").toLowerCase();
  const name = String(item.name ?? "").toLowerCase();
  return type.includes("shield") || (name.includes("shield") && !name.includes("torch"));
}

export function getEquipState(item: InventoryItem): EquipState {
  if (item.equipState) return item.equipState;
  if (item.equipped) return isArmorItem(item) ? "worn" : "mainhand-1h";
  return "backpack";
}

export function isWeaponItem(item: InventoryItem): boolean {
  return Boolean(item.dmg1) || /weapon/i.test(item.type ?? "") || /\bstaff\b/i.test(item.type ?? "");
}

export function parseItemSpells(text: string): ParsedItemSpell[] {
  const results: ParsedItemSpell[] = [];
  const lines = text.split("\n");
  let inTable = false;
  for (const line of lines) {
    const t = line.trim();
    if (/spell\s*\|.*charge/i.test(t)) { inTable = true; continue; }
    if (inTable) {
      const m = t.match(/^(.+?)\s*\|\s*(\d+)/);
      if (m) results.push({ name: m[1].trim(), cost: parseInt(m[2], 10) });
      else if (t && !t.includes("|")) inTable = false;
    }
  }
  return results;
}

export function parseChargesMax(text: string): number | null {
  const m = text.match(/has (\d+) charges?/i);
  if (m) return parseInt(m[1], 10);
  return null;
}

export function hasItemProperty(item: InventoryItem, code: string): boolean {
  return (item.properties ?? []).some((p) => String(p).trim().toUpperCase() === code.toUpperCase());
}

function hasDualWielder(charData: CharacterDataLike | null): boolean {
  return (charData?.chosenOptionals ?? []).some((f) => /dual wield/i.test(f));
}

export function canEquipOffhand(item: InventoryItem, charData: CharacterDataLike | null): boolean {
  if (isShieldOrTorch(item)) return true;
  if (!isWeaponItem(item)) return false;
  if (hasItemProperty(item, "L")) return true;
  if (hasDualWielder(charData) && (hasItemProperty(item, "F") || hasItemProperty(item, "V"))) return true;
  return false;
}

export function canUseTwoHands(item: InventoryItem): boolean {
  return isWeaponItem(item) && Boolean(item.dmg2);
}

function isMartialWeapon(item: InventoryItem): boolean {
  return hasItemProperty(item, "M");
}

export function isRangedWeapon(item: InventoryItem): boolean {
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

export function weaponAbilityMod(item: InventoryItem, char: CharacterLike): number {
  const strMod = abilityMod(char.strScore);
  const dexMod = abilityMod(char.dexScore);
  if (hasItemProperty(item, "F")) return Math.max(strMod, dexMod);
  if (isRangedWeapon(item)) return dexMod;
  return strMod;
}

export function weaponDamageDice(item: InventoryItem, state: "mainhand-1h" | "mainhand-2h" | "offhand"): string | null {
  if (state === "mainhand-2h") return item.dmg2 ?? item.dmg1 ?? defaultWeaponDamageDice(item, state);
  return item.dmg1 ?? item.dmg2 ?? defaultWeaponDamageDice(item, state);
}

export function totalInventoryWeight(items: InventoryItem[], containers: InventoryContainer[] = []): number {
  const ignoredContainerIds = new Set(
    containers
      .filter((container) => container.ignoreWeight)
      .map((container) => container.id)
  );
  return items.reduce((sum, item) => {
    if (item.containerId && ignoredContainerIds.has(item.containerId)) return sum;
    const weight = typeof item.weight === "number" && Number.isFinite(item.weight) ? item.weight : 0;
    const qty = typeof item.quantity === "number" && Number.isFinite(item.quantity) ? item.quantity : 1;
    return sum + (weight * Math.max(1, qty));
  }, 0);
}

export function formatWeight(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

export function hasWeaponProficiency(item: InventoryItem, prof: ProficiencyMapLike | undefined): boolean {
  const names = (prof?.weapons ?? []).map((w) => w.name.toLowerCase());
  const itemName = item.name.replace(/\s+\[2024\]\s*$/i, "").toLowerCase();
  if (names.some((n) => n === itemName || itemName.includes(n) || n.includes(itemName))) return true;
  if (isMartialWeapon(item) && names.some((n) => n.includes("martial weapon"))) return true;
  if (isWeaponItem(item) && names.some((n) => n.includes("simple weapon"))) return true;
  return false;
}

export function conditionDisplayWeaponMeta(item: InventoryItem): string {
  const meta = [
    item.rarity ? titleCase(item.rarity) : null,
    item.type ?? null,
    item.attunement ? "Attunement" : null,
    item.magic ? "Magic" : null,
  ].filter(Boolean);
  return meta.join(" • ");
}
