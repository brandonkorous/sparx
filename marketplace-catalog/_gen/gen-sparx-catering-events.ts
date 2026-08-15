// sparx-catering-events — "Saffron & Sage Catering", an elegant EVENTS & WEDDING caterer.
//
// The refined, seasonal, celebratory end of the catering lane: plated dinners, cocktail
// receptions, full-service weddings and corporate events, built around what's at its peak
// that week. A warm-cream ground, a deep saffron primary, a sage accent and an elegant
// serif display over a humanist sans. Deliberately the OPPOSITE of the casual BBQ / food-
// truck catering template (loud, smoky, hand-lettered) — same booking spine, a different
// business: here the bookable thing is a TASTING or a CONSULTATION, and the catering
// itself is quoted after.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-catering-events.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-catering-events/**" \
//     "marketplace-catalog/_gen/**/*.ts"

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { safeParseBlueprint } from '../../packages/blueprints/src/validate';

import {
  bookingCta,
  defineTheme,
  emitServiceBundle,
  face,
  featureRow,
  findUs,
  galleryStrip,
  photoHero,
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  testimonial,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'catering-events-hero',
  philosophy: 'catering-events-philosophy',
  about: 'catering-events-about',
  g1: 'catering-events-g1',
  g2: 'catering-events-g2',
  g3: 'catering-events-g3',
  g4: 'catering-events-g4',
  g5: 'catering-events-g5',
  g6: 'catering-events-g6',
} as const;

// EMPTY on purpose — every image resolves through the picsum fallback in `src()`, keyed by
// a unique `saffronsage-` seed. Drop a real URL in here (keyed by seed) to pin any one shot.
const PHOTO: Record<string, string> = {
  "saffronsage-hero": "https://images.unsplash.com/photo-1511795409834-ef04bbd61622?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlZ2FudCUyMGNhdGVyaW5nJTIwdGFibGUlMjBzZXR0aW5nfGVufDB8MHx8fDE3ODYzOTA2NzJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "saffronsage-philosophy": "https://images.unsplash.com/photo-1577106263724-2c8e03bfe9cf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hlZiUyMHBsYXRpbmclMjBkaXNofGVufDB8MHx8fDE3ODYzOTA2NzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "saffronsage-about": "https://images.unsplash.com/photo-1622021142947-da7dedc7c39a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2F0ZXJpbmclMjBraXRjaGVuJTIwY2hlZnxlbnwwfDB8fHwxNzg2MzkwNjc4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "saffronsage-g1": "https://images.unsplash.com/photo-1641834992266-0524e539220a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGxhdGVkJTIwZ291cm1ldCUyMGRpbm5lcnxlbnwwfDB8fHwxNzg2MzkwNjgxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "saffronsage-g2": "https://images.unsplash.com/photo-1536392706976-e486e2ba97af?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VkZGluZyUyMHJlY2VwdGlvbiUyMGRpbm5lcnxlbnwwfDB8fHwxNzg2MzkwNjg0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "saffronsage-g3": "https://images.unsplash.com/photo-1527751171053-6ac5ec50000b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FuYXBlJTIwYXBwZXRpemVyfGVufDB8MHx8fDE3ODYzOTA2ODd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "saffronsage-g4": "https://images.unsplash.com/photo-1555244162-803834f70033?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZWxlZ2FudCUyMGJ1ZmZldCUyMGZvb2R8ZW58MHwwfHx8MTc4NjM5MDY5MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "saffronsage-g5": "https://images.unsplash.com/photo-1705948730553-3ea0c89ae6fb?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZmluZSUyMGRpbmluZyUyMHBsYXRlfGVufDB8MHx8fDE3ODYzOTA2OTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "saffronsage-g6": "https://images.unsplash.com/photo-1519225421980-715cb0215aed?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXZlbnQlMjB0YWJsZSUyMGRlY29yfGVufDB8MHx8fDE3ODYzOTA2OTV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('saffronsage-hero'), alt: 'A candlelit dinner table set for a seasonal plated event' },
  { id: IMG.philosophy, url: src('saffronsage-philosophy'), alt: 'A chef finishing a plate with fresh herbs in the kitchen' },
  { id: IMG.about, url: src('saffronsage-about'), alt: 'A long harvest table dressed for a wedding reception' },
  { id: IMG.g1, url: src('saffronsage-g1'), alt: 'A plated first course with seasonal vegetables' },
  { id: IMG.g2, url: src('saffronsage-g2'), alt: 'A cocktail reception spread with canapés and glassware' },
  { id: IMG.g3, url: src('saffronsage-g3'), alt: 'A tiered dessert and grazing table at a celebration' },
  { id: IMG.g4, url: src('saffronsage-g4'), alt: 'A roasted main course carved for family-style service' },
  { id: IMG.g5, url: src('saffronsage-g5'), alt: 'Servers plating in a candlelit reception hall' },
  { id: IMG.g6, url: src('saffronsage-g6'), alt: 'A garden table set with linen, florals and warm light' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-catering-events: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "saffronsage": warm-cream ground, saffron primary, sage accent, serif display ─
const saffronsage = defineTheme({
  name: 'saffronsage',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.016 88)', // warm cream
      'oklch(93% 0.022 84)', // sand
      'oklch(87% 0.026 80)', // hairline
      'oklch(25% 0.02 45)', // warm charcoal ink
    ],
    roles: {
      primary: 'oklch(64% 0.14 62)', // deep saffron / amber
      secondary: 'oklch(34% 0.025 40)', // deep warm charcoal (readable on cream)
      accent: 'oklch(58% 0.06 135)', // sage / olive
      neutral: 'oklch(28% 0.016 45)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.016 45)',
      'oklch(18% 0.013 45)',
      'oklch(14% 0.01 45)',
      'oklch(94% 0.014 88)',
    ],
    roles: {
      primary: 'oklch(75% 0.13 66)', // warm saffron on dark
      secondary: 'oklch(80% 0.02 80)',
      accent: 'oklch(72% 0.07 135)',
      neutral: 'oklch(82% 0.016 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, coordinators + hours, the tasting menu) ──
// The bookable thing is a TASTING or a CONSULTATION — a single coordinator/chef sits with
// the host to shape the menu, style and budget. The catering itself is quoted afterward,
// so there's no room/space requirement: every service books with ONE `menu`-skilled staff.
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'catering-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Please give us at least 48 hours’ notice to change or cancel your consultation. We send a reminder two days before and again the morning of.',
    },
    {
      handle: 'tasting-deposit',
      name: 'Tasting deposit',
      depositType: 'deposit',
      depositAmountCents: 5000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Private tastings hold a $50 deposit that’s credited straight to your event when you book with us. Reschedule with 48 hours’ notice and it carries over.',
    },
  ],
  resources: [
    {
      handle: 'elena',
      name: 'Elena Marchetti',
      kind: 'staff',
      skillTags: ['weddings', 'tasting', 'menu'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'marcus',
      name: 'Marcus Bell',
      kind: 'staff',
      skillTags: ['corporate', 'tasting', 'menu'],
      windows: hours([1, 2, 3, 4, 5], 600, 1140), // Mon–Fri 10–7
    },
    {
      handle: 'priya',
      name: 'Priya Anand',
      kind: 'staff',
      skillTags: ['weddings', 'corporate', 'menu'],
      windows: hours([3, 4, 5, 6, 0], 600, 1080), // Wed–Sun 10–6
    },
  ],
  services: [
    {
      handle: 'event-consultation',
      name: 'Event consultation',
      description:
        'A relaxed sit-down to shape your menu, service style, headcount and budget — no charge, no pressure.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coordinator', kind: 'staff', skillTags: ['menu'], count: 1 }],
      policyHandle: 'catering-standard',
    },
    {
      handle: 'wedding-tasting',
      name: 'Wedding tasting',
      description:
        'Taste your wedding menu course by course and finalize the details with your coordinator.',
      durationMinutes: 90,
      priceCents: 5000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coordinator', kind: 'staff', skillTags: ['menu'], count: 1 }],
      policyHandle: 'tasting-deposit',
    },
    {
      handle: 'private-dinner-tasting',
      name: 'Private dinner tasting',
      description:
        'A guided tasting for an intimate plated dinner at home or a private venue.',
      durationMinutes: 75,
      priceCents: 5000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coordinator', kind: 'staff', skillTags: ['menu'], count: 1 }],
      policyHandle: 'tasting-deposit',
    },
    {
      handle: 'corporate-event-consult',
      name: 'Corporate event consult',
      description:
        'Plan catering for a launch, gala or company celebration — service levels, dietary needs and timing.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coordinator', kind: 'staff', skillTags: ['menu'], count: 1 }],
      policyHandle: 'catering-standard',
    },
    {
      handle: 'seasonal-menu-tasting',
      name: 'Seasonal menu tasting',
      description:
        'Sample the season’s menu — the dishes at their peak right now — and build yours from what you love.',
      durationMinutes: 90,
      priceCents: 5000,
      bufferAfterMin: 15,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coordinator', kind: 'staff', skillTags: ['menu'], count: 1 }],
      policyHandle: 'tasting-deposit',
    },
    {
      handle: 'cocktail-reception-consult',
      name: 'Cocktail reception consult',
      description:
        'Design a canapé and bar experience — passed bites, grazing stations and pairings for a standing crowd.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coordinator', kind: 'staff', skillTags: ['menu'], count: 1 }],
      policyHandle: 'catering-standard',
    },
    {
      handle: 'large-event-consult',
      name: 'Large event consult',
      description:
        'For 100+ guests — logistics, staffing, rentals and flow, mapped out with your lead coordinator.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coordinator', kind: 'staff', skillTags: ['menu'], count: 1 }],
      policyHandle: 'catering-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A candlelit dinner table set for a seasonal plated event',
    title: 'Dinners worth dressing up for',
    sub: 'Plated dinners, cocktail receptions and full-service weddings — seasonal menus, cooked from scratch and served like it matters.',
    primary: { label: 'Book a tasting', href: '/book' },
    secondary: { label: 'See our services', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Seasonal & locally sourced',
        body: 'Menus built around what’s at its peak that week, from farms and growers we actually know by name.',
      },
      {
        title: 'Full-service, start to finish',
        body: 'Chefs, servers, bar, rentals and cleanup — you host and enjoy your own party, we handle the rest.',
      },
      {
        title: 'Every guest looked after',
        body: 'Vegetarian, vegan, gluten-free and allergy-aware plates, planned in from the start — never an afterthought.',
      },
      {
        title: 'Weddings & corporate',
        body: 'From a forty-seat wedding dinner to a company gala, scaled up without ever losing the small details.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Tastings & consultations',
    intro: 'Every event starts here. Book a tasting or a consultation and we’ll build your menu together — the catering is quoted after, once it’s exactly right.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Event consultation', priceCents: 0, durationMin: 45, desc: 'Shape your menu, style and budget — no charge.' },
      { name: 'Wedding tasting', priceCents: 5000, durationMin: 90, desc: 'Taste your wedding menu, course by course.' },
      { name: 'Seasonal menu tasting', priceCents: 5000, durationMin: 90, desc: 'Sample the season’s dishes at their peak.' },
      { name: 'Cocktail reception consult', priceCents: 0, durationMin: 45, desc: 'Design canapés, stations and the bar.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.philosophy),
    alt: 'A chef finishing a plate with fresh herbs in the kitchen',
    heading: 'Cooked from scratch, in season',
    body: [
      'Saffron & Sage started in a home kitchen with one rule we’ve never broken: cook with what’s in season, from people we know, and make it taste like someone cared.',
      'Nothing arrives pre-made. We build each event’s menu around the week it happens — so a spring wedding and an autumn gala never taste the same, and both taste like the moment they’re in.',
    ],
    cta: { label: 'Book a tasting', href: '/book' },
  }),
  galleryStrip({
    heading: 'From recent events',
    surface: 'muted',
    columns: 3,
    images: [
      { src: url(IMG.g1), alt: 'A plated first course with seasonal vegetables' },
      { src: url(IMG.g2), alt: 'A cocktail reception spread with canapés and glassware' },
      { src: url(IMG.g3), alt: 'A tiered dessert and grazing table at a celebration' },
      { src: url(IMG.g4), alt: 'A roasted main course carved for family-style service' },
      { src: url(IMG.g5), alt: 'Servers plating in a candlelit reception hall' },
      { src: url(IMG.g6), alt: 'A garden table set with linen, florals and warm light' },
    ],
  }),
  testimonial({
    quote: 'They tasted our whole wedding menu with us months ahead, remembered every allergy at our table of ninety, and the food was the thing our guests still bring up. We just got to be at our own party.',
    attribution: 'Dana & Theo, married September 2025',
  }),
  bookingCta({
    title: 'Let’s plan something worth remembering',
    sub: 'Pick a tasting or a consultation, choose your coordinator and see live times. It takes about a minute.',
    cta: { label: 'Book a tasting', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.about),
    alt: 'A long harvest table dressed for a wedding reception',
    title: 'Book a tasting or consultation',
    sub: 'Choose a tasting or consultation to see live availability, then pick your coordinator and time. We’ll quote the full event afterward.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A long harvest table dressed for a wedding reception',
    heading: 'About Saffron & Sage',
    body: [
      'We’re an events kitchen built for the occasions that matter — weddings, milestones, launches and the quiet private dinners in between. Warm, seasonal food, served with the kind of care you’d give your own guests.',
      'Every event begins with a real conversation. We learn who’s coming, what they love and what they can’t eat, then design a menu around your day and the season it lands in. No packages off a shelf.',
    ],
    cta: { label: 'Book a tasting', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'A tasting first', body: 'You taste before you commit. We sit down, sample the menu and shape it together until it’s exactly your event.' },
      { title: 'Sourced with intention', body: 'Seasonal produce, local farms and honest ingredients — the short list of things worth building a menu around.' },
      { title: 'Handled end to end', body: 'Staffing, rentals, timing and cleanup are ours to manage, so on the day you get to be a guest at your own table.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the kitchen',
    address: ['Saffron & Sage Catering', '47 Marigold Lane', 'Studio B · Portland, OR 97214'],
    mapLocation: '47 Marigold Lane, Portland, OR 97214',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: '10:00 – 4:00' },
      { day: 'Sunday', time: 'By appointment' },
      { day: 'Events', time: 'Evenings & weekends' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your tasting or consultation online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a tasting', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-catering-events',
  name: 'Catering (Events & Weddings)',
  summary:
    'An elegant events-and-wedding catering site — a warm-cream palette, a deep saffron primary and a sage accent under a Fraunces serif display, with seasonal food photography carrying the page. Installs a working booking flow: tastings and consultations you book online, three event coordinators you book by name with their own hours, and a tasting-deposit policy credited to your event. Ships as "Saffron & Sage Catering", a from-scratch seasonal kitchen for weddings and events.',
  tagline: 'A refined, seasonal template for events caterers — book tastings online from day one.',
  industry: 'Catering',
  sortWeight: 58,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Saffron & Sage Catering', tagline: 'Seasonal food for occasions that matter.' },
  theme: saffronsage,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Saffron & Sage Catering — events & wedding catering',
      description:
        'Saffron & Sage is a from-scratch seasonal caterer for weddings, private dinners and corporate events in Portland. Book a tasting or consultation online.',
    },
  },
  home: HOME,
  bookIntro: BOOK_INTRO,
  about: ABOUT,
  contact: CONTACT,
  scheduling: SCHEDULING,
  assets: ASSETS,
};

// ── Main ──────────────────────────────────────────────────────────────────────
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
  }
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
