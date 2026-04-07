# Stormlight DM App — Backlog

> Items that came up during development but were intentionally deferred. 
> Review this before starting each new phase.

---

## UI / UX

- **Paths input** — replace free-text comma-separated input in PlayerForm with a 
  dropdown/multiselect once the compendium Paths list exists

- **Condition icons** — current icons sourced quickly from game-icons.net as 
  placeholders. Review and replace with better thematic matches when time allows.

- **MonsterTraits legendary resistance dots** — currently rendered but not 
  interactive since we removed the handler. Either wire up a Stormlight-equivalent 
  mechanic or remove the dots entirely when tackling the compendium phase.

---

## Architecture / Tech Debt

- **ORM / single source of truth** — currently field definitions are repeated across 
  TypeScript types, Zod schemas, SQL schema, and converters. Consider migrating to 
  Prisma or Drizzle during Phase 3 (compendium build) to eliminate this. Start with 
  new compendium tables rather than migrating existing ones.

- **Player-side injury count management** — currently only the DM can update 
  `injuryCount`. When the player app is built, add a player-facing route for this 
  field. Data model does not need to change.

- **Player-side conditions management** — conditions can currently be applied from 
  the Campaign view and combat view by the DM. When the player app is built, players 
  should be able to manage their own conditions. Permissions change only, no data 
  model change needed.

- **Combatant edit drawers — consolidate and expand** — there are currently two 
  separate edit experiences for combatants:
  - `CombatantDrawer.tsx` — used when setting up combat in the encounter builder 
    (pre-combat). Currently shows a single "Defense (Physical)" field standing in 
    for AC.
  - `CombatantOverridesDrawer.tsx` — used during active combat for temporary 
    overrides (deflect bonus, temp HP, HP modifier).
  During the combat UI pass, revisit whether these should be:
  1. Consolidated into a single drawer with context-aware sections, OR
  2. Kept separate but made consistent in style and shared components
  Also expand `CombatantDrawer` to show all three Stormlight defense stats 
  (Physical, Cognitive, Spiritual) and Deflect instead of just one AC field.

---

## Combat Features (Phase 2 — not yet built)

- **Four-phase combat tracker** — replace D&D initiative with Fast/Slow declaration 
  dialog, four-phase round structure, action points display. Biggest remaining 
  frontend change.

- **Dual-phase combatant slots** — when a `dualPhase: true` adversary is added to 
  an encounter, automatically create two combatant slots (one Fast NPC, one Slow NPC).

- **Unconscious slow-lock** — when Unconscious condition is applied, app should 
  enforce Slow turn only for that combatant.

- **Injury roll dialog** — prompted automatically when HP drops to 0 (Unconscious 
  applied), and manually via an Injury button. Guides DM through gravity and effect 
  rolls referencing compendium tables. Supports narrative override.

- **Phase declaration dialog** — UI for PCs to select Fast or Slow at start of each 
  round, changeable until the commit moment before first Fast NPC turn.

- **Deflect bonus override** — temporary deflect value not tied to armor, accessible 
  from the overrides panel.

---

## Player Combat Panel (Phase 2 — partially done)

- **Stormlight stats display** — replace CharacterSheetPanel (D&D stats) with 
  Stormlight resources (HP/Focus/Investiture), three defenses, deflect, movement, 
  injury count in the CombatantDetailsPanel.

---

## Compendium (Phase 3)

- **Build compendium from scratch** — four categories: Adversaries, Talents, Surges, 
  Equipment. Plus Rules Reference (actions, conditions, injury tables).

- **Adversary stat block builder** — form for entering adversary data matching the 
  schema defined in DESIGN.md.

- **HP range on encounter add** — adversary stat blocks give HP as a base value or 
  range (e.g. 8–12). The compendium schema needs updating to store both `hpMin` and 
  `hpMax`. When adding an adversary to an encounter, if hpMin < hpMax show a picker 
  letting the DM choose the actual HP for that instance. If equal, use automatically. 
  Do this schema change BEFORE building the encounter add UI. Hold off until the 
  compendium data structure is fully reviewed after initial adversary entry pass.

- **Injury tables in Rules Reference** — gravity table and effect table, referenced 
  by the injury roll dialog.

- **Monster picker redesign** — `MonsterPickerDetailPane`, `MonsterStatblock`, and 
  related components still use D&D compendium data shape (ac, armor_class, abilities 
  etc.). Full redesign needed when Stormlight compendium is built in Phase 3.

- **CharacterSheetPanel monster display** — still contains D&D ability table and 
  saves display (marked optional in Phase 2). Replace with Stormlight adversary stat 
  display during Phase 3 compendium work.

- **Conversation encounters** — distinct encounter type with mechanical implications. 
  Deferred until combat encounters are solid.

---

## General D&D Cleanup (remaining)

- **web-player app** — largely untouched, still full D&D. Defer until DM side is 
  complete.

- **StoredCharacter / StoredUserCharacter** in userData.ts — still D&D-flavored, 
  left for player-side work.

- **routes/characters.ts** — player-side character linking, updated minimally to 
  compile. Needs proper Stormlight treatment when player app is built.

- **party route in players.ts** — `/api/campaigns/:id/party` still references some 
  D&D fields. Needs cleanup when player app is built.

- **INpcDrawer.tsx** — still shows "AC" and "AC Details" labels. Update labels to 
  "Defense" and "Defense Details" during combat UI pass.

