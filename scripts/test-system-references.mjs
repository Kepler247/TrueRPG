import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

for (const [folder, revision, count] of [
  ['501-rads', 'draft-1', 69],
  ['501-rads', 'mutations-1', 125],
  ['5e', 'srd-5-1', 403],
  ['dnds', 'original', 85],
]) {
  const root = new URL(`../public/systems/${folder}/`, import.meta.url);
  const doc = JSON.parse(await readFile(new URL(`${revision}.json`, root), 'utf8'));
  assert.equal(doc.pageCount, count);
  assert.equal(doc.pages.length, count);
  assert.deepEqual(
    doc.pages.map((p) => p.number),
    Array.from({ length: count }, (_, i) => i + 1),
  );
  assert.equal(
    createHash('sha256')
      .update(await readFile(new URL(doc.sourceFile, root)))
      .digest('hex'),
    doc.sha256,
  );
  const text = doc.pages.flatMap((p) => p.blocks.map((b) => b.text)).join('\n');
  assert.ok(text.length > count * 100, 'Reference should contain substantive text');
  assert.ok(!text.includes('\ufffd'), 'Reference should not have replacement glyphs');
  if (folder === '501-rads') {
    assert.ok(!text.includes('luck points'), 'The author-corrected cost must use Heat');
    assert.ok(
      revision === 'draft-1'
        ? text.includes('Fan the Hammer; For -2 Heat')
        : text.includes('Fan the Hammer; For -2 heat points'),
    );
    if (revision === 'mutations-1') assert.ok(text.includes('The Ultimate Misfortune'));
  }
  for (const expected of folder === '501-rads'
    ? ['Radiomen', 'Gunslinger', 'Hacking', 'Divine Intervention']
    : folder === 'dnds'
      ? ['Psyscape', 'Recoil', 'Firearm Mastery', 'Power Armor']
      : ['Barbarian', 'Wizard', 'Grappler', 'Fireball'])
    assert.ok(text.includes(expected), `Missing ${expected}`);
  console.log(`PASS ${folder}: all ${count} pages present; original PDF hash verified`);
}
