// sparx-longform-literary — the LITERARY LONGFORM content site template
// (docs/templates/content/new-yorker). The reading-first counterpart to the dense
// news feed: where that models a scan-speed newsroom, this models a curated magazine —
// a front page that reads as an editor's TABLE OF CONTENTS, and an article page tuned
// for reading an essay end to end.
//
// The literary-magazine archetype, translated to sparx: a single ranked LEAD ESSAY over
// a rail of the issue's other pieces, a bound live journal, a curated "in this issue"
// contents band, magazine departments (Essays, Reporting, Fiction, Criticism, Notebook),
// and a bespoke serif article page carrying a real byline. Shipped as The Meridian, an
// essays & ideas magazine — "Where an argument has room to breathe." Dressed in the
// bespoke `broadsheet` theme (warm paper ground, serif across, one editorial red — the
// printerly, low-density look a reading site wants), resolved automatically from the slug.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts` (content-theme resolution + the `article` slot — the content
// analog of `pdp`). The article DATA plumbing lives in the shared `template-sites/article.ts`
// kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-longform-literary.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-longform-literary/**" \
//     "marketplace-catalog/_gen/**/*.ts"
//   pnpm --filter @sparx/api-rest marketplace:self-register
//
// A CONTENT template still ships the full 9-page superset (the module-independent rule:
// author complete, the installer writes the tenant's enabled slices) — so it carries a
// LIGHT commerce slice (the print quarterly as a subscription, an anthology, a tote) that
// doubles as the content+commerce demo. The bespoke effort goes where a publisher lives:
// the article.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  el,
  type Node,
} from '../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { productsBlock } from '../../packages/silica-catalog/src/commerce';
import { blogPostGrid } from '../../packages/silica-catalog/src/cms';
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import {
  articleAuthorAvatar,
  articleAuthorCard,
  articleDate,
  articleAuthorName,
  articleFeaturedImage,
  articlePage,
  articleRubric,
  articleStandfirst,
  articleTitle,
} from './template-sites/article';

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Royalty-free Unsplash photographs, verified reachable (HTTP 200) at authoring time.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
  // Lead essay + story imagery (books, print, reading — hot-linked; also in `assets`)
  leadEssay: '1481627834876-b7833e8f5570',
  storyLetterpress: '1516414447565-b14be0adf13e',
  storyFiction: '1519682337058-a94d519337bc',
  storyCriticism: '1512820790803-83ca734da794',
  storyNotebook: '1517842645767-c639042777db',
  storyReading: '1507842217343-583bb7270b66',
  // Author portraits
  authorVance: '1494790108377-be9c29b29330',
  authorMercer: '1500648767791-00dcc994a43e',
  authorAdeyemi: '1573497019940-1c28c88b4f3e',
  // Store imagery
  quarterly: '1543286386-713bdd548da4',
  anthology: '1544716278-ca5e3f4abd8c',
  reader: '1524995997946-a1c2e315a42f',
  tote: '1591561954557-26941169b49e',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'lead-essay', url: U(IMG.leadEssay), alt: 'Open books stacked on a wooden reading table' },
  { id: 'story-letterpress', url: U(IMG.storyLetterpress), alt: 'Metal type set in a letterpress tray' },
  { id: 'story-fiction', url: U(IMG.storyFiction), alt: 'A wall of worn hardback books on a shelf' },
  { id: 'story-criticism', url: U(IMG.storyCriticism), alt: 'A stack of well-read paperbacks' },
  { id: 'story-notebook', url: U(IMG.storyNotebook), alt: 'A hand writing in an open notebook' },
  { id: 'story-reading', url: U(IMG.storyReading), alt: 'An open book, pages fanned in soft light' },
  { id: 'author-vance', url: U(IMG.authorVance), alt: 'Portrait of Eleanor Vance' },
  { id: 'author-mercer', url: U(IMG.authorMercer), alt: 'Portrait of Julian Mercer' },
  { id: 'author-adeyemi', url: U(IMG.authorAdeyemi), alt: 'Portrait of Sofia Adeyemi' },
  { id: 'quarterly-cover', url: U(IMG.quarterly), alt: 'The cover of a printed quarterly magazine' },
  { id: 'anthology-cover', url: U(IMG.anthology), alt: 'A hardback anthology on a desk' },
  { id: 'reader-edition', url: U(IMG.reader), alt: 'A reader with the magazine and a coffee' },
  { id: 'tote-bag', url: U(IMG.tote), alt: 'A canvas tote bag' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-longform-literary: unknown asset "${id}"`);
  return a.url;
};

// ── Home page bands (the front page as a table of contents) ───────────────────────

/** A contents ENTRY — the pieces beside the lead essay and in the "in this issue" band.
 *  A small-caps department rubric over a serif headline: an editorial device the platform
 *  bans on its OWN surfaces but a tenant's published site is free to use (design freedom),
 *  so it is authored here at the bundle level, never through the house-ruled catalog. It
 *  links to the real post address (`/blog/<slug>`) — static cards to a record route, the
 *  correct way to link a curated index (a live CMS list source exposes no per-item href). */
function contentsEntry(rubric: string, headline: string, meta: string, href: string): Node {
  return el('a', 'group flex flex-col gap-2 border-t border-base-300 py-5', {
    attrs: { href },
    children: [
      el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: rubric }),
      // h2, not h3: these are peers of the lead's h1, not subordinate to it — an h1→h3 jump
      // is a skipped level a screen-reader outline reports (blueprint-sweep).
      el('h2', 'text-xl font-semibold leading-snug text-base-content', { text: headline }),
      el('p', 'text-base leading-relaxed text-base-content', { text: meta }),
    ],
  });
}

/** The front-page LEAD ESSAY — the one piece given the whole width, with the rest of the
 *  issue down a contents rail beside it. The editor's front page in one band. */
function leadEssayBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @4xl:grid-cols-3', {
        children: [
          // The lead essay itself — two-thirds of the width on a wide container.
          el('a', 'group flex flex-col gap-5 @4xl:col-span-2', {
            attrs: { href: '/blog/in-praise-of-the-long-paragraph' },
            children: [
              el(
                'img',
                'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover',
                {
                  attrs: {
                    src: assetUrl('lead-essay'),
                    alt: 'Open books stacked on a wooden reading table',
                    loading: 'lazy',
                  },
                },
              ),
              el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                text: 'Essays',
              }),
              el(
                'h1',
                'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-5xl',
                { text: 'In praise of the long paragraph' },
              ),
              el('p', 'max-w-2xl text-xl leading-relaxed text-base-content', {
                text: 'We have trained ourselves to read in fragments, one glowing card at a time. What we lose is the single most useful thing prose can do: hold a thought long enough to change your mind about it.',
              }),
              el('p', 'text-base text-base-content', { text: 'By Eleanor Vance · 6 August' }),
            ],
          }),
          // The contents rail — the rest of this issue.
          el('div', 'flex flex-col', {
            children: [
              contentsEntry(
                'Reporting',
                'The last letterpress in the valley',
                'By Julian Mercer',
                '/blog/the-last-letterpress-in-the-valley',
              ),
              contentsEntry(
                'Fiction',
                'The tenant',
                'By Sofia Adeyemi',
                '/blog/the-tenant',
              ),
              contentsEntry(
                'Criticism',
                'What we mean when we call a book difficult',
                'By Eleanor Vance',
                '/blog/what-we-mean-when-we-call-a-book-difficult',
              ),
              contentsEntry(
                'Notebook',
                'Notes on walking a city at night',
                'By Julian Mercer',
                '/blog/notes-on-walking-a-city-at-night',
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A plain section heading band, for the label over the bound live feed. */
function headingBand(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-12 pb-2', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-3', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: heading,
          }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: lead }),
        ],
      }),
    ],
  });
}

/** "In this issue" — a curated table of contents, the front-page device that reads as an
 *  editor's selection rather than a feed. A calm, low-density list on hairline rules, each
 *  entry linking to the real piece. */
function inThisIssue(): Node {
  const row = (num: string, rubric: string, headline: string, dek: string, meta: string, href: string): Node =>
    el('li', 'border-t border-base-300', {
      children: [
        el('a', 'group flex flex-col gap-3 py-6 @2xl:flex-row @2xl:gap-8', {
          attrs: { href },
          children: [
            el('span', 'text-2xl font-bold leading-none text-primary @2xl:w-16', { text: num }),
            el('div', 'flex flex-col gap-2', {
              children: [
                el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                  text: rubric,
                }),
                // h3: a sub-item under the "In this issue" h2 — no level skip.
                el('h3', 'text-2xl font-semibold leading-snug text-base-content', { text: headline }),
                el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: dek }),
                el('p', 'text-base text-base-content', { text: meta }),
              ],
            }),
          ],
        }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-4xl flex-col gap-6', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'In this issue',
          }),
          el('ol', 'flex flex-col', {
            children: [
              row(
                'I',
                'Essays',
                'In praise of the long paragraph',
                'On attention, patience, and the sentences that ask something of you.',
                'By Eleanor Vance',
                '/blog/in-praise-of-the-long-paragraph',
              ),
              row(
                'II',
                'Reporting',
                'The last letterpress in the valley',
                'A workshop that still sets type by hand, and the reason people drive two hours to watch.',
                'By Julian Mercer',
                '/blog/the-last-letterpress-in-the-valley',
              ),
              row(
                'III',
                'Fiction',
                'The tenant',
                'A short story about the man upstairs, and the sound that would not resolve.',
                'By Sofia Adeyemi',
                '/blog/the-tenant',
              ),
              row(
                'IV',
                'Criticism',
                'What we mean when we call a book difficult',
                'Difficulty is not a flaw to be forgiven or a virtue to be admired. It is a promise.',
                'By Eleanor Vance',
                '/blog/what-we-mean-when-we-call-a-book-difficult',
              ),
              row(
                'V',
                'Notebook',
                'Notes on walking a city at night',
                'The hours after midnight, when a place stops performing and finally tells the truth.',
                'By Julian Mercer',
                '/blog/notes-on-walking-a-city-at-night',
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The departments — the magazine's standing sections, as a calm grid. The section-fronts
 *  feel: each department is a door into a body of work, not a single dated story. */
function departmentsBand(): Node {
  const dept = (name: string, blurb: string): Node =>
    el('a', 'group flex flex-col gap-2 border-t border-base-300 py-6', {
      attrs: { href: '/journal' },
      children: [
        el('h3', 'text-2xl font-semibold text-base-content', { text: name }),
        el('p', 'text-lg leading-relaxed text-base-content', { text: blurb }),
      ],
    });
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-6', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Departments',
          }),
          el('div', 'grid gap-x-10 @3xl:grid-cols-2 @5xl:grid-cols-3', {
            children: [
              dept('Essays', 'Arguments given the room to develop — on culture, memory, work, and how we live now.'),
              dept('Reporting', 'People and places, reported patiently and told at length.'),
              dept('Fiction', 'New short stories from writers we are proud to publish first.'),
              dept('Criticism', 'Close, generous reading of books, film, and the ideas underneath them.'),
              dept('Notebook', 'Shorter dispatches — observation, doubt, the thinking before the essay.'),
              dept('The Archive', 'Ten years of the magazine, open to read whenever the mood is right.'),
            ],
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  leadEssayBand(),
  headingBand('The latest', 'New writing from The Meridian, most recent first.'),
  blogPostGrid(),
  inThisIssue(),
  departmentsBand(),
  // The content→commerce bridge: the magazine's own store, as a live carousel.
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'From the Meridian Store' }),
];

// ── The bespoke article page (the content template's signature surface) ───────────
// A serif longform reader: the department rubric over a large serif headline, a serif
// standfirst, a real byline (author + date), the lead illustration, then the written body
// on a controlled reading measure, and an author card at the foot. Every bound field
// resolves against the routed post (the `article.ts` kit's `repeat('blog_post')` scope);
// the byline lights up from the storefront's projection (`projectByline`) — a post with no
// author simply renders no byline, never a blank line.

/** The article MASTHEAD — authored UNSCOPED; `articlePage` wraps it in `repeat('blog_post')`.
 *  Held to the reading measure (`max-w-3xl`), serif scale — this is a page you sit with. */
function articleMasthead(): Node {
  return el('section', 'bg-base-100 @container px-6 pt-14 pb-10 @2xl:pt-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
        children: [
          el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
            attrs: { href: '/journal' },
            children: [
              el('span', undefined, { text: '←' }),
              el('span', undefined, { text: 'The Meridian' }),
            ],
          }),
          // The department rubric — the editorial small-caps eyebrow, bound to the category.
          articleRubric('text-sm font-semibold uppercase tracking-wide text-primary'),
          articleTitle(
            'h1',
            'text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-5xl',
          ),
          articleStandfirst('max-w-2xl text-xl leading-relaxed text-base-content'),
          // The byline row — author portrait, name, and date.
          el('div', 'mt-2 flex items-center gap-3 border-t border-base-300 pt-5', {
            children: [
              articleAuthorAvatar('h-12 w-12 rounded-full border border-base-300 object-cover'),
              el('div', 'flex flex-col', {
                children: [
                  articleAuthorName('text-base font-semibold text-base-content'),
                  articleDate('text-base text-base-content'),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The lead illustration band, at the article measure. */
function articleImageBand(): Node {
  return el('section', 'bg-base-100 @container px-6 pb-10', {
    children: [
      el('div', 'mx-auto w-full max-w-3xl', {
        children: [
          articleFeaturedImage(
            'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover',
          ),
        ],
      }),
    ],
  });
}

/** The author card at the foot — portrait, name, bio. Gated on the author bio, so it
 *  appears only when there is genuinely something to say about who wrote the piece. */
function articleFoot(): Node {
  return el('section', 'bg-base-100 @container px-6 pb-16', {
    children: [
      el('div', 'mx-auto w-full max-w-3xl', {
        children: [
          articleAuthorCard({
            cardClass:
              'flex flex-col gap-4 rounded-box border border-base-300 bg-base-200 p-6 @2xl:flex-row @2xl:items-center',
            avatarClass: 'h-16 w-16 rounded-full border border-base-300 object-cover',
            nameClass: 'text-lg font-semibold text-base-content',
            bioClass: 'text-base leading-relaxed text-base-content',
          }),
        ],
      }),
    ],
  });
}

const ARTICLE: Node = articlePage(
  el('div', 'flex flex-col', { children: [articleMasthead(), articleImageBand()] }),
  { foot: articleFoot(), backHref: '/journal' },
);

// ── The journal index masthead (over the bound post grid) ─────────────────────────

const JOURNAL: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-24', {
    children: [
      el('div', 'mx-auto flex w-full max-w-4xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-tight tracking-tight text-base-content @3xl:text-6xl', {
            text: 'The Meridian',
          }),
          el('p', 'max-w-2xl text-xl leading-relaxed text-base-content', {
            text: 'Essays, reporting, fiction and criticism — writing worth your evening, published a little more slowly than the rest of the internet.',
          }),
        ],
      }),
    ],
  }),
];

// ── About + Contact (Meridian-voiced) ─────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'About The Meridian',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The Meridian is a magazine of essays and ideas. We publish long — a piece here can run four thousand words if the argument earns them — because the writing we care about is the kind that needs room to breathe. We would rather run one essay that changes how you see a thing than ten posts that confirm what you already believed.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We are reader-funded, and that is not a detail. It means our only obligation is to you, the person reading — not to an advertiser, not to an algorithm, not to whatever the feed decided was urgent this morning. A membership pays a writer to spend three weeks on a piece, and pays us to hold it until it is finished.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We come out four times a year in print, and every week online. The archive is open. Start anywhere.',
          }),
        ],
      }),
    ],
  }),
];

const CONTACT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20 text-center', {
    children: [
      el('div', 'mx-auto flex w-full max-w-xl flex-col items-center gap-5', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'Write to the editors',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'A pitch, a letter about something we ran, a correction we should make — we read all of it. Submissions and letters go to the same desk, and a real person writes back.',
          }),
          el('a', 'btn btn-primary btn-lg', {
            attrs: { href: 'mailto:editors@themeridian.example' },
            text: 'Email the editors',
          }),
        ],
      }),
    ],
  }),
];

// ── Light commerce (the Meridian Store — the print quarterly, an anthology, merch) ─

const money = (dollars: number): number => Math.round(dollars * 100);

interface Variant {
  sku: string;
  priceCents: number;
  isDefault?: boolean;
  inventoryPolicy: 'continue';
}
interface Product {
  handle: string;
  title: string;
  description: string;
  status: 'active';
  productType: string;
  vendor: string;
  tags: string[];
  categoryHandles: string[];
  collectionHandles: string[];
  seoTitle: string;
  seoDescription: string;
  variants: Variant[];
  images: { assetId: string; isPrimary: true; alt: string }[];
}

const PRODUCTS: Product[] = [
  {
    handle: 'meridian-quarterly-membership',
    title: 'The Meridian Quarterly — annual membership',
    description:
      'Four printed issues a year, delivered, plus everything on the site and the full archive. The membership that pays a writer to spend a month on an essay and lets us hold it until it is ready. This is how the magazine is funded — there is no advertiser behind it.',
    status: 'active',
    productType: 'Membership',
    vendor: 'The Meridian',
    tags: ['membership', 'subscription', 'print'],
    categoryHandles: ['subscriptions'],
    collectionHandles: ['featured'],
    seoTitle: 'The Meridian Quarterly — annual print membership',
    seoDescription:
      'Four printed issues a year plus the full archive online. Reader-funded essays, reporting, fiction and criticism.',
    variants: [
      { sku: 'MER-MEM-ANNUAL', priceCents: money(96), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [
      { assetId: 'quarterly-cover', isPrimary: true, alt: 'The Meridian Quarterly, printed issue' },
    ],
  },
  {
    handle: 'the-long-view-anthology',
    title: 'The Long View — ten years of The Meridian',
    description:
      'A hardback anthology: thirty of the essays, stories and pieces of reporting that defined the magazine’s first decade, chosen by the editors and introduced by the people who wrote them. 464 pages, sewn binding, made to be kept.',
    status: 'active',
    productType: 'Book',
    vendor: 'The Meridian',
    tags: ['book', 'anthology'],
    categoryHandles: ['books'],
    collectionHandles: ['featured'],
    seoTitle: 'The Long View — a ten-year Meridian anthology',
    seoDescription: 'A hardback anthology of thirty essays, stories and reports from the magazine’s first decade.',
    variants: [
      { sku: 'MER-BOOK-LONGVIEW', priceCents: money(38), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'anthology-cover', isPrimary: true, alt: 'The Long View, a hardback anthology' }],
  },
  {
    handle: 'the-fiction-issue',
    title: 'The Fiction Issue — collected',
    description:
      'A slim paperback gathering the best short stories we have published, including three that were never online. A single evening of new fiction, on paper, the way it reads best.',
    status: 'active',
    productType: 'Book',
    vendor: 'The Meridian',
    tags: ['book', 'fiction'],
    categoryHandles: ['books'],
    collectionHandles: ['featured'],
    seoTitle: 'The Fiction Issue — collected short stories | The Meridian',
    seoDescription: 'A paperback of the best short fiction from The Meridian, three of them never published online.',
    variants: [
      { sku: 'MER-BOOK-FICTION', priceCents: money(19), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'reader-edition', isPrimary: true, alt: 'The Fiction Issue, a paperback collection' }],
  },
  {
    handle: 'meridian-tote',
    title: 'The Meridian Tote',
    description:
      'A heavyweight natural-canvas tote with the masthead printed small on the side. Sized for a hardback, a notebook, and the two issues you keep meaning to finish.',
    status: 'active',
    productType: 'Merch',
    vendor: 'The Meridian',
    tags: ['merch', 'tote'],
    categoryHandles: ['merch'],
    collectionHandles: [],
    seoTitle: 'The Meridian Tote — heavyweight canvas tote',
    seoDescription: 'A heavyweight natural-canvas tote with the Meridian masthead.',
    variants: [{ sku: 'MER-TOTE', priceCents: money(26), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'tote-bag', isPrimary: true, alt: 'The Meridian canvas tote' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'subscriptions', name: 'Membership', description: 'Fund the magazine.', featured: true },
    { handle: 'books', name: 'Books', description: 'Anthologies and collections.', featured: true },
    { handle: 'merch', name: 'Merch', description: 'Carry the masthead.', featured: false },
  ],
  collections: [
    {
      handle: 'featured',
      name: 'Featured',
      description: 'What the editors are pointing at this season.',
      type: 'manual',
      featured: true,
      productHandles: ['meridian-quarterly-membership', 'the-long-view-anthology', 'the-fiction-issue'],
    },
  ],
  products: PRODUCTS,
};

// ── The masthead (byline personas) ────────────────────────────────────────────────
// Real authors the posts reference by `authorSlug`. The installer seeds these as CMS
// `Author` rows scoped to the site, and the storefront byline projection resolves them —
// so the bespoke article page shows a real name, portrait and bio, not an empty byline.

const AUTHORS = [
  {
    slug: 'eleanor-vance',
    displayName: 'Eleanor Vance',
    bio: 'Eleanor Vance writes essays and criticism for The Meridian, mostly about books, attention, and the culture of reading. She has been on staff since the magazine’s second year.',
    avatarAssetId: 'author-vance',
  },
  {
    slug: 'julian-mercer',
    displayName: 'Julian Mercer',
    bio: 'Julian Mercer is a reporter at large for The Meridian. He writes long pieces about people and places, and keeps the Notebook when something is too small for an essay and too good to lose.',
    avatarAssetId: 'author-mercer',
  },
  {
    slug: 'sofia-adeyemi',
    displayName: 'Sofia Adeyemi',
    bio: 'Sofia Adeyemi is a fiction writer and critic. Her short stories have appeared in The Meridian and elsewhere; her first collection is out next year.',
    avatarAssetId: 'author-adeyemi',
  },
];

// ── Content (the Meridian writing) ────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'in-praise-of-the-long-paragraph',
    status: 'published',
    authorSlug: 'eleanor-vance',
    categories: ['Essays'],
    tags: ['Reading', 'Attention'],
    body: {
      title: 'In praise of the long paragraph',
      excerpt:
        'We have trained ourselves to read in fragments, one glowing card at a time. What we lose is the single most useful thing prose can do: hold a thought long enough to change your mind about it.',
      featuredImage: { $asset: 'lead-essay' },
      body: {
        type: 'doc',
        content: [
          para(
            'Somewhere in the last twenty years the paragraph got shorter, and then it got shorter again. Open almost anything written to be read on a phone and you will find sentences standing alone, each granted its own white margin of importance, none of them touching. It looks like clarity. It is closer to the opposite.',
          ),
          para(
            'A paragraph is not a container for a sentence. It is an argument in miniature — a place where one idea is stated, complicated, resisted, and finally either earned or abandoned. That work needs length. It needs the second sentence that qualifies the first, and the third that admits the qualification went too far. Break those apart into standalone lines and you have not made the thinking clearer; you have removed the thinking and kept only the conclusions.',
          ),
          h2('What we are actually optimising for'),
          para(
            'The short paragraph is optimised for a particular kind of reading: the scan, the skim, the reader who is deciding in the first two seconds whether to stay. There is nothing wrong with wanting to be read. But a form that is built entirely to survive the first two seconds cannot do anything in the next two hundred. It has traded the whole game for the coin toss.',
          ),
          para(
            'What a long paragraph asks of you is patience, and patience is exactly the muscle the feed has spent a decade wasting. The reward for spending it is the only thing reading has ever really offered: the experience of following a mind that is more careful than your own, for long enough that some of the care rubs off.',
          ),
          h2('An argument with room to breathe'),
          para(
            'This is not nostalgia. Prose is not better because it is old, and a wall of text is not automatically wise. Plenty of long paragraphs are long because the writer would not stop, not because the thought required it. The discipline is to make the length load-bearing — to write the paragraph that could not be three tweets without losing the turn in the middle where the argument actually happens.',
          ),
          para(
            'We started this magazine, in part, to keep a place where that turn can still happen. Give a good writer room and time and the assumption that you will stay to the end, and they will tell you something you did not already believe. That is the whole proposition. It has never scaled well, and it never needed to.',
          ),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'the-last-letterpress-in-the-valley',
    status: 'published',
    authorSlug: 'julian-mercer',
    categories: ['Reporting'],
    tags: ['Craft', 'Print'],
    body: {
      title: 'The last letterpress in the valley',
      excerpt:
        'A workshop that still sets type by hand, one letter at a time, and the reason people drive two hours to stand and watch it happen.',
      featuredImage: { $asset: 'story-letterpress' },
      body: {
        type: 'doc',
        content: [
          para(
            'The shop smells of oil and warm paper before you see anything, and the first thing you see is the drawers — hundreds of them, shallow and wide, each one a compartmented tray holding a single font in a single size. Margaret Okafor has been reaching into those drawers for forty-one years, and she does it now without looking, the way you find a light switch in your own house in the dark.',
          ),
          para(
            'She is setting a wedding invitation. Each letter is a small metal block she lifts from its compartment and stands in a handheld frame called a composing stick, backwards and upside down, reading it in a mirror in her head. A single line of text takes her a few minutes. A page takes an afternoon. When she is done she will ink it, lay a sheet on top, and pull a lever that presses the two together with a force you feel in your sternum from across the room.',
          ),
          h2('Why anyone still does this'),
          para(
            'You can print the same invitation from a laptop in nine seconds, and it will be, by every measurable standard, identical. Okafor knows this better than anyone; she owns a laptop. What the machine cannot make is the bite — the faint valley the type presses into thick cotton paper, the thing your thumb finds before your eye does. People drive from two valleys over to order paper they will run their thumb across for the rest of their lives.',
          ),
          para(
            'The economics should not work, and mostly they do not. She keeps the lights on with the wedding trade and the occasional gallery commission, and she keeps the drawers full because a foundry in Wisconsin still casts type for the handful of shops like hers. When that foundry closes, and it will, she has enough type to last her out. She has thought about this more than she lets on.',
          ),
          h2('An apprentice, maybe'),
          para(
            'There is a young man who comes in on Saturdays. He found the shop the way everyone under thirty finds anything, through a video, and he has stayed the way almost none of them do. Okafor does not call him an apprentice — she says the word would jinx it — but she has started letting him pull the lever, and last month she let him set a whole line alone. He got two letters backwards. She made him find them himself. He did, eventually, and she said nothing, which from Margaret Okafor is the highest thing there is.',
          ),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'the-tenant',
    status: 'published',
    authorSlug: 'sofia-adeyemi',
    categories: ['Fiction'],
    tags: ['Short story'],
    body: {
      title: 'The tenant',
      excerpt:
        'A short story about the man upstairs, the sound that would not resolve, and how long a person will go without knocking on a door.',
      featuredImage: { $asset: 'story-fiction' },
      body: {
        type: 'doc',
        content: [
          para(
            'The sound began in October, or she noticed it in October, which she understood were not the same thing. It came from directly above her bed, a slow and deliberate dragging, as if the man upstairs were moving a single heavy object a few inches at a time across a floor that had all night to receive it. It stopped when she sat up. It resumed when she lay back down. For three weeks she told no one, because to say it aloud was to make it a thing that was happening.',
          ),
          para(
            'She had never met him. She knew he existed the way you know about weather in a country you will not visit: as a set of effects. A pair of brown shoes outside the door on the landing, always the same pair, never worn. The blue flicker of a television at hours when televisions should be off. Once, a smell of oranges so strong on the stairwell that she had stopped, one hand on the rail, and breathed it in like something owed to her.',
          ),
          h2('The knock she did not make'),
          para(
            'A reasonable person knocks. She rehearsed it — a light rap, a neighbourly face, a sentence about the sound that she softened and re-softened until it meant nothing. She got as far as the landing twice. Both times she stood in front of the brown shoes and could not raise her hand, because underneath the neighbourly sentence was a second sentence she could not unthink, which was: what if he answers, and it is fine, and I have to keep living beneath a person I have now decided to be afraid of.',
          ),
          para(
            'So she did not knock, and the not-knocking became its own tenancy, a thing she lived inside. She learned the sound the way Okafor down the road learned her drawers, without looking. Drag, and stop, and drag. Some nights she lay awake and moved with it, shifting an inch when he shifted, a slow duet through a ceiling, two people rearranging a weight that neither of them could name and neither would put down.',
          ),
          para(
            'In December the sound stopped. The shoes were gone from the landing one morning, and the smell of oranges with them, and the silence above her bed was the loudest thing she had ever not heard. She slept badly for a week. Then, one night, without deciding to, she got up, went to the empty landing, and knocked on the door of a flat she knew perfectly well was empty. She stood there a long time. She was, she realised, waiting for it to be fine.',
          ),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'what-we-mean-when-we-call-a-book-difficult',
    status: 'published',
    authorSlug: 'eleanor-vance',
    categories: ['Criticism'],
    tags: ['Books', 'Reading'],
    body: {
      title: 'What we mean when we call a book difficult',
      excerpt:
        'Difficulty is not a flaw to be forgiven or a virtue to be admired. It is a promise a book makes, and the question is only whether it keeps it.',
      featuredImage: { $asset: 'story-criticism' },
      body: {
        type: 'doc',
        content: [
          para(
            'There is a certain kind of review that treats difficulty as a moral failing, and another that treats it as a badge, and both are lazy in the same way: they have decided what difficulty means before they have finished the book. Difficulty is not one thing. A sentence can be hard because the writer is confused, or because the reader is, or because the idea genuinely is — and these are not remotely the same problem, though they arrive wearing the same coat.',
          ),
          para(
            'The confused sentence is the only real failure of the three. When a writer has not worked out what they think, the prose thickens to hide it, and no amount of rereading rewards you, because there is nothing underneath. We have all been fooled by this book. It flatters us into mistaking our own effort for depth, and the tell is that the effort never resolves — you work and work and arrive nowhere, and blame yourself.',
          ),
          h2('The difficulty that keeps its promise'),
          para(
            'The other kind is different in a way you can feel in your body. A genuinely hard idea, honestly rendered, is difficult the way a steep path is difficult: the effort is the point, and it goes somewhere. You reread the sentence not because it is hiding something but because it is holding something too large to take in on one pass. When you finally have it, the difficulty vanishes in retrospect — you cannot imagine why you struggled — and that disappearance is the sign that the difficulty was real and was kept.',
          ),
          para(
            'A critic’s actual job, most of the time, is simply to tell those two apart. Not to forgive difficulty, not to celebrate it, but to report honestly whether the climb led anywhere. That requires finishing the book, and finishing it twice, and being willing to say of a famously hard writer that this time there was nothing at the top — and of an easy one that they had done the hardest thing of all, which is to make it look like no work.',
          ),
          h2('Against the shortcut'),
          para(
            'We live in a golden age of the shortcut: the summary, the thread, the ten-minute version that promises the payoff without the path. For most books this is a mercy, and I use it too. But a certain small number of books are difficult in the way that cannot be summarised, because the difficulty is the meaning — you cannot be told the view, you have to make the climb. Those are the books this magazine exists to point at. They are worth your evening precisely because they will not fit in your morning.',
          ),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'notes-on-walking-a-city-at-night',
    status: 'published',
    authorSlug: 'julian-mercer',
    categories: ['Notebook'],
    tags: ['Cities', 'Observation'],
    body: {
      title: 'Notes on walking a city at night',
      excerpt:
        'The hours after midnight, when a place stops performing for anyone and finally, briefly, tells you the truth about itself.',
      featuredImage: { $asset: 'story-notebook' },
      body: {
        type: 'doc',
        content: [
          para(
            'A city keeps its face on all day. It is a working face, a face for commerce and strangers, and it does not come off at dusk — dusk is only the day’s last and most flattering hour. It comes off around one in the morning, when the last of the going-out has gone out and the earliest of the coming-in has not yet begun, and for a while the place is not showing you anything because it does not know you are there.',
          ),
          para(
            'That is the hour to walk. Not for safety and not for danger, both of which are mostly a matter of which streets, but for honesty. The shop that looks prosperous by day shows you its taped window. The grand avenue admits how few people it is really for. A back street you would never choose turns out to be where the city actually lives — a lit kitchen, a delivery, two cooks on a step, the whole undercarriage of the daytime performance quietly doing the work that makes the performance possible.',
          ),
          h2('What you can only see when no one is selling you anything'),
          para(
            'By day everything is addressed to you: the signs, the lights, the arranged windows, all of it a soft continuous sentence that ends in buy, or enter, or believe. At night that sentence stops, and what is left is the grammar underneath — the actual shape of the streets, the way the ground really slopes, which corners the wind has chosen. You see the city as an object rather than an argument, and it is almost unbearably beautiful in a way it never lets itself be while it is trying to convince you of something.',
          ),
          para(
            'I do not recommend it as a lifestyle. The night walker is a slightly ridiculous figure, and the truths you collect out there do not survive contact with a reasonable bedtime. But once in a while, in a city you think you know, go out at the wrong hour and simply look. You will find it has been keeping a second self from you the whole time, the way people do, and that the second self is the one worth writing down.',
          ),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'longform-literary',
  key: 'sparx-longform-literary',
  name: 'sparx — Longform Literary',
  summary:
    'A serif, reading-first front page for a literary magazine — a single ranked lead essay over a contents rail, a live journal, a curated "in this issue" table of contents, magazine departments, and a bespoke serif article page tuned for reading an essay end to end, in a warm-paper one-red theme. Modelled on the literary-longform archetype; shipped as The Meridian. Ships a light store (a print membership, an anthology, merch) to demonstrate content + commerce together.',
  tagline: 'A serif longform template for a magazine that publishes and sells.',
  vertical: 'content',
  industry: 'Essays, ideas & criticism',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 100,
  brand: {
    businessName: 'The Meridian',
    tagline: 'Where an argument has room to breathe.',
  },
  // A brand-left header with a filled CTA (Subscribe), and the newsletter footer whose
  // bottom bar carries the live © business name.
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'The Meridian — essays, ideas & criticism',
      description:
        'The Meridian is a reader-funded magazine of essays, reporting, fiction and criticism — writing worth your evening, published a little more slowly than the rest of the internet.',
    },
    about: {
      title: 'About The Meridian — a reader-funded magazine of ideas',
      description:
        'Who The Meridian is and how it is funded — reader-supported longform with no advertiser behind it, in print four times a year and online every week.',
    },
  },
  home: HOME,
  journal: JOURNAL,
  article: ARTICLE,
  about: ABOUT,
  contact: CONTACT,
  commerce: COMMERCE,
  authors: AUTHORS,
  content: CONTENT,
  assets: ASSETS,
};

// ── Main ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { dir, theme } = await emitBundle(SPEC);
  console.log(`· wrote bundle → ${dir}`);

  // Oracle 1 — the emitted bundle validates through the real loader.
  const mod = (await import(pathToFileURL(join(dir, 'blueprint.ts')).href)) as {
    default: unknown;
  };
  const result = safeParseBlueprint(mod.default);
  if (result.success) {
    console.log('· safeParseBlueprint → VALID');
  } else {
    console.error('· safeParseBlueprint → INVALID');
    for (const issue of result.issues) console.error(`    ${issue.path}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }

  // Oracle 3 — a self-contained preview for visual review.
  const { path: previewPath } = await writeTemplatePreview(SPEC, theme);
  console.log(`· preview → ${previewPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
