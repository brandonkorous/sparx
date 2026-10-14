// Where an author page finds the pieces a person is credited on. The fixture is a real
// journal's Article kind (P09, The Marrow Review): the photographer is credited in a
// field of the `author` kind, never as the piece's writer.

import { describe, expect, it } from 'vitest';

import {
  creditFieldsOf,
  creditRole,
  creditWhere,
  creditedIds,
  servedKinds,
} from './author-credits';

const JEAN_LUC = '0e3c8a1e-5d1c-4b8f-9c55-1f7c2b7a9d10';
const TOM = '7a2b0c44-3f1e-4c2d-8e6f-5a9b1c0d2e3f';

const ARTICLE_FIELDS = [
  { key: 'title', type: 'text', label: 'Title' },
  { key: 'heroImage', type: 'asset', label: 'Hero image' },
  { key: 'photographBy', type: 'author', label: 'Photograph by' },
  { key: 'illustrators', type: 'author', label: 'Illustrated by', multiple: true },
  { key: 'steps', type: 'repeater', label: 'Steps', fields: [{ key: 'who', type: 'author' }] },
];

const rows = [
  {
    key: 'article',
    name: 'Article',
    pluralName: 'Articles',
    urlPattern: '/articles/{slug}',
    schemaJson: { fields: ARTICLE_FIELDS },
  },
  {
    key: 'blog_post',
    name: 'Blog post',
    pluralName: 'Blog posts',
    urlPattern: '/blog/{slug}',
    schemaJson: { fields: [] },
  },
  {
    key: 'page',
    name: 'Page',
    pluralName: 'Pages',
    urlPattern: '/{slug}',
    schemaJson: { fields: [] },
  },
  { key: 'memo', name: 'Memo', pluralName: 'Memos', urlPattern: null, schemaJson: { fields: [] } },
  // A built-in of the same key, ordered after the tenant's own: shadowed.
  {
    key: 'article',
    name: 'News article',
    pluralName: 'News',
    urlPattern: '/news/{slug}',
    schemaJson: { fields: [] },
  },
];

describe('creditFieldsOf', () => {
  it('finds the top-level author fields, and not one inside a repeating group', () => {
    expect(creditFieldsOf(ARTICLE_FIELDS)).toEqual([
      { key: 'photographBy', label: 'Photograph by', multiple: false },
      { key: 'illustrators', label: 'Illustrated by', multiple: true },
    ]);
  });
});

describe('servedKinds', () => {
  it('keeps the kinds the website serves, the tenant shadowing a built-in, pages left out', () => {
    const kinds = servedKinds(rows);
    expect([...kinds.keys()]).toEqual(['article', 'blog_post']);
    expect(kinds.get('article')?.name).toBe('Article');
  });
});

describe('creditWhere', () => {
  it('asks each credit field for the author, by equality or by membership', () => {
    const where = creditWhere(servedKinds(rows).values(), JEAN_LUC);
    expect(where).toEqual([
      { typeKey: 'article', body: { path: ['photographBy'], equals: JEAN_LUC } },
      { typeKey: 'article', body: { path: ['illustrators'], array_contains: [JEAN_LUC] } },
    ]);
  });

  it('asks nothing when no kind credits anybody', () => {
    expect(creditWhere(servedKinds(rows.slice(1)).values(), JEAN_LUC)).toEqual([]);
  });
});

describe('creditRole and creditedIds', () => {
  const credits = creditFieldsOf(ARTICLE_FIELDS);
  const body = { title: 'The last mill on the Nene', photographBy: JEAN_LUC, illustrators: [TOM] };

  it('names the role a person has on a piece', () => {
    expect(creditRole(credits, body, JEAN_LUC)).toBe('Photograph by');
    expect(creditRole(credits, body, TOM)).toBe('Illustrated by');
    expect(creditRole(credits, body, 'someone-else')).toBeNull();
  });

  it('lists everyone a piece credits, once each', () => {
    expect(creditedIds(credits, { ...body, illustrators: [TOM, JEAN_LUC] }).sort()).toEqual(
      [JEAN_LUC, TOM].sort()
    );
  });
});
