// sparx-retail-tea-house — a RETAIL/COMMERCE site template: a loose-leaf tea house.
//
// A complete, working shop the moment it installs — a real catalogue of single-origin loose
// teas (green, white, matcha, black, oolong, chai and caffeine-free herbals), a sampler set,
// brewing tools (a cast-iron pot, a glass infuser) and a flexible tea-club subscription, with
// categories + collections, a bespoke tea-shop PDP, and the full 9-page commerce site
// (merchandised home → shop → collections → cart → search → journal → about → contact),
// dressed in an INLINE bespoke theme (a calm botanical tea room — soft oat-green paper, a
// muted jade primary, a warm clay accent, a serene serif over a humanist sans). Shipped as
// Steepwell.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme inline
// and passes it on the spec (`theme`), so the whole family can be authored in parallel without
// two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-tea-house.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-tea-house/**" \
//     "marketplace-catalog/_gen/gen-retail-tea-house.ts"
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
import { defineTheme, face, STATUS_ON_LIGHT } from '../../packages/silica-catalog/src/themes';
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
// A calm tea room: a soft oat-green paper ground (a tinted, unhurried page, not white), a deep
// green-tea ink, a muted jade primary and a warm clay accent, under a serene serif display over
// a humanist sans. Botanical and slow. Complete light + dark, AA on every role (the blueprint
// sweep's contrast check is the gate); `secondary` and `accent` stay dark enough to read as ink
// where the pages set them as text over the light ground.
const THEME = defineTheme({
  name: 'steepwell-calm',
  type: { body: face('Karla', 'sans-serif'), head: face('Spectral', 'serif') },
  shape: { selector: '0.75rem', field: '0.5rem', box: '1rem', depth: '0' },
  light: {
    surfaces: ['oklch(96% 0.022 122)', 'oklch(93% 0.028 118)', 'oklch(88% 0.034 114)', 'oklch(24% 0.03 150)'],
    roles: {
      primary: 'oklch(44% 0.08 165)',
      secondary: 'oklch(45% 0.06 58)',
      accent: 'oklch(50% 0.12 45)',
      neutral: 'oklch(27% 0.025 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(19% 0.02 155)', 'oklch(16% 0.02 155)', 'oklch(13% 0.018 155)', 'oklch(94% 0.02 122)'],
    roles: {
      primary: 'oklch(78% 0.1 165)',
      secondary: 'oklch(78% 0.06 58)',
      accent: 'oklch(76% 0.12 45)',
      neutral: 'oklch(31% 0.022 155)',
      ...STATUS_ON_LIGHT,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "tea-hero": "https://images.unsplash.com/photo-1774526380338-ad8084ef6dd0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8Y3VwJTIwbG9vc2UtbGVhZiUyMHRlYSUyMHN0ZWVwaW5nJTIwYmVzaWRlJTIwc2NhdHRlciUyMGRyaWVkfGVufDB8MHx8fDE3ODY0MDYwODh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tea-tile-green": "https://images.unsplash.com/photo-1546852199-2d8e8c4aaada?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y3VybGVkJTIwZ3JlZW4lMjB0ZWElMjBsZWF2ZXMlMjBzaGFsbG93JTIwZGlzaHxlbnwwfDB8fHwxNzg2NDA2MDkyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tea-tile-black": "https://images.unsplash.com/photo-1723879683020-b1e1ee37c641?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGFyayUyMHdob2xlLWxlYWYlMjBibGFjayUyMHRlYSUyMHdvb2RlbiUyMHNjb29wfGVufDB8MHx8fDE3ODY0MDYwOTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tea-tile-herbal": "https://images.unsplash.com/photo-1666818398121-2dbe78b47de3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZHJpZWQlMjBjaGFtb21pbGUlMjBmbG93ZXJzJTIwYm90YW5pY2FscyUyMGJvd2x8ZW58MHwwfHx8MTc4NjQwNjA5OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tea-tile-tools": "https://images.unsplash.com/photo-1634742989591-ad02431f3158?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzdC1pcm9uJTIwdGVhcG90JTIwZ2xhc3N8ZW58MHwwfHx8MTc4NjQwNjQyMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tea-band-ritual": "https://images.unsplash.com/photo-1590408114655-e6375dd39abe?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RlYW0lMjByaXNpbmclMjBnbGFzcyUyMHRlYXBvdCUyMHNvZnQlMjBtb3JuaW5nJTIwbGlnaHR8ZW58MHwwfHx8MTc4NjQwNjEwM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tea-band-club": "https://images.unsplash.com/photo-1728034261780-94beccf0eaec?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFyY2VsJTIwdGVhJTIwdGluc3xlbnwwfDB8fHwxNzg2NDA2NDIzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-jade-green": "https://images.unsplash.com/photo-1606377695906-236fdfcef767?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGluJTIwamFkZSUyMGNsb3VkJTIwZ3JlZW4lMjB0ZWF8ZW58MHwwfHx8MTc4NjQwNjEwOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-silver-needle": "https://images.unsplash.com/photo-1715016811010-e67e6f3d440c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGluJTIwc2lsdmVyJTIwbmVlZGxlJTIwd2hpdGUlMjB0ZWF8ZW58MHwwfHx8MTc4NjQwNjExMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-matcha": "https://images.unsplash.com/photo-1714691602679-3741ad42d836?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGluJTIwY2VyZW1vbmlhbCUyMG1hdGNoYSUyMGJhbWJvbyUyMHdoaXNrfGVufDB8MHx8fDE3ODY0MDYxMTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-assam": "https://images.unsplash.com/photo-1433891248364-3ce993ff0e92?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGluJTIwZ29sZGVuJTIwYXNzYW0lMjBibGFjayUyMHRlYXxlbnwwfDB8fHwxNzg2NDA2MTE5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-oolong": "https://images.unsplash.com/photo-1672848989844-fd093dfaef35?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGluJTIwaXJvbiUyMGdvZGRlc3N8ZW58MHwwfHx8MTc4NjQwNjQyN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-chamomile": "https://images.unsplash.com/photo-1602603796408-633fdcef9609?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGluJTIwY2hhbW9taWxlJTIwaGVyYmFsJTIwdGVhfGVufDB8MHx8fDE3ODY0MDYxMjZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-infuser": "https://images.unsplash.com/photo-1597407196114-fa16f68555a6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhc3MlMjB0ZWElMjBpbmZ1c2VyJTIwbXVnJTIwZmluZSUyMHN0cmFpbmVyfGVufDB8MHx8fDE3ODY0MDYxMzZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-brewing": "https://images.unsplash.com/photo-1534616042650-80f5c9b61f09?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bG9vc2UlMjBsZWF2ZXMlMjB1bmZ1cmxpbmclMjBjbGVhciUyMGdsYXNzJTIwaG90JTIwd2F0ZXJ8ZW58MHwwfHx8MTc4NjQwNjE0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-origins": "https://images.unsplash.com/photo-1775296585797-2754e05490bb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGVycmFjZWQlMjB0ZWElMjBnYXJkZW4lMjBtaXN0eSUyMGdyZWVuJTIwaGlsbHNpZGV8ZW58MHwwfHx8MTc4NjQwNjE0OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-ritual": "https://images.unsplash.com/photo-1516384780024-0d0b739c450b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cXVpZXQlMjB0ZWElMjB0cmF5JTIwc2V0JTIwY3VwJTIwc21hbGwlMjBwb3R8ZW58MHwwfHx8MTc4NjQwNjE1MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'tea-hero', url: src('tea-hero'), alt: 'A cup of loose-leaf tea steeping beside a scatter of dried leaves' },
  { id: 'tea-tile-green', url: src('tea-tile-green'), alt: 'Curled green tea leaves in a shallow dish' },
  { id: 'tea-tile-black', url: src('tea-tile-black'), alt: 'Dark whole-leaf black tea in a wooden scoop' },
  { id: 'tea-tile-herbal', url: src('tea-tile-herbal'), alt: 'Dried chamomile flowers and botanicals in a bowl' },
  { id: 'tea-tile-tools', url: src('tea-tile-tools'), alt: 'A cast-iron teapot and glass infuser on a stone counter' },
  { id: 'tea-band-ritual', url: src('tea-band-ritual'), alt: 'Steam rising from a glass teapot in soft morning light' },
  { id: 'tea-band-club', url: src('tea-band-club'), alt: 'A parcel of tea tins tied with twine on a doorstep' },
  { id: 'prod-jade-green', url: src('prod-jade-green'), alt: 'A tin of Jade Cloud green tea' },
  { id: 'prod-silver-needle', url: src('prod-silver-needle'), alt: 'A tin of Silver Needle white tea' },
  { id: 'prod-matcha', url: src('prod-matcha'), alt: 'A tin of ceremonial matcha with a bamboo whisk' },
  { id: 'prod-assam', url: src('prod-assam'), alt: 'A tin of Golden Assam black tea' },
  { id: 'prod-oolong', url: src('prod-oolong'), alt: 'A tin of Iron Goddess oolong tea' },
  { id: 'prod-chai', url: src('prod-chai'), alt: 'A tin of house masala chai with whole spices' },
  { id: 'prod-chamomile', url: src('prod-chamomile'), alt: 'A tin of chamomile herbal tea' },
  { id: 'prod-rooibos', url: src('prod-rooibos'), alt: 'A tin of amber rooibos herbal tea' },
  { id: 'prod-sampler', url: src('prod-sampler'), alt: 'A sampler box of five small tea tins' },
  { id: 'prod-teapot', url: src('prod-teapot'), alt: 'A matte cast-iron teapot' },
  { id: 'prod-infuser', url: src('prod-infuser'), alt: 'A glass tea infuser mug with a fine strainer' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A tea-club subscription gift box of tins' },
  { id: 'post-brewing', url: src('post-brewing'), alt: 'Loose leaves unfurling in a clear glass of hot water' },
  { id: 'post-origins', url: src('post-origins'), alt: 'A terraced tea garden on a misty green hillside' },
  { id: 'post-ritual', url: src('post-ritual'), alt: 'A quiet tea tray set with a cup and a small pot' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-tea-house: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one calm photograph, a serif headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('tea-hero'), alt: 'A cup of loose-leaf tea steeping', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Slow down. Steep well.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Steepwell is a small loose-leaf tea house. We source whole-leaf tea from gardens we can name, keep it in small batches so it stays fragrant, and send it fresh — so the cup in your hands tastes like the hillside it came from.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop tea' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/shop/subscription' },
                      text: 'Join the tea club',
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
            text: 'Find your tea',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'tea-tile-green', label: 'Green & white', href: '/shop', alt: 'Curled green tea leaves in a dish' }),
              categoryTile({ assetId: 'tea-tile-black', label: 'Black & oolong', href: '/shop', alt: 'Whole-leaf black tea in a scoop' }),
              categoryTile({ assetId: 'tea-tile-herbal', label: 'Herbal', href: '/shop', alt: 'Dried chamomile and botanicals' }),
              categoryTile({ assetId: 'tea-tile-tools', label: 'Brewing tools', href: '/shop', alt: 'A cast-iron teapot and infuser' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'This season’s teas' }),
  editorialBand({
    heading: 'Whole leaf, small batches',
    lead: 'We buy whole-leaf tea, not the broken dust that fills most bags, and we keep it in small sealed batches so it stays fragrant instead of fading on a warehouse shelf. Every tea is tasted before it’s tinned — if the cup isn’t right, it doesn’t go out.',
    assetId: 'tea-band-ritual',
    cta: 'How we source',
    href: '/blog/where-the-leaves-come-from',
    alt: 'Steam rising from a glass teapot',
  }),
  productsBlock({ source: 'commerce.category.green-white', layout: 'carousel', heading: 'Green & white' }),
  editorialBand({
    heading: 'A pot a week, handled',
    lead: 'The tea club is the easy way to keep the shelf stocked: choose your tins, choose how often, and they arrive fresh on your schedule. Rotate through the whole shelf or stay with your favourite — skip, swap or cancel any time, no lock-in.',
    assetId: 'tea-band-club',
    cta: 'Join the tea club',
    href: '/shop/subscription',
    alt: 'A parcel of tea tins on a doorstep',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static steeping note, and policy links). */
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
                    text: 'Steepwell Tea House',
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
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'How to steep it' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'One teaspoon per cup, water just off the boil for black and herbal or a touch cooler for green and white, and a two-to-four-minute steep. Every tin carries its own time and temperature — good tea forgives a little, so taste as you go and steep it the way you like it.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Pairs well with' });

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
    'Shop tea',
    'Every tea on the shelf right now — green and white, black and oolong, spiced chai and caffeine-free herbals, plus the pots and infusers to brew them. Filter by type or caffeine, or sort however you like; all of it ships fresh from small batches.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The teas grouped the way people actually drink them — this season’s harvest, the everyday favourites, the caffeine-free evening cups, and starter kits for a new brewing ritual.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Steepwell', 'Looking for a green, a chai, or a brewing guide? Search the whole shelf and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping on orders over $40, and every tin is filled from a small fresh batch and sent within two days. Not sure a tea is for you? Tell us and we’ll make it right — a good cup should be a small pleasure, never a gamble.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Steepwell journal' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from the tea room — how to steep a better cup, where the leaves actually come from, and how to make an unhurried few minutes of it. Plain, useful, no tea snobbery.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Steepwell' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Steepwell began with a shelf of tins, a small kettle, and the plain frustration of never being able to buy a green tea that still tasted alive. It grew the slow way — one garden, one regular, one shared pot at a time — and it still runs on the same idea: source well, keep it fresh, and never rush the cup.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We buy whole-leaf tea from growers and importers we can name, and we pay above the commodity rate because the people who tend these gardens deserve a living from them. Then we keep the tea in small sealed batches, taste every one, and only tin what’s worth pouring a second cup of.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No mystery blends, no tea gone dusty and grey, nothing older than it should be. Just good leaf, handled with care from the hillside to your kitchen — and a quiet few minutes to enjoy it.',
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
    intro: 'A question about a tea, a wholesale enquiry, or want us to blend for your café or shop? Tell us what you’re after and a real person at the tea house will get back to you.',
    submitLabel: 'Email the tea house',
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

// Loose tea comes two ways — loose leaf in a tin, or pre-portioned biodegradable sachets.
const FORMAT: OptionDecl = {
  name: 'Format',
  displayType: 'dropdown',
  values: [{ value: 'Loose leaf' }, { value: 'Sachets' }],
};

const tin = (opts: {
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
  productType: 'Tea',
  vendor: 'Steepwell Tea House',
  tags: opts.tags,
  categoryHandles: opts.categories,
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [FORMAT],
  variants: [
    { sku: `${opts.sku}-LL`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Format: 'Loose leaf' } },
    { sku: `${opts.sku}-SC`, priceCents: money(opts.price + 2), inventoryPolicy: 'continue', optionValues: { Format: 'Sachets' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const PRODUCTS: Product[] = [
  tin({
    handle: 'jade-cloud-green',
    title: 'Jade Cloud Green',
    description:
      'A high-mountain green from Guizhou, pan-fired and gently curled — soft and sweet, with notes of steamed greens, chestnut and a clean melon finish. No bitterness, no grassiness; the green tea for people who thought they didn’t like green tea.',
    price: 16,
    sku: 'STEEP-GRN-JADE',
    categories: ['green-white'],
    collections: ['new-season', 'best-sellers', 'green-white-set'],
    tags: ['green', 'single-origin', 'caffeinated'],
    asset: 'prod-jade-green',
    seoTitle: 'Jade Cloud Green — high-mountain green tea | Steepwell',
    seoDescription: 'A soft, sweet pan-fired green from Guizhou — chestnut and melon, no bitterness. Whole leaf.',
  }),
  tin({
    handle: 'silver-needle-white',
    title: 'Silver Needle White',
    description:
      'The gentlest tea we carry — unopened buds picked in early spring and only withered and dried, nothing more. Delicate and honeyed, with cucumber and a faint florality. Steep it long and low; it rewards patience and forgives almost nothing else.',
    price: 24,
    sku: 'STEEP-WHT-SILVER',
    categories: ['green-white'],
    collections: ['new-season', 'green-white-set'],
    tags: ['white', 'single-origin', 'caffeinated', 'delicate'],
    asset: 'prod-silver-needle',
    seoTitle: 'Silver Needle White — spring-picked white tea | Steepwell',
    seoDescription: 'Early-spring buds, withered and dried — honeyed, delicate, faintly floral. Whole leaf.',
  }),
  {
    handle: 'ceremonial-matcha',
    title: 'Ceremonial Matcha',
    description:
      'Stone-ground shade-grown matcha from Uji, whisked to a bright jade froth — vegetal and umami-rich with a sweet, lingering finish and none of the chalky bitterness of culinary grade. Whisk it with water for the traditional bowl, or into warm milk for a latte.',
    status: 'active',
    productType: 'Tea',
    vendor: 'Steepwell Tea House',
    tags: ['matcha', 'green', 'single-origin', 'caffeinated'],
    categoryHandles: ['green-white'],
    collectionHandles: ['best-sellers', 'starter-ritual'],
    seoTitle: 'Ceremonial Matcha — stone-ground Uji matcha | Steepwell',
    seoDescription: 'Shade-grown ceremonial matcha from Uji — bright, umami-rich, sweet-finishing. Whisk and pour.',
    options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: '30g tin' }, { value: '100g tin' }] }],
    variants: [
      { sku: 'STEEP-MAT-CER-30', priceCents: money(34), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '30g tin' } },
      { sku: 'STEEP-MAT-CER-100', priceCents: money(92), inventoryPolicy: 'continue', optionValues: { Size: '100g tin' } },
    ],
    images: [{ assetId: 'prod-matcha', isPrimary: true, alt: 'A tin of ceremonial matcha' }],
  },
  tin({
    handle: 'golden-assam-black',
    title: 'Golden Assam Black',
    description:
      'A second-flush Assam thick with golden tips — the classic breakfast cup, malty and full-bodied with a honeyed edge and enough backbone to take milk without disappearing. The one you reach for before you’re quite awake.',
    price: 14,
    sku: 'STEEP-BLK-ASSAM',
    categories: ['black-oolong'],
    collections: ['new-season', 'best-sellers'],
    tags: ['black', 'single-origin', 'caffeinated', 'breakfast'],
    asset: 'prod-assam',
    seoTitle: 'Golden Assam Black — malty breakfast tea | Steepwell',
    seoDescription: 'A tippy second-flush Assam — malty, full-bodied, honeyed, and happy with milk. Whole leaf.',
  }),
  tin({
    handle: 'iron-goddess-oolong',
    title: 'Iron Goddess Oolong',
    description:
      'A rolled Tie Guan Yin oolong, lightly oxidised and roasted — orchid on the nose, buttery and lingering in the cup, and endlessly re-steepable. Open the same leaves three or four times and each pour tells you something new.',
    price: 22,
    sku: 'STEEP-OOL-IRON',
    categories: ['black-oolong'],
    collections: ['new-season', 'green-white-set'],
    tags: ['oolong', 'single-origin', 'caffeinated'],
    asset: 'prod-oolong',
    seoTitle: 'Iron Goddess Oolong — Tie Guan Yin oolong | Steepwell',
    seoDescription: 'A rolled, lightly roasted Tie Guan Yin — orchid, butter, and many honest re-steeps. Whole leaf.',
  }),
  tin({
    handle: 'house-masala-chai',
    title: 'House Masala Chai',
    description:
      'Our own blend of bold Assam with hand-cracked cardamom, cinnamon, ginger, clove and black pepper — warming and properly spiced, not sweet. Simmer it in milk and water for the real thing, or steep it straight for a lighter spiced cup.',
    price: 15,
    sku: 'STEEP-CHAI-HOUSE',
    categories: ['black-oolong'],
    collections: ['best-sellers'],
    tags: ['chai', 'black', 'blend', 'spiced', 'caffeinated'],
    asset: 'prod-chai',
    seoTitle: 'House Masala Chai — spiced black tea blend | Steepwell',
    seoDescription: 'Bold Assam with cardamom, cinnamon, ginger, clove and pepper — warming, not sweet. Whole leaf.',
  }),
  tin({
    handle: 'chamomile-meadow',
    title: 'Chamomile Meadow',
    description:
      'Whole Egyptian chamomile flowers, not the dust that hides in most tea bags — softly apple-sweet, gently floral and genuinely calming. A caffeine-free cup for the end of the day, or any hour that could use slowing down.',
    price: 13,
    sku: 'STEEP-HRB-CHAM',
    categories: ['herbal'],
    collections: ['caffeine-free', 'starter-ritual'],
    tags: ['herbal', 'caffeine-free', 'evening'],
    asset: 'prod-chamomile',
    seoTitle: 'Chamomile Meadow — whole-flower chamomile | Steepwell',
    seoDescription: 'Whole Egyptian chamomile flowers — apple-sweet, gently floral, caffeine-free. A calm evening cup.',
  }),
  tin({
    handle: 'amber-rooibos',
    title: 'Amber Rooibos',
    description:
      'South African red bush, naturally caffeine-free and naturally sweet, with notes of honey, vanilla and a warm woody depth. Smooth enough to drink black all evening and sturdy enough to take milk like a breakfast tea.',
    price: 13,
    sku: 'STEEP-HRB-ROOI',
    categories: ['herbal'],
    collections: ['caffeine-free'],
    tags: ['herbal', 'rooibos', 'caffeine-free'],
    asset: 'prod-rooibos',
    seoTitle: 'Amber Rooibos — caffeine-free red bush tea | Steepwell',
    seoDescription: 'Naturally sweet South African rooibos — honey, vanilla and warm wood. Caffeine-free.',
  }),
  {
    handle: 'tea-sampler',
    title: 'The Steepwell Sampler',
    description:
      'Five small tins to taste your way across the shelf — a green, a black, an oolong, a chai and a caffeine-free herbal, each enough for several pots. The easiest way to find your tea, and a genuinely lovely thing to give.',
    status: 'active',
    productType: 'Gift',
    vendor: 'Steepwell Tea House',
    tags: ['sampler', 'gift', 'variety'],
    categoryHandles: ['gifts'],
    collectionHandles: ['gifts', 'starter-ritual'],
    seoTitle: 'The Steepwell Sampler — five-tea tasting set | Steepwell',
    seoDescription: 'Five small tins — green, black, oolong, chai and a herbal — to taste across the shelf. A lovely gift.',
    variants: [{ sku: 'STEEP-SAMPLER', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-sampler', isPrimary: true, alt: 'A sampler box of five tea tins' }],
  },
  {
    handle: 'cast-iron-teapot',
    title: 'Cast-Iron Teapot',
    description:
      'A matte-black tetsubin-style cast-iron pot with an enamel-lined interior and a removable stainless infuser basket — it holds heat beautifully for a long, even steep and pours clean. 0.6 litres, enough for two or three cups; a pot to keep for years.',
    status: 'active',
    productType: 'Teaware',
    vendor: 'Steepwell Tea House',
    tags: ['teaware', 'brewing', 'teapot'],
    categoryHandles: ['tools'],
    collectionHandles: ['brewing-tools', 'gifts'],
    seoTitle: 'Cast-Iron Teapot — enamel-lined tetsubin | Steepwell',
    seoDescription: 'A matte cast-iron teapot with an enamel lining and stainless infuser — holds heat, pours clean. 0.6L.',
    variants: [{ sku: 'STEEP-TOOL-POT', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-teapot', isPrimary: true, alt: 'A cast-iron teapot' }],
  },
  {
    handle: 'glass-infuser-mug',
    title: 'Glass Infuser Mug',
    description:
      'A double-walled glass mug with a fine stainless infuser and a lid that doubles as a drip tray — watch the leaves unfurl, lift the basket when it’s ready, and drink from the same cup. The simplest way to brew loose leaf at your desk.',
    status: 'active',
    productType: 'Teaware',
    vendor: 'Steepwell Tea House',
    tags: ['teaware', 'brewing', 'infuser'],
    categoryHandles: ['tools'],
    collectionHandles: ['brewing-tools', 'starter-ritual'],
    seoTitle: 'Glass Infuser Mug — double-walled brewing mug | Steepwell',
    seoDescription: 'A double-walled glass mug with a fine stainless infuser and lid — brew loose leaf and drink from one cup.',
    variants: [{ sku: 'STEEP-TOOL-INF', priceCents: money(16), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-infuser', isPrimary: true, alt: 'A glass infuser mug' }],
  },
  {
    handle: 'subscription',
    title: 'Tea Club Subscription',
    description:
      'Fresh tea on your schedule — pick how many tins and how often, and we fill and ship them to match. Rotate through the whole shelf or stay with your favourites; skip, swap or cancel any time. The easiest way to keep good tea in the house.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Steepwell Tea House',
    tags: ['subscription', 'gift'],
    categoryHandles: ['gifts'],
    collectionHandles: ['best-sellers', 'gifts'],
    seoTitle: 'Tea Club Subscription — fresh tea, on your schedule | Steepwell',
    seoDescription: 'A flexible tea subscription — choose tins and cadence; skip, swap or cancel any time.',
    options: [{ name: 'Plan', displayType: 'dropdown', values: [{ value: 'One tin' }, { value: 'Two tins' }] }],
    variants: [
      { sku: 'STEEP-SUB-1', priceCents: money(19), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: 'One tin' } },
      { sku: 'STEEP-SUB-2', priceCents: money(34), inventoryPolicy: 'continue', optionValues: { Plan: 'Two tins' } },
    ],
    images: [{ assetId: 'prod-subscription', isPrimary: true, alt: 'A tea-club subscription box' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'green-white', name: 'Green & white', description: 'Fresh, delicate greens and gentle white teas.', featured: true },
    { handle: 'black-oolong', name: 'Black & oolong', description: 'Full-bodied blacks, rolled oolongs and spiced chai.', featured: true },
    { handle: 'herbal', name: 'Herbal', description: 'Caffeine-free flowers and botanicals.', featured: true },
    { handle: 'tools', name: 'Brewing tools', description: 'Pots and infusers to brew it right.', featured: true },
    { handle: 'gifts', name: 'Gifts & subscriptions', description: 'Samplers and the tea club.', featured: false },
  ],
  collections: [
    {
      handle: 'new-season',
      name: 'This season’s teas',
      description: 'The freshest leaf on the shelf right now.',
      type: 'manual',
      featured: true,
      productHandles: ['jade-cloud-green', 'silver-needle-white', 'iron-goddess-oolong', 'golden-assam-black'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'The teas people come back for.',
      type: 'manual',
      featured: true,
      productHandles: ['jade-cloud-green', 'ceremonial-matcha', 'house-masala-chai', 'golden-assam-black', 'subscription'],
    },
    {
      handle: 'green-white-set',
      name: 'Green & white',
      description: 'Fresh, delicate teas for lighter cups.',
      type: 'manual',
      featured: false,
      productHandles: ['jade-cloud-green', 'silver-needle-white', 'iron-goddess-oolong'],
    },
    {
      handle: 'caffeine-free',
      name: 'Caffeine-free',
      description: 'Gentle herbals for the evening.',
      type: 'manual',
      featured: false,
      productHandles: ['chamomile-meadow', 'amber-rooibos'],
    },
    {
      handle: 'brewing-tools',
      name: 'Brewing tools',
      description: 'Everything to steep it well.',
      type: 'manual',
      featured: false,
      productHandles: ['cast-iron-teapot', 'glass-infuser-mug'],
    },
    {
      handle: 'starter-ritual',
      name: 'Start the ritual',
      description: 'New to loose leaf? Start here.',
      type: 'manual',
      featured: false,
      productHandles: ['glass-infuser-mug', 'ceremonial-matcha', 'chamomile-meadow', 'tea-sampler'],
    },
    {
      handle: 'gifts',
      name: 'Gifts',
      description: 'Samplers, teaware and the tea club.',
      type: 'manual',
      featured: false,
      productHandles: ['tea-sampler', 'subscription', 'cast-iron-teapot'],
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
    slug: 'how-to-steep-a-better-cup',
    status: 'published',
    body: {
      title: 'How to steep a better cup',
      excerpt: 'Most bad tea isn’t bad tea — it’s good leaf brewed too hot, too long, or with too little of it. Three dials and you’re there.',
      featuredImage: { $asset: 'post-brewing' },
      body: {
        type: 'doc',
        content: [
          para('A better cup almost never comes from a fancier tea — it comes from brewing the tea you already have a little more carefully. There are really only three things to get right: how much leaf, how hot the water, and how long you leave it. Once you have a feel for those, everything on the shelf opens up.'),
          h2('Leaf, heat, time'),
          para('Start with about a teaspoon of loose leaf per cup — more than you think, because whole leaf is airy and a mean pinch makes thin, sour tea. Match the heat to the tea: water just off the boil for black, oolong, chai and herbals, and a little cooler — rested a minute off the boil — for green and white, which scorch and turn bitter if you pour boiling water straight on them. Then steep to the tin’s time, usually two to four minutes, and taste toward the end.'),
          h2('Taste, then adjust'),
          para('Tea tells you what it needs. Thin and sour means it was under — add more leaf or a little more time. Harsh and drying means it was over — pull it sooner, or cool the water. Change one thing at a time and taste again. And keep going with the same leaves: most good tea, especially oolong and green, gives you a second and third steep that’s often better than the first.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'where-the-leaves-come-from',
    status: 'published',
    body: {
      title: 'Where the leaves actually come from',
      excerpt: 'A tin with a garden’s name on it should mean something. Here’s what we know about the people who grow ours, and why we pay more.',
      featuredImage: { $asset: 'post-origins' },
      body: {
        type: 'doc',
        content: [
          para('Most tea is sold as a commodity — bought and blended with no reference to which garden it came from or how good it is, then packed into bags where broken dust is a feature, not a flaw. We buy the other way: specific lots, from gardens and cooperatives we can name, through importers who’ve spent years building relationships with the growers.'),
          h2('Why we pay above the market'),
          para('Tea grown at altitude, plucked by hand to two leaves and a bud, and processed with care costs far more to produce than the commodity price rewards. If we want growers to keep making tea this good — and to keep improving it — they have to earn a living from it. Paying above the market isn’t charity; it’s simply what keeps the good leaf being made.'),
          h2('What that gets you'),
          para('Traceability, first: when you can name the garden, you can taste what a region, an altitude and a season actually do to a cup, year after year. And freshness: whole leaf, kept in small sealed batches and sold before it fades, tastes like something. The name on the tin is a promise that someone, somewhere, was paid fairly to grow something worth steeping.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'making-a-ritual-of-it',
    status: 'published',
    body: {
      title: 'Making a small ritual of it',
      excerpt: 'Tea is one of the few good excuses left to stop for four minutes and do nothing else. Here’s how to make those minutes count.',
      featuredImage: { $asset: 'post-ritual' },
      body: {
        type: 'doc',
        content: [
          para('The best thing about brewing loose leaf isn’t only the cup at the end — it’s the four unhurried minutes in the middle, when the only thing you have to do is wait. In a day built out of notifications, a pot of tea is a small, defensible pause, and it’s worth treating it as one rather than rushing it like everything else.'),
          h2('Set a small stage'),
          para('You don’t need a ceremony or a cabinet of teaware. A pot or an infuser mug, a cup you actually like holding, and a clear spot to put them is plenty. Warm the pot, measure the leaf, pour the water, and then — this is the part — leave your phone somewhere else while it steeps. Watch the leaves open if you’re using glass; it’s genuinely nice to look at.'),
          h2('Let the wait be the point'),
          para('Those few minutes are the ritual, not an interruption to it. Some people use them to look out a window, some to breathe, some to think through the day ahead before it starts making demands. However you spend them, the tea gives you a reason to stop that a screen never will — and the cup, brewed with a little attention, is better for the wait.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-tea-house',
  key: 'sparx-retail-tea-house',
  name: 'Tea House (Loose Leaf)',
  theme: THEME,
  summary:
    'A complete, working shop for a loose-leaf tea house: a real catalogue of single-origin greens, whites, blacks, oolong, chai and caffeine-free herbals, a matcha, a sampler set, brewing teaware and a flexible tea-club subscription, with categories, collections, a bespoke tea-shop PDP and a full merchandised home page. Calm botanical theme — soft oat-green paper, a muted jade primary, a warm clay accent. Shipped as Steepwell Tea House.',
  tagline: 'A calm, working storefront for a loose-leaf tea house.',
  vertical: 'retail',
  industry: 'Tea house',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 87,
  brand: {
    businessName: 'Steepwell Tea House',
    tagline: 'Slow down. Steep well.',
  },
  chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Steepwell Tea House — loose-leaf tea, sourced and kept fresh',
      description:
        'Steepwell is a small loose-leaf tea house — single-origin greens, blacks, oolong, chai and caffeine-free herbals, a matcha, teaware and a flexible tea club. Source well, keep it fresh, never rush the cup.',
    },
    about: {
      title: 'About Steepwell Tea House',
      description:
        'How Steepwell sources, keeps and ships tea — whole leaf, named gardens, fair prices, and cups that taste the way the hillside meant them to.',
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
