// sparx-b2b-electrical-supply — a B2B/WHOLESALE commerce site template: an electrical
// wholesaler supplying electricians & contractors as TRADE BUYERS.
//
// A trade-family sibling of gen-b2b-industrial-supply: a complete, working wholesale shop the
// moment it installs — a real catalogue sold by the reel/box/pack/tub (twin & earth cable,
// consumer units, sockets & switches, LED downlights, circuit breakers, conduit & trunking,
// cable clips, a tester, a first-fix bundle), categories + collections, a bespoke trade PDP
// with a pricing-&-terms note, and the full 9-page commerce site (home merchandising → shop →
// collections → cart → search → journal → about → contact), dressed in an INLINE bespoke theme
// (cool slate ground, deep electric-blue primary, live amber signal accent, a clean grotesk).
// Shipped as Livewire Trade.
//
// SELF-CONTAINED BY DESIGN. A trade-family generator carries its OWN theme inline and passes
// it on the spec (`theme`), so the whole family can be authored in parallel without any two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-electrical-supply.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-electrical-supply/**" \
//     "marketplace-catalog/_gen/gen-b2b-electrical-supply.ts"
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
// An electrical wholesaler: a cool slate paper ground, deep slate ink, a deep electric-blue
// primary and a live-amber signal accent, under a clean grotesk over a humanist sans. Complete
// light + dark, AA on every role (the blueprint sweep's contrast check is the gate). The accent
// is a DEEP amber (~50% L) so it stays legible as link/label text on the light ground, and the
// secondary is a dark slate so labels never wash out.
const THEME = defineTheme({
    name: 'livewire-trade',
    type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
    shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
    light: {
        surfaces: ['oklch(97% 0.006 240)', 'oklch(94% 0.009 242)', 'oklch(89% 0.013 244)', 'oklch(22% 0.03 250)'],
        roles: {
            primary: 'oklch(45% 0.15 250)',
            secondary: 'oklch(42% 0.03 250)',
            accent: 'oklch(50% 0.14 65)',
            neutral: 'oklch(26% 0.02 250)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(21% 0.025 250)', 'oklch(17% 0.022 250)', 'oklch(14% 0.02 250)', 'oklch(95% 0.007 240)'],
        roles: {
            primary: 'oklch(72% 0.13 248)',
            secondary: 'oklch(77% 0.03 248)',
            accent: 'oklch(76% 0.14 70)',
            neutral: 'oklch(31% 0.02 250)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "elec-hero": "https://images.unsplash.com/photo-1608574839637-2f7d0290d01d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm93cyUyMGVsZWN0cmljYWwlMjB3aG9sZXNhbGUlMjB0cmFkZS1jb3VudGVyJTIwc2hlbHZpbmclMjBzdG9ja2VkJTIwY2FibGV8ZW58MHwwfHx8MTc4NjQyMjE0OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "elec-tile-cable": "https://images.unsplash.com/photo-1607631755187-298a3f9a640a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVlbHMlMjB0d2luJTIwZWFydGglMjBjYWJsZSUyMHdob2xlc2FsZXIlMjByYWNrfGVufDB8MHx8fDE3ODY0MjIxNTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "elec-tile-accessories": "https://images.unsplash.com/photo-1707570349880-745e000a6d97?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94ZXMlMjB3aGl0ZSUyMHNvY2tldHN8ZW58MHwwfHx8MTc4NjQyMjM1OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "elec-tile-lighting": "https://images.unsplash.com/photo-1526116638181-d787e552d669?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJheSUyMGxlZCUyMGRvd25saWdodHMlMjByZWFkeSUyMGZpdHxlbnwwfDB8fHwxNzg2NDIyMTU4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "elec-tile-protection": "https://images.unsplash.com/photo-1777894162454-35cff9998a25?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8Y29uc3VtZXIlMjB1bml0JTIwcm93cyUyMGNpcmN1aXQlMjBicmVha2Vyc3xlbnwwfDB8fHwxNzg2NDIyMTYxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "elec-band-trade": "https://images.unsplash.com/photo-1621905251189-08b45d6a269e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlY3RyaWNpYW4lMjBjb2xsZWN0aW5nJTIwb3JkZXJ8ZW58MHwwfHx8MTc4NjQyMjM2M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-twin-earth": "https://images.unsplash.com/photo-1543536448-d209d2d13a1c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8MTAwJTIwbWV0cmUlMjByZWVsfGVufDB8MHx8fDE3ODY0MjIzNjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-consumer-unit": "https://images.unsplash.com/photo-1566417110090-6b15a06ec800?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWV0YWwlMjBjb25zdW1lciUyMHVuaXQlMjBwb3B1bGF0ZWQlMjBicmVha2VycyUyMHJjZHN8ZW58MHwwfHx8MTc4NjQyMjE2OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-sockets": "https://images.unsplash.com/photo-1657776655487-18dcab7b2c65?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJhZGUlMjBib3glMjBkb3VibGUlMjBzb2NrZXRzfGVufDB8MHx8fDE3ODY0MjIxNzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-downlights": "https://images.unsplash.com/photo-1643151540477-1bc603bedf12?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8Ym94JTIwZmlyZS1yYXRlZCUyMGxlZCUyMGRvd25saWdodHN8ZW58MHwwfHx8MTc4NjQyMjE3N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-breakers": "https://images.unsplash.com/photo-1561015314-20e681abbac2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFjayUyMHR5cGUlMjBifGVufDB8MHx8fDE3ODY0MjIzNzB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-conduit": "https://images.unsplash.com/photo-1549084348-2b801274775a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnVuZGxlJTIwd2hpdGUlMjBwdmMlMjB0cnVua2luZyUyMGNvbmR1aXR8ZW58MHwwfHx8MTc4NjQyMjE4M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-clips": "https://images.unsplash.com/photo-1760348213270-7cd00b8c3405?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHViJTIwY2FibGUlMjBjbGlwc3xlbnwwfDB8fHwxNzg2NDIyMTg2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-tester": "https://images.unsplash.com/photo-1564942513760-da4dc8da3d47?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bXVsdGlmdW5jdGlvbiUyMGluc3RhbGxhdGlvbiUyMHRlc3RlciUyMGNhc2V8ZW58MHwwfHx8MTc4NjQyMjE4OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-first-fix": "https://images.unsplash.com/photo-1582954820640-42c30eeabe35?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Zmlyc3QtZml4JTIwYnVuZGxlJTIwY2FibGUlMjBiYWNrJTIwYm94ZXMlMjBjbGlwc3xlbnwwfDB8fHwxNzg2NDIyMTkzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-consumer-unit": "https://images.unsplash.com/photo-1635335874521-7987db781153?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8ZWxlY3RyaWNpYW4lMjB3aXJpbmclMjBuZXd8ZW58MHwwfHx8MTc4NjQyMjM3NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-downlights": "https://images.unsplash.com/photo-1771599141394-bc646d21cd61?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmlyZS1yYXRlZCUyMGxlZCUyMGRvd25saWdodHMlMjBmaXR0ZWQlMjBpbnRvJTIwY2VpbGluZ3xlbnwwfDB8fHwxNzg2NDIyMTk5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-van-stock": "https://images.unsplash.com/photo-1763025747123-bb3a2e3a5ac3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VsbC1vcmdhbmlzZWQlMjBlbGVjdHJpY2lhbiUyMHZhbiUyMHJhY2tlZCUyMHN0b2NrfGVufDB8MHx8fDE3ODY0MjIyMDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'elec-hero', url: src('elec-hero'), alt: 'Rows of electrical wholesale trade-counter shelving stocked with cable and accessories' },
    { id: 'elec-tile-cable', url: src('elec-tile-cable'), alt: 'Reels of twin and earth cable on a wholesaler rack' },
    { id: 'elec-tile-accessories', url: src('elec-tile-accessories'), alt: 'Boxes of white sockets and switches on a shelf' },
    { id: 'elec-tile-lighting', url: src('elec-tile-lighting'), alt: 'A tray of LED downlights ready to fit' },
    { id: 'elec-tile-protection', url: src('elec-tile-protection'), alt: 'A consumer unit with rows of circuit breakers' },
    { id: 'elec-band-trade', url: src('elec-band-trade'), alt: 'An electrician collecting an order at a trade counter' },
    { id: 'prod-twin-earth', url: src('prod-twin-earth'), alt: 'A 100 metre reel of grey twin and earth cable' },
    { id: 'prod-consumer-unit', url: src('prod-consumer-unit'), alt: 'A metal consumer unit populated with breakers and RCDs' },
    { id: 'prod-sockets', url: src('prod-sockets'), alt: 'A trade box of double sockets' },
    { id: 'prod-switches', url: src('prod-switches'), alt: 'A box of light switches' },
    { id: 'prod-downlights', url: src('prod-downlights'), alt: 'A box of fire-rated LED downlights' },
    { id: 'prod-breakers', url: src('prod-breakers'), alt: 'A pack of Type B MCB circuit breakers' },
    { id: 'prod-conduit', url: src('prod-conduit'), alt: 'A bundle of white PVC trunking and conduit' },
    { id: 'prod-clips', url: src('prod-clips'), alt: 'A tub of cable clips' },
    { id: 'prod-tester', url: src('prod-tester'), alt: 'A multifunction installation tester in a case' },
    { id: 'prod-first-fix', url: src('prod-first-fix'), alt: 'A first-fix bundle of cable, back boxes and clips' },
    { id: 'post-consumer-unit', url: src('post-consumer-unit'), alt: 'An electrician wiring a new consumer unit' },
    { id: 'post-downlights', url: src('post-downlights'), alt: 'Fire-rated LED downlights fitted into a ceiling' },
    { id: 'post-van-stock', url: src('post-van-stock'), alt: 'A well-organised electrician van racked with stock' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-b2b-electrical-supply: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one trade-counter photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a trade-account link. The link
 *  carries the "Open a trade account" call the platform navbar CTA also points at (/contact).
 *  Never ink on the photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('elec-hero'), alt: 'An electrical wholesale trade counter stocked to the roof', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'The parts to finish the job, in stock and priced for the trade.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Livewire is an electrical wholesaler for electricians and contractors. We carry the cable, consumer units, accessories, lighting and protection a first or second fix needs — sold by the reel and the box, at trade prices, ready on the counter or on the van next morning.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the catalog' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/contact' },
                                            text: 'Open a trade account',
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
            el('span', 'text-center text-base font-semibold uppercase tracking-wide text-base-content', { text: o.label }),
        ],
    });
}

function categoryTiles(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('h2', 'text-3xl font-bold uppercase tracking-tight text-base-content @3xl:text-4xl', {
                        text: 'Shop by trade',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'elec-tile-cable', label: 'Cable & wiring', href: '/shop', alt: 'Reels of twin and earth cable' }),
                            categoryTile({ assetId: 'elec-tile-accessories', label: 'Wiring accessories', href: '/shop', alt: 'Boxes of sockets and switches' }),
                            categoryTile({ assetId: 'elec-tile-lighting', label: 'Lighting', href: '/shop', alt: 'A tray of LED downlights' }),
                            categoryTile({ assetId: 'elec-tile-protection', label: 'Protection', href: '/shop', alt: 'A consumer unit with circuit breakers' }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The trade-terms band — pure COPY, no photo. Four cards spell out how wholesale ordering
 *  works here: per-unit trade pricing with volume breaks, net-30 for approved accounts,
 *  same-day counter collection + next-day delivery, and a named account manager. The tenant
 *  configures the real B2B pricing tiers, approval rules and terms in the Commerce module;
 *  this band SELLS the arrangement. */
function tradeTermsBand(): Node {
    const card = (title: string, body: string): Node =>
        el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
            children: [
                el('h3', 'text-lg font-bold uppercase tracking-wide text-base-content', { text: title }),
                el('p', 'text-base leading-relaxed text-base-content', { text: body }),
            ],
        });
    return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('div', 'flex max-w-2xl flex-col gap-4', {
                        children: [
                            el('h2', 'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-5xl', {
                                text: 'Built for the way sparkies buy',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'Open a trade account and you buy the way a contractor should — by the reel and the box, at wholesale rates, on terms. No consumer markups, no queueing behind a retail till.',
                            }),
                        ],
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            card('Trade prices', 'Per-unit wholesale rates with volume breaks that deepen by the reel, the box and the pallet. The bigger the job, the less each metre and each unit costs.'),
                            card('Net-30 terms', 'Approved accounts buy now and settle later on net-30. Kit out the whole job without tying up cash flow before the customer has even paid you.'),
                            card('Counter & next-day', 'Reserve online and collect same-day from the trade counter, or take next-day delivery to site or the yard. The stock is here, not on back-order.'),
                            card('Your account manager', 'A direct line to a real person who knows your firm, your standing lines and the jobs you run — not a call centre and a ticket number.'),
                        ],
                    }),
                    el('a', 'btn btn-primary btn-lg w-fit', { attrs: { href: '/contact' }, text: 'Open a trade account' }),
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
                                el('h2', 'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-5xl', {
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
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Off the shelf, on every job' }),
    tradeTermsBand(),
    productsBlock({ source: 'commerce.category.cable-wiring', layout: 'carousel', heading: 'Cable & wiring, by the reel' }),
    editorialBand({
        heading: 'One wholesaler, one invoice, one account manager',
        lead: 'Stop chasing four merchants for a single fix. Put the cable, the board, the accessories and the lighting on one trade account — one catalog to price a job from, one statement to reconcile, and one number to call when a line is short.',
        assetId: 'elec-band-trade',
        cta: 'Open a trade account',
        href: '/contact',
        alt: 'An electrician collecting an order at a trade counter',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (vendor label, title, per-unit price,
 *  low-stock, description, size/rating options + add-to-cart, a static "Trade pricing & terms"
 *  note with volume breaks + net-30, and policy links). */
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
                                        text: 'Livewire Trade',
                                    }),
                                    pdpTitle('h1', 'text-4xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-5xl'),
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
                            el('div', 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-200 p-5', {
                                children: [
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Trade pricing & terms' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'The price shown is the per-unit list rate. Trade accounts unlock volume breaks — deeper pricing by the reel, the box or a standing order — set for your account in your dashboard.',
                                    }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Approved accounts buy on net-30, collect same-day from the counter, or take next-day delivery to site. Not set up yet? Open a trade account and we will price your regular lines and get you on terms.',
                                    }),
                                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                        attrs: { href: '/contact' },
                                        text: 'Open a trade account',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Wired together' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(heading: string, lead: string): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', {
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
        'The catalog',
        'Every line we stock — cable and wiring, wiring accessories, lighting and circuit protection, sold by the reel, the box and the pack. Filter by trade or sort by price; trade accounts see their contract pricing at checkout.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead('Collections', 'The catalog grouped the way a spark actually buys — best sellers, new lines just in, the first-fix essentials, lighting for the fit-out, and the circuit protection every board needs.'),
];
const SEARCH: Node[] = [
    pageMasthead('Search the catalog', 'Know the part number, the cable size, or the breaker rating you need? Search the whole catalog and the wiring notes below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Review the reels, boxes and packs in your order before you check out. Trade accounts see contract pricing and net-30 terms applied here; everyone gets same-day counter collection or next-day delivery on in-stock lines. Need a formal quote to price a job? Your account manager can turn one around.',
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
                    el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Wiring notes' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Practical guidance from the trade counter — sizing cable and breakers, spec-ing a consumer unit, and stocking a van so you never lose a day to a missing part. Written for the people on the tools, not for a catalog.',
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
                    el('h1', 'text-5xl font-bold uppercase tracking-tight text-base-content @2xl:text-6xl', { text: 'About Livewire' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Livewire Trade is an electrical wholesaler. We stock the cable, consumer units, accessories, lighting and protection that a domestic rewire, a commercial fit-out or a maintenance call runs on — and we sell them to the trade by the reel and the box, at wholesale, on terms.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We built the business around one idea: a working electrician should not have to drive between four merchants, eat retail markups, or find the one line they need is on back-order. One catalog, one account, one invoice, and stock that is actually on the shelf when you order it.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'No minimum-order gymnastics, no mystery lead times, no pricing that jumps because you asked twice. Just the parts, to spec and priced fairly, ready on the counter or on the van — the boring reliability a job is built on.',
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
        heading: 'Open a trade account',
        intro: 'Tell us what your firm gets through and we will price your regular lines, set you up on net-30 terms, and put a name and a number to your account. Wholesale enquiries, standing orders and bulk quotes to price a job all start here.',
        submitLabel: 'Email the trade desk',
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

const VENDOR = 'Livewire Trade';

/** A single-SKU reel/box/pack/tub line — one price, no options (most lines ship one pack size). */
const packItem = (opts: {
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
    seoTitle: string;
    seoDescription: string;
}): Product => ({
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: opts.productType,
    vendor: VENDOR,
    tags: opts.tags,
    categoryHandles: opts.categories,
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    variants: [{ sku: opts.sku, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const PRODUCTS: Product[] = [
    {
        handle: 'twin-and-earth-cable-reel',
        title: 'Twin & Earth Cable — 100 m Reel',
        description:
            'Grey PVC twin-and-earth (6242Y) flat cable on a 100 m reel — the everyday wiring for lighting and ring finals. Pick the CSA the circuit calls for: 1.0 mm² and 1.5 mm² for lighting, 2.5 mm² for sockets. MOQ 1 reel; the more reels, the better the per-metre rate.',
        status: 'active',
        productType: 'Cable',
        vendor: VENDOR,
        tags: ['cable', 'twin-and-earth', '6242y', 'wiring'],
        categoryHandles: ['cable-wiring'],
        collectionHandles: ['best-sellers', 'first-fix', 'cable-wiring-shelf'],
        seoTitle: 'Twin & Earth Cable, 100 m Reel (6242Y) | Livewire Trade',
        seoDescription: 'Grey PVC twin-and-earth flat cable, 100 m reel. 1.0, 1.5 or 2.5 mm² for lighting and ring finals. Trade prices.',
        options: [{ name: 'Cable size', displayType: 'dropdown', values: [{ value: '1.0 mm²' }, { value: '1.5 mm²' }, { value: '2.5 mm²' }] }],
        variants: [
            { sku: 'LWT-CAB-TE-10', priceCents: money(38), isDefault: true, inventoryPolicy: 'continue', optionValues: { 'Cable size': '1.0 mm²' } },
            { sku: 'LWT-CAB-TE-15', priceCents: money(46), inventoryPolicy: 'continue', optionValues: { 'Cable size': '1.5 mm²' } },
            { sku: 'LWT-CAB-TE-25', priceCents: money(69), inventoryPolicy: 'continue', optionValues: { 'Cable size': '2.5 mm²' } },
        ],
        images: [{ assetId: 'prod-twin-earth', isPrimary: true, alt: 'A 100 metre reel of grey twin and earth cable' }],
    },
    {
        handle: 'consumer-unit',
        title: 'Metal Consumer Unit — Populated',
        description:
            'A steel-enclosure consumer unit to the latest wiring regs, pre-populated with a main switch, dual RCDs and a bank of MCBs — the board a domestic rewire or a new install drops straight in. Choose the way count for the circuits on the job. MOQ 1 unit.',
        status: 'active',
        productType: 'Protection',
        vendor: VENDOR,
        tags: ['consumer-unit', 'board', 'rcd', 'protection'],
        categoryHandles: ['protection'],
        collectionHandles: ['best-sellers', 'circuit-protection'],
        seoTitle: 'Metal Consumer Unit, Populated (10 or 16 way) | Livewire Trade',
        seoDescription: 'A metal-enclosure populated consumer unit with dual RCDs and MCBs, to the latest wiring regs. 10 or 16 way.',
        options: [{ name: 'Ways', displayType: 'dropdown', values: [{ value: '10 way' }, { value: '16 way' }] }],
        variants: [
            { sku: 'LWT-PRO-CU-10', priceCents: money(96), isDefault: true, inventoryPolicy: 'continue', optionValues: { Ways: '10 way' } },
            { sku: 'LWT-PRO-CU-16', priceCents: money(139), inventoryPolicy: 'continue', optionValues: { Ways: '16 way' } },
        ],
        images: [{ assetId: 'prod-consumer-unit', isPrimary: true, alt: 'A metal consumer unit populated with breakers and RCDs' }],
    },
    {
        handle: 'double-sockets-box',
        title: 'Double Switched Sockets — Box of 20',
        description:
            '13 A twin switched sockets with a clean flat plate, a box of 20 — the accessory a second fix eats through. White moulded as standard; step up to brushed steel for the feature rooms. MOQ 1 box. Buy the box and stop running back for singles.',
        status: 'active',
        productType: 'Accessories',
        vendor: VENDOR,
        tags: ['accessories', 'sockets', 'wiring-accessories', 'second-fix'],
        categoryHandles: ['wiring-accessories'],
        collectionHandles: ['best-sellers', 'second-fix'],
        seoTitle: 'Double Switched Sockets, Box of 20 (13 A) | Livewire Trade',
        seoDescription: '13 A twin switched sockets, flat plate, box of 20. White moulded or brushed steel. Trade prices.',
        options: [{ name: 'Finish', displayType: 'dropdown', values: [{ value: 'White moulded' }, { value: 'Brushed steel' }] }],
        variants: [
            { sku: 'LWT-ACC-SKT-WHT', priceCents: money(52), isDefault: true, inventoryPolicy: 'continue', optionValues: { Finish: 'White moulded' } },
            { sku: 'LWT-ACC-SKT-STL', priceCents: money(118), inventoryPolicy: 'continue', optionValues: { Finish: 'Brushed steel' } },
        ],
        images: [{ assetId: 'prod-sockets', isPrimary: true, alt: 'A trade box of double sockets' }],
    },
    packItem({
        handle: 'light-switches-box',
        title: 'Light Switches, 1-Gang 2-Way — Box of 20',
        description:
            '1-gang 2-way 10 A light switches on a slim flat plate, a box of 20 — the workhorse switch for landings, hallways and every room on the job. White moulded, screwless clip-on plate. MOQ 1 box.',
        price: 33,
        sku: 'LWT-ACC-SW-1G',
        productType: 'Accessories',
        categories: ['wiring-accessories'],
        collections: ['second-fix', 'wiring-accessories-shelf'],
        tags: ['accessories', 'switches', 'wiring-accessories', 'second-fix'],
        asset: 'prod-switches',
        seoTitle: 'Light Switches 1-Gang 2-Way, Box of 20 | Livewire Trade',
        seoDescription: '1-gang 2-way 10 A light switches, flat plate, box of 20. White moulded, screwless plate. Trade prices.',
    }),
    {
        handle: 'led-downlights-box',
        title: 'Fire-Rated LED Downlights — Box of 10',
        description:
            'Integrated fire-rated LED downlights, 6 W, dimmable, IP65 for bathrooms and kitchens — a box of 10 with a 90-minute fire rating and a flush white bezel. Pick the color temperature the room wants: warm 3000K or cool 4000K. MOQ 1 box.',
        status: 'active',
        productType: 'Lighting',
        vendor: VENDOR,
        tags: ['lighting', 'downlights', 'led', 'fire-rated'],
        categoryHandles: ['lighting'],
        collectionHandles: ['best-sellers', 'new-in', 'lighting-shelf'],
        seoTitle: 'Fire-Rated LED Downlights, Box of 10 (IP65) | Livewire Trade',
        seoDescription: 'Integrated fire-rated LED downlights, 6 W dimmable, IP65, box of 10. Warm 3000K or cool 4000K. Trade prices.',
        options: [{ name: 'Color temperature', displayType: 'dropdown', values: [{ value: 'Warm 3000K' }, { value: 'Cool 4000K' }] }],
        variants: [
            { sku: 'LWT-LGT-DL-30', priceCents: money(64), isDefault: true, inventoryPolicy: 'continue', optionValues: { 'Color temperature': 'Warm 3000K' } },
            { sku: 'LWT-LGT-DL-40', priceCents: money(64), inventoryPolicy: 'continue', optionValues: { 'Color temperature': 'Cool 4000K' } },
        ],
        images: [{ assetId: 'prod-downlights', isPrimary: true, alt: 'A box of fire-rated LED downlights' }],
    },
    {
        handle: 'mcb-circuit-breakers-pack',
        title: 'MCB Circuit Breakers — Pack of 10',
        description:
            'Type B single-pole miniature circuit breakers, 6 kA, a pack of 10 to populate a board or restock the van — the everyday protection for lighting and socket circuits. Pick the rating: 6 A for lighting, 16 A or 32 A for socket and appliance circuits. MOQ 2 packs.',
        status: 'active',
        productType: 'Protection',
        vendor: VENDOR,
        tags: ['protection', 'mcb', 'circuit-breaker', 'consumable'],
        categoryHandles: ['protection'],
        collectionHandles: ['circuit-protection', 'first-fix'],
        seoTitle: 'MCB Circuit Breakers Type B, Pack of 10 (6 kA) | Livewire Trade',
        seoDescription: 'Type B single-pole MCBs, 6 kA, pack of 10. 6 A, 16 A or 32 A for lighting and socket circuits. Trade prices.',
        options: [{ name: 'Rating', displayType: 'dropdown', values: [{ value: '6 A' }, { value: '16 A' }, { value: '32 A' }] }],
        variants: [
            { sku: 'LWT-PRO-MCB-06', priceCents: money(24), isDefault: true, inventoryPolicy: 'continue', optionValues: { Rating: '6 A' } },
            { sku: 'LWT-PRO-MCB-16', priceCents: money(24), inventoryPolicy: 'continue', optionValues: { Rating: '16 A' } },
            { sku: 'LWT-PRO-MCB-32', priceCents: money(27), inventoryPolicy: 'continue', optionValues: { Rating: '32 A' } },
        ],
        images: [{ assetId: 'prod-breakers', isPrimary: true, alt: 'A pack of Type B MCB circuit breakers' }],
    },
    packItem({
        handle: 'trunking-conduit-bundle',
        title: 'PVC Trunking & Conduit — Trade Bundle',
        description:
            'A mixed bundle of white PVC mini-trunking and round conduit with couplers and clips — the surface containment for a quick rewire or a garage circuit. 3 m lengths, self-adhesive backing on the trunking. MOQ 1 bundle. The tidy way to run cable on show.',
        price: 41,
        sku: 'LWT-CON-TRUNK-BDL',
        productType: 'Conduit & Trunking',
        categories: ['cable-wiring'],
        collections: ['first-fix', 'cable-wiring-shelf'],
        tags: ['conduit', 'trunking', 'containment', 'first-fix'],
        asset: 'prod-conduit',
        seoTitle: 'PVC Trunking & Conduit Trade Bundle | Livewire Trade',
        seoDescription: 'A mixed bundle of white PVC mini-trunking and round conduit with couplers and clips. 3 m lengths. Trade prices.',
    }),
    packItem({
        handle: 'cable-clips-tub',
        title: 'Cable Clips — Tub of 1000',
        description:
            'Twin-and-earth cable clips in a bulk tub of 1000 — the fixing you go through faster than any other on a first fix. Sized for 1.5 and 2.5 mm² T&E, with a hardened masonry nail that drives into brick and timber alike. MOQ 1 tub.',
        price: 19,
        sku: 'LWT-ACC-CLIP-1000',
        productType: 'Accessories',
        categories: ['wiring-accessories'],
        collections: ['first-fix', 'wiring-accessories-shelf'],
        tags: ['accessories', 'cable-clips', 'fixings', 'first-fix', 'bulk'],
        asset: 'prod-clips',
        seoTitle: 'Cable Clips, Tub of 1000 (T&E) | Livewire Trade',
        seoDescription: 'Twin-and-earth cable clips, bulk tub of 1000, for 1.5 and 2.5 mm² T&E. Hardened masonry nail. Trade prices.',
    }),
    packItem({
        handle: 'installation-tester',
        title: 'Multifunction Installation Tester',
        description:
            'A multifunction installation tester in a hard case — insulation resistance, continuity, loop impedance and RCD trip in one instrument, so you can certify a job to the regs without carrying four boxes. Calibration certificate included. MOQ 1 unit.',
        price: 429,
        sku: 'LWT-TST-MFT',
        productType: 'Test Equipment',
        categories: ['protection'],
        collections: ['new-in', 'circuit-protection'],
        tags: ['test-equipment', 'tester', 'certification', 'tools'],
        asset: 'prod-tester',
        seoTitle: 'Multifunction Installation Tester | Livewire Trade',
        seoDescription: 'A multifunction installation tester — insulation, continuity, loop impedance and RCD trip in one, with calibration cert.',
    }),
    packItem({
        handle: 'first-fix-bundle',
        title: 'First-Fix Trade Bundle',
        description:
            'A curated bundle of the lines a first fix runs out of first — a reel of 2.5 mm² T&E, a box of back boxes, a tub of cable clips and a pack of MCBs, packed together and priced below the sum of its parts. MOQ 1 bundle. The fastest way to kit a job from empty.',
        price: 129,
        sku: 'LWT-KIT-FIRSTFIX',
        productType: 'Bundle',
        categories: ['cable-wiring'],
        collections: ['new-in', 'first-fix'],
        tags: ['bundle', 'first-fix', 'kit', 'starter'],
        asset: 'prod-first-fix',
        seoTitle: 'First-Fix Trade Bundle | Livewire Trade',
        seoDescription: 'A curated first-fix bundle — 2.5 mm² T&E reel, back boxes, cable clips and MCBs, priced below the sum.',
    }),
];

const COMMERCE = {
    categories: [
        { handle: 'cable-wiring', name: 'Cable & wiring', description: 'Twin & earth, conduit and trunking.', featured: true },
        { handle: 'wiring-accessories', name: 'Wiring accessories', description: 'Sockets, switches and cable clips.', featured: true },
        { handle: 'lighting', name: 'Lighting', description: 'LED downlights and fittings.', featured: true },
        { handle: 'protection', name: 'Protection', description: 'Consumer units, breakers and testers.', featured: true },
    ],
    collections: [
        {
            handle: 'best-sellers',
            name: 'Best sellers',
            description: 'The lines firms reorder most.',
            type: 'manual',
            featured: true,
            productHandles: ['twin-and-earth-cable-reel', 'consumer-unit', 'double-sockets-box', 'led-downlights-box'],
        },
        {
            handle: 'new-in',
            name: 'New in',
            description: 'Lines just added to the catalog.',
            type: 'manual',
            featured: true,
            productHandles: ['led-downlights-box', 'installation-tester', 'first-fix-bundle'],
        },
        {
            handle: 'first-fix',
            name: 'First-fix essentials',
            description: 'Cable, containment and fixings for the first fix.',
            type: 'manual',
            featured: false,
            productHandles: ['twin-and-earth-cable-reel', 'trunking-conduit-bundle', 'cable-clips-tub', 'mcb-circuit-breakers-pack', 'first-fix-bundle'],
        },
        {
            handle: 'second-fix',
            name: 'Second-fix accessories',
            description: 'The sockets and switches a second fix eats through.',
            type: 'manual',
            featured: false,
            productHandles: ['double-sockets-box', 'light-switches-box'],
        },
        {
            handle: 'circuit-protection',
            name: 'Circuit protection',
            description: 'Boards, breakers and the tester to certify them.',
            type: 'manual',
            featured: false,
            productHandles: ['consumer-unit', 'mcb-circuit-breakers-pack', 'installation-tester'],
        },
        {
            handle: 'cable-wiring-shelf',
            name: 'Cable & wiring',
            description: 'By the reel and the bundle.',
            type: 'manual',
            featured: false,
            productHandles: ['twin-and-earth-cable-reel', 'trunking-conduit-bundle', 'first-fix-bundle'],
        },
        {
            handle: 'wiring-accessories-shelf',
            name: 'Wiring accessories',
            description: 'Sockets, switches and clips by the box.',
            type: 'manual',
            featured: false,
            productHandles: ['double-sockets-box', 'light-switches-box', 'cable-clips-tub'],
        },
        {
            handle: 'lighting-shelf',
            name: 'Lighting',
            description: 'Downlights for the fit-out.',
            type: 'manual',
            featured: false,
            productHandles: ['led-downlights-box'],
        },
    ],
    products: PRODUCTS,
};

// ── Content (wiring notes) ────────────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'sizing-cable-and-breakers',
        status: 'published',
        body: {
            title: 'Sizing cable and breakers without second-guessing',
            excerpt: 'The cable and the breaker have to protect each other. Here is the plain-English version of how the two are matched, so the board is safe and the run does not overheat.',
            featuredImage: { $asset: 'post-consumer-unit' },
            body: {
                type: 'doc',
                content: [
                    para('Every circuit is a partnership between the cable and the protective device in front of it. The cable can only carry so much current before it heats up; the breaker is there to trip before the cable ever gets there. Get the pairing wrong — an oversized breaker on an undersized cable — and the protection is protecting nothing. Get it right and the circuit runs cool and trips clean for the life of the install.'),
                    h2('Match the breaker to the cable, not the load'),
                    para('The common trap is sizing the breaker to the appliance and forgetting the cable. Work the other way: pick the cable for the load and the run, then choose a breaker whose rating the cable can safely carry even under fault. A 2.5 mm² twin-and-earth on a ring final sits behind a 32 A breaker; a 1.5 mm² lighting circuit behind a 6 A. When in doubt, the cable is the thing you cannot change once it is buried in a wall, so spec it generously.'),
                    h2('Do not forget the derating'),
                    para('The number on the cable is a best-case rating. Bunch several cables together, run them through insulation, or push a long distance, and the safe current drops — sometimes a lot. Volt-drop bites on the long runs too. The regs give you the correction factors; the habit worth building is to assume a cable in a real wall carries less than the datasheet says, and to size up rather than sail close to the limit.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'spec-a-consumer-unit',
        status: 'published',
        body: {
            title: 'How to spec a consumer unit for a domestic job',
            excerpt: 'A board is more than a row of breakers. Here is how to pick the enclosure, the RCD arrangement and the way count so the install passes and leaves room to grow.',
            featuredImage: { $asset: 'post-downlights' },
            body: {
                type: 'doc',
                content: [
                    para('The consumer unit is the heart of a domestic install, and the one part a customer never sees until something trips at 11pm. Spec it well and it is a five-minute reset and a clear label; spec it badly and it is a nuisance-tripping headache that takes out the whole house every time the kettle and the shower run together. The choices are simple once you break them down.'),
                    h2('Metal enclosure, to the current regs'),
                    para('Domestic boards are steel-enclosure now, for the fire rating, and they come to the latest amendment as standard. Do not fit a stripped-out board and populate it from a mixed drawer of old breakers — a populated unit from one maker keeps the device curves matched and the warranty intact. It also drops in faster, which is the difference between finishing the job today and coming back tomorrow.'),
                    h2('RCD arrangement and way count'),
                    para('Split the load so a single fault does not black out the house: dual-RCD or, better, RCBOs per circuit so only the faulty circuit drops. Then count the circuits — lighting up and down, ring finals, cooker, shower, outside — add a couple of spare ways for the extension nobody has mentioned yet, and pick the board a size up. Spare ways cost pennies now and save a board swap later.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'stock-your-van',
        status: 'published',
        body: {
            title: 'Stock your van so you never lose a day to a missing part',
            excerpt: 'The most expensive part on any job is the one you have to drive back for. Here is a simple van-stock system that keeps the fast movers on board and topped up.',
            featuredImage: { $asset: 'post-van-stock' },
            body: {
                type: 'doc',
                content: [
                    para('Ask any electrician where the day goes and a good chunk of it is the drive back to the merchant for a line they should have had on the van. A missing box of clips or the wrong breaker turns a half-day job into a full one. A stocked van is not about carrying everything — it is about never running out of the handful of lines you use on every single job.'),
                    h2('Rack the fast movers, and only the fast movers'),
                    para('Twin-and-earth in the common sizes, a box of sockets and switches, a tub of clips, a spread of MCBs, back boxes, connectors and a reel of flex. That short list covers the bulk of what a first and second fix consumes. Rack it so you can see at a glance when a bin is low — an open van bin that shows empty is worth more than a neat closed drawer you never check.'),
                    h2('Top up on a schedule, not a panic'),
                    para('The failure mode is topping up only when you hit zero on site, which is exactly when you cannot. Set a reorder point for each van line — half a box, a quarter tub — and top up on a standing order with your wholesaler so the stock is waiting on the counter before you run dry. Reserve online, collect on the way to the job, and the drive-back day disappears.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'b2b-electrical-supply',
    key: 'sparx-b2b-electrical-supply',
    name: 'Electrical Supply (B2B / Wholesale)',
    theme: THEME,
    summary:
        'A complete, working wholesale shop for an electrical wholesaler: a real trade catalogue sold by the reel, box and pack — twin & earth cable, consumer units, sockets & switches, LED downlights, circuit breakers, conduit and a tester — with categories, collections, a bespoke trade PDP (per-unit pricing, volume breaks, net-30), and a full merchandised home page. Cool electrical theme — slate ground, deep electric-blue, live-amber accent. Shipped as Livewire Trade.',
    tagline: 'A wholesale storefront built for electricians and contractors.',
    vertical: 'b2b',
    industry: 'Electrical wholesale',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 85,
    brand: {
        businessName: 'Livewire Trade',
        tagline: 'The parts to finish the job, in stock and priced for the trade.',
    },
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Livewire Trade — electrical wholesaler for the trade',
            description:
                'Livewire is an electrical wholesaler — cable, consumer units, accessories, lighting and protection sold by the reel and the box at trade prices, with net-30 terms, same-day counter collection and next-day delivery. Open a trade account.',
        },
        about: {
            title: 'About Livewire Trade',
            description:
                'How Livewire stocks, prices and ships — one catalog, one account, one invoice, wholesale by the reel and the box, and stock that is actually on the shelf when you order it.',
        },
        contact: {
            title: 'Open a trade account — Livewire Trade',
            description:
                'Set up a trade account with Livewire: wholesale per-unit pricing, volume breaks, net-30 terms, counter collection and next-day delivery, and a dedicated account manager. Wholesale enquiries and bulk quotes start here.',
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
