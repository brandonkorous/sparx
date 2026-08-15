// sparx-editorial-grid — the FIRST reference-driven site template (docs/templates/kith).
//
// Kith translated to sparx: an editorial-streetwear storefront that reads like a
// magazine, ported to a design furniture & objects studio — Atelier Nord, "Objects made
// to keep". The home page is the Kith rhythm — a full-bleed serif hero, then a repeating
// editorial-band → shoppable-carousel cycle down the page — dressed in the bespoke
// `atelier` theme (paper ground, near-black mono primary, high-contrast serif display).
//
// This file is JUST the SPEC; the composition + emission live in the shared
// `template-sites/harness.ts`, which the other nine templates reuse. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-template-editorial-grid.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-editorial-grid/**" \
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
import {
  actions,
  primaryAction,
  secondaryAction,
  section,
  sectionHead,
} from '../../packages/silica-catalog/src/sections/_shell';
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import { contactSection } from './shared/contact-section';
import { emitBundle, type TemplateSiteSpec } from './template-sites/harness';
import { writeTemplatePreview } from './template-sites/preview';
import { heroCarousel } from './template-sites/behaviors';
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
// hero / editorial-band / studio-strip photos are TREE imagery, so they hot-link the
// same URL inline (docs/54 §6) — they still appear in `assets` as the single documented
// registry of the bundle's imagery + alt text.
const U = (id: string): string => `https://images.unsplash.com/photo-${id}?w=1400&q=80`;

const IMG = {
  // Products
  oakChair: '1567538096630-e0c55bd6374c',
  walnutStool: '1503602642458-232111445657',
  travertineTable: '1611486212355-d276af4581c0',
  linenLamp: '1507473885765-e6ed057f782c',
  paperPendant: '1524758631624-e2822e304c36',
  ceramicCarafe: '1610701596007-11502861dcfa',
  stonewareVase: '1578749556568-bc2c40e68b61',
  woolThrow: '1600369671236-e74521d4b6ad',
  mohairCushion: '1540574163026-643ea20ade25',
  leatherSling: '1553062407-98eeb64c6a62',
  corkTray: '1584589167171-541ce45f1eea',
  brassCandle: '1519710164239-da123dc03ef4',
  // Journal posts
  postOak: '1538688525198-9b88f6f53126',
  postMaterials: '1616486338812-3dadae4b4ace',
  postRoom: '1526170375885-4d8ecf77b99f',
  // Hero + editorial bands (tree imagery)
  hero: '1618220179428-22790b461013',
  featSeating: '1550226891-ef816aed4a98',
  featLighting: '1513506003901-1e6a229e2d15',
  featTabletop: '1595428774223-ef52624120d2',
  // Studio strip
  studio1: '1616627561950-9f746e330187',
  studio2: '1567225557594-88d73e55f2cb',
  studio3: '1586023492125-27b2c045efd7',
  studio4: '1594026112284-02bb6f3352fe',
} as const;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'oak-lounge-chair', url: U(IMG.oakChair), alt: 'An oak-framed lounge chair in a bright room' },
  { id: 'walnut-stool', url: U(IMG.walnutStool), alt: 'A turned walnut stool against a plain wall' },
  { id: 'travertine-side-table', url: U(IMG.travertineTable), alt: 'A round travertine side table' },
  { id: 'linen-floor-lamp', url: U(IMG.linenLamp), alt: 'A slim floor lamp with a linen shade' },
  { id: 'paper-pendant', url: U(IMG.paperPendant), alt: 'A paper-shade pendant light' },
  { id: 'ceramic-carafe', url: U(IMG.ceramicCarafe), alt: 'A hand-thrown ceramic carafe' },
  { id: 'stoneware-vase-set', url: U(IMG.stonewareVase), alt: 'A pair of stoneware vases' },
  { id: 'wool-throw', url: U(IMG.woolThrow), alt: 'A folded wool throw' },
  { id: 'mohair-cushion', url: U(IMG.mohairCushion), alt: 'A mohair cushion on a chair' },
  { id: 'leather-magazine-sling', url: U(IMG.leatherSling), alt: 'A leather magazine sling' },
  { id: 'cork-tray', url: U(IMG.corkTray), alt: 'A cork serving tray' },
  { id: 'brass-candleholder', url: U(IMG.brassCandle), alt: 'A brass candleholder with a lit taper' },
  { id: 'post-oak', url: U(IMG.postOak), alt: 'Oak boards stacked in a workshop' },
  { id: 'post-materials', url: U(IMG.postMaterials), alt: 'Raw stone and clay material samples' },
  { id: 'post-room', url: U(IMG.postRoom), alt: 'A calm, sparsely furnished living room' },
  { id: 'hero-home', url: U(IMG.hero), alt: 'A quiet room furnished in oak, stone and wool' },
  { id: 'feature-seating', url: U(IMG.featSeating), alt: 'A lounge chair in a sunlit corner' },
  { id: 'feature-lighting', url: U(IMG.featLighting), alt: 'Warm lamplight against a dark wall' },
  { id: 'feature-tabletop', url: U(IMG.featTabletop), alt: 'A table set with ceramic and stoneware' },
  { id: 'studio-1', url: U(IMG.studio1), alt: 'A detail from the studio' },
  { id: 'studio-2', url: U(IMG.studio2), alt: 'A detail from the studio' },
  { id: 'studio-3', url: U(IMG.studio3), alt: 'A finished room' },
  { id: 'studio-4', url: U(IMG.studio4), alt: 'A material close-up' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-editorial-grid: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections (the Kith sequence) ───────────────────────────────────────

/** ONE slide of the rotating serif hero — a full-bleed photograph, the headline and its
 *  actions in a solid readable panel over it (the `hero_overlay` shape). Kith's home leads
 *  with an auto-advancing photograph carousel (DESIGN §4/§7 — six slides), so Atelier Nord's
 *  hero rotates through the brand statement and its three lead collections; the marker
 *  plumbing lives in the shared `heroCarousel`. `headingTag` is `h1` on the FIRST slide only
 *  — a page has exactly one top-level heading, so the rotating campaign slides that follow it
 *  are `h2` (the site-lint sweep flags a second `h1`). Every class is a NAMED utility so it
 *  survives the stamp into the tenant's stored tree. */
function heroSlide(o: {
  assetId: string;
  alt: string;
  headingTag: 'h1' | 'h2';
  heading: string;
  lead: string;
  primary: { text: string; href: string };
  secondary?: { text: string; href: string };
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
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el(
                  o.headingTag,
                  'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
                  { text: o.heading }
                ),
                el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
                actions([
                  primaryAction(o.primary.text, o.primary.href),
                  ...(o.secondary ? [secondaryAction(o.secondary.text, o.secondary.href)] : []),
                ]),
              ],
            }),
          ],
        }
      ),
    ],
  });
}

/** The rotating hero — the brand statement, then each lead collection as its own campaign
 *  slide. Auto-advances (suppressed in the canvas + under reduced motion by the engine); the
 *  first slide, and the whole page, degrade cleanly when it never hydrates. */
function hero(): Node {
  return heroCarousel([
    heroSlide({
      assetId: 'hero-home',
      alt: 'A quiet room furnished in oak, stone and wool',
      headingTag: 'h1',
      heading: 'Objects made to keep',
      lead: 'Furniture and objects for the considered home — made in small runs from oak, stone, wool and clay, and built to outlast the season they arrive in.',
      primary: { text: 'Shop new arrivals', href: '/shop' },
      secondary: { text: 'The Atelier Journal', href: '/journal' },
    }),
    heroSlide({
      assetId: 'feature-seating',
      alt: 'A lounge chair in a sunlit corner',
      headingTag: 'h2',
      heading: 'Seating, considered',
      lead: 'Chairs and stools built around the way a body actually rests — solid oak and turned walnut, joined to last a generation.',
      primary: { text: 'Shop seating', href: '/shop' },
    }),
    heroSlide({
      assetId: 'feature-lighting',
      alt: 'Warm lamplight against a dark wall',
      headingTag: 'h2',
      heading: 'Light, softened',
      lead: 'Linen and paper shades that turn a hard bulb into something worth sitting beside — warm, quiet, and made to be lived with.',
      primary: { text: 'Shop lighting', href: '/shop' },
    }),
    heroSlide({
      assetId: 'feature-tabletop',
      alt: 'A table set with ceramic and stoneware',
      headingTag: 'h2',
      heading: 'The set table',
      lead: 'Stoneware, ceramic and brass for the objects a table earns over years — thrown, glazed and finished by hand.',
      primary: { text: 'Shop tabletop', href: '/shop' },
    }),
  ]);
}

/** A mid-page editorial band — a full-bleed photograph carrying a collection's intro and
 *  a quiet "A closer look" text link (the `feature_overlay` / picture-band shape with the
 *  secondary link slot the DESIGN calls for). */
function editorialBand(o: {
  heading: string;
  lead: string;
  assetId: string;
  cta: string;
  href: string;
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

/** The shoppable "From the studio" strip — a row of square photographs a visitor scrolls
 *  through (the `gallery_strip` shape). CSS-only scroll, named utilities throughout. */
function studioStrip(): Node {
  const shot = (assetId: string, title: string): Node =>
    el('figure', 'flex w-72 shrink-0 snap-start flex-col gap-3', {
      children: [
        el('img', 'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover', {
          attrs: { src: assetUrl(assetId), alt: '', loading: 'lazy' },
        }),
        el('figcaption', 'text-base font-semibold text-base-content', { text: title }),
      ],
    });
  return section([
    sectionHead(
      'From the studio',
      'A few frames from the workshop and the rooms our pieces have found homes in.'
    ),
    el('div', 'flex snap-x gap-6 overflow-x-auto pb-4', {
      children: [
        shot('studio-1', 'At the bench'),
        shot('studio-2', 'Oiling the oak'),
        shot('studio-3', 'A finished room'),
        shot('studio-4', 'Glaze tests'),
      ],
    }),
  ]);
}

const HOME: Node[] = [
  hero(),
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New arrivals' }),
  editorialBand({
    heading: 'Seating, considered',
    lead: 'Chairs and stools built around the way a body actually rests — solid oak and turned walnut, joined to last a generation.',
    assetId: 'feature-seating',
    cta: 'A closer look',
    href: '/collections',
  }),
  productsBlock({ source: 'commerce.category.seating', layout: 'carousel', heading: 'Seating' }),
  editorialBand({
    heading: 'Light, softened',
    lead: 'Linen and paper shades that turn a hard bulb into something worth sitting beside. Warm, quiet, and made to be lived with.',
    assetId: 'feature-lighting',
    cta: 'A closer look',
    href: '/collections',
  }),
  productsBlock({ source: 'commerce.category.lighting', layout: 'carousel', heading: 'Lighting' }),
  editorialBand({
    heading: 'The set table',
    lead: 'Stoneware, ceramic and brass for the objects a table earns over years — thrown, glazed and finished by hand.',
    assetId: 'feature-tabletop',
    cta: 'A closer look',
    href: '/collections',
  }),
  productsBlock({ source: 'commerce.category.tabletop', layout: 'carousel', heading: 'Tabletop' }),
  studioStrip(),
  // NB: no page-level newsletter band here — the `footer: 'newsletter'` chrome variant
  // carries the "Join the list" capture, so a section here would be two back-to-back signups.
];

// ── About + Contact (Atelier-voiced) ─────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-4xl font-semibold tracking-tight text-base-content @2xl:text-5xl', {
            text: 'About Atelier Nord',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Atelier Nord is a small design studio making furniture and objects for the considered home. We work in oak, walnut, stone, wool and clay — materials that age into something better than they began — and we make in small runs, in our own workshop, by the people whose names are on the work.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Nothing here is bought in and re-badged. We can tell you where every piece came from, who made it, and how to keep it going for decades. That is the whole idea: objects made to keep.',
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
    heading: 'Visit the studio',
    intro: 'Our workshop and showroom are open by appointment. Tell us what you are looking for — a single piece, a whole room, or something made to your measurements — and we will find a time.',
    submitLabel: 'Email the studio',
  }),
];

// ── Commerce (Atelier Nord — ~12 SKUs) ───────────────────────────────────────────

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
  // The typed product type (docs/143) — every piece here is `home_goods`, so the PDP's
  // `pdpAttributes` renders each product's OWN materials/dimensions/care/origin (real
  // per-product copy, not a hardcoded stack).
  productTypeKey: 'home_goods';
  attributes: {
    materials: string;
    dimensions: string;
    care: string;
    origin: string;
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

const PRODUCTS: Product[] = [
  {
    handle: 'oak-lounge-chair',
    title: 'Nord Oak Lounge Chair',
    description:
      'A low lounge chair on a solid white-oak frame, hand-shaped and oiled, with a slung seat you sink into and a back angled for an evening rather than a meeting. Made to be re-upholstered, never replaced.',
    status: 'active',
    productType: 'Seating',
    vendor: 'Atelier Nord',
    tags: ['oak', 'lounge', 'seating', 'handmade'],
    categoryHandles: ['seating'],
    collectionHandles: ['new-arrivals', 'seating'],
    seoTitle: 'Nord Oak Lounge Chair — solid white-oak lounge chair',
    seoDescription: 'A hand-shaped solid white-oak lounge chair with a slung, re-upholsterable seat.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'A solid white-oak frame, hand-shaped and finished in hard wax oil, over a webbed seat suspension. The slung seat and back come in natural linen or charcoal wool, tacked so they can be re-tensioned or replaced rather than bonded shut.',
      dimensions: 'W 68 × D 82 × H 74 cm; seat H 38 cm',
      care: 'Dust the frame and refresh the hard wax oil with a cloth once a year — a knock sands out of solid oak rather than chipping through. Vacuum the upholstery gently, treat spills promptly, and the covers can be re-tensioned or remade when they eventually tire.',
      origin: 'Made in our Oslo workshop',
    },
    options: [
      { name: 'Upholstery', displayType: 'swatch', values: [{ value: 'Natural linen' }, { value: 'Charcoal wool' }] },
    ],
    variants: [
      { sku: 'ATN-CHAIR-LIN', priceCents: money(1290), isDefault: true, inventoryPolicy: 'continue', optionValues: { Upholstery: 'Natural linen' } },
      { sku: 'ATN-CHAIR-WOL', priceCents: money(1390), inventoryPolicy: 'continue', optionValues: { Upholstery: 'Charcoal wool' } },
    ],
    images: [{ assetId: 'oak-lounge-chair', isPrimary: true, alt: 'The Nord Oak Lounge Chair' }],
  },
  {
    handle: 'walnut-turned-stool',
    title: 'Walnut Turned Stool',
    description:
      'A little stool turned from a single billet of walnut — a seat, a side table, a step to the top shelf. Finished with hard wax oil that you can refresh with a cloth in five minutes.',
    status: 'active',
    productType: 'Seating',
    vendor: 'Atelier Nord',
    tags: ['walnut', 'stool', 'seating', 'handmade'],
    categoryHandles: ['seating'],
    collectionHandles: ['seating'],
    seoTitle: 'Walnut Turned Stool — solid walnut stool',
    seoDescription: 'A stool turned from a single billet of solid walnut, finished in hard wax oil.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'Turned from a single billet of solid walnut — seat, legs and stretcher all one timber, with no joins to work loose — in a natural or smoked finish sealed with hard wax oil.',
      dimensions: 'Ø 32 × H 45 cm',
      care: 'Wipe with a dry or barely damp cloth and re-apply hard wax oil once or twice a year to feed the grain. Keep it clear of a radiator’s direct heat so the timber does not dry out and check, and it will serve as a seat, a side table or a step for decades.',
      origin: 'Made in our Oslo workshop',
    },
    options: [
      { name: 'Finish', displayType: 'swatch', values: [{ value: 'Natural' }, { value: 'Smoked' }] },
    ],
    variants: [
      { sku: 'ATN-STOOL-NAT', priceCents: money(340), isDefault: true, inventoryPolicy: 'continue', optionValues: { Finish: 'Natural' } },
      { sku: 'ATN-STOOL-SMK', priceCents: money(360), inventoryPolicy: 'continue', optionValues: { Finish: 'Smoked' } },
    ],
    images: [{ assetId: 'walnut-stool', isPrimary: true, alt: 'The Walnut Turned Stool' }],
  },
  {
    handle: 'travertine-side-table',
    title: 'Travertine Side Table',
    description:
      'A round side table cut from a single piece of unfilled travertine, its top honed smooth and its edges left soft. Heavy, cool to the touch, and completely at home beside the lounge chair.',
    status: 'active',
    productType: 'Tables',
    vendor: 'Atelier Nord',
    tags: ['travertine', 'stone', 'table', 'objects'],
    categoryHandles: ['objects'],
    collectionHandles: ['new-arrivals'],
    seoTitle: 'Travertine Side Table — solid stone side table',
    seoDescription: 'A round side table cut from a single piece of unfilled honed travertine.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'Cut from a single piece of unfilled Italian travertine, the top honed smooth and the edges left soft. Solid stone through and through — no core, no veneer, no filler in the natural pitting.',
      dimensions: 'Ø 40 × H 45 cm',
      care: 'Seal it with a penetrating stone sealer when new and again every year or two; sealed, it shrugs off water rings and the odd spill — you wipe it and move on. The faint marks a life leaves in the stone are the reason to own the real thing.',
      origin: 'Made in Italy',
    },
    variants: [{ sku: 'ATN-SIDETABLE', priceCents: money(680), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'travertine-side-table', isPrimary: true, alt: 'The Travertine Side Table' }],
  },
  {
    handle: 'linen-floor-lamp',
    title: 'Linen-Shade Floor Lamp',
    description:
      'A slim brass stem carrying a hand-sewn linen drum that throws a warm, even light. Dimmable in the base, weighted so it stays put, and tall enough to read beneath from a low chair.',
    status: 'active',
    productType: 'Lighting',
    vendor: 'Atelier Nord',
    tags: ['linen', 'lighting', 'floor-lamp', 'brass'],
    categoryHandles: ['lighting'],
    collectionHandles: ['new-arrivals', 'lighting'],
    seoTitle: 'Linen-Shade Floor Lamp — dimmable brass floor lamp',
    seoDescription: 'A slim brass floor lamp with a hand-sewn linen drum shade, dimmable at the base.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'A slim solid-brass stem on a weighted brass base, carrying a hand-sewn linen drum shade. The brass is left unlacquered to take a patina, and there is an in-line dimmer at the foot.',
      dimensions: 'Ø 35 × H 150 cm',
      care: 'Dust the shade with a soft brush and wipe the brass with a dry cloth; a metal polish brings the shine back whenever you want it, or leave it to darken. Use a dimmable LED bulb (E27, 10 W max) to keep the linen cool over the years.',
      origin: 'Made in our Oslo workshop',
    },
    variants: [{ sku: 'ATN-FLOORLAMP', priceCents: money(420), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'linen-floor-lamp', isPrimary: true, alt: 'The Linen-Shade Floor Lamp' }],
  },
  {
    handle: 'paper-shade-pendant',
    title: 'Paper-Shade Pendant',
    description:
      'A folded paper pendant that glows like a lantern and packs flat when you move. Comes with three metres of braided cord and a ceiling cup in the same brass as the lamp.',
    status: 'active',
    productType: 'Lighting',
    vendor: 'Atelier Nord',
    tags: ['paper', 'lighting', 'pendant'],
    categoryHandles: ['lighting'],
    collectionHandles: ['lighting'],
    seoTitle: 'Paper-Shade Pendant — folded paper pendant light',
    seoDescription: 'A folded paper pendant lamp with braided cord and a brass ceiling cup.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'A folded paper shade that glows like a lantern and packs flat, hung on three metres of braided fabric cord with a solid-brass ceiling cup in the same brass as our lamps.',
      dimensions: 'Ø 45 × H 40 cm; 3 m cord',
      care: 'Dust with a dry, soft brush only — paper does not take a damp cloth. Fit a cool-running LED bulb (E27, 8 W max), and the shade folds flat again if you ever move house.',
      origin: 'Made in Denmark',
    },
    variants: [{ sku: 'ATN-PENDANT', priceCents: money(280), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'paper-pendant', isPrimary: true, alt: 'The Paper-Shade Pendant' }],
  },
  {
    handle: 'ceramic-carafe',
    title: 'Hand-Thrown Ceramic Carafe',
    description:
      'A one-litre carafe thrown on the wheel and glazed in a soft matte white that breaks to clay at the rim. Balanced to pour without a drip, and happy on the table or beside the bed.',
    status: 'active',
    productType: 'Tabletop',
    vendor: 'Atelier Nord',
    tags: ['ceramic', 'carafe', 'tabletop', 'handmade'],
    categoryHandles: ['tabletop'],
    collectionHandles: ['tabletop'],
    seoTitle: 'Hand-Thrown Ceramic Carafe — one-litre matte carafe',
    seoDescription: 'A one-litre hand-thrown ceramic carafe in a soft matte white glaze.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'Thrown on the wheel from stoneware clay and glazed in a soft matte white that breaks to bare clay at the rim. One litre, watertight, and balanced to pour clean without a drip.',
      dimensions: 'Ø 11 × H 22 cm; 1 L',
      care: 'Dishwasher-safe, though hand washing keeps the matte glaze even over the years. The unglazed rim may darken a little with use — that is the clay showing through, not a fault, and it wipes back.',
      origin: 'Made in Portugal',
    },
    variants: [{ sku: 'ATN-CARAFE', priceCents: money(78), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'ceramic-carafe', isPrimary: true, alt: 'The Hand-Thrown Ceramic Carafe' }],
  },
  {
    handle: 'stoneware-vase-set',
    title: 'Stoneware Vase Set',
    description:
      'A pair of stoneware vases — one tall and narrow, one low and wide — glazed in a speckled oatmeal that suits a single stem or a whole armful. Sold together, made to sit apart.',
    status: 'active',
    productType: 'Tabletop',
    vendor: 'Atelier Nord',
    tags: ['stoneware', 'vase', 'tabletop', 'set'],
    categoryHandles: ['tabletop'],
    collectionHandles: ['new-arrivals', 'tabletop'],
    seoTitle: 'Stoneware Vase Set — pair of speckled stoneware vases',
    seoDescription: 'A pair of speckled-oatmeal stoneware vases, one tall and one low.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'A pair of wheel-thrown stoneware vases — one tall and narrow, one low and wide — in a speckled oatmeal glaze. Sold together, both watertight, and made to sit apart.',
      dimensions: 'Tall Ø 12 × H 26 cm; low Ø 18 × H 14 cm',
      care: 'Both hold water for fresh stems — rinse and dry after each use. Dishwasher-safe, but a gentle hand wash keeps the speckled glaze looking its best; empty them before a hard frost if they live on a sill.',
      origin: 'Made in Portugal',
    },
    variants: [{ sku: 'ATN-VASESET', priceCents: money(145), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'stoneware-vase-set', isPrimary: true, alt: 'The Stoneware Vase Set' }],
  },
  {
    handle: 'wool-throw',
    title: 'Lambswool Throw',
    description:
      'A generously sized throw woven from British lambswool with a soft brushed face and a fringed edge. Warm without weight, and the kind of thing that ends up on whoever gets to the sofa first.',
    status: 'active',
    productType: 'Textiles',
    vendor: 'Atelier Nord',
    tags: ['wool', 'throw', 'textiles'],
    categoryHandles: ['textiles'],
    collectionHandles: ['textiles'],
    seoTitle: 'Lambswool Throw — brushed British lambswool throw',
    seoDescription: 'A generously sized brushed British-lambswool throw with a fringed edge.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        '100% British lambswool, woven with a soft brushed face and finished with a hand-knotted fringe, in oat or slate. Warm without weight, and naturally springy so it does not crush flat.',
      dimensions: '130 × 180 cm',
      care: 'Air it rather than wash it where you can; when it needs it, dry-clean or hand wash cool on the wool cycle and dry flat. No tumble dryer — heat felts the wool — and comb the fringe straight with your fingers.',
      origin: 'Made in the United Kingdom',
    },
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Oat' }, { value: 'Slate' }] },
    ],
    variants: [
      { sku: 'ATN-THROW-OAT', priceCents: money(190), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Oat' } },
      { sku: 'ATN-THROW-SLT', priceCents: money(190), inventoryPolicy: 'continue', optionValues: { Colour: 'Slate' } },
    ],
    images: [{ assetId: 'wool-throw', isPrimary: true, alt: 'The Lambswool Throw' }],
  },
  {
    handle: 'mohair-cushion',
    title: 'Mohair Cushion',
    description:
      'A deep, plush mohair cushion with a feather-down pad and a hidden zip, backed in brushed cotton. One on a bench reads as a decision; three reads as a room.',
    status: 'active',
    productType: 'Textiles',
    vendor: 'Atelier Nord',
    tags: ['mohair', 'cushion', 'textiles'],
    categoryHandles: ['textiles'],
    collectionHandles: ['new-arrivals', 'textiles'],
    seoTitle: 'Mohair Cushion — plush mohair cushion with down pad',
    seoDescription: 'A deep plush mohair cushion with a feather-down pad and a hidden zip.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'A deep, plush mohair face backed in brushed cotton, over a feather-down inner pad, closed with a hidden zip. In rust or sand.',
      dimensions: '50 × 50 cm',
      care: 'Unzip and dry-clean the cover; plump and rotate the down pad to keep its loft. Shake it out rather than beating it, and keep it clear of long direct sun so the colour holds.',
      origin: 'Made in the United Kingdom',
    },
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Rust' }, { value: 'Sand' }] },
    ],
    variants: [
      { sku: 'ATN-CUSHION-RST', priceCents: money(110), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Rust' } },
      { sku: 'ATN-CUSHION-SND', priceCents: money(110), inventoryPolicy: 'continue', optionValues: { Colour: 'Sand' } },
    ],
    images: [{ assetId: 'mohair-cushion', isPrimary: true, alt: 'The Mohair Cushion' }],
  },
  {
    handle: 'leather-magazine-sling',
    title: 'Leather Magazine Sling',
    description:
      'A saddle-leather sling that hangs a stack of magazines off the arm of a chair instead of the floor. Vegetable-tanned, riveted by hand, and made to darken with use.',
    status: 'active',
    productType: 'Objects',
    vendor: 'Atelier Nord',
    tags: ['leather', 'storage', 'objects'],
    categoryHandles: ['objects'],
    collectionHandles: [],
    seoTitle: 'Leather Magazine Sling — saddle-leather magazine holder',
    seoDescription: 'A hand-riveted vegetable-tanned saddle-leather magazine sling.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'Cut from vegetable-tanned saddle leather and riveted by hand with solid-brass hardware. Undyed, so it darkens and softens the more it is used.',
      dimensions: 'Panel 40 × 30 cm; hangs to 55 cm',
      care: 'Wipe with a dry cloth and feed it with a neutral leather balm once or twice a year. It will patina and darken with use — that is the leather living, not wearing out — so just keep it out of standing water.',
      origin: 'Made in Italy',
    },
    variants: [{ sku: 'ATN-SLING', priceCents: money(240), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'leather-magazine-sling', isPrimary: true, alt: 'The Leather Magazine Sling' }],
  },
  {
    handle: 'cork-serving-tray',
    title: 'Cork Serving Tray',
    description:
      'A light, warm serving tray pressed from a single slab of cork with a solid oak lip. Quiet to set down, kind to glasses, and it floats if you ever drop it in the sink.',
    status: 'active',
    productType: 'Tabletop',
    vendor: 'Atelier Nord',
    tags: ['cork', 'tray', 'tabletop'],
    categoryHandles: ['tabletop'],
    collectionHandles: ['tabletop'],
    seoTitle: 'Cork Serving Tray — cork tray with oak lip',
    seoDescription: 'A light cork serving tray pressed from a single slab with a solid oak lip.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'Pressed from a single slab of natural cork with a solid-oak lip — light, warm to the hand, quiet to set down and kind to glassware. It even floats.',
      dimensions: 'W 45 × D 30 × H 4 cm',
      care: 'Wipe with a damp cloth and dry flat; cork does not like a long soak or a dishwasher. A little food-safe oil on the oak lip once a year keeps it from drying and lightening.',
      origin: 'Made in Portugal',
    },
    variants: [{ sku: 'ATN-TRAY', priceCents: money(65), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'cork-tray', isPrimary: true, alt: 'The Cork Serving Tray' }],
  },
  {
    handle: 'brass-candleholder',
    title: 'Brass Candleholder',
    description:
      'A turned solid-brass candleholder with a weighted base and a wide drip dish, sized for a standard dinner candle. Left unlacquered, so it takes on a patina that a polish brings straight back.',
    status: 'active',
    productType: 'Objects',
    vendor: 'Atelier Nord',
    tags: ['brass', 'candle', 'objects'],
    categoryHandles: ['objects'],
    collectionHandles: ['tabletop'],
    seoTitle: 'Brass Candleholder — turned solid-brass candleholder',
    seoDescription: 'A turned solid-brass candleholder with a weighted base and wide drip dish.',
    productTypeKey: 'home_goods',
    attributes: {
      materials:
        'Turned from solid brass with a weighted base and a wide drip dish, sized for a standard dinner candle. Left unlacquered so it takes on a living patina.',
      dimensions: 'Ø 12 × H 9 cm',
      care: 'Peel cooled wax away by hand and wipe it clean; polish the brass to bring the shine back, or leave it to darken — both are right. Unlacquered brass patinas over time, exactly as it should.',
      origin: 'Made in our Oslo workshop',
    },
    variants: [{ sku: 'ATN-CANDLE', priceCents: money(89), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'brass-candleholder', isPrimary: true, alt: 'The Brass Candleholder' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'seating', name: 'Seating', description: 'Chairs, stools and benches.', featured: true },
    { handle: 'lighting', name: 'Lighting', description: 'Lamps and pendants.', featured: true },
    { handle: 'tabletop', name: 'Tabletop', description: 'Ceramic, stoneware and brass for the table.', featured: true },
    { handle: 'textiles', name: 'Textiles', description: 'Throws and cushions in wool and mohair.', featured: true },
    { handle: 'objects', name: 'Objects', description: 'The small things a room is made of.', featured: false },
  ],
  collections: [
    {
      handle: 'new-arrivals',
      name: 'New Arrivals',
      description: 'The latest pieces from the workshop.',
      type: 'manual',
      featured: true,
      productHandles: ['oak-lounge-chair', 'travertine-side-table', 'linen-floor-lamp', 'stoneware-vase-set', 'mohair-cushion'],
    },
    {
      handle: 'seating',
      name: 'Seating',
      description: 'Chairs and stools built to last a generation.',
      type: 'manual',
      featured: false,
      productHandles: ['oak-lounge-chair', 'walnut-turned-stool'],
    },
    {
      handle: 'lighting',
      name: 'Lighting',
      description: 'Warm, quiet light in linen and paper.',
      type: 'manual',
      featured: false,
      productHandles: ['linen-floor-lamp', 'paper-shade-pendant'],
    },
    {
      handle: 'tabletop',
      name: 'Tabletop',
      description: 'Hand-made objects a table earns over years.',
      type: 'manual',
      featured: false,
      productHandles: ['ceramic-carafe', 'stoneware-vase-set', 'cork-serving-tray', 'brass-candleholder'],
    },
    {
      handle: 'textiles',
      name: 'Textiles',
      description: 'Wool and mohair for the sofa and the bed.',
      type: 'manual',
      featured: false,
      productHandles: ['wool-throw', 'mohair-cushion', 'leather-magazine-sling'],
    },
  ],
  products: PRODUCTS,
};

// ── Content (the Atelier Journal) ────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'the-case-for-solid-oak',
    status: 'published',
    body: {
      title: 'The case for solid oak',
      excerpt: 'Why we build in solid timber when a veneer would cost a third as much — and how a chair earns its price back over thirty years.',
      featuredImage: { $asset: 'post-oak' },
      body: {
        type: 'doc',
        content: [
          para('A veneered panel and a solid board can look identical on the showroom floor. The difference shows up in year ten, when a knock that would have polished out of solid oak has instead chipped through a half-millimetre of face and exposed the chipboard underneath.'),
          h2('You are buying decades, not a season'),
          para('Solid timber can be sanded back, re-oiled, and repaired more or less forever. We size our joints so a chair can be taken apart and re-glued rather than thrown away, and we keep the same oak in stock for years so a replacement part matches the original.'),
          h2('It moves, and that is fine'),
          para('Wood breathes with the seasons — it always has. We build to allow for it rather than fight it, which is why our tops are not glued rigidly across their width. A hairline gap in February that closes again in July is the material doing exactly what it should.'),
          para('None of this is nostalgia. It is the cheapest way we know to own something good: buy once, keep it working, and hand it on.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'living-with-travertine',
    status: 'published',
    body: {
      title: 'Living with travertine',
      excerpt: 'Stone is not as precious as it looks. A short, practical guide to using a travertine table every day without worrying about it.',
      featuredImage: { $asset: 'post-materials' },
      body: {
        type: 'doc',
        content: [
          para('Travertine arrives with a reputation for being fussy, and it is mostly undeserved. It is a stone that has spent thousands of years being rained on; a glass of wine is not going to end it.'),
          h2('Seal it once, then relax'),
          para('An unfilled travertine top wants a penetrating sealer when it is new and again every year or two. That is the whole maintenance routine. Sealed, it shrugs off water rings and the occasional spill; you wipe it and move on.'),
          h2('The marks are the point'),
          para('Stone records the life of a room. A faint ring from a warm cup, a soft edge where hands have rested — these are not damage, they are the reason to own the real thing instead of a printed laminate that looks the same on day one and tired on day one thousand.'),
          para('Use it. Set your coffee down on it. It has survived worse than you.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'a-room-in-three-objects',
    status: 'published',
    body: {
      title: 'A room in three objects',
      excerpt: 'You do not furnish a room all at once. A study of one corner, built from a chair, a lamp and a stone table — and why that is enough.',
      featuredImage: { $asset: 'post-room' },
      body: {
        type: 'doc',
        content: [
          para('The best rooms we visit were never designed in one go. They were assembled, slowly, around a few things worth keeping — and everything else earned its place by being genuinely needed.'),
          h2('Start with where you sit'),
          para('A single good chair fixes a corner in place. Put a lamp beside it for the evenings and a small hard surface within arm’s reach for a cup and a book, and you have made somewhere to be — which is more than most fully furnished rooms manage.'),
          h2('Leave room to grow'),
          para('A corner that is finished is a corner that is closed. Three considered objects with space around them invite the next thing when it comes; a wall of furniture bought in a weekend never does.'),
          para('Buy less, choose better, and let the room fill itself over years. That is not a compromise — it is the plan.'),
        ],
      },
    },
  },
];

// ── Product detail (the magazine PDP) + Shop ─────────────────────────────────────
// Kith's PDP is a magazine spread: a big stacked image on the left, a calm sticky
// buy-box on the right — collection label, SERIF product title, price, a black
// full-width CTA, then a materials/care detail stack (DESIGN §6/§7). Ported to Atelier
// Nord: the same quiet two-column spread in the `atelier` theme, where `btn-primary` is the
// near-black mono fill Kith's `#000` CTA calls for and headings pick up the theme's Fraunces
// serif. Bound fields come from the shared PDP kit (correct `repeat('product')` scope +
// `item.*` binds). The detail stack is no longer hardcoded per template (a chair's care ≠ a
// stone table's): `pdpAttributes` repeats the routed piece's OWN typed `home_goods`
// attributes (docs/143) — materials, dimensions, care and made-in — and `pdpPolicyLinks`
// points at the real shipping/returns pages. The layout is ours.

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the big magazine image. Right: the calm serif buy column. */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-16', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          // The big stacked image (one bound primary — the storefront fills it per product).
          pdpImage(
            'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'
          ),
          // The sticky-calm buy column.
          el('div', 'flex flex-col gap-6 @3xl:py-4', {
            children: [
              el('div', 'flex flex-col gap-3', {
                children: [
                  // Collection label above the title — the Kith breadcrumb/label slot. A
                  // plain <p>, so the product title stays the page's one <h1>.
                  el('p', 'text-sm font-medium uppercase tracking-widest text-base-content', {
                    text: 'Atelier Nord',
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
                  // A real low-stock signal in the near-black mono primary — shown only when
                  // the routed piece is genuinely running low (small runs, so it happens).
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 rounded-field bg-primary px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary-content',
                    label: 'Low stock',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              // Qty + Add to cart — the near-black mono CTA (btn-primary in `atelier`).
              addToCartForm(),
              // The product's OWN typed attributes (materials / dimensions / care / made in),
              // repeated from `attributeSections` — real per-product copy, not a hardcoded stack.
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

/** The full magazine PDP — the buy region above a quiet "You may also like" carousel of
 *  same-collection pieces (`commerce.related`, the shared kit's default cross-sell). */
const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'You may also like' });

/** The Shop page's own editorial header, shown ABOVE the faceted catalogue core the harness
 *  appends. Serif display title + a single quiet intro line — the calm, gallery-like framing
 *  Kith gives its listing, in place of the generic "Shop / Everything we currently have". */
const SHOP: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el(
            'h1',
            'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl',
            { text: 'The full catalogue' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Every piece Atelier Nord currently makes — seating, lighting, tabletop and textiles, filtered and sorted however you like. Small runs, made to keep.',
          }),
        ],
      }),
    ],
  }),
];

// ── The remaining functional pages (bespoke framing over the shared cores) ───────
// Collections / Cart / Search each get Atelier Nord's own editorial masthead above the
// pinned, shoppable core the harness appends; the Journal index gets its own masthead over
// the shared linkable post grid. Same quiet paper-ground voice as the rest of the site.

/** A plain editorial page masthead — an `<h1>` + one intro line on the paper ground. Used
 *  for Collections / Search / Journal, which each want a calm header over their core. */
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
    'Seating, lighting, tabletop, textiles and the small objects a room is made of — grouped the way we think about a home, so you can start where you are furnishing.'
  ),
];

const SEARCH: Node[] = [
  pageMasthead(
    'Search the studio',
    'Looking for something specific — a material, a room, a piece you saw once? Search the whole catalogue and the Journal below.'
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
            { text: 'The Atelier Journal' }
          ),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the workshop — how a piece is made, how to live with the materials, and the thinking behind objects made to keep.',
          }),
        ],
      }),
    ],
  }),
];

/** The Cart page's own header — a warm reassurance band above the pinned cart core, in place
 *  of the generic "Your cart" heading. Made-to-order, insured shipping, thirty-day returns —
 *  the three things a considered-furniture buyer wants to read before they check out. */
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
            text: 'Everything here is made to order in our own workshop, crated by hand and shipped insured. Thirty days to return anything unused — take your time deciding.',
          }),
        ],
      }),
    ],
  }),
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'editorial-grid',
  key: 'sparx-editorial-grid',
  name: 'Editorial Grid',
  summary:
    'A magazine-quiet storefront for design furniture and objects — a full-bleed serif hero over a repeating editorial-band and shoppable-carousel rhythm, in a paper-ground mono theme. Modelled on the editorial-streetwear archetype; shipped as Atelier Nord.',
  tagline: 'An editorial, gallery-quiet template for makers of considered furniture and objects.',
  vertical: 'retail',
  industry: 'Design furniture & objects',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 100,
  brand: {
    businessName: 'Atelier Nord',
    tagline: 'Objects made to keep.',
  },
  // Kith chrome: a CENTERED wordmark with the nav split either side (`centerLogo`), NO
  // filled CTA in the bar (`showCta: false`), and the editorial "join our list" footer
  // (`newsletter`) whose bottom bar carries the live © business name.
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: false },
  seo: {
    home: {
      title: 'Atelier Nord — furniture & objects made to keep',
      description:
        'Atelier Nord makes furniture and objects for the considered home — oak, walnut, stone, wool and clay, made in small runs and built to outlast the season they arrive in.',
    },
    about: {
      title: 'About Atelier Nord — a small design studio',
      description:
        'The people, materials and workshop behind Atelier Nord — why we make in small runs, by hand, from materials that age into something better than they began.',
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
