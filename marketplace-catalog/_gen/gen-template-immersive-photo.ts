// sparx-immersive-photo — the immersive, photo-led CONTENT site template
// (docs/templates/content/national-geographic). The counterpart to the dense news feed:
// where `news-feed` optimises for scan-speed on a bright ground, THIS optimises for AWE —
// a near-black photographic ground where the image carries all the colour, one bright
// solar-amber frame accent, and type that yields to the picture. It anchors the content
// set as the IMMERSIVE / photo-led archetype every travel publisher, science magazine,
// gallery, or photographer's journal needs.
//
// Ported to sparx: a full-bleed photo-cover home, a photo-forward journal feed, a
// photo-essay picture band with big captions, and a bespoke photo-forward article reader —
// dressed in the bespoke `expanse` theme (a near-black ground + a luminous amber rule,
// Fraunces display over Inter body — the one dark content look in the shelf). Shipped as
// Wayfarer, a travel & photography journal, "the world, in full frame".
//
// CRITICAL to this template (dark + photo-heavy): every word of type that sits over a
// photograph lives in a SOLID `bg-base-100` panel, never directly on the image — the
// reference's caption-on-scrim, translated to a rule the sweep can pass. Colour comes
// from the photographs; the ONE non-photographic colour is the amber `text-primary` rule.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts` (content-theme resolution + the `article` slot), and the
// article DATA plumbing lives in the shared `template-sites/article.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-immersive-photo.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-immersive-photo/**" \
//     "marketplace-catalog/_gen/gen-template-immersive-photo.ts"
//   pnpm --filter @sparx/api-rest marketplace:self-register
//
// A CONTENT template ships the full 9-page superset (author complete; the installer writes
// the tenant's enabled slices) — so it carries a LIGHT commerce slice (fine-art prints +
// field gear + a photobook) that doubles as the content+commerce demo. The bespoke effort
// goes where a publisher lives: the article, and the photography.
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

import { contactSection } from './shared/contact-section';
import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import {
  articleAuthorAvatar,
  articleAuthorCard,
  articleAuthorName,
  articleDate,
  articleFeaturedImage,
  articlePage,
  articleRubric,
  articleStandfirst,
  articleTitle,
} from './template-sites/article';

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Royalty-free Unsplash photographs — art-directed landscape / travel / wildlife frames,
// the entire identity of this template. Each is registered in `assets` with real alt text.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1600&q=80`;

const IMG = {
  // Home + essay imagery
  heroAtacama: '1469474968028-56623f02e42e',
  essayRoad: '1454496522488-7a8e488e8606',
  essayFalls: '1433086966358-54859d0ed716',
  essayForest: '1470071459604-3b5ec3a7fe05',
  // Story lead imagery
  postAtacama: '1501785888041-af3ef285b470',
  postGlacier: '1470770841072-f978cf4d019e',
  postIceCores: '1439066615861-d1af74d74000',
  postMilkyWay: '1451187580459-43490279c0fa',
  postKyushu: '1472214103451-9374bd1c798e',
  // Author portraits
  authorRoss: '1494790108377-be9c29b29330',
  authorMora: '1500648767791-00dcc994a43e',
  authorNadeau: '1573497019940-1c28c88b4f3e',
  // Store imagery
  printAtacama: '1506905925346-21bda4d32df4',
  printGlacier: '1466611653911-95081537e5b7',
  gearBag: '1516035069371-29a1b244cc32',
  bookLatitudes: '1544716278-ca5e3f4abd8c',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'hero-atacama', url: U(IMG.heroAtacama), alt: 'A desert mountain range glowing at first light' },
  { id: 'essay-road', url: U(IMG.essayRoad), alt: 'A switchback road climbing a green mountainside' },
  { id: 'essay-falls', url: U(IMG.essayFalls), alt: 'A waterfall in long exposure over dark rock' },
  { id: 'essay-forest', url: U(IMG.essayForest), alt: 'Fog drifting through a valley of pines' },
  { id: 'post-atacama', url: U(IMG.postAtacama), alt: 'A still lake mirroring a snow-capped range' },
  { id: 'post-glacier', url: U(IMG.postGlacier), alt: 'A cabin beside an alpine lake below snow peaks' },
  { id: 'post-ice-cores', url: U(IMG.postIceCores), alt: 'A lone figure beneath a green aurora' },
  { id: 'post-milky-way', url: U(IMG.postMilkyWay), alt: 'The Milky Way arcing over a dark sky' },
  { id: 'post-kyushu', url: U(IMG.postKyushu), alt: 'Terraced green hills under soft cloud' },
  { id: 'author-ross', url: U(IMG.authorRoss), alt: 'Portrait of Lena Ross' },
  { id: 'author-mora', url: U(IMG.authorMora), alt: 'Portrait of Caleb Mora' },
  { id: 'author-nadeau', url: U(IMG.authorNadeau), alt: 'Portrait of Sofia Nadeau' },
  { id: 'print-atacama', url: U(IMG.printAtacama), alt: 'A fine-art print of a mountain lake at dawn' },
  { id: 'print-glacier', url: U(IMG.printGlacier), alt: 'A fine-art print of a green glacial valley' },
  { id: 'gear-bag', url: U(IMG.gearBag), alt: 'A weatherproof camera field bag' },
  { id: 'book-latitudes', url: U(IMG.bookLatitudes), alt: 'A hardback photobook on a table' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-immersive-photo: unknown asset "${id}"`);
  return a.url;
};

// ── Home page bands (the immersive photo journal) ─────────────────────────────────

/** The front door — a FULL-BLEED photo cover. The image bleeds edge-to-edge and carries
 *  all the colour; the rubric + headline + dek + byline sit in a SOLID `bg-base-100` panel
 *  anchored bottom-left, never directly on the photograph (the reference's caption-on-scrim,
 *  as a rule the sweep passes on a dark template). The section's ONE `<h1>`. */
function heroBand(): Node {
  return el('section', 'relative bg-base-100 @container', {
    children: [
      el('img', 'aspect-video w-full object-cover', {
        attrs: {
          src: assetUrl('hero-atacama'),
          alt: 'A desert mountain range glowing at first light',
          loading: 'eager',
        },
      }),
      el('div', 'absolute inset-0 flex items-end', {
        children: [
          el('div', 'mx-auto flex w-full max-w-6xl px-6 pb-10 @2xl:pb-14', {
            children: [
              el('div', 'flex max-w-xl flex-col gap-4 rounded-box bg-base-100 p-8 @2xl:p-10', {
                children: [
                  el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                    text: 'Travel · Photo story',
                  }),
                  el(
                    'h1',
                    'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                    { text: 'Twelve hours in the Atacama, chasing the last light' },
                  ),
                  el('p', 'text-lg leading-relaxed text-base-content', {
                    text: 'The driest desert on Earth turns to colour for a few minutes at dusk. We drove four hours for those minutes, and stayed for the sky that came after.',
                  }),
                  el('p', 'text-sm text-base-content', { text: 'Photographs by Lena Ross · 12 August' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A plain section heading band, for the label over the bound photo feed. */
function headingBand(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-2', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-3', {
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

/** The photo-essay picture band — the archetype's signature reading unit, previewed on the
 *  home page. A short sequence of full-width "chapters", each a full-bleed image with a big
 *  caption in a SOLID `bg-base-100` panel anchored over the picture's lower edge. Text is
 *  subordinate and narrow; the image is the chapter. */
function photoEssayBand(): Node {
  const chapter = (assetId: string, alt: string, title: string, caption: string): Node =>
    el('div', 'relative overflow-hidden rounded-box border border-base-300', {
      children: [
        el('img', 'aspect-video w-full object-cover', {
          attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
        }),
        el('div', 'absolute inset-0 flex items-end', {
          children: [
            el('div', 'flex w-full p-4 @2xl:p-6', {
              children: [
                el('div', 'flex max-w-md flex-col gap-2 rounded-box bg-base-100 p-6', {
                  children: [
                    el('h3', 'text-2xl font-bold leading-snug tracking-tight text-base-content', {
                      text: title,
                    }),
                    el('p', 'text-base leading-relaxed text-base-content', { text: caption }),
                  ],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                text: 'Photo essay',
              }),
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'The high passes, chapter by chapter',
              }),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'A long scroll through one week above the tree line — the road up, the water on the way down, and the forest that swallowed the last of the light.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-6', {
            children: [
              chapter(
                'essay-road',
                'A switchback road climbing a green mountainside',
                'The road up',
                'Nine hairpins in twenty minutes, each one opening onto the same valley from a little higher, until the farms below turned to a green quilt and the air went thin and clean.',
              ),
              chapter(
                'essay-falls',
                'A waterfall in long exposure over dark rock',
                'Where the snow goes',
                'Everything that fell as snow up here leaves as this — a single white thread over black rock, moving so fast a half-second exposure turns it to smoke.',
              ),
              chapter(
                'essay-forest',
                'Fog drifting through a valley of pines',
                'The last of the light',
                'By six the sun was gone behind the ridge and the fog came up the valley to meet us, and for a few minutes the whole forest was one soft, grey, breathing thing.',
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  heroBand(),
  headingBand('Latest dispatches', 'New writing and photography from the field, newest first.'),
  blogPostGrid(),
  photoEssayBand(),
  // The content→commerce bridge: the journal's own prints + gear, as a live carousel.
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Prints & Field Gear' }),
];

// ── The bespoke article page (a photo-forward reader) ─────────────────────────────
// The content template's signature surface. Where the news template gives the article a
// dense text masthead, this gives it a FULL-BLEED photo cover: the featured image bleeds
// wide and the rubric + title + standfirst + byline sit in a SOLID `bg-base-100` panel over
// its lower edge — the image leads, the type yields. Every bound field resolves against the
// routed post (the `article.ts` kit's `repeat('blog_post')` scope); the byline lights up
// from the storefront's projection.

/** The article COVER — authored UNSCOPED; `articlePage` wraps it in `repeat('blog_post')`.
 *  The featured image full-bleed, with the masthead in a solid panel over its foot. */
function articleCover(): Node {
  return el('section', 'relative bg-base-100 @container', {
    children: [
      articleFeaturedImage('aspect-video w-full object-cover'),
      el('div', 'absolute inset-0 flex items-end', {
        children: [
          el('div', 'mx-auto flex w-full max-w-4xl px-6 pb-10 @2xl:pb-14', {
            children: [
              el('div', 'flex w-full max-w-2xl flex-col gap-4 rounded-box bg-base-100 p-8 @2xl:p-10', {
                children: [
                  el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-primary', {
                    attrs: { href: '/journal' },
                    children: [
                      el('span', undefined, { text: '←' }),
                      el('span', undefined, { text: 'All stories' }),
                    ],
                  }),
                  // The section rubric — the editorial eyebrow, bound to the post's category.
                  articleRubric('text-sm font-semibold uppercase tracking-wide text-primary'),
                  articleTitle(
                    'h1',
                    'text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-5xl',
                  ),
                  articleStandfirst('text-xl leading-relaxed text-base-content'),
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
          }),
        ],
      }),
    ],
  });
}

/** The author card at the foot — portrait, name, bio. Gated on the author bio, so it
 *  appears only when there is genuinely something to say about who made the piece. */
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

const ARTICLE: Node = articlePage(articleCover(), {
  foot: articleFoot(),
  backHref: '/journal',
});

// ── The journal index masthead (over the bound photo feed) ────────────────────────

const JOURNAL: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
            text: 'The Wayfarer Journal',
          }),
          el('h1', 'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-6xl', {
            text: 'Places, seen properly',
          }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Long-scroll photo stories and reported features from the field — travel, nature, the night sky, and the craft of making a picture worth the walk.',
          }),
        ],
      }),
    ],
  }),
];

// ── About + Contact (Wayfarer-voiced) ─────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'About Wayfarer',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Wayfarer is an independent travel and photography journal. We go slowly, on foot where we can, and we come back with pictures and the writing that earns them — the road it took to get there, the hour the light was worth waiting for, and the people we met along the way.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We work with a small circle of photographers and writers, and we sell prints of the work so the next expedition pays for itself. No sponsored trips, no press junkets — just the places, seen properly.',
          }),
        ],
      }),
    ],
  }),
];

const CONTACT: Node[] = [
  // The page's own words, over the shared contact band: the business's phone and email
  // (each hidden until set in Site settings — never an invented number) and a working
  // enquiry form that reaches the tenant's Form submissions inbox. This used to end at a
  // `mailto:` to a placeholder domain, which was the only way to reach the business.
  contactSection({
    heading: 'Send us somewhere',
    intro: 'A place we should photograph, a story we should chase, or a print you want in a size we do not list yet? Tell us. We read every message, and we answer the good ones from wherever we happen to be.',
    submitLabel: 'Email the desk',
  }),
];

// ── Light commerce (prints + field gear + a photobook) ────────────────────────────

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
    handle: 'atacama-at-dawn-print',
    title: 'Atacama at Dawn — fine-art print',
    description:
      'The cover frame, printed the way we would hang it: a museum-grade archival pigment print on cotton rag, the desert mountains going from blue to gold in the first minute of light. Signed and numbered, shipped flat.',
    status: 'active',
    productType: 'Print',
    vendor: 'Wayfarer',
    tags: ['print', 'landscape', 'travel'],
    categoryHandles: ['prints'],
    collectionHandles: ['featured'],
    seoTitle: 'Atacama at Dawn — signed fine-art print | Wayfarer',
    seoDescription: 'A signed, numbered archival pigment print of the Atacama at first light, on cotton rag.',
    variants: [{ sku: 'WYF-PRT-ATACAMA', priceCents: money(180), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'print-atacama', isPrimary: true, alt: 'A fine-art print of a mountain lake at dawn' }],
  },
  {
    handle: 'the-last-glacier-print',
    title: 'The Last Glacier — fine-art print',
    description:
      'From the Rockies photo story: a green glacial valley under a thinning field of ice. An archival pigment print on cotton rag, signed and numbered — a record of a place that will not look this way for long.',
    status: 'active',
    productType: 'Print',
    vendor: 'Wayfarer',
    tags: ['print', 'landscape', 'conservation'],
    categoryHandles: ['prints'],
    collectionHandles: ['featured'],
    seoTitle: 'The Last Glacier — signed fine-art print | Wayfarer',
    seoDescription: 'A signed, numbered archival print of a glacial valley in the Rockies, on cotton rag.',
    variants: [{ sku: 'WYF-PRT-GLACIER', priceCents: money(180), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'print-glacier', isPrimary: true, alt: 'A fine-art print of a green glacial valley' }],
  },
  {
    handle: 'wayfarer-field-bag',
    title: 'Wayfarer Field Bag',
    description:
      'The bag we actually carry: a weatherproof waxed-canvas camera bag that holds a body, three lenses, a flask and a notebook, and takes a tripod on the side. Built with a maker in the mountains it is named for.',
    status: 'active',
    productType: 'Gear',
    vendor: 'Wayfarer',
    tags: ['gear', 'bag', 'field'],
    categoryHandles: ['gear'],
    collectionHandles: ['featured'],
    seoTitle: 'Wayfarer Field Bag — weatherproof camera bag',
    seoDescription: 'A weatherproof waxed-canvas camera field bag: a body, three lenses, and a tripod on the side.',
    variants: [{ sku: 'WYF-BAG-FIELD', priceCents: money(145), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'gear-bag', isPrimary: true, alt: 'A weatherproof camera field bag' }],
  },
  {
    handle: 'latitudes-photobook',
    title: 'Latitudes — a photobook',
    description:
      'Five years of the journal, edited down to one hundred and twenty photographs and the short essays that go with them. A heavyweight linen-bound book, printed and sewn to last longer than the trips it remembers.',
    status: 'active',
    productType: 'Book',
    vendor: 'Wayfarer',
    tags: ['book', 'photobook'],
    categoryHandles: ['books'],
    collectionHandles: [],
    seoTitle: 'Latitudes — a Wayfarer photobook',
    seoDescription: 'A linen-bound photobook: one hundred and twenty photographs from five years of the journal.',
    variants: [{ sku: 'WYF-BOOK-LATITUDES', priceCents: money(65), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'book-latitudes', isPrimary: true, alt: 'A hardback photobook on a table' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'prints', name: 'Prints', description: 'Signed, numbered archival prints.', featured: true },
    { handle: 'gear', name: 'Field gear', description: 'What we actually carry.', featured: true },
    { handle: 'books', name: 'Books', description: 'The work, bound to last.', featured: true },
  ],
  collections: [
    {
      handle: 'featured',
      name: 'Featured',
      description: 'The prints and gear behind this season’s stories.',
      type: 'manual',
      featured: true,
      productHandles: ['atacama-at-dawn-print', 'the-last-glacier-print', 'wayfarer-field-bag'],
    },
  ],
  products: PRODUCTS,
};

// ── The masthead (byline personas) ────────────────────────────────────────────────
// Real photographers + writers the posts reference by `authorSlug`. The installer seeds
// these as CMS `Author` rows scoped to the site, and the storefront byline projection
// resolves them — so the bespoke article cover shows a real name, portrait and bio.

const AUTHORS = [
  {
    slug: 'lena-ross',
    displayName: 'Lena Ross',
    bio: 'Lena Ross is a landscape and travel photographer who works in long light and cold air. She has spent the last decade photographing deserts and high passes across four continents, most often alone and on foot.',
    avatarAssetId: 'author-ross',
  },
  {
    slug: 'caleb-mora',
    displayName: 'Caleb Mora',
    bio: 'Caleb Mora is a wildlife and documentary photographer drawn to the edges — glaciers, tidelines, the last of a thing. He photographs slowly and returns to the same places for years to see what has changed.',
    avatarAssetId: 'author-mora',
  },
  {
    slug: 'sofia-nadeau',
    displayName: 'Sofia Nadeau',
    bio: 'Sofia Nadeau is a science writer and night-sky photographer. She reports on climate, ice and dark skies, and is happiest explaining a hard idea beside a picture that makes you want to understand it.',
    avatarAssetId: 'author-nadeau',
  },
];

// ── Content (the Wayfarer field reporting) ────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'twelve-hours-in-the-atacama',
    status: 'published',
    authorSlug: 'lena-ross',
    categories: ['Travel'],
    tags: ['Expedition', 'Landscape'],
    body: {
      title: 'Twelve hours in the Atacama, chasing the last light',
      excerpt:
        'The driest desert on Earth turns to colour for a few minutes at dusk. We drove four hours for those minutes, and stayed for the sky that came after.',
      featuredImage: { $asset: 'post-atacama' },
      body: {
        type: 'doc',
        content: [
          para('You do not go to the Atacama for the middle of the day. From ten until four it is flat, white, and merciless — a moonscape that a camera flattens further. You go for the two hours at each end, and you plan the whole trip around them.'),
          h2('The drive out'),
          para('It is four hours from the nearest town to the salt flat we wanted, most of it on a road that is a road only by agreement. We left at two to have light to spare, and spent the drive watching the mountains change colour in the mirror as the sun came round behind them.'),
          h2('The minute it all turns'),
          para('For about a minute at dusk the whole range goes from blue to a gold you do not believe until you have stood in it. That minute is the picture on the cover, and it is why the trip existed. Everything before it was logistics; everything after was a gift.'),
          para('Then the sun was gone and the real reason to stay arrived: a sky with no town for a hundred miles to dim it, so thick with stars it took a while to find the constellations under all the ones you never usually see.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'the-last-glaciers-of-the-rockies',
    status: 'published',
    authorSlug: 'caleb-mora',
    categories: ['Nature'],
    tags: ['Conservation', 'Landscape'],
    body: {
      title: 'The last glaciers of the Rockies',
      excerpt:
        'The ice that named these valleys is nearly gone. We walked up to photograph what is left, and to record a shape the map will soon have to change.',
      featuredImage: { $asset: 'post-glacier' },
      body: {
        type: 'doc',
        content: [
          para('A glacier does not disappear all at once. It thins, it retreats up its own valley, it leaves a bathtub ring of bare rock where it used to reach — and then one summer the last of it is just a field of dirty ice too small to move, and the word on the map stops being true.'),
          h2('What the valley remembers'),
          para('You can read the whole retreat from the valley floor. The trees stop at the line the ice held a century ago; the rock above it is still raw. Between the two is the story of a warming told in stripes, and it is faster than the stripes suggest.'),
          h2('Why photograph it'),
          para('There is an argument that photographing a vanishing thing beautifully lets people mourn it instead of fighting for it. I take the other side: you protect what you have looked at properly, and most people will never stand here. So we bring it back, at the size it deserves, while it is still a glacier and not a memory.'),
          para('We will walk up again next year, from the same spot, and photograph what the summer left. That is the whole method — return, compare, and refuse to look away.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'what-the-ice-cores-remember',
    status: 'published',
    authorSlug: 'sofia-nadeau',
    categories: ['Science'],
    tags: ['Conservation', 'Night sky'],
    body: {
      title: 'What the ice cores remember',
      excerpt:
        'A cylinder of ice pulled from two miles down holds a diary of the air going back eight hundred thousand years. We visited the lab that reads it.',
      featuredImage: { $asset: 'post-ice-cores' },
      body: {
        type: 'doc',
        content: [
          para('When snow falls on an ice sheet it never fully melts; it packs down under the snow of the next year, and the next, trapping a little bubble of the air it fell through. Drill down far enough and you are pulling up a straw of frozen time, one year to a layer, with the atmosphere sealed inside.'),
          h2('Reading a bubble of old air'),
          para('In a cold room kept at twenty below, technicians cut a core into sections and crush them under vacuum to let the ancient air out, then measure what was in it. Carbon dioxide, methane, the isotopes that stand in for temperature — a full weather report from a year before there were people to file one.'),
          h2('Why it matters now'),
          para('The record is what lets anyone say today’s numbers are unusual. For eight hundred thousand years the carbon dioxide stayed inside a band; in the last two centuries it left the band entirely. The ice does not argue; it simply remembers, and the remembering is the evidence.'),
          para('The cores are photographed under polarised light before they are destroyed to be read — which is how a chart of the deep past also turns out to be quietly, strangely beautiful.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'shooting-the-milky-way-frame-by-frame',
    status: 'published',
    authorSlug: 'sofia-nadeau',
    categories: ['Photography'],
    tags: ['Night sky', 'Craft'],
    body: {
      title: 'Shooting the Milky Way, frame by frame',
      excerpt:
        'A clear, dark sky and a bit of patience will get you a photograph of the galaxy you live in. Here is the craft, without the mystique.',
      featuredImage: { $asset: 'post-milky-way' },
      body: {
        type: 'doc',
        content: [
          para('People assume astrophotography needs a telescope and a mountain. The core of it needs neither — a camera that shoots raw, the widest fast lens you own, a tripod, and a sky far enough from a town that you can see the band of the Milky Way with your own eyes. Everything else is technique.'),
          h2('The exposure, plainly'),
          para('Open the lens as wide as it goes, push the sensitivity up until the sky is bright but not grainy, and hold the shutter open just long enough that the stars stay points and do not smear into little arcs. On a wide lens that is around twenty seconds. Focus by hand on the brightest star, and check the back of the camera at full zoom before you trust it.'),
          h2('Then do it a lot'),
          para('The single frame is the lesson; the good picture is usually many frames stacked, so the stars stay sharp and the noise averages away. But learn it one exposure at a time, in the cold, getting the focus wrong and fixing it, until the settings are muscle memory and you can spend the night looking up instead of down at a screen.'),
          para('The reward is disproportionate. An hour of fiddling in the dark gives you a photograph of a hundred billion stars, most of which set before the exposure ended.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'the-slow-road-through-kyushu',
    status: 'published',
    authorSlug: 'lena-ross',
    categories: ['Travel'],
    tags: ['Expedition', 'Portrait'],
    body: {
      title: 'The slow road through Kyushu',
      excerpt:
        'We gave ourselves two weeks to cross an island you can drive in a day, and let every small road we were not planning to take decide the trip.',
      featuredImage: { $asset: 'post-kyushu' },
      body: {
        type: 'doc',
        content: [
          para('The fast way across Kyushu is an expressway and an afternoon. We took two weeks and the small roads, on a rule we make ourselves keep: when a turning looks interesting, take it, and do not look up where it goes until you are already committed.'),
          h2('What the detours gave us'),
          para('A terraced hillside of rice going gold, worked by a man who has farmed it for sixty years and photographed his hands more willingly than his face. A hot spring at the end of a valley with one inn and no phone signal. A festival we walked into by accident and left three hours later, full of food no one would let us pay for.'),
          h2('The case for going slowly'),
          para('You cannot photograph a place you are driving through at speed; you can only photograph the idea of it you arrived with. Slowness is not a luxury in this work — it is the method. The picture is always down the road you almost did not take, talking to the person you almost did not stop for.'),
          para('We came back with fewer landmarks than a fast trip would have and far more of the island itself, which was the whole point.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'immersive-photo',
  key: 'sparx-immersive-photo',
  name: 'sparx — Immersive Photo',
  summary:
    'An immersive, photo-led journal on a near-black cinematic ground where the photography carries all the colour — a full-bleed photo cover, a photo-forward feed, a chaptered photo-essay band, and a bespoke photo-forward article reader, lit by one luminous solar-amber accent. Modelled on the immersive-photojournalism archetype; shipped as Wayfarer, a travel & photography journal. Ships a light store (fine-art prints, field gear, a photobook) to demonstrate content + commerce together.',
  tagline: 'A dark, image-led template for a journal that photographs and sells prints.',
  vertical: 'content',
  industry: 'Travel & photography',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 100,
  brand: {
    businessName: 'Wayfarer',
    tagline: 'The world, in full frame.',
  },
  // A centred-logo masthead over the dark cover, the newsletter footer whose bottom bar
  // carries the live © business name, and no header CTA — the photograph is the invitation.
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: false },
  seo: {
    home: {
      title: 'Wayfarer — a travel & photography journal',
      description:
        'Wayfarer is an independent travel and photography journal — long-scroll photo stories and reported features from the field, with signed prints of the work.',
    },
    about: {
      title: 'About Wayfarer — an independent photo journal',
      description:
        'Who Wayfarer is and how it works — a small circle of photographers and writers who go slowly, sell prints, and take no sponsored trips.',
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
