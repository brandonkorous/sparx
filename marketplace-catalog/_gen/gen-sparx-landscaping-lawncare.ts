// sparx-landscaping-lawncare — "GreenBlade Lawn Care", a friendly, dependable LAWN CARE
// & maintenance company.
//
// The approachable, "a lawn you're proud of, handled" end of landscaping: bright fresh
// grass-green over a crisp near-white ground, a friendly sturdy sans, and a recurring-
// service spine (flat-rate mowing, fertilization & weed programs, aeration, cleanups).
// Deliberately the OPPOSITE of the premium design/build landscaping template (dark
// forest, high-contrast serif, a portfolio of installs) — same booking spine, a
// completely different business: this one books a FREE QUOTE and sets up recurring
// service, and its whole promise is "set it and forget it."
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-landscaping-lawncare.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-landscaping-lawncare/**" \
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
  photoHero,
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  teamRow,
  testimonial,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  hero: 'landscaping-lawncare-hero',
  recurring: 'landscaping-lawncare-recurring',
  about: 'landscaping-lawncare-about',
  diego: 'landscaping-lawncare-diego',
  sofia: 'landscaping-lawncare-sofia',
  marcus: 'landscaping-lawncare-marcus',
} as const;

// No curated stock — every image resolves through the picsum fallback below on a unique,
// business-prefixed seed. (A real launch swaps these for the tenant's own lawn photos.)
const PHOTO: Record<string, string> = {
  "greenblade-hero": "https://images.unsplash.com/photo-1526392587392-d1627b6c134a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z3JlZW4lMjBsYXduJTIwbW93aW5nfGVufDB8MHx8fDE3ODYzOTE0NzB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenblade-recurring": "https://images.unsplash.com/photo-1458245201577-fc8a130b8829?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGF3biUyMG1vd2VyJTIwZ3Jhc3N8ZW58MHwwfHx8MTc4NjM5MTQ3NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenblade-about": "https://images.unsplash.com/photo-1734303023491-db8037a21f09?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGF3biUyMGNhcmUlMjB3b3JrZXJ8ZW58MHwwfHx8MTc4NjM5MTQ3N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenblade-diego": "https://images.unsplash.com/photo-1600486913747-55e5470d6f40?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGFuZHNjYXBlciUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTE0Nzl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenblade-sofia": "https://images.unsplash.com/photo-1724556295090-a777d9a44fc0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBnYXJkZW5lciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTE0ODJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "greenblade-marcus": "https://images.unsplash.com/photo-1772082177514-9c4470efe984?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjBvdXRkb29yfGVufDB8MHx8fDE3ODYzOTE0ODV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('greenblade-hero'), alt: 'A freshly mowed green lawn with clean, straight mowing stripes' },
  { id: IMG.recurring, url: src('greenblade-recurring'), alt: 'A tidy, healthy front lawn edged neatly along the walkway' },
  { id: IMG.about, url: src('greenblade-about'), alt: 'A GreenBlade crew mowing a wide back yard on a sunny morning' },
  { id: IMG.diego, url: src('greenblade-diego'), alt: 'Diego Alvarez, crew lead' },
  { id: IMG.sofia, url: src('greenblade-sofia'), alt: 'Sofia Reyes, lawn health technician' },
  { id: IMG.marcus, url: src('greenblade-marcus'), alt: 'Marcus Bell, crew lead' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-landscaping-lawncare: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "greenblade": crisp near-white ground, vivid grass-green primary, sunny
// accent, a dark readable secondary, friendly sturdy sans ────────────────────────────
const greenblade = defineTheme({
  name: 'greenblade',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.875rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98.5% 0.006 140)', // crisp near-white, faint green
      'oklch(96% 0.012 142)', // pale mint
      'oklch(91% 0.02 145)', // hairline
      'oklch(24% 0.03 150)', // deep green ink
    ],
    roles: {
      primary: 'oklch(70% 0.18 146)', // vivid grass green
      secondary: 'oklch(34% 0.035 152)', // dark green — readable text-secondary on light
      accent: 'oklch(83% 0.16 92)', // sunny yellow-green
      neutral: 'oklch(27% 0.02 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(21% 0.02 150)',
      'oklch(17% 0.016 150)',
      'oklch(13% 0.012 150)',
      'oklch(95% 0.01 140)',
    ],
    roles: {
      primary: 'oklch(78% 0.17 146)', // brighter grass green on dark
      secondary: 'oklch(80% 0.03 145)',
      accent: 'oklch(86% 0.15 92)',
      neutral: 'oklch(84% 0.02 145)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, crews + hours, the quote/service menu) ───
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'lawn-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Need to move a visit? Just give us 24 hours’ notice and we’ll find you a new day. We text a reminder the day before and two hours ahead so nobody’s surprised.',
    },
    {
      handle: 'recurring-plan',
      name: 'Recurring plan & first service',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Recurring plans bill per completed visit — no long-term contract, cancel any time with 24 hours’ notice. For your first service we confirm the day before, then every visit after runs on the same schedule automatically.',
    },
  ],
  resources: [
    {
      handle: 'crew-diego',
      name: 'Diego Alvarez',
      kind: 'staff',
      skillTags: ['mowing', 'cleanup', 'recurring'],
      windows: hours([1, 2, 3, 4, 5], 420, 960), // Mon–Fri 7–4
    },
    {
      handle: 'crew-sofia',
      name: 'Sofia Reyes',
      kind: 'staff',
      skillTags: ['fertilization', 'weed', 'aeration', 'recurring'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 900), // Mon–Sat 7–3
    },
    {
      handle: 'crew-marcus',
      name: 'Marcus Bell',
      kind: 'staff',
      skillTags: ['mowing', 'mulch', 'recurring'],
      windows: hours([2, 3, 4, 5, 6], 480, 1020), // Tue–Sat 8–5
    },
  ],
  services: [
    {
      handle: 'free-quote',
      name: 'Free lawn quote',
      description:
        'We stop by, walk your yard, and send a clear flat-rate quote — no pressure, no obligation. The fastest way to get started.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['recurring'], count: 1 }],
      policyHandle: 'recurring-plan',
    },
    {
      handle: 'lawn-mowing-setup',
      name: 'Recurring mowing — first visit',
      description:
        'Sets up your flat-rate mowing plan: mow, string-trim, edge and blow-off, then we keep it on schedule automatically.',
      durationMinutes: 45,
      priceCents: 4500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['mowing'], count: 1 }],
      policyHandle: 'recurring-plan',
    },
    {
      handle: 'fertilization-program',
      name: 'Fertilization program visit',
      description:
        'A season-timed feeding that greens up your lawn and thickens it over time. Priced per application in the program.',
      durationMinutes: 45,
      priceCents: 7900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['fertilization'], count: 1 }],
      policyHandle: 'recurring-plan',
    },
    {
      handle: 'weed-control-program',
      name: 'Weed control program visit',
      description:
        'Targeted treatment that knocks back broadleaf weeds and crabgrass so the grass wins. Part of the recurring program.',
      durationMinutes: 45,
      priceCents: 6900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['weed'], count: 1 }],
      policyHandle: 'recurring-plan',
    },
    {
      handle: 'aeration-overseed',
      name: 'Aeration & overseeding',
      description:
        'Core aeration to relieve compaction plus overseeding to fill thin spots — the once-a-year reset a thick lawn needs.',
      durationMinutes: 90,
      priceCents: 18000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['aeration'], count: 1 }],
      policyHandle: 'lawn-standard',
    },
    {
      handle: 'seasonal-cleanup',
      name: 'Seasonal cleanup',
      description:
        'Spring or fall reset: leaves and debris cleared, beds tidied, and everything hauled away so you start the season fresh.',
      durationMinutes: 120,
      priceCents: 22000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['cleanup'], count: 1 }],
      policyHandle: 'lawn-standard',
    },
    {
      handle: 'mulch-install',
      name: 'Mulch install',
      description:
        'Fresh mulch delivered and spread across your beds — clean edges, even depth, and a crisp look that lasts all season.',
      durationMinutes: 120,
      priceCents: 35000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'crew', kind: 'staff', skillTags: ['mulch'], count: 1 }],
      policyHandle: 'lawn-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A freshly mowed green lawn with clean, straight mowing stripes',
    title: 'A lawn you’re proud of, handled',
    sub: 'Flat-rate mowing, feeding and weed control on a schedule you never have to think about. Licensed, insured, and easy to book online.',
    primary: { label: 'Get a free quote', href: '/book' },
    secondary: { label: 'See our plans', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Flat-rate recurring plans',
        body: 'One clear price per visit — no surprise add-ons, no haggling. You always know exactly what your lawn costs.',
      },
      {
        title: 'Licensed & fully insured',
        body: 'A real, insured local company on your property — not a truck that shows up once and disappears.',
      },
      {
        title: 'Satisfaction guaranteed',
        body: 'If a visit isn’t right, we come back and make it right. That’s the deal, every single time.',
      },
      {
        title: 'Easy online scheduling',
        body: 'Book a free quote or start service in about a minute — pick a day, and we handle the rest.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we do',
    intro: 'Pick a service to see how long it takes and start booking. A free quote is always the easiest first step.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Free lawn quote', priceCents: 0, durationMin: 30, desc: 'We walk your yard and send a flat-rate price — no obligation.' },
      { name: 'Recurring mowing', priceCents: 4500, durationMin: 45, desc: 'Mow, trim, edge and blow-off, kept on schedule.' },
      { name: 'Fertilization program', priceCents: 7900, durationMin: 45, desc: 'Season-timed feeding for a thicker, greener lawn.' },
      { name: 'Weed control program', priceCents: 6900, durationMin: 45, desc: 'Targeted treatment so the grass wins.' },
      { name: 'Aeration & overseeding', priceCents: 18000, durationMin: 90, desc: 'The once-a-year reset a thick lawn needs.' },
      { name: 'Seasonal cleanup', priceCents: 22000, durationMin: 120, desc: 'Spring or fall reset, hauled away.' },
    ],
    cta: { label: 'Get your free quote', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.recurring),
    alt: 'A tidy, healthy front lawn edged neatly along the walkway',
    heading: 'Set it and forget it',
    body: [
      'Sign up once and your lawn runs itself. We show up on the same schedule, mow and maintain it, and text you when we’re done — you never have to call, remember, or chase anyone.',
      'No contracts, no lock-in. You’re billed per completed visit and can pause or cancel any time. It’s the easiest your yard has ever been.',
    ],
    cta: { label: 'Start service', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your crew',
    intro: 'The same friendly faces on your lawn each visit — people who take real pride in the work.',
    members: [
      { name: 'Diego Alvarez', role: 'Crew lead', image: url(IMG.diego), alt: 'Diego Alvarez, crew lead', bio: 'Fifteen years of mowing and cleanups. Diego runs a tight, tidy route.' },
      { name: 'Sofia Reyes', role: 'Lawn health technician', image: url(IMG.sofia), alt: 'Sofia Reyes, lawn health technician', bio: 'Fertilization, weed control and aeration — the science behind a thick lawn.' },
      { name: 'Marcus Bell', role: 'Crew lead', image: url(IMG.marcus), alt: 'Marcus Bell, crew lead', bio: 'Mowing and mulch installs with an eye for clean edges and detail.' },
    ],
  }),
  testimonial({
    quote: 'Signed up for the mowing plan and never think about my yard anymore. It just looks great every week, and the crew is genuinely nice.',
    attribution: 'Karen M., customer since 2024',
  }),
  bookingCta({
    title: 'Ready for a lawn you don’t have to think about?',
    sub: 'Get a free, no-pressure quote in about a minute. Pick a day and we’ll take it from there.',
    cta: { label: 'Get a free quote', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.recurring),
    alt: 'A tidy, healthy front lawn edged neatly along the walkway',
    title: 'Get a free quote or start service',
    sub: 'Choose an option below to see how long it takes and pick a day. A free quote is always the easiest place to start.',
    primary: { label: 'See options below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A GreenBlade crew mowing a wide back yard on a sunny morning',
    heading: 'About GreenBlade Lawn Care',
    body: [
      'GreenBlade started with a simple idea: lawn care should be dependable, fairly priced, and completely off your plate. No missed visits, no vague bills, no chasing anyone down.',
      'We’re a local, licensed and insured crew that treats every yard like our own — the same faces each week, flat-rate plans you can count on, and a standing promise to make it right if it isn’t.',
    ],
    cta: { label: 'Get a free quote', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Show up when we say', body: 'A set schedule you can rely on, with a text when we’re on the way and another when the job’s done.' },
      { title: 'One clear, flat price', body: 'You know what each visit costs before we start — no surprise fees, no upsells, no haggling.' },
      { title: 'Guaranteed, every visit', body: 'If something’s not right, we come back and fix it. Your lawn looking great is the whole job.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Where we work',
    address: ['GreenBlade Lawn Care', '4120 Maple Ridge Road', 'Cedar Grove, OH 45040'],
    mapLocation: '4120 Maple Ridge Road, Cedar Grove, OH 45040',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 5:00' },
      { day: 'Saturday', time: '8:00 – 3:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'Get a free quote and see the next available days online — no phone tag, no waiting on a callback.',
    surface: 'muted',
    cta: { label: 'Get a free quote', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-landscaping-lawncare',
  name: 'sparx — Landscaping (Lawn Care)',
  summary:
    'A bright, friendly lawn-care & maintenance site — a fresh grass-green palette on a crisp near-white ground, built around recurring service and online booking. Installs a working flow: a free-quote booking, flat-rate mowing plus fertilization, weed control, aeration, cleanups and mulch, and three crews you book with their own hours. Ships as "GreenBlade Lawn Care" — a lawn you’re proud of, handled.',
  tagline: 'A friendly lawn-care template — book a free quote and start service from day one.',
  industry: 'Landscaping',
  sortWeight: 53,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'GreenBlade Lawn Care', tagline: 'A lawn you’re proud of, handled.' },
  theme: greenblade,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'GreenBlade Lawn Care — mowing & lawn maintenance',
      description:
        'GreenBlade Lawn Care keeps your yard looking great with flat-rate mowing, fertilization and weed control on an automatic schedule. Licensed, insured, and easy to book online — get a free quote.',
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
