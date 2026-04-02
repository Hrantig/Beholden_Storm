// server/src/services/combat.ts
import type Database from "better-sqlite3";
import { now, uid } from "../lib/runtime.js";
import { rowToCombatant, rowToPlayer, COMBATANT_COLS, PLAYER_COLS } from "../lib/db.js";
import type { StoredCombatant, StoredPlayer } from "../server/userData.js";
import { DEFAULT_OVERRIDES } from "../lib/defaults.js";

/** Ensures a combat record exists for the encounter; creates it if missing. */
export function ensureCombat(db: Database.Database, encounterId: string): void {
  const t = now();
  db.prepare(
    `INSERT OR IGNORE INTO combats (encounter_id, round, active_index, active_combatant_id, created_at, updated_at)
     VALUES (?, 1, 0, NULL, ?, ?)`
  ).run(encounterId, t, t);
}

export function nextLabelNumber(db: Database.Database, encounterId: string, baseName: string): number {
  ensureCombat(db, encounterId);
  const row = db.prepare(
    `SELECT COALESCE(MAX(CAST(SUBSTR(label, LENGTH(?)+2) AS INTEGER)), 0) + 1 AS n
     FROM combatants
     WHERE encounter_id = ? AND label LIKE ? || ' %'`
  ).get(baseName, encounterId, baseName) as { n: number };
  return row.n;
}

export function createPlayerCombatant({
  encounterId,
  player,
  t = now(),
}: {
  encounterId: string;
  player: StoredPlayer;
  t?: number;
}): StoredCombatant {
  return {
    id: uid(),
    encounterId,
    baseType: "player",
    baseId: player.id,
    name: player.characterName,
    label: player.characterName,
    initiative: null,
    friendly: true,
    color: "green",
    overrides: player.overrides ?? { ...DEFAULT_OVERRIDES },
    hpCurrent: player.hpCurrent,
    hpMax: player.hpMax,
    hpDetails: null,
    ac: player.defensePhysical,
    acDetails: null,
    attackOverrides: null,
    conditions: Array.isArray(player.conditions) ? player.conditions : [],
    phase: null,
    actionPointsUsed: 0,
    usedReaction: false,
    createdAt: t,
    updatedAt: t,
  };
}

/** Insert a StoredCombatant into the combatants table. */
export function insertCombatant(db: Database.Database, c: StoredCombatant): void {
  db.prepare(
    `INSERT INTO combatants
       (id, encounter_id, base_type, base_id, name, label, initiative, friendly, color,
      hp_current, hp_max, hp_details, ac, ac_details, sort,
      overrides_json, conditions_json, attack_overrides_json,
      phase, action_points_used, dual_phase, used_reaction,
      created_at, updated_at)
     VALUES
       (?, ?, ?, ?, ?, ?, ?, ?, ?,
        ?, ?, ?, ?, ?, ?,
        ?, ?, ?,
        ?, ?, ?, ?,
        ?, ?)`
  ).run(
    c.id, c.encounterId, c.baseType, c.baseId, c.name, c.label,
    c.initiative,
    c.friendly ? 1 : 0,
    c.color,
    c.hpCurrent, c.hpMax, c.hpDetails, c.ac, c.acDetails,
    c.sort ?? null,
    JSON.stringify(c.overrides ?? DEFAULT_OVERRIDES),
    JSON.stringify(c.conditions ?? []),
    c.attackOverrides != null ? JSON.stringify(c.attackOverrides) : null,
    c.phase ?? null,
    c.actionPointsUsed ?? 0,
    c.dualPhase ? 1 : 0,
    c.usedReaction ? 1 : 0,
    c.createdAt,
    c.updatedAt,
  );
}

/**
 * Write HP / conditions / overrides / death-saves from a player-type combatant
 * back to the players table. Returns the player's campaignId, or null if the
 * combatant is not a player type or the player row no longer exists.
 */
export function syncCombatantToPlayer(
  db: Database.Database,
  combatant: StoredCombatant,
  t: number
): string | null {
  if (combatant.baseType !== "player") return null;
  const pRow = db
    .prepare("SELECT campaign_id FROM players WHERE id = ?")
    .get(combatant.baseId) as { campaign_id: string } | undefined;
  if (!pRow) return null;
  db.prepare(`
    UPDATE players SET
      hp_current=?, conditions_json=?, overrides_json=?, updated_at=?
    WHERE id=?
  `).run(
    combatant.hpCurrent,
    JSON.stringify(combatant.conditions ?? []),
    JSON.stringify(combatant.overrides ?? DEFAULT_OVERRIDES),
    t,
    combatant.baseId
  );
  return pRow.campaign_id;
}

/**
 * For player combatants, rehydrate mutable persistent fields from the canonical
 * players row so encounter-scoped updates never push stale snapshot values back.
 */
export function hydratePlayerCombatant(
  db: Database.Database,
  combatant: StoredCombatant
): StoredCombatant {
  if (combatant.baseType !== "player") return combatant;
  const pRow = db
    .prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`)
    .get(combatant.baseId) as Record<string, unknown> | undefined;
  if (!pRow) return combatant;
  const player = rowToPlayer(pRow);
  return {
    ...combatant,
    name: player.characterName,
    label: combatant.label || player.characterName,
    hpCurrent: player.hpCurrent,
    hpMax: player.hpMax,
    ac: player.defensePhysical,
    conditions: player.conditions ?? [],
    overrides: player.overrides ?? combatant.overrides,
  };
}

/** Load all combatants for an encounter, sorted by position. */
export function loadCombatants(db: Database.Database, encounterId: string): StoredCombatant[] {
  const rows = db.prepare(
    `SELECT ${COMBATANT_COLS} FROM combatants WHERE encounter_id = ? ORDER BY COALESCE(sort, 9999), created_at`
  ).all(encounterId) as Record<string, unknown>[];
  return rows.map(rowToCombatant);
}
