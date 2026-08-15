// sparx-retail-plant-modern — a RETAIL/COMMERCE site template: a modern plant studio.
//
// The architectural counterpart to the warm botanical nursery (gen-retail-plant-botanical):
// a complete, working shop the moment it installs — a real catalogue of sculptural plants,
// designed planters, plant stands, a considered care kit and a plant-of-the-month, categories +
// collections, a bespoke PDP, the full 9-page commerce site (home merchandising → shop →
// collections → cart → search → journal → about → contact), dressed in an INLINE bespoke theme
// (a cool pale-stone ground + a single confident deep-green primary + a refined brass accent,
// under a crisp grotesk/humanist-sans pairing). Shipped as Frond.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme inline and
// passes it on the spec (`theme`), so the whole family can be authored in parallel without any two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-plant-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-plant-modern/**" \
//     "marketplace-catalog/_gen/gen-retail-plant-modern.ts"
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
// A modern plant studio: a cool PALE-STONE ground (near-white, barely a whisper of chroma —
// the architectural opposite of Fernwood's visibly-green sage), a single confident deep pine
// primary, a refined brass accent, under a crisp Space Grotesk display over Inter. Sharp
// corners and zero depth read as considered rather than cosy. Complete light + dark, AA on every
// role (the blueprint sweep's contrast check is the gate). `secondary` stays dark and legible on
// the light ground, and every text-carrying role clears 4.5:1.
const THEME = defineTheme({
  name: 'frond-modern',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: ['oklch(97% 0.004 130)', 'oklch(94.5% 0.006 130)', 'oklch(90% 0.008 128)', 'oklch(20% 0.014 155)'],
    roles: {
      primary: 'oklch(37% 0.085 158)',
      secondary: 'oklch(40% 0.03 160)',
      accent: 'oklch(50% 0.09 78)',
      neutral: 'oklch(24% 0.014 155)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(18% 0.012 155)', 'oklch(15% 0.012 155)', 'oklch(12% 0.012 155)', 'oklch(95% 0.006 130)'],
    roles: {
      primary: 'oklch(80% 0.12 158)',
      secondary: 'oklch(76% 0.04 160)',
      accent: 'oklch(80% 0.1 80)',
      neutral: 'oklch(30% 0.014 155)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "frond-hero": "https://images.unsplash.com/photo-1652517209166-f17a2742a5fe?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwbWluaW1hbCUyMHJvb20lMjBzaW5nbGUlMjBzY3VscHR1cmFsJTIwcGxhbnQlMjBzdG9uZXdhcmV8ZW58MHwwfHx8MTc4NjQwMzY0NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "frond-tile-plants": "https://images.unsplash.com/photo-1556747772-6e7e5bb3a60b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFsbCUyMGFyY2hpdGVjdHVyYWwlMjBwbGFudCUyMGFnYWluc3QlMjBwYWxlJTIwd2FsbHxlbnwwfDB8fHwxNzg2NDAzNjQ2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "frond-tile-planters": "https://images.unsplash.com/photo-1783000852871-6fa0af00ad4c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm93JTIwbWF0dGUlMjBkZXNpZ25lZCUyMHBsYW50ZXJzJTIwY29uY3JldGUlMjBzaGVsZnxlbnwwfDB8fHwxNzg2NDAzNjQ5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "frond-tile-stands": "https://images.unsplash.com/photo-1589988272301-a739b5380093?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhbnQlMjByYWlzZWQlMjBzbGVuZGVyJTIwd29vZGVuJTIwcGxhbnQlMjBzdGFuZHxlbnwwfDB8fHwxNzg2NDAzNjUzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "frond-tile-care": "https://images.unsplash.com/photo-1774534577685-5f522d7bd4cc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwYnJhc3MlMjBwbGFudC1jYXJlJTIwdG9vbHMlMjBsYWlkJTIwb3V0JTIwc3RvbmV8ZW58MHwwfHx8MTc4NjQwMzY1Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "frond-band-form": "https://images.unsplash.com/photo-1767125067255-a6a2cc45941f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlJTIwcGxhbnQlMjBsaXQlMjBhcyUyMHNjdWxwdHVyZSUyMGFnYWluc3QlMjBwbGFpbnxlbnwwfDB8fHwxNzg2NDAzNjYwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "frond-band-sub": "https://images.unsplash.com/photo-1700051358666-571342d57e66?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmV3bHklMjBkZWxpdmVyZWQlMjBwbGFudCUyMG1pbmltYWwlMjBwbGFudGVyJTIwYnklMjB3aW5kb3d8ZW58MHwwfHx8MTc4NjQwMzY2M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-bird-of-paradise": "https://images.unsplash.com/photo-1652712088453-970e2604c80e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFsbCUyMGJpcmQlMjBwYXJhZGlzZSUyMGJyb2FkJTIwcGFkZGxlJTIwbGVhdmVzfGVufDB8MHx8fDE3ODY0MDM2Njd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-rubber-plant": "https://images.unsplash.com/photo-1519125478587-9e2e97231d2c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cnViYmVyJTIwcGxhbnQlMjBkYXJrJTIwZ2xvc3N5JTIwYXJjaGl0ZWN0dXJhbCUyMGxlYXZlc3xlbnwwfDB8fHwxNzg2NDAzNjcwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-olive-tree": "https://images.unsplash.com/photo-1669967282206-8883f5becbf2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aW5kb29yJTIwb2xpdmUlMjB0cmVlJTIwc2lsdmVyeSUyMG5hcnJvdyUyMGxlYXZlc3xlbnwwfDB8fHwxNzg2NDAzNjczfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cacti-set": "https://images.unsplash.com/photo-1509645470620-c9c349934693?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJpbyUyMHNjdWxwdHVyYWwlMjBjYWN0aSUyMG1hdGNoaW5nJTIwcG90c3xlbnwwfDB8fHwxNzg2NDAzNjc2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-fluted-planter": "https://images.unsplash.com/photo-1556207944-1e0033a54801?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zmx1dGVkJTIwc3RvbmV3YXJlJTIwcGxhbnRlciUyMHNvZnQlMjBtYXR0ZSUyMGdsYXplfGVufDB8MHx8fDE3ODY0MDM2Nzl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-concrete-planter": "https://images.unsplash.com/photo-1633027405528-6d76279a05f9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWluaW1hbCUyMGNvbmNyZXRlJTIwY3lsaW5kZXIlMjBwbGFudGVyfGVufDB8MHx8fDE3ODY0MDM2ODN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-oak-stand": "https://images.unsplash.com/photo-1502920873987-ac48e660a95d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2xlbmRlciUyMG9hayUyMHBsYW50JTIwc3RhbmQlMjBwbGFudCUyMHRvcHxlbnwwfDB8fHwxNzg2NDAzNjg2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-tripod-stand": "https://images.unsplash.com/photo-1557090038-f0d4cd5f29f9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFsbCUyMHN0ZWVsJTIwdHJpcG9kJTIwcGxhbnQlMjBzdGFuZHxlbnwwfDB8fHwxNzg2NDAzNjg5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-care-set": "https://images.unsplash.com/photo-1784937275795-685af009b219?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJhc3MlMjBwbGFudC1jYXJlJTIwdG9vbCUyMHNldCUyMHN0b25lJTIwc3VyZmFjZXxlbnwwfDB8fHwxNzg2NDAzNjkyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subscription": "https://images.unsplash.com/photo-1483794344563-d27a8d18014e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhbnQtb2YtdGhlLW1vbnRoJTIwZGVsaXZlcnklMjBtaW5pbWFsJTIwcGxhbnRlcnxlbnwwfDB8fHwxNzg2NDAzNjk2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-form": "https://images.unsplash.com/photo-1501004318641-b39e6451bec6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlJTIwcGxhbnQlMjBwaG90b2dyYXBoZWQlMjBhcyUyMG9iamVjdCUyMGFnYWluc3QlMjBwbGFpbnxlbnwwfDB8fHwxNzg2NDAzNjk4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-pairing": "https://images.unsplash.com/photo-1592178036823-ccb0e0e67562?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhbnQlMjBtYXRjaGVkJTIwcGxhbnRlciUyMHN0eWxlZCUyMHNoZWxmfGVufDB8MHx8fDE3ODY0MDM3MDF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-slow": "https://images.unsplash.com/photo-1565625443865-2c41cdb647d2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9ybmluZyUyMGxpZ2h0JTIwbW92aW5nJTIwYWNyb3NzJTIwcGxhbnQlMjBicmlnaHQlMjByb29tfGVufDB8MHx8fDE3ODY0MDM3MDV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'frond-hero', url: src('frond-hero'), alt: 'A bright, minimal room with a single sculptural plant in a stoneware planter' },
  { id: 'frond-tile-plants', url: src('frond-tile-plants'), alt: 'A tall architectural plant against a pale wall' },
  { id: 'frond-tile-planters', url: src('frond-tile-planters'), alt: 'A row of matte designed planters on a concrete shelf' },
  { id: 'frond-tile-stands', url: src('frond-tile-stands'), alt: 'A plant raised on a slender wooden plant stand' },
  { id: 'frond-tile-care', url: src('frond-tile-care'), alt: 'A set of brass plant-care tools laid out on stone' },
  { id: 'frond-band-form', url: src('frond-band-form'), alt: 'A single plant lit as a sculpture against a plain background' },
  { id: 'frond-band-sub', url: src('frond-band-sub'), alt: 'A newly delivered plant in a minimal planter by a window' },
  { id: 'prod-bird-of-paradise', url: src('prod-bird-of-paradise'), alt: 'A tall bird of paradise with broad paddle leaves' },
  { id: 'prod-rubber-plant', url: src('prod-rubber-plant'), alt: 'A rubber plant with dark glossy architectural leaves' },
  { id: 'prod-olive-tree', url: src('prod-olive-tree'), alt: 'An indoor olive tree with silvery narrow leaves' },
  { id: 'prod-cacti-set', url: src('prod-cacti-set'), alt: 'A trio of sculptural cacti in matching pots' },
  { id: 'prod-fluted-planter', url: src('prod-fluted-planter'), alt: 'A fluted stoneware planter in a soft matte glaze' },
  { id: 'prod-concrete-planter', url: src('prod-concrete-planter'), alt: 'A minimal concrete cylinder planter' },
  { id: 'prod-oak-stand', url: src('prod-oak-stand'), alt: 'A slender oak plant stand with a plant on top' },
  { id: 'prod-tripod-stand', url: src('prod-tripod-stand'), alt: 'A tall steel tripod plant stand' },
  { id: 'prod-care-set', url: src('prod-care-set'), alt: 'A brass plant-care tool set on a stone surface' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A plant-of-the-month delivery in a minimal planter' },
  { id: 'post-form', url: src('post-form'), alt: 'A single plant photographed as an object against a plain wall' },
  { id: 'post-pairing', url: src('post-pairing'), alt: 'A plant and a matched planter styled on a shelf' },
  { id: 'post-slow', url: src('post-slow'), alt: 'Morning light moving across a plant in a bright room' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-plant-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one airy photograph, a grotesk headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('frond-hero'), alt: 'A minimal room with a single sculptural plant', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'A plant is a piece of the room.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Frond is a plant studio for people who care how a space is put together. We choose plants for their form, pair each one with a planter and a stand that belong to it, and ship the whole object ready to place — so the greenery reads as design, not decoration.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the studio' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop/subscription' },
                      text: 'Plant of the month',
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
            text: 'Shop by piece',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'frond-tile-plants', label: 'Plants', href: '/shop', alt: 'A tall architectural plant against a pale wall' }),
              categoryTile({ assetId: 'frond-tile-planters', label: 'Planters', href: '/shop', alt: 'Matte designed planters on a concrete shelf' }),
              categoryTile({ assetId: 'frond-tile-stands', label: 'Stands', href: '/shop', alt: 'A plant raised on a slender wooden stand' }),
              categoryTile({ assetId: 'frond-tile-care', label: 'Care', href: '/shop', alt: 'Brass plant-care tools laid out on stone' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New in the studio' }),
  editorialBand({
    heading: 'Chosen for their form',
    lead: 'We don’t stock everything green. Each plant earns its place on line, silhouette and how it holds a room — the paddle of a bird of paradise, the spare geometry of a cactus, the weight of a rubber plant’s leaf. Fewer plants, chosen the way you’d choose a chair.',
    assetId: 'frond-band-form',
    cta: 'How we choose plants',
    href: '/blog/choosing-a-plant-for-its-form',
    alt: 'A single plant lit as a sculpture',
  }),
  productsBlock({ source: 'commerce.category.plants', layout: 'carousel', heading: 'The plants' }),
  productsBlock({ source: 'commerce.category.planters', layout: 'carousel', heading: 'Planters & stands' }),
  editorialBand({
    heading: 'One plant, every month',
    lead: 'Plant of the month is the slow way to build a considered collection: tell us your light and your space, and a curated plant — matched to a planter that suits it — arrives on your schedule. Skip, swap or cancel any time; no lock-in, ever.',
    assetId: 'frond-band-sub',
    cta: 'Start plant of the month',
    href: '/shop/subscription',
    alt: 'A newly delivered plant in a minimal planter by a window',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static styling note, and policy links). */
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
                    text: 'Frond',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Delivered ready to place' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Choose a size and, if you like, the planter it was styled with — it arrives potted, checked by hand and packed to travel, with a single card on light, water and where it looks best. Give it a week to settle into its spot before you judge it.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Style it with' });

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
    'The studio',
    'Everything we’re carrying right now — sculptural plants, the planters and stands that finish them, and a short, considered care kit. Filter by piece or by size; each plant ships potted, checked by hand, with a single plain card on light and water.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The studio grouped the way people actually shop — what’s new in, the sculptural statement plants, planters and stands, the low-effort pieces, and pairings we’d put together ourselves.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Frond', 'Looking for a particular plant, a planter size, or a styling note? Search the whole studio and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping over $75, and every plant travels braced and cushioned with a care card inside. If a piece arrives less than perfect, send a photo within a week and we’ll put it right — a plant should settle a room, not stress you out.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Frond journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the studio — choosing a plant for its form, pairing it with the right planter, and the small habits that keep a considered space alive. Design-minded, plainly written.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Frond' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Frond began with a simple frustration: plants are sold like produce and styled like an afterthought, when the good ones are as considered as any object you’d bring into a room. So we built a studio that treats a plant, its planter and its stand as one composed piece — chosen together, shipped together, placed together.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We keep the range deliberately short. Every plant is grown on and acclimatised rather than drop-shipped, every planter is made in small runs by people we can name, and nothing goes on the shelf unless it earns its place on form and holds up in a real home. We would rather carry twenty pieces we’d live with than two hundred we wouldn’t.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No plastic nursery pots as the finished look, no impossible-to-keep rarities sold on hype, no jargon. Just plants chosen as objects, matched to your light and your space, with the plain guidance to keep them looking the way they did the day they arrived.',
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
    intro: 'Styling a corner and not sure what fits, planning plants for an office or a project, or want a piece you can’t see here? Send a photo of the space and a note — a real person at the studio will help you compose it.',
    submitLabel: 'Email the studio',
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

// A live plant is naturally two-axis: how big a specimen you start with (size), and whether it
// arrives in the plain nursery pot or already styled into one of our stoneware planters. So every
// plant carries `Size` × `Planter` — six real variants, priced by size + the planter upgrade.
const SIZE: OptionDecl = {
  name: 'Size',
  displayType: 'dropdown',
  values: [{ value: 'Petite · 4in' }, { value: 'Mid · 8in' }, { value: 'Statement · 12in' }],
};
const PLANTER: OptionDecl = {
  name: 'Planter',
  displayType: 'dropdown',
  values: [{ value: 'Nursery pot' }, { value: 'Styled in stoneware' }],
};

const SIZE_STEPS = [
  { code: 'S', value: 'Petite · 4in', add: 0 },
  { code: 'M', value: 'Mid · 8in', add: 22 },
  { code: 'L', value: 'Statement · 12in', add: 58 },
] as const;
const PLANTER_STEPS = [
  { code: 'NP', value: 'Nursery pot', add: 0 },
  { code: 'ST', value: 'Styled in stoneware', add: 28 },
] as const;

const plant = (opts: {
  handle: string;
  title: string;
  description: string;
  price: number;
  sku: string;
  categories: string[];
  collections: string[];
  tags: string[];
  asset: string;
  seoTitle: string;
  seoDescription: string;
}): Product => {
  const variants: Variant[] = [];
  for (const size of SIZE_STEPS) {
    for (const pot of PLANTER_STEPS) {
      const isDefault = size.code === 'M' && pot.code === 'NP';
      variants.push({
        sku: `${opts.sku}-${size.code}-${pot.code}`,
        priceCents: money(opts.price + size.add + pot.add),
        inventoryPolicy: 'continue',
        ...(isDefault ? { isDefault: true } : {}),
        optionValues: { Size: size.value, Planter: pot.value },
      });
    }
  }
  return {
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: 'Houseplant',
    vendor: 'Frond',
    tags: opts.tags,
    categoryHandles: opts.categories,
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    options: [SIZE, PLANTER],
    variants,
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
  };
};

const PRODUCTS: Product[] = [
  plant({
    handle: 'bird-of-paradise',
    title: 'Bird of Paradise',
    description:
      'The room-defining one. Broad, paddle-shaped leaves on tall, clean stems that fan out into a living sculpture — architecture you can stand in a corner. Wants the light to earn those leaves. Form: upright, fanning. Light: bright, some direct sun. Water when the top two inches are dry.',
    price: 68,
    sku: 'FROND-BOP',
    categories: ['plants'],
    collections: ['new-in', 'sculptural', 'gifting'],
    tags: ['statement', 'floor-plant', 'bright-light', 'sculptural'],
    asset: 'prod-bird-of-paradise',
    seoTitle: 'Bird of Paradise — sculptural floor plant | Frond',
    seoDescription: 'A tall, fanning bird of paradise — architecture for a corner. Bright light; water when the top two inches are dry.',
  }),
  plant({
    handle: 'rubber-plant',
    title: 'Rubber Plant',
    description:
      'Dark, glossy, near-black leaves with real weight to them — a plant that reads as a solid form rather than a spray of foliage. Low fuss for how good it looks, and it takes an upright shape you can lightly train. Form: upright, broad-leaved. Light: bright, indirect. Water when the top inch is dry.',
    price: 42,
    sku: 'FROND-RUBBER',
    categories: ['plants'],
    collections: ['sculptural', 'low-effort', 'essentials'],
    tags: ['statement', 'easy', 'bright-light', 'sculptural'],
    asset: 'prod-rubber-plant',
    seoTitle: 'Rubber Plant (Ficus elastica) — architectural houseplant | Frond',
    seoDescription: 'A dark, glossy, low-fuss rubber plant with real presence. Bright indirect light; water when the top inch is dry.',
  }),
  plant({
    handle: 'olive-tree',
    title: 'Indoor Olive Tree',
    description:
      'Silvery, narrow leaves on slender grey stems — Mediterranean light in plant form, and one of the few trees that reads as calm rather than heavy indoors. Wants the brightest spot you have. Form: airy, tree-like. Light: as bright as you can give it, direct sun welcome. Water when the top two inches are dry.',
    price: 74,
    sku: 'FROND-OLIVE',
    categories: ['plants'],
    collections: ['new-in', 'sculptural'],
    tags: ['statement', 'tree', 'bright-light', 'sculptural'],
    asset: 'prod-olive-tree',
    seoTitle: 'Indoor Olive Tree — silvery statement tree | Frond',
    seoDescription: 'A slender indoor olive tree with silvery leaves — bright, calm and sculptural. Give it the brightest spot you have.',
  }),
  plant({
    handle: 'cacti-set',
    title: 'Sculptural Cacti Set',
    description:
      'Three cacti chosen as a composition — different heights and geometries that stand together like a small still life, and ask for almost nothing in return. The lowest-effort way to add hard, modern line to a shelf or sill. Form: geometric, upright. Light: bright, direct sun. Water sparingly, only when bone dry.',
    price: 38,
    sku: 'FROND-CACTI',
    categories: ['plants'],
    collections: ['sculptural', 'low-effort', 'gifting'],
    tags: ['easy', 'bright-light', 'drought-tolerant', 'sculptural'],
    asset: 'prod-cacti-set',
    seoTitle: 'Sculptural Cacti Set — a trio of architectural cacti | Frond',
    seoDescription: 'Three cacti composed as a set — hard modern line for a shelf, and near-indestructible. Bright direct light; water sparingly.',
  }),
  {
    handle: 'fluted-stoneware-planter',
    title: 'Fluted Stoneware Planter',
    description:
      'A hand-finished stoneware planter with a fine fluted rib and a soft matte glaze that shifts with the light. Thrown in small runs, so no two are identical, and weighted to hold a top-heavy plant steady. Drainage hole and a matching saucer; a nursery pot drops straight inside.',
    status: 'active',
    productType: 'Planter',
    vendor: 'Frond',
    tags: ['planters', 'stoneware', 'ceramics'],
    categoryHandles: ['planters'],
    collectionHandles: ['new-in', 'planters-stands', 'essentials'],
    seoTitle: 'Fluted Stoneware Planter — matte, with saucer | Frond',
    seoDescription: 'A hand-finished fluted stoneware planter in a soft matte glaze, made in small runs, with drainage and a saucer.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: 'Petite · 4in' }, { value: 'Mid · 8in' }, { value: 'Statement · 12in' }] },
    ],
    variants: [
      { sku: 'FROND-PLANT-FLUTED-S', priceCents: money(34), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Petite · 4in' } },
      { sku: 'FROND-PLANT-FLUTED-M', priceCents: money(52), inventoryPolicy: 'continue', optionValues: { Size: 'Mid · 8in' } },
      { sku: 'FROND-PLANT-FLUTED-L', priceCents: money(78), inventoryPolicy: 'continue', optionValues: { Size: 'Statement · 12in' } },
    ],
    images: [{ assetId: 'prod-fluted-planter', isPrimary: true, alt: 'A fluted stoneware planter' }],
  },
  {
    handle: 'concrete-cylinder-planter',
    title: 'Concrete Cylinder Planter',
    description:
      'A plain cast-concrete cylinder — no glaze, no pattern, just weight, texture and a clean edge. It grounds a light, airy plant and looks as good empty as full. Sealed inside against moisture, with a cork base that won’t mark a floor, and a nursery pot sits neatly within.',
    status: 'active',
    productType: 'Planter',
    vendor: 'Frond',
    tags: ['planters', 'concrete', 'minimal'],
    categoryHandles: ['planters'],
    collectionHandles: ['planters-stands', 'low-effort', 'essentials'],
    seoTitle: 'Concrete Cylinder Planter — cast, minimal | Frond',
    seoDescription: 'A plain cast-concrete cylinder planter — weight, texture and a clean edge, sealed inside with a cork base.',
    options: [
      { name: 'Size', displayType: 'dropdown', values: [{ value: 'Mid · 8in' }, { value: 'Statement · 12in' }] },
    ],
    variants: [
      { sku: 'FROND-PLANT-CONCRETE-M', priceCents: money(46), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Mid · 8in' } },
      { sku: 'FROND-PLANT-CONCRETE-L', priceCents: money(72), inventoryPolicy: 'continue', optionValues: { Size: 'Statement · 12in' } },
    ],
    images: [{ assetId: 'prod-concrete-planter', isPrimary: true, alt: 'A concrete cylinder planter' }],
  },
  {
    handle: 'oak-plant-stand',
    title: 'Oak Plant Stand',
    description:
      'A slender solid-oak stand that lifts a plant off the floor and into the light, and turns a pot into a small piece of furniture. Three tapered legs, a turned collar to seat the planter, and an oiled finish that warms with age. Sized to cradle a mid or statement planter.',
    status: 'active',
    productType: 'Plant stand',
    vendor: 'Frond',
    tags: ['stands', 'oak', 'furniture'],
    categoryHandles: ['stands'],
    collectionHandles: ['planters-stands', 'gifting'],
    seoTitle: 'Oak Plant Stand — solid oak, three-leg | Frond',
    seoDescription: 'A slender solid-oak plant stand that lifts a plant into the light — three tapered legs, oiled finish, turned collar.',
    options: [
      { name: 'Height', displayType: 'dropdown', values: [{ value: 'Low · 12in' }, { value: 'Tall · 20in' }] },
    ],
    variants: [
      { sku: 'FROND-STAND-OAK-LO', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue', optionValues: { Height: 'Low · 12in' } },
      { sku: 'FROND-STAND-OAK-HI', priceCents: money(78), inventoryPolicy: 'continue', optionValues: { Height: 'Tall · 20in' } },
    ],
    images: [{ assetId: 'prod-oak-stand', isPrimary: true, alt: 'An oak plant stand' }],
  },
  {
    handle: 'steel-tripod-stand',
    title: 'Steel Tripod Stand',
    description:
      'Powder-coated steel drawn to the thinnest line that will still carry the weight — a tall tripod that raises a statement plant to eye level and almost disappears under it. Matte black, with capped feet, and a ring collar that holds a large planter dead level. The industrial counterpoint to the oak.',
    status: 'active',
    productType: 'Plant stand',
    vendor: 'Frond',
    tags: ['stands', 'steel', 'minimal'],
    categoryHandles: ['stands'],
    collectionHandles: ['planters-stands'],
    seoTitle: 'Steel Tripod Stand — matte black, tall | Frond',
    seoDescription: 'A tall powder-coated steel tripod stand that raises a statement plant to eye level and nearly disappears under it.',
    variants: [{ sku: 'FROND-STAND-STEEL', priceCents: money(64), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-tripod-stand', isPrimary: true, alt: 'A steel tripod plant stand' }],
  },
  {
    handle: 'brass-care-set',
    title: 'Brass Care Tool Set',
    description:
      'The short kit that keeps a considered plant looking considered — solid-brass snips, a fine-mist brass sprayer, and a slim soil probe that ends the “does it need water?” guessing. Objects worth leaving on the shelf, not hiding in a drawer, and they patina beautifully with use. Comes with a one-card routine.',
    status: 'active',
    productType: 'Care',
    vendor: 'Frond',
    tags: ['care', 'tools', 'brass', 'gift'],
    categoryHandles: ['care'],
    collectionHandles: ['essentials', 'gifting'],
    seoTitle: 'Brass Care Tool Set — snips, mister & soil probe | Frond',
    seoDescription: 'A short brass plant-care set — snips, a fine-mist sprayer and a soil probe. Objects worth leaving on the shelf.',
    variants: [{ sku: 'FROND-CARE-SET', priceCents: money(48), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-care-set', isPrimary: true, alt: 'A brass plant-care tool set' }],
  },
  {
    handle: 'subscription',
    title: 'Plant of the Month',
    description:
      'One curated plant on your schedule, chosen to match the light you tell us about and to build a collection that actually reads as one. Tell us your space, pick a plant on its own or already styled in a planter, and skip, swap or pause any time. The slow, deliberate way to green a home. Light: your choice — we match to it.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Frond',
    tags: ['subscription', 'gift'],
    categoryHandles: ['plants'],
    collectionHandles: ['new-in', 'gifting'],
    seoTitle: 'Plant of the Month — a curated plant, matched to your light | Frond',
    seoDescription: 'A flexible plant-of-the-month, each plant matched to your light and styled to build one collection. Skip, swap or pause any time.',
    options: [
      { name: 'Plan', displayType: 'dropdown', values: [{ value: 'Plant only' }, { value: 'Plant + planter' }] },
    ],
    variants: [
      { sku: 'FROND-SUB-P', priceCents: money(45), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: 'Plant only' } },
      { sku: 'FROND-SUB-PP', priceCents: money(78), inventoryPolicy: 'continue', optionValues: { Plan: 'Plant + planter' } },
    ],
    images: [{ assetId: 'prod-subscription', isPrimary: true, alt: 'A plant-of-the-month delivery' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'plants', name: 'Plants', description: 'Sculptural plants chosen for their form.', featured: true },
    { handle: 'planters', name: 'Planters', description: 'Stoneware and concrete, made in small runs.', featured: true },
    { handle: 'stands', name: 'Stands', description: 'Oak and steel that lift a plant into the light.', featured: true },
    { handle: 'care', name: 'Care', description: 'A short, considered care kit.', featured: true },
  ],
  collections: [
    {
      handle: 'new-in',
      name: 'New in',
      description: 'The latest pieces in the studio.',
      type: 'manual',
      featured: true,
      productHandles: ['bird-of-paradise', 'olive-tree', 'fluted-stoneware-planter', 'subscription'],
    },
    {
      handle: 'sculptural',
      name: 'Sculptural plants',
      description: 'Plants that hold a room on form alone.',
      type: 'manual',
      featured: true,
      productHandles: ['bird-of-paradise', 'rubber-plant', 'olive-tree', 'cacti-set'],
    },
    {
      handle: 'planters-stands',
      name: 'Planters & stands',
      description: 'What finishes the plant.',
      type: 'manual',
      featured: true,
      productHandles: ['fluted-stoneware-planter', 'concrete-cylinder-planter', 'oak-plant-stand', 'steel-tripod-stand'],
    },
    {
      handle: 'low-effort',
      name: 'Low effort',
      description: 'Design-forward, forgiving to keep.',
      type: 'manual',
      featured: false,
      productHandles: ['rubber-plant', 'cacti-set', 'concrete-cylinder-planter'],
    },
    {
      handle: 'essentials',
      name: 'The essentials',
      description: 'A first plant, a planter, a care kit.',
      type: 'manual',
      featured: false,
      productHandles: ['rubber-plant', 'fluted-stoneware-planter', 'concrete-cylinder-planter', 'brass-care-set'],
    },
    {
      handle: 'gifting',
      name: 'Gifting',
      description: 'Composed pieces that make a good gift.',
      type: 'manual',
      featured: false,
      productHandles: ['cacti-set', 'brass-care-set', 'oak-plant-stand', 'subscription'],
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
    slug: 'choosing-a-plant-for-its-form',
    status: 'published',
    body: {
      title: 'Choosing a plant for its form',
      excerpt: 'Buy the silhouette, not the label. How to pick a plant the way you’d pick any other object in the room.',
      featuredImage: { $asset: 'post-form' },
      body: {
        type: 'doc',
        content: [
          para('Most plant advice starts with care and ends with a shopping list. We’d start somewhere else: with the shape. A plant is one of the largest objects you’ll add to a room, and long before it needs watering it’s doing a job of line, mass and negative space — the same job as a lamp or a chair. Choose that first, and the rest follows.'),
          h2('Line, mass, and the gap around it'),
          para('Think in three moves. Line is the plant’s gesture — the tall fan of a bird of paradise, the airy spread of an olive, the hard verticals of a cactus. Mass is its weight: a rubber plant reads as a solid dark form, where a fern reads as a haze. And negative space is what the plant does to the air around it — a sculptural plant needs room to be seen, so an empty corner is a feature, not a waste. Decide which of the three your space is short on, and buy for that.'),
          h2('Then, and only then, the care'),
          para('Form gets you a plant you want to look at; care keeps it that way. Once you’ve chosen the silhouette, check that its light matches your spot — every listing here states it plainly — and you’ve got a piece that earns its place and holds it. Beauty first, keepability confirmed second. That order is the whole trick.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'pairing-a-plant-with-its-planter',
    status: 'published',
    body: {
      title: 'Pairing a plant with its planter',
      excerpt: 'The planter is half the object. A short guide to matching pot to plant so the two read as one piece.',
      featuredImage: { $asset: 'post-pairing' },
      body: {
        type: 'doc',
        content: [
          para('A beautiful plant in the wrong pot is a beautiful plant you don’t quite notice. The planter isn’t packaging — it’s the base of the sculpture, and getting the pairing right is what turns a plant into a composed object. It’s less complicated than it sounds; it comes down to weight, texture and proportion.'),
          h2('Match the weight, contrast the texture'),
          para('Heavy plants want heavy planters: a top-heavy bird of paradise looks unstable in a light pot and settled in a weighted stoneware one. Then play texture against the plant, not with it — a glossy rubber plant sharpens against matte concrete, an airy olive softens in a fluted glaze. Same-and-same reads flat; a considered contrast reads intentional.'),
          h2('Get the proportion right'),
          para('As a rule the planter should be roughly a third of the total height and a touch wider than the plant’s base — enough visual base to look grounded, not so much it swallows the stem. When in doubt, size up the plant before you size up the pot. And if you’d rather not think about any of it, the “styled in stoneware” option on every plant is simply us having made the call for you.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'a-low-maintenance-routine',
    status: 'published',
    body: {
      title: 'A low-maintenance routine for a considered space',
      excerpt: 'Good plants don’t need fussing — they need a light touch, on a rhythm. The whole routine, in five minutes a week.',
      featuredImage: { $asset: 'post-slow' },
      body: {
        type: 'doc',
        content: [
          para('The plants we carry are chosen partly because they’re forgiving, and forgiving plants punish over-attention far more than benign neglect. So the routine here isn’t a chore chart — it’s a light, regular pass that keeps a space looking composed without turning it into a hobby you didn’t ask for.'),
          h2('Once a week, five minutes'),
          para('Check the soil before you reach for the watering can: a finger an inch or two in tells you more than any schedule, and if it’s still damp, walk away. Water only the ones that are dry, and water them properly — through, until it drains. Then wipe the dust off a couple of broad leaves so they can actually catch the light, and turn each plant a quarter so it grows evenly toward the window rather than leaning. That’s the whole of it.'),
          h2('Once a season, step back'),
          para('Every few months, do the slower pass: trim anything tired, top up or refresh the surface soil, feed lightly through the growing months, and — the part people skip — genuinely look at the arrangement. A plant that’s outgrown its spot or drifted out of balance with the room is worth moving. A considered space isn’t set once; it’s nudged, gently, as the plants grow into it.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-plant-modern',
  key: 'sparx-retail-plant-modern',
  name: 'Plant Studio (Modern)',
  theme: THEME,
  summary:
    'A complete, working shop for a modern plant studio: a real catalogue of sculptural plants, designed stoneware and concrete planters, oak and steel stands, a considered brass care kit and a plant-of-the-month, with categories, collections, a bespoke PDP and a merchandised home page. Architectural theme — a cool pale-stone ground, a single confident deep-green primary, a refined brass accent, and a crisp grotesk voice. Shipped as Frond.',
  tagline: 'A clean, working storefront for a modern plant studio.',
  vertical: 'retail',
  industry: 'Plant studio',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 86,
  brand: {
    businessName: 'Frond',
    tagline: 'A plant is a piece of the room.',
  },
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Frond — sculptural plants, planters & stands for considered spaces',
      description:
        'Frond is a modern plant studio — sculptural plants chosen for their form, paired with designed planters and stands, and shipped ready to place. Greenery as design, not decoration.',
    },
    about: {
      title: 'About Frond',
      description:
        'How Frond chooses, pairs and ships plants — a short, considered range of sculptural plants, small-run planters and stands, treated as one composed object.',
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
