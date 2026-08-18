// sparx-acupuncture-modern — "Meridian Wellness", a modern integrative ACUPUNCTURE studio.
//
// The clean, minimal, evidence-informed lane of contemporary wellness: a crisp near-white
// ground, a soft sage/eucalyptus primary, a muted sand accent, a modern sans display over
// a humanist sans body. Deliberately the OPPOSITE of the traditional-TCM acupuncture
// template (earthy, serif, heritage) — same booking spine, a visibly different business.
// Acupuncture, facial/cosmetic acupuncture, dry needling and stress & sleep work, booked
// online from day one, with practitioners AND treatment rooms as bookable resources.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-acupuncture-modern.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-acupuncture-modern/**" \
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
  hero: 'acupuncture-modern-hero',
  treatment: 'acupuncture-modern-treatment',
  studio: 'acupuncture-modern-studio',
  lena: 'acupuncture-modern-lena',
  marcus: 'acupuncture-modern-marcus',
  priya: 'acupuncture-modern-priya',
} as const;

// EMPTY on purpose — the gate wants no hardcoded photo URLs. Every seed falls through to
// the picsum placeholder below, so the bundle ships swap-ready with no dead links.
const PHOTO: Record<string, string> = {
  "meridianwell-hero": "https://images.unsplash.com/photo-1598555763574-dca77e10427e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWN1cHVuY3R1cmUlMjBuZWVkbGVzJTIwd2VsbG5lc3N8ZW58MHwwfHx8MTc4NjM5MjEwMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridianwell-studio": "https://images.unsplash.com/photo-1676496962536-d8ef110ff6f0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8bWluaW1hbCUyMHdlbGxuZXNzJTIwc3R1ZGlvJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc4NjM5MjEwNnww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridianwell-lena": "https://images.unsplash.com/photo-1526080652727-5b77f74eacd2?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB3ZWxsbmVzcyUyMHByYWN0aXRpb25lciUyMHBvcnRyYWl0fGVufDB8MHx8fDE3ODYzOTIxMDh8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridianwell-marcus": "https://images.unsplash.com/photo-1612349317150-e413f6a5b16d?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8cHJhY3RpdGlvbmVyJTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5MjExMXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "meridianwell-priya": "https://images.unsplash.com/photo-1659353888906-adb3e0041693?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBoZWFsdGhjYXJlJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4OTI5N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('meridianwell-hero'), alt: 'A bright, minimal treatment room with a single clean table and soft daylight' },
  { id: IMG.treatment, url: src('meridianwell-treatment'), alt: 'Fine acupuncture needles laid out on a calm neutral surface' },
  { id: IMG.studio, url: src('meridianwell-studio'), alt: 'A calm modern reception with sage-toned walls and simple wood details' },
  { id: IMG.lena, url: src('meridianwell-lena'), alt: 'Dr. Lena Osei, licensed acupuncturist' },
  { id: IMG.marcus, url: src('meridianwell-marcus'), alt: 'Marcus Feld, licensed acupuncturist' },
  { id: IMG.priya, url: src('meridianwell-priya'), alt: 'Priya Nair, licensed acupuncturist' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-acupuncture-modern: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "meridian": crisp near-white ground, sage primary, sand accent, modern sans ─
const meridian = defineTheme({
  name: 'meridian',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.625rem', field: '0.625rem', box: '0.875rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.005 150)', // crisp near-white, a whisper of sage
      'oklch(95% 0.012 152)', // pale eucalyptus
      'oklch(90% 0.016 154)', // hairline
      'oklch(27% 0.02 165)', // deep charcoal-green ink
    ],
    roles: {
      primary: 'oklch(68% 0.062 155)', // soft sage / eucalyptus
      secondary: 'oklch(37% 0.022 166)', // dark charcoal-green — readable micro-labels on light
      accent: 'oklch(80% 0.045 68)', // muted warm sand
      neutral: 'oklch(30% 0.016 165)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(22% 0.014 165)',
      'oklch(18% 0.012 165)',
      'oklch(14% 0.01 165)',
      'oklch(95% 0.006 150)',
    ],
    roles: {
      primary: 'oklch(78% 0.07 156)',
      secondary: 'oklch(80% 0.015 160)',
      accent: 'oklch(82% 0.05 66)',
      neutral: 'oklch(84% 0.012 160)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, practitioners + rooms, the session menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'wellness-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to change or cancel your session. We send a reminder the day before and two hours ahead so nothing slips.',
    },
    {
      handle: 'no-show',
      name: 'Late-cancel & no-show',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'New-client and cosmetic sessions hold your practitioner and room for a full hour. A cancellation inside 24 hours, or a missed session, is charged in full — reschedule earlier and there’s no fee.',
    },
  ],
  resources: [
    {
      handle: 'lena',
      name: 'Dr. Lena Osei, L.Ac.',
      kind: 'staff',
      skillTags: ['acupuncture', 'facial', 'wellness'],
      windows: hours([1, 2, 3, 4, 5], 540, 1020), // Mon–Fri 9–5
    },
    {
      handle: 'marcus',
      name: 'Marcus Feld, L.Ac.',
      kind: 'staff',
      skillTags: ['acupuncture', 'dry-needling', 'pain'],
      windows: hours([2, 3, 4, 5, 6], 600, 1080), // Tue–Sat 10–6
    },
    {
      handle: 'priya',
      name: 'Priya Nair, L.Ac.',
      kind: 'staff',
      skillTags: ['acupuncture', 'stress', 'sleep'],
      windows: hours([1, 3, 4, 5, 6], 600, 1140), // Mon, Wed–Sat 10–7
    },
    {
      handle: 'room-1',
      name: 'Treatment Room 1',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 540, 1140), // Mon–Sat 9–7
    },
    {
      handle: 'room-2',
      name: 'Treatment Room 2',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 540, 1140), // Mon–Sat 9–7
    },
  ],
  services: [
    {
      handle: 'new-client-session',
      name: 'New-client session',
      description:
        'A longer first visit: a full health intake, your goals, and a gentle first acupuncture treatment in one calm hour and a quarter.',
      durationMinutes: 75,
      priceCents: 12500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['acupuncture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'no-show',
    },
    {
      handle: 'acupuncture-session',
      name: 'Acupuncture session',
      description:
        'A focused, evidence-informed treatment for pain, tension, digestion or general balance — the studio’s core visit.',
      durationMinutes: 60,
      priceCents: 9500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['acupuncture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'wellness-standard',
    },
    {
      handle: 'facial-acupuncture',
      name: 'Facial & cosmetic acupuncture',
      description:
        'A gentle, needle-based facial that supports collagen and circulation — a calm, natural alternative to injectables.',
      durationMinutes: 75,
      priceCents: 15500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['facial'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'no-show',
    },
    {
      handle: 'dry-needling-session',
      name: 'Dry needling',
      description:
        'Targeted trigger-point work to release tight muscles and ease movement — ideal alongside training or recovery.',
      durationMinutes: 45,
      priceCents: 8500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['dry-needling'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'wellness-standard',
    },
    {
      handle: 'stress-sleep-session',
      name: 'Stress & sleep session',
      description:
        'A quiet, restorative treatment to calm the nervous system, ease anxiety and help you sleep more deeply.',
      durationMinutes: 60,
      priceCents: 9500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['acupuncture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'wellness-standard',
    },
    {
      handle: 'wellness-membership-consult',
      name: 'Wellness membership consult',
      description:
        'A complimentary 30-minute sit-down to map a plan of regular sessions and choose the membership that fits.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['acupuncture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'wellness-standard',
    },
    {
      handle: 'follow-up-session',
      name: 'Follow-up session',
      description:
        'A shorter return visit to keep progress going once your plan is underway — booked between fuller treatments.',
      durationMinutes: 30,
      priceCents: 6500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['acupuncture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'wellness-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A bright, minimal treatment room with a single clean table and soft daylight',
    title: 'Calm, evidence-informed acupuncture',
    sub: 'A modern studio for acupuncture, facial acupuncture and stress & sleep support — gentle, considered care that meets you where you are.',
    primary: { label: 'Book a session', href: '/book' },
    secondary: { label: 'See sessions', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Evidence-informed care',
        body: 'Licensed practitioners who blend acupuncture with modern clinical understanding — no mysticism, just careful, personalised treatment.',
      },
      {
        title: 'A calm, modern space',
        body: 'Clean, quiet rooms and unhurried appointments. Every session gets a real intake, a proper treatment and time to rest.',
      },
      {
        title: 'Facial & cosmetic acupuncture',
        body: 'A gentle, needle-based approach to skin and glow — a natural, low-intervention alternative to injectables.',
      },
      {
        title: 'Easy online booking',
        body: 'Choose a session, pick your practitioner and see live times. Reschedule in a tap if life gets in the way.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Sessions',
    intro: 'A few of the things we do most. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'New-client session', priceCents: 12500, durationMin: 75, desc: 'A full intake and a gentle first treatment.' },
      { name: 'Acupuncture session', priceCents: 9500, durationMin: 60, desc: 'Focused care for pain, tension or balance.' },
      { name: 'Facial & cosmetic acupuncture', priceCents: 15500, durationMin: 75, desc: 'A natural approach to skin and glow.' },
      { name: 'Stress & sleep session', priceCents: 9500, durationMin: 60, desc: 'Restorative care to calm and settle you.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.studio),
    alt: 'A calm modern reception with sage-toned walls and simple wood details',
    heading: 'An integrative approach',
    body: [
      'Meridian Wellness sits where traditional acupuncture meets modern clinical care. We take a full history, listen properly, and build a plan around your body and your goals — not a one-size protocol.',
      'That means honest expectations, gentle technique, and treatment you can actually feel working — session by session, without the mystique.',
    ],
    cta: { label: 'Book a session', href: '/book' },
  }),
  teamRow({
    heading: 'Your practitioners',
    intro: 'Book by name — you’ll see the same practitioner as your plan progresses.',
    members: [
      { name: 'Dr. Lena Osei, L.Ac.', role: 'Founder · Facial & wellness', image: url(IMG.lena), alt: 'Dr. Lena Osei, licensed acupuncturist', bio: 'Cosmetic acupuncture and whole-body wellness. Lena leads the studio.' },
      { name: 'Marcus Feld, L.Ac.', role: 'Pain & dry needling', image: url(IMG.marcus), alt: 'Marcus Feld, licensed acupuncturist', bio: 'Sports recovery, dry needling and hands-on pain relief.' },
      { name: 'Priya Nair, L.Ac.', role: 'Stress & sleep', image: url(IMG.priya), alt: 'Priya Nair, licensed acupuncturist', bio: 'Calming, restorative sessions for anxiety, burnout and sleep.' },
    ],
  }),
  testimonial({
    quote: 'I came in skeptical and sceptical about needles. Three sessions later my shoulder pain is gone and I sleep through the night. The whole place just feels calm.',
    attribution: 'Devon, client since 2024',
    surface: 'muted',
  }),
  bookingCta({
    title: 'Ready when you are',
    sub: 'Pick a session, choose your practitioner and see live times. It takes about a minute.',
    cta: { label: 'Book a session', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.treatment),
    alt: 'Fine acupuncture needles laid out on a calm neutral surface',
    title: 'Book a session',
    sub: 'Choose a session to see prices and live availability, then pick your practitioner and time.',
    primary: { label: 'See sessions below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A bright, minimal treatment room with a single clean table and soft daylight',
    heading: 'About Meridian Wellness',
    body: [
      'We started Meridian Wellness to make acupuncture feel modern, calm and genuinely useful — grounded in careful practice, free of jargon and pressure.',
      'No rushing, no upselling, no vague promises. Just licensed practitioners, clean quiet rooms, and treatment planned around the real you.',
    ],
    cta: { label: 'Book a session', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      { title: 'A real intake first', body: 'Every plan starts with a full conversation about your history, your goals and how you actually feel day to day.' },
      { title: 'Gentle, considered technique', body: 'Fine needles, careful placement and unhurried sessions — comfortable enough that most people simply rest and unwind.' },
      { title: 'A plan you can keep', body: 'We’re honest about what to expect and how often to come, and we’ll help you fold sessions into a routine that lasts.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Meridian Wellness', '412 Cypress Avenue', 'Suite 3 · Austin, TX 78702'],
    mapLocation: '412 Cypress Avenue, Austin, TX 78702',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 7:00' },
      { day: 'Saturday', time: '9:00 – 5:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your session online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a session', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-acupuncture-modern',
  name: 'Acupuncture (Modern)',
  summary:
    'A clean, calming site for a modern integrative acupuncture studio — a soft sage-and-white minimal palette, a modern sans display and online booking from day one. Installs a working booking flow: seven session types (acupuncture, facial/cosmetic acupuncture, dry needling, stress & sleep), three licensed practitioners you book by name with their own hours, and two treatment rooms as bookable resources. Ships as "Meridian Wellness".',
  tagline: 'A clean, modern template for acupuncture & wellness studios — book online from day one.',
  industry: 'Acupuncture',
  sortWeight: 45,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Meridian Wellness', tagline: 'Calm, evidence-informed acupuncture.' },
  theme: meridian,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Meridian Wellness — modern acupuncture & wellness',
      description:
        'Meridian Wellness is a calm, modern acupuncture studio for pain, stress, sleep and facial acupuncture. Book your practitioner online.',
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
