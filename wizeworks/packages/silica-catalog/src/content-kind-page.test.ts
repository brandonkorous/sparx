// The page for one piece of a content kind, built from the kind's own fields.
//
// What these hold is the reason the page is composed rather than written by hand: every
// node it binds is a field the kind really has, so a piece's own words come out on its
// page and no placeholder sentence reaches a reader. The fixture is a real journal's
// Article kind (P09, The Marrow Review), field for field.

import { describe, expect, it } from 'vitest';
import { resolveTree, toHtml, type DataScope } from '@wizeworks/silicaui-html';

import {
  contentKindPage,
  contentKindPageName,
  kindLayout,
  type ContentKindLike,
} from './content-kind-page';
import { finalizeTree } from './render';

const ARTICLE: ContentKindLike = {
  key: 'article',
  name: 'Article',
  pluralName: 'Articles',
  fields: [
    { key: 'title', type: 'text', label: 'Title' },
    { key: 'standfirst', type: 'long_text', label: 'Standfirst' },
    { key: 'body', type: 'rich_text', label: 'Body' },
    { key: 'heroImage', type: 'asset', label: 'Hero image' },
    { key: 'heroCaption', type: 'text', label: 'Hero caption' },
    { key: 'photographBy', type: 'text', label: 'Photograph by' },
    {
      key: 'section',
      type: 'enum',
      label: 'Section',
      options: [
        { label: 'Field', value: 'field' },
        { label: 'Ledger', value: 'ledger' },
      ],
    },
  ],
};

/** The record the storefront binds (`pieceRecord`): fields shown as a reader reads them.
 *  The picture is its address here: the live resolver's `format` turns the `{ url, alt }`
 *  the storefront projects into that, and this double has no `format`. */
const PIECE = {
  title: 'The last mill on the Nene',
  standfirst: 'Hannah Reeve grinds flour with the river, six mornings a week.',
  heroImage: 'https://cdn.test/mill.jpg',
  heroCaption: 'The wheel at Ashton takes the weight of the water.',
  photographBy: 'Photograph by Tom Hale',
  section: 'Ledger',
  date: 'October 1, 2026',
  authorName: 'Rosalind Achebe',
  authorUrl: '/authors/rosalind-achebe',
  url: '/articles/the-last-mill-on-the-nene',
};

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

function render(
  collections: Record<string, readonly unknown[]>,
  kind: ContentKindLike = ARTICLE
): string {
  const host = {
    resolveCollection: (ref: string, scope: DataScope) => {
      const fromItem = readPath(scope.item, ref);
      if (Array.isArray(fromItem)) return fromItem as readonly unknown[];
      return collections[ref];
    },
    resolveBinding: (ref: string, scope: DataScope) => {
      const fromItem = readPath(scope.item, ref);
      return fromItem !== undefined ? { value: fromItem } : undefined;
    },
  };
  return toHtml(finalizeTree(resolveTree(contentKindPage(kind), host)));
}

describe('kindLayout', () => {
  it('places a journal article the way a journal page reads', () => {
    const layout = kindLayout(ARTICLE.fields);
    expect(layout.headline).toBe('title');
    expect(layout.lede).toBe('standfirst');
    expect(layout.body).toBe('body');
    expect(layout.image).toBe('heroImage');
    // The two text fields written straight after the picture describe it.
    expect(layout.imageLines).toEqual(['heroCaption', 'photographBy']);
    // A choice is a fact about the piece, beside its date and byline.
    expect(layout.facts.map((f) => f.key)).toEqual(['section']);
    expect(layout.details).toEqual([]);
  });

  it('takes the first text field as the headline when none is called title', () => {
    const layout = kindLayout([
      { key: 'name', type: 'text', label: 'Name' },
      { key: 'role', type: 'text', label: 'Role' },
    ]);
    expect(layout.headline).toBe('name');
    // A text field not next to a picture is a labelled detail.
    expect(layout.details.map((f) => f.key)).toEqual(['role']);
  });

  it('shows several pictures as a gallery, and leaves out what it cannot show', () => {
    const layout = kindLayout([
      { key: 'title', type: 'text', label: 'Title' },
      { key: 'photos', type: 'asset', label: 'Photos', multiple: true },
      { key: 'related', type: 'reference', label: 'Related' },
      { key: 'steps', type: 'repeater', label: 'Steps' },
      { key: 'starts', type: 'datetime', label: 'Starts' },
    ]);
    expect(layout.gallery).toEqual(['photos']);
    expect(layout.facts.map((f) => f.key)).toEqual(['starts']);
    expect(layout.details).toEqual([]);
  });
});

describe('contentKindPage', () => {
  it('is named the way the other record pages are', () => {
    expect(contentKindPageName(ARTICLE)).toBe('Each article');
    expect(contentKindPageName({ name: 'FAQ' })).toBe('Each FAQ');
  });

  it('shows the piece: headline, standfirst, picture, caption, credit, section and byline', () => {
    const html = render({ article: [PIECE], 'cms.article': [] });
    for (const words of [
      PIECE.title,
      PIECE.standfirst,
      PIECE.heroCaption,
      PIECE.photographBy,
      'Ledger',
      'Rosalind Achebe',
      'October 1, 2026',
      'https://cdn.test/mill.jpg',
    ]) {
      expect(html).toContain(words);
    }
  });

  it('links the byline to the writer’s page', () => {
    const html = render({ article: [PIECE], 'cms.article': [] });
    expect(html).toContain('href="/authors/rosalind-achebe"');
  });

  it('credits the photographer by name and links them, when the credit is one of her authors', () => {
    const credited: ContentKindLike = {
      ...ARTICLE,
      fields: ARTICLE.fields.map((f) => (f.key === 'photographBy' ? { ...f, type: 'author' } : f)),
    };
    expect(kindLayout(credited.fields).imageLines).toEqual(['heroCaption', 'photographBy']);
    const piece = {
      ...PIECE,
      photographBy: 'Jean-Luc Marchetti-Owusu',
      photographByUrl: '/authors/jean-luc-marchetti-owusu',
    };
    const html = render({ article: [piece], 'cms.article': [] }, credited);
    expect(html).toContain('Photograph by');
    expect(html).toContain('Jean-Luc Marchetti-Owusu');
    expect(html).toContain('href="/authors/jean-luc-marchetti-owusu"');
    expect(html).not.toContain('Their name');
  });

  it('prints none of its own placeholder words over a real piece', () => {
    // The storefront always answers the end list, empty or not; left unanswered, a test
    // double keeps its authored card, which is a different question.
    const html = render({ article: [PIECE], 'cms.article': [] });
    expect(html).not.toContain('Article title');
    expect(html).not.toContain('The short summary of this article.');
    expect(html).not.toContain('About the picture');
    expect(html).not.toContain('Author name');
  });

  it('drops the picture and its lines when a piece has none', () => {
    // Missing is null in the record (`fieldValue`), never left out.
    const bare = { ...PIECE, heroImage: null, heroCaption: null, photographBy: null };
    const html = render({ article: [bare], 'cms.article': [] });
    expect(html).not.toContain('<figure');
    expect(html).toContain(PIECE.title);
  });

  it('links the other pieces of the kind at the end, and says so when there are none', () => {
    const other = {
      title: 'Notes on a failed harvest',
      standfirst: 'Three mornings on a forty-acre field.',
      date: 'September 20, 2026',
      url: '/articles/notes-on-a-failed-harvest',
    };
    const html = render({ article: [PIECE], 'cms.article': [other] });
    expect(html).toContain('More articles');
    expect(html).toContain('href="/articles/notes-on-a-failed-harvest"');
    expect(html).toContain('Notes on a failed harvest');

    const alone = render({ article: [PIECE], 'cms.article': [] });
    expect(alone).toContain('This is the only article so far.');
  });

  it('fetches no more than four for the end list', () => {
    const json = JSON.stringify(contentKindPage(ARTICLE));
    expect(json).toContain('"ref":"cms.article"');
    expect(json).toContain('"limit":4');
  });
});
