// sparx-b2b-building-materials — a B2B/WHOLESALE commerce site template: a builders'
// merchant selling building materials to TRADE BUYERS (builders, groundworkers & trades).
//
// A complete, working wholesale yard the moment it installs — a real catalogue sold by the
// pack / pallet / length / bulk bag (timber, sheet, plasterboard, cement, insulation, fixings,
// sealant, aggregates, safety), categories + collections, a bespoke trade PDP with a
// pricing-&-delivery note, and the full 9-page commerce site (home merchandising → shop →
// collections → cart → search → journal → about → contact), dressed in an INLINE bespoke theme
// (warm concrete-yard ground, deep timber-bark primary, safety-ochre signal accent, a sturdy
// condensed grotesk). Shipped as Yardstock Trade Supplies.
//
// SELF-CONTAINED BY DESIGN. A trade-family generator carries its OWN theme inline and passes
// it on the spec (`theme`), so the whole family can be authored in parallel without any two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-building-materials.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-building-materials/**" \
//     "marketplace-catalog/_gen/gen-b2b-building-materials.ts"
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
// A builders' merchant yard: a warm concrete-grey paper ground, dark warm ink, a deep
// timber-bark primary and a safety-ochre signal accent, under a sturdy condensed grotesk
// (yard-signage caps) over a humanist sans. Complete light + dark, AA on every role (the
// blueprint sweep's contrast check is the gate). The accent is a DEEP ochre (~50% L) so the
// safety-yellow reads legibly as link/label text on the light ground, and the secondary is a
// dark warm slate so labels never wash out.
const THEME = defineTheme({
  name: 'yardstock-trade',
  type: { body: face('Inter', 'sans-serif'), head: face('Oswald', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: ['oklch(96% 0.008 85)', 'oklch(93% 0.011 82)', 'oklch(88% 0.014 80)', 'oklch(24% 0.02 75)'],
    roles: {
      primary: 'oklch(36% 0.05 60)',
      secondary: 'oklch(42% 0.03 65)',
      accent: 'oklch(50% 0.12 85)',
      neutral: 'oklch(28% 0.02 70)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(22% 0.015 70)', 'oklch(18% 0.015 70)', 'oklch(15% 0.015 70)', 'oklch(95% 0.008 85)'],
    roles: {
      primary: 'oklch(73% 0.06 66)',
      secondary: 'oklch(78% 0.03 68)',
      accent: 'oklch(76% 0.14 88)',
      neutral: 'oklch(32% 0.02 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "yard-hero": "https://images.unsplash.com/photo-1627882206813-8c1ffd86efec?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVpbGRlcnMlMjBtZXJjaGFudCUyMHlhcmQlMjBzdGFja2VkJTIwdGltYmVyJTIwc2hlZXQlMjBtYXRlcmlhbHN8ZW58MHwwfHx8MTc4NjQyMjA5MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-timber": "https://images.unsplash.com/photo-1634672652995-ee7525bce595?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmFjayUyMHN0YWNrZWQlMjBjb25zdHJ1Y3Rpb24lMjB0aW1iZXIlMjBvc2IlMjBzaGVldHN8ZW58MHwwfHx8MTc4NjQyMjA5NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-building": "https://images.unsplash.com/photo-1711606329941-63c1af645a53?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFsbGV0cyUyMHBsYXN0ZXJib2FyZCUyMGNlbWVudHxlbnwwfDB8fHwxNzg2NDIyMzQ2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-fixings": "https://images.unsplash.com/photo-1607400201515-c2c41c07d307?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHVicyUyMHNjcmV3cyUyMGZpeGluZ3MlMjBjYXJ0cmlkZ2VzJTIwc2VhbGFudCUyMHNoZWxmfGVufDB8MHx8fDE3ODY0MjIwOTl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-safety": "https://images.unsplash.com/photo-1626885930974-4b69aa21bbf9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGktdmlzJTIwdmVzdHMlMjBoYXJkJTIwaGF0cyUyMHdvcmslMjBnbG92ZXMlMjBzaXRlfGVufDB8MHx8fDE3ODY0MjIxMDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "band-trade": "https://images.unsplash.com/photo-1777734795520-e18b5e40de5b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8eWFyZCUyMGxvYWRlciUyMHN0YWNraW5nJTIwZmxhdGJlZCUyMGxvcnJ5JTIwc2l0ZSUyMGRlbGl2ZXJ5fGVufDB8MHx8fDE3ODY0MjIxMDZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cls": "https://images.unsplash.com/photo-1610902754356-7c16b38b6a2f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFuZGVkJTIwcGFjayUyMGMxNnxlbnwwfDB8fHwxNzg2NDIyMzQ5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-osb": "https://images.unsplash.com/photo-1508948414348-13a52d2ec394?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBvc2IzJTIwc2hlYXRoaW5nJTIwYm9hcmRzfGVufDB8MHx8fDE3ODY0MjIxMTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-plasterboard": "https://images.unsplash.com/photo-1549030927-006822377380?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFsbGV0JTIwc3RhbmRhcmQlMjBwbGFzdGVyYm9hcmQlMjBzaGVldHN8ZW58MHwwfHx8MTc4NjQyMjExNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cement": "https://images.unsplash.com/photo-1730627283177-f43b83c3850c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2hyaW5rLXdyYXBwZWQlMjBwYWxsZXQlMjBnZW5lcmFsLXB1cnBvc2UlMjBjZW1lbnQlMjBiYWdzfGVufDB8MHx8fDE3ODY0MjIxMTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-pir": "https://images.unsplash.com/photo-1657195721935-e73e545a2aae?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFjayUyMGZvaWwtZmFjZWQlMjBwaXIlMjBpbnN1bGF0aW9uJTIwYm9hcmRzfGVufDB8MHx8fDE3ODY0MjIxMjF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-screws": "https://images.unsplash.com/photo-1641937725629-2adda0f55251?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHViJTIwbXVsdGktcHVycG9zZSUyMHdvb2QlMjBzY3Jld3N8ZW58MHwwfHx8MTc4NjQyMjEyNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-sealant": "https://images.unsplash.com/photo-1542219550-76864b1bc385?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMHRyYWRlJTIwc2lsaWNvbmV8ZW58MHwwfHx8MTc4NjQyMjM1M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-aggregate": "https://images.unsplash.com/photo-1779775981174-475ffb8ecf83?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVsayUyMGJhZyUyMG1vdCUyMHR5cGUlMjAxJTIwc3ViLWJhc2UlMjBhZ2dyZWdhdGV8ZW58MHwwfHx8MTc4NjQyMjEzMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-hivis": "https://images.unsplash.com/photo-1605647434635-ddd0227349be?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwaGktdmlzJTIwc2FmZXR5JTIwdmVzdHN8ZW58MHwwfHx8MTc4NjQyMjEzNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-firstfix": "https://images.unsplash.com/photo-1567361808960-267981fb0b58?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zmlyc3QtZml4JTIwYnVuZGxlJTIwdGltYmVyJTIwc2NyZXdzJTIwc2VhbGFudHxlbnwwfDB8fHwxNzg2NDIyMTM3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-firstfix": "https://images.unsplash.com/photo-1587582423116-ec07293f0395?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FycGVudGVyJTIwc2V0dGluZyUyMG91dCUyMHN0dWR3b3JrJTIwZmlyc3QtZml4fGVufDB8MHx8fDE3ODY0MjIxNDB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-insulation": "https://images.unsplash.com/photo-1695509098533-e4b1ba1479f9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8cGlyJTIwaW5zdWxhdGlvbiUyMGJvYXJkc3xlbnwwfDB8fHwxNzg2NDIyMzU2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-groundworks": "https://images.unsplash.com/photo-1610079732357-0d20c1a98ceb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3ViLWJhc2UlMjBiZWluZyUyMGNvbXBhY3RlZCUyMGdyb3VuZHdvcmtzJTIwam9ifGVufDB8MHx8fDE3ODY0MjIxNDV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'yard-hero', url: src('yard-hero'), alt: 'A builders merchant yard stacked with timber, sheet materials and pallets' },
  { id: 'tile-timber', url: src('tile-timber'), alt: 'A rack of stacked construction timber and OSB sheets' },
  { id: 'tile-building', url: src('tile-building'), alt: 'Pallets of plasterboard, cement bags and insulation boards' },
  { id: 'tile-fixings', url: src('tile-fixings'), alt: 'Tubs of screws, fixings and cartridges of sealant on a shelf' },
  { id: 'tile-safety', url: src('tile-safety'), alt: 'Hi-vis vests, hard hats and work gloves on a site rack' },
  { id: 'band-trade', url: src('band-trade'), alt: 'A yard loader stacking a flatbed lorry for a site delivery' },
  { id: 'prod-cls', url: src('prod-cls'), alt: 'A banded pack of C16 CLS studwork timber lengths' },
  { id: 'prod-osb', url: src('prod-osb'), alt: 'A stack of OSB3 sheathing boards' },
  { id: 'prod-plasterboard', url: src('prod-plasterboard'), alt: 'A pallet of standard plasterboard sheets' },
  { id: 'prod-cement', url: src('prod-cement'), alt: 'A shrink-wrapped pallet of general-purpose cement bags' },
  { id: 'prod-pir', url: src('prod-pir'), alt: 'A pack of foil-faced PIR insulation boards' },
  { id: 'prod-screws', url: src('prod-screws'), alt: 'A tub of multi-purpose wood screws' },
  { id: 'prod-sealant', url: src('prod-sealant'), alt: 'A case of trade silicone sealant cartridges' },
  { id: 'prod-aggregate', url: src('prod-aggregate'), alt: 'A bulk bag of MOT Type 1 sub-base aggregate' },
  { id: 'prod-hivis', url: src('prod-hivis'), alt: 'A box of hi-vis safety vests' },
  { id: 'prod-firstfix', url: src('prod-firstfix'), alt: 'A first-fix bundle of timber, screws and sealant' },
  { id: 'post-firstfix', url: src('post-firstfix'), alt: 'A carpenter setting out studwork on a first-fix' },
  { id: 'post-insulation', url: src('post-insulation'), alt: 'PIR insulation boards being cut and fitted between rafters' },
  { id: 'post-groundworks', url: src('post-groundworks'), alt: 'A sub-base being compacted on a groundworks job' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-b2b-building-materials: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one yard photograph, a condensed grotesk headline and a lead in a
 *  solid readable panel anchored bottom-left, a filled shop CTA + a trade-account link. The
 *  link carries the "Open a trade account" call the platform navbar CTA also points at
 *  (/contact). Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('yard-hero'), alt: 'A builders merchant yard stacked with materials', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Everything for the job, priced for the trade.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Yardstock is a builders’ merchant. We stock the timber, boards, cement, insulation, fixings and safety kit a site runs on — sold by the pack and the pallet, at trade prices, ready to collect from the yard or on a lorry to your job.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the yard' }),
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
            text: 'Shop the yard',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'tile-timber', label: 'Timber & sheet', href: '/shop', alt: 'A rack of construction timber and OSB' }),
              categoryTile({ assetId: 'tile-building', label: 'Building & cement', href: '/shop', alt: 'Pallets of plasterboard, cement and insulation' }),
              categoryTile({ assetId: 'tile-fixings', label: 'Fixings', href: '/shop', alt: 'Tubs of screws and cartridges of sealant' }),
              categoryTile({ assetId: 'tile-safety', label: 'Safety', href: '/shop', alt: 'Hi-vis, hard hats and gloves on a rack' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** The trade-terms band — pure COPY, no photo. Four cards spell out how buying from the yard
 *  works: trade prices with volume breaks, account credit on net-30, click & collect or site
 *  delivery, and a named account manager. The tenant configures the real B2B pricing tiers,
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
                text: 'Built for the way a site buys',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Open a trade account and you buy the way a builder should — by the pack and the pallet, at yard rates, on credit. No retail markups, no queue, no runaround.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              card('Trade prices', 'Pack and pallet rates with volume breaks that deepen as the load grows. Take a pallet instead of a pack and every unit costs less.'),
              card('Account credit', 'Approved accounts run on net-30 — order what the job needs now and settle on one monthly statement, not a card swipe per run.'),
              card('Collect or delivered', 'Click & collect from the yard in minutes, or put it on our lorry to site. Timed drops and crane-offload on the bigger orders.'),
              card('Your account manager', 'A direct line to a real person who knows your jobs, your standing lines and your pricing — not a ticket queue or a call centre.'),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Trade favourites' }),
  tradeTermsBand(),
  productsBlock({ source: 'commerce.category.building-cement', layout: 'carousel', heading: 'Building & cement, off the pallet' }),
  editorialBand({
    heading: 'One yard, one account, one delivery',
    lead: 'Stop splitting a job across three suppliers and chasing three invoices. Put your timber, boards, cement and fixings on one trade account, take it in one drop to site, and settle it on one statement at the end of the month.',
    assetId: 'band-trade',
    cta: 'Open a trade account',
    href: '/contact',
    alt: 'A yard loader stacking a flatbed lorry for a site delivery',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (merchant label, title, per-pack price,
 *  low-stock, description, size/grade options + add-to-cart, a static "Trade pricing &
 *  delivery" note with volume breaks + net-30 + collect/deliver, and policy links). */
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
                    text: 'Yardstock Trade Supplies',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Trade pricing & delivery' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'The price shown is the per-pack list rate. Trade accounts unlock volume breaks — a deeper per-unit price by the pallet, the full load, or a standing order — set for your account in your dashboard.',
                  }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Collect from the yard the same day, or put it on our lorry to site with a timed drop. Approved accounts buy on net-30 — not set up yet? Open a trade account and we’ll price your regular lines and get you on terms.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'On the same job' });

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
    'The yard',
    'Every line we hold — timber and sheet, plasterboard and cement, insulation, fixings and sealant, aggregates and safety kit, sold by the pack and the pallet. Filter by aisle or sort by price; trade accounts see their contract pricing at checkout.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The yard grouped the way a builder actually buys — trade favourites, new lines just in, the site-run essentials, groundworks materials, first-fix, and safety & workwear.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search the yard', 'Know the size, the spec or the SKU you’re after? Search the whole catalogue and the site notes below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Check the packs and pallets in your order before you check out. Trade accounts see contract pricing and net-30 terms applied here, and can choose yard collection or a site delivery. Need a formal quote for a whole job? Your account manager can turn one around.',
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
          el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Site notes' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Practical guidance from the yard and the site — how to take off a first-fix, spec insulation to hit a U-value, and order groundworks by the bag. Written for the people doing the buying, not for a brochure.',
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
          el('h1', 'text-5xl font-bold uppercase tracking-tight text-base-content @2xl:text-6xl', { text: 'About Yardstock' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Yardstock Trade Supplies is a builders’ merchant. We hold the everyday building materials a site runs on — structural timber and sheet, plasterboard and cement, insulation, fixings, sealant, aggregates and safety kit — and we sell them to the trade by the pack and the pallet, at yard prices, on account.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We built the yard around one idea: a working builder shouldn’t have to split a job across three suppliers, eat retail markups, or wait a week for a pallet of board. One yard, one account, one delivery, and stock that’s actually there when you turn up for it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No minimum-order gymnastics, no mystery lead times, no pricing that changes because you asked. Just the materials, priced fairly and loaded onto your van or our lorry — the boring reliability a build is made of.',
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
    intro: 'Tell us what your jobs go through and we’ll price your regular lines, set you up on net-30 credit, and put a name and a number to your account. Trade enquiries, standing orders and whole-job quotes all start here.',
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

const VENDOR = 'Yardstock Trade Supplies';

/** A single-SKU pack/pallet/bag line — one price, no options (most materials ship one unit). */
const packItem = (opts: {
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
    handle: 'cls-studwork-timber',
    title: 'C16 CLS Studwork Timber, 63×38mm — Pack of 20',
    description:
      'Kiln-dried, planed C16 CLS studwork with eased edges — the everyday stud for partitions, stud walls and carcassing. A banded pack of 20 lengths. MOQ 1 pack. In 2.4m that’s around £2.90 a length; take it by the pack and the pallet drops it further.',
    status: 'active',
    productType: 'Timber',
    vendor: VENDOR,
    tags: ['timber', 'cls', 'studwork', 'carcassing', 'c16'],
    categoryHandles: ['timber-sheet'],
    collectionHandles: ['trade-favourites', 'site-essentials', 'first-fix'],
    seoTitle: 'C16 CLS Studwork Timber 63×38mm, Pack of 20 | Yardstock',
    seoDescription: 'Kiln-dried planed C16 CLS studwork, 63×38mm, banded pack of 20 lengths. 2.4m or 3.0m, sold by the pack.',
    options: [{ name: 'Length', displayType: 'dropdown', values: [{ value: '2.4m' }, { value: '3.0m' }] }],
    variants: [
      { sku: 'YRD-TMB-CLS-24', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue', optionValues: { Length: '2.4m' } },
      { sku: 'YRD-TMB-CLS-30', priceCents: money(72), inventoryPolicy: 'continue', optionValues: { Length: '3.0m' } },
    ],
    images: [{ assetId: 'prod-cls', isPrimary: true, alt: 'A banded pack of C16 CLS studwork timber' }],
  },
  {
    handle: 'osb3-sheathing-board',
    title: 'OSB3 Sheathing Board, 2400×1200 — Pack of 10',
    description:
      'Load-bearing OSB3 for use in humid conditions — sheathing, flooring, hoarding and site boards. Full 2400×1200 sheets in a banded pack of 10. MOQ 1 pack. Pick 11mm for hoarding and lining or 18mm where it carries a load.',
    status: 'active',
    productType: 'Sheet material',
    vendor: VENDOR,
    tags: ['sheet', 'osb', 'osb3', 'boards', 'structural'],
    categoryHandles: ['timber-sheet'],
    collectionHandles: ['trade-favourites', 'site-essentials'],
    seoTitle: 'OSB3 Sheathing Board 2400×1200, Pack of 10 | Yardstock',
    seoDescription: 'Load-bearing OSB3 boards, full 2400×1200 sheets, pack of 10. 11mm or 18mm, sold by the pack.',
    options: [{ name: 'Thickness', displayType: 'dropdown', values: [{ value: '11mm' }, { value: '18mm' }] }],
    variants: [
      { sku: 'YRD-SHT-OSB-11', priceCents: money(135), isDefault: true, inventoryPolicy: 'continue', optionValues: { Thickness: '11mm' } },
      { sku: 'YRD-SHT-OSB-18', priceCents: money(185), inventoryPolicy: 'continue', optionValues: { Thickness: '18mm' } },
    ],
    images: [{ assetId: 'prod-osb', isPrimary: true, alt: 'A stack of OSB3 sheathing boards' }],
  },
  {
    handle: 'plasterboard-pallet',
    title: 'Standard Plasterboard, 2400×1200 — Pallet of 50',
    description:
      'Tapered-edge standard wallboard for dry-lining walls and ceilings, 2400×1200 sheets on a shrink-wrapped pallet of 50. MOQ 1 pallet — the way a board job is bought. Choose 9.5mm for ceilings or 12.5mm for walls and better acoustics.',
    status: 'active',
    productType: 'Plasterboard',
    vendor: VENDOR,
    tags: ['plasterboard', 'drylining', 'boards', 'wallboard'],
    categoryHandles: ['building-cement'],
    collectionHandles: ['trade-favourites', 'site-essentials'],
    seoTitle: 'Standard Plasterboard 2400×1200, Pallet of 50 | Yardstock',
    seoDescription: 'Tapered-edge standard plasterboard, 2400×1200, pallet of 50. 9.5mm or 12.5mm, sold by the pallet.',
    options: [{ name: 'Thickness', displayType: 'dropdown', values: [{ value: '9.5mm' }, { value: '12.5mm' }] }],
    variants: [
      { sku: 'YRD-BRD-PB-95', priceCents: money(280), isDefault: true, inventoryPolicy: 'continue', optionValues: { Thickness: '9.5mm' } },
      { sku: 'YRD-BRD-PB-125', priceCents: money(310), inventoryPolicy: 'continue', optionValues: { Thickness: '12.5mm' } },
    ],
    images: [{ assetId: 'prod-plasterboard', isPrimary: true, alt: 'A pallet of standard plasterboard sheets' }],
  },
  packItem({
    handle: 'general-purpose-cement',
    title: 'General-Purpose Cement, 25kg — Pallet of 56',
    description:
      'CEM II general-purpose cement in 25kg bags for concrete, mortar and render — a shrink-wrapped, weather-hooded pallet of 56 bags. MOQ 1 pallet. Buy it by the pallet and keep the mixer fed for the whole pour without a second run to the yard.',
    price: 245,
    sku: 'YRD-CEM-GP-25',
    productType: 'Cement',
    categories: ['building-cement'],
    collections: ['trade-favourites', 'groundworks', 'site-essentials'],
    tags: ['cement', 'cem-ii', 'concrete', 'mortar', 'bulk'],
    asset: 'prod-cement',
    seoTitle: 'General-Purpose Cement 25kg, Pallet of 56 | Yardstock',
    seoDescription: 'CEM II general-purpose cement, 25kg bags, weather-hooded pallet of 56. For concrete, mortar and render.',
  }),
  {
    handle: 'pir-insulation-board',
    title: 'PIR Insulation Board, 2400×1200 — Pack of 8',
    description:
      'Foil-faced PIR rigid insulation for floors, walls and roofs — high performance for its thickness, easy to cut and fit. Full 2400×1200 boards in a pack of 8. MOQ 1 pack. Spec the thickness your U-value calls for; thicker boards ship in smaller packs.',
    status: 'active',
    productType: 'Insulation',
    vendor: VENDOR,
    tags: ['insulation', 'pir', 'rigid', 'thermal', 'boards'],
    categoryHandles: ['building-cement'],
    collectionHandles: ['new-lines', 'site-essentials'],
    seoTitle: 'PIR Insulation Board 2400×1200, Pack of 8 | Yardstock',
    seoDescription: 'Foil-faced PIR rigid insulation, 2400×1200 boards, pack of 8. 25mm to 100mm, sold by the pack.',
    options: [
      { name: 'Thickness', displayType: 'dropdown', values: [{ value: '25mm' }, { value: '50mm' }, { value: '75mm' }, { value: '100mm' }] },
    ],
    variants: [
      { sku: 'YRD-INS-PIR-25', priceCents: money(120), inventoryPolicy: 'continue', optionValues: { Thickness: '25mm' } },
      { sku: 'YRD-INS-PIR-50', priceCents: money(220), isDefault: true, inventoryPolicy: 'continue', optionValues: { Thickness: '50mm' } },
      { sku: 'YRD-INS-PIR-75', priceCents: money(310), inventoryPolicy: 'continue', optionValues: { Thickness: '75mm' } },
      { sku: 'YRD-INS-PIR-100', priceCents: money(395), inventoryPolicy: 'continue', optionValues: { Thickness: '100mm' } },
    ],
    images: [{ assetId: 'prod-pir', isPrimary: true, alt: 'A pack of foil-faced PIR insulation boards' }],
  },
  {
    handle: 'multipurpose-wood-screws',
    title: 'Multi-Purpose Wood Screws — Tub of 200',
    description:
      'Yellow-zinc pozi countersunk wood screws with a cutting thread that drives fast and rarely splits — the tub that lives in every van. 200 to a resealable tub. MOQ 5 tubs (a box). Pick the gauge and length your first-fix runs on.',
    status: 'active',
    productType: 'Fixings',
    vendor: VENDOR,
    tags: ['fixings', 'screws', 'wood-screws', 'first-fix'],
    categoryHandles: ['fixings'],
    collectionHandles: ['trade-favourites', 'first-fix', 'site-essentials'],
    seoTitle: 'Multi-Purpose Wood Screws, Tub of 200 | Yardstock',
    seoDescription: 'Yellow-zinc pozi countersunk wood screws, cutting thread, tub of 200. 4.0×50 to 5.0×100mm.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: '4.0×50mm' }, { value: '5.0×80mm' }, { value: '5.0×100mm' }] },
    ],
    variants: [
      { sku: 'YRD-FIX-SCR-4050', priceCents: money(11), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '4.0×50mm' } },
      { sku: 'YRD-FIX-SCR-5080', priceCents: money(14), inventoryPolicy: 'continue', optionValues: { Size: '5.0×80mm' } },
      { sku: 'YRD-FIX-SCR-50100', priceCents: money(17), inventoryPolicy: 'continue', optionValues: { Size: '5.0×100mm' } },
    ],
    images: [{ assetId: 'prod-screws', isPrimary: true, alt: 'A tub of multi-purpose wood screws' }],
  },
  {
    handle: 'trade-silicone-sealant',
    title: 'Trade Silicone Sealant, 300ml — Case of 24',
    description:
      'Low-modulus neutral-cure silicone for sanitary, glazing and general sealing — mould-resistant, over-paintable on the neutral grades, and it tools clean. A case of 24 standard cartridges. MOQ 1 case. Choose the colour the job needs.',
    status: 'active',
    productType: 'Sealant',
    vendor: VENDOR,
    tags: ['sealant', 'silicone', 'cartridge', 'fixings'],
    categoryHandles: ['fixings'],
    collectionHandles: ['site-essentials', 'new-lines'],
    seoTitle: 'Trade Silicone Sealant 300ml, Case of 24 | Yardstock',
    seoDescription: 'Low-modulus neutral-cure silicone sealant, 300ml cartridges, case of 24. Clear, white, grey or brown.',
    options: [
      { name: 'Colour', displayType: 'dropdown', values: [{ value: 'Clear' }, { value: 'White' }, { value: 'Grey' }, { value: 'Brown' }] },
    ],
    variants: [
      { sku: 'YRD-FIX-SIL-CL', priceCents: money(42), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Clear' } },
      { sku: 'YRD-FIX-SIL-WH', priceCents: money(42), inventoryPolicy: 'continue', optionValues: { Colour: 'White' } },
      { sku: 'YRD-FIX-SIL-GR', priceCents: money(44), inventoryPolicy: 'continue', optionValues: { Colour: 'Grey' } },
      { sku: 'YRD-FIX-SIL-BR', priceCents: money(44), inventoryPolicy: 'continue', optionValues: { Colour: 'Brown' } },
    ],
    images: [{ assetId: 'prod-sealant', isPrimary: true, alt: 'A case of trade silicone sealant cartridges' }],
  },
  packItem({
    handle: 'mot-type-1-bulk-bag',
    title: 'MOT Type 1 Sub-Base — Bulk Bag (850kg)',
    description:
      'Crushed limestone MOT Type 1 to the DfT specification — the go-to compactable sub-base under drives, paths, slabs and foundations. A handled bulk bag of roughly 850kg. MOQ 1 bag. Order by the bag and we’ll crane it off where you need it.',
    price: 68,
    sku: 'YRD-AGG-MOT1-BB',
    productType: 'Aggregates',
    categories: ['building-cement'],
    collections: ['groundworks', 'site-essentials'],
    tags: ['aggregates', 'mot-type-1', 'sub-base', 'groundworks', 'bulk'],
    asset: 'prod-aggregate',
    seoTitle: 'MOT Type 1 Sub-Base, Bulk Bag 850kg | Yardstock',
    seoDescription: 'Crushed limestone MOT Type 1 sub-base to DfT spec, handled bulk bag ~850kg. Compactable, for drives and slabs.',
  }),
  {
    handle: 'hi-vis-vest-box',
    title: 'Hi-Vis Safety Vest — Box of 10',
    description:
      'EN ISO 20471 Class 2 hi-vis waistcoats with a full-length hook-and-loop front and reflective banding — the site vest a visitor, a labourer and a subbie all need on day one. A box of 10. MOQ 2 boxes. Keep a size run on the rack by the gate.',
    status: 'active',
    productType: 'Safety',
    vendor: VENDOR,
    tags: ['safety', 'ppe', 'hi-vis', 'workwear', 'en20471'],
    categoryHandles: ['safety'],
    collectionHandles: ['safety-workwear', 'site-essentials'],
    seoTitle: 'Hi-Vis Safety Vest, Box of 10 | Yardstock',
    seoDescription: 'EN ISO 20471 Class 2 hi-vis waistcoats, reflective banding, box of 10. M, L or XL.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: 'Medium' }, { value: 'Large' }, { value: 'X-Large' }] },
    ],
    variants: [
      { sku: 'YRD-SAF-HV-M', priceCents: money(55), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Medium' } },
      { sku: 'YRD-SAF-HV-L', priceCents: money(55), inventoryPolicy: 'continue', optionValues: { Size: 'Large' } },
      { sku: 'YRD-SAF-HV-XL', priceCents: money(58), inventoryPolicy: 'continue', optionValues: { Size: 'X-Large' } },
    ],
    images: [{ assetId: 'prod-hivis', isPrimary: true, alt: 'A box of hi-vis safety vests' }],
  },
  packItem({
    handle: 'first-fix-bundle',
    title: 'First-Fix Timber & Fixings Bundle',
    description:
      'A curated bundle for starting a stud job from empty — a pack of CLS studwork, a tub of wood screws, a case of grab-and-fix sealant and a box of collated nails, packed together and priced below the sum of the packs. MOQ 1 bundle. The fastest way to load the van for a first-fix.',
    price: 165,
    sku: 'YRD-KIT-FIRSTFIX',
    productType: 'Bundle',
    categories: ['timber-sheet'],
    collections: ['new-lines', 'first-fix', 'trade-favourites'],
    tags: ['bundle', 'first-fix', 'timber', 'fixings', 'kit'],
    asset: 'prod-firstfix',
    seoTitle: 'First-Fix Timber & Fixings Bundle | Yardstock',
    seoDescription: 'A curated first-fix bundle — CLS studwork, wood screws, sealant and collated nails, priced below the sum.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'timber-sheet', name: 'Timber & sheet', description: 'Structural timber, carcassing and sheet boards.', featured: true },
    { handle: 'building-cement', name: 'Building & cement', description: 'Plasterboard, cement, insulation and aggregates.', featured: true },
    { handle: 'fixings', name: 'Fixings', description: 'Screws, sealants and site consumables.', featured: true },
    { handle: 'safety', name: 'Safety', description: 'Hi-vis, workwear and site PPE.', featured: true },
  ],
  collections: [
    {
      handle: 'trade-favourites',
      name: 'Trade favourites',
      description: 'The lines that leave the yard the fastest.',
      type: 'manual',
      featured: true,
      productHandles: ['cls-studwork-timber', 'plasterboard-pallet', 'general-purpose-cement', 'multipurpose-wood-screws'],
    },
    {
      handle: 'new-lines',
      name: 'New lines',
      description: 'Just added to the yard.',
      type: 'manual',
      featured: true,
      productHandles: ['pir-insulation-board', 'trade-silicone-sealant', 'first-fix-bundle'],
    },
    {
      handle: 'site-essentials',
      name: 'Site essentials',
      description: 'What no site runs without.',
      type: 'manual',
      featured: false,
      productHandles: ['cls-studwork-timber', 'osb3-sheathing-board', 'plasterboard-pallet', 'multipurpose-wood-screws', 'general-purpose-cement', 'hi-vis-vest-box'],
    },
    {
      handle: 'groundworks',
      name: 'Groundworks',
      description: 'Aggregates and cement for the base.',
      type: 'manual',
      featured: false,
      productHandles: ['mot-type-1-bulk-bag', 'general-purpose-cement'],
    },
    {
      handle: 'first-fix',
      name: 'First-fix',
      description: 'Timber and fixings to set out from empty.',
      type: 'manual',
      featured: false,
      productHandles: ['cls-studwork-timber', 'multipurpose-wood-screws', 'first-fix-bundle'],
    },
    {
      handle: 'safety-workwear',
      name: 'Safety & workwear',
      description: 'Kit the crew and the site gate.',
      type: 'manual',
      featured: false,
      productHandles: ['hi-vis-vest-box'],
    },
  ],
  products: PRODUCTS,
};

// ── Content (site notes) ─────────────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'take-off-a-first-fix',
    status: 'published',
    body: {
      title: 'How to take off a first-fix without a second run to the yard',
      excerpt: 'A missed pack of studs or a short box of screws stops a first-fix dead. Here’s a simple take-off that gets the whole job on one order and one delivery.',
      featuredImage: { $asset: 'post-firstfix' },
      body: {
        type: 'doc',
        content: [
          para('The quiet killer on a first-fix isn’t the work — it’s the second trip. You set out, you start banging in studs, and halfway through the wall you’re a pack short or the screws have run out. Now someone’s in the van heading back to the yard while the job stands still. A proper take-off, done before you order, means the whole fix lands on one delivery and the crew never stops.'),
          h2('Count the walls, not the guesses'),
          para('Work off the drawing, not memory. Measure the run of every stud wall, divide by your stud spacing — 400 or 600 centres — and add the heads, sills and noggins. That gives you a real length of CLS, which turns straight into a number of packs. Do the same for the board: floor area of walls and ceilings, divided by the coverage of a 2400×1200 sheet, plus ten per cent for cuts and waste. Now you’re ordering to the job, not rounding in your head at the counter.'),
          h2('Don’t forget the consumables'),
          para('The materials people forget are the small ones that stop the job all the same — screws, collated nails, grab adhesive, sealant, scrim tape. Keep a standing first-fix list and tick it against every take-off, or buy the fixings as a bundle so the tub and the case come in the same box as the timber. It’s the cheap stuff that sends you back to the yard.'),
          h2('Order it as one delivery'),
          para('Once you’ve got the packs, the pallets and the fixings on one list, put it on the account as a single order and book a timed drop. One delivery to site, one signature, one invoice at the end of the month — and a first-fix that runs start to finish without a single trip back to the counter.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'spec-pir-insulation-to-a-u-value',
    status: 'published',
    body: {
      title: 'Speccing PIR insulation to hit a U-value',
      excerpt: 'Building Control wants a U-value, not a vibe. Here’s how to pick a PIR thickness that passes, and why the right board saves you money on the whole build-up.',
      featuredImage: { $asset: 'post-insulation' },
      body: {
        type: 'doc',
        content: [
          para('Insulation is one of the few materials where guessing costs you twice — once if you under-spec and fail Building Control, and once if you over-spec and pay for board you didn’t need. PIR is the workhorse because it does more per millimetre than mineral wool, so you hit the target U-value in a thinner build-up. But you still have to pick the thickness on purpose.'),
          h2('Start from the target U-value'),
          para('Every element — floor, wall, roof — has a target U-value set by the current Building Regulations, and lower is better-insulated. PIR’s low thermal conductivity means a given thickness gets you further down toward that target than most alternatives. Your designer or a Building Control officer will give you the number to hit; the thickness follows from it and from what the rest of the build-up already contributes.'),
          h2('Thicker board, smaller pack'),
          para('PIR ships by the pack, and the thicker the board, the fewer sheets on a pack — a pack of 25mm holds far more boards than a pack of 100mm. That matters for ordering: work out the board area you need to cover, then check how many packs each thickness takes, so the delivery and the price are no surprise. Order the thickness the U-value calls for, not the one that looks cheapest per pack.'),
          h2('Cut clean, fit tight'),
          para('PIR only performs if it’s fitted without gaps — air paths around a sloppy cut let the heat straight past the board. Cut it a shade oversize with a fine blade, friction-fit it tight between studs or rafters, and tape or foam the joints. Spec the right thickness and fit it properly, and the wall passes first time.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'order-groundworks-by-the-bulk-bag',
    status: 'published',
    body: {
      title: 'Ordering groundworks materials by the bulk bag',
      excerpt: 'Aggregates are heavy, cheap by weight and expensive to get wrong. Here’s how to work out the sub-base you need and order it in bulk bags that actually turn up on time.',
      featuredImage: { $asset: 'post-groundworks' },
      body: {
        type: 'doc',
        content: [
          para('Groundworks is where a job is won or lost before anything visible goes up. Get the sub-base right and everything on top of it sits true for decades; skimp on it and the drive cracks, the slab moves and the snagging never ends. The material itself is cheap — it’s the getting-it-wrong that costs — so the order is worth a few minutes of arithmetic.'),
          h2('Work out the volume, then the bags'),
          para('A sub-base is a volume: area to be covered, times the compacted depth. A drive or a shed base usually wants around 100 to 150mm of MOT Type 1, well compacted; a slab under load can want more — check the design. Multiply the area by the depth to get cubic metres, then convert to weight (MOT Type 1 runs roughly two tonnes to the cubic metre) and divide by the bag weight. A handled bulk bag around 850kg makes the sums easy and the delivery tidy.'),
          h2('Compact in layers'),
          para('Don’t tip the whole lot and whack it once. Lay the sub-base in layers of no more than 100mm or so and compact each one with a plate or a roller before the next goes on. Layered and compacted, MOT Type 1 locks up into a hard, free-draining base; dumped in one go, the bottom never consolidates and the whole thing settles later.'),
          h2('Order a bag spare'),
          para('The one certainty in groundworks is that the hole is bigger than it looked. Bulk bags are cheap and a part-used bag keeps under a sheet, so order one more than the sums say — running a bag short mid-pour, waiting a day for another delivery while the base half-sets, costs far more than the spare aggregate ever will.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'b2b-building-materials',
  key: 'sparx-b2b-building-materials',
  name: 'sparx — Building Materials (B2B / Wholesale)',
  theme: THEME,
  summary:
    'A complete, working wholesale yard for a builders’ merchant: a real trade catalogue sold by the pack, pallet and bulk bag — timber & sheet, plasterboard, cement, insulation, fixings, sealant, aggregates and safety — with categories, collections, a bespoke trade PDP (per-pack pricing, volume breaks, net-30, collect or deliver) and a full merchandised home page. Rugged yard theme — warm concrete, timber-bark, safety-ochre accent. Shipped as Yardstock Trade Supplies.',
  tagline: 'A wholesale yard built for the trade.',
  vertical: 'b2b',
  industry: 'Builders’ merchant & building materials',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 85,
  brand: {
    businessName: 'Yardstock Trade Supplies',
    tagline: 'Everything for the job, priced for the trade.',
  },
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Yardstock Trade Supplies — builders’ merchant & building materials',
      description:
        'Yardstock is a builders’ merchant — timber, sheet, plasterboard, cement, insulation, fixings, aggregates and safety sold by the pack and the pallet at trade prices, with net-30 credit, click & collect and site delivery. Open a trade account.',
    },
    about: {
      title: 'About Yardstock Trade Supplies',
      description:
        'How Yardstock stocks, prices and delivers — one yard, one account, one delivery, wholesale by the pack and the pallet, and stock that’s actually there when you turn up for it.',
    },
    contact: {
      title: 'Open a trade account — Yardstock Trade Supplies',
      description:
        'Set up a trade account with Yardstock: wholesale pack and pallet pricing, volume breaks, net-30 credit, yard collection or site delivery, and a dedicated account manager. Trade enquiries and whole-job quotes start here.',
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
