// sparx-therapy-modern — "Clearmind Therapy", a modern online THERAPY practice.
//
// The clean, contemporary teletherapy practice: a crisp near-white ground, a calm
// soft-indigo primary, a warm apricot accent, and a modern sans (Outfit display over
// Inter body). Destigmatized, accessible, online-first — therapy for professionals,
// stress and burnout, coaching-informed care and affordable memberships. Deliberately
// the OPPOSITE of the warm in-person therapy sibling (sage, serif, a room you walk into)
// — same booking spine, a visibly different business: modern palette, modern type, an
// online/accessible structure whose functional core is BOOKING A SESSION.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-therapy-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-therapy-modern/**" \
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
  hero: 'therapy-modern-hero',
  approach: 'therapy-modern-approach',
  elena: 'therapy-modern-elena',
  marcus: 'therapy-modern-marcus',
  priya: 'therapy-modern-priya',
} as const;

const PHOTO: Record<string, string> = {
  "clearmind-hero": "https://images.unsplash.com/photo-1616587226960-4a03badbe8bf?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cGVyc29uJTIwdmlkZW8lMjBjYWxsJTIwbGFwdG9wJTIwY2FsbXxlbnwwfDB8fHwxNzg2MzkzMjI5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "clearmind-approach": "https://images.unsplash.com/photo-1601642964568-1917224f4e4d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FsbSUyMG1pbmltYWwlMjBob21lJTIwZGVza3xlbnwwfDB8fHwxNzg2MzkzMjMxfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "clearmind-elena": "https://images.unsplash.com/photo-1714976694810-85add1a29c96?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0aGVyYXBpc3QlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyMDc0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "clearmind-marcus": "https://images.unsplash.com/photo-1530268729831-4b0b9e170218?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y291bnNlbG9yJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5MzIzNXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "clearmind-priya": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwcm9mZXNzaW9uYWwlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkzMjM4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('clearmind-hero'),
    alt: 'A calm, light-filled room with a laptop set up for an online therapy session',
  },
  {
    id: IMG.approach,
    url: src('clearmind-approach'),
    alt: 'A person on a sofa at home in a relaxed video call on a tablet',
  },
  {
    id: IMG.elena,
    url: src('clearmind-elena'),
    alt: 'Dr. Elena Voss, clinical psychologist',
  },
  {
    id: IMG.marcus,
    url: src('clearmind-marcus'),
    alt: 'Marcus Reed, licensed therapist',
  },
  {
    id: IMG.priya,
    url: src('clearmind-priya'),
    alt: 'Priya Nair, therapist and wellness coach',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-therapy-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "clearmind": near-white ground, soft-indigo primary, apricot accent, modern sans ─
const clearmind = defineTheme({
  name: 'clearmind',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98.5% 0.004 250)', // crisp near-white
      'oklch(96% 0.007 255)', // cool paper
      'oklch(91% 0.012 258)', // hairline
      'oklch(25% 0.02 265)', // deep ink
    ],
    roles: {
      primary: 'oklch(58% 0.13 262)', // soft indigo
      secondary: 'oklch(37% 0.022 265)', // deep readable slate
      accent: 'oklch(76% 0.1 58)', // warm apricot
      neutral: 'oklch(30% 0.018 265)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.02 265)',
      'oklch(18% 0.016 265)',
      'oklch(14% 0.011 265)',
      'oklch(95% 0.005 250)',
    ],
    roles: {
      primary: 'oklch(72% 0.12 264)',
      secondary: 'oklch(76% 0.02 262)',
      accent: 'oklch(80% 0.1 60)',
      neutral: 'oklch(82% 0.016 262)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, therapists + hours, the session menu) ────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'therapy-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give at least 24 hours’ notice to reschedule or cancel — life happens, and there’s no charge when you let us know in time. We send a reminder the day before and two hours ahead.',
    },
    {
      handle: 'therapy-no-show',
      name: 'Session hold',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Booked sessions are time held just for you. Reschedule with 24 hours’ notice at no cost; a missed session or a same-day cancellation is billed as the full fee so your therapist’s time is respected.',
    },
  ],
  resources: [
    {
      handle: 'elena',
      name: 'Dr. Elena Voss',
      kind: 'staff',
      skillTags: ['individual', 'stress', 'burnout'],
      // Mon–Thu evenings 4–9pm + Sat mornings 9–1
      windows: [...hours([1, 2, 3, 4], 960, 1260), ...hours([6], 540, 780)],
    },
    {
      handle: 'marcus',
      name: 'Marcus Reed',
      kind: 'staff',
      skillTags: ['individual', 'anxiety', 'professionals'],
      // Tue–Fri evenings 5–10pm + Sun afternoons 12–5
      windows: [...hours([2, 3, 4, 5], 1020, 1320), ...hours([0], 720, 1020)],
    },
    {
      handle: 'priya',
      name: 'Priya Nair',
      kind: 'staff',
      skillTags: ['individual', 'coaching', 'stress'],
      // Mon/Wed/Fri evenings 4–8pm + Sat & Sun 10–2
      windows: [...hours([1, 3, 5], 960, 1200), ...hours([6, 0], 600, 840)],
    },
  ],
  services: [
    {
      handle: 'free-matching-call',
      name: 'Free matching call',
      description:
        'A relaxed 20-minute call to hear what you’re looking for and match you with the right therapist. No cost, no pressure.',
      durationMinutes: 20,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['individual'], count: 1 },
      ],
      policyHandle: 'therapy-standard',
    },
    {
      handle: 'intro-session',
      name: 'Intro session',
      description:
        'A first full session to talk things through, set a direction and decide together how to move forward.',
      durationMinutes: 30,
      priceCents: 7500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['individual'], count: 1 },
      ],
      policyHandle: 'therapy-standard',
    },
    {
      handle: 'individual-session',
      name: 'Individual therapy session',
      description:
        'A standard one-to-one video session — a calm, confidential hour to work through what’s on your mind.',
      durationMinutes: 50,
      priceCents: 14000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['individual'], count: 1 },
      ],
      policyHandle: 'therapy-no-show',
    },
    {
      handle: 'stress-burnout-session',
      name: 'Stress & burnout session',
      description:
        'Focused support for chronic stress, overwhelm and burnout — practical tools alongside space to actually breathe.',
      durationMinutes: 50,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['individual'], count: 1 },
      ],
      policyHandle: 'therapy-no-show',
    },
    {
      handle: 'professional-wellness-session',
      name: 'Therapy for professionals',
      description:
        'Coaching-informed therapy for high-demand careers — pressure, perfectionism and work-life balance, on a schedule that fits.',
      durationMinutes: 45,
      priceCents: 14500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['individual'], count: 1 },
      ],
      policyHandle: 'therapy-no-show',
    },
    {
      handle: 'membership-consult',
      name: 'Membership consult',
      description:
        'A short call to walk through our affordable monthly memberships and find the plan that fits your budget and needs.',
      durationMinutes: 25,
      priceCents: 5000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['individual'], count: 1 },
      ],
      policyHandle: 'therapy-standard',
    },
    {
      handle: 'follow-up-session',
      name: 'Follow-up session',
      description:
        'A shorter check-in between full sessions to keep momentum, adjust the plan and stay on track.',
      durationMinutes: 30,
      priceCents: 9000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['individual'], count: 1 },
      ],
      policyHandle: 'therapy-no-show',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A calm, light-filled room with a laptop set up for an online therapy session',
    title: 'Therapy that fits your actual life',
    sub: 'Talk to a licensed therapist by secure video — from home, on your schedule, evenings and weekends included. Getting started takes one short call.',
    primary: { label: 'Book a session', href: '/book' },
    secondary: { label: 'Get matched', href: '/book' },
    overlay: 'soft',
  }),
  featureRow({
    heading: 'How it works',
    items: [
      {
        title: 'Get matched in minutes',
        body: 'Start with a free 20-minute call. We’ll listen to what you need and match you with a therapist who’s the right fit — no endless searching.',
      },
      {
        title: 'Meet by secure video',
        body: 'Sessions happen over private, encrypted video. No waiting room, no commute — just a calm, confidential space wherever you are.',
      },
      {
        title: 'Evenings & weekends',
        body: 'Our therapists hold hours after work and on weekends, so getting support doesn’t mean rearranging your whole day.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways to work together',
    intro: 'Start with a free matching call, then choose the session that fits. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free matching call',
        priceCents: 0,
        durationMin: 20,
        desc: 'A no-cost call to match you with the right therapist.',
      },
      {
        name: 'Individual therapy session',
        priceCents: 14000,
        durationMin: 50,
        desc: 'A confidential one-to-one video session.',
      },
      {
        name: 'Stress & burnout session',
        priceCents: 15000,
        durationMin: 50,
        desc: 'Focused support for overwhelm and burnout.',
      },
      {
        name: 'Therapy for professionals',
        priceCents: 14500,
        durationMin: 45,
        desc: 'Coaching-informed care for high-demand careers.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.approach),
    alt: 'A person on a sofa at home in a relaxed video call on a tablet',
    heading: 'Care that meets you where you are',
    body: [
      'Clearmind is online-first on purpose. Good therapy shouldn’t depend on living near the right office or finding a free afternoon — so we built it around your life, not the other way around.',
      'That means secure video from wherever you feel comfortable, evening and weekend hours, and affordable monthly memberships that make regular support something you can actually keep up.',
    ],
    cta: { label: 'Book a session', href: '/book' },
  }),
  teamRow({
    heading: 'Meet your therapists',
    intro: 'Book by name — you’ll see the same person each session, someone who gets to know you and your story.',
    members: [
      {
        name: 'Dr. Elena Voss',
        role: 'Clinical psychologist',
        image: url(IMG.elena),
        alt: 'Dr. Elena Voss, clinical psychologist',
        bio: 'Stress, burnout and anxiety, with a warm, practical style. Elena leads the practice.',
      },
      {
        name: 'Marcus Reed',
        role: 'Licensed therapist',
        image: url(IMG.marcus),
        alt: 'Marcus Reed, licensed therapist',
        bio: 'Therapy for professionals navigating pressure, change and work-life balance.',
      },
      {
        name: 'Priya Nair',
        role: 'Therapist & wellness coach',
        image: url(IMG.priya),
        alt: 'Priya Nair, therapist and wellness coach',
        bio: 'Coaching-informed care for stress and everyday resilience, weekends included.',
      },
    ],
  }),
  testimonial({
    quote:
      'I’d put off therapy for years because I could never make an appointment work. A weeknight video session I take from my own couch changed everything.',
    attribution: 'Jordan, member since 2024',
  }),
  bookingCta({
    title: 'Take the first small step',
    sub: 'Start with a free 20-minute matching call — no cost, no commitment, just a conversation. It takes about a minute to book.',
    cta: { label: 'Book a session', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.approach),
    alt: 'A person on a sofa at home in a relaxed video call on a tablet',
    title: 'Book your session',
    sub: 'Choose a session to see live availability, then pick your therapist and a time that works for you. New here? Start with the free matching call.',
    primary: { label: 'See sessions below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A calm, light-filled room with a laptop set up for an online therapy session',
    heading: 'About Clearmind Therapy',
    body: [
      'We started Clearmind because reaching out for support is hard enough without the logistics getting in the way. Long waitlists, awkward hours and a two-hour round trip turn “I should talk to someone” into “maybe next year.”',
      'So we built a practice around access: licensed therapists, secure video, evening and weekend hours, and pricing that doesn’t make regular care feel like a luxury. Asking for help is a strength — our job is to make the next step an easy one.',
    ],
    cta: { label: 'Book a session', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'What we believe',
    items: [
      {
        title: 'Therapy is for everyone',
        body: 'Not just for a crisis, and not just for some people. Support to grow, cope and feel more like yourself should be normal and within reach.',
      },
      {
        title: 'The right fit matters',
        body: 'The relationship with your therapist is what makes therapy work. We match carefully, and it’s always okay to ask for a different fit.',
      },
      {
        title: 'Private and yours',
        body: 'Every session is confidential and encrypted. What you share stays between you and your therapist — full stop.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Reach the practice',
    address: [
      'Clearmind Therapy',
      'Online across the state · secure video sessions',
      'Mailing: 210 Alder Way, Suite 4 · Portland, OR 97204',
    ],
    mapLocation: '210 Alder Way, Portland, OR 97204',
    hours: [
      { day: 'Monday – Thursday', time: '4:00 – 10:00 (evenings)' },
      { day: 'Friday', time: '4:00 – 8:00 (evenings)' },
      { day: 'Saturday & Sunday', time: '9:00 – 5:00' },
      { day: 'Holidays', time: 'By arrangement' },
    ],
  }),
  bookingCta({
    title: 'Rather book than email?',
    sub: 'See live availability and reserve a free matching call online — no phone tag, no waiting room.',
    surface: 'muted',
    cta: { label: 'Book a session', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-therapy-modern',
  name: 'Therapy (Modern)',
  summary:
    'A clean, modern teletherapy site — a soft-indigo palette, a warm accent and a modern sans, built for accessible online mental-wellness care. Installs a working booking flow: a free matching call plus individual, stress & burnout, and professional-wellness sessions, three therapists you book by name with evening and weekend hours, and a no-show hold policy. Ships as "Clearmind Therapy", an online-first practice you can book in about a minute.',
  tagline: 'A modern template for online therapy practices — book sessions from day one.',
  industry: 'Counseling',
  sortWeight: 33,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Clearmind Therapy', tagline: 'Therapy that fits your life.' },
  theme: clearmind,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Clearmind Therapy — modern online therapy',
      description:
        'Clearmind is an online-first therapy practice — secure video sessions with licensed therapists, evenings and weekends. Start with a free matching call and book online.',
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
