// sparx-retail-bookstore-modern — a RETAIL/COMMERCE site template: a bright, modern bookshop.
//
// The clean, contemporary counterpart to the warm literary indie (`gen-retail-bookstore-indie`):
// a complete, working shop the moment it installs — a real catalogue of new releases, fiction,
// nonfiction and books for young readers (invented titles + authors), an enamel-pin set, a clip
// reading light and a monthly reading subscription — with categories + collections, a bespoke
// cover-forward PDP, the full 9-page commerce site (home merchandising → shop → collections →
// cart → search → journal → about → contact), dressed in an INLINE bespoke theme (a bright
// near-white ground, a confident modern blue primary + a coral accent, a clean grotesk display
// over a readable sans). Shipped as Volume Books.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries its OWN
// theme inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-bookstore-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-bookstore-modern/**" \
//     "marketplace-catalog/_gen/gen-retail-bookstore-modern.ts"
//
// SEMANTIC TOKENS ONLY, NAMED UTILITIES ONLY (arbitrary/off-step classes emit nothing once
// stamped — the sweep flags them). Container steps @sm/@md/@2xl/@3xl/@5xl only.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  el,
  type Node,
} from '../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { productsBlock } from '../../packages/silica-catalog/src/commerce';
import { defineTheme, face, STATUS_ON_DARK, STATUS_ON_LIGHT } from '../../packages/silica-catalog/src/themes';
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import { contactSection } from './shared/contact-section';
import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import {
  addToCartForm,
  pdpDescription,
  pdpImage,
  pdpPolicyLinks,
  pdpPriceRow,
  pdpStockBadge,
  pdpTitle,
  productPage,
} from './template-sites/pdp';

// ── The bespoke theme (inline) ─────────────────────────────────────────────────────
// Bright and contemporary: a crisp near-white ground with the faintest cool tint, near-black
// ink, a confident modern BLUE primary and a warm CORAL accent for links + rubrics — the two
// play off each other the way a modern cover does. A clean grotesk display (Space Grotesk) over
// a readable sans (Inter). Complete light + dark, AA on every role (the blueprint sweep's
// contrast check is the gate). Both `primary` and `accent` sit at ~48% L so they clear 4.5:1 as
// link TEXT on the bright ground; `secondary` is a dark, legible slate on light.
const THEME = defineTheme({
  name: 'chapter-bright',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.625rem', field: '0.5rem', box: '0.875rem', depth: '0' },
  light: {
    surfaces: ['oklch(99% 0.003 255)', 'oklch(97% 0.006 255)', 'oklch(92% 0.01 255)', 'oklch(21% 0.02 262)'],
    roles: {
      primary: 'oklch(48% 0.19 258)',
      secondary: 'oklch(40% 0.03 260)',
      accent: 'oklch(50% 0.2 30)',
      neutral: 'oklch(24% 0.02 262)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(21% 0.02 262)', 'oklch(17% 0.02 262)', 'oklch(13% 0.015 262)', 'oklch(97% 0.006 255)'],
    roles: {
      primary: 'oklch(74% 0.15 258)',
      secondary: 'oklch(78% 0.03 260)',
      accent: 'oklch(74% 0.16 32)',
      neutral: 'oklch(30% 0.02 262)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "vol-hero": "https://images.unsplash.com/photo-1744693660970-3517f524fb28?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwbW9kZXJuJTIwYm9va3Nob3AlMjBpbnRlcmlvciUyMGNvdmVyLWZvcndhcmQlMjBkaXNwbGF5JTIwdGFibGVzfGVufDB8MHx8fDE3ODY0MDYwMjh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vol-tile-new": "https://images.unsplash.com/photo-1543682817-5bfcc2be85b5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZnJvbnQlMjB0YWJsZSUyMG5ldy1yZWxlYXNlJTIwY292ZXJzJTIwZmFjZS1vdXQlMjB1bmRlciUyMGNsZWFufGVufDB8MHx8fDE3ODY0MDYwMzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vol-tile-fiction": "https://images.unsplash.com/photo-1542713504-03db5fb21c66?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGlkeSUyMHNoZWxmJTIwZmljdGlvbnxlbnwwfDB8fHwxNzg2NDA2NDEwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vol-tile-nonfiction": "https://images.unsplash.com/photo-1516979187457-637abb4f9353?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBub25maWN0aW9uJTIwaGFyZGNvdmVycyUyMHBhbGUlMjB0YWJsZXxlbnwwfDB8fHwxNzg2NDA2MDM3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vol-tile-kids": "https://images.unsplash.com/photo-1549737221-bef65e2604a6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bG93JTIwYnJpZ2h0JTIwc2hlbGYlMjBwaWN0dXJlJTIwYm9va3MlMjBraWRzJTIwcmVhZGluZ3xlbnwwfDB8fHwxNzg2NDA2MDQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vol-band-picks": "https://images.unsplash.com/photo-1643250048998-7ffa83ae2c63?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym9va3NlbGxlciUyMGFycmFuZ2luZyUyMGNvdmVyLWZvcndhcmQlMjBzdGFmZi1waWNrcyUyMGRpc3BsYXl8ZW58MHwwfHx8MTc4NjQwNjA0M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vol-band-sub": "https://images.unsplash.com/photo-1577138230503-0a95a59234a3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d3JhcHBlZCUyMGJvb2slMjBjYXJkJTIwcmVhZHklMjBwb3N0JTIwc3Vic2NyaWJlcnxlbnwwfDB8fHwxNzg2NDA2MDQ2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-glass-orchard": "https://images.unsplash.com/photo-1609636850937-0939e94eee78?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y292ZXIlMjBnbGFzcyUyMG9yY2hhcmQlMjBtb2Rlcm4lMjBwYXBlcmJhY2t8ZW58MHwwfHx8MTc4NjQwNjA0OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-northbound": "https://images.unsplash.com/photo-1660523729154-db6395e7d938?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8Y292ZXIlMjBub3J0aGJvdW5kJTIwbW9kZXJuJTIwcGFwZXJiYWNrfGVufDB8MHx8fDE3ODY0MDYwNTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-static-signal": "https://images.unsplash.com/photo-1765408217792-94cbe94998ed?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y292ZXIlMjBzdGF0aWMlMjBzaWduYWwlMjBzaG9ydC1zdG9yeSUyMGNvbGxlY3Rpb258ZW58MHwwfHx8MTc4NjQwNjA1NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-attention-diet": "https://images.unsplash.com/photo-1759480305194-69c0fb00207b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y292ZXIlMjBhdHRlbnRpb24lMjBkaWV0JTIwbm9uZmljdGlvbiUyMGhhcmRjb3ZlcnxlbnwwfDB8fHwxNzg2NDA2MDU5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-deep-time": "https://images.unsplash.com/photo-1506452819137-0422416856b8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y292ZXIlMjBkZWVwJTIwdGltZXxlbnwwfDB8fHwxNzg2NDA2NDE0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-otto": "https://images.unsplash.com/photo-1771998872950-4bf206f43513?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y292ZXIlMjBvdHRvJTIwbWlkbmlnaHQlMjBsaWJyYXJ5JTIwcGljdHVyZSUyMGJvb2t8ZW58MHwwfHx8MTc4NjQwNjA2NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-sock-robbers": "https://images.unsplash.com/photo-1605627082049-2e77d4d16716?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y292ZXIlMjBzb2NrJTIwcm9iYmVycyUyMGtpZHMlMjBjaGFwdGVyJTIwYm9va3xlbnwwfDB8fHwxNzg2NDA2MDY4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-pins": "https://images.unsplash.com/photo-1562216958-0831919933e7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwdGhyZWUlMjBlbmFtZWwlMjByZWFkaW5nJTIwcGlucyUyMGNhcmR8ZW58MHwwfHx8MTc4NjQwNjA3MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-light": "https://images.unsplash.com/photo-1727721055020-937beb1c362b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2xpbSUyMGNsaXAtb24lMjByZWFkaW5nJTIwbGlnaHQlMjBvcGVuJTIwYm9va3xlbnwwfDB8fHwxNzg2NDA2MDc0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subscription": "https://images.unsplash.com/photo-1630343710506-89f8b9f21d31?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9udGhseSUyMHJlYWRpbmclMjBzdWJzY3JpcHRpb258ZW58MHwwfHx8MTc4NjQwNjQxN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-new-releases": "https://images.unsplash.com/photo-1647485894914-539cd6430260?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmFuJTIwbmV3LXJlbGVhc2UlMjBjb3ZlcnMlMjBicmlnaHQlMjB0YWJsZXxlbnwwfDB8fHwxNzg2NDA2MDgwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-reading-year": "https://images.unsplash.com/photo-1578589335615-9e804277a5af?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3BlbiUyMG5vdGVib29rJTIwc3RhY2slMjBib29rcyUyMGJlc2lkZSUyMGNvZmZlZXxlbnwwfDB8fHwxNzg2NDA2MDgzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-modern-bookshop": "https://images.unsplash.com/photo-1648405898502-c07cdf83d1af?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwbWluaW1hbCUyMG1vZGVybiUyMGJvb2tzaG9wJTIwc3RvcmVmcm9udCUyMGJ5JTIwZGF5fGVufDB8MHx8fDE3ODY0MDYwODV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'vol-hero', url: src('vol-hero'), alt: 'A bright modern bookshop interior with cover-forward display tables' },
  { id: 'vol-tile-new', url: src('vol-tile-new'), alt: 'A front table of new-release covers face-out under clean light' },
  { id: 'vol-tile-fiction', url: src('vol-tile-fiction'), alt: 'A tidy shelf of fiction with colourful modern spines' },
  { id: 'vol-tile-nonfiction', url: src('vol-tile-nonfiction'), alt: 'A stack of nonfiction hardcovers on a pale table' },
  { id: 'vol-tile-kids', url: src('vol-tile-kids'), alt: 'A low, bright shelf of picture books in a kids reading corner' },
  { id: 'vol-band-picks', url: src('vol-band-picks'), alt: 'A bookseller arranging a cover-forward staff-picks display' },
  { id: 'vol-band-sub', url: src('vol-band-sub'), alt: 'A wrapped book and a card ready to post to a subscriber' },
  { id: 'prod-glass-orchard', url: src('prod-glass-orchard'), alt: 'The cover of The Glass Orchard, a modern paperback' },
  { id: 'prod-northbound', url: src('prod-northbound'), alt: 'The cover of Northbound, a modern paperback' },
  { id: 'prod-static-signal', url: src('prod-static-signal'), alt: 'The cover of Static & Signal, a short-story collection' },
  { id: 'prod-attention-diet', url: src('prod-attention-diet'), alt: 'The cover of The Attention Diet, a nonfiction hardcover' },
  { id: 'prod-deep-time', url: src('prod-deep-time'), alt: 'The cover of Deep Time, Bright Water, a nonfiction hardcover' },
  { id: 'prod-otto', url: src('prod-otto'), alt: 'The cover of Otto and the Midnight Library, a picture book' },
  { id: 'prod-sock-robbers', url: src('prod-sock-robbers'), alt: 'The cover of The Sock Robbers, a kids chapter book' },
  { id: 'prod-pins', url: src('prod-pins'), alt: 'A set of three enamel reading pins on a card' },
  { id: 'prod-light', url: src('prod-light'), alt: 'A slim clip-on reading light on an open book' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A monthly reading subscription parcel with a wrapped book' },
  { id: 'post-new-releases', url: src('post-new-releases'), alt: 'A fan of new-release covers on a bright table' },
  { id: 'post-reading-year', url: src('post-reading-year'), alt: 'An open notebook and a stack of books beside a coffee' },
  { id: 'post-modern-bookshop', url: src('post-modern-bookshop'), alt: 'A bright, minimal modern bookshop storefront by day' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-bookstore-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one bright photograph, a grotesk headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('vol-hero'), alt: 'A bright modern bookshop with cover-forward tables', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'The good stuff, up front.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Volume is a modern bookshop for people who love a great cover and an even better story. We read widely, put the best of it face-out, and make it dead simple to find your next favourite — no snobbery, no overwhelm.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop all books' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop/volume-reading-subscription' },
                      text: 'Start a subscription',
                    }),
                  ],
                }),
              ],
            }),
          ],
        }
      ),
    ],
  });
}

/** One category tile — a photo with a label beneath, the whole tile a link. */
function categoryTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
  return el('a', 'group flex flex-col gap-3', {
    attrs: { href: o.href },
    children: [
      el('img', 'aspect-square w-full rounded-box bg-base-200 object-cover transition group-hover:opacity-90', {
        attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
      }),
      el('span', 'text-center text-base font-semibold text-base-content', { text: o.label }),
    ],
  });
}

function categoryTiles(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Browse by shelf',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'vol-tile-new', label: 'New releases', href: '/shop', alt: 'A front table of new-release covers' }),
              categoryTile({ assetId: 'vol-tile-fiction', label: 'Fiction', href: '/shop', alt: 'A shelf of modern fiction spines' }),
              categoryTile({ assetId: 'vol-tile-nonfiction', label: 'Nonfiction', href: '/shop', alt: 'A stack of nonfiction hardcovers' }),
              categoryTile({ assetId: 'vol-tile-kids', label: 'Kids', href: '/shop', alt: 'A bright kids reading corner' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A full-bleed editorial band — a photo carrying a heading, a lead and a link, panel
 *  bottom-left. */
function editorialBand(o: { heading: string; lead: string; assetId: string; cta: string; href: string; alt: string }): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-4 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h2', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl', {
                  text: o.heading,
                }),
                el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
                el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                  attrs: { href: o.href },
                  text: o.cta,
                }),
              ],
            }),
          ],
        }
      ),
    ],
  });
}

const HOME: Node[] = [
  hero(),
  productsBlock({ source: 'commerce.category.new-releases', layout: 'carousel', heading: 'Just landed' }),
  categoryTiles(),
  editorialBand({
    heading: 'Picked by people, not a chart',
    lead: 'Every book on our front table has been read by someone on the team, with a one-line note that tells you exactly who it’s for. It’s the modern version of asking a friend with great taste — quick, honest, and almost always right.',
    assetId: 'vol-band-picks',
    cta: 'See this month’s picks',
    href: '/blog/what-were-reading-now',
    alt: 'A bookseller arranging a cover-forward staff-picks display',
  }),
  productsBlock({ source: 'commerce.category.fiction', layout: 'carousel', heading: 'In fiction' }),
  productsBlock({ source: 'commerce.category.nonfiction', layout: 'carousel', heading: 'In nonfiction' }),
  editorialBand({
    heading: 'A book you’ll love, every month',
    lead: 'Tell us what you’re into and the Volume subscription does the rest: one hand-picked book on your doorstep each month, wrapped, with a note on why we chose it. Pause, swap or cancel whenever — no lock-in, ever.',
    assetId: 'vol-band-sub',
    cta: 'Start a subscription',
    href: '/shop/volume-reading-subscription',
    alt: 'A wrapped book and card ready to post to a subscriber',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the cover image. Right: the buy column (shop rubric, title, price, low-stock,
 *  description, add-to-cart, a modern "if you liked…" hand-sell note, and policy links). */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          pdpImage('aspect-square w-full rounded-box bg-base-200 object-cover'),
          el('div', 'flex flex-col gap-6 @3xl:py-4', {
            children: [
              el('div', 'flex flex-col gap-4', {
                children: [
                  el('p', 'text-sm font-semibold uppercase tracking-widest text-accent', {
                    text: 'Volume Books',
                  }),
                  pdpTitle('h1', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl'),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-semibold text-base-content',
                    compareClass: 'text-lg text-secondary line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 rounded-field bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-content',
                    label: 'Nearly gone',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 rounded-box bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-accent', { text: 'If you liked…' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Not sure it’s for you? Every book here comes with a real recommendation, and we’re happy to talk you into — or out of — anything. Drop a note with your order and we’ll tell you what to read next. A person, not an algorithm.',
                  }),
                ],
              }),
              pdpPolicyLinks({
                className:
                  'flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-base-300 pt-5 text-sm font-semibold uppercase tracking-widest text-base-content',
                linkClass: 'underline underline-offset-4',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Readers also picked up' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
            text: heading,
          }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: lead }),
        ],
      }),
    ],
  });
}

const SHOP: Node[] = [
  pageMasthead(
    'All books',
    'Everything on the shelves right now — new releases, fiction, nonfiction and books for young readers, plus a few good things for the readers in your life. Filter by shelf or sort however you like; the covers do a lot of the talking.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The books grouped the way we actually display them — just-landed new releases, the team’s current picks, the fiction and nonfiction shelves, the kids’ corner, and gifts for readers.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Volume', 'After a specific title, author or subject? Search the whole shop and the journal below — and if we haven’t got it in, we can almost always order it for you.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your bag' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping over $40, and we’ll gift-wrap anything for free — just say so in the notes. Orders are packed by hand at the shop, usually the same day, and always with care.',
          }),
        ],
      }),
    ],
  }),
];
const JOURNAL: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Volume journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'What we’re reading, reading lists worth keeping, and the odd honest take on the book world — written by the people who put the covers face-out. Short, useful, no homework.',
          }),
        ],
      }),
    ],
  }),
];

// ── About + Contact ─────────────────────────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Volume' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Volume started with a simple frustration: brilliant books, buried spine-out on crowded shelves, impossible to find unless you already knew to look. So we built the opposite — a bright, uncluttered shop where the best of what we read faces out, with a plain note on who it’s for and why it’s worth your time.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We stock small presses and big houses alike, because a great book is a great book whoever printed it. We just won’t pretend to love something to shift a stack. Our picks are read cover to cover before they earn a spot on the front table, and we stand behind every one.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No overwhelm, no gatekeeping, no book we couldn’t tell you something true about. Just a well-lit room full of things worth reading — and someone on hand who’s read them.',
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
    heading: 'Say hello',
    intro: 'Chasing a title, planning an event, or stuck on a gift for someone impossible to buy for? Tell us what you’re after and a real bookseller will write back — recommending books is genuinely our favourite part.',
    submitLabel: 'Email the shop',
  }),
];

// ── Commerce (the catalogue) ─────────────────────────────────────────────────────────

const money = (dollars: number): number => Math.round(dollars * 100);

interface Variant {
  sku: string;
  priceCents: number;
  isDefault?: boolean;
  inventoryPolicy: 'continue';
  optionValues?: Record<string, string>;
}
interface OptionDecl {
  name: string;
  displayType: 'swatch' | 'dropdown';
  values: { value: string }[];
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
  options?: OptionDecl[];
  variants: Variant[];
  images: { assetId: string; isPrimary: true; alt: string }[];
}

// Every book ships in two bindings — a paperback and a hardcover that runs a little dearer —
// the way a shop actually stocks a title.
const FORMAT: OptionDecl = {
  name: 'Format',
  displayType: 'dropdown',
  values: [{ value: 'Paperback' }, { value: 'Hardcover' }],
};

const book = (opts: {
  handle: string;
  title: string;
  author: string;
  description: string;
  price: number;
  sku: string;
  categories: string[];
  collections: string[];
  tags: string[];
  asset: string;
  seoTitle: string;
  seoDescription: string;
}): Product => ({
  handle: opts.handle,
  title: opts.title,
  description: opts.description,
  status: 'active',
  productType: 'Book',
  vendor: opts.author,
  tags: opts.tags,
  categoryHandles: opts.categories,
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [FORMAT],
  variants: [
    { sku: `${opts.sku}-PB`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Format: 'Paperback' } },
    { sku: `${opts.sku}-HC`, priceCents: money(opts.price + 9), inventoryPolicy: 'continue', optionValues: { Format: 'Hardcover' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: `${opts.title} by ${opts.author}` }],
});

const PRODUCTS: Product[] = [
  book({
    handle: 'the-glass-orchard',
    title: 'The Glass Orchard',
    author: 'Ada Sorensen',
    description:
      'A luminous novel about three sisters who inherit a failing greenhouse and the secret their late father grew inside it. Sorensen writes like sunlight through glass — warm, exact, quietly dazzling. The new release the whole team fought over first, and our clearest pick of the season.',
    price: 19,
    sku: 'VOL-GLASS',
    categories: ['new-releases', 'fiction'],
    collections: ['new-releases', 'staff-picks', 'the-fiction-shelf'],
    tags: ['fiction', 'literary', 'new-release', 'staff-pick'],
    asset: 'prod-glass-orchard',
    seoTitle: 'The Glass Orchard by Ada Sorensen | Volume Books',
    seoDescription: 'A luminous new novel about three sisters, a failing greenhouse and the secret inside it. A Volume staff pick.',
  }),
  book({
    handle: 'northbound',
    title: 'Northbound',
    author: 'Cass Merrin',
    description:
      'A propulsive literary thriller about a night-train guard who realises the same passenger has boarded every run for a month. Merrin keeps the screws turning without ever cheating you — taut, atmospheric, and impossible to put down past chapter three. Clear your evening.',
    price: 18,
    sku: 'VOL-NORTH',
    categories: ['new-releases', 'fiction'],
    collections: ['new-releases', 'the-fiction-shelf'],
    tags: ['fiction', 'thriller', 'new-release'],
    asset: 'prod-northbound',
    seoTitle: 'Northbound by Cass Merrin | Volume Books',
    seoDescription: 'A propulsive night-train thriller about a passenger who boards every run. Taut, atmospheric, unputdownable.',
  }),
  book({
    handle: 'static-and-signal',
    title: 'Static & Signal',
    author: 'Priya Anand',
    description:
      'Twelve stories about connection in a wired world — a help-line worker, a viral stranger, a marriage conducted mostly in read receipts. Anand is funny and precise and never cruel, and this is the collection we hand to people who claim they don’t read short stories.',
    price: 17,
    sku: 'VOL-STATIC',
    categories: ['fiction'],
    collections: ['staff-picks', 'the-fiction-shelf'],
    tags: ['fiction', 'short-stories', 'staff-pick'],
    asset: 'prod-static-signal',
    seoTitle: 'Static & Signal by Priya Anand | Volume Books',
    seoDescription: 'Twelve funny, precise stories about connection in a wired world. For people who claim they don’t read short stories.',
  }),
  book({
    handle: 'the-attention-diet',
    title: 'The Attention Diet',
    author: 'Rowan Vesper',
    description:
      'A clear, refreshingly un-preachy look at what our attention is actually worth and how to spend it better — grounded in real research, written like a good conversation. No shame, no ten-step app detox, just a smarter way to think about the thing everyone’s selling. The nonfiction we keep re-ordering.',
    price: 23,
    sku: 'VOL-ATTN',
    categories: ['new-releases', 'nonfiction'],
    collections: ['new-releases', 'staff-picks', 'the-nonfiction-shelf'],
    tags: ['nonfiction', 'ideas', 'new-release', 'staff-pick'],
    asset: 'prod-attention-diet',
    seoTitle: 'The Attention Diet by Rowan Vesper | Volume Books',
    seoDescription: 'A clear, un-preachy look at what our attention is worth and how to spend it better. Grounded in real research.',
  }),
  book({
    handle: 'deep-time-bright-water',
    title: 'Deep Time, Bright Water',
    author: 'Malik Osei',
    description:
      'A geologist’s love letter to rivers — how they carve deep time into a landscape, and what they carry of us downstream. Osei braids field science with memoir so gracefully you barely notice you’re learning, and you’ll never look at a stream the same way. Genuinely readable science at its best.',
    price: 25,
    sku: 'VOL-DEEP',
    categories: ['nonfiction'],
    collections: ['the-nonfiction-shelf'],
    tags: ['nonfiction', 'science', 'nature'],
    asset: 'prod-deep-time',
    seoTitle: 'Deep Time, Bright Water by Malik Osei | Volume Books',
    seoDescription: 'A geologist’s love letter to rivers — field science braided with memoir. Readable science at its best.',
  }),
  book({
    handle: 'otto-and-the-midnight-library',
    title: 'Otto and the Midnight Library',
    author: 'Lena Brightwater',
    description:
      'A gorgeous picture book about a small bear who discovers the library comes alive after closing time — and that the quietest reader can be the bravest hero. Brightwater’s art glows, and the read-aloud rhythm is a bedtime dream. For ages 3–7, and for any grown-up who loves a library.',
    price: 15,
    sku: 'VOL-OTTO',
    categories: ['kids'],
    collections: ['for-young-readers', 'staff-picks'],
    tags: ['kids', 'picture-book', 'staff-pick'],
    asset: 'prod-otto',
    seoTitle: 'Otto and the Midnight Library by Lena Brightwater | Volume Books',
    seoDescription: 'A glowing picture book about a small bear, a library that wakes at midnight, and quiet bravery. Ages 3–7.',
  }),
  book({
    handle: 'the-sock-robbers',
    title: 'The Sock Robbers',
    author: 'Dax Pell',
    description:
      'The funniest chapter book on our kids’ shelf: a gang of sock-stealing gremlins, one determined nine-year-old, and a mystery that unravels one odd sock at a time. Short chapters, big laughs, and just enough heart to sneak past a reluctant reader. For ages 7–10.',
    price: 13,
    sku: 'VOL-SOCK',
    categories: ['kids'],
    collections: ['for-young-readers'],
    tags: ['kids', 'chapter-book', 'funny'],
    asset: 'prod-sock-robbers',
    seoTitle: 'The Sock Robbers by Dax Pell | Volume Books',
    seoDescription: 'A very funny kids chapter book about sock-stealing gremlins and one determined nine-year-old. Ages 7–10.',
  }),
  {
    handle: 'volume-enamel-pin-set',
    title: 'Volume Reader Pin Set',
    description:
      'Three hard-enamel pins for the shelf-proud reader — a tiny stack of books, an open cover, and our little "V" mark — on a printed backing card that’s a small gift in itself. Bright, sturdy, and cheerfully collectable. The easy add-on that makes any order feel like a treat.',
    status: 'active',
    productType: 'Accessory',
    vendor: 'Volume Books',
    tags: ['gift', 'pin', 'accessory'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts-for-readers'],
    seoTitle: 'Volume Reader Pin Set — three enamel pins | Volume Books',
    seoDescription: 'Three bright hard-enamel pins for the shelf-proud reader, on a printed backing card. A cheerful little gift.',
    variants: [{ sku: 'VOL-PINS', priceCents: money(14), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-pins', isPrimary: true, alt: 'A set of three enamel reading pins on a card' }],
  },
  {
    handle: 'clip-reading-light',
    title: 'Clip Reading Light',
    description:
      'A slim, rechargeable clip-on light that warms up or cools down to suit the page — bright enough to read by, dim enough not to wake anyone. Clamps onto a paperback or a hardcover without marking it, folds flat, and runs for weeks on a charge. The gift every night-owl reader secretly wants.',
    status: 'active',
    productType: 'Accessory',
    vendor: 'Volume Books',
    tags: ['gift', 'reading-light', 'accessory'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts-for-readers'],
    seoTitle: 'Clip Reading Light — warm/cool rechargeable book light | Volume Books',
    seoDescription: 'A slim rechargeable clip-on reading light, warm or cool, bright enough to read by and dim enough not to wake anyone.',
    variants: [{ sku: 'VOL-LIGHT', priceCents: money(26), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-light', isPrimary: true, alt: 'A slim clip-on reading light on an open book' }],
  },
  {
    handle: 'volume-reading-subscription',
    title: 'Volume Reading Subscription',
    description:
      'One hand-picked book on your doorstep every month — tell us what you’re into and we choose something we’d actually press on you, wrap it, and post it with a note on why. Fiction, nonfiction, or a bit of both; pause, swap or cancel any time. The gift that keeps someone reading widely all year.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Volume Books',
    tags: ['subscription', 'gift', 'book-club'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts-for-readers', 'staff-picks'],
    seoTitle: 'Volume Reading Subscription — a hand-picked book, monthly | Volume Books',
    seoDescription: 'A hand-picked book on your doorstep every month, wrapped with a note on why we chose it. Pause or cancel any time.',
    options: [
      { name: 'Reading', displayType: 'dropdown', values: [{ value: 'Fiction' }, { value: 'Nonfiction' }, { value: 'Surprise me' }] },
    ],
    variants: [
      { sku: 'VOL-SUB-FIC', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue', optionValues: { Reading: 'Fiction' } },
      { sku: 'VOL-SUB-NON', priceCents: money(18), inventoryPolicy: 'continue', optionValues: { Reading: 'Nonfiction' } },
      { sku: 'VOL-SUB-MIX', priceCents: money(18), inventoryPolicy: 'continue', optionValues: { Reading: 'Surprise me' } },
    ],
    images: [{ assetId: 'prod-subscription', isPrimary: true, alt: 'A monthly reading subscription parcel' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'new-releases', name: 'New releases', description: 'Just landed on the front table.', featured: true },
    { handle: 'fiction', name: 'Fiction', description: 'Novels and short stories.', featured: true },
    { handle: 'nonfiction', name: 'Nonfiction', description: 'Ideas, science, nature and more.', featured: true },
    { handle: 'kids', name: 'Kids', description: 'Picture books and chapter books.', featured: true },
    { handle: 'gifts', name: 'Gifts', description: 'For the readers in your life.', featured: true },
  ],
  collections: [
    {
      handle: 'new-releases',
      name: 'Just landed',
      description: 'The freshest arrivals on the front table.',
      type: 'manual',
      featured: true,
      productHandles: ['the-glass-orchard', 'northbound', 'the-attention-diet'],
    },
    {
      handle: 'staff-picks',
      name: 'What we’re reading',
      description: 'The team’s current favourites, read cover to cover.',
      type: 'manual',
      featured: true,
      productHandles: ['the-glass-orchard', 'static-and-signal', 'the-attention-diet', 'otto-and-the-midnight-library', 'volume-reading-subscription'],
    },
    {
      handle: 'the-fiction-shelf',
      name: 'The fiction shelf',
      description: 'Novels and short stories we stand behind.',
      type: 'manual',
      featured: false,
      productHandles: ['the-glass-orchard', 'northbound', 'static-and-signal'],
    },
    {
      handle: 'the-nonfiction-shelf',
      name: 'The nonfiction shelf',
      description: 'Ideas, science and nature worth your time.',
      type: 'manual',
      featured: false,
      productHandles: ['the-attention-diet', 'deep-time-bright-water'],
    },
    {
      handle: 'for-young-readers',
      name: 'For young readers',
      description: 'Picture books and chapter books for the kids’ corner.',
      type: 'manual',
      featured: false,
      productHandles: ['otto-and-the-midnight-library', 'the-sock-robbers'],
    },
    {
      handle: 'gifts-for-readers',
      name: 'Gifts for readers',
      description: 'Pins, a reading light and the monthly subscription.',
      type: 'manual',
      featured: false,
      productHandles: ['volume-enamel-pin-set', 'clip-reading-light', 'volume-reading-subscription'],
    },
  ],
  products: PRODUCTS,
};

// ── Content (the journal) ────────────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'what-were-reading-now',
    status: 'published',
    body: {
      title: 'What we’re reading now',
      excerpt: 'The books on our front table this month, and the one-line reason each earned its spot. Steal our taste — that’s what it’s there for.',
      featuredImage: { $asset: 'post-new-releases' },
      body: {
        type: 'doc',
        content: [
          para('A staff pick at Volume isn’t whatever a publisher paid to stack by the door, and it isn’t a bestseller chart doing the thinking for us. It’s one person on the team saying, in a single honest line, "I read this, I loved it, and here’s who it’s for." Here’s what’s facing out this month, and why.'),
          h2('The one we fought over'),
          para('The Glass Orchard got the front-and-centre spot the day it arrived — a luminous novel about three sisters and a failing greenhouse that reads like sunlight through glass. If you like a family story that’s warm without being soft, start here. Pair it with Static & Signal, twelve funny, precise stories that will convert anyone who swears they don’t read short fiction.'),
          h2('For the nonfiction shelf'),
          para('The Attention Diet is the book we can’t stop pressing on people — a clear, un-preachy look at what our attention is actually worth, with none of the shame. Follow it with Deep Time, Bright Water if you want science that reads like a memoir, or hand either to the person on your list who "doesn’t really read nonfiction." They will, after this.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'how-to-actually-read-more-this-year',
    status: 'published',
    body: {
      title: 'How to actually read more this year',
      excerpt: 'No 100-book challenge, no guilt. A few small, genuinely useful habits from people who read for a living — and one shortcut we might be biased about.',
      featuredImage: { $asset: 'post-reading-year' },
      body: {
        type: 'doc',
        content: [
          para('Every January the internet tells you to read fifty books, then makes you feel bad in March for reading four. We think that’s backwards. Reading more isn’t a target to hit; it’s a handful of small frictions to remove. Here’s what actually works, from a shop full of people who read constantly and still fall off the wagon.'),
          h2('Make the next book easy to reach'),
          para('The single biggest lever is having the right book already in your hand when you have a spare ten minutes. Keep one going in every place you wait — a paperback in your bag, something on your phone, a picture book by the kids’ bed. And give yourself permission to quit a book that isn’t working; the fastest way to read more is to stop finishing things out of duty.'),
          h2('Let someone else choose sometimes'),
          para('Decision fatigue kills more reading streaks than busyness does. When you can’t face picking, let a bookseller do it — that’s literally the job. Our monthly subscription exists for exactly this: one hand-picked book lands each month, wrapped, with a note on why, and you just… read it. No browsing, no overwhelm, no lapsed streak. Yes, we’re biased. We’re also right.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'why-a-bookshop-still-matters',
    status: 'published',
    body: {
      title: 'Why a bookshop still matters',
      excerpt: 'The same book costs about the same everywhere. What changes is everything around it — the person, the room, and where your money goes next.',
      featuredImage: { $asset: 'post-modern-bookshop' },
      body: {
        type: 'doc',
        content: [
          para('Let’s be straight about the thing everyone’s thinking: yes, you can usually get these books cheaper, faster, and without leaving the sofa. We’re not going to pretend otherwise, and we’re not going to guilt-trip you about it. What we’ll argue is that the number on the back cover isn’t the whole cost, and the book isn’t the whole thing you’re buying.'),
          h2('You’re buying taste, not just a title'),
          para('A recommendation engine can tell you what people who bought this also bought. It can’t finish a novel, sit with it for a day, and decide who in your life needs it. That’s what our picks are — a real person’s taste, made useful, with a name behind it. Come in undecided and you’ll leave with something better than what you came for, more often than not. That’s the whole trick, and no amount of software has cracked it yet.'),
          h2('Where the money goes next'),
          para('A dollar spent here stays close to home a lot longer than a dollar spent in a warehouse three states away. It pays the booksellers who read the books, keeps the lights on in a room you can actually stand in, and funds the author nights, the school orders and the kids’ story hour that no marketplace will ever bother to run. A good bookshop is quiet infrastructure for a reading town — and it only exists if people choose to use it.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-bookstore-modern',
  key: 'sparx-retail-bookstore-modern',
  name: 'sparx — Modern Bookshop',
  theme: THEME,
  summary:
    'A complete, working shop for a bright, contemporary bookshop: a real catalogue of new releases, fiction, nonfiction and books for young readers, plus an enamel-pin set, a clip reading light and a monthly reading subscription — with categories, collections, a bespoke cover-forward PDP and a full merchandised home page led by new releases. Crisp modern theme — a near-white ground, a confident blue, a coral accent, a clean grotesk display. Shipped as Volume Books.',
  tagline: 'A bright, working storefront for a modern bookshop.',
  vertical: 'retail',
  industry: 'Modern bookshop',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 86,
  brand: {
    businessName: 'Volume Books',
    tagline: 'The good stuff, up front.',
  },
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Volume Books — a modern bookshop with the good stuff up front',
      description:
        'Volume is a bright, contemporary bookshop — new releases, fiction and nonfiction, books for young readers, and a monthly reading subscription. The best of what we read, faced out, with a note on why.',
    },
    about: {
      title: 'About Volume Books',
      description:
        'How Volume chooses and displays books — small presses and big houses alike, the best of what we read faced out, and a real recommendation on everything, with none of the overwhelm.',
    },
  },
  home: HOME,
  shop: SHOP,
  collections: COLLECTIONS,
  cart: CART,
  search: SEARCH,
  journal: JOURNAL,
  pdp: PDP,
  about: ABOUT,
  contact: CONTACT,
  commerce: COMMERCE,
  content: CONTENT,
  assets: ASSETS,
};

// ── Main ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
  const { dir, theme } = await emitBundle(SPEC);
  console.log(`· wrote bundle → ${dir}`);

  const mod = (await import(pathToFileURL(join(dir, 'blueprint.ts')).href)) as { default: unknown };
  const result = safeParseBlueprint(mod.default);
  if (result.success) {
    console.log('· safeParseBlueprint → VALID');
  } else {
    console.error('· safeParseBlueprint → INVALID');
    for (const issue of result.issues) console.error(`    ${issue.path}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }

  const { path: previewPath } = await writeTemplatePreview(SPEC, theme);
  console.log(`· preview → ${previewPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
