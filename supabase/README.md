# Database foundation

The migrations define profiles, systems, campaigns, campaign_members, characters, and private.super_admins. They seed Wasteland and grant the existing production Auth UID super-admin access. No users or passwords are created by these migrations.

## Permissions

| Resource                                        | Owner          | Campaign GM       | Other member      | Super-admin |
| ----------------------------------------------- | -------------- | ----------------- | ----------------- | ----------- |
| Character read                                  | Yes            | In their campaign | In their campaign | All         |
| Character content edit                          | Yes            | In their campaign | Own only          | All         |
| Character delete                                | Yes            | Own only          | Own only          | All         |
| Character campaign assignment                   | Yes            | Own only          | Own only          | All         |
| Campaign edits/delete and membership management | Campaign owner | Yes               | No                | All         |

All characters require a system. Campaign assignment requires the same system and owner membership. Owners are automatically campaign members. Deleting a campaign or removing a member detaches affected characters rather than deleting them. A campaign's owner cannot be removed from membership.

Ownership, system IDs, row IDs, and timestamps cannot be changed through ordinary browser UPDATE requests. Ownership transfer and system conversion need explicit workflows before they are supported. Super-admin has access to all application records but still follows database integrity constraints; this role is not a Supabase infrastructure administrator.

Character assignment uses rpc('set_character_campaign', { character_id, target_campaign_id }); pass null to detach. An authenticated caller can query rpc('is_super_admin') for their own role. Role grants remain private and are changed only through trusted SQL/migrations. Helpers use a private schema, security-definer execution, and fixed search paths to avoid recursive RLS and caller-controlled object resolution.

Profiles contain no email addresses. They are visible to their owner, shared-campaign participants, and super-admins. Usernames are optional until onboarding is implemented, globally unique, lowercase, 3-30 characters, starting with a letter, followed by letters, digits, or underscores. Display names are separate and need not be unique. Account deletion is not implemented; foreign keys prevent deleting profiles with owned records.

## Testing

```powershell
npm.cmd run test:db
```

The test harness runs these exact migrations in in-memory PostgreSQL via PGlite, using nonprivileged authenticated/anonymous roles and a minimal stub of Supabase Auth's users table and auth.uid(). It tests policies, column grants, RPCs, triggers, usernames, and referential integrity. It does not test hosted PostgREST behavior, multi-connection concurrency, or Supabase deployment infrastructure. No remote data is touched.

## Deployment

Supabase GitHub integration: working directory '.', production branch main, Deploy to production enabled. Push these migrations to main to trigger deployment. Inspect Supabase deployment logs to confirm both migrations completed. The super-admin migration deliberately fails if the expected Auth UID is absent; preview projects will need a separate bootstrap strategy before enabling preview branching.

In the Supabase SQL Editor, verify:

```sql
select id, username, display_name from public.profiles;
select id, slug, name from public.systems;
select user_id from private.super_admins;
```

The last query should contain 70dd7f1e-b52c-451e-a1c2-e7ebe59b6fe2. SQL Editor uses administrative access; browser permissions must still be checked through authenticated requests.

After application, never edit deployed migration files: add a new migration. No production reset is needed.

## Planned extensions

- Profile setup UI to choose usernames and display names; owner labels show usernames.
- Each system becomes a hub for world lore, rules references, and an item catalog, shared across its campaigns.
- System-specific character schemas/mechanics and theme selection remain independent of common auth/ownership infrastructure.
- Profile pictures and character portraits use Supabase Storage; database rows store file paths rather than image bytes. Storage policies must enforce upload ownership and read visibility. Buckets and upload flows are not created yet.
