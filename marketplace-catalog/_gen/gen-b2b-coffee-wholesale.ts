// sparx-b2b-coffee-wholesale — a B2B/WHOLESALE commerce site template: a trade coffee roaster.
//
// The wholesale counterpart to the retail gold reference (gen-retail-coffee-craft.ts): a
// complete, working TRADE shop the moment it installs — a real wholesale catalogue (beans by
// the 1kg/5kg trade bag, filter cases, capsules, syrups, disposables, a commercial grinder, a
// trade sampler and a weekly standing order), categories + collections, a bespoke PDP framed
// for buyers (trade price breaks, standing orders, net-30, an account manager), and the full
// 9-page commerce site — but voiced for CAFES, OFFICES and RESTAURANTS, not consumers. Shipped
// as Foundry Coffee Trade.
//
// SELF-CONTAINED BY DESIGN. Like the retail reference, this generator carries its OWN theme
// inline and passes it on the spec (`theme`), so the whole family can be authored in parallel
// with no two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present, and adds the two
// marketing-email starters for any commerce vertical (retail OR b2b) — so no emails are
// authored here.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-coffee-wholesale.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-coffee-wholesale/**" \
//     "marketplace-catalog/_gen/gen-b2b-coffee-wholesale.ts"
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
// An industrial trade roastery — deliberately distinct from the retail Cairn (warm cream +
// coffee-brown + terracotta). Here the ground is COOL GRAPHITE CONCRETE, not cream paper; the
// brand is a deep roasted-espresso primary (near-black, warm) with a burnt-copper accent and a
// steel-slate secondary, under a technical grotesk display over a workhorse sans. Reads like a
// roastery floor and a trade price list, not a consumer café. Complete light + dark, AA on
// every role (the blueprint sweep's contrast check is the gate); accent + secondary stay ≤ ~50% L
// so they read as text on the light ground.
const THEME = defineTheme({
  name: 'roasttrade',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', border: '2px', depth: '0' },
  light: {
    surfaces: ['oklch(93% 0.006 250)', 'oklch(89% 0.01 250)', 'oklch(83% 0.014 250)', 'oklch(22% 0.02 255)'],
    roles: {
      primary: 'oklch(30% 0.045 45)',
      secondary: 'oklch(42% 0.03 245)',
      accent: 'oklch(50% 0.15 55)',
      neutral: 'oklch(26% 0.015 250)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(19% 0.014 250)', 'oklch(16% 0.014 250)', 'oklch(13% 0.014 250)', 'oklch(93% 0.006 250)'],
    roles: {
      primary: 'oklch(80% 0.07 55)',
      secondary: 'oklch(76% 0.03 245)',
      accent: 'oklch(74% 0.14 60)',
      neutral: 'oklch(30% 0.015 250)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "foundry-hero": "https://images.unsplash.com/photo-1770055592659-b35f56ea6b45?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZHJ1bSUyMHJvYXN0ZXIlMjBmdWxsJTIwaGVzc2lhbiUyMHNhY2tzJTIwd29ya2luZyUyMHJvYXN0ZXJ5fGVufDB8MHx8fDE3ODY0MTM0OTl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-beans": "https://images.unsplash.com/photo-1530496216518-a53d24e99c31?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJhZGUlMjBzYWNrcyUyMHJvYXN0ZWQlMjBjb2ZmZWUlMjBiZWFucyUyMHN0YWNrZWQlMjB3YXJlaG91c2V8ZW58MHwwfHx8MTc4NjQxMzUwM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-filter": "https://images.unsplash.com/photo-1514212586585-6a0e1838e7bf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94ZXMlMjBwcmUtcG9ydGlvbmVkJTIwZmlsdGVyJTIwc2FjaGV0cyUyMGNvZmZlZSUyMGNhcHN1bGVzfGVufDB8MHx8fDE3ODY0MTM1MDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-equipment": "https://images.unsplash.com/photo-1537130508299-46ab547b4be3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29tbWVyY2lhbCUyMGNvZmZlZSUyMGdyaW5kZXJ8ZW58MHwwfHx8MTc4NjQxMzY2OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "band-roastery": "https://images.unsplash.com/photo-1511537190424-bbbab87ac5eb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9hc3RlciUyMHJlYWRpbmclMjBiYXRjaCUyMGN1cnZlJTIwYmVzaWRlJTIwZ2xvd2luZyUyMGRydW18ZW58MHwwfHx8MTc4NjQxMzUxNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "band-partner": "https://images.unsplash.com/photo-1652007761515-cba781fb4db3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9hc3RlcnklMjBhY2NvdW50JTIwbWFuYWdlciUyMGNhZiUyMG93bmVyJTIwcmV2aWV3aW5nJTIwb3JkZXJ8ZW58MHwwfHx8MTc4NjQxMzUxOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-house-espresso": "https://images.unsplash.com/photo-1447933601403-0c6688de566e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8MWtnJTIwdHJhZGUlMjBiYWclMjBob3VzZSUyMGVzcHJlc3NvJTIwYmVhbnN8ZW58MHwwfHx8MTc4NjQxMzUyMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-colombia-filter": "https://images.unsplash.com/photo-1695245503558-5cdb37f49092?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8MWtnJTIwdHJhZGUlMjBiYWd8ZW58MHwwfHx8MTc4NjQxMzY3MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-decaf": "https://images.unsplash.com/photo-1644015040594-8924d3ecc0dd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8MWtnJTIwdHJhZGUlMjBiYWd8ZW58MHwwfHx8MTc4NjQxMzY3MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-filter-packs": "https://images.unsplash.com/photo-1567570671138-76c7e06caa3b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGluZGl2aWR1YWxseSUyMHBvcnRpb25lZCUyMGZpbHRlciUyMGNvZmZlZSUyMHNhY2hldHN8ZW58MHwwfHx8MTc4NjQxMzUyOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-capsules": "https://images.unsplash.com/photo-1543272771-6f5b292b642d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Ym94JTIwY29tcG9zdGFibGUlMjBjb2ZmZWUlMjBjYXBzdWxlc3xlbnwwfDB8fHwxNzg2NDEzNTMxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cups": "https://images.unsplash.com/photo-1482273326129-33adc184ab8e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2xlZXZlJTIwZG91YmxlLXdhbGwlMjB0YWtlYXdheSUyMGNvZmZlZSUyMGN1cHN8ZW58MHwwfHx8MTc4NjQxMzUzN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-grinder": "https://images.unsplash.com/photo-1461988279488-1dac181a78f9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29tbWVyY2lhbCUyMG9uLWRlbWFuZCUyMGVzcHJlc3NvJTIwZ3JpbmRlcnxlbnwwfDB8fHwxNzg2NDEzNTQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-standing-order": "https://images.unsplash.com/photo-1651761483492-7d2e26dd3455?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2VhbGVkJTIwdHJhZGUlMjBjb2ZmZWUlMjBiYWdzJTIwcGFja2VkJTIwd2Vla2x5JTIwc3RhbmRpbmctb3JkZXJ8ZW58MHwwfHx8MTc4NjQxMzU0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-dialling": "https://images.unsplash.com/photo-1558416165-5fb04b79b0e7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFyaXN0YSUyMGRpYWxsaW5nJTIwc2hvdCUyMGVzcHJlc3NvJTIwbWFjaGluZXxlbnwwfDB8fHwxNzg2NDEzNTQ4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-standing": "https://images.unsplash.com/photo-1763964094043-ef6fec6dd376?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVsaXZlcnklMjBjb2ZmZWUlMjBjcmF0ZXN8ZW58MHwwfHx8MTc4NjQxMzY3OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-equipment": "https://images.unsplash.com/photo-1607681034512-1c9c5fbda608?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z3JpbmRlciUyMGJlaW5nJTIwY2xlYW5lZCUyMGJ1cnJzJTIwaW5zcGVjdGVkfGVufDB8MHx8fDE3ODY0MTM1NTR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'foundry-hero', url: src('foundry-hero'), alt: 'A drum roaster and full hessian sacks on a working roastery floor' },
  { id: 'tile-beans', url: src('tile-beans'), alt: 'Trade sacks of roasted coffee beans stacked in a warehouse' },
  { id: 'tile-filter', url: src('tile-filter'), alt: 'Boxes of pre-portioned filter sachets and coffee capsules' },
  { id: 'tile-syrups', url: src('tile-syrups'), alt: 'A case of flavour syrup bottles and stacked takeaway cups' },
  { id: 'tile-equipment', url: src('tile-equipment'), alt: 'A commercial coffee grinder on a café back bar' },
  { id: 'band-roastery', url: src('band-roastery'), alt: 'A roaster reading a batch curve beside a glowing drum roaster' },
  { id: 'band-partner', url: src('band-partner'), alt: 'A roastery account manager and a café owner reviewing an order together' },
  { id: 'prod-house-espresso', url: src('prod-house-espresso'), alt: 'A 1kg trade bag of house espresso beans' },
  { id: 'prod-colombia-filter', url: src('prod-colombia-filter'), alt: 'A 1kg trade bag of Colombia filter beans' },
  { id: 'prod-decaf', url: src('prod-decaf'), alt: 'A 1kg trade bag of decaf beans' },
  { id: 'prod-filter-packs', url: src('prod-filter-packs'), alt: 'A case of individually portioned filter coffee sachets' },
  { id: 'prod-capsules', url: src('prod-capsules'), alt: 'A box of compostable coffee capsules' },
  { id: 'prod-syrups', url: src('prod-syrups'), alt: 'A case of six flavour syrup bottles' },
  { id: 'prod-cups', url: src('prod-cups'), alt: 'A sleeve of double-wall takeaway coffee cups' },
  { id: 'prod-grinder', url: src('prod-grinder'), alt: 'A commercial on-demand espresso grinder' },
  { id: 'prod-sampler', url: src('prod-sampler'), alt: 'A trade tasting box of sample coffee bags' },
  { id: 'prod-standing-order', url: src('prod-standing-order'), alt: 'Sealed trade coffee bags packed for a weekly standing-order delivery' },
  { id: 'post-dialling', url: src('post-dialling'), alt: 'A barista dialling in a shot at an espresso machine' },
  { id: 'post-standing', url: src('post-standing'), alt: 'A delivery of coffee crates arriving at a café back door' },
  { id: 'post-equipment', url: src('post-equipment'), alt: 'A grinder being cleaned and its burrs inspected' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-b2b-coffee-wholesale: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one working-roastery photograph, a grotesk headline and a trade lead
 *  in a solid readable panel anchored bottom-left, a filled account CTA + a shop link. Never
 *  ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('foundry-hero'), alt: 'A drum roaster and hessian sacks on a roastery floor', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'The roaster behind your counter.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Foundry Coffee Trade supplies cafés, offices and restaurants with coffee roasted to order — beans by the trade bag, filter and capsule programs, syrups, cups and the machines to run them. Trade pricing, weekly standing orders and a real account manager who knows your bar.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/contact' }, text: 'Open a wholesale account' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop' },
                      text: 'Browse the trade catalogue',
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
            text: 'Everything the bar runs on',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'tile-beans', label: 'Wholesale beans', href: '/shop', alt: 'Trade sacks of roasted beans' }),
              categoryTile({ assetId: 'tile-filter', label: 'Filter & capsules', href: '/shop', alt: 'Filter sachets and capsules' }),
              categoryTile({ assetId: 'tile-syrups', label: 'Syrups & extras', href: '/shop', alt: 'Syrup bottles and takeaway cups' }),
              categoryTile({ assetId: 'tile-equipment', label: 'Equipment', href: '/shop', alt: 'A commercial coffee grinder' }),
            ],
          }),
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

/** One wholesale-partner benefit — a heading + a line of readable copy. */
function partnerBenefit(o: { heading: string; body: string }): Node {
  return el('div', 'flex flex-col gap-2 rounded-box border-2 border-base-300 bg-base-100 p-6', {
    children: [
      el('h3', 'text-xl font-bold tracking-tight text-base-content', { text: o.heading }),
      el('p', 'text-base leading-relaxed text-base-content', { text: o.body }),
    ],
  });
}

/** The "become a wholesale partner" band — trade pricing, standing orders, barista training,
 *  equipment support and net terms, spelled out as COPY, with a filled account CTA. */
function wholesalePartnerBand(): Node {
  return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('div', 'flex max-w-3xl flex-col gap-4', {
            children: [
              el('h2', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl', {
                text: 'Wholesale, run like a partnership',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Opening an account takes a short call and a first order. From there you get trade pricing that improves with volume, a standing order that keeps your bar stocked, and a named account manager who picks up the phone — not a ticket queue.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3 @3xl:gap-6', {
            children: [
              partnerBenefit({
                heading: 'Trade pricing & breaks',
                body: 'Wholesale rates from your first case, with per-kilo breaks as your order grows. See your account price at checkout — no haggling, no hidden list.',
              }),
              partnerBenefit({
                heading: 'Weekly standing orders',
                body: 'Set a recurring delivery and never run dry mid-service. Adjust quantities, skip a week or pause the schedule from your account whenever trade shifts.',
              }),
              partnerBenefit({
                heading: 'Barista training',
                body: 'We dial in your espresso on your machine and train your team to hold it through the rush — on install, and any time you take on new staff.',
              }),
              partnerBenefit({
                heading: 'Equipment & servicing',
                body: 'Grinders and brewers supplied, installed and kept honest, with loan gear if a machine goes down so the bar never stops pouring.',
              }),
              partnerBenefit({
                heading: 'Net-30 terms',
                body: 'Approved accounts invoice on net-30, so your coffee cost lands after the cups it made have already been sold.',
              }),
              partnerBenefit({
                heading: 'Roasted to order',
                body: 'Every trade bag is roasted the week it ships and freight-packed fresh, so what reaches your hopper tastes the way it left the roastery.',
              }),
            ],
          }),
          el('div', 'flex flex-wrap items-center gap-4', {
            children: [
              el('a', 'btn btn-primary btn-lg', { attrs: { href: '/contact' }, text: 'Open a wholesale account' }),
              el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                attrs: { href: '/shop/standing-order' },
                text: 'See the standing order',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

const HOME: Node[] = [
  hero(),
  categoryTiles(),
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Trade favourites' }),
  editorialBand({
    heading: 'Roasted to order, in trade volumes',
    lead: 'We roast on a production drum and cup every batch before it ships, so a café ordering fifty kilos gets the same coffee we tasted on the sample table. Consistent week to week is the whole job — a house espresso that drifts is a bar full of remakes.',
    assetId: 'band-roastery',
    cta: 'How we roast for trade',
    href: '/blog/dialling-in-for-your-cafe',
    alt: 'A roaster reading a batch curve beside a drum roaster',
  }),
  productsBlock({ source: 'commerce.category.wholesale-beans', layout: 'carousel', heading: 'Beans by the trade bag' }),
  wholesalePartnerBand(),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (vendor label, title, price, low-stock,
 *  description, add-to-cart, a static "trade pricing & standing orders" note, and policy
 *  links). Framed for a buyer specifying a bar order, not a consumer. */
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
                    text: 'Foundry Coffee Trade',
                  }),
                  pdpTitle('h1', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl'),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-semibold text-base-content',
                    compareClass: 'text-lg text-secondary line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 rounded-field border-2 border-base-300 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-base-content',
                    label: 'Low stock',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 rounded-box border-2 border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', {
                    text: 'Trade pricing & standing orders',
                  }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Wholesale accounts see per-case trade pricing with per-kilo breaks as volume grows, and can put any line on a weekly or fortnightly standing order — adjust, skip or pause it any time. Approved accounts invoice net-30. Everything is roasted to order and freight-packed fresh, and your account manager is a phone call away if you need to change a delivery.',
                  }),
                ],
              }),
              pdpPolicyLinks({
                className:
                  'flex flex-wrap items-center gap-x-6 gap-y-2 border-t-2 border-base-300 pt-5 text-sm font-semibold uppercase tracking-widest text-base-content',
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
    'The trade catalogue',
    'Everything we supply to the trade — beans by the 1kg and 5kg bag, filter and capsule programs, syrups, disposables and equipment. Prices shown are trade rates; sign in to see your account pricing and put any line on a standing order.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead(
    'Programs & bundles',
    'The catalogue grouped the way a bar actually orders it — new-crop coffees, the café essentials starter, the office program, and everything to open a new site.'
  ),
];
const SEARCH: Node[] = [
  pageMasthead('Search the catalogue', 'Looking for an origin, a grind, a case size or a brewing guide? Search the whole trade catalogue and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free trade delivery over $150, roasted to order and freight-packed within two working days. Approved accounts check out on net-30. Need to add this to a standing order or change a delivery date? Your account manager can set it up in a minute.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The trade journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the roastery for the people running the bar — dialling in a house espresso, getting the most out of a standing order, and keeping your equipment honest. Practical, made for a working café.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Foundry Coffee Trade' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Foundry started as a wholesale roaster with one delivery van and a handful of cafés who wanted coffee they could stand behind. It grew the way trade relationships do — one bar, one standing order, one dialled-in espresso at a time — and it still runs on the same promise: roast well, supply reliably, and answer the phone.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We buy green coffee from importers and farms we can name and pay above the commodity rate, because a supply chain that pays growers fairly is the only one that stays consistent season to season. Then we roast to order in production batches, cup every one, and freight it fresh so your hopper gets what we tasted.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'What a wholesale partner gets from us is not just coffee: it is trade pricing that rewards volume, standing orders that keep the bar stocked, barista training on your own machine, equipment supplied and serviced, and net-30 terms once you are approved. We win when your café does.',
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
    heading: 'Open a wholesale account',
    intro: 'Tell us about your café, office or restaurant — how much coffee you go through, what you pour now, and when you would want a first delivery. A real person on the trade team will come back with account pricing, samples and a plan to get you dialled in.',
    submitLabel: 'Email the trade team',
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

const VENDOR = 'Foundry Coffee Trade';

const GRIND: OptionDecl = {
  name: 'Grind',
  displayType: 'dropdown',
  values: [{ value: 'Whole bean' }, { value: 'Filter grind' }, { value: 'Espresso grind' }],
};
const SIZE: OptionDecl = {
  name: 'Size',
  displayType: 'dropdown',
  values: [{ value: '1kg' }, { value: '5kg' }],
};

/** A wholesale bean — Grind × Size (1kg / 5kg), six variants, priced by size with a per-kilo
 *  break at 5kg. The 1kg whole-bean variant is the default. */
const wholesaleBag = (opts: {
  handle: string;
  title: string;
  description: string;
  price1kg: number;
  price5kg: number;
  sku: string;
  categories: string[];
  collections: string[];
  tags: string[];
  asset: string;
  seoTitle: string;
  seoDescription: string;
}): Product => {
  const grinds: [string, string][] = [
    ['Whole bean', 'WB'],
    ['Filter grind', 'FL'],
    ['Espresso grind', 'ES'],
  ];
  const sizes: [string, string, number][] = [
    ['1kg', '1K', opts.price1kg],
    ['5kg', '5K', opts.price5kg],
  ];
  const variants: Variant[] = [];
  for (const [grind, gc] of grinds) {
    for (const [size, sc, price] of sizes) {
      variants.push({
        sku: `${opts.sku}-${gc}-${sc}`,
        priceCents: money(price),
        ...(grind === 'Whole bean' && size === '1kg' ? { isDefault: true } : {}),
        inventoryPolicy: 'continue',
        optionValues: { Grind: grind, Size: size },
      });
    }
  }
  return {
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: 'Wholesale coffee',
    vendor: VENDOR,
    tags: opts.tags,
    categoryHandles: opts.categories,
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    options: [GRIND, SIZE],
    variants,
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
  };
};

const PRODUCTS: Product[] = [
  wholesaleBag({
    handle: 'house-espresso',
    title: 'Foundry House Espresso',
    description:
      'The workhorse behind hundreds of bars — a chocolatey, syrupy blend built for volume, forgiving on the grinder and heavy enough to cut through milk without disappearing. Consistent batch to batch so your baristas dial in once and hold it through the rush. Minimum first order 6 x 1kg; per-kilo price improves at 5kg.',
    price1kg: 27,
    price5kg: 122,
    sku: 'FDY-ESP-HOUSE',
    categories: ['wholesale-beans'],
    collections: ['new-crop', 'cafe-essentials', 'espresso-program', 'opening-a-cafe'],
    tags: ['espresso', 'blend', 'wholesale', 'cafe'],
    asset: 'prod-house-espresso',
    seoTitle: 'Foundry House Espresso — wholesale espresso beans | Foundry Coffee Trade',
    seoDescription: 'A chocolatey, milk-friendly house espresso built for café volume. Trade bags by the 1kg and 5kg, per-kilo breaks.',
  }),
  wholesaleBag({
    handle: 'colombia-filter',
    title: 'Colombia Huila — Filter',
    description:
      'A clean, sweet washed Colombia for batch brew and pour-over — milk chocolate, red apple and caramel, medium-bodied and easy to sell all day. The house filter for cafés and the go-to for office batch machines. Minimum first order 6 x 1kg; per-kilo price improves at 5kg.',
    price1kg: 29,
    price5kg: 131,
    sku: 'FDY-FIL-COL',
    categories: ['wholesale-beans'],
    collections: ['new-crop', 'cafe-essentials', 'office-program'],
    tags: ['filter', 'single-origin', 'colombia', 'wholesale'],
    asset: 'prod-colombia-filter',
    seoTitle: 'Colombia Huila Filter — wholesale filter beans | Foundry Coffee Trade',
    seoDescription: 'A sweet, balanced washed Colombia for batch brew and pour-over. Trade bags by the 1kg and 5kg.',
  }),
  wholesaleBag({
    handle: 'decaf',
    title: 'Nightshift Decaf',
    description:
      'A sugarcane-process decaf that pours like the real thing — cocoa, roasted almond and dried cherry, with none of the flat papery note decaf is known for. The one your evening service and office breakroom actually reorder. Minimum first order 4 x 1kg; per-kilo price improves at 5kg.',
    price1kg: 29,
    price5kg: 131,
    sku: 'FDY-DEC-NS',
    categories: ['wholesale-beans'],
    collections: ['office-program'],
    tags: ['decaf', 'wholesale', 'cafe', 'office'],
    asset: 'prod-decaf',
    seoTitle: 'Nightshift Decaf — wholesale decaf beans | Foundry Coffee Trade',
    seoDescription: 'A genuinely good sugarcane-process decaf for café and office. Trade bags by the 1kg and 5kg.',
  }),
  {
    handle: 'filter-packs-case',
    title: 'Filter Sachets — Case of 100',
    description:
      'Pre-portioned, freshly ground filter sachets for offices, hotel rooms and back-of-house — one sachet per pot, no grinder, no waste, no guesswork. A case of 100 x 60g sachets of the Colombia filter, nitrogen-flushed for freshness. The easiest coffee program to run where there is no barista.',
    status: 'active',
    productType: 'Filter coffee',
    vendor: VENDOR,
    tags: ['filter', 'sachets', 'office', 'wholesale'],
    categoryHandles: ['filter-capsules'],
    collectionHandles: ['office-program', 'cafe-essentials'],
    seoTitle: 'Filter Sachets, case of 100 — wholesale filter coffee | Foundry Coffee Trade',
    seoDescription: 'Pre-portioned 60g filter sachets, case of 100, for offices and back-of-house. Nitrogen-flushed, roasted to order.',
    variants: [{ sku: 'FDY-FILPK-100', priceCents: money(48), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-filter-packs', isPrimary: true, alt: 'A case of filter coffee sachets' }],
  },
  {
    handle: 'capsules',
    title: 'Compostable Capsules',
    description:
      'Our house espresso in a fully compostable capsule for offices, meeting rooms and hotel suites — the coffee people actually like, in the format that needs no training. Compatible with standard domestic and office machines. Order by the box of 50 or the trade case of 200.',
    status: 'active',
    productType: 'Coffee capsules',
    vendor: VENDOR,
    tags: ['capsules', 'office', 'compostable', 'wholesale'],
    categoryHandles: ['filter-capsules'],
    collectionHandles: ['office-program'],
    seoTitle: 'Compostable Coffee Capsules — wholesale | Foundry Coffee Trade',
    seoDescription: 'House espresso in a compostable capsule for offices and hotels. Box of 50 or trade case of 200.',
    options: [
      { name: 'Pack', displayType: 'dropdown', values: [{ value: 'Box of 50' }, { value: 'Case of 200' }] },
    ],
    variants: [
      { sku: 'FDY-CAP-50', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue', optionValues: { Pack: 'Box of 50' } },
      { sku: 'FDY-CAP-200', priceCents: money(118), inventoryPolicy: 'continue', optionValues: { Pack: 'Case of 200' } },
    ],
    images: [{ assetId: 'prod-capsules', isPrimary: true, alt: 'A box of compostable coffee capsules' }],
  },
  {
    handle: 'flavour-syrups',
    title: 'Flavour Syrups — Case of 6',
    description:
      'The three flavours a café actually sells — vanilla, caramel and hazelnut — in 1L pump bottles, a case of six. Clean, not cloying, and made to hold up in milk. Mix the case across flavours or keep it to one; either way it ships with pumps.',
    status: 'active',
    productType: 'Syrup',
    vendor: VENDOR,
    tags: ['syrup', 'extras', 'cafe', 'wholesale'],
    categoryHandles: ['syrups-extras'],
    collectionHandles: ['cafe-essentials'],
    seoTitle: 'Flavour Syrups, case of 6 — wholesale café syrups | Foundry Coffee Trade',
    seoDescription: 'Vanilla, caramel and hazelnut syrups in 1L pump bottles, a case of six. Made to hold up in milk.',
    options: [
      {
        name: 'Flavour',
        displayType: 'dropdown',
        values: [{ value: 'Vanilla' }, { value: 'Caramel' }, { value: 'Hazelnut' }, { value: 'Mixed case' }],
      },
    ],
    variants: [
      { sku: 'FDY-SYR-VAN', priceCents: money(54), isDefault: true, inventoryPolicy: 'continue', optionValues: { Flavour: 'Vanilla' } },
      { sku: 'FDY-SYR-CAR', priceCents: money(54), inventoryPolicy: 'continue', optionValues: { Flavour: 'Caramel' } },
      { sku: 'FDY-SYR-HAZ', priceCents: money(54), inventoryPolicy: 'continue', optionValues: { Flavour: 'Hazelnut' } },
      { sku: 'FDY-SYR-MIX', priceCents: money(54), inventoryPolicy: 'continue', optionValues: { Flavour: 'Mixed case' } },
    ],
    images: [{ assetId: 'prod-syrups', isPrimary: true, alt: 'A case of flavour syrup bottles' }],
  },
  {
    handle: 'takeaway-cups',
    title: 'Branded Takeaway Cups — Case of 1000',
    description:
      'Double-wall takeaway cups that hold heat without a sleeve, printed with your logo or left plain, lids included. A case of 1000 in the size your bar runs on. Set up your artwork once with your account manager and reorder in a click. Minimum print run one case per size.',
    status: 'active',
    productType: 'Disposables',
    vendor: VENDOR,
    tags: ['cups', 'disposables', 'branded', 'cafe', 'wholesale'],
    categoryHandles: ['syrups-extras'],
    collectionHandles: ['cafe-essentials', 'espresso-program', 'opening-a-cafe'],
    seoTitle: 'Branded Takeaway Cups, case of 1000 — wholesale | Foundry Coffee Trade',
    seoDescription: 'Double-wall takeaway cups with lids, printed or plain, case of 1000. 8, 12 and 16oz.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: '8oz' }, { value: '12oz' }, { value: '16oz' }] },
    ],
    variants: [
      { sku: 'FDY-CUP-08', priceCents: money(88), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '8oz' } },
      { sku: 'FDY-CUP-12', priceCents: money(96), inventoryPolicy: 'continue', optionValues: { Size: '12oz' } },
      { sku: 'FDY-CUP-16', priceCents: money(104), inventoryPolicy: 'continue', optionValues: { Size: '16oz' } },
    ],
    images: [{ assetId: 'prod-cups', isPrimary: true, alt: 'A sleeve of double-wall takeaway cups' }],
  },
  {
    handle: 'commercial-grinder',
    title: 'On-Demand Espresso Grinder',
    description:
      'A commercial on-demand grinder built for a busy bar — flat burrs, a dosing display and a hopper that keeps up with back-to-back service. Supplied, installed and dialled in on your beans, with servicing and loan cover available on a wholesale account. The single biggest upgrade to a café’s cup.',
    status: 'active',
    productType: 'Equipment',
    vendor: VENDOR,
    tags: ['equipment', 'grinder', 'espresso', 'wholesale'],
    categoryHandles: ['equipment'],
    collectionHandles: ['espresso-program', 'opening-a-cafe'],
    seoTitle: 'On-Demand Espresso Grinder — commercial café equipment | Foundry Coffee Trade',
    seoDescription: 'A commercial flat-burr on-demand espresso grinder, supplied, installed and serviced on a wholesale account.',
    variants: [{ sku: 'FDY-EQ-GRINDER', priceCents: money(1290), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-grinder', isPrimary: true, alt: 'A commercial on-demand espresso grinder' }],
  },
  {
    handle: 'trade-sampler',
    title: 'Trade Tasting Box',
    description:
      'The way to choose before you commit — a sampler of our house espresso, the Colombia filter and the seasonal single origin, each a 250g bag, with dialling-in notes for every one. Cup them on your own machine with your own team, then build your program from what your bar actually pours.',
    status: 'active',
    productType: 'Sampler',
    vendor: VENDOR,
    tags: ['sampler', 'trade', 'wholesale', 'tasting'],
    categoryHandles: ['wholesale-beans'],
    collectionHandles: ['new-crop'],
    seoTitle: 'Trade Tasting Box — wholesale coffee samples | Foundry Coffee Trade',
    seoDescription: 'A sampler of house espresso, Colombia filter and the seasonal single origin, with dialling-in notes. Choose before you commit.',
    variants: [{ sku: 'FDY-SAMPLE-BOX', priceCents: money(45), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-sampler', isPrimary: true, alt: 'A trade tasting box of sample bags' }],
  },
  {
    handle: 'standing-order',
    title: 'Weekly Standing Order',
    description:
      'A recurring trade delivery that keeps your bar stocked without a phone call every week — set your regular lines and quantities and we roast and freight them on your schedule. Skip a week, change quantities or pause any time from your account. The price shown is a representative starter; your account manager builds it to your real order.',
    status: 'active',
    productType: 'Standing order',
    vendor: VENDOR,
    tags: ['standing-order', 'subscription', 'wholesale', 'recurring'],
    categoryHandles: ['wholesale-beans'],
    collectionHandles: ['cafe-essentials', 'office-program'],
    seoTitle: 'Weekly Standing Order — recurring wholesale coffee delivery | Foundry Coffee Trade',
    seoDescription: 'A recurring trade delivery built to your order — skip, adjust or pause any time. Roasted to order every cycle.',
    options: [
      { name: 'Frequency', displayType: 'dropdown', values: [{ value: 'Weekly' }, { value: 'Fortnightly' }] },
    ],
    variants: [
      { sku: 'FDY-STO-WK', priceCents: money(140), isDefault: true, inventoryPolicy: 'continue', optionValues: { Frequency: 'Weekly' } },
      { sku: 'FDY-STO-FN', priceCents: money(150), inventoryPolicy: 'continue', optionValues: { Frequency: 'Fortnightly' } },
    ],
    images: [{ assetId: 'prod-standing-order', isPrimary: true, alt: 'Trade coffee bags packed for a standing-order delivery' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'wholesale-beans', name: 'Wholesale beans', description: 'Trade coffee by the 1kg and 5kg bag.', featured: true },
    { handle: 'filter-capsules', name: 'Filter & capsules', description: 'Filter sachets and office capsules.', featured: true },
    { handle: 'syrups-extras', name: 'Syrups & extras', description: 'Syrups, cups and back-bar supplies.', featured: true },
    { handle: 'equipment', name: 'Equipment', description: 'Grinders and brewers, supplied and serviced.', featured: true },
  ],
  collections: [
    {
      handle: 'new-crop',
      name: 'New crop',
      description: 'The coffees on the roaster right now.',
      type: 'manual',
      featured: true,
      productHandles: ['colombia-filter', 'house-espresso', 'trade-sampler'],
    },
    {
      handle: 'cafe-essentials',
      name: 'Café essentials',
      description: 'The lines every bar orders first.',
      type: 'manual',
      featured: true,
      productHandles: ['house-espresso', 'filter-packs-case', 'takeaway-cups', 'flavour-syrups'],
    },
    {
      handle: 'office-program',
      name: 'Office program',
      description: 'No-barista coffee for offices and breakrooms.',
      type: 'manual',
      featured: false,
      productHandles: ['capsules', 'filter-packs-case', 'decaf', 'standing-order'],
    },
    {
      handle: 'espresso-program',
      name: 'Espresso program',
      description: 'Everything to run a great espresso bar.',
      type: 'manual',
      featured: false,
      productHandles: ['house-espresso', 'commercial-grinder', 'takeaway-cups'],
    },
    {
      handle: 'opening-a-cafe',
      name: 'Opening a café',
      description: 'The starter kit for a brand-new site.',
      type: 'manual',
      featured: false,
      productHandles: ['commercial-grinder', 'house-espresso', 'filter-packs-case', 'takeaway-cups'],
    },
  ],
  products: PRODUCTS,
};

// ── Content (the journal) ────────────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
  {
    typeKey: 'blog_post',
    slug: 'dialling-in-for-your-cafe',
    status: 'published',
    body: {
      title: 'Dialling in a house espresso for a busy bar',
      excerpt: 'A repeatable way to set up an espresso and keep it there through service — the version we run when we install a new account.',
      featuredImage: { $asset: 'post-dialling' },
      body: {
        type: 'doc',
        content: [
          para('A café does not need a competition recipe; it needs an espresso that tastes right on the first shot of the morning and the two-hundredth of the afternoon. When we install a new wholesale account, this is the process we run with the team, and it is the one we leave behind on a card by the machine.'),
          h2('Start from a target, not a number'),
          para('Pick a dose your basket is built for — say 18 grams in, 36 out — and a shot time in the high twenties of seconds. Those are starting points, not laws. Pull a shot, taste it in milk (because that is what you sell), and adjust ONE thing: grind finer if it is sour and thin, coarser if it is bitter and dry. Change grind, not dose, until the flavour lands; a bar that chases three variables at once never holds any of them.'),
          h2('Hold it through the day'),
          para('Coffee grinds differently as the room warms and the beans age off roast, so the setting that was right at 7am drifts by lunch. Re-check at the two obvious inflection points — mid-morning and after the lunch rush — and nudge the grind a notch if the shot time has wandered. Log the setting each morning. Fresh, consistent beans roasted to order do most of the work here; a stable coffee is the difference between two grind tweaks a day and twenty.'),
          para('If a shot ever tastes wrong and the grind looks right, check the basics before you chase the grinder: a clean group head, a dry basket, a firm level tamp, and beans that are within their window. Nine times out of ten it is one of those, not the recipe.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'getting-the-most-from-a-standing-order',
    status: 'published',
    body: {
      title: 'Getting the most from a standing order',
      excerpt: 'A standing order is the quietest way to keep a bar stocked — here is how to set one that fits your real trade and never leaves you short.',
      featuredImage: { $asset: 'post-standing' },
      body: {
        type: 'doc',
        content: [
          para('The most common supply problem we see is not price — it is running out mid-service on a Saturday, or a storeroom full of coffee going stale because someone over-ordered to be safe. A standing order fixes both when it is set to your real numbers, and it takes ten minutes to get right.'),
          h2('Size it to a week of cups'),
          para('Work back from how many drinks you actually pour. A rough rule: a kilo of espresso makes around 140 doubles, so a bar doing 200 coffees a day needs roughly ten kilos a week with a little headroom. Set the standing order a touch under your peak and top up with a one-off when a big week is coming, rather than carrying weeks of stock that ages on the shelf.'),
          h2('Use skip and adjust'),
          para('Trade is not flat, so your delivery should not be either. Going quiet for a public holiday or a slow January? Skip a cycle or drop the quantity from your account in a couple of taps — the schedule bends around your calendar instead of the other way round. Catering a big event? Add the extra to the next delivery so it arrives freshly roasted, not pulled from a back-room hoard.'),
          para('Because every cycle is roasted to order, what turns up is always fresh — the standing order is a schedule, not a stockpile. Your account manager can rebuild it any time your trade shifts; that is what it is there for.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'keeping-your-equipment-honest',
    status: 'published',
    body: {
      title: 'Keeping your equipment honest',
      excerpt: 'A grinder and a machine that are clean and serviced make better coffee than an expensive setup that is neither. The routine that keeps a bar pouring.',
      featuredImage: { $asset: 'post-equipment' },
      body: {
        type: 'doc',
        content: [
          para('Great beans cannot rescue a dirty machine, and the fastest way to make a café’s coffee worse is to skip the cleaning. None of this is hard — it is a routine, and once it is a habit the equipment stops being a source of surprises.'),
          h2('Daily and weekly'),
          para('Every day: backflush the espresso machine with water at close, wipe the group seals, empty and rinse the grinder hopper, and brush the grinds off the chute. Every week: backflush with detergent, soak the portafilters and baskets, and run a grinder clean through the burrs. Ten minutes a night and half an hour on a quiet morning is the whole cost, and it pays back in shots that taste the way they should.'),
          h2('When to call us'),
          para('Burrs wear. When your grind setting keeps creeping finer to hold the same shot time, or the grind looks uneven and dusty, the burrs are near the end of their life and it is time for a service — not a bag of blame on the beans. On a wholesale account that service is booked through us, and if a machine has to come out we cover you with loan gear so the bar never goes dark.'),
          para('Clean equipment, sharp burrs and coffee within its window: get those three right and the espresso looks after itself. Get any one wrong and no recipe will save it.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'b2b-coffee-wholesale',
  key: 'sparx-b2b-coffee-wholesale',
  name: 'sparx — Coffee Roaster (Wholesale)',
  theme: THEME,
  summary:
    'A complete, working wholesale shop for a trade coffee roaster: beans by the 1kg and 5kg bag, filter and capsule programs, syrups, disposables, a commercial grinder, a trade sampler and a weekly standing order — with categories, collections, a buyer-framed PDP (trade pricing, standing orders, net-30) and a merchandised home page. Industrial roastery theme — cool graphite ground, deep espresso, burnt copper. Shipped as Foundry Coffee Trade.',
  tagline: 'A working trade storefront for a wholesale coffee roaster.',
  vertical: 'b2b',
  industry: 'Wholesale coffee roaster',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 86,
  brand: {
    businessName: 'Foundry Coffee Trade',
    tagline: 'The roaster behind your counter.',
  },
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Foundry Coffee Trade — wholesale coffee for cafés, offices and restaurants',
      description:
        'Foundry Coffee Trade is a wholesale roaster supplying cafés, offices and restaurants — beans, filter and capsule programs, syrups, cups and equipment, on trade pricing with standing orders and net-30.',
    },
    about: {
      title: 'About Foundry Coffee Trade',
      description:
        'How Foundry roasts and supplies the trade — roasted to order, named farms, trade pricing, standing orders, barista training, equipment servicing and net-30 terms.',
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
