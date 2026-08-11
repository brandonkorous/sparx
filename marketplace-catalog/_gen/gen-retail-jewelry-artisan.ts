// sparx-retail-jewelry-artisan — a RETAIL/COMMERCE site template: a handmade / artisan jeweler.
//
// A complete, working shop the moment it installs — a real catalogue of hand-forged pieces
// in sterling silver and bronze (hammered hoops, a raw-stone ring, a hand-stamped cuff, a
// mixed-metal pendant, pebble studs, a forged chain bracelet, a carved signet and a raw
// birthstone pendant), categories + collections, a bespoke jewelry PDP and a full
// merchandised home page. Dressed in an INLINE bespoke theme — a warm clay/oat paper
// ground, a bark-dark ink, a deep oxidised-bronze primary and a fired-copper accent, under
// a characterful Fraunces serif over warm humanist Karla. Shipped as Forge & Fold — the
// earthy, at-the-bench counterpart to the polished fine-jewelry Aurelia.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries its
// OWN theme inline and passes it on the spec (`theme`), so the whole family can be authored
// in parallel without any two generators contending on a shared `*-themes.ts` registry.
// The shared `template-sites/harness.ts` uses `spec.theme` verbatim.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-jewelry-artisan.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-jewelry-artisan/**" \
//     "marketplace-catalog/_gen/gen-retail-jewelry-artisan.ts"
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
// A maker's bench: a warm clay/oat paper ground (visibly warmer and higher-chroma than
// Aurelia's near-achromatic bone), a bark-dark warm ink, a deep OXIDISED-BRONZE primary —
// the confident action reads like patinated metal, not printed black — and a fired-COPPER
// accent kept legible enough to carry links (≤50% L on the oat ground). A characterful
// Fraunces serif over warm humanist Karla. Complete light + dark; the dark mode is a forge
// at dusk — warm charcoal with the bronze and copper turned bright — and the blueprint
// sweep's contrast check is the gate.
const THEME = defineTheme({
  name: 'forge-hand',
  type: { body: face('Karla', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.75rem', field: '0.5rem', box: '0.875rem', depth: '0' },
  light: {
    surfaces: ['oklch(95% 0.021 74)', 'oklch(92% 0.028 70)', 'oklch(87% 0.036 66)', 'oklch(24% 0.03 55)'],
    roles: {
      primary: 'oklch(41% 0.07 52)',
      secondary: 'oklch(44% 0.045 58)',
      accent: 'oklch(52% 0.14 46)',
      neutral: 'oklch(27% 0.03 52)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(20% 0.022 52)', 'oklch(17% 0.022 52)', 'oklch(14% 0.022 52)', 'oklch(94% 0.02 74)'],
    roles: {
      primary: 'oklch(76% 0.09 62)',
      secondary: 'oklch(77% 0.05 60)',
      accent: 'oklch(74% 0.14 46)',
      neutral: 'oklch(31% 0.022 52)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "forge-hero": "https://images.unsplash.com/photo-1624588057318-5f1b2eb81012?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8amV3ZWxlciUyMHMlMjBoYW5kcyUyMGhhbW1lcmluZyUyMHNpbHZlciUyMGJhbmQlMjBzdGVlbHxlbnwwfDB8fHwxNzg2NDA0ODQ1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-tile-rings": "https://images.unsplash.com/photo-1636493222937-5169284ed417?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZC1mb3JnZWQlMjByYXctc3RvbmUlMjByaW5nJTIwcmVzdGluZyUyMHdlYXRoZXJlZCUyMHdvb2R8ZW58MHwwfHx8MTc4NjQwNDg0OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-tile-earrings": "https://images.unsplash.com/photo-1599081753523-a20f731f42c9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFtbWVyZWQlMjBzaWx2ZXIlMjBob29wfGVufDB8MHx8fDE3ODY0MDUxNTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-tile-necklaces": "https://images.unsplash.com/photo-1564842505181-8862a3b9b173?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWl4ZWQtbWV0YWwlMjBwZW5kYW50JTIwbHlpbmclMjBsZWF0aGVyJTIwYmVuY2glMjBtYXR8ZW58MHwwfHx8MTc4NjQwNDg1NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-tile-cuffs": "https://images.unsplash.com/photo-1602751584581-2e0372975b46?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZC1zdGFtcGVkJTIwYnJvbnplJTIwY3VmZnxlbnwwfDB8fHwxNzg2NDA1MTYwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-band-bench": "https://images.unsplash.com/photo-1685022515813-c42e8348639b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFrZXIlMjBiZW5jaCUyMGZpbGluZyUyMHBpZWNlJTIwdW5kZXIlMjB3b3JrJTIwbGFtcHxlbnwwfDB8fHwxNzg2NDA0ODYwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-band-story": "https://images.unsplash.com/photo-1575839127405-acda7759a2e8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmF3JTIwbWV0YWwlMjBvZmZjdXRzJTIwaGFtbWVyJTIwc3RhbXBzJTIwbGFpZCUyMG91dHxlbnwwfDB8fHwxNzg2NDA0ODYyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-prod-hoops": "https://images.unsplash.com/photo-1684616289742-2e48aff416bf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFtbWVyZWQlMjBzaWx2ZXIlMjBob29wJTIwZWFycmluZ3MlMjBjYXRjaGluZyUyMGxpZ2h0fGVufDB8MHx8fDE3ODY0MDQ4NjZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-prod-studs": "https://images.unsplash.com/photo-1727990864585-e2aee3197eeb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpciUyMHRleHR1cmVkJTIwcGViYmxlJTIwc3R1ZCUyMGVhcnJpbmdzfGVufDB8MHx8fDE3ODY0MDQ4Njl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-prod-rawstone": "https://images.unsplash.com/photo-1717867191656-6f063593c23b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm91Z2gtY3V0JTIwc3RvbmUlMjBzZXQlMjBoYW5kLWJ1aWx0JTIwc2lsdmVyJTIwYmV6ZWwlMjByaW5nfGVufDB8MHx8fDE3ODY0MDQ4NzJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-prod-signet": "https://images.unsplash.com/photo-1630524250640-97602e7324cc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZC1jYXJ2ZWQlMjBzaWduZXQlMjByaW5nJTIwdGV4dHVyZWQlMjBmYWNlfGVufDB8MHx8fDE3ODY0MDQ4NzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-prod-pendant": "https://images.unsplash.com/photo-1749475469147-64c905baae9f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWl4ZWQtbWV0YWwlMjBwZW5kYW50JTIwc2lsdmVyJTIwYnJvbnplJTIwY2hhaW58ZW58MHwwfHx8MTc4NjQwNDg3OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-prod-birthstone": "https://images.unsplash.com/photo-1726136947386-17d7b718aef0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmF3JTIwYmlydGhzdG9uZSUyMHJ1c3RpY3xlbnwwfDB8fHwxNzg2NDA1MTYzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-prod-cuff": "https://images.unsplash.com/photo-1616662178746-6642ccb4f01e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8aGFuZC1zdGFtcGVkJTIwb3BlbiUyMGN1ZmYlMjBicmFjZWxldCUyMGJyb256ZXxlbnwwfDB8fHwxNzg2NDA0ODgzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-prod-chain": "https://images.unsplash.com/photo-1605884878538-6468614df578?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZC1mb3JnZWQlMjBjaHVua3klMjBjaGFpbiUyMGJyYWNlbGV0JTIwc2lsdmVyfGVufDB8MHx8fDE3ODY0MDQ4ODd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-post-bench": "https://images.unsplash.com/photo-1586789509531-c7886b9d9023?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2lsdmVyJTIwYmFuZCUyMGJlaW5nJTIwc2hhcGVkJTIwbWFuZHJlbCUyMG1hbGxldHxlbnwwfDB8fHwxNzg2NDA0ODg5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-post-metals": "https://images.unsplash.com/photo-1567937926466-054ccbe7cc19?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8c3RlcmxpbmclMjBzaWx2ZXIlMjBicm9uemUlMjBwaWVjZXMlMjBsYWlkJTIwc2lkZSUyMGJ5fGVufDB8MHx8fDE3ODY0MDQ4OTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forge-post-care": "https://images.unsplash.com/photo-1636286484290-cfde2456af97?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xvdGglMjBzbWFsbCUyMGJydXNoJTIwYmVzaWRlJTIwb3hpZGlzZWQlMjBzaWx2ZXIlMjByaW5nfGVufDB8MHx8fDE3ODY0MDQ4OTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'forge-hero', url: src('forge-hero'), alt: 'A jeweler’s hands hammering a silver band on a steel bench block' },
  { id: 'forge-tile-rings', url: src('forge-tile-rings'), alt: 'A hand-forged raw-stone ring resting on weathered wood' },
  { id: 'forge-tile-earrings', url: src('forge-tile-earrings'), alt: 'A pair of hammered silver hoop earrings on linen' },
  { id: 'forge-tile-necklaces', url: src('forge-tile-necklaces'), alt: 'A mixed-metal pendant lying on a leather bench mat' },
  { id: 'forge-tile-cuffs', url: src('forge-tile-cuffs'), alt: 'A hand-stamped bronze cuff bracelet on a stone slab' },
  { id: 'forge-band-bench', url: src('forge-band-bench'), alt: 'A maker at the bench filing a piece under a work lamp' },
  { id: 'forge-band-story', url: src('forge-band-story'), alt: 'Raw metal offcuts, a hammer and stamps laid out on a workbench' },
  { id: 'forge-prod-hoops', url: src('forge-prod-hoops'), alt: 'Hammered silver hoop earrings catching the light' },
  { id: 'forge-prod-studs', url: src('forge-prod-studs'), alt: 'A pair of textured pebble stud earrings' },
  { id: 'forge-prod-rawstone', url: src('forge-prod-rawstone'), alt: 'A rough-cut stone set in a hand-built silver bezel ring' },
  { id: 'forge-prod-signet', url: src('forge-prod-signet'), alt: 'A hand-carved signet ring with a textured face' },
  { id: 'forge-prod-pendant', url: src('forge-prod-pendant'), alt: 'A mixed-metal pendant of silver and bronze on a chain' },
  { id: 'forge-prod-birthstone', url: src('forge-prod-birthstone'), alt: 'A raw birthstone set in a rustic silver bezel pendant' },
  { id: 'forge-prod-cuff', url: src('forge-prod-cuff'), alt: 'A hand-stamped open cuff bracelet in bronze' },
  { id: 'forge-prod-chain', url: src('forge-prod-chain'), alt: 'A hand-forged chunky chain bracelet in silver' },
  { id: 'forge-post-bench', url: src('forge-post-bench'), alt: 'A silver band being shaped on a mandrel with a mallet' },
  { id: 'forge-post-metals', url: src('forge-post-metals'), alt: 'Sterling silver and bronze pieces laid side by side' },
  { id: 'forge-post-care', url: src('forge-post-care'), alt: 'A cloth and a small brush beside an oxidised silver ring' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-jewelry-artisan: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one workshop photograph, a serif headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the
 *  photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('forge-hero'), alt: 'Hands hammering a silver band at the bench', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Made at the bench, one at a time.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Forge & Fold is a one-person jewelry workshop. Every piece is hammered, stamped and set by hand in recycled sterling silver and bronze — so no two are ever exactly alike, and yours carries the marks of the hands that made it.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the bench' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/collections' },
                      text: 'Browse collections',
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
              categoryTile({ assetId: 'forge-tile-rings', label: 'Rings', href: '/shop', alt: 'A hand-forged raw-stone ring' }),
              categoryTile({ assetId: 'forge-tile-earrings', label: 'Earrings', href: '/shop', alt: 'Hammered silver hoop earrings' }),
              categoryTile({ assetId: 'forge-tile-necklaces', label: 'Necklaces', href: '/shop', alt: 'A mixed-metal pendant on a chain' }),
              categoryTile({ assetId: 'forge-tile-cuffs', label: 'Cuffs', href: '/shop', alt: 'A hand-stamped bronze cuff' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Fresh off the bench' }),
  editorialBand({
    heading: 'Every mark left on purpose',
    lead: 'Nothing here is cast in a hundred at a time. Each piece is forged, hammered and stamped by hand, then oxidised and finished at the bench — the little irregularities are the point, not a flaw. When you wear one, you can see where the hammer landed.',
    assetId: 'forge-band-bench',
    cta: 'How it’s made',
    href: '/blog/made-at-the-bench',
    alt: 'A maker filing a piece at the bench under a work lamp',
  }),
  productsBlock({ source: 'commerce.category.rings', layout: 'carousel', heading: 'The ring bench' }),
  editorialBand({
    heading: 'No two the same',
    lead: 'Because every piece is made by hand from raw metal — and set with rough-cut, one-of-a-kind stones — the one you order is genuinely yours. Solid recycled silver and bronze, built to be worn hard, patina and all, and repaired at the bench for as long as you own it.',
    assetId: 'forge-band-story',
    cta: 'Shop one-of-a-kind',
    href: '/collections',
    alt: 'Raw metal offcuts, a hammer and stamps on a workbench',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (maker label, title, price, low-stock,
 *  description, add-to-cart, a static "made by hand" note, and policy links). */
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
                    text: 'Forge & Fold',
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
                    label: 'Only a few made',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Made by hand, to order' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Forged, stamped and finished by hand in recycled sterling silver or bronze — so yours will have its own small variations. Made to order in about a week, wrapped in a cloth pouch, and repaired at the bench for as long as you own it. Not right? Send it back unworn within 30 days.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Goes well with' });

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
    'The whole bench',
    'Every piece the workshop makes, in recycled sterling silver and bronze — rings, earrings, necklaces and cuffs. Filter by metal or category, or sort however you like; all of it is forged, stamped and set by hand, and made to order.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead(
    'Collections',
    'The pieces grouped the way people actually shop — the newest work off the bench, the everyday metal you’ll reach for daily, the true one-of-a-kind pieces set with rough stones, and gifts that land every time.'
  ),
];
const SEARCH: Node[] = [
  pageMasthead('Search Forge & Fold', 'Looking for a metal, a stone, or a size? Search the whole bench and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your bag' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping over $75, a cloth pouch with every order, and 30-day returns on anything unworn. Each piece is made to order by hand, so give it about a week at the bench before it ships — worth the wait for something no one else has.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'From the bench' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the workshop — how a piece is forged from raw metal, what silver and bronze actually do over time, and how to care for handmade jewelry so it only gets better. Plain, honest, no jargon.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Forge & Fold' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Forge & Fold began at a scarred wooden bench in a rented corner of a shared studio, with a hammer, a torch, and a stubborn preference for making things the slow way. It hasn’t really changed. Every piece still starts as a length of raw metal and gets hammered, filed, stamped and set entirely by hand — one maker, one bench, one piece at a time.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The metal is recycled sterling silver and bronze; the stones are rough-cut and one of a kind, chosen for character rather than clarity. Nothing is cast in bulk, nothing is plated, and nothing is pretending to be something it isn’t. The hammer marks stay, the patina is left where it belongs, and the piece is finished by the same hands that started it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'What that means for you: jewelry with real weight and a real story, made to be worn hard and to wear in beautifully. And because it was made here by hand, it can be mended here by hand — bring anything I’ve made back to the bench any time, for as long as you own it.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Say hello' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'A question about a piece, a custom commission, a resize, or a repair? Tell me what you’re after and I’ll write back myself — it’s just me at the bench, so give it a day or two.',
          }),
          el('a', 'btn btn-primary btn-lg', { attrs: { href: 'mailto:hello@forgeandfold.example' }, text: 'Email the workshop' }),
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

// Metal is the spine of an artisan catalogue too — but the maker's metals are recycled
// STERLING SILVER and BRONZE, not gold. Silver is the reference price; bronze is a warm,
// more affordable alternative at a genuine fraction of it, so the storefront's swatch
// resolves two real prices, not a cosmetic option. Ring sizes are a dropdown. A raw
// birthstone is a dropdown of rough-cut months.
const RING_SIZES = ['5', '6', '7', '8', '9'];
const BIRTHSTONES = [
  'April — Rough Aquamarine',
  'June — Raw Moonstone',
  'August — Raw Peridot',
  'October — Raw Tourmaline',
  'December — Raw Turquoise',
];

const metalOption: OptionDecl = {
  name: 'Metal',
  displayType: 'swatch',
  values: [{ value: 'Sterling Silver' }, { value: 'Bronze' }],
};
const sizeOption = (values: string[]): OptionDecl => ({
  name: 'Size',
  displayType: 'dropdown',
  values: values.map((value) => ({ value })),
});
const birthstoneOption: OptionDecl = {
  name: 'Birthstone',
  displayType: 'dropdown',
  values: BIRTHSTONES.map((value) => ({ value })),
};

const metalCode = (metal: string): string => (metal === 'Sterling Silver' ? 'S' : 'B');
// Bronze at ~65% of the silver price — a realistic spread for a hand-made piece where the
// silver carries most of the material cost.
const bronzePrice = (silverPrice: number): number => Math.round(silverPrice * 0.65);
const sizeCode = (s: string): string => s.replace(/[^A-Za-z0-9]/g, '').slice(0, 2).toUpperCase();

/** A piece offered in both metals only (no size) — the earrings, cuffs and simple chains.
 *  Two variants, silver default, each priced for its metal. */
const piece = (opts: {
  handle: string;
  title: string;
  description: string;
  silverPrice: number;
  sku: string;
  productType: string;
  category: string;
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
  vendor: 'Forge & Fold',
  tags: opts.tags,
  categoryHandles: [opts.category],
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [metalOption],
  variants: [
    { sku: `${opts.sku}-S`, priceCents: money(opts.silverPrice), isDefault: true, inventoryPolicy: 'continue', optionValues: { Metal: 'Sterling Silver' } },
    { sku: `${opts.sku}-B`, priceCents: money(bronzePrice(opts.silverPrice)), inventoryPolicy: 'continue', optionValues: { Metal: 'Bronze' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

/** A ring — the Metal × Size grid, so the storefront's swatch + dropdown both resolve. */
const ring = (opts: {
  handle: string;
  title: string;
  description: string;
  silverPrice: number;
  sku: string;
  collections: string[];
  tags: string[];
  asset: string;
  seoTitle: string;
  seoDescription: string;
  sizes?: string[];
}): Product => {
  const sizes = opts.sizes ?? RING_SIZES;
  const variants: Variant[] = [];
  let first = true;
  for (const metal of ['Sterling Silver', 'Bronze']) {
    const price = metal === 'Sterling Silver' ? opts.silverPrice : bronzePrice(opts.silverPrice);
    for (const size of sizes) {
      variants.push({
        sku: `${opts.sku}-${metalCode(metal)}-${sizeCode(size)}`,
        priceCents: money(price),
        ...(first ? { isDefault: true as const } : {}),
        inventoryPolicy: 'continue',
        optionValues: { Metal: metal, Size: size },
      });
      first = false;
    }
  }
  return {
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: 'Ring',
    vendor: 'Forge & Fold',
    tags: opts.tags,
    categoryHandles: ['rings'],
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    options: [metalOption, sizeOption(sizes)],
    variants,
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
  };
};

const PRODUCTS: Product[] = [
  piece({
    handle: 'hammered-hoop-earrings',
    title: 'Hammered Hoops',
    description:
      'The hoop you put in and forget about — a lightweight round of solid wire, hammered flat so it throws light from a dozen tiny facets, with a secure hook closure. Small enough for every day, characterful enough that people ask where you got them.',
    silverPrice: 88,
    sku: 'FF-HOOP',
    productType: 'Earrings',
    category: 'earrings',
    collections: ['new-at-the-bench', 'best-sellers', 'everyday-metal'],
    tags: ['earrings', 'hoops', 'hammered', 'everyday'],
    asset: 'forge-prod-hoops',
    seoTitle: 'Hammered Hoops — hand-forged silver or bronze | Forge & Fold',
    seoDescription: 'Lightweight hand-hammered hoop earrings in recycled sterling silver or bronze, with a secure hook closure.',
  }),
  piece({
    handle: 'pebble-stud-earrings',
    title: 'Pebble Studs',
    description:
      'A pair of tiny hand-formed studs with a molten, river-pebble texture — no two domes quite identical, because they’re shaped one at a time under the hammer. The everyday earring that goes with everything and never has to come out.',
    silverPrice: 58,
    sku: 'FF-STUD',
    productType: 'Earrings',
    category: 'earrings',
    collections: ['everyday-metal', 'gifts'],
    tags: ['earrings', 'studs', 'textured', 'everyday'],
    asset: 'forge-prod-studs',
    seoTitle: 'Pebble Studs — textured hand-made stud earrings | Forge & Fold',
    seoDescription: 'Tiny hand-formed pebble-textured stud earrings in recycled sterling silver or bronze. No two quite alike.',
  }),
  ring({
    handle: 'raw-stone-ring',
    title: 'Raw Stone Ring',
    description:
      'A rough-cut, uncut stone raised in a hand-built bezel on a chunky forged band — chosen for character, not clarity, so the one you receive is genuinely one of a kind. Substantial, a little wild, and made to become the ring you never take off.',
    silverPrice: 132,
    sku: 'FF-RAW',
    collections: ['new-at-the-bench', 'one-of-a-kind'],
    tags: ['ring', 'raw-stone', 'statement', 'one-of-a-kind'],
    asset: 'forge-prod-rawstone',
    seoTitle: 'Raw Stone Ring — rough-cut stone, hand-forged band | Forge & Fold',
    seoDescription: 'A rough-cut one-of-a-kind stone in a hand-built bezel on a chunky forged band, in silver or bronze.',
  }),
  ring({
    handle: 'carved-signet-ring',
    title: 'Carved Signet Ring',
    description:
      'A solid signet with a hand-carved, hammer-textured face — the ring you engrave with an initial or leave raw to wear in on its own. Weighty without being clumsy, and just as good stacked against the raw stone ring as worn alone.',
    silverPrice: 145,
    sku: 'FF-SIGNET',
    collections: ['best-sellers', 'one-of-a-kind'],
    tags: ['ring', 'signet', 'carved', 'engravable'],
    asset: 'forge-prod-signet',
    seoTitle: 'Carved Signet Ring — hand-textured solid signet | Forge & Fold',
    seoDescription: 'A solid hand-carved, hammer-textured signet ring in recycled sterling silver or bronze. Engravable.',
  }),
  {
    handle: 'mixed-metal-pendant',
    title: 'Mixed-Metal Pendant',
    description:
      'A small forged disc where silver and bronze are fused and hammered together, so the two metals bleed into one another differently on every piece. Hangs on an 18" oxidised silver chain — the everyday necklace that layers with anything and warms up as it wears.',
    status: 'active',
    productType: 'Necklace',
    vendor: 'Forge & Fold',
    tags: ['necklace', 'pendant', 'mixed-metal', 'layering'],
    categoryHandles: ['necklaces'],
    collectionHandles: ['everyday-metal', 'gifts', 'one-of-a-kind'],
    seoTitle: 'Mixed-Metal Pendant — fused silver & bronze | Forge & Fold',
    seoDescription: 'A hand-fused silver-and-bronze forged disc on an 18" oxidised silver chain. One of a kind, made to layer.',
    variants: [{ sku: 'FF-MIX-PENDANT', priceCents: money(118), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'forge-prod-pendant', isPrimary: true, alt: 'A mixed-metal pendant of silver and bronze on a chain' }],
  },
  {
    handle: 'raw-birthstone-pendant',
    title: 'Raw Birthstone Pendant',
    description:
      'A single rough-cut birthstone set in a rustic hand-built bezel on a fine chain — pick the month that means something and the stone is chosen and set to match. Personal without being fussy, and worn far past the birthday it marks.',
    status: 'active',
    productType: 'Necklace',
    vendor: 'Forge & Fold',
    tags: ['necklace', 'birthstone', 'raw-stone', 'personalized', 'gift'],
    categoryHandles: ['necklaces'],
    collectionHandles: ['new-at-the-bench', 'one-of-a-kind', 'gifts'],
    seoTitle: 'Raw Birthstone Pendant — rough-cut, hand-set | Forge & Fold',
    seoDescription: 'A rough-cut birthstone in a rustic hand-built bezel on a fine chain, set to your month, in silver or bronze.',
    options: [metalOption, birthstoneOption],
    variants: [
      ...BIRTHSTONES.flatMap((stone, i) => [
        {
          sku: `FF-BIRTH-S-${sizeCode(stone)}`,
          priceCents: money(108),
          ...(i === 0 ? { isDefault: true as const } : {}),
          inventoryPolicy: 'continue' as const,
          optionValues: { Metal: 'Sterling Silver', Birthstone: stone },
        },
        {
          sku: `FF-BIRTH-B-${sizeCode(stone)}`,
          priceCents: money(bronzePrice(108)),
          inventoryPolicy: 'continue' as const,
          optionValues: { Metal: 'Bronze', Birthstone: stone },
        },
      ]),
    ],
    images: [{ assetId: 'forge-prod-birthstone', isPrimary: true, alt: 'A raw birthstone in a rustic silver bezel pendant' }],
  },
  piece({
    handle: 'hand-stamped-cuff',
    title: 'Hand-Stamped Cuff',
    description:
      'A solid open cuff, stamped by hand with a run of small marks and left with an oxidised, lived-in finish — the piece that reads as made, not bought. Gently springs on over the wrist and holds its shape for years; each one stamped a little differently.',
    silverPrice: 96,
    sku: 'FF-CUFF',
    productType: 'Bracelet',
    category: 'cuffs',
    collections: ['best-sellers', 'one-of-a-kind', 'everyday-metal'],
    tags: ['bracelet', 'cuff', 'stamped', 'oxidised'],
    asset: 'forge-prod-cuff',
    seoTitle: 'Hand-Stamped Cuff — oxidised open cuff | Forge & Fold',
    seoDescription: 'A solid open cuff hand-stamped with small marks and an oxidised finish, in recycled silver or bronze.',
  }),
  piece({
    handle: 'forged-chain-bracelet',
    title: 'Forged Chain Bracelet',
    description:
      'A chunky bracelet built link by link from solid wire — each loop soldered closed, hammered and cleaned up by hand, then hung on a substantial lobster clasp. Has real weight and a satisfying rattle; wears bright or takes on a patina, whichever you leave it.',
    silverPrice: 92,
    sku: 'FF-CHAIN',
    productType: 'Bracelet',
    category: 'cuffs',
    collections: ['new-at-the-bench', 'everyday-metal'],
    tags: ['bracelet', 'chain', 'forged', 'everyday'],
    asset: 'forge-prod-chain',
    seoTitle: 'Forged Chain Bracelet — hand-built solid links | Forge & Fold',
    seoDescription: 'A chunky hand-forged chain bracelet built link by link in recycled sterling silver or bronze.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'rings', name: 'Rings', description: 'Raw-stone rings, signets and forged bands.', featured: true },
    { handle: 'earrings', name: 'Earrings', description: 'Hammered hoops and textured studs.', featured: true },
    { handle: 'necklaces', name: 'Necklaces', description: 'Mixed-metal and raw-birthstone pendants.', featured: true },
    { handle: 'cuffs', name: 'Cuffs & bracelets', description: 'Stamped cuffs and forged chains.', featured: true },
  ],
  collections: [
    {
      handle: 'new-at-the-bench',
      name: 'New at the bench',
      description: 'The newest work, straight off the bench.',
      type: 'manual',
      featured: true,
      productHandles: ['hammered-hoop-earrings', 'raw-stone-ring', 'raw-birthstone-pendant', 'forged-chain-bracelet'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The pieces people come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['hammered-hoop-earrings', 'hand-stamped-cuff', 'carved-signet-ring'],
    },
    {
      handle: 'everyday-metal',
      name: 'Everyday metal',
      description: 'Solid pieces made to never take off.',
      type: 'manual',
      featured: true,
      productHandles: ['pebble-stud-earrings', 'forged-chain-bracelet', 'mixed-metal-pendant', 'hammered-hoop-earrings'],
    },
    {
      handle: 'one-of-a-kind',
      name: 'One of a kind',
      description: 'Pieces set with rough stones — no two the same.',
      type: 'manual',
      featured: false,
      productHandles: ['raw-stone-ring', 'raw-birthstone-pendant', 'hand-stamped-cuff', 'mixed-metal-pendant'],
    },
    {
      handle: 'gifts',
      name: 'Gifts',
      description: 'Wrapped in a pouch, ready to give.',
      type: 'manual',
      featured: false,
      productHandles: ['pebble-stud-earrings', 'mixed-metal-pendant', 'raw-birthstone-pendant'],
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
    slug: 'made-at-the-bench',
    status: 'published',
    body: {
      title: 'How a piece is made, start to finish',
      excerpt: 'From a length of raw wire to a finished ring — the forging, the hammering, the stamping and the patina, and why doing it slowly by hand is the whole point.',
      featuredImage: { $asset: 'forge-post-bench' },
      body: {
        type: 'doc',
        content: [
          para('People sometimes assume handmade means a piece was assembled from ready-made parts. It doesn’t — not here. Everything starts as raw metal: a length of solid sterling or bronze wire, or a flat sheet. From there it’s heated, hammered, filed, stamped and set entirely by hand at one bench. No casting a hundred at a time, no plating, no shortcuts that would let two pieces come out identical.'),
          h2('Forging and shaping'),
          para('A ring begins as a straight length of wire, annealed soft in the torch flame, then bent around a steel mandrel and hammered true. The hammering isn’t just shaping — it work-hardens the metal so the finished piece holds up to years of wear, and it leaves the faceted texture you can see catching the light. That texture is a record of the making, which is exactly why it stays.'),
          h2('Stamping, setting and patina'),
          para('Marks are struck one at a time with steel stamps and a hammer, so a stamped cuff is never quite the same twice. Stones are set in bezels built up by hand around each rough stone — since the stones are uncut, no two settings are identical either. Finally the piece is oxidised to bring out the texture, then polished back on the high points, so shadow sits in the marks and light rides the edges. Then it’s yours: made once, by hand, for you.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'silver-and-bronze',
    status: 'published',
    body: {
      title: 'Silver or bronze: what each metal actually does',
      excerpt: 'Not a taste test — a practical look at how sterling silver and bronze wear, age and patina, and how to pick the one you’ll actually reach for.',
      featuredImage: { $asset: 'forge-post-metals' },
      body: {
        type: 'doc',
        content: [
          para('Every piece here is offered in two metals, and they’re genuinely different — not a colour swap. Both are solid and recycled: .925 sterling silver, or a warm architectural bronze. The choice comes down to tone, how each one ages, and budget, because bronze runs a good bit less than the same piece in silver.'),
          h2('Tone and how they age'),
          para('Sterling silver is bright and cool, and it takes an oxidised finish beautifully — the marks and textures go dark and the whole piece reads as considered. Left alone it slowly tarnishes to a soft grey patina, which is either something you love or something you polish back to bright in seconds with a cloth. Bronze is warm and golden, closer to old gold than to brass, and it develops a rich living patina over time as it reacts to your skin — some people seal it, most just let it deepen.'),
          h2('Which to choose'),
          para('If you want bright-and-cool, or you plan to wear a piece next to existing silver, go sterling. If you want warm-and-golden, or you like the idea of a metal that visibly changes with you, go bronze — and it’s the friendlier price to try a design on. And mixing the two is the whole idea behind the mixed-metal pendant: a warm bronze cuff next to a cool silver ring reads as intentional now, not careless.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'caring-for-handmade-jewelry',
    status: 'published',
    body: {
      title: 'Caring for handmade silver and bronze',
      excerpt: 'Handmade metal is tougher than it looks and asks very little — here’s the whole routine, how to handle the patina, and the two things to actually avoid.',
      featuredImage: { $asset: 'forge-post-care' },
      body: {
        type: 'doc',
        content: [
          para('Hand-forged jewelry is made to be worn, not shelved. It’s solid metal — no plating to wear through — so a scratch just becomes part of the story and a knock rarely does real harm. A few small habits keep silver bright and let bronze patina the way you want it to, instead of by accident.'),
          h2('The everyday routine'),
          para('Put jewelry on last — after lotion, perfume and hairspray, which are the main things that dull a finish. Take rings and cuffs off for heavy work, the gym and the washing-up; it’s grit and knocks, not water, that wear a piece down fastest. A quick rub with a soft cloth after wear keeps silver bright. About once a month, warm water, a drop of dish soap and a soft brush brings everything back — then dry it properly before it’s put away.'),
          h2('Patina, storage, and what to avoid'),
          para('The oxidised finish and the bronze patina are meant to be there — so skip the dip-style silver cleaners, which strip the deliberate darkness right out of the stamped marks. If a piece goes further than you like, that’s an easy fix at the bench. Store pieces apart so they don’t scratch each other, and keep silver in a little zip bag to slow tarnish. The two things to genuinely avoid: chlorine (take everything off before a pool or hot tub) and abrasive pastes on anything set with a stone. When in doubt, send it back — cleaning and re-finishing anything I’ve made is free, for as long as you own it.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-jewelry-artisan',
  key: 'sparx-retail-jewelry-artisan',
  name: 'sparx — Artisan Jeweler',
  theme: THEME,
  summary:
    'A complete, working shop for a handmade / artisan jeweler: a real catalogue of hand-forged pieces in recycled sterling silver and bronze — hammered hoops, a raw-stone ring, a hand-stamped cuff, a mixed-metal pendant, studs, a forged chain, a signet and a raw birthstone pendant — with Metal and Size variants, categories, collections, a bespoke PDP and a merchandised home page. Earthy theme — warm clay ground, bark ink, oxidised-bronze primary, fired-copper accent. Shipped as Forge & Fold.',
  tagline: 'An earthy, working storefront for a handmade jeweler.',
  vertical: 'retail',
  industry: 'Artisan jeweler',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 87,
  brand: {
    businessName: 'Forge & Fold',
    tagline: 'Made at the bench, one at a time.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Forge & Fold — handmade jewelry in silver and bronze',
      description:
        'Forge & Fold is a one-person jewelry workshop — rings, earrings, necklaces and cuffs forged, stamped and set by hand in recycled sterling silver and bronze. No two pieces the same.',
    },
    about: {
      title: 'About Forge & Fold',
      description:
        'How Forge & Fold works — one maker, one bench, raw recycled metal and rough-cut stones, hammered and set by hand, and repaired for life.',
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
