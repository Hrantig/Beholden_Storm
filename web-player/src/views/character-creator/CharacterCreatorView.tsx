import React from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { C } from "@/lib/theme";
import {
  matchesRuleset,
  type Ruleset,
} from "@/lib/characterRules";
import { api, jsonInit } from "@/services/api";
import { useAuth } from "@/contexts/AuthContext";
import {
  invocationPrerequisitesMet,
  spellLooksLikeDamageSpell,
} from "@/views/character/CharacterSheetUtils";
import {
  getClassLanguageChoice as getClassLanguageChoiceFromRules,
  getCoreLanguageChoice as getCoreLanguageChoiceFromRules,
  parseFeatureGrants as parseFeatureGrantsFromRules,
} from "@/views/character/CharacterRuleParsers";
import { collectSpellChoicesFromEffects } from "@/domain/character/parseFeatureEffects";
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
} from "@/views/character-creator/constants/CharacterCreatorConstants";
import {
  abilityMod,
  abilityNamesToKeys,
  calcHpMax,
  classifyFeatSelection,
  extractClassStartingEquipment,
  featureMatchesSubclass,
  featuresUpToLevelForSubclass,
  getFeatureSubclassName,
  getCantripCount,
  getClassExpertiseChoices,
  getClassFeatureTable,
  getMaxSlotLevel,
  getPreparedSpellCount,
  getSpellcastingClassName,
  getSubclassLevel,
  getSubclassList,
  isSubclassChoiceFeature,
  normalizeChoiceKey,
  getWeaponMasteryOptions,
  isSpellcaster,
  parseRaceChoices,
  parseSkillList,
  parseStartingEquipmentOptions,
  tableValueAtLevel,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  buildResolvedSpellChoiceEntry,
  buildSpellListChoiceEntry,
  loadSpellChoiceOptions,
  sanitizeSpellChoiceSelections,
  type SharedSpellSummary,
} from "@/views/character-creator/utils/SpellChoiceUtils";
import type {
  ParsedFeatChoiceLike as ParsedFeatChoice,
  ParsedFeatLike as ParsedFeat,
  ParsedFeatDetailLike as BackgroundFeat,
} from "@/views/character-creator/utils/FeatChoiceTypes";
import type {
  BgDetail,
  BgSummary,
  Campaign,
  ClassDetail,
  ClassFeatChoice,
  ClassFeatureEntry,
  ClassSummary,
  CreatorResolvedSpellChoiceEntry,
  CreatorSpellListChoiceEntry,
  ItemSummary,
  LevelUpFeatDetail,
  LevelUpFeatSelection,
  ProficiencyChoice,
  RaceDetail,
  RaceSummary,
  SpellSummary,
  StructuredBgProficiencies,
} from "@/views/character-creator/utils/CharacterCreatorTypes";
import { Select } from "@/ui/Select";
import { NavButtons, SpellPicker, StepHeader } from "@/views/character-creator/shared/CharacterCreatorParts";
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
} from "@/views/character-creator/shared/CharacterCreatorStyles";
import {
  renderAbilityScoresStep,
  renderCampaignsStep,
  renderClassStep,
  renderDerivedStatsStep,
  renderIdentityStep,
  renderLevelStep,
  renderSpeciesStep,
  renderSpellsStep,
} from "@/views/character-creator/steps/CharacterCreatorStepPanels";
import { getFeatChoiceOptionsForStep5, getStep5ChoiceState } from "@/views/character-creator/utils/CharacterCreatorStep5Utils";
import { renderSkillsStep } from "@/views/character-creator/steps/CharacterCreatorSkillsStep";
import { renderBackgroundStep } from "@/views/character-creator/steps/CharacterCreatorBackgroundStep";
import {
  buildProficiencyMap as buildProficiencyMapFromUtils,
  parseSelectedClassOptionalFeatureEffects,
  buildStartingInventory as buildStartingInventoryFromUtils,
  getWeaponMasteryChoice as getWeaponMasteryChoiceFromUtils,
} from "@/views/character-creator/utils/CharacterCreatorProficiencyUtils";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";

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

function isToughFeat(name: string | null | undefined): boolean {
  return /\bTough\b/i.test(String(name ?? "").trim());
}

function toAbilityKey(value: string): string | null {
  const lowered = String(value ?? "").trim().toLowerCase();
  return ABILITY_NAME_TO_KEY[lowered] ?? null;
}

function getSelectedAbilityIncrease(
  choice: ParsedFeatChoice,
  selected: string[],
): Record<string, number> {
  if (choice.type !== "ability_score") return {};
  const amount = Math.max(1, Number(choice.amount ?? 1) || 1);
  const next: Record<string, number> = {};
  for (const raw of selected) {
    const key = toAbilityKey(raw);
    if (!key) continue;
    next[key] = (next[key] ?? 0) + amount;
  }
  return next;
}

// ---------------------------------------------------------------------------

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
  chosenLevelUpFeats: LevelUpFeatSelection[];
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
  chosenClassLanguages: string[];
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
    level: 1, subclass: "", chosenOptionals: [], chosenClassFeatIds: {}, chosenLevelUpFeats: [],
    chosenRaceSkills: [], chosenRaceLanguages: [], chosenRaceTools: [], chosenRaceFeatId: null, chosenRaceSize: null,
    chosenBgSkills: [], chosenBgOriginFeatId: null,
    chosenBgTools: [], chosenBgLanguages: [], chosenClassEquipmentOption: null, chosenBgEquipmentOption: null, chosenFeatOptions: {}, bgAbilityMode: "split", bgAbilityBonuses: {},
    chosenSkills: [], chosenClassLanguages: [], chosenWeaponMasteries: [], chosenCantrips: [], chosenSpells: [], chosenInvocations: [],
    abilityMethod: "standard",
    standardAssign: { str: -1, dex: -1, con: -1, int: -1, wis: -1, cha: -1 },
    pbScores: { ...DEFAULT_SCORES },
    manualScores: { ...DEFAULT_SCORES },
    hpMax: "", ac: "10", speed: "30",
    characterName: "", playerName: user?.name ?? "",
    alignment: "", hair: "", skin: "", heightText: "",
    age: "", weight: "", gender: "",
    color: C.accentHl,
    campaignIds: preselectedCampaign ? [preselectedCampaign] : [],
  };
}

function resolvedScores(form: FormState, featAbilityBonuses?: Record<string, number>): Record<string, number> {
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
  for (const [k, v] of Object.entries(featAbilityBonuses ?? {})) {
    if (k in base) base[k] = Math.min(20, (base[k] ?? 0) + v);
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
  const [bgOriginFeatDetail, setBgOriginFeatDetail] = React.useState<BackgroundFeat | null>(null);
  const [levelUpFeatDetails, setLevelUpFeatDetails] = React.useState<LevelUpFeatDetail[]>([]);
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
  const [featSpellChoiceOptions, setFeatSpellChoiceOptions] = React.useState<Record<string, SharedSpellSummary[]>>({});

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
  const selectedRuleset: Ruleset = "5.5e";
  const selectedClassFeatDetails = React.useMemo(
    () => Object.entries(form.chosenClassFeatIds)
      .map(([featureName]) => classFeatDetails[featureName])
      .filter(Boolean),
    [form.chosenClassFeatIds, classFeatDetails]
  );
  const selectedClassOptionalFeatureEffects = React.useMemo(
    () => parseSelectedClassOptionalFeatureEffects(classDetail, form.level, form.chosenOptionals),
    [classDetail, form.level, form.chosenOptionals]
  );
  const selectedClassOptionalSpellChoices = React.useMemo(
    () => collectSpellChoicesFromEffects(selectedClassOptionalFeatureEffects),
    [selectedClassOptionalFeatureEffects]
  );
  const selectedFeatAbilityBonuses = React.useMemo(() => {
    const bonusMap: Record<string, number> = {};
    const applyBonus = (bonus: Record<string, number>) => {
      for (const [key, value] of Object.entries(bonus)) {
        bonusMap[key] = (bonusMap[key] ?? 0) + value;
      }
    };
    const applyFeat = (prefix: string, feat: BackgroundFeat | null) => {
      if (!feat) return;
      for (const [key, value] of Object.entries(feat.parsed.grants.abilityIncreases)) {
        bonusMap[key] = (bonusMap[key] ?? 0) + value;
      }
      for (const choice of feat.parsed.choices) {
        if (choice.type !== "ability_score") continue;
        const selected = form.chosenFeatOptions[`${prefix}:${choice.id}`] ?? [];
        applyBonus(getSelectedAbilityIncrease(choice, selected));
      }
    };
    applyFeat(`bg:${bgOriginFeatDetail?.name ?? ""}`, bgOriginFeatDetail);
    applyFeat(`race:${raceFeatDetail?.name ?? ""}`, raceFeatDetail);
    for (const [featureName, feat] of Object.entries(classFeatDetails)) {
      applyFeat(`classfeat:${featureName}`, feat);
    }
    for (const detail of levelUpFeatDetails) {
      applyFeat(`levelupfeat:${detail.level}:${detail.featId}`, detail.feat);
    }
    return bonusMap;
  }, [bgOriginFeatDetail, raceFeatDetail, classFeatDetails, form.chosenFeatOptions, levelUpFeatDetails]);
  const step5SkillList = classDetail ? parseSkillList(classDetail.proficiency) : [];
  const step5NumSkills = classDetail?.numSkills ?? 0;
  const step5BgLangChoice = bgDetail?.proficiencies?.languages ?? { fixed: [], choose: 0, from: null };
  const step5BgSkillFixed = bgDetail?.proficiencies?.skills?.fixed ?? (bgDetail ? parseSkillList(bgDetail.proficiency) : []);
  const step5BgToolFixed = bgDetail?.proficiencies?.tools?.fixed ?? [];
  const step5CoreLanguageChoice = getCoreLanguageChoiceFromRules(raceDetail, STANDARD_55E_LANGUAGES);
  const step5ClassFeatChoices = getClassFeatChoices(classDetail, form.level, featSummaries, selectedRuleset);
  const step5ClassLanguageChoice = getClassLanguageChoiceFromRules(classDetail, form.level, ALL_LANGUAGES);
  const step5ClassExpertiseChoices = getClassExpertiseChoices(classDetail, form.level);
  const step5WeaponMasteryChoice = getWeaponMasteryChoiceFromUtils(classDetail, form.level);
  const step5WeaponOptions = getWeaponMasteryOptions(items);
  const step5ChoiceState = React.useMemo(() => getStep5ChoiceState({
    form,
    bgDetail,
    raceDetailName: raceDetail?.name,
    bgSkillFixed: step5BgSkillFixed,
    bgToolFixed: step5BgToolFixed,
    classFeatChoices: step5ClassFeatChoices,
    classFeatDetails,
    raceFeatDetail,
    levelUpFeatDetails,
    classLanguageChoice: step5ClassLanguageChoice,
    coreLanguageChoice: step5CoreLanguageChoice,
    classExpertiseChoices: step5ClassExpertiseChoices,
    weaponMasteryChoice: step5WeaponMasteryChoice,
    weaponOptions: step5WeaponOptions,
  }), [form, bgDetail, raceDetail, classFeatDetails, raceFeatDetail, levelUpFeatDetails, classDetail, featSummaries, items]); // eslint-disable-line react-hooks/exhaustive-deps
  const step6FeatSpellListChoices = React.useMemo<CreatorSpellListChoiceEntry[]>(
    () => step5ChoiceState.allFeatChoices
      .filter(({ choice }) => choice.type === "spell_list")
      .map(({ featName, choice, key, sourceLabel }) => {
        const resolvedSourceLabel = sourceLabel ?? featName;
        const entry = buildSpellListChoiceEntry({
          key,
          choice: { ...choice, options: getFeatChoiceOptionsForStep5(choice) },
          level: form.level,
          sourceLabel: resolvedSourceLabel,
        });
        return {
          ...entry,
          title: "Spell List",
          note: entry.options.length === 1 && resolvedSourceLabel !== featName
            ? (choice.note ?? "Spell list fixed by this feat.")
            : choice.note,
        };
      }),
    [form.level, step5ChoiceState]
  );
  const step6FeatResolvedSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => step5ChoiceState.allFeatChoices
      .filter(({ choice }) => choice.type === "spell")
      .map(({ featName, choice, key, sourceLabel }) => {
        const resolvedSourceLabel = sourceLabel ?? featName;
        const linkedChoiceKey = choice.linkedTo ? key.replace(`:${choice.id}`, `:${choice.linkedTo}`) : null;
        return {
          ...buildResolvedSpellChoiceEntry({
            key,
            choice,
            level: form.level,
            sourceLabel: resolvedSourceLabel,
            chosenOptions: form.chosenFeatOptions,
            linkedChoiceKey,
          }),
        };
      }),
    [form.chosenFeatOptions, form.level, step5ChoiceState]
  );
  const step6OptionalSpellChoices = React.useMemo<CreatorResolvedSpellChoiceEntry[]>(
    () => selectedClassOptionalSpellChoices.flatMap((effect) => {
      if (effect.count.kind !== "fixed") return [];
      return [{
        key: `classoptional:${effect.id}`,
        title: effect.level === 0 ? "Bonus Cantrip" : `Bonus Level ${effect.level} Spell`,
        sourceLabel: effect.source.name,
        count: effect.count.value,
        level: effect.level,
        note: effect.summary,
        listNames: effect.spellLists,
      }];
    }),
    [selectedClassOptionalSpellChoices]
  );
  const step6SpellListChoices = step6FeatSpellListChoices;
  const step6ResolvedSpellChoices = React.useMemo(
    () => [...step6FeatResolvedSpellChoices, ...step6OptionalSpellChoices],
    [step6FeatResolvedSpellChoices, step6OptionalSpellChoices]
  );
  const levelUpFeatLevels = React.useMemo(
    () => Array.from(new Set((classDetail?.autolevels ?? [])
      .filter((al) => al.scoreImprovement && al.level != null && al.level <= form.level)
      .map((al) => al.level)))
      .sort((a, b) => a - b),
    [classDetail, form.level]
  );
  const availableLevelUpFeats = React.useMemo(
    () => featSummaries.filter((feat) => !/^origin:/i.test(feat.name) && (form.level >= 19 || !/^boon of\b/i.test(feat.name)) && matchesRuleset(feat, selectedRuleset)),
    [featSummaries, form.level]
  );
  const levelUpFeatConflict = React.useMemo(() => {
    const counts = new Map<string, number>();
    for (const entry of form.chosenLevelUpFeats) {
      if (!entry?.featId) continue;
      counts.set(entry.featId, (counts.get(entry.featId) ?? 0) + 1);
    }
    for (const [featId, count] of counts.entries()) {
      if (count < 2) continue;
      const detail = levelUpFeatDetails.find((entry) => entry.featId === featId)?.feat;
      if (!detail?.parsed.repeatable) return true;
    }
    return false;
  }, [form.chosenLevelUpFeats, levelUpFeatDetails]);

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
          ruleset: "5.5e",
          classId: cd.classId ?? "",
          raceId: cd.raceId ?? "",
          bgId: cd.bgId ?? "",
          level: ch.level ?? 1,
          subclass: cd.subclass ?? "",
          chosenOptionals: cd.chosenOptionals ?? [],
          chosenClassFeatIds: cd.chosenClassFeatIds ?? {},
          chosenLevelUpFeats: cd.chosenLevelUpFeats ?? [],
          chosenRaceSkills: cd.chosenRaceSkills ?? [],
          chosenRaceLanguages: cd.chosenRaceLanguages ?? [],
          chosenRaceTools: cd.chosenRaceTools ?? [],
          chosenRaceFeatId: cd.chosenRaceFeatId ?? null,
          chosenRaceSize: cd.chosenRaceSize ?? null,
          chosenSkills: cd.chosenSkills ?? [],
          chosenBgOriginFeatId: cd.chosenBgOriginFeatId ?? null,
          chosenClassLanguages: cd.chosenClassLanguages ?? [],
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
          color: ch.color ?? C.accentHl,
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
      chosenClassLanguages: [],
      chosenClassEquipmentOption: null,
      chosenFeatOptions: Object.fromEntries(Object.entries(f.chosenFeatOptions).filter(([k]) => !k.startsWith("classfeat:"))),
    }));
    setClassFeatDetails({});
    api<ClassDetail>(`/api/compendium/classes/${form.classId}`).then(setClassDetail).catch(() => {});
  }, [form.classId]);

  // Load spell lists once classDetail is known
  React.useEffect(() => {
    if (!classDetail) { setClassCantrips([]); setClassSpells([]); setClassInvocations([]); return; }
    const spellcastingClassName = getSpellcastingClassName(classDetail, form.level, form.subclass) ?? classDetail.name;
    const name = encodeURIComponent(spellcastingClassName);
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&level=0&limit=200`).then(setClassCantrips).catch(() => {});
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&minLevel=1&maxLevel=9&limit=300`).then(setClassSpells).catch(() => {});
    // Eldritch Invocations live in their own spell list
    if (/warlock/i.test(classDetail.name)) {
      api<SpellSummary[]>("/api/spells/search?classes=Eldritch+Invocations&limit=200").then(setClassInvocations).catch(() => {});
    } else {
      setClassInvocations([]);
    }
  }, [classDetail, form.level, form.subclass]); // eslint-disable-line react-hooks/exhaustive-deps

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
  }, [classCantrips, classInvocations, form.chosenCantrips, form.chosenInvocations, form.level]);

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
      chosenClassLanguages: [],
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
    if (!form.chosenBgOriginFeatId) { setBgOriginFeatDetail(null); return; }
    api<{ name: string; text?: string; parsed: ParsedFeat }>(`/api/compendium/feats/${encodeURIComponent(form.chosenBgOriginFeatId)}`)
      .then((f) => setBgOriginFeatDetail({ name: f.name, text: f.text, parsed: f.parsed }))
      .catch(() => {});
  }, [form.chosenBgOriginFeatId]); // eslint-disable-line react-hooks/exhaustive-deps

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

  React.useEffect(() => {
    const entries = form.chosenLevelUpFeats.filter((entry) => Boolean(entry?.featId));
    if (entries.length === 0) {
      setLevelUpFeatDetails([]);
      return;
    }
    let cancelled = false;
    Promise.all(
      entries.map(async ({ level, featId }) => {
        const detail = await api<{ name: string; text?: string; parsed: ParsedFeat }>(`/api/compendium/feats/${encodeURIComponent(featId)}`);
        return { level, featId, feat: { name: detail.name, text: detail.text, parsed: detail.parsed } } satisfies LevelUpFeatDetail;
      })
    )
      .then((details) => {
        if (cancelled) return;
        setLevelUpFeatDetails(details);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [form.chosenLevelUpFeats]); // eslint-disable-line react-hooks/exhaustive-deps

  React.useEffect(() => {
    setForm((f) => {
      const allowedLevels = new Set(levelUpFeatLevels);
      const nextChosenLevelUpFeats = f.chosenLevelUpFeats.filter((entry) => allowedLevels.has(entry.level));
      const nextChosenFeatOptions = Object.fromEntries(
        Object.entries(f.chosenFeatOptions).filter(([key]) => {
          const match = key.match(/^levelupfeat:(\d+):/);
          return !match || allowedLevels.has(Number(match[1]));
        })
      );
      if (nextChosenLevelUpFeats.length === f.chosenLevelUpFeats.length && Object.keys(nextChosenFeatOptions).length === Object.keys(f.chosenFeatOptions).length) {
        return f;
      }
      return {
        ...f,
        chosenLevelUpFeats: nextChosenLevelUpFeats,
        chosenFeatOptions: nextChosenFeatOptions,
      };
    });
  }, [levelUpFeatLevels]);

  React.useEffect(() => {
    if (step6ResolvedSpellChoices.length === 0) {
      setFeatSpellChoiceOptions({});
      return;
    }
    let cancelled = false;
    loadSpellChoiceOptions(step6ResolvedSpellChoices, (query) => api<SpellSummary[]>(query))
      .then((optionsByKey) => {
        if (!cancelled) setFeatSpellChoiceOptions(optionsByKey);
      })
      .catch(() => {
        if (!cancelled) setFeatSpellChoiceOptions({});
      });
    return () => { cancelled = true; };
  }, [step6ResolvedSpellChoices]);

  React.useEffect(() => {
    const allSpellChoiceKeys = new Set<string>([
      ...step6SpellListChoices.map((choice) => choice.key),
      ...step6ResolvedSpellChoices.map((choice) => choice.key),
    ]);
    if (allSpellChoiceKeys.size === 0) return;
    setForm((f) => {
      const nextChosenFeatOptions = sanitizeSpellChoiceSelections({
        currentSelections: f.chosenFeatOptions,
        spellListChoices: step6SpellListChoices,
        resolvedSpellChoices: step6ResolvedSpellChoices,
        spellOptionsByKey: featSpellChoiceOptions,
      });
      const changed = Object.keys(nextChosenFeatOptions).length !== Object.keys(f.chosenFeatOptions).length
        || Object.entries(nextChosenFeatOptions).some(([key, values]) => {
          const current = f.chosenFeatOptions[key] ?? [];
          return values.length !== current.length || values.some((value, index) => value !== current[index]);
        });
      return changed ? { ...f, chosenFeatOptions: nextChosenFeatOptions } : f;
    });
  }, [featSpellChoiceOptions, step6ResolvedSpellChoices, step6SpellListChoices]);

  // Load bg detail when selected
  React.useEffect(() => {
    if (!form.bgId) { setBgDetail(null); return; }
    setBgOriginFeatDetail(null);
    setForm(f => ({ ...f, chosenBgTools: [], chosenBgLanguages: [], chosenBgOriginFeatId: null, chosenBgEquipmentOption: null, chosenFeatOptions: {}, bgAbilityMode: "split", bgAbilityBonuses: {} }));
    api<BgDetail>(`/api/compendium/backgrounds/${form.bgId}`).then(setBgDetail).catch(() => {});
  }, [form.bgId]);

  // Auto-select directly-granted background feats (e.g. Charlatan → Skilled)
  React.useEffect(() => {
    if (!bgDetail) return;
    const prof = bgDetail.proficiencies;
    if (!prof || prof.featChoice > 0 || prof.feats.length === 0) return;
    const grantedName = prof.feats[0]?.name;
    if (!grantedName) return;
    const match = featSummaries.find((f) =>
      f.name.toLowerCase().startsWith(grantedName.toLowerCase())
    );
    if (match) {
      setForm((f) => f.chosenBgOriginFeatId === match.id ? f : { ...f, chosenBgOriginFeatId: match.id });
    }
  }, [bgDetail, featSummaries]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select the first equipment option when bgDetail loads
  React.useEffect(() => {
    if (!bgDetail?.equipment) return;
    const options = parseStartingEquipmentOptions(bgDetail.equipment);
    if (options.length > 0) {
      setForm(f => f.chosenBgEquipmentOption ? f : { ...f, chosenBgEquipmentOption: options[0].id });
    }
  }, [bgDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-select the first equipment option when classDetail loads
  React.useEffect(() => {
    if (!classDetail) return;
    const text = extractClassStartingEquipment(classDetail);
    const options = parseStartingEquipmentOptions(text);
    if (options.length > 0) {
      setForm(f => f.chosenClassEquipmentOption ? f : { ...f, chosenClassEquipmentOption: options[0].id });
    }
  }, [classDetail]); // eslint-disable-line react-hooks/exhaustive-deps

  // Auto-calculate HP, speed when class/race/scores change
  React.useEffect(() => {
    const hd = classDetail?.hd ?? 8;
    const scores = resolvedScores(form, selectedFeatAbilityBonuses);
    const conMod = abilityMod(scores.con ?? 10);
    const selectedBgFeatName = bgOriginFeatDetail?.name
      ?? featSummaries.find((feat) => feat.id === form.chosenBgOriginFeatId)?.name
      ?? null;
    const hasTough =
      isToughFeat(raceFeatDetail?.name)
      || isToughFeat(selectedBgFeatName)
      || selectedClassFeatDetails.some((feat) => isToughFeat(feat.name))
      || levelUpFeatDetails.some(({ feat }) => isToughFeat(feat.name));
    const hp = calcHpMax(hd, form.level, conMod) + (hasTough ? form.level * 2 : 0);
    const baseSpeed = raceDetail?.speed ?? 30;
    setForm((f) => ({ ...f, hpMax: String(hp), speed: String(baseSpeed) }));
  }, [classDetail, raceDetail, form.level, form.abilityMethod, form.standardAssign, form.pbScores, form.manualScores, raceFeatDetail?.name, bgOriginFeatDetail?.name, form.chosenBgOriginFeatId, featSummaries, selectedClassFeatDetails, selectedFeatAbilityBonuses, levelUpFeatDetails]); // eslint-disable-line react-hooks/exhaustive-deps

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
      const scores = resolvedScores(form, selectedFeatAbilityBonuses);
      const classFeatures: ClassFeatureEntry[] = (() => {
        if (!classDetail) return [];
        const featureByName = new Map<string, ClassFeatureEntry>();
        for (const al of classDetail.autolevels) {
          if (al.level == null || al.level > form.level) continue;
          for (const f of al.features) {
            if (!featureMatchesSubclass(f, form.subclass)) continue;
            if (isSubclassChoiceFeature(f)) continue;
            const isChosenSubclassFeature = Boolean(getFeatureSubclassName(f));
            if (!f.optional || isChosenSubclassFeature) {
              featureByName.set(f.name, {
                id: f.name,
                name: f.name,
                text: f.text?.trim() ?? "",
                preparedSpellProgression: f.preparedSpellProgression,
              });
              continue;
            }
            if (!form.chosenOptionals.includes(f.name)) continue;
            if (featureByName.has(f.name)) continue;
            featureByName.set(f.name, {
              id: f.name,
              name: f.name,
              text: f.text?.trim() ?? "",
              preparedSpellProgression: f.preparedSpellProgression,
            });
          }
        }
        const orderedFeatures = Array.from(featureByName.values());
        const selectedBgOriginFeat = bgOriginFeatDetail
          ? [{ id: bgOriginFeatDetail.name, name: bgOriginFeatDetail.name, text: bgOriginFeatDetail.text?.trim() ?? "" }]
          : [];
        const selectedClassFeats = Object.entries(form.chosenClassFeatIds)
          .map(([featureName]) => classFeatDetails[featureName])
          .filter(Boolean)
          .map((feat) => ({ id: feat.name, name: feat.name, text: feat.text?.trim() ?? "" }));
        const selectedLevelUpFeats = levelUpFeatDetails.map(({ level, featId, feat }) => ({
          id: `levelupfeat:${level}:${featId}`,
          name: feat.name,
          text: feat.text?.trim() ?? "",
        }));
        return [...orderedFeatures, ...selectedBgOriginFeat, ...selectedClassFeats, ...selectedLevelUpFeats];
      })();
      const selectedFeatureNames = classFeatures.map((feature) => feature.name);
      const startingInventory = isEditing
        ? undefined
        : buildStartingInventoryFromUtils(form, bgDetail, classDetail, items);
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
          selectedFeatureNames,
          chosenClassFeatIds: form.chosenClassFeatIds,
          chosenLevelUpFeats: form.chosenLevelUpFeats,
          chosenRaceSkills: form.chosenRaceSkills,
          chosenRaceLanguages: form.chosenRaceLanguages,
          chosenRaceTools: form.chosenRaceTools,
          chosenRaceFeatId: form.chosenRaceFeatId,
          chosenRaceSize: form.chosenRaceSize,
          chosenBgOriginFeatId: form.chosenBgOriginFeatId,
          chosenSkills: form.chosenSkills,
          chosenClassLanguages: form.chosenClassLanguages,
          chosenClassEquipmentOption: form.chosenClassEquipmentOption,
          chosenBgEquipmentOption: form.chosenBgEquipmentOption,
          chosenFeatOptions: form.chosenFeatOptions,
          chosenWeaponMasteries: form.chosenWeaponMasteries,
          chosenCantrips: form.chosenCantrips,
          chosenSpells: form.chosenSpells,
          chosenInvocations: form.chosenInvocations,
          ...(startingInventory ? { inventory: startingInventory } : {}),
          proficiencies: buildProficiencyMapFromUtils({
            form,
            classDetail,
            raceDetail,
            bgDetail,
            classCantrips,
            classSpells,
            classInvocations,
            bgOriginFeatDetail,
            raceFeatDetail,
            classFeatDetails,
            levelUpFeatDetails,
          }),
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
    const scores = resolvedScores(form, selectedFeatAbilityBonuses);
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {(classDetail || raceDetail || bgDetail) && (
          <div style={detailBoxStyle}>
            <div style={{ fontWeight: 700, fontSize: "var(--fs-subtitle)", color: C.accentHl, marginBottom: 10 }}>Character Summary</div>
            {classDetail && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Class </span>
                <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{classDetail.name}</span>
                {classDetail.hd && <span style={{ color: C.muted, fontSize: "var(--fs-small)", marginLeft: 6 }}>d{classDetail.hd}</span>}
              </div>
            )}
            {raceDetail && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Species </span>
                <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{raceDetail.name}</span>
                {raceDetail.speed && <span style={{ color: C.muted, fontSize: "var(--fs-small)", marginLeft: 6 }}>{raceDetail.speed} ft</span>}
              </div>
            )}
            {bgDetail && (
              <div style={{ marginBottom: 6 }}>
                <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Background </span>
                <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{bgDetail.name}</span>
              </div>
            )}
            <div style={{ marginBottom: 10 }}>
              <span style={{ color: C.muted, fontSize: "var(--fs-small)", fontWeight: 600 }}>Level </span>
              <span style={{ fontSize: "var(--fs-subtitle)", fontWeight: 700 }}>{form.level}</span>
            </div>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 4 }}>
              {ABILITY_KEYS.map(k => {
                const score = scores[k] ?? 10;
                const mod = abilityMod(score);
                return (
                  <div key={k} style={{ textAlign: "center", padding: "5px 4px", borderRadius: 6, background: "rgba(255,255,255,0.04)" }}>
                    <div style={{ color: C.muted, fontSize: "var(--fs-tiny)", fontWeight: 700, textTransform: "uppercase" }}>{ABILITY_LABELS[k]}</div>
                    <div style={{ fontWeight: 700, fontSize: "var(--fs-medium)" }}>{score}</div>
                    <div style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{mod >= 0 ? "+" : ""}{mod}</div>
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
        ruleset: "5.5e",
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
      ? (raceDetail.parsedChoices ?? parseRaceChoices(raceDetail.traits))
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
  }

  // Step 3: Background
  function StepBackground(): { main: React.ReactNode; side: React.ReactNode } {
    const availableBackgrounds = bgs.filter((b) => matchesRuleset(b, selectedRuleset));
    const filtered = bgSearch
      ? availableBackgrounds.filter((b) => b.name.toLowerCase().includes(bgSearch.toLowerCase()))
      : availableBackgrounds;
    const equipmentOptions = parseStartingEquipmentOptions(bgDetail?.equipment);
    const originFeats = featSummaries.filter((f) => /\borigin\b/i.test(f.name) && matchesRuleset(f, selectedRuleset));
    const filteredBgFeats = bgOriginFeatSearch
      ? originFeats.filter((f) => f.name.toLowerCase().includes(bgOriginFeatSearch.toLowerCase()))
      : originFeats;

    return renderBackgroundStep({
      availableBackgrounds,
      filteredBackgrounds: filtered,
      bgSearch,
      setBgSearch,
      form,
      setForm,
      selectBackground: (id) => set("bgId", id),
      bgDetail,
      bgOriginFeatSearch,
      setBgOriginFeatSearch,
      filteredBgFeats,
      equipmentOptions,
      onBack: () => setStep(2),
      onNext: () => setStep(4),
      step,
    });
  }

  // Step 4: Level
  function StepLevel(): { main: React.ReactNode; side: React.ReactNode } {
    const subclassList = classDetail ? getSubclassList(classDetail) : [];
    const scNeeded = classDetail ? (getSubclassLevel(classDetail) ?? 99) : 99;
    const showSubclass = classDetail && form.level >= scNeeded && subclassList.length > 0;
    const features = classDetail ? featuresUpToLevelForSubclass(classDetail, form.level, form.subclass) : [];
    const optGroups = classDetail ? getOptionalGroups(classDetail, form.level) : [];
    const classEquipmentText = extractClassStartingEquipment(classDetail);
    const classEquipmentOptions = parseStartingEquipmentOptions(classEquipmentText);
    const levelUpFeatChoices = levelUpFeatLevels.map((level) => ({
      level,
      selectedFeatId: form.chosenLevelUpFeats.find((entry) => entry.level === level)?.featId ?? null,
      options: availableLevelUpFeats.map((feat) => ({ id: feat.id, name: feat.name })),
    }));

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
      parseFeatureGrants: parseFeatureGrantsFromRules,
      classEquipmentText,
      classEquipmentOptions,
      chosenClassEquipmentOption: form.chosenClassEquipmentOption,
      chooseClassEquipmentOption: (id) => setForm((f) => ({ ...f, chosenClassEquipmentOption: id })),
      className: classDetail?.name ?? null,
      features,
      levelUpFeatChoices,
      chooseLevelUpFeat: (level, featId) => setForm((f) => ({
        ...f,
        chosenLevelUpFeats: featId
          ? [
              ...f.chosenLevelUpFeats.filter((entry) => entry.level !== level),
              { level, featId },
            ].sort((a, b) => a.level - b.level)
          : f.chosenLevelUpFeats.filter((entry) => entry.level !== level),
      })),
      levelUpFeatConflict,
      onBack: () => setStep(3),
      onNext: () => setStep(5),
    });
  }

  // Step 5: Skills, languages, and feature-based picks
  function StepSkills(): { main: React.ReactNode; side: React.ReactNode } {
    return renderSkillsStep({
      form,
      setForm,
      classDetailName: classDetail?.name ?? null,
      bgDetailName: bgDetail?.name ?? null,
      skillList: step5SkillList,
      numSkills: step5NumSkills,
      bgLangChoice: step5BgLangChoice,
      coreLanguageChoice: step5CoreLanguageChoice,
      classLanguageChoice: step5ClassLanguageChoice,
      classFeatChoices: step5ClassFeatChoices,
      classExpertiseChoices: step5ClassExpertiseChoices,
      classSelectedFeatChoices: step5ChoiceState.classSelectedFeatChoices,
      selectedClassFeatEntries: step5ChoiceState.selectedClassFeatEntries,
      bgFeatChoices: step5ChoiceState.bgFeatChoices,
      raceFeatChoices: step5ChoiceState.raceFeatChoices,
      weaponMasteryChoice: step5WeaponMasteryChoice,
      weaponOptions: step5WeaponOptions,
      choiceState: {
        missingClassFeatChoices: step5ChoiceState.missingClassFeatChoices,
        missingClassExpertiseChoices: step5ChoiceState.missingClassExpertiseChoices,
        missingFeatOptionSelections: step5ChoiceState.missingFeatOptionSelections,
        missingCoreLanguages: step5ChoiceState.missingCoreLanguages,
        missingClassLanguages: step5ChoiceState.missingClassLanguages,
        hasAnything: step5ChoiceState.hasAnything,
        takenSkillKeys: step5ChoiceState.takenSkillKeys,
        takenToolKeys: step5ChoiceState.takenToolKeys,
        takenLanguageKeys: step5ChoiceState.takenLanguageKeys,
        takenExpertiseKeys: step5ChoiceState.takenExpertiseKeys,
      },
      getClassFeatChoiceLabel,
      getClassFeatOptionLabel,
      sideSummary: SideSummaryCard(),
      onBack: () => setStep(4),
      onNext: () => setStep(6),
    });
  }

  // Step 6: Spells & Invocations
  function StepSpells(): { main: React.ReactNode; side: React.ReactNode } {
    const cantripCount = classDetail ? getCantripCount(classDetail, form.level, form.subclass) : 0;
    const maxSlotLvl   = classDetail ? getMaxSlotLevel(classDetail, form.level, form.subclass) : 0;
    const isCaster = classDetail ? isSpellcaster(classDetail, form.level, form.subclass) : false;

    const invocTable = classDetail ? getClassFeatureTable(classDetail, "Invocation", 1, form.subclass) : [];
    const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, form.level) : 0;

    const prepCount = classDetail ? getPreparedSpellCount(classDetail, form.level, form.subclass) : 0;
    const extraSpellListChoices = step6SpellListChoices.map((entry) => ({
      key: entry.key,
      title: entry.title,
      sourceLabel: entry.sourceLabel,
      options: entry.options,
      chosen: form.chosenFeatOptions[entry.key] ?? [],
      max: entry.count,
      note: entry.note,
      emptyMsg: "No eligible spell lists found.",
      onToggle: (value: string) => setForm((f) => {
        const current = f.chosenFeatOptions[entry.key] ?? [];
        const next = current.includes(value)
          ? current.filter((x) => x !== value)
          : current.length < entry.count ? [...current, value] : current;
        return { ...f, chosenFeatOptions: { ...f.chosenFeatOptions, [entry.key]: next } };
      }),
    }));
    const extraSpellChoices = step6ResolvedSpellChoices.map((entry) => ({
      key: entry.key,
      title: entry.title,
      sourceLabel: entry.sourceLabel,
      spells: (featSpellChoiceOptions[entry.key] ?? []).map((spell) => ({
        ...spell,
        id: spell.name,
        level: spell.level ?? null,
      })),
      chosen: form.chosenFeatOptions[entry.key] ?? [],
      max: entry.count,
      note: entry.note,
      emptyMsg: entry.linkedTo ? "Choose the spell list first." : "No eligible spell options found.",
      onToggle: (name: string) => setForm((f) => {
        const current = f.chosenFeatOptions[entry.key] ?? [];
        const next = current.includes(name)
          ? current.filter((x) => x !== name)
          : current.length < entry.count ? [...current, name] : current;
        return { ...f, chosenFeatOptions: { ...f.chosenFeatOptions, [entry.key]: next } };
      }),
    }));
    const missingExtraSpellSelections =
      extraSpellListChoices.some((entry) => entry.chosen.length < entry.max)
      || extraSpellChoices.some((entry) => entry.chosen.length < entry.max);

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
      extraSpellListChoices,
      extraSpellChoices,
      onBack: () => setStep(5),
      onNext: () => setStep(7),
      nextDisabled: missingExtraSpellSelections,
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
    const scores = resolvedScores(form, selectedFeatAbilityBonuses);
    const conMod = abilityMod(scores.con ?? 10);
    const dexMod = abilityMod(scores.dex ?? 10);
    const hd = classDetail?.hd ?? 8;
    const prof = buildProficiencyMapFromUtils({
      form,
      classDetail,
      raceDetail,
      bgDetail,
      classCantrips,
      classSpells,
      classInvocations,
      bgOriginFeatDetail,
      raceFeatDetail,
      classFeatDetails,
      levelUpFeatDetails,
    });
    const sections = [
      { label: "Skills", items: prof.skills },
      { label: "Expertise", items: prof.expertise },
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
      form: form as unknown as Record<string, unknown> & { [key: string]: unknown },
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
        <p style={{ margin: "0 0 24px", color: "rgba(160,180,220,0.55)", fontSize: "var(--fs-subtitle)" }}>
          {isEditing ? "Update your character details below." : "Build your character step by step."}
        </p>
        <StepHeader current={step} onStepClick={(s) => setStep(s as Step)} />
        <div style={{ display: "grid", gridTemplateColumns: "1fr 360px", gap: 32, alignItems: "start" }}>
          <div>{main}</div>
          <div style={{ position: "sticky", top: 36 }}>{side}</div>
        </div>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------


