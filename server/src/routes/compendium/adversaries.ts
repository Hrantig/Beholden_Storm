// server/src/routes/compendium/adversaries.ts
import { z } from "zod";
import type { Express } from "express";
import type { ServerContext } from "../../server/context.js";
import { parseBody } from "../../shared/validate.js";
import { requireAdmin, requireAuth } from "../../middleware/auth.js";
import { rowToAdversary, ADVERSARY_COLS } from "../../lib/db.js";
import { now, uid } from "../../lib/runtime.js";

const AdversaryActionSchema = z.object({
  name: z.string(),
  cost: z.number().int().min(0).max(3),
  description: z.string(),
});

const AdversaryFeatureSchema = z.object({
  name: z.string(),
  description: z.string(),
});

const AdversaryBody = z.object({
  name: z.string().trim().min(1),
  tier: z.number().int().default(0),
  adversaryType: z.string().default(""),
  size: z.string().default(""),
  hpRangeMin: z.number().int().default(0),
  hpRangeMax: z.number().int().default(0),
  focusMax: z.number().int().default(0),
  investitureMax: z.number().int().default(0),
  defensePhysical: z.number().int().default(0),
  defenseCognitive: z.number().int().default(0),
  defenseSpiritual: z.number().int().default(0),
  deflect: z.number().int().default(0),
  movement: z.number().int().default(0),
  dualPhase: z.boolean().default(false),
  features: z.array(AdversaryFeatureSchema).nullable().default(null),
  actions: z.array(AdversaryActionSchema).default([]),
  additionalFeatures: z.array(AdversaryFeatureSchema).nullable().default(null),
});

const BulkImportBody = z.object({
  adversaries: z.array(AdversaryBody),
});

export function registerAdversaryRoutes(app: Express, ctx: ServerContext) {
  const { db } = ctx;

  // List all adversaries
  app.get("/api/compendium/adversaries", requireAuth, (req, res) => {
    const rows = db
      .prepare(`SELECT ${ADVERSARY_COLS} FROM compendium_adversaries ORDER BY name ASC`)
      .all() as Record<string, unknown>[];
    res.json(rows.map(rowToAdversary));
  });

  // Get single adversary
  app.get("/api/compendium/adversaries/:id", requireAuth, (req, res) => {
    const row = db
      .prepare(`SELECT ${ADVERSARY_COLS} FROM compendium_adversaries WHERE id = ?`)
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    res.json(rowToAdversary(row));
  });

  // Create single adversary
  app.post("/api/compendium/adversaries", requireAdmin, (req, res) => {
    const body = parseBody(AdversaryBody, req);
    const id = uid();
    const t = now();
    db.prepare(`
  INSERT INTO compendium_adversaries
    (id, name, tier, adversary_type, size,
     hp_range_min, hp_range_max, focus_max, investiture_max,
     defense_physical, defense_cognitive, defense_spiritual,
     deflect, movement, dual_phase,
     features_json, actions_json, additional_features_json,
     created_at, updated_at)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, body.name,
    body.tier, body.adversaryType, body.size,
    body.hpRangeMin, body.hpRangeMax,
    body.focusMax, body.investitureMax,
    body.defensePhysical, body.defenseCognitive, body.defenseSpiritual,
    body.deflect, body.movement,
    body.dualPhase ? 1 : 0,
    body.features ? JSON.stringify(body.features) : null,
    JSON.stringify(body.actions),
    body.additionalFeatures ? JSON.stringify(body.additionalFeatures) : null,
    t, t
  );
    const row = db
      .prepare(`SELECT ${ADVERSARY_COLS} FROM compendium_adversaries WHERE id = ?`)
      .get(id) as Record<string, unknown>;
    res.json(rowToAdversary(row));
  });

  // Update adversary
  app.put("/api/compendium/adversaries/:id", requireAdmin, (req, res) => {
    const row = db
      .prepare(`SELECT ${ADVERSARY_COLS} FROM compendium_adversaries WHERE id = ?`)
      .get(req.params.id) as Record<string, unknown> | undefined;
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    const body = parseBody(AdversaryBody, req);
    const t = now();
    db.prepare(`
  UPDATE compendium_adversaries SET
    name=?, tier=?, adversary_type=?, size=?,
    hp_range_min=?, hp_range_max=?,
    focus_max=?, investiture_max=?,
    defense_physical=?, defense_cognitive=?, defense_spiritual=?,
    deflect=?, movement=?, dual_phase=?,
    features_json=?, actions_json=?, additional_features_json=?,
    updated_at=?
  WHERE id=?
  `).run(
    body.name,
    body.tier, body.adversaryType, body.size,
    body.hpRangeMin, body.hpRangeMax,
    body.focusMax, body.investitureMax,
    body.defensePhysical, body.defenseCognitive, body.defenseSpiritual,
    body.deflect, body.movement,
    body.dualPhase ? 1 : 0,
    body.features ? JSON.stringify(body.features) : null,
    JSON.stringify(body.actions),
    body.additionalFeatures ? JSON.stringify(body.additionalFeatures) : null,
    t,
    req.params.id
  );
    const updated = db
      .prepare(`SELECT ${ADVERSARY_COLS} FROM compendium_adversaries WHERE id = ?`)
      .get(req.params.id) as Record<string, unknown>;
    res.json(rowToAdversary(updated));
  });

  // Delete adversary
  app.delete("/api/compendium/adversaries/:id", requireAdmin, (req, res) => {
    const row = db
      .prepare("SELECT id FROM compendium_adversaries WHERE id = ?")
      .get(req.params.id);
    if (!row) return res.status(404).json({ ok: false, message: "Not found" });
    db.prepare("DELETE FROM compendium_adversaries WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  // Bulk import — replaces entire adversary compendium
  app.post("/api/compendium/adversaries/import", requireAdmin, (req, res) => {
    const body = parseBody(BulkImportBody, req);
    const t = now();
    db.transaction(() => {
      db.prepare("DELETE FROM compendium_adversaries").run();
      for (const a of body.adversaries) {
        const id = uid();
        db.prepare(`
          INSERT INTO compendium_adversaries
            (id, name, tier, adversary_type, size,
            hp_range_min, hp_range_max, focus_max, investiture_max,
            defense_physical, defense_cognitive, defense_spiritual,
            deflect, movement, dual_phase,
            features_json, actions_json, additional_features_json,
            created_at, updated_at)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
        id, a.name,
        a.tier, a.adversaryType, a.size,
        a.hpRangeMin, a.hpRangeMax,
        a.focusMax, a.investitureMax,
        a.defensePhysical, a.defenseCognitive, a.defenseSpiritual,
        a.deflect, a.movement,
        a.dualPhase ? 1 : 0,
        a.features ? JSON.stringify(a.features) : null,
        JSON.stringify(a.actions),
        a.additionalFeatures ? JSON.stringify(a.additionalFeatures) : null,
        t, t
      );
      }
    })();
    res.json({ ok: true, imported: body.adversaries.length });
  });
}