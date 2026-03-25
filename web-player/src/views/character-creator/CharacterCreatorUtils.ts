import { wordOrNumberToInt, type Ruleset, type RaceChoices } from "@/lib/characterRules";
import { abilityMod } from "@/views/character/CharacterSheetUtils";
import {
  ABILITY_NAME_TO_KEY,
  ABILITY_SCORE_NAMES,
  ARMOR_PROFICIENCY_OPTIONS,
  ALL_LANGUAGES,
  ALL_SKILLS,
  ALL_TOOLS,
  SAVING_THROW_OPTIONS,
  WEAPON_PROFICIENCY_OPTIONS,
  WEAPON_MASTERY_KINDS,
  WEAPON_MASTERY_KIND_SET,
} from "@/views/character-creator/CharacterCreatorConstants";

export { abilityMod };

const SKILL_NAMES = ALL_SKILLS.map((skill) => skill.name);

interface CreatorFeatureLike {
  name: string;
  text: string;
  optional?: boolean;
  subclass?: string | null;
}

interface CreatorAutolevelLike {
  level: number;
  slots: number[] | null;
  features?: CreatorFeatureLike[];
}

export interface CreatorClassDetailLike {
  autolevels: CreatorAutolevelLike[];
}

export interface ClassExpertiseChoice {
  key: string;
  source: string;
  count: number;
  options: string[] | null;
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

export type { RaceChoices };

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

function normalizeSubclassName(value: string | null | undefined): string {
  return String(value ?? "").trim().toLowerCase();
}

export function getFeatureSubclassName(feature: CreatorFeatureLike): string | null {
  const explicit = String(feature.subclass ?? "").trim();
  if (explicit) return explicit;
  const namedSubclass = String(feature.name ?? "").match(/\(([^()]+)\)\s*$/);
  if (namedSubclass?.[1]) return namedSubclass[1].trim();
  const chooserMatch = String(feature.name ?? "").match(/subclass:\s*(.+)$/i);
  if (chooserMatch?.[1]) return chooserMatch[1].trim();
  return null;
}

export function isSubclassChoiceFeature(feature: CreatorFeatureLike): boolean {
  const name = String(feature.name ?? "").trim();
  return /subclass:/i.test(name) || /^becoming\b/i.test(name);
}

export function featureMatchesSubclass(feature: CreatorFeatureLike, selectedSubclass: string | null | undefined): boolean {
  const featureSubclass = getFeatureSubclassName(feature);
  if (!featureSubclass) return true;
  if (isSubclassChoiceFeature(feature)) return false;
  return normalizeSubclassName(featureSubclass) === normalizeSubclassName(selectedSubclass);
}

function getRelevantClassFeatures(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): CreatorFeatureLike[] {
  return cls.autolevels
    .filter((al) => al.level != null && al.level <= level)
    .flatMap((al) =>
      (al.features ?? []).filter((feature) => featureMatchesSubclass(feature, selectedSubclass) && !isSubclassChoiceFeature(feature))
    );
}

function getSpellcastingFeature(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): CreatorFeatureLike | null {
  const relevant = getRelevantClassFeatures(cls, level, selectedSubclass);
  return relevant.find((feature) => /(pact magic|spellcasting)/i.test(feature.name)) ?? null;
}

export function getSpellcastingClassName(cls: CreatorClassDetailLike | null, level: number, selectedSubclass?: string | null): string | null {
  if (!cls) return null;
  const feature = getSpellcastingFeature(cls, level, selectedSubclass);
  if (!feature) return null;
  const fromList = feature.text.match(/from the ([A-Za-z' -]+?) spell list/i);
  if (fromList?.[1]) return fromList[1].trim();
  const spellType = feature.text.match(/for your ([A-Za-z' -]+?) spells/i);
  if (spellType?.[1]) return spellType[1].trim();
  return null;
}

export function getSubclassLevel(cls: CreatorClassDetailLike | null): number | null {
  if (!cls) return null;
  for (const al of cls.autolevels) {
    for (const feature of al.features ?? []) {
      if (/subclass/i.test(feature.name) && !feature.optional) return al.level;
    }
  }
  return null;
}

export function featuresUpToLevel(cls: CreatorClassDetailLike, level: number) {
  return cls.autolevels
    .filter((al) => al.level != null && al.level <= level)
    .flatMap((al) => (al.features ?? []).filter((feature) => !feature.optional).map((feature) => ({ ...feature, level: al.level })));
}

export function featuresUpToLevelForSubclass(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null) {
  return cls.autolevels
    .filter((al) => al.level != null && al.level <= level)
    .flatMap((al) =>
      (al.features ?? [])
        .filter((feature) => (!feature.optional || Boolean(getFeatureSubclassName(feature))) && featureMatchesSubclass(feature, selectedSubclass) && !isSubclassChoiceFeature(feature))
        .map((feature) => ({ ...feature, level: al.level }))
    );
}

export function getSubclassList(cls: CreatorClassDetailLike): string[] {
  const names: string[] = [];
  for (const al of cls.autolevels) {
    for (const feature of al.features ?? []) {
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

export function getCantripCount(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): number {
  const slotCount = getSlotsAtLevel(cls, level)?.[0] ?? 0;
  if (slotCount > 0) return slotCount;
  const spellcastingFeature = getSpellcastingFeature(cls, level, selectedSubclass);
  if (!spellcastingFeature) return 0;
  const knownMatch = spellcastingFeature.text.match(/you know (\w+) cantrips?/i);
  let known = wordOrNumberToInt(knownMatch?.[1] ?? "") ?? 0;
  for (const match of spellcastingFeature.text.matchAll(/when you reach [A-Za-z]+ level (\d+), you learn another [^.]*?cantrip/gi)) {
    const unlockLevel = Number(match[1]);
    if (Number.isFinite(unlockLevel) && level >= unlockLevel) known += 1;
  }
  return known;
}

export function getMaxSlotLevel(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): number {
  const slots = getSlotsAtLevel(cls, level);
  if (slots) {
    for (let i = slots.length - 1; i >= 1; i--) {
      if (slots[i] > 0) return i;
    }
  }
  const spellcastingFeature = getSpellcastingFeature(cls, level, selectedSubclass);
  if (spellcastingFeature && getFeatureSubclassName(spellcastingFeature)) {
    if (level >= 19) return 4;
    if (level >= 13) return 3;
    if (level >= 7) return 2;
    if (level >= 3) return 1;
  }
  return 0;
}

export function isSpellcaster(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): boolean {
  return getCantripCount(cls, level, selectedSubclass) > 0 || getMaxSlotLevel(cls, level, selectedSubclass) > 0 || getPreparedSpellCount(cls, level, selectedSubclass) > 0;
}

export function getClassFeatureTable(cls: CreatorClassDetailLike, keyword: string, level: number, selectedSubclass?: string | null): [number, number][] {
  for (const al of cls.autolevels) {
    if (al.level == null || al.level > level) continue;
    for (const feature of al.features ?? []) {
      if (!featureMatchesSubclass(feature, selectedSubclass) || isSubclassChoiceFeature(feature)) continue;
      if ((!feature.optional || Boolean(getFeatureSubclassName(feature))) && new RegExp(keyword, "i").test(feature.name)) {
        const table = parseLevelTable(feature.text);
        if (table.length > 0) return table;
      }
    }
  }
  return [];
}

export function getPreparedSpellCount(cls: CreatorClassDetailLike, level: number, selectedSubclass?: string | null): number {
  const prepTable = getClassFeatureTable(cls, "Prepared Spells|Pact Magic|Spellcasting", level, selectedSubclass);
  return prepTable.length > 0 ? tableValueAtLevel(prepTable, level) : 0;
}

export function parseSkillList(proficiency: string): string[] {
  return proficiency.split(/[,;]/).map((s) => s.trim()).filter((s) => s && !ABILITY_SCORE_NAMES.has(s));
}

export { wordOrNumberToInt };

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
    if (kind === "armor") ARMOR_PROFICIENCY_OPTIONS.forEach((item) => combined.add(item));
    if (kind === "weapon") WEAPON_PROFICIENCY_OPTIONS.forEach((item) => combined.add(item));
    if (kind === "saving_throw" || kind === "save") SAVING_THROW_OPTIONS.forEach((item) => combined.add(item));
  }
  return [...combined].sort((a, b) => a.localeCompare(b));
}

export function classifyFeatSelection(
  choice: CreatorParsedFeatChoiceLike,
  value: string,
): "skill" | "tool" | "language" | "armor" | "weapon" | "saving_throw" | "weapon_mastery" | null {
  if (choice.type === "weapon_mastery") return "weapon_mastery";
  if (choice.anyOf?.length === 1) {
    const only = choice.anyOf[0];
    if (only === "skill" || only === "tool" || only === "language") return only;
    if (only === "armor" || only === "weapon") return only;
    if (only === "saving_throw" || only === "save") return "saving_throw";
  }
  if (SKILL_NAMES.includes(value)) return "skill";
  if (ALL_TOOLS.includes(value)) return "tool";
  if (ALL_LANGUAGES.includes(value)) return "language";
  if (ARMOR_PROFICIENCY_OPTIONS.some((item) => item.toLowerCase() === value.toLowerCase())) return "armor";
  if (WEAPON_PROFICIENCY_OPTIONS.some((item) => item.toLowerCase() === value.toLowerCase())) return "weapon";
  if (SAVING_THROW_OPTIONS.some((item) => item.toLowerCase() === value.toLowerCase())) return "saving_throw";
  if (WEAPON_MASTERY_KIND_SET.has(value)) return "weapon_mastery";
  return null;
}

export function getClassExpertiseChoices(cls: CreatorClassDetailLike | null, level: number): ClassExpertiseChoice[] {
  if (!cls) return [];
  const choices: ClassExpertiseChoice[] = [];
  const seen = new Set<string>();
  for (const al of cls.autolevels) {
    if (al.level == null || al.level > level) continue;
    for (const feature of al.features ?? []) {
      if (feature.optional) continue;
      const name = String(feature.name ?? "").trim();
      const text = String(feature.text ?? "").trim();
      if (!name || !text) continue;

      let count: number | null = null;
      let options: string[] | null = null;

      const explicitMatch = text.match(/Choose\s+(one|two|three|four|\d+)\s+of (?:the following )?skills?[^:]*:\s*([^.]+)/i);
      if (explicitMatch) {
        count = wordOrNumberToInt(explicitMatch[1] ?? "") ?? 1;
        options = (explicitMatch[2] ?? "")
          .split(/,\s*|\s+or\s+/i)
          .map((s) => s.trim())
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
          .filter((s) => SKILL_NAMES.includes(s));
      } else {
        const generalMatch = text.match(/gain Expertise in\s+(one|two|three|four|\d+)(?:\s+more)?\s+of your skill proficiencies of your choice/i);
        if (generalMatch) {
          count = wordOrNumberToInt(generalMatch[1] ?? "") ?? 1;
        }
      }

      if (!count || count <= 0) continue;
      const key = `classexpertise:${al.level}:${name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      choices.push({ key, source: name, count, options: options && options.length > 0 ? options : null });
    }
  }
  return choices;
}

export function parseRaceChoices(traits: CreatorRaceTraitLike[]): RaceChoices {
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
    for (const feature of al.features ?? []) {
      const match = feature.text.match(/Starting Equipment:\s*([^\n]+)/i);
      if (match?.[1]) return match[1].trim();
    }
  }
  return "";
}

