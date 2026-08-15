// sparx-b2b-print-supply — a B2B/WHOLESALE commerce site template: a trade supplier of
// PRINT, SIGNAGE & SUBLIMATION consumables selling to TRADE BUYERS (print shops, sign
// makers, garment decorators).
//
// A trade-family sibling of gen-b2b-industrial-supply: a complete, working wholesale shop
// the moment it installs — a real catalogue sold by the roll/box/case/set with pack quantities,
// MOQs and per-unit trade prices, categories + collections, a bespoke trade PDP with a
// pricing-&-terms note, and the full 9-page commerce site (home merchandising → shop →
// collections → cart → search → journal → about → contact), dressed in an INLINE bespoke
// theme (clean cool-neutral paper, deep press-ink primary, a confident CMYK-magenta signal
// accent, a clean grotesk). Shipped as Inkyard Trade Supply.
//
// SELF-CONTAINED BY DESIGN. A trade-family generator carries its OWN theme inline and passes
// it on the spec (`theme`), so the whole family can be authored in parallel without any two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-print-supply.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-print-supply/**" \
//     "marketplace-catalog/_gen/gen-b2b-print-supply.ts"
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
// A print & signage trade house: a clean cool-neutral paper ground, deep press-ink slate,
// a deep press-ink primary and a confident CMYK-magenta signal accent, under a clean grotesk
// over a humanist sans. Complete light + dark, AA on every role (the blueprint sweep's
// contrast check is the gate). The accent is a DEEP magenta (~50% L) so it stays legible as
// link/label text on the light ground, and the secondary is a dark slate so labels never
// wash out.
const THEME = defineTheme({
  name: 'inkyard-trade',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: ['oklch(98% 0.004 265)', 'oklch(95% 0.006 265)', 'oklch(90% 0.01 268)', 'oklch(22% 0.03 272)'],
    roles: {
      primary: 'oklch(38% 0.08 268)',
      secondary: 'oklch(43% 0.03 268)',
      accent: 'oklch(50% 0.22 352)',
      neutral: 'oklch(26% 0.02 268)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(22% 0.02 268)', 'oklch(18% 0.02 268)', 'oklch(15% 0.02 268)', 'oklch(96% 0.005 265)'],
    roles: {
      primary: 'oklch(74% 0.10 262)',
      secondary: 'oklch(78% 0.03 262)',
      accent: 'oklch(70% 0.20 352)',
      neutral: 'oklch(32% 0.02 268)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "print-hero": "https://images.unsplash.com/photo-1661348000449-9b0d9da3d56d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbHMlMjBwcmludCUyMHNpZ24lMjBtZWRpYSUyMHJhY2tlZCUyMHRyYWRlJTIwc3VwcGx5fGVufDB8MHx8fDE3ODY0MjIyNTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "print-tile-vinyl": "https://images.unsplash.com/photo-1659729752406-aeab900ea8c1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbHMlMjBjb2xvdXJlZCUyMGNhc3QlMjB2aW55bCUyMGhlYXQtdHJhbnNmZXIlMjBmaWxtJTIwc2hlbGZ8ZW58MHwwfHx8MTc4NjQyMjI2MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "print-tile-media": "https://images.unsplash.com/photo-1675716472446-bebee69a8888?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8c3RhY2tlZCUyMHJvbGxzJTIwYmFubmVyJTIwbWVkaWElMjBzaGVldHMlMjBmb2FtJTIwYm9hcmR8ZW58MHwwfHx8MTc4NjQyMjI2NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "print-tile-inks": "https://images.unsplash.com/photo-1706895040634-62055892cbbb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwY215ayUyMHdpZGUtZm9ybWF0JTIwaW5rJTIwY2FydHJpZGdlc3xlbnwwfDB8fHwxNzg2NDIyMjY4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "print-tile-blanks": "https://images.unsplash.com/photo-1516390118834-21602d501886?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMHdoaXRlJTIwc3VibGltYXRpb24lMjBibGFuayUyMG11Z3MlMjByZWFkeSUyMHByZXNzfGVufDB8MHx8fDE3ODY0MjIyNzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "print-band-trade": "https://images.unsplash.com/photo-1769477145932-edd5a9d7567c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwbG9hZGluZyUyMG1lZGlhJTIwcm9sbHMlMjBvbnRvJTIwdHJhZGUlMjBkZWxpdmVyeXxlbnwwfDB8fHwxNzg2NDIyMjc0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cast-vinyl": "https://images.unsplash.com/photo-1574114037110-49a06a20303d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8cm9sbCUyMGdsb3NzJTIwY2FzdCUyMHNpZ24lMjB2aW55bHxlbnwwfDB8fHwxNzg2NDIyMjc3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-htv": "https://images.unsplash.com/photo-1707419681449-415acb122f46?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbCUyMGhlYXQtdHJhbnNmZXIlMjB2aW55bCUyMGdhcm1lbnQlMjBkZWNvcmF0aW9ufGVufDB8MHx8fDE3ODY0MjIyODB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-app-tape": "https://images.unsplash.com/photo-1662001164155-2d04179a7b22?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbCUyMHBhcGVyJTIwYXBwbGljYXRpb24lMjB0cmFuc2ZlciUyMHRhcGV8ZW58MHwwfHx8MTc4NjQyMjI4NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-banner": "https://images.unsplash.com/photo-1588146256435-63ec0608c415?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbCUyMHNjcmltJTIwYmFubmVyfGVufDB8MHx8fDE3ODY0MjI0MDZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-laminate": "https://images.unsplash.com/photo-1751517298153-9987060ba831?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbCUyMGdsb3NzJTIwb3ZlcmxhbWluYXRlJTIwZmlsbXxlbnwwfDB8fHwxNzg2NDIyMjg5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-foam-board": "https://images.unsplash.com/photo-1549030927-006822377380?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFjayUyMHdoaXRlJTIwZm9hbSUyMGJvYXJkJTIwc2hlZXRzfGVufDB8MHx8fDE3ODY0MjIyOTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-eco-ink": "https://images.unsplash.com/photo-1739146051825-0a1e54e6f1c6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y215ayUyMGVjby1zb2x2ZW50JTIwd2lkZS1mb3JtYXR8ZW58MHwwfHx8MTc4NjQyMjQwOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subli-ink": "https://images.unsplash.com/photo-1558470598-a5dda9640f68?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Y215ayUyMGR5ZS1zdWJsaW1hdGlvbiUyMGlua3xlbnwwfDB8fHwxNzg2NDIyNDEyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subli-blanks": "https://images.unsplash.com/photo-1650959858546-d09833d5317b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGJsYW5rJTIwd2hpdGUlMjBzdWJsaW1hdGlvbiUyMG11Z3N8ZW58MHwwfHx8MTc4NjQyMjMwMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-vinyl-guide": "https://images.unsplash.com/photo-1674065959348-185784d91d7e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxvdHRlciUyMHdlZWRpbmclMjBzaGVldCUyMGN1dCUyMHNpZ24lMjB2aW55bHxlbnwwfDB8fHwxNzg2NDIyMzA1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-sublimation": "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGVhdCUyMHByZXNzJTIwY2xvc2luZyUyMHN1YmxpbWF0aW9uJTIwYmxhbmt8ZW58MHwwfHx8MTc4NjQyMjMwOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-media-stock": "https://images.unsplash.com/photo-1760302356448-d3385b5e6272?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VsbC1vcmdhbmlzZWQlMjByYWNrJTIwbGFiZWxsZWQlMjBwcmludCUyMG1lZGlhJTIwcm9sbHN8ZW58MHwwfHx8MTc4NjQyMjMxMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'print-hero', url: src('print-hero'), alt: 'Rolls of print and sign media racked in a trade supply warehouse' },
  { id: 'print-tile-vinyl', url: src('print-tile-vinyl'), alt: 'Rolls of coloured cast vinyl and heat-transfer film on a shelf' },
  { id: 'print-tile-media', url: src('print-tile-media'), alt: 'Stacked rolls of banner media and sheets of foam board' },
  { id: 'print-tile-inks', url: src('print-tile-inks'), alt: 'A set of CMYK wide-format ink cartridges' },
  { id: 'print-tile-blanks', url: src('print-tile-blanks'), alt: 'A case of white sublimation blank mugs ready to press' },
  { id: 'print-band-trade', url: src('print-band-trade'), alt: 'A worker loading media rolls onto a trade delivery van' },
  { id: 'prod-cast-vinyl', url: src('prod-cast-vinyl'), alt: 'A roll of gloss cast sign vinyl' },
  { id: 'prod-htv', url: src('prod-htv'), alt: 'A roll of heat-transfer vinyl for garment decoration' },
  { id: 'prod-app-tape', url: src('prod-app-tape'), alt: 'A roll of paper application transfer tape' },
  { id: 'prod-banner', url: src('prod-banner'), alt: 'A roll of scrim banner media for wide-format printing' },
  { id: 'prod-laminate', url: src('prod-laminate'), alt: 'A roll of gloss overlaminate film' },
  { id: 'prod-foam-board', url: src('prod-foam-board'), alt: 'A pack of white foam board sheets' },
  { id: 'prod-eco-ink', url: src('prod-eco-ink'), alt: 'A CMYK set of eco-solvent wide-format ink' },
  { id: 'prod-subli-ink', url: src('prod-subli-ink'), alt: 'A CMYK set of dye-sublimation ink bottles' },
  { id: 'prod-subli-blanks', url: src('prod-subli-blanks'), alt: 'A case of blank white sublimation mugs' },
  { id: 'prod-starter-kit', url: src('prod-starter-kit'), alt: 'A shop starter media kit of vinyl, tape and banner' },
  { id: 'post-vinyl-guide', url: src('post-vinyl-guide'), alt: 'A plotter weeding a sheet of cut sign vinyl' },
  { id: 'post-sublimation', url: src('post-sublimation'), alt: 'A heat press closing on a sublimation blank' },
  { id: 'post-media-stock', url: src('post-media-stock'), alt: 'A well-organised rack of labelled print media rolls' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-b2b-print-supply: unknown asset "${id}"`);
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
        attrs: { src: assetUrl('print-hero'), alt: 'A trade warehouse of print and sign media', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Media, ink and blanks that run clean, priced for the shop.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Inkyard is a trade supplier to print shops, sign makers and decorators. We stock the vinyl, banner, ink and sublimation blanks that keep your presses and plotters running — by the roll, box and case, at trade prices, out the door next day.',
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
            text: 'Shop by line',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'print-tile-vinyl', label: 'Vinyl & HTV', href: '/shop', alt: 'Rolls of cast vinyl and heat-transfer film' }),
              categoryTile({ assetId: 'print-tile-media', label: 'Media & board', href: '/shop', alt: 'Rolls of banner media and foam board' }),
              categoryTile({ assetId: 'print-tile-inks', label: 'Inks', href: '/shop', alt: 'A set of CMYK wide-format ink' }),
              categoryTile({ assetId: 'print-tile-blanks', label: 'Blanks', href: '/shop', alt: 'A case of sublimation blank mugs' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The trade-terms band — pure COPY, no photo. Four cards spell out how wholesale ordering
 *  works here: per-unit trade pricing with bulk breaks, net-30 for approved accounts, next-day
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
                text: 'Built for the way a print shop buys',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Open a trade account and you buy the way a working shop should — by the roll and the case, at wholesale rates, on terms. No retail markups, no waiting a week for a roll of banner.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              card('Trade pricing', 'Per-unit wholesale rates with bulk breaks that deepen as your order grows. Buy media by the case and every roll lands cheaper.'),
              card('Net-30 terms', 'Approved accounts print now and pay later on net-30. Keep the plotter fed and the presses loaded without tying up the card on every run.'),
              card('Next-day dispatch', 'In-stock media, ink and blanks ship the same or next business day, so a jammed job is never waiting on a roll that has not left our shelf.'),
              card('Colour-matched & backed', 'A named account manager who knows your printers, your profiles and your standing order — and helps colour-match a spot when a brand job demands it.'),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Best sellers on the shelf' }),
  tradeTermsBand(),
  productsBlock({ source: 'commerce.category.vinyl-htv', layout: 'carousel', heading: 'Vinyl & HTV, always in stock' }),
  editorialBand({
    heading: 'One supplier, one invoice, one account manager',
    lead: 'Stop chasing a vinyl house, an ink house and a blanks house on three separate orders. Consolidate your consumables onto one trade account — one catalog to buy from, one statement to reconcile, and one person who picks up the phone when a roll is short.',
    assetId: 'print-band-trade',
    cta: 'Open a trade account',
    href: '/contact',
    alt: 'A worker loading media rolls onto a trade delivery van',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (vendor label, title, per-unit price,
 *  low-stock, description, finish/size options + add-to-cart, a static "Trade pricing & terms"
 *  note with bulk breaks + net-30, and policy links). */
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
                    text: 'Inkyard Trade Supply',
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
                    text: 'The price shown is the per-unit list rate. Trade accounts unlock bulk breaks — deeper per-roll and per-case pricing at a full box, a pallet, or a standing order — set for your account in your dashboard.',
                  }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Approved accounts buy on net-30. Not set up yet? Open a trade account and we will price your regular media, ink and blanks and get you on terms.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Runs with' });

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
    'Every line we stock — cast vinyl and HTV, banner and board, wide-format and dye-sub ink, and sublimation blanks, sold by the roll, box and case. Filter by line or sort by price; trade accounts see their contract pricing at checkout.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The catalog grouped the way a shop actually buys — best sellers, new lines just in, the everyday print-shop essentials, signage media, the sublimation station, and the rolls you reorder on a schedule.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search the catalog', 'Know the roll width, the ink profile, or the blank you need? Search the whole catalog and the field notes below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Review the rolls, boxes and cases in your order before you check out. Trade accounts see contract pricing and net-30 terms applied here; everyone gets next-day dispatch on in-stock lines. Need a formal quote for a big media run? Your account manager can turn one around.',
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
            text: 'Practical guidance from the trade counter — how to pick the right vinyl, get clean sublimation transfers, and stock a media room so a job never waits on a roll. Written for the people running the presses, not for a catalog.',
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
          el('h1', 'text-5xl font-bold uppercase tracking-tight text-base-content @2xl:text-6xl', { text: 'About Inkyard' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Inkyard Trade Supply is a wholesale supplier to the print trade. We stock the media, ink and blanks that keep a sign shop, a wide-format printer or a garment decorator running — and we sell them to the trade by the roll, box and case, at wholesale, on terms.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We built the business around one idea: a working shop should not have to chase three suppliers, eat retail markups, or lose a Friday deadline to a backordered roll of banner. One catalog, one account, one invoice, and media that is actually on the shelf when you order it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No minimum-order gymnastics, no mystery lead times, no ink that ships out of profile. Just clean-running media, priced fairly and out the door next day — the boring reliability a shop is built on.',
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
    intro: 'Tell us what your shop runs through and we will price your regular media, ink and blanks, set you up on net-30 terms, and put a name and a number to your account. Wholesale enquiries, standing orders and bulk media quotes all start here.',
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

const VENDOR = 'Inkyard Trade Supply';

/** A single-SKU roll/box/case line — one price, no options (most media ships one pack size). */
const unitItem = (opts: {
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
    handle: 'cast-sign-vinyl-roll',
    title: 'Cast Sign Vinyl — 30 in Roll',
    description:
      'Premium 2-mil cast vinyl for vehicle wraps, decals and long-term outdoor signage — conformable, 7-year outdoor durability, with an air-release adhesive that lays down bubble-free. 30" x 50 yd roll. MOQ 1 roll. Pick gloss for pop or matte for a wrapped-satin finish.',
    status: 'active',
    productType: 'Vinyl',
    vendor: VENDOR,
    tags: ['vinyl', 'cast', 'signage', 'wrap', 'roll'],
    categoryHandles: ['vinyl-htv'],
    collectionHandles: ['best-sellers', 'signage-supplies', 'bulk-media'],
    seoTitle: 'Cast Sign Vinyl 30 in Roll, gloss or matte | Inkyard Trade Supply',
    seoDescription: 'Premium 2-mil cast vinyl, 30 inch x 50 yd roll, air-release adhesive. Gloss or matte, 7-year outdoor durability.',
    options: [{ name: 'Finish', displayType: 'dropdown', values: [{ value: 'Gloss' }, { value: 'Matte' }] }],
    variants: [
      { sku: 'IYD-VIN-CAST-30-G', priceCents: money(129), isDefault: true, inventoryPolicy: 'continue', optionValues: { Finish: 'Gloss' } },
      { sku: 'IYD-VIN-CAST-30-M', priceCents: money(134), inventoryPolicy: 'continue', optionValues: { Finish: 'Matte' } },
    ],
    images: [{ assetId: 'prod-cast-vinyl', isPrimary: true, alt: 'A roll of gloss cast sign vinyl' }],
  },
  {
    handle: 'heat-transfer-vinyl-roll',
    title: 'Heat-Transfer Vinyl — 20 in Roll',
    description:
      'PU heat-transfer vinyl for garment decoration — thin, matte, and stretchable, with a hot-peel carrier that weeds clean and layers without bulk. 20" x 5 yd roll. MOQ 3 rolls — buy the colours your jobs run and keep the press fed. Pick your colour.',
    status: 'active',
    productType: 'HTV',
    vendor: VENDOR,
    tags: ['htv', 'heat-transfer', 'garment', 'decoration', 'roll'],
    categoryHandles: ['vinyl-htv'],
    collectionHandles: ['best-sellers', 'sublimation-station'],
    seoTitle: 'Heat-Transfer Vinyl 20 in Roll, PU hot-peel | Inkyard Trade Supply',
    seoDescription: 'Thin matte PU heat-transfer vinyl, 20 inch x 5 yd roll, hot-peel carrier. Weeds clean and layers without bulk.',
    options: [{ name: 'Colour', displayType: 'dropdown', values: [{ value: 'White' }, { value: 'Black' }, { value: 'Red' }] }],
    variants: [
      { sku: 'IYD-HTV-PU-20-W', priceCents: money(34), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'White' } },
      { sku: 'IYD-HTV-PU-20-K', priceCents: money(34), inventoryPolicy: 'continue', optionValues: { Colour: 'Black' } },
      { sku: 'IYD-HTV-PU-20-R', priceCents: money(37), inventoryPolicy: 'continue', optionValues: { Colour: 'Red' } },
    ],
    images: [{ assetId: 'prod-htv', isPrimary: true, alt: 'A roll of heat-transfer vinyl' }],
  },
  unitItem({
    handle: 'application-tape-roll',
    title: 'Application Transfer Tape — 24 in Roll',
    description:
      'Medium-tack paper application tape for transferring cut vinyl to the surface clean and straight — lays flat, releases without lifting the graphic, and takes a squeegee without tearing. 24" x 100 yd roll. MOQ 2 rolls. The consumable every sign job burns through.',
    price: 42,
    sku: 'IYD-VIN-APPTAPE-24',
    productType: 'Application tape',
    categories: ['vinyl-htv'],
    collections: ['signage-supplies', 'print-shop-essentials'],
    tags: ['application-tape', 'transfer-tape', 'signage', 'consumable', 'roll'],
    asset: 'prod-app-tape',
    seoTitle: 'Application Transfer Tape 24 in Roll | Inkyard Trade Supply',
    seoDescription: 'Medium-tack paper application transfer tape, 24 inch x 100 yd roll. Lays flat, releases clean, takes a squeegee.',
  }),
  {
    handle: 'scrim-banner-media-roll',
    title: 'Scrim Banner Media — 54 in Roll',
    description:
      'Matte scrim vinyl banner media for wide-format eco-solvent and latex printers — a tough polyester-reinforced base that takes ink sharp and grommets without cracking. 54" x 164 ft roll. MOQ 1 roll. Pick the weight your job needs — 13oz for indoor and short runs, 15oz for outdoor and wind.',
    status: 'active',
    productType: 'Banner media',
    vendor: VENDOR,
    tags: ['banner', 'media', 'wide-format', 'signage', 'roll'],
    categoryHandles: ['media-board'],
    collectionHandles: ['best-sellers', 'signage-supplies', 'bulk-media'],
    seoTitle: 'Scrim Banner Media 54 in Roll, 13oz or 15oz | Inkyard Trade Supply',
    seoDescription: 'Matte scrim vinyl banner media, 54 inch x 164 ft roll. 13oz indoor or 15oz outdoor, grommets without cracking.',
    options: [{ name: 'Weight', displayType: 'dropdown', values: [{ value: '13 oz' }, { value: '15 oz' }] }],
    variants: [
      { sku: 'IYD-MED-BANNER-54-13', priceCents: money(96), isDefault: true, inventoryPolicy: 'continue', optionValues: { Weight: '13 oz' } },
      { sku: 'IYD-MED-BANNER-54-15', priceCents: money(118), inventoryPolicy: 'continue', optionValues: { Weight: '15 oz' } },
    ],
    images: [{ assetId: 'prod-banner', isPrimary: true, alt: 'A roll of scrim banner media' }],
  },
  {
    handle: 'overlaminate-film-roll',
    title: 'Overlaminate Film — 30 in Roll',
    description:
      'Cast overlaminate to protect printed wraps and decals from UV, abrasion and wash — optically clear, conformable to match the print vinyl, with an air-release adhesive for a clean lamination. 30" x 50 yd roll. MOQ 1 roll. Match gloss to gloss or matte for a low-glare finish.',
    status: 'active',
    productType: 'Laminate',
    vendor: VENDOR,
    tags: ['laminate', 'overlaminate', 'wrap', 'protection', 'roll'],
    categoryHandles: ['media-board'],
    collectionHandles: ['new-in', 'signage-supplies'],
    seoTitle: 'Cast Overlaminate Film 30 in Roll, gloss or matte | Inkyard Trade Supply',
    seoDescription: 'Optically clear cast overlaminate, 30 inch x 50 yd roll, air-release adhesive. Gloss or matte, UV and abrasion protection.',
    options: [{ name: 'Finish', displayType: 'dropdown', values: [{ value: 'Gloss' }, { value: 'Matte' }] }],
    variants: [
      { sku: 'IYD-MED-LAM-30-G', priceCents: money(112), isDefault: true, inventoryPolicy: 'continue', optionValues: { Finish: 'Gloss' } },
      { sku: 'IYD-MED-LAM-30-M', priceCents: money(116), inventoryPolicy: 'continue', optionValues: { Finish: 'Matte' } },
    ],
    images: [{ assetId: 'prod-laminate', isPrimary: true, alt: 'A roll of gloss overlaminate film' }],
  },
  unitItem({
    handle: 'foam-board-pack',
    title: 'Foam Board, 32 x 40 in — Pack of 25',
    description:
      'White-faced 3/16" foam board for mounted prints, presentation signage and short-run point-of-sale — rigid, lightweight, and cuts clean on a plotter or a straightedge. Pack of 25 sheets, 32" x 40". MOQ 1 pack. The mount-and-display board a sign shop keeps on hand.',
    price: 84,
    sku: 'IYD-BRD-FOAM-3240',
    productType: 'Board',
    categories: ['media-board'],
    collections: ['print-shop-essentials'],
    tags: ['foam-board', 'board', 'mounting', 'signage', 'pack'],
    asset: 'prod-foam-board',
    seoTitle: 'Foam Board 32 x 40 in, Pack of 25 | Inkyard Trade Supply',
    seoDescription: 'White-faced 3/16 inch foam board, 32 x 40 inch, pack of 25 sheets. Rigid, lightweight, cuts clean for mounted prints.',
  }),
  unitItem({
    handle: 'eco-solvent-ink-set',
    title: 'Eco-Solvent Ink — CMYK Set',
    description:
      'A four-colour CMYK set of eco-solvent ink for wide-format printers — bright, weatherproof, and profiled for banner, vinyl and film, in 440 mL cartridges that run clean without clogging heads. Set of 4 (C, M, Y, K). MOQ 1 set. Keep a spare set on the shelf so a colour-out never stops a job.',
    price: 168,
    sku: 'IYD-INK-ECO-CMYK',
    productType: 'Ink',
    categories: ['inks'],
    collections: ['best-sellers', 'print-shop-essentials'],
    tags: ['ink', 'eco-solvent', 'wide-format', 'cmyk', 'set'],
    asset: 'prod-eco-ink',
    seoTitle: 'Eco-Solvent Ink CMYK Set, 440 mL | Inkyard Trade Supply',
    seoDescription: 'Four-colour CMYK eco-solvent ink set, 440 mL cartridges. Weatherproof, profiled for banner, vinyl and film.',
  }),
  unitItem({
    handle: 'dye-sublimation-ink-set',
    title: 'Dye-Sublimation Ink — CMYK Set',
    description:
      'A four-colour CMYK set of dye-sublimation ink for transfer printing onto polyester and coated blanks — high colour yield, sharp gradients, and a stable formula that sublimates evenly at press temperature. Set of 4 x 1 L bottles. MOQ 1 set. The ink behind every mug, tumbler and poly tee.',
    price: 142,
    sku: 'IYD-INK-SUBLI-CMYK',
    productType: 'Ink',
    categories: ['inks'],
    collections: ['new-in', 'sublimation-station'],
    tags: ['ink', 'sublimation', 'dye-sub', 'cmyk', 'set'],
    asset: 'prod-subli-ink',
    seoTitle: 'Dye-Sublimation Ink CMYK Set, 1 L | Inkyard Trade Supply',
    seoDescription: 'Four-colour CMYK dye-sublimation ink set, 1 L bottles. High yield, sharp gradients, even sublimation.',
  }),
  {
    handle: 'sublimation-blank-mugs-case',
    title: 'Sublimation Blank Mugs — Case of 36',
    description:
      'White polymer-coated ceramic blanks for dye-sublimation, a case of 36 — an even coating that takes a full-wrap transfer edge to edge with bright, wash-durable colour. MOQ 1 case. Pick the size your line presses — the everyday 11oz or the roomier 15oz.',
    status: 'active',
    productType: 'Blank',
    vendor: VENDOR,
    tags: ['blanks', 'sublimation', 'mugs', 'ceramic', 'case'],
    categoryHandles: ['blanks'],
    collectionHandles: ['best-sellers', 'sublimation-station'],
    seoTitle: 'Sublimation Blank Mugs, Case of 36 | Inkyard Trade Supply',
    seoDescription: 'White polymer-coated ceramic sublimation blank mugs, case of 36. Even coating, full-wrap, wash-durable colour. 11oz or 15oz.',
    options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: '11 oz' }, { value: '15 oz' }] }],
    variants: [
      { sku: 'IYD-BLK-MUG-11', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '11 oz' } },
      { sku: 'IYD-BLK-MUG-15', priceCents: money(72), inventoryPolicy: 'continue', optionValues: { Size: '15 oz' } },
    ],
    images: [{ assetId: 'prod-subli-blanks', isPrimary: true, alt: 'A case of blank white sublimation mugs' }],
  },
  unitItem({
    handle: 'shop-starter-media-kit',
    title: 'Shop Starter Media Kit',
    description:
      'A curated kit of the media a new sign or print shop runs out of first — a roll of cast vinyl, a roll of application tape, a roll of banner, and a set of HTV colours, packed together and priced below the sum of the rolls. MOQ 1 kit. The fastest way to stock a floor from empty.',
    price: 269,
    sku: 'IYD-KIT-STARTER',
    productType: 'Kit',
    categories: ['media-board'],
    collections: ['new-in', 'print-shop-essentials'],
    tags: ['kit', 'starter', 'bundle', 'media'],
    asset: 'prod-starter-kit',
    seoTitle: 'Shop Starter Media Kit | Inkyard Trade Supply',
    seoDescription: 'A curated starter kit of essential print-shop media — cast vinyl, application tape, banner and HTV, priced below the sum.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'vinyl-htv', name: 'Vinyl & HTV', description: 'Cast sign vinyl, heat-transfer film and application tape.', featured: true },
    { handle: 'media-board', name: 'Media & board', description: 'Banner media, overlaminate, foam board and kits.', featured: true },
    { handle: 'inks', name: 'Inks', description: 'Eco-solvent and dye-sublimation ink sets.', featured: true },
    { handle: 'blanks', name: 'Blanks', description: 'Polymer-coated sublimation blanks.', featured: true },
  ],
  collections: [
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The lines shops reorder most.',
      type: 'manual',
      featured: true,
      productHandles: ['cast-sign-vinyl-roll', 'heat-transfer-vinyl-roll', 'scrim-banner-media-roll', 'eco-solvent-ink-set', 'sublimation-blank-mugs-case'],
    },
    {
      handle: 'new-in',
      name: 'New in',
      description: 'Lines just added to the catalog.',
      type: 'manual',
      featured: true,
      productHandles: ['overlaminate-film-roll', 'dye-sublimation-ink-set', 'shop-starter-media-kit'],
    },
    {
      handle: 'print-shop-essentials',
      name: 'Print-shop essentials',
      description: 'The media no shop floor runs without.',
      type: 'manual',
      featured: false,
      productHandles: ['application-tape-roll', 'foam-board-pack', 'eco-solvent-ink-set', 'shop-starter-media-kit'],
    },
    {
      handle: 'signage-supplies',
      name: 'Signage supplies',
      description: 'Vinyl, banner and laminate for the sign bench.',
      type: 'manual',
      featured: false,
      productHandles: ['cast-sign-vinyl-roll', 'application-tape-roll', 'scrim-banner-media-roll', 'overlaminate-film-roll'],
    },
    {
      handle: 'sublimation-station',
      name: 'Sublimation station',
      description: 'Ink, HTV and blanks for the heat press.',
      type: 'manual',
      featured: false,
      productHandles: ['heat-transfer-vinyl-roll', 'dye-sublimation-ink-set', 'sublimation-blank-mugs-case'],
    },
    {
      handle: 'bulk-media',
      name: 'Bulk media',
      description: 'Buy the case, reorder on a schedule.',
      type: 'manual',
      featured: false,
      productHandles: ['cast-sign-vinyl-roll', 'scrim-banner-media-roll'],
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
    slug: 'choosing-the-right-sign-vinyl',
    status: 'published',
    body: {
      title: 'Cast vs calendered: choosing the right sign vinyl',
      excerpt: 'They both cut and weed the same, but a cast vinyl and a calendered vinyl are built for different jobs and lifespans. Pick wrong and a wrap lifts in a season.',
      featuredImage: { $asset: 'post-vinyl-guide' },
      body: {
        type: 'doc',
        content: [
          para('Every sign shop keeps two families of vinyl on the shelf, and the fastest way to a callback is grabbing the wrong one. Cast and calendered vinyl look alike on the roll, cut alike on the plotter, and weed alike on the bench — but they are made differently, they cost differently, and they last differently. Match the film to the job and the graphic outlives the warranty; mismatch it and it shrinks, lifts or fades before the invoice is paid.'),
          h2('Cast vinyl: thin, conformable, long-life'),
          para('Cast vinyl is poured as a liquid and cured thin — around 2 mil — with almost no memory, so it conforms into rivets and compound curves and stays put. That is why it is the film for vehicle wraps, long-term outdoor decals and anything with a 5-to-7-year life. It costs more per roll, and it is worth every cent on a job that has to survive the weather and the wash.'),
          h2('Calendered vinyl: thicker, cheaper, short-to-mid term'),
          para('Calendered vinyl is squeezed through rollers, which leaves it thicker — 3 to 4 mil — and gives it a memory that wants to shrink back over time. That is fine for flat, short-to-mid-term work: interior signage, banners of decals, event graphics, anything under a couple of years on a flat surface. Do not put it on a curve or leave it in the sun for five years and expect it to behave.'),
          h2('Laminate the ones that have to last'),
          para('Whichever film you cut, a printed graphic that faces weather or wash wants an overlaminate over it — matched cast-over-cast for a wrap, a value laminate for flat work. It is the cheapest insurance in the shop: a few dollars of film that turns a two-year print into a five-year one and keeps the callback off your calendar.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'clean-sublimation-transfers',
    status: 'published',
    body: {
      title: 'Getting clean sublimation transfers, every press',
      excerpt: 'Ghosting, dull colour and banding are almost never the blank — they are time, temperature and pressure. Here is how to dial a heat press so every transfer lands sharp.',
      featuredImage: { $asset: 'post-sublimation' },
      body: {
        type: 'doc',
        content: [
          para('Dye-sublimation is unforgiving in a very specific way: when it goes right the colour is brilliant and permanent, and when it goes wrong you get ghosting, washed-out tones or a scorched blank — and you rarely get a second try on the same piece. The good news is that the variables are few and they are all controllable. Get time, temperature and pressure repeatable and the press stops being a gamble.'),
          h2('Time and temperature: match the substrate'),
          para('Sublimation happens when the ink turns to gas and bonds into a polyester or a polymer coating, and that only happens in a window of heat and time. A ceramic mug wants a different dwell than a poly tee or a hard aluminium panel — follow the blank supplier’s numbers, not a single setting for everything. Too cool or too short and the colour is muddy and under-developed; too hot or too long and you scorch the coating and yellow the whites.'),
          h2('Pressure and contact: even is everything'),
          para('The transfer only develops where the paper touches the blank under pressure. Uneven pressure — a warped platen, a lump under the shirt, a mug press out of adjustment — gives you sharp colour in one spot and a fade in the next. Check that the press closes evenly, use a nomex pad or a pillow to level a garment, and make sure the paper is taped so it cannot shift and double-image.'),
          h2('Kill the ghost: no movement, manage the moisture'),
          para('Ghosting — a faint second image offset from the first — is the paper moving as the press opens and the gas still venting. Tape the transfer down, lift the press cleanly, and pre-press a garment for a few seconds to drive off moisture before you lay the paper. Sort those three things and your reject pile all but disappears, which is the difference between a profitable sublimation line and a frustrating one.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'stock-a-media-room',
    status: 'published',
    body: {
      title: 'How to stock a media room so a job never waits on a roll',
      excerpt: 'A backordered roll of banner can cost you a Friday deadline. Here is a simple min/max system any print shop can run to keep the media on the shelf before the last roll is gone.',
      featuredImage: { $asset: 'post-media-stock' },
      body: {
        type: 'doc',
        content: [
          para('A print shop lives and dies on turnaround, and nothing kills turnaround like discovering the banner roll is empty with a job on the printer and a deadline at four. Media is the one thing you should never run out of, and keeping it stocked does not take software or a dedicated storekeeper — it takes a min/max system and the discipline to follow it.'),
          h2('Set a min and a max for every roll'),
          para('For each line you print — banner, cast vinyl, HTV colours, laminate — decide two numbers. The MIN is the reorder point: the quantity that should trigger a new order, set high enough to cover what you print over the lead time so you never hit zero while a case is in transit. The MAX is how much you hold at full — enough to buy at a case or pallet price without turning the rack into dead capital. Drop to the min, order back up to the max. That is the whole system.'),
          h2('Label the rack, not your memory'),
          para('Write the line, the width, the min and the max on the rack itself. When anyone can see at a glance that the 54-inch banner is below its min, ordering stops depending on one person remembering on a busy day. A two-roll trick makes it simpler still: when the front roll runs out, that is the signal to reorder, and the back roll carries you until the case lands.'),
          h2('Put the fast movers on a standing order'),
          para('The media you burn on a predictable schedule — banner, application tape, your house HTV colours, CMYK ink — does not need re-deciding every month. Put it on a standing order with your supplier and it arrives before you run out, priced for the volume. Reserve your attention for the exceptions, and let the boring reliable rolls take care of themselves.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'b2b-print-supply',
  key: 'sparx-b2b-print-supply',
  name: 'Print & Sign Supply (B2B / Wholesale)',
  theme: THEME,
  summary:
    'A complete, working wholesale shop for a print, signage & sublimation trade supplier: a real catalogue sold by the roll, box and case — cast vinyl & HTV, banner & board, eco-solvent & dye-sub ink, and sublimation blanks — with pack quantities, MOQs, categories, collections, a bespoke trade PDP (per-unit pricing, bulk breaks, net-30), and a full merchandised home page. Clean CMYK-adjacent theme — cool paper, press-ink primary, a magenta signal accent. Shipped as Inkyard Trade Supply.',
  tagline: 'A wholesale storefront built for the print trade.',
  vertical: 'b2b',
  industry: 'Print, signage & sublimation supply',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 85,
  brand: {
    businessName: 'Inkyard Trade Supply',
    tagline: 'Media, ink and blanks that run clean, priced for the shop.',
  },
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Inkyard Trade Supply — print, signage & sublimation distributor',
      description:
        'Inkyard is a trade supplier to print shops and sign makers — cast vinyl, HTV, banner media, wide-format & dye-sub ink and sublimation blanks by the roll and case, at trade prices, with net-30 terms and next-day dispatch. Open a trade account.',
    },
    about: {
      title: 'About Inkyard Trade Supply',
      description:
        'How Inkyard stocks, prices and ships — one catalog, one account, one invoice, wholesale media by the roll and case, and stock that is actually on the shelf when you order it.',
    },
    contact: {
      title: 'Open a trade account — Inkyard Trade Supply',
      description:
        'Set up a trade account with Inkyard: wholesale per-unit pricing, bulk breaks, net-30 terms and a dedicated account manager. Wholesale enquiries and bulk media quotes start here.',
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
