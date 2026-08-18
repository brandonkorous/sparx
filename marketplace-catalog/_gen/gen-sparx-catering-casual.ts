// sparx-catering-casual — "Smoke & Barrel BBQ Catering", a bold CASUAL BBQ caterer.
//
// The hearty, no-fuss food-truck-and-backyard-party lane: smoked meats, taco bars,
// game-day spreads and corporate lunches. A bold, smoky look — a deep rust primary, a
// warm amber accent, a kraft off-white ground and a dark, readable charcoal secondary,
// with a sturdy condensed display (Oswald) over a plain sans (Inter). Deliberately the
// OPPOSITE of the elegant events/weddings caterer (serif, cream, understated) — same
// booking spine, a different business: here the whole point is getting a TASTING or an
// EVENT CONSULT on the calendar.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-catering-casual.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-catering-casual/**" \
//     "marketplace-catalog/_gen/**/*.ts"

import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

import { safeParseBlueprint } from '../../wizeworks/packages/blueprints/src/validate';

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
  hero: 'catering-casual-hero',
  pit: 'catering-casual-pit',
  spread1: 'catering-casual-spread1',
  spread2: 'catering-casual-spread2',
  spread3: 'catering-casual-spread3',
  spread4: 'catering-casual-spread4',
} as const;

const PHOTO: Record<string, string> = {
  "smokebarrel-hero": "https://images.unsplash.com/photo-1529692236671-f1f6cf9683ba?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFyYmVjdWUlMjBzbW9rZWQlMjBtZWF0fGVufDB8MHx8fDE3ODYzOTA2OTh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "smokebarrel-pit": "https://images.unsplash.com/photo-1605494708467-59cc8ebbe337?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmJxJTIwc21va2VyJTIwZ3JpbGx8ZW58MHwwfHx8MTc4NjM5MDcwMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "smokebarrel-brisket": "https://images.unsplash.com/photo-1558030137-d464dd688b00?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YnJpc2tldCUyMGJicXxlbnwwfDB8fHwxNzg2MzkwNzA0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "smokebarrel-tacos": "https://images.unsplash.com/photo-1599974579688-8dbdd335c77f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGFjb3MlMjBmb29kfGVufDB8MHx8fDE3ODYzOTA3MDd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "smokebarrel-ribs": "https://images.unsplash.com/photo-1679711246825-1f2bd51b16d0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmJxJTIwcmlic3xlbnwwfDB8fHwxNzg2MzkwNzEwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "smokebarrel-sides": "https://images.unsplash.com/photo-1709433420624-832e2264c346?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmJxJTIwc2lkZSUyMGRpc2hlc3xlbnwwfDB8fHwxNzg2MzkwNzEzfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('smokebarrel-hero'), alt: 'A loaded backyard BBQ spread of smoked brisket, ribs and sides' },
  { id: IMG.pit, url: src('smokebarrel-pit'), alt: 'The pitmaster tending a smoker at first light' },
  { id: IMG.spread1, url: src('smokebarrel-brisket'), alt: 'Sliced smoked brisket with a deep bark and smoke ring' },
  { id: IMG.spread2, url: src('smokebarrel-tacos'), alt: 'A build-your-own taco bar with smoked meats and toppings' },
  { id: IMG.spread3, url: src('smokebarrel-ribs'), alt: 'A rack of glazed pork ribs fresh off the smoker' },
  { id: IMG.spread4, url: src('smokebarrel-sides'), alt: 'Trays of mac and cheese, slaw, beans and cornbread' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-catering-casual: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "smoke": kraft off-white ground, deep-rust primary, amber accent, condensed head ─
const smoke = defineTheme({
  name: 'smoke',
  type: { body: face('Inter', 'sans-serif'), head: face('Oswald', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(96% 0.018 74)', // kraft off-white
      'oklch(92% 0.028 70)', // warm kraft
      'oklch(86% 0.034 66)', // hairline
      'oklch(24% 0.02 42)', // smoky charcoal ink
    ],
    roles: {
      primary: 'oklch(48% 0.152 32)', // deep smoked rust-red
      secondary: 'oklch(32% 0.022 45)', // dark charcoal (readable on kraft)
      accent: 'oklch(72% 0.162 62)', // warm ember amber
      neutral: 'oklch(26% 0.018 44)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.016 40)',
      'oklch(18% 0.013 40)',
      'oklch(14% 0.01 40)',
      'oklch(93% 0.016 78)',
    ],
    roles: {
      primary: 'oklch(63% 0.16 34)', // brighter rust on dark
      secondary: 'oklch(82% 0.02 72)', // warm light ink
      accent: 'oklch(77% 0.15 64)',
      neutral: 'oklch(82% 0.016 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, coordinators + hours, the tasting/consult menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'bbq-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Give us at least 48 hours’ notice to move or cancel a consult. We send a reminder two days out, the day before and two hours ahead.',
    },
    {
      handle: 'tasting-deposit',
      name: 'Tasting deposit',
      depositType: 'deposit',
      depositAmountCents: 4000,
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Tastings hold a $40 deposit that comes right off your event total when you book us. Reschedule with 48 hours’ notice and it carries over.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Marcus Doyle',
      kind: 'staff',
      skillTags: ['bbq', 'tasting', 'events'],
      windows: hours([2, 3, 4, 5, 6], 540, 1080), // Tue–Sat 9–6
    },
    {
      handle: 'lucia',
      name: 'Lucia Reyes',
      kind: 'staff',
      skillTags: ['tacos', 'tasting', 'events'],
      windows: hours([1, 2, 3, 4, 5], 600, 1140), // Mon–Fri 10–7
    },
    {
      handle: 'deshawn',
      name: 'DeShawn Blake',
      kind: 'staff',
      skillTags: ['corporate', 'tasting', 'events'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
  ],
  services: [
    {
      handle: 'event-consultation',
      name: 'Event consultation',
      description:
        'A free, no-pressure call to talk headcount, budget, menu and logistics. Fifteen guests or five hundred — we’ll map it out.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['tasting'], count: 1 },
      ],
      policyHandle: 'bbq-standard',
    },
    {
      handle: 'bbq-tasting',
      name: 'Signature BBQ tasting',
      description:
        'Come hungry. Brisket, pulled pork, ribs, chicken and the sides that go with them — taste the spread before you book the date.',
      durationMinutes: 60,
      priceCents: 4000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['tasting'], count: 1 },
      ],
      policyHandle: 'tasting-deposit',
    },
    {
      handle: 'backyard-party-consult',
      name: 'Backyard party consult',
      description:
        'Graduations, birthdays, family reunions — a relaxed sit-down to build a generous flat per-head spread that feeds the whole yard.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['tasting'], count: 1 },
      ],
      policyHandle: 'bbq-standard',
    },
    {
      handle: 'corporate-lunch-consult',
      name: 'Corporate lunch consult',
      description:
        'Team lunches, client meetings and office spreads — dependable drop-off or full-service, on time, with easy per-head pricing.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['tasting'], count: 1 },
      ],
      policyHandle: 'bbq-standard',
    },
    {
      handle: 'taco-bar-tasting',
      name: 'Taco bar tasting',
      description:
        'A build-your-own taco bar with smoked meats, fresh salsas and all the fixings. Taste it, tweak it, then get it on the calendar.',
      durationMinutes: 60,
      priceCents: 4000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['tasting'], count: 1 },
      ],
      policyHandle: 'tasting-deposit',
    },
    {
      handle: 'game-day-package-consult',
      name: 'Game-day package consult',
      description:
        'Wings, sliders, brisket nachos and a cooler’s worth of sides — plan the tailgate or watch-party spread that keeps everyone fed.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['tasting'], count: 1 },
      ],
      policyHandle: 'bbq-standard',
    },
    {
      handle: 'large-event-consult',
      name: 'Large event consult',
      description:
        'Weddings, company picnics and festivals from 100 guests up — full-service catering, staffing and timing planned end to end.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'coordinator', kind: 'staff', skillTags: ['tasting'], count: 1 },
      ],
      policyHandle: 'bbq-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A loaded backyard BBQ spread of smoked brisket, ribs and sides',
    title: 'Real smoke. Big spreads. Zero fuss.',
    sub: 'Low-and-slow BBQ, taco bars and game-day feasts for backyard parties and corporate lunches — catered by folks who actually run the pit.',
    primary: { label: 'Book a tasting', href: '/book' },
    secondary: { label: 'See the spreads', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Smoked low and slow, in-house',
        body: 'Brisket, pork and ribs over real wood for twelve-plus hours — never a warming tray of somebody else’s food. You taste the difference.',
      },
      {
        title: 'Feeds any crowd',
        body: 'A backyard of fifteen or a company picnic of five hundred — we scale the spread and bring enough that nobody leaves hungry.',
      },
      {
        title: 'Drop-off or full-service',
        body: 'Want it dropped hot and ready? Done. Want us to set up, serve and clean up? Also done. You pick how hands-off you want to be.',
      },
      {
        title: 'Easy flat per-head pricing',
        body: 'One clear price per guest, sides included. No surprise line items, no math the morning of — just a spread that shows up ready.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Book a tasting or a consult',
    intro: 'Start with a free consult, or come taste the spread. Live availability and the full menu are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Event consultation', priceCents: 0, durationMin: 30, desc: 'Free call — headcount, budget, menu, logistics.' },
      { name: 'Signature BBQ tasting', priceCents: 4000, durationMin: 60, desc: 'Brisket, pork, ribs, chicken and the sides.' },
      { name: 'Taco bar tasting', priceCents: 4000, durationMin: 60, desc: 'Build-your-own smoked-meat taco bar.' },
      { name: 'Corporate lunch consult', priceCents: 0, durationMin: 45, desc: 'Drop-off or full-service office spreads.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  galleryStrip({
    heading: 'Straight off the pit',
    surface: 'base',
    columns: 4,
    images: [
      { src: url(IMG.spread1), alt: 'Sliced smoked brisket with a deep bark and smoke ring' },
      { src: url(IMG.spread2), alt: 'A build-your-own taco bar with smoked meats and toppings' },
      { src: url(IMG.spread3), alt: 'A rack of glazed pork ribs fresh off the smoker' },
      { src: url(IMG.spread4), alt: 'Trays of mac and cheese, slaw, beans and cornbread' },
    ],
  }),
  splitFeature({
    image: url(IMG.pit),
    alt: 'The pitmaster tending a smoker at first light',
    heading: 'One pit, up before sunrise',
    body: [
      'Smoke & Barrel started with a backyard offset smoker, a stack of oak and way too much food for one family reunion. Word got around fast.',
      'These days we run a mobile pit and cater the whole region — but the rule hasn’t changed: everything’s smoked fresh the day of your event, by the same crew that started it.',
    ],
    cta: { label: 'Book a tasting', href: '/book' },
  }),
  testimonial({
    quote: 'We booked them for a 200-person company picnic and people are STILL talking about the brisket. Showed up early, served everyone, cleaned up. Easiest caterer we’ve ever hired.',
    attribution: 'Renée O., office manager',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Get your event on the calendar',
    sub: 'Grab a free consult or book a tasting — pick a time that works and we’ll take it from there. Takes about a minute.',
    cta: { label: 'Book a tasting', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.spread2),
    alt: 'A build-your-own taco bar with smoked meats and toppings',
    title: 'Book your tasting or consult',
    sub: 'Pick a service to see how long it takes and grab a live time — start free with a consult, or come taste the spread.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A loaded backyard BBQ spread of smoked brisket, ribs and sides',
    heading: 'About Smoke & Barrel',
    body: [
      'We’re a small crew that takes BBQ seriously and takes ourselves not at all. We smoke everything ourselves, over real wood, the day of your event — no shortcuts, no reheated trays.',
      'Backyard party, office lunch, tailgate or a wedding for three hundred — we bring a generous, hearty spread and the kind of easygoing service that makes hosting feel easy.',
    ],
    cta: { label: 'Book a tasting', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we cater',
    items: [
      { title: 'Tell us the plan', body: 'Headcount, date, vibe and budget on a quick free consult. We’ll tell you honestly what feeds your crowd best.' },
      { title: 'Taste it first', body: 'Come to a tasting and try the spread before you commit. Tweak the menu until it’s exactly what you want.' },
      { title: 'We show up ready', body: 'Everything smoked fresh, delivered hot and on time — drop-off or full-service, set up and cleaned up.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Find the pit',
    address: ['Smoke & Barrel BBQ Catering', '412 Ironworks Road', 'Kansas City, MO 64108'],
    mapLocation: '412 Ironworks Road, Kansas City, MO 64108',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '9:00 – 4:00' },
      { day: 'Sunday', time: 'Events only' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'Grab a free consult or a tasting online — see live times and lock in a slot without the phone tag.',
    surface: 'muted',
    cta: { label: 'Book a tasting', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-catering-casual',
  name: 'Catering (Casual BBQ)',
  summary:
    'A bold, smoky catering site for a casual BBQ & food-truck outfit — a kraft ground, a deep-rust primary and an ember-amber accent under a sturdy condensed display. Installs online booking for tastings and event consults: a real menu (free consults, BBQ and taco-bar tastings, corporate and game-day packages), three coordinators you book by name with their own hours, and a tasting-deposit policy. Ships as "Smoke & Barrel BBQ Catering".',
  tagline: 'A hearty, no-fuss template for BBQ & casual caterers — book tastings from day one.',
  industry: 'Catering',
  sortWeight: 57,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Smoke & Barrel BBQ Catering', tagline: 'Real smoke, big spreads, zero fuss.' },
  theme: smoke,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Smoke & Barrel BBQ Catering — real smoke, big spreads',
      description:
        'Smoke & Barrel caters low-and-slow BBQ, taco bars and game-day feasts for backyard parties and corporate lunches. Book a free consult or a tasting online.',
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
