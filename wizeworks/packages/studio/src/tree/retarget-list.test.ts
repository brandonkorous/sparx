// "What this list shows": the list, its empty line and its pager move together.
//
// The front page of a journal design lists blog posts. Pointing only the list at the
// journal's own Articles left "No posts yet" under five articles, because that line is
// a SIBLING gated on the old source; and left the pager paging a list no longer there.

import { describe, expect, it } from 'vitest';
import type { Node } from '@wizeworks/silicaui-html';

import { listSourceOf, retargetListOps } from './retarget-list';

const tree: Node = {
  kind: 'element',
  tag: 'section',
  id: 'band',
  children: [
    {
      kind: 'element',
      tag: 'div',
      id: 'grid',
      data: { kind: 'collection', ref: 'cms.blog_post', omitWhenEmpty: true, limit: 6 },
      children: [
        {
          kind: 'element',
          tag: 'a',
          id: 'card',
          data: { kind: 'value', ref: 'url', attr: 'href' },
        },
      ],
    },
    {
      kind: 'element',
      tag: 'p',
      id: 'empty',
      data: { kind: 'visible', ref: 'cms.blog_post', negate: true },
      children: ['No posts yet.'],
    },
    {
      kind: 'element',
      tag: 'p',
      id: 'other',
      data: { kind: 'visible', ref: 'commerce.product', negate: true },
      children: ['No products.'],
    },
    { kind: 'host', component: 'site.pagination', id: 'pager', props: { list: 'cms.blog_post' } },
  ],
};

describe('retargetListOps', () => {
  it('moves the list, its empty line and its pager, and keeps the list’s own settings', () => {
    expect(retargetListOps(tree, 'grid', 'cms.article')).toEqual([
      {
        kind: 'node.setData',
        id: 'grid',
        value: { kind: 'collection', ref: 'cms.article', omitWhenEmpty: true, limit: 6 },
      },
      {
        kind: 'node.setData',
        id: 'empty',
        value: { kind: 'visible', ref: 'cms.article', negate: true },
      },
      { kind: 'node.setProp', id: 'pager', key: 'list', value: 'cms.article' },
    ]);
  });

  it('leaves another list’s empty line and the cards inside alone', () => {
    const ids = retargetListOps(tree, 'grid', 'cms.article').map((op) => ('id' in op ? op.id : ''));
    expect(ids).not.toContain('other');
    expect(ids).not.toContain('card');
  });

  it('does nothing for a node that is not a list, or a list already there', () => {
    expect(retargetListOps(tree, 'empty', 'cms.article')).toEqual([]);
    expect(retargetListOps(tree, 'grid', 'cms.blog_post')).toEqual([]);
    expect(retargetListOps(tree, 'missing', 'cms.article')).toEqual([]);
  });

  it('reads a list’s source', () => {
    expect(listSourceOf({ data: { kind: 'collection', ref: 'cms.article' } })).toBe('cms.article');
    expect(listSourceOf({ data: { kind: 'value', ref: 'title' } })).toBeUndefined();
  });
});
