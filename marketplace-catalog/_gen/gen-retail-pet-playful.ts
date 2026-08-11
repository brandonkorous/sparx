// sparx-retail-pet-playful — a RETAIL/COMMERCE site template: a bright, playful pet shop.
//
// A member of the retail family: a complete, working shop the moment it installs — a real
// catalogue of a pop-colour webbing collar and matching lead, a reversible bandana, a mega toy
// bundle, a cloud nap bed, a squeaky-toy pack, a roll-up travel bowl, a treat-of-the-month box
// and a flexible membership, with categories + collections, a bespoke PDP and the full 9-page
// commerce site (home merchandising → shop → collections → cart → search → journal → about →
// contact). Dressed in an INLINE bespoke theme (a bright cheerful ground, a punchy blue primary,
// a pop-coral accent, a rounded characterful display over a rounded humanist sans). Shipped as
// Fetch Club — the LOUD, joyful counterpart to the calm-premium natural pet brand.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme
// inline and passes it on the spec (`theme`), so the whole family can be authored in parallel
// without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-pet-playful.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-pet-playful/**" \
//     "marketplace-catalog/_gen/gen-retail-pet-playful.ts"
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
// A loud, joyful pet shop: a bright sky-tinted ground, a deep readable ink, a punchy blue
// primary and a pop-coral accent, under a rounded characterful display over a rounded humanist
// sans. Complete light + dark, AA on every role (the blueprint sweep's contrast check is the
// gate). The `secondary` is a cool slate that stays dark and legible on the bright ground (it
// sets label text on the PDP), and the `accent` clears contrast as a link on the light page
// (kept at ~52% L). Very rounded shape language throughout — bouncy, characterful, fun.
const THEME = defineTheme({
  name: 'fetch-pop',
  type: { body: face('Nunito', 'sans-serif'), head: face('Fredoka', 'sans-serif') },
  shape: { selector: '1.75rem', field: '0.875rem', box: '1.5rem', depth: '0' },
  light: {
    surfaces: ['oklch(98% 0.018 235)', 'oklch(95% 0.03 240)', 'oklch(90% 0.045 245)', 'oklch(25% 0.04 260)'],
    roles: {
      primary: 'oklch(52% 0.19 255)',
      secondary: 'oklch(45% 0.05 260)',
      accent: 'oklch(52% 0.2 22)',
      neutral: 'oklch(28% 0.03 260)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(22% 0.03 260)', 'oklch(18% 0.03 260)', 'oklch(15% 0.03 260)', 'oklch(96% 0.02 235)'],
    roles: {
      primary: 'oklch(72% 0.16 255)',
      secondary: 'oklch(78% 0.04 260)',
      accent: 'oklch(74% 0.18 28)',
      neutral: 'oklch(33% 0.03 260)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "fetch-hero": "https://images.unsplash.com/photo-1609071456350-36d5a814f344?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z3Jpbm5pbmclMjBkb2clMjBtaWQtem9vbWllJTIwY2F0Y2hpbmclMjBicmlnaHQlMjBiYWxsJTIwc3Vubnl8ZW58MHwwfHx8MTc4NjQwNzc3MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fetch-tile-walk": "https://images.unsplash.com/photo-1587300003388-59208cc962cb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFwcHklMjBkb2clMjBicmlnaHR8ZW58MHwwfHx8MTc4NjQwOTAwNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fetch-tile-play": "https://images.unsplash.com/photo-1722257401181-a04cc4df36f8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwbWlkLWxlYXAlMjBzcXVlYWt5fGVufDB8MHx8fDE3ODY0MDkwMDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fetch-tile-treats": "https://images.unsplash.com/photo-1555268588-d900f7c4f81f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwY2F0Y2hpbmclMjB0cmVhdCUyMHRvc3NlZCUyMGFpcnxlbnwwfDB8fHwxNzg2NDA3Nzc4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fetch-tile-rest": "https://images.unsplash.com/photo-1504968430878-8b4dc34be661?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwZmxvcHBlZCUyMGhhcHBpbHklMjBhY3Jvc3MlMjBjb2xvdXJmdWwlMjBiZWR8ZW58MHwwfHx8MTc4NjQwNzc4MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fetch-band-made": "https://images.unsplash.com/photo-1571584004609-3b9d08de5755?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FsbCUyMGJyaWdodCUyMGNvbGxhcnMlMjB0b3lzJTIwZnVuJTIwY29sb3Vyc3xlbnwwfDB8fHwxNzg2NDA3Nzg1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fetch-band-sub": "https://images.unsplash.com/photo-1580904506207-b6319133a68f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sb3VyZnVsJTIwdHJlYXQlMjBib3glMjBiZWluZyUyMHRvcm4lMjBvcGVuJTIwYnl8ZW58MHwwfHx8MTc4NjQwNzc4OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-collar": "https://images.unsplash.com/photo-1721855806374-4285051c3b56?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwcG9wLWNvbG91ciUyMHdlYmJpbmclMjBkb2clMjBjb2xsYXJ8ZW58MHwwfHx8MTc4NjQwNzc5MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-lead": "https://images.unsplash.com/photo-1523742415007-403d0717913a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWF0Y2hpbmclMjBwb3AtY29sb3VyJTIwY2xpcHxlbnwwfDB8fHwxNzg2NDA5MDEwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-bandana": "https://images.unsplash.com/photo-1508814437933-f0c7d18a9217?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmV2ZXJzaWJsZSUyMHBhdHRlcm5lZCUyMGRvZyUyMGJhbmRhbmF8ZW58MHwwfHx8MTc4NjQwNzc5N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-toybundle": "https://images.unsplash.com/photo-1743434838736-257a5ce48e8a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGlsZSUyMGNvbG91cmZ1bCUyMGRvZyUyMHRveXMlMjBidW5kbGV8ZW58MHwwfHx8MTc4NjQwNzgwMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-bed": "https://images.unsplash.com/photo-1646195164326-124b72fb9d34?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c29mdCUyMGNsb3VkLXNoYXBlZCUyMHBhdHRlcm5lZCUyMGRvZyUyMGJlZHxlbnwwfDB8fHwxNzg2NDA3ODA1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-squeaky": "https://images.unsplash.com/photo-1587559070757-f72a388edbba?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFjayUyMGJyaWdodCUyMHNxdWVha3klMjBwbHVzaCUyMGRvZyUyMHRveXN8ZW58MHwwfHx8MTc4NjQwNzgwOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-bowl": "https://images.unsplash.com/photo-1716652195098-24c6e7e590e5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbC11cCUyMHNpbGljb25lJTIwdHJhdmVsJTIwYm93bCUyMGZ1biUyMGNvbG91cnxlbnwwfDB8fHwxNzg2NDA3ODEyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-treatbox": "https://images.unsplash.com/photo-1622467827417-bbe2237067a9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJlYXQtb2YtdGhlLW1vbnRoJTIwYm94JTIwcGFja2VkJTIwZ29vZGllc3xlbnwwfDB8fHwxNzg2NDA3ODE1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subscription": "https://images.unsplash.com/photo-1599110906471-54c8ba535658?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmV0Y2glMjBjbHViJTIwbWVtYmVyc2hpcHxlbnwwfDB8fHwxNzg2NDA5MDEzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-treats": "https://images.unsplash.com/photo-1534551767192-78b8dd45b51b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZG9nJTIwc2l0dGluZyUyMHBvbGl0ZWx5JTIwd2FpdGluZyUyMHRyZWF0fGVufDB8MHx8fDE3ODY0MDc4MjN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-newpup": "https://images.unsplash.com/photo-1735465685965-3b6f0cac8a52?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2lkZS1leWVkJTIwcHVwcHklMjBleHBsb3Jpbmd8ZW58MHwwfHx8MTc4NjQwOTAxOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'fetch-hero', url: src('fetch-hero'), alt: 'A grinning dog mid-zoomie catching a bright ball in a sunny park' },
  { id: 'fetch-tile-walk', url: src('fetch-tile-walk'), alt: 'A happy dog in a bright pop-colour collar on a walk' },
  { id: 'fetch-tile-play', url: src('fetch-tile-play'), alt: 'A dog mid-leap with a squeaky toy in its mouth' },
  { id: 'fetch-tile-treats', url: src('fetch-tile-treats'), alt: 'A dog catching a treat tossed in the air' },
  { id: 'fetch-tile-rest', url: src('fetch-tile-rest'), alt: 'A dog flopped happily across a colourful bed' },
  { id: 'fetch-band-made', url: src('fetch-band-made'), alt: 'A wall of bright collars and toys in fun colours' },
  { id: 'fetch-band-sub', url: src('fetch-band-sub'), alt: 'A colourful treat box being torn open by an excited dog' },
  { id: 'prod-collar', url: src('prod-collar'), alt: 'A bright pop-colour webbing dog collar' },
  { id: 'prod-lead', url: src('prod-lead'), alt: 'A matching pop-colour clip lead coiled up' },
  { id: 'prod-bandana', url: src('prod-bandana'), alt: 'A reversible patterned dog bandana' },
  { id: 'prod-toybundle', url: src('prod-toybundle'), alt: 'A pile of colourful dog toys in a bundle' },
  { id: 'prod-bed', url: src('prod-bed'), alt: 'A soft cloud-shaped patterned dog bed' },
  { id: 'prod-squeaky', url: src('prod-squeaky'), alt: 'A pack of bright squeaky plush dog toys' },
  { id: 'prod-bowl', url: src('prod-bowl'), alt: 'A roll-up silicone travel bowl in a fun colour' },
  { id: 'prod-treatbox', url: src('prod-treatbox'), alt: 'A treat-of-the-month box packed with goodies' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A Fetch Club membership box bursting with toys and treats' },
  { id: 'post-play', url: src('post-play'), alt: 'A dog having the zoomies with a toy in a park' },
  { id: 'post-treats', url: src('post-treats'), alt: 'A dog sitting politely waiting for a treat' },
  { id: 'post-newpup', url: src('post-newpup'), alt: 'A wide-eyed puppy exploring a bright new home' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-pet-playful: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one bright, high-energy photograph, a rounded headline and a lead in a
 *  solid readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the
 *  photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('fetch-hero'), alt: 'A grinning dog mid-zoomie catching a bright ball', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Spoil them. They’ve earned it.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Fetch Club makes the fun stuff — pop-colour collars, squeaky toys they’ll actually love, treats worth sitting for, and beds made for the world’s best nap. Bright, bouncy, built to survive the zoomies. Because a good dog deserves a good time.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the fun' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop/membership' },
                      text: 'Join Fetch Club',
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

/** One category tile — a photo with a label beneath, the whole tile a link that gives a
 *  playful wiggle-and-grow on hover. */
function categoryTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
  return el('a', 'group flex flex-col gap-3', {
    attrs: { href: o.href },
    children: [
      el(
        'img',
        'aspect-square w-full rounded-box bg-base-200 object-cover transition group-hover:-rotate-2 group-hover:scale-105',
        {
          attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
        }
      ),
      el('span', 'text-center text-lg font-semibold text-base-content', { text: o.label }),
    ],
  });
}

function categoryTiles(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'What are we doing today?',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'fetch-tile-walk', label: 'Walk', href: '/shop', alt: 'A dog in a bright collar on a walk' }),
              categoryTile({ assetId: 'fetch-tile-play', label: 'Play', href: '/shop', alt: 'A dog leaping for a squeaky toy' }),
              categoryTile({ assetId: 'fetch-tile-treats', label: 'Treats', href: '/shop', alt: 'A dog catching a treat in the air' }),
              categoryTile({ assetId: 'fetch-tile-rest', label: 'Rest', href: '/shop', alt: 'A dog flopped across a colourful bed' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Just dropped' }),
  editorialBand({
    heading: 'Bright, bouncy, and built for the zoomies',
    lead: 'We test every toy against the world’s toughest reviewers — actual dogs, going full send. If it can’t survive a proper game of tug, a park sprint and a hopeful attempt at eating it, it doesn’t make the shelf. Colour that pops, stitching that holds, squeaks that keep on squeaking.',
    assetId: 'fetch-band-made',
    cta: 'Why dogs love us',
    href: '/blog/toys-that-survive-the-zoomies',
    alt: 'A wall of bright collars and toys in fun colours',
  }),
  productsBlock({ source: 'commerce.category.play', layout: 'carousel', heading: 'Let’s play' }),
  editorialBand({
    heading: 'The box your dog will lose their mind over',
    lead: 'Join Fetch Club and a box of fresh toys, treats and everyday goodies turns up on your schedule — matched to your dog and packed to be torn into. Skip, swap or cancel any time, no lock-in, and every box works out cheaper than buying it all one at a time.',
    assetId: 'fetch-band-sub',
    cta: 'Join the club',
    href: '/shop/membership',
    alt: 'A colourful treat box being torn open by an excited dog',
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
                    text: 'Fetch Club',
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
                    label: 'Almost gone',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'The Fetch Club promise' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Dog-tested, tail-approved. Free shipping over $39, and a happy-dog guarantee — if your pup isn’t obsessed, send it back within 30 days for a full refund. No fuss, no sad faces.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'They’ll want these too' });

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
    'Shop the fun',
    'The whole happy range in one place — pop-colour collars and leads, bandanas, squeaky toys, comfy beds, travel gear and treats worth sitting for. Filter by what your dog’s into or sort however you like; everything here is dog-tested, tail-approved and ready to party.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The good stuff, grouped the fun way — what just dropped, the crowd pleasers every dog goes wild for, the full walkies kit, playtime picks, and boxes that make an easy gift.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Fetch Club', 'After a size, a colour, or a bit of doggy advice? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping over $39, packed with a treat on top and sent within a day. Not quite a hit with your pup? Send it back within 30 days for a full refund — our happy-dog guarantee puts the risk on us, not you.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Fetch Club journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Fun, useful bits from people who are, frankly, a bit obsessed with dogs — toys that actually last, treats you can feel good about, and helping a new pup feel at home. No jargon, no snobbery, just good dog stuff.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Fetch Club' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Fetch Club started at a muddy dog park with a chewed-up ball and a simple thought: why is so much dog stuff so boring? Beige beds, grey collars, toys that gave up after one good tug. Our dogs have more personality than that — and we figured their gear should too.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'So we make the fun stuff, properly. Pop colours that are easy to spot across a field, stitching and hardware that survive a serious game of tug, squeaks engineered to keep on squeaking, and treats with a label you can actually pronounce. Every single thing is tested by real dogs going full send — and only makes the shelf if they’re obsessed.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No boring beige, no throwaway junk, no marketing dressed up as care. Just bright, bouncy, well-made things for the goofball who’s thrilled to see you every single day — and a share of every order goes to the shelters helping more dogs find their people.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Say woof' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Not sure which collar size fits, need help picking a toy your chewer can’t destroy, or want to stock Fetch Club in your shop? Tell us about your dog and a real human here — usually with a dog on their lap — will get back to you within a day.',
          }),
          el('a', 'btn btn-primary btn-lg', { attrs: { href: 'mailto:hello@fetchclub.example' }, text: 'Email the pack' }),
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

const VENDOR = 'Fetch Club';

/** Unique short codes for a value list — grows the slice until each is distinct, so two
 *  values sharing a prefix never collide in a SKU. */
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

/** A piece offered in a set of colour swatches — one variant per colour, flat price. */
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

/** A piece offered in a dropdown of named choices, each with its own price (size, box…). */
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
 *  lists at a flat price. Every variant sets BOTH options, exactly one is default, and the SKU
 *  pins the size + colour codes so no two combinations collide. The blueprint validator
 *  requires each variant to name every option, so both keys are always present. */
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
    handle: 'pop-webbing-collar',
    title: 'Pop Webbing Collar',
    description:
      'The collar you can spot across a whole field — chunky recycled webbing in colours that actually pop, a bombproof metal buckle that clicks and stays clicked, and a welded D-ring that won’t bend when your dog decides a squirrel is worth the sprint. Soft-edged so it never rubs, wipes clean after the muddiest adventure, and honestly makes every dog look about 30% more fun. Measure the neck and pick a size below.',
    price: 22,
    sku: 'FETCH-COL-POP',
    productType: 'Collar',
    categories: ['walk'],
    collections: ['just-dropped', 'walkies-kit', 'crowd-pleasers'],
    tags: ['collar', 'walk', 'colourful'],
    sizes: ['Small', 'Medium', 'Large'],
    colors: ['Sunbeam Yellow', 'Splash Blue', 'Bubblegum Pink'],
    asset: 'prod-collar',
    seoTitle: 'Pop Webbing Dog Collar — bright, bombproof buckle | Fetch Club',
    seoDescription: 'A chunky recycled-webbing dog collar in pop colours with a bombproof metal buckle, in three sizes and three colours. Easy to spot, built for zoomies.',
  }),
  colored({
    handle: 'matching-pop-lead',
    title: 'Matching Pop Lead',
    description:
      'The lead built to match the collar — the same bright recycled webbing and a chunky trigger clip that’s easy to snap on even with cold hands and a wiggly dog. A comfy five-foot length with a padded handle that stays soft on the palm through the whole walk, and a handy O-ring for clipping on a poop-bag holder. Loud, tough, and impossible to lose in a messy hallway.',
    price: 24,
    sku: 'FETCH-LEAD-POP',
    productType: 'Lead',
    categories: ['walk'],
    collections: ['walkies-kit', 'crowd-pleasers'],
    tags: ['lead', 'leash', 'walk', 'colourful'],
    colors: ['Sunbeam Yellow', 'Splash Blue', 'Bubblegum Pink'],
    asset: 'prod-lead',
    seoTitle: 'Matching Pop Dog Lead — padded handle, 5ft | Fetch Club',
    seoDescription: 'A five-foot bright recycled-webbing lead with a chunky trigger clip and padded handle, made to match the Pop collar. Loud, tough and easy to grab.',
  }),
  sizeColor({
    handle: 'reversible-bandana',
    title: 'Reversible Party Bandana',
    description:
      'Two looks in one — a soft cotton bandana that’s a different fun print on each side, so your dog can be spots today and stripes tomorrow. Slips onto the collar (no tying, no fuss), sits flat so it never bunches, and washes again and again without fading. The fastest way to make an ordinary Tuesday walk feel like a proper day out. Pick a size and a print pair below.',
    price: 16,
    sku: 'FETCH-BAND-REV',
    productType: 'Bandana',
    categories: ['walk'],
    collections: ['just-dropped', 'gift-ready'],
    tags: ['bandana', 'walk', 'colourful'],
    sizes: ['Small', 'Medium', 'Large'],
    colors: ['Confetti & Spots', 'Stripes & Bones', 'Rainbow & Paws'],
    colorOption: 'Print',
    asset: 'prod-bandana',
    seoTitle: 'Reversible Party Dog Bandana — two prints, no-tie | Fetch Club',
    seoDescription: 'A soft cotton reversible dog bandana with a different fun print on each side, in three sizes and three print pairs. Slips on the collar, washes and lasts.',
  }),
  single({
    handle: 'mega-toy-bundle',
    title: 'Mega Toy Bundle',
    description:
      'One big box, five kinds of fun — a rope tug, a crinkle plush, a treat-hiding puzzle, a bouncy fetch ball and a squeaky sidekick, all in one bundle that costs less than buying them apart. Something for a wet afternoon indoors and something for a proper park session, covering chewers, thinkers, tuggers and full-tilt fetchers. The easiest way to find out exactly what your dog is into.',
    price: 44,
    sku: 'FETCH-TOY-MEGA',
    productType: 'Toy',
    categories: ['play'],
    collections: ['just-dropped', 'playtime-party', 'gift-ready', 'crowd-pleasers'],
    tags: ['toy', 'bundle', 'play'],
    asset: 'prod-toybundle',
    seoTitle: 'Mega Dog Toy Bundle — five toys, one box | Fetch Club',
    seoDescription: 'A five-toy bundle — rope tug, crinkle plush, treat puzzle, fetch ball and a squeaky sidekick — for less than buying them apart. Fun for every kind of dog.',
  }),
  choices({
    handle: 'cloud-nap-bed',
    title: 'Cloud Nap Bed',
    description:
      'A big squishy cloud of a bed for the world’s most important naps — a deep fibre fill your dog can burrow and circle into, a raised bolster edge perfect for chin-resting, and a bright, characterful cover that unzips and machine-washes in one go (because muddy paws are a fact of life). Non-slip base so it stays put during the 3am relocation, and comfy enough that you’ll catch them ignoring the sofa. Pick the size for your dog below.',
    sku: 'FETCH-BED-CLOUD',
    productType: 'Bed',
    categories: ['rest'],
    collections: ['just-dropped', 'crowd-pleasers'],
    tags: ['bed', 'rest', 'sleep', 'colourful'],
    optionName: 'Size',
    values: [
      { value: 'Small', price: 59 },
      { value: 'Medium', price: 79 },
      { value: 'Large', price: 109 },
    ],
    asset: 'prod-bed',
    seoTitle: 'Cloud Nap Dog Bed — squishy, washable cover | Fetch Club',
    seoDescription: 'A deep, squishy cloud dog bed with a bolster edge and a fully machine-washable cover, in three sizes. Bright, comfy and built for serious napping.',
  }),
  choices({
    handle: 'squeaky-squad-pack',
    title: 'Squeaky Squad Toy Pack',
    description:
      'A whole squad of squeaky plush pals with a personality each — bright, huggable, and stuffed with squeakers engineered to keep on squeaking well past the point most toys give up. Soft enough to carry everywhere, tough enough for a good shake-and-toss, and just the right size to become The Favourite that goes everywhere. Grab a three-pack to start, or the six-pack when you already know how this ends.',
    sku: 'FETCH-TOY-SQUAD',
    productType: 'Toy',
    categories: ['play'],
    collections: ['playtime-party', 'gift-ready'],
    tags: ['toy', 'squeaky', 'plush', 'play'],
    optionName: 'Pack',
    values: [
      { value: 'Three-Pack', price: 26 },
      { value: 'Six-Pack', price: 46 },
    ],
    asset: 'prod-squeaky',
    seoTitle: 'Squeaky Squad Plush Dog Toy Pack — 3 or 6 | Fetch Club',
    seoDescription: 'A pack of bright, huggable squeaky plush dog toys engineered to keep on squeaking, in a three-pack or six-pack. Soft to carry, tough enough to toss.',
  }),
  colored({
    handle: 'roll-up-travel-bowl',
    title: 'Roll-Up Travel Bowl',
    description:
      'The end of cupped-hands-at-the-water-fountain — a food-grade silicone bowl that rolls down flat to pocket size and pops open for a drink or a snack anywhere the day takes you. Holds a proper amount, wipes clean in a second, and clips onto a bag or a belt loop so it’s always there when your dog gives you the thirsty look. Bright enough that you won’t leave it behind on the picnic blanket.',
    price: 14,
    sku: 'FETCH-BOWL-ROLL',
    productType: 'Travel',
    categories: ['walk'],
    collections: ['walkies-kit', 'gift-ready'],
    tags: ['travel', 'bowl', 'walk', 'colourful'],
    colors: ['Splash Blue', 'Sunbeam Yellow', 'Zoom Green'],
    asset: 'prod-bowl',
    seoTitle: 'Roll-Up Silicone Travel Dog Bowl — pocket size | Fetch Club',
    seoDescription: 'A food-grade silicone travel dog bowl that rolls flat to pocket size and clips onto a bag, in three bright colours. Water and snacks, wherever you go.',
  }),
  choices({
    handle: 'treat-of-the-month-box',
    title: 'Treat-of-the-Month Box',
    description:
      'A box of the good treats, delivered — a rotating mix of single-ingredient chews, training-sized nibbles and one surprise star, matched to your dog’s size and picked so every bite is worth a proper sit. Real named proteins, labels you can actually read, and nothing your vet would frown at. Pick the box that fits your dog’s appetite; it turns up each month until you say otherwise, and you can skip or cancel any time.',
    sku: 'FETCH-TREAT-MONTH',
    productType: 'Treats',
    categories: ['treats'],
    collections: ['just-dropped', 'gift-ready', 'crowd-pleasers'],
    tags: ['treats', 'natural', 'box', 'monthly'],
    optionName: 'Box',
    values: [
      { value: 'Mini', price: 19 },
      { value: 'Regular', price: 29 },
      { value: 'Feast', price: 39 },
    ],
    asset: 'prod-treatbox',
    seoTitle: 'Treat-of-the-Month Dog Box — single-ingredient chews | Fetch Club',
    seoDescription: 'A monthly box of rotating single-ingredient chews and training treats matched to your dog, in three sizes. Real proteins, honest labels; skip any time.',
  }),
  choices({
    handle: 'membership',
    title: 'Fetch Club Membership',
    description:
      'The whole club in a box — a fresh haul of toys, treats and everyday goodies your dog will genuinely lose their mind over, packed to your dog’s size and posted on your schedule. Every box is a party your pup didn’t know was coming, works out cheaper than buying it all one at a time, and comes with member perks: early dibs on new drops and free shipping on everything else. Skip, swap or cancel any time — no lock-in, ever.',
    sku: 'FETCH-CLUB',
    productType: 'Subscription',
    categories: ['treats'],
    collections: ['just-dropped', 'crowd-pleasers'],
    tags: ['subscription', 'membership', 'box', 'gift'],
    optionName: 'Plan',
    values: [
      { value: 'Small dog', price: 32 },
      { value: 'Big dog', price: 42 },
    ],
    asset: 'prod-subscription',
    seoTitle: 'Fetch Club Membership — a monthly box of toys & treats | Fetch Club',
    seoDescription: 'A flexible monthly box of toys, treats and everyday goodies matched to your dog, with member perks and early drops. Skip, swap or cancel any time.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'walk', name: 'Walk', description: 'Pop-colour collars, leads, bandanas and travel gear for every outing.', featured: true },
    { handle: 'play', name: 'Play', description: 'Squeaky, bouncy, tuggable toys built to survive the zoomies.', featured: true },
    { handle: 'treats', name: 'Treats', description: 'Honest treats and monthly boxes worth sitting for.', featured: true },
    { handle: 'rest', name: 'Rest', description: 'Big squishy beds for the world’s most important naps.', featured: true },
  ],
  collections: [
    {
      handle: 'just-dropped',
      name: 'Just dropped',
      description: 'The freshest, brightest gear to land at Fetch Club.',
      type: 'manual',
      featured: true,
      productHandles: ['pop-webbing-collar', 'reversible-bandana', 'mega-toy-bundle', 'cloud-nap-bed', 'treat-of-the-month-box', 'membership'],
    },
    {
      handle: 'crowd-pleasers',
      name: 'Crowd pleasers',
      description: 'The stuff every dog goes wild for.',
      type: 'manual',
      featured: true,
      productHandles: ['pop-webbing-collar', 'matching-pop-lead', 'mega-toy-bundle', 'cloud-nap-bed', 'treat-of-the-month-box', 'membership'],
    },
    {
      handle: 'walkies-kit',
      name: 'The walkies kit',
      description: 'Everything for getting out the door — collars, leads, bandanas and water.',
      type: 'manual',
      featured: false,
      productHandles: ['pop-webbing-collar', 'matching-pop-lead', 'reversible-bandana', 'roll-up-travel-bowl'],
    },
    {
      handle: 'playtime-party',
      name: 'Playtime party',
      description: 'Toys built for real play and real teeth.',
      type: 'manual',
      featured: false,
      productHandles: ['mega-toy-bundle', 'squeaky-squad-pack'],
    },
    {
      handle: 'gift-ready',
      name: 'Easy to gift',
      description: 'Wrapped-and-ready fun for the dog who has (almost) everything.',
      type: 'manual',
      featured: false,
      productHandles: ['reversible-bandana', 'mega-toy-bundle', 'squeaky-squad-pack', 'roll-up-travel-bowl', 'treat-of-the-month-box'],
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
    slug: 'toys-that-survive-the-zoomies',
    status: 'published',
    body: {
      title: 'How to buy a dog toy that actually survives the zoomies',
      excerpt: 'A shelf of half-dead toys is a rite of passage — but it doesn’t have to be. Here’s how to pick toys that last, and match them to how your dog actually plays.',
      featuredImage: { $asset: 'post-play' },
      body: {
        type: 'doc',
        content: [
          para('Every dog owner has the drawer: the deflated ball, the plush with the stuffing pulled out, the rope frayed down to a nub. Toys don’t have to be disposable, though. The trick is buying for the way your dog actually plays, not the way the packaging looks — because a great toy for a gentle cuddler is a ten-minute snack for a power chewer.'),
          h2('Know your dog’s play style'),
          para('Watch what your dog does with a toy in the first five minutes and you’ll know their type. Chewers work at a toy with their back teeth and want something dense and tough. Tuggers want a rope or a handle and a good game with you. Shredders love the satisfying rip, so a crinkle plush or a puzzle scratches the itch. And fetchers just want to run — give them a bright, bouncy ball they can spot in long grass. Buy against the type, not against the price tag, and toys last far longer.'),
          h2('Rotate, don’t pile on'),
          para('Here’s the cheat code: dogs get bored of what’s always there. Instead of tipping the whole toy box out at once, keep a handful in rotation and swap them every few days. A toy that vanishes for a week comes back feeling brand new, your dog stays interested, and everything lasts longer because nothing gets hammered non-stop. It’s the same reason our Mega Bundle covers a few different play styles — so you can find the winner, then keep it exciting.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'treats-you-can-feel-good-about',
    status: 'published',
    body: {
      title: 'Treats you can feel good about handing over',
      excerpt: 'You give treats dozens of times a day, so they add up fast. Here’s how to read a treat label in ten seconds and pick ones that won’t undo all your good work.',
      featuredImage: { $asset: 'post-treats' },
      body: {
        type: 'doc',
        content: [
          para('Treats are the currency of a happy dog — the “good sit”, the coming-when-called, the just-because. But because you hand them over so often, a bad treat does a lot of quiet damage: too much sugar, mystery fillers, a label that reads like a chemistry set. The good news is that spotting the good ones takes about ten seconds once you know what you’re looking at.'),
          h2('Read the first ingredient'),
          para('Ingredients are listed by weight, so the first one is most of what your dog is actually eating. You want a named protein right at the top — “chicken”, “salmon”, “beef” — not a vague “meat meal”, “animal derivatives”, or a grain doing the heavy lifting. If sugar, glycerine or a colour you can’t pronounce shows up early in the list, put it back. Real food doesn’t need dressing up.'),
          h2('Match the size to the job'),
          para('For training, smaller is better — you’re rewarding often, so a treat the size of a pea keeps your dog keen without filling them up or wrecking their dinner. Save the big chews for downtime, when a longer-lasting treat gives busy paws and jaws something calm to do. It’s exactly why our monthly box mixes training-sized nibbles with a couple of proper chews: the right treat for the moment, all with labels you can actually read.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'first-week-with-a-new-pup',
    status: 'published',
    body: {
      title: 'The first week with a new pup (keep it fun, keep it calm)',
      excerpt: 'A new puppy is pure joy and total chaos. Here’s how we help a new arrival settle — more about safety and play than serious training on day one.',
      featuredImage: { $asset: 'post-newpup' },
      body: {
        type: 'doc',
        content: [
          para('The day a puppy comes home, everything is enormous and new — the floor, the smells, the giant loud humans who keep wanting to cuddle. Whether it’s an eight-week bundle or a slightly older rescue, the most useful thing you can do in week one isn’t drilling commands. It’s making them feel safe, and letting the fun come in small, happy doses. A relaxed dog learns fast; an overwhelmed one just copes.'),
          h2('Give them a spot that’s theirs'),
          para('Before anything else, set up one cosy place that belongs to the pup and nobody else — a soft bed in a quiet corner, away from the front door and the busiest foot traffic. When they take themselves off to it, leave them completely alone, even when the kids are desperate for one more cuddle. A dog that learns it can retreat and won’t be followed settles far faster, because it always has somewhere to switch off.'),
          h2('Play little, play often'),
          para('Puppies have a short attention span and a shorter fuse, so keep play sessions brief, silly and frequent rather than long and intense. A minute of gentle tug, a rolled treat to chase, a squeaky toy squeaked just out of reach — then a rest before it tips into overtired zoomies and tears. Little-and-often builds a dog who thinks the world (and you) is brilliant, and that happy foundation makes every bit of real training later go far, far easier.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-pet-playful',
  key: 'sparx-retail-pet-playful',
  name: 'sparx — Pet Supplies (Playful)',
  theme: THEME,
  summary:
    'A complete, working shop for a bright, playful pet brand: a real catalogue of a pop-colour webbing collar and matching lead, a reversible bandana, a mega toy bundle, a cloud nap bed, a squeaky-toy pack, a roll-up travel bowl, a treat-of-the-month box and a flexible membership, with categories, collections, a bespoke pet-shop PDP and a full merchandised home page. Loud, joyful theme — a bright ground, a punchy blue primary and a pop-coral accent. Shipped as Fetch Club.',
  tagline: 'A bright, bouncy storefront for a fun-first pet brand.',
  vertical: 'retail',
  industry: 'Pet supplies & accessories',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 84,
  brand: {
    businessName: 'Fetch Club',
    tagline: 'Spoil them. They’ve earned it.',
  },
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Fetch Club — bright, bouncy pet gear dogs go wild for',
      description:
        'Fetch Club makes the fun stuff — pop-colour collars, squeaky toys, honest treats and comfy beds — dog-tested, tail-approved and built to survive the zoomies.',
    },
    about: {
      title: 'About Fetch Club',
      description:
        'Why Fetch Club makes pet gear the fun way — bright colours, tough builds, honest treats, tested by real dogs, with a share of every order going to shelters.',
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
