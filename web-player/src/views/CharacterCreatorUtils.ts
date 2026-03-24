import type { Ruleset } from "@/lib/characterRules";
import { abilityMod } from "@/views/CharacterSheetUtils";
import {
  ABILITY_NAME_TO_KEY,
  ABILITY_SCORE_NAMES,
  ALL_LANGUAGES,
  ALL_SKILLS,
  ALL_TOOLS,
  WEAPON_MASTERY_KINDS,
  WEAPON_MASTERY_KIND_SET,
} from "@/views/CharacterCreatorConstants";

export { abilityMod };

const SKILL_NAMES = ALL_SKILLS.map((skill) => skill.name);

interface CreatorFeatureLike {
  name: string;
  text: string;
  optional: boolean;
}

interface CreatorAutolevelLike {
  level: number;
  slots: number[] | null;
  features: CreatorFeatureLike[];
}

export interface CreatorClassDetailLike {
  autolevels: CreatorAutolevelLike[];
}

export interface CreatorItemSummaryLike {
  name: string;
  type: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
}

export interface CreatorParsedFeatChoiceLike {
  type: "proficiency" | "expertise" | "ability_score" | "spell" | "spell_list" | "weapon_mastery" | "damage_type";
  options: unknown[] | null;
  anyOf?: string[];
}

export interface CreatorRaceTraitLike {
  name: string;
  text: string;
}

export interface RaceChoices {
  hasChosenSize: boolean;
  skillChoice: { count: number; from: string[] | null } | null;
  toolChoice: { count: number; from: string[] | null } | null;
  languageChoice: { count: number; from: string[] | null } | null;
  hasFeatChoice: boolean;
}

export interface StartingEquipmentOption {
  id: string;
  entries: string[];
  text: string;
}

export function abilityNamesToKeys(names: string[]): string[] {
  return names.map((name) => ABILITY_NAME_TO_KEY[name.toLowerCase()] ?? "").filter(Boolean);
}

export function normalizeChoiceKey(value: unknown): string {
  if (typeof value === "string") {
    return value.trim().toLowerCase().replace(/[\s'-]+/g, " ");
  }
  if (typeof value === "number" || typeof value === "boolean") {
    return String(value).trim().toLowerCase().replace(/[\s'-]+/g, " ");
  }
  if (value && typeof value === "object") {
    const named = (value as { name?: unknown }).name;
    if (typeof named === "string") {
      return named.trim().toLowerCase().replace(/[\s'-]+/g, " ");
    }
  }
  return "";
}

export function calcHpMax(hd: number, level: number, conMod: number): number {
  if (level <= 0) return hd + conMod;
  return hd + conMod + (level - 1) * (Math.floor(hd / 2) + 1 + conMod);
}

export function getSubclassLevel(cls: CreatorClassDetailLike | null): number | null {
  if (!cls) return null;
  for (const al of cls.autolevels) {
    for (const feature of al.features) {
      if (/subclass/i.test(feature.name) && !feature.optional) return al.level;
    }
  }
  return null;
}

export function featuresUpToLevel(cls: CreatorClassDetailLike, level: number) {
  return cls.autolevels
    .filter((al) => al.level != null && al.level <= level)
    .flatMap((al) => al.features.filter((feature) => !feature.optional).map((feature) => ({ ...feature, level: al.level })));
}

export function getSubclassList(cls: CreatorClassDetailLike): string[] {
  const names: string[] = [];
  for (const al of cls.autolevels) {
    for (const feature of al.features) {
      if (feature.optional && /subclass:/i.test(feature.name)) {
        const label = feature.name.replace(/^[^:]+:\s*/i, "").trim();
        if (label && !names.includes(label)) names.push(label);
      }
    }
  }
  return names;
}

export function parseLevelTable(text: string): [number, number][] {
  const pairs: [number, number][] = [];
  let inTable = false;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!inTable) {
      if (/\blevel\b/i.test(line) && /\|/.test(line) && !/^\d/.test(line)) inTable = true;
      continue;
    }
    const match = line.match(/^(\d+)\s*\|?\s*(\d+)/);
    if (match) {
      pairs.push([parseInt(match[1]), parseInt(match[2])]);
    } else if (line.length > 0 && !/^\d/.test(line)) {
      break;
    }
  }
  return pairs.sort((a, b) => a[0] - b[0]);
}

export function tableValueAtLevel(table: [number, number][], level: number): number {
  let result = 0;
  for (const [lvl, val] of table) {
    if (lvl <= level) result = val;
  }
  return result;
}

export function getSlotsAtLevel(cls: CreatorClassDetailLike, level: number): number[] | null {
  let best: number[] | null = null;
  for (const al of cls.autolevels) {
    if (al.level != null && al.level <= level && al.slots != null) best = al.slots;
  }
  return best;
}

export function getCantripCount(cls: CreatorClassDetailLike, level: number): number {
  return getSlotsAtLevel(cls, level)?.[0] ?? 0;
}

export function getMaxSlotLevel(cls: CreatorClassDetailLike, level: number): number {
  const slots = getSlotsAtLevel(cls, level);
  if (!slots) return 0;
  for (let i = slots.length - 1; i >= 1; i--) {
    if (slots[i] > 0) return i;
  }
  return 0;
}

export function isSpellcaster(cls: CreatorClassDetailLike): boolean {
  return cls.autolevels.some((al) => al.slots != null && al.slots.slice(1).some((slot) => slot > 0));
}

export function getClassFeatureTable(cls: CreatorClassDetailLike, keyword: string, level: number): [number, number][] {
  for (const al of cls.autolevels) {
    if (al.level == null || al.level > level) continue;
    for (const feature of al.features) {
      if (!feature.optional && new RegExp(keyword, "i").test(feature.name)) {
        const table = parseLevelTable(feature.text);
        if (table.length > 0) return table;
      }
    }
  }
  return [];
}

export function parseSkillList(proficiency: string): string[] {
  return proficiency.split(/[,;]/).map((s) => s.trim()).filter((s) => s && !ABILITY_SCORE_NAMES.has(s));
}

export function wordOrNumberToInt(value: string): number | null {
  const lowered = value.trim().toLowerCase();
  const numeric = Number.parseInt(lowered, 10);
  if (Number.isFinite(numeric)) return numeric;
  const words: Record<string, number> = { one: 1, two: 2, three: 3, four: 4, five: 5, six: 6 };
  return words[lowered] ?? null;
}

export function baseWeaponKind(name: string): string {
  return name.replace(/\s*\[[^\]]+\]\s*$/u, "").trim();
}

export function getWeaponMasteryOptions(items: CreatorItemSummaryLike[]): string[] {
  const kinds = new Set<string>();
  for (const item of items) {
    if (!/weapon/i.test(item.type ?? "")) continue;
    if (item.magic || item.attunement || item.rarity) continue;
    const kind = baseWeaponKind(item.name);
    if (!WEAPON_MASTERY_KIND_SET.has(kind)) continue;
    kinds.add(kind);
  }
  return [...kinds].sort((a, b) => a.localeCompare(b));
}

function normalizeFeatChoiceOption(option: unknown): string | null {
  if (typeof option === "string") return option;
  if (typeof option === "number" || typeof option === "boolean") return String(option);
  if (option && typeof option === "object") {
    const record = option as { name?: unknown; abil?: unknown };
    if (typeof record.name === "string" && typeof record.abil === "string" && record.abil.trim()) {
      return `${record.name} (${record.abil})`;
    }
    if (typeof record.name === "string") return record.name;
  }
  return null;
}

export function getFeatChoiceOptions(choice: CreatorParsedFeatChoiceLike): string[] {
  if (choice.type === "weapon_mastery") return [...WEAPON_MASTERY_KINDS];
  if (choice.options && choice.options.length > 0) {
    return choice.options
      .map(normalizeFeatChoiceOption)
      .filter((value): value is string => Boolean(value))
      .sort((a, b) => a.localeCompare(b));
  }
  const combined = new Set<string>();
  for (const kind of choice.anyOf ?? []) {
    if (kind === "skill") SKILL_NAMES.forEach((item) => combined.add(item));
    if (kind === "tool") ALL_TOOLS.forEach((item) => combined.add(item));
    if (kind === "language") ALL_LANGUAGES.forEach((item) => combined.add(item));
  }
  return [...combined].sort((a, b) => a.localeCompare(b));
}

export function classifyFeatSelection(
  choice: CreatorParsedFeatChoiceLike,
  value: string,
): "skill" | "tool" | "language" | "weapon_mastery" | null {
  if (choice.type === "weapon_mastery") return "weapon_mastery";
  if (choice.anyOf?.length === 1) {
    const only = choice.anyOf[0];
    if (only === "skill" || only === "tool" || only === "language") return only;
  }
  if (SKILL_NAMES.includes(value)) return "skill";
  if (ALL_TOOLS.includes(value)) return "tool";
  if (ALL_LANGUAGES.includes(value)) return "language";
  if (WEAPON_MASTERY_KIND_SET.has(value)) return "weapon_mastery";
  return null;
}

export function parseRaceChoices5e(traits: CreatorRaceTraitLike[]): RaceChoices {
  let skillChoice: RaceChoices["skillChoice"] = null;
  let toolChoice: RaceChoices["toolChoice"] = null;
  let languageChoice: RaceChoices["languageChoice"] = null;

  for (const trait of traits) {
    const text = trait.text;
    const skillListMatch = text.match(/proficiency in the\s+([\w\s,]+?)\s+skills?\b/i);
    if (skillListMatch) {
      const from = skillListMatch[1]
        .split(/,\s*|\s+or\s+/i)
        .map((s) => s.trim())
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .filter((s) => SKILL_NAMES.includes(s));
      if (from.length > 0 && !skillChoice) skillChoice = { count: 1, from };
    } else if (
      /one skill proficiency|proficiency in one skill|gain proficiency in one skill of your choice/i.test(text) ||
      /one skill of your choice/i.test(text)
    ) {
      if (!skillChoice) skillChoice = { count: 1, from: null };
    }

    if (/one tool proficiency of your choice/i.test(text)) {
      if (!toolChoice) toolChoice = { count: 1, from: null };
    }

    const langListMatch = text.match(/your choice of (\w+)\s+of the following[^:]*languages?:\s*([^\n.]+)/i);
    if (langListMatch) {
      const count = wordOrNumberToInt(langListMatch[1]) ?? 1;
      const from = langListMatch[2]
        .split(/[,\n\t]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "));
      if (!languageChoice) languageChoice = { count, from: from.length > 0 ? from : null };
    } else if (/one(?:\s+extra)?\s+language.*(?:of your )?choice/i.test(text)) {
      if (!languageChoice) languageChoice = { count: 1, from: null };
    }
  }

  return { hasChosenSize: false, skillChoice, toolChoice, languageChoice, hasFeatChoice: false };
}

export function parseRaceChoices55e(traits: CreatorRaceTraitLike[]): RaceChoices {
  let hasChosenSize = false;
  let skillChoice: RaceChoices["skillChoice"] = null;
  let toolChoice: RaceChoices["toolChoice"] = null;
  let languageChoice: RaceChoices["languageChoice"] = null;
  let hasFeatChoice = false;

  for (const trait of traits) {
    const text = trait.text;
    if (/^size$/i.test(trait.name) && /chosen when you select/i.test(text)) hasChosenSize = true;
    if (/origin feat of your choice/i.test(text)) hasFeatChoice = true;

    const skillListMatch = text.match(/proficiency in the\s+([\w\s,]+?)\s+skills?\b/i);
    if (skillListMatch) {
      const from = skillListMatch[1]
        .split(/,\s*|\s+or\s+/i)
        .map((s) => s.trim())
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
        .filter((s) => SKILL_NAMES.includes(s));
      if (from.length > 0 && !skillChoice) skillChoice = { count: 1, from };
    } else if (
      /one skill proficiency|proficiency in one skill|gain proficiency in one skill of your choice/i.test(text) ||
      /one skill of your choice/i.test(text)
    ) {
      if (!skillChoice) skillChoice = { count: 1, from: null };
    }

    if (/one tool proficiency of your choice/i.test(text)) {
      if (!toolChoice) toolChoice = { count: 1, from: null };
    }

    const langListMatch = text.match(/your choice of (\w+)\s+of the following[^:]*languages?:\s*([^\n.]+)/i);
    if (langListMatch) {
      const count = wordOrNumberToInt(langListMatch[1]) ?? 1;
      const from = langListMatch[2]
        .split(/[,\n\t]+/)
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => s.split(/\s+/).map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join(" "));
      if (!languageChoice) languageChoice = { count, from: from.length > 0 ? from : null };
    } else if (/one(?:\s+extra)?\s+language.*(?:of your )?choice/i.test(text)) {
      if (!languageChoice) languageChoice = { count: 1, from: null };
    }
  }

  return { hasChosenSize, skillChoice, toolChoice, languageChoice, hasFeatChoice };
}

export function parseRaceChoicesByRuleset(ruleset: Ruleset, traits: CreatorRaceTraitLike[]): RaceChoices {
  return ruleset === "5.5e" ? parseRaceChoices55e(traits) : parseRaceChoices5e(traits);
}

export function parseStartingEquipmentOptions(equipment: string | undefined): StartingEquipmentOption[] {
  if (!equipment) return [];
  const normalized = equipment
    .replace(/\r/g, "")
    .replace(/Choose\s+A\s+or\s+8/gi, "Choose A or B")
    .replace(/\(8\)/g, "(B)")
    .replace(/â€¢/g, "")
    .replace(/\s+/g, " ")
    .trim();
  const matches = [...normalized.matchAll(/\(([A-Z])\)\s*([\s\S]*?)(?=(?:;\s*or\s*\([A-Z]\))|(?:;\s*\([A-Z]\))|$)/g)];
  return matches
    .map((match) => ({
      id: match[1] ?? "",
      text: (match[2] ?? "").trim().replace(/;$/, ""),
      entries: splitEquipmentEntries((match[2] ?? "").trim()),
    }))
    .filter((option) => option.id && option.entries.length > 0);
}

export function splitEquipmentEntries(text: string): string[] {
  return text
    .replace(/\s+or\s+$/i, "")
    .replace(/\s+and\s+/gi, ", ")
    .split(/\s*,\s*/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function extractClassStartingEquipment(classDetail: CreatorClassDetailLike | null): string {
  if (!classDetail) return "";
  for (const al of classDetail.autolevels) {
    if (al.level !== 1) continue;
    for (const feature of al.features) {
      const match = feature.text.match(/Starting Equipment:\s*([^\n]+)/i);
      if (match?.[1]) return match[1].trim();
    }
  }
  return "";
}
