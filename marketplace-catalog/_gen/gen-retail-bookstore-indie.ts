// sparx-retail-bookstore-indie — a RETAIL/COMMERCE site template: an independent bookshop.
//
// A complete, working shop the moment it installs — a real catalogue of staff-picked books
// (invented titles + authors), a canvas tote, a bookmark set, a gift card and a book-club
// subscription — with categories + collections, a bespoke literary PDP, the full 9-page
// commerce site (home merchandising → shop → collections → cart → search → journal → about →
// contact), dressed in an INLINE bespoke theme (warm foxed-paper cream + deep oxblood primary
// + ink accent, a characterful serif display over a readable text serif). Shipped as
// Marginalia Books.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries its OWN
// theme inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The
// shared `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-bookstore-indie.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-bookstore-indie/**" \
//     "marketplace-catalog/_gen/gen-retail-bookstore-indie.ts"
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
// Foxed paper: a warm cream ground gone a little brown at the edges, deep ink-brown text, a
// deep OXBLOOD primary and an ink-red accent for rubrics and links, under a characterful
// serif display (Fraunces) over a readable text serif (Spectral). Complete light + dark, AA on
// every role (the blueprint sweep's contrast check is the gate). `secondary` is a dark, legible
// ink-brown on light.
const THEME = defineTheme({
  name: 'foxed-paper',
  type: { body: face('Spectral', 'serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.375rem', field: '0.25rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: ['oklch(96% 0.02 82)', 'oklch(93% 0.026 78)', 'oklch(88% 0.034 74)', 'oklch(23% 0.03 55)'],
    roles: {
      primary: 'oklch(38% 0.12 26)',
      secondary: 'oklch(40% 0.05 48)',
      accent: 'oklch(46% 0.15 30)',
      neutral: 'oklch(26% 0.03 50)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(20% 0.02 50)', 'oklch(17% 0.02 50)', 'oklch(14% 0.02 50)', 'oklch(94% 0.02 82)'],
    roles: {
      primary: 'oklch(72% 0.13 28)',
      secondary: 'oklch(78% 0.05 60)',
      accent: 'oklch(74% 0.14 30)',
      neutral: 'oklch(30% 0.02 50)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "marg-hero": "https://images.unsplash.com/photo-1525358180237-7399f908a1d9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym9va3NlbGxlciUyMHNoZWx2aW5nJTIwc3BpbmVzfGVufDB8MHx8fDE3ODY0MDI1NzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "marg-tile-fiction": "https://images.unsplash.com/photo-1530449561329-34cad7b30266?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2hlbGYlMjBmaWN0aW9uJTIwc3BpbmVzJTIwb3V0JTIwd2FybSUyMGxhbXBsaWdodHxlbnwwfDB8fHwxNzg2NDAyMjk1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "marg-tile-nonfiction": "https://images.unsplash.com/photo-1516979187457-637abb4f9353?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBub25maWN0aW9uJTIwaGFyZGNvdmVycyUyMHdvb2RlbiUyMHRhYmxlfGVufDB8MHx8fDE3ODY0MDIyOTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "marg-tile-gifts": "https://images.unsplash.com/photo-1758708536099-9f46dc81fffc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FudmFzJTIwdG90ZSUyMGJvb2ttYXJrcyUyMGxhaWQlMjBvdXQlMjBhcyUyMHJlYWRlcnxlbnwwfDB8fHwxNzg2NDAyMzAzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "marg-band-staff": "https://images.unsplash.com/photo-1545696648-86c761bc5410?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym9va3NlbGxlciUyMHdyaXRpbmclMjBzaGVsZi10YWxrZXJ8ZW58MHwwfHx8MTc4NjQwMjU3N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "marg-band-club": "https://images.unsplash.com/photo-1577138230503-0a95a59234a3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d3JhcHBlZCUyMGJvb2slMjBsZWZ0JTIwY2FyZCUyMHJlYWR5JTIwcG9zdCUyMHN1YnNjcmliZXJ8ZW58MHwwfHx8MTc4NjQwMjMwOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-salt": "https://images.unsplash.com/photo-1555252586-d77e8c828e41?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFwZXJiYWNrJTIwY292ZXIlMjBzYWx0JTIwaGVyJTIwbmFtZXxlbnwwfDB8fHwxNzg2NDAyMzEyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-tin": "https://images.unsplash.com/photo-1759373304660-8fb62da562a8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8cGFwZXJiYWNrJTIwY292ZXIlMjB0aW4lMjBjZWlsaW5nc3xlbnwwfDB8fHwxNzg2NDAyMzE1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-hours": "https://images.unsplash.com/photo-1592671191757-c73712620c4a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFwZXJiYWNrJTIwY292ZXIlMjBzbWFsbCUyMGhvdXJzfGVufDB8MHx8fDE3ODY0MDIzMTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-field": "https://images.unsplash.com/photo-1716892001657-722e6e14ae29?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFwZXJiYWNrJTIwY292ZXIlMjBmaWVsZCUyMGd1aWRlJTIwbGVhdmluZ3xlbnwwfDB8fHwxNzg2NDAyMzIyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cities": "https://images.unsplash.com/photo-1532300481631-0bc14f3b7699?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFyZGNvdmVyJTIwaG93JTIwY2l0aWVzJTIwYnJlYXRoZXxlbnwwfDB8fHwxNzg2NDAyMzI1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-root": "https://images.unsplash.com/photo-1461901962772-f84d69049806?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFyZGNvdmVyJTIwcm9vdCUyMGJyYW5jaHxlbnwwfDB8fHwxNzg2NDAyMzI3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-tote": "https://images.unsplash.com/photo-1574365569389-a10d488ca3fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmF0dXJhbCUyMGNhbnZhcyUyMHRvdGV8ZW58MHwwfHx8MTc4NjQwMjU4MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-bookmark": "https://images.unsplash.com/photo-1699662585297-8bcb021fd94c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwZml2ZSUyMGxldHRlcnByZXNzJTIwYm9va21hcmtzJTIwZmFubmVkJTIwb3V0fGVufDB8MHx8fDE3ODY0MDIzMzN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-club": "https://images.unsplash.com/photo-1670540805686-a73a025c0dd1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym9vay1jbHViJTIwcGFyY2VsJTIwd3JhcHBlZCUyMGtyYWZ0JTIwcGFwZXIlMjB0d2luZXxlbnwwfDB8fHwxNzg2NDAyMzM4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-staff": "https://images.unsplash.com/photo-1724005147060-508fe43607aa?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHdyaXR0ZW4lMjBzaGVsZi10YWxrZXIlMjBjYXJkcyUyMHR1Y2tlZCUyMGJlbmVhdGglMjBib29rJTIwY292ZXJzfGVufDB8MHx8fDE3ODY0MDIzNDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-fall": "https://images.unsplash.com/photo-1636140820128-7e9d29ccd6cf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBhdXR1bW4lMjByZWFkaW5nJTIwYmVzaWRlJTIwbXVnJTIwd2luZG93c2lsbHxlbnwwfDB8fHwxNzg2NDAyMzQ2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-indie": "https://images.unsplash.com/photo-1588638873871-636d9d4aa27b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RvcmVmcm9udCUyMGluZGVwZW5kZW50JTIwYm9va3Nob3AlMjBkdXNrfGVufDB8MHx8fDE3ODY0MDIzNDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'marg-hero', url: src('marg-hero'), alt: 'A bookseller shelving spines in a warm, crowded independent bookshop' },
  { id: 'marg-tile-fiction', url: src('marg-tile-fiction'), alt: 'A shelf of fiction, spines out, in warm lamplight' },
  { id: 'marg-tile-nonfiction', url: src('marg-tile-nonfiction'), alt: 'A stack of nonfiction hardcovers on a wooden table' },
  { id: 'marg-tile-staff', url: src('marg-tile-staff'), alt: 'A staff-picks table with handwritten shelf-talker cards' },
  { id: 'marg-tile-gifts', url: src('marg-tile-gifts'), alt: 'A canvas tote and bookmarks laid out as reader gifts' },
  { id: 'marg-band-staff', url: src('marg-band-staff'), alt: 'A bookseller writing a shelf-talker card at the counter' },
  { id: 'marg-band-club', url: src('marg-band-club'), alt: 'A wrapped book left with a card, ready to post to a subscriber' },
  { id: 'prod-salt', url: src('prod-salt'), alt: 'The paperback cover of The Salt in Her Name' },
  { id: 'prod-tin', url: src('prod-tin'), alt: 'The paperback cover of Tin Ceilings' },
  { id: 'prod-hours', url: src('prod-hours'), alt: 'The paperback cover of Small Hours' },
  { id: 'prod-field', url: src('prod-field'), alt: 'The paperback cover of A Field Guide to Leaving' },
  { id: 'prod-cities', url: src('prod-cities'), alt: 'The hardcover of How Cities Breathe' },
  { id: 'prod-root', url: src('prod-root'), alt: 'The hardcover of Root and Branch' },
  { id: 'prod-tote', url: src('prod-tote'), alt: 'A natural canvas tote printed with the Marginalia mark' },
  { id: 'prod-bookmark', url: src('prod-bookmark'), alt: 'A set of five letterpress bookmarks fanned out' },
  { id: 'prod-giftcard', url: src('prod-giftcard'), alt: 'A Marginalia Books gift card on a wooden counter' },
  { id: 'prod-club', url: src('prod-club'), alt: 'A book-club parcel wrapped in kraft paper and twine' },
  { id: 'post-staff', url: src('post-staff'), alt: 'Handwritten shelf-talker cards tucked beneath book covers' },
  { id: 'post-fall', url: src('post-fall'), alt: 'A stack of autumn reading beside a mug on a windowsill' },
  { id: 'post-indie', url: src('post-indie'), alt: 'The storefront of an independent bookshop at dusk' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-bookstore-indie: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm photograph, a serif headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('marg-hero'), alt: 'A bookseller shelving spines in a warm bookshop', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Books we loved, hand-sold.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Marginalia is a small independent bookshop. We read far more than we can shelve, keep the ones that stayed with us, and tuck a card under each so you know exactly why. Come in for one book and leave with three.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the shelves' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop/the-marginalia-book-club' },
                      text: 'Join the book club',
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
            text: 'Where to start',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'marg-tile-staff', label: 'Staff picks', href: '/shop', alt: 'A staff-picks table with shelf-talker cards' }),
              categoryTile({ assetId: 'marg-tile-fiction', label: 'Fiction', href: '/shop', alt: 'A shelf of fiction in warm light' }),
              categoryTile({ assetId: 'marg-tile-nonfiction', label: 'Nonfiction', href: '/shop', alt: 'A stack of nonfiction hardcovers' }),
              categoryTile({ assetId: 'marg-tile-gifts', label: 'Gifts', href: '/shop', alt: 'A tote and bookmarks for readers' }),
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
  productsBlock({ source: 'commerce.category.staff-picks', layout: 'carousel', heading: 'What we’re handing people this month' }),
  categoryTiles(),
  editorialBand({
    heading: 'A card under every spine',
    lead: 'A shelf-talker is a small handwritten card that says, in plain words, why a bookseller loved a book and who it’s for. We write one for everything we recommend — so a stranger’s taste becomes something you can actually use.',
    assetId: 'marg-band-staff',
    cta: 'How we choose',
    href: '/blog/how-we-choose-staff-picks',
    alt: 'A bookseller writing a shelf-talker card',
  }),
  productsBlock({ source: 'commerce.category.fiction', layout: 'carousel', heading: 'New in fiction' }),
  productsBlock({ source: 'commerce.category.nonfiction', layout: 'carousel', heading: 'New in nonfiction' }),
  editorialBand({
    heading: 'A book on your doorstep, monthly',
    lead: 'The Marginalia Book Club is the easy way to keep reading widely: tell us what you like, and each month we choose a book we’d press into your hands ourselves, wrap it, and post it — with the card that says why. Skip or cancel any time.',
    assetId: 'marg-band-club',
    cta: 'Join the book club',
    href: '/shop/the-marginalia-book-club',
    alt: 'A wrapped book ready to post to a subscriber',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the cover image. Right: the buy column (shop rubric, title, price, low-stock,
 *  description, add-to-cart, a hand-sold "why we love it" note, and policy links). */
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
                  el('p', 'text-sm font-semibold uppercase tracking-widest text-secondary', {
                    text: 'Marginalia Books',
                  }),
                  pdpTitle('h1', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl'),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-semibold text-base-content',
                    compareClass: 'text-lg text-secondary line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 rounded-field border border-base-300 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-base-content',
                    label: 'Last few copies',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Why we love it' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Everything we sell has been read by someone here, and everything we recommend gets a card. Ask us at the counter or in your order notes and we’ll tell you what to read next — a real bookseller, not an algorithm.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'If you liked this' });

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
    'The shelves',
    'Everything on the tables right now — staff picks, new fiction and nonfiction, and gifts for the readers in your life. Filter by shelf, or sort however you like; if you can’t decide, that’s what the shelf-talkers are for.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Tables', 'The books grouped the way we actually pile them on the tables — this month’s staff picks, what’s new this season, the fiction shelf, the nonfiction shelf, and gifts for readers.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Marginalia', 'Looking for a title, an author, or a subject? Search the whole shop and the journal below — and if we don’t have it, we can almost always order it in.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your basket' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $40, and we’ll gift-wrap anything on request — just say so in the notes. Every order is packed by hand at the shop, usually the same day.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Marginalia journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Reading lists, staff picks and the odd argument about why a bookshop with a person in it still matters. Written by the people who shelve the books.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Marginalia' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Marginalia opened in a narrow shop with a wobbly front table and a hand-lettered sign, on the simple bet that people still want a bookseller who has actually read the thing. It grew the slow way — one recommendation, one regular, one book-club box at a time — and it still runs on the same idea: read widely, keep the good ones, and say honestly why.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We buy from small presses and big houses alike, because a good book is a good book whoever printed it. What we won’t do is pretend to like something to move a stack. Every shelf-talker in the shop is signed by whoever wrote it, and we stand behind all of them.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No bestseller wall you could find anywhere, no plastic-wrapped mystery, no book we couldn’t tell you something true about. Just a room full of things worth reading, and someone on hand who’s read them.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Say hello' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Chasing a title, planning an event, or want a recommendation for someone impossible to buy for? Tell us what you’re after and a real bookseller will write back — we love this part.',
          }),
          el('a', 'btn btn-primary btn-lg', { attrs: { href: 'mailto:hello@marginaliabooks.example' }, text: 'Email the shop' }),
        ],
      }),
    ],
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

// Every book ships in two bindings at the same shelf price — a paperback and a hardcover —
// the way a bookshop actually stocks a title.
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
    { sku: `${opts.sku}-HC`, priceCents: money(opts.price + 10), inventoryPolicy: 'continue', optionValues: { Format: 'Hardcover' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: `${opts.title} by ${opts.author}` }],
});

const PRODUCTS: Product[] = [
  book({
    handle: 'the-salt-in-her-name',
    title: 'The Salt in Her Name',
    author: 'Marisol Vane',
    description:
      'A debut novel about a woman who returns to a fishing town to bury a mother she barely knew, and stays to untangle a family that would rather she didn’t. Salt-scoured, quietly furious, and tender in the places you don’t expect — the book the whole shop pressed on each other first.',
    price: 18,
    sku: 'MARG-SALT',
    categories: ['fiction', 'staff-picks'],
    collections: ['staff-picks', 'new-this-season', 'the-fiction-shelf'],
    tags: ['fiction', 'literary', 'debut', 'staff-pick'],
    asset: 'prod-salt',
    seoTitle: 'The Salt in Her Name by Marisol Vane | Marginalia Books',
    seoDescription: 'A salt-scoured debut novel about grief, family and a town that keeps its secrets. A Marginalia staff pick.',
  }),
  book({
    handle: 'tin-ceilings',
    title: 'Tin Ceilings',
    author: 'Odell Frayne',
    description:
      'Three decades in a shrinking mill town, told through the tenants of one crooked apartment block. Frayne writes ordinary lives with the patience of someone who has actually lived one — funny, unshowy, and by the last chapter, quietly devastating.',
    price: 17,
    sku: 'MARG-TIN',
    categories: ['fiction'],
    collections: ['new-this-season', 'the-fiction-shelf'],
    tags: ['fiction', 'literary'],
    asset: 'prod-tin',
    seoTitle: 'Tin Ceilings by Odell Frayne | Marginalia Books',
    seoDescription: 'Three decades of ordinary lives in one crooked apartment block — funny, patient and quietly devastating.',
  }),
  book({
    handle: 'small-hours',
    title: 'Small Hours',
    author: 'Junia Belec',
    description:
      'Eleven short stories set between midnight and dawn — a night nurse, a locksmith, a woman who can’t stop driving. Belec is a miniaturist of the sleepless hours, and every one of these lands like a held breath. Perfect for readers who think they don’t like short stories.',
    price: 16,
    sku: 'MARG-HOURS',
    categories: ['fiction', 'staff-picks'],
    collections: ['staff-picks', 'the-fiction-shelf'],
    tags: ['fiction', 'short-stories', 'staff-pick'],
    asset: 'prod-hours',
    seoTitle: 'Small Hours by Junia Belec | Marginalia Books',
    seoDescription: 'Eleven short stories set between midnight and dawn. For readers who think they don’t like short stories.',
  }),
  book({
    handle: 'a-field-guide-to-leaving',
    title: 'A Field Guide to Leaving',
    author: 'Perrin Yao',
    description:
      'A memoir in the shape of a naturalist’s notebook: every chapter is a species — the swift, the eel, the monarch — and a way of departing. Yao braids migration science with the year they left a marriage and a country, and it is one of the most quietly hopeful books we’ve read in ages.',
    price: 19,
    sku: 'MARG-FIELD',
    categories: ['nonfiction', 'staff-picks'],
    collections: ['staff-picks', 'new-this-season', 'the-nonfiction-shelf'],
    tags: ['nonfiction', 'memoir', 'nature', 'staff-pick'],
    asset: 'prod-field',
    seoTitle: 'A Field Guide to Leaving by Perrin Yao | Marginalia Books',
    seoDescription: 'A memoir in the shape of a naturalist’s notebook, braiding migration science with a year of departures.',
  }),
  book({
    handle: 'how-cities-breathe',
    title: 'How Cities Breathe',
    author: 'Tomas Ekhart',
    description:
      'A clear-eyed, genuinely readable account of what makes a street feel alive — light, width, corners, the humble bench — from an urbanist who’d rather show you than lecture. You’ll never walk your own neighbourhood the same way again. The nonfiction we keep re-ordering.',
    price: 24,
    sku: 'MARG-CITIES',
    categories: ['nonfiction'],
    collections: ['new-this-season', 'the-nonfiction-shelf'],
    tags: ['nonfiction', 'cities', 'design'],
    asset: 'prod-cities',
    seoTitle: 'How Cities Breathe by Tomas Ekhart | Marginalia Books',
    seoDescription: 'A clear, readable account of what makes a street feel alive — light, width, corners, the humble bench.',
  }),
  book({
    handle: 'root-and-branch',
    title: 'Root and Branch',
    author: 'Neave Calloway',
    description:
      'A year in an old orchard, and a history of the apple that turns out to be a history of us — trade, empire, obsession, and one grafting knife. Calloway is the rare nature writer who is also very funny. Hand it to anyone who thinks they’re not a "nature person".',
    price: 22,
    sku: 'MARG-ROOT',
    categories: ['nonfiction'],
    collections: ['the-nonfiction-shelf'],
    tags: ['nonfiction', 'nature', 'history'],
    asset: 'prod-root',
    seoTitle: 'Root and Branch by Neave Calloway | Marginalia Books',
    seoDescription: 'A year in an old orchard and a history of the apple that turns out to be a history of us.',
  }),
  {
    handle: 'marginalia-canvas-tote',
    title: 'Marginalia Canvas Tote',
    description:
      'A heavyweight natural-canvas tote screen-printed with our little mark, cut roomy enough for a hardcover and the three paperbacks you didn’t come in for. Made in small runs; flat-bottomed so it stands up on the counter. The bag you’ll actually reach for.',
    status: 'active',
    productType: 'Accessory',
    vendor: 'Marginalia Books',
    tags: ['gift', 'tote', 'accessory'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts-for-readers'],
    seoTitle: 'Marginalia Canvas Tote — a roomy book bag | Marginalia Books',
    seoDescription: 'A heavyweight natural-canvas tote, screen-printed and cut roomy enough for a stack of books.',
    variants: [{ sku: 'MARG-TOTE', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-tote', isPrimary: true, alt: 'A natural canvas Marginalia tote' }],
  },
  {
    handle: 'foxed-page-bookmark-set',
    title: 'The Foxed Page Bookmark Set',
    description:
      'Five letterpress bookmarks on thick cotton stock, each printed with a line we love about reading. Weighty enough to actually stay put, pretty enough to give away, cheap enough to lose one and not mind. The little thing that makes a nice gift complete.',
    status: 'active',
    productType: 'Accessory',
    vendor: 'Marginalia Books',
    tags: ['gift', 'bookmark', 'accessory'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts-for-readers'],
    seoTitle: 'The Foxed Page Bookmark Set — five letterpress bookmarks | Marginalia Books',
    seoDescription: 'Five letterpress bookmarks on thick cotton stock, each printed with a line we love about reading.',
    variants: [{ sku: 'MARG-BOOKMARK', priceCents: money(12), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-bookmark', isPrimary: true, alt: 'A set of five letterpress bookmarks' }],
  },
  {
    handle: 'marginalia-gift-card',
    title: 'Marginalia Gift Card',
    description:
      'The safest possible gift for a reader: a Marginalia gift card, redeemable in the shop or online against anything on the shelves. Delivered by email with a note you write, or printed on card to slip into a book — your choice. Never expires, never the wrong size.',
    status: 'active',
    productType: 'Gift card',
    vendor: 'Marginalia Books',
    tags: ['gift', 'gift-card'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts-for-readers'],
    seoTitle: 'Marginalia Gift Card — the safe gift for any reader | Marginalia Books',
    seoDescription: 'A Marginalia gift card redeemable in the shop or online. Delivered by email or printed on card.',
    options: [
      { name: 'Amount', displayType: 'dropdown', values: [{ value: '$25' }, { value: '$50' }, { value: '$100' }] },
    ],
    variants: [
      { sku: 'MARG-GC-25', priceCents: money(25), isDefault: true, inventoryPolicy: 'continue', optionValues: { Amount: '$25' } },
      { sku: 'MARG-GC-50', priceCents: money(50), inventoryPolicy: 'continue', optionValues: { Amount: '$50' } },
      { sku: 'MARG-GC-100', priceCents: money(100), inventoryPolicy: 'continue', optionValues: { Amount: '$100' } },
    ],
    images: [{ assetId: 'prod-giftcard', isPrimary: true, alt: 'A Marginalia Books gift card' }],
  },
  {
    handle: 'the-marginalia-book-club',
    title: 'The Marginalia Book Club',
    description:
      'A hand-picked book on your doorstep every month — tell us what you like, and we choose one we’d press into your hands ourselves, wrap it, and post it with the card that says why. Fiction, nonfiction, or a surprise mix; skip or cancel any time. The gift that keeps someone reading widely all year.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Marginalia Books',
    tags: ['subscription', 'gift', 'book-club'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts-for-readers', 'staff-picks'],
    seoTitle: 'The Marginalia Book Club — a hand-picked book, monthly | Marginalia Books',
    seoDescription: 'A hand-picked book on your doorstep every month, wrapped with the card that says why. Skip or cancel any time.',
    options: [
      { name: 'Reading', displayType: 'dropdown', values: [{ value: 'Fiction' }, { value: 'Nonfiction' }, { value: 'Surprise me' }] },
    ],
    variants: [
      { sku: 'MARG-CLUB-FIC', priceCents: money(16), isDefault: true, inventoryPolicy: 'continue', optionValues: { Reading: 'Fiction' } },
      { sku: 'MARG-CLUB-NON', priceCents: money(16), inventoryPolicy: 'continue', optionValues: { Reading: 'Nonfiction' } },
      { sku: 'MARG-CLUB-MIX', priceCents: money(16), inventoryPolicy: 'continue', optionValues: { Reading: 'Surprise me' } },
    ],
    images: [{ assetId: 'prod-club', isPrimary: true, alt: 'A book-club parcel wrapped in kraft paper' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'staff-picks', name: 'Staff picks', description: 'The books we’re hand-selling right now.', featured: true },
    { handle: 'fiction', name: 'Fiction', description: 'Novels and short stories.', featured: true },
    { handle: 'nonfiction', name: 'Nonfiction', description: 'Memoir, nature, cities and ideas.', featured: true },
    { handle: 'gifts', name: 'Gifts', description: 'For the readers in your life.', featured: true },
  ],
  collections: [
    {
      handle: 'staff-picks',
      name: 'This month’s staff picks',
      description: 'What we’re pressing on people this month.',
      type: 'manual',
      featured: true,
      productHandles: ['the-salt-in-her-name', 'small-hours', 'a-field-guide-to-leaving', 'the-marginalia-book-club'],
    },
    {
      handle: 'new-this-season',
      name: 'New this season',
      description: 'The freshest arrivals on the tables.',
      type: 'manual',
      featured: true,
      productHandles: ['tin-ceilings', 'how-cities-breathe', 'a-field-guide-to-leaving', 'the-salt-in-her-name'],
    },
    {
      handle: 'the-fiction-shelf',
      name: 'The fiction shelf',
      description: 'Novels and short stories we stand behind.',
      type: 'manual',
      featured: false,
      productHandles: ['the-salt-in-her-name', 'tin-ceilings', 'small-hours'],
    },
    {
      handle: 'the-nonfiction-shelf',
      name: 'The nonfiction shelf',
      description: 'Memoir, nature, cities and ideas.',
      type: 'manual',
      featured: false,
      productHandles: ['a-field-guide-to-leaving', 'how-cities-breathe', 'root-and-branch'],
    },
    {
      handle: 'gifts-for-readers',
      name: 'Gifts for readers',
      description: 'Totes, bookmarks, gift cards and the book club.',
      type: 'manual',
      featured: false,
      productHandles: ['marginalia-canvas-tote', 'foxed-page-bookmark-set', 'marginalia-gift-card', 'the-marginalia-book-club'],
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
    slug: 'how-we-choose-staff-picks',
    status: 'published',
    body: {
      title: 'How we choose a staff pick',
      excerpt: 'A shelf-talker is a promise with a name signed to it. Here’s what has to be true before a book gets one.',
      featuredImage: { $asset: 'post-staff' },
      body: {
        type: 'doc',
        content: [
          para('A staff pick isn’t a bestseller list and it isn’t whatever the publisher paid to stack by the door. It’s one bookseller saying, in their own handwriting, "I read this, I loved it, and here’s who it’s for." That last part is the whole job — a recommendation you can’t act on is just enthusiasm.'),
          h2('It has to be read, all the way through'),
          para('We don’t pick from the jacket copy or the first fifty pages. Somebody here finishes the book, sits with it for a day or two, and then decides whether they’d actually hand it to a stranger. Plenty of good books don’t make the table — not because they’re bad, but because none of us could honestly say who to give them to.'),
          h2('It has to say something true'),
          para('The card names the reader, not just the book: "for anyone who loved a quiet family novel," "for the friend who says they hate poetry." If we can’t finish that sentence, it isn’t a pick yet. And every card is signed, because a recommendation with a name on it is one someone will stand behind when you come back to tell us what you thought.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'ten-books-to-carry-you-into-autumn',
    status: 'published',
    body: {
      title: 'Ten books to carry you into autumn',
      excerpt: 'Shorter days, longer reads. A seasonal list from the tables — a novel to sink into, a memoir to slow down with, and one for the friend who’s hard to buy for.',
      featuredImage: { $asset: 'post-fall' },
      body: {
        type: 'doc',
        content: [
          para('Autumn is the reading season, and every year the tables tell us so — the moment the light shifts, people stop asking for a beach read and start asking for something to sink into. Here’s where we’d start this year, drawn from the books we’ve been quietly pushing on regulars all month.'),
          h2('To sink into'),
          para('If you want a novel to disappear inside, begin with The Salt in Her Name — a debut about grief and a town that keeps its secrets, salt-scoured and quietly furious. Follow it with Tin Ceilings, three decades of ordinary lives that sneaks up and breaks your heart on the last page. And if you swear you don’t like short stories, Small Hours will change your mind before the second one is done.'),
          h2('To slow down with'),
          para('For nonfiction, A Field Guide to Leaving is the one we can’t stop pressing on people — a memoir shaped like a naturalist’s notebook, hopeful in a way that sneaks up on you. Pair it with Root and Branch for a very funny year in an orchard, or How Cities Breathe if you’d like to never walk your own street the same way again. Wrap any of them with the book club and you’ve solved the hardest gift on your list.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'why-shop-an-independent-bookshop',
    status: 'published',
    body: {
      title: 'Why shop an independent bookshop',
      excerpt: 'The same book costs about the same everywhere. What changes is everything around it — the person, the room, and where your money goes after.',
      featuredImage: { $asset: 'post-indie' },
      body: {
        type: 'doc',
        content: [
          para('Let’s be honest about the thing everyone’s thinking: yes, you can get most of these books cheaper, faster, and without leaving the couch. We’re not going to pretend otherwise. What we’ll argue is that the price on the back isn’t the whole cost, and the book isn’t the whole thing you’re buying.'),
          h2('You’re buying a person who read it'),
          para('An algorithm can tell you what people who bought this also bought. It cannot finish a book, sit with it, and decide who in your life needs it. That’s what the shelf-talkers are — a stranger’s taste, made useful, with a name signed to it. Come in undecided and you’ll leave with something better than what you came for, more often than not.'),
          h2('Where the money goes'),
          para('A dollar spent here stays close to home for a lot longer than a dollar spent in a warehouse three states away. It pays the booksellers who read the books, keeps the lights on in a room you can actually stand in, and funds the author events, the school orders, and the kids’ story hour that no marketplace will ever run. A bookshop is infrastructure for a reading town — and it only exists if people use it.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-bookstore-indie',
  key: 'sparx-retail-bookstore-indie',
  name: 'sparx — Independent Bookshop',
  theme: THEME,
  summary:
    'A complete, working shop for an independent bookshop: a real catalogue of staff-picked books, a canvas tote, a bookmark set, a gift card and a hand-picked book-club subscription, with categories, collections, a bespoke literary PDP and a full merchandised home page led by staff picks. Warm foxed-paper theme — cream ground, deep oxblood, an ink accent on rubrics and links. Shipped as Marginalia Books.',
  tagline: 'A warm, working storefront for an independent bookshop.',
  vertical: 'retail',
  industry: 'Independent bookshop',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 87,
  brand: {
    businessName: 'Marginalia Books',
    tagline: 'Books we loved, hand-sold.',
  },
  chrome: { navbar: 'centerLinks', footer: 'newsletter', showCta: false },
  seo: {
    home: {
      title: 'Marginalia Books — an independent bookshop, hand-selling the ones we loved',
      description:
        'Marginalia is a small independent bookshop — staff-picked fiction and nonfiction, gifts for readers, and a hand-picked book club. Every recommendation gets a card that says why.',
    },
    about: {
      title: 'About Marginalia Books',
      description:
        'How Marginalia chooses, shelves and hand-sells books — small presses and big houses alike, a signed shelf-talker on everything we recommend, and nothing we couldn’t tell you something true about.',
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
