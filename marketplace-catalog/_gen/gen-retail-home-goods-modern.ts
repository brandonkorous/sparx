// sparx-retail-home-goods-modern — a RETAIL/COMMERCE site template: a design-led homeware shop.
//
// A member of the retail family and the crisp, contemporary counterpart to the warm "buy once"
// Hearth & Hollow: a complete, working shop the moment it installs — a real catalogue of a
// modern floor lamp, a minimalist vase, a wool-blend rug, a lacquer tray, a modular shelf,
// geometric cushions, a carafe set and a wall clock, with categories + collections, a bespoke
// PDP and the full 9-page commerce site (home merchandising → shop → collections → cart →
// search → journal → about → contact). Dressed in an INLINE bespoke theme (cool near-white
// ground, a confident near-black primary and an ochre accent, a clean grotesk over a grotesk,
// sharp architectural corners). Shipped as Form & Field.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme inline
// and passes it on the spec (`theme`), so the whole family can be authored in parallel without
// any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-home-goods-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-home-goods-modern/**" \
//     "marketplace-catalog/_gen/gen-retail-home-goods-modern.ts"
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
// A modern, architectural look — deliberately the COOL counterpart to Hearth & Hollow's
// warm linen. A cool near-white ground (a whisper of blue-grey, not cream), a confident
// near-black primary, and one warm ochre accent for the graphic hit. A clean grotesk display
// over a grotesk body, and near-square corners for the crisp, drawn-with-a-ruler feel.
// Complete light + dark, AA on every role (the blueprint sweep's contrast check is the gate).
// `secondary` is a cool slate that stays dark and legible on the light ground (it sets label
// text on the PDP); `accent` (ochre) sits below ~50% L so it reads as a link on the light page.
const THEME = defineTheme({
  name: 'form-field-modern',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: ['oklch(98% 0.003 255)', 'oklch(95% 0.005 258)', 'oklch(90% 0.008 260)', 'oklch(20% 0.012 262)'],
    roles: {
      primary: 'oklch(24% 0.018 262)',
      secondary: 'oklch(42% 0.02 258)',
      accent: 'oklch(50% 0.12 68)',
      neutral: 'oklch(24% 0.014 262)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(19% 0.008 262)', 'oklch(16% 0.008 262)', 'oklch(13% 0.008 262)', 'oklch(96% 0.003 255)'],
    roles: {
      primary: 'oklch(88% 0.012 260)',
      secondary: 'oklch(76% 0.02 258)',
      accent: 'oklch(74% 0.12 70)',
      neutral: 'oklch(30% 0.012 262)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "home-hero": "https://images.unsplash.com/photo-1772112334842-ef9917ac915e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWluaW1hbGlzdCUyMG1vZGVybiUyMGxpdmluZyUyMHJvb20lMjBhcmMlMjBmbG9vciUyMGxhbXB8ZW58MHwwfHx8MTc4NjQwNzY1M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-tile-lighting": "https://images.unsplash.com/photo-1776362658611-2067c9ded1d1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2N1bHB0dXJhbCUyMGZsb29yJTIwbGFtcHxlbnwwfDB8fHwxNzg2NDA4OTg4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-tile-living": "https://images.unsplash.com/photo-1749703977772-4008c36ba7c9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29vbCUyMHJ1ZyUyMGdlb21ldHJpYyUyMGN1c2hpb25zJTIwYnJpZ2h0JTIwbW9kZXJuJTIwcm9vbXxlbnwwfDB8fHwxNzg2NDA3NjU5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-tile-table": "https://images.unsplash.com/photo-1588157549725-abce1cac3c93?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xlYW4lMjBtb2Rlcm4lMjB0YWJsZSUyMHNldCUyMGdsYXNzJTIwY2FyYWZlJTIwdHVtYmxlcnN8ZW58MHwwfHx8MTc4NjQwNzY2M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-tile-decor": "https://images.unsplash.com/photo-1613424777445-f93a2a48e285?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9ub2xpdGhpYyUyMGNlcmFtaWMlMjB2YXNlfGVufDB8MHx8fDE3ODY0MDg5OTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-band-design": "https://images.unsplash.com/photo-1695712551846-4dc15433fbd4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVzaWduZXIlMjBza2V0Y2hpbmclMjBvYmplY3QlMjBicmlnaHQlMjBzdHVkaW8lMjBiZW5jaHxlbnwwfDB8fHwxNzg2NDA3NjY5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-band-materials": "https://images.unsplash.com/photo-1671022442106-c787685d9fed?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmF3JTIwbWF0ZXJpYWxzJTIwbGFpZCUyMG91dCUyMHBvd2Rlci1jb2F0ZWQlMjBzdGVlbCUyMG9ha3xlbnwwfDB8fHwxNzg2NDA3NjcyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-floor-lamp": "https://images.unsplash.com/photo-1738161022829-fdddbbcfc1ad?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2xpbSUyMGFyYyUyMGZsb29yfGVufDB8MHx8fDE3ODY0MDg5OTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-vase": "https://images.unsplash.com/photo-1600529782623-5d3cb98476c9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFsbCUyMG1vbm9saXRoaWMlMjBtYXR0ZSUyMGNlcmFtaWMlMjB2YXNlfGVufDB8MHx8fDE3ODY0MDc2Nzh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-rug": "https://images.unsplash.com/photo-1594922234647-4ade6282c369?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxhdC13b3ZlbiUyMHdvb2wtYmxlbmQlMjBydWclMjBncmFwaGljJTIwYmxvY2slMjBwYXR0ZXJufGVufDB8MHx8fDE3ODY0MDc2ODF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-tray": "https://images.unsplash.com/photo-1532368946481-86c4303674ea?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGFjcXVlcmVkJTIwcmVjdGFuZ3VsYXIlMjBzZXJ2aW5nJTIwdHJheXxlbnwwfDB8fHwxNzg2NDA3Njg1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-shelf": "https://images.unsplash.com/photo-1619217843419-4d60e0872e1f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9kdWxhciUyMHBvd2Rlci1jb2F0ZWQlMjBzdGVlbCUyMG9hayUyMHNoZWx2aW5nJTIwdW5pdHxlbnwwfDB8fHwxNzg2NDA3Njg4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cushions": "https://images.unsplash.com/photo-1689952896845-366dfdcb4d88?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpciUyMGdlb21ldHJpYyUyMGNvbG91ci1ibG9ja2VkJTIwY3VzaGlvbnMlMjBiZW5jaHxlbnwwfDB8fHwxNzg2NDA3NjkzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-carafe": "https://images.unsplash.com/photo-1660303438028-b59af33c618c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhc3MlMjBjYXJhZmUlMjB0d28lMjBtYXRjaGluZyUyMHR1bWJsZXJzfGVufDB8MHx8fDE3ODY0MDc2OTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-clock": "https://images.unsplash.com/photo-1573665703669-2b696af53b86?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWluaW1hbGlzdCUyMHdhbGwlMjBjbG9jayUyMGJhcmUlMjBtZXRhbCUyMGZhY2V8ZW58MHwwfHx8MTc4NjQwNzcwMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-lighting": "https://images.unsplash.com/photo-1606170033648-5d55a3edf314?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FybSUyMGxhbXBsaWdodCUyMGxheWVyZWR8ZW58MHwwfHx8MTc4NjQwODk5OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-materials": "https://images.unsplash.com/photo-1693948568453-a3564f179a84?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xvc2UtdXAlMjBwb3dkZXItY29hdGVkJTIwc3RlZWwlMjBtZWV0aW5nJTIwc29saWQlMjBvYWt8ZW58MHwwfHx8MTc4NjQwNzcwNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-palette": "https://images.unsplash.com/photo-1675783453128-cdb7ffad8595?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVzdHJhaW5lZCUyMHBhbGV0dGUlMjBncmV5JTIwb2FrJTIwb25lJTIwYm9sZCUyMGFjY2VudHxlbnwwfDB8fHwxNzg2NDA3NzA5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'home-hero', url: src('home-hero'), alt: 'A minimalist modern living room with an arc floor lamp and a low sofa' },
  { id: 'home-tile-lighting', url: src('home-tile-lighting'), alt: 'A sculptural floor lamp against a bare plaster wall' },
  { id: 'home-tile-living', url: src('home-tile-living'), alt: 'A wool rug and geometric cushions in a bright modern room' },
  { id: 'home-tile-table', url: src('home-tile-table'), alt: 'A clean modern table set with a glass carafe and tumblers' },
  { id: 'home-tile-decor', url: src('home-tile-decor'), alt: 'A monolithic ceramic vase and a wall clock on a concrete shelf' },
  { id: 'home-band-design', url: src('home-band-design'), alt: 'A designer sketching an object at a bright studio bench' },
  { id: 'home-band-materials', url: src('home-band-materials'), alt: 'Raw materials laid out — powder-coated steel, oak and wool felt' },
  { id: 'prod-floor-lamp', url: src('prod-floor-lamp'), alt: 'A slim arc floor lamp with a spun-metal shade' },
  { id: 'prod-vase', url: src('prod-vase'), alt: 'A tall monolithic matte ceramic vase' },
  { id: 'prod-rug', url: src('prod-rug'), alt: 'A flat-woven wool-blend rug with a graphic block pattern' },
  { id: 'prod-tray', url: src('prod-tray'), alt: 'A lacquered rectangular serving tray' },
  { id: 'prod-shelf', url: src('prod-shelf'), alt: 'A modular powder-coated steel and oak shelving unit' },
  { id: 'prod-cushions', url: src('prod-cushions'), alt: 'A pair of geometric colour-blocked cushions on a bench' },
  { id: 'prod-carafe', url: src('prod-carafe'), alt: 'A glass carafe with two matching tumblers' },
  { id: 'prod-clock', url: src('prod-clock'), alt: 'A minimalist wall clock with a bare metal face' },
  { id: 'post-lighting', url: src('post-lighting'), alt: 'Warm lamplight layered across a dim modern room at dusk' },
  { id: 'post-materials', url: src('post-materials'), alt: 'Close-up of powder-coated steel meeting solid oak' },
  { id: 'post-palette', url: src('post-palette'), alt: 'A restrained palette of grey, oak and one bold accent' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-home-goods-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A crisp SPLIT hero — a solid text column beside a single square photograph, not a
 *  full-bleed image with a floating panel. Architectural and graphic: the type carries the
 *  left, the object carries the right. Never ink on the photo. */
function hero(): Node {
  return el('section', 'bg-base-100 @container', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl grid-cols-1 items-stretch gap-0 @3xl:grid-cols-2', {
        children: [
          el('div', 'flex flex-col justify-center gap-6 px-6 py-16 @3xl:py-24', {
            children: [
              el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl', {
                text: 'Objects with a point of view.',
              }),
              el('p', 'max-w-md text-lg leading-relaxed text-base-content', {
                text: 'Form & Field makes design-led objects for a considered home — lighting, textiles and tableware drawn with intent and built to be looked at as much as used. Clean lines, honest materials, one confident colour at a time.',
              }),
              el('div', 'flex flex-wrap items-center gap-5', {
                children: [
                  el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop everything' }),
                  el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                    attrs: { href: '/shop' },
                    text: 'New this season',
                  }),
                ],
              }),
            ],
          }),
          el('img', 'aspect-square w-full bg-base-200 object-cover @3xl:h-full', {
            attrs: {
              src: assetUrl('home-hero'),
              alt: 'A minimalist modern living room with an arc floor lamp',
              loading: 'lazy',
            },
          }),
        ],
      }),
    ],
  });
}

/** One category tile — a photo with a graphic left-aligned label beneath it, uppercase and
 *  tracked for the modern editorial feel. The whole tile is a link. */
function categoryTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
  return el('a', 'group flex flex-col gap-3', {
    attrs: { href: o.href },
    children: [
      el('img', 'aspect-square w-full bg-base-200 object-cover transition group-hover:opacity-90', {
        attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
      }),
      el('span', 'text-sm font-semibold uppercase tracking-widest text-base-content', { text: o.label }),
    ],
  });
}

function categoryTiles(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Shop by category',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'home-tile-lighting', label: 'Lighting', href: '/shop', alt: 'A sculptural floor lamp' }),
              categoryTile({ assetId: 'home-tile-living', label: 'Living', href: '/shop', alt: 'A wool rug and cushions' }),
              categoryTile({ assetId: 'home-tile-table', label: 'Table', href: '/shop', alt: 'A carafe and tumblers' }),
              categoryTile({ assetId: 'home-tile-decor', label: 'Decor', href: '/shop', alt: 'A vase and a wall clock' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A crisp SPLIT editorial band — a square photo on one side and a SOLID colour text block on
 *  the other, not a full-bleed image with a floating panel. `imageRight` alternates the sides
 *  so two bands read as a considered rhythm. Architectural, graphic, and never ink on a photo. */
function splitBand(o: {
  heading: string;
  lead: string;
  assetId: string;
  cta: string;
  href: string;
  alt: string;
  imageRight?: boolean;
}): Node {
  const image = el('img', 'aspect-square w-full bg-base-200 object-cover @3xl:h-full', {
    attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
  });
  const text = el('div', 'flex flex-col justify-center gap-5 bg-base-200 px-6 py-16 @3xl:px-12 @3xl:py-24', {
    children: [
      el('h2', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl', {
        text: o.heading,
      }),
      el('p', 'max-w-md text-lg leading-relaxed text-base-content', { text: o.lead }),
      el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
        attrs: { href: o.href },
        text: o.cta,
      }),
    ],
  });
  return el('section', 'bg-base-100 @container', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl grid-cols-1 items-stretch gap-0 @3xl:grid-cols-2', {
        children: o.imageRight ? [text, image] : [image, text],
      }),
    ],
  });
}

const HOME: Node[] = [
  hero(),
  categoryTiles(),
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New this season' }),
  splitBand({
    heading: 'Designed, not decorated',
    lead: 'Every piece starts as a drawing and a problem to solve — how a lamp throws light, how a shelf carries weight, how a rug anchors a room. We work with independent designers and small manufacturers, and we only make the object once it earns its place.',
    assetId: 'home-band-design',
    cta: 'Our approach',
    href: '/blog/how-we-design',
    alt: 'A designer sketching an object at a studio bench',
  }),
  productsBlock({ source: 'commerce.category.lighting', layout: 'carousel', heading: 'The lighting edit' }),
  splitBand({
    heading: 'One bold thing per room',
    lead: 'A restrained space needs a single confident move — an ochre lamp, a graphic rug, a monolithic vase — to keep it from going flat. Build the room in greys and oak, then let one object carry the colour. That is the whole method.',
    assetId: 'home-band-materials',
    cta: 'Shop living',
    href: '/shop',
    alt: 'Raw materials — powder-coated steel, oak and wool felt',
    imageRight: true,
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static design note, and policy links). */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          pdpImage('aspect-square w-full bg-base-200 object-cover'),
          el('div', 'flex flex-col gap-6 @3xl:py-4', {
            children: [
              el('div', 'flex flex-col gap-4', {
                children: [
                  el('p', 'text-sm font-semibold uppercase tracking-widest text-secondary', {
                    text: 'Form & Field',
                  }),
                  pdpTitle('h1', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl'),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-semibold text-base-content',
                    compareClass: 'text-lg text-secondary line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 border border-base-300 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-base-content',
                    label: 'Low stock',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Designed to be lived with' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Made in small runs by independent workshops from honest materials — powder-coated steel, solid oak, real wool and glass. Every piece is drawn with intent and built to earn its place. Free returns within 30 days if it isn’t right for your space.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Completes the room' });

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
    'Shop everything',
    'The whole catalogue in one place — lighting, textiles, tableware, storage and decor. Filter by category or sort however you like; every piece is designed with intent, made in small runs, and built to be lived with.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead(
    'Collections',
    'The catalogue grouped the way people actually shop — what’s new this season, the pieces people keep coming back for, the lighting edit, and edits for the table and the living room.'
  ),
];
const SEARCH: Node[] = [
  pageMasthead('Search Form & Field', 'Looking for a colour, a material, or a piece for a particular room? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $120, carefully packed to arrive in one piece. Not quite right for your space? Send it back within 30 days — we want the object to earn its place, not just fill it.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Form & Field journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the studio — how a piece gets designed, how to build a room around one bold object, and where our materials come from. Considered, useful, no jargon.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Form & Field' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Form & Field began with a conviction: a home doesn’t need more things, it needs better ones. Too much homeware is decoration — shaped to fill a shelf and forgotten by next season. We wanted to make the opposite: a small, sharp catalogue of objects that are drawn with intent and hold up to being looked at every day.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'So we work with independent designers and small manufacturers, and we design each piece around a real problem — how a lamp throws light, how a shelf carries weight, how a rug anchors a room. Honest materials, clean lines, and one confident colour where it counts. If an object doesn’t earn its place, we don’t make it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No trend-chasing, no wall of nearly-the-same, no pieces designed to be replaced. Just design-led objects for a considered home — the kind of things you build a room around and keep for years.',
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
    intro: 'Questions about a piece, help planning a room, or a trade and interiors enquiry? Tell us what you’re after and a real person here will get back to you — usually within a day.',
    submitLabel: 'Email us',
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

const VENDOR = 'Form & Field';

/** Unique short codes for a value list — grows the slice until each is distinct, so two
 *  values sharing a prefix (Slate / Sand) never collide in a SKU. */
const uniqueCodes = (values: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  const seen = new Set<string>();
  for (const v of values) {
    const alpha = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let len = 3;
    let code = alpha.slice(0, len) || 'VAR';
    while (seen.has(code) && len < alpha.length) code = alpha.slice(0, ++len);
    seen.add(code);
    out[v] = code;
  }
  return out;
};

interface Base {
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
  seoTitle: string;
  seoDescription: string;
}

const shell = (b: Base, options: OptionDecl[] | undefined, variants: Variant[]): Product => ({
  handle: b.handle,
  title: b.title,
  description: b.description,
  status: 'active',
  productType: b.productType,
  vendor: VENDOR,
  tags: b.tags,
  categoryHandles: b.categories,
  collectionHandles: b.collections,
  seoTitle: b.seoTitle,
  seoDescription: b.seoDescription,
  ...(options ? { options } : {}),
  variants,
  images: [{ assetId: b.asset, isPrimary: true, alt: b.title }],
});

/** A piece offered in a set of colour/finish swatches — one variant per colour, flat price. */
const colored = (b: Base & { colors: string[]; optionName?: string }): Product => {
  const name = b.optionName ?? 'Colour';
  const codes = uniqueCodes(b.colors);
  const variants: Variant[] = b.colors.map((c, i) => ({
    sku: `${b.sku}-${codes[c]}`,
    priceCents: money(b.price),
    ...(i === 0 ? { isDefault: true as const } : {}),
    inventoryPolicy: 'continue' as const,
    optionValues: { [name]: c },
  }));
  const option: OptionDecl = { name, displayType: 'swatch', values: b.colors.map((value) => ({ value })) };
  return shell(b, [option], variants);
};

const PRODUCTS: Product[] = [
  colored({
    handle: 'aurora-arc-floor-lamp',
    title: 'Aurora Arc Floor Lamp',
    description:
      'A slim steel arc that reaches out over the sofa and drops a spun-metal shade exactly where you read. The counter-weighted base keeps it planted, an in-line dimmer sets the mood, and the whole thing draws a single confident line across a room. The lamp you build the corner around.',
    price: 289,
    sku: 'FF-LGT-AURORA',
    productType: 'Lighting',
    categories: ['lighting'],
    collections: ['new-arrivals', 'the-lighting-edit', 'best-sellers'],
    tags: ['lighting', 'floor-lamp', 'steel'],
    colors: ['Graphite', 'Ochre', 'Chalk'],
    optionName: 'Finish',
    asset: 'prod-floor-lamp',
    seoTitle: 'Aurora Arc Floor Lamp — spun-metal reading light | Form & Field',
    seoDescription: 'A slim steel arc floor lamp with a counter-weighted base and in-line dimmer. One confident line across a room.',
  }),
  colored({
    handle: 'monolith-ceramic-vase',
    title: 'Monolith Ceramic Vase',
    description:
      'A tall, deliberately heavy vase in matte-glazed stoneware — a single sculptural column that holds a spray of branches or stands entirely on its own. Thrown and finished by hand, so the surface catches light like poured concrete. The one bold object a bare shelf has been waiting for.',
    price: 96,
    sku: 'FF-DEC-MONOLITH',
    productType: 'Decor',
    categories: ['decor'],
    collections: ['new-arrivals', 'best-sellers'],
    tags: ['ceramic', 'vase', 'decor'],
    colors: ['Slate', 'Bone', 'Ochre'],
    optionName: 'Glaze',
    asset: 'prod-vase',
    seoTitle: 'Monolith Ceramic Vase — matte sculptural stoneware | Form & Field',
    seoDescription: 'A tall, heavy matte-glazed stoneware vase — a single sculptural column for branches or on its own.',
  }),
  colored({
    handle: 'field-wool-blend-rug',
    title: 'Field Wool-Blend Rug',
    description:
      'A flat-woven wool-blend rug with a bold block pattern that anchors a room without shouting over it. Dense and hard-wearing underfoot, low enough to sit under a door, and reversible for twice the life. The graphic move a floor of greys and oak is asking for.',
    price: 345,
    sku: 'FF-LIV-FIELDRUG',
    productType: 'Textiles',
    categories: ['living'],
    collections: ['new-arrivals', 'the-living-room', 'best-sellers'],
    tags: ['rug', 'wool', 'living-room'],
    colors: ['Slate & Sand', 'Ochre & Bone', 'Ink & Grey'],
    optionName: 'Colourway',
    asset: 'prod-rug',
    seoTitle: 'Field Wool-Blend Rug — flat-woven graphic rug | Form & Field',
    seoDescription: 'A flat-woven, reversible wool-blend rug with a bold block pattern. Hard-wearing and graphic underfoot.',
  }),
  colored({
    handle: 'plane-lacquer-tray',
    title: 'Plane Lacquer Tray',
    description:
      'A rectangular serving tray in hand-lacquered wood, with a low lip and a surface so smooth it reads as a single plane of colour. Corrals the coffee things, carries drinks to the table, or lives on the ottoman as a place to set a room. Wipe-clean and quietly luxurious.',
    price: 74,
    sku: 'FF-TAB-PLANE',
    productType: 'Tableware',
    categories: ['table'],
    collections: ['the-table', 'gifting'],
    tags: ['tray', 'lacquer', 'serving'],
    colors: ['Ink', 'Ochre', 'Oxblood'],
    optionName: 'Lacquer',
    asset: 'prod-tray',
    seoTitle: 'Plane Lacquer Tray — hand-lacquered serving tray | Form & Field',
    seoDescription: 'A hand-lacquered rectangular serving tray with a low lip and a smooth single-plane finish. Wipe-clean.',
  }),
  colored({
    handle: 'grid-modular-shelf',
    title: 'Grid Modular Shelf',
    description:
      'A powder-coated steel frame and solid oak shelves that bolt together into exactly the storage a wall needs — stack it tall, run it long, or keep it low under a window. Ships flat, assembles with the one included key, and reconfigures every time you move. Honest structure, on show.',
    price: 420,
    sku: 'FF-LIV-GRID',
    productType: 'Storage',
    categories: ['living'],
    collections: ['the-living-room', 'new-arrivals'],
    tags: ['shelf', 'storage', 'steel', 'oak'],
    colors: ['Graphite', 'Chalk', 'Ochre'],
    optionName: 'Frame',
    asset: 'prod-shelf',
    seoTitle: 'Grid Modular Shelf — steel and oak shelving | Form & Field',
    seoDescription: 'A powder-coated steel and solid oak modular shelf that bolts together to fit any wall. Ships flat, reconfigures.',
  }),
  colored({
    handle: 'facet-cushion-pair',
    title: 'Facet Cushion Pair',
    description:
      'A pair of colour-blocked cushions with a clean geometric seam and a plump feather-blend fill — the quick, graphic way to bring one bold colour to a neutral sofa. Generous 18-inch squares with a hidden zip and a woven cotton face that holds its shape. Add one for a note, a pair for a statement.',
    price: 68,
    sku: 'FF-LIV-FACET',
    productType: 'Textiles',
    categories: ['living'],
    collections: ['the-living-room', 'gifting', 'best-sellers'],
    tags: ['cushion', 'geometric', 'textiles', 'living-room'],
    colors: ['Ochre & Grey', 'Slate & Bone', 'Ink & Rust'],
    optionName: 'Colourway',
    asset: 'prod-cushions',
    seoTitle: 'Facet Cushion Pair — geometric colour-blocked cushions | Form & Field',
    seoDescription: 'A pair of 18-inch colour-blocked cushions with a clean geometric seam and a feather-blend fill.',
  }),
  colored({
    handle: 'decant-carafe-set',
    title: 'Decant Carafe Set',
    description:
      'A hand-blown glass carafe and two matching tumblers that read as one clean silhouette on the nightstand or the table. Thin-walled and perfectly weighted, with a stopper that doubles as a cup — water by the bed, wine at dinner, or a considered gift that always lands. Dishwasher-safe glass.',
    price: 58,
    sku: 'FF-TAB-DECANT',
    productType: 'Tableware',
    categories: ['table'],
    collections: ['the-table', 'gifting', 'best-sellers'],
    tags: ['glass', 'carafe', 'tableware', 'gift'],
    colors: ['Clear', 'Smoke', 'Amber'],
    optionName: 'Glass',
    asset: 'prod-carafe',
    seoTitle: 'Decant Carafe Set — hand-blown glass carafe and tumblers | Form & Field',
    seoDescription: 'A hand-blown glass carafe with two matching tumblers and a cup-stopper. One clean silhouette, dishwasher-safe.',
  }),
  colored({
    handle: 'arc-wall-clock',
    title: 'Arc Wall Clock',
    description:
      'A minimalist wall clock stripped to essentials — a bare spun-metal face, two crisp hands and a silent sweep movement, so a quiet room stays quiet. Reads clearly across a kitchen or a studio, and hangs as a graphic full-stop on an empty wall. The rare clock you actually want to look at.',
    price: 82,
    sku: 'FF-DEC-ARCCLOCK',
    productType: 'Decor',
    categories: ['decor'],
    collections: ['gifting', 'new-arrivals'],
    tags: ['clock', 'wall', 'decor', 'gift'],
    colors: ['Brass', 'Graphite', 'Chalk'],
    optionName: 'Face',
    asset: 'prod-clock',
    seoTitle: 'Arc Wall Clock — minimalist silent wall clock | Form & Field',
    seoDescription: 'A minimalist wall clock with a bare spun-metal face and a silent sweep movement. A graphic full-stop on a wall.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'lighting', name: 'Lighting', description: 'Sculptural lamps and considered light for every room.', featured: true },
    { handle: 'living', name: 'Living', description: 'Rugs, cushions, shelving and textiles for the living room.', featured: true },
    { handle: 'table', name: 'Table', description: 'Glassware, trays and serving pieces with a clean line.', featured: true },
    { handle: 'decor', name: 'Decor', description: 'Vases, clocks and the one bold object a room is built around.', featured: true },
  ],
  collections: [
    {
      handle: 'new-arrivals',
      name: 'New this season',
      description: 'The latest objects to land in the catalogue.',
      type: 'manual',
      featured: true,
      productHandles: ['aurora-arc-floor-lamp', 'monolith-ceramic-vase', 'field-wool-blend-rug', 'arc-wall-clock'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The pieces people keep coming back for.',
      type: 'manual',
      featured: true,
      productHandles: ['aurora-arc-floor-lamp', 'field-wool-blend-rug', 'facet-cushion-pair', 'decant-carafe-set'],
    },
    {
      handle: 'the-lighting-edit',
      name: 'The lighting edit',
      description: 'Sculptural lamps and warm, considered light.',
      type: 'manual',
      featured: false,
      productHandles: ['aurora-arc-floor-lamp'],
    },
    {
      handle: 'the-table',
      name: 'The table',
      description: 'Glassware, trays and serving pieces with a clean line.',
      type: 'manual',
      featured: false,
      productHandles: ['plane-lacquer-tray', 'decant-carafe-set'],
    },
    {
      handle: 'the-living-room',
      name: 'The living room',
      description: 'Rugs, cushions and honest, on-show storage.',
      type: 'manual',
      featured: false,
      productHandles: ['field-wool-blend-rug', 'grid-modular-shelf', 'facet-cushion-pair'],
    },
    {
      handle: 'gifting',
      name: 'Gifts',
      description: 'Design-led objects that are easy to give and better to keep.',
      type: 'manual',
      featured: false,
      productHandles: ['plane-lacquer-tray', 'decant-carafe-set', 'arc-wall-clock', 'facet-cushion-pair'],
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
    slug: 'how-we-design',
    status: 'published',
    body: {
      title: 'How we design an object',
      excerpt: 'Every piece we make starts as a drawing and a problem to solve — never a shape looking for a use. Here’s how an object gets from a sketch to your shelf.',
      featuredImage: { $asset: 'post-materials' },
      body: {
        type: 'doc',
        content: [
          para('Most homeware is designed backwards: a shape is chosen because it looks good in a photograph, and a purpose is invented for it afterwards. We work the other way around. Before anything is drawn, we write down the problem — a corner that needs a reading light, a wall that needs storage without bulk, a table that needs one confident object — and the object is the answer to that sentence.'),
          h2('The problem comes first'),
          para('That discipline is what keeps the catalogue small and sharp. A lamp has to throw usable light and hold its balance; a shelf has to carry real weight and still ship flat; a rug has to survive a hallway and stay graphic after a hundred washes. If a design can’t answer its problem better than what already exists, we don’t make it — no matter how good it looks on the bench.'),
          h2('Honest materials, on show'),
          para('We choose materials for how they behave, not just how they look, and then we leave them visible. Powder-coated steel keeps its edge, solid oak takes years of use, wool felt softens sound, hand-blown glass reads as a single clean line. Nothing is clad in a veneer pretending to be something else. When the structure is honest, the object needs no decoration — the way it’s made is the way it looks.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'building-a-room-around-one-object',
    status: 'published',
    body: {
      title: 'Building a room around one object',
      excerpt: 'A restrained room can read as flat — unless one confident object carries the colour. Here’s how to choose it, and how to let everything else recede.',
      featuredImage: { $asset: 'post-palette' },
      body: {
        type: 'doc',
        content: [
          para('There’s a version of minimalism that goes cold — all grey, all oak, all restraint, and nothing to rest your eye on. The fix isn’t more objects; it’s one better one. A single piece carrying a bold colour or a strong silhouette gives a quiet room a centre of gravity, and lets everything around it stay calm on purpose rather than by accident.'),
          h2('Pick the hero, then hold the line'),
          para('Start by choosing the one object that gets to be loud — an ochre floor lamp, a graphic rug, a monolithic vase — and place it where the eye lands first. Then hold the line everywhere else: keep the walls and the big soft furniture in neutrals, keep the materials to two or three, and resist the urge to answer your bold piece with a second one. One hero per room; the rest is chorus.'),
          h2('Let the negative space work'),
          para('The empty parts of a room are doing as much work as the full ones. A bare stretch of wall, a clear shelf, an uncluttered floor — that space is what lets a single object read as deliberate instead of lost. Buy less, leave room around what you keep, and the pieces you chose with intent finally get to be seen. That’s the whole method, and it costs nothing to apply.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'layering-light-in-a-modern-room',
    status: 'published',
    body: {
      title: 'Layering light in a modern room',
      excerpt: 'One bright ceiling light flattens everything under it. Good rooms are lit in layers — here’s the simple three-part rule we design our lighting around.',
      featuredImage: { $asset: 'post-lighting' },
      body: {
        type: 'doc',
        content: [
          para('The fastest way to make a considered room feel like an office is to light it from a single bright fixture in the middle of the ceiling. Flat, overhead, shadowless light erases the texture and depth you spent so long getting right. The rooms that feel good after dark are lit the way a stage is — in layers, from several heights, each doing a different job.'),
          h2('Ambient, task, accent'),
          para('Think in three layers. Ambient is the soft, general fill that keeps the room from going black — often bounced off a wall or a ceiling rather than pointed down. Task is the focused, adjustable light you actually read and cook and work by, like an arc lamp reaching over a chair. Accent is the low, warm pool that adds mood and picks out an object — a lamp on a shelf, a glow in a corner. Get one of each and you can light the room for anything.'),
          h2('Warm, low, and on a dimmer'),
          para('Two more rules and you’re done. Keep the colour temperature warm — the light should feel like late afternoon, not a hospital — and keep as much of it as possible low, at or below eye level, where it flatters a room instead of interrogating it. And put everything you can on a dimmer, so a single room can be bright for a dinner and soft for a Sunday. Lighting isn’t one decision; it’s a set of them you get to make again every evening.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-home-goods-modern',
  key: 'sparx-retail-home-goods-modern',
  name: 'sparx — Home Goods (Modern Design)',
  theme: THEME,
  summary:
    'A complete, working shop for a design-led homeware brand: a real catalogue of a modern arc floor lamp, a sculptural vase, a graphic wool-blend rug, a lacquer tray, a modular steel-and-oak shelf, geometric cushions, a glass carafe set and a minimalist wall clock, with categories, collections, a bespoke PDP and a full merchandised home page. Crisp, architectural theme — a cool near-white ground, a near-black primary and an ochre accent. Shipped as Form & Field.',
  tagline: 'A crisp, modern storefront for a design-led homeware brand.',
  vertical: 'retail',
  industry: 'Home goods & homeware',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 85,
  brand: {
    businessName: 'Form & Field',
    tagline: 'Objects with a point of view.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Form & Field — design-led objects for a considered home',
      description:
        'Form & Field makes design-led homeware — lighting, textiles and tableware drawn with intent and built to last. Clean lines, honest materials, one bold colour at a time.',
    },
    about: {
      title: 'About Form & Field',
      description:
        'Why Form & Field makes a small, sharp catalogue of design-led objects — problem-first design, honest materials on show, and one confident colour where it counts.',
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
