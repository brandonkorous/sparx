// sparx-retail-candle-modern — a RETAIL/COMMERCE site template: a modern, clean candle &
// home-fragrance studio.
//
// The BRIGHT counterpart to the moody `retail-candle-apothecary`. Same family, same shared
// harness, opposite mood: where the apothecary is candlelit and dark in both modes, this one
// is light, fresh and airy — a pale near-white blush ground, a single sage accent, a clean
// grotesk, and big open product photography. A complete, working shop the moment it installs:
// a real catalogue (clean-fragrance candles with scent options, a ceramic travel candle, a
// reed diffuser, a room spray, a refill, a matches set and gift sets), categories +
// collections, a bespoke bright PDP, and the full 9-page commerce site (home merchandising →
// shop → collections → cart → search → journal → about → contact). Shipped as Lumen.
//
// DNA — modern clean wellness. A LIGHT blush-white ground in both modes, sage/eucalyptus as
// the single fresh identity hue, a clean grotesk over a geometric sans, split (not full-bleed)
// heroes and bands so the layout breathes, and a "clean fragrance, honestly made" voice —
// coconut-soy wax, phthalate-free, cotton wicks, refillable vessels. Because the ground is
// light, `secondary` is DARK and legible on it and the deep status set carries the light mode
// — the same discipline the paper-ground themes (`boutique`, `clinic`) follow.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme inline
// and passes it on the spec (`theme`), so the family can be authored in parallel with no two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-candle-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-candle-modern/**" \
//     "marketplace-catalog/_gen/gen-retail-candle-modern.ts"
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
// A modern, clean studio: a pale blush-white ground stepping gently down into soft warm
// greys, a deep sage-charcoal ink, a sage/eucalyptus PRIMARY (a deep readable fill) and a
// fresh teal ACCENT (kept ≤ ~48% L so it clears AA as link text on the pale ground), under a
// clean grotesk display over a geometric sans. LIGHT in both modes (fresh, not candlelit), so
// `secondary` is DARK and legible and the deep status set carries the light mode. Complete
// light + dark, AA on every role (the blueprint sweep's contrast check is the gate).
const THEME = defineTheme({
  name: 'lumen-clean',
  type: { body: face('Manrope', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.5rem', box: '1rem', depth: '0' },
  light: {
    surfaces: ['oklch(98% 0.008 40)', 'oklch(96% 0.012 38)', 'oklch(91% 0.016 34)', 'oklch(26% 0.02 150)'],
    roles: {
      primary: 'oklch(46% 0.085 155)',
      secondary: 'oklch(42% 0.028 150)',
      accent: 'oklch(48% 0.1 185)',
      neutral: 'oklch(30% 0.018 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(22% 0.012 150)', 'oklch(19% 0.012 150)', 'oklch(16% 0.012 150)', 'oklch(95% 0.008 90)'],
    roles: {
      primary: 'oklch(82% 0.1 155)',
      secondary: 'oklch(80% 0.035 150)',
      accent: 'oklch(80% 0.11 185)',
      neutral: 'oklch(30% 0.018 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "lumen-hero": "https://images.unsplash.com/photo-1567001897431-ba86def22f6e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlJTIwcGFsZSUyMGNhbmRsZSUyMGJyaWdodCUyMHN1bmxpdCUyMHRhYmxlJTIwYmVzaWRlfGVufDB8MHx8fDE3ODY0MDQ3OTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumen-tile-candles": "https://images.unsplash.com/photo-1585997089743-5a6b246fc80b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm93JTIwbWluaW1hbGlzdCUyMG1hdHRlJTIwY2FuZGxlcyUyMGNsZWFuJTIwd2hpdGUlMjBzaGVsZnxlbnwwfDB8fHwxNzg2NDA0Nzk1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumen-tile-diffusers": "https://images.unsplash.com/photo-1783275463520-1e495760369d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVlZCUyMGRpZmZ1c2VyJTIwcm9vbXxlbnwwfDB8fHwxNzg2NDA1MTQ1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumen-tile-refills": "https://images.unsplash.com/photo-1613161645210-13013d811d30?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVmaWxsJTIwcG91Y2glMjBiZXNpZGUlMjBlbXB0eSUyMGNlcmFtaWMlMjBjYW5kbGUlMjB2ZXNzZWx8ZW58MHwwfHx8MTc4NjQwNDgwMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumen-tile-gifts": "https://images.unsplash.com/photo-1759563871375-d5b140f6646e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FuZGxlJTIwZ2lmdCUyMHNldCUyMHdyYXBwZWQlMjBwYWxlJTIwcGFwZXIlMjBjb3R0b258ZW58MHwwfHx8MTc4NjQwNDgwNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumen-band-clean": "https://images.unsplash.com/photo-1777107509014-e3eaea7981bc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29jb251dC1zb3klMjB3YXglMjBjb3R0b24lMjB3aWNrJTIwY2xlYW4lMjBicmlnaHQlMjB3b3Jrc2hvcHxlbnwwfDB8fHwxNzg2NDA0ODA3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "lumen-band-refill": "https://images.unsplash.com/photo-1643701322328-d671ab7814a3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVmaWxsJTIwYmVpbmclMjBwb3VyZWQlMjBpbnRvJTIwcmV1c2FibGUlMjBjZXJhbWljJTIwdmVzc2VsfGVufDB8MHx8fDE3ODY0MDQ4MTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-everyday": "https://images.unsplash.com/photo-1602607203588-d6d0eda790e3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXZlcnlkYXklMjBjYW5kbGUlMjBtYXR0ZSUyMHBhbGUlMjB2ZXNzZWx8ZW58MHwwfHx8MTc4NjQwNDgxNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-travel": "https://images.unsplash.com/photo-1602607203475-c5e99918dfc5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2VyYW1pYyUyMHRyYXZlbCUyMGNhbmRsZSUyMG1hdHRlJTIwbGlkfGVufDB8MHx8fDE3ODY0MDQ4MTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-diffuser": "https://images.unsplash.com/photo-1750433101196-604c1741a012?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVlZCUyMGRpZmZ1c2VyJTIwZnJvc3RlZCUyMGNsZWFyJTIwYm90dGxlfGVufDB8MHx8fDE3ODY0MDQ4MjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-spray": "https://images.unsplash.com/photo-1764395294549-686b3808320f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9vbSUyMHNwcmF5JTIwZnJvc3RlZCUyMGdsYXNzJTIwYm90dGxlfGVufDB8MHx8fDE3ODY0MDQ4MjN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-refill": "https://images.unsplash.com/photo-1705242960887-4cb848cc406d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FuZGxlJTIwcmVmaWxsJTIwcmVjeWNsZWQlMjBrcmFmdCUyMHBvdWNofGVufDB8MHx8fDE3ODY0MDQ4MjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-discovery": "https://images.unsplash.com/photo-1773379412337-e959c8d8d60f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGlzY292ZXJ5JTIwZm91ciUyMG1pbml8ZW58MHwwfHx8MTc4NjQwNTE1MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-trio": "https://images.unsplash.com/photo-1759227860767-890fffb86f5b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2lmdCUyMHRyaW8lMjB0aHJlZXxlbnwwfDB8fHwxNzg2NDA1MTUzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-ingredients": "https://images.unsplash.com/photo-1777107857760-b04f791fe4df?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2F4JTIwZnJhZ3JhbmNlJTIwb2lsJTIwY290dG9uJTIwd2ljayUyMGxhaWQlMjBvdXR8ZW58MHwwfHx8MTc4NjQwNDgzNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-refill": "https://images.unsplash.com/photo-1614835482670-650d049490ba?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZW1wdHklMjB2ZXNzZWwlMjBiZWluZyUyMGNsZWFuZWQlMjByZS1wb3VyZWQlMjByZWZpbGx8ZW58MHwwfHx8MTc4NjQwNDgzOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-styling": "https://images.unsplash.com/photo-1617283410420-76fd3d910621?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGl0JTIwY2FuZGxlJTIwc3R5bGVkJTIwYnJpZ2h0JTIwc2hlbGYlMjBib29rcyUyMHBsYW50fGVufDB8MHx8fDE3ODY0MDQ4NDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'lumen-hero', url: src('lumen-hero'), alt: 'A single pale candle on a bright sunlit table beside a linen napkin' },
  { id: 'lumen-tile-candles', url: src('lumen-tile-candles'), alt: 'A row of minimalist matte candles on a clean white shelf' },
  { id: 'lumen-tile-diffusers', url: src('lumen-tile-diffusers'), alt: 'A reed diffuser and a room spray on a bright windowsill' },
  { id: 'lumen-tile-refills', url: src('lumen-tile-refills'), alt: 'A refill pouch beside an empty ceramic candle vessel' },
  { id: 'lumen-tile-gifts', url: src('lumen-tile-gifts'), alt: 'A candle gift set wrapped in pale paper and cotton ribbon' },
  { id: 'lumen-band-clean', url: src('lumen-band-clean'), alt: 'Coconut-soy wax and a cotton wick in a clean bright workshop' },
  { id: 'lumen-band-refill', url: src('lumen-band-refill'), alt: 'A refill being poured into a reusable ceramic vessel in daylight' },
  { id: 'prod-everyday', url: src('prod-everyday'), alt: 'The Everyday Candle in a matte pale vessel' },
  { id: 'prod-travel', url: src('prod-travel'), alt: 'A ceramic travel candle with a matte lid' },
  { id: 'prod-diffuser', url: src('prod-diffuser'), alt: 'A reed diffuser in a frosted clear bottle' },
  { id: 'prod-spray', url: src('prod-spray'), alt: 'A room spray in a frosted glass bottle' },
  { id: 'prod-refill', url: src('prod-refill'), alt: 'A candle refill in a recycled kraft pouch' },
  { id: 'prod-matches', url: src('prod-matches'), alt: 'A box of long matches with pale tips' },
  { id: 'prod-discovery', url: src('prod-discovery'), alt: 'A discovery set of four mini candles in a pale tray' },
  { id: 'prod-trio', url: src('prod-trio'), alt: 'A gift trio of three candles boxed in pale paper' },
  { id: 'post-ingredients', url: src('post-ingredients'), alt: 'Wax, fragrance oil and a cotton wick laid out on a bright bench' },
  { id: 'post-refill', url: src('post-refill'), alt: 'An empty vessel being cleaned and re-poured with a refill' },
  { id: 'post-styling', url: src('post-styling'), alt: 'A lit candle styled on a bright shelf with books and a plant' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-candle-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A SPLIT hero — text on a solid pale panel beside one big airy product photo, never ink on
 *  the photo. The split (rather than the apothecary's full-bleed photo-behind-a-panel) is what
 *  makes this read bright and modern instead of candlelit. */
function hero(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-24', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl items-center gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          el('div', 'flex flex-col items-start gap-6', {
            children: [
              el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                text: 'Clean fragrance, for the light everyday.',
              }),
              el('p', 'max-w-md text-lg leading-relaxed text-base-content', {
                text: 'Lumen is a small home-fragrance studio making candles the honest way — coconut-soy wax, cotton wicks, phthalate-free scent, and vessels built to be refilled rather than thrown out. Fragrance that smells fresh and clean, with nothing to hide on the label.',
              }),
              el('div', 'flex flex-wrap items-center gap-4', {
                children: [
                  el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop candles' }),
                  el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                    attrs: { href: '/shop/refills' },
                    text: 'Refill your vessel',
                  }),
                ],
              }),
            ],
          }),
          el('img', 'aspect-square w-full rounded-box bg-base-200 object-cover', {
            attrs: { src: assetUrl('lumen-hero'), alt: 'A pale candle on a bright sunlit table', loading: 'lazy' },
          }),
        ],
      }),
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
            text: 'Find your everyday scent',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'lumen-tile-candles', label: 'Candles', href: '/shop', alt: 'A row of minimalist candles' }),
              categoryTile({ assetId: 'lumen-tile-diffusers', label: 'Diffusers & sprays', href: '/shop', alt: 'A diffuser and a room spray' }),
              categoryTile({ assetId: 'lumen-tile-refills', label: 'Refills', href: '/shop/refills', alt: 'A refill pouch and an empty vessel' }),
              categoryTile({ assetId: 'lumen-tile-gifts', label: 'Gifts', href: '/shop', alt: 'A wrapped candle gift set' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A clean three-up promise strip — the wellness proof points, each a short colored label over
 *  a plain line. Adds the fresh accent as scannable signal and breaks the page rhythm without a
 *  photo. */
function promiseStrip(): Node {
  const item = (label: string, body: string): Node =>
    el('div', 'flex flex-col gap-2', {
      children: [
        el('h3', 'text-lg font-bold tracking-tight text-accent', { text: label }),
        el('p', 'text-base leading-relaxed text-base-content', { text: body }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-14', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-8 @3xl:grid-cols-3 @3xl:gap-12', {
        children: [
          item(
            'Coconut-soy wax',
            'A clean coconut-soy blend with cotton wicks — a slow, even burn and no paraffin soot on the ceiling.'
          ),
          item(
            'Phthalate-free scent',
            'Fragrance blended without phthalates or parabens, and a full ingredient list on every product. Nothing hidden.'
          ),
          item(
            'Made to be refilled',
            'Every vessel is built to be washed and refilled — buy the candle once, then top it up for less, forever.'
          ),
        ],
      }),
    ],
  });
}

/** A SPLIT editorial band — one photo beside a text card on a soft surface, alternating side.
 *  Bright and airy where the apothecary's band is a dim full-bleed photo. */
function featureSplit(o: {
  heading: string;
  lead: string;
  assetId: string;
  cta: string;
  href: string;
  alt: string;
  reverse?: boolean;
  surface?: '100' | '200';
}): Node {
  const image = el('img', 'aspect-square w-full rounded-box bg-base-200 object-cover', {
    attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
  });
  const text = el('div', 'flex flex-col items-start gap-4', {
    children: [
      el('h2', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl', { text: o.heading }),
      el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
      el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
        attrs: { href: o.href },
        text: o.cta,
      }),
    ],
  });
  return el('section', `bg-base-${o.surface ?? '100'} @container px-6 py-16 @3xl:py-20`, {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl items-center gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: o.reverse ? [text, image] : [image, text],
      }),
    ],
  });
}

const HOME: Node[] = [
  hero(),
  categoryTiles(),
  promiseStrip(),
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New this season' }),
  featureSplit({
    heading: 'Clean fragrance, honestly made',
    lead: 'We pour in coconut-soy wax with cotton wicks, blend our scents phthalate-free, and print the whole ingredient list on every candle. No mystery “fragrance,” no soot, no guessing what you’re breathing in — just a clean, even burn and a scent that stays true from the first hour to the last.',
    assetId: 'lumen-band-clean',
    cta: 'What’s in a Lumen candle',
    href: '/blog/whats-in-a-lumen-candle',
    alt: 'Coconut-soy wax and a cotton wick in a bright workshop',
    surface: '100',
  }),
  productsBlock({ source: 'commerce.category.candles', layout: 'carousel', heading: 'The candles' }),
  featureSplit({
    heading: 'Buy the candle once. Refill it forever.',
    lead: 'Every Lumen vessel is made to be washed out and poured again. When a candle burns down, a refill drops straight back in — same ceramic, same shelf, a little less money and a lot less waste. It’s the easy, quiet way to keep a home smelling good without a bin full of glass.',
    assetId: 'lumen-band-refill',
    cta: 'Shop refills',
    href: '/shop/refills',
    alt: 'A refill being poured into a reusable ceramic vessel in daylight',
    reverse: true,
    surface: '200',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static "clean by design" note, and policy links). */
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
                    text: 'Lumen',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Clean by design' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Coconut-soy wax, a lead-free cotton wick and phthalate-free fragrance — the full ingredient list is on the box. Roughly a 45-hour burn. Trim the wick to a quarter inch before each light, and when it’s done, wash the vessel and drop in a refill.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Goes well with' });

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
    'The whole studio',
    'Every candle, diffuser, spray, refill and gift we make — poured in small batches in coconut-soy wax, blended phthalate-free, and built to be refilled. Filter by scent or format, or sort however you like.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead(
    'Collections',
    'The range grouped the way people actually shop — what’s new this season, the best-sellers, flame-free fragrance for every room, and the refills that keep a vessel going.'
  ),
];
const SEARCH: Node[] = [
  pageMasthead('Search Lumen', 'Looking for a scent, a format, or a refill? Search the whole studio and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $50, and everything ships in plastic-free, recyclable packaging. Changed your mind on a scent? Tell us within 30 days and we’ll swap it — clean fragrance should feel good all the way through.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Lumen journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the studio — what actually goes into a clean candle, how the refill system works, and how to get every even hour out of a burn. Plain, honest, no wellness fog.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Lumen' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Lumen started with a simple, slightly annoyed question: why is it so hard to find out what’s actually in a candle? Most of them list one word — “fragrance” — and burn a black ring onto the ceiling. We wanted the opposite: a candle we could read the whole label of, that smelled clean and fresh and burned without leaving anything behind.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'So everything is poured by hand in a coconut-soy blend, with lead-free cotton wicks and fragrance we blend phthalate- and paraben-free, then tested for weeks before a scent earns a place. We print the full ingredient list on every box, and we design each vessel to be washed out and refilled — because the cleanest candle is also the one you don’t throw away.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No mystery scent, no soot, no landfill of empty glass. Just bright, honest fragrance for ordinary days — and a refill waiting when it burns down.',
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
    intro: 'Questions about a scent, a refill, or a wholesale order for your shop or hotel? Tell us what you’re after and a real person at the studio will write back.',
    submitLabel: 'Email the studio',
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

// The scent library is the browsing axis — a shopper picks a fresh, clean scent, not a
// candle-with-a-name. Every scented product offers the same four, so a favorite carries across
// candles, diffusers, sprays and refills.
const SCENT_VALUES = ['Fresh Linen', 'Wild Sage', 'Sea Air', 'Pink Grapefruit'] as const;
const SCENT_ABBR: Record<(typeof SCENT_VALUES)[number], string> = {
  'Fresh Linen': 'LIN',
  'Wild Sage': 'SGE',
  'Sea Air': 'SEA',
  'Pink Grapefruit': 'GRP',
};
const SCENT: OptionDecl = {
  name: 'Scent',
  displayType: 'dropdown',
  values: SCENT_VALUES.map((value) => ({ value })),
};
const SIZE: OptionDecl = {
  name: 'Size',
  displayType: 'dropdown',
  values: [{ value: '8 oz' }, { value: '11 oz' }],
};

/** A scent-only product (travel candle, diffuser, spray, refill) — one price, four scents. */
const scented = (opts: {
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
}): Product => ({
  handle: opts.handle,
  title: opts.title,
  description: opts.description,
  status: 'active',
  productType: opts.productType,
  vendor: 'Lumen',
  tags: opts.tags,
  categoryHandles: opts.categories,
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [SCENT],
  variants: SCENT_VALUES.map((scent, i) => ({
    sku: `${opts.sku}-${SCENT_ABBR[scent]}`,
    priceCents: money(opts.price),
    isDefault: i === 0,
    inventoryPolicy: 'continue',
    optionValues: { Scent: scent },
  })),
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const PRODUCTS: Product[] = [
  // The flagship — Scent × Size, the fullest variant matrix in the catalogue.
  {
    handle: 'everyday-candle',
    title: 'The Everyday Candle',
    description:
      'The one that lives on the shelf and gets lit most nights. A clean, room-filling burn in a matte ceramic vessel, poured in coconut-soy wax with a cotton wick. Pick a scent and a size — the 8 oz for a bedroom or desk, the 11 oz for a living room that needs to carry.',
    status: 'active',
    productType: 'Candle',
    vendor: 'Lumen',
    tags: ['candle', 'signature', 'refillable', 'coconut-soy'],
    categoryHandles: ['candles'],
    collectionHandles: ['new-arrivals', 'best-sellers', 'the-scents'],
    seoTitle: 'The Everyday Candle — clean coconut-soy candle | Lumen',
    seoDescription: 'A clean, room-filling coconut-soy candle in a refillable matte vessel. Four fresh scents, two sizes.',
    options: [SCENT, SIZE],
    variants: SCENT_VALUES.flatMap((scent) =>
      SIZE.values.map((size) => ({
        sku: `LUMEN-EVERYDAY-${SCENT_ABBR[scent]}-${size.value === '8 oz' ? '8' : '11'}`,
        priceCents: money(size.value === '8 oz' ? 34 : 46),
        isDefault: scent === 'Fresh Linen' && size.value === '8 oz',
        inventoryPolicy: 'continue' as const,
        optionValues: { Scent: scent, Size: size.value },
      }))
    ),
    images: [{ assetId: 'prod-everyday', isPrimary: true, alt: 'The Everyday Candle in a matte pale vessel' }],
  },
  scented({
    handle: 'travel-candle',
    title: 'Ceramic Travel Candle',
    description:
      'A smaller candle with a press-on ceramic lid — made to go from a bag to a bedside table to a rented bathroom without a mess. Same clean coconut-soy pour as the Everyday, in a pocketable 4 oz. The one that makes anywhere smell like your place.',
    price: 24,
    sku: 'LUMEN-TRAVEL',
    productType: 'Candle',
    categories: ['candles'],
    collections: ['new-arrivals', 'the-scents'],
    tags: ['candle', 'travel', 'coconut-soy'],
    asset: 'prod-travel',
    seoTitle: 'Ceramic Travel Candle — lidded coconut-soy candle | Lumen',
    seoDescription: 'A lidded 4 oz coconut-soy travel candle that goes anywhere cleanly. Four fresh scents.',
  }),
  scented({
    handle: 'reed-diffuser',
    title: 'The Reed Diffuser',
    description:
      'Fragrance with no flame to think about. Natural rattan reeds draw the scent up into the room for a low, constant throw that lasts three to four months — ideal for a hallway, a bathroom or anywhere a candle never quite gets lit. Alcohol-light, so it freshens without the sharp edge.',
    price: 42,
    sku: 'LUMEN-DIFF',
    productType: 'Diffuser',
    categories: ['diffusers'],
    collections: ['new-arrivals', 'best-sellers', 'flame-free'],
    tags: ['diffuser', 'flameless'],
    asset: 'prod-diffuser',
    seoTitle: 'The Reed Diffuser — flame-free home fragrance | Lumen',
    seoDescription: 'Natural rattan reeds and a clean scent for a low, constant throw that lasts months. Four scents.',
  }),
  scented({
    handle: 'room-spray',
    title: 'The Room Spray',
    description:
      'A quick change of air in a spritz — for the sofa, the entryway, or the minute before a guest arrives. A fine, water-based mist that lifts a room and settles fast, without hanging heavy or coating a surface. Phthalate-free, like everything we make.',
    price: 22,
    sku: 'LUMEN-SPRAY',
    productType: 'Room spray',
    categories: ['diffusers'],
    collections: ['flame-free'],
    tags: ['spray', 'flameless'],
    asset: 'prod-spray',
    seoTitle: 'The Room Spray — clean water-based room mist | Lumen',
    seoDescription: 'A fine, water-based room mist that lifts a room and settles fast. Phthalate-free, four scents.',
  }),
  scented({
    handle: 'candle-refill',
    title: 'The Candle Refill',
    description:
      'A fresh pour for a vessel you already own — the same clean coconut-soy candle, minus the ceramic, in a recycled kraft pouch. Wash out an empty Lumen, drop the refill in, and you’re set for another 45 hours for less money and no new glass. The whole point of the system.',
    price: 24,
    sku: 'LUMEN-REFILL',
    productType: 'Refill',
    categories: ['refills'],
    collections: ['refill-reuse', 'best-sellers'],
    tags: ['refill', 'sustainable', 'coconut-soy'],
    asset: 'prod-refill',
    seoTitle: 'The Candle Refill — refill your Lumen vessel | Lumen',
    seoDescription: 'A coconut-soy refill pour for a vessel you already own — less money, no new glass. Four scents.',
  }),
  {
    handle: 'long-matches',
    title: 'Long Matches',
    description:
      'The small thing that makes lighting a candle a pleasure instead of a fumble. Fifty long, pale-tipped matches in a minimalist matchbox with a striker on the side — long enough to reach the bottom of a burned-down jar without singeing a knuckle.',
    status: 'active',
    productType: 'Accessory',
    vendor: 'Lumen',
    tags: ['accessory', 'matches', 'gift'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gift-ready'],
    seoTitle: 'Long Matches — minimalist matchbox | Lumen',
    seoDescription: 'Fifty long, pale-tipped matches in a minimalist striker box. Reaches the bottom of any jar.',
    variants: [{ sku: 'LUMEN-MATCHES', priceCents: money(12), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-matches', isPrimary: true, alt: 'A box of long matches with pale tips' }],
  },
  {
    handle: 'discovery-set',
    title: 'The Discovery Set',
    description:
      'All four scents in mini form, in a pale recycled tray — the low-commitment way to find the one you’ll want as a full candle. Each mini burns about ten hours, plenty to test how a scent lives in your actual rooms. The credit comes back: the set’s price is refunded against your first full candle.',
    status: 'active',
    productType: 'Gift set',
    vendor: 'Lumen',
    tags: ['gift', 'set', 'sampler'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gift-ready', 'the-scents'],
    seoTitle: 'The Discovery Set — all four scents in mini | Lumen',
    seoDescription: 'All four Lumen scents as mini candles in a recycled tray. The easy way to find your one.',
    variants: [{ sku: 'LUMEN-DISCOVERY', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-discovery', isPrimary: true, alt: 'A discovery set of four mini candles' }],
  },
  {
    handle: 'gift-trio',
    title: 'The Signature Trio',
    description:
      'The easy yes — three full-size Everyday candles in Fresh Linen, Wild Sage and Sea Air, boxed in plastic-free pale board and tied in cotton ribbon, with a card you can write on. The whole clean range in one gift, ready to hand over.',
    status: 'active',
    productType: 'Gift set',
    vendor: 'Lumen',
    tags: ['gift', 'set', 'candle'],
    categoryHandles: ['gifts'],
    collectionHandles: ['new-arrivals', 'best-sellers', 'gift-ready'],
    seoTitle: 'The Signature Trio Gift Set — three candles | Lumen',
    seoDescription: 'Three full-size Everyday candles in Fresh Linen, Wild Sage and Sea Air, boxed and ribboned.',
    variants: [{ sku: 'LUMEN-GIFT-TRIO', priceCents: money(96), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-trio', isPrimary: true, alt: 'A gift trio of three candles boxed in pale paper' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'candles', name: 'Candles', description: 'Clean coconut-soy candles, refillable by design.', featured: true },
    { handle: 'diffusers', name: 'Diffusers & sprays', description: 'Flame-free fragrance for every room.', featured: true },
    { handle: 'refills', name: 'Refills', description: 'Top up a vessel you already own.', featured: true },
    { handle: 'gifts', name: 'Gifts', description: 'Ready-to-give sets and the small things.', featured: true },
  ],
  collections: [
    {
      handle: 'new-arrivals',
      name: 'New this season',
      description: 'The latest scents and formats.',
      type: 'manual',
      featured: true,
      productHandles: ['everyday-candle', 'travel-candle', 'reed-diffuser', 'gift-trio'],
    },
    {
      handle: 'best-sellers',
      name: 'Best-sellers',
      description: 'The ones people come back to refill.',
      type: 'manual',
      featured: true,
      productHandles: ['everyday-candle', 'reed-diffuser', 'candle-refill', 'gift-trio'],
    },
    {
      handle: 'the-scents',
      name: 'The four scents',
      description: 'Fresh Linen, Wild Sage, Sea Air and Pink Grapefruit — in every format.',
      type: 'manual',
      featured: false,
      productHandles: ['everyday-candle', 'travel-candle', 'discovery-set'],
    },
    {
      handle: 'flame-free',
      name: 'Flame-free',
      description: 'Fragrance without a flame — diffusers and room sprays.',
      type: 'manual',
      featured: true,
      productHandles: ['reed-diffuser', 'room-spray'],
    },
    {
      handle: 'refill-reuse',
      name: 'Refill & reuse',
      description: 'Keep the vessel, replace the candle.',
      type: 'manual',
      featured: false,
      productHandles: ['candle-refill'],
    },
    {
      handle: 'gift-ready',
      name: 'Gift-ready',
      description: 'Boxed, ribboned and ready to hand over.',
      type: 'manual',
      featured: true,
      productHandles: ['gift-trio', 'discovery-set', 'long-matches'],
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
    slug: 'whats-in-a-lumen-candle',
    status: 'published',
    body: {
      title: 'What’s actually in a Lumen candle',
      excerpt: 'Most candles list one ingredient: “fragrance.” Here’s our whole label, and why each thing on it is there.',
      featuredImage: { $asset: 'post-ingredients' },
      body: {
        type: 'doc',
        content: [
          para('Pick up almost any candle and read the box. If it lists ingredients at all, you’ll usually find one word — “fragrance” — standing in for a blend of dozens of compounds the maker doesn’t have to disclose. We think that’s backwards. A candle is something you burn in a closed room for hours, breathing the air it changes, so you ought to be able to read exactly what it’s made of. Here’s the whole list, and the reason for each part.'),
          h2('Coconut-soy wax and a cotton wick'),
          para('The wax is a coconut-soy blend. Straight soy is clean but can burn unevenly and struggle to throw scent; coconut wax carries fragrance beautifully and holds a smooth surface. Blended, they give a slow, even burn with a strong-but-not-cloying throw and no paraffin — which is the petroleum-derived wax responsible for most of the black soot you see creeping up a jar. The wick is braided cotton with no lead or metal core, so nothing but plant wax and cotton is ever alight.'),
          h2('Fragrance, phthalate-free — and named'),
          para('Our scents are built from fragrance and essential oils blended without phthalates or parabens — two families of additive common in cheaper fragrance that plenty of people would rather not have off-gassing into their living room. We keep the load measured to the gram so a scent is the same strength every time you buy it, and we print the notes on the box, not a marketing word. Fresh Linen is exactly that: cotton, a little bergamot, clean musk. No mystery, because there doesn’t need to be one.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'how-the-refill-works',
    status: 'published',
    body: {
      title: 'How the refill system works (and why we built it)',
      excerpt: 'Buy the vessel once, then top it up for less and no new glass. Here’s the two-minute routine.',
      featuredImage: { $asset: 'post-refill' },
      body: {
        type: 'doc',
        content: [
          para('The single most wasteful thing about candles is the part that has nothing to do with the candle: the glass. A vessel gets used once, burns down, and goes in the bin or the recycling — a heavy, hard-to-recycle object made for a few weeks of light. We designed the whole Lumen range around not doing that. The ceramic vessel is the durable part you keep; the candle is the part you replace.'),
          h2('The two-minute routine'),
          para('When a candle burns down to the last half-inch, retire it. Pop any leftover wax out — a minute in the freezer shrinks it and it lifts straight out — then wash the vessel with warm soapy water and dry it. Drop in a refill, trim the new wick to a quarter inch, and light it. That’s the whole thing. The vessel looks and works exactly as it did new, and you’ve spent about a third less than buying another full candle.'),
          h2('What it adds up to'),
          para('A refill costs less than a full candle because you’re not paying for the ceramic again, and it ships in a flat recycled-kraft pouch instead of a boxed glass jar — lighter to post, smaller to store, nothing to throw away. Refill a vessel four or five times and you’ve kept that many jars out of landfill and spent noticeably less doing it. Good for the shelf, good for the bill, good for the bin. That’s the whole argument, and it’s a quiet one.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'get-a-clean-even-burn',
    status: 'published',
    body: {
      title: 'Two habits for a clean, even burn',
      excerpt: 'One before you ever light it, one every time after — and a candle lasts longer and never tunnels.',
      featuredImage: { $asset: 'post-styling' },
      body: {
        type: 'doc',
        content: [
          para('A clean candle can still burn badly if you don’t give it two small things. Neither takes any effort once you know them, and together they mean the same candle lasts noticeably longer, burns without soot, and gives you an even pool right down to the last hour — which also means the refill drops into a clean, even vessel every time.'),
          h2('The first burn sets the memory'),
          para('Wax has a memory. The very first time you light a candle, leave it lit long enough for the melted pool to reach the full edge of the vessel — usually two to three hours for the Everyday. Blow it out early and the wax remembers that smaller pool and tunnels down the middle from then on, leaving a ring of wasted wax on the sides. Give it that first full melt and it burns edge-to-edge for the rest of its life.'),
          h2('Trim the wick, every time'),
          para('Before every light, trim the cotton wick down to about a quarter inch — nail scissors are fine. A long wick burns too hot, flickers, and mushrooms a little ball of carbon that throws soot up the glass; a short trimmed wick burns low, steady and clean. It takes five seconds and it’s the single biggest thing you can do for a candle. When there’s about half an inch of wax left, retire it, clean the vessel, and start a refill.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-candle-modern',
  key: 'sparx-retail-candle-modern',
  name: 'Candle Studio (Modern)',
  theme: THEME,
  summary:
    'A complete, working shop for a modern, clean candle & home-fragrance studio: a real catalogue of clean-fragrance candles with scent options, a ceramic travel candle, a reed diffuser, a room spray, a refill, a matches set and gift sets, with categories, collections, a bespoke bright PDP and a fully merchandised home page. Fresh, minimalist theme — a pale blush-white ground, a single sage accent, a clean grotesk. Shipped as Lumen.',
  tagline: 'A bright, working storefront for a modern candle studio.',
  vertical: 'retail',
  industry: 'Candle & home fragrance',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 84,
  brand: {
    businessName: 'Lumen',
    tagline: 'Clean fragrance, honestly made.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Lumen — clean, refillable candles & home fragrance',
      description:
        'Lumen is a modern home-fragrance studio: clean coconut-soy candles, diffusers and sprays, blended phthalate-free with the whole ingredient list on the box — and built to be refilled, not thrown out.',
    },
    about: {
      title: 'About Lumen',
      description:
        'Why Lumen makes candles the honest way — coconut-soy wax, cotton wicks, phthalate-free scent you can read on the label, and vessels designed to be washed out and refilled.',
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
