// sparx-tutoring-testprep — "Apex Test Prep", a results-driven SAT/ACT & admissions studio.
//
// The sharp, score-focused test-prep sibling: a bold deep-indigo primary with a punchy
// amber accent, sharp Space Grotesk headings on a crisp near-white ground, and a
// results/score structure (a score-statement type hero → proof → the menu → the method →
// the coaches → a score-jump story → book). Deliberately the OPPOSITE of the warm K-12
// academic-center tutoring template — same booking spine, a visibly different business:
// motivating and confident where the sibling is gentle and reassuring.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-tutoring-testprep.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-tutoring-testprep/**" \
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
  serviceMenu,
  splitFeature,
  STATUS_ON_DARK,
  STATUS_ON_LIGHT,
  teamRow,
  testimonial,
  typeHero,
  type ServiceSiteSpec,
} from './service-sites/harness';

// ── Imagery (swap-ready; each id also names an entry in ASSETS) ────────────────────
const IMG = {
  method: 'apex-method',
  about: 'apex-about',
  jordan: 'apex-jordan',
  priya: 'apex-priya',
  marcus: 'apex-marcus',
} as const;

const PHOTO: Record<string, string> = {
  "apex-method": "https://images.unsplash.com/photo-1558021212-51b6ecfa0db9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3R1ZGVudCUyMHN0dWR5aW5nJTIwYm9va3N8ZW58MHwwfHx8MTc4NjM5MzI2Mnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "apex-about": "https://images.unsplash.com/photo-1434030216411-0b793f4b4173?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZXhhbSUyMHByZXBhcmF0aW9uJTIwZGVza3xlbnwwfDB8fHwxNzg2MzkzMjY1fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "apex-jordan": "https://images.unsplash.com/photo-1623366302587-b38b1ddaefd9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHV0b3IlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2MzkzMjU3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "apex-priya": "https://images.unsplash.com/photo-1590650213165-c1fef80648c4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0ZWFjaGVyJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MzI1M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "apex-marcus": "https://images.unsplash.com/photo-1757620765404-a1ee66df5e27?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y29hY2glMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2MzkzMjY4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    id: IMG.method,
    url: src('apex-method'),
    alt: 'A coach and a student reviewing a scored practice test together',
  },
  {
    id: IMG.about,
    url: src('apex-about'),
    alt: 'A focused one-on-one coaching session at a study table',
  },
  { id: IMG.jordan, url: src('apex-jordan'), alt: 'Jordan Ellis, SAT math coach' },
  { id: IMG.priya, url: src('apex-priya'), alt: 'Priya Nair, ACT English coach' },
  { id: IMG.marcus, url: src('apex-marcus'), alt: 'Marcus Bright, admissions & essays coach' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-tutoring-testprep: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "apex": crisp near-white ground, deep-indigo primary, punchy amber accent ──
const apex = defineTheme({
  name: 'apex',
  type: { body: face('Inter', 'sans-serif'), head: face('Space Grotesk', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.25rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.004 255)', // crisp near-white
      'oklch(95% 0.007 258)', // cool paper
      'oklch(90% 0.012 260)', // hairline
      'oklch(22% 0.035 264)', // deep indigo-ink
    ],
    roles: {
      primary: 'oklch(38% 0.14 264)', // deep indigo
      secondary: 'oklch(40% 0.035 264)', // dark navy-grey (readable micro-labels)
      accent: 'oklch(72% 0.17 60)', // punchy amber
      neutral: 'oklch(25% 0.02 264)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.03 264)',
      'oklch(16% 0.025 264)',
      'oklch(13% 0.02 264)',
      'oklch(95% 0.005 255)',
    ],
    roles: {
      primary: 'oklch(70% 0.14 264)',
      secondary: 'oklch(76% 0.02 260)',
      accent: 'oklch(80% 0.16 62)',
      neutral: 'oklch(82% 0.015 260)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, coaches + hours, the prep menu) ──────────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'apex-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to reschedule or cancel a session. We send a reminder the day before and two hours ahead so nothing slips.',
    },
  ],
  resources: [
    {
      handle: 'jordan',
      name: 'Jordan Ellis',
      kind: 'staff',
      skillTags: ['sat', 'math', 'general'],
      windows: hours([1, 2, 3, 4], 900, 1260).concat(hours([6], 540, 900)), // Mon–Thu 3–9, Sat 9–3
    },
    {
      handle: 'priya',
      name: 'Priya Nair',
      kind: 'staff',
      skillTags: ['act', 'english', 'general'],
      windows: hours([1, 2, 3, 4], 960, 1260).concat(hours([0], 600, 960)), // Mon–Thu 4–9, Sun 10–4
    },
    {
      handle: 'marcus',
      name: 'Marcus Bright',
      kind: 'staff',
      skillTags: ['admissions', 'essays', 'general'],
      windows: hours([2, 3, 4, 5], 960, 1260).concat(hours([6], 600, 960)), // Tue–Fri 4–9, Sat 10–4
    },
  ],
  services: [
    {
      handle: 'free-diagnostic',
      name: 'Free diagnostic & strategy session',
      description:
        'A no-cost first meeting: a short diagnostic to find your real starting score, then a straight-talk plan for hitting your target.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'apex-standard',
    },
    {
      handle: 'sat-prep-session',
      name: 'SAT prep session',
      description:
        'One-on-one SAT coaching — targeted drilling on the sections costing you points, with real test tactics and pacing.',
      durationMinutes: 60,
      priceCents: 9500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['sat'], count: 1 }],
      policyHandle: 'apex-standard',
    },
    {
      handle: 'act-prep-session',
      name: 'ACT prep session',
      description:
        'Focused ACT coaching built around the clock — the science section, the math grind and the reading speed that wins the test.',
      durationMinutes: 60,
      priceCents: 9500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['act'], count: 1 }],
      policyHandle: 'apex-standard',
    },
    {
      handle: 'ap-subject-session',
      name: 'AP subject session',
      description:
        'Exam-focused coaching for an AP subject — the frameworks, the free-response structure and the content gaps that hold the score down.',
      durationMinutes: 60,
      priceCents: 9000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'apex-standard',
    },
    {
      handle: 'admissions-essay-session',
      name: 'Admissions essay session',
      description:
        'Work through your personal statement and supplements with an admissions coach — from a blank page to a draft that sounds like you.',
      durationMinutes: 60,
      priceCents: 11000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['admissions'], count: 1 }],
      policyHandle: 'apex-standard',
    },
    {
      handle: 'strategy-consultation',
      name: 'College strategy consultation',
      description:
        'A planning session for the whole road ahead — test timeline, target schools, and where to put the effort for the biggest return.',
      durationMinutes: 45,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'apex-standard',
    },
    {
      handle: 'practice-test-review',
      name: 'Practice test review',
      description:
        'Bring a full-length practice test and we’ll break it down question by question — the misses, the patterns, and the fastest points to reclaim.',
      durationMinutes: 90,
      priceCents: 13500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [{ role: 'coach', kind: 'staff', skillTags: ['general'], count: 1 }],
      policyHandle: 'apex-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  typeHero({
    title: 'Turn the score you have into the one you need.',
    sub: 'One-on-one SAT, ACT, AP and admissions coaching built around your target — a clear plan, real practice tests, and coaches who’ve moved thousands of points. Start with a free diagnostic.',
    primary: { label: 'Book a diagnostic', href: '/book' },
    secondary: { label: 'See prep options', href: '/book' },
    surface: 'base',
  }),
  featureRow({
    items: [
      {
        title: 'Proven score gains',
        body: 'Our students average a 140-point SAT jump and a 4-point ACT lift. We coach to the score, not to a syllabus — and we track every point.',
      },
      {
        title: 'Expert coaches',
        body: 'Every coach scored in the top 1% of the test they teach. You work with a specialist in your exam, not a generalist reading from a book.',
      },
      {
        title: 'Personalized study plans',
        body: 'A diagnostic finds exactly where your points are leaking, and your plan targets those first. No wasted hours on what you’ve already mastered.',
      },
      {
        title: 'Real practice tests',
        body: 'Full-length, timed, official-format exams under real conditions — then a question-by-question review so test day feels like a rerun.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Prep & coaching',
    intro: 'Every path starts with a free diagnostic. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free diagnostic & strategy session',
        priceCents: 0,
        durationMin: 45,
        desc: 'Find your real starting score and a plan to hit your target.',
      },
      {
        name: 'SAT prep session',
        priceCents: 9500,
        durationMin: 60,
        desc: 'Targeted one-on-one SAT coaching with real test tactics.',
      },
      {
        name: 'ACT prep session',
        priceCents: 9500,
        durationMin: 60,
        desc: 'Focused ACT coaching built around the clock.',
      },
      {
        name: 'Admissions essay session',
        priceCents: 11000,
        durationMin: 60,
        desc: 'From a blank page to a draft that sounds like you.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.method),
    alt: 'A coach and a student reviewing a scored practice test together',
    heading: 'How we move the score',
    body: [
      'Every point on the SAT and ACT is predictable — which is why we start with a diagnostic that maps exactly where yours are being lost. No guessing, no generic worksheets.',
      'From there it’s a tight loop: coach the weak spots, drill under real timing, sit a full practice test, review every miss, and repeat. The score climbs because the plan is aimed, and you can see it move week to week.',
    ],
    cta: { label: 'Book a diagnostic', href: '/book' },
  }),
  teamRow({
    heading: 'Your coaches',
    intro: 'Book by name — you’ll work with the same coach every session, someone who knows your test cold.',
    members: [
      {
        name: 'Jordan Ellis',
        role: 'SAT math coach',
        image: url(IMG.jordan),
        alt: 'Jordan Ellis, SAT math coach',
        bio: 'Perfect 800 math score. Turns the “I’m just not a math person” student into a top-quartile one.',
      },
      {
        name: 'Priya Nair',
        role: 'ACT English & reading coach',
        image: url(IMG.priya),
        alt: 'Priya Nair, ACT English coach',
        bio: 'Reading speed and grammar precision. Her students stop running out of time.',
      },
      {
        name: 'Marcus Bright',
        role: 'Admissions & essays coach',
        image: url(IMG.marcus),
        alt: 'Marcus Bright, admissions & essays coach',
        bio: 'Former admissions reader. Helps students write the essay only they could write.',
      },
    ],
  }),
  testimonial({
    quote: 'I went from a 1180 to a 1420 in three months. Apex found the exact questions I kept missing and drilled them until they were automatic. I got into my first-choice school.',
    attribution: 'Maya T., admitted early to her top choice',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Your target score is closer than it looks',
    sub: 'Start with a free diagnostic and strategy session. Pick a coach, choose a time, and see exactly where your points are hiding.',
    cta: { label: 'Book a diagnostic', href: '/book' },
  }),
];

const BOOK_INTRO = [
  typeHero({
    title: 'Book your session',
    sub: 'Start with a free diagnostic, or book a prep, AP, essay or strategy session below. Choose your coach and see live availability.',
    primary: { label: 'See options below', href: '/book' },
    surface: 'primary',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'A focused one-on-one coaching session at a study table',
    heading: 'About Apex Test Prep',
    body: [
      'We started Apex because test prep had become a box of tricks sold by the hour, disconnected from the one thing that matters: the score on the page. We do the opposite — every session is aimed at points, and every point is tracked.',
      'Our coaches all scored in the top 1% of the exam they teach, and they coach one student at a time. No lecture halls, no filler, no “just do more problems.” A plan built for your target, run by someone who’s already been there.',
    ],
    cta: { label: 'Book a diagnostic', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Diagnostic first',
        body: 'Every student starts with a real diagnostic. We don’t sell hours until we know exactly which points are worth chasing.',
      },
      {
        title: 'Coach to the score',
        body: 'Sessions target the sections costing you the most, under real timing, with tactics that hold up on test day.',
      },
      {
        title: 'You can see it move',
        body: 'We track every practice-test score, so progress is a number you watch climb — not a feeling or a promise.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Apex Test Prep', '740 Summit Avenue', 'Suite 210 · Austin, TX 78701'],
    mapLocation: '740 Summit Avenue, Austin, TX 78701',
    hours: [
      { day: 'Monday – Thursday', time: '3:00 – 9:00' },
      { day: 'Friday', time: '4:00 – 9:00' },
      { day: 'Saturday', time: '9:00 – 4:00' },
      { day: 'Sunday', time: '10:00 – 4:00' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your free diagnostic online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a diagnostic', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-tutoring-testprep',
  name: 'sparx — Tutoring (Test Prep)',
  summary:
    'A bold, confident test-prep site — a deep-indigo primary, a punchy amber accent and sharp Space Grotesk headings on a crisp near-white ground. Installs a working booking flow: a free diagnostic plus SAT, ACT, AP and admissions-essay sessions, with three coaches you book by name and their own after-school and weekend hours. Ships as "Apex Test Prep", a results-driven SAT/ACT and college-admissions coaching studio.',
  tagline: 'A sharp, score-focused template for tutoring & test prep — book online from day one.',
  industry: 'Tutoring',
  sortWeight: 31,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Apex Test Prep', tagline: 'Every point, on purpose.' },
  theme: apex,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Apex Test Prep — SAT, ACT & college-admissions coaching',
      description:
        'Apex Test Prep is one-on-one SAT, ACT, AP and admissions coaching built around your target score. Book a free diagnostic and strategy session online.',
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
