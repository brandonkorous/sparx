// sparx-retail-records-classic — a RETAIL/COMMERCE site template: a warm, vintage record shop.
//
// A complete, working shop the moment it installs — a real catalogue of vinyl LPs across the
// classic genres (soul, jazz, folk, country, soft-rock), a belt-drive turntable, a felt
// slipmat, a record-revival cleaning kit, a canvas tote and a monthly vinyl subscription, with
// categories + collections, a bespoke record-counter PDP and a full merchandised home page.
// Dressed in an INLINE bespoke theme (a warm faded-paper ground, a burnt-sienna primary and a
// dusty-teal accent, under a high-contrast vintage display serif) — the cozy, retro-print
// counterpart to the dark neon crate-digger shop. Shipped as Sunset Sounds.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries its
// OWN theme inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The
// shared `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-records-classic.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-records-classic/**" \
//     "marketplace-catalog/_gen/gen-retail-records-classic.ts"
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
// A warm, printed record counter: a faded-paper GROUND (warm cream, a touch of manila), an
// espresso ink, a burnt-sienna primary that reads like a 70s sleeve spine, and a dusty-teal
// accent for links — the two colours that put a nostalgic album jacket on a shop wall. A
// high-contrast vintage display serif over a humanist sans. Complete light + dark; both grounds
// are warm (paper by day, a dim lamp-lit back room by night), never the neon shop's near-black.
// AA on every role (the blueprint sweep's contrast check is the gate) — every role used as TEXT
// on the paper ground sits at ~50% L or darker.
const THEME = defineTheme({
  name: 'sunset-parlour',
  type: { body: face('Karla', 'sans-serif'), head: face('DM Serif Display', 'serif') },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: ['oklch(95% 0.028 84)', 'oklch(91% 0.038 80)', 'oklch(86% 0.048 76)', 'oklch(24% 0.035 55)'],
    roles: {
      primary: 'oklch(47% 0.14 40)',
      secondary: 'oklch(41% 0.055 55)',
      accent: 'oklch(46% 0.08 205)',
      neutral: 'oklch(28% 0.03 55)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: ['oklch(23% 0.024 58)', 'oklch(19% 0.024 58)', 'oklch(15% 0.022 58)', 'oklch(93% 0.03 84)'],
    roles: {
      primary: 'oklch(72% 0.13 45)',
      secondary: 'oklch(78% 0.05 60)',
      accent: 'oklch(74% 0.1 200)',
      neutral: 'oklch(32% 0.024 58)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "sun-hero": "https://images.unsplash.com/photo-1603850121303-d4ade9e5ba65?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FybSUyMGxhbXAtbGl0JTIwcmVjb3JkJTIwc2hvcCUyMGxwcyUyMGZpbGVkJTIwd29vZGVufGVufDB8MHx8fDE3ODY0MDc4Mjl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "sun-tile-new": "https://images.unsplash.com/photo-1604128311556-816dfb846a54?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBmcmVzaGx5JTIwZmlsZWQlMjBuZXctYXJyaXZhbCUyMHJlY29yZHMlMjBjb3VudGVyfGVufDB8MHx8fDE3ODY0MDc4MzJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "sun-tile-genres": "https://images.unsplash.com/photo-1531415505195-40f140d44392?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZC1sZXR0ZXJlZCUyMGdlbnJlLWRpdmlkZXIlMjBjYXJkc3xlbnwwfDB8fHwxNzg2NDA5MDIyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "sun-tile-gear": "https://images.unsplash.com/photo-1603048588665-791ca8aea617?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dmludGFnZSUyMGJlbHQtZHJpdmUlMjB0dXJudGFibGUlMjByZWNvcmQlMjBzcGlubmluZ3xlbnwwfDB8fHwxNzg2NDA3ODM4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "sun-tile-sub": "https://images.unsplash.com/photo-1507150615129-3ba0720f488d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVjb3JkJTIwd3JhcHBlZCUyMGJyb3duJTIwcGFwZXIlMjB0d2luZSUyMG1haWx8ZW58MHwwfHx8MTc4NjQwNzg0MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "sun-band-shop": "https://images.unsplash.com/photo-1530288782965-fbad40327074?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHMlMjBmbGlwcGluZyUyMHRocm91Z2glMjBmdWxsJTIwd29vZGVuJTIwY3JhdGUlMjByZWNvcmRzfGVufDB8MHx8fDE3ODY0MDc4NDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "sun-band-club": "https://images.unsplash.com/photo-1643718401950-987d99a981d6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFwZXItd3JhcHBlZCUyMHJlY29yZCUyMGRvb3JzdGVwfGVufDB8MHx8fDE3ODY0MDkwMjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-harbor-lights": "https://images.unsplash.com/photo-1780856036788-6223dc07cda0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFyYm9yJTIwbGlnaHRzJTIwbHB8ZW58MHwwfHx8MTc4NjQwOTAzNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-slow-sunday": "https://images.unsplash.com/photo-1586751314370-823fca1d4d67?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2xvdyUyMHN1bmRheSUyMGxwfGVufDB8MHx8fDE3ODY0MDkwMzl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-turntable": "https://images.unsplash.com/photo-1495111372246-c54c2700dfc7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3Vuc2V0JTIwc291bmRzJTIwYmVsdC1kcml2ZXxlbnwwfDB8fHwxNzg2NDA5MDQ0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-slipmat": "https://images.unsplash.com/photo-1631090146730-31fed1147fc3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29vbC1mZWx0JTIwdHVybnRhYmxlJTIwc2xpcG1hdHxlbnwwfDB8fHwxNzg2NDA3ODY2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cleaning-kit": "https://images.unsplash.com/photo-1672924119335-b86e2107fd53?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVjb3JkLXJldml2YWwlMjBjbGVhbmluZyUyMGtpdCUyMGJydXNoJTIwZmx1aWR8ZW58MHwwfHx8MTc4NjQwNzg2OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-tote": "https://images.unsplash.com/photo-1574365569389-a10d488ca3fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmF0dXJhbCUyMGNhbnZhcyUyMHJlY29yZCUyMHRvdGUlMjBiYWd8ZW58MHwwfHx8MTc4NjQwNzg3Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-subscription": "https://images.unsplash.com/photo-1586255527818-8ad7e579c49c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8cGFwZXItd3JhcHBlZCUyMHN1YnNjcmlwdGlvbiUyMHJlY29yZCUyMHRpZWQlMjB0d2luZXxlbnwwfDB8fHwxNzg2NDA3ODc1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-start-collecting": "https://images.unsplash.com/photo-1766353862019-03216f50cd27?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zmlyc3QlMjBzdGFjayUyMHJlY29yZHMlMjBiZXNpZGUlMjB0dXJudGFibGUlMjBzaGVsZnxlbnwwfDB8fHwxNzg2NDA3ODc4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-genres": "https://images.unsplash.com/photo-1595507290691-53f7ac0179c6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZC1sZXR0ZXJlZCUyMGdlbnJlJTIwZGl2aWRlcnN8ZW58MHwwfHx8MTc4NjQwOTA0OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-care": "https://images.unsplash.com/photo-1762492138016-de4ced3d4814?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVjb3JkJTIwYmVpbmclMjB3aXBlZCUyMGNsZWFuJTIwc29mdCUyMGJydXNofGVufDB8MHx8fDE3ODY0MDc4ODR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'sun-hero', url: src('sun-hero'), alt: 'A warm, lamp-lit record shop with LPs filed in wooden bins' },
  { id: 'sun-tile-new', url: src('sun-tile-new'), alt: 'A stack of freshly filed new-arrival records on the counter' },
  { id: 'sun-tile-genres', url: src('sun-tile-genres'), alt: 'Hand-lettered genre-divider cards standing up in a record bin' },
  { id: 'sun-tile-gear', url: src('sun-tile-gear'), alt: 'A vintage belt-drive turntable with a record spinning' },
  { id: 'sun-tile-sub', url: src('sun-tile-sub'), alt: 'A record wrapped in brown paper and twine for the mail' },
  { id: 'sun-band-shop', url: src('sun-band-shop'), alt: 'Hands flipping through a full wooden crate of records under warm light' },
  { id: 'sun-band-club', url: src('sun-band-club'), alt: 'A paper-wrapped record left on a doorstep in golden morning light' },
  { id: 'prod-golden-hour', url: src('prod-golden-hour'), alt: 'The Golden Hour LP sleeve by Marigold Avenue' },
  { id: 'prod-paper-moon', url: src('prod-paper-moon'), alt: 'The Paper Moon Radio LP sleeve by The Clementine Sisters' },
  { id: 'prod-dust-diamonds', url: src('prod-dust-diamonds'), alt: 'The Dust & Diamonds LP sleeve by Wendell Rhodes' },
  { id: 'prod-harbor-lights', url: src('prod-harbor-lights'), alt: 'The Harbor Lights LP sleeve by the Ambergris Quartet' },
  { id: 'prod-slow-sunday', url: src('prod-slow-sunday'), alt: 'The Slow Sunday LP sleeve by June Calloway' },
  { id: 'prod-ferris-wheel', url: src('prod-ferris-wheel'), alt: 'The Ferris Wheel LP sleeve by The Tangerine Set' },
  { id: 'prod-turntable', url: src('prod-turntable'), alt: 'The Sunset Sounds belt-drive turntable in warm walnut' },
  { id: 'prod-slipmat', url: src('prod-slipmat'), alt: 'A wool-felt turntable slipmat' },
  { id: 'prod-cleaning-kit', url: src('prod-cleaning-kit'), alt: 'A record-revival cleaning kit with brush and fluid' },
  { id: 'prod-tote', url: src('prod-tote'), alt: 'A natural canvas record tote bag' },
  { id: 'prod-subscription', url: src('prod-subscription'), alt: 'A paper-wrapped subscription record tied with twine' },
  { id: 'post-start-collecting', url: src('post-start-collecting'), alt: 'A first stack of records beside a turntable on a shelf' },
  { id: 'post-genres', url: src('post-genres'), alt: 'Hand-lettered genre dividers arranged across a record bin' },
  { id: 'post-care', url: src('post-care'), alt: 'A record being wiped clean with a soft brush' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-records-classic: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm photograph, a vintage-serif headline and a lead in a solid
 *  readable paper panel anchored bottom-left, a filled shop CTA + a text link. Never ink on
 *  the photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('sun-hero'), alt: 'A warm, lamp-lit record shop with LPs in wooden bins', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box border border-base-300 bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-normal leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Records, the way they were meant to be sold.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Sunset Sounds is a neighbourhood record shop with the lamp on and the turntable running. New pressings and clean reissues across soul, jazz, folk and the classics — filed by hand, played before we shelve them, and sent to you in proper brown paper.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Browse the bins' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/products/the-monthly-spin' },
                      text: 'Join the Monthly Spin',
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
      el('img', 'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover transition group-hover:opacity-90', {
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
          el('h2', 'text-3xl font-normal tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Drop the needle',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'sun-tile-new', label: 'New arrivals', href: '/shop', alt: 'A stack of new-arrival records' }),
              categoryTile({ assetId: 'sun-tile-genres', label: 'Genres', href: '/collections', alt: 'Hand-lettered genre dividers in a bin' }),
              categoryTile({ assetId: 'sun-tile-gear', label: 'Turntables & gear', href: '/shop', alt: 'A vintage turntable with a record spinning' }),
              categoryTile({ assetId: 'sun-tile-sub', label: 'The Monthly Spin', href: '/products/the-monthly-spin', alt: 'A record wrapped for the mail' }),
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
            el('div', 'flex max-w-xl flex-col gap-4 rounded-box border border-base-300 bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h2', 'text-4xl font-normal leading-none tracking-tight text-base-content @3xl:text-5xl', {
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Just filed in' }),
  editorialBand({
    heading: 'Played before it’s priced',
    lead: 'Nothing goes in a bin until someone here has put it on. We buy new pressings and hunt down clean, honest reissues, check every jacket and every disc, and write the little cards you’ll find tucked in the sleeves. If it’s on the shelf, we’d take it home ourselves.',
    assetId: 'sun-band-shop',
    cta: 'Read the shop notes',
    href: '/journal/where-to-start-collecting',
    alt: 'Hands flipping through a full wooden crate of records',
  }),
  productsBlock({ source: 'commerce.category.records', layout: 'carousel', heading: 'New on the wall' }),
  editorialBand({
    heading: 'One record a month, wrapped in paper',
    lead: 'The Monthly Spin is a record in the mail every month — a new pressing or a reissue we think you should hear, matched to the corners of the shop you love. Skip a month, change your taste, or cancel any time. The warmest way to keep the shelf growing.',
    assetId: 'sun-band-club',
    cta: 'Join the Monthly Spin',
    href: '/products/the-monthly-spin',
    alt: 'A paper-wrapped record on a doorstep in golden morning light',
  }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the sleeve image. Right: the buy column (shop label, title, price, low-stock,
 *  description, add-to-cart, a static "how it ships" note, and policy links). */
function pdpBuyRegion(): Node {
  return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          pdpImage('aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover'),
          el('div', 'flex flex-col gap-6 @3xl:py-4', {
            children: [
              el('div', 'flex flex-col gap-4', {
                children: [
                  el('p', 'text-sm font-semibold uppercase tracking-widest text-secondary', {
                    text: 'Sunset Sounds',
                  }),
                  pdpTitle('h1', 'text-4xl font-normal leading-none tracking-tight text-base-content @3xl:text-5xl'),
                  pdpPriceRow({
                    priceClass: 'text-2xl font-semibold text-base-content',
                    compareClass: 'text-lg text-secondary line-through',
                    rowClass: 'flex items-baseline gap-4',
                  }),
                  pdpStockBadge({
                    className:
                      'inline-flex w-fit items-center gap-2 rounded-field border border-base-300 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-base-content',
                    label: 'Last copies in',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Wrapped in paper, packed to survive the post' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Every record ships in a rigid LP mailer with the corners protected, checked for warps and seam splits before it leaves the counter. In the neighbourhood? Reserve online and collect from the shop — we’ll hold it under the register for a week.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Filed alongside' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(heading: string, lead: string): Node {
  return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-normal leading-none tracking-tight text-base-content @3xl:text-6xl', {
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
    'The bins',
    'Everything on the shelves right now — new pressings, clean reissues, the turntables and gear to play them, and a bit of shop merch. Filter by genre or sort however you like; every record is checked and played before it’s filed.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead(
    'Collections',
    'The bins grouped the way people actually browse — this month’s arrivals, the staff favourites, the soul-and-funk corner, the folk-and-country shelf, and a starter kit if you’re just setting the deck up.'
  ),
];
const SEARCH: Node[] = [
  pageMasthead('Search Sunset Sounds', 'Chasing a title, an artist, a genre or a brush for your records? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-normal leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your stack' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping over $60, and every record travels wrapped in paper inside a rigid LP mailer, checked before it leaves the counter. In the neighbourhood? Choose collect at checkout and we’ll hold it under the register for a week.',
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
          el('h1', 'text-5xl font-normal leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The shop notes' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from behind the counter — where to start a collection, how the bins are laid out, and how to keep your records sounding like the day you bought them. No gatekeeping, no snobbery, just the warm stuff.',
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
          el('h1', 'text-5xl font-normal tracking-tight text-base-content @2xl:text-6xl', { text: 'About Sunset Sounds' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Sunset Sounds began as a folding table of records at a Sunday flea market and a stubborn belief that an album is meant to be heard front to back, with the sleeve in your hands. It grew the slow way — one regular, one recommendation, one trade-in at a time — into a shop with real wooden bins and a lamp that never quite gets turned off.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We lean warm and classic — soul, jazz, folk, country and the soft-rock records that sound like a summer evening — but we stock across every genre, because good music doesn’t care about your shelf labels. New pressings, clean reissues, the occasional gem that walks in the door: all of it checked for warps and splits, all of it played before it’s filed.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No mystery grades, no gouging on the good stuff, and no attitude if you’re buying your very first record. Just a shop that still wraps your record in brown paper and hopes you’ll come back to tell us how it sounded.',
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
    heading: 'Come say hello',
    intro: 'Chasing a title, selling a collection, or want us to spin something at your do? Tell us what you’re after and a real person behind the counter will write back.',
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

// An LP is sold in two pressings — the standard 180g black and a limited "Sunset" colour
// pressing that carries a small premium. Standard is the default so the shelf price reads
// honestly.
const EDITION: OptionDecl = {
  name: 'Edition',
  displayType: 'dropdown',
  values: [{ value: 'Standard 180g black' }, { value: 'Limited Sunset colour' }],
};

const lp = (opts: {
  handle: string;
  title: string;
  artist: string;
  description: string;
  price: number;
  sku: string;
  collections: string[];
  tags: string[];
  asset: string;
  seoTitle: string;
  seoDescription: string;
}): Product => ({
  handle: opts.handle,
  title: `${opts.title} — ${opts.artist}`,
  description: opts.description,
  status: 'active',
  productType: 'Vinyl record',
  vendor: opts.artist,
  tags: opts.tags,
  categoryHandles: ['records'],
  collectionHandles: opts.collections,
  seoTitle: opts.seoTitle,
  seoDescription: opts.seoDescription,
  options: [EDITION],
  variants: [
    { sku: `${opts.sku}-BLK`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Edition: 'Standard 180g black' } },
    { sku: `${opts.sku}-COL`, priceCents: money(opts.price + 6), inventoryPolicy: 'continue', optionValues: { Edition: 'Limited Sunset colour' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: `${opts.title} LP sleeve` }],
});

const PRODUCTS: Product[] = [
  lp({
    handle: 'golden-hour',
    title: 'Golden Hour',
    artist: 'Marigold Avenue',
    description:
      'Sun-warmed soft-rock that sounds like the last hour of a long summer day — jangling twelve-strings, close harmonies, and a rhythm section that never hurries. Sequenced to play from the porch light coming on to the crickets starting up. A record made for a slow evening.',
    price: 27,
    sku: 'SUN-LP-GOLDEN',
    collections: ['this-month', 'staff-favourites', 'folk-country'],
    tags: ['soft-rock', 'folk', 'new-arrival', 'colour-vinyl'],
    asset: 'prod-golden-hour',
    seoTitle: 'Marigold Avenue — Golden Hour (LP) | Sunset Sounds',
    seoDescription: 'Sun-warmed soft-rock from Marigold Avenue on 180g vinyl. Limited Sunset colour pressing available.',
  }),
  lp({
    handle: 'paper-moon-radio',
    title: 'Paper Moon Radio',
    artist: 'The Clementine Sisters',
    description:
      'Vintage-soul pop with three voices braided into one — handclaps, a walking bassline, and hooks that lodge for a week. It swings like an AM radio station you can’t quite find again the next morning. Warm, analogue, and impossible to sit still to.',
    price: 26,
    sku: 'SUN-LP-PAPER',
    collections: ['this-month', 'staff-favourites', 'soul-funk'],
    tags: ['soul', 'pop', 'new-arrival'],
    asset: 'prod-paper-moon',
    seoTitle: 'The Clementine Sisters — Paper Moon Radio (LP) | Sunset Sounds',
    seoDescription: 'Vintage-soul pop from The Clementine Sisters, pressed on 180g vinyl.',
  }),
  lp({
    handle: 'dust-and-diamonds',
    title: 'Dust & Diamonds',
    artist: 'Wendell Rhodes',
    description:
      'Dusty-road country from a voice with gravel and honey in it — pedal steel that cries in all the right places, songs about leaving and the roads that bring you back. The kind of record that sounds even better on a rainy afternoon with the lamp on.',
    price: 25,
    sku: 'SUN-LP-DUST',
    collections: ['this-month', 'folk-country'],
    tags: ['country', 'americana', 'new-arrival'],
    asset: 'prod-dust-diamonds',
    seoTitle: 'Wendell Rhodes — Dust & Diamonds (LP) | Sunset Sounds',
    seoDescription: 'Dusty-road country and americana from Wendell Rhodes on 180g vinyl.',
  }),
  lp({
    handle: 'harbor-lights',
    title: 'Harbor Lights',
    artist: 'The Ambergris Quartet',
    description:
      'A late-night jazz session cut straight to tape — brushed drums, a bass you can lean on, and a tenor sax that leaves plenty of room to breathe. An audiophile 180g pressing that rewards a good stylus and a quiet room after everyone’s gone home.',
    price: 33,
    sku: 'SUN-LP-HARBOR',
    collections: ['this-month', 'staff-favourites', 'soul-funk'],
    tags: ['jazz', 'audiophile', 'reissue'],
    asset: 'prod-harbor-lights',
    seoTitle: 'The Ambergris Quartet — Harbor Lights (LP) | Sunset Sounds',
    seoDescription: 'A late-night jazz session on audiophile 180g vinyl — brushed drums, walking bass, room to breathe.',
  }),
  lp({
    handle: 'slow-sunday',
    title: 'Slow Sunday',
    artist: 'June Calloway',
    description:
      'Deep, unhurried soul from a singer who never wastes a note — a Hammond organ that simmers, horns that punch just enough, and a voice that sounds like it’s telling you the truth. The record that clears the counter every time we drop the needle on it.',
    price: 28,
    sku: 'SUN-LP-SLOW',
    collections: ['staff-favourites', 'soul-funk', 'best-sellers'],
    tags: ['soul', 'funk', 'best-seller'],
    asset: 'prod-slow-sunday',
    seoTitle: 'June Calloway — Slow Sunday (LP) | Sunset Sounds',
    seoDescription: 'Deep, unhurried soul from June Calloway on 180g vinyl.',
  }),
  lp({
    handle: 'ferris-wheel',
    title: 'Ferris Wheel',
    artist: 'The Tangerine Set',
    description:
      'Sunny psych-pop with the top down — fuzz guitars, a farfisa organ, and choruses built for a carnival at dusk. Ten tracks and not a dull one, sequenced to flip straight back over the second side B runs out. Play it loud with the windows open.',
    price: 27,
    sku: 'SUN-LP-FERRIS',
    collections: ['this-month', 'best-sellers'],
    tags: ['psych', 'classic-rock', 'colour-vinyl'],
    asset: 'prod-ferris-wheel',
    seoTitle: 'The Tangerine Set — Ferris Wheel (LP) | Sunset Sounds',
    seoDescription: 'Sunny psych-pop from The Tangerine Set on 180g vinyl. Limited Sunset colour pressing available.',
  }),
  {
    handle: 'sl-70-turntable',
    title: 'Sunset SL-70 Belt-Drive Turntable',
    description:
      'The deck we set up for people getting back into records — a belt-drive turntable in a warm walnut plinth, with a pre-mounted cartridge and a built-in preamp, so it plugs straight into powered speakers or an amp with no fuss. An adjustable counterweight that’s actually easy to set, felt feet, and a hush to the background you’ll notice on the first play. Sounds far better than it has any right to at the price.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Sunset Sounds',
    tags: ['gear', 'turntable', 'belt-drive'],
    categoryHandles: ['gear'],
    collectionHandles: ['best-sellers', 'starter-kit'],
    seoTitle: 'Sunset SL-70 Belt-Drive Turntable | Sunset Sounds',
    seoDescription: 'A walnut belt-drive turntable with a pre-mounted cartridge and built-in preamp — plug-and-play into powered speakers or an amp.',
    variants: [{ sku: 'SUN-GEAR-SL70', priceCents: money(329), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-turntable', isPrimary: true, alt: 'The Sunset Sounds belt-drive turntable in walnut' }],
  },
  {
    handle: 'wool-felt-slipmat',
    title: 'Wool-Felt Slipmat',
    description:
      'A soft wool-felt slipmat that sits quietly under the record and keeps static and dust from creeping in between plays. Fits any standard 12-inch platter, screen-printed with the little Sunset mark. Cheap enough to buy two and keep one clean.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Sunset Sounds',
    tags: ['gear', 'slipmat', 'accessory'],
    categoryHandles: ['gear'],
    collectionHandles: ['starter-kit'],
    seoTitle: 'Wool-Felt Slipmat — turntable accessory | Sunset Sounds',
    seoDescription: 'A soft wool-felt slipmat that keeps static and dust down between plays. Fits any 12-inch platter.',
    variants: [{ sku: 'SUN-GEAR-MAT', priceCents: money(16), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-slipmat', isPrimary: true, alt: 'A wool-felt turntable slipmat' }],
  },
  {
    handle: 'record-revival-kit',
    title: 'Record Revival Cleaning Kit',
    description:
      'Everything to bring a tired record back to life — an anti-static carbon-fibre brush, a bottle of alcohol-free cleaning fluid, and a soft microfibre cloth, in a little tin that lives next to the deck. Two minutes before a play and most of the pops and crackle simply go away.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Sunset Sounds',
    tags: ['gear', 'cleaning', 'care'],
    categoryHandles: ['gear'],
    collectionHandles: ['starter-kit'],
    seoTitle: 'Record Revival Cleaning Kit — record care | Sunset Sounds',
    seoDescription: 'An anti-static brush, alcohol-free fluid and a microfibre cloth to bring a tired record back to life.',
    variants: [{ sku: 'SUN-GEAR-CLEAN', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-cleaning-kit', isPrimary: true, alt: 'A record-revival cleaning kit with brush and fluid' }],
  },
  {
    handle: 'canvas-record-tote',
    title: 'Sunset Canvas Record Tote',
    description:
      'A heavy 16oz natural-canvas tote sized to carry a dozen LPs home without the corners going soft — a flat bottom, reinforced straps, and the sunset mark printed low on the side. The bag you’ll grab on the way out the door every single time.',
    status: 'active',
    productType: 'Merch',
    vendor: 'Sunset Sounds',
    tags: ['merch', 'tote', 'canvas'],
    categoryHandles: ['merch'],
    collectionHandles: ['best-sellers'],
    seoTitle: 'Sunset Canvas Record Tote | Sunset Sounds',
    seoDescription: 'A heavy 16oz natural-canvas tote sized to carry a dozen LPs home, printed with the sunset mark.',
    variants: [{ sku: 'SUN-MERCH-TOTE', priceCents: money(20), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-tote', isPrimary: true, alt: 'A natural canvas record tote bag' }],
  },
  {
    handle: 'the-monthly-spin',
    title: 'The Monthly Spin — Vinyl Subscription',
    description:
      'One record in the mail every month, wrapped in brown paper and chosen by the people behind the counter to match the corners of the shop you love — a new pressing or a clean reissue we think you should hear, with the hand-written card that tells you why. Skip a month, change your taste, or cancel any time. The warmest way to keep the shelf growing.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Sunset Sounds',
    tags: ['subscription', 'monthly-spin', 'gift'],
    categoryHandles: ['subscription'],
    collectionHandles: ['best-sellers', 'staff-favourites'],
    seoTitle: 'The Monthly Spin — Vinyl Subscription | Sunset Sounds',
    seoDescription: 'A hand-picked record in the mail every month, wrapped in paper and matched to your taste. Skip, swap or cancel any time.',
    options: [
      { name: 'Plan', displayType: 'dropdown', values: [{ value: 'One record' }, { value: 'Two records' }] },
    ],
    variants: [
      { sku: 'SUN-SUB-1', priceCents: money(30), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: 'One record' } },
      { sku: 'SUN-SUB-2', priceCents: money(54), inventoryPolicy: 'continue', optionValues: { Plan: 'Two records' } },
    ],
    images: [{ assetId: 'prod-subscription', isPrimary: true, alt: 'A paper-wrapped subscription record tied with twine' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'records', name: 'Vinyl records', description: 'New pressings and clean reissues across the classic genres.', featured: true },
    { handle: 'gear', name: 'Turntables & gear', description: 'Decks, slipmats and record-care kit.', featured: true },
    { handle: 'merch', name: 'Merch', description: 'Totes and shop goods.', featured: true },
    { handle: 'subscription', name: 'Subscription', description: 'A record in the mail every month.', featured: true },
  ],
  collections: [
    {
      handle: 'this-month',
      name: 'This month’s arrivals',
      description: 'What landed in the bins this month.',
      type: 'manual',
      featured: true,
      productHandles: ['golden-hour', 'paper-moon-radio', 'dust-and-diamonds', 'harbor-lights', 'ferris-wheel'],
    },
    {
      handle: 'staff-favourites',
      name: 'Staff favourites',
      description: 'The records we can’t stop playing behind the counter.',
      type: 'manual',
      featured: true,
      productHandles: ['golden-hour', 'paper-moon-radio', 'slow-sunday', 'the-monthly-spin'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'What walks out the door the fastest.',
      type: 'manual',
      featured: true,
      productHandles: ['slow-sunday', 'ferris-wheel', 'sl-70-turntable', 'canvas-record-tote', 'the-monthly-spin'],
    },
    {
      handle: 'soul-funk',
      name: 'Soul & funk',
      description: 'Warm, analogue soul and grooves that won’t sit still.',
      type: 'manual',
      featured: false,
      productHandles: ['paper-moon-radio', 'slow-sunday', 'harbor-lights'],
    },
    {
      handle: 'folk-country',
      name: 'Folk & country',
      description: 'Porch-light soft-rock and dusty-road country.',
      type: 'manual',
      featured: false,
      productHandles: ['golden-hour', 'dust-and-diamonds'],
    },
    {
      handle: 'starter-kit',
      name: 'Starter kit',
      description: 'New to vinyl? Deck, mat and cleaning kit to get going.',
      type: 'manual',
      featured: false,
      productHandles: ['sl-70-turntable', 'wool-felt-slipmat', 'record-revival-kit'],
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
    slug: 'where-to-start-collecting',
    status: 'published',
    body: {
      title: 'Where to start a record collection',
      excerpt: 'You don’t need a hi-fi and a spreadsheet to start collecting. You need a deck that works, a handful of records you love, and somewhere warm to play them.',
      featuredImage: { $asset: 'post-start-collecting' },
      body: {
        type: 'doc',
        content: [
          para('People put off buying their first records because they think they need to spend a fortune first — a rare pressing, an audiophile deck, a special shelf. You don’t. The best-sounding record collection in the world is the one you actually play, and that starts with three cheap, honest things.'),
          h2('A deck, not a museum piece'),
          para('You want a belt-drive turntable with a decent cartridge already fitted and a preamp built in, so it plugs straight into powered speakers or an amp with nothing to configure. That’s the whole ask. Our SL-70 is the one we set up for people getting started, but any deck that meets that description will keep you happy for years. Skip the vintage garage-sale find until you know what a good one sounds like.'),
          h2('Five records you love, not fifty you should'),
          para('Don’t buy for the shelf. Buy the five albums you already know every word of, put them on front to back, and let the collection grow from there — a staff-pick card that catches your eye, a reissue of something your parents played, the record a friend won’t shut up about. A collection built out of real affection sounds better than one built out of obligation, every time.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'how-the-bins-are-laid-out',
    status: 'published',
    body: {
      title: 'How the bins are laid out',
      excerpt: 'A quick map of the shop, so your first dig feels less like a maze and more like a treasure hunt.',
      featuredImage: { $asset: 'post-genres' },
      body: {
        type: 'doc',
        content: [
          para('First time in, the wall of records can look like a wall. It isn’t — there’s a logic to it, and once you know it you’ll find what you’re after in a minute and lose an hour to everything you weren’t. Here’s how we file things.'),
          h2('Arrivals up front, genres along the wall'),
          para('The front table is always this month’s arrivals — whatever’s newest, restocked, or just came in as a trade. Past that, the wooden bins run by genre along the wall: soul and funk, jazz, folk and country, the classic-rock and psych corner, and a soft-rock shelf we love more than we’ll admit. The hand-lettered dividers are there to be flipped past, not tiptoed around.'),
          h2('The cards are us talking to you'),
          para('Anywhere you see a little hand-written card tucked into a sleeve, that’s a staff pick — a record someone here will personally vouch for, with a line about why. They’re not marketing; they’re just the fastest way to hear something great you’d never have pulled out yourself. Follow the cards and you’ll rarely go wrong.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'keep-your-records-sounding-new',
    status: 'published',
    body: {
      title: 'How to keep your records sounding new',
      excerpt: 'Most pops and crackle aren’t damage — they’re dust and static. Two minutes of care before each play does more than any upgrade you can buy.',
      featuredImage: { $asset: 'post-care' },
      body: {
        type: 'doc',
        content: [
          para('People spend a fortune chasing a quieter record and skip the two things that actually cause the noise: dust down in the groove, and a static charge that keeps pulling more of it in. Handle both and most of the crackle disappears — no new cartridge, no new deck required.'),
          h2('Before every play'),
          para('Give the record a pass with an anti-static carbon-fibre brush while it turns on the platter — hold the bristles lightly in the groove for a rotation or two and let it lift the loose dust away. Always hold records by the edge and the label, never the playing surface; the oil from your fingers is exactly what dust sticks to in the first place.'),
          h2('Every so often, a proper clean'),
          para('When a record’s been passed around or bought second-hand, give it a wet clean — a little alcohol-free fluid, a soft microfibre cloth, wiped with the groove and never across it, then left to dry fully before it goes back in the sleeve. Store everything upright, never stacked flat, and keep the deck out of direct sun. Do that and a record you buy today will still sound right in thirty years.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-records-classic',
  key: 'sparx-retail-records-classic',
  name: 'sparx — Record Shop (Vintage)',
  theme: THEME,
  summary:
    'A complete, working shop for a warm neighbourhood record store: a real catalogue of vinyl LPs across the classic genres, a walnut turntable, a felt slipmat, a cleaning kit, a canvas tote and a monthly vinyl subscription, with categories, collections, a bespoke record-counter PDP and a full merchandised home page. Warm, nostalgic theme — faded-paper ground, burnt-sienna primary, dusty-teal accent, a vintage display serif. Shipped as Sunset Sounds.',
  tagline: 'A warm, working storefront for a vintage record shop.',
  vertical: 'retail',
  industry: 'Record shop',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 88,
  brand: {
    businessName: 'Sunset Sounds',
    tagline: 'Records, the way they were meant to be sold.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Sunset Sounds — a warm neighbourhood record shop for vinyl',
      description:
        'Sunset Sounds is a neighbourhood record shop — new pressings and clean reissues across soul, jazz, folk and the classics, turntables and gear, and a monthly vinyl subscription. Every record played before it’s shelved.',
    },
    about: {
      title: 'About Sunset Sounds',
      description:
        'How Sunset Sounds buys, checks and files its records — warm and classic, new pressings and clean reissues, played before they go in the bins. The shop that still wraps your record in brown paper.',
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
