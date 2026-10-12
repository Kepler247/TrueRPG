import { readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
const source = 'public/systems/5e/5e-srd-5-1.pdf',
  bytes = await readFile(source),
  task = getDocument({ data: new Uint8Array(bytes) }),
  pdf = await task.promise,
  pages = [];
for (let number = 1; number <= pdf.numPages; number++) {
  const page = await pdf.getPage(number),
    text = await page.getTextContent(),
    lines = [];
  let current = null;
  for (const item of text.items) {
    if (!('str' in item) || !item.str.trim()) continue;
    const y = item.transform[5],
      x = item.transform[4],
      size = Math.abs(item.transform[3]) || Math.abs(item.transform[0]);
    if (!current || Math.abs(current.y - y) > 2 || x < current.end - 10) {
      current = { text: '', y, x, end: x, size };
      lines.push(current);
    }
    current.text +=
      (current.text && x - current.end > Math.max(1, size * 0.12) ? ' ' : '') + item.str;
    current.end = x + item.width;
  }
  const blocks = [];
  let previous = null;
  for (const line of lines) {
    const value = line.text.normalize('NFKC').replace(/\s+/g, ' ').trim();
    if (!value) continue;
    const kind = line.size >= 13 ? 'heading' : /^[-•]\s/.test(value) ? 'bullet' : 'paragraph',
      last = blocks.at(-1);
    const gap = previous ? Math.abs(previous.y - line.y) : Infinity;
    if (
      last &&
      kind === 'paragraph' &&
      last.kind === 'paragraph' &&
      gap < line.size * 1.7 &&
      line.x >= previous.x - 10
    )
      last.text += ' ' + value;
    else blocks.push({ kind, text: value });
    previous = line;
  }
  pages.push({ number, category: 'rules', blocks });
}
await writeFile(
  'public/systems/5e/srd-5-1.json',
  JSON.stringify(
    {
      title: '5E (2014)',
      subtitle: 'System Reference Document 5.1',
      revision: 'srd-5-1',
      sourceFile: '5e-srd-5-1.pdf',
      sha256: createHash('sha256').update(bytes).digest('hex'),
      pageCount: pages.length,
      pages,
    },
    null,
    2,
  ) + '\n',
);
console.log(`Imported all ${pages.length} SRD pages`);
await task.destroy();
