// A journal's people on its website (P09, The Marrow Review): the byline links to the
// writer's page, the photographer's credit prints their name and links theirs, and an
// author's page lists what they did in the role they did it.

import { describe, expect, it } from 'vitest';
import { AUTHORS_SOURCE_KEY } from '@wizeworks/builder-schemas';
import { AUTHORS_LIST_REF, type KindFieldLike } from '@wizeworks/silica-catalog';

import { authorPieceCard, authorRecord, type PublicAuthorPage } from './authors';
import type { ApiEntry } from './content';
import { creditValue, pieceRecord } from './kind-pieces';

const JEAN_LUC_ID = '0e3c8a1e-5d1c-4b8f-9c55-1f7c2b7a9d10';
const PEOPLE = {
  [JEAN_LUC_ID]: { display_name: 'Jean-Luc Marchetti-Owusu', slug: 'jean-luc-marchetti-owusu' },
};

const FIELDS: KindFieldLike[] = [
  { key: 'title', type: 'text', label: 'Title' },
  { key: 'standfirst', type: 'long_text', label: 'Standfirst' },
  { key: 'heroImage', type: 'asset', label: 'Hero image' },
  { key: 'photographBy', type: 'author', label: 'Photograph by' },
];

const ENTRY: ApiEntry = {
  id: 'e1',
  type_key: 'article',
  slug: 'the-last-mill-on-the-nene',
  status: 'published',
  body: {
    title: 'The last mill on the Nene',
    standfirst: 'Hannah Reeve grinds flour with the river.',
    heroImage: 'asset-1',
    photographBy: JEAN_LUC_ID,
  },
  seo: {},
  published_at: '2026-10-01T05:00:00.000Z',
  updated_at: '2026-10-01T05:00:00.000Z',
  author: {
    display_name: 'Rosalind Pike',
    slug: 'rosalind-pike',
    bio: 'Editor.',
    avatar_asset_id: null,
  },
  terms: [],
};

describe('the two names for the list of authors', () => {
  it('are one name: the block the editor inserts reads what the site loads', () => {
    expect(AUTHORS_LIST_REF).toBe(AUTHORS_SOURCE_KEY);
  });
});

describe('a piece’s people', () => {
  const record = pieceRecord(
    ENTRY,
    FIELDS,
    '/articles/x',
    'marrow',
    'Europe/London',
    'en-GB',
    PEOPLE
  );

  it('links the byline to the writer’s page', () => {
    expect(record.authorName).toBe('Rosalind Pike');
    expect(record.authorUrl).toBe('/authors/rosalind-pike');
  });

  it('prints a credit as the person’s name, with their page beside it', () => {
    expect(record.photographBy).toBe('Jean-Luc Marchetti-Owusu');
    expect(record.photographByUrl).toBe('/authors/jean-luc-marchetti-owusu');
  });

  it('drops a credit for someone it cannot name, rather than print an id', () => {
    expect(creditValue('photographBy', JEAN_LUC_ID, {})).toEqual({
      photographBy: null,
      photographByUrl: null,
    });
  });

  it('still prints a name typed before the field credited an author, unlinked', () => {
    expect(creditValue('photographBy', 'Jean-Luc Marchetti-Owusu', {})).toEqual({
      photographBy: 'Jean-Luc Marchetti-Owusu',
      photographByUrl: '',
    });
  });

  it('reads several people as one line', () => {
    const tom = 'aaaaaaaa-1111-4222-8333-444444444444';
    const people = { ...PEOPLE, [tom]: { display_name: 'Tom Hale', slug: 'tom-hale' } };
    expect(creditValue('photographBy', [JEAN_LUC_ID, tom], people).photographBy).toBe(
      'Jean-Luc Marchetti-Owusu, Tom Hale'
    );
  });
});

describe('an author’s page', () => {
  const kind = { key: 'article', name: 'Article', pluralName: 'Articles', fields: FIELDS };
  const page: PublicAuthorPage = {
    author: {
      id: JEAN_LUC_ID,
      slug: 'jean-luc-marchetti-owusu',
      display_name: 'Jean-Luc Marchetti-Owusu',
      bio: 'Photographer.',
      avatar_asset_id: null,
    },
    written: [],
    credited: [
      { entry: ENTRY, kind, path: '/articles/the-last-mill-on-the-nene', role: 'Photograph by' },
    ],
  };

  it('is the person, with their pieces in the role they had', () => {
    const record = authorRecord(page, 'marrow', 'Europe/London', 'en-GB');
    expect(record.name).toBe('Jean-Luc Marchetti-Owusu');
    expect(record.url).toBe('/authors/jean-luc-marchetti-owusu');
    expect(record.portrait).toBeNull();
    expect(record.written).toEqual([]);
    const [card] = record.credited as Record<string, unknown>[];
    expect(card).toMatchObject({
      title: 'The last mill on the Nene',
      excerpt: 'Hannah Reeve grinds flour with the river.',
      role: 'Photograph by',
      url: '/articles/the-last-mill-on-the-nene',
      date: '1 October 2026',
    });
  });

  it('gives a piece with no summary none, so the card hides the line', () => {
    const bare = { ...ENTRY, body: { title: 'Notes' } };
    const card = authorPieceCard(
      { entry: bare, kind, path: '/articles/notes', role: null },
      'marrow',
      null,
      'en-US'
    );
    expect(card.excerpt).toBeNull();
    expect(card.featuredImage).toBeNull();
  });
});
