// sparx-retail-ceramics-studio — a RETAIL/COMMERCE site template: a handmade pottery studio.
//
// A complete, working shop the moment it installs — a real catalogue of thrown-and-glazed
// stoneware (mugs, bowls, plates, a serving platter, a vase, a planter, tumblers, a dinner
// set), categories + collections, a bespoke gallery-calm PDP, the full 9-page commerce site
// (home merchandising → shop → collections → cart → search → journal → about → contact),
// dressed in an INLINE bespoke theme (warm clay + stone neutrals, a muted sage glaze accent,
// a refined serif display over a clean sans). Shipped as Kiln & Clay.
//
// SELF-CONTAINED BY DESIGN — like the coffee gold reference, this generator carries its OWN
// theme inline and passes it on the spec (`theme`), so the retail family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The
// shared `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-ceramics-studio.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-ceramics-studio/**" \
//     "marketplace-catalog/_gen/gen-retail-ceramics-studio.ts"
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
// A quiet gallery: warm stoneware-clay paper ground, deep kiln-fired ink, a grounded
// clay-brown primary and a muted sage-glaze accent, under a refined serif display over a
// clean humanist sans. Complete light + dark, AA on every role (the blueprint sweep's
// contrast check is the gate). `secondary` stays dark and legible on the light ground.
const THEME = defineTheme({
  name: 'kiln-clay',
  type: { body: face('Inter', 'sans-serif'), head: face('Cormorant Garamond', 'serif') },
  shape: { selector: '0.375rem', field: '0.25rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: ['oklch(96% 0.009 78)', 'oklch(93% 0.012 74)', 'oklch(88% 0.016 70)', 'oklch(24% 0.02 60)'],
    roles: {
      primary: 'oklch(40% 0.035 62)',
      secondary: 'oklch(43% 0.028 118)',
      accent: 'oklch(52% 0.06 150)',
      neutral: 'oklch(27% 0.02 60)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(22% 0.012 60)', 'oklch(19% 0.012 60)', 'oklch(16% 0.012 60)', 'oklch(94% 0.009 78)'],
    roles: {
      primary: 'oklch(80% 0.045 74)',
      secondary: 'oklch(78% 0.03 120)',
      accent: 'oklch(72% 0.08 150)',
      neutral: 'oklch(32% 0.015 60)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "kiln-hero": "https://images.unsplash.com/photo-1611013621103-91e10668a120?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG90dGVyJTIwcyUyMGhhbmRzJTIwY2VudGVyaW5nJTIwd2V0JTIwY2xheSUyMHNwaW5uaW5nfGVufDB8MHx8fDE3ODY0MDIxODB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-tile-drink": "https://images.unsplash.com/photo-1530968831187-a937ade474cb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8c3RvbmV3YXJlJTIwbXVncyUyMHdhcm18ZW58MHwwfHx8MTc4NjQwMjU0Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-tile-dine": "https://images.unsplash.com/photo-1769690176773-1c6e73bfb26a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZG1hZGUlMjBwbGF0ZXMlMjBib3dscyUyMHN0YWNrZWQlMjB3b29kZW4lMjBzaGVsZnxlbnwwfDB8fHwxNzg2NDAyMTg1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-tile-vessels": "https://images.unsplash.com/photo-1687191883721-257d8cad5b54?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2VyYW1pYyUyMGJ1ZCUyMHZhc2UlMjBob2xkaW5nJTIwc2luZ2xlJTIwZHJpZWQlMjBzdGVtfGVufDB8MHx8fDE3ODY0MDIxODh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-tile-home": "https://images.unsplash.com/photo-1668117653442-dd03862e957f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhemVkJTIwcGxhbnRlciUyMHRyYWlsaW5nJTIwaG91c2VwbGFudCUyMHdpbmRvd3NpbGx8ZW58MHwwfHx8MTc4NjQwMjE5MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-band-studio": "https://images.unsplash.com/photo-1597257457828-ae134977674f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJpbW1lZCUyMHBvdHMlMjBkcnlpbmd8ZW58MHwwfHx8MTc4NjQwMjU0OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-band-glaze": "https://images.unsplash.com/photo-1669393533135-7580ae7ca1c4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZCUyMGRpcHBpbmclMjBib3dsJTIwaW50byUyMGJ1Y2tldCUyMHBhbGUlMjBzYWdlfGVufDB8MHx8fDE3ODY0MDIxOTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-prod-mug": "https://images.unsplash.com/photo-1495100497150-fe209c585f50?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZC10aHJvd24lMjBzdG9uZXdhcmUlMjBtdWclMjBmdWxsJTIwcHVsbGVkJTIwaGFuZGxlfGVufDB8MHx8fDE3ODY0MDIxOTl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-prod-bowl": "https://images.unsplash.com/photo-1519916478825-b1d7aef08f54?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2lkZSUyMGJyZWFrZmFzdCUyMGJvd2wlMjBzb2Z0JTIwc3BlY2tsZWQlMjBnbGF6ZXxlbnwwfDB8fHwxNzg2NDAyMjAyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-prod-plate": "https://images.unsplash.com/photo-1705948730553-3ea0c89ae6fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGlubmVyJTIwcGxhdGUlMjBiYXJlJTIwY2xheSUyMHJpbSUyMGdsYXplZCUyMHdlbGx8ZW58MHwwfHx8MTc4NjQwMjIwNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-prod-platter": "https://images.unsplash.com/photo-1650218385764-ce069ab3e4da?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bG9uZyUyMG92YWwlMjBzZXJ2aW5nJTIwcGxhdHRlciUyMG1hdHRlJTIwYXNoJTIwZ2xhemV8ZW58MHwwfHx8MTc4NjQwMjIwOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-prod-vase": "https://images.unsplash.com/photo-1526198049595-f32cde2a219d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFsbCUyMGJ1ZCUyMHZhc2UlMjBuYXJyb3clMjBuZWNrJTIwc3RvbmUtZ3JleSUyMGdsYXplfGVufDB8MHx8fDE3ODY0MDIyMTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-prod-planter": "https://images.unsplash.com/photo-1670169603920-e2d4080e22d3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9vdGVkJTIwcGxhbnRlciUyMG1hdGNoaW5nJTIwc2F1Y2VyJTIwc2xhdGUlMjBnbGF6ZXxlbnwwfDB8fHwxNzg2NDAyMjE0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-prod-tumblers": "https://images.unsplash.com/photo-1610701596007-11502861dcfa?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RvbmV3YXJlJTIwdHVtYmxlcnMlMjBmYWNldGVkfGVufDB8MHx8fDE3ODY0MDI1NTN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-prod-dinner-set": "https://images.unsplash.com/photo-1614548539924-5c1f205b3747?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm91ci1waWVjZSUyMGRpbm5lciUyMHNldCUyMHBsYXRlcyUyMGJvd2xzfGVufDB8MHx8fDE3ODY0MDIyMjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-prod-jug": "https://images.unsplash.com/photo-1572003414030-4175bcadd3cf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGwlMjBwb3VyaW5nJTIwanVnJTIwcGluY2hlZCUyMHNwb3V0JTIwb2F0bWVhbCUyMGdsYXplfGVufDB8MHx8fDE3ODY0MDIyMjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-post-making": "https://images.unsplash.com/photo-1563433337461-5b65f0834f3a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG90dGVyJTIwdHJpbW1pbmclMjBmb290JTIwbGVhdGhlci1oYXJkJTIwYm93bHxlbnwwfDB8fHwxNzg2NDAyMjI3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-post-glazes": "https://images.unsplash.com/photo-1517340182-ddc4e441b011?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhemUlMjB0ZXN0JTIwdGlsZXN8ZW58MHwwfHx8MTc4NjQwMjU1NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kiln-post-care": "https://images.unsplash.com/photo-1596290618848-fcda233549e3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RvbmV3YXJlJTIwbXVnJTIwYmVpbmclMjBoYW5kLXdhc2hlZCUyMHNvYXB5JTIwc2lua3xlbnwwfDB8fHwxNzg2NDAyMjMzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'kiln-hero', url: src('kiln-hero'), alt: 'A potter’s hands centering wet clay on a spinning wheel' },
  { id: 'kiln-tile-drink', url: src('kiln-tile-drink'), alt: 'A row of stoneware mugs in a warm oatmeal glaze' },
  { id: 'kiln-tile-dine', url: src('kiln-tile-dine'), alt: 'Handmade plates and bowls stacked on a wooden shelf' },
  { id: 'kiln-tile-vessels', url: src('kiln-tile-vessels'), alt: 'A ceramic bud vase holding a single dried stem' },
  { id: 'kiln-tile-home', url: src('kiln-tile-home'), alt: 'A glazed planter with a trailing houseplant on a windowsill' },
  { id: 'kiln-band-studio', url: src('kiln-band-studio'), alt: 'Trimmed pots drying on a plaster bat in a bright studio' },
  { id: 'kiln-band-glaze', url: src('kiln-band-glaze'), alt: 'A hand dipping a bowl into a bucket of pale sage glaze' },
  { id: 'kiln-prod-mug', url: src('kiln-prod-mug'), alt: 'A hand-thrown stoneware mug with a full pulled handle' },
  { id: 'kiln-prod-bowl', url: src('kiln-prod-bowl'), alt: 'A wide breakfast bowl with a soft speckled glaze' },
  { id: 'kiln-prod-plate', url: src('kiln-prod-plate'), alt: 'A dinner plate with a bare clay rim and glazed well' },
  { id: 'kiln-prod-platter', url: src('kiln-prod-platter'), alt: 'A long oval serving platter in a matte ash glaze' },
  { id: 'kiln-prod-vase', url: src('kiln-prod-vase'), alt: 'A tall bud vase with a narrow neck and stone-grey glaze' },
  { id: 'kiln-prod-planter', url: src('kiln-prod-planter'), alt: 'A footed planter and matching saucer in slate glaze' },
  { id: 'kiln-prod-tumblers', url: src('kiln-prod-tumblers'), alt: 'A pair of stoneware tumblers with faceted sides' },
  { id: 'kiln-prod-dinner-set', url: src('kiln-prod-dinner-set'), alt: 'A four-piece dinner set of plates and bowls' },
  { id: 'kiln-prod-jug', url: src('kiln-prod-jug'), alt: 'A small pouring jug with a pinched spout in oatmeal glaze' },
  { id: 'kiln-post-making', url: src('kiln-post-making'), alt: 'A potter trimming the foot of a leather-hard bowl' },
  { id: 'kiln-post-glazes', url: src('kiln-post-glazes'), alt: 'Glaze test tiles laid out in rows of warm neutrals' },
  { id: 'kiln-post-care', url: src('kiln-post-care'), alt: 'A stoneware mug being hand-washed in a soapy sink' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-ceramics-studio: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm studio photograph, a serif headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the
 *  photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('kiln-hero'), alt: 'A potter’s hands centering clay on the wheel', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-semibold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Made by hand, one at a time.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Kiln & Clay is a small pottery studio. We throw every piece on the wheel, glaze it by hand and fire it in our own kiln — so what lands on your table was shaped by someone, not stamped out by a machine.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the studio' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/blog/how-a-piece-is-made' },
                      text: 'How a piece is made',
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
      el('span', 'text-center text-lg font-semibold text-base-content', { text: o.label }),
    ],
  });
}

function categoryTiles(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('h2', 'text-3xl font-semibold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Shop by room',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'kiln-tile-drink', label: 'Drink', href: '/shop', alt: 'Stoneware mugs in an oatmeal glaze' }),
              categoryTile({ assetId: 'kiln-tile-dine', label: 'Dine', href: '/shop', alt: 'Handmade plates and bowls on a shelf' }),
              categoryTile({ assetId: 'kiln-tile-vessels', label: 'Vessels', href: '/shop', alt: 'A ceramic bud vase with a dried stem' }),
              categoryTile({ assetId: 'kiln-tile-home', label: 'Home', href: '/shop', alt: 'A glazed planter on a windowsill' }),
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
                el('h2', 'text-4xl font-semibold leading-none tracking-tight text-base-content @3xl:text-5xl', {
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New from the studio' }),
  editorialBand({
    heading: 'Thrown, trimmed, glazed, fired',
    lead: 'Every piece passes through a lot of hands — and every pair of them is ours. We centre the clay on the wheel, trim the foot when it’s leather-hard, glaze it by hand and fire it twice. Days of work go into a mug you’ll reach for every morning.',
    assetId: 'kiln-band-studio',
    cta: 'How a piece is made',
    href: '/blog/how-a-piece-is-made',
    alt: 'Trimmed pots drying on a plaster bat',
  }),
  productsBlock({ source: 'commerce.category.dine', layout: 'carousel', heading: 'For the everyday table' }),
  editorialBand({
    heading: 'No two are exactly alike',
    lead: 'Because a person made it, a person shows in it — a glaze that pools a little deeper on one side, a rim that carries the maker’s mark. We don’t hide that. It’s the difference between something you own and something you love.',
    assetId: 'kiln-band-glaze',
    cta: 'A word on our glazes',
    href: '/blog/a-word-on-glazes',
    alt: 'A hand dipping a bowl into pale sage glaze',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (studio label, title, price, low-stock,
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
                    text: 'Kiln & Clay',
                  }),
                  pdpTitle('h1', 'text-4xl font-semibold leading-none tracking-tight text-base-content @3xl:text-5xl'),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-semibold text-base-content',
                    compareClass: 'text-lg text-secondary line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 rounded-field border border-base-300 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-base-content',
                    label: 'Last few',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Made to order in the studio' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Each piece is thrown and glazed to order, so allow two to three weeks before it ships. Small variations in glaze, tone and size are the mark of a handmade object — yours will be a little different from the photo, and entirely its own.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Made to go together' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-semibold leading-none tracking-tight text-base-content @3xl:text-6xl', {
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
    'The studio shop',
    'Everything we’re making right now — mugs and tumblers to drink from, plates and bowls to eat off, vases and planters for the rest of the house. Filter by room or glaze; each piece is thrown, glazed and fired by hand, and made to order.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The work grouped the way people actually shop — the newest pieces off the wheel, a set that dresses the everyday table, the drinkware, and gift-ready pairs and sets.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Kiln & Clay', 'Looking for a particular piece, a glaze, or a note from the studio? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-semibold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Everything is made to order and wrapped by hand for the post, so allow two to three weeks. Free shipping on orders over $120. If a piece ever arrives less than perfect, tell us and we’ll put it right.',
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
          el('h1', 'text-5xl font-semibold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'From the studio' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the wheel — how a piece is made, what the glazes are and why they vary, and how to look after handmade ceramics so they last for years. Plain and useful, no pottery mystique.',
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
          el('h1', 'text-5xl font-semibold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Kiln & Clay' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Kiln & Clay began with one secondhand wheel in a spare room and a stubborn idea: that the things you use every day should be worth using. We started making mugs for friends, then for a local café, and it grew the slow way — one firing at a time.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Everything is still made in-house, by us. We throw on the wheel, trim by hand, mix our own glazes from raw materials, and fire twice in a kiln we load ourselves. Nothing is outsourced and nothing is mass-produced — the studio can only make so much, and that’s the point.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We like clay that looks like clay: honest forms, quiet glazes, a bare foot you can feel the grit of. A piece from here should feel good in the hand, live in the dishwasher, and get better the more you use it.',
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
          el('h1', 'text-5xl font-semibold tracking-tight text-base-content @2xl:text-6xl', { text: 'Say hello' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'A question about a piece, a custom commission, or a wholesale enquiry for your shop or café? Tell us what you have in mind and one of us — the people who actually make the work — will write back.',
          }),
          el('a', 'btn btn-primary btn-lg', { attrs: { href: 'mailto:hello@kilnandclay.example' }, text: 'Email the studio' }),
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

// Glaze is the natural per-piece choice — three studio glazes, shown as swatches. Every
// thrown piece ships in all three at one price, so the option adds real variants without a
// price matrix. (Oatmeal is the studio default.)
const GLAZE: OptionDecl = {
  name: 'Glaze',
  displayType: 'swatch',
  values: [{ value: 'Oatmeal' }, { value: 'Ash' }, { value: 'Slate' }],
};

const piece = (opts: {
  handle: string;
  title: string;
  description: string;
  price: number;
  sku: string;
  productType: string;
  categories: string[];
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
  vendor: 'Kiln & Clay',
  tags: opts.tags,
  categoryHandles: opts.categories,
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [GLAZE],
  variants: [
    { sku: `${opts.sku}-OAT`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Glaze: 'Oatmeal' } },
    { sku: `${opts.sku}-ASH`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Glaze: 'Ash' } },
    { sku: `${opts.sku}-SLT`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Glaze: 'Slate' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.alt }],
});

const PRODUCTS: Product[] = [
  piece({
    handle: 'everyday-mug',
    title: 'Everyday Mug',
    description:
      'The one you’ll reach for every morning — a generous 12oz mug with a full, pulled handle that fits three fingers and a foot bare enough to feel the clay. Thrown a little heavy on purpose, so it holds the heat and sits solid on the table.',
    price: 38,
    sku: 'KILN-MUG',
    productType: 'Drinkware',
    categories: ['drink'],
    collections: ['new-arrivals', 'best-sellers', 'everyday-table', 'drinkware'],
    tags: ['mug', 'drinkware', 'stoneware', 'handmade'],
    asset: 'kiln-prod-mug',
    alt: 'A hand-thrown stoneware mug with a pulled handle',
    seoTitle: 'Everyday Mug — hand-thrown stoneware | Kiln & Clay',
    seoDescription: 'A generous 12oz hand-thrown mug with a full pulled handle and a bare clay foot. Made to order in three glazes.',
  }),
  piece({
    handle: 'breakfast-bowl',
    title: 'Breakfast Bowl',
    description:
      'A wide, low bowl that’s right for almost everything — cereal and porridge, a bowl of soup, roasted vegetables, or ice cream after. Deep enough to hold a proper serving, shallow enough to eat from comfortably, with a soft speckled glaze pooling in the well.',
    price: 42,
    sku: 'KILN-BOWL',
    productType: 'Tableware',
    categories: ['dine'],
    collections: ['new-arrivals', 'best-sellers', 'everyday-table'],
    tags: ['bowl', 'tableware', 'stoneware', 'handmade'],
    asset: 'kiln-prod-bowl',
    alt: 'A wide breakfast bowl with a speckled glaze',
    seoTitle: 'Breakfast Bowl — handmade stoneware | Kiln & Clay',
    seoDescription: 'A wide, low everyday bowl for cereal, soup or supper, with a soft speckled glaze. Made to order in three glazes.',
  }),
  piece({
    handle: 'dinner-plate',
    title: 'Dinner Plate',
    description:
      'A proper dinner plate with a broad rim and a glazed well — the kind that makes an ordinary meal look considered. We leave the rim bare and lightly sanded so it stacks quietly and shows the clay it’s made from. Ten and a half inches; dishwasher-safe.',
    price: 46,
    sku: 'KILN-PLATE',
    productType: 'Tableware',
    categories: ['dine'],
    collections: ['everyday-table', 'entertaining'],
    tags: ['plate', 'tableware', 'stoneware', 'handmade'],
    asset: 'kiln-prod-plate',
    alt: 'A dinner plate with a bare clay rim',
    seoTitle: 'Dinner Plate — handmade stoneware | Kiln & Clay',
    seoDescription: 'A 10.5" dinner plate with a broad bare-clay rim and glazed well. Made to order in three studio glazes.',
  }),
  piece({
    handle: 'serving-platter',
    title: 'Serving Platter',
    description:
      'A long oval platter built for the middle of the table — a whole roast chicken, a spread of flatbreads, a pile of summer tomatoes. Thrown wide and low with a subtle lip to keep everything on board, in a matte glaze that hides the everyday marks of real use.',
    price: 88,
    sku: 'KILN-PLATTER',
    productType: 'Tableware',
    categories: ['dine'],
    collections: ['entertaining', 'gift-ready'],
    tags: ['platter', 'serving', 'tableware', 'handmade'],
    asset: 'kiln-prod-platter',
    alt: 'A long oval serving platter in a matte glaze',
    seoTitle: 'Serving Platter — handmade stoneware | Kiln & Clay',
    seoDescription: 'A long oval serving platter with a subtle lip and matte glaze, for the middle of the table. Made to order.',
  }),
  piece({
    handle: 'stem-vase',
    title: 'Stem Vase',
    description:
      'A tall, narrow-necked vase for a single stem or a small gathered bunch — the kind of quiet object that earns its place on a shelf even when it’s empty. Weighted in the base so a top-heavy branch won’t tip it, with a stone-grey glaze that lets the flowers do the talking.',
    price: 64,
    sku: 'KILN-VASE',
    productType: 'Vessel',
    categories: ['vessels'],
    collections: ['new-arrivals', 'gift-ready'],
    tags: ['vase', 'vessel', 'decor', 'handmade'],
    asset: 'kiln-prod-vase',
    alt: 'A tall bud vase with a narrow neck',
    seoTitle: 'Stem Vase — handmade stoneware | Kiln & Clay',
    seoDescription: 'A tall, narrow-necked vase for a single stem, weighted in the base. Made to order in three studio glazes.',
  }),
  piece({
    handle: 'footed-planter',
    title: 'Footed Planter',
    description:
      'A footed planter with a matching saucer, sized for a plant you actually care about — a fern, a trailing pothos, a herb on the kitchen sill. Raised on a small foot so air moves underneath, with a drainage hole and a saucer to catch the overflow. Six-inch inner pot.',
    price: 58,
    sku: 'KILN-PLANTER',
    productType: 'Vessel',
    categories: ['home'],
    collections: ['home', 'gift-ready'],
    tags: ['planter', 'home', 'plants', 'handmade'],
    asset: 'kiln-prod-planter',
    alt: 'A footed planter with a matching saucer',
    seoTitle: 'Footed Planter — handmade stoneware | Kiln & Clay',
    seoDescription: 'A 6" footed planter with drainage hole and matching saucer. Made to order in three studio glazes.',
  }),
  piece({
    handle: 'tumbler-pair',
    title: 'Tumbler Pair',
    description:
      'A pair of faceted tumblers, cut by hand while the clay is soft so the sides catch the light differently as you turn them. Right for water, wine, whisky or a morning juice, and sized to sit under a coffee machine. Sold as two — because a good glass is better shared.',
    price: 72,
    sku: 'KILN-TUMBLERS',
    productType: 'Drinkware',
    categories: ['drink'],
    collections: ['best-sellers', 'drinkware', 'gift-ready'],
    tags: ['tumblers', 'drinkware', 'set', 'handmade'],
    asset: 'kiln-prod-tumblers',
    alt: 'A pair of stoneware tumblers with faceted sides',
    seoTitle: 'Tumbler Pair — hand-faceted stoneware | Kiln & Clay',
    seoDescription: 'Two hand-faceted stoneware tumblers for water, wine or whisky. Made to order in three studio glazes.',
  }),
  piece({
    handle: 'pouring-jug',
    title: 'Pouring Jug',
    description:
      'A small pinched-spout jug that does more than you’d think — milk for the table, dressing for a salad, a few stems of something from the garden. Thrown with a rounded belly and a handle sized for one finger, it pours clean and drips less than a jug has any right to.',
    price: 48,
    sku: 'KILN-JUG',
    productType: 'Tableware',
    categories: ['drink'],
    collections: ['everyday-table', 'drinkware'],
    tags: ['jug', 'pourer', 'tableware', 'handmade'],
    asset: 'kiln-prod-jug',
    alt: 'A small pouring jug with a pinched spout',
    seoTitle: 'Pouring Jug — handmade stoneware | Kiln & Clay',
    seoDescription: 'A small pinched-spout jug for milk, dressing or a few stems. Pours clean. Made to order in three glazes.',
  }),
  piece({
    handle: 'dinner-set',
    title: 'Small-Batch Dinner Set',
    description:
      'A four-piece set for two — two dinner plates and two bowls, thrown in the same batch so their tones and weights actually match, which pieces bought one at a time never quite do. The starting point for a handmade table, and the easiest way to give one as a gift.',
    price: 210,
    sku: 'KILN-SET',
    productType: 'Tableware',
    categories: ['dine'],
    collections: ['everyday-table', 'entertaining', 'gift-ready'],
    tags: ['set', 'tableware', 'gift', 'handmade'],
    asset: 'kiln-prod-dinner-set',
    alt: 'A four-piece dinner set of plates and bowls',
    seoTitle: 'Small-Batch Dinner Set — handmade stoneware | Kiln & Clay',
    seoDescription: 'A four-piece dinner set for two — two plates, two bowls thrown in one batch to match. Made to order.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'drink', name: 'Drink', description: 'Mugs, tumblers and jugs, thrown by hand.', featured: true },
    { handle: 'dine', name: 'Dine', description: 'Plates, bowls, platters and sets for the table.', featured: true },
    { handle: 'vessels', name: 'Vessels', description: 'Vases and objects for the shelf.', featured: true },
    { handle: 'home', name: 'Home', description: 'Planters and pieces for the rest of the house.', featured: true },
  ],
  collections: [
    {
      handle: 'new-arrivals',
      name: 'New from the studio',
      description: 'The latest pieces off the wheel.',
      type: 'manual',
      featured: true,
      productHandles: ['everyday-mug', 'breakfast-bowl', 'stem-vase'],
    },
    {
      handle: 'everyday-table',
      name: 'The everyday table',
      description: 'Pieces made to be used every day.',
      type: 'manual',
      featured: true,
      productHandles: ['everyday-mug', 'breakfast-bowl', 'dinner-plate', 'pouring-jug', 'dinner-set'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The pieces people come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['everyday-mug', 'breakfast-bowl', 'tumbler-pair'],
    },
    {
      handle: 'drinkware',
      name: 'Drinkware',
      description: 'Everything to drink from.',
      type: 'manual',
      featured: false,
      productHandles: ['everyday-mug', 'tumbler-pair', 'pouring-jug'],
    },
    {
      handle: 'entertaining',
      name: 'Entertaining',
      description: 'For the middle of the table.',
      type: 'manual',
      featured: false,
      productHandles: ['serving-platter', 'dinner-plate', 'dinner-set'],
    },
    {
      handle: 'gift-ready',
      name: 'Gift-ready',
      description: 'Sets and pairs that give well.',
      type: 'manual',
      featured: false,
      productHandles: ['tumbler-pair', 'dinner-set', 'stem-vase', 'footed-planter', 'serving-platter'],
    },
    {
      handle: 'home',
      name: 'For the home',
      description: 'Planters and vessels beyond the table.',
      type: 'manual',
      featured: false,
      productHandles: ['footed-planter', 'stem-vase'],
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
    slug: 'how-a-piece-is-made',
    status: 'published',
    body: {
      title: 'How a piece is made, from clay to kiln',
      excerpt: 'A mug looks simple sitting on your shelf. Here’s everything that happened to the clay before it got there.',
      featuredImage: { $asset: 'kiln-post-making' },
      body: {
        type: 'doc',
        content: [
          para('People are often surprised how long a single mug takes. Not the throwing — that’s a few minutes on the wheel — but everything around it. A piece passes through the studio over the better part of two weeks, and most of that time it’s just sitting, drying at the right speed so it doesn’t crack. Here’s the whole journey.'),
          h2('Throwing and trimming'),
          para('It starts as a ball of wedged clay, centred on the wheel and opened into a wall with wet hands. Once it’s thrown, it rests overnight until it’s leather-hard — firm but still damp — and goes back on the wheel upside down to have its foot trimmed. That’s where the weight and balance are decided: too heavy and it’s a brick, too light and it tips.'),
          h2('The first firing'),
          para('When it’s bone dry, it’s loaded into the kiln for a bisque firing — a slow climb to around 1000°C that turns fragile clay into hard, porous ceramic that can be handled and glazed. Everything is stacked carefully; a kiln is expensive to run, so we fire it full.'),
          h2('Glaze and the second firing'),
          para('Bisque ware is dipped or poured with glaze — a liquid coat of minerals that will melt into glass in the heat. Then it’s fired again, hotter, to around 1250°C. That final firing is the one you can’t take back: the glaze runs and pools, the clay vitrifies and becomes waterproof, and the piece comes out of the kiln as the thing you’ll actually use. Only then do we know if it worked.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'a-word-on-glazes',
    status: 'published',
    body: {
      title: 'A word on our glazes, and why they vary',
      excerpt: 'Oatmeal, Ash and Slate aren’t paint colours — they’re chemistry that meets fire. Here’s what to expect.',
      featuredImage: { $asset: 'kiln-post-glazes' },
      body: {
        type: 'doc',
        content: [
          para('We mix our three glazes from raw materials in the studio, by weight, from recipes we’ve tested over dozens of firings. But a glaze isn’t a paint you pick from a swatch — it’s a coat of minerals that only becomes its final colour in the heat of the kiln, and small things change how it lands.'),
          h2('The three glazes'),
          para('Oatmeal is our warm, creamy neutral — the studio default, and the most forgiving on the table. Ash is a soft matte grey-green that breaks lighter over edges and rims, where the coat is thinner. Slate is the deepest of the three, a stony blue-grey that pools dark in the wells of bowls and plates. All three are food-safe and dishwasher-safe.'),
          h2('Why yours won’t match the photo exactly'),
          para('Where a glaze pools thicker it fires darker; where it thins over a rim it breaks toward the clay beneath. Its exact tone shifts with the thickness of the coat, the spot it sat in the kiln, and the weather the day it was mixed. We photograph a representative piece, but yours will be its own — a little lighter here, a little deeper there. That variation isn’t a fault to apologise for; it’s the whole reason to buy something made by a person.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'caring-for-handmade-ceramics',
    status: 'published',
    body: {
      title: 'Caring for handmade ceramics',
      excerpt: 'Handmade doesn’t mean fragile or fussy. A few simple habits and these pieces will outlast the fashion for them.',
      featuredImage: { $asset: 'kiln-post-care' },
      body: {
        type: 'doc',
        content: [
          para('The best thing you can do with a handmade piece is use it. Our stoneware is fired hot and fully vitrified, which makes it tough and genuinely everyday — not a shelf ornament you’re afraid to touch. A few small habits keep it looking its best for years.'),
          h2('Everyday use'),
          para('All of our glazed ware is dishwasher-safe and microwave-safe. If you hand-wash, a soft sponge is plenty — skip the scouring pad, which can dull a glaze over time. The one thing to watch is thermal shock: don’t take a piece straight from the freezer to a hot oven, and let a cold mug warm a moment before you fill it with boiling water.'),
          h2('The bare foot'),
          para('We leave the foot of each piece unglazed, so you can see and feel the clay. On very rare occasions a bare foot can leave a faint grey mark on a soft surface — a quick pass with fine sandpaper smooths it, and we do this before anything ships. If yours ever needs it, a light sand and it’s done.'),
          h2('If something chips'),
          para('Even tough ceramics can chip if they’re knocked hard against a tap or a stone counter. A small chip on a rim is usually still safe and sound to use, and many people grow fond of the mark. If a piece ever fails in a way that isn’t fair wear, tell us — we stand behind what leaves the studio.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-ceramics-studio',
  key: 'sparx-retail-ceramics-studio',
  name: 'sparx — Ceramics Studio (Handmade)',
  theme: THEME,
  summary:
    'A complete, working shop for a handmade pottery studio: a real catalogue of thrown-and-glazed stoneware — mugs, bowls, plates, a serving platter, a vase, a planter, tumblers and a dinner set, each in three studio glazes — with categories, collections, a gallery-calm PDP and a fully merchandised home page. Warm clay-and-stone theme with a muted sage-glaze accent. Shipped as Kiln & Clay.',
  tagline: 'A quiet, tactile storefront for a handmade ceramics studio.',
  vertical: 'retail',
  industry: 'Ceramics studio',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 87,
  brand: {
    businessName: 'Kiln & Clay',
    tagline: 'Made by hand, one at a time.',
  },
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: false },
  seo: {
    home: {
      title: 'Kiln & Clay — handmade stoneware, thrown to order',
      description:
        'Kiln & Clay is a small pottery studio making thrown-and-glazed stoneware for the table and the home — mugs, bowls, plates, vases and planters, each made to order in three studio glazes.',
    },
    about: {
      title: 'About Kiln & Clay',
      description:
        'A one-studio pottery: how Kiln & Clay throws, trims, glazes and fires every piece by hand — honest forms, quiet glazes, made to be used every day.',
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
