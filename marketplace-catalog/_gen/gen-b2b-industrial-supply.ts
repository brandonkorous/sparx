// sparx-b2b-industrial-supply — a B2B/WHOLESALE commerce site template: an industrial
// MRO (maintenance, repair & operations) distributor selling to TRADE BUYERS.
//
// The gold reference for the trade family: a complete, working wholesale shop the moment it
// installs — a real catalogue sold by the case/box/pallet (fasteners, abrasives, safety, bulk
// consumables), categories + collections, a bespoke trade PDP with a pricing-&-terms note,
// and the full 9-page commerce site (home merchandising → shop → collections → cart → search →
// journal → about → contact), dressed in an INLINE bespoke theme (cool steel ground, deep
// industrial-navy primary, safety-amber signal accent, a sturdy grotesk). Shipped as
// Ironworks Supply Co.
//
// SELF-CONTAINED BY DESIGN. A trade-family generator carries its OWN theme inline and passes
// it on the spec (`theme`), so the whole family can be authored in parallel without any two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-industrial-supply.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-industrial-supply/**" \
//     "marketplace-catalog/_gen/gen-b2b-industrial-supply.ts"
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
// An industrial distributor: a cool steel-grey paper ground, deep slate ink, an industrial-
// navy primary and a safety-amber signal accent, under a sturdy grotesk over a humanist sans.
// Complete light + dark, AA on every role (the blueprint sweep's contrast check is the gate).
// The accent is a DEEP amber (~50% L) so it stays legible as link/label text on the light
// ground, and the secondary is a dark slate so labels never wash out.
const THEME = defineTheme({
  name: 'ironworks-trade',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: ['oklch(97% 0.005 250)', 'oklch(94% 0.008 252)', 'oklch(89% 0.012 254)', 'oklch(23% 0.02 258)'],
    roles: {
      primary: 'oklch(40% 0.09 258)',
      secondary: 'oklch(43% 0.03 258)',
      accent: 'oklch(50% 0.15 55)',
      neutral: 'oklch(27% 0.02 258)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(22% 0.02 258)', 'oklch(18% 0.02 258)', 'oklch(15% 0.02 258)', 'oklch(95% 0.006 250)'],
    roles: {
      primary: 'oklch(72% 0.08 252)',
      secondary: 'oklch(77% 0.03 252)',
      accent: 'oklch(72% 0.15 60)',
      neutral: 'oklch(32% 0.02 258)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "ind-hero": "https://images.unsplash.com/photo-1627915589334-14a3c3e3a741?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm93cyUyMGluZHVzdHJpYWwlMjBzdXBwbHklMjBzaGVsdmluZyUyMGRpc3RyaWJ1dGlvbiUyMHdhcmVob3VzZXxlbnwwfDB8fHwxNzg2NDEzMjIzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ind-tile-fasteners": "https://images.unsplash.com/photo-1605701249987-f0bb9b505d06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmlucyUyMGFzc29ydGVkJTIwYm9sdHMlMjBudXRzJTIwd2FzaGVyc3xlbnwwfDB8fHwxNzg2NDEzMjI2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ind-tile-abrasives": "https://images.unsplash.com/photo-1522322512347-a0e57fd1744c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBjdXQtb2ZmJTIwZ3JpbmRpbmclMjB3aGVlbHN8ZW58MHwwfHx8MTc4NjQxMzIyOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ind-tile-safety": "https://images.unsplash.com/photo-1596513058031-bc51c5cbe091?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8c2FmZXR5JTIwZ2xhc3NlcyUyMG5pdHJpbGV8ZW58MHwwfHx8MTc4NjQxMzYwMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ind-tile-consumables": "https://images.unsplash.com/photo-1764866085369-44c7ef1a18f3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVsayUyMHNob3AlMjBjb25zdW1hYmxlcyUyMHJhZ3MlMjB0YXBlJTIwY2FibGUlMjB0aWVzfGVufDB8MHx8fDE3ODY0MTMyMzR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "ind-band-trade": "https://images.unsplash.com/photo-1532635026-d12867005472?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FyZWhvdXNlJTIwd29ya2VyJTIwbG9hZGluZyUyMHBhbGxldHMlMjBvbnRvJTIwZm9ya2xpZnR8ZW58MHwwfHx8MTc4NjQxMzIzOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-fasteners": "https://images.unsplash.com/photo-1638332746468-b4ffecd64ca0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z3JhZGUlMjA4JTIwZmFzdGVuZXIlMjBhc3NvcnRtZW50JTIwYm94fGVufDB8MHx8fDE3ODY0MTMyNDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cutoff": "https://images.unsplash.com/photo-1738162837672-de9d735a9b90?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwNCUyMDUlMjBpbmNoJTIwY3V0LW9mZiUyMHdoZWVsc3xlbnwwfDB8fHwxNzg2NDEzMjQ2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-grinding": "https://images.unsplash.com/photo-1564030390658-84b5d8fed479?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Ym94JTIwNCUyMDUlMjBpbmNoJTIwZ3JpbmRpbmclMjB3aGVlbHN8ZW58MHwwfHx8MTc4NjQxMzI0OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-gloves": "https://images.unsplash.com/photo-1599412227383-b7d4751c8765?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGJsdWUlMjBuaXRyaWxlJTIwZGlzcG9zYWJsZSUyMGdsb3Zlc3xlbnwwfDB8fHwxNzg2NDEzMjUyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-glasses": "https://images.unsplash.com/photo-1763144536757-d90b9144e6ef?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGNsZWFyJTIwYW50aS1mb2d8ZW58MHwwfHx8MTc4NjQxMzYwM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-rags": "https://images.unsplash.com/photo-1594139180581-ed12484ba98c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFsZSUyMHJlY2xhaW1lZCUyMGNvdHRvbiUyMHNob3AlMjByYWdzfGVufDB8MHx8fDE3ODY0MTMyNTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-ties": "https://images.unsplash.com/photo-1631872112096-7b1b700237f6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVsayUyMGJhZyUyMGJsYWNrJTIwY2FibGUlMjB0aWVzfGVufDB8MHx8fDE3ODY0MTMyNjF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-ducttape": "https://images.unsplash.com/photo-1623666936743-4d70c6ae32a5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGluZHVzdHJpYWwlMjBjbG90aHxlbnwwfDB8fHwxNzg2NDEzNjA4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-abrasives": "https://images.unsplash.com/photo-1598302936625-6075fbd98dd7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YW5nbGUlMjBncmluZGVyJTIwY3V0dGluZyUyMHN0ZWVsJTIwc3BhcmtzfGVufDB8MHx8fDE3ODY0MTMyNzN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-ppe": "https://images.unsplash.com/photo-1628235176517-71013205a2de?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8d29ya2VyJTIwcHVsbGluZyUyMG5pdHJpbGV8ZW58MHwwfHx8MTc4NjQxMzYxN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'ind-hero', url: src('ind-hero'), alt: 'Rows of industrial supply shelving in a distribution warehouse' },
  { id: 'ind-tile-fasteners', url: src('ind-tile-fasteners'), alt: 'Bins of assorted bolts, nuts and washers' },
  { id: 'ind-tile-abrasives', url: src('ind-tile-abrasives'), alt: 'A stack of cut-off and grinding wheels' },
  { id: 'ind-tile-safety', url: src('ind-tile-safety'), alt: 'Safety glasses and nitrile gloves on a workbench' },
  { id: 'ind-tile-consumables', url: src('ind-tile-consumables'), alt: 'Bulk shop consumables — rags, tape and cable ties' },
  { id: 'ind-band-trade', url: src('ind-band-trade'), alt: 'A warehouse worker loading pallets onto a forklift' },
  { id: 'prod-fasteners', url: src('prod-fasteners'), alt: 'A Grade 8 fastener assortment box' },
  { id: 'prod-cutoff', url: src('prod-cutoff'), alt: 'A box of 4.5 inch cut-off wheels' },
  { id: 'prod-grinding', url: src('prod-grinding'), alt: 'A box of 4.5 inch grinding wheels' },
  { id: 'prod-gloves', url: src('prod-gloves'), alt: 'A case of blue nitrile disposable gloves' },
  { id: 'prod-glasses', url: src('prod-glasses'), alt: 'A case of clear anti-fog safety glasses' },
  { id: 'prod-rags', url: src('prod-rags'), alt: 'A bale of reclaimed cotton shop rags' },
  { id: 'prod-ties', url: src('prod-ties'), alt: 'A bulk bag of black cable ties' },
  { id: 'prod-threadlocker', url: src('prod-threadlocker'), alt: 'A case of medium-strength threadlocker bottles' },
  { id: 'prod-ducttape', url: src('prod-ducttape'), alt: 'A case of industrial cloth duct tape rolls' },
  { id: 'prod-mro-kit', url: src('prod-mro-kit'), alt: 'An MRO shop starter kit of essential consumables' },
  { id: 'post-stockroom', url: src('post-stockroom'), alt: 'A well-organised MRO stockroom with labelled bins' },
  { id: 'post-abrasives', url: src('post-abrasives'), alt: 'An angle grinder cutting steel with sparks' },
  { id: 'post-ppe', url: src('post-ppe'), alt: 'A worker pulling on nitrile gloves on the shop floor' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-b2b-industrial-supply: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warehouse photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a trade-account link. The link
 *  carries the "Open a trade account" call the platform navbar CTA also points at (/contact).
 *  Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('ind-hero'), alt: 'A distribution warehouse of industrial supplies', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'The parts your crew needs, in stock and out the door.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Ironworks is a maintenance, repair and operations distributor. We stock the fasteners, abrasives, PPE and shop consumables that keep a floor running — sold by the case, priced for the trade, and dispatched fast.',
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
      el('span', 'text-center text-base font-semibold uppercase tracking-wide text-base-content', { text: o.label }),
    ],
  });
}

function categoryTiles(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('h2', 'text-3xl font-bold uppercase tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Shop by aisle',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'ind-tile-fasteners', label: 'Fasteners', href: '/shop', alt: 'Bins of bolts, nuts and washers' }),
              categoryTile({ assetId: 'ind-tile-abrasives', label: 'Abrasives', href: '/shop', alt: 'A stack of cut-off and grinding wheels' }),
              categoryTile({ assetId: 'ind-tile-safety', label: 'Safety', href: '/shop', alt: 'Safety glasses and nitrile gloves' }),
              categoryTile({ assetId: 'ind-tile-consumables', label: 'Consumables', href: '/shop', alt: 'Bulk shop consumables' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The trade-terms band — pure COPY, no photo. Four cards spell out how wholesale ordering
 *  works here: per-case trade pricing with volume breaks, net-30 for approved accounts, fast
 *  dispatch, and a named account manager. The tenant configures the real B2B pricing tiers,
 *  approval rules and terms in the Commerce module; this band SELLS the arrangement. */
function tradeTermsBand(): Node {
  const card = (title: string, body: string): Node =>
    el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
      children: [
        el('h3', 'text-lg font-bold uppercase tracking-wide text-base-content', { text: title }),
        el('p', 'text-base leading-relaxed text-base-content', { text: body }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('div', 'flex max-w-2xl flex-col gap-4', {
            children: [
              el('h2', 'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-5xl', {
                text: 'Built for the way trade buyers order',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Open a trade account and you buy the way a business should — by the case, at wholesale rates, on terms. No consumer markups, no runaround.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              card('Trade pricing', 'Per-case wholesale rates with volume breaks that deepen as your order grows. The more the crew burns through, the less each case costs.'),
              card('Net-30 terms', 'Approved accounts order now and pay later on net-30. Keep the floor stocked without tying up the purchasing card on every run.'),
              card('Fast dispatch', 'In-stock lines ship the same or next business day from our warehouse, so a stockout upstairs never idles a job downstairs.'),
              card('Your account manager', 'A direct line to a real person who knows your shop, your standing order and what you go through — not a ticket queue.'),
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
                el('h2', 'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-5xl', {
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Best sellers on the floor' }),
  tradeTermsBand(),
  productsBlock({ source: 'commerce.category.safety', layout: 'carousel', heading: 'Safety & PPE, always in stock' }),
  editorialBand({
    heading: 'One supplier, one invoice, one account manager',
    lead: 'Consolidate the scattered orders your team places across a dozen sites into one trade account. One catalog to buy from, one statement to reconcile, and one person who picks up the phone when a line is short.',
    assetId: 'ind-band-trade',
    cta: 'Open a trade account',
    href: '/contact',
    alt: 'A worker loading pallets onto a forklift',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (vendor label, title, per-case price,
 *  low-stock, description, pack/grade options + add-to-cart, a static "Trade pricing & terms"
 *  note with volume breaks + net-30, and policy links). */
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
                    text: 'Ironworks Supply Co.',
                  }),
                  pdpTitle('h1', 'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-5xl'),
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
                    text: 'The price shown is the per-case list rate. Trade accounts unlock volume breaks — deeper per-case pricing at a pallet, a full skid, or a standing order — set for your account in your dashboard.',
                  }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Approved accounts buy on net-30. Not set up yet? Open a trade account and we will price your regular lines and get you on terms.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Frequently ordered together' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', {
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
    'Every line we stock — fasteners, abrasives, safety and PPE, and bulk shop consumables, sold by the case. Filter by aisle or sort by price; trade accounts see their contract pricing at checkout.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The catalog grouped the way a purchaser actually buys — best sellers, new lines just in, the shop-floor essentials, safety & PPE, and the bulk consumables you reorder on a schedule.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search the catalog', 'Know the SKU, the size, or the spec you need? Search the whole catalog and the field notes below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Review the cases in your order before you check out. Trade accounts see contract pricing and net-30 terms applied here; everyone gets fast dispatch on in-stock lines. Need a formal quote instead? Your account manager can turn one around.',
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
          el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Field notes' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Practical guidance from the warehouse floor — how to stock an MRO room, pick the right abrasive, and outfit a crew in PPE. Written for the people doing the buying, not for a catalog.',
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
          el('h1', 'text-5xl font-bold uppercase tracking-tight text-base-content @2xl:text-6xl', { text: 'About Ironworks' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Ironworks Supply Co. is an industrial MRO distributor. We stock the unglamorous, essential lines that keep a maintenance shop, a fabrication floor or a fleet garage running — and we sell them to the trade by the case, at wholesale, on terms.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We built the business around one idea: a working buyer should not have to chase a dozen suppliers, eat consumer markups, or wait a week for a box of cut-off wheels. One catalog, one account, one invoice, and stock that is actually on the shelf when you order it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No minimum-order gymnastics, no mystery lead times, no pricing that changes because you asked. Just the parts, priced fairly and out the door — the boring reliability a shop is built on.',
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
    heading: 'Open a trade account',
    intro: 'Tell us what your crew goes through and we will price your regular lines, set you up on net-30 terms, and put a name and a number to your account. Wholesale enquiries, standing orders and bulk quotes all start here.',
    submitLabel: 'Email the trade desk',
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

const VENDOR = 'Ironworks Supply Co.';

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
    handle: 'grade-8-fastener-assortment',
    title: 'Grade 8 Fastener Assortment Box',
    description:
      '500-piece assortment of zinc-plated hex bolts, nuts and washers in the sizes a shop reaches for daily — 1/4" through 1/2", coarse thread — in a labelled sectioned case. MOQ 1 box. Pick Grade 5 for general assembly or Grade 8 where the load matters.',
    status: 'active',
    productType: 'Fasteners',
    vendor: VENDOR,
    tags: ['fasteners', 'bolts', 'assortment', 'grade-8'],
    categoryHandles: ['fasteners'],
    collectionHandles: ['best-sellers', 'shop-essentials'],
    seoTitle: 'Grade 8 Fastener Assortment Box, 500 pc | Ironworks Supply',
    seoDescription: 'A 500-piece hex bolt, nut and washer assortment in a labelled case. Grade 5 or Grade 8, sold by the box.',
    options: [{ name: 'Grade', displayType: 'dropdown', values: [{ value: 'Grade 5' }, { value: 'Grade 8' }] }],
    variants: [
      { sku: 'IWS-FAST-ASST-G5', priceCents: money(74), isDefault: true, inventoryPolicy: 'continue', optionValues: { Grade: 'Grade 5' } },
      { sku: 'IWS-FAST-ASST-G8', priceCents: money(89), inventoryPolicy: 'continue', optionValues: { Grade: 'Grade 8' } },
    ],
    images: [{ assetId: 'prod-fasteners', isPrimary: true, alt: 'A Grade 8 fastener assortment box' }],
  },
  caseItem({
    handle: 'cut-off-wheels-box',
    title: 'Cut-Off Wheels, 4½ in — Box of 25',
    description:
      'Type 1 metal cut-off wheels, 4½" x .045" x 7/8" arbor, aluminium-oxide grain for clean, fast cuts in steel and stainless. Box of 25. MOQ 4 boxes — buy the case and keep the grinders fed.',
    price: 34.5,
    sku: 'IWS-ABR-CUTOFF-45',
    productType: 'Abrasives',
    categories: ['abrasives'],
    collections: ['best-sellers', 'grinding-cutting'],
    tags: ['abrasives', 'cut-off', 'metal', 'consumable'],
    asset: 'prod-cutoff',
    seoTitle: 'Cut-Off Wheels 4½ in, Box of 25 | Ironworks Supply',
    seoDescription: 'Type 1 metal cut-off wheels, 4½ inch, box of 25. Aluminium-oxide grain for steel and stainless.',
  }),
  caseItem({
    handle: 'grinding-wheels-box',
    title: 'Grinding Wheels, 4½ in — Box of 25',
    description:
      'Type 27 depressed-centre grinding wheels, 4½" x 1/4" x 7/8" arbor, for weld dressing and heavy stock removal on steel. Box of 25. MOQ 2 boxes. The everyday wheel a fab shop burns through.',
    price: 42,
    sku: 'IWS-ABR-GRIND-45',
    productType: 'Abrasives',
    categories: ['abrasives'],
    collections: ['new-in', 'grinding-cutting'],
    tags: ['abrasives', 'grinding', 'metal', 'consumable'],
    asset: 'prod-grinding',
    seoTitle: 'Grinding Wheels 4½ in, Box of 25 | Ironworks Supply',
    seoDescription: 'Type 27 depressed-centre grinding wheels, 4½ inch, box of 25. Weld dressing and stock removal on steel.',
  }),
  {
    handle: 'nitrile-gloves-case',
    title: 'Nitrile Gloves, 6-mil — Case of 1000',
    description:
      'Heavy 6-mil powder-free nitrile gloves with a textured grip — the disposable that holds up to solvents, oils and shop grime without tearing. Case of 1000 (10 boxes of 100). MOQ 1 case. Pick your size.',
    status: 'active',
    productType: 'Safety',
    vendor: VENDOR,
    tags: ['safety', 'ppe', 'gloves', 'nitrile', 'consumable'],
    categoryHandles: ['safety'],
    collectionHandles: ['best-sellers', 'safety-ppe', 'bulk-consumables'],
    seoTitle: 'Nitrile Gloves 6-mil, Case of 1000 | Ironworks Supply',
    seoDescription: 'Heavy 6-mil powder-free nitrile gloves, textured grip, case of 1000. Solvent and oil resistant.',
    options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: 'Medium' }, { value: 'Large' }, { value: 'X-Large' }] }],
    variants: [
      { sku: 'IWS-PPE-NITR-M', priceCents: money(118), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Medium' } },
      { sku: 'IWS-PPE-NITR-L', priceCents: money(118), inventoryPolicy: 'continue', optionValues: { Size: 'Large' } },
      { sku: 'IWS-PPE-NITR-XL', priceCents: money(124), inventoryPolicy: 'continue', optionValues: { Size: 'X-Large' } },
    ],
    images: [{ assetId: 'prod-gloves', isPrimary: true, alt: 'A case of blue nitrile gloves' }],
  },
  caseItem({
    handle: 'safety-glasses-case',
    title: 'Anti-Fog Safety Glasses — Case of 12',
    description:
      'Clear anti-fog, anti-scratch safety glasses rated ANSI Z87.1, with a wraparound lens and soft nose bridge crews will actually keep on. Case of 12. MOQ 2 cases — enough to kit out a shift and stock the spares drawer.',
    price: 47,
    sku: 'IWS-PPE-GLASS-12',
    productType: 'Safety',
    categories: ['safety'],
    collections: ['new-in', 'safety-ppe'],
    tags: ['safety', 'ppe', 'eye-protection', 'ansi-z87'],
    asset: 'prod-glasses',
    seoTitle: 'Anti-Fog Safety Glasses, Case of 12 | Ironworks Supply',
    seoDescription: 'Clear ANSI Z87.1 anti-fog, anti-scratch safety glasses, case of 12. Wraparound lens, soft nose bridge.',
  }),
  caseItem({
    handle: 'shop-rags-bale',
    title: 'Reclaimed Cotton Shop Rags — 25 lb Bale',
    description:
      'Washed, lint-low reclaimed cotton wipers in a compressed 25 lb bale — the workhorse rag for solvents, spills and general clean-up. MOQ 1 bale. Cheaper by the pound than paper and it does not fall apart on the first wipe.',
    price: 58,
    sku: 'IWS-CON-RAGS-25',
    productType: 'Consumables',
    categories: ['consumables'],
    collections: ['best-sellers', 'shop-essentials', 'bulk-consumables'],
    tags: ['consumables', 'rags', 'wipers', 'bulk'],
    asset: 'prod-rags',
    seoTitle: 'Reclaimed Cotton Shop Rags, 25 lb Bale | Ironworks Supply',
    seoDescription: 'Washed low-lint reclaimed cotton shop rags in a 25 lb bale. The workhorse wiper for any shop floor.',
  }),
  {
    handle: 'cable-ties-bag',
    title: 'Cable Ties — Bag of 1000',
    description:
      'UV-stabilised black nylon cable ties, 50 lb tensile, in a bulk bag of 1000 — for loom work, bundling and a hundred fixes a day. MOQ 1 bag. Choose the length your work calls for.',
    status: 'active',
    productType: 'Consumables',
    vendor: VENDOR,
    tags: ['consumables', 'cable-ties', 'nylon', 'bulk'],
    categoryHandles: ['consumables'],
    collectionHandles: ['shop-essentials', 'bulk-consumables'],
    seoTitle: 'Cable Ties, Bag of 1000 | Ironworks Supply',
    seoDescription: 'UV-stabilised black nylon cable ties, 50 lb tensile, bulk bag of 1000. 8 inch or 11 inch.',
    options: [{ name: 'Length', displayType: 'dropdown', values: [{ value: '8 in' }, { value: '11 in' }] }],
    variants: [
      { sku: 'IWS-CON-TIE-8', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue', optionValues: { Length: '8 in' } },
      { sku: 'IWS-CON-TIE-11', priceCents: money(29), inventoryPolicy: 'continue', optionValues: { Length: '11 in' } },
    ],
    images: [{ assetId: 'prod-ties', isPrimary: true, alt: 'A bulk bag of black cable ties' }],
  },
  caseItem({
    handle: 'threadlocker-case',
    title: 'Medium-Strength Threadlocker — Case of 10',
    description:
      'Blue medium-strength anaerobic threadlocker in 10 mL bottles, a case of 10 — locks and seals fasteners against vibration yet backs out with hand tools for service. MOQ 1 case. The blue bottle every toolbox needs.',
    price: 96,
    sku: 'IWS-CON-TLOCK-10',
    productType: 'Consumables',
    categories: ['consumables'],
    collections: ['shop-essentials', 'bulk-consumables'],
    tags: ['consumables', 'threadlocker', 'adhesive', 'maintenance'],
    asset: 'prod-threadlocker',
    seoTitle: 'Medium-Strength Threadlocker, Case of 10 | Ironworks Supply',
    seoDescription: 'Blue medium-strength anaerobic threadlocker, 10 mL bottles, case of 10. Vibration-proof, service-removable.',
  }),
  caseItem({
    handle: 'duct-tape-case',
    title: 'Industrial Cloth Duct Tape — Case of 24',
    description:
      '11-mil silver cloth duct tape, 2" x 60 yd, a case of 24 rolls — a strong, hand-tearable, weather-resistant tape for seaming, bundling and the fix that has to hold today. MOQ 1 case. Buy the case; you always need more.',
    price: 72,
    sku: 'IWS-CON-DUCT-24',
    productType: 'Consumables',
    categories: ['consumables'],
    collections: ['shop-essentials', 'bulk-consumables'],
    tags: ['consumables', 'duct-tape', 'tape', 'bulk'],
    asset: 'prod-ducttape',
    seoTitle: 'Industrial Cloth Duct Tape, Case of 24 | Ironworks Supply',
    seoDescription: '11-mil silver cloth duct tape, 2 inch x 60 yd, case of 24 rolls. Strong, hand-tearable, weather-resistant.',
  }),
  caseItem({
    handle: 'mro-starter-kit',
    title: 'MRO Shop Starter Kit',
    description:
      'A curated kit of the consumables a new shop or satellite site runs out of first — a fastener assortment, cut-off wheels, nitrile gloves, shop rags, cable ties and threadlocker, packed together and priced below the sum of its cases. MOQ 1 kit. The fastest way to stock a floor from empty.',
    price: 149,
    sku: 'IWS-KIT-MRO-STARTER',
    productType: 'Consumables',
    categories: ['consumables'],
    collections: ['new-in', 'shop-essentials'],
    tags: ['consumables', 'kit', 'starter', 'bundle'],
    asset: 'prod-mro-kit',
    seoTitle: 'MRO Shop Starter Kit | Ironworks Supply',
    seoDescription: 'A curated starter kit of essential MRO consumables — fasteners, abrasives, PPE, rags and more, priced below the sum.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'fasteners', name: 'Fasteners', description: 'Bolts, nuts, washers and assortments.', featured: true },
    { handle: 'abrasives', name: 'Abrasives', description: 'Cut-off and grinding wheels.', featured: true },
    { handle: 'safety', name: 'Safety', description: 'PPE — gloves, eye protection and more.', featured: true },
    { handle: 'consumables', name: 'Consumables', description: 'Rags, tape, ties and shop supplies.', featured: true },
  ],
  collections: [
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The lines shops reorder most.',
      type: 'manual',
      featured: true,
      productHandles: ['grade-8-fastener-assortment', 'cut-off-wheels-box', 'nitrile-gloves-case', 'shop-rags-bale'],
    },
    {
      handle: 'new-in',
      name: 'New in',
      description: 'Lines just added to the catalog.',
      type: 'manual',
      featured: true,
      productHandles: ['grinding-wheels-box', 'safety-glasses-case', 'mro-starter-kit'],
    },
    {
      handle: 'shop-essentials',
      name: 'Shop-floor essentials',
      description: 'The consumables no floor runs without.',
      type: 'manual',
      featured: false,
      productHandles: ['grade-8-fastener-assortment', 'shop-rags-bale', 'cable-ties-bag', 'duct-tape-case', 'threadlocker-case', 'mro-starter-kit'],
    },
    {
      handle: 'safety-ppe',
      name: 'Safety & PPE',
      description: 'Protect the crew, kit the shift.',
      type: 'manual',
      featured: false,
      productHandles: ['nitrile-gloves-case', 'safety-glasses-case'],
    },
    {
      handle: 'grinding-cutting',
      name: 'Grinding & cutting',
      description: 'Wheels for cut and dress work.',
      type: 'manual',
      featured: false,
      productHandles: ['cut-off-wheels-box', 'grinding-wheels-box'],
    },
    {
      handle: 'bulk-consumables',
      name: 'Bulk consumables',
      description: 'Buy the case, reorder on a schedule.',
      type: 'manual',
      featured: false,
      productHandles: ['nitrile-gloves-case', 'shop-rags-bale', 'cable-ties-bag', 'threadlocker-case', 'duct-tape-case'],
    },
  ],
  products: PRODUCTS,
};

// ── Content (field notes) ────────────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'set-up-an-mro-stockroom',
    status: 'published',
    body: {
      title: 'How to set up an MRO stockroom that never runs dry',
      excerpt: 'A stockout upstairs idles a job downstairs. Here is a simple min/max system any shop can run to make sure the case is on the shelf before the last one is empty.',
      featuredImage: { $asset: 'post-stockroom' },
      body: {
        type: 'doc',
        content: [
          para('An MRO stockroom exists to do one thing: make sure the part is there the moment someone needs it. Get it wrong and a five-dollar cut-off wheel holds up a five-hundred-dollar-an-hour job. The good news is that keeping it right does not take software or a full-time storekeeper — it takes a min/max system and the discipline to follow it.'),
          h2('Set a min and a max for every line'),
          para('For each consumable, decide two numbers. The MIN is the reorder point — the quantity that should trigger a new order, set high enough to cover your usage over the lead time so you never hit zero while a case is in transit. The MAX is how much you hold at full — enough to buy at a sensible case or pallet price without turning the shelf into dead capital. When stock drops to the min, you order back up to the max. That is the whole system.'),
          h2('Label the bin, not your memory'),
          para('Write the line, the SKU, the min and the max on the bin itself. When anyone can see at a glance that the rag bale is below its min, ordering stops depending on one person remembering. A two-bin trick makes it even simpler: when the front bin empties, that is the signal to reorder, and the back bin covers you until the case arrives.'),
          h2('Put the fast movers on a standing order'),
          para('The lines you burn through on a predictable schedule — gloves, wheels, rags, ties — do not need re-deciding every month. Put them on a standing order with your supplier and they arrive before you run out, priced for the volume. Reserve your attention for the exceptions, and let the boring reliable lines take care of themselves.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'choosing-the-right-abrasive',
    status: 'published',
    body: {
      title: 'Cut-off vs grinding: choosing the right wheel',
      excerpt: 'They look similar and mount the same, but a cut-off wheel and a grinding wheel are built for opposite jobs. Using the wrong one is slow at best and dangerous at worst.',
      featuredImage: { $asset: 'post-abrasives' },
      body: {
        type: 'doc',
        content: [
          para('Walk any fab shop and you will find the two wheels mixed up in the same bin, because from a step back they look alike. They are not. A cut-off wheel is thin and made to work on its edge; a grinding wheel is thick and made to work on its face. Match the wheel to the job and both cut fast and last; mismatch them and you get a slow, hot mess — or a shattered wheel.'),
          h2('Cut-off wheels: thin, for parting'),
          para('A cut-off wheel — Type 1, flat, around .045" thick — is for severing stock: cutting bar, pipe, angle and bolt to length. Use its EDGE only. Never lay a cut-off wheel over on its face to grind a weld flat; the thin disc is not built for side load and will crack. When it wears down, retire it — a stub in a full-speed grinder is not worth the risk.'),
          h2('Grinding wheels: thick, for dressing'),
          para('A grinding wheel — Type 27, depressed-centre, around 1/4" thick — is for removing material off a surface: dressing welds, knocking down burrs, blending. Work it on its FACE at a shallow angle, roughly 20 to 30 degrees. It is not made to part stock; try to cut with it and you will burn through the wheel and the patience of everyone nearby.'),
          h2('Buy both by the case'),
          para('Because they wear out — that is the job — the only real mistake is running short. Keep a case of each on the shelf, set a reorder point, and nobody ever has to grab the wrong wheel because it was the only one left in the drawer.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'nitrile-glove-and-ppe-guide',
    status: 'published',
    body: {
      title: 'A no-nonsense guide to nitrile gloves and shop PPE',
      excerpt: 'PPE only protects the crew if they will actually wear it. Here is how to spec gloves and eye protection people keep on — and buy it at a price that does not make you ration it.',
      featuredImage: { $asset: 'post-ppe' },
      body: {
        type: 'doc',
        content: [
          para('The best PPE is the set your crew does not take off. That sounds obvious, but plenty of shops buy protection so thin, so ill-fitting or so scarce that people work around it — and then wonder why the incident rate will not budge. Spec it right and buy it in volume, and the safe choice becomes the easy one.'),
          h2('Gloves: mind the mil'),
          para('For general shop work, a 6-mil nitrile glove is the sweet spot — thick enough to shrug off solvents, oils and swarf without tearing, thin enough to keep the dexterity to actually work. Go powder-free to avoid contaminating surfaces, and get the SIZE right: a glove that is too big snags and slips, one too small tears at the knuckle. Stock medium through extra-large so nobody is stuck with the wrong fit.'),
          h2('Eye protection people keep on'),
          para('Safety glasses only work on a face. The reasons crews push them up are always the same — they fog, they scratch blind, or they pinch. Spec an anti-fog, anti-scratch lens rated ANSI Z87.1 with a soft nose bridge and a wraparound shape, and most of the excuses disappear. Keep a case in the drawer so a scratched pair gets swapped, not tolerated.'),
          h2('Buy it in volume so you never ration it'),
          para('The quiet failure mode is running low and rationing — one box of gloves guarded like gold, one pair of glasses shared across a bench. Buy PPE by the case at trade pricing and it is always there, always fresh, and never the thing standing between a worker and doing the job right.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'b2b-industrial-supply',
  key: 'sparx-b2b-industrial-supply',
  name: 'sparx — Industrial Supply (B2B / Wholesale)',
  theme: THEME,
  summary:
    'A complete, working wholesale shop for an industrial MRO distributor: a real trade catalogue sold by the case — fasteners, abrasives, safety & PPE and bulk consumables — with categories, collections, a bespoke trade PDP (per-case pricing, volume breaks, net-30), and a full merchandised home page. Sturdy industrial theme — steel ground, deep navy, safety-amber accent. Shipped as Ironworks Supply Co.',
  tagline: 'A wholesale storefront built for trade buyers.',
  vertical: 'b2b',
  industry: 'Industrial & MRO supply',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 86,
  brand: {
    businessName: 'Ironworks Supply Co.',
    tagline: 'The parts your crew needs, in stock and out the door.',
  },
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Ironworks Supply Co. — industrial & MRO distributor',
      description:
        'Ironworks is an industrial MRO distributor — fasteners, abrasives, safety, PPE and bulk consumables sold by the case at trade prices, with net-30 terms and fast dispatch. Open a trade account.',
    },
    about: {
      title: 'About Ironworks Supply Co.',
      description:
        'How Ironworks stocks, prices and ships — one catalog, one account, one invoice, wholesale by the case, and stock that is actually on the shelf when you order it.',
    },
    contact: {
      title: 'Open a trade account — Ironworks Supply Co.',
      description:
        'Set up a trade account with Ironworks: wholesale per-case pricing, volume breaks, net-30 terms and a dedicated account manager. Wholesale enquiries and bulk quotes start here.',
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
