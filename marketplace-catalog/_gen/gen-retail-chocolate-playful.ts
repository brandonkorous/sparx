// sparx-retail-chocolate-playful — a RETAIL/COMMERCE site template: a bright, gift-forward
// chocolate & sweets shop.
//
// The joyful, colourful counterpart to the serious bean-to-bar chocolatier (gen-retail-chocolate,
// "Cacao & Co."). A complete, working shop the moment it installs — a real catalogue of colourful
// bonbon boxes, a build-your-own selection, hot-cocoa bombs, chocolate-dipped treats, a birthday
// gift box, a kids' bundle and a flexible subscription, with categories + collections, a bespoke
// PDP, and the full 9-page commerce site (home merchandising → shop → collections → cart → search
// → journal → about → contact). Dressed in an INLINE bespoke theme: a bright sweet-shop — a warm
// vanilla-cream ground, a punchy raspberry candy primary, a berry-grape pop accent, a rounded
// characterful display, big colourful confection photography and playful hovers (tiles that scale
// and tilt). Shipped as Sweet Tooth Co.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries its OWN
// theme inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-chocolate-playful.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-chocolate-playful/**" \
//     "marketplace-catalog/_gen/gen-retail-chocolate-playful.ts"
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
// A bright sweet-shop, the opposite of the dark chocolatier's low-lit room. Light mode is the
// star: a warm vanilla-cream ground, deep cocoa ink, a punchy RASPBERRY candy primary (a fill
// only, always white-on-pink) and a BERRY-GRAPE pop accent used as text — kept dark enough
// (~46% L) to read cleanly on cream. `secondary` is a warm cocoa brown, also used as text, so
// it too stays dark on the light ground. A rounded, characterful FREDOKA display over a soft
// NUNITO sans, and generous BOX radii, carry the playful, gift-forward feel. Dark mode lifts
// every text role bright so the pink/berry pops stay legible on cocoa. Bright status in both
// modes. Complete light + dark, AA on every role (the blueprint sweep's contrast check is the
// gate).
const THEME = defineTheme({
  name: 'cocoa-pop',
  type: { body: face('Nunito', 'sans-serif'), head: face('Fredoka', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.5rem', box: '1.25rem', depth: '0' },
  light: {
    surfaces: ['oklch(98% 0.018 95)', 'oklch(95% 0.03 88)', 'oklch(91% 0.04 82)', 'oklch(27% 0.05 40)'],
    roles: {
      primary: 'oklch(56% 0.2 8)',
      secondary: 'oklch(42% 0.06 50)',
      accent: 'oklch(46% 0.16 330)',
      neutral: 'oklch(30% 0.04 40)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(26% 0.04 35)', 'oklch(22% 0.04 35)', 'oklch(18% 0.035 35)', 'oklch(96% 0.02 95)'],
    roles: {
      primary: 'oklch(68% 0.18 10)',
      secondary: 'oklch(82% 0.05 60)',
      accent: 'oklch(80% 0.14 330)',
      neutral: 'oklch(32% 0.03 35)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "choc-hero": "https://images.unsplash.com/photo-1731504799529-5d11973b8005?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sb3VyZnVsJTIwc3ByZWFkJTIwZ2xvc3N5JTIwZmlsbGVkJTIwYm9uYm9ucyUyMHdyYXBwZWQlMjB0cmVhdHN8ZW58MHwwfHx8MTc4NjQxNjI1MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-boxes": "https://images.unsplash.com/photo-1774978238615-881981af6948?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3BlbiUyMGJveCUyMGpld2VsLWNvbG91cmVkJTIwYm9uYm9uc3xlbnwwfDB8fHwxNzg2NDE2MjU0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-byo": "https://images.unsplash.com/photo-1548741396-8fc32fa22ffd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHMlMjBjaG9vc2luZyUyMGNob2NvbGF0ZXMlMjBmaWxsJTIwcGljay15b3VyLW93biUyMGJveHxlbnwwfDB8fHwxNzg2NDE2MjU3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-gifts": "https://images.unsplash.com/photo-1504288041952-91e61c2ebc6e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmliYm9uZWQlMjBjaG9jb2xhdGUlMjBnaWZ0JTIwYm94JTIwYm93fGVufDB8MHx8fDE3ODY0MTYyNjF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-sub": "https://images.unsplash.com/photo-1647221598398-934ed5cb0e4f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBicmlnaHQlMjBjaG9jb2xhdGUlMjBib3hlcyUyMHRpZWQlMjByaWJib258ZW58MHwwfHx8MTc4NjQxNjI2NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "band-make": "https://images.unsplash.com/photo-1602748837803-7e1648244fed?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hvY29sYXRpZXIlMjBwaXBpbmclMjBjb2xvdXJmdWx8ZW58MHwwfHx8MTc4NjQxNjMzN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "band-gift": "https://images.unsplash.com/photo-1622467827417-bbe2237067a9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d3JhcHBlZCUyMHRyZWF0JTIwYm94fGVufDB8MHx8fDE3ODY0MTYzNDF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-rainbow": "https://images.unsplash.com/photo-1636407734378-182ee7da5b9d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwcmFpbmJvdy1jb2xvdXJlZCUyMGZpbGxlZCUyMGJvbmJvbnN8ZW58MHwwfHx8MTc4NjQxNjI3MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-caramel": "https://images.unsplash.com/photo-1652125315903-f593f65e5d50?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwc2FsdGVkLWNhcmFtZWwlMjBib25ib25zfGVufDB8MHx8fDE3ODY0MTYyNzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-darkmilk": "https://images.unsplash.com/photo-1548741487-18d363dc4469?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWl4ZWQlMjBib3glMjBkYXJrJTIwbWlsayUyMGNob2NvbGF0ZSUyMGJvbmJvbnN8ZW58MHwwfHx8MTc4NjQxNjI3N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-byo": "https://images.unsplash.com/photo-1687795097254-f019f9d7fd17?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8YnVpbGQteW91ci1vd24lMjBzZWxlY3Rpb24lMjBib3glMjBiZWluZyUyMGZpbGxlZCUyMGNob2NvbGF0ZXN8ZW58MHwwfHx8MTc4NjQxNjI4MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cocoabombs": "https://images.unsplash.com/photo-1570847466293-8b65c7e3d604?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhyZWUlMjBob3QtY29jb2ElMjBib21icyUyMGJlc2lkZSUyMG11ZyUyMGhvdCUyMG1pbGt8ZW58MHwwfHx8MTc4NjQxNjI4M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-pretzels": "https://images.unsplash.com/photo-1722239314251-bc19f0015fde?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hvY29sYXRlLWRpcHBlZCUyMHByZXR6ZWxzJTIwY29sb3VyZnVsJTIwZHJpenpsZXxlbnwwfDB8fHwxNzg2NDE2Mjg2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-marshmallow": "https://images.unsplash.com/photo-1586195830864-e4d9688815c8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hvY29sYXRlLWRpcHBlZCUyMG1hcnNobWFsbG93JTIwcG9wcyUyMHNwcmlua2xlc3xlbnwwfDB8fHwxNzg2NDE2Mjg5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-birthday": "https://images.unsplash.com/photo-1549465220-1a8b9238cd48?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmlydGhkYXklMjBnaWZ0JTIwYm94JTIwY2hvY29sYXRlcyUyMGNhbmRsZSUyMGNvbmZldHRpfGVufDB8MHx8fDE3ODY0MTYyOTN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-kids": "https://images.unsplash.com/photo-1627373369589-1faf52348826?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8a2lkcyUyMHRyZWF0JTIwYnVuZGxlJTIwZnVuLXNoYXBlZCUyMGNob2NvbGF0ZXN8ZW58MHwwfHx8MTc4NjQxNjI5Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subscription": "https://images.unsplash.com/photo-1612195325560-9d241f1e25cc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9udGhseSUyMHRyZWF0JTIwc3Vic2NyaXB0aW9uJTIwYm94JTIwdGllZCUyMHJpYmJvbnxlbnwwfDB8fHwxNzg2NDE2Mjk5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-giftbox": "https://images.unsplash.com/photo-1599599810769-bcde5a160d32?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2lmdCUyMGJveCUyMGJlaW5nJTIwcGFja2VkJTIwYXNzb3J0bWVudCUyMGNob2NvbGF0ZXN8ZW58MHwwfHx8MTc4NjQxNjMwM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-cocoa": "https://images.unsplash.com/photo-1517578239113-b03992dcdd25?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aG90LWNvY29hJTIwYm9tYiUyMG1lbHRpbmclMjBvcGVuJTIwbXVnJTIwaG90JTIwbWlsa3xlbnwwfDB8fHwxNzg2NDE2MzA1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-makers": "https://images.unsplash.com/photo-1670843628786-54cd971f657d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hvY29sYXRpZXJzJTIwZGVjb3JhdGluZyUyMHRyYXlzJTIwY29sb3VyZnVsJTIwYm9uYm9uc3xlbnwwfDB8fHwxNzg2NDE2MzA4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'choc-hero', url: src('choc-hero'), alt: 'A colourful spread of glossy filled bonbons and wrapped treats on a bright table' },
  { id: 'tile-boxes', url: src('tile-boxes'), alt: 'An open box of jewel-coloured bonbons' },
  { id: 'tile-byo', url: src('tile-byo'), alt: 'Hands choosing chocolates to fill a pick-your-own box' },
  { id: 'tile-gifts', url: src('tile-gifts'), alt: 'A ribboned chocolate gift box with a bow' },
  { id: 'tile-sub', url: src('tile-sub'), alt: 'A stack of bright chocolate boxes tied with ribbon' },
  { id: 'band-make', url: src('band-make'), alt: 'A chocolatier piping colourful shells into bonbon moulds' },
  { id: 'band-gift', url: src('band-gift'), alt: 'A wrapped treat box left on a doorstep with a balloon' },
  { id: 'prod-rainbow', url: src('prod-rainbow'), alt: 'A box of rainbow-coloured filled bonbons' },
  { id: 'prod-caramel', url: src('prod-caramel'), alt: 'A box of salted-caramel bonbons' },
  { id: 'prod-darkmilk', url: src('prod-darkmilk'), alt: 'A mixed box of dark and milk chocolate bonbons' },
  { id: 'prod-byo', url: src('prod-byo'), alt: 'A build-your-own selection box being filled with chocolates' },
  { id: 'prod-cocoabombs', url: src('prod-cocoabombs'), alt: 'Three hot-cocoa bombs beside a mug of hot milk' },
  { id: 'prod-pretzels', url: src('prod-pretzels'), alt: 'Chocolate-dipped pretzels with colourful drizzle' },
  { id: 'prod-marshmallow', url: src('prod-marshmallow'), alt: 'Chocolate-dipped marshmallow pops with sprinkles' },
  { id: 'prod-birthday', url: src('prod-birthday'), alt: 'A birthday gift box of chocolates with a candle and confetti' },
  { id: 'prod-kids', url: src('prod-kids'), alt: 'A kids treat bundle of fun-shaped chocolates' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A monthly treat subscription box tied with ribbon' },
  { id: 'post-giftbox', url: src('post-giftbox'), alt: 'A gift box being packed with an assortment of chocolates' },
  { id: 'post-cocoa', url: src('post-cocoa'), alt: 'A hot-cocoa bomb melting open in a mug of hot milk' },
  { id: 'post-makers', url: src('post-makers'), alt: 'Chocolatiers decorating trays of colourful bonbons' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-chocolate-playful: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one bright, colourful photograph, a rounded headline and a lead in a
 *  solid readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on
 *  the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('choc-hero'), alt: 'A colourful spread of bonbons and treats', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Chocolate, but make it fun.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Sweet Tooth Co. makes bright, colourful chocolate for people who like a bit of joy with their cocoa — jewel-coloured bonbons, hot-cocoa bombs, dipped treats and gift boxes packed to make someone’s day. Treats, gifts, and a little everyday happy.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the treats' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/products/subscription' },
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

/** One category tile — a photo with a label beneath, the whole tile a link. Playful hover:
 *  the tile scales up and tilts a touch. The image sits in an `overflow-hidden` rounded box so
 *  the scale stays inside the corner radius. */
function categoryTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
  return el('a', 'group flex flex-col gap-3', {
    attrs: { href: o.href },
    children: [
      el('div', 'overflow-hidden rounded-box bg-base-200', {
        children: [
          el(
            'img',
            'aspect-square w-full object-cover transition duration-200 group-hover:-rotate-2 group-hover:scale-105',
            { attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' } }
          ),
        ],
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
            text: 'Pick your treat',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'tile-boxes', label: 'Boxes', href: '/shop', alt: 'An open box of colourful bonbons' }),
              categoryTile({ assetId: 'tile-byo', label: 'Build your own', href: '/shop', alt: 'Choosing chocolates for a pick-your-own box' }),
              categoryTile({ assetId: 'tile-gifts', label: 'Gifts', href: '/shop', alt: 'A ribboned chocolate gift box' }),
              categoryTile({ assetId: 'tile-sub', label: 'Subscription', href: '/products/subscription', alt: 'A stack of bright chocolate boxes' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Treats trending now' }),
  editorialBand({
    heading: 'Made bright, made by hand',
    lead: 'Every bonbon is hand-shelled, hand-filled and hand-decorated in small colourful batches — because the fun is in the colour, and the colour is in the care. We use proper chocolate and real fillings, then make it look like a party.',
    assetId: 'band-make',
    cta: 'How we make them',
    href: '/blog/whats-in-a-bonbon',
    alt: 'A chocolatier piping colourful bonbon shells',
  }),
  productsBlock({ source: 'commerce.category.boxes', layout: 'carousel', heading: 'Bonbon boxes' }),
  editorialBand({
    heading: 'A little treat, every month',
    lead: 'A subscription is the good kind of habit: a fresh box of bright, seasonal treats lands on your doorstep on your schedule. Skip, swap or cancel any time — no lock-in, just something to look forward to (and yes, you can send it to someone else).',
    assetId: 'band-gift',
    cta: 'Start a subscription',
    href: '/products/subscription',
    alt: 'A wrapped treat box on a doorstep with a balloon',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static "made fresh, gift-ready" note, and policy links). */
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
                    text: 'Sweet Tooth Co.',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Made fresh, packed to delight' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Everything is made the week it ships and packed to arrive looking as good as it tastes — nestled, cushioned and travel-cool. Add a gift note at checkout and we’ll tuck in a hand-written card. Keep it somewhere cool (not the fridge) and enjoy within a month.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Add a little extra' });

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
    'Shop the treats',
    'Everything we’re making right now — bonbon boxes, a build-your-own selection, hot-cocoa bombs, dipped treats, gift boxes and the subscription. Filter by occasion or price, or sort however you like; it’s all made fresh and packed to travel.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The treats grouped the way people actually shop — what’s new, the boxes everyone comes back for, gifts ready to send, and the little treats that make a Tuesday better.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Sweet Tooth Co.', 'Looking for a flavour, a gift under $25, or a birthday box? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $40, and everything is made fresh and packed to arrive looking its best. Sending it as a gift? Add a note at checkout. Something not quite right? Tell us and we’ll make it good — treats should be pure joy, start to finish.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Sweet Tooth journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Fun from the kitchen — how to build the perfect gift box, the right way to melt a cocoa bomb, and how a bonbon actually gets its colour. Sweet, useful, no snobbery.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Sweet Tooth Co.' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Sweet Tooth Co. started at a market stall with a folding table, a tray of hand-piped bonbons, and a simple idea: chocolate is a treat, so it should feel like one. Not precious, not stuffy — bright, generous and a little bit silly, the kind of thing that makes a grown adult grin.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We use proper chocolate and real fillings — slow-cooked caramels, fresh fruit purées, actual vanilla — then we make it look like a party. Everything is hand-shelled, hand-filled and hand-decorated in small colourful batches, made the week it ships so it reaches you at its best.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Most of what we make is a gift for someone — a birthday, a thank-you, a “thinking of you.” So we pack every box to arrive looking as good as it tastes, and we’ll write the card for you. Treats, gifts, and a little everyday joy: that’s the whole job.',
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
    intro: 'A question about a flavour, a big order for a party or a wedding, or want a custom box with your colours on it? Tell us what you’re dreaming up and a real person at the kitchen will get right back to you.',
    submitLabel: 'Email the kitchen',
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

// A box of treats priced up by size — the same product, more of it. The shopper picks the box
// size, not a new product.
const BOX: OptionDecl = {
  name: 'Box size',
  displayType: 'dropdown',
  values: [{ value: '9 pieces' }, { value: '16 pieces' }, { value: '24 pieces' }],
};
const boxSizes = (sku: string, nine: number): Variant[] => [
  { sku: `${sku}-9`, priceCents: money(nine), isDefault: true, inventoryPolicy: 'continue', optionValues: { 'Box size': '9 pieces' } },
  { sku: `${sku}-16`, priceCents: money(Math.round(nine * 1.7)), inventoryPolicy: 'continue', optionValues: { 'Box size': '16 pieces' } },
  { sku: `${sku}-24`, priceCents: money(Math.round(nine * 2.4)), inventoryPolicy: 'continue', optionValues: { 'Box size': '24 pieces' } },
];

// A colourful bonbon box — the shop's hero product shape. Box size only; the flavour IS the box.
const box = (opts: {
  handle: string;
  title: string;
  description: string;
  nine: number;
  sku: string;
  collections: string[];
  tags: string[];
  asset: string;
  seoTitle: string;
  seoDescription: string;
}): Product => ({
  handle: opts.handle,
  title: opts.title,
  description: opts.description,
  status: 'active',
  productType: 'Chocolate box',
  vendor: 'Sweet Tooth Co.',
  tags: opts.tags,
  categoryHandles: ['boxes'],
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [BOX],
  variants: boxSizes(opts.sku, opts.nine),
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const PRODUCTS: Product[] = [
  box({
    handle: 'rainbow-bonbon-box',
    title: 'Rainbow Bonbon Box',
    description:
      'Our signature box and the one everyone photographs before they eat it — a jewel-bright assortment of hand-painted bonbons, every colour a different filling. Passionfruit yellow, raspberry pink, blueberry blue, salted-caramel gold, mint green and a dark-chocolate ganache. Proper chocolate, real fruit, and a lot of joy in a small box.',
    nine: 22,
    sku: 'STC-BON-RBW',
    collections: ['bestsellers', 'new-arrivals', 'bonbon-boxes'],
    tags: ['bonbons', 'colourful', 'assortment', 'best-seller'],
    asset: 'prod-rainbow',
    seoTitle: 'Rainbow Bonbon Box — hand-painted filled chocolates | Sweet Tooth Co.',
    seoDescription: 'A jewel-bright box of hand-painted bonbons, every colour a different filling. Boxes of 9, 16 or 24.',
  }),
  box({
    handle: 'salted-caramel-bonbons',
    title: 'Salted Caramel Bonbons',
    description:
      'For the caramel devotees. Slow-cooked salted caramel — properly dark, buttery and barely sweet — in a thin, snappy milk-chocolate shell with a flake of sea salt on top. The one flavour we can never make enough of, in a box of its own.',
    nine: 23,
    sku: 'STC-BON-CAR',
    collections: ['bestsellers', 'bonbon-boxes'],
    tags: ['bonbons', 'caramel', 'sea-salt'],
    asset: 'prod-caramel',
    seoTitle: 'Salted Caramel Bonbons — a box of the classic | Sweet Tooth Co.',
    seoDescription: 'Slow-cooked salted caramel in a snappy milk-chocolate shell with flaked sea salt. Boxes of 9, 16 or 24.',
  }),
  box({
    handle: 'dark-and-milk-mix',
    title: 'Dark & Milk Mix Box',
    description:
      'The crowd-pleaser for a room full of different tastes. Half rich dark-chocolate bonbons, half creamy milk — a mix of ganaches, pralines and caramels so everyone finds their favourite. The safe bet that still feels special: perfect for an office, a dinner party, or a “bring something” Sunday.',
    nine: 21,
    sku: 'STC-BON-MIX',
    collections: ['bonbon-boxes', 'party-pleasers'],
    tags: ['bonbons', 'assortment', 'crowd-pleaser'],
    asset: 'prod-darkmilk',
    seoTitle: 'Dark & Milk Mix Box — an assortment for everyone | Sweet Tooth Co.',
    seoDescription: 'Half dark, half milk — ganaches, pralines and caramels so everyone finds a favourite. Boxes of 9, 16 or 24.',
  }),
  {
    handle: 'build-your-own-box',
    title: 'Build-Your-Own Box',
    description:
      'Pick the size, we make it your box. Choose from the full flavour list at checkout — or leave it to us for a “maker’s choice” of what’s tasting best — and we hand-fill it, box it, and add a card if it’s a gift. The most fun you can have without licking the tray, and the surest way to get exactly what you love.',
    status: 'active',
    productType: 'Chocolate box',
    vendor: 'Sweet Tooth Co.',
    tags: ['build-your-own', 'custom', 'gift'],
    categoryHandles: ['build-your-own'],
    collectionHandles: ['new-arrivals', 'gifts-ready'],
    seoTitle: 'Build-Your-Own Box — pick your chocolates | Sweet Tooth Co.',
    seoDescription: 'Choose your size and your flavours and we hand-fill your box. Boxes of 9, 16 or 24, gift-ready.',
    options: [BOX],
    variants: boxSizes('STC-BYO', 24),
    images: [{ assetId: 'prod-byo', isPrimary: true, alt: 'A build-your-own selection box being filled' }],
  },
  {
    handle: 'hot-cocoa-bombs',
    title: 'Hot Cocoa Bombs',
    description:
      'The best bit of a winter evening: drop a bomb into a mug, pour over hot milk, and watch the shell melt open to spill cocoa and marshmallows into the cup. Each one is a hollow chocolate sphere packed with real drinking-chocolate and mini marshmallows. Comes as a set of three — Classic, Peppermint or Salted Caramel.',
    status: 'active',
    productType: 'Hot chocolate',
    vendor: 'Sweet Tooth Co.',
    tags: ['cocoa-bombs', 'hot-chocolate', 'fun', 'best-seller'],
    categoryHandles: ['gifts'],
    collectionHandles: ['bestsellers', 'new-arrivals', 'little-treats'],
    seoTitle: 'Hot Cocoa Bombs — melt-open hot chocolate spheres | Sweet Tooth Co.',
    seoDescription: 'Hollow chocolate spheres packed with drinking chocolate and marshmallows. Classic, Peppermint or Salted Caramel — set of three.',
    options: [
      { name: 'Flavour', displayType: 'dropdown', values: [{ value: 'Classic' }, { value: 'Peppermint' }, { value: 'Salted caramel' }] },
    ],
    variants: [
      { sku: 'STC-BOMB-CL', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue', optionValues: { Flavour: 'Classic' } },
      { sku: 'STC-BOMB-PM', priceCents: money(18), inventoryPolicy: 'continue', optionValues: { Flavour: 'Peppermint' } },
      { sku: 'STC-BOMB-SC', priceCents: money(19), inventoryPolicy: 'continue', optionValues: { Flavour: 'Salted caramel' } },
    ],
    images: [{ assetId: 'prod-cocoabombs', isPrimary: true, alt: 'Three hot-cocoa bombs beside a mug' }],
  },
  {
    handle: 'chocolate-dipped-pretzels',
    title: 'Chocolate-Dipped Pretzels',
    description:
      'Sweet, salty and impossible to stop at one. Crunchy pretzel rods dipped in thick chocolate and finished with a bright, playful drizzle and a scatter of sprinkles. A bag of ten, made to be shared (or not) — the snack that disappears fastest at every party we cater.',
    status: 'active',
    productType: 'Dipped treats',
    vendor: 'Sweet Tooth Co.',
    tags: ['dipped', 'pretzels', 'snack', 'sweet-and-salty'],
    categoryHandles: ['gifts'],
    collectionHandles: ['little-treats', 'party-pleasers'],
    seoTitle: 'Chocolate-Dipped Pretzels — sweet and salty | Sweet Tooth Co.',
    seoDescription: 'Crunchy pretzel rods dipped in thick chocolate with a playful drizzle and sprinkles. A bag of ten.',
    options: [
      { name: 'Chocolate', displayType: 'dropdown', values: [{ value: 'Milk' }, { value: 'Dark' }, { value: 'White drizzle' }] },
    ],
    variants: [
      { sku: 'STC-PRZ-MK', priceCents: money(14), isDefault: true, inventoryPolicy: 'continue', optionValues: { Chocolate: 'Milk' } },
      { sku: 'STC-PRZ-DK', priceCents: money(14), inventoryPolicy: 'continue', optionValues: { Chocolate: 'Dark' } },
      { sku: 'STC-PRZ-WH', priceCents: money(14), inventoryPolicy: 'continue', optionValues: { Chocolate: 'White drizzle' } },
    ],
    images: [{ assetId: 'prod-pretzels', isPrimary: true, alt: 'Chocolate-dipped pretzels with drizzle' }],
  },
  {
    handle: 'marshmallow-pops',
    title: 'Chocolate Marshmallow Pops',
    description:
      'Big fluffy marshmallows on a stick, dunked in chocolate and rolled in colourful sprinkles — the treat that turns any table into a party and keeps small hands very happy. A set of six, each a different sprinkle. Fun to hand out, fun to hand over, gone in about a minute.',
    status: 'active',
    productType: 'Dipped treats',
    vendor: 'Sweet Tooth Co.',
    tags: ['dipped', 'marshmallow', 'party', 'kids'],
    categoryHandles: ['gifts'],
    collectionHandles: ['little-treats', 'party-pleasers'],
    seoTitle: 'Chocolate Marshmallow Pops — party treats on a stick | Sweet Tooth Co.',
    seoDescription: 'Fluffy marshmallows dipped in chocolate and rolled in colourful sprinkles. A set of six.',
    variants: [{ sku: 'STC-MSH-POP', priceCents: money(16), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-marshmallow', isPrimary: true, alt: 'Chocolate-dipped marshmallow pops with sprinkles' }],
  },
  {
    handle: 'birthday-gift-box',
    title: 'The Birthday Box',
    description:
      'A birthday in a box, ready to send. A bright assortment of bonbons, a couple of marshmallow pops and a chocolate “Happy Birthday” plaque, packed in a confetti-lined keepsake box with a candle and a card you write at checkout. We do the wrapping; you take the credit.',
    status: 'active',
    productType: 'Gift box',
    vendor: 'Sweet Tooth Co.',
    tags: ['gift', 'birthday', 'set'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts-ready', 'bestsellers'],
    seoTitle: 'The Birthday Box — a birthday of chocolate, ready to send | Sweet Tooth Co.',
    seoDescription: 'Bonbons, marshmallow pops and a chocolate plaque in a confetti-lined box with a candle and a card.',
    variants: [{ sku: 'STC-GFT-BDY', priceCents: money(38), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-birthday', isPrimary: true, alt: 'A birthday gift box of chocolates with a candle' }],
  },
  {
    handle: 'kids-treat-bundle',
    title: 'Kids’ Treat Bundle',
    description:
      'Made for smaller sweet tooths (and the grown-ups who remember being one). Fun-shaped milk-chocolate treats, a couple of marshmallow pops and a mini hot-cocoa bomb, all in a colourful lunchbox-style tin they’ll keep afterwards. Nut-free and made to be shared — the after-school win or the party-bag upgrade.',
    status: 'active',
    productType: 'Gift box',
    vendor: 'Sweet Tooth Co.',
    tags: ['gift', 'kids', 'nut-free', 'bundle'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts-ready', 'little-treats'],
    seoTitle: 'Kids’ Treat Bundle — fun-shaped chocolate in a keepsake tin | Sweet Tooth Co.',
    seoDescription: 'Fun-shaped chocolates, marshmallow pops and a mini cocoa bomb in a colourful tin. Nut-free.',
    variants: [{ sku: 'STC-GFT-KIDS', priceCents: money(26), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-kids', isPrimary: true, alt: 'A kids treat bundle of fun-shaped chocolates' }],
  },
  {
    handle: 'subscription',
    title: 'Treat Subscription',
    description:
      'A fresh box of bright, seasonal treats on your doorstep every month — a new mix each time, chosen from what’s tasting (and looking) best, with a note on what’s inside. Pick one box or two, and skip, swap or cancel any time. The easiest present to keep giving, including to yourself.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Sweet Tooth Co.',
    tags: ['subscription', 'gift'],
    categoryHandles: ['subscription'],
    collectionHandles: ['new-arrivals', 'gifts-ready', 'bestsellers'],
    seoTitle: 'Treat Subscription — a fresh box of chocolate every month | Sweet Tooth Co.',
    seoDescription: 'A flexible monthly treat subscription — a new seasonal mix each time; skip, swap or cancel any time.',
    options: [
      { name: 'Plan', displayType: 'dropdown', values: [{ value: 'One box' }, { value: 'Two boxes' }] },
    ],
    variants: [
      { sku: 'STC-SUB-1', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: 'One box' } },
      { sku: 'STC-SUB-2', priceCents: money(44), inventoryPolicy: 'continue', optionValues: { Plan: 'Two boxes' } },
    ],
    images: [{ assetId: 'prod-subscription', isPrimary: true, alt: 'A monthly treat subscription box' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'boxes', name: 'Boxes', description: 'Colourful bonbon and assortment boxes.', featured: true },
    { handle: 'build-your-own', name: 'Build your own', description: 'Pick your size and your flavours.', featured: true },
    { handle: 'gifts', name: 'Gifts', description: 'Cocoa bombs, dipped treats and ready-to-send boxes.', featured: true },
    { handle: 'subscription', name: 'Subscription', description: 'A fresh box of treats every month.', featured: true },
  ],
  collections: [
    {
      handle: 'bestsellers',
      name: 'Best sellers',
      description: 'The treats everyone comes back for.',
      type: 'manual',
      featured: true,
      productHandles: ['rainbow-bonbon-box', 'salted-caramel-bonbons', 'hot-cocoa-bombs', 'birthday-gift-box', 'subscription'],
    },
    {
      handle: 'new-arrivals',
      name: 'Fresh & fun',
      description: 'The newest treats off the bench.',
      type: 'manual',
      featured: true,
      productHandles: ['rainbow-bonbon-box', 'build-your-own-box', 'hot-cocoa-bombs', 'subscription'],
    },
    {
      handle: 'gifts-ready',
      name: 'Ready to send',
      description: 'Boxes packed, wrapped and gift-ready.',
      type: 'manual',
      featured: true,
      productHandles: ['build-your-own-box', 'birthday-gift-box', 'kids-treat-bundle', 'subscription'],
    },
    {
      handle: 'bonbon-boxes',
      name: 'Bonbon boxes',
      description: 'Hand-painted filled chocolates, by the box.',
      type: 'manual',
      featured: false,
      productHandles: ['rainbow-bonbon-box', 'salted-caramel-bonbons', 'dark-and-milk-mix'],
    },
    {
      handle: 'party-pleasers',
      name: 'Party pleasers',
      description: 'For a room full of different tastes.',
      type: 'manual',
      featured: false,
      productHandles: ['dark-and-milk-mix', 'chocolate-dipped-pretzels', 'marshmallow-pops'],
    },
    {
      handle: 'little-treats',
      name: 'Little treats',
      description: 'Small joys that make a Tuesday better.',
      type: 'manual',
      featured: false,
      productHandles: ['hot-cocoa-bombs', 'chocolate-dipped-pretzels', 'marshmallow-pops', 'kids-treat-bundle'],
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
    slug: 'how-to-build-the-perfect-gift-box',
    status: 'published',
    body: {
      title: 'How to build the perfect gift box',
      excerpt: 'A gift box is a tiny bit of theatre. Here’s how we pack one that makes someone gasp before they’ve even tasted anything.',
      featuredImage: { $asset: 'post-giftbox' },
      body: {
        type: 'doc',
        content: [
          para('A box of chocolate is one of the easiest gifts to get right and one of the easiest to make special. The chocolate does most of the work — but a little thought about who it’s for, and how it’s packed, turns a nice present into one they remember. Here’s how we think about it when we build a box for you.'),
          h2('Start with the person, not the chocolate'),
          para('Before you pick a single flavour, picture the person. A caramel obsessive wants a box that leans caramel, not a polite one of everything. A first-time chocolate gift for someone whose tastes you don’t know is the moment for a bright, mixed assortment — the Rainbow Box exists precisely so you can’t get it wrong. Kids want fun shapes and sprinkles far more than they want a 70% single origin. Match the box to the mouth and you’re already most of the way there.'),
          h2('Mix textures, not just flavours'),
          para('The best boxes have contrast built in. A soft ganache next to a snappy caramel next to a crunchy dipped pretzel keeps every bite interesting — a box of nine identical truffles, however good, gets samey by the fifth. When you build your own, we’ll nudge you toward a spread of textures on purpose. It’s the difference between “these are lovely” and “I couldn’t stop.”'),
          h2('Let us do the wrapping'),
          para('Half the gift is the moment the lid comes off. We nestle every piece, line the box, tie the ribbon and — if you add a note at checkout — tuck in a hand-written card. You don’t have to do a thing except decide who’s lucky enough to get it. Add the gift note, and it arrives looking like you tried much harder than pressing “buy.”'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'the-right-way-to-melt-a-cocoa-bomb',
    status: 'published',
    body: {
      title: 'The right way to melt a hot-cocoa bomb',
      excerpt: 'It’s the best thirty seconds in a mug — if you do it in the right order. A tiny, fun how-to.',
      featuredImage: { $asset: 'post-cocoa' },
      body: {
        type: 'doc',
        content: [
          para('A hot-cocoa bomb is equal parts drink and magic trick: a hollow chocolate sphere that melts open when hot milk hits it, releasing the cocoa and marshmallows hiding inside. It’s genuinely delightful — and it works far better if you don’t rush it. Here’s the order of operations for the full show.'),
          h2('Hot milk, not boiling'),
          para('Heat your milk until it’s steaming and hot to the touch, but pull it before a rolling boil — boiling milk can scorch and go skinny, and you want it silky. Whole milk or a barista-style oat milk gives the richest cup; the fat is what makes it feel like a treat rather than a hot drink.'),
          h2('Bomb in the mug first, then pour'),
          para('This is the whole secret: put the cocoa bomb in the mug before the milk, not after. Pour the hot milk slowly straight over the top, and give it a few seconds — you’ll see the shell soften, crack and open, and the marshmallows bob up. Pouring the milk first and dropping the bomb in after just makes it float sadly. Order matters.'),
          h2('Stir, and make it yours'),
          para('Once it’s opened, stir well to bring all that drinking chocolate up off the bottom into a glossy, even cup. Then dress it up if you like: a swirl of whipped cream, a dusting of cocoa, a candy cane in the Peppermint one. Two minutes of work, one very good mug, and a small crowd every single time you make one in front of someone.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'whats-in-a-bonbon',
    status: 'published',
    body: {
      title: 'What’s actually in a bonbon (and where the colour comes from)',
      excerpt: 'Those bright, glossy shells aren’t painted with anything weird. Here’s how a bonbon really gets made — and coloured.',
      featuredImage: { $asset: 'post-makers' },
      body: {
        type: 'doc',
        content: [
          para('People often assume our jewel-bright bonbons are airbrushed with something artificial. They’re not — the colour is coloured cocoa butter, the same cocoa butter that’s already in the chocolate, just tinted. Here’s what actually goes into one of those little shells, start to finish.'),
          h2('The shell, and the colour'),
          para('We start with a polished mould and flick or brush tinted cocoa butter into each cavity — that’s where the colour and the pattern come from, painted in before any chocolate goes near it. Then we fill the mould with tempered chocolate, tip most of it back out, and let a thin shell set against the sides. The colour ends up on the outside of the shell, which is why it looks painted: because, in a sense, it is.'),
          h2('The filling is the flavour'),
          para('Into each set shell goes the good bit: a ganache, a caramel, a fruit purée, a praline. This is where a bonbon actually tastes of something — passionfruit, raspberry, salted caramel, mint. We make the fillings in small batches with real ingredients, because a beautiful shell around a dull centre is just decoration. Then we cap each one with a final layer of chocolate to seal it.'),
          h2('The snap you can hear'),
          para('Finally it’s all about temper. Well-tempered chocolate sets hard and glossy, releases cleanly from the mould, and snaps with a click when you bite it. That snap isn’t just satisfying — it’s the sign the chocolate was handled properly. So a good bonbon is three things at once: a pretty shell, a real filling, and a clean snap. Get all three and you’ve got the thing people photograph before they eat it.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-chocolate-playful',
  key: 'sparx-retail-chocolate-playful',
  name: 'sparx — Chocolate & Sweets (Playful)',
  theme: THEME,
  summary:
    'A complete, working shop for a bright, gift-forward chocolate & sweets maker: colourful bonbon boxes, a build-your-own selection, hot-cocoa bombs, dipped treats, a birthday box, a kids’ bundle and a flexible subscription, with categories, collections, a bespoke PDP and a fully merchandised home page. Joyful sweet-shop theme — vanilla cream, a raspberry candy primary, a berry-grape pop accent, a rounded display and playful hovers. Shipped as Sweet Tooth Co.',
  tagline: 'A bright, working storefront for a playful chocolate & sweets shop.',
  vertical: 'retail',
  industry: 'Chocolate & sweet shop',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 82,
  brand: {
    businessName: 'Sweet Tooth Co.',
    tagline: 'Chocolate, but make it fun.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Sweet Tooth Co. — bright, gift-forward chocolate & sweets',
      description:
        'Sweet Tooth Co. makes colourful chocolate for people who like a bit of joy — hand-painted bonbons, hot-cocoa bombs, dipped treats, gift boxes and a monthly subscription. Treats, gifts, and a little everyday joy.',
    },
    about: {
      title: 'About Sweet Tooth Co.',
      description:
        'How Sweet Tooth Co. makes it — proper chocolate, real fillings, hand-shelled and hand-decorated in small colourful batches, packed to arrive looking as good as it tastes.',
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
