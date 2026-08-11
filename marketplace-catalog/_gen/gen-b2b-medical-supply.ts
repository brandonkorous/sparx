// sparx-b2b-medical-supply — a B2B/WHOLESALE commerce site template: a medical, dental &
// clinical supplies distributor selling to TRADE BUYERS (clinics, practices, care homes).
//
// The clinical entry in the trade family: a complete, working wholesale shop the moment it
// installs — a real catalogue sold by the case/box (nitrile gloves, face masks, disinfectant
// wipes, gauze & dressings, syringes, gowns, hand sanitiser, thermometers, a clinic starter
// kit), categories + collections, a bespoke trade PDP with a pricing-&-terms note, and the
// full 9-page commerce site (home merchandising → shop → collections → cart → search →
// journal → about → contact), dressed in an INLINE bespoke theme (crisp cool-teal ground,
// calm medical-blue primary, teal signal accent, a clean grotesk). Shipped as Meridian
// Medical Supplies.
//
// SELF-CONTAINED BY DESIGN. A trade-family generator carries its OWN theme inline and passes
// it on the spec (`theme`), so the whole family can be authored in parallel without any two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-medical-supply.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-medical-supply/**" \
//     "marketplace-catalog/_gen/gen-b2b-medical-supply.ts"
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
// A clinical distributor: a crisp cool-white paper ground with a faint teal tint, deep
// blue-slate ink, a calm medical-blue primary and a teal signal accent, under a clean grotesk
// over a humanist sans. Complete light + dark, AA on every role (the blueprint sweep's
// contrast check is the gate). The accent is a DEEP teal (~48% L) so it stays legible as
// link/label text on the light ground, and the secondary is a dark slate so labels never
// wash out.
const THEME = defineTheme({
  name: 'meridian-med',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.375rem', field: '0.375rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: ['oklch(98% 0.008 210)', 'oklch(95% 0.012 205)', 'oklch(90% 0.016 200)', 'oklch(24% 0.03 235)'],
    roles: {
      primary: 'oklch(45% 0.10 240)',
      secondary: 'oklch(43% 0.03 225)',
      accent: 'oklch(48% 0.11 195)',
      neutral: 'oklch(27% 0.02 235)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(23% 0.02 235)', 'oklch(19% 0.02 235)', 'oklch(16% 0.02 235)', 'oklch(96% 0.008 210)'],
    roles: {
      primary: 'oklch(72% 0.09 235)',
      secondary: 'oklch(78% 0.03 225)',
      accent: 'oklch(74% 0.11 195)',
      neutral: 'oklch(32% 0.02 235)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "med-hero": "https://images.unsplash.com/photo-1603398938378-e54eab446dde?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm93cyUyMG1lZGljYWwlMjBzdXBwbGllc3xlbnwwfDB8fHwxNzg2NDIyMzc2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "med-tile-ppe": "https://images.unsplash.com/photo-1607227063002-677dc5fdf96f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94ZXMlMjBuaXRyaWxlJTIwZ2xvdmVzJTIwZmFjZSUyMG1hc2tzJTIwc3VwcGx5JTIwc2hlbGZ8ZW58MHwwfHx8MTc4NjQyMjIwOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "med-tile-consumables": "https://images.unsplash.com/photo-1561328635-c1c6ad1753b0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RlcmlsZSUyMHN5cmluZ2VzJTIwY2xpbmljYWx8ZW58MHwwfHx8MTc4NjQyMjM4MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "med-tile-woundcare": "https://images.unsplash.com/photo-1609840533741-62c180d0be79?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFja3MlMjBzdGVyaWxlJTIwZ2F1emUlMjBhZGhlc2l2ZSUyMGRyZXNzaW5nc3xlbnwwfDB8fHwxNzg2NDIyMjEzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "med-tile-infection": "https://images.unsplash.com/photo-1583947582886-f40ec95dd752?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGlzaW5mZWN0YW50JTIwd2lwZXMlMjBoYW5kfGVufDB8MHx8fDE3ODY0MjIzODN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "med-band-trade": "https://images.unsplash.com/photo-1741275269731-83526786bb93?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3VwcGxpZXIlMjBwYWNraW5nJTIwY2xpbmljfGVufDB8MHx8fDE3ODY0MjIzODZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-gloves": "https://images.unsplash.com/photo-1628235176517-71013205a2de?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGJsdWUlMjBuaXRyaWxlfGVufDB8MHx8fDE3ODY0MjIzODl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-masks": "https://images.unsplash.com/photo-1597440658768-f3ffdf64223c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwZWFyLWxvb3AlMjBwcm9jZWR1cmUlMjBmYWNlJTIwbWFza3N8ZW58MHwwfHx8MTc4NjQyMjIyM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-wipes": "https://images.unsplash.com/photo-1628177142898-93e36e4e3a50?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMHN1cmZhY2UlMjBkaXNpbmZlY3RhbnR8ZW58MHwwfHx8MTc4NjQyMjM5Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-gauze": "https://images.unsplash.com/photo-1672985020068-75281fd2a8d2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwc3RlcmlsZSUyMGdhdXplJTIwc3dhYnN8ZW58MHwwfHx8MTc4NjQyMjIyOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-syringes": "https://images.unsplash.com/photo-1605109015365-9921914f9eb0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMHN0ZXJpbGUlMjBsdWVyLWxvY2t8ZW58MHwwfHx8MTc4NjQyMjM5NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-gowns": "https://images.unsplash.com/photo-1591611003243-76ff23413796?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGRpc3Bvc2FibGUlMjBpc29sYXRpb258ZW58MHwwfHx8MTc4NjQyMjM5OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-sanitiser": "https://images.unsplash.com/photo-1785061381923-1875465d45a4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGFsY29ob2wlMjBoYW5kJTIwc2FuaXRpc2VyJTIwZ2VsJTIwYm90dGxlc3xlbnwwfDB8fHwxNzg2NDIyMjM3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-thermometer": "https://images.unsplash.com/photo-1594790628624-9e563bea851d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwZGlnaXRhbCUyMGNsaW5pY2FsJTIwdGhlcm1vbWV0ZXJzfGVufDB8MHx8fDE3ODY0MjIyNDB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-dressings": "https://images.unsplash.com/photo-1776047129625-50b8c7299705?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Ym94JTIwYWRoZXNpdmUlMjB3b3VuZCUyMGRyZXNzaW5nc3xlbnwwfDB8fHwxNzg2NDIyMjQzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-infection-control": "https://images.unsplash.com/photo-1627905646269-7f034dcc5738?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xpbmljaWFuJTIwY2xlYW5pbmclMjBzdXJmYWNlJTIwZGlzaW5mZWN0YW50JTIwd2lwZXxlbnwwfDB8fHwxNzg2NDIyMjQ5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-ppe": "https://images.unsplash.com/photo-1599412227383-b7d4751c8765?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FyZSUyMHdvcmtlciUyMHB1bGxpbmclMjBuaXRyaWxlJTIwZXhhbWluYXRpb24lMjBnbG92ZXN8ZW58MHwwfHx8MTc4NjQyMjI1Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'med-hero', url: src('med-hero'), alt: 'Rows of medical supplies on organised shelving in a clinical stockroom' },
  { id: 'med-tile-ppe', url: src('med-tile-ppe'), alt: 'Boxes of nitrile gloves and face masks on a supply shelf' },
  { id: 'med-tile-consumables', url: src('med-tile-consumables'), alt: 'Sterile syringes and clinical consumables in trays' },
  { id: 'med-tile-woundcare', url: src('med-tile-woundcare'), alt: 'Packs of sterile gauze and adhesive dressings' },
  { id: 'med-tile-infection', url: src('med-tile-infection'), alt: 'Disinfectant wipes and hand sanitiser at a hygiene station' },
  { id: 'med-band-trade', url: src('med-band-trade'), alt: 'A supplier packing a clinic order for dispatch from a warehouse' },
  { id: 'prod-gloves', url: src('prod-gloves'), alt: 'A case of blue nitrile examination gloves' },
  { id: 'prod-masks', url: src('prod-masks'), alt: 'A box of ear-loop procedure face masks' },
  { id: 'prod-wipes', url: src('prod-wipes'), alt: 'A case of surface disinfectant wipe canisters' },
  { id: 'prod-gauze', url: src('prod-gauze'), alt: 'A box of sterile gauze swabs' },
  { id: 'prod-syringes', url: src('prod-syringes'), alt: 'A case of sterile luer-lock syringes' },
  { id: 'prod-gowns', url: src('prod-gowns'), alt: 'A case of disposable isolation gowns' },
  { id: 'prod-sanitiser', url: src('prod-sanitiser'), alt: 'A case of alcohol hand sanitiser gel bottles' },
  { id: 'prod-thermometer', url: src('prod-thermometer'), alt: 'A box of digital clinical thermometers' },
  { id: 'prod-dressings', url: src('prod-dressings'), alt: 'A box of adhesive wound dressings' },
  { id: 'prod-starter-kit', url: src('prod-starter-kit'), alt: 'A clinic starter kit of essential consumables' },
  { id: 'post-infection-control', url: src('post-infection-control'), alt: 'A clinician cleaning a surface with a disinfectant wipe' },
  { id: 'post-ppe', url: src('post-ppe'), alt: 'A care worker pulling on nitrile examination gloves' },
  { id: 'post-stockroom', url: src('post-stockroom'), alt: 'A well-organised clinical stockroom with labelled bins' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-b2b-medical-supply: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one clinical stockroom photograph, a grotesk headline and a lead in a
 *  solid readable panel anchored bottom-left, a filled shop CTA + a trade-account link. The
 *  link carries the "Open a trade account" call the platform navbar CTA also points at
 *  (/contact). Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('med-hero'), alt: 'A clinical stockroom of medical supplies', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Every consumable your practice runs on, in stock and compliant.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Meridian is a medical, dental and clinical supplies distributor. We stock the gloves, masks, wound care, infection-control and diagnostics a clinic gets through every day — sold by the case, priced for the trade, traceable by lot, and dispatched next day.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the catalog' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/contact' },
                      text: 'Open a trade account',
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
            text: 'Shop by department',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'med-tile-ppe', label: 'PPE', href: '/shop', alt: 'Nitrile gloves and face masks' }),
              categoryTile({ assetId: 'med-tile-consumables', label: 'Consumables', href: '/shop', alt: 'Sterile syringes and clinical consumables' }),
              categoryTile({ assetId: 'med-tile-woundcare', label: 'Wound care', href: '/shop', alt: 'Sterile gauze and adhesive dressings' }),
              categoryTile({ assetId: 'med-tile-infection', label: 'Infection control', href: '/shop', alt: 'Disinfectant wipes and hand sanitiser' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The trade-terms band — pure COPY, no photo. Four cards spell out how wholesale ordering
 *  works here: per-case contract pricing, net-30 for approved accounts, lot traceability &
 *  compliance, and a named account manager. The tenant configures the real B2B pricing tiers,
 *  approval rules and terms in the Commerce module; this band SELLS the arrangement. */
function tradeTermsBand(): Node {
  const card = (title: string, body: string): Node =>
    el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
      children: [
        el('h3', 'text-lg font-bold tracking-wide text-base-content', { text: title }),
        el('p', 'text-base leading-relaxed text-base-content', { text: body }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('div', 'flex max-w-2xl flex-col gap-4', {
            children: [
              el('h2', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl', {
                text: 'Built for the way a practice orders',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Open a trade account and you buy the way a clinic should — by the case, at contract rates, on terms, with the paperwork a regulated practice needs. No consumer markups, no chasing three suppliers.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              card('Contract pricing', 'Per-case wholesale rates with volume breaks that deepen as your standing order grows. The more the practice gets through, the less each case costs.'),
              card('Net-30 terms', 'Approved accounts order now and settle on net-30 — keep the treatment rooms stocked without tying up the card on every reorder.'),
              card('Compliant & traceable', 'Lot-numbered stock with certificates of conformity on file, so a recall or an audit is a lookup, not a scramble. Everything CE / regulatory marked.'),
              card('Your account manager', 'A direct line to a real person who knows your practice, your standing order and what you go through — not a ticket queue.'),
            ],
          }),
          el('a', 'btn btn-primary btn-lg w-fit', { attrs: { href: '/contact' }, text: 'Open a trade account' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Ordered most by practices' }),
  tradeTermsBand(),
  productsBlock({ source: 'commerce.category.infection-control', layout: 'carousel', heading: 'Infection control, always in stock' }),
  editorialBand({
    heading: 'One supplier, one invoice, one account manager',
    lead: 'Consolidate the scattered orders your rooms place across a dozen suppliers into one trade account. One catalog to buy from, one statement to reconcile, and one person who picks up the phone when a line is short or an audit is due.',
    assetId: 'med-band-trade',
    cta: 'Open a trade account',
    href: '/contact',
    alt: 'A supplier packing a clinic order for dispatch',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (vendor label, title, per-case price,
 *  low-stock, description, pack/size options + add-to-cart, a static "Trade pricing & terms"
 *  note with volume breaks + net-30 + traceability, and policy links). */
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
                    text: 'Meridian Medical Supplies',
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
              el('div', 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Trade pricing & terms' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'The price shown is the per-case list rate. Trade accounts unlock volume breaks — deeper per-case pricing on a pallet, a bulk drop, or a standing order — set for your account in your dashboard.',
                  }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Every case is lot-numbered and CE / regulatory marked, with certificates of conformity on file for audit. Approved accounts buy on net-30 — open a trade account and we will price your regular lines and get you on terms.',
                  }),
                  el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                    attrs: { href: '/contact' },
                    text: 'Open a trade account',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Ordered together' });

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
    'The catalog',
    'Every line we stock — PPE, clinical consumables, wound care and infection control, sold by the case. Filter by department or sort by price; trade accounts see their contract pricing and lot traceability at checkout.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The catalog grouped the way a practice manager actually reorders — the lines ordered most, new lines just in, the everyday essentials, infection-prevention supplies, wound care, and the bulk consumables you put on a standing order.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search the catalog', 'Know the product, the size, or the code you need? Search the whole catalog and the practice notes below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Review the cases in your order before you check out. Trade accounts see contract pricing and net-30 terms applied here; everyone gets next-day dispatch on in-stock lines and a lot-numbered packing note for your records. Need a formal quote instead? Your account manager can turn one around.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Practice notes' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Practical guidance for the people who run the supply cupboard — how to keep an infection-control stock, spec gloves and PPE a team will actually wear, and never run a treatment room dry. Written for practice managers, not for a catalog.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Meridian' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Meridian Medical Supplies is a medical, dental and clinical supplies distributor. We stock the everyday, essential lines that keep a GP surgery, a dental practice or a care home running — and we sell them to the trade by the case, at wholesale, on terms, with the traceability a regulated practice needs.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We built the business around one idea: a practice manager should not have to chase a dozen suppliers, eat consumer markups, or wonder whether a box of gloves will clear an audit. One catalog, one account, one invoice, lot-numbered stock, and shelves that are actually full when you order.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No minimum-order gymnastics, no mystery lead times, no compliance grey areas. Just the supplies your rooms depend on — CE marked, certified, priced fairly and out the door next day. The quiet reliability a practice is built on.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Open a trade account' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Tell us what your practice gets through and we will price your regular lines, set you up on net-30 terms, and put a name and a number to your account. Wholesale enquiries, standing orders, compliance documentation and bulk quotes all start here.',
          }),
          el('a', 'btn btn-primary btn-lg', { attrs: { href: 'mailto:trade@meridianmedical.example' }, text: 'Email the trade desk' }),
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

const VENDOR = 'Meridian Medical Supplies';

/** A single-SKU case/box line — one price, no options (most consumables ship one pack size). */
const caseItem = (opts: {
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
  vendor: VENDOR,
  tags: opts.tags,
  categoryHandles: opts.categories,
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  variants: [{ sku: opts.sku, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue' }],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const PRODUCTS: Product[] = [
  {
    handle: 'nitrile-exam-gloves-case',
    title: 'Nitrile Exam Gloves, 4-mil — Case of 1000',
    description:
      'Powder-free blue nitrile examination gloves, 4-mil, textured fingertips, AQL 1.5 — the everyday clinical glove for exams, treatment and handling. Case of 1000 (10 boxes of 100). MOQ 1 case. Pick your size; stock the full size run so no room is caught short.',
    status: 'active',
    productType: 'PPE',
    vendor: VENDOR,
    tags: ['ppe', 'gloves', 'nitrile', 'exam', 'consumable'],
    categoryHandles: ['ppe'],
    collectionHandles: ['best-sellers', 'everyday-essentials', 'bulk-consumables'],
    seoTitle: 'Nitrile Exam Gloves 4-mil, Case of 1000 | Meridian Medical',
    seoDescription: 'Powder-free blue nitrile examination gloves, 4-mil, AQL 1.5, case of 1000. Sizes S–XL, sold by the case.',
    options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: 'Small' }, { value: 'Medium' }, { value: 'Large' }, { value: 'X-Large' }] }],
    variants: [
      { sku: 'MMS-PPE-NITR-S', priceCents: money(64), inventoryPolicy: 'continue', optionValues: { Size: 'Small' } },
      { sku: 'MMS-PPE-NITR-M', priceCents: money(64), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Medium' } },
      { sku: 'MMS-PPE-NITR-L', priceCents: money(64), inventoryPolicy: 'continue', optionValues: { Size: 'Large' } },
      { sku: 'MMS-PPE-NITR-XL', priceCents: money(68), inventoryPolicy: 'continue', optionValues: { Size: 'X-Large' } },
    ],
    images: [{ assetId: 'prod-gloves', isPrimary: true, alt: 'A case of blue nitrile examination gloves' }],
  },
  caseItem({
    handle: 'procedure-face-masks-box',
    title: 'Procedure Face Masks, Type IIR — Box of 50',
    description:
      'Type IIR fluid-resistant ear-loop procedure masks, 3-ply with an adjustable nose wire, EN 14683 tested. Box of 50. MOQ 10 boxes — buy the outer and keep every treatment room and reception stocked.',
    price: 8.5,
    sku: 'MMS-PPE-MASK-50',
    productType: 'PPE',
    categories: ['ppe'],
    collections: ['best-sellers', 'infection-prevention', 'everyday-essentials'],
    tags: ['ppe', 'masks', 'type-iir', 'infection-control', 'consumable'],
    asset: 'prod-masks',
    seoTitle: 'Procedure Face Masks Type IIR, Box of 50 | Meridian Medical',
    seoDescription: 'Type IIR fluid-resistant 3-ply ear-loop procedure masks, EN 14683, box of 50. Sold by the box.',
  }),
  caseItem({
    handle: 'disinfectant-wipes-case',
    title: 'Surface Disinfectant Wipes — Case of 12',
    description:
      'Alcohol-free bactericidal, virucidal and fungicidal surface wipes — effective against enveloped viruses, EN 14476 compliant, for daily clinical surface and equipment cleaning. Case of 12 canisters (200 wipes each). MOQ 1 case.',
    price: 41,
    sku: 'MMS-IC-WIPES-12',
    productType: 'Infection control',
    categories: ['infection-control'],
    collections: ['best-sellers', 'infection-prevention', 'bulk-consumables'],
    tags: ['infection-control', 'disinfectant', 'wipes', 'cleaning', 'consumable'],
    asset: 'prod-wipes',
    seoTitle: 'Surface Disinfectant Wipes, Case of 12 | Meridian Medical',
    seoDescription: 'Alcohol-free bactericidal, virucidal surface wipes, EN 14476, case of 12 canisters of 200. Daily clinical cleaning.',
  }),
  {
    handle: 'sterile-gauze-swabs-box',
    title: 'Sterile Gauze Swabs — Box of 100',
    description:
      'Sterile 8-ply 100% cotton gauze swabs, individually wrapped, highly absorbent and low-linting for wound cleaning, dressing and prep. Box of 100. MOQ 5 boxes. Choose the swab size your procedures call for.',
    status: 'active',
    productType: 'Wound care',
    vendor: VENDOR,
    tags: ['wound-care', 'gauze', 'sterile', 'dressing', 'consumable'],
    categoryHandles: ['wound-care'],
    collectionHandles: ['wound-care-supplies', 'everyday-essentials'],
    seoTitle: 'Sterile Gauze Swabs, Box of 100 | Meridian Medical',
    seoDescription: 'Sterile 8-ply cotton gauze swabs, individually wrapped, box of 100. Sizes 5×5cm to 10×10cm, sold by the box.',
    options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: '5 × 5 cm' }, { value: '7.5 × 7.5 cm' }, { value: '10 × 10 cm' }] }],
    variants: [
      { sku: 'MMS-WC-GAUZE-5', priceCents: money(11), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '5 × 5 cm' } },
      { sku: 'MMS-WC-GAUZE-75', priceCents: money(14), inventoryPolicy: 'continue', optionValues: { Size: '7.5 × 7.5 cm' } },
      { sku: 'MMS-WC-GAUZE-10', priceCents: money(17), inventoryPolicy: 'continue', optionValues: { Size: '10 × 10 cm' } },
    ],
    images: [{ assetId: 'prod-gauze', isPrimary: true, alt: 'A box of sterile gauze swabs' }],
  },
  {
    handle: 'luer-lock-syringes-case',
    title: 'Luer-Lock Syringes — Case of 800',
    description:
      'Sterile single-use luer-lock syringes with a clear barrel and bold graduations, latex-free, for accurate dosing and irrigation. Case of 800 (8 boxes of 100). MOQ 1 case. Pick the volume your clinic uses most.',
    status: 'active',
    productType: 'Consumables',
    vendor: VENDOR,
    tags: ['consumables', 'syringes', 'luer-lock', 'sterile', 'diagnostics'],
    categoryHandles: ['consumables'],
    collectionHandles: ['everyday-essentials', 'bulk-consumables'],
    seoTitle: 'Luer-Lock Syringes, Case of 800 | Meridian Medical',
    seoDescription: 'Sterile single-use luer-lock syringes, latex-free, case of 800. 3 mL, 5 mL or 10 mL, sold by the case.',
    options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: '3 mL' }, { value: '5 mL' }, { value: '10 mL' }] }],
    variants: [
      { sku: 'MMS-CON-SYR-3', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '3 mL' } },
      { sku: 'MMS-CON-SYR-5', priceCents: money(62), inventoryPolicy: 'continue', optionValues: { Size: '5 mL' } },
      { sku: 'MMS-CON-SYR-10', priceCents: money(74), inventoryPolicy: 'continue', optionValues: { Size: '10 mL' } },
    ],
    images: [{ assetId: 'prod-syringes', isPrimary: true, alt: 'A case of sterile luer-lock syringes' }],
  },
  {
    handle: 'isolation-gowns-case',
    title: 'Disposable Isolation Gowns — Case of 50',
    description:
      'Fluid-resistant AAMI Level 2 disposable isolation gowns with knit cuffs and full back coverage — single-use protection for examinations, procedures and infection-control precautions. Case of 50. MOQ 2 cases. Choose the fit.',
    status: 'active',
    productType: 'PPE',
    vendor: VENDOR,
    tags: ['ppe', 'gowns', 'isolation', 'infection-control', 'consumable'],
    categoryHandles: ['ppe'],
    collectionHandles: ['new-in', 'infection-prevention'],
    seoTitle: 'Disposable Isolation Gowns, Case of 50 | Meridian Medical',
    seoDescription: 'Fluid-resistant AAMI Level 2 disposable isolation gowns, knit cuffs, case of 50. Regular or Large, sold by the case.',
    options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: 'Regular' }, { value: 'Large' }] }],
    variants: [
      { sku: 'MMS-PPE-GOWN-R', priceCents: money(112), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Regular' } },
      { sku: 'MMS-PPE-GOWN-L', priceCents: money(118), inventoryPolicy: 'continue', optionValues: { Size: 'Large' } },
    ],
    images: [{ assetId: 'prod-gowns', isPrimary: true, alt: 'A case of disposable isolation gowns' }],
  },
  caseItem({
    handle: 'hand-sanitiser-case',
    title: 'Alcohol Hand Sanitiser Gel, 500 mL — Case of 12',
    description:
      '70% alcohol hand sanitiser gel with added emollient to protect skin through repeated use, EN 1500 hygienic hand-rub compliant, in a 500 mL pump bottle. Case of 12. MOQ 2 cases — stock every room, station and reception desk.',
    price: 46,
    sku: 'MMS-IC-SAN-12',
    productType: 'Infection control',
    categories: ['infection-control'],
    collections: ['best-sellers', 'infection-prevention', 'bulk-consumables'],
    tags: ['infection-control', 'hand-sanitiser', 'hygiene', 'consumable'],
    asset: 'prod-sanitiser',
    seoTitle: 'Alcohol Hand Sanitiser Gel 500 mL, Case of 12 | Meridian Medical',
    seoDescription: '70% alcohol hand sanitiser gel with emollient, EN 1500, 500 mL pump, case of 12. Sold by the case.',
  }),
  caseItem({
    handle: 'digital-thermometers-box',
    title: 'Digital Clinical Thermometers — Box of 12',
    description:
      'Fast-read digital clinical thermometers with a flexible tip, fever alarm and last-reading memory, CE marked for clinical use. Box of 12 with spare batteries. MOQ 2 boxes — a reliable diagnostic every room should have to hand.',
    price: 54,
    sku: 'MMS-CON-THERM-12',
    productType: 'Consumables',
    categories: ['consumables'],
    collections: ['new-in', 'everyday-essentials'],
    tags: ['consumables', 'thermometer', 'diagnostics', 'clinical'],
    asset: 'prod-thermometer',
    seoTitle: 'Digital Clinical Thermometers, Box of 12 | Meridian Medical',
    seoDescription: 'Fast-read digital clinical thermometers, flexible tip, fever alarm, CE marked, box of 12. Sold by the box.',
  }),
  caseItem({
    handle: 'adhesive-wound-dressings-box',
    title: 'Adhesive Wound Dressings — Box of 100',
    description:
      'Sterile individually wrapped adhesive island dressings with a low-adherent absorbent pad and a breathable, water-resistant border — for minor wounds, post-procedure cover and everyday first aid. Box of 100. MOQ 5 boxes.',
    price: 19,
    sku: 'MMS-WC-DRESS-100',
    productType: 'Wound care',
    categories: ['wound-care'],
    collections: ['wound-care-supplies', 'everyday-essentials', 'bulk-consumables'],
    tags: ['wound-care', 'dressings', 'adhesive', 'sterile', 'consumable'],
    asset: 'prod-dressings',
    seoTitle: 'Adhesive Wound Dressings, Box of 100 | Meridian Medical',
    seoDescription: 'Sterile adhesive island wound dressings, breathable water-resistant border, box of 100. Sold by the box.',
  }),
  caseItem({
    handle: 'clinic-starter-kit',
    title: 'Clinic Starter Kit',
    description:
      'A curated kit of the consumables a new practice or satellite clinic runs out of first — nitrile gloves, procedure masks, disinfectant wipes, hand sanitiser, sterile gauze and adhesive dressings, packed together and priced below the sum of its cases. MOQ 1 kit. The fastest way to stock a treatment room from empty.',
    price: 179,
    sku: 'MMS-KIT-CLINIC-STARTER',
    productType: 'Consumables',
    categories: ['consumables'],
    collections: ['new-in', 'everyday-essentials'],
    tags: ['consumables', 'kit', 'starter', 'bundle'],
    asset: 'prod-starter-kit',
    seoTitle: 'Clinic Starter Kit | Meridian Medical',
    seoDescription: 'A curated starter kit of essential clinical consumables — gloves, masks, wipes, sanitiser, gauze and dressings, priced below the sum.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'ppe', name: 'PPE', description: 'Gloves, masks, gowns and personal protective equipment.', featured: true },
    { handle: 'consumables', name: 'Consumables', description: 'Syringes, thermometers and everyday clinical consumables.', featured: true },
    { handle: 'wound-care', name: 'Wound care', description: 'Gauze, dressings and wound-care supplies.', featured: true },
    { handle: 'infection-control', name: 'Infection control', description: 'Disinfectant wipes, hand sanitiser and hygiene supplies.', featured: true },
  ],
  collections: [
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The lines practices reorder most.',
      type: 'manual',
      featured: true,
      productHandles: ['nitrile-exam-gloves-case', 'procedure-face-masks-box', 'disinfectant-wipes-case', 'hand-sanitiser-case'],
    },
    {
      handle: 'new-in',
      name: 'New in',
      description: 'Lines just added to the catalog.',
      type: 'manual',
      featured: true,
      productHandles: ['isolation-gowns-case', 'digital-thermometers-box', 'clinic-starter-kit'],
    },
    {
      handle: 'everyday-essentials',
      name: 'Everyday essentials',
      description: 'The consumables no treatment room runs without.',
      type: 'manual',
      featured: false,
      productHandles: ['nitrile-exam-gloves-case', 'procedure-face-masks-box', 'sterile-gauze-swabs-box', 'luer-lock-syringes-case', 'digital-thermometers-box', 'adhesive-wound-dressings-box', 'clinic-starter-kit'],
    },
    {
      handle: 'infection-prevention',
      name: 'Infection prevention',
      description: 'Protect the team, keep the practice clean.',
      type: 'manual',
      featured: false,
      productHandles: ['procedure-face-masks-box', 'disinfectant-wipes-case', 'hand-sanitiser-case', 'isolation-gowns-case'],
    },
    {
      handle: 'wound-care-supplies',
      name: 'Wound care',
      description: 'Gauze, dressings and everything to dress a wound.',
      type: 'manual',
      featured: false,
      productHandles: ['sterile-gauze-swabs-box', 'adhesive-wound-dressings-box'],
    },
    {
      handle: 'bulk-consumables',
      name: 'Bulk consumables',
      description: 'Buy the case, reorder on a standing order.',
      type: 'manual',
      featured: false,
      productHandles: ['nitrile-exam-gloves-case', 'disinfectant-wipes-case', 'hand-sanitiser-case', 'luer-lock-syringes-case', 'adhesive-wound-dressings-box'],
    },
  ],
  products: PRODUCTS,
};

// ── Content (practice notes) ─────────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'set-up-a-clinical-stockroom',
    status: 'published',
    body: {
      title: 'How to set up a clinical stockroom that never runs dry',
      excerpt: 'An empty glove box mid-clinic stops a room cold. Here is a simple min/max system any practice can run to make sure the case is on the shelf before the last one is gone — and that every lot is traceable.',
      featuredImage: { $asset: 'post-stockroom' },
      body: {
        type: 'doc',
        content: [
          para('A clinical stockroom exists to do one thing: make sure the supply is there the moment a clinician needs it. Get it wrong and a box of gloves that costs a few pounds holds up a fully booked clinic. The good news is that keeping it right does not take software or a full-time storekeeper — it takes a min/max system, labelled bins, and the discipline to follow them.'),
          h2('Set a min and a max for every line'),
          para('For each consumable, decide two numbers. The MIN is the reorder point — the quantity that should trigger a new order, set high enough to cover your usage over the lead time so you never hit zero while a case is in transit. The MAX is how much you hold at full — enough to buy at a sensible case price without turning the shelf into dead stock or risking expiry. When stock drops to the min, you order back up to the max. That is the whole system.'),
          h2('Rotate by expiry, and keep the lot numbers'),
          para('Clinical stock expires, so first-in, first-out is not optional — put the newest cases at the back and pull from the front. Keep the lot number and expiry on every line you hold; if a product is ever recalled, you want to answer "do we have any, and where is it?" with a lookup, not an afternoon emptying cupboards. A supplier that lot-numbers its dispatch notes makes this almost automatic.'),
          h2('Put the fast movers on a standing order'),
          para('The lines you get through on a predictable schedule — gloves, masks, wipes, sanitiser — do not need re-deciding every month. Put them on a standing order with your supplier and they arrive before you run out, priced for the volume. Reserve your attention for the exceptions, and let the boring reliable lines take care of themselves.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'a-practical-guide-to-infection-control-supplies',
    status: 'published',
    body: {
      title: 'A practical guide to infection-control supplies',
      excerpt: 'Hand hygiene and surface cleaning only work if the products are the right spec and always within reach. Here is how to stock an infection-control cupboard that holds up to an inspection.',
      featuredImage: { $asset: 'post-infection-control' },
      body: {
        type: 'doc',
        content: [
          para('Infection control is a chain, and it is only as strong as its weakest, emptiest dispenser. A practice can have a spotless policy on paper and still slip if the sanitiser bottle by the door has been empty for a week. Getting the supplies right — the correct spec, in enough quantity, always within reach — is what turns a policy into practice.'),
          h2('Hand hygiene: mind the standard, not just the smell'),
          para('For a clinical hand rub, look past the fragrance to the standard. An alcohol gel around 70% that meets EN 1500 is the benchmark for hygienic hand disinfection; added emollient matters just as much, because skin that cracks from over-washing is skin people stop cleaning. Place a bottle at every point of care and every entrance, and stock enough that a dispenser is refilled the moment it runs low, not next week.'),
          h2('Surface disinfection: match the wipe to the claim'),
          para('Not every wipe does every job. For clinical surfaces you want a wipe with a proven virucidal claim — EN 14476 against enveloped viruses is the one to look for — and a realistic contact time your team can actually keep to. Keep a canister in every room, and buy them by the case so the "we are out of wipes" note never appears on the whiteboard.'),
          h2('The rule of thumb: never ration protection'),
          para('The quiet failure mode is running low and rationing — one canister guarded across three rooms, a sanitiser bottle nursed to the last drop. Buy infection-control consumables by the case at trade pricing and they are always there, always in date, and never the thing standing between a clinician and a clean, safe room.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'choosing-gloves-and-ppe-your-team-will-wear',
    status: 'published',
    body: {
      title: 'Choosing gloves and PPE your team will actually wear',
      excerpt: 'PPE only protects people if it fits, holds up, and is always in the drawer. Here is how to spec gloves and masks a clinical team keeps on — and buy them so you never have to ration.',
      featuredImage: { $asset: 'post-ppe' },
      body: {
        type: 'doc',
        content: [
          para('The best PPE is the set your team does not fight against. Plenty of practices buy protection so thin, so ill-fitting or so scarce that people work around it — and then wonder why compliance slips. Spec it right and buy it in volume, and the safe choice becomes the easy one.'),
          h2('Gloves: mind the mil and the fit'),
          para('For general examination and treatment, a 4-mil powder-free nitrile glove is the everyday standard — strong enough to resist tears and hold up to alcohol and fluids, thin enough to keep the tactile feel a clinician needs. Powder-free avoids contamination and reactions, and getting the SIZE right matters more than people admit: a glove too big snags and slips, one too small tears at the knuckle. Stock small through extra-large so nobody is stuck with the wrong fit.'),
          h2('Masks: match the type to the task'),
          para('For clinical procedures where splash is a risk, a Type IIR fluid-resistant mask tested to EN 14683 is the benchmark — three-ply, with a nose wire that actually seals and ear loops that do not pinch through a shift. Keep the reception and treatment rooms stocked from the same box, and replace masks freely rather than stretching one across a morning.'),
          h2('Buy it in volume so you never ration it'),
          para('The failure mode is always the same — a single box guarded like gold, protection made scarce by the purchasing, not the policy. Buy gloves and masks by the case at trade pricing and they are always there, always fresh, and never the reason a corner gets cut on a busy day.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'b2b-medical-supply',
  key: 'sparx-b2b-medical-supply',
  name: 'sparx — Medical Supply (B2B / Wholesale)',
  theme: THEME,
  summary:
    'A complete, working wholesale shop for a medical, dental & clinical supplies distributor: a real trade catalogue sold by the case — PPE, consumables, wound care and infection control — with categories, collections, a bespoke trade PDP (per-case pricing, volume breaks, net-30, lot traceability), and a full merchandised home page. Clean clinical theme — crisp cool ground, calm medical-blue, a teal accent. Shipped as Meridian Medical Supplies.',
  tagline: 'A wholesale storefront built for clinics and practices.',
  vertical: 'b2b',
  industry: 'Medical & clinical supply',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 85,
  brand: {
    businessName: 'Meridian Medical Supplies',
    tagline: 'Compliant, traceable, in stock — everything a practice needs on one account.',
  },
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Meridian Medical Supplies — medical, dental & clinical distributor',
      description:
        'Meridian is a medical, dental and clinical supplies distributor — PPE, consumables, wound care and infection control sold by the case at trade prices, lot-traceable, with net-30 terms and next-day dispatch. Open a trade account.',
    },
    about: {
      title: 'About Meridian Medical Supplies',
      description:
        'How Meridian stocks, prices and ships — one catalog, one account, one invoice, wholesale by the case, lot-numbered and CE marked, with stock that is actually on the shelf when you order it.',
    },
    contact: {
      title: 'Open a trade account — Meridian Medical Supplies',
      description:
        'Set up a trade account with Meridian: wholesale per-case pricing, volume breaks, net-30 terms, compliance documentation and a dedicated account manager. Wholesale enquiries and bulk quotes start here.',
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
