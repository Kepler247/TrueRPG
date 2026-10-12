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
