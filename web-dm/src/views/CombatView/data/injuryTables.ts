export type DurationRow = {
  roll: string;
  result: string;
  description: string;
};

export type EffectRow = {
  roll: string;
  effect: string;
  narrativeSuggestion: string;
  conditionKey?: string;
  conditionDetail?: string;
};

export const DURATION_TABLE: DurationRow[] = [
  { roll: "−6 or lower", result: "Death", description: 'You die (see "Death").' },
  { roll: "−5 to 0", result: "Permanent Injury", description: "You suffer a permanent injury." },
  { roll: "1 to 5", result: "Vicious Injury", description: "You suffer a temporary injury with a duration of 6d6 days." },
  { roll: "6 to 15", result: "Shallow Injury", description: "You suffer a temporary injury with a duration of 1d6 days." },
  { roll: "16+", result: "Flesh Wound", description: "You suffer a temporary injury until after a long rest." },
];

export const EFFECT_TABLE: EffectRow[] = [
  { roll: "1–2", effect: "Exhausted [−1]", narrativeSuggestion: "Any injury that lowers your overall stamina.", conditionKey: "exhausted", conditionDetail: "-1" },
  { roll: "3", effect: "Exhausted [−2]", narrativeSuggestion: "Any injury that lowers your overall stamina.", conditionKey: "exhausted", conditionDetail: "-2" },
  { roll: "4–5", effect: "Slowed", narrativeSuggestion: "Injured leg or foot, or any injury that lowers your overall speed.", conditionKey: "slowed" },
  { roll: "6", effect: "Disoriented", narrativeSuggestion: "Injured head, or widespread injury that overwhelms your senses.", conditionKey: "disoriented" },
  { roll: "7", effect: "Surprised", narrativeSuggestion: "Overwhelmed by the shock of an injury.", conditionKey: "surprised" },
  { roll: "8", effect: "Can only use one hand", narrativeSuggestion: "Injured arm or hand, or any injury that lowers your widespread coordination." },
];
