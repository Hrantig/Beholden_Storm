import type { InventoryContainer, InventoryItem } from "@/views/character/CharacterInventory";

export type AbilKey = "str" | "dex" | "con" | "int" | "wis" | "cha";

export interface TaggedItem {
  name: string;
  source: string;
}

export interface ProficiencyMap {
  skills: TaggedItem[];
  expertise: TaggedItem[];
  saves: TaggedItem[];
  armor: TaggedItem[];
  weapons: TaggedItem[];
  tools: TaggedItem[];
  languages: TaggedItem[];
  masteries: TaggedItem[];
  spells: TaggedItem[];
  invocations: TaggedItem[];
}

export interface PlayerNote {
  id: string;
  title: string;
  text: string;
}

export interface ClassFeatureEntry {
  id: string;
  name: string;
  text: string;
}

export interface ResourceCounter {
  key: string;
  name: string;
  current: number;
  max: number;
  reset: string;
}

export interface GrantedSpellCast {
  key: string;
  spellName: string;
  sourceName: string;
  mode: "at_will" | "limited";
  note: string;
  resourceKey?: string;
  reset?: string;
}

export interface ConditionInstance {
  key: string;
  casterId?: string | null;
  casterName?: string | null;
  sourceName?: string | null;
  [k: string]: unknown;
}

export interface CharacterCampaign {
  id: string;
  campaignId: string;
  campaignName: string;
  playerId: string | null;
}

export interface CharacterData {
  classId?: string;
  raceId?: string;
  bgId?: string;
  alignment?: string | null;
  hair?: string | null;
  skin?: string | null;
  height?: string | null;
  age?: string | null;
  weight?: string | null;
  gender?: string | null;
  sheetOverrides?: {
    tempHp: number;
    acBonus: number;
    hpMaxBonus: number;
  } | null;
  chosenRaceFeatId?: string | null;
  chosenBgOriginFeatId?: string | null;
  subclass?: string | null;
  abilityMethod?: string;
  hd?: number | null;
  hitDiceCurrent?: number | null;
  xp?: number;
  chosenOptionals?: string[];
  chosenClassFeatIds?: Record<string, string>;
  chosenLevelUpFeats?: Array<{ level: number; featId: string }>;
  chosenSkills?: string[];
  chosenClassLanguages?: string[];
  chosenFeatOptions?: Record<string, string[]>;
  chosenCantrips?: string[];
  chosenSpells?: string[];
  chosenInvocations?: string[];
  classFeatures?: ClassFeatureEntry[];
  resources?: ResourceCounter[];
  proficiencies?: ProficiencyMap;
  inventory?: InventoryItem[];
  inventoryContainers?: InventoryContainer[];
  playerNotesList?: PlayerNote[];
  usedSpellSlots?: Record<string, number>;
  preparedSpells?: string[];
  customResistances?: string[];
  customImmunities?: string[];
}

