export interface ReferenceBlock {
  kind: string;
  text: string;
}
export interface ReferencePage {
  number: number;
  category: string;
  blocks: ReferenceBlock[];
}
export interface ReferenceSection {
  id: string;
  heading: string;
  number: number;
  category: string;
  blocks: ReferenceBlock[];
}

// A heading starts a section; page breaks do not interrupt its body.
export function referenceSections(pages: readonly ReferencePage[]): ReferenceSection[] {
  const sections: ReferenceSection[] = [];
  let current: ReferenceSection | undefined;
  for (const page of pages) {
    for (const [index, block] of page.blocks.entries()) {
      if (block.kind === 'heading' || !current || current.category !== page.category) {
        current = {
          id: `${page.number}-${index}`,
          heading: block.kind === 'heading' ? block.text : 'Introduction / continued text',
          number: page.number,
          category: page.category,
          blocks: [],
        };
        sections.push(current);
      }
      current.blocks.push(block);
    }
  }
  return sections;
}
