import type { AbilKey, GrantedSpellCast, ResourceCounter, TaggedItem } from "@/views/character/CharacterSheetTypes";
import { normalizeLanguageName, normalizeResourceKey, proficiencyBonus } from "@/views/character/CharacterSheetUtils";
import {
  createFeatureEffectId,
  type AbilityScoreEffect,
  type ArmorClassEffect,
  type DefenseEffect,
  type HitPointEffect,
  type ModifierEffect,
  type SensesEffect,
  type SpeedEffect,
  type FeatureEffect,
  type FeatureEffectSource,
  type ParsedFeatureEffects,
  type ProficiencyGrantEffect,
  type ScalingValue,
  type SpellGrantEffect,
  type WeaponMasteryEffect,
} from "@/domain/character/featureEffects";

export interface ParseFeatureEffectsInput {
  source: FeatureEffectSource;
  text: string;
}

interface ScalingResolutionContext {
  scores?: Partial<Record<AbilKey, number | null>>;
  level?: number | null;
}

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase());
}

function parseWordCount(value: string): number | null {
  const normalized = String(value ?? "").trim().toLowerCase();
  const direct = Number.parseInt(normalized, 10);
  if (Number.isFinite(direct)) return direct;
  const words: Record<string, number> = {
    once: 1,
    one: 1,
    twice: 2,
    two: 2,
    three: 3,
    four: 4,
    five: 5,
    six: 6,
  };
  return words[normalized] ?? null;
}

function cleanupText(text: string): string {
  return String(text ?? "")
    .replace(/Source:.*$/gim, "")
    .replace(/\s+/g, " ")
    .trim();
}

function parseSpellGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (!/without expending a spell slot/i.test(text)) return;
  const spellMatch = text.match(/you can cast\s+([A-Z][A-Za-z' -]+?)\s+without expending a spell slot/i);
  if (!spellMatch) return;

  const spellName = spellMatch[1].replace(/\s+on yourself$/i, "").trim();
  const reset =
    /finish a short rest/i.test(text) ? "short_rest"
    : /finish a long rest/i.test(text) ? "long_rest"
    : /finish a short or long rest/i.test(text) ? "short_or_long_rest"
    : undefined;
  const abilityCountMatch = text.match(/a number of times equal to your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+modifier\s*\(minimum of once\)/i);
  const fixedCountMatch = text.match(/\b(once|twice|one|two|three|four|five|six)\b[^.]*without expending a spell slot/i);

  if (abilityCountMatch && reset) {
    const ability = abilityCountMatch[1].trim().toLowerCase().slice(0, 3) as AbilKey;
    const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
    effects.push({
      id: createFeatureEffectId(source, "spell_grant", effects.length),
      type: "spell_grant",
      source,
      spellName,
      mode: "free_cast",
      uses: { kind: "ability_mod", ability, min: 1 },
      reset,
      castsWithoutSlot: true,
      resourceKey,
      summary: `${spellName} free cast keyed off ${ability.toUpperCase()} modifier`,
    } satisfies SpellGrantEffect);
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label: `${spellName} (${source.name})`,
      max: { kind: "ability_mod", ability, min: 1 },
      reset,
      restoreAmount: "all",
      linkedSpellName: spellName,
      summary: `${spellName} resource pool`,
    });
    return;
  }

  if (fixedCountMatch && reset) {
    const max = parseWordCount(fixedCountMatch[1]) ?? 1;
    const resourceKey = normalizeResourceKey(`${source.name}:${spellName}`);
    effects.push({
      id: createFeatureEffectId(source, "spell_grant", effects.length),
      type: "spell_grant",
      source,
      spellName,
      mode: "free_cast",
      uses: { kind: "fixed", value: max },
      reset,
      castsWithoutSlot: true,
      resourceKey,
      summary: `${spellName} fixed free casts`,
    } satisfies SpellGrantEffect);
    effects.push({
      id: createFeatureEffectId(source, "resource_grant", effects.length),
      type: "resource_grant",
      source,
      resourceKey,
      label: `${spellName} (${source.name})`,
      max: { kind: "fixed", value: max },
      reset,
      restoreAmount: "all",
      linkedSpellName: spellName,
      summary: `${spellName} resource pool`,
    });
    return;
  }

  effects.push({
    id: createFeatureEffectId(source, "spell_grant", effects.length),
    type: "spell_grant",
    source,
    spellName,
    mode: "at_will",
    castsWithoutSlot: true,
    summary: `${spellName} at will`,
  } satisfies SpellGrantEffect);
}

function parseProficiencyGrantEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const armor: string[] = [];
  const weapons: string[] = [];
  const tools: string[] = [];
  const skills: string[] = [];
  const languages = new Set<string>();

  const armorRe = /(?:training with|proficiency with)\s+([\w\s,]+?)\s+armor\b/gi;
  let m: RegExpExecArray | null;
  while ((m = armorRe.exec(text)) !== null) {
    m[1]
      .split(/\s+and\s+|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => armor.push(/^all$/i.test(s) ? "All Armor" : `${toTitleCase(s)} Armor`));
  }

  const weaponRe = /proficiency with\s+([\w\s,]+?)\s+weapons\b/gi;
  while ((m = weaponRe.exec(text)) !== null) {
    m[1]
      .split(/\s+and\s+|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => weapons.push(`${toTitleCase(s)} Weapons`));
  }

  const toolRe = /proficiency with\s+([\w\s']+?(?:tools?|kit|instruments?|supplies))\b/gi;
  while ((m = toolRe.exec(text)) !== null) {
    tools.push(toTitleCase(m[1].trim()));
  }

  const skillRe = /proficiency in\s+([\w\s]+?)(?:\.|,|\band\b|$)/gi;
  while ((m = skillRe.exec(text)) !== null) {
    skills.push(toTitleCase(m[1].trim()));
  }

  const langRe = /(?:learn|speak|know|understand)\s+(?:the\s+)?([\w]+)\s+language/gi;
  while ((m = langRe.exec(text)) !== null) {
    languages.add(normalizeLanguageName(toTitleCase(m[1])));
  }
  if (/know\s+thieves' cant/i.test(text)) languages.add("Thieves' Cant");

  const byCategory = [
    { category: "armor", values: armor },
    { category: "weapon", values: weapons },
    { category: "tool", values: tools },
    { category: "skill", values: skills },
    { category: "language", values: Array.from(languages) },
  ] as const;

  for (const { category, values } of byCategory) {
    if (values.length === 0) continue;
    effects.push({
      id: createFeatureEffectId(source, "proficiency_grant", effects.length),
      type: "proficiency_grant",
      source,
      category,
      grants: Array.from(new Set(values)),
    } satisfies ProficiencyGrantEffect);
  }
}

function parseWeaponMasteryEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const normalizedName = source.name.trim();
  if (!/weapon mastery/i.test(normalizedName) && !/mastery properties of/i.test(text)) return;

  const countMatch =
    text.match(/mastery properties of\s+(\w+)\s+kinds? of/i)
    ?? text.match(/mastery properties of\s+(\d+)\s+kinds? of/i);
  const count = parseWordCount(countMatch?.[1] ?? "") ?? 0;
  const filters: WeaponMasteryEffect["choice"] extends infer T ? T extends { filters?: infer F } ? F : never : never = [];
  if (/simple/i.test(text)) filters.push("simple_weapon");
  if (/martial/i.test(text)) filters.push("martial_weapon");
  if (/melee/i.test(text)) filters.push("melee_weapon");

  if (count > 0) {
    effects.push({
      id: createFeatureEffectId(source, "weapon_mastery", effects.length),
      type: "weapon_mastery",
      source,
      choice: {
        count: { kind: "fixed", value: count },
        optionCategory: "weapon_mastery",
        filters,
        canReplaceOnReset: /finish a long rest/i.test(text) ? "long_rest" : undefined,
      },
      summary: `Choose ${count} weapon masteries`,
    } satisfies WeaponMasteryEffect);
  }
}

function parseDefenseEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const addDamageDefense = (mode: DefenseEffect["mode"], rawTargets: string) => {
    const lower = rawTargets.toLowerCase();
    const targets = [
      "acid", "cold", "fire", "force", "lightning", "necrotic",
      "piercing", "poison", "psychic", "radiant", "slashing", "thunder", "bludgeoning",
    ].filter((damageType) => new RegExp(`\\b${damageType}\\b`, "i").test(lower))
      .map(toTitleCase);
    if (targets.length === 0 && /nonmagical/i.test(lower) && /bludgeoning|piercing|slashing/i.test(lower)) {
      targets.push("Nonmagical B/P/S");
    }
    if (targets.length === 0) return;
    effects.push({
      id: createFeatureEffectId(source, "defense", effects.length),
      type: "defense",
      source,
      mode,
      targets,
    } satisfies DefenseEffect);
  };

  for (const match of text.matchAll(/(?:have |gain )?resistance to ([^.;]+?) damage/gi)) {
    addDamageDefense("damage_resistance", match[1]);
  }
  for (const match of text.matchAll(/immune to ([^.;]+?) damage/gi)) {
    addDamageDefense("damage_immunity", match[1]);
  }

  const conditionImmunityMatch = text.match(/immunity to the ([A-Za-z,\s]+?) conditions?/i);
  if (conditionImmunityMatch) {
    const targets = conditionImmunityMatch[1]
      .split(/\s+and\s+|,/)
      .map((part) => part.trim())
      .filter(Boolean)
      .map(toTitleCase);
    if (targets.length > 0) {
      effects.push({
        id: createFeatureEffectId(source, "defense", effects.length),
        type: "defense",
        source,
        mode: "condition_immunity",
        targets,
      } satisfies DefenseEffect);
    }
  }
}

function parseSpeedEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const bonusMatch = text.match(/your speed increases by (\d+) feet/i);
  if (bonusMatch) {
    effects.push({
      id: createFeatureEffectId(source, "speed", effects.length),
      type: "speed",
      source,
      mode: "bonus",
      amount: { kind: "fixed", value: Number(bonusMatch[1]) },
      gate: /while you aren't wearing heavy armor/i.test(text)
        ? { duration: "passive", armorState: "not_heavy" }
        : undefined,
    } satisfies SpeedEffect);
  }

  for (const match of text.matchAll(/you have a (Fly|Swim|Climb|Burrow) Speed equal to your Speed/gi)) {
    effects.push({
      id: createFeatureEffectId(source, "speed", effects.length),
      type: "speed",
      source,
      mode: "grant_mode",
      movementMode: match[1].trim().toLowerCase() as SpeedEffect["movementMode"],
      amount: { kind: "named_progression", key: "equal_to_speed" },
    } satisfies SpeedEffect);
  }
}

function parseArmorClassEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const unarmoredMatch = text.match(/base Armor Class equals 10 plus your ([A-Za-z]+) and ([A-Za-z]+) modifiers/i);
  if (unarmoredMatch) {
    const first = unarmoredMatch[1].trim().toLowerCase().slice(0, 3) as AbilKey;
    const second = unarmoredMatch[2].trim().toLowerCase().slice(0, 3) as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "armor_class", effects.length),
      type: "armor_class",
      source,
      mode: "base_formula",
      base: 10,
      abilities: [first, second],
      gate: {
        duration: "while_unarmored",
        shieldAllowed: /shield and still gain this benefit/i.test(text),
      },
    } satisfies ArmorClassEffect);
    return;
  }

  const floorMatch = text.match(/your AC equals (\d+) plus your ([A-Za-z]+) modifier if that total is higher than the Beast's AC/i);
  if (floorMatch) {
    effects.push({
      id: createFeatureEffectId(source, "armor_class", effects.length),
      type: "armor_class",
      source,
      mode: "minimum_floor",
      base: Number(floorMatch[1]),
      abilities: [floorMatch[2].trim().toLowerCase().slice(0, 3) as AbilKey],
      gate: { duration: "while_wild_shaped" },
    } satisfies ArmorClassEffect);
  }
}

const ABILITY_NAME_MAP: Record<string, AbilKey> = {
  strength: "str", dexterity: "dex", constitution: "con",
  intelligence: "int", wisdom: "wis", charisma: "cha",
};

function parseAbilityScoreEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  // "Increase one ability score by 2, or choose two ability scores and increase each by 1"
  const asiMatch = text.match(
    /increase one (?:of your )?ability scores? by (\d+),? or (?:choose two (?:different )?ability scores? and increase each|increase two (?:of your )?ability scores?) by (\d+)/i,
  );
  if (asiMatch) {
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 1, amount: Number(asiMatch[1]),
      summary: `+${asiMatch[1]} to one ability score`,
    } satisfies AbilityScoreEffect);
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 2, amount: Number(asiMatch[2]),
      summary: `+${asiMatch[2]} to two ability scores`,
    } satisfies AbilityScoreEffect);
    return;
  }

  // "Increase one of your ability scores by N" (single free-choice)
  const freeMatch = text.match(/increase one (?:of your )?ability scores? by (\d+)/i);
  if (freeMatch) {
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      choiceCount: 1, amount: Number(freeMatch[1]),
      summary: `+${freeMatch[1]} to one ability score`,
    } satisfies AbilityScoreEffect);
    return;
  }

  // "your Strength or Dexterity score increases by N" (two-choice restricted)
  const twoChoiceMatch = text.match(
    /your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+or\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score increases? by (\d+)/i,
  );
  if (twoChoiceMatch) {
    const a = ABILITY_NAME_MAP[twoChoiceMatch[1].toLowerCase()] as AbilKey;
    const b = ABILITY_NAME_MAP[twoChoiceMatch[2].toLowerCase()] as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "choice",
      chooseFrom: [a, b], choiceCount: 1, amount: Number(twoChoiceMatch[3]),
      summary: `+${twoChoiceMatch[3]} to ${a.toUpperCase()} or ${b.toUpperCase()}`,
    } satisfies AbilityScoreEffect);
    return;
  }

  // "your Charisma score increases by 1" (fixed, may repeat for multiple abilities)
  for (const match of text.matchAll(/your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+score increases? by (\d+)/gi)) {
    const ability = ABILITY_NAME_MAP[match[1].toLowerCase()] as AbilKey;
    effects.push({
      id: createFeatureEffectId(source, "ability_score", effects.length),
      type: "ability_score", source, mode: "fixed",
      ability, choiceCount: 1, amount: Number(match[2]),
      summary: `+${match[2]} ${ability.toUpperCase()}`,
    } satisfies AbilityScoreEffect);
  }
}

function parseHitPointBonusEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (/hit point maximum increases by twice your (?:character )?level/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "hit_points", effects.length),
      type: "hit_points", source, mode: "max_bonus",
      amount: { kind: "character_level", multiplier: 2 },
      summary: "+2 max HP per character level",
    } satisfies HitPointEffect);
    return;
  }

  const fixedMatch = text.match(/hit point maximum increases by (\d+)/i);
  if (fixedMatch) {
    effects.push({
      id: createFeatureEffectId(source, "hit_points", effects.length),
      type: "hit_points", source, mode: "max_bonus",
      amount: { kind: "fixed", value: Number(fixedMatch[1]) },
      summary: `+${fixedMatch[1]} max HP`,
    } satisfies HitPointEffect);
  }
}

function parseInitiativeModifierEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  if (/add your Proficiency Bonus to (?:your )?(?:the )?Initiative/i.test(text)) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier", source,
      target: "initiative", mode: "bonus",
      amount: { kind: "proficiency_bonus" },
      summary: "Add Proficiency Bonus to Initiative",
    } satisfies ModifierEffect);
  }
}

function parseArmorClassBonusEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  // "+1 bonus to AC while wearing armor" — Defense fighting style
  const armorBonusMatch = text.match(/\+(\d+)\s+bonus to (?:your\s+)?(?:Armor Class|AC)\s+while (?:you are )?wearing armor/i);
  if (armorBonusMatch) {
    effects.push({
      id: createFeatureEffectId(source, "armor_class", effects.length),
      type: "armor_class", source, mode: "bonus",
      bonus: { kind: "fixed", value: Number(armorBonusMatch[1]) },
      gate: { duration: "passive", armorState: "not_unarmored" },
      summary: `+${armorBonusMatch[1]} AC while wearing armor`,
    } satisfies ArmorClassEffect);
    return;
  }

  // Generic "+N to AC / Armor Class"
  const genericMatch = text.match(/\+(\d+)\s+(?:bonus\s+)?to (?:your\s+)?(?:Armor Class|AC)\b/i);
  if (genericMatch) {
    effects.push({
      id: createFeatureEffectId(source, "armor_class", effects.length),
      type: "armor_class", source, mode: "bonus",
      bonus: { kind: "fixed", value: Number(genericMatch[1]) },
      summary: `+${genericMatch[1]} AC`,
    } satisfies ArmorClassEffect);
  }
}

function parseSensesEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  const kindMap: Record<string, SensesEffect["senses"][number]["kind"]> = {
    darkvision: "darkvision", blindsight: "blindsight",
    tremorsense: "tremorsense", truesight: "truesight",
  };
  const senses: SensesEffect["senses"] = [];

  const re = /\b(Darkvision|Blindsight|Tremorsense|Truesight)\b[^.]*?(?:out to|with a range of|range of|up to)?\s*(\d+)\s*feet/gi;
  for (const match of text.matchAll(re)) {
    const kind = kindMap[match[1].toLowerCase()];
    const range = Number(match[2]);
    if (!kind || !range) continue;
    const existing = senses.find((s) => s.kind === kind);
    if (existing) { if (range > existing.range) existing.range = range; }
    else senses.push({ kind, range });
  }

  if (senses.length > 0) {
    effects.push({
      id: createFeatureEffectId(source, "senses", effects.length),
      type: "senses", source, mode: "grant", senses,
      summary: senses.map((s) => `${s.kind} ${s.range}ft`).join(", "),
    } satisfies SensesEffect);
  }
}

function parsePassiveScoreEffects(source: FeatureEffectSource, text: string, effects: FeatureEffect[]) {
  // "+5 to your passive Wisdom (Perception)" — Observant
  const passiveMatch = text.match(/\+(\d+)(?:\s+bonus)?\s+to (?:your\s+)?passive\s+\w/i);
  if (passiveMatch) {
    effects.push({
      id: createFeatureEffectId(source, "modifier", effects.length),
      type: "modifier", source,
      target: "passive_score", mode: "bonus",
      amount: { kind: "fixed", value: Number(passiveMatch[1]) },
      summary: `+${passiveMatch[1]} to passive scores`,
    } satisfies ModifierEffect);
  }
}

export function parseFeatureEffects(input: ParseFeatureEffectsInput): ParsedFeatureEffects {
  const cleanText = cleanupText(input.text);
  const source: FeatureEffectSource = { ...input.source, text: cleanText };
  const effects: FeatureEffect[] = [];

  if (cleanText) {
    parseAbilityScoreEffects(source, cleanText, effects);
    parseSpellGrantEffects(source, cleanText, effects);
    parseProficiencyGrantEffects(source, cleanText, effects);
    parseWeaponMasteryEffects(source, cleanText, effects);
    parseDefenseEffects(source, cleanText, effects);
    parseSpeedEffects(source, cleanText, effects);
    parseArmorClassEffects(source, cleanText, effects);
    parseArmorClassBonusEffects(source, cleanText, effects);
    parseHitPointBonusEffects(source, cleanText, effects);
    parseInitiativeModifierEffects(source, cleanText, effects);
    parseSensesEffects(source, cleanText, effects);
    parsePassiveScoreEffects(source, cleanText, effects);
  }

  return { source, effects };
}

export function buildGrantedSpellDataFromEffects(
  parsed: ParsedFeatureEffects[],
  scores: Record<AbilKey, number | null>,
): { spells: GrantedSpellCast[]; resources: ResourceCounter[] } {
  const spells: GrantedSpellCast[] = [];
  const resources: ResourceCounter[] = [];

  const resolveScalingValue = (value: ScalingValue | undefined): number | null =>
    resolveScalingValueInContext(value, { scores });

  const resourceByKey = new Map<string, ResourceCounter>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "resource_grant") {
        const max = resolveScalingValue(effect.max);
        if (max == null) continue;
        const reset =
          effect.reset === "short_rest" ? "S"
          : effect.reset === "long_rest" ? "L"
          : effect.reset === "short_or_long_rest" ? "SL"
          : "L";
        resourceByKey.set(effect.resourceKey, {
          key: effect.resourceKey,
          name: effect.label,
          current: max,
          max,
          reset,
        });
      }
    }
  }

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "spell_grant") continue;
      if (effect.mode === "free_cast" && effect.resourceKey) {
        const resource = resourceByKey.get(effect.resourceKey);
        if (!resource) continue;
        spells.push({
          key: `granted-spell:${effect.resourceKey}`,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "limited",
          note: `Free cast ${resource.max} time${resource.max === 1 ? "" : "s"} per ${resource.reset === "S" ? "Short Rest" : resource.reset === "SL" ? "Short or Long Rest" : "Long Rest"}. No spell slot required.`,
          resourceKey: effect.resourceKey,
          reset: resource.reset,
        });
        continue;
      }

      if (effect.mode === "at_will") {
        spells.push({
          key: effect.id,
          spellName: effect.spellName,
          sourceName: effect.source.name,
          mode: "at_will",
          note: "",
        });
      }
    }
  }

  return { spells, resources: Array.from(resourceByKey.values()) };
}

function clampScalingValue(value: number, scaling: Extract<ScalingValue, { min?: number; max?: number }>): number {
  const withMin = scaling.min != null ? Math.max(scaling.min, value) : value;
  return scaling.max != null ? Math.min(scaling.max, withMin) : withMin;
}

function resolveScalingValueInContext(value: ScalingValue | undefined, context: ScalingResolutionContext): number | null {
  if (!value) return null;
  if (value.kind === "fixed") return value.value;
  if (value.kind === "ability_mod") {
    const score = context.scores?.[value.ability] ?? 10;
    const mod = Math.floor((score - 10) / 2);
    return clampScalingValue(mod, value);
  }
  if (value.kind === "proficiency_bonus") {
    if (context.level == null) return null;
    const total = proficiencyBonus(context.level) * (value.multiplier ?? 1);
    return clampScalingValue(total, value);
  }
  if (value.kind === "character_level") {
    if (context.level == null) return null;
    const total = context.level * (value.multiplier ?? 1);
    return clampScalingValue(total, value);
  }
  if (value.kind === "half_character_level") {
    if (context.level == null) return null;
    const raw = context.level / 2;
    const total = value.round === "up" ? Math.ceil(raw) : Math.floor(raw);
    return clampScalingValue(total, value);
  }
  return null;
}

export function collectTaggedGrantsFromEffects(parsed: ParsedFeatureEffects[]): {
  armor: TaggedItem[];
  weapons: TaggedItem[];
  tools: TaggedItem[];
  skills: TaggedItem[];
  languages: TaggedItem[];
  masteries: TaggedItem[];
} {
  const result = {
    armor: [] as TaggedItem[],
    weapons: [] as TaggedItem[],
    tools: [] as TaggedItem[],
    skills: [] as TaggedItem[],
    languages: [] as TaggedItem[],
    masteries: [] as TaggedItem[],
  };

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type === "proficiency_grant" && effect.grants?.length) {
        const target =
          effect.category === "armor" ? result.armor
          : effect.category === "weapon" ? result.weapons
          : effect.category === "tool" ? result.tools
          : effect.category === "skill" ? result.skills
          : effect.category === "language" ? result.languages
          : null;
        if (!target) continue;
        for (const name of effect.grants) target.push({ name, source: effect.source.name });
      }
      if (effect.type === "weapon_mastery" && effect.grants?.length) {
        for (const name of effect.grants) result.masteries.push({ name, source: effect.source.name });
      }
    }
  }

  return result;
}

export function collectDefensesFromEffects(parsed: ParsedFeatureEffects[]): {
  resistances: string[];
  immunities: string[];
} {
  const resistances = new Set<string>();
  const immunities = new Set<string>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "defense") continue;
      if (effect.mode === "damage_resistance") {
        effect.targets.forEach((target) => resistances.add(target));
      }
      if (effect.mode === "damage_immunity" || effect.mode === "condition_immunity") {
        effect.targets.forEach((target) => immunities.add(target));
      }
    }
  }

  return {
    resistances: Array.from(resistances),
    immunities: Array.from(immunities),
  };
}

export function deriveSpeedBonusFromEffects(parsed: ParsedFeatureEffects[], opts?: { armorState?: "any" | "no_armor" | "not_heavy" }): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "speed" || effect.mode !== "bonus") continue;
      const gateArmorState = effect.gate?.armorState ?? "any";
      if (gateArmorState !== "any" && opts?.armorState !== gateArmorState) continue;
      if (effect.amount?.kind === "fixed") total += effect.amount.value;
    }
  }
  return total;
}

export function deriveArmorClassBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: { armorEquipped?: boolean; level?: number | null; scores?: Partial<Record<AbilKey, number | null>> }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "armor_class" || effect.mode !== "bonus") continue;
      const gateArmorState = effect.gate?.armorState ?? "any";
      if (gateArmorState === "not_unarmored" && !opts?.armorEquipped) continue;
      if (gateArmorState === "no_armor" && opts?.armorEquipped) continue;
      const resolved = resolveScalingValueInContext(effect.bonus, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function deriveHitPointMaxBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  opts?: { level?: number | null; scores?: Partial<Record<AbilKey, number | null>> }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "hit_points" || effect.mode !== "max_bonus") continue;
      if (
        !("kind" in effect.amount)
        || effect.amount.kind === "per_scalar"
        || ("dice" in effect.amount)
      ) continue;
      const resolved = resolveScalingValueInContext(effect.amount, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function deriveModifierBonusFromEffects(
  parsed: ParsedFeatureEffects[],
  target: ModifierEffect["target"],
  opts?: { level?: number | null; scores?: Partial<Record<AbilKey, number | null>> }
): number {
  let total = 0;
  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "modifier" || effect.target !== target || effect.mode !== "bonus") continue;
      const resolved = resolveScalingValueInContext(effect.amount, { level: opts?.level, scores: opts?.scores });
      if (resolved != null) total += resolved;
    }
  }
  return total;
}

export function collectSensesFromEffects(parsed: ParsedFeatureEffects[]): Array<{ kind: SensesEffect["senses"][number]["kind"]; range: number }> {
  const bestByKind = new Map<SensesEffect["senses"][number]["kind"], number>();

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "senses" || effect.mode !== "grant") continue;
      for (const sense of effect.senses) {
        const current = bestByKind.get(sense.kind) ?? 0;
        if (sense.range > current) bestByKind.set(sense.kind, sense.range);
      }
    }
  }

  return Array.from(bestByKind.entries()).map(([kind, range]) => ({ kind, range }));
}

export function deriveUnarmoredDefenseFromEffects(
  parsed: ParsedFeatureEffects[],
  scores: Record<AbilKey, number | null>,
  opts: { armorEquipped: boolean; shieldEquipped: boolean }
): number | null {
  if (opts.armorEquipped) return null;
  let best: number | null = null;

  for (const parsedFeature of parsed) {
    for (const effect of parsedFeature.effects) {
      if (effect.type !== "armor_class" || effect.mode !== "base_formula" || effect.base == null || !effect.abilities?.length) continue;
      if (effect.gate?.duration === "while_unarmored" && opts.armorEquipped) continue;
      if (opts.shieldEquipped && effect.gate?.shieldAllowed === false) continue;
      const total = effect.base + effect.abilities.reduce((sum, ability) => {
        const score = scores[ability] ?? 10;
        return sum + Math.floor((score - 10) / 2);
      }, 0);
      best = best == null ? total : Math.max(best, total);
    }
  }

  return best;
}
