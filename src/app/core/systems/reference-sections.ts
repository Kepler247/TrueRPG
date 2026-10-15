export interface ReferenceBlock {
  category?: string;
  rows?: string[][];
  paragraphBoundary?: boolean;
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
      const category = block.category ?? page.category;
      if (block.kind === 'heading' || !current || current.category !== category) {
        current = {
          id: `${page.number}-${index}`,
          heading: block.kind === 'heading' ? block.text : 'Introduction / continued text',
          number: page.number,
          category,
          blocks: [],
        };
        sections.push(current);
      }
      const previous = current.blocks.at(-1);
      if (
        index === 0 &&
        !block.paragraphBoundary &&
        block.kind === 'paragraph' &&
        previous?.kind === 'paragraph'
      ) {
        // Page boundaries are layout, not paragraph boundaries. Do not mutate source data.
        current.blocks[current.blocks.length - 1] = {
          ...previous,
          text: previous.text + ' ' + block.text,
        };
      } else {
        current.blocks.push(block);
      }
    }
  }
  return sections;
}
