// sparx-retail-records-vinyl — a RETAIL/COMMERCE site template: an independent record shop.
//
// A complete, working shop the moment it installs — a real catalogue of vinyl LPs across
// genres, a turntable, a slipmat, a record-cleaning kit, a tote and a monthly wax-club
// subscription, with categories + collections, a bespoke crate-digger PDP and a full
// merchandised home page. Dressed in an INLINE bespoke theme (a moody near-black ground with
// a hot-magenta primary and an electric-cyan accent — the album covers carry the colour).
// Shipped as Third Side Records.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries its
// OWN theme inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The
// shared `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-records-vinyl.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-records-vinyl/**" \
//     "marketplace-catalog/_gen/gen-retail-records-vinyl.ts"
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
// A crate-digger's back room: a DARK page in light mode (GROUND dark — like a shop lit by the
// glow of the counter, not fluorescents), surfaces that separate by a step of base tone, a
// hot-magenta primary that reads as neon on black, and an electric-cyan accent for links. The
// album covers supply the rest of the colour. A characterful geometric display over a clean
// grotesk body. Complete light + dark; both grounds are dark, so the bright status set carries
// both modes and STATUS_ON_LIGHT is only pulled in to satisfy the role shape check.
void STATUS_ON_LIGHT;
const THEME = defineTheme({
  name: 'wax-groove',
  type: { body: face('Inter', 'sans-serif'), head: face('Syne', 'sans-serif') },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.625rem', depth: '0' },
  light: {
    surfaces: ['oklch(17% 0.02 318)', 'oklch(14% 0.02 318)', 'oklch(11% 0.02 318)', 'oklch(95% 0.012 320)'],
    roles: {
      primary: 'oklch(70% 0.2 350)',
      secondary: 'oklch(76% 0.06 320)',
      accent: 'oklch(80% 0.13 195)',
      neutral: 'oklch(31% 0.02 318)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: ['oklch(13% 0.016 318)', 'oklch(10% 0.016 318)', 'oklch(7% 0.016 318)', 'oklch(96% 0.01 320)'],
    roles: {
      primary: 'oklch(72% 0.2 350)',
      secondary: 'oklch(78% 0.06 320)',
      accent: 'oklch(82% 0.13 195)',
      neutral: 'oklch(28% 0.02 318)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
  "rec-hero": "https://images.unsplash.com/photo-1760302318644-40cb22d44a99?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y3JhdGUlMjB2aW55bCUyMHJlY29yZHMlMjBiZWluZyUyMGZsaXBwZWQlMjB0aHJvdWdoJTIwcmVjb3JkfGVufDB8MHx8fDE3ODY0MDUwMTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "rec-tile-new": "https://images.unsplash.com/photo-1691388206771-7cb92571d148?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FsbCUyMGZyZXNobHklMjBmaWxlZCUyMG5ldy1hcnJpdmFsJTIwbHBzfGVufDB8MHx8fDE3ODY0MDUwMjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "rec-tile-genres": "https://images.unsplash.com/photo-1677545216009-342bf4d080a7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2VucmUtZGl2aWRlciUyMGNhcmRzJTIwc3RhbmRpbmd8ZW58MHwwfHx8MTc4NjQwNTE4NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "rec-tile-gear": "https://images.unsplash.com/photo-1603048588665-791ca8aea617?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmVsdC1kcml2ZSUyMHR1cm50YWJsZSUyMHJlY29yZCUyMHNwaW5uaW5nfGVufDB8MHx8fDE3ODY0MDUwMjZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "rec-tile-sub": "https://images.unsplash.com/photo-1507150615129-3ba0720f488d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2hyaW5rLXdyYXBwZWQlMjBscCUyMHRpZWQlMjBzdHJpbmclMjBtYWlsfGVufDB8MHx8fDE3ODY0MDUwMjl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "rec-band-shop": "https://images.unsplash.com/photo-1530288782965-fbad40327074?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHMlMjBkaWdnaW5nJTIwdGhyb3VnaCUyMGZ1bGwlMjBjcmF0ZSUyMHJlY29yZHMlMjB1bmRlcnxlbnwwfDB8fHwxNzg2NDA1MDMyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "rec-band-club": "https://images.unsplash.com/photo-1617909516764-0507fdb74882?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVjb3JkJTIwbWFpbGVyJTIwZG9vcnN0ZXB8ZW58MHwwfHx8MTc4NjQwNTE4Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-neon-meridian": "https://images.unsplash.com/photo-1766465738586-b75e63349e30?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmVvbiUyMG1lcmlkaWFuJTIwbHAlMjBzbGVldmUlMjBieSUyMHZpb2xldCUyMHRyYW5zaXR8ZW58MHwwfHx8MTc4NjQwNTAzN3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-static-gospel": "https://images.unsplash.com/photo-1668687194995-43d8d2135ce7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhdGljJTIwZ29zcGVsJTIwbHB8ZW58MHwwfHx8MTc4NjQwNTE5NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-turntable": "https://images.unsplash.com/photo-1616681255209-368a2cd3e643?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhpcmQlMjBzaWRlJTIwYmVsdC1kcml2ZSUyMHR1cm50YWJsZXxlbnwwfDB8fHwxNzg2NDA1MDQ5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-slipmat": "https://images.unsplash.com/photo-1517055374353-5a0172c624c2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29yayUyMHR1cm50YWJsZSUyMHNsaXBtYXR8ZW58MHwwfHx8MTc4NjQwNTA1Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-cleaning-kit": "https://images.unsplash.com/photo-1672924119335-b86e2107fd53?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVjb3JkLWNsZWFuaW5nJTIwa2l0JTIwYnJ1c2glMjBmbHVpZHxlbnwwfDB8fHwxNzg2NDA1MDU5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-tote": "https://images.unsplash.com/photo-1574365569389-a10d488ca3fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FudmFzJTIwY3JhdGUtZGlnZ2VyJTIwdG90ZSUyMGJhZ3xlbnwwfDB8fHwxNzg2NDA1MDYyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prod-wax-club": "https://images.unsplash.com/photo-1711185896337-ee0ca611c5de?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBzdWJzY3JpcHRpb24lMjBscHMlMjB3cmFwcGVkJTIwbW9udGh8ZW58MHwwfHx8MTc4NjQwNTA2NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-arrivals": "https://images.unsplash.com/photo-1595491542937-3de00ac7e08a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZnJlc2glMjBzdGFjayUyMG5ldy1hcnJpdmFsJTIwcmVjb3JkcyUyMGNvdW50ZXJ8ZW58MHwwfHx8MTc4NjQwNTA2OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-staff-picks": "https://images.unsplash.com/photo-1761682751661-b529e0f779d5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhZmYtcGljayUyMGNhcmQlMjB0dWNrZWQlMjBpbnRvJTIwcmVjb3JkJTIwc2xlZXZlfGVufDB8MHx8fDE3ODY0MDUwNzJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "post-care": "https://images.unsplash.com/photo-1619983081593-e2ba5b543168?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVjb3JkJTIwd2lwZWQlMjBhbnRpLXN0YXRpY3xlbnwwfDB8fHwxNzg2NDA1MjAwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'rec-hero', url: src('rec-hero'), alt: 'A crate of vinyl records being flipped through in a record shop' },
  { id: 'rec-tile-new', url: src('rec-tile-new'), alt: 'A wall of freshly filed new-arrival LPs' },
  { id: 'rec-tile-genres', url: src('rec-tile-genres'), alt: 'Genre-divider cards standing up in a record bin' },
  { id: 'rec-tile-gear', url: src('rec-tile-gear'), alt: 'A belt-drive turntable with a record spinning' },
  { id: 'rec-tile-sub', url: src('rec-tile-sub'), alt: 'A shrink-wrapped LP tied with string for the mail' },
  { id: 'rec-band-shop', url: src('rec-band-shop'), alt: 'Hands digging through a full crate of records under shop lights' },
  { id: 'rec-band-club', url: src('rec-band-club'), alt: 'A record mailer left on a doorstep in the morning' },
  { id: 'prod-neon-meridian', url: src('prod-neon-meridian'), alt: 'The Neon Meridian LP sleeve by Violet Transit' },
  { id: 'prod-paper-cathedral', url: src('prod-paper-cathedral'), alt: 'The Paper Cathedral LP sleeve by The Hollow Coast' },
  { id: 'prod-midnight-ledger', url: src('prod-midnight-ledger'), alt: 'The Midnight Ledger LP sleeve by the Cole Ambrose Trio' },
  { id: 'prod-static-gospel', url: src('prod-static-gospel'), alt: 'The Static Gospel LP sleeve by Rue Delacroix' },
  { id: 'prod-chrome-orchard', url: src('prod-chrome-orchard'), alt: 'The Chrome Orchard LP sleeve by Fever Signal' },
  { id: 'prod-turntable', url: src('prod-turntable'), alt: 'The Third Side belt-drive turntable' },
  { id: 'prod-slipmat', url: src('prod-slipmat'), alt: 'A cork turntable slipmat' },
  { id: 'prod-cleaning-kit', url: src('prod-cleaning-kit'), alt: 'A record-cleaning kit with brush and fluid' },
  { id: 'prod-tote', url: src('prod-tote'), alt: 'A canvas crate-digger tote bag' },
  { id: 'prod-wax-club', url: src('prod-wax-club'), alt: 'A stack of subscription LPs wrapped for the month' },
  { id: 'post-arrivals', url: src('post-arrivals'), alt: 'A fresh stack of new-arrival records on the counter' },
  { id: 'post-staff-picks', url: src('post-staff-picks'), alt: 'A staff-pick card tucked into a record sleeve' },
  { id: 'post-care', url: src('post-care'), alt: 'A record being wiped with an anti-static brush' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-retail-records-vinyl: unknown asset "${id}"`);
  return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one photograph, a serifless display headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the
 *  photo. */
function hero(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('rec-hero'), alt: 'A crate of vinyl being flipped through', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box border border-base-300 bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'We still believe in the album.',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'Third Side is an independent record shop for people who still put the needle down and listen to the whole thing. New pressings and hand-picked reissues across every genre, filed by hand and played before we shelve them.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Dig through the crates' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/products/wax-club' },
                      text: 'Join Wax Club',
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
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
            text: 'Start digging',
          }),
          el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
            children: [
              categoryTile({ assetId: 'rec-tile-new', label: 'New arrivals', href: '/shop', alt: 'A wall of new-arrival LPs' }),
              categoryTile({ assetId: 'rec-tile-genres', label: 'Genres', href: '/collections', alt: 'Genre dividers in a record bin' }),
              categoryTile({ assetId: 'rec-tile-gear', label: 'Turntables & gear', href: '/shop', alt: 'A turntable with a record spinning' }),
              categoryTile({ assetId: 'rec-tile-sub', label: 'Wax Club', href: '/products/wax-club', alt: 'An LP wrapped for the mail' }),
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
  productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Just landed' }),
  editorialBand({
    heading: 'Played before it’s shelved',
    lead: 'Nothing goes in the racks until someone here has heard it. We buy new pressings and chase down clean reissues, check every jacket and every disc, and write the little cards you’ll find tucked in the sleeves. If it’s in the bin, we stand behind it.',
    assetId: 'rec-band-shop',
    cta: 'Read the staff picks',
    href: '/journal/staff-picks-this-month',
    alt: 'Hands digging through a full crate of records',
  }),
  productsBlock({ source: 'commerce.category.records', layout: 'carousel', heading: 'New on vinyl' }),
  editorialBand({
    heading: 'One record a month, chosen for you',
    lead: 'Wax Club is a record in the mail every month — a new pressing or a reissue we think you should hear, matched to the genres you love. Skip a month, change your taste, or cancel any time. The easiest way to keep the crate growing.',
    assetId: 'rec-band-club',
    cta: 'Join Wax Club',
    href: '/products/wax-club',
    alt: 'A record mailer on a doorstep in the morning',
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
                    text: 'Third Side Records',
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
                    label: 'Last copies',
                  }),
                ],
              }),
              pdpDescription('text-lg leading-relaxed text-base-content'),
              addToCartForm(),
              el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                children: [
                  el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Shipped in a proper mailer' }),
                  el('p', 'text-base leading-relaxed text-base-content', {
                    text: 'Every record ships in a rigid LP mailer with corner protection, checked for warps and seam splits before it leaves the counter. Local? Reserve online and collect from the shop — we’ll hold it behind the register for a week.',
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
    'The crates',
    'Everything on the shelves right now — new pressings, hand-picked reissues, the turntables and gear to play them, and the odd bit of merch. Filter by genre or sort however you like; every record is checked and played before it’s filed.'
  ),
];
const COLLECTIONS: Node[] = [
  pageMasthead('Collections', 'The bins grouped the way crate-diggers actually shop — this month’s new arrivals, the staff picks, the jazz and soul corner, the electronic wall, and a starter kit if you’re just getting the deck set up.'),
];
const SEARCH: Node[] = [
  pageMasthead('Search Third Side', 'Hunting a title, an artist, a genre or a brush for your records? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
  el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
    children: [
      el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your crate' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Free shipping over $60, and every record travels in a rigid LP mailer, checked before it leaves the counter. Local? Choose collect at checkout and we’ll hold it behind the register for a week.',
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The liner notes' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Notes from behind the counter — what just landed, what we can’t stop playing, and how to keep your records sounding like the day you bought them. No gatekeeping, no snobbery.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Third Side' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Third Side started as a milk crate of records at a weekend market and a stubborn belief that an album is meant to be heard front to back. It grew the slow way — one regular, one recommendation, one trade-in at a time — into a shop with real racks and a turntable always spinning behind the counter.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We stock across every genre because good music doesn’t care about your shelf labels. New pressings, clean reissues, the occasional rare copy that walks in the door — all of it checked for warps and splits, all of it played before it’s filed. If we wouldn’t take it home, it doesn’t go in the bin.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No mystery grades, no gouging on the good stuff, no attitude if you’re buying your first record. Just a shop that still believes the third side of a double LP is worth flipping to.',
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
    heading: 'Come say hi',
    intro: 'Chasing a title, selling a collection, or want us to spin something at your night? Tell us what you’re after and a real person behind the counter will get back to you.',
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

// An LP is sold in two pressings — the standard black 180g and a limited colour variant that
// carries a small premium. Standard is the default so the shelf price reads honestly.
const EDITION: OptionDecl = {
  name: 'Edition',
  displayType: 'dropdown',
  values: [{ value: 'Standard black 180g' }, { value: 'Limited colour' }],
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
    { sku: `${opts.sku}-BLK`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Edition: 'Standard black 180g' } },
    { sku: `${opts.sku}-COL`, priceCents: money(opts.price + 5), inventoryPolicy: 'continue', optionValues: { Edition: 'Limited colour' } },
  ],
  images: [{ assetId: opts.asset, isPrimary: true, alt: `${opts.title} LP sleeve` }],
});

const PRODUCTS: Product[] = [
  lp({
    handle: 'neon-meridian',
    title: 'Neon Meridian',
    artist: 'Violet Transit',
    description:
      'A neon-lit debut of widescreen synth-pop — arpeggios that sprint, choruses built for the drive home, and a low end you’ll feel through the floor. Sequenced as one continuous night, side A to side B, the way the band meant it.',
    price: 28,
    sku: 'TSR-LP-NEON',
    collections: ['new-arrivals', 'staff-picks', 'electronic'],
    tags: ['electronic', 'synth-pop', 'new-arrival', 'colour-vinyl'],
    asset: 'prod-neon-meridian',
    seoTitle: 'Violet Transit — Neon Meridian (LP) | Third Side Records',
    seoDescription: 'The widescreen synth-pop debut from Violet Transit, on 180g vinyl. Limited colour pressing available.',
  }),
  lp({
    handle: 'paper-cathedral',
    title: 'Paper Cathedral',
    artist: 'The Hollow Coast',
    description:
      'Big, reverb-soaked indie rock that builds like weather — quiet verses, guitars that break the roof off by the last chorus. The kind of record you put on loud with the windows open. Their best yet, and it isn’t close.',
    price: 26,
    sku: 'TSR-LP-PAPER',
    collections: ['new-arrivals', 'best-sellers'],
    tags: ['indie-rock', 'alternative', 'new-arrival'],
    asset: 'prod-paper-cathedral',
    seoTitle: 'The Hollow Coast — Paper Cathedral (LP) | Third Side Records',
    seoDescription: 'Reverb-soaked indie rock from The Hollow Coast, pressed on 180g vinyl.',
  }),
  lp({
    handle: 'midnight-ledger',
    title: 'Midnight Ledger',
    artist: 'Cole Ambrose Trio',
    description:
      'A late-night piano-trio session cut straight to tape — brushed drums, a walking bass you can lean on, and playing that leaves room to breathe. An audiophile 180g pressing that rewards a good stylus and a quiet room.',
    price: 34,
    sku: 'TSR-LP-MIDNIGHT',
    collections: ['new-arrivals', 'staff-picks', 'jazz-soul'],
    tags: ['jazz', 'audiophile', 'reissue'],
    asset: 'prod-midnight-ledger',
    seoTitle: 'Cole Ambrose Trio — Midnight Ledger (LP) | Third Side Records',
    seoDescription: 'A late-night piano-trio session on audiophile 180g vinyl. Brushed drums, walking bass, room to breathe.',
  }),
  lp({
    handle: 'static-gospel',
    title: 'Static Gospel',
    artist: 'Rue Delacroix',
    description:
      'Soul with grit under its fingernails — horns that punch, an organ that simmers, and a voice that sounds like it’s been up all night and has something to tell you. Warm, analogue, and impossible to sit still to.',
    price: 27,
    sku: 'TSR-LP-STATIC',
    collections: ['new-arrivals', 'staff-picks', 'jazz-soul'],
    tags: ['soul', 'funk', 'new-arrival'],
    asset: 'prod-static-gospel',
    seoTitle: 'Rue Delacroix — Static Gospel (LP) | Third Side Records',
    seoDescription: 'Gritty, horn-driven soul from Rue Delacroix on 180g vinyl.',
  }),
  lp({
    handle: 'chrome-orchard',
    title: 'Chrome Orchard',
    artist: 'Fever Signal',
    description:
      'Angular post-punk with a pulse — motorik drums, a bassline that never lets up, and guitars filed to a point. Ten tracks, not a spare second among them. Play it once and you’ll flip it straight back over.',
    price: 29,
    sku: 'TSR-LP-CHROME',
    collections: ['new-arrivals', 'electronic'],
    tags: ['post-punk', 'alternative', 'colour-vinyl'],
    asset: 'prod-chrome-orchard',
    seoTitle: 'Fever Signal — Chrome Orchard (LP) | Third Side Records',
    seoDescription: 'Angular, motorik post-punk from Fever Signal on 180g vinyl. Limited colour pressing available.',
  }),
  {
    handle: 'tt-01-turntable',
    title: 'Third Side TT-01 Belt-Drive Turntable',
    description:
      'The deck we set up for people getting back into records — a belt-drive turntable with a pre-mounted cartridge and a built-in preamp, so it plugs straight into powered speakers or an amp with no fuss. Solid plinth, adjustable feet, and a counterweight that’s actually easy to set. Sounds far better than it has any right to at the price.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Third Side Records',
    tags: ['gear', 'turntable', 'belt-drive'],
    categoryHandles: ['gear'],
    collectionHandles: ['best-sellers', 'starter-kit'],
    seoTitle: 'Third Side TT-01 Belt-Drive Turntable | Third Side Records',
    seoDescription: 'A belt-drive turntable with a pre-mounted cartridge and built-in preamp — plug-and-play into powered speakers or an amp.',
    variants: [{ sku: 'TSR-GEAR-TT01', priceCents: money(349), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-turntable', isPrimary: true, alt: 'The Third Side belt-drive turntable' }],
  },
  {
    handle: 'cork-slipmat',
    title: 'Cork Slipmat',
    description:
      'A natural cork slipmat that grips the record and tightens up the low end — a small upgrade you’ll hear on the first play. Fits any standard 12-inch platter. Cheap enough to buy two and keep one clean.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Third Side Records',
    tags: ['gear', 'slipmat', 'accessory'],
    categoryHandles: ['gear'],
    collectionHandles: ['starter-kit'],
    seoTitle: 'Cork Slipmat — turntable accessory | Third Side Records',
    seoDescription: 'A natural cork slipmat that grips the record and tightens the low end. Fits any 12-inch platter.',
    variants: [{ sku: 'TSR-GEAR-MAT', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-slipmat', isPrimary: true, alt: 'A cork turntable slipmat' }],
  },
  {
    handle: 'groove-care-kit',
    title: 'Groove Care Cleaning Kit',
    description:
      'Everything to keep your records quiet — an anti-static carbon-fibre brush, a bottle of alcohol-free cleaning fluid, and a microfibre cloth, in a tin that lives next to the deck. Two minutes before a play and the pops and crackle mostly disappear.',
    status: 'active',
    productType: 'Equipment',
    vendor: 'Third Side Records',
    tags: ['gear', 'cleaning', 'care'],
    categoryHandles: ['gear'],
    collectionHandles: ['starter-kit'],
    seoTitle: 'Groove Care Cleaning Kit — record care | Third Side Records',
    seoDescription: 'An anti-static brush, alcohol-free fluid and a microfibre cloth to keep your records quiet.',
    variants: [{ sku: 'TSR-GEAR-CARE', priceCents: money(34), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-cleaning-kit', isPrimary: true, alt: 'A record-cleaning kit with brush and fluid' }],
  },
  {
    handle: 'crate-digger-tote',
    title: 'Crate-Digger Canvas Tote',
    description:
      'A heavy 16oz canvas tote sized to carry a dozen LPs home without the corners going soft — flat bottom, reinforced straps, screen-printed with the shop mark. The bag you’ll grab on the way out the door every time.',
    status: 'active',
    productType: 'Merch',
    vendor: 'Third Side Records',
    tags: ['merch', 'tote', 'canvas'],
    categoryHandles: ['merch'],
    collectionHandles: ['best-sellers'],
    seoTitle: 'Crate-Digger Canvas Tote | Third Side Records',
    seoDescription: 'A heavy 16oz canvas tote sized to carry a dozen LPs home, screen-printed with the shop mark.',
    variants: [{ sku: 'TSR-MERCH-TOTE', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: 'prod-tote', isPrimary: true, alt: 'A canvas crate-digger tote bag' }],
  },
  {
    handle: 'wax-club',
    title: 'Wax Club — Monthly Vinyl Subscription',
    description:
      'One record in the mail every month, chosen by the people behind the counter to match the genres you love — a new pressing or a reissue we think you should hear, with the liner-note card that tells you why. Skip a month, change your taste, or cancel any time. The easiest way to keep the crate growing.',
    status: 'active',
    productType: 'Subscription',
    vendor: 'Third Side Records',
    tags: ['subscription', 'wax-club', 'gift'],
    categoryHandles: ['subscription'],
    collectionHandles: ['best-sellers', 'staff-picks'],
    seoTitle: 'Wax Club — Monthly Vinyl Subscription | Third Side Records',
    seoDescription: 'A hand-picked record in the mail every month, matched to your taste. Skip, swap or cancel any time.',
    options: [
      { name: 'Plan', displayType: 'dropdown', values: [{ value: 'One record' }, { value: 'Two records' }] },
    ],
    variants: [
      { sku: 'TSR-SUB-1', priceCents: money(32), isDefault: true, inventoryPolicy: 'continue', optionValues: { Plan: 'One record' } },
      { sku: 'TSR-SUB-2', priceCents: money(58), inventoryPolicy: 'continue', optionValues: { Plan: 'Two records' } },
    ],
    images: [{ assetId: 'prod-wax-club', isPrimary: true, alt: 'A stack of subscription LPs wrapped for the month' }],
  },
];

const COMMERCE = {
  categories: [
    { handle: 'records', name: 'Vinyl records', description: 'New pressings and hand-picked reissues across every genre.', featured: true },
    { handle: 'gear', name: 'Turntables & gear', description: 'Decks, slipmats and record-care kit.', featured: true },
    { handle: 'merch', name: 'Merch', description: 'Totes and shop goods.', featured: true },
    { handle: 'subscription', name: 'Subscription', description: 'A record in the mail every month.', featured: true },
  ],
  collections: [
    {
      handle: 'new-arrivals',
      name: 'New arrivals',
      description: 'What landed in the racks this month.',
      type: 'manual',
      featured: true,
      productHandles: ['neon-meridian', 'paper-cathedral', 'midnight-ledger', 'static-gospel', 'chrome-orchard'],
    },
    {
      handle: 'staff-picks',
      name: 'Staff picks',
      description: 'The records we can’t stop playing behind the counter.',
      type: 'manual',
      featured: true,
      productHandles: ['midnight-ledger', 'static-gospel', 'neon-meridian', 'wax-club'],
    },
    {
      handle: 'best-sellers',
      name: 'Best sellers',
      description: 'What walks out the door the fastest.',
      type: 'manual',
      featured: true,
      productHandles: ['paper-cathedral', 'wax-club', 'tt-01-turntable', 'crate-digger-tote'],
    },
    {
      handle: 'jazz-soul',
      name: 'Jazz & soul',
      description: 'Late-night sessions and gritty soul.',
      type: 'manual',
      featured: false,
      productHandles: ['midnight-ledger', 'static-gospel'],
    },
    {
      handle: 'electronic',
      name: 'Electronic & post-punk',
      description: 'Synths, motorik pulses and colour wax.',
      type: 'manual',
      featured: false,
      productHandles: ['neon-meridian', 'chrome-orchard'],
    },
    {
      handle: 'starter-kit',
      name: 'Starter kit',
      description: 'New to vinyl? Deck, mat and cleaning kit to get going.',
      type: 'manual',
      featured: false,
      productHandles: ['tt-01-turntable', 'cork-slipmat', 'groove-care-kit'],
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
    slug: 'just-landed-this-week',
    status: 'published',
    body: {
      title: 'Just landed: five records worth flipping to',
      excerpt: 'A synth-pop debut, a piano trio cut to tape, and a post-punk record that never lets up — here’s what filed into the racks this week.',
      featuredImage: { $asset: 'post-arrivals' },
      body: {
        type: 'doc',
        content: [
          para('Restock day is the best day behind the counter. A pallet comes in, we unbox it onto the back table, and half of it gets played before it ever reaches a bin. Here’s what made this week worth talking about.'),
          h2('The one to hear loud'),
          para('The Hollow Coast’s Paper Cathedral is the record we’ve had on repeat. It builds like weather — hushed verses that break into guitars big enough to take the roof off — and it’s pressed on quiet, heavy vinyl that gives all that reverb somewhere to live. Put it on with the windows open.'),
          h2('The one for a quiet room'),
          para('Midnight Ledger, the Cole Ambrose Trio session, is the opposite kind of pleasure: brushed drums, a walking bass, and playing that leaves space between the notes. It’s an audiophile 180g cut, so it rewards a decent stylus and a room without much else going on. A late-night record in the truest sense.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'staff-picks-this-month',
    status: 'published',
    body: {
      title: 'Staff picks this month',
      excerpt: 'Everyone behind the counter gets a card in the rack. Here’s what we’re each pushing on customers right now, and why.',
      featuredImage: { $asset: 'post-staff-picks' },
      body: {
        type: 'doc',
        content: [
          para('The little handwritten cards tucked into the sleeves aren’t marketing — they’re just us telling you what we’d take home. A staff pick is a record someone here will personally vouch for, and this month the racks are full of them.'),
          h2('Neon Meridian — Violet Transit'),
          para('If you grew up on the sound of a synth arpeggio and a chorus built for the highway, this debut is going to hit. It’s sequenced as one continuous night, and it’s best heard that way — side A into side B, no skipping. The limited colour pressing is genuinely gorgeous under the lights, too.'),
          h2('Static Gospel — Rue Delacroix'),
          para('Soul with grit under its fingernails. Punchy horns, a simmering organ, and a voice that sounds like it’s been up all night with something to tell you. Warm, analogue and impossible to sit still to — the record that clears the counter every time we drop the needle on it.'),
        ],
      },
    },
  },
  {
    typeKey: 'blog_post',
    slug: 'keep-your-records-quiet',
    status: 'published',
    body: {
      title: 'How to keep your records quiet',
      excerpt: 'Most pops and crackle aren’t damage — they’re dust and static. Two minutes of care before each play makes a bigger difference than any upgrade.',
      featuredImage: { $asset: 'post-care' },
      body: {
        type: 'doc',
        content: [
          para('People spend a fortune chasing a quieter background from their records and skip the two things that actually cause the noise: dust in the groove and a static charge that pulls more of it in. Handle both and most of the crackle disappears — no new cartridge required.'),
          h2('Before every play'),
          para('Give the record a pass with an anti-static carbon-fibre brush while it turns on the platter — hold the bristles lightly in the groove for a rotation or two and let it lift the loose dust. Always hold records by the edge and the label, never the playing surface; the oil from your fingers is what dust sticks to in the first place.'),
          h2('Every so often, a proper clean'),
          para('When a record’s been passed around or bought second-hand, it’s worth a wet clean — a little alcohol-free fluid, a soft microfibre cloth, wiped with the groove and never across it, then left to dry fully before it goes back in the sleeve. Store everything upright, never stacked flat, and keep the decks out of direct sun. Do that and a record you buy today will still sound right in thirty years.'),
        ],
      },
    },
  },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
  slug: 'retail-records-vinyl',
  key: 'sparx-retail-records-vinyl',
  name: 'sparx — Record Shop (Vinyl)',
  theme: THEME,
  summary:
    'A complete, working shop for an independent record store: a real catalogue of vinyl LPs across genres, a turntable, a slipmat, a record-cleaning kit, a tote and a monthly Wax Club subscription, with categories, collections, a bespoke crate-digger PDP and a full merchandised home page. Moody dark theme — near-black ground, hot-magenta primary, electric-cyan accent; the album covers carry the colour. Shipped as Third Side Records.',
  tagline: 'A dark, working storefront for an independent record shop.',
  vertical: 'retail',
  industry: 'Record shop',
  requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
  sortWeight: 88,
  brand: {
    businessName: 'Third Side Records',
    tagline: 'We still believe in the album.',
  },
  chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
  seo: {
    home: {
      title: 'Third Side Records — an independent record shop for vinyl',
      description:
        'Third Side is an independent record shop — new pressings and hand-picked reissues across every genre, turntables and gear, and a monthly Wax Club subscription. Every record played before it’s shelved.',
    },
    about: {
      title: 'About Third Side Records',
      description:
        'How Third Side buys, checks and files its records — every genre, new pressings and clean reissues, played before they go in the bin. The shop that still believes in the album.',
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
