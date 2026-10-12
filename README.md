# RPG Companion

Angular SPA for managing characters and shared campaigns. This foundation includes responsive navigation and lazy feature routes. Authentication and persistence are not implemented yet.

## Local development

Node 22.18+ within the Node 22 release line and npm 11 are used by this checkout. npm 10.9.3 failed during initial installation; npm 11.21.0 succeeded.

```powershell
npx.cmd --yes npm@11.21.0 ci
npm.cmd start
```

Open http://localhost:4200. Use Chrome device emulation for initial layout checks; test real iPhone Safari before deployment.

```powershell
npm.cmd run build
npm.cmd test -- --watch=false
```

## Next milestones

1. Supabase project configuration and authentication.
2. Profiles, campaigns, memberships, characters, and database RLS.
3. Character editing and campaign membership workflows.
4. iPhone Safari verification and Cloudflare Pages deployment.

Production output: `dist/rpg-companion/browser`. No deployment has been configured.
See AGENTS.md for domain rules and development conventions.

