import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { C } from "@/lib/theme";
import { rollDiceExpr } from "@/lib/dice";
import { collectSpellChoicesFromEffects, parseFeatureEffects } from "@/domain/character/parseFeatureEffects";
import { abilityMod, formatModifier } from "@/views/character/CharacterSheetUtils";
import type { ProficiencyMap } from "@/views/character/CharacterSheetTypes";
import {
  getCantripCount,
  getClassExpertiseChoices,
  getClassFeatureTable,
  getFeatChoiceOptions,
  getMaxSlotLevel,
  getPreparedSpellCount,
  getSpellcastingClassName,
  getSubclassLevel,
  getSubclassList,
  isSpellcaster,
  tableValueAtLevel,
  normalizeChoiceKey,
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  buildResolvedSpellChoiceEntry,
  buildSpellListChoiceEntry,
  loadSpellChoiceOptions,
  sanitizeSpellChoiceSelections,
} from "@/views/character-creator/utils/SpellChoiceUtils";
import type {
  AsiMode,
  HpChoice,
  LevelUpCharacter as Character,
  LevelUpClassDetail as ClassDetail,
  LevelUpFeatDetail as FeatDetail,
  LevelUpFeatSummary as FeatSummary,
  LevelUpResolvedSpellChoiceEntry,
  LevelUpSpellListChoiceEntry,
  LevelUpSpellSummary as SpellSummary,
} from "@/views/level-up/LevelUpTypes";
import { BackBtn, ChoiceBtn, ExpertiseSelectionSection, FeatSelectionSection, Section, SpellChoiceList, Wrap } from "@/views/level-up/LevelUpParts";
import { buildLevelUpPayload, deriveAllowedInvocationIds, deriveFeatAbilityBonuses, deriveHpGain, deriveLevelUpValidation, derivePreviewScores } from "@/views/level-up/LevelUpUtils";
import { cleanFeatureText, hasKeys, mergeAutoLevels, reconcileSelectedSpellIds, sameSelectionMap, sameSpellChoiceOptionMap, stripRulesetSuffix } from "@/views/level-up/LevelUpHelpers";

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_LABELS: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

export function LevelUpView() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [char, setChar] = useState<Character | null>(null);
  const [classDetail, setClassDetail] = useState<ClassDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // HP
  const [hpChoice, setHpChoice] = useState<HpChoice>(null);
  const [rolledHp, setRolledHp] = useState<number | null>(null);
  const [manualHp, setManualHp] = useState<string>("");

  // ASI
  const [asiMode, setAsiMode] = useState<AsiMode>(null);
  const [asiStats, setAsiStats] = useState<Record<string, number>>({});

  // Feature expand
  const [expandedFeatures, setExpandedFeatures] = useState<string[]>([]);
  const [subclass, setSubclass] = useState<string>("");
  const [chosenCantrips, setChosenCantrips] = useState<string[]>([]);
  const [chosenSpells, setChosenSpells] = useState<string[]>([]);
  const [chosenInvocations, setChosenInvocations] = useState<string[]>([]);
  const [chosenExpertise, setChosenExpertise] = useState<Record<string, string[]>>({});
  const [featSummaries, setFeatSummaries] = useState<FeatSummary[]>([]);
  const [featSearch, setFeatSearch] = useState("");
  const [chosenFeatId, setChosenFeatId] = useState<string>("");
  const [chosenFeatDetail, setChosenFeatDetail] = useState<FeatDetail | null>(null);
  const [chosenFeatOptions, setChosenFeatOptions] = useState<Record<string, string[]>>({});
  const [featSpellChoiceOptions, setFeatSpellChoiceOptions] = useState<Record<string, SpellSummary[]>>({});
  const [classFeatureSpellChoiceOptions, setClassFeatureSpellChoiceOptions] = useState<Record<string, SpellSummary[]>>({});
  const [classCantrips, setClassCantrips] = useState<SpellSummary[]>([]);
  const [classSpells, setClassSpells] = useState<SpellSummary[]>([]);
  const [classInvocations, setClassInvocations] = useState<SpellSummary[]>([]);
  const nextLevel = (char?.level ?? 0) + 1;
  const mergedAutolevels = React.useMemo(() => mergeAutoLevels(classDetail), [classDetail]);

  // -------------------------------------------------------------------------
  // Load character + class
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (!id) return;
    api<Character>(`/api/me/characters/${id}`)
      .then((c) => {
        setChar(c);
        setSubclass(String(c.characterData?.subclass ?? ""));
        setChosenCantrips(c.characterData?.chosenCantrips ?? []);
        setChosenSpells(c.characterData?.chosenSpells ?? []);
        setChosenInvocations(c.characterData?.chosenInvocations ?? []);
        const existingFeatOptions = (c.characterData?.chosenFeatOptions ?? {}) as Record<string, string[]>;
        setChosenExpertise(
          Object.fromEntries(
            Object.entries(existingFeatOptions).filter(([key]) => key.startsWith("classexpertise:"))
          )
        );
        const classId = c.characterData?.classId;
        if (classId) {
          return api<ClassDetail>(`/api/compendium/classes/${classId}`);
        }
        return null;
      })
      .then((cd) => { if (cd) setClassDetail(cd); })
      .catch((e) => setError(String(e)))
      .finally(() => setLoading(false));
  }, [id]);

  useEffect(() => {
    if (!classDetail) {
      setClassCantrips([]);
      setClassSpells([]);
      setClassInvocations([]);
      return;
    }
    const spellcastingClassName = getSpellcastingClassName(classDetail, nextLevel, subclass) ?? classDetail.name;
    const name = encodeURIComponent(spellcastingClassName);
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&level=0&limit=200`).then(setClassCantrips).catch(() => setClassCantrips([]));
    api<SpellSummary[]>(`/api/spells/search?classes=${name}&minLevel=1&maxLevel=9&limit=300`).then(setClassSpells).catch(() => setClassSpells([]));
    if (/warlock/i.test(classDetail.name)) {
      api<SpellSummary[]>("/api/spells/search?classes=Eldritch+Invocations&limit=200").then(setClassInvocations).catch(() => setClassInvocations([]));
    } else {
      setClassInvocations([]);
    }
  }, [classDetail, nextLevel, subclass]);

  useEffect(() => {
    api<FeatSummary[]>("/api/compendium/feats").then(setFeatSummaries).catch(() => setFeatSummaries([]));
  }, []);

  useEffect(() => {
    if (!chosenFeatId) {
      setChosenFeatDetail(null);
      return;
    }
    api<FeatDetail>(`/api/compendium/feats/${encodeURIComponent(chosenFeatId)}`)
      .then((feat) => setChosenFeatDetail(feat))
      .catch(() => setChosenFeatDetail(null));
  }, [chosenFeatId]);

  const hd = classDetail?.hd ?? 8;
  const conScore = char?.conScore ?? 10;
  const conMod = abilityMod(conScore);
  const hpAverage = Math.floor(hd / 2) + 1 + conMod;
  const hpRollMax = hd + conMod;

  const autoLevel = React.useMemo(
    () => mergedAutolevels.find((al) => al.level === nextLevel) ?? null,
    [mergedAutolevels, nextLevel]
  );
  const hasAsiFeature = Boolean(
    autoLevel?.features?.some((feature) => /ability score improvement/i.test(feature.name))
  );
  const spellcastingFeatureText = classDetail?.autolevels
    .flatMap((al) => al.features ?? [])
    .find((feature) => /spellcasting|pact magic/i.test(feature.name))
    ?.text ?? "";
  const usesFlexiblePreparedSpells = /changing your prepared spells\.\s*whenever you finish a (?:short|long) rest/i.test(spellcastingFeatureText);
  const newFeatures = React.useMemo(
    () => autoLevel?.features.filter((f) =>
      !f.optional
      || (
        Boolean(subclass)
        && /\(([^()]+)\)\s*$/.test(f.name)
        && new RegExp(`\\(${subclass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`, "i").test(f.name)
      )
    ) ?? [],
    [autoLevel, subclass]
  );
  const isAsiLevel = Boolean(autoLevel?.scoreImprovement ?? hasAsiFeature);
  const newSlots = autoLevel?.slots ?? null;
  const subclassLevel = classDetail ? getSubclassLevel(classDetail) : null;
  const subclassOptions = classDetail ? getSubclassList(classDetail) : [];
  const showSubclassChoice = Boolean(subclassLevel && nextLevel === subclassLevel && subclassOptions.length > 0);
  const needsSubclassChoice = Boolean(subclassLevel && nextLevel >= subclassLevel && subclassOptions.length > 0 && !subclass.trim());
  const subclassOverview = React.useMemo(() => {
    if (!classDetail || !subclass.trim()) return null;
    const className = stripRulesetSuffix(classDetail.name);
    const subclassPattern = new RegExp(`^${className.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s+Subclass:\\s+${subclass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`, "i");
    for (const autolevel of mergedAutolevels) {
      const feature = autolevel.features.find((entry) => subclassPattern.test(entry.name));
      if (feature) return feature;
    }
    return null;
  }, [classDetail, mergedAutolevels, subclass]);
  const selectedSubclassFeatures = React.useMemo(() => {
    if (!autoLevel || !subclass.trim()) return [];
    const subclassSuffix = new RegExp(`\\(${subclass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`, "i");
    return autoLevel.features.filter((feature) => subclassSuffix.test(feature.name));
  }, [autoLevel, subclass]);
  const cantripCount = classDetail ? getCantripCount(classDetail, nextLevel, subclass) : 0;
  const invocTable = classDetail ? getClassFeatureTable(classDetail, "Invocation", nextLevel, subclass) : [];
  const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, nextLevel) : 0;
  const prepCount = classDetail ? getPreparedSpellCount(classDetail, nextLevel, subclass) : 0;
  const maxSpellLevel = classDetail ? getMaxSlotLevel(classDetail, nextLevel, subclass) : 0;
  const spellcaster = classDetail ? isSpellcaster(classDetail, nextLevel, subclass) : false;
  const expertiseChoices = React.useMemo(
    () => (classDetail ? getClassExpertiseChoices(classDetail, nextLevel).filter((choice) => choice.key.startsWith(`classexpertise:${nextLevel}:`)) : []),
    [classDetail, nextLevel]
  );
  const charProficiencies: ProficiencyMap = {
    skills: Array.isArray(char?.characterData?.proficiencies?.skills) ? char.characterData.proficiencies.skills : [],
    expertise: Array.isArray(char?.characterData?.proficiencies?.expertise) ? char.characterData.proficiencies.expertise : [],
    saves: Array.isArray(char?.characterData?.proficiencies?.saves) ? char.characterData.proficiencies.saves : [],
    tools: Array.isArray(char?.characterData?.proficiencies?.tools) ? char.characterData.proficiencies.tools : [],
    languages: Array.isArray(char?.characterData?.proficiencies?.languages) ? char.characterData.proficiencies.languages : [],
    armor: Array.isArray(char?.characterData?.proficiencies?.armor) ? char.characterData.proficiencies.armor : [],
    weapons: Array.isArray(char?.characterData?.proficiencies?.weapons) ? char.characterData.proficiencies.weapons : [],
    spells: Array.isArray(char?.characterData?.proficiencies?.spells) ? char.characterData.proficiencies.spells : [],
    invocations: Array.isArray(char?.characterData?.proficiencies?.invocations) ? char.characterData.proficiencies.invocations : [],
    masteries: Array.isArray(char?.characterData?.proficiencies?.masteries) ? char.characterData.proficiencies.masteries : [],
  };
  const proficientSkills = Array.isArray(charProficiencies?.skills)
    ? charProficiencies.skills
      .map((entry) => typeof entry === "string" ? entry : entry?.name)
      .filter((entry): entry is string => Boolean(entry))
    : [];
  const existingExpertise = Array.isArray(charProficiencies?.expertise)
    ? charProficiencies.expertise
      .map((entry) => typeof entry === "string" ? entry : entry?.name)
      .filter((entry): entry is string => Boolean(entry))
    : [];
  const existingClassSpellNames = React.useMemo(
    () => Array.isArray(char?.characterData?.proficiencies?.spells)
      ? char.characterData.proficiencies.spells
        .filter((entry) => entry.source === (classDetail?.name ?? char.className))
        .map((entry) => entry.name)
      : [],
    [char?.characterData?.proficiencies?.spells, char?.className, classDetail?.name]
  );
  const featChoiceEntries = React.useMemo(
    () => (chosenFeatDetail?.parsed.choices ?? []).filter((choice) => choice.type !== "damage_type"),
    [chosenFeatDetail]
  );
  const featSourceLabel = chosenFeatDetail ? `${chosenFeatDetail.name} (Level ${nextLevel})` : "";
  const featSpellListChoices = React.useMemo<LevelUpSpellListChoiceEntry[]>(
    () => {
      if (!chosenFeatDetail) return [];
      return featChoiceEntries
        .filter((choice) => choice.type === "spell_list")
        .map((choice) => {
          const entry = buildSpellListChoiceEntry({
            key: `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`,
            choice: { ...choice, options: getFeatChoiceOptions(choice) },
            level: nextLevel,
            sourceLabel: featSourceLabel,
          });
          return {
            ...entry,
            title: "Spell List",
            note: entry.options.length === 1
              ? (choice.note ?? "Spell list fixed by this feat.")
              : choice.note,
          };
        });
    },
    [chosenFeatDetail, featChoiceEntries, featSourceLabel, nextLevel]
  );
  const featResolvedSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () => {
      if (!chosenFeatDetail) return [];
      return featChoiceEntries
        .filter((choice) => choice.type === "spell")
        .map((choice) => {
          const key = `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`;
          const linkedChoiceKey = choice.linkedTo ? `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.linkedTo}` : null;
          return {
            ...buildResolvedSpellChoiceEntry({
              key,
              choice,
              level: nextLevel,
              sourceLabel: chosenFeatDetail.name,
              chosenOptions: chosenFeatOptions,
              linkedChoiceKey,
            }),
          };
        });
    },
    [chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel]
  );
  const parsedNewFeatureEffects = React.useMemo(
    () => newFeatures.map((feature, index) =>
      parseFeatureEffects({
        source: {
          id: `levelup:${nextLevel}:${index}:${feature.name}`,
          kind: /\(/.test(feature.name) ? "subclass" : "class",
          name: feature.name,
          text: feature.text,
          level: nextLevel,
        },
        text: feature.text,
      })
    ),
    [newFeatures, nextLevel]
  );
  const classFeatureResolvedSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () => collectSpellChoicesFromEffects(parsedNewFeatureEffects).map((choice) => ({
      key: `levelupclassfeature:${nextLevel}:${choice.id}`,
      title: choice.source.name,
      sourceLabel: choice.source.name,
      count: choice.count.kind === "fixed" ? choice.count.value : 0,
      level: choice.level,
      note: choice.note ?? null,
      linkedTo: null,
      listNames: choice.spellLists,
      schools: choice.schools,
      ritualOnly: false,
    })),
    [nextLevel, parsedNewFeatureEffects]
  );
  const allowedInvocationIds = React.useMemo(
    () => deriveAllowedInvocationIds({ classCantrips, classInvocations, chosenCantrips, chosenInvocations, nextLevel }),
    [chosenCantrips, chosenInvocations, classCantrips, classInvocations, nextLevel]
  );

  useEffect(() => {
    setChosenCantrips((prev) => {
      const next = reconcileSelectedSpellIds(prev, classCantrips, existingClassSpellNames).slice(0, cantripCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classCantrips, cantripCount, existingClassSpellNames]);

  useEffect(() => {
    if (maxSpellLevel === 0) return;
    setChosenSpells((prev) => {
      const next = reconcileSelectedSpellIds(prev, classSpells, existingClassSpellNames)
        .filter((id) => {
          const spell = classSpells.find((entry) => entry.id === id);
          const spellLevel = Number(spell?.level ?? 0);
          return Boolean(spell) && spellLevel > 0 && spellLevel <= maxSpellLevel;
        })
        .slice(0, prepCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classSpells, existingClassSpellNames, maxSpellLevel, prepCount]);

  useEffect(() => {
    setChosenInvocations((prev) => {
      const next = prev.filter((id) => allowedInvocationIds.has(id)).slice(0, invocCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [allowedInvocationIds, invocCount]);

  useEffect(() => {
    if (expertiseChoices.length === 0) return;
    setChosenExpertise((prev) => {
      let changed = false;
      const next: Record<string, string[]> = { ...prev };
      const taken = new Set(existingExpertise.map((name) => normalizeChoiceKey(name)));
      const proficientSkillKeys = new Set(proficientSkills.map((skill) => normalizeChoiceKey(skill)));
      const existingExpertiseEntries = Array.isArray(char?.characterData?.proficiencies?.expertise)
        ? char.characterData.proficiencies.expertise
        : [];
      for (const choice of expertiseChoices) {
        const options = (choice.options ?? proficientSkills).filter((skill) => proficientSkillKeys.has(normalizeChoiceKey(skill)));
        const current = prev[choice.key] ?? [];
        const seededCurrent = current.length > 0
          ? current
          : existingExpertiseEntries
            .filter((entry) => typeof entry !== "string" && entry?.source === choice.source)
            .map((entry) => entry.name)
            .filter((skill) => options.some((option) => normalizeChoiceKey(option) === normalizeChoiceKey(skill)))
            .slice(0, choice.count);
        const filtered = current
          .filter((skill) => options.some((option) => normalizeChoiceKey(option) === normalizeChoiceKey(skill)))
          .filter((skill) => !taken.has(normalizeChoiceKey(skill)))
          .slice(0, choice.count);
        const finalSelection = filtered.length > 0 ? filtered : seededCurrent;
        finalSelection.forEach((skill) => taken.add(normalizeChoiceKey(skill)));
        if (finalSelection.length === 0) delete next[choice.key];
        else next[choice.key] = finalSelection;
        if (finalSelection.length !== current.length || finalSelection.some((skill, index) => skill !== current[index])) changed = true;
      }
      return changed ? next : prev;
    });
  }, [char?.characterData?.proficiencies?.expertise, expertiseChoices, proficientSkills, existingExpertise]);

  useEffect(() => {
    if (!chosenFeatDetail) {
      setChosenFeatOptions((prev) => hasKeys(prev) ? {} : prev);
      setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
  }, [chosenFeatDetail]);

  useEffect(() => {
    if (!chosenFeatDetail) {
      setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    let alive = true;
    if (featResolvedSpellChoices.length === 0) {
      setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    loadSpellChoiceOptions(featResolvedSpellChoices, (query) => api<SpellSummary[]>(query)).then((optionsByKey) => {
      if (alive) {
        setFeatSpellChoiceOptions((prev) => sameSpellChoiceOptionMap(prev, optionsByKey) ? prev : optionsByKey);
      }
    }).catch(() => {
      if (alive) setFeatSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
    });
    return () => { alive = false; };
  }, [chosenFeatDetail, featResolvedSpellChoices]);

  useEffect(() => {
    let alive = true;
    if (classFeatureResolvedSpellChoices.length === 0) {
      setClassFeatureSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
      return;
    }
    loadSpellChoiceOptions(classFeatureResolvedSpellChoices, (query) => api<SpellSummary[]>(query)).then((optionsByKey) => {
      if (alive) {
        setClassFeatureSpellChoiceOptions((prev) => sameSpellChoiceOptionMap(prev, optionsByKey) ? prev : optionsByKey);
      }
    }).catch(() => {
      if (alive) setClassFeatureSpellChoiceOptions((prev) => hasKeys(prev) ? {} : prev);
    });
    return () => { alive = false; };
  }, [classFeatureResolvedSpellChoices]);

  const featChoiceOptionsByKey = React.useMemo(() => {
    const entries: Array<[string, string[]]> = [];
    for (const choice of featChoiceEntries) {
      const key = `levelupfeat:${nextLevel}:${chosenFeatDetail?.id ?? ""}:${choice.id}`;
      if (choice.type === "spell") {
        const spellOptions = featSpellChoiceOptions[key] ?? [];
        const resolved = spellOptions.length > 0
          ? spellOptions.map((spell) => spell.name)
          : getFeatChoiceOptions(choice);
        entries.push([key, resolved]);
      } else {
        entries.push([key, getFeatChoiceOptions(choice)]);
      }
    }
    return Object.fromEntries(entries);
  }, [chosenFeatDetail?.id, featChoiceEntries, featSpellChoiceOptions, nextLevel]);

  useEffect(() => {
    if (!chosenFeatDetail) return;
    setChosenFeatOptions((prev) => {
      const next = { ...prev };
      for (const choice of chosenFeatDetail.parsed.choices) {
        const key = `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`;
        if (choice.type === "spell" || choice.type === "spell_list") continue;
        const options = featChoiceOptionsByKey[key] ?? [];
        const filtered = (prev[key] ?? [])
          .filter((value) => options.includes(value))
          .slice(0, choice.count);
        if (filtered.length === 0) delete next[key];
        else next[key] = filtered;
      }
      const sanitized = sanitizeSpellChoiceSelections({
        currentSelections: next,
        spellListChoices: featSpellListChoices,
        resolvedSpellChoices: featResolvedSpellChoices,
        spellOptionsByKey: featSpellChoiceOptions,
      });
      return sameSelectionMap(prev, sanitized) ? prev : sanitized;
    });
  }, [chosenFeatDetail, featChoiceEntries, featChoiceOptionsByKey, featResolvedSpellChoices, featSpellChoiceOptions, featSpellListChoices, nextLevel]);

  const hpGain = deriveHpGain(hpChoice, hpAverage, rolledHp, manualHp);
  const featAbilityBonuses = React.useMemo(
    () => deriveFeatAbilityBonuses({ chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel }),
    [chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel]
  );
  const featHpBonus = asiMode === "feat" && /(^|\\s)tough(\\s|$)/i.test(chosenFeatDetail?.name ?? "") ? nextLevel * 2 : 0;

  // Current scores + ASI deltas
  const baseScores: Record<string, number> = {
    str: char?.strScore ?? 10, dex: char?.dexScore ?? 10, con: char?.conScore ?? 10,
    int: char?.intScore ?? 10, wis: char?.wisScore ?? 10, cha: char?.chaScore ?? 10,
  };
  const previewScores = React.useMemo(
    () => derivePreviewScores({ baseScores, asiStats, asiMode, featAbilityBonuses }),
    [baseScores, asiStats, asiMode, featAbilityBonuses]
  );
  const { filteredFeatSummaries, featPrereqsMet, featRepeatableValid, asiTotal, canConfirm } = React.useMemo(
    () =>
      deriveLevelUpValidation({
        isAsiLevel,
        asiMode,
        asiStats,
        needsSubclassChoice,
        subclass,
        cantripCount,
        chosenCantrips,
        spellcaster,
        prepCount,
        chosenSpells,
        invocCount,
        chosenInvocations,
        expertiseChoices,
        chosenExpertise,
        chosenFeatDetail,
        featChoiceEntries,
        chosenFeatOptions,
        nextLevel,
        className: classDetail?.name ?? char?.className,
        level: nextLevel,
        scores: baseScores,
        prof: charProficiencies,
        featSearch,
        featSummaries,
        hpGain,
        existingLevelUpFeats: char?.characterData?.chosenLevelUpFeats ?? [],
      }),
    [
      isAsiLevel,
      asiMode,
      asiStats,
      needsSubclassChoice,
      subclass,
      cantripCount,
      chosenCantrips,
      spellcaster,
      prepCount,
      chosenSpells,
      invocCount,
      chosenInvocations,
      expertiseChoices,
      chosenExpertise,
      chosenFeatDetail,
      featChoiceEntries,
      chosenFeatOptions,
      nextLevel,
      classDetail?.name,
      char?.className,
      char?.characterData?.proficiencies,
      featSearch,
      featSummaries,
      hpGain,
    ]
  );
  const lockedCantripIds = React.useMemo(
    () => new Set(reconcileSelectedSpellIds(char?.characterData?.chosenCantrips ?? [], classCantrips, existingClassSpellNames).slice(0, cantripCount)),
    [char?.characterData?.chosenCantrips, classCantrips, existingClassSpellNames, cantripCount]
  );
  const lockedSpellIds = React.useMemo(
    () => new Set(reconcileSelectedSpellIds(char?.characterData?.chosenSpells ?? [], classSpells, existingClassSpellNames)
      .filter((id) => {
        const spell = classSpells.find((entry) => entry.id === id);
        const spellLevel = Number(spell?.level ?? 0);
        return Boolean(spell) && spellLevel > 0 && spellLevel <= maxSpellLevel;
      })
      .slice(0, prepCount)),
    [char?.characterData?.chosenSpells, classSpells, existingClassSpellNames, maxSpellLevel, prepCount]
  );
  const extraFeatSpellSelectionsValid = React.useMemo(
    () =>
      featSpellListChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && featResolvedSpellChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && classFeatureResolvedSpellChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count),
    [chosenFeatOptions, classFeatureResolvedSpellChoices, featResolvedSpellChoices, featSpellListChoices]
  );

  if (loading) return <Wrap><p style={{ color: C.muted }}>Loading…</p></Wrap>;
  if (error || !char) return <Wrap><p style={{ color: C.red }}>{error ?? "Character not found."}</p></Wrap>;
  if (nextLevel > 20) {
    return (
      <Wrap>
        <p style={{ color: C.muted }}>Already at max level (20).</p>
        <BackBtn onClick={() => navigate(`/characters/${char.id}`)} />
      </Wrap>
    );
  }
  const cantripChoiceCount = Math.max(0, cantripCount - lockedCantripIds.size);
  const spellChoiceCount = Math.max(0, prepCount - lockedSpellIds.size);
  const displayedChosenCantrips = chosenCantrips.filter((id) => !lockedCantripIds.has(id));
  const displayedChosenSpells = chosenSpells.filter((id) => !lockedSpellIds.has(id));
  const availableCantripChoices = classCantrips.filter((spell) => !lockedCantripIds.has(spell.id));
  const availableSpellChoices = classSpells.filter((spell) =>
    !lockedSpellIds.has(spell.id)
    && Number(spell.level ?? 0) > 0
    && Number(spell.level ?? 0) <= maxSpellLevel
  );

  function rollHp() {
    const rolled = rollDiceExpr(`1d${hd}`);
    const total = Math.max(1, rolled + conMod);
    setRolledHp(total);
    setHpChoice("roll");
  }

  function toggleAsiPoint(key: string) {
    if (!asiMode || asiMode === "feat") return;
    setAsiStats((prev) => {
      const current = prev[key] ?? 0;
      const totalAssigned = Object.values(prev).reduce((sum, value) => sum + value, 0);
      const next = { ...prev };
      if (current >= 2) {
        delete next[key];
      } else if (totalAssigned < 2) {
        next[key] = current + 1;
      }
      return next;
    });
  }

  function clearAsi() {
    setAsiStats({});
    setAsiMode(null);
  }

  function toggleSelection(id: string, chosen: string[], setChosen: React.Dispatch<React.SetStateAction<string[]>>, max: number) {
    setChosen((prev) => {
      const has = prev.includes(id);
      if (has) return prev.filter((entry) => entry !== id);
      if (prev.length >= max) return prev;
      return [...prev, id];
    });
  }

  async function confirm() {
    if (!char || !canConfirm || !extraFeatSpellSelectionsValid) return;
    setSaving(true);
    try {
      const selectedCantripEntries = classCantrips
        .filter((spell) => chosenCantrips.includes(spell.id))
        .map((spell) => ({ name: spell.name, source: classDetail?.name ?? char.className }));
      const selectedSpellEntries = classSpells
        .filter((spell) => chosenSpells.includes(spell.id))
        .map((spell) => ({ name: spell.name, source: classDetail?.name ?? char.className }));
      const selectedClassFeatureSpellEntries = classFeatureResolvedSpellChoices.flatMap((choice) => {
        const selected = chosenFeatOptions[choice.key] ?? [];
        return selected.map((name) => ({ name, source: choice.sourceLabel ?? choice.title }));
      });
      const selectedInvocationEntries = classInvocations
        .filter((spell) => chosenInvocations.includes(spell.id))
        .map((spell) => ({ name: spell.name, source: classDetail?.name ?? char.className }));
      const payload = buildLevelUpPayload({
        char,
        nextLevel,
        hpGain: hpGain ?? 0,
        featHpBonus,
        subclass,
        chosenCantrips,
        chosenSpells,
        chosenInvocations,
        chosenExpertise,
        chosenFeatOptions,
        expertiseChoices,
        featChoiceEntries,
        chosenFeatDetail,
        featSourceLabel,
        newFeatures,
        classDetailName: classDetail?.name,
        selectedCantripEntries,
        selectedSpellEntries,
        selectedClassFeatureSpellEntries,
        selectedInvocationEntries,
        baseScores,
        asiMode,
        asiStats,
        featAbilityBonuses,
      });
      await api(`/api/me/characters/${char.id}`, jsonInit("PUT", payload));
      navigate(`/characters/${char.id}`);
    } catch (e) {
      setError(String(e));
    } finally {
      setSaving(false);
    }
  }

  const accentColor = C.accentHl;

  return (
    <Wrap>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(`/characters/${char.id}`)}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: "var(--fs-title)", padding: 0 }}
        >←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: "var(--fs-title)", fontWeight: 900, color: C.text }}>{char.name}</h1>
          <div style={{ fontSize: "var(--fs-subtitle)", color: accentColor, fontWeight: 700, marginTop: 2 }}>
            Level {char.level} → <span style={{ color: "#fff" }}>{nextLevel}</span>
            {classDetail && <span style={{ color: C.muted, fontWeight: 400 }}> · {classDetail.name}</span>}
          </div>
        </div>
      </div>

      {/* ── HP gain ── */}
      <Section title={`HP at Level ${nextLevel}`} accent={accentColor}>
        <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 10 }}>
          Hit Die: d{hd} · CON modifier: {formatModifier(conMod)}
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <ChoiceBtn
            active={hpChoice === "average"}
            onClick={() => { setHpChoice("average"); setRolledHp(null); setManualHp(""); }}
          >
            Take average — <strong>+{hpAverage}</strong>
          </ChoiceBtn>
          <ChoiceBtn
            active={hpChoice === "roll"}
            onClick={() => { setManualHp(""); rollHp(); }}
            accent={C.green}
          >
            {hpChoice === "roll" && rolledHp !== null
              ? <>🎲 Rolled — <strong>+{rolledHp}</strong> <span style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>(click to re-roll)</span></>
              : <>🎲 Roll 1d{hd}</>}
          </ChoiceBtn>
          <ChoiceBtn
            active={hpChoice === "manual"}
            onClick={() => { setHpChoice("manual"); setRolledHp(null); }}
            accent="#f59e0b"
          >
            Manual HP
          </ChoiceBtn>
        </div>
        {hpChoice === "manual" && (
          <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
            <input
              type="number"
              min={1}
              inputMode="numeric"
              value={manualHp}
              onChange={(e) => setManualHp(e.target.value)}
              placeholder={`Enter total gained (e.g. ${Math.max(1, 1 + conMod)}-${Math.max(1, hd + conMod)})`}
              style={{
                flex: "0 1 280px",
                padding: "10px 12px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.10)",
                background: "rgba(255,255,255,0.04)",
                color: C.text,
                fontSize: "var(--fs-medium)",
                fontWeight: 700,
                outline: "none",
              }}
            />
            <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
              Enter the final HP gained after applying Constitution.
            </div>
          </div>
        )}
        {hpGain !== null && (
          <div style={{ marginTop: 10, fontSize: "var(--fs-subtitle)", color: C.muted }}>
            New HP max: <span style={{ color: "#fff", fontWeight: 700 }}>{char.hpMax} + {hpGain}{featHpBonus > 0 ? ` + ${featHpBonus}` : ""} = {char.hpMax + hpGain + featHpBonus}</span>
          </div>
        )}
      </Section>

      {/* ── ASI ── */}
      {isAsiLevel && (
        <Section title="Ability Score Improvement" accent={accentColor}>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 12 }}>
            +2 to one ability score, +1 to two different scores, or take a feat.
          </div>

          {/* Mode selection */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {(["asi", "feat"] as const).map((m) => (
              <ChoiceBtn
                key={m}
                active={asiMode === m}
                onClick={() => { clearAsi(); setAsiMode(m); }}
              >
                {m === "asi" ? "Improve Abilities" : "Take a Feat"}
              </ChoiceBtn>
            ))}
          </div>

          {asiMode && asiMode !== "feat" && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: 8 }}>
              {ABILITY_KEYS.map((k) => {
                const base = baseScores[k] ?? 10;
                const delta = asiStats[k] ?? 0;
                const preview = Math.min(20, base + delta);
                const maxed = base >= 20;
                const selected = delta > 0;
                return (
                  <button
                    key={k}
                    onClick={() => !maxed && toggleAsiPoint(k)}
                    style={{
                      padding: "10px 6px", borderRadius: 8, cursor: maxed ? "default" : "pointer",
                      border: `2px solid ${selected ? accentColor : "rgba(255,255,255,0.1)"}`,
                      background: selected ? `${accentColor}18` : "rgba(255,255,255,0.03)",
                      color: maxed ? C.muted : C.text,
                      textAlign: "center",
                    }}
                  >
                    <div style={{ fontSize: "var(--fs-tiny)", color: C.muted, marginBottom: 2 }}>{ABILITY_LABELS[k]}</div>
                    <div style={{ fontSize: "var(--fs-large)", fontWeight: 900 }}>
                      {preview}
                      {selected && <span style={{ fontSize: "var(--fs-small)", color: accentColor }}> +{delta}</span>}
                    </div>
                    <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{formatModifier(abilityMod(preview))}</div>
                    {maxed && <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>MAX</div>}
                  </button>
                );
              })}
            </div>
          )}

          {asiMode === "feat" && (
            <FeatSelectionSection
              accentColor={accentColor}
              featSearch={featSearch}
              onFeatSearchChange={setFeatSearch}
              chosenFeatId={chosenFeatId}
              filteredFeatSummaries={filteredFeatSummaries}
              onChooseFeat={(featId) => {
                setChosenFeatId(featId);
                setChosenFeatOptions({});
              }}
              chosenFeatDetail={chosenFeatDetail}
              featPrereqsMet={featPrereqsMet}
              featRepeatableValid={featRepeatableValid}
              featChoiceEntries={featChoiceEntries}
                featChoiceOptionsByKey={featChoiceOptionsByKey}
                chosenFeatOptions={chosenFeatOptions}
                nextLevel={nextLevel}
              onToggleFeatOption={(choiceKey, option, count) => {
                setChosenFeatOptions((prev) => {
                  const current = prev[choiceKey] ?? [];
                  const next = current.includes(option)
                    ? current.filter((entry) => entry !== option)
                    : current.length < count
                      ? [...current, option]
                      : current;
                  return { ...prev, [choiceKey]: next };
                });
              }}
            />
          )}
        </Section>
      )}

      {expertiseChoices.length > 0 && (
        <Section title={`Expertise at Level ${nextLevel}`} accent={accentColor}>
          <ExpertiseSelectionSection
            accentColor={accentColor}
            expertiseChoices={expertiseChoices}
            chosenExpertise={chosenExpertise}
            proficientSkills={proficientSkills}
            existingExpertise={existingExpertise}
            onToggleExpertise={(choiceKey, skill, count) => {
              setChosenExpertise((prev) => {
                const current = prev[choiceKey] ?? [];
                const next = current.includes(skill)
                  ? current.filter((entry) => entry !== skill)
                  : current.length < count
                    ? [...current, skill]
                    : current;
                return { ...prev, [choiceKey]: next };
              });
            }}
          />
        </Section>
      )}

      {showSubclassChoice && (
        <Section title={`Subclass at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ fontSize: "var(--fs-small)", color: C.muted, marginBottom: 12 }}>
            {subclass.trim() ? "Subclass selected. You can change it before confirming level-up." : "Choose your subclass."}
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: 14, alignItems: "start" }}>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
              {subclassOptions.map((option) => (
                <ChoiceBtn key={option} active={subclass === option} onClick={() => setSubclass(option)}>
                  {option}
                </ChoiceBtn>
              ))}
            </div>
            <div style={{
              padding: "12px 14px",
              borderRadius: 10,
              border: "1px solid rgba(255,255,255,0.08)",
              background: "rgba(255,255,255,0.03)",
              minHeight: 120,
            }}>
              {subclassOverview ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <div>
                    <div style={{ fontSize: "var(--fs-large)", fontWeight: 900, color: "#fff", marginBottom: 6 }}>
                      {subclass}
                    </div>
                    <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.65, whiteSpace: "pre-wrap" }}>
                      {cleanFeatureText(subclassOverview.text)}
                    </div>
                  </div>
                  {selectedSubclassFeatures.length > 0 && (
                    <div>
                      <div style={{ fontSize: "var(--fs-tiny)", color: accentColor, fontWeight: 800, textTransform: "uppercase", letterSpacing: 0.8, marginBottom: 8 }}>
                        Features Gained Now
                      </div>
                      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                        {selectedSubclassFeatures.map((feature) => (
                          <div key={feature.name}>
                            <div style={{ fontSize: "var(--fs-body)", color: "#fff", fontWeight: 800, marginBottom: 4 }}>
                              {feature.name}
                            </div>
                            <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6, whiteSpace: "pre-wrap" }}>
                              {cleanFeatureText(feature.text)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6 }}>
                  Pick a subclass to see its description and the features you gain at this level.
                </div>
              )}
            </div>
          </div>
        </Section>
      )}

      {(cantripCount > 0 || prepCount > 0 || invocCount > 0 || featSpellListChoices.length > 0 || featResolvedSpellChoices.length > 0 || classFeatureResolvedSpellChoices.length > 0) && (
        <Section title={`Spell Choices at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {cantripChoiceCount > 0 && (
              <SpellChoiceList
                title="Cantrips"
                caption={`Choose ${cantripChoiceCount}`}
                spells={availableCantripChoices}
                chosen={displayedChosenCantrips}
                max={cantripChoiceCount}
                onToggle={(id) => toggleSelection(id, displayedChosenCantrips, (updater) => {
                  setChosenCantrips((prev) => {
                    const unlocked = prev.filter((entry) => !lockedCantripIds.has(entry));
                    const nextUnlocked = typeof updater === "function" ? updater(unlocked) : updater;
                    return [...Array.from(lockedCantripIds), ...nextUnlocked];
                  });
                }, cantripChoiceCount)}
              />
            )}
            {spellcaster && spellChoiceCount > 0 && (
              <SpellChoiceList
                title={usesFlexiblePreparedSpells ? "Additional Spells" : "Prepared Spells"}
                caption={`Choose ${spellChoiceCount} (up to level ${maxSpellLevel})`}
                spells={availableSpellChoices}
                chosen={displayedChosenSpells}
                max={spellChoiceCount}
                onToggle={(id) => toggleSelection(id, displayedChosenSpells, (updater) => {
                  setChosenSpells((prev) => {
                    const unlocked = prev.filter((entry) => !lockedSpellIds.has(entry));
                    const nextUnlocked = typeof updater === "function" ? updater(unlocked) : updater;
                    return [...Array.from(lockedSpellIds), ...nextUnlocked];
                  });
                }, spellChoiceCount)}
              />
            )}
            {spellcaster && prepCount > 0 && usesFlexiblePreparedSpells && spellChoiceCount === 0 && (
              <div style={{
                padding: "12px 14px",
                borderRadius: 10,
                border: "1px solid rgba(255,255,255,0.08)",
                background: "rgba(255,255,255,0.03)",
              }}>
                <div style={{ fontSize: "var(--fs-subtitle)", fontWeight: 800, color: C.text, marginBottom: 6 }}>
                  Prepared Spells
                </div>
                <div style={{ fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6 }}>
                  Your preparation capacity at level {nextLevel} is {prepCount} spell{prepCount === 1 ? "" : "s"} of up to level {maxSpellLevel}.
                  Manage the actual prepared circles from the character sheet; level-up does not force you to rebuild that list.
                </div>
              </div>
            )}
            {invocCount > 0 && classInvocations.length > 0 && (
              <SpellChoiceList
                title="Eldritch Invocations"
                caption={`Choose ${invocCount}`}
                spells={classInvocations.filter((invocation) => allowedInvocationIds.has(invocation.id))}
                chosen={chosenInvocations}
                max={invocCount}
                onToggle={(id) => toggleSelection(id, chosenInvocations, setChosenInvocations, invocCount)}
                isAllowed={(invocation) => allowedInvocationIds.has(invocation.id)}
              />
            )}
            {featSpellListChoices.map((choice) => {
              const selected = chosenFeatOptions[choice.key] ?? [];
              return (
                <div key={choice.key}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, gap: 8, flexWrap: "wrap" }}>
                    <div style={{ fontSize: "var(--fs-medium)", fontWeight: 800, color: "#fff" }}>{choice.title}</div>
                    <div style={{ fontSize: "var(--fs-small)", color: selected.length >= choice.count ? accentColor : C.muted }}>
                      {selected.length} / {choice.count}
                    </div>
                  </div>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                    {choice.options.map((option) => {
                      const active = selected.includes(option);
                      const blocked = !active && selected.length >= choice.count;
                      return (
                        <ChoiceBtn
                          key={option}
                          active={active}
                          onClick={() => {
                            if (blocked) return;
                            setChosenFeatOptions((prev) => {
                              const current = prev[choice.key] ?? [];
                              const next = current.includes(option)
                                ? current.filter((entry) => entry !== option)
                                : current.length < choice.count
                                  ? [...current, option]
                                  : current;
                              return { ...prev, [choice.key]: next };
                            });
                          }}
                          accent={accentColor}
                        >
                          {option}
                        </ChoiceBtn>
                      );
                    })}
                  </div>
                  {choice.note && <div style={{ marginTop: 8, fontSize: "var(--fs-small)", color: C.muted }}>{choice.note}</div>}
                </div>
              );
            })}
            {featResolvedSpellChoices.map((choice) => (
              <SpellChoiceList
                key={choice.key}
                title={choice.title}
                caption={`Choose ${choice.count}`}
                spells={(featSpellChoiceOptions[choice.key] ?? []).map((spell) => ({ ...spell, id: spell.name }))}
                chosen={chosenFeatOptions[choice.key] ?? []}
                max={choice.count}
                onToggle={(id) => {
                  setChosenFeatOptions((prev) => {
                    const current = prev[choice.key] ?? [];
                    const next = current.includes(id)
                      ? current.filter((entry) => entry !== id)
                      : current.length < choice.count
                        ? [...current, id]
                        : current;
                    return { ...prev, [choice.key]: next };
                  });
                }}
              />
            ))}
            {classFeatureResolvedSpellChoices.map((choice) => (
              <SpellChoiceList
                key={choice.key}
                title={choice.title}
                caption={`Choose ${choice.count}`}
                spells={(classFeatureSpellChoiceOptions[choice.key] ?? []).map((spell) => ({ ...spell, id: spell.name }))}
                chosen={chosenFeatOptions[choice.key] ?? []}
                max={choice.count}
                onToggle={(id) => {
                  setChosenFeatOptions((prev) => {
                    const current = prev[choice.key] ?? [];
                    const next = current.includes(id)
                      ? current.filter((entry) => entry !== id)
                      : current.length < choice.count
                        ? [...current, id]
                        : current;
                    return { ...prev, [choice.key]: next };
                  });
                }}
              />
            ))}
            {(featResolvedSpellChoices.some((choice) => (featSpellChoiceOptions[choice.key] ?? []).length === 0)
              || classFeatureResolvedSpellChoices.some((choice) => (classFeatureSpellChoiceOptions[choice.key] ?? []).length === 0)) && (
              <div style={{ fontSize: "var(--fs-small)", color: C.muted }}>
                {featResolvedSpellChoices.some((choice) => choice.linkedTo && (chosenFeatOptions[choice.linkedTo] ?? []).length === 0)
                  ? "Choose the spell list first."
                  : "No eligible spell options found."}
              </div>
            )}
          </div>
        </Section>
      )}

      {/* ── New features ── */}
      {newFeatures.length > 0 && (
        <Section title={`New Features at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {newFeatures.map((f) => {
              const key = f.name;
              const expanded = expandedFeatures.includes(key);
              return (
                <div
                  key={key}
                  style={{
                    borderRadius: 8, border: "1px solid rgba(255,255,255,0.08)",
                    background: "rgba(255,255,255,0.03)", overflow: "hidden",
                  }}
                >
                  <button
                    onClick={() => setExpandedFeatures((p) =>
                      p.includes(key) ? p.filter((x) => x !== key) : [...p, key]
                    )}
                    style={{
                      width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
                      padding: "10px 12px", background: "none", border: "none", cursor: "pointer",
                      color: C.text, fontWeight: 700, fontSize: "var(--fs-subtitle)", textAlign: "left",
                    }}
                  >
                    <span>{f.name}</span>
                    <span style={{ color: C.muted, fontSize: "var(--fs-small)" }}>{expanded ? "▲" : "▼"}</span>
                  </button>
                  {expanded && (
                    <div style={{
                      padding: "0 12px 12px", fontSize: "var(--fs-small)", color: C.muted, lineHeight: 1.6,
                      whiteSpace: "pre-wrap",
                    }}>
                      {f.text}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Spell slots ── */}
      {newSlots && newSlots.some((s, i) => i > 0 && s > 0) && (
        <Section title={`Spell Slots at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {newSlots.map((count, i) => {
              if (count === 0) return null;
              return (
                <div key={i} style={{
                  padding: "6px 12px", borderRadius: 8,
                  border: "1px solid rgba(255,255,255,0.1)", background: "rgba(255,255,255,0.04)",
                  textAlign: "center",
                }}>
                  <div style={{ fontSize: "var(--fs-tiny)", color: C.muted }}>{SLOT_LABELS[i] ?? `L${i}`}</div>
                  <div style={{ fontWeight: 800, fontSize: "var(--fs-body)", color: accentColor }}>{count}</div>
                </div>
              );
            })}
          </div>
        </Section>
      )}

      {/* ── Confirm ── */}
      <div style={{ marginTop: 8, display: "flex", gap: 10 }}>
        <button
          onClick={() => navigate(`/characters/${char.id}`)}
          style={{
            padding: "12px 20px", borderRadius: 10, cursor: "pointer", fontSize: "var(--fs-medium)", fontWeight: 600,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: C.muted,
          }}
        >Cancel</button>
        <button
          onClick={confirm}
          disabled={!canConfirm || !extraFeatSpellSelectionsValid || saving}
          style={{
            flex: 1, padding: "12px 20px", borderRadius: 10, cursor: canConfirm && !saving ? "pointer" : "not-allowed",
            fontSize: "var(--fs-medium)", fontWeight: 800, border: "none",
            background: canConfirm ? accentColor : "rgba(255,255,255,0.08)",
            color: canConfirm ? "#fff" : C.muted,
            opacity: saving ? 0.6 : 1,
            transition: "background 0.2s",
          }}
        >
          {saving ? "Saving…" : `⬆ Level Up to ${nextLevel}`}
        </button>
      </div>
    </Wrap>
  );
}
