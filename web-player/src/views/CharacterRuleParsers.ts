import type { AbilKey, GrantedSpellCast, ResourceCounter } from "@/views/CharacterSheetTypes";
import { abilityMod, normalizeLanguageName, normalizeResourceKey } from "@/views/CharacterSheetUtils";

export interface FeatureGrants {
  armor: string[];
  weapons: string[];
  tools: string[];
  skills: string[];
  languages: string[];
}

export interface ClassLanguageChoice {
  fixed: string[];
  choose: number;
  from: string[] | null;
  source: string;
}

export interface SpellGrantSource {
  name: string;
  text: string;
}

interface ClassLanguageFeature {
  optional?: boolean;
  text?: string;
  name?: string;
}

interface ClassLanguageAutolevel {
  level: number | null;
  features: ClassLanguageFeature[];
}

interface ClassLanguageDetailLike {
  name: string;
  autolevels: ClassLanguageAutolevel[];
}

interface RaceTraitLike {
  name: string;
}

interface RaceLanguageDetailLike {
  traits?: RaceTraitLike[] | null;
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

function abilityModFromScores(scores: Record<AbilKey, number | null>, abilityName: string): number {
  const key = abilityName.trim().toLowerCase().slice(0, 3) as AbilKey;
  return abilityMod(scores[key]);
}

export function parseFeatureGrants(text: string): FeatureGrants {
  const result: FeatureGrants = { armor: [], weapons: [], tools: [], skills: [], languages: [] };
  const t = text.replace(/Source:.*$/gim, "").replace(/\n/g, " ");

  const armorRe = /(?:training with|proficiency with)\s+([\w\s,]+?)\s+armor\b/gi;
  let m: RegExpExecArray | null;
  while ((m = armorRe.exec(t)) !== null) {
    m[1]
      .split(/\s+and\s+|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => {
        if (!/^all$/i.test(s)) result.armor.push(`${toTitleCase(s)} Armor`);
        else result.armor.push("All Armor");
      });
  }

  const weapRe = /proficiency with\s+([\w\s,]+?)\s+weapons\b/gi;
  while ((m = weapRe.exec(t)) !== null) {
    m[1]
      .split(/\s+and\s+|,/)
      .map((s) => s.trim())
      .filter(Boolean)
      .forEach((s) => result.weapons.push(`${toTitleCase(s)} Weapons`));
  }

  const toolRe = /proficiency with\s+([\w\s']+?(?:tools?|kit|instruments?|supplies))\b/gi;
  while ((m = toolRe.exec(t)) !== null) {
    result.tools.push(toTitleCase(m[1].trim()));
  }

  const skillRe = /proficiency in\s+([\w\s]+?)(?:\.|,|\band\b|$)/gi;
  while ((m = skillRe.exec(t)) !== null) {
    result.skills.push(toTitleCase(m[1].trim()));
  }

  const langRe = /(?:learn|speak|know|understand)\s+(?:the\s+)?([\w]+)\s+language/gi;
  while ((m = langRe.exec(t)) !== null) {
    result.languages.push(normalizeLanguageName(toTitleCase(m[1])));
  }
  if (/know\s+thieves' cant/i.test(t)) result.languages.push("Thieves' Cant");

  return result;
}

export function getClassLanguageChoice(
  classDetail: ClassLanguageDetailLike | null,
  level: number,
  allLanguages: string[],
): ClassLanguageChoice | null {
  if (!classDetail) return null;
  const fixed = new Set<string>();
  let choose = 0;
  let source = classDetail.name;
  for (const al of classDetail.autolevels) {
    if (al.level == null || al.level > level) continue;
    for (const feature of al.features) {
      if (feature.optional) continue;
      const text = String(feature.text ?? "");
      if (/know\s+thieves' cant/i.test(text)) {
        fixed.add("Thieves' Cant");
        source = String(feature.name ?? source);
      }
      if (/one\s+other\s+language\s+of\s+your\s+choice/i.test(text) || /one\s+language\s+of\s+your\s+choice/i.test(text)) {
        choose = Math.max(choose, 1);
        source = String(feature.name ?? source);
      }
    }
  }
  if (fixed.size === 0 && choose === 0) return null;
  return { fixed: [...fixed], choose, from: allLanguages, source };
}

export function getCoreLanguageChoice(
  raceDetail: RaceLanguageDetailLike | null,
  standardLanguages: string[],
) {
  const hasExplicitLanguageTrait = (raceDetail?.traits ?? []).some((t) => /^languages?$/i.test(t.name));
  if (hasExplicitLanguageTrait) return null;
  return {
    fixed: ["Common"],
    choose: 2,
    from: standardLanguages,
    source: "Core Rules",
  };
}

export function buildGrantedSpellData(
  sources: SpellGrantSource[],
  scores: Record<AbilKey, number | null>,
): { spells: GrantedSpellCast[]; resources: ResourceCounter[] } {
  const spells: GrantedSpellCast[] = [];
  const resources: ResourceCounter[] = [];

  for (const source of sources) {
    const sourceName = String(source.name ?? "").trim();
    const text = String(source.text ?? "")
      .replace(/Source:.*$/gim, "")
      .replace(/\s+/g, " ")
      .trim();
    if (!sourceName || !text || !/without expending a spell slot/i.test(text)) continue;

    const spellMatch = text.match(/you can cast\s+([A-Z][A-Za-z' -]+?)\s+without expending a spell slot/i);
    if (!spellMatch) continue;

    const spellName = spellMatch[1].replace(/\s+on yourself$/i, "").trim();
    const reset = /finish a short rest/i.test(text) ? "S" : /finish a long rest/i.test(text) ? "L" : undefined;
    const abilityCountMatch = text.match(/a number of times equal to your\s+(Strength|Dexterity|Constitution|Intelligence|Wisdom|Charisma)\s+modifier\s*\(minimum of once\)/i);
    const fixedCountMatch = text.match(/\b(once|twice|one|two|three|four|five|six)\b[^.]*without expending a spell slot/i);

    if (abilityCountMatch && reset) {
      const max = Math.max(1, abilityModFromScores(scores, abilityCountMatch[1]));
      const resourceKey = normalizeResourceKey(`${sourceName}:${spellName}`);
      spells.push({
        key: `granted-spell:${resourceKey}`,
        spellName,
        sourceName,
        mode: "limited",
        note: `Free cast ${max} time${max === 1 ? "" : "s"} per ${reset === "S" ? "Short Rest" : "Long Rest"}. No spell slot required.`,
        resourceKey,
        reset,
      });
      resources.push({
        key: resourceKey,
        name: `${spellName} (${sourceName})`,
        current: max,
        max,
        reset,
      });
      continue;
    }

    if (fixedCountMatch && reset) {
      const max = parseWordCount(fixedCountMatch[1]) ?? 1;
      const resourceKey = normalizeResourceKey(`${sourceName}:${spellName}`);
      spells.push({
        key: `granted-spell:${resourceKey}`,
        spellName,
        sourceName,
        mode: "limited",
        note: `Free cast ${max} time${max === 1 ? "" : "s"} per ${reset === "S" ? "Short Rest" : "Long Rest"}. No spell slot required.`,
        resourceKey,
        reset,
      });
      resources.push({
        key: resourceKey,
        name: `${spellName} (${sourceName})`,
        current: max,
        max,
        reset,
      });
      continue;
    }

    spells.push({
      key: `granted-spell:${normalizeResourceKey(`${sourceName}:${spellName}`)}`,
      spellName,
      sourceName,
      mode: "at_will",
      note: "",
    });
  }

  return { spells, resources };
}
