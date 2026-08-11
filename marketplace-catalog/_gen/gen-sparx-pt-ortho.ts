// sparx-pt-ortho — "Momentum Physical Therapy", an orthopedic & sports PT / rehab clinic.
//
// The athletic, results-driven sibling in the physical-therapy lane: a confident teal
// primary over a crisp near-white ground, an energetic orange accent, a sturdy modern
// display (Outfit) over Inter, and tight radii. Deliberately the OPPOSITE of the gentle
// recovery/wellness PT template — this one is built for active people: injury recovery,
// post-op rehab, sports performance, manual therapy and dry needling. Same booking spine
// as the family, a different business — the whole site drives toward "Book an evaluation",
// and the installer replays a live booking flow with therapists AND treatment rooms as
// multi-requirement resources.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-pt-ortho.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-pt-ortho/**" \
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
  hero: 'pt-ortho-hero',
  facility: 'pt-ortho-facility',
  method: 'pt-ortho-method',
  jordan: 'pt-ortho-jordan',
  sasha: 'pt-ortho-sasha',
  nadia: 'pt-ortho-nadia',
} as const;

const PHOTO: Record<string, string> = {
  "momentum-hero": "https://images.unsplash.com/photo-1649751361457-01d3a696c7e6?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGh5c2ljYWwlMjB0aGVyYXB5JTIwcmVoYWJ8ZW58MHwwfHx8MTc4NjM5MjA0OXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "momentum-facility": "https://images.unsplash.com/photo-1627257058769-0a99529e4312?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGh5c2ljYWwlMjB0aGVyYXB5JTIwZ3ltJTIwZXF1aXBtZW50fGVufDB8MHx8fDE3ODYzOTIwNTJ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "momentum-method": "https://images.unsplash.com/photo-1706353399656-210cca727a33?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhlcmFwaXN0JTIwcGF0aWVudCUyMGV4ZXJjaXNlfGVufDB8MHx8fDE3ODYzOTIwNTZ8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "momentum-jordan": "https://images.unsplash.com/photo-1671869239603-8d73133e0e5e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGh5c2ljYWwlMjB0aGVyYXBpc3QlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2MzkwNzQxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "momentum-sasha": "https://images.unsplash.com/photo-1526080652727-5b77f74eacd2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwaHlzaWNhbCUyMHRoZXJhcGlzdCUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTIwNjB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "momentum-nadia": "https://images.unsplash.com/photo-1706353399656-210cca727a33?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGh5c2lvdGhlcmFwaXN0JTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MjA2M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('momentum-hero'), alt: 'A therapist guiding an athlete through a loaded rehab movement on the clinic floor' },
  { id: IMG.facility, url: src('momentum-facility'), alt: 'An open rehab gym with treatment tables and training equipment' },
  { id: IMG.method, url: src('momentum-method'), alt: 'A physical therapist coaching a patient through a strength exercise one-on-one' },
  { id: IMG.jordan, url: src('momentum-jordan'), alt: 'Dr. Jordan Ellis, DPT, orthopedic & manual therapy lead' },
  { id: IMG.sasha, url: src('momentum-sasha'), alt: 'Dr. Sasha Kim, DPT, sports rehab & dry-needling specialist' },
  { id: IMG.nadia, url: src('momentum-nadia'), alt: 'Dr. Nadia Okonkwo, DPT, post-op & manual therapy specialist' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-pt-ortho: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "momentum": confident teal primary, energetic orange accent, crisp near-white
//    ground, a sturdy modern display. Dark slate ink on light; readable light ink on dark. ─
const momentum = defineTheme({
  name: 'momentum',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.25rem', field: '0.25rem', box: '0.375rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.005 210)', // crisp cool near-white
      'oklch(95% 0.008 210)', // pale mist
      'oklch(90% 0.013 210)', // hairline
      'oklch(23% 0.03 235)', // deep slate ink
    ],
    roles: {
      primary: 'oklch(58% 0.115 200)', // confident teal
      secondary: 'oklch(34% 0.03 235)', // dark slate ink (readable micro-labels)
      accent: 'oklch(70% 0.17 52)', // energetic orange
      neutral: 'oklch(24% 0.025 235)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(20% 0.02 235)',
      'oklch(16% 0.015 235)',
      'oklch(13% 0.01 235)',
      'oklch(95% 0.005 210)',
    ],
    roles: {
      primary: 'oklch(68% 0.125 200)',
      secondary: 'oklch(80% 0.02 210)', // readable LIGHT tone on dark ground
      accent: 'oklch(76% 0.17 52)',
      neutral: 'oklch(86% 0.02 210)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine: policies, therapists + treatment rooms, the menu ────
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
      handle: 'evaluation-hold',
      name: 'Evaluation & post-op policy',
      depositType: 'card_hold',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Evaluations and post-op sessions hold a full slot with a therapist and a room, so we keep a card on file — nothing is charged unless you miss the visit or cancel with less than 24 hours’ notice.',
    },
  ],
  resources: [
    {
      handle: 'jordan',
      name: 'Dr. Jordan Ellis, DPT',
      kind: 'staff',
      skillTags: ['ortho', 'manual', 'sports'],
      windows: hours([1, 3, 5], 420, 1140), // Mon/Wed/Fri 7a–7p (early + evening)
    },
    {
      handle: 'sasha',
      name: 'Dr. Sasha Kim, DPT',
      kind: 'staff',
      skillTags: ['sports', 'dry-needling', 'ortho'],
      windows: hours([2, 4, 6], 480, 1200), // Tue/Thu/Sat 8a–8p
    },
    {
      handle: 'nadia',
      name: 'Dr. Nadia Okonkwo, DPT',
      kind: 'staff',
      skillTags: ['post-op', 'manual', 'ortho'],
      windows: hours([1, 2, 4], 540, 1230), // Mon/Tue/Thu 9a–8:30p
    },
    {
      handle: 'room-1',
      name: 'Treatment Room 1',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1260), // Mon–Sat 7a–9p
    },
    {
      handle: 'gym-floor',
      name: 'Rehab Gym Floor',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 420, 1260),
    },
  ],
  services: [
    {
      handle: 'initial-evaluation',
      name: 'Initial evaluation',
      description:
        'A full one-on-one assessment — we pinpoint what’s driving the pain or limitation, then build the plan to get you back to doing what you love.',
      durationMinutes: 60,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['ortho'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'evaluation-hold',
    },
    {
      handle: 'follow-up-session',
      name: 'Follow-up session',
      description:
        'A hands-on treatment and progression visit — we advance your program as you get stronger and keep you moving forward.',
      durationMinutes: 45,
      priceCents: 9500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['ortho'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'clinic-standard',
    },
    {
      handle: 'sports-rehab-session',
      name: 'Sports rehab session',
      description:
        'Loaded, sport-specific rehab to rebuild strength, power and control — the work that gets you back on the field and keeps you there.',
      durationMinutes: 60,
      priceCents: 12000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['sports'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'clinic-standard',
    },
    {
      handle: 'manual-therapy-session',
      name: 'Manual therapy session',
      description:
        'Skilled hands-on soft-tissue and joint work to free up restriction, calm irritated tissue and restore clean, pain-free range of motion.',
      durationMinutes: 30,
      priceCents: 8500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['manual'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'clinic-standard',
    },
    {
      handle: 'dry-needling-session',
      name: 'Dry-needling session',
      description:
        'Precise needling to release stubborn trigger points and switch tight, guarded muscles back on — often the fastest way to unlock a plateau.',
      durationMinutes: 30,
      priceCents: 9000,
      bufferAfterMin: 5,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['dry-needling'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'clinic-standard',
    },
    {
      handle: 'post-op-rehab',
      name: 'Post-op rehab',
      description:
        'Guided recovery after surgery — a careful, progressive program that protects the repair and rebuilds your strength and mobility step by step.',
      durationMinutes: 60,
      priceCents: 13000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['post-op'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'evaluation-hold',
    },
    {
      handle: 'movement-screen',
      name: 'Movement screen',
      description:
        'A free screen of how you actually move under load — we find the weak link and tell you straight whether we’re the right team to fix it. No pressure.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['ortho'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'evaluation-hold',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A therapist guiding an athlete through a loaded rehab movement on the clinic floor',
    title: 'Get back to doing what you love',
    sub: 'Orthopedic & sports physical therapy for injury recovery, post-op rehab and getting back to full strength. We find the cause, treat it hands-on, and rebuild you to do more than before.',
    primary: { label: 'Book an evaluation', href: '/book' },
    secondary: { label: 'See what we do', href: '/book' },
    overlay: 'darker',
  }),
  featureRow({
    items: [
      {
        title: 'Doctors of physical therapy',
        body: 'Every therapist here is a licensed DPT with orthopedic and sports training. You get expert care from someone who understands the demand you’re getting back to.',
      },
      {
        title: 'One-on-one, hands-on care',
        body: 'A full session with your therapist — not passed off to an aide or a machine. Real hands-on treatment and coaching, every visit.',
      },
      {
        title: 'Most insurance accepted',
        body: 'We work with most major plans and make the benefits side simple, so you can focus on getting better instead of paperwork.',
      },
      {
        title: 'Back to it, faster',
        body: 'A clear diagnosis, a real plan, and a target to be back to your sport, your job or your routine — not an open-ended schedule of visits.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What you can book',
    intro: 'Straight-talking visits with clear times and prices. Full availability is on the booking page — pick a therapist and a slot that works for you.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Initial evaluation', priceCents: 15000, durationMin: 60, desc: 'The full assessment — find the cause, build the plan.' },
      { name: 'Sports rehab session', priceCents: 12000, durationMin: 60, desc: 'Loaded, sport-specific work to get you back on the field.' },
      { name: 'Manual therapy session', priceCents: 8500, durationMin: 30, desc: 'Hands-on work to free up restriction and restore range.' },
      { name: 'Post-op rehab', priceCents: 13000, durationMin: 60, desc: 'Guided recovery that protects the repair and rebuilds strength.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.method),
    alt: 'A physical therapist coaching a patient through a strength exercise one-on-one',
    heading: 'Evaluate, treat, rebuild — the Momentum method',
    body: [
      'Most rehab chases the pain. We chase the cause. Every patient starts with a full evaluation, so we treat the reason the tissue failed — not just the spot that hurts.',
      'From there it’s hands-on treatment to settle things down, then loaded, progressive rehab to build real capacity back. That last step is what keeps the injury from coming back — and gets you doing more than you did before.',
    ],
    cta: { label: 'Book your evaluation', href: '/book' },
  }),
  teamRow({
    heading: 'Your therapists',
    intro: 'Book by name — you’ll work with a doctor of physical therapy who knows your history and your goals.',
    members: [
      { name: 'Dr. Jordan Ellis, DPT', role: 'Orthopedic & manual therapy lead', image: url(IMG.jordan), alt: 'Dr. Jordan Ellis, DPT, orthopedic & manual therapy lead', bio: 'Orthopedic rehab and hands-on manual therapy for active people. Jordan leads the clinic.' },
      { name: 'Dr. Sasha Kim, DPT', role: 'Sports rehab & dry-needling specialist', image: url(IMG.sasha), alt: 'Dr. Sasha Kim, DPT, sports rehab & dry-needling specialist', bio: 'Return-to-sport rehab and dry needling — the work that gets athletes back to full speed.' },
      { name: 'Dr. Nadia Okonkwo, DPT', role: 'Post-op & manual therapy specialist', image: url(IMG.nadia), alt: 'Dr. Nadia Okonkwo, DPT, post-op & manual therapy specialist', bio: 'Post-surgical recovery and manual therapy — careful, progressive rebuilding that lasts.' },
    ],
  }),
  testimonial({
    quote: 'Blew out my knee skiing and the surgeon said six months. Momentum had me hiking again in four — and stronger than before I got hurt. They didn’t just rehab me, they rebuilt me.',
    attribution: 'Daniel R., recovered ACL patient',
    surface: 'primary',
  }),
  bookingCta({
    title: 'Stop training around the pain',
    sub: 'Book an evaluation and get a real plan to get back to full strength. It takes about a minute.',
    cta: { label: 'Book an evaluation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.facility),
    alt: 'An open rehab gym with treatment tables and training equipment',
    title: 'Book your visit',
    sub: 'Choose a service to see prices and live availability, then pick your therapist and time.',
    primary: { label: 'See services below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.facility),
    alt: 'An open rehab gym with treatment tables and training equipment',
    heading: 'About Momentum Physical Therapy',
    body: [
      'We built Momentum for the people other clinics send home with a sheet of exercises and a shrug. Athletes, weekend warriors, post-op patients, anyone whose life doesn’t stop when something gives out.',
      'It’s part treatment room, part training floor. We diagnose hard, treat hands-on, and load you back to full capacity — because getting out of pain and getting back to what you love are two different jobs, and we do both.',
    ],
    cta: { label: 'Book an evaluation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'Evaluation first', body: 'Every plan starts with how you move. We find the weak link before we treat the pain, so we fix the cause, not just the symptom.' },
      { title: 'Hands-on, then loaded', body: 'Manual therapy and dry needling to settle things down, then progressive, loaded rehab to build real strength back.' },
      { title: 'Back to your life', body: 'We work to a target — a return-to-sport date, a lift, a job task — not an open-ended schedule of maintenance visits.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the clinic',
    address: ['Momentum Physical Therapy', '318 Cascade Ave', 'Suite 4 · Boulder, CO 80302'],
    mapLocation: '318 Cascade Ave, Boulder, CO 80302',
    hours: [
      { day: 'Monday – Thursday', time: '7:00 – 8:30' },
      { day: 'Friday', time: '7:00 – 7:00' },
      { day: 'Saturday', time: '8:00 – 2:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your time online — no phone tag, no waiting-room hold music.',
    surface: 'muted',
    cta: { label: 'Book an evaluation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-pt-ortho',
  name: 'sparx — Physical Therapy (Ortho & Sports)',
  summary:
    'An active, results-driven orthopedic & sports physical therapy site — a confident teal palette with an energetic orange accent on a crisp near-white ground. Installs a working booking flow: evaluations, follow-ups, sports rehab, manual therapy, dry needling and post-op rehab, with three therapists AND treatment rooms as multi-requirement resources. Ships as "Momentum Physical Therapy", an ortho & sports rehab clinic that books evaluations online from day one.',
  tagline: 'An athletic template for ortho & sports physical therapy — book evaluations online from day one.',
  industry: 'Physical therapy',
  sortWeight: 48,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Momentum Physical Therapy', tagline: 'Fix the cause. Build it back.' },
  theme: momentum,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Momentum Physical Therapy — ortho & sports rehab',
      description:
        'Orthopedic & sports physical therapy for injury recovery, post-op rehab and getting back to full strength. Book an evaluation online.',
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
