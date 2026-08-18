// sparx-b2b-restaurant-equipment — a B2B/WHOLESALE commerce site template: a commercial
// kitchen & restaurant-equipment distributor selling to TRADE BUYERS (restaurants, cafés,
// caterers and ghost kitchens).
//
// A trade-family template: a complete, working wholesale shop the moment it installs — a real
// catalogue of kitchen-grade equipment and smallwares sold by the unit and by the case (prep
// tables, an induction range, sheet pans, chef knives, food storage, a floor mixer, a heat
// lamp, service crockery, a smallwares kit), categories + collections, a bespoke trade PDP with
// a per-unit/per-case pricing-&-terms note, and the full 9-page commerce site (home merchandising
// → shop → collections → cart → search → journal → about → contact), dressed in an INLINE
// bespoke theme (warm steel ground, deep graphite primary, an ember copper signal accent, a
// sturdy grotesk). Shipped as Pass Supply Co.
//
// SELF-CONTAINED BY DESIGN. A trade-family generator carries its OWN theme inline and passes
// it on the spec (`theme`), so the whole family can be authored in parallel without any two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-restaurant-equipment.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-restaurant-equipment/**" \
//     "marketplace-catalog/_gen/gen-b2b-restaurant-equipment.ts"
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
// A commercial-kitchen distributor: a warm steel-grey paper ground, deep graphite ink, a
// warm-graphite primary (the brushed-steel of a prep line) and an ember copper signal accent
// (the flame on the range). Complete light + dark, AA on every role (the blueprint sweep's
// contrast check is the gate). The accent is a DEEP copper (~52% L) so it stays legible as
// link/label text on the light ground, and the secondary is a dark warm slate so labels never
// wash out. A sturdy grotesk display over a humanist sans — kitchen-grade, spec-forward.
const THEME = defineTheme({
  name: 'linecook-trade',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: ['oklch(97% 0.005 75)', 'oklch(94% 0.008 72)', 'oklch(89% 0.012 70)', 'oklch(23% 0.015 60)'],
    roles: {
      primary: 'oklch(37% 0.025 60)',
      secondary: 'oklch(43% 0.025 60)',
      accent: 'oklch(52% 0.14 48)',
      neutral: 'oklch(27% 0.02 60)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(22% 0.015 60)', 'oklch(18% 0.015 60)', 'oklch(15% 0.015 60)', 'oklch(95% 0.005 75)'],
    roles: {
      primary: 'oklch(80% 0.03 72)',
      secondary: 'oklch(81% 0.025 72)',
      accent: 'oklch(72% 0.14 52)',
      neutral: 'oklch(32% 0.02 60)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "kit-hero": "https://images.unsplash.com/photo-1708915965975-2a950db0e215?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhaW5sZXNzJTIwY29tbWVyY2lhbCUyMGtpdGNoZW4lMjBsaW5lJTIwcmVhZHklMjBzZXJ2aWNlfGVufDB8MHx8fDE3ODY0MjE5Nzd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kit-tile-cooking": "https://images.unsplash.com/photo-1589109807644-924edf14ee09?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Y29tbWVyY2lhbCUyMHJhbmdlJTIwY29va3RvcCUyMGJ1c3klMjBraXRjaGVuJTIwbGluZXxlbnwwfDB8fHwxNzg2NDIxOTgwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kit-tile-prep": "https://images.unsplash.com/photo-1760001553414-5634201efc36?ixid=M3wxMjA3fDB8MXxzZWFyY2h8NHx8c3RhaW5sZXNzJTIwcHJlcCUyMHRhYmxlcyUyMGZvb2QlMjBzdG9yYWdlJTIwYmFjayUyMGtpdGNoZW58ZW58MHwwfHx8MTc4NjQyMTk4M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kit-tile-foh": "https://images.unsplash.com/photo-1519233991914-26a44330ccd7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhdGVkJTIwZGlzaCUyMHVuZGVyJTIwaGVhdCUyMGxhbXAlMjBwYXNzfGVufDB8MHx8fDE3ODY0MjE5ODh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kit-tile-smallwares": "https://images.unsplash.com/photo-1644258676710-ffb99d7d7a1b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hlZiUyMGtuaXZlcyUyMHNtYWxsd2FyZXMlMjBsYWlkJTIwb3V0JTIwYmVuY2h8ZW58MHwwfHx8MTc4NjQyMTk5MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kit-band-trade": "https://images.unsplash.com/photo-1589792923962-537704632910?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FyZWhvdXNlJTIwdGVhbSUyMGxvYWRpbmclMjBraXRjaGVuJTIwZXF1aXBtZW50JTIwZGVsaXZlcnl8ZW58MHwwfHx8MTc4NjQyMTk5M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-prep-table": "https://images.unsplash.com/photo-1754153266020-6e782d825601?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8c3RhaW5sZXNzJTIwc3RlZWwlMjBjb21tZXJjaWFsJTIwcHJlcCUyMHRhYmxlfGVufDB8MHx8fDE3ODY0MjE5OTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-induction": "https://images.unsplash.com/photo-1666479258732-5ea17469b610?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Y291bnRlcnRvcCUyMGNvbW1lcmNpYWwlMjBpbmR1Y3Rpb24lMjByYW5nZXxlbnwwfDB8fHwxNzg2NDIyMDAwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-fry-pan": "https://images.unsplash.com/photo-1624031000828-dba1b7a3e4ce?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGNvbW1lcmNpYWwlMjBhbHVtaW5pdW0lMjBmcnklMjBwYW5zfGVufDB8MHx8fDE3ODY0MjIwMDN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-sheet-pans": "https://images.unsplash.com/photo-1529685594910-3b12ce0b9120?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBmdWxsLXNpemUlMjBhbHVtaW5pdW0lMjBzaGVldCUyMHBhbnN8ZW58MHwwfHx8MTc4NjQyMjAwNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-chef-knife": "https://images.unsplash.com/photo-1622021142947-da7dedc7c39a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGVpZ2h0LWluY2glMjBjaGVmfGVufDB8MHx8fDE3ODY0MjIwMDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-food-containers": "https://images.unsplash.com/photo-1771142061210-95e97225641e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGNsZWFyJTIwcG9seWNhcmJvbmF0ZXxlbnwwfDB8fHwxNzg2NDIyMzE1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-mixer": "https://images.unsplash.com/photo-1739294525052-770fcecdd6b6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29tbWVyY2lhbCUyMHBsYW5ldGFyeSUyMGZsb29yJTIwbWl4ZXJ8ZW58MHwwfHx8MTc4NjQyMjAxNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-heat-lamp": "https://images.unsplash.com/photo-1547186577-a3f4fa07c2ef?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RyaXAlMjBoZWF0JTIwbGFtcHxlbnwwfDB8fHwxNzg2NDIyMzE5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-dinner-plates": "https://images.unsplash.com/photo-1614548539644-ef528186523a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjB3aGl0ZSUyMGNvdXBlJTIwZGlubmVyJTIwcGxhdGVzfGVufDB8MHx8fDE3ODY0MjIwMjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-open-kitchen": "https://images.unsplash.com/photo-1768314669089-480e608a0143?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmV3bHklMjBmaXR0ZWQlMjBjb21tZXJjaWFsJTIwa2l0Y2hlbiUyMGJlZm9yZSUyMG9wZW5pbmd8ZW58MHwwfHx8MTc4NjQyMjAyN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-cookware": "https://images.unsplash.com/photo-1584990347193-6bebebfeaeee?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8aGVhdnklMjBjb21tZXJjaWFsJTIwY29va3dhcmV8ZW58MHwwfHx8MTc4NjQyMjMyNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-smallwares": "https://images.unsplash.com/photo-1762922425155-d03e6997e33e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGx3YXJlcyUyMHN0YWNrZWQlMjBvcmdhbmlzZWQlMjBwcmVwJTIwc2hlbGZ8ZW58MHwwfHx8MTc4NjQyMjAzM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'kit-hero', url: src('kit-hero'), alt: 'A stainless commercial kitchen line ready for service' },
  { id: 'kit-tile-cooking', url: src('kit-tile-cooking'), alt: 'A commercial range and cooktop on a busy kitchen line' },
  { id: 'kit-tile-prep', url: src('kit-tile-prep'), alt: 'Stainless prep tables and food storage in a back kitchen' },
  { id: 'kit-tile-foh', url: src('kit-tile-foh'), alt: 'A plated dish under a heat lamp at the pass' },
  { id: 'kit-tile-smallwares', url: src('kit-tile-smallwares'), alt: 'Chef knives and smallwares laid out on a bench' },
  { id: 'kit-band-trade', url: src('kit-band-trade'), alt: 'A warehouse team loading kitchen equipment for delivery' },
  { id: 'prod-prep-table', url: src('prod-prep-table'), alt: 'A stainless steel commercial prep table' },
  { id: 'prod-induction', url: src('prod-induction'), alt: 'A countertop commercial induction range' },
  { id: 'prod-fry-pan', url: src('prod-fry-pan'), alt: 'A case of commercial aluminium fry pans' },
  { id: 'prod-sheet-pans', url: src('prod-sheet-pans'), alt: 'A stack of full-size aluminium sheet pans' },
  { id: 'prod-chef-knife', url: src('prod-chef-knife'), alt: "A case of eight-inch chef's knives" },
  { id: 'prod-food-containers', url: src('prod-food-containers'), alt: 'A case of clear polycarbonate food storage containers' },
  { id: 'prod-mixer', url: src('prod-mixer'), alt: 'A commercial planetary floor mixer' },
  { id: 'prod-heat-lamp', url: src('prod-heat-lamp'), alt: 'A strip heat lamp over a service pass' },
  { id: 'prod-dinner-plates', url: src('prod-dinner-plates'), alt: 'A stack of white coupe dinner plates' },
  { id: 'prod-smallwares-kit', url: src('prod-smallwares-kit'), alt: 'A line-cook smallwares starter kit laid out' },
  { id: 'post-open-kitchen', url: src('post-open-kitchen'), alt: 'A newly fitted commercial kitchen before opening' },
  { id: 'post-cookware', url: src('post-cookware'), alt: 'Heavy commercial cookware on a hot range' },
  { id: 'post-smallwares', url: src('post-smallwares'), alt: 'Smallwares stacked and organised on a prep shelf' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-b2b-restaurant-equipment: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one kitchen-line photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a trade-account link. The link
 *  carries the "Open a trade account" call the platform navbar CTA also points at (/contact).
 *  Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('kit-hero'), alt: 'A stainless commercial kitchen line ready for service', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Kit out the line. Keep it running.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Pass Supply Co. outfits commercial kitchens — restaurants, cafés, caterers and ghost kitchens. The prep tables, cooking gear, storage and smallwares a working line runs on, sold by the unit and by the case, priced for the trade and dispatched fast.',
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
            text: 'Shop by station',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'kit-tile-cooking', label: 'Cooking', href: '/shop', alt: 'A commercial range on the line' }),
              categoryTile({ assetId: 'kit-tile-prep', label: 'Prep & storage', href: '/shop', alt: 'Stainless prep tables and food storage' }),
              categoryTile({ assetId: 'kit-tile-foh', label: 'Front of house', href: '/shop', alt: 'A plated dish under a heat lamp' }),
              categoryTile({ assetId: 'kit-tile-smallwares', label: 'Smallwares', href: '/shop', alt: 'Chef knives and smallwares on a bench' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The trade-terms band — pure COPY, no photo. Four cards spell out how wholesale ordering
 *  works here: per-unit/per-case trade pricing with volume breaks, net-30 for approved
 *  accounts, fast dispatch, and a named account manager. The tenant configures the real B2B
 *  pricing tiers, approval rules and terms in the Commerce module; this band SELLS the
 *  arrangement. */
function tradeTermsBand(): Node {
  const card = (title: string, body: string): Node =>
    el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
      children: [
        el('h3', 'text-lg font-bold tracking-tight text-base-content', { text: title }),
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
                text: 'Built for the way kitchens buy',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Open a trade account and you buy the way an operator should — by the unit and the case, at wholesale rates, on terms. No consumer markups, no runaround when a line goes down mid-service.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              card('Trade pricing', 'Per-unit and per-case wholesale rates with volume breaks that deepen as your order grows. Kit a whole line or restock a station — the more you buy, the less each piece costs.'),
              card('Net-30 terms', 'Approved accounts order now and pay later on net-30. Open a second location or restock the walk-in without tying up the operating cash on every run.'),
              card('Fast dispatch', 'In-stock lines ship the same or next business day from our warehouse, so a broken mixer or a short case of pans never idles a shift.'),
              card('Your account manager', 'A direct line to a real person who knows your kitchen, your standing order and what you burn through — not a ticket queue at 4pm on a Friday.'),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Best sellers on the line' }),
  tradeTermsBand(),
  productsBlock({ source: 'commerce.category.smallwares', layout: 'carousel', heading: 'Smallwares by the case' }),
  editorialBand({
    heading: 'One supplier for the whole kitchen',
    lead: 'From the prep line to the pass, kit the whole kitchen from one trade account instead of chasing a dozen vendors. One catalog to buy from, one statement to reconcile, and one person who picks up the phone when a line is short before Friday service.',
    assetId: 'kit-band-trade',
    cta: 'Open a trade account',
    href: '/contact',
    alt: 'A warehouse team loading kitchen equipment for delivery',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (vendor label, title, per-unit/per-case
 *  price, low-stock, description, size/spec options + add-to-cart, a static "Trade pricing &
 *  terms" note with volume breaks + net-30, and policy links). */
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
                    text: 'Pass Supply Co.',
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
                    text: 'The price shown is the list rate — per unit for equipment, per case for smallwares. Trade accounts unlock volume breaks — deeper pricing when you kit a full line, open a second location, or order to a standing schedule — set for your account in your dashboard.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Outfitted together' });

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
    'Every line we stock — cooking, prep and storage, front of house, and smallwares, sold by the unit and the case. Filter by station or sort by price; trade accounts see their contract pricing at checkout.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The catalog grouped the way an operator actually buys — best sellers, new lines just in, everything to open a kitchen from empty, the front-of-house service kit, and the smallwares you reorder by the case.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search the catalog', 'Know the model, the size, or the spec you need? Search the whole catalog and the field notes below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Review the equipment and cases in your order before you check out. Trade accounts see contract pricing and net-30 terms applied here; everyone gets fast dispatch on in-stock lines. Kitting a whole line? Your account manager can turn around a formal quote.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Field notes' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Practical guidance from operators and our warehouse floor — how to kit out a new kitchen, choose cookware that survives service, and buy smallwares that last. Written for the people running the line, not for a catalog.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Pass Supply' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Pass Supply Co. is a commercial kitchen and restaurant-equipment distributor. We stock the durable, essential gear a working kitchen runs on — prep tables, cooking equipment, food storage, front-of-house service and smallwares — and we sell it to the trade by the unit and the case, at wholesale, on terms.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We built the business around one idea: an operator opening a room or restocking a line should not have to chase a dozen suppliers, eat consumer markups, or wait a week for a case of sheet pans. One catalog, one account, one invoice, and stock that is actually on the shelf when service depends on it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No minimum-order gymnastics, no mystery lead times, no pricing that changes because you asked. Just kitchen-grade gear, priced fairly and out the door — the boring reliability a good kitchen is built on.',
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
    intro: 'Tell us what your kitchen goes through and we will price your regular lines, set you up on net-30 terms, and put a name and a number to your account. Fit-out quotes, standing orders and multi-location supply all start here.',
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

const VENDOR = 'Pass Supply Co.';

/** A single-SKU unit/case line — one price, no options (most lines ship one spec). */
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
    handle: 'stainless-prep-table',
    title: 'Stainless Prep Table, 18-Gauge',
    description:
      'A workhorse 18-gauge 304 stainless prep table with a welded frame, adjustable galvanised undershelf and bullet feet — the flat, cleanable surface every station is built around. Ships flat-packed, one table. MOQ 1. Pick your length to fit the line.',
    status: 'active',
    productType: 'Prep & storage',
    vendor: VENDOR,
    tags: ['prep', 'work-table', 'stainless', 'nsf'],
    categoryHandles: ['prep-storage'],
    collectionHandles: ['best-sellers', 'open-a-kitchen', 'prep-line-essentials'],
    seoTitle: 'Stainless Prep Table, 18-Gauge | Pass Supply Co.',
    seoDescription: 'An 18-gauge 304 stainless commercial prep table with undershelf, sold by the unit. 48, 60 or 72 inch.',
    options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: '48 in' }, { value: '60 in' }, { value: '72 in' }] }],
    variants: [
      { sku: 'PSC-PREP-TBL-48', priceCents: money(219), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '48 in' } },
      { sku: 'PSC-PREP-TBL-60', priceCents: money(259), inventoryPolicy: 'continue', optionValues: { Size: '60 in' } },
      { sku: 'PSC-PREP-TBL-72', priceCents: money(299), inventoryPolicy: 'continue', optionValues: { Size: '72 in' } },
    ],
    images: [{ assetId: 'prod-prep-table', isPrimary: true, alt: 'A stainless steel commercial prep table' }],
  },
  caseItem({
    handle: 'countertop-induction-range',
    title: 'Countertop Induction Range, 1800W',
    description:
      'A commercial 1800W countertop induction range with digital power and temperature control and a schott-glass top — fast, precise, flameless heat for a prep station, a satellite line or a front-of-house action station. 120V, plugs into a standard outlet. Sold by the unit. MOQ 1.',
    price: 289,
    sku: 'PSC-COOK-IND-1800',
    productType: 'Cooking',
    categories: ['cooking'],
    collections: ['new-in', 'open-a-kitchen'],
    tags: ['cooking', 'induction', 'countertop', 'equipment'],
    asset: 'prod-induction',
    seoTitle: 'Countertop Induction Range, 1800W | Pass Supply Co.',
    seoDescription: 'A commercial 1800W countertop induction range with digital control and glass top. 120V, sold by the unit.',
  }),
  caseItem({
    handle: 'fry-pans-case',
    title: 'Aluminium Fry Pans, 10 in — Case of 6',
    description:
      'Heavy-gauge 3004 aluminium fry pans, 10", with a natural finish and a riveted stay-cool handle — the everyday sauté pan a line burns through and replaces. Case of 6. MOQ 2 cases. Even heat, fast response, tough enough for the flat-top.',
    price: 96,
    sku: 'PSC-COOK-FRY-10',
    productType: 'Cooking',
    categories: ['cooking'],
    collections: ['bulk-smallwares'],
    tags: ['cooking', 'cookware', 'fry-pan', 'aluminium'],
    asset: 'prod-fry-pan',
    seoTitle: 'Aluminium Fry Pans 10 in, Case of 6 | Pass Supply Co.',
    seoDescription: 'Heavy-gauge 3004 aluminium 10 inch fry pans with riveted handles, case of 6. The everyday line sauté pan.',
  }),
  caseItem({
    handle: 'sheet-pans-case',
    title: 'Aluminium Sheet Pans, Full Size — Case of 12',
    description:
      '18" x 26" full-size 19-gauge aluminium sheet pans with a wire-reinforced rolled rim that will not warp on a hot deck. Case of 12. MOQ 2 cases. The single most-used pan in any kitchen — buy the case, you always need more.',
    price: 84,
    sku: 'PSC-COOK-SHEET-FS',
    productType: 'Cooking',
    categories: ['cooking'],
    collections: ['best-sellers', 'bulk-smallwares'],
    tags: ['cooking', 'bakeware', 'sheet-pan', 'aluminium'],
    asset: 'prod-sheet-pans',
    seoTitle: 'Aluminium Sheet Pans, Full Size, Case of 12 | Pass Supply Co.',
    seoDescription: 'Full-size 18x26 inch 19-gauge aluminium sheet pans, wire-reinforced rim, case of 12. Warp-resistant.',
  }),
  caseItem({
    handle: 'chef-knife-case',
    title: "Chef's Knife, 8 in — Case of 6",
    description:
      'A forged high-carbon stainless 8" chef\'s knife with a full tang and a moulded, dishwasher-safe polypropylene handle rated NSF — sharp out of the box and easy to hone. Case of 6. MOQ 1 case. Kit the whole line or keep spares in the drawer.',
    price: 132,
    sku: 'PSC-SW-CHEF-8',
    productType: 'Smallwares',
    categories: ['smallwares'],
    collections: ['best-sellers', 'open-a-kitchen', 'prep-line-essentials', 'bulk-smallwares'],
    tags: ['smallwares', 'knife', 'cutlery', 'nsf'],
    asset: 'prod-chef-knife',
    seoTitle: "Chef's Knife 8 in, Case of 6 | Pass Supply Co.",
    seoDescription: "A forged high-carbon stainless 8 inch chef's knife, full tang, NSF handle, case of 6.",
  }),
  {
    handle: 'food-storage-containers-case',
    title: 'Polycarbonate Food Storage Containers — Case of 12',
    description:
      'Clear, break-resistant polycarbonate food storage containers with graduated measure marks, stackable and rated for the walk-in and the reach-in — the square container that organises every prep shelf. Case of 12, lids sold separately. MOQ 1 case. Pick your size.',
    status: 'active',
    productType: 'Prep & storage',
    vendor: VENDOR,
    tags: ['prep', 'storage', 'food-container', 'nsf'],
    categoryHandles: ['prep-storage'],
    collectionHandles: ['best-sellers', 'prep-line-essentials', 'bulk-smallwares'],
    seoTitle: 'Polycarbonate Food Storage Containers, Case of 12 | Pass Supply Co.',
    seoDescription: 'Clear graduated polycarbonate food storage containers, stackable, case of 12. 2, 6 or 12 quart.',
    options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: '2 qt' }, { value: '6 qt' }, { value: '12 qt' }] }],
    variants: [
      { sku: 'PSC-STOR-PC-2', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '2 qt' } },
      { sku: 'PSC-STOR-PC-6', priceCents: money(74), inventoryPolicy: 'continue', optionValues: { Size: '6 qt' } },
      { sku: 'PSC-STOR-PC-12', priceCents: money(92), inventoryPolicy: 'continue', optionValues: { Size: '12 qt' } },
    ],
    images: [{ assetId: 'prod-food-containers', isPrimary: true, alt: 'A case of clear polycarbonate food storage containers' }],
  },
  {
    handle: 'planetary-floor-mixer',
    title: 'Planetary Floor Mixer',
    description:
      'A gear-driven commercial planetary mixer with a #12 hub, three fixed speeds and a stainless bowl, whip, hook and paddle included — the bench a bakery or a busy prep kitchen leans on for dough, batter and everything in between. Sold by the unit. MOQ 1. Pick the capacity your volume needs.',
    status: 'active',
    productType: 'Prep & storage',
    vendor: VENDOR,
    tags: ['prep', 'mixer', 'bakery', 'equipment'],
    categoryHandles: ['prep-storage'],
    collectionHandles: ['new-in', 'open-a-kitchen'],
    seoTitle: 'Planetary Floor Mixer | Pass Supply Co.',
    seoDescription: 'A gear-driven commercial planetary floor mixer with bowl, whip, hook and paddle. 20 or 30 quart, sold by the unit.',
    options: [{ name: 'Capacity', displayType: 'dropdown', values: [{ value: '20 qt' }, { value: '30 qt' }] }],
    variants: [
      { sku: 'PSC-PREP-MIX-20', priceCents: money(1290), isDefault: true, inventoryPolicy: 'continue', optionValues: { Capacity: '20 qt' } },
      { sku: 'PSC-PREP-MIX-30', priceCents: money(1690), inventoryPolicy: 'continue', optionValues: { Capacity: '30 qt' } },
    ],
    images: [{ assetId: 'prod-mixer', isPrimary: true, alt: 'A commercial planetary floor mixer' }],
  },
  {
    handle: 'strip-heat-lamp',
    title: 'Strip Heat Lamp',
    description:
      'An infrared strip heat lamp with a brushed-aluminium housing and a toggle switch, mounts over the pass to hold plated food at temperature without drying it out. Sold by the unit. MOQ 1. Pick the length to span your window.',
    status: 'active',
    productType: 'Front of house',
    vendor: VENDOR,
    tags: ['front-of-house', 'heat-lamp', 'holding', 'equipment'],
    categoryHandles: ['front-of-house'],
    collectionHandles: ['new-in', 'front-of-house-service'],
    seoTitle: 'Strip Heat Lamp | Pass Supply Co.',
    seoDescription: 'An infrared strip heat lamp with brushed-aluminium housing for the pass. 24, 36 or 48 inch, sold by the unit.',
    options: [{ name: 'Length', displayType: 'dropdown', values: [{ value: '24 in' }, { value: '36 in' }, { value: '48 in' }] }],
    variants: [
      { sku: 'PSC-FOH-LAMP-24', priceCents: money(139), isDefault: true, inventoryPolicy: 'continue', optionValues: { Length: '24 in' } },
      { sku: 'PSC-FOH-LAMP-36', priceCents: money(169), inventoryPolicy: 'continue', optionValues: { Length: '36 in' } },
      { sku: 'PSC-FOH-LAMP-48', priceCents: money(199), inventoryPolicy: 'continue', optionValues: { Length: '48 in' } },
    ],
    images: [{ assetId: 'prod-heat-lamp', isPrimary: true, alt: 'A strip heat lamp over a service pass' }],
  },
  caseItem({
    handle: 'coupe-dinner-plates-case',
    title: 'Coupe Dinner Plates, 10½ in — Case of 24',
    description:
      'Bright-white, fully vitrified coupe dinner plates, 10½", with a rolled edge that resists chipping through the dish pit — the clean, rimless plate that lets the food do the talking. Case of 24. MOQ 2 cases. Restaurant-grade and rewash-after-rewash durable.',
    price: 168,
    sku: 'PSC-FOH-PLATE-105',
    productType: 'Front of house',
    categories: ['front-of-house'],
    collections: ['front-of-house-service', 'bulk-smallwares'],
    tags: ['front-of-house', 'crockery', 'dinnerware', 'vitrified'],
    asset: 'prod-dinner-plates',
    seoTitle: 'Coupe Dinner Plates 10½ in, Case of 24 | Pass Supply Co.',
    seoDescription: 'Bright-white fully vitrified coupe dinner plates, 10.5 inch, chip-resistant rolled edge, case of 24.',
  }),
  caseItem({
    handle: 'smallwares-starter-kit',
    title: 'Line Cook Smallwares Starter Kit',
    description:
      'A curated kit of the smallwares a new line or a satellite station runs out of first — a chef\'s knife, a set of tongs, a fish spatula, measuring cups and spoons, a bench scraper, mixing bowls and quarter-pans — packed together and priced below the sum of its cases. MOQ 1 kit. The fastest way to arm a station from empty.',
    price: 219,
    sku: 'PSC-SW-KIT-STARTER',
    productType: 'Smallwares',
    categories: ['smallwares'],
    collections: ['new-in', 'open-a-kitchen'],
    tags: ['smallwares', 'kit', 'starter', 'bundle'],
    asset: 'prod-smallwares-kit',
    seoTitle: 'Line Cook Smallwares Starter Kit | Pass Supply Co.',
    seoDescription: 'A curated starter kit of essential line smallwares — knife, tongs, spatula, measures and more, priced below the sum.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'cooking', name: 'Cooking', description: 'Ranges, cookware and bakeware.', featured: true },
    { handle: 'prep-storage', name: 'Prep & storage', description: 'Prep tables, mixers and food storage.', featured: true },
    { handle: 'front-of-house', name: 'Front of house', description: 'Holding, service and crockery.', featured: true },
    { handle: 'smallwares', name: 'Smallwares', description: 'Knives, tools and station kits.', featured: true },
  ],
  collections: [
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The lines kitchens reorder most.',
      type: 'manual',
      featured: true,
      productHandles: ['stainless-prep-table', 'sheet-pans-case', 'chef-knife-case', 'food-storage-containers-case'],
    },
    {
      handle: 'new-in',
      name: 'New in',
      description: 'Lines just added to the catalog.',
      type: 'manual',
      featured: true,
      productHandles: ['countertop-induction-range', 'planetary-floor-mixer', 'strip-heat-lamp', 'smallwares-starter-kit'],
    },
    {
      handle: 'open-a-kitchen',
      name: 'Open a kitchen',
      description: 'Everything to fit out a line from empty.',
      type: 'manual',
      featured: true,
      productHandles: ['stainless-prep-table', 'countertop-induction-range', 'planetary-floor-mixer', 'chef-knife-case', 'smallwares-starter-kit'],
    },
    {
      handle: 'prep-line-essentials',
      name: 'Prep-line essentials',
      description: 'The gear no prep station runs without.',
      type: 'manual',
      featured: false,
      productHandles: ['stainless-prep-table', 'food-storage-containers-case', 'chef-knife-case'],
    },
    {
      handle: 'front-of-house-service',
      name: 'Front-of-house service',
      description: 'Hold it hot, plate it clean.',
      type: 'manual',
      featured: false,
      productHandles: ['strip-heat-lamp', 'coupe-dinner-plates-case'],
    },
    {
      handle: 'bulk-smallwares',
      name: 'Bulk smallwares',
      description: 'Buy the case, reorder on a schedule.',
      type: 'manual',
      featured: false,
      productHandles: ['fry-pans-case', 'sheet-pans-case', 'chef-knife-case', 'food-storage-containers-case', 'coupe-dinner-plates-case'],
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
    slug: 'kit-out-a-new-kitchen-line',
    status: 'published',
    body: {
      title: 'How to kit out a new kitchen line without overspending',
      excerpt: 'Opening a room is where budgets get blown — on equipment you did not need or a spec you paid double for. Here is how to outfit a line that cooks well and costs right.',
      featuredImage: { $asset: 'post-open-kitchen' },
      body: {
        type: 'doc',
        content: [
          para('The equipment bill for a new kitchen is the easiest place to overspend, because everything looks essential when the room is empty and the opening date is close. It is not. A working line is built from a short list of things you genuinely use every service and a longer list of things a rep will happily sell you. Get the first list right, buy the second only when a dish demands it, and you open on budget.'),
          h2('Start with the stations, not the catalog'),
          para('Walk the menu, not the showroom. For each dish, ask what station cooks it and what that station physically needs — a flat surface to work on, a heat source, storage for mise, and the smallwares to handle it. That exercise turns "a kitchen" into a concrete list: this many prep tables, this cooking gear, this much food storage, these knives and pans. Buy that list. Everything not on it is a maybe, and a maybe can wait until you are open and know you need it.'),
          h2('Buy the durable things once, the consumables by the case'),
          para('Split the list in two. The durable equipment — prep tables, a range, a mixer, a heat lamp — you buy once, so buy it in a spec that survives a decade of service; the cheap version fails in year two and costs you a closed station to replace. The consumables — pans, containers, knives, plates — you buy again and again, so buy them by the case at trade pricing and keep a backup on the shelf. The mistake is doing it backwards: over-speccing the disposable and cutting the corner on the thing that has to last.'),
          h2('Put it on one account'),
          para('Sourcing a fit-out from a dozen vendors turns opening week into a spreadsheet of tracking numbers. Kit the whole line from one trade account instead — one catalog, one delivery window, one invoice, and one person to call when a table shows up scratched. Open the account before you order the first table; the volume pricing on a full fit-out is the whole reason to.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'commercial-cookware-that-survives-service',
    status: 'published',
    body: {
      title: 'Choosing commercial cookware that survives service',
      excerpt: 'Home cookware dies in a commercial kitchen — wrong metal, wrong gauge, wrong handle. Here is how to spec pans and cookware that take the abuse of a real line.',
      featuredImage: { $asset: 'post-cookware' },
      body: {
        type: 'doc',
        content: [
          para('A commercial line destroys consumer cookware in weeks. The heat is higher, the pans get slammed on burners and stacked wet, and nobody babies them. Cookware that lasts is not about the brand on the handle — it is about matching the metal, the gauge and the handle to the work. Spec it right and a pan outlasts the cook using it.'),
          h2('Metal and gauge do the work'),
          para('For most line cooking, heavy-gauge aluminium is the workhorse: it heats fast and even, responds instantly when you pull it off the flame, and it is cheap enough to replace without flinching. Reach for stainless where you need durability and a non-reactive surface for acidic sauces, and for induction where the top demands a magnetic base. The number that matters is the gauge — the thickness of the metal. A thin pan warps on a hot burner and cooks in hot spots; a heavier gauge stays flat and even for years. Pay for the gauge; it is the difference between a pan and a frisbee.'),
          h2('The handle is what fails first'),
          para('On a busy line the handle is what gives out — it loosens, it heats up, or it snaps. Look for a riveted handle, not spot-welded, because rivets survive the thermal cycling and the drops that kill a weld. For anything going in a hot oven, skip the silicone sleeve that melts and spec a metal stay-cool handle instead. And check that the whole pan is dishwasher-and-oven rated, because in a real kitchen it will see both, whether the spec sheet expected it or not.'),
          h2('Buy the movers by the case'),
          para('Sauté pans, sheet pans and the everyday sizes are consumables — they get used every service and they wear out. Keep a case of the ones you burn through on the shelf, set a reorder point, and buy them at trade pricing so a warped pan gets retired, not nursed along. The only real cookware mistake is running a station on the last good pan in the rack.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'buying-smallwares-that-last',
    status: 'published',
    body: {
      title: 'NSF, dishwasher-safe, and buying smallwares that last',
      excerpt: 'Smallwares are cheap individually and ruinous in aggregate when you rebuy them every quarter. Here is how to spec knives, storage and tools that go the distance.',
      featuredImage: { $asset: 'post-smallwares' },
      body: {
        type: 'doc',
        content: [
          para('Smallwares are the quiet line item that adds up. Any single knife, container or pair of tongs is cheap, so nobody sweats the spec — and then the kitchen rebuys the whole drawer every few months because none of it was built to last. Buy smallwares the way you buy equipment: to a standard, in volume, once.'),
          h2('Look for the NSF mark'),
          para('The NSF certification on a piece of smallware is not red tape — it is a promise the thing can be cleaned and will survive being cleaned, over and over, in a commercial dish pit. It means smooth, non-porous surfaces with no seams for bacteria to hide in, and materials rated for the temperatures a sanitiser and a dishwasher hit. A health inspector looks for it; so should you. If a container or a handle is not NSF-rated, assume it will not last and may not pass.'),
          h2('Dishwasher-safe or it will not survive'),
          para('Everything in a kitchen goes through the machine, whatever the label says — so buy as if it will. Polypropylene and moulded handles take the heat; wood and cheap silicone do not. Polycarbonate food containers survive the walk-in and the wash; the clear ones you can see stock through save a cook from opening five lids to find the demi. Spec for the dish pit up front and you stop replacing warped, cracked and delaminated smallwares on a quarterly cycle.'),
          h2('Standardise, then buy by the case'),
          para('Pick one chef\'s knife, one container system, one plate, and kit the whole kitchen with it. Standardising means a lid always fits, a spare is always the same, and a new hire is not learning three different tools. Then buy your standard by the case at trade pricing and keep backups on the shelf — so a lost knife or a cracked container is a two-minute swap from stock, not a special order that leaves a station short through service.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'b2b-restaurant-equipment',
  key: 'sparx-b2b-restaurant-equipment',
  name: 'Restaurant Equipment (B2B / Wholesale)',
  theme: THEME,
  summary:
    'A complete, working wholesale shop for a commercial kitchen & restaurant-equipment distributor: a real trade catalogue sold by the unit and the case — prep tables, cooking gear, food storage, front-of-house service and smallwares — with categories, collections, a bespoke trade PDP (per-unit/per-case pricing, volume breaks, net-30), and a full merchandised home page. Kitchen-grade theme — warm steel ground, deep graphite, an ember copper accent. Shipped as Pass Supply Co.',
  tagline: 'A wholesale storefront built for commercial kitchens.',
  vertical: 'b2b',
  industry: 'Restaurant equipment & smallwares',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 85,
  brand: {
    businessName: 'Pass Supply Co.',
    tagline: 'Kit out the line. Keep it running.',
  },
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Pass Supply Co. — commercial kitchen & restaurant equipment',
      description:
        'Pass Supply is a commercial kitchen and restaurant-equipment distributor — prep tables, cooking gear, food storage, front-of-house service and smallwares, sold by the unit and the case at trade prices, with net-30 terms and fast dispatch. Open a trade account.',
    },
    about: {
      title: 'About Pass Supply Co.',
      description:
        'How Pass Supply stocks, prices and ships — one catalog, one account, one invoice, wholesale by the unit and the case, and kitchen-grade gear that is on the shelf when service depends on it.',
    },
    contact: {
      title: 'Open a trade account — Pass Supply Co.',
      description:
        'Set up a trade account with Pass Supply: wholesale per-unit and per-case pricing, volume breaks, net-30 terms and a dedicated account manager. Fit-out quotes and multi-location supply start here.',
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
