// server/src/lib/inferRuleset.ts
// Shared helper used by compendium routes and XML import.

export type Ruleset = "5e" | "5.5e";

export function inferRuleset(...values: Array<unknown>): Ruleset {
  const text = values
    .map((value) => String(value ?? ""))
    .join("\n");
  return /\[(?:2024|5\.5e)\]|\((?:2024|5\.5e)\)|\b2024\b|\b5\.5e\b/i.test(text) ? "5.5e" : "5e";
}
