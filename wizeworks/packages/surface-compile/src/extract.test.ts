import { describe, expect, it } from 'vitest';
import { type BuilderNode } from '@wizeworks/builder-schemas';
import { collectClasses } from './extract';

function node(partial: Partial<BuilderNode> & { id: string; type: string }): BuilderNode {
  return { props: {}, ...partial };
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
        node({ id: 'c1', type: 'Heading', class: 'h2  bg-base-100' }), // dup + extra space
        node({ id: 'c2', type: 'Text', class: 'text-primary-content' }),
      ],
    });
    expect(collectClasses(tree)).toEqual(['bg-base-100', 'h2', 'navbar', 'text-primary-content']);
  });

  it('merges classes across multiple trees (page + chrome)', () => {
    const page = node({ id: 'p', type: 'Section', class: 'gap-6' });
    const chrome = node({ id: 'h', type: 'Section', class: 'navbar gap-6' });
    expect(collectClasses([page, chrome])).toEqual(['gap-6', 'navbar']);
  });

  it('ignores empty / whitespace-only class strings', () => {
    expect(collectClasses(node({ id: 'a', type: 'Box', class: '   ' }))).toEqual([]);
  });

  // A SILICA tree, which is what the storefront actually renders. Its text leaves are
  // RAW STRINGS in `children`, not nodes — walking one as a node must neither throw nor
  // contribute a class. Shaped as the real starter navbar (docs/118), because the live
  // failure was exactly this pair surviving the harvest half-collected: `.hidden` reached
  // the tenant sheet and `sm:flex` did not, and since that sheet is injected last it won
  // the tie and hid the nav links at every width.
  it('walks a silica tree whose children include raw text leaves', () => {
    const silica = {
      kind: 'element',
      tag: 'nav',
      class: 'flex px-6 py-4',
      children: [
        { kind: 'component', component: 'Wordmark', class: 'wordmark mr-auto', props: {} },
        {
          kind: 'element',
          tag: 'div',
          class: 'hidden sm:flex',
          children: [
            { kind: 'element', tag: 'a', class: 'text-sm', children: ['Shop'] },
            { kind: 'element', tag: 'a', class: 'text-sm', children: ['About'] },
          ],
        },
      ],
    } as unknown as BuilderNode;
    expect(collectClasses(silica)).toEqual([
      'flex',
      'hidden',
      'mr-auto',
      'px-6',
      'py-4',
      'sm:flex',
      'text-sm',
      'wordmark',
    ]);
  });
});
