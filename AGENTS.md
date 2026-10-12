# RPG Companion

## Stack and conventions

- Angular 21 standalone components, strict TypeScript, SCSS, Angular Material.
- Supabase Auth and PostgreSQL; authorization belongs in database RLS.
- Client-rendered SPA, intended for Cloudflare Pages.
- Prefer signals for local state, inject() for dependencies, and lazy feature routes.
- Organize by feature; keep game-specific character data separate from ownership metadata.
- Mobile-first responsive layouts: 44px minimum touch targets, 16px form text, safe-area padding, visible focus, no horizontal overflow.
- Use npm.cmd/npx.cmd in Windows PowerShell when script execution blocks npm.ps1.

## Domain

- Users own multiple characters and can join/own multiple campaigns.
- Each character has exactly one owner and zero or one campaign.
- Character owners always view/edit their characters.
- Campaign owners view/edit all characters in their campaigns.
- Other campaign members view characters but cannot edit them.
- Delete, transfer, invitation, and membership-removal behavior are not yet decided.
- Never place a Supabase service-role key in browser code.

## Verification

Run npm.cmd run build and npm.cmd test -- --watch=false after functional changes.
Do not publish or create external resources unless requested.

## Systems

- Systems define rulesets and may select themes. First system: Wasteland (working title), a Fallout-inspired postnuclear RPG.
- Campaigns and characters require systemId; campaign-less characters still have a system.
- A character can only join a campaign with the same systemId; enforce this in the eventual database schema.
- Keep rules engines, versioned character data, and theme selection separate from shared auth/campaign infrastructure.
- Do not invent game mechanics before the user defines them. The user authorizes clearly labeled mock items and shared feats for testing; fixture values must not be presented as official rules.

## Database

- Run npm.cmd run test:db after schema or policy changes; tests execute exact migrations in real embedded PostgreSQL with stubbed Auth objects.
- Never edit applied migrations; add new versioned migrations.
- GMs manage membership; deleting campaigns/removing members detaches characters. Character deletion is owner/admin only.
- Protect ownership and system columns; assignment uses set_character_campaign RPC.
- Usernames belong in profiles, not Auth metadata; roles belong in private.super_admins.
- System hubs contain lore, references, and test catalogs. Private Supabase Storage uploads use entity-scoped image policies; profiles store avatar_path and characters store portrait_path. In-app campaign invitations require the intended player's acceptance.

## Character rules

- Shared data is versioned under characters.data.core; preserve unknown system data and do not overwrite invalid/newer payloads.
- Use the active CharacterRuleset adapter for derived calculations; do not hardcode system exceptions in sheet components.
- Base calculations follow SRD 5.1. Keep rules attribution available. HP, race/class effects, and detailed progression require system definitions.
- Use optimistic concurrency for sheet saves and preserve unsaved edits on failed requests.
- Entry IDs must work on LAN HTTP iPhone tests; avoid relying on secure-context-only crypto.randomUUID.

## Character presentation

- Character detail URLs show summaries with authorized quick current-HP/Heat controls and local dice rolls. Keep general sheet editing controls on /characters/:id/edit. Applying a level-up saves immediately; preserve failed level-up changes for retry without advancing twice.
- Summary layouts must remain compact and readable on phones, including skill totals and stat modifiers/saves.
- Write text assets as UTF-8; use HTML entities or escaped Unicode for symbols when shell encoding could corrupt them.
