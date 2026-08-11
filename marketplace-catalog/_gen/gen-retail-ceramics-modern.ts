// sparx-retail-ceramics-modern — a RETAIL/COMMERCE site template: a contemporary ceramics studio.
//
// The bright, design-forward counterpart to the warm gallery-calm Kiln & Clay. A complete,
// working shop the moment it installs — a real catalogue of contemporary tableware (a cylinder
// mug, stacking bowls, a plate set, a carafe & cup, a tumbler set, two sculptural vases, a
// planter and a full table set), categories + collections, a bespoke crisp-on-white PDP, the
// full 9-page commerce site (home merchandising → shop → collections → cart → search → journal →
// about → contact), dressed in an INLINE bespoke theme (a cool near-white ground, near-black ink,
// a single bold clay-coral accent, a geometric grotesk over a clean sans, sharp corners). Shipped
// as Form.
//
// SELF-CONTAINED BY DESIGN — like the coffee gold reference, this generator carries its OWN theme
// inline and passes it on the spec (`theme`), so the retail family can be authored in parallel
// without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-ceramics-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-ceramics-modern/**" \
//     "marketplace-catalog/_gen/gen-retail-ceramics-modern.ts"
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
// A bright, contemporary gallery-white: a cool near-white paper ground, near-black cool ink, a
// mono near-black primary (a solid graphic control), a single bold clay-coral accent, under a
// geometric grotesk display over a clean humanist sans, with sharp corners. Complete light + dark,
// AA on every role (the blueprint sweep's contrast check is the gate). `secondary` stays dark and
// legible on the light ground, and the accent sits at ~52% L so it reads as link/label TEXT.
const THEME = defineTheme({
  name: 'form-studio',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.125rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: ['oklch(98% 0.002 250)', 'oklch(95% 0.004 250)', 'oklch(90% 0.006 250)', 'oklch(22% 0.01 260)'],
    roles: {
      primary: 'oklch(24% 0.012 260)',
      secondary: 'oklch(45% 0.02 260)',
      accent: 'oklch(52% 0.16 32)',
      neutral: 'oklch(28% 0.012 260)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(20% 0.008 260)', 'oklch(16% 0.008 260)', 'oklch(13% 0.008 260)', 'oklch(96% 0.002 250)'],
    roles: {
      primary: 'oklch(93% 0.004 250)',
      secondary: 'oklch(74% 0.02 260)',
      accent: 'oklch(70% 0.15 34)',
      neutral: 'oklch(30% 0.01 260)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "form-hero": "https://images.unsplash.com/photo-1698935958560-2891be2d84c8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwY29udGVtcG9yYXJ5JTIwd2hpdGUlMjBjZXJhbWljJTIwdmVzc2VscyUyMGJyaWdodCUyMHN0dWRpb3xlbnwwfDB8fHwxNzg2NDA3NTkyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-tile-drink": "https://images.unsplash.com/photo-1525972757199-cf2ad7cc4f4b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWluaW1hbGlzdCUyMGN5bGluZGVyJTIwbXVnJTIwcGxhaW4lMjB3aGl0ZSUyMGdyb3VuZHxlbnwwfDB8fHwxNzg2NDA3NTk2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-tile-dine": "https://images.unsplash.com/photo-1551807306-4bcd16b92a41?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBtb2Rlcm4lMjBkaW5uZXIlMjBwbGF0ZXMlMjBzaG90JTIwd2hpdGV8ZW58MHwwfHx8MTc4NjQwNzU5OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-tile-vases": "https://images.unsplash.com/photo-1707225606124-047c630f343c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2N1bHB0dXJhbCUyMHZhc2UlMjBjYXRjaGluZyUyMGhhcmQlMjBzdHVkaW8lMjBsaWdodHxlbnwwfDB8fHwxNzg2NDA3NjAzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-tile-home": "https://images.unsplash.com/photo-1543963233-1b9b9d02e7a4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y3lsaW5kZXIlMjBwbGFudGVyJTIwc2luZ2xlJTIwYXJjaGl0ZWN0dXJhbCUyMHBsYW50fGVufDB8MHx8fDE3ODY0MDc2MDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-band-studio": "https://images.unsplash.com/photo-1729350793884-09e69ea2f2a8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwc3BhcmUlMjBjZXJhbWljcyUyMHN0dWRpbyUyMHdvcmslMjB3aGl0ZSUyMHNoZWx2ZXN8ZW58MHwwfHx8MTc4NjQwNzYxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-band-color": "https://images.unsplash.com/photo-1737053618295-d3980c8b9519?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhyZWUlMjBnbGF6ZWQlMjBwaWVjZXMlMjBsaW5lZCUyMHVwJTIwY2hhbGslMjBzbGF0ZXxlbnwwfDB8fHwxNzg2NDA3NjEzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-prod-mug": "https://images.unsplash.com/photo-1516390118834-21602d501886?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RyYWlnaHQtc2lkZWQlMjBjeWxpbmRlciUyMG11ZyUyMG1hdHRlJTIwZ2xhemV8ZW58MHwwfHx8MTc4NjQwNzYxNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-prod-bowls": "https://images.unsplash.com/photo-1572003414130-d1b4632a0d73?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwbmVzdGluZyUyMGJvd2xzJTIwc3RhY2tlZCUyMHdoaXRlfGVufDB8MHx8fDE3ODY0MDc2MjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-prod-plates": "https://images.unsplash.com/photo-1630527152680-500b5453fb04?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwY291cGUlMjBkaW5uZXIlMjBwbGF0ZXMlMjBzaG90JTIwYWJvdmV8ZW58MHwwfHx8MTc4NjQwNzYyM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-prod-carafe": "https://images.unsplash.com/photo-1570784332176-fdd73da66f03?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFsbCUyMGNhcmFmZSUyMG1hdGNoaW5nJTIwY3VwJTIwd2hpdGUlMjBzdXJmYWNlfGVufDB8MHx8fDE3ODY0MDc2MjZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-prod-tumblers": "https://images.unsplash.com/photo-1580485978255-49a246159b13?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwc3RyYWlnaHQtd2FsbGVkJTIwdHVtYmxlcnMlMjBzb2Z0JTIwZ2xhemV8ZW58MHwwfHx8MTc4NjQwNzYyOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-prod-vase-arc": "https://images.unsplash.com/photo-1600529782623-5d3cb98476c9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2N1bHB0dXJhbCUyMGFyYyUyMHZhc2V8ZW58MHwwfHx8MTc4NjQwODk4NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-prod-vase-column": "https://images.unsplash.com/photo-1603252712049-274984b09f48?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFsbCUyMGNvbHVtbiUyMHZhc2UlMjBuYXJyb3clMjBjeWxpbmRyaWNhbCUyMGJvZHl8ZW58MHwwfHx8MTc4NjQwNzYzNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-prod-planter": "https://images.unsplash.com/photo-1609745881196-bc2af0676777?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y3lsaW5kZXIlMjBwbGFudGVyJTIwY2xlYW4lMjB1bmdsYXplZCUyMHJpbXxlbnwwfDB8fHwxNzg2NDA3NjM4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-prod-table-set": "https://images.unsplash.com/photo-1619367302084-3d07eb49159f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZnVsbCUyMHRhYmxlJTIwc2V0JTIwcGxhdGVzJTIwYm93bHMlMjBtdWdzJTIwd2hpdGV8ZW58MHwwfHx8MTc4NjQwNzY0MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-post-use": "https://images.unsplash.com/photo-1759877258297-9589ddf5447b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9kZXJuJTIwbXVnJTIwZGFpbHklMjB1c2UlMjBicmlnaHQlMjBraXRjaGVuJTIwY291bnRlcnxlbnwwfDB8fHwxNzg2NDA3NjQ0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-post-color": "https://images.unsplash.com/photo-1543098052-46a1387df8f3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhemUlMjBzd2F0Y2hlcyUyMGNoYWxrJTIwc2xhdGUlMjBjb3JhbCUyMGxhaWQlMjBncmlkfGVufDB8MHx8fDE3ODY0MDc2NDh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "form-post-care": "https://images.unsplash.com/photo-1620568400263-6f1cf95b9e30?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2VyYW1pYyUyMHBsYXRlJTIwYmVpbmclMjBsaWZ0ZWQlMjBvcGVuJTIwZGlzaHdhc2hlcnxlbnwwfDB8fHwxNzg2NDA3NjUxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'form-hero', url: src('form-hero'), alt: 'A set of contemporary white ceramic vessels on a bright studio table' },
  { id: 'form-tile-drink', url: src('form-tile-drink'), alt: 'A minimalist cylinder mug on a plain white ground' },
  { id: 'form-tile-dine', url: src('form-tile-dine'), alt: 'A stack of modern dinner plates shot on white' },
  { id: 'form-tile-vases', url: src('form-tile-vases'), alt: 'A sculptural vase catching hard studio light' },
  { id: 'form-tile-home', url: src('form-tile-home'), alt: 'A cylinder planter with a single architectural plant' },
  { id: 'form-band-studio', url: src('form-band-studio'), alt: 'A bright, spare ceramics studio with work on white shelves' },
  { id: 'form-band-color', url: src('form-band-color'), alt: 'Three glazed pieces lined up in chalk, slate and coral' },
  { id: 'form-prod-mug', url: src('form-prod-mug'), alt: 'A straight-sided cylinder mug in a matte glaze' },
  { id: 'form-prod-bowls', url: src('form-prod-bowls'), alt: 'A set of nesting bowls stacked on white' },
  { id: 'form-prod-plates', url: src('form-prod-plates'), alt: 'A set of coupe dinner plates shot from above' },
  { id: 'form-prod-carafe', url: src('form-prod-carafe'), alt: 'A tall carafe with a matching cup on a white surface' },
  { id: 'form-prod-tumblers', url: src('form-prod-tumblers'), alt: 'A set of straight-walled tumblers in a soft glaze' },
  { id: 'form-prod-vase-arc', url: src('form-prod-vase-arc'), alt: 'A sculptural arc vase with a wide sweeping opening' },
  { id: 'form-prod-vase-column', url: src('form-prod-vase-column'), alt: 'A tall column vase with a narrow cylindrical body' },
  { id: 'form-prod-planter', url: src('form-prod-planter'), alt: 'A cylinder planter with a clean unglazed rim' },
  { id: 'form-prod-table-set', url: src('form-prod-table-set'), alt: 'A full table set of plates, bowls and mugs on white' },
  { id: 'form-post-use', url: src('form-post-use'), alt: 'A modern mug in daily use on a bright kitchen counter' },
  { id: 'form-post-color', url: src('form-post-color'), alt: 'Glaze swatches in chalk, slate and coral laid in a grid' },
  { id: 'form-post-care', url: src('form-post-care'), alt: 'A ceramic plate being lifted from an open dishwasher' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-ceramics-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one bright studio photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('form-hero'), alt: 'Contemporary white ceramics on a bright studio table', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-6xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl', {
                  text: 'Tableware, made to be used.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Form is a contemporary ceramics studio. We make clean, quietly modern pieces for the table and the shelf — thrown and cast in small runs, glazed in three colours, and built for the dishwasher and the everyday, not the cabinet.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the collection' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/blog/designed-to-be-used' },
                      text: 'Our approach',
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
      el('span', 'text-center text-base font-semibold uppercase tracking-widest text-base-content', { text: o.label }),
    ],
  });
}

function categoryTiles(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Browse the studio',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'form-tile-drink', label: 'Drinkware', href: '/shop', alt: 'A minimalist cylinder mug on white' }),
              categoryTile({ assetId: 'form-tile-dine', label: 'Dinnerware', href: '/shop', alt: 'A stack of modern dinner plates' }),
              categoryTile({ assetId: 'form-tile-vases', label: 'Vases', href: '/shop', alt: 'A sculptural vase in hard light' }),
              categoryTile({ assetId: 'form-tile-home', label: 'Home', href: '/shop', alt: 'A cylinder planter with a single plant' }),
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
    heading: 'Simple forms, made well',
    lead: 'We start with the shape and strip everything that isn’t doing a job — no fussy handles, no decoration for its own sake. A straight wall, a clean rim, a balanced foot. What’s left is a piece that looks considered on the shelf and disappears into the meal, which is exactly the point.',
    assetId: 'form-band-studio',
    cta: 'How we work',
    href: '/blog/designed-to-be-used',
    alt: 'A bright, spare ceramics studio',
  }),
  productsBlock({ source: 'commerce.category.dinnerware', layout: 'carousel', heading: 'For the table' }),
  editorialBand({
    heading: 'Three colours, chosen to mix',
    lead: 'Every piece comes in Chalk, Slate and Coral — a soft white, a cool grey and one bold warm accent. They’re made to be combined: a Chalk table with a single Coral bowl, a shelf of Slate with one thing that isn’t. Pick a lane, or don’t.',
    assetId: 'form-band-color',
    cta: 'About the glazes',
    href: '/blog/the-three-colours',
    alt: 'Three pieces lined up in chalk, slate and coral',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (studio label, title, price, low-stock,
 *  description, add-to-cart, a static "made in small runs" note, and policy links). */
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
                    text: 'Form',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Made in small runs' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Every piece is made in a small studio batch, so stock moves and the odd colour sells out for a firing or two. All of it is stoneware, fired hard and fully food-safe — microwave-safe, dishwasher-safe, and built for daily use, not the display cabinet.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Goes with' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-6xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl', {
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
    'Shop',
    'The whole studio, in one place — drinkware, dinnerware, vases and pieces for the home. Filter by category or colour; everything is stoneware, made in small runs and in three glazes made to be mixed.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The work grouped the way people actually shop — the new season, the everyday table, the drinkware edit, and pairs and sets that give well.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Form', 'Looking for a particular piece, a colour, or a note from the studio? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-6xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl', { text: 'Cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Everything is packed by hand for the post, so it arrives in one piece. Free shipping on orders over $150. If a piece ever turns up less than perfect, tell us and we’ll replace it — no argument.',
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
          el('h1', 'text-6xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl', { text: 'Journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the studio — how we think about form and use, what the three colours are and why they vary, and how to keep a piece looking good for years. Plain and useful, no design-world jargon.',
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
          el('h1', 'text-6xl font-bold tracking-tight text-base-content @2xl:text-7xl', { text: 'About Form' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Form is a contemporary ceramics studio making tableware for the way people actually live now — small kitchens, open shelves, meals eaten off the same few plates every day. We wanted pieces that were modern without being cold, and made well enough that you’d reach for them first.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We design every shape in-house and make it in small studio runs, throwing and slip-casting stoneware, glazing in our three house colours and firing it hard so it stands up to daily use. Nothing is decorative-only; if a piece can’t go in the dishwasher and the microwave, we don’t make it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The look is deliberate: clean walls, honest materials, one bold colour to break the quiet. We’d rather make a short list of things properly than a long catalogue of things you use twice. Buy one piece or a whole table — either way it’s made to last.',
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
          el('h1', 'text-6xl font-bold tracking-tight text-base-content @2xl:text-7xl', { text: 'Say hello' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'A question about a piece, a custom order for your restaurant or shop, or a wholesale enquiry? Tell us what you have in mind and one of us — the people who design and make the work — will write back.',
          }),
          el('a', 'btn btn-primary btn-lg', { attrs: { href: 'mailto:hello@formceramics.example' }, text: 'Email the studio' }),
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

// Colour is the natural per-piece choice — three house glazes, shown as swatches. Every piece
// ships in all three at one price, so the option adds real variants without a price matrix.
// (Chalk is the studio default.)
const COLOUR: OptionDecl = {
  name: 'Color',
  displayType: 'swatch',
  values: [{ value: 'Chalk' }, { value: 'Slate' }, { value: 'Coral' }],
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
  vendor: 'Form',
  tags: opts.tags,
  categoryHandles: opts.categories,
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [COLOUR],
  variants: [
    { sku: `${opts.sku}-CHK`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Chalk' } },
    { sku: `${opts.sku}-SLT`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Color: 'Slate' } },
    { sku: `${opts.sku}-COR`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Color: 'Coral' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.alt }],
});

const PRODUCTS: Product[] = [
  piece({
    handle: 'cylinder-mug',
    title: 'Cylinder Mug',
    description:
      'A straight-sided 11oz mug with a clean cut rim and a small, deliberate handle — no swoops, no taper, just the essential shape done right. Thrown with a slightly heavy base so it sits solid and holds the heat, and glazed matte on the outside, gloss in the well.',
    price: 34,
    sku: 'FORM-MUG',
    productType: 'Drinkware',
    categories: ['drinkware'],
    collections: ['new-season', 'best-sellers', 'everyday-table', 'drinkware-edit'],
    tags: ['mug', 'drinkware', 'stoneware', 'modern'],
    asset: 'form-prod-mug',
    alt: 'A straight-sided cylinder mug in a matte glaze',
    seoTitle: 'Cylinder Mug — modern stoneware | Form',
    seoDescription: 'A straight-sided 11oz mug with a clean rim and a small handle. Matte outside, gloss well. Three colours.',
  }),
  piece({
    handle: 'nesting-bowls',
    title: 'Nesting Bowl Set',
    description:
      'Three bowls in graduating sizes that stack down to one — a deep bowl for cereal and soup, a mid for a side, a small for dips and prep. Coupe-shaped with no rim to trap water, and sized so the set lives in a single cupboard space instead of three.',
    price: 96,
    sku: 'FORM-BOWLS',
    productType: 'Tableware',
    categories: ['dinnerware'],
    collections: ['new-season', 'best-sellers', 'everyday-table'],
    tags: ['bowls', 'set', 'tableware', 'stoneware'],
    asset: 'form-prod-bowls',
    alt: 'A set of nesting bowls stacked on white',
    seoTitle: 'Nesting Bowl Set — modern stoneware | Form',
    seoDescription: 'Three graduating coupe bowls that nest to one, for cereal, sides and prep. A set of three in three colours.',
  }),
  piece({
    handle: 'coupe-plates',
    title: 'Coupe Plate Set',
    description:
      'A set of four coupe dinner plates — no rim, a gentle rising wall, a wide flat centre that makes an ordinary plate of food look composed. Ten inches across and fully glazed edge to edge, so they stack quietly and wipe clean. The plate the rest of the table is built around.',
    price: 120,
    sku: 'FORM-PLATES',
    productType: 'Tableware',
    categories: ['dinnerware'],
    collections: ['everyday-table', 'entertaining'],
    tags: ['plates', 'set', 'tableware', 'stoneware'],
    asset: 'form-prod-plates',
    alt: 'A set of coupe dinner plates shot from above',
    seoTitle: 'Coupe Plate Set — modern stoneware | Form',
    seoDescription: 'Four rimless 10" coupe dinner plates, fully glazed and made to stack. A set of four in three house colours.',
  }),
  piece({
    handle: 'carafe-and-cup',
    title: 'Carafe & Cup',
    description:
      'A tall, slim carafe with a matching cup that sits over the neck as a lid — water by the bed, wine on the table, or a slow pour of coffee. Balanced to pour with one hand and drip-free at the lip, in a form spare enough to leave out on the counter and mean it.',
    price: 68,
    sku: 'FORM-CARAFE',
    productType: 'Drinkware',
    categories: ['drinkware'],
    collections: ['new-season', 'drinkware-edit', 'gift-ready'],
    tags: ['carafe', 'drinkware', 'set', 'stoneware'],
    asset: 'form-prod-carafe',
    alt: 'A tall carafe with a matching cup',
    seoTitle: 'Carafe & Cup — modern stoneware | Form',
    seoDescription: 'A slim bedside carafe with a matching cup lid, balanced to pour one-handed and drip-free. Three colours.',
  }),
  piece({
    handle: 'tumbler-set',
    title: 'Tumbler Set',
    description:
      'A set of four straight-walled tumblers, sized to sit under a coffee machine and to stack two-high in a cupboard. No handle, no foot — just a clean cylinder that works for water, juice, wine or a nightcap, and looks right whether it’s full or drying on the rack.',
    price: 56,
    sku: 'FORM-TUMBLERS',
    productType: 'Drinkware',
    categories: ['drinkware'],
    collections: ['best-sellers', 'drinkware-edit', 'gift-ready'],
    tags: ['tumblers', 'set', 'drinkware', 'stoneware'],
    asset: 'form-prod-tumblers',
    alt: 'A set of straight-walled tumblers in a soft glaze',
    seoTitle: 'Tumbler Set — modern stoneware | Form',
    seoDescription: 'Four straight-walled stoneware tumblers for water, wine or juice, made to stack. A set of four in three colours.',
  }),
  piece({
    handle: 'arc-vase',
    title: 'Arc Vase',
    description:
      'A sculptural vase with a wide, sweeping opening that reads almost like a section cut through a cylinder — a piece that holds a loose armful of stems or stands empty as an object. Weighted low so a top-heavy branch won’t tip it, and glazed matte to keep the shape, not the shine, in front.',
    price: 88,
    sku: 'FORM-VASE-ARC',
    productType: 'Vessel',
    categories: ['vases'],
    collections: ['new-season', 'gift-ready'],
    tags: ['vase', 'vessel', 'sculptural', 'decor'],
    asset: 'form-prod-vase-arc',
    alt: 'A sculptural arc vase with a wide opening',
    seoTitle: 'Arc Vase — sculptural stoneware | Form',
    seoDescription: 'A sculptural vase with a wide sweeping opening, weighted low for stems or shown empty. Matte, in three colours.',
  }),
  piece({
    handle: 'column-vase',
    title: 'Column Vase',
    description:
      'A tall, narrow column with a cut opening — for a single architectural stem, a few grasses, or nothing at all. The kind of quiet vertical an open shelf wants to break up a run of plates and bowls. Slip-cast for a crisp, even wall and finished with a bare, sanded rim.',
    price: 72,
    sku: 'FORM-VASE-COL',
    productType: 'Vessel',
    categories: ['vases'],
    collections: ['gift-ready'],
    tags: ['vase', 'vessel', 'sculptural', 'decor'],
    asset: 'form-prod-vase-column',
    alt: 'A tall column vase with a narrow body',
    seoTitle: 'Column Vase — sculptural stoneware | Form',
    seoDescription: 'A tall narrow column vase for a single stem or shown empty, with a crisp slip-cast wall. Three colours.',
  }),
  piece({
    handle: 'cylinder-planter',
    title: 'Cylinder Planter',
    description:
      'A clean cylinder planter with a bare unglazed rim and an inner pot with a drainage hole, dropped into a glazed outer that catches the overflow — so a plant lives happily without a saucer cluttering the shelf. Sized for a six-inch grower pot; a fern, a snake plant, a herb on the sill.',
    price: 62,
    sku: 'FORM-PLANTER',
    productType: 'Vessel',
    categories: ['home'],
    collections: ['new-season', 'home-edit', 'gift-ready'],
    tags: ['planter', 'home', 'plants', 'stoneware'],
    asset: 'form-prod-planter',
    alt: 'A cylinder planter with a clean unglazed rim',
    seoTitle: 'Cylinder Planter — modern stoneware | Form',
    seoDescription: 'A clean cylinder planter with a drop-in drainage pot and glazed outer, sized for a 6" grower. Three colours.',
  }),
  piece({
    handle: 'table-set',
    title: 'The Table Set',
    description:
      'The whole table for two, made to match — two coupe plates, two nesting bowls and two cylinder mugs, thrown and glazed in the same runs so their tones and weights actually agree, which pieces bought one at a time never quite do. The fastest way to a considered table, and the easiest gift we sell.',
    price: 280,
    sku: 'FORM-TABLESET',
    productType: 'Tableware',
    categories: ['dinnerware'],
    collections: ['everyday-table', 'entertaining', 'gift-ready'],
    tags: ['set', 'tableware', 'gift', 'stoneware'],
    asset: 'form-prod-table-set',
    alt: 'A full table set of plates, bowls and mugs on white',
    seoTitle: 'The Table Set — modern stoneware for two | Form',
    seoDescription: 'A six-piece table set for two — two plates, two bowls, two mugs, made in one run to match. In three colours.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'drinkware', name: 'Drinkware', description: 'Mugs, tumblers and carafes.', featured: true },
    { handle: 'dinnerware', name: 'Dinnerware', description: 'Plates, bowls and sets for the table.', featured: true },
    { handle: 'vases', name: 'Vases', description: 'Sculptural vessels for the shelf.', featured: true },
    { handle: 'home', name: 'Home', description: 'Planters and pieces beyond the table.', featured: true },
  ],
  collections: [
    {
      handle: 'new-season',
      name: 'New this season',
      description: 'The latest pieces from the studio.',
      type: 'manual',
      featured: true,
      productHandles: ['cylinder-mug', 'nesting-bowls', 'carafe-and-cup', 'arc-vase', 'cylinder-planter'],
    },
    {
      handle: 'everyday-table',
      name: 'The everyday table',
      description: 'Pieces made to be used every day.',
      type: 'manual',
      featured: true,
      productHandles: ['cylinder-mug', 'nesting-bowls', 'coupe-plates', 'table-set'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The pieces people come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['cylinder-mug', 'nesting-bowls', 'tumbler-set'],
    },
    {
      handle: 'drinkware-edit',
      name: 'The drinkware edit',
      description: 'Everything to drink from.',
      type: 'manual',
      featured: false,
      productHandles: ['cylinder-mug', 'tumbler-set', 'carafe-and-cup'],
    },
    {
      handle: 'entertaining',
      name: 'Entertaining',
      description: 'Plates and sets for a table full of people.',
      type: 'manual',
      featured: false,
      productHandles: ['coupe-plates', 'table-set'],
    },
    {
      handle: 'gift-ready',
      name: 'Gift-ready',
      description: 'Sets and single objects that give well.',
      type: 'manual',
      featured: false,
      productHandles: ['carafe-and-cup', 'tumbler-set', 'arc-vase', 'column-vase', 'cylinder-planter', 'table-set'],
    },
    {
      handle: 'home-edit',
      name: 'For the home',
      description: 'Planters and vessels beyond the table.',
      type: 'manual',
      featured: false,
      productHandles: ['cylinder-planter', 'arc-vase', 'column-vase'],
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
    slug: 'designed-to-be-used',
    status: 'published',
    body: {
      title: 'Designed to be used, not displayed',
      excerpt: 'A modern piece can be handsome and still earn its keep. Here’s how we decide what to make — and what we leave out.',
      featuredImage: { $asset: 'form-post-use' },
      body: {
        type: 'doc',
        content: [
          para('There’s a version of “design ceramics” that lives on a shelf, gets photographed, and never holds a meal. We’re not interested in that. Everything we make has to survive a normal week — the dishwasher, the microwave, a knock against the tap — or we don’t make it. Modern shouldn’t mean precious.'),
          h2('Start with the shape, remove the rest'),
          para('We design every piece by taking things away. Start with the job it has to do — hold coffee, stack in a cupboard, pour without dripping — and cut everything that isn’t serving it. The result is usually a straight wall, a clean rim and a foot that balances. It looks simple because the work went into deciding what not to add.'),
          h2('The everyday test'),
          para('Before a shape goes into production, we live with a prototype for a few weeks — actual mornings, actual dinners, actual washing-up. If a handle is a hair too small, if a bowl is a touch too deep to eat from comfortably, if a glaze scratches, it goes back. A piece only ships once it’s passed the most ordinary test there is: reaching for it first, again and again, without thinking about why.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'the-three-colours',
    status: 'published',
    body: {
      title: 'The three colours, and why they vary',
      excerpt: 'Chalk, Slate and Coral aren’t swatches — they’re glaze chemistry that meets fire. Here’s what to expect on your piece.',
      featuredImage: { $asset: 'form-post-color' },
      body: {
        type: 'doc',
        content: [
          para('We keep the palette deliberately short: one soft white, one cool grey, one warm accent. Three colours is enough to build a whole table and few enough that everything we make is guaranteed to mix. But a glaze isn’t paint — it’s a coat of minerals that only becomes its final colour in the heat of the kiln, and small things change how it lands.'),
          h2('Chalk, Slate, Coral'),
          para('Chalk is a soft, warm white — the studio default and the easiest to live with. Slate is a cool mid-grey that reads almost blue in daylight and grounds a shelf without going black. Coral is the one loud note: a warm, clay-red accent meant to be used sparingly — one bowl, one mug, the single thing on the shelf that isn’t quiet. All three are food-safe and dishwasher-safe.'),
          h2('Why yours won’t match the photo exactly'),
          para('Where a glaze pools thicker it fires deeper; where it thins over an edge it breaks lighter toward the clay. Its exact tone shifts with the thickness of the coat and the spot it sat in the kiln. We photograph a representative piece, but yours will be its own — a shade lighter here, a touch deeper there. On a contemporary form that variation isn’t a flaw to hide; it’s the quiet proof a person made it.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'caring-for-your-pieces',
    status: 'published',
    body: {
      title: 'Caring for your pieces',
      excerpt: 'Our stoneware is built for daily life, not a cabinet. A few simple habits keep it looking new for years.',
      featuredImage: { $asset: 'form-post-care' },
      body: {
        type: 'doc',
        content: [
          para('The best thing you can do with one of our pieces is use it hard. Everything is high-fired stoneware, fully vitrified, which makes it genuinely tough and completely everyday — not a fragile object you’re nervous around. A few small habits keep it at its best.'),
          h2('Dishwasher, microwave, everyday'),
          para('All of our glazed ware is dishwasher-safe and microwave-safe — no special treatment. If you hand-wash, a soft sponge is plenty; skip the scouring pad, which can dull a matte glaze over time. The only real rule is thermal shock: don’t move a piece straight from the freezer to a hot oven, and let a cold mug warm for a moment before boiling water goes in.'),
          h2('The bare rim and foot'),
          para('We leave a thin band of clay bare on the foot, and on some pieces the rim, so you can see and feel the material. Very occasionally a bare foot can leave a faint grey mark on a soft surface — a quick pass with fine sandpaper clears it, and we do that before anything ships. If yours ever needs it, a light sand and it’s gone.'),
          h2('If something chips'),
          para('Even tough stoneware can chip against a stone counter or a hard tap. A small chip on a rim is usually still perfectly safe to use, and plenty of people grow fond of the mark. If a piece ever fails in a way that isn’t fair wear, get in touch — we stand behind everything that leaves the studio.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-ceramics-modern',
  key: 'sparx-retail-ceramics-modern',
  name: 'sparx — Ceramics Studio (Modern)',
  theme: THEME,
  summary:
    'A complete, working shop for a contemporary ceramics studio: a real catalogue of modern tableware — a cylinder mug, nesting bowls, a coupe plate set, a carafe & cup, a tumbler set, two sculptural vases, a cylinder planter and a full table set, each in three house colours — with categories, collections, a crisp-on-white PDP and a fully merchandised home page. Bright cool-white theme, near-black ink and a single bold clay-coral accent, in a geometric grotesk with sharp corners. Shipped as Form.',
  tagline: 'A bright, design-forward storefront for a contemporary ceramics studio.',
  vertical: 'retail',
  industry: 'Ceramics studio',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 86,
  brand: {
    businessName: 'Form',
    tagline: 'Tableware, made to be used.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Form — contemporary ceramics, made to be used',
      description:
        'Form is a contemporary ceramics studio making clean, modern stoneware for the table and the home — mugs, bowls, plates, vases and planters, each made in small runs in three house colours.',
    },
    about: {
      title: 'About Form',
      description:
        'A contemporary ceramics studio: how Form designs and makes clean, modern stoneware in small runs — simple forms, three house colours, built for daily use, not the display cabinet.',
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
