-- Bind privileges to the exact Auth UID, never to editable user metadata or email.
-- A missing account must fail deployment rather than silently granting the wrong identity.
do $$
begin
  if not exists (select 1 from auth.users where id = '70dd7f1e-b52c-451e-a1c2-e7ebe59b6fe2') then
    raise exception 'Expected super-admin Auth account is missing';
  end if;
end;
$$;
insert into private.super_admins(user_id) values ('70dd7f1e-b52c-451e-a1c2-e7ebe59b6fe2');
