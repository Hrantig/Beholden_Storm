// server/src/routes/compendium.ts
// Aggregates compendium route modules. D&D routes removed in Phase 2 cleanup.

import type { Express } from "express";
import type { ServerContext } from "../server/context.js";

export function registerCompendiumRoutes(_app: Express, _ctx: ServerContext) {
  // All D&D compendium routes (monsters, spells, items, lore, admin) removed.
  // Adversary routes are registered separately via registerAdversaryRoutes in createServer.ts.
}
