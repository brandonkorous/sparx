// sparx-retail-tea-modern — a RETAIL/COMMERCE site template: a modern matcha & tea brand.
//
// A complete, working shop the moment it installs — a real catalogue of ceremonial and daily
// matcha (grade/size variants), functional blends (focus / calm / sleep), grab-and-go iced-tea
// sachets, a matcha starter kit, a bamboo whisk, a travel shaker tin and a flexible club
// subscription, with categories + collections, a bespoke product-forward PDP, and the full
// 9-page commerce site (merchandised home → shop → collections → cart → search → journal →
// about → contact), dressed in an INLINE bespoke theme (bright, energetic wellness-modern — a
// soft-mint near-white ground, a vibrant matcha-green primary, a punchy coral accent, a clean
// grotesk over a humanist sans). Shipped as Matcha Club — the bright, contemporary counterpart
// to the calm botanical tea room.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme inline
// and passes it on the spec (`theme`), so the whole family can be authored in parallel without
// two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-tea-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-tea-modern/**" \
//     "marketplace-catalog/_gen/gen-retail-tea-modern.ts"
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
// Bright, energetic wellness-modern: a soft-mint near-white ground (a fresh, awake page, not a
// dead white), a deep green-tea ink, a VIBRANT matcha-green primary carried as a bold fill/panel,
// and a punchy coral accent for links and pops. A clean grotesk display over a humanist sans —
// contemporary, product-forward, the opposite of the serene serif tea room. Complete light +
// dark, AA on every role (the blueprint sweep's contrast check is the gate); `secondary` and
// `accent` stay dark enough (≤ ~50% L) to read as ink where the pages set them as text over the
// light ground.
const THEME = defineTheme({
  name: 'matcha-modern',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: ['oklch(98% 0.016 150)', 'oklch(95% 0.024 148)', 'oklch(90% 0.032 146)', 'oklch(24% 0.04 156)'],
    roles: {
      primary: 'oklch(52% 0.15 146)',
      secondary: 'oklch(44% 0.06 152)',
      accent: 'oklch(50% 0.18 34)',
      neutral: 'oklch(27% 0.035 156)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(20% 0.03 156)', 'oklch(17% 0.028 156)', 'oklch(14% 0.024 156)', 'oklch(96% 0.02 150)'],
    roles: {
      primary: 'oklch(80% 0.16 146)',
      secondary: 'oklch(80% 0.06 152)',
      accent: 'oklch(74% 0.17 36)',
      neutral: 'oklch(32% 0.03 156)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "matcha-hero": "https://images.unsplash.com/photo-1566373049939-704ea187ef98?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwYm93bCUyMHdoaXNrZWQlMjBtYXRjaGElMjBmcm90aGluZyUyMGJlc2lkZSUyMGJhbWJvb3xlbnwwfDB8fHwxNzg2NDE2MTMwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-matcha": "https://images.unsplash.com/photo-1708573106073-e27e43ec7fda?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dml2aWQlMjBncmVlbiUyMG1hdGNoYSUyMHBvd2RlciUyMHNpZnRlZCUyMGludG8lMjBzbWFsbHxlbnwwfDB8fHwxNzg2NDE2MTMzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-blends": "https://images.unsplash.com/photo-1680431217569-dff801acc0bf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bG9vc2UlMjBmdW5jdGlvbmFsJTIwdGVhJTIwYmxlbmQlMjBkcmllZCUyMGJvdGFuaWNhbHMlMjBzY29vcHxlbnwwfDB8fHwxNzg2NDE2MTM2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-kits": "https://images.unsplash.com/photo-1764512679985-ad1eb8d58cc4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFtYm9vJTIwd2hpc2slMjBzY29vcCUyMG1hdGNoYSUyMGJvd2wlMjBsYWlkJTIwb3V0fGVufDB8MHx8fDE3ODY0MTYxMzl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tile-sub": "https://images.unsplash.com/photo-1668127039852-0e7c8b3a1601?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBicmlnaHQlMjBtYXRjaGElMjB0aW5zJTIwdGllZCUyMHJpYmJvbnxlbnwwfDB8fHwxNzg2NDE2MTQzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "band-ceremonial": "https://images.unsplash.com/photo-1589698272390-0501a07619bb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2hpc2tpbmclMjBtYXRjaGElMjBicmlnaHQlMjBqYWRlJTIwZnJvdGglMjB3aWRlJTIwYm93bHxlbnwwfDB8fHwxNzg2NDE2MTQ2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "band-club": "https://images.unsplash.com/photo-1755685682321-d4a38aa26214?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFyY2VsJTIwbWF0Y2hhJTIwdGluc3xlbnwwfDB8fHwxNzg2NDE2MzEyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-ceremonial": "https://images.unsplash.com/photo-1624893464636-c122891445c6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Nnx8dGluJTIwY2VyZW1vbmlhbC1ncmFkZSUyMG1hdGNoYXxlbnwwfDB8fHwxNzg2NDE2MTUxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-daily": "https://images.unsplash.com/photo-1753617868081-a0ff513695a5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8dGluJTIwZGFpbHklMjBldmVyeWRheSUyMG1hdGNoYXxlbnwwfDB8fHwxNzg2NDE2MTU1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-focus": "https://images.unsplash.com/photo-1565802700474-1c8b57596859?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8dGluJTIwZm9jdXMlMjBmdW5jdGlvbmFsJTIwbWF0Y2hhJTIwYmxlbmR8ZW58MHwwfHx8MTc4NjQxNjE1OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-calm": "https://images.unsplash.com/photo-1580437017351-75766a55c1ad?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGluJTIwY2FsbSUyMGZ1bmN0aW9uYWx8ZW58MHwwfHx8MTc4NjQxNjMxNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-iced": "https://images.unsplash.com/photo-1722970782490-55e4bcacec68?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwZ3JhYi1hbmQtZ28lMjBpY2VkJTIwbWF0Y2hhJTIwc2FjaGV0c3xlbnwwfDB8fHwxNzg2NDE2MTY2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-kit": "https://images.unsplash.com/photo-1522160196-1a0efa63778d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8NHx8bWF0Y2hhJTIwc3RhcnRlciUyMGtpdCUyMHdoaXNrJTIwYm93bCUyMHNjb29wfGVufDB8MHx8fDE3ODY0MTYxNjl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-whisk": "https://images.unsplash.com/photo-1613641014814-498411d28156?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZG1hZGUlMjBiYW1ib28lMjBtYXRjaGElMjB3aGlza3xlbnwwfDB8fHwxNzg2NDE2MTcyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-shaker": "https://images.unsplash.com/photo-1645535956958-2ef0ba30566b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJhdmVsJTIwc2hha2VyJTIwdGluJTIwaWNlZCUyMG1hdGNoYSUyMGdvfGVufDB8MHx8fDE3ODY0MTYxNzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subscription": "https://images.unsplash.com/photo-1755184108643-a8ee184ce542?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8bWF0Y2hhJTIwY2x1YiUyMHN1YnNjcmlwdGlvbnxlbnwwfDB8fHwxNzg2NDE2MzIwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-whisk": "https://images.unsplash.com/photo-1753009712810-3f72c3f72548?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZCUyMHdoaXNraW5nJTIwbWF0Y2hhJTIwYm93bCUyMGJyaWdodCUyMGxpZ2h0fGVufDB8MHx8fDE3ODY0MTYxODF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-focus": "https://images.unsplash.com/photo-1714691602679-3741ad42d836?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhc3MlMjBpY2VkJTIwbWF0Y2hhJTIwYnJpZ2h0JTIwZGVzayUyMGJlc2lkZSUyMGxhcHRvcHxlbnwwfDB8fHwxNzg2NDE2MTg1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-grade": "https://images.unsplash.com/photo-1708572727896-117b5ea25a86?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHdvJTIwYm93bHMlMjBtYXRjaGElMjBzaWRlJTIwYnklMjBzaWRlJTIwc2hvd2luZ3xlbnwwfDB8fHwxNzg2NDE2MTg4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'matcha-hero', url: src('matcha-hero'), alt: 'A bright bowl of whisked matcha frothing beside a bamboo whisk' },
  { id: 'tile-matcha', url: src('tile-matcha'), alt: 'Vivid green matcha powder sifted into a small bowl' },
  { id: 'tile-blends', url: src('tile-blends'), alt: 'Loose functional tea blend with dried botanicals in a scoop' },
  { id: 'tile-kits', url: src('tile-kits'), alt: 'A bamboo whisk, scoop and matcha bowl laid out on a counter' },
  { id: 'tile-sub', url: src('tile-sub'), alt: 'A stack of bright matcha tins tied with a ribbon' },
  { id: 'band-ceremonial', url: src('band-ceremonial'), alt: 'Whisking matcha to a bright jade froth in a wide bowl' },
  { id: 'band-club', url: src('band-club'), alt: 'A parcel of matcha tins on a sunny doorstep' },
  { id: 'prod-ceremonial', url: src('prod-ceremonial'), alt: 'A tin of ceremonial-grade matcha' },
  { id: 'prod-daily', url: src('prod-daily'), alt: 'A tin of daily everyday matcha' },
  { id: 'prod-focus', url: src('prod-focus'), alt: 'A tin of the Focus functional matcha blend' },
  { id: 'prod-calm', url: src('prod-calm'), alt: 'A tin of the Calm functional herbal blend' },
  { id: 'prod-sleep', url: src('prod-sleep'), alt: 'A tin of the Sleep caffeine-free herbal blend' },
  { id: 'prod-iced', url: src('prod-iced'), alt: 'A box of grab-and-go iced matcha sachets' },
  { id: 'prod-kit', url: src('prod-kit'), alt: 'A matcha starter kit with whisk, bowl and scoop' },
  { id: 'prod-whisk', url: src('prod-whisk'), alt: 'A handmade bamboo matcha whisk' },
  { id: 'prod-shaker', url: src('prod-shaker'), alt: 'A travel shaker tin for iced matcha on the go' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A matcha club subscription box of tins' },
  { id: 'post-whisk', url: src('post-whisk'), alt: 'A hand whisking matcha in a bowl in bright light' },
  { id: 'post-focus', url: src('post-focus'), alt: 'A glass of iced matcha on a bright desk beside a laptop' },
  { id: 'post-grade', url: src('post-grade'), alt: 'Two bowls of matcha side by side showing different shades of green' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-tea-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one bright photograph and a BOLD matcha-green panel anchored
 *  bottom-left carrying a grotesk headline, a lead and a punchy coral CTA + a text link.
 *  The panel is a solid primary fill (never ink on the photo), which is the modern,
 *  energetic move that sets this brand apart from the calm neutral-panel tea room. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('matcha-hero'), alt: 'A bright bowl of whisked matcha', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-primary p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-primary-content @3xl:text-6xl', {
                  text: 'Ceremonial matcha, made for your morning.',
                }),
                el('p', 'text-lg leading-relaxed text-primary-content', {
                  text: 'Matcha Club is a modern matcha and tea brand. We source stone-ground matcha and functional blends, whisk-test every batch, and ship it bright and fresh — so your daily cup does more than wake you up.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-accent btn-lg', { attrs: { href: '/shop' }, text: 'Shop matcha' }),
                    el('a', 'text-base font-semibold text-primary-content underline underline-offset-4', {
                      attrs: { href: '/shop/subscription' },
                      text: 'Join the club',
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

/** One category tile — a photo with a bold label beneath, the whole tile a link. */
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
            text: 'Pick your ritual',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'tile-matcha', label: 'Matcha', href: '/shop', alt: 'Vivid green matcha powder in a bowl' }),
              categoryTile({ assetId: 'tile-blends', label: 'Functional blends', href: '/shop', alt: 'A loose functional tea blend in a scoop' }),
              categoryTile({ assetId: 'tile-kits', label: 'Kits & tools', href: '/shop', alt: 'A bamboo whisk, scoop and bowl' }),
              categoryTile({ assetId: 'tile-sub', label: 'Subscription', href: '/shop/subscription', alt: 'A stack of bright matcha tins' }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A full-bleed editorial band — a photo carrying a heading, a lead and a link in a solid
 *  panel bottom-left. `tone: 'primary'` swaps the neutral panel for a bold matcha-green fill
 *  (used for the club close), so the page reads as energetic without ever inking on the photo. */
function editorialBand(o: {
  heading: string;
  lead: string;
  assetId: string;
  cta: string;
  href: string;
  alt: string;
  tone?: 'panel' | 'primary';
}): Node {
  const primary = o.tone === 'primary';
  const panelClass = primary
    ? 'flex max-w-xl flex-col gap-4 rounded-box bg-primary p-8 @3xl:p-10'
    : 'flex max-w-xl flex-col gap-4 rounded-box bg-base-100 p-8 @3xl:p-10';
  const headClass = primary
    ? 'text-4xl font-bold leading-none tracking-tight text-primary-content @3xl:text-5xl'
    : 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl';
  const leadClass = primary
    ? 'text-lg leading-relaxed text-primary-content'
    : 'text-lg leading-relaxed text-base-content';
  const ctaClass = primary
    ? 'text-base font-semibold text-primary-content underline underline-offset-4'
    : 'text-base font-semibold text-accent underline underline-offset-4';
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
            el('div', panelClass, {
              children: [
                el('h2', headClass, { text: o.heading }),
                el('p', leadClass, { text: o.lead }),
                el('a', ctaClass, { attrs: { href: o.href }, text: o.cta }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'This week’s drop' }),
  editorialBand({
    heading: 'Ceremonial grade, no chalk',
    lead: 'We buy shade-grown leaf and stone-grind it into a bright, sweet matcha that whisks up smooth — none of the flat, chalky bitterness that gives cheap powder a bad name. Every batch is whisk-tested before it’s tinned, so the bowl you make is the bowl we tasted.',
    assetId: 'band-ceremonial',
    cta: 'What ceremonial grade means',
    href: '/blog/what-ceremonial-grade-means',
    alt: 'Whisking matcha to a bright jade froth',
  }),
  productsBlock({ source: 'commerce.category.blends', layout: 'carousel', heading: 'Functional blends' }),
  editorialBand({
    heading: 'Your cup, on autopilot',
    lead: 'The club is the easy way to never run out: pick your matcha and blends, pick how often, and they land bright and fresh on your schedule. Rotate the whole shelf or stay with your daily — skip, swap or cancel any time, no lock-in.',
    assetId: 'band-club',
    cta: 'Join the club',
    href: '/shop/subscription',
    alt: 'A parcel of matcha tins on a sunny doorstep',
    tone: 'primary',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static "how to make it" note, and policy links). */
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
                    text: 'Matcha Club',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'How to make it' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Sift one teaspoon into a bowl, add a splash of water just off the boil — around 70°C, not boiling — and whisk in a brisk W until it froths. Top with hot or cold water, or pour over ice and milk for a latte. Blends steep like any tea: one teaspoon, three minutes, taste as you go.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Goes with' });

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
    'Shop everything',
    'The whole shelf, right now — ceremonial and daily matcha, functional focus, calm and sleep blends, grab-and-go iced sachets, and the tools to whisk it all. Filter by type or caffeine, or sort however you like; it all ships bright and fresh from small batches.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The shelf grouped the way people actually drink it — the club’s picks, the everyday best sellers, the functional blends by mood, and starter kits for a brand-new matcha habit.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Matcha Club', 'Looking for a grade, a mood, or a how-to? Search the whole shelf and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $40, and every tin is filled from a small fresh batch and sent within two days. Not sure a matcha is for you? Tell us and we’ll make it right — your daily cup should be a bright spot, never a gamble.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Matcha Club journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the whisk — how to make a smooth bowl, why matcha wakes you up without the crash, and what the grades on the tin actually mean. Bright, useful, no wellness jargon.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Matcha Club' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Matcha Club started with a simple frustration: the good matcha was hard to find and the easy matcha was chalky, dull and half-stale. So we went straight to the source, found shade-grown leaf worth grinding, and built a modern brand around one idea — a bright, functional cup that actually earns a place in your morning.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We work with growers and mills we can name, and we pay above the commodity rate because the people who tend these fields deserve a living from them. Then we grind and blend in small batches, whisk-test every one, and only tin what tastes as bright as it looks.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No dusty green powder, no mystery blends, no wellness theatre. Just genuinely good matcha and functional tea, handled with care from the field to your bowl — and made to fit an ordinary, busy day.',
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
    intro: 'A question about a grade, a wholesale enquiry, or want us to blend for your café or studio? Tell us what you’re after and a real person at Matcha Club will get back to you.',
    submitLabel: 'Email the club',
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

// Matcha comes in a starter and a stock-up size.
const SIZE_30_100: OptionDecl = {
  name: 'Size',
  displayType: 'dropdown',
  values: [{ value: '30g tin' }, { value: '100g tin' }],
};
// Functional blends come loose in a tin or pre-portioned in biodegradable sachets.
const FORMAT: OptionDecl = {
  name: 'Format',
  displayType: 'dropdown',
  values: [{ value: 'Loose tin' }, { value: 'Sachets' }],
};

const matcha = (opts: {
  handle: string;
  title: string;
  description: string;
  price: number;
  price100: number;
  sku: string;
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
  productType: 'Matcha',
  vendor: 'Matcha Club',
  tags: opts.tags,
  categoryHandles: opts.categories,
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [SIZE_30_100],
  variants: [
    { sku: `${opts.sku}-30`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '30g tin' } },
    { sku: `${opts.sku}-100`, priceCents: money(opts.price100), inventoryPolicy: 'continue', optionValues: { Size: '100g tin' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const blend = (opts: {
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
}): Product => ({
  handle: opts.handle,
  title: opts.title,
  description: opts.description,
  status: 'active',
  productType: 'Tea blend',
  vendor: 'Matcha Club',
  tags: opts.tags,
  categoryHandles: opts.categories,
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [FORMAT],
  variants: [
    { sku: `${opts.sku}-LT`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Format: 'Loose tin' } },
    { sku: `${opts.sku}-SC`, priceCents: money(opts.price + 2), inventoryPolicy: 'continue', optionValues: { Format: 'Sachets' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const PRODUCTS: Product[] = [
  matcha({
    handle: 'ceremonial-matcha',
    title: 'Ceremonial Matcha',
    description:
      'Our flagship: first-harvest, shade-grown leaf from Uji, stone-ground to a fine, vivid powder that whisks up smooth and sweet. Vegetal and umami-rich with a clean, lingering finish and zero chalk — the bowl to drink straight, whisked with water. Grade you can taste, in a starter or a stock-up size.',
    price: 32,
    price100: 88,
    sku: 'MC-MAT-CER',
    categories: ['matcha'],
    collections: ['club-picks', 'best-sellers', 'matcha-flight'],
    tags: ['matcha', 'ceremonial', 'single-origin', 'caffeinated'],
    asset: 'prod-ceremonial',
    seoTitle: 'Ceremonial Matcha — first-harvest Uji matcha | Matcha Club',
    seoDescription: 'Shade-grown, stone-ground ceremonial matcha from Uji — bright, sweet, umami-rich, no chalk. Whisk and drink.',
  }),
  matcha({
    handle: 'daily-matcha',
    title: 'Daily Matcha',
    description:
      'The everyday workhorse — a second-harvest matcha built for lattes, smoothies and iced cups you drink all week. A little bolder and more astringent than the ceremonial, so it holds its own against milk and ice without disappearing. Great value, brilliant colour, made to be used generously.',
    price: 24,
    price100: 62,
    sku: 'MC-MAT-DAILY',
    categories: ['matcha'],
    collections: ['club-picks', 'matcha-flight', 'best-sellers'],
    tags: ['matcha', 'everyday', 'latte', 'caffeinated'],
    asset: 'prod-daily',
    seoTitle: 'Daily Matcha — everyday latte-grade matcha | Matcha Club',
    seoDescription: 'A bold, vivid everyday matcha built for lattes, smoothies and iced cups. Holds up to milk and ice.',
  }),
  blend({
    handle: 'focus-blend',
    title: 'Focus',
    description:
      'Matcha plus guayusa and a whisper of peppermint — a clean, steady lift with the L-theanine calm that keeps caffeine from turning into jitters. The cup for a deep-work morning: alert, even, and gone by mid-afternoon so it doesn’t follow you to bed.',
    price: 18,
    sku: 'MC-BLD-FOCUS',
    categories: ['blends'],
    collections: ['functional', 'best-sellers', 'club-picks'],
    tags: ['blend', 'functional', 'focus', 'caffeinated'],
    asset: 'prod-focus',
    seoTitle: 'Focus — matcha & guayusa functional blend | Matcha Club',
    seoDescription: 'Matcha with guayusa and peppermint for a clean, steady, jitter-free lift. The deep-work cup.',
  }),
  blend({
    handle: 'calm-blend',
    title: 'Calm',
    description:
      'A daytime unwind — green tea softened with lemon balm, rose and a little chamomile, gently caffeinated so it takes the edge off without knocking you out. The cup for the 3pm dip, a busy inbox, or any hour that needs the volume turned down a notch.',
    price: 18,
    sku: 'MC-BLD-CALM',
    categories: ['blends'],
    collections: ['functional'],
    tags: ['blend', 'functional', 'calm', 'caffeinated'],
    asset: 'prod-calm',
    seoTitle: 'Calm — green tea & lemon balm blend | Matcha Club',
    seoDescription: 'Green tea with lemon balm, rose and chamomile — a gentle daytime unwind, lightly caffeinated.',
  }),
  blend({
    handle: 'sleep-blend',
    title: 'Sleep',
    description:
      'A caffeine-free wind-down of chamomile, valerian, lavender and a touch of liquorice root — softly floral and naturally sweet, built for the last hour of the day. No matcha, no caffeine, no next-morning fog; just a warm cup that tells your body it’s time to stop.',
    price: 18,
    sku: 'MC-BLD-SLEEP',
    categories: ['blends'],
    collections: ['functional'],
    tags: ['blend', 'functional', 'sleep', 'caffeine-free', 'evening'],
    asset: 'prod-sleep',
    seoTitle: 'Sleep — caffeine-free chamomile & valerian blend | Matcha Club',
    seoDescription: 'Chamomile, valerian, lavender and liquorice — a caffeine-free wind-down for the end of the day.',
  }),
  {
    handle: 'iced-matcha-sachets',
    title: 'Iced Matcha Sachets',
    description:
      'Cold-whisk matcha, pre-portioned for the shaker — tear a sachet into cold water or milk, shake, pour over ice, done. The same vivid daily matcha, formulated to dissolve cold without clumping, so a café-grade iced matcha takes fifteen seconds at your desk or in the car.',
    status: 'active',
    productType: 'Matcha',
    vendor: 'Matcha Club',
    tags: ['matcha', 'iced', 'grab-and-go', 'caffeinated'],
    categoryHandles: ['iced'],
    collectionHandles: ['best-sellers', 'club-picks'],
    seoTitle: 'Iced Matcha Sachets — cold-whisk grab-and-go matcha | Matcha Club',
    seoDescription: 'Pre-portioned cold-dissolve matcha sachets — tear, shake over ice, drink. Café-grade iced matcha in seconds.',
    options: [{ name: 'Pack', displayType: 'dropdown', values: [{ value: '10 sachets' }, { value: '30 sachets' }] }],
    variants: [
      { sku: 'MC-ICED-10', priceCents: money(16), isDefault: true, inventoryPolicy: 'continue', optionValues: { Pack: '10 sachets' } },
      { sku: 'MC-ICED-30', priceCents: money(40), inventoryPolicy: 'continue', optionValues: { Pack: '30 sachets' } },
    ],
    images: [{ assetId: 'prod-iced', isPrimary: true, alt: 'A box of iced matcha sachets' }],
  },
  {
    handle: 'matcha-starter-kit',
    title: 'The Starter Kit',
    description:
      'Everything to make a proper bowl from day one — a tin of our ceremonial matcha, a handmade bamboo whisk, a bamboo scoop and a wide ceramic bowl, boxed together. The easiest way to begin, and a genuinely lovely thing to give someone who keeps saying they should get into matcha.',
    status: 'active',
    productType: 'Kit',
    vendor: 'Matcha Club',
    tags: ['kit', 'gift', 'starter', 'tools'],
    categoryHandles: ['kits-tools'],
    collectionHandles: ['everyday-kit', 'gifts', 'club-picks'],
    seoTitle: 'The Starter Kit — matcha, whisk, scoop & bowl | Matcha Club',
    seoDescription: 'Ceremonial matcha, a bamboo whisk, a scoop and a ceramic bowl, boxed together. The easiest way to start.',
    variants: [{ sku: 'MC-KIT-START', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-kit', isPrimary: true, alt: 'A matcha starter kit' }],
  },
  {
    handle: 'bamboo-whisk',
    title: 'Bamboo Whisk (Chasen)',
    description:
      'A traditional hand-cut bamboo chasen with a hundred fine tines — the tool that turns clumpy powder into a smooth, even froth no spoon or shaker can match. Rest it on a whisk stand to keep its shape and it’ll make a better bowl for months. The one upgrade that changes every cup.',
    status: 'active',
    productType: 'Tool',
    vendor: 'Matcha Club',
    tags: ['tools', 'whisk', 'bamboo'],
    categoryHandles: ['kits-tools'],
    collectionHandles: ['everyday-kit', 'gifts'],
    seoTitle: 'Bamboo Whisk (Chasen) — hand-cut matcha whisk | Matcha Club',
    seoDescription: 'A traditional hand-cut bamboo chasen with a hundred fine tines for a smooth, even matcha froth.',
    variants: [{ sku: 'MC-TOOL-WHISK', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-whisk', isPrimary: true, alt: 'A bamboo matcha whisk' }],
  },
  {
    handle: 'travel-shaker-tin',
    title: 'Travel Shaker Tin',
    description:
      'A slim, leak-proof stainless shaker with a fine internal strainer — add a sachet or a scoop, splash in cold water, shake, and drink from the same tin. Fits a cup holder and a coat pocket, keeps matcha cold for hours, and makes an iced cup anywhere the day takes you.',
    status: 'active',
    productType: 'Tool',
    vendor: 'Matcha Club',
    tags: ['tools', 'travel', 'shaker', 'iced'],
    categoryHandles: ['kits-tools'],
    collectionHandles: ['everyday-kit'],
    seoTitle: 'Travel Shaker Tin — leak-proof matcha shaker | Matcha Club',
    seoDescription: 'A slim leak-proof stainless shaker with a fine strainer — make and drink an iced matcha anywhere.',
    variants: [{ sku: 'MC-TOOL-SHAKER', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-shaker', isPrimary: true, alt: 'A travel shaker tin' }],
  },
  {
    handle: 'subscription',
    title: 'The Club Subscription',
    description:
      'Fresh matcha on your schedule — pick your tins and how often, and we grind, blend and ship them to match. Rotate the whole shelf or stay with your daily; members get first access to new drops and a standing discount. Skip, swap or cancel any time. The easiest way to keep good matcha in the house.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Matcha Club',
    tags: ['subscription', 'gift', 'club'],
    categoryHandles: ['subscription'],
    collectionHandles: ['club-picks', 'gifts', 'best-sellers'],
    seoTitle: 'The Club Subscription — fresh matcha, on your schedule | Matcha Club',
    seoDescription: 'A flexible matcha subscription — choose tins and cadence, get first access to drops. Skip or cancel any time.',
    options: [{ name: 'Plan', displayType: 'dropdown', values: [{ value: 'One tin' }, { value: 'Two tins' }] }],
    variants: [
      { sku: 'MC-SUB-1', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: 'One tin' } },
      { sku: 'MC-SUB-2', priceCents: money(40), inventoryPolicy: 'continue', optionValues: { Plan: 'Two tins' } },
    ],
    images: [{ assetId: 'prod-subscription', isPrimary: true, alt: 'A matcha club subscription box' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'matcha', name: 'Matcha', description: 'Ceremonial and daily stone-ground matcha.', featured: true },
    { handle: 'blends', name: 'Functional blends', description: 'Focus, calm and sleep, by mood.', featured: true },
    { handle: 'iced', name: 'Iced & to-go', description: 'Cold-whisk sachets for the shaker.', featured: true },
    { handle: 'kits-tools', name: 'Kits & tools', description: 'Whisks, bowls, shakers and starter kits.', featured: true },
    { handle: 'subscription', name: 'Subscription', description: 'Fresh matcha on your schedule.', featured: false },
  ],
  collections: [
    {
      handle: 'club-picks',
      name: 'The club’s picks',
      description: 'Where to start — the drops we’d put in your first box.',
      type: 'manual',
      featured: true,
      productHandles: ['ceremonial-matcha', 'daily-matcha', 'focus-blend', 'matcha-starter-kit', 'subscription'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The cups people come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['ceremonial-matcha', 'daily-matcha', 'focus-blend', 'iced-matcha-sachets', 'matcha-starter-kit'],
    },
    {
      handle: 'matcha-flight',
      name: 'The matcha flight',
      description: 'Taste across the grades — ceremonial to everyday.',
      type: 'manual',
      featured: false,
      productHandles: ['ceremonial-matcha', 'daily-matcha', 'iced-matcha-sachets'],
    },
    {
      handle: 'functional',
      name: 'By mood',
      description: 'Focus, calm and sleep — a blend for the hour.',
      type: 'manual',
      featured: false,
      productHandles: ['focus-blend', 'calm-blend', 'sleep-blend'],
    },
    {
      handle: 'everyday-kit',
      name: 'The everyday kit',
      description: 'The tools that make every bowl better.',
      type: 'manual',
      featured: false,
      productHandles: ['matcha-starter-kit', 'bamboo-whisk', 'travel-shaker-tin'],
    },
    {
      handle: 'gifts',
      name: 'Gifts',
      description: 'Kits, tools and the club — sorted.',
      type: 'manual',
      featured: false,
      productHandles: ['matcha-starter-kit', 'bamboo-whisk', 'subscription'],
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
    slug: 'how-to-whisk-a-perfect-bowl',
    status: 'published',
    body: {
      title: 'How to whisk a perfect bowl',
      excerpt: 'Clumpy, bitter matcha almost always comes down to three fixable things: heat, sifting, and the whisk. Get them right and every bowl is smooth.',
      featuredImage: { $asset: 'post-whisk' },
      body: {
        type: 'doc',
        content: [
          para('A smooth, frothy bowl of matcha is not a matter of luck or expensive powder — it’s technique, and there’s barely any of it to learn. If your matcha comes out clumpy, bitter or thin, it’s almost always one of three things: the water was too hot, the powder wasn’t sifted, or a spoon was standing in for a whisk. Fix those and you’ll make a café-grade bowl at home every time.'),
          h2('Sift, cool, whisk'),
          para('Start by sifting one teaspoon of matcha through a small strainer into your bowl — this breaks up the clumps that no amount of whisking will fully undo. Add a splash of water just off the boil, around 70°C: boiling water scorches matcha and turns it bitter, so let the kettle rest a minute first. Then whisk briskly in a W or M motion, from the wrist, not in circles — you’re whipping air in, not stirring. Ten to fifteen seconds and you’ll have a fine, even froth.'),
          h2('Then build your cup'),
          para('Once it’s frothed, you have a base for anything. Top it with hot water for a straight usucha, pour it over ice and cold milk for a latte, or drop it into a smoothie. Use ceremonial grade when you’re drinking it plain and want it sweet and delicate; reach for daily grade when milk and ice are involved and you want the matcha to stand up. Same technique, different cup — and none of it takes longer than the kettle.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'matcha-without-the-crash',
    status: 'published',
    body: {
      title: 'Matcha, without the crash',
      excerpt: 'Same caffeine as a shot of espresso, none of the jitters or the mid-morning cliff. The difference is a quiet amino acid called L-theanine.',
      featuredImage: { $asset: 'post-focus' },
      body: {
        type: 'doc',
        content: [
          para('People who switch to matcha often describe the same thing: they feel awake and clear for hours, but without the racing, jittery lift of coffee and without the cliff-edge crash that follows it. That’s not marketing — it comes down to how matcha delivers its caffeine, and to a second compound that coffee simply doesn’t have.'),
          h2('Slow caffeine, plus L-theanine'),
          para('Because you drink the whole ground leaf rather than a quick water extraction, matcha’s caffeine is released more gradually as it digests — a steadier curve instead of a spike. Alongside it, matcha is rich in L-theanine, an amino acid that promotes calm, focused alertness and takes the sharp edge off caffeine’s stimulation. The two together are why matcha feels like “calm energy”: awake and even, rather than wired and then wrung out.'),
          h2('How to use it'),
          para('A bowl of matcha carries roughly the caffeine of a single espresso, so treat it like one: it’s a brilliant morning and early-afternoon drink, and a poor idea at 9pm. If you’re sensitive, start with our Focus blend, which pairs matcha with a lighter dose of leaf, and keep your last cup before mid-afternoon. Used that way, matcha gives you the steady end of the caffeine spectrum — and none of the part everyone complains about.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'what-ceremonial-grade-means',
    status: 'published',
    body: {
      title: 'What “ceremonial grade” actually means',
      excerpt: 'It isn’t a legal term, so it gets slapped on anything. Here’s what really separates a ceremonial matcha from a daily one — and when to buy which.',
      featuredImage: { $asset: 'post-grade' },
      body: {
        type: 'doc',
        content: [
          para('“Ceremonial grade” is on nearly every tin of matcha sold, which is a problem, because it isn’t a regulated term — no one is stopping a brand from printing it on a dull, bitter powder. But there is a real difference between grades, and once you know what to look for you can taste it in the bowl and see it in the colour.'),
          h2('Harvest, leaf and grind'),
          para('The best matcha comes from the first spring harvest, from young leaves grown under shade for weeks before picking — the shade drives up the chlorophyll and L-theanine that make matcha vivid green and sweet. Those leaves are de-veined and stone-ground slowly into an ultra-fine powder. Later harvests, coarser grinds and more mature leaves give a matcha that’s more astringent, duller in colour and cheaper to make. That’s the honest line between a ceremonial and a daily grade: not a label, but the leaf and the care behind it.'),
          h2('So which should you buy?'),
          para('Buy ceremonial when you’re drinking matcha plain — whisked with just water — and want it smooth, sweet and delicate; that’s where the quality is unmistakable. Buy daily grade for lattes, smoothies and iced cups, where milk and ice would drown the subtlety anyway and you want a bolder matcha that punches through. Most regular drinkers keep both: a ceremonial tin for the morning bowl, a daily tin for everything else.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-tea-modern',
  key: 'sparx-retail-tea-modern',
  name: 'Matcha & Tea (Modern)',
  theme: THEME,
  summary:
    'A complete, working shop for a modern matcha and tea brand: ceremonial and daily matcha with grade and size options, functional focus / calm / sleep blends, grab-and-go iced sachets, a starter kit, a bamboo whisk, a travel shaker and a flexible club subscription, with categories, collections, a bespoke product-forward PDP and a merchandised home page. Bright wellness-modern theme — soft-mint ground, vibrant matcha-green, a punchy coral accent. Shipped as Matcha Club.',
  tagline: 'A bright, working storefront for a modern matcha brand.',
  vertical: 'retail',
  industry: 'Matcha & tea brand',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 86,
  brand: {
    businessName: 'Matcha Club',
    tagline: 'Ceremonial matcha, made for your morning.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Matcha Club — ceremonial matcha & functional tea, shipped fresh',
      description:
        'Matcha Club is a modern matcha and tea brand — ceremonial and daily matcha, functional focus, calm and sleep blends, iced sachets, kits and a flexible club. Source well, grind small, ship bright.',
    },
    about: {
      title: 'About Matcha Club',
      description:
        'How Matcha Club sources, grinds and ships — shade-grown leaf, named growers, small batches, and a bright, functional cup made for a busy day.',
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
