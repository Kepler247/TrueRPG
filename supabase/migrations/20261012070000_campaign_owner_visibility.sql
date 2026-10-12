-- INSERT RETURNING checks SELECT visibility before the AFTER INSERT membership trigger.
alter policy campaigns_read on public.campaigns
using (owner_id = (select auth.uid()) or (select private.is_super_admin()) or private.in_campaign(id));
