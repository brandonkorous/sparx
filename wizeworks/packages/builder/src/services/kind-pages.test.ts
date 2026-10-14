// Which content kinds get a page ("Each article"), and when a kind page moves.
//
// Pure, like `recordPagePlan`'s tests: the database write is a transcription of this
// answer. What it must never do is write a page over an address another page holds,
// because `(tenant_id, property_id, slug)` is unique and a collision 500s every load
// of the site's pages — the failure `recordPagePlan` was rewritten for.

import { describe, expect, it } from 'vitest';
import { kindAddressFromPattern } from '@wizeworks/silica-catalog';

import {
  kindPagePlan,
  kindPageRefresh,
  kindRecordType,
  seededKindPage,
  type KindPageRow,
  type ServedKind,
} from './kind-pages';

const kind = (key: string, pattern: string): ServedKind => ({
  key,
  name: key[0]!.toUpperCase() + key.slice(1),
  pluralName: `${key}s`,
  fields: [{ key: 'title', type: 'text', label: 'Title' }],
  address: kindAddressFromPattern(pattern)!,
});

const row = (over: Partial<KindPageRow>): KindPageRow => ({
  id: over.id ?? 'p1',
  slug: over.slug ?? null,
  kind: over.kind ?? 'singleton',
  recordType: over.recordType ?? null,
  position: over.position ?? 0,
});

describe('kindPagePlan', () => {
  it('gives a kind with no page one, after every existing page', () => {
    const plan = kindPagePlan(
      [
        row({ id: 'home', slug: '/', position: 0 }),
        row({ id: 'about', slug: '/about', position: 4 }),
      ],
      [kind('article', '/articles/{slug}')]
    );
    expect(plan.creates.map((k) => k.key)).toEqual(['article']);
    expect(plan.moves).toEqual([]);
    expect(plan.nextPosition).toBe(5);
  });

  it('leaves a kind that already has its page alone, so a load is idempotent', () => {
    const plan = kindPagePlan(
      [
        row({
          id: 'each',
          slug: '/articles/:slug',
          kind: 'collection',
          recordType: kindRecordType('article'),
        }),
      ],
      [kind('article', '/articles/{slug}')]
    );
    expect(plan.creates).toEqual([]);
    expect(plan.moves).toEqual([]);
  });

  it('moves a kind page when its kind moves to a new address', () => {
    const plan = kindPagePlan(
      [
        row({
          id: 'each',
          slug: '/pieces/:slug',
          kind: 'collection',
          recordType: kindRecordType('article'),
        }),
      ],
      [kind('article', '/articles/{slug}')]
    );
    expect(plan.moves).toEqual([{ id: 'each', slug: '/articles/:slug' }]);
  });

  it('never writes over an address another page holds', () => {
    const plan = kindPagePlan(
      [
        row({ id: 'theirs', slug: 'articles/:slug' }),
        row({
          id: 'each',
          slug: '/pieces/:slug',
          kind: 'collection',
          recordType: kindRecordType('essay'),
        }),
      ],
      [kind('article', '/articles/{slug}'), kind('essay', '/articles/{slug}')]
    );
    expect(plan.creates).toEqual([]);
    expect(plan.moves).toEqual([]);
  });

  it('gives two kinds two pages', () => {
    const plan = kindPagePlan(
      [],
      [kind('article', '/articles/{slug}'), kind('event', '/events/{slug}')]
    );
    expect(plan.creates.map((k) => k.address.slug)).toEqual(['/articles/:slug', '/events/:slug']);
  });
});

describe('kindPageRefresh', () => {
  const article = kind('article', '/articles/{slug}');
  const credited: ServedKind = {
    ...article,
    fields: [
      ...article.fields,
      { key: 'heroImage', type: 'asset', label: 'Hero image' },
      { key: 'photographBy', type: 'author', label: 'Photograph by' },
    ],
  };
  // A page as it comes back from the database: a copy, keys in whatever order.
  const stored = (tree: unknown): unknown => JSON.parse(JSON.stringify(tree));

  it('remakes a page nobody has touched when its kind changes', () => {
    const page = stored(seededKindPage(article));
    const next = kindPageRefresh(page, credited);
    expect(next).not.toBeNull();
    expect(JSON.stringify(next)).toContain('photographByUrl');
  });

  it('leaves a page alone that already matches its kind', () => {
    expect(kindPageRefresh(stored(seededKindPage(credited)), credited)).toBeNull();
  });

  it('leaves a page the owner has edited alone, whatever her kind does', () => {
    const page = stored(seededKindPage(article)) as { class?: string };
    page.class = 'flex flex-col gap-8';
    expect(kindPageRefresh(page, credited)).toBeNull();
  });

  it('leaves a page with no fingerprint alone: the platform cannot tell it is untouched', () => {
    const page = stored(seededKindPage(article)) as { attrs?: Record<string, string> };
    delete page.attrs;
    expect(kindPageRefresh(page, credited)).toBeNull();
  });
});
