// server/src/server/userData.ts
// Canonical server-side domain types for persisted data.
// These are richer than the client domain types — they include internal fields
// like sort, createdAt, updatedAt, and server-only state.

export type Id = string;

export interface Timestamps {
  createdAt: number;
  updatedAt: number;
}

// ---------------------------------------------------------------------------
// Overrides & sub-types
// ---------------------------------------------------------------------------

export interface StoredOverrides {
  tempHp: number;
  deflectBonus: number;
  hpMaxBonus: number;
}

// Alias kept for call-site compatibility.
export type StoredCombatantOverrides = StoredOverrides;

export interface StoredConditionInstance {
  key: string;
  casterId?: string | null;
  [k: string]: unknown;
}

export interface StoredDeathSaves {
  success: number;
  fail: number;
}

// ---------------------------------------------------------------------------
// Collections
// ---------------------------------------------------------------------------

export interface StoredUser extends Timestamps {
  id: Id;
  username: string;
  name: string;
  isAdmin: boolean;
}

export interface StoredCharacter extends Timestamps {
  id: Id;
  userId: Id | null;
  campaignId: Id;
  name: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  tempHp: number;
  ac: number;
  speed: number;
  strScore: number;
  dexScore: number;
  conScore: number;
  intScore: number;
  wisScore: number;
  chaScore: number;
  notes: string;
}

export interface StoredCampaign extends Timestamps {
  id: Id;
  name: string;
  color: string | null;
  imageUrl?: string | null;
  sharedNotes: string;
}

export interface StoredAdventure extends Timestamps {
  id: Id;
  campaignId: Id;
  name: string;
  status: string;
  sort: number;
}

export interface StoredCombatState {
  round: number;
  activeCombatantId: string | null;
}

export interface StoredEncounter extends Timestamps {
  id: Id;
  campaignId: Id;
  adventureId: Id;
  name: string;
  status: string;
  sort?: number;
  /** Active combat state for this encounter. Absent when no combat has started. */
  combat?: StoredCombatState;
}

export interface StoredNote extends Timestamps {
  id: Id;
  campaignId: Id;
  adventureId?: Id | null;
  title: string;
  text: string;
  sort: number;
}

export interface StoredTreasure extends Timestamps {
  id: Id;
  campaignId: Id;
  adventureId: string | null;
  source: "compendium" | "custom";
  itemId: string | null;
  name: string;
  rarity: string | null;
  type: string | null;
  type_key: string | null;
  attunement: boolean;
  magic: boolean;
  text: string;
  qty: number;
  sort: number;
}

export interface StoredPlayer extends Timestamps {
  id: Id;
  campaignId: Id;
  userId?: string | null;
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
  overrides?: StoredOverrides;
  conditions?: StoredConditionInstance[];
  color?: string;
  imageUrl?: string | null;
  sharedNotes?: string;
}

export interface StoredUserCharacter extends Timestamps {
  id: Id;
  userId: Id;
  name: string;
  playerName: string;
  className: string;
  species: string;
  level: number;
  hpMax: number;
  hpCurrent: number;
  ac: number;
  speed: number;
  strScore: number | null;
  dexScore: number | null;
  conScore: number | null;
  intScore: number | null;
  wisScore: number | null;
  chaScore: number | null;
  color: string | null;
  imageUrl: string | null;
  characterData: Record<string, unknown> | null;
  deathSaves?: StoredDeathSaves;
  sharedNotes: string;
}

export interface StoredCharacterCampaign {
  id: Id;
  characterId: Id;
  campaignId: Id;
  playerId: Id | null;
}

export interface StoredINpc extends Timestamps {
  id: Id;
  campaignId: Id;
  monsterId: string;
  name: string;
  label: string | null;
  friendly: boolean;
  hpMax: number;
  hpCurrent: number;
  hpDetails: string | null;
  ac: number;
  acDetails: string | null;
  sort?: number;
}

export interface StoredAdversary {
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
  createdAt: number;
  updatedAt: number;
}

export interface AdversaryFeature {
  name: string;
  description: string;
}

export interface AdversaryAction {
  name: string;
  cost: number;
  description: string;
}

export interface AdversaryAdditionalFeature {
  name: string;
  description: string;
}

export interface StoredCondition extends Timestamps {
  id: Id;
  campaignId: Id;
  key: string;
  name: string;
  description?: string;
  sort?: number;
}

export type StoredCombatantBaseType = "player" | "monster" | "inpc";

export interface StoredCombatant extends Timestamps {
  id: Id;
  encounterId: Id;
  baseType: StoredCombatantBaseType;
  baseId: string;
  name: string;
  label: string;
  initiative: number | null;
  friendly: boolean;
  color: string;
  overrides: StoredOverrides;
  hpCurrent: number | null;
  hpMax: number | null;
  hpDetails: string | null;
  ac: number | null;
  acDetails: string | null;
  attackOverrides: unknown | null;
  conditions: StoredConditionInstance[];
  /** Fast or Slow phase declaration for this round. Null until declared. */
  phase?: "fast" | "slow" | null;
  /** Action points used in the current phase. Resets each phase. */
  actionPointsUsed?: number;
  /** Whether this combatant acts in both Fast and Slow NPC phases. */
  dualPhase?: boolean;
  /** Whether this combatant has used their reaction this round. Resets each round. */
  usedReaction?: boolean;
  sort?: number;
}

