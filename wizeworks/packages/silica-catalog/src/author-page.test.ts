// An author's page and the list of a site's authors, rendered with a real journal's
// people (P09, The Marrow Review): an editor who writes, and a photographer who has
// written nothing and is credited on every picture.

import { describe, expect, it } from 'vitest';
import { resolveTree, toHtml, type DataScope } from '@wizeworks/silicaui-html';

import { AUTHORS_LIST_REF, authorPage, authorsList } from './author-page';
import { finalizeTree } from './render';

function readPath(source: unknown, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, source);
}

function render(root: ReturnType<typeof authorPage>, data: Record<string, unknown>): string {
  const host = {
    resolveCollection: (ref: string, scope: DataScope) => {
      const fromItem = readPath(scope.item, ref);
      if (Array.isArray(fromItem)) return fromItem as readonly unknown[];
      const value = data[ref];
      if (Array.isArray(value)) return value as readonly unknown[];
      return value === undefined ? undefined : [value];
    },
    resolveBinding: (ref: string, scope: DataScope) => {
      const fromItem = readPath(scope.item, ref);
      const value = fromItem !== undefined ? fromItem : data[ref];
      return value !== undefined ? { value } : undefined;
    },
  };
  return toHtml(finalizeTree(resolveTree(root, host)));
}

const MILL = {
  title: 'The last mill on the Nene',
  excerpt: 'Hannah Reeve grinds flour with the river, six mornings a week.',
  featuredImage: 'https://cdn.test/mill.jpg',
  date: 'October 1, 2026',
  kindName: 'Article',
  role: null,
  url: '/articles/the-last-mill-on-the-nene',
};

const ROSALIND = {
  name: 'Rosalind Pike',
  bio: 'Editor. Rosalind spent twenty years as a food editor before starting the journal.',
  portrait: null,
  url: '/authors/rosalind-pike',
  written: [MILL],
  credited: [],
};

const JEAN_LUC = {
  name: 'Jean-Luc Marchetti-Owusu',
  bio: 'Photographer.',
  portrait: null,
  url: '/authors/jean-luc-marchetti-owusu',
  written: [],
  credited: [{ ...MILL, role: 'Photograph by' }],
};

describe('authorPage', () => {
  it('shows who they are and what they wrote, linked', () => {
    const html = render(authorPage(), { author: ROSALIND });
    expect(html).toContain('Rosalind Pike');
    expect(html).toContain(ROSALIND.bio);
    expect(html).toContain('Writing');
    expect(html).toContain(MILL.title);
    expect(html).toContain(`href="${MILL.url}"`);
  });

  it('leaves out a list with nothing in it, rather than a heading over nothing', () => {
    const html = render(authorPage(), { author: ROSALIND });
    expect(html).not.toContain('>Credits<');
  });

  it('lists a photographer’s pictures, with the role they are credited in', () => {
    const html = render(authorPage(), { author: JEAN_LUC });
    expect(html).toContain('Jean-Luc Marchetti-Owusu');
    expect(html).toContain('>Credits<');
    expect(html).toContain('Photograph by');
    expect(html).toContain(MILL.title);
    expect(html).not.toContain('>Writing<');
  });

  it('prints none of its placeholder words over a real author', () => {
    const html = render(authorPage(), { author: ROSALIND });
    for (const words of ['Their name', 'A few lines about them.', 'Headline', 'Credited as']) {
      expect(html).not.toContain(words);
    }
  });
});

describe('authorsList', () => {
  it('lists every author with a link to their page', () => {
    const html = render(authorsList(), { [AUTHORS_LIST_REF]: [ROSALIND, JEAN_LUC] });
    expect(html).toContain('href="/authors/rosalind-pike"');
    expect(html).toContain('href="/authors/jean-luc-marchetti-owusu"');
    expect(html).not.toContain('Nobody has anything published yet.');
  });

  it('titles each person one level under the page title, never skipping one', () => {
    const html = render(authorsList(), { [AUTHORS_LIST_REF]: [ROSALIND] });
    expect(html).toMatch(/<h2[^>]*>Rosalind Pike<\/h2>/);
  });
});
