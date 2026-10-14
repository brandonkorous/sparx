// An author's own page — `/authors/rosalind-pike` — and the list of a site's authors.
//
// A journal's byline is a link: a reader who liked a piece goes to the writer to find
// the rest of their work. The page says who they are (portrait, name, biography) and
// lists what they wrote, then everything they are credited on in another role ("Photograph
// by"), each with that role, so a photographer who wrote nothing still has a page that
// lists their pictures.
//
// AUTHORING CONTRACT (builder-contract §5): FRESH, id-free nodes; every class a literal
// string; refs scope-relative inside the `author` record scope.

import { atom, bind, el, repeat, type Node } from '@wizeworks/silicaui-html';

import { bindAttr } from './attr-binding';
import { repeatOrEmpty, visibleWhen } from './conditional';
import { PLACEHOLDER_IMAGE } from './placeholder';

/** The list of a site's authors, as the binding catalog names it (`AUTHORS_SOURCE_KEY`
 *  in @wizeworks/builder-schemas, which this package cannot import). The site's
 *  `author-pages.test.ts` holds the two to one answer. */
export const AUTHORS_LIST_REF = 'cmsAuthors';

/** One piece in an author's list: picture, date, headline, summary, and the role when
 *  they are credited rather than the writer. */
function pieceCard(): Node {
  return bindAttr(
    el(
      'a',
      'group flex h-full flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-6 transition hover:border-primary',
      {
        attrs: { href: '/' },
        children: [
          visibleWhen(
            el('div', undefined, {
              children: [
                bind(
                  atom('Image', 'aspect-video w-full rounded-box object-cover', {
                    src: PLACEHOLDER_IMAGE,
                    alt: '',
                  }),
                  'featuredImage'
                ),
              ],
            }),
            'featuredImage'
          ),
          el('div', 'flex flex-wrap gap-x-2 text-sm font-semibold text-base-content', {
            children: [
              bind(el('span', undefined, { text: 'Published date' }), 'date'),
              visibleWhen(
                el('span', 'flex gap-2', {
                  children: [
                    el('span', undefined, { text: '·' }),
                    bind(el('span', undefined, { text: 'Credited as' }), 'role'),
                  ],
                }),
                'role'
              ),
            ],
          }),
          bind(
            el('h3', 'text-xl font-bold leading-snug tracking-tight text-base-content', {
              text: 'Headline',
            }),
            'title'
          ),
          visibleWhen(
            el('div', undefined, {
              children: [
                bind(
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'The short summary of this piece.',
                  }),
                  'excerpt'
                ),
              ],
            }),
            'excerpt'
          ),
        ],
      }
    ),
    'href',
    'url'
  );
}

function pieceList(heading: string, ref: string): Node {
  return visibleWhen(
    el('section', 'w-full @container bg-base-100 text-base-content', {
      children: [
        el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-12', {
          children: [
            el('h2', 'text-2xl font-bold tracking-tight text-base-content @2xl:text-3xl', {
              text: heading,
            }),
            repeat(
              el('div', 'grid grid-cols-1 items-stretch gap-6 @3xl:grid-cols-2', {
                children: [pieceCard()],
              }),
              ref
            ),
          ],
        }),
      ],
    }),
    ref
  );
}

function masthead(): Node {
  return el('section', 'w-full @container bg-base-200 text-base-content', {
    children: [
      el(
        'div',
        'mx-auto flex w-full max-w-5xl flex-col gap-8 px-6 py-12 @2xl:flex-row @2xl:items-start @2xl:py-16',
        {
          children: [
            visibleWhen(
              el('div', 'shrink-0', {
                children: [
                  bind(
                    atom('Image', 'size-32 rounded-full object-cover @2xl:size-40', {
                      src: PLACEHOLDER_IMAGE,
                      alt: '',
                    }),
                    'portrait'
                  ),
                ],
              }),
              'portrait'
            ),
            el('div', 'flex max-w-3xl flex-col gap-5', {
              children: [
                bind(
                  el(
                    'h1',
                    'text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-5xl',
                    { text: 'Their name' }
                  ),
                  'name'
                ),
                visibleWhen(
                  el('div', undefined, {
                    children: [
                      bind(
                        el('p', 'text-lg leading-relaxed text-base-content', {
                          text: 'A few lines about them.',
                        }),
                        'bio'
                      ),
                    ],
                  }),
                  'bio'
                ),
              ],
            }),
          ],
        }
      ),
    ],
  });
}

/**
 * One author's page — the `cms.author` record page's default.
 *
 * Self-scoping like `blogPostPage`: it repeats over the in-scope `author` record, whose
 * `written` and `credited` lists are the pieces. A list with nothing in it is left out
 * rather than headed over nothing.
 */
export function authorPage(): Node {
  return repeat(
    el('div', 'flex flex-col', {
      children: [masthead(), pieceList('Writing', 'written'), pieceList('Credits', 'credited')],
    }),
    'author'
  );
}

/** One author in the site's list: portrait, name, the start of their biography. The name
 *  is a second-level heading: the list sits under the page's own title, as the writing
 *  list's cards do. */
function authorCard(): Node {
  return bindAttr(
    el(
      'a',
      'group flex h-full flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-6 transition hover:border-primary',
      {
        attrs: { href: '/' },
        children: [
          visibleWhen(
            el('div', undefined, {
              children: [
                bind(
                  atom('Image', 'size-24 rounded-full object-cover', {
                    src: PLACEHOLDER_IMAGE,
                    alt: '',
                  }),
                  'portrait'
                ),
              ],
            }),
            'portrait'
          ),
          bind(
            el('h2', 'text-xl font-bold leading-snug tracking-tight text-base-content', {
              text: 'Their name',
            }),
            'name'
          ),
          visibleWhen(
            el('div', undefined, {
              children: [
                bind(
                  el('p', 'line-clamp-4 text-base leading-relaxed text-base-content', {
                    text: 'A few lines about them.',
                  }),
                  'bio'
                ),
              ],
            }),
            'bio'
          ),
        ],
      }
    ),
    'href',
    'url'
  );
}

/** The list of a site's authors, each linking to their page — a contributors index.
 *  Everyone with something published on the site, writers first. */
export function authorsList(): Node {
  // The catalog sections' measure (`section()`), so it lines up under a Page top.
  return el('section', 'w-full @container bg-base-100', {
    children: [
      el('div', 'mx-auto w-full max-w-6xl px-6 py-16', {
        children: [
          ...repeatOrEmpty(
            el('div', 'grid grid-cols-1 items-stretch gap-6 @3xl:grid-cols-2', {
              children: [authorCard()],
            }),
            AUTHORS_LIST_REF,
            'Nobody has anything published yet.'
          ),
        ],
      }),
    ],
  });
}
