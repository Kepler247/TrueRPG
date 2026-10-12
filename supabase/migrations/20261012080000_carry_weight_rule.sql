-- Campaign owners and super-admins control the shared carrying rule.
alter table public.campaigns add column enforce_carry_weight boolean not null default true;
grant update (enforce_carry_weight) on public.campaigns to authenticated;
