import { readFile, writeFile } from 'node:fs/promises';
const doc = JSON.parse(await readFile('public/systems/5e/srd-5-1.json', 'utf8'));
const classes = [
  'Barbarian',
  'Bard',
  'Cleric',
  'Druid',
  'Fighter',
  'Monk',
  'Paladin',
  'Ranger',
  'Rogue',
  'Sorcerer',
  'Warlock',
  'Wizard',
];
const output = {};
for (const name of classes) {
  const page = doc.pages.find(
    (p) => p.number < 65 && p.blocks.some((b) => b.kind === 'heading' && b.text === name),
  );
  if (!page) throw new Error(`Missing ${name}`);
  let text = '',
    heads = [];
  for (const block of page.blocks) {
    if (block.kind === 'heading') heads.push(text.length);
    text += block.text + '\n';
  }
  const last = [...text.matchAll(/20th\s+\+[2-6]/g)].at(-1);
  if (!last) throw new Error(`Missing level 20 in ${name} page ${page.number}`);
  const end = heads.find((position) => position > last.index) ?? text.length;
  text = text.slice(0, end);
  const matches = [
    ...text.matchAll(
      /(?:^|\s)(\d{1,2})(?:st|nd|rd|th)\s+\+[2-6]\s+([\s\S]*?)(?=\s\d{1,2}(?:st|nd|rd|th)\s+\+[2-6]|$)/g,
    ),
  ];
  const levels = {};
  for (const match of matches)
    levels[match[1]] = match[2]
      .replace(/\s+/g, ' ')
      .trim()
      .replace(/(?:\s|^)(?:\d+|Unlimited|\+\d+)(?:\s+(?:\d+|Unlimited|\+\d+))*$/, '')
      .trim();
  for (const level of Object.keys(levels)) {
    if (name === 'Barbarian') levels[level] = levels[level].replace(/\s+\d+\s+\+\d+\s+/g, ' ');
    if (name === 'Monk')
      levels[level] = levels[level].replace(
        /^\d+d\d+\s+(?:\d+|\u2014)\s+(?:\+\d+\s*ft\.|\u2014)\s*/,
        '',
      );
    if (name === 'Rogue') levels[level] = levels[level].replace(/^\d+d\d+\s*/, '');
    if (name === 'Sorcerer') levels[level] = levels[level].replace(/^(?:\d+|\u2014)\s+/, '');
    if (name === 'Warlock')
      levels[level] = levels[level].replace(/\s+\d+\s+\d+\s+\d+\s+\d+(?:st|nd|rd|th)$/, '');
  }
  if (Object.keys(levels).length !== 20)
    throw new Error(`${name}: only ${Object.keys(levels).length} rows`);
  output[name] = { sourcePage: page.number, levels };
  console.log(name, page.number, levels['1'], '/', levels['20']);
}
await writeFile(
  'src/app/core/systems/5e-class-progressions.json',
  JSON.stringify(output, null, 2) + '\n',
);
