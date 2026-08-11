// sparx-pt-wellness — "Restore Physical Therapy & Wellness", a gentle, whole-person clinic.
//
// The calm, restorative sibling of the athletic-ortho PT template (which is blue, fast and
// sport-forward). This one is deliberately its OPPOSITE: a soft sage primary, a warm clay
// accent, a cream ground and a humanist serif display — an unhurried, caring studio for
// pelvic & women's health, geriatric care, balance, chronic pain and wellness. Same booking
// spine, a very different feeling: the page moves slowly, the copy reassures, and the whole
// thing points at ONE calm action — book an evaluation.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-pt-wellness.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-pt-wellness/**" \
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
  hero: 'pt-wellness-hero',
  care: 'pt-wellness-care',
  room: 'pt-wellness-room',
  elena: 'pt-wellness-elena',
  ruth: 'pt-wellness-ruth',
  dana: 'pt-wellness-dana',
  about: 'pt-wellness-about',
} as const;

const PHOTO: Record<string, string> = {
  "restore-hero": "https://images.unsplash.com/photo-1649751361457-01d3a696c7e6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Z2VudGxlJTIwcGh5c2ljYWwlMjB0aGVyYXB5fGVufDB8MHx8fDE3ODYzOTIwNjZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "restore-care": "https://images.unsplash.com/photo-1507537362848-9c7e70b7b5c1?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhlcmFwaXN0JTIwaGVscGluZyUyMHBhdGllbnR8ZW58MHwwfHx8MTc4NjM5MjA2OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "restore-room": "https://images.unsplash.com/photo-1759214630580-7b2e97e2c29b?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VsbG5lc3MlMjB0cmVhdG1lbnQlMjByb29tfGVufDB8MHx8fDE3ODYzOTIwNzF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "restore-elena": "https://images.unsplash.com/photo-1714976694810-85add1a29c96?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0aGVyYXBpc3QlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyMDc0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "restore-ruth": "https://images.unsplash.com/photo-1526080652727-5b77f74eacd2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGh5c2ljYWwlMjB0aGVyYXBpc3QlMjBwb3J0cmFpdCUyMHdvbWFufGVufDB8MHx8fDE3ODYzOTIwNzd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "restore-dana": "https://images.unsplash.com/photo-1659353888906-adb3e0041693?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8aGVhbHRoY2FyZSUyMHdvbWFuJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MjA4MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "restore-about": "https://images.unsplash.com/photo-1665231795856-769fb08a90bc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FsbSUyMGNsaW5pYyUyMGludGVyaW9yfGVufDB8MHx8fDE3ODYzOTIwODJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('restore-hero'), alt: 'A calm, sunlit physical-therapy studio with soft neutral tones' },
  { id: IMG.care, url: src('restore-care'), alt: 'A therapist guiding a patient through a gentle, hands-on movement' },
  { id: IMG.room, url: src('restore-room'), alt: 'A quiet private treatment room with a low table and soft light' },
  { id: IMG.elena, url: src('restore-elena'), alt: 'Elena Marsh, pelvic & women’s-health physical therapist' },
  { id: IMG.ruth, url: src('restore-ruth'), alt: 'Ruth Okafor, geriatric & balance physical therapist' },
  { id: IMG.dana, url: src('restore-dana'), alt: 'Dana Feldman, chronic-pain & wellness physical therapist' },
  { id: IMG.about, url: src('restore-about'), alt: 'Two therapists talking softly in a bright, plant-filled reception' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-pt-wellness: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "restore": cream ground, soft-sage primary, warm-clay accent, serif display ─
const restore = defineTheme({
  name: 'restore',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.75rem', field: '0.75rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97.5% 0.012 95)', // soft cream ground
      'oklch(94% 0.016 120)', // pale sage-oat
      'oklch(89% 0.02 135)', // hairline
      'oklch(30% 0.018 160)', // deep sage-charcoal ink
    ],
    roles: {
      primary: 'oklch(58% 0.05 165)', // soft sage / muted teal
      secondary: 'oklch(37% 0.018 160)', // dark sage-charcoal (readable micro-labels)
      accent: 'oklch(72% 0.075 45)', // warm clay / blush
      neutral: 'oklch(32% 0.014 160)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.016 165)',
      'oklch(20% 0.014 165)',
      'oklch(16% 0.01 165)',
      'oklch(95% 0.012 95)',
    ],
    roles: {
      primary: 'oklch(72% 0.06 165)',
      secondary: 'oklch(80% 0.016 150)',
      accent: 'oklch(78% 0.08 48)',
      neutral: 'oklch(84% 0.014 150)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, therapists + rooms + hours, the visit menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'pt-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel a visit. We’ll send a gentle reminder the day before and again two hours ahead.',
    },
    {
      handle: 'pt-no-show',
      name: 'Evaluation hold',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Your evaluation time is held just for you. If you can’t make it, please let us know 24 hours ahead so we can offer it to someone else. A missed visit without notice may be recorded as a no-show.',
    },
  ],
  resources: [
    {
      handle: 'elena',
      name: 'Elena Marsh, PT, DPT',
      kind: 'staff',
      skillTags: ['pelvic', 'womens', 'manual', 'wellness'],
      windows: hours([1, 2, 3, 4], 480, 960), // Mon–Thu 8–4
    },
    {
      handle: 'ruth',
      name: 'Ruth Okafor, PT, DPT',
      kind: 'staff',
      skillTags: ['geriatric', 'balance', 'manual'],
      windows: hours([1, 2, 4, 5], 540, 1020), // Mon, Tue, Thu, Fri 9–5
    },
    {
      handle: 'dana',
      name: 'Dana Feldman, PT, DPT',
      kind: 'staff',
      skillTags: ['chronic-pain', 'wellness', 'manual'],
      windows: hours([2, 3, 4, 5], 600, 1080), // Tue–Fri 10–6
    },
    {
      handle: 'room-willow',
      name: 'Willow Room',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([1, 2, 3, 4, 5], 480, 1080), // Mon–Fri 8–6
    },
    {
      handle: 'room-cedar',
      name: 'Cedar Room',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([1, 2, 3, 4, 5], 480, 1080), // Mon–Fri 8–6
    },
  ],
  services: [
    {
      handle: 'initial-evaluation',
      name: 'Initial evaluation',
      description:
        'An unhurried first visit — we listen to your whole history, assess gently, and build a plan together. Where the care begins.',
      durationMinutes: 60,
      priceCents: 14000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['manual'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'pt-no-show',
    },
    {
      handle: 'follow-up-session',
      name: 'Follow-up session',
      description: 'A one-on-one treatment visit as your plan progresses — hands-on work, guided movement, small steady wins.',
      durationMinutes: 45,
      priceCents: 9500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['manual'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'pt-standard',
    },
    {
      handle: 'pelvic-health-visit',
      name: 'Pelvic & women’s-health visit',
      description: 'Private, respectful care for pelvic health, pregnancy and postpartum recovery — with a therapist who specializes in it.',
      durationMinutes: 60,
      priceCents: 13500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['pelvic'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'pt-standard',
    },
    {
      handle: 'balance-fall-prevention',
      name: 'Balance & fall prevention',
      description: 'Gentle, confidence-building work for steadier standing and safer walking — thoughtfully paced for all ages and abilities.',
      durationMinutes: 45,
      priceCents: 10000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['balance'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'pt-standard',
    },
    {
      handle: 'chronic-pain-session',
      name: 'Chronic-pain session',
      description: 'A calm, whole-person approach to persistent pain — pacing, hands-on care and movement that meets you where you are.',
      durationMinutes: 60,
      priceCents: 12500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['chronic-pain'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'pt-standard',
    },
    {
      handle: 'manual-therapy-session',
      name: 'Manual-therapy session',
      description: 'Focused hands-on treatment to ease stiffness and restore easy, comfortable movement.',
      durationMinutes: 30,
      priceCents: 7500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['manual'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'pt-standard',
    },
    {
      handle: 'wellness-consult',
      name: 'Wellness consult',
      description: 'A friendly, no-cost conversation about your goals — the easiest way to see if we’re the right fit before you book care.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['wellness'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'pt-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A calm, sunlit physical-therapy studio with soft neutral tones',
    title: 'Gentle care that helps you feel like yourself again',
    sub: 'A calm, whole-person physical-therapy clinic for pelvic and women’s health, balance, chronic pain and wellness — one unhurried hour at a time.',
    primary: { label: 'Book an evaluation', href: '/book' },
    secondary: { label: 'See our visits', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Unhurried, one-on-one visits',
        body: 'You get your therapist’s full attention for the whole visit — no double-booking, no handing you off to an aide. Just steady, personal care.',
      },
      {
        title: 'Pelvic & women’s health',
        body: 'Private, respectful care for pregnancy, postpartum recovery and pelvic-floor concerns — with a therapist who truly specializes in it.',
      },
      {
        title: 'All ages and abilities',
        body: 'From new parents to grandparents, first steps to steadier ones. We meet you exactly where you are and move at your pace.',
      },
      {
        title: 'Most insurance accepted',
        body: 'We accept most major plans and will check your benefits before your first visit, so there are no surprises — just care.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways we can help',
    intro: 'A few of the visits we offer most. Full pricing and live openings are on the booking page — most people start with an evaluation.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Initial evaluation', priceCents: 14000, durationMin: 60, desc: 'An unhurried first visit and a plan built with you.' },
      { name: 'Pelvic & women’s-health visit', priceCents: 13500, durationMin: 60, desc: 'Private, specialized pelvic and postpartum care.' },
      { name: 'Balance & fall prevention', priceCents: 10000, durationMin: 45, desc: 'Confidence-building work for steadier movement.' },
      { name: 'Chronic-pain session', priceCents: 12500, durationMin: 60, desc: 'A calm, whole-person approach to persistent pain.' },
    ],
    cta: { label: 'See every visit & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.care),
    alt: 'A therapist guiding a patient through a gentle, hands-on movement',
    heading: 'We treat the whole person, not just the part that hurts',
    body: [
      'Pain and stiffness rarely live in one place. So we take time to understand your whole story — how you move, sleep, work and worry — before we ever lay hands on the problem.',
      'From there it’s gentle, hands-on care paired with movement you can actually keep up at home. No rushing, no one-size plan. Just steady progress you can feel, and a therapist who stays with you the whole way.',
    ],
    cta: { label: 'Book an evaluation', href: '/book' },
  }),
  teamRow({
    heading: 'The therapists you’ll work with',
    intro: 'Book by name — you’ll see the same person each visit, someone who learns your body and your goals.',
    members: [
      {
        name: 'Elena Marsh, PT, DPT',
        role: 'Pelvic & women’s health',
        image: url(IMG.elena),
        alt: 'Elena Marsh, pelvic & women’s-health physical therapist',
        bio: 'Pelvic-floor, pregnancy and postpartum care delivered with patience and real expertise.',
      },
      {
        name: 'Ruth Okafor, PT, DPT',
        role: 'Geriatric & balance',
        image: url(IMG.ruth),
        alt: 'Ruth Okafor, geriatric & balance physical therapist',
        bio: 'Helps older adults move with confidence again — steadier balance, safer walking, fewer falls.',
      },
      {
        name: 'Dana Feldman, PT, DPT',
        role: 'Chronic pain & wellness',
        image: url(IMG.dana),
        alt: 'Dana Feldman, chronic-pain & wellness physical therapist',
        bio: 'A calm, whole-person approach to persistent pain and long-term wellness goals.',
      },
    ],
  }),
  testimonial({
    quote: 'I came in barely able to walk after my second baby, and I was nervous. They made me feel safe from the first minute. Six weeks later I’m carrying both kids up the stairs. I have my body back.',
    attribution: 'Marisol, patient since this spring',
  }),
  bookingCta({
    title: 'Let’s start with a gentle evaluation',
    sub: 'Choose a time that suits you and pick your therapist — booking online takes about a minute, and there’s no rush.',
    cta: { label: 'Book an evaluation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.room),
    alt: 'A quiet private treatment room with a low table and soft light',
    title: 'Book your evaluation',
    sub: 'Choose a visit to see live openings and pricing, then pick your therapist and a time that feels right. Not sure where to start? A wellness consult is free.',
    primary: { label: 'See visits below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.about),
    alt: 'Two therapists talking softly in a bright, plant-filled reception',
    heading: 'About Restore',
    body: [
      'We started Restore Physical Therapy & Wellness because so much of healthcare feels rushed — fifteen minutes, a printout, and out the door. We wanted to do the opposite: slow down, listen fully, and treat the whole person in front of us.',
      'That means real one-on-one time, a therapist who stays with you visit to visit, and care that fits your life rather than the clock. Whether you’re recovering, in pain, or simply want to move and feel better, you’re welcome here.',
    ],
    cta: { label: 'Book an evaluation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we care for you',
    items: [
      {
        title: 'We listen first',
        body: 'Every plan starts with a real conversation about your history, your goals and what a good day would actually feel like for you.',
      },
      {
        title: 'We move at your pace',
        body: 'No pushing through pain and no rigid protocols. We adjust gently as you go, so every visit meets your body where it is that day.',
      },
      {
        title: 'We hand you the tools',
        body: 'You leave each visit knowing exactly what to do at home — simple, doable movement that keeps your progress going between sessions.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the clinic',
    address: ['Restore Physical Therapy & Wellness', '54 Meadowbrook Lane', 'Suite 3 · Asheville, NC 28801'],
    mapLocation: '54 Meadowbrook Lane, Asheville, NC 28801',
    hours: [
      { day: 'Monday – Thursday', time: '8:00 – 6:00' },
      { day: 'Friday', time: '8:00 – 5:00' },
      { day: 'Saturday', time: 'By appointment' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live openings and reserve your evaluation online — no phone tag, no waiting on hold.',
    surface: 'muted',
    cta: { label: 'Book an evaluation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-pt-wellness',
  name: 'sparx — Physical Therapy & Wellness',
  summary:
    'A calm, whole-person physical-therapy site — a soft-sage palette, a warm-clay accent and a gentle serif display. Installs online booking from day one: evaluations and one-on-one sessions for pelvic health, balance, chronic pain and wellness, three therapists you book by name plus two private treatment rooms as resources, and reminder + evaluation-hold policies. Ships as "Restore Physical Therapy & Wellness".',
  tagline: 'A gentle, restorative template for physical-therapy clinics — book evaluations online from day one.',
  industry: 'Physical therapy',
  sortWeight: 47,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Restore Physical Therapy & Wellness', tagline: 'Gentle care, whole-person healing.' },
  theme: restore,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Restore Physical Therapy & Wellness — gentle, whole-person care',
      description:
        'Restore is a calm physical-therapy clinic for pelvic and women’s health, balance, chronic pain and wellness. Unhurried one-on-one care. Book your evaluation online.',
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
