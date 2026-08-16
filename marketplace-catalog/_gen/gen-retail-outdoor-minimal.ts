// sparx-retail-outdoor-minimal — a RETAIL/COMMERCE site template: a clean, design-led
// urban-outdoor & technical-essentials shop.
//
// The MINIMAL counterpart to the rugged field outfitter (gen-retail-outdoor-rugged.ts):
// same retail family, opposite temperament. Where Ridgeline is weathered stone-khaki,
// blaze-orange and uppercase field-labels, Tarn is a cool near-white ground, a single
// restrained blue accent, a crisp grotesk and big studio-on-white product shots — a
// design object, not a trail sign. A complete, working shop the moment it installs: a
// real catalogue (a minimalist shell, a merino tee, technical trousers, an everyday pack,
// a packable tote, a cap, an insulated bottle and wool socks), categories + collections,
// a bespoke minimal PDP, the full 9-page commerce site (home merchandising → shop →
// collections → cart → search → journal → about → contact). Shipped as Tarn.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme
// inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The
// shared `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-outdoor-minimal.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-outdoor-minimal/**" \
//     "marketplace-catalog/_gen/gen-retail-outdoor-minimal.ts"
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
// A design studio, not a field: a cool near-white PAPER ground (chroma ≤ .008, a faint
// blue cast, reads as gallery white and not warm cream), a near-black cool primary that
// carries the whole thing, a mid cool-grey secondary dark enough to set small labels in,
// and ONE restrained cool-blue accent — the only saturated thing on the page, spent on
// links and the odd signal. A crisp grotesk pairing (Manrope over Inter), hairline
// corners, zero depth: goods drawn like the studio still-life they shipped as. Complete
// light + dark, AA on every role (the blueprint sweep's contrast check is the gate).
const THEME = defineTheme({
    name: 'tarn-clean',
    type: { body: face('Inter', 'sans-serif'), head: face('Manrope', 'sans-serif') },
    shape: { selector: '0.125rem', field: '0.125rem', box: '0.25rem', depth: '0' },
    light: {
        surfaces: ['oklch(98% 0.004 250)', 'oklch(96% 0.006 250)', 'oklch(91% 0.008 250)', 'oklch(24% 0.012 258)'],
        roles: {
            primary: 'oklch(28% 0.016 258)',
            secondary: 'oklch(45% 0.02 258)',
            accent: 'oklch(50% 0.14 250)',
            neutral: 'oklch(30% 0.014 258)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(22% 0.01 258)', 'oklch(18% 0.01 258)', 'oklch(15% 0.01 258)', 'oklch(96% 0.004 250)'],
        roles: {
            primary: 'oklch(90% 0.01 250)',
            secondary: 'oklch(78% 0.02 250)',
            accent: 'oklch(74% 0.13 250)',
            neutral: 'oklch(32% 0.012 258)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "tarn-hero": "https://images.unsplash.com/photo-1714674119460-8b362f2f9840?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlJTIwdGVjaG5pY2FsJTIwc2hlbGx8ZW58MHwwfHx8MTc4NjQwNjQ4M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tarn-tile-apparel": "https://images.unsplash.com/photo-1710179380559-d6bad3299327?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwbWVyaW5vJTIwdGVlJTIwc2hlbGwlMjBsaWdodCUyMGdyZXklMjBzdXJmYWNlfGVufDB8MHx8fDE3ODY0MDYyNzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tarn-tile-bags": "https://images.unsplash.com/photo-1534955079751-1aa62877271c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWluaW1hbGlzdCUyMGNvbW11dGVyJTIwcGFjayUyMHN0YW5kaW5nJTIwYWdhaW5zdCUyMHBsYWluJTIwd2FsbHxlbnwwfDB8fHwxNzg2NDA2Mjc0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tarn-tile-accessories": "https://images.unsplash.com/photo-1589895868947-b51095d437f3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2l4LXBhbmVsJTIwY2FwJTIwZm9sZGVkJTIwd29vbCUyMHNvY2tzJTIwd2hpdGV8ZW58MHwwfHx8MTc4NjQwNjI3N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tarn-tile-essentials": "https://images.unsplash.com/photo-1624469786827-13be4e09a992?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aW5zdWxhdGVkJTIwYm90dGxlJTIwcGhvdG9ncmFwaGVkfGVufDB8MHx8fDE3ODY0MDY0ODd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tarn-band-fewer": "https://images.unsplash.com/photo-1711445508277-be5ac846f64a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWRpdCUyMHBpZWNlcyUyMGFycmFuZ2VkfGVufDB8MHx8fDE3ODY0MDY0OTB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tarn-band-citytotrail": "https://images.unsplash.com/photo-1690310456664-95dd7d447190?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2FtZSUyMGphY2tldCUyMHdvcm4lMjBjaXR5JTIwc3RyZWV0JTIwb3BlbiUyMHRyYWlsfGVufDB8MHx8fDE3ODY0MDYyODV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-merino-tee": "https://images.unsplash.com/photo-1651761179569-4ba2aa054997?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXZlcnlkYXklMjBtZXJpbm8lMjB0ZWUlMjBmb2xkZWQlMjB3aGl0ZXxlbnwwfDB8fHwxNzg2NDA2MjkxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-trousers": "https://images.unsplash.com/photo-1521793058626-ed9f16aa00c5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJhdmVyc2UlMjB0ZWNobmljYWwlMjB0cm91c2Vyc3xlbnwwfDB8fHwxNzg2NDA2NDk1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-pack": "https://images.unsplash.com/photo-1620361422673-0bac7117ece5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8Y29tbXV0ZXIlMjBwYWNrJTIwMjAlMjBzdGFuZGluZyUyMGFnYWluc3QlMjBwbGFpbiUyMGJhY2tncm91bmR8ZW58MHwwfHx8MTc4NjQwNjI5Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-tote": "https://images.unsplash.com/photo-1605204780077-378f7e101d24?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFja2FibGUlMjB0b3RlJTIwc2hvd24lMjBvcGVuJTIwcGFja2VkJTIwZG93biUyMGJlc2lkZXxlbnwwfDB8fHwxNzg2NDA2MzAwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-cap": "https://images.unsplash.com/photo-1767164057024-b4024aaf11e3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8c2l4LXBhbmVsJTIwY2FwJTIwcGhvdG9ncmFwaGVkJTIwc2lkZSUyMHdoaXRlfGVufDB8MHx8fDE3ODY0MDYzMDN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-bottle": "https://images.unsplash.com/photo-1605539585404-a846f1193d19?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aW5zdWxhdGVkJTIwYm90dGxlJTIwY2xlYW4lMjBwYWxlJTIwZ3JvdW5kJTIwbGlkJTIwb2ZmfGVufDB8MHx8fDE3ODY0MDYzMDZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-socks": "https://images.unsplash.com/photo-1613151402692-bafe4fd1c5a6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwbWVyaW5vJTIwdHJhaWx8ZW58MHwwfHx8MTc4NjQwNjQ5OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-fewer-better": "https://images.unsplash.com/photo-1777462985111-9da64fb2e6e6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGwlMjBjb25zaWRlcmVkJTIwd2FyZHJvYmUlMjBwaWVjZXMlMjBsYWlkJTIwb3V0JTIwZmxhdHxlbnwwfDB8fHwxNzg2NDA2MzExfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-city-to-trail": "https://images.unsplash.com/photo-1631728370215-9440df2e29e3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29tbXV0ZXIlMjBiYWclMjBzaGVsbCUyMHN0YWdlZCUyMGRheSUyMHRoYXQlMjBzdGFydHN8ZW58MHwwfHx8MTc4NjQwNjMxNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-merino": "https://images.unsplash.com/photo-1595026525047-dfa997df8a4a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xvc2UlMjBjcm9wJTIwZmluZSUyMG1lcmlubyUyMGtuaXQlMjBmYWJyaWN8ZW58MHwwfHx8MTc4NjQwNjMxOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'tarn-hero', url: src('tarn-hero'), alt: 'A single technical shell laid flat on a pale studio sweep in soft daylight' },
    { id: 'tarn-tile-apparel', url: src('tarn-tile-apparel'), alt: 'A folded merino tee and a shell on a light grey surface' },
    { id: 'tarn-tile-bags', url: src('tarn-tile-bags'), alt: 'A minimalist commuter pack standing against a plain wall' },
    { id: 'tarn-tile-accessories', url: src('tarn-tile-accessories'), alt: 'A six-panel cap and folded wool socks on white' },
    { id: 'tarn-tile-essentials', url: src('tarn-tile-essentials'), alt: 'An insulated bottle photographed on a clean pale ground' },
    { id: 'tarn-band-fewer', url: src('tarn-band-fewer'), alt: 'A small edit of pieces arranged in a neat grid on a studio table' },
    { id: 'tarn-band-citytotrail', url: src('tarn-band-citytotrail'), alt: 'The same jacket worn on a city street and on an open trail' },
    { id: 'prod-shell-jacket', url: src('prod-shell-jacket'), alt: 'The Featherline Shell jacket on a pale studio sweep' },
    { id: 'prod-merino-tee', url: src('prod-merino-tee'), alt: 'The Everyday Merino tee folded on white' },
    { id: 'prod-trousers', url: src('prod-trousers'), alt: 'The Traverse technical trousers laid flat on light grey' },
    { id: 'prod-pack', url: src('prod-pack'), alt: 'The Commuter Pack 20 standing against a plain background' },
    { id: 'prod-tote', url: src('prod-tote'), alt: 'The Packable Tote shown open and packed down beside it' },
    { id: 'prod-cap', url: src('prod-cap'), alt: 'The Six-Panel Cap photographed from the side on white' },
    { id: 'prod-bottle', url: src('prod-bottle'), alt: 'The Insulated Bottle on a clean pale ground, lid off' },
    { id: 'prod-socks', url: src('prod-socks'), alt: 'A folded pair of Merino Trail socks on a light surface' },
    { id: 'post-fewer-better', url: src('post-fewer-better'), alt: 'A small, considered wardrobe of pieces laid out flat' },
    { id: 'post-city-to-trail', url: src('post-city-to-trail'), alt: 'A commuter bag and a shell staged for a day that starts in the city' },
    { id: 'post-merino', url: src('post-merino'), alt: 'A close crop of fine merino knit fabric' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-retail-outdoor-minimal: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one calm studio photograph, a grotesk headline and a lead in a
 *  solid readable panel anchored bottom-left, a filled shop CTA + a quiet text link.
 *  Restrained weights and sentence case carry the minimal temperament; never ink on the
 *  photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('tarn-hero'), alt: 'A single technical shell on a pale studio sweep', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Fewer, better things for city and trail.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Tarn makes a small line of technical essentials that work as well on the 7am commute as on a Sunday ridgeline. Considered materials, quiet design, nothing you have to explain — pieces you reach for every day and keep for years.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the edit' }),
                                        el('a', 'text-base font-medium text-accent underline underline-offset-4', {
                                            attrs: { href: '/collections' },
                                            text: 'City to trail',
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

/** One category tile — a photo with a quiet label beneath, the whole tile a link. Sentence
 *  case, medium weight: the minimal register, not the field outfitter's shouting caps. */
function categoryTile(o: { assetId: string; label: string; href: string; alt: string }): Node {
    return el('a', 'group flex flex-col gap-3', {
        attrs: { href: o.href },
        children: [
            el('img', 'aspect-square w-full rounded-box bg-base-200 object-cover transition group-hover:opacity-90', {
                attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
            }),
            el('span', 'text-center text-base font-medium tracking-tight text-base-content', { text: o.label }),
        ],
    });
}

function categoryTiles(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('h2', 'text-3xl font-semibold tracking-tight text-base-content @3xl:text-4xl', {
                        text: 'Shop by category',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'tarn-tile-apparel', label: 'Apparel', href: '/shop', alt: 'A folded merino tee and a shell' }),
                            categoryTile({ assetId: 'tarn-tile-bags', label: 'Bags', href: '/shop', alt: 'A minimalist commuter pack' }),
                            categoryTile({ assetId: 'tarn-tile-accessories', label: 'Accessories', href: '/shop', alt: 'A cap and folded wool socks' }),
                            categoryTile({ assetId: 'tarn-tile-essentials', label: 'Essentials', href: '/shop', alt: 'An insulated bottle on white' }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** A full-bleed editorial band — a photo carrying a heading, a lead and a quiet link,
 *  panel bottom-left. */
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
                                el('h2', 'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-5xl', {
                                    text: o.heading,
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', { text: o.lead }),
                                el('a', 'text-base font-medium text-accent underline underline-offset-4', {
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
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New in' }),
    editorialBand({
        heading: 'Designed to be owned, not replaced',
        lead: 'We keep the range deliberately short. Each piece earns its place — the right fabric, the details that matter and none that don’t — so a Tarn shell or tee is one you buy once and wear for years. Fewer, better things, made to be lived in.',
        assetId: 'tarn-band-fewer',
        cta: 'How we design',
        href: '/blog/fewer-better-things',
        alt: 'A small edit of pieces arranged in a neat grid',
    }),
    productsBlock({ source: 'commerce.category.apparel', layout: 'carousel', heading: 'The apparel edit' }),
    editorialBand({
        heading: 'One kit, city to trail',
        lead: 'A day that starts on a train and ends on a ridge shouldn’t need two wardrobes. Everything Tarn makes is built to move between them — technical enough for the weather, quiet enough for the office — so you pack lighter and think about it less.',
        assetId: 'tarn-band-citytotrail',
        cta: 'Build a city-to-trail kit',
        href: '/blog/city-to-trail',
        alt: 'The same jacket worn on a city street and on an open trail',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image on a clean pale panel. Right: the buy column (a quiet brand
 *  label, title, price, low-stock, description, add-to-cart, a static made-to-last note,
 *  and policy links). Restrained weights and generous space carry the minimal look. */
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
                                    el('p', 'text-sm font-medium uppercase tracking-widest text-secondary', {
                                        text: 'Tarn',
                                    }),
                                    pdpTitle('h1', 'text-4xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-5xl'),
                                    pdpPriceRow({
                                        priceClass: 'text-2xl font-semibold text-base-content',
                                        compareClass: 'text-lg text-secondary line-through',
                                        rowClass: 'flex items-baseline gap-4',
                                    }),
                                    pdpStockBadge({
                                        className:
                                            'inline-flex w-fit items-center gap-2 rounded-field border border-base-300 px-3 py-1 text-xs font-medium uppercase tracking-widest text-base-content',
                                        label: 'Low stock',
                                    }),
                                ],
                            }),
                            pdpDescription('text-lg leading-relaxed text-base-content'),
                            addToCartForm(),
                            el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-200 p-5', {
                                children: [
                                    el('h2', 'text-sm font-medium uppercase tracking-widest text-secondary', { text: 'Made to last' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Every piece is cut from materials chosen to wear in, not out, and finished to be repaired rather than replaced. Free carbon-neutral shipping over $75, easy 30-day returns, and a real person on hand if you’re between sizes.',
                                    }),
                                ],
                            }),
                            pdpPolicyLinks({
                                className:
                                    'flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-base-300 pt-5 text-sm font-medium uppercase tracking-widest text-base-content',
                                linkClass: 'underline underline-offset-4',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Completes the edit' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(heading: string, lead: string): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl', {
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
        'Shop the edit',
        'The whole Tarn range in one place — apparel, bags, accessories and the everyday essentials that go everywhere. Filter by category or sort however you like; each piece is considered, versatile and built to be kept.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead('Collections', 'The range grouped the way you actually shop it — what just landed, the pieces people reach for daily, a full city-to-trail kit, and the merino edit we’re quietly known for.'),
];
const SEARCH: Node[] = [
    pageMasthead('Search Tarn', 'Looking for a shell, a size, a color or a guide? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl', { text: 'Your bag' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Free carbon-neutral shipping over $75, and easy 30-day returns on everything. Between sizes or not sure a color’s right? Tell us before you check out and we’ll help you get it right the first time.',
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
                    el('h1', 'text-5xl font-semibold leading-tight tracking-tight text-base-content @3xl:text-6xl', { text: 'The journal' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Notes on design and everyday carry — why we make fewer things, how to build one kit for the city and the trail, and what actually makes a fabric worth keeping. Plain and useful, no hype.',
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
                    el('h1', 'text-5xl font-semibold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Tarn' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Tarn started with a simple frustration: a wardrobe split between technical gear that looked out of place in the city and city clothes that fell apart on the trail. So we set out to make one small line that quietly does both — considered, versatile pieces you can wear on a Monday commute and a Saturday summit without a second thought.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We keep the range short on purpose. Every piece is designed around the fabric first, stripped of anything it doesn’t need, and made in small runs with makers we know. If it isn’t genuinely better than what you already own, we don’t make it.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'And we build for the long run, not the season. Materials chosen to wear in rather than out, construction meant to be repaired, and a take-back programme for the day a piece has truly reached the end. The most sustainable thing we can make is something you keep.',
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
        intro: 'Questions about fit, a color, a repair or an order? Tell us what you’re after and a real person who wears the pieces will get back to you — usually within a day.',
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

const APPAREL_SIZES = ['XS', 'S', 'M', 'L', 'XL'];
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
 *  colors that share a 3-letter prefix (Slate / Storm) never collide in a SKU. */
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

/** A sized garment — Size × Color grid of variants generated so the storefront's dropdown +
 *  swatch resolve real options. */
const garment = (opts: {
    handle: string;
    title: string;
    description: string;
    price: number;
    sku: string;
    category: string;
    collections: string[];
    tags: string[];
    colors: string[];
    asset: string;
    seoTitle: string;
    seoDescription: string;
    sizes?: string[];
}): Product => {
    const sizes = opts.sizes ?? APPAREL_SIZES;
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
        productType: 'Apparel',
        vendor: 'Tarn',
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

/** A color-only good — no size, offered in a set of colors (packs, totes, caps, socks). */
const colorGood = (opts: {
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
        productType: opts.productType,
        vendor: 'Tarn',
        tags: opts.tags,
        categoryHandles: [opts.category],
        collectionHandles: opts.collections,
        seoTitle: opts.seoTitle,
        seoDescription: opts.seoDescription,
        options: [colorOption(opts.colors)],
        variants,
        images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
    };
};

/** A sized-by-capacity good — one dropdown of volumes (the bottle). */
const sizedGood = (opts: {
    handle: string;
    title: string;
    description: string;
    optionName: string;
    sizes: { label: string; price: number }[];
    sku: string;
    productType: string;
    category: string;
    collections: string[];
    tags: string[];
    asset: string;
    seoTitle: string;
    seoDescription: string;
}): Product => {
    const codes = uniqueCodes(opts.sizes.map((s) => s.label));
    const variants: Variant[] = opts.sizes.map((s, i) => ({
        sku: `${opts.sku}-${codes[s.label]}`,
        priceCents: money(s.price),
        ...(i === 0 ? { isDefault: true as const } : {}),
        inventoryPolicy: 'continue',
        optionValues: { [opts.optionName]: s.label },
    }));
    return {
        handle: opts.handle,
        title: opts.title,
        description: opts.description,
        status: 'active',
        productType: opts.productType,
        vendor: 'Tarn',
        tags: opts.tags,
        categoryHandles: [opts.category],
        collectionHandles: opts.collections,
        seoTitle: opts.seoTitle,
        seoDescription: opts.seoDescription,
        options: [{ name: opts.optionName, displayType: 'dropdown', values: opts.sizes.map((s) => ({ value: s.label })) }],
        variants,
        images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
    };
};

const PRODUCTS: Product[] = [
    garment({
        handle: 'featherline-shell-jacket',
        title: 'Featherline Shell Jacket',
        description:
            'A minimalist 2.5-layer waterproof shell that weighs almost nothing and disappears into a jacket pocket. Fully taped seams keep the weather out, underarm vents let it back in on the climb, and a clean, unbranded cut means it reads as easily on a city street as on an exposed ridge. The one shell that covers the whole week.',
        price: 245,
        sku: 'TARN-SHELL',
        category: 'apparel',
        collections: ['new-in', 'city-to-trail', 'best-loved'],
        tags: ['apparel', 'shell', 'waterproof', 'outerwear'],
        colors: ['Fog', 'Ink', 'Sage'],
        asset: 'prod-shell-jacket',
        seoTitle: 'Featherline Shell Jacket — packable 2.5-layer waterproof | Tarn',
        seoDescription: 'A minimal, packable 2.5-layer waterproof shell with taped seams and pit vents. City-clean, trail-ready.',
    }),
    garment({
        handle: 'everyday-merino-tee',
        title: 'Everyday Merino Tee',
        description:
            'A fine-gauge merino tee that behaves like your favourite cotton one but wicks, breathes and resists odour for days between washes. A clean crew neck, a trim-but-not-tight cut and a hand that stays soft wash after wash — the layer you’ll pack for one day and end up wearing for three.',
        price: 68,
        sku: 'TARN-TEE',
        category: 'apparel',
        collections: ['new-in', 'the-merino-edit', 'best-loved'],
        tags: ['apparel', 'merino', 'base-layer', 'tee'],
        colors: ['Bone', 'Ink', 'Slate'],
        asset: 'prod-merino-tee',
        seoTitle: 'Everyday Merino Tee — fine-gauge merino crew | Tarn',
        seoDescription: 'A soft, odour-resistant fine-gauge merino tee with a clean crew neck and a trim everyday cut.',
    }),
    garment({
        handle: 'traverse-trousers',
        title: 'Traverse Trousers',
        description:
            'A technical trouser cut clean enough for the office and stretchy enough for a scramble. A four-way stretch weave sheds light rain and dries fast, a gusseted crotch moves with you, and zip security pockets keep a phone and keys close. Tailored lines, hidden performance — trousers that never look like gear.',
        price: 118,
        sku: 'TARN-TROU',
        category: 'apparel',
        collections: ['new-in', 'city-to-trail'],
        tags: ['apparel', 'trousers', 'technical', 'stretch'],
        colors: ['Ink', 'Stone', 'Olive'],
        asset: 'prod-trousers',
        seoTitle: 'Traverse Trousers — technical stretch trousers | Tarn',
        seoDescription: 'A clean-cut four-way-stretch technical trouser that sheds light rain and dries fast. Office to trail.',
    }),
    colorGood({
        handle: 'commuter-pack-20',
        title: 'Commuter Pack 20',
        description:
            'A 20-litre daypack pared back to what a day actually needs — a padded laptop sleeve, a clean single main compartment, and a weatherproof roll-top that flexes from a light load to a full one. No dangling straps, no logos, no clutter. The pack that looks right in a meeting and a downpour both.',
        price: 165,
        sku: 'TARN-PACK20',
        productType: 'Bag',
        category: 'bags',
        collections: ['new-in', 'city-to-trail', 'best-loved'],
        tags: ['bags', 'daypack', 'commuter'],
        colors: ['Ink', 'Fog', 'Olive'],
        asset: 'prod-pack',
        seoTitle: 'Commuter Pack 20 — 20L weatherproof daypack | Tarn',
        seoDescription: 'A pared-back 20L roll-top daypack with a padded laptop sleeve. Clean enough for the office, sealed for the rain.',
    }),
    colorGood({
        handle: 'packable-tote',
        title: 'Packable Tote',
        description:
            'A roomy 18-litre tote in a tough, feather-light ripstop that folds into its own inner pocket the size of a wallet. Keep one in the pack for the market run, the extra layer or the overflow on the way home. Water-resistant, wipe-clean, and quietly good-looking empty or full.',
        price: 42,
        sku: 'TARN-TOTE',
        productType: 'Bag',
        category: 'bags',
        collections: ['best-loved', 'the-everyday'],
        tags: ['bags', 'tote', 'packable'],
        colors: ['Bone', 'Ink', 'Sage'],
        asset: 'prod-tote',
        seoTitle: 'Packable Tote — 18L ripstop tote | Tarn',
        seoDescription: 'A light, water-resistant 18L ripstop tote that folds into its own pocket. For the market run and the overflow.',
    }),
    colorGood({
        handle: 'six-panel-cap',
        title: 'Six-Panel Cap',
        description:
            'A clean six-panel cap in a quick-drying technical twill with a soft, packable brim that survives a rolled-up spot in a bag. An unstructured fit and an understated tonal finish keep it from ever looking like a souvenir. The cap you grab on the way out without thinking about it.',
        price: 38,
        sku: 'TARN-CAP',
        productType: 'Accessories',
        category: 'accessories',
        collections: ['new-in', 'the-everyday'],
        tags: ['accessories', 'cap', 'headwear'],
        colors: ['Ink', 'Stone', 'Sage'],
        asset: 'prod-cap',
        seoTitle: 'Six-Panel Cap — packable technical cap | Tarn',
        seoDescription: 'A clean, unstructured six-panel cap in quick-drying twill with a soft packable brim. Understated and tonal.',
    }),
    colorGood({
        handle: 'merino-trail-socks',
        title: 'Merino Trail Socks',
        description:
            'A fine merino-blend sock cushioned exactly where it counts and thin where it doesn’t — a supportive arch, a seamless toe and enough wool to stay warm damp and fresh for days. Cut to sit neat under a trainer or a boot alike, and knit to hold its shape long past the point most socks give up.',
        price: 22,
        sku: 'TARN-SOCK',
        productType: 'Accessories',
        category: 'accessories',
        collections: ['the-merino-edit', 'the-everyday'],
        tags: ['accessories', 'socks', 'merino'],
        colors: ['Bone', 'Charcoal', 'Sage'],
        asset: 'prod-socks',
        seoTitle: 'Merino Trail Socks — cushioned merino-blend socks | Tarn',
        seoDescription: 'A fine merino-blend sock with targeted cushioning, an arch band and a seamless toe. Warm, fresh and hard-wearing.',
    }),
    sizedGood({
        handle: 'insulated-bottle',
        title: 'Insulated Bottle',
        description:
            'A double-walled stainless bottle in a matte, fingerprint-proof finish that keeps water cold to the summit or coffee hot to the desk. A leak-proof lid drinks one-handed, the narrow profile slips into a pack pocket or a cup holder, and the whole thing is built to be the last bottle you buy. Two sizes for the day out or the desk.',
        optionName: 'Size',
        sizes: [
            { label: '500ml', price: 34 },
            { label: '750ml', price: 40 },
        ],
        sku: 'TARN-BOTTLE',
        productType: 'Essentials',
        category: 'essentials',
        collections: ['new-in', 'the-everyday', 'best-loved'],
        tags: ['essentials', 'bottle', 'hydration'],
        asset: 'prod-bottle',
        seoTitle: 'Insulated Bottle — matte double-walled stainless | Tarn',
        seoDescription: 'A matte double-walled stainless bottle in 500 and 750ml with a leak-proof one-handed lid. Built to be the last one.',
    }),
];

const COMMERCE = {
    categories: [
        { handle: 'apparel', name: 'Apparel', description: 'Shells, merino and technical layers.', featured: true },
        { handle: 'bags', name: 'Bags', description: 'Packs and totes, pared back.', featured: true },
        { handle: 'accessories', name: 'Accessories', description: 'Caps, socks and the small stuff.', featured: true },
        { handle: 'essentials', name: 'Essentials', description: 'The everyday-carry hardware.', featured: true },
    ],
    collections: [
        {
            handle: 'new-in',
            name: 'New in',
            description: 'The latest pieces to join the range.',
            type: 'manual',
            featured: true,
            productHandles: ['featherline-shell-jacket', 'everyday-merino-tee', 'commuter-pack-20', 'insulated-bottle'],
        },
        {
            handle: 'best-loved',
            name: 'Best loved',
            description: 'The pieces people reach for every day.',
            type: 'manual',
            featured: true,
            productHandles: ['featherline-shell-jacket', 'everyday-merino-tee', 'commuter-pack-20', 'packable-tote', 'insulated-bottle'],
        },
        {
            handle: 'city-to-trail',
            name: 'City to trail',
            description: 'One versatile kit for the commute and the climb.',
            type: 'manual',
            featured: true,
            productHandles: ['featherline-shell-jacket', 'traverse-trousers', 'commuter-pack-20'],
        },
        {
            handle: 'the-merino-edit',
            name: 'The merino edit',
            description: 'The soft, odour-resistant wool we’re known for.',
            type: 'manual',
            featured: false,
            productHandles: ['everyday-merino-tee', 'merino-trail-socks'],
        },
        {
            handle: 'the-everyday',
            name: 'The everyday',
            description: 'The small, useful things you carry without thinking.',
            type: 'manual',
            featured: false,
            productHandles: ['packable-tote', 'six-panel-cap', 'merino-trail-socks', 'insulated-bottle'],
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
        slug: 'fewer-better-things',
        status: 'published',
        body: {
            title: 'Fewer, better things: how we decide what to make',
            excerpt: 'A short range is a series of decisions about what to leave out. Here’s the test a piece has to pass before it earns a place in the line.',
            featuredImage: { $asset: 'post-fewer-better' },
            body: {
                type: 'doc',
                content: [
                    para('The easiest thing in the world is to make more. Another colorway, a seasonal print, a slightly different pocket — every one is a small sale and a small piece of clutter, and enough of them turn a considered brand into a catalogue. We decided early that Tarn would be defined by what we don’t make, which means most ideas have to fail a test before the good ones can pass it.'),
                    h2('Does it earn its place?'),
                    para('Before anything is designed we ask one question: is this genuinely better than what you already own, or just different? If a new trouser doesn’t beat the trouser in your drawer on fabric, fit or longevity, there’s no reason for it to exist and we don’t make it. That single filter kills most of what we sketch — and it’s why the pieces that survive tend to be the ones you keep reaching for.'),
                    h2('Design around the fabric, then subtract'),
                    para('We start with the material, not the silhouette. Get the fabric right and half the design decisions make themselves; get it wrong and no amount of detailing rescues it. From there the work is mostly removal — every seam, tab and logo has to justify itself, and the ones that can’t come off. What’s left looks simple, which is the hardest thing to arrive at and the whole point of the exercise.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'city-to-trail',
        status: 'published',
        body: {
            title: 'One kit for the city and the trail',
            excerpt: 'You don’t need two wardrobes for a day that starts on a train and ends on a ridge. Here’s how to pack one that does both.',
            featuredImage: { $asset: 'post-city-to-trail' },
            body: {
                type: 'doc',
                content: [
                    para('Most of us live in the overlap. The same day holds a commute, a desk, a walk that turns into more of a walk than planned, and weather that can’t make up its mind. Dressing for it usually means a compromise in one direction — gear that looks out of place indoors, or clothes that quit the moment the path tilts up. It doesn’t have to. A small, deliberate kit covers the whole range if each piece is chosen to cross over.'),
                    h2('Layers that read both ways'),
                    para('Start with a merino tee — it wicks and resists odour for the active half of the day and looks like a plain, good tee for the rest. Add a technical trouser cut clean enough for the office, and a packable shell that lives in your bag until the sky opens. Nothing here announces itself as outdoor gear, and nothing gives up when you actually use it that way. That’s the whole trick: performance you can’t see.'),
                    h2('Carry light, decide less'),
                    para('The bag matters as much as what’s in it. A pared-back daypack with a laptop sleeve and a weatherproof roll-top handles the commute and the trail without a second one, and a tote that folds to wallet-size covers the overflow on the way home. Pack it once and you stop thinking about it — which is really the point. The best kit is the one you never have to plan around.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'why-merino',
        status: 'published',
        body: {
            title: 'Why we keep coming back to merino',
            excerpt: 'It’s the closest thing to a do-everything fabric — and once you understand why, most synthetics start to look like a compromise.',
            featuredImage: { $asset: 'post-merino' },
            body: {
                type: 'doc',
                content: [
                    para('If you could only own one performance fabric, it would be merino wool. Not the itchy, heavy wool of an old jumper — the fine-gauge kind, spun from fibres a fraction the width, that feels like a soft cotton and behaves like nothing else. We keep coming back to it because it quietly solves problems other materials only trade between.'),
                    h2('Warm, cool, and hard to smell'),
                    para('Merino regulates temperature in both directions: the same tee that keeps you warm on a cold platform breathes and wicks when you’re moving, so you’re rarely the too-hot or too-cold one. And because of how the fibre handles moisture and bacteria, it resists odour for days — the reason a merino layer is the traveller’s secret for packing light and wearing the same thing far longer than seems decent.'),
                    h2('Made to be kept'),
                    para('Good merino also wears in rather than out. It holds its shape, resists wrinkles, and only needs a wash when it genuinely does, which is gentler on the fabric and on your time. Cared for simply — cool wash, dry flat — a fine merino piece stays good for years. That longevity is the whole reason it fits how we build: a material worth keeping, in things designed to be kept.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'retail-outdoor-minimal',
    key: 'sparx-retail-outdoor-minimal',
    name: 'Outdoor Essentials (Minimal)',
    theme: THEME,
    summary:
        'A complete, working shop for a clean, design-led urban-outdoor label: a real catalogue of a packable shell, a merino tee, technical trousers, a commuter pack, a packable tote, a cap, an insulated bottle and merino socks — with categories, collections, a minimal PDP and a fully merchandised home page. Design-studio theme — a cool near-white ground, a near-black primary and a single restrained blue accent, under a crisp grotesk. Shipped as Tarn.',
    tagline: 'A clean, working storefront for a design-led outdoor label.',
    vertical: 'retail',
    industry: 'Outdoor & technical essentials',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 83,
    brand: {
        businessName: 'Tarn',
        tagline: 'Fewer, better things for city and trail.',
    },
    chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
    seo: {
        home: {
            title: 'Tarn — considered technical essentials for city and trail',
            description:
                'Tarn makes a small, design-led line of technical essentials — a packable shell, merino layers, clean bags and everyday-carry hardware — built to move between the commute and the trail. Fewer, better things.',
        },
        about: {
            title: 'About Tarn',
            description:
                'Why Tarn keeps the range short — pieces designed around the fabric, stripped of what they don’t need, and built to be kept rather than replaced.',
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
