// sparx-catalog-dense — the reference-driven site template modelled on the DENSE
// fast-fashion catalog archetype (docs/templates/fashion-nova).
//
// Fashion Nova translated to sparx: a high-volume, discount-forward apparel shop —
// Voltage, "Trend-fast fashion, priced to move." The home page is the catalog rhythm —
// a full-bleed discount hero, a dark urgency strip, then a relentless stack of dense
// product GRIDS (new-in, per-category rails, the endless "shop the latest") broken up
// by candy-loud promo bands and a lookbook — dressed in the bespoke `voltage` theme
// (white/grey content, near-black chrome, one loud sale-red accent).
//
// This file is JUST the SPEC; the composition + emission live in the shared
// `template-sites/harness.ts`. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-catalog-dense.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-catalog-dense/**" \
//     "marketplace-catalog/_gen/**/*.ts"
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
import { newsletterSignup } from '../../packages/silica-catalog/src/sections/convert';
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
// Royalty-free Unsplash photographs, verified reachable (HTTP 200) at authoring time.
// Product + post images go through `assets` by id (the installer re-hosts them); the
// hero / promo-band photos are TREE imagery, so they hot-link the same URL inline
// (docs/54 §6) — they still appear in `assets` as the single documented registry of the
// bundle's imagery + alt text.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
  // Products
  halstonMini: '1595777457583-95e059d581b8',
  coastlineMaxi: '1623609163859-ca93c959b98a',
  bandageMidi: '1618932260643-eee4a2f652a6',
  cami3Pack: '1617922001439-4a2e6562f328',
  graphicTee: '1523398002811-999ca8dec234',
  corsetTop: '1591047139829-d91aecb6caea',
  wideLegJean: '1631112230741-446762ee05ac',
  cargoPant: '1637069585336-827b298fe84a',
  miniSkirt: '1604176354204-9268737828e4',
  loungeSet: '1512101903502-7eb0c9022c74',
  suitSet: '1586396847415-2c76ae7e79fc',
  jumpsuit: '1590330297626-d7aff25a0431',
  stringBikini: '1576503895435-eb0730485d72',
  onePiece: '1593836788196-9fd68e904906',
  shieldSunglasses: '1511499767150-a48a237f0083',
  shoulderBag: '1559563458-527698bf5295',
  // Journal posts
  postGoldenHour: '1524255684952-d7185b509571',
  postVacation: '1522322904670-5cf2a8529d21',
  postDenim: '1542272604-787c3835535d',
  // Hero + promo bands (tree imagery)
  hero: '1483985988355-763728e1935b',
  bandNewSeason: '1616847220575-31b062a4cd05',
  bandGoldenHour: '1619086303291-0ef7699e4b31',
  bandSale: '1578854955076-970394ef2512',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'halston-cutout-mini', url: U(IMG.halstonMini), alt: 'A woman in a fitted cutout mini dress' },
  { id: 'coastline-satin-maxi', url: U(IMG.coastlineMaxi), alt: 'A flowing satin maxi dress' },
  { id: 'bandage-bodycon-midi', url: U(IMG.bandageMidi), alt: 'A sculpting bandage midi dress' },
  { id: 'rib-knit-cami-3-pack', url: U(IMG.cami3Pack), alt: 'A rib-knit cami top' },
  { id: 'oversized-graphic-tee', url: U(IMG.graphicTee), alt: 'An oversized graphic tee, street style' },
  { id: 'corset-bustier-top', url: U(IMG.corsetTop), alt: 'A structured corset bustier top' },
  { id: 'high-rise-wide-leg-jean', url: U(IMG.wideLegJean), alt: 'High-rise wide-leg denim jeans' },
  { id: 'cargo-parachute-pant', url: U(IMG.cargoPant), alt: 'Utility cargo parachute pants' },
  { id: 'faux-leather-mini-skirt', url: U(IMG.miniSkirt), alt: 'A faux-leather mini skirt' },
  { id: 'ribbed-lounge-set', url: U(IMG.loungeSet), alt: 'A matching ribbed lounge set' },
  { id: 'blazer-short-suit-set', url: U(IMG.suitSet), alt: 'A tailored blazer and short suit set' },
  { id: 'strapless-wide-leg-jumpsuit', url: U(IMG.jumpsuit), alt: 'A strapless wide-leg jumpsuit' },
  { id: 'ring-detail-string-bikini', url: U(IMG.stringBikini), alt: 'A ring-detail string bikini' },
  { id: 'one-shoulder-one-piece', url: U(IMG.onePiece), alt: 'A one-shoulder swimsuit' },
  { id: 'oversized-shield-sunglasses', url: U(IMG.shieldSunglasses), alt: 'Oversized shield sunglasses' },
  { id: 'quilted-shoulder-bag', url: U(IMG.shoulderBag), alt: 'A quilted shoulder bag' },
  { id: 'post-golden-hour', url: U(IMG.postGoldenHour), alt: 'Warm golden-hour street style' },
  { id: 'post-vacation', url: U(IMG.postVacation), alt: 'Resort-ready vacation looks by the water' },
  { id: 'post-denim', url: U(IMG.postDenim), alt: 'Wide-leg denim styled for the street' },
  { id: 'hero-home', url: U(IMG.hero), alt: 'A group of friends in the season’s newest looks' },
  { id: 'band-new-season', url: U(IMG.bandNewSeason), alt: 'The new-season drop, styled head to toe' },
  { id: 'band-golden-hour', url: U(IMG.bandGoldenHour), alt: 'Golden-hour going-out looks' },
  { id: 'band-sale', url: U(IMG.bandSale), alt: 'Sale-season street style' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-catalog-dense: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections (the dense fast-fashion sequence) ──────────────────────────

/** The full-bleed discount hero — one lifestyle photograph filling the width, the
 *  headline, urgency subhead and two actions in a solid readable panel over it (the
 *  `offer_hero` shape). Tenant content, so it hot-links a real photograph; every class is
 *  a NAMED utility so it survives the stamp into the tenant's stored tree. The sale CTA
 *  is `btn-accent` — the theme's one loud sale-red, held to the discount job. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('hero-home'), alt: 'The season’s newest looks', loading: 'lazy' },
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
                  'text-4xl font-bold uppercase leading-tight tracking-tight text-base-content @3xl:text-6xl',
                  { text: 'New drops daily' }
                ),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Hundreds of fresh styles every week — dresses, denim, sets and swim — and up to 70% off the sale rail while it lasts. Trend-fast fashion, priced to move.',
                }),
                el('div', 'flex flex-wrap items-center gap-3', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop new in' }),
                    el('a', 'btn btn-accent btn-lg', { attrs: { href: '/collections' }, text: 'Shop the sale' }),
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

/** The dark urgency strip under the hero — the black promo band Fashion Nova stacks
 *  before the fold. `bg-primary text-primary-content` is the theme's near-black chrome
 *  ground; the discount figure rides a filled `badge badge-accent` chip — the sale-red
 *  fill carries its own AA `-content` ink, where bare `text-accent` on the near-black band
 *  fell short of the readable bar. */
/** A STATIC countdown-style clock — Fashion Nova's live sale timer, authored as FIXED digits
 *  rather than the live `countdown` behavior. A live countdown takes one fixed target
 *  timestamp, which EXPIRES: a tenant installing weeks later would see 00:00:00, a clock that
 *  reads as broken on the shipped starter. Static boxes always show a plausible flash-sale
 *  time and never break; the tenant edits the figures (or wires a real timer) for their own
 *  sale. The boxes INVERT the band's own token pair (`bg-primary-content` / `text-primary`),
 *  so they contrast against the near-black band and stay AA on every theme, no hardcoded hex. */
function saleCountdown(): Node {
  const box = (n: string): Node =>
    el(
      'span',
      'inline-flex min-w-9 items-center justify-center rounded-field bg-primary-content px-2 py-1 font-mono text-base font-bold text-primary',
      { text: n }
    );
  const colon = (): Node => el('span', 'font-bold', { text: ':' });
  return el('div', 'flex items-center gap-2', {
    children: [box('05'), colon(), box('59'), colon(), box('59')],
  });
}

function promoBand(): Node {
  return el('section', 'bg-primary text-primary-content @container px-6 py-4', {
    children: [
      el(
        'div',
        'mx-auto flex w-full max-w-6xl flex-col items-center justify-center gap-3 text-center @2xl:flex-row @2xl:gap-6',
        {
          children: [
            el('p', 'flex flex-wrap items-center justify-center gap-2 text-base font-semibold', {
              children: [
                el('span', 'badge badge-accent', { text: 'Extra 30% off' }),
                el('span', '', { text: 'everything in Sale — ends in' }),
              ],
            }),
            saleCountdown(),
            el('a', 'font-semibold underline underline-offset-4', {
              attrs: { href: '/collections' },
              text: 'Shop now',
            }),
          ],
        }
      ),
    ],
  });
}

/** A candy-loud promo band — a full-bleed photograph carrying a collection's pitch and a
 *  button in a solid panel. `tone` picks the panel ground: `light` (white / near-black
 *  action), `dark` (near-black chrome / sale-red action), `sale` (the loud sale-red
 *  ground itself / near-black action). Children inherit the panel's `-content` ink, so
 *  the copy stays readable on every ground without a hardcoded text color. */
type BandTone = 'light' | 'dark' | 'sale';
const BAND_PANEL: Record<BandTone, string> = {
  light: 'flex max-w-xl flex-col gap-4 rounded-box bg-base-100 p-8 @3xl:p-10',
  dark: 'flex max-w-xl flex-col gap-4 rounded-box bg-primary p-8 text-primary-content @3xl:p-10',
  sale: 'flex max-w-xl flex-col gap-4 rounded-box bg-accent p-8 text-accent-content @3xl:p-10',
};
const BAND_BTN: Record<BandTone, string> = {
  light: 'btn btn-primary btn-lg',
  dark: 'btn btn-accent btn-lg',
  sale: 'btn btn-neutral btn-lg',
};

function pictureBand(o: {
  heading: string;
  lead: string;
  assetId: string;
  cta: string;
  href: string;
  tone: BandTone;
}): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl(o.assetId), alt: '', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-16 @3xl:px-10 @3xl:py-24',
        {
          children: [
            el('div', BAND_PANEL[o.tone], {
              children: [
                el('h2', 'text-3xl font-bold uppercase leading-tight tracking-tight @3xl:text-4xl', {
                  text: o.heading,
                }),
                el('p', 'text-lg leading-relaxed', { text: o.lead }),
                el('a', BAND_BTN[o.tone], { attrs: { href: o.href }, text: o.cta }),
              ],
            }),
          ],
        }
      ),
    ],
  });
}

/** The lookbook — "The Voltage Edit": three editorial cards, each a photograph over a
 *  title + one-line pitch, linking into the journal. The catalog `post_grid`'s read-mores
 *  are dead `#` (no per-item CMS href templating — marketplace-catalog/CLAUDE.md), so
 *  these are STATIC cards pointed at `/journal/<slug>`, which resolve. */
function trendReport(): Node {
  const card = (assetId: string, title: string, blurb: string, slug: string): Node =>
    el('a', 'flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100 hover:border-primary', {
      attrs: { href: `/journal/${slug}` },
      children: [
        el('img', 'aspect-video w-full object-cover', {
          attrs: { src: assetUrl(assetId), alt: '', loading: 'lazy' },
        }),
        el('div', 'flex flex-col gap-2 p-6', {
          children: [
            el('h3', 'text-xl font-semibold text-base-content', { text: title }),
            el('p', 'text-base leading-relaxed text-base-content', { text: blurb }),
          ],
        }),
      ],
    });
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              el('h2', 'text-3xl font-bold uppercase tracking-tight text-base-content @3xl:text-4xl', {
                text: 'The Voltage Edit',
              }),
              el('p', 'max-w-2xl text-lg text-base-content', {
                text: 'How the team is wearing the new drops — three looks to steal this week.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
            children: [
              card('post-golden-hour', 'The Golden Hour Edit', 'Warm tones and going-out shapes for the last light of the day.', 'the-golden-hour-edit'),
              card('post-vacation', 'Vacation Mode', 'Twelve resort looks that pack flat and photograph everywhere.', 'vacation-mode-resort-looks'),
              card('post-denim', 'Denim Reset', 'Styling the wide-leg jean five ways, from coffee run to night out.', 'denim-reset-wide-leg'),
            ],
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  hero(),
  promoBand(),
  productsBlock({ source: 'commerce.featured', layout: 'grid', heading: 'New this week' }),
  pictureBand({
    heading: 'The 50% weekend',
    lead: 'Half off the new-season rail through Sunday — dresses, sets and the going-out shapes everyone is asking for.',
    assetId: 'band-new-season',
    cta: 'Shop the drop',
    href: '/collections',
    tone: 'dark',
  }),
  productsBlock({ source: 'commerce.category.dresses', layout: 'grid', heading: 'Dresses' }),
  productsBlock({ source: 'commerce.category.denim', layout: 'grid', heading: 'Jeans & bottoms' }),
  pictureBand({
    heading: 'Golden hour',
    lead: 'The going-out edit — satin, cutouts and sets built for the good light and the late night.',
    assetId: 'band-golden-hour',
    cta: 'Shop going-out',
    href: '/collections',
    tone: 'light',
  }),
  productsBlock({ source: 'commerce.category.sets', layout: 'grid', heading: 'Sets & rompers' }),
  productsBlock({ source: 'commerce.category.swim', layout: 'grid', heading: 'Swim' }),
  trendReport(),
  pictureBand({
    heading: '60–80% off sale',
    lead: 'The final rail — hundreds of styles at their lowest, while sizes last. No code needed, prices as marked.',
    assetId: 'band-sale',
    cta: 'Shop the sale',
    href: '/collections',
    tone: 'sale',
  }),
  productsBlock({ source: 'commerce.product', layout: 'grid', heading: 'Shop the latest' }),
  // The footer variant is `columns` (no built-in capture), so the page carries the
  // discount sign-up itself — the Fashion Nova "sign up for discounts + updates" beat.
  newsletterSignup(),
];

// ── About + Contact (Voltage-voiced) ─────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-bold uppercase tracking-tight text-base-content @2xl:text-5xl', {
            text: 'About Voltage',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Voltage is fast fashion done right — hundreds of new styles every week, across dresses, denim, tops, sets and swim, at prices built to move. We watch what the street is actually wearing, make it quickly, and pass the speed straight on to you.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Priced to move does not mean throwaway. We size every run to sell through, mark the real comparison price on every tag, and keep the best-sellers restocked so the thing you loved on Monday is still there on Friday. Free 1-day shipping over $75, easy 30-day returns, and a sale rail that never quite runs out.',
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
          el('h1', 'text-4xl font-bold uppercase tracking-tight text-base-content @2xl:text-5xl', {
            text: 'Talk to us',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Order questions, sizing help, or a style you cannot find — our team answers fast, usually the same day. Tell us what you need and we will sort it.',
          }),
          el('a', 'btn btn-primary btn-lg', {
            attrs: { href: 'mailto:help@voltage.example' },
            text: 'Email the team',
          }),
        ],
      }),
    ],
  }),
];

// ── Commerce (Voltage — 16 SKUs across 6 categories) ─────────────────────────────

interface Variant {
  sku: string;
  priceCents: number;
  compareAtPriceCents: number;
  isDefault?: boolean;
  inventoryPolicy: 'continue';
  optionValues: Record<string, string>;
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
  options: OptionDecl[];
  variants: Variant[];
  images: { assetId: string; isPrimary: true; alt: string }[];
}

const money = (dollars: number): number => Math.round(dollars * 100);

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const SWIM_SIZES = ['XS', 'S', 'M', 'L'];
const ONE_SIZE = ['One size'];

/** A Size option + one variant per size, priced with a comp value (the sale
 *  strikethrough). Default = `M` when present, else the middle size. */
function sized(
  skuBase: string,
  price: number,
  compareAt: number,
  sizes: string[]
): { options: OptionDecl[]; variants: Variant[] } {
  const defaultSize = sizes.includes('M') ? 'M' : sizes[Math.floor(sizes.length / 2)]!;
  const options: OptionDecl[] = [
    { name: 'Size', displayType: 'dropdown', values: sizes.map((value) => ({ value })) },
  ];
  const variants: Variant[] = sizes.map((size) => ({
    sku: `${skuBase}-${size.replace(/\s+/g, '').toUpperCase()}`,
    priceCents: money(price),
    compareAtPriceCents: money(compareAt),
    ...(size === defaultSize ? { isDefault: true } : {}),
    inventoryPolicy: 'continue',
    optionValues: { Size: size },
  }));
  return { options, variants };
}

const PRODUCTS: Product[] = [
  {
    handle: 'halston-cutout-mini-dress',
    title: 'Halston Cutout Mini Dress',
    description:
      'A body-skimming mini in a stretch-crepe that holds its shape, with a sharp waist cutout and a hidden back zip. The one you reach for when the night is a maybe and the answer needs to be yes.',
    status: 'active',
    productType: 'Dress',
    vendor: 'Voltage',
    tags: ['dress', 'mini', 'going-out', 'sale'],
    categoryHandles: ['dresses'],
    collectionHandles: ['new-arrivals', 'the-edit', 'sale'],
    seoTitle: 'Halston Cutout Mini Dress — stretch-crepe going-out mini',
    seoDescription: 'A stretch-crepe cutout mini dress with a sharp waist and hidden zip. Was $44.99, now $30.99.',
    ...sized('VLT-HALSTON', 30.99, 44.99, APPAREL_SIZES),
    images: [{ assetId: 'halston-cutout-mini', isPrimary: true, alt: 'The Halston Cutout Mini Dress' }],
  },
  {
    handle: 'coastline-satin-maxi',
    title: 'Coastline Satin Maxi',
    description:
      'A liquid-satin maxi that pours to the floor with a thigh-high slit and a cowl back. Weighted so it moves with you and not against you — dinner, a wedding, or a very good Tuesday.',
    status: 'active',
    productType: 'Dress',
    vendor: 'Voltage',
    tags: ['dress', 'maxi', 'satin', 'sale'],
    categoryHandles: ['dresses'],
    collectionHandles: ['best-sellers', 'the-edit', 'sale'],
    seoTitle: 'Coastline Satin Maxi — slit satin maxi dress',
    seoDescription: 'A liquid-satin maxi dress with a thigh-high slit and cowl back. Was $59.99, now $38.99.',
    ...sized('VLT-COASTLINE', 38.99, 59.99, APPAREL_SIZES),
    images: [{ assetId: 'coastline-satin-maxi', isPrimary: true, alt: 'The Coastline Satin Maxi' }],
  },
  {
    handle: 'bandage-bodycon-midi',
    title: 'Bandage Bodycon Midi',
    description:
      'A sculpting bandage-knit midi that pulls everything in and lets nothing go. High neck, banded hem, and enough stretch to sit through dinner and still dance after.',
    status: 'active',
    productType: 'Dress',
    vendor: 'Voltage',
    tags: ['dress', 'midi', 'bodycon', 'sale'],
    categoryHandles: ['dresses'],
    collectionHandles: ['best-sellers', 'sale'],
    seoTitle: 'Bandage Bodycon Midi — sculpting bandage-knit midi dress',
    seoDescription: 'A sculpting high-neck bandage-knit midi dress. Was $39.99, now $27.99.',
    ...sized('VLT-BANDAGE', 27.99, 39.99, APPAREL_SIZES),
    images: [{ assetId: 'bandage-bodycon-midi', isPrimary: true, alt: 'The Bandage Bodycon Midi' }],
  },
  {
    handle: 'rib-knit-cami-3-pack',
    title: 'Rib-Knit Cami 3-Pack',
    description:
      'Three of the cami you already wear to death — a stretch rib that hugs without gripping, in the neutrals that go under everything. Buy the pack, stop doing laundry on a deadline.',
    status: 'active',
    productType: 'Top',
    vendor: 'Voltage',
    tags: ['top', 'cami', 'basics', 'sale'],
    categoryHandles: ['tops'],
    collectionHandles: ['new-arrivals', 'best-sellers', 'sale'],
    seoTitle: 'Rib-Knit Cami 3-Pack — stretch rib camisole set',
    seoDescription: 'Three stretch rib-knit cami tops in everyday neutrals. Was $28.99, now $19.99.',
    ...sized('VLT-CAMI', 19.99, 28.99, APPAREL_SIZES),
    images: [{ assetId: 'rib-knit-cami-3-pack', isPrimary: true, alt: 'The Rib-Knit Cami 3-Pack' }],
  },
  {
    handle: 'oversized-graphic-tee',
    title: 'Oversized Graphic Tee',
    description:
      'A drop-shoulder cotton tee cut big on purpose, with a soft-hand print that survives the wash. Knot it, tuck it, or let it hang over the cargos — it works every way you throw it on.',
    status: 'active',
    productType: 'Top',
    vendor: 'Voltage',
    tags: ['top', 'tee', 'graphic', 'sale'],
    categoryHandles: ['tops'],
    collectionHandles: ['new-arrivals', 'sale'],
    seoTitle: 'Oversized Graphic Tee — drop-shoulder cotton graphic tee',
    seoDescription: 'An oversized drop-shoulder cotton graphic tee with a soft-hand print. Was $24.99, now $16.99.',
    ...sized('VLT-GRAPHTEE', 16.99, 24.99, APPAREL_SIZES),
    images: [{ assetId: 'oversized-graphic-tee', isPrimary: true, alt: 'The Oversized Graphic Tee' }],
  },
  {
    handle: 'corset-bustier-top',
    title: 'Corset Bustier Top',
    description:
      'A structured bustier with real boning and a hook-and-eye front that holds its line all night. Wear it with the wide-leg jean and a blazer, or just the blazer.',
    status: 'active',
    productType: 'Top',
    vendor: 'Voltage',
    tags: ['top', 'corset', 'going-out', 'sale'],
    categoryHandles: ['tops'],
    collectionHandles: ['the-edit', 'sale'],
    seoTitle: 'Corset Bustier Top — boned hook-front bustier',
    seoDescription: 'A structured boned corset bustier top with a hook-and-eye front. Was $34.99, now $22.99.',
    ...sized('VLT-CORSET', 22.99, 34.99, APPAREL_SIZES),
    images: [{ assetId: 'corset-bustier-top', isPrimary: true, alt: 'The Corset Bustier Top' }],
  },
  {
    handle: 'high-rise-wide-leg-jean',
    title: 'High-Rise Wide-Leg Jean',
    description:
      'A rigid-with-a-little-give denim cut high on the waist and wide all the way down, so it lengthens the leg and forgives the lunch. The pair the whole outfit gets built around.',
    status: 'active',
    productType: 'Jeans',
    vendor: 'Voltage',
    tags: ['denim', 'jeans', 'wide-leg', 'sale'],
    categoryHandles: ['denim'],
    collectionHandles: ['new-arrivals', 'best-sellers', 'denim-reset', 'sale'],
    seoTitle: 'High-Rise Wide-Leg Jean — high-waist wide-leg denim',
    seoDescription: 'A high-rise wide-leg jean in rigid-give denim that lengthens the leg. Was $49.99, now $34.99.',
    ...sized('VLT-WIDEJEAN', 34.99, 49.99, APPAREL_SIZES),
    images: [{ assetId: 'high-rise-wide-leg-jean', isPrimary: true, alt: 'The High-Rise Wide-Leg Jean' }],
  },
  {
    handle: 'cargo-parachute-pant',
    title: 'Cargo Parachute Pant',
    description:
      'A lightweight parachute cargo with cinch-cord hems and pockets that actually hold a phone. Baggy where it counts, tapered where it should be — the easy win on a getting-dressed-fast morning.',
    status: 'active',
    productType: 'Pants',
    vendor: 'Voltage',
    tags: ['bottoms', 'cargo', 'parachute', 'sale'],
    categoryHandles: ['denim'],
    collectionHandles: ['best-sellers', 'denim-reset', 'sale'],
    seoTitle: 'Cargo Parachute Pant — cinch-hem utility cargo',
    seoDescription: 'A lightweight cinch-hem parachute cargo pant with real pockets. Was $48.00, now $32.99.',
    ...sized('VLT-CARGO', 32.99, 48.0, APPAREL_SIZES),
    images: [{ assetId: 'cargo-parachute-pant', isPrimary: true, alt: 'The Cargo Parachute Pant' }],
  },
  {
    handle: 'faux-leather-mini-skirt',
    title: 'Faux-Leather Mini Skirt',
    description:
      'A matte faux-leather mini with a hidden stretch panel so it moves like fabric, not armour. Off to the office with tights, out at night with the corset — one skirt, two lives.',
    status: 'active',
    productType: 'Skirt',
    vendor: 'Voltage',
    tags: ['bottoms', 'skirt', 'faux-leather', 'sale'],
    categoryHandles: ['denim'],
    collectionHandles: ['new-arrivals', 'sale'],
    seoTitle: 'Faux-Leather Mini Skirt — matte stretch-panel mini',
    seoDescription: 'A matte faux-leather mini skirt with a hidden stretch panel. Was $32.99, now $21.99.',
    ...sized('VLT-MINISKIRT', 21.99, 32.99, APPAREL_SIZES),
    images: [{ assetId: 'faux-leather-mini-skirt', isPrimary: true, alt: 'The Faux-Leather Mini Skirt' }],
  },
  {
    handle: 'ribbed-lounge-set',
    title: 'Ribbed Lounge Set',
    description:
      'A matching rib-knit set — a fitted long-sleeve and a high-waist flare — soft enough to travel in and sharp enough to arrive in. Buy it together, split it up forever.',
    status: 'active',
    productType: 'Matching set',
    vendor: 'Voltage',
    tags: ['set', 'loungewear', 'ribbed', 'sale'],
    categoryHandles: ['sets'],
    collectionHandles: ['new-arrivals', 'best-sellers', 'sale'],
    seoTitle: 'Ribbed Lounge Set — matching rib-knit lounge set',
    seoDescription: 'A matching rib-knit lounge set: fitted long-sleeve and high-waist flare. Was $44.99, now $29.99.',
    ...sized('VLT-LOUNGE', 29.99, 44.99, APPAREL_SIZES),
    images: [{ assetId: 'ribbed-lounge-set', isPrimary: true, alt: 'The Ribbed Lounge Set' }],
  },
  {
    handle: 'blazer-short-suit-set',
    title: 'Blazer + Short Suit Set',
    description:
      'A tailored two-piece — a structured single-button blazer and a matching high-waist short — in a crease-resistant suiting that reads expensive and packs like nothing. The whole look, one add-to-bag.',
    status: 'active',
    productType: 'Matching set',
    vendor: 'Voltage',
    tags: ['set', 'suit', 'tailored', 'sale'],
    categoryHandles: ['sets'],
    collectionHandles: ['the-edit', 'sale'],
    seoTitle: 'Blazer + Short Suit Set — tailored blazer and short two-piece',
    seoDescription: 'A tailored blazer and matching high-waist short suit set in crease-resistant suiting. Was $79.99, now $54.99.',
    ...sized('VLT-SUIT', 54.99, 79.99, APPAREL_SIZES),
    images: [{ assetId: 'blazer-short-suit-set', isPrimary: true, alt: 'The Blazer + Short Suit Set' }],
  },
  {
    handle: 'strapless-wide-leg-jumpsuit',
    title: 'Strapless Wide-Leg Jumpsuit',
    description:
      'A strapless jumpsuit with a grippy inner band that stays put and a wide leg that reads like a gown from across the room. One piece, zero decisions, all night.',
    status: 'active',
    productType: 'Jumpsuit',
    vendor: 'Voltage',
    tags: ['set', 'jumpsuit', 'going-out', 'sale'],
    categoryHandles: ['sets'],
    collectionHandles: ['the-edit', 'sale'],
    seoTitle: 'Strapless Wide-Leg Jumpsuit — grip-band wide-leg jumpsuit',
    seoDescription: 'A strapless wide-leg jumpsuit with a grippy inner band that stays put. Was $58.00, now $39.99.',
    ...sized('VLT-JUMPSUIT', 39.99, 58.0, APPAREL_SIZES),
    images: [{ assetId: 'strapless-wide-leg-jumpsuit', isPrimary: true, alt: 'The Strapless Wide-Leg Jumpsuit' }],
  },
  {
    handle: 'ring-detail-string-bikini',
    title: 'Ring-Detail String Bikini',
    description:
      'A string bikini with gold-tone ring hardware and fully adjustable ties, so one size range fits a lot of bodies. Quick-dry, fade-resistant, and cut to sit exactly where you set it.',
    status: 'active',
    productType: 'Swimwear',
    vendor: 'Voltage',
    tags: ['swim', 'bikini', 'vacation', 'sale'],
    categoryHandles: ['swim'],
    collectionHandles: ['new-arrivals', 'sale'],
    seoTitle: 'Ring-Detail String Bikini — adjustable ring-hardware bikini',
    seoDescription: 'A quick-dry string bikini with gold-tone ring hardware and adjustable ties. Was $36.99, now $24.99.',
    ...sized('VLT-BIKINI', 24.99, 36.99, SWIM_SIZES),
    images: [{ assetId: 'ring-detail-string-bikini', isPrimary: true, alt: 'The Ring-Detail String Bikini' }],
  },
  {
    handle: 'one-shoulder-one-piece',
    title: 'One-Shoulder One-Piece',
    description:
      'A sculpting one-shoulder one-piece with a hidden shelf and a high-cut leg. Reads as a swimsuit at the pool and a bodysuit under a skirt — the hardest-working thing in the bag.',
    status: 'active',
    productType: 'Swimwear',
    vendor: 'Voltage',
    tags: ['swim', 'one-piece', 'vacation', 'sale'],
    categoryHandles: ['swim'],
    collectionHandles: ['best-sellers', 'sale'],
    seoTitle: 'One-Shoulder One-Piece — sculpting one-shoulder swimsuit',
    seoDescription: 'A sculpting one-shoulder one-piece swimsuit with a hidden shelf and high-cut leg. Was $39.99, now $27.99.',
    ...sized('VLT-ONEPIECE', 27.99, 39.99, SWIM_SIZES),
    images: [{ assetId: 'one-shoulder-one-piece', isPrimary: true, alt: 'The One-Shoulder One-Piece' }],
  },
  {
    handle: 'oversized-shield-sunglasses',
    title: 'Oversized Shield Sunglasses',
    description:
      'A single-lens shield in a wraparound frame that covers half the face and all the mystery. UV400, featherlight, and the fastest way to finish a look — throw them on and leave.',
    status: 'active',
    productType: 'Accessory',
    vendor: 'Voltage',
    tags: ['accessory', 'sunglasses', 'sale'],
    categoryHandles: ['accessories'],
    collectionHandles: ['new-arrivals', 'sale'],
    seoTitle: 'Oversized Shield Sunglasses — UV400 wraparound shield',
    seoDescription: 'Oversized UV400 shield sunglasses in a featherlight wraparound frame. Was $19.99, now $12.99.',
    ...sized('VLT-SHADES', 12.99, 19.99, ONE_SIZE),
    images: [{ assetId: 'oversized-shield-sunglasses', isPrimary: true, alt: 'The Oversized Shield Sunglasses' }],
  },
  {
    handle: 'quilted-shoulder-bag',
    title: 'Quilted Shoulder Bag',
    description:
      'A quilted vegan-leather shoulder bag with a gold chain strap you can double up or wear long. Fits the phone, the cards and the lipstick — and nothing you were going to lose anyway.',
    status: 'active',
    productType: 'Accessory',
    vendor: 'Voltage',
    tags: ['accessory', 'bag', 'sale'],
    categoryHandles: ['accessories'],
    collectionHandles: ['best-sellers', 'sale'],
    seoTitle: 'Quilted Shoulder Bag — chain-strap quilted vegan-leather bag',
    seoDescription: 'A quilted vegan-leather shoulder bag with a doubling gold chain strap. Was $44.99, now $29.99.',
    ...sized('VLT-BAG', 29.99, 44.99, ONE_SIZE),
    images: [{ assetId: 'quilted-shoulder-bag', isPrimary: true, alt: 'The Quilted Shoulder Bag' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'dresses', name: 'Dresses', description: 'Mini, midi and maxi — the going-out rail.', featured: true },
    { handle: 'tops', name: 'Tops', description: 'Camis, tees, corsets and everything under a jacket.', featured: true },
    { handle: 'denim', name: 'Jeans & Bottoms', description: 'Wide-leg denim, cargos and skirts.', featured: true },
    { handle: 'sets', name: 'Sets & Rompers', description: 'Two pieces, one decision — matching sets and jumpsuits.', featured: false },
    { handle: 'swim', name: 'Swim', description: 'Bikinis and one-pieces, vacation-ready.', featured: true },
    { handle: 'accessories', name: 'Accessories', description: 'The finishing pieces — bags and shades.', featured: false },
  ],
  collections: [
    {
      handle: 'new-arrivals',
      name: 'New Arrivals',
      description: 'This week’s freshest drops, across every rail.',
      type: 'manual',
      featured: true,
      productHandles: [
        'halston-cutout-mini-dress',
        'rib-knit-cami-3-pack',
        'oversized-graphic-tee',
        'high-rise-wide-leg-jean',
        'faux-leather-mini-skirt',
        'ribbed-lounge-set',
        'ring-detail-string-bikini',
        'oversized-shield-sunglasses',
      ],
    },
    {
      handle: 'best-sellers',
      name: 'Best Sellers',
      description: 'The styles that keep selling out and coming back.',
      type: 'manual',
      featured: false,
      productHandles: [
        'coastline-satin-maxi',
        'bandage-bodycon-midi',
        'rib-knit-cami-3-pack',
        'high-rise-wide-leg-jean',
        'cargo-parachute-pant',
        'ribbed-lounge-set',
        'one-shoulder-one-piece',
        'quilted-shoulder-bag',
      ],
    },
    {
      handle: 'the-edit',
      name: 'The Edit',
      description: 'The going-out edit — the pieces the team is styling right now.',
      type: 'manual',
      featured: false,
      productHandles: [
        'halston-cutout-mini-dress',
        'coastline-satin-maxi',
        'corset-bustier-top',
        'blazer-short-suit-set',
        'strapless-wide-leg-jumpsuit',
      ],
    },
    {
      handle: 'denim-reset',
      name: 'Denim Reset',
      description: 'Wide-leg, cargo and everything to build around them.',
      type: 'manual',
      featured: false,
      productHandles: ['high-rise-wide-leg-jean', 'cargo-parachute-pant', 'faux-leather-mini-skirt'],
    },
    {
      handle: 'sale',
      name: 'Sale — 60-80% Off',
      description: 'The final rail. Prices as marked, while sizes last.',
      type: 'manual',
      featured: false,
      productHandles: [
        'halston-cutout-mini-dress',
        'coastline-satin-maxi',
        'bandage-bodycon-midi',
        'oversized-graphic-tee',
        'corset-bustier-top',
        'cargo-parachute-pant',
        'blazer-short-suit-set',
        'strapless-wide-leg-jumpsuit',
        'ring-detail-string-bikini',
        'quilted-shoulder-bag',
      ],
    },
  ],
  products: PRODUCTS,
};

// ── Content (The Voltage Edit — the lookbook journal) ─────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'the-golden-hour-edit',
    status: 'published',
    body: {
      title: 'The Golden Hour Edit',
      excerpt: 'Warm tones, cutouts and satin — the going-out shapes built for the last good light of the day.',
      featuredImage: { $asset: 'post-golden-hour' },
      body: {
        type: 'doc',
        content: [
          para('Golden hour is the twenty minutes the whole night gets planned around. The light does half the work; the outfit only has to not fight it. That means warm tones over cool ones, a little skin on purpose, and a fabric that catches the light instead of flattening it.'),
          h2('Start with the satin'),
          para('The Coastline Satin Maxi is the anchor — it pours, it slits, and it photographs like money. If a floor-length feels like too much for the plan, the Halston Cutout Mini does the same warm-toned job with more leg and less commitment.'),
          h2('One cutout, not five'),
          para('A single sharp cutout reads as intentional; a dress that is more hole than fabric reads as a dare. Let one detail do the talking — the waist, the shoulder, the back — and keep the rest clean.'),
          para('Finish with the shield sunglasses until the sun is actually down, then push them up into your hair and let the night start.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'vacation-mode-resort-looks',
    status: 'published',
    body: {
      title: 'Vacation Mode: 12 Resort Looks',
      excerpt: 'Twelve looks that pack flat, mix hard, and photograph everywhere — built around two swimsuits and a bag.',
      featuredImage: { $asset: 'post-vacation' },
      body: {
        type: 'doc',
        content: [
          para('A good vacation capsule is a small number of pieces that make a large number of outfits. The trick is not packing more — it is packing things that talk to each other, so a swimsuit becomes a bodysuit and a skirt becomes an evening.'),
          h2('Two swimsuits, worn twelve ways'),
          para('The Ring-Detail String Bikini and the One-Shoulder One-Piece are the whole foundation. The one-piece doubles as a top under the faux-leather mini for dinner; the bikini lives under a cami and the wide-leg jean for the market run.'),
          h2('Pack flat, arrive sharp'),
          para('Everything here rolls into a carry-on and shakes out crease-free — the satin maxi included. Add the quilted shoulder bag for the plane and the beach both, and leave the hard cases at home.'),
          para('Twelve looks, one small bag. The only thing you should overpack is sunscreen.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'denim-reset-wide-leg',
    status: 'published',
    body: {
      title: 'Denim Reset — Styling Wide-Leg',
      excerpt: 'The wide-leg jean is the new blank canvas. Five ways to wear it, from the coffee run to the night out.',
      featuredImage: { $asset: 'post-denim' },
      body: {
        type: 'doc',
        content: [
          para('The skinny era is over and nobody is mourning it. The high-rise wide-leg is the jean everything gets built around now — it lengthens the leg, forgives the lunch, and reads dressed-up or thrown-on depending entirely on what you put with it.'),
          h2('Day: keep it easy'),
          para('The wide-leg jean, the rib-knit cami, and a jacket over the shoulders. Flat shoes, big sunglasses, done. This is the version you can get dressed for in ninety seconds and still feel put-together in.'),
          h2('Night: raise the top half'),
          para('Swap the cami for the corset bustier and add a heel. The volume down low balances the structure up top, and the whole thing tips from errand to evening without changing the jean.'),
          para('One pair, five outfits, zero fuss. That is the reset — buy the good jean, then let it do the heavy lifting for a year.'),
        ],
      },
    },
  },
];

// ── Product detail (the dense fast-fashion PDP) + Shop ───────────────────────────
// Fashion Nova's PDP is a two-column conversion machine: a big image with a red "% OFF"
// badge on the left; on the right a dense buy-box — breadcrumb, title, SALE PRICE + comp-
// value strikethrough, pay-in-4, a red "prices as marked" line, a black full-width Add-to-
// bag, a delivery-countdown urgency block, then Product Details / Material / Shipping
// accordions (DESIGN §4/§5/§7). Ported to Voltage in the `voltage` theme: `btn-primary` is
// the near-black chrome CTA the black "Add to Bag" calls for, the sale-red rides `badge
// badge-accent` fills (their own AA `-content` ink) rather than bare red text, and the
// urgency clock reuses this bundle's STATIC `saleCountdown()` (never a live timer that
// expires to 00:00:00 on the shipped starter). Bound fields come from the shared PDP kit
// (correct `repeat('product')` scope + `item.*` binds); the layout + brand copy are ours.

/** A row of small trust promises under the CTA — free shipping, easy returns, secure
 *  checkout. Ink text on a hairline-topped row; each item leads with a filled sale-red chip
 *  so the "priced to move" energy stays without fading any readable copy. */
function pdpTrustRow(): Node {
  const item = (chip: string, label: string): Node =>
    el('div', 'flex items-center gap-2', {
      children: [
        el('span', 'badge badge-accent badge-sm', { text: chip }),
        el('span', 'text-sm font-medium text-base-content', { text: label }),
      ],
    });
  return el('div', 'flex flex-wrap gap-x-6 gap-y-3 border-t border-base-300 pt-5', {
    children: [
      item('Free', 'shipping over $75'),
      item('30 days', 'easy returns'),
      item('Secure', 'checkout'),
    ],
  });
}

/** The delivery-urgency block — Fashion Nova's "Order within 6 hrs 7 mins" countdown, on
 *  Voltage's near-black chrome ground so the STATIC `saleCountdown()` boxes (which invert the
 *  primary pair) read correctly. A fixed, plausible flash-sale clock: never a live timer that
 *  would expire on a tenant installing weeks later. */
function pdpDeliveryUrgency(): Node {
  return el('div', 'flex flex-col gap-3 rounded-box bg-primary p-5 text-primary-content', {
    children: [
      el('div', 'flex flex-wrap items-center gap-3', {
        children: [
          el('span', 'badge badge-accent', { text: 'Selling fast' }),
          el('p', 'text-sm font-semibold', { text: 'Order within' }),
          saleCountdown(),
          el('p', 'text-sm font-semibold', { text: 'for next-day dispatch' }),
        ],
      }),
      el('p', 'text-sm leading-relaxed', {
        text: 'Get it by tomorrow with 1-day shipping — most orders placed before the clock runs out ship the same day.',
      }),
    ],
  });
}

/** One labelled detail block in the buy-box — an `<h2>` label over a paragraph of static
 *  brand copy. Fashion Nova's "Product Details / Material" accordions, stacked rather than
 *  toggled so the page reads without JavaScript and needs no behaviour marker. */
function pdpDetail(label: string, body: string): Node {
  return el('div', 'flex flex-col gap-2 border-t border-base-300 pt-5', {
    children: [
      el('h2', 'text-sm font-bold uppercase tracking-widest text-base-content', { text: label }),
      el('p', 'text-base leading-relaxed text-base-content', { text: body }),
    ],
  });
}

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the big product image with a sale-red flag. Right: the dense, discount-forward buy
 *  column — label, title, sale price + comp-value strikethrough, pay-in-4, black Add-to-bag,
 *  urgency clock, trust row and the detail stack. */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-10 @3xl:py-14', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-8 @3xl:grid-cols-2 @3xl:gap-14', {
        children: [
          // The big image, with a red "Sale" flag pinned top-left (every Voltage SKU carries a
          // comp value, so the flag is honest on every product the PDP routes).
          el('div', 'relative', {
            children: [
              pdpImage(
                'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'
              ),
              el('span', 'absolute left-4 top-4 badge badge-accent badge-lg font-bold', {
                text: 'Sale',
              }),
            ],
          }),
          // The dense buy column.
          el('div', 'flex flex-col gap-6', {
            children: [
              el('div', 'flex flex-col gap-3', {
                children: [
                  // Breadcrumb/label above the title — a plain <p>, so the product title stays
                  // the page's one <h1>.
                  el('p', 'text-sm font-semibold uppercase tracking-widest text-base-content', {
                    text: 'Voltage · New in',
                  }),
                  pdpTitle(
                    'h1',
                    'text-3xl font-bold uppercase leading-tight tracking-tight text-base-content @3xl:text-4xl'
                  ),
                  // Sale price big + bold, comp-value struck through beside it (the kit hides
                  // the strike on a non-sale product). Ink, never the brand role, on the number.
                  pdpPriceRow({
                    priceClass: 'text-3xl font-bold text-base-content',
                    compareClass: 'text-xl text-base-content line-through',
                    rowClass: 'flex flex-wrap items-baseline gap-3',
                  }),
                  // The red sale grammar — a filled chip carries the "prices as marked" signal
                  // (AA `-content` ink), and a pay-in-4 line, provider-agnostic + no fake figure.
                  el('div', 'flex flex-wrap items-center gap-3', {
                    children: [
                      el('span', 'badge badge-accent font-semibold', {
                        text: 'Prices as marked — no code needed',
                      }),
                    ],
                  }),
                  el('p', 'text-sm font-medium text-base-content', {
                    text: 'Or pay in 4 interest-free installments at checkout.',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              // Qty + Add to bag — the near-black chrome CTA (btn-primary in `voltage`).
              addToCartForm(),
              // The delivery-countdown urgency block.
              pdpDeliveryUrgency(),
              // Trust promises.
              pdpTrustRow(),
              // The detail stack.
              el('div', 'flex flex-col gap-5', {
                children: [
                  pdpDetail(
                    'Product details',
                    'Cut close to the trend and made to move — the shape the street is actually wearing, dropped while it still matters. True to size with a little stretch; if you are between sizes and want it looser, size up. New colours and restocks land every week.',
                  ),
                  pdpDetail(
                    'Fabric & care',
                    'A soft, hard-wearing blend chosen to hold its shape wash after wash. Machine wash cold inside-out, hang or lay flat to dry, cool iron if needed. Full fibre content and a care symbol guide are on the sewn-in label.',
                  ),
                  pdpDetail(
                    'Shipping & returns',
                    'Free 1-day shipping on orders over $75, and most orders ship the same day. Not quite right? Send it back within 30 days for a refund or store credit — tags on, unworn. Prices are as marked, so what you see is the price you pay.',
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

/** The full dense PDP — the buy region above a "You may also like" carousel of same-
 *  collection pieces (`commerce.related`, the shared kit's default cross-sell). */
const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'You may also like' });

/** The Shop page's own header, shown ABOVE the faceted PLP catalogue core the harness
 *  appends. A loud near-black chrome band — bold uppercase title, a punchy sale line, and a
 *  filled sale-red offer chip — the discount-forward framing Fashion Nova gives its listing,
 *  in place of the generic "Shop / Everything we currently have". */
const SHOP: Node[] = [
  el('section', 'bg-primary text-primary-content @container px-6 py-14 @3xl:py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-5', {
        children: [
          el('div', 'flex flex-wrap items-center gap-3', {
            children: [
              el('span', 'badge badge-accent badge-lg font-bold', { text: 'Up to 70% off' }),
              el('span', 'text-sm font-semibold uppercase tracking-widest', {
                text: 'New drops daily',
              }),
            ],
          }),
          el(
            'h1',
            'text-4xl font-bold uppercase leading-tight tracking-tight @3xl:text-6xl',
            { text: 'Shop everything' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed', {
            text: 'Every style Voltage is dropping right now — dresses, denim, tops, sets and swim — filtered and sorted however you like. Prices as marked, restocked before they sell out, and priced to move.',
          }),
        ],
      }),
    ],
  }),
];

// ── The remaining functional pages (bespoke framing over the shared cores) ───────
// Collections / Cart / Search each get Voltage's own loud masthead above the pinned,
// shoppable core the harness appends; the Journal index gets its own masthead over the
// shared linkable post grid. Same discount-forward, urgency-driven voice as the rest of
// the site — bold uppercase headers, ink body copy, sale-red held to filled `badge
// badge-accent` chips that carry their own AA `-content` ink (never bare red text).

/** A plain bold-uppercase page masthead on the white content ground — an `<h1>` + one intro
 *  line. Used for Search and the Journal index, which each want a punchy header over their
 *  core without the full near-black chrome band. */
function pageMasthead(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-4xl font-bold uppercase leading-tight tracking-tight text-base-content @3xl:text-6xl',
            { text: heading }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', { text: lead }),
        ],
      }),
    ],
  });
}

/** The Collections landing masthead — a loud near-black chrome band (matching the Shop
 *  header's energy) with a filled sale-red offer chip, the drops-and-sale framing above the
 *  pinned collections grid. `bg-primary text-primary-content` is the theme's near-black
 *  ground; the heading + intro inherit its `-content` ink, the chip carries its own. */
const COLLECTIONS: Node[] = [
  el('section', 'bg-primary text-primary-content @container px-6 py-14 @3xl:py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-5', {
        children: [
          el('div', 'flex flex-wrap items-center gap-3', {
            children: [
              el('span', 'badge badge-accent badge-lg font-bold', { text: 'Up to 80% off' }),
              el('span', 'text-sm font-semibold uppercase tracking-widest', {
                text: 'New drops daily',
              }),
            ],
          }),
          el(
            'h1',
            'text-4xl font-bold uppercase leading-tight tracking-tight @3xl:text-6xl',
            { text: 'Shop the drops' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed', {
            text: 'New arrivals, best-sellers, the going-out edit and the 60–80% off sale rail — every collection Voltage is dropping right now, grouped so you can shop straight to the vibe. Fresh styles land every week, restocked before they sell out.',
          }),
        ],
      }),
    ],
  }),
];

const SEARCH: Node[] = [
  pageMasthead(
    'Search Voltage',
    'Hunting a specific style, size or steal? Search the whole catalogue and the Edit below — thousands of pieces, new drops every week, all priced to move.'
  ),
];

const JOURNAL: Node[] = [
  pageMasthead(
    'The Voltage Edit',
    'How the team is actually wearing the new drops — trend reports, styling tricks and vacation packing lists, each one built to shop straight from the story.'
  ),
];

/** The Cart page's own header — a reassurance band above the pinned cart core, in place of
 *  the generic "Your cart" heading. Free-shipping threshold, easy 30-day returns and a secure
 *  checkout are the three things a fast-fashion buyer wants confirmed before they check out;
 *  the urgency line is STATIC brand copy, never a live figure that would go stale. The chips
 *  reuse the PDP trust-row grammar — a filled sale-red chip beside readable ink copy. */
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-6', {
        children: [
          el('div', 'flex flex-col gap-4', {
            children: [
              el(
                'h1',
                'text-4xl font-bold uppercase leading-tight tracking-tight text-base-content @3xl:text-5xl',
                { text: 'Your bag' }
              ),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'Almost yours. Free 1-day shipping over $75, easy 30-day returns and a secure checkout — no surprises at the till. Bag your styles before they sell out.',
              }),
            ],
          }),
          el('div', 'flex flex-wrap gap-x-6 gap-y-3 border-t border-base-300 pt-6', {
            children: [
              el('div', 'flex items-center gap-2', {
                children: [
                  el('span', 'badge badge-accent badge-sm', { text: 'Free' }),
                  el('span', 'text-sm font-medium text-base-content', { text: 'shipping over $75' }),
                ],
              }),
              el('div', 'flex items-center gap-2', {
                children: [
                  el('span', 'badge badge-accent badge-sm', { text: '30 days' }),
                  el('span', 'text-sm font-medium text-base-content', { text: 'easy returns' }),
                ],
              }),
              el('div', 'flex items-center gap-2', {
                children: [
                  el('span', 'badge badge-accent badge-sm', { text: 'Secure' }),
                  el('span', 'text-sm font-medium text-base-content', { text: 'checkout' }),
                ],
              }),
            ],
          }),
        ],
      }),
    ],
  }),
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'catalog-dense',
  key: 'sparx-catalog-dense',
  name: 'sparx — Catalog Dense',
  summary:
    'A high-volume, discount-forward storefront for a fast-fashion apparel shop — a full-bleed offer hero over relentless dense product grids, per-category rails and candy-loud promo bands, in a bright near-black-chrome theme with one sale-red accent. Modelled on the dense fast-fashion catalog archetype; shipped as Voltage.',
  tagline: 'A dense, energetic template for high-volume apparel and fast-fashion catalogs.',
  vertical: 'retail',
  industry: 'Fast-fashion apparel',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 55,
  brand: {
    businessName: 'Voltage',
    tagline: 'Trend-fast fashion, priced to move.',
  },
  // Fashion Nova chrome: a brand-LEFT wordmark with a prominent nav, a loud filled shop
  // CTA in the bar (`showCta: true`), and the category-heavy COLUMNS footer (app + help +
  // company link columns over the legal bar; the on-page newsletter carries the capture).
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Voltage — new-season fashion, new drops daily',
      description:
        'Voltage drops new-season dresses, denim, tops and sets every week at prices built to move — the trend-fast fashion edit, restocked before it sells out.',
    },
    about: {
      title: 'About Voltage',
      description:
        'Who Voltage is, and how we get the newest looks to you first at prices that keep up with the trend cycle.',
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
