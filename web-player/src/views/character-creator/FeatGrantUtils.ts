import { classifyFeatSelection } from "@/views/character-creator/CharacterCreatorUtils";

export interface FeatGrantTaggedEntry {
  name: string;
  source: string;
}

export interface FeatGrantChoiceLike {
  id: string;
  type: "proficiency" | "expertise" | "ability_score" | "spell" | "spell_list" | "weapon_mastery" | "damage_type";
  count?: number;
  options: unknown[] | null;
  anyOf?: string[];
  amount?: number | null;
  note?: string | null;
}

export interface FeatGrantDetailLike {
  name: string;
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
    };
    choices?: FeatGrantChoiceLike[];
  };
}

export interface FeatGrantCollections {
  skills: FeatGrantTaggedEntry[];
  tools: FeatGrantTaggedEntry[];
  languages: FeatGrantTaggedEntry[];
  armor: FeatGrantTaggedEntry[];
  weapons: FeatGrantTaggedEntry[];
  saves: FeatGrantTaggedEntry[];
  masteries: FeatGrantTaggedEntry[];
  spells: FeatGrantTaggedEntry[];
  expertise: FeatGrantTaggedEntry[];
}

export function collectFeatTaggedEntries(args: {
  feat: FeatGrantDetailLike;
  sourceLabel?: string;
  selectedChoices?: Record<string, string[]>;
  getChoiceKey?: (choice: FeatGrantChoiceLike) => string;
}): FeatGrantCollections {
  const { feat, selectedChoices = {}, getChoiceKey } = args;
  const source = args.sourceLabel ?? feat.name;
  const result: FeatGrantCollections = {
    skills: feat.parsed.grants.skills.map((name) => ({ name, source })),
    tools: feat.parsed.grants.tools.map((name) => ({ name, source })),
    languages: feat.parsed.grants.languages.map((name) => ({ name, source })),
    armor: feat.parsed.grants.armor.map((name) => ({ name, source })),
    weapons: feat.parsed.grants.weapons.map((name) => ({ name, source })),
    saves: feat.parsed.grants.savingThrows.map((name) => ({ name, source })),
    masteries: [],
    spells: [
      ...feat.parsed.grants.cantrips.map((name) => ({ name, source })),
      ...feat.parsed.grants.spells.map((name) => ({ name, source })),
    ],
    expertise: [],
  };

  for (const choice of feat.parsed.choices ?? []) {
    const selected = selectedChoices[getChoiceKey ? getChoiceKey(choice) : choice.id] ?? [];
    for (const name of selected) {
      const kind = classifyFeatSelection(choice, name);
      if (kind === "skill") result.skills.push({ name, source });
      else if (kind === "tool") result.tools.push({ name, source });
      else if (kind === "language") result.languages.push({ name, source });
      else if (kind === "armor") result.armor.push({ name, source });
      else if (kind === "weapon") result.weapons.push({ name, source });
      else if (kind === "saving_throw") result.saves.push({ name, source });
      else if (kind === "weapon_mastery") result.masteries.push({ name, source });
      if (choice.type === "expertise") result.expertise.push({ name, source });
      if (choice.type === "spell") result.spells.push({ name, source });
    }
  }

  return result;
}
