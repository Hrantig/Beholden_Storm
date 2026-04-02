# Stormlight RPG — DM App Design Document

> This document defines the data model, rules, and design decisions for adapting the Beholden DM app to the Cosmere Stormlight RPG system. It serves as the source of truth for all development decisions.

---

## Design Philosophy

This is a **DM tool**, not a character sheet or rules engine. The guiding principles are:

- **Track state, explain rules, let humans decide.** Automate only what is genuinely repetitive and unambiguous.
- **Description-first.** Every compendium entry works as standalone reference text. Structured/mechanical fields are addable extensions, not the foundation.
- **Right-sized scope.** If a feature keeps players staring at a screen instead of engaging with each other and the narrative, it doesn't belong here — at least not yet.
- **Easy to extend.** The compendium builder and data model should make it straightforward to add mechanical fields later without restructuring existing entries.

---

## Campaign Structure

**Campaign → Adventures → Encounters** — unchanged from original app.

> **Future addition (not in scope):** Conversation encounters as a distinct encounter type with their own mechanical implications.

---

## Player (PC) Record

| Field | Type | Notes |
|---|---|---|
| `playerName` | string | |
| `characterName` | string | |
| `ancestry` | string | replaces `species` |
| `paths` | string[] | replaces `class` — multiple paths allowed, stored as simple list |
| `level` | number | |
| `hpCurrent` / `hpMax` | number | |
| `focusCurrent` / `focusMax` | number | |
| `investitureCurrent` / `investitureMax` | number \| null | null or 0 = not displayed in UI |
| `movement` | number | |
| `defensePhysical` | number | manually entered by DM |
| `defenseCognitive` | number | manually entered by DM |
| `defenseSpiritual` | number | manually entered by DM |
| `deflect` | number | manually entered — derived from equipped gear |

> **Note:** The six core attributes (Strength, Agility, Intellect, Willpower, Awareness, Presence) are intentionally excluded from the DM model. Defense scores are entered directly — attribute math belongs on the player's character sheet.

---

## Combatant Overrides

The override system from the original app is retained and extended. Overrides are temporary values applied during combat that sit on top of the base stat without permanently changing it.

| Override | Type | Notes |
|---|---|---|
| `tempHp` | number | temporary HP on top of current HP pool |
| `hpMaxBonus` | number | temporary bonus to max HP |
| `deflectBonus` | number | temporary deflect value not tied to equipped armor or shield — replaces D&D's `acBonus` |

---

## Combat Model

### Round Structure

Each round is divided into **four phases**, executed in this fixed order:

1. **Fast PCs**
2. **Fast NPCs**
3. **Slow PCs**
4. **Slow NPCs**

### Fast vs Slow Declaration

- At the start of each round, every participant declares **Fast** or **Slow** via a dialog — PCs select F or S, the DM does the same for normal NPCs on the encounter tracker
- PC declarations are **changeable** up until the Fast NPC phase begins
- The UI presents a clear **commit moment** — a prompt giving players a final chance to change their declaration before the first Fast NPC takes its turn
- Within a phase, PC turn order is **freeform** — players coordinate among themselves

### Action Points

| Turn type | Action points |
|---|---|
| Fast | 2 |
| Slow | 3 |

Individual actions cost 1 or more action points. The app does not enforce action costs — this is adjudicated at the table.

### Dual-Phase Adversaries (Boss feature)

- Some adversaries (bosses / important NPCs) act in **both** the Fast NPC and Slow NPC phases
- When a dual-phase adversary is added to an encounter, the system **automatically creates two combatant slots** — one per NPC phase
- Each slot has full action points for its phase (2 for Fast, 3 for Slow)
- Driven by a `dualPhase: true` flag on the compendium entry
- This is the **only** adversary feature with automated encounter behavior

---

## Conditions

All conditions are applied and removed **manually by the DM**. The app tracks state and displays reference information — it does not calculate or enforce mechanical effects, with the single exception noted below.

**Duration** is tracked as an optional field per applied condition (number of rounds or freeform note). No automatic expiry.

| Condition | Display | Special behavior |
|---|---|---|
| Afflicted | Afflicted | — |
| Determined | Determined | — |
| Disoriented | Disoriented | — |
| Empowered | Empowered | — |
| Enhanced | Enhanced [STR+2] | Stackable — specify stat and bonus value at application time |
| Exhausted | Exhausted [-1] | Stackable — penalty value increments with each stack |
| Focused | Focused | — |
| Immobilized | Immobilized | — |
| Prone | Prone | — |
| Restrained | Restrained | — |
| Slowed | Slowed | — |
| Stunned | Stunned | — |
| Surprised | Surprised | — |
| Unconscious | Unconscious | **Automated:** applied when HP drops to 0. App enforces Slow turn only for this combatant. Triggers injury roll dialog. Action limitations not enforced. |

---

## Injury System

### Triggers
- **Primary:** PC drops to 0 HP and becomes Unconscious — injury roll dialog appears automatically
- **Secondary:** DM or PC manually triggers via an **Injury button** on any combatant at any time (for injuries caused by other means)
- **Narrative override:** Any injury can be directly overwritten with a freeform entry when the injury is given for narrative/story reasons rather than mechanical ones

### Injury Roll Dialog
When triggered (automatically or manually), a dialog guides the DM through the process:
1. **Gravity roll** — DM rolls at the table, references the gravity table from the compendium, selects result in dialog
2. **Effect roll** — DM rolls at the table, references the effect table from the compendium, selects resulting condition or narrative effect
3. Resulting condition is applied to the combatant automatically from the dialog
4. Narrative outcomes can be entered as freeform text and are noted on the combatant record

**App does NOT:**
- Roll dice for injuries
- Apply injury effects without DM confirmation
- Track injury severity as a separate persistent field beyond the resulting condition

### Injury count tracking
A simple `injuryCount` counter is stored on the Player record, defaulting to 0. The DM increments and decrements it manually as injuries are applied or healed. This value is used as a reference when making subsequent injury rolls at the table. No automation — the counter is purely informational.

> **Future:** When the player-side app is built, players will be able to manage this counter themselves via a dedicated route. The data model does not need to change for this.
---

## Adversary / NPC Compendium Entry

### Stat block

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `hpMax` | number | |
| `focusMax` | number | most adversaries have this — hide if 0 or null |
| `investitureMax` | number \| null | hide if 0 or null |
| `defensePhysical` | number | |
| `defenseCognitive` | number | |
| `defenseSpiritual` | number | |
| `deflect` | number | |
| `movement` | number | |
| `dualPhase` | boolean | Boss feature — triggers dual-slot creation in encounters |
| `features` | string | freeform text block — DM reads and adjudicates |
| `actions` | Action[] | see below |
| `opportunities` | string | freeform text — displayed in compendium entry |
| `complications` | string | freeform text — displayed in compendium entry |

### Action entry

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `cost` | number | action point cost (1, 2 or 3) |
| `description` | string | DM reads and adjudicates — no mechanical automation |

---

## Compendium Categories

### Adversaries
Full structured stat blocks. Primary encounter-use section.

### Talents

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `path` | string | which path this talent belongs to |
| `description` | string | full reference text |
| `tags` | string[] | for filtering (type, tier, prerequisites etc.) |

### Surges

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `surgeType` | string | e.g. Gravitation, Adhesion |
| `description` | string | full reference text |
| `tags` | string[] | for filtering |

### Equipment

| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `type` | string | weapon, armor, shield, other |
| `deflectValue` | number \| null | for armor/shields — informs PC/NPC Deflect field |
| `description` | string | |
| `tags` | string[] | |

### Rules Reference
Static content sections — not database entries:
- Basic actions (name + action point cost + description)
- Conditions (full list with effect descriptions)
- Injury tables (gravity and effect — referenced by injury roll dialog)
- Calculation tables

---

## Development Phases

### Phase 1 — Data model (do yourself, guided)
1. Define TypeScript types in `web-dm/src/domain/types/domain.ts`
2. Update database schema in `server/src/lib/db.ts`
3. Update API routes to handle new fields

### Phase 2 — UI simplification (introduce Claude Code here)
- Remove D&D-specific UI elements
- Build Stormlight-specific interfaces
- Implement four-phase combat tracker with Fast/Slow declaration dialog
- Implement dual-phase combatant slots
- Implement injury roll dialog
- Implement deflect bonus override

### Phase 3 — Compendium
- Build compendium data entry tools
- Populate adversaries, talents, surges, equipment
- Build rules reference sections including injury tables

---

## Deferred / Future Additions
- Conversation encounters with mechanical implications
- Automated condition effects beyond Unconscious slow-lock
- Attribute scores on DM side (if player app is built out)
- Action point cost enforcement
- Talent/Surge mechanical automation (add if repetition proves it worthwhile)

