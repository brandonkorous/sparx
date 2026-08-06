// sparx-natural-clean — the natural / sustainable-clean reference-driven site template
// (docs/templates/allbirds).
//
// Allbirds translated to sparx: a calm, oat-tinted storefront that sells MATERIALS and
// MISSION before SKUs, ported to an eco everyday-housewares shop — Fernwood Goods,
// "Everyday things, honestly made". The home page keeps the Allbirds spine — a full-bleed
// hero, a band of color-blocked category tiles that state the earth palette, then a
// repeating shoppable-carousel → material-story-band cycle that closes on a quiet
// sustainability moment before the footer — dressed in the bespoke `sage-oat` theme
// (warm oat paper, near-black mono primary, olive + sage earth support).
//
// This file is JUST the SPEC; the composition + emission live in the shared
// `template-sites/harness.ts`. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-natural-clean.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-natural-clean/**" \
//     "marketplace-catalog/_gen/gen-template-natural-clean.ts"
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
  sectionHead,
  CARD,
} from '../../packages/silica-catalog/src/sections/_shell';
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import {
  addToCartForm,
  pdpDescription,
  pdpImage,
  pdpPriceRow,
  pdpTitle,
  productPage,
} from './template-sites/pdp';

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Royalty-free Unsplash photographs, each verified reachable (HTTP 200) at authoring
// time. Product + post images go through `assets` by id (the installer re-hosts them);
// the hero / material-band photos are natural imagery, so they hot-link the same URL
// inline (docs/54 §6) — they still appear in `assets` as the single documented registry
// of the bundle's imagery + alt text.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
  // Products (eco housewares)
  dishTowels: '1558495122-89ba11e1f697',
  beeswaxWraps: '1632142334452-7efccdbf9a1d',
  bambooUtensils: '1580151820172-ae6491498c54',
  linenTeaTowels: '1554042861-c5b9add98f2c',
  castileSoap: '1600857544200-b2f666a9a2ec',
  woolDryerBalls: '1641060889144-1cc91e6871ce',
  coconutBrushes: '1585426096237-4c5ed456966f',
  seagrassBaskets: '1455669175216-9017c9b02fc6',
  glassJars: '1594813591867-02e797aa4581',
  stonewareMugs: '1495100497150-fe209c585f50',
  servingBowl: '1510035618584-c442b241abe7',
  bathTowels: '1523471826770-c437b4636fe6',
  // Journal posts
  postMaterials: '1615799998603-7c6270a45196',
  postBeeswax: '1556037843-347ddff9f4b0',
  postCarbon: '1533038590840-1cde6e668a91',
  // Hero + material-story bands (natural imagery)
  hero: '1617228069096-4638a7ffc906',
  bandMaterials: '1528458909336-e7a0adfed0a5',
  bandCare: '1666934209606-a955a12edd63',
  bandMission: '1611255550543-b5ecb01dfddc',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'organic-cotton-dish-towels', url: U(IMG.dishTowels), alt: 'Folded cotton dish towels on a wooden counter' },
  { id: 'beeswax-food-wraps', url: U(IMG.beeswaxWraps), alt: 'Beeswax food wraps folded on a table' },
  { id: 'bamboo-utensil-set', url: U(IMG.bambooUtensils), alt: 'A set of wooden kitchen utensils in a jar' },
  { id: 'linen-tea-towels', url: U(IMG.linenTeaTowels), alt: 'A stack of natural linen tea towels' },
  { id: 'castile-soap-bars', url: U(IMG.castileSoap), alt: 'Plain natural soap bars' },
  { id: 'wool-dryer-balls', url: U(IMG.woolDryerBalls), alt: 'Wool dryer balls in a bowl' },
  { id: 'coconut-scrub-brushes', url: U(IMG.coconutBrushes), alt: 'A wooden dish brush with natural bristles' },
  { id: 'seagrass-storage-baskets', url: U(IMG.seagrassBaskets), alt: 'A woven seagrass storage basket' },
  { id: 'glass-storage-jars', url: U(IMG.glassJars), alt: 'Glass storage jars in a row' },
  { id: 'stoneware-mug-set', url: U(IMG.stonewareMugs), alt: 'A set of hand-glazed stoneware mugs' },
  { id: 'stoneware-serving-bowl', url: U(IMG.servingBowl), alt: 'A hand-thrown stoneware serving bowl' },
  { id: 'organic-cotton-bath-towels', url: U(IMG.bathTowels), alt: 'Folded organic cotton bath towels' },
  { id: 'post-materials', url: U(IMG.postMaterials), alt: 'A close-up of natural linen weave' },
  { id: 'post-beeswax', url: U(IMG.postBeeswax), alt: 'A beeswax wrap over a bowl' },
  { id: 'post-carbon', url: U(IMG.postCarbon), alt: 'Green eucalyptus leaves in soft light' },
  { id: 'hero-home', url: U(IMG.hero), alt: 'A calm, naturally lit kitchen in wood and stone' },
  { id: 'band-materials', url: U(IMG.bandMaterials), alt: 'A close-up of woven natural fibre' },
  { id: 'band-care', url: U(IMG.bandCare), alt: 'Neatly folded natural textiles' },
  { id: 'band-mission', url: U(IMG.bandMission), alt: 'Fresh green leaves against soft light' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-natural-clean: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections (the Allbirds sequence) ───────────────────────────────────

/** The full-bleed hero — one natural photograph filling the width, the headline and two
 *  actions in a solid readable oat panel over it (the `hero_overlay` shape). Tenant
 *  content, so it hot-links a real photograph; every class is a NAMED utility so it
 *  survives the stamp into the tenant's stored tree. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('hero-home'), alt: 'A calm, naturally lit kitchen in wood and stone', loading: 'lazy' },
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
                  { text: 'A home made from honest things' }
                ),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Everyday housewares in cotton, linen, wood and glass — the useful, unfussy things a kitchen and a home actually run on, made from what the earth gives back and built to be kept.',
                }),
                actions([
                  primaryAction('Shop everything', '/shop'),
                  secondaryAction('Read the journal', '/journal'),
                ]),
              ],
            }),
          ],
        }
      ),
    ],
  });
}

/** The color-blocked category tiles right under the hero — the Allbirds `category_row`.
 *  Solid earth-palette swatches (secondary olive, accent sage, neutral, primary, and a
 *  plain surface) that both NAVIGATE and state the brand palette in one band. Each tile
 *  is a filled `<a>` whose label rides the fill's own paired on-colour, so it stays
 *  readable on every theme. */
function categoryTiles(): Node {
  const tile = (label: string, href: string, cls: string): Node =>
    el('a', `flex aspect-square flex-col justify-end rounded-box p-6 ${cls}`, {
      attrs: { href },
      children: [el('span', 'text-xl font-semibold', { text: label })],
    });
  return section([
    sectionHead(
      'Room by room',
      'Five small collections for the parts of a home that get used every day.'
    ),
    el('div', 'grid grid-cols-2 gap-4 @2xl:grid-cols-3 @3xl:grid-cols-5', {
      children: [
        tile('Kitchen', '/shop', 'bg-secondary text-secondary-content'),
        tile('Cleaning', '/shop', 'bg-accent text-accent-content'),
        tile('Storage', '/shop', 'bg-neutral text-neutral-content'),
        tile('Tableware', '/shop', 'bg-base-300 text-base-content'),
        tile('Bath & textiles', '/shop', 'bg-primary text-primary-content'),
      ],
    }),
  ]);
}

/** A full-bleed material-story band — a photograph carrying a plain-language "nature you
 *  can feel" note and a quiet text link (the Allbirds signature: materials as the product
 *  story). The panel is a solid oat card so the copy is readable over any photo. */
function materialBand(o: {
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

/** The three plain promises — the Allbirds value-prop row. Neutral chassis cards; the
 *  colour on this page is carried by the category tiles, the primary actions and the
 *  material bands, so these stay quiet on purpose (RULE #4 — neutral is the chassis). */
function valueProps(): Node {
  return section([
    sectionHead(
      'Plainly put',
      'No mystery materials, no throwaway design, and nothing you cannot refill, compost or hand down.'
    ),
    gridThree([
      card(CARD, [
        cardTitle('From the earth'),
        body(
          'Cotton, linen, wood, glass, beeswax and stone — grown or dug, not drilled. Every material a thing is made from is on the label.'
        ),
      ]),
      card(CARD, [
        cardTitle('Made to last'),
        body(
          'These are things you buy once. Keep them well and most will outlive the shelf you bought them for — which is the cheapest, greenest thing they can do.'
        ),
      ]),
      card(CARD, [
        cardTitle('Kind at the end'),
        body(
          'When something finally wears out it composts, recycles or refills. Nothing here is designed to spend a century in the ground.'
        ),
      ]),
    ]),
  ]);
}

/** The journal strip — three real posts as static cards linking to `/journal/<slug>`
 *  (a CMS list source exposes no per-item href, so a linked index is hand-authored cards;
 *  `/blog` is the storefront's post route, so the index lives at `/journal`). */
function journalStrip(): Node {
  const postCard = (slug: string, title: string, assetId: string, alt: string): Node =>
    el('a', 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-100 overflow-hidden hover:border-primary', {
      attrs: { href: `/journal/${slug}` },
      children: [
        el('img', 'aspect-video w-full bg-base-200 object-cover', {
          attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
        }),
        el('h3', 'px-5 pb-5 text-xl font-semibold text-base-content', { text: title }),
      ],
    });
  return section([
    sectionHead(
      'From the journal',
      'What we make things from, how to keep them, and how we are doing on the planet — written plainly.'
    ),
    gridThree([
      postCard('how-we-choose-materials', 'How we choose our materials', 'post-materials', 'A close-up of natural linen weave'),
      postCard('the-life-of-a-beeswax-wrap', 'The life of a beeswax wrap', 'post-beeswax', 'A beeswax wrap over a bowl'),
      postCard('our-first-carbon-report', 'Our first carbon report', 'post-carbon', 'Green eucalyptus leaves in soft light'),
    ]),
  ]);
}

const HOME: Node[] = [
  hero(),
  categoryTiles(),
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'What people buy again' }),
  materialBand({
    heading: 'Made from what grows back',
    lead: 'Nothing here starts life in an oil well. Organic cotton, fast-growing bamboo, beeswax, seagrass and sand-into-glass — materials a field or a forest makes more of every year, chosen because they do the job and leave less behind.',
    assetId: 'band-materials',
    alt: 'A close-up of woven natural fibre',
    cta: 'How we choose materials',
    href: '/journal',
  }),
  productsBlock({ source: 'commerce.category.kitchen', layout: 'carousel', heading: 'For the kitchen' }),
  materialBand({
    heading: 'Made to be kept, not replaced',
    lead: 'A dish towel that lasts ten years is cheaper and greener than ten that last one. We build for a long life and tell you plainly how to keep each thing going — wash it, oil it, refill it, and pass it on.',
    assetId: 'band-care',
    alt: 'Neatly folded natural textiles',
    cta: 'Caring for your things',
    href: '/journal',
  }),
  productsBlock({ source: 'commerce.category.cleaning', layout: 'carousel', heading: 'For clearing up' }),
  valueProps(),
  materialBand({
    heading: 'A gentler way to make things',
    lead: 'We measure what we make — the water, the carbon, the waste — and publish it, warts and all. A small shop, honest numbers, and a plan to do a little better every year.',
    assetId: 'band-mission',
    alt: 'Fresh green leaves against soft light',
    cta: 'Read our first report',
    href: '/journal',
  }),
  journalStrip(),
  // NB: no page-level newsletter band here — the `footer: 'newsletter'` chrome variant
  // carries the "join our emails" capture, so a section here would be two back-to-back
  // signups.
];

// ── About + Contact (Fernwood-voiced) ─────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-semibold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'About Fernwood Goods',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Fernwood Goods is a small shop of everyday housewares — the towels, jars, brushes, baskets and bowls a home runs on — made from materials the earth makes more of. We started it because the ordinary things in most kitchens are quietly made of plastic and built to be thrown away, and we thought the useful stuff could be honest stuff instead.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'So every item here earns its place twice: it has to work as well as the thing it replaces, and it has to be made from something you can name — cotton, linen, wood, glass, beeswax, stone. We tell you what each thing is made of, where it came from, and how to keep it going for years. That is the whole idea: everyday things, honestly made.',
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
          el('h1', 'text-4xl font-semibold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'Say hello',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'A real person reads every message and replies, usually the same day. Ask us what something is made of, how to care for it, or what to buy for a home that is trying to use less plastic — we are happy to help.',
          }),
          el('a', 'btn btn-primary btn-lg', {
            attrs: { href: 'mailto:hello@fernwoodgoods.example' },
            text: 'Email the shop',
          }),
        ],
      }),
    ],
  }),
];

// ── Commerce (Fernwood Goods — 12 SKUs) ───────────────────────────────────────────

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

const money = (dollars: number): number => Math.round(dollars * 100);

const PRODUCTS: Product[] = [
  {
    handle: 'organic-cotton-dish-towels',
    title: 'Organic Cotton Dish Towels',
    description:
      'A set of three generously sized dish towels woven from GOTS-certified organic cotton, with a waffle weave that actually dries a plate instead of pushing the water around. They soften with every wash, hang from a sewn-in loop, and go on the compost heap in shreds when a decade of use finally finishes them.',
    status: 'active',
    productType: 'Kitchen textiles',
    vendor: 'Fernwood Goods',
    tags: ['organic cotton', 'kitchen', 'dish towels', 'plastic-free'],
    categoryHandles: ['kitchen'],
    collectionHandles: ['best-sellers', 'kitchen'],
    seoTitle: 'Organic Cotton Dish Towels — set of three waffle-weave towels',
    seoDescription: 'A set of three GOTS-certified organic cotton waffle-weave dish towels that soften with every wash.',
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Natural' }, { value: 'Sage' }] },
    ],
    variants: [
      { sku: 'FWD-DISHTOWEL-NAT', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Natural' } },
      { sku: 'FWD-DISHTOWEL-SAG', priceCents: money(24), inventoryPolicy: 'continue', optionValues: { Colour: 'Sage' } },
    ],
    images: [{ assetId: 'organic-cotton-dish-towels', isPrimary: true, alt: 'The Organic Cotton Dish Towels' }],
  },
  {
    handle: 'beeswax-food-wraps',
    title: 'Beeswax Food Wraps',
    description:
      'The plastic wrap you never throw away. Organic cotton dipped in beeswax, tree resin and jojoba oil, so the warmth of your hands moulds it around a bowl, a lemon half or a loaf of bread. Wash it in cool water, use it for a year or more, then compost it or wrap it round kindling to light a fire.',
    status: 'active',
    productType: 'Kitchen',
    vendor: 'Fernwood Goods',
    tags: ['beeswax', 'kitchen', 'plastic-free', 'reusable'],
    categoryHandles: ['kitchen'],
    collectionHandles: ['best-sellers', 'kitchen'],
    seoTitle: 'Beeswax Food Wraps — reusable plastic-free food wraps',
    seoDescription: 'Organic cotton beeswax wraps that mould to a bowl with the warmth of your hands and compost at the end.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: 'Set of 3' }, { value: 'Set of 5' }] },
    ],
    variants: [
      { sku: 'FWD-BEESWAX-3', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Set of 3' } },
      { sku: 'FWD-BEESWAX-5', priceCents: money(28), inventoryPolicy: 'continue', optionValues: { Size: 'Set of 5' } },
    ],
    images: [{ assetId: 'beeswax-food-wraps', isPrimary: true, alt: 'The Beeswax Food Wraps' }],
  },
  {
    handle: 'bamboo-utensil-set',
    title: 'Bamboo Utensil Set',
    description:
      'Five kitchen tools — spoon, slotted spoon, spatula, turner and salad fork — carved from a single stand of fast-growing bamboo, which grows back faster than any hardwood we could have used. Kind to a non-stick pan, warm in the hand, and finished with a food-safe oil you can refresh in a minute.',
    status: 'active',
    productType: 'Kitchen',
    vendor: 'Fernwood Goods',
    tags: ['bamboo', 'kitchen', 'utensils', 'renewable'],
    categoryHandles: ['kitchen'],
    collectionHandles: ['new-arrivals', 'kitchen'],
    seoTitle: 'Bamboo Utensil Set — five-piece fast-growing bamboo kitchen tools',
    seoDescription: 'A five-piece bamboo utensil set, kind to non-stick pans and finished in food-safe oil.',
    variants: [{ sku: 'FWD-BAMBOO-SET', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'bamboo-utensil-set', isPrimary: true, alt: 'The Bamboo Utensil Set' }],
  },
  {
    handle: 'linen-tea-towels',
    title: 'Linen Tea Towels',
    description:
      'A pair of tea towels woven from European flax linen — the fibre that needs almost no water or spray to grow, and gets softer and more absorbent the more you use it. Lint-free for a polished glass, quick to dry so they never turn musty, and finished with a hanging loop and a plainly stitched edge.',
    status: 'active',
    productType: 'Kitchen textiles',
    vendor: 'Fernwood Goods',
    tags: ['linen', 'kitchen', 'tea towels', 'flax'],
    categoryHandles: ['kitchen'],
    collectionHandles: ['new-arrivals', 'kitchen'],
    seoTitle: 'Linen Tea Towels — pair of European flax linen towels',
    seoDescription: 'A pair of lint-free European flax linen tea towels that soften and absorb more with use.',
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Oat' }, { value: 'Clay' }] },
    ],
    variants: [
      { sku: 'FWD-TEATOWEL-OAT', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Oat' } },
      { sku: 'FWD-TEATOWEL-CLA', priceCents: money(22), inventoryPolicy: 'continue', optionValues: { Colour: 'Clay' } },
    ],
    images: [{ assetId: 'linen-tea-towels', isPrimary: true, alt: 'The Linen Tea Towels' }],
  },
  {
    handle: 'castile-soap-bars',
    title: 'Castile Soap Bars',
    description:
      'A trio of hard-milled castile soap bars made from olive and coconut oil and nothing you cannot pronounce — no palm oil, no synthetic fragrance, no plastic. One bar does the sink, the shower and the hands, lasts for weeks, and arrives wrapped in paper you can plant or compost.',
    status: 'active',
    productType: 'Cleaning',
    vendor: 'Fernwood Goods',
    tags: ['castile soap', 'cleaning', 'palm-oil-free', 'plastic-free'],
    categoryHandles: ['cleaning'],
    collectionHandles: ['best-sellers', 'cleaning'],
    seoTitle: 'Castile Soap Bars — set of three olive-oil soap bars',
    seoDescription: 'A trio of hard-milled olive and coconut castile soap bars, palm-oil-free and plastic-free.',
    options: [
      { name: 'Scent', displayType: 'dropdown', values: [{ value: 'Unscented' }, { value: 'Lavender' }] },
    ],
    variants: [
      { sku: 'FWD-CASTILE-UNS', priceCents: money(14), isDefault: true, inventoryPolicy: 'continue', optionValues: { Scent: 'Unscented' } },
      { sku: 'FWD-CASTILE-LAV', priceCents: money(15), inventoryPolicy: 'continue', optionValues: { Scent: 'Lavender' } },
    ],
    images: [{ assetId: 'castile-soap-bars', isPrimary: true, alt: 'The Castile Soap Bars' }],
  },
  {
    handle: 'wool-dryer-balls',
    title: 'Wool Dryer Balls',
    description:
      'Six balls of dense New Zealand wool that replace single-use dryer sheets for good. They bounce between your clothes to cut drying time by a quarter, soften without any coating, and take a few drops of essential oil if you like a scent. They last for a thousand loads, then go on the compost.',
    status: 'active',
    productType: 'Cleaning',
    vendor: 'Fernwood Goods',
    tags: ['wool', 'laundry', 'cleaning', 'reusable'],
    categoryHandles: ['cleaning'],
    collectionHandles: ['cleaning'],
    seoTitle: 'Wool Dryer Balls — set of six New Zealand wool dryer balls',
    seoDescription: 'Six New Zealand wool dryer balls that cut drying time and replace single-use dryer sheets.',
    variants: [{ sku: 'FWD-DRYERBALL-6', priceCents: money(26), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'wool-dryer-balls', isPrimary: true, alt: 'The Wool Dryer Balls' }],
  },
  {
    handle: 'coconut-scrub-brushes',
    title: 'Coconut Scrub Brushes',
    description:
      'A pair of dish brushes with beechwood handles and stiff coconut-coir bristles that scour a burnt pan without a scrap of plastic. When the head finally wears down you unclip it for the compost and click a fresh one onto the same handle — a brush you refill instead of replace.',
    status: 'active',
    productType: 'Cleaning',
    vendor: 'Fernwood Goods',
    tags: ['coconut coir', 'cleaning', 'plastic-free', 'refillable'],
    categoryHandles: ['cleaning'],
    collectionHandles: ['cleaning'],
    seoTitle: 'Coconut Scrub Brushes — pair of refillable dish brushes',
    seoDescription: 'A pair of beechwood dish brushes with compostable coconut-coir heads you refill, not replace.',
    variants: [{ sku: 'FWD-SCRUBBRUSH-2', priceCents: money(16), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'coconut-scrub-brushes', isPrimary: true, alt: 'The Coconut Scrub Brushes' }],
  },
  {
    handle: 'seagrass-storage-baskets',
    title: 'Seagrass Storage Baskets',
    description:
      'A hand-woven basket of seagrass — a plant that regrows in the shallows and needs no farming at all — with sturdy handles and a soft, structured shape that holds its form under a load of blankets, toys or firewood. Every one is woven by hand, so no two are exactly alike, and it lasts for years of daily lifting.',
    status: 'active',
    productType: 'Storage',
    vendor: 'Fernwood Goods',
    tags: ['seagrass', 'storage', 'basket', 'handwoven'],
    categoryHandles: ['storage'],
    collectionHandles: ['best-sellers', 'storage'],
    seoTitle: 'Seagrass Storage Baskets — hand-woven seagrass baskets',
    seoDescription: 'A hand-woven seagrass storage basket with sturdy handles that holds its shape under a load.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: 'Small' }, { value: 'Large' }] },
    ],
    variants: [
      { sku: 'FWD-BASKET-SM', priceCents: money(38), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Small' } },
      { sku: 'FWD-BASKET-LG', priceCents: money(54), inventoryPolicy: 'continue', optionValues: { Size: 'Large' } },
    ],
    images: [{ assetId: 'seagrass-storage-baskets', isPrimary: true, alt: 'The Seagrass Storage Baskets' }],
  },
  {
    handle: 'glass-storage-jars',
    title: 'Glass Storage Jars',
    description:
      'A set of thick recycled-glass jars with a bamboo lid and a silicone seal, for the pantry staples that used to live in plastic. You can see what is in them, they wash in the machine forever, and glass is the one material you can recycle again and again with nothing lost. Airtight enough for flour, coffee or the good biscuits.',
    status: 'active',
    productType: 'Storage',
    vendor: 'Fernwood Goods',
    tags: ['recycled glass', 'storage', 'jars', 'pantry'],
    categoryHandles: ['storage'],
    collectionHandles: ['new-arrivals', 'storage'],
    seoTitle: 'Glass Storage Jars — recycled-glass pantry jars with bamboo lids',
    seoDescription: 'A set of airtight recycled-glass storage jars with bamboo lids and silicone seals for the pantry.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: 'Set of 3' }, { value: 'Set of 6' }] },
    ],
    variants: [
      { sku: 'FWD-GLASSJAR-3', priceCents: money(34), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Set of 3' } },
      { sku: 'FWD-GLASSJAR-6', priceCents: money(58), inventoryPolicy: 'continue', optionValues: { Size: 'Set of 6' } },
    ],
    images: [{ assetId: 'glass-storage-jars', isPrimary: true, alt: 'The Glass Storage Jars' }],
  },
  {
    handle: 'stoneware-mug-set',
    title: 'Stoneware Mug Set',
    description:
      'Four mugs thrown from local stoneware clay and glazed in a soft matte that breaks to bare clay at the rim. They hold a proper amount of coffee, keep it warm, and are heavy enough to feel like something. Fired once, kept for years, and made from clay dug rather than a resin poured.',
    status: 'active',
    productType: 'Tableware',
    vendor: 'Fernwood Goods',
    tags: ['stoneware', 'tableware', 'mugs', 'handmade'],
    categoryHandles: ['tableware'],
    collectionHandles: ['best-sellers'],
    seoTitle: 'Stoneware Mug Set — set of four hand-glazed stoneware mugs',
    seoDescription: 'A set of four stoneware mugs in a soft matte glaze that breaks to bare clay at the rim.',
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Oatmeal' }, { value: 'Clay' }] },
    ],
    variants: [
      { sku: 'FWD-MUG-OAT', priceCents: money(44), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Oatmeal' } },
      { sku: 'FWD-MUG-CLA', priceCents: money(44), inventoryPolicy: 'continue', optionValues: { Colour: 'Clay' } },
    ],
    images: [{ assetId: 'stoneware-mug-set', isPrimary: true, alt: 'The Stoneware Mug Set' }],
  },
  {
    handle: 'stoneware-serving-bowl',
    title: 'Stoneware Serving Bowl',
    description:
      'A wide, low serving bowl thrown by hand from stoneware clay — big enough for a salad for the table or a bowl of fruit on the counter, and handsome enough to leave out. The speckled oatmeal glaze suits whatever you put in it, and stoneware simply outlasts the plastic and melamine it replaces.',
    status: 'active',
    productType: 'Tableware',
    vendor: 'Fernwood Goods',
    tags: ['stoneware', 'tableware', 'serving bowl', 'handmade'],
    categoryHandles: ['tableware'],
    collectionHandles: ['new-arrivals'],
    seoTitle: 'Stoneware Serving Bowl — wide hand-thrown serving bowl',
    seoDescription: 'A wide, low hand-thrown stoneware serving bowl in a speckled oatmeal glaze.',
    variants: [{ sku: 'FWD-BOWL', priceCents: money(48), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'stoneware-serving-bowl', isPrimary: true, alt: 'The Stoneware Serving Bowl' }],
  },
  {
    handle: 'organic-cotton-bath-towels',
    title: 'Organic Cotton Bath Towels',
    description:
      'A pair of bath towels woven from long-staple organic cotton, thirsty from the first wash rather than the tenth and free of the softening coatings that stop cheaper towels absorbing at all. Undyed or coloured with low-impact dye, hemmed to hold their shape, and the kind of everyday thing worth buying once and keeping.',
    status: 'active',
    productType: 'Textiles',
    vendor: 'Fernwood Goods',
    tags: ['organic cotton', 'bath', 'towels', 'textiles'],
    categoryHandles: ['textiles'],
    collectionHandles: ['new-arrivals'],
    seoTitle: 'Organic Cotton Bath Towels — pair of long-staple cotton towels',
    seoDescription: 'A pair of long-staple organic cotton bath towels, thirsty from the first wash and free of softening coatings.',
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Oat' }, { value: 'Slate' }] },
    ],
    variants: [
      { sku: 'FWD-BATHTOWEL-OAT', priceCents: money(42), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Oat' } },
      { sku: 'FWD-BATHTOWEL-SLT', priceCents: money(42), inventoryPolicy: 'continue', optionValues: { Colour: 'Slate' } },
    ],
    images: [{ assetId: 'organic-cotton-bath-towels', isPrimary: true, alt: 'The Organic Cotton Bath Towels' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'kitchen', name: 'Kitchen', description: 'The useful, unfussy things a kitchen runs on.', featured: true },
    { handle: 'cleaning', name: 'Cleaning', description: 'Plastic-free ways to keep a home clean.', featured: true },
    { handle: 'tableware', name: 'Tableware', description: 'Hand-made stoneware for the table.', featured: true },
    { handle: 'storage', name: 'Storage', description: 'Baskets and jars for keeping things.', featured: false },
    { handle: 'textiles', name: 'Bath & textiles', description: 'Towels in organic cotton and linen.', featured: false },
  ],
  collections: [
    {
      handle: 'best-sellers',
      name: 'Best Sellers',
      description: 'The everyday things people come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['organic-cotton-dish-towels', 'beeswax-food-wraps', 'castile-soap-bars', 'seagrass-storage-baskets', 'stoneware-mug-set'],
    },
    {
      handle: 'new-arrivals',
      name: 'New Arrivals',
      description: 'The latest additions to the shop.',
      type: 'manual',
      featured: false,
      productHandles: ['bamboo-utensil-set', 'linen-tea-towels', 'glass-storage-jars', 'stoneware-serving-bowl', 'organic-cotton-bath-towels'],
    },
    {
      handle: 'kitchen',
      name: 'Kitchen',
      description: 'Everyday tools and textiles for cooking and clearing.',
      type: 'manual',
      featured: false,
      productHandles: ['organic-cotton-dish-towels', 'beeswax-food-wraps', 'bamboo-utensil-set', 'linen-tea-towels'],
    },
    {
      handle: 'cleaning',
      name: 'Cleaning',
      description: 'Plastic-free soap, brushes and laundry.',
      type: 'manual',
      featured: false,
      productHandles: ['castile-soap-bars', 'wool-dryer-balls', 'coconut-scrub-brushes'],
    },
    {
      handle: 'storage',
      name: 'Storage',
      description: 'Woven baskets and recycled-glass jars.',
      type: 'manual',
      featured: false,
      productHandles: ['seagrass-storage-baskets', 'glass-storage-jars'],
    },
  ],
  products: PRODUCTS,
};

// ── Content (the Fernwood journal) ────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'how-we-choose-materials',
    status: 'published',
    body: {
      title: 'How we choose our materials',
      excerpt: 'The one question every product has to answer before it earns a place in the shop — and why "what is it made of?" is harder than it sounds.',
      featuredImage: { $asset: 'post-materials' },
      body: {
        type: 'doc',
        content: [
          para('Most housewares are quietly made of plastic. A dish brush, a food wrap, a laundry sheet, a storage tub — reach into an ordinary cupboard and almost everything in it started as oil and will end as landfill. We started Fernwood to see whether the useful, boring things could be made of something else without asking anyone to try harder or spend a fortune.'),
          h2('Grown or dug, not drilled'),
          para('The first test is simple: can we name what a thing is made of, and does the earth make more of it? Organic cotton and flax linen grow in a field. Bamboo and seagrass grow back faster than we can cut them. Glass is sand, and it recycles forever. Beeswax comes from bees, clay comes from the ground. If the honest answer to "what is it made of?" is a chemical nobody can pronounce, it does not go in the shop.'),
          h2('It still has to work'),
          para('The second test is the one that fails most "eco" products: it has to work at least as well as the plastic thing it replaces. A compostable brush that will not scrub a pan is not a win — it is a thing you use once and give up on. So every item earns its place twice, on the material and on the job, and plenty of samples never make it past the sink.'),
          para('None of this is complicated. It is just slower, and it means saying no to a lot of things that would sell. That is the trade we made, and it is the whole reason the shop exists.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'the-life-of-a-beeswax-wrap',
    status: 'published',
    body: {
      title: 'The life of a beeswax wrap',
      excerpt: 'How to get a year or more out of a food wrap, when to retire it, and the surprisingly good thing you can do with it at the end.',
      featuredImage: { $asset: 'post-beeswax' },
      body: {
        type: 'doc',
        content: [
          para('A beeswax wrap is the rare swap that is genuinely nicer to use than the thing it replaces. The warmth of your hands softens the wax so it clings to a bowl or folds around a sandwich, and it peels away clean. But it is a natural thing, not a plastic one, so it lives by a few plain rules.'),
          h2('Cool water, no heat'),
          para('Wash it in cool water with a little mild soap and let it air-dry. Heat is the enemy: no dishwasher, no hot tap, and never around raw meat, because you cannot scrub it the way you would a plastic board. Treated gently, one wrap will see you through a year or more of lunches and leftovers.'),
          h2('When it stops sticking'),
          para('Eventually the wax wears thin and the cling goes. That is not the end — you can re-wax a tired wrap with a grated block and a warm oven, and it comes back to life. We sell the refresh blocks for exactly this reason: a wrap you top up is a wrap you never throw away.'),
          para('And when it is truly finished, it composts. Or, our favourite trick: wrap it around a bit of kindling and use it to light the fire. A food wrap that ends as a firelighter is about as good as the end of a thing gets.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'our-first-carbon-report',
    status: 'published',
    body: {
      title: 'Our first carbon report',
      excerpt: 'We measured a year of making and shipping everything in the shop, added it up, and are publishing the number — including the parts we are not proud of.',
      featuredImage: { $asset: 'post-carbon' },
      body: {
        type: 'doc',
        content: [
          para('This is the first year we have measured our whole footprint — the materials, the making, the packaging and the miles — and written it down. We are a small shop and the report is not perfect, but we would rather publish an honest, rough number than a polished, quiet nothing.'),
          h2('Where it comes from'),
          para('The biggest share, by a distance, is shipping. Sending a basket across the country costs more carbon than growing the seagrass it is woven from. The next chunk is the raw materials, and the smallest is our own workshop and warehouse. Knowing the order matters, because it tells us where an hour of effort actually moves the number.'),
          h2('What we are changing'),
          para('So this year we are consolidating shipments, moving to plastic-free packaging across the whole range, and switching our workshop to a renewable tariff. We are not buying offsets to call ourselves neutral — we would rather cut the real number than pay to look like we have.'),
          para('We will publish this every year, and we will show the parts that go the wrong way as well as the parts that improve. A report you only publish when it flatters you is marketing, not measurement.'),
        ],
      },
    },
  },
];

// ── Product detail (the material-story PDP) + Shop ───────────────────────────────
// Allbirds' PDP sells the MATERIAL and the MISSION before the SKU: a calm image beside
// a quiet buy box, then a "why we love this" panel, a materials/sustainability breakdown
// and a care note (DESIGN §4/§6 — the natural-clean PDP spine). Ported to Fernwood Goods:
// the same restful two-column spread in the `sage-oat` theme, where `btn-primary` is the
// warm near-black mono pill the reference's dark CTA calls for. Bound fields come from the
// shared PDP kit (correct `repeat('product')` scope + `item.*` binds); the layout + the
// static brand copy (materials, making, care, footprint) are ours.

/** A small "from the earth" credential chip — a plain oat pill stating one honest fact
 *  about the thing (plastic-free, compostable, refillable). State ON a product, not an
 *  eyebrow: it rides the buy box, below the price, where a shopper is deciding. */
function ecoChip(label: string): Node {
  return el('li', 'rounded-full bg-base-200 px-3 py-1 text-sm font-medium text-base-content', {
    text: label,
  });
}

/** One labelled detail block in the buy box — an `<h2>` small-caps label over a paragraph
 *  of static brand copy. The Allbirds "why we love this / materials & sustainability / care"
 *  stack, stacked rather than tabbed so it reads without JavaScript and needs no behaviour
 *  marker (the reference's accordions, opened flat). */
function pdpDetail(label: string, body: string): Node {
  return el('div', 'flex flex-col gap-2 border-t border-base-300 pt-5', {
    children: [
      el('h2', 'text-sm font-semibold uppercase tracking-widest text-base-content', { text: label }),
      el('p', 'text-base leading-relaxed text-base-content', { text: body }),
    ],
  });
}

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the calm product image. Right: the quiet oat buy column — label, title, price, the
 *  honest-material chips, description, the mono CTA, then the material-story detail stack. */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-16', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          // The bound primary image — the storefront fills it per product.
          pdpImage(
            'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'
          ),
          // The quiet buy column.
          el('div', 'flex flex-col gap-6 @3xl:py-4', {
            children: [
              el('div', 'flex flex-col gap-3', {
                children: [
                  // Brand label above the title — the reference's small-caps eyebrow slot.
                  // A plain <p>, so the product title stays the page's one <h1>.
                  el('p', 'text-sm font-medium uppercase tracking-widest text-base-content', {
                    text: 'Fernwood Goods',
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
                ],
              }),
              // The honest-material credential chips — Allbirds' "made from the earth" signal,
              // stated plainly on the product.
              el('ul', 'flex flex-wrap gap-2', {
                children: [
                  ecoChip('From the earth'),
                  ecoChip('Plastic-free'),
                  ecoChip('Made to be kept'),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              // Qty + Add to cart — the warm near-black mono CTA (btn-primary in `sage-oat`).
              addToCartForm(),
              // The material-story detail stack — the natural-clean PDP spine.
              el('div', 'mt-2 flex flex-col gap-5', {
                children: [
                  pdpDetail(
                    'The materials',
                    'Made from things the earth makes more of — organic cotton, flax linen, bamboo, seagrass, beeswax, recycled glass or stoneware clay, depending on the piece. Every material is named on the product, and if the honest answer to “what is it made of?” is a chemical nobody can pronounce, it does not go in the shop.',
                  ),
                  pdpDetail(
                    'How it is made',
                    'Made in small runs by makers we know, and held to the same two tests as everything here: it has to work at least as well as the plastic thing it replaces, and it has to be made from something you can name. Plenty of samples never make it past the sink — the ones that do earn their place twice.',
                  ),
                  pdpDetail(
                    'Caring for it',
                    'Built to be kept, not replaced, and easy to keep going — wash it, oil it, or refill it, and it will outlast the shelf you bought it for. Each order ships with a short, plain-language care note, and we stock the refills and spares so a tired thing comes back to life instead of the bin.',
                  ),
                  pdpDetail(
                    'Footprint & returns',
                    'Sent in plastic-free packaging and, at the very end of a long life, made to compost, recycle or refill rather than sit a century in the ground. Free returns within thirty days on anything unused — these are things to live with, not to worry over.',
                  ),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The full material-story PDP — the buy region above a quiet "You may also like" carousel
 *  of same-collection pieces (`commerce.related`, the shared kit's default cross-sell). */
const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'You may also like' });

/** The Shop page's own header, shown ABOVE the faceted catalogue core the harness appends.
 *  A calm full-bleed lifestyle banner with the title + a plain intro line in a solid oat
 *  panel — the Allbirds PLP "lifestyle header banner" (photo + overlaid title), in place of
 *  the generic "Shop / Everything we currently have". */
const SHOP: Node[] = [
  el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: {
          src: assetUrl('band-materials'),
          alt: 'A close-up of woven natural fibre',
          loading: 'lazy',
        },
      }),
      el(
        'div',
        'relative mx-auto flex w-full max-w-6xl flex-col items-start justify-end gap-4 px-6 py-16 @3xl:px-10 @3xl:py-24',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-4 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el(
                  'h1',
                  'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                  { text: 'The whole shop' }
                ),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Every everyday thing Fernwood Goods makes — for the kitchen, the clean-up, the cupboard and the bath — filtered and sorted however you like. Honest materials, made to be kept.',
                }),
              ],
            }),
          ],
        }
      ),
    ],
  }),
];

// ── The remaining functional pages (bespoke framing over the shared cores) ───────
// Collections / Cart / Search each get Fernwood Goods' own plain-spoken masthead above
// the pinned, shoppable core the harness appends; the Journal index gets its own masthead
// over the shared linkable post grid. Same warm, material-forward, oat-ground voice as the
// rest of the shop — honest about what a thing is made of and how to keep it.

/** A plain page masthead — an `<h1>` + one intro line on the oat ground. Used for
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
    'The collections',
    'Small groups of everyday things gathered the way a home actually uses them — the kitchen, the clean-up, the cupboard, the table and the bath. Start where you are replacing plastic, and work outward from there.'
  ),
];

const SEARCH: Node[] = [
  pageMasthead(
    'Search the shop',
    'Looking for something in particular — a material, a room, or a plastic thing you want to swap out? Search the whole shop and the journal below by name, by material or by what it is for.'
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
            { text: 'The Fernwood journal' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the shop, written plainly — what we make things from, how to keep them going for years, and how we are doing on the planet, warts and all.',
          }),
        ],
      }),
    ],
  }),
];

/** The Cart page's own header — a warm reassurance band above the pinned cart core, in place
 *  of the generic "Your cart" heading. Plastic-free packaging, carbon-neutral shipping and a
 *  thirty-day return — the three things a plastic-conscious buyer wants to read before they
 *  check out. */
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
            text: 'Everything ships in plastic-free packaging on carbon-neutral delivery, and you have thirty days to return anything unused for a full refund. Take your time deciding — these are things to keep.',
          }),
        ],
      }),
    ],
  }),
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'natural-clean',
  key: 'sparx-natural-clean',
  name: 'sparx — Natural Clean',
  summary:
    'A calm, oat-tinted storefront for a natural or sustainable brand — a full-bleed hero over color-blocked category tiles and a repeating shoppable-carousel and material-story rhythm that closes on a quiet mission moment, in a warm paper-ground theme. Modelled on the natural/sustainable-clean archetype; shipped as Fernwood Goods.',
  tagline: 'A warm, honest template for eco housewares and any planet-minded brand.',
  vertical: 'retail',
  industry: 'Eco everyday housewares',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 85,
  brand: {
    businessName: 'Fernwood Goods',
    tagline: 'Everyday things, honestly made.',
  },
  // Allbirds chrome: a brand-LEFT wordmark (`brandLeft`), a filled shop CTA in the bar
  // (`showCta: true`), and the "subscribe to our emails" newsletter footer (`newsletter`)
  // whose bottom bar carries the live © business name — the calm, capture-first footer the
  // reference leads with.
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Fernwood Goods — everyday housewares, honestly made',
      description:
        'Fernwood Goods makes everyday housewares in cotton, linen, wood and glass — useful, unfussy things made from what the earth gives back and built to be kept.',
    },
    about: {
      title: 'About Fernwood Goods',
      description:
        'The materials, makers and thinking behind Fernwood Goods — a simpler, better-made everyday, built to last and gentle at the end.',
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
