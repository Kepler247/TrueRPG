-- Shared ownership model; ruleset-specific payloads remain versioned JSON objects.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
grant usage on schema private to authenticated;

create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  username text unique check (username ~ '^[a-z][a-z0-9_]{2,29}$'),
  display_name text not null default '' check (char_length(display_name) <= 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.systems (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null check (char_length(trim(name)) between 1 and 100),
  description text not null default '',
  ruleset_key text not null,
  theme_key text not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  system_id uuid not null references public.systems(id),
  name text not null check (char_length(trim(name)) between 1 and 150),
  description text not null default '',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, system_id)
);
create table public.campaign_members (
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  user_id uuid not null references public.profiles(id),
  joined_at timestamptz not null default now(),
  primary key (campaign_id, user_id)
);
create table public.characters (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references public.profiles(id),
  system_id uuid not null references public.systems(id),
  campaign_id uuid,
  name text not null check (char_length(trim(name)) between 1 and 150),
  data_version integer not null default 1 check (data_version > 0),
  data jsonb not null default '{}'::jsonb check (jsonb_typeof(data) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (campaign_id, system_id) references public.campaigns(id, system_id)
    on delete set null (campaign_id),
  foreign key (campaign_id, owner_id) references public.campaign_members(campaign_id, user_id)
    on delete set null (campaign_id)
);
create table private.super_admins (
  user_id uuid primary key references auth.users(id) on delete cascade,
  granted_at timestamptz not null default now()
);
alter table private.super_admins enable row level security;
revoke all on private.super_admins from public, anon, authenticated;

create index campaigns_owner_idx on public.campaigns(owner_id);
create index campaigns_system_idx on public.campaigns(system_id);
create index members_user_idx on public.campaign_members(user_id, campaign_id);
create index characters_owner_idx on public.characters(owner_id);
create index characters_campaign_idx on public.characters(campaign_id, owner_id);
create index characters_system_idx on public.characters(system_id);

create function private.is_super_admin() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from private.super_admins where user_id = (select auth.uid()));
$$;
create function private.owns_campaign(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaigns where id = target and owner_id = (select auth.uid()));
$$;
create function private.in_campaign(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.campaign_members where campaign_id = target and user_id = (select auth.uid()));
$$;
create function private.shares_campaign(target uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.campaign_members mine
    join public.campaign_members theirs on theirs.campaign_id = mine.campaign_id
    where mine.user_id = (select auth.uid()) and theirs.user_id = target
  );
$$;

create function private.touch_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin new.updated_at := now(); return new; end;
$$;
create trigger profiles_updated before update on public.profiles for each row execute function private.touch_updated_at();
create trigger systems_updated before update on public.systems for each row execute function private.touch_updated_at();
create trigger campaigns_updated before update on public.campaigns for each row execute function private.touch_updated_at();
create trigger characters_updated before update on public.characters for each row execute function private.touch_updated_at();

create function private.create_profile() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles(id, display_name)
    values (new.id, left(coalesce(new.raw_user_meta_data->>'display_name', ''), 100));
  return new;
end;
$$;
create trigger auth_user_profile after insert on auth.users for each row execute function private.create_profile();
-- Backfill the account already registered before this migration.
insert into public.profiles(id, display_name)
select id, left(coalesce(raw_user_meta_data->>'display_name', ''), 100) from auth.users;

create function private.add_campaign_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.campaign_members(campaign_id, user_id) values (new.id, new.owner_id);
  return new;
end;
$$;
create trigger campaign_owner_membership after insert on public.campaigns for each row execute function private.add_campaign_owner();
create function private.keep_campaign_owner() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if exists (select 1 from public.campaigns where id = old.campaign_id and owner_id = old.user_id) then
    raise exception 'Campaign owner must remain a member' using errcode = '23514';
  end if;
  return old;
end;
$$;
create trigger preserve_owner_membership before delete on public.campaign_members for each row execute function private.keep_campaign_owner();

alter table public.profiles enable row level security;
alter table public.systems enable row level security;
alter table public.campaigns enable row level security;
alter table public.campaign_members enable row level security;
alter table public.characters enable row level security;
revoke all on public.profiles, public.systems, public.campaigns, public.campaign_members, public.characters from public, anon, authenticated;
grant select on public.systems to anon, authenticated;
grant insert, update, delete on public.systems to authenticated;
grant select on public.profiles, public.campaigns, public.campaign_members, public.characters to authenticated;
grant update (username, display_name) on public.profiles to authenticated;
grant insert (id, owner_id, system_id, name, description) on public.campaigns to authenticated;
grant update (name, description) on public.campaigns to authenticated;
grant delete on public.campaigns to authenticated;
grant insert (campaign_id, user_id) on public.campaign_members to authenticated;
grant delete on public.campaign_members to authenticated;
grant insert (id, owner_id, system_id, campaign_id, name, data_version, data) on public.characters to authenticated;
grant update (name, data_version, data) on public.characters to authenticated;
grant delete on public.characters to authenticated;

create policy systems_read on public.systems for select to anon, authenticated using (true);
create policy systems_admin on public.systems for all to authenticated using ((select private.is_super_admin())) with check ((select private.is_super_admin()));
create policy profiles_read on public.profiles for select to authenticated using (id = (select auth.uid()) or (select private.is_super_admin()) or private.shares_campaign(id));
create policy profiles_edit on public.profiles for update to authenticated using (id = (select auth.uid()) or (select private.is_super_admin())) with check (id = (select auth.uid()) or (select private.is_super_admin()));
create policy campaigns_read on public.campaigns for select to authenticated using ((select private.is_super_admin()) or private.in_campaign(id));
create policy campaigns_create on public.campaigns for insert to authenticated with check (owner_id = (select auth.uid()) or (select private.is_super_admin()));
create policy campaigns_edit on public.campaigns for update to authenticated using (owner_id = (select auth.uid()) or (select private.is_super_admin())) with check (owner_id = (select auth.uid()) or (select private.is_super_admin()));
create policy campaigns_delete on public.campaigns for delete to authenticated using (owner_id = (select auth.uid()) or (select private.is_super_admin()));
create policy members_read on public.campaign_members for select to authenticated using ((select private.is_super_admin()) or private.in_campaign(campaign_id));
create policy members_add on public.campaign_members for insert to authenticated with check ((select private.is_super_admin()) or private.owns_campaign(campaign_id));
create policy members_remove on public.campaign_members for delete to authenticated using ((select private.is_super_admin()) or private.owns_campaign(campaign_id));
create policy characters_read on public.characters for select to authenticated using (owner_id = (select auth.uid()) or (select private.is_super_admin()) or private.in_campaign(campaign_id));
create policy characters_create on public.characters for insert to authenticated with check (owner_id = (select auth.uid()) or (select private.is_super_admin()));
create policy characters_edit on public.characters for update to authenticated using (owner_id = (select auth.uid()) or (select private.is_super_admin()) or private.owns_campaign(campaign_id)) with check (owner_id = (select auth.uid()) or (select private.is_super_admin()) or private.owns_campaign(campaign_id));
create policy characters_delete on public.characters for delete to authenticated using (owner_id = (select auth.uid()) or (select private.is_super_admin()));

-- A GM may edit a sheet, but cannot steal or move someone else's character.
create function public.set_character_campaign(character_id uuid, target_campaign_id uuid)
returns void language plpgsql security definer set search_path = '' as $$
declare character_owner uuid;
begin
  select owner_id into character_owner from public.characters where id = character_id for update;
  if character_owner is null or auth.uid() is null or not (character_owner = auth.uid() or private.is_super_admin()) then
    raise exception 'Character assignment is not permitted' using errcode = '42501';
  end if;
  -- Composite foreign keys enforce matching system and owner membership, including under concurrency.
  update public.characters set campaign_id = target_campaign_id where id = character_id;
end;
$$;
create function public.is_super_admin() returns boolean
language sql stable security invoker set search_path = '' as $$ select private.is_super_admin(); $$;

revoke all on all functions in schema private from public, anon, authenticated;
grant execute on function private.is_super_admin(), private.owns_campaign(uuid), private.in_campaign(uuid), private.shares_campaign(uuid) to authenticated;
revoke all on function public.set_character_campaign(uuid, uuid), public.is_super_admin() from public, anon, authenticated;
grant execute on function public.set_character_campaign(uuid, uuid), public.is_super_admin() to authenticated;

insert into public.systems(id, slug, name, description, ruleset_key, theme_key) values
('72a455a0-0d54-4db1-89c2-49b0a7fe7d71', 'wasteland', 'Wasteland', 'A Fallout-inspired postnuclear RPG. Rules and mechanics are being defined.', 'wasteland', 'wasteland');
