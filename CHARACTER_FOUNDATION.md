# Shared character foundation

Character ownership, campaign assignment, and system association remain relational metadata. Gameplay data now lives in `characters.data.core` with `data_version = 2`. Unrecognized payload and core fields are preserved. Existing version-1 empty sheets receive a draft core when opened and are upgraded only when saved. Invalid or newer-version data is rejected rather than silently overwritten.

The current default is the 2014 5E SRD 5.1 foundation: six ability scores and their modifiers, saving-throw proficiency, all 18 skill definitions, skill proficiency/expertise, initiative, level-based proficiency bonus, size-aware carrying capacity, and 27-point ability-score purchase. This does not implement every 5E class, race, feature, spell, or combat rule. Sources and attribution are in public/rules-attribution.txt.

## Character sheets

Click a character name in the Characters list. Its owner, campaign GM, and super-admin can edit; other authorized campaign players get a read-only sheet. Database RLS remains authoritative. Saves use updated_at as an optimistic concurrency condition: a stale editor must reload instead of overwriting another save. Navigation and page reload warn about unsaved edits.

The sheet includes level, maximum HP, movement distance/unit/basis, description, height and body weight, base scores, save training/adjustments, skill training/adjustments, initiative adjustment, size, carrying capacity override, inventory with quantity and unit weight, and general abilities.

Inventory weight and body weight are in pounds; body weight is not automatically included in carried inventory. Height is in inches. Movement defaults to 30 feet per turn, and can explicitly use meters or per-action movement. Defined class adapters initialize maximum HP; characters without a defined class keep it unset until entered.

Abilities have a name, kind, description, optional maximum uses, and optional spell level (0-9). A kind of spell shows the spell-level field; other kinds can represent perks, talents, or features. This is an ability-record framework, not yet a spellbook with slots, automatic recovery, or class progression.

A GM or super-admin can toggle carrying-capacity enforcement for the entire campaign from a member sheet's Inventory section. It is stored on campaigns.enforce_carry_weight and immediately saved separately from the character draft. Disabling it removes over-capacity warnings; weight/capacity values remain visible. No character data is deleted or blocked from saving solely because it is over capacity.

## Interactive creator

New character now collects name, description, optional height and weight, system, optional campaign, and interactive point-buy scores. Scores start at 8, top out at 15 during point buy, and use a 27-point budget with nonlinear costs at 14 and 15. A standard-array shortcut assigns 15/14/13/12/10/8; players can adjust that allocation. Unspent points are allowed for draft characters and are visible before creation. Overspending is blocked.

Race and class selectors appear only when the selected ruleset supplies catalogs. 501 Rads supplies Gunslinger and no race catalog yet. Plain 5E supplies the SRD races and twelve classes. Selecting a new system clears old race/class selections. Racial boosts apply after point buy at creation; class HP and saving proficiencies follow the selected adapter.

## Ruleset boundary

src/app/core/characters/character-ruleset.ts defines CharacterRuleset, BASE_5E_RULES, extendRuleset, and the registry used by creator and sheet. A system's database ruleset_key selects its adapter. Both 501 Rads and plain 5E extend the common baseline; the legacy wasteland key resolves to the 501 Rads adapter.

Adapters can replace the skill catalog (using resolveSkills to add/remove/override definitions), replace calculation functions, supply race/class catalogs, and supply level-specific prompts. Default saving throws, skill bonuses, and initiative use the active ruleset's modifier/proficiency functions, so changing those inputs propagates consistently. Saved skill training remains intact when a skill is omitted from a catalog.

501 Rads overrides the maximum level to 12 and allows scores above 30. Plain 5E retains levels 1-20 and the usual score range. The shared schema permits system-specific higher scores; the selected adapter validates its actual limits on save. Rule adapters are code-defined. Complete searchable documents and themed 501 Rads lore are available in system hubs; dedicated structured item catalogs and image uploads remain future work. See [system implementation](SYSTEMS.md).

## Level-up foundation

Level up opens a choice workflow: review the next level's prompts, allocate stat points when required, record feat choices, and choose a fixed or rolled hit die when defined. Applying it increments level and maximum HP, includes retroactive Constitution adjustments, adds unlocked class references, and saves immediately, including other sheet edits. Proficiency and trained saves/skills recalculate immediately. Failed requests preserve the pending level-up for Save sheet retry and block further advancement until it saves. The adapter's maximum level disables advancement.

Undefined classes retain manual HP increases and generic prompts. Detailed subclass and spell decisions still use the reference and editable ability fields. Directly changing Constitution or Level outside the dedicated level-up workflow does not automatically rewrite manually entered HP.

## Verification and phone checks

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
npm.cmd run test:db
```

On iPhone: create a point-buy character; open its name; set maximum HP and training; add an item and an ability; save and refresh. Try Level up and Save sheet. For a campaign character, test the carrying-rule switch as GM/admin. LAN HTTP is supported: entry IDs use crypto.getRandomValues rather than HTTPS-only randomUUID.

Automated tests use real embedded PostgreSQL for RLS/constraints and mock the hosted API for application flows. New sheet/creator layouts still need real iPhone Safari verification.

## Character summary and editing

The default character URL (/characters/:id) shows compact stats, skills, inventory, abilities, and details, plus quick current-HP and Heat controls for authorized editors. These save immediately through the same optimistic-concurrency service. Current HP uses optional `core.hpCurrent` (0 through maximum HP); legacy records without it display their maximum. Tracked current HP is preserved during level-up. Other authorized party members see resource values and can use local dice rolls but cannot save changes.

Tap modifiers, saves, skill totals, initiative, or proficiency to roll the adapter's check die (d20 by default) plus the displayed value. The result shows the die, modifier, and total; it does not mutate the character or infer success/failure. Entry and dice randomness use LAN-compatible `crypto.getRandomValues`.

Edit character opens /characters/:id/edit for general sheet changes and campaign carrying rules. Unsaved-edit warnings still protect failed level-ups and other draft edits when leaving that page.
