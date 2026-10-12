import { readFile, writeFile, mkdir, copyFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';

const args = process.argv.slice(2);
const source = args.includes('--pdf')
  ? args[args.indexOf('--pdf') + 1]
  : 'R:/Downloads/501Radsdraft1.pdf';
const revision = args.includes('--revision') ? args[args.indexOf('--revision') + 1] : 'draft-1';
if (!/^[a-z0-9-]+$/.test(revision)) throw new Error('Use a simple lowercase revision slug.');
const bytes = await readFile(source);
const loadingTask = getDocument({ data: new Uint8Array(bytes), useSystemFonts: true });
const pdf = await loadingTask.promise;
const pages = [];
for (let n = 1; n <= pdf.numPages; n++) {
  const page = await pdf.getPage(n),
    text = await page.getTextContent(),
    lines = [];
  let current = null;
  for (const item of text.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const y = item.transform[5],
      x = item.transform[4],
      size = Math.abs(item.transform[3]) || Math.abs(item.transform[0]);
    if (!current || Math.abs(current.y - y) > 2) {
      current = { text: '', y, x, end: x, size, heading: item.fontName.endsWith('_f1') };
      lines.push(current);
    }
    const gap = x - current.end;
    current.text += (current.text && gap > Math.max(1, size * 0.12) ? ' ' : '') + item.str;
    current.end = x + item.width;
    current.heading ||= item.fontName.endsWith('_f1');
  }
  const blocks = [];
  lines.sort((a, b) => b.y - a.y || a.x - b.x);
  let previous = null;
  for (const line of lines) {
    const value = line.text.normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (!value) continue;
    const kind = line.heading ? 'heading' : /^[-•]\s*/.test(value) ? 'bullet' : 'paragraph';
    const gap = previous ? Math.abs(previous.y - line.y) : Infinity;
    const last = blocks.at(-1);
    if (last && kind === 'paragraph' && last.kind === 'paragraph' && gap < line.size * 1.8)
      last.text += ' ' + value;
    else if (last && kind === 'heading' && last.kind === 'heading' && gap < line.size * 2)
      last.text += ' ' + value;
    else if (last && kind === 'paragraph' && last.kind === 'bullet' && gap < line.size * 1.8)
      last.text += ' ' + value;
    else blocks.push({ kind, text: kind === 'bullet' ? value.replace(/^[-•]\s*/, '') : value });
    previous = line;
  }
  pages.push({ number: n, category: n <= 57 ? 'lore' : 'rules', blocks });
}
const document = {
  title: '501 Rads',
  subtitle: 'The radioman\u2019s guide to the wasteland',
  revision,
  sourceFile: `501-rads-${revision}.pdf`,
  sha256: createHash('sha256').update(bytes).digest('hex'),
  pageCount: pages.length,
  pages,
};
const directory = 'public/systems/501-rads';
await mkdir(directory, { recursive: true });
await copyFile(source, `${directory}/501-rads-${revision}.pdf`);
await writeFile(`${directory}/${revision}.json`, JSON.stringify(document, null, 2) + '\n');
console.log(
  `Imported ${pages.length} pages; ${pages.reduce((sum, page) => sum + page.blocks.length, 0)} searchable text blocks; SHA-256 ${document.sha256}`,
);
await loadingTask.destroy();
