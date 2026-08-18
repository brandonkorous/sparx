// sparx-pressurewash-home — "Blast Master Pressure Washing", a bright, satisfying
// RESIDENTIAL pressure & soft washing company.
//
// The everyday, "make it look new again" end of exterior cleaning: driveways, house
// soft-wash, decks, patios, roofs and gutters for homeowners. Bright vivid-aqua over a
// crisp near-white ground, a sunny accent, a sturdy sans, and a booking spine whose
// functional core is a FREE QUOTE ("Get a free quote"). Deliberately the OPPOSITE of the
// commercial exterior-cleaning template (facilities, contracts, fleets) — same booking
// spine, a different business: this one is the home, satisfying, before-and-after sibling.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-pressurewash-home.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-pressurewash-home/**" \
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
  hero: 'pressurewash-home-hero',
  transformation: 'pressurewash-home-transformation',
  about: 'pressurewash-home-about',
  marcus: 'pressurewash-home-marcus',
  dana: 'pressurewash-home-dana',
  ty: 'pressurewash-home-ty',
} as const;

// No curated stock — every image resolves through the picsum fallback below on a unique,
// business-prefixed seed. (A real launch swaps these for the tenant's own before/after
// and crew photos.)
const PHOTO: Record<string, string> = {
  "blastmaster-hero": "https://images.unsplash.com/photo-1781637202423-33ec5b47e52e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJlc3N1cmUlMjB3YXNoaW5nJTIwZHJpdmV3YXl8ZW58MHwwfHx8MTc4NjM5NTczMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "blastmaster-transformation": "https://images.unsplash.com/photo-1767559806487-4bbba537f5c1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cG93ZXIlMjB3YXNoaW5nJTIwcGF0aW98ZW58MHwwfHx8MTc4NjM5NTczNHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "blastmaster-about": "https://images.unsplash.com/photo-1570129477492-45c003edd2be?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2xlYW4lMjBob3VzZSUyMGV4dGVyaW9yfGVufDB8MHx8fDE3ODYzOTU3Mzh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "blastmaster-marcus": "https://images.unsplash.com/photo-1530983822321-fcac2d3c0f06?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5NTcxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "blastmaster-dana": "https://images.unsplash.com/photo-1615464670798-6e92fafa2a89?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3b3JrZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg4MjQwfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "blastmaster-ty": "https://images.unsplash.com/photo-1759521296144-fe6f2d2dc769?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29ya2VyJTIwcG9ydHJhaXQlMjB1bmlmb3JtfGVufDB8MHx8fDE3ODYzODkyNjJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('blastmaster-hero'),
    alt: 'A driveway freshly pressure-washed to a clean, bright grey — the dirty half still visible',
  },
  {
    id: IMG.transformation,
    url: src('blastmaster-transformation'),
    alt: 'A house exterior mid soft-wash, one side dingy and one side bright and clean',
  },
  {
    id: IMG.about,
    url: src('blastmaster-about'),
    alt: 'A Blast Master technician soft-washing siding with a low-pressure wand on a sunny morning',
  },
  { id: IMG.marcus, url: src('blastmaster-marcus'), alt: 'Marcus Vance, lead pressure-wash technician' },
  { id: IMG.dana, url: src('blastmaster-dana'), alt: 'Dana Whitfield, soft-wash & roof specialist' },
  { id: IMG.ty, url: src('blastmaster-ty'), alt: 'Ty Okafor, deck & patio technician' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-pressurewash-home: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "blastmaster": crisp near-white ground, vivid aqua primary, sunny accent, a
// dark readable secondary, a sturdy sans ─────────────────────────────────────────────
const blastmaster = defineTheme({
  name: 'blastmaster',
  type: { body: face('Inter', 'sans-serif'), head: face('Archivo', 'sans-serif') },
  shape: { selector: '0.625rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98.5% 0.008 210)', // crisp near-white, faint aqua
      'oklch(96% 0.016 205)', // pale aqua
      'oklch(90% 0.024 202)', // hairline
      'oklch(24% 0.03 222)', // deep teal ink
    ],
    roles: {
      primary: 'oklch(68% 0.14 205)', // vivid aqua / teal
      secondary: 'oklch(38% 0.05 218)', // deep teal — readable text-secondary on light
      accent: 'oklch(85% 0.16 96)', // sunny yellow
      neutral: 'oklch(27% 0.02 222)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.03 222)',
      'oklch(18% 0.024 222)',
      'oklch(14% 0.018 222)',
      'oklch(95% 0.01 205)',
    ],
    roles: {
      primary: 'oklch(77% 0.14 200)', // brighter aqua on dark
      secondary: 'oklch(80% 0.04 205)',
      accent: 'oklch(87% 0.15 96)',
      neutral: 'oklch(84% 0.02 205)',
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
      handle: 'wash-standard',
      name: 'Standard visit',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Need to move your visit? Just give us 24 hours’ notice and we’ll find you a new day. We text a reminder the day before and two hours ahead, so nobody’s surprised.',
    },
    {
      handle: 'maintenance-plan',
      name: 'Maintenance plan & first service',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Maintenance plans bill per completed visit — no long-term contract, cancel any time with 24 hours’ notice. We confirm your first service the day before, then keep your home on the same schedule automatically.',
    },
  ],
  resources: [
    {
      handle: 'tech-marcus',
      name: 'Marcus Vance',
      kind: 'staff',
      skillTags: ['driveway', 'house', 'general'],
      windows: hours([1, 2, 3, 4, 5], 420, 960), // Mon–Fri 7–4
    },
    {
      handle: 'tech-dana',
      name: 'Dana Whitfield',
      kind: 'staff',
      skillTags: ['soft-wash', 'roof', 'general'],
      windows: hours([1, 2, 3, 4, 5, 6], 480, 1020), // Mon–Sat 8–5
    },
    {
      handle: 'tech-ty',
      name: 'Ty Okafor',
      kind: 'staff',
      skillTags: ['deck', 'patio', 'general'],
      windows: hours([2, 3, 4, 5, 6], 480, 1020), // Tue–Sat 8–5
    },
  ],
  services: [
    {
      handle: 'free-quote',
      name: 'Free washing quote',
      description:
        'We stop by, walk your property, and send a clear flat-rate quote — no pressure, no obligation. The fastest way to get started.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'wash-standard',
    },
    {
      handle: 'driveway-cleaning',
      name: 'Driveway & concrete cleaning',
      description:
        'High-pressure surface cleaning that lifts years of dirt, oil, algae and tire marks — concrete, pavers and walkways brought back to bright, even and new.',
      durationMinutes: 90,
      priceCents: 15900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'wash-standard',
    },
    {
      handle: 'house-soft-wash',
      name: 'House soft-wash',
      description:
        'A gentle, low-pressure soft-wash that safely strips grime, mildew and green off siding, stucco and brick — deep-clean results without ever blasting your home.',
      durationMinutes: 120,
      priceCents: 29900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['soft-wash'], count: 1 }],
      policyHandle: 'wash-standard',
    },
    {
      handle: 'deck-patio-cleaning',
      name: 'Deck & patio cleaning',
      description:
        'Wood, composite and stone cleaned at the right pressure for the surface — greyed decks freshened and patios cleared of moss and buildup, ready to enjoy.',
      durationMinutes: 90,
      priceCents: 22900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'wash-standard',
    },
    {
      handle: 'roof-soft-wash',
      name: 'Roof soft-wash',
      description:
        'A no-pressure treatment that kills and removes the black streaks and moss on your roof without damaging shingles — the safe way to get years of curb appeal back.',
      durationMinutes: 150,
      priceCents: 39900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['soft-wash'], count: 1 }],
      policyHandle: 'wash-standard',
    },
    {
      handle: 'gutter-cleaning',
      name: 'Gutter cleaning & brightening',
      description:
        'Gutters cleared of leaves and debris so water flows, plus an exterior brightening that wipes away the black tiger-stripe stains along the front of the house.',
      durationMinutes: 60,
      priceCents: 12900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'wash-standard',
    },
    {
      handle: 'full-exterior-package',
      name: 'Full exterior package',
      description:
        'The whole house done in one visit — house soft-wash, driveway, walkways and patio — and set up on an annual refresh so it stays looking new year after year.',
      durationMinutes: 180,
      priceCents: 74900,
      assignmentStrategy: 'any_available',
      resourceRequirements: [{ role: 'tech', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'maintenance-plan',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A driveway freshly pressure-washed to a clean, bright grey — the dirty half still visible',
    title: 'Make it look new again',
    sub: 'Driveways, siding, decks and roofs washed the safe way — with a clear flat-rate quote up front and results you can see the moment we’re done.',
    primary: { label: 'Get a free quote', href: '/book' },
    secondary: { label: 'See what we clean', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Soft-wash safe for your home',
        body: 'We match the pressure to the surface — gentle soft-wash on siding and roofs, real power where concrete can take it. Deep-clean results, zero damage.',
      },
      {
        title: 'Licensed & fully insured',
        body: 'A real, insured local company on your property — not a truck that shows up once and disappears with your deposit.',
      },
      {
        title: 'Upfront flat quotes',
        body: 'One clear price before we start — no hourly surprises, no add-ons at the end. You always know exactly what it costs.',
      },
      {
        title: 'Satisfaction guaranteed',
        body: 'If a spot isn’t right, we come back and make it right. You don’t pay to be happy — being happy is the whole job.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we clean',
    intro: 'Pick a service to see how long it takes and start booking. A free quote is always the easiest first step.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Free washing quote', priceCents: 0, durationMin: 30, desc: 'We walk your property and send a flat-rate price — no obligation.' },
      { name: 'Driveway & concrete', priceCents: 15900, durationMin: 90, desc: 'Oil, algae and tire marks lifted — bright, even and new.' },
      { name: 'House soft-wash', priceCents: 29900, durationMin: 120, desc: 'Grime, mildew and green safely stripped off siding.' },
      { name: 'Deck & patio', priceCents: 22900, durationMin: 90, desc: 'Wood, composite and stone cleaned at the right pressure.' },
      { name: 'Roof soft-wash', priceCents: 39900, durationMin: 150, desc: 'Black streaks and moss gone — no damage to shingles.' },
      { name: 'Gutter clean & brighten', priceCents: 12900, durationMin: 60, desc: 'Cleared to flow, plus the tiger-stripe stains wiped away.' },
    ],
    cta: { label: 'Get your free quote', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.transformation),
    alt: 'A house exterior mid soft-wash, one side dingy and one side bright and clean',
    heading: 'The before-and-after you’ll want to show off',
    body: [
      'There’s a moment on every job — the clean line where the dirty half meets the fresh half — and it never stops being satisfying. Green turns to bright siding, grey concrete comes back, black streaks vanish off the roof.',
      'That transformation is the whole point. We finish, walk it with you, and you get to see your home look the way it did the day you moved in — sometimes better.',
    ],
    cta: { label: 'Book your transformation', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your crew',
    intro: 'The same friendly, careful faces on your property each visit — people who take real pride in a clean line.',
    members: [
      { name: 'Marcus Vance', role: 'Lead technician', image: url(IMG.marcus), alt: 'Marcus Vance, lead pressure-wash technician', bio: 'Driveways, walkways and whole-house jobs. Marcus runs a tidy, on-time route and never leaves a streak.' },
      { name: 'Dana Whitfield', role: 'Soft-wash & roof specialist', image: url(IMG.dana), alt: 'Dana Whitfield, soft-wash & roof specialist', bio: 'Low-pressure siding and roof treatments — the safe, gentle side of getting your home spotless.' },
      { name: 'Ty Okafor', role: 'Deck & patio technician', image: url(IMG.ty), alt: 'Ty Okafor, deck & patio technician', bio: 'Wood, composite and stone brought back to life, with an eye for detail on every board and seam.' },
    ],
  }),
  testimonial({
    quote: 'I could not believe it was the same driveway. Booked the free quote online in a minute, got a clear price, and the whole crew was polite and thorough. My house looks brand new.',
    attribution: 'Renée T., homeowner since 2024',
  }),
  bookingCta({
    title: 'Ready to make it look new again?',
    sub: 'Get a free, no-pressure quote in about a minute. Pick a day and we’ll take it from there.',
    cta: { label: 'Get a free quote', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.transformation),
    alt: 'A house exterior mid soft-wash, one side dingy and one side bright and clean',
    title: 'Get a free quote or book a wash',
    sub: 'Choose an option below to see how long it takes and pick a day. A free quote is always the easiest place to start.',
    primary: { label: 'See options below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A Blast Master technician soft-washing siding with a low-pressure wand on a sunny morning',
    heading: 'About Blast Master Pressure Washing',
    body: [
      'Blast Master started with a simple belief: your home should look cared for, and getting it clean shouldn’t mean risking damage or chasing a vague bill. So we do it the right way — the right pressure for every surface, a flat price up front, and a finish we’re proud to stand behind.',
      'We’re a local, licensed and insured crew that treats every property like our own. The same faces each visit, honest quotes you can count on, and a standing promise to make it right if it isn’t.',
    ],
    cta: { label: 'Get a free quote', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'The right pressure, every surface', body: 'Soft-wash for siding and roofs, real power for concrete. We never blast something that can’t take it — and we get it cleaner anyway.' },
      { title: 'One clear, flat price', body: 'You know what the job costs before we start — no hourly meter, no surprise add-ons, no haggling at the door.' },
      { title: 'Guaranteed, every job', body: 'If something’s not right, we come back and fix it. Your home looking new is the whole point of the visit.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Where we work',
    address: ['Blast Master Pressure Washing', '2170 Harbor Bend Drive', 'Clearwater, FL 33755'],
    mapLocation: '2170 Harbor Bend Drive, Clearwater, FL 33755',
    hours: [
      { day: 'Monday – Friday', time: '7:00 – 5:00' },
      { day: 'Saturday', time: '8:00 – 5:00' },
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
  key: 'sparx-pressurewash-home',
  name: 'Pressure Washing (Home)',
  summary:
    'A bright, satisfying residential pressure & soft washing site — a vivid aqua palette on a crisp near-white ground, built around booking a free quote online. Installs a working flow: a $0 quote booking, driveway, house soft-wash, deck, roof and gutter services plus a full-exterior package, and three techs you book with their own hours. Ships as "Blast Master Pressure Washing" — make it look new again.',
  tagline: 'A bright residential pressure-washing template — book a free quote from day one.',
  industry: 'Pressure washing',
  sortWeight: 8,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Blast Master Pressure Washing', tagline: 'Make it look new again.' },
  theme: blastmaster,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Blast Master Pressure Washing — driveways, siding & roofs',
      description:
        'Blast Master Pressure Washing cleans driveways, siding, decks and roofs the safe way — soft-wash where it matters, flat-rate quotes up front. Licensed, insured, and easy to book online. Get a free quote.',
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
