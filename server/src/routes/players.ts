// server/src/routes/players.ts
import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { rowToPlayer, PLAYER_COLS } from "../lib/db.js";
import { ConditionInstanceSchema, OverridesSchema } from "../lib/schemas.js";
import { DEFAULT_OVERRIDES} from "../lib/defaults.js";
import { ACCEPTED_IMAGE_TYPES, resizeToWebP } from "../lib/imageHelpers.js";
import { absolutizePublicUrl } from "../lib/publicUrl.js";
import { dmOrAdmin, memberOrAdmin } from "../middleware/campaignAuth.js";

const PlayerCreateBody = z.object({
  playerName: z.string().trim().optional(),
  characterName: z.string().trim().optional(),
  ancestry: z.string().trim().optional(),
  paths: z.array(z.string()).optional(),
  level: z.number().int().optional(),
  hpMax: z.number().int().optional(),
  hpCurrent: z.number().int().optional(),
  focusMax: z.number().int().optional(),
  focusCurrent: z.number().int().optional(),
  investitureMax: z.number().int().nullable().optional(),
  investitureCurrent: z.number().int().nullable().optional(),
  movement: z.number().int().optional(),
  defensePhysical: z.number().int().optional(),
  defenseCognitive: z.number().int().optional(),
  defenseSpiritual: z.number().int().optional(),
  deflect: z.number().int().optional(),
  injuryCount: z.number().int().optional(),
  color: z.string().optional(),
});

const PlayerUpdateBody = z.object({
  playerName: z.string().trim().optional(),
  characterName: z.string().trim().optional(),
  ancestry: z.string().trim().optional(),
  paths: z.array(z.string()).optional(),
  level: z.number().int().optional(),
  hpMax: z.number().int().optional(),
  hpCurrent: z.number().int().optional(),
  focusMax: z.number().int().optional(),
  focusCurrent: z.number().int().optional(),
  investitureMax: z.number().int().nullable().optional(),
  investitureCurrent: z.number().int().nullable().optional(),
  movement: z.number().int().optional(),
  defensePhysical: z.number().int().optional(),
  defenseCognitive: z.number().int().optional(),
  defenseSpiritual: z.number().int().optional(),
  deflect: z.number().int().optional(),
  injuryCount: z.number().int().optional(),
  conditions: z.array(ConditionInstanceSchema).optional(),
  overrides: OverridesSchema.optional(),
});

export function registerPlayerRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/players", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = db
      .prepare(`SELECT ${PLAYER_COLS} FROM players WHERE campaign_id = ?`)
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToPlayer));
  });

  // Party view — returns Stormlight player fields for all players in the campaign.
  app.get("/api/campaigns/:campaignId/party", memberOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = db
      .prepare(`SELECT ${PLAYER_COLS} FROM players WHERE campaign_id = ?`)
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToPlayer));
  });

  app.post("/api/campaigns/:campaignId/players", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const p = parseBody(PlayerCreateBody, req);
    const id = uid();
    const t = now();
    db.prepare(`
  INSERT INTO players
    (id, campaign_id, player_name, character_name, ancestry, paths_json, level,
     hp_max, hp_current, focus_max, focus_current, investiture_max, investiture_current,
     movement, defense_physical, defense_cognitive, defense_spiritual, deflect,
     color, overrides_json, conditions_json, created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id,
    campaignId,
    p.playerName || "Player",
    p.characterName || "Character",
    p.ancestry || "Unknown",
    JSON.stringify(p.paths ?? []),
    p.level ?? 1,
    p.hpMax ?? 10,
    p.hpCurrent ?? p.hpMax ?? 10,
    p.focusMax ?? 0,
    p.focusCurrent ?? p.focusMax ?? 0,
    p.investitureMax ?? null,
    p.investitureCurrent ?? null,
    p.movement ?? 0,
    p.defensePhysical ?? 0,
    p.defenseCognitive ?? 0,
    p.defenseSpiritual ?? 0,
    p.deflect ?? 0,
    p.color ?? "green",
    JSON.stringify(DEFAULT_OVERRIDES),
    JSON.stringify([]),
    t,
    t
  );
    ctx.broadcast("players:changed", { campaignId });
    const row = db.prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`).get(id) as Record<string, unknown>;
    res.json(rowToPlayer(row));
  });

  app.put("/api/players/:playerId", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = db
      .prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`)
      .get(playerId) as Record<string, unknown> | undefined;
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToPlayer(existingRow);
    const p = parseBody(PlayerUpdateBody, req);
    const t = now();
    const playerName = p.playerName ?? existing.playerName;
    const characterName = p.characterName ?? existing.characterName;
    const ancestry = p.ancestry ?? existing.ancestry;
    const paths = p.paths ?? existing.paths ?? [];
    const level = p.level ?? existing.level;
    const hpMax = p.hpMax ?? existing.hpMax;
    const hpCurrent = p.hpCurrent ?? existing.hpCurrent;
    const focusMax = p.focusMax ?? existing.focusMax;
    const focusCurrent = p.focusCurrent ?? existing.focusCurrent;
    const investitureMax = p.investitureMax !== undefined ? p.investitureMax : existing.investitureMax;
    const investitureCurrent = p.investitureCurrent !== undefined ? p.investitureCurrent : existing.investitureCurrent;
    const movement = p.movement ?? existing.movement;
    const defensePhysical = p.defensePhysical ?? existing.defensePhysical;
    const defenseCognitive = p.defenseCognitive ?? existing.defenseCognitive;
    const defenseSpiritual = p.defenseSpiritual ?? existing.defenseSpiritual;
    const deflect = p.deflect ?? existing.deflect;
    const conditions = p.conditions ?? existing.conditions ?? [];
    const overrides = p.overrides ?? existing.overrides ?? DEFAULT_OVERRIDES;
    const injuryCount = p.injuryCount ?? existing.injuryCount ?? 0;

    db.prepare(`
      UPDATE players SET
        player_name=?, character_name=?, ancestry=?, paths_json=?, level=?,
        hp_max=?, hp_current=?, focus_max=?, focus_current=?,
        investiture_max=?, investiture_current=?,
        movement=?, defense_physical=?, defense_cognitive=?, defense_spiritual=?, deflect=?,
        injury_count=?, overrides_json=?, conditions_json=?, updated_at=?
      WHERE id=?
    `).run(
      playerName, characterName, ancestry, JSON.stringify(paths), level,
      hpMax, hpCurrent, focusMax, focusCurrent,
      investitureMax, investitureCurrent,
      movement, defensePhysical, defenseCognitive, defenseSpiritual, deflect,
      injuryCount,
      JSON.stringify(overrides),
      JSON.stringify(conditions),
      t,
      playerId
    );

    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    const updated = db.prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`).get(playerId) as Record<string, unknown>;
    res.json(rowToPlayer(updated));
  });

  // DM can update a player's shared notes (edit/delete individual notes).
  app.patch("/api/players/:playerId/sharedNotes", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = db.prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`).get(playerId) as Record<string, unknown> | undefined;
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const sharedNotes: string = typeof req.body?.sharedNotes === "string" ? req.body.sharedNotes : "";
    const t = now();
    db.prepare("UPDATE players SET shared_notes = ?, updated_at = ? WHERE id = ?").run(sharedNotes, t, playerId);
    const existing = rowToPlayer(existingRow);
    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    res.json({ ok: true, sharedNotes });
  });

  app.delete("/api/players/:playerId", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const existingRow = db
      .prepare(`SELECT ${PLAYER_COLS} FROM players WHERE id = ?`)
      .get(playerId) as Record<string, unknown> | undefined;
    if (!existingRow) return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToPlayer(existingRow);

    // Remove player-type combatants from all encounters in this campaign
    const affectedEncounters = db
      .prepare(`
        SELECT DISTINCT c.encounter_id
        FROM combatants c
        JOIN encounters e ON e.id = c.encounter_id
        WHERE c.base_type = 'player' AND c.base_id = ? AND e.campaign_id = ?
      `)
      .all(playerId, existing.campaignId) as { encounter_id: string }[];

    db.prepare(
      "DELETE FROM combatants WHERE base_type = 'player' AND base_id = ?"
    ).run(playerId);

    for (const { encounter_id } of affectedEncounters) {
      ctx.broadcast("encounter:combatantsChanged", { encounterId: encounter_id });
    }

    db.prepare("DELETE FROM players WHERE id = ?").run(playerId);

    // Best-effort removal of player image.
    const imagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
    const imgPath = ctx.path.join(imagesDir, `${playerId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }

    ctx.broadcast("players:changed", { campaignId: existing.campaignId });
    res.json({ ok: true });
  });

  // Upload player character image — resized to a thumbnail (max 400px, WebP).
  app.post("/api/players/:playerId/image", dmOrAdmin(db), ctx.upload.single("image"), async (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const row = db.prepare("SELECT campaign_id FROM players WHERE id = ?").get(playerId) as { campaign_id: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    if (!req.file) return res.status(400).json({ ok: false, message: "No file" });

    if (!ACCEPTED_IMAGE_TYPES.includes(req.file.mimetype)) {
      return res.status(400).json({ ok: false, message: "Unsupported image type" });
    }

    let thumbnail: Buffer;
    try {
      thumbnail = await resizeToWebP(req.file.buffer);
    } catch {
      return res.status(400).json({ ok: false, message: "Could not process image" });
    }

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
    ctx.fs.mkdirSync(imagesDir, { recursive: true });

    const filename = `${playerId}.webp`;
    ctx.fs.writeFileSync(ctx.path.join(imagesDir, filename), thumbnail);

    const imageUrl = `/player-images/${filename}`;
    db.prepare("UPDATE players SET image_url = ?, updated_at = ? WHERE id = ?").run(imageUrl, now(), playerId);
    ctx.broadcast("players:changed", { campaignId: row.campaign_id });
    res.json({ ok: true, imageUrl: absolutizePublicUrl(imageUrl) });
  });

  // Remove player character image.
  app.delete("/api/players/:playerId/image", dmOrAdmin(db), (req, res) => {
    const playerId = requireParam(req, res, "playerId");
    if (!playerId) return;
    const row = db.prepare("SELECT campaign_id FROM players WHERE id = ?").get(playerId) as { campaign_id: string } | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });

    const imagesDir = ctx.path.join(ctx.paths.dataDir, "player-images");
    const imgPath = ctx.path.join(imagesDir, `${playerId}.webp`);
    try { if (ctx.fs.existsSync(imgPath)) ctx.fs.unlinkSync(imgPath); } catch { /* best-effort */ }

    db.prepare("UPDATE players SET image_url = NULL, updated_at = ? WHERE id = ?").run(now(), playerId);
    ctx.broadcast("players:changed", { campaignId: row.campaign_id });
    res.json({ ok: true });
  });
}
