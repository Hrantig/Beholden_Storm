export type Id = string;

export interface Meta {
  ok: true;
  host: string;
  port: number;
  ips: string[];
  dataDir: string;
  hasCompendium: boolean;
  support?: boolean;
}

export interface Campaign {
  id: Id;
  name: string;
  updatedAt?: number;
  playerCount?: number;
  imageUrl?: string | null;
  sharedNotes?: string;
}

export interface Adventure {
  id: Id;
  campaignId: Id;
  name: string;
  order: number;
}

export type EncounterStatus = "open" | "closed";

export interface Encounter {
  id: Id;
  campaignId: Id;
  adventureId?: Id | null;
  name: string;
  status: EncounterStatus;
  order: number;
}

export interface Player {
  id: Id;
  campaignId: Id;
  playerName: string;
  characterName: string;
  ancestry: string;
  paths: string[];
  level: number;
  hpMax: number;
  hpCurrent: number;
  focusMax: number;
  focusCurrent: number;
  investitureMax: number | null;
  investitureCurrent: number | null;
  movement: number;
  defensePhysical: number;
  defenseCognitive: number;
  defenseSpiritual: number;
  deflect: number;
  injuryCount: number;
  // Runtime fields synced from server
  overrides?: CombatantOverrides;
  conditions?: ConditionInstance[];
  color?: string;
  imageUrl?: string | null;
  sharedNotes?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Combatants are encounter-scoped instances used by the combat tracker.
// The server returns a merged view (player combatants hydrate name/hp/ac from the Player record).
export type CombatantBaseType = "player" | "monster" | "inpc";

export interface CombatantOverrides {
  tempHp: number;
  deflectBonus: number;
  hpMaxBonus: number;
}

export interface ConditionInstance {
  key: string;
  casterId?: string | null;
  [k: string]: unknown;
}

// export interface DeathSaves {
//   success: number;
//   fail: number;
// }

export interface Combatant {
  id: Id;
  encounterId: Id;

  // Source identity
  baseType: CombatantBaseType;
  baseId: Id;

  // Display
  name: string;
  playerName?: string;
  label: string;
  color: string;

  // Combat
  initiative: number | null;
  friendly: boolean;
  overrides: CombatantOverrides;
  hpCurrent: number | null;
  hpMax: number | null;
  hpDetails: string | null;
  ac: number | null;
  acDetails: string | null;
  attackOverrides: unknown | null;
  conditions: ConditionInstance[];
  usedReaction?: boolean;
  phase?: "fast" | "slow" | null;
  actionPointsUsed?: number;
  dualPhase?: boolean;

  createdAt?: number;
  updatedAt?: number;
}

export interface INpc {
  id: Id;
  campaignId: Id;
  monsterId: Id;
  name: string;
  label?: string | null;
  friendly: boolean;
  hpMax: number;
  hpCurrent: number;
  hpDetails?: string | null;
  ac: number;
  acDetails?: string | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface Note {
  id: Id;
  scope: "campaign" | "adventure";
  scopeId: Id;
  title: string;
  text: string;
  order: number;
}

export interface TreasureEntry {
  id: Id;
  scope: "campaign" | "adventure";
  scopeId: Id;
  name: string;
  qty: number;
  notes?: string;
  order: number;
  rarity?: string;
  type?: string;
  attunement?: boolean;
  magic?: boolean;
  text?: string;
  /** Set when the entry was sourced from the compendium — used to fetch full weapon stats on demand. */
  itemId?: string | null;
}

export type AttackOverride = {
  toHit?: number;
  damage?: string;
  damageType?: string;
};

export interface AddMonsterOptions {
  /**
   * Optional base label used when creating combatants.
   * The server/UI may suffix this to keep labels unique (e.g. "[2024] 2").
   */
  labelBase?: string;

  /** Optional stat overrides to apply to the created combatant */
  friendly?: boolean;
  hpMax?: number;
  hpCurrent?: number;
  hpDetails?: string | null;
  ac?: number;
  acDetails?: string | null;

  /** Optional attack overrides to apply */
  attackOverrides?: Record<string, AttackOverride>;
}

export interface Adversary {
  id: Id;
  name: string;
  tier: number;
  adversaryType: string;
  size: string;
  hpRangeMin: number; // lower bound of HP range for encounter instance creation
  hpRangeMax: number; // upper bound of HP range for encounter instance creation
  focusMax: number;
  investitureMax: number;
  defensePhysical: number;
  defenseCognitive: number;
  defenseSpiritual: number;
  deflect: number;
  movement: number;
  dualPhase: boolean;
  features: AdversaryFeature[] | null;
  actions: AdversaryAction[];
  additionalFeatures: AdversaryAdditionalFeature[] | null;
  createdAt?: number;
  updatedAt?: number;
}

export interface AdversaryFeature {
  name: string;
  description: string;
}

export interface AdversaryAction {
  name: string;
  cost: number;
  actionType?: string;
  description: string;
}

export interface AdversaryAdditionalFeature {
  name: string;
  description: string;
}