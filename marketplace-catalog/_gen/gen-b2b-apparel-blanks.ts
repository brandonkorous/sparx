// sparx-b2b-apparel-blanks — a B2B/WHOLESALE site template: a blank-apparel supplier for
// screen-printers, embroiderers and merch makers.
//
// The trade sibling of the retail gold reference (gen-retail-coffee-craft.ts): same harness,
// same 9-page commerce site, same INLINE bespoke theme — but framed for TRADE BUYERS, not
// end consumers. A complete, working wholesale shop the moment it installs: a real catalogue
// of blank garments (heavyweight and ringspun tees, fleece, headwear, bags) sold by the case
// and priced per unit, Color × Size variant grids, categories + collections, a bespoke PDP
// that carries bulk price breaks and net-terms, and a merchandised home page that reads like a
// decorator's supplier. Shipped as Blankstock.
//
// SELF-CONTAINED BY DESIGN — like the retail family, this generator carries its OWN theme
// inline and passes it on the spec (`theme`), so the whole family can be authored in parallel
// without any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-b2b-apparel-blanks.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-b2b-apparel-blanks/**" \
//     "marketplace-catalog/_gen/gen-b2b-apparel-blanks.ts"
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
// A print-shop supply room: a cool slate-tinted paper ground, near-black ink primary for a
// clean catalogue feel, one confident cobalt accent as the single pop of color, under a
// technical grotesk over a workhorse sans. Complete light + dark, AA on every role (the
// blueprint sweep's contrast check is the gate). `secondary` and `accent` stay ≤ ~50% L so
// they read as text on the cool near-white ground.
const THEME = defineTheme({
    name: 'blankstock-trade',
    type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
    shape: { selector: '0.375rem', field: '0.25rem', box: '0.375rem', depth: '0' },
    light: {
        surfaces: ['oklch(98% 0.005 255)', 'oklch(95% 0.008 255)', 'oklch(90% 0.014 255)', 'oklch(20% 0.016 262)'],
        roles: {
            primary: 'oklch(24% 0.02 262)',
            secondary: 'oklch(44% 0.025 258)',
            accent: 'oklch(50% 0.17 258)',
            neutral: 'oklch(24% 0.014 262)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(18% 0.012 262)', 'oklch(15% 0.012 262)', 'oklch(12% 0.012 262)', 'oklch(95% 0.006 255)'],
        roles: {
            primary: 'oklch(94% 0.01 262)',
            secondary: 'oklch(74% 0.025 258)',
            accent: 'oklch(76% 0.15 258)',
            neutral: 'oklch(30% 0.014 262)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; a curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "blanks-hero": "https://images.unsplash.com/photo-1516409590654-e8d51fc2d25c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwc3RhY2tzJTIwYmxhbmt8ZW58MHwwfHx8MTc4NjQxMzY0NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tile-tees": "https://images.unsplash.com/photo-1666358069309-e0d0acb8aacb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8NHx8ZmxhdC1sYXklMjBibGFuayUyMHRlZXN8ZW58MHwwfHx8MTc4NjQxMzY0OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tile-fleece": "https://images.unsplash.com/photo-1620799140408-edc6dcb6d633?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwYmxhbmslMjBwdWxsb3ZlciUyMGhvb2RpZSUyMGNyZXduZWNrJTIwc3dlYXRzaGlydHxlbnwwfDB8fHwxNzg2NDEzMzk0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tile-headwear": "https://images.unsplash.com/photo-1645266729222-17cd32e06fd0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm93JTIwYmxhbmslMjBzdHJ1Y3R1cmVkJTIwY2FwcyUyMHNldmVyYWwlMjBjb2xvdXJzfGVufDB8MHx8fDE3ODY0MTMzOTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "tile-bags": "https://images.unsplash.com/photo-1630381260512-e3fe55c11973?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8YmxhbmslMjBjb3R0b24lMjB0b3RlfGVufDB8MHx8fDE3ODY0MTM2NTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "band-print": "https://images.unsplash.com/photo-1610502778270-c5c6f4c7d575?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2NyZWVuLXByaW50aW5nJTIwcHJlc3MlMjBwdWxsaW5nJTIwaW5rJTIwYWNyb3NzJTIwYmxhbmslMjB0ZWV8ZW58MHwwfHx8MTc4NjQxMzQwMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "band-account": "https://images.unsplash.com/photo-1572501403253-c113f1d6c7fe?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVjb3JhdG9yJTIwcGFja2luZyUyMGZvbGRlZHxlbnwwfDB8fHwxNzg2NDEzNjU0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-heavyweight-tee": "https://images.unsplash.com/photo-1778671394516-8270eac13c42?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwaGVhdnl3ZWlnaHQlMjBibGFuayUyMHRlZXxlbnwwfDB8fHwxNzg2NDEzNDA3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-ringspun-tee": "https://images.unsplash.com/photo-1651761179569-4ba2aa054997?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwcmluZ3NwdW4lMjBibGFuayUyMHRlZXxlbnwwfDB8fHwxNzg2NDEzNDEwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-longsleeve-tee": "https://images.unsplash.com/photo-1693443687750-611ad77f3aba?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwYmxhbmslMjBsb25nLXNsZWV2ZSUyMHRlZXxlbnwwfDB8fHwxNzg2NDEzNDEyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-tank": "https://images.unsplash.com/photo-1656587132121-aaccc57589cf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwYmxhbmslMjB0YW5rJTIwdG9wfGVufDB8MHx8fDE3ODY0MTM0MTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-hoodie": "https://images.unsplash.com/photo-1663247131274-ecbf38ec087c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Zm9sZGVkJTIwYmxhbmslMjBwdWxsb3ZlciUyMGhvb2RpZXxlbnwwfDB8fHwxNzg2NDEzNDE5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-crewneck": "https://images.unsplash.com/photo-1607160199580-1b0c9b736b66?ixid=M3wxMjA3fDB8MXxzZWFyY2h8M3x8Zm9sZGVkJTIwYmxhbmslMjBjcmV3bmVjayUyMHN3ZWF0c2hpcnR8ZW58MHwwfHx8MTc4NjQxMzQyM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-cap": "https://images.unsplash.com/photo-1592367630397-65872fe016e9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmxhbmslMjBzdHJ1Y3R1cmVkJTIwc2l4LXBhbmVsJTIwY2FwfGVufDB8MHx8fDE3ODY0MTM0MjV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-tote": "https://images.unsplash.com/photo-1574365569389-a10d488ca3fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmxhbmslMjBuYXR1cmFsJTIwY290dG9uJTIwdG90ZSUyMGJhZ3xlbnwwfDB8fHwxNzg2NDEzNDI4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-choosing": "https://images.unsplash.com/photo-1542219550-2da790bf52e9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmxhbmslMjB0ZWVzJTIwZmFubmVkJTIwb3V0JTIwY29tcGFyZSUyMGZhYnJpYyUyMHdlaWdodHxlbnwwfDB8fHwxNzg2NDEzNDMxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-methods": "https://images.unsplash.com/photo-1523380744952-b7e00e6e2ffa?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJpbnRlZCUyMHRlZSUyMGVtYnJvaWRlcmVkJTIwY2FwJTIwZHRnJTIwcHJpbnQlMjBzaWRlfGVufDB8MHx8fDE3ODY0MTM0MzR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-sizing": "https://images.unsplash.com/photo-1654570407658-dc06d6ae45c2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8NHx8c2l6ZSUyMHJ1biUyMGJsYW5rJTIwdGVlcyUyMGxhaWQlMjBvdXQlMjBzbWFsbHxlbnwwfDB8fHwxNzg2NDEzNDM3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'blanks-hero', url: src('blanks-hero'), alt: 'Folded stacks of blank tees in graded colors on warehouse shelving' },
    { id: 'tile-tees', url: src('tile-tees'), alt: 'A flat-lay of blank tees in white, black and heather grey' },
    { id: 'tile-fleece', url: src('tile-fleece'), alt: 'A folded blank pullover hoodie and crewneck sweatshirt' },
    { id: 'tile-headwear', url: src('tile-headwear'), alt: 'A row of blank structured caps in several colors' },
    { id: 'tile-bags', url: src('tile-bags'), alt: 'Blank cotton tote bags in natural and black' },
    { id: 'band-print', url: src('band-print'), alt: 'A screen-printing press pulling ink across a blank tee' },
    { id: 'band-account', url: src('band-account'), alt: 'A decorator packing folded blanks into a shipping carton' },
    { id: 'prod-heavyweight-tee', url: src('prod-heavyweight-tee'), alt: 'A folded heavyweight blank tee' },
    { id: 'prod-ringspun-tee', url: src('prod-ringspun-tee'), alt: 'A folded ringspun blank tee' },
    { id: 'prod-longsleeve-tee', url: src('prod-longsleeve-tee'), alt: 'A folded blank long-sleeve tee' },
    { id: 'prod-tank', url: src('prod-tank'), alt: 'A folded blank tank top' },
    { id: 'prod-hoodie', url: src('prod-hoodie'), alt: 'A folded blank pullover hoodie' },
    { id: 'prod-crewneck', url: src('prod-crewneck'), alt: 'A folded blank crewneck sweatshirt' },
    { id: 'prod-cap', url: src('prod-cap'), alt: 'A blank structured six-panel cap' },
    { id: 'prod-tote', url: src('prod-tote'), alt: 'A blank natural cotton tote bag' },
    { id: 'post-choosing', url: src('post-choosing'), alt: 'Blank tees fanned out to compare fabric weight and knit' },
    { id: 'post-methods', url: src('post-methods'), alt: 'A printed tee, an embroidered cap and a DTG print side by side' },
    { id: 'post-sizing', url: src('post-sizing'), alt: 'A size run of blank tees laid out small to extra-large' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-b2b-apparel-blanks: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A full-bleed hero — one warehouse photograph, a grotesk headline and a lead in a solid
 *  readable panel anchored bottom-left, a filled shop CTA + a wholesale-account text link.
 *  Never ink on the photo. */
function hero(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('blanks-hero'), alt: 'Stacks of blank tees on warehouse shelving', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-6xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Blanks that print clean, priced for the run.',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'Blankstock is a wholesale supplier of blank apparel for screen-printers, embroiderers and merch makers. Tees, fleece, headwear and bags — stocked deep in consistent dye lots, sold by the case, and priced per unit so the bigger the run, the lower your cost.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/shop' }, text: 'Shop blanks' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/contact' },
                                            text: 'Open a wholesale account',
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
                        text: 'Shop by category',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'tile-tees', label: 'Tees', href: '/shop', alt: 'Blank tees in white, black and heather' }),
                            categoryTile({ assetId: 'tile-fleece', label: 'Fleece', href: '/shop', alt: 'A blank hoodie and crewneck' }),
                            categoryTile({ assetId: 'tile-headwear', label: 'Headwear', href: '/shop', alt: 'Blank structured caps' }),
                            categoryTile({ assetId: 'tile-bags', label: 'Bags', href: '/shop', alt: 'Blank cotton tote bags' }),
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

/** One wholesale value-prop card — a heading over a line of plain copy, on a bordered panel. */
function tradeValue(o: { heading: string; body: string }): Node {
    return el('div', 'flex flex-col gap-2 rounded-box border border-base-300 bg-base-100 p-6', {
        children: [
            el('h3', 'text-lg font-semibold tracking-tight text-base-content', { text: o.heading }),
            el('p', 'text-base leading-relaxed text-base-content', { text: o.body }),
        ],
    });
}

/** A COPY band on how trade ordering works at Blankstock — the wholesale/decorator promise
 *  (bulk tiers, blanks for every method, fast dispatch, net terms, samples, deep size runs)
 *  as a plain value-prop grid. No photo: this is the section that reassures a shop owner the
 *  supplier is built for production, not for one-off gifts. */
function tradeBand(): Node {
    return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('div', 'flex max-w-2xl flex-col gap-3', {
                        children: [
                            el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                                text: 'Built for the shop floor',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'Everything here is set up for people who decorate for a living — priced by the case, stocked to reorder, and shipped fast enough to keep a press schedule moving.',
                            }),
                        ],
                    }),
                    el('div', 'grid grid-cols-1 gap-4 @md:grid-cols-2 @3xl:grid-cols-3 @3xl:gap-6', {
                        children: [
                            tradeValue({
                                heading: 'Bulk pricing tiers',
                                body: 'Unit price steps down at 24, 72 and 144. Quote the run, not the piece — the bigger the order, the lower the cost per shirt.',
                            }),
                            tradeValue({
                                heading: 'Blanks for every method',
                                body: 'Smooth, tight-knit faces that hold screenprint, embroidery and DTG cleanly, so ink lays flat and stitches sit crisp without fighting the fabric.',
                            }),
                            tradeValue({
                                heading: 'Fast dispatch',
                                body: 'In-stock blanks ship the same or next business day. Your press schedule never waits on us to cut a box.',
                            }),
                            tradeValue({
                                heading: 'Net-30 for approved trade',
                                body: 'Open a wholesale account, get approved once, and order on terms — buy now, pay in 30, reorder without re-quoting.',
                            }),
                            tradeValue({
                                heading: 'Samples before the case',
                                body: 'Order singles at unit price to check hand-feel, fit and how a blank takes your print before you commit to a full run.',
                            }),
                            tradeValue({
                                heading: 'Deep, consistent size runs',
                                body: 'Every core style stocked S through 2XL in steady dye lots, so a reorder three months later still matches the first batch.',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [
    hero(),
    categoryTiles(),
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'This season’s blanks' }),
    editorialBand({
        heading: 'A blank is only as good as the print on it',
        lead: 'We stock garments chosen for how they decorate — combed and ring-spun cottons with a tight, even face, side-seamed bodies that lie flat on the platen, and set-in collars that survive a wash. If a blank fights the press, it doesn’t earn a spot on the shelf.',
        assetId: 'band-print',
        cta: 'Read: choosing the right blank',
        href: '/blog/how-to-choose-a-blank',
        alt: 'A screen-printing press pulling ink across a blank tee',
    }),
    tradeBand(),
    productsBlock({ source: 'commerce.category.tees', layout: 'carousel', heading: 'Tees & tops' }),
    editorialBand({
        heading: 'Open a wholesale account',
        lead: 'Tell us about your shop and we’ll set you up with trade pricing, net-30 terms once you’re approved, and a rep who knows blanks. No membership fee, no minimum to start — just better pricing the more you run.',
        assetId: 'band-account',
        cta: 'Apply for trade pricing',
        href: '/contact',
        alt: 'A decorator packing folded blanks into a shipping carton',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image. Right: the buy column (brand label, title, per-unit price,
 *  low-stock, description, add-to-cart, a static "Trade pricing & bulk tiers" note, and policy
 *  links). Framed for a trade buyer ordering by the case, not a consumer buying one. */
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
                                        text: 'Blankstock',
                                    }),
                                    pdpTitle('h1', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl'),
                                    el('div', 'flex items-baseline gap-3', {
                                        children: [
                                            pdpPriceRow({
                                                priceClass: 'text-2xl font-semibold text-base-content',
                                                compareClass: 'text-lg text-secondary line-through',
                                                rowClass: 'flex items-baseline gap-4',
                                            }),
                                            el('span', 'text-sm font-medium text-secondary', { text: 'per unit · sold in cases of 24' }),
                                        ],
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
                                    el('h2', 'text-sm font-semibold uppercase tracking-widest text-secondary', { text: 'Trade pricing & bulk tiers' }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Priced per unit and sold by the case. Unit price steps down at 24, 72 and 144 pieces — mix sizes within a style to hit the next tier. Every garment ships blank and ready to decorate for screenprint, embroidery or DTG.',
                                    }),
                                    el('p', 'text-base leading-relaxed text-base-content', {
                                        text: 'Approved wholesale accounts order on net-30 terms. Not sure of the hand-feel? Order a single at unit price as a sample before you commit to the run.',
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
        'Shop blanks',
        'The full stock — tees, fleece, headwear and bags, all sold by the case and priced per unit. Filter by category or color, or sort by price; every style is blank and ready to screenprint, embroider or DTG.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead(
        'Collections',
        'Blanks grouped the way a shop actually orders — this season’s new stock, the best-selling core styles, tees and tops, fleece by weight, and a print-ready starter kit for a first run.'
    ),
];
const SEARCH: Node[] = [
    pageMasthead('Search Blankstock', 'Looking for a style, a weight, a color or a size run? Search the whole catalogue and the print guides below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your order' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Mix sizes within a style to reach the next price tier — the discount applies at 24, 72 and 144 units. Approved wholesale accounts check out on net-30 terms; new to Blankstock? Open an account and we’ll get you set up.',
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
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The print desk' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Straight-talking guides from people who stock blanks for a living — choosing the right garment, matching a blank to your print method, and getting a size run right the first time.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Blankstock' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Blankstock started in the back of a print shop, tired of blanks that arrived in mismatched dye lots and sizes that ran a shirt short. We built the supplier we wished we had: a tight catalogue of garments chosen for how they decorate, stocked deep enough to reorder, and priced so a growing shop actually makes money on the run.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We carry fewer styles on purpose. Every tee, hoodie, cap and bag on the shelf earned its place on the press — smooth faces that take ink and thread cleanly, side-seamed bodies that lie flat, and collars and cuffs that survive an industrial wash. No mystery goods, no surprise substitutions.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Order by the case, pay per unit, and pay on net-30 once you’re approved. We ship fast, we answer the phone, and we treat your deadline like ours — because when your order lands late, your customer’s does too.',
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
        heading: 'Open a wholesale account',
        intro: 'Tell us about your shop — what you print, roughly how much you run, and what you’re looking for. We’ll set you up with trade pricing, net-30 terms once you’re approved, and a rep who knows blanks. No membership fee, no minimum to start.',
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

// Apparel sizes, and the small 2XL upcharge trade buyers expect (extended sizes cost more
// fabric, so they price a step up — priced per unit, applied only on the 2XL row).
const SIZES = ['S', 'M', 'L', 'XL', '2XL'] as const;
const SIZE_CODE: Record<(typeof SIZES)[number], string> = { S: 'S', M: 'M', L: 'L', XL: 'XL', '2XL': '2XL' };
const XL2_UPCHARGE = 2; // dollars per unit on 2XL

// Named color codes for SKU building — a stable code per color so a reorder resolves the
// same variant. Kept broad enough to cover every garment on the shelf.
const COLOR_CODE: Record<string, string> = {
    White: 'WHT',
    Black: 'BLK',
    'Heather Grey': 'HGR',
    Navy: 'NVY',
    Sand: 'SND',
    'Forest Green': 'FST',
    Maroon: 'MRN',
    Khaki: 'KHK',
    Natural: 'NAT',
    'Royal Blue': 'RYL',
};

const swatch = (colors: string[]): OptionDecl => ({
    name: 'Color',
    displayType: 'swatch',
    values: colors.map((value) => ({ value })),
});
const sizeOption = (): OptionDecl => ({
    name: 'Size',
    displayType: 'dropdown',
    values: SIZES.map((value) => ({ value })),
});

/** A garment sold Color × Size — the standard blank. Builds the full variant grid (one SKU
 *  per color/size), per-unit priced with a 2XL upcharge, the first the default. */
const garment = (opts: {
    handle: string;
    title: string;
    description: string;
    price: number;
    sku: string;
    productType: string;
    colors: string[];
    categories: string[];
    collections: string[];
    tags: string[];
    asset: string;
    seoTitle: string;
    seoDescription: string;
}): Product => {
    const variants: Variant[] = [];
    let first = true;
    for (const color of opts.colors) {
        for (const size of SIZES) {
            const unit = opts.price + (size === '2XL' ? XL2_UPCHARGE : 0);
            variants.push({
                sku: `${opts.sku}-${COLOR_CODE[color] ?? 'CLR'}-${SIZE_CODE[size]}`,
                priceCents: money(unit),
                ...(first ? { isDefault: true as const } : {}),
                inventoryPolicy: 'continue',
                optionValues: { Color: color, Size: size },
            });
            first = false;
        }
    }
    return {
        handle: opts.handle,
        title: opts.title,
        description: opts.description,
        status: 'active',
        productType: opts.productType,
        vendor: 'Blankstock',
        tags: opts.tags,
        categoryHandles: opts.categories,
        collectionHandles: opts.collections,
        seoTitle: opts.seoTitle,
        seoDescription: opts.seoDescription,
        options: [swatch(opts.colors), sizeOption()],
        variants,
        images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
    };
};

/** A one-size accessory sold by Color only (headwear, bags) — no size grid, one SKU per
 *  color, the first the default. */
const accessory = (opts: {
    handle: string;
    title: string;
    description: string;
    price: number;
    sku: string;
    productType: string;
    colors: string[];
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
    vendor: 'Blankstock',
    tags: opts.tags,
    categoryHandles: opts.categories,
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    options: [swatch(opts.colors)],
    variants: opts.colors.map((color, i) => ({
        sku: `${opts.sku}-${COLOR_CODE[color] ?? 'CLR'}`,
        priceCents: money(opts.price),
        ...(i === 0 ? { isDefault: true as const } : {}),
        inventoryPolicy: 'continue' as const,
        optionValues: { Color: color },
    })),
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.title }],
});

const TEE_COLORS = ['White', 'Black', 'Heather Grey', 'Navy', 'Sand'];
const FLEECE_COLORS = ['Black', 'Heather Grey', 'Navy', 'Maroon'];

const PRODUCTS: Product[] = [
    garment({
        handle: 'heavyweight-tee',
        title: 'Heavyweight Tee',
        description:
            'A 6.0 oz ring-spun cotton tee with real body — the blank for retail-quality merch, heavy prints and anything that has to feel like more than a promo shirt. Side-seamed, shoulder-taped, with a tight, smooth face that lays ink down flat.',
        price: 6.5,
        sku: 'BLK-HWT',
        productType: 'T-shirt',
        colors: TEE_COLORS,
        categories: ['tees'],
        collections: ['best-sellers', 'core-tees', 'print-ready-kit'],
        tags: ['tee', 'heavyweight', '6oz', 'ring-spun', 'screenprint'],
        asset: 'prod-heavyweight-tee',
        seoTitle: 'Heavyweight Tee — 6.0 oz blank for decorators | Blankstock',
        seoDescription: 'A 6.0 oz ring-spun, side-seamed blank tee built for retail-quality prints. Sold by the case, priced per unit.',
    }),
    garment({
        handle: 'ringspun-tee',
        title: 'Ringspun Tee',
        description:
            'A 4.3 oz combed ring-spun tee — soft, light and fashion-fit, the everyday blank for fine-line prints and DTG. Thinner than the heavyweight without going sheer, with a smooth face that holds detail. The volume workhorse of the shelf.',
        price: 4.75,
        sku: 'BLK-RST',
        productType: 'T-shirt',
        colors: TEE_COLORS,
        categories: ['tees'],
        collections: ['new-blanks', 'core-tees'],
        tags: ['tee', 'ringspun', '4.3oz', 'dtg', 'fashion-fit'],
        asset: 'prod-ringspun-tee',
        seoTitle: 'Ringspun Tee — 4.3 oz soft blank for DTG & fine prints | Blankstock',
        seoDescription: 'A soft 4.3 oz combed ring-spun blank tee, fashion-fit, ideal for DTG and fine-line prints. Priced per unit.',
    }),
    garment({
        handle: 'long-sleeve-tee',
        title: 'Long-Sleeve Tee',
        description:
            'A 5.5 oz long-sleeve tee with rib cuffs that hold their shape through a wash — a print surface front, back and down both sleeves. Side-seamed and set-in, the same clean face as the heavyweight for full-coverage jobs.',
        price: 8.5,
        sku: 'BLK-LST',
        productType: 'T-shirt',
        colors: ['White', 'Black', 'Heather Grey', 'Navy'],
        categories: ['tees'],
        collections: ['core-tees'],
        tags: ['tee', 'long-sleeve', '5.5oz', 'ring-spun'],
        asset: 'prod-longsleeve-tee',
        seoTitle: 'Long-Sleeve Tee — 5.5 oz blank | Blankstock',
        seoDescription: 'A 5.5 oz side-seamed long-sleeve blank with rib cuffs and a clean print face front, back and sleeves.',
    }),
    garment({
        handle: 'tank-top',
        title: 'Tank Top',
        description:
            'A 4.2 oz ring-spun tank with a clean, deep armhole and bound neck and straps — the summer-drop and gym blank. Smooth face for a crisp front print, side-seamed so it sits flat on the platen.',
        price: 5.25,
        sku: 'BLK-TNK',
        productType: 'Tank top',
        colors: ['White', 'Black', 'Heather Grey', 'Navy'],
        categories: ['tees'],
        collections: ['new-blanks', 'core-tees'],
        tags: ['tank', '4.2oz', 'ring-spun', 'summer'],
        asset: 'prod-tank',
        seoTitle: 'Tank Top — 4.2 oz ring-spun blank | Blankstock',
        seoDescription: 'A 4.2 oz side-seamed ring-spun blank tank with bound neck and straps — the summer and gym blank.',
    }),
    garment({
        handle: 'pullover-hoodie',
        title: 'Pullover Hoodie',
        description:
            'An 8.5 oz fleece pullover hoodie — brushed inside, dense enough for a heavy front print, with a double-lined hood, split kangaroo pocket and rib cuffs and hem. The blank that carries a whole winter drop.',
        price: 18,
        sku: 'BLK-HOOD',
        productType: 'Hoodie',
        colors: FLEECE_COLORS,
        categories: ['fleece'],
        collections: ['best-sellers', 'new-blanks', 'fleece-weights', 'print-ready-kit'],
        tags: ['hoodie', 'fleece', '8.5oz', 'pullover'],
        asset: 'prod-hoodie',
        seoTitle: 'Pullover Hoodie — 8.5 oz fleece blank | Blankstock',
        seoDescription: 'An 8.5 oz brushed-fleece pullover hoodie blank with a double-lined hood — built for heavy front prints.',
    }),
    garment({
        handle: 'crewneck-sweatshirt',
        title: 'Crewneck Sweatshirt',
        description:
            'An 8.0 oz fleece crewneck — the clean-canvas fleece, no hood, no pocket, just a smooth brushed-back panel front and back for embroidery or a big print. Set-in sleeves, rib collar, cuffs and hem that keep their shape.',
        price: 15,
        sku: 'BLK-CREW',
        productType: 'Sweatshirt',
        colors: FLEECE_COLORS,
        categories: ['fleece'],
        collections: ['fleece-weights'],
        tags: ['crewneck', 'fleece', '8oz', 'embroidery'],
        asset: 'prod-crewneck',
        seoTitle: 'Crewneck Sweatshirt — 8.0 oz fleece blank | Blankstock',
        seoDescription: 'An 8.0 oz brushed-fleece crewneck blank — a clean front and back panel for embroidery or a big print.',
    }),
    accessory({
        handle: 'structured-cap',
        title: 'Structured Cap',
        description:
            'A structured six-panel cap with a mid-profile crown that stands up for a clean embroidery face, a pre-curved visor and an adjustable snap back that fits one size to most. The headwear blank that finishes a merch line.',
        price: 7.5,
        sku: 'BLK-CAP',
        productType: 'Headwear',
        colors: ['Black', 'Navy', 'Khaki', 'White'],
        categories: ['headwear'],
        collections: ['new-blanks', 'best-sellers', 'headwear-bags'],
        tags: ['cap', 'headwear', 'structured', 'embroidery', 'snapback'],
        asset: 'prod-cap',
        seoTitle: 'Structured Cap — six-panel blank for embroidery | Blankstock',
        seoDescription: 'A structured mid-profile six-panel blank cap with a snap back — a clean, firm face for embroidery.',
    }),
    accessory({
        handle: 'cotton-tote',
        title: 'Cotton Tote',
        description:
            'A 6 oz cotton canvas tote with reinforced handles and a flat, boxy front — a large, forgiving print area for a one-color logo or a full-bleed job. The add-on blank that lifts an order value and moves at events.',
        price: 4,
        sku: 'BLK-TOTE',
        productType: 'Bag',
        colors: ['Natural', 'Black'],
        categories: ['bags'],
        collections: ['new-blanks', 'headwear-bags', 'print-ready-kit'],
        tags: ['tote', 'bag', 'canvas', '6oz'],
        asset: 'prod-tote',
        seoTitle: 'Cotton Tote — 6 oz canvas blank | Blankstock',
        seoDescription: 'A 6 oz cotton canvas blank tote with reinforced handles and a large flat print area. Priced per unit.',
    }),
];

const COMMERCE = {
    categories: [
        { handle: 'tees', name: 'Tees', description: 'Short- and long-sleeve tees and tanks.', featured: true },
        { handle: 'fleece', name: 'Fleece', description: 'Hoodies and crewneck sweatshirts.', featured: true },
        { handle: 'headwear', name: 'Headwear', description: 'Structured and unstructured caps.', featured: true },
        { handle: 'bags', name: 'Bags', description: 'Canvas totes and carriers.', featured: true },
    ],
    collections: [
        {
            handle: 'new-blanks',
            name: 'New this season',
            description: 'The latest stock added to the catalogue.',
            type: 'manual',
            featured: true,
            productHandles: ['ringspun-tee', 'tank-top', 'pullover-hoodie', 'structured-cap', 'cotton-tote'],
        },
        {
            handle: 'best-sellers',
            name: 'Best sellers',
            description: 'The core blanks shops reorder most.',
            type: 'manual',
            featured: true,
            productHandles: ['heavyweight-tee', 'pullover-hoodie', 'structured-cap'],
        },
        {
            handle: 'core-tees',
            name: 'Core tees',
            description: 'The everyday tee and tank program.',
            type: 'manual',
            featured: false,
            productHandles: ['heavyweight-tee', 'ringspun-tee', 'long-sleeve-tee', 'tank-top'],
        },
        {
            handle: 'fleece-weights',
            name: 'Fleece',
            description: 'Hoodies and crewnecks by weight.',
            type: 'manual',
            featured: false,
            productHandles: ['pullover-hoodie', 'crewneck-sweatshirt'],
        },
        {
            handle: 'headwear-bags',
            name: 'Headwear & bags',
            description: 'The finishing pieces for a merch line.',
            type: 'manual',
            featured: false,
            productHandles: ['structured-cap', 'cotton-tote'],
        },
        {
            handle: 'print-ready-kit',
            name: 'Print-ready starter kit',
            description: 'A tee, a hoodie and a tote to start a first run.',
            type: 'manual',
            featured: false,
            productHandles: ['heavyweight-tee', 'pullover-hoodie', 'cotton-tote'],
        },
    ],
    products: PRODUCTS,
};

// ── Content (the print desk) ─────────────────────────────────────────────────────────

const para = (text: string) => ({ type: 'paragraph', content: [{ type: 'text', text }] });
const h2 = (text: string) => ({ type: 'heading', attrs: { level: 2 }, content: [{ type: 'text', text }] });

const CONTENT = [
    {
        typeKey: 'blog_post',
        slug: 'how-to-choose-a-blank',
        status: 'published',
        body: {
            title: 'How to choose the right blank',
            excerpt: 'Weight, knit and fit decide more about how a job turns out than the print does. Here’s how to read a blank before you order the case.',
            featuredImage: { $asset: 'post-choosing' },
            body: {
                type: 'doc',
                content: [
                    para('A blank is the ninety percent of a decorated garment you don’t print. Get it right and the artwork does what you drew; get it wrong and the best print in the world sits on a shirt nobody wants to wear twice. Three things decide it: weight, knit and fit.'),
                    h2('Weight: what the shirt feels like'),
                    para('Fabric weight is measured in ounces per square yard, and it’s the fastest read on a blank. A 4.2–4.5 oz tee is soft, light and fashion-fit — great for DTG and fine-line prints, less forgiving of a heavy plastisol slab. A 5.5–6.0 oz tee has body and opacity, hides the platen, and reads as retail quality. Fleece runs 8.0 oz and up; the higher the number, the denser the hand and the better it carries a big front print.'),
                    h2('Knit and face: how it takes ink'),
                    para('Ring-spun and combed cotton have a tighter, smoother face than open-end (carded) cotton, so ink lays flat and edges stay crisp. That smoothness is what lets a halftone or a small logo hold detail. For embroidery, you want a firm, stable panel — a structured cap crown or a crewneck back — so the stitches don’t pucker the fabric.'),
                    h2('Fit: who it’s for'),
                    para('Fit is the quiet decider of reorders. A boxier, side-seamed classic fit suits workwear and events; a slimmer fashion fit suits retail drops and a younger crowd. Whatever you pick, order it in a consistent dye lot and a full size run — a program that looks sharp in medium and runs a shirt short in 2XL is a program that generates returns.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'matching-blanks-to-print-methods',
        status: 'published',
        body: {
            title: 'Matching a blank to your print method',
            excerpt: 'Screenprint, embroidery and DTG each want something different from the garment. Pick the blank for the method, not the other way around.',
            featuredImage: { $asset: 'post-methods' },
            body: {
                type: 'doc',
                content: [
                    para('The same blank does not print equally well every way. The method you’re running should steer which garment goes on the order — here’s what each one wants.'),
                    h2('Screenprint wants a smooth, opaque face'),
                    para('Plastisol and water-based inks sit best on a tight, ring-spun face with enough weight to hide the platen behind it. A 5.5–6.0 oz tee is the safe default for multi-color and heavy coverage; lighter blanks work for one- and two-color jobs but show the platen and can grin through on a stretch. Side-seamed bodies lie flatter on the pallet, which keeps registration honest across a run.'),
                    h2('Embroidery wants a firm, stable panel'),
                    para('Stitches need something to bite into that won’t pucker. Structured cap crowns, crewneck backs and the dense panel of a heavier fleece all hold a design flat with the right backing. Avoid thin, stretchy jersey for anything but the smallest left-chest — a large stitch count on a light tee will draw the fabric in no matter how well it’s hooped.'),
                    h2('DTG wants soft, high-cotton and light-to-mid weight'),
                    para('Direct-to-garment ink bonds to cotton fibres, so the higher the cotton content and the smoother the face, the sharper the result. A combed ring-spun 4.3 oz tee is the classic DTG blank — soft enough for retail, smooth enough to hold photographic detail, light enough to dry fast. Save the heaviest fleece for screenprint or embroidery; DTG on a thick brushed back fights you.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'getting-a-size-run-right',
        status: 'published',
        body: {
            title: 'Getting a size run right the first time',
            excerpt: 'Under-order the middle and you’re short before the drop ends; over-order the ends and you’re sitting on 2XLs. Here’s how to break a run.',
            featuredImage: { $asset: 'post-sizing' },
            body: {
                type: 'doc',
                content: [
                    para('Ordering the right quantity of a shirt is easy. Ordering the right spread of sizes is where a run makes or loses money — buy the wrong shape and you’re either back-ordering mediums mid-drop or eating a stack of 2XLs at the end.'),
                    h2('Start from a real curve, not an even split'),
                    para('Sizes don’t sell evenly, so don’t order them evenly. A common starting curve for a general audience is roughly 1 : 2 : 3 : 2 : 1 across S–M–L–XL–2XL — the middle sizes carry the run. Skew it larger for workwear and an older crowd, smaller and slimmer for a fashion or youth drop. Whatever you pick, write it down: your reorder curve is only useful if you can compare it to what actually sold.'),
                    h2('Mind the extended-size upcharge'),
                    para('2XL and up cost more because they use more fabric, and that shows up as a per-unit upcharge. Price it into the job from the start rather than discovering it at invoice — and remember you can mix sizes within a style to hit the next bulk tier, so a split of S–2XL still counts toward the 72- or 144-piece break.'),
                    h2('Keep dye lots consistent for reorders'),
                    para('If a design sells and you reorder, you want the second batch to match the first on the shelf. Ordering from deep, steady stock in the same colorway keeps a black looking like the same black three months later — the difference between a clean reorder and a customer asking why the new shirts look off.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'b2b-apparel-blanks',
    key: 'sparx-b2b-apparel-blanks',
    name: 'Blank Apparel (Wholesale)',
    theme: THEME,
    summary:
        'A complete, working wholesale shop for a blank-apparel supplier: a real catalogue of blank tees, fleece, headwear and bags sold by the case and priced per unit, with Color × Size variant grids, categories, collections, a bespoke trade PDP carrying bulk price breaks and net-terms, and a merchandised home page pitched at decorators. Clean, catalogue-efficient theme — cool slate paper, near-black ink, one confident cobalt accent. Shipped as Blankstock.',
    tagline: 'A working wholesale storefront for a blank-apparel supplier.',
    vertical: 'b2b',
    industry: 'Wholesale blank apparel',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 86,
    brand: {
        businessName: 'Blankstock',
        tagline: 'Blanks that print clean, priced for the run.',
    },
    chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
    seo: {
        home: {
            title: 'Blankstock — wholesale blank apparel for decorators',
            description:
                'Blankstock is a wholesale supplier of blank tees, fleece, headwear and bags for screen-printers, embroiderers and merch makers. Sold by the case, priced per unit, net-30 for approved trade.',
        },
        about: {
            title: 'About Blankstock',
            description:
                'The blank-apparel supplier a print shop built for itself — a tight catalogue chosen for how it decorates, stocked deep, priced by the run, shipped fast.',
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
