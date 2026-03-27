import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import { featPrerequisitesMet, invocationPrerequisitesMet, spellLooksLikeDamageSpell } from "@/views/character/CharacterSheetUtils";
import { collectFeatTaggedEntries } from "@/views/character-creator/utils/FeatGrantUtils";

export interface LevelUpTaggedEntry {
  name: string;
  source: string;
}

export interface LevelUpFeature {
  name: string;
  text?: string;
}

export interface LevelUpFeatChoiceLike {
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

export interface LevelUpFeatDetailLike {
  id: string;
  name: string;
  text?: string | null;
  parsed: {
    grants: {
      skills: string[];
      tools: string[];
      languages: string[];
      armor: string[];
      weapons: string[];
      savingThrows: string[];
      spells: string[];
      cantrips: string[];
      abilityIncreases?: Record<string, number>;
    };
    choices?: LevelUpFeatChoiceLike[];
  };
}

export interface BuildLevelUpPayloadArgs {
  char: {
    hpMax: number;
    hpCurrent: number;
    className: string;
    characterData?: {
      subclass?: string | null;
      chosenLevelUpFeats?: Array<{ level: number; featId: string }>;
      chosenCantrips?: string[];
      chosenSpells?: string[];
      chosenInvocations?: string[];
      chosenFeatOptions?: Record<string, string[]>;
      classFeatures?: Array<{ id?: string; name: string; text?: string }>;
      proficiencies?: {
        spells?: LevelUpTaggedEntry[];
        invocations?: LevelUpTaggedEntry[];
        expertise?: LevelUpTaggedEntry[];
        skills?: LevelUpTaggedEntry[];
        tools?: LevelUpTaggedEntry[];
        languages?: LevelUpTaggedEntry[];
        armor?: LevelUpTaggedEntry[];
        weapons?: LevelUpTaggedEntry[];
        saves?: LevelUpTaggedEntry[];
        masteries?: LevelUpTaggedEntry[];
        [k: string]: unknown;
      };
      [k: string]: unknown;
    } | null;
  };
  nextLevel: number;
  hpGain: number;
  featHpBonus: number;
  subclass: string;
  chosenCantrips: string[];
  chosenSpells: string[];
  chosenInvocations: string[];
  chosenExpertise: Record<string, string[]>;
  chosenFeatOptions: Record<string, string[]>;
  expertiseChoices: Array<{ key: string; source: string }>;
  featChoiceEntries: LevelUpFeatChoiceLike[];
  chosenFeatDetail: LevelUpFeatDetailLike | null;
  featSourceLabel: string;
  newFeatures: LevelUpFeature[];
  classDetailName?: string | null;
  selectedCantripEntries: LevelUpTaggedEntry[];
  selectedSpellEntries: LevelUpTaggedEntry[];
  selectedInvocationEntries: LevelUpTaggedEntry[];
  baseScores: Record<string, number>;
  asiMode: "+2" | "+1+1" | "feat" | null;
  asiStats: Record<string, number>;
  featAbilityBonuses: Record<string, number>;
}

export interface LevelUpSpellLike {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
}

export interface LevelUpFeatSummaryLike {
  id: string;
  name: string;
}

export type LevelUpFeatPrereqProfLike = ProficiencyMap;

export interface DeriveAllowedInvocationIdsArgs {
  classCantrips: LevelUpSpellLike[];
  classInvocations: LevelUpSpellLike[];
  chosenCantrips: string[];
  chosenInvocations: string[];
  nextLevel: number;
}

export interface DeriveFeatAbilityBonusesArgs {
  chosenFeatDetail: {
    id: string;
    parsed: {
      grants: {
        abilityIncreases: Record<string, number>;
      };
    };
  } | null;
  chosenFeatOptions: Record<string, string[]>;
  featChoiceEntries: LevelUpFeatChoiceLike[];
  nextLevel: number;
}

export interface DerivePreviewScoresArgs {
  baseScores: Record<string, number>;
  asiStats: Record<string, number>;
  asiMode: "+2" | "+1+1" | "feat" | null;
  featAbilityBonuses: Record<string, number>;
}

export interface DeriveLevelUpValidationArgs {
  isAsiLevel: boolean;
  asiMode: "+2" | "+1+1" | "feat" | null;
  asiStats: Record<string, number>;
  needsSubclassChoice: boolean;
  subclass: string;
  cantripCount: number;
  chosenCantrips: string[];
  spellcaster: boolean;
  prepCount: number;
  chosenSpells: string[];
  invocCount: number;
  chosenInvocations: string[];
  expertiseChoices: Array<{ key: string; count: number }>;
  chosenExpertise: Record<string, string[]>;
  chosenFeatDetail: {
    id: string;
    name: string;
    text?: string | null;
    parsed?: {
      repeatable?: boolean;
    };
  } | null;
  featChoiceEntries: LevelUpFeatChoiceLike[];
  chosenFeatOptions: Record<string, string[]>;
  nextLevel: number;
  className?: string | null;
  level: number;
  scores: Record<string, number>;
  prof?: LevelUpFeatPrereqProfLike;
  featSearch: string;
  featSummaries: LevelUpFeatSummaryLike[];
  hpGain: number | null;
  existingLevelUpFeats?: Array<{ level: number; featId: string }>;
}

export function deriveAllowedInvocationIds(args: DeriveAllowedInvocationIdsArgs): Set<string> {
  const { classCantrips, classInvocations, chosenCantrips, chosenInvocations, nextLevel } = args;
  const chosenCantripNames = classCantrips
    .filter((spell) => chosenCantrips.includes(spell.id))
    .map((spell) => spell.name);
  const chosenDamageCantripNames = classCantrips
    .filter((spell) => chosenCantrips.includes(spell.id) && spellLooksLikeDamageSpell(spell))
    .map((spell) => spell.name);
  const chosenInvocationNames = classInvocations
    .filter((invocation) => chosenInvocations.includes(invocation.id))
    .map((invocation) => invocation.name);

  return new Set(
    classInvocations
      .filter((invocation) =>
        invocationPrerequisitesMet(invocation.text ?? "", {
          level: nextLevel,
          chosenCantripNames,
          chosenDamageCantripNames,
          chosenInvocationNames,
        })
      )
      .map((invocation) => invocation.id)
  );
}

export function deriveFeatAbilityBonuses(args: DeriveFeatAbilityBonusesArgs): Record<string, number> {
  const { chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel } = args;
  const bonusMap: Record<string, number> = {};
  if (!chosenFeatDetail) return bonusMap;

  for (const [key, value] of Object.entries(chosenFeatDetail.parsed.grants.abilityIncreases ?? {})) {
    const abilityKey = key.toLowerCase().slice(0, 3);
    bonusMap[abilityKey] = (bonusMap[abilityKey] ?? 0) + value;
  }
  for (const choice of featChoiceEntries) {
    if (choice.type !== "ability_score") continue;
    const key = `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`;
    for (const selected of chosenFeatOptions[key] ?? []) {
      const abilityKey = selected.toLowerCase().slice(0, 3);
      bonusMap[abilityKey] = (bonusMap[abilityKey] ?? 0) + (choice.amount ?? 1);
    }
  }

  return bonusMap;
}

export function derivePreviewScores(args: DerivePreviewScoresArgs): Record<string, number> {
  const { baseScores, asiStats, asiMode, featAbilityBonuses } = args;
  const previewScores = { ...baseScores };

  for (const [key, value] of Object.entries(asiStats)) {
    previewScores[key] = Math.min(20, (previewScores[key] ?? 10) + value);
  }
  if (asiMode === "feat") {
    for (const [key, value] of Object.entries(featAbilityBonuses)) {
      previewScores[key] = Math.min(20, (previewScores[key] ?? 10) + value);
    }
  }

  return previewScores;
}

export function deriveHpGain(hpChoice: "roll" | "average" | "manual" | null, hpAverage: number, rolledHp: number | null, manualHp: string): number | null {
  if (hpChoice === "average") return hpAverage;
  if (hpChoice === "roll") return rolledHp ?? null;
  if (hpChoice === "manual") {
    const value = parseInt(manualHp, 10);
    return Number.isFinite(value) && value > 0 ? value : null;
  }
  return null;
}

export function deriveLevelUpValidation(args: DeriveLevelUpValidationArgs) {
  const {
    isAsiLevel, asiMode, asiStats, needsSubclassChoice, subclass, cantripCount, chosenCantrips, spellcaster,
    prepCount, chosenSpells, invocCount, chosenInvocations, expertiseChoices, chosenExpertise, chosenFeatDetail,
    featChoiceEntries, chosenFeatOptions, nextLevel, className, level, scores, prof, featSearch, featSummaries, hpGain, existingLevelUpFeats,
  } = args;

  const availableFeatSummaries = featSummaries.filter(
    (feat) => !/^origin:/i.test(feat.name) && (nextLevel >= 19 || !/^boon of\b/i.test(feat.name))
  );
  const needle = featSearch.trim().toLowerCase();
  const filteredFeatSummaries = !needle
    ? availableFeatSummaries
    : availableFeatSummaries.filter((feat) => feat.name.toLowerCase().includes(needle));

  const featPrereqsMet = chosenFeatDetail
    ? featPrerequisitesMet(chosenFeatDetail.text, {
        level,
        className,
        scores,
        prof,
        spellcaster,
      })
    : false;
  const featRepeatableValid = !chosenFeatDetail
    || chosenFeatDetail.parsed?.repeatable
    || !(existingLevelUpFeats ?? []).some((entry) => entry.featId === chosenFeatDetail.id);

  const asiTotal = Object.values(asiStats).reduce((sum, value) => sum + value, 0);
  const asiValid =
    !isAsiLevel ||
    asiMode === "feat" ||
    (asiMode === "+2" && asiTotal === 2) ||
    (asiMode === "+1+1" && asiTotal === 2 && Object.values(asiStats).every((value) => value <= 1));
  const subclassValid = !needsSubclassChoice || Boolean(subclass.trim());
  const cantripsValid = cantripCount === 0 || chosenCantrips.length === cantripCount;
  const spellsValid = !spellcaster || prepCount === 0 || chosenSpells.length === prepCount;
  const invocationsValid = invocCount === 0 || chosenInvocations.length === invocCount;
  const expertiseValid = expertiseChoices.every((choice) => (chosenExpertise[choice.key] ?? []).length === choice.count);
  const featValid =
    asiMode !== "feat" ||
    (
      Boolean(chosenFeatDetail) &&
      featPrereqsMet &&
      featRepeatableValid &&
      featChoiceEntries.every((choice) => {
        if (!chosenFeatDetail) return false;
        return (chosenFeatOptions[`levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`] ?? []).length === choice.count;
      })
    );
  const canConfirm =
    hpGain !== null &&
    asiValid &&
    subclassValid &&
    cantripsValid &&
    spellsValid &&
    invocationsValid &&
    expertiseValid &&
    featValid;

  return {
    availableFeatSummaries,
    filteredFeatSummaries,
    featPrereqsMet,
    featRepeatableValid,
    asiTotal,
    asiValid,
    subclassValid,
    cantripsValid,
    spellsValid,
    invocationsValid,
    expertiseValid,
    featValid,
    canConfirm,
  };
}

export function buildLevelUpPayload(args: BuildLevelUpPayloadArgs): Record<string, unknown> {
  const {
    char, nextLevel, hpGain, featHpBonus, subclass, chosenCantrips, chosenSpells, chosenInvocations,
    chosenExpertise, chosenFeatOptions, expertiseChoices, featChoiceEntries, chosenFeatDetail, featSourceLabel,
    newFeatures, classDetailName, selectedCantripEntries, selectedSpellEntries, selectedInvocationEntries,
    baseScores, asiMode, asiStats, featAbilityBonuses,
  } = args;

  const newHpMax = char.hpMax + hpGain + featHpBonus;
  const proficiencies = { ...(char.characterData?.proficiencies ?? {}) } as NonNullable<NonNullable<typeof char.characterData>["proficiencies"]>;
  const existingSpells = Array.isArray(proficiencies?.spells) ? proficiencies.spells : [];
  const existingInvocations = Array.isArray(proficiencies?.invocations) ? proficiencies.invocations : [];
  const existingExpertiseEntries = Array.isArray(proficiencies?.expertise) ? proficiencies.expertise : [];
  const existingSkillEntries = Array.isArray(proficiencies?.skills) ? proficiencies.skills : [];
  const existingToolEntries = Array.isArray(proficiencies?.tools) ? proficiencies.tools : [];
  const existingLanguageEntries = Array.isArray(proficiencies?.languages) ? proficiencies.languages : [];
  const existingArmorEntries = Array.isArray(proficiencies?.armor) ? proficiencies.armor : [];
  const existingWeaponEntries = Array.isArray(proficiencies?.weapons) ? proficiencies.weapons : [];
  const existingSaveEntries = Array.isArray(proficiencies?.saves) ? proficiencies.saves : [];
  const existingMasteryEntries = Array.isArray(proficiencies?.masteries) ? proficiencies.masteries : [];
  const classSource = classDetailName ?? char.className;
  const selectedExpertiseEntries = expertiseChoices.flatMap((choice) =>
    (chosenExpertise[choice.key] ?? []).map((name) => ({ name, source: choice.source }))
  );

  const selectedFeatEntries = chosenFeatDetail
    ? collectFeatTaggedEntries({
        feat: chosenFeatDetail,
        sourceLabel: featSourceLabel,
        selectedChoices: chosenFeatOptions,
        getChoiceKey: (choice) => `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`,
      })
    : null;

  const nextChosenFeatOptions = {
    ...((char.characterData?.chosenFeatOptions ?? {}) as Record<string, string[]>),
    ...chosenExpertise,
    ...chosenFeatOptions,
  };
  const existingLevelUpFeats = Array.isArray(char.characterData?.chosenLevelUpFeats) ? char.characterData?.chosenLevelUpFeats : [];
  const nextLevelUpFeats = chosenFeatDetail
    ? [...existingLevelUpFeats, { level: nextLevel, featId: chosenFeatDetail.id }]
    : existingLevelUpFeats;
  const existingFeatures = Array.isArray(char.characterData?.classFeatures) ? char.characterData.classFeatures : [];
  const featureMap = new Map(existingFeatures.map((feature) => [feature.id || feature.name, feature]));
  for (const feature of newFeatures) {
    if (!featureMap.has(feature.name)) {
      featureMap.set(feature.name, { id: feature.name, name: feature.name, text: feature.text ?? "" });
    }
  }
  if (chosenFeatDetail) {
    featureMap.set(`levelupfeat:${nextLevel}:${chosenFeatDetail.id}`, {
      id: `levelupfeat:${nextLevel}:${chosenFeatDetail.id}`,
      name: chosenFeatDetail.name,
      text: chosenFeatDetail.text ?? "",
    });
  }

  const nextCharacterData = {
    ...(char.characterData ?? {}),
    subclass: subclass || null,
    chosenLevelUpFeats: nextLevelUpFeats,
    chosenCantrips,
    chosenSpells,
    chosenInvocations,
    chosenFeatOptions: nextChosenFeatOptions,
    classFeatures: Array.from(featureMap.values()),
    proficiencies: {
      ...(proficiencies ?? {}),
      skills: [
        ...existingSkillEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.skills ?? []),
      ],
      tools: [
        ...existingToolEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.tools ?? []),
      ],
      languages: [
        ...existingLanguageEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.languages ?? []),
      ],
      armor: [
        ...existingArmorEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.armor ?? []),
      ],
      weapons: [
        ...existingWeaponEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.weapons ?? []),
      ],
      saves: [
        ...existingSaveEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.saves ?? []),
      ],
      masteries: [
        ...existingMasteryEntries.filter((entry) => entry.source !== featSourceLabel),
        ...(selectedFeatEntries?.masteries ?? []),
      ],
      spells: [
        ...existingSpells.filter((entry) => entry.source !== classSource && entry.source !== featSourceLabel),
        ...selectedCantripEntries,
        ...selectedSpellEntries,
        ...(selectedFeatEntries?.spells ?? []),
      ],
      invocations: [
        ...existingInvocations.filter((entry) => entry.source !== classSource),
        ...selectedInvocationEntries,
      ],
      expertise: [
        ...existingExpertiseEntries.filter((entry) => !expertiseChoices.some((choice) => choice.source === entry.source) && entry.source !== featSourceLabel),
        ...selectedExpertiseEntries,
        ...(selectedFeatEntries?.expertise ?? []),
      ],
    },
  };

  const payload: Record<string, unknown> = {
    level: nextLevel,
    hpMax: newHpMax,
    hpCurrent: char.hpCurrent + hpGain + featHpBonus,
    characterData: nextCharacterData,
  };

  if (asiMode === "+2" || asiMode === "+1+1") {
    for (const [k, v] of Object.entries(asiStats)) {
      const scoreKey = `${k}Score`;
      payload[scoreKey] = Math.min(20, (baseScores[k] ?? 10) + v);
    }
  } else if (asiMode === "feat") {
    for (const [k, v] of Object.entries(featAbilityBonuses)) {
      const scoreKey = `${k}Score`;
      payload[scoreKey] = Math.min(20, (baseScores[k] ?? 10) + v);
    }
  }

  return payload;
}

