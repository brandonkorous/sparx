// The default page for one piece of a content KIND the tenant made — "Each article".
//
// WHY THIS IS BUILT FROM THE KIND'S FIELDS. Every other record page here is written by
// hand, because the platform knows what a product or a blog post holds. A kind is the
// tenant's own: a journal's Article has a standfirst, a hero image, a caption and a
// credit; a venue's Event has a start time and a place. A hand-written page could only
// bind fields it guessed at, and an unbound guess renders its placeholder words on the
// live site. So the page is composed from the kind's own field list, every node bound to
// a field that exists, and the result is an ordinary page the owner can then restyle.
//
// HOW THE FIELDS ARE PLACED (`kindLayout`). Order is the author's: the field list is read
// top to bottom, the way she wrote it.
//   · the HEADLINE is the field keyed `title`, else the first text field;
//   · the LEDE is the first long text after it;
//   · the IMAGE is the first single image, and the text fields directly after it in the
//     list are its CAPTION LINES. Fields describing a picture are written next to it, and
//     reading them that way puts a credit under the photograph instead of in a list;
//   · a credit (a field naming one of the business's authors, "Photograph by") is a
//     caption line when it follows the image and a fact otherwise, printed as its label
//     and the person's name, linked to their page;
//   · choices and dates are FACTS about the piece and sit beside the date and byline;
//   · the first rich text is the BODY, drawn by the article-body core;
//   · several images are a GALLERY;
//   · every other plain field is a labelled DETAIL below the body.
// Links to other entries, groups and lists have no one right way to be shown, so this
// page leaves them out. They stay bindable in the editor.
//
// AUTHORING CONTRACT (builder-contract §5): a FRESH, id-free `Node`; every class a
// literal string so the Tailwind `@source` harness safelists it; refs scope-relative.

import { bind, el, repeat, type ElementNode, type Node } from '@wizeworks/silicaui-html';

import { bindAttr } from './attr-binding';
import { repeatOrEmpty, visibleWhen } from './conditional';
import { HOST_KEYS, hostCore } from './host-nodes';
import { PLACEHOLDER_IMAGE } from './placeholder';

/** One field of a kind, as the content-type schema stores it. Structural, so the CMS
 *  row and the binding schema both satisfy it without this package depending on either. */
export interface KindFieldLike {
  key: string;
  label: string;
  type: string;
  multiple?: boolean;
  accept?: string[];
  options?: { label: string; value: string }[];
}

/** A content kind, as far as its page needs to know it. */
export interface ContentKindLike {
  key: string;
  name: string;
  pluralName: string;
  fields: readonly KindFieldLike[];
}

/** Where each of a kind's fields goes on its page. Keys only; see the file header. */
export interface KindLayout {
  headline: string | null;
  lede: string | null;
  image: string | null;
  imageLines: string[];
  facts: KindFieldLike[];
  body: string | null;
  gallery: string[];
  details: KindFieldLike[];
}

const TEXT_TYPES = new Set(['text', 'slug', 'url', 'email']);
/** What may sit under a picture as one of its lines: a caption, a credit. */
const LINE_TYPES = new Set(['text', 'author']);
const PLAIN_TYPES = new Set([
  'text',
  'long_text',
  'slug',
  'url',
  'email',
  'number',
  'boolean',
  'color',
]);

function isImage(field: KindFieldLike): boolean {
  if (field.type !== 'asset') return false;
  const accept = field.accept ?? [];
  return accept.length === 0 || accept.some((a) => a.startsWith('image/'));
}

/** Where each field goes. Pure and exported: the storefront asks it which field is the
 *  body, and the tests ask it everything else. */
export function kindLayout(fields: readonly KindFieldLike[]): KindLayout {
  const placed = new Set<string>();
  const take = (field: KindFieldLike | undefined): string | null => {
    if (!field) return null;
    placed.add(field.key);
    return field.key;
  };

  const headline = take(
    fields.find((f) => f.key === 'title' && TEXT_TYPES.has(f.type)) ??
      fields.find((f) => f.type === 'text')
  );
  const lede = take(fields.find((f) => f.type === 'long_text' && !placed.has(f.key)));

  const imageIndex = fields.findIndex((f) => isImage(f) && !f.multiple);
  const image = imageIndex >= 0 ? take(fields[imageIndex]) : null;
  const imageLines: string[] = [];
  if (imageIndex >= 0) {
    for (const field of fields.slice(imageIndex + 1)) {
      if (!LINE_TYPES.has(field.type) || placed.has(field.key)) break;
      imageLines.push(take(field)!);
    }
  }

  const body = take(fields.find((f) => f.type === 'rich_text'));

  const facts: KindFieldLike[] = [];
  const gallery: string[] = [];
  const details: KindFieldLike[] = [];
  for (const field of fields) {
    if (placed.has(field.key)) continue;
    if (
      (field.type === 'enum' && !field.multiple) ||
      field.type === 'date' ||
      field.type === 'datetime' ||
      field.type === 'author'
    ) {
      facts.push(field);
    } else if (isImage(field) && field.multiple) {
      gallery.push(field.key);
    } else if (PLAIN_TYPES.has(field.type)) {
      details.push(field);
    }
  }
  return { headline, lede, image, imageLines, facts, body, gallery, details };
}

/** "Article" → "article", for the page's own words. A name that is an acronym stays. */
function lower(name: string): string {
  return /^[A-Z0-9]{2,}$/.test(name) ? name : name.toLowerCase();
}

/** What the page is called in the page switcher, the same shape as `Each blog post`. */
export function contentKindPageName(kind: Pick<ContentKindLike, 'name'>): string {
  return `Each ${lower(kind.name)}`;
}

/** The date, the byline and the kind's own facts — one line of facts about the piece,
 *  never an eyebrow (see `cms.ts` on why the post date sits where it does). */
function metaLine(layout: KindLayout): Node {
  const fact = (ref: string, inner: Node, separated: boolean): ElementNode =>
    visibleWhen(
      el('span', 'flex items-center gap-2', {
        children: [...(separated ? [el('span', undefined, { text: '·' })] : []), inner],
      }),
      ref
    );
  return el('div', 'flex flex-wrap items-center gap-2 text-base font-semibold text-base-content', {
    children: [
      fact('date', bind(el('span', undefined, { text: 'Published date' }), 'date'), false),
      fact('authorName', personLink('authorName', 'authorUrl', 'Author name'), true),
      ...layout.facts.map((f) =>
        fact(
          f.key,
          f.type === 'author' ? credit(f) : bind(el('span', undefined, { text: f.label }), f.key),
          true
        )
      ),
    ],
  });
}

/** A person's name, linking to their page. The address is bound beside the name
 *  (`authorUrl`, `photographByUrl`) because one node carries one binding. */
export function personLink(ref: string, urlRef: string, placeholder: string): ElementNode {
  return bindAttr(
    el('a', 'link link-hover', {
      attrs: { href: '/' },
      children: [bind(el('span', undefined, { text: placeholder }), ref)],
    }),
    'href',
    urlRef
  );
}

/** "Photograph by Jean-Luc Marchetti-Owusu", the name linked to their page. */
function credit(field: KindFieldLike): ElementNode {
  return el('span', 'inline-flex flex-wrap gap-x-1', {
    children: [
      el('span', undefined, { text: field.label }),
      personLink(field.key, `${field.key}Url`, 'Their name'),
    ],
  });
}

function masthead(kind: ContentKindLike, layout: KindLayout): Node {
  return el('section', 'w-full @container bg-base-200 text-base-content', {
    children: [
      el('div', 'mx-auto w-full max-w-5xl px-6 pt-12 pb-16 @2xl:pt-16 @2xl:pb-20', {
        children: [
          el('div', 'flex flex-col gap-5', {
            children: [
              metaLine(layout),
              ...(layout.headline
                ? [
                    bind(
                      el(
                        'h1',
                        'max-w-4xl text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-5xl',
                        { text: `${kind.name} title` }
                      ),
                      layout.headline
                    ),
                  ]
                : []),
              ...(layout.lede
                ? [
                    // Wrapped, because `visibleWhen` and `bind` both write the node's one
                    // data marker: gating the bound node itself would unbind it.
                    visibleWhen(
                      el('div', undefined, {
                        children: [
                          bind(
                            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                              text: `The short summary of this ${lower(kind.name)}.`,
                            }),
                            layout.lede
                          ),
                        ],
                      }),
                      layout.lede
                    ),
                  ]
                : []),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The image and the lines that describe it. `alt` stays empty for the reason the post
 *  page gives: it sits under the headline it illustrates. */
function figure(layout: KindLayout, fields: readonly KindFieldLike[]): Node | null {
  if (!layout.image) return null;
  const isCredit = (key: string) => fields.some((f) => f.key === key && f.type === 'author');
  return visibleWhen(
    el('section', 'w-full @container bg-base-100', {
      children: [
        el('figure', 'mx-auto flex w-full max-w-5xl flex-col gap-3 px-6 py-10', {
          children: [
            bind(
              el('img', 'aspect-video w-full rounded-box object-cover', {
                attrs: { src: PLACEHOLDER_IMAGE, alt: '', loading: 'eager' },
              }),
              layout.image
            ),
            ...(layout.imageLines.length > 0
              ? [
                  el('figcaption', 'flex flex-wrap gap-x-3 gap-y-1 text-sm text-base-content', {
                    children: layout.imageLines.map((ref) =>
                      visibleWhen(
                        el('span', undefined, {
                          children: [
                            isCredit(ref)
                              ? credit(fields.find((f) => f.key === ref)!)
                              : bind(el('span', undefined, { text: 'About the picture' }), ref),
                          ],
                        }),
                        ref
                      )
                    ),
                  }),
                ]
              : []),
          ],
        }),
      ],
    }),
    layout.image
  );
}

function articleBody(): Node {
  return el('section', 'w-full @container bg-base-100 text-base-content', {
    children: [
      el('div', 'mx-auto w-full max-w-5xl px-6 pb-16 @2xl:pb-20', {
        children: [hostCore(HOST_KEYS.cmsArticleBody, 'w-full max-w-3xl')],
      }),
    ],
  });
}

/** Several pictures, each its own figure. The list is the field itself; each item is a
 *  `{ url, alt }` the storefront resolves. */
function gallery(ref: string): Node {
  return visibleWhen(
    el('section', 'w-full @container bg-base-100', {
      children: [
        el('div', 'mx-auto w-full max-w-5xl px-6 pb-16', {
          children: [
            repeat(
              el('div', 'grid grid-cols-1 gap-4 @2xl:grid-cols-2', {
                children: [
                  bind(
                    el('img', 'aspect-[4/3] w-full rounded-box object-cover', {
                      attrs: { src: PLACEHOLDER_IMAGE, alt: '', loading: 'lazy' },
                    }),
                    'item'
                  ),
                ],
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

/** Every other plain field, under its own label. A detail with no value is dropped. */
function details(fields: readonly KindFieldLike[]): Node | null {
  if (fields.length === 0) return null;
  return el('section', 'w-full @container bg-base-100 text-base-content', {
    children: [
      el(
        'dl',
        'mx-auto grid w-full max-w-5xl grid-cols-1 gap-x-8 gap-y-4 px-6 pb-16 @2xl:grid-cols-2',
        {
          children: fields.map((f) =>
            visibleWhen(
              el('div', 'flex flex-col gap-1', {
                children: [
                  el('dt', 'text-base font-semibold text-base-content', { text: f.label }),
                  bind(el('dd', 'text-base text-base-content', { text: f.label }), f.key),
                ],
              }),
              f.key
            )
          ),
        }
      ),
    ],
  });
}

/** The way on: the kind's other pieces, newest first. A reader who finishes one is
 *  otherwise at a dead end, and a link to an index page would be a guess about where
 *  the tenant keeps one. The storefront leaves the piece being read out of this list. */
function moreOfKind(kind: ContentKindLike, layout: KindLayout): Node {
  const card = bindAttr(
    el(
      'a',
      'group flex h-full flex-col gap-3 rounded-box border border-base-300 bg-base-100 p-6 transition hover:border-primary',
      {
        attrs: { href: '/' },
        children: [
          bind(
            el('span', 'text-sm font-semibold text-base-content', { text: 'Published date' }),
            'date'
          ),
          ...(layout.headline
            ? [
                bind(
                  el('h3', 'text-xl font-bold leading-snug tracking-tight text-base-content', {
                    text: `${kind.name} title`,
                  }),
                  layout.headline
                ),
              ]
            : []),
          ...(layout.lede
            ? [
                bind(
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: `The short summary of this ${lower(kind.name)}.`,
                  }),
                  layout.lede
                ),
              ]
            : []),
        ],
      }
    ),
    'href',
    'url'
  );
  const grid = repeatOrEmpty(
    el('div', 'grid grid-cols-1 items-stretch gap-6 @3xl:grid-cols-2', { children: [card] }),
    `cms.${kind.key}`,
    `This is the only ${lower(kind.name)} so far.`
  );
  // Four is a curation, not a catalog: the storefront fetches no more than this and
  // draws no pager under it (see `collectSilicaSourceNeeds`).
  const first = grid[0] as ElementNode;
  if (first.data?.kind === 'collection') {
    (first.data as { limit?: number }).limit = 4;
  }
  return el('section', 'w-full @container bg-base-200 text-base-content', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-6 px-6 py-16', {
        children: [
          el('h2', 'text-2xl font-bold tracking-tight text-base-content @2xl:text-3xl', {
            text: `More ${lower(kind.pluralName)}`,
          }),
          ...grid,
        ],
      }),
    ],
  });
}

/**
 * The full page for one piece of `kind` — its record page's default.
 *
 * Self-scoping like `blogPostPage`: the piece repeats over the in-scope record, keyed by
 * the kind's own key (`article`), which is the record source the editor's binding
 * picker offers for the kind. So a field the owner binds in the editor and a field this
 * page binds read the same thing. The "More" strip sits OUTSIDE that scope, as the
 * product page's related carousel sits outside its buy box: it lists other records.
 */
export function contentKindPage(kind: ContentKindLike): Node {
  const layout = kindLayout(kind.fields);
  const parts: (Node | null)[] = [
    masthead(kind, layout),
    figure(layout, kind.fields),
    layout.body ? articleBody() : null,
    ...layout.gallery.map(gallery),
    details(layout.details),
  ];
  const piece = repeat(
    el('div', 'flex flex-col', { children: parts.filter((p): p is Node => p !== null) }),
    kind.key
  );
  return el('div', 'flex flex-col', { children: [piece, moreOfKind(kind, layout)] });
}
