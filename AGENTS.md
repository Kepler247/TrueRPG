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
