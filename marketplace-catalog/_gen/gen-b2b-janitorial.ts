// sparx-b2b-janitorial — a B2B / WHOLESALE site template: a janitorial & facility-supply
// distributor selling by the case, drum and carton to offices, schools and facilities.
//
// A trade-buyer sibling of the retail gold reference (gen-retail-coffee-craft.ts): the SAME
// harness, the SAME 9-page commerce site (home merchandising → shop → collections → cart →
// search → journal → about → contact) with a bespoke PDP — but framed for a purchasing
// manager, not a shopper. Case/drum pack sizes and minimum-order quantities live in every
// product; prices are per-case trade prices; the voice is a reliable facilities supplier —
// contract pricing, scheduled deliveries, net terms, a named account manager, SDS on file.
// Shipped as Saniworx.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme inline
// (`theme` on the spec), so the whole family can be authored in parallel without any two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present, and — because this is a
// COMMERCE vertical (`b2b`) — auto-attaches the shop marketing emails (welcome + win-back), so
// this file authors none.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-janitorial.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-janitorial/**" \
//     "marketplace-catalog/_gen/gen-b2b-janitorial.ts"
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
// A clean facilities-supply look: a cool teal-tinted near-white ground, deep readable ink,
// a confident teal-blue primary and a fresh hygienic teal accent, under a technical grotesk
// over a humanist sans. Complete light + dark, AA on every role — every role used as TEXT on
// the light ground sits at or below ~50% L (the blueprint sweep's contrast check is the gate).
const THEME = defineTheme({
    name: 'saniwrx-trade',
    type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
    shape: { selector: '0.5rem', field: '0.375rem', box: '0.625rem', depth: '0' },
    light: {
        surfaces: ['oklch(98% 0.008 210)', 'oklch(95% 0.014 205)', 'oklch(90% 0.022 200)', 'oklch(23% 0.03 225)'],
        roles: {
            primary: 'oklch(45% 0.12 220)',
            secondary: 'oklch(42% 0.06 225)',
            accent: 'oklch(50% 0.14 200)',
            neutral: 'oklch(28% 0.02 225)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(20% 0.02 225)', 'oklch(17% 0.02 225)', 'oklch(14% 0.02 225)', 'oklch(96% 0.008 210)'],
        roles: {
            primary: 'oklch(74% 0.12 215)',
            secondary: 'oklch(76% 0.05 220)',
            accent: 'oklch(76% 0.13 200)',
            neutral: 'oklch(30% 0.02 225)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "fac-hero": "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RvY2tlZCUyMGphbml0b3JpYWwlMjBzdXBwbHklMjB3YXJlaG91c2UlMjBhaXNsZSUyMHBhbGxldGlzZWQlMjBjYXNlc3xlbnwwfDB8fHwxNzg2NDEzNDQxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "fac-tile-chemicals": "https://images.unsplash.com/photo-1679104143774-d72d83a2a037?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2FsbG9uJTIwYm90dGxlcyUyMGNsZWFuaW5nJTIwY2hlbWljYWwlMjBjb25jZW50cmF0ZSUyMHNoZWxmfGVufDB8MHx8fDE3ODY0MTM0NDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "fac-tile-paper": "https://images.unsplash.com/photo-1631524254770-03abe3f42a0d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZXMlMjBwYXBlciUyMHRvd2VsJTIwdG9pbGV0JTIwdGlzc3VlJTIwcm9sbHN8ZW58MHwwfHx8MTc4NjQxMzQ0N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "fac-tile-liners": "https://images.unsplash.com/photo-1611284446314-60a58ac0deb9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbHMlMjBjYXJ0b25zJTIwdHJhc2glMjBjYW4lMjBsaW5lcnN8ZW58MHwwfHx8MTc4NjQxMzQ1MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "fac-tile-tools": "https://images.unsplash.com/photo-1669101602108-fa5ba89507ee?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWljcm9maWJyZSUyMGNsb3RocyUyMGZsb29yJTIwcGFkcyUyMGNsZWFuaW5nJTIwdG9vbHN8ZW58MHwwfHx8MTc4NjQxMzQ1M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "fac-band-delivery": "https://images.unsplash.com/photo-1607227063002-677dc5fdf96f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVsaXZlcnklMjB2YW4lMjBiZWluZyUyMGxvYWRlZCUyMGNhc2VzJTIwZmFjaWxpdHklMjBzdXBwbGllc3xlbnwwfDB8fHwxNzg2NDEzNDU2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "fac-band-account": "https://images.unsplash.com/photo-1648824572347-517357c9c44e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmFjaWxpdGllcyUyMGJ1eWVyJTIwcmV2aWV3aW5nJTIwc3VwcGx5JTIwb3JkZXIlMjB0YWJsZXR8ZW58MHwwfHx8MTc4NjQxMzQ1OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-disinfectant": "https://images.unsplash.com/photo-1785061381923-1875465d45a4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGRpc2luZmVjdGFudCUyMGNsZWFuZXIlMjBib3R0bGVzfGVufDB8MHx8fDE3ODY0MTM0NjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-toilet-tissue": "https://images.unsplash.com/photo-1583496597549-0fd8b25e34e2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Y2FzZSUyMHR3by1wbHklMjB0b2lsZXQlMjB0aXNzdWUlMjByb2xsc3xlbnwwfDB8fHwxNzg2NDEzNDY5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-liners": "https://images.unsplash.com/photo-1683516435482-f3cea544ee95?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FydG9uJTIwbG93LWRlbnNpdHklMjB0cmFzaCUyMGNhbiUyMGxpbmVyc3xlbnwwfDB8fHwxNzg2NDEzNDczfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-microfibre": "https://images.unsplash.com/photo-1737091901849-f79fc399ac14?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBmb2xkZWQlMjBtaWNyb2ZpYnJlJTIwY2xlYW5pbmclMjBjbG90aHN8ZW58MHwwfHx8MTc4NjQxMzQ3OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-floor-pads": "https://images.unsplash.com/photo-1759159091682-3b98f4759367?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGZsb29yJTIwbWFjaGluZSUyMGJ1ZmZpbmclMjBwYWRzfGVufDB8MHx8fDE3ODY0MTM0ODF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-glass-cleaner": "https://images.unsplash.com/photo-1737372842504-260e65e0eeab?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGdsYXNzJTIwc3VyZmFjZSUyMGNsZWFuZXIlMjBjb25jZW50cmF0ZXxlbnwwfDB8fHwxNzg2NDEzNDg1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-starter-kit": "https://images.unsplash.com/photo-1577369117918-7e3785e39cb7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmFjaWxpdHklMjBzdGFydGVyJTIwa2l0JTIwY2xlYW5pbmclMjBjaGVtaWNhbHMlMjBwYXBlciUyMHRvb2xzfGVufDB8MHx8fDE3ODY0MTM0ODh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-protocol": "https://images.unsplash.com/photo-1737372805905-be0b91ec86fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xlYW5pbmclMjBjYXJ0JTIwc2V0JTIwdXAlMjByZXN0cm9vbSUyMGNsZWFuaW5nJTIwcHJvdG9jb2x8ZW58MHwwfHx8MTc4NjQxMzQ5MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-sustainability": "https://images.unsplash.com/photo-1755606277170-4e89d5847e14?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVjeWNsYWJsZSUyMHBhY2thZ2luZyUyMHJlZmlsbGFibGUlMjBjbGVhbmluZyUyMGNvbnRhaW5lcnN8ZW58MHwwfHx8MTc4NjQxMzQ5Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'fac-hero', url: src('fac-hero'), alt: 'A stocked janitorial supply warehouse aisle with palletised cases' },
    { id: 'fac-tile-chemicals', url: src('fac-tile-chemicals'), alt: 'Gallon bottles of cleaning chemical concentrate on a shelf' },
    { id: 'fac-tile-paper', url: src('fac-tile-paper'), alt: 'Cases of paper towel and toilet tissue rolls' },
    { id: 'fac-tile-liners', url: src('fac-tile-liners'), alt: 'Rolls and cartons of trash can liners' },
    { id: 'fac-tile-tools', url: src('fac-tile-tools'), alt: 'Microfibre cloths, floor pads and cleaning tools' },
    { id: 'fac-band-delivery', url: src('fac-band-delivery'), alt: 'A delivery van being loaded with cases of facility supplies' },
    { id: 'fac-band-account', url: src('fac-band-account'), alt: 'A facilities buyer reviewing a supply order on a tablet' },
    { id: 'prod-multi-surface', url: src('prod-multi-surface'), alt: 'A case of multi-surface cleaner concentrate gallons' },
    { id: 'prod-disinfectant', url: src('prod-disinfectant'), alt: 'A case of disinfectant cleaner bottles' },
    { id: 'prod-paper-towels', url: src('prod-paper-towels'), alt: 'A case of hardwound roll paper towels' },
    { id: 'prod-toilet-tissue', url: src('prod-toilet-tissue'), alt: 'A case of two-ply toilet tissue rolls' },
    { id: 'prod-liners', url: src('prod-liners'), alt: 'A carton of low-density trash can liners' },
    { id: 'prod-hand-soap', url: src('prod-hand-soap'), alt: 'A case of gallon hand soap refills' },
    { id: 'prod-microfibre', url: src('prod-microfibre'), alt: 'A stack of folded microfibre cleaning cloths' },
    { id: 'prod-floor-pads', url: src('prod-floor-pads'), alt: 'A case of floor machine buffing pads' },
    { id: 'prod-glass-cleaner', url: src('prod-glass-cleaner'), alt: 'A case of glass and surface cleaner concentrate' },
    { id: 'prod-starter-kit', url: src('prod-starter-kit'), alt: 'A facility starter kit of cleaning chemicals, paper and tools' },
    { id: 'post-protocol', url: src('post-protocol'), alt: 'A cleaning cart set up for a restroom cleaning protocol' },
    { id: 'post-cost-per-use', url: src('post-cost-per-use'), alt: 'A concentrate dilution station mixing ready-to-use cleaner' },
    { id: 'post-sustainability', url: src('post-sustainability'), alt: 'Recyclable packaging and refillable cleaning containers' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-b2b-janitorial: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one facility photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled catalogue CTA + a trade-account link. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('fac-hero'), alt: 'A stocked janitorial supply warehouse aisle', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Clean, stocked, and on schedule.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Saniworx is a janitorial and facility-supply distributor for offices, schools and facilities. We stock the cleaning chemicals, paper, liners and tools your building runs on — sold by the case, priced for the trade, and delivered on a schedule you can plan around.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the catalogue' }),
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
                        text: 'Everything your building needs',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'fac-tile-chemicals', label: 'Cleaning chemicals', href: '/shop', alt: 'Gallon bottles of cleaning concentrate' }),
                            categoryTile({ assetId: 'fac-tile-paper', label: 'Paper & tissue', href: '/shop', alt: 'Cases of paper towel and tissue' }),
                            categoryTile({ assetId: 'fac-tile-liners', label: 'Can liners', href: '/shop', alt: 'Cartons of trash can liners' }),
                            categoryTile({ assetId: 'fac-tile-tools', label: 'Tools & equipment', href: '/shop', alt: 'Microfibre cloths and floor pads' }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The trade-program band — the reason a facilities buyer opens an account here, laid out as
 *  a heading over a plain three-up of named terms (contract pricing, scheduled deliveries, net
 *  terms, account manager, SDS on file). Copy, not chrome — no eyebrows, hierarchy from scale. */
function tradeTerms(): Node {
    const term = (heading: string, body: string): Node =>
        el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
            children: [
                el('h3', 'text-xl font-bold tracking-tight text-base-content', { text: heading }),
                el('p', 'text-base leading-relaxed text-base-content', { text: body }),
            ],
        });
    return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('div', 'flex max-w-2xl flex-col gap-4', {
                        children: [
                            el('h2', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl', {
                                text: 'Buy the way a facility buys',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'A trade account turns a one-off order into a supply program: your prices, your delivery days, and one number to call when something runs short.',
                            }),
                        ],
                    }),
                    el('div', 'grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3 @3xl:gap-6', {
                        children: [
                            term('Contract pricing', 'Lock in per-case trade prices across your regular order, with volume breaks that get better as your carton count grows. No re-quoting every month.'),
                            term('Scheduled deliveries', 'Pick your delivery days and we build the route around them — weekly, biweekly or monthly — so consumables land before your closets run empty, not after.'),
                            term('Net-30 terms', 'Approved accounts order on net-30 invoicing with consolidated monthly statements, PO numbers on every line, and no card at checkout.'),
                            term('A named account manager', 'One person who knows your building, your standing order and your budget — reachable by phone or email, not a ticket queue.'),
                            term('SDS on file', 'Safety data sheets for every chemical we ship, kept current and pulled for your binder or your auditor on request. Compliance handled, not homework.'),
                            term('One catalogue, one invoice', 'Chemicals, paper, liners and tools on a single account and a single invoice — fewer vendors to manage and fewer boxes at the dock.'),
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
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Stocked and shipping this week' }),
    tradeTerms(),
    productsBlock({ source: 'commerce.category.cleaning-chemicals', layout: 'carousel', heading: 'Cleaning chemicals' }),
    editorialBand({
        heading: 'Delivered on a schedule you set',
        lead: 'Tell us your building, your rhythm and your closets, and we build a standing order and a delivery route around them. Your driver knows the dock, your account manager knows the order, and your janitorial closet stays stocked without a scramble.',
        assetId: 'fac-band-delivery',
        cta: 'Open a trade account',
        href: '/contact',
        alt: 'A delivery van being loaded with cases of facility supplies',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (distributor label, title, per-case price,
 *  low-stock, description with pack qty + MOQ, add-to-cart, a static trade-pricing & terms
 *  note, and policy links). */
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
                                        text: 'Saniworx Facility Supply',
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
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Trade pricing & terms' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Priced per case for the trade, with volume breaks on standing orders and better pricing under a contract. Open accounts order on net-30 with PO numbers on every line, and safety data sheets are on file for every chemical — pulled for your binder on request.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Stocked together' });

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
        'The facility-supply catalogue',
        'Every case we stock — cleaning chemicals, paper and tissue, can liners, and the tools to use them. Each product lists its pack size and minimum order quantity; prices are per-case trade prices. Filter by category, or sort however you order.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead(
        'Supply programs',
        'The catalogue grouped the way a building actually orders it — new-account essentials, the movers every closet reorders, a full restroom program, and floor-care sets. Build a standing order from a program in a few clicks.'
    ),
];
const SEARCH: Node[] = [
    pageMasthead('Search Saniworx', 'Looking for a product code, a pack size, or a cleaning guide? Search the whole catalogue and the journal below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Prices shown are per-case trade prices. Open trade accounts check out on net-30 with a PO number and free freight on qualifying orders — your account manager confirms delivery days on your first standing order.',
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
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The Saniworx facility journal' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Practical notes for the people who keep buildings running — cleaning protocols that hold up to an audit, how to read cost-per-use instead of shelf price, and where sustainable supply actually saves money.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Saniworx' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Saniworx started as a single delivery route serving a handful of office parks that were tired of chasing four vendors for one supply closet. It grew the way a good distributor should — one building, one standing order, one on-time delivery at a time — and it still runs on the same promise: keep the closet stocked, keep the price honest, keep the schedule.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We supply offices, schools, medical suites, gyms and property managers with the cleaning chemicals, paper, liners and tools their buildings run on. Everything ships by the case at trade pricing, from a warehouse we stock deep so a reorder is a delivery date, not a backorder.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'No mystery fees, no minimum you can’t hit, no chemical without a safety data sheet on file. Just a dependable supply program and a real person who answers the phone when the towels run low on a Friday.',
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
        intro: 'Tell us about your building — square footage, the closets you stock, and how often you want deliveries — and we’ll set up contract pricing, net-30 terms and a delivery schedule that fits. A real person at the warehouse will get back to you.',
        submitLabel: 'Request a trade account',
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

/** A single-pack case product — one SKU priced per case. */
const singleCase = (opts: {
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
    vendor: 'Saniworx',
    tags: opts.tags,
    categoryHandles: opts.categories,
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    variants: [{ sku: opts.sku, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.alt }],
});

const PRODUCTS: Product[] = [
    // ── Cleaning chemicals ──────────────────────────────────────────────────────────
    {
        handle: 'multi-surface-concentrate',
        title: 'Multi-Surface Cleaner Concentrate',
        description:
            'A neutral-pH concentrate for floors, walls and hard surfaces — no rinse, no residue, safe on finished floors. One gallon dilutes up to 1:64, making 64 gallons of ready-to-use cleaner, so the cost per bottle at the mop is pennies. Case of 4 one-gallon jugs. Minimum order 1 case.',
        status: 'active',
        productType: 'Cleaning chemical',
        vendor: 'Saniworx',
        tags: ['chemical', 'concentrate', 'floor-care', 'neutral-ph'],
        categoryHandles: ['cleaning-chemicals'],
        collectionHandles: ['best-sellers', 'new-account-essentials'],
        seoTitle: 'Multi-Surface Cleaner Concentrate — case of 4 gallons | Saniworx',
        seoDescription: 'Neutral-pH no-rinse floor and surface concentrate, dilutes 1:64. Case of 4 one-gallon jugs at trade pricing.',
        options: [
            { name: 'Format', displayType: 'dropdown', values: [{ value: 'Case of 4 (1 gal)' }, { value: '5-gallon drum' }] },
        ],
        variants: [
            { sku: 'SANI-MSC-CS4', priceCents: money(58), isDefault: true, inventoryPolicy: 'continue', optionValues: { Format: 'Case of 4 (1 gal)' } },
            { sku: 'SANI-MSC-DRM', priceCents: money(132), inventoryPolicy: 'continue', optionValues: { Format: '5-gallon drum' } },
        ],
        images: [{ assetId: 'prod-multi-surface', isPrimary: true, alt: 'A case of multi-surface cleaner concentrate gallons' }],
    },
    {
        handle: 'disinfectant-cleaner',
        title: 'Disinfectant Cleaner',
        description:
            'A one-step, EPA-registered disinfectant cleaner that cleans and kills 99.9% of common bacteria and viruses on hard non-porous surfaces in one pass — restrooms, break rooms, high-touch points. Case of 12 quart bottles with trigger sprayers. Minimum order 1 case. SDS on file.',
        status: 'active',
        productType: 'Cleaning chemical',
        vendor: 'Saniworx',
        tags: ['chemical', 'disinfectant', 'restroom', 'epa-registered'],
        categoryHandles: ['cleaning-chemicals'],
        collectionHandles: ['best-sellers', 'restroom-program', 'new-account-essentials'],
        seoTitle: 'Disinfectant Cleaner — case of 12 quarts | Saniworx',
        seoDescription: 'One-step EPA-registered disinfectant cleaner, kills 99.9% of common germs. Case of 12 quart bottles.',
        variants: [{ sku: 'SANI-DIS-CS12', priceCents: money(46), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-disinfectant', isPrimary: true, alt: 'A case of disinfectant cleaner bottles' }],
    },
    {
        handle: 'glass-cleaner-concentrate',
        title: 'Glass & Surface Cleaner Concentrate',
        description:
            'A fast-drying, streak-free glass and surface concentrate for windows, mirrors, stainless and displays. Dilutes 1:20 into a spray bottle, so one case refills a cart for weeks. Case of 4 one-gallon jugs. Minimum order 1 case.',
        status: 'active',
        productType: 'Cleaning chemical',
        vendor: 'Saniworx',
        tags: ['chemical', 'concentrate', 'glass'],
        categoryHandles: ['cleaning-chemicals'],
        collectionHandles: ['best-sellers'],
        seoTitle: 'Glass & Surface Cleaner Concentrate — case of 4 gallons | Saniworx',
        seoDescription: 'Streak-free glass and surface concentrate, dilutes 1:20. Case of 4 one-gallon jugs at trade pricing.',
        variants: [{ sku: 'SANI-GLS-CS4', priceCents: money(36), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-glass-cleaner', isPrimary: true, alt: 'A case of glass and surface cleaner concentrate' }],
    },
    {
        handle: 'foam-hand-soap',
        title: 'Foaming Hand Soap',
        description:
            'A mild, dye-free foaming hand soap that stretches further than lotion soap — gentle on skin for high-traffic restrooms, and refills standard bulk dispensers. Case of 4 one-gallon refills. Minimum order 1 case.',
        status: 'active',
        productType: 'Restroom supply',
        vendor: 'Saniworx',
        tags: ['restroom', 'hand-soap', 'refill'],
        categoryHandles: ['cleaning-chemicals'],
        collectionHandles: ['restroom-program', 'new-account-essentials'],
        seoTitle: 'Foaming Hand Soap — case of 4 gallons | Saniworx',
        seoDescription: 'Mild dye-free foaming hand soap for bulk dispensers. Case of 4 one-gallon refills at trade pricing.',
        variants: [{ sku: 'SANI-SOAP-CS4', priceCents: money(64), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-hand-soap', isPrimary: true, alt: 'A case of gallon hand soap refills' }],
    },
    // ── Paper & tissue ────────────────────────────────────────────────────────────
    {
        handle: 'hardwound-paper-towels',
        title: 'Hardwound Roll Paper Towels',
        description:
            'Natural-kraft hardwound roll towels for high-traffic restrooms and break rooms — 800 feet per roll, so a case lasts and fits standard hands-free dispensers. Case of 12 rolls (9,600 ft total). Minimum order 1 case.',
        status: 'active',
        productType: 'Paper',
        vendor: 'Saniworx',
        tags: ['paper', 'towels', 'restroom'],
        categoryHandles: ['paper-tissue'],
        collectionHandles: ['best-sellers', 'restroom-program', 'new-account-essentials'],
        seoTitle: 'Hardwound Roll Paper Towels — case of 12 rolls | Saniworx',
        seoDescription: 'Natural hardwound roll towels, 800 ft per roll, for hands-free dispensers. Case of 12 rolls.',
        variants: [{ sku: 'SANI-PT-CS12', priceCents: money(38), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-paper-towels', isPrimary: true, alt: 'A case of hardwound roll paper towels' }],
    },
    {
        handle: 'toilet-tissue',
        title: 'Two-Ply Toilet Tissue',
        description:
            'Soft-yet-durable two-ply standard-roll bath tissue, 500 sheets per roll — the everyday reorder for restrooms of any size, fitting standard and multi-roll dispensers. Case of 48 rolls. Minimum order 1 case.',
        status: 'active',
        productType: 'Paper',
        vendor: 'Saniworx',
        tags: ['paper', 'tissue', 'restroom'],
        categoryHandles: ['paper-tissue'],
        collectionHandles: ['best-sellers', 'restroom-program', 'new-account-essentials'],
        seoTitle: 'Two-Ply Toilet Tissue — case of 48 rolls | Saniworx',
        seoDescription: 'Two-ply standard-roll bath tissue, 500 sheets per roll. Case of 48 rolls at trade pricing.',
        variants: [{ sku: 'SANI-TT-CS48', priceCents: money(54), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-toilet-tissue', isPrimary: true, alt: 'A case of two-ply toilet tissue rolls' }],
    },
    // ── Can liners ────────────────────────────────────────────────────────────────
    {
        handle: 'can-liners',
        title: 'Low-Density Can Liners',
        description:
            'Puncture-resistant low-density liners for general waste — strong enough for break-room and restroom bins without tearing at the pull. Sold by the carton; pick your can size below. Minimum order 1 carton.',
        status: 'active',
        productType: 'Can liner',
        vendor: 'Saniworx',
        tags: ['liners', 'waste', 'low-density'],
        categoryHandles: ['liners'],
        collectionHandles: ['best-sellers', 'new-account-essentials'],
        seoTitle: 'Low-Density Can Liners — by the carton | Saniworx',
        seoDescription: 'Puncture-resistant low-density can liners in 33, 45 and 55 gallon sizes, sold by the carton.',
        options: [
            {
                name: 'Size',
                displayType: 'dropdown',
                values: [{ value: '33 gal — carton of 500' }, { value: '45 gal — carton of 250' }, { value: '55 gal — carton of 200' }],
            },
        ],
        variants: [
            { sku: 'SANI-LIN-33', priceCents: money(46), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '33 gal — carton of 500' } },
            { sku: 'SANI-LIN-45', priceCents: money(52), inventoryPolicy: 'continue', optionValues: { Size: '45 gal — carton of 250' } },
            { sku: 'SANI-LIN-55', priceCents: money(58), inventoryPolicy: 'continue', optionValues: { Size: '55 gal — carton of 200' } },
        ],
        images: [{ assetId: 'prod-liners', isPrimary: true, alt: 'A carton of low-density trash can liners' }],
    },
    // ── Tools & equipment ───────────────────────────────────────────────────────────
    singleCase({
        handle: 'microfibre-cloths',
        title: 'Microfibre Cleaning Cloths',
        description:
            'Color-coded 16-inch microfibre cloths that lift dust and grime with water alone — launderable up to 200 washes, so the cost per use undercuts disposable wipes fast. Pack of 50 cloths. Minimum order 1 pack.',
        price: 32,
        sku: 'SANI-MF-PK50',
        productType: 'Cleaning tool',
        categories: ['tools'],
        collections: ['best-sellers'],
        tags: ['tools', 'microfibre', 'reusable'],
        asset: 'prod-microfibre',
        alt: 'A stack of folded microfibre cleaning cloths',
        seoTitle: 'Microfibre Cleaning Cloths — pack of 50 | Saniworx',
        seoDescription: 'Color-coded 16-inch microfibre cloths, launderable to 200 washes. Pack of 50 at trade pricing.',
    }),
    {
        handle: 'floor-pads',
        title: 'Floor Machine Pads',
        description:
            'Full-cycle floor pads for buffing, scrubbing and stripping — consistent cut and long life on rotary and orbital machines. Case of 5 pads; pick your machine size below. Minimum order 1 case.',
        status: 'active',
        productType: 'Floor-care equipment',
        vendor: 'Saniworx',
        tags: ['tools', 'floor-care', 'pads'],
        categoryHandles: ['tools'],
        collectionHandles: ['floor-care'],
        seoTitle: 'Floor Machine Pads — case of 5 | Saniworx',
        seoDescription: 'Full-cycle floor buffing and scrubbing pads for rotary and orbital machines. Case of 5, 17 or 20 inch.',
        options: [
            { name: 'Size', displayType: 'dropdown', values: [{ value: '17 inch' }, { value: '20 inch' }] },
        ],
        variants: [
            { sku: 'SANI-PAD-17', priceCents: money(28), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '17 inch' } },
            { sku: 'SANI-PAD-20', priceCents: money(32), inventoryPolicy: 'continue', optionValues: { Size: '20 inch' } },
        ],
        images: [{ assetId: 'prod-floor-pads', isPrimary: true, alt: 'A case of floor machine buffing pads' }],
    },
    // ── The starter kit (a bundle) ──────────────────────────────────────────────────
    singleCase({
        handle: 'facility-starter-kit',
        title: 'Facility Starter Kit',
        description:
            'Everything a new account needs to stand up a supply closet in one order: a case of multi-surface concentrate, a case of disinfectant, a case of paper towels, a case of toilet tissue, a carton of 33-gallon liners and a pack of microfibre cloths — matched so nothing runs out first. One SKU, one delivery. Minimum order 1 kit.',
        price: 189,
        sku: 'SANI-KIT-START',
        productType: 'Supply kit',
        categories: ['tools'],
        collections: ['new-account-essentials'],
        tags: ['kit', 'starter', 'bundle'],
        asset: 'prod-starter-kit',
        alt: 'A facility starter kit of cleaning chemicals, paper and tools',
        seoTitle: 'Facility Starter Kit — stand up a supply closet in one order | Saniworx',
        seoDescription: 'A matched starter kit — concentrate, disinfectant, towels, tissue, liners and cloths. One SKU, one delivery.',
    }),
];

const COMMERCE = {
    categories: [
        { handle: 'cleaning-chemicals', name: 'Cleaning chemicals', description: 'Concentrates, disinfectants, glass cleaner and hand soap.', featured: true },
        { handle: 'paper-tissue', name: 'Paper & tissue', description: 'Roll towels and bath tissue by the case.', featured: true },
        { handle: 'liners', name: 'Can liners', description: 'Low-density liners by the carton.', featured: true },
        { handle: 'tools', name: 'Tools & equipment', description: 'Microfibre, floor pads and supply kits.', featured: true },
    ],
    collections: [
        {
            handle: 'new-account-essentials',
            name: 'New-account essentials',
            description: 'The core supply program every building starts with.',
            type: 'manual',
            featured: true,
            productHandles: ['facility-starter-kit', 'multi-surface-concentrate', 'disinfectant-cleaner', 'hardwound-paper-towels', 'toilet-tissue', 'can-liners'],
        },
        {
            handle: 'best-sellers',
            name: 'Best sellers',
            description: 'The cases every closet reorders.',
            type: 'manual',
            featured: true,
            productHandles: ['multi-surface-concentrate', 'disinfectant-cleaner', 'hardwound-paper-towels', 'toilet-tissue', 'can-liners', 'microfibre-cloths'],
        },
        {
            handle: 'restroom-program',
            name: 'Restroom program',
            description: 'Soap, tissue, towels and disinfectant for a full restroom.',
            type: 'manual',
            featured: false,
            productHandles: ['foam-hand-soap', 'toilet-tissue', 'hardwound-paper-towels', 'disinfectant-cleaner'],
        },
        {
            handle: 'floor-care',
            name: 'Floor care',
            description: 'Pads and concentrate for machine floor work.',
            type: 'manual',
            featured: false,
            productHandles: ['floor-pads', 'multi-surface-concentrate'],
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
        slug: 'a-restroom-cleaning-protocol-that-holds-up',
        status: 'published',
        body: {
            title: 'A restroom cleaning protocol that holds up to an audit',
            excerpt: 'A repeatable, top-down order of operations for restrooms — the one that passes inspection and doesn’t waste chemical.',
            featuredImage: { $asset: 'post-protocol' },
            body: {
                type: 'doc',
                content: [
                    para('A restroom is the room a building gets judged on, and the difference between one that passes an audit and one that doesn’t is rarely the products — it’s the order of operations. A protocol removes the guesswork so any member of the crew, on any shift, cleans it the same way.'),
                    h2('Work top-down, dirty-to-clean'),
                    para('Start high and finish low so nothing you’ve cleaned gets re-soiled: mirrors and dispensers first, then sinks and counters, then partitions and fixtures, and floors last. Apply disinfectant to toilets and urinals early and let it sit — dwell time is what actually kills germs, and spraying-and-immediately-wiping is the most common reason a surface tests dirty after it looks clean.'),
                    h2('Color-code to stop cross-contamination'),
                    para('Assign a microfibre color to each zone — one for toilets and urinals, another for sinks and counters, a third for mirrors and glass — and never cross them. It’s the simplest control there is against moving bacteria from a toilet to a sink, and it’s the first thing an inspector looks for. Launder the cloths after every shift and retire them at 200 washes.'),
                    h2('Restock while you’re in there'),
                    para('The last step of the protocol is a supply check: soap, tissue and towels topped up before you leave, and anything low written on the reorder list. A closet that’s restocked on a schedule never triggers the Friday-afternoon scramble — which is the whole point of a standing order.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'shelf-price-vs-cost-per-use',
        status: 'published',
        body: {
            title: 'Shelf price vs. cost-per-use: how to actually compare supplies',
            excerpt: 'The cheapest case is rarely the cheapest to use. Here’s the small bit of math that changes what you buy.',
            featuredImage: { $asset: 'post-cost-per-use' },
            body: {
                type: 'doc',
                content: [
                    para('The number on the case is the number that gets compared, because it’s the easy one. But a facility doesn’t spend per case — it spends per clean, per wash, per restroom visit. Cost-per-use is the honest comparison, and it routinely flips which product is actually cheaper.'),
                    h2('Concentrate is the clearest example'),
                    para('A gallon of ready-to-use cleaner and a gallon of 1:64 concentrate can sit on the shelf at similar prices, but the concentrate makes 64 gallons of working solution. Divide the case price by the gallons it yields and the concentrate isn’t a little cheaper per use — it’s an order of magnitude cheaper, before you count the freight and storage you save shipping water you already have.'),
                    h2('Reusables beat disposables on a curve'),
                    para('A microfibre cloth costs more than a paper wipe on day one and less than a paper wipe by the second week. Rated to 200 launderings, its cost-per-use falls every time it goes through the wash, while a disposable is spent the moment it’s used. The break-even is fast enough that most buildings switch their general wiping to microfibre and keep paper only where it’s required.'),
                    h2('Do the math once, buy right for a year'),
                    para('You don’t need a spreadsheet per order — just run cost-per-use once per category when you set your standing order, and lock it in. Ask us for the dilution yields and pack counts; we’ll do the division with you, because a customer who buys the right case reorders the right case.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'where-sustainable-supply-saves-money',
        status: 'published',
        body: {
            title: 'Where sustainable supply actually saves money',
            excerpt: 'Greener facility supply isn’t only a compliance line — done in the right places, it lowers cost and waste at the same time.',
            featuredImage: { $asset: 'post-sustainability' },
            body: {
                type: 'doc',
                content: [
                    para('Sustainability in facility supply gets talked about as a cost — a certification to chase, a premium to pay. In a few specific places it’s the opposite: the greener choice is also the cheaper one, because it removes waste you were paying to ship, store and throw away.'),
                    h2('Concentrates cut packaging and freight'),
                    para('Shipping ready-to-use cleaner means shipping mostly water in plastic jugs. Concentrates ship the active ingredient and dilute on site, which cuts packaging plastic, pallet count and freight weight dramatically — fewer trucks, fewer empty jugs in the dumpster, and a lower line on the invoice. It’s the rare change that a facilities budget and a sustainability report both like.'),
                    h2('Right-sizing liners stops buying air'),
                    para('Most buildings buy one liner size for every can, which means oversized bags on small bins — plastic that gets tied off half-empty. Matching liner size and mil to the actual can removes that waste at the source: less plastic bought, less plastic landfilled, and a smaller reorder. We’ll walk your bins and spec the sizes so you stop paying for bag you throw away.'),
                    h2('Reusables and refills close the loop'),
                    para('Launderable microfibre in place of disposable wipes, bulk refill soap in place of throwaway cartridges, and dispensers that take a refill rather than a replacement — each one trades a recurring disposable for a durable good and a smaller, cheaper reorder. Start where the volume is highest; that’s where both the savings and the waste reduction are biggest.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'b2b-janitorial',
    key: 'sparx-b2b-janitorial',
    name: 'Janitorial & Facility Supply (B2B)',
    theme: THEME,
    summary:
        'A complete, working wholesale shop for a janitorial and facility-supply distributor: a real catalogue of cleaning chemicals, paper, liners and tools sold by the case with pack sizes and MOQs, per-case trade pricing, categories, collections, a trade PDP and a merchandised home page framed for facilities buyers. Clean teal-tinted theme. Shipped as Saniworx.',
    tagline: 'A trade-account storefront for a janitorial & facility-supply distributor.',
    vertical: 'b2b',
    industry: 'Janitorial & facility supplies',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 84,
    brand: {
        businessName: 'Saniworx',
        tagline: 'Clean, stocked, and on schedule.',
    },
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Saniworx — janitorial & facility supply, by the case',
            description:
                'Saniworx is a janitorial and facility-supply distributor for offices, schools and facilities — cleaning chemicals, paper, liners and tools by the case, at trade pricing, on a delivery schedule you set.',
        },
        about: {
            title: 'About Saniworx',
            description:
                'How Saniworx supplies buildings — deep-stocked cases, honest trade pricing, scheduled deliveries and a real person on the phone. Keep the closet stocked, keep the schedule.',
        },
        contact: {
            title: 'Open a trade account — Saniworx',
            description:
                'Set up contract pricing, net-30 terms and a delivery schedule for your building. Tell us your square footage and closets and we’ll build your supply program.',
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
