// sparx-retail-kitchenware — a RETAIL/COMMERCE site template: a chef-grade cookware shop.
//
// A complete, working shop the moment it installs — a real catalogue of carbon-steel pans,
// cast-iron Dutch ovens, forged knives, and the honest tools around them, with categories +
// collections, a bespoke PDP, the full 9-page commerce site (home merchandising → shop →
// collections → cart → search → journal → about → contact), dressed in an INLINE bespoke
// theme (warm slate-cream ground + deep copper primary + verdigris accent). Shipped as
// Copper & Cast.
//
// SELF-CONTAINED BY DESIGN — like the coffee gold reference, this generator carries its OWN
// theme inline and passes it on the spec (`theme`), so the retail family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The
// shared `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-kitchenware.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-kitchenware/**" \
//     "marketplace-catalog/_gen/gen-retail-kitchenware.ts"
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
// A warm working kitchen: a slate-cream paper ground, deep espresso ink, a deep COPPER
// primary and a verdigris (copper-patina) accent, under a warm serif display over a
// humanist sans. Complete light + dark, AA on every role (the blueprint sweep's contrast
// check is the gate). Every role used as TEXT on the light ground sits ≤ ~50% L so it
// clears 4.5:1 — the copper primary at 46%, the slate secondary at 40%, the verdigris
// accent at 48%.
const THEME = defineTheme({
  name: 'copperpot-kitchen',
  type: { body: face('Source Sans 3', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.625rem', depth: '0' },
  light: {
    surfaces: ['oklch(96% 0.013 75)', 'oklch(93% 0.019 68)', 'oklch(88% 0.025 62)', 'oklch(23% 0.028 55)'],
    roles: {
      primary: 'oklch(46% 0.11 48)',
      secondary: 'oklch(40% 0.03 250)',
      accent: 'oklch(48% 0.09 185)',
      neutral: 'oklch(26% 0.026 55)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(21% 0.018 55)', 'oklch(18% 0.018 55)', 'oklch(15% 0.018 55)', 'oklch(94% 0.013 75)'],
    roles: {
      primary: 'oklch(74% 0.1 55)',
      secondary: 'oklch(76% 0.05 250)',
      accent: 'oklch(76% 0.09 185)',
      neutral: 'oklch(30% 0.02 55)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "kw-hero": "https://images.unsplash.com/photo-1692313532975-513a383c48f7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29vayUyMHNlYXJpbmclMjB3ZWxsLXNlYXNvbmVkJTIwY2FyYm9uLXN0ZWVsJTIwc2tpbGxldCUyMGZsYW1lfGVufDB8MHx8fDE3ODY0MDUwNzh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-tile-cookware": "https://images.unsplash.com/photo-1637739699971-7d4d5194e75c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Y2FyYm9uLXN0ZWVsJTIwc2tpbGxldCUyMGNhc3QtaXJvbnxlbnwwfDB8fHwxNzg2NDA1MjAzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-tile-knives": "https://images.unsplash.com/photo-1604543248368-da42b20dce5b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9yZ2VkJTIwY2hlZiUyMHMlMjBrbmlmZSUyMG1pZC1zbGljZSUyMHdvb2RlbiUyMGJvYXJkfGVufDB8MHx8fDE3ODY0MDUwODN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-tile-tools": "https://images.unsplash.com/photo-1580151820172-ae6491498c54?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29vZGVuJTIwc3Bvb25zJTIwcGVwcGVyfGVufDB8MHx8fDE3ODY0MDUyMDZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-tile-sets": "https://images.unsplash.com/photo-1556910602-38f53e68e15d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWF0Y2hlZCUyMHNldCUyMHBhbnMlMjBzdGFja2VkJTIwb3BlbiUyMHNoZWxmfGVufDB8MHx8fDE3ODY0MDUwODh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-band-forge": "https://images.unsplash.com/photo-1596299085622-4f96269e5bc7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8a25pZmUlMjBibGFkZSUyMGZvcmdlZHxlbnwwfDB8fHwxNzg2NDA1MjA5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-band-care": "https://images.unsplash.com/photo-1592156328757-ae2941276b2c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b2lsaW5nJTIwc2Vhc29uaW5nJTIwY2FyYm9uLXN0ZWVsJTIwcGFuJTIwYnklMjBoYW5kfGVufDB8MHx8fDE3ODY0MDUwOTR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-prod-skillet": "https://images.unsplash.com/photo-1569875770758-f17664dfe4f8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmxhY2slMjBjYXJib24tc3RlZWwlMjBza2lsbGV0fGVufDB8MHx8fDE3ODY0MDUyMTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-prod-dutch-oven": "https://images.unsplash.com/photo-1595440431225-1c25fd023f71?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZW5hbWVsbGVkJTIwY2FzdC1pcm9uJTIwZHV0Y2glMjBvdmVuJTIwbGlkJTIwb2ZmfGVufDB8MHx8fDE3ODY0MDUwOTl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-prod-chef-knife": "https://images.unsplash.com/photo-1778233770164-2c318e80aac8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9yZ2VkJTIwY2FyYm9uLXN0ZWVsJTIwY2hlZnxlbnwwfDB8fHwxNzg2NDA1MjE0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-prod-paring-knife": "https://images.unsplash.com/photo-1604543648342-6a500ad7b5c7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGwlMjBmb3JnZWQlMjBwYXJpbmclMjBrbmlmZSUyMGJlc2lkZSUyMGN1dCUyMGhlcmJzfGVufDB8MHx8fDE3ODY0MDUxMDV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-prod-spoon-set": "https://images.unsplash.com/photo-1634082983865-1ba172ff1dc5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwb2xpdmUtd29vZCUyMGNvb2tpbmclMjBzcG9vbnMlMjBzcGF0dWxhfGVufDB8MHx8fDE3ODY0MDUxMDh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-prod-saucepan": "https://images.unsplash.com/photo-1698939586566-8c093b721cb7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJpLXBseSUyMHN0YWlubGVzcyUyMHNhdWNlcGFuJTIwbG9uZyUyMGhhbmRsZXxlbnwwfDB8fHwxNzg2NDA1MTExfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-prod-bowl-set": "https://images.unsplash.com/photo-1576521528008-684613730cd3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmVzdGluZyUyMHN0YWlubGVzcyUyMG1peGluZ3xlbnwwfDB8fHwxNzg2NDA1MjE4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-prod-pepper-mill": "https://images.unsplash.com/photo-1546010362-041d579ad7e0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFsbCUyMHR1cm5lZC13YWxudXQlMjBwZXBwZXIlMjBtaWxsfGVufDB8MHx8fDE3ODY0MDUxMTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-prod-starter-set": "https://images.unsplash.com/photo-1695088224596-11649459b191?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhcnRlciUyMGNvb2t3YXJlJTIwc2V0JTIwc2tpbGxldCUyMHNhdWNlcGFuJTIwZHV0Y2glMjBvdmVufGVufDB8MHx8fDE3ODY0MDUxMjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-post-season": "https://images.unsplash.com/photo-1624031000828-dba1b7a3e4ce?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FyYm9uLXN0ZWVsJTIwcGFuJTIwYnVpbGRpbmclMjBkYXJrJTIwZ2xvc3N5JTIwc2Vhc29uaW5nfGVufDB8MHx8fDE3ODY0MDUxMjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-post-knife": "https://images.unsplash.com/photo-1574906328425-c7a4cb49bfa8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aG9uaW5nJTIwa25pZmUlMjBlZGdlJTIwd2hldHN0b25lfGVufDB8MHx8fDE3ODY0MDUxMjZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kw-post-cookware": "https://images.unsplash.com/photo-1584990347449-fd98bc063110?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhyZWUlMjBwYW5zJTIwY2FyYm9uJTIwc3RlZWwlMjBjYXN0JTIwaXJvbiUyMHN0YWlubGVzc3xlbnwwfDB8fHwxNzg2NDA1MTMwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'kw-hero', url: src('kw-hero'), alt: 'A cook searing in a well-seasoned carbon-steel skillet over a flame' },
  { id: 'kw-tile-cookware', url: src('kw-tile-cookware'), alt: 'A carbon-steel skillet and a cast-iron Dutch oven on a stovetop' },
  { id: 'kw-tile-knives', url: src('kw-tile-knives'), alt: 'A forged chef’s knife mid-slice on a wooden board' },
  { id: 'kw-tile-tools', url: src('kw-tile-tools'), alt: 'Wooden spoons and a pepper mill on a kitchen counter' },
  { id: 'kw-tile-sets', url: src('kw-tile-sets'), alt: 'A matched set of pans stacked on an open shelf' },
  { id: 'kw-band-forge', url: src('kw-band-forge'), alt: 'A knife blade being forged and ground in a workshop' },
  { id: 'kw-band-care', url: src('kw-band-care'), alt: 'Oiling and seasoning a carbon-steel pan by hand' },
  { id: 'kw-prod-skillet', url: src('kw-prod-skillet'), alt: 'A black carbon-steel skillet with a forged handle' },
  { id: 'kw-prod-dutch-oven', url: src('kw-prod-dutch-oven'), alt: 'An enamelled cast-iron Dutch oven with the lid off' },
  { id: 'kw-prod-chef-knife', url: src('kw-prod-chef-knife'), alt: 'A forged carbon-steel chef’s knife on a board' },
  { id: 'kw-prod-paring-knife', url: src('kw-prod-paring-knife'), alt: 'A small forged paring knife beside cut herbs' },
  { id: 'kw-prod-spoon-set', url: src('kw-prod-spoon-set'), alt: 'A set of olive-wood cooking spoons and a spatula' },
  { id: 'kw-prod-saucepan', url: src('kw-prod-saucepan'), alt: 'A tri-ply stainless saucepan with a long handle' },
  { id: 'kw-prod-bowl-set', url: src('kw-prod-bowl-set'), alt: 'A nesting set of stainless mixing bowls' },
  { id: 'kw-prod-pepper-mill', url: src('kw-prod-pepper-mill'), alt: 'A tall turned-walnut pepper mill' },
  { id: 'kw-prod-starter-set', url: src('kw-prod-starter-set'), alt: 'A starter cookware set — skillet, saucepan and Dutch oven' },
  { id: 'kw-post-season', url: src('kw-post-season'), alt: 'A carbon-steel pan building a dark, glossy seasoning' },
  { id: 'kw-post-knife', url: src('kw-post-knife'), alt: 'Honing a knife edge on a whetstone' },
  { id: 'kw-post-cookware', url: src('kw-post-cookware'), alt: 'Three pans — carbon steel, cast iron and stainless — side by side' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-kitchenware: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm photograph, a serif headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('kw-hero'), alt: 'A cook searing in a carbon-steel skillet', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Tools that outlast you, and cook better food.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Copper & Cast is a small kitchenware shop with a short list and a long view. Carbon steel, cast iron, forged knives and honest wood — the things a cook keeps for thirty years and hands down, chosen because they work, not because they’re new.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the kitchen' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop' },
                      text: 'Start with a set',
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
            text: 'Set up your kitchen',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'kw-tile-cookware', label: 'Cookware', href: '/shop', alt: 'A skillet and a Dutch oven on a stovetop' }),
              categoryTile({ assetId: 'kw-tile-knives', label: 'Knives', href: '/shop', alt: 'A chef’s knife mid-slice on a board' }),
              categoryTile({ assetId: 'kw-tile-tools', label: 'Tools', href: '/shop', alt: 'Wooden spoons and a pepper mill' }),
              categoryTile({ assetId: 'kw-tile-sets', label: 'Sets', href: '/shop', alt: 'A matched set of pans on a shelf' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New in the kitchen' }),
  editorialBand({
    heading: 'Forged, not stamped',
    lead: 'Our knives are forged from high-carbon steel and ground by hand — a fuller, heavier blade that takes a keener edge and holds it, with a bolster you can feel balance on. Learn to sharpen it and it outlives the block it came in.',
    assetId: 'kw-band-forge',
    cta: 'How our knives are made',
    href: '/blog/choosing-your-first-good-knife',
    alt: 'A knife blade being forged and ground',
  }),
  productsBlock({ source: 'commerce.category.cookware', layout: 'carousel', heading: 'Cookware' }),
  editorialBand({
    heading: 'Buy it once',
    lead: 'A seasoned carbon-steel pan gets better every year you cook in it; a cast-iron pot goes from stovetop to oven to table and never wears out. Care for these and they’re the last of their kind you’ll ever buy — which is the whole point.',
    assetId: 'kw-band-care',
    cta: 'Season & care guide',
    href: '/blog/season-and-keep-a-carbon-steel-pan',
    alt: 'Oiling and seasoning a carbon-steel pan by hand',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static "made to last" note, and policy links). */
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
                    text: 'Copper & Cast',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Made to be kept' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Every piece is chosen to last a lifetime of real cooking, backed by a lifetime guarantee against defects. Cared for the way our guides show, it only gets better — season a pan, hone a blade, oil the wood, and hand it down.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Cooks well with' });

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
    'Shop the kitchen',
    'Everything we make and stock — carbon-steel and cast-iron cookware, forged knives, and the honest tools around them. Filter by category or material, or sort however you like; all of it is built to be used hard and kept for years.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The kitchen grouped the way cooks actually shop — what’s new, the pieces people come back for, the cookware and knife edits, gifts, and starter kits to build a kitchen from scratch.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Copper & Cast', 'Looking for a pan, a knife, or a care guide? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $75, and every piece carries a lifetime guarantee against defects. Not the right fit for your kitchen? Send it back within 60 days — we want the tool to earn its place on your bench.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The workbench' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the shop — how to season and keep a pan, how to choose and sharpen a knife, and how to build a kitchen that lasts. Plain, useful, no gatekeeping.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Copper & Cast' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Copper & Cast started at a market stall with one carbon-steel pan and a stubborn belief: most kitchen gear is sold to be replaced, and it doesn’t have to be. We wanted the opposite — a short shelf of things a cook keeps for decades, chosen because they get better with use, not worse.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We work with a handful of foundries, forges and small workshops we can name, and we pay fairly for good work. Carbon steel and cast iron for pans, high-carbon steel forged for knives, olive and walnut for the wood — materials that reward care and outlast trends, because the best kitchen tool is the one you never have to buy twice.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No mystery non-stick that flakes in a year, no gadget you’ll use once. Every piece comes with a lifetime guarantee and a plain-English guide to keeping it that way. Buy it once, use it hard, hand it down.',
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
            text: 'Questions about a pan, help choosing a knife, or a wedding-registry order? Tell us what you’re cooking toward and a real person at the shop will help you get the right tool — not the most expensive one.',
          }),
          el('a', 'btn btn-primary btn-lg', { attrs: { href: 'mailto:hello@copperandcast.example' }, text: 'Email the shop' }),
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

const VENDOR = 'Copper & Cast';

const PRODUCTS: Product[] = [
  {
    handle: 'carbon-steel-skillet',
    title: 'Carbon-Steel Skillet',
    description:
      'The pan you’ll reach for every day. Spun from a single sheet of heavy carbon steel with a forged, riveted handle, it heats fast, sears hard, and takes a slick, natural non-stick seasoning that only improves with use. Oven-safe, flame-safe, and honestly the last frying pan you need.',
    status: 'active',
    productType: 'Cookware',
    vendor: VENDOR,
    tags: ['cookware', 'carbon-steel', 'skillet', 'frying-pan'],
    categoryHandles: ['cookware'],
    collectionHandles: ['new-season', 'best-sellers', 'cookware-edit', 'starter-kits'],
    seoTitle: 'Carbon-Steel Skillet — everyday frying pan | Copper & Cast',
    seoDescription: 'A heavy carbon-steel skillet with a forged handle that seasons to a natural non-stick and lasts a lifetime.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: '10-inch' }, { value: '12-inch' }] },
    ],
    variants: [
      { sku: 'CC-SKILLET-10', priceCents: money(89), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '10-inch' } },
      { sku: 'CC-SKILLET-12', priceCents: money(109), inventoryPolicy: 'continue', optionValues: { Size: '12-inch' } },
    ],
    images: [{ assetId: 'kw-prod-skillet', isPrimary: true, alt: 'A black carbon-steel skillet with a forged handle' }],
  },
  {
    handle: 'enamel-dutch-oven',
    title: 'Enamelled Cast-Iron Dutch Oven',
    description:
      'A 5.5-quart cast-iron pot under a smooth enamel glaze — the workhorse for braises, bread, stews and Sunday sauce. Heavy walls hold a low, even heat for hours; goes stovetop to oven to table and comes clean with a wipe. One pot that does the work of five.',
    status: 'active',
    productType: 'Cookware',
    vendor: VENDOR,
    tags: ['cookware', 'cast-iron', 'dutch-oven', 'braiser'],
    categoryHandles: ['cookware'],
    collectionHandles: ['new-season', 'cookware-edit', 'gifts'],
    seoTitle: 'Enamelled Cast-Iron Dutch Oven, 5.5 qt | Copper & Cast',
    seoDescription: 'A 5.5-quart enamelled cast-iron Dutch oven for braises, bread and stews — stovetop to oven to table.',
    options: [
      {
        name: 'Color',
        displayType: 'swatch',
        values: [{ value: 'Slate Blue' }, { value: 'Ember Red' }, { value: 'Cream' }, { value: 'Sage' }],
      },
    ],
    variants: [
      { sku: 'CC-DUTCH-SLB', priceCents: money(179), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Slate Blue' } },
      { sku: 'CC-DUTCH-EMR', priceCents: money(179), inventoryPolicy: 'continue', optionValues: { Color: 'Ember Red' } },
      { sku: 'CC-DUTCH-CRM', priceCents: money(179), inventoryPolicy: 'continue', optionValues: { Color: 'Cream' } },
      { sku: 'CC-DUTCH-SAG', priceCents: money(179), inventoryPolicy: 'continue', optionValues: { Color: 'Sage' } },
    ],
    images: [{ assetId: 'kw-prod-dutch-oven', isPrimary: true, alt: 'An enamelled cast-iron Dutch oven with the lid off' }],
  },
  {
    handle: 'chefs-knife',
    title: 'Forged Chef’s Knife',
    description:
      'The one knife that does ninety percent of the work. Forged from high-carbon steel and ground by hand to a keen, lasting edge, with a full tang and a bolster that puts the balance right at your grip. Rock-chop, slice, or dice all day — sharpen it now and then and it’ll outlast the block.',
    status: 'active',
    productType: 'Knife',
    vendor: VENDOR,
    tags: ['knives', 'chef-knife', 'forged', 'high-carbon-steel'],
    categoryHandles: ['knives'],
    collectionHandles: ['new-season', 'best-sellers', 'knives-edit', 'gifts', 'starter-kits'],
    seoTitle: 'Forged Chef’s Knife — high-carbon steel | Copper & Cast',
    seoDescription: 'A hand-forged high-carbon chef’s knife with a full tang and balanced bolster that holds a keen edge.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: '8-inch' }, { value: '10-inch' }] },
    ],
    variants: [
      { sku: 'CC-CHEF-8', priceCents: money(129), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '8-inch' } },
      { sku: 'CC-CHEF-10', priceCents: money(149), inventoryPolicy: 'continue', optionValues: { Size: '10-inch' } },
    ],
    images: [{ assetId: 'kw-prod-chef-knife', isPrimary: true, alt: 'A forged carbon-steel chef’s knife on a board' }],
  },
  {
    handle: 'paring-knife',
    title: 'Forged Paring Knife',
    description:
      'The little knife you use more than you’d think — peeling, trimming, coring, deveining, and any close work the chef’s knife is too big for. Same forged high-carbon steel and full tang, sized to sit in your hand and steer with your fingertips. Buy it with the chef’s knife and skip the rest of the block.',
    status: 'active',
    productType: 'Knife',
    vendor: VENDOR,
    tags: ['knives', 'paring-knife', 'forged', 'high-carbon-steel'],
    categoryHandles: ['knives'],
    collectionHandles: ['knives-edit', 'gifts'],
    seoTitle: 'Forged Paring Knife — high-carbon steel | Copper & Cast',
    seoDescription: 'A hand-forged high-carbon paring knife with a full tang for peeling, trimming and close work.',
    variants: [{ sku: 'CC-PARING', priceCents: money(59), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'kw-prod-paring-knife', isPrimary: true, alt: 'A small forged paring knife beside cut herbs' }],
  },
  {
    handle: 'olive-wood-spoon-set',
    title: 'Olive-Wood Spoon Set',
    description:
      'A set of three utensils turned from a single piece of olive wood — a deep cooking spoon, a slotted spoon, and a flat-edged spatula for scraping a fond. Kind to seasoned pans and non-stick alike, warm in the hand, and beautiful enough to leave in the crock by the stove. Oil now and then; they last for years.',
    status: 'active',
    productType: 'Tool',
    vendor: VENDOR,
    tags: ['tools', 'utensils', 'olive-wood', 'spoons'],
    categoryHandles: ['tools'],
    collectionHandles: ['gifts'],
    seoTitle: 'Olive-Wood Spoon Set — 3 piece | Copper & Cast',
    seoDescription: 'A three-piece olive-wood utensil set — cooking spoon, slotted spoon and spatula, kind to every pan.',
    variants: [{ sku: 'CC-SPOONSET', priceCents: money(38), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'kw-prod-spoon-set', isPrimary: true, alt: 'A set of olive-wood cooking spoons and a spatula' }],
  },
  {
    handle: 'stainless-saucepan',
    title: 'Tri-Ply Stainless Saucepan',
    description:
      'A tri-ply saucepan with an aluminium core clad in stainless, so it heats evenly edge to edge with no hot spots — the pan for sauces, grains, blanching and reductions. A long stay-cool handle, a pouring lip, and a mirror interior that shows you exactly what your sauce is doing. Dishwasher-safe and induction-ready.',
    status: 'active',
    productType: 'Cookware',
    vendor: VENDOR,
    tags: ['cookware', 'stainless', 'saucepan', 'tri-ply'],
    categoryHandles: ['cookware'],
    collectionHandles: ['best-sellers', 'cookware-edit'],
    seoTitle: 'Tri-Ply Stainless Saucepan | Copper & Cast',
    seoDescription: 'A tri-ply stainless saucepan with an aluminium core for even heat — sauces, grains and reductions.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: '2 qt' }, { value: '3 qt' }] },
    ],
    variants: [
      { sku: 'CC-SAUCE-2', priceCents: money(75), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '2 qt' } },
      { sku: 'CC-SAUCE-3', priceCents: money(89), inventoryPolicy: 'continue', optionValues: { Size: '3 qt' } },
    ],
    images: [{ assetId: 'kw-prod-saucepan', isPrimary: true, alt: 'A tri-ply stainless saucepan with a long handle' }],
  },
  {
    handle: 'mixing-bowl-set',
    title: 'Stainless Mixing-Bowl Set',
    description:
      'A nesting set of five stainless bowls, from a tiny prep bowl to a big-batch mixing bowl — light, unbreakable, and the ones that get used every single day. Deep enough to whisk without a mess, flat-bottomed so they sit still, and they stack down to almost nothing in the cupboard.',
    status: 'active',
    productType: 'Tool',
    vendor: VENDOR,
    tags: ['tools', 'bowls', 'stainless', 'prep'],
    categoryHandles: ['tools'],
    collectionHandles: ['gifts', 'starter-kits'],
    seoTitle: 'Stainless Mixing-Bowl Set — 5 piece | Copper & Cast',
    seoDescription: 'A nesting five-piece stainless mixing-bowl set — light, unbreakable and used every day.',
    variants: [{ sku: 'CC-BOWLSET', priceCents: money(49), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'kw-prod-bowl-set', isPrimary: true, alt: 'A nesting set of stainless mixing bowls' }],
  },
  {
    handle: 'walnut-pepper-mill',
    title: 'Walnut Pepper Mill',
    description:
      'A tall pepper mill turned from solid walnut over a hardened steel burr that grinds from a fine dust to a coarse crack and holds its setting. Freshly cracked pepper is a different ingredient than the pre-ground stuff — this is the small upgrade that makes everything you cook taste better.',
    status: 'active',
    productType: 'Tool',
    vendor: VENDOR,
    tags: ['tools', 'pepper-mill', 'walnut', 'grinder'],
    categoryHandles: ['tools'],
    collectionHandles: ['gifts'],
    seoTitle: 'Walnut Pepper Mill — steel-burr grinder | Copper & Cast',
    seoDescription: 'A tall solid-walnut pepper mill with a hardened steel burr, adjustable from fine dust to a coarse crack.',
    variants: [{ sku: 'CC-PEPPERMILL', priceCents: money(45), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'kw-prod-pepper-mill', isPrimary: true, alt: 'A tall turned-walnut pepper mill' }],
  },
  {
    handle: 'starter-cookware-set',
    title: 'Starter Cookware Set',
    description:
      'Everything a real kitchen needs and nothing it doesn’t: the carbon-steel skillet, the tri-ply saucepan, and the enamelled Dutch oven, bundled to build a kitchen from scratch. Three pans that cover searing, sauce and slow cooking — the set we’d hand someone moving into their first place. Priced below buying them apart.',
    status: 'active',
    productType: 'Cookware set',
    vendor: VENDOR,
    tags: ['sets', 'cookware', 'starter', 'bundle'],
    categoryHandles: ['sets'],
    collectionHandles: ['new-season', 'best-sellers', 'starter-kits', 'gifts'],
    seoTitle: 'Starter Cookware Set — skillet, saucepan & Dutch oven | Copper & Cast',
    seoDescription: 'A three-pan starter set — carbon-steel skillet, tri-ply saucepan and cast-iron Dutch oven — to build a kitchen from scratch.',
    variants: [{ sku: 'CC-STARTERSET', priceCents: money(315), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'kw-prod-starter-set', isPrimary: true, alt: 'A starter cookware set — skillet, saucepan and Dutch oven' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'cookware', name: 'Cookware', description: 'Pans and pots — carbon steel, cast iron and stainless.', featured: true },
    { handle: 'knives', name: 'Knives', description: 'Forged high-carbon knives for real work.', featured: true },
    { handle: 'tools', name: 'Tools', description: 'Utensils, bowls and the small upgrades.', featured: true },
    { handle: 'sets', name: 'Sets', description: 'Bundles to build a kitchen.', featured: true },
  ],
  collections: [
    {
      handle: 'new-season',
      name: 'New in the kitchen',
      description: 'The newest additions to the shelf.',
      type: 'manual',
      featured: true,
      productHandles: ['carbon-steel-skillet', 'enamel-dutch-oven', 'chefs-knife', 'starter-cookware-set'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The pieces cooks come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['carbon-steel-skillet', 'chefs-knife', 'stainless-saucepan', 'starter-cookware-set'],
    },
    {
      handle: 'gifts',
      name: 'Gifts',
      description: 'The ones worth wrapping — for weddings, new homes and good cooks.',
      type: 'manual',
      featured: true,
      productHandles: ['enamel-dutch-oven', 'chefs-knife', 'olive-wood-spoon-set', 'mixing-bowl-set', 'walnut-pepper-mill'],
    },
    {
      handle: 'cookware-edit',
      name: 'The cookware edit',
      description: 'Pans and pots for every job on the stove.',
      type: 'manual',
      featured: false,
      productHandles: ['carbon-steel-skillet', 'enamel-dutch-oven', 'stainless-saucepan'],
    },
    {
      handle: 'knives-edit',
      name: 'The knife edit',
      description: 'The two knives that do almost everything.',
      type: 'manual',
      featured: false,
      productHandles: ['chefs-knife', 'paring-knife'],
    },
    {
      handle: 'starter-kits',
      name: 'Starter kits',
      description: 'Building a kitchen from scratch? Start here.',
      type: 'manual',
      featured: false,
      productHandles: ['starter-cookware-set', 'carbon-steel-skillet', 'chefs-knife', 'mixing-bowl-set'],
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
    slug: 'season-and-keep-a-carbon-steel-pan',
    status: 'published',
    body: {
      title: 'How to season and keep a carbon-steel pan',
      excerpt: 'A raw carbon-steel pan is a blank slate. Here’s how to build the slick, near-non-stick seasoning that makes it a joy — and how to keep it that way.',
      featuredImage: { $asset: 'kw-post-season' },
      body: {
        type: 'doc',
        content: [
          para('A carbon-steel pan arrives raw and a little grey, and that’s the point: you’re going to build its surface yourself, and it’ll be better than anything that comes out of a factory. Seasoning is just thin layers of oil baked onto the steel until they turn to a hard, slick, dark polymer. Do it once properly, then keep it up by cooking, and the pan becomes the most non-stick thing in your kitchen.'),
          h2('The first seasoning'),
          para('Scrub off the factory wax with hot soapy water and dry the pan completely — carbon steel will flash-rust if you leave it wet. Set it over medium heat until it darkens and any bluing appears, then take it off, add half a teaspoon of a high-smoke-point oil (grapeseed or flax), and wipe it around with a paper towel until the pan looks almost dry. Almost dry is the whole trick — a puddle of oil bakes to a sticky mess, a whisper of it bakes to glass. Return it to the heat until it stops smoking, let it cool, and repeat two or three times. You’ll watch it go from grey to bronze to black.'),
          h2('Keeping it'),
          para('Cook fatty things early on — bacon, sausages, a steak — and the seasoning deepens with every use. To clean it, wipe it out hot, or use a splash of water and a soft brush; skip long soaks and the dishwasher. Dry it on the heat and wipe a trace of oil over the inside before it goes away. If a patch ever sticks or shows rust, don’t panic — scrub it back, re-season that spot, and carry on. A carbon-steel pan isn’t fragile; it’s just alive, and it rewards a little attention with decades of service.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'choosing-your-first-good-knife',
    status: 'published',
    body: {
      title: 'Choosing your first good knife',
      excerpt: 'You don’t need a block of fifteen. You need one knife that fits your hand and holds an edge — here’s how to pick it, and why forged beats stamped.',
      featuredImage: { $asset: 'kw-post-knife' },
      body: {
        type: 'doc',
        content: [
          para('The knife block is a marketing invention. Most cooks do almost everything with one chef’s knife and reach for a paring knife for the small stuff — two knives, not fifteen. Spend the block money on one knife you’ll actually enjoy using, and the difference in your cooking is immediate: less effort, cleaner cuts, and a lot more pleasure at the board.'),
          h2('Forged versus stamped'),
          para('A stamped knife is punched from a sheet of steel like a cookie cutter — light, cheap, and fine for a while. A forged knife is heated and hammered into shape, which aligns the steel’s grain and lets it carry a full tang and a bolster. The result is heavier, better balanced, and it takes and holds a keener edge. You feel the difference in the first ten seconds of use, and you keep feeling it for twenty years.'),
          h2('What to check in your hand'),
          para('Weight and balance are personal, so if you can, hold it: the knife should feel like an extension of your arm, balanced right where your fingers pinch the blade, not nose-heavy or handle-heavy. Look for a full tang running the length of the handle and high-carbon steel for the edge. Then commit to learning to sharpen — a cheap knife kept sharp cuts better than an expensive one gone dull. A good knife and a whetstone will outlast every gadget in the drawer.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'carbon-steel-cast-iron-or-stainless',
    status: 'published',
    body: {
      title: 'Carbon steel, cast iron or stainless: which pan for what',
      excerpt: 'Three materials, three jobs. A plain-English buying guide to what each pan is genuinely best at, so you buy the right one instead of all three.',
      featuredImage: { $asset: 'kw-post-cookware' },
      body: {
        type: 'doc',
        content: [
          para('Walk into a cookware shop and the choices blur together, but the three materials that matter each have a clear job. Buy for the cooking you actually do and a small collection covers everything; buy by the brochure and you end up with a cupboard of pans you never reach for.'),
          h2('Carbon steel — the everyday searer'),
          para('Light enough to flip, it heats fast and gets screaming hot, which makes it the best pan for searing, sautéing, eggs and stir-fries. It seasons like cast iron but responds quickly to the burner, so you have real control. If you buy one pan, buy this — it becomes the one on the stove every night.'),
          h2('Cast iron — the heat reservoir'),
          para('Heavy and slow to change temperature, cast iron holds heat like nothing else, which is exactly what you want for a deep sear, cornbread, or anything that goes into the oven. An enamelled Dutch oven adds a non-reactive interior, so it also does braises, stews, bread and Sunday sauce. Slow to heat, slow to let go — its weight is the feature.'),
          h2('Stainless — the precise one'),
          para('Non-reactive and easy to read, tri-ply stainless is the pan for sauces, reductions, blanching and anything acidic that would strip a seasoning. It won’t build a non-stick surface, but it browns beautifully and deglazes into a proper pan sauce. Between a carbon-steel skillet, a stainless saucepan and a cast-iron pot, there’s almost nothing you can’t cook.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-kitchenware',
  key: 'sparx-retail-kitchenware',
  name: 'sparx — Kitchenware & Cookware',
  theme: THEME,
  summary:
    'A complete, working shop for a chef-grade kitchenware store: a real catalogue of carbon-steel pans, cast-iron Dutch ovens, forged knives, and honest tools, with categories, collections, a bespoke cookware PDP and a full merchandised home page. Warm kitchen theme — slate-cream ground, deep copper, a verdigris accent. Shipped as Copper & Cast.',
  tagline: 'A warm, working storefront for a chef-grade kitchenware shop.',
  vertical: 'retail',
  industry: 'Kitchenware & cookware',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 88,
  brand: {
    businessName: 'Copper & Cast',
    tagline: 'Tools that outlast you, and cook better food.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Copper & Cast — chef-grade cookware, built to last',
      description:
        'Copper & Cast is a kitchenware shop with a short list and a long view — carbon-steel pans, cast-iron Dutch ovens and forged knives, all built to be used hard and handed down.',
    },
    about: {
      title: 'About Copper & Cast',
      description:
        'Why Copper & Cast sells fewer, better things — named foundries and forges, materials that reward care, and a lifetime guarantee on every piece.',
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
