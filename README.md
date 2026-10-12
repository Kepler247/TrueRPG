# RPG Companion

Angular SPA for managing characters and shared campaigns. Includes responsive navigation, Supabase email/password authentication, and a bootstrap systems catalog. Database migrations and permission tests are included; character/campaign editing UI and game mechanics are not implemented yet.

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

The initial catalog entry is Wasteland (working title), our Fallout-inspired postnuclear system. No mechanics are defined yet. rulesetKey and themeKey reserve independent selectors for future rules engines and themes; they do not currently switch styling or calculate stats. Character data has its own version, leaving ownership and membership consistent across systems.

## Next milestones

1. Deploy/verify database migrations, then profile setup and real campaign/character creation.
2. Define the first system's character data and mechanics.
3. Character editing, campaign workflows, system selection and themes.
4. Cloudflare Pages deployment.

Production output: dist/rpg-companion/browser. No deployment has been configured.
See AGENTS.md for domain rules and development conventions.

## GitHub database integration

The Supabase project is connected to Kepler247/TrueRPG with production deployment from main and working directory '.' (repository root). Versioned database migrations live in supabase/migrations. This integration deploys database changes; Angular hosting is configured separately. See [database setup and permissions](supabase/README.md). Run npm.cmd run test:db to verify migrations and RLS locally.

## Profile setup

Open Account after signing in to choose a unique username and optional display name. Usernames are saved in lowercase and used for ownership labels in upcoming campaign/character screens. The Super master badge is read from the database, not editable profile metadata. Profile save/load failures have retry messages; no migration is needed for this screen.

## Campaign and character creation

Campaigns and Characters now load saved records from Supabase. Use New campaign to choose a name, system, and optional description; you become its GM automatically. Use New character to choose a name and system, optionally selecting a matching campaign where you are a member. Records show username ownership labels, and refresh restores saved lists. Character sheets and membership-management UI are the next feature; new character data starts empty rather than assuming rules.

If campaign creation fails immediately after updating, check that migration 20261012070000_campaign_owner_visibility.sql deployed. It fixes owner visibility during INSERT RETURNING before automatic membership is added.

## Shared character sheets, creator, and leveling

Click a character name to open its sheet. New character now includes physical details and 27-point ability-score purchase. Sheets include stats/saves, all 18 baseline skills, initiative, inventory, and general abilities. Owners, GMs, and super-admins can save sheets; party members get read-only views. Level up applies a reviewed draft with HP input and optional feature; save to persist. See [character foundation](CHARACTER_FOUNDATION.md) for rules defaults, extensibility, and the system-specific work still pending.

## Character summary and editing

The default character URL (/characters/:id) is a read-only summary with compact stats, skills, inventory, abilities, and details. Edit character opens /characters/:id/edit. All field changes and campaign carrying-rule controls live on that dedicated edit page. Level up links to the edit page with the level-up workflow open. Unsaved-edit warnings apply when leaving the edit page.
