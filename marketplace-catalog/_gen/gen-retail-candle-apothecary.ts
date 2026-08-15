// sparx-retail-candle-apothecary — a RETAIL/COMMERCE site template: a candle & home-fragrance
// apothecary.
//
// A member of the retail family that mirrors the coffee-craft gold reference EXACTLY: a
// complete, working shop the moment it installs — a real catalogue (signed scented candles,
// a reed diffuser, a room mist, a wax-melt set, a wick trimmer, a gift set), categories +
// collections, a bespoke PDP, the full 9-page commerce site (home merchandising → shop →
// collections → cart → search → journal → about → contact), dressed in an INLINE bespoke
// theme. Shipped as Ember & Ash.
//
// DNA — moody apothecary. A DARK, warm-charcoal ground in BOTH modes (a candle is a thing
// you light in a dim room, so the site is lit low too), surfaces separated by a base-200
// shift + border, light text on the dark ground, an EMBER accent, a characterful serif over
// a humanist sans, candlelit imagery, a slow evocative scent-story voice. Because the ground
// is dark, `secondary` is LIGHT and legible on it, and the bright status set carries both
// modes (the deep set would vanish on a 20% surface) — the same discipline `cellar`/`stage`
// follow in the theme shelves.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme
// inline and passes it on the spec (`theme`), so the family can be authored in parallel with
// no two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-candle-apothecary.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-candle-apothecary/**" \
//     "marketplace-catalog/_gen/gen-retail-candle-apothecary.ts"
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
// A moody apothecary: a warm near-black charcoal ground, faintly warm surfaces stepping
// down into shadow, an ember-orange accent and a warm-amber primary carried in dark ink,
// under a characterful serif display over a humanist sans. DARK in both modes (a candle is
// lit in a dim room), so `secondary` is LIGHT and legible and the bright status set carries
// both modes. Complete light + dark, AA on every role (the blueprint sweep's contrast check
// is the gate). STATUS_ON_LIGHT is imported for parity with the family; the dark ground uses
// STATUS_ON_DARK in both modes.
void STATUS_ON_LIGHT;
const THEME = defineTheme({
  name: 'ember-apothecary',
  type: { body: face('Karla', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.375rem', field: '0.25rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: ['oklch(21% 0.014 55)', 'oklch(18% 0.014 55)', 'oklch(15% 0.014 55)', 'oklch(93% 0.014 70)'],
    roles: {
      primary: 'oklch(80% 0.13 62)',
      secondary: 'oklch(80% 0.05 60)',
      accent: 'oklch(72% 0.16 42)',
      neutral: 'oklch(32% 0.018 55)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.14 70)',
    },
  },
  dark: {
    surfaces: ['oklch(15% 0.012 55)', 'oklch(12% 0.012 55)', 'oklch(9% 0.012 55)', 'oklch(94% 0.012 70)'],
    roles: {
      primary: 'oklch(82% 0.13 62)',
      secondary: 'oklch(82% 0.05 60)',
      accent: 'oklch(74% 0.16 42)',
      neutral: 'oklch(30% 0.018 55)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.14 70)',
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "ember-hero": "https://images.unsplash.com/photo-1595432576728-94e0e94a7663?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlJTIwbGl0JTIwY2FuZGxlJTIwZ2xvd2luZyUyMGRhcmslMjBhcG90aGVjYXJ5JTIwc2hlbGZ8ZW58MHwwfHx8MTc4NjQwMjIzNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ember-tile-candles": "https://images.unsplash.com/photo-1560521166-99f8bed834f5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8cm93JTIwYW1iZXItZ2xhc3MlMjBjYW5kbGVzJTIwd2lja3MlMjB0cmltbWVkJTIwbG93fGVufDB8MHx8fDE3ODY0MDIyMzl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ember-tile-diffusers": "https://images.unsplash.com/photo-1750433101196-604c1741a012?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVlZCUyMGRpZmZ1c2VyJTIwc21va2VkLWdsYXNzJTIwYm90dGxlJTIwYWdhaW5zdCUyMHNoYWRvd3xlbnwwfDB8fHwxNzg2NDAyMjQzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ember-tile-gifts": "https://images.unsplash.com/photo-1668127039852-0e7c8b3a1601?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d3JhcHBlZCUyMGNhbmRsZSUyMGdpZnQlMjBzZXQlMjB0aWVkJTIwbGluZW4lMjByaWJib258ZW58MHwwfHx8MTc4NjQwMjI0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ember-tile-accessories": "https://images.unsplash.com/photo-1629261651616-00c3e07ca6e8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJhc3MlMjB3aWNrJTIwdHJpbW1lcnxlbnwwfDB8fHwxNzg2NDAyNTU5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ember-band-pour": "https://images.unsplash.com/photo-1643716991721-15b3e95660a7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9sdGVuJTIwd2F4JTIwcG91cmVkfGVufDB8MHx8fDE3ODY0MDI1NjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ember-band-gift": "https://images.unsplash.com/photo-1575814599842-30b19479434a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FuZGxlJTIwc2V0JTIwb3BlbmVkJTIwZGFyayUyMHRhYmxlJTIwcmliYm9uJTIwbG9vc2VuZWR8ZW58MHwwfHx8MTc4NjQwMjI1M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cedar-smoke": "https://images.unsplash.com/photo-1602607203588-d6d0eda790e3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2VkYXIlMjBzbW9rZSUyMGNhbmRsZSUyMGFtYmVyJTIwZ2xhc3MlMjB2ZXNzZWx8ZW58MHwwfHx8MTc4NjQwMjI1Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-fig-amber": "https://images.unsplash.com/photo-1602607202950-a06a2a03cb9d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmlnJTIwYW1iZXIlMjBjYW5kbGUlMjBhbWJlciUyMGdsYXNzJTIwdmVzc2VsfGVufDB8MHx8fDE3ODY0MDIyNTl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-sea-salt": "https://images.unsplash.com/photo-1567790358542-a3e83dd9f1aa?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2VhJTIwc2FsdCUyMGRyaWZ0d29vZHxlbnwwfDB8fHwxNzg2NDAyNTY1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-black-fir": "https://images.unsplash.com/photo-1602607202679-d4a5e8d2b524?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8YmxhY2slMjBmaXIlMjBhc2glMjBjYW5kbGUlMjBhbWJlciUyMGdsYXNzJTIwdmVzc2VsfGVufDB8MHx8fDE3ODY0MDIyNjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-diffuser": "https://images.unsplash.com/photo-1641942575351-b78f37a990eb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVlZCUyMGRpZmZ1c2VyJTIwc21va2VkLWdsYXNzJTIwYm90dGxlfGVufDB8MHx8fDE3ODY0MDIyNjl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-room-mist": "https://images.unsplash.com/photo-1764395294549-686b3808320f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8cm9vbSUyMG1pc3QlMjBtYXR0ZSUyMGFtYmVyJTIwc3ByYXklMjBib3R0bGV8ZW58MHwwfHx8MTc4NjQwMjI3Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-wax-melts": "https://images.unsplash.com/photo-1711207354615-5b4c454fce1b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8c295JTIwd2F4JTIwbWVsdHN8ZW58MHwwfHx8MTc4NjQwMjU2OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-wick-trimmer": "https://images.unsplash.com/photo-1782512948812-37d2215d956a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJhc3MlMjB3aWNrJTIwdHJpbW1lciUyMGRhcmslMjBzdXJmYWNlfGVufDB8MHx8fDE3ODY0MDIyNzd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-gift-set": "https://images.unsplash.com/photo-1766512442064-0ffc39ce866f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhyZWUtY2FuZGxlJTIwZGlzY292ZXJ5JTIwZ2lmdCUyMHNldCUyMGJveGVkJTIwa3JhZnR8ZW58MHwwfHx8MTc4NjQwMjI4MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-pour": "https://images.unsplash.com/photo-1589051079002-b140a970f568?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2F4JTIwYmVpbmclMjBoYW5kLXBvdXJlZCUyMGludG8lMjB2ZXNzZWxzJTIwd29ya3Nob3B8ZW58MHwwfHx8MTc4NjQwMjI4M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-scent": "https://images.unsplash.com/photo-1560925969-1d1fdb75ad70?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZnJhZ3JhbmNlJTIwb2lscyUyMGJsb3R0ZXJzJTIwbGFpZCUyMG91dCUyMGJlbmNofGVufDB8MHx8fDE3ODY0MDIyODZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-care": "https://images.unsplash.com/photo-1560663784-a3bb272189bc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2ljayUyMGJlaW5nJTIwdHJpbW1lZCUyMGJlZm9yZSUyMGZpcnN0JTIwYnVybnxlbnwwfDB8fHwxNzg2NDAyMjg5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'ember-hero', url: src('ember-hero'), alt: 'A single lit candle glowing on a dark apothecary shelf' },
  { id: 'ember-tile-candles', url: src('ember-tile-candles'), alt: 'A row of amber-glass candles with wicks trimmed low' },
  { id: 'ember-tile-diffusers', url: src('ember-tile-diffusers'), alt: 'A reed diffuser in a smoked-glass bottle against shadow' },
  { id: 'ember-tile-gifts', url: src('ember-tile-gifts'), alt: 'A wrapped candle gift set tied with linen ribbon' },
  { id: 'ember-tile-accessories', url: src('ember-tile-accessories'), alt: 'A brass wick trimmer resting beside a spent match' },
  { id: 'ember-band-pour', url: src('ember-band-pour'), alt: 'Molten wax being poured into an amber vessel by candlelight' },
  { id: 'ember-band-gift', url: src('ember-band-gift'), alt: 'A candle set opened on a dark table, ribbon loosened' },
  { id: 'prod-cedar-smoke', url: src('prod-cedar-smoke'), alt: 'A Cedar & Smoke candle in an amber glass vessel' },
  { id: 'prod-fig-amber', url: src('prod-fig-amber'), alt: 'A Fig & Amber candle in an amber glass vessel' },
  { id: 'prod-sea-salt', url: src('prod-sea-salt'), alt: 'A Sea Salt & Driftwood candle in an amber glass vessel' },
  { id: 'prod-black-fir', url: src('prod-black-fir'), alt: 'A Black Fir & Ash candle in an amber glass vessel' },
  { id: 'prod-diffuser', url: src('prod-diffuser'), alt: 'A reed diffuser in a smoked-glass bottle' },
  { id: 'prod-room-mist', url: src('prod-room-mist'), alt: 'A room mist in a matte amber spray bottle' },
  { id: 'prod-wax-melts', url: src('prod-wax-melts'), alt: 'A set of soy wax melts in a kraft tray' },
  { id: 'prod-wick-trimmer', url: src('prod-wick-trimmer'), alt: 'A brass wick trimmer on a dark surface' },
  { id: 'prod-gift-set', url: src('prod-gift-set'), alt: 'A three-candle discovery gift set boxed in kraft' },
  { id: 'post-pour', url: src('post-pour'), alt: 'Wax being hand-poured into vessels in the workshop' },
  { id: 'post-scent', url: src('post-scent'), alt: 'Fragrance oils and blotters laid out on a bench' },
  { id: 'post-care', url: src('post-care'), alt: 'A wick being trimmed before the first burn' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-candle-apothecary: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one candlelit photograph, a serif headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the
 *  photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('ember-hero'), alt: 'A single lit candle glowing on a dark shelf', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box border border-base-300 bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'A room, and then a mood.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Ember & Ash is a small apothecary of candles and home fragrance, hand-poured in coconut-soy wax and blended to smell like somewhere — a woodshop at dusk, a shoreline after rain, the last hour of a good evening.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the collection' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop' },
                      text: 'Find your scent',
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
      el('img', 'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover transition group-hover:opacity-90', {
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
            text: 'Where would you like to be?',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'ember-tile-candles', label: 'Candles', href: '/shop', alt: 'A row of amber-glass candles' }),
              categoryTile({ assetId: 'ember-tile-diffusers', label: 'Diffusers & mists', href: '/shop', alt: 'A reed diffuser against shadow' }),
              categoryTile({ assetId: 'ember-tile-gifts', label: 'Gifts', href: '/shop', alt: 'A wrapped candle gift set' }),
              categoryTile({ assetId: 'ember-tile-accessories', label: 'Accessories', href: '/shop', alt: 'A brass wick trimmer and match' }),
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
            el('div', 'flex max-w-xl flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-8 @3xl:p-10', {
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Lit this season' }),
  editorialBand({
    heading: 'Poured by hand, in small pours',
    lead: 'We blend and pour in batches of a few dozen, in coconut-soy wax with cotton wicks and a clean, even burn. Every candle is cured for two weeks before it ships, because a scent poured yesterday is a scent that hasn’t found itself yet.',
    assetId: 'ember-band-pour',
    cta: 'How we pour',
    href: '/blog/how-we-pour',
    alt: 'Molten wax being poured into an amber vessel',
  }),
  productsBlock({ source: 'commerce.category.candles', layout: 'carousel', heading: 'The candles' }),
  editorialBand({
    heading: 'Give a whole evening',
    lead: 'A gift set is the easy yes — three of the signature scents boxed in kraft and tied in linen, ready to hand over. For someone new to candles, or someone who already knows exactly the mood they’re after.',
    assetId: 'ember-band-gift',
    cta: 'Shop gifts',
    href: '/shop',
    alt: 'A candle gift set opened on a dark table',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static "how it burns" note, and policy links). */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          pdpImage('aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'),
          el('div', 'flex flex-col gap-6 @3xl:py-4', {
            children: [
              el('div', 'flex flex-col gap-4', {
                children: [
                  el('p', 'text-sm font-semibold uppercase tracking-widest text-secondary', {
                    text: 'Ember & Ash',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'How it burns' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Coconut-soy wax and a cotton wick, hand-poured and cured two weeks before it ships. Roughly a 50-hour burn. Trim the wick to a quarter inch before every light, and let the first burn reach the edge — that’s what keeps it even to the last hour.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Burns well beside' });

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
    'The whole apothecary',
    'Every candle, diffuser, mist and gift we’re making right now — hand-poured in small batches and cured before it ships. Filter by scent family or room, or sort however you like.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The fragrances grouped the way people actually shop — what’s lit this season, the signature scents, the woodsmoke end of the shelf, and gift-ready sets.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Ember & Ash', 'Looking for a scent, a room, or a burning guide? Search the whole apothecary and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $60, and every candle is poured and cured before it leaves us — packed in recycled board that’s made to survive the post. Not the scent you hoped for? Tell us and we’ll make it right.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Ember journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the bench — how we blend a scent, how we pour, and how to get every last even hour out of a candle. Plain, useful, no mystique.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Ember & Ash' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Ember & Ash began on a kitchen stove with a thrift-store double boiler and a stubborn idea: that most candles smell like a name on a label and not like anything you could actually walk into. So we started blending the other way — toward places, hours and weather, and away from anything that smelled like a candle pretending to be food.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Everything is poured by hand in coconut-soy wax, with cotton wicks and fragrance oils we blend ourselves and test for weeks before a scent earns a name. We pour in small batches because that’s the only way to keep a nose on every one, and we cure each candle before it ships so the scent has settled into the wax by the time you light it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No synthetic smoke-and-mirrors, no scents we wouldn’t burn in our own front room, no candle out the door before it’s ready. Just fragrance made with care, for the ordinary evenings that deserve a little atmosphere.',
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
    intro: 'Questions about a scent, a custom order, or want us to pour for your shop or event? Tell us what you’re after and a real person at the bench will write back.',
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

// Candles carry a Size variant (the vessel) — the natural axis for a poured candle. The
// scent IS the product (one product per scent), which is how a shopper actually browses
// fragrance; a Size dropdown covers the format choice.
const SIZE: OptionDecl = {
  name: 'Size',
  displayType: 'dropdown',
  values: [{ value: '8 oz tumbler' }, { value: '12 oz jar' }],
};

const candle = (opts: {
  handle: string;
  title: string;
  description: string;
  price: number;
  priceLarge: number;
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
  productType: 'Candle',
  vendor: 'Ember & Ash',
  tags: opts.tags,
  categoryHandles: ['candles'],
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [SIZE],
  variants: [
    { sku: `${opts.sku}-8`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '8 oz tumbler' } },
    { sku: `${opts.sku}-12`, priceCents: money(opts.priceLarge), inventoryPolicy: 'continue', optionValues: { Size: '12 oz jar' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const PRODUCTS: Product[] = [
  candle({
    handle: 'cedar-smoke',
    title: 'Cedar & Smoke',
    description:
      'The signature. A woodshop at the end of the day — dry cedar and sawdust over a low curl of woodsmoke, warmed with a little vetiver and clove. Grounding without going heavy, the one we light first when the evenings turn.',
    price: 32,
    priceLarge: 44,
    sku: 'EMBER-CEDAR-SMOKE',
    collections: ['this-season', 'signatures', 'woodsmoke'],
    tags: ['candle', 'woody', 'smoky', 'signature'],
    asset: 'prod-cedar-smoke',
    seoTitle: 'Cedar & Smoke — hand-poured candle | Ember & Ash',
    seoDescription: 'Dry cedar, sawdust and a low curl of woodsmoke, warmed with vetiver and clove. Hand-poured coconut-soy.',
  }),
  candle({
    handle: 'fig-amber',
    title: 'Fig & Amber',
    description:
      'Soft and golden — ripe fig and green fig leaf over a base of amber and warm musk, with a whisper of coconut. The room-filling one; sweet without being a dessert, and endlessly easy to live with.',
    price: 32,
    priceLarge: 44,
    sku: 'EMBER-FIG-AMBER',
    collections: ['this-season', 'signatures'],
    tags: ['candle', 'sweet', 'amber', 'signature'],
    asset: 'prod-fig-amber',
    seoTitle: 'Fig & Amber — hand-poured candle | Ember & Ash',
    seoDescription: 'Ripe fig and fig leaf over amber and warm musk with a whisper of coconut. Hand-poured coconut-soy.',
  }),
  candle({
    handle: 'sea-salt-driftwood',
    title: 'Sea Salt & Driftwood',
    description:
      'A shoreline after rain — cool sea salt and mineral air over sun-bleached driftwood and a thread of sage. The bright one on the shelf; clean, open and a little melancholy, in the best way.',
    price: 30,
    priceLarge: 42,
    sku: 'EMBER-SEA-SALT',
    collections: ['this-season', 'signatures'],
    tags: ['candle', 'fresh', 'marine', 'signature'],
    asset: 'prod-sea-salt',
    seoTitle: 'Sea Salt & Driftwood — hand-poured candle | Ember & Ash',
    seoDescription: 'Cool sea salt and mineral air over sun-bleached driftwood and sage. Hand-poured coconut-soy.',
  }),
  candle({
    handle: 'black-fir-ash',
    title: 'Black Fir & Ash',
    description:
      'The dark end of the shelf — black fir needles and cracked pepper over cooled embers and a dry, resinous smoke. Nearly a fireplace in a jar; the one for the coldest, quietest nights.',
    price: 32,
    priceLarge: 44,
    sku: 'EMBER-BLACK-FIR',
    collections: ['signatures', 'woodsmoke'],
    tags: ['candle', 'woody', 'smoky', 'evergreen'],
    asset: 'prod-black-fir',
    seoTitle: 'Black Fir & Ash — hand-poured candle | Ember & Ash',
    seoDescription: 'Black fir and cracked pepper over cooled embers and dry resinous smoke. Hand-poured coconut-soy.',
  }),
  {
    handle: 'reed-diffuser',
    title: 'Cedar & Smoke Reed Diffuser',
    description:
      'The signature scent, always on. Natural rattan reeds draw the Cedar & Smoke blend up into the room for a low, constant throw that lasts three to four months — no flame, no fuss, ideal for a hallway or a bathroom that never gets a candle lit in it.',
    status: 'active',
    productType: 'Diffuser',
    vendor: 'Ember & Ash',
    tags: ['diffuser', 'flameless', 'woody'],
    categoryHandles: ['diffusers'],
    collectionHandles: ['this-season', 'flameless'],
    seoTitle: 'Cedar & Smoke Reed Diffuser | Ember & Ash',
    seoDescription: 'Natural rattan reeds and the Cedar & Smoke blend for a low, constant throw that lasts months.',
    variants: [{ sku: 'EMBER-DIFF-CEDAR', priceCents: money(38), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-diffuser', isPrimary: true, alt: 'A reed diffuser in smoked glass' }],
  },
  {
    handle: 'room-mist',
    title: 'Fig & Amber Room Mist',
    description:
      'A quick change of atmosphere in a spritz — the Fig & Amber blend in a fine linen-and-air mist for the room, the sofa, or the moment a guest is at the door. Water-based and light, so it freshens without hanging heavy.',
    status: 'active',
    productType: 'Room mist',
    vendor: 'Ember & Ash',
    tags: ['mist', 'flameless', 'sweet'],
    categoryHandles: ['diffusers'],
    collectionHandles: ['flameless'],
    seoTitle: 'Fig & Amber Room Mist | Ember & Ash',
    seoDescription: 'The Fig & Amber blend in a fine linen-and-air room mist. Water-based and light.',
    variants: [{ sku: 'EMBER-MIST-FIG', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-room-mist', isPrimary: true, alt: 'A room mist in a matte amber bottle' }],
  },
  {
    handle: 'wax-melts',
    title: 'Wax Melt Discovery Set',
    description:
      'All four signature scents in flameless soy melts — one cube in a warmer fills a room, and the set is the low-commitment way to find the blend you’ll want as a full candle. Six cubes of each scent, in a recycled kraft tray.',
    status: 'active',
    productType: 'Wax melts',
    vendor: 'Ember & Ash',
    tags: ['wax-melts', 'flameless', 'sampler'],
    categoryHandles: ['candles'],
    collectionHandles: ['flameless', 'gifts'],
    seoTitle: 'Wax Melt Discovery Set — all four scents | Ember & Ash',
    seoDescription: 'All four signature scents in flameless soy wax melts. Six cubes of each, in a kraft tray.',
    variants: [{ sku: 'EMBER-MELT-SET', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-wax-melts', isPrimary: true, alt: 'A set of soy wax melts in a kraft tray' }],
  },
  {
    handle: 'wick-trimmer',
    title: 'Brass Wick Trimmer',
    description:
      'The one accessory that actually matters. A weighted brass trimmer that snips the wick to the right length and catches the trimming, so every burn stays even and soot-free. The difference between a candle that lasts and one that tunnels.',
    status: 'active',
    productType: 'Accessory',
    vendor: 'Ember & Ash',
    tags: ['accessory', 'brass', 'care'],
    categoryHandles: ['accessories'],
    collectionHandles: ['accessories'],
    seoTitle: 'Brass Wick Trimmer — candle care | Ember & Ash',
    seoDescription: 'A weighted brass wick trimmer that keeps every burn even and soot-free.',
    variants: [{ sku: 'EMBER-ACC-TRIMMER', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-wick-trimmer', isPrimary: true, alt: 'A brass wick trimmer' }],
  },
  {
    handle: 'gift-set',
    title: 'The Signature Trio Gift Set',
    description:
      'The easy yes — Cedar & Smoke, Fig & Amber and Sea Salt & Driftwood in 8 oz tumblers, boxed in recycled kraft and tied in linen ribbon, with a card you can write on. The whole range in miniature, ready to hand over.',
    status: 'active',
    productType: 'Gift set',
    vendor: 'Ember & Ash',
    tags: ['gift', 'set', 'candle'],
    categoryHandles: ['gifts'],
    collectionHandles: ['this-season', 'gifts'],
    seoTitle: 'The Signature Trio Gift Set — three candles | Ember & Ash',
    seoDescription: 'Cedar & Smoke, Fig & Amber and Sea Salt & Driftwood in 8 oz tumblers, boxed and ribboned.',
    variants: [{ sku: 'EMBER-GIFT-TRIO', priceCents: money(84), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-gift-set', isPrimary: true, alt: 'A three-candle gift set boxed in kraft' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'candles', name: 'Candles', description: 'Hand-poured coconut-soy candles.', featured: true },
    { handle: 'diffusers', name: 'Diffusers & mists', description: 'Flameless fragrance for every room.', featured: true },
    { handle: 'gifts', name: 'Gifts', description: 'Ready-to-give sets.', featured: true },
    { handle: 'accessories', name: 'Accessories', description: 'Trimmers and candle care.', featured: true },
  ],
  collections: [
    {
      handle: 'this-season',
      name: 'Lit this season',
      description: 'The scents we’re burning right now.',
      type: 'manual',
      featured: true,
      productHandles: ['cedar-smoke', 'fig-amber', 'sea-salt-driftwood', 'gift-set'],
    },
    {
      handle: 'signatures',
      name: 'The signatures',
      description: 'The four scents that define the house.',
      type: 'manual',
      featured: true,
      productHandles: ['cedar-smoke', 'fig-amber', 'sea-salt-driftwood', 'black-fir-ash'],
    },
    {
      handle: 'woodsmoke',
      name: 'Woodsmoke',
      description: 'The dark, woody, smoky end of the shelf.',
      type: 'manual',
      featured: false,
      productHandles: ['cedar-smoke', 'black-fir-ash'],
    },
    {
      handle: 'flameless',
      name: 'Flameless',
      description: 'Fragrance without a flame — diffusers, mists and melts.',
      type: 'manual',
      featured: false,
      productHandles: ['reed-diffuser', 'room-mist', 'wax-melts'],
    },
    {
      handle: 'gifts',
      name: 'Gift-ready',
      description: 'Boxed, ribboned and ready to hand over.',
      type: 'manual',
      featured: true,
      productHandles: ['gift-set', 'wax-melts'],
    },
    {
      handle: 'accessories',
      name: 'Candle care',
      description: 'Keep every burn even.',
      type: 'manual',
      featured: false,
      productHandles: ['wick-trimmer'],
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
    slug: 'how-we-pour',
    status: 'published',
    body: {
      title: 'How we pour, and why we wait two weeks',
      excerpt: 'Pouring a candle is the easy part. Getting it to burn clean and smell like itself is where the patience goes.',
      featuredImage: { $asset: 'post-pour' },
      body: {
        type: 'doc',
        content: [
          para('A candle looks like the simplest thing in the world — wax, a wick, a scent. It is not. Wax has a temperature at which it wants to accept fragrance and a different one at which it wants to be poured, and those two numbers fight each other. Pour too hot and the scent flashes off and the top sinks; pour too cool and the wax seizes and pulls away from the glass in ugly wet spots. The whole craft is in the few degrees between.'),
          h2('Coconut-soy, cotton wick, small batch'),
          para('We pour in coconut-soy wax with cotton wicks, in batches of a few dozen. Coconut-soy holds fragrance better than straight soy and burns cleaner than paraffin, and a small batch is the only way to keep a nose on every pour — to catch the one jar that set wrong before it ever reaches a shelf. We hand-pour, wick by wick, and weigh the fragrance load to the gram so a scent is the same strength every time you buy it.'),
          h2('The two-week cure'),
          para('Then we wait. A freshly poured candle hasn’t bonded its fragrance into the wax yet — light it the next day and it smells thin and burns rough. So every candle cures for two weeks before it ships, resting in the dark while the scent settles into the structure of the wax. It is the least glamorous part of the process and the one that matters most: it’s the difference between a candle that smells like itself and one that smells like an idea of itself.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'get-a-clean-even-burn',
    status: 'published',
    body: {
      title: 'How to get a clean, even burn',
      excerpt: 'Two habits — one before you ever light it, one every time after — and a candle lasts a third longer and never tunnels.',
      featuredImage: { $asset: 'post-care' },
      body: {
        type: 'doc',
        content: [
          para('Most candles die badly not because they were made badly but because of two small things nobody tells you. Get these right and the same candle lasts noticeably longer, burns without soot, and gives you an even pool right down to the last hour.'),
          h2('The first burn sets the memory'),
          para('Wax has a memory. The very first time you light a candle, let it burn long enough for the melted pool to reach the full edge of the glass — usually two to three hours for our tumblers. If you blow it out early, the wax remembers that smaller pool and tunnels down the middle from then on, leaving a ring of unused wax on the sides and drowning the wick. Give it that first full melt and it will burn edge-to-edge for the rest of its life.'),
          h2('Trim the wick, every time'),
          para('Before every single light, trim the wick down to about a quarter inch — a trimmer is easiest, but nail scissors do it. A long wick burns too hot, flickers, mushrooms a little black ball of carbon on the tip, and throws soot up the glass. A short trimmed wick burns low, steady and clean. It takes five seconds and it’s the single biggest thing you can do for a candle. When there’s about a half-inch of wax left at the bottom, retire it — below that the flame is too close to the glass.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'building-a-scent',
    status: 'published',
    body: {
      title: 'How a scent gets built',
      excerpt: 'A fragrance isn’t one smell — it’s three layers that arrive in order. Here’s how we build one, and why Cedar & Smoke took a year.',
      featuredImage: { $asset: 'post-scent' },
      body: {
        type: 'doc',
        content: [
          para('People talk about a candle’s scent as if it’s a single thing, but a good fragrance unfolds in time. There’s the top note that hits you first and burns off fast, the heart that fills the room for the middle of the evening, and the base that lingers low and long after everything else has faded. Build a scent that’s all top and it’s thrilling for ten minutes and gone; build it all base and it’s a heavy fog. The art is in the handoff between the three.'),
          h2('Top, heart, base'),
          para('When we blend, we work backwards from the base. Cedar & Smoke is built on vetiver and a smoke accord — the part that has to still be there at the bottom of the jar. Onto that we layer the heart of dry cedar and sawdust, the note meant to actually fill a room. And only last do we add the top: a little clove and cracked pepper to give the first minute some lift. Change any one layer and the other two shift under it, which is why a blend is never really finished, only decided.'),
          h2('Why it takes so long'),
          para('Cedar & Smoke took the better part of a year and something like forty test pours. A blend that smells right on a scent blotter can smell wrong in hot wax, and a blend that’s perfect cold can go flat once it’s throwing heat across a room. So we pour it, cure it, burn a whole candle down, adjust a note by a fraction of a percent, and pour it again. A scent earns its name only once it survives that — cold, hot, first hour and last.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-candle-apothecary',
  key: 'sparx-retail-candle-apothecary',
  name: 'Candle Apothecary (Retail)',
  theme: THEME,
  summary:
    'A complete, working shop for a candle & home-fragrance apothecary: a real catalogue of hand-poured signature candles, a reed diffuser, a room mist, a wax-melt set, candle-care accessories and a gift set, with categories, collections, a bespoke candlelit PDP and a full merchandised home page. Moody apothecary theme — warm charcoal ground, ember accent, a characterful serif. Shipped as Ember & Ash.',
  tagline: 'A moody, working storefront for a candle apothecary.',
  vertical: 'retail',
  industry: 'Candle & home fragrance',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 86,
  brand: {
    businessName: 'Ember & Ash',
    tagline: 'A room, and then a mood.',
  },
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Ember & Ash — hand-poured candles & home fragrance',
      description:
        'Ember & Ash is a small apothecary of hand-poured candles, diffusers and home fragrance — blended to smell like somewhere, poured in small batches and cured before it ships.',
    },
    about: {
      title: 'About Ember & Ash',
      description:
        'How Ember & Ash blends, pours and cures — coconut-soy wax, cotton wicks, scents built toward places and hours, and nothing out the door before it’s ready.',
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
