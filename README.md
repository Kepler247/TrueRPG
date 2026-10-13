# RPG Companion

Angular SPA for managing characters and shared campaigns. Includes Supabase authentication, usernames, campaign and character creation, read-only character summaries, dedicated sheet editing, point buy, level-up workflows, and searchable system references for 501 Rads and plain 5E (2014).

## Local development

Node 22.18+ within the Node 22 release line and npm 11 are used by this checkout. npm 10.9.3 failed during initial installation; npm 11.21.0 succeeded.

```powershell
npx.cmd --yes npm@11.21.0 ci
npm.cmd start
```

Open http://localhost:4200.

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

For iPhone testing on the same LAN:

```powershell
npm.cmd start -- --host 0.0.0.0
```

Open http://192.168.0.141:4200 on the phone (use your current PC IP). The Windows Private-network inbound TCP 4200 rule allows this subnet. Initial real iPhone layout testing passed; recheck the new account form and keyboard behavior.

## Supabase authentication setup

Public browser configuration lives in src/app/core/auth/supabase.config.ts. The publishable key is intentionally public; database access must be enforced by RLS. Never put secret or service-role keys in this app.

In Supabase Authentication > URL Configuration:

- Site URL: http://localhost:4200
- Add redirect URLs: http://localhost:4200/auth and http://192.168.0.141:4200/auth
- Update the LAN redirect when your PC's address changes.

Keep email/password sign-in enabled. With email confirmation enabled, sign-up shows a check-email message. The confirmation link returns to /auth on the origin where registration started. Open it on a device that can reach that address (localhost only works on the PC). If confirmation is disabled, registration signs in immediately.

Smoke test: create an account, confirm email if required, sign in, reload to verify persistence, open Account and sign out. Test invalid passwords and phone inputs too. Automated checks mock Supabase and do not create live users.

Supabase's default email sender may restrict delivery to authorized addresses; configure custom SMTP before inviting other players. See https://supabase.com/docs/guides/auth/auth-smtp.

## Systems and domain

Systems are a shared catalog, independent of users. Each campaign and character has a systemId; characters keep that system even outside a campaign. Users can play across multiple systems. Characters assigned to a campaign must use its system, enforced by database constraints in the foundation migration.

The initial Wasteland entry is now named 501 Rads, with its original system ID preserved. Plain 5E (2014) is a separate selectable system and remains the default calculation foundation for other adapters. See [system references and implementation details](SYSTEMS.md) for imported documents, supported mechanics, and revision handling.

## Next milestones

1. Expand 501 Rads as the author supplies feats, classes, items, and revised rules.
2. Expand structured equipment and class mechanics as author definitions arrive.
3. Improve play workflows based on phone testing.
4. Cloudflare Pages deployment.

Production output: dist/rpg-companion/browser. No deployment has been configured.
See AGENTS.md for domain rules and development conventions.

## GitHub database integration

The Supabase project is connected to Kepler247/TrueRPG with production deployment from main and working directory '.' (repository root). Versioned database migrations live in supabase/migrations. This integration deploys database changes; Angular hosting is configured separately. See [database setup and permissions](supabase/README.md). Run npm.cmd run test:db to verify migrations and RLS locally.

## Profile setup

Open Account after signing in to choose a unique username and optional display name. Usernames are saved in lowercase and used for ownership labels throughout campaign/character screens. The Super master badge is read from the database, not editable profile metadata. Profile save/load failures have retry messages.

## Campaign and character creation

Campaigns and Characters load saved records from Supabase. Use New campaign to choose a name, system, and optional description; you become its GM automatically. Use New character to choose a name and system, optionally selecting a matching campaign where you are a member. Records show username ownership labels, and refresh restores saved lists. New characters start with a versioned sheet initialized by their selected ruleset.

If campaign creation fails immediately after updating, check that migration 20261012070000_campaign_owner_visibility.sql deployed. It fixes owner visibility during INSERT RETURNING before automatic membership is added.

## Shared character sheets, creator, and leveling

Click a character name to open its sheet. New character includes physical details and 27-point ability-score purchase. Sheets include stats/saves, all 18 baseline skills, initiative, inventory, and general abilities. Owners, GMs, and super-admins can save sheets; party members get read-only views. Level-up collects required choices and saves immediately when applied. Failed level-ups remain available to retry without advancing twice. See [character foundation](CHARACTER_FOUNDATION.md) for rules defaults and extensibility.

## Character summary and editing

The default character URL (/characters/:id) is a compact summary with quick current-HP and Heat controls for authorized editors. Damage/healing, Heat gain/spend, reset, and Save resources save immediately with optimistic concurrency. Missing current HP on an older character displays its maximum until first tracked. General sheet editing and campaign carrying rules remain on /characters/:id/edit. Level up opens that page's choice workflow and applying it saves the sheet, including other unsaved edits.

Tap ability modifiers, saving throws, skill totals, initiative, or the proficiency bonus to roll a d20 plus the displayed modifier. A dismissible result shows the raw die, modifier, and total. Rolls stay local and do not change or save character data; authorized party viewers can roll too.

## Character creator menu

Characters > Character creator opens `/characters/new`. Choose a system, class, details, and point-buy scores. A live starting-sheet preview shows final scores, modifiers, saves, skills, HP, hit die, initiative, speed, system rules, and starting abilities. The saved character uses that same initialized preview and opens its summary after creation.

For 501 Rads, Gunslinger is selected as its currently defined class. Starting HP is 10 + Constitution, Heat starts at 0 with a maximum of 3, and Lucky Strike, Stroke of Genius, and Pistol Training are included. Hacking replaces Arcana. The character summary displays system rules and quick resource/ability actions; level-up choices open the edit page and save immediately when applied.

## Catalogs, ability actions, pictures, and campaigns

See [play components](PLAY_COMPONENTS.md) for testing and implementation details. Systems now have searchable item/shared-feat catalogs with labeled mock fixtures. Import items from a character's Inventory editor; select shared feats during level-up. Gunslinger paid abilities spend Heat directly from the summary, with Lucky Strike rerolls and Stroke of Genius three-die choices.

Upload a profile picture from Account or a portrait from character Edit. Open campaign names for party HP/resource overviews, username invitations, and member management. Players accept invitations from Campaigns. Character owners/admins can assign existing characters to matching-system campaigns from Edit. Pictures and invitations require migration `20261013000000_images_and_campaign_invitations.sql` to deploy.


Character summaries include confirmed short/long rests, persisted Hit Dice, equipped inventory and quantity/consumption actions. Limited-use abilities can specify short-rest, long-rest or manual recovery on the edit page. Failed play actions retain the exact result for retry. See [PLAY_COMPONENTS.md](PLAY_COMPONENTS.md) for recovery details and current manual mechanics.


D&DS (Dogfights and Deep Space) is available as a third system, with its original PDF, searchable lore/rules, setting character options and personal equipment. See [DNDS.md](DNDS.md) for automated rules, author-authorized estimates and reference-based mechanics. Ship combat remains PDF-only.
