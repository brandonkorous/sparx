// sparx-restaurant-pizzeria — a RESTAURANT / HOSPITALITY site template: a wood-fired pizzeria
// & trattoria.
//
// A sibling of the bistro gold reference, dressed for a warmer, more casual Italian room. A
// restaurant is a BOOKING business (table reservations) with a MENU to read, so it runs on the
// service harness's scheduling spine — extended here with a dedicated `/menu` page. It installs
// a business that FUNCTIONS day one: a real wood-fired menu (Antipasti · Pizza · Pasta · Dolci ·
// Drinks), and a working reservations flow (tables as bookable resources, "Table for two/four/
// six" as reservation services, opening hours, a cancellation policy) that the live `/book`
// (Reserve) page renders. Pages: Home · Menu · Reserve · About · Visit. Shipped as Forno,
// dressed in an inline warm-terracotta theme.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `service-sites/harness.ts` (a restaurant sets `menu` + `chrome.navLinks` for the Menu/Reserve
// nav). Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-restaurant-pizzeria.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-restaurant-pizzeria/**" \
//     "marketplace-catalog/_gen/gen-restaurant-pizzeria.ts"
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
  defineTheme,
  face,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  emitServiceBundle,
  type ServiceSiteSpec,
} from './service-sites/harness';
import { writeServicePreview } from './service-sites/preview';

// ── The bespoke theme (inline) ─────────────────────────────────────────────────────
// A wood-fired pizzeria: a warm terracotta-cream ground, a confident tomato-brick red ink +
// primary, a basil-green accent, over a characterful serif display and a clean sans. Complete
// light + dark, AA on every role (the blueprint sweep's contrast check is the gate). Every role
// used as text on a light ground stays ≤ ~50% L so it reads.
const THEME = defineTheme({
  name: 'fico-forno',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.5rem', field: '0.375rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.016 70)',
      'oklch(94% 0.022 65)',
      'oklch(89% 0.03 60)',
      'oklch(25% 0.035 50)',
    ],
    roles: {
      primary: 'oklch(48% 0.15 34)',
      secondary: 'oklch(43% 0.05 50)',
      accent: 'oklch(46% 0.1 145)',
      neutral: 'oklch(28% 0.03 50)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 45)',
      'oklch(19% 0.02 45)',
      'oklch(16% 0.02 45)',
      'oklch(95% 0.016 70)',
    ],
    roles: {
      primary: 'oklch(70% 0.15 36)',
      secondary: 'oklch(78% 0.045 60)',
      accent: 'oklch(74% 0.12 145)',
      neutral: 'oklch(32% 0.02 45)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
const PHOTO: Record<string, string> = {
  "forno-hero": "https://images.unsplash.com/photo-1622880833523-7cf1c0bd4296?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29vZC1maXJlZCUyMG92ZW4lMjBnbG93aW5nJTIwYmFjayUyMHdhcm0lMjBidXN5JTIwcGl6emVyaWF8ZW58MHwwfHx8MTc4NjQxNTMyNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forno-pizza-1": "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ymxpc3RlcmVkJTIwbWFyZ2hlcml0YSUyMHBpenphJTIwZnJlc2glMjB3b29kJTIwb3ZlbiUyMGJhc2lsfGVufDB8MHx8fDE3ODY0MTUzMjh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forno-pizza-2": "https://images.unsplash.com/photo-1559108481-6b211f3a8097?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGl6emElMjB0b3BwZWQlMjBzb3BwcmVzc2F0YSUyMGhvdCUyMGhvbmV5JTIwbWFyYmxlJTIwY291bnRlcnxlbnwwfDB8fHwxNzg2NDE1MzMxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forno-pasta": "https://images.unsplash.com/photo-1473093295043-cdd812d0e601?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Ym93bCUyMGhhbmQtcm9sbGVkJTIwcGFzdGElMjB0b21hdG8lMjB0b3JuJTIwYmFzaWx8ZW58MHwwfHx8MTc4NjQxNTMzNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forno-antipasti": "https://images.unsplash.com/photo-1630534592500-d0c57ec6f1b5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c2hhcmVkJTIwYm9hcmQlMjBjdXJlZCUyMG1lYXRzJTIwb2xpdmVzJTIwYnVycmF0YXxlbnwwfDB8fHwxNzg2NDE1MzM3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forno-room": "https://images.unsplash.com/photo-1611596188718-840151555242?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJhdHRvcmlhJTIwZGluaW5nJTIwcm9vbXxlbnwwfDB8fHwxNzg2NDE1NTA5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forno-oven": "https://images.unsplash.com/photo-1579751626657-72bc17010498?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGl6emFpb2xvJTIwc2xpZGluZyUyMHBpenphJTIwaW50byUyMGZsYW1lcyUyMHdvb2QtZmlyZWQlMjBvdmVufGVufDB8MHx8fDE3ODY0MTUzNDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "forno-dolci": "https://images.unsplash.com/photo-1733197014598-b6dec85af156?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhdGUlMjB0aXJhbWlzJTIwZHVzdGVkJTIwY29jb2ElMjBiZXNpZGUlMjB0d28lMjBzbWFsbHxlbnwwfDB8fHwxNzg2NDE1MzQ2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'forno-hero', url: src('forno-hero'), alt: 'A wood-fired oven glowing at the back of a warm, busy pizzeria' },
  { id: 'forno-pizza-1', url: src('forno-pizza-1'), alt: 'A blistered Margherita pizza fresh from the wood oven, basil on top' },
  { id: 'forno-pizza-2', url: src('forno-pizza-2'), alt: 'A pizza topped with soppressata and hot honey on a marble counter' },
  { id: 'forno-pasta', url: src('forno-pasta'), alt: 'A bowl of hand-rolled pasta with tomato and torn basil' },
  { id: 'forno-antipasti', url: src('forno-antipasti'), alt: 'A shared board of cured meats, olives and burrata' },
  { id: 'forno-room', url: src('forno-room'), alt: 'The trattoria dining room — long communal tables, warm light, hanging plants' },
  { id: 'forno-oven', url: src('forno-oven'), alt: 'A pizzaiolo sliding a pizza into the flames of the wood-fired oven' },
  { id: 'forno-dolci', url: src('forno-dolci'), alt: 'A plate of tiramisù dusted with cocoa beside two small espresso cups' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-restaurant-pizzeria: unknown asset "${id}"`);
  return a.url;
};

// ── Home page ──────────────────────────────────────────────────────────────────────

/** The hero — a full-bleed wood-oven photo, the name + one line in a solid readable panel,
 *  and two actions (Reserve → the live /book reservations surface, and View menu). */
function heroBand(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('forno-hero'), alt: 'A wood-fired oven glowing at the back of a warm pizzeria', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-5xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Forno',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'A wood-fired pizzeria and trattoria. Blistered pizzas from the oven, pasta rolled that morning, and a long table with your name on it. Open for lunch and dinner, Tuesday through Sunday.',
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

/** A short "from the oven" band — three signature plates as photo cards linking to the menu. */
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
                text: 'Straight from the fire',
              }),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'The oven runs at five hundred degrees and never really cools down. Three of the things we’re pulling out of it this week — the rest is on the menu.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-6 @3xl:grid-cols-3', {
            children: [
              card('forno-antipasti', 'To share first', 'Boards for the middle of the table — burrata, cured meats, marinated olives and a pile of warm focaccia.', 'A shared board of cured meats, olives and burrata'),
              card('forno-pizza-1', 'From the oven', 'Naples-style pizza, blistered and floppy in the middle. The Margherita, the ’nduja, and a white pie with fennel sausage.', 'A blistered Margherita pizza fresh from the wood oven'),
              card('forno-dolci', 'To finish', 'Tiramisù made in trays out back, a lemon sorbetto, and affogato with a shot of proper espresso over the top.', 'A plate of tiramisù dusted with cocoa'),
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
            attrs: { src: assetUrl('forno-room'), alt: 'The trattoria dining room — long communal tables, warm light', loading: 'lazy' },
          }),
          el('div', 'flex flex-col gap-5', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'Pull up a chair',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Book online in under a minute — you’ll see the real availability and pick a time that suits you. Walk-ins are always welcome; we keep the front counter and a few tables back for people who just wander in hungry.',
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
  return el('section', 'bg-base-100 @container px-6 py-16', {
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
                  row('Sunday', '12:00 – 21:00'),
                  row('Monday', 'Closed'),
                ],
              }),
            ],
          }),
          el('div', 'flex flex-col gap-4', {
            children: [
              el('h2', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', { text: 'Find us' }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: '9 Forge Street, on the corner where the old bakery used to be. Street parking after 6pm, and the tram stops right outside the door.',
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
          el('span', 'text-lg font-semibold text-primary', { text: item.price }),
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
            text: 'Flour, fire, and not much fuss. Dough proved for two days, sauce from San Marzano tomatoes, mozzarella pulled the same morning. The specials board fills in the rest — tell us about allergies and we’ll steer you right.',
          }),
        ],
      }),
    ],
  }),
  menuSection('Antipasti', 'For the middle of the table, before the oven gets going.', [
    { name: 'Focaccia, rosemary & sea salt', desc: 'Baked all afternoon, dimpled with olive oil, torn to share.', price: '7' },
    { name: 'Burrata & marinated peppers', desc: 'Whole burrata, wood-roasted peppers, basil oil, grilled bread.', price: '14' },
    { name: 'Salumi board', desc: 'Soppressata, finocchiona and prosciutto, olives, pickled things.', price: '16' },
    { name: 'Fritto misto', desc: 'Lightly fried zucchini, artichoke and lemon, with a garlic aioli.', price: '11' },
    { name: 'Tomato & bread salad', desc: 'Panzanella — ripe tomatoes, torn focaccia, red onion, oregano.', price: '10' },
  ]),
  menuSection('Pizza', 'Naples-style — a 48-hour dough, thirty seconds in a 500° oven, blistered and floppy. Gluten-free bases on request.', [
    { name: 'Margherita', desc: 'San Marzano, fior di latte, basil, a slick of olive oil. The one we’re judged on.', price: '14' },
    { name: 'Diavola', desc: 'Spicy soppressata, chilli, mozzarella, a drizzle of hot honey.', price: '17' },
    { name: 'Salsiccia e finocchio', desc: 'Fennel sausage, mozzarella, roasted onion, wild fennel — no tomato.', price: '18' },
    { name: 'Funghi', desc: 'Mixed mushrooms, taleggio, thyme, garlic cream, no tomato.', price: '17' },
    { name: 'Marinara', desc: 'Tomato, garlic, oregano, olive oil — no cheese, all the way old-school.', price: '12' },
    { name: 'Ortolana', desc: 'Grilled aubergine, courgette, peppers, mozzarella, basil.', price: '16' },
  ]),
  menuSection('Pasta', 'Rolled and cut by hand out back each morning. Ask what’s on today.', [
    { name: 'Rigatoni all’Amatriciana', desc: 'Guanciale, tomato, pecorino, a lift of black pepper.', price: '18' },
    { name: 'Cacio e pepe', desc: 'Tonnarelli, pecorino romano, cracked pepper — three things, done right.', price: '16' },
    { name: 'Tagliatelle al ragù', desc: 'A slow Sunday beef-and-pork ragù, parmesan, ribbons of fresh pasta.', price: '19' },
    { name: 'Gnocchi al pomodoro', desc: 'Pillowy potato gnocchi, simple tomato and basil, torn mozzarella.', price: '17' },
  ]),
  menuSection('Dolci', 'A short list — plus whatever the kitchen felt like making.', [
    { name: 'Tiramisù', desc: 'Made in trays out back — espresso, mascarpone, a heavy dust of cocoa.', price: '9' },
    { name: 'Affogato', desc: 'Vanilla gelato drowned in a shot of hot espresso. Add amaretto.', price: '7' },
    { name: 'Lemon sorbetto', desc: 'Sharp, bright, and cold — the way to end a big meal.', price: '6' },
    { name: 'Cannoli', desc: 'Crisp shells piped to order, ricotta and candied peel, pistachio.', price: '8' },
  ]),
  menuSection('Drinks', 'A short Italian list — Negronis, a handful of growers’ wines, and beer from the brewery two streets over.', [
    { name: 'Negroni / Americano / Spritz', desc: 'The three that belong before dinner. Ask which vermouth’s open.', price: '11' },
    { name: 'House red / white / orange', desc: 'By the glass or carafe, low-intervention, all Italian.', price: '8' },
    { name: 'Peroni / local pale ale', desc: 'On tap — one classic, one from two streets over.', price: '6' },
    { name: 'Espresso / macchiato', desc: 'Single-origin, pulled properly, the only right ending.', price: '4' },
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
            text: 'Pick your party size and a time below — you’ll see live availability for the next few weeks. For parties of seven or more, or to take over the long table for a birthday, drop us a line and we’ll sort it.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Forno' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Forno started with an oven and a stubborn idea: that a pizzeria should feel like someone’s kitchen, not a chain. We built the oven ourselves, brick by brick, on the corner where the old bakery used to be — so the room still smells of flour and fire the way it always did.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The dough proves for two days. The sauce is San Marzano tomatoes and not much else. The pasta gets rolled and cut by hand every morning, and half the menu changes with whatever the market had that week. We keep it simple on purpose — good flour, real fire, and time.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The long communal tables are there so strangers end up passing the chilli oil. Book ahead for the weekend, but there’s always a stool at the counter for a walk-in — a pizza, a glass of something red, and a seat by the flames.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Visit Forno' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: '9 Forge Street, on the corner where the old bakery used to be. Tue–Sun for lunch and dinner; closed Monday. Street parking after 6pm, and the tram stops right outside the door.',
          }),
          el('div', 'flex flex-wrap gap-3', {
            children: [
              el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Book a table' }),
              el('a', 'btn btn-neutral btn-outline btn-lg', { attrs: { href: 'mailto:ciao@forno.example' }, text: 'Email us' }),
            ],
          }),
          el('p', 'text-base leading-relaxed text-secondary', {
            text: 'For big parties, the long table, private hire or press, email ciao@forno.example and we’ll get back to you the same day.',
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
const SUN = { start: 720, end: 1260 }; // 12:00 – 21:00

/** A table resource with lunch+dinner windows Tue–Sat and an all-day Sunday window. */
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
    table('t2-b', 'Two-top · counter', 'two-top'),
    table('t2-c', 'Two-top · by the oven', 'two-top'),
    table('t4-a', 'Four-top · middle', 'four-top'),
    table('t4-b', 'Four-top · banquette', 'four-top'),
    table('t6-a', 'Six-top · long table', 'six-top'),
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
        'The long communal table, for five or six. A card hold secures it; for seven or more, email us and we’ll take over the whole end.',
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
  key: 'sparx-restaurant-pizzeria',
  name: 'Pizzeria',
  summary:
    'A complete, working site for a wood-fired pizzeria & trattoria: a real menu (antipasti, pizza, pasta, dolci, drinks) and a live table-reservations flow (tables as bookable resources, party-size reservation services, opening hours, a cancellation policy) on the /reserve page. Warm terracotta theme — cream, tomato-brick red, a basil-green accent. Pages: Home, Menu, Reserve, About, Visit. Shipped as Forno.',
  tagline: 'Flour, fire, and a long table — a working template for a pizzeria that books tables.',
  industry: 'Restaurant & pizzeria',
  sortWeight: 85,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: {
    businessName: 'Forno',
    tagline: 'A wood-fired pizzeria & trattoria.',
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
      title: 'Forno — a wood-fired pizzeria & trattoria',
      description:
        'Forno is a wood-fired pizzeria and trattoria — Naples-style pizza, hand-rolled pasta, open Tue–Sun for lunch and dinner. See the menu and book a table.',
    },
    about: {
      title: 'About Forno — the pizzeria',
      description:
        'A wood-fired pizzeria & trattoria built around a brick oven — two-day dough, San Marzano sauce, pasta rolled by hand each morning, long communal tables.',
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
