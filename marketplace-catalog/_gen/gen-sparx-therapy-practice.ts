// sparx-therapy-practice — "Anchor Counseling", a warm private THERAPY & counseling practice.
//
// The grounded, established practice of the design research (a quiet older-house office, warm
// wood and soft light, a therapist who has been in town for years): a soft-cream ground, a
// calm sage primary, a warm terracotta accent, a humanist serif display over a plain sans,
// and gentle photography of safe, human spaces. Deliberately the WARM, IN-PERSON-FRIENDLY
// sibling — there is a separate modern teletherapy template (bright, app-forward, video-first),
// so this one leads with the couch in a real room, not the screen. Same booking spine, a
// different practice.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-therapy-practice.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-therapy-practice/**" \
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
  hero: 'therapy-practice-hero',
  office: 'therapy-practice-office',
  claire: 'therapy-practice-claire',
  daniel: 'therapy-practice-daniel',
  renata: 'therapy-practice-renata',
} as const;

// EMPTY on purpose — every seed falls through to a stable picsum placeholder, so the bundle
// ships without hot-linking a real photo. Swap a seed for a real URL here to art-direct.
const PHOTO: Record<string, string> = {
  "anchor-hero": "https://images.unsplash.com/photo-1754294437684-7898b3701ac7?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2FsbSUyMHRoZXJhcHklMjBvZmZpY2V8ZW58MHwwfHx8MTc4NjM5MzIxMHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "anchor-office": "https://images.unsplash.com/photo-1733360485753-0b11ba7a3d91?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y296eSUyMGNvdW5zZWxpbmclMjByb29tfGVufDB8MHx8fDE3ODYzOTMyMTd8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "anchor-claire": "https://images.unsplash.com/photo-1714976694810-85add1a29c96?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjB0aGVyYXBpc3QlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyMDc0fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "anchor-daniel": "https://images.unsplash.com/photo-1557862921-37829c790f19?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8dGhlcmFwaXN0JTIwcG9ydHJhaXQlMjBtYW58ZW58MHwwfHx8MTc4NjM5MzIyM3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "anchor-renata": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y291bnNlbG9yJTIwcG9ydHJhaXQlMjB3b21hbnxlbnwwfDB8fHwxNzg2MzkzMjI2fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('anchor-hero'),
    alt: 'A calm, sunlit therapy room with a soft couch and warm wood',
  },
  {
    id: IMG.office,
    url: src('anchor-office'),
    alt: 'A quiet counseling office with two comfortable chairs and a window',
  },
  {
    id: IMG.claire,
    url: src('anchor-claire'),
    alt: 'Claire Whitfield, LCSW, individual and trauma therapist',
  },
  {
    id: IMG.daniel,
    url: src('anchor-daniel'),
    alt: 'Daniel Okafor, LMFT, couples and individual therapist',
  },
  {
    id: IMG.renata,
    url: src('anchor-renata'),
    alt: 'Renata Alvarez, LPC, teen and anxiety therapist',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-therapy-practice: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "anchor": soft-cream ground, calm sage primary, warm terracotta accent, serif head ─
const anchor = defineTheme({
  name: 'anchor',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(97% 0.014 85)', // soft cream
      'oklch(94% 0.018 88)', // warm oat
      'oklch(89% 0.02 90)', // hairline sand
      'oklch(30% 0.02 150)', // deep sage ink
    ],
    roles: {
      primary: 'oklch(58% 0.055 155)', // calm sage
      secondary: 'oklch(38% 0.025 60)', // warm charcoal (DARK on the cream ground — micro-labels stay readable)
      accent: 'oklch(64% 0.1 45)', // warm terracotta
      neutral: 'oklch(32% 0.02 150)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 155)',
      'oklch(20% 0.016 155)',
      'oklch(16% 0.012 155)',
      'oklch(95% 0.014 85)',
    ],
    roles: {
      primary: 'oklch(72% 0.07 155)', // lifted sage
      secondary: 'oklch(80% 0.02 70)', // warm light ink
      accent: 'oklch(74% 0.1 45)', // lifted terracotta
      neutral: 'oklch(84% 0.015 80)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, therapists + offices + hours, the session menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

// The offices are open the full clinical week; the therapists' own windows narrow real
// availability, so a booking only lands when a therapist AND a room are both free.
const OFFICE_HOURS = hours([1, 2, 3, 4, 5], 480, 1200); // Mon–Fri 8–8

const SCHEDULING = {
  policies: [
    {
      handle: 'session-standard',
      name: 'Standard session',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Life happens — just give us at least 24 hours’ notice to reschedule or cancel, and there’s no charge. We’ll send you a reminder two days before, the day before, and two hours ahead.',
    },
    {
      handle: 'late-cancel',
      name: 'Late-cancellation hold',
      depositType: 'card_hold',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'For sessions that reserve a full hour, we keep a card on file. Reschedule with 48 hours’ notice at no cost; a missed session or a cancellation inside 48 hours is billed as the session fee.',
    },
  ],
  resources: [
    // The therapists — booked by name, each with their own hours (including evenings).
    {
      handle: 'claire',
      name: 'Claire Whitfield, LCSW',
      kind: 'staff',
      skillTags: ['individual', 'anxiety', 'trauma', 'consult'],
      windows: hours([1, 2, 3, 4], 540, 1140), // Mon–Thu 9–7 (evenings)
    },
    {
      handle: 'daniel',
      name: 'Daniel Okafor, LMFT',
      kind: 'staff',
      skillTags: ['couples', 'individual', 'depression', 'consult'],
      windows: [...hours([2, 3, 4], 600, 1200), ...hours([6], 540, 780)], // Tue–Thu 10–8 (evenings), Sat 9–1
    },
    {
      handle: 'renata',
      name: 'Renata Alvarez, LPC',
      kind: 'staff',
      skillTags: ['teens', 'individual', 'anxiety', 'consult'],
      windows: [...hours([1, 3, 5], 720, 1200), ...hours([6], 540, 780)], // Mon/Wed/Fri 12–8 (evenings), Sat 9–1
    },
    // The rooms — two private offices open the full week; telehealth uses a virtual room that
    // still carries the ['office'] tag, so a remote session reserves a "space" the same way.
    {
      handle: 'office-linden',
      name: 'Linden Office',
      kind: 'space',
      skillTags: ['office'],
      windows: OFFICE_HOURS,
    },
    {
      handle: 'office-harbor',
      name: 'Harbor Office',
      kind: 'space',
      skillTags: ['office'],
      windows: OFFICE_HOURS,
    },
    {
      handle: 'telehealth-room',
      name: 'Telehealth Room',
      kind: 'space',
      skillTags: ['office'],
      windows: OFFICE_HOURS,
    },
  ],
  services: [
    {
      handle: 'free-consultation',
      name: 'Free 20-minute consultation',
      description:
        'A no-pressure phone or video call to hear what’s going on, answer your questions, and help you find the right therapist. No commitment, no charge.',
      durationMinutes: 20,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['consult'], count: 1 },
        { role: 'office', kind: 'space', skillTags: ['office'], count: 1 },
      ],
      policyHandle: 'session-standard',
    },
    {
      handle: 'individual-therapy',
      name: 'Individual therapy',
      description:
        'A standard 50-minute session, one-on-one — a steady, confidential space to work through whatever you’re carrying, at your pace.',
      durationMinutes: 50,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['individual'], count: 1 },
        { role: 'office', kind: 'space', skillTags: ['office'], count: 1 },
      ],
      policyHandle: 'late-cancel',
    },
    {
      handle: 'couples-therapy',
      name: 'Couples therapy',
      description:
        'A 60-minute session for two — a calm, even-handed space to be heard, understand each other again, and rebuild the way you talk.',
      durationMinutes: 60,
      priceCents: 18000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['couples'], count: 1 },
        { role: 'office', kind: 'space', skillTags: ['office'], count: 1 },
      ],
      policyHandle: 'late-cancel',
    },
    {
      handle: 'teen-therapy',
      name: 'Teen therapy',
      description:
        'A 50-minute session built for adolescents — a warm, judgment-free place for a teen to feel understood, with parents looped in as it helps.',
      durationMinutes: 50,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['teens'], count: 1 },
        { role: 'office', kind: 'space', skillTags: ['office'], count: 1 },
      ],
      policyHandle: 'late-cancel',
    },
    {
      handle: 'anxiety-session',
      name: 'Anxiety & stress session',
      description:
        'A focused 50-minute session for anxiety, worry and burnout — practical tools you can use between visits, alongside the deeper work.',
      durationMinutes: 50,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['anxiety'], count: 1 },
        { role: 'office', kind: 'space', skillTags: ['office'], count: 1 },
      ],
      policyHandle: 'late-cancel',
    },
    {
      handle: 'trauma-session',
      name: 'Trauma-focused session',
      description:
        'A gentle, carefully paced 60-minute session for processing trauma — always on your terms, never faster than feels safe.',
      durationMinutes: 60,
      priceCents: 17000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['trauma'], count: 1 },
        { role: 'office', kind: 'space', skillTags: ['office'], count: 1 },
      ],
      policyHandle: 'late-cancel',
    },
    {
      handle: 'telehealth-session',
      name: 'Telehealth session',
      description:
        'A 50-minute individual session over secure video — the same care as in the room, from wherever you feel most at ease.',
      durationMinutes: 50,
      priceCents: 15000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'therapist', kind: 'staff', skillTags: ['individual'], count: 1 },
        { role: 'office', kind: 'space', skillTags: ['office'], count: 1 },
      ],
      policyHandle: 'late-cancel',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A calm, sunlit therapy room with a soft couch and warm wood',
    title: 'You don’t have to carry it alone',
    sub: 'Warm, down-to-earth counseling for individuals, couples and teens — in a real room or over secure video. Start with a free consultation, no pressure to continue.',
    primary: { label: 'Book a free consultation', href: '/book' },
    secondary: { label: 'See how we help', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Licensed, genuinely kind therapists',
        body: 'Every one of our clinicians is fully licensed and experienced — and, just as importantly, warm, patient and easy to talk to.',
      },
      {
        title: 'In person or over video',
        body: 'Come sit in one of our quiet offices, or meet from home over secure telehealth. Same care either way — you choose what feels right.',
      },
      {
        title: 'Most insurance & a sliding scale',
        body: 'We accept most major insurance plans and keep a limited number of reduced-fee spots, so cost is one less thing to worry about.',
      },
      {
        title: 'A judgment-free space',
        body: 'Whatever brought you here, you’ll be met with respect and zero judgment. This is your hour — you set the pace.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Ways we can help',
    intro: 'A place to start, not a diagnosis. Full details and real availability are on the booking page — and the first call is always free.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Free 20-minute consultation',
        priceCents: 0,
        durationMin: 20,
        desc: 'A no-pressure call to find the right fit.',
      },
      {
        name: 'Individual therapy',
        priceCents: 15000,
        durationMin: 50,
        desc: 'One-on-one, at your own pace.',
      },
      {
        name: 'Couples therapy',
        priceCents: 18000,
        durationMin: 60,
        desc: 'Learn to hear each other again.',
      },
      {
        name: 'Teen therapy',
        priceCents: 15000,
        durationMin: 50,
        desc: 'A warm space made for adolescents.',
      },
      {
        name: 'Anxiety & stress',
        priceCents: 15000,
        durationMin: 50,
        desc: 'Practical tools alongside the deeper work.',
      },
      {
        name: 'Telehealth session',
        priceCents: 15000,
        durationMin: 50,
        desc: 'The same care, from wherever you are.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.office),
    alt: 'A quiet counseling office with two comfortable chairs and a window',
    heading: 'Therapy that meets you where you are',
    body: [
      'Anchor Counseling started with a simple belief: asking for help should feel human, not clinical. So we built a practice around long conversations, real relationships and the same familiar therapist each time.',
      'You won’t be handed a worksheet and rushed out. We take the time to understand your story, and we work at a pace that feels safe — because that’s where change actually happens.',
    ],
    cta: { label: 'Book a free consultation', href: '/book' },
  }),
  teamRow({
    heading: 'The people you’ll talk to',
    intro: 'Book by name — you’ll see the same therapist each visit, someone who gets to know you and your story.',
    members: [
      {
        name: 'Claire Whitfield, LCSW',
        role: 'Individual & trauma therapist',
        image: url(IMG.claire),
        alt: 'Claire Whitfield, LCSW, individual and trauma therapist',
        bio: 'Fifteen years helping adults with anxiety, depression and trauma. Steady, warm, and never in a hurry.',
      },
      {
        name: 'Daniel Okafor, LMFT',
        role: 'Couples & individual therapist',
        image: url(IMG.daniel),
        alt: 'Daniel Okafor, LMFT, couples and individual therapist',
        bio: 'Helps partners stop the same old argument and actually feel like a team again. Even-handed and calm.',
      },
      {
        name: 'Renata Alvarez, LPC',
        role: 'Teen & anxiety therapist',
        image: url(IMG.renata),
        alt: 'Renata Alvarez, LPC, teen and anxiety therapist',
        bio: 'Teens open up with her. Specializes in adolescent anxiety, school stress and the hard in-between years.',
      },
    ],
  }),
  testimonial({
    quote: 'I put off calling for two years. I wish I’d done it sooner. My therapist made me feel like a person, not a problem — and for the first time in a long while, things feel lighter.',
    attribution: 'A client, in her own words',
  }),
  bookingCta({
    title: 'The hardest part is the first step',
    sub: 'Book a free 20-minute consultation. We’ll listen, answer your questions, and help you find the right person — whether that’s here or somewhere else.',
    cta: { label: 'Book a free consultation', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.office),
    alt: 'A quiet counseling office with two comfortable chairs and a window',
    title: 'Let’s find a time that works',
    sub: 'Start with a free consultation, or book a session directly. Choose what you need below to see real availability, then pick your therapist and time — in person or over video.',
    primary: { label: 'See sessions below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A calm, sunlit therapy room with a soft couch and warm wood',
    heading: 'About Anchor Counseling',
    body: [
      'We’re a small, established counseling practice — the kind of place where the therapist remembers your name and your story, and where the waiting room feels more like a living room than a clinic.',
      'Our name is the whole idea. An anchor doesn’t stop the storm; it keeps you steady through it. That’s what good therapy does, and it’s what we set out to offer: a steady, human place to do the work.',
    ],
    cta: { label: 'Book a free consultation', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'What working with us is like',
    items: [
      {
        title: 'We start by listening',
        body: 'Your first session is about your story — what brought you in, what you’re hoping for, and how you like to work. No script, no rush.',
      },
      {
        title: 'The same therapist, every time',
        body: 'You’re never bounced between clinicians. You build a real relationship with one person who knows your history and your goals.',
      },
      {
        title: 'Confidential, always',
        body: 'What you share stays between you and your therapist. This is a private, protected space — that’s the foundation everything else stands on.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the practice',
    address: ['Anchor Counseling', '412 Harbor Avenue', 'Suite 3 · Asheville, NC 28801'],
    mapLocation: '412 Harbor Avenue, Asheville, NC 28801',
    hours: [
      { day: 'Monday – Thursday', time: '9:00 – 8:00' },
      { day: 'Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: '9:00 – 1:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Not sure where to start?',
    sub: 'Book a free consultation online and we’ll take it from there — or reach out with any question first. There’s no wrong way to begin.',
    surface: 'muted',
    cta: { label: 'Book a free consultation', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-therapy-practice',
  name: 'sparx — Therapy Practice',
  summary:
    'A warm, grounded template for a private therapy & counseling practice — a soft-cream palette, a calm sage primary and a humanist serif, carried by gentle photography. Installs online booking for free consultations and sessions (individual, couples, teen, anxiety, trauma, telehealth), with therapists and private offices as bookable resources for in-person & telehealth counseling. Ships as "Anchor Counseling".',
  tagline: 'A warm, human template for therapists — book consultations & sessions from day one.',
  industry: 'Counseling',
  sortWeight: 34,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Anchor Counseling', tagline: 'Steady support, whenever you’re ready.' },
  theme: anchor,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Anchor Counseling — warm, private therapy',
      description:
        'Anchor Counseling is a warm private practice for individual, couples and teen therapy — in person or over secure video. Book a free consultation online.',
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
