// sparx-pool-service — "BlueWave Pool Care", a friendly, dependable WEEKLY POOL
// CLEANING & maintenance service.
//
// The bright, everyday, "a sparkling pool, handled every week" end of pool care: a vivid
// aqua/pool-blue over a crisp near-white ground, a friendly clean sans, and a recurring-
// service spine (weekly cleaning & chemical balancing, openings/closings, filter care,
// green-to-clean rescue). Deliberately the friendly maintenance SIBLING of the pool
// repair/equipment/renovation template — same booking spine, a different business: this
// one books a FREE QUOTE and sets up recurring weekly service, and its whole promise is
// "set it and forget it, and swim."
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-pool-service.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-pool-service/**" \
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
  hero: 'pool-service-hero',
  recurring: 'pool-service-recurring',
  about: 'pool-service-about',
  carlos: 'pool-service-carlos',
  jasmine: 'pool-service-jasmine',
  tyler: 'pool-service-tyler',
} as const;

// No curated stock — every image resolves through the picsum fallback below on a unique,
// business-prefixed seed. (A real launch swaps these for the tenant's own pool photos.)
const PHOTO: Record<string, string> = {
  "bluewave-hero": "https://images.unsplash.com/photo-1558617320-e695f0d420de?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xlYW4lMjBzd2ltbWluZyUyMHBvb2x8ZW58MHwwfHx8MTc4NjM5NDIwNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "bluewave-recurring": "https://images.unsplash.com/photo-1542029401157-d21e500b1385?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG9vbCUyMGNsZWFuaW5nJTIwc2tpbW1lcnxlbnwwfDB8fHwxNzg2Mzk0MjA5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "bluewave-about": "https://images.unsplash.com/photo-1657383543368-7d929944be6a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YmFja3lhcmQlMjBwb29sJTIwd2F0ZXJ8ZW58MHwwfHx8MTc4NjM5NDIxMnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "bluewave-carlos": "https://images.unsplash.com/photo-1530983822321-fcac2d3c0f06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG9vbCUyMHRlY2huaWNpYW4lMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2Mzk0MjE1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "bluewave-jasmine": "https://images.unsplash.com/photo-1615464670798-6e92fafa2a89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3b3JrZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyNjQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "bluewave-tyler": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODkyNjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('bluewave-hero'), alt: 'A sparkling clean backyard swimming pool with crystal-clear blue water' },
  { id: IMG.recurring, url: src('bluewave-recurring'), alt: 'A pristine pool skimmed and balanced, ready to swim on a sunny afternoon' },
  { id: IMG.about, url: src('bluewave-about'), alt: 'A BlueWave technician skimming and servicing a residential pool' },
  { id: IMG.carlos, url: src('bluewave-carlos'), alt: 'Carlos Mendez, lead pool technician' },
  { id: IMG.jasmine, url: src('bluewave-jasmine'), alt: 'Jasmine Park, water-care specialist' },
  { id: IMG.tyler, url: src('bluewave-tyler'), alt: 'Tyler Brooks, service technician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-pool-service: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "bluewave": crisp near-white ground, vivid aqua pool-blue primary, bright
// teal accent, a dark readable secondary, friendly clean sans ─────────────────────────
const bluewave = defineTheme({
  name: 'bluewave',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.625rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98.5% 0.006 230)', // crisp near-white, faint pool-blue
      'oklch(96% 0.014 228)', // pale sky
      'oklch(91% 0.024 226)', // hairline
      'oklch(24% 0.03 242)', // deep navy ink
    ],
    roles: {
      primary: 'oklch(62% 0.16 232)', // vivid aqua pool blue
      secondary: 'oklch(34% 0.04 240)', // dark navy — readable text-secondary on light
      accent: 'oklch(74% 0.13 195)', // bright fresh teal
      neutral: 'oklch(27% 0.02 240)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(21% 0.02 240)',
      'oklch(17% 0.016 240)',
      'oklch(13% 0.012 240)',
      'oklch(95% 0.01 230)',
    ],
    roles: {
      primary: 'oklch(72% 0.15 232)', // brighter aqua on dark
      secondary: 'oklch(80% 0.03 235)',
      accent: 'oklch(80% 0.12 195)',
      neutral: 'oklch(84% 0.02 235)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, techs + hours, the quote/service menu) ───
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'pool-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Need to move a visit? Just give us 24 hours’ notice and we’ll find you a new day. We text a reminder the day before and two hours ahead, so nobody’s surprised — and you never have to be home for us to service the pool.',
    },
    {
      handle: 'recurring-plan',
      name: 'Weekly plan & first service',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Weekly plans bill per completed visit — no long-term contract, cancel any time with 24 hours’ notice. For your first service we confirm the day before, then every visit after runs on the same schedule automatically and we send a quick recap when the pool’s done.',
    },
  ],
  resources: [
    {
      handle: 'tech-carlos',
      name: 'Carlos Mendez',
      kind: 'staff',
      skillTags: ['cleaning', 'chemicals', 'recurring'],
      windows: hours([1, 2, 3, 4, 5], 420, 960), // Mon–Fri 7–4
    },
    {
      handle: 'tech-jasmine',
      name: 'Jasmine Park',
      kind: 'staff',
      skillTags: ['opening', 'closing', 'cleaning'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 900), // Mon–Sat 7–3
    },
    {
      handle: 'tech-tyler',
      name: 'Tyler Brooks',
      kind: 'staff',
      skillTags: ['filter', 'cleaning', 'recurring'],
      windows: hours([2, 3, 4, 5, 6], 480, 1020), // Tue–Sat 8–5
    },
  ],
  services: [
    {
      handle: 'free-quote',
      name: 'Free pool quote',
      description:
        'We stop by, look at your pool and equipment, and send a clear flat-rate quote for weekly service — no pressure, no obligation. The fastest way to get started.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['recurring'], count: 1 }],
      policyHandle: 'recurring-plan',
    },
    {
      handle: 'weekly-service-setup',
      name: 'Weekly pool service — first visit',
      description:
        'Sets up your weekly plan: skim, brush and vacuum, empty baskets, test and balance the water, then we keep it sparkling on the same schedule automatically.',
      durationMinutes: 45,
      priceCents: 6500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['recurring'], count: 1 }],
      policyHandle: 'recurring-plan',
    },
    {
      handle: 'one-time-cleaning',
      name: 'One-time cleaning',
      description:
        'A full single-visit clean: skim, brush, vacuum, empty the baskets and balance the chemistry — perfect before a party or to see the difference for yourself.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['cleaning'], count: 1 }],
      policyHandle: 'pool-standard',
    },
    {
      handle: 'pool-opening',
      name: 'Pool opening',
      description:
        'The spring reset: cover off and cleaned, equipment reconnected and started, water topped off and balanced, and the pool brought clear so you’re ready to swim.',
      durationMinutes: 120,
      priceCents: 28000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['opening'], count: 1 }],
      policyHandle: 'pool-standard',
    },
    {
      handle: 'pool-closing',
      name: 'Pool closing',
      description:
        'End-of-season winterizing: lines blown out and plugged, equipment drained and stored, chemistry set for the off-season, and the cover on tight to protect it.',
      durationMinutes: 120,
      priceCents: 28000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['closing'], count: 1 }],
      policyHandle: 'pool-standard',
    },
    {
      handle: 'filter-service',
      name: 'Filter clean & service',
      description:
        'A deep filter clean — cartridges rinsed or the D.E./sand element serviced — so water flows freely and your pump isn’t working overtime. Recommended a few times a season.',
      durationMinutes: 60,
      priceCents: 14000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['filter'], count: 1 }],
      policyHandle: 'pool-standard',
    },
    {
      handle: 'green-to-clean-treatment',
      name: 'Green-to-clean treatment',
      description:
        'A green, cloudy pool brought back to blue — heavy skim, brush and vacuum, a shock and balance, and follow-up until it’s crystal clear and safe to swim again.',
      durationMinutes: 90,
      priceCents: 32000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['chemicals'], count: 1 }],
      policyHandle: 'pool-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A sparkling clean backyard swimming pool with crystal-clear blue water',
    title: 'A sparkling pool, handled every week',
    sub: 'Weekly cleaning, chemical balancing and everything your pool needs — on a schedule you never have to think about. Licensed, insured, and easy to book online.',
    primary: { label: 'Get a free quote', href: '/book' },
    secondary: { label: 'See our plans', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Weekly service, set and forget',
        body: 'We show up on the same day every week, service the pool, and text you when it’s done. You never have to be home, remember, or lift a net.',
      },
      {
        title: 'Licensed & fully insured',
        body: 'A real, insured local company caring for your pool — not a truck that shows up once and disappears when the water turns green.',
      },
      {
        title: 'One transparent flat price',
        body: 'A clear weekly rate with no surprise add-ons and no haggling. You always know exactly what your pool costs each month.',
      },
      {
        title: 'Always-balanced water',
        body: 'Every visit we test and adjust chlorine, pH and more — so the water stays clear, gentle on skin and eyes, and safe to swim in.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we do',
    intro: 'Pick a service to see how long it takes and start booking. A free quote is always the easiest first step.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Free pool quote', priceCents: 0, durationMin: 30, desc: 'We look at your pool and send a flat-rate weekly price — no obligation.' },
      { name: 'Weekly pool service', priceCents: 6500, durationMin: 45, desc: 'Skim, brush, vacuum, empty baskets and balance — kept on schedule.' },
      { name: 'One-time cleaning', priceCents: 12000, durationMin: 60, desc: 'A full single-visit clean and balance before a party or as a trial.' },
      { name: 'Pool opening', priceCents: 28000, durationMin: 120, desc: 'The spring reset — cover off, equipment on, water clear.' },
      { name: 'Filter clean & service', priceCents: 14000, durationMin: 60, desc: 'A deep filter clean so water flows and your pump breathes easy.' },
      { name: 'Green-to-clean treatment', priceCents: 32000, durationMin: 90, desc: 'A green, cloudy pool brought all the way back to blue.' },
    ],
    cta: { label: 'Get your free quote', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.recurring),
    alt: 'A pristine pool skimmed and balanced, ready to swim on a sunny afternoon',
    heading: 'Set it and forget it, and just swim',
    body: [
      'Sign up once and your pool takes care of itself. We arrive on the same day each week, clean it, balance the water, and text you a quick recap — you never have to call, remember, or chase anyone down.',
      'No contracts, no lock-in. You’re billed per completed visit and can pause or cancel any time. It’s the easiest your backyard has ever been — clear water waiting every weekend.',
    ],
    cta: { label: 'Start weekly service', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your techs',
    intro: 'The same friendly, trained faces at your pool each week — people who take real pride in clear water.',
    members: [
      { name: 'Carlos Mendez', role: 'Lead pool technician', image: url(IMG.carlos), alt: 'Carlos Mendez, lead pool technician', bio: 'Twelve years on residential pools. Carlos runs a tidy, reliable weekly route.' },
      { name: 'Jasmine Park', role: 'Water-care specialist', image: url(IMG.jasmine), alt: 'Jasmine Park, water-care specialist', bio: 'Openings, closings and chemistry — the know-how behind safe, balanced water.' },
      { name: 'Tyler Brooks', role: 'Service technician', image: url(IMG.tyler), alt: 'Tyler Brooks, service technician', bio: 'Filters, cleanings and green-to-clean rescues, with an eye for the details.' },
    ],
  }),
  testimonial({
    quote: 'Signed up for the weekly plan and I don’t think about the pool anymore — it’s just clear and ready every Saturday. The techs are friendly and I always get a text when they’re done.',
    attribution: 'Denise R., customer since 2024',
  }),
  bookingCta({
    title: 'Ready for a pool you don’t have to think about?',
    sub: 'Get a free, no-pressure quote in about a minute. Pick a day and we’ll take it from there.',
    cta: { label: 'Get a free quote', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.recurring),
    alt: 'A pristine pool skimmed and balanced, ready to swim on a sunny afternoon',
    title: 'Get a free quote or book service',
    sub: 'Choose an option below to see how long it takes and pick a day. A free quote is always the easiest place to start.',
    primary: { label: 'See options below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A BlueWave technician skimming and servicing a residential pool',
    heading: 'About BlueWave Pool Care',
    body: [
      'BlueWave started with a simple idea: owning a pool should be all fun and no chore. No skimming after work, no guessing at chemicals, no green surprise after a week away — just clear water, always ready.',
      'We’re a local, licensed and insured team that treats every pool like our own — the same trained techs each week, flat-rate plans you can count on, and a standing promise to make it right if a visit isn’t perfect.',
    ],
    cta: { label: 'Get a free quote', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Show up when we say', body: 'A set weekly day you can rely on, with a text when we’re on the way and another with a recap once the pool’s done.' },
      { title: 'One clear, flat price', body: 'You know what weekly service costs before we start — no surprise fees, no upsells, no haggling.' },
      { title: 'Balanced, tested, guaranteed', body: 'Every visit we test and balance the water, and if something’s ever off, we come back and fix it. Clear, safe water is the whole job.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Where we work',
    address: ['BlueWave Pool Care', '2185 Seabreeze Drive', 'Palm Harbor, FL 34683'],
    mapLocation: '2185 Seabreeze Drive, Palm Harbor, FL 34683',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 5:00' },
      { day: 'Saturday', time: '7:00 – 3:00' },
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
  key: 'sparx-pool-service',
  name: 'Pool Service',
  summary:
    'A bright, fresh pool-cleaning & maintenance site — a vivid aqua palette on a crisp near-white ground, built around recurring weekly service and online booking. Installs a working flow: a free-quote booking, weekly cleaning plus openings, closings, filter service and green-to-clean rescue, and three techs you book as dispatchable resources with their own hours. Ships as "BlueWave Pool Care" — a sparkling pool, handled every week.',
  tagline: 'A friendly pool-care template — book a free quote and start weekly service from day one.',
  industry: 'Pool service',
  sortWeight: 24,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'BlueWave Pool Care', tagline: 'A sparkling pool, handled every week.' },
  theme: bluewave,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'BlueWave Pool Care — weekly pool cleaning & maintenance',
      description:
        'BlueWave Pool Care keeps your pool sparkling with weekly cleaning, chemical balancing, openings, closings and filter care on an automatic schedule. Licensed, insured, and easy to book online — get a free quote.',
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
