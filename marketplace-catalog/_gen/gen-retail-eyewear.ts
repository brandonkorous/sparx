// sparx-retail-eyewear — a RETAIL/COMMERCE site template: a direct-to-consumer eyewear brand.
//
// A complete, working shop the moment it installs — a real catalogue of optical frames (each
// in tortoise / black / crystal, with a lens choice), sunglasses, a blue-light pair, a reading
// pair, a free home try-on kit and a care accessory, plus categories + collections, a bespoke
// eyewear PDP and the full 9-page commerce site (home merchandising → shop → collections → cart
// → search → journal → about → contact), dressed in an INLINE bespoke theme (crisp warm-neutral
// paper, a confident deep-teal primary, a warm tortoise accent). Shipped as Frame & Lens.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family, this generator carries its OWN
// theme inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-eyewear.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-eyewear/**" \
//     "marketplace-catalog/_gen/gen-retail-eyewear.ts"
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
// A modern fashion-optical look: a crisp warm-neutral paper ground, near-ink teal type, a
// confident deep-teal primary and a warm tortoise accent, under a clean grotesk over a
// humanist sans. Complete light + dark, AA on every role (the blueprint sweep's contrast
// check is the gate). Every role used as TEXT on the light ground sits at ≤ ~50% L so it
// stays legible; the accent is a rich tortoise that reads as a link, not a pale wash.
const THEME = defineTheme({
    name: 'framelens-modern',
    type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
    shape: { selector: '0.5rem', field: '0.375rem', box: '0.75rem', depth: '0' },
    light: {
        surfaces: ['oklch(98% 0.006 90)', 'oklch(95% 0.01 88)', 'oklch(90% 0.014 84)', 'oklch(22% 0.02 205)'],
        roles: {
            primary: 'oklch(40% 0.09 200)',
            secondary: 'oklch(44% 0.05 210)',
            accent: 'oklch(50% 0.13 55)',
            neutral: 'oklch(26% 0.02 205)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(20% 0.016 210)', 'oklch(17% 0.016 210)', 'oklch(14% 0.016 210)', 'oklch(95% 0.008 90)'],
        roles: {
            primary: 'oklch(78% 0.1 200)',
            secondary: 'oklch(79% 0.05 210)',
            accent: 'oklch(76% 0.12 58)',
            neutral: 'oklch(30% 0.016 210)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "eyewear-hero": "https://images.unsplash.com/photo-1513673054901-2b5f51551112?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmFjZS1vbiUyMHBvcnRyYWl0JTIwd2VhcmluZyUyMG1vZGVybiUyMHRvcnRvaXNlJTIwb3B0aWNhbCUyMGZyYW1lc3xlbnwwfDB8fHwxNzg2NDA2MTU0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-tile-optical": "https://images.unsplash.com/photo-1483412468200-72182dbbc544?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpciUyMGFjZXRhdGUlMjBvcHRpY2FsJTIwZnJhbWVzJTIwbGFpZCUyMGZsYXR8ZW58MHwwfHx8MTc4NjQwNjE1N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-tile-sun": "https://images.unsplash.com/photo-1761918993979-cb7e442f2be9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFpciUyMHN1bmdsYXNzZXMlMjBicmlnaHQlMjBkYXlsaWdodHxlbnwwfDB8fHwxNzg2NDA2MTU5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-tile-blue": "https://images.unsplash.com/photo-1639789975707-965add2cf0e0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ymx1ZS1saWdodCUyMGdsYXNzZXMlMjByZXN0aW5nJTIwbGFwdG9wJTIwa2V5Ym9hcmR8ZW58MHwwfHx8MTc4NjQwNjE2M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-tile-accessories": "https://images.unsplash.com/photo-1665525549743-9c9ab3ad1972?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwbWljcm9maWJyZSUyMGNsb3RoJTIwaGFyZCUyMGV5ZXdlYXIlMjBjYXNlfGVufDB8MHx8fDE3ODY0MDYxNjZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-band-tryon": "https://images.unsplash.com/photo-1636434588538-f524b8d54199?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zml2ZSUyMGZyYW1lcyUyMGFycmFuZ2VkJTIwaG9tZSUyMHRyeS1vbiUyMGJveHxlbnwwfDB8fHwxNzg2NDA2MTcwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "eyewear-band-lenses": "https://images.unsplash.com/photo-1763630730215-d97346f23065?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGVucyUyMGJlaW5nJTIwaW5zcGVjdGVkJTIwYWdhaW5zdCUyMGxpZ2h0JTIwd29ya3Nob3B8ZW58MHwwfHx8MTc4NjQwNjE3M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-ashby": "https://images.unsplash.com/photo-1656264594678-7970aaa85958?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXNoYnklMjByb3VuZCUyMG1ldGFsfGVufDB8MHx8fDE3ODY0MDY0NDF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-quill": "https://images.unsplash.com/photo-1646083774155-2a40b675641d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cXVpbGwlMjB0aGluJTIwdGl0YW5pdW0lMjBvcHRpY2FsJTIwZnJhbWV8ZW58MHwwfHx8MTc4NjQwNjE4M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-dune": "https://images.unsplash.com/photo-1762011506215-7b34f7212ff3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8ZHVuZSUyMG92ZXJzaXplZCUyMHN1bmdsYXNzZXN8ZW58MHwwfHx8MTc4NjQwNjE4OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-focus": "https://images.unsplash.com/photo-1656684231110-880393bb6113?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9jdXMlMjBibHVlLWxpZ2h0JTIwZ2xhc3Nlc3xlbnwwfDB8fHwxNzg2NDA2MTkyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-tryon": "https://images.unsplash.com/photo-1573376670329-0261ea9fde97?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aG9tZSUyMHRyeS1vbiUyMGtpdCUyMGJveCUyMG9wZW4lMjBmaXZlJTIwZnJhbWVzfGVufDB8MHx8fDE3ODY0MDYxOTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-care": "https://images.unsplash.com/photo-1611908129881-045894e333da?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FyZSUyMGtpdCUyMGNsb3RoJTIwc3ByYXklMjBoYXJkJTIwY2FzZXxlbnwwfDB8fHwxNzg2NDA2MjAxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-choose": "https://images.unsplash.com/photo-1465161191540-aac346fcbaff?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V2ZXJhbCUyMGZyYW1lcyUyMGxhaWQlMjBvdXQlMjBjb21wYXJlJTIwdGFibGV8ZW58MHwwfHx8MTc4NjQwNjIwNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-lenses": "https://images.unsplash.com/photo-1651471271369-16295214d52d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGVucyUyMGNhdGFsb2d1ZSUyMHBhaXIlMjBmcmFtZXMlMjBiZW5jaHxlbnwwfDB8fHwxNzg2NDA2MjA3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-faces": "https://images.unsplash.com/photo-1585719284589-4c22da10c007?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG9ydHJhaXQlMjBmaXR0aW5nJTIwZGlmZmVyZW50JTIwZnJhbWUlMjBzaGFwZXN8ZW58MHwwfHx8MTc4NjQwNjIxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'eyewear-hero', url: src('eyewear-hero'), alt: 'A face-on portrait wearing modern tortoise optical frames' },
    { id: 'eyewear-tile-optical', url: src('eyewear-tile-optical'), alt: 'A pair of acetate optical frames laid flat' },
    { id: 'eyewear-tile-sun', url: src('eyewear-tile-sun'), alt: 'A pair of sunglasses in bright daylight' },
    { id: 'eyewear-tile-blue', url: src('eyewear-tile-blue'), alt: 'Blue-light glasses resting on a laptop keyboard' },
    { id: 'eyewear-tile-accessories', url: src('eyewear-tile-accessories'), alt: 'A folded microfibre cloth and a hard eyewear case' },
    { id: 'eyewear-band-tryon', url: src('eyewear-band-tryon'), alt: 'Five frames arranged in a home try-on box' },
    { id: 'eyewear-band-lenses', url: src('eyewear-band-lenses'), alt: 'A lens being inspected against the light in a workshop' },
    { id: 'prod-ashby', url: src('prod-ashby'), alt: 'The Ashby round metal optical frame' },
    { id: 'prod-marlowe', url: src('prod-marlowe'), alt: 'The Marlowe bold rectangular acetate frame' },
    { id: 'prod-juno', url: src('prod-juno'), alt: 'The Juno cat-eye optical frame' },
    { id: 'prod-quill', url: src('prod-quill'), alt: 'The Quill thin titanium optical frame' },
    { id: 'prod-coast', url: src('prod-coast'), alt: 'The Coast keyhole sunglasses' },
    { id: 'prod-dune', url: src('prod-dune'), alt: 'The Dune oversized sunglasses' },
    { id: 'prod-focus', url: src('prod-focus'), alt: 'The Focus blue-light glasses' },
    { id: 'prod-ridley', url: src('prod-ridley'), alt: 'The Ridley reading glasses' },
    { id: 'prod-tryon', url: src('prod-tryon'), alt: 'The home try-on kit box open with five frames' },
    { id: 'prod-care', url: src('prod-care'), alt: 'The care kit — cloth, spray and hard case' },
    { id: 'post-choose', url: src('post-choose'), alt: 'Several frames laid out to compare on a table' },
    { id: 'post-lenses', url: src('post-lenses'), alt: 'A lens catalogue and a pair of frames on a bench' },
    { id: 'post-faces', url: src('post-faces'), alt: 'A portrait fitting different frame shapes' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-retail-eyewear: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one face-on photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('eyewear-hero'), alt: 'A face-on portrait in modern tortoise frames', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Frames worth looking twice at.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Frame & Lens designs eyewear in-house and sells it direct, so you get frames that would cost three times as much on the high street. Every pair ships with prescription, blue-light or sun lenses — and you can try five at home, free, before you spend a penny.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop frames' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/shop/home-try-on' },
                                            text: 'Try five at home, free',
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
                        text: 'What are you after?',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'eyewear-tile-optical', label: 'Optical', href: '/shop', alt: 'A pair of acetate optical frames' }),
                            categoryTile({ assetId: 'eyewear-tile-sun', label: 'Sunglasses', href: '/shop', alt: 'A pair of sunglasses in daylight' }),
                            categoryTile({ assetId: 'eyewear-tile-blue', label: 'Blue-light', href: '/shop', alt: 'Blue-light glasses on a keyboard' }),
                            categoryTile({ assetId: 'eyewear-tile-accessories', label: 'Accessories', href: '/shop', alt: 'A cloth and a hard eyewear case' }),
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
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'New this season' }),
    editorialBand({
        heading: 'Try five at home, free',
        lead: 'Pick any five frames and we’ll send them to you to try for five days — no charge, no deposit, return shipping included. Live with them, take photos, ask the group chat. Keep the one you love and send the rest back; only then do you pay.',
        assetId: 'eyewear-band-tryon',
        cta: 'How home try-on works',
        href: '/shop/home-try-on',
        alt: 'Five frames arranged in a home try-on box',
    }),
    productsBlock({ source: 'commerce.category.optical', layout: 'carousel', heading: 'Optical frames' }),
    editorialBand({
        heading: 'Lenses done properly',
        lead: 'Every pair is glazed to order in our own lab with anti-glare, scratch-resistant lenses as standard — single vision, progressive, blue-light or polarised sun. Send us your prescription at checkout, or add it later. No upsells, no surprise fees.',
        assetId: 'eyewear-band-lenses',
        cta: 'How our lenses work',
        href: '/blog/lens-options-explained',
        alt: 'A lens inspected against the light in a workshop',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static "made to your prescription" note, and policy links). */
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
                                        text: 'Frame & Lens',
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
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Glazed to your prescription' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Choose your lens type at checkout and add your prescription now or later — we’ll email a reminder. Anti-glare and scratch-resistant coatings come as standard, cut and fitted in our own lab, and every pair ships in a protective case with a cloth.',
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
        'Shop eyewear',
        'Every frame we make — optical, sunglasses, blue-light and reading — each in its own colorways with the lens choice built in. Filter by shape or category, or sort however you like; all of it comes with our free home try-on.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead('Collections', 'The frames grouped the way people actually shop — new arrivals, the best sellers, the optical line, sunglasses, blue-light, and the free home try-on kit to start with.'),
];
const SEARCH: Node[] = [
    pageMasthead('Search Frame & Lens', 'Looking for a shape, a color, or a lens guide? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Free shipping and free returns, always — and 30 days to change your mind on any pair. Not sure of your prescription? Add it after checkout; we’ll hold your order and email you a reminder.',
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
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Frame & Lens journal' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Plain, useful guides to buying glasses online — how to choose a frame, what the lens options actually mean, and which shapes suit which faces. No jargon, no pressure.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Frame & Lens' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Frame & Lens started with a simple frustration: a pair of glasses that cost forty pounds to make was selling for three hundred, and nobody could tell you why. So we cut out the middle. We design our frames in-house, make them from Italian acetate and Japanese titanium, and sell them direct — which is how a genuinely good pair lands at a genuinely fair price.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Buying glasses online sounds like a leap, so we built it to feel like the opposite. Order the home try-on kit and five frames arrive to live with for five days, free. Keep the one that fits your face and your life, send the rest back, and we’ll glaze it to your prescription in our own lab.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'No pushy add-ons, no lens jargon, no “anti-reflective upgrade” at the till — the coatings that matter come as standard. Just well-made eyewear, an honest price, and a way to be sure before you buy.',
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
        intro: 'Not sure which frame suits you, need help reading your prescription, or want to check on an order? Tell us what you’re after and a real person on our team — not a bot — will get back to you.',
        submitLabel: 'Email the team',
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

/** A short, unique-within-product option code for a SKU suffix (Tortoise → TOR). */
const optCode = (s: string): string => s.replace(/[^a-zA-Z0-9]/g, '').slice(0, 3).toUpperCase();

/** A frame product — a Color swatch (the frame colorway) × a Lens dropdown (the lens type),
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
    colors?: string[];
    lenses?: string[];
}): Product => {
    const colors = opts.colors ?? ['Tortoise', 'Black', 'Crystal'];
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
        productType: 'Eyewear',
        vendor: 'Frame & Lens',
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
        handle: 'ashby',
        title: 'Ashby',
        description:
            'A slim round frame in lightweight metal — the quiet all-rounder that suits almost everyone. Sculpted nose pads and spring hinges keep it comfortable all day, and the keyhole bridge gives it a bit of vintage character without shouting about it.',
        price: 145,
        sku: 'FL-ASHBY',
        categories: ['optical'],
        collections: ['new-arrivals', 'optical-frames', 'best-sellers'],
        tags: ['optical', 'round', 'metal', 'unisex'],
        asset: 'prod-ashby',
        colors: ['Gold', 'Black', 'Silver'],
        seoTitle: 'Ashby — round metal optical frames | Frame & Lens',
        seoDescription: 'A slim, lightweight round metal frame with spring hinges and a keyhole bridge. Prescription or blue-light.',
    }),
    frame({
        handle: 'marlowe',
        title: 'Marlowe',
        description:
            'A bold rectangular frame cut from Italian acetate, with enough weight to make a statement and enough polish to wear to work. The tortoise is hand-finished so no two are identical; the black is a proper matte, not a plasticky gloss.',
        price: 155,
        sku: 'FL-MARLOWE',
        categories: ['optical'],
        collections: ['new-arrivals', 'optical-frames'],
        tags: ['optical', 'rectangle', 'acetate', 'bold'],
        asset: 'prod-marlowe',
        seoTitle: 'Marlowe — bold acetate optical frames | Frame & Lens',
        seoDescription: 'A bold rectangular Italian-acetate frame in hand-finished tortoise, matte black or crystal. Prescription or blue-light.',
    }),
    frame({
        handle: 'juno',
        title: 'Juno',
        description:
            'A modern cat-eye with a soft upsweep — flattering, feminine and never fussy. Lifted outer corners open up the face and the low-set hinges keep the silhouette clean. A little bit of an occasion, in a frame you can wear every day.',
        price: 150,
        sku: 'FL-JUNO',
        categories: ['optical'],
        collections: ['optical-frames', 'best-sellers'],
        tags: ['optical', 'cat-eye', 'acetate'],
        asset: 'prod-juno',
        seoTitle: 'Juno — cat-eye optical frames | Frame & Lens',
        seoDescription: 'A soft, modern cat-eye in Italian acetate with a flattering upsweep. Prescription or blue-light.',
    }),
    frame({
        handle: 'quill',
        title: 'Quill',
        description:
            'A barely-there frame in Japanese titanium — you forget you’re wearing it. Half the weight of acetate, flexible enough to survive real life, and hypoallergenic for anyone who reacts to cheaper metals. The choice when you want your glasses to disappear.',
        price: 175,
        sku: 'FL-QUILL',
        categories: ['optical'],
        collections: ['optical-frames'],
        tags: ['optical', 'titanium', 'rimless', 'lightweight'],
        asset: 'prod-quill',
        colors: ['Gunmetal', 'Rose gold', 'Black'],
        seoTitle: 'Quill — titanium optical frames | Frame & Lens',
        seoDescription: 'A featherlight, flexible Japanese-titanium frame — hypoallergenic and barely there. Prescription or blue-light.',
    }),
    frame({
        handle: 'ridley',
        title: 'Ridley Readers',
        description:
            'A proper pair of reading glasses, not a chemist’s afterthought. The same acetate and hinges as our optical line, glazed with magnified reading lenses in the strength you choose — so the pair on your bedside table looks as good as the one on your face.',
        price: 95,
        sku: 'FL-RIDLEY',
        categories: ['optical'],
        collections: ['optical-frames'],
        tags: ['reading', 'acetate', 'optical'],
        asset: 'prod-ridley',
        lenses: ['+1.00', '+1.50', '+2.00', '+2.50'],
        seoTitle: 'Ridley Readers — designer reading glasses | Frame & Lens',
        seoDescription: 'Well-made reading glasses in Italian acetate, glazed to the reading strength you choose. Tortoise, black or crystal.',
    }),
    frame({
        handle: 'coast',
        title: 'Coast',
        description:
            'A slim keyhole sunglass with a retro edge and full UV400 protection — bright, clear and light on the face. Add polarised lenses to cut glare off water and roads, or take them prescription so you finally stop squinting through borrowed shades.',
        price: 135,
        sku: 'FL-COAST',
        categories: ['sunglasses'],
        collections: ['new-arrivals', 'sunglasses', 'best-sellers'],
        tags: ['sunglasses', 'uv400', 'acetate'],
        asset: 'prod-coast',
        lenses: ['Classic tint', 'Polarised', 'Prescription sun'],
        seoTitle: 'Coast — keyhole sunglasses | Frame & Lens',
        seoDescription: 'A slim keyhole sunglass with UV400 protection — classic tint, polarised or prescription. Tortoise, black or crystal.',
    }),
    frame({
        handle: 'dune',
        title: 'Dune',
        description:
            'An oversized sunglass that means it — generous coverage, a strong brow line and lenses dark enough for real sun. Substantial without being heavy, thanks to a hollow-core acetate. The pair you reach for on the brightest days and the longest drives.',
        price: 140,
        sku: 'FL-DUNE',
        categories: ['sunglasses'],
        collections: ['sunglasses'],
        tags: ['sunglasses', 'oversized', 'uv400'],
        asset: 'prod-dune',
        colors: ['Tortoise', 'Black', 'Honey'],
        lenses: ['Classic tint', 'Polarised', 'Prescription sun'],
        seoTitle: 'Dune — oversized sunglasses | Frame & Lens',
        seoDescription: 'An oversized sunglass with generous coverage and UV400 lenses — classic, polarised or prescription. Tortoise, black or honey.',
    }),
    frame({
        handle: 'focus',
        title: 'Focus',
        description:
            'Screen glasses that earn their keep. The Focus lens filters blue light and cuts the glare that gives you a 4pm headache, in a clean modern frame you won’t mind wearing on a call. Take it plano if your eyes are fine, or with your prescription built in.',
        price: 115,
        sku: 'FL-FOCUS',
        categories: ['blue-light'],
        collections: ['blue-light', 'best-sellers'],
        tags: ['blue-light', 'screen', 'acetate'],
        asset: 'prod-focus',
        lenses: ['Non-prescription', 'Prescription'],
        seoTitle: 'Focus — blue-light glasses | Frame & Lens',
        seoDescription: 'Blue-light filtering screen glasses that cut glare and eye strain — plano or prescription. Tortoise, black or crystal.',
    }),
    {
        handle: 'home-try-on',
        title: 'Home Try-On Kit',
        description:
            'Choose any five frames and we’ll send them to you to try for five days — free, with return shipping included and no deposit taken. Wear them, photograph them, ask everyone you know. Keep the one you love and send the rest back; you only pay when you order the real pair, glazed to your prescription.',
        status: 'active',
        productType: 'Service',
        vendor: 'Frame & Lens',
        tags: ['home-try-on', 'free', 'service'],
        categoryHandles: ['accessories'],
        collectionHandles: ['home-try-on', 'new-arrivals'],
        seoTitle: 'Home Try-On Kit — five frames, five days, free | Frame & Lens',
        seoDescription: 'Try any five Frame & Lens frames at home for five days, free, with return shipping included. No deposit.',
        variants: [{ sku: 'FL-TRYON', priceCents: money(0), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-tryon', isPrimary: true, alt: 'A home try-on kit box with five frames' }],
    },
    {
        handle: 'care-kit',
        title: 'Care Kit',
        description:
            'Everything to keep a pair looking new — a microfibre cloth, an alcohol-free lens spray that won’t strip your coatings, and a slim hard case that actually fits in a bag. The small kit that makes good glasses last for years.',
        status: 'active',
        productType: 'Accessory',
        vendor: 'Frame & Lens',
        tags: ['accessories', 'care', 'case'],
        categoryHandles: ['accessories'],
        collectionHandles: ['home-try-on'],
        seoTitle: 'Care Kit — lens cloth, spray & case | Frame & Lens',
        seoDescription: 'A microfibre cloth, alcohol-free lens spray and a slim hard case to keep your glasses looking new.',
        variants: [{ sku: 'FL-CARE', priceCents: money(15), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-care', isPrimary: true, alt: 'A care kit — cloth, spray and hard case' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'optical', name: 'Optical', description: 'Prescription and blue-light frames.', featured: true },
        { handle: 'sunglasses', name: 'Sunglasses', description: 'UV400 sun, classic and polarised.', featured: true },
        { handle: 'blue-light', name: 'Blue-light', description: 'Screen glasses that cut glare.', featured: true },
        { handle: 'accessories', name: 'Accessories', description: 'Home try-on and frame care.', featured: true },
    ],
    collections: [
        {
            handle: 'new-arrivals',
            name: 'New this season',
            description: 'The latest frames to land.',
            type: 'manual',
            featured: true,
            productHandles: ['ashby', 'marlowe', 'coast', 'home-try-on'],
        },
        {
            handle: 'best-sellers',
            name: 'Best sellers',
            description: 'The frames people keep reaching for.',
            type: 'manual',
            featured: true,
            productHandles: ['ashby', 'juno', 'coast', 'focus'],
        },
        {
            handle: 'optical-frames',
            name: 'Optical',
            description: 'Prescription and blue-light frames.',
            type: 'manual',
            featured: false,
            productHandles: ['ashby', 'marlowe', 'juno', 'quill', 'ridley'],
        },
        {
            handle: 'sunglasses',
            name: 'Sunglasses',
            description: 'UV400 sun in classic, polarised and prescription.',
            type: 'manual',
            featured: false,
            productHandles: ['coast', 'dune'],
        },
        {
            handle: 'blue-light',
            name: 'Blue-light',
            description: 'Screen glasses that cut glare and strain.',
            type: 'manual',
            featured: false,
            productHandles: ['focus'],
        },
        {
            handle: 'home-try-on',
            name: 'Start here',
            description: 'Try five at home, free — and keep them cared for.',
            type: 'manual',
            featured: true,
            productHandles: ['home-try-on', 'care-kit'],
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
        slug: 'how-to-choose-frames-online',
        status: 'published',
        body: {
            title: 'How to choose frames online (without seeing them on)',
            excerpt: 'Buying glasses you can’t try on first sounds risky. It isn’t, if you know the three numbers that matter and use a free home try-on to settle the rest.',
            featuredImage: { $asset: 'post-choose' },
            body: {
                type: 'doc',
                content: [
                    para('The thing that stops most people buying glasses online is simple: you can’t try them on. But a frame either fits your face or it doesn’t, and fit comes down to a few measurements you can actually check — plus a free home try-on for everything a number can’t tell you.'),
                    h2('The three numbers that matter'),
                    para('Look at the inside of a pair you already own and you’ll find three numbers printed on the arm, like 52–18–145. The first is the lens width, the second the bridge (the gap over your nose), and the third the arm length. Match those roughly and a new frame will sit about where your current one does. Our size guide lists all three for every frame, so you can shop by fit, not guesswork.'),
                    h2('Then let the try-on do the rest'),
                    para('Numbers get you close; your face does the deciding. Order the free home try-on kit, pick five frames, and live with them for a few days — see them in daylight, in a work call, in a photo. That’s how you catch the ones that looked great flat on a screen but wrong on you, and it costs nothing to find out.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'lens-options-explained',
        status: 'published',
        body: {
            title: 'Lens options, explained in plain English',
            excerpt: 'Single vision, progressive, blue-light, polarised — the lens menu is where glasses get confusing and overpriced. Here’s what each one actually is, and what you really need.',
            featuredImage: { $asset: 'post-lenses' },
            body: {
                type: 'doc',
                content: [
                    para('The frame is the easy part. The lens menu is where buying glasses turns into a foreign language and the price quietly doubles. Here’s the whole thing in plain terms, and what most people actually need.'),
                    h2('Single vision vs progressive'),
                    para('Single vision lenses correct one distance — reading, or seeing far away — and cover the whole lens with that one prescription. Progressives blend several corrections into one lens, so you can read up close and see across the room without swapping glasses; they cost more and take a week or so to get used to. If your prescription has an “ADD” value, you’re a candidate for progressives; if not, single vision is all you need.'),
                    h2('Coatings and the extras'),
                    para('Anti-glare and scratch-resistant coatings genuinely help, and we include both as standard — you’ll never see them as a checkout upsell here. Blue-light filtering reduces glare from screens and is worth it if you’re at a laptop all day. Polarised sun lenses cut reflected glare off water and roads, which is why they’re the pick for driving and the beach. Everything else on a typical lens menu is optional; ignore it with a clear conscience.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'frames-for-your-face-shape',
        status: 'published',
        body: {
            title: 'Which frames suit your face shape',
            excerpt: 'The old rule is “balance and contrast” — round softens angles, angular sharpens curves. Here’s how that plays out for the four common face shapes, with the frames to start from.',
            featuredImage: { $asset: 'post-faces' },
            body: {
                type: 'doc',
                content: [
                    para('There’s one idea behind every face-shape guide: balance and contrast. A frame that contrasts with your face shape tends to flatter it — soft frames on angular faces, angular frames on soft ones — while a frame that echoes your shape can amplify it. Here’s the short version for the four common shapes.'),
                    h2('Round and square faces'),
                    para('If your face is round, with soft curves and similar width and length, a more angular frame adds definition — a rectangle like the Marlowe, or a cat-eye like the Juno, gives you edges to contrast against. If your face is square, with a strong jaw and broad forehead, do the opposite: soften it with a round frame like the Ashby or the barely-there Quill.'),
                    h2('Oval and heart faces'),
                    para('Oval faces are the lucky ones — balanced proportions mean almost anything works, so shop by the look you want rather than the rule. Heart-shaped faces are widest at the forehead and narrow to the chin; a frame that’s wider at the bottom, or a light round like the Ashby, evens things out. When in doubt, try five at home and trust the photos over the theory.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'retail-eyewear',
    key: 'sparx-retail-eyewear',
    name: 'Eyewear (Modern)',
    theme: THEME,
    summary:
        'A complete, working shop for a direct-to-consumer eyewear brand: a real catalogue of optical frames (each in its own colorways with a lens choice), sunglasses, a blue-light pair, reading glasses, a free home try-on kit and a care accessory, with categories, collections, a bespoke eyewear PDP and a fully merchandised home page. Modern fashion-optical theme — crisp warm-neutral paper, a deep-teal primary, a warm tortoise accent. Shipped as Frame & Lens.',
    tagline: 'A modern, working storefront for a direct-to-consumer eyewear brand.',
    vertical: 'retail',
    industry: 'Eyewear & optical',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 86,
    brand: {
        businessName: 'Frame & Lens',
        tagline: 'Great frames, honest prices, home try-on.',
    },
    chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
    seo: {
        home: {
            title: 'Frame & Lens — designer eyewear at an honest price',
            description:
                'Frame & Lens designs eyewear in-house and sells it direct — optical, sunglasses, blue-light and reading frames with prescription lenses, and a free home try-on. Great frames, honest prices.',
        },
        about: {
            title: 'About Frame & Lens',
            description:
                'Why Frame & Lens designs its own frames and sells them direct — Italian acetate, Japanese titanium, honest prices, and a free home try-on so you’re sure before you buy.',
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
