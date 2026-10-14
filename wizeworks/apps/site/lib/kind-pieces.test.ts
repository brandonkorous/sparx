// A piece of a content kind as its page and its cards show it.
//
// The stored values are for machines: a picture is an asset id, a choice is its value
// (`ledger`), a date is ISO. A reader gets the picture, "Ledger" and a date in words, on
// the page and on every card linking to it, from this one projection.

import { describe, expect, it } from 'vitest';
import type { KindFieldLike } from '@wizeworks/silica-catalog';

import type { ApiEntry } from './content';
import {
  fieldValue,
  pieceDoc,
  pieceRecord,
  pieceSummary,
  pieceTitle,
  pieceUrl,
  withPostWords,
} from './kind-pieces';

const FIELDS: KindFieldLike[] = [
  { key: 'title', type: 'text', label: 'Title' },
  { key: 'standfirst', type: 'long_text', label: 'Standfirst' },
  { key: 'body', type: 'rich_text', label: 'Body' },
  { key: 'heroImage', type: 'asset', label: 'Hero image' },
  { key: 'heroCaption', type: 'text', label: 'Hero caption' },
  {
    key: 'section',
    type: 'enum',
    label: 'Section',
    options: [
      { label: 'Field', value: 'field' },
      { label: 'Ledger', value: 'ledger' },
    ],
  },
];

const DOC = { type: 'doc', content: [{ type: 'paragraph' }] };

const ENTRY: ApiEntry = {
  id: 'e1',
  type_key: 'article',
  slug: 'the-last-mill-on-the-nene',
  status: 'published',
  body: {
    title: 'The last mill on the Nene',
    standfirst: 'Hannah Reeve grinds flour with the river.',
    body: DOC,
    heroImage: 'asset-1',
    section: 'ledger',
  },
  seo: {},
  published_at: '2026-10-01T05:00:00.000Z',
  updated_at: '2026-10-01T05:00:00.000Z',
  author: { display_name: 'Rosalind Achebe', slug: 'rosalind', bio: null, avatar_asset_id: null },
  terms: [],
};

describe('pieceRecord', () => {
  const record = pieceRecord(
    ENTRY,
    FIELDS,
    '/articles/the-last-mill-on-the-nene',
    'marrow',
    'Europe/London'
  );

  it('shows a choice by its label, not its stored value', () => {
    expect(record.section).toBe('Ledger');
  });

  it('turns a picture into an image the page can draw, described by the headline', () => {
    const image = record.heroImage as { url: string; alt: string };
    expect(image.url).toContain('/v1/public/media/asset-1');
    expect(image.alt).toBe('The last mill on the Nene');
  });

  it('leaves a missing field null, so the page hides it rather than blanking words', () => {
    expect(record.heroCaption).toBeNull();
  });

  it('dates a piece on the business clock, whatever clock the server keeps', () => {
    // 05:00 UTC on October 1 is 06:00 in England and 22:00 on September 30 in California.
    expect(record.date).toBe('October 1, 2026');
    const late = { ...ENTRY, published_at: '2026-10-01T23:30:00.000Z' };
    expect(pieceRecord(late, FIELDS, '/x', 'marrow', 'Europe/London').date).toBe('October 2, 2026');
    expect(pieceRecord(late, FIELDS, '/x', 'marrow', 'America/Los_Angeles').date).toBe(
      'October 1, 2026'
    );
    // No zone set is UTC, never the server's own.
    expect(pieceRecord(late, FIELDS, '/x', 'marrow').date).toBe('October 1, 2026');
  });

  it('reads a calendar date as that day on every clock', () => {
    const field: KindFieldLike = { key: 'd', type: 'date', label: 'D' };
    expect(fieldValue(field, '2026-10-08', 't', '', 'America/Los_Angeles')).toBe('October 8, 2026');
  });

  it('carries the byline, the date and the address', () => {
    expect(record.authorName).toBe('Rosalind Achebe');
    expect(record.date).toBe('October 1, 2026');
    expect(record.url).toBe('/articles/the-last-mill-on-the-nene');
    expect(record.id).toBe('e1');
  });
});

describe('fieldValue', () => {
  it('reads a yes-or-no field in words', () => {
    expect(fieldValue({ key: 'a', type: 'boolean', label: 'A' }, true, 't', '')).toBe('Yes');
    expect(fieldValue({ key: 'a', type: 'boolean', label: 'A' }, false, 't', '')).toBe('No');
  });

  it('lists several choices by label', () => {
    const field: KindFieldLike = {
      key: 'tags',
      type: 'enum',
      label: 'Tags',
      multiple: true,
      options: [
        { label: 'Mills', value: 'mills' },
        { label: 'Rivers', value: 'rivers' },
      ],
    };
    expect(fieldValue(field, ['mills', 'rivers'], 't', '')).toBe('Mills, Rivers');
  });

  it('gives several pictures as a list, and none as null', () => {
    const field: KindFieldLike = { key: 'p', type: 'asset', label: 'P', multiple: true };
    expect(fieldValue(field, ['a', 'b'], 't', 'x')).toHaveLength(2);
    expect(fieldValue(field, [], 't', 'x')).toBeNull();
  });
});

describe('the page words a kind names', () => {
  it('finds the headline, the summary and the body by the kind’s own fields', () => {
    const body = ENTRY.body;
    expect(pieceTitle(FIELDS, body)).toBe('The last mill on the Nene');
    expect(pieceSummary(FIELDS, body)).toBe('Hannah Reeve grinds flour with the river.');
    expect(pieceDoc(FIELDS, body)).toBe(DOC);
  });
});

describe('pieceUrl', () => {
  it('links a card where its kind lives', () => {
    expect(pieceUrl('article', '/articles/{slug}', 'x')).toBe('/articles/x');
    expect(pieceUrl('blog_post', null, 'x')).toBe('/blog/x');
    // A kind the website cannot serve links nowhere, never to a 404.
    expect(pieceUrl('faq', null, 'x')).toBe('');
    expect(pieceUrl('landing_page', '/{slug}', 'x')).toBe('');
  });
});

describe('withPostWords', () => {
  it('gives a blog-post card an article’s standfirst and photograph', () => {
    const card = withPostWords(
      {
        title: 'The last mill',
        standfirst: 'Six mornings a week.',
        heroImage: { url: 'u', alt: '' },
      },
      FIELDS
    );
    expect(card.excerpt).toBe('Six mornings a week.');
    expect(card.featuredImage).toEqual({ url: 'u', alt: '' });
  });

  it('never overwrites a field the kind has of its own', () => {
    const own: KindFieldLike[] = [...FIELDS, { key: 'excerpt', type: 'text', label: 'Excerpt' }];
    const card = withPostWords({ standfirst: 'lede', excerpt: 'mine' }, own);
    expect(card.excerpt).toBe('mine');
  });
});
