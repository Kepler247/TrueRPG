# 501 Rads core-1 implementation

Authoritative source: `501 Rads (3).pdf`, 275 pages. Current PDF values override earlier interpretations, with the latest author instructions removing carry weights and adopting physical-dice weapon references. This is an implementation checkpoint; the complete rules rollout and large playtest are still in progress.

## Implemented foundation

- Six classes with published hit dice, starting HP, saves, movement, AC/caps and weapon categories; maximum level 12, unrestricted stat increases, two points per level and shared feats at 3/6/9/12.
- Creation supports Standard Array or 27-point buy, four distinct skills with two primary-stat skills, a proficient Pipe weapon, one starting-chip roll and the eligible light-armor exchange.
- All 108 class feature entries include source text; all 30 published shared feats and 86 weapons are cataloged alongside armor and 26 consumables. 501 Rads no longer uses item weights, carrying totals/caps, overrides or campaign carrying controls. Optional body weight remains descriptive.
- Progression adds source features and fixed/rolled HP with retroactive Constitution. Scholarly Training prompts both skill choices. Published class/feat descriptions cannot be accidentally edited or removed as custom abilities.
- Resources use source trigger blurbs, exact level capacity/gain multipliers and long-rest resets. Awards remain explicit because meaningful success and farming are GM decisions.
- Persistent active effects combine scoped flats, advantage/disadvantage, damage/speed multipliers and conditions. Benefits are blue, drawbacks red, contextual entries gray; mixed effects show both colors and every card has a text label and rule description.
- Self buffs include Psycho drug combinations, their delayed/refreshed aftermaths, Medic Performance Enhancing Drugs, Soldier Hold the Line, Prophet Judgment Day, Gunslinger Fan the Hammer and Wild Plan. Unmodeled target/narrative abilities create explicit GM-resolution entries, not invented modifiers.
- Check results explain sources. Passive class bonuses, relevant feat circumstances, sensory automatic failures, and condition-based attack/check/save changes use the same resolver. Current display totals use that resolver too.
- Standard, Bonus, Skill and Reaction pools are separate. SuperSoldier adds one standard-or-bonus action; UltraSoldier adds two. Neither buys Skill Actions or Reactions. First two class roll abilities cost no action. Experimental Stimulant adds only a standard Action on the next turn.
- Effects use explicit game seconds/own turns, never elapsed browser time. Manual End starts drawbacks. Required damaging/radiation consequences cannot disappear when skipping time and block further actions/rolls/time until resolved. Psycho redosing postpones its crash; other classes retain the original deadline.
- Incoming damage composes applicable reductions/multipliers/resistance/immunity before temporary HP and lethal damage. Burning queues its turn damage; extinguishing can spend an Action. Built Different has a persisted long-rest use. Ordinary healing does not bypass death/reconstitution.
- Consumable self use spends its Bonus Action and quantity atomically. Healing, timed drugs, antidotes, food/rest benefits, temporary/permanent mutation grants and radiation consequences have their defined self effects. Next-check-only food/water/fatigue effects show explicit instructions to End after the applicable check.
- Rad Enthusiast saves two choices before applying one. Critical Mass damage queues a reroll excluding 12. Atomic Sneeze applies self damage and prompts GM resolution of nearby creatures.
- Weapon entries show combined physical-dice Attack roll and Damage roll formulas, incorporating saved proficiency, accuracy, class bonuses, current buffs/drawbacks, flat damage adjustments and multipliers. Viewing a formula never rolls, saves, spends ammo/actions or ends next-attack effects.
- Target-dependent bonuses remain explicitly conditional in the formula. No enemy effects, live distance/movement/cover controls, hit determination or scatter calculations are performed. Weapon-family rules and critical-hit rules remain readable references for the table.
- Ammo/firing counts use explicit manual controls; throwable quantities use inventory controls. End next-attack effects manually after the attack. This workflow applies across all systems.
- Wallet conversion is exact: 100 dollars to one chip, 100 chips to one fusion cell. Fusion cells have one wallet balance for future vehicle fuel use.

## Migration and persistence

Legacy Gunslinger statistics/features are replaced by the current class definition on load, without immediately writing to the server. Old HP/speed/saves/abilities are retained under `radsLegacy`. Historical HP rolls were unavailable, so migrated HP uses the published fixed progression and visibly explains that choice. Unknown fields survive. The new additive state lives in `core.rads` with revision `core-1`; unsupported revisions are rejected. Existing optimistic concurrency and database authorization still govern saves. No database migration is required for this checkpoint.

## Remaining before claiming the full rollout complete

- Exceptional death abilities and descriptive biological or narrative outcomes still require GM choices. Descriptive mutation effects stay as authored rather than receiving fabricated numerical bonuses.
- Unique legendary-weapon, target/save and multi-attack rules remain reference text for physical play; do not reintroduce a live combat calculator.
- Next-check/next-attack-only effects are manually ended, by design.
- Structured NPC/vehicle/loot workflows. Their full rules remain available in the reference; wallet support alone is not vehicle automation.
- Browser/mobile playtest of the complete workflows after the remaining phases.

## Verification

Run `npm.cmd run build`, `npm.cmd test -- --watch=false`, and `npm.cmd run test:references`. The reference command verifies all retained PDF hashes/page counts and independently checks all 86 weapon rows against current source text, including the absence of an accuracy column on throwables. Interaction tests cover advantage/disadvantage cancellation, class passives, drug combinations, expiring action pools, damaging crashes, Psycho redosing, temporary HP, radiation choices, physical-dice formulas, manual weapon-buff completion, negative modifiers, starting gear, currency conversion and migration. UI tests verify color/text labels, mixed effects, full rules, aftermath creation and read-only controls. These checks do not replace the upcoming actual phone and multi-account playtest.


## Ability and mutation checkpoint (2026-10-14)

- Ability choices now support self-prescription stat pairs, biological adaptations and mutation treatments. Select another recipient to spend the Medic resource without applying an effect to the Medic. The recipient records public treatments separately; this is intentionally not a cross-character database write. Received Questionable Prescription stat choices remain GM-resolved and secret. Self-administered doses show their selected modifiers.
- Timed Hacker, Soldier and Prophet benefits/reminders use game time. Conditional benefits apply only to the relevant task or remain labeled conditional on physical-dice weapon references. Narrative control, target eligibility, extraordinary defenses, ally participation and preparation remain GM-resolved. Coordinated Assault and Divine Retribution enforce once-per-round activation using the manual game clock.
- Mutation views include permanent and borrowed traits, suppression, amplification and inactive recovery. Medicine suppresses one negative mutation for 30 minutes after the required treatment; Evolution amplifies a positive mutation for 10 minutes, then disables it for 10 minutes. Ending amplification early starts recovery. Organ Donation records eligible beneficial traits for 10 minutes on donor/recipient sheets; ordinary senses/adaptations can be recorded as a GM-resolved reminder. Recipient duplicates are rejected. Temporary states do not delete permanent grants or alter grant history.
- The GM/Medic confirms treatment eligibility and preparation before recording a treatment. The menu does not itself pay another character's resource cost or invent numerical bonuses for descriptive mutations.
- Main-sheet speed now reflects the same active modifiers as the detailed derived statistics.
- Verified: production build, 331 tests across 30 files, PDF integrity/page counts, and all 86 weapon reference rows. Automated ability checks cover published resource costs for every active ability across all six classes, preserving original inputs and unknown future data. Additional tests cover self/received prescription isolation and mutation phase transitions. A phone and multi-account playtest remains necessary.
