// sparx-dental-family — "Maple Grove Dental", a friendly FAMILY dental practice.
//
// The warm, reassuring, all-ages practice — gentle and low-anxiety, "a dentist the whole
// family looks forward to." It leads with a bright, friendly photograph and moves through
// calm, welcoming beats: checkups, cleanings, kids' dentistry, whitening, fillings and
// same-day emergencies. Deliberately the SOFT sibling — there is a separate modern
// cosmetic dental-studio template, so this one is the gentle, family-first one, warm-white
// and rounded rather than sharp and clinical. A different business on the same booking
// spine as the salons and the day spa.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-dental-family.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-dental-family/**" \
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
  hero: 'dental-family-hero',
  office: 'dental-family-office',
  amara: 'dental-family-amara',
  nora: 'dental-family-nora',
  priya: 'dental-family-priya',
  kids: 'dental-family-kids',
} as const;

// A swap point: fill an entry to hot-link a specific photograph; anything unlisted falls
// back to a deterministic seeded placeholder, so every asset always resolves to a 200.
const PHOTO: Record<string, string> = {
  "maplegrove-hero": "https://images.unsplash.com/photo-1629909613654-28e377c37b09?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVudGFsJTIwb2ZmaWNlJTIwYnJpZ2h0fGVufDB8MHx8fDE3ODYzODkyODV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "maplegrove-office": "https://images.unsplash.com/photo-1704455306251-b4634215d98f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVudGFsJTIwY2xpbmljJTIwaW50ZXJpb3J8ZW58MHwwfHx8MTc4NjM4OTI4N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "maplegrove-amara": "https://images.unsplash.com/photo-1681939282781-341ac4f61996?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBkZW50aXN0JTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4OTI5MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "maplegrove-nora": "https://images.unsplash.com/photo-1681939282781-341ac4f61996?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8ZGVudGFsJTIwaHlnaWVuaXN0JTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4OTI5NHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "maplegrove-priya": "https://images.unsplash.com/photo-1659353888906-adb3e0041693?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBoZWFsdGhjYXJlJTIwcG9ydHJhaXR8ZW58MHwwfHx8MTc4NjM4OTI5N3ww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "maplegrove-kids": "https://images.unsplash.com/photo-1552873816-636e43209957?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hpbGQlMjBzbWlsaW5nJTIwZGVudGlzdHxlbnwwfDB8fHwxNzg2Mzg5Mjk5fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('maplegrove-hero'), alt: 'A bright, friendly dental office with big windows and warm daylight' },
  { id: IMG.office, url: src('maplegrove-office'), alt: 'A calm, welcoming reception area with soft seating and plants' },
  { id: IMG.amara, url: src('maplegrove-amara'), alt: 'Dr. Amara Osei, family dentist, smiling' },
  { id: IMG.nora, url: src('maplegrove-nora'), alt: 'Nora Bishop, dental hygienist' },
  { id: IMG.priya, url: src('maplegrove-priya'), alt: 'Priya Anand, dental hygienist' },
  { id: IMG.kids, url: src('maplegrove-kids'), alt: 'A young child smiling in the dental chair, relaxed and happy' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-dental-family: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "maplegrove": warm-white ground, friendly teal-blue primary, coral accent ─
const maplegrove = defineTheme({
  name: 'maplegrove',
  type: { body: face('Inter', 'sans-serif'), head: face('Outfit', 'sans-serif') },
  shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(98% 0.008 210)', // warm white with the faintest cool cast
      'oklch(95% 0.014 210)', // soft sky-tinted panel
      'oklch(90% 0.02 215)', // gentle hairline
      'oklch(28% 0.03 240)', // dark slate ink
    ],
    roles: {
      primary: 'oklch(58% 0.12 225)', // friendly teal-blue
      secondary: 'oklch(38% 0.03 240)', // dark slate — readable for micro-labels on light
      accent: 'oklch(72% 0.13 40)', // warm coral / peach
      neutral: 'oklch(30% 0.02 240)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.02 240)',
      'oklch(20% 0.018 240)',
      'oklch(16% 0.015 240)',
      'oklch(95% 0.008 210)',
    ],
    roles: {
      primary: 'oklch(72% 0.11 225)', // teal-blue, lifted for a dark ground
      secondary: 'oklch(80% 0.02 220)',
      accent: 'oklch(76% 0.12 40)',
      neutral: 'oklch(82% 0.015 220)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, dentist + hygienists + operatories) ──────
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

// The operatories are open through the whole business week; a provider's own windows are
// what actually constrain a bookable slot. Every appointment needs a provider AND a room.
const OPEN_WEEK = [...hours([1, 2, 3, 4, 5], 480, 1080), ...hours([6], 540, 840)]; // Mon–Fri 8–6, Sat 9–2

const SCHEDULING = {
  policies: [
    {
      handle: 'dental-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice if you need to change or cancel — it lets us offer the time to another family. We’ll text and email a friendly reminder the day before and two hours ahead.',
    },
    {
      handle: 'dental-no-show',
      name: 'Reserved-chair hold',
      depositType: 'card_hold',
      cancellationWindowHours: 48,
      reminderOffsetsMin: [2880, 1440, 120],
      policyText:
        'Longer visits reserve a chair and a provider just for you, so we hold a card on file — nothing is charged unless the appointment is missed without 48 hours’ notice. Reschedule in time and the hold simply releases.',
    },
  ],
  resources: [
    {
      handle: 'dr-osei',
      name: 'Dr. Amara Osei',
      kind: 'staff',
      skillTags: ['exam', 'filling', 'cosmetic', 'emergency'],
      windows: hours([1, 2, 3, 4, 5], 480, 1020), // Mon–Fri 8–5
    },
    {
      handle: 'nora',
      name: 'Nora Bishop',
      kind: 'staff',
      skillTags: ['cleaning', 'exam', 'xray'],
      windows: hours([1, 2, 3, 4], 480, 960), // Mon–Thu 8–4
    },
    {
      handle: 'priya',
      name: 'Priya Anand',
      kind: 'staff',
      skillTags: ['cleaning', 'kids', 'xray'],
      windows: hours([2, 3, 4, 5], 540, 1020), // Tue–Fri 9–5
    },
    {
      handle: 'operatory-1',
      name: 'Operatory 1',
      kind: 'space',
      skillTags: ['operatory'],
      windows: OPEN_WEEK,
    },
    {
      handle: 'operatory-2',
      name: 'Operatory 2',
      kind: 'space',
      skillTags: ['operatory'],
      windows: OPEN_WEEK,
    },
    {
      handle: 'operatory-3',
      name: 'Operatory 3',
      kind: 'space',
      skillTags: ['operatory'],
      windows: OPEN_WEEK,
    },
  ],
  services: [
    {
      handle: 'new-patient-exam',
      name: 'New patient exam',
      description:
        'A warm welcome, a full check of your teeth and gums, gentle X-rays and a plan built around you. The best first step for anyone new to the practice — every age welcome.',
      durationMinutes: 60,
      priceCents: 8900,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['exam'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['operatory'], count: 1 },
      ],
      policyHandle: 'dental-standard',
    },
    {
      handle: 'cleaning-checkup',
      name: 'Cleaning & checkup',
      description:
        'Your regular six-month visit — a thorough, gentle clean and polish with one of our hygienists, plus a quick check to keep everything on track.',
      durationMinutes: 60,
      priceCents: 11900,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['cleaning'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['operatory'], count: 1 },
      ],
      policyHandle: 'dental-standard',
    },
    {
      handle: 'kids-checkup',
      name: 'Kids’ checkup',
      description:
        'A friendly, unhurried visit made just for little ones — a gentle clean, a count of the teeth and lots of encouragement, so kids leave smiling and keen to come back.',
      durationMinutes: 45,
      priceCents: 7900,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['kids'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['operatory'], count: 1 },
      ],
      policyHandle: 'dental-standard',
    },
    {
      handle: 'whitening-consult',
      name: 'Teeth-whitening consult',
      description:
        'A relaxed, no-pressure chat about brightening your smile — we’ll look at your teeth, talk through the options and what to expect, and answer every question. The consult is free.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['cosmetic'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['operatory'], count: 1 },
      ],
      policyHandle: 'dental-standard',
    },
    {
      handle: 'filling',
      name: 'Filling',
      description:
        'A tooth-coloured filling to fix a small cavity — quick, comfortable and gentle, with numbing whenever you need it and no rushing. We’ll confirm the exact cost before we begin.',
      durationMinutes: 60,
      priceCents: 18500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['filling'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['operatory'], count: 1 },
      ],
      policyHandle: 'dental-no-show',
    },
    {
      handle: 'emergency-visit',
      name: 'Emergency visit',
      description:
        'In pain, chipped a tooth or lost a filling? Request a same-day visit and we’ll get you seen quickly, ease the pain and sort out a plan. We keep time set aside every day for emergencies.',
      durationMinutes: 45,
      priceCents: 12500,
      bufferAfterMin: 10,
      assignmentStrategy: 'any_available',
      requiresApproval: true,
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['emergency'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['operatory'], count: 1 },
      ],
      policyHandle: 'dental-no-show',
    },
    {
      handle: 'cosmetic-consult',
      name: 'Cosmetic consult',
      description:
        'Thinking about veneers, straightening or a smile makeover? Sit down with Dr. Osei for an honest, friendly conversation about what’s possible and what it involves. Free, with no obligation.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'provider', kind: 'staff', skillTags: ['cosmetic'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['operatory'], count: 1 },
      ],
      policyHandle: 'dental-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A bright, friendly dental office with big windows and warm daylight',
    title: 'A dentist the whole family looks forward to',
    sub: 'Gentle, unhurried care for every age — checkups, cleanings, kids’ dentistry and same-day help when it hurts. New patients always welcome.',
    primary: { label: 'Book a checkup', href: '/book' },
    secondary: { label: 'See appointments', href: '/book' },
    overlay: 'soft',
  }),
  featureRow({
    items: [
      {
        title: 'Gentle & anxiety-friendly',
        body: 'Nervous about the dentist? So were half of our patients once. We go slowly, explain everything, and never rush — a lot of people tell us they’ve stopped dreading it.',
      },
      {
        title: 'Most insurance accepted',
        body: 'We work with most major plans and file the claim for you, so there are no surprises. No insurance? Ask about our simple in-house membership.',
      },
      {
        title: 'Same-day emergencies',
        body: 'A toothache can’t wait for next week. We keep time open every day, so if you’re in pain we can usually see you the same day.',
      },
      {
        title: 'Kids genuinely welcome',
        body: 'From first tooth to teenager, we make visits fun and easy — gentle hygienists, no scary words, and plenty of high-fives on the way out.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Appointments',
    intro: 'A few of the visits we see most. Full prices and live availability are on the booking page — and consults are always free.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'New patient exam', priceCents: 8900, durationMin: 60, desc: 'A full check, gentle X-rays and a plan built around you.' },
      { name: 'Cleaning & checkup', priceCents: 11900, durationMin: 60, desc: 'Your gentle six-month clean, polish and check.' },
      { name: 'Kids’ checkup', priceCents: 7900, durationMin: 45, desc: 'A friendly, unhurried visit made just for little ones.' },
      { name: 'Filling', priceCents: 18500, durationMin: 60, desc: 'A comfortable, tooth-coloured fix for a small cavity.' },
      { name: 'Emergency visit', priceCents: 12500, durationMin: 45, desc: 'In pain today? Request a same-day appointment.' },
      { name: 'Teeth-whitening consult', priceCents: 0, durationMin: 30, desc: 'A free, no-pressure chat about a brighter smile.' },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.office),
    alt: 'A calm, welcoming reception area with soft seating and plants',
    heading: 'Family dentistry, the warm way',
    body: [
      'Maple Grove is a neighbourhood practice built for real families — the kind of place where the whole household can be seen in one visit, where the hygienist remembers your kids’ names, and where nobody is ever made to feel rushed or judged.',
      'We keep things simple and honest: clear prices, gentle hands, and only the treatment you actually need. Come as you are — anxious, overdue, or just here for a clean — and leave feeling looked after.',
    ],
    cta: { label: 'Book your visit', href: '/book' },
  }),
  teamRow({
    heading: 'Meet the team',
    intro: 'Book by name — you’ll see friendly, familiar faces every visit.',
    members: [
      { name: 'Dr. Amara Osei', role: 'Family dentist', image: url(IMG.amara), alt: 'Dr. Amara Osei, family dentist, smiling', bio: 'Gentle, all-ages dentistry with a soft spot for nervous patients. Amara founded the practice.' },
      { name: 'Nora Bishop', role: 'Dental hygienist', image: url(IMG.nora), alt: 'Nora Bishop, dental hygienist', bio: 'Thorough, easy-going cleanings and checkups — and the calmest hands in the building.' },
      { name: 'Priya Anand', role: 'Hygienist · kids’ specialist', image: url(IMG.priya), alt: 'Priya Anand, dental hygienist', bio: 'A favourite with the little ones — Priya makes first visits fun and fear-free.' },
    ],
  }),
  testimonial({
    quote: 'My kids actually ask when their next dentist visit is — I never thought I’d say that. The whole team is so gentle and kind, and I finally stopped dreading my own checkups too.',
    attribution: 'Bianca, mum of two & patient since 2022',
  }),
  bookingCta({
    title: 'New patients always welcome',
    sub: 'Pick a visit, choose your provider and see live times. It takes about a minute — and we’ll take it from there.',
    cta: { label: 'Book a checkup', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.kids),
    alt: 'A young child smiling in the dental chair, relaxed and happy',
    title: 'Book your appointment',
    sub: 'Choose a visit to see prices and live availability, then pick your dentist or hygienist and a time that suits the family.',
    primary: { label: 'See appointments below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A bright, friendly dental office with big windows and warm daylight',
    heading: 'About Maple Grove Dental',
    body: [
      'We opened Maple Grove to be the kind of dentist we’d want for our own families — warm, honest and genuinely gentle. Somewhere every age feels welcome, from a toddler’s first visit to a grandparent’s regular checkup.',
      'No upselling, no lectures, no scary surprises. Just clear explanations, gentle care and a friendly team that treats you like a neighbour, because you probably are one.',
    ],
    cta: { label: 'Book a visit', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we care for you',
    items: [
      { title: 'We listen first', body: 'Every visit starts with a real conversation about your teeth, your worries and your budget — so the plan fits your life, not a sales target.' },
      { title: 'Honest, clear pricing', body: 'We’ll always tell you the cost before we start, file your insurance for you, and never push treatment you don’t need.' },
      { title: 'Gentle for every age', body: 'Nervous adults, wriggly toddlers, busy teens — we know how to make each one comfortable, calm and glad they came.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the practice',
    address: ['Maple Grove Dental', '215 Maple Grove Avenue', 'Portland, OR 97213'],
    mapLocation: '215 Maple Grove Avenue, Portland, OR 97213',
    hours: [
      { day: 'Monday – Thursday', time: '8:00 – 5:00' },
      { day: 'Friday', time: '9:00 – 5:00' },
      { day: 'Saturday', time: '9:00 – 2:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your family’s appointments online — no phone tag, no hold music.',
    surface: 'muted',
    cta: { label: 'Book online', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-dental-family',
  name: 'Dental (Family)',
  summary:
    'A warm, family-friendly dental site — a soft teal-blue palette, a coral accent and rounded type, with gentle, low-anxiety copy for every age. Installs a working booking flow: real appointment types (new-patient exams, cleanings, kids’ checkups, whitening, fillings and same-day emergencies), a dentist and two hygienists booked by name with their own hours, operatories as rooms, and a reserved-chair hold policy. Ships as "Maple Grove Dental", a family dentist.',
  tagline: 'A warm, family template for dental practices — book online from day one.',
  industry: 'Dental',
  sortWeight: 70,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Maple Grove Dental', tagline: 'A dentist the whole family looks forward to.' },
  theme: maplegrove,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Maple Grove Dental — a friendly family dentist',
      description:
        'Maple Grove Dental is a warm, gentle family practice for checkups, cleanings, kids’ dentistry, whitening, fillings and same-day emergencies. New patients welcome — book online.',
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
