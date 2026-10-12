-- Rename the existing system in place so campaigns and characters keep their association.
update public.systems set name='501 Rads', slug='501-rads', ruleset_key='501-rads', theme_key='501-rads',
 description='Wacky Jack''s radioman guide to the wasteland. Draft 1: world lore, factions, creatures, and Gunslinger rules.'
where id='72a455a0-0d54-4db1-89c2-49b0a7fe7d71';
insert into public.systems(id,slug,name,description,ruleset_key,theme_key)
values ('ec4fcb8a-b5de-4da4-9c35-c7bdb49c5e01','5e','5E (2014)','Plain fifth edition, based on the complete open SRD 5.1.','5e-2014','base5e');
