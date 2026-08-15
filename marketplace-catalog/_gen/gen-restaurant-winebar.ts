// sparx-restaurant-winebar — a RESTAURANT / HOSPITALITY site template: an evening wine bar.
//
// A sibling of the bistro gold reference, dressed for a different room. A wine bar is a
// BOOKING business (table + bar-stool reservations) with a MENU to read, so it rides the same
// scheduling spine — extended with a dedicated `/menu` page. It installs a business that
// FUNCTIONS day one: a real by-the-glass + small-plates menu, and a working reservations flow
// (tables and bar stools as bookable resources, "Table for two/four" + "Bar seats" as
// reservation services, evening hours, a relaxed cancellation policy) that the live `/book`
// (Reserve) page renders. Pages: Home · Menu · Reserve · About · Visit. Shipped as Decant, in
// an inline moody low-lit theme — a charcoal-wine ground, a lit burgundy, a brass accent.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `service-sites/harness.ts` (a restaurant sets `menu` + `chrome.navLinks` for the Menu/Reserve
// nav). Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-restaurant-winebar.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-restaurant-winebar/**" \
//     "marketplace-catalog/_gen/gen-restaurant-winebar.ts"
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
  emitServiceBundle,
  type ServiceSiteSpec,
} from './service-sites/harness';
import { writeServicePreview } from './service-sites/preview';

// ── The bespoke theme (inline) ─────────────────────────────────────────────────────
// A low-lit wine room: a DARK charcoal-wine ground in BOTH modes (a bar that opens bright
// white is describing somewhere else), lit by a burgundy primary and a brass accent, under a
// refined literary serif over a clean sans. Light base-content ink; a LIGHT, legible secondary
// (warm oak) so nothing readable falls below the dark ground. Dark mode simply goes further
// down. The bright status set carries both modes — a deep status would vanish on a ~22% ground.
const THEME = defineTheme({
  name: 'decant-bar',
  type: { body: face('Inter', 'sans-serif'), head: face('Spectral', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(23% 0.022 18)',
      'oklch(19% 0.022 18)',
      'oklch(15% 0.02 18)',
      'oklch(93% 0.014 60)',
    ],
    roles: {
      primary: 'oklch(64% 0.14 18)',
      secondary: 'oklch(80% 0.05 70)',
      accent: 'oklch(80% 0.13 75)',
      neutral: 'oklch(32% 0.02 18)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.14 55)',
      error: 'oklch(70% 0.17 32)',
    },
  },
  dark: {
    surfaces: [
      'oklch(16% 0.018 18)',
      'oklch(13% 0.018 18)',
      'oklch(10% 0.018 18)',
      'oklch(94% 0.012 60)',
    ],
    roles: {
      primary: 'oklch(68% 0.14 18)',
      secondary: 'oklch(80% 0.05 70)',
      accent: 'oklch(82% 0.13 75)',
      neutral: 'oklch(30% 0.02 18)',
      ...STATUS_ON_DARK,
      warning: 'oklch(84% 0.14 55)',
      error: 'oklch(70% 0.17 32)',
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
const PHOTO: Record<string, string> = {
  "decant-hero": "https://images.unsplash.com/photo-1580929753530-ef52238116c5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGltbHktbGl0JTIwd2luZSUyMGJhciUyMG5pZ2h0JTIwY2FuZGxlcyUyMHJvdyUyMG9wZW58ZW58MHwwfHx8MTc4NjQxNTM3MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "decant-pour": "https://images.unsplash.com/photo-1638186095578-7e58f9f16d0d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2xhc3MlMjByZWQlMjB3aW5lJTIwYmVpbmclMjBwb3VyZWQlMjB1bmRlciUyMHdhcm18ZW58MHwwfHx8MTc4NjQxNTM3Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "decant-plate-1": "https://images.unsplash.com/photo-1591267789076-2ea305ab92ec?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGwlMjBwbGF0ZSUyMGdyaWxsZWQlMjBzZWFzb25hbCUyMHZlZ2V0YWJsZXMlMjBzaGFyZXxlbnwwfDB8fHwxNzg2NDE1Mzc1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "decant-plate-2": "https://images.unsplash.com/photo-1626628577132-f1e88acdd92c?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hhcmN1dGVyaWUlMjBjaGVlc2UlMjBib2FyZCUyMGJyZWFkJTIwaG9uZXl8ZW58MHwwfHx8MTc4NjQxNTM3OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "decant-plate-3": "https://images.unsplash.com/photo-1580307479102-f9524a79e758?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c21hbGwlMjBwbGF0ZSUyMGN1cmVkJTIwZmlzaCUyMGhlcmJzJTIwb2xpdmUlMjBvaWx8ZW58MHwwfHx8MTc4NjQxNTM4Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "decant-room": "https://images.unsplash.com/photo-1720694924759-2a2daaa98987?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2luZSUyMGJhciUyMGludGVyaW9yJTIwbWFyYmxlJTIwY291bnRlciUyMGJhciUyMHN0b29sc3xlbnwwfDB8fHwxNzg2NDE1Mzg1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "decant-shelf": "https://images.unsplash.com/photo-1560089168-4169937e37d5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2FsbCUyMHdpbmUlMjBib3R0bGVzfGVufDB8MHx8fDE3ODY0MTU1MTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'decant-hero', url: src('decant-hero'), alt: 'A dimly-lit wine bar at night, candles and a row of open bottles along the counter' },
  { id: 'decant-pour', url: src('decant-pour'), alt: 'A glass of red wine being poured under warm low light' },
  { id: 'decant-plate-1', url: src('decant-plate-1'), alt: 'A small plate of grilled seasonal vegetables to share' },
  { id: 'decant-plate-2', url: src('decant-plate-2'), alt: 'A charcuterie and cheese board with bread and honey' },
  { id: 'decant-plate-3', url: src('decant-plate-3'), alt: 'A small plate of cured fish with herbs and olive oil' },
  { id: 'decant-room', url: src('decant-room'), alt: 'The wine bar interior — a marble counter, bar stools and low pendant lighting' },
  { id: 'decant-shelf', url: src('decant-shelf'), alt: 'A wall of wine bottles on dark timber shelving behind the bar' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-restaurant-winebar: unknown asset "${id}"`);
  return a.url;
};

// ── Home page ──────────────────────────────────────────────────────────────────────

/** The hero — a full-bleed low-lit bar photo, the name + one line in a solid readable panel,
 *  and two actions (Reserve → the live /book reservations surface, and the wine list). */
function heroBand(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('decant-hero'), alt: 'A dimly-lit wine bar at night', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-5xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Decant',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'A wine bar. Low-intervention bottles, a wall of things worth opening, and a few good plates to go with them. No fuss, no lecture — pull up a stool. Open evenings, Tuesday through Saturday.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Reserve a table' }),
                    el('a', 'text-base font-semibold text-accent underline underline-offset-4', {
                      attrs: { href: '/menu' },
                      text: 'See the wine list',
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

/** An "open tonight" band — a few by-the-glass pours as a scannable list, the way a wine bar
 *  actually greets you. Text-forward, moody, linking to the full list. */
function byGlassBand(): Node {
  const pour = (name: string, note: string, price: string): Node =>
    el('li', 'flex items-baseline justify-between gap-4 border-b border-base-300 py-3', {
      children: [
        el('div', 'flex flex-col gap-1', {
          children: [
            el('span', 'text-base font-semibold text-base-content', { text: name }),
            el('span', 'text-sm leading-relaxed text-secondary', { text: note }),
          ],
        }),
        el('span', 'shrink-0 text-base font-semibold text-primary', { text: price }),
      ],
    });
  return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-10 @3xl:grid-cols-2 @3xl:gap-16', {
        children: [
          el('div', 'flex flex-col gap-4', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'Open tonight',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'We keep a dozen or so open by the glass and rotate them constantly — whatever’s drinking well and whatever we’re excited about. A few of this week’s pours. The rest is on the list, and the bottle wall is always open to browse.',
              }),
              el('a', 'inline-flex w-fit items-center gap-2 text-base font-semibold text-accent underline underline-offset-4', {
                attrs: { href: '/menu' },
                children: [el('span', undefined, { text: 'The full list' }), el('span', undefined, { text: '→' })],
              }),
            ],
          }),
          el('ul', 'flex flex-col', {
            children: [
              pour('Blanc de Faubourg, Loire', 'Chenin, skin-contact, bone-dry and a little wild.', '13'),
              pour('Cascina Vecchia, Piedmont', 'Nebbiolo, light-pressed, rose petals and tar.', '15'),
              pour('Hirondelle Rouge, Beaujolais', 'Gamay, chilled, all crunchy red fruit.', '12'),
              pour('Steinbruch Riesling, Mosel', 'Off-dry, slate and lime, endlessly drinkable.', '14'),
              pour('Poggio delle More, Etna', 'A pét-nat rosato — salty, foamy, joyful.', '13'),
            ],
          }),
        ],
      }),
    ],
  });
}

/** A short small-plates band — three signature plates as photo cards linking to the menu. */
function platesBand(): Node {
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
  return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-8', {
        children: [
          el('div', 'flex flex-col gap-3', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'A few good plates',
              }),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'Not a restaurant — a short list of small plates built to drink with. Cured things, a proper cheese board, and a couple of warm plates when you want more than a nibble.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-6 @3xl:grid-cols-3', {
            children: [
              card('decant-plate-3', 'To pick at', 'Olives, cured fish, house pickles — the salty little things a first glass wants.', 'A small plate of cured fish'),
              card('decant-plate-2', 'Cheese & charcuterie', 'A board built to order from the counter — three, five or seven, with honey and bread.', 'A charcuterie and cheese board'),
              card('decant-plate-1', 'Warm plates', 'A handful of hot things off the little kitchen — grilled greens, beans, a plate of the day.', 'A small plate of grilled vegetables'),
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
  return el('section', 'bg-base-100 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-8 @3xl:grid-cols-2 @3xl:items-center', {
        children: [
          el('img', 'aspect-video w-full rounded-box border border-base-300 object-cover', {
            attrs: { src: assetUrl('decant-room'), alt: 'The wine bar interior — a marble counter and bar stools', loading: 'lazy' },
          }),
          el('div', 'flex flex-col gap-5', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'Grab a table, or the bar',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Book a table for a proper sit-down, or reserve a couple of stools at the counter — the best seats in the house, right across from the open bottles. Book online in under a minute; we keep a few spots back for walk-ins every night.',
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
  return el('section', 'bg-base-200 @container px-6 py-16', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-8 @3xl:grid-cols-2', {
        children: [
          el('div', 'flex flex-col gap-4', {
            children: [
              el('h2', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', { text: 'Hours' }),
              el('ul', 'flex flex-col', {
                children: [
                  row('Tue – Thu', '17:00 – late'),
                  row('Fri – Sat', '17:00 – 01:00'),
                  row('Sunday', 'Private hire only'),
                  row('Monday', 'Closed'),
                ],
              }),
            ],
          }),
          el('div', 'flex flex-col gap-4', {
            children: [
              el('h2', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', { text: 'Find us' }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: '9 Cellar Court, down the side street off the old cloth market. Look for the one lit window and the bottles in it. Buzzer’s on the left.',
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

const HOME: Node[] = [heroBand(), byGlassBand(), platesBand(), reserveBand(), hoursBand()];

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
      ...(item.desc ? [el('p', 'text-base leading-relaxed text-secondary', { text: item.desc })] : []),
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
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'The list' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'A rotating dozen by the glass, a deeper wall by the bottle, and a short kitchen built to drink with. Nothing here is forever — ask what’s open, tell us what you like, and we’ll pour you something. Low-intervention where we can, always honest about what’s in the glass.',
          }),
        ],
      }),
    ],
  }),
  menuSection('By the glass', 'A rotating dozen — this is roughly this week. All available in a 125ml pour; ask for a taste before you commit.', [
    { name: 'Blanc de Faubourg · Loire', desc: 'Chenin blanc, skin-contact, bone-dry and a little wild.', price: '13' },
    { name: 'Steinbruch Riesling · Mosel', desc: 'Off-dry, slate and lime, endlessly drinkable.', price: '14' },
    { name: 'Hirondelle Rouge · Beaujolais', desc: 'Gamay, served chilled, all crunchy red fruit.', price: '12' },
    { name: 'Cascina Vecchia · Piedmont', desc: 'Nebbiolo, light-pressed, rose petals and tar.', price: '15' },
    { name: 'Poggio delle More · Etna', desc: 'A pét-nat rosato — salty, foamy, joyful.', price: '13' },
    { name: 'Clos du Héron · Jura', desc: 'Savagnin, oxidative, walnut and green apple.', price: '16' },
  ]),
  menuSection('Small plates', 'The salty, snacky things a first glass wants. Built for the middle of the table.', [
    { name: 'Marinated olives & almonds', desc: 'Warm, with orange peel and rosemary.', price: '7' },
    { name: 'House pickles', desc: 'Whatever we put up this month, in a little dish.', price: '6' },
    { name: 'Cured trout, dill, crème fraîche', desc: 'House-cured, on grilled sourdough.', price: '13' },
    { name: 'White beans, confit garlic, olive oil', desc: 'Slow-cooked, brothy, with a heel of bread.', price: '11' },
    { name: 'Grilled greens, chilli, lemon', desc: 'Whatever’s good that week, charred over coals.', price: '10' },
    { name: 'Anchovies & butter', desc: 'Good tinned Cantabrian anchovies, cold butter, toast.', price: '12' },
  ]),
  menuSection('Cheese & charcuterie', 'Built to order at the counter. Pick a number; we’ll build the board with honey, pickles and bread.', [
    { name: 'Three', desc: 'Three cuts or cheeses of your choosing.', price: '16' },
    { name: 'Five', desc: 'Five — the sweet spot for two or three of you.', price: '24' },
    { name: 'Seven', desc: 'The full board, for the table.', price: '32' },
    { name: 'Just the cheese', desc: 'A rotating three from a nearby dairy, with honeycomb.', price: '15' },
  ]),
  menuSection('Larger plates', 'A handful of warm plates off the little kitchen, when a nibble won’t do.', [
    { name: 'Wood-grilled flatbread, ’nduja, honey', desc: 'Blistered, spicy, sweet — the one everyone orders.', price: '15' },
    { name: 'Mussels, cider, garlic, cream', desc: 'A pot to share, with fries to mop it up.', price: '22' },
    { name: 'Steak, anchovy butter, watercress', desc: 'A grilled bavette, sliced, for one who’s hungry or two who aren’t.', price: '28' },
    { name: 'Mushrooms on toast, aged parmesan', desc: 'Seasonal mushrooms, garlic, a slick of butter.', price: '16' },
  ]),
  menuSection('By the bottle', 'A short peek at the wall — hundreds more downstairs. Corkage on anything you spot on the shelf is £10 to drink in.', [
    { name: 'Faubourg “Vieilles Vignes” · Loire', desc: 'The old-vine chenin, worth the sit-down.', price: '58' },
    { name: 'Cascina Vecchia Barbaresco · Piedmont', desc: 'Give it an hour and it gives everything back.', price: '92' },
    { name: 'Domaine du Héron · Jura', desc: 'Poulsard, pale and haunting, a table favourite.', price: '64' },
    { name: 'Steinbruch Grosses Gewächs · Mosel', desc: 'Dry riesling with years ahead of it.', price: '78' },
    { name: 'House pét-nat, magnum', desc: 'For a crowd — pops loud, drinks easy.', price: '110' },
  ]),
];

// ── Reserve (Book) masthead over the live reservations core ─────────────────────────

const BOOK_INTRO: Node[] = [
  el('section', 'bg-base-200 @container px-6 py-14 @3xl:py-16', {
    children: [
      el('div', 'mx-auto flex w-full max-w-5xl flex-col gap-4', {
        children: [
          el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', { text: 'Reserve' }),
          el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
            text: 'Pick your party size and a time below — you’ll see live availability for the next few weeks, tables and bar stools alike. For groups of six or more, or to enquire about hiring the room on a Sunday, drop us a line and we’ll sort it.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Decant' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Decant is a small wine bar down a side street off the old cloth market. We opened with one idea: pour the wines we actually want to drink — mostly low-intervention, mostly from growers we can name — without the ceremony that usually comes attached. No sommelier speech, no white tablecloth. Just good bottles, a warm room, and someone behind the bar who’s happy to talk if you want to and happy not to if you don’t.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The list changes every week — a rotating dozen by the glass, a wall of bottles you can browse, and a few things kept back for the regulars. The kitchen is small on purpose: a handful of plates built to go with what’s in your glass, not to compete with it.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'The room’s not big, so book ahead for a table — but there’s almost always a stool free at the bar for a glass and a plate. Come in from the cold.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Visit Decant' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: '9 Cellar Court, down the side street off the old cloth market. Open evenings Tue–Sat from 5pm; Sundays for private hire; closed Monday. Look for the one lit window with the bottles in it.',
          }),
          el('div', 'flex flex-wrap gap-3', {
            children: [
              el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Reserve a table' }),
              el('a', 'btn btn-neutral btn-outline btn-lg', { attrs: { href: 'mailto:hello@decant.example' }, text: 'Email us' }),
            ],
          }),
          el('p', 'text-base leading-relaxed text-secondary', {
            text: 'For large groups, private hire or press, email hello@decant.example and we’ll get back to you the same day.',
          }),
        ],
      }),
    ],
  }),
];

// ── Scheduling — table + bar reservations ───────────────────────────────────────────
// Tables and bar stools are bookable RESOURCES (kind 'table'); "Table for two/four" and "Bar
// seats" are RESERVATION services that route to a resource of the right size by skill tag.
// Evening-only windows Tue–Sat mirror the site's hours. `any_available` assigns the first free
// resource of that kind. The policy is relaxed — no deposit, just let us know by the day before.

const EVENING = { start: 1020, end: 1440 }; // 17:00 – 24:00

/** A bookable seat (table or bar) with an evening window Tue–Sat. */
function seat(handle: string, name: string, tag: string): Record<string, unknown> {
  const windows: Record<string, number>[] = [];
  for (const d of [2, 3, 4, 5, 6]) {
    windows.push({ dayOfWeek: d, startMinute: EVENING.start, endMinute: EVENING.end });
  }
  return { handle, name, kind: 'table', skillTags: [tag], windows };
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
        'Tables are held for 15 minutes past your time. Plans change — just let us know by the day before and we’ll free your table for someone else. We’ll send a reminder the day before and a few hours ahead.',
    },
    {
      handle: 'bar-standard',
      name: 'Bar seats',
      depositType: 'none',
      cancellationWindowHours: 12,
      reminderOffsetsMin: [180],
      policyText:
        'Bar stools are the loosest booking we do — grab them for a glass and a plate. If you can’t make it, a quick heads-up frees them for the next walk-in.',
    },
  ],
  resources: [
    seat('t2-a', 'Two-top · window', 'two-top'),
    seat('t2-b', 'Two-top · nook', 'two-top'),
    seat('t2-c', 'Two-top · candle table', 'two-top'),
    seat('t4-a', 'Four-top · banquette', 'four-top'),
    seat('t4-b', 'Four-top · corner', 'four-top'),
    seat('bar-1', 'Bar stools · pair', 'bar'),
    seat('bar-2', 'Bar stools · pair', 'bar'),
    seat('bar-3', 'Bar stools · pair', 'bar'),
  ],
  services: [
    {
      handle: 'table-for-two',
      name: 'Table for two',
      description:
        'A table for two, for the evening. Two hours is plenty for a bottle and a few plates — we won’t rush you.',
      bookingType: 'reservation',
      durationMinutes: 120,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['two-top'], count: 1 }],
      policyHandle: 'table-standard',
    },
    {
      handle: 'table-for-four',
      name: 'Table for four',
      description: 'A table for three or four. Bring the crew; we’ll keep the bottles coming.',
      bookingType: 'reservation',
      durationMinutes: 135,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['four-top'], count: 1 }],
      policyHandle: 'table-standard',
    },
    {
      handle: 'bar-seats',
      name: 'Bar seats',
      description:
        'A pair of stools at the counter — the best seats in the house, right across from the open bottles. For one or two, a glass and a plate.',
      bookingType: 'reservation',
      durationMinutes: 90,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['bar'], count: 1 }],
      policyHandle: 'bar-standard',
    },
  ],
};

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: ServiceSiteSpec = {
  key: 'sparx-restaurant-winebar',
  name: 'Wine bar',
  summary:
    'A complete, working site for an evening wine bar: a real by-the-glass and small-plates menu, and a live reservations flow (tables and bar stools as bookable resources, party-size reservation services, evening hours, a relaxed cancellation policy) on the /reserve page. Moody low-lit theme — charcoal-wine ground, a lit burgundy, a brass accent. Pages: Home, Menu, Reserve, About, Visit. Shipped as Decant.',
  tagline: 'A moody, working template for a wine bar that takes reservations.',
  industry: 'Wine bar & small plates',
  sortWeight: 85,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: {
    businessName: 'Decant',
    tagline: 'A wine bar.',
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
      title: 'Decant — a wine bar',
      description:
        'Decant is an evening wine bar — a rotating dozen by the glass, a wall of low-intervention bottles, and a few good plates. Open Tue–Sat. See the list and reserve a table.',
    },
    about: {
      title: 'About Decant — the wine bar',
      description:
        'A small, low-lit wine bar off the old cloth market — mostly low-intervention bottles from growers we can name, a short kitchen, and no ceremony. Pull up a stool.',
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
