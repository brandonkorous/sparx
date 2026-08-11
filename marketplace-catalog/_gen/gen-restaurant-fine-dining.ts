// sparx-restaurant-fine-dining — a RESTAURANT / HOSPITALITY site template: a fine-dining,
// tasting-menu restaurant.
//
// The upscale sibling of gen-restaurant-bistro.ts. A fine-dining room is a BOOKING business
// (dinner-only table reservations, a chef's counter) with a MENU to read (a nightly tasting
// menu + à la carte + wine pairing), so it runs on the same service harness scheduling spine,
// extended with a dedicated `/menu` page. It installs a business that FUNCTIONS day one: a real
// menu, and a working reservations flow (tables + a chef's counter as bookable resources,
// party-size reservation services, dinner opening hours, a per-cover deposit policy) that the
// live `/book` (Reserve) page renders. Pages: Home · Menu · Reserve · About · Visit. Shipped as
// Vesper, dressed in an inline dark, candle-lit fine-dining theme.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `service-sites/harness.ts` (a restaurant sets `menu` + `chrome.navLinks` for the Menu/Reserve
// nav). Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-restaurant-fine-dining.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-restaurant-fine-dining/**" \
//     "marketplace-catalog/_gen/gen-restaurant-fine-dining.ts"
//
// SEMANTIC TOKENS ONLY, NAMED UTILITIES ONLY. Container steps @sm/@md/@2xl/@3xl/@5xl only.
//
// WHY RELATIVE IMPORTS — see the harness header (marketplace-catalog has no node_modules).

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import {
  el,
  type Node,
} from '../../packages/silica-catalog/node_modules/@wizeworks/silicaui-html/dist/index.js';
import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import {
  defineTheme,
  face,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  emitServiceBundle,
  type ServiceSiteSpec,
} from './service-sites/harness';
import { writeServicePreview } from './service-sites/preview';

// ── The bespoke theme (inline) ─────────────────────────────────────────────────────
// A dark, candle-lit fine-dining room: a warm charcoal ground in BOTH modes (dinner is a
// low-lit occasion), surfaces separating by a base-200 shift + a hairline border, light ink,
// a legible warm-grey secondary, and a single warm GOLD primary + a COPPER accent that glow
// against the charcoal. A high-contrast serif display (Playfair) over a clean sans (Inter).
// Complete light + dark, AA on every role (the blueprint sweep's contrast check is the gate) —
// every text role sits high on the L axis so it reads LIGHT on the dark ground.
const THEME = defineTheme({
  name: 'vesper-fine',
  type: { body: face('Inter', 'sans-serif'), head: face('Playfair Display', 'serif') },
  shape: { selector: '0.25rem', field: '0.125rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(22% 0.012 65)',
      'oklch(26% 0.014 65)',
      'oklch(32% 0.016 65)',
      'oklch(94% 0.008 85)',
    ],
    roles: {
      primary: 'oklch(80% 0.11 82)',
      secondary: 'oklch(77% 0.02 75)',
      accent: 'oklch(77% 0.12 55)',
      neutral: 'oklch(30% 0.012 65)',
      ...STATUS_ON_DARK,
    },
  },
  dark: {
    surfaces: [
      'oklch(18% 0.012 65)',
      'oklch(21% 0.014 65)',
      'oklch(28% 0.016 65)',
      'oklch(95% 0.008 85)',
    ],
    roles: {
      primary: 'oklch(82% 0.1 82)',
      secondary: 'oklch(79% 0.02 75)',
      accent: 'oklch(79% 0.11 55)',
      neutral: 'oklch(26% 0.012 65)',
      ...STATUS_ON_DARK,
    },
  },
});

// STATUS_ON_LIGHT is imported to mirror the gold reference's import surface; a dark theme
// uses the dark status ramp in BOTH modes so semantic pills stay legible on charcoal.
void STATUS_ON_LIGHT;

// ── Imagery ──────────────────────────────────────────────────────────────────────
const PHOTO: Record<string, string> = {
  "vesper-hero": "https://images.unsplash.com/photo-1681669778757-37a347f9002b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FuZGxlLWxpdCUyMGZpbmUtZGluaW5nJTIwcm9vbSUyMGR1c2slMjB0YWJsZXMlMjBzZXQlMjB3aGl0ZXxlbnwwfDB8fHwxNzg2NDE1MjcyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vesper-tasting": "https://images.unsplash.com/photo-1601556126838-56939e7b43f0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVsaWNhdGUlMjB0YXN0aW5nLW1lbnUlMjBjb3Vyc2UlMjBwbGF0ZWQlMjB0d2VlemVycyUyMGRhcmslMjBjZXJhbWljfGVufDB8MHx8fDE3ODY0MTUyNzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vesper-fish": "https://images.unsplash.com/photo-1654772704042-0d536b77548b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmlzaCUyMGNvdXJzZSUyMGZpbGxldCUyMHR1cmJvdCUyMHBhbGUlMjBiZXVycmUlMjBibGFuY3xlbnwwfDB8fHwxNzg2NDE1Mjc5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vesper-meat": "https://images.unsplash.com/photo-1547050605-2f268cd5daf0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWVhdCUyMGNvdXJzZSUyMGRyeS1hZ2VkJTIwYmVlZiUyMGJvbmUlMjBtYXJyb3clMjBnaXJvbGxlc3xlbnwwfDB8fHwxNzg2NDE1MjgyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vesper-dessert": "https://images.unsplash.com/photo-1660640138183-0ba509f94cb2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29tcG9zZWQlMjBkZXNzZXJ0JTIwZGFyayUyMGNob2NvbGF0ZSUyMGhhemVsbnV0JTIwcHJhbGluZSUyMHF1ZW5lbGxlfGVufDB8MHx8fDE3ODY0MTUyODZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vesper-counter": "https://images.unsplash.com/photo-1723744910051-da35a92321af?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hlZiUyMHMlMjBjb3VudGVyJTIwZGluZXJzJTIwc2VhdGVkJTIwcGFzcyUyMHdhdGNoaW5nfGVufDB8MHx8fDE3ODY0MTUyODl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vesper-cellar": "https://images.unsplash.com/photo-1758801305056-a9a1d4bc0c06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FuZGxlLWxpdCUyMHdpbmUlMjBjZWxsYXIlMjBib3R0bGVzJTIwcmFja2VkJTIwZmxvb3IlMjBjZWlsaW5nfGVufDB8MHx8fDE3ODY0MTUyOTN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "vesper-room": "https://images.unsplash.com/photo-1780147342156-e7b4d360474f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGluaW5nJTIwcm9vbSUyMGRldGFpbCUyMHNpbmdsZSUyMHNldCUyMHRhYmxlJTIwbGl0fGVufDB8MHx8fDE3ODY0MTUyOTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'vesper-hero', url: src('vesper-hero'), alt: 'A candle-lit fine-dining room at dusk, tables set with white linen and low golden light' },
  { id: 'vesper-tasting', url: src('vesper-tasting'), alt: 'A delicate tasting-menu course plated with tweezers on a dark ceramic plate' },
  { id: 'vesper-fish', url: src('vesper-fish'), alt: 'A fish course — a fillet of turbot in a pale beurre blanc, garnished with sea herbs' },
  { id: 'vesper-meat', url: src('vesper-meat'), alt: 'A meat course — dry-aged beef, bone marrow and girolles, glazed dark' },
  { id: 'vesper-dessert', url: src('vesper-dessert'), alt: 'A composed dessert — dark chocolate, hazelnut praline and a quenelle of ice cream' },
  { id: 'vesper-counter', url: src('vesper-counter'), alt: 'The chef’s counter — diners seated at the pass watching the kitchen plate' },
  { id: 'vesper-cellar', url: src('vesper-cellar'), alt: 'A candle-lit wine cellar, bottles racked from floor to ceiling' },
  { id: 'vesper-room', url: src('vesper-room'), alt: 'The dining room in detail — a single set table, a lit candle, a glass of red' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-restaurant-fine-dining: unknown asset "${id}"`);
  return a.url;
};

// ── Home page ──────────────────────────────────────────────────────────────────────

/** The hero — a full-bleed candle-lit dining-room photo, the name + one line in a solid
 *  readable panel, and two actions (Reserve → the live /book reservations surface, View menu). */
function heroBand(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('vesper-hero'), alt: 'A candle-lit fine-dining room at dusk', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-5xl flex-col items-start justify-end gap-6 px-6 py-24 @3xl:px-10 @3xl:py-32',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-6 rounded-box border border-base-300 bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-6xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl', {
                  text: 'Vesper',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'A tasting-menu restaurant. One nightly menu that changes with the day, a wine list read like a story, and a room kept low and quiet. Dinner, Tuesday through Saturday — as an occasion, not an errand.',
                }),
                el('div', 'flex flex-wrap items-center gap-5', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Reserve' }),
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

/** The tasting-menu band — the headline offer: a photo beside the nightly menu's story,
 *  its price and its pairing, with a link into the full menu. */
function tastingBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-20 @3xl:py-24', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-2 @3xl:items-center @3xl:gap-16', {
        children: [
          el('img', 'aspect-square w-full rounded-box border border-base-300 object-cover', {
            attrs: { src: assetUrl('vesper-tasting'), alt: 'A delicate tasting-menu course plated on a dark plate', loading: 'lazy' },
          }),
          el('div', 'flex flex-col gap-6', {
            children: [
              el('h2', 'text-4xl font-bold tracking-tight text-base-content @3xl:text-5xl', {
                text: 'One menu, written each morning',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Dinner at Vesper is a single tasting menu of seven courses, built around what the boats and the growers sent that day. There is no à la carte on the busiest nights — you sit, and we cook for you.',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'A considered wine pairing follows the menu glass for glass; the cellar is open if you would rather choose your own. Tell us about allergies when you book and the kitchen writes around them.',
              }),
              el('div', 'flex flex-wrap items-baseline gap-x-8 gap-y-2 border-t border-base-300 pt-5', {
                children: [
                  el('p', 'text-lg text-base-content', {
                    children: [
                      el('span', 'font-semibold text-primary', { text: '£145' }),
                      el('span', 'text-secondary', { text: ' · the tasting menu, per person' }),
                    ],
                  }),
                  el('p', 'text-lg text-base-content', {
                    children: [
                      el('span', 'font-semibold text-primary', { text: '£95' }),
                      el('span', 'text-secondary', { text: ' · wine pairing' }),
                    ],
                  }),
                ],
              }),
              el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-accent underline underline-offset-4', {
                attrs: { href: '/menu' },
                children: [el('span', undefined, { text: 'Read the full menu' }), el('span', undefined, { text: '→' })],
              }),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A three-up courses band — signature courses as photo cards linking to the menu. */
function coursesBand(): Node {
  const card = (assetId: string, name: string, note: string, alt: string): Node =>
    el('a', 'group flex flex-col gap-4', {
      attrs: { href: '/menu' },
      children: [
        el('img', 'aspect-square w-full rounded-box border border-base-300 bg-base-200 object-cover transition group-hover:opacity-90', {
          attrs: { src: assetUrl(assetId), alt, loading: 'lazy' },
        }),
        el('h3', 'text-2xl font-semibold text-base-content', { text: name }),
        el('p', 'text-base leading-relaxed text-secondary', { text: note }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-20 @3xl:py-24', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-10', {
        children: [
          el('div', 'flex max-w-2xl flex-col gap-4', {
            children: [
              el('h2', 'text-4xl font-bold tracking-tight text-base-content @3xl:text-5xl', {
                text: 'A few things off the pass',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'The menu turns with the season, so no two visits are quite the same. A glimpse of the courses we are cooking this week.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-8 @3xl:grid-cols-3', {
            children: [
              card('vesper-fish', 'From the sea', 'Cornish turbot roasted on the bone, mussels and a beurre blanc bright with sea herbs and a spoon of caviar.', 'A fish course — turbot in a pale butter sauce'),
              card('vesper-meat', 'From the land', 'Dry-aged Highland beef over embers, bone marrow, girolles and a sauce reduced from its own bones.', 'A meat course — dry-aged beef with bone marrow'),
              card('vesper-dessert', 'To close', 'Valrhona chocolate and hazelnut praline, a whisper of sea salt, and a quenelle churned to order.', 'A composed chocolate dessert'),
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

/** A reserve band — the chef's counter photo beside a short invitation and the reserve CTA. */
function reserveBand(): Node {
  return el('section', 'bg-base-100 @container px-6 py-20 @3xl:py-24', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-2 @3xl:items-center @3xl:gap-16', {
        children: [
          el('img', 'aspect-video w-full rounded-box border border-base-300 object-cover', {
            attrs: { src: assetUrl('vesper-counter'), alt: 'The chef’s counter — diners seated at the pass', loading: 'lazy' },
          }),
          el('div', 'flex flex-col gap-6', {
            children: [
              el('h2', 'text-4xl font-bold tracking-tight text-base-content @3xl:text-5xl', {
                text: 'The best seat is at the pass',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Six stools sit at the chef’s counter, looking straight into the kitchen — the courses come from the hands that made them, with the story of each one told across the pass. Book a table in the room, or take a seat at the counter.',
              }),
              el('p', 'text-base leading-relaxed text-secondary', {
                text: 'Reserve online in under a minute; you’ll see live availability for the weeks ahead. A small per-guest deposit holds the table and comes straight off the bill on the night.',
              }),
              el('div', 'flex flex-wrap gap-4', {
                children: [
                  el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Reserve a table' }),
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
    el('li', 'flex items-baseline justify-between gap-4 border-b border-base-300 py-3', {
      children: [
        el('span', 'text-base font-semibold text-base-content', { text: day }),
        el('span', 'text-base text-secondary', { text: hours }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-2', {
        children: [
          el('div', 'flex flex-col gap-5', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', { text: 'Hours' }),
              el('ul', 'flex flex-col', {
                children: [
                  row('Tue – Thu', 'Dinner · 18:00 – 22:00'),
                  row('Fri – Sat', 'Dinner · 18:00 – 22:00'),
                  row('Sun – Mon', 'Closed'),
                ],
              }),
              el('p', 'text-base leading-relaxed text-secondary', {
                text: 'One seating a night. The kitchen sends the last course close to eleven — stay for a final glass.',
              }),
            ],
          }),
          el('div', 'flex flex-col gap-5', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', { text: 'Find us' }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'No. 9 Vesper Court, behind the old exchange on the harbour side. There is no sign on the door — look for the single lit lamp. Valet from six; the last train leaves at midnight.',
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

const HOME: Node[] = [heroBand(), tastingBand(), coursesBand(), reserveBand(), hoursBand()];

// ── The Menu page ────────────────────────────────────────────────────────────────

interface MenuItem {
  name: string;
  desc: string;
  price: string;
}

function menuItem(item: MenuItem): Node {
  return el('div', 'flex flex-col gap-1 border-b border-base-300 py-5', {
    children: [
      el('div', 'flex items-baseline justify-between gap-4', {
        children: [
          el('h3', 'text-xl font-semibold text-base-content', { text: item.name }),
          ...(item.price
            ? [el('span', 'shrink-0 text-lg font-semibold text-primary', { text: item.price })]
            : []),
        ],
      }),
      ...(item.desc ? [el('p', 'text-base leading-relaxed text-secondary', { text: item.desc })] : []),
    ],
  });
}

function menuSection(title: string, note: string, items: MenuItem[]): Node {
  return el('section', 'bg-base-100 @container px-6 py-12', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
        children: [
          el('h2', 'text-3xl font-bold tracking-tight text-base-content @2xl:text-4xl', { text: title }),
          ...(note ? [el('p', 'text-base leading-relaxed text-secondary', { text: note })] : []),
          el('div', 'mt-2 flex flex-col', { children: items.map(menuItem) }),
        ],
      }),
    ],
  });
}

/** The tasting-menu feature — the headline of the page, set apart on a base-200 band. */
function tastingFeature(): Node {
  const course = (name: string, desc: string): Node =>
    el('div', 'flex flex-col gap-1 border-b border-base-300 py-4', {
      children: [
        el('h3', 'text-lg font-semibold text-base-content', { text: name }),
        el('p', 'text-base leading-relaxed text-secondary', { text: desc }),
      ],
    });
  return el('section', 'bg-base-200 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              el('h2', 'text-4xl font-bold tracking-tight text-base-content @2xl:text-5xl', { text: 'The tasting menu' }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Seven courses, one seating, written the morning of your visit. This is the shape of a night with us — the detail changes with the market. £145 per guest; wine pairing £95.',
              }),
            ],
          }),
          el('div', 'flex flex-col', {
            children: [
              course('Snacks at the counter', 'A handful of one-bite things to open — cured, fried, and cold from the pass, with a glass of something sparkling.'),
              course('Oyster & cucumber', 'A native oyster, barely dressed, with cucumber, dill oil and a granita of its own liquor.'),
              course('Hand-dived scallop', 'Roasted in the shell, brown-butter hollandaise, toasted hazelnut and a squeeze of blood orange.'),
              course('Turbot on the bone', 'Cornish turbot, mussels steamed in cider, a beurre blanc bright with sea herbs and a spoon of caviar.'),
              course('Dry-aged beef & marrow', 'Highland beef over embers, roast bone marrow, girolles and a sauce reduced from its own bones.'),
              course('Cheese from the trolley', 'A short board of British farmhouse cheeses, quince, walnut and warm oatcakes — as much or as little as you like.'),
              course('Chocolate & hazelnut', 'Valrhona chocolate, hazelnut praline, sea salt and a quenelle churned to order — coffee and petits fours to follow.'),
            ],
          }),
        ],
      }),
    ],
  });
}

const MENU: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-20 @3xl:py-24', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-5', {
        children: [
          el('h1', 'text-6xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl', { text: 'The menu' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Dinner is a seven-course tasting menu, changing daily with the market and the season. On quieter nights a short à la carte is offered alongside it. Tell us about any allergies when you book and the kitchen will write around them.',
          }),
        ],
      }),
    ],
  }),
  tastingFeature(),
  menuSection('À la carte — to begin', 'Offered Tuesday to Thursday, alongside the tasting menu.', [
    { name: 'Native oyster, cucumber, dill', desc: 'Barely dressed, with a granita of its own liquor. Each.', price: '5' },
    { name: 'Hand-dived scallop, brown butter, hazelnut', desc: 'Roasted in the shell, blood orange, toasted hazelnut.', price: '24' },
    { name: 'Foie gras, quince, brioche', desc: 'Torchon of foie gras, poached quince, warm buttered brioche.', price: '26' },
    { name: 'Heritage beetroot, aged goat’s curd', desc: 'Roasted and raw beetroot, aged curd, walnut, a sharp leaf.', price: '18' },
  ]),
  menuSection('Fish', 'From the day boats. Cooked simply, sauced with care.', [
    { name: 'Turbot on the bone, beurre blanc, caviar', desc: 'Cornish turbot, mussels in cider, sea herbs, a spoon of caviar.', price: '46' },
    { name: 'Native lobster, bisque, tarragon', desc: 'Half a lobster, a bisque reduced for hours, tarragon and brandy.', price: '52' },
    { name: 'Line-caught halibut, salsify, brown shrimp', desc: 'Roasted halibut, salsify two ways, a warm brown-shrimp butter.', price: '42' },
  ]),
  menuSection('Meat & game', 'Aged in-house, cooked over embers.', [
    { name: 'Dry-aged Highland beef, bone marrow, girolles', desc: '35-day aged fillet, roast marrow, girolles, red-wine jus. For one.', price: '54' },
    { name: 'Anjou squab, cherry, foie gras', desc: 'Roasted crown and confit leg, morello cherry, a foie-gras bonbon.', price: '48' },
    { name: 'Herdwick lamb, wild garlic, sheep’s-milk', desc: 'Rump and slow-cooked shoulder, wild garlic, a sheep’s-milk yoghurt.', price: '46' },
  ]),
  menuSection('To finish', 'Puddings, and a trolley of British farmhouse cheese.', [
    { name: 'Valrhona chocolate, hazelnut praline', desc: 'Dark chocolate délice, praline, sea salt, a quenelle to order.', price: '16' },
    { name: 'Poached pear, brown butter, verjus', desc: 'Vanilla-poached pear, brown-butter cake, verjus caramel.', price: '15' },
    { name: 'The cheese trolley', desc: 'A selection of British farmhouse cheeses, quince, walnut, oatcakes.', price: '22' },
  ]),
  menuSection('Wine & pairing', 'A cellar built over years, poured by a sommelier who lives in it.', [
    { name: 'The tasting pairing', desc: 'Seven glasses chosen to follow the tasting menu, course for course.', price: '95' },
    { name: 'The reserve pairing', desc: 'Older vintages and rare bottles, for the table that wants to go deeper.', price: '165' },
    { name: 'By the glass, by the bottle', desc: 'A long list, low-intervention and classic alike — ask the sommelier.', price: '' },
  ]),
];

// ── Reserve (Book) masthead over the live reservations core ─────────────────────────

const BOOK_INTRO: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-5', {
        children: [
          el('h1', 'text-6xl font-bold leading-none tracking-tight text-base-content @3xl:text-7xl', { text: 'Reserve' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Choose your party size and a night below — you’ll see live availability for the weeks ahead. A small per-guest deposit holds the table and comes off your bill on the night.',
          }),
          el('p', 'max-w-2xl text-base leading-relaxed text-secondary', {
            text: 'For the chef’s counter, private dining, or a party of seven or more, write to us and we’ll arrange it personally.',
          }),
        ],
      }),
    ],
  }),
];

// ── About + Contact ─────────────────────────────────────────────────────────────────

const ABOUT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-24', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-6xl font-bold tracking-tight text-base-content @2xl:text-7xl', { text: 'About Vesper' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Vesper is a small tasting-menu restaurant behind the old exchange on the harbour side. We opened with a single idea: cook one menu a night, built entirely around what the day brought in, and serve it in a room quiet enough to hear the kitchen work.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'There is no fixed carte. The chef writes the menu each morning after the boats land and the growers call, so the courses turn with the tide and the season and are never quite the same twice. Nearly everything is made in-house — the bread, the butter, the pastry, the petits fours that close the night.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The room seats a few more than thirty, with six stools at the chef’s counter for those who want to watch it happen. One seating a night means the evening is yours — book ahead, especially at the weekend, and come as you are for the long, unhurried kind of dinner an occasion deserves.',
          }),
        ],
      }),
    ],
  }),
  el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-2 @3xl:items-center @3xl:gap-16', {
        children: [
          el('img', 'aspect-video w-full rounded-box border border-base-300 object-cover', {
            attrs: { src: assetUrl('vesper-cellar'), alt: 'A candle-lit wine cellar, bottles racked floor to ceiling', loading: 'lazy' },
          }),
          el('div', 'flex flex-col gap-5', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', { text: 'The cellar' }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Under the dining room is a cellar built over years — classic estates beside low-intervention growers, a deep bench of older vintages, and a sommelier who would rather talk you into something surprising than something safe.',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Take the pairing and let the list follow the menu glass for glass, or come down before dinner and choose your own. Either way, nothing on it is off-limits to a curious table.',
              }),
            ],
          }),
        ],
      }),
    ],
  }),
];

const CONTACT: Node[] = [
  el('section', 'bg-base-100 @container px-6 py-24', {
    children: [
      el('div', 'mx-auto flex w-full max-w-3xl flex-col gap-6', {
        children: [
          el('h1', 'text-6xl font-bold tracking-tight text-base-content @2xl:text-7xl', { text: 'Visit Vesper' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'No. 9 Vesper Court, behind the old exchange on the harbour side. Dinner Tuesday to Saturday, one seating a night; closed Sunday and Monday. There is no sign on the door — look for the single lit lamp.',
          }),
          el('div', 'flex flex-wrap gap-4', {
            children: [
              el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Reserve a table' }),
              el('a', 'btn btn-neutral btn-outline btn-lg', { attrs: { href: 'mailto:reservations@vesper.example' }, text: 'Email us' }),
            ],
          }),
          el('p', 'text-base leading-relaxed text-secondary', {
            text: 'For the chef’s counter, private dining, larger parties or press, write to reservations@vesper.example and we’ll reply the same day.',
          }),
        ],
      }),
    ],
  }),
];

// ── Scheduling — dinner-only table reservations + the chef's counter ─────────────────
// Tables and the chef's counter are bookable RESOURCES (kind 'table'); "Table for two/four"
// and "The chef's counter" are RESERVATION services routing to a resource of the right kind
// by skill tag. One dinner window a night, Tue–Sat (18:00–22:00 = 1080–1320). `any_available`
// assigns the first free resource of that size. A per-cover DEPOSIT holds every table.

const DINNER = { start: 1080, end: 1320 }; // 18:00 – 22:00

/** A dinner-only resource with a single evening window Tue–Sat. */
function table(handle: string, name: string, size: string): Record<string, unknown> {
  const windows: Record<string, number>[] = [];
  for (const d of [2, 3, 4, 5, 6]) {
    windows.push({ dayOfWeek: d, startMinute: DINNER.start, endMinute: DINNER.end });
  }
  return { handle, name, kind: 'table', skillTags: [size], windows };
}

const SCHEDULING = {
  policies: [
    {
      handle: 'dinner-reservation',
      name: 'Dinner reservation',
      depositType: 'deposit',
      depositAmountCents: 2500,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 180],
      policyText:
        'A £25 per-guest deposit secures your table and comes straight off the bill on the night. Plans change — cancel or move your booking by 48 hours before and the deposit is refunded in full. We’ll remind you two days ahead and again on the day.',
    },
    {
      handle: 'chefs-counter',
      name: 'Chef’s counter',
      depositType: 'deposit',
      depositAmountCents: 5000,
      cancellationWindowHours: 72,
      reminderOffsetsMin: [4320, 1440, 180],
      policyText:
        'The six counter seats take a £50 per-guest deposit, redeemed against your bill on the night. Cancel or move by 72 hours before for a full refund. It keeps the best seats in the house fair to everyone hoping for them.',
    },
  ],
  resources: [
    table('t2-a', 'Two-top · window', 'two-top'),
    table('t2-b', 'Two-top · corner', 'two-top'),
    table('t2-c', 'Two-top · banquette', 'two-top'),
    table('t4-a', 'Four-top · centre', 'four-top'),
    table('t4-b', 'Four-top · alcove', 'four-top'),
    table('counter-a', 'Chef’s counter · seat', 'counter'),
    table('counter-b', 'Chef’s counter · seat', 'counter'),
  ],
  services: [
    {
      handle: 'table-for-two',
      name: 'Table for two',
      description:
        'A table for two in the dining room, for the full tasting menu. Two hours, unhurried — the evening is yours.',
      bookingType: 'reservation',
      durationMinutes: 120,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['two-top'], count: 1 }],
      policyHandle: 'dinner-reservation',
    },
    {
      handle: 'table-for-four',
      name: 'Table for four',
      description:
        'A table for three or four in the dining room. Make a night of it — a birthday, an anniversary, or no reason at all.',
      bookingType: 'reservation',
      durationMinutes: 120,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['four-top'], count: 1 }],
      policyHandle: 'dinner-reservation',
    },
    {
      handle: 'chefs-counter',
      name: 'The chef’s counter',
      description:
        'A seat at the pass, looking into the kitchen, for the full tasting menu told course by course by the hands that made it. Two and a half hours; a £50 per-guest deposit secures it.',
      bookingType: 'reservation',
      durationMinutes: 150,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'seat', kind: 'table', skillTags: ['counter'], count: 1 }],
      policyHandle: 'chefs-counter',
    },
  ],
};

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: ServiceSiteSpec = {
  key: 'sparx-restaurant-fine-dining',
  name: 'sparx — Fine Dining',
  summary:
    'A complete, working site for a tasting-menu restaurant: a real seven-course menu with à la carte and wine pairing, and a live reservations flow (tables and a chef’s counter as bookable resources, party-size services, dinner-only hours, a per-cover deposit) on the /reserve page. Dark, candle-lit theme — warm charcoal, gold, copper. Pages: Home, Menu, Reserve, About, Visit. Shipped as Vesper.',
  tagline: 'A dark, elegant template for a restaurant that takes reservations.',
  industry: 'Restaurant & fine dining',
  sortWeight: 84,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: {
    businessName: 'Vesper',
    tagline: 'Dinner as an occasion.',
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
      title: 'Vesper — a tasting-menu restaurant',
      description:
        'Vesper is a tasting-menu restaurant — one nightly menu built around the day’s market, a deep cellar, and a chef’s counter. Open Tue–Sat for dinner. See the menu and reserve a table.',
    },
    about: {
      title: 'About Vesper — the tasting-menu restaurant',
      description:
        'A small, chef-led tasting-menu restaurant on the harbour side — one menu a night, written each morning, cooked over embers, with a cellar built over years.',
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
  const { dir, theme } = await emitServiceBundle(SPEC);
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

  const { path: previewPath } = await writeServicePreview(SPEC, theme);
  console.log(`· preview → ${previewPath}`);
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
