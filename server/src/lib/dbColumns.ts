// server/src/lib/dbColumns.ts
// SQL column constants — single source of truth for SELECT column lists.
// Use as: db.prepare(`SELECT ${COLS} FROM table WHERE ...`)


export const ADVENTURE_COLS =
  "id, campaign_id, name, status, sort, created_at, updated_at";

export const ENCOUNTER_COLS =
  "id, campaign_id, adventure_id, name, status, sort, " +
  "combat_round, combat_active_combatant_id, combat_phase, declarations_locked, created_at, updated_at";
  
// PLAYER_COLS must stay in sync with:
//   - server/src/lib/db.ts (CREATE TABLE players)
//   - server/src/lib/dbConverters.ts (rowToPlayer)
//   - server/src/server/userData.ts (StoredPlayer)
//   - web-dm/src/domain/types/domain.ts (Player)
export const PLAYER_COLS =
  "id, campaign_id, user_id, player_name, character_name, ancestry, paths_json, level, " +
  "hp_max, hp_current, focus_max, focus_current, investiture_max, investiture_current, " +
  "movement, defense_physical, defense_cognitive, defense_spiritual, deflect, injury_count, " +
  "color, image_url, overrides_json, conditions_json, shared_notes, created_at, updated_at";

export const USER_CHARACTER_COLS =
  "id, user_id, name, player_name, class_name, species, level, " +
  "hp_max, hp_current, ac, speed, str_score, dex_score, con_score, " +
  "int_score, wis_score, cha_score, color, image_url, character_data_json, " +
  "death_saves_json, shared_notes, created_at, updated_at";

// INPC_COLS must stay in sync with:
//   - server/src/lib/db.ts (CREATE TABLE inpcs)
//   - server/src/lib/dbConverters.ts (rowToINpc)
//   - server/src/server/userData.ts (StoredINpc)
//   - web-dm/src/domain/types/domain.ts (INpc)
export const INPC_COLS =
  "id, campaign_id, monster_id, name, label, friendly, " +
  "hp_max, hp_current, hp_details, " +
  "defense_physical, defense_cognitive, defense_spiritual, " +
  "deflect, movement, focus_max, investiture_max, " +
  "sort, created_at, updated_at";

export const NOTE_COLS =
  "id, campaign_id, adventure_id, title, text, sort, created_at, updated_at";

export const TREASURE_COLS =
  "id, campaign_id, adventure_id, source, item_id, name, rarity, type, type_key, " +
  "attunement, magic, text, qty, sort, created_at, updated_at";

export const CONDITION_COLS =
  "id, campaign_id, key, name, description, sort, created_at, updated_at";

export const CHARACTER_COLS =
  "id, user_id, campaign_id, name, class_name, species, level, " +
  "hp_max, hp_current, temp_hp, ac, speed, " +
  "str_score, dex_score, con_score, int_score, wis_score, cha_score, " +
  "notes, created_at, updated_at";

// COMBATANT_COLS must stay in sync with:
//   - server/src/lib/db.ts (CREATE TABLE combatants)
//   - server/src/lib/dbConverters.ts (rowToCombatant)
//   - server/src/server/userData.ts (StoredCombatant)
//   - web-dm/src/domain/types/domain.ts (Combatant)

export const COMBATANT_COLS =
  "id, encounter_id, base_type, base_id, name, label, initiative, friendly, " +
  "color, hp_current, hp_max, hp_details, " +
  "focus_current, focus_max, investiture_current, investiture_max, " +
  "ac, ac_details, sort, used_reaction, " +
  "phase, action_points_used, dual_phase, overrides_json, " +
  "conditions_json, attack_overrides_json, created_at, updated_at";

// ADVERSARY_COLS must stay in sync with:
//   - server/src/lib/db.ts (CREATE TABLE compendium_adversaries)
//   - server/src/lib/dbConverters.ts (rowToAdversary)
//   - server/src/server/userData.ts (StoredAdversary)
//   - web-dm/src/domain/types/domain.ts (Adversary)
export const ADVERSARY_COLS =
  "id, name, tier, adversary_type, size, " +
  "hp_range_min, hp_range_max, focus_max, investiture_max, " +
  "defense_physical, defense_cognitive, defense_spiritual, deflect, movement, " +
  "dual_phase, features_json, actions_json, additional_features_json, " +
  "created_at, updated_at";