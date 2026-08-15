// sparx-chiro-sports — "Kinetic Spine & Sport", a sports/rehab chiropractic & performance clinic.
//
// The athletic, results-driven sibling in the chiropractic lane: an electric-blue primary
// over a crisp near-white ground, a lime accent for energy, a sturdy condensed display
// (Oswald) over Inter, and tight radii. Deliberately the OPPOSITE of the everyday-wellness
// chiro template (calm teal, clean) — this one is built for athletes and active people:
// sports injuries, active-release, dry needling, rehab and performance work. Same booking
// spine as the family, a different business — the whole site drives toward "Book an
// assessment", and the installer replays a live booking flow with providers AND treatment
// rooms as multi-requirement resources.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-chiro-sports.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-chiro-sports/**" \
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
  hero: 'chiro-sports-hero',
  facility: 'chiro-sports-facility',
  method: 'chiro-sports-method',
  marcus: 'chiro-sports-marcus',
  dana: 'chiro-sports-dana',
  theo: 'chiro-sports-theo',
} as const;

const PHOTO: Record<string, string> = {
  "kinetic-hero": "https://images.unsplash.com/photo-1649751361457-01d3a696c7e6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BvcnRzJTIwcGh5c2ljYWwlMjB0aGVyYXB5fGVufDB8MHx8fDE3ODYzOTA3MzJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kinetic-facility": "https://images.unsplash.com/photo-1657803802395-5aae14a8d099?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGh5c2ljYWwlMjB0aGVyYXB5JTIwZ3ltfGVufDB8MHx8fDE3ODYzOTA3MzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kinetic-method": "https://images.unsplash.com/photo-1517836357463-d25dfeac3438?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YXRobGV0ZSUyMHJlaGFiJTIwZXhlcmNpc2V8ZW58MHwwfHx8MTc4NjM5MDczOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kinetic-marcus": "https://images.unsplash.com/photo-1671869239603-8d73133e0e5e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGh5c2ljYWwlMjB0aGVyYXBpc3QlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2MzkwNzQxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kinetic-dana": "https://images.unsplash.com/photo-1526080652727-5b77f74eacd2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwaHlzaWNhbCUyMHRoZXJhcGlzdCUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTA3NDR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "kinetic-theo": "https://images.unsplash.com/photo-1526080652727-5b77f74eacd2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3BvcnRzJTIwdGhlcmFwaXN0JTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MDc0N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('kinetic-hero'), alt: 'A runner mid-stride during a rehab session on the clinic floor' },
  { id: IMG.facility, url: src('kinetic-facility'), alt: 'An open rehab floor with treatment tables and training space' },
  { id: IMG.method, url: src('kinetic-method'), alt: 'A provider guiding an athlete through a loaded movement screen' },
  { id: IMG.marcus, url: src('kinetic-marcus'), alt: 'Dr. Marcus Vela, sports chiropractor' },
  { id: IMG.dana, url: src('kinetic-dana'), alt: 'Dr. Dana Okafor, rehab & dry-needling lead' },
  { id: IMG.theo, url: src('kinetic-theo'), alt: 'Theo Reyes, performance & movement specialist' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-chiro-sports: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "kinetic": electric-blue primary, lime accent, crisp near-white ground, a
//    sturdy condensed display. Dark secondary ink on light; readable light ink on dark. ──
const kinetic = defineTheme({
  name: 'kinetic',
  type: { body: face('Inter', 'sans-serif'), head: face('Oswald', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 250)', // crisp cool near-white
      'oklch(95% 0.007 250)', // pale steel
      'oklch(90% 0.012 250)', // hairline
      'oklch(22% 0.03 260)', // deep ink navy-charcoal
    ],
    roles: {
      primary: 'oklch(56% 0.19 255)', // electric blue
      secondary: 'oklch(34% 0.035 260)', // dark steel ink (readable micro-labels)
      accent: 'oklch(80% 0.19 128)', // energetic lime
      neutral: 'oklch(24% 0.025 260)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(19% 0.02 260)',
      'oklch(15% 0.015 260)',
      'oklch(12% 0.01 260)',
      'oklch(95% 0.005 250)',
    ],
    roles: {
      primary: 'oklch(66% 0.19 255)',
      secondary: 'oklch(80% 0.02 255)', // readable LIGHT tone on dark ground
      accent: 'oklch(83% 0.19 128)',
      neutral: 'oklch(86% 0.02 255)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine: policies, providers + treatment rooms, the menu ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'clinic-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Give us at least 24 hours’ notice to move or cancel a visit. We send a reminder the day before and two hours ahead so you never miss your slot.',
    },
    {
      handle: 'no-show',
      name: 'Assessment & performance policy',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Assessments and performance consults hold a longer slot with a provider and a room. Two missed appointments without 24 hours’ notice pauses online booking until we reconnect.',
    },
  ],
  resources: [
    {
      handle: 'marcus',
      name: 'Dr. Marcus Vela',
      kind: 'staff',
      skillTags: ['sports', 'adjustment', 'art', 'screening'],
      windows: hours([1, 3, 5], 420, 1140), // Mon/Wed/Fri 7a–7p (early + evening)
    },
    {
      handle: 'dana',
      name: 'Dr. Dana Okafor',
      kind: 'staff',
      skillTags: ['rehab', 'dry-needling', 'adjustment', 'sports'],
      windows: hours([2, 4, 6], 480, 1200), // Tue/Thu 8a–8p, Sat 8a–8p
    },
    {
      handle: 'theo',
      name: 'Theo Reyes',
      kind: 'staff',
      skillTags: ['performance', 'screening', 'sports', 'rehab'],
      windows: hours([1, 2, 4], 600, 1230), // Mon/Tue/Thu 10a–8:30p (evening-heavy for athletes)
    },
    {
      handle: 'room-a',
      name: 'Treatment Room A',
      kind: 'space',
      skillTags: ['room'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1260), // Mon–Sat 7a–9p
    },
    {
      handle: 'room-b',
      name: 'Rehab Bay B',
      kind: 'space',
      skillTags: ['room'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1260),
    },
  ],
  services: [
    {
      handle: 'movement-assessment',
      name: 'Movement assessment',
      description:
        'A full-body movement screen — we find what’s limiting you, then build the plan to fix it and get you back to training.',
      durationMinutes: 45,
      priceCents: 9500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['screening'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'no-show',
    },
    {
      handle: 'sports-injury-visit',
      name: 'Sports injury visit',
      description:
        'Acute or nagging — a focused visit to diagnose the injury, calm it down and start you moving again.',
      durationMinutes: 40,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['sports'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'clinic-standard',
    },
    {
      handle: 'adjustment',
      name: 'Chiropractic adjustment',
      description: 'A targeted adjustment to restore motion and take pressure off the joints — in and out, back to your day.',
      durationMinutes: 20,
      priceCents: 6500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['adjustment'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'clinic-standard',
    },
    {
      handle: 'active-release-session',
      name: 'Active-release session',
      description: 'Hands-on soft-tissue work to break up restriction, free the muscle and restore clean range of motion.',
      durationMinutes: 30,
      priceCents: 8500,
      bufferAfterMin: 5,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['art'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'clinic-standard',
    },
    {
      handle: 'dry-needling-session',
      name: 'Dry-needling session',
      description: 'Precise needling to release trigger points and switch tight, guarded muscles back on.',
      durationMinutes: 30,
      priceCents: 9000,
      bufferAfterMin: 5,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['dry-needling'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'clinic-standard',
    },
    {
      handle: 'rehab-session',
      name: 'Rehab session',
      description: 'Loaded, progressive rehab — the strength and control work that keeps the injury from coming back.',
      durationMinutes: 60,
      priceCents: 11000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['rehab'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'clinic-standard',
    },
    {
      handle: 'performance-consult',
      name: 'Performance consult',
      description:
        'A free sit-down to map your training goals and see whether we’re the right team to get you there — no pressure.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['performance'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['room'], count: 1 },
      ],
      policyHandle: 'no-show',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A runner mid-stride during a rehab session on the clinic floor',
    title: 'Get back to training — stronger than the injury',
    sub: 'Sports chiropractic, active-release, dry needling and progressive rehab for athletes and active people. We find the cause, fix it, and build you back to full speed.',
    primary: { label: 'Book an assessment', href: '/book' },
    secondary: { label: 'See what we do', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Sports-injury specialists',
        body: 'We treat athletes every day — from weekend runners to competitive lifters. You get someone who understands the demand you’re training back toward.',
      },
      {
        title: 'Active-release & dry needling',
        body: 'Hands-on soft-tissue work and precise needling to release what’s locked up, so the adjustment holds and the movement comes back.',
      },
      {
        title: 'Back to training fast',
        body: 'No endless maintenance plans. A clear diagnosis, a real plan, and a target date to be back doing the thing you came here to do.',
      },
      {
        title: 'Movement screening',
        body: 'We assess how you actually move under load and find the weak link — then load it, so the injury doesn’t come back.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What you can book',
    intro: 'Straight-talking visits with clear times and prices. Full availability is on the booking page — pick a provider and a slot that works.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Movement assessment', priceCents: 9500, durationMin: 45, desc: 'The full screen — find the limit, build the plan.' },
      { name: 'Sports injury visit', priceCents: 12000, durationMin: 40, desc: 'Diagnose it, calm it, start moving again.' },
      { name: 'Active-release session', priceCents: 8500, durationMin: 30, desc: 'Soft-tissue work to free up restriction.' },
      { name: 'Rehab session', priceCents: 11000, durationMin: 60, desc: 'Loaded rehab that keeps it from returning.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.method),
    alt: 'A provider guiding an athlete through a loaded movement screen',
    heading: 'Assess, treat, rebuild — the Kinetic method',
    body: [
      'Most clinics chase the pain. We chase the cause. Every athlete starts with a movement assessment, so we treat the reason the tissue failed — not just the spot that hurts.',
      'From there it’s hands-on treatment to settle things down, then loaded, progressive rehab to build capacity back. That last step is what keeps you off the table and on the field.',
    ],
    cta: { label: 'Book your assessment', href: '/book' },
  }),
  teamRow({
    heading: 'Your providers',
    intro: 'Book by name — you’ll work with someone who knows your history and your goals.',
    members: [
      { name: 'Dr. Marcus Vela', role: 'Sports chiropractor', image: url(IMG.marcus), alt: 'Dr. Marcus Vela, sports chiropractor', bio: 'Adjustments and active-release for competitive and everyday athletes. Marcus leads the clinic.' },
      { name: 'Dr. Dana Okafor', role: 'Rehab & dry-needling lead', image: url(IMG.dana), alt: 'Dr. Dana Okafor, rehab & dry-needling lead', bio: 'Dry needling and progressive rehab — the strength work that makes the fix stick.' },
      { name: 'Theo Reyes', role: 'Performance & movement specialist', image: url(IMG.theo), alt: 'Theo Reyes, performance & movement specialist', bio: 'Movement screening and return-to-sport plans for people chasing a number.' },
    ],
  }),
  testimonial({
    quote: 'Tore my calf eight weeks out from my marathon and thought I was done. Kinetic had me back on the start line — and I ran a PR. They didn’t just patch me up, they rebuilt me.',
    attribution: 'Renata M., marathon runner',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Stop training around it',
    sub: 'Book a movement assessment and get a real plan to be back at full speed. It takes about a minute.',
    cta: { label: 'Book an assessment', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.facility),
    alt: 'An open rehab floor with treatment tables and training space',
    title: 'Book your visit',
    sub: 'Choose a service to see prices and live availability, then pick your provider and time.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.facility),
    alt: 'An open rehab floor with treatment tables and training space',
    heading: 'About Kinetic Spine & Sport',
    body: [
      'We built Kinetic for the people other clinics send home with a heat pack and a shrug. Athletes, lifters, runners, weekend warriors — anyone whose life doesn’t stop when something tweaks.',
      'It’s part treatment room, part training floor. We diagnose hard, treat hands-on, and load you back to full capacity — because getting out of pain and getting back to performance are two different jobs, and we do both.',
    ],
    cta: { label: 'Book an assessment', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Assessment first', body: 'Every plan starts with how you move. We find the weak link before we touch the pain, so we fix the cause, not the symptom.' },
      { title: 'Hands-on, then loaded', body: 'Active-release and dry needling to settle things down, then progressive rehab to build real capacity back.' },
      { title: 'Back to your sport', body: 'We work to a target — a return-to-sport date, a lift, a race — not an open-ended schedule of maintenance visits.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the clinic',
    address: ['Kinetic Spine & Sport', '410 Foundry Ave', 'Unit 3 · Denver, CO 80205'],
    mapLocation: '410 Foundry Ave, Denver, CO 80205',
    hours: [
      { day: 'Monday – Thursday', time: '7:00 – 8:30' },
      { day: 'Friday', time: '7:00 – 7:00' },
      { day: 'Saturday', time: '8:00 – 2:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your time online — no phone tag, no waiting room hold music.',
    surface: 'muted',
    cta: { label: 'Book an assessment', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-chiro-sports',
  name: 'Chiropractic (Sports & Rehab)',
  summary:
    'A bold, athletic chiropractic & performance site — electric-blue palette, sturdy condensed type, built for athletes and active people. Installs a working booking flow: sports-injury visits, active-release, dry needling, rehab and a free performance consult, with providers AND treatment rooms as multi-requirement resources. Ships as "Kinetic Spine & Sport", a sports/rehab clinic that books online from day one.',
  tagline: 'An athletic template for sports & rehab chiropractic — book assessments online from day one.',
  industry: 'Chiropractic',
  sortWeight: 55,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Kinetic Spine & Sport', tagline: 'Fix the cause. Build it back.' },
  theme: kinetic,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Kinetic Spine & Sport — sports chiropractic & rehab',
      description:
        'Sports chiropractic, active-release, dry needling and progressive rehab for athletes and active people. Book a movement assessment online.',
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
