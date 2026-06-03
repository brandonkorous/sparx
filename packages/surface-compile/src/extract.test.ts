import { describe, expect, it } from 'vitest';
import { DEFAULT_BOX, type BuilderNode } from '@sparx/builder-schemas';
import { collectClasses } from './extract';

function node(partial: Partial<BuilderNode> & { id: string; type: string }): BuilderNode {
  return { box: DEFAULT_BOX, props: {}, ...partial };
}

describe('collectClasses', () => {
  it('returns [] for a tree with no authored classes', () => {
    expect(collectClasses(node({ id: 'a', type: 'Section' }))).toEqual([]);
  });

  it('tokenizes a class string and dedupes across the tree, sorted', () => {
    const tree = node({
      id: 'root',
      type: 'Section',
      class: 'navbar bg-base-100',
      children: [
        node({ id: 'c1', type: 'Heading', class: 'sf-h  bg-base-100' }), // dup + extra space
        node({ id: 'c2', type: 'Text', class: 'text-primary-content' }),
      ],
    });
    expect(collectClasses(tree)).toEqual(['bg-base-100', 'navbar', 'sf-h', 'text-primary-content']);
  });

  it('merges classes across multiple trees (page + chrome)', () => {
    const page = node({ id: 'p', type: 'Section', class: 'gap-6' });
    const chrome = node({ id: 'h', type: 'Section', class: 'navbar gap-6' });
    expect(collectClasses([page, chrome])).toEqual(['gap-6', 'navbar']);
  });

  it('ignores empty / whitespace-only class strings', () => {
    expect(collectClasses(node({ id: 'a', type: 'Box', class: '   ' }))).toEqual([]);
  });
});
