// sparx-retail-coffee-modern — a RETAIL/COMMERCE site template: a modern specialty coffee bar.
//
// The bright, minimalist counterpart to the warm `retail-coffee-craft` gold reference. Same
// full-site machinery (a real product catalogue → the full 9-page commerce site), but a wholly
// different look and posture: a crisp near-white ground, ONE electric-orange accent, a clean
// grotesk display, generous whitespace, and a sharp product GRID rather than rustic full-bleed
// editorial bands. Single origins, a signal blend, an espresso, a Swiss-water decaf, single-serve
// steep bags, brew gear and a flexible subscription. Shipped as Meridian Coffee.
//
// SELF-CONTAINED BY DESIGN — like the craft roaster, this generator carries its OWN inline theme
// and passes it on the spec (`theme`), so the retail family can be authored in parallel with no
// two generators contending on a shared `*-themes.ts` registry.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-coffee-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-coffee-modern/**" \
//     "marketplace-catalog/_gen/gen-retail-coffee-modern.ts"
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
} from '../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { productsBlock } from '../../wizeworks/packages/silica-catalog/src/commerce';
import { defineTheme, face, STATUS_ON_DARK, STATUS_ON_LIGHT } from '../../wizeworks/packages/silica-catalog/src/themes';
import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';

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
// A modern coffee bar: a cool, near-white paper ground, a crisp graphite-black primary that
// makes CTAs read as clean shapes, and ONE electric-orange accent doing all the pointing.
// A grotesk display (Space Grotesk) over a neutral humanist sans (Inter), square-ish corners,
// zero depth. Complete light + dark; AA on every role (the blueprint sweep's contrast check
// is the gate). `secondary` is a mid-graphite — dark and legible on the light ground.
const THEME = defineTheme({
  name: 'meridian-bright',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: ['oklch(99% 0.004 250)', 'oklch(96.5% 0.006 250)', 'oklch(90% 0.012 250)', 'oklch(20% 0.02 260)'],
    roles: {
      primary: 'oklch(22% 0.02 260)',
      secondary: 'oklch(40% 0.02 260)',
      accent: 'oklch(56% 0.18 42)',
      neutral: 'oklch(24% 0.015 260)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(18% 0.014 260)', 'oklch(15% 0.014 260)', 'oklch(12% 0.014 260)', 'oklch(95% 0.006 250)'],
    roles: {
      primary: 'oklch(95% 0.01 260)',
      secondary: 'oklch(74% 0.02 260)',
      accent: 'oklch(72% 0.16 45)',
      neutral: 'oklch(30% 0.015 260)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "meridian-hero": "https://images.unsplash.com/photo-1610889556528-9a770e32642f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlJTIwZXNwcmVzc28lMjBwdWxsaW5nJTIwaW50byUyMHdoaXRlJTIwY3VwJTIwY2xlYW58ZW58MHwwfHx8MTc4NjQwMjAwOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-tile-origin": "https://images.unsplash.com/photo-1651761483492-7d2e26dd3455?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8d2hpdGUlMjBiYWclMjBzaW5nbGUtb3JpZ2luJTIwY29mZmVlJTIwcGFsZSUyMGJhY2tncm91bmR8ZW58MHwwfHx8MTc4NjQwMjAxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-tile-blend": "https://images.unsplash.com/photo-1524350876685-274059332603?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFnJTIwYmxlbmQlMjBjb2ZmZWUlMjBiZXNpZGUlMjBzY2F0dGVyaW5nJTIwcm9hc3RlZCUyMGJlYW5zfGVufDB8MHx8fDE3ODY0MDIwMTN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-tile-ready": "https://images.unsplash.com/photo-1672223303533-05fddcbf6e6c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlLXNlcnZlJTIwc3RlZXAlMjBiYWd8ZW58MHwwfHx8MTc4NjQwMjUxNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-tile-gear": "https://images.unsplash.com/photo-1646346834998-5b610ec21d12?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZCUyMGdyaW5kZXIlMjBmbGF0LWJvdHRvbSUyMGRyaXBwZXIlMjBicmlnaHQlMjBjb3VudGVyfGVufDB8MHx8fDE3ODY0MDIwMTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-feature": "https://images.unsplash.com/photo-1511537190424-bbbab87ac5eb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFyaXN0YSUyMHdlaWdoaW5nJTIwYmVhbnMlMjBzbWFsbCUyMHNjYWxlJTIwYnJpZ2h0JTIwcm9hc3Rlcnl8ZW58MHwwfHx8MTc4NjQwMjAyMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-kenya": "https://images.unsplash.com/photo-1762195657410-112fbc6f2d17?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2hpdGUlMjBiYWclMjBrZW55YSUyMG55ZXJpJTIwc2luZ2xlLW9yaWdpbiUyMGNvZmZlZXxlbnwwfDB8fHwxNzg2NDAyMDI3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-colombia": "https://images.unsplash.com/photo-1775434336035-e52be4790dc1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8d2hpdGUlMjBiYWclMjBjb2xvbWJpYSUyMG5hcmklMjBvJTIwc2luZ2xlLW9yaWdpbiUyMGNvZmZlZXxlbnwwfDB8fHwxNzg2NDAyMDMwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-espresso": "https://images.unsplash.com/photo-1605733513597-a8f8341084e6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFnJTIwdHlwZSUyMDAxfGVufDB8MHx8fDE3ODY0MDI1MjN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-decaf": "https://images.unsplash.com/photo-1559056199-96c307526265?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFnJTIwb2ZmLWdyaWQlMjBzd2lzcy13YXRlciUyMGRlY2FmJTIwY29mZmVlfGVufDB8MHx8fDE3ODY0MDIwMzh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-steeped": "https://images.unsplash.com/photo-1695245503558-5cdb37f49092?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwc2luZ2xlLXNlcnZlJTIwY29mZmVlJTIwc3RlZXAlMjBiYWdzfGVufDB8MHx8fDE3ODY0MDIwNDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-grinder": "https://images.unsplash.com/photo-1636434588547-fcf723c62b88?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJlY2lzaW9uJTIwaGFuZCUyMGdyaW5kZXIlMjBtYXR0ZSUyMHN0ZWVsfGVufDB8MHx8fDE3ODY0MDIwNDV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-dripper": "https://images.unsplash.com/photo-1712664436441-ad3fcb96dff1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxhdC1ib3R0b20lMjBjZXJhbWljJTIwcG91ci1vdmVyJTIwZHJpcHBlcnxlbnwwfDB8fHwxNzg2NDAyMDQ4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-subscription": "https://images.unsplash.com/photo-1642505171999-d704cd50f93c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWluaW1hbGlzdCUyMGNvZmZlZSUyMHN1YnNjcmlwdGlvbiUyMGJveCUyMHR3byUyMGJhZ3N8ZW58MHwwfHx8MTc4NjQwMjA1MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-post-brew": "https://images.unsplash.com/photo-1545665225-b23b99e4d45e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG91ci1vdmVyJTIwYnJld2luZyUyMGdsYXNzJTIwY2FyYWZlJTIwc2NhbGV8ZW58MHwwfHx8MTc4NjQwMjA1NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-post-origin": "https://images.unsplash.com/photo-1649616550039-5921f1a5f3c8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29mZmVlJTIwY2hlcnJpZXMlMjBkcnlpbmd8ZW58MHwwfHx8MTc4NjQwMjUyNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridian-post-water": "https://images.unsplash.com/photo-1442512595331-e89e73853f31?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2F0ZXIlMjBiZWluZyUyMHBvdXJlZCUyMGdvb3NlbmVjayUyMGtldHRsZSUyMGludG8lMjBicmV3ZXJ8ZW58MHwwfHx8MTc4NjQwMjA1OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'meridian-hero', url: src('meridian-hero'), alt: 'A single espresso pulling into a white cup on a clean steel bar' },
  { id: 'meridian-tile-origin', url: src('meridian-tile-origin'), alt: 'A white bag of single-origin coffee on a pale background' },
  { id: 'meridian-tile-blend', url: src('meridian-tile-blend'), alt: 'A bag of blend coffee beside a scattering of roasted beans' },
  { id: 'meridian-tile-ready', url: src('meridian-tile-ready'), alt: 'A single-serve steep bag of coffee over a mug' },
  { id: 'meridian-tile-gear', url: src('meridian-tile-gear'), alt: 'A hand grinder and a flat-bottom dripper on a bright counter' },
  { id: 'meridian-feature', url: src('meridian-feature'), alt: 'A barista weighing beans on a small scale in a bright roastery' },
  { id: 'meridian-ethiopia', url: src('meridian-ethiopia'), alt: 'A white bag of Ethiopia Yirgacheffe single-origin coffee' },
  { id: 'meridian-kenya', url: src('meridian-kenya'), alt: 'A white bag of Kenya Nyeri single-origin coffee' },
  { id: 'meridian-colombia', url: src('meridian-colombia'), alt: 'A white bag of Colombia Nariño single-origin coffee' },
  { id: 'meridian-signal', url: src('meridian-signal'), alt: 'A bag of Signal Blend everyday coffee' },
  { id: 'meridian-espresso', url: src('meridian-espresso'), alt: 'A bag of Type 01 espresso coffee' },
  { id: 'meridian-decaf', url: src('meridian-decaf'), alt: 'A bag of Off-Grid Swiss-water decaf coffee' },
  { id: 'meridian-steeped', url: src('meridian-steeped'), alt: 'A box of single-serve coffee steep bags' },
  { id: 'meridian-grinder', url: src('meridian-grinder'), alt: 'A precision hand grinder in matte steel' },
  { id: 'meridian-dripper', url: src('meridian-dripper'), alt: 'A flat-bottom ceramic pour-over dripper' },
  { id: 'meridian-subscription', url: src('meridian-subscription'), alt: 'A minimalist coffee subscription box of two bags' },
  { id: 'meridian-post-brew', url: src('meridian-post-brew'), alt: 'A pour-over brewing over a glass carafe on a scale' },
  { id: 'meridian-post-origin', url: src('meridian-post-origin'), alt: 'Coffee cherries drying on raised beds in the sun' },
  { id: 'meridian-post-water', url: src('meridian-post-water'), alt: 'Water being poured from a gooseneck kettle into a brewer' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-coffee-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A SPLIT hero — text left on a solid readable panel, one clean photograph right. The
 *  modern counterpoint to the craft roaster's full-bleed photo: no ink on the image, plenty
 *  of white space, a black primary CTA and one orange text link. */
function hero(): Node {
  return el('section', 'bg-base-100 @container', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl grid-cols-1 items-stretch @3xl:grid-cols-2', {
        children: [
          el('div', 'flex flex-col justify-center gap-6 px-6 py-16 @3xl:px-10 @3xl:py-24', {
            children: [
              el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl', {
                text: 'Coffee, dialed in.',
              }),
              el('p', 'max-w-md text-lg leading-relaxed text-base-content', {
                text: 'Meridian is a modern specialty roaster. We source clean, high-grown coffees, roast them to order in small batches, and ship within days — so every cup lands bright, sweet and exactly as intended.',
              }),
              el('div', 'flex flex-wrap items-center gap-6', {
                children: [
                  el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop coffee' }),
                  el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                    attrs: { href: '/shop/subscription' },
                    text: 'Start a subscription',
                  }),
                ],
              }),
            ],
          }),
          el('img', 'h-full min-h-80 w-full object-cover @3xl:min-h-96', {
            attrs: { src: assetUrl('meridian-hero'), alt: 'A single espresso pulling into a white cup', loading: 'lazy' },
          }),
        ],
      }),
    ],
  });
}

/** A crisp three-up promise strip — the flat, no-photo band that keeps the home page reading
 *  as modern and product-forward rather than editorial. Real ink, no fading. */
function valueRow(): Node {
  const cell = (heading: string, body: string): Node =>
    el('div', 'flex flex-col gap-2', {
      children: [
        el('h2', 'text-lg font-semibold tracking-tight text-base-content', { text: heading }),
        el('p', 'text-base leading-relaxed text-base-content', { text: body }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-10', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl grid-cols-1 gap-8 @2xl:grid-cols-3', {
        children: [
          cell('Roasted to order', 'Nothing sits in a warehouse. We roast after you order and ship inside two days.'),
          cell('Free shipping over $40', 'Flat, honest rates below that, and every bag ships whole bean or ground to your brewer.'),
          cell('Skip or cancel anytime', 'A subscription that flexes with you — no lock-in, no minimum, no games.'),
        ],
      }),
    ],
  });
}

/** One category tile — a photo with a label beneath, the whole tile a link. Sharp square
 *  images in a tight grid: the product-forward look, not a scenic band. */
function categoryTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
  return el('a', 'group flex flex-col gap-3', {
    attrs: { href: o.href },
    children: [
      el('img', 'aspect-square w-full rounded-box bg-base-200 object-cover transition group-hover:opacity-90', {
        attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
      }),
      el('span', 'text-base font-semibold text-base-content', { text: o.label }),
    ],
  });
}

function categoryTiles(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Shop by the way you brew',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'meridian-tile-origin', label: 'Single origin', href: '/shop', alt: 'A white bag of single-origin coffee' }),
              categoryTile({ assetId: 'meridian-tile-blend', label: 'Blends', href: '/shop', alt: 'A bag of blend coffee beside roasted beans' }),
              categoryTile({ assetId: 'meridian-tile-ready', label: 'Ready to brew', href: '/shop', alt: 'A single-serve steep bag over a mug' }),
              categoryTile({ assetId: 'meridian-tile-gear', label: 'Brew gear', href: '/shop', alt: 'A hand grinder and a dripper' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A clean feature split — one photo, a heading, a lead and a text link, side by side with
 *  air around it. The modern stand-in for a full-bleed editorial band. */
function featureSplit(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-24', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl grid-cols-1 items-center gap-8 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          el('img', 'aspect-square w-full rounded-box bg-base-200 object-cover', {
            attrs: { src: assetUrl('meridian-feature'), alt: 'A barista weighing beans on a scale', loading: 'lazy' },
          }),
          el('div', 'flex flex-col gap-5', {
            children: [
              el('h2', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl', {
                text: 'Precision, start to finish',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Every coffee is profiled on a sample roaster, logged batch by batch, and cupped before it ships. We chase clarity — the notes on the bag are the notes in the cup, not a wish list.',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Green coffee is bought from importers and farms we can name, at prices that keep good coffee worth growing. Clean sourcing, careful roasting, honest labels.',
              }),
              el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                attrs: { href: '/blog/the-brew-ratio' },
                text: 'Read the brew guide',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The subscription call — a clean bordered card on a tinted band, black CTA, one orange
 *  emphasis. No image: the modern home keeps its rhythm with type and space. */
function subscriptionBand(): Node {
  return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col items-start gap-5 rounded-box border border-base-300 bg-base-100 p-8 @3xl:p-12', {
        children: [
          el('h2', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl', {
            text: 'Never run out',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Pick a coffee and a cadence and we roast it fresh to match your schedule. Rotate through single origins or lock in the Signal Blend — skip, swap or cancel any week from your account.',
          }),
          el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop/subscription' }, text: 'Start a subscription' }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  hero(),
  valueRow(),
  categoryTiles(),
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Fresh off the roaster' }),
  featureSplit(),
  productsBlock({ source: 'commerce.category.single-origin', layout: 'carousel', heading: 'Single origin' }),
  subscriptionBand(),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static brew note, and policy links). Crisp, generous, modern. */
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
                    text: 'Meridian Coffee',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-accent', { text: 'Roasted to order' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Roasted after you order and shipped within two days, whole bean or ground for your brewer. Rest it two to four days off roast, then brew it within a month for the cleanest, sweetest cup.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Brews well with' });

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
    'Shop coffee',
    'Everything we’re roasting right now — single origins, blends, a Swiss-water decaf, single-serve steep bags and the gear to brew them. Filter by roast or origin, sort however you like; all of it ships freshly roasted to order.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The coffees grouped the way people actually shop — fresh off the roaster, the everyday best sellers, the bright single origins, and starter kits for a new setup.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Meridian', 'Looking for an origin, a roast level, or a brewing guide? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $40, and every bag is roasted to order and sent within two days. Not what you hoped for? Tell us and we’ll make it right — good coffee should never be a gamble.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Meridian journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Clear, useful notes from the roastery — how to dial in a cup, why water matters more than you think, and where the coffee actually comes from. No snobbery, just what works.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Meridian' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Meridian began with a sample roaster, a refractometer, and a stubborn belief that great coffee should be repeatable — not a lucky bag once in a while, but the same bright, sweet cup every single morning.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We buy clean, high-grown lots from importers and farms we can name, and we pay above the commodity rate because that is what keeps good coffee worth growing. Then we roast in small batches, profile every one, and cup it before it ships.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No mystery blends, no roast dates you can’t find, no coffee older than it should be. Just precise, modern coffee — sourced with care and roasted to order for the way you actually brew.',
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
    intro: 'Questions about a coffee, help dialing in your brewer, a wholesale enquiry, or want us to roast for your café? Tell us what you’re after and a real person at the roastery will get back to you.',
    submitLabel: 'Email the roastery',
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

const GRIND: OptionDecl = {
  name: 'Grind',
  displayType: 'dropdown',
  values: [{ value: 'Whole bean' }, { value: 'Filter' }, { value: 'Espresso' }],
};
const SIZE: OptionDecl = {
  name: 'Size',
  displayType: 'dropdown',
  values: [{ value: '250g' }, { value: '1kg' }],
};

/** A roasted-coffee bag: two options (Grind × Size), six variants. 1kg is priced at ~3.4×
 *  the 250g, the usual bulk break. Default is Whole bean / 250g. */
const bag = (opts: {
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
  const sizes: { code: string; value: string; mult: number }[] = [
    { code: '250', value: '250g', mult: 1 },
    { code: '1K', value: '1kg', mult: 3.4 },
  ];
  const grinds: { code: string; value: string }[] = [
    { code: 'WB', value: 'Whole bean' },
    { code: 'FL', value: 'Filter' },
    { code: 'ES', value: 'Espresso' },
  ];
  const variants: Variant[] = [];
  for (const s of sizes) {
    for (const g of grinds) {
      variants.push({
        sku: `${opts.sku}-${s.code}-${g.code}`,
        priceCents: money(Math.round(opts.price * s.mult)),
        ...(s.code === '250' && g.code === 'WB' ? { isDefault: true } : {}),
        inventoryPolicy: 'continue',
        optionValues: { Size: s.value, Grind: g.value },
      });
    }
  }
  return {
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: 'Coffee',
    vendor: 'Meridian Coffee',
    tags: opts.tags,
    categoryHandles: opts.categories,
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    options: [SIZE, GRIND],
    variants,
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
  };
};

const PRODUCTS: Product[] = [
  bag({
    handle: 'ethiopia-yirgacheffe',
    title: 'Ethiopia Yirgacheffe',
    description:
      'A washed Yirgacheffe roasted light — the archetype of a bright, clean Ethiopia. Jasmine and bergamot on the nose, lemon-tea acidity, a delicate, sparkling finish. The pour-over that tastes like a place, not just like coffee.',
    price: 22,
    sku: 'MER-ETH-YIRG',
    categories: ['single-origin'],
    collections: ['fresh', 'single-origins'],
    tags: ['single-origin', 'ethiopia', 'washed', 'light-roast'],
    asset: 'meridian-ethiopia',
    seoTitle: 'Ethiopia Yirgacheffe — washed single-origin coffee | Meridian',
    seoDescription: 'A bright, floral washed Ethiopia Yirgacheffe, roasted light. Jasmine, bergamot and lemon-tea acidity.',
  }),
  bag({
    handle: 'kenya-nyeri',
    title: 'Kenya Nyeri',
    description:
      'A washed Kenya from Nyeri County — the coffee that converts people who think they don’t like light roasts. Blackcurrant, ripe tomato and a juicy, structured acidity, with a syrupy weight that fills the cup. Loud, in the best way.',
    price: 24,
    sku: 'MER-KEN-NYERI',
    categories: ['single-origin'],
    collections: ['fresh', 'single-origins'],
    tags: ['single-origin', 'kenya', 'washed', 'light-roast'],
    asset: 'meridian-kenya',
    seoTitle: 'Kenya Nyeri — washed single-origin coffee | Meridian',
    seoDescription: 'A juicy, structured washed Kenya from Nyeri — blackcurrant, ripe tomato and syrupy body. Roasted light.',
  }),
  bag({
    handle: 'colombia-narino',
    title: 'Colombia Nariño',
    description:
      'A washed Colombia from the high slopes of Nariño — the easy, everyone-likes-it single origin. Red apple, caramel and toasted almond, medium-bodied and sweet, equally good black or with milk. The reliable one.',
    price: 20,
    sku: 'MER-COL-NARINO',
    categories: ['single-origin'],
    collections: ['single-origins', 'best-sellers'],
    tags: ['single-origin', 'colombia', 'washed', 'medium-roast'],
    asset: 'meridian-colombia',
    seoTitle: 'Colombia Nariño — washed single-origin coffee | Meridian',
    seoDescription: 'A sweet, balanced washed Colombia from Nariño — red apple, caramel and toasted almond. Roasted medium.',
  }),
  bag({
    handle: 'signal-blend',
    title: 'Signal Blend',
    description:
      'Our everyday blend and the coffee we drink most — a clean Latin American base lifted by a bright East African top note. Chocolate, orange and brown sugar, medium-bodied and forgiving. Great in a filter, great in a press, great half-asleep.',
    price: 18,
    sku: 'MER-SIGNAL',
    categories: ['blends'],
    collections: ['fresh', 'blends', 'best-sellers'],
    tags: ['blend', 'everyday', 'medium-roast'],
    asset: 'meridian-signal',
    seoTitle: 'Signal Blend — everyday coffee | Meridian',
    seoDescription: 'A clean, sweet everyday blend — chocolate, orange and brown sugar. Works in any brewer. Roasted medium.',
  }),
  bag({
    handle: 'type-01-espresso',
    title: 'Type 01 Espresso',
    description:
      'A modern espresso built for clarity, not char — a touch fuller than our filter roasts but still bright underneath. Pulls a syrupy, cocoa-and-red-fruit shot that holds its own in milk without turning to ash. Dialed for the home machine.',
    price: 19,
    sku: 'MER-ESP-01',
    categories: ['blends'],
    collections: ['blends', 'best-sellers'],
    tags: ['blend', 'espresso', 'medium-dark-roast'],
    asset: 'meridian-espresso',
    seoTitle: 'Type 01 Espresso — modern espresso blend | Meridian',
    seoDescription: 'A bright, syrupy modern espresso — cocoa and red fruit, holds up in milk. Roasted medium-dark.',
  }),
  bag({
    handle: 'offgrid-decaf',
    title: 'Off-Grid Decaf',
    description:
      'A Swiss-water decaf that actually tastes like coffee — Colombian beans, chemical-free process, and a roast that keeps the sweetness in. Milk chocolate, baked apple and a soft nutty finish. The evening cup that won’t keep you up.',
    price: 20,
    sku: 'MER-DECAF',
    categories: ['blends'],
    collections: ['blends'],
    tags: ['decaf', 'swiss-water', 'medium-roast'],
    asset: 'meridian-decaf',
    seoTitle: 'Off-Grid Decaf — Swiss-water decaf coffee | Meridian',
    seoDescription: 'A genuinely good Swiss-water decaf — milk chocolate, baked apple and a nutty finish. Roasted medium.',
  }),
  {
    handle: 'steeped-coffee',
    title: 'Steeped Coffee (8-pack)',
    description:
      'Single-serve steep bags — like tea, but real specialty coffee. Tear one open, drop it in a mug, pour hot water and wait five minutes for a clean, full cup. No machine, no grinder, no mess. The travel, office and camp answer, filled with the Signal Blend.',
    status: 'active',
    productType: 'Coffee',
    vendor: 'Meridian Coffee',
    tags: ['ready-to-brew', 'single-serve', 'travel'],
    categoryHandles: ['ready-to-brew'],
    collectionHandles: ['fresh', 'best-sellers'],
    seoTitle: 'Steeped Coffee, 8-pack — single-serve steep bags | Meridian',
    seoDescription: 'Single-serve coffee steep bags — real specialty coffee, no machine. Filled with the Signal Blend.',
    variants: [{ sku: 'MER-STEEP-8', priceCents: money(16), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'meridian-steeped', isPrimary: true, alt: 'A box of single-serve coffee steep bags' }],
  },
  {
    handle: 'precision-grinder',
    title: 'Precision Hand Grinder',
    description:
      'A hand grinder with 38mm conical burrs and stepped adjustment — even, repeatable grounds from espresso to French press, without the noise or the price of a benchtop machine. Matte steel, glass catch, built to outlast a few coffee machines.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Meridian Coffee',
    tags: ['gear', 'brewing', 'grinder'],
    categoryHandles: ['brew-gear'],
    collectionHandles: ['brew-gear', 'starter-kit'],
    seoTitle: 'Precision Hand Grinder — 38mm conical burrs | Meridian',
    seoDescription: 'A quiet, repeatable hand grinder with 38mm conical burrs, from espresso to French press.',
    variants: [{ sku: 'MER-GEAR-GRINDER', priceCents: money(89), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'meridian-grinder', isPrimary: true, alt: 'A precision hand grinder in matte steel' }],
  },
  {
    handle: 'flat-bottom-dripper',
    title: 'Flat-Bottom Dripper',
    description:
      'A flat-bottom ceramic dripper that’s far more forgiving than a cone — the even bed pulls a balanced, repeatable cup even when your pour isn’t perfect. Holds heat, pours clean, and uses standard basket filters. The easiest way into great pour-over.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Meridian Coffee',
    tags: ['gear', 'brewing', 'pour-over'],
    categoryHandles: ['brew-gear'],
    collectionHandles: ['brew-gear', 'starter-kit'],
    seoTitle: 'Flat-Bottom Dripper — forgiving pour-over brewer | Meridian',
    seoDescription: 'A flat-bottom ceramic dripper for a balanced, repeatable pour-over. Uses standard basket filters.',
    variants: [{ sku: 'MER-GEAR-DRIPPER', priceCents: money(34), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'meridian-dripper', isPrimary: true, alt: 'A flat-bottom ceramic pour-over dripper' }],
  },
  {
    handle: 'subscription',
    title: 'Coffee Subscription',
    description:
      'Freshly roasted coffee on your schedule — choose one or two bags and how often, and we roast and ship to match. Rotate through the single origins or lock in the Signal Blend; skip, swap or cancel any week. The easiest way to always have great coffee on the counter.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Meridian Coffee',
    tags: ['subscription', 'gift'],
    categoryHandles: ['subscription'],
    collectionHandles: ['fresh', 'best-sellers'],
    seoTitle: 'Coffee Subscription — freshly roasted, on your schedule | Meridian',
    seoDescription: 'A flexible coffee subscription — pick one or two bags and a cadence; skip, swap or cancel any week.',
    options: [{ name: 'Bags', displayType: 'dropdown', values: [{ value: 'One bag' }, { value: 'Two bags' }] }],
    variants: [
      { sku: 'MER-SUB-1', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue', optionValues: { Bags: 'One bag' } },
      { sku: 'MER-SUB-2', priceCents: money(34), inventoryPolicy: 'continue', optionValues: { Bags: 'Two bags' } },
    ],
    images: [{ assetId: 'meridian-subscription', isPrimary: true, alt: 'A minimalist coffee subscription box' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'single-origin', name: 'Single origin', description: 'Clean, distinct coffees from one farm or region.', featured: true },
    { handle: 'blends', name: 'Blends', description: 'Everyday, espresso and decaf blends.', featured: true },
    { handle: 'ready-to-brew', name: 'Ready to brew', description: 'Single-serve coffee, no machine required.', featured: true },
    { handle: 'brew-gear', name: 'Brew gear', description: 'Grinders, drippers and the kit to brew it right.', featured: true },
    { handle: 'subscription', name: 'Subscription', description: 'Fresh coffee on your schedule.', featured: true },
  ],
  collections: [
    {
      handle: 'fresh',
      name: 'Fresh off the roaster',
      description: 'What came off the roaster this week.',
      type: 'manual',
      featured: true,
      productHandles: ['ethiopia-yirgacheffe', 'kenya-nyeri', 'signal-blend', 'subscription'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The coffees people come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['signal-blend', 'type-01-espresso', 'steeped-coffee', 'subscription'],
    },
    {
      handle: 'single-origins',
      name: 'Single origins',
      description: 'Bright, distinct coffees from one place.',
      type: 'manual',
      featured: false,
      productHandles: ['ethiopia-yirgacheffe', 'kenya-nyeri', 'colombia-narino'],
    },
    {
      handle: 'blends',
      name: 'Blends',
      description: 'Balanced everyday, espresso and decaf blends.',
      type: 'manual',
      featured: false,
      productHandles: ['signal-blend', 'type-01-espresso', 'offgrid-decaf'],
    },
    {
      handle: 'brew-gear',
      name: 'Brew gear',
      description: 'Everything to brew it at home.',
      type: 'manual',
      featured: false,
      productHandles: ['precision-grinder', 'flat-bottom-dripper'],
    },
    {
      handle: 'starter-kit',
      name: 'Starter kit',
      description: 'New to brewing? Start here.',
      type: 'manual',
      featured: false,
      productHandles: ['precision-grinder', 'flat-bottom-dripper', 'signal-blend'],
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
    slug: 'the-brew-ratio',
    status: 'published',
    body: {
      title: 'The one number that fixes most coffee',
      excerpt: 'Before you buy a scale, a kettle or a course, get the ratio right. It’s the single biggest lever you have.',
      featuredImage: { $asset: 'meridian-post-brew' },
      body: {
        type: 'doc',
        content: [
          para('Most weak, sour or bitter coffee at home isn’t a bean problem or a gear problem — it’s a ratio problem. You’re using too little coffee for the water, or too much water for the coffee, and no amount of expensive equipment fixes that. The good news: it’s the easiest thing to correct.'),
          h2('Start at 1-to-16'),
          para('Weigh your coffee and your water, and aim for roughly one gram of coffee to sixteen grams of water — say 25 grams of coffee to 400 grams of water for a two-cup pour-over. That single habit, more than any gadget, is what separates a flat cup from a bright, sweet one. A cheap kitchen scale is the best twenty dollars you’ll spend on coffee.'),
          h2('Then adjust to taste'),
          para('Sour and thin means under-extracted — go a little finer on the grind, or a touch more coffee. Bitter and drying means over-extracted — go coarser, or pull back the coffee slightly. Change one variable at a time and taste as you go. Two or three brews in, you’ll have that coffee dialed, and it’ll taste the same every morning after.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'why-water-matters',
    status: 'published',
    body: {
      title: 'Your coffee is 98% water',
      excerpt: 'You dialed the grind and weighed the dose — and it still tastes flat. The culprit is almost always the water.',
      featuredImage: { $asset: 'meridian-post-water' },
      body: {
        type: 'doc',
        content: [
          para('A brewed cup is about 98% water, so the water you use isn’t a background detail — it’s most of the drink. Too soft and the coffee tastes hollow and sour; too hard and it tastes chalky and dull; heavily chlorinated tap water flattens everything. If a great coffee tastes lifeless, look at what you’re brewing it with before you blame the beans.'),
          h2('Aim for the middle'),
          para('You want water with some minerality but not too much — filtered tap water is usually the sweet spot, and a simple carbon filter removes the chlorine that dulls aromatics. If your tap water is very hard or very soft, a low-mineral bottled water or a remineralizing sachet gets you closer to the balanced middle that lets a coffee show its best.'),
          h2('And get the temperature right'),
          para('Brew just off the boil — around 92 to 96°C, or roughly thirty seconds after a kettle stops rolling. Too hot scorches and turns things bitter; too cool under-extracts and leaves the cup sour and weak. A gooseneck kettle helps you pour with control, but the temperature matters far more than the pretty stream.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'what-single-origin-means',
    status: 'published',
    body: {
      title: 'What “single origin” actually means',
      excerpt: 'It’s on every bag, including ours — here’s what it tells you, what it doesn’t, and why we still pay more for it.',
      featuredImage: { $asset: 'meridian-post-origin' },
      body: {
        type: 'doc',
        content: [
          para('“Single origin” means the coffee in the bag comes from one place — a single farm, a single washing station, or a single small region — rather than being blended across countries. It isn’t a quality grade on its own, but it’s a promise of traceability: you can point at where it grew, and taste the difference a place and a process make, season after season.'),
          h2('Why a place tastes like a place'),
          para('Altitude, soil, the coffee variety, and how the cherry is processed all leave a fingerprint. A washed Ethiopia is floral and tea-like; a washed Kenya is blackcurrant and structured; a Colombian is red apple and caramel. Blend them together and those signatures average out into something rounder and more consistent — which is exactly why a good everyday blend exists too. Single origin is about clarity; a blend is about balance.'),
          h2('Why we pay above the market'),
          para('Traceable, high-grown, carefully processed coffee costs more to produce than the commodity price rewards. Paying above the market isn’t charity — it’s how the good lots keep getting grown, and how the same farmers come back with the same quality year on year. The name on the bag is a promise that someone was paid fairly to grow something worth roasting.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-coffee-modern',
  key: 'sparx-retail-coffee-modern',
  name: 'Coffee Roaster (Modern)',
  theme: THEME,
  summary:
    'A complete, working shop for a modern specialty coffee roaster: a real catalogue of single-origin bags, blends, a Swiss-water decaf, single-serve steep bags, brew gear and a flexible subscription, with categories, collections, a bespoke PDP and a sharp, product-forward home page. Bright, minimalist theme — a crisp near-white ground, one electric-orange accent, a clean grotesk display. Shipped as Meridian Coffee.',
  tagline: 'A crisp, modern storefront for a specialty coffee roaster.',
  vertical: 'retail',
  industry: 'Coffee roaster',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 87,
  brand: {
    businessName: 'Meridian Coffee',
    tagline: 'Coffee, dialed in.',
  },
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Meridian Coffee — modern specialty coffee, roasted to order',
      description:
        'Meridian is a modern specialty roaster — clean single origins, blends, a Swiss-water decaf and a flexible subscription, roasted to order and shipped within days. Coffee, dialed in.',
    },
    about: {
      title: 'About Meridian Coffee',
      description:
        'How Meridian sources, roasts and ships — clean high-grown lots, small-batch profiling, fair prices, and coffee that tastes exactly as intended, cup after cup.',
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
