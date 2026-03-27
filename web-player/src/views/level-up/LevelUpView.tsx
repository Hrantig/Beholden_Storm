import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, jsonInit } from "@/services/api";
import { C } from "@/lib/theme";
import { rollDiceExpr } from "@/lib/dice";
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
} from "@/views/character-creator/utils/CharacterCreatorUtils";
import {
  FEAT_SPELL_LIST_NAMES,
  loadSpellChoiceOptions,
  sanitizeSpellChoiceSelections,
} from "@/views/character-creator/utils/SpellChoiceUtils";
import { BackBtn, ChoiceBtn, ExpertiseSelectionSection, FeatSelectionSection, Section, SpellChoiceList, Wrap } from "@/views/level-up/LevelUpParts";
import { buildLevelUpPayload, deriveAllowedInvocationIds, deriveFeatAbilityBonuses, deriveHpGain, deriveLevelUpValidation, derivePreviewScores } from "@/views/level-up/LevelUpUtils";

// ---------------------------------------------------------------------------
// Types (minimal, matching CharacterView / CharacterCreatorView shapes)
// ---------------------------------------------------------------------------

interface AutoLevel {
  level: number;
  scoreImprovement: boolean;
  slots: number[] | null;
  features: { name: string; text: string; optional: boolean }[];
  counters: { name: string; value: number; reset: string }[];
}

interface ClassDetail {
  id: string;
  name: string;
  hd: number | null;
  autolevels: AutoLevel[];
}

interface SpellSummary {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
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

interface FeatSummary {
  id: string;
  name: string;
}

interface FeatDetail {
  id: string;
  name: string;
  text?: string | null;
  parsed: ParsedFeat;
}

interface Character {
  id: string;
  name: string;
  className: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  characterData: {
    classId?: string;
    xp?: number;
    subclass?: string | null;
    chosenLevelUpFeats?: Array<{ level: number; featId: string }>;
    chosenCantrips?: string[];
    chosenSpells?: string[];
    chosenInvocations?: string[];
    chosenFeatOptions?: Record<string, string[]>;
    proficiencies?: {
      spells?: Array<{ name: string; source: string }>;
      invocations?: Array<{ name: string; source: string }>;
      skills?: Array<{ name: string; source: string }>;
      expertise?: Array<{ name: string; source: string }>;
      [k: string]: unknown;
    };
    [k: string]: unknown;
  } | null;
}

type AsiMode = "+2" | "+1+1" | "feat" | null;
type HpChoice = "roll" | "average" | "manual" | null;

const ABILITY_KEYS = ["str", "dex", "con", "int", "wis", "cha"] as const;
const ABILITY_LABELS: Record<string, string> = {
  str: "Strength", dex: "Dexterity", con: "Constitution",
  int: "Intelligence", wis: "Wisdom", cha: "Charisma",
};

// Spell slot columns: index 1–9 map to spell levels
const SLOT_LABELS = ["Cantrips", "1st", "2nd", "3rd", "4th", "5th", "6th", "7th", "8th", "9th"];
interface LevelUpSpellListChoiceEntry {
  key: string;
  title: string;
  count: number;
  options: string[];
  note?: string | null;
}

interface LevelUpResolvedSpellChoiceEntry {
  key: string;
  title: string;
  count: number;
  level: number | null;
  note?: string | null;
  linkedTo?: string | null;
  listNames: string[];
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

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
  const [classCantrips, setClassCantrips] = useState<SpellSummary[]>([]);
  const [classSpells, setClassSpells] = useState<SpellSummary[]>([]);
  const [classInvocations, setClassInvocations] = useState<SpellSummary[]>([]);
  const nextLevel = (char?.level ?? 0) + 1;

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

  const autoLevel = classDetail?.autolevels.find((al) => al.level === nextLevel);
  const newFeatures = autoLevel?.features.filter((f) => !f.optional || (Boolean(subclass) && /\(([^()]+)\)\s*$/.test(f.name) && new RegExp(`\\(${subclass.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\)\\s*$`, "i").test(f.name))) ?? [];
  const isAsiLevel = autoLevel?.scoreImprovement ?? false;
  const newSlots = autoLevel?.slots ?? null;
  const subclassLevel = classDetail ? getSubclassLevel(classDetail) : null;
  const subclassOptions = classDetail ? getSubclassList(classDetail) : [];
  const needsSubclassChoice = Boolean(subclassLevel && nextLevel >= subclassLevel && subclassOptions.length > 0);
  const cantripCount = classDetail ? getCantripCount(classDetail, nextLevel, subclass) : 0;
  const invocTable = classDetail ? getClassFeatureTable(classDetail, "Invocation", nextLevel, subclass) : [];
  const invocCount = invocTable.length > 0 ? tableValueAtLevel(invocTable, nextLevel) : 0;
  const prepCount = classDetail ? getPreparedSpellCount(classDetail, nextLevel, subclass) : 0;
  const maxSpellLevel = classDetail ? getMaxSlotLevel(classDetail, nextLevel, subclass) : 0;
  const spellcaster = classDetail ? isSpellcaster(classDetail, nextLevel, subclass) : false;
  const expertiseChoices = classDetail ? getClassExpertiseChoices(classDetail, nextLevel) : [];
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
    ? charProficiencies.skills.map((entry) => entry.name)
    : [];
  const existingExpertise = Array.isArray(charProficiencies?.expertise)
    ? charProficiencies.expertise.map((entry) => entry.name)
    : [];
  const featChoiceEntries = React.useMemo(
    () => (chosenFeatDetail?.parsed.choices ?? []).filter((choice) => choice.type !== "damage_type"),
    [chosenFeatDetail]
  );
  const featSpellListChoices = React.useMemo<LevelUpSpellListChoiceEntry[]>(
    () => {
      if (!chosenFeatDetail) return [];
      return featChoiceEntries
        .filter((choice) => choice.type === "spell_list")
        .map((choice) => ({
          key: `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`,
          title: "Spell List Choice",
          count: choice.count,
          options: getFeatChoiceOptions(choice),
          note: choice.note,
        }));
    },
    [chosenFeatDetail, featChoiceEntries, nextLevel]
  );
  const featResolvedSpellChoices = React.useMemo<LevelUpResolvedSpellChoiceEntry[]>(
    () => {
      if (!chosenFeatDetail) return [];
      return featChoiceEntries
        .filter((choice) => choice.type === "spell")
        .map((choice) => {
          const key = `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.id}`;
          const linkedChoiceKey = choice.linkedTo ? `levelupfeat:${nextLevel}:${chosenFeatDetail.id}:${choice.linkedTo}` : null;
          const listNames = linkedChoiceKey
            ? (chosenFeatOptions[linkedChoiceKey] ?? []).filter((name) => FEAT_SPELL_LIST_NAMES.has(name))
            : (choice.options ?? []).filter((name) => FEAT_SPELL_LIST_NAMES.has(name));
          return {
            key,
            title: choice.level === 0 ? "Feat Cantrip Choice" : "Feat Spell Choice",
            count: choice.count,
            level: choice.level ?? null,
            note: choice.note,
            linkedTo: linkedChoiceKey,
            listNames,
          };
        });
    },
    [chosenFeatDetail, chosenFeatOptions, featChoiceEntries, nextLevel]
  );
  const featSourceLabel = chosenFeatDetail ? `${chosenFeatDetail.name} (Level ${nextLevel})` : "";
  const allowedInvocationIds = React.useMemo(
    () => deriveAllowedInvocationIds({ classCantrips, classInvocations, chosenCantrips, chosenInvocations, nextLevel }),
    [chosenCantrips, chosenInvocations, classCantrips, classInvocations, nextLevel]
  );

  useEffect(() => {
    setChosenCantrips((prev) => {
      const next = prev.filter((id) => classCantrips.some((spell) => spell.id === id)).slice(0, cantripCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classCantrips, cantripCount]);

  useEffect(() => {
    if (maxSpellLevel === 0) return;
    setChosenSpells((prev) => {
      const next = prev
        .filter((id) => {
          const spell = classSpells.find((entry) => entry.id === id);
          const spellLevel = Number(spell?.level ?? 0);
          return Boolean(spell) && spellLevel > 0 && spellLevel <= maxSpellLevel;
        })
        .slice(0, prepCount);
      return next.length === prev.length && next.every((id, index) => id === prev[index]) ? prev : next;
    });
  }, [classSpells, maxSpellLevel, prepCount]);

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
      const taken = new Set(existingExpertise.map((name) => name.toLowerCase()));
      for (const choice of expertiseChoices) {
        const options = (choice.options ?? proficientSkills).filter((skill) => proficientSkills.includes(skill));
        const current = prev[choice.key] ?? [];
        const filtered = current
          .filter((skill) => options.includes(skill))
          .filter((skill) => !taken.has(skill.toLowerCase()))
          .slice(0, choice.count);
        filtered.forEach((skill) => taken.add(skill.toLowerCase()));
        if (filtered.length === 0) delete next[choice.key];
        else next[choice.key] = filtered;
        if (filtered.length !== current.length || filtered.some((skill, index) => skill !== current[index])) changed = true;
      }
      return changed ? next : prev;
    });
  }, [expertiseChoices, proficientSkills, existingExpertise]);

  useEffect(() => {
    if (!chosenFeatDetail) {
      setChosenFeatOptions({});
      setFeatSpellChoiceOptions({});
      return;
    }
  }, [chosenFeatDetail]);

  useEffect(() => {
    if (!chosenFeatDetail) {
      setFeatSpellChoiceOptions({});
      return;
    }
    let alive = true;
    if (featResolvedSpellChoices.length === 0) {
      setFeatSpellChoiceOptions({});
      return;
    }
    loadSpellChoiceOptions(featResolvedSpellChoices, (query) => api<SpellSummary[]>(query)).then((optionsByKey) => {
      if (alive) setFeatSpellChoiceOptions(optionsByKey);
    }).catch(() => {
      if (alive) setFeatSpellChoiceOptions({});
    });
    return () => { alive = false; };
  }, [chosenFeatDetail, featResolvedSpellChoices]);

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
      return sanitizeSpellChoiceSelections({
        currentSelections: next,
        spellListChoices: featSpellListChoices,
        resolvedSpellChoices: featResolvedSpellChoices,
        spellOptionsByKey: featSpellChoiceOptions,
      });
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
  const extraFeatSpellSelectionsValid = React.useMemo(
    () =>
      featSpellListChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count)
      && featResolvedSpellChoices.every((choice) => (chosenFeatOptions[choice.key] ?? []).length === choice.count),
    [chosenFeatOptions, featResolvedSpellChoices, featSpellListChoices]
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

  function rollHp() {
    const rolled = rollDiceExpr(`1d${hd}`);
    const total = Math.max(1, rolled + conMod);
    setRolledHp(total);
    setHpChoice("roll");
  }

  function toggleAsiPoint(key: string) {
    if (!asiMode || asiMode === "feat") return;
    const cap = asiMode === "+2" ? 2 : 1;
    const current = asiStats[key] ?? 0;
    setAsiStats((prev) => {
      const next = { ...prev };
      if (current >= cap) {
        delete next[key];
      } else if (asiTotal < 2) {
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

  const accentColor = "#38b6ff";

  return (
    <Wrap>
      {/* Header */}
      <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 24 }}>
        <button
          onClick={() => navigate(`/characters/${char.id}`)}
          style={{ background: "none", border: "none", cursor: "pointer", color: C.muted, fontSize: 20, padding: 0 }}
        >←</button>
        <div>
          <h1 style={{ margin: 0, fontSize: 20, fontWeight: 900, color: C.text }}>{char.name}</h1>
          <div style={{ fontSize: 13, color: accentColor, fontWeight: 700, marginTop: 2 }}>
            Level {char.level} → <span style={{ color: "#fff" }}>{nextLevel}</span>
            {classDetail && <span style={{ color: C.muted, fontWeight: 400 }}> · {classDetail.name}</span>}
          </div>
        </div>
      </div>

      {/* ── HP gain ── */}
      <Section title={`HP at Level ${nextLevel}`} accent={accentColor}>
        <div style={{ fontSize: 12, color: C.muted, marginBottom: 10 }}>
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
              ? <>🎲 Rolled — <strong>+{rolledHp}</strong> <span style={{ fontSize: 10, color: C.muted }}>(click to re-roll)</span></>
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
                fontSize: 14,
                fontWeight: 700,
                outline: "none",
              }}
            />
            <div style={{ fontSize: 12, color: C.muted }}>
              Enter the final HP gained after applying Constitution.
            </div>
          </div>
        )}
        {hpGain !== null && (
          <div style={{ marginTop: 10, fontSize: 13, color: C.muted }}>
            New HP max: <span style={{ color: "#fff", fontWeight: 700 }}>{char.hpMax} + {hpGain}{featHpBonus > 0 ? ` + ${featHpBonus}` : ""} = {char.hpMax + hpGain + featHpBonus}</span>
          </div>
        )}
      </Section>

      {/* ── ASI ── */}
      {isAsiLevel && (
        <Section title="Ability Score Improvement" accent={accentColor}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            +2 to one ability score, +1 to two different scores, or take a feat.
          </div>

          {/* Mode selection */}
          <div style={{ display: "flex", gap: 8, marginBottom: 14, flexWrap: "wrap" }}>
            {(["+2", "+1+1", "feat"] as const).map((m) => (
              <ChoiceBtn
                key={m}
                active={asiMode === m}
                onClick={() => { clearAsi(); setAsiMode(m); }}
              >
                {m === "+2" ? "+2 to one" : m === "+1+1" ? "+1 / +1" : "Take a Feat"}
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
                    <div style={{ fontSize: 10, color: C.muted, marginBottom: 2 }}>{ABILITY_LABELS[k]}</div>
                    <div style={{ fontSize: 17, fontWeight: 900 }}>
                      {preview}
                      {selected && <span style={{ fontSize: 11, color: accentColor }}> +{delta}</span>}
                    </div>
                    <div style={{ fontSize: 10, color: C.muted }}>{formatModifier(abilityMod(preview))}</div>
                    {maxed && <div style={{ fontSize: 9, color: C.muted }}>MAX</div>}
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

      {needsSubclassChoice && (
        <Section title={`Subclass at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ fontSize: 12, color: C.muted, marginBottom: 12 }}>
            Choose your subclass.
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8 }}>
            {subclassOptions.map((option) => (
              <ChoiceBtn key={option} active={subclass === option} onClick={() => setSubclass(option)}>
                {option}
              </ChoiceBtn>
            ))}
          </div>
        </Section>
      )}

      {(cantripCount > 0 || prepCount > 0 || invocCount > 0 || featSpellListChoices.length > 0 || featResolvedSpellChoices.length > 0) && (
        <Section title={`Spell Choices at Level ${nextLevel}`} accent={accentColor}>
          <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
            {cantripCount > 0 && (
              <SpellChoiceList
                title="Cantrips"
                caption={`Choose ${cantripCount}`}
                spells={classCantrips}
                chosen={chosenCantrips}
                max={cantripCount}
                onToggle={(id) => toggleSelection(id, chosenCantrips, setChosenCantrips, cantripCount)}
              />
            )}
            {spellcaster && prepCount > 0 && (
              <SpellChoiceList
                title="Prepared Spells"
                caption={`Choose ${prepCount} (up to level ${maxSpellLevel})`}
                spells={classSpells.filter((spell) => Number(spell.level ?? 0) > 0 && Number(spell.level ?? 0) <= maxSpellLevel)}
                chosen={chosenSpells}
                max={prepCount}
                onToggle={(id) => toggleSelection(id, chosenSpells, setChosenSpells, prepCount)}
              />
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
                    <div style={{ fontSize: 14, fontWeight: 800, color: "#fff" }}>{choice.title}</div>
                    <div style={{ fontSize: 12, color: selected.length >= choice.count ? accentColor : C.muted }}>
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
                  {choice.note && <div style={{ marginTop: 8, fontSize: 11, color: C.muted }}>{choice.note}</div>}
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
            {featResolvedSpellChoices.some((choice) => (featSpellChoiceOptions[choice.key] ?? []).length === 0) && (
              <div style={{ fontSize: 11, color: C.muted }}>
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
                      color: C.text, fontWeight: 700, fontSize: 13, textAlign: "left",
                    }}
                  >
                    <span>{f.name}</span>
                    <span style={{ color: C.muted, fontSize: 12 }}>{expanded ? "▲" : "▼"}</span>
                  </button>
                  {expanded && (
                    <div style={{
                      padding: "0 12px 12px", fontSize: 12, color: C.muted, lineHeight: 1.6,
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
                  <div style={{ fontSize: 10, color: C.muted }}>{SLOT_LABELS[i] ?? `L${i}`}</div>
                  <div style={{ fontWeight: 800, fontSize: 16, color: accentColor }}>{count}</div>
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
            padding: "12px 20px", borderRadius: 10, cursor: "pointer", fontSize: 14, fontWeight: 600,
            background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.12)", color: C.muted,
          }}
        >Cancel</button>
        <button
          onClick={confirm}
          disabled={!canConfirm || !extraFeatSpellSelectionsValid || saving}
          style={{
            flex: 1, padding: "12px 20px", borderRadius: 10, cursor: canConfirm && !saving ? "pointer" : "not-allowed",
            fontSize: 14, fontWeight: 800, border: "none",
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
