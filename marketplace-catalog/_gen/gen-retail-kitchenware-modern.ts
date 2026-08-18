// sparx-retail-kitchenware-modern — a RETAIL/COMMERCE site template: a modern kitchen-design shop.
//
// The sleek, contemporary counterpart to the warm heritage Copper & Cast. A complete, working
// shop the moment it installs — a real catalogue of ceramic nonstick cookware, a precision
// kettle, a modern knife set, nesting prep bowls, a digital scale, silicone tools and modular
// storage — with categories + collections, a bespoke PDP, the full 9-page commerce site (home
// merchandising → shop → collections → cart → search → journal → about → contact), dressed in an
// INLINE bespoke theme (crisp cool-grey paper + near-black primary + an electric cobalt accent,
// under a clean grotesk). Shipped as Edge.
//
// SELF-CONTAINED BY DESIGN — like the coffee gold reference, this generator carries its OWN theme
// inline and passes it on the spec (`theme`), so the retail family can be authored in parallel
// without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-kitchenware-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-kitchenware-modern/**" \
//     "marketplace-catalog/_gen/gen-retail-kitchenware-modern.ts"
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
// A sleek modern kitchen studio: a crisp cool-grey paper ground, near-black ink, a NEAR-BLACK
// mono primary (black controls in light, white controls in dark — the confident product-design
// look) and an electric COBALT signal accent, under a clean grotesk display over a neutral sans.
// Complete light + dark, AA on every role (the blueprint sweep's contrast check is the gate).
// Every role used as TEXT on the light ground sits ≤ ~50% L so it clears 4.5:1 — the near-black
// primary at 24%, the slate secondary at 44%, the cobalt accent at 50%. Sharper radii than the
// heritage shop, so the whole shell reads minimal and engineered rather than rustic.
const THEME = defineTheme({
    name: 'edge-modern',
    type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
    shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
    light: {
        surfaces: ['oklch(98% 0.004 260)', 'oklch(96% 0.006 260)', 'oklch(92% 0.008 260)', 'oklch(20% 0.02 260)'],
        roles: {
            primary: 'oklch(24% 0.02 260)',
            secondary: 'oklch(44% 0.02 260)',
            accent: 'oklch(50% 0.19 262)',
            neutral: 'oklch(26% 0.015 260)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(22% 0.012 260)', 'oklch(18% 0.012 260)', 'oklch(15% 0.012 260)', 'oklch(97% 0.004 260)'],
        roles: {
            primary: 'oklch(93% 0.008 260)',
            secondary: 'oklch(74% 0.02 260)',
            accent: 'oklch(72% 0.15 262)',
            neutral: 'oklch(30% 0.012 260)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "ek-hero": "https://images.unsplash.com/photo-1518291344630-4857135fb581?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2VyYW1pYyUyMG5vbnN0aWNrJTIwcGFuJTIwbW9kZXJuJTIwdG9vbHMlMjBsYWlkJTIwb3V0fGVufDB8MHx8fDE3ODY0MDc4ODd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-band-design": "https://images.unsplash.com/photo-1586868538513-51335a0c5337?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVzaWduZXIlMjBzdHVkeWluZyUyMGtpdGNoZW4lMjB0b29sJTIwcHJvdG90eXBlJTIwd2hpdGUlMjB0YWJsZXxlbnwwfDB8fHwxNzg2NDA3ODkwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-band-engineered": "https://images.unsplash.com/photo-1650940925927-f4a30c930a4d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z29vc2VuZWNrJTIwa2V0dGxlJTIwcG91cmluZyUyMHByZWNpc2UlMjBzdHJlYW0lMjB3YXRlcnxlbnwwfDB8fHwxNzg2NDA3ODkzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-prod-pan-set": "https://images.unsplash.com/photo-1584990347193-6bebebfeaeee?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWF0Y2hlZCUyMGNlcmFtaWMlMjBub25zdGlja3xlbnwwfDB8fHwxNzg2NDA5MDUxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-prod-frypan": "https://images.unsplash.com/photo-1688398846460-baab8638e30a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlJTIwY2VyYW1pYyUyMG5vbnN0aWNrJTIwZnJ5cGFuJTIwcGhvdG9ncmFwaGVkJTIwd2hpdGV8ZW58MHwwfHx8MTc4NjQwNzg5OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-prod-kettle": "https://images.unsplash.com/photo-1559761340-1e6a341f0b51?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJlY2lzaW9uJTIwZ29vc2VuZWNrJTIwa2V0dGxlJTIwZGlnaXRhbCUyMGJhc2V8ZW58MHwwfHx8MTc4NjQwNzkwMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-prod-knife-set": "https://images.unsplash.com/photo-1690983321709-0eccbcb20d00?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhyZWUtcGllY2UlMjBtb2Rlcm4lMjBrbmlmZSUyMHNldCUyMGxpZ2h0JTIwYm9hcmR8ZW58MHwwfHx8MTc4NjQwNzkwNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-prod-bowls": "https://images.unsplash.com/photo-1762922425155-d03e6997e33e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bmVzdGluZyUyMHNldCUyMHByZXAlMjBib3dscyUyMG11dGVkJTIwdG9uZXN8ZW58MHwwfHx8MTc4NjQwNzkwOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-prod-scale": "https://images.unsplash.com/photo-1644395175647-7fc09bdae7c1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2xpbSUyMGRpZ2l0YWwlMjBraXRjaGVufGVufDB8MHx8fDE3ODY0MDkwNTR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-prod-tools": "https://images.unsplash.com/photo-1587742378970-0c834078a7ce?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwc2lsaWNvbmUlMjBjb29raW5nJTIwdXRlbnNpbHMlMjBzdGFuZGluZyUyMGNhZGR5fGVufDB8MHx8fDE3ODY0MDc5MTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-prod-board": "https://images.unsplash.com/photo-1591291294701-4f651ddd3556?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWluaW1hbCUyMGNvbXBvc2l0ZSUyMGN1dHRpbmclMjBib2FyZCUyMGNvdW50ZXJ8ZW58MHwwfHx8MTc4NjQwNzkxOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-prod-storage": "https://images.unsplash.com/photo-1616459042391-e28c324a7952?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwbW9kdWxhciUyMGdsYXNzJTIwc3RvcmFnZSUyMGNvbnRhaW5lcnMlMjBsaWRzfGVufDB8MHx8fDE3ODY0MDc5MjN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-post-nonstick": "https://images.unsplash.com/photo-1584990347955-2ec0431a6e8f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xvc2UlMjB2aWV3JTIwY2VyYW1pYyUyMG5vbnN0aWNrJTIwY29va2luZyUyMHN1cmZhY2V8ZW58MHwwfHx8MTc4NjQwNzkyNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-post-tools": "https://images.unsplash.com/photo-1665768976778-22ab017f915a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGwlMjBlZGl0JTIwZXNzZW50aWFsJTIwa2l0Y2hlbiUyMHRvb2xzJTIwbGFpZCUyMGZsYXR8ZW58MHwwfHx8MTc4NjQwNzkyOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "ek-post-counter": "https://images.unsplash.com/photo-1556912167-f556f1f39fdf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGlkeSUyMG1vZGVybiUyMGtpdGNoZW4lMjBjb3VudGVyJTIwZmV3JTIwd2VsbC1kZXNpZ25lZCUyMHRvb2xzfGVufDB8MHx8fDE3ODY0MDc5MzN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'ek-hero', url: src('ek-hero'), alt: 'A ceramic nonstick pan and modern tools laid out on a bright counter' },
    { id: 'ek-band-design', url: src('ek-band-design'), alt: 'A designer studying a kitchen tool prototype on a white table' },
    { id: 'ek-band-engineered', url: src('ek-band-engineered'), alt: 'A gooseneck kettle pouring a precise stream of water' },
    { id: 'ek-prod-pan-set', url: src('ek-prod-pan-set'), alt: 'A matched set of ceramic nonstick pans on a white surface' },
    { id: 'ek-prod-frypan', url: src('ek-prod-frypan'), alt: 'A single ceramic nonstick frypan photographed on white' },
    { id: 'ek-prod-kettle', url: src('ek-prod-kettle'), alt: 'A precision gooseneck kettle with a digital base' },
    { id: 'ek-prod-knife-set', url: src('ek-prod-knife-set'), alt: 'A three-piece modern knife set on a light board' },
    { id: 'ek-prod-bowls', url: src('ek-prod-bowls'), alt: 'A nesting set of prep bowls in muted tones' },
    { id: 'ek-prod-scale', url: src('ek-prod-scale'), alt: 'A slim digital kitchen scale with a glass top' },
    { id: 'ek-prod-tools', url: src('ek-prod-tools'), alt: 'A set of silicone cooking utensils standing in a caddy' },
    { id: 'ek-prod-board', url: src('ek-prod-board'), alt: 'A minimal composite cutting board on a counter' },
    { id: 'ek-prod-storage', url: src('ek-prod-storage'), alt: 'A set of modular glass storage containers with lids' },
    { id: 'ek-post-nonstick', url: src('ek-post-nonstick'), alt: 'A close view of a ceramic nonstick cooking surface' },
    { id: 'ek-post-tools', url: src('ek-post-tools'), alt: 'A small edit of essential kitchen tools laid flat' },
    { id: 'ek-post-counter', url: src('ek-post-counter'), alt: 'A tidy modern kitchen counter with a few well-designed tools' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-retail-kitchenware-modern: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one crisp studio photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('ek-hero'), alt: 'Ceramic nonstick cookware and modern tools on a bright counter', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Beautifully engineered tools for the modern kitchen.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Edge designs a short, considered range of kitchen tools — ceramic nonstick cookware, a precision kettle, a clean knife set — where every detail earns its place. Nothing fussy, nothing loud. Just the pieces you reach for, made to look as good on the counter as they perform on the stove.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the range' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/shop' },
                                            text: 'Start with the essentials',
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
                        text: 'Shop by kind',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'ek-prod-pan-set', label: 'Cookware', href: '/shop', alt: 'A matched set of ceramic nonstick pans' }),
                            categoryTile({ assetId: 'ek-prod-knife-set', label: 'Tools', href: '/shop', alt: 'A modern three-piece knife set' }),
                            categoryTile({ assetId: 'ek-prod-bowls', label: 'Prep', href: '/shop', alt: 'A nesting set of prep bowls' }),
                            categoryTile({ assetId: 'ek-prod-storage', label: 'Sets', href: '/shop', alt: 'A set of modular storage containers' }),
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
        heading: 'Designed, not decorated',
        lead: 'We start every piece with the way you actually use it — the angle of a handle, the weight in the hand, the way a lid sits. Then we take everything else away. What’s left is a tool that feels obvious the first time you pick it up, and right for years after.',
        assetId: 'ek-band-design',
        cta: 'How we design',
        href: '/blog/design-for-the-counter',
        alt: 'A designer studying a kitchen tool prototype',
    }),
    productsBlock({ source: 'commerce.category.cookware', layout: 'carousel', heading: 'Cookware' }),
    editorialBand({
        heading: 'Precision, quietly',
        lead: 'Even heat across the whole base. A kettle you can set to the exact degree. A scale that reads to the gram. The clever engineering is on the inside — the outside stays calm, so it disappears into your kitchen instead of shouting over it.',
        assetId: 'ek-band-engineered',
        cta: 'What’s inside the range',
        href: '/blog/small-kitchen-edit',
        alt: 'A gooseneck kettle pouring a precise stream of water',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static "designed to last" note, and policy links). */
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
                                        text: 'Edge',
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
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Designed to be kept' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Every Edge piece is engineered for daily use and backed by a ten-year guarantee. Parts you can replace, finishes that don’t date, and a range that fits together — buy one thing now and it still matches the next thing you add.',
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
        'Shop the range',
        'The whole Edge range in one place — ceramic nonstick cookware, a precision kettle, a modern knife set, prep and storage. Filter by kind or material, or sort however you like; every piece is designed to work together and built to be used every day.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead('Collections', 'The range grouped the way people actually build a kitchen — what’s new, the pieces everyone starts with, the cookware and prep edits, and sets that fit together from day one.'),
];
const SEARCH: Node[] = [
    pageMasthead('Search Edge', 'Looking for a pan, a kettle, or a care guide? Search the whole range and the journal below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Free shipping on orders over $75, and every piece carries a ten-year guarantee. Not the right fit for your kitchen? Send it back within 60 days — we’d rather you have the tool you’ll actually use.',
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
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Field notes' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Notes from the studio — how our nonstick actually works, the short list of tools that replaces a cluttered drawer, and why we design for the counter you live with. Plain, useful, no jargon.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Edge' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Edge began with a simple frustration: kitchen shops are full of things designed to be bought, not used. Fifteen-piece sets you never open, gadgets that live in a drawer, finishes that look tired in a year. We wanted the opposite — a short, considered range where every piece is thought through and nothing is filler.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We’re a small studio of designers and cooks. We prototype in our own kitchens, test until the awkward details are gone, and only ship a piece when it feels obvious to use. The clever engineering — even-heat bases, precise temperature control, a ceramic nonstick with nothing nasty in it — sits on the inside; the outside stays calm and quiet.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'The whole range is built to fit together and to last. A ten-year guarantee, replaceable parts, and a look that doesn’t date — so the first thing you buy still belongs beside the tenth. Fewer, better, designed to be kept.',
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
        intro: 'A question about a piece, help choosing where to start, or a wedding-registry order? Tell us what you’re cooking toward and a real person at the studio will point you to the right tool — not the most expensive one.',
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

const VENDOR = 'Edge';

const PRODUCTS: Product[] = [
    {
        handle: 'ceramic-nonstick-pan-set',
        title: 'Ceramic Nonstick Pan Set',
        description:
            'The three pans that cover almost everything — an 8-inch frypan, a 10-inch skillet and a 3-quart sauté with a glass lid, all with our mineral-ceramic nonstick and a fully clad aluminium body for fast, even heat. No PFAS, no flaking, oven-safe, and light enough to flip. The set to build a kitchen around.',
        status: 'active',
        productType: 'Cookware set',
        vendor: VENDOR,
        tags: ['cookware', 'ceramic', 'nonstick', 'pan-set', 'pfas-free'],
        categoryHandles: ['cookware', 'sets'],
        collectionHandles: ['new-arrivals', 'best-sellers', 'the-essentials', 'cookware-edit'],
        seoTitle: 'Ceramic Nonstick Pan Set — 3 piece, PFAS-free | Edge',
        seoDescription: 'A three-piece ceramic nonstick pan set with a clad aluminium body for even heat — frypan, skillet and lidded sauté.',
        options: [
            {
                name: 'Color',
                displayType: 'swatch',
                values: [{ value: 'Graphite' }, { value: 'Chalk' }, { value: 'Sage' }, { value: 'Clay' }],
            },
        ],
        variants: [
            { sku: 'EDGE-PANSET-GRA', priceCents: money(165), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Graphite' } },
            { sku: 'EDGE-PANSET-CHK', priceCents: money(165), inventoryPolicy: 'continue', optionValues: { Color: 'Chalk' } },
            { sku: 'EDGE-PANSET-SAG', priceCents: money(165), inventoryPolicy: 'continue', optionValues: { Color: 'Sage' } },
            { sku: 'EDGE-PANSET-CLY', priceCents: money(165), inventoryPolicy: 'continue', optionValues: { Color: 'Clay' } },
        ],
        images: [{ assetId: 'ek-prod-pan-set', isPrimary: true, alt: 'A matched set of ceramic nonstick pans on white' }],
    },
    {
        handle: 'ceramic-frypan',
        title: 'Ceramic Nonstick Frypan',
        description:
            'The everyday pan, on its own. Mineral-ceramic nonstick over a clad aluminium base, so eggs slide and a sear still browns, with a balanced stay-cool handle and a flared lip that pours clean. PFAS-free and oven-safe to 450°F. Start here, and add the set later.',
        status: 'active',
        productType: 'Cookware',
        vendor: VENDOR,
        tags: ['cookware', 'ceramic', 'nonstick', 'frypan', 'pfas-free'],
        categoryHandles: ['cookware'],
        collectionHandles: ['best-sellers', 'the-essentials', 'cookware-edit'],
        seoTitle: 'Ceramic Nonstick Frypan — PFAS-free | Edge',
        seoDescription: 'A mineral-ceramic nonstick frypan on a clad aluminium base — even heat, clean pour, oven-safe to 450°F.',
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: '8-inch' }, { value: '10-inch' }, { value: '12-inch' }] },
        ],
        variants: [
            { sku: 'EDGE-FRYPAN-8', priceCents: money(55), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '8-inch' } },
            { sku: 'EDGE-FRYPAN-10', priceCents: money(65), inventoryPolicy: 'continue', optionValues: { Size: '10-inch' } },
            { sku: 'EDGE-FRYPAN-12', priceCents: money(75), inventoryPolicy: 'continue', optionValues: { Size: '12-inch' } },
        ],
        images: [{ assetId: 'ek-prod-frypan', isPrimary: true, alt: 'A single ceramic nonstick frypan on white' }],
    },
    {
        handle: 'precision-kettle',
        title: 'Precision Pour Kettle',
        description:
            'A gooseneck electric kettle you can set to the exact degree — from a gentle 130°F for delicate tea to a full boil — with a hold setting that keeps it there. The thin, curved spout gives you a slow, controlled pour for coffee or matcha, and the whole thing sits on a slim digital base that stays out of the way.',
        status: 'active',
        productType: 'Appliance',
        vendor: VENDOR,
        tags: ['appliance', 'kettle', 'gooseneck', 'variable-temperature'],
        categoryHandles: ['cookware'],
        collectionHandles: ['new-arrivals', 'best-sellers', 'the-essentials'],
        seoTitle: 'Precision Pour Kettle — variable-temperature gooseneck | Edge',
        seoDescription: 'A gooseneck electric kettle with to-the-degree temperature control and a hold setting for coffee and tea.',
        variants: [{ sku: 'EDGE-KETTLE', priceCents: money(95), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'ek-prod-kettle', isPrimary: true, alt: 'A precision gooseneck kettle with a digital base' }],
    },
    {
        handle: 'precision-knife-set',
        title: 'Precision Knife Set',
        description:
            'The three knives that do the work of a whole block — an 8-inch chef’s, a 5-inch utility, and a paring knife, in a single high-carbon stainless steel with a clean, handle-less bolster and a comfortable oval grip. Laser-checked edges, a full tang, and a magnetic walnut stand that shows them off instead of hiding them.',
        status: 'active',
        productType: 'Knife set',
        vendor: VENDOR,
        tags: ['tools', 'knives', 'knife-set', 'stainless-steel'],
        categoryHandles: ['tools', 'sets'],
        collectionHandles: ['new-arrivals', 'best-sellers', 'the-essentials'],
        seoTitle: 'Precision Knife Set — 3 piece with stand | Edge',
        seoDescription: 'A three-piece high-carbon stainless knife set — chef’s, utility and paring — with a magnetic walnut stand.',
        variants: [{ sku: 'EDGE-KNIFESET', priceCents: money(175), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'ek-prod-knife-set', isPrimary: true, alt: 'A three-piece modern knife set on a light board' }],
    },
    {
        handle: 'nesting-prep-bowls',
        title: 'Nesting Prep Bowls',
        description:
            'A set of five prep bowls that nest down to almost nothing and come in a calm, matte finish — from a tiny spice bowl to a big mixing bowl. Silicone bases so they don’t skate on the counter, pour spouts on the larger sizes, and snap-on lids so a prepped bowl goes straight into the fridge. The set that quietly speeds up every dinner.',
        status: 'active',
        productType: 'Prep',
        vendor: VENDOR,
        tags: ['prep', 'bowls', 'mixing', 'nesting'],
        categoryHandles: ['prep'],
        collectionHandles: ['best-sellers', 'prep-edit', 'gift-ready'],
        seoTitle: 'Nesting Prep Bowls — 5 piece with lids | Edge',
        seoDescription: 'A five-piece nesting prep-bowl set in a matte finish — non-slip bases, pour spouts and snap-on lids.',
        options: [
            {
                name: 'Color',
                displayType: 'swatch',
                values: [{ value: 'Graphite' }, { value: 'Chalk' }, { value: 'Sage' }],
            },
        ],
        variants: [
            { sku: 'EDGE-BOWLS-GRA', priceCents: money(48), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Graphite' } },
            { sku: 'EDGE-BOWLS-CHK', priceCents: money(48), inventoryPolicy: 'continue', optionValues: { Color: 'Chalk' } },
            { sku: 'EDGE-BOWLS-SAG', priceCents: money(48), inventoryPolicy: 'continue', optionValues: { Color: 'Sage' } },
        ],
        images: [{ assetId: 'ek-prod-bowls', isPrimary: true, alt: 'A nesting set of prep bowls in muted tones' }],
    },
    {
        handle: 'digital-kitchen-scale',
        title: 'Digital Kitchen Scale',
        description:
            'A slim scale that reads to the gram under a single seamless glass top — no seams to trap flour, no buttons to gum up. It weighs up to 5 kilos, tares with a tap, and switches between grams and ounces, then wipes clean and slides into a drawer. The quiet upgrade that makes baking and coffee actually repeatable.',
        status: 'active',
        productType: 'Prep',
        vendor: VENDOR,
        tags: ['prep', 'scale', 'digital', 'baking'],
        categoryHandles: ['prep'],
        collectionHandles: ['the-essentials', 'prep-edit', 'gift-ready'],
        seoTitle: 'Digital Kitchen Scale — 5 kg, gram-accurate | Edge',
        seoDescription: 'A slim gram-accurate kitchen scale with a seamless glass top, tap tare and a 5 kg capacity.',
        variants: [{ sku: 'EDGE-SCALE', priceCents: money(39), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'ek-prod-scale', isPrimary: true, alt: 'A slim digital kitchen scale with a glass top' }],
    },
    {
        handle: 'silicone-tool-set',
        title: 'Silicone Utensil Set',
        description:
            'The five tools you actually use — a spoon, a slotted spoon, a spatula, a turner and a ladle — in one seamless piece of heat-safe silicone over a solid steel core, so nothing scratches your nonstick and nothing traps grime in a joint. Firm enough to lift a full ladle, soft enough to fold egg whites. Dishwasher-safe and good to 500°F.',
        status: 'active',
        productType: 'Tool',
        vendor: VENDOR,
        tags: ['tools', 'utensils', 'silicone', 'heat-safe'],
        categoryHandles: ['tools'],
        collectionHandles: ['prep-edit', 'gift-ready'],
        seoTitle: 'Silicone Utensil Set — 5 piece, nonstick-safe | Edge',
        seoDescription: 'A five-piece seamless silicone utensil set over a steel core — nonstick-safe, heat-safe to 500°F, dishwasher-safe.',
        options: [
            {
                name: 'Color',
                displayType: 'swatch',
                values: [{ value: 'Graphite' }, { value: 'Chalk' }, { value: 'Sage' }],
            },
        ],
        variants: [
            { sku: 'EDGE-TOOLS-GRA', priceCents: money(42), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Graphite' } },
            { sku: 'EDGE-TOOLS-CHK', priceCents: money(42), inventoryPolicy: 'continue', optionValues: { Color: 'Chalk' } },
            { sku: 'EDGE-TOOLS-SAG', priceCents: money(42), inventoryPolicy: 'continue', optionValues: { Color: 'Sage' } },
        ],
        images: [{ assetId: 'ek-prod-tools', isPrimary: true, alt: 'A set of silicone cooking utensils in a caddy' }],
    },
    {
        handle: 'composite-cutting-board',
        title: 'Composite Cutting Board',
        description:
            'A board that’s kind to your knives and easy on you — a dense wood-fibre composite that’s gentler than bamboo, won’t split or warp, and goes in the dishwasher when a wooden board can’t. A juice groove around the edge, a slim profile, and grippy feet so it stays put. Handsome enough to serve on, tough enough to prep on all week.',
        status: 'active',
        productType: 'Prep',
        vendor: VENDOR,
        tags: ['prep', 'cutting-board', 'composite', 'dishwasher-safe'],
        categoryHandles: ['prep'],
        collectionHandles: ['prep-edit', 'gift-ready'],
        seoTitle: 'Composite Cutting Board — dishwasher-safe | Edge',
        seoDescription: 'A dense wood-fibre composite cutting board — knife-friendly, warp-proof, dishwasher-safe, with a juice groove.',
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: 'Small' }, { value: 'Large' }] },
        ],
        variants: [
            { sku: 'EDGE-BOARD-S', priceCents: money(35), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Small' } },
            { sku: 'EDGE-BOARD-L', priceCents: money(49), inventoryPolicy: 'continue', optionValues: { Size: 'Large' } },
        ],
        images: [{ assetId: 'ek-prod-board', isPrimary: true, alt: 'A minimal composite cutting board on a counter' }],
    },
    {
        handle: 'modular-storage-set',
        title: 'Modular Storage Set',
        description:
            'A ten-piece set of borosilicate glass containers on one footprint — the same base size in three depths, so they stack square in the fridge and nest flat in the cupboard. Airtight bamboo-and-silicone lids, oven- and freezer-safe glass, and a lid that comes clean without a scrub. The upgrade that finally makes your leftovers look like a plan.',
        status: 'active',
        productType: 'Storage set',
        vendor: VENDOR,
        tags: ['prep', 'storage', 'glass', 'modular', 'sets'],
        categoryHandles: ['prep', 'sets'],
        collectionHandles: ['new-arrivals', 'prep-edit', 'gift-ready'],
        seoTitle: 'Modular Storage Set — 10 piece borosilicate glass | Edge',
        seoDescription: 'A ten-piece modular glass storage set — one footprint, three depths, airtight lids, oven- and freezer-safe.',
        variants: [{ sku: 'EDGE-STORAGE', priceCents: money(69), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'ek-prod-storage', isPrimary: true, alt: 'A set of modular glass storage containers with lids' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'cookware', name: 'Cookware', description: 'Ceramic nonstick pans and the precision kettle.', featured: true },
        { handle: 'tools', name: 'Tools', description: 'Knives and utensils, cleanly made.', featured: true },
        { handle: 'prep', name: 'Prep', description: 'Bowls, boards, scales and storage.', featured: true },
        { handle: 'sets', name: 'Sets', description: 'Pieces that fit together from day one.', featured: true },
    ],
    collections: [
        {
            handle: 'new-arrivals',
            name: 'New this season',
            description: 'The newest additions to the range.',
            type: 'manual',
            featured: true,
            productHandles: ['ceramic-nonstick-pan-set', 'precision-kettle', 'precision-knife-set', 'modular-storage-set'],
        },
        {
            handle: 'best-sellers',
            name: 'Best sellers',
            description: 'The pieces most kitchens start with.',
            type: 'manual',
            featured: true,
            productHandles: ['ceramic-nonstick-pan-set', 'ceramic-frypan', 'precision-kettle', 'nesting-prep-bowls'],
        },
        {
            handle: 'the-essentials',
            name: 'The essentials',
            description: 'A whole working kitchen in a handful of pieces.',
            type: 'manual',
            featured: true,
            productHandles: ['ceramic-nonstick-pan-set', 'precision-knife-set', 'precision-kettle', 'digital-kitchen-scale'],
        },
        {
            handle: 'cookware-edit',
            name: 'The cookware edit',
            description: 'Even-heat pans for every job on the stove.',
            type: 'manual',
            featured: false,
            productHandles: ['ceramic-nonstick-pan-set', 'ceramic-frypan', 'precision-kettle'],
        },
        {
            handle: 'prep-edit',
            name: 'The prep edit',
            description: 'The quiet tools that speed up every dinner.',
            type: 'manual',
            featured: false,
            productHandles: ['nesting-prep-bowls', 'digital-kitchen-scale', 'silicone-tool-set', 'composite-cutting-board', 'modular-storage-set'],
        },
        {
            handle: 'gift-ready',
            name: 'Gift ready',
            description: 'The ones worth wrapping — for new homes and good cooks.',
            type: 'manual',
            featured: false,
            productHandles: ['nesting-prep-bowls', 'silicone-tool-set', 'composite-cutting-board', 'modular-storage-set', 'digital-kitchen-scale'],
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
        slug: 'ceramic-nonstick-explained',
        status: 'published',
        body: {
            title: 'How ceramic nonstick actually works — and how to keep it',
            excerpt: 'Ceramic nonstick isn’t a coating you baby, but it isn’t indestructible either. Here’s what it is, why we chose it, and the two habits that make it last for years.',
            featuredImage: { $asset: 'ek-post-nonstick' },
            body: {
                type: 'doc',
                content: [
                    para('“Nonstick” has meant a lot of things over the years, and not all of them good. The old slick coatings did their job but were built on PFAS chemistry — the “forever chemicals” nobody wants flaking into dinner. Ceramic nonstick is a different idea entirely: a thin, glass-like mineral layer, cured onto the pan, that food slides off because the surface is genuinely smooth rather than chemically slippery. No PFAS, no PFOA, nothing to worry about at high heat.'),
                    h2('Why we build it on clad aluminium'),
                    para('A nonstick surface is only as good as the metal under it. A cheap ceramic pan is a stamped aluminium disc that hot-spots and warps, and the moment it warps, the coating stops making even contact and starts to fail. Ours is fully clad — aluminium bonded through the whole body, not just the base — so heat spreads evenly and the surface stays flat. Even heat is what lets you cook on medium instead of blasting the pan, and cooking on medium is most of why the surface lasts.'),
                    h2('The two habits that keep it'),
                    para('First: keep the heat moderate. Ceramic doesn’t need a screaming-hot pan to release food, and overheating an empty pan is the fastest way to dull any nonstick. Preheat on medium, add a little fat, and you’re set. Second: use soft tools and skip the abrasives — a silicone spatula, a soft sponge, no metal and no scouring pads. Let a hot pan cool before it hits water, hand-wash when you can, and store it with a liner if you stack it. Do that, and a ceramic pan stays slick for years instead of months.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'small-kitchen-edit',
        status: 'published',
        body: {
            title: 'The short list that replaces a drawer full of gadgets',
            excerpt: 'You don’t need forty tools. You need a handful of good ones that each do several jobs. Here’s the edit we’d outfit a first kitchen with.',
            featuredImage: { $asset: 'ek-post-tools' },
            body: {
                type: 'doc',
                content: [
                    para('Open most kitchen drawers and you’ll find the same thing: a garlic press used twice, an avocado slicer, an egg separator, and one good knife buried under all of it. Single-use gadgets are sold on a moment of “oh, clever” and then live in the way for a decade. A well-designed kitchen is the opposite — a small number of tools, each of which quietly does five things.'),
                    h2('The five that earn their place'),
                    para('A chef’s knife handles almost every cut; a paring knife covers the small, close work the big blade can’t. One good ceramic frypan does eggs, sears, sautés and a quick sauce. A set of nesting prep bowls turns a chaotic counter into a calm one — everything measured out before the heat goes on. A digital scale makes baking and coffee actually repeatable. And one flexible silicone spatula-slash-turner moves everything without scratching a thing. That’s it. That’s a kitchen.'),
                    h2('Buy for the job, not the moment'),
                    para('The test for any tool is simple: will you reach for it every week, and does it do more than one thing? If the answer to either is no, it’s a drawer-filler dressed up as a solution. Spend the gadget money on fewer, better pieces that fit together and last, and the kitchen gets calmer and the cooking gets easier. Less stuff, more cooking — that’s the whole idea.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'design-for-the-counter',
        status: 'published',
        body: {
            title: 'Why we design for the counter, not the cupboard',
            excerpt: 'Most kitchen tools are designed to be photographed, then hidden. We design the opposite way — for the things you leave out and see every day.',
            featuredImage: { $asset: 'ek-post-counter' },
            body: {
                type: 'doc',
                content: [
                    para('A lot of kitchenware is designed for the box it’s sold in — a bright color, a busy shape, a feature list printed on the shrink-wrap. It looks great on a shelf and wrong on your counter. We design from the other end: the tools you use most are the ones you leave out, so we make them for the counter you live with, not the cupboard they hide in.'),
                    h2('Calm on the outside, clever on the inside'),
                    para('That means restraint where you can see it. Muted, matte finishes that don’t shout or date. Shapes that sit quietly next to a plant and a coffee jar. Handles at angles that feel right in the hand rather than dramatic in a photo. The engineering we’re proud of — the clad base, the to-the-degree kettle, the seamless silicone over a steel core — lives on the inside, doing the work without asking for attention.'),
                    h2('A range that belongs together'),
                    para('Designing for the counter also means designing as a family. Every piece shares a palette and a language, so the pan you buy this year still belongs beside the bowls you add next year. Nothing clashes, nothing looks orphaned, and a kitchen built one piece at a time still looks like it was planned. When your tools are calm and consistent, the counter feels finished — and a finished-feeling kitchen is a nicer place to cook.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'retail-kitchenware-modern',
    key: 'sparx-retail-kitchenware-modern',
    name: 'Kitchenware (Modern)',
    theme: THEME,
    summary:
        'A complete, working shop for a modern kitchen-design studio: a real catalogue of ceramic nonstick cookware, a precision kettle, a clean knife set, nesting prep bowls, a digital scale, silicone tools and modular storage, with categories, collections, a bespoke PDP and a full merchandised home page. Sleek modern theme — crisp cool-grey ground, near-black controls, an electric cobalt accent, clean grotesk type. Shipped as Edge.',
    tagline: 'A sleek, working storefront for a modern kitchen-design studio.',
    vertical: 'retail',
    industry: 'Kitchenware & small appliances',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 88,
    brand: {
        businessName: 'Edge',
        tagline: 'Beautifully engineered tools for the modern kitchen.',
    },
    chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
    seo: {
        home: {
            title: 'Edge — beautifully engineered tools for the modern kitchen',
            description:
                'Edge is a modern kitchen-design studio — ceramic nonstick cookware, a precision kettle and a clean knife set, all designed as one range and built to be kept.',
        },
        about: {
            title: 'About Edge',
            description:
                'Why Edge makes fewer, better kitchen tools — a short considered range, calm design, clever engineering on the inside, and a ten-year guarantee on every piece.',
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
