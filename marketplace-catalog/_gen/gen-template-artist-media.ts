// sparx-artist-media — the media-forward CONTENT site template
// (docs/templates/content/sony-music). The atmospheric, stage-dark counterpart to the
// news-feed set: where a publisher optimises for scan-speed, a recording-artist/band site
// optimises for MOOD and MOMENTUM — feel the record, find the show, press play. A big
// artist hero, a latest-release feature, a tour-dates run, a bound journal feed, and a
// light music+merch store, dressed in the bespoke `amp` theme (a near-black concert ground
// with a vivid magenta primary + cyan accent — the two-light gel look).
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the bespoke article page's DATA plumbing lives in the shared
// `template-sites/article.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-artist-media.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-artist-media/**" \
//     "marketplace-catalog/_gen/gen-template-artist-media.ts"
//
// A CONTENT template still ships the full 9-page superset (the module-independent rule:
// author complete, the installer writes the tenant's enabled slices) — so it carries a
// LIGHT commerce slice (vinyl, a tee, a hoodie, a digital album) that doubles as the
// content+commerce demo. The bespoke effort goes where an artist lives: the home hero, the
// release feature, the tour list, and the article page.
//
// DARK THEME, SEMANTIC TOKENS ONLY. `amp` grounds are near-black (`bg-base-100`), ink is
// off-white (`text-base-content`), and the accent is a vivid magenta (`text-primary`). No
// hardcoded colours — every surface separates by a `bg-base-200` shift + a border, never a
// gradient or a shadow; text over a photo always sits in a SOLID `bg-base-100` panel.
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
// Royalty-free Unsplash photographs — concert, stage and studio frames that carry the
// stage-dark mood. Each is registered in `assets` with alt text.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
  hero: '1470229722913-7c0e2dbbafd3', // singer silhouetted in stage red
  release: '1483412033650-1015ddeb83d1', // vinyl records fanned out
  postStudio: '1598488035139-bdbb2231ce04', // a studio mixing desk
  postSingle: '1501386761578-eac5c94b800a', // a crowd lit from the stage
  postTour: '1493225457124-a3eb161ffa5f', // a festival crowd at dusk
  postBehind: '1459749411175-04bf5292ceea', // a band mid-performance
  postCollab: '1471478331149-c72f17e33c73', // a microphone under stage light
  authorVela: '1516280440614-37939bbacd81', // a musician portrait
  authorMara: '1524504388940-b1c1722653e1', // a portrait, low light
  authorTheo: '1500648767791-00dcc994a43e', // a portrait, plain ground
  prodVinyl: '1603048588665-791ca8aea617', // a vinyl LP on a turntable
  prodTee: '1521572163474-6864f9cf17ab', // a folded black tee
  prodHoodie: '1556821840-3a63f95609a7', // a hoodie on a plain ground
  prodDigital: '1514525253161-7a46d19cd819', // neon-lit abstract for a digital drop
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'hero', url: U(IMG.hero), alt: 'A singer silhouetted against deep red stage light' },
  { id: 'release-cover', url: U(IMG.release), alt: 'A run of vinyl records fanned across a table' },
  { id: 'post-studio', url: U(IMG.postStudio), alt: 'A studio mixing desk lit low' },
  { id: 'post-single', url: U(IMG.postSingle), alt: 'A crowd lit from the stage' },
  { id: 'post-tour', url: U(IMG.postTour), alt: 'A festival crowd at dusk' },
  { id: 'post-behind', url: U(IMG.postBehind), alt: 'A band mid-performance on a dark stage' },
  { id: 'post-collab', url: U(IMG.postCollab), alt: 'A microphone under a single stage light' },
  { id: 'author-vela', url: U(IMG.authorVela), alt: 'The band Vela, portrait' },
  { id: 'author-mara', url: U(IMG.authorMara), alt: 'Portrait of Mara Lindqvist' },
  { id: 'author-theo', url: U(IMG.authorTheo), alt: 'Portrait of Theo Vance' },
  { id: 'prod-vinyl', url: U(IMG.prodVinyl), alt: 'The Small Hours vinyl LP on a turntable' },
  { id: 'prod-tee', url: U(IMG.prodTee), alt: 'The Nightshift tour tee, folded' },
  { id: 'prod-hoodie', url: U(IMG.prodHoodie), alt: 'The Vela logo hoodie' },
  { id: 'prod-digital', url: U(IMG.prodDigital), alt: 'Neon-lit key art for the digital album' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-artist-media: unknown asset "${id}"`);
  return a.url;
};

// ── Home page bands ────────────────────────────────────────────────────────────────

/** The big artist HERO — a full-width key-art frame with the artist name set in a SOLID
 *  panel over the photo (never ink directly on the image; on this dark stage theme a bare
 *  overlay would vanish into the picture). The panel is a `bg-base-100` box with a border,
 *  bottom-anchored over the frame — poster identity, legible by construction. */
function heroBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-14', {
    children: [
      el('div', 'mx-auto w-full max-w-6xl', {
        children: [
          el('div', 'relative overflow-hidden rounded-box border border-base-300', {
            children: [
              el('img', 'aspect-video w-full object-cover', {
                attrs: {
                  src: assetUrl('hero'),
                  alt: 'A singer silhouetted against deep red stage light',
                  loading: 'lazy',
                },
              }),
              // The solid panel over the photo — bottom-left, capped to a readable measure.
              el('div', 'absolute inset-x-0 bottom-0 flex justify-start p-4 @2xl:p-8', {
                children: [
                  el(
                    'div',
                    'flex max-w-xl flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-6 @2xl:p-8',
                    {
                      children: [
                        // Editorial rubric above the name — allowed here (tenant design freedom).
                        el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                          text: 'New album — out now',
                        }),
                        el(
                          'h1',
                          'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl',
                          { text: 'Vela' },
                        ),
                        el('p', 'text-lg leading-relaxed text-base-content', {
                          text: 'Music, tour, and everything in between. Songs for the small hours — the new record, Small Hours, is out everywhere tonight.',
                        }),
                        el('div', 'flex flex-wrap gap-3', {
                          children: [
                            el('a', 'btn btn-primary btn-lg', {
                              attrs: { href: '/journal' },
                              text: 'Listen now',
                            }),
                            el('a', 'btn btn-outline btn-lg', {
                              attrs: { href: '#tour' },
                              text: 'Tour dates',
                            }),
                          ],
                        }),
                      ],
                    },
                  ),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A streaming chip — a "Listen on …" link, the artist-site analogue of a buy-box action.
 *  Genericised targets (no trademarked service names), styled as a bordered pill. */
function streamChip(label: string): Node {
  return el(
    'a',
    'inline-flex items-center gap-2 rounded-field border border-base-300 px-4 py-2 text-base font-semibold text-base-content hover:border-primary',
    { attrs: { href: '/journal' }, text: label },
  );
}

/** The LATEST-RELEASE feature — big cover art beside the record's title, a short note, the
 *  streaming-links row (the buy-box), and a primary Listen/Pre-save action. The band's
 *  current drop, pushed hard. Sits on the alternate surface so it reads apart from the hero. */
function latestReleaseBand(): Node {
  return el('section', 'bg-base-200 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Latest release',
          }),
          el('div', 'grid gap-8 @3xl:grid-cols-2 @3xl:items-center', {
            children: [
              el('img', 'aspect-square w-full rounded-box border border-base-300 object-cover', {
                attrs: {
                  src: assetUrl('release-cover'),
                  alt: 'The Small Hours vinyl LP cover',
                  loading: 'lazy',
                },
              }),
              el('div', 'flex flex-col gap-5', {
                children: [
                  el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                    text: 'Album · 6 August',
                  }),
                  el('h3', 'text-4xl font-bold leading-none tracking-tight text-base-content', {
                    text: 'Small Hours',
                  }),
                  el('p', 'text-lg leading-relaxed text-base-content', {
                    text: 'Ten songs written between two in the morning and first light. Recorded live to tape over a winter in a room with the heating off, mixed loud, and meant to be played that way.',
                  }),
                  el('div', 'flex flex-wrap gap-3', {
                    children: [
                      streamChip('Streaming'),
                      streamChip('Download'),
                      streamChip('Vinyl'),
                      streamChip('Video'),
                    ],
                  }),
                  el('div', 'flex flex-wrap gap-3', {
                    children: [
                      el('a', 'btn btn-primary btn-lg', {
                        attrs: { href: '/journal' },
                        text: 'Listen to Small Hours',
                      }),
                    ],
                  }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The TOUR-DATES band — the artist-site conversion list: a stacked run of shows, each a
 *  date block + venue + city + a status action. Adapts the news-feed `eventsBand` (date
 *  block + venue + a link) to a run of gigs. The section carries `id="tour"` so the hero's
 *  "Tour dates" button lands here. Each row title is an `h3` under this band's `h2`. */
function tourDatesBand(): Node {
  const show = (
    day: string,
    month: string,
    venue: string,
    city: string,
    status: 'tickets' | 'soldout' | 'notify',
  ): Node => {
    const action =
      status === 'soldout'
        ? el('span', 'text-base font-semibold text-base-content', { text: 'Sold out' })
        : status === 'notify'
          ? el('a', 'text-base font-semibold text-secondary', {
              attrs: { href: '/journal' },
              text: 'Notify me →',
            })
          : el('a', 'text-base font-semibold text-primary', {
              attrs: { href: '/journal' },
              text: 'Tickets →',
            });
    return el(
      'li',
      'flex flex-col gap-4 border-t border-base-300 py-6 @2xl:flex-row @2xl:items-center @2xl:gap-8',
      {
        children: [
          el('div', 'flex items-baseline gap-2 @2xl:w-24 @2xl:flex-col @2xl:items-start @2xl:gap-0', {
            children: [
              el('span', 'text-3xl font-bold leading-none text-primary', { text: day }),
              el('span', 'text-base font-semibold uppercase tracking-wide text-base-content', {
                text: month,
              }),
            ],
          }),
          el('div', 'flex flex-col gap-1 @2xl:flex-1', {
            children: [
              el('h3', 'text-xl font-semibold text-base-content', { text: venue }),
              el('p', 'text-base text-base-content', { text: city }),
            ],
          }),
          el('div', 'flex @2xl:justify-end', { children: [action] }),
        ],
      },
    );
  };
  return el('section', 'bg-base-100 @container px-6 py-16', {
    attrs: { id: 'tour' },
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-6', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'On tour',
          }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'The Small Hours tour — a room, a record, and a very late night. Dates below; more added as we route them.',
          }),
          el('ul', 'flex flex-col', {
            children: [
              show('12', 'Sep', 'The Lantern', 'Bristol, UK', 'tickets'),
              show('15', 'Sep', 'Village Underground', 'London, UK', 'soldout'),
              show('19', 'Sep', 'Botanique', 'Brussels, BE', 'tickets'),
              show('23', 'Sep', 'Lido', 'Berlin, DE', 'tickets'),
              show('28', 'Sep', 'Paradiso', 'Amsterdam, NL', 'soldout'),
              show('04', 'Oct', 'La Maroquinerie', 'Paris, FR', 'notify'),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A plain heading band over the bound journal feed. */
function headingBand(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-2', {
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

const HOME: Node[] = [
  heroBand(),
  latestReleaseBand(),
  tourDatesBand(),
  headingBand('From the band', 'Studio notes, single announcements and tour diary — newest first.'),
  blogPostGrid(),
  // The content→commerce bridge: the merch table, as a live carousel.
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Music & Merch' }),
];

// ── The bespoke article page (a news/release writeup) ─────────────────────────────
// A media-header article: the section rubric over the headline, a real byline (author +
// date), the featured image, the written body, and an author card at the foot. Every bound
// field resolves against the routed post (the `article.ts` kit's `repeat('blog_post')`
// scope); the byline lights up from the storefront's projection — a post with no author
// simply renders no byline.

/** The article MASTHEAD — authored UNSCOPED; `articlePage` wraps it in `repeat('blog_post')`. */
function articleMasthead(): Node {
  return el('section', 'bg-base-200 @container px-6 pt-12 pb-14 @2xl:pt-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
        children: [
          el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
            attrs: { href: '/journal' },
            children: [
              el('span', undefined, { text: '←' }),
              el('span', undefined, { text: 'All posts' }),
            ],
          }),
          // The section rubric — the editorial eyebrow, bound to the post's category.
          articleRubric('text-sm font-semibold uppercase tracking-wide text-primary'),
          articleTitle(
            'h1',
            'text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-6xl',
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
          articleFeaturedImage(
            'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover',
          ),
        ],
      }),
    ],
  });
}

/** The author card at the foot — portrait, name, bio. Gated on the author bio. */
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
          el(
            'h1',
            'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl',
            { text: 'The Vela journal' },
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Studio notes, single releases and postcards from the road — written by the band, published as it happens.',
          }),
        ],
      }),
    ],
  }),
];

// ── About + Contact (Vela-voiced) ─────────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', {
            text: 'About Vela',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Vela is a four-piece who write songs for the small hours — the ones you play on the drive home when the city has gone quiet. Formed in a shared flat over a winter of power cuts, the band built its sound the way it builds everything: live, in one room, with the lights low.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Three records in, they still self-produce, still tour in a van they own, and still answer the fan mail themselves. Small Hours, the new album, was cut to tape in the same flat where the first demos were made — a full circle nobody planned and everybody noticed.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'This site is where the band puts everything first — the releases, the dates, the notes from the studio floor, and the merch that keeps the van on the road. No label between you and them.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', {
            text: 'Get in touch',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Booking, press, sync licensing, or a note about a show — everything reaches the band. We read all of it, and we answer what we can.',
          }),
          el('a', 'btn btn-primary btn-lg', {
            attrs: { href: 'mailto:hello@vela.example' },
            text: 'Email the band',
          }),
        ],
      }),
    ],
  }),
];

// ── Light commerce (the merch table — vinyl, a tee, a hoodie, a digital album) ─────

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
    handle: 'small-hours-vinyl',
    title: 'Small Hours — Vinyl LP',
    description:
      'The new album on heavyweight 180g black vinyl, cut loud from the tape masters, in a gatefold sleeve with the lyrics and a photo insert from the sessions. Includes a download of the full record.',
    status: 'active',
    productType: 'Vinyl',
    vendor: 'Vela',
    tags: ['music', 'vinyl', 'album'],
    categoryHandles: ['music'],
    collectionHandles: ['featured'],
    seoTitle: 'Small Hours — Vinyl LP | Vela',
    seoDescription: 'The new Vela album on heavyweight 180g vinyl, gatefold sleeve, with a download.',
    variants: [
      { sku: 'VELA-LP-SMALLHOURS', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'prod-vinyl', isPrimary: true, alt: 'The Small Hours vinyl LP' }],
  },
  {
    handle: 'small-hours-digital',
    title: 'Small Hours — Digital Album',
    description:
      'The full record as a lossless download the moment you buy it — ten tracks, plus two b-sides that did not fit the vinyl. Yours to keep, no subscription, no expiry.',
    status: 'active',
    productType: 'Digital',
    vendor: 'Vela',
    tags: ['music', 'download', 'album'],
    categoryHandles: ['music'],
    collectionHandles: ['featured'],
    seoTitle: 'Small Hours — Digital Album | Vela',
    seoDescription: 'The new Vela album as a lossless download, ten tracks plus two b-sides.',
    variants: [
      { sku: 'VELA-DL-SMALLHOURS', priceCents: money(11), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'prod-digital', isPrimary: true, alt: 'Small Hours digital album key art' }],
  },
  {
    handle: 'nightshift-tour-tee',
    title: 'Nightshift Tour Tee',
    description:
      'The Small Hours tour shirt — heavyweight black cotton with the routing printed small on the back and the band mark on the chest. Screen-printed in small runs; when a size is gone, it is gone.',
    status: 'active',
    productType: 'Apparel',
    vendor: 'Vela',
    tags: ['apparel', 'tour', 'merch'],
    categoryHandles: ['apparel'],
    collectionHandles: ['featured'],
    seoTitle: 'Nightshift Tour Tee | Vela',
    seoDescription: 'The Small Hours tour tee — heavyweight black cotton, routing on the back.',
    variants: [
      { sku: 'VELA-TEE-NIGHTSHIFT', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'prod-tee', isPrimary: true, alt: 'The Nightshift tour tee' }],
  },
  {
    handle: 'vela-logo-hoodie',
    title: 'Vela Logo Hoodie',
    description:
      'A heavy brushed-back hoodie in charcoal with the Vela mark embroidered on the chest — the one you steal back off whoever you lend it to. Built to survive a winter of load-ins.',
    status: 'active',
    productType: 'Apparel',
    vendor: 'Vela',
    tags: ['apparel', 'merch'],
    categoryHandles: ['apparel'],
    collectionHandles: [],
    seoTitle: 'Vela Logo Hoodie | Vela',
    seoDescription: 'A heavy brushed-back charcoal hoodie with the embroidered Vela mark.',
    variants: [
      { sku: 'VELA-HOOD-LOGO', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'prod-hoodie', isPrimary: true, alt: 'The Vela logo hoodie' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'music', name: 'Music', description: 'The records — vinyl and download.', featured: true },
    { handle: 'apparel', name: 'Apparel', description: 'Tour shirts and everyday wear.', featured: true },
  ],
  collections: [
    {
      handle: 'featured',
      name: 'Featured',
      description: 'The new record and the tour merch, in one place.',
      type: 'manual',
      featured: true,
      productHandles: ['small-hours-vinyl', 'small-hours-digital', 'nightshift-tour-tee'],
    },
  ],
  products: PRODUCTS,
};

// ── The band voices (byline personas) ─────────────────────────────────────────────
// The band and its management, seeded as CMS `Author` rows scoped to the site so the
// bespoke article page shows a real name, portrait and bio.

const AUTHORS = [
  {
    slug: 'vela',
    displayName: 'Vela',
    bio: 'Vela is a four-piece who write songs for the small hours. Three records deep, self-produced and self-booked, still touring in a van they own.',
    avatarAssetId: 'author-vela',
  },
  {
    slug: 'mara-lindqvist',
    displayName: 'Mara Lindqvist',
    bio: 'Mara sings and writes for Vela. When she is not on stage she is usually the one behind the desk in the studio, or answering the fan mail at two in the morning.',
    avatarAssetId: 'author-mara',
  },
  {
    slug: 'theo-vance',
    displayName: 'Theo Vance',
    bio: 'Theo manages the band, routes the tours and keeps the van running. He writes the announcements so the band can keep writing the songs.',
    avatarAssetId: 'author-theo',
  },
];

// ── Content (the journal — studio notes, releases, tour diary) ────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'small-hours-is-out',
    status: 'published',
    authorSlug: 'vela',
    categories: ['Releases'],
    tags: ['Album', 'Small Hours'],
    body: {
      title: 'Small Hours is out tonight',
      excerpt:
        'Three years, one winter of power cuts, and a room with the heating off. The new record is finally yours.',
      featuredImage: { $asset: 'release-cover' },
      body: {
        type: 'doc',
        content: [
          para('It is done. Small Hours — ten songs we have been living inside since a cold January — is out everywhere from midnight tonight. We are not sure we have ever been this nervous to give something away.'),
          h2('How it was made'),
          para('We cut it live to tape in the flat where the first Vela demos were recorded, four of us in one room with the amps turned down enough not to lose the deposit. Nothing is quantised, nothing is fixed after the fact. The mistakes you can hear are the takes we liked best.'),
          h2('What to play it on'),
          para('It is mixed loud and meant to be played that way — in a car, on headphones on a night bus, or off the vinyl at a volume your neighbours will remember. If you can, get the record. The download is in every copy.'),
          para('Thank you for waiting. Come find us on the road — the dates are up, and we would love to play these for you in a room.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'writing-in-one-room',
    status: 'published',
    authorSlug: 'mara-lindqvist',
    categories: ['Studio'],
    tags: ['Songwriting', 'Recording'],
    body: {
      title: 'Why we still record everything in one room',
      excerpt:
        'Everyone told us to track it properly, in a real studio, one instrument at a time. We tried it once. It sounded like a stranger.',
      featuredImage: { $asset: 'post-studio' },
      body: {
        type: 'doc',
        content: [
          para('There is a version of this band that made a cleaner record. We know, because we spent two weeks in a proper studio making it, and then we quietly threw it away.'),
          h2('The sound is the room'),
          para('When you record together in one space, the bleed between the microphones is the sound. You cannot separate the guitar from the drums, so you stop trying, and what you get instead is four people listening to each other in real time. That listening is the thing I care about most.'),
          h2('What we give up'),
          para('You give up control. You cannot fix one wrong note without losing the whole take, so you keep the wrong notes, and after a while you realise you prefer them. A record with no mistakes is a record with no evidence anyone was there.'),
          para('Small Hours has a door slamming on track six. It was the wind. We left it in.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'nightshift-single',
    status: 'published',
    authorSlug: 'vela',
    categories: ['Releases'],
    tags: ['Single', 'Nightshift'],
    body: {
      title: '“Nightshift” — the first single, and the video',
      excerpt:
        'The song we nearly cut from the record is the one leading it. Here is why it stayed, and where the video came from.',
      featuredImage: { $asset: 'post-single' },
      body: {
        type: 'doc',
        content: [
          para('“Nightshift” almost did not make the album. It was too long, too slow, and it took us a year to work out what it was about. Then one night it clicked, and now it opens the record.'),
          h2('The song'),
          para('It is about the people who are awake when everyone else is asleep — the ones cleaning the offices, driving the last buses, sitting up with someone who is unwell. We wanted a song that kept them company.'),
          h2('The video'),
          para('We shot it in a single take on a night bus with a borrowed camera and no permit, which we do not recommend. The city you see through the windows is exactly the one we drive through going home from a show.'),
          para('It is up now on the streaming links, and on the release page. Play it late.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'tour-diary-bristol',
    status: 'published',
    authorSlug: 'theo-vance',
    categories: ['Tour'],
    tags: ['Tour diary', 'On the road'],
    body: {
      title: 'Tour diary: the first night in Bristol',
      excerpt:
        'A blown fuse, a borrowed amp, and four hundred people who did not know the new songs yet sang them back anyway.',
      featuredImage: { $asset: 'post-tour' },
      body: {
        type: 'doc',
        content: [
          para('First night of the Small Hours tour, and the venue lost power ten minutes before doors. What happened next is the reason any of us still do this.'),
          h2('The blown fuse'),
          para('An old building, a lot of stage lights, and a fuse that had clearly been waiting for us. The house crew found a workaround, a neighbouring bar lent us an amp, and we went on twenty minutes late to a room that had been standing in the dark, patient, the whole time.'),
          h2('The part that got us'),
          para('These are brand new songs — the record was only days old — and by the second chorus of “Nightshift” four hundred people were singing the words back. Nobody had had time to learn them. They just felt where they were going. I watched Mara turn around so the crowd would not see her face.'),
          para('Fifteen more of these to go. If you are coming to one, come early and say hello at the merch table.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'strings-and-a-choir',
    status: 'published',
    authorSlug: 'mara-lindqvist',
    categories: ['Studio'],
    tags: ['Collaboration', 'Behind the scenes'],
    body: {
      title: 'Behind the scenes: the strings and the choir on “Harbour”',
      excerpt:
        'The biggest-sounding song on the quietest record we have made. Here is the room full of people who made it that way.',
      featuredImage: { $asset: 'post-behind' },
      body: {
        type: 'doc',
        content: [
          para('“Harbour” is the one song on Small Hours we could not make in the flat. It needed more people than the room could hold, so for one day we broke our own rule.'),
          h2('The players'),
          para('We brought in a string quartet we have loved for years and a community choir from two streets over — twenty voices who had never heard the song before that morning. We taught them the part by singing it, and recorded the third time through, while it was still new to them.'),
          h2('Keeping it live'),
          para('Even with thirty people in the room, we tracked it live, everyone at once, one take kept. You can hear a chair scrape and someone laugh at the end. We kept that too. The bigness is real people in a real room, not a plug-in.'),
          para('It closes the record. Headphones, lights off, is how we hear it.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'artist-media',
  key: 'sparx-artist-media',
  name: 'sparx — Artist Media',
  summary:
    'A media-forward, stage-dark site for a recording artist or band — a poster-scale artist hero, a latest-release feature with streaming links, a tour-dates run, a live journal, and a bespoke article page, in a near-black theme with a vivid magenta accent. Modelled on the recording-artist archetype; shipped as Vela. Ships a light music + merch store (vinyl, a tee, a hoodie, a digital album) to demonstrate content + commerce together.',
  tagline: 'A stage-dark artist-site template for a band that releases, tours and sells.',
  vertical: 'content',
  industry: 'Recording artist & band',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 100,
  brand: {
    businessName: 'Vela',
    tagline: 'Music, tour, and everything in between.',
  },
  // A centered wordmark over a filled CTA (Listen), and the newsletter footer whose
  // capture up front is the fan signup and whose bottom bar carries the live © business name.
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Vela — new album Small Hours, out now',
      description:
        'Vela — a four-piece writing songs for the small hours. The new record Small Hours is out everywhere, and the tour is on the road. Music, tour, and everything in between.',
    },
    about: {
      title: 'About Vela — the band, the record, the road',
      description:
        'Who Vela is and how they work — a self-produced, self-booked four-piece who record everything live in one room. No label between you and the band.',
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
