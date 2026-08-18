// sparx-retail-outdoor-rugged — a RETAIL/COMMERCE site template: an outdoor & adventure
// gear outfitter.
//
// A sibling of the retail-family gold reference (gen-retail-coffee-craft.ts): a complete,
// working shop the moment it installs — a real catalogue (a hardshell, a down hoody, a
// merino base layer, packs, a dry bag, trail socks, an insulated bottle, a headlamp and
// trekking poles), categories + collections, a bespoke spec-forward PDP, the full 9-page
// commerce site (home merchandising → shop → collections → cart → search → journal → about
// → contact), dressed in an INLINE bespoke theme (a muted stone-khaki mid ground, a deep
// forest-green primary and a blaze-orange accent, under a utilitarian grotesk). Shipped as
// Ridgeline Supply.
//
// SELF-CONTAINED BY DESIGN. Like every retail-family generator it carries its OWN theme
// inline and passes it on the spec (`theme`), so the whole family can be authored in
// parallel without any two generators contending on a shared `*-themes.ts` registry. The
// shared `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-outdoor-rugged.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-outdoor-rugged/**" \
//     "marketplace-catalog/_gen/gen-retail-outdoor-rugged.ts"
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
// A field outfitter: a muted stone-khaki MID ground (reads as canvas and dirt, not white),
// a deep forest-green primary, a slate-teal secondary dark enough to set spec labels in,
// and a blaze-orange accent — the one high-visibility signal every trail sign already uses.
// A utilitarian grotesk throughout, square-ish corners, double-weight borders, zero depth:
// gear drawn like the spec sheet it shipped with. Complete light + dark, AA on every role
// (the blueprint sweep's contrast check is the gate).
const THEME = defineTheme({
    name: 'ridgeline-field',
    type: { body: face('Archivo', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
    shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', border: '2px', depth: '0' },
    light: {
        surfaces: ['oklch(91% 0.024 110)', 'oklch(88% 0.03 108)', 'oklch(83% 0.038 104)', 'oklch(22% 0.03 120)'],
        roles: {
            primary: 'oklch(38% 0.09 155)',
            secondary: 'oklch(40% 0.045 210)',
            accent: 'oklch(46% 0.17 45)',
            neutral: 'oklch(26% 0.022 120)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(20% 0.02 128)', 'oklch(17% 0.02 128)', 'oklch(14% 0.02 128)', 'oklch(93% 0.02 110)'],
        roles: {
            primary: 'oklch(74% 0.12 155)',
            secondary: 'oklch(78% 0.05 210)',
            accent: 'oklch(74% 0.15 45)',
            neutral: 'oklch(30% 0.02 128)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "outdoor-hero": "https://images.unsplash.com/photo-1573072738379-7c640e17ac4e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGlrZXIlMjBleHBvc2VkJTIwcmlkZ2VsaW5lJTIwZmlyc3QlMjBsaWdodCUyMHBhY2slMjB3ZWF0aGVyfGVufDB8MHx8fDE3ODY0MDM4MjF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tile-apparel": "https://images.unsplash.com/photo-1735856941047-d6aea67335de?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2hlbGwlMjBqYWNrZXQlMjBkb3duJTIwaG9vZHklMjBsYWlkJTIwb3V0JTIwd2VhdGhlcmVkfGVufDB8MHx8fDE3ODY0MDM4MjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tile-packs": "https://images.unsplash.com/photo-1775626094547-503055233a1e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bG9hZGVkJTIwYmFja3BhY2slMjBsZWFuaW5nJTIwYWdhaW5zdCUyMHRyYWlsJTIwbWFya2VyfGVufDB8MHx8fDE3ODY0MDM4Mjd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tile-accessories": "https://images.unsplash.com/photo-1698731048404-1c12d7189e48?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29vbCUyMHRyYWlsJTIwc29ja3MlMjBiZWFuaWUlMjBsb2clMjBieSUyMHRlbnR8ZW58MHwwfHx8MTc4NjQwMzgzMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tile-gear": "https://images.unsplash.com/photo-1646926551974-e5d5c18f7804?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aW5zdWxhdGVkJTIwYm90dGxlJTIwaGVhZGxhbXAlMjB0cmVra2luZyUyMHBvbGVzJTIwdHJhaWxoZWFkfGVufDB8MHx8fDE3ODY0MDM4MzR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "band-field": "https://images.unsplash.com/photo-1760715815251-df769a737c62?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFja2NvdW50cnklMjBjYW1wJTIwZHVzayUyMGdlYXIlMjBzdGFnZWQlMjBtb3JuaW5nfGVufDB8MHx8fDE3ODY0MDM4Mzh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "band-guarantee": "https://images.unsplash.com/photo-1501087063833-3773ee886f20?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHMlMjBzdGl0Y2hpbmclMjByZXBhaXIlMjB3b3JuJTIwcGFjayUyMHN0cmFwJTIwd29ya2JlbmNofGVufDB8MHx8fDE3ODY0MDM4NDJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-shell-jacket": "https://images.unsplash.com/photo-1780830291587-cf97d4ab1c38?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWxwaW5lJTIwaGFyZHNoZWxsJTIwamFja2V0fGVufDB8MHx8fDE3ODY0MDM5NzZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-down-hoody": "https://images.unsplash.com/photo-1735856941104-e4854bade420?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3VtbWl0JTIwZG93biUyMGhvb2R5JTIwcGFja2VkJTIwbG9mdCUyMHNob3d8ZW58MHwwfHx8MTc4NjQwMzg0N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-bottle": "https://images.unsplash.com/photo-1605539585404-a846f1193d19?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dmF1bHQlMjBpbnN1bGF0ZWQlMjBzdGFpbmxlc3MlMjBib3R0bGUlMjBsaWQlMjBvZmZ8ZW58MHwwfHx8MTc4NjQwMzg1OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-poles": "https://images.unsplash.com/photo-1627289496743-8a9a08bb228a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXNjZW50JTIwY2FyYm9uJTIwdHJla2tpbmd8ZW58MHwwfHx8MTc4NjQwMzk5MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-layering": "https://images.unsplash.com/photo-1759157403849-f06d8221e258?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhyZWUlMjBsYXllcnMlMjBzdGFja2VkJTIwZmxhdCUyMGJhc2UlMjBtaWQlMjBzaGVsbHxlbnwwfDB8fHwxNzg2NDAzODY3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-trail": "https://images.unsplash.com/photo-1502126324834-38f8e02d7160?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3dpdGNoYmFjayUyMGNsaW1iaW5nJTIwdG93YXJkfGVufDB8MHx8fDE3ODY0MDM5OTR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-packing": "https://images.unsplash.com/photo-1522199710521-72d69614c702?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFjayUyMGxhaWQlMjBvdXQlMjBjb250ZW50cyUyMG9yZ2FuaXNlZCUyMGJlZm9yZSUyMHRyaXB8ZW58MHwwfHx8MTc4NjQwMzg3M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'outdoor-hero', url: src('outdoor-hero'), alt: 'A hiker on an exposed ridgeline at first light, pack on, weather rolling in' },
    { id: 'tile-apparel', url: src('tile-apparel'), alt: 'A shell jacket and a down hoody laid out on weathered rock' },
    { id: 'tile-packs', url: src('tile-packs'), alt: 'A loaded backpack leaning against a trail marker' },
    { id: 'tile-accessories', url: src('tile-accessories'), alt: 'Wool trail socks and a beanie on a log by a tent' },
    { id: 'tile-gear', url: src('tile-gear'), alt: 'An insulated bottle, a headlamp and trekking poles at a trailhead' },
    { id: 'band-field', url: src('band-field'), alt: 'A backcountry camp at dusk with gear staged for the morning' },
    { id: 'band-guarantee', url: src('band-guarantee'), alt: 'Hands stitching a repair on a worn pack strap at a workbench' },
    { id: 'prod-shell-jacket', url: src('prod-shell-jacket'), alt: 'The Alpine Hardshell Jacket against grey stone' },
    { id: 'prod-down-hoody', url: src('prod-down-hoody'), alt: 'The Summit Down Hoody, packed loft on show' },
    { id: 'prod-base-layer', url: src('prod-base-layer'), alt: 'The Ridgeline Merino Crew base layer folded flat' },
    { id: 'prod-backpack', url: src('prod-backpack'), alt: 'The Trailhead 38 backpack, loaded and standing' },
    { id: 'prod-dry-bag', url: src('prod-dry-bag'), alt: 'The Fathom roll-top dry bag rolled and clipped' },
    { id: 'prod-socks', url: src('prod-socks'), alt: 'A pair of Switchback merino trail socks' },
    { id: 'prod-bottle', url: src('prod-bottle'), alt: 'The Vault insulated stainless bottle, lid off' },
    { id: 'prod-headlamp', url: src('prod-headlamp'), alt: 'The Beacon 400 headlamp, beam on' },
    { id: 'prod-poles', url: src('prod-poles'), alt: 'The Ascent carbon trekking poles, collapsed and extended' },
    { id: 'post-layering', url: src('post-layering'), alt: 'Three layers stacked flat — base, mid and shell' },
    { id: 'post-trail', url: src('post-trail'), alt: 'A switchback climbing toward a saddle above the treeline' },
    { id: 'post-packing', url: src('post-packing'), alt: 'A pack laid out with its contents organised before a trip' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-retail-outdoor-rugged: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one landscape photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a text link. Never ink on the
 *  photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('outdoor-hero'), alt: 'A hiker on an exposed ridgeline at first light', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Built to be used, not looked at.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Ridgeline Supply outfits people who actually go outside. We make a tight line of hard-wearing apparel, packs and gear, test every piece where it earns its keep, and stand behind it with a repair-first guarantee. Fewer things, made to last, ready when you are.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop the kit' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/collections' },
                                            text: 'Build a layering system',
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
                        text: 'Gear up by category',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'tile-apparel', label: 'Apparel', href: '/shop', alt: 'A shell jacket and a down hoody on rock' }),
                            categoryTile({ assetId: 'tile-packs', label: 'Packs', href: '/shop', alt: 'A loaded backpack against a trail marker' }),
                            categoryTile({ assetId: 'tile-accessories', label: 'Footwear & accessories', href: '/shop', alt: 'Wool socks and a beanie by a tent' }),
                            categoryTile({ assetId: 'tile-gear', label: 'Gear', href: '/shop', alt: 'A bottle, a headlamp and trekking poles' }),
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
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'This season’s gear' }),
    editorialBand({
        heading: 'Field-tested, then torn apart',
        lead: 'Nothing goes in the line until it has done a season on real trips — soaked, dropped, overloaded and left out in the weather. What survives ships; what fails goes back to the bench. If we wouldn’t carry it, we won’t sell it.',
        assetId: 'band-field',
        cta: 'How we test our gear',
        href: '/blog/how-we-test',
        alt: 'A backcountry camp at dusk with gear staged for morning',
    }),
    productsBlock({ source: 'commerce.category.apparel', layout: 'carousel', heading: 'The layering system' }),
    editorialBand({
        heading: 'Repair first, replace last',
        lead: 'Good gear should outlast the trend cycle. Every Ridgeline piece is built to be fixed, not binned — send it back and we’ll patch a shell, restitch a strap or re-loft a bag before you ever pay for a new one. That’s the whole point of buying well once.',
        assetId: 'band-guarantee',
        cta: 'Our repair guarantee',
        href: '/blog/repair-guarantee',
        alt: 'Hands stitching a repair on a worn pack strap',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, price, low-stock,
 *  description, add-to-cart, a static spec/guarantee note, and policy links). */
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
                                        text: 'Ridgeline Supply',
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
                            el('div', 'flex flex-col gap-2 rounded-box border-2 border-base-300 bg-base-200 p-5', {
                                children: [
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Built to last, backed to repair' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Every piece ships field-ready and covered by our repair-first guarantee — send it back for a patch, a restitch or a re-loft before you ever pay for a replacement. Free shipping over $75, easy 30-day returns, and real people at the shop if you need a hand choosing a size.',
                                    }),
                                ],
                            }),
                            pdpPolicyLinks({
                                className:
                                    'flex flex-wrap items-center gap-x-6 gap-y-2 border-t-2 border-base-300 pt-5 text-sm font-semibold uppercase tracking-widest text-base-content',
                                linkClass: 'underline underline-offset-4',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Rounds out the kit' });

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
        'Shop the kit',
        'Everything Ridgeline makes, in one place — apparel, packs, footwear and gear for the trail, the crag and the campsite. Filter by category or sort however you like; every piece is field-tested and covered by the repair guarantee.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead('Collections', 'The gear grouped the way you actually pack it — this season’s arrivals, the pieces people reorder, a full layering system, and the small essentials no trip should leave without.'),
];
const SEARCH: Node[] = [
    pageMasthead('Search Ridgeline', 'Hunting for a shell, a pack size, a base layer or a trail guide? Search the whole shop and the field journal below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your kit bag' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Free shipping on orders over $75, and everything is covered by our repair-first guarantee. Not sure a size or a piece is right? Tell us before you head out and we’ll make it work — gear you can trust starts with getting it right.',
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
                    el('h1', 'text-5xl font-bold uppercase leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The field journal' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Notes from the trail and the workbench — how we test our gear, how to layer for the weather, and how to pack so nothing gets left behind. Plain, useful, no gatekeeping.',
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
                    el('h1', 'text-5xl font-bold uppercase tracking-tight text-base-content @2xl:text-6xl', { text: 'About Ridgeline' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Ridgeline Supply started with a torn pack on a week-long traverse and a simple frustration: too much outdoor gear is built for the shelf, not the trail. So we set out to make a short, honest line of kit — apparel, packs and hard goods you can actually rely on when the weather turns and you’re a long way from the car.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We keep the range small on purpose. Every piece is designed by people who use it, tested across a full season of real trips, and made from materials chosen to survive being soaked, dropped and overloaded. If something can’t take a beating, it never makes the catalogue.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'And we build everything to be fixed, not thrown away. Our repair-first guarantee means a worn strap or a torn shell comes back to the bench before it ever costs you a replacement — because the most sustainable gear is the piece you already own, kept in the field for years.',
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
        heading: 'Talk to the shop',
        intro: 'Need a hand with sizing, a warranty repair, or advice on what to pack for a trip? Tell us what you’re planning and a real person who’s actually used the gear will get back to you.',
        submitLabel: 'Email the crew',
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

const APPAREL_SIZES = ['S', 'M', 'L', 'XL'];
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
        vendor: 'Ridgeline Supply',
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

/** A color-only good — no size, offered in a set of colors (packs, dry bags, socks). */
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
        vendor: 'Ridgeline Supply',
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

/** A sized-by-capacity good — one dropdown of volumes (bottles, dry bags). */
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
        vendor: 'Ridgeline Supply',
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

/** A single-SKU hard good — no options (headlamp, poles). */
const hardGood = (opts: {
    handle: string;
    title: string;
    description: string;
    price: number;
    sku: string;
    productType: string;
    category: string;
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
    vendor: 'Ridgeline Supply',
    tags: opts.tags,
    categoryHandles: [opts.category],
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    variants: [{ sku: opts.sku, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue' }],
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const PRODUCTS: Product[] = [
    garment({
        handle: 'alpine-hardshell-jacket',
        title: 'Alpine Hardshell Jacket',
        description:
            'A fully seam-taped, three-layer waterproof shell that shrugs off driving rain and alpine wind without turning into a sauna. Pit zips dump heat on the climb, a helmet-compatible hood cinches down one-handed, and the whole thing stuffs into its own chest pocket. The jacket you keep at the top of the pack all year.',
        price: 279,
        sku: 'RDG-SHELL',
        category: 'apparel',
        collections: ['new-arrivals', 'layering-system', 'best-sellers'],
        tags: ['apparel', 'shell', 'waterproof', 'hardshell'],
        colors: ['Slate', 'Ember', 'Moss'],
        asset: 'prod-shell-jacket',
        seoTitle: 'Alpine Hardshell Jacket — 3-layer waterproof shell | Ridgeline Supply',
        seoDescription: 'A seam-taped 3-layer waterproof hardshell with pit zips and a helmet-compatible hood. Packs into its own pocket.',
    }),
    garment({
        handle: 'summit-down-hoody',
        title: 'Summit Down Hoody',
        description:
            'A featherweight 800-fill down hoody that packs to the size of a water bottle and lofts back to full warmth in seconds. Responsibly-sourced down, a windproof ripstop face, and a hood that fits under a shell — the insulation layer you throw on the moment you stop moving.',
        price: 229,
        sku: 'RDG-DOWN',
        category: 'apparel',
        collections: ['new-arrivals', 'layering-system'],
        tags: ['apparel', 'insulation', 'down', 'midlayer'],
        colors: ['Storm', 'Ember', 'Bone'],
        asset: 'prod-down-hoody',
        seoTitle: 'Summit Down Hoody — 800-fill packable down | Ridgeline Supply',
        seoDescription: 'A featherweight 800-fill down hoody with a windproof face and a shell-compatible hood. Packs to bottle size.',
    }),
    garment({
        handle: 'ridgeline-merino-crew',
        title: 'Ridgeline Merino Crew',
        description:
            'A 100% merino wool base layer that regulates temperature, resists odour after days on the trail, and feels nothing like the itchy wool you remember. Flatlock seams sit flat under a pack, and the fabric wicks and dries fast whether you’re climbing or belaying. The layer that touches your skin, so it’s the one that matters.',
        price: 89,
        sku: 'RDG-BASE',
        category: 'apparel',
        collections: ['layering-system', 'best-sellers'],
        tags: ['apparel', 'base-layer', 'merino'],
        colors: ['Charcoal', 'Moss', 'Rust'],
        asset: 'prod-base-layer',
        seoTitle: 'Ridgeline Merino Crew — 100% merino base layer | Ridgeline Supply',
        seoDescription: 'A soft, odour-resistant 100% merino base layer with flatlock seams that wicks and dries fast.',
    }),
    colorGood({
        handle: 'trailhead-38-backpack',
        title: 'Trailhead 38 Backpack',
        description:
            'A 38-litre do-everything pack sized for fast overnights and long day trips. A ventilated framesheet keeps your back dry, the roll-top lid flexes from a light load to a full haul, and burly hipbelt pockets keep snacks and a phone within reach. Built from recycled ripstop that has already survived a season of abuse.',
        price: 189,
        sku: 'RDG-PACK38',
        productType: 'Pack',
        category: 'packs',
        collections: ['new-arrivals', 'best-sellers', 'packs-and-carry', 'trail-essentials'],
        tags: ['packs', 'backpack', 'daypack'],
        colors: ['Slate', 'Moss', 'Ember'],
        asset: 'prod-backpack',
        seoTitle: 'Trailhead 38 Backpack — 38L pack | Ridgeline Supply',
        seoDescription: 'A ventilated 38L pack with a roll-top lid and hipbelt pockets, built from recycled ripstop. Fast overnights to long days.',
    }),
    sizedGood({
        handle: 'fathom-dry-bag',
        title: 'Fathom Roll-Top Dry Bag',
        description:
            'A fully welded roll-top dry bag that keeps a sleeping bag, a change of clothes or your electronics bone-dry through a river crossing or a downpour. The tough TPU-coated fabric wipes clean, the buckle doubles as a lash point, and it compresses down when you roll the air out. Three sizes to line a pack or organise a boat.',
        optionName: 'Size',
        sizes: [
            { label: '10L', price: 34 },
            { label: '20L', price: 42 },
            { label: '30L', price: 49 },
        ],
        sku: 'RDG-DRY',
        productType: 'Pack',
        category: 'packs',
        collections: ['packs-and-carry', 'trail-essentials'],
        tags: ['packs', 'dry-bag', 'waterproof'],
        asset: 'prod-dry-bag',
        seoTitle: 'Fathom Roll-Top Dry Bag — welded waterproof stuff sack | Ridgeline Supply',
        seoDescription: 'A fully welded TPU roll-top dry bag in 10, 20 and 30L. Keeps kit bone-dry through crossings and downpours.',
    }),
    colorGood({
        handle: 'switchback-trail-socks',
        title: 'Switchback Trail Socks',
        description:
            'A merino-blend hiking sock with cushioning exactly where boots rub and none where they don’t — a proper toe box, a supportive arch band, and a seamless toe so nothing raises a blister at mile fifteen. They wick, they don’t stink, and they keep their shape wash after wash. Buy three pairs; you’ll want them.',
        price: 24,
        sku: 'RDG-SOCK',
        productType: 'Socks',
        category: 'accessories',
        collections: ['best-sellers', 'trail-essentials'],
        tags: ['accessories', 'socks', 'footwear', 'merino'],
        colors: ['Charcoal', 'Moss', 'Rust'],
        asset: 'prod-socks',
        seoTitle: 'Switchback Trail Socks — cushioned merino hiking socks | Ridgeline Supply',
        seoDescription: 'A merino-blend hiking sock with targeted cushioning, an arch band and a seamless toe. Wicks and stays put.',
    }),
    sizedGood({
        handle: 'vault-insulated-bottle',
        title: 'Vault Insulated Bottle',
        description:
            'A double-walled stainless bottle that keeps water cold for a full day out or coffee hot to the summit. The powder-coat shell takes a beating without chipping, the leak-proof lid drinks one-handed, and it fits a pack’s side pocket and a cup holder both. Built to be the last bottle you buy.',
        optionName: 'Size',
        sizes: [
            { label: '18oz', price: 32 },
            { label: '32oz', price: 39 },
        ],
        sku: 'RDG-BOTTLE',
        productType: 'Gear',
        category: 'gear',
        collections: ['best-sellers', 'trail-essentials'],
        tags: ['gear', 'bottle', 'hydration'],
        asset: 'prod-bottle',
        seoTitle: 'Vault Insulated Bottle — double-walled stainless | Ridgeline Supply',
        seoDescription: 'A powder-coated double-walled stainless bottle in 18 and 32oz with a leak-proof one-handed lid.',
    }),
    hardGood({
        handle: 'beacon-400-headlamp',
        title: 'Beacon 400 Headlamp',
        description:
            'A 400-lumen rechargeable headlamp that throws a genuine trail-finding beam and dims to a red night mode that won’t wreck your vision or wake the tent. USB-C charging, a lock-out so it never drains in your pack, and an IPX7 housing that laughs at rain. Small enough to forget you’re wearing, bright enough to trust in the dark.',
        price: 54,
        sku: 'RDG-LAMP400',
        productType: 'Gear',
        category: 'gear',
        collections: ['new-arrivals', 'trail-essentials'],
        tags: ['gear', 'headlamp', 'lighting'],
        asset: 'prod-headlamp',
        seoTitle: 'Beacon 400 Headlamp — 400-lumen rechargeable | Ridgeline Supply',
        seoDescription: 'A 400-lumen USB-C rechargeable headlamp with a red night mode, lock-out and an IPX7 rain-proof housing.',
    }),
    hardGood({
        handle: 'ascent-trekking-poles',
        title: 'Ascent Carbon Trekking Poles',
        description:
            'A pair of collapsible carbon poles that save your knees on the descent and steady the load on the climb. Quick-flip locks adjust in gloves, cork grips wick sweat and mould to your hand, and swappable tips grip rock or bite into mud. They fold short enough to strap to any daypack when the trail eases off.',
        price: 129,
        sku: 'RDG-POLES',
        productType: 'Gear',
        category: 'gear',
        collections: ['new-arrivals', 'packs-and-carry'],
        tags: ['gear', 'trekking-poles', 'hiking'],
        asset: 'prod-poles',
        seoTitle: 'Ascent Carbon Trekking Poles — collapsible pair | Ridgeline Supply',
        seoDescription: 'A pair of collapsible carbon trekking poles with quick-flip locks, cork grips and swappable tips.',
    }),
];

const COMMERCE = {
    categories: [
        { handle: 'apparel', name: 'Apparel', description: 'Shells, insulation and base layers.', featured: true },
        { handle: 'packs', name: 'Packs', description: 'Backpacks and dry bags built to haul.', featured: true },
        { handle: 'accessories', name: 'Footwear & accessories', description: 'Socks and the small stuff that matters.', featured: true },
        { handle: 'gear', name: 'Gear', description: 'Bottles, lighting and trail hardware.', featured: true },
    ],
    collections: [
        {
            handle: 'new-arrivals',
            name: 'New arrivals',
            description: 'The gear that just landed for the season.',
            type: 'manual',
            featured: true,
            productHandles: ['alpine-hardshell-jacket', 'summit-down-hoody', 'trailhead-38-backpack', 'beacon-400-headlamp'],
        },
        {
            handle: 'best-sellers',
            name: 'Best sellers',
            description: 'The pieces people come back to reorder.',
            type: 'manual',
            featured: true,
            productHandles: ['alpine-hardshell-jacket', 'ridgeline-merino-crew', 'trailhead-38-backpack', 'switchback-trail-socks', 'vault-insulated-bottle'],
        },
        {
            handle: 'layering-system',
            name: 'The layering system',
            description: 'Base, mid and shell — dialled to work together.',
            type: 'manual',
            featured: false,
            productHandles: ['ridgeline-merino-crew', 'summit-down-hoody', 'alpine-hardshell-jacket'],
        },
        {
            handle: 'trail-essentials',
            name: 'Trail essentials',
            description: 'The small stuff no trip should leave without.',
            type: 'manual',
            featured: false,
            productHandles: ['switchback-trail-socks', 'vault-insulated-bottle', 'beacon-400-headlamp', 'fathom-dry-bag', 'trailhead-38-backpack'],
        },
        {
            handle: 'packs-and-carry',
            name: 'Packs & carry',
            description: 'Everything for hauling it in and keeping it dry.',
            type: 'manual',
            featured: false,
            productHandles: ['trailhead-38-backpack', 'fathom-dry-bag', 'ascent-trekking-poles'],
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
        slug: 'how-we-test',
        status: 'published',
        body: {
            title: 'How we test our gear, and why nothing ships until it fails',
            excerpt: 'A spec sheet is a promise. We only make the ones we’ve watched a piece keep — soaked, overloaded and left out in the weather for a season.',
            featuredImage: { $asset: 'post-trail' },
            body: {
                type: 'doc',
                content: [
                    para('Outdoor gear is easy to design on paper and hard to trust in the field. A jacket can hit every waterproofing number in a lab and still wet out at the shoulders in an hour of real rain, because the seams weren’t taped where a pack strap flexes them. So before anything gets a page on this site, it does a season of actual trips — carried by people who will happily tell us it failed.'),
                    h2('We break it on purpose'),
                    para('Every sample goes out overloaded, dropped, dunked and left staked out overnight in whatever weather we can find. We overstuff the packs past their rating, run the shells through wind-driven rain, and freeze the bottles solid to see what cracks. The goal isn’t to prove the gear works — it’s to find the exact point where it stops, then decide whether that point is far enough past what you’ll ever ask of it.'),
                    h2('What survives, ships'),
                    para('If a piece comes back with a failure we can’t fix at the design stage, it doesn’t make the catalogue — full stop. That’s why the range is short: plenty of good ideas didn’t survive the season. What’s left is gear we’ve personally watched take a beating and keep going, which is the only recommendation we think is worth anything.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'how-to-layer',
        status: 'published',
        body: {
            title: 'How to layer for the mountains without overthinking it',
            excerpt: 'Base, mid, shell. Three layers, one job each — here’s the system we actually use, and how to read the weather instead of the forecast.',
            featuredImage: { $asset: 'post-layering' },
            body: {
                type: 'doc',
                content: [
                    para('Staying comfortable outside isn’t about one magic jacket — it’s about a system you can add to and shed as the day changes. Get the three layers right and you carry less, sweat less, and never end up either soaked from the inside or shivering at the summit. Here’s the whole thing, minus the jargon.'),
                    h2('Base, mid, shell'),
                    para('The base layer touches your skin and has one job: move sweat away so you don’t chill when you stop. Merino wins here because it wicks and doesn’t stink. The mid layer traps warmth — a light down or fleece you throw on the moment you stop moving. The shell goes over everything and blocks wind and rain; it isn’t there to keep you warm, it’s there to keep the weather out. Each layer does one thing well, and together they cover almost anything.'),
                    h2('Dress for the walk, not the car park'),
                    para('The classic mistake is bundling up warm at the trailhead and boiling within ten minutes. Start slightly cold — you’ll warm up fast once you’re moving — and adjust before you’re drenched, not after. Vent the shell on the climb, add the mid layer at the top, and keep the base layer dry at all costs. Read your own body, not just the forecast, and the system does the rest.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'pack-for-an-overnight',
        status: 'published',
        body: {
            title: 'How to pack a 38-litre bag for a fast overnight',
            excerpt: 'A trip report and a checklist in one: everything that went in the Trailhead 38 for a one-night traverse, and why it all fit.',
            featuredImage: { $asset: 'post-packing' },
            body: {
                type: 'doc',
                content: [
                    para('People assume you need a 60-litre expedition pack to spend a night out. You don’t. For a fast, light overnight in three-season weather, a well-loaded 38-litre bag carries everything you actually use and nothing you don’t — and it walks a lot nicer on the climb. Here’s exactly what went in for a recent one-night ridge traverse.'),
                    h2('Heavy in the middle, close to the back'),
                    para('The order matters more than the volume. Sleeping bag and spare clothes go in a dry bag at the bottom. The heavy stuff — water, stove, food — sits in the middle and tight against your spine, so the load pulls down through your hips instead of hauling you backwards. The shell, headlamp, map and snacks live in the lid and hipbelt pockets, where you can reach them without stopping. Done right, a full pack feels like part of you, not a sack hanging off your shoulders.'),
                    h2('The overnight checklist'),
                    para('Shelter and sleep: tent or tarp, sleeping bag in a dry bag, pad. Layers: the base-mid-shell system, plus a warm hat and gloves even in summer. Kit: stove, fuel, a pot, a lighter, a full bottle and a way to treat more water. Safety: headlamp, first-aid basics, map and compass, a charged phone. Food for the effort plus one extra meal. That’s a comfortable night out in a 38-litre bag with room to spare — and if it doesn’t fit, that’s usually a sign you’re carrying a want, not a need.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'retail-outdoor-rugged',
    key: 'sparx-retail-outdoor-rugged',
    name: 'Outdoor Gear (Rugged)',
    theme: THEME,
    summary:
        'A complete, working shop for an outdoor & adventure gear outfitter: a real catalogue of hardshells, down insulation, merino base layers, packs, a roll-top dry bag, trail socks, an insulated bottle, a headlamp and trekking poles — with categories, collections, a spec-forward PDP and a fully merchandised home page. Rugged field theme — muted stone-khaki ground, deep forest-green, a blaze-orange accent. Shipped as Ridgeline Supply.',
    tagline: 'A rugged, working storefront for an outdoor gear outfitter.',
    vertical: 'retail',
    industry: 'Outdoor & adventure gear',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 84,
    brand: {
        businessName: 'Ridgeline Supply',
        tagline: 'Built to be used, not looked at.',
    },
    chrome: { navbar: 'brandLeft', footer: 'newsletter', showCta: true },
    seo: {
        home: {
            title: 'Ridgeline Supply — outdoor & adventure gear built to be used',
            description:
                'Ridgeline Supply outfits people who actually go outside — hard-wearing apparel, packs and gear, field-tested every season and backed by a repair-first guarantee. Fewer things, made to last.',
        },
        about: {
            title: 'About Ridgeline Supply',
            description:
                'Why Ridgeline keeps the range small — gear designed by people who use it, tested across a full season, and built to be repaired instead of replaced.',
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
