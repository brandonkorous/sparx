// sparx-retail-stationery-editorial — a RETAIL/COMMERCE site template: a stationery &
// paper-goods shop.
//
// A complete, working shop the moment it installs — a real catalogue (hardcover notebooks
// with ruling variants, a fountain pen, bottled inks, a weekly planner, a desk pad, card
// sets, washi tape and a gift bundle), categories + collections, a bespoke PDP, and the full
// 9-page commerce site (home merchandising → shop → collections → cart → search → journal →
// about → contact), dressed in an INLINE bespoke theme (a warm paper ground, a confident
// ink-blue primary and a warm-red accent, under a characterful Fraunces display over clean
// Karla). Shipped as Margin & Co.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family it carries its OWN theme inline
// and passes it on the spec (`theme`), so the whole family can be authored in parallel without
// any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-stationery-editorial.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-stationery-editorial/**" \
//     "marketplace-catalog/_gen/gen-retail-stationery-editorial.ts"
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
// An editorial paper shop: a warm cream ground, deep ink for text, an ink-blue primary and a
// warm-red accent — the two colours a literary press already prints in. A characterful Fraunces
// display over a clean Karla body, crisp corners, zero depth. Complete light + dark, AA on every
// role (the blueprint sweep's contrast check is the gate). `secondary` stays dark and legible on
// the light ground (≤ ~42% L), so the uppercase labels it paints read as ink, not as a wash.
const THEME = defineTheme({
  name: 'margin-press',
  type: { body: face('Karla', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.375rem', field: '0.25rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: ['oklch(97% 0.02 85)', 'oklch(94% 0.028 82)', 'oklch(89% 0.035 78)', 'oklch(24% 0.03 260)'],
    roles: {
      primary: 'oklch(38% 0.11 255)',
      secondary: 'oklch(42% 0.06 255)',
      accent: 'oklch(52% 0.18 28)',
      neutral: 'oklch(28% 0.03 260)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(21% 0.02 260)', 'oklch(18% 0.02 260)', 'oklch(15% 0.02 260)', 'oklch(95% 0.02 85)'],
    roles: {
      primary: 'oklch(76% 0.11 255)',
      secondary: 'oklch(78% 0.06 255)',
      accent: 'oklch(72% 0.15 30)',
      neutral: 'oklch(32% 0.02 260)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "paper-hero": "https://images.unsplash.com/photo-1554757387-2a28855c78fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3BlbiUyMGRvdC1ncmlkJTIwbm90ZWJvb2slMjBmb3VudGFpbiUyMHBlbiUyMHdhcm0lMjBjdXB8ZW58MHwwfHx8MTc4NjQwMzg3Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paper-tile-notebooks": "https://images.unsplash.com/photo-1647559709189-a257be60e147?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBjbG90aC1ib3VuZCUyMGhhcmRjb3ZlciUyMG5vdGVib29rc3xlbnwwfDB8fHwxNzg2NDAzODc5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paper-tile-pens": "https://images.unsplash.com/photo-1455390582262-044cdead277a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm91bnRhaW4lMjBwZW4lMjByZXN0aW5nJTIwaGFuZHdyaXR0ZW4lMjBwYWdlfGVufDB8MHx8fDE3ODY0MDM4ODJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paper-tile-planners": "https://images.unsplash.com/photo-1435527173128-983b87201f4d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3BlbiUyMHdlZWtseSUyMHBsYW5uZXIlMjB3ZWVrJTIwYmxvY2tlZCUyMG91dCUyMGJ5fGVufDB8MHx8fDE3ODY0MDM4ODV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paper-tile-gifts": "https://images.unsplash.com/photo-1608824405605-88c9d2c847e8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d3JhcHBlZCUyMHN0YXRpb25lcnklMjBnaWZ0JTIwc2V0JTIwdGllZCUyMHJpYmJvbnxlbnwwfDB8fHwxNzg2NDAzODg4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paper-band-made": "https://images.unsplash.com/photo-1776352184995-280e1a04d472?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHMlMjBzdGl0Y2hpbmclMjBiaW5kaW5nJTIwbm90ZWJvb2slMjBiZW5jaHxlbnwwfDB8fHwxNzg2NDAzODkxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "paper-band-write": "https://images.unsplash.com/photo-1605958031637-ae1ce21c9daa?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGVyc29uJTIwd3JpdGluZyUyMG5vdGVib29rJTIwYnklMjBzdW5saXQlMjB3aW5kb3d8ZW58MHwwfHx8MTc4NjQwMzg5NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-margin-notebook": "https://images.unsplash.com/photo-1651761409007-0395097c269d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xvdGgtYm91bmQlMjBoYXJkY292ZXIlMjBub3RlYm9vayUyMGx5aW5nJTIwb3BlbiUyMGRvdC1ncmlkJTIwcGFnZXxlbnwwfDB8fHwxNzg2NDAzODk3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-pocket-notebook": "https://images.unsplash.com/photo-1710625040193-79a7728d7677?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhyZWUtcGFjayUyMHNsaW0lMjBwb2NrZXQlMjBub3RlYm9va3MlMjBmYW5uZWQlMjBvdXR8ZW58MHwwfHx8MTc4NjQwMzkwMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-fountain-pen": "https://images.unsplash.com/photo-1583162557635-53d9931332c5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8bGFjcXVlcmVkJTIwZm91bnRhaW4lMjBwZW4lMjBjYXAlMjBvZmYlMjBiZXNpZGUlMjBpbmt3ZWxsfGVufDB8MHx8fDE3ODY0MDM5MDN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-writers-ink": "https://images.unsplash.com/photo-1531087131490-07836ca4341d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhc3MlMjBib3R0bGUlMjB3cml0aW5nJTIwaW5rJTIwZmlsbGVkJTIwcGVuJTIwbmlifGVufDB8MHx8fDE3ODY0MDM5MDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-weekly-planner": "https://images.unsplash.com/photo-1629824019366-ffcb6b334634?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dW5kYXRlZCUyMHdlZWtseSUyMHBsYW5uZXIlMjBvcGVuZWQlMjBmbGF0JTIwZGVza3xlbnwwfDB8fHwxNzg2NDAzOTA5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-desk-pad": "https://images.unsplash.com/photo-1493934558415-9d19f0b2b4d2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVhci1vZmYlMjBtb250aGx5JTIwZGVzayUyMHBhZCUyMHdvb2RlbiUyMGRlc2t8ZW58MHwwfHx8MTc4NjQwMzkxM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-card-set": "https://images.unsplash.com/photo-1699662585139-140a988be1a8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94ZWQlMjBzZXQlMjBsZXR0ZXJwcmVzcyUyMGdyZWV0aW5nJTIwY2FyZHMlMjBlbnZlbG9wZXN8ZW58MHwwfHx8MTc4NjQwMzkxNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-washi-tape": "https://images.unsplash.com/photo-1511285547760-79b561563b35?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhyZWUlMjByb2xscyUyMHBhdHRlcm5lZCUyMHdhc2hpJTIwdGFwZXxlbnwwfDB8fHwxNzg2NDAzOTE5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-desk-kit": "https://images.unsplash.com/photo-1632180808903-7b944284f86f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2lmdCUyMGJveCUyMGhvbGRpbmclMjBub3RlYm9vayUyMHBlbiUyMGJvdHRsZSUyMGlua3xlbnwwfDB8fHwxNzg2NDAzOTIzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-handwriting": "https://images.unsplash.com/photo-1591195852468-03a01d1375d6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZCUyMHdyaXRpbmclMjBsb25naGFuZCUyMG5vdGVzJTIwbGluZWQlMjBub3RlYm9va3xlbnwwfDB8fHwxNzg2NDAzOTI2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-choosing-paper": "https://images.unsplash.com/photo-1554757387-fa0367573d09?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bm90ZWJvb2slMjBwYWdlcyUyMHNob3dpbmclMjBkb3R0ZWQlMjBsaW5lZCUyMGJsYW5rJTIwcnVsaW5nc3xlbnwwfDB8fHwxNzg2NDAzOTI5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-gift-guide": "https://images.unsplash.com/photo-1518291043933-49e998050694?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxhdC1sYXklMjBzdGF0aW9uZXJ5JTIwZ2lmdHMlMjB3cmFwcGVkJTIwa3JhZnQlMjBwYXBlcnxlbnwwfDB8fHwxNzg2NDAzOTMyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'paper-hero', url: src('paper-hero'), alt: 'An open dot-grid notebook, a fountain pen and a warm cup on a paper-strewn desk' },
  { id: 'paper-tile-notebooks', url: src('paper-tile-notebooks'), alt: 'A stack of cloth-bound hardcover notebooks' },
  { id: 'paper-tile-pens', url: src('paper-tile-pens'), alt: 'A fountain pen resting on a handwritten page' },
  { id: 'paper-tile-planners', url: src('paper-tile-planners'), alt: 'An open weekly planner with a week blocked out by hand' },
  { id: 'paper-tile-gifts', url: src('paper-tile-gifts'), alt: 'A wrapped stationery gift set tied with ribbon' },
  { id: 'paper-band-made', url: src('paper-band-made'), alt: 'Hands stitching the binding of a notebook at a bench' },
  { id: 'paper-band-write', url: src('paper-band-write'), alt: 'A person writing in a notebook by a sunlit window' },
  { id: 'prod-margin-notebook', url: src('prod-margin-notebook'), alt: 'A cloth-bound hardcover notebook lying open to a dot-grid page' },
  { id: 'prod-pocket-notebook', url: src('prod-pocket-notebook'), alt: 'A three-pack of slim pocket notebooks fanned out' },
  { id: 'prod-fountain-pen', url: src('prod-fountain-pen'), alt: 'A lacquered fountain pen with its cap off beside an inkwell' },
  { id: 'prod-writers-ink', url: src('prod-writers-ink'), alt: 'A glass bottle of writing ink with a filled pen nib' },
  { id: 'prod-weekly-planner', url: src('prod-weekly-planner'), alt: 'An undated weekly planner opened flat on a desk' },
  { id: 'prod-desk-pad', url: src('prod-desk-pad'), alt: 'A tear-off monthly desk pad on a wooden desk' },
  { id: 'prod-card-set', url: src('prod-card-set'), alt: 'A boxed set of letterpress greeting cards with envelopes' },
  { id: 'prod-washi-tape', url: src('prod-washi-tape'), alt: 'Three rolls of patterned washi tape' },
  { id: 'prod-desk-kit', url: src('prod-desk-kit'), alt: 'A gift box holding a notebook, a pen and a bottle of ink' },
  { id: 'post-handwriting', url: src('post-handwriting'), alt: 'A hand writing longhand notes in a lined notebook' },
  { id: 'post-choosing-paper', url: src('post-choosing-paper'), alt: 'Notebook pages showing dotted, lined and blank rulings' },
  { id: 'post-gift-guide', url: src('post-gift-guide'), alt: 'A flat-lay of stationery gifts wrapped in kraft paper' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-stationery-editorial: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm photograph, a serif headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('paper-hero'), alt: 'An open notebook and a fountain pen on a desk', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Made for people who still write things down.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Margin & Co. is a small paper shop for the analog habit — notebooks that lie flat, pens worth refilling, planners you actually keep. Nothing precious, everything usable, made to be written in until it falls apart.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the desk' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop/notebooks' },
                      text: 'Start with a notebook',
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
            text: 'Start somewhere',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'paper-tile-notebooks', label: 'Notebooks', href: '/shop', alt: 'A stack of cloth-bound notebooks' }),
              categoryTile({ assetId: 'paper-tile-pens', label: 'Pens & ink', href: '/shop', alt: 'A fountain pen on a written page' }),
              categoryTile({ assetId: 'paper-tile-planners', label: 'Planners', href: '/shop', alt: 'An open weekly planner' }),
              categoryTile({ assetId: 'paper-tile-gifts', label: 'Cards & gifts', href: '/shop', alt: 'A wrapped stationery gift' }),
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

const HOME: Node[] = [
  hero(),
  categoryTiles(),
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New this season' }),
  editorialBand({
    heading: 'Paper that earns the ink',
    lead: 'Every notebook we carry is chosen for one thing: how it feels to write in. Thick, fountain-pen-friendly stock that won’t bleed or ghost, bindings that lie flat, covers that survive a bag. If a sample can’t take a wet nib, it doesn’t make the shelf.',
    assetId: 'paper-band-made',
    cta: 'How we choose paper',
    href: '/blog/how-to-choose-a-notebook',
    alt: 'Hands stitching a notebook binding at a bench',
  }),
  productsBlock({ source: 'commerce.category.notebooks', layout: 'carousel', heading: 'Notebooks' }),
  editorialBand({
    heading: 'The analog habit',
    lead: 'Writing by hand is slower on purpose — it’s how a thought gets caught before it slips. A notebook doesn’t buzz, doesn’t update, and never asks you to log in. Keep one on the desk and one in the bag, and see what you stop forgetting.',
    assetId: 'paper-band-write',
    cta: 'Why we still write things down',
    href: '/blog/why-we-still-write-things-down',
    alt: 'A person writing in a notebook by a window',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static shop note, and policy links). */
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
                    text: 'Margin & Co.',
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
              el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Packed to be written in' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Every order is checked by hand, wrapped in recycled kraft, and posted within two working days. Adding a card? Tell us at checkout and we’ll write your note and leave the price off.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Goes on the same desk' });

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
    'The whole desk',
    'Everything we carry — notebooks and pocket books, pens and ink, planners and desk pads, cards, tape and gift sets. Filter by category or sort however you like; every order is wrapped by hand and posted within two days.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead(
    'Collections',
    'The shop grouped the way people actually buy — the new season’s arrivals, the everyday-carry kit, the planner desk, the writing set, and gifts for the person who loves their stationery.'
  ),
];
const SEARCH: Node[] = [
  pageMasthead('Search Margin & Co.', 'Looking for a ruling, a nib, an ink colour or a gift? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free UK shipping over $40, gift wrap on request, and a note tucked in if you ask. Not quite right when it lands? Send it back within 30 days — unused paper should find the right desk.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Margin' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the shop — how to choose paper, how to keep a habit going, and what to give the person who already has a nice pen. Practical, opinionated, no stationery snobbery.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Margin & Co.' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Margin & Co. started at a market stall with a box of notebooks and a strong opinion about paper. It grew the slow way — one favourite pen, one repeat customer, one “what would you actually use?” at a time — and it still runs on the same test: if we wouldn’t keep it on our own desk, we don’t sell it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We carry small makers and a few classics, and we choose everything by writing in it, not by reading the spec sheet. Fountain-pen-friendly stock, bindings that lie flat, refills you can find again in a year. Nothing here is precious — it’s meant to be used up and replaced.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No mystery “luxury” markups, no throwaway gimmicks, no notebook so nice you’re afraid to open it. Just good paper goods, packed with care and posted quickly, for people who still write things down.',
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
    heading: 'Say hello',
    intro: 'A question about a nib, a wholesale enquiry, or a custom gift order for the office? Tell us what you’re after and a real person at the shop will write back — usually the same day.',
    submitLabel: 'Email the shop',
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

const RULING: OptionDecl = {
  name: 'Ruling',
  displayType: 'dropdown',
  values: [{ value: 'Dotted' }, { value: 'Lined' }, { value: 'Blank' }],
};

/** A notebook, offered in three rulings — the one option a notebook genuinely varies on. */
const notebook = (opts: {
  handle: string;
  title: string;
  description: string;
  price: number;
  sku: string;
  collections: string[];
  tags: string[];
  asset: string;
  alt: string;
  seoTitle: string;
  seoDescription: string;
}): Product => ({
  handle: opts.handle,
  title: opts.title,
  description: opts.description,
  status: 'active',
  productType: 'Notebook',
  vendor: 'Margin & Co.',
  tags: opts.tags,
  categoryHandles: ['notebooks'],
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [RULING],
  variants: [
    { sku: `${opts.sku}-DOT`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Ruling: 'Dotted' } },
    { sku: `${opts.sku}-LIN`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Ruling: 'Lined' } },
    { sku: `${opts.sku}-BLK`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Ruling: 'Blank' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.alt }],
});

const PRODUCTS: Product[] = [
  notebook({
    handle: 'margin-notebook',
    title: 'The Margin Notebook',
    description:
      'Our flagship hardcover — a cloth-bound A5 with 192 pages of 120gsm ivory stock that takes a wet nib without a whisper of bleed. Lies dead flat on a stitched binding, keeps its shape in a bag, and has a proper ribbon and an elastic that actually holds. The one to write the year in.',
    price: 24,
    sku: 'MARGIN-NB-A5',
    collections: ['new-arrivals', 'best-sellers', 'writing-kit'],
    tags: ['notebook', 'hardcover', 'a5', 'fountain-pen-friendly'],
    asset: 'prod-margin-notebook',
    alt: 'A cloth-bound hardcover notebook open to a dot-grid page',
    seoTitle: 'The Margin Notebook — cloth-bound A5 hardcover | Margin & Co.',
    seoDescription: 'A flat-lying cloth-bound A5 hardcover with 192 pages of fountain-pen-friendly 120gsm ivory paper. Dotted, lined or blank.',
  }),
  notebook({
    handle: 'pocket-notebook',
    title: 'Pocket Notebook, Set of Three',
    description:
      'A three-pack of slim staple-bound pocket books that live in a jacket or a back pocket — the place a passing thought actually gets caught. Sixty-four pages each of the same smooth 90gsm stock as the big notebook, in a stitched kraft cover that ages nicely and never looks precious.',
    price: 16,
    sku: 'MARGIN-NB-PKT',
    collections: ['everyday-carry', 'best-sellers'],
    tags: ['notebook', 'pocket', 'set', 'everyday-carry'],
    asset: 'prod-pocket-notebook',
    alt: 'A three-pack of slim pocket notebooks fanned out',
    seoTitle: 'Pocket Notebook, Set of Three — pocket-size notebooks | Margin & Co.',
    seoDescription: 'A set of three staple-bound pocket notebooks in kraft covers, 64 pages each. Dotted, lined or blank.',
  }),
  {
    handle: 'fountain-pen',
    title: 'The Fieldnote Fountain Pen',
    description:
      'A pen built to be a daily writer, not a display piece — a balanced resin body, a smooth steel medium nib, and a standard converter so you can fill it from a bottle or drop in a cartridge. It starts on the first stroke after a week in a drawer, which is the only test a pen has to pass.',
    status: 'active',
    productType: 'Pen',
    vendor: 'Margin & Co.',
    tags: ['pen', 'fountain-pen', 'writing'],
    categoryHandles: ['pens'],
    collectionHandles: ['new-arrivals', 'everyday-carry', 'writing-kit'],
    seoTitle: 'The Fieldnote Fountain Pen — everyday fountain pen | Margin & Co.',
    seoDescription: 'A balanced everyday fountain pen with a smooth steel medium nib and a standard converter. Fills from a bottle or a cartridge.',
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Ink Black' }, { value: 'Slate Blue' }, { value: 'Oxblood' }] },
    ],
    variants: [
      { sku: 'MARGIN-PEN-FP-BLK', priceCents: money(68), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Ink Black' } },
      { sku: 'MARGIN-PEN-FP-BLU', priceCents: money(68), inventoryPolicy: 'continue', optionValues: { Colour: 'Slate Blue' } },
      { sku: 'MARGIN-PEN-FP-OXB', priceCents: money(68), inventoryPolicy: 'continue', optionValues: { Colour: 'Oxblood' } },
    ],
    images: [{ assetId: 'prod-fountain-pen', isPrimary: true, alt: 'A lacquered fountain pen with its cap off' }],
  },
  {
    handle: 'writers-ink',
    title: 'Writer’s Ink, 30ml',
    description:
      'A bottle of properly saturated fountain-pen ink that flows wet and dries fast, in colours worth reaching for. Non-permanent and pen-safe, it rinses clean between fills — so keep one of each on the desk and switch by mood, not by machine.',
    status: 'active',
    productType: 'Ink',
    vendor: 'Margin & Co.',
    tags: ['ink', 'fountain-pen', 'writing'],
    categoryHandles: ['pens'],
    collectionHandles: ['everyday-carry', 'writing-kit'],
    seoTitle: 'Writer’s Ink, 30ml — bottled fountain-pen ink | Margin & Co.',
    seoDescription: 'A 30ml bottle of saturated, pen-safe fountain-pen ink that flows wet and dries fast. Midnight, Sepia or Teal.',
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Midnight' }, { value: 'Sepia' }, { value: 'Teal' }] },
    ],
    variants: [
      { sku: 'MARGIN-INK-30-MID', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Midnight' } },
      { sku: 'MARGIN-INK-30-SEP', priceCents: money(18), inventoryPolicy: 'continue', optionValues: { Colour: 'Sepia' } },
      { sku: 'MARGIN-INK-30-TEA', priceCents: money(18), inventoryPolicy: 'continue', optionValues: { Colour: 'Teal' } },
    ],
    images: [{ assetId: 'prod-writers-ink', isPrimary: true, alt: 'A glass bottle of writing ink beside a pen nib' }],
  },
  {
    handle: 'weekly-planner',
    title: 'Undated Weekly Planner',
    description:
      'A week-to-a-spread planner with no printed dates — so you start it in January or in July, and a skipped week costs you nothing. A full column for each day, a notes margin down the side, and a lay-flat binding that stays open while you actually plan. Fifty-two weeks of room to think.',
    status: 'active',
    productType: 'Planner',
    vendor: 'Margin & Co.',
    tags: ['planner', 'undated', 'weekly'],
    categoryHandles: ['planners'],
    collectionHandles: ['new-arrivals', 'planner-desk', 'best-sellers'],
    seoTitle: 'Undated Weekly Planner — week-to-a-spread planner | Margin & Co.',
    seoDescription: 'An undated week-to-a-spread planner with a notes margin and a lay-flat binding. Start any week, skip none.',
    variants: [{ sku: 'MARGIN-PLN-WKLY', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-weekly-planner', isPrimary: true, alt: 'An undated weekly planner opened flat' }],
  },
  {
    handle: 'desk-pad',
    title: 'Monthly Desk Pad',
    description:
      'A big tear-off desk pad that turns the month into something you can see at a glance — generous day boxes, a to-do rail down the side, and a heavy chipboard back so it sits flat under a keyboard or on the wall. Fifty sheets: a full year and change of clean starts.',
    status: 'active',
    productType: 'Planner',
    vendor: 'Margin & Co.',
    tags: ['planner', 'desk-pad', 'monthly'],
    categoryHandles: ['planners'],
    collectionHandles: ['planner-desk'],
    seoTitle: 'Monthly Desk Pad — tear-off monthly planner pad | Margin & Co.',
    seoDescription: 'A 50-sheet tear-off monthly desk pad with roomy day boxes, a to-do rail and a heavy chipboard back.',
    variants: [{ sku: 'MARGIN-PLN-DESK', priceCents: money(19), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-desk-pad', isPrimary: true, alt: 'A tear-off monthly desk pad on a desk' }],
  },
  {
    handle: 'card-set',
    title: 'Everyday Card Set, Box of Eight',
    description:
      'Eight letterpress cards for the occasions that don’t come with a printed line — a thank-you, a thinking-of-you, a well-done. Blank inside so the words are yours, on cotton stock with a deep impression you can feel, and eight kraft envelopes to match. The box to keep in a drawer for when you need one.',
    status: 'active',
    productType: 'Cards',
    vendor: 'Margin & Co.',
    tags: ['cards', 'letterpress', 'gift', 'set'],
    categoryHandles: ['cards-gifts'],
    collectionHandles: ['gifts', 'new-arrivals'],
    seoTitle: 'Everyday Card Set, Box of Eight — blank letterpress cards | Margin & Co.',
    seoDescription: 'A boxed set of eight blank letterpress cards on cotton stock with kraft envelopes. For the everyday occasions.',
    variants: [{ sku: 'MARGIN-CARD-SET8', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-card-set', isPrimary: true, alt: 'A boxed set of letterpress greeting cards' }],
  },
  {
    handle: 'washi-tape',
    title: 'Washi Tape Trio',
    description:
      'Three rolls of low-tack Japanese paper tape for the small joys of a page — flagging a spread, taping in a ticket, or just breaking up a wall of ink. Writes over cleanly, tears by hand, and peels off without a fight. Sold as a set that actually goes together.',
    status: 'active',
    productType: 'Accessory',
    vendor: 'Margin & Co.',
    tags: ['washi', 'tape', 'accessory', 'set'],
    categoryHandles: ['cards-gifts'],
    collectionHandles: ['gifts'],
    seoTitle: 'Washi Tape Trio — Japanese paper tape set | Margin & Co.',
    seoDescription: 'A set of three low-tack washi paper tapes that write over cleanly, tear by hand and peel off without a fight.',
    options: [
      { name: 'Colour', displayType: 'swatch', values: [{ value: 'Warm' }, { value: 'Cool' }, { value: 'Mono' }] },
    ],
    variants: [
      { sku: 'MARGIN-WASHI-WRM', priceCents: money(12), isDefault: true, inventoryPolicy: 'continue', optionValues: { Colour: 'Warm' } },
      { sku: 'MARGIN-WASHI-COL', priceCents: money(12), inventoryPolicy: 'continue', optionValues: { Colour: 'Cool' } },
      { sku: 'MARGIN-WASHI-MON', priceCents: money(12), inventoryPolicy: 'continue', optionValues: { Colour: 'Mono' } },
    ],
    images: [{ assetId: 'prod-washi-tape', isPrimary: true, alt: 'Three rolls of patterned washi tape' }],
  },
  {
    handle: 'desk-kit',
    title: 'The Desk Kit',
    description:
      'The whole starting point in one box — the Margin Notebook, the Fieldnote fountain pen, and a bottle of Writer’s Ink, wrapped and ready to give. It’s what we hand anyone who says they “should write more”: everything they need and nothing to figure out. Add a note at checkout and we’ll write it in.',
    status: 'active',
    productType: 'Gift set',
    vendor: 'Margin & Co.',
    tags: ['gift', 'bundle', 'set', 'writing-kit'],
    categoryHandles: ['cards-gifts'],
    collectionHandles: ['gifts', 'writing-kit', 'best-sellers'],
    seoTitle: 'The Desk Kit — notebook, pen & ink gift set | Margin & Co.',
    seoDescription: 'A boxed gift set: the Margin Notebook, the Fieldnote fountain pen and a bottle of Writer’s Ink, wrapped and ready to give.',
    variants: [{ sku: 'MARGIN-GIFT-DESK', priceCents: money(92), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-desk-kit', isPrimary: true, alt: 'A gift box holding a notebook, a pen and ink' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'notebooks', name: 'Notebooks', description: 'Hardcovers and pocket books, chosen for the paper.', featured: true },
    { handle: 'pens', name: 'Pens & ink', description: 'Fountain pens, refills and bottled ink.', featured: true },
    { handle: 'planners', name: 'Planners', description: 'Weekly planners and desk pads.', featured: true },
    { handle: 'cards-gifts', name: 'Cards & gifts', description: 'Cards, tape and gift sets.', featured: true },
  ],
  collections: [
    {
      handle: 'new-arrivals',
      name: 'New this season',
      description: 'The latest to land on the shelf.',
      type: 'manual',
      featured: true,
      productHandles: ['margin-notebook', 'fountain-pen', 'weekly-planner', 'card-set'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The desk staples people keep reordering.',
      type: 'manual',
      featured: true,
      productHandles: ['margin-notebook', 'pocket-notebook', 'weekly-planner', 'desk-kit'],
    },
    {
      handle: 'everyday-carry',
      name: 'Everyday carry',
      description: 'What lives in the bag and the jacket pocket.',
      type: 'manual',
      featured: false,
      productHandles: ['pocket-notebook', 'fountain-pen', 'writers-ink'],
    },
    {
      handle: 'planner-desk',
      name: 'The planner desk',
      description: 'Everything for keeping the week in order.',
      type: 'manual',
      featured: false,
      productHandles: ['weekly-planner', 'desk-pad'],
    },
    {
      handle: 'writing-kit',
      name: 'The writing kit',
      description: 'A notebook, a pen and an ink worth pairing.',
      type: 'manual',
      featured: false,
      productHandles: ['margin-notebook', 'fountain-pen', 'writers-ink', 'desk-kit'],
    },
    {
      handle: 'gifts',
      name: 'Gifts',
      description: 'For the person who loves their stationery.',
      type: 'manual',
      featured: false,
      productHandles: ['card-set', 'washi-tape', 'desk-kit'],
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
    slug: 'why-we-still-write-things-down',
    status: 'published',
    body: {
      title: 'Why we still write things down',
      excerpt: 'A notebook doesn’t buzz, doesn’t update, and never asks you to log in. Here’s the case for keeping one within reach — and what happens when you do.',
      featuredImage: { $asset: 'post-handwriting' },
      body: {
        type: 'doc',
        content: [
          para('Every note you’ve ever lost was lost in an app. It got typed into a box, autocorrected into nonsense, and buried under a hundred others you also can’t find. Paper doesn’t do that. A notebook holds exactly what you put in it, in the order you put it, and it’s still there next year without a password.'),
          h2('Slower on purpose'),
          para('Writing by hand is slower than typing, and that’s the point — the lag is where a thought gets caught before it slips. You can’t transcribe a meeting word for word by hand, so you listen for what matters and write that instead. The friction does the filtering for you, and what’s left on the page is the part worth keeping.'),
          h2('One on the desk, one in the bag'),
          para('The habit sticks when the notebook is closer than the phone. Keep a hardcover open on the desk for the day’s thinking and a pocket book in the bag for everything else, and you stop trusting your memory to hold what a pen could. Start small: one page a day, no rules about neatness. The blank page is patient, and it never runs out of battery.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'how-to-choose-a-notebook',
    status: 'published',
    body: {
      title: 'How to choose a notebook (that you’ll actually use)',
      excerpt: 'Ruling, paper weight, binding, size. Four decisions stand between you and a notebook you’ll finish — here’s how we’d make each one.',
      featuredImage: { $asset: 'post-choosing-paper' },
      body: {
        type: 'doc',
        content: [
          para('A notebook you don’t finish is the wrong notebook, and it’s usually wrong for a reason you can name. Get four things right and the rest is taste.'),
          h2('Ruling and paper'),
          para('Dotted is the quiet all-rounder — structure when you want it, invisible when you don’t. Lined suits long prose; blank suits sketches and mind-maps. More important than the lines is the stock: reach for 90gsm and up if you write with anything wet, or the ink will ghost through and you’ll only ever use one side of the page. Thick, smooth paper is the single upgrade you’ll feel every day.'),
          h2('Binding and size'),
          para('A stitched or lay-flat binding is worth holding out for — a notebook that won’t stay open is a notebook you fight. For size, match it to where it lives: A5 is the desk workhorse, a pocket book rides in a jacket, and an A4 is for the person who really spreads out. Buy the one that fits the habit you already have, not the one you wish you had, and you’ll fill it.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'a-stationery-gift-guide',
    status: 'published',
    body: {
      title: 'A gift guide for the person who loves their desk',
      excerpt: 'They already have a nice pen — so what do you get them? A short, tested list for the stationery lover who’s hard to shop for.',
      featuredImage: { $asset: 'post-gift-guide' },
      body: {
        type: 'doc',
        content: [
          para('The stationery lover is the easiest person to buy for and the easiest to get wrong — they have opinions, and a bad notebook is worse than no notebook. The trick is to give them something better than what they’d begrudgingly buy themselves, or something they’d never think to.'),
          h2('If they’re just starting'),
          para('Give the whole beginning in one box. A good hardcover, a pen that starts on the first stroke, and a bottle of ink to make it theirs — that’s a habit handed over, not just an object. It’s the gift for the friend who keeps saying they “should write more,” with nothing left for them to figure out.'),
          h2('If they already have everything'),
          para('Go consumable and go colourful. A trio of washi tape, a fresh ink in a colour they’d never pick, a box of blank letterpress cards for the notes they mean to send — small, used-up things that don’t compete with the nice pen they already love. And leave the price off: we’ll wrap it, write your note, and post it straight to them.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-stationery-editorial',
  key: 'sparx-retail-stationery-editorial',
  name: 'Stationery & Paper Goods (Editorial)',
  theme: THEME,
  summary:
    'A complete, working shop for a stationery & paper-goods store: a real catalogue of hardcover and pocket notebooks, a fountain pen, bottled inks, a weekly planner and desk pad, card sets, washi tape and a gift bundle, with categories, collections, a bespoke PDP and a full merchandised home page. Editorial paper theme — warm cream ground, a confident ink-blue, a warm-red accent, a characterful Fraunces display. Shipped as Margin & Co.',
  tagline: 'A warm, working storefront for a modern paper shop.',
  vertical: 'retail',
  industry: 'Stationery & paper goods',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 88,
  brand: {
    businessName: 'Margin & Co.',
    tagline: 'Made for people who still write things down.',
  },
  chrome: { navbar: 'centerLinks', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Margin & Co. — notebooks, pens and paper goods for people who write',
      description:
        'Margin & Co. is a small paper shop for the analog habit — fountain-pen-friendly notebooks, pens worth refilling, planners you keep, and gifts for the desk. Chosen by writing in it, wrapped by hand, posted fast.',
    },
    about: {
      title: 'About Margin & Co.',
      description:
        'How Margin & Co. chooses its paper goods — by writing in everything, favouring small makers and refillable classics, and only stocking what we’d keep on our own desk.',
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
