// sparx-retail-apparel-street — a RETAIL/COMMERCE site template: a bold graphic-streetwear label.
//
// The LOUD counterpart to the quiet-luxury boutique (`gen-retail-apparel-minimal.ts`): where
// Kestrel whispers, Cardinal Supply shouts. A complete, working shop the moment it installs —
// a real rack of graphic tees, heavyweight fleece, cargo bottoms, a sherpa coaches jacket and
// accessories (every garment sized XS–XXL and offered in a handful of colours), categories +
// collections, a bespoke PDP, and the full 9-page commerce site (drop-forward home → shop →
// collections → cart → search → journal → about → contact). Dressed in an INLINE bespoke theme:
// a cool concrete ground, a near-black ink, and an electric CARDINAL RED that carries the whole
// brand — heavy grotesk display, big loud caps, drop culture. Shipped as Cardinal Supply.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries its OWN
// theme inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-apparel-street.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-apparel-street/**" \
//     "marketplace-catalog/_gen/gen-retail-apparel-street.ts"
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
// Loud streetwear: a cool CONCRETE ground (not white — the colour of a warehouse floor), a
// near-black ink, and one electric CARDINAL RED doing all the shouting. The red is the brand,
// used as the primary FILL (buttons, drop bands) and, held a touch darker, as the link/label
// INK on light grounds so it clears AA as text. A heavy industrial grotesk (Archivo) over a
// clean sans (Inter), hard square corners, zero depth — a screen-printed, high-contrast look.
// `error` shifts to crimson so the warm brand red and the warm warning never read as one signal.
// Complete light + dark, AA on every role (the blueprint sweep's contrast check is the gate).
const THEME = defineTheme({
  name: 'cardinal-bold',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.125rem', field: '0.125rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: ['oklch(96% 0.004 255)', 'oklch(93% 0.006 255)', 'oklch(87% 0.01 258)', 'oklch(17% 0.014 262)'],
    roles: {
      // primary is a FILL only (btn-primary, bg-primary drop bands) — bright electric red,
      // its white content resolved by silica. accent is the LINK/LABEL ink on light grounds,
      // so it is the same red held to ~47% L to clear 4.5:1 as text. secondary is a dark cool
      // slate, legible on the concrete ground.
      primary: 'oklch(57% 0.23 27)',
      secondary: 'oklch(40% 0.028 262)',
      accent: 'oklch(47% 0.2 27)',
      neutral: 'oklch(19% 0.014 262)',
      ...STATUS_ON_LIGHT,
      error: 'oklch(50% 0.2 12)',
    },
  },
  dark: {
    surfaces: ['oklch(16% 0.01 262)', 'oklch(13% 0.01 262)', 'oklch(10% 0.01 262)', 'oklch(95% 0.004 255)'],
    roles: {
      // On near-black the red stays the brand — bright as a fill, and lifted for legible link
      // ink. secondary inverts to a light slate.
      primary: 'oklch(62% 0.23 27)',
      secondary: 'oklch(75% 0.028 258)',
      accent: 'oklch(72% 0.2 27)',
      neutral: 'oklch(30% 0.014 262)',
      ...STATUS_ON_DARK,
      error: 'oklch(70% 0.18 12)',
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "cardinal-hero": "https://images.unsplash.com/photo-1780260989815-455e6afcc29f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bW9kZWwlMjByZWQlMjBncmFwaGljJTIwaG9vZGllJTIwYWdhaW5zdCUyMGNvbmNyZXRlJTIwd2FsbHxlbnwwfDB8fHwxNzg2NDAzNTgyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-tile-tops": "https://images.unsplash.com/photo-1768145488772-db787036bb13?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8cmFjayUyMGdyYXBoaWMlMjB0ZWVzJTIwcmFpbHxlbnwwfDB8fHwxNzg2NDAzNTg1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-tile-fleece": "https://images.unsplash.com/photo-1699275303942-47957eea44b1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwc3RhY2slMjBoZWF2eXdlaWdodCUyMGhvb2RpZXN8ZW58MHwwfHx8MTc4NjQwMzU4OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-tile-bottoms": "https://images.unsplash.com/photo-1563826830589-cd0946a9dc72?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8dXRpbGl0eSUyMGNhcmdvJTIwcGFudHN8ZW58MHwwfHx8MTc4NjQwMzk0OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-tile-accessories": "https://images.unsplash.com/photo-1574365569389-a10d488ca3fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2l4LXBhbmVsJTIwY2FwJTIwY2FudmFzJTIwdG90ZSUyMGNvbmNyZXRlfGVufDB8MHx8fDE3ODY0MDM1OTR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-band-drop": "https://images.unsplash.com/photo-1708185663693-1f0a0707904d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y3Jvd2QlMjBsaW5pbmclMjB1cCUyMHN0cmVldHdlYXIlMjBkcm9wfGVufDB8MHx8fDE3ODY0MDM1OTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-band-made": "https://images.unsplash.com/photo-1663433567177-9f94be0bff4c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2NyZWVuJTIwcHJpbnRlciUyMHB1bGxpbmclMjBpbmslMjBhY3Jvc3MlMjB0ZWV8ZW58MHwwfHx8MTc4NjQwMzYwMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-prod-logo-tee": "https://images.unsplash.com/photo-1718724089504-ed489d4cc396?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGVhdnl3ZWlnaHQlMjB0ZWUlMjBib2xkJTIwY2hlc3QlMjBsb2dvfGVufDB8MHx8fDE3ODY0MDM2MDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-prod-static-tee": "https://images.unsplash.com/photo-1621446511130-0ed6519bfeb6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z3JhcGhpYyUyMHRlZSUyMGRpc3RvcnRlZCUyMHN0YXRpYyUyMHByaW50fGVufDB8MHx8fDE3ODY0MDM2MDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-prod-hoodie": "https://images.unsplash.com/photo-1512400930990-e0bc0bd809df?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGVhdnl3ZWlnaHQlMjBwdWxsb3ZlciUyMGhvb2RpZXxlbnwwfDB8fHwxNzg2NDAzOTUyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-prod-crew": "https://images.unsplash.com/photo-1593733926335-bdec7f12acfd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94eSUyMGhlYXZ5d2VpZ2h0JTIwY3Jld25lY2slMjBzd2VhdHNoaXJ0fGVufDB8MHx8fDE3ODY0MDM2MTN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-prod-jacket": "https://images.unsplash.com/photo-1576775068668-c147f14c36f7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2hlcnBhLWxpbmVkJTIwY29hY2hlcyUyMGphY2tldHxlbnwwfDB8fHwxNzg2NDAzNjE3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-prod-cargo": "https://images.unsplash.com/photo-1776153627325-a5950e50b33a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpciUyMHV0aWxpdHklMjBjYXJnbyUyMHBhbnRzfGVufDB8MHx8fDE3ODY0MDM2MjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-prod-sweatpant": "https://images.unsplash.com/photo-1756662299903-2c4fc9dc263f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpciUyMGhlYXZ5d2VpZ2h0JTIwc3dlYXRwYW50c3xlbnwwfDB8fHwxNzg2NDAzNjI0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-prod-cap": "https://images.unsplash.com/photo-1645266729222-17cd32e06fd0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RydWN0dXJlZCUyMHNpeC1wYW5lbCUyMGNhcHxlbnwwfDB8fHwxNzg2NDAzNjI3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-prod-tote": "https://images.unsplash.com/photo-1630381260512-e3fe55c11973?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8aGVhdnklMjBjYW52YXMlMjB0b3RlJTIwYmFnJTIwcHJpbnRlZCUyMGxvZ298ZW58MHwwfHx8MTc4NjQwMzYzMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-prod-beanie": "https://images.unsplash.com/photo-1630691650107-53dd500d2907?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmliYmVkJTIwY3VmZmVkJTIwYmVhbmllfGVufDB8MHx8fDE3ODY0MDM2MzN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-post-drop": "https://images.unsplash.com/photo-1712903276048-6da8d45bd9fa?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJvZHVjdCUyMGxhaWQlMjBvdXR8ZW58MHwwfHx8MTc4NjQwMzk1NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-post-fit": "https://images.unsplash.com/photo-1598971861567-6005bbdebbf6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94eSUyMHRlZSUyMHNob3dufGVufDB8MHx8fDE3ODY0MDM5NTl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "cardinal-post-care": "https://images.unsplash.com/photo-1520434901111-8e9bcb42c628?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGVhdnl3ZWlnaHQlMjBnYXJtZW50cyUyMGRyeWluZyUyMGZsYXQlMjByYWNrfGVufDB8MHx8fDE3ODY0MDM2NDF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'cardinal-hero', url: src('cardinal-hero'), alt: 'A model in a red graphic hoodie against a concrete wall' },
  { id: 'cardinal-tile-tops', url: src('cardinal-tile-tops'), alt: 'A rack of graphic tees on a rail' },
  { id: 'cardinal-tile-fleece', url: src('cardinal-tile-fleece'), alt: 'A folded stack of heavyweight hoodies' },
  { id: 'cardinal-tile-bottoms', url: src('cardinal-tile-bottoms'), alt: 'A pair of utility cargo pants on a studio floor' },
  { id: 'cardinal-tile-accessories', url: src('cardinal-tile-accessories'), alt: 'A six-panel cap and a canvas tote on concrete' },
  { id: 'cardinal-band-drop', url: src('cardinal-band-drop'), alt: 'A crowd lining up for a streetwear drop' },
  { id: 'cardinal-band-made', url: src('cardinal-band-made'), alt: 'A screen printer pulling ink across a tee' },
  { id: 'cardinal-prod-logo-tee', url: src('cardinal-prod-logo-tee'), alt: 'A heavyweight tee with a bold chest logo' },
  { id: 'cardinal-prod-static-tee', url: src('cardinal-prod-static-tee'), alt: 'A graphic tee with a distorted static print' },
  { id: 'cardinal-prod-hoodie', url: src('cardinal-prod-hoodie'), alt: 'A heavyweight pullover hoodie in cardinal red' },
  { id: 'cardinal-prod-crew', url: src('cardinal-prod-crew'), alt: 'A boxy heavyweight crewneck sweatshirt' },
  { id: 'cardinal-prod-jacket', url: src('cardinal-prod-jacket'), alt: 'A sherpa-lined coaches jacket' },
  { id: 'cardinal-prod-cargo', url: src('cardinal-prod-cargo'), alt: 'A pair of utility cargo pants' },
  { id: 'cardinal-prod-sweatpant', url: src('cardinal-prod-sweatpant'), alt: 'A pair of heavyweight sweatpants' },
  { id: 'cardinal-prod-cap', url: src('cardinal-prod-cap'), alt: 'A structured six-panel cap' },
  { id: 'cardinal-prod-tote', url: src('cardinal-prod-tote'), alt: 'A heavy canvas tote bag with a printed logo' },
  { id: 'cardinal-prod-beanie', url: src('cardinal-prod-beanie'), alt: 'A ribbed cuffed beanie' },
  { id: 'cardinal-post-drop', url: src('cardinal-post-drop'), alt: 'Fresh product laid out ahead of a drop' },
  { id: 'cardinal-post-fit', url: src('cardinal-post-fit'), alt: 'A boxy tee shown on two different builds' },
  { id: 'cardinal-post-care', url: src('cardinal-post-care'), alt: 'Heavyweight garments drying flat on a rack' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-apparel-street: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one loud photograph with a SOLID CARDINAL-RED panel anchored
 *  bottom-left, huge uppercase headline, a black shop CTA + a text link. The panel is the
 *  brand colour itself, so the red does the shouting; text is never set on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('cardinal-hero'), alt: 'A model in a red graphic hoodie against concrete', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-2xl flex-col gap-5 rounded-box bg-primary p-8 @3xl:p-10', {
              children: [
                el('p', 'text-sm font-bold uppercase tracking-widest text-primary-content', {
                  text: 'Drop 07 — live now',
                }),
                el('h1', 'text-6xl font-bold uppercase leading-none tracking-tight text-primary-content @3xl:text-8xl', {
                  text: 'Wear it loud.',
                }),
                el('p', 'text-lg leading-relaxed text-primary-content', {
                  text: 'Cardinal Supply is heavyweight graphics for people who do not do quiet. Small runs, bold prints, built to take a beating — designed in the studio, printed by hand, gone when they are gone.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-neutral btn-lg', { attrs: { href: '/shop' }, text: 'Shop the drop' }),
                    el('a', 'text-base font-bold uppercase tracking-widest text-primary-content underline underline-offset-4', {
                      attrs: { href: '/collections' },
                      text: 'See collections',
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

/** One category tile — a square photo with a bold uppercase label beneath, the whole tile a
 *  link. */
function categoryTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
  return el('a', 'group flex flex-col gap-3', {
    attrs: { href: o.href },
    children: [
      el('img', 'aspect-square w-full rounded-box bg-base-200 object-cover transition group-hover:opacity-90', {
        attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
      }),
      el('span', 'text-center text-lg font-bold uppercase tracking-wide text-base-content', { text: o.label }),
    ],
  });
}

function categoryTiles(): Node {
  return el('section', 'bg-base-100 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
        children: [
          el('h2', 'text-4xl font-bold uppercase tracking-tight text-base-content @3xl:text-5xl', {
            text: 'Shop by category',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'cardinal-tile-tops', label: 'Tops', href: '/shop', alt: 'A rack of graphic tees' }),
              categoryTile({ assetId: 'cardinal-tile-fleece', label: 'Fleece', href: '/shop', alt: 'A stack of heavyweight hoodies' }),
              categoryTile({ assetId: 'cardinal-tile-bottoms', label: 'Bottoms', href: '/shop', alt: 'Utility cargo pants on a floor' }),
              categoryTile({ assetId: 'cardinal-tile-accessories', label: 'Accessories', href: '/shop', alt: 'A cap and a canvas tote' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A full-width SOLID black manifesto band — the loud beat between product rails. Big centred
 *  uppercase statement in white on near-black, one red CTA. No photo; the colour block IS the
 *  device. */
function manifestoBand(): Node {
  return el('section', 'bg-neutral @container px-6 py-20 text-center @3xl:py-28', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col items-center gap-6', {
        children: [
          el('h2', 'text-4xl font-bold uppercase leading-none tracking-tight text-neutral-content @3xl:text-6xl', {
            text: 'New heat every Friday.',
          }),
          el('p', 'text-lg leading-relaxed text-neutral-content', {
            text: 'We drop in small batches, weekly. No restocks, no reruns — when a print sells through, it is retired for good. Get on the list and you will know the second the next one lands.',
          }),
          el('a', 'btn btn-primary btn-lg', { attrs: { href: '/collections' }, text: 'Get on the list' }),
        ],
      }),
    ],
  });
}

/** A full-bleed editorial band — a photo carrying a bold uppercase heading, a lead and a link,
 *  panel bottom-left on the concrete ground. The link is the red accent ink (AA on light). */
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
                el('a', 'text-base font-bold uppercase tracking-widest text-accent underline underline-offset-4', {
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'The latest drop' }),
  categoryTiles(),
  manifestoBand(),
  productsBlock({ source: 'commerce.category.fleece', layout: 'carousel', heading: 'Fleece season' }),
  editorialBand({
    heading: 'Built heavy, on purpose',
    lead: 'Everything runs a proper weight — 240gsm tees, 400gsm fleece — cut boxy and printed with plastisol inks that crack the way you want them to, not the way that falls off in the wash. This is stuff made to get worn hard and worn often.',
    assetId: 'cardinal-band-made',
    cta: 'How it is made',
    href: '/blog/how-a-drop-comes-together',
    alt: 'A screen printer pulling ink across a tee',
  }),
  editorialBand({
    heading: 'Blink and it is gone',
    lead: 'Drops are small and they do not come back. If a piece is in stock, it is because it is still in stock — that is the whole game. Follow the list, move fast, and never explain the fit to anyone.',
    assetId: 'cardinal-band-drop',
    cta: 'Read the journal',
    href: '/blog/drop-culture-explained',
    alt: 'A crowd lining up for a streetwear drop',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, big uppercase title, price,
 *  low-stock, description, size/colour add-to-cart, a static "fit & fabric" note, and policy
 *  links). Hard corners, big type — the loud idiom, with the red buy button from the kit. */
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
                  el('p', 'text-sm font-bold uppercase tracking-widest text-secondary', {
                    text: 'Cardinal Supply',
                  }),
                  pdpTitle('h1', 'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl'),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-bold text-base-content',
                    compareClass: 'text-lg text-secondary line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 rounded-field bg-primary px-3 py-1 text-xs font-bold uppercase tracking-widest text-primary-content',
                    label: 'Almost gone',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-bold uppercase tracking-widest text-secondary', { text: 'Fit & fabric' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Cut boxy for a relaxed, modern fit — if you like it closer, size down; if you like it draped, stay true. Heavyweight cotton that softens with every wash and holds its shape. Model is 6ft in a size L.',
                  }),
                ],
              }),
              pdpPolicyLinks({
                className:
                  'flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-base-300 pt-5 text-sm font-bold uppercase tracking-widest text-base-content',
                linkClass: 'underline underline-offset-4',
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Complete the fit' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-7xl', {
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
    'Shop all',
    'Every piece we are running right now — graphic tees, heavyweight fleece, cargo bottoms, outerwear and accessories. Filter by category or size, sort however you like. When it sells through, it is gone, so do not sit on it.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead(
    'Collections',
    'The gear grouped the way you actually shop it — the latest drop, the pieces everyone is copping, the graphics, the fleece and the bottoms. Start wherever your fit needs work.'
  ),
];
const SEARCH: Node[] = [
  pageMasthead('Search', 'After a specific print, a size or a colour? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-7xl', { text: 'Your bag' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping over $75, and every order ships within two days. Sizing not sure? Free 30-day returns on unworn gear — grab two sizes and send back the one that misses.',
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
          el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-7xl', { text: 'The feed' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Behind the drops — how a print goes from sketch to rack, how our stuff fits, and how to keep heavyweight gear looking new. No filler, no gatekeeping.',
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
          el('h1', 'text-5xl font-bold uppercase tracking-tight text-base-content @2xl:text-6xl', { text: 'About Cardinal' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Cardinal Supply started with one screen, one squeegee and a garage full of blank tees. We were sick of graphic gear that looked hard online and fell apart in a month — thin blanks, prints that peeled, the same recycled design on everything. So we made the opposite.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Every drop is designed in-house and printed by hand in small runs on heavyweight blanks we choose ourselves. We would rather sell out of a hundred good pieces than warehouse a thousand mediocre ones — which is why nothing here gets restocked, and why the fit is worth moving fast for.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No licensing deals, no trend-chasing, no logo tax. Just loud, heavy, built-to-last gear from a small crew that actually wears it. If you know, you know.',
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
    heading: 'Get at us',
    intro: 'Question on a size, a fix on an order, or a wholesale/stockist enquiry? Hit us up and a real person from the crew will get back to you fast — usually same day.',
    submitLabel: 'Email the crew',
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

const SIZES = ['XS', 'S', 'M', 'L', 'XL', 'XXL'];
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
 *  colours that share a prefix (Concrete / Cardinal) never collide in a SKU. */
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

/** A garment — sized XS–XXL and offered in a set of colours; the Size × Color grid of
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
    vendor: 'Cardinal Supply',
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
    vendor: 'Cardinal Supply',
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
    handle: 'logo-tee',
    title: 'Cardinal Logo Tee',
    description:
      'The one that started it — a heavyweight 240gsm cotton tee with our bird mark screen-printed big across the chest in plastisol that will not peel. Boxy body, ribbed collar, dropped shoulder. Wears in, never wears out.',
    price: 44,
    sku: 'CARD-TEE-LOGO',
    productType: 'Apparel',
    category: 'tops',
    collections: ['new-drop', 'best-sellers', 'graphics'],
    tags: ['tee', 'graphic', 'heavyweight'],
    colors: ['Black', 'Bone', 'Cardinal'],
    asset: 'cardinal-prod-logo-tee',
    seoTitle: 'Cardinal Logo Tee — heavyweight graphic tee | Cardinal Supply',
    seoDescription: 'A boxy 240gsm cotton tee with a big screen-printed chest logo. In black, bone and cardinal red.',
  }),
  garment({
    handle: 'static-tee',
    title: 'Static Print Tee',
    description:
      'A glitched, blown-out static graphic printed edge to edge on the same heavyweight blank. Loud front, hit on the back, built to be the reason someone stops you on the street. Small run — when it is gone, it is gone.',
    price: 46,
    sku: 'CARD-TEE-STATIC',
    productType: 'Apparel',
    category: 'tops',
    collections: ['new-drop', 'graphics'],
    tags: ['tee', 'graphic', 'print'],
    colors: ['Black', 'White', 'Acid'],
    asset: 'cardinal-prod-static-tee',
    seoTitle: 'Static Print Tee — all-over graphic tee | Cardinal Supply',
    seoDescription: 'A blown-out static graphic on a heavyweight cotton blank, front and back. In black, white and acid.',
  }),
  garment({
    handle: 'heavyweight-hoodie',
    title: 'Heavyweight Hoodie',
    description:
      'A 400gsm brushed-back fleece pullover with a double-lined hood, boxy fit and heavy metal-tipped drawcords. The kind of hoodie that stands up on its own. Printed small so it reads clean under a jacket or loud on its own.',
    price: 98,
    sku: 'CARD-HOOD',
    productType: 'Fleece',
    category: 'fleece',
    collections: ['new-drop', 'best-sellers', 'fleece-shop'],
    tags: ['hoodie', 'fleece', 'heavyweight'],
    colors: ['Black', 'Ash', 'Cardinal'],
    asset: 'cardinal-prod-hoodie',
    seoTitle: 'Heavyweight Hoodie — 400gsm brushed fleece | Cardinal Supply',
    seoDescription: 'A 400gsm brushed-back fleece pullover with a double-lined hood and boxy fit. In black, ash and cardinal.',
  }),
  garment({
    handle: 'boxy-crewneck',
    title: 'Boxy Crewneck',
    description:
      'The hoodie’s quieter cousin — same 400gsm fleece, cropped a touch boxier, ribbed at the cuffs and hem so it sits right. Layer it, wear it solo, throw it under the coaches jacket. The workhorse of the fleece rack.',
    price: 88,
    sku: 'CARD-CREW',
    productType: 'Fleece',
    category: 'fleece',
    collections: ['fleece-shop', 'best-sellers'],
    tags: ['crewneck', 'fleece', 'heavyweight'],
    colors: ['Black', 'Bone', 'Forest'],
    asset: 'cardinal-prod-crew',
    seoTitle: 'Boxy Crewneck — 400gsm heavyweight fleece | Cardinal Supply',
    seoDescription: 'A boxy 400gsm fleece crewneck, ribbed at cuff and hem. In black, bone and forest.',
  }),
  garment({
    handle: 'coaches-jacket',
    title: 'Sherpa Coaches Jacket',
    description:
      'A classic snap-front coaches jacket lined with heavy sherpa — wind-blocking nylon shell, deep hand pockets, our mark embroidered at the chest and printed big across the back. The outer layer the whole fit is built around.',
    price: 148,
    sku: 'CARD-JKT',
    productType: 'Fleece',
    category: 'fleece',
    collections: ['new-drop', 'fleece-shop'],
    tags: ['jacket', 'outerwear', 'sherpa'],
    colors: ['Black', 'Concrete'],
    asset: 'cardinal-prod-jacket',
    seoTitle: 'Sherpa Coaches Jacket — snap-front, sherpa-lined | Cardinal Supply',
    seoDescription: 'A snap-front nylon coaches jacket with a heavy sherpa lining and back print. In black and concrete.',
  }),
  garment({
    handle: 'utility-cargo',
    title: 'Utility Cargo Pant',
    description:
      'A relaxed, tapered cargo in tough cotton twill — six real pockets, reinforced knees, an adjustable hem so you can stack them or crop them clean over a boot. Made to haul gear and take a season of abuse without blinking.',
    price: 118,
    sku: 'CARD-CARGO',
    productType: 'Bottoms',
    category: 'bottoms',
    collections: ['new-drop', 'bottoms-shop'],
    tags: ['cargo', 'pants', 'utility'],
    colors: ['Black', 'Olive', 'Concrete'],
    asset: 'cardinal-prod-cargo',
    seoTitle: 'Utility Cargo Pant — tapered cotton twill | Cardinal Supply',
    seoDescription: 'A tapered six-pocket cargo pant in tough cotton twill with an adjustable hem. In black, olive and concrete.',
  }),
  garment({
    handle: 'heavyweight-sweatpant',
    title: 'Heavyweight Sweatpant',
    description:
      'The bottom half of the fleece set — 400gsm brushed-back, tapered leg, ribbed cuff, deep zip pockets. Matches the hoodie and the crew colour for colour so you can run the full tracksuit or break it up.',
    price: 82,
    sku: 'CARD-SWEAT',
    productType: 'Bottoms',
    category: 'bottoms',
    collections: ['bottoms-shop', 'fleece-shop'],
    tags: ['sweatpant', 'fleece', 'heavyweight'],
    colors: ['Black', 'Ash', 'Cardinal'],
    asset: 'cardinal-prod-sweatpant',
    seoTitle: 'Heavyweight Sweatpant — 400gsm brushed fleece | Cardinal Supply',
    seoDescription: 'A tapered 400gsm fleece sweatpant with a ribbed cuff and zip pockets. In black, ash and cardinal.',
  }),
  accessory({
    handle: 'six-panel-cap',
    title: 'Six-Panel Cap',
    description:
      'A structured six-panel cap in heavy cotton twill with an embroidered bird mark, a curved brim broken in just enough, and a metal buckle strap. The finisher on any fit, in colours that go with all of it.',
    price: 38,
    sku: 'CARD-CAP',
    collections: ['new-drop', 'accessories-shop'],
    tags: ['cap', 'hat', 'accessory'],
    colors: ['Black', 'Concrete', 'Cardinal'],
    asset: 'cardinal-prod-cap',
    seoTitle: 'Six-Panel Cap — structured cotton twill | Cardinal Supply',
    seoDescription: 'A structured six-panel cap with an embroidered mark and buckle strap. In black, concrete and cardinal.',
  }),
  accessory({
    handle: 'canvas-tote',
    title: 'Heavy Canvas Tote',
    description:
      'A 16oz cotton-canvas tote with a big screen-printed logo, boxed corners and webbing straps built to carry a laptop, a change of gear and a six-pack without giving out. The bag that comes with you everywhere.',
    price: 34,
    sku: 'CARD-TOTE',
    collections: ['accessories-shop'],
    tags: ['tote', 'bag', 'accessory'],
    colors: ['Natural', 'Black'],
    asset: 'cardinal-prod-tote',
    seoTitle: 'Heavy Canvas Tote — 16oz printed cotton canvas | Cardinal Supply',
    seoDescription: 'A 16oz cotton-canvas tote with a big printed logo and webbing straps. In natural and black.',
  }),
  accessory({
    handle: 'cuffed-beanie',
    title: 'Cuffed Beanie',
    description:
      'A tight-knit ribbed beanie with a folded cuff and a woven bird tab — warm, low-profile, and the fastest way to finish a fit when it is cold. Runs true, stretches to fit, holds its shape wash after wash.',
    price: 30,
    sku: 'CARD-BEAN',
    collections: ['accessories-shop', 'new-drop'],
    tags: ['beanie', 'hat', 'accessory'],
    colors: ['Black', 'Ash', 'Cardinal', 'Forest'],
    asset: 'cardinal-prod-beanie',
    seoTitle: 'Cuffed Beanie — ribbed knit | Cardinal Supply',
    seoDescription: 'A tight ribbed cuffed beanie with a woven tab. In black, ash, cardinal and forest.',
  }),
];

const COMMERCE = {
  categories: [
    { handle: 'tops', name: 'Tops', description: 'Graphic tees and tops.', featured: true },
    { handle: 'fleece', name: 'Fleece', description: 'Hoodies, crews and outerwear.', featured: true },
    { handle: 'bottoms', name: 'Bottoms', description: 'Cargos and sweats.', featured: true },
    { handle: 'accessories', name: 'Accessories', description: 'Caps, bags and beanies.', featured: true },
  ],
  collections: [
    {
      handle: 'new-drop',
      name: 'The latest drop',
      description: 'Everything that just landed — move fast.',
      type: 'manual',
      featured: true,
      productHandles: ['logo-tee', 'static-tee', 'heavyweight-hoodie', 'coaches-jacket', 'utility-cargo', 'six-panel-cap', 'cuffed-beanie'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The pieces everyone is copping.',
      type: 'manual',
      featured: true,
      productHandles: ['logo-tee', 'heavyweight-hoodie', 'boxy-crewneck'],
    },
    {
      handle: 'graphics',
      name: 'Graphics',
      description: 'The printed tees, all in one place.',
      type: 'manual',
      featured: false,
      productHandles: ['logo-tee', 'static-tee'],
    },
    {
      handle: 'fleece-shop',
      name: 'Fleece',
      description: 'Heavyweight hoodies, crews and layers.',
      type: 'manual',
      featured: false,
      productHandles: ['heavyweight-hoodie', 'boxy-crewneck', 'coaches-jacket', 'heavyweight-sweatpant'],
    },
    {
      handle: 'bottoms-shop',
      name: 'Bottoms',
      description: 'Cargos and sweats built to take it.',
      type: 'manual',
      featured: false,
      productHandles: ['utility-cargo', 'heavyweight-sweatpant'],
    },
    {
      handle: 'accessories-shop',
      name: 'Accessories',
      description: 'Caps, totes and beanies to finish the fit.',
      type: 'manual',
      featured: false,
      productHandles: ['six-panel-cap', 'canvas-tote', 'cuffed-beanie'],
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
    slug: 'how-a-drop-comes-together',
    status: 'published',
    body: {
      title: 'How a drop comes together',
      excerpt: 'From a sketch on the studio wall to a rack of finished gear — the whole run, start to finish, in plain terms.',
      featuredImage: { $asset: 'cardinal-post-drop' },
      body: {
        type: 'doc',
        content: [
          para('A drop looks like it appears out of nowhere on a Friday. It does not. Every run is weeks of work compressed into a few hundred pieces — and because we print small and never restock, there is no room to get it wrong. Here is what actually happens between the idea and the rack.'),
          h2('Design, then subtract'),
          para('Everything starts on the studio wall — rough marker sketches, screenshots, half a dozen bad ideas pinned up until one earns its place. We design loud on purpose, then pull it back: a graphic has to read from across the street and still look right up close. Most concepts die here, and that is the point. The ones that survive get separated into colours for the screens.'),
          h2('Printed by hand, on good blanks'),
          para('We choose the blanks ourselves — 240gsm for tees, 400gsm for fleece, nothing thinner — because the best print in the world falls apart on a cheap shirt. Then every piece is screen-printed by hand with plastisol inks, cured hot so the graphic bonds to the cotton instead of sitting on top of it. It is slower than a factory and that is exactly why the prints last.'),
          h2('Small runs, gone for good'),
          para('We print what we print, and when it sells through, that design is retired — no reruns, no “back in stock.” It keeps the gear rare and it keeps us honest: if a run does not sell, we felt it, and we make a better one next week. That is the whole engine behind the Friday drop.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'how-our-stuff-fits',
    status: 'published',
    body: {
      title: 'How our stuff fits',
      excerpt: 'Boxy, dropped-shoulder, true to size — a plain-language guide to nailing your size the first time.',
      featuredImage: { $asset: 'cardinal-post-fit' },
      body: {
        type: 'doc',
        content: [
          para('Streetwear fit is half the look, and it trips people up more than anything else — mostly because “oversized” means something different on every brand. Here is exactly how ours is cut, so you can order once and get it right.'),
          h2('Cut boxy, worn relaxed'),
          para('Everything is cut boxy: a wider body, a dropped shoulder that sits below your actual shoulder, and a shorter, squarer length. On a true-to-size pick it wears relaxed, not baggy. If you want that clean, structured look, take your normal size. If you want it properly oversized and draped, size up one — a lot of people run their tees a size up on purpose.'),
          h2('When to size down'),
          para('The only time to size down is if you like your fits close and tailored, or if you are between two sizes and want a cleaner line. Fleece is cut roomy to layer, so if you are wearing a hoodie on its own and want it fitted, the smaller size is the move. Bottoms run true with a tapered leg — take your waist and adjust the hem to stack or crop.'),
          h2('Still not sure? Grab two'),
          para('Sizing is personal and a chart only gets you so far. Returns are free within 30 days on anything unworn with tags, so if you are stuck between two sizes, order both, try them back to back, and send back the one that misses. It is the fastest way to learn how our stuff sits on you.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'drop-culture-explained',
    status: 'published',
    body: {
      title: 'Drop culture, explained',
      excerpt: 'Why we release in small weekly batches and never restock — and how to actually cop the pieces you want.',
      featuredImage: { $asset: 'cardinal-post-care' },
      body: {
        type: 'doc',
        content: [
          para('If you are new to how streetwear releases work, the “drop” model can feel deliberately frustrating — limited pieces, no restocks, gone in an hour. It is not a marketing trick bolted on afterward. It is the honest consequence of how we make things, and once you get it, shopping this way is easy.'),
          h2('Why small and why weekly'),
          para('We print by hand in small runs, so there is a hard ceiling on how many of anything exists. Dropping weekly lets us keep the designs fresh, react to what sold and what did not, and never sit on a warehouse of dead stock. The scarcity is real — it is just how many we could actually make — not a fake counter ticking down.'),
          h2('How to actually cop'),
          para('Get on the drop list. It is the only place the exact drop time goes out, and popular pieces — the logo tee, the red hoodie — routinely sell through their best sizes within the first day. Save your details before Friday so checkout is one tap, decide your size ahead of time using the fit guide, and do not overthink it in the cart. Hesitation is how a size sells out while it sits in your bag.'),
          h2('Missed it? It happens'),
          para('No restocks means sometimes you miss, and that is part of the game — but a piece occasionally returns in a new colourway on a later drop, and the list always hears first. The best fix is simply to be ready for the next one. There is always a next one, seven days out.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-apparel-street',
  key: 'sparx-retail-apparel-street',
  name: 'Streetwear Label (Bold)',
  theme: THEME,
  summary:
    'A complete, working shop for a bold graphic-streetwear label: heavyweight graphic tees, 400gsm fleece hoodies and crews, a sherpa coaches jacket, utility cargos and sweats, plus caps, a tote and a beanie — each sized XS–XXL in a loud palette, with categories, collections, a bespoke drop-forward PDP and a merchandised home page. Cool concrete ground, near-black ink, one electric cardinal red carrying the brand — heavy grotesk, big caps, drop culture. Shipped as Cardinal Supply.',
  tagline: 'A loud, drop-driven storefront for a graphic-streetwear label.',
  vertical: 'retail',
  industry: 'Streetwear label',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 87,
  brand: {
    businessName: 'Cardinal Supply',
    tagline: 'Wear it loud.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Cardinal Supply — heavyweight graphic streetwear, dropped weekly',
      description:
        'Cardinal Supply makes loud, heavyweight graphic streetwear — hand-printed tees, 400gsm fleece and utility bottoms in small weekly drops that never restock. Wear it loud.',
    },
    about: {
      title: 'About Cardinal Supply — loud, heavy, hand-printed',
      description:
        'How Cardinal Supply works: designed in-house, screen-printed by hand on heavyweight blanks, released in small weekly drops that never come back. No logo tax, no filler.',
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
