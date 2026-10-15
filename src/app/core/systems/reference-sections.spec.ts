import { describe, expect, it } from 'vitest';
import { referenceSections } from './reference-sections';

describe('Heading-based reference sections', () => {
  it('separates headings on the same page and carries body text across page breaks', () => {
    const sections = referenceSections([
      {
        number: 1,
        category: 'lore',
        blocks: [
          { kind: 'heading', text: 'Introduction' },
          { kind: 'paragraph', text: 'Intro body' },
          { kind: 'heading', text: 'History' },
          { kind: 'paragraph', text: 'First history paragraph' },
        ],
      },
      {
        number: 2,
        category: 'lore',
        blocks: [
          { kind: 'paragraph', text: 'History continues' },
          { kind: 'heading', text: 'Radiomen' },
        ],
      },
    ]);
    expect(sections.map((s) => s.heading)).toEqual(['Introduction', 'History', 'Radiomen']);
    expect(sections[1].blocks.map((b) => b.text)).toEqual([
      'History',
      'First history paragraph History continues',
    ]);
    expect(new Set(sections.map((s) => s.id)).size).toBe(3);
  });
  it('preserves leading text and prevents lore/rules content being mixed', () => {
    const sections = referenceSections([
      {
        number: 1,
        category: 'lore',
        blocks: [
          { kind: 'paragraph', text: 'Preface' },
          { kind: 'heading', text: 'World' },
        ],
      },
      { number: 2, category: 'rules', blocks: [{ kind: 'paragraph', text: 'Rule text' }] },
    ]);
    expect(sections.flatMap((s) => s.blocks.map((b) => b.text))).toEqual([
      'Preface',
      'World',
      'Rule text',
    ]);
    expect(sections[2].category).toBe('rules');
  });
  it('keeps a lore continuation on a mixed rules page with its original heading', () => {
    const sections = referenceSections([
      {
        number: 57,
        category: 'lore',
        blocks: [{ kind: 'heading', text: 'Creatures, Criminals, and Commoners:' }],
      },
      {
        number: 58,
        category: 'rules',
        blocks: [
          { kind: 'paragraph', category: 'lore', text: 'Thunderbirds and Wooly Throatstabbers' },
          { kind: 'heading', text: 'Skills' },
          { kind: 'paragraph', text: 'Skill rules' },
        ],
      },
    ]);
    expect(sections.map((s) => s.heading)).toEqual([
      'Creatures, Criminals, and Commoners:',
      'Skills',
    ]);
    expect(sections[0].category).toBe('lore');
    expect(sections[0].blocks[1].text).toContain('Thunderbirds');
    expect(sections.filter((s) => s.category === 'rules').map((s) => s.heading)).toEqual([
      'Skills',
    ]);
  });
  it('joins paragraphs across page breaks without merging past headings or tables', () => {
    const pages = [
      {
        number: 1,
        category: 'rules',
        blocks: [
          { kind: 'heading', text: 'Rules' },
          { kind: 'paragraph', text: 'A sentence continues' },
        ],
      },
      {
        number: 2,
        category: 'rules',
        blocks: [
          { kind: 'paragraph', text: 'on the next page.' },
          { kind: 'table', text: 'Name Value', rows: [['Name', 'Value']] },
          { kind: 'paragraph', text: 'After the table.' },
        ],
      },
    ];
    const sections = referenceSections(pages);
    expect(sections[0].blocks.map((b) => b.text)).toEqual([
      'Rules',
      'A sentence continues on the next page.',
      'Name Value',
      'After the table.',
    ]);
    expect(pages[0].blocks[1].text).toBe('A sentence continues');
    expect(sections[0].blocks[2].rows).toEqual([['Name', 'Value']]);
  });
  it('preserves actual DOCX paragraphs even when they begin on a new source page', () => {
    const sections = referenceSections([
      {
        number: 1,
        category: 'lore',
        blocks: [
          { kind: 'heading', text: 'Lore' },
          { kind: 'paragraph', text: 'First paragraph.', paragraphBoundary: true },
        ],
      },
      {
        number: 2,
        category: 'lore',
        blocks: [{ kind: 'paragraph', text: 'Second paragraph.', paragraphBoundary: true }],
      },
    ]);
    expect(sections[0].blocks).toHaveLength(3);
  });
});
