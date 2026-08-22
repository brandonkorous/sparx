// sparx-restaurant-bistro — a RESTAURANT / HOSPITALITY site template: a neighbourhood bistro.
//
// The gold reference for the restaurant family. A restaurant is a BOOKING business (table
// reservations) with a MENU to read, so it runs on the service harness's scheduling spine —
// extended here with a dedicated `/menu` page. It installs a business that FUNCTIONS day one:
// a real menu, and a working reservations flow (tables as bookable resources, "Table for
// two/four/six" as reservation services, opening hours, a cancellation policy) that the live
// `/book` (Reserve) page renders. Pages: Home · Menu · Reserve · About · Visit. Shipped as
// Larkspur, dressed in an inline warm-bistro theme.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `service-sites/harness.ts` (a restaurant sets `menu` + `chrome.navLinks` for the Menu/Reserve
// nav). Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-restaurant-bistro.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-restaurant-bistro/**" \
//     "marketplace-catalog/_gen/gen-restaurant-bistro.ts"
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
// A warm neighbourhood bistro: a soft candle-cream ground, deep olive-green ink + primary,
// a warm amber accent, under a characterful serif display over a clean sans. Complete
// light + dark, AA on every role (the blueprint sweep's contrast check is the gate).
const THEME = defineTheme({
  name: 'larkspur-bistro',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.5rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.014 90)',
      'oklch(94% 0.018 88)',
      'oklch(89% 0.024 85)',
      'oklch(24% 0.03 130)',
    ],
    roles: {
      primary: 'oklch(40% 0.07 140)',
      secondary: 'oklch(42% 0.04 120)',
      accent: 'oklch(50% 0.13 60)',
      neutral: 'oklch(26% 0.03 130)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(21% 0.02 135)',
      'oklch(18% 0.02 135)',
      'oklch(15% 0.02 135)',
      'oklch(95% 0.014 90)',
    ],
    roles: {
      primary: 'oklch(72% 0.1 135)',
      secondary: 'oklch(76% 0.04 120)',
      accent: 'oklch(74% 0.12 65)',
      neutral: 'oklch(30% 0.02 135)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
const PHOTO: Record<string, string> = {
  "larkspur-hero": "https://images.unsplash.com/photo-1758243488341-f1e09bba6a6c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FybSUyMGJpc3RybyUyMGRpbmluZyUyMHJvb20lMjBkdXNrJTIwY2FuZGxlcyUyMGxpdHxlbnwwfDB8fHwxNzg2NDE1MjQ3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larkspur-dish-1": "https://images.unsplash.com/photo-1519233991914-26a44330ccd7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhdGVkJTIwc2Vhc29uYWwlMjBtYWluJTIwZGlzaCUyMGNlcmFtaWMlMjBwbGF0ZXxlbnwwfDB8fHwxNzg2NDE1MjUxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larkspur-dish-2": "https://images.unsplash.com/photo-1494859802809-d069c3b71a8a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZnJlc2glMjBzdGFydGVyJTIwc2FsYWQlMjBwbGF0ZWQlMjBzaW1wbHl8ZW58MHwwfHx8MTc4NjQxNTI1NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larkspur-dish-3": "https://images.unsplash.com/photo-1673791031093-eb8eefa60083?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVzc2VydCUyMHBsYXRlJTIwc3Bvb24lMjBkdXN0aW5nJTIwc3VnYXJ8ZW58MHwwfHx8MTc4NjQxNTI1N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larkspur-room": "https://images.unsplash.com/photo-1538334421852-687c439c92f4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmlzdHJvJTIwaW50ZXJpb3IlMjB3b29kZW4lMjB0YWJsZXMlMjB3YXJtJTIwbGlnaHQlMjBvcGVufGVufDB8MHx8fDE3ODY0MTUyNjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larkspur-kitchen": "https://images.unsplash.com/photo-1488992783499-418eb1f62d08?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hlZnMlMjBwbGF0aW5nJTIwZGlzaGVzJTIwYnVzeSUyMHBhc3MlMjBvcGVuJTIwa2l0Y2hlbnxlbnwwfDB8fHwxNzg2NDE1MjY0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "larkspur-bar": "https://images.unsplash.com/photo-1662738221342-8106801cee08?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGwlMjBiYXIlMjByb3clMjB3aW5lJTIwZ2xhc3NlcyUyMHdhcm0lMjBsaWdodGluZ3xlbnwwfDB8fHwxNzg2NDE1MjY3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'larkspur-hero', url: src('larkspur-hero'), alt: 'A warm bistro dining room at dusk, candles lit on set tables' },
  { id: 'larkspur-dish-1', url: src('larkspur-dish-1'), alt: 'A plated seasonal main dish on a ceramic plate' },
  { id: 'larkspur-dish-2', url: src('larkspur-dish-2'), alt: 'A fresh starter salad plated simply' },
  { id: 'larkspur-dish-3', url: src('larkspur-dish-3'), alt: 'A dessert plate with a spoon and a dusting of sugar' },
  { id: 'larkspur-room', url: src('larkspur-room'), alt: 'The bistro interior — wooden tables, warm light, an open kitchen' },
  { id: 'larkspur-kitchen', url: src('larkspur-kitchen'), alt: 'Chefs plating dishes on a busy pass in an open kitchen' },
  { id: 'larkspur-bar', url: src('larkspur-bar'), alt: 'A small bar with a row of wine glasses and warm lighting' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-restaurant-bistro: unknown asset "${id}"`);
  return a.url;
};

// ── Home page ──────────────────────────────────────────────────────────────────────

/** The hero — a full-bleed dining-room photo, the name + one line in a solid readable panel,
 *  and two actions (Reserve → the live /book reservations surface, and View menu). */
function heroBand(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('larkspur-hero'), alt: 'A warm bistro dining room at dusk', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-5xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Larkspur',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'A neighbourhood bistro. Seasonal plates, an honest wine list, and a room that fills up on a Tuesday. Open for lunch and dinner, Wednesday through Sunday.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Reserve a table' }),
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

/** A short "tonight" band — three signature plates as photo cards linking to the menu. */
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
                text: 'On the menu now',
              }),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'The menu changes with the season and what the market has that morning. A few of the things we’re cooking this week.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-6 @3xl:grid-cols-3', {
            children: [
              card('larkspur-dish-2', 'To start', 'Little plates to share — this week, burrata with grilled peaches and a plate of house focaccia.', 'A fresh starter salad plated simply'),
              card('larkspur-dish-1', 'Mains', 'Seasonal mains from the wood grill — ask about tonight’s fish and the dry-aged steak for two.', 'A plated seasonal main dish'),
              card('larkspur-dish-3', 'To finish', 'A short, changing dessert list, and a proper cheese board with everything from a nearby dairy.', 'A dessert plate with a spoon'),
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

/** A room + reserve band — a photo beside a short invitation and the reserve CTA. */
function reserveBand(): Node {
  return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-8 @3xl:grid-cols-2 @3xl:items-center', {
        children: [
          el('img', 'aspect-video w-full rounded-box border border-base-300 object-cover', {
            attrs: { src: assetUrl('larkspur-room'), alt: 'The bistro interior — wooden tables, warm light', loading: 'lazy' },
          }),
          el('div', 'flex flex-col gap-5', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'A table’s waiting',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Book online in under a minute — you’ll see the real availability and pick a time that suits you. Walk-ins are always welcome at the bar, and we keep a few tables back for them every night.',
              }),
              el('div', 'flex flex-wrap gap-3', {
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
              el('h2', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', { text: 'Hours' }),
              el('ul', 'flex flex-col', {
                children: [
                  row('Wed – Thu', '12:00 – 15:00 · 17:30 – 22:00'),
                  row('Fri – Sat', '12:00 – 15:00 · 17:30 – 23:00'),
                  row('Sunday', '12:00 – 16:00'),
                  row('Mon – Tue', 'Closed'),
                ],
              }),
            ],
          }),
          el('div', 'flex flex-col gap-4', {
            children: [
              el('h2', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', { text: 'Find us' }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: '18 Larkspur Lane, in the old print works off the market square. Street parking after 6pm, and the number 12 stops at the corner.',
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

const HOME: Node[] = [heroBand(), tonightBand(), reserveBand(), hoursBand()];

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
            text: 'Seasonal, changing, and cooked simply. This is roughly what you’ll find this week — the specials board fills in the rest. Let us know about allergies and we’ll steer you right.',
          }),
        ],
      }),
    ],
  }),
  menuSection('To start', 'Made for the middle of the table.', [
    { name: 'House focaccia, whipped butter', desc: 'Baked through the afternoon, salt-crusted, with cultured butter.', price: '6' },
    { name: 'Burrata, grilled peaches, basil', desc: 'Whole burrata, market peaches off the grill, aged balsamic.', price: '13' },
    { name: 'Chicory & walnut salad', desc: 'Bitter leaves, toasted walnuts, a sharp mustard dressing, shaved hard cheese.', price: '10' },
    { name: 'Soup of the day', desc: 'Whatever’s best that morning — ask your server. Served with bread.', price: '8' },
  ]),
  menuSection('From the grill', 'Cooked over wood. Mains come as they are — sides are separate.', [
    { name: 'Dry-aged sirloin, for two', desc: '35-day aged, carved at the table, with bone marrow butter and watercress.', price: '68' },
    { name: 'Whole market fish', desc: 'Today’s catch, grilled on the bone, lemon, capers, brown butter.', price: '28' },
    { name: 'Half chicken, under a brick', desc: 'Free-range, pressed crisp, with roast garlic and pan juices.', price: '24' },
    { name: 'Wild mushroom & barley', desc: 'Pearl barley, seasonal mushrooms, aged parmesan, a poached egg.', price: '19' },
  ]),
  menuSection('Sides', '', [
    { name: 'Skin-on fries, rosemary salt', desc: '', price: '6' },
    { name: 'Charred greens, chilli, lemon', desc: '', price: '7' },
    { name: 'Roast potatoes, garlic & thyme', desc: '', price: '6' },
  ]),
  menuSection('To finish', 'A short list — plus a cheese board from the dairy up the road.', [
    { name: 'Dark chocolate & sea salt tart', desc: 'Bitter chocolate, flaky pastry, crème fraîche.', price: '9' },
    { name: 'Seasonal fruit crumble', desc: 'Whatever’s ripe, oat crumble, proper custard.', price: '8' },
    { name: 'Cheese board', desc: 'Three cheeses, quince, oatcakes, honeycomb.', price: '14' },
  ]),
  menuSection('To drink', 'A short, low-intervention wine list, plus beer from the brewery two streets over.', [
    { name: 'House red / white / orange', desc: 'By the glass or carafe — ask what’s open.', price: '7' },
    { name: 'Local pale ale', desc: 'On tap, from two streets over.', price: '6' },
    { name: 'Non-alcoholic aperitif', desc: 'House-made, bitter and bright.', price: '6' },
  ]),
];

// ── Reserve (Book) masthead over the live reservations core ─────────────────────────

const BOOK_INTRO: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-14 @3xl:py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Reserve a table' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Pick your party size and a time below — you’ll see live availability for the next few weeks. For parties of seven or more, or a private-room enquiry, drop us a line and we’ll look after it.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Larkspur' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Larkspur is a neighbourhood bistro in an old print works off the market square. We opened with one idea: cook seasonal food simply, pour honest wine, and run the kind of room you’d want on your own street — the sort you can book for a birthday or fall into on a wet Tuesday.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The menu changes with the season and with what the market has that morning, so it’s never quite the same twice. We buy from growers and producers we know by name, cook most of it over wood, and make the bread, the pasta and the puddings in-house.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The room is small on purpose. Book ahead for dinner, especially at the weekend — but there’s always a stool at the bar for a walk-in, a glass and a plate.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Visit Larkspur' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: '18 Larkspur Lane, in the old print works off the market square. Wed–Sun for lunch and dinner; closed Monday and Tuesday. Street parking after 6pm, and the number 12 stops at the corner.',
          }),
          el('div', 'flex flex-wrap gap-3', {
            children: [
              el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Reserve a table' }),
              el('a', 'btn btn-neutral btn-outline btn-lg', { attrs: { href: 'mailto:hello@larkspur.example' }, text: 'Email us' }),
            ],
          }),
          el('p', 'text-base leading-relaxed text-secondary', {
            text: 'For large parties, private hire or press, email hello@larkspur.example and we’ll get back to you the same day.',
          }),
        ],
      }),
    ],
  }),
];

// ── Scheduling — table reservations ─────────────────────────────────────────────────
// Tables are bookable RESOURCES (kind 'table'); "Table for two/four/six" are RESERVATION
// services that route to a table of the right size by skill tag. Opening-hours windows mirror
// the site's hours. `any_available` assigns the first free table of that size.

const LUNCH = { start: 720, end: 900 }; // 12:00 – 15:00
const DINNER = { start: 1050, end: 1320 }; // 17:30 – 22:00
const SUN = { start: 720, end: 960 }; // 12:00 – 16:00

/** A table resource with lunch+dinner windows Wed–Sat and a Sunday lunch window. */
function table(handle: string, name: string, size: string): Record<string, unknown> {
  const windows: Record<string, number>[] = [];
  for (const d of [3, 4, 5, 6]) {
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
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 180],
      policyText:
        'Tables are held for 15 minutes past your time. Plans change — just let us know by the day before and we’ll free your table for someone else. We’ll remind you the day before and a few hours ahead.',
    },
    {
      handle: 'large-party',
      name: 'Large party hold',
      depositType: 'card_hold',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 180],
      policyText:
        'Parties of six place a card hold to secure the table — nothing is charged unless you cancel inside 48 hours or don’t show. It keeps the big tables fair for everyone.',
    },
  ],
  resources: [
    table('t2-a', 'Two-top · window', 'two-top'),
    table('t2-b', 'Two-top · nook', 'two-top'),
    table('t2-c', 'Two-top · bar rail', 'two-top'),
    table('t4-a', 'Four-top · middle', 'four-top'),
    table('t4-b', 'Four-top · banquette', 'four-top'),
    table('t6-a', 'Six-top · corner', 'six-top'),
  ],
  services: [
    {
      handle: 'table-for-two',
      name: 'Table for two',
      description:
        'A table for two, for lunch or dinner. Ninety minutes at the weekend, longer midweek — we won’t rush you.',
      bookingType: 'reservation',
      durationMinutes: 90,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['two-top'], count: 1 }],
      policyHandle: 'table-standard',
    },
    {
      handle: 'table-for-four',
      name: 'Table for four',
      description: 'A table for three or four. Bring the family, or make it a double date.',
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
        'The big corner table, for five or six. A card hold secures it; for seven or more, email us and we’ll sort it.',
      bookingType: 'reservation',
      durationMinutes: 120,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['six-top'], count: 1 }],
      policyHandle: 'large-party',
    },
  ],
};

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: ServiceSiteSpec = {
  key: 'sparx-restaurant-bistro',
  name: 'Bistro',
  summary:
    'A complete, working site for a neighbourhood restaurant: a real seasonal menu, and a live table-reservations flow (tables as bookable resources, party-size reservation services, opening hours, a cancellation policy) on the /reserve page. Warm bistro theme — candle-cream, deep olive-green, a warm amber accent. Pages: Home, Menu, Reserve, About, Visit. Shipped as Larkspur.',
  tagline: 'A warm, working template for a restaurant that takes reservations.',
  industry: 'Restaurant & bistro',
  sortWeight: 86,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: {
    businessName: 'Larkspur',
    tagline: 'A neighbourhood bistro.',
  },
  theme: THEME,
  // Restaurant nav: Menu / Reserve / About / Visit, with a "Reserve a table" CTA.
  chrome: {
    navbar: 'brandLeft',
    footer: 'columns',
    showCta: true,
    ctaLabel: 'Reserve a table',
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
      title: 'Larkspur — a neighbourhood bistro',
      description:
        'Larkspur is a neighbourhood bistro — seasonal plates cooked over wood, an honest wine list, open Wed–Sun for lunch and dinner. See the menu and reserve a table.',
    },
    about: {
      title: 'About Larkspur — the bistro',
      description:
        'A small, seasonal neighbourhood bistro in an old print works — cooked over wood, bread and pasta made in-house, wine poured honestly.',
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
