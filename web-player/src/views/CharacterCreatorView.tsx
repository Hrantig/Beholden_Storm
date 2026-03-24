import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { C } from "@/lib/theme";
import {
  getBackgroundFeatChoices,
  getBackgroundFeatChoicesByRuleset,
  inferRulesetFromLabel,
  matchesRuleset,
  matchesRulesetLabel,
  type BackgroundFeatChoiceEntry,
  type Ruleset,
} from "@/lib/characterRules";
import { api, jsonInit } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import { invocationPrerequisitesMet, spellLooksLikeDamageSpell } from "@/views/CharacterSheetUtils";
import {
  ABILITY_NAME_TO_KEY,
  ABILITY_KEYS,
  ABILITY_LABELS,
  ABILITY_SCORE_NAMES,
  ALL_LANGUAGES,
  ALL_SKILLS,
  ALL_TOOLS,
  MUSICAL_INSTRUMENTS,
  POINT_BUY_BUDGET,
  POINT_BUY_COSTS,
  STANDARD_ARRAY,
  STANDARD_55E_LANGUAGES,
  WEAPON_MASTERY_KINDS,
  WEAPON_MASTERY_KIND_SET,
} from "@/views/CharacterCreatorConstants";
import {
  abilityMod,
  abilityNamesToKeys,
  calcHpMax,
  classifyFeatSelection,
  extractClassStartingEquipment,
  featuresUpToLevel,
  getCantripCount,
  getClassFeatureTable,
  getFeatChoiceOptions,
  getMaxSlotLevel,
  getSubclassLevel,
  getSubclassList,
  normalizeChoiceKey,
  getWeaponMasteryOptions,
  isSpellcaster,
  parseRaceChoicesByRuleset,
  parseSkillList,
  parseStartingEquipmentOptions,
  tableValueAtLevel,
  wordOrNumberToInt,
} from "@/views/CharacterCreatorUtils";
import { Select } from "@/ui/Select";
import { NavButtons, SpellPicker, StepHeader } from "@/views/CharacterCreatorParts";
import {
  detailBoxStyle,
  headingStyle,
  inputStyle,
  labelStyle,
  profChipStyle,
  smallBtnStyle,
  sourceTagStyle,
  statLabelStyle,
  statValueStyle,
} from "@/views/CharacterCreatorStyles";
import {
  renderAbilityScoresStep,
  renderCampaignsStep,
  renderClassStep,
  renderDerivedStatsStep,
  renderIdentityStep,
  renderLevelStep,
  renderSpeciesStep,
  renderSpellsStep,
} from "@/views/CharacterCreatorStepPanels";
import { normalizeInventoryItemLookupName } from "@/views/CharacterInventory";
import type { ProficiencyMap, TaggedItem } from "@/views/CharacterSheetTypes";

// ---------------------------------------------------------------------------
// API types
// ---------------------------------------------------------------------------

interface ClassSummary { id: string; name: string; hd: number | null; ruleset?: Ruleset | null }
interface ClassDetail {
  id: string; name: string; hd: number | null; ruleset?: Ruleset | null;
  numSkills: number;        // how many skill proficiencies to pick
  proficiency: string;      // comma-separated skill options
  slotsReset: string;       // "L" = long rest, "S" = short rest (Warlock)
  armor: string; weapons: string;
  description: string;
  autolevels: {
    level: number; scoreImprovement: boolean;
    slots: number[] | null; // [cantrips, L1_slots, L2_slots, ...] or null
    features: { name: string; text: string; optional: boolean }[];
    counters: { name: string; value: number; reset: string }[];
  }[];
}
interface SpellSummary { id: string; name: string; level: number | null; school: string | null; classes: string | null; text: string | null }
interface ItemSummary {
  id: string;
  name: string;
  type: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
  weight?: number | null;
  value?: number | null;
  ac?: number | null;
  stealthDisadvantage?: boolean;
  dmg1?: string | null;
  dmg2?: string | null;
  dmgType?: string | null;
  properties?: string[];
}
interface RaceSummary { id: string; name: string; size: string | null; speed: number | null; ruleset?: Ruleset | null }
interface RaceDetail {
  id: string; name: string; size: string | null; speed: number | null; ruleset?: Ruleset | null;
  resist: string | null;
  vision: { type: string; range: number }[];
  parsedChoices?: import("@/lib/characterRules").RaceChoices;
  traits: { name: string; text: string; category: string | null; modifier: string[] }[];
}
interface BgSummary { id: string; name: string; ruleset?: Ruleset | null }
interface ProficiencyChoice {
  fixed: string[];
  choose: number;
  from: string[] | null;  // null = "any"
}
interface ParsedFeatChoice {
  id: string;
  type: "proficiency" | "expertise" | "ability_score" | "spell" | "spell_list" | "weapon_mastery" | "damage_type";
  count: number;
  options: string[] | null;
  anyOf?: string[];
  amount?: number | null;
  level?: number | null;
  linkedTo?: string | null;
  distinct?: boolean;
  note?: string | null;
}
interface ParsedFeatGrants {
  skills: string[];
  tools: string[];
  languages: string[];
  armor: string[];
  weapons: string[];
  savingThrows: string[];
  spells: string[];
  cantrips: string[];
  abilityIncreases: Record<string, number>;
  bonuses: Array<{ target: string; value: number }>;
}
interface ParsedFeat {
  category: string | null;
  baseName: string;
  variant: string | null;
  prerequisite: string | null;
  repeatable: boolean;
  source: string | null;
  grants: ParsedFeatGrants;
  choices: ParsedFeatChoice[];
}
interface BackgroundFeat {
  name: string;
  text?: string;
  parsed: ParsedFeat;
}
interface StructuredBgProficiencies {
  skills: ProficiencyChoice;
  tools: ProficiencyChoice;
  languages: ProficiencyChoice;
  feats: BackgroundFeat[];
  featChoice: number;
  abilityScores: string[];
}
interface BgDetail {
  id: string; name: string; proficiency: string; ruleset?: Ruleset | null;
  proficiencies?: StructuredBgProficiencies;
  traits: { name: string; text: string }[];
  equipment?: string;
}
interface InventoryItemSeed {
  id: string;
  name: string;
  quantity: number;
  equipped: boolean;
  equipState?: "backpack" | "mainhand-1h" | "mainhand-2h" | "offhand";
  notes?: string;
  source?: "compendium" | "custom";
  itemId?: string;
  type?: string | null;
  rarity?: string | null;
  magic?: boolean;
  attunement?: boolean;
}

interface ClassFeatureEntry {
  id: string;
  name: string;
  text: string;
}



/** Compile the full proficiency map with source tags from all wizard selections. */
// ---------------------------------------------------------------------------
// Feature grant parsing
// ---------------------------------------------------------------------------

interface FeatureGrants {
  armor: string[];
  weapons: string[];
  tools: string[];
  skills: string[];
  languages: string[];
}

interface WeaponMasteryChoice {
  source: string;
  count: number;
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, w => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

/** Parse proficiency grants out of an optional feature's text blob. */
function parseFeatureGrants(text: string): FeatureGrants {
  const result: FeatureGrants = { armor: [], weapons: [], tools: [], skills: [], languages: [] };
  // Strip source lines and flatten newlines
  const t = text.replace(/Source:.*$/gim, "").replace(/\n/g, " ");

  // Armor — "training with X armor" or "proficiency with X armor"
  const armorRe = /(?:training with|proficiency with)\s+([\w\s,]+?)\s+armor\b/gi;
  let m: RegExpExecArray | null;
  while ((m = armorRe.exec(t)) !== null) {
    m[1].split(/\s+and\s+|,/).map(s => s.trim()).filter(Boolean)
      .forEach(s => { if (!/^all$/i.test(s)) result.armor.push(toTitleCase(s) + " Armor"); else result.armor.push("All Armor"); });
  }

  // Weapons — "proficiency with X weapons" (won't overlap with armor)
  const weapRe = /proficiency with\s+([\w\s,]+?)\s+weapons\b/gi;
  while ((m = weapRe.exec(t)) !== null) {
    m[1].split(/\s+and\s+|,/).map(s => s.trim()).filter(Boolean)
      .forEach(s => result.weapons.push(toTitleCase(s) + " Weapons"));
  }

  // Tools — "proficiency with X Tools/Kit/Instruments/Supplies"
  const toolRe = /proficiency with\s+([\w\s']+?(?:tools?|kit|instruments?|supplies))\b/gi;
  while ((m = toolRe.exec(t)) !== null) {
    result.tools.push(toTitleCase(m[1].trim()));
  }

  // Skills — "proficiency in X" (single known skill name)
  const skillRe = /proficiency in\s+([\w\s]+?)(?:\.|,|\band\b|$)/gi;
  while ((m = skillRe.exec(t)) !== null) {
    result.skills.push(toTitleCase(m[1].trim()));
  }

  // Languages — "learn/speak/know X language"
  const langRe = /(?:learn|speak|know|understand)\s+(?:the\s+)?([\w]+)\s+language/gi;
  while ((m = langRe.exec(t)) !== null) {
    result.languages.push(toTitleCase(m[1]));
  }

  return result;
}


function getCore55eLanguageChoice(raceDetail: RaceDetail | null, ruleset: Ruleset | null) {
  if (ruleset !== "5.5e") return null;
  const hasExplicitLanguageTrait = (raceDetail?.traits ?? []).some((t) => /^languages?$/i.test(t.name));
  if (hasExplicitLanguageTrait) return null;
  return {
    fixed: ["Common"],
    choose: 2,
    from: STANDARD_55E_LANGUAGES,
    source: "Core 5.5e",
  };
}

function getBackgroundGrantedToolSelections(form: FormState, bgDetail: BgDetail | null): string[] {
  const granted = new Set<string>([
    ...(bgDetail?.proficiencies?.tools.fixed ?? []),
    ...form.chosenBgTools,
  ]);
  for (const featChoice of getBackgroundFeatChoices(bgDetail)) {
    const selected = form.chosenFeatOptions[featChoice.key] ?? [];
    for (const value of selected) {
      if (classifyFeatSelection(featChoice.choice, value) === "tool") granted.add(value);
    }
  }
  return [...granted];
}

function singularizeEquipmentName(name: string): string {
  const trimmed = name.trim();
  const irregular: Record<string, string> = {
    daggers: "Dagger",
  };
  const lowered = trimmed.toLowerCase();
  if (irregular[lowered]) return irregular[lowered];
  if (/ies$/i.test(trimmed)) return `${trimmed.slice(0, -3)}y`;
  if (/es$/i.test(trimmed) && /(ches|shes|sses|xes|zes)$/i.test(trimmed)) return trimmed.slice(0, -2);
  if (/s$/i.test(trimmed) && !/ss$/i.test(trimmed)) return trimmed.slice(0, -1);
  return trimmed;
}

function resolveStartingInventoryItem(name: string, items: ItemSummary[]): ItemSummary | null {
  const normalized = normalizeInventoryItemLookupName(name);
  const singularNormalized = normalizeInventoryItemLookupName(singularizeEquipmentName(name));
  return items.find((item) => normalizeInventoryItemLookupName(item.name) === normalized)
    ?? items.find((item) => normalizeInventoryItemLookupName(item.name) === singularNormalized)
    ?? null;
}

function buildEquipmentItems(optionId: string | null, equipmentText: string | undefined, prefix: string, grantedTools: string[], itemIndex: ItemSummary[]): InventoryItemSeed[] {
  const options = parseStartingEquipmentOptions(equipmentText);
  const selected = options.find((option) => option.id === optionId);
  if (!selected) return [];

  const seeds: InventoryItemSeed[] = [];
  let autoId = 1;

  function pushItem(name: string, quantity: number) {
    const trimmed = name.trim();
    if (!trimmed || quantity <= 0) return;
    const matched = resolveStartingInventoryItem(trimmed, itemIndex);
    const canonicalName = matched ? matched.name.replace(/\s+\[(?:2024|5\.5e|5e)\]\s*$/i, "").trim() : trimmed;
    const seedBase = {
      name: canonicalName,
      equipped: false,
      source: matched ? "compendium" as const : "custom" as const,
      itemId: matched?.id,
      type: matched?.type ?? null,
      rarity: matched?.rarity ?? null,
      magic: matched?.magic ?? false,
      attunement: matched?.attunement ?? false,
      weight: matched?.weight ?? null,
      value: matched?.value ?? null,
      ac: matched?.ac ?? null,
      stealthDisadvantage: matched?.stealthDisadvantage ?? false,
      dmg1: matched?.dmg1 ?? null,
      dmg2: matched?.dmg2 ?? null,
      dmgType: matched?.dmgType ?? null,
      properties: matched?.properties ?? [],
    };
    const isWeapon = Boolean(matched?.type && /weapon/i.test(matched.type));
    if (isWeapon && quantity > 1) {
      for (let index = 0; index < quantity; index += 1) {
        seeds.push({
          id: `${prefix}-eq-${autoId++}`,
          ...seedBase,
          quantity: 1,
        });
      }
      return;
    }
    seeds.push({
      id: `${prefix}-eq-${autoId++}`,
      ...seedBase,
      quantity,
    });
  }

  for (const entry of selected.entries) {
    const normalized = entry
      .replace(/\bC\s*p\b/gi, "CP")
      .replace(/\bG\s*p\b/gi, "GP")
      .trim();
    if (/same as above/i.test(normalized)) {
      const prefix = normalized.replace(/\s*\(same as above\)\s*/i, "").trim();
      const matching = grantedTools.filter((tool) => {
        if (/Musical Instrument/i.test(prefix)) return MUSICAL_INSTRUMENTS.includes(tool);
        if (/Artisan'?s Tools/i.test(prefix)) return ALL_TOOLS.includes(tool) && !MUSICAL_INSTRUMENTS.includes(tool);
        if (/Gaming Set/i.test(prefix)) return /Set$/i.test(tool);
        return true;
      });
      if (matching.length > 0) {
        matching.forEach((tool) => pushItem(tool, 1));
      } else {
        pushItem(prefix || normalized, 1);
      }
      continue;
    }

    const currencyMatch = normalized.match(/^(\d+)\s*(GP|CP|SP|EP|PP)$/i);
    if (currencyMatch) {
      pushItem(currencyMatch[2].toUpperCase(), Number(currencyMatch[1]));
      continue;
    }

    const countMatch = normalized.match(/^(\d+)\s+(.+)$/);
    if (countMatch) {
      pushItem(countMatch[2], Number(countMatch[1]));
      continue;
    }

    pushItem(normalized, 1);
  }

  return seeds;
}

function buildStartingInventory(form: FormState, bgDetail: BgDetail | null, classDetail: ClassDetail | null, itemIndex: ItemSummary[]): InventoryItemSeed[] {
  const bgItems = buildEquipmentItems(
    form.chosenBgEquipmentOption,
    bgDetail?.equipment,
    "bg",
    getBackgroundGrantedToolSelections(form, bgDetail),
    itemIndex,
  );
  const classItems = buildEquipmentItems(
    form.chosenClassEquipmentOption,
    extractClassStartingEquipment(classDetail),
    "class",
    [],
    itemIndex,
  );
  return [...classItems, ...bgItems];
}

function getWeaponMasteryChoice(classDetail: ClassDetail | null, level: number): WeaponMasteryChoice | null {
  if (!classDetail) return null;
  for (const al of classDetail.autolevels) {
    if (al.level == null || al.level > level) continue;
    for (const f of al.features) {
      if (!/weapon mastery/i.test(f.name)) continue;
      const m = f.text.match(/mastery properties of\s+(\w+)\s+kinds?\s+of\s+weapons?\s+of\s+your\s+choice/i);
      const count = m ? wordOrNumberToInt(m[1]) : null;
      if (count && count > 0) return { source: f.name, count };
    }
  }
  return null;
}

interface ClassFeatChoice {
  featureName: string;
  featGroup: string;
  options: Array<{ id: string; name: string }>;
}

function matchesClassFeatGroup(featName: string, featGroup: string): boolean {
  const normalizedGroup = featGroup.trim().toLowerCase();
  if (normalizedGroup === "fighting style") return /^fighting style:/i.test(featName);
  if (normalizedGroup === "origin") return /^origin:/i.test(featName);
  if (normalizedGroup === "epic boon" || normalizedGroup === "boon") return /^boon of\b/i.test(featName);
  const escaped = featGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return new RegExp(`^${escaped}:`, "i").test(featName) || new RegExp(`\\b${escaped}\\b`, "i").test(featName);
}

function getClassFeatChoices(
  classDetail: ClassDetail | null,
  level: number,
  featSummaries: Array<{ id: string; name: string; ruleset?: Ruleset | null }>,
  ruleset: Ruleset | null,
): ClassFeatChoice[] {
  if (!classDetail) return [];
  const choices: ClassFeatChoice[] = [];
  const seen = new Set<string>();
  for (const al of classDetail.autolevels) {
    if (al.level == null || al.level > level) continue;
    for (const f of al.features) {
      const match = f.text.match(/gain\s+an?\s+(.+?)\s+feat\s+of\s+your\s+choice/i);
      const featGroup = match?.[1]?.trim();
      if (!featGroup) continue;
      const key = `${al.level}:${f.name}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const options = featSummaries
        .filter((feat) => matchesRuleset(feat, ruleset))
        .filter((feat) => matchesClassFeatGroup(feat.name, featGroup))
        .map((feat) => ({ id: feat.id, name: feat.name }))
        .sort((a, b) => a.name.localeCompare(b.name));
      choices.push({ featureName: f.name, featGroup, options });
    }
  }
  return choices;
}

function getClassFeatChoiceLabel(featGroup: string): string {
  if (/^fighting style$/i.test(featGroup)) return "Fighting Style";
  return `${featGroup} Choice`;
}

function getClassFeatOptionLabel(optionName: string, featGroup: string): string {
  let label = optionName.replace(/\s*\[(?:5\.5e|2024)\]\s*$/i, "").trim();
  if (new RegExp(`^${featGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i").test(label)) {
    label = label.replace(new RegExp(`^${featGroup.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s*:\\s*`, "i"), "").trim();
  }
  return label;
}

// ---------------------------------------------------------------------------

function buildProficiencyMapForRuleset(
  ruleset: Ruleset,
  form: FormState,
  classDetail: ClassDetail | null,
  raceDetail: RaceDetail | null,
  bgDetail: BgDetail | null,
  classCantrips: SpellSummary[],
  classSpells: SpellSummary[],
  classInvocations: SpellSummary[],
  raceFeatDetail: BackgroundFeat | null,
  classFeatDetails: Record<string, BackgroundFeat>,
): ProficiencyMap {
  return ruleset === "5.5e"
    ? buildProficiencyMap55e(form, classDetail, raceDetail, bgDetail, classCantrips, classSpells, classInvocations, raceFeatDetail, classFeatDetails)
    : buildProficiencyMap5e(form, classDetail, raceDetail, bgDetail, classCantrips, classSpells, classInvocations, raceFeatDetail, classFeatDetails);
}

function buildProficiencyMap5e(
  form: FormState,
  classDetail: ClassDetail | null,
  raceDetail: RaceDetail | null,
  bgDetail: BgDetail | null,
  classCantrips: SpellSummary[],
  classSpells: SpellSummary[],
  classInvocations: SpellSummary[],
  raceFeatDetail: BackgroundFeat | null,
  classFeatDetails: Record<string, BackgroundFeat>,
): ProficiencyMap {
  return buildProficiencyMapInternal("5e", form, classDetail, raceDetail, bgDetail, classCantrips, classSpells, classInvocations, raceFeatDetail, classFeatDetails);
}

function buildProficiencyMap55e(
  form: FormState,
  classDetail: ClassDetail | null,
  raceDetail: RaceDetail | null,
  bgDetail: BgDetail | null,
  classCantrips: SpellSummary[],
  classSpells: SpellSummary[],
  classInvocations: SpellSummary[],
  raceFeatDetail: BackgroundFeat | null,
  classFeatDetails: Record<string, BackgroundFeat>,
): ProficiencyMap {
  return buildProficiencyMapInternal("5.5e", form, classDetail, raceDetail, bgDetail, classCantrips, classSpells, classInvocations, raceFeatDetail, classFeatDetails);
}

function buildProficiencyMapInternal(
  ruleset: Ruleset,
  form: FormState,
  classDetail: ClassDetail | null,
  raceDetail: RaceDetail | null,
  bgDetail: BgDetail | null,
  classCantrips: SpellSummary[],
  classSpells: SpellSummary[],
  classInvocations: SpellSummary[],
  raceFeatDetail: BackgroundFeat | null,
  classFeatDetails: Record<string, BackgroundFeat>,
): ProficiencyMap {
  const className = classDetail?.name ?? "";
  const raceName  = raceDetail?.name  ?? "";
  const bgName    = bgDetail?.name    ?? "";

  const splitComma = (s: string) => s.split(/[,;]/).map(x => x.trim()).filter(Boolean);

  const skills:      TaggedItem[] = [];
  const saves:       TaggedItem[] = [];
  const armor:       TaggedItem[] = [];
  const weapons:     TaggedItem[] = [];
  const tools:       TaggedItem[] = [];
  const languages:   TaggedItem[] = [];
  const masteries:   TaggedItem[] = [];
  const spells:      TaggedItem[] = [];
  const invocations: TaggedItem[] = [];

  // ── Class ──────────────────────────────────────────────────────────────────
  if (classDetail) {
    splitComma(classDetail.armor).forEach(n => armor.push({ name: n, source: className }));
    splitComma(classDetail.weapons).forEach(n => weapons.push({ name: n, source: className }));

    // Saving throws — primary source: ability score names in <proficiency> field
    // e.g. "Wisdom, Charisma, History, Insight" → Wisdom + Charisma are saves
    splitComma(classDetail.proficiency)
      .filter(n => ABILITY_SCORE_NAMES.has(n))
      .forEach(n => saves.push({ name: n, source: className }));

    // Fallback: some older XMLs encode saves in feature text "Saving Throw Proficiencies: X and Y"
    if (saves.length === 0) {
      outer: for (const al of classDetail.autolevels) {
        for (const f of al.features) {
          if (f.optional) continue;
          const m = f.text.match(/Saving Throw Proficiencies?:\s*([^\n.]+)/i);
          if (m) {
            m[1].split(/,|\s+and\s+/i).map(s => s.trim()).filter(Boolean)
              .forEach(n => saves.push({ name: n, source: className }));
            break outer;
          }
        }
      }
    }
    // Skill choices made in the Skills step
    form.chosenSkills.forEach(n => skills.push({ name: n, source: className }));
    const masteryChoice = ruleset === "5.5e" ? getWeaponMasteryChoice(classDetail, form.level) : null;
    if (masteryChoice) {
      form.chosenWeaponMasteries.forEach((name) => masteries.push({ name, source: masteryChoice.source }));
    }

    // ── Chosen optional features (Step 4 picks) ──────────────────────────────
    // Build a flat map of feature name → text so we can parse grants
    const optFeatureMap: Record<string, string> = {};
    for (const al of classDetail.autolevels) {
      for (const f of al.features) {
        if (f.optional) optFeatureMap[f.name] = f.text;
      }
    }
    for (const fname of form.chosenOptionals) {
      const ftext = optFeatureMap[fname];
      if (!ftext) continue;
      const grants = parseFeatureGrants(ftext);
      grants.armor.forEach(n    => armor.push({ name: n, source: fname }));
      grants.weapons.forEach(n  => weapons.push({ name: n, source: fname }));
      grants.tools.forEach(n    => tools.push({ name: n, source: fname }));
      grants.skills.forEach(n   => skills.push({ name: n, source: fname }));
      grants.languages.forEach(n => languages.push({ name: n, source: fname }));
    }

    for (const [featureName, feat] of Object.entries(classFeatDetails)) {
      feat.parsed.grants.skills.forEach((name) => skills.push({ name, source: feat.name }));
      feat.parsed.grants.tools.forEach((name) => tools.push({ name, source: feat.name }));
      feat.parsed.grants.languages.forEach((name) => languages.push({ name, source: feat.name }));
      feat.parsed.grants.armor.forEach((name) => armor.push({ name, source: feat.name }));
      feat.parsed.grants.weapons.forEach((name) => weapons.push({ name, source: feat.name }));
      feat.parsed.grants.savingThrows.forEach((name) => saves.push({ name, source: feat.name }));
      for (const choice of feat.parsed.choices) {
        if (choice.type !== "proficiency" && choice.type !== "weapon_mastery") continue;
        const selected = form.chosenFeatOptions[`classfeat:${featureName}:${choice.id}`] ?? [];
        for (const name of selected) {
          const kind = classifyFeatSelection(choice, name);
          if (kind === "skill") skills.push({ name, source: feat.name });
          else if (kind === "tool") tools.push({ name, source: feat.name });
          else if (kind === "language") languages.push({ name, source: feat.name });
          else if (kind === "weapon_mastery") masteries.push({ name, source: feat.name });
        }
      }
    }
  }

  // ── Background ─────────────────────────────────────────────────────────────
  if (bgDetail) {
    const prof = bgDetail.proficiencies;
    // Skills — fixed from <proficiency> field + chosen picks
    const bgSkills = prof ? prof.skills.fixed : splitComma(bgDetail.proficiency);
    bgSkills.forEach(n => skills.push({ name: n, source: bgName }));
    form.chosenBgSkills.forEach(n => skills.push({ name: n, source: bgName }));
    // Tools — fixed grants + chosen picks
    if (prof) {
      prof.tools.fixed.forEach(n => tools.push({ name: n, source: bgName }));
      form.chosenBgTools.forEach(n => tools.push({ name: n, source: bgName }));
      // Languages — fixed grants + chosen picks
      prof.languages.fixed.forEach(n => languages.push({ name: n, source: bgName }));
      form.chosenBgLanguages.forEach(n => languages.push({ name: n, source: bgName }));
    } else {
      // Fallback: old-style trait text parsing
      for (const t of bgDetail.traits) {
        if (/tool/i.test(t.name)) splitComma(t.text).forEach(n => tools.push({ name: n, source: bgName }));
        else if (/language/i.test(t.name)) splitComma(t.text).forEach(n => languages.push({ name: n, source: bgName }));
      }
    }
    if (ruleset === "5.5e") {
      for (const feat of prof?.feats ?? []) {
        feat.parsed.grants.skills.forEach((name) => skills.push({ name, source: feat.name }));
        feat.parsed.grants.tools.forEach((name) => tools.push({ name, source: feat.name }));
        feat.parsed.grants.languages.forEach((name) => languages.push({ name, source: feat.name }));
        feat.parsed.grants.armor.forEach((name) => armor.push({ name, source: feat.name }));
        feat.parsed.grants.weapons.forEach((name) => weapons.push({ name, source: feat.name }));
        feat.parsed.grants.savingThrows.forEach((name) => saves.push({ name, source: feat.name }));

        for (const choice of feat.parsed.choices) {
          if (choice.type !== "proficiency" && choice.type !== "weapon_mastery") continue;
          const selected = form.chosenFeatOptions[`bg:${feat.name}:${choice.id}`] ?? [];
          for (const name of selected) {
            const kind = classifyFeatSelection(choice, name);
            if (kind === "skill") skills.push({ name, source: feat.name });
            else if (kind === "tool") tools.push({ name, source: feat.name });
            else if (kind === "language") languages.push({ name, source: feat.name });
            else if (kind === "weapon_mastery") masteries.push({ name, source: feat.name });
          }
        }
      }
    }
  }

  // ── Species ────────────────────────────────────────────────────────────────
  const core55eLanguageChoice = getCore55eLanguageChoice(raceDetail, ruleset);

  if (raceDetail) {
    for (const t of raceDetail.traits) {
      // Modifiers like "language:Common" or "tool:Thieves' Tools"
      for (const mod of t.modifier) {
        const m = mod.match(/^(language|tool|skill)[:\s]+(.+)/i);
        if (m) {
          const val = m[2].trim();
          if (/language/i.test(m[1])) languages.push({ name: val, source: raceName });
          else if (/tool/i.test(m[1]))   tools.push({ name: val, source: raceName });
          else if (/skill/i.test(m[1]))  skills.push({ name: val, source: raceName });
        }
      }
      // Trait named "Languages" — fall back to parsing text
      if (/^languages?$/i.test(t.name) && t.modifier.length === 0) {
        splitComma(t.text).forEach(n => {
          if (n && !/choose/i.test(n)) languages.push({ name: n, source: raceName });
        });
      }
    }
    // Chosen race skills/languages/tools (e.g. Human Skillful, Elf Keen Senses, Warforged Specialized Design)
    form.chosenRaceSkills.forEach(n => skills.push({ name: n, source: raceName }));
    if (!core55eLanguageChoice) {
      form.chosenRaceLanguages.forEach(n => languages.push({ name: n, source: raceName }));
    }
    form.chosenRaceTools.forEach(n => tools.push({ name: n, source: raceName }));
    // Race feat grants (e.g. Human Versatile origin feat)
    if (ruleset === "5.5e" && raceFeatDetail) {
      const rg = raceFeatDetail.parsed.grants;
      rg.skills.forEach(n => skills.push({ name: n, source: raceFeatDetail.name }));
      rg.tools.forEach(n => tools.push({ name: n, source: raceFeatDetail.name }));
      rg.languages.forEach(n => languages.push({ name: n, source: raceFeatDetail.name }));
      rg.armor.forEach(n => armor.push({ name: n, source: raceFeatDetail.name }));
      rg.weapons.forEach(n => weapons.push({ name: n, source: raceFeatDetail.name }));
      rg.savingThrows.forEach(n => saves.push({ name: n, source: raceFeatDetail.name }));
      for (const choice of raceFeatDetail.parsed.choices) {
        if (choice.type !== "proficiency" && choice.type !== "weapon_mastery") continue;
        const selected = form.chosenFeatOptions[`race:${raceFeatDetail.name}:${choice.id}`] ?? [];
        for (const name of selected) {
          const kind = classifyFeatSelection(choice, name);
          if (kind === "skill") skills.push({ name, source: raceFeatDetail.name });
          else if (kind === "tool") tools.push({ name, source: raceFeatDetail.name });
          else if (kind === "language") languages.push({ name, source: raceFeatDetail.name });
          else if (kind === "weapon_mastery") masteries.push({ name, source: raceFeatDetail.name });
        }
      }
    }
  }

  if (core55eLanguageChoice) {
    core55eLanguageChoice.fixed.forEach((name) => languages.push({ name, source: core55eLanguageChoice.source }));
    form.chosenRaceLanguages.forEach((name) => languages.push({ name, source: core55eLanguageChoice.source }));
  }

  // ── Spells ─────────────────────────────────────────────────────────────────
  const cantripById = Object.fromEntries(classCantrips.map(s => [s.id, s]));
  const spellById   = Object.fromEntries(classSpells.map(s => [s.id, s]));
  const invocById   = Object.fromEntries(classInvocations.map(s => [s.id, s]));

  form.chosenCantrips.forEach(id => {
    const sp = cantripById[id];
    if (sp) spells.push({ name: sp.name, source: className });
  });
  form.chosenSpells.forEach(id => {
    const sp = spellById[id];
    if (sp) spells.push({ name: sp.name, source: className });
  });
  form.chosenInvocations.forEach(id => {
    const sp = invocById[id];
    if (sp) invocations.push({ name: sp.name, source: className });
  });

  return { skills, saves, armor, weapons, tools, languages, masteries, spells, invocations };
}

/** Group optional non-subclass features by level, up to `level`.
 *  Multiple autolevel entries at the same level are merged into one group. */
function getOptionalGroups(cls: ClassDetail, level: number): { level: number; features: { name: string; text: string }[] }[] {
  const map = new Map<number, { name: string; text: string }[]>();
  for (const al of cls.autolevels) {
    if (al.level == null || al.level > level) continue;
    const opts = al.features.filter((f) => f.optional && !/subclass/i.test(f.name) && !/^Becoming\b/i.test(f.name));
    if (opts.length > 0) {
      const existing = map.get(al.level) ?? [];
      map.set(al.level, [...existing, ...opts]);
    }
  }
  return Array.from(map.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([lvl, features]) => ({ level: lvl, features }));
}

function pointBuySpent(scores: Record<string, number>): number {
  return ABILITY_KEYS.reduce((sum, k) => {
    const s = Math.min(15, Math.max(8, scores[k] ?? 8));
    return sum + (POINT_BUY_COSTS[s] ?? 0);
  }, 0);
}

// ---------------------------------------------------------------------------
// Form state
// ---------------------------------------------------------------------------

type AbilityMethod = "standard" | "pointbuy" | "manual";
type Step = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10;

interface FormState {
  ruleset?: Ruleset | null;
  classId: string;
  raceId: string;
  bgId: string;
  level: number;
  subclass: string;
  chosenOptionals: string[];
  chosenClassFeatIds: Record<string, string>;
  // Species choices (Step 1)
  chosenRaceSkills: string[];
  chosenRaceLanguages: string[];
  chosenRaceTools: string[];
  chosenRaceFeatId: string | null;
  chosenRaceSize: string | null;
  // Background tool / language / ability / skill / feat choices (Step 3)
  chosenBgSkills: string[];
  chosenBgOriginFeatId: string | null;
  chosenBgTools: string[];
  chosenBgLanguages: string[];
  chosenClassEquipmentOption: string | null;
  chosenBgEquipmentOption: string | null;
  chosenFeatOptions: Record<string, string[]>;
  bgAbilityMode: "split" | "even";
  bgAbilityBonuses: Record<string, number>; // e.g. { str: 2, dex: 1 } or { str:1, dex:1, con:1 }
  // Skill proficiency selections (up to numSkills)
  chosenSkills: string[];
  chosenWeaponMasteries: string[];
  // Spellcasting selections
  chosenCantrips: string[];    // spell IDs
  chosenSpells: string[];      // spell IDs (prepared)
  chosenInvocations: string[]; // spell IDs (Eldritch Invocations etc.)
  abilityMethod: AbilityMethod;
  standardAssign: Record<string, number>;
  pbScores: Record<string, number>;
  manualScores: Record<string, number>;
  hpMax: string;
  ac: string;
  speed: string;
  characterName: string;
  playerName: string;
  alignment: string;
  hair: string;
  skin: string;
  heightText: string;
  age: string;
  weight: string;
  gender: string;
  color: string;
  campaignIds: string[];
}

const DEFAULT_SCORES = { str: 10, dex: 10, con: 10, int: 10, wis: 10, cha: 10 };

function initForm(user: { name?: string } | null, params: URLSearchParams): FormState {
  const preselectedCampaign = params.get("campaign");
  return {
    ruleset: null,
    classId: "", raceId: "", bgId: "",
    level: 1, subclass: "", chosenOptionals: [], chosenClassFeatIds: {},
    chosenRaceSkills: [], chosenRaceLanguages: [], chosenRaceTools: [], chosenRaceFeatId: null, chosenRaceSize: null,
    chosenBgSkills: [], chosenBgOriginFeatId: null,
    chosenBgTools: [], chosenBgLanguages: [], chosenClassEquipmentOption: null, chosenBgEquipmentOption: null, chosenFeatOptions: {}, bgAbilityMode: "split", bgAbilityBonuses: {},
    chosenSkills: [], chosenWeaponMasteries: [], chosenCantrips: [], chosenSpells: [], chosenInvocations: [],
    abilityMethod: "standard",
    standardAssign: { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 },
    pbScores: { ...DEFAULT_SCORES },
    manualScores: { ...DEFAULT_SCORES },
    hpMax: "", ac: "10", speed: "30",
    characterName: "", playerName: user?.name ?? "",
    alignment: "", hair: "", skin: "", heightText: "",
    age: "", weight: "", gender: "",
    color: "#38b6ff",
    campaignIds: preselectedCampaign ? [preselectedCampaign] : [],
  };
}

function resolvedScores(form: FormState): Record<string, number> {
  let base: Record<string, number>;
  if (form.abilityMethod === "manual") base = { ...form.manualScores };
  else if (form.abilityMethod === "pointbuy") base = { ...form.pbScores };
  else {
    base = {};
    for (const k of ABILITY_KEYS) {
      const idx = form.standardAssign[k];
      base[k] = idx >= 0 ? STANDARD_ARRAY[idx] : 8;
    }
  }
  // Apply background ability bonuses
  for (const [k, v] of Object.entries(form.bgAbilityBonuses)) {
    if (k in base) base[k] = (base[k] ?? 0) + v;
  }
  return base;
}

/** Parse primary ability keys from class detail features. */
function getPrimaryAbilityKeys(classDetail: ClassDetail | null): string[] {
  if (!classDetail) return [];
  for (const al of classDetail.autolevels) {
    if (al.level !== 1) continue;
    for (const f of al.features) {
      const m = f.text.match(/Primary Ability:\s*([^\n]+)/i);
      if (m) return abilityNamesToKeys(m[1].split(/,|\s+and\s+|\s+or\s+/i).map((s) => s.trim()).filter(Boolean));
    }
  }
  return [];
}


// ---------------------------------------------------------------------------
// Main view
// ---------------------------------------------------------------------------

export function CharacterCreatorView() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { id: editId } = useParams<{ id: string }>();
  const isEditing = Boolean(editId);

  const [step, setStep] = React.useState<Step>(1);
  const [form, setForm] = React.useState<FormState>(() => initForm(user, searchParams));
  const [busy, setBusy] = React.useState(false);
  const [editLoading, setEditLoading] = React.useState(isEditing);
  const [error, setError] = React.useState<string | null>(null);

  // Compendium data
  const [classes, setClasses] = React.useState<ClassSummary[]>([]);
  const [classDetail, setClassDetail] = React.useState<ClassDetail | null>(null);
  const [races, setRaces] = React.useState<RaceSummary[]>([]);
  const [raceDetail, setRaceDetail] = React.useState<RaceDetail | null>(null);
  const [featSummaries, setFeatSummaries] = React.useState<{ id: string; name: string; ruleset?: Ruleset | null }[]>([]);
  const [raceFeatDetail, setRaceFeatDetail] = React.useState<BackgroundFeat | null>(null);
  const [classFeatDetails, setClassFeatDetails] = React.useState<Record<string, BackgroundFeat>>({});
  const [raceFeatSearch, setRaceFeatSearch] = React.useState("");
  const [bgOriginFeatSearch, setBgOriginFeatSearch] = React.useState("");
  const [bgs, setBgs] = React.useState<BgSummary[]>([]);
  const [bgDetail, setBgDetail] = React.useState<BgDetail | null>(null);
  const [campaigns, setCampaigns] = React.useState<Campaign[]>([]);
  const [items, setItems] = React.useState<ItemSummary[]>([]);
  // Spell lists (loaded when class is selected)
  const [classCantrips, setClassCantrips] = React.useState<SpellSummary[]>([]);
  const [classSpells, setClassSpells] = React.useState<SpellSummary[]>([]);
  const [classInvocations, setClassInvocations] = React.useState<SpellSummary[]>([]);

  // Track initially-assigned campaigns so we can diff on save in edit mode
  const initialCampaignIdsRef = React.useRef<string[]>([]);

  // Portrait selection (not part of form schema — uploaded separately after save)
  const [portraitFile, setPortraitFile] = React.useState<File | null>(null);
  const [portraitPreview, setPortraitPreview] = React.useState<string | null>(null);
  const portraitInputRef = React.useRef<HTMLInputElement>(null);

  // Search states for long lists (hoisted to avoid Rules-of-Hooks violations in inner fns)
  const [classSearch, setClassSearch] = React.useState("");
  const [raceSearch, setRaceSearch] = React.useState("");
  const [bgSearch, setBgSearch] = React.useState("");
  const selectedClassSummary = React.useMemo(
    () => classes.find((c) => c.id === form.classId) ?? null,
    [classes, form.classId]
  );
  const selectedRuleset: Ruleset | null = React.useMemo(() => {
    const explicit = classDetail?.ruleset ?? selectedClassSummary?.ruleset ?? form.ruleset ?? null;
    if (explicit) return explicit;
    const label = classDetail?.name ?? selectedClassSummary?.name ?? null;
    return label ? inferRulesetFromLabel(label) : null;
  }, [classDetail?.name, classDetail?.ruleset, selectedClassSummary?.name, selectedClassSummary?.ruleset, form.ruleset]);

  // Load compendium lists on mount
  React.useEffect(() => {
    api<ClassSummary[]>("/api/compendium/classes").then(setClasses).catch(() => {});
    api<RaceSummary[]>("/api/compendium/races").then(setRaces).catch(() => {});
    api<BgSummary[]>("/api/compendium/backgrounds").then(setBgs).catch(() => {});
    api<{ id: string; name: string; ruleset?: Ruleset | null }[]>("/api/compendium/feats").then(setFeatSummaries).catch(() => {});
    api<Campaign[]>("/api/campaigns").then(setCampaigns).catch(() => {});
    api<ItemSummary[]>("/api/compendium/items").then(setItems).catch(() => {});
  }, []);

  // Load existing character when editing
  React.useEffect(() => {
    if (!editId) return;
    api<any>(`/api/me/characters/${editId}`)
      .then((ch) => {
        const cd = ch.characterData ?? {};
        setForm((f) => ({
          ...f,
          ruleset: cd.ruleset ?? null,
          classId: cd.classId ?? "",
          raceId: cd.raceId ?? "",
          bgId: cd.bgId ?? "",
          level: ch.level ?? 1,
          subclass: cd.subclass ?? "",
          chosenOptionals: cd.chosenOptionals ?? [],
          chosenClassFeatIds: cd.chosenClassFeatIds ?? {},
          chosenRaceSkills: cd.chosenRaceSkills ?? [],
          chosenRaceLanguages: cd.chosenRaceLanguages ?? [],
          chosenRaceTools: cd.chosenRaceTools ?? [],
          chosenRaceFeatId: cd.chosenRaceFeatId ?? null,
          chosenRaceSize: cd.chosenRaceSize ?? null,
          chosenSkills: cd.chosenSkills ?? [],
          chosenClassEquipmentOption: cd.chosenClassEquipmentOption ?? null,
          chosenBgEquipmentOption: cd.chosenBgEquipmentOption ?? null,
          chosenFeatOptions: cd.chosenFeatOptions ?? {},
          chosenWeaponMasteries: cd.chosenWeaponMasteries ?? [],
          chosenCantrips: cd.chosenCantrips ?? [],
          chosenSpells: cd.chosenSpells ?? [],
          chosenInvocations: cd.chosenInvocations ?? [],
          abilityMethod: "manual",
          manualScores: {
            str: ch.strScore ?? 10, dex: ch.dexScore ?? 10, con: ch.conScore ?? 10,
            int: ch.intScore ?? 10, wis: ch.wisScore ?? 10, cha: ch.chaScore ?? 10,
          },
          hpMax: String(ch.hpMax ?? 0),
          ac: String(ch.ac ?? 10),
          speed: String(ch.speed ?? 30),
          characterName: ch.name ?? "",
          playerName: ch.playerName ?? f.playerName,
          alignment: typeof cd.alignment === "string" ? cd.alignment : "",
          hair: typeof cd.hair === "string" ? cd.hair : "",
          skin: typeof cd.skin === "string" ? cd.skin : "",
          heightText: typeof cd.height === "string" ? cd.height : "",
          age: typeof cd.age === "string" ? cd.age : "",
          weight: typeof cd.weight === "string" ? cd.weight : "",
          gender: typeof cd.gender === "string" ? cd.gender : "",
          color: ch.color ?? "#38b6ff",
          campaignIds: (ch.campaigns ?? []).map((c: any) => c.campaignId),
        }));
        // Capture so handleSubmit can diff removals
        initialCampaignIdsRef.current = (ch.campaigns ?? []).map((c: any) => c.campaignId);
      })
      .catch(() => {})
      .finally(() => setEditLoading(false));
  }, [editId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load class detail when selected
  React.useEffect(() => {
    if (!form.classId) { setClassDetail(null); setClassFeatDetails({}); return; }
    setForm((f) => ({
      ...f,
      chosenClassFeatIds: {},
      chosenClassEquipmentOption: null,
      chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("classfeat:"))),
    }));
    setClassFeatDetails({});
    api<ClassDetail>(`/api/compendium/classes/${form.classId}`).then(setClassDetail).catch(() => {});
  }, [form.classId]);

  // Load spell lists once classDetail is known
  React.useEffect(() => {
    if (!classDetail) { setClassCantrips([]); setClassSpells([]); setClassInvocations([]); return; }
    const name = encodeURIComponent(classDetail.name);
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&level=0&limit=200`).then(setClassCantrips).catch(() => {});
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&minLevel=1&maxLevel=9&limit=300`).then(setClassSpells).catch(() => {});
    // Eldritch Invocations live in their own spell list
    if (/warlock/i.test(classDetail.name)) {
      api<SpellSummary[]>("/api/spells/search?classes=Eldritch+Invocations&limit=200").then(setClassInvocations).catch(() => {});
    } else {
      setClassInvocations([]);
    }
  }, [classDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  const eligibleInvocationIds = React.useMemo(() => {
    const chosenCantripNames = classCantrips
      .filter((spell) => form.chosenCantrips.includes(spell.id))
      .map((spell) => spell.name);
    const chosenDamageCantripNames = classCantrips
      .filter((spell) => form.chosenCantrips.includes(spell.id) && spellLooksLikeDamageSpell(spell))
      .map((spell) => spell.name);
    const chosenInvocationNames = classInvocations
      .filter((invocation) => form.chosenInvocations.includes(invocation.id))
      .map((invocation) => invocation.name);

    return new Set(
      classInvocations
        .filter((invocation) => matchesRulesetLabel(invocation.name, selectedRuleset))
        .filter((invocation) =>
          invocationPrerequisitesMet(invocation.text ?? "", {
            level: form.level,
            chosenCantripNames,
            chosenDamageCantripNames,
            chosenInvocationNames,
          })
        )
        .map((invocation) => invocation.id)
    );
  }, [classCantrips, classInvocations, form.chosenCantrips, form.chosenInvocations, form.level, selectedRuleset]);

  // Drop any chosen invocations whose prerequisites are no longer met
  React.useEffect(() => {
    if (classInvocations.length === 0) return;
    setForm((f) => {
      const next = f.chosenInvocations.filter((id) => eligibleInvocationIds.has(id));
      if (next.length === f.chosenInvocations.length) return f;
      return { ...f, chosenInvocations: next };
    });
  }, [classInvocations, eligibleInvocationIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load race detail when selected — also reset race choices
  React.useEffect(() => {
    if (!form.raceId) { setRaceDetail(null); setRaceFeatDetail(null); return; }
    setForm(f => ({
      ...f,
      chosenRaceSkills: [], chosenRaceLanguages: [], chosenRaceTools: [], chosenRaceFeatId: null, chosenRaceSize: null,
      chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("race:"))),
    }));
    setRaceFeatDetail(null);
    api<RaceDetail>(`/api/compendium/races/${form.raceId}`).then(setRaceDetail).catch(() => {});
  }, [form.raceId]); // eslint-disable-line react-hooks/exhaustive-deps

  // Fetch race feat detail when chosenRaceFeatId changes
  React.useEffect(() => {
    if (!form.chosenRaceFeatId) { setRaceFeatDetail(null); return; }
    api<{ name: string; text?: string; parsed: ParsedFeat }>(`/api/compendium/feats/${encodeURIComponent(form.chosenRaceFeatId)}`)
      .then((f) => setRaceFeatDetail({ name: f.name, text: f.text, parsed: f.parsed }))
      .catch(() => {});
  }, [form.chosenRaceFeatId]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    const entries = Object.entries(form.chosenClassFeatIds).filter(([, featId]) => Boolean(featId));
    if (entries.length === 0) {
      setClassFeatDetails({});
      return;
    }
    let cancelled = false;
    Promise.all(
      entries.map(async ([featureName, featId]) => {
        const detail = await api<{ name: string; text?: string; parsed: ParsedFeat }>(`/api/compendium/feats/${encodeURIComponent(featId)}`);
        return [featureName, { name: detail.name, text: detail.text, parsed: detail.parsed }] as const;
      })
    )
      .then((pairs) => {
        if (cancelled) return;
        setClassFeatDetails(Object.fromEntries(pairs));
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [form.chosenClassFeatIds]); // eslint-disable-line react-hooks/exhaustive-deps

  // Load bg detail when selected
  React.useEffect(() => {
    if (!form.bgId) { setBgDetail(null); return; }
    setForm(f => ({ ...f, chosenBgTools: [], chosenBgLanguages: [], chosenBgEquipmentOption: null, chosenFeatOptions: {}, bgAbilityMode: "split", bgAbilityBonuses: {} }));
    api<BgDetail>(`/api/compendium/backgrounds/${form.bgId}`).then(setBgDetail).catch(() => {});
  }, [form.bgId]);

  // Auto-calculate HP, speed when class/race/scores change
  React.useEffect(() => {
    const hd = classDetail?.hd ?? 8;
    const scores = resolvedScores(form);
    const conMod = abilityMod(scores.con ?? 10);
    const hp = calcHpMax(hd, form.level, conMod);
    const baseSpeed = raceDetail?.speed ?? 30;
    setForm((f) => ({ ...f, hpMax: String(hp), speed: String(baseSpeed) }));
  }, [classDetail, raceDetail, form.level, form.abilityMethod, form.standardAssign, form.pbScores, form.manualScores]); // eslint-disable-line react-hooks/exhaustive-deps

  function set<K extends keyof FormState>(key: K, val: FormState[K]) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function optionalText(value: string | undefined) {
    return (value ?? "").trim();
  }

  async function handleSubmit() {
    if (!form.characterName.trim()) { setError("Character name is required."); return; }
    setBusy(true); setError(null);
    try {
      const scores = resolvedScores(form);
      const classFeatures: ClassFeatureEntry[] = (() => {
        if (!classDetail) return [];
        const featureByName = new Map<string, ClassFeatureEntry>();
        for (const al of classDetail.autolevels) {
          if (al.level == null || al.level > form.level) continue;
          for (const f of al.features) {
            if (!f.optional) continue;
            if (!form.chosenOptionals.includes(f.name)) continue;
            if (featureByName.has(f.name)) continue;
            featureByName.set(f.name, {
              id: f.name,
              name: f.name,
              text: f.text?.trim() ?? "",
            });
          }
        }
        const selectedOptionals = form.chosenOptionals
          .map((name) => featureByName.get(name) ?? { id: name, name, text: "" })
          .filter(Boolean);
        const selectedClassFeats = Object.entries(form.chosenClassFeatIds)
          .map(([featureName]) => classFeatDetails[featureName])
          .filter(Boolean)
          .map((feat) => ({ id: feat.name, name: feat.name, text: feat.text?.trim() ?? "" }));
        return [...selectedOptionals, ...selectedClassFeats];
      })();
      const startingInventory = isEditing
        ? undefined
        : buildStartingInventory(form, bgDetail, classDetail, items);
      const body = {
        name: form.characterName.trim(),
        playerName: optionalText(form.playerName),
        className: classDetail?.name ?? form.characterName,
        species: raceDetail?.name ?? "",
        level: form.level,
        hpMax: Number(form.hpMax) || 0,
        hpCurrent: Number(form.hpMax) || 0,
        ac: Number(form.ac) || 10,
        speed: Number(form.speed) || 30,
        strScore: scores.str, dexScore: scores.dex, conScore: scores.con,
        intScore: scores.int, wisScore: scores.wis, chaScore: scores.cha,
        color: form.color,
        characterData: {
          ruleset: selectedRuleset,
          classId: form.classId, raceId: form.raceId, bgId: form.bgId,
          subclass: form.subclass || null, abilityMethod: form.abilityMethod,
          alignment: optionalText(form.alignment),
          hair: optionalText(form.hair),
          skin: optionalText(form.skin),
          height: optionalText(form.heightText),
          age: optionalText(form.age),
          weight: optionalText(form.weight),
          gender: optionalText(form.gender),
          hd: classDetail?.hd ?? null,
          chosenOptionals: form.chosenOptionals,
          chosenClassFeatIds: form.chosenClassFeatIds,
          classFeatures,
          chosenRaceSkills: form.chosenRaceSkills,
          chosenRaceLanguages: form.chosenRaceLanguages,
          chosenRaceTools: form.chosenRaceTools,
          chosenRaceFeatId: form.chosenRaceFeatId,
          chosenRaceSize: form.chosenRaceSize,
          chosenSkills: form.chosenSkills,
          chosenClassEquipmentOption: form.chosenClassEquipmentOption,
          chosenBgEquipmentOption: form.chosenBgEquipmentOption,
          chosenFeatOptions: form.chosenFeatOptions,
          chosenWeaponMasteries: form.chosenWeaponMasteries,
          chosenCantrips: form.chosenCantrips,
          chosenSpells: form.chosenSpells,
          chosenInvocations: form.chosenInvocations,
          ...(startingInventory ? { inventory: startingInventory } : {}),
          proficiencies: buildProficiencyMapForRuleset(
            selectedRuleset ?? "5e",
            form, classDetail, raceDetail, bgDetail,
            classCantrips, classSpells, classInvocations, raceFeatDetail, classFeatDetails
          ),
        },
      };

      let charId: string;
      if (isEditing && editId) {
        await api(`/api/me/characters/${editId}`, jsonInit("PUT", body));
        charId = editId;
      } else {
        const created = await api<{ id: string }>("/api/me/characters", jsonInit("POST", body));
        charId = created.id;
      }

      // In edit mode: unassign any campaigns the user removed
      if (isEditing) {
        const removed = initialCampaignIdsRef.current.filter(
          (id) => !form.campaignIds.includes(id)
        );
        for (const campaignId of removed) {
          await api(`/api/me/characters/${charId}/unassign`, jsonInit("POST", { campaignId }));
        }
      }

      // Assign / sync all currently selected campaigns
      if (form.campaignIds.length > 0) {
        await api(`/api/me/characters/${charId}/assign`, jsonInit("POST", { campaignIds: form.campaignIds }));
      }

      // Upload portrait if one was selected
      if (portraitFile) {
        const fd = new FormData();
        fd.append("image", portraitFile);
        await api(`/api/me/characters/${charId}/image`, { method: "POST", body: fd });
      }

      navigate("/");
    } catch (e: any) {
      setError(e?.message ?? "Failed to save character.");
    } finally {
      setBusy(false);
    }
  }

  // ── Step renderers ──────────────────────────────────────────────────────────

  function renderStep(): { main: React.ReactNode; side: React.ReactNode } {
    switch (step) {
      case 1: return StepClass();
      case 2: return StepSpecies();
      case 3: return StepBackground();
      case 4: return StepLevel();
      case 5: return StepSkills();
      case 6: return StepSpells();
      case 7: return StepAbilityScores();
      case 8: return StepDerivedStats();
      case 9: return StepIdentity();
      case 10: return StepCampaigns();
      default: return { main: null, side: null };
    }
  }

  function SideSummaryCard() {
    const scores = resolvedScores(form);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(classDetail || raceDetail || bgDetail) && (
          <div style={detailBoxStyle}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.accentHl, marginBottom: 10 }}>Character Summary</div>
            {classDetail && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>Class </span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{classDetail.name}</span>
                {classDetail.hd && <span style={{ color: C.muted, fontSize: 11, marginLeft: 6 }}>d{classDetail.hd}</span>}
              </div>
            )}
            {raceDetail && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>Species </span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{raceDetail.name}</span>
                {raceDetail.speed && <span style={{ color: C.muted, fontSize: 11, marginLeft: 6 }}>{raceDetail.speed} ft</span>}
              </div>
            )}
            {bgDetail && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>Background </span>
                <span style={{ fontSize: 13, fontWeight: 700 }}>{bgDetail.name}</span>
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>Level </span>
              <span style={{ fontSize: 13, fontWeight: 700 }}>{form.level}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
              {ABILITY_KEYS.map(k => {
                const score = scores[k] ?? 10;
                const mod = abilityMod(score);
                return (
                  <div key={k} style={{ textAlign: "center", padding: "5px 4px", borderRadius: 6, background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ color: C.muted, fontSize: 10, fontWeight: 700, textTransform: "uppercase" }}>{ABILITY_LABELS[k]}</div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{score}</div>
                    <div style={{ color: C.muted, fontSize: 11 }}>{mod >= 0 ? "+" : ""}{mod}</div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    );
  }

  // Step 1: Class
  function StepClass(): { main: React.ReactNode; side: React.ReactNode } {
    return renderClassStep({
      classes,
      classSearch,
      setClassSearch,
      form,
      onSelectClass: (classId) => setForm((f) => ({
        ...f,
        classId,
        ruleset: inferRulesetFromLabel(classes.find((c) => c.id === classId)?.name ?? ""),
        raceId: "",
        bgId: "",
        chosenRaceSkills: [],
        chosenRaceLanguages: [],
        chosenRaceTools: [],
        chosenRaceFeatId: null,
        chosenRaceSize: null,
        chosenBgSkills: [],
        chosenBgOriginFeatId: null,
        chosenBgTools: [],
        chosenBgLanguages: [],
        chosenBgEquipmentOption: null,
        chosenFeatOptions: {},
        bgAbilityMode: "split",
        bgAbilityBonuses: {},
      })),
      onNext: () => setStep(2),
      classDetail,
      abilityLabels: ABILITY_LABELS,
    });
  }

  // Step 2: Species
  function StepSpecies(): { main: React.ReactNode; side: React.ReactNode } {
    const availableRaces = races.filter((r) => matchesRuleset(r, selectedRuleset));
    const filtered = raceSearch
      ? availableRaces.filter((r) => r.name.toLowerCase().includes(raceSearch.toLowerCase()))
      : availableRaces;

    function toggleRacePick<K extends "chosenRaceSkills" | "chosenRaceLanguages" | "chosenRaceTools">(
      key: K, item: string, max: number,
    ) {
      setForm(f => {
        const cur = f[key] as string[];
        const sel = cur.includes(item);
        return {
          ...f,
          [key]: sel ? cur.filter(x => x !== item) : cur.length < max ? [...cur, item] : cur,
        };
      });
    }

    const raceChoices = raceDetail
      ? (raceDetail.parsedChoices ?? parseRaceChoicesByRuleset(selectedRuleset ?? "5e", raceDetail.traits))
      : null;
    const { skillChoice, toolChoice, languageChoice } = raceChoices ?? { skillChoice: null, toolChoice: null, languageChoice: null };
    const originFeats = featSummaries.filter(f => /\borigin\b/i.test(f.name) && matchesRuleset(f, selectedRuleset));
    const filteredFeats = raceFeatSearch
      ? originFeats.filter(f => f.name.toLowerCase().includes(raceFeatSearch.toLowerCase()))
      : originFeats;

    return renderSpeciesStep({
      availableRaces,
      filteredRaces: filtered,
      raceSearch,
      setRaceSearch,
      selectedRaceId: form.raceId,
      selectRace: (id) => set("raceId", id),
      raceDetail,
      raceChoices,
      chosenRaceSize: form.chosenRaceSize,
      selectRaceSize: (size) => setForm((f) => ({ ...f, chosenRaceSize: size })),
      chosenRaceSkills: form.chosenRaceSkills,
      chosenRaceTools: form.chosenRaceTools,
      chosenRaceLanguages: form.chosenRaceLanguages,
      toggleRacePick,
      allSkills: ALL_SKILLS.map((skill) => skill.name),
      allTools: ALL_TOOLS,
      allLanguages: ALL_LANGUAGES,
      raceFeatSearch,
      setRaceFeatSearch,
      filteredFeats,
      chosenRaceFeatId: form.chosenRaceFeatId,
      selectRaceFeat: (id, selected) => setForm((f) => ({
        ...f,
        chosenRaceFeatId: selected ? null : id,
        chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("race:"))),
      })),
      raceFeatDetail,
      onBack: () => setStep(1),
      onNext: () => setStep(3),
    });

    const main = (
      <div>
        <h2 style={headingStyle}>Choose a Species</h2>

        {availableRaces.length === 0
          ? <p style={{ color: C.muted }}>No species found in compendium.</p>
          : (
            <>
              <input
                value={raceSearch}
                onChange={(e) => setRaceSearch(e.target.value)}
                placeholder="Search species…"
                style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
              />
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 6, maxHeight: 340, overflowY: "auto", paddingRight: 4, marginBottom: 4,
              }}>
                {filtered.length === 0 && (
                  <p style={{ color: C.muted, gridColumn: "1 / -1" }}>No matches.</p>
                )}
                {filtered.map((r) => {
                  const sel = form.raceId === r.id;
                  return (
                    <button type="button" key={r.id} onClick={() => set("raceId", r.id)} style={{
                      padding: "10px 13px", borderRadius: 8, textAlign: "left",
                      border: `2px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                      background: sel ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      color: sel ? C.accentHl : C.text, cursor: "pointer",
                      fontWeight: sel ? 700 : 500, fontSize: 13,
                      transition: "border-color 0.12s, background 0.12s",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>
                      {r.name}
                      {r.speed && <span style={{ color: "rgba(160,180,220,0.5)", fontSize: 11, marginLeft: 6 }}>{r.speed}ft</span>}
                    </button>
                  );
                })}
              </div>
            </>
          )
        }

        {/* Race choices — all interactive picks stay left */}
        {raceDetail && raceChoices && (raceChoices.hasChosenSize || skillChoice || toolChoice || languageChoice || raceChoices.hasFeatChoice) && (
          <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>

            {raceChoices.hasChosenSize && (
              <div>
                <div style={{ ...labelStyle, marginBottom: 8 }}>Size <span style={sourceTagStyle}>{raceDetail.name}</span></div>
                <div style={{ display: "flex", gap: 8 }}>
                  {["Medium", "Small"].map(sz => {
                    const sel = form.chosenRaceSize === sz;
                    return (
                      <button key={sz} type="button" onClick={() => setForm(f => ({ ...f, chosenRaceSize: sz }))}
                        style={{
                          padding: "6px 16px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                          border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                          background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                          color: sel ? C.accentHl : C.text, fontWeight: sel ? 700 : 400,
                        }}>
                        {sz}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {skillChoice && (
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <div style={{ ...labelStyle, margin: 0 }}>Skill Proficiency <span style={sourceTagStyle}>{raceDetail.name}</span></div>
                  <span style={{ fontSize: 12, color: form.chosenRaceSkills.length >= skillChoice.count ? C.accentHl : C.muted }}>
                    {form.chosenRaceSkills.length} / {skillChoice.count}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(skillChoice.from ?? ALL_SKILLS).map(skill => {
                    const sel = form.chosenRaceSkills.includes(skill);
                    const locked = !sel && form.chosenRaceSkills.length >= skillChoice.count;
                    return (
                      <button key={skill} type="button" disabled={locked}
                        onClick={() => toggleRacePick("chosenRaceSkills", skill, skillChoice.count)}
                        style={{
                          padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: locked ? "default" : "pointer",
                          border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                          background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                          color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                          fontWeight: sel ? 700 : 400,
                        }}>
                        {skill}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {toolChoice && (
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <div style={{ ...labelStyle, margin: 0 }}>Tool Proficiency <span style={sourceTagStyle}>{raceDetail.name}</span></div>
                  <span style={{ fontSize: 12, color: form.chosenRaceTools.length >= toolChoice.count ? C.accentHl : C.muted }}>
                    {form.chosenRaceTools.length} / {toolChoice.count}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                  {(toolChoice.from ?? ALL_TOOLS).map(tool => {
                    const sel = form.chosenRaceTools.includes(tool);
                    const locked = !sel && form.chosenRaceTools.length >= toolChoice.count;
                    return (
                      <button key={tool} type="button" disabled={locked}
                        onClick={() => toggleRacePick("chosenRaceTools", tool, toolChoice.count)}
                        style={{
                          padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: locked ? "default" : "pointer",
                          border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                          background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                          color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                          fontWeight: sel ? 700 : 400,
                        }}>
                        {tool}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {languageChoice && (
              <div>
                <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 8 }}>
                  <div style={{ ...labelStyle, margin: 0 }}>Language <span style={sourceTagStyle}>{raceDetail.name}</span></div>
                  <span style={{ fontSize: 12, color: form.chosenRaceLanguages.length >= languageChoice.count ? C.accentHl : C.muted }}>
                    {form.chosenRaceLanguages.length} / {languageChoice.count}
                  </span>
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {(languageChoice.from ?? ALL_LANGUAGES).map(lang => {
                    const sel = form.chosenRaceLanguages.includes(lang);
                    const locked = !sel && form.chosenRaceLanguages.length >= languageChoice.count;
                    return (
                      <button key={lang} type="button" disabled={locked}
                        onClick={() => toggleRacePick("chosenRaceLanguages", lang, languageChoice.count)}
                        style={{
                          padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: locked ? "default" : "pointer",
                          border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                          background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                          color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                          fontWeight: sel ? 700 : 400,
                        }}>
                        {lang}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {raceChoices.hasFeatChoice && (
              <div>
                <div style={{ ...labelStyle, marginBottom: 8 }}>Origin Feat <span style={sourceTagStyle}>{raceDetail.name}</span></div>
                <input
                  value={raceFeatSearch}
                  onChange={(e) => setRaceFeatSearch(e.target.value)}
                  placeholder="Search feats…"
                  style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
                />
                <div style={{
                  display: "grid", gridTemplateColumns: "1fr 1fr",
                  gap: 5, maxHeight: 240, overflowY: "auto", paddingRight: 4,
                }}>
                  {filteredFeats.map(feat => {
                    const sel = form.chosenRaceFeatId === feat.id;
                    return (
                      <button key={feat.id} type="button"
                        onClick={() => setForm(f => ({
                          ...f,
                          chosenRaceFeatId: sel ? null : feat.id,
                          chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("race:"))),
                        }))}
                        style={{
                          padding: "8px 12px", borderRadius: 8, textAlign: "left", cursor: "pointer",
                          border: `2px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                          background: sel ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                          color: sel ? C.accentHl : C.text, fontWeight: sel ? 700 : 400, fontSize: 13,
                          transition: "border-color 0.12s, background 0.12s",
                        }}>
                        {feat.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        )}

        <NavButtons step={step} onBack={() => setStep(1)} onNext={() => setStep(3)}
          nextDisabled={!form.raceId} />
      </div>
    );

    // Right column: description only (no interactive elements)
    const side = raceDetail ? (
      <div style={detailBoxStyle}>
        <div style={{ fontWeight: 700, fontSize: 15, color: C.accentHl, marginBottom: 10 }}>{raceDetail.name}</div>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap", marginBottom: 10 }}>
          {raceDetail.speed != null && <div><div style={statLabelStyle}>Speed</div><div style={statValueStyle}>{raceDetail.speed} ft</div></div>}
          {raceDetail.size && <div><div style={statLabelStyle}>Size</div><div style={statValueStyle}>{raceDetail.size}</div></div>}
          {raceDetail.vision.length > 0 && <div><div style={statLabelStyle}>Vision</div><div style={statValueStyle}>{raceDetail.vision.map(v => `${v.type} ${v.range}ft`).join(", ")}</div></div>}
          {raceDetail.resist && <div><div style={statLabelStyle}>Resist</div><div style={statValueStyle}>{raceDetail.resist}</div></div>}
        </div>
        {raceDetail.traits.map(t => (
          <div key={t.name} style={{ marginBottom: 8 }}>
            <span style={{ fontWeight: 700, fontSize: 12, color: C.accentHl }}>{t.name}. </span>
            <span style={{ color: "rgba(160,180,220,0.65)", fontSize: 12, lineHeight: 1.5 }}>
              {t.text.replace(/Source:.*$/m, "").trim()}
            </span>
          </div>
        ))}
        {/* Feat description when one is selected */}
        {form.chosenRaceFeatId && raceFeatDetail && (
          <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontWeight: 700, color: C.accentHl, fontSize: 13, marginBottom: 8 }}>{raceFeatDetail.name}</div>
            {raceFeatDetail.text && (
              <div style={{ fontSize: 12, color: "rgba(160,180,220,0.75)", lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                {raceFeatDetail.text.replace(/Source:.*$/m, "").trim()}
              </div>
            )}
          </div>
        )}
      </div>
    ) : (
      <div style={{ color: C.muted, fontSize: 13, padding: "12px 0" }}>Select a species to see its details.</div>
    );

    return { main, side };
  }

  // Step 3: Background
  function StepBackground(): { main: React.ReactNode; side: React.ReactNode } {
    const availableBackgrounds = bgs.filter((b) => matchesRuleset(b, selectedRuleset));
    const filtered = bgSearch
      ? availableBackgrounds.filter((b) => b.name.toLowerCase().includes(bgSearch.toLowerCase()))
      : availableBackgrounds;
    const equipmentOptions = parseStartingEquipmentOptions(bgDetail?.equipment);

    // Interactive bg choices (defined before main so they can be referenced in main JSX)
    const bgChoicesMain = bgDetail ? (() => {
      const prof = bgDetail.proficiencies;
      const tools = prof?.tools ?? { fixed: [], choose: 0, from: null };
      const equipOptions = parseStartingEquipmentOptions(bgDetail.equipment);

      function toggleBgChoice(item: string, key: "chosenBgTools" | "chosenBgLanguages", max: number) {
        setForm(f => {
          const cur = f[key];
          const next = cur.includes(item) ? cur.filter(x => x !== item) : cur.length < max ? [...cur, item] : cur;
          return { ...f, [key]: next };
        });
      }

      const originFeats = featSummaries.filter(f => /\borigin\b/i.test(f.name) && matchesRuleset(f, selectedRuleset));
      const filteredBgFeats = bgOriginFeatSearch
        ? originFeats.filter(f => f.name.toLowerCase().includes(bgOriginFeatSearch.toLowerCase()))
        : originFeats;

      return (
        <div style={{ marginTop: 20, display: "flex", flexDirection: "column", gap: 18 }}>

          {/* Skill proficiency picker (interactive) — for backgrounds with trait-based skill choices */}
          {prof && prof.skills.choose > 0 && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Skill Proficiencies </span>
                <span style={sourceTagStyle}>{bgDetail.name}</span>
                <span style={{ marginLeft: 8, fontSize: 12, color: form.chosenBgSkills.length >= prof.skills.choose ? C.accentHl : C.muted }}>
                  {form.chosenBgSkills.length} / {prof.skills.choose}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(prof.skills.from ?? ALL_SKILLS).map(skill => {
                  const sel = form.chosenBgSkills.includes(skill);
                  const locked = !sel && form.chosenBgSkills.length >= prof.skills.choose;
                  return (
                    <button key={skill} type="button" disabled={locked}
                      onClick={() => setForm(f => {
                        const cur = f.chosenBgSkills;
                        const next = cur.includes(skill) ? cur.filter(x => x !== skill) : cur.length < prof.skills.choose ? [...cur, skill] : cur;
                        return { ...f, chosenBgSkills: next };
                      })}
                      style={{
                        padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: locked ? "default" : "pointer",
                        border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                        color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                        fontWeight: sel ? 700 : 400,
                      }}>
                      {skill}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Origin feat picker (interactive) — for backgrounds like Custom Background */}
          {prof && prof.featChoice > 0 && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Origin Feat </span>
                <span style={sourceTagStyle}>{bgDetail.name}</span>
              </div>
              <input
                type="text"
                value={bgOriginFeatSearch}
                onChange={e => setBgOriginFeatSearch(e.target.value)}
                placeholder="Search origin feats…"
                style={{ ...inputStyle, width: "100%", marginBottom: 8 }}
              />
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 180, overflowY: "auto" }}>
                {filteredBgFeats.map(f => {
                  const sel = form.chosenBgOriginFeatId === f.id;
                  return (
                    <button key={f.id} type="button"
                      onClick={() => setForm(ff => ({ ...ff, chosenBgOriginFeatId: sel ? null : f.id }))}
                      style={{
                        padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                        border: `2px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: sel ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                        color: sel ? C.accentHl : C.text,
                        fontWeight: sel ? 700 : 400,
                      }}>
                      {f.name}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tool proficiency picker (interactive) */}
          {(tools.fixed.length > 0 || tools.choose > 0) && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Tools </span>
                <span style={sourceTagStyle}>{bgDetail.name}</span>
              </div>
              {tools.fixed.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginBottom: tools.choose > 0 ? 8 : 0 }}>
                  {tools.fixed.map(n => <span key={n} style={profChipStyle}>{n}</span>)}
                </div>
              )}
              {tools.choose > 0 && (
                <>
                  <div style={{ color: C.muted, fontSize: 11, marginBottom: 6 }}>
                    Choose {tools.choose} ({form.chosenBgTools.length}/{tools.choose})
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {(tools.from ?? ALL_TOOLS).map(n => {
                      const sel = form.chosenBgTools.includes(n);
                      const locked = !sel && form.chosenBgTools.length >= tools.choose;
                      return (
                        <button key={n} type="button" disabled={locked}
                          onClick={() => toggleBgChoice(n, "chosenBgTools", tools.choose)}
                          style={{
                            padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: locked ? "default" : "pointer",
                            border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                            background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                            color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                            fontWeight: sel ? 700 : 400,
                          }}>
                          {n}
                        </button>
                      );
                    })}
                  </div>
                </>
              )}
            </div>
          )}

          {/* Ability score bonus picker (interactive) */}
          {prof?.abilityScores && prof.abilityScores.length > 0 && (() => {
            const abilityKeys = abilityNamesToKeys(prof.abilityScores);
            const bonuses = form.bgAbilityBonuses;
            const mode = form.bgAbilityMode;

            function setMode(m: "split" | "even") {
              setForm(f => ({ ...f, bgAbilityMode: m, bgAbilityBonuses: {} }));
            }
            function handleSplitClick(key: string) {
              setForm(f => {
                const cur = { ...f.bgAbilityBonuses };
                if (cur[key]) { delete cur[key]; return { ...f, bgAbilityBonuses: cur }; }
                if (Object.keys(cur).length >= 2) return f;
                cur[key] = Object.values(cur).includes(2) ? 1 : 2;
                return { ...f, bgAbilityBonuses: cur };
              });
            }
            function handleEvenClick(key: string) {
              setForm(f => {
                const cur = { ...f.bgAbilityBonuses };
                if (cur[key]) { delete cur[key]; }
                else if (Object.keys(cur).length < abilityKeys.length) { cur[key] = 1; }
                return { ...f, bgAbilityBonuses: cur };
              });
            }
            const splitDone = Object.keys(bonuses).length === 2;
            const evenDone  = Object.keys(bonuses).length === abilityKeys.length;

            return (
              <div>
                <div style={{ marginBottom: 8 }}>
                  <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Ability Scores </span>
                  <span style={sourceTagStyle}>{bgDetail.name}</span>
                </div>
                <div style={{ display: "flex", gap: 6, marginBottom: 8 }}>
                  {(["split", "even"] as const).map(m => (
                    <button key={m} type="button" onClick={() => setMode(m)} style={{
                      padding: "4px 12px", borderRadius: 20, cursor: "pointer", fontSize: 11, fontWeight: 600,
                      border: `1px solid ${mode === m ? "#a78bfa" : "rgba(255,255,255,0.15)"}`,
                      background: mode === m ? "rgba(167,139,250,0.18)" : "rgba(255,255,255,0.04)",
                      color: mode === m ? "#a78bfa" : C.muted,
                    }}>
                      {m === "split" ? "+2 / +1" : "+1 each"}
                    </button>
                  ))}
                </div>
                <div style={{ color: C.muted, fontSize: 11, marginBottom: 8 }}>
                  {mode === "split"
                    ? splitDone ? "✓ All bonuses assigned" : !Object.values(bonuses).includes(2) ? "Click to assign +2" : "Click another for +1"
                    : evenDone  ? "✓ All bonuses assigned" : `Click abilities to assign +1 (${Object.keys(bonuses).length}/${abilityKeys.length})`
                  }
                </div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                  {prof.abilityScores.map((aName) => {
                    const key = ABILITY_NAME_TO_KEY[aName.toLowerCase()] ?? "";
                    const bonus = key ? bonuses[key] : undefined;
                    const isSelected = bonus != null;
                    const canSelect = mode === "split"
                      ? !isSelected && Object.keys(bonuses).length < 2
                      : !isSelected && Object.keys(bonuses).length < abilityKeys.length;
                    return (
                      <button key={aName} type="button"
                        onClick={() => key && (mode === "split" ? handleSplitClick(key) : handleEvenClick(key))}
                        style={{
                          padding: "6px 16px", borderRadius: 6, cursor: canSelect || isSelected ? "pointer" : "default",
                          border: `1px solid ${isSelected ? "#a78bfa" : canSelect ? "rgba(167,139,250,0.35)" : "rgba(255,255,255,0.12)"}`,
                          background: isSelected ? "rgba(167,139,250,0.2)" : "rgba(255,255,255,0.055)",
                          color: isSelected ? "#a78bfa" : canSelect ? "rgba(167,139,250,0.7)" : C.muted,
                          fontSize: 13, fontWeight: isSelected ? 700 : 400,
                          opacity: !canSelect && !isSelected ? 0.45 : 1,
                        }}>
                        {aName}
                        {isSelected && <span style={{ marginLeft: 5, fontWeight: 800 }}>{bonus! > 0 ? `+${bonus}` : bonus}</span>}
                      </button>
                    );
                  })}
                </div>
              </div>
            );
          })()}

          {/* Equipment option selector (interactive) */}
          {bgDetail.equipment && equipOptions.length > 0 && (
            <div>
              <div style={{ marginBottom: 8 }}>
                <span style={{ ...labelStyle, display: "inline", margin: 0 }}>Starting Equipment </span>
                <span style={sourceTagStyle}>{bgDetail.name}</span>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                {equipOptions.map((option) => {
                  const selected = form.chosenBgEquipmentOption === option.id;
                  return (
                    <button key={option.id} type="button"
                      onClick={() => setForm((f) => ({ ...f, chosenBgEquipmentOption: option.id }))}
                      style={{
                        padding: "6px 16px", borderRadius: 6, cursor: "pointer", fontSize: 13, fontWeight: selected ? 700 : 400,
                        border: `1px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: selected ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                        color: selected ? C.accentHl : C.text,
                      }}>
                      Option {option.id}
                    </button>
                  );
                })}
              </div>
              {form.chosenBgEquipmentOption && (
                <div style={{ color: C.accentHl, fontSize: 12, marginTop: 8 }}>
                  Inventory will start with option {form.chosenBgEquipmentOption}.
                </div>
              )}
            </div>
          )}
        </div>
      );
    })() : null;

    // Right column: description only (no interactive elements)
    const side = bgDetail ? (() => {
      const prof = bgDetail.proficiencies;
      const skills = prof?.skills ?? { fixed: bgDetail.proficiency.split(/[,;]/).map(s => s.trim()).filter(Boolean), choose: 0, from: null };
      const langs = prof?.languages ?? { fixed: [], choose: 0, from: null };
      const flavorTraits = bgDetail.traits.filter((t) => !/tool|language|starting equipment/i.test(t.name)).slice(0, 2);

      return (
        <div style={detailBoxStyle}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: C.accentHl }}>{bgDetail.name}</div>

          {(skills.fixed.length > 0 || skills.choose > 0) && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>Skills </span>
              <span style={sourceTagStyle}>{bgDetail.name}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                {skills.fixed.map(s => <span key={s} style={profChipStyle}>{s}</span>)}
                {skills.choose > 0 && (
                  <span style={{ ...profChipStyle, fontStyle: "italic", opacity: 0.7 }}>
                    Choose {skills.choose} skill{skills.choose > 1 ? "s" : ""}
                  </span>
                )}
              </div>
            </div>
          )}

          {langs.fixed.length > 0 && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>Languages </span>
              <span style={sourceTagStyle}>{bgDetail.name}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                {langs.fixed.map(n => <span key={n} style={profChipStyle}>{n}</span>)}
              </div>
            </div>
          )}

          {((prof?.feats && prof.feats.length > 0) || (prof?.featChoice ?? 0) > 0) && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>Feat </span>
              <span style={sourceTagStyle}>{bgDetail.name}</span>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 4, marginTop: 5 }}>
                {prof?.feats.map((feat) => (
                  <span key={feat.name} style={{ ...profChipStyle, background: "rgba(56,182,255,0.15)", border: "1px solid rgba(56,182,255,0.4)", color: C.accentHl }}>{feat.name}</span>
                ))}
                {(prof?.featChoice ?? 0) > 0 && (
                  <span style={{ ...profChipStyle, fontStyle: "italic", opacity: 0.7 }}>Choose 1 origin feat</span>
                )}
              </div>
            </div>
          )}

          {bgDetail.equipment && (
            <div style={{ marginBottom: 10 }}>
              <span style={{ color: C.muted, fontSize: 11, fontWeight: 600 }}>Equipment </span>
              <div style={{ color: C.muted, fontSize: 12, marginTop: 4, lineHeight: 1.6 }}>
                {bgDetail.equipment.slice(0, 300)}{bgDetail.equipment.length > 300 ? "…" : ""}
              </div>
            </div>
          )}

          {flavorTraits.map((t) => (
            <div key={t.name} style={{ marginBottom: 6, fontSize: 12 }}>
              <span style={{ fontWeight: 700, color: C.accentHl }}>{t.name}. </span>
              <span style={{ color: "rgba(160,180,220,0.65)" }}>{t.text.replace(/Source:.*$/m, "").trim()}</span>
            </div>
          ))}
        </div>
      );
    })() : (
      <div style={{ color: C.muted, fontSize: 13, padding: "12px 0" }}>Select a background to see its details.</div>
    );

    const main = (
      <div>
        <h2 style={headingStyle}>Choose a Background</h2>
        {availableBackgrounds.length === 0
          ? <p style={{ color: C.muted }}>No backgrounds found in compendium.</p>
          : (
            <>
              <input
                value={bgSearch}
                onChange={(e) => setBgSearch(e.target.value)}
                placeholder="Search backgrounds…"
                style={{ ...inputStyle, width: "100%", marginBottom: 12 }}
              />
              <div style={{
                display: "grid", gridTemplateColumns: "1fr 1fr",
                gap: 6, maxHeight: 340, overflowY: "auto", paddingRight: 4, marginBottom: 4,
              }}>
                {filtered.length === 0 && (
                  <p style={{ color: C.muted, gridColumn: "1 / -1" }}>No matches.</p>
                )}
                {filtered.map((b) => {
                  const sel = form.bgId === b.id;
                  return (
                    <button type="button" key={b.id} onClick={() => set("bgId", b.id)} style={{
                      padding: "10px 13px", borderRadius: 8, textAlign: "left",
                      border: `2px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                      background: sel ? "rgba(56,182,255,0.15)" : "rgba(255,255,255,0.055)",
                      color: sel ? C.accentHl : C.text, cursor: "pointer",
                      fontWeight: sel ? 700 : 500, fontSize: 13,
                      transition: "border-color 0.12s, background 0.12s",
                      whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis",
                    }}>{b.name}</button>
                  );
                })}
              </div>
            </>
          )
        }
        {bgChoicesMain}
        <NavButtons step={step} onBack={() => setStep(2)} onNext={() => setStep(4)}
          nextDisabled={!form.bgId || (equipmentOptions.length > 0 && !form.chosenBgEquipmentOption)} />
      </div>
    );

    return { main, side };
  }

  // Step 4: Level
  function StepLevel(): { main: React.ReactNode; side: React.ReactNode } {
    const subclassList = classDetail ? getSubclassList(classDetail) : [];
    const scNeeded = classDetail ? (getSubclassLevel(classDetail) ?? 99) : 99;
    const showSubclass = classDetail && form.level >= scNeeded && subclassList.length > 0;
    const features = classDetail ? featuresUpToLevel(classDetail, form.level) : [];
    const optGroups = classDetail ? getOptionalGroups(classDetail, form.level) : [];
    const classEquipmentText = extractClassStartingEquipment(classDetail);
    const classEquipmentOptions = parseStartingEquipmentOptions(classEquipmentText);

    function toggleOptional(name: string, exclusive: boolean, groupFeatures: string[]) {
      setForm((f) => {
        let next = [...f.chosenOptionals];
        if (exclusive) {
          // Remove all others in this group first, then toggle this one
          next = next.filter((n) => !groupFeatures.includes(n));
          if (!f.chosenOptionals.includes(name)) next.push(name);
        } else {
          if (next.includes(name)) next = next.filter((n) => n !== name);
          else next.push(name);
        }
        return { ...f, chosenOptionals: next };
      });
    }
    return renderLevelStep({
      level: form.level,
      setLevel: (level) => set("level", level),
      subclass: form.subclass,
      setSubclass: (value) => set("subclass", value),
      showSubclass,
      subclassList,
      optGroups,
      chosenOptionals: form.chosenOptionals,
      toggleOptional,
      parseFeatureGrants,
      classEquipmentText,
      classEquipmentOptions,
      chosenClassEquipmentOption: form.chosenClassEquipmentOption,
      chooseClassEquipmentOption: (id) => setForm((f) => ({ ...f, chosenClassEquipmentOption: id })),
      className: classDetail?.name ?? null,
      features,
      onBack: () => setStep(3),
      onNext: () => setStep(5),
    });
  }

  // Step 5: Skills, languages, and feature-based picks
  function StepSkills(): { main: React.ReactNode; side: React.ReactNode } {
    const skillList = classDetail ? parseSkillList(classDetail.proficiency) : [];
    const numSkills = classDetail?.numSkills ?? 0;
    const bgLangChoice = bgDetail?.proficiencies?.languages ?? { fixed: [], choose: 0, from: null };
    const bgSkillFixed = bgDetail?.proficiencies?.skills?.fixed ?? (bgDetail ? parseSkillList(bgDetail.proficiency) : []);
    const bgToolFixed = bgDetail?.proficiencies?.tools?.fixed ?? [];
    const core55eLanguageChoice = getCore55eLanguageChoice(raceDetail, selectedRuleset);
    const classFeatChoices = getClassFeatChoices(classDetail, form.level, featSummaries, selectedRuleset);
    const selectedClassFeatEntries = classFeatChoices
      .map((choice) => {
        const featId = form.chosenClassFeatIds[choice.featureName];
        if (!featId) return null;
        const detail = classFeatDetails[choice.featureName];
        if (!detail) return null;
        return { choice, detail };
      })
      .filter(Boolean) as Array<{ choice: ClassFeatChoice; detail: BackgroundFeat }>;
    const bgFeatChoices = getBackgroundFeatChoicesByRuleset(selectedRuleset ?? "5e", bgDetail);
    const raceFeatChoices: BackgroundFeatChoiceEntry[] = selectedRuleset === "5.5e" && raceFeatDetail
      ? raceFeatDetail.parsed.choices
          .filter(c => c.type === "proficiency" || c.type === "weapon_mastery")
          .map(choice => ({
            featName: raceFeatDetail.name,
            feat: raceFeatDetail.parsed,
            choice,
            key: `race:${raceFeatDetail.name}:${choice.id}`,
          }))
      : [];
    const weaponMasteryChoice = selectedRuleset === "5.5e" ? getWeaponMasteryChoice(classDetail, form.level) : null;
    const weaponOptions = getWeaponMasteryOptions(items);
    const missingClassFeatChoices = classFeatChoices.some((choice) => !form.chosenClassFeatIds[choice.featureName]);
    const missingCore55eLanguages = Boolean(core55eLanguageChoice) && form.chosenRaceLanguages.length < core55eLanguageChoice.choose;
    const hasAnything = numSkills > 0 || bgLangChoice.fixed.length > 0 || bgLangChoice.choose > 0 || classFeatChoices.length > 0 || bgFeatChoices.length > 0 || raceFeatChoices.length > 0 || Boolean(weaponMasteryChoice);

    function selectedFeatOptionsMatching(choices: BackgroundFeatChoiceEntry[], kind: "skill" | "tool" | "language"): string[] {
      const matcher = kind === "skill"
        ? (value: string) => ALL_SKILLS.some((skill) => normalizeChoiceKey(skill) === normalizeChoiceKey(value))
        : kind === "tool"
          ? (value: string) => ALL_TOOLS.some((tool) => normalizeChoiceKey(tool) === normalizeChoiceKey(value))
          : (value: string) => ALL_LANGUAGES.some((language) => normalizeChoiceKey(language) === normalizeChoiceKey(value));

      return choices.flatMap(({ key }) => (form.chosenFeatOptions[key] ?? []).filter(matcher));
    }

    const chosenBgFeatSkills = selectedFeatOptionsMatching(bgFeatChoices, "skill");
    const chosenBgFeatTools = selectedFeatOptionsMatching(bgFeatChoices, "tool");
    const chosenBgFeatLanguages = selectedFeatOptionsMatching(bgFeatChoices, "language");
    const chosenRaceFeatSkills = selectedFeatOptionsMatching(raceFeatChoices, "skill");
    const chosenRaceFeatTools = selectedFeatOptionsMatching(raceFeatChoices, "tool");
    const chosenRaceFeatLanguages = selectedFeatOptionsMatching(raceFeatChoices, "language");

    const takenSkillKeys = new Set<string>([
      ...form.chosenRaceSkills,
      ...bgSkillFixed,
      ...chosenBgFeatSkills,
      ...chosenRaceFeatSkills,
    ].map(normalizeChoiceKey));
    const takenToolKeys = new Set<string>([
      ...form.chosenRaceTools,
      ...bgToolFixed,
      ...form.chosenBgTools,
      ...chosenBgFeatTools,
      ...chosenRaceFeatTools,
    ].map(normalizeChoiceKey));
    const takenLanguageKeys = new Set<string>([
      ...bgLangChoice.fixed,
      ...form.chosenBgLanguages,
      ...(core55eLanguageChoice?.fixed ?? []),
      ...form.chosenRaceLanguages,
      ...chosenBgFeatLanguages,
      ...chosenRaceFeatLanguages,
    ].map(normalizeChoiceKey));

    function duplicateLocked(kind: "skill" | "tool" | "language", value: string, selected: boolean): boolean {
      if (selected) return false;
      const key = normalizeChoiceKey(value);
      if (kind === "skill") return takenSkillKeys.has(key);
      if (kind === "tool") return takenToolKeys.has(key);
      return takenLanguageKeys.has(key);
    }

    function choiceButtonStyle(selected: boolean, locked: boolean, duplicate: boolean): React.CSSProperties {
      return {
        padding: "6px 14px",
        borderRadius: 6,
        fontSize: 13,
        cursor: locked || duplicate ? "default" : "pointer",
        border: `1px solid ${selected ? C.accentHl : duplicate ? "rgba(160,180,220,0.12)" : "rgba(255,255,255,0.12)"}`,
        background: selected ? "rgba(56,182,255,0.18)" : duplicate ? "rgba(255,255,255,0.03)" : "rgba(255,255,255,0.055)",
        color: selected ? C.accentHl : (locked || duplicate) ? "rgba(160,180,220,0.35)" : C.text,
        fontWeight: selected ? 700 : 400,
      };
    }

    function toggleLanguage(language: string) {
      setForm((f) => {
        const sel = f.chosenBgLanguages.includes(language);
        return {
          ...f,
          chosenBgLanguages: sel
            ? f.chosenBgLanguages.filter((name) => name !== language)
            : f.chosenBgLanguages.length < bgLangChoice.choose
              ? [...f.chosenBgLanguages, language]
              : f.chosenBgLanguages,
        };
      });
    }

    function toggleRaceLanguage(language: string, max: number) {
      setForm((f) => {
        const sel = f.chosenRaceLanguages.includes(language);
        return {
          ...f,
          chosenRaceLanguages: sel
            ? f.chosenRaceLanguages.filter((name) => name !== language)
            : f.chosenRaceLanguages.length < max
              ? [...f.chosenRaceLanguages, language]
              : f.chosenRaceLanguages,
        };
      });
    }

    function toggleWeaponMastery(weapon: string) {
      if (!weaponMasteryChoice) return;
      setForm((f) => {
        const sel = f.chosenWeaponMasteries.includes(weapon);
        return {
          ...f,
          chosenWeaponMasteries: sel
            ? f.chosenWeaponMasteries.filter((name) => name !== weapon)
            : f.chosenWeaponMasteries.length < weaponMasteryChoice.count
              ? [...f.chosenWeaponMasteries, weapon]
              : f.chosenWeaponMasteries,
        };
      });
    }

    function toggleFeatChoice(choiceKey: string, option: string, max: number) {
      setForm((f) => {
        const current = f.chosenFeatOptions[choiceKey] ?? [];
        const selected = current.includes(option);
        const next = selected
          ? current.filter((value) => value !== option)
          : current.length < max ? [...current, option] : current;
        return {
          ...f,
          chosenFeatOptions: {
            ...f.chosenFeatOptions,
            [choiceKey]: next,
          },
        };
      });
    }

    const main = (
      <div>
        <h2 style={headingStyle}>Skills &amp; Proficiencies</h2>

        {/* Skill proficiencies */}
        {numSkills > 0 && skillList.length > 0 && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10 }}>
              <div style={{ ...labelStyle, margin: 0 }}>
                Skill Proficiencies{" "}
                {classDetail && <span style={sourceTagStyle}>from {classDetail.name}</span>}
              </div>
              <span style={{ fontSize: 12, color: form.chosenSkills.length >= numSkills ? C.accentHl : C.muted }}>
                {form.chosenSkills.length} / {numSkills}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {skillList.map((skill) => {
                const sel = form.chosenSkills.includes(skill);
                const duplicate = duplicateLocked("skill", skill, sel);
                const locked = (!sel && form.chosenSkills.length >= numSkills) || duplicate;
                return (
                  <button key={skill} type="button" disabled={locked}
                    onClick={() => setForm((f) => ({
                      ...f,
                      chosenSkills: sel
                        ? f.chosenSkills.filter(s => s !== skill)
                        : f.chosenSkills.length < numSkills ? [...f.chosenSkills, skill] : f.chosenSkills,
                    }))}
                    style={choiceButtonStyle(sel, locked, duplicate)}>
                    {skill}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {(bgLangChoice.fixed.length > 0 || bgLangChoice.choose > 0) && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ ...labelStyle, margin: 0 }}>
                Languages{" "}
                {bgDetail && <span style={sourceTagStyle}>from {bgDetail.name}</span>}
              </div>
              {bgLangChoice.choose > 0 && (
                <span style={{ fontSize: 12, color: form.chosenBgLanguages.length >= bgLangChoice.choose ? C.accentHl : C.muted }}>
                  {form.chosenBgLanguages.length} / {bgLangChoice.choose}
                </span>
              )}
            </div>
            {bgLangChoice.fixed.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: bgLangChoice.choose > 0 ? 10 : 0 }}>
                {bgLangChoice.fixed.map((language) => (
                  <span key={language} style={profChipStyle}>{language}</span>
                ))}
              </div>
            )}
            {bgLangChoice.choose > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {(bgLangChoice.from ?? ALL_LANGUAGES).map((language) => {
                  const sel = form.chosenBgLanguages.includes(language);
                  const duplicate = duplicateLocked("language", language, sel);
                  const locked = (!sel && form.chosenBgLanguages.length >= bgLangChoice.choose) || duplicate;
                  return (
                    <button key={language} type="button" disabled={locked}
                      onClick={() => toggleLanguage(language)}
                      style={choiceButtonStyle(sel, locked, duplicate)}>
                      {language}
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {core55eLanguageChoice && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ ...labelStyle, margin: 0 }}>
                Languages <span style={sourceTagStyle}>{core55eLanguageChoice.source}</span>
              </div>
              <span style={{ fontSize: 12, color: form.chosenRaceLanguages.length >= core55eLanguageChoice.choose ? C.accentHl : C.muted }}>
                {form.chosenRaceLanguages.length} / {core55eLanguageChoice.choose}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
              {core55eLanguageChoice.fixed.map((language) => (
                <span key={language} style={profChipStyle}>{language}</span>
              ))}
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
              {core55eLanguageChoice.from.map((language) => {
                const sel = form.chosenRaceLanguages.includes(language);
                const duplicate = duplicateLocked("language", language, sel);
                const locked = (!sel && form.chosenRaceLanguages.length >= core55eLanguageChoice.choose) || duplicate;
                return (
                  <button key={language} type="button" disabled={locked}
                    onClick={() => toggleRaceLanguage(language, core55eLanguageChoice.choose)}
                    style={choiceButtonStyle(sel, locked, duplicate)}>
                    {language}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {classFeatChoices.map((choice) => {
          const selectedId = form.chosenClassFeatIds[choice.featureName] ?? "";
          return (
            <div key={choice.featureName} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ ...labelStyle, margin: 0 }}>
                  {getClassFeatChoiceLabel(choice.featGroup)} <span style={sourceTagStyle}>{choice.featureName}</span>
                </div>
                <span style={{ fontSize: 12, color: selectedId ? C.accentHl : C.muted }}>
                  {selectedId ? "1 / 1" : "Required"}
                </span>
              </div>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {choice.options.map((option) => {
                  const selected = selectedId === option.id;
                  return (
                    <button key={option.id} type="button"
                      onClick={() => setForm((f) => ({
                        ...f,
                        chosenClassFeatIds: { ...f.chosenClassFeatIds, [choice.featureName]: option.id },
                      }))}
                      style={{
                        padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: "pointer",
                        border: `1px solid ${selected ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                        background: selected ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                        color: selected ? C.accentHl : C.text,
                        fontWeight: selected ? 700 : 400,
                      }}>
                      {getClassFeatOptionLabel(option.name, choice.featGroup)}
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}

        {bgFeatChoices.map(({ featName, feat, choice, key }) => {
          const options = getFeatChoiceOptions(choice);
          const selected = form.chosenFeatOptions[key] ?? [];
          const fixedGrants = [
            ...feat.grants.skills,
            ...feat.grants.tools,
            ...feat.grants.languages,
            ...feat.grants.weapons,
            ...feat.grants.armor,
          ];
          return (
            <div key={key} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ ...labelStyle, margin: 0 }}>
                  {featName} <span style={sourceTagStyle}>{bgDetail?.name}</span>
                </div>
                <span style={{ fontSize: 12, color: selected.length >= choice.count ? C.accentHl : C.muted }}>
                  {selected.length} / {choice.count}
                </span>
              </div>
              {fixedGrants.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {fixedGrants.map((grant) => (
                    <span key={`${key}:${grant}`} style={profChipStyle}>{grant}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto", padding: "2px 0" }}>
                {options.map((option) => {
                  const sel = selected.includes(option);
                  const duplicate = choice.type === "proficiency" && choice.anyOf?.includes("tool")
                    ? duplicateLocked("tool", option, sel)
                    : choice.type === "proficiency" && choice.anyOf?.includes("language")
                      ? duplicateLocked("language", option, sel)
                      : choice.type === "proficiency" && choice.anyOf?.includes("skill")
                        ? duplicateLocked("skill", option, sel)
                        : false;
                  const locked = (!sel && selected.length >= choice.count) || duplicate;
                  return (
                    <button key={option} type="button" disabled={locked}
                      onClick={() => toggleFeatChoice(key, option, choice.count)}
                      style={choiceButtonStyle(sel, locked, duplicate)}>
                      {option}
                    </button>
                  );
                })}
              </div>
              {choice.note && <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>{choice.note}</div>}
            </div>
          );
        })}

        {raceFeatChoices.map(({ featName, feat, choice, key }) => {
          const options = getFeatChoiceOptions(choice);
          const selected = form.chosenFeatOptions[key] ?? [];
          const fixedGrants = [
            ...feat.grants.skills,
            ...feat.grants.tools,
            ...feat.grants.languages,
            ...feat.grants.weapons,
            ...feat.grants.armor,
          ];
          return (
            <div key={key} style={{ marginBottom: 24 }}>
              <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
                <div style={{ ...labelStyle, margin: 0 }}>
                  {featName} <span style={{ ...sourceTagStyle, background: "rgba(251,146,60,0.15)", border: "1px solid rgba(251,146,60,0.4)", color: "#fb923c" }}>{raceDetail?.name}</span>
                </div>
                <span style={{ fontSize: 12, color: selected.length >= choice.count ? C.accentHl : C.muted }}>
                  {selected.length} / {choice.count}
                </span>
              </div>
              {fixedGrants.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 10 }}>
                  {fixedGrants.map((grant) => (
                    <span key={`${key}:${grant}`} style={profChipStyle}>{grant}</span>
                  ))}
                </div>
              )}
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 220, overflowY: "auto", padding: "2px 0" }}>
                {options.map((option) => {
                  const sel = selected.includes(option);
                  const duplicate = choice.type === "proficiency" && choice.anyOf?.includes("tool")
                    ? duplicateLocked("tool", option, sel)
                    : choice.type === "proficiency" && choice.anyOf?.includes("language")
                      ? duplicateLocked("language", option, sel)
                      : choice.type === "proficiency" && choice.anyOf?.includes("skill")
                        ? duplicateLocked("skill", option, sel)
                        : false;
                  const locked = (!sel && selected.length >= choice.count) || duplicate;
                  return (
                    <button key={option} type="button" disabled={locked}
                      onClick={() => toggleFeatChoice(key, option, choice.count)}
                      style={choiceButtonStyle(sel, locked, duplicate)}>
                      {option}
                    </button>
                  );
                })}
              </div>
              {choice.note && <div style={{ color: C.muted, fontSize: 12, marginTop: 8 }}>{choice.note}</div>}
            </div>
          );
        })}

        {/* Weapon Mastery */}
        {weaponMasteryChoice && (
          <div style={{ marginBottom: 24 }}>
            <div style={{ display: "flex", gap: 10, alignItems: "center", marginBottom: 10, flexWrap: "wrap" }}>
              <div style={{ ...labelStyle, margin: 0 }}>
                Weapon Mastery <span style={sourceTagStyle}>{weaponMasteryChoice.source}</span>
              </div>
              <span style={{ fontSize: 12, color: form.chosenWeaponMasteries.length >= weaponMasteryChoice.count ? C.accentHl : C.muted }}>
                {form.chosenWeaponMasteries.length} / {weaponMasteryChoice.count}
              </span>
            </div>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 6, maxHeight: 200, overflowY: "auto", padding: "2px 0" }}>
              {weaponOptions.map((weapon) => {
                const sel = form.chosenWeaponMasteries.includes(weapon);
                const locked = !sel && form.chosenWeaponMasteries.length >= weaponMasteryChoice.count;
                return (
                  <button key={weapon} type="button" disabled={locked}
                    onClick={() => toggleWeaponMastery(weapon)}
                    style={{
                      padding: "6px 14px", borderRadius: 6, fontSize: 13, cursor: locked ? "default" : "pointer",
                      border: `1px solid ${sel ? C.accentHl : "rgba(255,255,255,0.12)"}`,
                      background: sel ? "rgba(56,182,255,0.18)" : "rgba(255,255,255,0.055)",
                      color: sel ? C.accentHl : locked ? "rgba(160,180,220,0.35)" : C.text,
                      fontWeight: sel ? 700 : 400,
                    }}>
                    {weapon}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {!hasAnything && (
          <p style={{ color: C.muted, fontSize: 14 }}>There are no skill, language, or mastery choices at this level.</p>
        )}

        <NavButtons step={step} onBack={() => setStep(4)} onNext={() => setStep(6)} nextDisabled={missingClassFeatChoices || missingCore55eLanguages} />
      </div>
    );

    const side = (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {selectedClassFeatEntries.map(({ choice, detail }) => (
          <div key={choice.featureName} style={detailBoxStyle}>
            <div style={{ fontWeight: 700, fontSize: 13, color: C.accentHl, marginBottom: 10 }}>
              {getClassFeatChoiceLabel(choice.featGroup)}
            </div>
            <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 8 }}>
              {getClassFeatOptionLabel(detail.name, choice.featGroup)}
            </div>
            <div style={{ color: "rgba(160,180,220,0.75)", fontSize: 12, lineHeight: 1.5 }}>
              {(detail.text ?? "").replace(/Source:.*$/m, "").trim()}
            </div>
          </div>
        ))}
        {SideSummaryCard()}
      </div>
    );

    return { main, side };
  }

  // Step 6: Spells & Invocations
  function StepSpells(): { main: React.ReactNode; side: React.ReactNode } {
    const cantripCount = classDetail ? getCantripCount(classDetail, form.level) : 0;
    const maxSlotLvl   = classDetail ? getMaxSlotLevel(classDetail, form.level) : 0;
    const isCaster = classDetail ? isSpellcaster(classDetail) : false;

    const invocTable = classDetail ? getClassFeatureTable(classDetail, "Invocation", 1) : [];
    const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, form.level) : 0;

    const prepTable = classDetail ? getClassFeatureTable(classDetail, "Pact Magic|Spellcasting", 1) : [];
    const prepCount = prepTable.length > 0 ? tableValueAtLevel(prepTable, form.level) : 0;

    function toggleSpell(id: string, listKey: "chosenCantrips" | "chosenSpells" | "chosenInvocations", max: number) {
      setForm((f) => {
        const current = f[listKey];
        const next = current.includes(id)
          ? current.filter((x) => x !== id)
          : current.length < max ? [...current, id] : current;
        return { ...f, [listKey]: next };
      });
    }

    return renderSpellsStep({
      isCaster,
      cantripCount,
      classCantrips,
      chosenCantrips: form.chosenCantrips,
      toggleCantrip: (id) => toggleSpell(id, "chosenCantrips", cantripCount),
      invocCount,
      classInvocations: classInvocations.filter((inv) => eligibleInvocationIds.has(inv.id)),
      chosenInvocations: form.chosenInvocations,
      toggleInvocation: (id) => toggleSpell(id, "chosenInvocations", invocCount),
      invocationAllowed: (inv) => eligibleInvocationIds.has(inv.id),
      prepCount,
      maxSlotLevel: maxSlotLvl,
      classSpells,
      chosenSpells: form.chosenSpells,
      toggleSpell: (id) => toggleSpell(id, "chosenSpells", prepCount),
      onBack: () => setStep(5),
      onNext: () => setStep(7),
      side: SideSummaryCard(),
    });
  }

  // Step 7: Ability Scores
  function StepAbilityScores(): { main: React.ReactNode; side: React.ReactNode } {
    const usedIndices = Object.values(form.standardAssign).filter((v) => v >= 0);
    const spent = pointBuySpent(form.pbScores);
    const remaining = POINT_BUY_BUDGET - spent;
    const primaryKeys = getPrimaryAbilityKeys(classDetail);
    const bgBonuses = form.bgAbilityBonuses;
    const hasBgBonuses = Object.keys(bgBonuses).length > 0;

    return renderAbilityScoresStep({
      form,
      setAbilityMethod: (method) => set("abilityMethod", method),
      setStandardAssign: (key, idx) => setForm((f) => ({ ...f, standardAssign: { ...f.standardAssign, [key]: idx } })),
      setPointBuyScore: (key, score) => setForm((f) => ({ ...f, pbScores: { ...f.pbScores, [key]: score } })),
      setManualScore: (key, score) => setForm((f) => ({ ...f, manualScores: { ...f.manualScores, [key]: score } })),
      usedIndices,
      remaining,
      primaryKeys,
      bgBonuses,
      hasBgBonuses,
      backgroundName: bgDetail?.name,
      abilityLabels: ABILITY_LABELS,
      abilityKeys: ABILITY_KEYS,
      standardArray: STANDARD_ARRAY,
      pointBuyBudget: POINT_BUY_BUDGET,
      pointBuyCosts: POINT_BUY_COSTS,
      abilityMod,
      onBack: () => setStep(6),
      onNext: () => setStep(8),
      side: SideSummaryCard(),
    });
  }

  // Step 8: Derived Stats
  function StepDerivedStats(): { main: React.ReactNode; side: React.ReactNode } {
    const scores = resolvedScores(form);
    const conMod = abilityMod(scores.con ?? 10);
    const dexMod = abilityMod(scores.dex ?? 10);
    const hd = classDetail?.hd ?? 8;
    const prof = buildProficiencyMapForRuleset(
      selectedRuleset ?? "5e",
      form, classDetail, raceDetail, bgDetail,
      classCantrips, classSpells, classInvocations, raceFeatDetail, classFeatDetails,
    );
    const sections = [
      { label: "Skills", items: prof.skills },
      { label: "Saves", items: prof.saves },
      { label: "Armor", items: prof.armor },
      { label: "Weapons", items: prof.weapons },
      { label: "Tools", items: prof.tools },
      { label: "Languages", items: prof.languages },
      { label: "Weapon Masteries", items: prof.masteries },
      { label: "Spells", items: prof.spells },
      { label: "Invocations", items: prof.invocations },
    ].filter((s) => s.items.length > 0);

    return renderDerivedStatsStep({
      level: form.level,
      hpMax: form.hpMax,
      ac: form.ac,
      speed: form.speed,
      setField: (key, value) => set(key, value as never),
      hd,
      conMod,
      dexMod,
      raceSpeed: raceDetail?.speed ?? 30,
      sections,
      onBack: () => setStep(7),
      onNext: () => setStep(9),
      side: SideSummaryCard(),
    });
  }

  // Step 9: Identity
  function StepIdentity(): { main: React.ReactNode; side: React.ReactNode } {
    return renderIdentityStep({
      form,
      setField: (key, value) => set(key as keyof FormState, value as never),
      portraitInputRef,
      portraitPreview,
      setPortraitFile,
      setPortraitPreview,
      onBack: () => setStep(8),
      onNext: () => setStep(10),
      side: SideSummaryCard(),
    });
  }

  // Step 10: Campaigns
  function StepCampaigns(): { main: React.ReactNode; side: React.ReactNode } {
    return renderCampaignsStep({
      campaigns,
      selectedCampaignIds: form.campaignIds,
      toggleCampaign: (id, checked) => setForm((f) => ({
        ...f,
        campaignIds: checked ? [...f.campaignIds, id] : f.campaignIds.filter((campaignId) => campaignId !== id),
      })),
      error,
      busy,
      isEditing,
      onBack: () => setStep(9),
      onSubmit: handleSubmit,
      side: SideSummaryCard(),
    });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  if (editLoading) {
    return (
      <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
        <div style={{ maxWidth: 720, margin: "0 auto", padding: "32px 24px", color: C.muted }}>Loading…</div>
      </div>
    );
  }

  const { main, side } = renderStep();

  return (
    <div style={{ height: "100%", overflowY: "auto", background: C.bg, color: C.text }}>
      <div style={{ maxWidth: 1140, margin: "0 auto", padding: "36px 28px" }}>
        <h1 style={{ fontWeight: 900, fontSize: "var(--fs-hero)", margin: "0 0 8px", letterSpacing: -0.5 }}>
          {isEditing ? "Edit Character" : "Create Character"}
        </h1>
        <p style={{ margin: "0 0 24px", color: "rgba(160,180,220,0.55)", fontSize: 13 }}>
          {isEditing ? "Update your character details below." : "Build your character step by step."}
        </p>
        <StepHeader current={step} onStepClick={(s) => setStep(s)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 32, alignItems: "start" }}>
          <div>{main}</div>
          <div style={{ position: "sticky", top: 36 }}>{side}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
