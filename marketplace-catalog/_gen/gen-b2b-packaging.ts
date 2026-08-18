// sparx-b2b-packaging — a B2B / WHOLESALE commerce site template: a packaging & shipping
// supplies distributor for e-commerce sellers and warehouses.
//
// The trade-buyer analog of the retail gold reference (gen-retail-coffee-craft.ts): the same
// harness, the same 9-page commerce site (home merchandising → shop → collections → cart →
// search → journal → about → contact → PDP), the same INLINE bespoke theme — but framed for
// people who buy by the case, the bundle and the pallet, not the single unit. A complete,
// working wholesale shop the moment it installs: a real catalogue priced by the case with pack
// quantities and MOQs, categories + collections, a bespoke trade PDP with bulk-break pricing,
// and a home page that sells the ACCOUNT (bulk tiers, next-day dispatch, net-30, custom print,
// a named account manager). Shipped as Boxwell Supply.
//
// SELF-CONTAINED BY DESIGN (see the retail gold reference header): the theme lives inline and
// is passed on the spec (`theme`), so the whole B2B family can be authored in parallel with no
// two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present, and — because the
// vertical is a COMMERCE one (`b2b`, not `content`) — auto-adds the two marketing-email starters
// (welcome + win-back), so this file authors NO emails.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-packaging.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-packaging/**" \
//     "marketplace-catalog/_gen/gen-b2b-packaging.ts"
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
// Kraft-industrial: a warm kraft/tan paper ground (a mid ground, genuinely muted — it reads
// as corrugated board, not white), a DEEP warehouse-blue primary that stays legible as ink on
// the light page, a slate-grey secondary, and a burnt safety-orange accent for the signal
// links. Two clean grotesks (Archivo display over IBM Plex Sans), square corners, zero depth —
// spec-forward and dependable. Complete light + dark, AA on every role (the blueprint sweep's
// contrast check is the gate). Every role used as TEXT on the light ground sits ≤ ~52% L.
const THEME = defineTheme({
    name: 'crate-trade',
    type: { body: face('IBM Plex Sans', 'sans-serif'), head: face('Archivo', 'sans-serif') },
    shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', border: '1px', depth: '0' },
    light: {
        surfaces: ['oklch(93% 0.028 78)', 'oklch(90% 0.036 75)', 'oklch(85% 0.044 72)', 'oklch(24% 0.03 60)'],
        roles: {
            primary: 'oklch(38% 0.11 248)',
            secondary: 'oklch(40% 0.03 250)',
            accent: 'oklch(51% 0.17 45)',
            neutral: 'oklch(27% 0.02 60)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(21% 0.018 60)', 'oklch(18% 0.018 60)', 'oklch(15% 0.018 60)', 'oklch(93% 0.024 78)'],
        roles: {
            primary: 'oklch(74% 0.12 248)',
            secondary: 'oklch(74% 0.03 250)',
            accent: 'oklch(72% 0.15 45)',
            neutral: 'oklch(31% 0.02 60)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "pkg-hero": "https://images.unsplash.com/photo-1777793919351-0fef3f41f7af?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2tlZCUyMHBhbGxldHMlMjBjb3JydWdhdGVkJTIwc2hpcHBpbmclMjBjYXJ0b25zJTIwZGlzdHJpYnV0aW9uJTIwd2FyZWhvdXNlfGVufDB8MHx8fDE3ODY0MTMzMzZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-tile-boxes": "https://images.unsplash.com/photo-1656543802898-41c8c46683a7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxhdC1wYWNrZWQlMjBjb3JydWdhdGVkJTIwc2hpcHBpbmclMjBib3hlcyUyMGJ1bmRsZWQlMjBiYW5kZWR8ZW58MHwwfHx8MTc4NjQxMzMzOXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-tile-mailers": "https://images.unsplash.com/photo-1617912760188-9ef603157f1e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8Y2FzZSUyMHBvbHklMjBtYWlsZXJzJTIwcmVhZHklMjBwYWNraW5nJTIwYmVuY2h8ZW58MHwwfHx8MTc4NjQxMzM0Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-tile-tape": "https://images.unsplash.com/photo-1644079446600-219068676743?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbHMlMjBwYWNraW5nJTIwdGFwZSUyMHZvaWQtZmlsbCUyMHdhcmVob3VzZSUyMHNoZWxmfGVufDB8MHx8fDE3ODY0MTMzNDV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-tile-labels": "https://images.unsplash.com/photo-1662001164155-2d04179a7b22?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbCUyMGJsYW5rJTIwdGhlcm1hbCUyMHNoaXBwaW5nJTIwbGFiZWxzJTIwYmVzaWRlJTIwbGFiZWx8ZW58MHwwfHx8MTc4NjQxMzM0OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-band-dispatch": "https://images.unsplash.com/photo-1765192775044-82835d86f56b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwbG9hZGluZyUyMGJhbmRlZCUyMGNhcnRvbnMlMjBvbnRvJTIwbmV4dC1kYXklMjBkaXNwYXRjaHxlbnwwfDB8fHwxNzg2NDEzMzUxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-prod-boxes": "https://images.unsplash.com/photo-1573376670774-4427757f7963?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8YnVuZGxlJTIwZmxhdCUyMGNvcnJ1Z2F0ZWQlMjBzaGlwcGluZyUyMGJveGVzfGVufDB8MHx8fDE3ODY0MTMzNTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-prod-tape": "https://images.unsplash.com/photo-1760376208573-49ee415fc66c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Y2FzZSUyMGNsZWFyJTIwcGFja2luZy10YXBlJTIwcm9sbHN8ZW58MHwwfHx8MTc4NjQxMzM2MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-prod-bubble": "https://images.unsplash.com/photo-1617777637088-7ec2e450169e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGFyZ2UlMjByb2xsJTIwc21hbGwtYnViYmxlfGVufDB8MHx8fDE3ODY0MTM2Mzl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-prod-voidfill": "https://images.unsplash.com/photo-1575833948662-cc99178abbb8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbCUyMGtyYWZ0JTIwdm9pZC1maWxsJTIwcGFwZXIlMjBkaXNwZW5zZXJ8ZW58MHwwfHx8MTc4NjQxMzM2Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-prod-kraft": "https://images.unsplash.com/photo-1755606159507-a98b20d06578?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhY2slMjBwYWRkZWQlMjBrcmFmdCUyMGJ1YmJsZSUyMG1haWxlcnN8ZW58MHwwfHx8MTc4NjQxMzM2OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-prod-labels": "https://images.unsplash.com/photo-1617912760717-06f3976cf18c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8cGFjayUyMHRoZXJtYWwlMjBzaGlwcGluZy1sYWJlbCUyMHJvbGxzfGVufDB8MHx8fDE3ODY0MTMzNzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-prod-stretch": "https://images.unsplash.com/photo-1735875827366-1525e2de355d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm9sbCUyMGNsZWFyJTIwcGFsbGV0JTIwc3RyZXRjaCUyMHdyYXB8ZW58MHwwfHx8MTc4NjQxMzM3NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-prod-kit": "https://images.unsplash.com/photo-1617909517054-64d4958be1c9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FyZWhvdXNlJTIwcGFja2luZyUyMHN0YXJ0ZXIlMjBraXQlMjBib3hlcyUyMHRhcGUlMjBmaWxsfGVufDB8MHx8fDE3ODY0MTMzNzh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-post-rightsize": "https://images.unsplash.com/photo-1630448927918-1dbcd8ba439b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8NHx8cHJvZHVjdCUyMG1lYXN1cmVkJTIwYm94fGVufDB8MHx8fDE3ODY0MTM2NDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-post-eco": "https://images.unsplash.com/photo-1700165644892-3dd6b67b25bc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmVjeWNsYWJsZSUyMGtyYWZ0JTIwcGFja2FnaW5nJTIwbWF0ZXJpYWxzJTIwYmVuY2h8ZW58MHwwfHx8MTc4NjQxMzM4M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pkg-post-shipcost": "https://images.unsplash.com/photo-1559724087-a45f6a7a35d7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFyY2VsJTIwc2hpcHBpbmclMjBzY2FsZSUyMGJlc2lkZSUyMGRpbWVuc2lvbmFsLXdlaWdodCUyMGNoYXJ0fGVufDB8MHx8fDE3ODY0MTMzODZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'pkg-hero', url: src('pkg-hero'), alt: 'Stacked pallets of corrugated shipping cartons in a distribution warehouse' },
    { id: 'pkg-tile-boxes', url: src('pkg-tile-boxes'), alt: 'Flat-packed corrugated shipping boxes bundled and banded' },
    { id: 'pkg-tile-mailers', url: src('pkg-tile-mailers'), alt: 'A case of poly mailers ready for the packing bench' },
    { id: 'pkg-tile-tape', url: src('pkg-tile-tape'), alt: 'Rolls of packing tape and void-fill on a warehouse shelf' },
    { id: 'pkg-tile-labels', url: src('pkg-tile-labels'), alt: 'A roll of blank thermal shipping labels beside a label printer' },
    { id: 'pkg-band-dispatch', url: src('pkg-band-dispatch'), alt: 'A worker loading banded cartons onto a next-day dispatch pallet' },
    { id: 'pkg-prod-boxes', url: src('pkg-prod-boxes'), alt: 'A bundle of flat corrugated shipping boxes' },
    { id: 'pkg-prod-poly', url: src('pkg-prod-poly'), alt: 'A case of grey poly mailers' },
    { id: 'pkg-prod-tape', url: src('pkg-prod-tape'), alt: 'A case of clear packing-tape rolls' },
    { id: 'pkg-prod-bubble', url: src('pkg-prod-bubble'), alt: 'A large roll of small-bubble cushioning wrap' },
    { id: 'pkg-prod-voidfill', url: src('pkg-prod-voidfill'), alt: 'A roll of kraft void-fill paper on a dispenser' },
    { id: 'pkg-prod-kraft', url: src('pkg-prod-kraft'), alt: 'A stack of padded kraft bubble mailers' },
    { id: 'pkg-prod-labels', url: src('pkg-prod-labels'), alt: 'A pack of thermal shipping-label rolls' },
    { id: 'pkg-prod-stretch', url: src('pkg-prod-stretch'), alt: 'A roll of clear pallet stretch wrap' },
    { id: 'pkg-prod-kit', url: src('pkg-prod-kit'), alt: 'A warehouse packing starter kit of boxes, tape and fill' },
    { id: 'pkg-post-rightsize', url: src('pkg-post-rightsize'), alt: 'A product measured against a box to right-size the carton' },
    { id: 'pkg-post-eco', url: src('pkg-post-eco'), alt: 'Recyclable kraft packaging materials on a bench' },
    { id: 'pkg-post-shipcost', url: src('pkg-post-shipcost'), alt: 'A parcel on a shipping scale beside a dimensional-weight chart' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-b2b-packaging: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warehouse photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a trade-account link. Never ink on
 *  the photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('pkg-hero'), alt: 'Pallets of shipping cartons in a distribution warehouse', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-2xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Ships today, priced by the pallet.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Boxwell Supply is a wholesale packaging distributor for e-commerce sellers and warehouses. Boxes, mailers, tape, fill and labels by the case — real trade pricing, deep stock, and next-day dispatch on everything you see.',
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
                        text: 'Shop by the aisle',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'pkg-tile-boxes', label: 'Boxes', href: '/shop', alt: 'Flat-packed corrugated shipping boxes' }),
                            categoryTile({ assetId: 'pkg-tile-mailers', label: 'Mailers', href: '/shop', alt: 'A case of poly mailers' }),
                            categoryTile({ assetId: 'pkg-tile-tape', label: 'Tape & fill', href: '/shop', alt: 'Packing tape and void-fill rolls' }),
                            categoryTile({ assetId: 'pkg-tile-labels', label: 'Labels', href: '/shop', alt: 'A roll of blank thermal shipping labels' }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** One trade-account benefit — a spec card: a heading and a plain line of copy. */
function tradeCard(o: { heading: string; body: string }): Node {
    return el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
        children: [
            el('h3', 'text-lg font-bold tracking-tight text-base-content', { text: o.heading }),
            el('p', 'text-base leading-relaxed text-base-content', { text: o.body }),
        ],
    });
}

/** The wholesale-ordering band — the ACCOUNT sell. Bulk tiers, dispatch, terms, custom print
 *  and a named account manager as plain, dependable copy, over the kraft base-200 ground, with
 *  a single "Open a trade account" CTA. This is the beat a trade site lives on. */
function tradeBand(): Node {
    return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('div', 'flex max-w-2xl flex-col gap-4', {
                        children: [
                            el('h2', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl', {
                                text: 'Buying for a warehouse, not a doorstep',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'A trade account gets you the price the pallet earns, terms that fit your books, and one person who knows your business. Setup takes a day, and there is no minimum spend to hold one.',
                            }),
                        ],
                    }),
                    el('div', 'grid grid-cols-1 gap-4 @3xl:grid-cols-3 @3xl:gap-6', {
                        children: [
                            tradeCard({
                                heading: 'Bulk pricing tiers',
                                body: 'Every line drops in price as the quantity climbs — case, half-pallet, pallet. The break shows on the product page, so you always know the next threshold worth hitting.',
                            }),
                            tradeCard({
                                heading: 'Next-day dispatch',
                                body: 'Order by 3pm and it ships the same day from stock, on a next-day service across the mainland. Consumables you run on should never be the thing that stops a shipment.',
                            }),
                            tradeCard({
                                heading: 'Net-30 terms',
                                body: 'Approved accounts order on net-30 and settle monthly against a single statement — no card at the checkout, no reconciling a dozen small receipts.',
                            }),
                            tradeCard({
                                heading: 'Custom-printed options',
                                body: 'Put your brand on the box: one to two colors on cartons, mailers and tape, from low trade minimums. Send artwork and we quote the run and the lead time back the same week.',
                            }),
                            tradeCard({
                                heading: 'A named account manager',
                                body: 'One person who knows your SKUs, your sizes and your peak season — reachable by direct line, not a ticket queue. They flag a better-fitting box before you reorder the wrong one.',
                            }),
                            tradeCard({
                                heading: 'Standing orders',
                                body: 'Set a recurring release on the lines you burn through and we hold stock against it. Skip, bring forward or adjust the quantity any time from your account.',
                            }),
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
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Fast movers, always in stock' }),
    tradeBand(),
    productsBlock({ source: 'commerce.category.boxes', layout: 'carousel', heading: 'Shipping boxes' }),
    editorialBand({
        heading: 'One warehouse, next-day out',
        lead: 'We hold deep stock of every line so an order is picked, banded and on a next-day pallet the same afternoon — not back-ordered from a supplier three steps away. The catalogue is what is actually on the shelf.',
        assetId: 'pkg-band-dispatch',
        cta: 'How dispatch works',
        href: '/blog/cut-your-shipping-costs',
        alt: 'A worker loading banded cartons onto a dispatch pallet',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, case price, low-stock,
 *  description, add-to-cart, a static "Trade pricing & bulk breaks" note, and policy links). */
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
                                        text: 'Boxwell Supply',
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
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Trade pricing & bulk breaks' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'The price shown is per case at the standard trade rate. It steps down again at half-pallet and pallet quantities — open a trade account to see your tier and net-30 terms. Order by 3pm and it ships from stock the same day.',
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

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Pairs with' });

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
        'The catalogue',
        'Everything we stock, priced by the case with pack quantities and minimum orders on every line. Filter by aisle or sort however you like — all of it ships next-day from one warehouse, and every price drops again on a trade account.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead('Collections', 'The catalogue grouped the way a packing bench actually orders — the fast movers, what is new this quarter, the box range, protective fill, the mailer range, and a starter kit for a new operation.'),
];
const SEARCH: Node[] = [
    pageMasthead('Search Boxwell', 'Looking for a box size, a mailer, a tape grade or a spec? Search the whole catalogue and the trade notes below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Order by 3pm for same-day dispatch, next-day across the mainland. Approved trade accounts check out on net-30 against a single monthly statement — no card, no per-order receipts to reconcile.',
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
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The loading dock' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Plain, useful notes from the warehouse — right-sizing your cartons, the greener materials worth switching to, and the shipping-cost levers that actually move the invoice.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Boxwell Supply' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Boxwell started on one loading dock, supplying packaging to the growing e-commerce sellers next door who were tired of paying retail prices for the boxes they shipped in every day. We grew the plain way — deeper stock, better trade pricing, faster dispatch — and it still runs on the same idea: hold the material, price it fairly, and get it out the door today.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We buy direct from the mills and converters, in pallet volumes, and pass the volume through to accounts of every size — a two-person studio and a national 3PL buy the same line at a price that reflects what they take. No opaque list price, no chasing a rep for a quote on a stock box.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'What we sell is dependability: the case you reordered is the case that arrives, at the price you were quoted, on the day you needed it. Packaging is the last thing that should be a surprise.',
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
        intro: 'Tell us what you ship and roughly how much, and we will set up an account with your trade pricing, net-30 terms and a named account manager — usually within a day. Existing customers, reach your manager on the direct line on your statement.',
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

/** A single-line case product — one SKU, priced by the case/bundle/roll. */
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
    alt: string;
    seoTitle: string;
    seoDescription: string;
}): Product => ({
    handle: opts.handle,
    title: opts.title,
    description: opts.description,
    status: 'active',
    productType: opts.productType,
    vendor: 'Boxwell Supply',
    tags: opts.tags,
    categoryHandles: opts.categories,
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    variants: [{ sku: opts.sku, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.alt }],
});

const PRODUCTS: Product[] = [
    // Boxes — a size-optioned bundle, priced by the size (three variants, real price ladder).
    {
        handle: 'shipping-boxes',
        title: 'Corrugated Shipping Boxes',
        description:
            'Single-wall 32 ECT kraft cartons, sold in bundles of 25, flat-packed. MOQ 4 bundles (100 boxes); price shown is per bundle and steps down by the pallet. Clean die-cut creases fold square by hand — no tape gun fight, no bulging seams. Pick the size to your product and stop paying to ship air.',
        status: 'active',
        productType: 'Shipping box',
        vendor: 'Boxwell Supply',
        tags: ['boxes', 'corrugated', 'bulk', 'best-seller'],
        categoryHandles: ['boxes'],
        collectionHandles: ['best-sellers', 'ship-boxes'],
        seoTitle: 'Corrugated Shipping Boxes — bundles of 25 | Boxwell Supply',
        seoDescription: 'Single-wall 32 ECT kraft shipping boxes in bundles of 25, three sizes. Trade-priced by the pallet, next-day dispatch.',
        options: [
            {
                name: 'Size',
                displayType: 'dropdown',
                values: [{ value: 'Small 8x6x4' }, { value: 'Medium 12x9x6' }, { value: 'Large 16x12x8' }],
            },
        ],
        variants: [
            { sku: 'BOX-SW-S', priceCents: money(22), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Small 8x6x4' } },
            { sku: 'BOX-SW-M', priceCents: money(29), inventoryPolicy: 'continue', optionValues: { Size: 'Medium 12x9x6' } },
            { sku: 'BOX-SW-L', priceCents: money(38), inventoryPolicy: 'continue', optionValues: { Size: 'Large 16x12x8' } },
        ],
        images: [{ assetId: 'pkg-prod-boxes', isPrimary: true, alt: 'A bundle of flat corrugated shipping boxes' }],
    },
    // Poly mailers — size-optioned case of 500.
    {
        handle: 'poly-mailers',
        title: 'Poly Mailers',
        description:
            'Tear-resistant co-extruded poly mailers with a permanent self-seal strip, sold by the case of 500. MOQ 2 cases; price shown is per case. Opaque grey, waterproof, and light enough to keep the parcel in the lowest weight band. The default shipper for soft goods that do not need a box.',
        status: 'active',
        productType: 'Mailer',
        vendor: 'Boxwell Supply',
        tags: ['mailers', 'poly', 'bulk', 'best-seller'],
        categoryHandles: ['mailers'],
        collectionHandles: ['best-sellers', 'mailer-range'],
        seoTitle: 'Poly Mailers — case of 500 | Boxwell Supply',
        seoDescription: 'Waterproof self-seal poly mailers in a case of 500, three sizes. Trade-priced, next-day dispatch from stock.',
        options: [
            {
                name: 'Size',
                displayType: 'dropdown',
                values: [{ value: 'Small 10x13' }, { value: 'Medium 14.5x19' }, { value: 'Large 19x24' }],
            },
        ],
        variants: [
            { sku: 'MLR-POLY-S', priceCents: money(41), isDefault: true, inventoryPolicy: 'continue', optionValues: { Size: 'Small 10x13' } },
            { sku: 'MLR-POLY-M', priceCents: money(58), inventoryPolicy: 'continue', optionValues: { Size: 'Medium 14.5x19' } },
            { sku: 'MLR-POLY-L', priceCents: money(76), inventoryPolicy: 'continue', optionValues: { Size: 'Large 19x24' } },
        ],
        images: [{ assetId: 'pkg-prod-poly', isPrimary: true, alt: 'A case of grey poly mailers' }],
    },
    caseItem({
        handle: 'packing-tape',
        title: 'Packing Tape',
        description:
            'Heavy-grade acrylic carton-sealing tape, 48mm x 100m, sold by the case of 36 rolls. MOQ 1 case; price shown is per case. Quiet off the roll, sticks first pass to kraft, and holds through a cold van — the tape you stop thinking about. Fits every standard 2-inch dispenser.',
        price: 44,
        sku: 'TAPE-ACR-36',
        productType: 'Tape',
        categories: ['tape-fill'],
        collections: ['best-sellers', 'new-this-quarter'],
        tags: ['tape', 'sealing', 'bulk'],
        asset: 'pkg-prod-tape',
        alt: 'A case of clear packing-tape rolls',
        seoTitle: 'Packing Tape — case of 36 rolls | Boxwell Supply',
        seoDescription: 'Heavy-grade 48mm acrylic carton-sealing tape, 36 rolls to the case. First-pass adhesion on kraft, trade-priced.',
    }),
    caseItem({
        handle: 'bubble-wrap',
        title: 'Bubble Cushioning Roll',
        description:
            'Small-bubble cushioning film, 500mm x 100m on the roll, perforated every 300mm so it tears clean at the bench. MOQ 4 rolls; price shown is per roll. Nesting bubbles keep their air under stacking — the everyday wrap for anything with an edge or a screen.',
        price: 34,
        sku: 'FILL-BUB-500',
        productType: 'Protective packaging',
        categories: ['tape-fill'],
        collections: ['protective-fill'],
        tags: ['fill', 'protective', 'bubble', 'roll'],
        asset: 'pkg-prod-bubble',
        alt: 'A large roll of small-bubble cushioning wrap',
        seoTitle: 'Bubble Cushioning Roll — 500mm x 100m | Boxwell Supply',
        seoDescription: 'Perforated small-bubble cushioning film, 500mm x 100m. Tears clean at the bench, trade-priced by the roll.',
    }),
    caseItem({
        handle: 'void-fill-paper',
        title: 'Kraft Void-Fill Paper',
        description:
            'Recycled 70gsm kraft void-fill on a 400m fan-folded stack that feeds straight into a dispenser — no jams, no tangles. MOQ 2 stacks; price shown is per stack. Scrunches to fill a carton fast and drops in the household recycling, so it is the greener swap for loose-fill and air pillows.',
        price: 39,
        sku: 'FILL-KRAFT-400',
        productType: 'Protective packaging',
        categories: ['tape-fill'],
        collections: ['protective-fill', 'new-this-quarter'],
        tags: ['fill', 'void-fill', 'kraft', 'recyclable'],
        asset: 'pkg-prod-voidfill',
        alt: 'A fan-folded stack of kraft void-fill paper',
        seoTitle: 'Kraft Void-Fill Paper — 400m fan-fold | Boxwell Supply',
        seoDescription: 'Recycled 70gsm kraft void-fill, 400m fan-folded for jam-free dispensing. Kerbside-recyclable, trade-priced.',
    }),
    caseItem({
        handle: 'kraft-mailers',
        title: 'Padded Kraft Mailers',
        description:
            'Paper-padded kraft bubble mailers with a self-seal strip, sold by the case of 100. MOQ 2 cases; price shown is per case. A recyclable protective mailer for small fragile items — books, cosmetics, electronics accessories — that skips the plastic bubble lining entirely.',
        price: 52,
        sku: 'MLR-KRAFT-100',
        productType: 'Mailer',
        categories: ['mailers'],
        collections: ['mailer-range', 'protective-fill'],
        tags: ['mailers', 'kraft', 'padded', 'recyclable'],
        asset: 'pkg-prod-kraft',
        alt: 'A stack of padded kraft bubble mailers',
        seoTitle: 'Padded Kraft Mailers — case of 100 | Boxwell Supply',
        seoDescription: 'Recyclable paper-padded kraft mailers, self-seal, case of 100. Protective without the plastic, trade-priced.',
    }),
    caseItem({
        handle: 'thermal-labels',
        title: 'Thermal Shipping Labels',
        description:
            '4x6 direct-thermal shipping labels on a 250-count roll, sold in a pack of 12 rolls (3,000 labels). MOQ 1 pack; price shown is per pack. Smudge-proof, no ink or ribbon, and sized for every major carrier — feeds any standard 4-inch desktop or industrial label printer.',
        price: 46,
        sku: 'LBL-4X6-12',
        productType: 'Label',
        categories: ['labels'],
        collections: ['best-sellers', 'new-this-quarter'],
        tags: ['labels', 'thermal', 'shipping', 'bulk'],
        asset: 'pkg-prod-labels',
        alt: 'A pack of thermal shipping-label rolls',
        seoTitle: 'Thermal Shipping Labels — 4x6, 12-roll pack | Boxwell Supply',
        seoDescription: '4x6 direct-thermal shipping labels, 250 to the roll, 12-roll pack. Ribbon-free, carrier-sized, trade-priced.',
    }),
    caseItem({
        handle: 'stretch-wrap',
        title: 'Pallet Stretch Wrap',
        description:
            'Blown cast stretch film, 500mm x 300m, 20 micron, sold by the case of 6 rolls. MOQ 1 case; price shown is per case. High cling and a strong holding force lock a pallet square for transit, hand-dispensed or on a machine head. The last step before it leaves the dock.',
        price: 48,
        sku: 'WRAP-STR-6',
        productType: 'Protective packaging',
        categories: ['tape-fill'],
        collections: ['protective-fill'],
        tags: ['stretch-wrap', 'pallet', 'film', 'bulk'],
        asset: 'pkg-prod-stretch',
        alt: 'A roll of clear pallet stretch wrap',
        seoTitle: 'Pallet Stretch Wrap — 500mm, case of 6 rolls | Boxwell Supply',
        seoDescription: 'Blown cast stretch film, 500mm x 300m, 20 micron, 6 rolls to the case. High cling, trade-priced by the case.',
    }),
    caseItem({
        handle: 'warehouse-starter-kit',
        title: 'Warehouse Starter Kit',
        description:
            'Everything a new packing bench needs to ship on day one: 100 assorted boxes, a case of tape, a bubble roll, a void-fill stack and a thermal-label pack, at a bundled trade price below the lines bought apart. MOQ 1 kit. The fastest way to stand up a fulfilment corner without a dozen separate orders.',
        price: 189,
        sku: 'KIT-START-1',
        productType: 'Kit',
        categories: ['boxes'],
        collections: ['starter-kits', 'new-this-quarter'],
        tags: ['kit', 'starter', 'bundle', 'best-seller'],
        asset: 'pkg-prod-kit',
        alt: 'A warehouse packing starter kit of boxes, tape and fill',
        seoTitle: 'Warehouse Starter Kit — boxes, tape, fill & labels | Boxwell Supply',
        seoDescription: 'A bundled packing starter kit — assorted boxes, tape, bubble, void-fill and labels — at a trade price below the parts.',
    }),
];

const COMMERCE = {
    categories: [
        { handle: 'boxes', name: 'Boxes', description: 'Corrugated shipping cartons and kits, by the bundle and the pallet.', featured: true },
        { handle: 'mailers', name: 'Mailers', description: 'Poly and padded kraft mailers, by the case.', featured: true },
        { handle: 'tape-fill', name: 'Tape & fill', description: 'Carton-sealing tape, cushioning, void-fill and stretch wrap.', featured: true },
        { handle: 'labels', name: 'Labels', description: 'Direct-thermal shipping labels by the roll pack.', featured: true },
    ],
    collections: [
        {
            handle: 'best-sellers',
            name: 'Fast movers',
            description: 'The lines that leave the dock every day.',
            type: 'manual',
            featured: true,
            productHandles: ['shipping-boxes', 'poly-mailers', 'packing-tape', 'thermal-labels', 'warehouse-starter-kit'],
        },
        {
            handle: 'new-this-quarter',
            name: 'New this quarter',
            description: 'Recent additions to the stock list.',
            type: 'manual',
            featured: true,
            productHandles: ['void-fill-paper', 'thermal-labels', 'packing-tape', 'warehouse-starter-kit'],
        },
        {
            handle: 'ship-boxes',
            name: 'The box range',
            description: 'Corrugated cartons across every common size.',
            type: 'manual',
            featured: false,
            productHandles: ['shipping-boxes', 'warehouse-starter-kit'],
        },
        {
            handle: 'protective-fill',
            name: 'Protect & fill',
            description: 'Cushioning, void-fill, padded mailers and pallet wrap.',
            type: 'manual',
            featured: false,
            productHandles: ['bubble-wrap', 'void-fill-paper', 'kraft-mailers', 'stretch-wrap'],
        },
        {
            handle: 'mailer-range',
            name: 'The mailer range',
            description: 'Poly and padded kraft, for anything that skips a box.',
            type: 'manual',
            featured: false,
            productHandles: ['poly-mailers', 'kraft-mailers'],
        },
        {
            handle: 'starter-kits',
            name: 'Starter kits',
            description: 'Stand up a packing bench in one order.',
            type: 'manual',
            featured: false,
            productHandles: ['warehouse-starter-kit', 'shipping-boxes', 'packing-tape'],
        },
    ],
    products: PRODUCTS,
};

// ── Content (the loading dock) ───────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'right-size-your-packaging',
        status: 'published',
        body: {
            title: 'Right-size your packaging and stop shipping air',
            excerpt: 'The cheapest packaging decision is usually the box you didn’t oversize. Here’s how to match the carton to the product and cut cost twice.',
            featuredImage: { $asset: 'pkg-post-rightsize' },
            body: {
                type: 'doc',
                content: [
                    para('An oversized box costs you three times over: you pay for the extra board, you pay for the void-fill to stop the product rattling around inside it, and — the big one — you pay the carrier for the air, because parcels are priced on dimensional weight as often as actual weight. A product that could ship in a 12x9x6 going out in an 18x14x10 can quietly double the shipping line on every order.'),
                    h2('Measure the product, then add a little'),
                    para('Take the real dimensions of the packed product — including any bubble or sleeve — and add roughly 2cm on each axis for the cushioning and an easy hand-pack. That target size is the box you want a bundle of. Most operations ship 80% of their volume in three or four sizes; find yours by looking at what you actually send, not the full range you could stock.'),
                    h2('Fewer sizes, bought deeper'),
                    para('It is tempting to stock a size for every product. In practice, a tight range of three to five sizes bought in pallet volume beats a wide range bought in bundles: you hit the better price break, you hold less slow-moving stock, and the bench packs faster because there is less deciding. Round products up to the nearest stocked size rather than adding another SKU for the sake of a centimetre.'),
                    para('If you are not sure where your range should land, send us a month of your order dimensions and your account manager will map it to the fewest sizes that cover it — usually saving more on carrier cost than on the boxes themselves.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'greener-packaging-that-still-protects',
        status: 'published',
        body: {
            title: 'Greener packaging that still protects',
            excerpt: 'Recyclable doesn’t have to mean flimsy. The switches that lower your footprint without raising your damage rate.',
            featuredImage: { $asset: 'pkg-post-eco' },
            body: {
                type: 'doc',
                content: [
                    para('Customers notice packaging, and increasingly they notice plastic. The good news is that the paper-based alternatives have caught up on protection — the question is no longer whether they work, but which switches are worth making first for your product mix.'),
                    h2('The easy swaps'),
                    para('Two changes cover most operations. Kraft void-fill paper replaces loose-fill and air pillows one-for-one at the bench, scrunches to fill any carton, and drops in the household recycling — no separate stream, no “check locally” asterisk. Padded kraft mailers replace plastic bubble mailers for small fragile items and carry the same self-seal convenience. Both are stocked lines here, in trade volume.'),
                    h2('Where plastic still earns its place'),
                    para('Be honest about the exceptions. Poly mailers are waterproof and lighter than any paper equivalent, which for some products means a lower carrier weight band and genuinely less material by mass. Where you keep a plastic line, look for a recyclable-stream grade and say so on the parcel, so the customer knows what to do with it. Greener is a direction, not a purity test — the switch that lowers your damage rate and your footprint at once is the one to make.'),
                    para('Ask your account manager for the recyclable equivalent of anything on your current order; where we stock one, we’ll price it alongside so you can compare cost per parcel, not just cost per case.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'cut-your-shipping-costs',
        status: 'published',
        body: {
            title: 'The packaging levers that actually cut shipping cost',
            excerpt: 'Carriers price on dimensional weight, so your box is a shipping decision. Four levers that move the invoice, in order of impact.',
            featuredImage: { $asset: 'pkg-post-shipcost' },
            body: {
                type: 'doc',
                content: [
                    para('Most sellers try to cut shipping by negotiating the carrier rate, then stop. The rate matters, but the parcel itself is often the bigger lever — because it is one you control completely, and it compounds across every order you ship. Here are the four that move the number most, roughly in order.'),
                    h2('1. Dimensional weight'),
                    para('Carriers bill on whichever is greater: the actual weight or the volumetric weight (length × width × height ÷ a divisor). For anything light and bulky, the box size sets the price, full stop. Right-sizing your cartons — see the right-sizing note — is almost always the single biggest saving available, and it costs nothing but a tighter box range.'),
                    h2('2. Weight bands and material mass'),
                    para('The difference between the top of one weight band and the bottom of the next can be a few grams of packaging. Lighter mailers, thinner-but-adequate board, and paper fill instead of heavy alternatives can keep a parcel in the cheaper band. Weigh a typical packed order and see how close you are to a threshold — sometimes a lighter tape or mailer pays for itself immediately.'),
                    h2('3. Consolidation and format'),
                    para('Two items going to one address should leave in one parcel; a mailer beats a box for anything that does not need the rigidity, both on dimensional weight and on material cost. Set the bench up so the smaller format is the default and the box is the exception, not the reverse.'),
                    h2('4. Buying volume'),
                    para('None of the above helps if the packaging itself is bought at retail. Trade pricing by the pallet, on the tight range you actually use, is what makes the per-parcel maths work — and it is exactly what a trade account here is for. Send us your volumes and we’ll show the landed cost per parcel, not just the case price.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'b2b-packaging',
    key: 'sparx-b2b-packaging',
    name: 'Packaging Supplies (Wholesale)',
    theme: THEME,
    summary:
        'A complete, working wholesale shop for a packaging & shipping-supplies distributor: a real trade catalogue priced by the case, bundle and roll — boxes, mailers, tape, cushioning, void-fill, stretch wrap, labels and a starter kit — with pack quantities and MOQs, a bespoke trade PDP with bulk breaks, and a home page that sells the account (bulk tiers, next-day dispatch, net-30). Kraft-industrial theme — corrugated tan, deep warehouse blue, safety-orange accent. Shipped as Boxwell Supply.',
    tagline: 'A dependable trade storefront for a packaging distributor.',
    vertical: 'b2b',
    industry: 'Packaging & shipping supplies',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 84,
    brand: {
        businessName: 'Boxwell Supply',
        tagline: 'Ships today, priced by the pallet.',
    },
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Boxwell Supply — wholesale packaging & shipping supplies',
            description:
                'Boxwell Supply is a wholesale packaging distributor for e-commerce sellers and warehouses — boxes, mailers, tape, fill and labels by the case, at real trade pricing with next-day dispatch and net-30 terms.',
        },
        about: {
            title: 'About Boxwell Supply',
            description:
                'How Boxwell buys, stocks and ships — direct from the mills, deep stock, honest trade pricing, and packaging that arrives the day you need it.',
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
