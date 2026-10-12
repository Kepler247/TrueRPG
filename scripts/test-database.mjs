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
        assert.equal(await count('systems'), 2);
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
  console.log(`\n${passed} database checks passed. No remote data was touched.`);
} finally {
  await db.close();
}
