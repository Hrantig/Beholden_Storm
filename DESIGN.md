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
| `injuryCount` | number | simple counter, default 0, incremented/decremented manually |

> **Note:** The six core attributes (Strength, Agility, Intellect, Willpower, Awareness, Presence) are intentionally excluded from the DM model. Defense scores are entered directly — attribute math belongs on the player's character sheet.

---

## Combatant Overrides

Overrides are temporary values applied during combat that sit on top of the base stat without permanently changing it.

| Override | Type | Notes |
|---|---|---|
| `tempHp` | number | temporary HP on top of current HP pool |
| `hpMaxBonus` | number | temporary bonus to max HP |
| `deflectBonus` | number | temporary deflect value not tied to equipped armor or shield |

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

Individual actions cost 0, 1, 2, or 3 action points. The app does not enforce action costs — this is adjudicated at the table.

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
- **Secondary:** DM manually triggers via an **Injury button** on any combatant at any time (for injuries caused by other means)
- **Narrative override:** Any injury can be directly overwritten with a freeform entry when the injury is given for narrative/story reasons rather than mechanical ones

### Injury Count Tracking
A simple `injuryCount` counter is stored on the Player record, defaulting to 0. The DM increments and decrements it manually as injuries are applied or healed. This value is used as a reference when making subsequent injury rolls at the table. No automation — the counter is purely informational.

> **Future:** When the player-side app is built, players will be able to manage this counter themselves via a dedicated route. The data model does not need to change for this.

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

---

## Adversary / NPC Compendium Entry

### Stat block

| Field | Type | Notes |
|---|---|---|
| `id` | string | unique identifier |
| `name` | string | |
| `tier` | number | adversary tier extracted from stat block (e.g. 1, 2, 3) — used for filtering |
| `adversaryType` | string | e.g. "Minion", "Elite", "Boss" — used for filtering. Named `adversaryType` to avoid SQL/ORM reserved word conflicts |
| `size` | string | size and creature type bundled (e.g. "Medium Humanoid") — used for filtering |
| `hpMax` | number | upper end of the HP range — default 0 |
| `hpMin` | number | lower end of the HP range — default 0. DM selects the appropriate value when creating a combat instance |
| `focusMax` | number | default 0 |
| `investitureMax` | number | default 0 — hide in UI if 0 |
| `defensePhysical` | number | default 0 |
| `defenseCognitive` | number | default 0 |
| `defenseSpiritual` | number | default 0 |
| `deflect` | number | default 0 — never inferred from illustrations, only from stat block text |
| `movement` | number | default 0 |
| `dualPhase` | boolean | set to true only when Boss feature explicitly states the adversary acts in both Fast and Slow NPC phases — never inferred from `adversaryType` alone |
| `features` | AdversaryFeature[] \| null | list of named passive features, null if absent |
| `actions` | AdversaryAction[] | list of actions, always present |
| `additionalFeatures` | AdversaryAdditionalFeature[] \| null | opportunities, complications, story-gated actions, and other rare special features — null if absent |

### AdversaryFeature
```json
{ "name": "Feature Name", "description": "Feature description text." }
```

### AdversaryAction

```json
{ "name": "Strike", "cost": 1, "actionType": "action", "description": "The adversary makes a melee attack." }
```

**`cost`** is the action point cost as an integer derived from the action symbol in the source:

| Symbol | Meaning | Cost |
|---|---|---|
| ▶ | Standard action | 1 |
| ▶▶ | Two-action | 2 |
| ▶▶▶ | Three-action | 3 |
| ▷ | Free action | 0 |
| ↺ | Reaction | 0 |

**`actionType`** is either `"action"` or `"reaction"`. Reactions are marked with ↺ in the source. All other action types (including free actions) use `"action"`.

### AdversaryAdditionalFeature
```json
{ "name": "Opportunity", "description": "When the adversary misses..." }
```

Used for:
- **Opportunities** — name: `"Opportunity"`, one per adversary maximum
- **Complications** — name: `"Complication"`, one per adversary maximum
- **Story-gated or conditional actions** — actions only available under specific narrative conditions (e.g. swearing an Ideal). Full context and mechanical details preserved in the description. Named descriptively (e.g. `"Third Ideal: Action Name"`)
- **Any other special situational features** not captured by features or actions

---

## Compendium Categories

### Adversaries (Phase 3 — in progress)
Full structured stat blocks as defined above. Primary encounter-use section. Built first.

### Talents (Phase 3 — deferred)
| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `path` | string | which path this talent belongs to |
| `description` | string | full reference text |
| `tags` | string[] | for filtering |

### Surges (Phase 3 — deferred)
| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `surgeType` | string | e.g. Gravitation, Adhesion |
| `description` | string | full reference text |
| `tags` | string[] | for filtering |

### Equipment (Phase 3 — deferred)
| Field | Type | Notes |
|---|---|---|
| `name` | string | |
| `type` | string | weapon, armor, shield, other |
| `deflectValue` | number \| null | for armor/shields |
| `description` | string | |
| `tags` | string[] | |

### Rules Reference (Phase 3 — deferred)
Static content sections — not database entries:
- Basic actions (name + action point cost + description)
- Conditions (full list with effect descriptions)
- Injury tables (gravity and effect — referenced by injury roll dialog)
- Calculation tables

---

## Database Schema — Key Tables

### players
```sql
id, campaign_id, user_id, player_name, character_name, ancestry, paths_json,
level, hp_max, hp_current, focus_max, focus_current, investiture_max, 
investiture_current, movement, defense_physical, defense_cognitive, 
defense_spiritual, deflect, injury_count, color, image_url, overrides_json,
conditions_json, shared_notes, created_at, updated_at
```

### combatants
```sql
id, encounter_id, base_type, base_id, name, label, initiative, friendly,
color, hp_current, hp_max, hp_details, ac, ac_details, sort, used_reaction,
phase, action_points_used, dual_phase, overrides_json, conditions_json,
attack_overrides_json, created_at, updated_at
```

### compendium_adversaries
```sql
id, name, tier, adversary_type, size, hp_max, hp_min, focus_max,
investiture_max, defense_physical, defense_cognitive, defense_spiritual,
deflect, movement, dual_phase, features_json, actions_json,
additional_features_json, created_at, updated_at
```

---

## Development Phases

### Phase 1 — Data model ✅ Complete
- TypeScript types updated
- Database schema updated
- All routes, converters, schemas updated
- Build clean, server running

### Phase 2 — UI (in progress)
- ✅ Player create/edit form
- ✅ Player row display in Campaign view
- ✅ Conditions system — Stormlight list, stackable conditions, player conditions from Campaign view
- ✅ Player combat panel — Stormlight stats display
- ✅ Overrides panel — deflectBonus replacing acBonus
- ⬜ Four-phase combat tracker
- ⬜ Injury roll dialog
- ⬜ General D&D cleanup (remaining)

### Phase 3 — Compendium (in progress)
- ✅ Adversary database table and API routes
- ⬜ Adversary import tool
- ⬜ Adversary browser UI
- ⬜ Encounter integration (add adversary to encounter)
- ⬜ Talents, Surges, Equipment (deferred)
- ⬜ Rules Reference (deferred)

---

## Deferred / Future Additions
- Conversation encounters with mechanical implications
- Automated condition effects beyond Unconscious slow-lock
- Attribute scores on DM side (if player app is built out)
- Action point cost enforcement
- Talent/Surge mechanical automation (add if repetition proves it worthwhile)
- Player-side app (largely untouched, still D&D)
