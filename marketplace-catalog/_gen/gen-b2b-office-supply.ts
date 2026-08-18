// sparx-b2b-office-supply — a B2B/WHOLESALE commerce site template: an office & workplace
// supplies distributor selling to TRADE BUYERS (businesses, not walk-in consumers).
//
// A complete, working wholesale shop the moment it installs — a real catalogue sold by the
// box/case (copier paper, pens, notebooks, toner, desk organisers, task chairs, whiteboards,
// breakroom & cleaning supplies, an office starter bundle) with per-box trade prices, pack
// quantities and MOQs — categories + collections, a bespoke trade PDP with a pricing-&-terms
// note, and the full 9-page commerce site (home merchandising → shop → collections → cart →
// search → journal → about → contact), dressed in an INLINE bespoke theme (cool near-white
// slate ground, a confident corporate blue primary, a teal signal accent, a clean grotesk).
// Shipped as Worksmith Supply Co.
//
// SELF-CONTAINED BY DESIGN. A trade-family generator carries its OWN theme inline and passes
// it on the spec (`theme`), so the whole family can be authored in parallel without any two
// generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-office-supply.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-office-supply/**" \
//     "marketplace-catalog/_gen/gen-b2b-office-supply.ts"
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
// An office-supplies distributor: a cool near-white slate paper ground, deep slate ink, a
// confident corporate-blue primary and a teal signal accent, under a clean grotesk over a
// humanist sans. Complete light + dark, AA on every role (the blueprint sweep's contrast check
// is the gate). The accent is a DEEP teal (~49% L) so it stays legible as link/label text on
// the light ground, and the secondary is a dark slate so labels never wash out.
const THEME = defineTheme({
    name: 'worksmith-trade',
    type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
    shape: { selector: '0.375rem', field: '0.375rem', box: '0.5rem', depth: '0' },
    light: {
        surfaces: ['oklch(98% 0.004 248)', 'oklch(95% 0.006 250)', 'oklch(90% 0.01 252)', 'oklch(24% 0.02 256)'],
        roles: {
            primary: 'oklch(45% 0.13 252)',
            secondary: 'oklch(43% 0.03 256)',
            accent: 'oklch(49% 0.1 200)',
            neutral: 'oklch(27% 0.02 256)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(23% 0.02 256)', 'oklch(19% 0.02 256)', 'oklch(15% 0.02 256)', 'oklch(96% 0.005 248)'],
        roles: {
            primary: 'oklch(74% 0.11 254)',
            secondary: 'oklch(78% 0.03 252)',
            accent: 'oklch(74% 0.1 196)',
            neutral: 'oklch(32% 0.02 256)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "off-hero": "https://images.unsplash.com/photo-1587293852726-70cdb56c2866?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWlzbGVzJTIwb2ZmaWNlLXN1cHBsaWVzJTIwZGlzdHJpYnV0aW9uJTIwd2FyZWhvdXNlJTIwc3RhY2tlZCUyMGNhcnRvbnN8ZW58MHwwfHx8MTc4NjQyMjAzNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "off-tile-paper": "https://images.unsplash.com/photo-1549030927-006822377380?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FydG9ucyUyMGNvcGllciUyMHBhcGVyJTIwc3RhY2tlZCUyMHRvbmVyJTIwYm94ZXMlMjBzaGVsZnxlbnwwfDB8fHwxNzg2NDIyMDM4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "off-tile-writing": "https://images.unsplash.com/photo-1613349743213-3368c14ab1d2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94ZXMlMjBwZW5zJTIwbWFya2Vyc3xlbnwwfDB8fHwxNzg2NDIyMzI4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "off-tile-furniture": "https://images.unsplash.com/photo-1681418659069-eef28d44aeab?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXJnb25vbWljJTIwdGFzayUyMGNoYWlycyUyMGRyeS1lcmFzZSUyMHdoaXRlYm9hcmQlMjBmaXQtb3V0JTIwYmF5fGVufDB8MHx8fDE3ODY0MjIwNDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "off-band-trade": "https://images.unsplash.com/photo-1576669801820-a9ab287ac2d1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FyZWhvdXNlJTIwd29ya2VyJTIwc2Nhbm5pbmclMjBjYXJ0b25zJTIwb250byUyMHBhbGxldCUyMGRpc3BhdGNofGVufDB8MHx8fDE3ODY0MjIwNTB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-paper": "https://images.unsplash.com/photo-1715522594847-67c90b5b8667?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FydG9uJTIwZml2ZSUyMHJlYW1zJTIwY29waWVyJTIwcGFwZXJ8ZW58MHwwfHx8MTc4NjQyMjA1M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-pens": "https://images.unsplash.com/photo-1699778414283-75669dd26271?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwZmlmdHklMjByZXRyYWN0YWJsZSUyMGJhbGxwb2ludCUyMHBlbnN8ZW58MHwwfHx8MTc4NjQyMjA1Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-toner": "https://images.unsplash.com/photo-1698376621013-c22a62d865b7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94JTIwbGFzZXIlMjB0b25lciUyMGNhcnRyaWRnZXN8ZW58MHwwfHx8MTc4NjQyMjA2Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-organiser": "https://images.unsplash.com/photo-1700451761309-656bd9439443?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGRlc2slMjBvcmdhbmlzZXIlMjBzZXRzfGVufDB8MHx8fDE3ODY0MjIwNjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-chair": "https://images.unsplash.com/photo-1683836809851-9e3aad661ffd?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Ym94ZWQlMjBlcmdvbm9taWMlMjBtZXNoJTIwdGFzayUyMGNoYWlyfGVufDB8MHx8fDE3ODY0MjIwNjh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-whiteboard": "https://images.unsplash.com/photo-1676276374803-36e48196d5ac?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGRyeS1lcmFzZSUyMHdoaXRlYm9hcmRzfGVufDB8MHx8fDE3ODY0MjIwNzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-wipes": "https://images.unsplash.com/photo-1617113547506-fea147807b81?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FzZSUyMGRpc2luZmVjdGluZyUyMHdpcGUlMjBjYW5pc3RlcnN8ZW58MHwwfHx8MTc4NjQyMjA3NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-breakroom": "https://images.unsplash.com/photo-1683000219035-1071ebffb6c8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJlYWtyb29tJTIwcmVzdG9jayUyMGNhc2V8ZW58MHwwfHx8MTc4NjQyMjMzNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-supply-closet": "https://images.unsplash.com/photo-1572521165329-b197f9ea3da6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGlkeSUyMGxhYmVsbGVkJTIwb2ZmaWNlfGVufDB8MHx8fDE3ODY0MjIzNDF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-ergonomics": "https://images.unsplash.com/photo-1688578735972-b61ec274df7b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGVyc29uJTIwc2VhdGVkJTIwd2VsbC1zZXQtdXAlMjBlcmdvbm9taWMlMjBkZXNrfGVufDB8MHx8fDE3ODY0MjIwODV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'off-hero', url: src('off-hero'), alt: 'Aisles of an office-supplies distribution warehouse stacked with cartons' },
    { id: 'off-tile-paper', url: src('off-tile-paper'), alt: 'Cartons of copier paper and stacked toner boxes on a shelf' },
    { id: 'off-tile-writing', url: src('off-tile-writing'), alt: 'Boxes of pens, markers and wirebound notebooks' },
    { id: 'off-tile-furniture', url: src('off-tile-furniture'), alt: 'Ergonomic task chairs and a dry-erase whiteboard in a fit-out bay' },
    { id: 'off-tile-breakroom', url: src('off-tile-breakroom'), alt: 'A stocked breakroom shelf of coffee, cups and cleaning supplies' },
    { id: 'off-band-trade', url: src('off-band-trade'), alt: 'A warehouse worker scanning cartons onto a pallet for dispatch' },
    { id: 'prod-paper', url: src('prod-paper'), alt: 'A carton of five reams of copier paper' },
    { id: 'prod-pens', url: src('prod-pens'), alt: 'A box of fifty retractable ballpoint pens' },
    { id: 'prod-notebooks', url: src('prod-notebooks'), alt: 'A case of wirebound notebooks' },
    { id: 'prod-toner', url: src('prod-toner'), alt: 'A box of laser toner cartridges' },
    { id: 'prod-organiser', url: src('prod-organiser'), alt: 'A case of desk organiser sets' },
    { id: 'prod-chair', url: src('prod-chair'), alt: 'A boxed ergonomic mesh task chair' },
    { id: 'prod-whiteboard', url: src('prod-whiteboard'), alt: 'A case of dry-erase whiteboards' },
    { id: 'prod-wipes', url: src('prod-wipes'), alt: 'A case of disinfecting wipe canisters' },
    { id: 'prod-breakroom', url: src('prod-breakroom'), alt: 'A breakroom restock case of coffee, cups and supplies' },
    { id: 'prod-starter-kit', url: src('prod-starter-kit'), alt: 'An office starter bundle of essential supplies' },
    { id: 'post-supply-closet', url: src('post-supply-closet'), alt: 'A tidy, labelled office supply closet' },
    { id: 'post-ergonomics', url: src('post-ergonomics'), alt: 'A person seated at a well-set-up ergonomic desk' },
    { id: 'post-restock', url: src('post-restock'), alt: 'Hands restocking a breakroom shelf from a supply case' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-b2b-office-supply: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warehouse photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a trade-account link. The link
 *  carries the "Open a trade account" call the platform navbar CTA also points at (/contact).
 *  Never ink on the photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('off-hero'), alt: 'An office-supplies distribution warehouse', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Everything the office runs on, one account, one invoice.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Worksmith is a workplace-supplies distributor. We stock the paper, ink, pens, furniture and breakroom lines every office burns through — sold by the box and the case, priced for the trade, and dispatched next day.',
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
                        text: 'Shop by department',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'off-tile-paper', label: 'Paper & ink', href: '/shop', alt: 'Cartons of copier paper and toner' }),
                            categoryTile({ assetId: 'off-tile-writing', label: 'Writing', href: '/shop', alt: 'Boxes of pens and notebooks' }),
                            categoryTile({ assetId: 'off-tile-furniture', label: 'Furniture', href: '/shop', alt: 'Task chairs and a whiteboard' }),
                            categoryTile({ assetId: 'off-tile-breakroom', label: 'Breakroom', href: '/shop', alt: 'A stocked breakroom shelf' }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** The trade-terms band — pure COPY, no photo. Four cards spell out how wholesale ordering
 *  works here: per-box trade pricing with volume breaks, net-30 for approved accounts, next-day
 *  delivery, and a named account manager. The tenant configures the real B2B pricing tiers,
 *  approval rules and terms in the Commerce module; this band SELLS the arrangement. */
function tradeTermsBand(): Node {
    const card = (title: string, body: string): Node =>
        el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
            children: [
                el('h3', 'text-lg font-bold tracking-tight text-base-content', { text: title }),
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
                                text: 'Built for the way offices buy',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'Open a trade account and you order the way a business should — by the box and the case, at wholesale rates, on terms. One catalog for the whole office, no consumer markups, no runaround.',
                            }),
                        ],
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            card('Trade pricing', 'Per-box wholesale rates with volume breaks that deepen as the order grows. Kit out one desk or forty — the more you buy, the less each box costs.'),
                            card('Net-30 terms', 'Approved accounts order now and pay later on net-30, so a supply run never ties up the company card or waits on an expense report.'),
                            card('Next-day delivery', 'In-stock lines ship the same or next business day and land on the desk, not a loading dock — so nobody is rationing the last ream by Thursday.'),
                            card('Your account manager', 'A direct line to a real person who knows your office, your standing order and what you go through — not a ticket queue and a hold tone.'),
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
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Best sellers every office reorders' }),
    tradeTermsBand(),
    productsBlock({ source: 'commerce.category.breakroom', layout: 'carousel', heading: 'Keep the breakroom stocked' }),
    editorialBand({
        heading: 'One supplier for the whole office',
        lead: 'Pull the scattered orders your team places across a dozen sites and a dozen websites into one trade account. One catalog to buy from, one statement to reconcile, and one person who picks up the phone when a line runs short.',
        assetId: 'off-band-trade',
        cta: 'Open a trade account',
        href: '/contact',
        alt: 'A worker scanning cartons onto a pallet for dispatch',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (vendor label, title, per-box price,
 *  low-stock, description, pack options + add-to-cart, a static "Trade pricing & terms" note
 *  with volume breaks + net-30, and policy links). */
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
                                        text: 'Worksmith Supply Co.',
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
                            el('div', 'flex flex-col gap-3 rounded-box border border-base-300 bg-base-200 p-5', {
                                children: [
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Trade pricing & terms' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'The price shown is the per-box list rate. Trade accounts unlock volume breaks — deeper per-box pricing by the case, the pallet, or a standing order — set for your account in your dashboard.',
                                    }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Approved accounts buy on net-30. Not set up yet? Open a trade account and we will price your regular lines and get you on terms.',
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
        'The catalog',
        'Every line we stock — paper & ink, writing, furniture, and breakroom supplies, sold by the box and the case. Filter by department or sort by price; trade accounts see their contract pricing at checkout.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead('Collections', 'The catalog grouped the way an office manager actually buys — best sellers, new lines just in, the everyday workspace essentials, a furniture fit-out, the breakroom restock, and a kit to set up a new desk from empty.'),
];
const SEARCH: Node[] = [
    pageMasthead('Search the catalog', 'Know the SKU, the size, or the line you reorder? Search the whole catalog and the guides below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Review the boxes and cases in your order before you check out. Trade accounts see contract pricing and net-30 terms applied here; everyone gets next-day delivery on in-stock lines. Need a formal quote for procurement instead? Your account manager can turn one around.',
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
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The supply room' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Practical guidance for whoever keeps the office running — how to stock a supply closet, set up a desk that does not wreck a back, and keep the breakroom from running dry. Written for the person doing the ordering.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Worksmith' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Worksmith Supply Co. is a workplace-supplies distributor. We stock the everyday, essential lines that keep an office, a clinic or a job site running — paper and ink, pens and pads, furniture and breakroom supplies — and we sell them to the trade by the box and the case, at wholesale, on terms.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We built the business around one idea: whoever keeps an office stocked should not have to juggle a dozen consumer accounts, eat retail markups, or wait a week for a carton of paper. One catalog, one account, one invoice, and stock that is actually on the shelf when you order it.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'No membership hoops, no mystery lead times, no pricing that changes because you asked. Just the supplies, priced fairly and on the desk next day — the quiet reliability an office is built on.',
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
        intro: 'Tell us what your office goes through and we will price your regular lines, set you up on net-30 terms, and put a name and a number to your account. Wholesale enquiries, standing orders and bulk quotes for procurement all start here.',
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

const VENDOR = 'Worksmith Supply Co.';

/** A single-SKU box/case line — one price, no options (most consumables ship one pack size). */
const caseItem = (opts: {
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
        handle: 'copier-paper-carton',
        title: 'Copier Paper — Carton of 5 Reams',
        description:
            'Bright 20 lb, 92-bright multipurpose paper that runs clean through copiers, laser and inkjet without jamming or curling. A carton is 5 reams — 2,500 sheets. MOQ 1 carton. Pick the sheet size your machines take.',
        status: 'active',
        productType: 'Paper',
        vendor: VENDOR,
        tags: ['paper', 'copier-paper', 'consumable', 'bulk'],
        categoryHandles: ['paper-ink'],
        collectionHandles: ['best-sellers', 'workspace-essentials', 'keep-it-stocked'],
        seoTitle: 'Copier Paper, Carton of 5 Reams | Worksmith Supply',
        seoDescription: 'Bright 20 lb 92-bright multipurpose copier paper, carton of 5 reams (2,500 sheets). Letter, Legal or A4.',
        options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: 'Letter' }, { value: 'Legal' }, { value: 'A4' }] }],
        variants: [
            { sku: 'WSS-PPR-COPY-LTR', priceCents: money(42), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Letter' } },
            { sku: 'WSS-PPR-COPY-LGL', priceCents: money(49), inventoryPolicy: 'continue', optionValues: { Size: 'Legal' } },
            { sku: 'WSS-PPR-COPY-A4', priceCents: money(46), inventoryPolicy: 'continue', optionValues: { Size: 'A4' } },
        ],
        images: [{ assetId: 'prod-paper', isPrimary: true, alt: 'A carton of five reams of copier paper' }],
    },
    {
        handle: 'ballpoint-pens-box',
        title: 'Retractable Ballpoint Pens — Box of 50',
        description:
            'Smooth 1.0 mm medium-point retractable ballpoints with a cushioned grip and a click that survives a year of meetings. A box is 50 pens. MOQ 2 boxes — enough to stock the supply drawer and the ones that walk off. Pick your ink.',
        status: 'active',
        productType: 'Writing',
        vendor: VENDOR,
        tags: ['writing', 'pens', 'ballpoint', 'consumable'],
        categoryHandles: ['writing'],
        collectionHandles: ['best-sellers', 'workspace-essentials'],
        seoTitle: 'Retractable Ballpoint Pens, Box of 50 | Worksmith Supply',
        seoDescription: 'Smooth 1.0 mm medium-point retractable ballpoint pens with a cushioned grip, box of 50. Black, blue or assorted.',
        options: [{ name: 'Ink', displayType: 'dropdown', values: [{ value: 'Black' }, { value: 'Blue' }, { value: 'Assorted' }] }],
        variants: [
            { sku: 'WSS-WRT-PEN-BLK', priceCents: money(18), isDefault: true, inventoryPolicy: 'continue', optionValues: { Ink: 'Black' } },
            { sku: 'WSS-WRT-PEN-BLU', priceCents: money(18), inventoryPolicy: 'continue', optionValues: { Ink: 'Blue' } },
            { sku: 'WSS-WRT-PEN-AST', priceCents: money(20), inventoryPolicy: 'continue', optionValues: { Ink: 'Assorted' } },
        ],
        images: [{ assetId: 'prod-pens', isPrimary: true, alt: 'A box of fifty retractable ballpoint pens' }],
    },
    caseItem({
        handle: 'wirebound-notebooks-case',
        title: 'Wirebound Notebooks — Case of 24',
        description:
            'College-ruled wirebound notebooks, 70 sheets of 20 lb paper that does not bleed through, with a poly cover that survives a bag. A case is 24 books. MOQ 1 case. The pad every desk, meeting room and new hire goes through.',
        price: 46,
        sku: 'WSS-WRT-NBK-24',
        productType: 'Writing',
        categories: ['writing'],
        collections: ['workspace-essentials', 'new-in'],
        tags: ['writing', 'notebooks', 'paper', 'consumable'],
        asset: 'prod-notebooks',
        seoTitle: 'Wirebound Notebooks, Case of 24 | Worksmith Supply',
        seoDescription: 'College-ruled wirebound notebooks, 70 sheets, poly cover, case of 24. The everyday pad for any office.',
    }),
    {
        handle: 'laser-toner-box',
        title: 'Laser Toner Cartridges — Box of 2',
        description:
            'High-quality compatible black laser toner that drops straight into the workhorse mono printers most offices run, at a fraction of the branded-cartridge price. A box is 2 cartridges. MOQ 1 box. Pick standard or high-yield for the heavy printers.',
        status: 'active',
        productType: 'Ink & toner',
        vendor: VENDOR,
        tags: ['toner', 'ink', 'printing', 'consumable'],
        categoryHandles: ['paper-ink'],
        collectionHandles: ['best-sellers', 'keep-it-stocked'],
        seoTitle: 'Laser Toner Cartridges, Box of 2 | Worksmith Supply',
        seoDescription: 'Compatible black laser toner cartridges, box of 2, standard or high-yield. Fits the workhorse mono office printers.',
        options: [{ name: 'Yield', displayType: 'dropdown', values: [{ value: 'Standard' }, { value: 'High-yield' }] }],
        variants: [
            { sku: 'WSS-INK-TONER-STD', priceCents: money(64), isDefault: true, inventoryPolicy: 'continue', optionValues: { Yield: 'Standard' } },
            { sku: 'WSS-INK-TONER-HY', priceCents: money(98), inventoryPolicy: 'continue', optionValues: { Yield: 'High-yield' } },
        ],
        images: [{ assetId: 'prod-toner', isPrimary: true, alt: 'A box of laser toner cartridges' }],
    },
    caseItem({
        handle: 'desk-organiser-case',
        title: 'Desk Organiser Sets — Case of 6',
        description:
            'A five-piece steel-mesh desk set — pen cup, letter tray, sorter, memo holder and clip caddy — that turns a cluttered desk into one someone can actually work at. A case is 6 sets. MOQ 1 case. Ideal for a new-hire fit-out or a whole-floor refresh.',
        price: 84,
        sku: 'WSS-FUR-ORG-6',
        productType: 'Furniture',
        categories: ['furniture'],
        collections: ['workspace-essentials', 'furniture-fitout'],
        tags: ['furniture', 'desk', 'organiser', 'accessories'],
        asset: 'prod-organiser',
        seoTitle: 'Desk Organiser Sets, Case of 6 | Worksmith Supply',
        seoDescription: 'Five-piece steel-mesh desk organiser sets, case of 6. Pen cup, trays, sorter and caddy for a tidy desk.',
    }),
    {
        handle: 'ergonomic-task-chair',
        title: 'Ergonomic Mesh Task Chair — Carton of 1',
        description:
            'A breathable mesh-back task chair with adjustable lumbar, seat height and armrests — the chair a team can sit in for eight hours without a physio bill. Ships one to a carton, assembled in minutes. MOQ 4 chairs — enough to fit out a room. Pick the frame color.',
        status: 'active',
        productType: 'Furniture',
        vendor: VENDOR,
        tags: ['furniture', 'chair', 'ergonomic', 'seating'],
        categoryHandles: ['furniture'],
        collectionHandles: ['furniture-fitout', 'new-in'],
        seoTitle: 'Ergonomic Mesh Task Chair | Worksmith Supply',
        seoDescription: 'A breathable mesh-back ergonomic task chair with adjustable lumbar, height and arms. Sold by the carton, MOQ 4.',
        options: [{ name: 'Color', displayType: 'dropdown', values: [{ value: 'Black' }, { value: 'Grey' }] }],
        variants: [
            { sku: 'WSS-FUR-CHAIR-BLK', priceCents: money(139), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Black' } },
            { sku: 'WSS-FUR-CHAIR-GRY', priceCents: money(139), inventoryPolicy: 'continue', optionValues: { Color: 'Grey' } },
        ],
        images: [{ assetId: 'prod-chair', isPrimary: true, alt: 'A boxed ergonomic mesh task chair' }],
    },
    {
        handle: 'dry-erase-whiteboards-case',
        title: 'Dry-Erase Whiteboards — Case of 2',
        description:
            'Magnetic dry-erase boards with an aluminium frame and a marker tray, wiping clean with no ghosting after months of stand-ups. A case is 2 boards. MOQ 1 case. Pick the size that fits the wall — a huddle room or a whole planning wall.',
        status: 'active',
        productType: 'Furniture',
        vendor: VENDOR,
        tags: ['furniture', 'whiteboard', 'dry-erase', 'meeting-room'],
        categoryHandles: ['furniture'],
        collectionHandles: ['furniture-fitout'],
        seoTitle: 'Dry-Erase Whiteboards, Case of 2 | Worksmith Supply',
        seoDescription: 'Magnetic dry-erase whiteboards with aluminium frame and marker tray, case of 2. 3x2 ft or 4x3 ft.',
        options: [{ name: 'Size', displayType: 'dropdown', values: [{ value: '3 x 2 ft' }, { value: '4 x 3 ft' }] }],
        variants: [
            { sku: 'WSS-FUR-WB-32', priceCents: money(78), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: '3 x 2 ft' } },
            { sku: 'WSS-FUR-WB-43', priceCents: money(112), inventoryPolicy: 'continue', optionValues: { Size: '4 x 3 ft' } },
        ],
        images: [{ assetId: 'prod-whiteboard', isPrimary: true, alt: 'A case of dry-erase whiteboards' }],
    },
    caseItem({
        handle: 'disinfecting-wipes-case',
        title: 'Disinfecting Wipes — Case of 12',
        description:
            'Alcohol-free disinfecting wipes that clean desks, keyboards, phones and door handles without leaving a film — 75 wipes a canister, a case of 12. MOQ 2 cases. The line a shared office burns through fastest, and the one you never want to run short of.',
        price: 54,
        sku: 'WSS-BRK-WIPES-12',
        productType: 'Breakroom & cleaning',
        categories: ['breakroom'],
        collections: ['keep-it-stocked', 'best-sellers'],
        tags: ['breakroom', 'cleaning', 'wipes', 'consumable'],
        asset: 'prod-wipes',
        seoTitle: 'Disinfecting Wipes, Case of 12 | Worksmith Supply',
        seoDescription: 'Alcohol-free disinfecting wipes, 75 per canister, case of 12. Cleans desks, keyboards and shared surfaces.',
    }),
    caseItem({
        handle: 'breakroom-restock-case',
        title: 'Breakroom Restock Case',
        description:
            'The breakroom staples in one carton — a tin of ground coffee, a sleeve of paper cups, stir sticks, sugar, creamer and napkins — enough to keep a small team caffeinated and fed for a month. MOQ 1 case. Put it on a standing order and the breakroom never runs dry.',
        price: 68,
        sku: 'WSS-BRK-RESTOCK',
        productType: 'Breakroom & cleaning',
        categories: ['breakroom'],
        collections: ['keep-it-stocked', 'new-in'],
        tags: ['breakroom', 'coffee', 'supplies', 'consumable'],
        asset: 'prod-breakroom',
        seoTitle: 'Breakroom Restock Case | Worksmith Supply',
        seoDescription: 'A breakroom restock carton — coffee, cups, stir sticks, sugar, creamer and napkins. One month for a small team.',
    }),
    caseItem({
        handle: 'office-starter-bundle',
        title: 'Office Starter Bundle',
        description:
            'Everything a new office or satellite desk runs out of first — a carton of copier paper, a box of pens, a case of notebooks, a desk organiser set and a case of disinfecting wipes, packed together and priced below the sum of its boxes. MOQ 1 bundle. The fastest way to stock a workspace from empty.',
        price: 179,
        sku: 'WSS-KIT-STARTER',
        productType: 'Bundle',
        categories: ['paper-ink'],
        collections: ['new-office-setup', 'workspace-essentials'],
        tags: ['bundle', 'starter', 'office-setup', 'kit'],
        asset: 'prod-starter-kit',
        seoTitle: 'Office Starter Bundle | Worksmith Supply',
        seoDescription: 'A curated starter bundle — paper, pens, notebooks, a desk organiser and wipes, priced below the sum of its boxes.',
    }),
];

const COMMERCE = {
    categories: [
        { handle: 'paper-ink', name: 'Paper & ink', description: 'Copier paper, toner and printing supplies.', featured: true },
        { handle: 'writing', name: 'Writing', description: 'Pens, notebooks and desk stationery.', featured: true },
        { handle: 'furniture', name: 'Furniture', description: 'Chairs, whiteboards and desk organisers.', featured: true },
        { handle: 'breakroom', name: 'Breakroom', description: 'Coffee, cleaning and breakroom supplies.', featured: true },
    ],
    collections: [
        {
            handle: 'best-sellers',
            name: 'Best sellers',
            description: 'The lines every office reorders.',
            type: 'manual',
            featured: true,
            productHandles: ['copier-paper-carton', 'ballpoint-pens-box', 'laser-toner-box', 'disinfecting-wipes-case'],
        },
        {
            handle: 'new-in',
            name: 'New in',
            description: 'Lines just added to the catalog.',
            type: 'manual',
            featured: true,
            productHandles: ['wirebound-notebooks-case', 'ergonomic-task-chair', 'breakroom-restock-case'],
        },
        {
            handle: 'workspace-essentials',
            name: 'Workspace essentials',
            description: 'The everyday supplies no desk runs without.',
            type: 'manual',
            featured: false,
            productHandles: ['copier-paper-carton', 'ballpoint-pens-box', 'wirebound-notebooks-case', 'desk-organiser-case', 'office-starter-bundle'],
        },
        {
            handle: 'furniture-fitout',
            name: 'Furniture fit-out',
            description: 'Kit out a room or a whole floor.',
            type: 'manual',
            featured: false,
            productHandles: ['ergonomic-task-chair', 'dry-erase-whiteboards-case', 'desk-organiser-case'],
        },
        {
            handle: 'keep-it-stocked',
            name: 'Keep it stocked',
            description: 'Buy the case, reorder on a schedule.',
            type: 'manual',
            featured: false,
            productHandles: ['copier-paper-carton', 'laser-toner-box', 'disinfecting-wipes-case', 'breakroom-restock-case'],
        },
        {
            handle: 'new-office-setup',
            name: 'New office setup',
            description: 'Stock a new workspace from empty.',
            type: 'manual',
            featured: false,
            productHandles: ['office-starter-bundle', 'copier-paper-carton', 'ergonomic-task-chair', 'desk-organiser-case'],
        },
    ],
    products: PRODUCTS,
};

// ── Content (the supply room) ────────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'stock-a-supply-closet',
        status: 'published',
        body: {
            title: 'How to stock a supply closet that never runs dry',
            excerpt: 'A run to the shop for a ream of paper costs an hour nobody has. Here is a simple min/max system any office can run so the box is on the shelf before the last one is empty.',
            featuredImage: { $asset: 'post-supply-closet' },
            body: {
                type: 'doc',
                content: [
                    para('A supply closet exists to do one thing: make sure the paper, the pens and the toner are there the moment someone needs them. Get it wrong and a two-dollar cartridge holds up a proposal that is due at five. The good news is that keeping it right does not take software or a full-time office manager — it takes a min/max system and the discipline to follow it.'),
                    h2('Set a min and a max for every line'),
                    para('For each supply, decide two numbers. The MIN is the reorder point — the quantity that should trigger a new order, set high enough to cover your usage over the delivery lead time so you never hit zero while a case is in transit. The MAX is how much you hold when full — enough to buy at a sensible case price without turning the shelf into dead stock. When a line drops to its min, you order back up to the max. That is the whole system.'),
                    h2('Label the shelf, not your memory'),
                    para('Write the line, the size and the min/max on the shelf edge itself. When anyone can see at a glance that the copier paper is below its min, ordering stops depending on one person remembering. A two-bin trick makes it simpler still: when the front box empties, that is the signal to reorder, and the back box covers you until the carton arrives.'),
                    h2('Put the fast movers on a standing order'),
                    para('The lines you burn through on a predictable schedule — paper, pens, wipes, coffee — do not need re-deciding every month. Put them on a standing order with your supplier and they arrive before you run out, priced for the volume. Reserve your attention for the exceptions, and let the boring reliable lines take care of themselves.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'set-up-an-ergonomic-desk',
        status: 'published',
        body: {
            title: 'Set up a desk that does not wreck a back',
            excerpt: 'Most office aches trace back to a chair set wrong and a monitor too low. Here is how to set up a workstation people can sit at all day — and what to buy so they can.',
            featuredImage: { $asset: 'post-ergonomics' },
            body: {
                type: 'doc',
                content: [
                    para('The cheapest sick day is the one nobody takes. A workstation set up badly — chair too low, screen too far, wrists bent up at the keyboard — quietly builds the aches that turn into physio appointments and lost afternoons. Getting it right is not expensive or complicated; it is a chair that adjusts and five minutes to set it.'),
                    h2('Start with the chair'),
                    para('Set the seat height so feet rest flat on the floor and knees sit level with the hips. Adjust the lumbar support into the small of the back, and set the armrests so shoulders can relax and elbows bend at about ninety degrees. A chair that cannot do those things is not saving you money — it is deferring a cost onto the person sitting in it. A mesh task chair with real adjustments is the single best supply an office buys.'),
                    h2('Then the screen and the input'),
                    para('Raise the monitor so the top of the screen is at or just below eye level and about an arm’s length away — that stops the head-forward slump that wrecks necks. Keep the keyboard and mouse close enough that wrists stay flat, not cocked up. A monitor riser and a keyboard tray cost little and do more for comfort than almost anything else on the desk.'),
                    h2('Buy it once, for everyone'),
                    para('Ergonomics falls apart when it is done one exception at a time. Spec a good task chair and a riser as the standard desk kit, buy them by the carton at trade pricing, and every new hire gets a workstation that works from day one — instead of a folding chair and a promise to sort it out later.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'keep-the-breakroom-stocked',
        status: 'published',
        body: {
            title: 'Keep the breakroom stocked without thinking about it',
            excerpt: 'An empty coffee tin at 9am is a small thing that sours a whole morning. Here is how to keep the breakroom running on autopilot — and why it is worth the small spend.',
            featuredImage: { $asset: 'post-restock' },
            body: {
                type: 'doc',
                content: [
                    para('The breakroom is the one supply nobody puts on the budget and everybody notices when it is empty. A missing coffee filter or the last cup gone by mid-morning is trivial on paper and genuinely deflating in practice — it is the little signal that says nobody is looking after the place. Keeping it stocked is cheap insurance against a soured morning.'),
                    h2('Bundle the staples, buy the case'),
                    para('Coffee, cups, stir sticks, sugar, creamer and napkins move together and run out together, so buy them together. A restock case covers a small team for about a month, and buying the case beats grabbing packets from the corner shop at retail — both on price and on the hour you get back from not doing supply runs.'),
                    h2('Put it on a standing order'),
                    para('The whole point of a breakroom is that no one should have to manage it. Set a standing order for a restock case on a monthly cadence and it simply arrives — no reminder, no run, no empty tin. Adjust the frequency once you see how fast a team actually gets through it, and then forget about it.'),
                    h2('It is not a perk, it is friction removed'),
                    para('A stocked breakroom is not about pampering anyone. It is about removing a dozen tiny frictions from the day — the hunt for a clean cup, the cold coffee, the trip out for milk — that each cost a few minutes and a little goodwill. Keep it full for the price of a case a month, and the whole office runs a touch smoother.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'b2b-office-supply',
    key: 'sparx-b2b-office-supply',
    name: 'Office Supply (B2B / Wholesale)',
    theme: THEME,
    summary:
        'A complete, working wholesale shop for a workplace-supplies distributor: a real trade catalogue sold by the box and case — paper & ink, writing, furniture and breakroom supplies — with categories, collections, a bespoke trade PDP (per-box pricing, volume breaks, net-30), and a full merchandised home page. Clean corporate theme — cool slate ground, confident blue, teal accent. Shipped as Worksmith Supply Co.',
    tagline: 'A wholesale storefront built for trade buyers.',
    vertical: 'b2b',
    industry: 'Office & workplace supplies',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 85,
    brand: {
        businessName: 'Worksmith Supply Co.',
        tagline: 'Everything the office runs on, one account, one invoice.',
    },
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Worksmith Supply Co. — office & workplace supplies distributor',
            description:
                'Worksmith is a workplace-supplies distributor — paper, ink, pens, notebooks, furniture and breakroom supplies sold by the box and case at trade prices, with net-30 terms and next-day delivery. Open a trade account.',
        },
        about: {
            title: 'About Worksmith Supply Co.',
            description:
                'How Worksmith stocks, prices and ships — one catalog, one account, one invoice, wholesale by the box, and stock that is actually on the shelf when you order it.',
        },
        contact: {
            title: 'Open a trade account — Worksmith Supply Co.',
            description:
                'Set up a trade account with Worksmith: wholesale per-box pricing, volume breaks, net-30 terms and a dedicated account manager. Wholesale enquiries and bulk quotes start here.',
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
