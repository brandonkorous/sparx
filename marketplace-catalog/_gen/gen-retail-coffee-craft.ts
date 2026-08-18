// sparx-retail-coffee-craft — a RETAIL/COMMERCE site template: a craft coffee roaster.
//
// The gold reference for the retail family: a complete, working shop the moment it installs —
// a real product catalogue (single-origin bags, blends, decaf, a subscription, brew gear),
// categories + collections, a bespoke PDP, the full 9-page commerce site (home merchandising →
// shop → collections → cart → search → journal → about → contact), dressed in an INLINE
// bespoke theme (warm roastery cream + deep coffee-brown primary + terracotta accent). Shipped
// as Cairn Coffee Roasters.
//
// SELF-CONTAINED BY DESIGN. Unlike the original ten reference commerce templates (whose themes
// live in `template-themes.ts`), a retail-family generator carries its OWN theme inline and
// passes it on the spec (`theme`), so the whole family can be authored in parallel without any
// two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-coffee-craft.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-coffee-craft/**" \
//     "marketplace-catalog/_gen/gen-retail-coffee-craft.ts"
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
// A warm roastery: cream paper ground, deep espresso ink, a coffee-brown primary and a
// terracotta accent, under a warm serif display over a humanist sans. Complete light + dark,
// AA on every role (the blueprint sweep's contrast check is the gate).
const THEME = defineTheme({
  name: 'cairn-roast',
  type: { body: face('Work Sans', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.625rem', depth: '0' },
  light: {
    surfaces: ['oklch(97% 0.012 70)', 'oklch(94% 0.016 66)', 'oklch(89% 0.02 62)', 'oklch(22% 0.03 50)'],
    roles: {
      primary: 'oklch(38% 0.06 55)',
      secondary: 'oklch(42% 0.04 55)',
      accent: 'oklch(56% 0.13 42)',
      neutral: 'oklch(26% 0.03 50)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(20% 0.02 50)', 'oklch(17% 0.02 50)', 'oklch(14% 0.02 50)', 'oklch(95% 0.012 70)'],
    roles: {
      primary: 'oklch(74% 0.08 62)',
      secondary: 'oklch(76% 0.04 60)',
      accent: 'oklch(72% 0.13 42)',
      neutral: 'oklch(30% 0.02 50)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "coffee-hero": "https://images.unsplash.com/photo-1607681034540-2c46cc71896d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9hc3RlciUyMHBvdXJpbmclMjBmcmVzaC1yb2FzdGVkJTIwYmVhbnMlMjBjb29saW5nJTIwdHJheXxlbnwwfDB8fHwxNzg2NDAxOTQ3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "coffee-tile-origin": "https://images.unsplash.com/photo-1565273975921-c884f2b703df?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZCUyMHNjb29waW5nJTIwZ3JlZW4lMjBjb2ZmZWUlMjBidXJsYXAlMjBzYWNrfGVufDB8MHx8fDE3ODY0MDE5NTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "coffee-tile-blend": "https://images.unsplash.com/photo-1690983324988-bbceeeecbe58?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFnJTIwcm9hc3RlZCUyMGNvZmZlZSUyMGJlYW5zJTIwc3BpbGxpbmclMjBvbnRvJTIwd29vZHxlbnwwfDB8fHwxNzg2NDAxOTU2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "coffee-tile-gear": "https://images.unsplash.com/photo-1650940925927-f4a30c930a4d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG91ci1vdmVyJTIwZHJpcHBlciUyMGdvb3NlbmVjayUyMGtldHRsZSUyMGNvdW50ZXJ8ZW58MHwwfHx8MTc4NjQwMTk1OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "coffee-tile-sub": "https://images.unsplash.com/photo-1766512442064-0ffc39ce866f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBrcmFmdCUyMGNvZmZlZSUyMGJhZ3MlMjB0aWVkJTIwdHdpbmV8ZW58MHwwfHx8MTc4NjQwMTk2M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "coffee-band-roast": "https://images.unsplash.com/photo-1511537190424-bbbab87ac5eb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZHJ1bSUyMHJvYXN0ZXIlMjBnbG93aW5nJTIwd29yayUyMHNtYWxsJTIwcm9hc3Rlcnl8ZW58MHwwfHx8MTc4NjQwMTk2Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "coffee-band-sub": "https://images.unsplash.com/photo-1622919526861-1b6c75517f29?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8YmFnJTIwY29mZmVlJTIwZG9vcnN0ZXB8ZW58MHwwfHx8MTc4NjQwMjUwMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-espresso": "https://images.unsplash.com/photo-1524350876685-274059332603?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFnJTIwZXNwcmVzc28lMjByb2FzdCUyMGNvZmZlZXxlbnwwfDB8fHwxNzg2NDAxOTc4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-decaf": "https://images.unsplash.com/photo-1605711599412-775918dbe770?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8YmFnJTIwZGVjYWYlMjBjb2ZmZWV8ZW58MHwwfHx8MTc4NjQwMTk4MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-dripper": "https://images.unsplash.com/photo-1712664436441-ad3fcb96dff1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2VyYW1pYyUyMHBvdXItb3ZlciUyMGRyaXBwZXJ8ZW58MHwwfHx8MTc4NjQwMTk4NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-filters": "https://images.unsplash.com/photo-1748563223560-42d7a0828961?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFjayUyMHBhcGVyJTIwcG91ci1vdmVyJTIwZmlsdGVyc3xlbnwwfDB8fHwxNzg2NDAxOTg3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-mug": "https://images.unsplash.com/photo-1495100497150-fe209c585f50?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RvbmV3YXJlJTIwY29mZmVlJTIwbXVnfGVufDB8MHx8fDE3ODY0MDI1MTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subscription": "https://images.unsplash.com/photo-1745680636997-dca47973113d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8Y29mZmVlJTIwc3Vic2NyaXB0aW9uJTIwZ2lmdCUyMGJveCUyMHRocmVlJTIwYmFnc3xlbnwwfDB8fHwxNzg2NDAxOTk0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-roast": "https://images.unsplash.com/photo-1561986810-4f3ba2f46ceb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8YmVhbnMlMjBtaWQtcm9hc3QlMjBkcnVtJTIwcm9hc3RlcnxlbnwwfDB8fHwxNzg2NDAxOTk4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-brew": "https://images.unsplash.com/photo-1504469089401-14f795f6ddee?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2xvdyUyMHBvdXItb3ZlciUyMHByb2dyZXNzJTIwY2FyYWZlfGVufDB8MHx8fDE3ODY0MDIwMDF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-origin": "https://images.unsplash.com/photo-1647220577886-6a5faaa7c141?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29mZmVlJTIwZmFybSUyMGdyZWVuJTIwaGlsbHNpZGUlMjBhbHRpdHVkZXxlbnwwfDB8fHwxNzg2NDAyMDA0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'coffee-hero', url: src('coffee-hero'), alt: 'A roaster pouring fresh-roasted beans from a cooling tray' },
  { id: 'coffee-tile-origin', url: src('coffee-tile-origin'), alt: 'A hand scooping green coffee from a burlap sack' },
  { id: 'coffee-tile-blend', url: src('coffee-tile-blend'), alt: 'A bag of roasted coffee beans spilling onto a wood counter' },
  { id: 'coffee-tile-gear', url: src('coffee-tile-gear'), alt: 'A pour-over dripper and gooseneck kettle on a counter' },
  { id: 'coffee-tile-sub', url: src('coffee-tile-sub'), alt: 'A stack of kraft coffee bags tied with twine' },
  { id: 'coffee-band-roast', url: src('coffee-band-roast'), alt: 'A drum roaster glowing at work in a small roastery' },
  { id: 'coffee-band-sub', url: src('coffee-band-sub'), alt: 'A fresh bag of coffee left on a doorstep in morning light' },
  { id: 'prod-ethiopia', url: src('prod-ethiopia'), alt: 'A kraft bag of Ethiopia single-origin coffee' },
  { id: 'prod-colombia', url: src('prod-colombia'), alt: 'A kraft bag of Colombia single-origin coffee' },
  { id: 'prod-house-blend', url: src('prod-house-blend'), alt: 'A bag of the house blend coffee' },
  { id: 'prod-espresso', url: src('prod-espresso'), alt: 'A bag of espresso roast coffee' },
  { id: 'prod-decaf', url: src('prod-decaf'), alt: 'A bag of decaf coffee' },
  { id: 'prod-dripper', url: src('prod-dripper'), alt: 'A ceramic pour-over dripper' },
  { id: 'prod-filters', url: src('prod-filters'), alt: 'A pack of paper pour-over filters' },
  { id: 'prod-mug', url: src('prod-mug'), alt: 'A stoneware coffee mug in a warm glaze' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A coffee subscription gift box of three bags' },
  { id: 'post-roast', url: src('post-roast'), alt: 'Beans mid-roast in a drum roaster' },
  { id: 'post-brew', url: src('post-brew'), alt: 'A slow pour-over in progress over a carafe' },
  { id: 'post-origin', url: src('post-origin'), alt: 'A coffee farm on a green hillside at altitude' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-coffee-craft: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm photograph, a serif headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('coffee-hero'), alt: 'A roaster pouring fresh-roasted beans', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Roasted this week, not last month.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Cairn is a small-batch coffee roaster. We buy green coffee from farms we can name, roast it in tens of pounds, and ship it within days — so it reaches you tasting like the roaster meant it to.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
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
            text: 'Find your coffee',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'coffee-tile-origin', label: 'Single origin', href: '/shop', alt: 'Green coffee from a burlap sack' }),
              categoryTile({ assetId: 'coffee-tile-blend', label: 'Blends', href: '/shop', alt: 'Roasted beans spilling onto a counter' }),
              categoryTile({ assetId: 'coffee-tile-gear', label: 'Brew gear', href: '/shop', alt: 'A pour-over dripper and kettle' }),
              categoryTile({ assetId: 'coffee-tile-sub', label: 'Subscription', href: '/shop/subscription', alt: 'A stack of kraft coffee bags' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'This week’s roasts' }),
  editorialBand({
    heading: 'Small batches, on purpose',
    lead: 'We roast in tens of pounds, not thousands, on a drum roaster we run by ear and by nose. Every batch is cupped before it ships — if it isn’t what we tasted on the sample table, it doesn’t go in a bag.',
    assetId: 'coffee-band-roast',
    cta: 'How we roast',
    href: '/blog/how-we-roast',
    alt: 'A drum roaster glowing at work',
  }),
  productsBlock({ source: 'commerce.category.single-origin', layout: 'carousel', heading: 'Single origin' }),
  editorialBand({
    heading: 'Coffee, handled',
    lead: 'A subscription is the easy way to never run out: pick a bag, pick how often, and it arrives freshly roasted on your schedule. Skip, swap or cancel any time — no lock-in, ever.',
    assetId: 'coffee-band-sub',
    cta: 'Start a subscription',
    href: '/shop/subscription',
    alt: 'A fresh bag of coffee on a doorstep',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static "how we'd brew it" note, and policy links). */
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
                    text: 'Cairn Coffee Roasters',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Freshly roasted to order' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Every bag is roasted after you order and shipped within two days, whole bean or ground to your brew method. Rest it a few days off roast, then use it within a month for the best cup.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Pairs well with' });

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
    'Every coffee we’re roasting right now — single origins, blends, decaf, and the gear to brew them. Filter by roast or origin, or sort however you like; all of it ships freshly roasted to order.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The coffees grouped the way people actually shop — this week’s roasts, the everyday blends, the bright single origins, and starter kits for a new brew method.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Cairn', 'Looking for an origin, a roast level, or a brewing guide? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $40, and every bag is roasted to order and sent within two days. Not sure it’s for you? Tell us and we’ll make it right — coffee should be a pleasure, not a gamble.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Cairn journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the roastery — how we roast, how to brew it at home, and where the coffee actually comes from. Plain, useful, no coffee snobbery.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Cairn' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Cairn started as a drum roaster in a garage and a standing order from a few neighbours who were tired of stale supermarket coffee. It grew the slow way — one bag, one café, one farmer relationship at a time — and it still runs on the same idea: buy well, roast small, ship fast.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We buy green coffee from importers and farms we can name, and we pay above the commodity rate because the people who grow it deserve a living from it. Then we roast in small batches, cup every one, and only bag what tastes the way it did on the sample table.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No mystery blends, no roast dates you can’t read, no coffee older than it should be. Just good coffee, handled with care from the farm to your kitchen.',
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
    intro: 'Questions about a coffee, a wholesale enquiry, or want us to roast for your café? Tell us what you’re after and a real person at the roastery will get back to you.',
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
}): Product => ({
  handle: opts.handle,
  title: opts.title,
  description: opts.description,
  status: 'active',
  productType: 'Coffee',
  vendor: 'Cairn Coffee Roasters',
  tags: opts.tags,
  categoryHandles: opts.categories,
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [GRIND],
  variants: [
    { sku: `${opts.sku}-WB`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Grind: 'Whole bean' } },
    { sku: `${opts.sku}-FL`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Grind: 'Filter' } },
    { sku: `${opts.sku}-ES`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Grind: 'Espresso' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const PRODUCTS: Product[] = [
  bag({
    handle: 'ethiopia-guji',
    title: 'Ethiopia Guji',
    description:
      'A washed Ethiopia from the Guji highlands — bright and floral, with jasmine on the nose and a clean, tea-like finish. The one to reach for when you want coffee that tastes like a place, not just like coffee.',
    price: 21,
    sku: 'CAIRN-ETH-GUJI',
    categories: ['single-origin'],
    collections: ['this-week', 'single-origins'],
    tags: ['single-origin', 'ethiopia', 'washed', 'light-roast'],
    asset: 'prod-ethiopia',
    seoTitle: 'Ethiopia Guji — washed single-origin coffee | Cairn',
    seoDescription: 'A bright, floral washed Ethiopia from the Guji highlands, roasted light. Jasmine and stone fruit.',
  }),
  bag({
    handle: 'colombia-huila',
    title: 'Colombia Huila',
    description:
      'A washed Colombia from smallholders in Huila — the crowd-pleaser of the shelf. Milk chocolate, red apple and caramel, medium-bodied and endlessly easy to drink, black or with milk.',
    price: 19,
    sku: 'CAIRN-COL-HUILA',
    categories: ['single-origin'],
    collections: ['this-week', 'single-origins'],
    tags: ['single-origin', 'colombia', 'washed', 'medium-roast'],
    asset: 'prod-colombia',
    seoTitle: 'Colombia Huila — washed single-origin coffee | Cairn',
    seoDescription: 'A sweet, balanced washed Colombia — milk chocolate, red apple and caramel. Roasted medium.',
  }),
  bag({
    handle: 'house-blend',
    title: 'Cairn House Blend',
    description:
      'Our everyday blend and the coffee we drink most — a balance of Latin American and East African beans that’s sweet, round and forgiving. Great in a filter, great in a French press, great half-asleep at 6am.',
    price: 17,
    sku: 'CAIRN-HOUSE',
    categories: ['blends'],
    collections: ['this-week', 'blends', 'best-sellers'],
    tags: ['blend', 'everyday', 'medium-roast'],
    asset: 'prod-house-blend',
    seoTitle: 'Cairn House Blend — everyday coffee | Cairn',
    seoDescription: 'A sweet, round, forgiving everyday blend that works in any brewer. Roasted medium.',
  }),
  bag({
    handle: 'espresso-roast',
    title: 'Foundry Espresso',
    description:
      'A blend built for the machine — a touch darker, syrupy and chocolatey, with a heavy body that stands up to milk without disappearing. Pulls a sweet, forgiving shot and makes a flat white you’ll want twice.',
    price: 18,
    sku: 'CAIRN-ESPRESSO',
    categories: ['blends'],
    collections: ['blends', 'best-sellers'],
    tags: ['blend', 'espresso', 'dark-roast'],
    asset: 'prod-espresso',
    seoTitle: 'Foundry Espresso — espresso blend | Cairn',
    seoDescription: 'A syrupy, chocolatey espresso blend with a heavy body that stands up to milk. Roasted dark.',
  }),
  bag({
    handle: 'decaf',
    title: 'Nightcap Decaf',
    description:
      'A sugarcane-process decaf that actually tastes like coffee — cocoa, roasted almond and a little dried cherry, with none of the flat, papery thing decaf is famous for. The 4pm cup that won’t keep you up.',
    price: 18,
    sku: 'CAIRN-DECAF',
    categories: ['blends'],
    collections: ['blends'],
    tags: ['decaf', 'medium-roast'],
    asset: 'prod-decaf',
    seoTitle: 'Nightcap Decaf — sugarcane-process decaf coffee | Cairn',
    seoDescription: 'A genuinely good sugarcane-process decaf — cocoa, almond and dried cherry. Roasted medium.',
  }),
  {
    handle: 'pour-over-dripper',
    title: 'Ceramic Pour-Over Dripper',
    description:
      'A single-cup ceramic dripper that holds heat and pours clean — the simplest way to make café-quality coffee at home. Pairs with standard cone filters; no gadgets, no power, no fuss.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Cairn Coffee Roasters',
    tags: ['gear', 'brewing', 'pour-over'],
    categoryHandles: ['gear'],
    collectionHandles: ['gear', 'starter-kit'],
    seoTitle: 'Ceramic Pour-Over Dripper — brew gear | Cairn',
    seoDescription: 'A single-cup ceramic pour-over dripper that holds heat and pours clean.',
    variants: [{ sku: 'CAIRN-GEAR-DRIPPER', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-dripper', isPrimary: true, alt: 'A ceramic pour-over dripper' }],
  },
  {
    handle: 'pour-over-filters',
    title: 'Pour-Over Filters (100)',
    description:
      'A hundred natural paper filters for the cone dripper — unbleached, so there’s no papery taste to rinse out. The consumable you always forget to reorder, so put it on the subscription.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Cairn Coffee Roasters',
    tags: ['gear', 'brewing', 'filters'],
    categoryHandles: ['gear'],
    collectionHandles: ['gear', 'starter-kit'],
    seoTitle: 'Pour-Over Filters, 100 pack — brew gear | Cairn',
    seoDescription: 'A hundred unbleached natural paper filters for a cone pour-over dripper.',
    variants: [{ sku: 'CAIRN-GEAR-FILTERS', priceCents: money(9), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-filters', isPrimary: true, alt: 'A pack of pour-over filters' }],
  },
  {
    handle: 'stoneware-mug',
    title: 'Cairn Stoneware Mug',
    description:
      'A heavy, hand-glazed stoneware mug that keeps coffee hot and feels right in the hand. Made in small runs by a local pottery, so no two glazes are exactly the same. 10oz — the size of a proper morning cup.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Cairn Coffee Roasters',
    tags: ['gear', 'mug', 'ceramics'],
    categoryHandles: ['gear'],
    collectionHandles: ['gear'],
    seoTitle: 'Cairn Stoneware Mug — 10oz coffee mug | Cairn',
    seoDescription: 'A heavy hand-glazed stoneware coffee mug, 10oz, made in small runs by a local pottery.',
    variants: [{ sku: 'CAIRN-GEAR-MUG', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-mug', isPrimary: true, alt: 'A stoneware coffee mug' }],
  },
  {
    handle: 'subscription',
    title: 'Coffee Subscription',
    description:
      'Freshly roasted coffee on your schedule — pick a size and how often, and we roast and ship it to match. Rotate through single origins or stick with the house blend; skip, swap or cancel any time. The easiest way to never run out.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Cairn Coffee Roasters',
    tags: ['subscription', 'gift'],
    categoryHandles: ['subscription'],
    collectionHandles: ['this-week', 'best-sellers'],
    seoTitle: 'Coffee Subscription — freshly roasted, on your schedule | Cairn',
    seoDescription: 'A flexible coffee subscription — pick a size and cadence; skip, swap or cancel any time.',
    options: [
      { name: 'Plan', displayType: 'dropdown', values: [{ value: 'One bag' }, { value: 'Two bags' }] },
    ],
    variants: [
      { sku: 'CAIRN-SUB-1', priceCents: money(17), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: 'One bag' } },
      { sku: 'CAIRN-SUB-2', priceCents: money(32), inventoryPolicy: 'continue', optionValues: { Plan: 'Two bags' } },
    ],
    images: [{ assetId: 'prod-subscription', isPrimary: true, alt: 'A coffee subscription box' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'single-origin', name: 'Single origin', description: 'Coffees from one farm or region.', featured: true },
    { handle: 'blends', name: 'Blends', description: 'Everyday and espresso blends.', featured: true },
    { handle: 'gear', name: 'Brew gear', description: 'Drippers, filters and mugs.', featured: true },
    { handle: 'subscription', name: 'Subscription', description: 'Coffee on your schedule.', featured: true },
  ],
  collections: [
    {
      handle: 'this-week',
      name: 'This week’s roasts',
      description: 'What came off the roaster this week.',
      type: 'manual',
      featured: true,
      productHandles: ['ethiopia-guji', 'colombia-huila', 'house-blend', 'subscription'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The coffees people come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['house-blend', 'espresso-roast', 'subscription'],
    },
    {
      handle: 'single-origins',
      name: 'Single origins',
      description: 'Bright, distinct coffees from one place.',
      type: 'manual',
      featured: false,
      productHandles: ['ethiopia-guji', 'colombia-huila'],
    },
    {
      handle: 'blends',
      name: 'Blends',
      description: 'Balanced everyday and espresso blends.',
      type: 'manual',
      featured: false,
      productHandles: ['house-blend', 'espresso-roast', 'decaf'],
    },
    {
      handle: 'gear',
      name: 'Brew gear',
      description: 'Everything to brew it at home.',
      type: 'manual',
      featured: false,
      productHandles: ['pour-over-dripper', 'pour-over-filters', 'stoneware-mug'],
    },
    {
      handle: 'starter-kit',
      name: 'Starter kit',
      description: 'New to pour-over? Start here.',
      type: 'manual',
      featured: false,
      productHandles: ['pour-over-dripper', 'pour-over-filters', 'house-blend'],
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
    slug: 'how-we-roast',
    status: 'published',
    body: {
      title: 'How we roast, and why it’s in small batches',
      excerpt: 'Roasting is cooking, and like any cooking it goes wrong at scale if you stop paying attention. Here’s how we keep it honest.',
      featuredImage: { $asset: 'post-roast' },
      body: {
        type: 'doc',
        content: [
          para('Roasting green coffee is closer to cooking than most people expect. You’re applying heat over time and chasing a set of chemical reactions — the same browning that happens to toast and caramel — and stopping at exactly the right moment for the coffee in front of you. A minute too long or fifteen degrees too hot, and a bright, floral Ethiopia turns into a flat, roasty sameness.'),
          h2('Small batches, by ear and by nose'),
          para('We roast in tens of pounds on a drum roaster, and we run it by ear and by nose as much as by the numbers. You learn to hear first crack, to smell the turn from grassy to sweet, and to pull the batch before it tips into bitterness. That kind of attention doesn’t scale to thousand-pound loads, which is exactly why we don’t roast them.'),
          h2('Cupped before it ships'),
          para('Every batch is cupped — brewed and tasted on a table — before a single bag goes out. If it isn’t what we tasted when we bought the coffee, it doesn’t ship. Sometimes that means re-roasting; occasionally it means an apology to whoever was waiting. It always means the bag on your shelf tastes like it was supposed to.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'a-simple-pour-over-guide',
    status: 'published',
    body: {
      title: 'A simple pour-over guide',
      excerpt: 'No scale-worshipping, no ten-variable spreadsheet. A repeatable pour-over you can make before you’re fully awake.',
      featuredImage: { $asset: 'post-brew' },
      body: {
        type: 'doc',
        content: [
          para('A good pour-over doesn’t need a chemistry set. It needs fresh coffee, a burr grind, hot-but-not-boiling water, and a bit of patience. Here’s the version we actually use on a weekday morning.'),
          h2('The recipe'),
          para('Use about a 1-to-16 ratio — say 25 grams of coffee to 400 grams of water. Grind medium, like coarse sand. Rinse the filter, add the coffee, and pour twice the coffee’s weight in water to start — that’s the bloom. Wait thirty seconds while it puffs up and releases gas, then pour the rest in slow, steady circles, keeping the bed level. The whole thing should finish in about three minutes.'),
          h2('If it tastes off'),
          para('Sour and thin means under-extracted — grind finer or pour slower. Bitter and dry means over-extracted — grind coarser or pour a touch faster. Change one thing at a time, and taste. Two or three cups in, you’ll have it dialled for that coffee, and it’ll be the same every morning after.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'where-the-coffee-comes-from',
    status: 'published',
    body: {
      title: 'Where the coffee actually comes from',
      excerpt: 'A bag with a farm name on it should mean something. Here’s what we know about the people who grow ours, and why we pay more.',
      featuredImage: { $asset: 'post-origin' },
      body: {
        type: 'doc',
        content: [
          para('Most coffee is sold as a commodity — bought and priced with no reference to who grew it or how good it is. We buy the other way: specific lots, from farms and washing stations we can name, through importers who’ve built long relationships with the growers.'),
          h2('Why we pay above the market'),
          para('Coffee at altitude, picked ripe and processed with care, costs more to produce than the commodity price rewards. If we want farmers to keep growing it — and to keep improving it — they have to make a living from it. Paying above the market isn’t charity; it’s how the good coffee keeps existing.'),
          h2('What that gets you'),
          para('Traceability, for one: when you can name the farm, you can taste the difference a region and a process make, season after season. And consistency: the same growers, treated well, come back with the same lots year on year. The name on the bag is a promise that someone, somewhere, was paid fairly to grow something worth roasting.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-coffee-craft',
  key: 'sparx-retail-coffee-craft',
  name: 'Coffee Roaster (Craft)',
  theme: THEME,
  summary:
    'A complete, working shop for a small-batch coffee roaster: a real catalogue of single-origin bags, blends, decaf, brew gear and a flexible subscription, with categories, collections, a bespoke coffee-shop PDP and a full merchandised home page. Warm roastery theme — cream paper, deep coffee-brown, a terracotta accent. Shipped as Cairn Coffee Roasters.',
  tagline: 'A warm, working storefront for a craft coffee roaster.',
  vertical: 'retail',
  industry: 'Coffee roaster',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 88,
  brand: {
    businessName: 'Cairn Coffee Roasters',
    tagline: 'Roasted this week, not last month.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Cairn Coffee Roasters — small-batch coffee, roasted to order',
      description:
        'Cairn is a small-batch coffee roaster — single origins, blends and a flexible subscription, roasted to order and shipped within days. Buy well, roast small, ship fast.',
    },
    about: {
      title: 'About Cairn Coffee Roasters',
      description:
        'How Cairn buys, roasts and ships — small batches, named farms, fair prices, and coffee that tastes the way the roaster meant it to.',
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
