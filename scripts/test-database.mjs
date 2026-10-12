import assert from 'node:assert/strict';
import { readFile, readdir } from 'node:fs/promises';
import { PGlite } from '@electric-sql/pglite';

// Real PostgreSQL RLS/constraints, with only the Supabase-managed Auth objects stubbed.
const db = new PGlite();
const ids = {
  admin: '70dd7f1e-b52c-451e-a1c2-e7ebe59b6fe2',
  gm: '10000000-0000-4000-8000-000000000001',
  player: '10000000-0000-4000-8000-000000000002',
  member: '10000000-0000-4000-8000-000000000003',
  outsider: '10000000-0000-4000-8000-000000000004',
  wasteland: '72a455a0-0d54-4db1-89c2-49b0a7fe7d71',
  otherSystem: '20000000-0000-4000-8000-000000000001',
  campaign: '30000000-0000-4000-8000-000000000001',
  otherCampaign: '30000000-0000-4000-8000-000000000002',
  shared: '40000000-0000-4000-8000-000000000001',
  peer: '40000000-0000-4000-8000-000000000002',
  solo: '40000000-0000-4000-8000-000000000003',
  hidden: '40000000-0000-4000-8000-000000000004',
};
let passed = 0;
async function test(name, run) {
  await run();
  passed++;
  console.log(`PASS ${name}`);
}
async function asUser(user, run, role = 'authenticated') {
  await db.exec(`begin; set local role ${role};`);
  try {
    await db.query("select set_config('request.jwt.claim.sub', $1, true)", [user ?? '']);
    return await run();
  } finally {
    await db.exec('rollback');
  }
}
async function denied(run, code = '42501') {
  await assert.rejects(run, (error) => error.code === code);
}
async function count(table) {
  const { rows } = await db.query(`select count(*)::int as count from public.${table}`);
  return rows[0].count;
}
try {
  await db.exec(`
    create role anon nologin;
    create role authenticated nologin;
    create schema auth;
    grant usage on schema auth, public to anon, authenticated;
    create table auth.users (id uuid primary key, raw_user_meta_data jsonb default '{}');
    create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
    create schema storage;
    create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
    create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,unique(bucket_id,name));
    alter table storage.objects enable row level security;
    grant usage on schema storage to authenticated;
    grant select,insert,update,delete on storage.objects to authenticated;
  `);
  for (const user of ['admin', 'gm', 'player', 'member', 'outsider']) {
    await db.query('insert into auth.users(id) values ($1)', [ids[user]]);
  }
  const migrationDir = new URL('../supabase/migrations/', import.meta.url);
  for (const file of (await readdir(migrationDir)).filter((f) => f.endsWith('.sql')).sort()) {
    await db.exec('begin;');
    try {
      await db.exec(await readFile(new URL(file, migrationDir), 'utf8'));
      await db.exec('commit;');
    } catch (error) {
      await db.exec('rollback;');
      throw error;
    }
    console.log(`APPLIED ${file}`);
  }
  await db.query(
    "insert into public.systems(id,slug,name,ruleset_key,theme_key) values ($1,'other','Other','other','other')",
    [ids.otherSystem],
  );
  await db.query(
    'insert into public.campaigns(id,owner_id,system_id,name) values ($1,$2,$3,$4),($5,$6,$7,$8)',
    [
      ids.campaign,
      ids.gm,
      ids.wasteland,
      'Test campaign',
      ids.otherCampaign,
      ids.outsider,
      ids.otherSystem,
      'Other campaign',
    ],
  );
  await db.query(
    'insert into public.campaign_members(campaign_id,user_id) values ($1,$2),($1,$3),($4,$2)',
    [ids.campaign, ids.player, ids.member, ids.otherCampaign],
  );
  await db.query(
    'insert into public.characters(id,owner_id,system_id,campaign_id,name) values ($1,$2,$3,$4,$5),($6,$7,$3,$4,$8),($9,$2,$3,null,$10),($11,$12,$3,null,$13)',
    [
      ids.shared,
      ids.player,
      ids.wasteland,
      ids.campaign,
      'Shared',
      ids.peer,
      ids.member,
      'Peer',
      ids.solo,
      'Solo',
      ids.hidden,
      ids.outsider,
      'Hidden',
    ],
  );

  await test('existing users receive profiles', async () =>
    assert.equal(await count('profiles'), 5));
  await test('new users receive profiles without leaking email', async () => {
    await db.query('insert into auth.users(id,raw_user_meta_data) values ($1,$2)', [
      '10000000-0000-4000-8000-000000000005',
      { display_name: 'New player', role: 'super_admin' },
    ]);
    assert.equal(
      (
        await db.query(
          "select display_name from public.profiles where id='10000000-0000-4000-8000-000000000005'",
        )
      ).rows[0].display_name,
      'New player',
    );
    await asUser('10000000-0000-4000-8000-000000000005', async () =>
      assert.equal(
        (await db.query('select public.is_super_admin() as admin')).rows[0].admin,
        false,
      ),
    );
  });
  await test('anonymous visitors can read systems only', () =>
    asUser(
      null,
      async () => {
        assert.equal(await count('systems'), 3);
        const { rows } = await db.query('select name,ruleset_key from public.systems where id=$1', [
          ids.wasteland,
        ]);
        assert.equal(rows[0].name, '501 Rads');
        assert.equal(rows[0].ruleset_key, '501-rads');
        await denied(() => db.query('select * from public.characters'));
      },
      'anon',
    ));
  await test('player sees own solo sheets and campaign peers, but no outsiders', () =>
    asUser(ids.player, async () => {
      assert.equal(await count('characters'), 3);
      assert.equal(
        (await db.query('select id from public.characters where id=$1', [ids.hidden])).rows.length,
        0,
      );
    }));
  await test('member cannot edit another player sheet', () =>
    asUser(ids.member, async () => {
      assert.equal(
        (
          await db.query(
            "update public.characters set name='Unauthorized' where id=$1 returning id",
            [ids.shared],
          )
        ).rows.length,
        0,
      );
    }));
  await test('owner can edit a campaign-less sheet', () =>
    asUser(ids.player, async () => {
      assert.equal(
        (
          await db.query(
            'update public.characters set data=\'{"level":2}\' where id=$1 returning id',
            [ids.solo],
          )
        ).rows.length,
        1,
      );
    }));
  await test('GM edits sheets inside campaign but cannot see solo sheets', () =>
    asUser(ids.gm, async () => {
      assert.equal(
        (
          await db.query("update public.characters set name='GM edit' where id=$1 returning id", [
            ids.shared,
          ])
        ).rows.length,
        1,
      );
      assert.equal(
        (await db.query('select id from public.characters where id=$1', [ids.solo])).rows.length,
        0,
      );
    }));
  await test('outsider cannot read campaign or membership', () =>
    asUser(ids.outsider, async () => {
      assert.equal(
        (await db.query('select id from public.campaigns where id=$1', [ids.campaign])).rows.length,
        0,
      );
      assert.equal(
        (
          await db.query('select user_id from public.campaign_members where campaign_id=$1', [
            ids.campaign,
          ])
        ).rows.length,
        0,
      );
    }));
  await test('super-admin edits every sheet regardless of campaign', () =>
    asUser(ids.admin, async () => {
      assert.equal(await count('characters'), 4);
      assert.equal(
        (await db.query("update public.characters set name='Admin edit' returning id")).rows.length,
        4,
      );
      assert.equal((await db.query('select public.is_super_admin() as admin')).rows[0].admin, true);
    }));
  await test('users cannot self-promote through private table', () =>
    asUser(ids.player, () =>
      denied(() => db.query('insert into private.super_admins(user_id) values ($1)', [ids.player])),
    ));
  await test('GM cannot steal ownership through a protected column', () =>
    asUser(ids.gm, () =>
      denied(() =>
        db.query('update public.characters set owner_id=$1 where id=$2', [ids.gm, ids.shared]),
      ),
    ));
  await test('direct campaign reassignment is denied', () =>
    asUser(ids.player, () =>
      denied(() =>
        db.query('update public.characters set campaign_id=null where id=$1', [ids.shared]),
      ),
    ));
  await test('owner assigns and detaches through controlled RPC', () =>
    asUser(ids.player, async () => {
      await db.query('select public.set_character_campaign($1,$2)', [ids.solo, ids.campaign]);
      assert.equal(
        (await db.query('select campaign_id from public.characters where id=$1', [ids.solo]))
          .rows[0].campaign_id,
        ids.campaign,
      );
      await db.query('select public.set_character_campaign($1,null)', [ids.solo]);
      assert.equal(
        (await db.query('select campaign_id from public.characters where id=$1', [ids.solo]))
          .rows[0].campaign_id,
        null,
      );
    }));
  await test('GM cannot move another owner sheet through RPC', () =>
    asUser(ids.gm, () =>
      denied(() => db.query('select public.set_character_campaign($1,null)', [ids.shared])),
    ));
  await test('super-admin can move another owner sheet through RPC', () =>
    asUser(ids.admin, async () => {
      await db.query('select public.set_character_campaign($1,$2)', [ids.solo, ids.campaign]);
    }));
  await test('mismatched system assignment fails even for a member', () =>
    asUser(ids.player, () =>
      denied(
        () =>
          db.query('select public.set_character_campaign($1,$2)', [ids.solo, ids.otherCampaign]),
        '23503',
      ),
    ));
  await test('a nonmember owner cannot insert a campaign character', () =>
    asUser(ids.outsider, () =>
      denied(
        () =>
          db.query(
            'insert into public.characters(owner_id,system_id,campaign_id,name) values ($1,$2,$3,$4)',
            [ids.outsider, ids.wasteland, ids.campaign, 'Intruder'],
          ),
        '23503',
      ),
    ));
  await test('users cannot insert a character owned by someone else', () =>
    asUser(ids.member, () =>
      denied(() =>
        db.query('insert into public.characters(owner_id,system_id,name) values ($1,$2,$3)', [
          ids.player,
          ids.wasteland,
          'Forged',
        ]),
      ),
    ));
  await test('player cannot add campaign membership', () =>
    asUser(ids.player, () =>
      denied(() =>
        db.query('insert into public.campaign_members(campaign_id,user_id) values ($1,$2)', [
          ids.campaign,
          ids.outsider,
        ]),
      ),
    ));
  await test('a player can create a campaign and receive its row with owner membership', () =>
    asUser(ids.player, async () => {
      const result = await db.query(
        'insert into public.campaigns(owner_id,system_id,name) values ($1,$2,$3) returning id',
        [ids.player, ids.wasteland, 'New campaign'],
      );
      assert.equal(result.rows.length, 1);
      const members = await db.query(
        'select user_id from public.campaign_members where campaign_id=$1',
        [result.rows[0].id],
      );
      assert.equal(members.rows[0].user_id, ids.player);
    }));
  await test('a player creates a campaign-less character with empty versioned data', () =>
    asUser(ids.player, async () => {
      const result = await db.query(
        'insert into public.characters(owner_id,system_id,name) values ($1,$2,$3) returning id,campaign_id,data,data_version',
        [ids.player, ids.wasteland, 'Independent'],
      );
      assert.equal(result.rows[0].campaign_id, null);
      assert.deepEqual(result.rows[0].data, {});
      assert.equal(result.rows[0].data_version, 1);
    }));
  await test('a member creates a character inside a matching campaign', () =>
    asUser(ids.player, async () => {
      const result = await db.query(
        'insert into public.characters(owner_id,system_id,campaign_id,name) values ($1,$2,$3,$4) returning id,campaign_id',
        [ids.player, ids.wasteland, ids.campaign, 'Party member'],
      );
      assert.equal(result.rows[0].campaign_id, ids.campaign);
    }));
  await test('only GM/admin can change campaign carrying enforcement', async () => {
    await asUser(ids.player, async () => {
      const result = await db.query(
        'update public.campaigns set enforce_carry_weight=false where id=$1 returning id',
        [ids.campaign],
      );
      assert.equal(result.rows.length, 0);
    });
    await asUser(ids.gm, async () => {
      const result = await db.query(
        'update public.campaigns set enforce_carry_weight=false where id=$1 returning enforce_carry_weight',
        [ids.campaign],
      );
      assert.equal(result.rows[0].enforce_carry_weight, false);
    });
    await asUser(ids.admin, async () => {
      const result = await db.query(
        'update public.campaigns set enforce_carry_weight=false where id=$1 returning id',
        [ids.campaign],
      );
      assert.equal(result.rows.length, 1);
    });
  });
  await test('GM can add a member', () =>
    asUser(ids.gm, async () => {
      await db.query('insert into public.campaign_members(campaign_id,user_id) values ($1,$2)', [
        ids.campaign,
        ids.outsider,
      ]);
    }));
  await test('member removal detaches sheets without deleting them', () =>
    asUser(ids.gm, async () => {
      await db.query('delete from public.campaign_members where campaign_id=$1 and user_id=$2', [
        ids.campaign,
        ids.player,
      ]);
      await db.exec('reset role');
      assert.equal(
        (await db.query('select campaign_id from public.characters where id=$1', [ids.shared]))
          .rows[0].campaign_id,
        null,
      );
      assert.equal(await count('characters'), 4);
    }));
  await test('campaign owner cannot be removed from membership', () =>
    asUser(ids.gm, () =>
      denied(
        () =>
          db.query('delete from public.campaign_members where campaign_id=$1 and user_id=$2', [
            ids.campaign,
            ids.gm,
          ]),
        '23514',
      ),
    ));
  await test('campaign deletion preserves its characters', () =>
    asUser(ids.gm, async () => {
      await db.query('delete from public.campaigns where id=$1', [ids.campaign]);
      await db.exec('reset role');
      assert.equal(
        (await db.query('select campaign_id from public.characters where id=$1', [ids.shared]))
          .rows[0].campaign_id,
        null,
      );
      assert.equal(await count('characters'), 4);
    }));
  await test('GM cannot delete another owner character', () =>
    asUser(ids.gm, async () =>
      assert.equal(
        (await db.query('delete from public.characters where id=$1 returning id', [ids.shared]))
          .rows.length,
        0,
      ),
    ));
  await test('username is editable only by owner/admin and must be canonical', () =>
    asUser(ids.player, async () => {
      await db.query("update public.profiles set username='wasteland_player' where id=$1", [
        ids.player,
      ]);
      assert.equal(
        (
          await db.query("update public.profiles set username='stolen' where id=$1 returning id", [
            ids.member,
          ])
        ).rows.length,
        0,
      );
    }));
  await test('uppercase username is rejected', () =>
    asUser(ids.player, () =>
      denied(
        () =>
          db.query("update public.profiles set username='InvalidName' where id=$1", [ids.player]),
        '23514',
      ),
    ));
  await test('duplicate username is rejected', async () => {
    await db.query("update public.profiles set username='taken_name' where id=$1", [ids.member]);
    await asUser(ids.player, () =>
      denied(
        () =>
          db.query("update public.profiles set username='taken_name' where id=$1", [ids.player]),
        '23505',
      ),
    );
  });
  await test('system definitions cannot be edited by ordinary users', () =>
    asUser(ids.player, async () =>
      assert.equal(
        (await db.query("update public.systems set name='Hijacked' returning id")).rows.length,
        0,
      ),
    ));
  await test('malformed character payload is rejected', () =>
    asUser(ids.player, () =>
      denied(
        () => db.query("update public.characters set data='[]' where id=$1", [ids.solo]),
        '23514',
      ),
    ));
  const imageFile = '11111111-1111-4111-8111-111111111111.png';
  const peerImage = `characters/${ids.peer}/${imageFile}`;
  const sharedImage = `characters/${ids.shared}/${imageFile}`;
  const soloImage = `characters/${ids.solo}/${imageFile}`;
  for (const name of [peerImage, sharedImage, soloImage, `profiles/${ids.member}/${imageFile}`])
    await db.query("insert into storage.objects(bucket_id,name) values('rpg-images',$1)", [name]);
  await test('image bucket is private and limits file size and types', async () => {
    const { rows } = await db.query(
      "select public,file_size_limit,allowed_mime_types from storage.buckets where id='rpg-images'",
    );
    assert.equal(rows[0].public, false);
    assert.equal(Number(rows[0].file_size_limit), 5242880);
    assert.deepEqual(rows[0].allowed_mime_types, ['image/jpeg', 'image/png', 'image/webp']);
  });
  await test('party viewers read campaign images but cannot read solo portraits', () =>
    asUser(ids.member, async () => {
      assert.equal(
        (await db.query('select name from storage.objects where name=$1', [sharedImage])).rows
          .length,
        1,
      );
      assert.equal(
        (await db.query('select name from storage.objects where name=$1', [soloImage])).rows.length,
        0,
      );
    }));
  await test('owners can upload profile pictures in their own folder', () =>
    asUser(ids.player, async () => {
      await db.query("insert into storage.objects(bucket_id,name) values('rpg-images',$1)", [
        `profiles/${ids.player}/${imageFile}`,
      ]);
      await db.query('update public.profiles set avatar_path=$1 where id=$2', [
        `profiles/${ids.player}/${imageFile}`,
        ids.player,
      ]);
    }));
  await test('members cannot upload another character portrait', () =>
    asUser(ids.member, () =>
      denied(() =>
        db.query("insert into storage.objects(bucket_id,name) values('rpg-images',$1)", [
          `characters/${ids.shared}/22222222-2222-4222-8222-222222222222.png`,
        ]),
      ),
    ));
  await test('GMs can upload campaign portraits', () =>
    asUser(ids.gm, () =>
      db.query("insert into storage.objects(bucket_id,name) values('rpg-images',$1)", [
        `characters/${ids.shared}/22222222-2222-4222-8222-222222222222.png`,
      ]),
    ));
  await test('GMs cannot upload solo portraits or another profile avatar', () =>
    asUser(ids.gm, () =>
      denied(() =>
        db.query("insert into storage.objects(bucket_id,name) values('rpg-images',$1)", [
          `profiles/${ids.member}/22222222-2222-4222-8222-222222222222.png`,
        ]),
      ),
    ));
  await test('image path changes cannot move an object into another owner folder', () =>
    asUser(ids.player, () =>
      denied(() =>
        db.query('update storage.objects set name=$1 where name=$2', [
          `characters/${ids.peer}/22222222-2222-4222-8222-222222222222.png`,
          soloImage,
        ]),
      ),
    ));
  await test('record image references cannot point into another profile folder', () =>
    asUser(ids.player, () =>
      denied(
        () =>
          db.query('update public.profiles set avatar_path=$1 where id=$2', [
            `profiles/${ids.member}/${imageFile}`,
            ids.player,
          ]),
        '23514',
      ),
    ));
  await test('membership removal revokes image visibility for detached characters', () =>
    asUser(ids.gm, async () => {
      await db.query('delete from public.campaign_members where campaign_id=$1 and user_id=$2', [
        ids.campaign,
        ids.member,
      ]);
      assert.equal(
        (await db.query('select name from storage.objects where name=$1', [peerImage])).rows.length,
        0,
      );
    }));
  await test('admin image access remains independent of ownership', () =>
    asUser(ids.admin, async () =>
      assert.equal((await db.query('select name from storage.objects')).rows.length, 4),
    ));
  await test('admin can clean orphaned pictures while ordinary users cannot access them', async () => {
    const orphan = `characters/99999999-9999-4999-8999-999999999999/${imageFile}`;
    await asUser(ids.admin, async () =>
      assert.equal(
        (await db.query('select private.image_access($1,true) as allowed', [orphan])).rows[0]
          .allowed,
        true,
      ),
    );
    await asUser(ids.player, async () =>
      assert.equal(
        (await db.query('select private.image_access($1,false) as allowed', [orphan])).rows[0]
          .allowed,
        false,
      ),
    );
  });
  await db.query("update public.profiles set username='wild_guest' where id=$1", [ids.outsider]);
  const invitation = '50000000-0000-4000-8000-000000000001';
  await db.query(
    'insert into public.campaign_invitations(id,campaign_id,invitee_id,invited_by) values($1,$2,$3,$4)',
    [invitation, ids.campaign, ids.outsider, ids.gm],
  );
  await test('only GM/admin can issue username invitations', () =>
    asUser(ids.player, () =>
      denied(() => db.query("select public.invite_to_campaign($1,'wild_guest')", [ids.campaign])),
    ));
  await test('GM invitation lookup normalizes usernames and avoids duplicate invitations', () =>
    asUser(ids.gm, async () => {
      await db.query("select public.invite_to_campaign($1,' Wild_Guest ')", [ids.campaign]);
      assert.equal((await db.query('select id from public.campaign_invitations')).rows.length, 1);
    }));
  await test('invitation can only be accepted by its intended account', () =>
    asUser(ids.player, () =>
      denied(() => db.query('select public.accept_campaign_invitation($1)', [invitation])),
    ));
  await test('acceptance adds membership and reveals the invited campaign', () =>
    asUser(ids.outsider, async () => {
      assert.equal(
        (await db.query('select id from public.campaigns where id=$1', [ids.campaign])).rows.length,
        0,
      );
      assert.equal(
        (await db.query('select * from public.my_campaign_invitations()')).rows[0].campaign_name,
        'Test campaign',
      );
      await db.query('select public.accept_campaign_invitation($1)', [invitation]);
      assert.equal(
        (await db.query('select id from public.campaigns where id=$1', [ids.campaign])).rows.length,
        1,
      );
      assert.equal(
        (await db.query('select * from public.my_campaign_invitations()')).rows.length,
        0,
      );
    }));
  await test('checked assignment rejects stale character versions', () =>
    asUser(ids.player, () =>
      denied(
        () =>
          db.query("select public.set_character_campaign_checked($1,$2,'2000-01-01')", [
            ids.solo,
            ids.campaign,
          ]),
        '40001',
      ),
    ));
  await test('checked assignment returns an atomic metadata snapshot', () =>
    asUser(ids.player, async () => {
      const stamp = (
        await db.query('select updated_at::text as stamp from public.characters where id=$1', [
          ids.solo,
        ])
      ).rows[0].stamp;
      const { rows } = await db.query(
        'select public.set_character_campaign_checked($1,$2,$3) as character',
        [ids.solo, ids.campaign, stamp],
      );
      assert.equal(rows[0].character.row.campaign_id, ids.campaign);
      assert.equal(rows[0].character.row.owner_id, ids.player);
      assert.equal(rows[0].character.enforceCarryWeight, true);
      assert.equal(rows[0].character.canManageCarryRules, false);
    }));
  console.log(`\n${passed} database checks passed. No remote data was touched.`);
} finally {
  await db.close();
}
