# Play components

## System catalogs and mock entries

Systems > Items and shared feats opens the catalog. Search or filter weapons, gear, consumables, and shared feats. Test pistol, Test sword, Test water, Test pack, and three shared test feats are deliberate fixtures. Example weights exercise carrying totals; no weapon damage/range/ammunition, armor, healing, or feat bonuses are invented. Mock metadata is carried into imported inventory/feat records and displayed on the summary. The plain 5E catalog also exposes the existing SRD Grappler choice.

On a character edit page, choose a catalog item and Add catalog item, then Save sheet. Each import receives an independent LAN-compatible entry ID and retains catalog provenance. These are snapshots, so catalog revisions do not silently replace customized inventory. Feat catalog choices appear in the level-up workflow and remain class-independent.

## Gunslinger ability actions

Unlocked paid abilities expose Use buttons on the character summary. Costs are supplied by the active rules adapter and use the class-resource abstraction. The action saves its cost and use count with the existing optimistic concurrency check before producing its roll effect. Failed requests preserve the stored resource and previous roll.

Lucky Strike requires a prior local check and replaces it with a new roll using the same die and modifier. Stroke of Genius spends 3 Heat and prepares the next tapped check for three rolls; choose any result. A second ability cannot be charged while that prepared roll or choice is pending. Prepared rolls are local to the open sheet; spending an ability does not create an automatic refund on navigation. Other paid abilities deduct their defined Heat and show their rules text for GM resolution. Divine Intervention use counts persist; consequence probabilities remain undefined rather than invented.

Successful-roll Heat awards require manual GM/player input because the lightweight roller has no DC, target, or combat adjudication. Attack damage, Deadeye targets/delay, Distraction eligibility, and narrative effects remain resolved at the table.

## Pictures

Account accepts a profile picture; character Edit accepts a portrait, displayed on the main sheet. JPEG, PNG, and WebP are supported up to 5 MB, with client format signatures checked and bucket MIME/size limits configured. Uploads use generated filenames and save immediately without replacing character gameplay data. Replacing/removing pictures attempts to delete the old Storage object. Cleanup is best effort; a network/permission change can leave unreferenced files for admin cleanup.

The `rpg-images` bucket is private. Profile image access follows profile visibility (self, shared campaign, admin); profile writes are self/admin. Character image reads follow character visibility, and writes allow owner, campaign GM, or admin. Signed URLs last ten minutes; previously issued URLs may remain usable until expiry after membership removal. Storage policies inspect entity IDs in the path rather than trusting client ownership metadata. Profile/character rows constrain their picture references to their own folders. Super-admins can manage orphaned pictures too.

Image link updates check the entity's loaded timestamp when supplied. A stale upload is not attached and its new object is cleaned up where permissions permit. An image change updates the editor's metadata timestamp without discarding unsaved sheet edits.

## Campaigns

Open a campaign name to view its members and party overview: owner labels, classes, level, current/max HP, and class resources. The GM/admin can invite an existing username. Players see in-app invitations on Campaigns and explicitly accept or decline. Acceptance alone creates membership. No external email or messages are sent.

GM/admin member removal detaches that player's campaign characters and preserves their sheets; the campaign owner cannot be removed. Existing character owners/admins choose campaign assignment on Edit. Choices use the character owner's membership and matching system. Assignment uses a checked RPC with a row lock and expected timestamp, delegating to the existing protected assignment function. It returns one atomic character/carrying-permission snapshot so later saves cannot accidentally adopt a newer unrelated edit's timestamp.

## Validation

Run `npm.cmd run build`, `npm.cmd test -- --watch=false`, and `npm.cmd run test:db`. The database runner applies exact migrations in PostgreSQL with the managed Auth/Storage metadata tables stubbed; it tests RLS and RPC behavior, not live binary upload transport. App tests mock hosted services. Recheck actual image picking/uploading and invitations with two accounts on iPhone Safari after deployment.


## Rest and equipment tracking

Summary pages support confirmed short and long rests using the system adapter's SRD 5.1 defaults: one hour short rest, eight hours long rest (six asleep), one Hit Die per character level, Constitution added to each healing roll with minimum zero healing. Spend dice one at a time; long rests restore HP and recover half total Hit Dice rounded down, minimum one. 501 Rads inherits these base rules and resets Heat on a long rest. Players confirm in-game duration, interruption conditions, starting HP and the once-per-24-game-hours limit; browser elapsed time is not game time. Racial exceptions and class-specific rest features remain manual.

Spent dice are stored in optional `core.hitDiceSpent`, so old characters begin with all dice available and leveling increases the available pool. Rest records store kind, recording time and HP recovery. Abilities recharge only when explicitly configured on the edit page; unspecified counters (including lifetime Gunslinger uses) are preserved. Limited-use ability buttons spend one use and save. Spell slots and class-specific recovery are not inferred from feature prose.

Inventory entries support equipped status, +1 quantity, and removing/consuming one unit; the final unit removes the entry. Equipped status is descriptive: slots, armor bonuses, damage, ammo and proficiency await rules definitions. Catalog consumables carry a category so their action reads Consume one. No automatic effects are invented. Unknown fields and item provenance survive these updates.

Failed play-action saves retain their exact result for Retry save; other play writes are blocked until retry or discard. Concurrency conflicts require reloading and reconciling with the newer sheet. No database migration is needed for these additive validated core fields.


## 501 Rads mutations

The current reference is `mutations-1` (125 pages), imported unchanged from the author's revised PDF. The original 69-page draft is retained as a historical asset. `scripts/import-rads-mutations.py` imports the reference and exactly 100 positive/100 negative definitions, stripping closing commentary from the last entries. The app does not fabricate numerical modifiers for descriptive effects.

Mutation snapshots live in optional `core.radsMutations`: stable catalog ID, table number, polarity, name, description, acquisition timestamp and source revision. Unknown snapshot/core fields survive saves. Rules-adapter validation rejects invalid, newer unsupported or duplicate entries. Each roll uniformly samples the remaining entries of the chosen table; there is no mutation-count ceiling. An exhausted finite catalog reports no eligible mutation instead of repeating one. Grants use existing owner/GM/admin edit authorization, while party viewers may read the menu.

The picker commits one draw, shows a reduced-motion-aware DNA animation and reveals only after saving. Failed saves keep the exact draw and pending sheet for retry through the existing optimistic-concurrency path. Positive mutations are rewards/treatments. The negative picker is attached to explicit death confirmation; it sets HP to zero and stores a 30-minute reconstitution state. Recovery uses **game time**, confirmed by the player/GM; page reload or elapsed wall time never resurrects the character automatically. Healing and rest cannot bypass the pending state. Completion clears the state and saves 1 HP. Recovery persists across devices through the character payload. No cure/removal or mutation-derived stat bonuses have been invented; once-per-session effects remain reference text until session tracking is defined.
