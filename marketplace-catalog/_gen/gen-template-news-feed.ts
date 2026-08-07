// sparx-news-feed — the FIRST reference-driven CONTENT site template
// (docs/templates/content/techcrunch). The content-side counterpart to the ten commerce
// templates: where those model a Shopify storefront, this models a WORDPRESS-scale
// publisher — the index/feed → article → byline surfaces the commerce set never touched.
//
// The tech-industry news archetype, translated to sparx: a dense front-page feed of
// reporting, a bound live journal, and a bespoke article page carrying a real byline
// (author + section rubric), ported to a technology & business publication — Frequency,
// "the signal in the noise". Dressed in the bespoke `dispatch` theme (white ground, one
// emerald accent, Space Grotesk headings over Inter body — the dense, high-signal look a
// news feed wants).
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts` (extended with content-theme resolution + the `article` slot
// — the content analog of `pdp`). The article DATA plumbing lives in the shared
// `template-sites/article.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-news-feed.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-news-feed/**" \
//     "marketplace-catalog/_gen/**/*.ts"
//   pnpm --filter @sparx/api-rest marketplace:self-register
//
// A CONTENT template still ships the full 9-page superset (the module-independent rule:
// author complete, the installer writes the tenant's enabled slices) — so it carries a
// LIGHT commerce slice (a few reports, a book, a membership) that doubles as the
// content+commerce demo. The bespoke effort goes where a publisher lives: the article.
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
  articleAuthorCard,
  articleAuthorAvatar,
  articleAuthorName,
  articleDate,
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
  // Lead + story imagery (tree imagery, hot-linked; also registered in `assets`)
  lead: '1526374965328-7f61d4dc18c5',
  storyChips: '1518770660439-4636190af475',
  storyGrid: '1451187580459-43490279c0fa',
  storyCode: '1461749280684-dccba630e2f6',
  storyOffice: '1497215728101-856f4ea42174',
  storyClimate: '1466611653911-95081537e5b7',
  storyPolicy: '1529107386315-e1a2ed48a620',
  storyRobot: '1485827404703-89b55fcc595e',
  events: '1540575467063-178a50c2df87',
  // Author portraits
  authorRuiz: '1494790108377-be9c29b29330',
  authorBell: '1500648767791-00dcc994a43e',
  authorAnand: '1573497019940-1c28c88b4f3e',
  // Store imagery
  report: '1543286386-713bdd548da4',
  book: '1544716278-ca5e3f4abd8c',
  membership: '1499750310107-5fef28a66643',
  tote: '1591561954557-26941169b49e',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'lead-story', url: U(IMG.lead), alt: 'A dense server room lit blue' },
  { id: 'story-chips', url: U(IMG.storyChips), alt: 'A close-up of a silicon wafer' },
  { id: 'story-grid', url: U(IMG.storyGrid), alt: 'A national power grid at night' },
  { id: 'story-code', url: U(IMG.storyCode), alt: 'Source code on a dark screen' },
  { id: 'story-office', url: U(IMG.storyOffice), alt: 'A startup team at work' },
  { id: 'story-climate', url: U(IMG.storyClimate), alt: 'A wind farm on a green hillside' },
  { id: 'story-policy', url: U(IMG.storyPolicy), alt: 'A government building colonnade' },
  { id: 'story-robot', url: U(IMG.storyRobot), alt: 'A robotic arm on a factory line' },
  { id: 'events-hall', url: U(IMG.events), alt: 'A conference audience in a dim hall' },
  { id: 'author-ruiz', url: U(IMG.authorRuiz), alt: 'Portrait of Dana Ruiz' },
  { id: 'author-bell', url: U(IMG.authorBell), alt: 'Portrait of Marcus Bell' },
  { id: 'author-anand', url: U(IMG.authorAnand), alt: 'Portrait of Priya Anand' },
  { id: 'report-cover', url: U(IMG.report), alt: 'The cover of a research report' },
  { id: 'book-cover', url: U(IMG.book), alt: 'A hardback book on a desk' },
  { id: 'membership', url: U(IMG.membership), alt: 'A reader at a laptop' },
  { id: 'tote-bag', url: U(IMG.tote), alt: 'A canvas tote bag' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-news-feed: unknown asset "${id}"`);
  return a.url;
};

// ── Home page bands (the front-page feed) ────────────────────────────────────────

/** A story LINK — the secondary items beside the lead and in the rails. A section rubric
 *  over a headline: an editorial device the platform bans on its OWN surfaces but a
 *  tenant's published site is free to use (design freedom), so it is authored here at the
 *  bundle level, never through the house-ruled catalog. */
function storyLink(rubric: string, headline: string, meta: string): Node {
  return el('a', 'group flex flex-col gap-2 border-t border-base-300 py-5', {
    attrs: { href: '/journal' },
    children: [
      el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: rubric }),
      // h2, not h3: these rail stories are peers of the lead's h1, not subordinate to it —
      // an h1→h3 jump is a skipped level a screen-reader outline reports (blueprint-sweep).
      el('h2', 'text-lg font-semibold leading-snug text-base-content', { text: headline }),
      el('p', 'text-sm text-base-content', { text: meta }),
    ],
  });
}

/** The front-page LEAD — the one story given the whole width, with the day's next few
 *  down a rail beside it. The publisher's front page in one band. */
function leadBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-14', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @4xl:grid-cols-3', {
        children: [
          // The lead itself — two-thirds of the width on a wide container.
          el('a', 'group flex flex-col gap-5 @4xl:col-span-2', {
            attrs: { href: '/journal' },
            children: [
              el('img', 'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover', {
                attrs: { src: assetUrl('lead-story'), alt: 'A dense server room lit blue', loading: 'lazy' },
              }),
              el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                text: 'Artificial intelligence',
              }),
              el(
                'h1',
                'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-5xl',
                { text: 'The data-centre boom is quietly rewriting the power grid' },
              ),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'Training the next generation of models needs more electricity than most cities. We followed the contracts, and found utilities planning a decade of build-out around a handful of customers.',
              }),
              el('p', 'text-sm text-base-content', { text: 'By Dana Ruiz · 6 August' }),
            ],
          }),
          // The rail of the day's next stories.
          el('div', 'flex flex-col', {
            children: [
              storyLink(
                'Startups',
                'The seed round is back, and it looks nothing like 2021',
                'By Marcus Bell · 5 August',
              ),
              storyLink(
                'Policy',
                'What the new export rules actually cover, line by line',
                'By Priya Anand · 5 August',
              ),
              storyLink(
                'Climate tech',
                'The grid-scale battery that finally pencils out',
                'By Dana Ruiz · 4 August',
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
  return el('section', 'bg-base-100 @container px-6 pt-10 pb-2', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-3', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: heading,
          }),
          el('p', 'max-w-2xl text-lg text-base-content', { text: lead }),
        ],
      }),
    ],
  });
}

/** Most read — a ranked rail. A real `<ol>`, the rank the whole information it carries. */
function mostRead(): Node {
  const row = (rank: string, rubric: string, headline: string): Node =>
    el('li', 'border-t border-base-300', {
      children: [
        el('a', 'group flex items-baseline gap-4 py-4', {
          attrs: { href: '/journal' },
          children: [
            el('span', 'text-2xl font-bold text-primary', { text: rank }),
            el('div', 'flex flex-col gap-1', {
              children: [
                el('span', 'text-sm font-semibold uppercase tracking-wide text-base-content', {
                  text: rubric,
                }),
                el('span', 'text-lg font-semibold leading-snug text-base-content', {
                  text: headline,
                }),
              ],
            }),
          ],
        }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-14', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-6', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Most read',
          }),
          el('ol', 'flex flex-col', {
            children: [
              row('1', 'Artificial intelligence', 'The data-centre boom is rewriting the power grid'),
              row('2', 'Startups', 'The seed round is back, and it looks nothing like 2021'),
              row('3', 'Climate tech', 'The grid-scale battery that finally pencils out'),
              row('4', 'Policy', 'What the new export rules actually cover, line by line'),
              row('5', 'Hardware', 'Inside the fab racing to make chips a continent closer'),
            ],
          }),
        ],
      }),
    ],
  });
}

/** Upcoming events — Frequency's briefings and conferences. Dated, each with the where. */
function eventsBand(): Node {
  const event = (day: string, month: string, title: string, detail: string, place: string): Node =>
    el('li', 'flex flex-col gap-4 border-t border-base-300 py-6 @2xl:flex-row @2xl:gap-8', {
      children: [
        el('div', 'flex items-baseline gap-2 @2xl:w-24 @2xl:flex-col @2xl:items-start @2xl:gap-0', {
          children: [
            el('span', 'text-3xl font-bold leading-none text-primary', { text: day }),
            el('span', 'text-base font-semibold text-base-content', { text: month }),
          ],
        }),
        el('div', 'flex flex-col gap-2', {
          children: [
            el('h3', 'text-xl font-semibold text-base-content', { text: title }),
            el('p', 'text-base leading-relaxed text-base-content', { text: detail }),
            el('p', 'text-sm text-base-content', { text: place }),
            el('a', 'text-base font-semibold text-primary', {
              attrs: { href: '/journal' },
              text: 'Register →',
            }),
          ],
        }),
      ],
    });
  return el('section', 'bg-base-100 @container px-6 py-14', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-6', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Frequency events',
          }),
          el('ul', 'flex flex-col', {
            children: [
              event(
                '18',
                'Sep',
                'The AI Infrastructure Briefing',
                'A morning with the people building the racks, the grids and the models — on the record, off the hype.',
                'San Francisco · 9am PT',
              ),
              event(
                '02',
                'Oct',
                'Climate Tech Live',
                'The founders and funders moving real megawatts, in one room for a day.',
                'Berlin · 10am CET',
              ),
              event(
                '20',
                'Oct',
                'Policy Roundtable: the new export regime',
                'A closed-door session for members, with the analysts who read the rules first.',
                'Members only · online',
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  leadBand(),
  headingBand('The latest', 'Reporting from the Frequency desk, newest first.'),
  blogPostGrid(),
  mostRead(),
  // The content→commerce bridge: the publication's own store, as a live carousel.
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'From the Frequency Store' }),
  eventsBand(),
];

// ── The bespoke article page (the content template's signature surface) ───────────
// A dense news article: the section rubric over the headline, a real byline (author +
// date), the featured image, the written body, and an author card at the foot. Every
// bound field resolves against the routed post (the `article.ts` kit's `repeat('blog_post')`
// scope); the byline lights up from the storefront's projection (`projectByline`) — a post
// with no author simply renders no byline, never a blank line.

/** The article MASTHEAD — authored UNSCOPED; `articlePage` wraps it in `repeat('blog_post')`. */
function articleMasthead(): Node {
  return el('section', 'bg-base-200 @container px-6 pt-12 pb-14 @2xl:pt-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
        children: [
          el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
            attrs: { href: '/journal' },
            children: [el('span', undefined, { text: '←' }), el('span', undefined, { text: 'All stories' })],
          }),
          // The section rubric — the editorial eyebrow, bound to the post's category.
          articleRubric('text-sm font-semibold uppercase tracking-wide text-primary'),
          articleTitle(
            'h1',
            'text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-5xl',
          ),
          articleStandfirst('max-w-2xl text-xl leading-relaxed text-base-content'),
          // The byline row — author portrait, name, and date.
          el('div', 'mt-2 flex items-center gap-3', {
            children: [
              articleAuthorAvatar('h-11 w-11 rounded-full border border-base-300 object-cover'),
              el('div', 'flex flex-col', {
                children: [
                  articleAuthorName('text-base font-semibold text-base-content'),
                  articleDate('text-sm text-base-content'),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The featured image band, at the article measure. */
function articleImageBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-10', {
    children: [
      el('div', 'mx-auto w-full max-w-3xl', {
        children: [
          articleFeaturedImage('aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover'),
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
  el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el('h1', 'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-6xl', {
            text: 'The Frequency',
          }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Technology, business, and the people building what is next — reported plainly, without the hype cycle.',
          }),
        ],
      }),
    ],
  }),
];

// ── About + Contact (Frequency-voiced) ────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'About Frequency',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Frequency is an independent newsroom covering technology and the business of building it. We report on the companies, the money and the policy that decide what gets made — for the people who have to make decisions about it on Monday morning.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We take no money from the companies we cover. Our reporting is paid for by readers and members, which is the only arrangement that lets us tell you when the thing everyone is excited about does not actually work.',
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
            text: 'Reach the desk',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'A tip, a correction, or a story we should be chasing? We read everything, and we protect our sources. Encrypted contact details are on every reporter’s page.',
          }),
          el('a', 'btn btn-primary btn-lg', {
            attrs: { href: 'mailto:desk@frequency.example' },
            text: 'Email the newsroom',
          }),
        ],
      }),
    ],
  }),
];

// ── Light commerce (the Frequency Store — reports, a book, membership, merch) ──────

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
    handle: 'ai-infrastructure-report',
    title: 'The State of AI Infrastructure 2026',
    description:
      'Our flagship annual report: who is building the data centres, what they cost, and where the power is coming from. 120 pages, fully sourced, with the underlying dataset.',
    status: 'active',
    productType: 'Report',
    vendor: 'Frequency',
    tags: ['report', 'ai', 'infrastructure'],
    categoryHandles: ['reports'],
    collectionHandles: ['featured'],
    seoTitle: 'The State of AI Infrastructure 2026 — Frequency report',
    seoDescription: 'A fully-sourced annual report on AI data centres, cost and power, with the dataset.',
    variants: [{ sku: 'FRQ-REP-AI26', priceCents: money(149), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'report-cover', isPrimary: true, alt: 'The State of AI Infrastructure 2026 report' }],
  },
  {
    handle: 'the-signal-book',
    title: 'The Signal — a field guide to hype',
    description:
      'A short, sharp book from the Frequency desk on how to tell a real technology shift from a funding-round press release. The reporting behind five years of the newsletter.',
    status: 'active',
    productType: 'Book',
    vendor: 'Frequency',
    tags: ['book'],
    categoryHandles: ['books'],
    collectionHandles: ['featured'],
    seoTitle: 'The Signal — a field guide to hype | Frequency',
    seoDescription: 'A short book on telling a real technology shift from a press release.',
    variants: [{ sku: 'FRQ-BOOK-SIGNAL', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'book-cover', isPrimary: true, alt: 'The Signal, a hardback book' }],
  },
  {
    handle: 'frequency-membership',
    title: 'Frequency Membership — annual',
    description:
      'The whole archive, every report, the members-only briefings, and the Saturday long read. The subscription that pays for the reporting and keeps it free of the companies we cover.',
    status: 'active',
    productType: 'Membership',
    vendor: 'Frequency',
    tags: ['membership', 'subscription'],
    categoryHandles: ['membership'],
    collectionHandles: ['featured'],
    seoTitle: 'Frequency Membership — annual subscription',
    seoDescription: 'Annual membership: the full archive, every report, members-only briefings.',
    variants: [{ sku: 'FRQ-MEM-ANNUAL', priceCents: money(120), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'membership', isPrimary: true, alt: 'A reader at a laptop' }],
  },
  {
    handle: 'frequency-tote',
    title: 'Frequency Tote',
    description:
      'A heavyweight canvas tote with the masthead printed small on the side. Carries a laptop, a notebook, and roughly a week of unread reports.',
    status: 'active',
    productType: 'Merch',
    vendor: 'Frequency',
    tags: ['merch', 'tote'],
    categoryHandles: ['merch'],
    collectionHandles: [],
    seoTitle: 'Frequency Tote — heavyweight canvas tote',
    seoDescription: 'A heavyweight canvas tote with the Frequency masthead.',
    variants: [{ sku: 'FRQ-TOTE', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'tote-bag', isPrimary: true, alt: 'The Frequency canvas tote' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'reports', name: 'Reports', description: 'Deep, sourced research.', featured: true },
    { handle: 'books', name: 'Books', description: 'From the Frequency desk.', featured: true },
    { handle: 'membership', name: 'Membership', description: 'Support the reporting.', featured: true },
    { handle: 'merch', name: 'Merch', description: 'Carry the masthead.', featured: false },
  ],
  collections: [
    {
      handle: 'featured',
      name: 'Featured',
      description: 'What the desk is pointing at this week.',
      type: 'manual',
      featured: true,
      productHandles: ['ai-infrastructure-report', 'the-signal-book', 'frequency-membership'],
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
    slug: 'dana-ruiz',
    displayName: 'Dana Ruiz',
    bio: 'Dana Ruiz covers artificial intelligence and the infrastructure it runs on, from the chips to the power grid. She has been reporting on the technology industry for twelve years.',
    avatarAssetId: 'author-ruiz',
  },
  {
    slug: 'marcus-bell',
    displayName: 'Marcus Bell',
    bio: 'Marcus Bell writes about startups and the money behind them — who is raising, who is spending, and what the terms actually mean for the people building the companies.',
    avatarAssetId: 'author-bell',
  },
  {
    slug: 'priya-anand',
    displayName: 'Priya Anand',
    bio: 'Priya Anand reports on technology policy and hardware, reading the rules and the supply chains so you do not have to. She was previously a semiconductor analyst.',
    avatarAssetId: 'author-anand',
  },
];

// ── Content (the Frequency reporting) ─────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'data-centre-boom-power-grid',
    status: 'published',
    authorSlug: 'dana-ruiz',
    categories: ['Artificial intelligence'],
    tags: ['Data centres', 'Energy'],
    body: {
      title: 'The data-centre boom is quietly rewriting the power grid',
      excerpt:
        'Training the next generation of models needs more electricity than most cities. We followed the contracts, and found utilities planning a decade of build-out around a handful of customers.',
      featuredImage: { $asset: 'lead-story' },
      body: {
        type: 'doc',
        content: [
          para('A single large training cluster can draw as much power as a small city, around the clock, for years. Utilities are not used to a customer like that — one that arrives all at once, never sleeps, and signs a twenty-year contract before the concrete is poured.'),
          h2('The load is real, and it is lumpy'),
          para('We reviewed interconnection filings in six states. The pattern is the same everywhere: a cluster of enormous new requests, all from a short list of names, all pushing planners to build generation and transmission a decade ahead of where the models said demand would be.'),
          h2('Who pays for the build-out'),
          para('That is the fight now playing out in rate cases most people will never read. If a utility builds a power plant to serve one data centre and that data centre leaves, the cost does not vanish — it lands on everyone else’s bill. Regulators are only beginning to write the rules that decide who carries that risk.'),
          para('The compute story has always been told as a chip story. It is turning out to be a power story, and the grid is where the next few years actually get decided.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'seed-round-is-back',
    status: 'published',
    authorSlug: 'marcus-bell',
    categories: ['Startups'],
    tags: ['Venture capital'],
    body: {
      title: 'The seed round is back, and it looks nothing like 2021',
      excerpt:
        'Early-stage money is flowing again — but the terms, the check sizes and the expectations have all quietly reset. A look at what a first round costs a founder now.',
      featuredImage: { $asset: 'story-office' },
      body: {
        type: 'doc',
        content: [
          para('Ask a founder raising today and a founder who raised three years ago to describe a seed round, and you will hear two different products sharing a name.'),
          h2('Smaller, slower, and with more asked of it'),
          para('The rounds are getting done, but investors want more traction for the same money and take longer to decide. The party round of a dozen small checks closing in a week is mostly gone; in its place is a lead who wants a board seat and a plan to a real milestone.'),
          h2('What has not changed'),
          para('The best companies still raise on their own terms, and the very earliest bets are still made on people more than numbers. What reset was the middle — the ordinary round for the ordinary good company, which is where most of the market actually lives.'),
          para('If you are raising now, price it to the company you can honestly become in eighteen months, not the one the last cycle would have funded.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'export-rules-line-by-line',
    status: 'published',
    authorSlug: 'priya-anand',
    categories: ['Policy'],
    tags: ['Regulation', 'Chips'],
    body: {
      title: 'What the new export rules actually cover, line by line',
      excerpt:
        'The headlines said “chip ban”. The text says something more specific — and more consequential. We read the rule so you do not have to.',
      featuredImage: { $asset: 'story-policy' },
      body: {
        type: 'doc',
        content: [
          para('Export controls are written in a language designed to be precise and read as if it were designed to be impenetrable. The new rule is neither as broad nor as narrow as the coverage suggested.'),
          h2('It is about performance, not names'),
          para('The rule does not ban a product; it draws a line at a level of capability and controls anything above it. That is deliberate — a threshold survives the next generation of hardware in a way a model number never could.'),
          h2('The parts that will bite'),
          para('The provisions that matter most are not the chips themselves but the tooling and the service contracts around them. Control the ability to maintain a fab, and you control the fab, whoever technically owns it.'),
          para('The politics will move on by next week. The rule will still be there, shaping what gets built where, for years.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'grid-scale-battery-pencils-out',
    status: 'published',
    authorSlug: 'dana-ruiz',
    categories: ['Climate tech'],
    tags: ['Energy', 'Batteries'],
    body: {
      title: 'The grid-scale battery that finally pencils out',
      excerpt:
        'For a decade, long-duration storage was the technology that was always five years away. A quiet cost curve just moved it into the money.',
      featuredImage: { $asset: 'story-climate' },
      body: {
        type: 'doc',
        content: [
          para('The problem with renewable power was never making it. It was keeping it — holding a sunny afternoon’s output until a still, dark evening. The technology to do that cheaply is the whole game, and it just got a lot closer.'),
          h2('Cheap chemistry, boring engineering'),
          para('The breakthrough is not exotic. It is an unglamorous chemistry that trades energy density for cost, packaged in a way that a utility can actually finance. The magic is in the spreadsheet, not the lab.'),
          h2('Why it matters now'),
          para('Once storage is cheap enough to hold a full day, the argument for keeping a gas plant running “just in case” gets much harder to make. That is when a cost curve stops being a chart and starts being a policy.'),
          para('Watch the procurement announcements over the next year. That is where you will see whether the spreadsheet was right.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'inside-the-fab-race',
    status: 'published',
    authorSlug: 'priya-anand',
    categories: ['Hardware'],
    tags: ['Chips', 'Manufacturing'],
    body: {
      title: 'Inside the fab racing to make chips a continent closer',
      excerpt:
        'A new leading-edge fab is rising far from the places that usually build them. We spent two days inside to see whether the economics can possibly work.',
      featuredImage: { $asset: 'story-chips' },
      body: {
        type: 'doc',
        content: [
          para('A modern fab is one of the most complex objects humans build, and almost all of them sit in a handful of places. The bet here is that supply-chain risk has finally made “almost all” a liability worth billions to fix.'),
          h2('The hard part is not the machines'),
          para('You can buy the lithography tools; everyone buys them from the same supplier. The scarce thing is the thousands of people who know how to run them, and the ecosystem of suppliers that grows up around a fab over decades. That cannot be air-freighted in.'),
          h2('The subsidy question'),
          para('None of this pencils out without public money, and everyone involved knows it. The honest debate is not whether to subsidise but what the public buys for the cheque — resilience, jobs, or simply the option of not depending on one strait on the map.'),
          para('The building will open on schedule. Whether it becomes a real cluster or an expensive island is a ten-year question.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'news-feed',
  key: 'sparx-news-feed',
  name: 'sparx — News Feed',
  summary:
    'A dense front-page feed for a technology & business publication — a full-width lead over a rail of the day’s stories, a live journal, and a bespoke bylined article page, in a white-ground one-accent theme. Modelled on the tech-newsroom archetype; shipped as Frequency. Ships a light store (reports, a book, membership) to demonstrate content + commerce together.',
  tagline: 'A high-signal news-feed template for a publication that reports and sells.',
  vertical: 'content',
  industry: 'Technology & business news',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 100,
  brand: {
    businessName: 'Frequency',
    tagline: 'The signal in the noise.',
  },
  // A brand-left header with a filled CTA (Subscribe), and the newsletter footer whose
  // bottom bar carries the live © business name.
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Frequency — technology & business news, without the hype',
      description:
        'Frequency is an independent newsroom covering technology and the business of building it — the companies, the money and the policy that decide what gets made.',
    },
    about: {
      title: 'About Frequency — an independent tech newsroom',
      description:
        'Who Frequency is and how it is paid for — reader- and member-funded reporting that takes no money from the companies it covers.',
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
