// sparx-retail-plant-botanical — a RETAIL/COMMERCE site template: a houseplant nursery.
//
// A sibling of the coffee gold reference: a complete, working shop the moment it installs —
// a real plant catalogue (easy-care starters, statement plants, pots + tools, a monthly plant
// subscription), categories + collections, a bespoke PDP, the full 9-page commerce site (home
// merchandising → shop → collections → cart → search → journal → about → contact), dressed in an
// INLINE bespoke theme (soft sage ground + deep botanical green primary + warm terracotta accent,
// under a friendly serif/humanist-sans pairing). Shipped as Fernwood Plant Co.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme inline and
// passes it on the spec (`theme`), so the whole family can be authored in parallel without any two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-plant-botanical.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-plant-botanical/**" \
//     "marketplace-catalog/_gen/gen-retail-plant-botanical.ts"
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
// A living nursery: a soft sage-cream ground (visibly green-tinted, not white with a rumour of
// green), a deep botanical-green primary, a warm terracotta accent, under a friendly Fraunces
// serif over Nunito. Complete light + dark, AA on every role (the blueprint sweep's contrast
// check is the gate). `secondary` stays dark and legible on the light ground.
const THEME = defineTheme({
  name: 'verdant-house',
  type: { body: face('Nunito', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '1rem', field: '0.5rem', box: '0.875rem', depth: '0' },
  light: {
    surfaces: ['oklch(96% 0.022 145)', 'oklch(93% 0.028 143)', 'oklch(88% 0.034 140)', 'oklch(23% 0.03 150)'],
    roles: {
      primary: 'oklch(40% 0.1 152)',
      secondary: 'oklch(42% 0.06 145)',
      accent: 'oklch(49% 0.15 42)',
      neutral: 'oklch(26% 0.024 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(19% 0.02 150)', 'oklch(16% 0.02 150)', 'oklch(13% 0.02 150)', 'oklch(94% 0.02 143)'],
    roles: {
      primary: 'oklch(78% 0.13 150)',
      secondary: 'oklch(78% 0.06 145)',
      accent: 'oklch(74% 0.13 42)',
      neutral: 'oklch(30% 0.022 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "fern-hero": "https://images.unsplash.com/photo-1592150621744-aca64f48394a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3VubGl0JTIwY29ybmVyJTIwaG9tZSUyMGZpbGxlZCUyMGxlYWZ5JTIwcG90dGVkJTIwaG91c2VwbGFudHN8ZW58MHwwfHx8MTc4NjQwMjEyMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fern-tile-easy": "https://images.unsplash.com/photo-1547516508-e910d368d995?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFyZHklMjBzbmFrZSUyMHBsYW50JTIwcGFsZSUyMGNlcmFtaWMlMjBwb3QlMjB3aW5kb3dzaWxsfGVufDB8MHx8fDE3ODY0MDIxMjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fern-tile-statement": "https://images.unsplash.com/photo-1617228133035-2347f159e755?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFsbCUyMGZpZGRsZS1sZWFmJTIwZmlnJTIwc3RhbmRpbmclMjBicmlnaHQlMjBsaXZpbmclMjByb29tfGVufDB8MHx8fDE3ODY0MDIxMjh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fern-tile-pots": "https://images.unsplash.com/photo-1497990571654-77aa8ec36038?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVycmFjb3R0YSUyMHBvdHMlMjBicmFzcyUyMHdhdGVyaW5nJTIwY2FuJTIwcG90dGluZyUyMGJlbmNofGVufDB8MHx8fDE3ODY0MDIxMzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fern-tile-sub": "https://images.unsplash.com/photo-1575833948662-cc99178abbb8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhbnQlMjBrcmFmdCUyMGJveHxlbnwwfDB8fHwxNzg2NDAyNTMzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fern-band-care": "https://images.unsplash.com/photo-1745376935143-8e346fdf1bed?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHMlMjBtaXN0aW5nJTIwbGVhdmVzJTIwbW9uc3RlcmElMjBieSUyMHdpbmRvd3xlbnwwfDB8fHwxNzg2NDAyMTM2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fern-band-sub": "https://images.unsplash.com/photo-1678254487407-a28544364f80?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhbnRzJTIwbnVyc2VyeSUyMHBvdHN8ZW58MHwwfHx8MTc4NjQwMjUzN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-monstera": "https://images.unsplash.com/photo-1619423089884-bc5b70bc4e2c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9uc3RlcmElMjBkZWxpY2lvc2ElMjBsYXJnZSUyMHNwbGl0JTIwbGVhdmVzJTIwcG90fGVufDB8MHx8fDE3ODY0MDIxNDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-snake": "https://images.unsplash.com/photo-1573235570946-e5fbb806fae2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dXByaWdodCUyMHNuYWtlJTIwcGxhbnQlMjBzaW1wbGUlMjBwb3R8ZW58MHwwfHx8MTc4NjQwMjE0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-pothos": "https://images.unsplash.com/photo-1719584256749-e8cc9774610d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z29sZGVuJTIwcG90aG9zJTIwdHJhaWxpbmclMjBoYW5naW5nJTIwcG90fGVufDB8MHx8fDE3ODY0MDIxNDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-fiddle": "https://images.unsplash.com/photo-1761061909562-a90e53027c17?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmlkZGxlLWxlYWYlMjBmaWclMjBicm9hZCUyMGdsb3NzeSUyMGxlYXZlc3xlbnwwfDB8fHwxNzg2NDAyMTUyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-zz": "https://images.unsplash.com/photo-1485955900006-10f4d324d411?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xvc3N5JTIwenolMjBwbGFudCUyMG1hdHRlJTIwcG90fGVufDB8MHx8fDE3ODY0MDIxNTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-pot": "https://images.unsplash.com/photo-1653340193326-a803d6d3e3d2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZC10aHJvd24lMjB0ZXJyYWNvdHRhJTIwcGxhbnQlMjBwb3QlMjBzYXVjZXJ8ZW58MHwwfHx8MTc4NjQwMjE1OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-can": "https://images.unsplash.com/photo-1768726455576-7ac91a8f3a9d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bG9uZy1zcG91dCUyMGJyYXNzJTIwd2F0ZXJpbmclMjBjYW58ZW58MHwwfHx8MTc4NjQwMjE2MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-kit": "https://images.unsplash.com/photo-1619158450110-b47355359742?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8cGxhbnQtY2FyZSUyMGtpdCUyMHBydW5lcnN8ZW58MHwwfHx8MTc4NjQwMjU0MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subscription": "https://images.unsplash.com/photo-1614959541555-4550895d4b2d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9udGhseSUyMHBsYW50JTIwc3Vic2NyaXB0aW9uJTIwYm94JTIwbmV3JTIwcGxhbnQlMjBpbnNpZGV8ZW58MHwwfHx8MTc4NjQwMjE2N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-care": "https://images.unsplash.com/photo-1649780730602-407c38b52bd6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2F0ZXJpbmclMjBjYW4lMjBwb3VyaW5nJTIwaW50byUyMHBvdHRlZCUyMHBsYW50JTIwdGFibGV8ZW58MHwwfHx8MTc4NjQwMjE3MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-light": "https://images.unsplash.com/photo-1763518821406-55caf89c01fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3VubGlnaHQlMjBmYWxsaW5nJTIwYWNyb3NzJTIwaG91c2VwbGFudHMlMjBuZWFyJTIwd2luZG93fGVufDB8MHx8fDE3ODY0MDIxNzR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-repot": "https://images.unsplash.com/photo-1715766911065-83723bc00d2f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhbnQlMjByZXBvdHRlZCUyMHNvaWx8ZW58MHwwfHx8MTc4NjQwMjU0NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'fern-hero', url: src('fern-hero'), alt: 'A sunlit corner of a home filled with leafy potted houseplants' },
  { id: 'fern-tile-easy', url: src('fern-tile-easy'), alt: 'A hardy snake plant in a pale ceramic pot on a windowsill' },
  { id: 'fern-tile-statement', url: src('fern-tile-statement'), alt: 'A tall fiddle-leaf fig standing in a bright living room' },
  { id: 'fern-tile-pots', url: src('fern-tile-pots'), alt: 'Terracotta pots and a brass watering can on a potting bench' },
  { id: 'fern-tile-sub', url: src('fern-tile-sub'), alt: 'A small plant in a kraft box left on a doorstep' },
  { id: 'fern-band-care', url: src('fern-band-care'), alt: 'Hands misting the leaves of a monstera by a window' },
  { id: 'fern-band-sub', url: src('fern-band-sub'), alt: 'A row of young plants in nursery pots ready to ship' },
  { id: 'prod-monstera', url: src('prod-monstera'), alt: 'A monstera deliciosa with large split leaves in a pot' },
  { id: 'prod-snake', url: src('prod-snake'), alt: 'An upright snake plant in a simple pot' },
  { id: 'prod-pothos', url: src('prod-pothos'), alt: 'A golden pothos trailing from a hanging pot' },
  { id: 'prod-fiddle', url: src('prod-fiddle'), alt: 'A fiddle-leaf fig with broad glossy leaves' },
  { id: 'prod-zz', url: src('prod-zz'), alt: 'A glossy ZZ plant in a matte pot' },
  { id: 'prod-pot', url: src('prod-pot'), alt: 'A hand-thrown terracotta plant pot with a saucer' },
  { id: 'prod-can', url: src('prod-can'), alt: 'A long-spout brass watering can' },
  { id: 'prod-kit', url: src('prod-kit'), alt: 'A plant-care kit of pruners, mister and plant food' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A monthly plant subscription box with a new plant inside' },
  { id: 'post-care', url: src('post-care'), alt: 'A watering can pouring into a potted plant on a table' },
  { id: 'post-light', url: src('post-light'), alt: 'Sunlight falling across houseplants near a window' },
  { id: 'post-repot', url: src('post-repot'), alt: 'A plant being repotted into fresh soil on a bench' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-plant-botanical: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm photograph, a serif headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('fern-hero'), alt: 'A sunlit home full of leafy houseplants', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Plants you can actually keep alive.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Fernwood is a small plant nursery for people who’ve killed a plant or two. We grow hardy, forgiving houseplants, match each one to the light you have, and send it with plain instructions — so the plant you order is the plant that thrives.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop plants' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop' },
                      text: 'New to plants? Start here',
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
            text: 'Find your plant',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'fern-tile-easy', label: 'Easy care', href: '/shop', alt: 'A hardy snake plant on a windowsill' }),
              categoryTile({ assetId: 'fern-tile-statement', label: 'Statement plants', href: '/shop', alt: 'A tall fiddle-leaf fig in a bright room' }),
              categoryTile({ assetId: 'fern-tile-pots', label: 'Pots & tools', href: '/shop', alt: 'Terracotta pots and a watering can' }),
              categoryTile({ assetId: 'fern-tile-sub', label: 'Subscription', href: '/shop/subscription', alt: 'A plant in a kraft box on a doorstep' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New this week' }),
  editorialBand({
    heading: 'Matched to your light, not to a shelf',
    lead: 'Most plants die from the wrong spot, not from neglect. Tell us whether your room is bright, medium or dim and we’ll steer you to plants that want exactly that — every listing spells out its light and how forgiving it is, in plain words.',
    assetId: 'fern-band-care',
    cta: 'How we help you choose',
    href: '/blog/reading-the-light-in-your-home',
    alt: 'Hands misting a monstera by a window',
  }),
  productsBlock({ source: 'commerce.category.easy-care', layout: 'carousel', heading: 'Hard to kill' }),
  editorialBand({
    heading: 'A new plant every month',
    lead: 'The plant subscription is the easy way to slowly fill a room: pick how often, and a fresh, healthy plant arrives already matched to the light you told us about. Skip, swap or cancel any time — no lock-in, ever.',
    assetId: 'fern-band-sub',
    cta: 'Start a subscription',
    href: '/shop/subscription',
    alt: 'Young plants in nursery pots ready to ship',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static care-first note, and policy links). */
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
                    text: 'Fernwood Plant Co.',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Arrives ready to thrive' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Every plant is grown on at our nursery, checked over by hand, and packed to travel — roots wrapped, leaves cushioned, and a plain-English care card in the box. Give it a week to settle into its new light before you worry about a droopy leaf.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Goes well alongside' });

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
    'Shop plants',
    'Every plant we’re growing right now — easy-care starters, bold statement plants, and the pots and tools to keep them happy. Filter by light or by how forgiving it is; every one ships potted, checked by hand, with a care card in the box.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The plants grouped the way people actually shop — new arrivals, the beginner-proof favourites, the ones that shrug off a dim corner, and starter kits with everything a first plant needs.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Fernwood', 'Looking for a particular plant, a pot size, or a care guide? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $60, and every plant travels in protective packaging with a care card inside. If it arrives unhappy, send us a photo within a week and we’ll make it right — a plant should be a joy, not a gamble.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Fernwood journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the nursery — how to water without guessing, how to read the light in your home, and when to repot. Plain, useful, no green-thumb gatekeeping.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Fernwood' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Fernwood started on a windowsill and a stubborn refusal to accept that some people just “can’t keep plants alive.” Nobody is born with a green thumb — they just learn which plant suits which spot, and how little a healthy plant actually needs. We built the nursery to hand that head start to everyone else.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We grow our plants on rather than drop-shipping them, so what leaves us is acclimatised, pest-checked and genuinely ready for a home. We favour the hardy and forgiving over the fussy and rare, and we tell you the truth about the light and water a plant wants — even when the honest answer is “this one isn’t for your dim hallway.”',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No jargon, no shaming, no plant older or sadder than it should be. Just healthy plants, matched to your space, with the plain guidance to keep them growing.',
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
    intro: 'A droopy leaf you can’t diagnose, a question before you buy, or a big order for an office or a wedding? Send a photo or a note and a real person at the nursery will help — we love a plant-doctor puzzle.',
    submitLabel: 'Email the nursery',
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

// A live plant is naturally two-axis: how big a plant you start with (pot size), and whether it
// arrives in the plain nursery pot or upgraded into one of our terracotta pots. So every plant
// carries `Pot size` × `Pot` — six real variants, priced by size + the pot upgrade.
const POT_SIZE: OptionDecl = {
  name: 'Pot size',
  displayType: 'dropdown',
  values: [{ value: 'Small · 4in' }, { value: 'Medium · 6in' }, { value: 'Large · 10in' }],
};
const WITH_POT: OptionDecl = {
  name: 'Pot',
  displayType: 'dropdown',
  values: [{ value: 'Nursery pot' }, { value: 'With terracotta pot' }],
};

const SIZE_STEPS = [
  { code: 'S', value: 'Small · 4in', add: 0 },
  { code: 'M', value: 'Medium · 6in', add: 14 },
  { code: 'L', value: 'Large · 10in', add: 38 },
] as const;
const POT_STEPS = [
  { code: 'NP', value: 'Nursery pot', add: 0 },
  { code: 'TP', value: 'With terracotta pot', add: 16 },
] as const;

const plant = (opts: {
  handle: string;
  title: string;
  description: string;
  price: number;
  sku: string;
  categories: string[];
  collections: string[];
  tags: string[];
  asset: string;
  seoTitle: string;
  seoDescription: string;
}): Product => {
  const variants: Variant[] = [];
  for (const size of SIZE_STEPS) {
    for (const pot of POT_STEPS) {
      const isDefault = size.code === 'S' && pot.code === 'NP';
      variants.push({
        sku: `${opts.sku}-${size.code}-${pot.code}`,
        priceCents: money(opts.price + size.add + pot.add),
        inventoryPolicy: 'continue',
        ...(isDefault ? { isDefault: true } : {}),
        optionValues: { 'Pot size': size.value, Pot: pot.value },
      });
    }
  }
  return {
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: 'Houseplant',
    vendor: 'Fernwood Plant Co.',
    tags: opts.tags,
    categoryHandles: opts.categories,
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    options: [POT_SIZE, WITH_POT],
    variants,
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
  };
};

const PRODUCTS: Product[] = [
  plant({
    handle: 'monstera-deliciosa',
    title: 'Monstera Deliciosa',
    description:
      'The classic split-leaf that turns a corner into a jungle — big, glossy, dramatic leaves that fenestrate more as it grows. Fast enough to feel rewarding, tough enough to forgive a missed watering. Care level: easy. Light: bright, indirect. Water when the top inch of soil is dry.',
    price: 32,
    sku: 'FERN-MONSTERA',
    categories: ['statement'],
    collections: ['new-arrivals', 'statement-plants'],
    tags: ['statement', 'easy', 'bright-light', 'trailing'],
    asset: 'prod-monstera',
    seoTitle: 'Monstera Deliciosa — split-leaf houseplant | Fernwood',
    seoDescription: 'A dramatic, easy-going monstera with big split leaves. Bright indirect light; water when the top inch is dry.',
  }),
  plant({
    handle: 'snake-plant',
    title: 'Snake Plant',
    description:
      'The plant we hand to anyone convinced they kill everything. Architectural upright leaves, near-indestructible, and happy to be forgotten for weeks. It even filters the air while it’s at it. Care level: very easy. Light: anything from low to bright. Water sparingly, once the soil is fully dry.',
    price: 24,
    sku: 'FERN-SNAKE',
    categories: ['easy-care'],
    collections: ['best-sellers', 'beginner-friendly', 'low-light'],
    tags: ['easy', 'low-light', 'air-purifying', 'drought-tolerant'],
    asset: 'prod-snake',
    seoTitle: 'Snake Plant (Sansevieria) — hard-to-kill houseplant | Fernwood',
    seoDescription: 'A near-indestructible snake plant that thrives on neglect. Low to bright light; water only when fully dry.',
  }),
  plant({
    handle: 'golden-pothos',
    title: 'Golden Pothos',
    description:
      'A trailing vine that grows fast and asks for almost nothing — drape it off a shelf or train it up a wall and it just keeps going. The one that makes a beginner feel like a natural. Care level: very easy. Light: low to bright, indirect. Water when the top of the soil dries out.',
    price: 18,
    sku: 'FERN-POTHOS',
    categories: ['easy-care'],
    collections: ['best-sellers', 'beginner-friendly', 'low-light', 'starter-kit'],
    tags: ['easy', 'low-light', 'trailing', 'fast-growing'],
    asset: 'prod-pothos',
    seoTitle: 'Golden Pothos — easy trailing houseplant | Fernwood',
    seoDescription: 'A fast, forgiving trailing pothos that grows in almost any light. Perfect first plant.',
  }),
  plant({
    handle: 'fiddle-leaf-fig',
    title: 'Fiddle-Leaf Fig',
    description:
      'The showpiece — tall, sculptural, with huge violin-shaped leaves that anchor a whole room. It has a reputation for drama, so we grow ours acclimatised and send it settled and steady. Care level: moderate. Light: bright, indirect, and consistent. Water when the top two inches are dry, and don’t move it around.',
    price: 45,
    sku: 'FERN-FIDDLE',
    categories: ['statement'],
    collections: ['new-arrivals', 'statement-plants'],
    tags: ['statement', 'bright-light', 'tree', 'floor-plant'],
    asset: 'prod-fiddle',
    seoTitle: 'Fiddle-Leaf Fig — statement floor plant | Fernwood',
    seoDescription: 'A tall, sculptural fiddle-leaf fig, grown acclimatised. Bright consistent light; steady watering.',
  }),
  plant({
    handle: 'zz-plant',
    title: 'ZZ Plant',
    description:
      'Glossy, waxy leaves that look almost too perfect to be real, on a plant that genuinely does not mind a dim office or a two-week holiday. Stores water in its roots, so under-watering beats over-watering every time. Care level: very easy. Light: low to medium. Water only when the soil is bone dry.',
    price: 26,
    sku: 'FERN-ZZ',
    categories: ['easy-care'],
    collections: ['beginner-friendly', 'low-light'],
    tags: ['easy', 'low-light', 'drought-tolerant', 'office'],
    asset: 'prod-zz',
    seoTitle: 'ZZ Plant (Zamioculcas) — low-light houseplant | Fernwood',
    seoDescription: 'A glossy, drought-tolerant ZZ plant that thrives in low light and shrugs off neglect.',
  }),
  {
    handle: 'terracotta-pot',
    title: 'Hand-Thrown Terracotta Pot',
    description:
      'A breathable terracotta pot with a matching saucer, thrown in small runs by a local pottery. The unglazed clay wicks away excess water — the single easiest way to stop over-watering — and no two glazes on the rim are exactly alike. Fits a nursery pot straight inside, so re-potting can wait.',
    status: 'active',
    productType: 'Pot',
    vendor: 'Fernwood Plant Co.',
    tags: ['pots', 'terracotta', 'ceramics'],
    categoryHandles: ['pots-tools'],
    collectionHandles: ['pots-and-tools', 'starter-kit'],
    seoTitle: 'Hand-Thrown Terracotta Pot — with saucer | Fernwood',
    seoDescription: 'A breathable hand-thrown terracotta plant pot with saucer, made in small runs by a local pottery.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: 'Small · 4in' }, { value: 'Medium · 6in' }, { value: 'Large · 10in' }] },
    ],
    variants: [
      { sku: 'FERN-POT-S', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Small · 4in' } },
      { sku: 'FERN-POT-M', priceCents: money(26), inventoryPolicy: 'continue', optionValues: { Size: 'Medium · 6in' } },
      { sku: 'FERN-POT-L', priceCents: money(38), inventoryPolicy: 'continue', optionValues: { Size: 'Large · 10in' } },
    ],
    images: [{ assetId: 'prod-pot', isPrimary: true, alt: 'A hand-thrown terracotta plant pot' }],
  },
  {
    handle: 'watering-can',
    title: 'Long-Spout Watering Can',
    description:
      'A slim brass can with a long, narrow spout that reaches under leaves and pours a slow, controlled stream — so water goes into the soil, not all over the leaves. Half a litre, the right size for a shelf of houseplants, and good-looking enough to leave out.',
    status: 'active',
    productType: 'Tool',
    vendor: 'Fernwood Plant Co.',
    tags: ['tools', 'watering', 'brass'],
    categoryHandles: ['pots-tools'],
    collectionHandles: ['pots-and-tools'],
    seoTitle: 'Long-Spout Watering Can — brass, 0.5L | Fernwood',
    seoDescription: 'A slim brass watering can with a long narrow spout for controlled, mess-free indoor watering.',
    variants: [{ sku: 'FERN-CAN', priceCents: money(34), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-can', isPrimary: true, alt: 'A long-spout brass watering can' }],
  },
  {
    handle: 'plant-care-kit',
    title: 'Plant-Care Starter Kit',
    description:
      'Everything a new plant parent actually needs and nothing they don’t — a pair of clean snips, a fine-mist sprayer, a gentle liquid plant food, and a simple soil moisture stick that ends the “is it time to water?” guesswork. Packed in a reusable box with a one-page cheat sheet.',
    status: 'active',
    productType: 'Kit',
    vendor: 'Fernwood Plant Co.',
    tags: ['tools', 'kit', 'beginner', 'gift'],
    categoryHandles: ['pots-tools'],
    collectionHandles: ['pots-and-tools', 'starter-kit', 'best-sellers'],
    seoTitle: 'Plant-Care Starter Kit — snips, mister, food & moisture stick | Fernwood',
    seoDescription: 'A beginner plant-care kit: snips, a mister, gentle plant food and a soil moisture stick, with a cheat sheet.',
    variants: [{ sku: 'FERN-KIT', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-kit', isPrimary: true, alt: 'A plant-care starter kit' }],
  },
  {
    handle: 'subscription',
    title: 'Monthly Plant Subscription',
    description:
      'A healthy new plant on your doorstep every month, chosen to match the light you tell us about and to build a collection that actually works together. Pick one plant or two, tell us your room, and skip, swap or pause any time. The gentlest way to grow from one plant to a jungle. Care level: easy. Light: your choice — we match to it.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Fernwood Plant Co.',
    tags: ['subscription', 'gift'],
    categoryHandles: ['subscription'],
    collectionHandles: ['new-arrivals', 'best-sellers'],
    seoTitle: 'Monthly Plant Subscription — a new plant, matched to your light | Fernwood',
    seoDescription: 'A flexible monthly plant subscription, each plant matched to your light. Skip, swap or pause any time.',
    options: [
      { name: 'Plan', displayType: 'dropdown', values: [{ value: 'One plant' }, { value: 'Two plants' }] },
    ],
    variants: [
      { sku: 'FERN-SUB-1', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: 'One plant' } },
      { sku: 'FERN-SUB-2', priceCents: money(40), inventoryPolicy: 'continue', optionValues: { Plan: 'Two plants' } },
    ],
    images: [{ assetId: 'prod-subscription', isPrimary: true, alt: 'A monthly plant subscription box' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'easy-care', name: 'Easy care', description: 'Forgiving plants that thrive on neglect.', featured: true },
    { handle: 'statement', name: 'Statement plants', description: 'Big, sculptural plants that anchor a room.', featured: true },
    { handle: 'pots-tools', name: 'Pots & tools', description: 'Pots, watering cans and care kit.', featured: true },
    { handle: 'subscription', name: 'Subscription', description: 'A new plant every month.', featured: true },
  ],
  collections: [
    {
      handle: 'new-arrivals',
      name: 'New arrivals',
      description: 'Just in from the nursery.',
      type: 'manual',
      featured: true,
      productHandles: ['monstera-deliciosa', 'fiddle-leaf-fig', 'subscription'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The plants people come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['snake-plant', 'golden-pothos', 'plant-care-kit', 'subscription'],
    },
    {
      handle: 'statement-plants',
      name: 'Statement plants',
      description: 'Big, sculptural plants that anchor a room.',
      type: 'manual',
      featured: false,
      productHandles: ['monstera-deliciosa', 'fiddle-leaf-fig'],
    },
    {
      handle: 'beginner-friendly',
      name: 'Beginner-friendly',
      description: 'Nearly impossible to kill.',
      type: 'manual',
      featured: false,
      productHandles: ['snake-plant', 'golden-pothos', 'zz-plant'],
    },
    {
      handle: 'low-light',
      name: 'Low-light heroes',
      description: 'Happy in a dim corner or a north-facing room.',
      type: 'manual',
      featured: false,
      productHandles: ['snake-plant', 'golden-pothos', 'zz-plant'],
    },
    {
      handle: 'pots-and-tools',
      name: 'Pots & tools',
      description: 'Everything to pot and care for them.',
      type: 'manual',
      featured: false,
      productHandles: ['terracotta-pot', 'watering-can', 'plant-care-kit'],
    },
    {
      handle: 'starter-kit',
      name: 'Starter kit',
      description: 'New to plants? Start here.',
      type: 'manual',
      featured: false,
      productHandles: ['golden-pothos', 'terracotta-pot', 'plant-care-kit'],
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
    slug: 'how-not-to-kill-your-first-houseplant',
    status: 'published',
    body: {
      title: 'How not to kill your first houseplant',
      excerpt: 'Almost every houseplant death is an over-watering, not a neglect. Here’s the one habit that keeps a first plant alive.',
      featuredImage: { $asset: 'post-care' },
      body: {
        type: 'doc',
        content: [
          para('If you’ve killed a plant before, we’d bet money on how it went: you loved it a little too much and watered it a little too often, the roots sat wet, and they quietly rotted while the leaves yellowed from the bottom up. Over-watering, not forgetfulness, is what kills most first houseplants — which is oddly good news, because it means doing less is usually the fix.'),
          h2('Water the soil, not the calendar'),
          para('Throw away the idea of watering “once a week.” A plant in a bright, warm room drinks far faster than the same plant in a cool, dim one, so a fixed schedule is guaranteed to be wrong half the time. Instead, check the soil: push a finger an inch or two in. If it’s damp, wait. If it’s dry, water thoroughly until it runs out the bottom, then let it drain. That single habit prevents the great majority of plant deaths.'),
          h2('Start with a plant that forgives you'),
          para('Skill comes with time, so stack the deck while you build it. A snake plant, a pothos or a ZZ plant will tolerate a missed watering, a dim corner and a beginner’s learning curve without complaint — and every one of them is on the shelf here, flagged “very easy.” Get one of those thriving first; the fussier plants are much easier once watering is second nature.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'reading-the-light-in-your-home',
    status: 'published',
    body: {
      title: 'Reading the light in your home',
      excerpt: 'The wrong spot kills more plants than the wrong watering. Here’s how to read your light before you buy.',
      featuredImage: { $asset: 'post-light' },
      body: {
        type: 'doc',
        content: [
          para('“Bright, indirect light” is on every plant tag and it means almost nothing until you can look at your own room and know what you’ve got. The good news: you don’t need a light meter. You need to notice which way your windows face and how sharp the shadows are.'),
          h2('The window test'),
          para('South-facing windows give the brightest, longest light; north-facing the softest and dimmest; east and west sit in between, one bright in the morning and the other in the afternoon. Now the shadow test: on a sunny day, hold your hand a foot above the spot you’re eyeing. A hard, crisp shadow means bright light; a soft, fuzzy one means medium; barely a shadow at all means low. That’s the reading that matters.'),
          h2('Match the plant to the spot, not the other way round'),
          para('Don’t buy a sun-lover for a dim hallway and hope — hope is not a lighting plan. Every listing here states the light a plant actually wants in plain words, and our low-light collection is exactly the plants that genuinely cope with a north window or an interior corner. Pick for the spot you have, and the plant does the rest.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'when-and-how-to-repot',
    status: 'published',
    body: {
      title: 'When and how to repot a houseplant',
      excerpt: 'Repotting isn’t a schedule — it’s a response to a plant that has outgrown its home. Here’s how to tell, and how to do it gently.',
      featuredImage: { $asset: 'post-repot' },
      body: {
        type: 'doc',
        content: [
          para('Plants don’t need repotting on a timetable, and doing it too often does more harm than good. You repot when a plant has genuinely outgrown its pot — and it will tell you, if you know the signs.'),
          h2('The signs it’s time'),
          para('Roots creeping out of the drainage holes or circling the surface, water that runs straight through without soaking in, a plant that dries out a day after watering, or growth that has simply stalled in the warm months — any of these means the roots have run out of room. Most houseplants need it every year or two, in spring or summer when they’re actively growing, never in the depths of winter.'),
          h2('How to do it without stress'),
          para('Go up just one pot size — a jump too big leaves too much wet soil around the roots, and you’re back to rot. Water the plant the day before so it slides out easily. Loosen the root ball gently, settle it into fresh potting mix at the same depth it sat before, firm it in, and water it through. Then leave it be: a repotted plant may sulk for a week while it settles, and that’s normal, not an emergency.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-plant-botanical',
  key: 'sparx-retail-plant-botanical',
  name: 'sparx — Plant Nursery (Botanical)',
  theme: THEME,
  summary:
    'A complete, working shop for a houseplant nursery: a real catalogue of easy-care starters, statement plants, pots, tools and a monthly plant subscription, with categories, collections, a bespoke plant PDP and a merchandised home page. Botanical theme — soft sage ground, deep leaf green, a warm terracotta accent. A care-first, beginner-friendly voice. Shipped as Fernwood Plant Co.',
  tagline: 'A warm, working storefront for a houseplant nursery.',
  vertical: 'retail',
  industry: 'Plant nursery',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 87,
  brand: {
    businessName: 'Fernwood Plant Co.',
    tagline: 'Plants you can actually keep alive.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Fernwood Plant Co. — houseplants matched to your light',
      description:
        'Fernwood is a plant nursery for people who’ve killed a plant or two — hardy, forgiving houseplants matched to your light, grown on and shipped with plain care instructions.',
    },
    about: {
      title: 'About Fernwood Plant Co.',
      description:
        'How Fernwood grows, matches and ships houseplants — hardy over fussy, honest about light and water, and a plain-English care card in every box.',
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
