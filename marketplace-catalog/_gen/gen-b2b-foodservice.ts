// sparx-b2b-foodservice — a B2B/WHOLESALE commerce site template: a foodservice supplier.
//
// The B2B analog of the retail gold reference: a complete, working WHOLESALE shop the moment
// it installs — a real trade catalogue sold by the case/sack/carton (bulk pantry, oils &
// staples, packaging and disposables) with pack qty + MOQ on every line and per-case trade
// prices, categories + collections, a bespoke trade PDP (buy-by-the-case + a trade pricing &
// delivery note), and the full 9-page commerce site (home merchandising → shop → collections →
// cart → search → journal → about → contact), dressed in an INLINE bespoke theme (warm larder
// cream + deep provisions-green primary + copper accent). Shipped as The Larder Supply Co.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme inline
// and passes it on the spec (`theme`), so the whole family can be authored in parallel without
// any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-foodservice.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-foodservice/**" \
//     "marketplace-catalog/_gen/gen-b2b-foodservice.ts"
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
// A dependable foodservice supplier: a warm larder-cream ground, deep provisions-green ink,
// a confident deep-green primary and a copper accent, under a clean grotesk display over a
// humanist sans. Complete light + dark, AA on every role (the blueprint sweep's contrast
// check is the gate). Every role used as TEXT on the light ground sits ≤ ~50% L.
const THEME = defineTheme({
  name: 'larder-trade',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.375rem', field: '0.375rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: ['oklch(97% 0.014 95)', 'oklch(94% 0.018 92)', 'oklch(89% 0.022 88)', 'oklch(25% 0.03 150)'],
    roles: {
      primary: 'oklch(40% 0.08 152)',
      secondary: 'oklch(44% 0.05 150)',
      accent: 'oklch(48% 0.13 52)',
      neutral: 'oklch(27% 0.03 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(22% 0.03 150)', 'oklch(19% 0.03 150)', 'oklch(16% 0.025 150)', 'oklch(95% 0.014 95)'],
    roles: {
      primary: 'oklch(76% 0.12 150)',
      secondary: 'oklch(78% 0.05 150)',
      accent: 'oklch(72% 0.13 52)',
      neutral: 'oklch(32% 0.02 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "larder-hero": "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2tlZCUyMHBhbGxldHMlMjBjYXNlcyUyMHdob2xlc2FsZSUyMGZvb2QlMjBzdXBwbHklMjB3YXJlaG91c2V8ZW58MHwwfHx8MTc4NjQxMzI3OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larder-tile-pantry": "https://images.unsplash.com/photo-1590150391928-7c3ae3afc70e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2Fja3MlMjBmbG91ciUyMGNhc2VzfGVufDB8MHx8fDE3ODY0MTM2MjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larder-tile-oils": "https://images.unsplash.com/photo-1565273975921-c884f2b703df?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2F0ZXJpbmclMjB0aW5zJTIwb2xpdmUlMjBvaWwlMjB3aG9sZXNhbGUlMjBzYWNrJTIwY29mZmVlfGVufDB8MHx8fDE3ODY0MTMyODR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larder-tile-packaging": "https://images.unsplash.com/photo-1648587456176-4969b0124b12?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBrcmFmdCUyMHRha2Vhd2F5JTIwYm94ZXMlMjBwYXBlciUyMGN1cHN8ZW58MHwwfHx8MTc4NjQxMzI4Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larder-tile-disposables": "https://images.unsplash.com/photo-1711885417467-6eac5cb81607?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FydG9ucyUyMG5hcGtpbnMlMjBib3hlcyUyMGNhdGVyaW5nJTIwZ2xvdmVzfGVufDB8MHx8fDE3ODY0MTMyODl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larder-band-delivery": "https://images.unsplash.com/photo-1622021142947-da7dedc7c39a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVsaXZlcnklMjBkcml2ZXIlMjB3aGVlbGluZyUyMGNhc2VzJTIwaW50byUyMHJlc3RhdXJhbnQlMjBraXRjaGVufGVufDB8MHx8fDE3ODY0MTMyOTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larder-band-account": "https://images.unsplash.com/photo-1529003600303-bd51f39627fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Y2hlZiUyMHN1cHBsaWVyJTIwcmVwJTIwcmV2aWV3aW5nJTIwb3JkZXIlMjBzaGVldCUyMGtpdGNoZW58ZW58MHwwfHx8MTc4NjQxMzI5NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-sugar": "https://images.unsplash.com/photo-1673791031093-eb8eefa60083?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8MjVrZyUyMHNhY2slMjBmaW5lJTIwY2FzdGVyJTIwc3VnYXJ8ZW58MHwwfHx8MTc4NjQxMzMwMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-tomatoes": "https://images.unsplash.com/photo-1594978583693-8dfdfc93f052?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2F0ZXJpbmclMjBjYXNlJTIwY2hvcHBlZCUyMGl0YWxpYW4lMjB0b21hdG9lc3xlbnwwfDB8fHwxNzg2NDEzMzA0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-oil": "https://images.unsplash.com/photo-1634657443172-efbae44fd04b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGZvdXIlMjA1LWxpdHJlJTIwdGlucyUyMGV4dHJhJTIwdmlyZ2luJTIwb2xpdmV8ZW58MHwwfHx8MTc4NjQxMzMwOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-coffee": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8NWtnJTIwd2hvbGVzYWxlJTIwYmFnJTIwZXNwcmVzc28lMjByb2FzdCUyMGNvZmZlZSUyMGJlYW5zfGVufDB8MHx8fDE3ODY0MTMzMTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-boxes": "https://images.unsplash.com/photo-1700165644892-3dd6b67b25bc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FydG9uJTIwa3JhZnQlMjBmb29kfGVufDB8MHx8fDE3ODY0MTM2Mjh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-napkins": "https://images.unsplash.com/photo-1584651772793-d555266cce99?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVsayUyMGNhcnRvbiUyMGRpbm5lciUyMG5hcGtpbnN8ZW58MHwwfHx8MTc4NjQxMzMxOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-starter": "https://images.unsplash.com/photo-1726378139674-b5918cbdc91c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FmZSUyMHN0YXJ0ZXIlMjBwYWNrfGVufDB8MHx8fDE3ODY0MTM2MzN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-sourcing": "https://images.unsplash.com/photo-1533900298318-6b8da08a523e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y3JhdGVzJTIwcHJvZHVjZSUyMGJlaW5nJTIwY2hlY2tlZCUyMG1hcmtldCUyMGZpcnN0JTIwbGlnaHR8ZW58MHwwfHx8MTc4NjQxMzMyN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-ordering": "https://images.unsplash.com/photo-1778792447408-b22ad88daa37?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8a2l0Y2hlbiUyMG1hbmFnZXIlMjBwbGFjaW5nJTIwc3RhbmRpbmclMjBvcmRlciUyMHRhYmxldHxlbnwwfDB8fHwxNzg2NDEzMzMwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-storage": "https://images.unsplash.com/photo-1650229068182-6931ccb389c2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VsbC1vcmdhbmlzZWQlMjBkcnklMjBzdG9yZSUyMGxhYmVsbGVkJTIwc2hlbHZpbmd8ZW58MHwwfHx8MTc4NjQxMzMzM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'larder-hero', url: src('larder-hero'), alt: 'Stacked pallets and cases in a wholesale food supply warehouse' },
  { id: 'larder-tile-pantry', url: src('larder-tile-pantry'), alt: 'Sacks of flour and cases of tinned goods on a pantry shelf' },
  { id: 'larder-tile-oils', url: src('larder-tile-oils'), alt: 'Catering tins of olive oil and a wholesale sack of coffee beans' },
  { id: 'larder-tile-packaging', url: src('larder-tile-packaging'), alt: 'A stack of kraft takeaway boxes and paper cups' },
  { id: 'larder-tile-disposables', url: src('larder-tile-disposables'), alt: 'Cartons of napkins and boxes of catering gloves' },
  { id: 'larder-band-delivery', url: src('larder-band-delivery'), alt: 'A delivery driver wheeling cases into a restaurant kitchen at dawn' },
  { id: 'larder-band-account', url: src('larder-band-account'), alt: 'A chef and a supplier rep reviewing an order sheet in a kitchen' },
  { id: 'prod-flour', url: src('prod-flour'), alt: 'A 16kg sack of baker’s flour' },
  { id: 'prod-sugar', url: src('prod-sugar'), alt: 'A 25kg sack of fine caster sugar' },
  { id: 'prod-tomatoes', url: src('prod-tomatoes'), alt: 'A catering case of chopped Italian tomatoes' },
  { id: 'prod-oil', url: src('prod-oil'), alt: 'A case of four 5-litre tins of extra virgin olive oil' },
  { id: 'prod-coffee', url: src('prod-coffee'), alt: 'A 5kg wholesale bag of espresso roast coffee beans' },
  { id: 'prod-cups', url: src('prod-cups'), alt: 'A case of a thousand single-wall paper takeaway cups' },
  { id: 'prod-boxes', url: src('prod-boxes'), alt: 'A carton of kraft food boxes for takeaway' },
  { id: 'prod-napkins', url: src('prod-napkins'), alt: 'A bulk carton of dinner napkins' },
  { id: 'prod-gloves', url: src('prod-gloves'), alt: 'A case of powder-free nitrile catering gloves' },
  { id: 'prod-starter', url: src('prod-starter'), alt: 'A cafe starter pack of coffee, cups, napkins and boxes' },
  { id: 'post-sourcing', url: src('post-sourcing'), alt: 'Crates of produce being checked at a market at first light' },
  { id: 'post-ordering', url: src('post-ordering'), alt: 'A kitchen manager placing a standing order on a tablet' },
  { id: 'post-storage', url: src('post-storage'), alt: 'A well-organised dry store with labelled shelving' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-b2b-foodservice: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warehouse photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a trade-account link. Never ink
 *  on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('larder-hero'), alt: 'A wholesale food supply warehouse', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'The pantry behind your kitchen.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'The Larder Supply Co. keeps cafes, restaurants and canteens stocked — bulk pantry, oils and staples, packaging and disposables, all by the case at trade prices. One supplier, one delivery, one invoice a month.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Browse the catalogue' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/contact' },
                      text: 'Open a trade account',
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
            text: 'Order by department',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'larder-tile-pantry', label: 'Pantry', href: '/shop', alt: 'Sacks of flour and cases of tinned goods' }),
              categoryTile({ assetId: 'larder-tile-oils', label: 'Oils & staples', href: '/shop', alt: 'Catering tins of oil and a sack of coffee' }),
              categoryTile({ assetId: 'larder-tile-packaging', label: 'Packaging', href: '/shop', alt: 'Kraft takeaway boxes and paper cups' }),
              categoryTile({ assetId: 'larder-tile-disposables', label: 'Disposables', href: '/shop', alt: 'Cartons of napkins and boxes of gloves' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The "how wholesale ordering works" band — the trade terms, stated plainly as COPY. A
 *  heading over a grid of five plain-language cards: trade pricing, minimum order, delivery
 *  schedule, net terms, and a named account manager. */
function howItWorks(): Node {
  const step = (o: { title: string; body: string }): Node =>
    el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
      children: [
        el('h3', 'text-lg font-semibold tracking-tight text-base-content', { text: o.title }),
        el('p', 'text-base leading-relaxed text-base-content', { text: o.body }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('div', 'flex flex-col gap-4', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'How wholesale ordering works',
              }),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'Buying by the case should be simple. Open an account, order what you need, and let us handle the rest — here is exactly what to expect.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3 @3xl:gap-6', {
            children: [
              step({
                title: 'Trade pricing',
                body: 'Every price on the site is the trade price per case, sack or carton — no consumer markup. Volume breaks kick in automatically once you order in quantity, and contract pricing is available on lines you buy every week.',
              }),
              step({
                title: 'Minimum order',
                body: 'Orders start at a £250 minimum for delivery, and most lines carry a small minimum order quantity shown on the product. It keeps the truck full and the price low — build a standing order and you will clear it without thinking.',
              }),
              step({
                title: 'Delivery schedule',
                body: 'We run set delivery days by area — order by 2pm the day before and it is on the next scheduled run. Chilled and ambient come on the same truck, so one drop covers the whole order.',
              }),
              step({
                title: 'Net-30 terms',
                body: 'Approved accounts pay on net-30 terms with a single statement at month end, not a card charge per order. Apply once; we run a quick credit check and set your limit.',
              }),
              step({
                title: 'Your account manager',
                body: 'You get a named account manager who knows your kitchen — someone to call about a substitution, a rush, or a new line, who will actually pick up. Not a call centre.',
              }),
              step({
                title: 'One monthly invoice',
                body: 'Every delivery lands on one rolling statement, itemised by order and reconciled to your POs. Your bookkeeper gets one clean invoice a month instead of a drawer full of dockets.',
              }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Trade favourites' }),
  howItWorks(),
  editorialBand({
    heading: 'One delivery, one invoice',
    lead: 'Stop juggling six suppliers and a stack of dockets. We carry the pantry, the oils, the packaging and the disposables on one truck, on your delivery day, reconciled to one statement at month end.',
    assetId: 'larder-band-delivery',
    cta: 'See how ordering works',
    href: '/blog/a-standing-order-that-runs-itself',
    alt: 'A delivery driver wheeling cases into a kitchen',
  }),
  productsBlock({ source: 'commerce.category.pantry', layout: 'carousel', heading: 'Pantry, by the sack' }),
  editorialBand({
    heading: 'A supplier that picks up the phone',
    lead: 'Every account gets a named manager who knows your kitchen — for a substitution, a rush order or a new line. Open a trade account and get trade pricing, net-30 terms and someone who answers.',
    assetId: 'larder-band-account',
    cta: 'Open a trade account',
    href: '/contact',
    alt: 'A chef and a supplier rep reviewing an order sheet',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (supplier label, title, per-case price,
 *  low-stock, description, add-to-cart, a static "Trade pricing & delivery" note, and policy
 *  links). */
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
                    text: 'The Larder Supply Co.',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Trade pricing & delivery' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Prices shown are the trade price per case. Volume breaks apply automatically from 10+ cases, and contract pricing is available on standing-order lines. Approved accounts pay on net-30 terms.',
                  }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Delivered on your area’s set day when ordered by 2pm the day before, on orders over the £250 minimum. Chilled and ambient arrive on one truck, in one drop.',
                  }),
                ],
              }),
              pdpPolicyLinks({
                className:
                  'flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-base-300 pt-5 text-sm font-semibold uppercase tracking-widest text-base-content',
                linkClass: 'underline underline-offset-4',
                shippingLabel: 'Delivery & minimums',
                returnsLabel: 'Returns & credits',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Order these together' });

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
    'The trade catalogue',
    'Everything we carry, by the case, sack and carton — pantry, oils and staples, packaging and disposables. Every price is the trade price; filter by department or search for a line, and build your order. Minimum order £250 for delivery.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead(
    'Order guides',
    'The catalogue grouped the way a kitchen actually orders — trade favourites, the essentials a new account starts with, the dry-store staples, and the back-of-house packaging and disposables run.'
  ),
];
const SEARCH: Node[] = [
  pageMasthead('Search the catalogue', 'Looking for a line, a case size or a delivery detail? Search the whole trade catalogue and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Delivery starts at a £250 minimum and lands on your area’s set day when you order by 2pm the day before. Approved accounts check out on net-30 terms — one statement at month end, not a charge per order.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Larder journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Practical notes for the people who run the kitchen — how we source, how to set a standing order that runs itself, and how to keep a dry store that never runs short. Plain and useful, no fluff.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About The Larder' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The Larder Supply Co. started on a single van, supplying a handful of cafes that were tired of chasing six different suppliers for one week’s order. It grew the way good trade relationships do — one kitchen, one standing order, one reliable delivery at a time — and it still runs on the same promise: carry the whole order, price it fairly, and turn up when we said we would.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We buy in volume and pass the price on — pantry by the sack, oils and staples by the case, packaging and disposables by the carton. Because we carry the breadth, a cafe, a bistro and a staff canteen can all clear their order with one supplier and one invoice, instead of a drawer full of dockets.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No consumer markup, no order too small once you are set up, and a named account manager who knows your kitchen. Trade pricing, net-30 terms, and a delivery you can build a prep list around.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Open a trade account' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Tell us about your kitchen — what you run, roughly what you order, and where you are. We will set up your account, run a quick credit check for net-30 terms, and get a named manager on your first delivery.',
          }),
          el('a', 'btn btn-primary btn-lg', { attrs: { href: 'mailto:accounts@lardersupply.example' }, text: 'Email the trade desk' }),
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

const VENDOR = 'The Larder Supply Co.';

/** A single-line case/sack/carton product — one default variant at the trade price. */
const caseItem = (opts: {
  handle: string;
  title: string;
  description: string;
  price: number;
  sku: string;
  productType: string;
  category: string;
  collections: string[];
  tags: string[];
  asset: string;
  alt: string;
  seoTitle: string;
  seoDescription: string;
}): Product => ({
  handle: opts.handle,
  title: opts.title,
  description: opts.description,
  status: 'active',
  productType: opts.productType,
  vendor: VENDOR,
  tags: opts.tags,
  categoryHandles: [opts.category],
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  variants: [{ sku: opts.sku, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue' }],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.alt }],
});

const PRODUCTS: Product[] = [
  caseItem({
    handle: 'bakers-flour-16kg',
    title: 'Baker’s Flour — 16kg Sack',
    description:
      'A strong, consistent baker’s flour milled for volume kitchens — reliable protein for bread, pizza and pastry that behaves the same batch to batch. Sold as a 16kg sack. Minimum order 2 sacks. Trade price per sack; volume breaks from 10 sacks.',
    price: 26,
    sku: 'LARD-FLOUR-16',
    productType: 'Dry goods',
    category: 'pantry',
    collections: ['trade-favourites', 'pantry-staples', 'new-account-essentials'],
    tags: ['pantry', 'baking', 'bulk', 'dry-goods'],
    asset: 'prod-flour',
    alt: 'A 16kg sack of baker’s flour',
    seoTitle: 'Baker’s Flour, 16kg sack — wholesale | The Larder Supply Co.',
    seoDescription: 'Strong, consistent baker’s flour by the 16kg sack at trade prices. MOQ 2 sacks, volume breaks from 10.',
  }),
  caseItem({
    handle: 'caster-sugar-25kg',
    title: 'Fine Caster Sugar — 25kg Sack',
    description:
      'A fine, fast-dissolving caster sugar for bakery, pastry and front-of-house alike. Free-flowing and screened for consistency, sold as a 25kg sack. Minimum order 1 sack. Trade price per sack; volume breaks from 8 sacks.',
    price: 29,
    sku: 'LARD-SUGAR-25',
    productType: 'Dry goods',
    category: 'pantry',
    collections: ['pantry-staples'],
    tags: ['pantry', 'baking', 'bulk', 'dry-goods'],
    asset: 'prod-sugar',
    alt: 'A 25kg sack of fine caster sugar',
    seoTitle: 'Fine Caster Sugar, 25kg sack — wholesale | The Larder Supply Co.',
    seoDescription: 'Fine, fast-dissolving caster sugar by the 25kg sack at trade prices. MOQ 1 sack, volume breaks from 8.',
  }),
  caseItem({
    handle: 'chopped-tomatoes-case',
    title: 'Italian Chopped Tomatoes — Case of 12',
    description:
      'Ripe Italian chopped tomatoes in a rich natural juice — the backbone of every sauce, braise and soup on the menu. Case of 12 × 2.5kg tins. Minimum order 2 cases. Trade price per case; volume breaks from 10 cases.',
    price: 32,
    sku: 'LARD-TOM-2500',
    productType: 'Tinned goods',
    category: 'pantry',
    collections: ['trade-favourites', 'pantry-staples'],
    tags: ['pantry', 'tinned', 'bulk', 'sauce'],
    asset: 'prod-tomatoes',
    alt: 'A catering case of chopped Italian tomatoes',
    seoTitle: 'Italian Chopped Tomatoes, case of 12 — wholesale | The Larder Supply Co.',
    seoDescription: 'Ripe Italian chopped tomatoes, case of 12 × 2.5kg tins at trade prices. MOQ 2 cases, volume breaks from 10.',
  }),
  caseItem({
    handle: 'extra-virgin-olive-oil-case',
    title: 'Extra Virgin Olive Oil — Case of 4 × 5L',
    description:
      'A smooth, everyday extra virgin olive oil for dressing, roasting and finishing — big enough flavour to matter, priced to pour freely. Case of 4 × 5-litre tins. Minimum order 1 case. Trade price per case; volume breaks from 6 cases.',
    price: 92,
    sku: 'LARD-EVOO-5L',
    productType: 'Oils',
    category: 'oils-staples',
    collections: ['trade-favourites', 'oils-and-staples'],
    tags: ['oils', 'staples', 'bulk', 'catering'],
    asset: 'prod-oil',
    alt: 'A case of four 5-litre tins of extra virgin olive oil',
    seoTitle: 'Extra Virgin Olive Oil, case of 4 × 5L — wholesale | The Larder Supply Co.',
    seoDescription: 'Smooth everyday extra virgin olive oil, case of 4 × 5L tins at trade prices. MOQ 1 case, volume breaks from 6.',
  }),
  caseItem({
    handle: 'espresso-beans-5kg',
    title: 'Espresso Roast Beans — 5kg Wholesale Bag',
    description:
      'A chocolatey, forgiving espresso blend roasted for volume service — pulls a sweet, consistent shot and stands up to milk all day. Sold as a 5kg wholesale bag, whole bean. Minimum order 2 bags. Trade price per bag; volume breaks from 8 bags.',
    price: 74,
    sku: 'LARD-COFFEE-5K',
    productType: 'Coffee',
    category: 'oils-staples',
    collections: ['trade-favourites', 'oils-and-staples', 'new-account-essentials'],
    tags: ['coffee', 'staples', 'bulk', 'cafe'],
    asset: 'prod-coffee',
    alt: 'A 5kg wholesale bag of espresso roast coffee beans',
    seoTitle: 'Espresso Roast Beans, 5kg wholesale bag — wholesale | The Larder Supply Co.',
    seoDescription: 'A chocolatey, forgiving espresso blend by the 5kg bag at trade prices. MOQ 2 bags, volume breaks from 8.',
  }),
  {
    handle: 'takeaway-cups-1000',
    title: 'Single-Wall Takeaway Cups — Case of 1000',
    description:
      'Sturdy single-wall paper hot cups with a rolled rim that seats a lid cleanly and holds heat without collapsing. Case of 1000, lids sold separately. Minimum order 1 case. Choose your size below. Trade price per case; volume breaks from 10 cases.',
    status: 'active',
    productType: 'Packaging',
    vendor: VENDOR,
    tags: ['packaging', 'takeaway', 'bulk', 'cafe'],
    categoryHandles: ['packaging'],
    collectionHandles: ['packaging-disposables', 'new-account-essentials'],
    seoTitle: 'Single-Wall Takeaway Cups, case of 1000 — wholesale | The Larder Supply Co.',
    seoDescription: 'Sturdy single-wall paper hot cups, case of 1000, in 8/12/16oz at trade prices. MOQ 1 case.',
    options: [
      { name: 'Cup size', displayType: 'dropdown', values: [{ value: '8oz' }, { value: '12oz' }, { value: '16oz' }] },
    ],
    variants: [
      { sku: 'LARD-CUP-08', priceCents: money(79), isDefault: true, inventoryPolicy: 'continue', optionValues: { 'Cup size': '8oz' } },
      { sku: 'LARD-CUP-12', priceCents: money(85), inventoryPolicy: 'continue', optionValues: { 'Cup size': '12oz' } },
      { sku: 'LARD-CUP-16', priceCents: money(92), inventoryPolicy: 'continue', optionValues: { 'Cup size': '16oz' } },
    ],
    images: [{ assetId: 'prod-cups', isPrimary: true, alt: 'A case of a thousand paper takeaway cups' }],
  },
  {
    handle: 'kraft-food-boxes-500',
    title: 'Kraft Food Boxes — Carton of 500',
    description:
      'Grease-resistant kraft boxes for burgers, bowls and takeaway service — flat-packed, fold in seconds and stack tidy on the pass. Carton of 500. Minimum order 1 carton. Choose your size below. Trade price per carton; volume breaks from 8 cartons.',
    status: 'active',
    productType: 'Packaging',
    vendor: VENDOR,
    tags: ['packaging', 'takeaway', 'bulk', 'kraft'],
    categoryHandles: ['packaging'],
    collectionHandles: ['packaging-disposables', 'back-of-house'],
    seoTitle: 'Kraft Food Boxes, carton of 500 — wholesale | The Larder Supply Co.',
    seoDescription: 'Grease-resistant kraft takeaway boxes, carton of 500, regular or large, at trade prices. MOQ 1 carton.',
    options: [
      { name: 'Box size', displayType: 'dropdown', values: [{ value: 'Regular' }, { value: 'Large' }] },
    ],
    variants: [
      { sku: 'LARD-BOX-REG', priceCents: money(64), isDefault: true, inventoryPolicy: 'continue', optionValues: { 'Box size': 'Regular' } },
      { sku: 'LARD-BOX-LRG', priceCents: money(82), inventoryPolicy: 'continue', optionValues: { 'Box size': 'Large' } },
    ],
    images: [{ assetId: 'prod-boxes', isPrimary: true, alt: 'A carton of kraft food boxes' }],
  },
  caseItem({
    handle: 'dinner-napkins-carton',
    title: 'Dinner Napkins — Carton of 4000',
    description:
      'Soft two-ply dinner napkins in a clean natural white, quarter-folded and ready for the dispenser. Bulk carton of 4000. Minimum order 1 carton. Trade price per carton; volume breaks from 6 cartons.',
    price: 41,
    sku: 'LARD-NAP-4000',
    productType: 'Disposables',
    category: 'disposables',
    collections: ['packaging-disposables', 'back-of-house'],
    tags: ['disposables', 'front-of-house', 'bulk', 'paper'],
    asset: 'prod-napkins',
    alt: 'A bulk carton of dinner napkins',
    seoTitle: 'Dinner Napkins, carton of 4000 — wholesale | The Larder Supply Co.',
    seoDescription: 'Soft two-ply dinner napkins, bulk carton of 4000 at trade prices. MOQ 1 carton, volume breaks from 6.',
  }),
  {
    handle: 'nitrile-gloves-case',
    title: 'Nitrile Gloves — Case of 1000',
    description:
      'Powder-free nitrile catering gloves — tough, tactile and food-safe, the ones that don’t tear when you’re boning a tray of chicken. Case of 1000 (10 boxes of 100). Minimum order 1 case. Choose your size below. Trade price per case; volume breaks from 6 cases.',
    status: 'active',
    productType: 'Disposables',
    vendor: VENDOR,
    tags: ['disposables', 'back-of-house', 'bulk', 'ppe'],
    categoryHandles: ['disposables'],
    collectionHandles: ['packaging-disposables', 'back-of-house', 'new-account-essentials'],
    seoTitle: 'Nitrile Gloves, case of 1000 — wholesale | The Larder Supply Co.',
    seoDescription: 'Powder-free food-safe nitrile gloves, case of 1000, in S/M/L at trade prices. MOQ 1 case.',
    options: [
      { name: 'Glove size', displayType: 'dropdown', values: [{ value: 'Small' }, { value: 'Medium' }, { value: 'Large' }] },
    ],
    variants: [
      { sku: 'LARD-GLV-S', priceCents: money(56), inventoryPolicy: 'continue', optionValues: { 'Glove size': 'Small' } },
      { sku: 'LARD-GLV-M', priceCents: money(56), isDefault: true, inventoryPolicy: 'continue', optionValues: { 'Glove size': 'Medium' } },
      { sku: 'LARD-GLV-L', priceCents: money(56), inventoryPolicy: 'continue', optionValues: { 'Glove size': 'Large' } },
    ],
    images: [{ assetId: 'prod-gloves', isPrimary: true, alt: 'A case of nitrile catering gloves' }],
  },
  {
    handle: 'cafe-starter-pack',
    title: 'Cafe Starter Pack',
    description:
      'Everything a new cafe needs on day one, priced as a kit — a 5kg bag of espresso beans, a case of 1000 12oz cups with lids, a carton of napkins and 500 kraft boxes. One SKU to open the doors. Minimum order 1 pack; reorder the lines individually after.',
    status: 'active',
    productType: 'Bundle',
    vendor: VENDOR,
    tags: ['bundle', 'starter', 'cafe', 'new-account'],
    categoryHandles: ['oils-staples'],
    collectionHandles: ['trade-favourites', 'new-account-essentials'],
    seoTitle: 'Cafe Starter Pack — wholesale opening kit | The Larder Supply Co.',
    seoDescription: 'A day-one opening kit for a new cafe — espresso beans, cups, napkins and kraft boxes in one trade SKU.',
    variants: [{ sku: 'LARD-STARTER', priceCents: money(219), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-starter', isPrimary: true, alt: 'A cafe starter pack of coffee, cups, napkins and boxes' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'pantry', name: 'Pantry', description: 'Flour, sugar, tinned goods and dry-store staples by the sack and case.', featured: true },
    { handle: 'oils-staples', name: 'Oils & staples', description: 'Cooking oils, coffee and the everyday staples, by the case.', featured: true },
    { handle: 'packaging', name: 'Packaging', description: 'Takeaway cups, boxes and containers by the carton.', featured: true },
    { handle: 'disposables', name: 'Disposables', description: 'Napkins, gloves and front-of-house consumables in bulk.', featured: true },
  ],
  collections: [
    {
      handle: 'trade-favourites',
      name: 'Trade favourites',
      description: 'The lines our kitchens reorder every single week.',
      type: 'manual',
      featured: true,
      productHandles: ['bakers-flour-16kg', 'chopped-tomatoes-case', 'extra-virgin-olive-oil-case', 'espresso-beans-5kg', 'cafe-starter-pack'],
    },
    {
      handle: 'new-account-essentials',
      name: 'New-account essentials',
      description: 'Opening a kitchen? Start here — the first order, sorted.',
      type: 'manual',
      featured: true,
      productHandles: ['cafe-starter-pack', 'bakers-flour-16kg', 'espresso-beans-5kg', 'takeaway-cups-1000', 'nitrile-gloves-case'],
    },
    {
      handle: 'pantry-staples',
      name: 'Pantry staples',
      description: 'The dry store — flour, sugar and tinned goods by the sack.',
      type: 'manual',
      featured: false,
      productHandles: ['bakers-flour-16kg', 'caster-sugar-25kg', 'chopped-tomatoes-case'],
    },
    {
      handle: 'oils-and-staples',
      name: 'Oils & staples',
      description: 'Cooking oil and coffee, by the case.',
      type: 'manual',
      featured: false,
      productHandles: ['extra-virgin-olive-oil-case', 'espresso-beans-5kg'],
    },
    {
      handle: 'packaging-disposables',
      name: 'Packaging & disposables',
      description: 'The front-of-house run — cups, boxes, napkins and gloves.',
      type: 'manual',
      featured: false,
      productHandles: ['takeaway-cups-1000', 'kraft-food-boxes-500', 'dinner-napkins-carton', 'nitrile-gloves-case'],
    },
    {
      handle: 'back-of-house',
      name: 'Back of house',
      description: 'The consumables the kitchen burns through — gloves, napkins, boxes.',
      type: 'manual',
      featured: false,
      productHandles: ['nitrile-gloves-case', 'dinner-napkins-carton', 'kraft-food-boxes-500'],
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
    slug: 'a-standing-order-that-runs-itself',
    status: 'published',
    body: {
      title: 'A standing order that runs itself',
      excerpt: 'The best order is the one you don’t have to think about. Here’s how to set a weekly standing order that clears the minimum and never runs you short.',
      featuredImage: { $asset: 'post-ordering' },
      body: {
        type: 'doc',
        content: [
          para('The kitchens that never scramble for stock have one thing in common: they don’t place an order every week, they place it once and let it repeat. A standing order takes your predictable lines — the flour, the oil, the cups, the gloves — and sends them on a fixed cadence, so the truck arrives on your day whether or not anyone remembered to click a button.'),
          h2('Build it around what you burn'),
          para('Start with the lines you get through no matter what the specials are. Count a normal week honestly — not a quiet Monday, a real week — and set the standing quantities to cover it with a little headroom. Those lines alone will usually clear the delivery minimum, which means the variable extras ride along at no extra delivery cost.'),
          h2('Leave room to flex'),
          para('A standing order isn’t a straitjacket. Add one-off lines on top whenever the menu shifts, skip a delivery when you’re closed, and adjust the standing quantities once a season as your covers change. Your account manager can tune it with you in five minutes — the point is that the boring 80% of the order handles itself, so you only spend attention on the 20% that actually changes.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'how-we-buy-in-volume',
    status: 'published',
    body: {
      title: 'How we buy in volume, and why your price is lower for it',
      excerpt: 'Trade pricing isn’t a discount we hand out — it’s the result of buying deep and moving fast. Here’s what actually sits behind the number on the shelf.',
      featuredImage: { $asset: 'post-sourcing' },
      body: {
        type: 'doc',
        content: [
          para('A trade price looks like a discount, but it isn’t one — nobody is giving anything away. It’s what a case costs when it’s bought by the pallet, moved before it ages, and sold without a consumer markup stacked on top. Understanding that is the difference between chasing the cheapest line this week and building a supply that stays cheap every week.'),
          h2('Buy deep, move fast'),
          para('We commit to volume with growers, mills and manufacturers, which earns a price a single restaurant could never get on its own. Then we turn that stock over quickly, so we’re never sitting on ageing inventory we have to price up to justify. Deep buying plus fast turnover is the whole trick, and it’s why the per-case price holds instead of drifting.'),
          h2('Volume breaks and contract lines'),
          para('The price drops further the more you take, automatically — order in quantity and the volume break applies at checkout, no haggling. For the lines you buy every week, a contract price locks a number in for the season so you can cost a menu against it. Ask your account manager to set contract pricing on your standing-order lines; it’s the single biggest lever most kitchens leave unpulled.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'a-dry-store-that-never-runs-short',
    status: 'published',
    body: {
      title: 'A dry store that never runs short',
      excerpt: 'Half of stock control is just how the shelves are set up. A few habits that keep a dry store honest, rotated and always one step ahead of the order.',
      featuredImage: { $asset: 'post-storage' },
      body: {
        type: 'doc',
        content: [
          para('You can place a perfect order and still run short if the dry store is chaos. Stock control isn’t a spreadsheet problem so much as a shelving problem: when everything has a place and the place tells you when it’s low, ordering the right amount becomes obvious instead of a guess.'),
          h2('First in, first out — physically'),
          para('Rotate every delivery to the back so the oldest stock sits at the front, and nobody has to check a date to grab the right tin. It takes an extra minute at put-away and saves you from the slow bleed of expired stock at the back of a shelf. Label the shelf edge, not just the product, so the system survives a new starter on their first shift.'),
          h2('Set a par, mark the line'),
          para('Give each staple a par level — the minimum you want on the shelf — and mark it physically with a strip of tape or a line on the wall. When stock drops to the line, it goes on the next order, full stop. A par you can see beats a par in a notebook every time, and it turns “did we order flour?” into a glance instead of a debate.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'b2b-foodservice',
  key: 'sparx-b2b-foodservice',
  name: 'sparx — Foodservice Wholesale',
  theme: THEME,
  summary:
    'A complete, working WHOLESALE shop for a foodservice supplier: a real trade catalogue sold by the case, sack and carton — bulk pantry, oils and staples, packaging and disposables — with pack qty + MOQ on every line, per-case trade prices, categories, collections and a bespoke trade PDP. Warm larder theme — cream ground, deep provisions-green, a copper accent. Shipped as The Larder Supply Co.',
  tagline: 'A working trade counter for a foodservice wholesaler.',
  vertical: 'b2b',
  industry: 'Foodservice wholesale',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 86,
  brand: {
    businessName: 'The Larder Supply Co.',
    tagline: 'The pantry behind your kitchen.',
  },
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'The Larder Supply Co. — foodservice wholesale by the case',
      description:
        'The Larder Supply Co. supplies cafes, restaurants and canteens — bulk pantry, oils and staples, packaging and disposables, by the case at trade prices. One delivery, one invoice, net-30 terms.',
    },
    about: {
      title: 'About The Larder Supply Co.',
      description:
        'How The Larder buys in volume, carries the whole order and delivers on your day — trade pricing, net-30 terms and a named account manager for every kitchen.',
    },
    contact: {
      title: 'Open a trade account — The Larder Supply Co.',
      description:
        'Open a wholesale trade account with The Larder Supply Co. — trade pricing, net-30 terms, set delivery days and a named account manager for your kitchen.',
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
