// sparx-restaurant-sushi — a RESTAURANT / HOSPITALITY site template: a sushi & omakase counter.
//
// A sibling of the bistro gold reference, dressed for a different room entirely: a precise,
// minimal sushi bar where a handful of counter seats watch the chef work through the day's
// best fish. Like every restaurant template it runs on the service harness's scheduling
// spine — extended with a dedicated `/menu` page — and it installs a business that FUNCTIONS
// day one: a real omakase + à-la-carte menu, and a working reservations flow (counter seats
// and tables as bookable resources, "Omakase counter" / "Table for two" / "Table for four"
// as reservation services, two nightly seatings, a deposit + a cancellation policy) that the
// live `/book` (Reserve) page renders. Pages: Home · Menu · Reserve · About · Visit. Shipped
// as Nori, dressed in an inline near-white paper / cool-ink theme with a quiet indigo accent.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `service-sites/harness.ts` (a restaurant sets `menu` + `chrome.navLinks` for the Menu/Reserve
// nav). Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-restaurant-sushi.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-restaurant-sushi/**" \
//     "marketplace-catalog/_gen/gen-restaurant-sushi.ts"
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
// A precise, minimal sushi counter: a near-white paper ground with the faintest cool cast,
// a cool near-black ink primary (mono — buttons read as pressed ink, not color), a quiet
// indigo accent for links, and a legible slate secondary. A refined serif display over a
// clean sans. The dark mode drops to an elegant charcoal — the low light of an evening
// counter. Complete light + dark, AA on every role (the blueprint sweep's contrast check is
// the gate); any role used as TEXT sits ≤ ~50% L on light / light on dark.
const THEME = defineTheme({
    name: 'nori-omakase',
    type: { body: face('Inter', 'sans-serif'), head: face('Spectral', 'serif') },
    shape: { selector: '0.25rem', field: '0.125rem', box: '0.25rem', depth: '0' },
    light: {
        surfaces: [
            'oklch(98.5% 0.003 250)',
            'oklch(96% 0.004 250)',
            'oklch(91% 0.006 255)',
            'oklch(22% 0.012 260)',
        ],
        roles: {
            primary: 'oklch(24% 0.012 262)',
            secondary: 'oklch(43% 0.02 260)',
            accent: 'oklch(47% 0.13 264)',
            neutral: 'oklch(26% 0.012 262)',
            ...STATUS_ON_LIGHT,
        },
    },
    dark: {
        surfaces: [
            'oklch(19% 0.008 260)',
            'oklch(16% 0.008 260)',
            'oklch(13% 0.008 260)',
            'oklch(95% 0.004 250)',
        ],
        roles: {
            primary: 'oklch(91% 0.008 255)',
            secondary: 'oklch(78% 0.02 260)',
            accent: 'oklch(74% 0.12 266)',
            neutral: 'oklch(28% 0.008 260)',
            ...STATUS_ON_DARK,
        },
    },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
const PHOTO: Record<string, string> = {
    "nori-nigiri": "https://images.unsplash.com/photo-1562158074-d49fbeffcc91?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2luZ2xlJTIwcGllY2UlMjBuaWdpcmklMjBmaXNoJTIwd2FybSUyMHJpY2UlMjBicnVzaGVkfGVufDB8MHx8fDE3ODY0MTUzNTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "nori-sashimi": "https://images.unsplash.com/photo-1705948729112-3139fdf1a443?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWluaW1hbCUyMHBsYXRlJTIwc2xpY2VkJTIwc2FzaGltaSUyMGFycmFuZ2VkJTIwcGFsZSUyMGNlcmFtaWN8ZW58MHwwfHx8MTc4NjQxNTM1NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "nori-chef": "https://images.unsplash.com/photo-1574906328425-c7a4cb49bfa8?ixid=M3wxMjA3fDB8MXxzZWFyY2h8MXx8aXRhbWFlJTIwc2xpY2luZyUyMGxvaW4lMjBmaXNoJTIwbG9uZyUyMHlhbmFnaWJhJTIwa25pZmV8ZW58MHwwfHx8MTc4NjQxNTM1OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "nori-counter": "https://images.unsplash.com/photo-1696449241254-11cf7f18ce32?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cm93JTIwZW1wdHklMjBjb3VudGVyJTIwc2VhdHMlMjBzZXQlMjBiZWZvcmUlMjBzdXNoaXxlbnwwfDB8fHwxNzg2NDE1MzYxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "nori-room": "https://images.unsplash.com/photo-1611596188718-840151555242?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGluaW5nJTIwcm9vbSUyMHBhbGV8ZW58MHwwfHx8MTc4NjQxNTUxNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
    "nori-sake": "https://images.unsplash.com/photo-1664711414381-b0768d979223?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FyYWZlJTIwdHdvJTIwc21hbGwlMjBjdXBzJTIwc2FrZSUyMHBvdXJlZCUyMGNvdW50ZXJ8ZW58MHwwfHx8MTc4NjQxNTM2Nnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
    id: string;
    url: string;
    alt: string;
}

const ASSETS: Asset[] = [
    { id: 'nori-hero', url: src('nori-hero'), alt: 'A hinoki-wood sushi counter, the chef at work behind it under low light' },
    { id: 'nori-nigiri', url: src('nori-nigiri'), alt: 'A single piece of nigiri, fish over warm rice, brushed with soy' },
    { id: 'nori-sashimi', url: src('nori-sashimi'), alt: 'A minimal plate of sliced sashimi arranged on pale ceramic' },
    { id: 'nori-chef', url: src('nori-chef'), alt: 'The itamae slicing a loin of fish with a long yanagiba knife' },
    { id: 'nori-counter', url: src('nori-counter'), alt: 'A row of empty counter seats set before the sushi bar' },
    { id: 'nori-room', url: src('nori-room'), alt: 'The dining room — pale wood, clean lines, a single hanging light' },
    { id: 'nori-sake', url: src('nori-sake'), alt: 'A carafe and two small cups of sake poured at the counter' },
];

const assetUrl = (id: string): string => {
    const a = ASSETS.find((x) => x.id === id);
    if (!a) throw new Error(`gen-restaurant-sushi: unknown asset "${id}"`);
    return a.url;
};

// ── Home page ──────────────────────────────────────────────────────────────────────

/** The hero — a full-bleed counter photograph, the name + one line in a solid, hairline-edged
 *  panel (readable ink on a real surface), and two actions (Reserve → the live /book flow,
 *  and View the menu). Restrained: the panel is square-cornered, the copy quiet. */
function heroBand(): Node {
    return el('section', 'relative @container overflow-hidden bg-base-200', {
        children: [
            el('img', 'absolute inset-0 h-full w-full object-cover', {
                attrs: { src: assetUrl('nori-hero'), alt: 'A hinoki-wood sushi counter under low light', loading: 'lazy' },
            }),
            el(
                'div',
                'relative mx-auto flex min-h-96 w-full max-w-5xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
                {
                    children: [
                        el('div', 'flex max-w-xl flex-col gap-5 rounded-box border border-base-300 bg-base-100 p-8 @3xl:p-10', {
                            children: [
                                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                                    text: 'Nori',
                                }),
                                el('p', 'text-lg leading-relaxed text-base-content', {
                                    text: 'A sushi counter. Ten seats, one chef, and the day’s best fish handed to you a piece at a time. Omakase at six and eight-thirty, Tuesday through Sunday.',
                                }),
                                el('div', 'flex flex-wrap items-center gap-4', {
                                    children: [
                                        el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Reserve a seat' }),
                                        el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                                            attrs: { href: '/menu' },
                                            text: 'See the menu',
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

/** A short "today" band — three ways to eat here as photo cards linking to the menu. */
function todayBand(): Node {
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
                                text: 'What the day brings',
                            }),
                            el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                                text: 'There is no fixed carte. The fish arrives that morning, the chef decides the order, and the counter follows along. A sense of how an evening here goes.',
                            }),
                        ],
                    }),
                    el('div', 'grid grid-cols-1 gap-6 @3xl:grid-cols-3', {
                        children: [
                            card('nori-nigiri', 'Omakase', 'The full counter experience — twelve to sixteen courses, paced by the chef, ending on a hand roll and tamago.', 'A single piece of nigiri'),
                            card('nori-sashimi', 'Sashimi & nigiri', 'Prefer to order your own? A short à-la-carte list of the same fish, cut to order, by the piece or the plate.', 'A minimal plate of sliced sashimi'),
                            card('nori-sake', 'Sake & tea', 'A tight, considered sake list poured cold, plus roasted hojicha and genmaicha for the table.', 'A carafe and two cups of sake'),
                        ],
                    }),
                    el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-accent underline underline-offset-4', {
                        attrs: { href: '/menu' },
                        children: [el('span', undefined, { text: 'Read the full menu' }), el('span', undefined, { text: '→' })],
                    }),
                ],
            }),
        ],
    });
}

/** A counter + reserve band — a photo beside a short invitation and the reserve CTA. */
function counterBand(): Node {
    return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
        children: [
            el('div', 'mx-auto grid w-full max-w-5xl gap-8 @3xl:grid-cols-2 @3xl:items-center', {
                children: [
                    el('img', 'aspect-video w-full rounded-box border border-base-300 object-cover', {
                        attrs: { src: assetUrl('nori-counter'), alt: 'A row of counter seats set before the sushi bar', loading: 'lazy' },
                    }),
                    el('div', 'flex flex-col gap-5', {
                        children: [
                            el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                                text: 'The best seat is at the counter',
                            }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: 'Ten seats face the bar, and every piece is handed to you the moment it’s cut. Reserve online in under a minute — you’ll see live availability for both seatings, and a card hold secures your place at the counter.',
                            }),
                            el('div', 'flex flex-wrap gap-3', {
                                children: [
                                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Reserve a seat' }),
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
    return el('section', 'bg-base-100 @container px-6 py-16', {
        children: [
            el('div', 'mx-auto grid w-full max-w-5xl gap-8 @3xl:grid-cols-2', {
                children: [
                    el('div', 'flex flex-col gap-4', {
                        children: [
                            el('h2', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', { text: 'Seatings' }),
                            el('ul', 'flex flex-col', {
                                children: [
                                    row('Tue – Thu', '18:00 · 20:30'),
                                    row('Fri – Sat', '18:00 · 20:30'),
                                    row('Sunday', '18:00 · 20:30'),
                                    row('Monday', 'Closed'),
                                ],
                            }),
                        ],
                    }),
                    el('div', 'flex flex-col gap-4', {
                        children: [
                            el('h2', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', { text: 'Find us' }),
                            el('p', 'text-lg leading-relaxed text-base-content', {
                                text: '4 Cedar Court, a quiet room off the lane behind the old fish market. Two seatings a night, by reservation. Walk-ins seated at the bar when a seat opens.',
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

const HOME: Node[] = [heroBand(), todayBand(), counterBand(), hoursBand()];

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
                        text: 'The counter runs on omakase — the chef’s choice, in sequence. What follows is the shape of an evening and the à-la-carte pieces that fill it in. Fish changes daily; tell us about allergies and we’ll cut around them.',
                    }),
                ],
            }),
        ],
    }),
    menuSection('Omakase', 'Chef’s choice, at the counter. One card hold per seat secures your place.', [
        { name: 'Omakase — twelve courses', desc: 'Nigiri and small bites in sequence, paced by the chef, closing on a hand roll, tamago and a cup of tea.', price: '145' },
        { name: 'Omakase — sixteen courses', desc: 'The longer counter — more of the day’s fish, an extra sashimi course, and a second-cut of whatever’s at its peak.', price: '195' },
        { name: 'Sake pairing', desc: 'Five small pours chosen to follow the courses, from dry and clean to rounder and rice-forward.', price: '75' },
    ]),
    menuSection('Nigiri', 'By the pair, cut to order. A short list of what’s in this week.', [
        { name: 'Akami — lean bluefin tuna', desc: 'The lean loin, brushed with nikiri soy over warm rice.', price: '9' },
        { name: 'Chū-toro — medium fatty tuna', desc: 'The marbled cut between lean and belly, meltingly soft.', price: '14' },
        { name: 'Hamachi — yellowtail', desc: 'Clean and buttery, a touch of yuzu zest.', price: '9' },
        { name: 'Hotate — hokkaido scallop', desc: 'Raw, sweet, dressed only with salt and a squeeze of lime.', price: '10' },
        { name: 'Unagi — freshwater eel', desc: 'Grilled and lacquered with a house tare, warm off the pass.', price: '11' },
        { name: 'Ikura — salmon roe', desc: 'Cured in dashi and soy, gunkan-wrapped in crisp nori.', price: '10' },
    ]),
    menuSection('Sashimi', 'No rice, just the fish. Sold by the plate — five slices to a plate.', [
        { name: 'Tai — sea bream', desc: 'Firm and delicate, cut thin, with a little sea salt and citrus.', price: '18' },
        { name: 'Saba — cured mackerel', desc: 'Lightly pressed in salt and rice vinegar, a slice of ginger alongside.', price: '16' },
        { name: 'Tako — poached octopus', desc: 'Slow-poached until tender, cut in ribbons, sesame and yuzu.', price: '17' },
        { name: 'Chef’s sashimi plate', desc: 'A selection of the day, arranged by the chef — the fastest way to taste the range.', price: '32' },
    ]),
    menuSection('Maki & hand rolls', 'Rolled to order in crisp nori. Best eaten the moment they land.', [
        { name: 'Toro & scallion hand roll', desc: 'Fatty tuna and negi, warm rice, nori kept crisp — eaten straight away.', price: '13' },
        { name: 'Cucumber & shiso maki', desc: 'Cool and clean, a palate-reset between richer pieces.', price: '8' },
        { name: 'Salmon & avocado roll', desc: 'A rounder, familiar roll — salmon, avocado, a whisper of wasabi.', price: '12' },
        { name: 'Negitoro hand roll', desc: 'Minced fatty tuna and scallion, the classic close to a meal.', price: '12' },
    ]),
    menuSection('Sake, beer & tea', 'A tight list, poured with intent. Ask what’s open and we’ll steer you.', [
        { name: 'Junmai — by the glass', desc: 'Dry, clean, rice-forward. Poured cold in a small cup.', price: '12' },
        { name: 'Ginjo — by the carafe', desc: 'Fragrant and delicate, for the table. Ask for the current pour.', price: '38' },
        { name: 'Japanese lager', desc: 'Crisp and cold, from a nearby brewer.', price: '7' },
        { name: 'Hojicha / genmaicha', desc: 'Roasted or toasted-rice green tea, refilled through the meal.', price: '5' },
    ]),
];

// ── Reserve (Book) masthead over the live reservations core ─────────────────────────

const BOOK_INTRO: Node[] = [
    el('section', 'bg-base-200 @container px-6 py-14 @3xl:py-16', {
        children: [
            el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
                children: [
                    el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Reserve a seat' }),
                    el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                        text: 'Choose the omakase counter or a table, pick a seating, and you’ll see live availability for the weeks ahead. Counter seats take a card hold to secure them. For a private counter or a party of five or more, drop us a line and we’ll arrange it.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Nori' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'Nori is a ten-seat sushi counter in a quiet room behind the old fish market. There is no long menu and no à-la-carte rush — you sit at the bar, the chef reads the day’s fish, and the meal comes to you a piece at a time, in the order it’s meant to be eaten.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'We buy small and buy daily, from a handful of suppliers we’ve worked with for years. The rice is seasoned by hand and served at body temperature; the wasabi is grated to order; the nori is kept dry until the moment it’s rolled. Little of that is visible on a plate — all of it is the point.',
                    }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: 'The room is small on purpose, and the pace is deliberate. Book ahead — both seatings fill early at the weekend — and come a little hungry. A stool at the end of the bar is kept for walk-ins whenever one opens.',
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
                    el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Visit Nori' }),
                    el('p', 'text-lg leading-relaxed text-base-content', {
                        text: '4 Cedar Court, in the quiet room off the lane behind the old fish market. Two seatings a night, Tuesday through Sunday, at six and eight-thirty; closed Monday. The evening is by reservation — a stool at the bar is kept back for walk-ins.',
                    }),
                    el('div', 'flex flex-wrap gap-3', {
                        children: [
                            el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Reserve a seat' }),
                            el('a', 'btn btn-neutral btn-outline btn-lg', { attrs: { href: 'mailto:hello@nori.example' }, text: 'Email us' }),
                        ],
                    }),
                    el('p', 'text-base leading-relaxed text-secondary', {
                        text: 'For a private counter, a larger party, or press, email hello@nori.example and we’ll get back to you the same day.',
                    }),
                ],
            }),
        ],
    }),
];

// ── Scheduling — counter seats + table reservations ─────────────────────────────────
// Counter seats are bookable RESOURCES (kind 'space', skillTag 'counter'); tables are
// resources too (kind 'table', sized by skillTag). "Omakase counter" / "Table for two" /
// "Table for four" are RESERVATION services that route to a resource of the right kind + size
// by skill tag. There are TWO seatings a night, modelled as two evening windows (18:00 and
// 20:30) on Tue–Sun. `any_available` assigns the first free seat/table of the right kind.

const SEATING_ONE = { start: 1080, end: 1200 }; // 18:00 – 20:00
const SEATING_TWO = { start: 1230, end: 1350 }; // 20:30 – 22:30
const NIGHTS = [2, 3, 4, 5, 6, 0]; // Tue, Wed, Thu, Fri, Sat, Sun

/** The two nightly seating windows, Tue–Sun — shared by every seat and table. */
function seatingWindows(): Record<string, number>[] {
    const windows: Record<string, number>[] = [];
    for (const d of NIGHTS) {
        windows.push({ dayOfWeek: d, startMinute: SEATING_ONE.start, endMinute: SEATING_ONE.end });
        windows.push({ dayOfWeek: d, startMinute: SEATING_TWO.start, endMinute: SEATING_TWO.end });
    }
    return windows;
}

/** A counter seat resource (kind 'space', skillTag 'counter'). */
function counterSeat(handle: string, name: string): Record<string, unknown> {
    return { handle, name, kind: 'space', skillTags: ['counter'], windows: seatingWindows() };
}

/** A table resource (kind 'table', sized by skillTag). */
function table(handle: string, name: string, size: string): Record<string, unknown> {
    return { handle, name, kind: 'table', skillTags: [size], windows: seatingWindows() };
}

const SCHEDULING = {
    policies: [
        {
            handle: 'omakase-hold',
            name: 'Omakase counter hold',
            depositType: 'card_hold',
            cancellationWindowHours: 48,
            reminderOffsetsMin: [2880, 1440, 180],
            policyText:
                'A counter seat places a card hold to secure it — nothing is charged unless you cancel inside 48 hours or don’t show. The chef buys for the seats booked, so the hold keeps the counter fair for everyone. We’ll remind you two days, one day, and a few hours ahead.',
        },
        {
            handle: 'table-standard',
            name: 'Table reservation',
            depositType: 'none',
            cancellationWindowHours: 24,
            reminderOffsetsMin: [1440, 180],
            policyText:
                'Tables are held for 15 minutes past your seating. Plans change — just let us know by the day before and we’ll free the table for someone else. We’ll remind you the day before and a few hours ahead.',
        },
    ],
    resources: [
        counterSeat('seat-1', 'Counter · seat 1'),
        counterSeat('seat-2', 'Counter · seat 2'),
        counterSeat('seat-3', 'Counter · seat 3'),
        counterSeat('seat-4', 'Counter · seat 4'),
        counterSeat('seat-5', 'Counter · seat 5'),
        counterSeat('seat-6', 'Counter · seat 6'),
        counterSeat('seat-7', 'Counter · seat 7'),
        counterSeat('seat-8', 'Counter · seat 8'),
        table('t2-a', 'Two-top · window', 'two-top'),
        table('t2-b', 'Two-top · corner', 'two-top'),
        table('t4-a', 'Four-top · wall', 'four-top'),
    ],
    services: [
        {
            handle: 'omakase-counter',
            name: 'Omakase counter',
            description:
                'A seat at the bar for the chef’s omakase — twelve to sixteen courses, paced by the counter, about two hours. A card hold secures your seat.',
            bookingType: 'reservation',
            durationMinutes: 120,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'seat', kind: 'space', skillTags: ['counter'], count: 1 }],
            policyHandle: 'omakase-hold',
        },
        {
            handle: 'table-for-two',
            name: 'Table for two',
            description:
                'A table for two, à la carte from the sashimi, nigiri and roll list. Ninety minutes at your own pace.',
            bookingType: 'reservation',
            durationMinutes: 90,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['two-top'], count: 1 }],
            policyHandle: 'table-standard',
        },
        {
            handle: 'table-for-four',
            name: 'Table for four',
            description: 'A table for three or four, ordering from the à-la-carte list. Bring the group.',
            bookingType: 'reservation',
            durationMinutes: 105,
            assignmentStrategy: 'any_available',
            resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['four-top'], count: 1 }],
            policyHandle: 'table-standard',
        },
    ],
};

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: ServiceSiteSpec = {
    key: 'sparx-restaurant-sushi',
    name: 'Sushi & omakase',
    summary:
        'A complete, working site for a sushi & omakase counter: a real omakase and à-la-carte menu, and a live reservations flow (counter seats and tables as bookable resources, an "Omakase counter" plus "Table for two/four" reservation services, two nightly seatings, a card-hold deposit and a cancellation policy) on the /reserve page. Minimal near-white paper theme, cool ink, a quiet indigo accent, a refined serif over a clean sans. Pages: Home, Menu, Reserve, About, Visit. Shipped as Nori.',
    tagline: 'A precise, working template for a sushi counter that takes reservations.',
    industry: 'Restaurant & sushi',
    sortWeight: 85,
    requiresModules: ['builder', 'scheduling', 'crm', 'email'],
    brand: {
        businessName: 'Nori',
        tagline: 'A ten-seat sushi counter.',
    },
    theme: THEME,
    // Restaurant nav: Menu / Reserve / About / Visit, with a "Reserve" CTA.
    chrome: {
        navbar: 'brandLeft',
        footer: 'columns',
        showCta: true,
        ctaLabel: 'Reserve',
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
            title: 'Nori — a sushi & omakase counter',
            description:
                'Nori is a ten-seat sushi counter — omakase at six and eight-thirty, the day’s best fish handed to you a piece at a time, Tuesday through Sunday. See the menu and reserve a seat.',
        },
        about: {
            title: 'About Nori — the sushi counter',
            description:
                'A ten-seat omakase counter behind the old fish market — bought small and daily, rice seasoned by hand, wasabi grated to order, served at the pace it’s meant to be eaten.',
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
