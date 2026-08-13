// sparx-retail-home-goods — a RETAIL/COMMERCE site template: a considered homeware shop.
//
// A member of the retail family: a complete, working shop the moment it installs — a real
// catalogue of linen bedding, a wool throw, hand-thrown tableware, a table lamp, storage,
// scent and serving pieces, with categories + collections, a bespoke PDP and the full
// 9-page commerce site (home merchandising → shop → collections → cart → search → journal →
// about → contact). Dressed in an INLINE bespoke theme (warm linen ground, a grounded
// terracotta primary, a soft sage accent, a refined serif over a warm grotesk). Shipped as
// Hearth & Hollow.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme
// inline and passes it on the spec (`theme`), so the whole family can be authored in parallel
// without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-home-goods.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-home-goods/**" \
//     "marketplace-catalog/_gen/gen-retail-home-goods.ts"
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
// A warm home: a tinted linen ground, deep warm-brown ink, a grounded terracotta primary
// and a soft sage accent, under a refined serif display over a warm humanist sans. Complete
// light + dark, AA on every role (the blueprint sweep's contrast check is the gate). The
// `secondary` is a stone that stays dark and legible on the linen ground (it sets label
// text on the PDP), and the `accent` reads as a link on the light page.
const THEME = defineTheme({
  name: 'hearth-hollow',
  type: { body: face('Manrope', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: ['oklch(96% 0.018 78)', 'oklch(93% 0.024 74)', 'oklch(88% 0.03 70)', 'oklch(24% 0.028 60)'],
    roles: {
      primary: 'oklch(48% 0.11 42)',
      secondary: 'oklch(44% 0.028 65)',
      accent: 'oklch(48% 0.07 145)',
      neutral: 'oklch(28% 0.022 55)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(21% 0.02 55)', 'oklch(18% 0.02 55)', 'oklch(15% 0.02 55)', 'oklch(95% 0.014 78)'],
    roles: {
      primary: 'oklch(72% 0.1 42)',
      secondary: 'oklch(76% 0.03 65)',
      accent: 'oklch(74% 0.09 145)',
      neutral: 'oklch(32% 0.02 55)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "home-hero": "https://images.unsplash.com/photo-1600210491305-7396500b5b31?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3VubGl0JTIwYmVkcm9vbSUyMGRyZXNzZWQlMjBzdG9uZXdhc2hlZCUyMGxpbmVufGVufDB8MHx8fDE3ODY0MDM3MDh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-tile-bed": "https://images.unsplash.com/photo-1617325247661-675ab4b64ae2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGF5ZXJlZCUyMGxpbmVuJTIwYmVkZGluZyUyMHdhcm0lMjBuZXV0cmFsJTIwdG9uZXN8ZW58MHwwfHx8MTc4NjQwMzcxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-tile-table": "https://images.unsplash.com/photo-1655858415716-cd603a877840?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwdGFibGUlMjBoYW5kLXRocm93biUyMHN0b25ld2FyZXxlbnwwfDB8fHwxNzg2NDAzNzEzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-tile-living": "https://images.unsplash.com/photo-1733142182005-aceb7d85b354?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29vbCUyMHRocm93JTIwZm9sZGVkJTIwbGluZW4lMjBhcm1jaGFpcnxlbnwwfDB8fHwxNzg2NDAzNzE3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-tile-decor": "https://images.unsplash.com/photo-1716897276910-1f2dbcd11cf7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2VyYW1pYyUyMGxhbXAlMjByZWVkJTIwZGlmZnVzZXIlMjBzaGVsZnxlbnwwfDB8fHwxNzg2NDAzNzIwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-band-craft": "https://images.unsplash.com/photo-1595351298020-038700609878?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG90dGVyJTIwc2hhcGluZyUyMGJvd2wlMjB3aGVlbHxlbnwwfDB8fHwxNzg2NDAzNzIzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "home-band-care": "https://images.unsplash.com/photo-1604493225443-a8cc19434aec?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwbGluZW4lMjB3b29sJTIwc3RhY2tlZCUyMG9wZW4lMjBzaGVsZnxlbnwwfDB8fHwxNzg2NDAzNzI2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-linen-duvet": "https://images.unsplash.com/photo-1614226114676-8e02ac5f4763?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RvbmV3YXNoZWQlMjBsaW5lbiUyMGR1dmV0JTIwc2V0JTIwbWFkZSUyMGJlZHxlbnwwfDB8fHwxNzg2NDAzNzMwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-wool-throw": "https://images.unsplash.com/photo-1766727923658-ae4d4d837239?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FmZmxlLWtuaXQlMjBsYW1ic3dvb2wlMjB0aHJvd3xlbnwwfDB8fHwxNzg2NDAzNzMzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-dinner-set": "https://images.unsplash.com/photo-1614548539924-5c1f205b3747?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZC10aHJvd24lMjBzdG9uZXdhcmUlMjBkaW5uZXIlMjBzZXQlMjBmb3VyfGVufDB8MHx8fDE3ODY0MDM3MzZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-table-lamp": "https://images.unsplash.com/photo-1763478959023-8528a9d44a59?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2VyYW1pYyUyMGNvbHVtbiUyMHRhYmxlJTIwbGFtcCUyMGxpbmVuJTIwc2hhZGV8ZW58MHwwfHx8MTc4NjQwMzczOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-hand-towels": "https://images.unsplash.com/photo-1763485956366-8cca552c85c6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8cGFpciUyMHdhZmZsZS13ZWF2ZSUyMGhhbmQlMjB0b3dlbHN8ZW58MHwwfHx8MTc4NjQwMzc0Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-basket": "https://images.unsplash.com/photo-1578678809626-a3741782f0b8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d292ZW4lMjBzZWFncmFzcyUyMHN0b3JhZ2UlMjBiYXNrZXR8ZW58MHwwfHx8MTc4NjQwMzc0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-diffuser": "https://images.unsplash.com/photo-1629063908171-0e573f3cad89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhc3MlMjByZWVkJTIwZGlmZnVzZXIlMjBiZXNpZGUlMjBkcmllZCUyMHN0ZW1zfGVufDB8MHx8fDE3ODY0MDM3NDh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-serving-board": "https://images.unsplash.com/photo-1638726302611-0552991359a0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b2xpdmUlMjB3b29kJTIwc2VydmluZyUyMGJvYXJkJTIwYnJlYWQlMjBjaGVlc2V8ZW58MHwwfHx8MTc4NjQwMzc1MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-mugs": "https://images.unsplash.com/photo-1572003414077-38770ebec0a4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwc3BlY2tsZWQlMjBzdG9uZXdhcmUlMjBtdWdzfGVufDB8MHx8fDE3ODY0MDM3NTR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-linen": "https://images.unsplash.com/photo-1630347794192-22f1895bb934?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xvc2UtdXAlMjB3YXNoZWQlMjBsaW5lbiUyMHdlYXZlJTIwZGF5bGlnaHR8ZW58MHwwfHx8MTc4NjQwMzc2MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-styling": "https://images.unsplash.com/photo-1562050344-f7ad946cee35?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVsYXhlZCUyMHRhYmxlJTIwc2V0dGluZyUyMGxhaWQlMjBzbG93JTIwbHVuY2h8ZW58MHwwfHx8MTc4NjQwMzc2M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-care": "https://images.unsplash.com/photo-1670764732262-331943e5af5e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29vbCUyMGxpbmVuJTIwbGFpZCUyMG91dCUyMGFpci1kcnklMjBmbGF0fGVufDB8MHx8fDE3ODY0MDM3NjZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'home-hero', url: src('home-hero'), alt: 'A sunlit bedroom dressed in stonewashed linen' },
  { id: 'home-tile-bed', url: src('home-tile-bed'), alt: 'Layered linen bedding in warm neutral tones' },
  { id: 'home-tile-table', url: src('home-tile-table'), alt: 'A set table with hand-thrown stoneware' },
  { id: 'home-tile-living', url: src('home-tile-living'), alt: 'A wool throw folded over a linen armchair' },
  { id: 'home-tile-decor', url: src('home-tile-decor'), alt: 'A ceramic lamp and reed diffuser on a shelf' },
  { id: 'home-band-craft', url: src('home-band-craft'), alt: 'A potter shaping a bowl on the wheel' },
  { id: 'home-band-care', url: src('home-band-care'), alt: 'Folded linen and wool stacked on an open shelf' },
  { id: 'prod-linen-duvet', url: src('prod-linen-duvet'), alt: 'A stonewashed linen duvet set on a made bed' },
  { id: 'prod-wool-throw', url: src('prod-wool-throw'), alt: 'A waffle-knit lambswool throw' },
  { id: 'prod-dinner-set', url: src('prod-dinner-set'), alt: 'A hand-thrown stoneware dinner set for four' },
  { id: 'prod-table-lamp', url: src('prod-table-lamp'), alt: 'A ceramic column table lamp with a linen shade' },
  { id: 'prod-hand-towels', url: src('prod-hand-towels'), alt: 'A pair of waffle-weave hand towels' },
  { id: 'prod-basket', url: src('prod-basket'), alt: 'A woven seagrass storage basket' },
  { id: 'prod-diffuser', url: src('prod-diffuser'), alt: 'A glass reed diffuser beside dried stems' },
  { id: 'prod-serving-board', url: src('prod-serving-board'), alt: 'An olive wood serving board with bread and cheese' },
  { id: 'prod-mugs', url: src('prod-mugs'), alt: 'A set of speckled stoneware mugs' },
  { id: 'prod-cushion', url: src('prod-cushion'), alt: 'A bouclé cushion cover on a linen sofa' },
  { id: 'post-linen', url: src('post-linen'), alt: 'Close-up of washed linen weave in daylight' },
  { id: 'post-styling', url: src('post-styling'), alt: 'A relaxed table setting laid for a slow lunch' },
  { id: 'post-care', url: src('post-care'), alt: 'Wool and linen laid out to air-dry flat' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-home-goods: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm photograph, a serif headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('home-hero'), alt: 'A sunlit bedroom dressed in stonewashed linen', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Warm rooms, made to last.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Hearth & Hollow makes the honest, tactile pieces a home is actually built from — washed linen, hand-thrown stoneware, real wool. Chosen for how they feel and how they age, not for a season. Buy once, live with it for years.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the collection' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop' },
                      text: 'New this season',
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
            text: 'Shop by room',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'home-tile-bed', label: 'Bed & Bath', href: '/shop', alt: 'Layered linen bedding' }),
              categoryTile({ assetId: 'home-tile-table', label: 'Table', href: '/shop', alt: 'A set table with stoneware' }),
              categoryTile({ assetId: 'home-tile-living', label: 'Living', href: '/shop', alt: 'A wool throw on an armchair' }),
              categoryTile({ assetId: 'home-tile-decor', label: 'Decor', href: '/shop', alt: 'A ceramic lamp and diffuser' }),
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
    heading: 'Made by hand, made to keep',
    lead: 'Our stoneware is thrown on a wheel, our linen is washed until it goes soft, and our wool is spun from real fleece. We work with small makers who put their name to what they make — so the piece that arrives is one you’ll still want in ten years.',
    assetId: 'home-band-craft',
    cta: 'How it’s made',
    href: '/blog/why-we-wash-our-linen',
    alt: 'A potter shaping a bowl on the wheel',
  }),
  productsBlock({ source: 'commerce.category.table', layout: 'carousel', heading: 'Set a better table' }),
  editorialBand({
    heading: 'The things you keep',
    lead: 'A home isn’t furnished in a weekend — it’s gathered, one considered piece at a time. Start with the things you touch every day: the sheets you sleep in, the mug you reach for, the throw that lives on the sofa. Get those right and the rest follows.',
    assetId: 'home-band-care',
    cta: 'Shop living',
    href: '/shop',
    alt: 'Folded linen and wool on an open shelf',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static styling note, and policy links). */
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
                    text: 'Hearth & Hollow',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Made to live with' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Natural materials, made in small runs — so every piece has its own character, and no two are exactly alike. Cared for simply, they only get better with use. Free returns within 30 days if it isn’t right for your space.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Finish the room' });

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
    'The whole collection in one place — bedding, tableware, textiles, lighting, storage and scent. Filter by room or sort however you like; every piece is made in small runs from natural materials and built to be lived with.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The pieces grouped the way people actually shop — what’s new this season, the ones people keep coming back for, and edits for the bedroom, the table and the living room.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Hearth & Hollow', 'Looking for a colour, a material, or something for a particular room? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $95, carefully packed to arrive safely. Not quite right for your space? Send it back within 30 days — we want you to love it, not just keep it.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Hearth & Hollow journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the workshop and the home — where our materials come from, how to style them, and how to care for the pieces so they last. Plain, useful, no fuss.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Hearth & Hollow' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Hearth & Hollow began with a simple frustration: it was easy to buy homeware and hard to buy homeware worth keeping. So we started small — a run of washed linen, a batch of thrown mugs — with makers we’d met in person and materials we could stand behind.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We still work the same way. Everything we sell is made in small quantities from natural materials — real linen, real wool, real clay and wood — by workshops we know by name. We’d rather offer one honest version of a thing than a wall of nearly-the-same, and we’d rather it lasted a decade than a season.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No throwaway trends, no mystery materials, no pieces designed to be replaced next year. Just warm, tactile, well-made things for the rooms you actually live in — chosen to age well and be handed on.',
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
    intro: 'Questions about a material, help styling a room, or a trade and interiors enquiry? Tell us what you’re after and a real person here will get back to you — usually within a day.',
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

const VENDOR = 'Hearth & Hollow';

/** Unique short codes for a value list — grows the slice until each is distinct, so two
 *  values sharing a prefix (Clay / Chalk) never collide in a SKU. */
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

/** A piece offered in a dropdown of named choices, each with its own price (size, scent…). */
const choices = (
  b: Omit<Base, 'price'> & { optionName: string; values: { value: string; price: number }[] }
): Product => {
  const codes = uniqueCodes(b.values.map((v) => v.value));
  const variants: Variant[] = b.values.map((v, i) => ({
    sku: `${b.sku}-${codes[v.value]}`,
    priceCents: money(v.price),
    ...(i === 0 ? { isDefault: true as const } : {}),
    inventoryPolicy: 'continue' as const,
    optionValues: { [b.optionName]: v.value },
  }));
  const option: OptionDecl = { name: b.optionName, displayType: 'dropdown', values: b.values.map((v) => ({ value: v.value })) };
  return shell({ ...b, price: b.values[0].price }, [option], variants);
};

/** A single-variant piece — no options. */
const single = (b: Base): Product =>
  shell(b, undefined, [{ sku: b.sku, priceCents: money(b.price), isDefault: true, inventoryPolicy: 'continue' }]);

const PRODUCTS: Product[] = [
  colored({
    handle: 'stonewashed-linen-duvet-set',
    title: 'Stonewashed Linen Duvet Set',
    description:
      'A duvet cover and two pillowcases in pure French flax linen, washed until it’s soft the very first night — no breaking-in required. Breathable in summer, warm in winter, and it only gets better with every wash. The bed you look forward to.',
    price: 189,
    sku: 'HH-BED-LINEN',
    productType: 'Bedding',
    categories: ['bed-bath'],
    collections: ['new-arrivals', 'bedroom', 'best-sellers'],
    tags: ['linen', 'bedding', 'bedroom'],
    colors: ['Oatmeal', 'Clay', 'Fog', 'Sage'],
    asset: 'prod-linen-duvet',
    seoTitle: 'Stonewashed Linen Duvet Set — pure French flax | Hearth & Hollow',
    seoDescription: 'A soft-washed pure linen duvet set that’s cool in summer, warm in winter, and better with every wash.',
  }),
  colored({
    handle: 'lambswool-waffle-throw',
    title: 'Lambswool Waffle Throw',
    description:
      'A generously sized throw woven from pure lambswool in an open waffle weave — light to drape but genuinely warm, with a soft fringe at each end. The one that lives on the arm of the sofa and gets pulled over you by seven every evening.',
    price: 119,
    sku: 'HH-LIV-THROW',
    productType: 'Textiles',
    categories: ['living'],
    collections: ['new-arrivals', 'living-room', 'best-sellers'],
    tags: ['wool', 'throw', 'living-room'],
    colors: ['Heather Grey', 'Rust', 'Ecru'],
    asset: 'prod-wool-throw',
    seoTitle: 'Lambswool Waffle Throw — pure wool blanket | Hearth & Hollow',
    seoDescription: 'A light, warm waffle-weave throw in pure lambswool with a soft fringe. Made for the sofa.',
  }),
  colored({
    handle: 'hand-thrown-dinner-set',
    title: 'Hand-Thrown Dinner Set',
    description:
      'A four-place stoneware set — dinner plates, side plates and bowls — thrown by hand and finished in a soft reactive glaze, so no two pieces are exactly alike. Heavy in the right way, dishwasher-safe, and made to be used every day rather than saved for good.',
    price: 145,
    sku: 'HH-TAB-DINNER',
    productType: 'Tableware',
    categories: ['table'],
    collections: ['the-table', 'best-sellers'],
    tags: ['ceramic', 'stoneware', 'tableware', 'dinnerware'],
    colors: ['Oat', 'Ash'],
    optionName: 'Glaze',
    asset: 'prod-dinner-set',
    seoTitle: 'Hand-Thrown Stoneware Dinner Set for Four | Hearth & Hollow',
    seoDescription: 'A hand-thrown four-place stoneware dinner set in a soft reactive glaze. Everyday tableware, made by hand.',
  }),
  colored({
    handle: 'ceramic-column-table-lamp',
    title: 'Ceramic Column Table Lamp',
    description:
      'A substantial ceramic base turned in a single column and topped with a natural linen shade — the warm pool of light a room needs after dark. Fully wired with an in-line switch and rated for a standard bulb; the kind of lamp you move from house to house.',
    price: 165,
    sku: 'HH-LIV-LAMP',
    productType: 'Lighting',
    categories: ['living'],
    collections: ['living-room', 'new-arrivals'],
    tags: ['lighting', 'ceramic', 'lamp'],
    colors: ['Chalk', 'Clay'],
    asset: 'prod-table-lamp',
    seoTitle: 'Ceramic Column Table Lamp with Linen Shade | Hearth & Hollow',
    seoDescription: 'A turned ceramic column table lamp with a natural linen shade — warm, substantial light for any room.',
  }),
  colored({
    handle: 'waffle-hand-towels',
    title: 'Waffle Hand Towels (Set of 2)',
    description:
      'A pair of waffle-weave cotton hand towels that dry fast and only get more absorbent with washing — none of the heavy, damp thickness of ordinary towelling. Long enough to fold properly over a rail, and finished with a simple hanging loop.',
    price: 34,
    sku: 'HH-BAT-TOWEL',
    productType: 'Bath',
    categories: ['bed-bath'],
    collections: ['bedroom', 'gifting'],
    tags: ['cotton', 'bath', 'towels'],
    colors: ['White', 'Clay', 'Sage'],
    asset: 'prod-hand-towels',
    seoTitle: 'Waffle Hand Towels, Set of Two | Hearth & Hollow',
    seoDescription: 'Fast-drying waffle-weave cotton hand towels that grow softer and more absorbent with every wash.',
  }),
  choices({
    handle: 'seagrass-storage-basket',
    title: 'Seagrass Storage Basket',
    description:
      'A hand-woven seagrass basket with sturdy side handles — the good-looking answer to the pile of blankets, the kindling, the kids’ toys. Holds its shape, softens a room, and hides the clutter you don’t want on show. Choose the size for the job.',
    sku: 'HH-LIV-BASKET',
    productType: 'Storage',
    categories: ['living'],
    collections: ['living-room'],
    tags: ['storage', 'seagrass', 'basket', 'living-room'],
    optionName: 'Size',
    values: [
      { value: 'Small', price: 44 },
      { value: 'Large', price: 58 },
    ],
    asset: 'prod-basket',
    seoTitle: 'Hand-Woven Seagrass Storage Basket | Hearth & Hollow',
    seoDescription: 'A hand-woven seagrass storage basket with side handles, in two sizes — good-looking storage that hides the clutter.',
  }),
  choices({
    handle: 'reed-diffuser',
    title: 'Reed Diffuser',
    description:
      'A quiet, steady scent for a hallway or a bathroom — natural rattan reeds in a hand-blown glass bottle, no flame, no fuss. Each fill lasts around three months; flip the reeds when you want it stronger. A grown-up alternative to anything synthetic and sweet.',
    sku: 'HH-DEC-DIFFUSER',
    productType: 'Home Fragrance',
    categories: ['decor'],
    collections: ['gifting'],
    tags: ['fragrance', 'diffuser', 'scent', 'gift'],
    optionName: 'Scent',
    values: [
      { value: 'Fig & Cedar', price: 42 },
      { value: 'Wild Sage', price: 42 },
      { value: 'Warm Amber', price: 42 },
    ],
    asset: 'prod-diffuser',
    seoTitle: 'Reed Diffuser — natural home fragrance | Hearth & Hollow',
    seoDescription: 'A flame-free reed diffuser in hand-blown glass — a quiet, natural scent that lasts around three months.',
  }),
  single({
    handle: 'olive-wood-serving-board',
    title: 'Olive Wood Serving Board',
    description:
      'A single slab of olive wood, oiled and finished by hand, with the grain running wild the way only olive does — so every board is one of a kind. Big enough for a proper spread of bread and cheese, and handsome enough to leave out on the counter.',
    price: 68,
    sku: 'HH-TAB-BOARD',
    productType: 'Tableware',
    categories: ['table'],
    collections: ['the-table', 'gifting'],
    tags: ['wood', 'serving', 'board', 'gift'],
    asset: 'prod-serving-board',
    seoTitle: 'Olive Wood Serving Board — hand-finished | Hearth & Hollow',
    seoDescription: 'A one-of-a-kind hand-finished olive wood serving board for bread, cheese and everything in between.',
  }),
  colored({
    handle: 'speckled-stoneware-mugs',
    title: 'Speckled Stoneware Mugs (Set of 4)',
    description:
      'Four generously sized mugs in speckled stoneware, with a comfortable pull-handle and a matte-glazed body that keeps its warmth. The everyday cup you’ll reach for over any other — sturdy, stackable, and just as at home with morning coffee as evening tea.',
    price: 52,
    sku: 'HH-TAB-MUGS',
    productType: 'Tableware',
    categories: ['table'],
    collections: ['the-table', 'gifting', 'best-sellers'],
    tags: ['ceramic', 'stoneware', 'mugs', 'gift'],
    colors: ['Oat', 'Ash', 'Moss'],
    asset: 'prod-mugs',
    seoTitle: 'Speckled Stoneware Mugs, Set of Four | Hearth & Hollow',
    seoDescription: 'A set of four generously sized speckled stoneware mugs with a matte glaze and a comfortable handle.',
  }),
  colored({
    handle: 'boucle-cushion-cover',
    title: 'Bouclé Cushion Cover',
    description:
      'A deeply textured bouclé cushion cover with a hidden zip and a plump feather-blend feel — the quick way to warm up a sofa or dress a bed. Made to a generous 20-inch square; add one for texture, or a pair for a considered, put-together look.',
    price: 48,
    sku: 'HH-LIV-CUSHION',
    productType: 'Textiles',
    categories: ['living'],
    collections: ['living-room', 'new-arrivals'],
    tags: ['cushion', 'boucle', 'textiles', 'living-room'],
    colors: ['Ecru', 'Clay', 'Moss'],
    asset: 'prod-cushion',
    seoTitle: 'Bouclé Cushion Cover, 20-inch | Hearth & Hollow',
    seoDescription: 'A deeply textured 20-inch bouclé cushion cover with a hidden zip — the quick way to warm up a room.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'bed-bath', name: 'Bed & Bath', description: 'Bedding, towels and everything for a soft, restful room.', featured: true },
    { handle: 'table', name: 'Table', description: 'Hand-made tableware, serving pieces and everyday ceramics.', featured: true },
    { handle: 'living', name: 'Living', description: 'Throws, cushions, lighting and storage for the living room.', featured: true },
    { handle: 'decor', name: 'Decor', description: 'Scent and finishing pieces that make a house feel like home.', featured: true },
  ],
  collections: [
    {
      handle: 'new-arrivals',
      name: 'New this season',
      description: 'The latest pieces to land in the collection.',
      type: 'manual',
      featured: true,
      productHandles: ['stonewashed-linen-duvet-set', 'lambswool-waffle-throw', 'ceramic-column-table-lamp', 'boucle-cushion-cover'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The pieces people keep coming back for.',
      type: 'manual',
      featured: true,
      productHandles: ['stonewashed-linen-duvet-set', 'lambswool-waffle-throw', 'hand-thrown-dinner-set', 'speckled-stoneware-mugs'],
    },
    {
      handle: 'bedroom',
      name: 'The bedroom',
      description: 'Soft-washed linen and waffle cotton for a room you rest in.',
      type: 'manual',
      featured: false,
      productHandles: ['stonewashed-linen-duvet-set', 'waffle-hand-towels'],
    },
    {
      handle: 'the-table',
      name: 'The table',
      description: 'Hand-thrown ceramics and serving pieces for everyday meals.',
      type: 'manual',
      featured: false,
      productHandles: ['hand-thrown-dinner-set', 'olive-wood-serving-board', 'speckled-stoneware-mugs'],
    },
    {
      handle: 'living-room',
      name: 'The living room',
      description: 'Wool, texture, warm light and good-looking storage.',
      type: 'manual',
      featured: false,
      productHandles: ['lambswool-waffle-throw', 'ceramic-column-table-lamp', 'seagrass-storage-basket', 'boucle-cushion-cover'],
    },
    {
      handle: 'gifting',
      name: 'Gifts',
      description: 'Well-made pieces that are easy to give and better to keep.',
      type: 'manual',
      featured: false,
      productHandles: ['waffle-hand-towels', 'reed-diffuser', 'olive-wood-serving-board', 'speckled-stoneware-mugs'],
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
    slug: 'why-we-wash-our-linen',
    status: 'published',
    body: {
      title: 'Why we wash our linen',
      excerpt: 'New linen can feel stiff and look flat. Ours doesn’t — because we put it through a stone wash before it ever reaches you. Here’s what that does, and why it matters.',
      featuredImage: { $asset: 'post-linen' },
      body: {
        type: 'doc',
        content: [
          para('Linen is one of the oldest fabrics we still make, spun from the fibres of the flax plant. It’s naturally strong, breathable and temperature-regulating — cool against the skin in summer, insulating in winter. But new, unwashed linen has a reputation for being stiff and a little scratchy, and that reputation is fair. The softness people love takes time to arrive on its own.'),
          h2('What a stone wash actually does'),
          para('So we don’t make you wait. Before it’s cut and sewn, our linen is tumbled in a wash with natural stones, which breaks down the stiffness in the fibres and relaxes the weave. The result is fabric that’s soft and supple from the very first night — with the gently lived-in, slightly crumpled look that’s the whole point of linen, rather than a crisp hotel finish that fights you.'),
          h2('It only gets better'),
          para('Unlike synthetics, which degrade with washing, linen improves. Each trip through the machine relaxes it a little further, so the sheets you sleep in this year will be softer next year and softer still the year after. Treated simply — a warm wash, a low tumble or a line dry — a good linen set will outlast almost everything else in the cupboard. That’s why we start with the wash: it’s the difference between homeware you tolerate and homeware you love from day one.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'styling-a-table-you-will-use',
    status: 'published',
    body: {
      title: 'Styling a table you’ll actually use',
      excerpt: 'A beautiful table is no good if you’re afraid to eat off it. Here’s how we set one that looks considered and still works for a Tuesday night.',
      featuredImage: { $asset: 'post-styling' },
      body: {
        type: 'doc',
        content: [
          para('The best-looking tables aren’t the most matched ones. A table set entirely from a single boxed service can read as stiff — like a showroom rather than a home. The trick to a table that looks gathered and relaxed is to build it in layers, and to lean on pieces that are handsome enough to leave out and sturdy enough to use every day.'),
          h2('Start with the everyday pieces'),
          para('Begin with your hard-working ceramics — the dinner plates and bowls you reach for without thinking. Hand-thrown stoneware in a soft, reactive glaze does a lot of the work here, because the small variations from piece to piece give a table warmth that a flawless, machine-made set never will. Keep the palette calm — oat, ash, clay — and let the food bring the colour.'),
          h2('Layer in texture, not clutter'),
          para('From there, add texture rather than more objects: a washed-linen runner instead of a full cloth, a wooden board down the middle for bread or cheese, a couple of speckled mugs already out. Skip the tightly-folded napkins and the centrepiece that blocks the conversation. The aim isn’t a photograph — it’s a table that looks like people are about to sit down and enjoy themselves, because they are.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'caring-for-wool-and-linen',
    status: 'published',
    body: {
      title: 'Caring for wool and linen',
      excerpt: 'Natural materials are far easier to look after than people fear — and cared for simply, they’ll outlast anything synthetic. A short, honest guide.',
      featuredImage: { $asset: 'post-care' },
      body: {
        type: 'doc',
        content: [
          para('There’s a myth that natural materials are precious and high-maintenance. In our experience it’s the opposite: wool and linen are forgiving, self-cleaning to a degree, and built to last decades if you treat them kindly. The main thing is to be gentle with heat and honest about how little they actually need.'),
          h2('Wool likes air more than water'),
          para('Wool naturally resists dirt and odour, so a throw or a cushion rarely needs washing — a good airing outside will freshen it more effectively than a machine. When something does need cleaning, use a cool, gentle wool cycle or hand wash, never hot water, and always dry flat rather than hanging, so the weight of the water doesn’t stretch it out of shape. Never wring it; press the water out instead.'),
          h2('Linen just gets softer'),
          para('Linen is even simpler. Wash it warm rather than hot, with a mild detergent and no fabric softener — softener coats the fibres and stops them breathing, which is the whole reason you bought linen. A low tumble leaves it with that relaxed, lived-in look; a line dry is gentler still. Skip the ironing unless you like it crisp. Do that much and both will reward you for years — which, after all, is the point of buying them once and buying them well.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-home-goods',
  key: 'sparx-retail-home-goods',
  name: 'sparx — Home Goods (Homeware)',
  theme: THEME,
  summary:
    'A complete, working shop for a considered homeware brand: a real catalogue of washed linen bedding, a wool throw, hand-thrown tableware, lighting, storage, scent and serving pieces, with categories, collections, a bespoke homeware PDP and a full merchandised home page. Warm, tactile theme — a linen ground, a grounded terracotta primary and a soft sage accent. Shipped as Hearth & Hollow.',
  tagline: 'A warm, working storefront for a considered homeware brand.',
  vertical: 'retail',
  industry: 'Home goods & homeware',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 86,
  brand: {
    businessName: 'Hearth & Hollow',
    tagline: 'Things you’ll keep for years.',
  },
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Hearth & Hollow — considered homeware, made to last',
      description:
        'Hearth & Hollow makes warm, tactile homeware from natural materials — washed linen, hand-thrown ceramics, real wool — in small runs, built to be lived with for years.',
    },
    about: {
      title: 'About Hearth & Hollow',
      description:
        'Why Hearth & Hollow makes homeware the slow way — small runs, natural materials, makers we know by name, and pieces designed to age well and be handed on.',
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
