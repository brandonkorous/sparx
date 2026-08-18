// sparx-cleaning-home — "Tidy Nest", a friendly RESIDENTIAL house-cleaning service.
//
// The bright, cheerful, everyday residential cleaner: a fresh aqua ground with a sunny
// coral accent, a friendly rounded display over a plain humanist sans, and clean, bright
// home photography carrying the page. Deliberately the "friendly bright" sibling — there
// is a separate eco/green cleaning template (natural, refined, plant-based), so THIS one
// is the cheerful, insured, come-home-to-clean everyday service. Same booking spine, a
// different business: recurring cleans, deep cleans, move-in/out, and free estimates.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-cleaning-home.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-cleaning-home/**" \
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
  hero: 'cleaning-home-hero',
  interior: 'cleaning-home-interior',
  rosa: 'cleaning-home-rosa',
  mateo: 'cleaning-home-mateo',
  aisha: 'cleaning-home-aisha',
  grace: 'cleaning-home-grace',
} as const;

// EMPTY on purpose — every image resolves through the picsum fallback in `src()`, so the
// bundle ships zero hot-linked photos and each seed is stable + unique.
const PHOTO: Record<string, string> = {
  "tidynest-hero": "https://images.unsplash.com/photo-1632829882891-5047ccc421bc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xlYW4lMjBicmlnaHQlMjBsaXZpbmclMjByb29tfGVufDB8MHx8fDE3ODYzODkzMTR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tidynest-home": "https://images.unsplash.com/photo-1724582586529-62622e50c0b3?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGlkeSUyMG1vZGVybiUyMGhvbWUlMjBpbnRlcmlvcnxlbnwwfDB8fHwxNzg2Mzg5MzE3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tidynest-rosa": "https://images.unsplash.com/photo-1680631626569-d163da98ff40?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBjbGVhbmVyJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4OTMyMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tidynest-mateo": "https://images.unsplash.com/photo-1740657254989-42fe9c3b8cce?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWFuJTIwY2xlYW5pbmclMjBzZXJ2aWNlfGVufDB8MHx8fDE3ODYzODkzMjN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tidynest-aisha": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwb3J0cmFpdCUyMHNtaWxpbmd8ZW58MHwwfHx8MTc4NjM4OTMyNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "tidynest-grace": "https://images.unsplash.com/photo-1603712725038-e9334ae8f39f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aG91c2UlMjBjbGVhbmluZyUyMHBlcnNvbnxlbnwwfDB8fHwxNzg2Mzg5MzI5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  {
    id: IMG.hero,
    url: src('tidynest-hero'),
    alt: 'A bright, freshly cleaned living room full of morning light',
  },
  {
    id: IMG.interior,
    url: src('tidynest-home'),
    alt: 'A spotless kitchen with sparkling counters and tidy shelves',
  },
  { id: IMG.rosa, url: src('tidynest-rosa'), alt: 'Rosa Delgado, lead cleaner' },
  { id: IMG.mateo, url: src('tidynest-mateo'), alt: 'Mateo Rivera, cleaner' },
  { id: IMG.aisha, url: src('tidynest-aisha'), alt: 'Aisha Bello, cleaner' },
  { id: IMG.grace, url: src('tidynest-grace'), alt: 'Grace Lin, cleaner' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-cleaning-home: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "tidynest": fresh aqua ground, sunny coral accent, friendly rounded display ─
const tidynest = defineTheme({
  name: 'tidynest',
  type: { body: face('Inter', 'sans-serif'), head: face('Nunito', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.75rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98.5% 0.008 200)', // crisp near-white, a whisper of cool
      'oklch(96% 0.016 196)', // pale mint wash
      'oklch(90% 0.022 192)', // hairline
      'oklch(30% 0.03 235)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(70% 0.135 192)', // bright aqua
      secondary: 'oklch(38% 0.03 235)', // dark slate (readable micro-labels on light)
      accent: 'oklch(71% 0.15 38)', // sunny coral
      neutral: 'oklch(32% 0.022 235)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(25% 0.022 235)',
      'oklch(21% 0.02 235)',
      'oklch(17% 0.016 235)',
      'oklch(95% 0.01 196)',
    ],
    roles: {
      primary: 'oklch(78% 0.13 194)',
      secondary: 'oklch(80% 0.02 200)',
      accent: 'oklch(77% 0.14 40)',
      neutral: 'oklch(84% 0.015 200)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, cleaners + hours, the bookable cleans) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'cleaning-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to reschedule or cancel. We send a reminder the day before and two hours ahead, so you’re never caught off guard.',
    },
    {
      handle: 'first-clean',
      name: 'First clean & recurring',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Your first clean and any recurring plan is fully flexible — change your day, skip a visit or pause any time with 24 hours’ notice. No lock-in, ever.',
    },
  ],
  resources: [
    {
      handle: 'rosa',
      name: 'Rosa Delgado',
      kind: 'staff',
      skillTags: ['standard', 'deep', 'recurring'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'mateo',
      name: 'Mateo Rivera',
      kind: 'staff',
      skillTags: ['deep', 'move-out', 'standard'],
      windows: hours([2, 3, 4, 5, 6], 480, 960), // Tue–Sat 8–4
    },
    {
      handle: 'aisha',
      name: 'Aisha Bello',
      kind: 'staff',
      skillTags: ['standard', 'recurring', 'eco'],
      windows: hours([1, 2, 3, 4, 5], 540, 1080), // Mon–Fri 9–6
    },
    {
      handle: 'grace',
      name: 'Grace Lin',
      kind: 'staff',
      skillTags: ['standard', 'deep', 'move-out', 'post-reno'],
      windows: hours([3, 4, 5, 6, 0], 480, 1020), // Wed–Sun 8–5
    },
  ],
  services: [
    {
      handle: 'free-estimate',
      name: 'Free in-home estimate',
      description:
        'A friendly walk-through of your home so we can quote an exact price — no obligation, no pressure.',
      durationMinutes: 60,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['standard'], count: 1 }],
      policyHandle: 'cleaning-standard',
    },
    {
      handle: 'standard-clean',
      name: 'Standard clean',
      description:
        'Kitchens, bathrooms, floors and surfaces across your whole home — the everyday refresh that keeps things sparkling.',
      durationMinutes: 120,
      priceCents: 12000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['standard'], count: 1 }],
      policyHandle: 'cleaning-standard',
    },
    {
      handle: 'deep-clean',
      name: 'Deep clean',
      description:
        'Top-to-bottom detail — baseboards, inside the oven and fridge, grout, vents and the spots that get skipped.',
      durationMinutes: 180,
      priceCents: 22000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['deep'], count: 1 }],
      policyHandle: 'cleaning-standard',
    },
    {
      handle: 'recurring-setup',
      name: 'Recurring plan — first visit',
      description:
        'Set up weekly, every-two-weeks or monthly cleans with the same friendly cleaner each time. Change or skip any time.',
      durationMinutes: 120,
      priceCents: 11000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['recurring'], count: 1 }],
      policyHandle: 'first-clean',
    },
    {
      handle: 'move-out-clean',
      name: 'Move-in / move-out clean',
      description:
        'An empty-home deep clean, cupboards to skirting, so you hand back the keys spotless and get every deposit dollar back.',
      durationMinutes: 240,
      priceCents: 28000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['move-out'], count: 1 }],
      policyHandle: 'cleaning-standard',
    },
    {
      handle: 'one-time-refresh',
      name: 'One-time refresh',
      description:
        'A quick single visit before guests, after a party or whenever life gets busy — the essentials, done well.',
      durationMinutes: 90,
      priceCents: 9000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'cleaner', kind: 'staff', skillTags: ['standard'], count: 1 }],
      policyHandle: 'cleaning-standard',
    },
    {
      handle: 'post-reno-clean',
      name: 'Post-renovation clean',
      description:
        'Dust, debris and builder’s residue cleared out after a remodel, so your finished project actually feels finished.',
      durationMinutes: 240,
      priceCents: 32000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'cleaner', kind: 'staff', skillTags: ['post-reno'], count: 1 },
      ],
      policyHandle: 'cleaning-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A bright, freshly cleaned living room full of morning light',
    title: 'Come home to clean',
    sub: 'Friendly, vetted cleaners for your home — recurring cleans, deep cleans and move-outs. Book in about a minute and walk into a place that feels brand new.',
    primary: { label: 'Book your first clean', href: '/book' },
    secondary: { label: 'Get a free estimate', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Vetted & insured',
        body: 'Every cleaner is background-checked, trained and fully insured. We bring our own supplies and treat your home like our own.',
      },
      {
        title: 'Satisfaction guaranteed',
        body: 'If we miss a spot, tell us within 24 hours and we’ll come back and make it right — no arguing, no extra charge.',
      },
      {
        title: 'Flexible recurring plans',
        body: 'Weekly, every two weeks or monthly, with the same friendly cleaner each visit. Skip, move or cancel any time — no lock-in.',
      },
      {
        title: 'Eco-friendly options',
        body: 'Just ask for our plant-based, family- and pet-safe products — a fresh, clean home without the harsh chemical smell.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we clean',
    intro: 'Clear, upfront pricing for every kind of clean. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Standard clean',
        priceCents: 12000,
        durationMin: 120,
        desc: 'Kitchens, baths, floors and surfaces — your whole home refreshed.',
      },
      {
        name: 'Deep clean',
        priceCents: 22000,
        durationMin: 180,
        desc: 'Baseboards, inside the oven and fridge, grout — the works.',
      },
      {
        name: 'Recurring plan',
        priceCents: 11000,
        durationMin: 120,
        desc: 'Set it and forget it — the same cleaner on your schedule.',
      },
      {
        name: 'Move-in / move-out',
        priceCents: 28000,
        durationMin: 240,
        desc: 'An empty-home deep clean so you get your deposit back.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.interior),
    alt: 'A spotless kitchen with sparkling counters and tidy shelves',
    heading: 'Your same trusted cleaner, every time',
    body: [
      'With a recurring plan you’re matched with one cleaner who gets to know your home — where things go, which products you like, the corners that always need a little extra.',
      'No revolving door of strangers, no re-explaining yourself every week. Just a familiar, friendly face and a home that stays effortlessly clean.',
    ],
    cta: { label: 'Start a recurring plan', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your cleaning team',
    intro: 'Real people, background-checked and insured — the friendly faces who’ll make your home shine.',
    members: [
      {
        name: 'Rosa Delgado',
        role: 'Lead cleaner',
        image: url(IMG.rosa),
        alt: 'Rosa Delgado, lead cleaner',
        bio: 'Ten years of spotless homes and happy clients. Rosa runs the crew and loves a recurring route.',
      },
      {
        name: 'Mateo Rivera',
        role: 'Cleaner',
        image: url(IMG.mateo),
        alt: 'Mateo Rivera, cleaner',
        bio: 'The detail guy — deep cleans and move-outs where every corner has to be perfect.',
      },
      {
        name: 'Aisha Bello',
        role: 'Cleaner',
        image: url(IMG.aisha),
        alt: 'Aisha Bello, cleaner',
        bio: 'Your eco-friendly specialist, with plant-based products that are safe for kids and pets.',
      },
      {
        name: 'Grace Lin',
        role: 'Cleaner',
        image: url(IMG.grace),
        alt: 'Grace Lin, cleaner',
        bio: 'Handles the big jobs — post-renovation and move-out cleans, start to sparkling finish.',
      },
    ],
  }),
  testimonial({
    quote: 'I come home on cleaning day and just exhale. Same lovely cleaner every time, everything sparkling, and it never costs more than they quoted. Worth every penny.',
    attribution: 'Danielle, client since 2024',
  }),
  bookingCta({
    title: 'Ready for a cleaner home?',
    sub: 'Pick a clean, choose a day and see live times. It takes about a minute — or book a free estimate first.',
    cta: { label: 'Book your first clean', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.interior),
    alt: 'A spotless kitchen with sparkling counters and tidy shelves',
    title: 'Book your clean',
    sub: 'Choose a clean to see the price and live availability, then pick a day and time that works for you.',
    primary: { label: 'See cleans below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A bright, freshly cleaned living room full of morning light',
    heading: 'About Tidy Nest',
    body: [
      'We started Tidy Nest for a simple reason: everyone deserves to come home to a clean house without the stress of finding — and trusting — someone to do it.',
      'So we built a team we’d welcome into our own homes: vetted, insured, genuinely friendly, and backed by a guarantee. You get your evenings and weekends back, and a home that always feels cared for.',
    ],
    cta: { label: 'Book a clean', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'A price you can trust',
        body: 'A clear, upfront quote before we start — free estimates on bigger jobs. What we quote is what you pay.',
      },
      {
        title: 'People you can trust',
        body: 'Every cleaner is background-checked, trained and fully insured, and you get the same one on a recurring plan.',
      },
      {
        title: 'A guarantee behind it',
        body: 'If anything’s not right, tell us within 24 hours and we’ll come back and re-clean it — free.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Get in touch',
    address: ['Tidy Nest', '412 Maplewood Avenue', 'Suite 5 · Austin, TX 78704'],
    mapLocation: '412 Maplewood Avenue, Austin, TX 78704',
    hours: [
      { day: 'Monday – Friday', time: '8:00 – 6:00' },
      { day: 'Saturday', time: '8:00 – 4:00' },
      { day: 'Sunday', time: '9:00 – 3:00' },
      { day: 'Holidays', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your clean online — no phone tag, no waiting on a callback.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-cleaning-home',
  name: 'House Cleaning (Home)',
  summary:
    'A bright, cheerful residential house-cleaning site — a fresh aqua palette, a sunny coral accent and a friendly rounded display, with clean, light-filled home photography. Installs a working booking flow: online booking for standard, deep, move-out and recurring cleans plus free estimates, four vetted cleaners as bookable resources with their own hours, and a satisfaction-guarantee policy. Ships as "Tidy Nest", with a recurring-plan angle — the same trusted cleaner every visit.',
  tagline: 'A bright, friendly template for house cleaners — book cleans online from day one.',
  industry: 'House cleaning',
  sortWeight: 68,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Tidy Nest', tagline: 'Come home to clean.' },
  theme: tidynest,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Tidy Nest — friendly house cleaning',
      description:
        'Tidy Nest is a friendly, insured house-cleaning service for recurring cleans, deep cleans and move-outs. Book your first clean online — or get a free estimate.',
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
