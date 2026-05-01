import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../server/context.js";
import { requireParam } from "../lib/routeHelpers.js";
import { parseBody } from "../shared/validate.js";
import { rowToINpc, rowToAdversary, INPC_COLS, ADVERSARY_COLS } from "../lib/db.js";
import { dmOrAdmin } from "../middleware/campaignAuth.js";

const InpcCreateBody = z.object({
  monsterId: z.string(),
  qty: z.number().int().min(1).max(20).default(1),
  name: z.string().optional(),
  label: z.string().nullable().optional(),
  friendly: z.boolean().optional(),
  hpMax: z.number().optional(),
  hpCurrent: z.number().optional(),
  hpDetails: z.string().nullable().optional(),
  defensePhysical: z.number().optional(),
  defenseCognitive: z.number().optional(),
  defenseSpiritual: z.number().optional(),
  deflect: z.number().optional(),
  movement: z.number().optional(),
  focusMax: z.number().optional(),
  investitureMax: z.number().nullable().optional(),
});

const InpcUpdateBody = z.object({
  name: z.string().optional(),
  label: z.string().nullable().optional(),
  friendly: z.boolean().optional(),
  hpMax: z.number().optional(),
  hpCurrent: z.number().optional(),
  hpDetails: z.string().nullable().optional(),
  defensePhysical: z.number().optional(),
  defenseCognitive: z.number().optional(),
  defenseSpiritual: z.number().optional(),
  deflect: z.number().optional(),
  movement: z.number().optional(),
  focusMax: z.number().optional(),
  investitureMax: z.number().nullable().optional(),
});

export function registerInpcRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;
  const { uid, now } = ctx.helpers;

  app.get("/api/campaigns/:campaignId/inpcs", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const rows = db
      .prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE campaign_id = ?`)
      .all(campaignId) as Record<string, unknown>[];
    res.json(rows.map(rowToINpc));
  });

  app.post("/api/campaigns/:campaignId/inpcs", dmOrAdmin(db), (req, res) => {
    const campaignId = requireParam(req, res, "campaignId");
    if (!campaignId) return;
    const b = parseBody(InpcCreateBody, req);
    const { monsterId, qty = 1 } = b;

    // Look up from Stormlight adversary compendium
    const advRow = db
      .prepare(`SELECT ${ADVERSARY_COLS} FROM compendium_adversaries WHERE id = ?`)
      .get(monsterId) as Record<string, unknown> | undefined;
    if (!advRow)
      return res.status(404).json({ ok: false, message: "Adversary not found in compendium" });

    const adversary = rowToAdversary(advRow);
    const t = now();
    const created: ReturnType<typeof rowToINpc>[] = [];

    for (let i = 0; i < qty; i++) {
      const id = uid();
      const name = b.name?.trim() || adversary.name;
      const hpMax = b.hpMax ?? adversary.hpRangeMax;
      const hpCurrent = b.hpCurrent ?? hpMax;
      const hpDetails = b.hpDetails ?? null;
      const label = b.label ?? null;
      const friendly = b.friendly ?? true;
      const defensePhysical = b.defensePhysical ?? adversary.defensePhysical;
      const defenseCognitive = b.defenseCognitive ?? adversary.defenseCognitive;
      const defenseSpiritual = b.defenseSpiritual ?? adversary.defenseSpiritual;
      const deflect = b.deflect ?? adversary.deflect;
      const movement = b.movement ?? adversary.movement;
      const focusMax = b.focusMax ?? adversary.focusMax;
      const investitureMax = b.investitureMax !== undefined ? b.investitureMax : adversary.investitureMax;

      db.prepare(`
        INSERT INTO inpcs
          (id, campaign_id, monster_id, name, label, friendly,
           hp_max, hp_current, hp_details,
           defense_physical, defense_cognitive, defense_spiritual,
           deflect, movement, focus_max, investiture_max,
           created_at, updated_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        id, campaignId, monsterId, name, label,
        friendly ? 1 : 0,
        hpMax, hpCurrent, hpDetails,
        defensePhysical, defenseCognitive, defenseSpiritual,
        deflect, movement, focusMax,
        investitureMax ?? null,
        t, t
      );

      const row = db.prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE id = ?`).get(id) as Record<string, unknown>;
      created.push(rowToINpc(row));
    }

    ctx.broadcast("inpcs:changed", { campaignId });
    res.json(created.length === 1 ? created[0] : { ok: true, created });
  });

  app.put("/api/inpcs/:inpcId", dmOrAdmin(db), (req, res) => {
    const inpcId = requireParam(req, res, "inpcId");
    if (!inpcId) return;
    const existingRow = db
      .prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE id = ?`)
      .get(inpcId) as Record<string, unknown> | undefined;
    if (!existingRow)
      return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToINpc(existingRow);
    const b = parseBody(InpcUpdateBody, req);
    const t = now();

    const name = b.name ?? existing.name;
    const label = b.label !== undefined ? b.label : existing.label;
    const friendly = b.friendly ?? existing.friendly;
    const hpMax = b.hpMax ?? existing.hpMax;
    const hpCurrent = b.hpCurrent ?? existing.hpCurrent;
    const hpDetails = b.hpDetails !== undefined ? b.hpDetails : existing.hpDetails;
    const defensePhysical = b.defensePhysical ?? existing.defensePhysical;
    const defenseCognitive = b.defenseCognitive ?? existing.defenseCognitive;
    const defenseSpiritual = b.defenseSpiritual ?? existing.defenseSpiritual;
    const deflect = b.deflect ?? existing.deflect;
    const movement = b.movement ?? existing.movement;
    const focusMax = b.focusMax ?? existing.focusMax;
    const investitureMax = b.investitureMax !== undefined ? b.investitureMax : existing.investitureMax;

    db.prepare(`
      UPDATE inpcs SET
        name=?, label=?, friendly=?,
        hp_max=?, hp_current=?, hp_details=?,
        defense_physical=?, defense_cognitive=?, defense_spiritual=?,
        deflect=?, movement=?, focus_max=?, investiture_max=?,
        updated_at=?
      WHERE id=?
    `).run(
      name, label, friendly ? 1 : 0,
      hpMax, hpCurrent, hpDetails,
      defensePhysical, defenseCognitive, defenseSpiritual,
      deflect, movement, focusMax, investitureMax ?? null,
      t, inpcId
    );

    ctx.broadcast("inpcs:changed", { campaignId: existing.campaignId });
    const updated = db.prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE id = ?`).get(inpcId) as Record<string, unknown>;
    res.json(rowToINpc(updated));
  });

  app.delete("/api/inpcs/:inpcId", dmOrAdmin(db), (req, res) => {
    const inpcId = requireParam(req, res, "inpcId");
    if (!inpcId) return;
    const existingRow = db
      .prepare(`SELECT ${INPC_COLS} FROM inpcs WHERE id = ?`)
      .get(inpcId) as Record<string, unknown> | undefined;
    if (!existingRow)
      return res.status(404).json({ ok: false, message: "Not found" });
    const existing = rowToINpc(existingRow);

    const affectedEncounters = db
      .prepare("SELECT DISTINCT encounter_id FROM combatants WHERE base_type = 'inpc' AND base_id = ?")
      .all(inpcId) as { encounter_id: string }[];

    db.prepare("DELETE FROM combatants WHERE base_type = 'inpc' AND base_id = ?").run(inpcId);

    for (const { encounter_id } of affectedEncounters) {
      ctx.broadcast("encounter:combatantsChanged", { encounterId: encounter_id });
    }

    db.prepare("DELETE FROM inpcs WHERE id = ?").run(inpcId);
    ctx.broadcast("inpcs:changed", { campaignId: existing.campaignId });
    res.json({ ok: true });
  });
}