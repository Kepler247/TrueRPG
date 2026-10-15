import fs from 'node:fs';
import assert from 'node:assert/strict';
import ts from 'typescript';
const source = ts.createSourceFile(
  'rads-catalog.ts',
  fs.readFileSync('src/app/core/systems/rads-catalog.ts', 'utf8'),
  ts.ScriptTarget.Latest,
  true,
);
const tables = new Set(['ballistic', 'energy', 'melee', 'heavy', 'thrown', 'legendary']);
const compact = (s) =>
  s
    .normalize('NFKC')
    .replace(/[\u2019\u2018]/g, "'")
    .replace(/[\u2212\u2013\u2014]/g, '-')
    .replace(/\s|\u200b/g, '')
    .toLowerCase();
const reference = JSON.parse(fs.readFileSync('public/systems/501-rads/core-1.json', 'utf8'));
const text = compact(
  reference.pages
    .filter((p) => p.number >= 169 && p.number <= 194)
    .flatMap((p) => p.blocks.map((b) => b.text))
    .join(' '),
);
const rows = [],
  throwables = new Set();
function value(node) {
  if (ts.isStringLiteral(node)) return node.text;
  if (ts.isNumericLiteral(node)) return Number(node.text);
  if (ts.isPrefixUnaryExpression(node) && node.operator === ts.SyntaxKind.MinusToken)
    return -value(node.operand);
  throw Error('Unexpected catalog literal ' + node.getText(source));
}
function visit(node) {
  if (ts.isVariableDeclaration(node) && tables.has(node.name.getText(source))) {
    for (const row of node.initializer.elements) {
      const values = row.elements.map(value);
      rows.push(values);
      if (node.name.getText(source) === 'thrown') throwables.add(values[0]);
    }
  }
  ts.forEachChild(node, visit);
}
visit(source);
let failures = [];
for (const [name, tier, damage, type, range, accuracy] of rows) {
  const index = text.indexOf(compact(name));
  if (index < 0) {
    failures.push(name + ': source name not found');
    continue;
  }
  const next =
    rows
      .map((r) => text.indexOf(compact(r[0]), index + compact(name).length))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0] ?? text.length;
  const region = text.slice(index, Math.min(next, index + 650));
  for (const [field, expected] of [
    ['damage', damage],
    ['type', type],
    ['range', range + 'ft'],
    ['accuracy', accuracy < 0 ? String(accuracy) : '+' + accuracy],
  ]) {
    if (field === 'accuracy' && throwables.has(name)) {
      assert.equal(accuracy, 0, 'Throwables have no extra accuracy modifier in the source');
      continue;
    }
    if (name === 'Rustbucket Smoke Bomb' && ['type', 'damage'].includes(field)) {
      assert.ok(region.includes('--50ft'), 'Smoke has no damage/type in the source');
      continue;
    }
    if (!region.includes(compact(String(expected))))
      failures.push(
        name + ': ' + field + ' ' + expected + ' absent in source row: ' + region.slice(0, 180),
      );
  }
}
assert.equal(rows.length, 86, 'All published weapon rows must be audited');
if (failures.length) {
  console.error(failures.join('\n'));
  process.exitCode = 1;
} else
  console.log('PASS 501 Rads: 86 weapon rows checked against the authoritative reference text');
