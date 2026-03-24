import type { TaggedItem } from "@/views/CharacterSheetTypes";

export function abilityMod(score: number | null | undefined): number {
  return Math.floor(((score ?? 10) - 10) / 2);
}

export function formatModifier(n: number): string {
  return (n >= 0 ? "+" : "") + n;
}

export function proficiencyBonus(level: number): number {
  return Math.ceil(level / 4) + 1;
}

export function hasNamedProficiency(list: Array<Pick<TaggedItem, "name">> | null | undefined, name: string): boolean {
  return (list ?? []).some((s) => String(s.name).toLowerCase() === name.toLowerCase());
}

export function normalizeWeaponProficiencyName(name: string): string {
  const normalized = String(name ?? "").trim();
  if (!normalized) return normalized;
  if (/simple weapons?\s+and\s+martial weapons?\s+that have the finesse or light property/i.test(normalized)) {
    return "Finesse and Light Weapons";
  }
  return normalized;
}

export function normalizeArmorProficiencyName(name: string): string {
  const normalized = String(name ?? "").trim();
  if (!normalized) return normalized;
  if (/^shield$/i.test(normalized)) return "Shields";
  return normalized;
}

export function normalizeLanguageName(name: string): string {
  const normalized = String(name ?? "").trim();
  if (!normalized) return normalized;
  if (/^thieves'? cant$/i.test(normalized)) return "Thieves' Cant";
  if (/^common$/i.test(normalized)) return "Common";
  return normalized;
}

export function dedupeTaggedItems(
  list: TaggedItem[] | null | undefined,
  normalizeName?: (name: string) => string,
): TaggedItem[] {
  const out: TaggedItem[] = [];
  const seen = new Set<string>();
  for (const item of list ?? []) {
    const name = (normalizeName ? normalizeName(item.name) : String(item.name ?? "").trim()).trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      ...item,
      name,
    });
  }
  return out;
}

export function normalizeResourceKey(name: string): string {
  return String(name ?? "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function parseInvocationPrereqLevel(text: string): number {
  const m = text.match(/Prerequisite[^:]*:.*?Level\s+(\d+)\+/i);
  return m ? parseInt(m[1], 10) : 1;
}

export function extractPrerequisite(text: string | null | undefined): string | null {
  const raw = String(text ?? "");
  const match = raw.match(/^\s*Prerequisite[^:]*:\s*(.+)$/im);
  return match ? match[1].trim() : null;
}

export function stripPrerequisiteLine(text: string | null | undefined): string {
  return String(text ?? "")
    .replace(/^\s*Prerequisite[^:]*:.*(?:\r?\n)?/im, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function spellLooksLikeDamageSpell(spell: { name?: string | null; text?: string | null }): boolean {
  const text = String(spell.text ?? "");
  const name = String(spell.name ?? "");
  return /\bdeal(?:s|ing)?\b.*\bdamage\b/i.test(text)
    || /\btakes?\b.*\bdamage\b/i.test(text)
    || /\b\d+d\d+\b/.test(text)
    || /eldritch blast|poison spray|fire bolt|ray of frost|chill touch|sacred flame|acid splash|mind sliver|toll the dead|vicious mockery|word of radiance|primal savagery|thorn whip|shocking grasp/i.test(name);
}

export function invocationPrerequisitesMet(
  text: string | null | undefined,
  opts: {
    level: number;
    chosenCantripNames?: string[];
    chosenDamageCantripNames?: string[];
    chosenInvocationNames?: string[];
  }
): boolean {
  const raw = String(text ?? "");
  if (parseInvocationPrereqLevel(raw) > opts.level) return false;

  const chosenCantripNames = (opts.chosenCantripNames ?? []).map((name) => String(name).toLowerCase());
  const chosenDamageCantripNames = (opts.chosenDamageCantripNames ?? []).map((name) => String(name).toLowerCase());
  const chosenInvocationNames = (opts.chosenInvocationNames ?? []).map((name) => String(name).toLowerCase());

  if (/prerequisite[^:]*:.*eldritch blast cantrip/i.test(raw) && !chosenCantripNames.includes("eldritch blast")) return false;
  if (/prerequisite[^:]*:.*warlock cantrip that deals damage/i.test(raw) && chosenDamageCantripNames.length === 0) return false;
  if (/prerequisite[^:]*:.*pact of the blade/i.test(raw) && !chosenInvocationNames.some((name) => /pact of the blade/i.test(name))) return false;
  if (/prerequisite[^:]*:.*pact of the chain/i.test(raw) && !chosenInvocationNames.some((name) => /pact of the chain/i.test(name))) return false;
  if (/prerequisite[^:]*:.*pact of the tome/i.test(raw) && !chosenInvocationNames.some((name) => /pact of the tome/i.test(name))) return false;
  if (/prerequisite[^:]*:.*pact of the talisman/i.test(raw) && !chosenInvocationNames.some((name) => /pact of the talisman/i.test(name))) return false;

  return true;
}

export function hpColor(pct: number): string {
  if (pct <= 0) return "#6b7280";
  if (pct < 25) return "#f87171";
  if (pct < 50) return "#fb923c";
  if (pct < 75) return "#fbbf24";
  return "#4ade80";
}
