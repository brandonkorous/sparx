// sparx-luxe-minimal — a reference-driven site template (docs/templates/skims).
//
// SKIMS translated to sparx: a quiet-luxury DTC storefront where imagery carries almost
// all the weight and type almost none — full-bleed photography, heavy condensed all-caps
// headlines, a disciplined warm-neutral monochrome with NO chromatic accent, and deep
// negative space. Ported from shapewear to a premium-skincare essentials brand — Nue
// Skincare, "Solutions for every skin". The home page is the SKIMS rhythm — a full-bleed
// hero with a bottom-left overlaid headline, a 4-up category-tile row, a best-sellers
// carousel, a full-bleed editorial band, a treatment carousel, a second editorial band,
// and a centered mission statement on a rare near-black beat — dressed in the bespoke
// `bare` theme (warm bone ground, near-black mono primary, Oswald all-caps display).
//
// This file is JUST the SPEC; the composition + emission live in the shared
// `template-sites/harness.ts`, which the other nine templates reuse. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-luxe-minimal.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-luxe-minimal/**" \
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
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import { videoBackdrop } from './template-sites/behaviors';
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
// hero / category-tile / editorial-band photos are TREE imagery, so they hot-link the
// same URL inline (docs/54 §6) — they still appear in `assets` as the single documented
// registry of the bundle's imagery + alt text. In the `bare` translation the imagery
// carries the ONLY chroma on the page — the chrome is near-black ink on warm bone, every
// product shot on the same warm-neutral sweep, so the grid reads like an editorial wall.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
  // Products — the core skincare regimen
  everydayCleanser: '1597931752949-98c74b5b159f',
  gentleExfoliant: '1659007747376-3811b34e458f',
  barrierSerum: '1665763630810-e6251bdd392d',
  recoveryOil: '1599022484220-967921f2217c',
  renewalMask: '1728994062543-74a1dc2c9392',
  eyeCream: '1576426863848-c21f53c60b19',
  moisturizer: '1633171036157-78d53387fdc0',
  mineralSpf: '1770732766528-d0e9fd0df233',
  hydratingMist: '1715750968540-841103c78d47',
  bodyLotion: '1623150502742-6a849aa94be4',
  lipMask: '1609097164502-59a1f0f9a66f',
  ritualSet: '1630398777649-cdfc7c5e8a24',
  // Journal posts
  postRoutine: '1670201203208-055d6d79db4a',
  postSerum: '1679394270597-e90694d70350',
  postSpf: '1728727217834-b190862837a3',
  // Hero + category tiles + editorial bands (tree imagery)
  hero: '1620916297397-a4a5402a3c6c',
  tileCleanse: '1590923801255-05c5e06536f4',
  tileTreat: '1670201202961-dce15b9e6939',
  tileMoisturize: '1585945037805-5fd82c2e60b1',
  tileProtect: '1683408640631-2c99fff964d7',
  bandRitual: '1670201203291-e719f27d1e0e',
  bandEverySkin: '1643379855542-82c0c7483f3a',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'everyday-cleanser', url: U(IMG.everydayCleanser), alt: 'A white pump bottle of cleanser on folded linen' },
  { id: 'gentle-exfoliant', url: U(IMG.gentleExfoliant), alt: 'A swirl of pale exfoliating cream on a warm ground' },
  { id: 'barrier-repair-serum', url: U(IMG.barrierSerum), alt: 'An amber glass serum bottle beside pale blooms' },
  { id: 'facial-recovery-oil', url: U(IMG.recoveryOil), alt: 'A face-oil bottle resting on soft dark linen' },
  { id: 'overnight-renewal-mask', url: U(IMG.renewalMask), alt: 'A close texture of rich overnight cream' },
  { id: 'quiet-eye-cream', url: U(IMG.eyeCream), alt: 'A small gold-capped dropper on pale marble' },
  { id: 'ultimate-moisturizer', url: U(IMG.moisturizer), alt: 'An unbranded ceramic-toned moisturizer jar' },
  { id: 'daily-mineral-spf', url: U(IMG.mineralSpf), alt: 'An amber dropper bottle on a warm taupe ground' },
  { id: 'hydrating-essence-mist', url: U(IMG.hydratingMist), alt: 'A frosted glass bottle of essence on soft grey' },
  { id: 'body-softening-lotion', url: U(IMG.bodyLotion), alt: 'A close texture of smooth body cream' },
  { id: 'overnight-lip-mask', url: U(IMG.lipMask), alt: 'A small balm jar resting on pale stone' },
  { id: 'the-complete-ritual', url: U(IMG.ritualSet), alt: 'A basket of skincare essentials with folded towels' },
  { id: 'post-a-bare-routine', url: U(IMG.postRoutine), alt: 'A woman pressing essence into her cheek' },
  { id: 'post-barrier-serum', url: U(IMG.postSerum), alt: 'A dropper releasing a single bead of serum' },
  { id: 'post-spf-honestly', url: U(IMG.postSpf), alt: 'A portrait of fresh, bare skin against a pale wall' },
  { id: 'hero-home', url: U(IMG.hero), alt: 'Hands smoothing a few drops of serum, wrapped in soft linen' },
  { id: 'tile-cleanse', url: U(IMG.tileCleanse), alt: 'A soft cleansing foam texture' },
  { id: 'tile-treat', url: U(IMG.tileTreat), alt: 'A woman pressing a treatment essence into her skin' },
  { id: 'tile-moisturize', url: U(IMG.tileMoisturize), alt: 'A swatch of moisturizing cream on a warm ground' },
  { id: 'tile-protect', url: U(IMG.tileProtect), alt: 'A calm face at rest, skin clear and even' },
  { id: 'band-ritual', url: U(IMG.bandRitual), alt: 'Essence poured from a frosted bottle onto the back of a hand' },
  { id: 'band-every-skin', url: U(IMG.bandEverySkin), alt: 'A close portrait of bare skin with two dabs of cream' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-luxe-minimal: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections (the SKIMS sequence, bare-restraint) ───────────────────────

/** The full-bleed hero — one photograph filling the width, a heavy all-caps headline in a
 *  solid readable panel anchored BOTTOM-LEFT, and a SINGLE underlined text link (the SKIMS
 *  restraint: no button chrome, no dual CTA). Tenant content, so it hot-links a real
 *  photograph; every class is a NAMED utility so it survives the stamp into the stored
 *  tree. Hierarchy is pure scale + weight + case — the display face is Oswald, uppercased
 *  here, exactly the reference's one type contrast. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      // SKIMS leads with a slow campaign film — so Nue's hero is a soft, muted clip behind
      // the panel, the still as poster (kept until it decodes, and if it never plays).
      videoBackdrop({
        src: '/video/tpl-luxe-minimal.mp4',
        poster: assetUrl('hero-home'),
        posterAlt: 'Hands smoothing a few drops of serum, wrapped in soft linen',
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 bg-base-100 p-8 @3xl:p-10', {
              children: [
                el(
                  'h1',
                  'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl',
                  { text: 'Solutions for every skin' }
                ),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'A short range of skincare essentials — a cleanser, a serum, a cream, an SPF — made for every skin, and nothing it does not need.',
                }),
                el('a', 'text-base font-semibold uppercase tracking-wide text-base-content underline underline-offset-4', {
                  attrs: { href: '/shop' },
                  text: 'Shop the ritual',
                }),
              ],
            }),
          ],
        }
      ),
    ],
  });
}

/** One category tile — a square photograph on the warm-neutral ground with a small
 *  uppercase label BENEATH it (not overlaid), no card chrome, no border, no shadow. The
 *  whole tile is the link. This is the SKIMS treatment §7 calls for: label-under-image,
 *  4-up down to 2-up. */
function categoryTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
  return el('a', 'flex flex-col gap-3 bg-base-100', {
    attrs: { href: o.href },
    children: [
      el('img', 'aspect-square w-full bg-base-200 object-cover', {
        attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
      }),
      el('span', 'text-center text-sm font-semibold uppercase tracking-wide text-base-content', {
        text: o.label,
      }),
    ],
  });
}

/** The 4-up category-tile row — the four steps of the routine (Cleanse · Treat ·
 *  Moisturize · Protect). Headless by design: SKIMS drops tile rows with no introducing
 *  heading, and the labels under each tile carry the meaning. 4-up → 2-up on a narrow
 *  container, a hairline gutter for scannability (the DESIGN's one deliberate departure
 *  from fully gutterless). */
function categoryTiles(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto w-full max-w-6xl', {
        children: [
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4', {
            children: [
              categoryTile({
                assetId: 'tile-cleanse',
                label: 'Cleanse',
                href: '/shop',
                alt: 'A soft cleansing foam texture',
              }),
              categoryTile({
                assetId: 'tile-treat',
                label: 'Treat',
                href: '/shop',
                alt: 'A woman pressing a treatment essence into her skin',
              }),
              categoryTile({
                assetId: 'tile-moisturize',
                label: 'Moisturize',
                href: '/shop',
                alt: 'A swatch of moisturizing cream on a warm ground',
              }),
              categoryTile({
                assetId: 'tile-protect',
                label: 'Protect',
                href: '/shop',
                alt: 'A calm face at rest, skin clear and even',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A full-bleed editorial band — a photograph carrying one heavy all-caps headline, one
 *  line of subhead and a single underlined link in a solid panel anchored BOTTOM-LEFT
 *  (the SKIMS "Best Sellers" / "Mens" band). The workhorse of the reference: nearly every
 *  homepage unit is an edge-to-edge photo with a corner-anchored headline and text CTA. */
function editorialBand(o: {
  heading: string;
  lead: string;
  assetId: string;
  cta: string;
  href: string;
  alt: string;
}): Node {
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
            el('div', 'flex max-w-xl flex-col gap-4 bg-base-100 p-8 @3xl:p-10', {
              children: [
                el(
                  'h2',
                  'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-5xl',
                  { text: o.heading }
                ),
                el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
                el('a', 'text-base font-semibold uppercase tracking-wide text-base-content underline underline-offset-4', {
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

/** The mission statement — a centered, heavy all-caps display line on the rare near-black
 *  beat (`bg-primary`, its own `text-primary-content` ink), no image and no attribution.
 *  This is the SKIMS closing "we are a solutions-oriented brand" band, and the one place a
 *  page dressed in this restrained theme is allowed to go dark and speak plainly. Neutral
 *  is earned here by the archetype (DESIGN §7): the mono primary IS the design. */
function missionBand(): Node {
  return el('section', 'bg-primary text-primary-content @container px-6 py-24 @3xl:py-32', {
    children: [
      el('div', 'mx-auto flex w-full max-w-4xl flex-col items-center gap-6 text-center', {
        children: [
          el('p', 'text-3xl font-bold uppercase leading-tight tracking-tight @3xl:text-5xl', {
            text: 'Nue is a skincare studio building a calmer, simpler routine — a short range of essentials, made for every skin, and nothing you do not need.',
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  hero(),
  categoryTiles(),
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Best sellers' }),
  editorialBand({
    heading: 'The morning ritual',
    lead: 'Four steps, five minutes: cleanse, treat, moisturize, protect. The order is the whole method — each step earns its place, and there is nothing to add.',
    assetId: 'band-ritual',
    cta: 'See the routine',
    href: '/shop',
    alt: 'Essence poured from a frosted bottle onto the back of a hand',
  }),
  productsBlock({ source: 'commerce.category.treat', layout: 'carousel', heading: 'Treat' }),
  editorialBand({
    heading: 'Made for every skin',
    lead: 'No line for oily, no line for dry, no ten-step maze. One considered range that works across skin types, ages and seasons — because most skin wants less, done well.',
    assetId: 'band-every-skin',
    cta: 'Read our approach',
    href: '/about',
    alt: 'A close portrait of bare skin with two dabs of cream',
  }),
  missionBand(),
  // NB: no page-level newsletter band here — the `footer: 'newsletter'` chrome variant
  // carries the "Stay in the know" sign-up, so a section here would be two back-to-back
  // captures.
];

// ── About + Contact (Nue-voiced) ─────────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-5xl font-bold uppercase tracking-tight text-base-content @2xl:text-6xl', {
            text: 'About Nue',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Nue is a skincare studio with a short memory for trends and a long one for what actually works. We make a small range of essentials — a cleanser, a serum, a moisturizer, an SPF, and a handful of things around them — formulated to be gentle enough for daily use and honest about what each one does.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'There is no line for oily skin and no line for dry, no ten-step maze, and nothing you do not need. Just a considered routine that works across skin types, ages and seasons — packaged plainly, priced fairly, and made for every skin. That is the whole idea: solutions for every skin.',
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
          el('h1', 'text-5xl font-bold uppercase tracking-tight text-base-content @2xl:text-6xl', {
            text: 'Talk to us',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Not sure where to start, or which of two to choose? Tell us about your skin and what you are hoping to change, and a real person — not a script — will point you to the shortest routine that will do it.',
          }),
          el('a', 'btn btn-primary btn-lg', {
            attrs: { href: 'mailto:hello@nueskincare.example' },
            text: 'Email the studio',
          }),
        ],
      }),
    ],
  }),
];

// ── Commerce (Nue Skincare — 12 SKUs across a coherent regimen) ───────────────────

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
    handle: 'everyday-cleanser',
    title: 'The Everyday Cleanser',
    description:
      'A soft gel-to-milk cleanser that lifts sunscreen, make-up and the day off your skin without the tight, squeaky feeling that means you have stripped it. Fragrance-free, pH-balanced, and gentle enough to use morning and night.',
    status: 'active',
    productType: 'Cleanser',
    vendor: 'Nue Skincare',
    tags: ['cleanser', 'gentle', 'fragrance-free', 'daily'],
    categoryHandles: ['cleanse'],
    collectionHandles: ['best-sellers', 'the-morning-ritual', 'the-evening-ritual', 'the-essentials'],
    seoTitle: 'The Everyday Cleanser — gentle daily face wash',
    seoDescription: 'A soft gel-to-milk cleanser that removes make-up and SPF without stripping the skin.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: '150ml' }, { value: '250ml' }] },
    ],
    variants: [
      { sku: 'NUE-CLEAN-150', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '150ml' } },
      { sku: 'NUE-CLEAN-250', priceCents: money(40), inventoryPolicy: 'continue', optionValues: { Size: '250ml' } },
    ],
    images: [{ assetId: 'everyday-cleanser', isPrimary: true, alt: 'The Everyday Cleanser' }],
  },
  {
    handle: 'gentle-exfoliant',
    title: 'Gentle Exfoliant',
    description:
      'A low-percentage overnight exfoliant that resurfaces with lactic and gluconolactone acids — enough to smooth and brighten, not so much that it stings. The one acid step most routines actually need, and the only one Nue makes.',
    status: 'active',
    productType: 'Exfoliant',
    vendor: 'Nue Skincare',
    tags: ['exfoliant', 'lactic-acid', 'resurfacing', 'treat'],
    categoryHandles: ['cleanse'],
    collectionHandles: ['the-evening-ritual'],
    seoTitle: 'Gentle Exfoliant — low-percentage lactic acid treatment',
    seoDescription: 'A gentle overnight lactic-acid exfoliant that smooths and brightens without stinging.',
    variants: [
      { sku: 'NUE-EXFOL-100', priceCents: money(34), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'gentle-exfoliant', isPrimary: true, alt: 'The Gentle Exfoliant' }],
  },
  {
    handle: 'barrier-repair-serum',
    title: 'Barrier Repair Serum',
    description:
      'A quiet workhorse of niacinamide, ceramides and panthenol that rebuilds a stressed skin barrier over a few weeks — the reason skin stops feeling reactive, red and thirsty. Layers under anything, plays well with everything.',
    status: 'active',
    productType: 'Serum',
    vendor: 'Nue Skincare',
    tags: ['serum', 'niacinamide', 'ceramides', 'barrier', 'treat'],
    categoryHandles: ['treat'],
    collectionHandles: ['best-sellers', 'the-morning-ritual', 'new-arrivals'],
    seoTitle: 'Barrier Repair Serum — niacinamide & ceramide serum',
    seoDescription: 'A niacinamide, ceramide and panthenol serum that rebuilds a stressed skin barrier.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: '30ml' }, { value: '50ml' }] },
    ],
    variants: [
      { sku: 'NUE-SERUM-30', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '30ml' } },
      { sku: 'NUE-SERUM-50', priceCents: money(82), inventoryPolicy: 'continue', optionValues: { Size: '50ml' } },
    ],
    images: [{ assetId: 'barrier-repair-serum', isPrimary: true, alt: 'The Barrier Repair Serum' }],
  },
  {
    handle: 'facial-recovery-oil',
    title: 'Facial Recovery Oil',
    description:
      'A weightless blend of squalane, rosehip and a little vitamin E that seals in everything beneath it and leaves skin soft by morning. Three or four drops, pressed in last at night — the difference between hydrated and truly comfortable skin.',
    status: 'active',
    productType: 'Face oil',
    vendor: 'Nue Skincare',
    tags: ['oil', 'squalane', 'rosehip', 'overnight', 'treat'],
    categoryHandles: ['treat'],
    collectionHandles: ['the-evening-ritual'],
    seoTitle: 'Facial Recovery Oil — squalane & rosehip night oil',
    seoDescription: 'A weightless squalane and rosehip night oil that seals in hydration and softens skin.',
    variants: [
      { sku: 'NUE-OIL-30', priceCents: money(64), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'facial-recovery-oil', isPrimary: true, alt: 'The Facial Recovery Oil' }],
  },
  {
    handle: 'overnight-renewal-mask',
    title: 'Overnight Renewal Mask',
    description:
      'A rich leave-on cream mask you wear to bed twice a week — hyaluronic acid and shea to flood dry, tired skin, so you wake to the plump, rested face a good night is supposed to give you. No rinsing, no mess on the pillow.',
    status: 'active',
    productType: 'Mask',
    vendor: 'Nue Skincare',
    tags: ['mask', 'overnight', 'hyaluronic-acid', 'hydrating', 'treat'],
    categoryHandles: ['treat'],
    collectionHandles: ['the-evening-ritual'],
    seoTitle: 'Overnight Renewal Mask — leave-on hydrating night mask',
    seoDescription: 'A rich leave-on overnight cream mask with hyaluronic acid and shea for tired, dry skin.',
    variants: [
      { sku: 'NUE-MASK-50', priceCents: money(48), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'overnight-renewal-mask', isPrimary: true, alt: 'The Overnight Renewal Mask' }],
  },
  {
    handle: 'quiet-eye-cream',
    title: 'Quiet Eye Cream',
    description:
      'A light caffeine-and-peptide cream for the thin skin around the eyes — enough to de-puff a slow morning and soften fine lines, without the pilling that ruins concealer. A little goes a long way, so a tube lasts.',
    status: 'active',
    productType: 'Eye cream',
    vendor: 'Nue Skincare',
    tags: ['eye-cream', 'caffeine', 'peptides', 'treat'],
    categoryHandles: ['treat'],
    collectionHandles: ['the-evening-ritual'],
    seoTitle: 'Quiet Eye Cream — caffeine & peptide eye cream',
    seoDescription: 'A light caffeine-and-peptide eye cream that de-puffs and softens fine lines without pilling.',
    variants: [
      { sku: 'NUE-EYE-15', priceCents: money(46), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'quiet-eye-cream', isPrimary: true, alt: 'The Quiet Eye Cream' }],
  },
  {
    handle: 'ultimate-moisturizer',
    title: 'Ultimate Moisturizer',
    description:
      'The cream the whole range is built around — glycerin, squalane and ceramides in a texture that sinks in fast and sits invisibly under SPF or make-up. Rich enough for winter, light enough for summer, and the last step most days need.',
    status: 'active',
    productType: 'Moisturizer',
    vendor: 'Nue Skincare',
    tags: ['moisturizer', 'ceramides', 'glycerin', 'daily', 'moisturize'],
    categoryHandles: ['moisturize'],
    collectionHandles: ['best-sellers', 'the-morning-ritual', 'the-essentials'],
    seoTitle: 'Ultimate Moisturizer — daily ceramide face cream',
    seoDescription: 'A glycerin, squalane and ceramide face cream that sinks in fast and layers under SPF.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: '50ml' }, { value: '100ml' }] },
    ],
    variants: [
      { sku: 'NUE-MOIST-50', priceCents: money(54), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '50ml' } },
      { sku: 'NUE-MOIST-100', priceCents: money(88), inventoryPolicy: 'continue', optionValues: { Size: '100ml' } },
    ],
    images: [{ assetId: 'ultimate-moisturizer', isPrimary: true, alt: 'The Ultimate Moisturizer' }],
  },
  {
    handle: 'daily-mineral-spf',
    title: 'Daily Mineral SPF 30',
    description:
      'A lightweight mineral sunscreen that finishes matte and leaves no white cast on any skin tone — the one step that does more for how skin ages than everything else combined. Wears cleanly under make-up, reapplies without a fuss.',
    status: 'active',
    productType: 'SPF',
    vendor: 'Nue Skincare',
    tags: ['spf', 'mineral', 'sunscreen', 'daily', 'protect'],
    categoryHandles: ['protect'],
    collectionHandles: ['best-sellers', 'the-morning-ritual', 'the-essentials'],
    seoTitle: 'Daily Mineral SPF 30 — no-white-cast mineral sunscreen',
    seoDescription: 'A lightweight matte mineral SPF 30 that leaves no white cast and wears under make-up.',
    variants: [
      { sku: 'NUE-SPF-50', priceCents: money(38), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'daily-mineral-spf', isPrimary: true, alt: 'The Daily Mineral SPF 30' }],
  },
  {
    handle: 'hydrating-essence-mist',
    title: 'Hydrating Essence Mist',
    description:
      'A fine essence mist of hyaluronic acid and aloe to press in before serum, or over make-up when skin feels tight. Not a gimmick spritz — a real hydrating layer that helps everything after it absorb, and a small ritual on a long day.',
    status: 'active',
    productType: 'Mist',
    vendor: 'Nue Skincare',
    tags: ['mist', 'essence', 'hyaluronic-acid', 'hydrating', 'moisturize'],
    categoryHandles: ['moisturize'],
    collectionHandles: ['new-arrivals'],
    seoTitle: 'Hydrating Essence Mist — hyaluronic acid face mist',
    seoDescription: 'A fine hyaluronic-acid and aloe essence mist that hydrates and preps skin for serum.',
    variants: [
      { sku: 'NUE-MIST-100', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'hydrating-essence-mist', isPrimary: true, alt: 'The Hydrating Essence Mist' }],
  },
  {
    handle: 'body-softening-lotion',
    title: 'Body Softening Lotion',
    description:
      'A fast-absorbing body lotion with oat, shea and glycerin that softens rough patches and settles in seconds, so you can dress straight after. Lightly and briefly scented, then gone — nothing that fights your fragrance.',
    status: 'active',
    productType: 'Body',
    vendor: 'Nue Skincare',
    tags: ['body', 'lotion', 'oat', 'shea', 'daily'],
    categoryHandles: ['body'],
    collectionHandles: ['the-essentials'],
    seoTitle: 'Body Softening Lotion — fast-absorbing oat & shea lotion',
    seoDescription: 'A fast-absorbing oat, shea and glycerin body lotion that softens skin in seconds.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: '250ml' }, { value: '400ml' }] },
    ],
    variants: [
      { sku: 'NUE-BODY-250', priceCents: money(36), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '250ml' } },
      { sku: 'NUE-BODY-400', priceCents: money(52), inventoryPolicy: 'continue', optionValues: { Size: '400ml' } },
    ],
    images: [{ assetId: 'body-softening-lotion', isPrimary: true, alt: 'The Body Softening Lotion' }],
  },
  {
    handle: 'overnight-lip-mask',
    title: 'Overnight Lip Mask',
    description:
      'A thick, non-sticky balm that repairs chapped, flaking lips while you sleep — shea, squalane and a whisper of vanilla. Wake up to soft lips that take colour cleanly. Keeps in a pocket for the worst of winter, too.',
    status: 'active',
    productType: 'Lip care',
    vendor: 'Nue Skincare',
    tags: ['lip', 'balm', 'overnight', 'shea', 'body'],
    categoryHandles: ['body'],
    collectionHandles: ['the-evening-ritual'],
    seoTitle: 'Overnight Lip Mask — repairing shea lip balm',
    seoDescription: 'A thick, non-sticky overnight lip mask of shea and squalane that repairs chapped lips.',
    variants: [
      { sku: 'NUE-LIP-15', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'overnight-lip-mask', isPrimary: true, alt: 'The Overnight Lip Mask' }],
  },
  {
    handle: 'the-complete-ritual',
    title: 'The Complete Ritual',
    description:
      'The whole routine in one box — cleanser, barrier serum, moisturizer and SPF, at a saving on buying them apart. The honest way to start with Nue: everything you need for the four-step ritual, and nothing you do not.',
    status: 'active',
    productType: 'Set',
    vendor: 'Nue Skincare',
    tags: ['set', 'ritual', 'gift', 'starter'],
    categoryHandles: ['treat'],
    collectionHandles: ['best-sellers', 'new-arrivals'],
    seoTitle: 'The Complete Ritual — Nue four-step skincare set',
    seoDescription: 'The full four-step routine — cleanser, serum, moisturizer and SPF — in one boxed set.',
    variants: [
      { sku: 'NUE-RITUAL-SET', priceCents: money(180), isDefault: true, inventoryPolicy: 'continue' },
    ],
    images: [{ assetId: 'the-complete-ritual', isPrimary: true, alt: 'The Complete Ritual set' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'cleanse', name: 'Cleanse', description: 'Cleansers and gentle exfoliants.', featured: true },
    { handle: 'treat', name: 'Treat', description: 'Serums, oils, masks and eye care.', featured: true },
    { handle: 'moisturize', name: 'Moisturize', description: 'Creams and hydrating mists.', featured: true },
    { handle: 'protect', name: 'Protect', description: 'Daily mineral sun protection.', featured: true },
    { handle: 'body', name: 'Body', description: 'Body and lip care for every day.', featured: false },
  ],
  collections: [
    {
      handle: 'best-sellers',
      name: 'Best Sellers',
      description: 'The essentials most people start with.',
      type: 'manual',
      featured: true,
      productHandles: [
        'everyday-cleanser',
        'barrier-repair-serum',
        'ultimate-moisturizer',
        'daily-mineral-spf',
        'the-complete-ritual',
      ],
    },
    {
      handle: 'the-morning-ritual',
      name: 'The Morning Ritual',
      description: 'Cleanse, treat, moisturize, protect — in five minutes.',
      type: 'manual',
      featured: false,
      productHandles: [
        'everyday-cleanser',
        'barrier-repair-serum',
        'ultimate-moisturizer',
        'daily-mineral-spf',
      ],
    },
    {
      handle: 'the-evening-ritual',
      name: 'The Evening Ritual',
      description: 'The slower steps, for the end of the day.',
      type: 'manual',
      featured: false,
      productHandles: [
        'everyday-cleanser',
        'facial-recovery-oil',
        'overnight-renewal-mask',
        'quiet-eye-cream',
        'overnight-lip-mask',
      ],
    },
    {
      handle: 'new-arrivals',
      name: 'New Arrivals',
      description: 'The latest additions to the range.',
      type: 'manual',
      featured: false,
      productHandles: ['barrier-repair-serum', 'hydrating-essence-mist', 'the-complete-ritual'],
    },
    {
      handle: 'the-essentials',
      name: 'The Essentials',
      description: 'The short list, if you only buy a few.',
      type: 'manual',
      featured: false,
      productHandles: [
        'everyday-cleanser',
        'ultimate-moisturizer',
        'daily-mineral-spf',
        'body-softening-lotion',
      ],
    },
  ],
  products: PRODUCTS,
};

// ── Content (The Nue Journal) ────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'the-bare-basics-of-a-skin-routine',
    status: 'published',
    body: {
      title: 'The bare basics of a skin routine',
      excerpt: 'You need four things, not fourteen. A plain guide to a routine that actually holds — and why everything past it is optional.',
      featuredImage: { $asset: 'post-a-bare-routine' },
      body: {
        type: 'doc',
        content: [
          para('A good skin routine is shorter than the internet would have you believe. For most people, most of the time, four steps do almost all of the work: clean skin, one treatment, moisture, and sun protection. Everything else is a refinement, not a requirement.'),
          h2('The four that matter'),
          para('Cleanse to take the day off without stripping. Treat with one active you actually need — a barrier serum for reactive skin, a gentle acid for texture, rarely both at once. Moisturize to hold water in. And in the morning, protect with an SPF, which does more for how skin ages than any serum ever will.'),
          h2('Why less works better'),
          para('Every product you add is another thing that can irritate, pill or interact badly with the last. A shorter routine is easier to keep up, cheaper to run, and — because your skin is not being asked to cope with ten new ingredients at once — usually calmer. Consistency beats complexity every time.'),
          para('Start with the four. Live with them for a month. Add something only when your skin tells you it is missing — not because a fifth step was on sale.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'what-a-barrier-serum-actually-does',
    status: 'published',
    body: {
      title: 'What a barrier serum actually does',
      excerpt: 'If your skin is red, tight and reactive, the problem is usually the barrier — not a missing miracle ingredient. Here is what to do about it.',
      featuredImage: { $asset: 'post-barrier-serum' },
      body: {
        type: 'doc',
        content: [
          para('Your skin barrier is the outermost layer — the mix of cells and lipids that keeps water in and irritants out. When it is working, skin feels comfortable and looks even. When it is damaged, by over-cleansing or too many actives, skin turns tight, red, flaky and stingy no matter what you put on it.'),
          h2('Rebuild, do not strip'),
          para('A barrier serum is not a quick fix; it is a repair job. Niacinamide calms and helps the skin make its own lipids, ceramides replace the ones that have been lost, and panthenol soothes while the rest gets to work. Used daily, the effect builds over a few weeks — skin stops reacting to things that used to set it off.'),
          h2('The signs it is working'),
          para('You will notice it in what stops happening: less stinging when you apply the next step, less redness by evening, fewer random flare-ups. That is the barrier doing its job again. The goal is skin that is boring, in the best possible way — comfortable, even, and unbothered.'),
          para('If you only add one treatment to a bare routine, and your skin runs reactive, make it this one.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'spf-honestly',
    status: 'published',
    body: {
      title: 'SPF, honestly',
      excerpt: 'The least glamorous step is the one that matters most. A straight answer on how much to use, how often, and why the finish is the whole game.',
      featuredImage: { $asset: 'post-spf-honestly' },
      body: {
        type: 'doc',
        content: [
          para('If we could get you to keep just one habit, it would be this: wear sunscreen every morning, all year, indoors near windows included. Daily sun protection does more to keep skin even, firm and unlined than any serum on the shelf — including ours. It is not close.'),
          h2('The amount is more than you think'),
          para('Most people use a third of what they should. For a face, that is roughly two finger-lengths of product — enough that you can see it go on before it settles. Under-apply and an SPF 30 behaves like an SPF 8. Reapply across a long day outdoors, and do not count the SPF in your make-up as your whole defence.'),
          h2('Finish is why people wear it'),
          para('The best sunscreen is the one you will actually put on, and that comes down to finish. A modern mineral SPF should sit matte, leave no white cast on any skin tone, and disappear under make-up. Get the feel right and the habit sticks. Get it wrong and the most important step becomes the one you skip.'),
          para('No white cast, no greasy sheen, no excuses. That is the whole brief for a sunscreen worth keeping by the sink.'),
        ],
      },
    },
  },
];

// ── Product detail (the calm minimal PDP) + Shop ─────────────────────────────────
// SKIMS's PDP is a 50/50 split — one large product image on a uniform sweep at left,
// a quiet buy-box at right: small uppercase collection label · uppercase product name ·
// price · CTA · Details / Fit & Fabric / Shipping tabs (DESIGN §4/§6). Ported to Nue and
// the `bare` theme: the same two-column spread, but generous and unhurried — a big square
// studio image, then a restrained buy column carrying the Oswald all-caps title, an
// ink price, the real add-to-cart form, and three plainly-stacked detail blocks
// (Ingredients / How to use / Shipping & returns) in place of SKIMS's tabbed panel, so it
// reads without JavaScript. Zero accent, exactly as the archetype demands — the product
// photograph is the only chroma. Bound fields come from the shared PDP kit (correct
// `repeat('product')` scope + `item.*` binds); the layout + static brand copy are ours.

/** One labelled detail block in the buy column — an `<h2>` uppercase label over a paragraph
 *  of static brand copy. The stacked "Ingredients / How to use / Shipping & returns" panel,
 *  stacked rather than tabbed so it reads without JavaScript and needs no behaviour marker.
 *  A hairline top rule is the only chrome — the calm structure the minimal aesthetic wants. */
function pdpDetail(label: string, body: string): Node {
  return el('div', 'flex flex-col gap-2 border-t border-base-300 pt-5', {
    children: [
      el('h2', 'text-sm font-semibold uppercase tracking-widest text-base-content', {
        text: label,
      }),
      el('p', 'text-base leading-relaxed text-base-content', { text: body }),
    ],
  });
}

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the big square studio image on the warm-neutral sweep. Right: the quiet buy column,
 *  generous negative space, ink on bone, no accent anywhere. */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          // The large studio image — one bound primary, uniform light-grey sweep, no border
          // or radius (the gutterless, flat minimal discipline the archetype calls for).
          pdpImage('aspect-square w-full bg-base-200 object-cover'),
          // The unhurried buy column.
          el('div', 'flex flex-col gap-8 @3xl:py-4', {
            children: [
              el('div', 'flex flex-col gap-4', {
                children: [
                  // Collection label above the title — the SKIMS breadcrumb/label slot. A
                  // plain <p>, so the product title stays the page's one <h1>.
                  el('p', 'text-sm font-medium uppercase tracking-widest text-base-content', {
                    text: 'Nue Skincare',
                  }),
                  pdpTitle(
                    'h1',
                    'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-5xl'
                  ),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-semibold text-base-content',
                    compareClass: 'text-lg text-base-content line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              // Qty + Add to cart — the near-black mono CTA (btn-primary in `bare`).
              addToCartForm(),
              // The stacked detail panel — brand-level copy true of every Nue formula.
              el('div', 'mt-1 flex flex-col gap-5', {
                children: [
                  pdpDetail(
                    'Ingredients',
                    'Every Nue formula is fragrance-free, non-comedogenic and built from a short list of ingredients that earn their place — humectants, ceramides and gentle actives at levels skin can actually use. No essential oils, no drying alcohols, no colour, and nothing added to make a jar look busy on a shelf.'
                  ),
                  pdpDetail(
                    'How to use',
                    'Work into clean skin in the order of the ritual — cleanse, treat, moisturize, then protect in the morning — a little at a time, morning and night as the step calls for. Introduce one new product at a time and give it a fortnight: skin changes slowly, and the results that last are the ones that arrive quietly.'
                  ),
                  pdpDetail(
                    'Shipping & returns',
                    'Complimentary carbon-neutral shipping on orders over $50, dispatched within two business days and tracked to your door. If something is not right for your skin, return it within 30 days — opened or not — for a full refund. Skincare is personal, and finding your routine should feel that way.'
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

/** The full minimal PDP — the buy region above a quiet "You may also like" carousel of
 *  same-range products (`commerce.related`, the shared kit's default cross-sell). */
const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'You may also like' });

/** The Shop page's own header, shown ABOVE the faceted catalogue core the harness appends.
 *  Heavy all-caps display title + one quiet intro line — the calm, gallery-like framing the
 *  archetype gives its listing, in place of the generic "Shop / Everything we have". */
const SHOP: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl',
            { text: 'Shop the range' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'The whole of Nue in one place — cleanse, treat, moisturize, protect, and the few considered extras around them. Filter by step or sort however you like; every product here is made for every skin, and nothing it does not need.',
          }),
        ],
      }),
    ],
  }),
];

// ── The remaining functional pages (bespoke framing over the shared cores) ───────
// Collections / Cart / Search each get Nue's own quiet masthead above the pinned,
// shoppable core the harness appends; the Journal index gets its own masthead over the
// shared linkable post grid. Same warm-bone-and-ink voice as the rest of the site — heavy
// Oswald all-caps title, one calm intro line, zero accent (imagery is the only chroma).

/** A plain page masthead — an `<h1>` + one intro line on the warm-neutral ground. Used for
 *  Collections / Search / Journal, which each want a calm header over their core. Heavy
 *  all-caps display + one quiet <p>, mirroring the SHOP header exactly. */
function pageMasthead(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl',
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
    'The range',
    'Cleanse, treat, moisturize, protect — and the few considered extras around them, grouped the way a routine is actually built. Start where your skin needs the most help; every product here is made for every skin, and nothing it does not need.'
  ),
];

const SEARCH: Node[] = [
  pageMasthead(
    'Search Nue',
    'Looking for a step, an ingredient, or something you read once? Search the whole range and the Journal below — a barrier serum, an SPF that leaves no cast, or just where to start.'
  ),
];

const JOURNAL: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl',
            { text: 'The Nue Journal' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Plain notes on skin — what a routine actually needs, what each step is for, and why less, done well, beats a shelf of things you will not keep up. No trends, no jargon, just what works.',
          }),
        ],
      }),
    ],
  }),
];

/** The Cart page's own header — a warm reassurance band above the pinned cart core, in place
 *  of the generic "Your cart" heading. Free carbon-neutral shipping, thirty-day returns, and
 *  samples with every order — the three things a skincare buyer wants to read before checkout. */
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl',
            { text: 'Your cart' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Complimentary carbon-neutral shipping on every order, a few samples tucked in to try something new, and 30 days to return anything — opened or not — for a full refund. Skincare is personal; take your time deciding.',
          }),
        ],
      }),
    ],
  }),
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'luxe-minimal',
  key: 'sparx-luxe-minimal',
  name: 'sparx — Luxe Minimal',
  summary:
    'A quiet-luxury storefront where imagery carries the weight and type stays out of the way — a full-bleed hero with a bottom-left headline, a 4-up category-tile row, best-sellers and treatment carousels, full-bleed editorial bands and a centered mission statement, all warm-neutral monochrome with no accent. Modelled on the minimal-luxury archetype; shipped as Nue Skincare, a premium-skincare essentials brand.',
  tagline: 'A minimal, image-led luxury template for premium skincare, beauty and wellness brands.',
  vertical: 'retail',
  industry: 'Premium skincare',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 95,
  brand: {
    businessName: 'Nue Skincare',
    tagline: 'Solutions for every skin.',
  },
  // SKIMS chrome: a single quiet wordmark at the LEFT with a restrained horizontal nav
  // beside it (`brandLeft` — we drop SKIMS's co-brand lockup for one Nue wordmark, per
  // DESIGN §6), NO loud filled CTA in the bar (`showCta: false` — the zero-accent
  // restraint is the signal), and the full "Stay in the know" newsletter footer
  // (`newsletter`) whose bottom bar carries the live © business name.
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: false },
  seo: {
    home: {
      title: 'Nue Skincare — a short range of skincare essentials',
      description:
        'Nue Skincare is a short, considered range of skincare essentials — a cleanser, a serum, a cream, an SPF — made for every skin, and nothing it does not need.',
    },
    about: {
      title: 'About Nue Skincare',
      description:
        'Why Nue Skincare keeps its range short — the thinking, the formulas and the skin-first approach behind every essential.',
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
