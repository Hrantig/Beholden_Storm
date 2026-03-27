export interface SharedSpellSummary {
  id: string;
  name: string;
  level?: number | null;
  text?: string | null;
}

export interface SharedSpellListChoiceEntry {
  key: string;
  count: number;
  options: string[];
}

export interface SharedResolvedSpellChoiceEntry {
  key: string;
  count: number;
  level: number | null;
  note?: string | null;
  listNames: string[];
}

export const FEAT_SPELL_LIST_NAMES = new Set(["Artificer", "Bard", "Cleric", "Druid", "Paladin", "Ranger", "Sorcerer", "Warlock", "Wizard"]);

export async function loadSpellChoiceOptions(
  choices: SharedResolvedSpellChoiceEntry[],
  fetchSpells: (query: string) => Promise<SharedSpellSummary[]>,
): Promise<Record<string, SharedSpellSummary[]>> {
  const entries = await Promise.all(
    choices.map(async (choice) => {
      if (choice.listNames.length === 0) return [choice.key, []] as const;

      const groups = await Promise.all(
        choice.listNames.map(async (listName) => {
          const encoded = encodeURIComponent(listName);
          if ((choice.level ?? 0) === 0) {
            return fetchSpells(`/api/spells/search?classes=${encoded}&level=0&limit=200`).catch(() => []);
          }
          if (typeof choice.level === "number" && /\bat or below\b/i.test(choice.note ?? "")) {
            return fetchSpells(`/api/spells/search?classes=${encoded}&minLevel=1&maxLevel=${choice.level}&limit=300`).catch(() => []);
          }
          if (typeof choice.level === "number") {
            return fetchSpells(`/api/spells/search?classes=${encoded}&level=${choice.level}&limit=300`).catch(() => []);
          }
          return fetchSpells(`/api/spells/search?classes=${encoded}&limit=300`).catch(() => []);
        })
      );

      const byName = new Map<string, SharedSpellSummary>();
      for (const spell of groups.flat()) {
        if (!spell?.name) continue;
        byName.set(spell.name.toLowerCase(), spell);
      }
      return [choice.key, Array.from(byName.values()).sort((a, b) => a.name.localeCompare(b.name))] as const;
    })
  );

  return Object.fromEntries(entries);
}

export function sanitizeSpellChoiceSelections(args: {
  currentSelections: Record<string, string[]>;
  spellListChoices: SharedSpellListChoiceEntry[];
  resolvedSpellChoices: SharedResolvedSpellChoiceEntry[];
  spellOptionsByKey: Record<string, SharedSpellSummary[]>;
}): Record<string, string[]> {
  const { currentSelections, spellListChoices, resolvedSpellChoices, spellOptionsByKey } = args;
  const nextSelections = { ...currentSelections };

  for (const choice of spellListChoices) {
    const current = nextSelections[choice.key] ?? [];
    const filtered = current.filter((value) => choice.options.includes(value)).slice(0, choice.count);
    if (filtered.length === 0) delete nextSelections[choice.key];
    else nextSelections[choice.key] = filtered;
  }

  for (const choice of resolvedSpellChoices) {
    const current = nextSelections[choice.key] ?? [];
    const allowed = (spellOptionsByKey[choice.key] ?? []).map((spell) => spell.name);
    const filtered = current.filter((value) => allowed.includes(value)).slice(0, choice.count);
    if (filtered.length === 0) delete nextSelections[choice.key];
    else nextSelections[choice.key] = filtered;
  }

  return nextSelections;
}

