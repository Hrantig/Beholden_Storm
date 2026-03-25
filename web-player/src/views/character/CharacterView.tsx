import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { C } from "@/lib/theme";
import { rollDiceExpr, hasDiceTerm } from "@/lib/dice";
import { useWs } from "@/services/ws";
import {
  Wrap,
  NoteEditDrawer,
} from "@/views/character/CharacterViewParts";
import { CharacterAbilitiesPanels, CharacterProficienciesPanel } from "@/views/character/CharacterAbilitiesPanels";
import { CharacterCombatPanels } from "@/views/character/CharacterCombatPanels";
import { CharacterHudPanel } from "@/views/character/CharacterHudPanel";
import { InventoryPanel } from "@/views/character/CharacterInventoryPanel";
import {
  buildGrantedSpellDataFromEffects,
  collectSensesFromEffects,
  collectDefensesFromEffects,
  deriveArmorClassBonusFromEffects,
  deriveHitPointMaxBonusFromEffects,
  deriveModifierBonusFromEffects,
  deriveSpeedBonusFromEffects,
  deriveUnarmoredDefenseFromEffects,
  parseFeatureEffects,
  type ParseFeatureEffectsInput,
} from "@/domain/character/parseFeatureEffects";
import { CharacterDefensesPanel } from "@/views/character/CharacterDefensesPanel";
import { SpellSlotsPanel, RichSpellsPanel, ItemSpellsPanel } from "@/views/character/CharacterSpellsPanel";
import { CharacterSupportPanels } from "@/views/character/CharacterSupportPanels";
import {
  abilityMod,
  dedupeTaggedItems,
  formatModifier,
  getInitiativeBonus,
  getPassiveScore,
  getSaveBonus,
  getSkillBonus,
  normalizeArmorProficiencyName,
  normalizeLanguageName,
  normalizeResourceKey,
  normalizeWeaponProficiencyName,
  proficiencyBonus,
} from "@/views/character/CharacterSheetUtils";
import { featureMatchesSubclass, getPreparedSpellCount, isSubclassChoiceFeature } from "@/views/character-creator/CharacterCreatorUtils";
import type {
  AbilKey,
  CharacterCampaign,
  CharacterData,
  ClassFeatureEntry,
  ConditionInstance,
  PlayerNote,
  ProficiencyMap,
  ResourceCounter,
} from "@/views/character/CharacterSheetTypes";
import {
  type InventoryItem,
  getEquipState,
  hasArmorProficiency,
  hasStealthDisadvantage,
  isArmorItem,
  isShieldItem,
} from "@/views/character/CharacterInventory";

/** Total XP required to reach each level (index = level). Index 0 unused. */
const XP_TO_LEVEL = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 260000, 300000, 355000];

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
    features?: Array<{
      name: string;
      text: string;
      optional?: boolean;
    }>;
  }>;
}

interface LoreTraitDetail {
  name: string;
  text: string;
}

interface RaceFeatureDetail {
  id: string;
  name: string;
  traits: LoreTraitDetail[];
}

interface BackgroundFeatureDetail {
  id: string;
  name: string;
  traits: LoreTraitDetail[];
}

interface FeatFeatureDetail {
  id: string;
  name: string;
  text?: string | null;
}

interface LevelUpFeatDetail {
  level: number;
  featId: string;
  feat: FeatFeatureDetail;
}

interface InvocationFeatureDetail {
  id: string;
  name: string;
  text: string;
}

interface SheetOverrides {
  tempHp: number;
  acBonus: number;
  hpMaxBonus: number;
  inspiration?: boolean;
}

type EditableSheetOverrideKey = "tempHp" | "acBonus" | "hpMaxBonus";

interface EditableSheetOverrideField {
  key: EditableSheetOverrideKey;
  label: string;
  help: string;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

function normalizePlayerFeatures(
  charData: CharacterData | null | undefined,
  characterLevel: number,
  classDetail: ClassRestDetail | null,
  raceDetail: RaceFeatureDetail | null,
  backgroundDetail: BackgroundFeatureDetail | null,
  bgOriginFeatDetail: FeatFeatureDetail | null,
  raceFeatDetail: FeatFeatureDetail | null,
  levelUpFeatDetails: LevelUpFeatDetail[],
  invocationDetails: InvocationFeatureDetail[],
): ClassFeatureEntry[] {
  const saved = charData?.classFeatures ?? [];
  const selectedSubclass = String(charData?.subclass ?? "").trim();
  const featureById = new Map<string, ClassFeatureEntry>();
  const featureKeys = new Set<string>();
  const addFeature = (feature: ClassFeatureEntry | null | undefined, options?: { force?: boolean }) => {
    if (!feature) return;
    if (selectedSubclass) {
      const subclassLike = { name: feature.name, text: feature.text ?? "", optional: true, subclass: null };
      if (!featureMatchesSubclass(subclassLike, selectedSubclass) || isSubclassChoiceFeature(subclassLike)) return;
    } else {
      const subclassLike = { name: feature.name, text: feature.text ?? "", optional: true, subclass: null };
      if (!featureMatchesSubclass(subclassLike, selectedSubclass) || isSubclassChoiceFeature(subclassLike)) return;
    }
    if (!options?.force && !shouldDisplayPlayerFeature(feature.name, feature.text ?? "")) return;
    const dedupeKey = `${String(feature.name ?? "").trim().toLowerCase()}::${String(feature.text ?? "").trim().replace(/\s+/g, " ").toLowerCase()}`;
    if (featureKeys.has(dedupeKey)) return;
    if (featureById.has(feature.id)) return;
    featureKeys.add(dedupeKey);
    featureById.set(feature.id, feature);
  };

  if (saved.length > 0) {
    for (const feature of saved) {
      addFeature({
        id: feature.id || feature.name,
        name: feature.name,
        text: feature.text ?? "",
      });
    }
  } else {
    for (const name of charData?.chosenOptionals ?? []) {
      addFeature({
        id: name,
        name,
        text: "",
      });
    }
  }

  for (const autolevel of classDetail?.autolevels ?? []) {
    if (autolevel.level > characterLevel) continue;
    for (const feature of autolevel.features ?? []) {
      if (!featureMatchesSubclass(feature, selectedSubclass) || isSubclassChoiceFeature(feature)) continue;
      const text = String(feature.text ?? "").trim();
      if (!text) continue;
      const name = String(feature.name ?? "").trim();
      if (!name) continue;
      if (!/\b(short|long) rest\b/i.test(text) && !/\b(regain|recover)\b/i.test(text)) continue;
      addFeature({
        id: `class:${classDetail?.id}:${name}`,
        name,
        text,
      });
    }
  }

  for (const trait of raceDetail?.traits ?? []) {
    const text = String(trait.text ?? "").trim();
    if (!text) continue;
    addFeature({
      id: `race:${raceDetail?.id}:${trait.name}`,
      name: trait.name,
      text,
    });
  }

  if (raceFeatDetail && String(raceFeatDetail.text ?? "").trim()) {
    addFeature({
      id: `race-feat:${raceFeatDetail.id}`,
      name: raceFeatDetail.name,
      text: String(raceFeatDetail.text ?? "").trim(),
    });
  }

  for (const trait of backgroundDetail?.traits ?? []) {
    const name = String(trait.name ?? "").trim();
    const text = String(trait.text ?? "").trim();
    if (!name || !text) continue;
    if (/^description$/i.test(name)) continue;
    if (/^ability scores?/i.test(name)) continue;
    if (/^starting equipment$/i.test(name)) continue;
    if (/^feat:/i.test(name)) continue;
    addFeature({
      id: `background:${backgroundDetail?.id}:${name}`,
      name,
      text,
    });
  }

  if (bgOriginFeatDetail && String(bgOriginFeatDetail.text ?? "").trim()) {
    addFeature({
      id: bgOriginFeatDetail.name,
      name: bgOriginFeatDetail.name,
      text: String(bgOriginFeatDetail.text ?? "").trim(),
    }, { force: true });
  }

  for (const entry of levelUpFeatDetails) {
    if (!String(entry.feat.text ?? "").trim()) continue;
    addFeature({
      id: `levelupfeat:${entry.level}:${entry.featId}`,
      name: entry.feat.name,
      text: String(entry.feat.text ?? "").trim(),
    }, { force: true });
  }

  for (const invocation of invocationDetails) {
    addFeature({
      id: `invocation:${invocation.id}`,
      name: String(invocation.name ?? "").replace(/^Invocation:\s*/i, "").trim(),
      text: invocation.text,
    }, { force: true });
  }

  return Array.from(featureById.values()).map((feature) => ({
      id: feature.id || feature.name,
      name: feature.name,
      text: feature.text ?? "",
  }));
}

function shouldDisplayPlayerFeature(name: string, text: string): boolean {
  const normalizedName = String(name ?? "").trim();
  const normalizedText = String(text ?? "").trim();
  const haystack = `${normalizedName} ${normalizedText}`;
  if (!normalizedName && !normalizedText) return false;

  if (
    /^(description|creature type|size|speed|tool proficiency|tool proficiencies|skill proficiency|skill proficiencies|languages?|starting equipment)$/i.test(normalizedName)
    || /^ability scores?/i.test(normalizedName)
    || /^feat:/i.test(normalizedName)
    || /^(level\s+\d+:\s+)?weapon mastery$/i.test(normalizedName)
  ) {
    return false;
  }

  if (
    /^(resourceful|darkvision|superior darkvision|trance|fey ancestry|brave|hellish resistance|necrotic resistance|fire resistance|cold resistance|lightning resistance|poison resilience|dwarven resilience|gnomish cunning|lucky|relentless endurance|powerful build|celestial revelation|draconic flight|arcane recovery)$/i.test(normalizedName)
  ) {
    return true;
  }

  if (
    /\b(darkvision|blindsight|tremorsense|truesight|short rest|long rest|regain|recover|heroic inspiration|advantage on saving throws|immune to the charmed|magic can't put you to sleep|resistance to|you have resistance to|damage resistance|can't be (?:put to sleep|surprised)|reroll|once per turn|once per combat|once per (?:short|long) rest)\b/i.test(haystack)
  ) {
    return true;
  }

  if (
    /^(high elf lineage|wood elf lineage|drow lineage|forest lineage|celestial lineage|draconic ancestry|creature type|size|tool proficiency|tool proficiencies|skill proficiency|skill proficiencies|instrument training|artisan'?s tools|weapon training|armor training)$/i.test(normalizedName)
  ) {
    return false;
  }

  if (
    /\b(creature type|you are a .*?(humanoid|celestial|fey|fiend|undead|construct|beast|dragon|elemental|giant|monstrosity|ooze|plant))\b/i.test(normalizedText)
    || /\b(you have proficiency|you gain proficiency|you gain training|you have training|you know the .* cantrip|you always have .* prepared|you can cast .* without a spell slot|you learn the .* cantrip|you gain one skill proficiency|you gain one tool proficiency)\b/i.test(normalizedText)
  ) {
    return false;
  }

  return /(?:advantage|disadvantage|resistance|immunity|vision|rest|recover|regain|heroic inspiration|sleep|charmed|frightened|poisoned|reroll|movement|speed|climb speed|swim speed|fly speed)/i.test(haystack);
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

// ---------------------------------------------------------------------------
// View
// ---------------------------------------------------------------------------

export function CharacterView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [char, setChar] = useState<Character | null>(null);
  const [classDetail, setClassDetail] = useState<ClassRestDetail | null>(null);
  const [raceDetail, setRaceDetail] = useState<RaceFeatureDetail | null>(null);
  const [backgroundDetail, setBackgroundDetail] = useState<BackgroundFeatureDetail | null>(null);
  const [bgOriginFeatDetail, setBgOriginFeatDetail] = useState<FeatFeatureDetail | null>(null);
  const [raceFeatDetail, setRaceFeatDetail] = useState<FeatFeatureDetail | null>(null);
  const [levelUpFeatDetails, setLevelUpFeatDetails] = useState<LevelUpFeatDetail[]>([]);
  const [invocationDetails, setInvocationDetails] = useState<InvocationFeatureDetail[]>([]);
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
  const [infoDrawerOpen, setInfoDrawerOpen] = useState(false);
  const [overridesDraft, setOverridesDraft] = useState<SheetOverrides>({ tempHp: 0, acBonus: 0, hpMaxBonus: 0 });
  const [overridesSaving, setOverridesSaving] = useState(false);
  const [concentrationAlert, setConcentrationAlert] = useState<{ dc: number } | null>(null);

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

  useEffect(() => {
    const raceId = char?.characterData?.raceId;
    if (!raceId) {
      setRaceDetail(null);
      return;
    }
    let alive = true;
    api<RaceFeatureDetail>(`/api/compendium/races/${raceId}`)
      .then((detail) => { if (alive) setRaceDetail(detail); })
      .catch(() => { if (alive) setRaceDetail(null); });
    return () => { alive = false; };
  }, [char?.characterData?.raceId]);

  useEffect(() => {
    const bgId = char?.characterData?.bgId;
    if (!bgId) {
      setBackgroundDetail(null);
      return;
    }
    let alive = true;
    api<BackgroundFeatureDetail>(`/api/compendium/backgrounds/${bgId}`)
      .then((detail) => { if (alive) setBackgroundDetail(detail); })
      .catch(() => { if (alive) setBackgroundDetail(null); });
    return () => { alive = false; };
  }, [char?.characterData?.bgId]);

  useEffect(() => {
    const featId = char?.characterData?.chosenRaceFeatId;
    if (!featId) {
      setRaceFeatDetail(null);
      return;
    }
    let alive = true;
    api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`)
      .then((detail) => { if (alive) setRaceFeatDetail(detail); })
      .catch(() => { if (alive) setRaceFeatDetail(null); });
    return () => { alive = false; };
  }, [char?.characterData?.chosenRaceFeatId]);

  useEffect(() => {
    const featId = char?.characterData?.chosenBgOriginFeatId;
    if (!featId) {
      setBgOriginFeatDetail(null);
      return;
    }
    let alive = true;
    api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`)
      .then((detail) => { if (alive) setBgOriginFeatDetail(detail); })
      .catch(() => { if (alive) setBgOriginFeatDetail(null); });
    return () => { alive = false; };
  }, [char?.characterData?.chosenBgOriginFeatId]);

  useEffect(() => {
    const entries = Array.isArray(char?.characterData?.chosenLevelUpFeats)
      ? char.characterData.chosenLevelUpFeats.filter((entry): entry is { level: number; featId: string } =>
          typeof entry?.level === "number" && typeof entry?.featId === "string" && entry.featId.trim().length > 0
        )
      : [];
    if (entries.length === 0) {
      setLevelUpFeatDetails([]);
      return;
    }
    let alive = true;
    Promise.all(
      entries.map(async ({ level, featId }) => {
        const detail = await api<FeatFeatureDetail>(`/api/compendium/feats/${encodeURIComponent(featId)}`);
        return { level, featId, feat: detail } satisfies LevelUpFeatDetail;
      })
    )
      .then((details) => {
        if (alive) setLevelUpFeatDetails(details);
      })
      .catch(() => {
        if (alive) setLevelUpFeatDetails([]);
      });
    return () => { alive = false; };
  }, [char?.characterData?.chosenLevelUpFeats]);

  useEffect(() => {
    const invocationIds = Array.isArray(char?.characterData?.chosenInvocations)
      ? char.characterData.chosenInvocations.filter((id): id is string => typeof id === "string" && id.trim().length > 0)
      : [];
    if (invocationIds.length === 0) {
      setInvocationDetails([]);
      return;
    }
    let alive = true;
    Promise.all(
      invocationIds.map(async (spellId) => {
        const detail = await api<any>(`/api/spells/${encodeURIComponent(spellId)}`);
        const text = Array.isArray(detail?.text)
          ? detail.text.map((entry: unknown) => String(entry ?? "").trim()).filter(Boolean).join("\n")
          : String(detail?.text ?? "").trim();
        return {
          id: spellId,
          name: String(detail?.name ?? spellId),
          text,
        } satisfies InvocationFeatureDetail;
      })
    )
      .then((details) => {
        if (alive) setInvocationDetails(details.filter((detail) => detail.text));
      })
      .catch(() => {
        if (alive) setInvocationDetails([]);
      });
    return () => { alive = false; };
  }, [char?.characterData?.chosenInvocations]);

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

  useEffect(() => {
    const source = char?.overrides ?? char?.characterData?.sheetOverrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
    setOverridesDraft({
      tempHp: Math.max(0, Math.floor(Number(source.tempHp ?? 0) || 0)),
      acBonus: Math.floor(Number(source.acBonus ?? 0) || 0),
      hpMaxBonus: Math.floor(Number(source.hpMaxBonus ?? 0) || 0),
    });
  }, [char?.overrides?.tempHp, char?.overrides?.acBonus, char?.overrides?.hpMaxBonus, char?.characterData?.sheetOverrides?.tempHp, char?.characterData?.sheetOverrides?.acBonus, char?.characterData?.sheetOverrides?.hpMaxBonus]);

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;

  const rawProf = char.characterData?.proficiencies;
  const prof = rawProf ? {
    ...rawProf,
    skills: dedupeTaggedItems(rawProf.skills),
    expertise: dedupeTaggedItems(rawProf.expertise),
    saves: dedupeTaggedItems(rawProf.saves),
    armor: dedupeTaggedItems(rawProf.armor, normalizeArmorProficiencyName),
    weapons: dedupeTaggedItems(rawProf.weapons, normalizeWeaponProficiencyName),
    tools: dedupeTaggedItems(rawProf.tools),
    languages: dedupeTaggedItems(rawProf.languages, normalizeLanguageName),
    masteries: dedupeTaggedItems(rawProf.masteries),
    spells: dedupeTaggedItems(rawProf.spells),
    invocations: dedupeTaggedItems(rawProf.invocations),
  } : undefined;
  const pb = proficiencyBonus(char.level);
  const hd = char.characterData?.hd ?? null;
  const hitDieSize = hd ?? classDetail?.hd ?? null;
  const hitDiceMax = Math.max(0, char.level);
  const hitDiceCurrent = Math.max(0, Math.min(hitDiceMax, Math.floor(Number(char.characterData?.hitDiceCurrent ?? hitDiceMax) || 0)));
  const scores: Record<AbilKey, number | null> = {
    str: char.strScore, dex: char.dexScore, con: char.conScore,
    int: char.intScore, wis: char.wisScore, cha: char.chaScore,
  };
  const classFeaturesList = normalizePlayerFeatures(
    char.characterData,
    char.level,
    classDetail,
    raceDetail,
    backgroundDetail,
    bgOriginFeatDetail,
    raceFeatDetail,
    levelUpFeatDetails,
    invocationDetails,
  );
  const parsedFeatureEffects = [
    ...classFeaturesList.map((feature, index) =>
      parseFeatureEffects({
        source: { id: `class-feature:${index}:${feature.id}`, kind: "class", name: feature.name, text: feature.text },
        text: feature.text,
      } satisfies ParseFeatureEffectsInput)
    ),
    ...(raceDetail?.traits ?? []).map((trait, index) =>
      parseFeatureEffects({
        source: { id: `race-trait:${index}:${trait.name}`, kind: "species", name: trait.name, text: trait.text },
        text: trait.text,
      } satisfies ParseFeatureEffectsInput)
    ),
    ...(backgroundDetail?.traits ?? []).map((trait, index) =>
      parseFeatureEffects({
        source: { id: `background-trait:${index}:${trait.name}`, kind: "background", name: trait.name, text: trait.text },
        text: trait.text,
      } satisfies ParseFeatureEffectsInput)
    ),
  ];
  const grantedSpellData = buildGrantedSpellDataFromEffects(parsedFeatureEffects, scores);
  const classResourcesWithSpellCasts = mergeResourceState(char.characterData?.resources, [
    ...collectClassResources(classDetail, char.level),
    ...grantedSpellData.resources,
  ]);
  const effectDefenses = collectDefensesFromEffects(parsedFeatureEffects);
  const effectSenses = collectSensesFromEffects(parsedFeatureEffects);
  const parsedDefenses = {
    resistances: effectDefenses.resistances,
    immunities: effectDefenses.immunities,
    vulnerabilities: [] as string[],
  };
  const preparedSpellLimit = classDetail ? getPreparedSpellCount(classDetail, char.level, char.characterData?.subclass ?? "") : 0;
  const preparedSpells = (() => {
    const saved = Array.isArray(char.characterData?.preparedSpells) ? char.characterData.preparedSpells : [];
    const unique = Array.from(new Set(saved));
    return preparedSpellLimit > 0 ? unique.slice(0, preparedSpellLimit) : unique;
  })();

  const accentColor = char.color ?? C.accentHl;
  const overrides: SheetOverrides = char.overrides ?? char.characterData?.sheetOverrides ?? { tempHp: 0, acBonus: 0, hpMaxBonus: 0 };
  const featureHpMaxBonus = deriveHitPointMaxBonusFromEffects(parsedFeatureEffects, { level: char.level, scores });
  const effectiveHpMax = Math.max(1, char.hpMax + featureHpMaxBonus + (overrides.hpMaxBonus ?? 0));
  const xpEarned = char.characterData?.xp ?? 0;
  const xpNeeded = XP_TO_LEVEL[char.level + 1] ?? 0;
  const inventory = char.characterData?.inventory ?? [];
  const wornShield = inventory.find((it) => getEquipState(it) === "offhand" && isShieldItem(it));
  const shieldBonus = wornShield ? 2 : 0;
  const wornArmor = inventory.find((it) => getEquipState(it) === "worn" && isArmorItem(it) && (it.ac ?? 0) > 0);
  const armorWithoutProficiency = Boolean(wornArmor && !hasArmorProficiency(wornArmor, prof ?? undefined));
  const shieldWithoutProficiency = Boolean(wornShield && !hasArmorProficiency(wornShield, prof ?? undefined));
  const nonProficientArmorPenalty = armorWithoutProficiency || shieldWithoutProficiency;
  const hasDisadvantage = (char.conditions ?? []).some((c) => c.key === "disadvantage");
  const stealthDisadvantage = Boolean((wornArmor && hasStealthDisadvantage(wornArmor)) || nonProficientArmorPenalty);
  const dexMod = abilityMod(char.dexScore);
  const conMod = abilityMod(char.conScore);
  const hasJackOfAllTrades = Boolean(
    classDetail?.autolevels
      ?.filter((autolevel) => autolevel.level <= char.level)
      .some((autolevel) => (autolevel.features ?? []).some((feature) => /jack of all trades/i.test(feature.name)))
  );
  const scoresByAbility: Record<AbilKey, number | null> = {
    str: char.strScore,
    dex: char.dexScore,
    con: char.conScore,
    int: char.intScore,
    wis: char.wisScore,
    cha: char.chaScore,
  };
  const wornArmorAc = (() => {
    if (!wornArmor || !wornArmor.ac) return null;
    const t = String(wornArmor.type ?? "").toLowerCase();
    if (t.includes("heavy")) return wornArmor.ac;
    if (t.includes("medium")) return wornArmor.ac + Math.min(2, dexMod);
    return wornArmor.ac + dexMod; // light armor
  })();
  const unarmoredDefenseAc = deriveUnarmoredDefenseFromEffects(parsedFeatureEffects, scoresByAbility, {
    armorEquipped: Boolean(wornArmor),
    shieldEquipped: Boolean(wornShield),
  });
  const featureAcBonus = deriveArmorClassBonusFromEffects(parsedFeatureEffects, {
    armorEquipped: Boolean(wornArmor),
    level: char.level,
    scores: scoresByAbility,
  });
  const effectiveAc = Math.max(char.ac, wornArmorAc ?? 0, unarmoredDefenseAc ?? 0) + featureAcBonus + (overrides.acBonus ?? 0) + shieldBonus;
  const speedBonus = deriveSpeedBonusFromEffects(parsedFeatureEffects, {
    armorState: wornArmor && /\bheavy armor\b/i.test(wornArmor.type ?? "") ? "any" : "not_heavy",
  });
  const effectiveSpeed = char.speed + speedBonus;
  const tempHp = overrides.tempHp ?? 0;
  const hpPct = effectiveHpMax > 0 ? Math.max(0, Math.min(1, char.hpCurrent / effectiveHpMax)) : 0;
  const tempPct = effectiveHpMax > 0 ? Math.min(1 - hpPct, tempHp / effectiveHpMax) : 0;
  const passiveScoreBonus = deriveModifierBonusFromEffects(parsedFeatureEffects, "passive_score", {
    level: char.level,
    scores: scoresByAbility,
  });
  const passivePerc = getPassiveScore(getSkillBonus("Perception", "wis", scoresByAbility, char.level, prof ?? undefined, { jackOfAllTrades: hasJackOfAllTrades })) + passiveScoreBonus;
  const passiveInv  = getPassiveScore(getSkillBonus("Investigation", "int", scoresByAbility, char.level, prof ?? undefined, { jackOfAllTrades: hasJackOfAllTrades })) + passiveScoreBonus;
  const initiativeBonus = getInitiativeBonus(char.dexScore, char.level, { jackOfAllTrades: hasJackOfAllTrades })
    + deriveModifierBonusFromEffects(parsedFeatureEffects, "initiative", { level: char.level, scores: scoresByAbility });
  const senses = effectSenses.map((sense) => `${sense.kind[0].toUpperCase()}${sense.kind.slice(1)} ${sense.range} ft.`);
  const editableOverrideFields: EditableSheetOverrideField[] = [
    { key: "tempHp", label: "Temp HP", help: "Current temporary hit points." },
    { key: "acBonus", label: "AC Bonus", help: "Bonus applied on top of normal armor class." },
    { key: "hpMaxBonus", label: "Max HP Modifier", help: "Bonus or penalty to maximum hit points." },
  ];
  const identityFields = [
    ["Alignment", char.characterData?.alignment],
    ["Gender", char.characterData?.gender],
    ["Age", char.characterData?.age],
    ["Height", char.characterData?.height],
    ["Weight", char.characterData?.weight],
    ["Hair", char.characterData?.hair],
    ["Skin", char.characterData?.skin],
  ].filter((entry): entry is [string, string] => typeof entry[1] === "string" && entry[1].trim().length > 0);
  const currentCharacterData: CharacterData = char.characterData ?? {};

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
      if (kind === "damage" && amt > 0 && (char.conditions ?? []).some((c) => c.key === "concentration")) {
        setConcentrationAlert({ dc: Math.max(10, Math.floor(amt / 2)) });
      }
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
    const updated: CharacterData = { ...currentCharacterData, xp: value };
    await saveCharacterData(updated);
    setXpPopupOpen(false);
  }

  async function saveHitDiceCurrent(nextValue: number) {
    const next = Math.max(0, Math.min(hitDiceMax, Math.floor(nextValue)));
    await saveCharacterData({ ...currentCharacterData, hitDiceCurrent: next });
  }

  async function saveResources(nextResources: ResourceCounter[]) {
    await saveCharacterData({ ...currentCharacterData, resources: nextResources });
  }

  async function saveUsedSpellSlots(next: Record<string, number>) {
    await saveCharacterData({ ...currentCharacterData, usedSpellSlots: next });
  }

  async function savePreparedSpells(next: string[]) {
    const unique = Array.from(new Set(next));
    const limited = preparedSpellLimit > 0 ? unique.slice(0, preparedSpellLimit) : unique;
    await saveCharacterData({ ...currentCharacterData, preparedSpells: limited });
  }

  async function handleItemChargeChange(itemId: string, charges: number) {
    const nextInventory = inventory.map((it) => it.id === itemId ? { ...it, charges } : it);
    await saveCharacterData({ ...currentCharacterData, inventory: nextInventory });
  }

  async function changeResourceCurrent(key: string, delta: number) {
    const nextResources = classResourcesWithSpellCasts.map((resource) =>
      resource.key !== key
        ? resource
        : { ...resource, current: Math.max(0, Math.min(resource.max, resource.current + delta)) }
    );
    await saveResources(nextResources);
  }

  async function handleShortRest() {
    const nextResources = classResourcesWithSpellCasts.map((resource) =>
      shouldResetOnRest(resource.reset, "short")
        ? { ...resource, current: resource.max }
        : resource
    );
    // Warlocks reset spell slots on short rest
    const slotsReset = classDetail?.slotsReset ?? "L";
    if (/S/i.test(slotsReset)) {
      await saveCharacterData({ ...currentCharacterData, resources: nextResources, usedSpellSlots: {} });
    } else {
      await saveResources(nextResources);
    }
  }

  async function handleLongRest() {
    if (!char) return;
    const nextResources = classResourcesWithSpellCasts.map((resource) =>
      shouldResetOnRest(resource.reset, "long")
        ? { ...resource, current: resource.max }
        : resource
    );
    const recoveredHitDice = hitDiceMax > 0 ? Math.max(1, Math.floor(hitDiceMax / 2)) : 0;
    const nextHitDice = Math.max(0, Math.min(hitDiceMax, hitDiceCurrent + recoveredHitDice));
    // Reset spell slots on long rest (unless Warlock which uses short rest — checked via slotsReset)
    const slotsReset = classDetail?.slotsReset ?? "L";
    const nextUsedSpellSlots = /S/i.test(slotsReset) ? (char.characterData?.usedSpellSlots ?? {}) : {};
    // Reset item charges on long rest
    const nextInventory = inventory.map((it) =>
      (it.chargesMax ?? 0) > 0 ? { ...it, charges: it.chargesMax } : it
    );

    await api(`/api/me/characters/${char.id}`, jsonInit("PUT", {
      hpCurrent: effectiveHpMax,
      characterData: {
        ...currentCharacterData,
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
      },
    }));

    const nextDeathSaves = { success: 0, fail: 0 };
    await api(`/api/me/characters/${char.id}/deathSaves`, jsonInit("PATCH", nextDeathSaves));

    const hasResourceful = raceDetail?.traits?.some((t) => /^resourceful$/i.test(t.name)) ?? false;
    if (hasResourceful && !(overrides.inspiration ?? false)) {
      await api(`/api/me/characters/${char.id}/inspiration`, jsonInit("PATCH", { inspiration: true }));
    }

    setChar((prev) => prev ? {
      ...prev,
      hpCurrent: effectiveHpMax,
      deathSaves: nextDeathSaves,
      overrides: hasResourceful ? { ...prev.overrides!, inspiration: true } : prev.overrides,
      characterData: {
        ...prev.characterData,
        hitDiceCurrent: nextHitDice,
        resources: nextResources,
        usedSpellSlots: nextUsedSpellSlots,
        inventory: nextInventory,
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
    setChar((prev) => prev ? { ...prev, characterData: { ...(prev.characterData ?? {}), ...updatedData } } : prev);
    return updated;
  }

  async function saveSheetOverrides() {
    if (!char) return;
    const nextOverrides = {
      tempHp: Math.max(0, Math.floor(Number(overridesDraft.tempHp) || 0)),
      acBonus: Math.floor(Number(overridesDraft.acBonus) || 0),
      hpMaxBonus: Math.floor(Number(overridesDraft.hpMaxBonus) || 0),
    };
    setOverridesSaving(true);
    try {
      await api(`/api/me/characters/${char.id}/overrides`, jsonInit("PATCH", nextOverrides));
      setChar((prev) => prev ? {
        ...prev,
        overrides: { ...(prev.overrides ?? {}), ...nextOverrides },
        characterData: {
          ...(prev.characterData ?? {}),
          sheetOverrides: nextOverrides,
        },
      } : prev);
      setInfoDrawerOpen(false);
    } finally {
      setOverridesSaving(false);
    }
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

  async function saveCustomResistances(values: string[]) {
    await saveCharacterData({ customResistances: values });
  }

  async function saveCustomImmunities(values: string[]) {
    await saveCharacterData({ customImmunities: values });
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
      {concentrationAlert && (
        <div style={{
          marginBottom: 10, padding: "10px 14px", borderRadius: 10,
          background: "rgba(240, 165, 0, 0.15)", border: `1px solid ${C.accent}`,
          display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12,
        }}>
          <span style={{ color: C.text, fontWeight: 700 }}>
            ⚠️ You are Concentrating — CON Save DC <strong>{concentrationAlert.dc}</strong>
          </span>
          <button
            onClick={() => setConcentrationAlert(null)}
            style={{ all: "unset", cursor: "pointer", color: C.muted, fontWeight: 900, fontSize: 18, lineHeight: 1 }}
          >
            ×
          </button>
        </div>
      )}
      {/* ── 4-column layout ──────────────────────────────────────────── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 16, alignItems: "flex-start" }}>

        {/* ── COL 1: HUD + Abilities & Saves + Skills + Proficiencies ── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <CharacterHudPanel
          char={char}
          accentColor={accentColor}
          xpEarned={xpEarned}
          xpNeeded={xpNeeded}
          xpInput={xpInput}
          xpPopupOpen={xpPopupOpen}
          setXpInput={setXpInput}
          setXpPopupOpen={setXpPopupOpen}
          saveXp={saveXp}
          onOpenInfo={() => setInfoDrawerOpen(true)}
          onLevelUp={() => navigate(`/characters/${char.id}/levelup`)}
          onEdit={() => navigate(`/characters/${char.id}/edit`)}
          effectiveHpMax={effectiveHpMax}
          tempHp={tempHp}
          hpPct={hpPct}
          tempPct={tempPct}
          hpError={hpError}
          hpSaving={hpSaving}
          hpAmount={hpAmount}
          hd={hd}
          lastRoll={lastRoll}
          hpInputRef={hpInputRef}
          setHpError={setHpError}
          setLastRoll={setLastRoll}
          setHpAmount={setHpAmount}
          handleApplyHp={handleApplyHp}
          inspirationActive={overrides.inspiration ?? false}
          handleToggleInspiration={handleToggleInspiration}
          condPickerOpen={condPickerOpen}
          setCondPickerOpen={setCondPickerOpen}
          condSaving={condSaving}
          toggleCondition={toggleCondition}
          dsSaving={dsSaving}
          saveDeathSaves={saveDeathSaves}
          hpMaxBonus={overrides.hpMaxBonus ?? 0}
        />

          <CharacterAbilitiesPanels
            scores={scores}
            pb={pb}
            prof={prof}
            accentColor={accentColor}
            stealthDisadvantage={stealthDisadvantage}
            nonProficientArmorPenalty={nonProficientArmorPenalty}
            hasJackOfAllTrades={hasJackOfAllTrades}
            mod={abilityMod}
            fmtMod={formatModifier}
          />
          <CharacterDefensesPanel
            resistances={parsedDefenses.resistances}
            immunities={parsedDefenses.immunities}
            senses={senses}
            customResistances={char.characterData?.customResistances ?? []}
            customImmunities={char.characterData?.customImmunities ?? []}
            accentColor={accentColor}
            onCustomResistancesChange={(v) => { void saveCustomResistances(v); }}
            onCustomImmunitiesChange={(v) => { void saveCustomImmunities(v); }}
          />
          <CharacterProficienciesPanel prof={prof} accentColor={accentColor} />

        </div>
        {/* end COL 1 */}

        {/* ── COL 2: Actions + Spells & Invocations ────────────────────── */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>

          <CharacterCombatPanels
            effectiveAc={effectiveAc}
            speed={effectiveSpeed}
            level={char.level}
            className={char.className}
            initiativeBonus={initiativeBonus}
            strScore={char.strScore}
            dexScore={char.dexScore}
            pb={pb}
            passivePerc={passivePerc}
            passiveInv={passiveInv}
            accentColor={accentColor}
            inventory={inventory}
            prof={prof}
            characterData={char.characterData}
            nonProficientArmorPenalty={nonProficientArmorPenalty}
            hasDisadvantage={hasDisadvantage}
          />
          <ItemSpellsPanel
            items={inventory}
            pb={pb}
            intScore={char.intScore}
            wisScore={char.wisScore}
            chaScore={char.chaScore}
            accentColor={accentColor}
            onChargeChange={handleItemChargeChange}
            spellcastingBlocked={nonProficientArmorPenalty}
          />
          {/* Known / Prepared spells — rich table with inline slots */}
          {((prof?.spells.length ?? 0) > 0 || grantedSpellData.spells.length > 0) && (
            <RichSpellsPanel
              spells={prof?.spells ?? []}
              grantedSpells={grantedSpellData.spells}
              resources={classResourcesWithSpellCasts}
              pb={pb}
              intScore={char.intScore}
              wisScore={char.wisScore}
              chaScore={char.chaScore}
              accentColor={accentColor}
              classDetail={classDetail}
              charLevel={char.level}
              preparedLimit={preparedSpellLimit}
              usedSpellSlots={char.characterData?.usedSpellSlots ?? {}}
              preparedSpells={preparedSpells}
              onSlotsChange={saveUsedSpellSlots}
              onPreparedChange={savePreparedSpells}
              onResourceChange={changeResourceCurrent}
              spellcastingBlocked={nonProficientArmorPenalty}
            />
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
        {/* COL 4 */}
        <CharacterSupportPanels
          accentColor={accentColor}
          hasCampaign={char.campaigns.length > 0}
          hitDiceCurrent={hitDiceCurrent}
          hitDiceMax={hitDiceMax}
          hitDieSize={hitDieSize}
          hitDieConMod={conMod}
          classResources={classResourcesWithSpellCasts}
          playerNotesList={playerNotesList}
          allSharedNotes={allSharedNotes}
          classFeaturesList={classFeaturesList}
          expandedNoteIds={expandedNoteIds}
          expandedClassFeatureIds={expandedClassFeatureIds}
          onSaveHitDiceCurrent={(value) => saveHitDiceCurrent(value)}
          onShortRest={() => handleShortRest()}
          onLongRest={() => handleLongRest()}
          onChangeResourceCurrent={(key, delta) => changeResourceCurrent(key, delta)}
          onOpenPlayerNoteCreate={() => setNoteDrawer({ scope: "player", note: null })}
          onOpenSharedNoteCreate={() => setNoteDrawer({ scope: "shared", note: null })}
          onToggleNoteExpanded={toggleNoteExpanded}
          onToggleClassFeatureExpanded={toggleClassFeatureExpanded}
          onOpenPlayerNoteEdit={(note) => setNoteDrawer({ scope: "player", note })}
          onOpenSharedNoteEdit={(note) => setNoteDrawer({ scope: "shared", note })}
          onDeletePlayerNote={(id) => handleNoteDelete("player", id)}
          onDeleteSharedNote={(id) => handleNoteDelete("shared", id)}
          onSavePlayerNotesOrder={(list) => { void savePlayerNotesList(list); }}
          onSaveSharedNotesOrder={saveSharedNotesList}
          onSaveClassFeaturesOrder={(list) => { void saveClassFeaturesList(list); }}
        />
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
      {infoDrawerOpen && (
        <>
          <div
            onClick={() => setInfoDrawerOpen(false)}
            style={{
              position: "fixed",
              inset: 0,
              background: "rgba(7,10,18,0.55)",
              zIndex: 70,
            }}
          />
          <div
            style={{
              position: "fixed",
              top: 0,
              right: 0,
              width: "min(560px, 92vw)",
              height: "100vh",
              background: "#11182a",
              borderLeft: "1px solid rgba(255,255,255,0.08)",
              boxShadow: "-16px 0 40px rgba(0,0,0,0.45)",
              zIndex: 71,
              display: "flex",
              flexDirection: "column",
            }}
          >
            <div style={{ padding: "20px 24px", borderBottom: "1px solid rgba(255,255,255,0.08)", display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12 }}>
              <div>
                <div style={{ fontSize: 24, fontWeight: 900, color: C.text, marginBottom: 4 }}>Character Information</div>
                <div style={{ fontSize: 13, color: C.muted }}>Identity details and sheet overrides.</div>
              </div>
              <button
                onClick={() => setInfoDrawerOpen(false)}
                style={{
                  padding: "9px 16px",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: C.text,
                  fontWeight: 700,
                }}
              >
                Close
              </button>
            </div>

            <div style={{ flex: 1, overflowY: "auto", padding: 24, display: "flex", flexDirection: "column", gap: 24 }}>
              <div>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor, marginBottom: 12 }}>Identity</div>
                {identityFields.length > 0 ? (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(2, minmax(0, 1fr))", gap: 12 }}>
                    {identityFields.map(([label, value]) => (
                      <div key={label} style={{ padding: "12px 14px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
                        <div style={{ fontSize: 11, color: C.muted, marginBottom: 6, textTransform: "uppercase", letterSpacing: "0.08em" }}>{label}</div>
                        <div style={{ fontSize: 18, fontWeight: 700, color: C.text }}>{value}</div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div style={{ padding: "14px 16px", borderRadius: 14, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", color: C.muted }}>
                    No character information filled in yet.
                  </div>
                )}
              </div>

              <div>
                <div style={{ fontSize: 12, fontWeight: 900, letterSpacing: "0.12em", textTransform: "uppercase", color: accentColor, marginBottom: 12 }}>Overrides</div>
                <div style={{ display: "grid", gridTemplateColumns: "repeat(3, minmax(0, 1fr))", gap: 12 }}>
                  {editableOverrideFields.map((field) => (
                    <label key={field.key} style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                      <span style={{ fontSize: 11, color: C.muted, textTransform: "uppercase", letterSpacing: "0.08em" }}>{field.label}</span>
                      <input
                        type="number"
                        value={overridesDraft[field.key]}
                        onChange={(e) => {
                          const value = e.target.value;
                          setOverridesDraft((prev) => ({
                            ...prev,
                            [field.key]: value === "" || value === "-" ? 0 : Number(value),
                          }));
                        }}
                        style={{
                          padding: "12px 14px",
                          borderRadius: 12,
                          border: "1px solid rgba(255,255,255,0.12)",
                          background: "rgba(255,255,255,0.05)",
                          color: C.text,
                          fontSize: 16,
                          fontWeight: 700,
                          outline: "none",
                        }}
                      />
                      <span style={{ fontSize: 11, color: "rgba(160,180,220,0.6)" }}>{field.help}</span>
                    </label>
                  ))}
                </div>
              </div>
            </div>

            <div style={{ padding: 24, borderTop: "1px solid rgba(255,255,255,0.08)", display: "flex", justifyContent: "flex-end", gap: 12 }}>
              <button
                onClick={() => setInfoDrawerOpen(false)}
                style={{
                  padding: "11px 18px",
                  borderRadius: 12,
                  cursor: "pointer",
                  background: "rgba(255,255,255,0.04)",
                  border: "1px solid rgba(255,255,255,0.12)",
                  color: C.text,
                  fontWeight: 700,
                }}
              >
                Cancel
              </button>
              <button
                onClick={() => void saveSheetOverrides()}
                disabled={overridesSaving}
                style={{
                  padding: "11px 18px",
                  borderRadius: 12,
                  cursor: overridesSaving ? "default" : "pointer",
                  background: accentColor,
                  border: "none",
                  color: "#fff",
                  fontWeight: 800,
                  opacity: overridesSaving ? 0.7 : 1,
                }}
              >
                {overridesSaving ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </>
      )}
    </Wrap>
  );
}

// ---------------------------------------------------------------------------
// Inventory Panel
// ---------------------------------------------------------------------------


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
