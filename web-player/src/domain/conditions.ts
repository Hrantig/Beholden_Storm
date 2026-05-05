export type ConditionDef = {
  key: string;
  name: string;
  stackable?: boolean;
  needsDetail?: boolean;
  description?: string;
};

export type ConditionInstance = {
  key: string;
  casterId?: string | null;
  /** Combat round at which this condition expires (inclusive). null = no timer. */
  expiresAtRound?: number | null;
};

export const CONDITION_DEFS: ConditionDef[] = [
  { key: "afflicted", name: "Afflicted", description: "You are suffering from an affliction. The specific effects depend on the source." },
  { key: "determined", name: "Determined", description: "You are filled with resolve. Effects depend on the source." },
  { key: "disoriented", name: "Disoriented", description: "Your senses are overwhelmed. You have difficulty perceiving your surroundings accurately." },
  { key: "empowered", name: "Empowered", description: "You are strengthened beyond your normal limits. Effects depend on the source." },
  { key: "enhanced", name: "Enhanced", stackable: true, needsDetail: true, description: "One of your stats is temporarily increased. The affected stat and bonus are noted when applied." },
  { key: "exhausted", name: "Exhausted", stackable: true, needsDetail: true, description: "You are worn down. Each stack applies a cumulative penalty to all skill tests." },
  { key: "focused", name: "Focused", description: "Your concentration is heightened. Effects depend on the source." },
  { key: "immobilized", name: "Immobilized", description: "You cannot move from your current position." },
  { key: "prone", name: "Prone", description: "You are lying on the ground. Standing up costs movement." },
  { key: "restrained", name: "Restrained", description: "Your movement is restricted. You cannot move freely." },
  { key: "slowed", name: "Slowed", description: "Your movement speed is reduced." },
  { key: "stunned", name: "Stunned", description: "You are dazed and unable to act effectively." },
  { key: "surprised", name: "Surprised", description: "You are caught off guard and cannot act in the first round of combat." },
  { key: "unconscious", name: "Unconscious", description: "You are incapacitated. You can only take Slow turns and your actions are limited. An injury roll may be required." },
];

export function conditionLabel(key: string): string {
  return CONDITION_DEFS.find((d) => d.key === key)?.name ?? key;
}
