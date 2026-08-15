// sparx-warm-subscription — a reference-driven SITE TEMPLATE (docs/templates/bokksu).
//
// Bokksu translated to sparx: a warm subscription / food-editorial storefront — a
// cream-and-terracotta page that reads like a hand-bound cookbook, where a recurring
// subscription is the hero and provenance storytelling carries the page — ported to a
// specialty single-origin coffee club, Latitude Coffee Club, "A new origin at your door
// each month". The home page is the Bokksu rhythm — a full-bleed warm photo hero, a
// "how the club works" step trio, provenance editorial bands between shoppable
// carousels, a static subscription plan-selector (cadence cards) and an inclusion list —
// dressed in the bespoke `roastery` theme (warm cream ground, deep terracotta primary,
// a forest-green heading ink, an espresso dark-chrome footer island).
//
// The live subscription buy-box (a weekly/monthly cadence toggle that recomputes the
// total) is a LATER behaviors phase. Here the club is presented STATICALLY: a hero
// offer, a three-step "how the club works" trio, and plan cards that link into the real
// subscription product — real content, no live cadence widget.
//
// This file is JUST the SPEC; the composition + emission live in the shared
// `template-sites/harness.ts`, which the other nine templates reuse. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-warm-subscription.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-warm-subscription/**" \
//     "marketplace-catalog/_gen/gen-template-warm-subscription.ts"
//   pnpm --filter @sparx/api-rest marketplace:self-register
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  el,
  type Node,
} from '../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { productsBlock } from '../../packages/silica-catalog/src/commerce';
import {
  actions,
  body,
  card,
  cardTitle,
  gridThree,
  primaryAction,
  secondaryAction,
  section,
  sectionAlt,
  sectionHead,
  CARD,
} from '../../packages/silica-catalog/src/sections/_shell';
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import { contactSection } from './shared/contact-section';
import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import {
  addToCartForm,
  pdpAttributes,
  pdpDescription,
  pdpImage,
  pdpPolicyLinks,
  pdpPriceRow,
  pdpStockBadge,
  pdpTitle,
  productPage,
} from './template-sites/pdp';

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Royalty-free Unsplash photographs, verified reachable (HTTP 200) at authoring time.
// Product + post images go through `assets` by id (the installer re-hosts them); the
// hero / how-it-works / editorial-band / roastery-strip photos are TREE imagery, so they
// hot-link the same URL inline (docs/54 §6) — they still appear in `assets` as the single
// documented registry of the bundle's imagery + alt text.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
  // Products — coffee
  ethiopiaGuji: '1524350876685-274059332603',
  colombiaHuila: '1518057111178-44a106bad636',
  kenyaNyeri: '1447933601403-0c6688de566e',
  houseBlend: '1559056199-641a0ac8b55e',
  espressoBlend: '1485808191679-5f86510681a2',
  decafBrazil: '1461023058943-07fcbe16d735',
  coldBrew: '1517701550927-30cf4ba1dba5',
  // Products — gear
  pourOverDripper: '1504753793650-d4a2b783c15e',
  pourOverFilters: '1442512595331-e89e73853f31',
  enamelMug: '1494314671902-399b18174975',
  handGrinder: '1516315720917-231ef9acce48',
  giftSet: '1541167760496-1628856ab772',
  // The subscription plan product
  originClub: '1509042239860-f550ce710b93',
  // Journal posts
  postFarmers: '1511537190424-bbbab87ac5eb',
  postBrewing: '1495474472287-4d71bcdd2085',
  postRoasting: '1497935586351-b67a49e012bf',
  // Hero + editorial bands (tree imagery)
  hero: '1514432324607-a09d9b4aefdd',
  bandProvenance: '1521302080334-4bebac2763a6',
  bandBrew: '1470337458703-46ad1756a187',
  // How the club works (tree imagery)
  how1: '1453614512568-c4024d13c247',
  how2: '1498804103079-a6351b050096',
  how3: '1444418776041-9c7e33cc5a9c',
  // From the roastery (tree imagery)
  roastery1: '1507133750040-4a8f57021571',
  roastery2: '1503481766315-7a586b20f66d',
  roastery3: '1459755486867-b55449bb39ff',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'ethiopia-guji', url: U(IMG.ethiopiaGuji), alt: 'A bag of freshly roasted single-origin coffee beans' },
  { id: 'colombia-huila', url: U(IMG.colombiaHuila), alt: 'A pour of washed Colombian coffee' },
  { id: 'kenya-nyeri', url: U(IMG.kenyaNyeri), alt: 'Roasted coffee beans spilling from a bag' },
  { id: 'house-blend', url: U(IMG.houseBlend), alt: 'A mug of coffee beside whole roasted beans' },
  { id: 'espresso-blend', url: U(IMG.espressoBlend), alt: 'A dark-roast espresso shot pulling into a cup' },
  { id: 'decaf-brazil', url: U(IMG.decafBrazil), alt: 'A cup of coffee on a warm wooden table' },
  { id: 'cold-brew', url: U(IMG.coldBrew), alt: 'A glass of cold brew coffee over ice' },
  { id: 'pour-over-dripper', url: U(IMG.pourOverDripper), alt: 'A ceramic pour-over dripper mid-brew' },
  { id: 'pour-over-filters', url: U(IMG.pourOverFilters), alt: 'A stack of paper coffee filters' },
  { id: 'enamel-mug', url: U(IMG.enamelMug), alt: 'An enamel mug of coffee held in two hands' },
  { id: 'hand-grinder', url: U(IMG.handGrinder), alt: 'A hand coffee grinder with fresh grounds' },
  { id: 'gift-set', url: U(IMG.giftSet), alt: 'A gift-wrapped coffee set with beans and gear' },
  { id: 'the-origin-club', url: U(IMG.originClub), alt: 'A month of freshly roasted coffee ready to ship' },
  { id: 'post-farmers', url: U(IMG.postFarmers), alt: 'A grower tending coffee cherries at harvest' },
  { id: 'post-brewing', url: U(IMG.postBrewing), alt: 'A slow pour over a filter at home' },
  { id: 'post-roasting', url: U(IMG.postRoasting), alt: 'Beans tumbling in a coffee roaster' },
  { id: 'hero-home', url: U(IMG.hero), alt: 'Freshly roasted coffee and a warm cup on a table' },
  { id: 'band-provenance', url: U(IMG.bandProvenance), alt: 'Green coffee at a farm on the bean belt' },
  { id: 'band-brew', url: U(IMG.bandBrew), alt: 'A pour-over brewing on a warm kitchen counter' },
  { id: 'how-1', url: U(IMG.how1), alt: 'Choosing a grind and a plan' },
  { id: 'how-2', url: U(IMG.how2), alt: 'Coffee roasting to order at the roastery' },
  { id: 'how-3', url: U(IMG.how3), alt: 'A fresh box of coffee arriving at the door' },
  { id: 'roastery-1', url: U(IMG.roastery1), alt: 'A roaster working the drum at the roastery' },
  { id: 'roastery-2', url: U(IMG.roastery2), alt: 'Cupping the new lots on the bench' },
  { id: 'roastery-3', url: U(IMG.roastery3), alt: 'Fresh coffee bagged and ready to ship' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-warm-subscription: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections (the Bokksu sequence) ─────────────────────────────────────

/** The full-bleed warm hero — one photograph filling the width, the headline and two
 *  actions in a solid readable panel over it (the `offer_hero` full-bleed shape). The
 *  loud action is the terracotta primary "Join the club"; the second is a quiet outline.
 *  Tenant content, so it hot-links a real photograph; every class is a NAMED utility so
 *  it survives the stamp into the tenant's stored tree. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: {
          src: assetUrl('hero-home'),
          alt: 'Freshly roasted coffee and a warm cup on a table',
          loading: 'lazy',
        },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el(
                  'h1',
                  'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                  { text: 'A new coffee-growing origin at your door each month' }
                ),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Latitude Coffee Club is a subscription for people who want their coffee to taste of somewhere. Every month we send a fresh single-origin harvest, roasted to order, with the story of the farm that grew it.',
                }),
                actions([
                  primaryAction('Join the club', '/products/the-origin-club'),
                  secondaryAction('Read the Journal', '/journal'),
                ]),
              ],
            }),
          ],
        }
      ),
    ],
  });
}

/** The signature "How the club works" three-step — each step a full-bleed lifestyle
 *  photo over a serif label + a plain sentence (the `how_it_works` full-bleed-photo
 *  variant). Container-query grid, so it reflows from one column to three by its own
 *  width. Named utilities throughout. */
function howTheClubWorks(): Node {
  const step = (assetId: string, alt: string, title: string, caption: string): Node =>
    el('div', 'flex flex-col gap-4', {
      children: [
        el('img', 'aspect-video w-full rounded-box border border-base-300 bg-base-200 object-cover', {
          attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
        }),
        el('h3', 'text-xl font-semibold text-base-content', { text: title }),
        el('p', 'text-base leading-relaxed text-base-content', { text: caption }),
      ],
    });
  return section([
    sectionHead(
      'How the club works',
      'From your first order to a fresh bag at your door, the whole club is three simple steps — and you can pause or cancel any time.'
    ),
    el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-3', {
      children: [
        step(
          'how-1',
          'Choosing a grind and a plan',
          'Tell us how you brew',
          'Pick your grind — whole bean, filter, espresso or Aeropress — and how long you would like to ride along. That is the whole set-up.'
        ),
        step(
          'how-2',
          'Coffee roasting to order at the roastery',
          'We roast to order',
          'The week your box ships, we roast that month’s origin fresh in small batches. Nothing sits on a warehouse shelf waiting for you.'
        ),
        step(
          'how-3',
          'A fresh box of coffee arriving at the door',
          'It arrives, still fresh',
          'A new single-origin harvest lands at your door each month, with a card telling you who grew it, where, and how this year tasted.'
        ),
      ],
    }),
  ]);
}

/** A mid-page editorial band — a full-bleed photograph carrying a provenance beat and a
 *  quiet text link (the `picture_band` shape). Same overlay-panel shape as the hero so
 *  the words stay readable over whatever warm photo sits behind them. */
function editorialBand(o: {
  heading: string;
  lead: string;
  assetId: string;
  alt: string;
  cta: string;
  href: string;
}): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-16 @3xl:px-10 @3xl:py-24',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-4 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h2', 'text-3xl font-semibold leading-tight text-base-content @3xl:text-4xl', {
                  text: o.heading,
                }),
                el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
                el('a', 'font-semibold text-base-content underline underline-offset-4', {
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

/** The static subscription plan-selector — cadence cards that stand in for the live
 *  cadence buy-box (a later behaviors phase). Four terms, each with a per-month price, a
 *  billed-every line, and a save figure; the 12-month card is a solid terracotta shape
 *  ("this is the point") carrying the BEST-VALUE badge, the 6-month card carries POPULAR.
 *  Every card links into the real `the-origin-club` subscription product. Named utilities
 *  throughout; the filled card resolves its ink from `text-primary-content`. */
function planCards(): Node {
  const plan = (o: {
    term: string;
    price: string;
    billed: string;
    save: string;
    badge?: { text: string; cls: string };
    featured?: boolean;
  }): Node => {
    const cardCls = o.featured
      ? 'flex flex-col gap-4 rounded-box bg-primary p-6 text-primary-content'
      : 'flex flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-6';
    const ink = o.featured ? 'text-primary-content' : 'text-base-content';
    const head: Node[] = [el('h3', `text-xl font-semibold ${ink}`, { text: o.term })];
    if (o.badge) head.push(el('span', o.badge.cls, { text: o.badge.text }));
    return el('div', cardCls, {
      children: [
        el('div', 'flex items-center justify-between gap-3', { children: head }),
        el('div', 'flex items-baseline gap-1', {
          children: [
            el('span', `text-3xl font-bold ${ink}`, { text: o.price }),
            el('span', `text-base ${ink}`, { text: '/ month' }),
          ],
        }),
        el('p', `text-base leading-relaxed ${ink}`, { text: o.billed }),
        el('p', `text-base font-medium ${ink}`, { text: o.save }),
        el(
          'a',
          o.featured ? 'btn btn-neutral btn-lg' : 'btn btn-primary btn-lg',
          { attrs: { href: '/products/the-origin-club' }, text: 'Start the club' }
        ),
      ],
    });
  };
  return sectionAlt([
    sectionHead(
      'Choose your cadence',
      'Every plan sends a new single-origin harvest, roasted to order and shipped free. The longer you stay, the more you save — and you are never locked in.'
    ),
    el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-4', {
      children: [
        plan({
          term: '12 months',
          price: '$15.99',
          billed: 'Billed once, then a box every month for a year.',
          save: 'Save $72 and get a free enamel mug.',
          badge: { text: 'Best value', cls: 'badge badge-neutral' },
          featured: true,
        }),
        plan({
          term: '6 months',
          price: '$17.99',
          billed: 'Billed every six months, a box every month.',
          save: 'Save $24 over paying monthly.',
          badge: { text: 'Popular', cls: 'badge badge-accent' },
        }),
        plan({
          term: '3 months',
          price: '$19.99',
          billed: 'Billed every three months, a box every month.',
          save: 'Save $6 over paying monthly.',
        }),
        plan({
          term: '1 month',
          price: '$21.99',
          billed: 'Billed monthly. Pause or cancel any time.',
          save: 'No commitment — try a single origin first.',
        }),
      ],
    }),
  ]);
}

/** The inclusion list — what a Latitude box actually contains, as six plain cards. The
 *  Bokksu "your first box includes" beat, translated to coffee. Real ink, 16px body,
 *  edge-and-radius cards; no icons-in-circles, no eyebrows. */
function inclusionList(): Node {
  return section([
    sectionHead(
      'What arrives each month',
      'Every box is the same promise: fresh coffee, a real story, and everything you need to brew it well at home.'
    ),
    gridThree([
      card(CARD, [
        cardTitle('Two fresh single-origin bags'),
        body('A new coffee-growing origin each month, roasted the week it ships and never before.'),
      ]),
      card(CARD, [
        cardTitle('A grower’s story card'),
        body('Who grew it, the farm and region it came from, and how this year’s harvest actually tasted.'),
      ]),
      card(CARD, [
        cardTitle('Brewing notes for every origin'),
        body('The grind, the ratio and the timing we would start with, so your very first cup is a good one.'),
      ]),
      card(CARD, [
        cardTitle('Your grind, dialled in'),
        body('Whole bean, filter, espresso or Aeropress — ground to order the day it leaves the roastery.'),
      ]),
      card(CARD, [
        cardTitle('Roasted, then shipped in 48 hours'),
        body('Straight from our roaster to your door while the coffee is still at its brightest.'),
      ]),
      card(CARD, [
        cardTitle('Free shipping, always'),
        body('Every box, every month, with no order threshold to clear and no surprise at checkout.'),
      ]),
    ]),
  ]);
}

/** The "From the roastery" strip — a row of roastery photographs a visitor scrolls
 *  through (the `gallery_strip` shape). CSS-only snap scroll, named utilities throughout. */
function roasteryStrip(): Node {
  const shot = (assetId: string, title: string, alt: string): Node =>
    el('figure', 'flex w-72 shrink-0 snap-start flex-col gap-3', {
      children: [
        el('img', 'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover', {
          attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
        }),
        el('figcaption', 'text-base font-semibold text-base-content', { text: title }),
      ],
    });
  return section([
    sectionHead(
      'From the roastery',
      'A few frames from the small roastery where every month’s coffee is roasted, cupped and bagged by hand.'
    ),
    el('div', 'flex snap-x gap-6 overflow-x-auto pb-4', {
      children: [
        shot('roastery-1', 'On the roaster', 'A roaster working the drum at the roastery'),
        shot('roastery-2', 'Cupping the new lots', 'Cupping the new lots on the bench'),
        shot('roastery-3', 'Bagged fresh', 'Fresh coffee bagged and ready to ship'),
      ],
    }),
  ]);
}

const HOME: Node[] = [
  hero(),
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'This month at Latitude' }),
  howTheClubWorks(),
  editorialBand({
    heading: 'Every bag has a farmer’s name on it',
    lead: 'We buy whole harvests direct from growers along the bean belt — Ethiopia, Colombia, Kenya — and pay above the fair-trade floor for the pick of the crop. When you know who grew it and how, the coffee simply tastes better.',
    assetId: 'band-provenance',
    alt: 'Green coffee at a farm on the bean belt',
    cta: 'Read the origin stories',
    href: '/journal',
  }),
  productsBlock({ source: 'commerce.category.single-origins', layout: 'carousel', heading: 'Single origins' }),
  planCards(),
  editorialBand({
    heading: 'Brew it like we do at the roastery',
    lead: 'Great beans are only half the cup. A ceramic dripper, the right grind and a slow, patient pour turn a good bag into the best coffee you will make all week — and every box tells you exactly how.',
    assetId: 'band-brew',
    alt: 'A pour-over brewing on a warm kitchen counter',
    cta: 'Shop brew gear',
    href: '/shop',
  }),
  productsBlock({ source: 'commerce.category.gear', layout: 'carousel', heading: 'Brew gear' }),
  inclusionList(),
  roasteryStrip(),
  // NB: no page-level newsletter band here — the `footer: 'newsletter'` chrome variant
  // carries the "join our list" capture, so a section here would be two back-to-back signups.
];

// ── About + Contact (Latitude-voiced) ────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-semibold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'About Latitude Coffee Club',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Latitude Coffee Club started with a simple frustration: most coffee at home tastes of nowhere. It is roasted months ago, blended to hide where it came from, and it lands on your shelf a stranger. We wanted the opposite — coffee you could taste a place in, and know the people behind.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'So every month we follow the harvest around the bean belt and buy a single origin at its peak, direct from the growers. We roast it to order in small batches at our own roastery, grind it the way you brew, and ship it within two days — with a card that tells you whose farm it came from and how this year’s crop turned out.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'That is the whole club. No lock-in, no filler, no coffee older than it should be — just a new origin at your door each month, and the story that makes it taste like more than a cup.',
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
    heading: 'Talk to the roastery',
    intro: 'A question about a plan, a grind, or which origin to start with? A real person on the team reads every message and answers straight — usually the same day, always over a fresh cup.',
    submitLabel: 'Email the roastery',
  }),
];

// ── Commerce (Latitude Coffee Club — ~13 SKUs incl. the subscription) ────────────

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
  // The typed product type (docs/143) — every product here is `food_beverage`, so the
  // PDP's `pdpAttributes` renders each product's OWN ingredients/allergens/weight/storage/
  // nutrition (real per-product copy, not a hardcoded stack).
  productTypeKey: 'food_beverage';
  attributes: {
    ingredients: string;
    allergens: string[];
    netWeight: string;
    storage: string;
    nutrition: { label: string; value: string }[];
  };
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

const money = (dollars: number): number => Math.round(dollars * 100);
const VENDOR = 'Latitude Coffee Club';

// Grind as one declared option + a SKU per grind — DRY, so the four-grind ladder stays
// one source of truth across every coffee instead of hand-typing four variant rows each.
const GRINDS = ['Whole bean', 'Filter', 'Espresso', 'Aeropress'] as const;
const GRIND_SKU: Record<string, string> = {
  'Whole bean': 'WB',
  Filter: 'FIL',
  Espresso: 'ESP',
  Aeropress: 'AER',
};
function grindOption(): OptionDecl {
  return { name: 'Grind', displayType: 'dropdown', values: GRINDS.map((v) => ({ value: v })) };
}
function grindVariants(skuPrefix: string, dollars: number, defaultValue = 'Whole bean'): Variant[] {
  return GRINDS.map((g) => ({
    sku: `${skuPrefix}-${GRIND_SKU[g]}`,
    priceCents: money(dollars),
    ...(g === defaultValue ? { isDefault: true as const } : {}),
    inventoryPolicy: 'continue' as const,
    optionValues: { Grind: g },
  }));
}

const PRODUCTS: Product[] = [
  {
    handle: 'ethiopia-guji',
    title: 'Ethiopia Guji',
    description:
      'A washed lot from the Guji highlands that drinks like a glass of stone fruit — peach and bergamot up front, a jasmine lift, and a clean, tea-like finish. Grown at altitude by smallholders and roasted light to keep every bit of that brightness. The origin we hand people who think they do not like coffee.',
    status: 'active',
    productType: 'Single-Origin Coffee',
    vendor: VENDOR,
    tags: ['single-origin', 'ethiopia', 'light-roast', 'washed'],
    categoryHandles: ['single-origins'],
    collectionHandles: ['this-months-origins', 'single-origins'],
    seoTitle: 'Ethiopia Guji — washed light-roast single-origin coffee',
    seoDescription: 'A bright, floral washed Ethiopian single origin with peach, bergamot and jasmine notes.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        '100% single-origin arabica coffee — washed Ethiopia Guji, grown at altitude by smallholders in the Guji highlands and roasted light. Nothing else: no flavourings, no blending, no fillers.',
      allergens: [],
      netWeight: '250 g / 8.8 oz',
      storage:
        'Keep the bag sealed, cool and out of direct sun — the one-way valve lets the fresh coffee degas without going stale. Grind as you brew and drink within four weeks of the roast date to catch it at its brightest.',
      nutrition: [
        { label: 'Serving', value: '250 ml brewed, black' },
        { label: 'Calories', value: '2 kcal' },
        { label: 'Caffeine', value: '~120 mg' },
        { label: 'Sugars', value: '0 g' },
      ],
    },
    options: [grindOption()],
    variants: grindVariants('LCC-ETH-GUJI', 22),
    images: [{ assetId: 'ethiopia-guji', isPrimary: true, alt: 'The Ethiopia Guji single origin' }],
  },
  {
    handle: 'colombia-huila',
    title: 'Colombia Huila',
    description:
      'The crowd-pleaser of the shelf. A washed Huila lot roasted to a warm medium — red apple and caramel, a round milk-chocolate body, and just enough acidity to keep it lively. Forgiving to brew, lovely with or without milk, and the bag most club members reorder first.',
    status: 'active',
    productType: 'Single-Origin Coffee',
    vendor: VENDOR,
    tags: ['single-origin', 'colombia', 'medium-roast', 'washed'],
    categoryHandles: ['single-origins'],
    collectionHandles: ['this-months-origins', 'single-origins'],
    seoTitle: 'Colombia Huila — washed medium-roast single-origin coffee',
    seoDescription: 'A balanced washed Colombian single origin with red apple, caramel and milk-chocolate notes.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        '100% single-origin arabica coffee — washed Colombia Huila from a family farm that has grown coffee on the same slope for three generations, roasted to a warm medium. Just coffee, and one origin.',
      allergens: [],
      netWeight: '250 g / 8.8 oz',
      storage:
        'Store sealed and cool, away from the sun and the stove. A medium roast is forgiving, but it is still best within four to five weeks of roasting — grind fresh each time and it will thank you.',
      nutrition: [
        { label: 'Serving', value: '250 ml brewed, black' },
        { label: 'Calories', value: '2 kcal' },
        { label: 'Caffeine', value: '~110 mg' },
        { label: 'Sugars', value: '0 g' },
      ],
    },
    options: [grindOption()],
    variants: grindVariants('LCC-COL-HUILA', 21),
    images: [{ assetId: 'colombia-huila', isPrimary: true, alt: 'The Colombia Huila single origin' }],
  },
  {
    handle: 'kenya-nyeri',
    title: 'Kenya Nyeri',
    description:
      'For the drinker who wants their coffee to talk back. A washed Nyeri lot with a blackcurrant snap, a bright grapefruit acidity and a syrupy, brown-sugar body underneath. Bold, structured and unmistakably Kenyan — best as a pour-over where all that fruit has room to open up.',
    status: 'active',
    productType: 'Single-Origin Coffee',
    vendor: VENDOR,
    tags: ['single-origin', 'kenya', 'light-roast', 'washed'],
    categoryHandles: ['single-origins'],
    collectionHandles: ['this-months-origins', 'single-origins'],
    seoTitle: 'Kenya Nyeri — washed light-roast single-origin coffee',
    seoDescription: 'A bright, structured washed Kenyan single origin with blackcurrant and grapefruit notes.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        '100% single-origin arabica coffee — washed Kenya Nyeri, roasted light to hold on to its blackcurrant snap and syrupy body. One farm, nothing added, nothing hidden.',
      allergens: [],
      netWeight: '250 g / 8.8 oz',
      storage:
        'Keep it sealed, cool and dark. This is a coffee that rewards freshness — all that fruit fades first, so grind right before you brew and finish the bag inside a month of the roast date.',
      nutrition: [
        { label: 'Serving', value: '250 ml brewed, black' },
        { label: 'Calories', value: '2 kcal' },
        { label: 'Caffeine', value: '~125 mg' },
        { label: 'Sugars', value: '0 g' },
      ],
    },
    options: [grindOption()],
    variants: grindVariants('LCC-KEN-NYERI', 24),
    images: [{ assetId: 'kenya-nyeri', isPrimary: true, alt: 'The Kenya Nyeri single origin' }],
  },
  {
    handle: 'house-blend',
    title: 'Latitude House Blend',
    description:
      'The everyday bag we could not not make. A medium roast built from a rotating base of Latin American and East African lots — chocolate, toasted almond and a gentle citrus lift — tuned to be the coffee you can make half-asleep and still get right. Great in a filter, a cafetière or a milky flat white.',
    status: 'active',
    productType: 'Coffee Blend',
    vendor: VENDOR,
    tags: ['blend', 'medium-roast', 'everyday', 'filter'],
    categoryHandles: ['blends'],
    collectionHandles: ['this-months-origins', 'blends'],
    seoTitle: 'Latitude House Blend — everyday medium-roast coffee blend',
    seoDescription: 'A dependable medium-roast house blend with chocolate, toasted almond and a citrus lift.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        '100% arabica coffee blend — a rotating base of washed Latin American and East African lots, roasted medium. A blend of origins and nothing but coffee: no robusta bulk, no flavouring, no oils sprayed on.',
      allergens: [],
      netWeight: '340 g / 12 oz',
      storage:
        'A cool, dark shelf and a sealed bag are all it asks. The everyday bag is built to be reliable rather than fleeting, but it is still at its best within five weeks of roasting — grind fresh and keep it out of the fridge.',
      nutrition: [
        { label: 'Serving', value: '250 ml brewed, black' },
        { label: 'Calories', value: '2 kcal' },
        { label: 'Caffeine', value: '~115 mg' },
        { label: 'Sugars', value: '0 g' },
      ],
    },
    options: [grindOption()],
    variants: grindVariants('LCC-HOUSE', 19),
    images: [{ assetId: 'house-blend', isPrimary: true, alt: 'The Latitude House Blend' }],
  },
  {
    handle: 'midnight-espresso',
    title: 'Midnight Espresso Blend',
    description:
      'Our espresso, built for the machine and the moka pot. A darker roast with a heavy, syrupy body — dark chocolate, dried fig and a molasses sweetness that stands right up to milk without turning bitter. Pulls a thick, forgiving shot, and makes the kind of flat white that ruins you for the café down the road.',
    status: 'active',
    productType: 'Coffee Blend',
    vendor: VENDOR,
    tags: ['blend', 'dark-roast', 'espresso'],
    categoryHandles: ['blends'],
    collectionHandles: ['blends'],
    seoTitle: 'Midnight Espresso Blend — dark-roast espresso coffee',
    seoDescription: 'A dark, syrupy espresso blend with dark chocolate, dried fig and molasses notes.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        '100% arabica coffee blend, roasted dark for espresso and the moka pot. Just coffee — nothing sprayed on, no sweeteners, no chicory. A darker roast, built to stand up to milk.',
      allergens: [],
      netWeight: '340 g / 12 oz',
      storage:
        'Keep it sealed and cool; a dark roast carries a little more surface oil, so heat and light turn it stale faster than a light one. Give a fresh bag two days to rest before you dial in your shots.',
      nutrition: [
        { label: 'Serving', value: '30 ml single shot' },
        { label: 'Calories', value: '1 kcal' },
        { label: 'Caffeine', value: '~75 mg' },
        { label: 'Sugars', value: '0 g' },
      ],
    },
    options: [grindOption()],
    variants: grindVariants('LCC-ESP-MID', 20, 'Espresso'),
    images: [{ assetId: 'espresso-blend', isPrimary: true, alt: 'The Midnight Espresso Blend' }],
  },
  {
    handle: 'brazil-decaf',
    title: 'Brazil Cerrado Decaf',
    description:
      'The decaf that earns its place in the club. A natural Cerrado lot, sugar-cane decaffeinated so nothing chemical touches the bean, roasted medium for a soft, nutty cup — hazelnut, milk chocolate and a hint of brown sugar. All the ritual and none of the buzz, for the afternoon and the evening cup.',
    status: 'active',
    productType: 'Decaf Coffee',
    vendor: VENDOR,
    tags: ['decaf', 'brazil', 'medium-roast', 'natural'],
    categoryHandles: ['decaf'],
    collectionHandles: [],
    seoTitle: 'Brazil Cerrado Decaf — sugar-cane decaffeinated coffee',
    seoDescription: 'A soft, nutty sugar-cane-decaffeinated Brazilian coffee with hazelnut and chocolate notes.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        '100% arabica coffee — a natural Brazil Cerrado lot, roasted medium and sugar-cane decaffeinated. Caffeine is removed with a cane-sugar derivative and water, so nothing chemical ever touches the bean.',
      allergens: [],
      netWeight: '250 g / 8.8 oz',
      storage:
        'Store sealed, cool and out of the sun, exactly like the caffeinated bags. Decaf keeps no better and no worse — grind fresh and enjoy within a month, and it is just as good after dinner as before work.',
      nutrition: [
        { label: 'Serving', value: '250 ml brewed, black' },
        { label: 'Calories', value: '2 kcal' },
        { label: 'Caffeine', value: '<5 mg (decaffeinated)' },
        { label: 'Sugars', value: '0 g' },
      ],
    },
    options: [grindOption()],
    variants: grindVariants('LCC-DEC-BRZ', 21),
    images: [{ assetId: 'decaf-brazil', isPrimary: true, alt: 'The Brazil Cerrado Decaf' }],
  },
  {
    handle: 'cold-brew-blend',
    title: 'Cold Brew Blend',
    description:
      'Coarse-ground and built for the fridge. A blend roasted a touch darker and ground for a long, slow steep — twelve hours in cold water and you have a smooth, low-acid concentrate that tastes of cocoa and dried cherry. Comes in steep bags you drop straight into a jug. Summer in a glass, over ice, all week.',
    status: 'active',
    productType: 'Coffee Blend',
    vendor: VENDOR,
    tags: ['blend', 'cold-brew', 'coarse'],
    categoryHandles: ['blends'],
    collectionHandles: ['blends'],
    seoTitle: 'Cold Brew Blend — coarse-ground cold brew coffee',
    seoDescription: 'A smooth, low-acid cold brew blend in steep bags, with cocoa and dried-cherry notes.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        'Coarse-ground 100% arabica coffee blend in unbleached, biodegradable steep bags. Just coffee, roasted a touch darker and ground for a long cold steep — add cold water and time.',
      allergens: [],
      netWeight: '4 steep bags, 60 g each',
      storage:
        'Keep the sealed pouch somewhere dry and cool. Once brewed, the concentrate keeps in a covered jug in the fridge for up to a week — dilute one part concentrate to one part water or milk over plenty of ice.',
      nutrition: [
        { label: 'Serving', value: '250 ml prepared, black' },
        { label: 'Calories', value: '3 kcal' },
        { label: 'Caffeine', value: '~150 mg' },
        { label: 'Sugars', value: '0 g' },
      ],
    },
    options: [
      { name: 'Pack', displayType: 'dropdown', values: [{ value: '4 steep bags' }, { value: '8 steep bags' }] },
    ],
    variants: [
      { sku: 'LCC-COLD-4', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue', optionValues: { Pack: '4 steep bags' } },
      { sku: 'LCC-COLD-8', priceCents: money(32), inventoryPolicy: 'continue', optionValues: { Pack: '8 steep bags' } },
    ],
    images: [{ assetId: 'cold-brew', isPrimary: true, alt: 'The Cold Brew Blend' }],
  },
  {
    handle: 'ceramic-pour-over-dripper',
    title: 'Ceramic Pour-Over Dripper',
    description:
      'The one piece of gear that changes everything. A hand-glazed ceramic dripper with a single large hole and a tall rib pattern, so water flows evenly and you control the pour. Holds its heat, sits over any mug, and turns a good bag into a great cup. Comes with a starter pack of filters.',
    status: 'active',
    productType: 'Brew Gear',
    vendor: VENDOR,
    tags: ['gear', 'pour-over', 'ceramic', 'brewing'],
    categoryHandles: ['gear'],
    collectionHandles: ['gear'],
    seoTitle: 'Ceramic Pour-Over Dripper — hand-glazed coffee dripper',
    seoDescription: 'A hand-glazed ceramic pour-over dripper with a tall rib pattern, for an even, controlled brew.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        'Hand-thrown stoneware ceramic with a food-safe, lead-free glaze. Ships with a starter pack of oxygen-bleached paper filters cut to fit.',
      allergens: [],
      netWeight: '380 g / 13 oz',
      storage:
        'Hand wash in warm water and air dry — the glaze is dishwasher-safe, but hand washing keeps it looking new. Warm it through with a rinse of hot water before you brew so it does not steal heat from the pour.',
      nutrition: [],
    },
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Cream' }, { value: 'Terracotta' }] },
    ],
    variants: [
      { sku: 'LCC-DRIP-CRM', priceCents: money(34), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Cream' } },
      { sku: 'LCC-DRIP-TER', priceCents: money(34), inventoryPolicy: 'continue', optionValues: { Colour: 'Terracotta' } },
    ],
    images: [{ assetId: 'pour-over-dripper', isPrimary: true, alt: 'The Ceramic Pour-Over Dripper' }],
  },
  {
    handle: 'pour-over-filters',
    title: 'Pour-Over Filters',
    description:
      'The unsung hero of a good cup. A box of one hundred oxygen-bleached paper filters, cut to fit our dripper and thin enough to let the coffee’s clarity through without any papery taste. Rinse one before you brew and it disappears entirely, leaving nothing but a clean, bright cup.',
    status: 'active',
    productType: 'Brew Gear',
    vendor: VENDOR,
    tags: ['gear', 'filters', 'brewing'],
    categoryHandles: ['gear'],
    collectionHandles: ['gear'],
    seoTitle: 'Pour-Over Filters — 100 paper coffee filters',
    seoDescription: 'A box of 100 oxygen-bleached paper pour-over filters, cut to fit the Latitude dripper.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        'Oxygen-bleached paper — no chlorine, no adhesives, and nothing that leaves a papery taste in the cup. One hundred filters, cut to fit the Latitude dripper.',
      allergens: [],
      netWeight: '100 filters, ~120 g',
      storage:
        'Keep the box somewhere dry so the filters do not draw moisture and stick together. Rinse each one through with hot water before you brew to wash off any last paper note and warm the dripper at the same time.',
      nutrition: [],
    },
    variants: [{ sku: 'LCC-FILT-100', priceCents: money(9), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'pour-over-filters', isPrimary: true, alt: 'A box of Pour-Over Filters' }],
  },
  {
    handle: 'enamel-mug',
    title: 'Latitude Enamel Mug',
    description:
      'The mug that comes free with the year-long plan, and that you will reach for every morning anyway. A proper enamel camp mug — chip-resistant, keeps its heat, and just as happy on the kitchen table as halfway up a hill. Holds a generous twelve ounces, which is exactly one good pour-over.',
    status: 'active',
    productType: 'Brew Gear',
    vendor: VENDOR,
    tags: ['gear', 'mug', 'enamel'],
    categoryHandles: ['gear'],
    collectionHandles: ['gear'],
    seoTitle: 'Latitude Enamel Mug — 12oz enamel coffee mug',
    seoDescription: 'A chip-resistant 12oz enamel coffee mug that keeps its heat, at home or on the trail.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        'Enamel-coated steel with a food-safe, chip-resistant vitreous finish and a rolled rim. Holds a generous 12 oz / 350 ml — exactly one good pour-over.',
      allergens: [],
      netWeight: '220 g / 7.8 oz',
      storage:
        'Hand wash and dry — the enamel is happy on a stovetop and around a campfire, but keep it out of the microwave. A chip earned on a trail is character, not a fault; the steel underneath will not rust.',
      nutrition: [],
    },
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Cream' }, { value: 'Terracotta' }] },
    ],
    variants: [
      { sku: 'LCC-MUG-CRM', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Cream' } },
      { sku: 'LCC-MUG-TER', priceCents: money(18), inventoryPolicy: 'continue', optionValues: { Colour: 'Terracotta' } },
    ],
    images: [{ assetId: 'enamel-mug', isPrimary: true, alt: 'The Latitude Enamel Mug' }],
  },
  {
    handle: 'hand-grinder',
    title: 'Hand Coffee Grinder',
    description:
      'Grinding fresh is the single biggest upgrade you can make to your coffee, and this is the tool for it. A compact hand grinder with conical steel burrs and a stepped dial that goes from espresso-fine to cold-brew-coarse. Quiet, consistent, and small enough to pack — so a great cup travels with you.',
    status: 'active',
    productType: 'Brew Gear',
    vendor: VENDOR,
    tags: ['gear', 'grinder', 'burr', 'brewing'],
    categoryHandles: ['gear'],
    collectionHandles: ['gear'],
    seoTitle: 'Hand Coffee Grinder — conical burr hand grinder',
    seoDescription: 'A compact conical-steel-burr hand coffee grinder, adjustable from espresso-fine to coarse.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        'Conical hardened-steel burrs in a brushed aluminium body, with a stepped adjustment dial and a glass catch jar. Goes from espresso-fine to cold-brew-coarse.',
      allergens: [],
      netWeight: '430 g / 15 oz',
      storage:
        'Brush the burrs clean of old grounds every few weeks and keep the whole thing dry — never wash the burrs in water, which dulls the steel and rusts it. A dry brush is the entire maintenance routine.',
      nutrition: [],
    },
    variants: [{ sku: 'LCC-GRIND-01', priceCents: money(59), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'hand-grinder', isPrimary: true, alt: 'The Hand Coffee Grinder' }],
  },
  {
    handle: 'the-origin-gift-set',
    title: 'The Origin Gift Set',
    description:
      'The whole club, wrapped, in a single box — for the person who deserves a good coffee morning. Three of the month’s single origins, a ceramic dripper, a starter pack of filters and an enamel mug, packed in a reusable tin with a hand-written brew guide. The gift that turns someone into a proper coffee drinker.',
    status: 'active',
    productType: 'Gift Set',
    vendor: VENDOR,
    tags: ['gift', 'set', 'starter'],
    categoryHandles: ['gifts'],
    collectionHandles: ['this-months-origins', 'gifts'],
    seoTitle: 'The Origin Gift Set — coffee and brew-gear gift box',
    seoDescription: 'A gift box of three single origins, a ceramic dripper, filters and an enamel mug in a reusable tin.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        'Three 250 g bags of this month’s single-origin arabica coffee, a hand-glazed ceramic dripper, a starter pack of paper filters and an enamel mug, packed in a reusable tin with a hand-written brew guide. The coffee is 100% coffee — nothing added.',
      allergens: [],
      netWeight: '3 × 250 g coffee, plus gear',
      storage:
        'Keep the coffee bags sealed and cool and brew each within four weeks of its roast date; hand wash the dripper and the mug. Everything but the coffee is made to last for years — the tin included.',
      nutrition: [
        { label: 'Serving', value: '250 ml brewed, black' },
        { label: 'Calories', value: '2 kcal' },
        { label: 'Caffeine', value: '~115 mg' },
        { label: 'Sugars', value: '0 g' },
      ],
    },
    variants: [{ sku: 'LCC-GIFT-SET', priceCents: money(72), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'gift-set', isPrimary: true, alt: 'The Origin Gift Set' }],
  },
  {
    handle: 'the-origin-club',
    title: 'The Origin Club',
    description:
      'The subscription at the heart of Latitude. A new single-origin harvest at your door each month — roasted to order, ground the way you brew, and shipped free with the story of the farm that grew it. Pick a plan below: the longer you stay, the more you save, and the year-long plan arrives with a free enamel mug. Pause or cancel any time, no questions.',
    status: 'active',
    productType: 'Subscription',
    vendor: VENDOR,
    tags: ['subscription', 'coffee-club', 'single-origin'],
    categoryHandles: [],
    collectionHandles: ['this-months-origins', 'gifts'],
    seoTitle: 'The Origin Club — monthly single-origin coffee subscription',
    seoDescription: 'A monthly single-origin coffee subscription, roasted to order and shipped free. Pause or cancel any time.',
    productTypeKey: 'food_beverage',
    attributes: {
      ingredients:
        'A fresh single-origin arabica coffee each month — 100% coffee, roasted to order and ground the way you brew. A different farm and harvest every box, and never a flavouring or a filler.',
      allergens: [],
      netWeight: '250 g coffee per month',
      storage:
        'Each month’s bag arrives sealed with a one-way valve; keep it cool and out of the sun and brew within four weeks of the roast date printed on the front. Pause the plan any time and the next box simply waits.',
      nutrition: [
        { label: 'Serving', value: '250 ml brewed, black' },
        { label: 'Calories', value: '2 kcal' },
        { label: 'Caffeine', value: '~120 mg' },
        { label: 'Sugars', value: '0 g' },
      ],
    },
    options: [
      {
        name: 'Plan',
        displayType: 'dropdown',
        values: [
          { value: '12 months' },
          { value: '6 months' },
          { value: '3 months' },
          { value: '1 month' },
        ],
      },
    ],
    variants: [
      { sku: 'LCC-CLUB-12', priceCents: money(15.99), inventoryPolicy: 'continue', optionValues: { Plan: '12 months' } },
      { sku: 'LCC-CLUB-06', priceCents: money(17.99), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: '6 months' } },
      { sku: 'LCC-CLUB-03', priceCents: money(19.99), inventoryPolicy: 'continue', optionValues: { Plan: '3 months' } },
      { sku: 'LCC-CLUB-01', priceCents: money(21.99), inventoryPolicy: 'continue', optionValues: { Plan: '1 month' } },
    ],
    images: [{ assetId: 'the-origin-club', isPrimary: true, alt: 'The Origin Club subscription' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'single-origins', name: 'Single Origins', description: 'One farm, one harvest, one month.', featured: true },
    { handle: 'blends', name: 'Blends', description: 'House, espresso and cold brew, built to be reliable.', featured: true },
    { handle: 'decaf', name: 'Decaf', description: 'All the ritual, none of the buzz.', featured: false },
    { handle: 'gear', name: 'Brew Gear', description: 'The drippers, filters and grinders that finish the cup.', featured: true },
    { handle: 'gifts', name: 'Gifts', description: 'Gift sets for the coffee people in your life.', featured: false },
  ],
  collections: [
    {
      handle: 'this-months-origins',
      name: 'This Month at Latitude',
      description: 'The club, this month’s origins, and the ways to give them.',
      type: 'manual',
      featured: true,
      productHandles: ['the-origin-club', 'ethiopia-guji', 'kenya-nyeri', 'colombia-huila', 'house-blend', 'the-origin-gift-set'],
    },
    {
      handle: 'single-origins',
      name: 'Single Origins',
      description: 'A new coffee-growing origin, roasted the week it ships.',
      type: 'manual',
      featured: false,
      productHandles: ['ethiopia-guji', 'colombia-huila', 'kenya-nyeri'],
    },
    {
      handle: 'blends',
      name: 'Blends',
      description: 'The everyday bags built to be reliable.',
      type: 'manual',
      featured: false,
      productHandles: ['house-blend', 'midnight-espresso', 'cold-brew-blend'],
    },
    {
      handle: 'gear',
      name: 'Brew Gear',
      description: 'Everything you need to brew the club at home.',
      type: 'manual',
      featured: false,
      productHandles: ['ceramic-pour-over-dripper', 'pour-over-filters', 'enamel-mug', 'hand-grinder'],
    },
    {
      handle: 'gifts',
      name: 'Gifts',
      description: 'The club and its coffee, wrapped to give.',
      type: 'manual',
      featured: false,
      productHandles: ['the-origin-gift-set', 'the-origin-club'],
    },
  ],
  products: PRODUCTS,
};

// ── Content (the Latitude Journal) ───────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'the-farmers-behind-this-months-origins',
    status: 'published',
    body: {
      title: 'The farmers behind this month’s origins',
      excerpt: 'A coffee is a place and the people who grow it. Meet the growers whose harvests are in this month’s boxes — and why buying direct changes what ends up in your cup.',
      featuredImage: { $asset: 'post-farmers' },
      body: {
        type: 'doc',
        content: [
          para('Every bag we send has a name on it that is not ours. A washed Ethiopian from a smallholder co-op in Guji. A Huila lot from a family farm that has grown coffee on the same slope for three generations. When we say single origin, we mean it down to the farm — because the farm is where the flavour actually comes from.'),
          h2('We buy the harvest, not the leftovers'),
          para('Most coffee is bought as a commodity, graded and blended until the origin disappears. We do it the slow way instead: we follow the harvest, taste the new lots, and buy the pick of the crop direct from the growers — paying above the fair-trade floor for the coffee we actually want. That premium is not charity. It is what a genuinely good harvest costs, and it is why ours tastes the way it does.'),
          h2('Knowing who grew it changes the cup'),
          para('It sounds sentimental until you taste it side by side. Coffee bought well, from people who are paid to care about the pick and the process, is simply cleaner, sweeter and more alive in the cup than coffee bought cheap. The story on the card in your box is not marketing — it is the reason the coffee is good.'),
          para('So this month, before you grind, read the card. Then taste it knowing whose year of work is in the cup. It will not be the same coffee.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'how-to-brew-a-better-cup-at-home',
    status: 'published',
    body: {
      title: 'How to brew a better cup at home',
      excerpt: 'Great beans are only half of it. The four small changes that will do more for your morning coffee than any new machine — and none of them cost much.',
      featuredImage: { $asset: 'post-brewing' },
      body: {
        type: 'doc',
        content: [
          para('People spend a fortune on machines and then wonder why the café down the road is still better. The truth is that the biggest gains at home are almost free — they are about freshness, grind and a little patience, not equipment. Get these four things right and a good bag becomes a great cup.'),
          h2('Grind fresh, right before you brew'),
          para('Coffee goes stale fast once it is ground — the surface area that makes it taste of anything is also what lets it fade. Grinding the moment before you brew is the single biggest upgrade you can make, which is why every box is ground to order and why a hand grinder is the piece of gear we push hardest.'),
          h2('Weigh it, and use more than you think'),
          para('A kitchen scale takes the guesswork out. Start at sixty grams of coffee per litre of water — roughly one heaped tablespoon per mug — and adjust from there. Most weak coffee at home is simply under-dosed; a little more coffee fixes more cups than any other single change.'),
          h2('Pour slow, and let it bloom'),
          para('Wet the grounds with a little water first and wait thirty seconds — that is the bloom, and it lets the coffee degas so the rest of the pour extracts evenly. Then pour slow and steady in circles. Rushing the pour is how you get a thin, sour cup from perfectly good beans.'),
          para('None of this is fussy once it is habit. Two minutes, a scale and a slow hand, and the coffee you make at home stops being a compromise.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'what-roasting-to-order-actually-means',
    status: 'published',
    body: {
      title: 'What roasting to order actually means',
      excerpt: 'Freshness is the one thing you cannot buy back. Why we roast the week your box ships, and how to tell whether the coffee on your shelf is past its best.',
      featuredImage: { $asset: 'post-roasting' },
      body: {
        type: 'doc',
        content: [
          para('There is a date on a bag of coffee that matters far more than the one most people look for, and it is the roast date. Coffee is at its best in the weeks just after it is roasted, not the months. Roasting to order simply means we do not roast until we know your box is going out — so what lands on your shelf is days old, not a season old.'),
          h2('Coffee has a peak, and it is short'),
          para('For the first day or two after roasting, coffee is actually degassing and tastes a little wild. Then it settles into a window — roughly two to six weeks — where it is at its sweetest and most complex. After that it slowly flattens: still drinkable, but the brightness and the aromatics fade. Supermarket coffee is often well past that window before it is even bought.'),
          h2('How to tell if yours is fresh'),
          para('Fresh coffee blooms. Pour a little hot water on the grounds and watch: if it swells and foams, it is releasing gas and it is fresh; if it just sits there flat, it is old. Once you have seen a lively bloom, you will never quite trust a stale bag again.'),
          para('That window is the whole reason the club works the way it does. We roast small, roast late, and ship fast — so the best weeks of a coffee’s life are spent in your kitchen, not a warehouse.'),
        ],
      },
    },
  },
];

// ── Product detail (the warm, story-led PDP) + Shop ──────────────────────────────
// Bokksu's PDP is a hand-bound-cookbook spread: a big warm image on the left, a calm
// buy column on the right — collection label, serif product title, price, a full-width
// TERRACOTTA promo banner, the real add-to-cart, then a provenance detail stack (DESIGN
// §4 PDP anatomy, §6/§7). Ported to Latitude in the `roastery` theme: `bg-primary` is the
// deep-terracotta fill the banner + CTA call for, `text-primary-content` its readable ink,
// and headings pick up the theme's editorial serif. Bound fields (title/price/image/
// description) come from the shared PDP kit — correct `repeat('product')` scope + `item.*`
// binds — so this one template serves every product at `/products/:handle`. The detail
// stack is no longer hardcoded per template (a bag's storage ≠ a grinder's): `pdpAttributes`
// repeats the routed product's OWN typed `food_beverage` attributes (docs/143) — ingredients,
// allergens, net weight, storage and nutrition — and `pdpPolicyLinks` points at the real
// shipping/returns pages. The layout and the promo banner are ours.

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the big warm product image. Right: the calm buy column, with a terracotta promo
 *  banner between the price and the add-to-cart (the Bokksu "free gifts with the longer
 *  plans" banner, translated to Latitude's roast-to-order promise). */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-16', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          // The big warm image (one bound primary — the storefront fills it per product).
          pdpImage('aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'),
          // The calm buy column.
          el('div', 'flex flex-col gap-6 @3xl:py-4', {
            children: [
              el('div', 'flex flex-col gap-3', {
                children: [
                  // Collection label above the title — the Bokksu breadcrumb/label slot. A
                  // plain <p>, so the product title stays the page's one <h1>.
                  el('p', 'text-sm font-medium uppercase tracking-widest text-base-content', {
                    text: 'Latitude Coffee Club',
                  }),
                  pdpTitle(
                    'h1',
                    'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-5xl'
                  ),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-semibold text-base-content',
                    compareClass: 'text-lg text-base-content line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                  // A real low-stock signal in the terracotta primary — shown only when the
                  // routed product is genuinely running low (never fabricated scarcity).
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 rounded-field bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-content',
                    label: 'Low stock',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              // The full-width terracotta promo banner — a solid `bg-primary` fill whose
              // ink resolves from `text-primary-content`, so it stays AA-legible on cream.
              el('div', 'rounded-box bg-primary p-4 text-primary-content', {
                children: [
                  el('p', 'text-base font-medium text-primary-content', {
                    text: 'Roasted to order, ground the way you brew, and shipped free — every bag and every plan.',
                  }),
                ],
              }),
              // Qty + Add to cart — the deep-terracotta CTA (btn-primary in `roastery`).
              addToCartForm(),
              // The product's OWN typed attributes (ingredients / allergens / net weight /
              // storage / nutrition), repeated from `attributeSections` — real per-product
              // copy, not a hardcoded provenance stack.
              pdpAttributes({
                containerClass: 'mt-2 flex flex-col gap-5',
                sectionClass: 'flex flex-col gap-2 border-t border-base-300 pt-5',
                labelTag: 'h2',
                labelClass: 'text-sm font-semibold uppercase tracking-widest text-base-content',
                valueClass: 'text-base leading-relaxed text-base-content',
                rowClass:
                  'flex items-baseline justify-between gap-4 border-b border-base-200 pb-1',
                rowLabelClass: 'text-base font-medium text-base-content',
                rowValueClass: 'text-base text-base-content',
              }),
              // Shipping & returns — LINKS to the store's real legal pages, never reprinted copy.
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

/** The full warm PDP — the buy region above a quiet "More from this month" carousel of
 *  same-collection coffees (`commerce.related`, the shared kit's default cross-sell). */
const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'More from this month' });

/** The Shop page's own warm header, shown ABOVE the faceted catalogue core the harness
 *  appends. Serif display title + a single warm intro line — the calm, cookbook framing
 *  Latitude gives its listing, in place of the generic "Shop / Everything we have". */
const SHOP: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
            { text: 'The whole coffee shelf' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Every coffee Latitude currently roasts — this month’s single origins, the everyday blends, decaf, brew gear and gifts — filtered and sorted however you like. Roasted to order, shipped free, never older than it should be.',
          }),
        ],
      }),
    ],
  }),
];

// ── The remaining functional pages (bespoke framing over the shared cores) ───────
// Collections / Cart / Search each get Latitude's own warm masthead above the pinned,
// shoppable core the harness appends; the Journal index gets its own origin-stories
// masthead over the shared linkable post grid. Same cream-ground, roastery voice as the
// rest of the site.

/** A plain warm page masthead — an `<h1>` + one intro line on the cream ground. Used for
 *  Collections / Search / Journal, which each want a calm header over their core. */
function pageMasthead(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
            { text: heading }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: lead }),
        ],
      }),
    ],
  });
}

const COLLECTIONS: Node[] = [
  pageMasthead(
    'Coffee, grouped the way you drink it',
    'This month’s single origins, the everyday blends, decaf, the brew gear that finishes the cup and gifts to pass it on — gathered into shelves so you can start wherever your morning does.'
  ),
];

const SEARCH: Node[] = [
  pageMasthead(
    'Find your coffee',
    'After a particular origin, a roast level, or a piece of gear you saw in a box? Search the whole shelf and the Journal below — by country, by tasting note, by name.'
  ),
];

const JOURNAL: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
            { text: 'The Latitude Journal' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Origin stories from the bean belt and notes from the roastery — who grew this month’s coffee, how we roast it, and the small things that turn a good bag into the best cup you make all week.',
          }),
        ],
      }),
    ],
  }),
];

/** The Cart page's own header — a warm reassurance band above the pinned cart core, in
 *  place of the generic "Your cart" heading. Roasted to order, free shipping, and how the
 *  club renews — the three things a coffee-club buyer wants to read before they check out. */
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-5xl',
            { text: 'Your cart' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Nothing here is roasted until you order it — every bag is roasted to order and shipped free within 48 hours, no threshold to clear. Choose a club plan and it simply renews each month at the price you picked; pause or cancel any time, no questions.',
          }),
        ],
      }),
    ],
  }),
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'warm-subscription',
  key: 'sparx-warm-subscription',
  name: 'Warm Subscription',
  summary:
    'A warm, editorial storefront for a subscription food & drink brand — a full-bleed cream-and-terracotta hero over a "how the club works" trio, provenance editorial bands, shoppable carousels, a static subscription plan-selector and an inclusion list, in a bespoke warm `roastery` theme with an espresso footer island. Modelled on the warm-subscription / food-editorial archetype; shipped as Latitude Coffee Club, a single-origin coffee subscription and roastery.',
  tagline: 'A warm, story-rich template for subscription and specialty food & drink brands.',
  vertical: 'retail',
  industry: 'Coffee subscription & roastery',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 80,
  brand: {
    businessName: 'Latitude Coffee Club',
    tagline: 'A new origin at your door each month.',
  },
  // Bokksu chrome: a brand-left wordmark with a prominent "Join the club" call to action
  // in the bar (`brandLeft` + `showCta: true`), and the warm editorial newsletter footer
  // (`newsletter`) whose subscribe strip carries the "join our list" capture and whose
  // bottom bar carries the live © business name — so the home page adds no signup of its own.
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Latitude Coffee Club — single-origin coffee, roasted to order',
      description:
        'Latitude Coffee Club sends a fresh single-origin harvest to your door each month, roasted to order, with the story of the farm that grew it.',
    },
    about: {
      title: 'About Latitude Coffee Club',
      description:
        'How Latitude Coffee Club sources single-origin coffee, roasts to order, and puts a farmer’s name on every bag.',
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

  // Oracle 1 — the emitted bundle validates through the real loader.
  const mod = (await import(pathToFileURL(join(dir, 'blueprint.ts')).href)) as {
    default: unknown;
  };
  const result = safeParseBlueprint(mod.default);
  if (result.success) {
    console.log('· safeParseBlueprint → VALID');
  } else {
    console.error('· safeParseBlueprint → INVALID');
    for (const issue of result.issues) console.error(`    ${issue.path}: ${issue.message}`);
    process.exitCode = 1;
    return;
  }

  // Oracle 3 — a self-contained home-page preview for visual review.
  const { path: previewPath } = await writeTemplatePreview(SPEC, theme);
  console.log(`· preview → ${previewPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
