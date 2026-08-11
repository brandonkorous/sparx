// sparx-tutoring-academic — "Summit Learning", a warm K-12 academic TUTORING center.
//
// The encouraging, confidence-building tutoring center of the design research: a warm
// off-white ground, a friendly warm-blue primary, a sunny amber accent and a rounded,
// approachable sans display over Inter. All-subjects and all-ages (kids & teens) —
// math, reading, writing, science and homework help — with a caring, parent-facing
// voice. Deliberately the WARM, all-subjects sibling of the SAT/ACT test-prep template
// (which is sharper and score-focused): same booking spine, a softer business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-tutoring-academic.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-tutoring-academic/**" \
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
  hero: 'tutoring-academic-hero',
  center: 'tutoring-academic-center',
  approach: 'tutoring-academic-approach',
  elena: 'tutoring-academic-elena',
  marcus: 'tutoring-academic-marcus',
  priya: 'tutoring-academic-priya',
} as const;

const PHOTO: Record<string, string> = {
  "summit-hero": "https://images.unsplash.com/photo-1560785496-3c9d27877182?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hpbGQlMjBzdHVkeWluZyUyMHR1dG9yfGVufDB8MHx8fDE3ODYzOTMyNDB8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "summit-center": "https://images.unsplash.com/photo-1763310225230-6e15b125935a?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bGVhcm5pbmclMjBjZW50ZXIlMjBjbGFzc3Jvb218ZW58MHwwfHx8MTc4NjM5MzI0M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "summit-approach": "https://images.unsplash.com/photo-1598981457915-aea220950616?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8c3R1ZGVudCUyMHdyaXRpbmclMjBkZXNrfGVufDB8MHx8fDE3ODYzOTMyNTF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "summit-elena": "https://images.unsplash.com/photo-1590650213165-c1fef80648c4?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0ZWFjaGVyJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM5MzI1M3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "summit-marcus": "https://images.unsplash.com/photo-1623366302587-b38b1ddaefd9?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dHV0b3IlMjBwb3J0cmFpdCUyMG1hbnxlbnwwfDB8fHwxNzg2MzkzMjU3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "summit-priya": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0dXRvciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTMyNTl8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('summit-hero'),
    alt: 'A tutor sitting beside a smiling student, working through a problem together',
  },
  {
    id: IMG.center,
    url: src('summit-center'),
    alt: 'A bright, welcoming learning room with a shared table and books',
  },
  {
    id: IMG.approach,
    url: src('summit-approach'),
    alt: 'A young student raising a hand with a confident grin',
  },
  { id: IMG.elena, url: src('summit-elena'), alt: 'Elena Marsh, math and science tutor' },
  { id: IMG.marcus, url: src('summit-marcus'), alt: 'Marcus Bell, reading and writing tutor' },
  { id: IMG.priya, url: src('summit-priya'), alt: 'Priya Nair, math and homework coach' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-tutoring-academic: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "summit": warm off-white ground, friendly warm-blue primary, sunny accent ──
const summit = defineTheme({
  name: 'summit',
  type: { body: face('Inter', 'sans-serif'), head: face('Nunito', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.008 85)', // warm off-white
      'oklch(95% 0.012 82)', // warm cream
      'oklch(90% 0.016 80)', // hairline
      'oklch(28% 0.02 250)', // deep, warm-cool ink
    ],
    roles: {
      primary: 'oklch(58% 0.115 235)', // friendly warm blue
      secondary: 'oklch(38% 0.03 245)', // dark ink-blue (readable micro-labels)
      accent: 'oklch(80% 0.13 82)', // sunny amber
      neutral: 'oklch(30% 0.018 250)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 250)',
      'oklch(20% 0.016 250)',
      'oklch(16% 0.012 250)',
      'oklch(95% 0.01 85)',
    ],
    roles: {
      primary: 'oklch(72% 0.12 235)',
      secondary: 'oklch(80% 0.02 250)',
      accent: 'oklch(83% 0.12 84)',
      neutral: 'oklch(82% 0.016 250)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, tutors + rooms, the session menu) ────────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'session-standard',
      name: 'Standard session',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to reschedule or cancel a session. We send a reminder the day before and two hours ahead, so a busy week never means a missed lesson.',
    },
  ],
  resources: [
    {
      handle: 'elena',
      name: 'Elena Marsh',
      kind: 'staff',
      skillTags: ['math', 'science', 'general'],
      // Mon–Thu after school 3–7pm, Sat morning 9am–1pm
      windows: hours([1, 2, 3, 4], 900, 1140).concat(hours([6], 540, 780)),
    },
    {
      handle: 'marcus',
      name: 'Marcus Bell',
      kind: 'staff',
      skillTags: ['reading', 'writing', 'general'],
      // Tue–Fri after school 3–7pm, Sat 10am–2pm
      windows: hours([2, 3, 4, 5], 900, 1140).concat(hours([6], 600, 840)),
    },
    {
      handle: 'priya',
      name: 'Priya Nair',
      kind: 'staff',
      skillTags: ['math', 'homework', 'general'],
      // Mon, Wed, Fri after school 3–7pm, Sun 10am–2pm
      windows: hours([1, 3, 5], 900, 1140).concat(hours([0], 600, 840)),
    },
    {
      handle: 'room-1',
      name: 'Learning Room 1',
      kind: 'space',
      skillTags: ['learning-room'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 540, 1200), // every day 9am–8pm
    },
    {
      handle: 'room-2',
      name: 'Learning Room 2',
      kind: 'space',
      skillTags: ['learning-room'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 540, 1200), // every day 9am–8pm
    },
  ],
  services: [
    {
      handle: 'free-assessment',
      name: 'Free assessment',
      description:
        'A relaxed, no-pressure first visit — we get to know your child, find where they are and where they’re headed, and build a plan together. No cost, no commitment.',
      durationMinutes: 45,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tutor', kind: 'staff', skillTags: ['general'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['learning-room'], count: 1 },
      ],
      policyHandle: 'session-standard',
    },
    {
      handle: 'math-tutoring',
      name: 'Math tutoring',
      description:
        'One-to-one math for any grade — from times tables and fractions to algebra and geometry, at a pace that builds real understanding, not just right answers.',
      durationMinutes: 60,
      priceCents: 6500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tutor', kind: 'staff', skillTags: ['math'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['learning-room'], count: 1 },
      ],
      policyHandle: 'session-standard',
    },
    {
      handle: 'reading-tutoring',
      name: 'Reading tutoring',
      description:
        'Warm, patient reading support — phonics and fluency for younger readers, comprehension and confidence for older ones. We meet every reader where they are.',
      durationMinutes: 45,
      priceCents: 6000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tutor', kind: 'staff', skillTags: ['reading'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['learning-room'], count: 1 },
      ],
      policyHandle: 'session-standard',
    },
    {
      handle: 'writing-tutoring',
      name: 'Writing tutoring',
      description:
        'From first sentences to essays and reports — structure, grammar and finding a voice, with kind feedback that makes writing feel a whole lot less scary.',
      durationMinutes: 45,
      priceCents: 6000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tutor', kind: 'staff', skillTags: ['writing'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['learning-room'], count: 1 },
      ],
      policyHandle: 'session-standard',
    },
    {
      handle: 'science-tutoring',
      name: 'Science tutoring',
      description:
        'Biology, chemistry, physics and everything in between — we make the tricky parts click with clear explanations and plenty of encouragement along the way.',
      durationMinutes: 60,
      priceCents: 6500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'tutor', kind: 'staff', skillTags: ['science'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['learning-room'], count: 1 },
      ],
      policyHandle: 'session-standard',
    },
    {
      handle: 'homework-help',
      name: 'Homework help',
      description:
        'A focused hour to get today’s homework done and understood. Great for busy weeks — your child leaves with the work finished and the concept actually learned.',
      durationMinutes: 30,
      priceCents: 4500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tutor', kind: 'staff', skillTags: ['homework'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['learning-room'], count: 1 },
      ],
      policyHandle: 'session-standard',
    },
    {
      handle: 'small-group-session',
      name: 'Small-group session',
      description:
        'A friendly group of no more than four, working on the same subject. The social, motivating side of learning — and a gentler price than one-to-one.',
      durationMinutes: 60,
      priceCents: 4000,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'tutor', kind: 'staff', skillTags: ['general'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['learning-room'], count: 1 },
      ],
      policyHandle: 'session-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A tutor sitting beside a smiling student, working through a problem together',
    title: 'Where kids find their confidence',
    sub: 'Caring, one-to-one tutoring for grades K–12 — math, reading, writing, science and homework help, from tutors who make learning feel good again.',
    primary: { label: 'Book a free assessment', href: '/book' },
    secondary: { label: 'See our subjects', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Certified, caring tutors',
        body: 'Every tutor is qualified, background-checked and — just as important — genuinely kind. Your child looks forward to coming back.',
      },
      {
        title: 'A plan made for your child',
        body: 'We start with a free assessment, then build a personalized learning plan around exactly what your child needs, not a one-size-fits-all worksheet.',
      },
      {
        title: 'Small-group & one-to-one',
        body: 'Choose focused one-to-one attention or a friendly small group of four. Both keep every child seen, supported and moving forward.',
      },
      {
        title: 'Progress you can see',
        body: 'You’ll always know how it’s going — the wins, the next steps, and the growing confidence that shows up in schoolwork and at home.',
      },
    ],
  }),
  serviceMenu({
    heading: 'What we help with',
    intro: 'Every subject your child brings us, taught with patience. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free assessment',
        priceCents: 0,
        durationMin: 45,
        desc: 'A no-pressure first visit and a plan built for your child.',
      },
      {
        name: 'Math tutoring',
        priceCents: 6500,
        durationMin: 60,
        desc: 'Times tables to algebra, built on real understanding.',
      },
      {
        name: 'Reading tutoring',
        priceCents: 6000,
        durationMin: 45,
        desc: 'Phonics, fluency and comprehension, at their pace.',
      },
      {
        name: 'Homework help',
        priceCents: 4500,
        durationMin: 30,
        desc: 'Get today’s homework done — and actually understood.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.approach),
    alt: 'A young student raising a hand with a confident grin',
    heading: 'Confidence first, grades follow',
    body: [
      'A child who believes they can do it is a child who will. So before we drill a single problem, we build the belief — celebrating small wins, taking the fear out of mistakes, and showing your child that hard things get easier.',
      'The grades come, because the confidence comes first. Parents tell us the biggest change isn’t a report card — it’s a kid who now says “I’ve got this” at the kitchen table.',
    ],
    cta: { label: 'Book a free assessment', href: '/book' },
  }),
  teamRow({
    heading: 'Meet the tutors',
    intro: 'Book by name — your child sees the same friendly face each visit.',
    members: [
      {
        name: 'Elena Marsh',
        role: 'Math & science tutor',
        image: url(IMG.elena),
        alt: 'Elena Marsh, math and science tutor',
        bio: 'Makes the tricky stuff click — algebra, geometry and science, with endless patience.',
      },
      {
        name: 'Marcus Bell',
        role: 'Reading & writing tutor',
        image: url(IMG.marcus),
        alt: 'Marcus Bell, reading and writing tutor',
        bio: 'Turns reluctant readers into eager ones and takes the scary out of writing.',
      },
      {
        name: 'Priya Nair',
        role: 'Math & homework coach',
        image: url(IMG.priya),
        alt: 'Priya Nair, math and homework coach',
        bio: 'The calm in a busy week — keeps homework on track and confidence growing.',
      },
    ],
  }),
  testimonial({
    quote:
      'My son used to dread math. Six months at Summit and he’s the one reminding me about his session. His grades are up, but honestly it’s the confidence that changed everything.',
    attribution: 'Danielle, parent of a 5th grader',
  }),
  bookingCta({
    title: 'Start with a free assessment',
    sub: 'Tell us where your child is, and we’ll show you where they can go. Booking takes about a minute.',
    cta: { label: 'Book a free assessment', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.center),
    alt: 'A bright, welcoming learning room with a shared table and books',
    title: 'Book a session',
    sub: 'Start with a free assessment, or choose a subject to see prices and live availability, then pick your tutor and time.',
    primary: { label: 'See sessions below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.center),
    alt: 'A bright, welcoming learning room with a shared table and books',
    heading: 'About Summit Learning',
    body: [
      'We started Summit Learning because we believe every child can learn — they just need the right person beside them, a little patience, and a place that feels safe to try, get it wrong, and try again.',
      'That’s what we built: a warm learning center, not a test factory. Real tutors who care, plans made for one child at a time, and a room where a kid can go from “I can’t” to “watch me.”',
    ],
    cta: { label: 'Book a free assessment', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'A free assessment first',
        body: 'Every child starts with a relaxed assessment so we understand their strengths, their gaps and how they learn best — before a single session is booked.',
      },
      {
        title: 'Patience over pressure',
        body: 'We never rush a child or make them feel behind. Learning sticks when it’s calm, encouraging and paced for the kid in the chair.',
      },
      {
        title: 'Parents in the loop',
        body: 'You’ll hear how each session went and what’s next. We’re a team — you, your child, and a tutor who’s genuinely in your corner.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the center',
    address: ['Summit Learning', '210 Maple Avenue', 'Suite 4 · Madison, WI 53703'],
    mapLocation: '210 Maple Avenue, Madison, WI 53703',
    hours: [
      { day: 'Monday – Friday', time: '3:00 – 8:00' },
      { day: 'Saturday', time: '9:00 – 2:00' },
      { day: 'Sunday', time: '10:00 – 2:00' },
      { day: 'Weekday mornings', time: 'By appointment' },
    ],
  }),
  bookingCta({
    title: 'Questions before you book?',
    sub: 'Reach out any time — or skip the phone tag and reserve a free assessment online.',
    surface: 'muted',
    cta: { label: 'Book a free assessment', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-tutoring-academic',
  name: 'sparx — Tutoring (Academic)',
  summary:
    'A warm, encouraging K–12 tutoring center — math, reading, writing, science and homework help for kids and teens. A friendly warm-blue palette with a sunny accent and online booking from day one: a free assessment plus subject and small-group sessions, three caring tutors and two learning rooms provisioned as bookable resources, and a 24-hour reschedule policy. Ships as "Summit Learning", built to book.',
  tagline: 'A warm, confidence-building template for academic tutoring — book online from day one.',
  industry: 'Tutoring',
  sortWeight: 32,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Summit Learning', tagline: 'Where kids find their confidence.' },
  theme: summit,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Summit Learning — K–12 tutoring center',
      description:
        'Summit Learning is a warm, caring tutoring center for grades K–12 — math, reading, writing, science and homework help. Book a free assessment online.',
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
