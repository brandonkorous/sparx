// sparx-restaurant-cafe — a RESTAURANT / HOSPITALITY site template: an all-day café.
//
// A sibling of the gold bistro reference, dressed for daytime. A café is a BOOKING business
// (table reservations) with a MENU to read, so it runs on the service harness's scheduling
// spine — extended here with a dedicated `/menu` page. It installs a business that FUNCTIONS
// day one: a real all-day brunch menu, and a working reservations flow (tables as bookable
// resources, "Table for two/four" as reservation services, daytime opening hours, a relaxed
// no-deposit policy — walk-ins welcome) that the live `/book` (Reserve) page renders. Pages:
// Home · Menu · Reserve · About · Visit. Shipped as Kettle & Crumb, in an inline sunny-café
// theme — warm cream, a fresh café green, a cheerful coral accent.
//
// This file is JUST the SPEC; composition + emission live in the shared
// `service-sites/harness.ts` (a café sets `menu` + `chrome.navLinks` for the Menu/Reserve nav).
// Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-restaurant-cafe.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-restaurant-cafe/**" \
//     "marketplace-catalog/_gen/gen-restaurant-cafe.ts"
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
// A sunny all-day café: a bright warm-cream ground, a fresh café-green ink + primary, a
// cheerful warm-coral accent, under a rounded friendly display over a soft humanist sans.
// Complete light + dark, AA on every role (the blueprint sweep's contrast check is the gate).
// Every role used as TEXT on the cream ground sits at ≤ ~50% L so it reads clean.
const THEME = defineTheme({
  name: 'sunday-cafe',
  type: { body: face('Nunito Sans', 'sans-serif'), head: face('Poppins', 'sans-serif') },
  shape: { selector: '0.875rem', field: '0.625rem', box: '0.875rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.012 95)',
      'oklch(95% 0.02 92)',
      'oklch(91% 0.028 88)',
      'oklch(26% 0.03 150)',
    ],
    roles: {
      primary: 'oklch(48% 0.11 150)',
      secondary: 'oklch(41% 0.05 62)',
      accent: 'oklch(50% 0.16 38)',
      neutral: 'oklch(28% 0.025 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 150)',
      'oklch(19% 0.02 150)',
      'oklch(16% 0.02 150)',
      'oklch(96% 0.012 95)',
    ],
    roles: {
      primary: 'oklch(74% 0.12 150)',
      secondary: 'oklch(82% 0.04 70)',
      accent: 'oklch(74% 0.14 40)',
      neutral: 'oklch(32% 0.02 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Imagery ──────────────────────────────────────────────────────────────────────
const PHOTO: Record<string, string> = {
  "kettle-hero": "https://images.unsplash.com/photo-1710171680107-65bc3170c6cf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpZ2h0JTIwcGxhbnQtZmlsbGVkJTIwY2FmJTIwbW9ybmluZyUyMGxpZ2h0JTIwdGFibGVzJTIwYnl8ZW58MHwwfHx8MTc4NjQxNTMwMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kettle-brunch": "https://images.unsplash.com/photo-1773915950207-2d485a8e2aa2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJ1bmNoJTIwc3ByZWFkJTIwZWdncyUyMGdyZWVucyUyMHRvYXN0JTIwc3VubnklMjB0YWJsZXxlbnwwfDB8fHwxNzg2NDE1MzAzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kettle-coffee": "https://images.unsplash.com/photo-1579265898841-79c7890d69cf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmxhdCUyMHdoaXRlJTIwbGF0dGUlMjBhcnQlMjB3YXJtJTIwd29vZGVuJTIwY291bnRlcnxlbnwwfDB8fHwxNzg2NDE1MzA2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kettle-toast": "https://images.unsplash.com/photo-1585768425229-d3a88ff63ebb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bG9hZGVkJTIwdG9hc3QlMjBwbGF0ZSUyMHRvcHBlZCUyMGF2b2NhZG8lMjBjaGlsbGklMjBzb2Z0fGVufDB8MHx8fDE3ODY0MTUzMDl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kettle-pastry": "https://images.unsplash.com/photo-1515686954815-8667163e4edb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHJheSUyMGZyZXNoJTIwcGFzdHJpZXMlMjBzbGljZSUyMGNpdHJ1cyUyMGNha2V8ZW58MHwwfHx8MTc4NjQxNTMxM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kettle-room": "https://images.unsplash.com/photo-1524484485831-a92ffc0de03f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FmJTIwcm9vbSUyMGxpZ2h0fGVufDB8MHx8fDE3ODY0MTU1MDZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kettle-counter": "https://images.unsplash.com/photo-1595928642581-f50f4f3453a5?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFyaXN0YSUyMHB1bGxpbmclMjBzaG90JTIwZXNwcmVzc28lMjBjb3VudGVyfGVufDB8MHx8fDE3ODY0MTUzMTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kettle-window": "https://images.unsplash.com/photo-1692411735819-3b35dda81385?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cXVpZXQlMjB3aW5kb3clMjBzZWF0JTIwY29mZmVlJTIwYm9vayUyMHN1bnxlbnwwfDB8fHwxNzg2NDE1MzIxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (id: string): string => PHOTO[id] ?? `https://picsum.photos/seed/${id}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}

const ASSETS: Asset[] = [
  { id: 'kettle-hero', url: src('kettle-hero'), alt: 'A bright, plant-filled café in morning light, tables by tall windows' },
  { id: 'kettle-brunch', url: src('kettle-brunch'), alt: 'A brunch spread — eggs, greens and toast on a sunny table' },
  { id: 'kettle-coffee', url: src('kettle-coffee'), alt: 'A flat white with latte art on a warm wooden counter' },
  { id: 'kettle-toast', url: src('kettle-toast'), alt: 'A loaded toast plate topped with avocado, chilli and a soft egg' },
  { id: 'kettle-pastry', url: src('kettle-pastry'), alt: 'A tray of fresh pastries and a slice of citrus cake' },
  { id: 'kettle-room', url: src('kettle-room'), alt: 'The café room — light wood, hanging plants, mismatched chairs' },
  { id: 'kettle-counter', url: src('kettle-counter'), alt: 'A barista pulling a shot at the espresso counter' },
  { id: 'kettle-window', url: src('kettle-window'), alt: 'A quiet window seat with a coffee and a book in the sun' },
];

const assetUrl = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-restaurant-cafe: unknown asset "${id}"`);
  return a.url;
};

// ── Home page ──────────────────────────────────────────────────────────────────────

/** The hero — a full-bleed sunlit café photo, the name + one line in a solid readable panel,
 *  and two actions (Book → the live /book reservations surface, and View menu). */
function heroBand(): Node {
  return el('section', 'relative @container overflow-hidden bg-base-200', {
    children: [
      el('img', 'absolute inset-0 h-full w-full object-cover', {
        attrs: { src: assetUrl('kettle-hero'), alt: 'A bright, plant-filled café in morning light', loading: 'lazy' },
      }),
      el(
        'div',
        'relative mx-auto flex min-h-96 w-full max-w-5xl flex-col items-start justify-end gap-6 px-6 py-20 @3xl:px-10 @3xl:py-28',
        {
          children: [
            el('div', 'flex max-w-xl flex-col gap-5 rounded-box bg-base-100 p-8 @3xl:p-10', {
              children: [
                el('h1', 'text-5xl font-bold leading-none tracking-tight text-base-content @3xl:text-6xl', {
                  text: 'Kettle & Crumb',
                }),
                el('p', 'text-lg leading-relaxed text-base-content', {
                  text: 'A sunny all-day café. Proper coffee, unhurried brunch, and a room that’s just as happy with a laptop and a flat white as a long table of friends. Open eight to four, every day.',
                }),
                el('div', 'flex flex-wrap items-center gap-4', {
                  children: [
                    el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Book a table' }),
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

/** A short "this morning" band — three parts of the day as photo cards linking to the menu. */
function morningBand(): Node {
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
                text: 'All day, your way',
              }),
              el('p', 'max-w-2xl text-lg leading-relaxed text-base-content', {
                text: 'Roll in for a quiet coffee, settle in for a slow brunch, or grab something sweet on the way past. We serve the whole menu from open to close — no breakfast cut-off here.',
              }),
            ],
          }),
          el('div', 'grid grid-cols-1 gap-6 @3xl:grid-cols-3', {
            children: [
              card('kettle-coffee', 'Just coffee', 'Beans roasted up the road, pulled properly. Flat whites, filters, and a very good iced latte when the sun’s out.', 'A flat white with latte art'),
              card('kettle-toast', 'Brunch, all day', 'Loaded toasts, big breakfast plates, and greens that earn their place. Long tables welcome — we’ll pull them together.', 'A loaded toast plate with a soft egg'),
              card('kettle-pastry', 'Something sweet', 'The pastry case, the cake of the day, and a warm cinnamon bun that never lasts past noon. Ask what’s just come out.', 'A tray of fresh pastries and citrus cake'),
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

/** A room + reserve band — a photo beside a short invitation and the book CTA. */
function reserveBand(): Node {
  return el('section', 'bg-base-200 @container px-6 py-16 @3xl:py-20', {
    children: [
      el('div', 'mx-auto grid w-full max-w-5xl gap-8 @3xl:grid-cols-2 @3xl:items-center', {
        children: [
          el('img', 'aspect-video w-full rounded-box border border-base-300 object-cover', {
            attrs: { src: assetUrl('kettle-room'), alt: 'The café room — light wood, hanging plants, mismatched chairs', loading: 'lazy' },
          }),
          el('div', 'flex flex-col gap-5', {
            children: [
              el('h2', 'text-3xl font-bold tracking-tight text-base-content @3xl:text-4xl', {
                text: 'Save your table',
              }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: 'Weekend brunch fills up fast, so booking ahead is the safe bet — it takes about a minute and you’ll see the real availability. Walk-ins are always welcome too; there’s usually a stool at the counter with your name on it.',
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
                  row('Mon – Fri', '08:00 – 16:00'),
                  row('Saturday', '08:00 – 16:00'),
                  row('Sunday', '08:00 – 16:00'),
                  row('Kitchen', 'All day, no cut-off'),
                ],
              }),
            ],
          }),
          el('div', 'flex flex-col gap-4', {
            children: [
              el('h2', 'text-2xl font-bold tracking-tight text-base-content @3xl:text-3xl', { text: 'Find us' }),
              el('p', 'text-lg leading-relaxed text-base-content', {
                text: '9 Marigold Street, on the sunny corner by the little park. Bike racks out front, buggies and dogs always welcome, and the number 4 stops right outside.',
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

const HOME: Node[] = [heroBand(), morningBand(), reserveBand(), hoursBand()];

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
            text: 'Everything you see is served all day — no breakfast cut-off, no rush. We bake most of it here, the eggs are free-range, and there’s always something for the little ones. Tell us about allergies and we’ll sort you out.',
          }),
        ],
      }),
    ],
  }),
  menuSection('Breakfast & brunch', 'Served open to close. Add streaky bacon or an extra egg to anything for $3.', [
    { name: 'The big plate', desc: 'Two eggs how you like them, streaky bacon, roast tomato, garlic mushrooms, beans and sourdough.', price: '15' },
    { name: 'Green eggs', desc: 'Soft-scrambled eggs, wilted greens, herb oil, feta and dukkah on toasted sourdough.', price: '12' },
    { name: 'Buttermilk pancakes', desc: 'A stack of three, maple butter, seasonal fruit and a dust of icing sugar.', price: '11' },
    { name: 'Shakshuka', desc: 'Eggs baked in a spiced tomato-and-pepper sauce, whipped feta, warm flatbread to mop.', price: '13' },
    { name: 'Bircher bowl', desc: 'Overnight oats, grated apple, toasted seeds, yoghurt and a spoon of berry compote.', price: '9' },
  ]),
  menuSection('Toasts & plates', 'On our own sourdough unless you ask otherwise. Make any toast a double for $4.', [
    { name: 'Avo, chilli & lime', desc: 'Smashed avocado, quick-pickled chilli, lime, toasted seeds and a soft-poached egg.', price: '11' },
    { name: 'Mushrooms on toast', desc: 'Garlic-buttered mushrooms, thyme, aged cheddar melted through, a crack of pepper.', price: '10' },
    { name: 'Smoked salmon', desc: 'Cream cheese, cured salmon, capers, dill and shaved red onion on rye.', price: '13' },
    { name: 'Soup of the day', desc: 'Whatever’s good this week — ask the counter. Comes with buttered sourdough.', price: '8' },
    { name: 'Halloumi & slaw bowl', desc: 'Grilled halloumi, crunchy slaw, grains, roast squash and a lemon-tahini drizzle.', price: '12' },
  ]),
  menuSection('Something sweet', 'From the pastry case up front — ask what came out of the oven this morning.', [
    { name: 'Cinnamon bun', desc: 'Soft, tall and iced. Best still warm — they rarely make it past noon.', price: '5' },
    { name: 'Citrus & olive-oil cake', desc: 'A moist slice with crème fraîche and a spoon of poached rhubarb.', price: '6' },
    { name: 'Chocolate cookie', desc: 'Rye flour, sea salt, a puddle of dark chocolate. Warm on request.', price: '4' },
    { name: 'Pastry of the day', desc: 'A croissant, a morning bun, or whatever the baker felt like — ask what’s in.', price: '4' },
  ]),
  menuSection('Coffee & drinks', 'Beans roasted two streets over. Oat, soya and whole milk all on the house — no extra.', [
    { name: 'Espresso / flat white / latte', desc: 'Our house blend, pulled properly. Decaf’s just as good, honestly.', price: '4' },
    { name: 'Filter / batch brew', desc: 'A rotating single origin, brewed by the cup. Free refills before eleven.', price: '4' },
    { name: 'Iced latte / cold brew', desc: 'Slow-steeped overnight, poured long over ice. A summer regular.', price: '5' },
    { name: 'Loose-leaf tea', desc: 'English breakfast, earl grey, fresh mint or a house herbal. Proper pot.', price: '4' },
    { name: 'Fresh orange / seasonal juice', desc: 'Squeezed that morning, plus a changing house lemonade.', price: '5' },
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
            text: 'Pick your party size and a time below — you’ll see live availability across the week. No deposit, no fuss. Walk-ins are always welcome; booking just means your table’s waiting when the weekend gets busy.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'About Kettle & Crumb' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Kettle & Crumb started as a tiny coffee window and grew into the corner café we always wanted on our own street — the kind you can drop into any hour of the day and feel at home in. Sunny, unhurried, and open to everyone.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'We bake the sourdough and the pastries in-house, pull coffee from a roaster two streets over, and cook a menu that runs all day because we never understood why brunch has to stop at eleven. Most of what’s on the plate comes from growers and makers we know by name.',
          }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: 'Bring your laptop, your book, your baby or your whole football team. There’s good coffee, a warm bun, and a table with your name on it whenever you’re ready.',
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
          el('h1', 'text-5xl font-bold tracking-tight text-base-content @2xl:text-6xl', { text: 'Visit Kettle & Crumb' }),
          el('p', 'text-lg leading-relaxed text-base-content', {
            text: '9 Marigold Street, on the sunny corner by the little park. Open every day, eight till four, kitchen running the whole time. Bikes, buggies and well-behaved dogs always welcome — the number 4 stops right outside.',
          }),
          el('div', 'flex flex-wrap gap-3', {
            children: [
              el('a', 'btn btn-primary btn-lg', { attrs: { href: '/book' }, text: 'Book a table' }),
              el('a', 'btn btn-neutral btn-outline btn-lg', { attrs: { href: 'mailto:hello@kettleandcrumb.example' }, text: 'Email us' }),
            ],
          }),
          el('p', 'text-base leading-relaxed text-secondary', {
            text: 'Planning a big group, a baby shower or a morning takeover? Email hello@kettleandcrumb.example and we’ll get straight back to you.',
          }),
        ],
      }),
    ],
  }),
];

// ── Scheduling — table reservations ─────────────────────────────────────────────────
// Tables are bookable RESOURCES (kind 'table'); "Table for two/four" are RESERVATION
// services that route to a table of the right size by skill tag. The opening-hours windows
// are daytime (08:00 – 16:00 every day, seven days a week) — a café, not an evening room.
// `any_available` assigns the first free table of that size. A relaxed, no-deposit policy;
// walk-ins are always welcome.

const DAY = { start: 480, end: 960 }; // 08:00 – 16:00, all day

/** A table resource with an all-day daytime window, every day of the week. */
function table(handle: string, name: string, size: string): Record<string, unknown> {
  const windows: Record<string, number>[] = [];
  for (const d of [0, 1, 2, 3, 4, 5, 6]) {
    windows.push({ dayOfWeek: d, startMinute: DAY.start, endMinute: DAY.end });
  }
  return { handle, name, kind: 'table', skillTags: [size], windows };
}

const SCHEDULING = {
  policies: [
    {
      handle: 'table-standard',
      name: 'Table reservation',
      depositType: 'none',
      cancellationWindowHours: 2,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'No deposit, ever — just book and turn up. We hold your table for 15 minutes past your time; if your plans change, a quick heads-up by a couple of hours before frees it for someone else. Walk-ins are always welcome, so don’t worry if you didn’t book.',
    },
    {
      handle: 'group-table',
      name: 'Larger group',
      depositType: 'none',
      cancellationWindowHours: 12,
      reminderOffsetsMin: [1440, 180],
      policyText:
        'Groups of five or six get the big communal table by the window — still no deposit. If you need to cancel, letting us know the evening before means we can offer it to another party. Bigger than six? Email us and we’ll happily sort it.',
    },
  ],
  resources: [
    table('t2-window', 'Two-top · window', 'two-top'),
    table('t2-counter', 'Two-top · counter', 'two-top'),
    table('t2-nook', 'Two-top · plant nook', 'two-top'),
    table('t4-middle', 'Four-top · middle', 'four-top'),
    table('t4-corner', 'Four-top · sunny corner', 'four-top'),
    table('t6-communal', 'Six-top · communal table', 'six-top'),
  ],
  services: [
    {
      handle: 'table-for-two',
      name: 'Table for two',
      description:
        'A table for two, any time we’re open. Perfect for a slow brunch or a catch-up over coffee — an hour and a quarter is yours, and we won’t rush you off.',
      bookingType: 'reservation',
      durationMinutes: 75,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['two-top'], count: 1 }],
      policyHandle: 'table-standard',
    },
    {
      handle: 'table-for-four',
      name: 'Table for four',
      description:
        'A table for three or four — bring the family, the friends, or the whole brunch crew. Ninety unhurried minutes, high chairs on request.',
      bookingType: 'reservation',
      durationMinutes: 90,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['four-top'], count: 1 }],
      policyHandle: 'table-standard',
    },
    {
      handle: 'table-for-six',
      name: 'Table for five or six',
      description:
        'The big communal table by the window, for five or six. No deposit; for seven or more, drop us an email and we’ll set the whole corner up for you.',
      bookingType: 'reservation',
      durationMinutes: 90,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'table', kind: 'table', skillTags: ['six-top'], count: 1 }],
      policyHandle: 'group-table',
    },
  ],
};

// ── The spec ─────────────────────────────────────────────────────────────────────

const SPEC: ServiceSiteSpec = {
  key: 'sparx-restaurant-cafe',
  name: 'Café',
  summary:
    'A complete, working site for an all-day café: a real all-day brunch menu, and a live table-reservations flow (tables as bookable resources, party-size reservation services, daytime hours, a relaxed no-deposit policy — walk-ins welcome) on the /reserve page. Sunny café theme — warm cream, fresh café-green, a cheerful coral accent. Pages: Home, Menu, Reserve, About, Visit. Shipped as Kettle & Crumb.',
  tagline: 'A sunny, working template for an all-day café that takes bookings.',
  industry: 'Café & brunch',
  sortWeight: 85,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: {
    businessName: 'Kettle & Crumb',
    tagline: 'A sunny all-day café.',
  },
  theme: THEME,
  // Café nav: Menu / Reserve / About / Visit, with a "Book a table" CTA.
  chrome: {
    navbar: 'brandLeft',
    footer: 'newsletter',
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
      title: 'Kettle & Crumb — a sunny all-day café',
      description:
        'Kettle & Crumb is a bright all-day café — proper coffee, unhurried brunch served open to close, house pastries and a warm welcome. Open eight to four, every day. See the menu and book a table.',
    },
    about: {
      title: 'About Kettle & Crumb — the café',
      description:
        'A sunny corner café that bakes its own sourdough and pastries, pulls coffee from a local roaster, and serves brunch all day long — everyone welcome.',
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
