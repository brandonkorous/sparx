// sparx-yoga-studio — "Prana", a WARM, GROUNDED all-levels yoga studio.
//
// The calm, welcoming studio of the wellness lane: a terracotta/clay primary over a
// cream/oat ground, a soft sage accent, and humanist type (a warm serif display over a
// clean sans). Built around a CLASS SCHEDULE with CAPACITY — vinyasa flow, yin, hot,
// restorative, a beginners' foundations track and prenatal — not 1:1 appointments. It is
// deliberately the OPPOSITE of its sibling high-energy strength/HIIT studio: slow, soft,
// "you belong here, wherever you're starting."
//
// This file is JUST the SPEC; composition + emission + the section kit live in the shared
// service-sites/harness.ts. Run:
//   pnpm --filter @wizeworks/api-rest exec tsx "$PWD/marketplace-catalog/_gen/gen-sparx-yoga-studio.ts"
//   pnpm exec prettier --write "marketplace-catalog/blueprints/sparx-yoga-studio/**" \
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
  hero: 'yoga-studio-hero',
  studio: 'yoga-studio-studio',
  flow: 'yoga-studio-flow',
  maya: 'yoga-studio-maya',
  anjali: 'yoga-studio-anjali',
  priya: 'yoga-studio-priya',
  sofia: 'yoga-studio-sofia',
} as const;

const PHOTO: Record<string, string> = {
  "prana-hero": "https://images.unsplash.com/photo-1651077837628-52b3247550ae?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8eW9nYSUyMHN0dWRpbyUyMHByYWN0aWNlfGVufDB8MHx8fDE3ODYzODc0MzN8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prana-studio": "https://images.unsplash.com/photo-1676496962536-d8ef110ff6f0?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8eW9nYSUyMHN0dWRpbyUyMGludGVyaW9yfGVufDB8MHx8fDE3ODYzODc0MzV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prana-flow": "https://images.unsplash.com/photo-1588286840104-8957b019727f?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8eW9nYSUyMGNsYXNzJTIwZ3JvdXB8ZW58MHwwfHx8MTc4NjM4NzQzOHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prana-maya": "https://images.unsplash.com/photo-1717839419301-75b91d4b5f7e?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8eW9nYSUyMGluc3RydWN0b3IlMjBwb3J0cmFpdCUyMHdvbWFufGVufDB8MHx8fDE3ODYzODc0NDF8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prana-anjali": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwb3J0cmFpdCUyMHdlbGxuZXNzfGVufDB8MHx8fDE3ODYzODc0NDV8MA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prana-priya": "https://images.unsplash.com/photo-1602192509154-0b900ee1f851?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8eW9nYSUyMHRlYWNoZXIlMjBwb3J0cmFpdHxlbnwwfDB8fHwxNzg2Mzg3NDQ3fDA&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
  "prana-sofia": "https://images.unsplash.com/photo-1506863530036-1efeddceb993?ixid=M3wxMjA3fDB8MXxzZWFyY2h8Mnx8d29tYW4lMjBwb3J0cmFpdCUyMGNhbG18ZW58MHwwfHx8MTc4NjM4NzQ1MHww&ixlib=rb-4.1.0&w=1600&q=80&fit=crop",
};
const src = (seed: string): string =>
  PHOTO[seed] ?? `https://picsum.photos/seed/${seed}/1600/1000`;

interface Asset {
  id: string;
  url: string;
  alt: string;
}
const ASSETS: Asset[] = [
  { id: IMG.hero, url: src('prana-hero'), alt: 'A warm, sunlit studio with mats laid out on a wood floor' },
  { id: IMG.studio, url: src('prana-studio'), alt: 'A calm studio corner with plants, blankets and soft morning light' },
  { id: IMG.flow, url: src('prana-flow'), alt: 'A small class moving through a gentle vinyasa flow' },
  { id: IMG.maya, url: src('prana-maya'), alt: 'Maya Rivers, vinyasa and hot-yoga teacher' },
  { id: IMG.anjali, url: src('prana-anjali'), alt: 'Anjali Rao, yin and restorative teacher' },
  { id: IMG.priya, url: src('prana-priya'), alt: 'Priya Menon, foundations and prenatal teacher' },
  { id: IMG.sofia, url: src('prana-sofia'), alt: 'Sofia Lindqvist, vinyasa and gentle-flow teacher' },
];
const url = (id: string): string => {
  const a = ASSETS.find((x) => x.id === id);
  if (!a) throw new Error(`gen-yoga-studio: unknown asset "${id}"`);
  return a.url;
};

// ── Theme — "prana": cream/oat ground, terracotta primary, soft sage accent, warm serif ─
const prana = defineTheme({
  name: 'prana',
  type: { body: face('Inter', 'sans-serif'), head: face('Fraunces', 'serif') },
  shape: { selector: '0.75rem', field: '0.625rem', box: '1rem', depth: '0' },
  light: {
    surfaces: [
      'oklch(96% 0.016 74)', // warm cream
      'oklch(92% 0.022 72)', // oat
      'oklch(86% 0.026 68)', // clay hairline
      'oklch(29% 0.022 48)', // warm cocoa ink
    ],
    roles: {
      primary: 'oklch(60% 0.115 42)', // terracotta / clay
      secondary: 'oklch(44% 0.04 52)', // warm brown
      accent: 'oklch(66% 0.05 138)', // soft sage
      neutral: 'oklch(31% 0.018 50)',
      ...STATUS_ON_LIGHT,
    },
  },
  dark: {
    surfaces: [
      'oklch(24% 0.018 46)',
      'oklch(20% 0.014 46)',
      'oklch(16% 0.011 46)',
      'oklch(94% 0.014 80)',
    ],
    roles: {
      primary: 'oklch(71% 0.1 46)',
      secondary: 'oklch(76% 0.02 70)',
      accent: 'oklch(74% 0.05 138)',
      neutral: 'oklch(83% 0.014 70)',
      ...STATUS_ON_DARK,
    },
  },
});

// ── Scheduling — the booking spine (class policy, teachers + studio rooms, the class menu) ─
const hours = (days: number[], startMinute: number, endMinute: number) =>
  days.map((dayOfWeek) => ({ dayOfWeek, startMinute, endMinute }));

const SCHEDULING = {
  policies: [
    {
      handle: 'class-standard',
      name: 'Class booking',
      depositType: 'none',
      cancellationWindowHours: 12,
      reminderOffsetsMin: [1440, 120],
      policyText:
        'Reserve your mat ahead — classes are small and fill up. Cancel at least 12 hours before and your spot frees for the next person; we send a reminder the day before and two hours ahead.',
    },
    {
      handle: 'drop-in',
      name: 'Drop-in',
      depositType: 'none',
      cancellationWindowHours: 4,
      reminderOffsetsMin: [120],
      policyText:
        'Pay as you go — book a single class with no commitment. Life happens; give us a few hours’ notice if your plans change.',
    },
  ],
  resources: [
    {
      handle: 'maya',
      name: 'Maya Rivers',
      kind: 'staff',
      skillTags: ['vinyasa', 'hot', 'power'],
      windows: hours([1, 3, 5, 6], 360, 780), // Mon, Wed, Fri, Sat mornings 6–1
    },
    {
      handle: 'anjali',
      name: 'Anjali Rao',
      kind: 'staff',
      skillTags: ['yin', 'restorative', 'meditation'],
      windows: hours([2, 4, 0], 1020, 1260), // Tue, Thu, Sun evenings 5–9
    },
    {
      handle: 'priya',
      name: 'Priya Menon',
      kind: 'staff',
      skillTags: ['prenatal', 'foundations', 'gentle'],
      windows: hours([1, 2, 4, 6], 540, 840), // Mon, Tue, Thu, Sat 9–2
    },
    {
      handle: 'sofia',
      name: 'Sofia Lindqvist',
      kind: 'staff',
      skillTags: ['vinyasa', 'foundations', 'gentle'],
      windows: hours([3, 5, 0], 540, 1140), // Wed, Fri, Sun 9–7
    },
    {
      handle: 'main-studio',
      name: 'The Grove (main studio)',
      kind: 'space',
      skillTags: ['studio'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 360, 1290), // every day 6am–9:30pm
    },
    {
      handle: 'hot-studio',
      name: 'The Hearth (hot studio)',
      kind: 'space',
      skillTags: ['hot-studio', 'studio'],
      windows: hours([1, 2, 3, 4, 5, 6, 0], 360, 1290),
    },
  ],
  services: [
    {
      handle: 'vinyasa-flow',
      name: 'Vinyasa flow',
      description:
        'A breath-led flow that builds heat and moves with you — strong but never rushed. All levels; modifications offered throughout.',
      bookingType: 'class',
      durationMinutes: 60,
      priceCents: 2200,
      capacity: 20,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['vinyasa'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['studio'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'yin-yoga',
      name: 'Yin yoga',
      description:
        'Long, quiet holds that open the deeper tissues and settle the nervous system. Bring nothing but yourself — props do the work.',
      bookingType: 'class',
      durationMinutes: 75,
      priceCents: 2000,
      capacity: 20,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['yin'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['studio'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'hot-yoga',
      name: 'Hot yoga',
      description:
        'A warm-room flow in The Hearth — heat to loosen, sweat to reset. Come hydrated; leave lighter.',
      bookingType: 'class',
      durationMinutes: 60,
      priceCents: 2500,
      capacity: 24,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['hot'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['hot-studio'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'restorative',
      name: 'Restorative',
      description:
        'Fully supported, deeply still. A slow, blanketed hour that asks nothing of you but rest — the softest landing in the week.',
      bookingType: 'class',
      durationMinutes: 75,
      priceCents: 2000,
      capacity: 18,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['restorative'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['studio'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'foundations',
      name: 'Foundations',
      description:
        'The beginners’ track — the shapes, the breath and the words, taught slowly and kindly. Brand new? Start exactly here.',
      bookingType: 'class',
      durationMinutes: 60,
      priceCents: 1800,
      capacity: 12,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['foundations'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['studio'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'prenatal',
      name: 'Prenatal',
      description:
        'A gentle, knowing practice for every trimester — strength, breath and space, with a teacher who’s been there.',
      bookingType: 'class',
      durationMinutes: 60,
      priceCents: 2000,
      capacity: 12,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['prenatal'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['studio'], count: 1 },
      ],
      policyHandle: 'class-standard',
    },
    {
      handle: 'community-flow',
      name: 'Community flow',
      description:
        'Our pay-what-you-can class — an easy, all-levels gentle flow, open to everyone. Come as you are; bring a friend.',
      bookingType: 'class',
      durationMinutes: 45,
      priceCents: 1500,
      capacity: 24,
      assignmentStrategy: 'collective',
      resourceRequirements: [
        { role: 'teacher', kind: 'staff', skillTags: ['gentle'], count: 1 },
        { role: 'studio', kind: 'space', skillTags: ['studio'], count: 1 },
      ],
      policyHandle: 'drop-in',
    },
  ],
};

// ── Home ───────────────────────────────────────────────────────────────────────
const HOME = [
  photoHero({
    image: url(IMG.hero),
    alt: 'A warm, sunlit studio with mats laid out on a wood floor',
    title: 'You belong here, wherever you’re starting',
    sub: 'A warm, unhurried studio for every body and every level — flow, yin, hot and restorative, taught by people who’ll learn your name.',
    primary: { label: 'Reserve your mat', href: '/book' },
    secondary: { label: 'See the schedule', href: '/book' },
    overlay: 'dark',
  }),
  featureRow({
    items: [
      {
        title: 'Every level, genuinely welcome',
        body: 'Brand new or twenty years in, you’ll be met where you are. Every pose has an option, and asking questions is the whole point.',
      },
      {
        title: 'Small classes, real attention',
        body: 'We cap every class so your teacher can actually see you — adjust, encourage, and keep the room feeling like a room, not a crowd.',
      },
      {
        title: 'Your first class is free',
        body: 'Drop in or become a member — no contracts, no pressure. Try one on us and see how it feels to leave lighter than you came.',
      },
    ],
  }),
  serviceMenu({
    heading: 'The class schedule',
    intro: 'A rhythm for every kind of day — pick your pace. Live times and teachers are on the booking page.',
    surface: 'muted',
    columns: 2,
    items: [
      { name: 'Vinyasa flow', priceCents: 2200, durationMin: 60, desc: 'Breath-led, builds heat, all levels.' },
      { name: 'Yin yoga', priceCents: 2000, durationMin: 75, desc: 'Long, quiet holds; deep release.' },
      { name: 'Hot yoga', priceCents: 2500, durationMin: 60, desc: 'A warm-room flow that resets you.' },
      { name: 'Restorative', priceCents: 2000, durationMin: 75, desc: 'Fully supported, deeply still.' },
      { name: 'Foundations', priceCents: 1800, durationMin: 60, desc: 'The beginners’ track — start here.' },
      { name: 'Prenatal', priceCents: 2000, durationMin: 60, desc: 'A gentle practice for every trimester.' },
    ],
    cta: { label: 'See every class & book', href: '/book' },
  }),
  splitFeature({
    image: url(IMG.studio),
    alt: 'A calm studio corner with plants, blankets and soft morning light',
    heading: 'A slow room in a fast city',
    body: [
      'Prana is a two-room studio built to feel like an exhale — warm wood, soft light, plants in the corners and no mirrors to perform for.',
      'We keep the pace human. Come early, stay for tea, and let the hour be yours. There’s nothing to prove on the mat — only something to notice.',
    ],
    cta: { label: 'Reserve your mat', href: '/book' },
  }),
  teamRow({
    heading: 'Your teachers',
    intro: 'Book by name, or let the schedule choose for you — every one of them teaches for the room, not the mirror.',
    members: [
      { name: 'Maya Rivers', role: 'Vinyasa & hot', image: url(IMG.maya), alt: 'Maya Rivers, vinyasa and hot-yoga teacher', bio: 'Strong, breath-led flows and a warm-room practice that leaves you clear-headed.' },
      { name: 'Anjali Rao', role: 'Yin & restorative', image: url(IMG.anjali), alt: 'Anjali Rao, yin and restorative teacher', bio: 'Long, quiet holds and deep rest — the softest hours on the schedule.' },
      { name: 'Priya Menon', role: 'Foundations & prenatal', image: url(IMG.priya), alt: 'Priya Menon, foundations and prenatal teacher', bio: 'Patient, plain-spoken teaching for brand-new students and every trimester.' },
      { name: 'Sofia Lindqvist', role: 'Vinyasa & gentle flow', image: url(IMG.sofia), alt: 'Sofia Lindqvist, vinyasa and gentle-flow teacher', bio: 'Playful, accessible flow and our pay-what-you-can community class.' },
    ],
  }),
  testimonial({
    quote: 'I walked in convinced I was too stiff, too new, too much. A year later it’s the calmest hour of my week. Nobody here makes you feel behind.',
    attribution: 'Rosa, member since 2024',
  }),
  bookingCta({
    title: 'Reserve your mat',
    sub: 'Pick a class, choose a time, and you’re set. Your first one’s on us — see live availability in about a minute.',
    cta: { label: 'Book a class', href: '/book' },
  }),
];

const BOOK_INTRO = [
  photoHero({
    image: url(IMG.flow),
    alt: 'A small class moving through a gentle vinyasa flow',
    title: 'Book a class',
    sub: 'Choose a class to see the drop-in price, how long it runs and live availability — then pick your teacher and time.',
    primary: { label: 'See classes below', href: '/book' },
    overlay: 'darker',
    align: 'start',
  }),
];

const ABOUT = [
  splitFeature({
    image: url(IMG.hero),
    alt: 'A warm, sunlit studio with mats laid out on a wood floor',
    heading: 'About Prana',
    body: [
      'We opened Prana because so many studios felt like they were for someone else — already flexible, already calm, already sure of the words. We wanted a room for the rest of us.',
      'So this is a place to start, and a place to stay. All levels in the same class, taught kindly, capped small, with teachers who learn your name and meet you exactly where you are.',
    ],
    cta: { label: 'Reserve your mat', href: '/book' },
  }),
  featureRow({
    surface: 'muted',
    heading: 'How the studio works',
    items: [
      { title: 'Come as you are', body: 'No special clothes, no experience, no flexibility required. Bare feet, an open hour, and a mat we’ll lend you if you don’t have one.' },
      { title: 'Drop in or belong', body: 'Pay per class or become a member — whichever fits your life. Memberships are month-to-month, and your first class is always free.' },
      { title: 'Rest is part of it', body: 'We build the schedule around balance: something strong, something slow, and a community flow that’s open to everyone, pay-what-you-can.' },
    ],
  }),
];

const CONTACT = [
  findUs({
    heading: 'Visit the studio',
    address: ['Prana Yoga', '54 Alder Way', 'Studio B · Asheville, NC 28801'],
    mapLocation: '54 Alder Way, Asheville, NC 28801',
    hours: [
      { day: 'Monday – Friday', time: '6:00 – 9:30' },
      { day: 'Saturday', time: '7:00 – 6:00' },
      { day: 'Sunday', time: '8:00 – 8:00' },
      { day: 'Front desk', time: 'Opens 30 min before first class' },
    ],
  }),
  bookingCta({
    title: 'New here? Start with a free class',
    sub: 'Reserve your mat online and see live times — no phone tag, no pressure.',
    surface: 'muted',
    cta: { label: 'Book a class', href: '/book' },
  }),
];

// ── The spec ──────────────────────────────────────────────────────────────────
const SPEC: ServiceSiteSpec = {
  key: 'sparx-yoga-studio',
  name: 'Yoga Studio',
  summary:
    'A warm, grounded yoga-studio site — a terracotta-and-clay palette over a cream ground, a soft sage accent and humanist type. Installs a live class schedule with capacity: vinyasa, yin, hot, restorative, foundations and prenatal, each a bookable class with a drop-in price, plus four teachers and two studio rooms (including a hot room) as bookable resources with weekly hours. Ships as "Prana", an all-levels studio where you belong wherever you’re starting.',
  tagline: 'A warm, all-levels template for yoga studios — a live class schedule from day one.',
  industry: 'Yoga studio',
  sortWeight: 82,
  requiresModules: ['builder', 'scheduling', 'crm', 'email'],
  brand: { businessName: 'Prana', tagline: 'You belong here, wherever you’re starting.' },
  theme: prana,
  chrome: { navbar: 'brandLeft', footer: 'columns', showCta: true },
  seo: {
    home: {
      title: 'Prana — a warm, all-levels yoga studio',
      description:
        'Prana is a warm, unhurried yoga studio for every body — vinyasa, yin, hot, restorative, foundations and prenatal classes, capped small. Your first class is free. Reserve your mat online.',
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
