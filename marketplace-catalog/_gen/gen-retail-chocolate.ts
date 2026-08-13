// sparx-retail-chocolate — a RETAIL/COMMERCE site template: an artisan bean-to-bar chocolatier.
//
// A complete, working shop the moment it installs — a real catalogue of single-origin bars,
// truffle and confection boxes, a drinking-chocolate tin, a tasting library, gift sets and a
// flexible subscription, with categories + collections, a bespoke PDP, and the full 9-page
// commerce site (home merchandising → shop → collections → cart → search → journal → about →
// contact). Dressed in an INLINE bespoke theme: a rich, low-lit chocolate room — deep cocoa
// grounds, a burgundy primary, a warm gold accent, an elegant serif over a clean sans. Shipped
// as Cacao & Co.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries its OWN
// theme inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-chocolate.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-chocolate/**" \
//     "marketplace-catalog/_gen/gen-retail-chocolate.ts"
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
// A low-lit chocolate room. The page is DARK in both modes — a chocolatier's counter is a
// warm, dim place, and a bright white shop describes somewhere else — so surfaces separate
// by a base-200 shift + a border rather than by lift. Deep cocoa grounds, a warm cream ink,
// a rich BURGUNDY primary (a fill only, never text), a warm GOLD accent and a light mocha
// secondary (both used as text, so both stay light + legible on the dark ground). An elegant
// Playfair display over a clean Outfit sans. Bright status set in both modes (a deep status
// would vanish into a 20% ground); `error` moves off the burgundy hue so two warm reds stay
// two signals. Complete light + dark, AA on every role.
const THEME = defineTheme({
  name: 'cacao-artisan',
  type: { body: face('Outfit', 'sans-serif'), head: face('Playfair Display', 'serif') },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: ['oklch(23% 0.03 45)', 'oklch(19% 0.03 45)', 'oklch(15% 0.028 45)', 'oklch(93% 0.02 70)'],
    roles: {
      primary: 'oklch(50% 0.15 16)',
      secondary: 'oklch(74% 0.05 55)',
      accent: 'oklch(82% 0.13 78)',
      neutral: 'oklch(30% 0.02 45)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.14 55)',
      error: 'oklch(70% 0.17 32)',
    },
  },
  dark: {
    surfaces: ['oklch(18% 0.028 45)', 'oklch(15% 0.028 45)', 'oklch(12% 0.026 45)', 'oklch(94% 0.018 70)'],
    roles: {
      primary: 'oklch(54% 0.16 16)',
      secondary: 'oklch(76% 0.05 55)',
      accent: 'oklch(84% 0.13 78)',
      neutral: 'oklch(28% 0.02 45)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.14 55)',
      error: 'oklch(70% 0.17 32)',
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "choc-hero": "https://images.unsplash.com/photo-1551578657-a7e74acb0135?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hvY29sYXRpZXIlMjBwb3VyaW5nJTIwdGVtcGVyZWQlMjBkYXJrJTIwY2hvY29sYXRlJTIwbWFyYmxlJTIwc2xhYnxlbnwwfDB8fHwxNzg2NDA2MjE0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "choc-tile-bars": "https://images.unsplash.com/photo-1565071559227-20ab25b7685e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlLW9yaWdpbiUyMGNob2NvbGF0ZSUyMGJhcnN8ZW58MHwwfHx8MTc4NjQwNjQ1M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "choc-tile-truffles": "https://images.unsplash.com/photo-1582493255270-b3844e2a63c8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJheSUyMGhhbmQtcm9sbGVkJTIwdHJ1ZmZsZXMlMjBkdXN0ZWQlMjBjb2NvYXxlbnwwfDB8fHwxNzg2NDA2MjIwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "choc-tile-gifts": "https://images.unsplash.com/photo-1668127039852-0e7c8b3a1601?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmliYm9uZWQlMjBjaG9jb2xhdGUlMjBnaWZ0fGVufDB8MHx8fDE3ODY0MDY0NTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "choc-tile-sub": "https://images.unsplash.com/photo-1633683788767-ac390c4bf988?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBjaG9jb2xhdGUlMjBib3hlcyUyMHRpZWQlMjB0d2luZXxlbnwwfDB8fHwxNzg2NDA2MjI1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "choc-band-making": "https://images.unsplash.com/photo-1507576164121-220762647800?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29jb2ElMjBiZWFucyUyMG5pYnN8ZW58MHwwfHx8MTc4NjQwNjQ1OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "choc-band-gift": "https://images.unsplash.com/photo-1548741487-18d363dc4469?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d3JhcHBlZCUyMGNob2NvbGF0ZSUyMGJveHxlbnwwfDB8fHwxNzg2NDA2NDYxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-madagascar": "https://images.unsplash.com/photo-1677667495307-10e01bd9530f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlLW9yaWdpbiUyMG1hZGFnYXNjYXIlMjBkYXJrfGVufDB8MHx8fDE3ODY0MDY0NjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-peru": "https://images.unsplash.com/photo-1531065208531-4036c0dba3ca?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlLW9yaWdpbiUyMHBlcnUlMjBkYXJrfGVufDB8MHx8fDE3ODY0MDY0Njh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-ecuador": "https://images.unsplash.com/photo-1501684691657-cf3012635478?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlLW9yaWdpbiUyMGVjdWFkb3IlMjBkYXJrfGVufDB8MHx8fDE3ODY0MDY0NzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-tanzania": "https://images.unsplash.com/photo-1613864309738-9102a9e22883?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlLW9yaWdpbiUyMHRhbnphbmlhJTIwZGFya3xlbnwwfDB8fHwxNzg2NDA2NDc0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-truffles-caramel": "https://images.unsplash.com/photo-1637521704405-d6de83de9927?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8Ym94JTIwc2VhLXNhbHQlMjBjYXJhbWVsfGVufDB8MHx8fDE3ODY0MDY0Nzd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-truffles-champagne": "https://images.unsplash.com/photo-1608830153470-1a6591b155a3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwY2hhbXBhZ25lJTIwdHJ1ZmZsZXMlMjBkdXN0ZWQlMjBjb2NvYXxlbnwwfDB8fHwxNzg2NDA2MjQ0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-drinking-tin": "https://images.unsplash.com/photo-1623000850229-ad83232ea6c7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGluJTIwZ3JhdGVkJTIwZHJpbmtpbmclMjBjaG9jb2xhdGV8ZW58MHwwfHx8MTc4NjQwNjI0OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-library": "https://images.unsplash.com/photo-1654340102711-e9c5cc8abcd3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFzdGluZyUyMGxpYnJhcnklMjBzaXglMjBtaW5pJTIwc2luZ2xlLW9yaWdpbiUyMGJhcnN8ZW58MHwwfHx8MTc4NjQwNjI1MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subscription": "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9udGhseSUyMGNob2NvbGF0ZSUyMHN1YnNjcmlwdGlvbiUyMGJveHxlbnwwfDB8fHwxNzg2NDA2MjU0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-giftset": "https://images.unsplash.com/photo-1687795097254-f019f9d7fd17?ixid=M3wxMjA3fDB8MXxzZWFyY2h8NHx8Y3VyYXRlZCUyMGNob2NvbGF0ZSUyMGdpZnR8ZW58MHwwfHx8MTc4NjQwNjQ4MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-beantobar": "https://images.unsplash.com/photo-1601574494033-3c8800d80864?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29jb2ElMjBuaWJzJTIwYmVpbmclMjBncm91bmQlMjBpbnRvJTIwY2hvY29sYXRlJTIwbWVsYW5nZXJ8ZW58MHwwfHx8MTc4NjQwNjI1OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-tasting": "https://images.unsplash.com/photo-1626697556651-67ebdcb8cbd6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8cm93JTIwY2hvY29sYXRlJTIwc3F1YXJlcyUyMGxhaWQlMjBvdXQlMjB0YXN0aW5nfGVufDB8MHx8fDE3ODY0MDYyNjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-origins": "https://images.unsplash.com/photo-1667900598245-6620cea1c04c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmlwZSUyMGNhY2FvJTIwcG9kcyUyMHRyZWUlMjB0cm9waWNhbCUyMGZhcm18ZW58MHwwfHx8MTc4NjQwNjI2NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'choc-hero', url: src('choc-hero'), alt: 'A chocolatier pouring tempered dark chocolate over a marble slab' },
  { id: 'choc-tile-bars', url: src('choc-tile-bars'), alt: 'A row of single-origin chocolate bars in kraft wrappers' },
  { id: 'choc-tile-truffles', url: src('choc-tile-truffles'), alt: 'A tray of hand-rolled truffles dusted in cocoa' },
  { id: 'choc-tile-gifts', url: src('choc-tile-gifts'), alt: 'A ribboned chocolate gift box open on a table' },
  { id: 'choc-tile-sub', url: src('choc-tile-sub'), alt: 'A stack of chocolate boxes tied with twine' },
  { id: 'choc-band-making', url: src('choc-band-making'), alt: 'Cocoa beans and nibs beside a melanger stone grinder' },
  { id: 'choc-band-gift', url: src('choc-band-gift'), alt: 'A wrapped chocolate box left on a doorstep in warm light' },
  { id: 'prod-madagascar', url: src('prod-madagascar'), alt: 'A single-origin Madagascar dark chocolate bar' },
  { id: 'prod-peru', url: src('prod-peru'), alt: 'A single-origin Peru dark chocolate bar' },
  { id: 'prod-ecuador', url: src('prod-ecuador'), alt: 'A single-origin Ecuador dark chocolate bar' },
  { id: 'prod-tanzania', url: src('prod-tanzania'), alt: 'A single-origin Tanzania dark milk chocolate bar' },
  { id: 'prod-truffles-caramel', url: src('prod-truffles-caramel'), alt: 'A box of sea-salt caramel truffles' },
  { id: 'prod-truffles-champagne', url: src('prod-truffles-champagne'), alt: 'A box of champagne truffles dusted in cocoa' },
  { id: 'prod-drinking-tin', url: src('prod-drinking-tin'), alt: 'A tin of grated drinking chocolate' },
  { id: 'prod-library', url: src('prod-library'), alt: 'A tasting library of six mini single-origin bars' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A monthly chocolate subscription box' },
  { id: 'prod-giftset', url: src('prod-giftset'), alt: 'A curated chocolate gift set with bars and a tin' },
  { id: 'post-beantobar', url: src('post-beantobar'), alt: 'Cocoa nibs being ground into chocolate in a melanger' },
  { id: 'post-tasting', url: src('post-tasting'), alt: 'A row of chocolate squares laid out for a tasting' },
  { id: 'post-origins', url: src('post-origins'), alt: 'Ripe cacao pods on a tree at a tropical farm' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-chocolate: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm photograph, a serif headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('choc-hero'), alt: 'A chocolatier pouring tempered chocolate', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Bean to bar, one small batch at a time.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Cacao & Co. is a bean-to-bar chocolatier. We buy cacao from farms we can name, roast and grind it ourselves, and temper it by hand — so a single-origin bar tastes of the place it grew, not just of “dark chocolate.”',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop chocolate' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/products/subscription' },
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
            text: 'Choose your chocolate',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'choc-tile-bars', label: 'Bars', href: '/shop', alt: 'Single-origin bars in kraft wrappers' }),
              categoryTile({ assetId: 'choc-tile-truffles', label: 'Truffles & confections', href: '/shop', alt: 'Hand-rolled truffles dusted in cocoa' }),
              categoryTile({ assetId: 'choc-tile-gifts', label: 'Gifts', href: '/shop', alt: 'A ribboned chocolate gift box' }),
              categoryTile({ assetId: 'choc-tile-sub', label: 'Subscription', href: '/products/subscription', alt: 'A stack of chocolate boxes tied with twine' }),
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
  categoryTiles(),
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New this season' }),
  editorialBand({
    heading: 'We make it from the bean',
    lead: 'Most “chocolatiers” melt someone else’s chocolate. We don’t. We roast the beans, crack and winnow them, grind for days in a stone melanger, then temper and mould by hand — so every step, and every flavour, is ours.',
    assetId: 'choc-band-making',
    cta: 'How we make it',
    href: '/blog/bean-to-bar',
    alt: 'Cocoa nibs and a stone grinder',
  }),
  productsBlock({ source: 'commerce.category.bars', layout: 'carousel', heading: 'Single-origin bars' }),
  editorialBand({
    heading: 'Chocolate, every month',
    lead: 'A subscription is the good kind of habit: a new pairing of single-origin bars arrives freshly tempered on your schedule. Skip, swap or cancel any time — no lock-in, just something to look forward to.',
    assetId: 'choc-band-gift',
    cta: 'Start a subscription',
    href: '/products/subscription',
    alt: 'A wrapped chocolate box on a doorstep',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static "made to order" note, and policy links). */
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
                    text: 'Cacao & Co.',
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
                    label: 'Low stock',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Tempered by hand, made to order' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Every bar and box is tempered and finished the week it ships, then packed to travel cool. Chocolate keeps best somewhere dark and around room temperature — no fridge, which dulls the snap and blooms the surface. Enjoy within three months.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Pairs well with' });

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
    'Shop chocolate',
    'Everything we’re making right now — single-origin bars, truffle and confection boxes, drinking chocolate, gift sets and the subscription. Filter by origin or cacao percentage, or sort however you like; all of it is tempered to order.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The chocolate grouped the way people actually shop — what’s new this season, the bars people come back for, the single origins side by side, and gifts ready to send.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Cacao & Co.', 'Looking for an origin, a percentage, or a tasting note? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $50, and everything is tempered to order and packed to travel cool. Melted in transit or not quite right? Tell us and we’ll make it good — chocolate should be a pleasure, start to finish.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Cacao & Co. journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the workshop — how a bean becomes a bar, how to taste chocolate properly, and where the cacao actually comes from. Plain, useful, no snobbery.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Cacao & Co.' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Cacao & Co. started with a second-hand melanger, a sack of Madagascan beans, and a suspicion that the chocolate in the shops was hiding what cacao could actually taste like. It grew the slow way — one origin, one batch, one market stall at a time — and it still runs on the same idea: buy well, make it ourselves, keep it small.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We buy cacao from farms and co-operatives we can name, and we pay well above the commodity rate, because the people who grow and ferment it are the reason a bar tastes of anything at all. Then we roast, grind, conch and temper in small batches, and we only wrap what tastes the way it should.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No vague “Belgian” blends, no mystery percentages, no chocolate older than it should be. Just real single-origin chocolate, made by hand and packed to reach you at its best.',
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
    intro: 'A question about an origin, a corporate gifting order, or want us to make something for your wedding or event? Tell us what you’re after and a real person at the workshop will get back to you.',
    submitLabel: 'Email the workshop',
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

// A single-origin bar is offered at two roasts of the same bean — a rounder 70% and an
// intense 85% — so the buyer chooses the percentage, not a new product.
const CACAO: OptionDecl = {
  name: 'Cacao',
  displayType: 'dropdown',
  values: [{ value: '70% Dark' }, { value: '85% Extra dark' }],
};

const bar = (opts: {
  handle: string;
  title: string;
  description: string;
  price: number;
  sku: string;
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
  productType: 'Chocolate bar',
  vendor: 'Cacao & Co.',
  tags: opts.tags,
  categoryHandles: ['bars'],
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [CACAO],
  variants: [
    { sku: `${opts.sku}-70`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Cacao: '70% Dark' } },
    { sku: `${opts.sku}-85`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Cacao: '85% Extra dark' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

// A box of confections priced up by size — the same product, more of it.
const boxSizes = (sku: string, nine: number): Variant[] => [
  { sku: `${sku}-9`, priceCents: money(nine), isDefault: true, inventoryPolicy: 'continue', optionValues: { 'Box size': '9 pieces' } },
  { sku: `${sku}-16`, priceCents: money(Math.round(nine * 1.7)), inventoryPolicy: 'continue', optionValues: { 'Box size': '16 pieces' } },
  { sku: `${sku}-24`, priceCents: money(Math.round(nine * 2.4)), inventoryPolicy: 'continue', optionValues: { 'Box size': '24 pieces' } },
];
const BOX: OptionDecl = {
  name: 'Box size',
  displayType: 'dropdown',
  values: [{ value: '9 pieces' }, { value: '16 pieces' }, { value: '24 pieces' }],
};

const PRODUCTS: Product[] = [
  bar({
    handle: 'madagascar-sambirano',
    title: 'Madagascar Sambirano',
    description:
      'Our brightest bar and the one that converts sceptics. Cacao from the Sambirano Valley is famous for its fruit — this tastes of tart red cherry and citrus zest over a clean, tannic finish, with none of the flat bitterness people expect from dark chocolate.',
    price: 11,
    sku: 'CC-BAR-MDG',
    collections: ['new-this-season', 'best-sellers', 'single-origins', 'dark-collection'],
    tags: ['single-origin', 'madagascar', 'dark', 'fruity'],
    asset: 'prod-madagascar',
    seoTitle: 'Madagascar Sambirano — single-origin dark chocolate | Cacao & Co.',
    seoDescription: 'A bright, fruity single-origin dark chocolate from Madagascar’s Sambirano Valley — red cherry and citrus.',
  }),
  bar({
    handle: 'peru-piura',
    title: 'Peru Piura Blanco',
    description:
      'A rare white-bean cacao from the Piura valley, and the gentlest bar on the shelf. Soft and creamy for a dark chocolate — caramel, toasted walnut and a little soft raisin, with a long, mellow finish. The one to hand someone who thinks they don’t like dark.',
    price: 12,
    sku: 'CC-BAR-PER',
    collections: ['single-origins', 'dark-collection'],
    tags: ['single-origin', 'peru', 'dark', 'nutty'],
    asset: 'prod-peru',
    seoTitle: 'Peru Piura Blanco — single-origin dark chocolate | Cacao & Co.',
    seoDescription: 'A gentle, creamy single-origin dark chocolate from Peru’s Piura valley — caramel and toasted walnut.',
  }),
  bar({
    handle: 'ecuador-los-rios',
    title: 'Ecuador Los Ríos',
    description:
      'Made from Ecuador’s heirloom Nacional cacao, prized for its perfume. Floral on the nose — jasmine and ripe banana — giving way to a deep, fudgy body and a whisper of espresso. Classic, generous chocolate with an aromatic lift most bars never reach.',
    price: 11,
    sku: 'CC-BAR-ECU',
    collections: ['single-origins', 'dark-collection'],
    tags: ['single-origin', 'ecuador', 'dark', 'floral'],
    asset: 'prod-ecuador',
    seoTitle: 'Ecuador Los Ríos — single-origin dark chocolate | Cacao & Co.',
    seoDescription: 'A floral, fudgy single-origin dark chocolate from Ecuador’s heirloom Nacional cacao — jasmine and espresso.',
  }),
  bar({
    handle: 'tanzania-kokoa-kamili',
    title: 'Tanzania Kokoa Kamili',
    description:
      'A dark milk bar — more cacao than any milk chocolate you’ll find in a shop, with just enough milk to round it. Cacao from the Kokoa Kamili station in Kilombero brings blackberry jam and brown sugar; the milk turns it into something like malted fruit-and-nut. Dangerously easy.',
    price: 11,
    sku: 'CC-BAR-TZA',
    collections: ['new-this-season', 'single-origins'],
    tags: ['single-origin', 'tanzania', 'dark-milk', 'fruity'],
    asset: 'prod-tanzania',
    seoTitle: 'Tanzania Kokoa Kamili — single-origin dark milk chocolate | Cacao & Co.',
    seoDescription: 'A fruity single-origin dark milk chocolate from Tanzania’s Kokoa Kamili — blackberry jam and brown sugar.',
  }),
  {
    handle: 'sea-salt-caramel-truffles',
    title: 'Sea Salt Caramel Truffles',
    description:
      'Slow-cooked caramel, still just soft, wrapped in a thin shell of our 70% Madagascar and finished with a flake of sea salt. The caramel is cooked dark — properly, to the edge of bitter — so it reads as burnt-sugar and butter rather than sweet. Our most-ordered box, by a distance.',
    status: 'active',
    productType: 'Confection',
    vendor: 'Cacao & Co.',
    tags: ['truffles', 'caramel', 'sea-salt', 'best-seller'],
    categoryHandles: ['truffles'],
    collectionHandles: ['new-this-season', 'best-sellers'],
    seoTitle: 'Sea Salt Caramel Truffles — hand-rolled | Cacao & Co.',
    seoDescription: 'Slow-cooked dark caramel in a 70% Madagascar shell, finished with flaked sea salt. Boxes of 9, 16 or 24.',
    options: [BOX],
    variants: boxSizes('CC-TRF-CAR', 24),
    images: [{ assetId: 'prod-truffles-caramel', isPrimary: true, alt: 'A box of sea-salt caramel truffles' }],
  },
  {
    handle: 'champagne-truffles',
    title: 'Champagne Truffle Collection',
    description:
      'The classic celebration truffle, made properly. A light ganache of dark chocolate and marc de Champagne, hand-rolled and dusted in cocoa so it dissolves the moment it lands. Boozy, buttery and barely sweet — the box you bring so the evening feels like an occasion.',
    status: 'active',
    productType: 'Confection',
    vendor: 'Cacao & Co.',
    tags: ['truffles', 'champagne', 'gift'],
    categoryHandles: ['truffles'],
    collectionHandles: ['best-sellers'],
    seoTitle: 'Champagne Truffle Collection — hand-rolled | Cacao & Co.',
    seoDescription: 'A light dark-chocolate and marc de Champagne ganache, dusted in cocoa. Boxes of 9, 16 or 24.',
    options: [BOX],
    variants: boxSizes('CC-TRF-CHM', 26),
    images: [{ assetId: 'prod-truffles-champagne', isPrimary: true, alt: 'A box of champagne truffles' }],
  },
  {
    handle: 'drinking-chocolate',
    title: 'Drinking Chocolate Tin',
    description:
      'Not cocoa powder — actual chocolate, grated fine. Whisk two spoonfuls into hot milk and you get the thick, glossy drinking chocolate of a good café, because it’s the same 65% couverture we mould into bars. The Spiced tin adds cinnamon, a little chilli and orange for something closer to a Oaxacan cup.',
    status: 'active',
    productType: 'Drinking chocolate',
    vendor: 'Cacao & Co.',
    tags: ['drinking-chocolate', 'gift', 'pantry'],
    categoryHandles: ['gifts'],
    collectionHandles: ['best-sellers', 'gifts-and-sets'],
    seoTitle: 'Drinking Chocolate Tin — real grated couverture | Cacao & Co.',
    seoDescription: 'Real grated 65% couverture for thick, glossy hot chocolate. Classic or spiced with cinnamon and chilli.',
    options: [
      { name: 'Flavour', displayType: 'dropdown', values: [{ value: 'Classic dark' }, { value: 'Spiced' }] },
    ],
    variants: [
      { sku: 'CC-DRK-CL', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue', optionValues: { Flavour: 'Classic dark' } },
      { sku: 'CC-DRK-SP', priceCents: money(24), inventoryPolicy: 'continue', optionValues: { Flavour: 'Spiced' } },
    ],
    images: [{ assetId: 'prod-drinking-tin', isPrimary: true, alt: 'A tin of drinking chocolate' }],
  },
  {
    handle: 'tasting-library',
    title: 'The Tasting Library',
    description:
      'Six mini bars, one from each origin we’re making, laid out light to dark with tasting notes on the sleeve — the whole shelf in one box. The best way to find your bar, and the box people buy twice: once for themselves, once as a present the moment they’ve tried it.',
    status: 'active',
    productType: 'Gift set',
    vendor: 'Cacao & Co.',
    tags: ['gift', 'tasting', 'set'],
    categoryHandles: ['gifts'],
    collectionHandles: ['new-this-season', 'gifts-and-sets'],
    seoTitle: 'The Tasting Library — six single-origin mini bars | Cacao & Co.',
    seoDescription: 'Six mini single-origin bars laid out light to dark with tasting notes — the whole shelf in one box.',
    variants: [{ sku: 'CC-SET-LIB', priceCents: money(42), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-library', isPrimary: true, alt: 'A tasting library of six mini bars' }],
  },
  {
    handle: 'gift-set',
    title: 'The Cacao & Co. Gift Box',
    description:
      'Our signature present, packed and ribboned to send straight to someone: two full single-origin bars, a box of sea-salt caramel truffles and a tin of drinking chocolate, in a keepsake box with a hand-written card. Tell us what to write at checkout and we’ll do the wrapping.',
    status: 'active',
    productType: 'Gift set',
    vendor: 'Cacao & Co.',
    tags: ['gift', 'set', 'hamper'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts-and-sets', 'best-sellers'],
    seoTitle: 'The Cacao & Co. Gift Box — bars, truffles & drinking chocolate | Cacao & Co.',
    seoDescription: 'A ribboned gift box of two single-origin bars, sea-salt caramel truffles and a drinking-chocolate tin.',
    variants: [{ sku: 'CC-SET-GIFT', priceCents: money(68), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-giftset', isPrimary: true, alt: 'A curated chocolate gift set' }],
  },
  {
    handle: 'subscription',
    title: 'Chocolate Subscription',
    description:
      'Freshly tempered chocolate on your schedule — a new pairing of single-origin bars each month, chosen from what’s tasting best, with notes on where each one grew. Pick one box or two, and skip, swap or cancel any time. The easiest present to keep giving, including to yourself.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Cacao & Co.',
    tags: ['subscription', 'gift'],
    categoryHandles: ['subscription'],
    collectionHandles: ['new-this-season', 'best-sellers'],
    seoTitle: 'Chocolate Subscription — single-origin bars, monthly | Cacao & Co.',
    seoDescription: 'A flexible monthly chocolate subscription — a new pairing of single-origin bars; skip, swap or cancel any time.',
    options: [
      { name: 'Plan', displayType: 'dropdown', values: [{ value: 'One box' }, { value: 'Two boxes' }] },
    ],
    variants: [
      { sku: 'CC-SUB-1', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: 'One box' } },
      { sku: 'CC-SUB-2', priceCents: money(44), inventoryPolicy: 'continue', optionValues: { Plan: 'Two boxes' } },
    ],
    images: [{ assetId: 'prod-subscription', isPrimary: true, alt: 'A monthly chocolate subscription box' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'bars', name: 'Bars', description: 'Single-origin bean-to-bar chocolate.', featured: true },
    { handle: 'truffles', name: 'Truffles & confections', description: 'Hand-rolled truffles and filled chocolates.', featured: true },
    { handle: 'gifts', name: 'Gifts', description: 'Sets, tins and boxes ready to send.', featured: true },
    { handle: 'subscription', name: 'Subscription', description: 'Chocolate on your schedule.', featured: true },
  ],
  collections: [
    {
      handle: 'new-this-season',
      name: 'New this season',
      description: 'The latest batches off the bench.',
      type: 'manual',
      featured: true,
      productHandles: ['madagascar-sambirano', 'tanzania-kokoa-kamili', 'sea-salt-caramel-truffles', 'tasting-library', 'subscription'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The chocolate people come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['sea-salt-caramel-truffles', 'madagascar-sambirano', 'drinking-chocolate', 'gift-set', 'subscription'],
    },
    {
      handle: 'single-origins',
      name: 'Single-origin bars',
      description: 'One farm, one flavour — side by side.',
      type: 'manual',
      featured: false,
      productHandles: ['madagascar-sambirano', 'peru-piura', 'ecuador-los-rios', 'tanzania-kokoa-kamili'],
    },
    {
      handle: 'dark-collection',
      name: 'For the dark lovers',
      description: 'The deepest, most intense bars we make.',
      type: 'manual',
      featured: false,
      productHandles: ['madagascar-sambirano', 'peru-piura', 'ecuador-los-rios'],
    },
    {
      handle: 'gifts-and-sets',
      name: 'Gifts & sets',
      description: 'Ready to wrap, ready to send.',
      type: 'manual',
      featured: false,
      productHandles: ['gift-set', 'tasting-library', 'drinking-chocolate'],
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
    slug: 'bean-to-bar',
    status: 'published',
    body: {
      title: 'Bean to bar: what actually happens between the pod and the wrapper',
      excerpt: 'Most chocolate is melted, not made. Here’s every step we do ourselves, and why each one changes how the bar tastes.',
      featuredImage: { $asset: 'post-beantobar' },
      body: {
        type: 'doc',
        content: [
          para('“Bean to bar” means exactly what it says: we start with fermented, dried cacao beans and do everything from there ourselves, rather than melting couverture someone else already made. It is slower and fussier, and it is the only way the flavour of a particular farm survives all the way into the bar. Here is the whole chain.'),
          h2('Roast, crack, winnow'),
          para('We roast the beans in small batches — lower and slower than coffee — to develop flavour without burning off the fruit. Then we crack them and winnow away the papery husk, leaving the nibs: pure cacao, and already smelling of the bar to come. Roast is the first fork in the road; the same bean roasted two ways is two different chocolates.'),
          h2('Grind and conch'),
          para('The nibs go into a stone melanger and grind for two to three days. The friction melts the cocoa butter, the sugar goes in, and the grit slowly disappears until the chocolate is smooth on the tongue. That long, warm grind is also the conch — it drives off the last harsh, volatile notes and rounds everything into something you want to eat. Skip it and the bar is sandy and sharp.'),
          h2('Temper and mould'),
          para('Finally we temper: heating and cooling the chocolate through precise temperatures so the cocoa butter sets in the one crystal form that snaps, shines and melts at body heat. Untempered chocolate is dull, soft and streaky. Tempered, it clicks when you break it and dissolves clean — the difference you can feel before you taste anything. Then it’s moulded, set, and wrapped by hand.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'how-to-taste-chocolate',
    status: 'published',
    body: {
      title: 'How to taste chocolate (properly, in five minutes)',
      excerpt: 'You already know how to do this — it’s the same attention you’d give a glass of wine. A quick, unfussy method.',
      featuredImage: { $asset: 'post-tasting' },
      body: {
        type: 'doc',
        content: [
          para('Tasting chocolate isn’t a performance, and it doesn’t need vocabulary you’d be embarrassed to say out loud. It just needs you to slow down for a couple of minutes and pay attention to what’s actually happening. Here’s the version we teach at the stall.'),
          h2('Look, listen, smell'),
          para('Start with a clean palate — a sip of water, nothing minty. Look at the bar: good chocolate is glossy, not dull or grey. Snap a piece off; a well-tempered dark bar cracks with a clean click. Then smell it before you eat it. Most of what you’ll “taste” is really smell, so give it a second — you’ll often catch the fruit or the nuts before it’s even in your mouth.'),
          h2('Let it melt, don’t chew'),
          para('Put a square on your tongue and let it melt rather than biting through it. Chewing rushes past everything. As it melts, the flavour moves: a bright origin like our Madagascar opens with tart fruit up front, then the deeper cocoa arrives, then a finish that lingers after it’s gone. Notice the order, and notice the texture — smooth, or a little coarse; fast-melting, or waxy and slow.'),
          h2('Compare, and trust yourself'),
          para('The fastest way to learn your own palate is to taste two bars side by side — that’s the whole idea behind the Tasting Library. Next to the Peru, the Madagascar’s fruit is obvious; next to the Madagascar, the Peru’s caramel is. And whatever you notice is right. If it tastes of raisins to you, it tastes of raisins — the notes on our sleeves are a starting point, not a test.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'where-our-cacao-grows',
    status: 'published',
    body: {
      title: 'Where our cacao actually grows, and why we pay more for it',
      excerpt: 'A bar with an origin on it should mean something. Here’s what we know about the farms behind ours, and what fermentation has to do with flavour.',
      featuredImage: { $asset: 'post-origins' },
      body: {
        type: 'doc',
        content: [
          para('Most cacao is sold as a commodity — bulk-bought, blended, and priced with no reference to who grew it or how it tastes. We buy the other way: specific lots from farms and co-operatives we can name, through importers who’ve built long relationships with the growers. It costs more, and here’s why it’s worth it.'),
          h2('Fermentation is half the flavour'),
          para('Cacao doesn’t taste of chocolate when it comes out of the pod — it tastes of sharp white fruit pulp. The chocolate flavour is developed by fermentation: the wet beans are heaped up for days, and the heat and microbes that build in the pile create the compounds we later roast into flavour. Done well, you get fruit and depth; done carelessly, you get mould and mustiness that no roasting can fix. So a great bar is really a great ferment, and that happens at origin, not in our workshop.'),
          h2('Why we pay above the market'),
          para('Careful fermentation and selective harvesting take labour, and the commodity price doesn’t reward either. If we want growers to keep doing the fiddly, flavour-making work — and to keep improving it season on season — they have to earn a proper living from it. Paying above the market isn’t charity; it’s the only way the good cacao keeps being made.'),
          h2('What the origin buys you'),
          para('Traceability, first: when you can name the farm, you can taste what a region and a process actually do — the Sambirano’s red fruit, Piura’s caramel — year after year. And consistency: the same growers, treated fairly, return with the same distinctive lots. The origin on the wrapper is a promise that someone, somewhere, was paid properly to grow something worth making into chocolate.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-chocolate',
  key: 'sparx-retail-chocolate',
  name: 'sparx — Chocolatier (Artisan)',
  theme: THEME,
  summary:
    'A complete, working shop for a bean-to-bar chocolatier: a real catalogue of single-origin bars, truffle and confection boxes, drinking chocolate, gift sets and a flexible subscription, with categories, collections, a bespoke PDP and a fully merchandised home page. Rich, low-lit chocolate-room theme — deep cocoa grounds, a burgundy primary, a warm gold accent. Shipped as Cacao & Co.',
  tagline: 'A warm, working storefront for an artisan chocolatier.',
  vertical: 'retail',
  industry: 'Chocolatier',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 84,
  brand: {
    businessName: 'Cacao & Co.',
    tagline: 'Bean to bar, one small batch at a time.',
  },
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Cacao & Co. — bean-to-bar chocolate, made by hand',
      description:
        'Cacao & Co. is a bean-to-bar chocolatier — single-origin bars, hand-rolled truffles and a monthly subscription, made from named-farm cacao and tempered to order. Buy well, make it ourselves, keep it small.',
    },
    about: {
      title: 'About Cacao & Co.',
      description:
        'How Cacao & Co. buys, roasts, grinds and tempers — small batches, named farms, fair prices, and chocolate that tastes of where it grew.',
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
