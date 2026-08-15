// sparx-acupuncture-tcm — "Five Elements Acupuncture", a traditional Chinese-medicine clinic.
//
// The earthy, grounded, timeless lane of the wellness research: warm clay and gold on a
// soft sand ground, a calm serif display over a humanist sans, and quiet photography of a
// serene treatment space. Deliberately the TRADITIONAL, warm, holistic sibling — rooted in
// TCM tradition (acupuncture, cupping, herbal medicine) — and distinct from the modern
// integrative-acupuncture template, which is cooler and more clinical. Same booking spine,
// a different business.
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @sparx/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-acupuncture-tcm.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-acupuncture-tcm/**" \
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
  hero: 'acupuncture-tcm-hero',
  philosophy: 'acupuncture-tcm-philosophy',
  mei: 'acupuncture-tcm-mei',
  daniel: 'acupuncture-tcm-daniel',
  priya: 'acupuncture-tcm-priya',
} as const;

const PHOTO: Record<string, string> = {
  "fiveelements-hero": "https://images.unsplash.com/photo-1598555763574-dca77e10427e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWN1cHVuY3R1cmUlMjB0cmVhdG1lbnR8ZW58MHwwfHx8MTc4NjM5MjA4NXww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fiveelements-philosophy": "https://images.unsplash.com/photo-1580913702955-6c3fcf6ddedc?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8Y2hpbmVzZSUyMG1lZGljaW5lJTIwaGVyYnN8ZW58MHwwfHx8MTc4NjM5MjA4OHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fiveelements-mei": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwcmFjdGl0aW9uZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyMDkyfDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fiveelements-daniel": "https://images.unsplash.com/photo-1549036483-80a2ba8dad65?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8YWN1cHVuY3R1cmlzdCUyMHBvcnRyYWl0JTIwbWFufGVufDB8MHx8fDE3ODYzOTIwOTR8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "fiveelements-priya": "https://images.unsplash.com/photo-1484863137850-59afcfe05386?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d2VsbG5lc3MlMjBwcmFjdGl0aW9uZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2MzkyMDk4fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
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
    url: src('fiveelements-hero'),
    alt: 'A serene treatment room with warm wood, soft light and a made-up table',
  },
  {
    id: IMG.philosophy,
    url: src('fiveelements-philosophy'),
    alt: 'Dried herbs and a set of fine acupuncture needles laid out on a linen cloth',
  },
  {
    id: IMG.mei,
    url: src('fiveelements-mei'),
    alt: 'Mei Lin Zhao, licensed acupuncturist and herbalist',
  },
  {
    id: IMG.daniel,
    url: src('fiveelements-daniel'),
    alt: 'Daniel Okafor, licensed acupuncturist',
  },
  {
    id: IMG.priya,
    url: src('fiveelements-priya'),
    alt: 'Priya Nair, licensed acupuncturist and fertility specialist',
  },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-acupuncture-tcm: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "fiveelements": warm-sand ground, clay primary, warm-gold accent, serif head ─
const fiveelements = defineTheme({
  name: 'fiveelements',
  type: { body: face('Inter', 'sans-serif'), head: face('Cormorant Garamond', 'serif') },
  shape: { selector: '0.5rem', field: '0.5rem', box: '0.75rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(95% 0.018 75)', // warm sand
      'oklch(91% 0.022 72)', // deeper sand
      'oklch(85% 0.026 68)', // hairline
      'oklch(28% 0.02 52)', // deep bark ink
    ],
    roles: {
      primary: 'oklch(56% 0.095 48)', // clay / terracotta
      secondary: 'oklch(37% 0.022 52)', // deep bark — readable micro-labels on sand
      accent: 'oklch(68% 0.088 82)', // warm gold
      neutral: 'oklch(30% 0.016 52)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.016 48)',
      'oklch(20% 0.013 48)',
      'oklch(16% 0.01 48)',
      'oklch(93% 0.014 80)',
    ],
    roles: {
      primary: 'oklch(68% 0.1 50)', // warmed clay
      secondary: 'oklch(76% 0.02 72)',
      accent: 'oklch(77% 0.09 84)',
      neutral: 'oklch(82% 0.015 72)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (policies, practitioners + rooms + hours, the menu) ──
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'tcm-standard',
      name: 'Standard booking',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Please give us at least 24 hours’ notice to reschedule or cancel. We send a gentle reminder the day before and two hours ahead.',
    },
    {
      handle: 'tcm-no-show',
      name: 'No-show policy',
      depositType: 'none',
      cancellationWindowHours: 24,
      reminderOffsetsMin: [1440, 120],
      noShowFeeCents: 4000,
      policyText:
        'Longer treatments hold a chair and a room for you. A missed appointment or a late cancellation (under 24 hours) is charged a $40 no-show fee.',
    },
  ],
  resources: [
    {
      handle: 'mei',
      name: 'Mei Lin Zhao',
      kind: 'staff',
      skillTags: ['acupuncture', 'herbs', 'cupping'],
      windows: hours([1, 2, 3, 4, 5], 540, 1020), // Mon–Fri 9–5
    },
    {
      handle: 'priya',
      name: 'Priya Nair',
      kind: 'staff',
      skillTags: ['acupuncture', 'fertility', 'herbs'],
      windows: hours([2, 3, 4, 6], 600, 1080), // Tue–Thu, Sat 10–6
    },
    {
      handle: 'daniel',
      name: 'Daniel Okafor',
      kind: 'staff',
      skillTags: ['acupuncture', 'pain', 'cupping'],
      windows: hours([1, 3, 4, 5, 6], 600, 1080), // Mon, Wed–Sat 10–6
    },
    {
      handle: 'room-jade',
      name: 'Jade Room',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 540, 1080), // Mon–Sat 9–6
    },
    {
      handle: 'room-willow',
      name: 'Willow Room',
      kind: 'space',
      skillTags: ['treatment-room'],
      windows: hours([1, 2, 3, 4, 5, 6], 540, 1080), // Mon–Sat 9–6
    },
  ],
  services: [
    {
      handle: 'initial-consult-treatment',
      name: 'Initial consultation & treatment',
      description:
        'A full intake — your health history, pulse and tongue diagnosis — followed by your first acupuncture treatment.',
      durationMinutes: 90,
      priceCents: 13000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['acupuncture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'tcm-no-show',
    },
    {
      handle: 'acupuncture-session',
      name: 'Acupuncture session',
      description:
        'A focused follow-up treatment, tailored to how you’re feeling that day. For returning patients.',
      durationMinutes: 60,
      priceCents: 9500,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['acupuncture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'tcm-standard',
    },
    {
      handle: 'cupping-session',
      name: 'Cupping session',
      description:
        'Traditional cupping to ease tension and improve circulation — on its own or added to acupuncture.',
      durationMinutes: 45,
      priceCents: 7500,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['cupping'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'tcm-standard',
    },
    {
      handle: 'herbal-consult',
      name: 'Herbal medicine consultation',
      description:
        'A sit-down to build a custom herbal formula for your constitution, taken home to support your treatment.',
      durationMinutes: 45,
      priceCents: 7000,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['herbs'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'tcm-standard',
    },
    {
      handle: 'fertility-support-session',
      name: 'Fertility support session',
      description:
        'Acupuncture to support reproductive health and cycle regulation, in step with your wider care.',
      durationMinutes: 75,
      priceCents: 11000,
      bufferAfterMin: 10,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['acupuncture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'tcm-no-show',
    },
    {
      handle: 'stress-relief-session',
      name: 'Stress & sleep session',
      description:
        'A calming, restorative treatment for stress, anxiety and sleep — a quiet hour to reset the nervous system.',
      durationMinutes: 60,
      priceCents: 9500,
      assignmentStrategy: 'customer_choice',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['acupuncture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'tcm-standard',
    },
    {
      handle: 'wellness-consult',
      name: 'New-patient wellness consult',
      description:
        'A complimentary conversation to talk through what’s going on and whether treatment here is a good fit.',
      durationMinutes: 30,
      priceCents: 0,
      assignmentStrategy: 'any_available',
      resourceRequirements: [
        { role: 'practitioner', kind: 'staff', skillTags: ['acupuncture'], count: 1 },
        { role: 'room', kind: 'space', skillTags: ['treatment-room'], count: 1 },
      ],
      policyHandle: 'tcm-standard',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A serene treatment room with warm wood, soft light and a made-up table',
    title: 'Healing, the way it has been done for centuries',
    sub: 'A calm clinic for acupuncture, cupping and herbal medicine — traditional Chinese medicine, practised with patience and care.',
    primary: { label: 'Book a treatment', href: '/book' },
    secondary: { label: 'See treatments', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Licensed acupuncturists',
        body: 'Every treatment is with a board-certified, state-licensed acupuncturist — trained for years in both needle work and herbal medicine.',
      },
      {
        title: 'Rooted in tradition',
        body: 'We practise classical Chinese medicine as it was taught: reading the whole person, not just the symptom in front of us.',
      },
      {
        title: 'Custom herbal formulas',
        body: 'Where herbs will help, we build a formula for your constitution — nothing off a shelf, everything made to fit you.',
      },
      {
        title: 'A calm healing space',
        body: 'Warm rooms, quiet music and unhurried appointments. You’re here to slow down, and the space is built for it.',
      },
    ],
  }),
  serviceMenu({
    heading: 'Treatments',
    intro: 'A few of the ways we help. Full prices and live availability are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      {
        name: 'Initial consultation & treatment',
        priceCents: 13000,
        durationMin: 90,
        desc: 'A full intake and your first acupuncture treatment.',
      },
      {
        name: 'Acupuncture session',
        priceCents: 9500,
        durationMin: 60,
        desc: 'A focused follow-up for returning patients.',
      },
      {
        name: 'Cupping session',
        priceCents: 7500,
        durationMin: 45,
        desc: 'Traditional cupping to ease tension.',
      },
      {
        name: 'Herbal medicine consultation',
        priceCents: 7000,
        durationMin: 45,
        desc: 'A custom formula for your constitution.',
      },
    ],
    cta: { label: 'See everything & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.philosophy),
    alt: 'Dried herbs and a set of fine acupuncture needles laid out on a linen cloth',
    heading: 'We treat the whole person',
    body: [
      'Traditional Chinese medicine sees the body as one connected system — the five elements in balance. Pain, poor sleep, low energy and stress are rarely separate problems; they’re signs of where that balance has slipped.',
      'So we don’t chase a single symptom. We read your pulse, look and listen, and treat the pattern underneath — gently, over time, so the results hold.',
    ],
    cta: { label: 'Book a treatment', href: '/book' },
  }),
  teamRow({
    heading: 'Your practitioners',
    intro: 'Book by name — you’ll see the same practitioner each visit.',
    members: [
      {
        name: 'Mei Lin Zhao',
        role: 'Licensed acupuncturist & herbalist',
        image: url(IMG.mei),
        alt: 'Mei Lin Zhao, licensed acupuncturist and herbalist',
        bio: 'Twenty years in classical acupuncture and herbal medicine. Mei founded the clinic.',
      },
      {
        name: 'Priya Nair',
        role: 'Acupuncturist & fertility specialist',
        image: url(IMG.priya),
        alt: 'Priya Nair, licensed acupuncturist and fertility specialist',
        bio: 'Focused on fertility, women’s health and hormonal balance.',
      },
      {
        name: 'Daniel Okafor',
        role: 'Licensed acupuncturist',
        image: url(IMG.daniel),
        alt: 'Daniel Okafor, licensed acupuncturist',
        bio: 'Pain, sports recovery and cupping — helping bodies move freely again.',
      },
    ],
  }),
  testimonial({
    quote: 'I came in for back pain and left sleeping better than I have in years. They actually listen, and take their time.',
    attribution: 'Elena, patient since 2022',
  }),
  bookingCta({
    title: 'Ready to feel more like yourself?',
    sub: 'Choose a treatment, pick your practitioner and see live times. It takes about a minute.',
    cta: { label: 'Book a treatment', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.philosophy),
    alt: 'Dried herbs and a set of fine acupuncture needles laid out on a linen cloth',
    title: 'Book a treatment',
    sub: 'Choose a treatment to see prices and live availability, then pick your practitioner and time.',
    primary: { label: 'See treatments below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A serene treatment room with warm wood, soft light and a made-up table',
    heading: 'About Five Elements Acupuncture',
    body: [
      'We opened Five Elements to practise Chinese medicine the way it was meant to be practised — unhurried, personal, and rooted in a tradition thousands of years old.',
      'No rushing, no one-size-fits-all. Just careful diagnosis, treatment tailored to you, and a calm space to heal in — for pain, stress, sleep, fertility and everything in between.',
    ],
    cta: { label: 'Book a treatment', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How we work',
    items: [
      {
        title: 'Diagnosis first',
        body: 'Every course of care begins with a real intake — your history, your pulse, your tongue — so the treatment fits the person, not the label.',
      },
      {
        title: 'Medicine we trust',
        body: 'Fine, single-use needles and high-grade herbs sourced from suppliers we know — with honest advice on what will and won’t help.',
      },
      {
        title: 'Care that adds up',
        body: 'We plan treatment over time and tell you what to expect, so each visit builds on the last toward a result that lasts.',
      },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the clinic',
    address: ['Five Elements Acupuncture', '54 Maple Court', 'Suite 3 · Asheville, NC 28801'],
    mapLocation: '54 Maple Court, Asheville, NC 28801',
    hours: [
      { day: 'Monday – Friday', time: '9:00 – 6:00' },
      { day: 'Saturday', time: '10:00 – 6:00' },
      { day: 'Sunday', time: 'Closed' },
    ],
  }),
  bookingCta({
    title: 'Rather book than call?',
    sub: 'See live availability and reserve your treatment online — no phone tag.',
    surface: 'muted',
    cta: { label: 'Book a treatment', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-acupuncture-tcm',
  name: 'Acupuncture (Traditional)',
  summary:
    'An earthy, serene template for a traditional Chinese-medicine acupuncture clinic — warm clay and gold on a soft sand ground, with a calm serif display. Installs a working booking flow: acupuncture, cupping, herbal and fertility treatments; three licensed acupuncturists booked by name with their own hours; and two treatment rooms as bookable resources. Ships as "Five Elements Acupuncture", a grounded, holistic healing space rooted in TCM tradition.',
  tagline: 'A warm, grounded template for acupuncture & TCM clinics — book online from day one.',
  industry: 'Acupuncture',
  sortWeight: 46,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Five Elements Acupuncture', tagline: 'Traditional healing, calmly done.' },
  theme: fiveelements,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Five Elements Acupuncture — traditional Chinese medicine',
      description:
        'Five Elements Acupuncture is a calm clinic for acupuncture, cupping and herbal medicine. Book your licensed practitioner online.',
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
