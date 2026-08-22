// sparx-restaurant-vegan — a RESTAURANT / HOSPITALITY site template: a modern plant-based kitchen.
//
// A sibling of the gold-reference bistro, in the same family and on the same spine: a restaurant
// is a BOOKING business (table reservations) with a MENU to read, so it runs on the service
// harness's scheduling core — extended here with a dedicated `/menu` page. It installs a business
// that FUNCTIONS day one: a real vegetable-forward menu, and a working reservations flow (tables
// as bookable resources, "Table for two/four/six" as reservation services, opening hours, a
// relaxed no-deposit policy, walk-ins welcome) that the live `/book` (Reserve) page renders.
// Pages: Home · Menu · Reserve · About · Visit. Shipped as Sprout & Vine, dressed in an inline
// bright plant-kitchen theme.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `service-sites/harness.ts` (a restaurant sets `menu` + `chrome.navLinks` for the Menu/Reserve
// nav). Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-restaurant-vegan.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-restaurant-vegan/**" \
//     "marketplace-catalog/_gen/gen-restaurant-vegan.ts"
//
// SEMANTIC TOKENS ONLY, NAMED UTILITIES ONLY. Container steps @sm/@md/@2xl/@3xl/@5xl only.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
    el,
    type Node,
} from '../../wizeworks/packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';

import {
  menuPrice,
    defineTheme,
    face,
    STATUS_ON_DARK,
    STATUS_ON_LIGHT,
    emitServiceBundle,
    type ServiceSiteSpec,
} from './service-sites/harness';

// ── The bespoke theme (inline) ─────────────────────────────────────────────────────
// A bright plant kitchen: a clean green-tinted cream ground, a vibrant leaf-green ink +
// primary, a warm terracotta-earth accent, under a friendly geometric display over a clean
// humanist sans. Complete light + dark, AA on every role (the blueprint sweep's contrast
// check is the gate — every role used as TEXT on a light ground stays ≤ ~50% L).
const THEME = defineTheme({
    name: 'sprout-kitchen',
    type: { body: face('Inter', 'sans-serif'), head: face('Poppins', 'sans-serif') },
    shape: { selector: '0.75rem', field: '0.5rem', box: '0.875rem', depth: '0' },
    light: {
        surfaces: [
            'oklch(97.5% 0.018 128)',
            'oklch(95% 0.024 126)',
            'oklch(91% 0.03 124)',
            'oklch(26% 0.04 150)',
        ],
        roles: {
            primary: 'oklch(47% 0.14 148)',
            secondary: 'oklch(43% 0.05 150)',
            accent: 'oklch(51% 0.13 52)',
            neutral: 'oklch(27% 0.035 150)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: [
            'oklch(22% 0.022 150)',
            'oklch(19% 0.022 150)',
            'oklch(16% 0.02 150)',
            'oklch(96% 0.02 128)',
        ],
        roles: {
            primary: 'oklch(76% 0.15 145)',
            secondary: 'oklch(79% 0.04 150)',
            accent: 'oklch(74% 0.13 55)',
            neutral: 'oklch(31% 0.022 150)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
const PHOTO: Record<string, string> = {
    "sprout-hero": "https://images.unsplash.com/photo-1773847469674-189153e5e32d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwcGxhbnQtZmlsbGVkJTIwZGluaW5nJTIwcm9vbSUyMHN1biUyMHRocm91Z2glMjBiaWd8ZW58MHwwfHx8MTc4NjQxNTM5MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "sprout-dish-1": "https://images.unsplash.com/photo-1595786802596-baa6f6d61ce7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sb3VyZnVsJTIwcm9hc3RlZC12ZWdldGFibGUlMjBib3dsJTIwZ3JhaW5zJTIwaGVyYnMlMjBicmlnaHQlMjBncmVlbnxlbnwwfDB8fHwxNzg2NDE1MzkzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "sprout-dish-2": "https://images.unsplash.com/photo-1655836607669-6f12b9b509c9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGwlMjBzaGFyaW5nJTIwcGxhdGUlMjBjaGFycmVkJTIwZ3JlZW5zJTIwd2hpcHBlZCUyMGJlYW5zfGVufDB8MHx8fDE3ODY0MTUzOTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "sprout-dish-3": "https://images.unsplash.com/photo-1541781550486-81b7a2328578?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhbnQtYmFzZWQlMjBkZXNzZXJ0JTIwc2xpY2UlMjB0YXJ0JTIwcG9hY2hlZCUyMGZydWl0JTIwc2Nvb3B8ZW58MHwwfHx8MTc4NjQxNTQwMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "sprout-room": "https://images.unsplash.com/photo-1761658644899-d1754c05c4d5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGluaW5nJTIwcm9vbSUyMGludGVyaW9yJTIwaGFuZ2luZyUyMHBsYW50cyUyMHRlcnJhY290dGElMjBwb3RzfGVufDB8MHx8fDE3ODY0MTU0MDN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "sprout-produce": "https://images.unsplash.com/photo-1591586116988-62fe65164f8d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFya2V0JTIwY3JhdGUlMjBmcmVzaGx5JTIwcGlja2VkJTIwc2Vhc29uYWwlMjB2ZWdldGFibGVzJTIwbGVhZnl8ZW58MHwwfHx8MTc4NjQxNTQwNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "sprout-drinks": "https://images.unsplash.com/photo-1613478223719-2ab802602423?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29sZC1wcmVzc2VkJTIwanVpY2VzJTIwZ2xhc3NlcyUyMG5hdHVyYWwlMjBvcmFuZ2UlMjB3aW5lJTIwY291bnRlcnxlbnwwfDB8fHwxNzg2NDE1NDEwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'sprout-hero', url: src('sprout-hero'), alt: 'A bright plant-filled dining room, sun through big windows over pale wood tables' },
    { id: 'sprout-dish-1', url: src('sprout-dish-1'), alt: 'A colorful roasted-vegetable bowl with grains, herbs and a bright green dressing' },
    { id: 'sprout-dish-2', url: src('sprout-dish-2'), alt: 'A small sharing plate of charred greens and whipped beans, styled simply' },
    { id: 'sprout-dish-3', url: src('sprout-dish-3'), alt: 'A plant-based dessert — a slice of tart with poached fruit and a scoop of sorbet' },
    { id: 'sprout-room', url: src('sprout-room'), alt: 'The dining room interior — hanging plants, terracotta pots, warm daylight' },
    { id: 'sprout-produce', url: src('sprout-produce'), alt: 'A market crate of freshly picked seasonal vegetables and leafy herbs' },
    { id: 'sprout-drinks', url: src('sprout-drinks'), alt: 'Cold-pressed juices and glasses of natural orange wine on a counter' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-restaurant-vegan: unknown asset "${id}"`);
    return a.url;
};

// ── Home page ──────────────────────────────────────────────────────────────────────

/** The hero — a full-bleed bright dining-room photo, the name + one line in a solid readable
 *  panel, and two actions (Reserve → the live /book reservations surface, and View menu). */
function heroBand(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('sprout-hero'), alt: 'A bright plant-filled dining room', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-5xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Sprout & Vine',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'A plant kitchen that puts vegetables first. Seasonal, colorful, and genuinely delicious — not worthy. Open for lunch and dinner, Tuesday through Sunday.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Book a table' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/menu' },
                                            text: 'View the menu',
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

/** A short "on the menu" band — three signature plates as photo cards linking to the menu. */
function tonightBand(): Node {
    const card = (assetId: string, name: string, note: string, alt: string): Node =>
        el('a', 'group flex flex-col gap-3', {
            attrs: { href: '/menu' },
            children: [
                el('img', 'aspect-square w-full rounded-box bg-base-200 object-cover transition group-hover:opacity-90', {
                    attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
                }),
                el('h3', 'text-xl font-semibold text-base-content', { text: name }),
                el('p', 'text-base leading-relaxed text-secondary', { text: note }),
            ],
        });
    return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-8', {
                children: [
                    el('div', 'flex flex-col gap-3', {
                        children: [
                            el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                                text: 'What we’re cooking',
                            }),
                            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                                text: 'The menu turns with the season and with whatever the growers drop off that morning. A few of the plates we’re proud of this week.',
                            }),
                        ],
                    }),
                    el('div', 'grid grid-cols-1 gap-6 @3xl:grid-cols-3', {
                        children: [
                            card('sprout-dish-2', 'Small plates', 'Made for the middle of the table — charred hispi cabbage, whipped butter beans, warm flatbread and dips.', 'A small sharing plate of charred greens'),
                            card('sprout-dish-1', 'Bowls & mains', 'Big, generous bowls off the grill and the fire — smoky aubergine, heritage grains, bright herb dressings.', 'A colorful roasted-vegetable bowl'),
                            card('sprout-dish-3', 'Something sweet', 'A short pudding list that happens to be plant-based — nobody misses the dairy. Plus house-churned sorbets.', 'A plant-based dessert with poached fruit'),
                        ],
                    }),
                    el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-accent underline underline-offset-4', {
                        attrs: { href: '/menu' },
                        children: [el('span', undefined, { text: 'See the full menu' }), el('span', undefined, { text: '→' })],
                    }),
                ],
            }),
        ],
    });
}

/** A produce/philosophy band — a market photo beside the "plants first" story. */
function philosophyBand(): Node {
    return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto grid w-full max-w-5xl gap-8 @3xl:grid-cols-2 @3xl:items-center', {
                children: [
                    el('img', 'aspect-video w-full rounded-box border border-base-300 object-cover', {
                        attrs: { src: assetUrl('sprout-produce'), alt: 'A market crate of freshly picked seasonal vegetables', loading: 'lazy' },
                    }),
                    el('div', 'flex flex-col gap-5', {
                        children: [
                            el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                                text: 'Vegetables, front and centre',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'We cook plants because they’re exciting, not because we’re making a point. Everything comes from growers we know — picked days, sometimes hours, before it hits your plate — and we cook most of it over fire.',
                            }),
                            el('p', 'text-lg leading-relaxed text-secondary', {
                                text: 'Fully plant-based, kind to just about every diet, and never dull. Tell us about allergies and we’ll happily steer you.',
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** A room + reserve band — a photo beside a short invitation and the reserve CTA. */
function reserveBand(): Node {
    return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto grid w-full max-w-5xl gap-8 @3xl:grid-cols-2 @3xl:items-center', {
                children: [
                    el('img', 'aspect-video w-full rounded-box border border-base-300 object-cover @3xl:order-2', {
                        attrs: { src: assetUrl('sprout-room'), alt: 'The dining room interior — hanging plants, terracotta pots', loading: 'lazy' },
                    }),
                    el('div', 'flex flex-col gap-5', {
                        children: [
                            el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                                text: 'Pull up a chair',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'Book online in under a minute — you’ll see the real availability and pick a time that suits you. Walk-ins are always welcome, and we keep a run of counter seats back for them every service.',
                            }),
                            el('div', 'flex flex-wrap gap-3', {
                                children: [
                                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Book a table' }),
                                ],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

/** Hours + find-us band. */
function hoursBand(): Node {
    const row = (day: string, hours: string): Node =>
        el('li', 'flex items-baseline justify-between gap-4 border-b border-base-300 py-2', {
            children: [
                el('span', 'text-base font-semibold text-base-content', { text: day }),
                el('span', 'text-base text-secondary', { text: hours }),
            ],
        });
    return el('section', 'bg-base-200 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto grid w-full max-w-5xl gap-8 @3xl:grid-cols-2', {
                children: [
                    el('div', 'flex flex-col gap-4', {
                        children: [
                            el('h2', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', { text: 'Hours' }),
                            el('ul', 'flex flex-col', {
                                children: [
                                    row('Tue – Thu', '12:00 – 15:00 · 17:30 – 22:00'),
                                    row('Fri – Sat', '12:00 – 15:00 · 17:30 – 23:00'),
                                    row('Sunday', '11:00 – 16:00 · brunch'),
                                    row('Monday', 'Closed'),
                                ],
                            }),
                        ],
                    }),
                    el('div', 'flex flex-col gap-4', {
                        children: [
                            el('h2', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', { text: 'Find us' }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: '9 Greenhouse Yard, tucked behind the old flower market. Buses stop on the high street, and there’s a bike rack right outside the door.',
                            }),
                            el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-accent underline underline-offset-4', {
                                attrs: { href: '/contact' },
                                children: [el('span', undefined, { text: 'Directions & contact' }), el('span', undefined, { text: '→' })],
                            }),
                        ],
                    }),
                ],
            }),
        ],
    });
}

const HOME: Node[] = [heroBand(), tonightBand(), philosophyBand(), reserveBand(), hoursBand()];

// ── The Menu page ────────────────────────────────────────────────────────────────

interface MenuItem {
    name: string;
    desc: string;
    price: string;
}

function menuItem(item: MenuItem): Node {
    return el('div', 'flex flex-col gap-1 border-b border-base-300 py-4', {
        children: [
            el('div', 'flex items-baseline justify-between gap-4', {
                children: [
                    el('h3', 'text-lg font-semibold text-base-content', { text: item.name }),
                    el('span', 'text-lg font-semibold text-primary', { text: menuPrice(item.price) }),
                ],
            }),
            el('p', 'text-base leading-relaxed text-secondary', { text: item.desc }),
        ],
    });
}

function menuSection(title: string, note: string, items: MenuItem[]): Node {
    return el('section', 'bg-base-100 @container px-6 py-10', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-4', {
                children: [
                    el('h2', 'text-3xl font-bold tracking-tight text-base-content @2xl:text-4xl', { text: title }),
                    ...(note ? [el('p', 'text-base leading-relaxed text-secondary', { text: note })] : []),
                    el('div', 'mt-2 flex flex-col', { children: items.map(menuItem) }),
                ],
            }),
        ],
    });
}

const MENU: Node[] = [
    el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The menu' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Entirely plant-based, changing with the season, and cooked with fire and care. This is roughly what’s on this week — the specials board fills in the rest. Tell us about allergies and we’ll steer you right.',
                    }),
                ],
            }),
        ],
    }),
    menuSection('Small plates', 'Made for the middle of the table — order a few and share.', [
        { name: 'Warm flatbread, smoked butter bean', desc: 'Blistered flatbread torn to order, whipped smoked butter beans, chilli oil.', price: '7' },
        { name: 'Charred hispi cabbage, hazelnut', desc: 'Grilled sweetheart cabbage, brown-butter hazelnuts, capers, lemon.', price: '9' },
        { name: 'Heritage tomatoes, basil, sourdough crumb', desc: 'Peak-season tomatoes, torn basil, toasted sourdough, aged balsamic.', price: '10' },
        { name: 'Crispy oyster mushrooms, aioli', desc: 'Buttermilk-style battered oyster mushrooms, smoked garlic aioli.', price: '9' },
        { name: 'Beetroot tartare, rye toast', desc: 'Roasted beets chopped fine, capers, mustard, dill, crisp rye.', price: '9' },
    ]),
    menuSection('Bowls & mains', 'Cooked over fire. Big and generous — sides are separate.', [
        { name: 'Smoky aubergine, freekeh, herb oil', desc: 'Whole aubergine cooked in the embers, smoked freekeh, green herb oil, pomegranate.', price: '16' },
        { name: 'Roast squash & sage dumplings', desc: 'Handmade dumplings, roasted squash, crispy sage, toasted pumpkin seeds.', price: '17' },
        { name: 'Fire-grilled cauliflower steak', desc: 'A thick cut cauliflower, charred over wood, romesco, salsa verde, almonds.', price: '18' },
        { name: 'Wild mushroom & barley risotto', desc: 'Pearl barley, seasonal mushrooms, thyme, a bright cashew cream.', price: '16' },
        { name: 'Loaded harvest bowl', desc: 'Roasted roots, ancient grains, kale slaw, hummus, seeds, tahini-lime dressing.', price: '15' },
    ]),
    menuSection('Sides', '', [
        { name: 'Rosemary-salt roast potatoes', desc: '', price: '6' },
        { name: 'Charred greens, chilli, lemon', desc: '', price: '6' },
        { name: 'House slaw, toasted seeds', desc: '', price: '5' },
        { name: 'Warm grains & herbs', desc: '', price: '5' },
    ]),
    menuSection('Sweet', 'A short list that happens to be plant-based — nobody misses the dairy.', [
        { name: 'Dark chocolate & olive oil tart', desc: 'Bitter chocolate, flaky pastry, sea salt, a spoon of coconut cream.', price: '8' },
        { name: 'Poached pear, oat crumble', desc: 'Spiced poached pear, toasted oat crumble, warm custard.', price: '7' },
        { name: 'House sorbets', desc: 'Three scoops, churned in-house — ask what’s spinning today.', price: '6' },
    ]),
    menuSection('Drinks', 'Cold-pressed juices, a low-intervention wine list, and beer from two streets over.', [
        { name: 'Cold-pressed juice of the day', desc: 'Pressed that morning — green, golden, or ruby. Ask what’s on.', price: '5' },
        { name: 'Natural wine, by the glass', desc: 'Skin-contact orange, a bright red, a crisp white — all low-intervention.', price: '8' },
        { name: 'Local pale ale', desc: 'On tap, from the brewery two streets over.', price: '6' },
        { name: 'House kombucha & sodas', desc: 'House-fermented kombucha and seasonal fruit sodas.', price: '5' },
    ]),
];

// ── Reserve (Book) masthead over the live reservations core ─────────────────────────

const BOOK_INTRO: Node[] = [
    el('section', 'bg-base-200 @container px-6 py-14 @3xl:py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Book a table' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Pick your party size and a time below — you’ll see live availability for the next few weeks. No deposit, no fuss. For parties of seven or more, or a whole-room enquiry, drop us a line and we’ll look after it.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Sprout & Vine' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Sprout & Vine is a plant kitchen behind the old flower market. We opened with one idea: cook vegetables so well that nobody asks where the meat is. Not a health-food café, not a lecture — just really good food that happens to be entirely plant-based.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'The menu turns with the season and with what our growers pull from the ground that morning, so it’s never quite the same twice. We buy from farms we know by name, cook most of it over fire, and make the bread, the dumplings and the sorbets in-house.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'The room is bright, full of plants, and easy to be in. Book ahead for dinner, especially at the weekend — but there’s always a counter seat for a walk-in, a glass of something natural and a plate to share.',
                    }),
                ],
            }),
        ],
    }),
];

const CONTACT: Node[] = [
    el('section', 'bg-base-100 @container px-6 py-20', {
        children: [
            el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
                children: [
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Visit Sprout & Vine' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: '9 Greenhouse Yard, tucked behind the old flower market. Tue–Sun for lunch and dinner, with Sunday brunch; closed Monday. Buses stop on the high street, and there’s a bike rack right outside.',
                    }),
                    el('div', 'flex flex-wrap gap-3', {
                        children: [
                            el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Book a table' }),
                            el('a', 'btn btn-neutral btn-outline btn-lg', { attrs: { href: 'mailto:hello@sproutandvine.example' }, text: 'Email us' }),
                        ],
                    }),
                    el('p', 'text-base leading-relaxed text-secondary', {
                        text: 'For large parties, whole-room hire or press, email hello@sproutandvine.example and we’ll get back to you the same day.',
                    }),
                ],
            }),
        ],
    }),
];

// ── Scheduling — table reservations ─────────────────────────────────────────────────
// Tables are bookable RESOURCES (kind 'table'); "Table for two/four/six" are RESERVATION
// services that route to a table of the right size by skill tag. Opening-hours windows mirror
// the site's hours. `any_available` assigns the first free table of that size. Relaxed,
// no-deposit policy — walk-ins welcome.

const LUNCH = { start: 720, end: 900 }; // 12:00 – 15:00
const DINNER = { start: 1050, end: 1320 }; // 17:30 – 22:00
const SUN = { start: 660, end: 960 }; // 11:00 – 16:00 (brunch)

/** A table resource with lunch+dinner windows Tue–Sat and a Sunday brunch window. */
function table(handle: string, name: string, size: string): Record<string, unknown> {
    const windows: Record<string, number>[] = [];
    for (const d of [2, 3, 4, 5, 6]) {
        windows.push({ dayOfWeek: d, startMinute: LUNCH.start, endMinute: LUNCH.end });
        windows.push({ dayOfWeek: d, startMinute: DINNER.start, endMinute: DINNER.end });
    }
    windows.push({ dayOfWeek: 0, startMinute: SUN.start, endMinute: SUN.end });
    return { handle, name, kind: 'table', skillTags: [size], windows };
}

const SCHEDULING = {
    policies: [
        {
            handle: 'table-standard',
            name: 'Table reservation',
            depositType: 'none',
            cancellationWindowHours: 12,
            reminderOffsetsMin: [1440, 180],
            policyText:
                'No deposit, ever — we hold your table for 15 minutes past your time. Plans change; just let us know by the morning of and we’ll pass the table on. We’ll send a friendly reminder the day before and a few hours ahead. Walk-ins are always welcome at the counter.',
        },
        {
            handle: 'large-table',
            name: 'Large table',
            depositType: 'none',
            cancellationWindowHours: 24,
            reminderOffsetsMin: [2880, 1440, 180],
            policyText:
                'The big table is free to book — no deposit. Because it seats so many, we ask that you let us know a day ahead if plans change, so someone else can enjoy it. For seven or more, drop us a line and we’ll sort it.',
        },
    ],
    resources: [
        table('t2-a', 'Two-top · window', 'two-top'),
        table('t2-b', 'Two-top · greenhouse', 'two-top'),
        table('t2-c', 'Two-top · counter', 'two-top'),
        table('t4-a', 'Four-top · middle', 'four-top'),
        table('t4-b', 'Four-top · banquette', 'four-top'),
        table('t6-a', 'Six-top · long table', 'six-top'),
    ],
    services: [
        {
            handle: 'table-for-two',
            name: 'Table for two',
            description:
                'A table for two, for lunch, dinner or Sunday brunch. Ninety minutes at the weekend, longer midweek — we won’t rush you.',
            bookingType: 'reservation',
            durationMinutes: 90,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['two-top'], count: 1 }],
            policyHandle: 'table-standard',
        },
        {
            handle: 'table-for-four',
            name: 'Table for four',
            description: 'A table for three or four. Bring the family, or make it a plant-powered double date.',
            bookingType: 'reservation',
            durationMinutes: 105,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['four-top'], count: 1 }],
            policyHandle: 'table-standard',
        },
        {
            handle: 'table-for-six',
            name: 'Table for six',
            description:
                'The long table, for five or six. No deposit — just give us a day’s notice if plans change. For seven or more, email us and we’ll sort it.',
            bookingType: 'reservation',
            durationMinutes: 120,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['six-top'], count: 1 }],
            policyHandle: 'large-table',
        },
    ],
};

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: ServiceSiteSpec = {
    key: 'sparx-restaurant-vegan',
    name: 'Plant Kitchen',
    summary:
        'A complete, working site for a modern plant-based restaurant: a real vegetable-forward menu, and a live table-reservations flow (tables as bookable resources, party-size reservation services, opening hours, a relaxed no-deposit policy, walk-ins welcome) on the Reserve page. Bright plant-kitchen theme — green-tinted cream, vibrant leaf-green, a warm terracotta accent. Pages: Home, Menu, Reserve, About, Visit. Shipped as Sprout & Vine.',
    tagline: 'A fresh, working template for a plant-based restaurant that takes reservations.',
    industry: 'Restaurant & plant kitchen',
    sortWeight: 84,
    requiresModules: ['builder', 'scheduling', 'crm', 'email'],
    brand: {
        businessName: 'Sprout & Vine',
        tagline: 'A plant kitchen.',
    },
    theme: THEME,
    // Restaurant nav: Menu / Reserve / About / Visit, with a "Book a table" CTA.
    chrome: {
        navbar: 'brandLeft',
        footer: 'columns',
        showCta: true,
        ctaLabel: 'Book a table',
        ctaHref: '/book',
        navLinks: [
            ['Menu', '/menu'],
            ['Reserve', '/book'],
            ['About', '/about'],
            ['Visit', '/contact'],
        ],
    },
    seo: {
        home: {
            title: 'Sprout & Vine — a modern plant kitchen',
            description:
                'Sprout & Vine is a plant-based restaurant — seasonal vegetables cooked over fire, cold-pressed juice and natural wine, open Tue–Sun for lunch and dinner. See the menu and book a table.',
        },
        about: {
            title: 'About Sprout & Vine — the plant kitchen',
            description:
                'A bright, seasonal plant-based restaurant behind the old flower market — vegetables cooked over fire, bread and sorbets made in-house, natural wine poured honestly.',
        },
    },
    home: HOME,
    menu: MENU,
    bookIntro: BOOK_INTRO,
    about: ABOUT,
    contact: CONTACT,
    scheduling: SCHEDULING,
    assets: ASSETS,
};

// ── Main ─────────────────────────────────────────────────────────────────────────

async function main(): Promise<void> {
    const { dir } = await emitServiceBundle(SPEC);
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
}

main().catch((err: unknown) => {
    console.error(err);
    process.exit(1);
});
