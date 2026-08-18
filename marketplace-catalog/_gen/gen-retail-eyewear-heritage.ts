// sparx-retail-eyewear-heritage — a RETAIL/COMMERCE site template: a heritage, hand-made
// eyewear house — the classic, artisanal counterpart to the modern DTC eyewear brand.
//
// A complete, working shop the moment it installs — a real catalogue of named acetate optical
// frames (each hand-finished in a range of tortoise / havana / crystal colorways, with a lens
// choice), hand-polished sunglasses, a reading pair, a limited-run anniversary collab, a leather
// case and a lens-care kit, plus categories + collections, a bespoke eyewear PDP and the full
// 9-page commerce site (home merchandising → shop → collections → cart → search → journal →
// about → contact), dressed in an INLINE bespoke theme (warm bone/tobacco paper, a deep bottle-
// green primary, a rich tobacco-brown accent, a high-contrast serif display). Shipped as
// Atelier Optique — hand-finished acetate, made the slow way since 1932.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries its OWN
// theme inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-eyewear-heritage.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-eyewear-heritage/**" \
//     "marketplace-catalog/_gen/gen-retail-eyewear-heritage.ts"
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
import { defineTheme, face, STATUS_ON_DARK, STATUS_ON_LIGHT } from '../../wizeworks/packages/silica-catalog/src/themes';
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
// A heritage optical house: a warm bone/tobacco paper ground, dark walnut ink, a deep bottle-
// green primary and a rich tobacco-brown accent, under a high-contrast serif display over a
// quiet humanist sans. Complete light + dark, AA on every role (the blueprint sweep's contrast
// check is the gate). Every role used as TEXT on the light ground sits at ≤ ~50% L so it stays
// legible; the accent is a warm tobacco that reads as a link, not a pale wash, and `secondary`
// is a dark walnut that stays readable on the bone paper.
const THEME = defineTheme({
    name: 'atelier-optique',
    type: { body: face('Libre Franklin', 'sans-serif'), head: face('Playfair Display', 'serif') },
    shape: { selector: '0.375rem', field: '0.25rem', box: '0.5rem', depth: '0' },
    light: {
        surfaces: ['oklch(96% 0.014 84)', 'oklch(93% 0.018 80)', 'oklch(88% 0.022 76)', 'oklch(23% 0.03 60)'],
        roles: {
            primary: 'oklch(34% 0.06 156)',
            secondary: 'oklch(40% 0.04 62)',
            accent: 'oklch(46% 0.11 56)',
            neutral: 'oklch(27% 0.03 60)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(22% 0.02 62)', 'oklch(19% 0.02 62)', 'oklch(16% 0.02 62)', 'oklch(94% 0.014 84)'],
        roles: {
            primary: 'oklch(74% 0.09 156)',
            secondary: 'oklch(79% 0.04 64)',
            accent: 'oklch(72% 0.11 58)',
            neutral: 'oklch(32% 0.02 62)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "eyewear-hero": "https://images.unsplash.com/photo-1503796627019-324e68809dc3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xvc2UtdXAlMjBoYW5kcyUyMGhhbmQtcG9saXNoaW5nJTIwYWNldGF0ZSUyMGZyYW1lJTIwd29ya2JlbmNofGVufDB8MHx8fDE3ODY0MTYxOTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-tile-optical": "https://images.unsplash.com/photo-1724385135035-2ef26d30e549?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpciUyMHRvcnRvaXNlJTIwYWNldGF0ZSUyMG9wdGljYWwlMjBmcmFtZXMlMjBsaW5lbiUyMGNsb3RofGVufDB8MHx8fDE3ODY0MTYxOTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-tile-sun": "https://images.unsplash.com/photo-1470526446583-d0fe2363d8cb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpciUyMGhhbmQtcG9saXNoZWQlMjBzdW5nbGFzc2VzJTIwd2FybSUyMGxpZ2h0fGVufDB8MHx8fDE3ODY0MTYxOTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-tile-reading": "https://images.unsplash.com/photo-1456081101716-74e616ab23d8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVhZGluZyUyMGdsYXNzZXMlMjByZXN0aW5nJTIwb3BlbiUyMGJvb2t8ZW58MHwwfHx8MTc4NjQxNjIwMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-tile-accessories": "https://images.unsplash.com/photo-1724927537639-a31846c7b94d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2FkZGxlLWxlYXRoZXIlMjBnbGFzc2VzJTIwY2FzZSUyMGJlc2lkZSUyMHBvbGlzaGluZyUyMGNsb3RofGVufDB8MHx8fDE3ODY0MTYyMDZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-band-craft": "https://images.unsplash.com/photo-1603578119639-798b8413d8d7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWNldGF0ZSUyMGZyYW1lJTIwZnJvbnQlMjBiZWluZyUyMHNoYXBlZCUyMGZpbGVkJTIwYnl8ZW58MHwwfHx8MTc4NjQxNjIwOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-band-heritage": "https://images.unsplash.com/photo-1610850760052-edbc52ef7618?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b2xkJTIwd29ya3Nob3AlMjBiZW5jaCUyMHZpbnRhZ2UlMjBmcmFtZS1tYWtpbmclMjB0b29sc3xlbnwwfDB8fHwxNzg2NDE2MjExfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-study": "https://images.unsplash.com/photo-1764737707504-f1ce82f76a16?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8c3R1ZHklMjByZWFkZXIlMjBhY2V0YXRlJTIwcmVhZGluZyUyMGdsYXNzZXN8ZW58MHwwfHx8MTc4NjQxNjIyOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-1932": "https://images.unsplash.com/photo-1694010326811-53864439958d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8MTkzMiUyMGFubml2ZXJzYXJ5JTIwbGltaXRlZC1ydW4lMjBhY2V0YXRlJTIwZnJhbWV8ZW58MHwwfHx8MTc4NjQxNjIzMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-case": "https://images.unsplash.com/photo-1514876708437-c1a520bbff01?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2FkZGxlJTIwY2FzZSUyMGhhbmQtc3RpdGNoZWQlMjBsZWF0aGVyJTIwZ2xhc3NlcyUyMGNhc2V8ZW58MHwwfHx8MTc4NjQxNjIzNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-kit": "https://images.unsplash.com/photo-1741253689523-68ff10ed8b56?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmVuY2glMjBraXQlMjBsZW5zJTIwY2xvdGglMjBhbGNvaG9sLWZyZWUlMjBzcHJheSUyMGhpbmdlfGVufDB8MHx8fDE3ODY0MTYyMzd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-acetate": "https://images.unsplash.com/photo-1642723877928-fc99e1bcfd27?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8c2hlZXRzJTIwdG9ydG9pc2UlMjBhY2V0YXRlJTIwc3RhY2tlZCUyMGZyYW1lLW1ha2luZyUyMHdvcmtzaG9wfGVufDB8MHx8fDE3ODY0MTYyNDF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-fit": "https://images.unsplash.com/photo-1577410114274-ef015b5b6d29?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3B0aWNpYW4lMjBtZWFzdXJpbmclMjBmcmFtZSUyMGFnYWluc3QlMjBmYWNlfGVufDB8MHx8fDE3ODY0MTYyNDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-1932": "https://images.unsplash.com/photo-1544722712-54c530e43ea1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXJjaGl2YWwlMjBwaG90b2dyYXBoJTIwZm91bmRpbmclMjB3b3Jrc2hvcHxlbnwwfDB8fHwxNzg2NDE2MjQ3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'eyewear-hero', url: src('eyewear-hero'), alt: 'A close-up of hands hand-polishing an acetate frame at a workbench' },
    { id: 'eyewear-tile-optical', url: src('eyewear-tile-optical'), alt: 'A pair of tortoise acetate optical frames on a linen cloth' },
    { id: 'eyewear-tile-sun', url: src('eyewear-tile-sun'), alt: 'A pair of hand-polished sunglasses in warm light' },
    { id: 'eyewear-tile-reading', url: src('eyewear-tile-reading'), alt: 'Reading glasses resting on an open book' },
    { id: 'eyewear-tile-accessories', url: src('eyewear-tile-accessories'), alt: 'A saddle-leather glasses case beside a polishing cloth' },
    { id: 'eyewear-band-craft', url: src('eyewear-band-craft'), alt: 'An acetate frame front being shaped and filed by hand' },
    { id: 'eyewear-band-heritage', url: src('eyewear-band-heritage'), alt: 'An old workshop bench with vintage frame-making tools' },
    { id: 'prod-beaumont', url: src('prod-beaumont'), alt: 'The Beaumont round panto acetate optical frame' },
    { id: 'prod-ellsworth', url: src('prod-ellsworth'), alt: 'The Ellsworth bold rectangular acetate optical frame' },
    { id: 'prod-marguerite', url: src('prod-marguerite'), alt: 'The Marguerite cat-eye acetate optical frame' },
    { id: 'prod-whitfield', url: src('prod-whitfield'), alt: 'The Whitfield small keyhole panto optical frame' },
    { id: 'prod-riviera', url: src('prod-riviera'), alt: 'The Riviera hand-polished acetate sunglasses' },
    { id: 'prod-cassis', url: src('prod-cassis'), alt: 'The Cassis round hand-polished sunglasses' },
    { id: 'prod-study', url: src('prod-study'), alt: 'The Study Reader acetate reading glasses' },
    { id: 'prod-1932', url: src('prod-1932'), alt: 'The 1932 Anniversary limited-run acetate frame' },
    { id: 'prod-case', url: src('prod-case'), alt: 'The Saddle Case — hand-stitched leather glasses case' },
    { id: 'prod-kit', url: src('prod-kit'), alt: 'The Bench Kit — lens cloth, alcohol-free spray and hinge oil' },
    { id: 'post-acetate', url: src('post-acetate'), alt: 'Sheets of tortoise acetate stacked at a frame-making workshop' },
    { id: 'post-fit', url: src('post-fit'), alt: 'An optician measuring a frame against a face' },
    { id: 'post-1932', url: src('post-1932'), alt: 'An archival photograph of the founding workshop' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-retail-eyewear-heritage: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warm workshop photograph, a serif headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('eyewear-hero'), alt: 'Hands hand-polishing an acetate frame at a workbench', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Hand-finished acetate, made the slow way.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Atelier Optique has cut, shaped and polished frames by hand since 1932. Every pair is turned from a single block of Italian acetate over five weeks and forty pairs of hands — glasses built to be worn for a lifetime, and handed on after it.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the collection' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/blog/the-making-of-a-frame' },
                                            text: 'How a frame is made',
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
                        text: 'The house, by shape',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'eyewear-tile-optical', label: 'Optical', href: '/shop', alt: 'Tortoise acetate optical frames on linen' }),
                            categoryTile({ assetId: 'eyewear-tile-sun', label: 'Sun', href: '/shop', alt: 'Hand-polished sunglasses in warm light' }),
                            categoryTile({ assetId: 'eyewear-tile-reading', label: 'Reading', href: '/shop', alt: 'Reading glasses resting on an open book' }),
                            categoryTile({ assetId: 'eyewear-tile-accessories', label: 'Accessories', href: '/shop', alt: 'A leather case beside a polishing cloth' }),
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
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New off the bench' }),
    editorialBand({
        heading: 'Cut from a single block',
        lead: 'We don’t injection-mould or assemble from parts. Each frame front is milled from one block of Mazzucchelli acetate, then tumbled in beechwood drums for days until it comes up with the deep, living lustre only hand-polishing gives. It is slower, and it is the whole point.',
        assetId: 'eyewear-band-craft',
        cta: 'The making of a frame',
        href: '/blog/the-making-of-a-frame',
        alt: 'An acetate frame front being shaped and filed by hand',
    }),
    productsBlock({ source: 'commerce.category.optical', layout: 'carousel', heading: 'The optical collection' }),
    editorialBand({
        heading: 'A workshop since 1932',
        lead: 'Three generations have stood at the same benches, using tools our grandfather ground himself. We still glaze every lens in-house, still fit each pair by hand, and still repair anything we’ve ever made. A frame from Atelier Optique is meant to outlast the trend that sold it.',
        assetId: 'eyewear-band-heritage',
        cta: 'Our story',
        href: '/about',
        alt: 'An old workshop bench with vintage frame-making tools',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static "hand-finished & glazed in-house" note, and policy links). */
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
                                        text: 'Atelier Optique — since 1932',
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
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Hand-finished & glazed in-house' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Choose your lens at checkout — prescription, blue-light or plain — and add your prescription now or later. Every pair is hand-polished, five-barrel riveted and cut to your lenses on our own bench, then delivered in a hand-stitched leather case. Adjustments and repairs are free, for life.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'From the same bench' });

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
        'The collection',
        'Every frame the house makes — optical, sun and reading — each hand-finished in its own acetate colorways, with the lens choice built in. Filter by shape or category, or sort however you like; all of it is cut and glazed to order on our bench.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead('Collections', 'The frames grouped the way people actually shop — new off the bench, the best-loved shapes, the full optical line, sun, the reading room, and the 1932 series struck in limited numbers each year.'),
];
const SEARCH: Node[] = [
    pageMasthead('Search Atelier Optique', 'Looking for a shape, a colorway, or a note from the workshop? Search the whole house and the journal below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Complimentary shipping and a leather case with every pair, and thirty days to be sure. Not certain of your prescription? Add it after checkout — we’ll hold your order and email a gentle reminder. Adjustments and repairs are free, for the life of the frame.',
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
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The workshop journal' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Notes from the bench — how a frame is made, how to find the shape that suits you, and the ninety-year story behind the house. Plain, unhurried, and written by the people who file the acetate.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Atelier Optique' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'In 1932, a young frame-maker set up a bench in a narrow workshop and began cutting spectacle fronts from sheets of acetate by hand. Ninety years on, his grandchildren stand at the same benches, using some of the same tools, making frames the same unhurried way. Little has changed, because little needed to.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We buy our acetate from the same Italian mill our grandfather did, choosing the sheets by eye for depth and figure the way you’d choose timber. Each frame front is milled from a single block, then tumbled in beechwood drums for days and polished by hand until it takes on a lustre no machine can rush. Hinges are set with five barrels and steel rivets — the joint that lasts a lifetime, not a season.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Every lens is glazed on our own bench, every pair fitted by hand, and anything we have ever made, we will always repair. A frame from this house is not meant to be replaced next year. It is meant to be worn until it’s yours, then handed on — which is the only kind of luxury we believe in.',
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
        heading: 'Call on the workshop',
        intro: 'Unsure which shape suits you, need a hand reading your prescription, or want a frame repaired or refitted? Write to the bench and one of the makers — not a call centre — will write back to you personally.',
        submitLabel: 'Write to the bench',
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

/** A short, unique-within-product option code for a SKU suffix (Havana → HAV). */
const optCode = (s: string): string => s.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();

/** A frame product — a Color swatch (the acetate colorway) × a Lens dropdown (the lens type),
 *  every combination a real, buyable variant. Default is the first color × first lens. */
const frame = (opts: {
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
    productType?: string;
    colors?: string[];
    lenses?: string[];
}): Product => {
    const colors = opts.colors ?? ['Havana', 'Amber Tortoise', 'Smoke Crystal'];
    const lenses = opts.lenses ?? ['Prescription', 'Blue-light'];
    const variants: Variant[] = [];
    colors.forEach((c, ci) => {
        lenses.forEach((l, li) => {
            variants.push({
                sku: `${opts.sku}-${optCode(c)}-${optCode(l)}`,
                priceCents: money(opts.price),
                ...(ci === 0 && li === 0 ? { isDefault: true as const } : {}),
                inventoryPolicy: 'continue',
                optionValues: { Color: c, Lens: l },
            });
        });
    });
    return {
        handle: opts.handle,
        title: opts.title,
        description: opts.description,
        status: 'active',
        productType: opts.productType ?? 'Eyewear',
        vendor: 'Atelier Optique',
        tags: opts.tags,
        categoryHandles: opts.categories,
        collectionHandles: opts.collections,
        seoTitle: opts.seoTitle,
        seoDescription: opts.seoDescription,
        options: [
            { name: 'Color', displayType: 'swatch', values: colors.map((v) => ({ value: v })) },
            { name: 'Lens', displayType: 'dropdown', values: lenses.map((v) => ({ value: v })) },
        ],
        variants,
        images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
    };
};

const PRODUCTS: Product[] = [
    frame({
        handle: 'beaumont',
        title: 'The Beaumont',
        description:
            'The frame the house is known for — a rounded panto in hand-finished acetate, its curve softened by hand until it flatters almost any face. Milled from a single block, tumbled for days and set on five-barrel hinges, it has been cut on this bench, largely unchanged, since 1948.',
        price: 285,
        sku: 'AO-BEAUMONT',
        categories: ['optical'],
        collections: ['off-the-bench', 'optical-line', 'best-loved'],
        tags: ['optical', 'panto', 'round', 'acetate', 'signature'],
        asset: 'prod-beaumont',
        seoTitle: 'The Beaumont — hand-finished panto optical frame | Atelier Optique',
        seoDescription: 'A rounded panto in hand-polished Italian acetate, cut from a single block on five-barrel hinges. Prescription or blue-light.',
    }),
    frame({
        handle: 'ellsworth',
        title: 'The Ellsworth',
        description:
            'A bold rectangular front for a face that can carry it — deep, architectural and quietly confident, with a heavy brow line and a keen-cut bevel that catches the light. The dark havana is figured like walnut; no two fronts are ever quite the same.',
        price: 295,
        sku: 'AO-ELLSWORTH',
        categories: ['optical'],
        collections: ['off-the-bench', 'optical-line'],
        tags: ['optical', 'rectangle', 'acetate', 'bold'],
        asset: 'prod-ellsworth',
        colors: ['Dark Havana', 'Ebony', 'Honey Crystal'],
        seoTitle: 'The Ellsworth — bold rectangular acetate frame | Atelier Optique',
        seoDescription: 'A deep, architectural rectangular front in figured dark-havana acetate, hand-bevelled and polished. Prescription or blue-light.',
    }),
    frame({
        handle: 'marguerite',
        title: 'The Marguerite',
        description:
            'A gently lifted cat-eye, drawn from a 1950s pattern still pinned to the workshop wall. The upsweep is filed by hand so the line stays soft rather than sharp — flattering, a little bit of an occasion, and made to be worn every ordinary day as well.',
        price: 290,
        sku: 'AO-MARGUERITE',
        categories: ['optical'],
        collections: ['optical-line', 'best-loved'],
        tags: ['optical', 'cat-eye', 'acetate', 'vintage'],
        asset: 'prod-marguerite',
        colors: ['Rose Tortoise', 'Havana', 'Onyx'],
        seoTitle: 'The Marguerite — hand-filed cat-eye frame | Atelier Optique',
        seoDescription: 'A softly lifted cat-eye drawn from a 1950s workshop pattern, hand-filed in figured acetate. Prescription or blue-light.',
    }),
    frame({
        handle: 'whitfield',
        title: 'The Whitfield',
        description:
            'A small keyhole panto with a scholarly air — the pince-nez’s well-mannered descendant. Light on the face and quietly characterful, with a hand-cut keyhole bridge and slender temples that disappear into the hair. The reading-room frame, made properly.',
        price: 275,
        sku: 'AO-WHITFIELD',
        categories: ['optical'],
        collections: ['optical-line'],
        tags: ['optical', 'keyhole', 'panto', 'small', 'acetate'],
        asset: 'prod-whitfield',
        colors: ['Olive Tortoise', 'Amber', 'Crystal'],
        seoTitle: 'The Whitfield — keyhole panto optical frame | Atelier Optique',
        seoDescription: 'A small, scholarly keyhole panto with a hand-cut bridge in figured acetate. Prescription or blue-light.',
    }),
    frame({
        handle: 'riviera',
        title: 'The Riviera',
        description:
            'A hand-polished sunglass with a mid-century squareness and a warm, glassy finish you only get from days in the drums. UV400 as standard, with the option of polarised lenses ground to cut glare off water and road — the pair for a long drive south, or a slow lunch in the sun.',
        price: 265,
        sku: 'AO-RIVIERA',
        categories: ['sun'],
        collections: ['off-the-bench', 'sun', 'best-loved'],
        tags: ['sun', 'sunglasses', 'uv400', 'acetate'],
        asset: 'prod-riviera',
        colors: ['Tortoise', 'Bottle Green', 'Ebony'],
        lenses: ['Classic tint', 'Polarised', 'Prescription sun'],
        seoTitle: 'The Riviera — hand-polished acetate sunglasses | Atelier Optique',
        seoDescription: 'A mid-century squared sunglass in hand-polished acetate with UV400 lenses — classic, polarised or prescription.',
    }),
    frame({
        handle: 'cassis',
        title: 'The Cassis',
        description:
            'A generous round sunglass with a slim acetate rim and a retro tilt — sun-struck and easy, the pair you reach for without thinking. Hand-polished to a deep shine and fitted with UV400 lenses; take it polarised for the water, or prescription so you can finally read the menu.',
        price: 255,
        sku: 'AO-CASSIS',
        categories: ['sun'],
        collections: ['sun'],
        tags: ['sun', 'sunglasses', 'round', 'uv400'],
        asset: 'prod-cassis',
        colors: ['Honey', 'Tortoise', 'Ebony'],
        lenses: ['Classic tint', 'Polarised', 'Prescription sun'],
        seoTitle: 'The Cassis — round hand-polished sunglasses | Atelier Optique',
        seoDescription: 'A generous round acetate sunglass, hand-polished with UV400 lenses — classic, polarised or prescription.',
    }),
    frame({
        handle: 'study-reader',
        title: 'The Study Reader',
        description:
            'A proper reading frame, not a chemist’s afterthought — the same acetate, the same five-barrel hinges and the same hand-polish as the optical line, glazed with magnified reading lenses in the strength you choose. The pair on the bedside table, made to be as good as the one on your face.',
        price: 165,
        sku: 'AO-STUDY',
        categories: ['reading'],
        collections: ['reading', 'off-the-bench'],
        tags: ['reading', 'acetate', 'optical'],
        asset: 'prod-study',
        colors: ['Havana', 'Amber Tortoise', 'Onyx'],
        lenses: ['+1.00', '+1.50', '+2.00', '+2.50'],
        seoTitle: 'The Study Reader — hand-finished reading glasses | Atelier Optique',
        seoDescription: 'Well-made reading glasses in hand-polished acetate, glazed to the strength you choose. Havana, amber tortoise or onyx.',
    }),
    frame({
        handle: 'anniversary-1932',
        title: 'The 1932 Anniversary',
        description:
            'Struck in small numbers each year to mark the year we began — a faithful reissue of the workshop’s very first pattern, cut from a special run of amber-and-ink laminated acetate we lay up by hand. Individually numbered, engraved at the temple, and boxed with a copy of the original 1932 drawing.',
        price: 385,
        sku: 'AO-1932',
        categories: ['optical'],
        collections: ['limited-1932', 'off-the-bench'],
        tags: ['optical', 'limited', 'numbered', 'acetate', 'archive'],
        asset: 'prod-1932',
        colors: ['Archive Amber', 'Ink Tortoise'],
        lenses: ['Prescription', 'Blue-light', 'Plain'],
        seoTitle: 'The 1932 Anniversary — limited numbered frame | Atelier Optique',
        seoDescription: 'A numbered limited-run reissue of the workshop’s first 1932 pattern in hand-laid laminated acetate. Prescription, blue-light or plain.',
    }),
    {
        handle: 'saddle-case',
        title: 'The Saddle Case',
        description:
            'A hard glasses case cut and stitched by hand from vegetable-tanned saddle leather, lined in soft suede and closed with a solid brass press-stud. It ages the way good leather should — darkening and softening with a decade of pockets — and it comes free with every frame, or on its own here.',
        status: 'active',
        productType: 'Accessory',
        vendor: 'Atelier Optique',
        tags: ['accessories', 'leather', 'case'],
        categoryHandles: ['accessories'],
        collectionHandles: ['off-the-bench'],
        seoTitle: 'The Saddle Case — hand-stitched leather glasses case | Atelier Optique',
        seoDescription: 'A hard glasses case in hand-stitched vegetable-tanned saddle leather, suede-lined with a brass press-stud.',
        variants: [{ sku: 'AO-CASE', priceCents: money(45), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-case', isPrimary: true, alt: 'A hand-stitched leather glasses case' }],
    },
    {
        handle: 'bench-kit',
        title: 'The Bench Kit',
        description:
            'The small kit we keep at the bench, boxed for home — a lint-free polishing cloth, an alcohol-free lens spray that won’t strip a coating, and a phial of hinge oil to keep the temples swinging sweetly. Everything a good pair of glasses needs to last for decades, and nothing it doesn’t.',
        status: 'active',
        productType: 'Accessory',
        vendor: 'Atelier Optique',
        tags: ['accessories', 'care', 'kit'],
        categoryHandles: ['accessories'],
        collectionHandles: ['off-the-bench'],
        seoTitle: 'The Bench Kit — lens cloth, spray & hinge oil | Atelier Optique',
        seoDescription: 'A frame-care kit — lint-free cloth, alcohol-free lens spray and hinge oil — boxed for home from the workshop bench.',
        variants: [{ sku: 'AO-KIT', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-kit', isPrimary: true, alt: 'A frame-care kit — cloth, spray and hinge oil' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'optical', name: 'Optical', description: 'Hand-finished prescription and blue-light frames.', featured: true },
        { handle: 'sun', name: 'Sun', description: 'Hand-polished sunglasses with UV400 lenses.', featured: true },
        { handle: 'reading', name: 'Reading', description: 'Proper reading frames, glazed to strength.', featured: true },
        { handle: 'accessories', name: 'Accessories', description: 'Leather cases and frame care.', featured: true },
    ],
    collections: [
        {
            handle: 'off-the-bench',
            name: 'New off the bench',
            description: 'The latest frames to come off the workshop bench.',
            type: 'manual',
            featured: true,
            productHandles: ['beaumont', 'ellsworth', 'riviera', 'anniversary-1932'],
        },
        {
            handle: 'best-loved',
            name: 'Best loved',
            description: 'The shapes worn for a lifetime.',
            type: 'manual',
            featured: true,
            productHandles: ['beaumont', 'marguerite', 'riviera'],
        },
        {
            handle: 'optical-line',
            name: 'The optical line',
            description: 'The full hand-finished optical collection.',
            type: 'manual',
            featured: false,
            productHandles: ['beaumont', 'ellsworth', 'marguerite', 'whitfield'],
        },
        {
            handle: 'sun',
            name: 'Sun',
            description: 'Hand-polished sunglasses in classic, polarised and prescription.',
            type: 'manual',
            featured: false,
            productHandles: ['riviera', 'cassis'],
        },
        {
            handle: 'reading',
            name: 'The reading room',
            description: 'Reading frames glazed to the strength you choose.',
            type: 'manual',
            featured: false,
            productHandles: ['study-reader', 'whitfield'],
        },
        {
            handle: 'limited-1932',
            name: 'The 1932 series',
            description: 'Numbered limited runs from the archive.',
            type: 'manual',
            featured: true,
            productHandles: ['anniversary-1932'],
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
        slug: 'the-making-of-a-frame',
        status: 'published',
        body: {
            title: 'The making of a frame, from block to bench',
            excerpt: 'Five weeks, forty pairs of hands, and a single block of acetate. Here is how a pair of Atelier Optique glasses is actually made — and why we still do it the slow way.',
            featuredImage: { $asset: 'post-acetate' },
            body: {
                type: 'doc',
                content: [
                    para('A frame begins as a flat sheet of acetate — a plant-based plastic pressed from cotton fibre and set with color and figure right through the block, not sprayed on the surface. We buy ours from a mill in northern Italy that has supplied this workshop for three generations, and we choose the sheets by eye, the way you’d choose a cut of timber, for the depth and movement in the pattern.'),
                    h2('Milled from a single block'),
                    para('Rather than assemble a frame from moulded parts, we mill each front from one solid block. It is slower and it wastes more material, but it means the grain runs unbroken across the frame and there are no seams to fail. The front is then cut, drilled for hinges, and the rims hollowed for the lenses — still, at this stage, matte and lifeless to look at.'),
                    h2('Days in the drums, then the hand-polish'),
                    para('The magic is in the finishing. Each frame goes into rotating beechwood drums with pumice and small wooden pegs and tumbles for days, knocking off every tool mark. Then a maker takes it to a cloth wheel and polishes it by hand until the acetate comes up with a deep, wet lustre — the living shine that tells you a frame was finished by a person, not a machine. Only then do we set the five-barrel hinges with steel rivets, and only then does it earn the name on the temple.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'finding-your-shape',
        status: 'published',
        body: {
            title: 'Finding the shape that suits you',
            excerpt: 'The old rule is balance and contrast — round softens angles, angular sharpens curves. Here is how that plays out across the house, with the frames to start from.',
            featuredImage: { $asset: 'post-fit' },
            body: {
                type: 'doc',
                content: [
                    para('There is one idea behind every guide to choosing glasses: balance and contrast. A frame that gently contrasts with the lines of your face tends to flatter it, while one that echoes your shape can amplify it. It is a rule of thumb, not a law — but it’s a good place to begin, and the house has a shape for each starting point.'),
                    h2('Softer faces, stronger lines'),
                    para('If your face is round or full, with soft curves and a similar width and length, a little architecture flatters you — the rectangular Ellsworth adds definition, and the lifted line of the Marguerite draws the eye up and out. The idea is to lend the face a few clean edges to play against.'),
                    h2('Stronger faces, softer frames'),
                    para('If your face is square or angular, with a strong jaw and brow, do the opposite and soften it. The rounded Beaumont is the house answer — its hand-filed panto curve takes the edge off without hiding your features — and the smaller Whitfield does the same in a lighter, more scholarly key. Oval faces, the lucky ones, can wear almost anything; shop by the mood you want and trust your own eye over any rule.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'ninety-years-at-the-bench',
        status: 'published',
        body: {
            title: 'Ninety years at the same bench',
            excerpt: 'A workshop, three generations and one stubborn idea: that a pair of glasses should outlast the trend that sold it. A short history of the house.',
            featuredImage: { $asset: 'post-1932' },
            body: {
                type: 'doc',
                content: [
                    para('The workshop opened in 1932, when our grandfather rented a narrow room, bought a lathe and a set of files, and began cutting spectacle fronts from acetate for the town’s opticians. The first pattern he drew — a modest rounded panto — is still pinned above the bench, and we still strike a numbered run of it every year as the 1932 Anniversary.'),
                    h2('Three generations, one method'),
                    para('The tools have barely changed, and neither has the method. We still mill from a single block, still tumble in beechwood drums, still polish by hand and set the hinges with five barrels and steel rivets. New machines can make a frame faster; none can make it better, and we have never been in a hurry. What has grown is only the reach — the same bench now sends frames around the world.'),
                    h2('Made to be handed on'),
                    para('The idea that has kept the lights on for ninety years is a simple, almost old-fashioned one: a good frame should be repaired, not replaced. So we glaze every lens ourselves, adjust and repair anything we have ever made for free, and build each pair heavy enough in the hand to be worn for decades and then passed to someone else. That, and not the price, is what we mean by luxury.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'retail-eyewear-heritage',
    key: 'sparx-retail-eyewear-heritage',
    name: 'Eyewear (Heritage)',
    theme: THEME,
    summary:
        'A complete, working shop for a heritage, hand-made eyewear house: named acetate optical frames (each hand-finished in its own colorways with a lens choice), hand-polished sunglasses, a reading pair, a numbered limited-run frame, a leather case and a care kit, with categories, collections, a bespoke PDP and a merchandised home page. Warm heritage theme — bone/tobacco paper, a bottle-green primary, a tobacco accent, a serif display. Shipped as Atelier Optique.',
    tagline: 'A warm, working storefront for a heritage hand-made eyewear house.',
    vertical: 'retail',
    industry: 'Eyewear & optical',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 85,
    brand: {
        businessName: 'Atelier Optique',
        tagline: 'Hand-finished acetate, made the slow way since 1932.',
    },
    chrome: { navbar: 'centerLogo', footer: 'columns', showCta: false },
    seo: {
        home: {
            title: 'Atelier Optique — hand-finished eyewear, made since 1932',
            description:
                'Atelier Optique cuts, shapes and hand-polishes acetate eyewear the slow way, on the same benches since 1932 — optical, sun and reading frames, glazed in-house, repaired for life.',
        },
        about: {
            title: 'About Atelier Optique',
            description:
                'Ninety years at the same bench — how Atelier Optique mills each frame from a single block of Italian acetate, hand-polishes it, glazes it in-house, and repairs it for life.',
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
