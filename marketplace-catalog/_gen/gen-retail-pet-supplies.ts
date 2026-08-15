// sparx-retail-pet-supplies — a RETAIL/COMMERCE site template: a premium modern pet shop.
//
// A member of the retail family: a complete, working shop the moment it installs — a real
// catalogue of a leather collar and matching lead, an adventure harness, an orthopedic dog
// bed, a ceramic bowl, natural treats, a rope toy, a travel bottle, a grooming brush and a
// flexible subscription box, with categories + collections, a bespoke PDP and the full 9-page
// commerce site (home merchandising → shop → collections → cart → search → journal → about →
// contact). Dressed in an INLINE bespoke theme (warm cream ground, a deep teal primary, a warm
// coral accent, a friendly rounded serif over a rounded humanist sans). Shipped as Barkwell.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme
// inline and passes it on the spec (`theme`), so the whole family can be authored in parallel
// without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-pet-supplies.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-pet-supplies/**" \
//     "marketplace-catalog/_gen/gen-retail-pet-supplies.ts"
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
// A friendly-but-premium pet shop: a warm cream ground, deep warm-brown ink, a grounded
// deep-teal primary and a warm coral accent, under a soft serif display over a rounded
// humanist sans. Complete light + dark, AA on every role (the blueprint sweep's contrast
// check is the gate). The `secondary` is a warm stone that stays dark and legible on the cream
// ground (it sets label text on the PDP), and the `accent` clears contrast as a link on the
// light page (kept at ~52% L). Rounded shape language throughout — warm, approachable, modern.
const THEME = defineTheme({
  name: 'paws-modern',
  type: { body: face('Nunito', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '1.5rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: ['oklch(97% 0.018 85)', 'oklch(94% 0.024 82)', 'oklch(89% 0.03 78)', 'oklch(24% 0.03 60)'],
    roles: {
      primary: 'oklch(46% 0.09 195)',
      secondary: 'oklch(42% 0.03 65)',
      accent: 'oklch(52% 0.16 30)',
      neutral: 'oklch(27% 0.022 60)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(21% 0.02 210)', 'oklch(18% 0.02 210)', 'oklch(15% 0.02 210)', 'oklch(95% 0.014 85)'],
    roles: {
      primary: 'oklch(74% 0.1 195)',
      secondary: 'oklch(76% 0.03 65)',
      accent: 'oklch(74% 0.15 32)',
      neutral: 'oklch(32% 0.02 210)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "paw-hero": "https://images.unsplash.com/photo-1522276498395-f4f68f7f8454?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFwcHklMjBkb2clMjByZXN0aW5nJTIwaGVhZCUyMG93bmVyJTIwcyUyMGxhcHxlbnwwfDB8fHwxNzg2NDA0ODk5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paw-tile-rest": "https://images.unsplash.com/photo-1632232586075-be6dca5b26f7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwY3VybGVkJTIwYXNsZWVwJTIwcGx1c2glMjBvcnRob3BlZGljJTIwYmVkfGVufDB8MHx8fDE3ODY0MDQ5MDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paw-tile-play": "https://images.unsplash.com/photo-1624609602652-b8ca6234bace?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwbWlkLWxlYXAlMjBjYXRjaGluZyUyMHJvcGUlMjB0b3klMjBwYXJrfGVufDB8MHx8fDE3ODY0MDQ5MDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paw-tile-eat": "https://images.unsplash.com/photo-1632236568054-12f36ecee2f6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8ZG9nJTIwZWF0aW5nJTIwY2VyYW1pY3xlbnwwfDB8fHwxNzg2NDA1MTY4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paw-band-made": "https://images.unsplash.com/photo-1667716705760-233650f8f3fe?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFrZXIlMjBoYW5kLXN0aXRjaGluZyUyMGxlYXRoZXIlMjBkb2clMjBjb2xsYXIlMjB3b3JrYmVuY2h8ZW58MHwwfHx8MTc4NjQwNDkxM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paw-band-sub": "https://images.unsplash.com/photo-1617909517211-c4e4275bf5b6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3Vic2NyaXB0aW9uJTIwYm94JTIwcGV0JTIwc3VwcGxpZXMlMjBvcGVuZWQlMjBkb29yc3RlcHxlbnwwfDB8fHwxNzg2NDA0OTE1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-collar": "https://images.unsplash.com/photo-1546687813-3fcc1c363a07?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8dGFuJTIwZnVsbC1ncmFpbiUyMGxlYXRoZXIlMjBkb2clMjBjb2xsYXIlMjBicmFzcyUyMGJ1Y2tsZXxlbnwwfDB8fHwxNzg2NDA0OTE5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-lead": "https://images.unsplash.com/photo-1678875339396-7cbb39db7728?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWF0Y2hpbmclMjBmdWxsLWdyYWluJTIwbGVhdGhlciUyMGRvZyUyMGxlYWQlMjBjb2lsZWQlMjB0YWJsZXxlbnwwfDB8fHwxNzg2NDA0OTIyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-harness": "https://images.unsplash.com/photo-1617798087284-9d08c435414e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFkZGVkJTIwYWR2ZW50dXJlJTIwaGFybmVzcyUyMGRvZyUyMG91dGRvb3JzfGVufDB8MHx8fDE3ODY0MDQ5MjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-bed": "https://images.unsplash.com/photo-1779247751222-34671afa1be5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGx1c2glMjBvcnRob3BlZGljJTIwZG9nJTIwYmVkJTIwYm9sc3RlciUyMGVkZ2V8ZW58MHwwfHx8MTc4NjQwNDkyOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-bowl": "https://images.unsplash.com/photo-1551975173-0493fae765d2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZC1nbGF6ZWQlMjBjZXJhbWljJTIwcGV0JTIwYm93bCUyMHdhcm0lMjBzcGVja2xlZCUyMGZpbmlzaHxlbnwwfDB8fHwxNzg2NDA0OTMxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-treats": "https://images.unsplash.com/photo-1571873735645-1ae72b963024?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVzZWFsYWJsZSUyMHBvdWNoJTIwc2xvdy1yb2FzdGVkJTIwbmF0dXJhbCUyMGRvZyUyMHRyZWF0c3xlbnwwfDB8fHwxNzg2NDA0OTM1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-toy": "https://images.unsplash.com/photo-1695390966755-117fddeb006e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Y2h1bmt5JTIwY290dG9uJTIwcm9wZSUyMHR1ZyUyMHRveXxlbnwwfDB8fHwxNzg2NDA0OTM4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-bottle": "https://images.unsplash.com/photo-1598410924570-6e37b6c54fe6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhaW5sZXNzJTIwc3RlZWwlMjB0cmF2ZWwlMjB3YXRlciUyMGJvdHRsZSUyMGZvbGQtb3V0JTIwYm93bHxlbnwwfDB8fHwxNzg2NDA0OTQxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-brush": "https://images.unsplash.com/photo-1635094420131-0337a3e732fc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFtYm9vLWhhbmRsZWQlMjBncm9vbWluZyUyMGJydXNoJTIwc29mdCUyMHBpbnN8ZW58MHwwfHx8MTc4NjQwNDk0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-training": "https://images.unsplash.com/photo-1760615303386-d025db9d6ae2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmV3JTIwcHVwcHklMjBzZXR0bGluZyUyMG9udG8lMjBiZWQlMjBjYWxtJTIwaG9tZXxlbnwwfDB8fHwxNzg2NDA0OTUwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-nutrition": "https://images.unsplash.com/photo-1714068691210-073dc52c6c1d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2VyYW1pYyUyMGJvd2wlMjBmcmVzaCUyMHdob2xlLWZvb2QlMjBkb2clMjBkaW5uZXJ8ZW58MHwwfHx8MTc4NjQwNDk1NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-care": "https://images.unsplash.com/photo-1627471694823-d337d099138b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwYmVpbmclMjBnZW50bHklMjBicnVzaGVkJTIwc3VubGl0JTIwZmxvb3J8ZW58MHwwfHx8MTc4NjQwNDk1N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'paw-hero', url: src('paw-hero'), alt: 'A happy dog resting its head on an owner’s lap in warm morning light' },
  { id: 'paw-tile-walk', url: src('paw-tile-walk'), alt: 'A dog on a leather lead mid-walk on a leafy street' },
  { id: 'paw-tile-rest', url: src('paw-tile-rest'), alt: 'A dog curled asleep in a plush orthopedic bed' },
  { id: 'paw-tile-play', url: src('paw-tile-play'), alt: 'A dog mid-leap catching a rope toy in a park' },
  { id: 'paw-tile-eat', url: src('paw-tile-eat'), alt: 'A dog eating from a ceramic bowl on a kitchen floor' },
  { id: 'paw-band-made', url: src('paw-band-made'), alt: 'A maker hand-stitching a leather dog collar at a workbench' },
  { id: 'paw-band-sub', url: src('paw-band-sub'), alt: 'A subscription box of pet supplies opened on a doorstep' },
  { id: 'prod-collar', url: src('prod-collar'), alt: 'A tan full-grain leather dog collar with a brass buckle' },
  { id: 'prod-lead', url: src('prod-lead'), alt: 'A matching full-grain leather dog lead coiled on a table' },
  { id: 'prod-harness', url: src('prod-harness'), alt: 'A padded adventure harness on a dog outdoors' },
  { id: 'prod-bed', url: src('prod-bed'), alt: 'A plush orthopedic dog bed with a bolster edge' },
  { id: 'prod-bowl', url: src('prod-bowl'), alt: 'A hand-glazed ceramic pet bowl in a warm speckled finish' },
  { id: 'prod-treats', url: src('prod-treats'), alt: 'A resealable pouch of slow-roasted natural dog treats' },
  { id: 'prod-toy', url: src('prod-toy'), alt: 'A chunky cotton rope tug toy' },
  { id: 'prod-bottle', url: src('prod-bottle'), alt: 'A stainless steel travel water bottle with a fold-out bowl' },
  { id: 'prod-brush', url: src('prod-brush'), alt: 'A bamboo-handled grooming brush with soft pins' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A Barkwell subscription box packed with treats and toys' },
  { id: 'post-training', url: src('post-training'), alt: 'A new puppy settling onto a bed in a calm home' },
  { id: 'post-nutrition', url: src('post-nutrition'), alt: 'A ceramic bowl of fresh, whole-food dog dinner' },
  { id: 'post-care', url: src('post-care'), alt: 'A dog being gently brushed on a sunlit floor' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-pet-supplies: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm photograph, a serif headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('paw-hero'), alt: 'A happy dog resting its head on an owner’s lap', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'The good stuff your pet actually deserves.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Barkwell makes the everyday things your dog uses most — collars, beds, bowls, treats — from natural materials, built by hand, and vet-approved. No plastic tat, no mystery ingredients. Just gear that lasts and food you’d be happy to read the label of.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop everything' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop/subscription' },
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
            text: 'Shop by what they do',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'paw-tile-walk', label: 'Walk', href: '/shop', alt: 'A dog on a leather lead mid-walk' }),
              categoryTile({ assetId: 'paw-tile-rest', label: 'Rest', href: '/shop', alt: 'A dog asleep in a plush bed' }),
              categoryTile({ assetId: 'paw-tile-play', label: 'Play', href: '/shop', alt: 'A dog leaping for a rope toy' }),
              categoryTile({ assetId: 'paw-tile-eat', label: 'Eat', href: '/shop', alt: 'A dog eating from a ceramic bowl' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New at Barkwell' }),
  editorialBand({
    heading: 'Made by hand, made to last',
    lead: 'Our leather is full-grain and stitched by a real saddler; our beds are filled with orthopedic foam, not off-cuts; our treats are single-ingredient and slow-roasted. We’d rather sell one honest version of a thing your dog will use for years than a shelf of nearly-the-same.',
    assetId: 'paw-band-made',
    cta: 'How it’s made',
    href: '/blog/what-belongs-in-your-dogs-bowl',
    alt: 'A maker hand-stitching a leather collar',
  }),
  productsBlock({ source: 'commerce.category.rest', layout: 'carousel', heading: 'Somewhere to sleep' }),
  editorialBand({
    heading: 'The box that turns up before you run out',
    lead: 'A subscription is the easy way to never scramble for treats or poop bags again: pick what your dog loves, pick how often, and a freshly packed box arrives on your schedule. Skip, swap or cancel any time — no lock-in, ever.',
    assetId: 'paw-band-sub',
    cta: 'Start a subscription',
    href: '/shop/subscription',
    alt: 'A subscription box opened on a doorstep',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static reassurance note, and policy links). */
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
                    text: 'Barkwell',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'The Barkwell promise' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Natural materials, vet-approved and made to last. Free shipping over $49, and a 30-day happy-tails guarantee — if it isn’t right for your dog, send it back for a full refund, no questions asked.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Your dog might also like' });

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
    'The whole range in one place — collars and leads, beds, bowls, treats, toys and travel gear. Filter by what your dog needs or sort however you like; everything is made from natural materials, vet-approved, and built to be used every single day.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The range grouped the way people actually shop — what’s new, the ones dogs come back for, the daily-walk essentials, the sleep gear, and boxes that make an easy gift.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Barkwell', 'Looking for a size, a colour, or a bit of advice? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $49, packed with care and sent within a day. Not quite right for your dog? Send it back within 30 days for a full refund — our happy-tails guarantee means the risk is on us, not you.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Barkwell journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Straight-talking help from people who live with dogs — settling a new pup, what actually belongs in the bowl, and keeping a coat healthy in five minutes a week. Plain, useful, no jargon.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Barkwell' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Barkwell started with a rescue mutt named Biscuit and a frustration every dog owner knows: the collar that frayed in a month, the bed that flattened by winter, the treats with a label you couldn’t pronounce. We figured the everyday things a dog uses most deserved to be made properly — so we set out to make them that way.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Everything we sell is made from natural, hard-wearing materials — full-grain leather, orthopedic foam, food-safe ceramic, single-ingredient food — by small workshops we know by name, and checked over by the vets we trust. We’d rather offer one honest version of a thing than a wall of cheap plastic, and we’d rather it lasted years than a season.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No mystery ingredients, no throwaway gear, no marketing dressed up as care. Just well-made things for the animal who’s genuinely pleased to see you every single day — and a share of every order goes to the shelters that help dogs like Biscuit find their people.',
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
    intro: 'Not sure which size collar fits, need a hand choosing a bed, or want to talk about stocking Barkwell in your shop? Tell us about your dog and a real person here — usually with a dog at their feet — will get back to you within a day.',
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

const VENDOR = 'Barkwell';

/** Unique short codes for a value list — grows the slice until each is distinct, so two
 *  values sharing a prefix (Charcoal / Chestnut) never collide in a SKU. */
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

/** A piece offered in a dropdown of named choices, each with its own price (size, flavour…). */
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

/** A piece offered across a Size × Colour lattice — the cartesian product of both option
 *  lists at a flat price (a collar, a harness). Every variant sets BOTH options, exactly one
 *  is default, and the SKU pins the size + colour codes so no two combinations collide. The
 *  blueprint validator requires each variant to name every option, so both keys are always
 *  present. */
const sizeColor = (
  b: Base & { sizes: string[]; colors: string[]; sizeOption?: string; colorOption?: string }
): Product => {
  const sizeName = b.sizeOption ?? 'Size';
  const colorName = b.colorOption ?? 'Colour';
  const sizeCodes = uniqueCodes(b.sizes);
  const colorCodes = uniqueCodes(b.colors);
  const variants: Variant[] = [];
  let first = true;
  for (const s of b.sizes) {
    for (const c of b.colors) {
      variants.push({
        sku: `${b.sku}-${sizeCodes[s]}-${colorCodes[c]}`,
        priceCents: money(b.price),
        ...(first ? { isDefault: true as const } : {}),
        inventoryPolicy: 'continue' as const,
        optionValues: { [sizeName]: s, [colorName]: c },
      });
      first = false;
    }
  }
  const options: OptionDecl[] = [
    { name: sizeName, displayType: 'dropdown', values: b.sizes.map((value) => ({ value })) },
    { name: colorName, displayType: 'swatch', values: b.colors.map((value) => ({ value })) },
  ];
  return shell(b, options, variants);
};

/** A single-variant piece — no options. */
const single = (b: Base): Product =>
  shell(b, undefined, [{ sku: b.sku, priceCents: money(b.price), isDefault: true, inventoryPolicy: 'continue' }]);

const PRODUCTS: Product[] = [
  sizeColor({
    handle: 'heritage-leather-collar',
    title: 'Heritage Leather Collar',
    description:
      'A collar cut from a single strip of full-grain leather and stitched by a real saddler, with a solid brass buckle and D-ring that won’t bend or rust. It softens as it wears and picks up the character of every walk — the one collar you buy once and never think about again. Measure your dog’s neck and pick the size below.',
    price: 38,
    sku: 'BARK-COL-LEATHER',
    productType: 'Collar',
    categories: ['walk'],
    collections: ['new-arrivals', 'the-daily-walk', 'best-sellers'],
    tags: ['collar', 'leather', 'walk'],
    sizes: ['Small', 'Medium', 'Large'],
    colors: ['Tan', 'Chestnut', 'Black'],
    asset: 'prod-collar',
    seoTitle: 'Heritage Leather Dog Collar — full-grain, brass hardware | Barkwell',
    seoDescription: 'A hand-stitched full-grain leather collar with solid brass hardware, in three sizes and three colours. Buy once, wear it for years.',
  }),
  colored({
    handle: 'heritage-leather-lead',
    title: 'Heritage Leather Lead',
    description:
      'The lead made to match the collar — the same full-grain leather and solid brass trigger clip, in a comfortable five-foot length that sits soft in the hand from the first walk. No plastic, no fraying nylon; just a lead that ages beautifully and outlasts the dog’s puppyhood many times over.',
    price: 44,
    sku: 'BARK-LEAD-LEATHER',
    productType: 'Lead',
    categories: ['walk'],
    collections: ['the-daily-walk', 'best-sellers'],
    tags: ['lead', 'leash', 'leather', 'walk'],
    colors: ['Tan', 'Chestnut', 'Black'],
    asset: 'prod-lead',
    seoTitle: 'Heritage Leather Dog Lead — full-grain, 5ft | Barkwell',
    seoDescription: 'A five-foot full-grain leather lead with a solid brass trigger clip, made to match the Heritage collar. Soft in the hand, built to last.',
  }),
  sizeColor({
    handle: 'adventure-harness',
    title: 'Adventure Harness',
    description:
      'A padded, no-pull harness for dogs who treat every walk like an expedition — breathable mesh, a chest ring to ease pulling, a back handle for helping over stiles, and reflective trim for dark mornings. Four points of adjustment mean it actually fits, and the whole thing wipes clean after the muddiest field.',
    price: 52,
    sku: 'BARK-HARN-ADV',
    productType: 'Harness',
    categories: ['walk'],
    collections: ['new-arrivals', 'the-daily-walk'],
    tags: ['harness', 'no-pull', 'walk'],
    sizes: ['Small', 'Medium', 'Large'],
    colors: ['Forest', 'Slate', 'Coral'],
    asset: 'prod-harness',
    seoTitle: 'Adventure No-Pull Dog Harness — padded, reflective | Barkwell',
    seoDescription: 'A padded no-pull harness with a chest ring, back handle and reflective trim, in three sizes and three colours. Built for real walks.',
  }),
  choices({
    handle: 'orthopedic-dog-bed',
    title: 'Orthopedic Dog Bed',
    description:
      'A proper bed for a proper sleep — a solid slab of orthopedic memory foam, not shredded off-cuts, topped with a bolster edge for chin-resting and a cover that unzips and machine-washes in one go. It supports ageing joints, holds its shape for years, and gives even a young dog the deep rest they need. Pick the size for your dog below.',
    sku: 'BARK-BED-ORTHO',
    productType: 'Bed',
    categories: ['rest'],
    collections: ['new-arrivals', 'rest-easy', 'best-sellers'],
    tags: ['bed', 'orthopedic', 'rest', 'sleep'],
    optionName: 'Size',
    values: [
      { value: 'Small', price: 89 },
      { value: 'Medium', price: 129 },
      { value: 'Large', price: 169 },
    ],
    asset: 'prod-bed',
    seoTitle: 'Orthopedic Memory-Foam Dog Bed — washable | Barkwell',
    seoDescription: 'A solid orthopedic memory-foam dog bed with a bolster edge and a fully machine-washable cover, in three sizes. Real support for real sleep.',
  }),
  colored({
    handle: 'everyday-ceramic-bowl',
    title: 'Everyday Ceramic Bowl',
    description:
      'A hand-glazed stoneware bowl with real heft, a non-slip base and a food-safe finish that won’t harbour the bacteria plastic and steel bowls trap in their scratches. Weighted enough that an enthusiastic eater can’t skate it across the kitchen, dishwasher-safe, and handsome enough to leave out. Sold singly — pair one for water, one for food.',
    price: 26,
    sku: 'BARK-BOWL-CERAMIC',
    productType: 'Bowl',
    categories: ['eat'],
    collections: ['rest-easy', 'gifting'],
    tags: ['bowl', 'ceramic', 'eat', 'feeding'],
    colors: ['Speckled Cream', 'Sage', 'Clay'],
    asset: 'prod-bowl',
    seoTitle: 'Hand-Glazed Ceramic Dog Bowl — non-slip, food-safe | Barkwell',
    seoDescription: 'A weighted hand-glazed stoneware dog bowl with a non-slip base and a food-safe finish, in three colours. Dishwasher-safe and built to stay put.',
  }),
  choices({
    handle: 'slow-roasted-treats',
    title: 'Slow-Roasted Natural Treats',
    description:
      'Single-ingredient treats slow-roasted from one clean protein — nothing else in the bag. No grain filler, no glycerine, no unpronounceable preservatives; just real meat your dog can smell from the next room and a label you can actually read. Resealable pouch, and gentle enough on the stomach to use for everyday training, not just a rare reward.',
    sku: 'BARK-TREAT-ROAST',
    productType: 'Treats',
    categories: ['eat'],
    collections: ['new-arrivals', 'gifting', 'best-sellers'],
    tags: ['treats', 'natural', 'grain-free', 'eat'],
    optionName: 'Flavour',
    values: [
      { value: 'Free-Range Chicken', price: 14 },
      { value: 'Grass-Fed Beef', price: 16 },
      { value: 'Wild Salmon', price: 18 },
    ],
    asset: 'prod-treats',
    seoTitle: 'Slow-Roasted Single-Ingredient Dog Treats — grain-free | Barkwell',
    seoDescription: 'Single-ingredient, slow-roasted natural dog treats with no filler or preservatives, in three flavours. Gentle enough for everyday training.',
  }),
  colored({
    handle: 'cotton-rope-tug-toy',
    title: 'Cotton Rope Tug Toy',
    description:
      'A chunky tug toy hand-knotted from undyed natural cotton — tough enough for a serious game of tug, soft enough to be kind on teeth and gums, and just abrasive enough to help floss away plaque as they chew. Machine-washable, and it floats, so it’s as good in the water as on the living-room floor.',
    price: 16,
    sku: 'BARK-TOY-ROPE',
    productType: 'Toy',
    categories: ['play'],
    collections: ['playtime', 'gifting'],
    tags: ['toy', 'rope', 'play', 'chew'],
    colors: ['Natural', 'Ocean', 'Berry'],
    asset: 'prod-toy',
    seoTitle: 'Cotton Rope Tug Toy — natural, tooth-friendly | Barkwell',
    seoDescription: 'A hand-knotted natural-cotton rope tug toy that’s tough on play and kind on teeth, in three colours. Machine-washable and it floats.',
  }),
  single({
    handle: 'travel-water-bottle',
    title: 'Stainless Travel Water Bottle',
    description:
      'The end of cupped hands at the park water fountain — a leak-proof stainless steel bottle with a fold-out silicone bowl built into the lid, so a drink is one thumb-press away on any walk. Holds a proper 500ml, keeps water cool, and any your dog doesn’t finish pours neatly back in rather than down your leg.',
    price: 29,
    sku: 'BARK-BOTTLE-TRAVEL',
    productType: 'Travel',
    categories: ['walk', 'eat'],
    collections: ['the-daily-walk', 'gifting'],
    tags: ['travel', 'water', 'bottle', 'walk'],
    asset: 'prod-bottle',
    seoTitle: 'Stainless Travel Dog Water Bottle — leak-proof, 500ml | Barkwell',
    seoDescription: 'A leak-proof 500ml stainless steel travel water bottle with a fold-out bowl in the lid. One-handed hydration on every walk.',
  }),
  single({
    handle: 'bamboo-grooming-brush',
    title: 'Bamboo Grooming Brush',
    description:
      'A double-sided brush with a warm bamboo handle — fine bent pins to work through tangles and undercoat on one side, a soft bristle to bring up shine and spread natural oils on the other. Five minutes a week keeps a coat healthy, cuts the shedding on your sofa, and — most dogs quickly decide — feels rather good.',
    price: 24,
    sku: 'BARK-BRUSH-BAMBOO',
    productType: 'Grooming',
    categories: ['grooming'],
    collections: ['gifting'],
    tags: ['grooming', 'brush', 'coat', 'care'],
    asset: 'prod-brush',
    seoTitle: 'Bamboo Double-Sided Dog Grooming Brush | Barkwell',
    seoDescription: 'A double-sided bamboo grooming brush — bent pins for tangles, soft bristle for shine. Five minutes a week for a healthy coat.',
  }),
  choices({
    handle: 'subscription',
    title: 'Companion Subscription Box',
    description:
      'The box that turns up before you run out — a freshly packed selection of treats, a new toy and the everyday consumables (poop bags, dental chews) matched to your dog, on the schedule you choose. Skip, swap or cancel any time, and every box works out cheaper than buying the same things one at a time. The easiest way to keep a happy dog stocked.',
    sku: 'BARK-SUB',
    productType: 'Subscription',
    categories: ['eat'],
    collections: ['new-arrivals', 'best-sellers'],
    tags: ['subscription', 'box', 'gift'],
    optionName: 'Plan',
    values: [
      { value: 'Small dog', price: 34 },
      { value: 'Large dog', price: 44 },
    ],
    asset: 'prod-subscription',
    seoTitle: 'Companion Subscription Box — treats, toys & essentials | Barkwell',
    seoDescription: 'A flexible monthly box of treats, a toy and everyday essentials matched to your dog. Skip, swap or cancel any time.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'walk', name: 'Walk', description: 'Collars, leads, harnesses and travel gear for every outing.', featured: true },
    { handle: 'rest', name: 'Rest', description: 'Orthopedic beds and cosy spots for a proper sleep.', featured: true },
    { handle: 'play', name: 'Play', description: 'Tough, tooth-friendly toys for a good game.', featured: true },
    { handle: 'eat', name: 'Eat', description: 'Bowls, natural treats and food your dog deserves.', featured: true },
    { handle: 'grooming', name: 'Grooming', description: 'Brushes and coat care for a healthy, shiny dog.', featured: false },
  ],
  collections: [
    {
      handle: 'new-arrivals',
      name: 'New in',
      description: 'The latest gear to land at Barkwell.',
      type: 'manual',
      featured: true,
      productHandles: ['heritage-leather-collar', 'adventure-harness', 'orthopedic-dog-bed', 'slow-roasted-treats', 'subscription'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The things dogs (and their people) come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['heritage-leather-collar', 'heritage-leather-lead', 'orthopedic-dog-bed', 'slow-roasted-treats', 'subscription'],
    },
    {
      handle: 'the-daily-walk',
      name: 'The daily walk',
      description: 'Everything for getting out the door — collars, leads, harnesses and water.',
      type: 'manual',
      featured: false,
      productHandles: ['heritage-leather-collar', 'heritage-leather-lead', 'adventure-harness', 'travel-water-bottle'],
    },
    {
      handle: 'rest-easy',
      name: 'Rest easy',
      description: 'Beds and bowls for a calm, well-fed home.',
      type: 'manual',
      featured: false,
      productHandles: ['orthopedic-dog-bed', 'everyday-ceramic-bowl'],
    },
    {
      handle: 'playtime',
      name: 'Playtime',
      description: 'Toys built for real play and real teeth.',
      type: 'manual',
      featured: false,
      productHandles: ['cotton-rope-tug-toy'],
    },
    {
      handle: 'gifting',
      name: 'Gift-ready',
      description: 'Easy to give, better to keep — for the dog who has (almost) everything.',
      type: 'manual',
      featured: false,
      productHandles: ['everyday-ceramic-bowl', 'slow-roasted-treats', 'cotton-rope-tug-toy', 'bamboo-grooming-brush', 'travel-water-bottle'],
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
    slug: 'the-first-week-with-a-new-dog',
    status: 'published',
    body: {
      title: 'The first week with a new dog',
      excerpt: 'Bringing a dog home is joyful and a little chaotic. Here’s how we help a new arrival settle — less about training, more about giving them room to feel safe.',
      featuredImage: { $asset: 'post-training' },
      body: {
        type: 'doc',
        content: [
          para('The day you bring a dog home, everything is new to them — the smells, the floor, the people, the rules they don’t know yet. Whether they’re an eight-week puppy or an eight-year rescue, the single most useful thing you can do in the first week isn’t training. It’s making them feel safe enough to relax. A settled dog learns; an anxious one just copes.'),
          h2('Give them a place that’s theirs'),
          para('Before anything else, set up one spot that belongs to the dog and no one else — a bed in a quiet corner, away from the front door and the busiest foot traffic. When they take themselves there, leave them completely alone, even if the kids are desperate to cuddle. A dog that learns it can retreat and won’t be followed is a dog that settles far faster, because it always has somewhere to switch off.'),
          h2('Keep the first week boring'),
          para('The instinct is to introduce the new dog to everyone and everything at once. Resist it. Keep the first week small and predictable: the same short walks, the same feeding times, the same handful of people. Predictability is what tells an animal it’s safe. The parties, the dog park, the big family visit — those can all wait a fortnight, and they’ll go far better once your dog trusts that home is calm and the routine holds.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'what-belongs-in-your-dogs-bowl',
    status: 'published',
    body: {
      title: 'What actually belongs in your dog’s bowl',
      excerpt: 'Dog food labels are designed to confuse. Here’s a plain-English guide to reading one — and why single-ingredient treats are worth the small premium.',
      featuredImage: { $asset: 'post-nutrition' },
      body: {
        type: 'doc',
        content: [
          para('Walk down the pet-food aisle and every bag promises the same things — “natural”, “premium”, “complete”. Those words are marketing, not nutrition, and none of them are regulated in the way you’d hope. The only honest guide to what’s in the bag is the ingredients list, and once you know how to read it, the good stuff separates from the filler very quickly.'),
          h2('Read the first three ingredients'),
          para('Ingredients are listed by weight, so the first two or three are most of what your dog is actually eating. You want a named meat at the top — “chicken” or “beef”, not “meat meal” or “animal derivatives”, which are the cuts nobody wants to name. Be wary when the list opens with a grain or a vague “cereals”: that’s a bag padded out with cheap filler your dog digests poorly and you pay for anyway.'),
          h2('Why single-ingredient treats matter'),
          para('Treats are where the worst offenders hide — glycerine, sugar, dyes and preservatives, all in something you hand over dozens of times a day during training. A single-ingredient treat is exactly what it says: one clean protein, slow-roasted, and nothing else. It’s gentler on sensitive stomachs, it won’t undo a careful diet, and because you’re giving so many, it’s the easiest place to cut the junk without your dog noticing anything but the better smell.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'five-minute-grooming-routine',
    status: 'published',
    body: {
      title: 'The five-minute grooming routine that prevents big problems',
      excerpt: 'Grooming isn’t about looks — it’s the cheapest health check you’ll ever do. A short weekly routine catches trouble early and keeps a coat working the way it should.',
      featuredImage: { $asset: 'post-care' },
      body: {
        type: 'doc',
        content: [
          para('Most owners think of grooming as a cosmetic thing — a wash and a brush before visitors come. In fact it’s the most reliable early-warning system you have. Five minutes a week with your hands and a brush will catch lumps, ticks, sore ears, matted fur and cracked pads long before they turn into an expensive vet visit, and it keeps your dog’s coat doing the job it’s meant to.'),
          h2('Brush with the grain, feel as you go'),
          para('Once a week, brush the whole dog in the direction the coat lies — bent pins first to lift out loose undercoat and work through any tangles, then a soft bristle to spread the natural oils that keep the coat weatherproof and shiny. As you go, let your hands do a quiet survey: run them over the ribs, the belly, the legs and around the ears, noticing anything new — a bump, a tender spot, a patch of missing fur. You’ll know your dog’s body better than any once-a-year check-up can.'),
          h2('Don’t forget the bits at the ends'),
          para('Finish with the extremities, where problems love to hide. Glance inside the ears for redness or a yeasty smell, check the pads for cracks and stuck grit, and look at the nails — if you can hear them clicking on a hard floor, they’re due a trim. None of this takes long, and doing it little and often means your dog stays relaxed about being handled, so the day you really do need to check something sore, they let you.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-pet-supplies',
  key: 'sparx-retail-pet-supplies',
  name: 'Pet Supplies (Premium)',
  theme: THEME,
  summary:
    'A complete, working shop for a premium modern pet brand: a real catalogue of a hand-stitched leather collar and matching lead, an adventure harness, an orthopedic dog bed, a ceramic bowl, natural treats, a rope toy, a travel bottle, a grooming brush and a flexible subscription box, with categories, collections, a bespoke pet-shop PDP and a full merchandised home page. Warm, friendly-but-premium theme — a cream ground, a deep teal primary and a warm coral accent. Shipped as Barkwell.',
  tagline: 'A warm, working storefront for a premium pet brand.',
  vertical: 'retail',
  industry: 'Pet supplies & accessories',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 85,
  brand: {
    businessName: 'Barkwell',
    tagline: 'The good stuff your pet actually deserves.',
  },
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Barkwell — premium pet supplies, made to last',
      description:
        'Barkwell makes the everyday things your dog uses most — leather collars, orthopedic beds, ceramic bowls, natural treats — from natural materials, built by hand and vet-approved.',
    },
    about: {
      title: 'About Barkwell',
      description:
        'Why Barkwell makes pet gear the proper way — natural materials, small workshops, vet-approved, built to last, with a share of every order going to shelters.',
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
