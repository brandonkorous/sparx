// sparx-retail-stationery-playful — a RETAIL/COMMERCE site template: a bright, playful
// stationery & gifts shop.
//
// The loud, joyful counterpart to the restrained editorial paper shop (Margin & Co.). A
// complete, working shop the moment it installs — a real catalogue (color-pop notebooks in
// four colors, a gel-pen set, sticker packs, an enamel pin, a desk calendar, greeting cards,
// washi tape, a sticky-note cube and a fun gift bundle), categories + collections, a bespoke
// PDP, and the full 9-page commerce site (home merchandising → shop → collections → cart →
// search → journal → about → contact), dressed in an INLINE bespoke theme (a soft lemon
// ground, a punchy bubblegum-pink primary, a grape-purple pop accent and a deep-teal support,
// under a rounded characterful Fredoka display over friendly Nunito). Shipped as Pencil Club.
//
// SELF-CONTAINED BY DESIGN. Like the rest of the retail family it carries its OWN theme inline
// and passes it on the spec (`theme`), so the whole family can be authored in parallel without
// any two generators contending on a shared `*-themes.ts` registry. The shared
// `template-sites/harness.ts` uses `spec.theme` verbatim when present.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `template-sites/harness.ts`; the PDP's data plumbing lives in the shared
// `template-sites/pdp.ts` kit. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-retail-stationery-playful.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-retail-stationery-playful/**" \
//     "marketplace-catalog/_gen/gen-retail-stationery-playful.ts"
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
// A joyful desk shop: a soft LEMON ground (a page that reads as sunshine, not white), a
// punchy bubblegum-PINK primary, a GRAPE-purple pop accent and a deep-TEAL support — a
// tri-tone play, loud on purpose. A rounded, characterful Fredoka display over friendly
// Nunito, generous corners, softly lifted. Complete light + dark, AA on every role (the
// blueprint sweep's contrast check is the gate). `secondary` (teal) and `accent` (grape)
// both stay dark on the light ground (≤ ~48% L) so the uppercase labels and the text links
// they paint read as saturated ink, never as a pale wash.
const THEME = defineTheme({
    name: 'pencilclub-pop',
    type: { body: face('Nunito', 'sans-serif'), head: face('Fredoka', 'sans-serif') },
    shape: { selector: '1rem', field: '0.75rem', box: '1.5rem', depth: '1' },
    light: {
        surfaces: ['oklch(97% 0.035 100)', 'oklch(94% 0.05 98)', 'oklch(89% 0.062 95)', 'oklch(24% 0.03 320)'],
        roles: {
            primary: 'oklch(57% 0.21 352)',
            secondary: 'oklch(42% 0.1 215)',
            accent: 'oklch(47% 0.19 300)',
            neutral: 'oklch(26% 0.03 320)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: ['oklch(20% 0.03 320)', 'oklch(17% 0.03 320)', 'oklch(14% 0.03 320)', 'oklch(95% 0.03 100)'],
        roles: {
            primary: 'oklch(74% 0.17 352)',
            secondary: 'oklch(78% 0.1 215)',
            accent: 'oklch(78% 0.16 300)',
            neutral: 'oklch(32% 0.03 320)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
// Empty photo map → picsum fallback so the bundle validates; the curl-driven Unsplash swap
// fills `PHOTO` with verified real imagery before ship. `src(id)` keys the map by asset id.
const PHOTO: Record<string, string> = {
    "pop-hero": "https://images.unsplash.com/photo-1566869112473-77c4fb94359c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwZGVzayUyMGNvdmVyZWQlMjBjb2xvdXJmdWwlMjBub3RlYm9va3MlMjBwZW5zJTIwc3RpY2tlcnN8ZW58MHwwfHx8MTc4NjQwNjMyMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pop-tile-notebooks": "https://images.unsplash.com/photo-1636014692027-852e1e6702ee?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmFuJTIwbm90ZWJvb2tzJTIwc3Vuc2hpbmUlMjBwaW5rJTIwbWludCUyMGdyYXBlfGVufDB8MHx8fDE3ODY0MDYzMjR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pop-tile-pens": "https://images.unsplash.com/photo-1628621317388-6ebde0c18574?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cmFpbmJvdyUyMGdlbCUyMHBlbnN8ZW58MHwwfHx8MTc4NjQwNjUwMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pop-tile-cards": "https://images.unsplash.com/photo-1618143511698-c2ebcdabb11d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwZ3JlZXRpbmclMjBjYXJkcyUyMGZhbm5lZCUyMG91dCUyMGNvbmZldHRpfGVufDB8MHx8fDE3ODY0MDYzMzB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pop-tile-desk": "https://images.unsplash.com/photo-1718815628185-2ff0f9332b32?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hlZXJmdWwlMjBkZXNrJTIwY2FsZW5kYXIlMjBzdGlja3ktbm90ZSUyMGN1YmV8ZW58MHwwfHx8MTc4NjQwNjMzM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pop-band-happy": "https://images.unsplash.com/photo-1623116135497-a90bdc0ddca9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFuZHMlMjBkb29kbGluZyUyMGNvbG91cmZ1bHxlbnwwfDB8fHwxNzg2NDA2NTA0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "pop-band-gift": "https://images.unsplash.com/photo-1513201099705-a9746e1e201f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d3JhcHBlZCUyMHN0YXRpb25lcnklMjBnaWZ0fGVufDB8MHx8fDE3ODY0MDY1MDh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-color-notebook": "https://images.unsplash.com/photo-1523742415007-403d0717913a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sb3VyLXBvcCUyMG5vdGVib29rJTIwYnJpZ2h0JTIwY292ZXJ8ZW58MHwwfHx8MTc4NjQwNjM0MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-pocket-trio": "https://images.unsplash.com/photo-1636014724389-270c4e9c0100?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJpbyUyMHNtYWxsJTIwcG9ja2V0JTIwbm90ZWJvb2tzJTIwYnJpZ2h0JTIwY29sb3Vyc3xlbnwwfDB8fHwxNzg2NDA2MzQ0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-gel-pens": "https://images.unsplash.com/photo-1725953386283-d918bb2ac9bb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwdHdlbHZlJTIwZ2VsJTIwcGVucyUyMHJhaW5ib3clMjBjb2xvdXJzfGVufDB8MHx8fDE3ODY0MDYzNDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-sticker-pack": "https://images.unsplash.com/photo-1625768376503-68d2495d78c5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGFjayUyMHBsYXlmdWwlMjBkaWUtY3V0JTIwc3RpY2tlcnN8ZW58MHwwfHx8MTc4NjQwNjM1MXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-enamel-pin": "https://images.unsplash.com/photo-1526659074712-d13c13df4484?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2hpbnklMjBlbmFtZWwlMjBwaW4lMjBmdW4lMjBzaGFwZXxlbnwwfDB8fHwxNzg2NDA2MzU0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-desk-calendar": "https://images.unsplash.com/photo-1611302457661-d24c21494f2a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3RhbmRpbmclMjBkZXNrJTIwY2FsZW5kYXIlMjBjb2xvdXJmdWwlMjBtb250aHN8ZW58MHwwfHx8MTc4NjQwNjM1N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-greeting-cards": "https://images.unsplash.com/photo-1773833335103-fe9b946709d2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym94ZWQlMjBzZXQlMjBicmlnaHQlMjBncmVldGluZyUyMGNhcmRzJTIwZW52ZWxvcGVzfGVufDB8MHx8fDE3ODY0MDYzNjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-washi": "https://images.unsplash.com/photo-1700085663963-bbe0f7789b4a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2V0JTIwcGF0dGVybmVkJTIwd2FzaGklMjB0YXBlJTIwcm9sbHMlMjBicmlnaHQlMjBjb2xvdXJzfGVufDB8MHx8fDE3ODY0MDYzNjN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-sticky-cube": "https://images.unsplash.com/photo-1683739147678-38173b741ae1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2h1bmt5JTIwY3ViZSUyMHJhaW5ib3clMjBzdGlja3klMjBub3Rlc3xlbnwwfDB8fHwxNzg2NDA2MzY2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "prod-gift-bundle": "https://images.unsplash.com/photo-1769874827773-ccd49c2a0111?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGFwcHktZGVzayUyMGdpZnQlMjBidW5kbGV8ZW58MHwwfHx8MTc4NjQwNjUxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-desk-setup": "https://images.unsplash.com/photo-1663050274062-7eb856773fb2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sb3VyZnVsJTIwd2VsbC1vcmdhbmlzZWQlMjBoYXBweSUyMGRlc2slMjBhYm92ZXxlbnwwfDB8fHwxNzg2NDA2MzcxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-gift-ideas": "https://images.unsplash.com/photo-1608824405605-88c9d2c847e8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxhdC1sYXklMjBzbWFsbCUyMHN0YXRpb25lcnklMjBnaWZ0cyUyMHdyYXBwZWQlMjBicmlnaHQlMjBwYXBlcnxlbnwwfDB8fHwxNzg2NDA2Mzc1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "post-creativity": "https://images.unsplash.com/photo-1579973422569-38c5a46a0b45?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8b3BlbiUyMG5vdGVib29rJTIwZnVsbCUyMGRvb2RsZXMlMjBsaXN0cyUyMGNvbG91cnxlbnwwfDB8fHwxNzg2NDA2Mzc4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'pop-hero', url: src('pop-hero'), alt: 'A bright desk covered in colorful notebooks, pens and stickers' },
    { id: 'pop-tile-notebooks', url: src('pop-tile-notebooks'), alt: 'A fan of notebooks in sunshine, pink, mint and grape' },
    { id: 'pop-tile-pens', url: src('pop-tile-pens'), alt: 'A rainbow row of gel pens and a sheet of stickers' },
    { id: 'pop-tile-cards', url: src('pop-tile-cards'), alt: 'Bright greeting cards fanned out with confetti' },
    { id: 'pop-tile-desk', url: src('pop-tile-desk'), alt: 'A cheerful desk with a calendar and a sticky-note cube' },
    { id: 'pop-band-happy', url: src('pop-band-happy'), alt: 'Hands doodling in a colorful notebook at a sunny desk' },
    { id: 'pop-band-gift', url: src('pop-band-gift'), alt: 'A wrapped stationery gift bundle tied with a bright ribbon' },
    { id: 'prod-color-notebook', url: src('prod-color-notebook'), alt: 'A color-pop notebook with a bright cover' },
    { id: 'prod-pocket-trio', url: src('prod-pocket-trio'), alt: 'A trio of small pocket notebooks in bright colors' },
    { id: 'prod-gel-pens', url: src('prod-gel-pens'), alt: 'A set of twelve gel pens in a rainbow of colors' },
    { id: 'prod-sticker-pack', url: src('prod-sticker-pack'), alt: 'A pack of playful die-cut stickers' },
    { id: 'prod-enamel-pin', url: src('prod-enamel-pin'), alt: 'A shiny enamel pin in a fun shape' },
    { id: 'prod-desk-calendar', url: src('prod-desk-calendar'), alt: 'A standing desk calendar with colorful months' },
    { id: 'prod-greeting-cards', url: src('prod-greeting-cards'), alt: 'A boxed set of bright greeting cards with envelopes' },
    { id: 'prod-washi', url: src('prod-washi'), alt: 'A set of patterned washi tape rolls in bright colors' },
    { id: 'prod-sticky-cube', url: src('prod-sticky-cube'), alt: 'A chunky cube of rainbow sticky notes' },
    { id: 'prod-gift-bundle', url: src('prod-gift-bundle'), alt: 'A happy-desk gift bundle of notebook, pens and stickers' },
    { id: 'post-desk-setup', url: src('post-desk-setup'), alt: 'A colorful, well-organised happy desk from above' },
    { id: 'post-gift-ideas', url: src('post-gift-ideas'), alt: 'A flat-lay of small stationery gifts wrapped in bright paper' },
    { id: 'post-creativity', url: src('post-creativity'), alt: 'An open notebook full of doodles, lists and color' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-retail-stationery-playful: unknown asset "${id}"`);
    return a.url;
};

// ── Home page sections ────────────────────────────────────────────────────────────

/** A loud COLOR-BLOCK hero — a solid bubblegum panel carrying the rounded display headline
 *  and the CTAs beside a bright product photo. Ink on the panel is `primary-content` (silica
 *  resolves it legible), never faded. The whole hero reads as sunshine, not as a white page. */
function hero(): Node {
    return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-16', {
        children: [
            el('div', 'mx-auto grid w-full max-w-6xl items-center gap-8 @3xl:grid-cols-2 @3xl:gap-12', {
                children: [
                    el('div', 'flex flex-col gap-6 rounded-box bg-primary p-8 @3xl:p-12', {
                        children: [
                            el('h1', 'text-5xl font-bold leading-none tracking-tight text-primary-content @3xl:text-7xl', {
                                text: 'Make your desk a happier place.',
                            }),
                            el('p', 'text-lg font-semibold leading-relaxed text-primary-content @3xl:text-xl', {
                                text: 'Pencil Club is a bright little shop of notebooks, pens, stickers and gifts — the colorful stuff that makes writing a list feel like a good time. Loud on purpose, useful on purpose.',
                            }),
                            el('div', 'flex flex-wrap items-center gap-4', {
                                children: [
                                    el('a', 'btn btn-neutral btn-lg', { attrs: { href: '/shop' }, text: 'Shop the fun stuff' }),
                                    el('a', 'text-base font-bold text-primary-content underline underline-offset-4', {
                                        attrs: { href: '/shop/notebooks' },
                                        text: 'Start with a notebook',
                                    }),
                                ],
                            }),
                        ],
                    }),
                    el('img', 'aspect-square w-full rounded-box bg-base-200 object-cover transition hover:-rotate-2 hover:scale-105', {
                        attrs: { src: assetUrl('pop-hero'), alt: 'A bright desk covered in colorful stationery', loading: 'lazy' },
                    }),
                ],
            }),
        ],
    });
}

/** One category tile — a photo in a thick colored frame with a bold label beneath. The whole
 *  tile is a link that tips and grows on hover (playful, named utilities only). */
function categoryTile(o: { assetId: string; label: string; href: string; frame: string; alt: string }): Node {
    return el('a', 'group flex flex-col gap-3', {
        attrs: { href: o.href },
        children: [
            el('img', `aspect-square w-full rounded-box border-4 ${o.frame} bg-base-200 object-cover transition group-hover:-rotate-2 group-hover:scale-105`, {
                attrs: { src: assetUrl(o.assetId), alt: o.alt, loading: 'lazy' },
            }),
            el('span', 'text-center text-lg font-bold text-base-content', { text: o.label }),
        ],
    });
}

function categoryTiles(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('h2', 'text-4xl font-bold tracking-tight text-base-content @3xl:text-5xl', {
                        text: 'Pick your happy place',
                    }),
                    el('div', 'grid grid-cols-2 gap-4 @3xl:grid-cols-4 @3xl:gap-6', {
                        children: [
                            categoryTile({ assetId: 'pop-tile-notebooks', label: 'Notebooks', href: '/shop', frame: 'border-primary', alt: 'A fan of colorful notebooks' }),
                            categoryTile({ assetId: 'pop-tile-pens', label: 'Pens & stickers', href: '/shop', frame: 'border-accent', alt: 'A rainbow of gel pens and stickers' }),
                            categoryTile({ assetId: 'pop-tile-cards', label: 'Cards & gifts', href: '/shop', frame: 'border-secondary', alt: 'Bright greeting cards fanned out' }),
                            categoryTile({ assetId: 'pop-tile-desk', label: 'Desk', href: '/shop', frame: 'border-neutral', alt: 'A cheerful desk calendar and sticky notes' }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** A row of three loud color-block promise cards — the shop's cheerful reasons-to-buy, each
 *  a solid role fill with its own `-content` ink. Color IS the design here: three cards, three
 *  hues, said once. */
function promiseStrip(): Node {
    const card = (bg: string, ink: string, title: string, body: string): Node =>
        el('div', `flex flex-col gap-2 rounded-box ${bg} p-8`, {
            children: [
                el('h3', `text-2xl font-bold ${ink}`, { text: title }),
                el('p', `text-base font-semibold leading-relaxed ${ink}`, { text: body }),
            ],
        });
    return el('section', 'bg-base-100 @container px-6 pb-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-8', {
                children: [
                    el('h2', 'text-4xl font-bold tracking-tight text-base-content @3xl:text-5xl', {
                        text: 'Small things, big grin',
                    }),
                    el('div', 'grid grid-cols-1 gap-4 @3xl:grid-cols-3 @3xl:gap-6', {
                        children: [
                            card('bg-primary', 'text-primary-content', 'Color on tap', 'Everything here comes in a color worth reaching for. Pick a mood, not a boring black one.'),
                            card('bg-secondary', 'text-secondary-content', 'Actually useful', 'Fun to look at, real to use — paper that takes a gel pen, pens that don’t skip, stickers that stick.'),
                            card('bg-accent', 'text-accent-content', 'Made to be given', 'The little gift that always lands. Add a note at checkout and we’ll pop it in the box.'),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** A full-bleed color band — a solid role fill carrying a big rounded headline, a lead and a
 *  link, centred. The loud, cheerful counterpart to a photo band; color does the work. */
function colorBand(o: { heading: string; lead: string; cta: string; href: string; bg: string; ink: string }): Node {
    return el('section', `${o.bg} @container px-6 py-20 @3xl:py-24`, {
        children: [
            el('div', 'mx-auto flex w-full max-w-4xl flex-col items-center gap-5 text-center', {
                children: [
                    el('h2', `text-4xl font-bold leading-none tracking-tight ${o.ink} @3xl:text-6xl`, { text: o.heading }),
                    el('p', `max-w-2xl text-lg font-semibold leading-relaxed ${o.ink} @3xl:text-xl`, { text: o.lead }),
                    el('a', 'btn btn-neutral btn-lg', { attrs: { href: o.href }, text: o.cta }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [
    hero(),
    categoryTiles(),
    promiseStrip(),
    productsBlock({ source: 'commerce.featured', layout: 'carousel', heading: 'Fresh drops' }),
    colorBand({
        heading: 'Writing a list should feel like a treat',
        lead: 'A good notebook and a pen you like turn “ugh, admin” into ten happy minutes. We keep the desk cheerful so the boring stuff gets done — and the fun stuff gets started.',
        cta: 'Read our desk notes',
        href: '/blog/a-happy-desk-in-five-minutes',
        bg: 'bg-accent',
        ink: 'text-accent-content',
    }),
    productsBlock({ source: 'commerce.category.notebooks', layout: 'carousel', heading: 'Notebooks in every color' }),
    colorBand({
        heading: 'The easiest gift you’ll ever give',
        lead: 'Stuck on what to get someone? A bright bundle of notebook, pens and stickers is the small, thoughtful present that never misses. Wrapped, noted, and ready to make someone’s day.',
        cta: 'Shop gifts',
        href: '/collections',
        bg: 'bg-secondary',
        ink: 'text-secondary-content',
    }),
];

// ── Product detail (PDP) ────────────────────────────────────────────────────────────

/** The bespoke buy REGION — authored UNSCOPED; `productPage` wraps it in `repeat('product')`.
 *  Left: the product image (playful hover tilt). Right: the buy column (brand label, title,
 *  price, low-stock, description, add-to-cart, a cheerful shop note, and policy links). */
function pdpBuyRegion(): Node {
    return el('section', 'bg-base-100 @container px-6 py-12 @3xl:py-20', {
        children: [
            el('div', 'mx-auto grid w-full max-w-6xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
                children: [
                    pdpImage('aspect-square w-full rounded-box border-4 border-primary bg-base-200 object-cover transition hover:-rotate-2 hover:scale-105'),
                    el('div', 'flex flex-col gap-6 @3xl:py-4', {
                        children: [
                            el('div', 'flex flex-col gap-4', {
                                children: [
                                    el('p', 'text-sm font-bold uppercase tracking-widest text-secondary', {
                                        text: 'Pencil Club',
                                    }),
                                    pdpTitle('h1', 'text-4xl font-bold leading-none tracking-tight text-base-content @3xl:text-5xl'),
                                    pdpPriceRow({
                                        priceClass: 'text-2xl font-bold text-base-content',
                                        compareClass: 'text-lg text-secondary line-through',
                                        rowClass: 'flex items-baseline gap-4',
                                    }),
                                    pdpStockBadge({
                                        className:
                                            'inline-flex w-fit items-center gap-2 rounded-field bg-accent px-3 py-1 text-xs font-bold uppercase tracking-widest text-accent-content',
                                        label: 'Almost gone',
                                    }),
                                ],
                            }),
                            pdpDescription('text-lg leading-relaxed text-base-content'),
                            addToCartForm(),
                            el('div', 'flex flex-col gap-2 rounded-box bg-secondary p-6', {
                                children: [
                                    el('h2', 'text-sm font-bold uppercase tracking-widest text-secondary-content', { text: 'Packed with a smile' }),
                                    el('p', 'text-base font-semibold leading-relaxed text-secondary-content', {
                                        text: 'Every order is checked by hand, tucked into recycled tissue, and posted within two working days. Sending it as a gift? Add a note at checkout and we’ll write it in and leave the price off.',
                                    }),
                                ],
                            }),
                            pdpPolicyLinks({
                                className:
                                    'flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-base-300 pt-5 text-sm font-bold uppercase tracking-widest text-base-content',
                                linkClass: 'underline underline-offset-4',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const PDP: Node = productPage(pdpBuyRegion(), { relatedHeading: 'Add these to the box' });

// ── Shop / Collections / Cart / Search / Journal framing ─────────────────────────────

function pageMasthead(heading: string, lead: string): Node {
    return el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                        text: heading,
                    }),
                    el('p', 'max-w-2xl text-lg font-semibold leading-relaxed text-base-content', { text: lead }),
                ],
            }),
        ],
    });
}

const SHOP: Node[] = [
    pageMasthead(
        'The whole happy shelf',
        'Every bright thing we make — notebooks in four colors, gel-pen sets, sticker packs and pins, a desk calendar, cards, washi and gift bundles. Filter by category or sort however you like; everything ships within two days, wrapped with a smile.'
    ),
];
const COLLECTIONS: Node[] = [
    pageMasthead(
        'Collections',
        'The shop grouped the way people actually shop — the fresh drops, the desk basics, the color crew, and the gifts that always land. Find your thing, or find one for a friend.'
    ),
];
const SEARCH: Node[] = [
    pageMasthead('Search Pencil Club', 'After a color, a sticker theme or a gift idea? Search the whole shop and the journal below.'),
];
const CART: Node[] = [
    el('section', 'bg-base-100 @container px-6 pt-16 pb-6', {
        children: [
            el('div', 'mx-auto flex w-full max-w-6xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Your cart' }),
                    el('p', 'max-w-2xl text-lg font-semibold leading-relaxed text-base-content', {
                        text: 'Free shipping over $35, gift wrap on request, and a handwritten note if you ask. Changed your mind when it lands? Send it back within 30 days — no fuss, no frowns.',
                    }),
                ],
            }),
        ],
    }),
];
const JOURNAL: Node[] = [
    el('section', 'bg-secondary @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-secondary-content @3xl:text-6xl', { text: 'The Doodle' }),
                    el('p', 'max-w-2xl text-lg font-semibold leading-relaxed text-secondary-content', {
                        text: 'Notes from the shop — how to set up a desk you actually want to sit at, gift ideas that never miss, and little ways to keep a creative habit going. Cheerful, practical, zero snobbery.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Pencil Club' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Pencil Club started with a shoebox of gel pens and a simple hunch: the boring jobs get done faster when the desk is a place you like being. So we made a little shop of the cheerful stuff — colorful notebooks, pens that write like butter, stickers for no reason at all — the things that turn “I have to” into “ooh, I get to”.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Everything here has to pass two tests: it has to make us grin, and it has to actually work. Paper that takes a wet pen without bleeding. Colors that don’t look sad in real life. Stickers that stay stuck. Fun and useful aren’t opposites — the best stationery is both at once, and that’s the only kind we stock.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We’re a small team who pack every order by hand, tuck in a sticker when we can, and post it fast. No mystery “luxury” markups, no throwaway rubbish — just bright, well-made desk things for people who never really stopped loving a fresh notebook.',
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
        heading: 'Say hi!',
        intro: 'A question about a color, a big gift order for the office, or a stockist enquiry? Tell us what you’re after and a real, cheerful human at the shop will write straight back — usually the same day.',
        submitLabel: 'Email the club',
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

const COLOR: OptionDecl = {
    name: 'Color',
    displayType: 'swatch',
    values: [{ value: 'Sunshine' }, { value: 'Bubblegum' }, { value: 'Mint' }, { value: 'Grape' }],
};

/** A notebook, offered in four bright colors — the one thing a Pencil Club notebook is all
 *  about varying on. */
const colorNotebook = (opts: {
    handle: string;
    title: string;
    description: string;
    price: number;
    sku: string;
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
    productType: 'Notebook',
    vendor: 'Pencil Club',
    tags: opts.tags,
    categoryHandles: ['notebooks'],
    collectionHandles: opts.collections,
    seoTitle: opts.seoTitle,
    seoDescription: opts.seoDescription,
    options: [COLOR],
    variants: [
        { sku: `${opts.sku}-SUN`, priceCents: money(opts.price), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Sunshine' } },
        { sku: `${opts.sku}-BUB`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Color: 'Bubblegum' } },
        { sku: `${opts.sku}-MIN`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Color: 'Mint' } },
        { sku: `${opts.sku}-GRP`, priceCents: money(opts.price), inventoryPolicy: 'continue', optionValues: { Color: 'Grape' } },
    ],
    images: [{ assetId: opts.asset, isPrimary: true, alt: opts.alt }],
});

const PRODUCTS: Product[] = [
    colorNotebook({
        handle: 'color-pop-notebook',
        title: 'Color-Pop Notebook',
        description:
            'Our hero notebook — a chunky A5 with a bright, wipe-clean cover and 160 pages of smooth 100gsm dot-grid stock that takes a gel pen or a fountain pen without bleeding through. Lies flat, rounded corners that don’t get bashed, and an elastic in a matching color. The one that makes you want to fill it.',
        price: 16,
        sku: 'PC-NB-A5',
        collections: ['new-drops', 'best-sellers', 'color-crew'],
        tags: ['notebook', 'dot-grid', 'a5', 'colorful'],
        asset: 'prod-color-notebook',
        alt: 'A color-pop A5 notebook with a bright cover',
        seoTitle: 'Color-Pop Notebook — bright A5 dot-grid notebook | Pencil Club',
        seoDescription: 'A chunky A5 dot-grid notebook with a bright wipe-clean cover and smooth 100gsm paper. Sunshine, Bubblegum, Mint or Grape.',
    }),
    colorNotebook({
        handle: 'pocket-notebook-trio',
        title: 'Pocket Notebook Trio',
        description:
            'Three slim pocket notebooks that live in a bag, a pocket or a glovebox — the place a random thought actually gets caught. Forty-eight pages each of the same smooth stock as the big one, in three colors that make them easy to tell apart. Small, cheap enough to actually use, and far too cute to leave in the shop.',
        price: 12,
        sku: 'PC-NB-PKT',
        collections: ['best-sellers', 'color-crew', 'desk-basics'],
        tags: ['notebook', 'pocket', 'set', 'colorful'],
        asset: 'prod-pocket-trio',
        alt: 'A trio of small pocket notebooks in bright colors',
        seoTitle: 'Pocket Notebook Trio — bright pocket notebooks | Pencil Club',
        seoDescription: 'A set of three slim pocket notebooks in bright colors, 48 pages each. Sunshine, Bubblegum, Mint or Grape.',
    }),
    {
        handle: 'gel-pen-set',
        title: 'Gel Pen Set of Twelve',
        description:
            'A dozen gel pens in a rainbow that actually looks like a rainbow — smooth 0.7mm rollers that lay down bold, glossy color and dry fast enough that lefties don’t smudge. No skipping, no scratchy start, no sad muddy shades. The set that turns a to-do list into a small art project.',
        status: 'active',
        productType: 'Pens',
        vendor: 'Pencil Club',
        tags: ['pens', 'gel-pen', 'set', 'colorful'],
        categoryHandles: ['pens-stickers'],
        collectionHandles: ['new-drops', 'best-sellers', 'color-crew'],
        seoTitle: 'Gel Pen Set of Twelve — rainbow gel pens | Pencil Club',
        seoDescription: 'A set of twelve smooth 0.7mm gel pens in bold, fast-drying rainbow colors. No skipping, no smudging.',
        variants: [{ sku: 'PC-PEN-GEL12', priceCents: money(14), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-gel-pens', isPrimary: true, alt: 'A set of twelve rainbow gel pens' }],
    },
    {
        handle: 'sticker-pack',
        title: 'Sticker Pack',
        description:
            'A fat pack of die-cut vinyl stickers for laptops, water bottles, planners and anything that’ll hold still. Waterproof, peel-clean, and just the right amount of silly. Pick a theme and get a mix you’ll actually want to use — no filler, no lame ones you leave on the sheet.',
        status: 'active',
        productType: 'Stickers',
        vendor: 'Pencil Club',
        tags: ['stickers', 'vinyl', 'fun'],
        categoryHandles: ['pens-stickers'],
        collectionHandles: ['new-drops', 'color-crew', 'gift-it'],
        seoTitle: 'Sticker Pack — die-cut vinyl stickers | Pencil Club',
        seoDescription: 'A pack of waterproof die-cut vinyl stickers in a fun mix. Choose Happy Faces, Fruit Salad or Outer Space.',
        options: [
            { name: 'Theme', displayType: 'dropdown', values: [{ value: 'Happy Faces' }, { value: 'Fruit Salad' }, { value: 'Outer Space' }] },
        ],
        variants: [
            { sku: 'PC-STK-FACE', priceCents: money(7), isDefault: true, inventoryPolicy: 'continue', optionValues: { Theme: 'Happy Faces' } },
            { sku: 'PC-STK-FRUIT', priceCents: money(7), inventoryPolicy: 'continue', optionValues: { Theme: 'Fruit Salad' } },
            { sku: 'PC-STK-SPACE', priceCents: money(7), inventoryPolicy: 'continue', optionValues: { Theme: 'Outer Space' } },
        ],
        images: [{ assetId: 'prod-sticker-pack', isPrimary: true, alt: 'A pack of playful die-cut stickers' }],
    },
    {
        handle: 'enamel-pin',
        title: 'Enamel Pin',
        description:
            'A shiny hard-enamel pin for a jacket, a bag or a lanyard — bright color, a proper rubber clutch that won’t bail on you, and a shape that makes people smile in the queue. Tiny, collectible, and the easiest little “I saw this and thought of you” there is.',
        status: 'active',
        productType: 'Pin',
        vendor: 'Pencil Club',
        tags: ['pin', 'enamel', 'gift', 'fun'],
        categoryHandles: ['pens-stickers'],
        collectionHandles: ['new-drops', 'gift-it'],
        seoTitle: 'Enamel Pin — hard-enamel pin | Pencil Club',
        seoDescription: 'A bright hard-enamel pin with a secure rubber clutch. Choose Rainbow, Lucky Star or Little Cloud.',
        options: [
            { name: 'Design', displayType: 'dropdown', values: [{ value: 'Rainbow' }, { value: 'Lucky Star' }, { value: 'Little Cloud' }] },
        ],
        variants: [
            { sku: 'PC-PIN-RBOW', priceCents: money(9), isDefault: true, inventoryPolicy: 'continue', optionValues: { Design: 'Rainbow' } },
            { sku: 'PC-PIN-STAR', priceCents: money(9), inventoryPolicy: 'continue', optionValues: { Design: 'Lucky Star' } },
            { sku: 'PC-PIN-CLOUD', priceCents: money(9), inventoryPolicy: 'continue', optionValues: { Design: 'Little Cloud' } },
        ],
        images: [{ assetId: 'prod-enamel-pin', isPrimary: true, alt: 'A shiny enamel pin in a fun shape' }],
    },
    {
        handle: 'desk-calendar',
        title: 'Standing Desk Calendar',
        description:
            'A cheerful standing calendar that turns the whole year into a bit of color on your desk — one bright, illustrated spread a month, a fold-out easel back that actually stands up, and big date boxes with room to scribble. Undated? No — properly dated, so you can just flip and go.',
        status: 'active',
        productType: 'Calendar',
        vendor: 'Pencil Club',
        tags: ['calendar', 'desk', 'colorful'],
        categoryHandles: ['desk'],
        collectionHandles: ['new-drops', 'desk-basics'],
        seoTitle: 'Standing Desk Calendar — illustrated desk calendar | Pencil Club',
        seoDescription: 'A cheerful standing desk calendar with a bright illustrated spread each month, big date boxes and a fold-out easel back.',
        variants: [{ sku: 'PC-CAL-DESK', priceCents: money(15), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-desk-calendar', isPrimary: true, alt: 'A standing desk calendar with colorful months' }],
    },
    {
        handle: 'sticky-note-cube',
        title: 'Rainbow Sticky-Note Cube',
        description:
            'A chunky brick of five hundred sticky notes in a full rainbow stack — the reminder that’s impossible to lose because it’s the brightest thing on the desk. Sticks firm, peels clean, and doesn’t curl up at the corner. Flag a page, leave a note, build a very small confetti pile. Desk joy, by the block.',
        status: 'active',
        productType: 'Sticky notes',
        vendor: 'Pencil Club',
        tags: ['sticky-notes', 'desk', 'colorful'],
        categoryHandles: ['desk'],
        collectionHandles: ['best-sellers', 'desk-basics', 'color-crew'],
        seoTitle: 'Rainbow Sticky-Note Cube — 500 bright sticky notes | Pencil Club',
        seoDescription: 'A chunky cube of 500 rainbow sticky notes that stick firm and peel clean. The brightest reminder on the desk.',
        variants: [{ sku: 'PC-STK-CUBE', priceCents: money(8), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-sticky-cube', isPrimary: true, alt: 'A chunky cube of rainbow sticky notes' }],
    },
    {
        handle: 'greeting-card-set',
        title: 'Greeting Card Set of Eight',
        description:
            'Eight bright, cheerful cards for the moments that don’t come with a printed line — a well-done, a thinking-of-you, a happy-everything. Blank inside so the words are yours, printed on thick recycled board with a color that pops, and eight matching envelopes. The box to keep in a drawer for when you need one, fast.',
        status: 'active',
        productType: 'Cards',
        vendor: 'Pencil Club',
        tags: ['cards', 'greeting', 'gift', 'set'],
        categoryHandles: ['cards-gifts'],
        collectionHandles: ['gift-it', 'color-crew'],
        seoTitle: 'Greeting Card Set of Eight — bright blank cards | Pencil Club',
        seoDescription: 'A boxed set of eight bright, blank greeting cards on thick recycled board with matching envelopes. For every everyday occasion.',
        variants: [{ sku: 'PC-CARD-SET8', priceCents: money(16), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-greeting-cards', isPrimary: true, alt: 'A boxed set of bright greeting cards with envelopes' }],
    },
    {
        handle: 'washi-tape-set',
        title: 'Washi Tape Set',
        description:
            'Five rolls of low-tack Japanese paper tape for the small joys of a page — flagging a spread, taping in a ticket, or just brightening a boring corner. Writes over cleanly, tears by hand, peels off without a fight. Sold as a set that genuinely goes together, in colors that play nicely with everything else here.',
        status: 'active',
        productType: 'Accessory',
        vendor: 'Pencil Club',
        tags: ['washi', 'tape', 'set', 'colorful'],
        categoryHandles: ['cards-gifts'],
        collectionHandles: ['color-crew', 'gift-it'],
        seoTitle: 'Washi Tape Set — Japanese paper tape | Pencil Club',
        seoDescription: 'A set of five low-tack washi paper tapes that write over cleanly, tear by hand and peel off without a fight. Brights, Pastels or Mono.',
        options: [
            { name: 'Color', displayType: 'swatch', values: [{ value: 'Brights' }, { value: 'Pastels' }, { value: 'Mono' }] },
        ],
        variants: [
            { sku: 'PC-WASHI-BRT', priceCents: money(11), isDefault: true, inventoryPolicy: 'continue', optionValues: { Color: 'Brights' } },
            { sku: 'PC-WASHI-PAS', priceCents: money(11), inventoryPolicy: 'continue', optionValues: { Color: 'Pastels' } },
            { sku: 'PC-WASHI-MON', priceCents: money(11), inventoryPolicy: 'continue', optionValues: { Color: 'Mono' } },
        ],
        images: [{ assetId: 'prod-washi', isPrimary: true, alt: 'A set of patterned washi tape rolls in bright colors' }],
    },
    {
        handle: 'happy-desk-bundle',
        title: 'The Happy Desk Bundle',
        description:
            'The whole cheer-up in one box — a Color-Pop Notebook, the twelve gel pens, a sticker pack and a rainbow sticky-note cube, wrapped and ready to give. It’s what we reach for when someone “just needs a little something”: everything to make a desk fun, and nothing to figure out. Add a note at checkout and we’ll write it in.',
        status: 'active',
        productType: 'Gift set',
        vendor: 'Pencil Club',
        tags: ['gift', 'bundle', 'set', 'colorful'],
        categoryHandles: ['cards-gifts'],
        collectionHandles: ['gift-it', 'best-sellers', 'new-drops'],
        seoTitle: 'The Happy Desk Bundle — notebook, pens, stickers gift set | Pencil Club',
        seoDescription: 'A boxed gift set: a Color-Pop Notebook, twelve gel pens, a sticker pack and a rainbow sticky-note cube, wrapped and ready to give.',
        variants: [{ sku: 'PC-GIFT-DESK', priceCents: money(42), isDefault: true, inventoryPolicy: 'continue' }],
        images: [{ assetId: 'prod-gift-bundle', isPrimary: true, alt: 'A happy-desk gift bundle of notebook, pens and stickers' }],
    },
];

const COMMERCE = {
    categories: [
        { handle: 'notebooks', name: 'Notebooks', description: 'Bright notebooks in every color.', featured: true },
        { handle: 'pens-stickers', name: 'Pens & stickers', description: 'Gel pens, stickers and pins.', featured: true },
        { handle: 'cards-gifts', name: 'Cards & gifts', description: 'Cards, washi and gift bundles.', featured: true },
        { handle: 'desk', name: 'Desk', description: 'Calendars, sticky notes and desk joy.', featured: true },
    ],
    collections: [
        {
            handle: 'new-drops',
            name: 'Fresh drops',
            description: 'The newest bright things to land.',
            type: 'manual',
            featured: true,
            productHandles: ['color-pop-notebook', 'gel-pen-set', 'sticker-pack', 'enamel-pin', 'desk-calendar'],
        },
        {
            handle: 'best-sellers',
            name: 'Best sellers',
            description: 'The desk staples everyone comes back for.',
            type: 'manual',
            featured: true,
            productHandles: ['color-pop-notebook', 'pocket-notebook-trio', 'gel-pen-set', 'sticky-note-cube', 'happy-desk-bundle'],
        },
        {
            handle: 'color-crew',
            name: 'The color crew',
            description: 'The brightest stuff we make.',
            type: 'manual',
            featured: false,
            productHandles: ['color-pop-notebook', 'pocket-notebook-trio', 'gel-pen-set', 'sticker-pack', 'sticky-note-cube', 'washi-tape-set'],
        },
        {
            handle: 'desk-basics',
            name: 'Desk basics',
            description: 'Everything for a desk you actually like.',
            type: 'manual',
            featured: false,
            productHandles: ['pocket-notebook-trio', 'desk-calendar', 'sticky-note-cube'],
        },
        {
            handle: 'gift-it',
            name: 'Gift it',
            description: 'Little presents that always land.',
            type: 'manual',
            featured: false,
            productHandles: ['sticker-pack', 'enamel-pin', 'greeting-card-set', 'washi-tape-set', 'happy-desk-bundle'],
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
        slug: 'a-happy-desk-in-five-minutes',
        status: 'published',
        body: {
            title: 'A happy desk in five minutes',
            excerpt: 'You don’t need a whole makeover to like your desk more — you need three small changes and about five minutes. Here’s the quick, cheerful reset we do ourselves.',
            featuredImage: { $asset: 'post-desk-setup' },
            body: {
                type: 'doc',
                content: [
                    para('A desk you like sitting at is not about matching everything or buying a big organiser you’ll never fill. It’s about a couple of small, bright things within arm’s reach and a clear patch to actually work on. Give us five minutes and we’ll give you a desk that makes the boring jobs a little less boring.'),
                    h2('Clear the flat surface, keep one bright thing'),
                    para('Start by sweeping everything off the main surface and only putting back what earns its spot — the notebook you’re using, the pens you actually reach for, and one thing that just makes you smile: a pin on a jar, a sticker on the laptop, a rainbow cube of sticky notes. A clear surface plus one hit of color beats a tidy-but-grey desk every time.'),
                    h2('Give jobs a home and a color'),
                    para('The trick that makes it stick is color-coding by feel, not by system. Today’s list gets a bright sticky note where you can’t miss it; the notebook gets a color you like opening; the calendar sits where you’ll actually glance at it. When a task has a color and a place, you stop losing it — and the desk starts working with you instead of against you.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'small-gifts-that-always-land',
        status: 'published',
        body: {
            title: 'Small gifts that always land',
            excerpt: 'Stuck on a little present? Stationery is the easy win — cheap enough to be casual, thoughtful enough to mean it. A short, tested list of gifts that never miss.',
            featuredImage: { $asset: 'post-gift-ideas' },
            body: {
                type: 'doc',
                content: [
                    para('The best small gift is one the person would love but would never quite buy for themselves. Stationery is full of them — a pen that’s nicer than the free one, a notebook too pretty to hoard, a silly sticker that makes them laugh. Here’s how we’d pick, whatever the occasion.'),
                    h2('For the friend who’s always busy'),
                    para('Give them a reason to slow down for five minutes: a Color-Pop notebook and the gel-pen set, so the endless to-do list becomes something almost fun to write. It says “I see how much you’ve got on” without being a self-help book, and it’s the gift they’ll actually use every single day.'),
                    h2('For the person who has everything'),
                    para('Go small, go colorful, go consumable. An enamel pin they’d never pick, a sticker pack for their laptop, a box of bright cards for the notes they mean to send. Little things that get used up and don’t clutter a shelf — and if you’re not sure, the Happy Desk Bundle is the whole grin in one box. Add a note at checkout and we’ll wrap it and write it in.'),
                ],
            },
        },
    },
    {
        typeKey: 'blog_post',
        slug: 'keeping-a-creative-habit-going',
        status: 'published',
        body: {
            title: 'Keeping a creative habit going',
            excerpt: 'The blank page wins when the notebook is boring and the pens are dry. Here’s how a bit of color keeps a doodle-a-day or a journal habit alive past week two.',
            featuredImage: { $asset: 'post-creativity' },
            body: {
                type: 'doc',
                content: [
                    para('Most creative habits don’t die from lack of ideas — they die from friction. The notebook’s in a drawer, the good pen’s run out, and the page feels too precious to “waste”. Fix those three things and a doodle-a-day or a five-line journal suddenly gets a lot easier to keep. Color, it turns out, does a surprising amount of the work.'),
                    h2('Make it fun, not precious'),
                    para('A cheap, cheerful notebook beats a fancy one you’re scared to open. When the paper is bright and the pens are a set you like reaching for, the page stops feeling like a test and starts feeling like play. Give yourself permission to scribble, color outside the lines, and fill a page with nonsense — the habit is the point, not the masterpiece.'),
                    h2('Keep it where you’ll see it'),
                    para('A habit sticks when the tools are closer than the excuse. Leave the notebook open on the desk with a pen across it, not zipped away in a bag. Stick a bright note on the cover with the one tiny thing you’ll do today — a doodle, a line, a color. Small and visible wins; out of sight really is out of mind, and a habit you can see is a habit you keep.'),
                ],
            },
        },
    },
];

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: TemplateSiteSpec = {
    slug: 'retail-stationery-playful',
    key: 'sparx-retail-stationery-playful',
    name: 'Stationery & Gifts (Playful)',
    theme: THEME,
    summary:
        'A complete, working shop for a bright, playful stationery & gifts store: a real catalogue of color-pop notebooks, a gel-pen set, sticker packs, an enamel pin, a desk calendar, greeting cards, washi tape, a sticky-note cube and a fun gift bundle, with categories, collections, a bespoke PDP and a loud, merchandised home page. Joyful pop theme — soft lemon ground, a bubblegum-pink primary, a grape-purple accent, a rounded Fredoka display. Shipped as Pencil Club.',
    tagline: 'A bright, working storefront for a playful stationery & gifts shop.',
    vertical: 'retail',
    industry: 'Stationery & gifts',
    requiresModules: ['builder', 'commerce', 'cms', 'crm', 'email'],
    sortWeight: 88,
    brand: {
        businessName: 'Pencil Club',
        tagline: 'Make your desk a happier place.',
    },
    chrome: { navbar: 'centerLogo', footer: 'newsletter', showCta: true },
    seo: {
        home: {
            title: 'Pencil Club — bright notebooks, pens, stickers & gifts',
            description:
                'Pencil Club is a bright little shop of colorful notebooks, gel pens, stickers, pins and gifts — the fun, useful desk stuff that makes writing a list feel like a treat. Wrapped with a smile, posted fast.',
        },
        about: {
            title: 'About Pencil Club',
            description:
                'How Pencil Club chooses its stationery — bright, well-made desk things that pass two tests: they have to make us grin, and they have to actually work.',
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
