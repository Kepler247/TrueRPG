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
      'First history paragraph',
      'History continues',
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
});
