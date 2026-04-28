// server/src/lib/dbConverters.ts
// Row → domain object converters, shared across all route files.

import { DEFAULT_OVERRIDES} from "./defaults.js";
import { absolutizePublicUrl } from "./publicUrl.js";
import type {
  StoredCampaign,
  StoredAdventure,
  StoredEncounter,
  CombatPhase,
  StoredPlayer,
  StoredINpc,
  StoredNote,
  StoredTreasure,
  StoredCondition,
  StoredCombatant,
  StoredCombatantBaseType,
  StoredCharacter,
  StoredUserCharacter,
  StoredAdversary
} from "../server/userData.js";

export function parseJson<T>(s: unknown, fallback: T): T {
  if (!s || typeof s !== "string") return fallback;
  try { return JSON.parse(s) as T; } catch { return fallback; }
}

function normalizeCharacterData(value: Record<string, unknown> | null): Record<string, unknown> | null {
  if (!value || typeof value !== "object") return value;
  const next = { ...value } as Record<string, unknown>;
  const classFeatures = Array.isArray(next.classFeatures) ? next.classFeatures : [];
  const selectedFeatureNames = Array.isArray(next.selectedFeatureNames) ? next.selectedFeatureNames : [];
  if (selectedFeatureNames.length === 0 && classFeatures.length > 0) {
    next.selectedFeatureNames = classFeatures
      .map((feature) => {
        if (feature && typeof feature === "object" && typeof (feature as { name?: unknown }).name === "string") {
          return ((feature as { name: string }).name).trim();
        }
        return "";
      })
      .filter(Boolean);
  }
  delete next.classFeatures;
  return next;
}

export function rowToUser(row: Record<string, unknown>) {
  return {
    id: row.id as string,
    username: row.username as string,
    name: row.name as string,
    isAdmin: Boolean(row.is_admin),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToCharacter(row: Record<string, unknown>): StoredCharacter {
  return {
    id: row.id as string,
    userId: (row.user_id as string | null) ?? null,
    campaignId: row.campaign_id as string,
    name: row.name as string,
    className: (row.class_name as string) ?? "",
    species: (row.species as string) ?? "",
    level: (row.level as number) ?? 1,
    hpMax: (row.hp_max as number) ?? 1,
    hpCurrent: (row.hp_current as number) ?? 1,
    tempHp: (row.temp_hp as number) ?? 0,
    ac: (row.ac as number) ?? 10,
    speed: (row.speed as number) ?? 30,
    strScore: (row.str_score as number) ?? 10,
    dexScore: (row.dex_score as number) ?? 10,
    conScore: (row.con_score as number) ?? 10,
    intScore: (row.int_score as number) ?? 10,
    wisScore: (row.wis_score as number) ?? 10,
    chaScore: (row.cha_score as number) ?? 10,
    notes: (row.notes as string) ?? "",
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToCampaign(row: Record<string, unknown>): StoredCampaign {
  return {
    id: row.id as string,
    name: row.name as string,
    color: (row.color as string | null) ?? null,
    imageUrl: absolutizePublicUrl((row.image_url as string | null) ?? null),
    sharedNotes: (row.shared_notes as string | null) ?? "",
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToAdventure(row: Record<string, unknown>): StoredAdventure {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    name: row.name as string,
    status: row.status as string,
    sort: row.sort as number,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToEncounter(row: Record<string, unknown>): StoredEncounter {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    adventureId: row.adventure_id as string,
    name: row.name as string,
    status: row.status as string,
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    ...(row.combat_round != null
  ? { 
      combat: { 
        round: row.combat_round as number, 
        activeCombatantId: (row.combat_active_combatant_id as string | null) ?? null,
        currentPhase: (row.combat_phase as string ?? "fast-pc") as CombatPhase,
        declarationsLocked: Boolean(row.declarations_locked),
      } 
    }
  : {}),
    currentPhase: (row.combat_phase as string ?? "fast-pc") as CombatPhase,
    declarationsLocked: Boolean(row.declarations_locked),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToPlayer(row: Record<string, unknown>): StoredPlayer {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    userId: (row.user_id as string | null) ?? null,
    playerName: row.player_name as string,
    characterName: row.character_name as string,
    ancestry: row.ancestry as string,
    paths: parseJson(row.paths_json, []),
    level: row.level as number,
    hpMax: row.hp_max as number,
    hpCurrent: row.hp_current as number,
    focusMax: row.focus_max as number,
    focusCurrent: row.focus_current as number,
    investitureMax: row.investiture_max != null ? row.investiture_max as number : null,
    investitureCurrent: row.investiture_current != null ? row.investiture_current as number : null,
    movement: row.movement as number,
    defensePhysical: row.defense_physical as number,
    defenseCognitive: row.defense_cognitive as number,
    defenseSpiritual: row.defense_spiritual as number,
    deflect: row.deflect as number,
    injuryCount: row.injury_count as number,
    ...(row.color != null ? { color: row.color as string } : {}),
    imageUrl: absolutizePublicUrl((row.image_url as string | null) ?? null),
    overrides: parseJson(row.overrides_json, DEFAULT_OVERRIDES),
    conditions: parseJson(row.conditions_json, []),
    sharedNotes: (row.shared_notes as string | null) ?? "",
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToUserCharacter(row: Record<string, unknown>): StoredUserCharacter {
  return {
    id: row.id as string,
    userId: row.user_id as string,
    name: row.name as string,
    playerName: (row.player_name as string) ?? "",
    className: (row.class_name as string) ?? "",
    species: (row.species as string) ?? "",
    level: (row.level as number) ?? 1,
    hpMax: (row.hp_max as number) ?? 0,
    hpCurrent: (row.hp_current as number) ?? 0,
    ac: (row.ac as number) ?? 10,
    speed: (row.speed as number) ?? 30,
    strScore: (row.str_score as number | null) ?? null,
    dexScore: (row.dex_score as number | null) ?? null,
    conScore: (row.con_score as number | null) ?? null,
    intScore: (row.int_score as number | null) ?? null,
    wisScore: (row.wis_score as number | null) ?? null,
    chaScore: (row.cha_score as number | null) ?? null,
    color: (row.color as string | null) ?? null,
    imageUrl: absolutizePublicUrl((row.image_url as string | null) ?? null),
    characterData: normalizeCharacterData(parseJson(row.character_data_json, null)),
    ...(row.death_saves_json
  ? { deathSaves: parseJson(row.death_saves_json, { success: 0, fail: 0 }) }
  : {}),
    sharedNotes: (row.shared_notes as string | null) ?? "",
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToINpc(row: Record<string, unknown>): StoredINpc {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    monsterId: row.monster_id as string,
    name: row.name as string,
    label: (row.label as string | null) ?? null,
    friendly: Boolean(row.friendly),
    hpMax: row.hp_max as number,
    hpCurrent: row.hp_current as number,
    hpDetails: (row.hp_details as string | null) ?? null,
    ac: row.ac as number,
    acDetails: (row.ac_details as string | null) ?? null,
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToAdversary(row: Record<string, unknown>): StoredAdversary {
  return {
    id: row.id as string,
    name: row.name as string,
    tier: (row.tier as number) ?? 0,
    adversaryType: (row.adversary_type as string) ?? "",
    size: (row.size as string) ?? "",
    hpRangeMin: (row.hp_range_min as number) ?? 0,
    hpRangeMax: (row.hp_range_max as number) ?? 0,
    focusMax: (row.focus_max as number) ?? 0,
    investitureMax: (row.investiture_max as number) ?? 0,
    defensePhysical: (row.defense_physical as number) ?? 0,
    defenseCognitive: (row.defense_cognitive as number) ?? 0,
    defenseSpiritual: (row.defense_spiritual as number) ?? 0,
    deflect: (row.deflect as number) ?? 0,
    movement: (row.movement as number) ?? 0,
    dualPhase: Boolean(row.dual_phase),
    features: parseJson(row.features_json, null),
    actions: parseJson(row.actions_json, []),
    additionalFeatures: parseJson(row.additional_features_json, null),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToNote(row: Record<string, unknown>): StoredNote {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    adventureId: (row.adventure_id as string | null) ?? null,
    title: row.title as string,
    text: row.text as string,
    sort: row.sort as number,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToTreasure(row: Record<string, unknown>): StoredTreasure {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    adventureId: (row.adventure_id as string | null) ?? null,
    source: row.source as "compendium" | "custom",
    itemId: (row.item_id as string | null) ?? null,
    name: row.name as string,
    rarity: (row.rarity as string | null) ?? null,
    type: (row.type as string | null) ?? null,
    type_key: (row.type_key as string | null) ?? null,
    attunement: Boolean(row.attunement),
    magic: Boolean(row.magic),
    text: (row.text as string) ?? "",
    qty: typeof row.qty === "number" ? row.qty : 1,
    sort: row.sort as number,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToCondition(row: Record<string, unknown>): StoredCondition {
  return {
    id: row.id as string,
    campaignId: row.campaign_id as string,
    key: row.key as string,
    name: row.name as string,
    ...(row.description != null ? { description: row.description as string } : {}),
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}

export function rowToCombatant(row: Record<string, unknown>): StoredCombatant {
  return {
    id: row.id as string,
    encounterId: row.encounter_id as string,
    baseType: row.base_type as StoredCombatantBaseType,
    baseId: row.base_id as string,
    name: row.name as string,
    label: row.label as string,
    initiative: (row.initiative as number | null) ?? null,
    friendly: Boolean(row.friendly),
    color: (row.color as string) ?? "#cccccc",
    hpCurrent: (row.hp_current as number | null) ?? null,
    hpMax: (row.hp_max as number | null) ?? null,
    hpDetails: (row.hp_details as string | null) ?? null,
    focusCurrent: (row.focus_current as number | null) ?? null,
    focusMax: (row.focus_max as number | null) ?? null,
    investitureCurrent: (row.investiture_current as number | null) ?? null,
    investitureMax: (row.investiture_max as number | null) ?? null,
    ac: (row.ac as number | null) ?? null,
    acDetails: (row.ac_details as string | null) ?? null,
    ...(row.sort != null ? { sort: row.sort as number } : {}),
    usedReaction: Boolean(row.used_reaction),
    phase: (row.phase as "fast" | "slow" | null) ?? null,
    actionPointsUsed: (row.action_points_used as number) ?? 0,
    dualPhase: Boolean(row.dual_phase),
    overrides: parseJson(row.overrides_json, DEFAULT_OVERRIDES),
    conditions: parseJson(row.conditions_json, []),
    attackOverrides: row.attack_overrides_json
      ? parseJson(row.attack_overrides_json, null)
      : null,
    createdAt: row.created_at as number,
    updatedAt: row.updated_at as number,
  };
}
