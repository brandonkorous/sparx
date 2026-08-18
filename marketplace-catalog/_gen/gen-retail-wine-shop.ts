// sparx-retail-wine-shop — a RETAIL/COMMERCE site template: a natural-wine bottle shop.
//
// A complete, working shop the moment it installs — a real catalogue of low-intervention
// bottles (a pét-nat, a skin-contact orange, a chillable red, a mineral white, a rosé, a
// magnum, a mixed six-pack, a non-alc option and an everyday red), categories + collections,
// a bespoke bottle-shop PDP, and the full 9-page commerce site (merchandised home → shop →
// collections → cart → search → journal → about → contact), dressed in an INLINE bespoke
// theme (a deep, low-lit cellar — plum-charcoal ground, warm cream ink, a wine-garnet primary
// and a brass accent). Shipped as Sediment.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme inline
// and passes it on the spec (`theme`), so the whole family can be authored in parallel without
// two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-wine-shop.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-wine-shop/**" \
//     "marketplace-catalog/_gen/gen-retail-wine-shop.ts"
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
} from '../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { productsBlock } from '../../wizeworks/packages/silica-catalog/src/commerce';
import { defineTheme, face, STATUS_ON_DARK } from '../../wizeworks/packages/silica-catalog/src/themes';
import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';

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
// A low-lit cellar: a DARK plum-charcoal page in light mode (a wine room is a low-lit room),
// warm cream ink, a wine-garnet primary lit by a brass accent and warm-oak support. Dark in
// BOTH modes; its "dark mode" simply goes further down. Takes the bright status set in both
// modes — the deep set would vanish into a 23% ground — and shifts `error` off the garnet hue
// so a warning never reads as the brand. Complete light + dark, AA on every role (the blueprint
// sweep's contrast check is the gate).
const THEME = defineTheme({
    name: 'cellar-natural',
    type: { body: face('Karla', 'sans-serif'), head: face('Spectral', 'serif') },
    shape: { selector: '0.375rem', field: '0.25rem', box: '0.5rem', depth: '0' },
    light: {
        surfaces: ['oklch(23% 0.03 350)', 'oklch(19% 0.03 350)', 'oklch(15% 0.028 350)', 'oklch(93% 0.02 45)'],
        roles: {
            primary: 'oklch(74% 0.14 12)',
            secondary: 'oklch(80% 0.055 60)',
            accent: 'oklch(84% 0.13 75)',
            neutral: 'oklch(32% 0.02 350)',
            ...STATUS_ON_DARK,
            warning: 'oklch(84% 0.14 55)',
            error: 'oklch(70% 0.17 32)',
        },
    },
    dark: {
        surfaces: ['oklch(14% 0.022 350)', 'oklch(11% 0.022 350)', 'oklch(8% 0.02 350)', 'oklch(94% 0.016 45)'],
        roles: {
            primary: 'oklch(76% 0.14 12)',
            secondary: 'oklch(82% 0.055 60)',
            accent: 'oklch(86% 0.13 75)',
            neutral: 'oklch(30% 0.02 350)',
            ...STATUS_ON_DARK,
            warning: 'oklch(84% 0.14 55)',
            error: 'oklch(70% 0.17 32)',
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "wine-hero": "https://images.unsplash.com/photo-1773764271819-71fa11a0c1c7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8b3BlbiUyMGJvdHRsZXMlMjBzdGFpbmVkJTIwZ2xhc3NlcyUyMGNhbmRsZS1saXQlMjB0YWJsZXxlbnwwfDB8fHwxNzg2NDA0OTYwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "wine-tile-red": "https://images.unsplash.com/photo-1621644894301-cd6b2eaca610?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhc3MlMjBjaGlsbGVkJTIwcmVkJTIwd2luZSUyMGhlbGQlMjBsaWdodHxlbnwwfDB8fHwxNzg2NDA0OTYzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "wine-tile-white": "https://images.unsplash.com/photo-1780492397566-a3dcd7879eb0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sZCUyMGJvdHRsZSUyMHdoaXRlJTIwd2luZSUyMGJlYWRlZCUyMGNvbmRlbnNhdGlvbnxlbnwwfDB8fHwxNzg2NDA0OTY3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "wine-tile-orange": "https://images.unsplash.com/photo-1596438214057-5ff7c7fa76b1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhc3MlMjBjbG91ZHklMjBhbWJlciUyMHNraW4tY29udGFjdCUyMHdpbmV8ZW58MHwwfHx8MTc4NjQwNDk3MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "wine-band-cellar": "https://images.unsplash.com/photo-1561586143-986506dbe6a5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZHVzdHklMjBib3R0bGVzJTIwcmVzdGluZyUyMHRoZWlyJTIwc2lkZXMlMjBjZWxsYXIlMjByYWNrfGVufDB8MHx8fDE3ODY0MDQ5NzZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "wine-band-club": "https://images.unsplash.com/photo-1613574203646-ffdae46ce3e9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwbWl4ZWQlMjB3aW5lJTIwYm90dGxlcyUyMHBhY2tlZCUyMHRpc3N1ZXxlbnwwfDB8fHwxNzg2NDA0OTgwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-petnat": "https://images.unsplash.com/photo-1702647104901-8b019a9fb42a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y3Jvd24tY2FwcGVkJTIwYm90dGxlJTIwY2xvdWR5fGVufDB8MHx8fDE3ODY0MDUxNzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-orange": "https://images.unsplash.com/photo-1781344116880-029945a42b75?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym90dGxlJTIwYW1iZXIlMjBza2luLWNvbnRhY3R8ZW58MHwwfHx8MTc4NjQwNTE3OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-chill-red": "https://images.unsplash.com/photo-1638186095900-179bc805de09?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym90dGxlJTIwYnJpZ2h0JTIwY2hpbGxhYmxlJTIwcmVkJTIwd2luZXxlbnwwfDB8fHwxNzg2NDA0OTg3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-mineral-white": "https://images.unsplash.com/photo-1598866971869-22782ffd918e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym90dGxlJTIwcGFsZSUyMG1pbmVyYWwlMjB3aGl0ZSUyMHdpbmV8ZW58MHwwfHx8MTc4NjQwNDk5MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-rose": "https://images.unsplash.com/photo-1597822738124-151fb72dcb79?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym90dGxlJTIwZHJ5JTIwcGFsZSUyMHJvc3xlbnwwfDB8fHwxNzg2NDA0OTkzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-magnum": "https://images.unsplash.com/photo-1785900978443-b7f6398f771d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8bWFnbnVtJTIwYm90dGxlJTIwcmVkfGVufDB8MHx8fDE3ODY0MDUxODF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-sixpack": "https://images.unsplash.com/photo-1587103416037-a824af53b2c6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8c2l4JTIwd2luZSUyMGJvdHRsZXMlMjBzdGFuZGluZyUyMHRvZ2V0aGVyJTIwY2FyZGJvYXJkJTIwY2FzZXxlbnwwfDB8fHwxNzg2NDA0OTk5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-nonalc": "https://images.unsplash.com/photo-1514242879996-d7b3bb2dd531?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym90dGxlJTIwbm9uLWFsY29ob2xpYyUyMHNwYXJrbGluZyUyMHdpbmUlMjBpY2V8ZW58MHwwfHx8MTc4NjQwNTAwM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-everyday-red": "https://images.unsplash.com/photo-1638186095578-7e58f9f16d0d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Ym90dGxlJTIwZWFzeSUyMGV2ZXJ5ZGF5JTIwcmVkJTIwd2luZXxlbnwwfDB8fHwxNzg2NDA1MDA1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-natural": "https://images.unsplash.com/photo-1537640538966-79f369143f8f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z3JhcGVzJTIwdmluZSUyMGxvdy1pbnRlcnZlbnRpb24lMjB2aW5leWFyZHxlbnwwfDB8fHwxNzg2NDA1MDA5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-pairings": "https://images.unsplash.com/photo-1551790629-9d5c2d781d8b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFibGUlMjBzZXQlMjB3aW5lJTIwY2hlZXNlJTIwYnJlYWQlMjBzaGFyaW5nfGVufDB8MHx8fDE3ODY0MDUwMTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-tasting": "https://images.unsplash.com/photo-1641453288558-6dce96ee996c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8NHx8aGFuZCUyMHN3aXJsaW5nJTIwd2luZSUyMGdsYXNzJTIwdGFzdGUlMjBpdHxlbnwwfDB8fHwxNzg2NDA1MDE0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'wine-hero', url: src('wine-hero'), alt: 'Open bottles and stained glasses on a candle-lit table' },
    { id: 'wine-tile-red', url: src('wine-tile-red'), alt: 'A glass of chilled red wine held to the light' },
    { id: 'wine-tile-white', url: src('wine-tile-white'), alt: 'A cold bottle of white wine beaded with condensation' },
    { id: 'wine-tile-orange', url: src('wine-tile-orange'), alt: 'A glass of cloudy amber skin-contact wine' },
    { id: 'wine-tile-rose', url: src('wine-tile-rose'), alt: 'A bottle of pale rosé on a linen tablecloth' },
    { id: 'wine-band-cellar', url: src('wine-band-cellar'), alt: 'Dusty bottles resting on their sides in a cellar rack' },
    { id: 'wine-band-club', url: src('wine-band-club'), alt: 'A box of mixed wine bottles packed with tissue' },
    { id: 'prod-petnat', url: src('prod-petnat'), alt: 'A crown-capped bottle of cloudy pét-nat sparkling wine' },
    { id: 'prod-orange', url: src('prod-orange'), alt: 'A bottle of amber skin-contact orange wine' },
    { id: 'prod-chill-red', url: src('prod-chill-red'), alt: 'A bottle of bright, chillable red wine' },
    { id: 'prod-mineral-white', url: src('prod-mineral-white'), alt: 'A bottle of pale mineral white wine' },
    { id: 'prod-rose', url: src('prod-rose'), alt: 'A bottle of dry pale rosé' },
    { id: 'prod-magnum', url: src('prod-magnum'), alt: 'A magnum bottle of red wine on a table' },
    { id: 'prod-sixpack', url: src('prod-sixpack'), alt: 'Six wine bottles standing together in a cardboard case' },
    { id: 'prod-nonalc', url: src('prod-nonalc'), alt: 'A bottle of non-alcoholic sparkling wine on ice' },
    { id: 'prod-everyday-red', url: src('prod-everyday-red'), alt: 'A bottle of easy everyday red wine' },
    { id: 'post-natural', url: src('post-natural'), alt: 'Grapes on the vine at a low-intervention vineyard' },
    { id: 'post-pairings', url: src('post-pairings'), alt: 'A table set with wine, cheese and bread for sharing' },
    { id: 'post-tasting', url: src('post-tasting'), alt: 'A hand swirling wine in a glass to taste it' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-retail-wine-shop: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one low-lit photograph, a serif headline and a lead in a solid readable
 *  panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('wine-hero'), alt: 'Open bottles and stained glasses on a candle-lit table', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Wine made by people, not factories.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Sediment is a natural-wine shop. We buy from small growers who farm organically and let the wine make itself — nothing added, nothing stripped out. Bright, alive bottles, chosen by people who drink them.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the shelf' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/shop' },
                                            text: 'New to natural wine? Start here',
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
                        text: 'Pick your color',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'wine-tile-red', label: 'Red', href: '/shop', alt: 'A glass of chilled red held to the light' }),
                            categoryTile({ assetId: 'wine-tile-white', label: 'White', href: '/shop', alt: 'A cold bottle of white beaded with condensation' }),
                            categoryTile({ assetId: 'wine-tile-orange', label: 'Orange & pét-nat', href: '/shop', alt: 'A glass of cloudy amber skin-contact wine' }),
                            categoryTile({ assetId: 'wine-tile-rose', label: 'Rosé', href: '/shop', alt: 'A bottle of pale rosé on linen' }),
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
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Just landed' }),
    editorialBand({
        heading: 'Nothing added, nothing taken away',
        lead: 'Natural wine is farmed organically, fermented with its own wild yeast, and bottled with little or no added sulphur — no lab yeasts, no color, no fining agents, no filtering the life out of it. What that gets you is wine that tastes like the year, the place and the person who grew it.',
        assetId: 'wine-band-cellar',
        cta: 'How we choose our wine',
        href: '/blog/what-natural-wine-actually-means',
        alt: 'Dusty bottles resting on their sides in a cellar rack',
    }),
    productsBlock({ source: 'commerce.category.red', layout: 'carousel', heading: 'Chillable & juicy reds' }),
    editorialBand({
        heading: 'A case worth opening',
        lead: 'Not sure where to start? The mixed six is our pick of the shelf right now — three reds, three whites and oranges, all low-intervention, all delicious, at a better price than buying them one at a time. We swap it every month.',
        assetId: 'wine-band-club',
        cta: 'See the mixed six',
        href: '/products/the-weeknight-six',
        alt: 'A box of mixed wine bottles packed with tissue',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the bottle image. Right: the buy column (shop label, title, price, low-stock,
 *  description, add-to-cart, a static "how we'd drink it" note, and policy links). */
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
                                        text: 'Sediment · Natural Wine',
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
                                        label: 'Only a few left',
                                    }),
                                ],
                            }),
                            pdpDescription('text-lg leading-relaxed text-base-content'),
                            addToCartForm(),
                            el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                                children: [
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'How we drink it' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Serve it a touch cooler than you think — a light chill flatters almost everything on this shelf, reds included. Living wine can throw a little sediment or fizz; that is the wine, not a fault. Open it, give it a minute, and let it wake up.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Drinks well with' });

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
        'The whole shelf',
        'Everything we are pouring right now — reds, whites, skin-contact oranges, pét-nats, rosé, a magnum or two and a low-intervention non-alc. Filter by color or sort however you like; every bottle here is farmed clean and made with a light hand.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead(
        'Collections',
        'The bottles grouped the way people actually shop — what just landed, the low-intervention core, the ones to chill hard, our staff picks and the bottles worth keeping.'
    ),
];
const SEARCH: Node[] = [
    pageMasthead('Search Sediment', 'Looking for a grape, a color, a region or a pairing? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Free local delivery over $75, and every order is packed to travel safely. Not sure about a bottle? Tell us what you like and we will point you at the right one — buying wine should be fun, not a test.',
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
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Sediment journal' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Notes from behind the counter — what natural wine actually means, what to pour with dinner, and how to taste a bottle without the ceremony. Honest, useful, no snobbery.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Sediment' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Sediment started as a corner of a wine bar and a stubborn belief: that the most interesting bottles were the ones the big shops would not stock — made by small growers, farmed without chemicals, and left alone in the cellar to become themselves.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We buy from importers and growers we can name, and we taste everything before it hits the shelf. If a bottle is not honest, alive and worth the money, it does not make the cut — no matter how good the label looks or how fashionable the region has become.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'No gatekeeping, no lecture, no wine that needs a diagram to enjoy. Just a well-kept shelf of living wine and someone who is happy to help you find your next favourite bottle.',
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
        intro: 'After a bottle for a dinner, a case for a party, or a hand picking something for a gift? Tell us what you are after and a real person from the shop will get back to you — recommendations always welcome.',
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

/** A single-format bottle — one 750ml variant, no options. The natural default for most of
 *  the shelf; formats that genuinely vary (the magnum, the case) declare their own options. */
const bottle = (opts: {
    handle: string;
    title: string;
    description: string;
    price: number;
    sku: string;
    productType: string;
    categories: string[];
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
    productType: opts.productType,
    vendor: 'Sediment',
    tags: opts.tags,
    categoryHandles: opts.categories,
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    variants: [{ sku: opts.sku, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.alt }],
});

const PRODUCTS: Product[] = [
    bottle({
        handle: 'frizzante-petnat',
        title: 'Frizzante Pét-Nat',
        description:
            'A cloudy, crown-capped sparkler finished in the bottle the old way — one fermentation, no dosage, nothing added. Bone-dry and gently fizzy, with green apple, lemon pith and a little bready funk. The bottle we open first, every time.',
        price: 28,
        sku: 'SEDIMENT-PETNAT-01',
        productType: 'Sparkling wine',
        categories: ['orange-petnat'],
        collections: ['new-arrivals', 'low-intervention', 'chillable', 'staff-picks'],
        tags: ['pet-nat', 'sparkling', 'dry', 'chillable', 'natural'],
        asset: 'prod-petnat',
        alt: 'A crown-capped bottle of cloudy pét-nat sparkling wine',
        seoTitle: 'Frizzante Pét-Nat — dry sparkling natural wine | Sediment',
        seoDescription: 'A bone-dry, gently fizzy pét-nat finished in the bottle — green apple, lemon pith, a little bready funk.',
    }),
    bottle({
        handle: 'amber-hours-skin-contact',
        title: 'Amber Hours Skin-Contact',
        description:
            'White grapes left on their skins for two weeks, the way orange wine has been made for millennia. Deep amber, lightly tannic and properly savoury — dried apricot, orange peel, black tea and a grippy, moreish finish. Treat it like a light red.',
        price: 32,
        sku: 'SEDIMENT-ORANGE-01',
        productType: 'Orange wine',
        categories: ['orange-petnat'],
        collections: ['low-intervention', 'staff-picks', 'cellar-worthy'],
        tags: ['orange', 'skin-contact', 'savoury', 'natural'],
        asset: 'prod-orange',
        alt: 'A bottle of amber skin-contact orange wine',
        seoTitle: 'Amber Hours Skin-Contact — orange wine | Sediment',
        seoDescription: 'A properly savoury skin-contact orange wine — dried apricot, orange peel, black tea and a grippy finish.',
    }),
    bottle({
        handle: 'cold-press-chillable-red',
        title: 'Cold Press Chillable Red',
        description:
            'A light, bright red built to go in the fridge — low tannin, high glee. Crunchy red cherry, cranberry and a peppery lift, with a whole-bunch juiciness that begs for a half-hour chill. Pizza wine, picnic wine, Tuesday wine.',
        price: 24,
        sku: 'SEDIMENT-RED-CHILL-01',
        productType: 'Red wine',
        categories: ['red'],
        collections: ['new-arrivals', 'low-intervention', 'chillable', 'staff-picks'],
        tags: ['red', 'chillable', 'light-bodied', 'natural'],
        asset: 'prod-chill-red',
        alt: 'A bottle of bright, chillable red wine',
        seoTitle: 'Cold Press Chillable Red — light natural red | Sediment',
        seoDescription: 'A light, low-tannin red built for the fridge — crunchy red cherry, cranberry and a peppery lift.',
    }),
    bottle({
        handle: 'slate-and-stone-white',
        title: 'Slate & Stone White',
        description:
            'A taut, mineral white from old vines on poor soil — the kind that gives more flavour and less crop. Bone-dry and saline, with green apple, white flowers and a wet-stone snap that runs right through the finish. Oysters would be thrilled.',
        price: 26,
        sku: 'SEDIMENT-WHITE-01',
        productType: 'White wine',
        categories: ['white'],
        collections: ['low-intervention', 'staff-picks', 'cellar-worthy'],
        tags: ['white', 'mineral', 'dry', 'natural'],
        asset: 'prod-mineral-white',
        alt: 'A bottle of pale mineral white wine',
        seoTitle: 'Slate & Stone White — mineral natural white | Sediment',
        seoDescription: 'A taut, saline mineral white — green apple, white flowers and a wet-stone snap. Bone-dry.',
    }),
    bottle({
        handle: 'blush-riot-rose',
        title: 'Blush Riot Rosé',
        description:
            'A dry, pale rosé with none of the sugary softness the color gets blamed for. Wild strawberry, pink grapefruit and a herbal, savoury edge, with real texture underneath. The house rosé from the first warm day to the last.',
        price: 23,
        sku: 'SEDIMENT-ROSE-01',
        productType: 'Rosé wine',
        categories: ['rose'],
        collections: ['new-arrivals', 'low-intervention', 'chillable'],
        tags: ['rose', 'dry', 'chillable', 'natural'],
        asset: 'prod-rose',
        alt: 'A bottle of dry pale rosé',
        seoTitle: 'Blush Riot Rosé — dry natural rosé | Sediment',
        seoDescription: 'A dry, pale rosé with real texture — wild strawberry, pink grapefruit and a savoury, herbal edge.',
    }),
    bottle({
        handle: 'house-pour-everyday-red',
        title: 'House Pour Everyday Red',
        description:
            'The bottle we reach for on a weeknight and the one we recommend most. A medium red with dark cherry, plum and a little wild herb, soft enough to drink on its own and structured enough to sit with dinner. Great value, honestly farmed.',
        price: 21,
        sku: 'SEDIMENT-RED-HOUSE-01',
        productType: 'Red wine',
        categories: ['red'],
        collections: ['low-intervention', 'staff-picks'],
        tags: ['red', 'medium-bodied', 'everyday', 'natural'],
        asset: 'prod-everyday-red',
        alt: 'A bottle of easy everyday red wine',
        seoTitle: 'House Pour Everyday Red — natural red wine | Sediment',
        seoDescription: 'A soft, structured everyday red — dark cherry, plum and a little wild herb. Great value, honestly farmed.',
    }),
    bottle({
        handle: 'free-spirit-non-alc',
        title: 'Free Spirit Non-Alc Sparkling',
        description:
            'A grown-up alcohol-free sparkling for the nights you are not drinking but still want something in the good glass. Gently fizzy and properly dry, with white peach, elderflower and a citrus snap — none of the cloying sweetness most non-alc falls into.',
        price: 19,
        sku: 'SEDIMENT-NONALC-01',
        productType: 'Non-alcoholic',
        categories: ['white'],
        collections: ['new-arrivals', 'staff-picks'],
        tags: ['non-alc', 'sparkling', 'dry', 'alcohol-free'],
        asset: 'prod-nonalc',
        alt: 'A bottle of non-alcoholic sparkling wine on ice',
        seoTitle: 'Free Spirit Non-Alc Sparkling — alcohol-free wine | Sediment',
        seoDescription: 'A grown-up alcohol-free sparkling — dry, gently fizzy, white peach and elderflower. No cloying sweetness.',
    }),
    {
        handle: 'big-night-magnum',
        title: 'Big Night Magnum',
        description:
            'A magnum of our juicy house red — the same honest bottle, at twice the size and built for a full table. There is something about pulling the cork on a big format that turns a dinner into an occasion; wine keeps better and ages slower in a magnum, too.',
        status: 'active',
        productType: 'Red wine',
        vendor: 'Sediment',
        tags: ['red', 'magnum', 'large-format', 'gift', 'natural'],
        categoryHandles: ['red'],
        collectionHandles: ['gifts', 'cellar-worthy', 'staff-picks'],
        seoTitle: 'Big Night Magnum — 1.5L natural red wine | Sediment',
        seoDescription: 'A 1.5L magnum of our juicy house red — built for a full table and a real occasion.',
        options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: 'Magnum · 1.5L' }] }],
        variants: [
            { sku: 'SEDIMENT-MAGNUM-15L', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Magnum · 1.5L' } },
        ],
        images: [{ assetId: 'prod-magnum', isPrimary: true, alt: 'A magnum bottle of red wine on a table' }],
    },
    {
        handle: 'the-weeknight-six',
        title: 'The Weeknight Six',
        description:
            'Six bottles, our pick, at a better price than buying them one by one — the easiest way to fill the rack with low-intervention wine you will actually finish. Choose a mix of colors, all reds, or all whites and oranges; we swap the line-up every month.',
        status: 'active',
        productType: 'Mixed case',
        vendor: 'Sediment',
        tags: ['mixed-case', 'value', 'gift', 'natural'],
        categoryHandles: ['mixed-packs'],
        collectionHandles: ['new-arrivals', 'staff-picks', 'gifts'],
        seoTitle: 'The Weeknight Six — mixed natural wine case | Sediment',
        seoDescription: 'A curated six-bottle case of low-intervention wine at a better price — mixed, all red, or all white and orange.',
        options: [
            { name: 'Selection', displayType: 'dropdown', values: [{ value: 'Mixed colors' }, { value: 'All reds' }, { value: 'Whites & oranges' }] },
        ],
        variants: [
            { sku: 'SEDIMENT-SIX-MIX', priceCents: money(135), isDefault: true, inventoryPolicy: 'continue', optionValues: { Selection: 'Mixed colors' } },
            { sku: 'SEDIMENT-SIX-RED', priceCents: money(135), inventoryPolicy: 'continue', optionValues: { Selection: 'All reds' } },
            { sku: 'SEDIMENT-SIX-WHT', priceCents: money(135), inventoryPolicy: 'continue', optionValues: { Selection: 'Whites & oranges' } },
        ],
        images: [{ assetId: 'prod-sixpack', isPrimary: true, alt: 'Six wine bottles standing together in a cardboard case' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'red', name: 'Red', description: 'Light, chillable and structured natural reds.', featured: true },
        { handle: 'white', name: 'White', description: 'Mineral, textured and dry natural whites.', featured: true },
        { handle: 'orange-petnat', name: 'Orange & Pét-Nat', description: 'Skin-contact oranges and bottle-fermented sparkling.', featured: true },
        { handle: 'rose', name: 'Rosé', description: 'Dry, savoury pink wine with real texture.', featured: true },
        { handle: 'mixed-packs', name: 'Mixed packs', description: 'Curated cases at a better price.', featured: true },
    ],
    collections: [
        {
            handle: 'new-arrivals',
            name: 'Just landed',
            description: 'The newest bottles on the shelf.',
            type: 'manual',
            featured: true,
            productHandles: ['frizzante-petnat', 'cold-press-chillable-red', 'blush-riot-rose', 'free-spirit-non-alc', 'the-weeknight-six'],
        },
        {
            handle: 'low-intervention',
            name: 'Low intervention',
            description: 'Nothing added, nothing taken away.',
            type: 'manual',
            featured: true,
            productHandles: [
                'frizzante-petnat',
                'amber-hours-skin-contact',
                'cold-press-chillable-red',
                'slate-and-stone-white',
                'blush-riot-rose',
                'house-pour-everyday-red',
            ],
        },
        {
            handle: 'chillable',
            name: 'Chill it down',
            description: 'Everything that loves a half-hour in the fridge.',
            type: 'manual',
            featured: true,
            productHandles: ['frizzante-petnat', 'cold-press-chillable-red', 'blush-riot-rose'],
        },
        {
            handle: 'staff-picks',
            name: 'From the shop floor',
            description: 'What the counter is drinking this month.',
            type: 'manual',
            featured: false,
            productHandles: ['amber-hours-skin-contact', 'cold-press-chillable-red', 'slate-and-stone-white', 'house-pour-everyday-red'],
        },
        {
            handle: 'gifts',
            name: 'Worth gifting',
            description: 'Big formats and cases for the generous.',
            type: 'manual',
            featured: false,
            productHandles: ['big-night-magnum', 'the-weeknight-six'],
        },
        {
            handle: 'cellar-worthy',
            name: 'Lay it down',
            description: 'Bottles with the structure to age a while.',
            type: 'manual',
            featured: false,
            productHandles: ['amber-hours-skin-contact', 'slate-and-stone-white', 'big-night-magnum'],
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
        slug: 'what-natural-wine-actually-means',
        status: 'published',
        body: {
            title: 'What natural wine actually means',
            excerpt: 'It is not a legal term and it is not a marketing sticker. Here is what we mean by it when we put a bottle on the shelf.',
            featuredImage: { $asset: 'post-natural' },
            body: {
                type: 'doc',
                content: [
                    para('“Natural wine” gets used to sell a lot of things, and it has no legal definition, so it is worth saying plainly what we mean by it. For us it is a spectrum with two ends: how the grapes are farmed, and how little is done to the juice once it is picked. A bottle earns its place on our shelf by sitting well down both.'),
                    h2('In the vineyard'),
                    para('It starts with organic or biodynamic farming — no synthetic herbicides, pesticides or fertilisers — and usually with a small grower who picks by hand and actually walks their own rows. Healthy fruit off living soil is the whole game; you cannot fix bad farming in the cellar, and the best natural winemakers barely try to.'),
                    h2('In the cellar'),
                    para('Then, as little intervention as the wine allows. Fermentation with the wild yeast that arrives on the grapes, rather than a packet of lab yeast chosen for a predictable flavour. No added acid, color, tannin or sugar. No fining or heavy filtering to strip it clear. And little or no added sulphur — a touch at bottling is fine and often sensible; drowning the wine in it is not.'),
                    para('What you get for all that restraint is wine that tastes of a specific place and a specific year, and that moves in the glass as you drink it. It can be a little wilder than you are used to. That is not a fault to apologise for — it is the point.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'what-to-pour-with-dinner',
        status: 'published',
        body: {
            title: 'What to pour with dinner',
            excerpt: 'Forget the rules about red with meat. A few honest pairings that actually work, and one trick that covers almost everything.',
            featuredImage: { $asset: 'post-pairings' },
            body: {
                type: 'doc',
                content: [
                    para('Wine pairing has been made far more precious than it needs to be. The old rules — red with meat, white with fish — get you maybe half of the way and steer you wrong the rest. Here is how we actually think about it behind the counter.'),
                    h2('Match the weight, then the mood'),
                    para('The one trick that covers most of it: match the weight of the wine to the weight of the food. A delicate white flatters a delicate plate; a big magnum of red wants a roast. After that, look for a bridge — something acidic, herbal or savoury in the glass that echoes something on the plate. A saline mineral white next to oysters is not a coincidence, it is a rhyme.'),
                    h2('A few that never miss'),
                    para('Skin-contact orange with anything spiced, roasted or full of umami — curry, roast chicken, a hard cheese. A chillable red with pizza, charcuterie or a tomato-heavy anything. Dry rosé with a summer salad or grilled fish. Pét-nat with fried food, full stop; the fizz and acidity cut straight through the fat. And when in doubt, a bright natural white does more work than any single bottle has a right to.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'how-to-taste-a-bottle',
        status: 'published',
        body: {
            title: 'How to taste a bottle, without the ceremony',
            excerpt: 'Swirling and sniffing looks like a performance. It is actually just a quick way to figure out whether you like something — here is the whole method.',
            featuredImage: { $asset: 'post-tasting' },
            body: {
                type: 'doc',
                content: [
                    para('The swirling and sniffing can look like a performance, but stripped of the theatre it is just a fast, useful way to work out what a wine is doing and whether you like it. You can do the whole thing in twenty seconds and nobody has to know you are doing it.'),
                    h2('Look, smell, taste'),
                    para('Look first — color tells you about age and style before you have tasted a thing; a red going brick at the rim has some age on it, a cloudy white is probably unfiltered and natural. Then smell: swirl once to wake it up and take a short sniff. You are not naming twelve fruits, just noticing whether it smells fresh and alive or tired and flat. Then taste, and let it sit on your tongue for a second before you swallow.'),
                    h2('The three things worth noticing'),
                    para('Acidity is what makes your mouth water — it is freshness, and natural wine usually has it in spades. Tannin is the grippy, drying feeling, mostly in reds and oranges; it is texture, not a flaw. And length is simply how long the flavour hangs around after you swallow — the longer, generally, the better the wine. That is genuinely most of it. Notice those three, decide if you would pour a second glass, and you are tasting like a pro.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'retail-wine-shop',
    key: 'sparx-retail-wine-shop',
    name: 'Natural Wine Shop',
    theme: THEME,
    summary:
        'A complete, working shop for a natural-wine bottle shop: a real catalogue of low-intervention bottles — a pét-nat, a skin-contact orange, a chillable red, a mineral white, a dry rosé, a magnum, a mixed six and a non-alc — with categories, collections, a bespoke bottle-shop PDP and a fully merchandised home page. Low-lit cellar theme — deep plum-charcoal ground, warm cream ink, a wine-garnet primary and a brass accent. Shipped as Sediment.',
    tagline: 'A low-lit, working storefront for a natural-wine bottle shop.',
    vertical: 'retail',
    industry: 'Wine shop',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 86,
    brand: {
        businessName: 'Sediment',
        tagline: 'Wine made by people, not factories.',
    },
    chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
    seo: {
        home: {
            title: 'Sediment — a natural-wine bottle shop',
            description:
                'Sediment is a natural-wine shop — low-intervention reds, whites, skin-contact oranges, pét-nats and rosé from small growers who farm clean. Nothing added, nothing taken away.',
        },
        about: {
            title: 'About Sediment — natural wine, honestly chosen',
            description:
                'How Sediment buys and keeps its wine — small growers, organic farming, a light hand in the cellar, and a well-kept shelf of living bottles worth the money.',
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
