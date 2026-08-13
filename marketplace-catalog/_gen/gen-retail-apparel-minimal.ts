// sparx-retail-apparel-minimal — a RETAIL/COMMERCE site template: a quiet-luxury
// fashion boutique of well-made essentials.
//
// A sibling of the retail-family gold reference (`gen-retail-coffee-craft.ts`): a
// complete, working shop the moment it installs — a real wardrobe of tees, shirts,
// knitwear, trousers, an overcoat and a couple of accessories (every garment sized
// XS–XL and offered in a handful of colours), categories + collections, a bespoke
// editorial PDP, and the full 9-page commerce site (merchandised home → shop →
// collections → cart → search → journal → about → contact). Dressed in an INLINE
// bespoke theme: a warm bone paper ground, a near-black MONO primary, no chromatic
// accent — the clothes are the colour. Shipped as Kestrel.
//
// SELF-CONTAINED BY DESIGN. Like the coffee reference, this generator carries its OWN
// theme inline and passes it on the spec (`theme`), so the whole retail family can be
// authored in parallel without any two generators contending on a shared `*-themes.ts`
// registry. The shared `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-apparel-minimal.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-apparel-minimal/**" \
//     "marketplace-catalog/_gen/gen-retail-apparel-minimal.ts"
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
// Editorial minimalism: a warm bone paper ground, a near-black MONO primary, a warm
// grey secondary (dark and legible on light), a muted taupe accent that barely reads as
// a colour at all — the garments carry the colour, the site does not. A Didone display
// (Cormorant Garamond) over a quiet geometric sans (Jost), square corners, zero depth.
// Complete light + dark, AA on every role (the blueprint sweep's contrast check is the gate).
const THEME = defineTheme({
  name: 'kestrel-mono',
  type: { body: face('Jost', 'sans-serif'), head: face('Cormorant Garamond', 'serif') },
  shape: { selector: '0', field: '0', box: '0', depth: '0' },
  light: {
    surfaces: ['oklch(97% 0.008 85)', 'oklch(94% 0.01 82)', 'oklch(88% 0.014 80)', 'oklch(20% 0.01 70)'],
    roles: {
      primary: 'oklch(23% 0.008 70)',
      secondary: 'oklch(43% 0.016 70)',
      accent: 'oklch(54% 0.03 60)',
      neutral: 'oklch(26% 0.008 70)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(18% 0.008 70)', 'oklch(15% 0.008 70)', 'oklch(12% 0.008 70)', 'oklch(95% 0.008 85)'],
    roles: {
      // On near-black the confident control is the one printed in paper white.
      primary: 'oklch(95% 0.008 85)',
      secondary: 'oklch(74% 0.016 78)',
      accent: 'oklch(74% 0.03 60)',
      neutral: 'oklch(30% 0.008 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "kestrel-tile-tops": "https://images.unsplash.com/photo-1602810316693-3667c854239a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwc3RhY2slMjBwbGFpbiUyMGNvdHRvbiUyMHRlZXMlMjBveGZvcmQlMjBzaGlydHxlbnwwfDB8fHwxNzg2NDAyMDY1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-tile-knitwear": "https://images.unsplash.com/photo-1595026525047-dfa997df8a4a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGVhdnl3ZWlnaHQlMjBjcmVhbSUyMGZpc2hlcm1hbiUyMGtuaXQlMjBsYWlkJTIwZmxhdHxlbnwwfDB8fHwxNzg2NDAyMDY3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-tile-trousers": "https://images.unsplash.com/photo-1705408738824-c77f11ac5c65?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2lkZS1sZWclMjB3b29sJTIwdHJvdXNlcnMlMjBkcmFwZWQlMjBjaGFpcnxlbnwwfDB8fHwxNzg2NDAyMDcxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-tile-outerwear": "https://images.unsplash.com/photo-1689887883155-ea1e241b34d7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FtZWwlMjBvdmVyY29hdCUyMGhhbmdpbmclMjB3b29kZW4lMjBwZWd8ZW58MHwwfHx8MTc4NjQwMjA3NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-band-craft": "https://images.unsplash.com/photo-1739117441029-9f2a8e59e8b2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFpbG9yJTIwcGlubmluZyUyMHNlYW0lMjBnYXJtZW50JTIwdGFibGV8ZW58MHwwfHx8MTc4NjQwMjA3OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-band-care": "https://images.unsplash.com/photo-1643015862949-5c8d15a4242e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8a25pdCUyMHN3ZWF0ZXIlMjBkcnlpbmclMjBmbGF0JTIwbGluZW4lMjBjbG90aHxlbnwwfDB8fHwxNzg2NDAyMDgxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-prod-tee": "https://images.unsplash.com/photo-1759572095317-3a96f9a98e2b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGVhdnl3ZWlnaHQlMjBjb3R0b24lMjBjcmV3LW5lY2slMjB0ZWUlMjBib25lfGVufDB8MHx8fDE3ODY0MDIwODR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-prod-oxford": "https://images.unsplash.com/photo-1773747310659-9b331019c5c2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVsYXhlZCUyMGVjcnUlMjBveGZvcmQlMjBzaGlydCUyMGhhbmdlcnxlbnwwfDB8fHwxNzg2NDAyMDg4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-prod-fisherman": "https://images.unsplash.com/photo-1588271968087-4c51abe05afc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2h1bmt5JTIwb2F0bWVhbCUyMGZpc2hlcm1hbiUyMGtuaXQlMjBzd2VhdGVyfGVufDB8MHx8fDE3ODY0MDIwOTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-prod-merino": "https://images.unsplash.com/photo-1607160199580-1b0c9b736b66?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmluZSUyMGNhbWVsJTIwbWVyaW5vJTIwY3Jldy1uZWNrJTIwc3dlYXRlcnxlbnwwfDB8fHwxNzg2NDAyMDk1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-prod-wide-trouser": "https://images.unsplash.com/photo-1544306021-b6e135ae456b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RvbmUlMjB3aWRlLWxlZyUyMHdvb2wlMjB0cm91c2Vyc3xlbnwwfDB8fHwxNzg2NDAyMDk4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-prod-pleated-trouser": "https://images.unsplash.com/photo-1753741821073-848613438821?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hhcmNvYWwlMjBwbGVhdGVkJTIwdGFpbG9yZWQlMjB0cm91c2Vyc3xlbnwwfDB8fHwxNzg2NDAyMTAxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-prod-scarf": "https://images.unsplash.com/photo-1670764732085-ebedbd8d7e7c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c29mdCUyMG9hdG1lYWwlMjBsYW1ic3dvb2wlMjBzY2FyZiUyMGNvaWxlZCUyMHN1cmZhY2V8ZW58MHwwfHx8MTc4NjQwMjEwN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-prod-tote": "https://images.unsplash.com/photo-1637759292654-a12cb2be085e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFuJTIwdmVnZXRhYmxlLXRhbm5lZCUyMGxlYXRoZXIlMjB0b3RlJTIwYmFnfGVufDB8MHx8fDE3ODY0MDIxMTB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-post-fewer": "https://images.unsplash.com/photo-1551488831-00ddcb6c6bd3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFyZWQtYmFjayUyMHdhcmRyb2JlJTIwcmFpbCUyMGZldyUyMGNvbnNpZGVyZWQlMjBwaWVjZXN8ZW58MHwwfHx8MTc4NjQwMjExM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-post-fabric": "https://images.unsplash.com/photo-1628565487762-bf17ac622f06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xvc2UlMjBjcm9wJTIwd292ZW4lMjB3b29sJTIwY290dG9uJTIwZmFicmljJTIwc3dhdGNoZXN8ZW58MHwwfHx8MTc4NjQwMjExNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kestrel-post-care": "https://images.unsplash.com/photo-1778918006381-f6c98df9fe64?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHMlMjBmb2xkaW5nJTIwa25pdCUyMHN3ZWF0ZXIlMjB3b29kZW4lMjB0YWJsZXxlbnwwfDB8fHwxNzg2NDAyMTE5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'kestrel-hero', url: src('kestrel-hero'), alt: 'A model in a bone knit and wide wool trousers against a plaster wall' },
  { id: 'kestrel-tile-tops', url: src('kestrel-tile-tops'), alt: 'A folded stack of plain cotton tees and an oxford shirt' },
  { id: 'kestrel-tile-knitwear', url: src('kestrel-tile-knitwear'), alt: 'A heavyweight cream fisherman knit laid flat' },
  { id: 'kestrel-tile-trousers', url: src('kestrel-tile-trousers'), alt: 'Wide-leg wool trousers draped over a chair' },
  { id: 'kestrel-tile-outerwear', url: src('kestrel-tile-outerwear'), alt: 'A camel overcoat hanging on a wooden peg' },
  { id: 'kestrel-band-craft', url: src('kestrel-band-craft'), alt: 'A tailor pinning a seam on a garment on the table' },
  { id: 'kestrel-band-care', url: src('kestrel-band-care'), alt: 'A knit sweater drying flat on a linen cloth' },
  { id: 'kestrel-prod-tee', url: src('kestrel-prod-tee'), alt: 'A heavyweight cotton crew-neck tee in bone' },
  { id: 'kestrel-prod-oxford', url: src('kestrel-prod-oxford'), alt: 'A relaxed ecru oxford shirt on a hanger' },
  { id: 'kestrel-prod-fisherman', url: src('kestrel-prod-fisherman'), alt: 'A chunky oatmeal fisherman knit sweater' },
  { id: 'kestrel-prod-merino', url: src('kestrel-prod-merino'), alt: 'A fine camel merino crew-neck sweater' },
  { id: 'kestrel-prod-wide-trouser', url: src('kestrel-prod-wide-trouser'), alt: 'Stone wide-leg wool trousers' },
  { id: 'kestrel-prod-pleated-trouser', url: src('kestrel-prod-pleated-trouser'), alt: 'Charcoal pleated tailored trousers' },
  { id: 'kestrel-prod-overcoat', url: src('kestrel-prod-overcoat'), alt: 'A camel double-faced wool overcoat' },
  { id: 'kestrel-prod-scarf', url: src('kestrel-prod-scarf'), alt: 'A soft oatmeal lambswool scarf coiled on a surface' },
  { id: 'kestrel-prod-tote', url: src('kestrel-prod-tote'), alt: 'A tan vegetable-tanned leather tote bag' },
  { id: 'kestrel-post-fewer', url: src('kestrel-post-fewer'), alt: 'A pared-back wardrobe rail of a few considered pieces' },
  { id: 'kestrel-post-fabric', url: src('kestrel-post-fabric'), alt: 'A close crop of woven wool and cotton fabric swatches' },
  { id: 'kestrel-post-care', url: src('kestrel-post-care'), alt: 'Hands folding a knit sweater on a wooden table' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-apparel-minimal: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one quiet photograph, a serif headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on
 *  the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('kestrel-hero'), alt: 'A model in a bone knit and wide wool trousers', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-24 @3xl:px-10 @3xl:py-32',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('p', 'text-xs font-semibold uppercase tracking-widest text-secondary', {
                  text: 'The winter capsule',
                }),
                el('h1', 'text-5xl font-normal leading-none tracking-tight text-base-content @3xl:text-7xl', {
                  text: 'Fewer, better clothes.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Kestrel makes a small wardrobe of essentials in good cloth — the tee, the knit, the trouser, the coat — cut to last and to wear together. No logos, no seasons to chase. Buy less, wear it longer.',
                }),
                el('div', 'flex flex-wrap items-center gap-6', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the collection' }),
                    el('a', 'text-base font-semibold uppercase tracking-widest text-accent underline underline-offset-4', {
                      attrs: { href: '/blog/the-case-for-fewer-clothes' },
                      text: 'Read the journal',
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

/** One category tile — a tall editorial photo with an uppercase label beneath, the whole
 *  tile a link. */
function categoryTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
  return el('a', 'group flex flex-col gap-4', {
    attrs: { href: o.href },
    children: [
      el('img', 'aspect-square w-full bg-base-200 object-cover transition group-hover:opacity-90', {
        attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
      }),
      el('span', 'text-center text-sm font-semibold uppercase tracking-widest text-base-content', { text: o.label }),
    ],
  });
}

function categoryTiles(): Node {
  return el('section', 'bg-base-100 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-10', {
        children: [
          el('h2', 'text-4xl font-normal tracking-tight text-base-content @3xl:text-5xl', {
            text: 'The wardrobe',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'kestrel-tile-tops', label: 'Tops', href: '/shop', alt: 'A stack of cotton tees and an oxford shirt' }),
              categoryTile({ assetId: 'kestrel-tile-knitwear', label: 'Knitwear', href: '/shop', alt: 'A heavyweight cream fisherman knit' }),
              categoryTile({ assetId: 'kestrel-tile-trousers', label: 'Trousers', href: '/shop', alt: 'Wide-leg wool trousers over a chair' }),
              categoryTile({ assetId: 'kestrel-tile-outerwear', label: 'Outerwear', href: '/shop', alt: 'A camel overcoat on a peg' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A full-bleed editorial band — a photo carrying an uppercase label, a serif heading, a
 *  lead and a link, panel bottom-left. */
function editorialBand(o: { eyebrow: string; heading: string; lead: string; assetId: string; cta: string; href: string; alt: string }): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-24 @3xl:px-10 @3xl:py-32',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-4 bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('p', 'text-xs font-semibold uppercase tracking-widest text-secondary', { text: o.eyebrow }),
                el('h2', 'text-4xl font-normal leading-none tracking-tight text-base-content @3xl:text-5xl', {
                  text: o.heading,
                }),
                el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
                el('a', 'text-base font-semibold uppercase tracking-widest text-accent underline underline-offset-4', {
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'The essentials' }),
  editorialBand({
    eyebrow: 'How it’s made',
    heading: 'Made to be kept',
    lead: 'We work with a handful of family mills and a small factory we visit ourselves — long-staple cottons, full-weight wools, seams finished to survive a decade of washes. A Kestrel piece is meant to be the last one you buy of its kind.',
    assetId: 'kestrel-band-craft',
    cta: 'Our making',
    href: '/blog/how-to-read-a-fabric',
    alt: 'A tailor pinning a seam on a garment',
  }),
  productsBlock({ source: 'commerce.category.knitwear', layout: 'carousel', heading: 'The knitwear edit' }),
  editorialBand({
    eyebrow: 'Wear it well',
    heading: 'A wardrobe, not a haul',
    lead: 'Everything here is cut to work with everything else — one palette of bone, stone, charcoal and camel, so any two pieces already go together. Start with a few, add slowly, and get dressed in ten seconds flat.',
    assetId: 'kestrel-band-care',
    cta: 'The capsule idea',
    href: '/blog/the-case-for-fewer-clothes',
    alt: 'A knit sweater drying flat on linen',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, size/colour add-to-cart, a static "considered construction" note, and policy
 *  links). Square corners, generous space — the editorial idiom. */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-24', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          pdpImage('aspect-square w-full bg-base-200 object-cover'),
          el('div', 'flex flex-col gap-6 @3xl:py-4', {
            children: [
              el('div', 'flex flex-col gap-4', {
                children: [
                  el('p', 'text-xs font-semibold uppercase tracking-widest text-secondary', {
                    text: 'Kestrel',
                  }),
                  pdpTitle('h1', 'text-4xl font-normal leading-none tracking-tight text-base-content @3xl:text-6xl'),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-normal text-base-content',
                    compareClass: 'text-lg text-secondary line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 border border-base-300 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-base-content',
                    label: 'Low stock',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 border-t border-base-300 pt-6', {
                children: [
                  el('h2', 'text-xs font-semibold uppercase tracking-widest text-secondary', { text: 'Considered construction' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Cut in full-weight cloth and finished with reinforced seams, so it holds its shape wash after wash. Fits true — take your usual size; between two, size down for a cleaner line. Free returns within 30 days if it isn’t right.',
                  }),
                ],
              }),
              pdpPolicyLinks({
                className:
                  'flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-base-300 pt-6 text-xs font-semibold uppercase tracking-widest text-base-content',
                linkClass: 'underline underline-offset-4',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Wears well with' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(eyebrow: string, heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-20 pb-8', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('p', 'text-xs font-semibold uppercase tracking-widest text-secondary', { text: eyebrow }),
          el('h1', 'text-5xl font-normal leading-none tracking-tight text-base-content @3xl:text-7xl', {
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
    'Everything, in stock',
    'The collection',
    'The whole wardrobe in one place — tees and shirts, knitwear, trousers, outerwear and a few good accessories. One palette, cut to layer. Filter by category or sort however you like.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead(
    'Grouped to shop',
    'Collections',
    'The pieces gathered the way people actually get dressed — the everyday essentials, this season’s new cuts, the knitwear edit and the tailoring. Start anywhere.'
  ),
];
const SEARCH: Node[] = [
  pageMasthead('Find it fast', 'Search Kestrel', 'Looking for a colour, a size or a particular cut? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-20 pb-8', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('p', 'text-xs font-semibold uppercase tracking-widest text-secondary', { text: 'Nearly there' }),
          el('h1', 'text-5xl font-normal leading-none tracking-tight text-base-content @3xl:text-7xl', { text: 'Your bag' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping over $150 and free returns within 30 days — try it on at home, send back what isn’t right, no questions. Everything is packed in recycled, plastic-free wrap.',
          }),
        ],
      }),
    ],
  }),
];
const JOURNAL: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-20 @3xl:py-24', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el('p', 'text-xs font-semibold uppercase tracking-widest text-secondary', { text: 'Notes & guides' }),
          el('h1', 'text-5xl font-normal leading-none tracking-tight text-base-content @3xl:text-7xl', { text: 'The Kestrel journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'On building a wardrobe you actually wear — how to read a fabric, why fewer is better, and how to make good clothes last. Plainly written, no trend-chasing.',
          }),
        ],
      }),
    ],
  }),
];

// ── About + Contact ─────────────────────────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-24', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('p', 'text-xs font-semibold uppercase tracking-widest text-secondary', { text: 'About Kestrel' }),
          el('h1', 'text-5xl font-normal tracking-tight text-base-content @2xl:text-6xl', { text: 'Clothes that stay' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Kestrel began with a simple frustration: too much of what we owned fell apart, went out of style, or never quite went with anything else. So we set out to make the opposite — a short list of essentials, in honest cloth, cut to wear together for years.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We keep the range small on purpose. Every piece has to earn its place: it has to be worth making well, worth keeping, and worth wearing beside everything else we make. If it doesn’t, it doesn’t get made.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We work directly with the mills and the factory that make our clothes, pay fairly for good work, and price honestly — no seasonal markdowns to disguise, no logo tax. Just good clothes, made to be kept.',
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
    heading: 'Get in touch',
    intro: [
      'Say hello',
      'Questions on sizing or fabric, a return to arrange, or a wholesale enquiry? Tell us what you need and a real person on our small team will write back within a day.',
    ],
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

const SIZES = ['XS', 'S', 'M', 'L', 'XL'];
const sizeOption = (values: string[]): OptionDecl => ({
  name: 'Size',
  displayType: 'dropdown',
  values: values.map((value) => ({ value })),
});
const colorOption = (values: string[]): OptionDecl => ({
  name: 'Color',
  displayType: 'swatch',
  values: values.map((value) => ({ value })),
});
const codeOf = (s: string): string => s.replace(/[^A-Za-z0-9]/g, '').slice(0, 3).toUpperCase();

/** Unique short codes for a value list — grows the slice until each is distinct, so two
 *  colours that share a 3-letter prefix (Chambray / Charcoal) never collide in a SKU. */
const uniqueCodes = (values: string[]): Record<string, string> => {
  const out: Record<string, string> = {};
  const seen = new Set<string>();
  for (const v of values) {
    const alpha = v.replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    let len = 3;
    let code = alpha.slice(0, len);
    while (seen.has(code) && len < alpha.length) code = alpha.slice(0, ++len);
    seen.add(code);
    out[v] = code;
  }
  return out;
};

/** A garment — sized XS–XL and offered in a set of colours; the Size × Color grid of
 *  variants is generated so the storefront's swatch + dropdown resolve real options. */
const garment = (opts: {
  handle: string;
  title: string;
  description: string;
  price: number;
  sku: string;
  productType: string;
  category: string;
  collections: string[];
  tags: string[];
  colors: string[];
  asset: string;
  seoTitle: string;
  seoDescription: string;
  sizes?: string[];
}): Product => {
  const sizes = opts.sizes ?? SIZES;
  const colorCodes = uniqueCodes(opts.colors);
  const variants: Variant[] = [];
  let first = true;
  for (const size of sizes) {
    for (const color of opts.colors) {
      variants.push({
        sku: `${opts.sku}-${codeOf(size)}-${colorCodes[color]}`,
        priceCents: money(opts.price),
        ...(first ? { isDefault: true as const } : {}),
        inventoryPolicy: 'continue',
        optionValues: { Size: size, Color: color },
      });
      first = false;
    }
  }
  return {
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: opts.productType,
    vendor: 'Kestrel',
    tags: opts.tags,
    categoryHandles: [opts.category],
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    options: [sizeOption(sizes), colorOption(opts.colors)],
    variants,
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
  };
};

/** An accessory — no size, offered in a set of colours only. */
const accessory = (opts: {
  handle: string;
  title: string;
  description: string;
  price: number;
  sku: string;
  collections: string[];
  tags: string[];
  colors: string[];
  asset: string;
  seoTitle: string;
  seoDescription: string;
}): Product => {
  const colorCodes = uniqueCodes(opts.colors);
  const variants: Variant[] = opts.colors.map((color, i) => ({
    sku: `${opts.sku}-${colorCodes[color]}`,
    priceCents: money(opts.price),
    ...(i === 0 ? { isDefault: true as const } : {}),
    inventoryPolicy: 'continue',
    optionValues: { Color: color },
  }));
  return {
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: 'Accessory',
    vendor: 'Kestrel',
    tags: opts.tags,
    categoryHandles: ['accessories'],
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    options: [colorOption(opts.colors)],
    variants,
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
  };
};

const PRODUCTS: Product[] = [
  garment({
    handle: 'everyday-tee',
    title: 'The Everyday Tee',
    description:
      'A heavyweight organic-cotton crew that holds its shape — a proper tee, not an undershirt. Boxy-but-clean through the body, ribbed at the neck so it never gapes, and dense enough to wear on its own. The one you’ll reach for first, in every colour.',
    price: 45,
    sku: 'KES-TEE',
    productType: 'Apparel',
    category: 'tops',
    collections: ['the-essentials', 'new-in'],
    tags: ['tee', 'cotton', 'everyday'],
    colors: ['Bone', 'Charcoal', 'Slate'],
    asset: 'kestrel-prod-tee',
    seoTitle: 'The Everyday Tee — heavyweight organic cotton | Kestrel',
    seoDescription: 'A dense, boxy heavyweight organic-cotton crew tee that holds its shape. In bone, charcoal and slate.',
  }),
  garment({
    handle: 'oxford-shirt',
    title: 'The Oxford Shirt',
    description:
      'A relaxed button-down in a soft, textured oxford cotton — crisp enough to wear open over a tee, easy enough to sleep in. Cut a little longer with a curved hem, mother-of-pearl buttons, and a collar that stands whether it’s buttoned or not.',
    price: 95,
    sku: 'KES-OXF',
    productType: 'Apparel',
    category: 'tops',
    collections: ['the-essentials'],
    tags: ['shirt', 'oxford', 'cotton'],
    colors: ['Ecru', 'Chambray', 'Charcoal'],
    asset: 'kestrel-prod-oxford',
    seoTitle: 'The Oxford Shirt — soft-washed oxford cotton | Kestrel',
    seoDescription: 'A relaxed, longer-cut oxford button-down in soft textured cotton. In ecru, chambray and charcoal.',
  }),
  garment({
    handle: 'fisherman-knit',
    title: 'The Fisherman Knit',
    description:
      'A heavyweight cable-knit in undyed British wool, knitted to an old gansey pattern by a mill that still does it properly. Thick, warm, and built to soften with wear — the sweater you keep for twenty winters and hand on after that.',
    price: 185,
    sku: 'KES-FISH',
    productType: 'Knitwear',
    category: 'knitwear',
    collections: ['the-knitwear-edit', 'winter-layers'],
    tags: ['knit', 'wool', 'heavyweight'],
    colors: ['Oatmeal', 'Ecru', 'Charcoal'],
    asset: 'kestrel-prod-fisherman',
    seoTitle: 'The Fisherman Knit — heavyweight British wool cable | Kestrel',
    seoDescription: 'A thick undyed British-wool cable-knit sweater in a traditional gansey pattern. In oatmeal, ecru and charcoal.',
  }),
  garment({
    handle: 'merino-crew',
    title: 'The Merino Crew',
    description:
      'A fine-gauge extra-fine merino crew that layers under a coat without bulk and works on its own in a warm room. Naturally temperature-regulating, barely wrinkles, and softer than anything with this much give has a right to be.',
    price: 125,
    sku: 'KES-MER',
    productType: 'Knitwear',
    category: 'knitwear',
    collections: ['the-knitwear-edit', 'the-essentials'],
    tags: ['knit', 'merino', 'layer'],
    colors: ['Camel', 'Navy', 'Charcoal'],
    asset: 'kestrel-prod-merino',
    seoTitle: 'The Merino Crew — extra-fine merino sweater | Kestrel',
    seoDescription: 'A fine-gauge extra-fine merino crew that layers without bulk. In camel, navy and charcoal.',
  }),
  garment({
    handle: 'wide-trouser',
    title: 'The Wide-Leg Trouser',
    description:
      'A high, clean-fronted trouser in a substantial wool-blend that drapes rather than clings — full through the leg, breaking just so over a shoe. Side adjusters instead of a belt, deep real pockets, and a press that holds all day.',
    price: 145,
    sku: 'KES-WIDE',
    productType: 'Trousers',
    category: 'trousers',
    collections: ['the-tailoring', 'new-in'],
    tags: ['trouser', 'wool', 'wide-leg'],
    colors: ['Stone', 'Charcoal', 'Navy'],
    asset: 'kestrel-prod-wide-trouser',
    seoTitle: 'The Wide-Leg Trouser — draped wool blend | Kestrel',
    seoDescription: 'A high, clean-fronted wide-leg trouser in a draping wool blend with side adjusters. In stone, charcoal and navy.',
  }),
  garment({
    handle: 'pleated-trouser',
    title: 'The Pleated Trouser',
    description:
      'A single-pleat tailored trouser that reads sharp without trying — tapered gently to the ankle, cut to sit at the natural waist. Dress it up with the oxford or down with the tee; it’s the trouser that quietly does both.',
    price: 135,
    sku: 'KES-PLT',
    productType: 'Trousers',
    category: 'trousers',
    collections: ['the-tailoring'],
    tags: ['trouser', 'pleated', 'tailored'],
    colors: ['Charcoal', 'Taupe', 'Black'],
    asset: 'kestrel-prod-pleated-trouser',
    seoTitle: 'The Pleated Trouser — single-pleat tailored | Kestrel',
    seoDescription: 'A single-pleat tailored trouser, gently tapered, cut to the natural waist. In charcoal, taupe and black.',
  }),
  garment({
    handle: 'overcoat',
    title: 'The Overcoat',
    description:
      'A double-faced wool overcoat with no lining and no bulk — just two layers of cloth stitched together and bound by hand at every edge. Roomy enough for a knit underneath, long enough to mean it. The one coat, done once, done right.',
    price: 450,
    sku: 'KES-COAT',
    productType: 'Outerwear',
    category: 'outerwear',
    collections: ['winter-layers', 'new-in'],
    tags: ['coat', 'wool', 'outerwear'],
    colors: ['Camel', 'Charcoal', 'Black'],
    asset: 'kestrel-prod-overcoat',
    seoTitle: 'The Overcoat — double-faced wool | Kestrel',
    seoDescription: 'An unlined double-faced wool overcoat, hand-bound at every edge. In camel, charcoal and black.',
  }),
  accessory({
    handle: 'wool-scarf',
    title: 'The Lambswool Scarf',
    description:
      'A generously long lambswool scarf, brushed soft and finished with a hand-knotted fringe. Wide enough to wrap twice, light enough to leave on indoors. The finishing piece for the coat, in colours that go with all of it.',
    price: 65,
    sku: 'KES-SCF',
    collections: ['winter-layers', 'the-essentials'],
    tags: ['scarf', 'lambswool', 'accessory'],
    colors: ['Oatmeal', 'Charcoal', 'Camel'],
    asset: 'kestrel-prod-scarf',
    seoTitle: 'The Lambswool Scarf — brushed soft, long | Kestrel',
    seoDescription: 'A generously long brushed-lambswool scarf with a hand-knotted fringe. In oatmeal, charcoal and camel.',
  }),
  accessory({
    handle: 'leather-tote',
    title: 'The Leather Tote',
    description:
      'A roomy vegetable-tanned leather tote, cut from a single hide and stitched to last — no hardware to fail, no lining to tear. It carries a laptop and a lunch, and it earns a patina the way good leather should. Buy it once.',
    price: 245,
    sku: 'KES-TOTE',
    collections: ['the-essentials'],
    tags: ['bag', 'leather', 'accessory'],
    colors: ['Tan', 'Black', 'Chocolate'],
    asset: 'kestrel-prod-tote',
    seoTitle: 'The Leather Tote — vegetable-tanned, unlined | Kestrel',
    seoDescription: 'A roomy vegetable-tanned leather tote, cut from a single hide, made to patina. In tan, black and chocolate.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'tops', name: 'Tops', description: 'Tees and shirts.', featured: true },
    { handle: 'knitwear', name: 'Knitwear', description: 'Sweaters and layers in good wool.', featured: true },
    { handle: 'trousers', name: 'Trousers', description: 'Tailored and relaxed cuts.', featured: true },
    { handle: 'outerwear', name: 'Outerwear', description: 'Coats and heavier layers.', featured: true },
    { handle: 'accessories', name: 'Accessories', description: 'The finishing pieces.', featured: false },
  ],
  collections: [
    {
      handle: 'the-essentials',
      name: 'The essentials',
      description: 'The core of the wardrobe — start here.',
      type: 'manual',
      featured: true,
      productHandles: ['everyday-tee', 'oxford-shirt', 'merino-crew', 'wool-scarf', 'leather-tote'],
    },
    {
      handle: 'new-in',
      name: 'New in',
      description: 'The latest cuts and colours.',
      type: 'manual',
      featured: true,
      productHandles: ['everyday-tee', 'wide-trouser', 'overcoat'],
    },
    {
      handle: 'the-knitwear-edit',
      name: 'The knitwear edit',
      description: 'Everything knitted, in one place.',
      type: 'manual',
      featured: false,
      productHandles: ['fisherman-knit', 'merino-crew'],
    },
    {
      handle: 'the-tailoring',
      name: 'The tailoring',
      description: 'Trousers cut to last.',
      type: 'manual',
      featured: false,
      productHandles: ['wide-trouser', 'pleated-trouser'],
    },
    {
      handle: 'winter-layers',
      name: 'Winter layers',
      description: 'Coats and heavy knits for the cold.',
      type: 'manual',
      featured: false,
      productHandles: ['overcoat', 'fisherman-knit', 'wool-scarf'],
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
    slug: 'the-case-for-fewer-clothes',
    status: 'published',
    body: {
      title: 'The case for fewer clothes',
      excerpt: 'A small wardrobe isn’t a sacrifice — it’s the thing that makes getting dressed easy. Here’s how to build one.',
      featuredImage: { $asset: 'kestrel-post-fewer' },
      body: {
        type: 'doc',
        content: [
          para('Most of us own far more than we wear. The wardrobe fills up, and somehow the choices shrink — you reach for the same handful of things and step around the rest. A capsule wardrobe just makes that honest: keep the few pieces you actually wear, in colours that all go together, and let everything else go.'),
          h2('One palette does the work'),
          para('The trick isn’t owning less for its own sake — it’s owning things that combine. Pick a narrow palette (we build ours from bone, stone, charcoal and camel) and suddenly any top goes with any trouser. You stop assembling outfits and start just getting dressed. Ten seconds, no misses, every morning.'),
          h2('Buy slowly, buy once'),
          para('A smaller wardrobe is only better if the pieces are good enough to lean on, so spend where it counts: dense cloth, real seams, a cut that flatters more than one body. Add one considered piece at a time rather than a haul you half-regret. Done right, you buy less often and wear each thing far longer — which is easier on both the wardrobe and the planet.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'how-to-read-a-fabric',
    status: 'published',
    body: {
      title: 'How to read a fabric',
      excerpt: 'Weight, weave and fibre tell you more about how a garment will wear than any label. A plain-language guide.',
      featuredImage: { $asset: 'kestrel-post-fabric' },
      body: {
        type: 'doc',
        content: [
          para('You can tell a lot about a garment before you ever try it on — if you know what to feel for. Fibre, weight and weave decide how a piece drapes, how warm it is, and whether it’ll still look right in five years. None of it is complicated once someone points it out.'),
          h2('Weight is the tell'),
          para('Pick a tee up and let it hang. A thin one folds to nothing and shows every line underneath; a heavyweight one has body, hangs cleanly, and lasts. Weight is measured in grams per square metre — higher means denser cloth. It’s the single best predictor of whether a basic will feel cheap or considered, and it costs more because there’s simply more of it.'),
          h2('Fibre decides the life'),
          para('Long-staple cottons pill less and soften rather than wear thin. Full wool breathes, resists odour, and springs back into shape — which is why a good knit outlasts a synthetic one many times over. Blends have their place for stretch and drape, but read the percentages: a trouser that’s mostly natural fibre with a little give behaves quite differently from one that’s mostly plastic.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'caring-for-knitwear',
    status: 'published',
    body: {
      title: 'Caring for knitwear so it lasts',
      excerpt: 'Good wool wants less washing, not more. A few small habits keep a sweater looking new for a decade.',
      featuredImage: { $asset: 'kestrel-post-care' },
      body: {
        type: 'doc',
        content: [
          para('The fastest way to wear out a sweater is to treat it like a t-shirt. Wool is naturally self-cleaning and odour-resistant, so it asks for far less than you’d think — and giving it less is exactly what keeps it looking new. A little care up front saves the piece for years.'),
          h2('Air more, wash less'),
          para('Most knits don’t need washing after every wear — an overnight air by an open window resets them. When it genuinely needs it, hand-wash in cool water with a wool-safe soap, or use a proper wool cycle. Never wring it: press the water out gently, then dry it flat on a towel, reshaped by hand. Hanging a wet knit stretches it out of shape for good.'),
          h2('Pills aren’t damage'),
          para('A little pilling where a sweater rubs — under the arms, at the cuffs — is normal, and it’s not a fault in the wool. A cheap fabric comb or a sweater stone takes it off in minutes and the knit looks new again. Store it folded, not hung, and give it a rest between wears so the fibres recover. Do that, and a good knit outlives most of what you own.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-apparel-minimal',
  key: 'sparx-retail-apparel-minimal',
  name: 'sparx — Fashion Boutique (Minimal)',
  theme: THEME,
  summary:
    'A complete, working shop for a quiet-luxury clothing boutique: a real wardrobe of essentials — tees, an oxford shirt, heavyweight and fine knitwear, tailored and wide-leg trousers, an overcoat, a scarf and a leather tote — each sized XS–XL in a tight colour palette, with categories, collections, a bespoke editorial PDP and a merchandised home page. Warm bone paper, near-black mono type, no accent — the clothes are the colour. Shipped as Kestrel.',
  tagline: 'An editorial storefront for a fashion boutique of essentials.',
  vertical: 'retail',
  industry: 'Clothing boutique',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 86,
  brand: {
    businessName: 'Kestrel',
    tagline: 'Fewer, better clothes.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: false },
  seo: {
    home: {
      title: 'Kestrel — well-made essentials, built to be kept',
      description:
        'Kestrel makes a small wardrobe of essentials in honest cloth — the tee, the knit, the trouser, the coat — cut to last and to wear together. Buy less, wear it longer.',
    },
    about: {
      title: 'About Kestrel — clothes that stay',
      description:
        'Why Kestrel keeps the range small: essentials in honest cloth, made directly with the mills and factory, priced honestly, cut to be kept for years.',
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
