-- Private image storage follows the same profile/character ownership boundaries.
alter table public.profiles add column avatar_path text;
alter table public.characters add column portrait_path text;
alter table public.profiles add constraint profile_avatar_scope check (avatar_path is null or avatar_path like 'profiles/' || id::text || '/%');
alter table public.characters add constraint character_portrait_scope check (portrait_path is null or portrait_path like 'characters/' || id::text || '/%');
grant update (avatar_path) on public.profiles to authenticated;
grant update (portrait_path) on public.characters to authenticated;

insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
values ('rpg-images','rpg-images',false,5242880,array['image/jpeg','image/png','image/webp']);

create function private.image_access(object_name text, editing boolean) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare entity_id uuid; kind text;
begin
  if object_name !~ '^(profiles|characters)/[0-9a-f-]{36}/[0-9a-f-]{36}\.(jpg|png|webp)$' then return false; end if;
  begin entity_id := split_part(object_name,'/',2)::uuid; exception when invalid_text_representation then return false; end;
  kind := split_part(object_name,'/',1);
  if private.is_super_admin() then return true; end if;
  if kind = 'profiles' then
    return exists(select 1 from public.profiles p where p.id=entity_id and
      (p.id=auth.uid() or private.is_super_admin() or (not editing and private.shares_campaign(p.id))));
  end if;
  return exists(select 1 from public.characters c where c.id=entity_id and
    (c.owner_id=auth.uid() or private.is_super_admin() or
     (editing and private.owns_campaign(c.campaign_id)) or (not editing and private.in_campaign(c.campaign_id))));
end; $$;
revoke all on function private.image_access(text,boolean) from public;
grant execute on function private.image_access(text,boolean) to authenticated;
create policy rpg_images_read on storage.objects for select to authenticated using (bucket_id='rpg-images' and private.image_access(name,false));
create policy rpg_images_create on storage.objects for insert to authenticated with check (bucket_id='rpg-images' and private.image_access(name,true));
create policy rpg_images_edit on storage.objects for update to authenticated using (bucket_id='rpg-images' and private.image_access(name,true)) with check (bucket_id='rpg-images' and private.image_access(name,true));
create policy rpg_images_remove on storage.objects for delete to authenticated using (bucket_id='rpg-images' and private.image_access(name,true));

create table public.campaign_invitations (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns(id) on delete cascade,
  invitee_id uuid not null references public.profiles(id) on delete cascade,
  invited_by uuid not null references public.profiles(id),
  created_at timestamptz not null default now(),
  unique(campaign_id,invitee_id)
);
alter table public.campaign_invitations enable row level security;
grant select,delete on public.campaign_invitations to authenticated;
create policy invitations_read on public.campaign_invitations for select to authenticated using (invitee_id=auth.uid() or private.owns_campaign(campaign_id) or private.is_super_admin());
create policy invitations_remove on public.campaign_invitations for delete to authenticated using (invitee_id=auth.uid() or private.owns_campaign(campaign_id) or private.is_super_admin());

create function public.invite_to_campaign(target_campaign uuid, target_username text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare target_user uuid; invitation_id uuid;
begin
  if auth.uid() is null or not (private.owns_campaign(target_campaign) or private.is_super_admin()) then raise exception 'Only the GM or admin can invite players' using errcode='42501'; end if;
  select id into target_user from public.profiles where username=lower(trim(target_username));
  if target_user is null then raise exception 'Username not found'; end if;
  if exists(select 1 from public.campaign_members where campaign_id=target_campaign and user_id=target_user) then raise exception 'That player is already a member'; end if;
  insert into public.campaign_invitations(campaign_id,invitee_id,invited_by) values(target_campaign,target_user,auth.uid())
  on conflict(campaign_id,invitee_id) do update set invited_by=excluded.invited_by returning id into invitation_id;
  return invitation_id;
end; $$;
create function public.accept_campaign_invitation(target_invitation uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare invited_campaign uuid;
begin
  select campaign_id into invited_campaign from public.campaign_invitations where id=target_invitation and invitee_id=auth.uid() for update;
  if invited_campaign is null then raise exception 'Invitation unavailable' using errcode='42501'; end if;
  insert into public.campaign_members(campaign_id,user_id) values(invited_campaign,auth.uid()) on conflict do nothing;
  delete from public.campaign_invitations where id=target_invitation;
  return invited_campaign;
end; $$;
create function public.my_campaign_invitations() returns table(id uuid,campaign_id uuid,campaign_name text,system_name text)
language sql stable security definer set search_path = '' as $$
  select i.id,i.campaign_id,c.name,s.name from public.campaign_invitations i
  join public.campaigns c on c.id=i.campaign_id join public.systems s on s.id=c.system_id
  where i.invitee_id=auth.uid() order by i.created_at;
$$;
revoke all on function public.invite_to_campaign(uuid,text), public.accept_campaign_invitation(uuid), public.my_campaign_invitations() from public;
grant execute on function public.invite_to_campaign(uuid,text), public.accept_campaign_invitation(uuid), public.my_campaign_invitations() to authenticated;

create function public.set_character_campaign_checked(character_id uuid,target_campaign_id uuid,expected_updated_at timestamptz) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare target public.characters%rowtype;
begin
  select * into target from public.characters where id=character_id for update;
  if target.id is null or auth.uid() is null or not (target.owner_id=auth.uid() or private.is_super_admin()) then raise exception 'Assignment is not permitted' using errcode='42501'; end if;
  if target.updated_at is distinct from expected_updated_at then raise exception 'Character changed. Reload before assigning' using errcode='40001'; end if;
  perform public.set_character_campaign(character_id,target_campaign_id);
  return jsonb_build_object(
    'row',(select to_jsonb(c) from public.characters c where c.id=character_id),
    'enforceCarryWeight',coalesce((select c.enforce_carry_weight from public.campaigns c where c.id=target_campaign_id),true),
    'canManageCarryRules',target_campaign_id is not null and (private.owns_campaign(target_campaign_id) or private.is_super_admin())
  );
end; $$;
revoke all on function public.set_character_campaign_checked(uuid,uuid,timestamptz) from public;
grant execute on function public.set_character_campaign_checked(uuid,uuid,timestamptz) to authenticated;
