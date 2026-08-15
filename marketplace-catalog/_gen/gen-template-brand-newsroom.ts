// sparx-brand-newsroom — a first-party BRAND newsroom CONTENT template
// (docs/templates/content/playstation-blog). The dark, cover-art-forward counterpart to
// the light `news-feed` feed: where TechCrunch models an independent OUTLET reporting on
// an industry, this models a company's OWN content arm — a product studio's community
// newsroom where every post is a first-party launch ("out now," "shipping today"), the
// product art carries the colour, and the studio's store is one click away.
//
// The archetype, translated to sparx: a big latest-release feature band over a live launch
// feed, a "release notes" changelog band, a spotlight drop, and a bound store carousel — the
// content half of a content+commerce business, dressed in the bespoke `console` theme (a
// true-dark ground with ONE electric-violet accent, Space Grotesk display over Inter body —
// the launch-night look a brand newsroom wants). Shipped as "Launch Notes."
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts` (content-theme resolution + the `article` slot). The article
// DATA plumbing lives in the shared `template-sites/article.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-brand-newsroom.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-brand-newsroom/**" \
//     "marketplace-catalog/_gen/**/*.ts"
//   pnpm --filter @sparx/api-rest marketplace:self-register
//
// A CONTENT template still ships the full 9-page superset (the module-independent rule:
// author complete, the installer writes the tenant's enabled slices) — so it carries a
// LIGHT commerce slice (the studio's own merch) that doubles as the content+commerce demo.
// The bespoke effort goes where a publisher lives: the article.
//
// DARK-THEME DISCIPLINE. The `console` theme is a true-dark ground, but every colour here
// still resolves through SEMANTIC tokens — `bg-base-100`/`bg-base-200` grounds,
// `text-base-content` ink, `text-primary` for the violet accent — never a hex. Surfaces
// separate by base-tone shift + borders (never gradients or shadow), and any text sitting
// with a photo lives in a SOLID `bg-base-100` panel, never directly on the image.
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
  // Lead + story cover art (dark, product/tech vibe — the newsroom's identity)
  leadRelease: '1461749280684-dccba630e2f6',
  coverNews: '1518770660439-4636190af475',
  coverNimbus: '1485827404703-89b55fcc595e',
  coverDeck: '1526374965328-7f61d4dc18c5',
  coverGuides: '1497215728101-856f4ea42174',
  coverAurora: '1451187580459-43490279c0fa',
  spotlight: '1540575467063-178a50c2df87',
  // Team portraits
  authorReyes: '1494790108377-be9c29b29330',
  authorOkafor: '1500648767791-00dcc994a43e',
  authorLindqvist: '1573497019940-1c28c88b4f3e',
  // Studio store
  dock: '1499750310107-5fef28a66643',
  tee: '1591561954557-26941169b49e',
  stickers: '1544716278-ca5e3f4abd8c',
  hoodie: '1543286386-713bdd548da4',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'lead-release', url: U(IMG.leadRelease), alt: 'A studio monitor lit in the dark' },
  { id: 'cover-news', url: U(IMG.coverNews), alt: 'A close-up of a circuit board' },
  { id: 'cover-nimbus', url: U(IMG.coverNimbus), alt: 'A precision arm on an assembly line' },
  { id: 'cover-deck', url: U(IMG.coverDeck), alt: 'Hardware racked and lit in blue' },
  { id: 'cover-guides', url: U(IMG.coverGuides), alt: 'A studio team working together at desks' },
  { id: 'cover-aurora', url: U(IMG.coverAurora), alt: 'A field of stars over a dark horizon' },
  { id: 'spotlight', url: U(IMG.spotlight), alt: 'A darkened room before a launch event' },
  { id: 'author-reyes', url: U(IMG.authorReyes), alt: 'Portrait of Mara Reyes' },
  { id: 'author-okafor', url: U(IMG.authorOkafor), alt: 'Portrait of Daniel Okafor' },
  { id: 'author-lindqvist', url: U(IMG.authorLindqvist), alt: 'Portrait of Sofia Lindqvist' },
  { id: 'product-dock', url: U(IMG.dock), alt: 'The Field Kit Dock on a desk' },
  { id: 'product-tee', url: U(IMG.tee), alt: 'The Launch Notes studio tee' },
  { id: 'product-stickers', url: U(IMG.stickers), alt: 'The Launch Notes sticker pack' },
  { id: 'product-hoodie', url: U(IMG.hoodie), alt: 'The Launch Notes studio hoodie' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-brand-newsroom: unknown asset "${id}"`);
  return a.url;
};

// ── Home page bands (the brand newsroom) ─────────────────────────────────────────

/** The front-page LEAD — the current headline drop, given the whole width. Cover art on
 *  one side, a SOLID content panel on the other: the dark-newsroom rule is that white
 *  headline text never sits directly on the photo, it sits in a `bg-base-100` box beside
 *  it. The one `<h1>` on the home page. */
function leadFeatureBand(): Node {
  return el('section', 'bg-base-200 @container px-6 py-14', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl items-center gap-8 @4xl:grid-cols-2', {
        children: [
          el('img', 'aspect-video w-full rounded-box border border-base-300 bg-base-100 object-cover', {
            attrs: {
              src: assetUrl('lead-release'),
              alt: 'A studio monitor lit in the dark',
              loading: 'lazy',
            },
          }),
          // The SOLID text panel — never text over the image.
          el('div', 'flex flex-col gap-5 rounded-box border border-base-300 bg-base-100 p-8 @2xl:p-10', {
            children: [
              el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                text: 'Now shipping',
              }),
              el(
                'h1',
                'text-4xl font-bold leading-tight tracking-tight text-base-content @3xl:text-5xl',
                { text: 'Launch Notes 3.0 is live today' },
              ),
              el('p', 'max-w-xl text-lg leading-relaxed text-base-content', {
                text: 'The biggest release we have ever shipped: a rebuilt workspace, real-time sync across every device, and the first look at what the studio has been quietly building all year.',
              }),
              el('p', 'text-sm text-base-content', { text: 'By Mara Reyes, Founder · 6 August' }),
              el('a', 'btn btn-primary btn-lg w-fit', {
                attrs: { href: '/journal' },
                text: 'Read the release',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A plain section heading band, for the label over the bound launch feed. */
function headingBand(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-14 pb-2', {
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

/** Release notes — the studio's changelog as a content band. Every drop, versioned and
 *  dated: the newsroom's version of a changelog, the pattern a product community lives on.
 *  A section `<h2>` over per-entry `<h3>` titles (no level skip). */
function releaseNotesBand(): Node {
  const note = (tag: string, title: string, date: string, detail: string): Node =>
    el('li', 'flex flex-col gap-3 border-t border-base-300 py-6 @2xl:flex-row @2xl:gap-8', {
      children: [
        el('div', 'flex items-baseline gap-3 @2xl:w-40 @2xl:flex-col @2xl:items-start @2xl:gap-1', {
          children: [
            el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', { text: tag }),
            el('span', 'text-sm text-base-content', { text: date }),
          ],
        }),
        el('div', 'flex flex-col gap-2', {
          children: [
            el('h3', 'text-xl font-semibold leading-snug text-base-content', { text: title }),
            el('p', 'max-w-2xl text-base leading-relaxed text-base-content', { text: detail }),
          ],
        }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-14', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-6', {
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'Release notes',
              }),
              el('p', 'max-w-2xl text-lg text-base-content', {
                text: 'Everything we have shipped lately, smallest fix to biggest launch. Follow along and you always know what changed.',
              }),
            ],
          }),
          el('ol', 'flex flex-col', {
            children: [
              note(
                'Launch Notes 3.0',
                'A rebuilt workspace and real-time sync',
                '6 August',
                'The core app is faster, quieter, and now syncs your work across every device the instant you make a change. The old sync engine is retired.',
              ),
              note(
                'Nimbus 1.2',
                'Focus timer arrives on the desktop app',
                '22 July',
                'Nimbus, our focus timer, is now built into the desktop app instead of a separate download. Your sessions carry over automatically.',
              ),
              note(
                'Deck firmware 2.4',
                'Faster wake and a fix for the sleep-charge bug',
                '9 July',
                'The Deck now wakes in under a second, and the battery no longer drains while docked overnight. Update from Settings → Device.',
              ),
              note(
                'Aurora 1.0',
                'Our design tool leaves beta',
                '18 June',
                'Aurora is out of beta and ready for real work: stable file format, shared libraries, and a version history you can trust.',
              ),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The spotlight — one current drop given extra room, a marquee for the headline launch.
 *  Cover art beside a SOLID panel, same dark-newsroom discipline as the lead. A section
 *  `<h2>` — the page's single `<h1>` belongs to the lead above. */
function spotlightBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-14', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl items-center gap-8 @4xl:grid-cols-2', {
        children: [
          // Panel first on wide screens so the copy leads and the art answers it.
          el('div', 'flex flex-col gap-5 rounded-box border border-base-300 bg-base-200 p-8 @2xl:p-10 @4xl:order-first', {
            children: [
              el('span', 'text-sm font-semibold uppercase tracking-wide text-primary', {
                text: 'Spotlight',
              }),
              el('h2', 'text-3xl font-bold leading-tight tracking-tight text-base-content @3xl:text-4xl', {
                text: 'Meet the Field Kit — the studio, in a bag',
              }),
              el('p', 'max-w-xl text-lg leading-relaxed text-base-content', {
                text: 'Everything a maker on the move needs: the Deck, the Dock, and a set of tools tuned to work together out of the box. Built by the people who use it every day.',
              }),
              el('a', 'btn btn-primary btn-lg w-fit', {
                attrs: { href: '/journal' },
                text: 'See the reveal',
              }),
            ],
          }),
          el('img', 'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover', {
            attrs: {
              src: assetUrl('spotlight'),
              alt: 'A darkened room before a launch event',
              loading: 'lazy',
            },
          }),
        ],
      }),
    ],
  });
}

/** Stay connected — the community-conversion band a brand newsroom ends on. A follow row
 *  of the studio's channels, each a real link. Community is the conversion, not a paywall. */
function socialBand(): Node {
  const channel = (label: string): Node =>
    el('a', 'btn btn-neutral btn-outline btn-lg', {
      attrs: { href: '/contact' },
      text: label,
    });
  return el('section', 'bg-base-200 @container px-6 py-14', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-6', {
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'Stay connected',
              }),
              el('p', 'max-w-2xl text-lg text-base-content', {
                text: 'The studio ships in the open. Follow along, ask us anything, and help decide what we build next.',
              }),
            ],
          }),
          el('div', 'flex flex-wrap gap-4', {
            children: [
              channel('Join the community'),
              channel('Follow the studio'),
              channel('Developer updates'),
            ],
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  leadFeatureBand(),
  headingBand('The latest drops', 'Everything new from the studio, newest first.'),
  blogPostGrid(),
  releaseNotesBand(),
  spotlightBand(),
  // The content→commerce bridge: the studio's own store, as a live carousel.
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'The Studio Store' }),
  socialBand(),
];

// ── The bespoke article page (a release writeup) ─────────────────────────────────
// A brand-newsroom announcement post: the category chip over the headline, a team byline
// (author + date), the full-width cover, the written body, and a team card at the foot.
// Every bound field resolves against the routed post (the `article.ts` kit's
// `repeat('blog_post')` scope); the byline lights up from the storefront's projection.

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
              el('span', undefined, { text: 'All updates' }),
            ],
          }),
          // The category chip — the editorial rubric, bound to the post's category.
          articleRubric('text-sm font-semibold uppercase tracking-wide text-primary'),
          articleTitle(
            'h1',
            'text-4xl font-bold leading-tight tracking-tight text-base-content @2xl:text-5xl',
          ),
          articleStandfirst('max-w-2xl text-xl leading-relaxed text-base-content'),
          // The team byline — author portrait, name, and date.
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

/** The full-width cover image band, at the article measure. */
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

/** The team card at the foot — portrait, name, bio. Gated on the author bio, so it appears
 *  only when there is genuinely something to say about who wrote the piece. */
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
            text: 'The Launch Notes journal',
          }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Every drop, straight from the makers — announcements, dev diaries, and the story behind what we ship.',
          }),
        ],
      }),
    ],
  }),
];

// ── About + Contact (Launch Notes-voiced) ─────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'About Launch Notes',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Launch Notes is a small product studio that builds tools for people who make things — software, hardware, and the guides that tie them together. This is our newsroom: the front door to everything we ship and everyone who ships it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We build in the open. Every release gets a post, every post has a name on it, and the community that uses our work helps decide what comes next. No press releases, no launch theatre — just the makers telling you what changed and why.',
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
    heading: 'Talk to the studio',
    intro: 'A bug, a feature request, or a question about something we shipped? The team reads every message, and we would genuinely rather hear from you before you give up on a workaround.',
    submitLabel: 'Email the team',
  }),
];

// ── Light commerce (the Studio Store — the merch, the content+commerce demo) ──────

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
    handle: 'field-kit-dock',
    title: 'The Field Kit Dock',
    description:
      'The desk-side dock that turns the Deck into a full workstation: one cable to charge, one to your display, and a wake time you will not believe until you try it. Machined aluminium, built to outlast the hardware it holds.',
    status: 'active',
    productType: 'Hardware',
    vendor: 'Launch Notes',
    tags: ['Deck', 'Field Kit'],
    categoryHandles: ['gear'],
    collectionHandles: ['featured'],
    seoTitle: 'The Field Kit Dock — Launch Notes',
    seoDescription: 'A machined aluminium dock that turns the Deck into a full workstation.',
    variants: [
      { sku: 'LN-DOCK-01', priceCents: money(89), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'product-dock', isPrimary: true, alt: 'The Field Kit Dock on a desk' }],
  },
  {
    handle: 'studio-tee',
    title: 'Studio Tee',
    description:
      'A heavyweight cotton tee with the Launch Notes mark printed small on the chest. The one the team actually wears on release day. Pre-shrunk, and soft enough that you will forget it is merch.',
    status: 'active',
    productType: 'Apparel',
    vendor: 'Launch Notes',
    tags: ['Apparel'],
    categoryHandles: ['apparel'],
    collectionHandles: ['featured'],
    seoTitle: 'Studio Tee — Launch Notes',
    seoDescription: 'A heavyweight cotton tee with the Launch Notes mark.',
    variants: [
      { sku: 'LN-TEE-01', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'product-tee', isPrimary: true, alt: 'The Launch Notes studio tee' }],
  },
  {
    handle: 'sticker-pack',
    title: 'Sticker Pack',
    description:
      'Twelve die-cut vinyl stickers: the studio mark, every product logo, and a couple of in-jokes only the community will get. Weatherproof, laptop-tested, and the fastest way to spot a fellow maker.',
    status: 'active',
    productType: 'Gear',
    vendor: 'Launch Notes',
    tags: ['Apparel'],
    categoryHandles: ['gear'],
    collectionHandles: ['featured'],
    seoTitle: 'Sticker Pack — Launch Notes',
    seoDescription: 'Twelve weatherproof die-cut vinyl stickers from the studio.',
    variants: [
      { sku: 'LN-STICK-01', priceCents: money(9), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [
      { assetId: 'product-stickers', isPrimary: true, alt: 'The Launch Notes sticker pack' },
    ],
  },
  {
    handle: 'studio-hoodie',
    title: 'Studio Hoodie',
    description:
      'A midweight brushed-fleece hoodie in studio grey, with the mark embroidered at the cuff. Built for a long night before a launch and comfortable enough for the morning after it ships.',
    status: 'active',
    productType: 'Apparel',
    vendor: 'Launch Notes',
    tags: ['Apparel'],
    categoryHandles: ['apparel'],
    collectionHandles: [],
    seoTitle: 'Studio Hoodie — Launch Notes',
    seoDescription: 'A midweight brushed-fleece hoodie with an embroidered studio mark.',
    variants: [
      { sku: 'LN-HOOD-01', priceCents: money(62), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'product-hoodie', isPrimary: true, alt: 'The Launch Notes studio hoodie' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'gear', name: 'Gear', description: 'Kit for your desk and your bag.', featured: true },
    { handle: 'apparel', name: 'Apparel', description: 'Wear the studio.', featured: true },
  ],
  collections: [
    {
      handle: 'featured',
      name: 'Featured',
      description: 'What the studio is wearing and carrying this season.',
      type: 'manual',
      featured: true,
      productHandles: ['field-kit-dock', 'studio-tee', 'sticker-pack'],
    },
  ],
  products: PRODUCTS,
};

// ── The team (byline personas) ────────────────────────────────────────────────────
// Real authors the posts reference by `authorSlug`. The installer seeds these as CMS
// `Author` rows scoped to the site, and the storefront byline projection resolves them —
// so the bespoke article page shows a real name, portrait and bio, not an empty byline.

const AUTHORS = [
  {
    slug: 'mara-reyes',
    displayName: 'Mara Reyes',
    bio: 'Mara Reyes founded Launch Notes and still writes most of the big release posts herself. She cares about shipping small, shipping often, and telling you the truth about what is and is not ready.',
    avatarAssetId: 'author-reyes',
  },
  {
    slug: 'daniel-okafor',
    displayName: 'Daniel Okafor',
    bio: 'Daniel Okafor leads product design at the studio. He writes the dev diaries and the guides, usually the week after he has finally figured the thing out himself.',
    avatarAssetId: 'author-okafor',
  },
  {
    slug: 'sofia-lindqvist',
    displayName: 'Sofia Lindqvist',
    bio: 'Sofia Lindqvist runs hardware at Launch Notes — the Deck, the Dock, and everything with a battery in it. She writes the firmware notes and the unboxing posts.',
    avatarAssetId: 'author-lindqvist',
  },
];

// ── Content (the Launch Notes posts) ──────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'launch-notes-3-is-live',
    status: 'published',
    authorSlug: 'mara-reyes',
    categories: ['News'],
    tags: ['Aurora', 'Nimbus'],
    body: {
      title: 'Launch Notes 3.0 is live today',
      excerpt:
        'The biggest release we have ever shipped: a rebuilt workspace, real-time sync across every device, and a faster, quieter app underneath it all.',
      featuredImage: { $asset: 'lead-release' },
      body: {
        type: 'doc',
        content: [
          para('We started rebuilding Launch Notes eleven months ago, and today it is yours. 3.0 is not a coat of paint — it is a new foundation, and almost everything you touch is faster because of it.'),
          h2('A workspace that gets out of the way'),
          para('The old app made you manage windows; the new one manages them for you. Your projects, your notes and your active session live in one place, and the thing you were doing five minutes ago is one keystroke away. We cut the number of clicks to start work by more than half, and you will feel it on the first morning.'),
          h2('Sync that is finally instant'),
          para('The single most requested thing, for years, was sync you could trust. The old engine is retired. The new one propagates a change to every device you own before you have finished typing the next word, and it does the right thing when two devices edit at once instead of asking you to pick a winner.'),
          h2('What is next'),
          para('3.0 clears the runway for the things we have been holding back — a few of which you will see before the end of the quarter. As always, every one of them will get a post here first. Thank you for building with us; go make something.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'introducing-nimbus',
    status: 'published',
    authorSlug: 'daniel-okafor',
    categories: ['Products'],
    tags: ['Nimbus'],
    body: {
      title: 'Introducing Nimbus — our focus timer, out now',
      excerpt:
        'A focus timer built the way we actually work: no gimmicks, no streaks to guilt you, just a quiet way to protect an hour and see where it went.',
      featuredImage: { $asset: 'cover-nimbus' },
      body: {
        type: 'doc',
        content: [
          para('Nimbus started as a tool we built for ourselves. Every focus app we tried treated your attention like a game to be won, with streaks and badges and a little animated tree that dies if you check your phone. We wanted the opposite: something that disappears while you work and tells you the truth afterwards.'),
          h2('Start a session, forget it exists'),
          para('You pick a length, name what you are doing, and Nimbus fades into the corner. No ticking, no countdown looming over the screen. When the time is up it nudges you once, gently, and asks if you want to keep going. That is the whole interaction, and that is the point.'),
          h2('The part that surprised us'),
          para('The feature people love most is the one we almost cut: a plain weekly view of where your focused hours actually went. Not a score, not a leaderboard — just the honest shape of your week. It turns out that seeing the truth is far more motivating than any badge we could have designed.'),
          para('Nimbus is free for everyone with a Launch Notes account, and it is built into the desktop app as of this week. Give it a session and tell us what you think.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'the-deck-first-look',
    status: 'published',
    authorSlug: 'sofia-lindqvist',
    categories: ['Hardware'],
    tags: ['Deck', 'Field Kit'],
    body: {
      title: 'The Launch Notes Deck — a first look',
      excerpt:
        'Our first piece of hardware. Two years, more prototypes than we will admit to, and a device built around one idea: your studio should fit in a bag.',
      featuredImage: { $asset: 'cover-deck' },
      body: {
        type: 'doc',
        content: [
          para('For two years we have been quietly making hardware. Today we can finally show you the Deck — a portable workstation built around a simple frustration: the best tools were always tied to a desk, and the desk was never where the work happened.'),
          h2('Built by the people who use it'),
          para('Every decision on the Deck came from watching the team actually work. The ports are where your hand expects them. It wakes the instant you open it. The battery lasts a real working day, not a benchmark day. None of that is exciting on a spec sheet, and all of it is the difference between a tool you carry and one you leave at home.'),
          h2('Where it fits'),
          para('The Deck is the heart of the Field Kit — it docks at your desk, packs into your bag, and runs the same Launch Notes workspace you already know. Nothing to migrate, nothing to relearn. Your work is simply there, wherever you are.'),
          para('This is a first look, not a launch — we will open pre-orders once firmware 2.4 has had another few weeks in the field. Watch this space, and thank you for two years of patience.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'five-workflows-our-team-lives-in',
    status: 'published',
    authorSlug: 'daniel-okafor',
    categories: ['Guides'],
    tags: ['Aurora', 'Nimbus'],
    body: {
      title: 'Five workflows our team lives in',
      excerpt:
        'The small habits and shortcuts the studio actually uses every day — the ones that never make it into the docs because we forget they are not obvious.',
      featuredImage: { $asset: 'cover-guides' },
      body: {
        type: 'doc',
        content: [
          para('Every team builds its own shortcuts, and ours are so baked in that we forget they are not obvious to everyone. So here are five things the studio does every day that might save you an hour of yours.'),
          h2('Start the day in Nimbus, not the inbox'),
          para('The whole team blocks the first session of the morning in Nimbus before opening anything else. One hour on the hardest thing, while your attention is fresh, before the day fills up with everyone else priorities. It is the single highest-leverage habit any of us have.'),
          h2('Keep a shared library in Aurora'),
          para('We stopped copying components between files months ago. One shared Aurora library holds every mark, colour and pattern, and every file pulls from it live. Change it once and the whole studio updates. If you work with anyone else, this is the first thing to set up.'),
          h2('Name your work as you start it'),
          para('Sync only helps if you can find things later, and a folder full of Untitled-3 helps no one. We name a session the moment we start it, in plain language, as if a teammate will read it — because in our workspace, one will.'),
          para('None of these are features you have to buy. They are just habits, and the tools are built to reward them. Steal the ones that fit.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'aurora-hits-1-0',
    status: 'published',
    authorSlug: 'mara-reyes',
    categories: ['Products'],
    tags: ['Aurora'],
    body: {
      title: 'Aurora hits 1.0',
      excerpt:
        'Our design tool leaves beta today. A stable file format, shared libraries, and a version history you can finally trust with real work.',
      featuredImage: { $asset: 'cover-aurora' },
      body: {
        type: 'doc',
        content: [
          para('Aurora has been in beta for a year, and in that time you have used it to ship real products — which is exactly why we took so long to call it 1.0. A design tool earns that number by being boring in all the right places, and Aurora finally is.'),
          h2('A file format that will not change under you'),
          para('The single biggest promise of 1.0 is stability. The Aurora file you save today will open, unchanged, in every version from here on. No silent migrations, no corrupted files after an update. Your work is safe, and it stays safe.'),
          h2('History you can trust'),
          para('Every change is now captured in a version history you can scrub through, name, and restore from with one click. The moment before you made that questionable decision at 2am is always there, waiting, exactly as you left it.'),
          para('Aurora 1.0 is available today for everyone with a studio membership. If you have been waiting for it to leave beta before trusting it with real work — it has, and you can.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'brand-newsroom',
  key: 'sparx-brand-newsroom',
  name: 'Brand Newsroom',
  summary:
    'A first-party brand newsroom for a product studio — a big latest-release feature over a live launch feed, a release-notes changelog, a spotlight drop, and a bound store carousel, on a true-dark ground with one electric-violet accent. Modelled on the brand-community-newsroom archetype; shipped as Launch Notes. Ships a light studio store (merch) to demonstrate content + commerce together.',
  tagline: 'A dark, cover-art brand-newsroom template for a studio that ships and sells.',
  vertical: 'content',
  industry: 'Product studio newsroom',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 100,
  brand: {
    businessName: 'Launch Notes',
    tagline: 'Everything we ship, and why.',
  },
  // A brand-left header with a filled CTA (Subscribe/Follow), and the newsletter footer whose
  // bottom bar carries the live © business name.
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Launch Notes — every drop, straight from the makers',
      description:
        'Launch Notes is a product studio and its newsroom: release announcements, dev diaries, and the story behind everything we ship — with the studio store one click away.',
    },
    about: {
      title: 'About Launch Notes — a product studio that builds in the open',
      description:
        'Who Launch Notes is and how we work — a small studio that ships software, hardware and guides, and posts every release here first.',
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
