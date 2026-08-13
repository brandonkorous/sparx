// sparx-beauty-counter — the reference-driven site template modelled on the BEAUTY
// COUNTER archetype (docs/templates/sephora; the study fell back to Huda Beauty after
// Sephora hard-blocked capture).
//
// The beauty counter translated to sparx: an own-brand colour-cosmetics house where the
// merchandising problem is not "which product" but "which SHADE" — Maeve, "Full pigment.
// No apology." The home page is the "find your perfect match" funnel — a full-bleed
// lifestyle hero, the best-sellers, a shade-matching editorial band, then a face → lip →
// eye routine of shade-forward product carousels, a gift-with-purchase reward band and a
// community strip — dressed in the bespoke `gloss` theme (blush-tinted grounds, a bold
// hot-magenta primary carrying white ink, wine-plum editorial grounds, warm-nude accent).
//
// Shade ranges are presented STATICALLY: every colour product declares a `Shade` SWATCH
// option (shade NAMES as values, never a hex), which the buy box renders as a swatch
// selector, and the home carousels are the shade-grid rails. A live shade filter / AR
// try-on is a later behaviors phase and is deliberately NOT built here.
//
// This file is JUST the SPEC; the composition + emission live in the shared
// `template-sites/harness.ts`. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-beauty-counter.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-beauty-counter/**" \
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
import { productCarousel, productsBlock } from '../../packages/silica-catalog/src/commerce';
import { newsletterSignup } from '../../packages/silica-catalog/src/sections/convert';
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import { contactSection } from './shared/contact-section';
import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import { tabbedShowcase } from './template-sites/behaviors';
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
// hero / editorial-band / community photos are TREE imagery, so they hot-link the same
// URL inline (docs/54 §6) — they still appear in `assets` as the single documented
// registry of the bundle's imagery + alt text.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
  // Products
  foundation: '1522338242992-e1a54906a8da',
  concealer: '1595051665600-afd01ea7c446',
  powder: '1599733589046-10c005739ef9',
  primer: '1608979048467-6194dabc6a3d',
  settingSpray: '1631730486572-226d1f595b68',
  blush: '1596462502278-27bfdc403348',
  contour: '1626895872564-b691b6877b83',
  liquidLip: '1586495777744-4413f21062fa',
  lipOil: '1625093742435-6fa192b6fb10',
  lipLiner: '1631214499500-2e34edcaccfe',
  palette: '1512496015851-a90fb38ba796',
  mascara: '1616529484837-8bcdf9d1407b',
  brow: '1522335789203-aabd1fc54bc9',
  eyeliner: '1596704017254-9b121068fb31',
  brush: '1622336889416-8d790ad807d7',
  // Journal posts
  postShadeMatch: '1581182800629-7d90925ad072',
  postEverydayFace: '1544717304-a2db4a7b16ee',
  postBerryLip: '1596205521983-9c372fb3d4f1',
  // Hero + editorial bands (tree imagery)
  hero: '1632765866070-3fadf25d3d5b',
  bandMatch: '1616358278773-e5e4154a336f',
  bandLip: '1637851496668-9310c745c3dc',
  bandEye: '1613730317814-1cede28e0151',
  bandGift: '1583784561105-a674080f391e',
  // Community strip
  community1: '1660730488804-928cb966c4b9',
  community2: '1613972555283-10f34cf78f32',
  community3: '1503236823255-94609f598e71',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'second-skin-foundation', url: U(IMG.foundation), alt: 'A bottle of liquid foundation on a soft pink ground' },
  { id: 'brightening-concealer', url: U(IMG.concealer), alt: 'A slim tube of under-eye concealer' },
  { id: 'cloud-set-powder', url: U(IMG.powder), alt: 'A pot of loose setting powder with its puff' },
  { id: 'soft-focus-primer', url: U(IMG.primer), alt: 'A tube of blurring face primer' },
  { id: 'lock-it-setting-spray', url: U(IMG.settingSpray), alt: 'A bottle of makeup setting spray' },
  { id: 'sunlit-cream-blush', url: U(IMG.blush), alt: 'A cream blush stick swatched on skin' },
  { id: 'sculpt-contour-stick', url: U(IMG.contour), alt: 'A cream contour stick' },
  { id: 'velvet-matte-liquid-lip', url: U(IMG.liquidLip), alt: 'A tube of matte liquid lipstick' },
  { id: 'glass-shine-lip-oil', url: U(IMG.lipOil), alt: 'A glossy lip oil with a doe-foot wand' },
  { id: 'precision-lip-liner', url: U(IMG.lipLiner), alt: 'A retractable lip liner pencil' },
  { id: 'bloom-eyeshadow-palette', url: U(IMG.palette), alt: 'An open nine-pan eyeshadow palette' },
  { id: 'featherweight-mascara', url: U(IMG.mascara), alt: 'A tube of lengthening mascara' },
  { id: 'brow-sculpt-pomade', url: U(IMG.brow), alt: 'A pot of brow pomade with a spoolie' },
  { id: 'skinny-gel-eyeliner', url: U(IMG.eyeliner), alt: 'A fine-tip gel eyeliner pencil' },
  { id: 'buffing-foundation-brush', url: U(IMG.brush), alt: 'A dense buffing foundation brush' },
  { id: 'post-shade-match', url: U(IMG.postShadeMatch), alt: 'Foundation swatched across a range of skin tones' },
  { id: 'post-everyday-face', url: U(IMG.postEverydayFace), alt: 'A fresh, natural everyday makeup look' },
  { id: 'post-berry-lip', url: U(IMG.postBerryLip), alt: 'A close-up of a soft berry lip' },
  { id: 'hero-home', url: U(IMG.hero), alt: 'A model wearing a glowing full face of Maeve makeup' },
  { id: 'band-match', url: U(IMG.bandMatch), alt: 'Foundation being matched along the jaw' },
  { id: 'band-lip', url: U(IMG.bandLip), alt: 'A range of lip shades swatched on skin' },
  { id: 'band-eye', url: U(IMG.bandEye), alt: 'A soft, blended eye look up close' },
  { id: 'band-gift', url: U(IMG.bandGift), alt: 'A cream blush open beside its cap' },
  { id: 'community-1', url: U(IMG.community1), alt: 'A Maeve wearer photographed in natural light' },
  { id: 'community-2', url: U(IMG.community2), alt: 'A close, glossy skin-and-lip portrait' },
  { id: 'community-3', url: U(IMG.community3), alt: 'A creator sharing her everyday face' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-beauty-counter: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections (the "find your perfect match" funnel) ──────────────────────

/** The full-bleed lifestyle hero — one on-model photograph filling the width, the
 *  headline and two actions in a solid readable panel over it (the `offer_hero` shape
 *  with the bottom-left overlay the reference pins). Tenant content, so it hot-links a
 *  real photograph; every class is a NAMED utility so it survives the stamp into the
 *  tenant's stored tree. The primary CTA is `btn-primary` — the theme's hot magenta,
 *  white-inked by construction. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('hero-home'), alt: 'A glowing full face of Maeve makeup', loading: 'lazy' },
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
                  { text: 'Find your shade' }
                ),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Full-pigment colour cosmetics made for every skin tone — foundation in a shade that actually disappears, a lip for every mood, and a face that lasts from first coffee to last call.',
                }),
                el('div', 'flex flex-wrap items-center gap-3', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the range' }),
                    el('a', 'btn btn-secondary btn-outline btn-lg', {
                      attrs: { href: '/journal' },
                      text: 'Match your shade',
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

/** A mid-page editorial band — a full-bleed photograph carrying a story and a button in a
 *  solid panel. `tone` picks the panel ground: `light` (blush near-white / magenta action)
 *  or `wine` (the deep wine-plum secondary ground the reference's "perfect match" band
 *  wears / white action). Children inherit the panel's `-content` ink, so the copy stays
 *  readable on either ground without a hardcoded text color. */
type BandTone = 'light' | 'wine';
const BAND_PANEL: Record<BandTone, string> = {
  light: 'flex max-w-xl flex-col gap-4 rounded-box bg-base-100 p-8 @3xl:p-10',
  wine: 'flex max-w-xl flex-col gap-4 rounded-box bg-secondary p-8 text-secondary-content @3xl:p-10',
};
const BAND_BTN: Record<BandTone, string> = {
  light: 'btn btn-primary btn-lg',
  wine: 'btn btn-neutral btn-lg',
};

function editorialBand(o: {
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

/** The gift-with-purchase reward band — the beauty-counter's signature promo beat, flood-
 *  filled in the theme's hot magenta (a tenant-site freedom). `bg-primary text-primary-
 *  content` carries white ink by construction; the threshold headline and fine print sit
 *  in a solid band, the "choose your shade at checkout" note reads as the roundel copy the
 *  reference splashes over the still. */
function giftBand(): Node {
  return el('section', 'bg-primary text-primary-content @container px-6 py-16', {
    children: [
      el(
        'div',
        'mx-auto flex w-full max-w-5xl flex-col items-start gap-6 @3xl:flex-row @3xl:items-center @3xl:justify-between',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-3', {
              children: [
                el('h2', 'text-3xl font-bold uppercase leading-tight tracking-tight @3xl:text-4xl', {
                  text: 'A free blush, on us',
                }),
                el('p', 'text-lg leading-relaxed', {
                  text: 'Spend $75 and add our Sunlit Cream Blush to your bag for free — choose your shade at checkout. New wearers, this is the easiest way to meet the line.',
                }),
                el('p', 'text-sm', { text: 'While stocks last. One gift per order.' }),
              ],
            }),
            el('a', 'btn btn-neutral btn-lg', { attrs: { href: '/shop' }, text: 'Shop to unlock' }),
          ],
        }
      ),
    ],
  });
}

/** The community strip — "The Maeve Edit": three creator/wearer portraits over a title +
 *  one-line pitch, each linking into the journal. The catalog `post_grid`'s read-mores are
 *  dead `#` (no per-item CMS href templating — marketplace-catalog/CLAUDE.md), so these are
 *  STATIC cards pointed at `/journal/<slug>`, which resolve. */
function communityStrip(): Node {
  const card = (assetId: string, title: string, blurb: string, slug: string): Node =>
    el('a', 'flex flex-col overflow-hidden rounded-box border border-base-300 bg-base-100 hover:border-primary', {
      attrs: { href: `/journal/${slug}` },
      children: [
        el('img', 'aspect-square w-full object-cover', {
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
                text: 'The Maeve Edit',
              }),
              el('p', 'max-w-2xl text-lg text-base-content', {
                text: 'How real wearers are putting the line to work — three faces, three routines, all yours to borrow.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-6 @2xl:grid-cols-2 @4xl:grid-cols-3', {
            children: [
              card('community-1', 'The five-minute face', 'Foundation, blush and a lip — the whole look, before the kettle boils.', 'the-5-minute-everyday-face'),
              card('community-2', 'Build a berry lip', 'Liner, lipstick, a press of gloss — a berry lip in three steps that stays put.', 'build-a-berry-lip-in-three-steps'),
              card('community-3', 'Warm or cool?', 'Reading your undertone, and why it changes which shade actually disappears.', 'warm-vs-cool-reading-your-undertone'),
            ],
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  hero(),
  // Huda/Sephora lead with a TABBED product carousel — one pill row reslicing the strip in
  // place. Bounded to the two sources the storefront actually resolves (featured + newest);
  // the pills are the heading, so the panels are headless `productCarousel`s.
  el('section', 'bg-base-100 @container px-6 py-12', {
    children: [
      tabbedShowcase(
        [
          { label: 'Best sellers', panel: productCarousel('commerce.featured') },
          { label: 'New in', panel: productCarousel('commerce.new') },
        ],
        {
          // A real section heading (not the pills, which are buttons) keeps the outline
          // h1 → h2 → product-card h3 that the SEO sweep checks.
          heading: el('h2', 'text-2xl font-semibold text-base-content', {
            text: 'Loved right now',
          }),
        }
      ),
    ],
  }),
  editorialBand({
    heading: 'The perfect match',
    lead: 'Twenty-four foundation shades, built across warm, cool and neutral undertones, so the one that suits you is a real shade and not the closest guess. Swatch along the jaw, not the hand.',
    assetId: 'band-match',
    cta: 'Find your foundation',
    href: '/shop',
    tone: 'wine',
  }),
  productsBlock({ source: 'commerce.category.face', layout: 'carousel', heading: 'Face' }),
  editorialBand({
    heading: 'A lip for every day',
    lead: 'A velvet matte that lasts through lunch, a glass oil that just glosses, a liner that keeps it all in place — sixteen shades, from your-lips-but-better to a full berry.',
    assetId: 'band-lip',
    cta: 'Shop lip',
    href: '/shop',
    tone: 'light',
  }),
  productsBlock({ source: 'commerce.category.lip', layout: 'carousel', heading: 'Lip' }),
  editorialBand({
    heading: 'Eyes, sculpted',
    lead: 'Nine-pan palettes in warm, cool and rose, a mascara that lengthens without the clump, and a brow pomade that holds — everything you need for a soft eye or a sharp one.',
    assetId: 'band-eye',
    cta: 'Shop eye',
    href: '/shop',
    tone: 'wine',
  }),
  productsBlock({ source: 'commerce.category.eye', layout: 'carousel', heading: 'Eye' }),
  giftBand(),
  communityStrip(),
  // The footer variant is `columns` (a category-rich footer, no built-in capture), so the
  // page carries the sign-up itself — the reference's "hey beautiful, let's connect" beat.
  newsletterSignup(),
];

// ── About + Contact (Maeve-voiced) ───────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-bold uppercase tracking-tight text-base-content @2xl:text-5xl', {
            text: 'About Maeve',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Maeve is a full-pigment colour-cosmetics house, built on one stubborn idea: everyone deserves a shade that actually suits them. We launched our foundation in twenty-four shades on day one — not as a follow-up, not as a promise, but because a base that stops at ten tones was never a base at all.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'From there it is face, lip, eye and the tools to apply them — pigments rich enough to mean it, formulas kind enough to wear all day, and shade names you can actually find yourself in. Cruelty-free, vegan wherever the formula allows, and made to be worn, not saved for good. Full pigment. No apology.',
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
    heading: 'Talk to us',
    intro: 'Stuck between two shades, chasing an order, or after a recommendation for your undertone? Our team answers fast, usually the same day — tell us what you need and we will help you find it.',
    submitLabel: 'Email the team',
  }),
];

// ── Commerce (Maeve — 15 SKUs across face / cheek / lip / eye / tools) ────────────

interface Variant {
  sku: string;
  priceCents: number;
  compareAtPriceCents?: number;
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
  // The typed product type (docs/143) — every product here is `cosmetics`, so the PDP's
  // `pdpAttributes` renders each product's OWN key ingredients / how-to-use / skin type /
  // size / full INCI list rather than one hardcoded counter stack.
  productTypeKey: 'cosmetics';
  attributes: {
    keyIngredients: string;
    howToUse: string;
    skinType: string[];
    volume: string;
    fullIngredients: string;
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

/** A `Shade` SWATCH option + one variant per shade — the beauty-counter's core variant
 *  model. Values are shade NAMES (never a hex): the buy box renders them as a swatch
 *  selector, and the home carousels become the shade-grid rails. Default = the first
 *  shade. `compareAt`, when given, prices in a "Save $X" strikethrough. */
function shaded(
  skuBase: string,
  price: number,
  shades: string[],
  compareAt?: number
): { options: OptionDecl[]; variants: Variant[] } {
  const options: OptionDecl[] = [
    { name: 'Shade', displayType: 'swatch', values: shades.map((value) => ({ value })) },
  ];
  const variants: Variant[] = shades.map((shade, i) => ({
    sku: `${skuBase}-${String(i + 1).padStart(2, '0')}`,
    priceCents: money(price),
    ...(compareAt ? { compareAtPriceCents: money(compareAt) } : {}),
    ...(i === 0 ? { isDefault: true } : {}),
    inventoryPolicy: 'continue',
    optionValues: { Shade: shade },
  }));
  return { options, variants };
}

// Inclusive shade ramps, named — the swatch values the option renders.
const FOUNDATION_SHADES = [
  'Porcelain 01', 'Ivory 02', 'Shell 03', 'Buff 04', 'Nude 05', 'Sand 06',
  'Beige 07', 'Natural 08', 'Golden 09', 'Honey 10', 'Caramel 11', 'Amber 12',
  'Toffee 13', 'Pecan 14', 'Chestnut 15', 'Walnut 16', 'Cocoa 17', 'Mocha 18',
  'Espresso 19', 'Truffle 20', 'Ebony 21', 'Deep 22', 'Rich 23', 'Onyx 24',
];
const CONCEALER_SHADES = ['Fair', 'Light', 'Light-Medium', 'Medium', 'Tan', 'Deep', 'Rich', 'Espresso'];
const POWDER_SHADES = ['Translucent', 'Fair', 'Medium', 'Deep'];
const BLUSH_SHADES = ['Peach', 'Apricot', 'Rose', 'Coral', 'Berry', 'Plum', 'Mauve', 'Terracotta'];
const CONTOUR_SHADES = ['Light', 'Medium', 'Tan', 'Deep', 'Rich', 'Espresso'];
const LIQUID_LIP_SHADES = [
  'Bare', 'Blush', 'Rosewood', 'Nude Pink', 'Brick', 'Terracotta', 'Coral', 'Poppy',
  'Cherry', 'Ruby', 'Wine', 'Berry', 'Plum', 'Mauve', 'Fig', 'Chocolate',
];
const LIP_OIL_SHADES = ['Clear', 'Pink Sheen', 'Peach', 'Rose', 'Berry Tint', 'Cherry Tint', 'Mauve', 'Bronze'];
const LIP_LINER_SHADES = ['Bare', 'Blush', 'Rosewood', 'Brick', 'Terracotta', 'Ruby', 'Wine', 'Berry', 'Plum', 'Chocolate'];
const EYELINER_SHADES = ['Black', 'Espresso', 'Bronze', 'Plum', 'Forest', 'Navy'];
const BROW_SHADES = ['Taupe', 'Soft Blonde', 'Auburn', 'Medium Brown', 'Dark Brown', 'Ebony'];

const PRODUCTS: Product[] = [
  {
    handle: 'second-skin-luminous-foundation',
    title: 'Second Skin Luminous Foundation',
    description:
      'A medium-buildable liquid foundation that reads like skin, not makeup — a soft luminous finish, breathable wear, and twenty-four shades built across every undertone so yours actually disappears. Swatch along the jaw and it vanishes.',
    status: 'active',
    productType: 'Foundation',
    vendor: 'Maeve',
    tags: ['face', 'foundation', 'luminous', 'vegan', 'bestseller'],
    categoryHandles: ['face'],
    collectionHandles: ['best-sellers', 'new-in', 'the-edit'],
    seoTitle: 'Second Skin Luminous Foundation — 24-shade liquid foundation',
    seoDescription: 'A luminous, medium-buildable liquid foundation in 24 inclusive shades across every undertone.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'Sodium hyaluronate and squalane hold water in the skin for a soft, luminous finish, while light-diffusing spherical pigments blur without masking. Glycerin keeps it comfortable through a long wear.',
      howToUse:
        'Shake, then apply one to two pumps with a damp sponge or the Buffing Foundation Brush, working from the centre of the face outward. Build only where you want more coverage, and set the T-zone with Cloud Set powder if you tend to shine.',
      skinType: ['all'],
      volume: '30 ml / 1.0 fl oz',
      fullIngredients:
        'Aqua, Cyclopentasiloxane, Glycerin, Dimethicone, PEG-10 Dimethicone, Squalane, Sodium Hyaluronate, Tocopheryl Acetate, Phenoxyethanol, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491, CI 77492, CI 77499).',
    },
    ...shaded('MV-FND', 42, FOUNDATION_SHADES),
    images: [{ assetId: 'second-skin-foundation', isPrimary: true, alt: 'Second Skin Luminous Foundation' }],
  },
  {
    handle: 'under-eye-brightening-concealer',
    title: 'Under-Eye Brightening Concealer',
    description:
      'A creamy, crease-resistant concealer that lifts the under-eye and covers where you need it, without cakeing into fine lines. Eight shades to match — or go one lighter to brighten.',
    status: 'active',
    productType: 'Concealer',
    vendor: 'Maeve',
    tags: ['face', 'concealer', 'vegan'],
    categoryHandles: ['face'],
    collectionHandles: ['best-sellers', 'the-edit'],
    seoTitle: 'Under-Eye Brightening Concealer — crease-resistant concealer',
    seoDescription: 'A creamy, crease-resistant brightening concealer in eight matchable shades.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'Light-reflecting pigments lift shadow under the eye, caffeine helps de-puff, and a peptide plus vitamin E keep the creamy base from settling into fine lines through the day.',
      howToUse:
        'Dot a little onto the under-eye and any spots you want to cover, then tap out with a fingertip or a small brush — never drag. Match your shade, or go one lighter under the eye to brighten. Press with Cloud Set powder to lock it.',
      skinType: ['all'],
      volume: '6 ml / 0.2 fl oz',
      fullIngredients:
        'Aqua, Dimethicone, Glycerin, Isododecane, Caffeine, Palmitoyl Tripeptide-1, Tocopheryl Acetate, Mica, Phenoxyethanol, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491, CI 77492, CI 77499).',
    },
    ...shaded('MV-CNC', 26, CONCEALER_SHADES),
    images: [{ assetId: 'brightening-concealer', isPrimary: true, alt: 'Under-Eye Brightening Concealer' }],
  },
  {
    handle: 'cloud-set-loose-powder',
    title: 'Cloud Set Loose Powder',
    description:
      'A finely milled loose powder that sets your base soft-matte and blurs without flattening the glow. Press it under the eyes to lock concealer, dust it over the T-zone, and skip the midday shine.',
    status: 'active',
    productType: 'Setting powder',
    vendor: 'Maeve',
    tags: ['face', 'powder', 'setting', 'vegan'],
    categoryHandles: ['face'],
    collectionHandles: ['new-in'],
    seoTitle: 'Cloud Set Loose Powder — soft-matte setting powder',
    seoDescription: 'A finely milled loose setting powder that blurs and sets without flattening the glow.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'Micro-fine silica and rice starch soak up excess oil and soft-blur pores, while boron nitride scatters light so skin sets matte without going flat or chalky.',
      howToUse:
        'Load a fluffy brush or the puff, tap off the excess, and press — do not sweep — into the under-eye and T-zone to lock concealer and foundation. A little is plenty; build only where you shine.',
      skinType: ['combination', 'oily'],
      volume: '8 g / 0.28 oz',
      fullIngredients:
        'Silica, Oryza Sativa (Rice) Starch, Mica, Zinc Stearate, Boron Nitride, Dimethicone, Tocopheryl Acetate, Titanium Dioxide (CI 77891), Iron Oxides (CI 77492, CI 77499).',
    },
    ...shaded('MV-PWD', 30, POWDER_SHADES),
    images: [{ assetId: 'cloud-set-powder', isPrimary: true, alt: 'Cloud Set Loose Powder' }],
  },
  {
    handle: 'soft-focus-blurring-primer',
    title: 'Soft Focus Blurring Primer',
    description:
      'A silky, weightless primer that grips makeup and softens the look of pores and texture, so your foundation goes on smoother and stays put longer. One universal formula — goes under everything.',
    status: 'active',
    productType: 'Primer',
    vendor: 'Maeve',
    tags: ['face', 'primer', 'vegan'],
    categoryHandles: ['face'],
    collectionHandles: ['new-in'],
    seoTitle: 'Soft Focus Blurring Primer — pore-blurring makeup primer',
    seoDescription: 'A weightless blurring primer that grips makeup and softens the look of pores and texture.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'A silky silica-and-blurring-polymer base fills the look of pores and fine texture so makeup sits smoother, while niacinamide works over time to refine the skin underneath.',
      howToUse:
        'After moisturiser, smooth a pea-sized amount over clean skin — concentrating on the centre of the face where pores show most — and let it set for a moment before foundation. Wear it alone on a no-makeup day, too.',
      skinType: ['all'],
      volume: '30 ml / 1.0 fl oz',
      fullIngredients:
        'Aqua, Dimethicone, Silica, Cyclopentasiloxane, Niacinamide, Glycerin, Dimethicone/Vinyl Dimethicone Crosspolymer, Tocopheryl Acetate, Phenoxyethanol.',
    },
    variants: [{ sku: 'MV-PRM-01', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'soft-focus-primer', isPrimary: true, alt: 'Soft Focus Blurring Primer' }],
  },
  {
    handle: 'lock-it-setting-spray',
    title: 'Lock-It Setting Spray',
    description:
      'A fine-mist setting spray that melts powder into skin and holds a full face through heat, long days and longer nights. A few spritzes and everything stays exactly where you put it.',
    status: 'active',
    productType: 'Setting spray',
    vendor: 'Maeve',
    tags: ['face', 'setting-spray', 'vegan'],
    categoryHandles: ['face'],
    collectionHandles: ['best-sellers'],
    seoTitle: 'Lock-It Setting Spray — long-wear makeup setting spray',
    seoDescription: 'A fine-mist setting spray that melts powder into skin and holds a full face all day.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'Flexible film-forming polymers lock makeup in place through heat and long days, while aloe and glycerin melt any powdery edge back into skin for a fresh, second-skin finish.',
      howToUse:
        'Hold six inches from the face, close your eyes, and mist twice in an X and a T once the full look is on. Let it dry down without touching. A quick spritz mid-day revives a tired base, too.',
      skinType: ['all'],
      volume: '100 ml / 3.4 fl oz',
      fullIngredients:
        'Aqua, Alcohol Denat., Glycerin, VP/VA Copolymer, Aloe Barbadensis Leaf Juice, Panthenol, Sodium Hyaluronate, Phenoxyethanol.',
    },
    variants: [{ sku: 'MV-SPR-01', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'lock-it-setting-spray', isPrimary: true, alt: 'Lock-It Setting Spray' }],
  },
  {
    handle: 'sunlit-cream-blush',
    title: 'Sunlit Cream Blush',
    description:
      'A blendable cream blush that melts into skin for a lit-from-within flush — tap it high on the cheek with a fingertip and it looks like your own colour, only better. Eight shades from soft peach to deep berry.',
    status: 'active',
    productType: 'Blush',
    vendor: 'Maeve',
    tags: ['cheek', 'blush', 'cream', 'vegan', 'bestseller'],
    categoryHandles: ['cheek'],
    collectionHandles: ['best-sellers', 'new-in', 'the-edit', 'vegan-favourites'],
    seoTitle: 'Sunlit Cream Blush — dewy cream blush in 8 shades',
    seoDescription: 'A blendable cream blush for a lit-from-within flush, in eight shades from peach to berry.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'A jojoba-ester and vitamin-E balm carries buildable pigment that melts into skin for a dewy, lit-from-within flush — no powdery cake, no hard line where it lands.',
      howToUse:
        'Tap one or two dots high on the cheeks with a fingertip and blend up toward the temple while the balm is still slippery. Layer for more colour; a touch on the lips ties the look together.',
      skinType: ['dry', 'normal'],
      volume: '5 g / 0.17 oz',
      fullIngredients:
        'Caprylic/Capric Triglyceride, Hydrogenated Polyisobutene, Ozokerite, Jojoba Esters, Tocopheryl Acetate, Mica, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491), Red 7 Lake (CI 15850).',
    },
    ...shaded('MV-BLS', 24, BLUSH_SHADES),
    images: [{ assetId: 'sunlit-cream-blush', isPrimary: true, alt: 'Sunlit Cream Blush' }],
  },
  {
    handle: 'sculpt-contour-stick',
    title: 'Sculpt Contour Stick',
    description:
      'A creamy contour stick with a soft, shadowy finish that defines without a muddy line — draw where the light would not reach, then blend with a finger or a brush. Six shades to suit fair to deep.',
    status: 'active',
    productType: 'Contour',
    vendor: 'Maeve',
    tags: ['cheek', 'contour', 'cream', 'vegan'],
    categoryHandles: ['cheek'],
    collectionHandles: ['the-edit'],
    seoTitle: 'Sculpt Contour Stick — cream contour stick in 6 shades',
    seoDescription: 'A creamy contour stick with a soft, shadowy finish that defines without a muddy line.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'Cool-toned pigments read like a real shadow rather than a stripe of bronzer, in a shea-and-jojoba stick that stays creamy enough to blend seamlessly before it sets.',
      howToUse:
        'Draw a light line where the light would not naturally reach — under the cheekbone, along the hairline, either side of the nose — then blend up and back with a finger or a brush until the edge disappears.',
      skinType: ['dry', 'normal'],
      volume: '6 g / 0.21 oz',
      fullIngredients:
        'Caprylic/Capric Triglyceride, Ozokerite, Butyrospermum Parkii (Shea) Butter, Simmondsia Chinensis (Jojoba) Seed Oil, Tocopheryl Acetate, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491, CI 77492, CI 77499).',
    },
    ...shaded('MV-CTR', 26, CONTOUR_SHADES),
    images: [{ assetId: 'sculpt-contour-stick', isPrimary: true, alt: 'Sculpt Contour Stick' }],
  },
  {
    handle: 'velvet-matte-liquid-lip',
    title: 'Velvet Matte Liquid Lip',
    description:
      'A full-pigment liquid lipstick that sets to a comfortable velvet matte and stays through coffee, lunch and the walk home. One coat means it, and sixteen shades run from your-lips-but-better to a proper berry.',
    status: 'active',
    productType: 'Lipstick',
    vendor: 'Maeve',
    tags: ['lip', 'lipstick', 'matte', 'vegan', 'bestseller'],
    categoryHandles: ['lip'],
    collectionHandles: ['best-sellers', 'new-in', 'the-edit', 'vegan-favourites'],
    seoTitle: 'Velvet Matte Liquid Lip — long-wear liquid lipstick in 16 shades',
    seoDescription: 'A full-pigment liquid lipstick that sets to a comfortable velvet matte, in 16 shades.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'Full-coverage pigments in a lightweight silicone base set to a transfer-resistant velvet matte, with vitamin E to keep it comfortable so it never feels like it is drying your lips out.',
      howToUse:
        'Outline the cupid’s bow first, then fill from the centre out in one thin coat and press your lips together — it is full pigment, so a second coat only slides. Line first with Precision Lip Liner for the longest wear.',
      skinType: ['all'],
      volume: '4 ml / 0.14 fl oz',
      fullIngredients:
        'Dimethicone, Trimethylsiloxysilicate, Isododecane, Disteardimonium Hectorite, Tocopheryl Acetate, Silica, Iron Oxides (CI 77491), Red 7 Lake (CI 15850), Red 28 Lake (CI 45410).',
    },
    ...shaded('MV-LIP', 22, LIQUID_LIP_SHADES),
    images: [{ assetId: 'velvet-matte-liquid-lip', isPrimary: true, alt: 'Velvet Matte Liquid Lip' }],
  },
  {
    handle: 'glass-shine-lip-oil',
    title: 'Glass Shine Lip Oil',
    description:
      'A cushiony lip oil that leaves a glass-clear shine and a wash of colour while it conditions — no stickiness, no tightness, just a lip that looks like it means it. Wear it alone or over the matte.',
    status: 'active',
    productType: 'Lip oil',
    vendor: 'Maeve',
    tags: ['lip', 'lip-oil', 'gloss', 'vegan'],
    categoryHandles: ['lip'],
    collectionHandles: ['new-in', 'gift-sets'],
    seoTitle: 'Glass Shine Lip Oil — conditioning tinted lip oil',
    seoDescription: 'A cushiony lip oil with a glass-clear shine and a wash of colour, in eight tints.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'Jojoba oil and squalane cushion and condition while sodium hyaluronate draws in water, so lips look plumper and glass-shiny with a sheer wash of colour — never tacky or sticky.',
      howToUse:
        'Sweep the doe-foot wand across bare lips for everyday shine, or press a little over the centre of a matte lip to make it look fuller. Reapply whenever lips feel dry — it doubles as a treatment.',
      skinType: ['all'],
      volume: '5 ml / 0.17 fl oz',
      fullIngredients:
        'Hydrogenated Polyisobutene, Simmondsia Chinensis (Jojoba) Seed Oil, Squalane, Silica Dimethyl Silylate, Tocopheryl Acetate, Sodium Hyaluronate, Red 7 Lake (CI 15850).',
    },
    ...shaded('MV-OIL', 20, LIP_OIL_SHADES),
    images: [{ assetId: 'glass-shine-lip-oil', isPrimary: true, alt: 'Glass Shine Lip Oil' }],
  },
  {
    handle: 'precision-lip-liner',
    title: 'Precision Lip Liner',
    description:
      'A retractable lip liner with a fine, creamy tip that draws a clean edge and fills the whole lip to make colour last. Ten shades built to match the liquid lip, or to define on their own.',
    status: 'active',
    productType: 'Lip liner',
    vendor: 'Maeve',
    tags: ['lip', 'lip-liner', 'vegan'],
    categoryHandles: ['lip'],
    collectionHandles: ['the-edit'],
    seoTitle: 'Precision Lip Liner — retractable creamy lip liner in 10 shades',
    seoDescription: 'A retractable lip liner with a fine, creamy tip, in ten shades to match the liquid lip.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'A creamy wax-and-oil core glides without dragging and grips colour in place, with vitamin E so the fine tip stays smooth to the last of the twist-up.',
      howToUse:
        'Trace the natural lip line, then fill the whole lip in rather than just the border — a fully lined lip gives lipstick something to hold, so colour fades evenly instead of leaving a ring. Wear alone for a soft stain.',
      skinType: ['all'],
      volume: '0.3 g / 0.01 oz',
      fullIngredients:
        'Caprylic/Capric Triglyceride, Hydrogenated Vegetable Oil, Candelilla Wax, Tocopheryl Acetate, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491, CI 77499), Red 7 Lake (CI 15850).',
    },
    ...shaded('MV-LNR', 16, LIP_LINER_SHADES),
    images: [{ assetId: 'precision-lip-liner', isPrimary: true, alt: 'Precision Lip Liner' }],
  },
  {
    handle: 'bloom-eyeshadow-palette',
    title: 'Bloom 9-Pan Eyeshadow Palette',
    description:
      'A nine-pan palette that does a whole eye on its own — soft mattes, a satin wash and one true shimmer, blendable and low-fallout. Three edits: Warm, Cool and Rose, each a full look from day to night.',
    status: 'active',
    productType: 'Eyeshadow palette',
    vendor: 'Maeve',
    tags: ['eye', 'eyeshadow', 'palette', 'vegan', 'bestseller'],
    categoryHandles: ['eye'],
    collectionHandles: ['best-sellers', 'new-in', 'the-edit', 'gift-sets'],
    seoTitle: 'Bloom 9-Pan Eyeshadow Palette — Warm, Cool & Rose',
    seoDescription: 'A blendable nine-pan eyeshadow palette in three edits: Warm, Cool and Rose.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'Finely milled pressed pigments blend soft and stay put with low fallout; the single shimmer is bound in a silicone slip for a smooth, foil-able finish rather than a scatter of glitter.',
      howToUse:
        'Sweep the lightest matte over the whole lid, deepen the outer corner and crease with the mid-tones, and press the shimmer onto the centre of the lid with a fingertip. Every pan works together, so you cannot go wrong.',
      skinType: ['all'],
      volume: '9 g / 0.32 oz (9 x 1 g)',
      fullIngredients:
        'Talc, Mica, Caprylic/Capric Triglyceride, Zinc Stearate, Dimethicone, Tocopheryl Acetate, Titanium Dioxide (CI 77891), Iron Oxides (CI 77491, CI 77492, CI 77499), Tin Oxide.',
    },
    options: [
      { name: 'Palette', displayType: 'swatch', values: [{ value: 'Warm' }, { value: 'Cool' }, { value: 'Rose' }] },
    ],
    variants: [
      { sku: 'MV-PAL-WRM', priceCents: money(38), isDefault: true, inventoryPolicy: 'continue', optionValues: { Palette: 'Warm' } },
      { sku: 'MV-PAL-COL', priceCents: money(38), inventoryPolicy: 'continue', optionValues: { Palette: 'Cool' } },
      { sku: 'MV-PAL-ROS', priceCents: money(38), inventoryPolicy: 'continue', optionValues: { Palette: 'Rose' } },
    ],
    images: [{ assetId: 'bloom-eyeshadow-palette', isPrimary: true, alt: 'Bloom 9-Pan Eyeshadow Palette' }],
  },
  {
    handle: 'featherweight-mascara',
    title: 'Featherweight Mascara',
    description:
      'A lengthening mascara that separates and lifts every lash without the clump or the flake — a tapered brush reaches the corners, and it wears all day then washes off with warm water. Black or Brown.',
    status: 'active',
    productType: 'Mascara',
    vendor: 'Maeve',
    tags: ['eye', 'mascara', 'vegan', 'bestseller'],
    categoryHandles: ['eye'],
    collectionHandles: ['best-sellers', 'vegan-favourites'],
    seoTitle: 'Featherweight Mascara — lengthening clump-free mascara',
    seoDescription: 'A lengthening mascara that separates and lifts without clumping, in Black or Brown.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'Flexible film-forming polymers and carnauba wax coat and lengthen each lash without weighing it down, and provitamin B5 conditions — so it holds a curl all day, then slides off with warm water.',
      howToUse:
        'Wiggle the tapered brush from root to tip, rolling upward to separate and lift; a second coat while the first is still wet builds length without a clump. Reach the inner and outer corners with the brush tip.',
      skinType: ['all', 'sensitive'],
      volume: '9 ml / 0.3 fl oz',
      fullIngredients:
        'Aqua, Synthetic Beeswax, Copernicia Cerifera (Carnauba) Wax, Acacia Senegal Gum, Panthenol, Butylene Glycol, Stearic Acid, Phenoxyethanol, Iron Oxides (CI 77499).',
    },
    options: [
      { name: 'Shade', displayType: 'swatch', values: [{ value: 'Black' }, { value: 'Brown' }] },
    ],
    variants: [
      { sku: 'MV-MSC-BLK', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue', optionValues: { Shade: 'Black' } },
      { sku: 'MV-MSC-BRN', priceCents: money(24), inventoryPolicy: 'continue', optionValues: { Shade: 'Brown' } },
    ],
    images: [{ assetId: 'featherweight-mascara', isPrimary: true, alt: 'Featherweight Mascara' }],
  },
  {
    handle: 'brow-sculpt-pomade',
    title: 'Brow Sculpt Pomade',
    description:
      'A waterproof brow pomade that shapes, fills and holds a natural-looking brow all day — a little goes a long way, and the spoolie end blends out any hard edge. Six shades from soft blonde to ebony.',
    status: 'active',
    productType: 'Brow',
    vendor: 'Maeve',
    tags: ['eye', 'brow', 'vegan'],
    categoryHandles: ['eye'],
    collectionHandles: ['the-edit'],
    seoTitle: 'Brow Sculpt Pomade — waterproof brow pomade in 6 shades',
    seoDescription: 'A waterproof brow pomade that shapes, fills and holds a natural brow, in six shades.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'A waterproof wax-and-pigment cream shapes and fills with hair-like strokes, then sets to hold unruly brows in place through heat and humidity without stiffness or flaking.',
      howToUse:
        'Pick up a tiny amount on an angled brush and draw short, feathery strokes through sparse spots and along the tail, following the direction of the hair. Blend the front up with the spoolie end so it never looks blocky.',
      skinType: ['all'],
      volume: '4 g / 0.14 oz',
      fullIngredients:
        'Aqua, Cyclopentasiloxane, Synthetic Wax, Trimethylsiloxysilicate, Copernicia Cerifera (Carnauba) Wax, Phenoxyethanol, Iron Oxides (CI 77491, CI 77492, CI 77499).',
    },
    ...shaded('MV-BRW', 20, BROW_SHADES),
    images: [{ assetId: 'brow-sculpt-pomade', isPrimary: true, alt: 'Brow Sculpt Pomade' }],
  },
  {
    handle: 'skinny-gel-eyeliner',
    title: 'Skinny Gel Eyeliner',
    description:
      'A retractable gel liner with a fine tip that draws a crisp line or a soft smudge and sets waterproof in seconds. Six shades — a true black for the sharp days, and colours for when you want a little more.',
    status: 'active',
    productType: 'Eyeliner',
    vendor: 'Maeve',
    tags: ['eye', 'eyeliner', 'gel', 'vegan'],
    categoryHandles: ['eye'],
    collectionHandles: ['new-in'],
    seoTitle: 'Skinny Gel Eyeliner — waterproof retractable gel liner',
    seoDescription: 'A retractable waterproof gel eyeliner with a fine tip, in six shades.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'A creamy gel-wax core lays down opaque colour in one pass and sets waterproof within seconds, so a line stays crisp — or a smoke stays soft — through a long day and warm weather.',
      howToUse:
        'For a clean line, draw along the upper lash line from inner to outer corner and flick the tail while the gel is still workable. For a smoky eye, trace it close to the lashes and smudge with a brush before it sets.',
      skinType: ['all', 'sensitive'],
      volume: '0.4 g / 0.014 oz',
      fullIngredients:
        'Aqua, Cyclopentasiloxane, Synthetic Beeswax, Trimethylsiloxysilicate, Butylene Glycol, Copernicia Cerifera (Carnauba) Wax, Phenoxyethanol, Iron Oxides (CI 77499), Ultramarines (CI 77007).',
    },
    ...shaded('MV-EYL', 18, EYELINER_SHADES),
    images: [{ assetId: 'skinny-gel-eyeliner', isPrimary: true, alt: 'Skinny Gel Eyeliner' }],
  },
  {
    handle: 'buffing-foundation-brush',
    title: 'The Buffing Foundation Brush',
    description:
      'A dense, domed brush of soft synthetic fibres that buffs liquid and cream foundation into skin for a seamless, streak-free finish. Balanced in the hand, quick to wash, and built to last years.',
    status: 'active',
    productType: 'Brush',
    vendor: 'Maeve',
    tags: ['tools', 'brush', 'vegan'],
    categoryHandles: ['tools'],
    collectionHandles: ['gift-sets', 'vegan-favourites'],
    seoTitle: 'The Buffing Foundation Brush — dense synthetic foundation brush',
    seoDescription: 'A dense, domed synthetic brush that buffs liquid and cream foundation to a seamless finish.',
    productTypeKey: 'cosmetics',
    attributes: {
      keyIngredients:
        'Dense, soft synthetic Taklon fibres — cruelty-free and non-absorbent, so they buff liquid and cream foundation into skin rather than drinking it up, for a streak-free, second-skin finish.',
      howToUse:
        'Dot foundation onto the face, then buff in small circles with the domed head and finish with light downward strokes to lay the fibres flat. Wash weekly with a gentle soap, reshape the head, and dry bristles-down.',
      skinType: ['all'],
      volume: 'Domed head, 16 cm balanced handle',
      fullIngredients:
        'Soft synthetic Taklon fibres, a matte anodised-aluminium ferrule, and an FSC-certified birch handle. Cruelty-free and vegan by construction.',
    },
    variants: [{ sku: 'MV-BSH-01', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'buffing-foundation-brush', isPrimary: true, alt: 'The Buffing Foundation Brush' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'face', name: 'Face', description: 'Foundation, concealer, powder, primer and setting spray.', featured: true },
    { handle: 'cheek', name: 'Cheek', description: 'Cream blush and contour for a lit, sculpted face.', featured: true },
    { handle: 'lip', name: 'Lip', description: 'Liquid lipstick, lip oil and liner — a shade for every day.', featured: true },
    { handle: 'eye', name: 'Eye', description: 'Palettes, mascara, brow and liner.', featured: true },
    { handle: 'tools', name: 'Tools', description: 'The brushes to put it all on.', featured: false },
  ],
  collections: [
    {
      handle: 'best-sellers',
      name: 'Best Sellers',
      description: 'The shades and formulas that keep selling out and coming back.',
      type: 'manual',
      featured: true,
      productHandles: [
        'second-skin-luminous-foundation',
        'under-eye-brightening-concealer',
        'lock-it-setting-spray',
        'sunlit-cream-blush',
        'velvet-matte-liquid-lip',
        'bloom-eyeshadow-palette',
        'featherweight-mascara',
      ],
    },
    {
      handle: 'new-in',
      name: 'New In',
      description: 'The latest shades and formulas to land.',
      type: 'manual',
      featured: false,
      productHandles: [
        'second-skin-luminous-foundation',
        'cloud-set-loose-powder',
        'soft-focus-blurring-primer',
        'sunlit-cream-blush',
        'velvet-matte-liquid-lip',
        'glass-shine-lip-oil',
        'bloom-eyeshadow-palette',
        'skinny-gel-eyeliner',
      ],
    },
    {
      handle: 'the-edit',
      name: 'The Edit',
      description: 'The full face the team is wearing right now, start to finish.',
      type: 'manual',
      featured: false,
      productHandles: [
        'second-skin-luminous-foundation',
        'under-eye-brightening-concealer',
        'sunlit-cream-blush',
        'sculpt-contour-stick',
        'velvet-matte-liquid-lip',
        'precision-lip-liner',
        'bloom-eyeshadow-palette',
        'brow-sculpt-pomade',
      ],
    },
    {
      handle: 'gift-sets',
      name: 'Gift Sets',
      description: 'The easy way in — curated together, ready to give.',
      type: 'manual',
      featured: false,
      productHandles: ['glass-shine-lip-oil', 'bloom-eyeshadow-palette', 'buffing-foundation-brush'],
    },
    {
      handle: 'vegan-favourites',
      name: 'Vegan Favourites',
      description: 'The fully vegan pieces our wearers reach for again and again.',
      type: 'manual',
      featured: false,
      productHandles: [
        'sunlit-cream-blush',
        'velvet-matte-liquid-lip',
        'featherweight-mascara',
        'buffing-foundation-brush',
      ],
    },
  ],
  products: PRODUCTS,
};

// ── Content (The Maeve Edit — the how-to journal) ────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'how-to-find-your-foundation-shade-match',
    status: 'published',
    body: {
      title: 'How to find your foundation shade match',
      excerpt: 'The five-minute way to land the right shade the first time — undertone, depth, and where to actually swatch.',
      featuredImage: { $asset: 'post-shade-match' },
      body: {
        type: 'doc',
        content: [
          para('Buying foundation online feels like a gamble, and it does not have to. There are only two things to get right — how deep your skin is, and which way it leans warm or cool — and once you know both, the shade grid stops being a wall of names and starts being a map.'),
          h2('Read your undertone first'),
          para('Look at the veins on your inner wrist in daylight. Greenish leans warm, bluish-purple leans cool, and a mix of both is neutral. Gold jewellery tends to flatter warm skin, silver flatters cool. This one call narrows twenty-four shades down to a family of three or four.'),
          h2('Match depth along the jaw'),
          para('Skin on the back of your hand is rarely the same colour as your face, so swatch two likely shades along the jaw, not the hand. The one that disappears is yours; the one you can still see is the wrong depth. Check it in daylight, near a window, not under a bathroom bulb.'),
          para('Still between two? Size up, not down — a foundation that is a touch deep warms up on the skin, while one that is too light turns grey by lunch. And when the gift blush lands in your bag, that is the flush that ties the whole base together.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'the-5-minute-everyday-face',
    status: 'published',
    body: {
      title: 'The 5-minute everyday face',
      excerpt: 'Five products, five minutes, one face you can do half-asleep — the routine for the days you have no time and still want to look like you.',
      featuredImage: { $asset: 'post-everyday-face' },
      body: {
        type: 'doc',
        content: [
          para('An everyday face is not a smaller version of a full glam — it is a different goal. You are not covering yourself up; you are turning the volume up a notch on what is already there, in the time it takes the coffee to brew.'),
          h2('Base, but barely'),
          para('A pump of the Second Skin foundation pressed in with a finger where you want it, a dot of concealer under the eye, and a dust of Cloud Set powder only where you shine. Skip the full-face coverage — the point is skin that looks like skin.'),
          h2('Colour where it counts'),
          para('Tap the Sunlit Cream Blush high on the cheeks, sweep the Featherweight Mascara through the lashes, and press on a Glass Shine lip oil. Three touches of colour do more for a tired face than any amount of base ever will.'),
          para('That is the whole thing — five products, five minutes, and a face that reads awake. Learn this one and you will reach for it more than any look you own.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'build-a-berry-lip-in-three-steps',
    status: 'published',
    body: {
      title: 'Build a berry lip in three steps',
      excerpt: 'Liner, lipstick, a press of gloss — how to build a berry lip that reads rich, stays put, and never bleeds past the edge.',
      featuredImage: { $asset: 'post-berry-lip' },
      body: {
        type: 'doc',
        content: [
          para('A berry lip is the one that makes a whole face look finished, and the only reason it goes wrong is that most people do it in one step. Do it in three and it lasts through dinner without feathering, fading in the middle, or bleeding at the corners.'),
          h2('Step one: line the whole lip'),
          para('Take the Precision Lip Liner in Berry and draw your edge — then fill the entire lip in, not just the border. A fully lined lip gives the colour something to grip, so when the lipstick wears down through the day it fades evenly instead of leaving a ring.'),
          h2('Step two: press, do not swipe'),
          para('Apply the Velvet Matte Liquid Lip in Berry from the centre out and press your lips together to set it. One coat is enough — it is full pigment, so piling it on only makes it slide. Blot once on a tissue if you want it truly locked.'),
          para('Step three, if you want it juicy rather than flat: press a dab of Glass Shine lip oil in Berry Tint just onto the centre of the lower lip. It catches the light, gives the illusion of fullness, and turns a matte berry into something you cannot stop looking at.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'warm-vs-cool-reading-your-undertone',
    status: 'published',
    body: {
      title: 'Warm vs cool: reading your undertone',
      excerpt: 'Undertone is the thing that decides whether a shade suits you — here is how to read yours, and why it matters for more than foundation.',
      featuredImage: { $asset: 'post-shade-match' },
      body: {
        type: 'doc',
        content: [
          para('Two people with the same skin depth can suit completely different shades, and undertone is why. It is the quiet colour underneath the surface — warm (golden, peachy), cool (pink, bluish) or neutral (a balance of both) — and once you can read yours, every shade choice gets easier, not just your base.'),
          h2('The quick tests'),
          para('Veins: green leans warm, blue-purple leans cool. Jewellery: gold flatters warm, silver flatters cool. White paper held to the face: warm skin looks yellow beside it, cool skin looks pink. Any two agreeing is usually your answer; if they split, you are likely neutral and can wear both.'),
          h2('Why it matters past foundation'),
          para('Undertone is why a blush that glows on your friend can look muddy on you. Warm skin comes alive in peach, coral and terracotta; cool skin sings in rose, berry and plum. The same logic runs through lip and eye — the Bloom palette in Warm or Cool is that idea in a single pan.'),
          para('None of this is a rule you are stuck with — a bold lip can happily ignore your undertone. But for the shades meant to look like your own colour, only better, matching your undertone is the difference between makeup that reads and makeup that disappears in the best way.'),
        ],
      },
    },
  },
];

// ── Product detail (the beauty-counter PDP) + Shop ───────────────────────────────
// Huda/Sephora's PDP is a shade-forward counter (DESIGN §5/§6/§7): a big pack shot on
// the left, a buy-box on the right — breadcrumb, product title, price, ADD TO BAG — then
// a stacked run of counter detail (SHADE & FINISH / HOW TO APPLY / INGREDIENTS / SHIPPING
// & RETURNS) the reference carries as accordions. Ported to Maeve: the same two-column
// counter in the `gloss` theme, where `btn-primary` is the hot magenta the reference
// floods its ADD TO BAG pill with (white-inked by construction) and price/readable copy
// stay on ink — the template's KNOWN contrast note (magenta rides the chrome + primary
// action, never body text). Bound fields come from the shared PDP kit (correct
// `repeat('product')` scope + `item.*` binds); the layout + static counter copy are ours.
// The live shade-swatch selector is a later behaviors phase (see the file header) — the
// selector control is deliberately NOT built here, so the detail reads without JavaScript.

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the big pack shot. Right: the magenta-actioned counter buy column. The detail stack
 *  is no longer hardcoded per template (a serum's ingredients ≠ a cleanser's): `pdpAttributes`
 *  repeats the routed product's OWN typed cosmetics attributes (docs/143) in the counter voice,
 *  and `pdpPolicyLinks` points at the store's real shipping/returns pages. */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-16', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          // The big pack shot (one bound primary — the storefront fills it per product).
          pdpImage(
            'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'
          ),
          // The counter buy column.
          el('div', 'flex flex-col gap-6 @3xl:py-4', {
            children: [
              el('div', 'flex flex-col gap-3', {
                children: [
                  // Brand/breadcrumb label above the title — a plain <p>, so the product
                  // title stays the page's one <h1>.
                  el('p', 'text-sm font-semibold uppercase tracking-widest text-base-content', {
                    text: 'Maeve',
                  }),
                  pdpTitle(
                    'h1',
                    'text-4xl font-bold uppercase leading-tight tracking-tight text-base-content @3xl:text-5xl'
                  ),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-bold text-base-content',
                    compareClass: 'text-lg text-base-content line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                  // A real low-stock signal, in the theme's hot magenta — shown only when the
                  // routed product is genuinely running low (never fabricated scarcity).
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 rounded-field bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-content',
                    label: 'Low stock',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              // Qty + Add to bag — the hot-magenta CTA (btn-primary in `gloss`).
              addToCartForm(),
              // The counter reassurance micro-line — the reference's free-samples / VIP
              // beat, static here (the loyalty component is a later phase). Readable ink.
              el('p', 'text-sm font-medium text-base-content', {
                text: 'Cruelty-free · vegan wherever the formula allows · a free sample with every order',
              }),
              // The product's OWN typed attributes (key ingredients / how to use / skin type /
              // size / full INCI) — repeated from `attributeSections`, real per-product copy
              // rather than one hardcoded counter stack, in the same small-caps counter voice.
              pdpAttributes({
                containerClass: 'mt-2 flex flex-col gap-5',
                sectionClass: 'flex flex-col gap-2 border-t border-base-300 pt-5',
                labelTag: 'h2',
                labelClass: 'text-sm font-bold uppercase tracking-widest text-base-content',
                valueClass: 'text-base leading-relaxed text-base-content',
                rowClass:
                  'flex items-baseline justify-between gap-4 border-b border-base-200 pb-1',
                rowLabelClass: 'text-base font-semibold text-base-content',
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

/** The full beauty-counter PDP — the buy region above a "You may also love" carousel of
 *  same-collection shades (`commerce.related`, the shared kit's default cross-sell). */
const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'You may also love' });

/** The Shop page's own counter header, shown ABOVE the faceted PLP core the harness
 *  appends. Heavy uppercase display title + a single shade-forward intro line — the loud,
 *  category-driven framing the reference gives its listing, in place of the generic
 *  "Shop / Browse everything Maeve makes". */
const SHOP: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-4xl font-bold uppercase leading-tight tracking-tight text-base-content @3xl:text-6xl',
            { text: 'Shop the full range' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Face, lip, eye and the tools to put it all on — every Maeve shade and formula, filtered and sorted however you like. Full pigment, built for every skin tone, no apology.',
          }),
        ],
      }),
    ],
  }),
];

// ── The remaining functional pages (bespoke framing over the shared cores) ───────
// Collections / Cart / Search each get Maeve's own counter masthead above the pinned,
// shoppable core the harness appends; the Journal index gets its own masthead over the
// shared linkable post grid. Same loud, shade-forward blush-ground voice as the rest of
// the site — heavy uppercase display headings, readable copy kept on ink (magenta rides
// the chrome + primary action, never body text — the template's KNOWN contrast note).

/** A plain counter masthead — a heavy uppercase `<h1>` + one intro line on the blush
 *  ground. Used for Collections / Search, which each want a loud header over their core. */
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

const COLLECTIONS: Node[] = [
  pageMasthead(
    'Shop the collections',
    'Face, cheek, lip, eye and the tools to put it all on — plus the edits we curate ourselves: the best-sellers that keep selling out, what has just landed, and the full face the team is wearing right now. Start wherever you are getting dressed.'
  ),
];

const SEARCH: Node[] = [
  pageMasthead(
    'Search Maeve',
    'After a shade, a formula or a how-to? Search the whole range and The Maeve Edit — try a colour, a category or a concern, and we will pull up everything that matches.'
  ),
];

const JOURNAL: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-4xl font-bold uppercase leading-tight tracking-tight text-base-content @3xl:text-6xl',
            { text: 'The Maeve Edit' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Shade-matching, five-minute faces and step-by-steps for the looks worth learning — how to actually wear the line, written by the people who make it.',
          }),
        ],
      }),
    ],
  }),
];

/** The Cart page's own header — a warm reassurance band above the pinned cart core, in
 *  place of the generic "Your bag" heading. A free sample with every order, easy thirty-day
 *  returns even on opened shades, and a secure checkout — the three things a first-time
 *  shade-buyer wants to read before they check out. */
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-4xl font-bold uppercase leading-tight tracking-tight text-base-content @3xl:text-5xl',
            { text: 'Your bag' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Every order ships with a free sample so you can try before you commit, and returns are easy — send anything back within thirty days, even opened, for a full refund or a swap. Checkout is secure, and your shade is one tap away.',
          }),
        ],
      }),
    ],
  }),
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'beauty-counter',
  key: 'sparx-beauty-counter',
  name: 'sparx — Beauty Counter',
  summary:
    'A shade-forward storefront for an own-brand colour-cosmetics house — a full-bleed lifestyle hero over a "find your perfect match" funnel of best-sellers, shade-matching editorial bands, face/lip/eye carousels and a gift-with-purchase reward, in a blush-tinted theme with a bold hot-magenta primary. Modelled on the beauty-counter archetype; shipped as Maeve.',
  tagline: 'A glossy, shade-forward template for own-brand colour cosmetics and beauty counters.',
  vertical: 'retail',
  industry: 'Colour cosmetics',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 60,
  brand: {
    businessName: 'Maeve',
    tagline: 'Full pigment. No apology.',
  },
  // Beauty-counter chrome: a brand-LEFT wordmark with a prominent shop CTA in the bar
  // (`showCta: true` — the reference runs a loud shop cluster), over the category-rich
  // COLUMNS footer (shop + help + company link columns above the legal bar; the on-page
  // newsletter carries the "let's connect" capture). The reference centres its wordmark,
  // but with a loud shop CTA the brand-left header is the honest fit — a centred logo
  // pairs with NO bar CTA (`centerLogo` + `showCta:false`, as editorial-grid runs it).
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Maeve — full-pigment colour cosmetics for every skin tone',
      description:
        'Maeve makes full-pigment colour cosmetics for every skin tone — foundation in a shade that actually disappears, a lip for every mood, and a face that lasts from first coffee to last call.',
    },
    about: {
      title: 'About Maeve',
      description:
        'Who Maeve is, and how we build full-pigment colour for every skin tone — the shade range, the formulas and the people behind them.',
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
